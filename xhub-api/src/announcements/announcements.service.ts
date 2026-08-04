import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { XofficePrismaService } from '../xoffice-prisma/xoffice-prisma.service';
import { RecordsService } from '../records/records.service';
import { AssignmentResolver } from '../identity/assignment-resolver.service';
import { IdentityService } from '../identity/identity.service';
import {
  AnnouncementAction,
  ANNOUNCEMENT_TRANSITIONS,
  announcementLegalActions,
  announcementNext,
} from './announcements.fsm';

const SUBJECT_TYPE = 'Announcement';

/**
 * AnnouncementsService — the internal announcement / read-acknowledgement module
 * (PH-02e — NX-028). A COMM_ADMIN drafts an Announcement, targets an AUDIENCE
 * (ALL | ORG_UNIT | POSITION | GROUP | USER) and publishes it: the audience is
 * resolved into one AnnouncementReceipt per recipient via the shared
 * AssignmentResolver / identity (NEVER a hardcoded audience). Recipients stamp
 * readAt / acknowledgedAt on their own receipt; the author gets a read/ack report
 * (delivered/read/acked counts + per-user list) and can send a mock reminder to
 * un-acknowledged recipients. Runs inside the caller's withTenant(tenantId)
 * context so every read/write is RLS-scoped, and every transition writes an
 * AnnouncementEvent + AuditLog. Attachments reuse RecordDocument.
 */
@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: XofficePrismaService,
    private readonly records: RecordsService,
    private readonly assignment: AssignmentResolver,
    private readonly identity: IdentityService,
  ) {}

  private get db() {
    return this.prisma.db;
  }

  // ---- events + audit -------------------------------------------------------
  private async event(
    tenantId: string,
    announcementId: string,
    type: string,
    actorId: string,
    data: Record<string, unknown> = {},
  ) {
    await this.db.announcementEvent.create({ data: { tenantId, announcementId, type, actorId, data: data as any } });
    await this.db.auditLog.create({
      data: {
        tenantId,
        instanceCode: announcementId,
        actorId,
        action: `announcement.${type}`,
        detail: JSON.stringify(data).slice(0, 500),
        at: new Date(),
      },
    });
  }

  private assertLegal(action: AnnouncementAction, from: string): string {
    const to = announcementNext(action, from);
    if (!to) {
      throw new BadRequestException(
        `Illegal announcement transition '${action}' from state '${from}' (legal from: ${ANNOUNCEMENT_TRANSITIONS[action]?.from.join(', ') ?? '—'})`,
      );
    }
    return to;
  }

  private decorate(a: any) {
    return { ...a, legalActions: announcementLegalActions(a.state) };
  }

  private async load(tenantId: string, id: string) {
    const a = await this.db.announcement.findFirst({ where: { id, tenantId } });
    if (!a) throw new NotFoundException(`announcement not found: ${id}`);
    return a;
  }

  // ==== create ===============================================================
  /**
   * `idempotencyKey` is OPTIONAL (Security audit 2026-08-04, SEC-003) — when
   * supplied, a replayed create with the SAME key returns the original row
   * instead of creating a duplicate. Callers that omit it get today's
   * unchanged (non-deduplicated) behavior — backward compatible.
   */
  async create(
    tenantId: string,
    actorId: string,
    body: {
      title: string;
      body?: string;
      audienceType?: string;
      audienceId?: string;
      priority?: string;
      requireAck?: boolean;
      publishAt?: string;
      expireAt?: string;
      code?: string;
      authorId?: string;
      idempotencyKey?: string;
    },
  ) {
    if (!body?.title) throw new BadRequestException('title is required');
    const audienceType = (body.audienceType ?? 'ALL').toUpperCase();
    const VALID = ['ALL', 'ORG_UNIT', 'POSITION', 'GROUP', 'USER'];
    if (!VALID.includes(audienceType)) {
      throw new BadRequestException(`audienceType must be one of ${VALID.join(', ')}`);
    }
    if (audienceType !== 'ALL' && !body.audienceId) {
      throw new BadRequestException(`audienceId is required for audienceType '${audienceType}'`);
    }
    const idempotencyKey = body.idempotencyKey ? String(body.idempotencyKey) : undefined;
    if (idempotencyKey) {
      const existing = await this.db.announcement.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } } });
      if (existing) return { ...this.decorate(existing), replayed: true };
    }
    const code =
      body.code ?? `ANN-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    let ann;
    try {
      ann = await this.db.announcement.create({
        data: {
          tenantId,
          code,
          title: body.title,
          body: body.body ?? null,
          authorId: body.authorId ?? actorId,
          audienceType,
          audienceId: audienceType === 'ALL' ? null : body.audienceId ?? null,
          priority: (body.priority ?? 'NORMAL').toUpperCase(),
          requireAck: !!body.requireAck,
          publishAt: body.publishAt ? new Date(body.publishAt) : null,
          expireAt: body.expireAt ? new Date(body.expireAt) : null,
          state: 'DRAFT',
          idempotencyKey: idempotencyKey ?? null,
        },
      });
    } catch (e: any) {
      if (idempotencyKey && e?.code === 'P2002') {
        const existing = await this.db.announcement.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } } });
        if (existing) return { ...this.decorate(existing), replayed: true };
      }
      throw e;
    }
    await this.event(tenantId, ann.id, 'created', actorId, { code, audienceType, requireAck: !!body.requireAck });
    return this.decorate(ann);
  }

  // ==== audience resolution ==================================================
  /**
   * Resolve an announcement's audience into a de-duplicated list of recipient
   * PERSON ids. ALL → every tenant person; POSITION/GROUP → shared
   * AssignmentResolver candidates; ORG_UNIT → holders of positions in that unit;
   * USER → the single person/user id. NEVER a hardcoded audience.
   */
  private async resolveAudience(audienceType: string, audienceId?: string | null): Promise<string[]> {
    const ids = new Set<string>();
    switch (audienceType) {
      case 'ALL': {
        const people = await this.db.personProfile.findMany();
        for (const p of people as any[]) ids.add(p.id);
        break;
      }
      case 'POSITION': {
        const { candidates } = await this.assignment.resolveCandidates({ selectorType: 'POSITION', positionId: audienceId ?? undefined });
        for (const c of candidates) ids.add(c.personId);
        break;
      }
      case 'GROUP': {
        const { candidates } = await this.assignment.resolveCandidates({ selectorType: 'GROUP', groupId: audienceId ?? undefined });
        for (const c of candidates) ids.add(c.personId);
        break;
      }
      case 'ORG_UNIT': {
        const positions = await this.db.position.findMany({ where: { orgUnitId: audienceId ?? undefined } });
        for (const pos of positions as any[]) if (pos.holderPersonId) ids.add(pos.holderPersonId);
        break;
      }
      case 'USER': {
        if (audienceId) {
          // audienceId may be a person id OR a session user id — resolve to person.
          const person = await this.identity.personForUserId(audienceId);
          ids.add(person?.id ?? audienceId);
        }
        break;
      }
    }
    return [...ids];
  }

  // ==== publish ==============================================================
  /** publish — resolve the audience into receipts, mark PUBLISHED (audited). */
  async publish(tenantId: string, actorId: string, id: string) {
    const a = await this.load(tenantId, id);
    const to = this.assertLegal('publish', a.state);
    const recipientPersonIds = await this.resolveAudience(a.audienceType, a.audienceId);

    let created = 0;
    for (const personId of recipientPersonIds) {
      const existing = await this.db.announcementReceipt.findFirst({ where: { announcementId: id, userId: personId } });
      if (existing) continue;
      await this.db.announcementReceipt.create({ data: { tenantId, announcementId: id, userId: personId } });
      created++;
    }

    const updated = await this.db.announcement.update({ where: { id }, data: { state: to, publishAt: a.publishAt ?? new Date() } });
    await this.event(tenantId, id, 'publish', actorId, {
      to,
      audienceType: a.audienceType,
      audienceId: a.audienceId,
      recipients: recipientPersonIds.length,
      receiptsCreated: created,
    });
    return { announcement: this.decorate(updated), recipients: recipientPersonIds.length, receiptsCreated: created };
  }

  /** Generic state-only transition (archive / cancel). */
  async transition(tenantId: string, actorId: string, id: string, action: AnnouncementAction, opts: { note?: string } = {}) {
    const a = await this.load(tenantId, id);
    const to = this.assertLegal(action, a.state);
    const updated = await this.db.announcement.update({ where: { id }, data: { state: to } });
    await this.event(tenantId, id, action, actorId, { to, note: opts.note ?? null });
    return { announcement: this.decorate(updated) };
  }

  async archive(tenantId: string, actorId: string, id: string, opts: { note?: string } = {}) {
    return this.transition(tenantId, actorId, id, 'archive', opts);
  }
  async cancel(tenantId: string, actorId: string, id: string, opts: { note?: string } = {}) {
    return this.transition(tenantId, actorId, id, 'cancel', opts);
  }

  // ==== recipient receipt matching ==========================================
  /**
   * Find the current user's receipt on an announcement. person-id vs mapped
   * user-id are DIFFERENT — accept EITHER (the receipt stores the person id).
   */
  private async receiptFor(tenantId: string, announcementId: string, actorUserId: string) {
    const person = await this.identity.personForUserId(actorUserId);
    const candidateIds = [actorUserId, person?.id].filter(Boolean) as string[];
    return this.db.announcementReceipt.findFirst({
      where: { tenantId, announcementId, userId: { in: candidateIds } },
    });
  }

  /** read — recipient marks the announcement read (stamps readAt once). */
  async read(tenantId: string, actorId: string, id: string) {
    await this.load(tenantId, id);
    const receipt = await this.receiptFor(tenantId, id, actorId);
    if (!receipt) throw new BadRequestException('no receipt for the current user on this announcement (not a recipient)');
    if (receipt.readAt) return { ok: true, receipt, alreadyRead: true };
    const updated = await this.db.announcementReceipt.update({ where: { id: receipt.id }, data: { readAt: new Date() } });
    await this.event(tenantId, id, 'read', actorId, { userId: receipt.userId });
    return { ok: true, receipt: updated };
  }

  /** acknowledge — recipient confirms; only when the announcement requireAck. */
  async acknowledge(tenantId: string, actorId: string, id: string) {
    const a = await this.load(tenantId, id);
    if (!a.requireAck) throw new BadRequestException('this announcement does not require acknowledgement');
    const receipt = await this.receiptFor(tenantId, id, actorId);
    if (!receipt) throw new BadRequestException('no receipt for the current user on this announcement (not a recipient)');
    const now = new Date();
    const updated = await this.db.announcementReceipt.update({
      where: { id: receipt.id },
      data: { acknowledgedAt: receipt.acknowledgedAt ?? now, readAt: receipt.readAt ?? now },
    });
    await this.event(tenantId, id, 'acknowledge', actorId, { userId: receipt.userId });
    return { ok: true, receipt: updated };
  }

  // ==== reminder =============================================================
  /**
   * remind — author re-notifies un-acknowledged (or, when no ack required,
   * un-read) recipients. A MOCK reminder: no real push/email — it bumps
   * remindedAt / remindCount on the pending receipts and is audited.
   */
  async remind(tenantId: string, actorId: string, id: string) {
    const a = await this.load(tenantId, id);
    const pendingWhere: any = { tenantId, announcementId: id };
    if (a.requireAck) pendingWhere.acknowledgedAt = null;
    else pendingWhere.readAt = null;
    const pending = await this.db.announcementReceipt.findMany({ where: pendingWhere });
    const now = new Date();
    for (const r of pending) {
      await this.db.announcementReceipt.update({
        where: { id: r.id },
        data: { remindedAt: now, remindCount: { increment: 1 }, deliveredAt: now },
      });
    }
    await this.event(tenantId, id, 'remind', actorId, { reminded: pending.length, basis: a.requireAck ? 'un-acknowledged' : 'un-read', mock: true });
    return { ok: true, reminded: pending.length, mock: true };
  }

  // ==== report ===============================================================
  /** delivered/read/acknowledged counts + per-user list (author view). */
  async report(tenantId: string, id: string) {
    await this.load(tenantId, id);
    const receipts = await this.db.announcementReceipt.findMany({ where: { tenantId, announcementId: id }, orderBy: { createdAt: 'asc' } });
    const delivered = receipts.length;
    const read = receipts.filter((r) => r.readAt).length;
    const acknowledged = receipts.filter((r) => r.acknowledgedAt).length;
    return {
      counts: { delivered, read, acknowledged, pending: delivered - (delivered ? Math.max(read, acknowledged) : 0) },
      recipients: receipts.map((r) => ({
        userId: r.userId,
        deliveredAt: r.deliveredAt,
        readAt: r.readAt,
        acknowledgedAt: r.acknowledgedAt,
        remindCount: r.remindCount,
      })),
    };
  }

  // ==== list =================================================================
  async list(
    tenantId: string,
    actorId: string,
    filters?: {
      scope?: 'mine' | 'for-me' | 'all';
      state?: string;
      q?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const where: any = { tenantId };
    if (filters?.scope === 'mine') where.authorId = actorId;
    if (filters?.state) where.state = filters.state;
    if (filters?.q) where.title = { contains: filters.q, mode: 'insensitive' };

    // for-me: only announcements the current user has a receipt for.
    let myReceiptByAnn: Record<string, any> = {};
    if (filters?.scope === 'for-me') {
      const person = await this.identity.personForUserId(actorId);
      const candidateIds = [actorId, person?.id].filter(Boolean) as string[];
      const myReceipts = await this.db.announcementReceipt.findMany({ where: { tenantId, userId: { in: candidateIds } } });
      const annIds = myReceipts.map((r) => r.announcementId);
      myReceiptByAnn = Object.fromEntries(myReceipts.map((r) => [r.announcementId, r]));
      where.id = { in: annIds.length ? annIds : ['__none__'] };
    }

    const rows = await this.db.announcement.findMany({ where, orderBy: { createdAt: 'desc' } });
    const enriched = rows.map((r) => {
      const mine = myReceiptByAnn[r.id];
      return {
        ...this.decorate(r),
        ...(mine
          ? { myReceipt: { readAt: mine.readAt, acknowledgedAt: mine.acknowledgedAt, unread: !mine.readAt, needsAck: r.requireAck && !mine.acknowledgedAt } }
          : {}),
      };
    });

    const page = Math.max(1, filters?.page ?? 1);
    const pageSize = Math.max(1, Math.min(200, filters?.pageSize ?? 50));
    const total = enriched.length;
    const items = enriched.slice((page - 1) * pageSize, page * pageSize);
    return { items, total, page, pageSize };
  }

  // ==== detail ===============================================================
  async get(tenantId: string, id: string, actorId: string) {
    const ann = await this.load(tenantId, id);
    const [events, attachments, report, myReceipt] = await Promise.all([
      this.db.announcementEvent.findMany({ where: { tenantId, announcementId: id }, orderBy: { createdAt: 'asc' } }),
      this.records.listDocuments(tenantId, { subjectType: SUBJECT_TYPE, subjectId: id }),
      this.report(tenantId, id),
      this.receiptFor(tenantId, id, actorId),
    ]);
    return {
      announcement: this.decorate(ann),
      events,
      attachments,
      report,
      myReceipt: myReceipt
        ? { readAt: myReceipt.readAt, acknowledgedAt: myReceipt.acknowledgedAt, unread: !myReceipt.readAt, needsAck: ann.requireAck && !myReceipt.acknowledgedAt }
        : null,
    };
  }

  // ==== comment ==============================================================
  async comment(tenantId: string, actorId: string, id: string, body: { body?: string; note?: string }) {
    await this.load(tenantId, id);
    const text = body.body ?? body.note;
    if (!text) throw new BadRequestException('comment body is required');
    await this.event(tenantId, id, 'comment', actorId, { body: text });
    return { ok: true };
  }

  // ==== attachment (RecordDocument subjectType=Announcement) =================
  async attachment(
    tenantId: string,
    actorId: string,
    id: string,
    body: { title?: string; note?: string; content?: string; contentBase64?: string; mimeType?: string },
  ) {
    const a = await this.load(tenantId, id);
    const content = body.content ?? `Attachment for ${a.code}: ${body.note ?? 'announcement attachment'}`;
    const doc = await this.records.createDocument(tenantId, actorId, {
      kind: 'ATTACHMENT',
      title: body.title ?? `Attachment — ${a.code}`,
      subjectType: SUBJECT_TYPE,
      subjectId: id,
      tags: ['attachment', 'announcement'],
      ...(body.contentBase64 ? { contentBase64: body.contentBase64 } : { content }),
      mimeType: body.mimeType ?? 'text/plain',
    } as any);
    await this.event(tenantId, id, 'attachment', actorId, { documentId: doc.document?.id, title: doc.document?.title });
    return doc;
  }
}
