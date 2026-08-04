import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { XofficePrismaService } from '../xoffice-prisma/xoffice-prisma.service';
import { RecordsService } from '../records/records.service';
import { AssignmentResolver } from '../identity/assignment-resolver.service';
import { IdentityService } from '../identity/identity.service';
import {
  isOverdue,
  TicketAction,
  ticketLegalActions,
  ticketNext,
  TICKET_TRANSITIONS,
} from './tickets.fsm';

const SUBJECT_TYPE = 'Ticket';
const AGENT_ROLE = 'SERVICE_DESK_AGENT';

/**
 * TicketsService — the Internal Service Desk / Ticket module (PH-02c — NX-026).
 * A Ticket rides ON TOP of the shared workflow engine via an explicit lifecycle
 * (tickets.fsm.ts). Assignment routes an agent through the shared
 * AssignmentResolver (queue by SERVICE_DESK_AGENT role) — NEVER a hardcoded
 * assignee. SLA (slaDueAt) is computed from the linked ServiceCatalogItem's
 * defaultSlaHours. Attachments reuse RecordDocument (subjectType='Ticket').
 * Runs inside the caller's withTenant(tenantId) context so every read/write is
 * RLS-scoped, and every transition writes a TicketEvent + AuditLog.
 */
@Injectable()
export class TicketsService {
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
    ticketId: string,
    type: string,
    actorId: string,
    data: Record<string, unknown> = {},
  ) {
    await this.db.ticketEvent.create({ data: { tenantId, ticketId, type, actorId, data: data as any } });
    await this.db.auditLog.create({
      data: {
        tenantId,
        instanceCode: ticketId,
        actorId,
        action: `ticket.${type}`,
        detail: JSON.stringify(data).slice(0, 500),
        at: new Date(),
      },
    });
  }

  private assertLegal(action: TicketAction, from: string): string {
    const to = ticketNext(action, from);
    if (!to) {
      throw new BadRequestException(
        `Illegal ticket transition '${action}' from state '${from}' (legal from: ${TICKET_TRANSITIONS[action]?.from.join(', ') ?? '—'})`,
      );
    }
    return to;
  }

  // ==== Service Catalog ======================================================
  async listCatalog(tenantId: string) {
    const items = await this.db.serviceCatalogItem.findMany({ where: { tenantId }, orderBy: { code: 'asc' } });
    return { items, total: items.length };
  }

  async createCatalogItem(
    tenantId: string,
    actorId: string,
    body: { code?: string; name: string; category: string; defaultSlaHours?: number; description?: string },
  ) {
    if (!body?.name) throw new BadRequestException('name is required');
    if (!body?.category) throw new BadRequestException('category is required');
    const code = body.code ?? `SVC-${Date.now().toString(36).toUpperCase()}`;
    const item = await this.db.serviceCatalogItem.create({
      data: {
        tenantId,
        code,
        name: body.name,
        category: body.category,
        defaultSlaHours: Number.isFinite(body.defaultSlaHours as number) ? Number(body.defaultSlaHours) : 24,
        description: body.description ?? null,
      },
    });
    await this.db.auditLog.create({
      data: { tenantId, instanceCode: item.id, actorId, action: 'service_catalog.create', detail: JSON.stringify({ code, category: item.category }).slice(0, 500), at: new Date() },
    });
    return item;
  }

  // ==== Ticket create ========================================================
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
      description?: string;
      catalogItemId?: string;
      category?: string;
      priority?: string;
      code?: string;
      requesterId?: string;
      idempotencyKey?: string;
    },
  ) {
    if (!body?.title) throw new BadRequestException('title is required');
    const idempotencyKey = body.idempotencyKey ? String(body.idempotencyKey) : undefined;
    if (idempotencyKey) {
      const existing = await this.db.ticket.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } } });
      if (existing) return { ...this.decorate(existing), replayed: true };
    }

    // Derive category + SLA from the catalog item (if given). slaDueAt =
    // now + defaultSlaHours — the SLA is data-driven from the catalog.
    let category = body.category ?? null;
    let slaDueAt: Date | null = null;
    let catalogItemId: string | null = null;
    if (body.catalogItemId) {
      const item = await this.db.serviceCatalogItem.findFirst({ where: { id: body.catalogItemId, tenantId } });
      if (!item) throw new BadRequestException(`catalog item not found: ${body.catalogItemId}`);
      catalogItemId = item.id;
      category = category ?? item.category;
      slaDueAt = new Date(Date.now() + item.defaultSlaHours * 3600 * 1000);
    }
    if (!category) category = 'GENERAL';

    const code =
      body.code ?? `TK-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const requesterId = body.requesterId ?? actorId;
    let ticket;
    try {
      ticket = await this.db.ticket.create({
        data: {
          tenantId,
          code,
          title: body.title,
          description: body.description ?? null,
          requesterId,
          catalogItemId,
          category,
          priority: (body.priority ?? 'MEDIUM').toUpperCase(),
          state: 'NEW',
          slaDueAt,
          idempotencyKey: idempotencyKey ?? null,
        },
      });
    } catch (e: any) {
      if (idempotencyKey && e?.code === 'P2002') {
        const existing = await this.db.ticket.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } } });
        if (existing) return { ...this.decorate(existing), replayed: true };
      }
      throw e;
    }
    await this.event(tenantId, ticket.id, 'created', actorId, { code, state: 'NEW', category, catalogItemId, slaDueAt });
    return this.decorate(ticket);
  }

  // ==== list =================================================================
  async list(
    tenantId: string,
    actorId: string,
    filters?: {
      scope?: 'mine' | 'assigned' | 'queue' | 'all';
      state?: string;
      category?: string;
      q?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const where: any = { tenantId };
    if (filters?.scope === 'mine') where.requesterId = actorId;
    if (filters?.scope === 'assigned') where.assigneeId = actorId;
    if (filters?.scope === 'queue') where.assigneeId = null;
    if (filters?.state) where.state = filters.state;
    if (filters?.category) where.category = filters.category;
    if (filters?.q) where.title = { contains: filters.q, mode: 'insensitive' };

    const rows = await this.db.ticket.findMany({ where, orderBy: { createdAt: 'desc' } });
    const enriched = rows.map((r) => this.decorate(r));

    const page = Math.max(1, filters?.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, filters?.pageSize ?? 20));
    const total = enriched.length;
    const items = enriched.slice((page - 1) * pageSize, page * pageSize);
    return { items, total, page, pageSize };
  }

  // ==== detail ===============================================================
  async get(tenantId: string, id: string) {
    const ticket = await this.load(tenantId, id);
    const [events, attachments, catalogItem] = await Promise.all([
      this.db.ticketEvent.findMany({ where: { tenantId, ticketId: id }, orderBy: { createdAt: 'asc' } }),
      this.records.listDocuments(tenantId, { subjectType: SUBJECT_TYPE, subjectId: id }),
      ticket.catalogItemId
        ? this.db.serviceCatalogItem.findFirst({ where: { id: ticket.catalogItemId, tenantId } })
        : Promise.resolve(null),
    ]);
    return {
      ticket: this.decorate(ticket),
      catalogItem,
      events,
      attachments,
    };
  }

  private decorate(t: any) {
    return {
      ...t,
      overdue: isOverdue(t.slaDueAt, t.state),
      legalActions: ticketLegalActions(t.state),
    };
  }

  private async load(tenantId: string, id: string) {
    const t = await this.db.ticket.findFirst({ where: { id, tenantId } });
    if (!t) throw new NotFoundException(`ticket not found: ${id}`);
    return t;
  }

  // ==== transitions ==========================================================
  /**
   * Object-level ownership gate for the transitions below (Security audit
   * 2026-08-04 — these routes carry no @RequirePermission, so without this any
   * authenticated tenant member could act on someone else's ticket, a BOLA).
   * `triage` reaches here already gated by `ticket.manage` at the controller,
   * so it skips this check (any manager may triage any new ticket).
   */
  private async assertTicketActor(t: any, actorId: string, action: TicketAction): Promise<void> {
    if (action === 'triage') return;
    if (action === 'cancel') {
      if (actorId === t.requesterId) return;
    } else if (actorId === t.assigneeId) {
      return;
    }
    const decision = await this.prisma.withBypass(() => this.identity.can(actorId, 'ticket.manage'));
    if (!decision.allowed) {
      throw new ForbiddenException(`Only the assigned agent, the requester (cancel), or ticket.manage may ${action} this ticket.`);
    }
  }

  /** Generic state-only transition (triage / start / pending / resume / close / cancel). */
  async transition(tenantId: string, actorId: string, id: string, action: TicketAction, opts: { note?: string } = {}) {
    const t = await this.load(tenantId, id);
    await this.assertTicketActor(t, actorId, action);
    const to = this.assertLegal(action, t.state);
    const data: any = { state: to };
    const updated = await this.db.ticket.update({ where: { id }, data });
    await this.event(tenantId, id, action, actorId, { to, note: opts.note ?? null });
    return { ticket: this.decorate(updated) };
  }

  /**
   * assign (manager) — route to an agent via the shared AssignmentResolver queue
   * (SERVICE_DESK_AGENT role), NEVER a hardcoded assignee. The resolved agent
   * queue is snapshotted (AssignmentResolution + audit) for provenance. The
   * manager may pick a specific agent (body.assigneeId) from that queue; if none
   * is supplied the first queued agent is taken. Rejects an assignee that is not
   * a resolved SERVICE_DESK_AGENT candidate.
   */
  async assign(tenantId: string, actorId: string, id: string, body: { assigneeId?: string } = {}) {
    const t = await this.load(tenantId, id);
    const to = this.assertLegal('assign', t.state);

    const resolution = await this.assignment.resolveAndSnapshot({
      tenantId,
      workflowInstanceCode: t.code,
      nodeId: 'ticket-agent-queue',
      selector: { selectorType: 'ROLE', roleCode: AGENT_ROLE, choicePolicy: 'QUEUE' },
      actorId,
    });
    // Candidate agent identities. A resolved candidate is a PERSON; a manager may
    // legitimately pick it by either its session user id (mapped via identity) or
    // its person id, so accept both forms. candidateUserIds keeps the mapped user
    // ids for provenance; validIds is the full acceptable-pick set.
    const candidateUserIds: string[] = [];
    const validIds = new Set<string>();
    for (const c of resolution.candidates) {
      const userId = (await this.identity.userIdForPerson(c.personId)) ?? c.personId;
      candidateUserIds.push(userId);
      validIds.add(userId);
      validIds.add(c.personId);
    }

    let assigneeId = body.assigneeId ?? null;
    let via = 'assignment-resolver:queue';
    if (assigneeId) {
      // Manager pick — must be a member of the resolved agent queue (when the
      // queue resolved to candidates). Otherwise reject (not a valid agent).
      if (validIds.size && !validIds.has(assigneeId)) {
        throw new BadRequestException(
          `assigneeId '${assigneeId}' is not in the resolved SERVICE_DESK_AGENT queue (${[...validIds].join(', ') || 'empty'})`,
        );
      }
      via = 'assignment-resolver:manager-pick';
    } else {
      assigneeId = candidateUserIds[0] ?? null;
    }
    if (!assigneeId) {
      throw new BadRequestException('Cannot assign: SERVICE_DESK_AGENT queue resolved to 0 agents (needs agent role binding)');
    }

    const updated = await this.db.ticket.update({ where: { id }, data: { state: to, assigneeId } });
    await this.event(tenantId, id, 'assign', actorId, {
      to,
      assigneeId,
      assignment: { via, roleCode: AGENT_ROLE, candidateUserIds, reason: resolution.reason },
    });
    return { ticket: this.decorate(updated), provenance: { via, roleCode: AGENT_ROLE, candidateUserIds } };
  }

  /** claim (agent self-assign) — the acting agent takes the ticket. */
  async claim(tenantId: string, actorId: string, id: string) {
    const t = await this.load(tenantId, id);
    const to = this.assertLegal('claim', t.state);
    const updated = await this.db.ticket.update({ where: { id }, data: { state: to, assigneeId: actorId } });
    await this.event(tenantId, id, 'claim', actorId, { to, assigneeId: actorId });
    return { ticket: this.decorate(updated) };
  }

  /** resolve — agent marks the ticket resolved (gated by ticket.resolve). */
  async resolve(tenantId: string, actorId: string, id: string, opts: { note?: string } = {}) {
    const t = await this.load(tenantId, id);
    const to = this.assertLegal('resolve', t.state);
    const updated = await this.db.ticket.update({ where: { id }, data: { state: to, resolvedAt: new Date() } });
    await this.event(tenantId, id, 'resolve', actorId, { to, note: opts.note ?? null });
    return { ticket: this.decorate(updated) };
  }

  // ==== comment (public / private note) ======================================
  async comment(tenantId: string, actorId: string, id: string, body: { body?: string; note?: string; visibility?: string }) {
    await this.load(tenantId, id);
    const text = body.body ?? body.note;
    if (!text) throw new BadRequestException('comment body is required');
    const visibility = (body.visibility ?? 'PUBLIC').toUpperCase() === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC';
    await this.event(tenantId, id, 'comment', actorId, { body: text, visibility });
    return { ok: true, visibility };
  }

  // ==== attachment (RecordDocument subjectType=Ticket) =======================
  async attachment(
    tenantId: string,
    actorId: string,
    id: string,
    body: { title?: string; note?: string; content?: string; contentBase64?: string; mimeType?: string },
  ) {
    const t = await this.load(tenantId, id);
    const content = body.content ?? `Attachment for ${t.code}: ${body.note ?? 'ticket attachment'}`;
    const doc = await this.records.createDocument(tenantId, actorId, {
      kind: 'ATTACHMENT',
      title: body.title ?? `Attachment — ${t.code}`,
      subjectType: SUBJECT_TYPE,
      subjectId: id,
      tags: ['attachment', 'ticket'],
      ...(body.contentBase64 ? { contentBase64: body.contentBase64 } : { content }),
      mimeType: body.mimeType ?? 'text/plain',
    } as any);
    await this.event(tenantId, id, 'attachment', actorId, { documentId: doc.document?.id, title: doc.document?.title });
    return doc;
  }

  // ==== CSAT (requester-only, on RESOLVED/CLOSED) ============================
  async csat(tenantId: string, actorId: string, id: string, body: { score?: number; comment?: string }) {
    const t = await this.load(tenantId, id);
    if (!['RESOLVED', 'CLOSED'].includes(t.state)) {
      throw new BadRequestException(`CSAT allowed only on RESOLVED/CLOSED tickets (state=${t.state})`);
    }
    if (t.requesterId !== actorId) {
      // Allow a manager override only when explicitly enforcing? No — CSAT is the
      // requester's satisfaction, so it is requester-only.
      throw new ForbiddenException('Only the requester may submit CSAT for this ticket.');
    }
    const score = Number(body.score);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      throw new BadRequestException('score must be an integer 1..5');
    }
    const updated = await this.db.ticket.update({
      where: { id },
      data: { csatScore: score, csatComment: body.comment ?? null },
    });
    await this.event(tenantId, id, 'csat', actorId, { score, comment: body.comment ?? null });
    return { ticket: this.decorate(updated) };
  }
}
