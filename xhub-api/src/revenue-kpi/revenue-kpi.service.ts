import { Injectable } from '@nestjs/common';
import { XofficePrismaService } from '../xoffice-prisma/xoffice-prisma.service';

/**
 * RevenueKpiService — pipeline/contract KPI with provenance (Phase 2,
 * BO-0209). Every value carries `{formula, source}` per
 * data/KPI_CATALOG.csv from the source handoff — "no revenue mislabel;
 * formula/source visible" (T-REV-001/ACCEPTANCE_TEST_MATRIX). Opportunity
 * stage=WON never counts as revenue by itself — only Contract/BillingRequest
 * rows do. KPI-FIN-002/KPI-LEAK-001 need a real FinERP integration (not
 * present in this codebase) — reported as unavailable, not faked.
 */
@Injectable()
export class RevenueKpiService {
  constructor(private readonly prisma: XofficePrismaService) {}

  private get db() {
    return this.prisma.db;
  }

  async get(tenantId: string) {
    const [openOpps, effectiveLines, readyBilling] = await Promise.all([
      this.db.opportunity.findMany({ where: { tenantId, stage: { notIn: ['WON', 'LOST'] } }, select: { expectedAmount: true, probability: true, currency: true } }),
      this.db.contractLine.findMany({ where: { tenantId, contract: { status: 'EFFECTIVE' } }, select: { lineValue: true, currency: true } }),
      this.db.billingRequest.findMany({ where: { tenantId, status: 'READY' }, select: { requestedAmount: true, currency: true } }),
    ]);

    const pipelineValue = openOpps.reduce((sum, o) => sum + Number(o.expectedAmount), 0);
    const weightedPipeline = openOpps.reduce((sum, o) => sum + Number(o.expectedAmount) * (o.probability ?? 0), 0);
    const contractedValue = effectiveLines.reduce((sum, l) => sum + Number(l.lineValue), 0);
    const readyToBillValue = readyBilling.reduce((sum, b) => sum + Number(b.requestedAmount), 0);
    const currency = openOpps[0]?.currency ?? effectiveLines[0]?.currency ?? readyBilling[0]?.currency ?? 'VND';
    const asOf = new Date().toISOString();

    return {
      asOf,
      currency,
      kpis: [
        {
          code: 'KPI-SAL-001', name: 'Pipeline Value', value: pipelineValue,
          formula: 'sum(expectedAmount) WHERE stage NOT IN (WON, LOST)', source: 'X.Office Opportunity',
        },
        {
          code: 'KPI-SAL-002', name: 'Weighted Pipeline', value: weightedPipeline,
          formula: 'sum(expectedAmount * probability) WHERE stage NOT IN (WON, LOST)', source: 'X.Office Opportunity',
        },
        {
          code: 'KPI-CON-001', name: 'Contracted Value', value: contractedValue,
          formula: 'sum(ContractLine.lineValue) WHERE Contract.status = EFFECTIVE', source: 'X.Office Contract',
        },
        {
          code: 'KPI-BIL-001', name: 'Ready-to-Bill Value', value: readyToBillValue,
          formula: 'sum(BillingRequest.requestedAmount) WHERE status = READY', source: 'X.Office Billing Readiness',
        },
        {
          code: 'KPI-FIN-002', name: 'Recognized Revenue', value: null,
          formula: 'accounting recognition (FinERP)', source: 'FinERP', unavailable: true,
          note: 'Không khả dụng — cần tích hợp FinERP thật, chưa có trong hệ thống này.',
        },
        {
          code: 'KPI-LEAK-001', name: 'Accepted Not Invoiced', value: null,
          formula: 'accepted - invoiced', source: 'X.Office + FinERP', unavailable: true,
          note: 'Không khả dụng — cần tích hợp FinERP thật, chưa có trong hệ thống này.',
        },
      ],
    };
  }
}
