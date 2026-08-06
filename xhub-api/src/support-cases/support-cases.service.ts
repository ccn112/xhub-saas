import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { XofficePrismaService } from '../xoffice-prisma/xoffice-prisma.service';
import { EngineeringSupportClient } from './engineering-support.client';
import {
  SUPPORT_CASE_CATEGORIES,
  SUPPORT_CASE_CHANNELS,
  SUPPORT_CASE_PRIORITIES,
  SUPPORT_CASE_TRANSITIONS,
  SupportCaseAction,
  supportCaseLegalActions,
  supportCaseNext,
} from './support-cases.fsm';

const SOURCE_SYSTEM = 'xoffice-support';

/**
 * Product Customer Support (2026-08-06). Support agents log EXTERNAL
 * customer support cases for a product this company operates/supports (X2,
 * X1, ...) — operational help, data fixes, usage questions, bug reports,
 * feature/upgrade requests. Deliberately separate from TicketsService
 * (internal employee helpdesk) — see the model comment in
 * prisma-xoffice/schema.prisma for why.
 *
 * The escalate() action is the point of this module: a case that needs a
 * real software change gets FILED as a BacklogItem or Defect in the
 * Engineering Governance Hub (Platform DB, :4000) via EngineeringSupportClient
 * — a cross-process HTTP call, same shape as Delivery→Launch. No
 * "ChangeRequest" entity exists (ADR_GOVERNANCE_RECONCILIATION.md already
 * deferred it) — escalation targets the two entities that DO exist.
 */
@Injectable()
export class SupportCasesService {
  constructor(
    private readonly prisma: XofficePrismaService,
    private readonly engineering: EngineeringSupportClient,
  ) {}

  private get db() {
    return this.prisma.db;
  }

  // ---- events + audit --------------------------------------------------
  private async event(
    tenantId: string,
    supportCaseId: string,
    type: string,
    actorId: string,
    data: Record<string, unknown> = {},
  ) {
    await this.db.supportCaseEvent.create({ data: { tenantId, supportCaseId, type, actorId, data: data as any } });
    await this.db.auditLog.create({
      data: {
        tenantId,
        instanceCode: supportCaseId,
        actorId,
        action: `support_case.${type}`,
        detail: JSON.stringify(data).slice(0, 500),
        at: new Date(),
      },
    });
  }

  private assertLegal(action: SupportCaseAction, from: string): string {
    const to = supportCaseNext(action, from);
    if (!to) {
      throw new BadRequestException(
        `Illegal support case transition '${action}' from state '${from}' (legal from: ${SUPPORT_CASE_TRANSITIONS[action]?.from.join(', ') ?? '—'})`,
      );
    }
    return to;
  }

  /**
   * MAX-suffix based, not count-based: a `count()`-based scheme (the
   * DefectsService/BacklogService idiom) silently collides whenever a
   * cancelled/deleted row leaves a gap — e.g. 3 seeded rows + 1 leftover
   * CANCELLED row at 0006 makes count()=4 generate "0005" again even though
   * 0006 (a HIGHER number) already exists. Fixed here by reading the highest
   * existing suffix instead (zero-padded to the same width, so lexical
   * ordering matches numeric ordering) and incrementing past it.
   */
  private async nextCode(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `SUP-${year}-`;
    const last = await this.db.supportCase.findFirst({
      where: { tenantId, code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const lastN = last ? Number(last.code.slice(prefix.length)) || 0 : 0;
    return `${prefix}${String(lastN + 1).padStart(4, '0')}`;
  }

  private decorate(c: any) {
    return { ...c, legalActions: supportCaseLegalActions(c.status) };
  }

  private async load(tenantId: string, id: string) {
    const c = await this.db.supportCase.findFirst({ where: { id, tenantId } });
    if (!c) throw new NotFoundException(`support case not found: ${id}`);
    return c;
  }

  // ==== create ============================================================
  async create(
    tenantId: string,
    actorId: string,
    body: {
      title: string;
      description?: string;
      productCode: string;
      customerId?: string;
      customerTenantRef?: string;
      requesterName?: string;
      requesterContact?: string;
      channel?: string;
      category?: string;
      priority?: string;
      code?: string;
      idempotencyKey?: string;
    },
  ) {
    if (!body?.title?.trim()) throw new BadRequestException('title is required');
    if (!body?.productCode?.trim()) throw new BadRequestException('productCode is required');

    const idempotencyKey = body.idempotencyKey ? String(body.idempotencyKey) : undefined;
    if (idempotencyKey) {
      const existing = await this.db.supportCase.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } } });
      if (existing) return { ...this.decorate(existing), replayed: true };
    }

    const channel = (body.channel ?? 'OTHER').toUpperCase();
    if (!SUPPORT_CASE_CHANNELS.includes(channel)) {
      throw new BadRequestException(`channel must be one of ${SUPPORT_CASE_CHANNELS.join(', ')}`);
    }
    const category = (body.category ?? 'OTHER').toUpperCase();
    if (!SUPPORT_CASE_CATEGORIES.includes(category)) {
      throw new BadRequestException(`category must be one of ${SUPPORT_CASE_CATEGORIES.join(', ')}`);
    }
    const priority = (body.priority ?? 'MEDIUM').toUpperCase();
    if (!SUPPORT_CASE_PRIORITIES.includes(priority)) {
      throw new BadRequestException(`priority must be one of ${SUPPORT_CASE_PRIORITIES.join(', ')}`);
    }

    if (body.customerId) {
      const customer = await this.db.customer.findFirst({ where: { id: body.customerId, tenantId } });
      if (!customer) throw new BadRequestException(`customer not found: ${body.customerId}`);
    }

    const explicitCode = body.code?.trim();
    let created: any;
    // Bounded retry: an explicit caller-supplied code collides at most once
    // (then it's a real conflict, not a race); an auto-generated code can
    // legitimately collide under concurrent creates in the same tenant+year
    // (nextCode() reads-then-increments, not atomic) — regenerate and retry.
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = explicitCode || (await this.nextCode(tenantId));
      try {
        created = await this.db.supportCase.create({
          data: {
            tenantId,
            code,
            title: body.title,
            description: body.description ?? null,
            productCode: body.productCode,
            customerId: body.customerId ?? null,
            customerTenantRef: body.customerTenantRef ?? null,
            requesterName: body.requesterName ?? null,
            requesterContact: body.requesterContact ?? null,
            channel,
            category,
            priority,
            status: 'NEW',
            idempotencyKey: idempotencyKey ?? null,
          },
        });
        break;
      } catch (e: any) {
        if (idempotencyKey && e?.code === 'P2002') {
          const existing = await this.db.supportCase.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } } });
          if (existing) return { ...this.decorate(existing), replayed: true };
        }
        const isCodeClash = e?.code === 'P2002' && !explicitCode;
        if (isCodeClash && attempt < 2) continue;
        if (explicitCode && e?.code === 'P2002') throw new BadRequestException(`Support case code already exists: ${explicitCode}`);
        throw e;
      }
    }
    await this.event(tenantId, created.id, 'created', actorId, { code: created.code, productCode: body.productCode, category, channel, priority });
    return this.decorate(created);
  }

  // ==== list / detail ======================================================
  async list(
    tenantId: string,
    filters: {
      status?: string;
      category?: string;
      priority?: string;
      productCode?: string;
      assigneeId?: string;
      q?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const where: any = { tenantId };
    if (filters.status) where.status = filters.status;
    if (filters.category) where.category = filters.category;
    if (filters.priority) where.priority = filters.priority;
    if (filters.productCode) where.productCode = filters.productCode;
    if (filters.assigneeId) where.assigneeId = filters.assigneeId;
    if (filters.q) where.title = { contains: filters.q, mode: 'insensitive' };

    const rows = await this.db.supportCase.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { id: true, name: true, code: true } } },
    });
    const enriched = rows.map((r) => this.decorate(r));
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, filters.pageSize ?? 20));
    const total = enriched.length;
    const items = enriched.slice((page - 1) * pageSize, page * pageSize);
    return { items, total, page, pageSize };
  }

  async get(tenantId: string, id: string) {
    const supportCase = await this.load(tenantId, id);
    const events = await this.db.supportCaseEvent.findMany({ where: { tenantId, supportCaseId: id }, orderBy: { createdAt: 'asc' } });
    const customer = supportCase.customerId
      ? await this.db.customer.findFirst({ where: { id: supportCase.customerId, tenantId } })
      : null;
    return { case: this.decorate(supportCase), customer, events };
  }

  // ==== transitions ========================================================
  async transition(tenantId: string, actorId: string, id: string, action: SupportCaseAction, opts: { note?: string } = {}) {
    const c = await this.load(tenantId, id);
    const to = this.assertLegal(action, c.status);
    const data: any = { status: to };
    if (to === 'RESOLVED') data.resolvedAt = new Date();
    const updated = await this.db.supportCase.update({ where: { id }, data });
    await this.event(tenantId, id, action, actorId, { to, note: opts.note ?? null });
    return { case: this.decorate(updated) };
  }

  async assign(tenantId: string, actorId: string, id: string, body: { assigneeId: string }) {
    if (!body?.assigneeId) throw new BadRequestException('assigneeId is required');
    await this.load(tenantId, id);
    const updated = await this.db.supportCase.update({ where: { id }, data: { assigneeId: body.assigneeId } });
    await this.event(tenantId, id, 'assign', actorId, { assigneeId: body.assigneeId });
    return { case: this.decorate(updated) };
  }

  // ==== comment ============================================================
  async comment(tenantId: string, actorId: string, id: string, body: { body?: string; visibility?: string }) {
    await this.load(tenantId, id);
    if (!body?.body) throw new BadRequestException('comment body is required');
    const visibility = (body.visibility ?? 'INTERNAL').toUpperCase() === 'CUSTOMER_VISIBLE' ? 'CUSTOMER_VISIBLE' : 'INTERNAL';
    await this.event(tenantId, id, 'comment', actorId, { body: body.body, visibility });
    return { ok: true, visibility };
  }

  // ==== escalate → BacklogItem / Defect (Engineering Governance Hub) ======
  /**
   * Idempotent on the case: a case already escalated (escalationType set)
   * returns the existing link instead of filing a second item — same
   * "repeat click" tolerance as DefectsService.create's testResultId guard.
   * `type` picks the target entity: BACKLOG (feature/upgrade work — maps to
   * BacklogItem.type, default FEATURE) or DEFECT (a real bug — maps to
   * Defect.severity). Looks the Product up by `productCode` first so an
   * unknown/mistyped product fails fast with a clear 404 instead of a
   * confusing downstream error from the Platform process.
   */
  async escalate(
    tenantId: string,
    actorId: string,
    id: string,
    body: { type: 'BACKLOG' | 'DEFECT'; title?: string; description?: string; backlogType?: string; severity?: string; priority?: string },
  ) {
    const c = await this.load(tenantId, id);
    if (c.escalationType && c.escalatedItemId) {
      return { case: this.decorate(c), escalated: { type: c.escalationType, itemId: c.escalatedItemId, code: c.escalatedItemCode }, replayed: true };
    }
    const type = (body?.type ?? '').toUpperCase();
    if (type !== 'BACKLOG' && type !== 'DEFECT') throw new BadRequestException("escalate type must be 'BACKLOG' or 'DEFECT'");

    const product = await this.engineering.findProductByCode(tenantId, actorId, c.productCode);
    if (!product?.id) throw new NotFoundException(`Unknown product in Engineering Hub: ${c.productCode}`);

    const title = body.title?.trim() || c.title;
    const description = body.description?.trim() || c.description || `Escalated from support case ${c.code}`;

    let created: any;
    if (type === 'BACKLOG') {
      created = await this.engineering.createBacklogItem(tenantId, actorId, {
        productId: product.id,
        title,
        description,
        type: body.backlogType ?? 'FEATURE',
        priority: body.priority ?? this.mapPriorityToPx(c.priority),
        sourceSystem: SOURCE_SYSTEM,
        sourceRef: c.code,
        correlationId: c.id,
      });
    } else {
      created = await this.engineering.createDefect(tenantId, actorId, {
        productId: product.id,
        title,
        description,
        severity: body.severity ?? this.mapPriorityToPx(c.priority),
        sourceSystem: SOURCE_SYSTEM,
        sourceRef: c.code,
        correlationId: c.id,
      });
    }

    const updated = await this.db.supportCase.update({
      where: { id },
      data: { escalationType: type, escalatedItemId: created.id, escalatedItemCode: created.code },
    });
    await this.event(tenantId, id, 'escalate', actorId, { type, itemId: created.id, code: created.code, productCode: c.productCode });
    return { case: this.decorate(updated), escalated: { type, itemId: created.id, code: created.code } };
  }

  /** LOW|MEDIUM|HIGH|URGENT (support-case priority) → P0-P3 (backlog/defect priority scale). */
  private mapPriorityToPx(priority: string): string {
    switch (priority) {
      case 'URGENT':
        return 'P0';
      case 'HIGH':
        return 'P1';
      case 'MEDIUM':
        return 'P2';
      default:
        return 'P3';
    }
  }
}
