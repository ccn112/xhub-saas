import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { XofficePrismaService } from '../xoffice-prisma/xoffice-prisma.service';

const STATUSES = ['PROSPECT', 'ACTIVE', 'INACTIVE', 'BLOCKED'];
const CONTACT_CHANNELS = ['EMAIL', 'SMS', 'CALL', 'ZALO', 'NONE'];

/**
 * CustomersService — Customer/Contact account model + 360 view (Phase 2,
 * BO-0201, docs/implementation/xoffice-ai/). Tenant-scoped (RLS) via
 * XofficePrismaService, runs inside the caller's withTenant(tenantId)
 * context set by XofficeTenantScopeInterceptor — same shape as
 * AnnouncementsService. Field names follow the real source contract
 * (customer-account.schema.json / contact.schema.json) — see
 * prisma-xoffice/schema.prisma's docblock for the exact mapping.
 *
 * `status` is a simple set, not a full FSM — BO-0201's own acceptance
 * criteria are "tenant isolation, duplicate candidates, timeline", not
 * lifecycle governance (that belongs to Opportunity, BO-0202, a later
 * slice not built in this pass).
 */
@Injectable()
export class CustomersService {
  constructor(private readonly prisma: XofficePrismaService) {}

  private get db() {
    return this.prisma.db;
  }

  private async event(tenantId: string, customerId: string, type: string, actorId: string, data: Record<string, unknown> = {}) {
    await this.db.customerEvent.create({ data: { tenantId, customerId, type, actorId, data: data as any } });
    await this.db.auditLog.create({
      data: {
        tenantId,
        instanceCode: customerId,
        actorId,
        action: `customer.${type}`,
        detail: JSON.stringify(data).slice(0, 500),
        at: new Date(),
      },
    });
  }

  private async load(tenantId: string, id: string) {
    const c = await this.db.customer.findFirst({ where: { id, tenantId } });
    if (!c) throw new NotFoundException(`customer not found: ${id}`);
    return c;
  }

  /**
   * BO-0201 acceptance: "duplicate candidates" — a lightweight, same-tenant,
   * significant-token overlap match (e.g. "Riverside" shared between "Công
   * ty Cổ phần Đầu tư Riverside" and a differently-worded new entry), not a
   * whole-string substring check (two company names are rarely a literal
   * substring of one another). Informational only (never blocks create),
   * same spirit as the platform MDM module's own duplicate-pair detection
   * (src/mdm) but scoped to this one tenant's Customer table, not a
   * cross-tenant canonical-record merge — different concerns, different
   * layers.
   */
  private static readonly STOPWORDS = new Set([
    'công', 'ty', 'cổ', 'phần', 'trách', 'nhiệm', 'hữu', 'hạn', 'đầu', 'tư',
    'tập', 'đoàn', 'doanh', 'nghiệp', 'the', 'and', 'of', 'co', 'ltd', 'jsc',
  ]);

  private async duplicateCandidates(tenantId: string, name: string, excludeId?: string) {
    const tokens = name
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length >= 4 && !CustomersService.STOPWORDS.has(t));
    if (tokens.length === 0) return [];

    const candidates = await this.db.customer.findMany({
      where: {
        tenantId,
        OR: tokens.map((t) => ({ name: { contains: t, mode: 'insensitive' as const } })),
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      take: 5,
      select: { id: true, code: true, name: true, status: true },
    });
    return candidates;
  }

  // ==== create ===============================================================
  async create(
    tenantId: string,
    actorId: string,
    body: {
      code?: string;
      name: string;
      status?: string;
      ownerIdentityId?: string;
      industryCode?: string;
      privacyClass?: string;
      taxCode?: string;
      addressLine?: string;
      website?: string;
      notes?: string;
      idempotencyKey?: string;
    },
  ) {
    if (!body?.name?.trim()) throw new BadRequestException('name is required');
    const status = (body.status ?? 'PROSPECT').toUpperCase();
    if (!STATUSES.includes(status)) throw new BadRequestException(`status must be one of ${STATUSES.join(', ')}`);

    const idempotencyKey = body.idempotencyKey ? String(body.idempotencyKey) : undefined;
    if (idempotencyKey) {
      const existing = await this.db.customer.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } } });
      if (existing) return { customer: existing, duplicateCandidates: [], replayed: true };
    }

    const code = body.code?.trim() || `CUS-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

    let customer;
    try {
      customer = await this.db.customer.create({
        data: {
          tenantId,
          code,
          name: body.name.trim(),
          status,
          ownerIdentityId: body.ownerIdentityId,
          industryCode: body.industryCode,
          privacyClass: body.privacyClass,
          taxCode: body.taxCode,
          addressLine: body.addressLine,
          website: body.website,
          notes: body.notes,
          idempotencyKey: idempotencyKey ?? null,
          createdBy: actorId,
        },
      });
    } catch (e: any) {
      if (idempotencyKey && e?.code === 'P2002') {
        const existing = await this.db.customer.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } } });
        if (existing) return { customer: existing, duplicateCandidates: [], replayed: true };
      }
      if (e?.code === 'P2002') throw new BadRequestException(`Customer code already exists: ${code}`);
      throw e;
    }

    const duplicateCandidates = await this.duplicateCandidates(tenantId, body.name, customer.id);
    await this.event(tenantId, customer.id, 'created', actorId, { code, status, duplicateCandidateCount: duplicateCandidates.length });
    return { customer, duplicateCandidates, replayed: false };
  }

  // ==== status ================================================================
  async setStatus(tenantId: string, actorId: string, id: string, status: string) {
    const upper = status.toUpperCase();
    if (!STATUSES.includes(upper)) throw new BadRequestException(`status must be one of ${STATUSES.join(', ')}`);
    const c = await this.load(tenantId, id);
    const updated = await this.db.customer.update({ where: { id }, data: { status: upper } });
    await this.event(tenantId, id, 'status_changed', actorId, { from: c.status, to: upper });
    return updated;
  }

  // ==== contacts ===============================================================
  async addContact(
    tenantId: string,
    actorId: string,
    customerId: string,
    body: {
      displayName: string;
      role?: string;
      email?: string;
      phone?: string;
      contactPreference?: string[];
      consentEvidenceRef?: string;
      isPrimary?: boolean;
      notes?: string;
    },
  ) {
    await this.load(tenantId, customerId);
    if (!body?.displayName?.trim()) throw new BadRequestException('displayName is required');
    const contactPreference = (body.contactPreference ?? []).map((c) => c.toUpperCase());
    for (const c of contactPreference) {
      if (!CONTACT_CHANNELS.includes(c)) throw new BadRequestException(`contactPreference must be one of ${CONTACT_CHANNELS.join(', ')}`);
    }
    // At most one primary contact per customer — unset any existing primary first.
    if (body.isPrimary) {
      await this.db.contact.updateMany({ where: { tenantId, customerId, isPrimary: true }, data: { isPrimary: false } });
    }
    const contact = await this.db.contact.create({
      data: {
        tenantId,
        customerId,
        displayName: body.displayName.trim(),
        role: body.role,
        email: body.email,
        phone: body.phone,
        contactPreference,
        consentEvidenceRef: body.consentEvidenceRef,
        isPrimary: !!body.isPrimary,
        notes: body.notes,
        createdBy: actorId,
      },
    });
    await this.event(tenantId, customerId, 'contact_added', actorId, { contactId: contact.id, displayName: contact.displayName, isPrimary: contact.isPrimary });
    return contact;
  }

  // ==== list / detail =========================================================
  async list(tenantId: string, filters: { status?: string; q?: string } = {}) {
    const where: any = { tenantId };
    if (filters.status) where.status = filters.status.toUpperCase();
    if (filters.q) where.name = { contains: filters.q, mode: 'insensitive' };
    const rows = await this.db.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { contacts: { where: { isPrimary: true }, take: 1 } },
    });
    return rows;
  }

  /** 360 view: customer + all contacts + activity timeline (append-only). */
  async get(tenantId: string, id: string) {
    const customer = await this.load(tenantId, id);
    const [contacts, events] = await Promise.all([
      this.db.contact.findMany({ where: { tenantId, customerId: id }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] }),
      this.db.customerEvent.findMany({ where: { tenantId, customerId: id }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { customer, contacts, events };
  }
}
