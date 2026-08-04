import { Injectable } from '@nestjs/common';
import { XofficePrismaService } from '../xoffice-prisma/xoffice-prisma.service';

/**
 * LeaveBalanceSnapshot — APPEND-ONLY ledger (PE_SCHEMA_PLAN). Never UPDATEd:
 * every change to a person+policy+period balance is a new row at the next
 * `sequence`. "Current balance" = the row with the highest sequence for that
 * key. `available = openingBalance + accrued + carriedOver - used - pending + adjusted`,
 * recomputed on every append (denormalized for cheap reads, source fields kept
 * for audit).
 */
@Injectable()
export class LeaveBalanceService {
  constructor(private readonly prisma: XofficePrismaService) {}
  private get db() {
    return this.prisma.db;
  }

  periodCodeFor(at: Date): string {
    return String(at.getFullYear());
  }

  async latest(tenantId: string, personId: string, leavePolicyId: string, periodCode: string) {
    const row = await this.db.leaveBalanceSnapshot.findFirst({
      where: { tenantId, personId, leavePolicyId, periodCode },
      orderBy: { sequence: 'desc' },
    });
    if (row) return row;
    // No snapshot yet for this key — initialize a transparent zero-state row
    // (INITIAL, everything 0) rather than blocking on a missing seed step.
    return this.db.leaveBalanceSnapshot.create({
      data: {
        tenantId,
        personId,
        leavePolicyId,
        periodCode,
        reason: 'INITIAL',
        sequence: 1,
        createdBy: 'system',
      },
    });
  }

  async current(tenantId: string, personId: string, leavePolicyId: string, periodCode: string) {
    return this.latest(tenantId, personId, leavePolicyId, periodCode);
  }

  /**
   * Append a new ledger row applying a delta to `pending` and/or `used`
   * (mutually exclusive per call site) plus `adjusted`. Returns the new row.
   */
  async append(
    tenantId: string,
    actorId: string,
    params: {
      personId: string;
      leavePolicyId: string;
      periodCode: string;
      reason: string;
      pendingDelta?: number;
      usedDelta?: number;
      adjustedDelta?: number;
      sourceLeaveRequestId?: string;
    },
  ) {
    const prev = await this.latest(tenantId, params.personId, params.leavePolicyId, params.periodCode);
    const pending = prev.pending + (params.pendingDelta ?? 0);
    const used = prev.used + (params.usedDelta ?? 0);
    const adjusted = prev.adjusted + (params.adjustedDelta ?? 0);
    const available = prev.openingBalance + prev.accrued + prev.carriedOver - used - pending + adjusted;
    return this.db.leaveBalanceSnapshot.create({
      data: {
        tenantId,
        personId: params.personId,
        leavePolicyId: params.leavePolicyId,
        periodCode: params.periodCode,
        openingBalance: prev.openingBalance,
        accrued: prev.accrued,
        used,
        pending,
        adjusted,
        carriedOver: prev.carriedOver,
        available,
        unit: prev.unit,
        sequence: prev.sequence + 1,
        reason: params.reason,
        sourceLeaveRequestId: params.sourceLeaveRequestId ?? null,
        createdBy: actorId,
      },
    });
  }

  async meBalances(tenantId: string, personId: string, periodCode: string) {
    const policies = await this.db.leavePolicyRef.findMany({ where: { tenantId, status: 'ACTIVE' } });
    const balances = await Promise.all(
      policies.map(async (p: any) => ({
        policy: p,
        balance: await this.current(tenantId, personId, p.id, periodCode),
      })),
    );
    return { items: balances, periodCode };
  }
}
