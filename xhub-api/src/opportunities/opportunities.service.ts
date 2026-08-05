import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { XofficePrismaService } from '../xoffice-prisma/xoffice-prisma.service';

const STAGES = ['LEAD', 'QUALIFIED', 'DISCOVERY', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];

// Opportunity FSM (BO-0202, source contract `Opportunity.stage`). WON/LOST
// are terminal. Any active stage can go straight to LOST (a deal can die at
// any point) — matches real sales-pipeline behavior, not a strict linear walk.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  LEAD: ['QUALIFIED', 'LOST'],
  QUALIFIED: ['DISCOVERY', 'LOST'],
  DISCOVERY: ['PROPOSAL', 'LOST'],
  PROPOSAL: ['NEGOTIATION', 'LOST'],
  NEGOTIATION: ['WON', 'LOST'],
  WON: [],
  LOST: [],
};

/**
 * OpportunitiesService — sales pipeline + stage governance (Phase 2,
 * BO-0202). Tenant-scoped (RLS) via XofficePrismaService. Deliberately does
 * NOT create any Contract/revenue record when a deal reaches WON —
 * T-REV-001 ("Deal Won is not revenue") means only an actual Contract/
 * BillingRequest may affect revenue-side KPIs; moving to WON only records
 * the pipeline event.
 */
@Injectable()
export class OpportunitiesService {
  constructor(private readonly prisma: XofficePrismaService) {}

  private get db() {
    return this.prisma.db;
  }

  private async event(tenantId: string, opportunityId: string, type: string, actorId: string, data: Record<string, unknown> = {}) {
    await this.db.opportunityEvent.create({ data: { tenantId, opportunityId, type, actorId, data: data as any } });
    await this.db.auditLog.create({
      data: { tenantId, instanceCode: opportunityId, actorId, action: `opportunity.${type}`, detail: JSON.stringify(data).slice(0, 500), at: new Date() },
    });
  }

  private async load(tenantId: string, id: string) {
    const o = await this.db.opportunity.findFirst({ where: { id, tenantId } });
    if (!o) throw new NotFoundException(`opportunity not found: ${id}`);
    return o;
  }

  async create(
    tenantId: string,
    actorId: string,
    body: {
      customerId: string;
      title: string;
      expectedAmount: string;
      currency?: string;
      probability?: number;
      expectedCloseDate?: string;
      ownerIdentityId?: string;
      idempotencyKey?: string;
    },
  ) {
    if (!body?.title?.trim()) throw new BadRequestException('title is required');
    if (!body?.customerId) throw new BadRequestException('customerId is required');
    if (!body?.expectedAmount) throw new BadRequestException('expectedAmount is required');
    const customer = await this.db.customer.findFirst({ where: { id: body.customerId, tenantId } });
    if (!customer) throw new NotFoundException(`customer not found: ${body.customerId}`);

    const idempotencyKey = body.idempotencyKey ? String(body.idempotencyKey) : undefined;
    if (idempotencyKey) {
      const existing = await this.db.opportunity.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } } });
      if (existing) return { ...existing, replayed: true };
    }

    let opp;
    try {
      opp = await this.db.opportunity.create({
        data: {
          tenantId,
          customerId: body.customerId,
          title: body.title.trim(),
          expectedAmount: body.expectedAmount,
          currency: body.currency ?? 'VND',
          probability: body.probability,
          expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : undefined,
          ownerIdentityId: body.ownerIdentityId,
          idempotencyKey: idempotencyKey ?? null,
          createdBy: actorId,
        },
      });
    } catch (e: any) {
      if (idempotencyKey && e?.code === 'P2002') {
        const existing = await this.db.opportunity.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } } });
        if (existing) return { ...existing, replayed: true };
      }
      throw e;
    }
    await this.event(tenantId, opp.id, 'created', actorId, { customerId: body.customerId, expectedAmount: body.expectedAmount });
    return { ...opp, replayed: false };
  }

  async transition(tenantId: string, actorId: string, id: string, toStage: string, opts: { lostReason?: string } = {}) {
    const stage = toStage.toUpperCase();
    if (!STAGES.includes(stage)) throw new BadRequestException(`stage must be one of ${STAGES.join(', ')}`);
    const opp = await this.load(tenantId, id);
    const allowed = ALLOWED_TRANSITIONS[opp.stage] ?? [];
    if (!allowed.includes(stage)) {
      throw new BadRequestException(`Cannot transition ${opp.stage} → ${stage} (allowed: ${allowed.join(', ') || 'none'})`);
    }
    if (stage === 'LOST' && !opts.lostReason?.trim()) {
      throw new BadRequestException('lostReason is required when marking an opportunity LOST');
    }
    const updated = await this.db.opportunity.update({
      where: { id },
      data: { stage, lostReason: stage === 'LOST' ? opts.lostReason!.trim() : opp.lostReason },
    });
    await this.event(tenantId, id, 'stage_changed', actorId, { from: opp.stage, to: stage, lostReason: opts.lostReason });
    return updated;
  }

  list(tenantId: string, filters: { stage?: string; customerId?: string } = {}) {
    return this.db.opportunity.findMany({
      where: { tenantId, ...(filters.stage ? { stage: filters.stage.toUpperCase() } : {}), ...(filters.customerId ? { customerId: filters.customerId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { id: true, code: true, name: true } } },
    });
  }

  async get(tenantId: string, id: string) {
    const opportunity = await this.load(tenantId, id);
    const [customer, proposals, contracts, events] = await Promise.all([
      this.db.customer.findUnique({ where: { id: opportunity.customerId } }),
      this.db.proposal.findMany({ where: { tenantId, opportunityId: id }, orderBy: { version: 'desc' } }),
      this.db.contract.findMany({ where: { tenantId, sourceOpportunityId: id } }),
      this.db.opportunityEvent.findMany({ where: { tenantId, opportunityId: id }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { opportunity, customer, proposals, contracts, events };
  }
}
