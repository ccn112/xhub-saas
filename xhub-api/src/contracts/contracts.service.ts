import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { XofficePrismaService } from '../xoffice-prisma/xoffice-prisma.service';

const STATUSES = ['DRAFT', 'REVIEW', 'NEGOTIATION', 'APPROVED', 'SIGNING', 'EFFECTIVE', 'SUSPENDED', 'EXPIRED', 'TERMINATED', 'COMPLETED'];
const DELIVERY_METHODS = ['PROJECT', 'SUBSCRIPTION', 'WORK_ORDER', 'DELIVERY_ONLY'];
const BILLING_METHODS = ['ADVANCE', 'MILESTONE', 'TIME_MATERIAL', 'RECURRING', 'FIXED_COMPLETION'];
// Contract FSM (BO-0206). Line mutation is only allowed while the contract
// is in one of these "pre-signing" states — T-CON-001 "immutable after
// signature" (edit rejected; amendment required beyond this point).
const PRE_SIGNING_STATUSES = ['DRAFT', 'REVIEW', 'NEGOTIATION', 'APPROVED'];
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['REVIEW'],
  REVIEW: ['NEGOTIATION', 'APPROVED'],
  NEGOTIATION: ['REVIEW', 'APPROVED'],
  APPROVED: ['SIGNING'],
  SIGNING: ['EFFECTIVE'],
  EFFECTIVE: ['SUSPENDED', 'TERMINATED', 'COMPLETED', 'EXPIRED'],
  SUSPENDED: ['EFFECTIVE', 'TERMINATED'],
  EXPIRED: [],
  TERMINATED: [],
  COMPLETED: [],
};

/**
 * ContractsService — Contract + ContractLine domain, e-signature seam,
 * obligation/alert engine, billing bridge (Phase 2, BO-0206/0207/0208).
 * Tenant-scoped (RLS). `sourceOpportunityId` is deliberately not unique —
 * T-CON-002 "one deal to multiple contracts/lines" must stay possible.
 */
@Injectable()
export class ContractsService {
  constructor(private readonly prisma: XofficePrismaService) {}

  private get db() {
    return this.prisma.db;
  }

  private async event(tenantId: string, contractId: string, type: string, actorId: string, data: Record<string, unknown> = {}) {
    await this.db.contractEvent.create({ data: { tenantId, contractId, type, actorId, data: data as any } });
    await this.db.auditLog.create({
      data: { tenantId, instanceCode: contractId, actorId, action: `contract.${type}`, detail: JSON.stringify(data).slice(0, 500), at: new Date() },
    });
  }

  private async load(tenantId: string, id: string) {
    const c = await this.db.contract.findFirst({ where: { id, tenantId } });
    if (!c) throw new NotFoundException(`contract not found: ${id}`);
    return c;
  }

  // ==== Contract ===============================================================
  async create(
    tenantId: string,
    actorId: string,
    body: { customerId: string; sourceOpportunityId?: string; contractNo?: string; effectiveFrom?: string },
  ) {
    if (!body?.customerId) throw new BadRequestException('customerId is required');
    const customer = await this.db.customer.findFirst({ where: { id: body.customerId, tenantId } });
    if (!customer) throw new NotFoundException(`customer not found: ${body.customerId}`);
    if (body.sourceOpportunityId) {
      const opp = await this.db.opportunity.findFirst({ where: { id: body.sourceOpportunityId, tenantId } });
      if (!opp) throw new NotFoundException(`opportunity not found: ${body.sourceOpportunityId}`);
    }
    const contractNo = body.contractNo?.trim() || `CTR-${Date.now().toString(36).toUpperCase()}`;
    const existing = await this.db.contract.findUnique({ where: { tenantId_contractNo: { tenantId, contractNo } } });
    if (existing) throw new BadRequestException(`Contract number already exists: ${contractNo}`);
    const contract = await this.db.contract.create({
      data: {
        tenantId,
        contractNo,
        customerId: body.customerId,
        sourceOpportunityId: body.sourceOpportunityId,
        effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : undefined,
        createdBy: actorId,
      },
    });
    await this.event(tenantId, contract.id, 'created', actorId, { contractNo });
    return contract;
  }

  private async recomputeTotal(tenantId: string, contractId: string) {
    const lines = await this.db.contractLine.findMany({ where: { tenantId, contractId } });
    const total = lines.reduce((sum, l) => sum + Number(l.lineValue), 0);
    await this.db.contract.update({ where: { id: contractId }, data: { totalAmount: String(total) } });
  }

  async addLine(
    tenantId: string,
    actorId: string,
    contractId: string,
    body: { catalogItemId: string; deliveryMethod: string; billingMethod: string; lineValue: string; acceptanceRequired?: boolean; projectTemplateCode?: string },
  ) {
    const contract = await this.load(tenantId, contractId);
    if (!PRE_SIGNING_STATUSES.includes(contract.status)) {
      throw new BadRequestException(`Contract is ${contract.status} — immutable after signature (T-CON-001). Create an amendment instead of editing lines.`);
    }
    const deliveryMethod = body.deliveryMethod?.toUpperCase();
    const billingMethod = body.billingMethod?.toUpperCase();
    if (!DELIVERY_METHODS.includes(deliveryMethod)) throw new BadRequestException(`deliveryMethod must be one of ${DELIVERY_METHODS.join(', ')}`);
    if (!BILLING_METHODS.includes(billingMethod)) throw new BadRequestException(`billingMethod must be one of ${BILLING_METHODS.join(', ')}`);
    const catalogItem = await this.db.commercialCatalogItem.findFirst({ where: { id: body.catalogItemId, tenantId } });
    if (!catalogItem) throw new NotFoundException(`catalog item not found: ${body.catalogItemId}`);
    if (!body.lineValue) throw new BadRequestException('lineValue is required');
    const line = await this.db.contractLine.create({
      data: {
        tenantId,
        contractId,
        catalogItemId: body.catalogItemId,
        deliveryMethod,
        billingMethod,
        lineValue: body.lineValue,
        acceptanceRequired: !!body.acceptanceRequired,
        projectTemplateCode: body.projectTemplateCode,
      },
    });
    await this.recomputeTotal(tenantId, contractId);
    await this.event(tenantId, contractId, 'line_added', actorId, { catalogItemId: body.catalogItemId, lineValue: body.lineValue });
    return line;
  }

  async transition(tenantId: string, actorId: string, id: string, toStatus: string) {
    const status = toStatus.toUpperCase();
    if (!STATUSES.includes(status)) throw new BadRequestException(`status must be one of ${STATUSES.join(', ')}`);
    const contract = await this.load(tenantId, id);
    const allowed = ALLOWED_TRANSITIONS[contract.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Cannot transition ${contract.status} → ${status} (allowed: ${allowed.join(', ') || 'none'})`);
    }
    if (status === 'EFFECTIVE') {
      const sigCount = await this.db.contractSignature.count({ where: { tenantId, contractId: id } });
      if (sigCount === 0) throw new BadRequestException('Cannot activate a contract with no recorded signature — call sign() first (BO-0207)');
    }
    const updated = await this.db.contract.update({ where: { id }, data: { status } });
    await this.event(tenantId, id, 'status_changed', actorId, { from: contract.status, to: status });

    // BO-0208: auto-generate obligations from MILESTONE lines when a contract goes live.
    if (status === 'EFFECTIVE') {
      const existing = await this.db.contractObligation.count({ where: { tenantId, contractId: id } });
      if (existing === 0) {
        const lines = await this.db.contractLine.findMany({ where: { tenantId, contractId: id, billingMethod: 'MILESTONE' } });
        for (const line of lines) {
          await this.db.contractObligation.create({
            data: {
              tenantId,
              contractId: id,
              contractLineId: line.id,
              type: 'MILESTONE_BILLING',
              title: `Milestone billing — ${line.id}`,
              dueDate: new Date((updated.effectiveFrom ?? new Date()).getTime() + 30 * 24 * 60 * 60 * 1000),
            },
          });
        }
      }
    }
    return updated;
  }

  // ==== e-signature seam (BO-0207, provider-neutral, MOCK only this pass) =====
  async sign(tenantId: string, actorId: string, contractId: string, body: { provider?: string; envelopeRef?: string; documentHash?: string; signerName?: string }) {
    const contract = await this.load(tenantId, contractId);
    if (!['APPROVED', 'SIGNING'].includes(contract.status)) {
      throw new BadRequestException(`Cannot sign a contract in status ${contract.status} (must be APPROVED or SIGNING)`);
    }
    const envelopeRef = body.envelopeRef?.trim() || `MOCK-ENV-${Date.now().toString(36).toUpperCase()}`;
    const signature = await this.db.contractSignature.create({
      data: {
        tenantId,
        contractId,
        provider: body.provider ?? 'MOCK',
        envelopeRef,
        documentHash: body.documentHash,
        signerName: body.signerName,
        createdBy: actorId,
      },
    });
    if (contract.status === 'APPROVED') {
      await this.db.contract.update({ where: { id: contractId }, data: { status: 'SIGNING' } });
      await this.event(tenantId, contractId, 'status_changed', actorId, { from: 'APPROVED', to: 'SIGNING' });
    }
    await this.event(tenantId, contractId, 'signed', actorId, { envelopeRef, provider: signature.provider });
    return signature;
  }

  // ==== obligations (BO-0208) ==================================================
  async completeObligation(tenantId: string, actorId: string, obligationId: string, body: { evidenceRef?: string }) {
    const ob = await this.db.contractObligation.findFirst({ where: { id: obligationId, tenantId } });
    if (!ob) throw new NotFoundException(`obligation not found: ${obligationId}`);
    if (!body.evidenceRef?.trim()) throw new BadRequestException('evidenceRef is required to complete an obligation');
    const updated = await this.db.contractObligation.update({
      where: { id: obligationId },
      data: { status: 'COMPLETED', evidenceRef: body.evidenceRef, completedAt: new Date() },
    });
    await this.event(tenantId, ob.contractId, 'obligation_completed', actorId, { obligationId, evidenceRef: body.evidenceRef });
    return updated;
  }

  async escalateObligation(tenantId: string, actorId: string, obligationId: string) {
    const ob = await this.db.contractObligation.findFirst({ where: { id: obligationId, tenantId } });
    if (!ob) throw new NotFoundException(`obligation not found: ${obligationId}`);
    const updated = await this.db.contractObligation.update({ where: { id: obligationId }, data: { escalatedAt: new Date() } });
    await this.event(tenantId, ob.contractId, 'obligation_escalated', actorId, { obligationId });
    return updated;
  }

  /** Compute display status (PENDING/DUE_SOON/OVERDUE) for an obligation row not already terminal. */
  private computeAlertStatus(ob: { status: string; dueDate: Date }): string {
    if (ob.status !== 'PENDING') return ob.status;
    const daysLeft = (ob.dueDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    if (daysLeft < 0) return 'OVERDUE';
    if (daysLeft <= 7) return 'DUE_SOON';
    return 'PENDING';
  }

  async listObligations(tenantId: string, contractId: string) {
    const rows = await this.db.contractObligation.findMany({ where: { tenantId, contractId }, orderBy: { dueDate: 'asc' } });
    return rows.map((o) => ({ ...o, alertStatus: this.computeAlertStatus(o) }));
  }

  // ==== billing bridge (KPI-BIL-001) ==========================================
  async generateBillingRequest(tenantId: string, actorId: string, obligationId: string, body: { idempotencyKey: string }) {
    if (!body?.idempotencyKey?.trim()) throw new BadRequestException('idempotencyKey is required (financial submission — must be replay-safe)');
    const ob = await this.db.contractObligation.findFirst({ where: { id: obligationId, tenantId } });
    if (!ob) throw new NotFoundException(`obligation not found: ${obligationId}`);
    const existing = await this.db.billingRequest.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: body.idempotencyKey } } });
    if (existing) return { ...existing, replayed: true };

    const contract = await this.load(tenantId, ob.contractId);
    const requestedAmount = ob.billingPercent
      ? String((Number(contract.totalAmount) * ob.billingPercent) / 100)
      : contract.totalAmount;
    const status = ob.evidenceRef ? 'READY' : 'BLOCKED';
    const blockers = ob.evidenceRef ? [] : ['missing evidence on obligation'];
    const br = await this.db.billingRequest.create({
      data: {
        tenantId,
        contractId: ob.contractId,
        contractLineId: ob.contractLineId,
        status,
        requestedAmount,
        currency: contract.currency,
        idempotencyKey: body.idempotencyKey,
        blockers,
        createdBy: actorId,
      },
    });
    await this.event(tenantId, ob.contractId, 'billing_request_generated', actorId, { billingRequestId: br.id, status });
    return { ...br, replayed: false };
  }

  listBillingRequests(tenantId: string, contractId?: string) {
    return this.db.billingRequest.findMany({ where: { tenantId, ...(contractId ? { contractId } : {}) }, orderBy: { createdAt: 'desc' } });
  }

  // ==== list / detail ==========================================================
  list(tenantId: string, filters: { status?: string; customerId?: string } = {}) {
    return this.db.contract.findMany({
      where: { tenantId, ...(filters.status ? { status: filters.status.toUpperCase() } : {}), ...(filters.customerId ? { customerId: filters.customerId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { id: true, code: true, name: true } } },
    });
  }

  async get(tenantId: string, id: string) {
    const contract = await this.load(tenantId, id);
    const [customer, lines, signatures, obligations, billingRequests, events] = await Promise.all([
      this.db.customer.findUnique({ where: { id: contract.customerId }, select: { id: true, code: true, name: true } }),
      this.db.contractLine.findMany({ where: { tenantId, contractId: id }, include: { catalogItem: true } }),
      this.db.contractSignature.findMany({ where: { tenantId, contractId: id } }),
      this.listObligations(tenantId, id),
      this.db.billingRequest.findMany({ where: { tenantId, contractId: id } }),
      this.db.contractEvent.findMany({ where: { tenantId, contractId: id }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { contract: { ...contract, customer }, lines, signatures, obligations, billingRequests, events };
  }
}
