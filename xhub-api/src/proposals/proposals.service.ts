import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { XofficePrismaService } from '../xoffice-prisma/xoffice-prisma.service';

const STATUSES = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'];

// Proposal FSM (BO-0204).
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['IN_REVIEW'],
  IN_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['SENT'],
  SENT: ['ACCEPTED', 'REJECTED', 'EXPIRED'],
  ACCEPTED: [],
  REJECTED: [],
  EXPIRED: [],
};

// BO-0205: any line discount above this threshold forces requiresApproval —
// "threshold rules deny/approve with audit". Kept as a simple constant, not
// a configurable rule engine, per this pass's scope.
const DISCOUNT_APPROVAL_THRESHOLD_PERCENT = 15;

/**
 * ProposalsService — versioned proposal/quotation + lines (Phase 2,
 * BO-0204/BO-0205). Tenant-scoped (RLS). Each `create()` call inserts a NEW
 * Proposal row for the Opportunity (version = max existing + 1) — proposal
 * history is never overwritten, matching TestResult/EngineeringDocument's
 * append/version conventions elsewhere in this codebase.
 */
@Injectable()
export class ProposalsService {
  constructor(private readonly prisma: XofficePrismaService) {}

  private get db() {
    return this.prisma.db;
  }

  private async event(tenantId: string, proposalId: string, type: string, actorId: string, data: Record<string, unknown> = {}) {
    await this.db.proposalEvent.create({ data: { tenantId, proposalId, type, actorId, data: data as any } });
    await this.db.auditLog.create({
      data: { tenantId, instanceCode: proposalId, actorId, action: `proposal.${type}`, detail: JSON.stringify(data).slice(0, 500), at: new Date() },
    });
  }

  private async load(tenantId: string, id: string) {
    const p = await this.db.proposal.findFirst({ where: { id, tenantId } });
    if (!p) throw new NotFoundException(`proposal not found: ${id}`);
    return p;
  }

  async create(tenantId: string, actorId: string, body: { opportunityId: string; validUntil?: string }) {
    const opp = await this.db.opportunity.findFirst({ where: { id: body.opportunityId, tenantId } });
    if (!opp) throw new NotFoundException(`opportunity not found: ${body.opportunityId}`);
    const last = await this.db.proposal.findFirst({ where: { tenantId, opportunityId: body.opportunityId }, orderBy: { version: 'desc' } });
    const version = (last?.version ?? 0) + 1;
    const proposal = await this.db.proposal.create({
      data: {
        tenantId,
        opportunityId: body.opportunityId,
        version,
        currency: opp.currency,
        validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
        createdBy: actorId,
      },
    });
    await this.event(tenantId, proposal.id, 'created', actorId, { version });
    return proposal;
  }

  /** Recompute totalAmount from lines and the BO-0205 requiresApproval flag. */
  private async recompute(tenantId: string, proposalId: string) {
    const lines = await this.db.proposalLine.findMany({ where: { tenantId, proposalId } });
    const total = lines.reduce((sum, l) => sum + Number(l.lineTotal), 0);
    const requiresApproval = lines.some((l) => l.discountPercent > DISCOUNT_APPROVAL_THRESHOLD_PERCENT);
    await this.db.proposal.update({ where: { id: proposalId }, data: { totalAmount: String(total), requiresApproval } });
  }

  async addLine(
    tenantId: string,
    actorId: string,
    proposalId: string,
    body: { catalogItemId: string; description?: string; quantity?: number; unitPrice: string; discountPercent?: number },
  ) {
    const proposal = await this.load(tenantId, proposalId);
    if (proposal.status !== 'DRAFT') throw new BadRequestException(`Cannot add lines to a proposal in status ${proposal.status} (must be DRAFT)`);
    const catalogItem = await this.db.commercialCatalogItem.findFirst({ where: { id: body.catalogItemId, tenantId } });
    if (!catalogItem) throw new NotFoundException(`catalog item not found: ${body.catalogItemId}`);
    if (!body.unitPrice) throw new BadRequestException('unitPrice is required');
    const quantity = body.quantity ?? 1;
    const discountPercent = body.discountPercent ?? 0;
    if (discountPercent < 0 || discountPercent > 100) throw new BadRequestException('discountPercent must be between 0 and 100');
    const lineTotal = Number(body.unitPrice) * quantity * (1 - discountPercent / 100);
    const line = await this.db.proposalLine.create({
      data: {
        tenantId,
        proposalId,
        catalogItemId: body.catalogItemId,
        description: body.description,
        quantity,
        unitPrice: body.unitPrice,
        discountPercent,
        lineTotal: String(lineTotal),
      },
    });
    await this.recompute(tenantId, proposalId);
    await this.event(tenantId, proposalId, 'line_added', actorId, { catalogItemId: body.catalogItemId, lineTotal });
    return line;
  }

  async transition(tenantId: string, actorId: string, id: string, toStatus: string, opts: { approverNote?: string } = {}) {
    const status = toStatus.toUpperCase();
    if (!STATUSES.includes(status)) throw new BadRequestException(`status must be one of ${STATUSES.join(', ')}`);
    const proposal = await this.load(tenantId, id);
    const allowed = ALLOWED_TRANSITIONS[proposal.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Cannot transition ${proposal.status} → ${status} (allowed: ${allowed.join(', ') || 'none'})`);
    }
    // BO-0205: a proposal flagged requiresApproval must carry an audited approverNote to reach APPROVED.
    if (status === 'APPROVED' && proposal.requiresApproval && !opts.approverNote?.trim()) {
      throw new BadRequestException('approverNote is required to approve a proposal above the discount threshold');
    }
    const updated = await this.db.proposal.update({ where: { id }, data: { status } });
    await this.event(tenantId, id, 'status_changed', actorId, { from: proposal.status, to: status, approverNote: opts.approverNote });
    return updated;
  }

  list(tenantId: string, filters: { opportunityId?: string; status?: string } = {}) {
    return this.db.proposal.findMany({
      where: { tenantId, ...(filters.opportunityId ? { opportunityId: filters.opportunityId } : {}), ...(filters.status ? { status: filters.status.toUpperCase() } : {}) },
      orderBy: [{ opportunityId: 'asc' }, { version: 'desc' }],
    });
  }

  async get(tenantId: string, id: string) {
    const proposal = await this.load(tenantId, id);
    const [lines, events] = await Promise.all([
      this.db.proposalLine.findMany({ where: { tenantId, proposalId: id }, include: { catalogItem: true } }),
      this.db.proposalEvent.findMany({ where: { tenantId, proposalId: id }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { proposal, lines, events };
  }
}
