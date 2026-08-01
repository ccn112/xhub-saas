import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecordsService } from '../records/records.service';
import {
  BookingAction,
  BOOKING_ACTIVE,
  BOOKING_TRANSITIONS,
  bookingLegalActions,
  bookingNext,
  isOverdue,
  overlaps,
} from './bookings.fsm';

const SUBJECT_TYPE = 'Booking';

/**
 * BookingsService — the resource booking module (PH-02d — NX-027). A Booking
 * reserves a [startAt,endAt) slot on a BookableResource and rides ON TOP of the
 * shared workflow idiom via an explicit lifecycle (bookings.fsm.ts). The core
 * business rule is CONFLICT DETECTION: a booking that overlaps an existing
 * ACTIVE booking (REQUESTED/APPROVED/CHECKED_IN) for the SAME resource is
 * rejected with 409 — both on create and re-checked on approve. Runs inside the
 * caller's withTenant(tenantId) context so every read/write is RLS-scoped, and
 * every transition writes a BookingEvent + AuditLog. Attachments reuse
 * RecordDocument (subjectType='Booking').
 */
@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly records: RecordsService,
  ) {}

  private get db() {
    return this.prisma.db;
  }

  // ---- events + audit -------------------------------------------------------
  private async event(
    tenantId: string,
    bookingId: string,
    type: string,
    actorId: string,
    data: Record<string, unknown> = {},
  ) {
    await this.db.bookingEvent.create({ data: { tenantId, bookingId, type, actorId, data: data as any } });
    await this.db.auditLog.create({
      data: {
        tenantId,
        instanceCode: bookingId,
        actorId,
        action: `booking.${type}`,
        detail: JSON.stringify(data).slice(0, 500),
        at: new Date(),
      },
    });
  }

  private assertLegal(action: BookingAction, from: string): string {
    const to = bookingNext(action, from);
    if (!to) {
      throw new BadRequestException(
        `Illegal booking transition '${action}' from state '${from}' (legal from: ${BOOKING_TRANSITIONS[action]?.from.join(', ') ?? '—'})`,
      );
    }
    return to;
  }

  /**
   * Conflict check: find any ACTIVE booking for the same resource whose window
   * overlaps [startAt,endAt). excludeId skips the booking itself (used on approve).
   * Throws 409 when a conflict is found.
   */
  private async assertNoConflict(
    tenantId: string,
    resourceId: string,
    startAt: Date,
    endAt: Date,
    excludeId?: string,
  ) {
    const candidates = await this.db.booking.findMany({
      where: {
        tenantId,
        resourceId,
        state: { in: BOOKING_ACTIVE },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    const clash = candidates.find((b) => overlaps(startAt, endAt, b.startAt, b.endAt));
    if (clash) {
      throw new ConflictException(
        `Booking conflict on resource ${resourceId}: overlaps active booking ${clash.code} [${clash.startAt.toISOString()} – ${clash.endAt.toISOString()}]`,
      );
    }
  }

  // ==== Bookable resources ===================================================
  async listResources(tenantId: string, filters?: { type?: string; q?: string }) {
    const where: any = { tenantId };
    if (filters?.type) where.type = filters.type;
    if (filters?.q) where.name = { contains: filters.q, mode: 'insensitive' };
    const items = await this.db.bookableResource.findMany({ where, orderBy: { code: 'asc' } });
    return { items, total: items.length };
  }

  async createResource(
    tenantId: string,
    actorId: string,
    body: { code?: string; name: string; type?: string; capacity?: number; location?: string; orgUnitId?: string },
  ) {
    if (!body?.name) throw new BadRequestException('name is required');
    const type = (body.type ?? 'ROOM').toUpperCase();
    const code = body.code ?? `RES-${Date.now().toString(36).toUpperCase()}`;
    const item = await this.db.bookableResource.create({
      data: {
        tenantId,
        code,
        name: body.name,
        type,
        capacity: Number.isFinite(body.capacity as number) ? Number(body.capacity) : null,
        location: body.location ?? null,
        orgUnitId: body.orgUnitId ?? null,
      },
    });
    await this.db.auditLog.create({
      data: { tenantId, instanceCode: item.id, actorId, action: 'bookable_resource.create', detail: JSON.stringify({ code, type }).slice(0, 500), at: new Date() },
    });
    return item;
  }

  // ==== Booking create =======================================================
  async create(
    tenantId: string,
    actorId: string,
    body: {
      title: string;
      resourceId: string;
      purpose?: string;
      startAt: string;
      endAt: string;
      attendees?: number;
      code?: string;
      requesterId?: string;
    },
  ) {
    if (!body?.title) throw new BadRequestException('title is required');
    if (!body?.resourceId) throw new BadRequestException('resourceId is required');
    if (!body?.startAt || !body?.endAt) throw new BadRequestException('startAt and endAt are required');

    const resource = await this.db.bookableResource.findFirst({ where: { id: body.resourceId, tenantId } });
    if (!resource) throw new BadRequestException(`bookable resource not found: ${body.resourceId}`);

    const startAt = new Date(body.startAt);
    const endAt = new Date(body.endAt);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new BadRequestException('startAt / endAt must be valid dates');
    }
    if (endAt.getTime() <= startAt.getTime()) {
      throw new BadRequestException('endAt must be after startAt');
    }

    // Business rule: no overlap with an existing active booking on this resource.
    await this.assertNoConflict(tenantId, body.resourceId, startAt, endAt);

    const code =
      body.code ?? `BKG-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const requesterId = body.requesterId ?? actorId;
    const booking = await this.db.booking.create({
      data: {
        tenantId,
        code,
        resourceId: body.resourceId,
        requesterId,
        title: body.title,
        purpose: body.purpose ?? null,
        startAt,
        endAt,
        attendees: Number.isFinite(body.attendees as number) ? Number(body.attendees) : null,
        orgUnitId: resource.orgUnitId ?? null,
        state: 'REQUESTED',
      },
    });
    await this.event(tenantId, booking.id, 'created', actorId, { code, state: 'REQUESTED', resourceId: body.resourceId, startAt, endAt });
    return this.decorate(booking);
  }

  // ==== list =================================================================
  async list(
    tenantId: string,
    actorId: string,
    filters?: {
      scope?: 'mine' | 'resource' | 'all';
      state?: string;
      resourceId?: string;
      from?: string;
      to?: string;
      q?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const where: any = { tenantId };
    if (filters?.scope === 'mine') where.requesterId = actorId;
    if (filters?.state) where.state = filters.state;
    if (filters?.resourceId) where.resourceId = filters.resourceId;
    if (filters?.q) where.title = { contains: filters.q, mode: 'insensitive' };
    // Date-range filter on the booking window (any overlap with [from,to)).
    if (filters?.from) where.endAt = { gte: new Date(filters.from) };
    if (filters?.to) where.startAt = { lte: new Date(filters.to) };

    const rows = await this.db.booking.findMany({ where, orderBy: { startAt: 'asc' } });
    const enriched = rows.map((r) => this.decorate(r));

    const page = Math.max(1, filters?.page ?? 1);
    const pageSize = Math.max(1, Math.min(200, filters?.pageSize ?? 50));
    const total = enriched.length;
    const items = enriched.slice((page - 1) * pageSize, page * pageSize);
    return { items, total, page, pageSize };
  }

  // ==== detail ===============================================================
  async get(tenantId: string, id: string) {
    const booking = await this.load(tenantId, id);
    const [events, attachments, resource] = await Promise.all([
      this.db.bookingEvent.findMany({ where: { tenantId, bookingId: id }, orderBy: { createdAt: 'asc' } }),
      this.records.listDocuments(tenantId, { subjectType: SUBJECT_TYPE, subjectId: id }),
      this.db.bookableResource.findFirst({ where: { id: booking.resourceId, tenantId } }),
    ]);
    return {
      booking: this.decorate(booking),
      resource,
      events,
      attachments,
    };
  }

  private decorate(b: any) {
    return {
      ...b,
      overdue: isOverdue(b.endAt, b.state),
      legalActions: bookingLegalActions(b.state),
    };
  }

  private async load(tenantId: string, id: string) {
    const b = await this.db.booking.findFirst({ where: { id, tenantId } });
    if (!b) throw new NotFoundException(`booking not found: ${id}`);
    return b;
  }

  // ==== transitions ==========================================================
  /**
   * approve — manager approves a REQUESTED booking. Re-runs the conflict check
   * (excluding this booking) so a slot that became double-booked while pending is
   * rejected with 409 rather than confirming a clash.
   */
  async approve(tenantId: string, actorId: string, id: string, opts: { note?: string } = {}) {
    const b = await this.load(tenantId, id);
    const to = this.assertLegal('approve', b.state);
    await this.assertNoConflict(tenantId, b.resourceId, b.startAt, b.endAt, b.id);
    const updated = await this.db.booking.update({ where: { id }, data: { state: to } });
    await this.event(tenantId, id, 'approve', actorId, { to, note: opts.note ?? null });
    return { booking: this.decorate(updated) };
  }

  /** Generic state-only transition (reject / cancel). */
  async transition(tenantId: string, actorId: string, id: string, action: BookingAction, opts: { note?: string } = {}) {
    const b = await this.load(tenantId, id);
    const to = this.assertLegal(action, b.state);
    const updated = await this.db.booking.update({ where: { id }, data: { state: to } });
    await this.event(tenantId, id, action, actorId, { to, note: opts.note ?? null });
    return { booking: this.decorate(updated) };
  }

  /** cancel — requester (or manager) cancels an active booking. */
  async cancel(tenantId: string, actorId: string, id: string, opts: { note?: string } = {}) {
    return this.transition(tenantId, actorId, id, 'cancel', opts);
  }

  /** check-in — attendee arrives; stamps checkedInAt. */
  async checkIn(tenantId: string, actorId: string, id: string, opts: { note?: string } = {}) {
    const b = await this.load(tenantId, id);
    const to = this.assertLegal('check-in', b.state);
    const updated = await this.db.booking.update({ where: { id }, data: { state: to, checkedInAt: new Date() } });
    await this.event(tenantId, id, 'check-in', actorId, { to, note: opts.note ?? null });
    return { booking: this.decorate(updated) };
  }

  /** check-out — attendee leaves / releases the resource; stamps checkedOutAt. */
  async checkOut(tenantId: string, actorId: string, id: string, opts: { note?: string } = {}) {
    const b = await this.load(tenantId, id);
    const to = this.assertLegal('check-out', b.state);
    const updated = await this.db.booking.update({ where: { id }, data: { state: to, checkedOutAt: new Date() } });
    await this.event(tenantId, id, 'check-out', actorId, { to, note: opts.note ?? null });
    return { booking: this.decorate(updated) };
  }

  /** no-show — nobody showed up for an APPROVED booking; marks noShow=true. */
  async noShow(tenantId: string, actorId: string, id: string, opts: { note?: string } = {}) {
    const b = await this.load(tenantId, id);
    const to = this.assertLegal('no-show', b.state);
    const updated = await this.db.booking.update({ where: { id }, data: { state: to, noShow: true } });
    await this.event(tenantId, id, 'no-show', actorId, { to, note: opts.note ?? null });
    return { booking: this.decorate(updated) };
  }

  // ==== comment ==============================================================
  async comment(tenantId: string, actorId: string, id: string, body: { body?: string; note?: string }) {
    await this.load(tenantId, id);
    const text = body.body ?? body.note;
    if (!text) throw new BadRequestException('comment body is required');
    await this.event(tenantId, id, 'comment', actorId, { body: text });
    return { ok: true };
  }

  // ==== attachment (RecordDocument subjectType=Booking) ======================
  async attachment(
    tenantId: string,
    actorId: string,
    id: string,
    body: { title?: string; note?: string; content?: string; contentBase64?: string; mimeType?: string },
  ) {
    const b = await this.load(tenantId, id);
    const content = body.content ?? `Attachment for ${b.code}: ${body.note ?? 'booking attachment'}`;
    const doc = await this.records.createDocument(tenantId, actorId, {
      kind: 'ATTACHMENT',
      title: body.title ?? `Attachment — ${b.code}`,
      subjectType: SUBJECT_TYPE,
      subjectId: id,
      tags: ['attachment', 'booking'],
      ...(body.contentBase64 ? { contentBase64: body.contentBase64 } : { content }),
      mimeType: body.mimeType ?? 'text/plain',
    } as any);
    await this.event(tenantId, id, 'attachment', actorId, { documentId: doc.document?.id, title: doc.document?.title });
    return doc;
  }
}
