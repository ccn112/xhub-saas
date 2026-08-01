import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { PeopleConfigService } from './config.service';
import { LeaveBalanceService } from './leave-balance.service';
import { LeaveImpactService } from './leave-impact.service';
import { LEAVE_TRANSITIONS } from './people.constants';
import { computeLeaveDuration, resolveActingPerson, resolveApprovalAssignee, spawnApprovalTask } from './people.helpers';

/**
 * LeaveRequest — the SoR object under SME Lite (PeopleTenantConfig.leaveMode
 * = XOFFICE). FSM enforced here (LEAVE_TRANSITIONS); overlap + balance +
 * SOR_NOT_XOFFICE guarded on write. Submitting spawns a WorkflowInstance +
 * ApprovalTask + OutboxEvent in the SAME request transaction as the status
 * change (TenantScopeInterceptor already opened one for the whole handler —
 * see prisma.service.ts `db` getter), so it is never a partial write.
 */
@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService,
    private readonly config: PeopleConfigService,
    private readonly balances: LeaveBalanceService,
    private readonly impact: LeaveImpactService,
  ) {}
  private get db() {
    return this.prisma.db;
  }

  private async audit(tenantId: string, actorId: string, action: string, code: string, data: Record<string, unknown> = {}) {
    await this.db.auditLog.create({
      data: { tenantId, actorId, instanceCode: code, action: `people.leave.${action}`, detail: JSON.stringify(data).slice(0, 500), at: new Date() },
    });
  }

  async listMine(tenantId: string, userId: string, filter: { status?: string } = {}) {
    const person = await resolveActingPerson(this.identity, userId);
    const items = await this.db.leaveRequest.findMany({
      where: { tenantId, personId: person.id, ...(filter.status ? { status: filter.status } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    return { items, count: items.length };
  }

  /** Team view — scoped to the caller's DataScope.orgUnits (ABAC), reused not reinvented. */
  async listTeam(tenantId: string, userId: string, filter: { orgUnitId?: string; from?: string; to?: string; status?: string } = {}) {
    const eff = await this.identity.effectivePermissions(userId);
    const scopedOrgUnits = [...new Set(eff.scopes.flatMap((s: any) => s?.orgUnits ?? []))];
    if (filter.orgUnitId && scopedOrgUnits.length && !scopedOrgUnits.includes(filter.orgUnitId)) {
      throw new ForbiddenException({ code: 'OUT_OF_SCOPE', message: 'orgUnitId is outside caller scope' });
    }
    const orgUnitIds = filter.orgUnitId ? [filter.orgUnitId] : scopedOrgUnits;
    const positions = orgUnitIds.length
      ? await this.db.position.findMany({ where: { tenantId, orgUnitId: { in: orgUnitIds } } })
      : [];
    const personIds = positions.map((p: any) => p.holderPersonId).filter((id: any): id is string => !!id);
    const items = await this.db.leaveRequest.findMany({
      where: {
        tenantId,
        ...(orgUnitIds.length ? { personId: { in: personIds.length ? personIds : ['__none__'] } } : {}),
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.from ? { endAt: { gte: new Date(filter.from) } } : {}),
        ...(filter.to ? { startAt: { lte: new Date(filter.to) } } : {}),
      },
      orderBy: { startAt: 'asc' },
    });
    return { items, count: items.length, scopedOrgUnits: orgUnitIds };
  }

  /** Bare fetch — no ownership/scope check. Only for use by the two guarded wrappers below. */
  private async getRaw(tenantId: string, id: string) {
    const row = await this.db.leaveRequest.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException(`leave request not found: ${id}`);
    return row;
  }

  /** 404 (not 403) on mismatch — never confirms another person's request even exists. */
  private async assertOwnership(userId: string, row: { id: string; personId: string }) {
    const person = await resolveActingPerson(this.identity, userId);
    if (row.personId !== person.id) throw new NotFoundException(`leave request not found: ${row.id}`);
  }

  /** Manager-side actions are scoped to the caller's DataScope.orgUnits — same ABAC as listTeam. */
  private async assertApproverScope(userId: string, orgUnitId: string | null) {
    const eff = await this.identity.effectivePermissions(userId);
    const scopedOrgUnits = [...new Set(eff.scopes.flatMap((s: any) => s?.orgUnits ?? []))];
    if (scopedOrgUnits.length && (!orgUnitId || !scopedOrgUnits.includes(orgUnitId))) {
      throw new ForbiddenException({ code: 'OUT_OF_SCOPE', message: 'this request is outside your data scope' });
    }
  }

  /** Self-service fetch — 404s if the request belongs to someone else. */
  async get(tenantId: string, userId: string, id: string) {
    const row = await this.getRaw(tenantId, id);
    await this.assertOwnership(userId, row);
    return row;
  }

  async impactPreview(tenantId: string, userId: string, body: any) {
    const person = await resolveActingPerson(this.identity, userId);
    const startAt = new Date(body?.startAt);
    const endAt = new Date(body?.endAt);
    if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) throw new BadRequestException('startAt/endAt required (ISO date)');
    return this.impact.preview(tenantId, person.id, startAt, endAt);
  }

  /**
   * Create + submit in one call (no persisted DRAFT step in this vertical
   * slice — FE always calls impact-preview first, then this). Idempotent via
   * (tenantId, idempotencyKey): the row is created FIRST (before spawning any
   * approval side-effects) so a racing duplicate request fails fast on the
   * unique constraint with nothing else written yet — never a raw 500, and
   * never an orphaned WorkflowInstance/ApprovalTask with no owning row.
   */
  async create(tenantId: string, userId: string, body: any) {
    const idempotencyKey = body?.idempotencyKey;
    if (!idempotencyKey || String(idempotencyKey).length < 8) {
      throw new BadRequestException({ code: 'MISSING_IDEMPOTENCY_KEY', message: 'idempotencyKey (>=8 chars) is required' });
    }
    const existing = await this.db.leaveRequest.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } } });
    if (existing) return { ...existing, replayed: true };

    const cfg = await this.config.get(tenantId, userId);
    if (cfg.leaveMode !== 'XOFFICE') {
      throw new ConflictException({ code: 'SOR_NOT_XOFFICE', message: `leaveMode=${cfg.leaveMode}: X.Office is not the System of Record for leave writes` });
    }

    const person = await resolveActingPerson(this.identity, userId);
    const policy = await this.db.leavePolicyRef.findFirst({ where: { tenantId, id: body?.leavePolicyId } });
    if (!policy) throw new NotFoundException(`leave policy not found: ${body?.leavePolicyId}`);
    if (policy.status !== 'ACTIVE') throw new BadRequestException(`leave policy ${policy.code} is RETIRED`);

    const startAt = new Date(body?.startAt);
    const endAt = new Date(body?.endAt);
    if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) throw new BadRequestException('startAt/endAt required (ISO date)');
    const startDayPart = body?.startDayPart ?? 'FULL';
    const endDayPart = body?.endDayPart ?? 'FULL';

    const overlap = await this.db.leaveRequest.findFirst({
      where: {
        tenantId,
        personId: person.id,
        status: { notIn: ['REJECTED', 'CANCELLED'] },
        startAt: { lte: endAt },
        endAt: { gte: startAt },
      },
    });
    if (overlap) throw new ConflictException({ code: 'LEAVE_OVERLAP', message: `overlaps existing request ${overlap.id}` });

    const durationValue = computeLeaveDuration(startAt, endAt, startDayPart, endDayPart, policy.unit);
    const periodCode = this.balances.periodCodeFor(startAt);
    if (policy.code !== 'UNPAID') {
      const bal = await this.balances.current(tenantId, person.id, policy.id, periodCode);
      if (!policy.allowNegative && bal.available < durationValue) {
        throw new ConflictException({ code: 'INSUFFICIENT_BALANCE', message: `available=${bal.available} < requested=${durationValue}` });
      }
    }

    const position = await this.db.position.findFirst({ where: { tenantId, holderPersonId: person.id } });

    // Claim the idempotency key FIRST — nothing else is written until this succeeds.
    let leave;
    try {
      leave = await this.db.leaveRequest.create({
        data: {
          tenantId,
          personId: person.id,
          orgUnitId: position?.orgUnitId ?? null,
          positionId: position?.id ?? null,
          leaveTypeCode: policy.code,
          leavePolicyId: policy.id,
          startAt,
          endAt,
          startDayPart,
          endDayPart,
          durationValue,
          durationUnit: policy.unit,
          reason: body?.reason ?? null,
          replacementPersonId: body?.replacementPersonId ?? null,
          attachmentRecordIds: body?.attachmentRecordIds ?? [],
          status: 'SUBMITTED',
          submittedAt: new Date(),
          idempotencyKey,
          createdBy: userId,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const replay = await this.db.leaveRequest.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } } });
        if (replay) return { ...replay, replayed: true };
      }
      throw e;
    }

    const assignee = await resolveApprovalAssignee(this.prisma, tenantId, person.id, this.identity);
    const { workflowInstanceId, approvalTaskId } = await spawnApprovalTask(
      this.prisma,
      tenantId,
      'PEOPLE_LEAVE_APPROVAL',
      `Nghỉ phép — ${person.fullName} (${policy.name})`,
      person.email ?? `${userId}@local`,
      assignee.assigneeRole,
      assignee.assigneeUserId,
    );
    leave = await this.db.leaveRequest.update({ where: { id: leave.id }, data: { workflowInstanceId, approvalTaskId } });

    await this.balances.append(tenantId, userId, {
      personId: person.id,
      leavePolicyId: policy.id,
      periodCode,
      reason: 'LEAVE_SUBMITTED',
      pendingDelta: durationValue,
      sourceLeaveRequestId: leave.id,
    });
    await this.impact.capture(tenantId, userId, leave.id, person.id, startAt, endAt, 'ON_SUBMIT');
    await this.db.outboxEvent.create({
      data: {
        tenantId,
        aggregateType: 'LeaveRequest',
        aggregateId: leave.id,
        eventType: 'xoffice.people.leave.request.submitted',
        payload: { leaveRequestId: leave.id, personId: person.id, leavePolicyId: policy.id, durationValue, startAt, endAt } as any,
        nextAttemptAt: new Date(),
      },
    });
    await this.audit(tenantId, userId, 'submit', leave.id, { personId: person.id, durationValue });
    return leave;
  }

  private assertTransition(from: string, to: string) {
    const allowed = LEAVE_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new ConflictException({ code: 'INVALID_TRANSITION', message: `cannot go ${from} → ${to}` });
    }
  }

  private async closeApprovalTask(tenantId: string, leave: any, actorId: string, outcome: 'approved' | 'rejected') {
    if (!leave.approvalTaskId) return;
    await this.db.approvalTask.update({
      where: { id: leave.approvalTaskId },
      data: { status: outcome === 'approved' ? 'approved' : 'rejected', actedAt: new Date(), actorId },
    });
  }

  async approve(tenantId: string, userId: string, id: string, body: any) {
    const leave = await this.getRaw(tenantId, id);
    await this.assertApproverScope(userId, leave.orgUnitId);
    this.assertTransition(leave.status, 'APPROVED');
    const updated = await this.db.leaveRequest.update({
      where: { id },
      data: { status: 'APPROVED', decidedAt: new Date(), decidedBy: userId, decisionNote: body?.note ?? null },
    });
    const periodCode = this.balances.periodCodeFor(leave.startAt);
    await this.balances.append(tenantId, userId, {
      personId: leave.personId,
      leavePolicyId: leave.leavePolicyId,
      periodCode,
      reason: 'LEAVE_APPROVED',
      pendingDelta: -leave.durationValue,
      usedDelta: leave.durationValue,
      sourceLeaveRequestId: leave.id,
    });
    await this.impact.capture(tenantId, userId, leave.id, leave.personId, leave.startAt, leave.endAt, 'ON_APPROVE');
    await this.closeApprovalTask(tenantId, leave, userId, 'approved');
    await this.db.outboxEvent.create({
      data: {
        tenantId,
        aggregateType: 'LeaveRequest',
        aggregateId: leave.id,
        eventType: 'xoffice.people.availability.changed',
        payload: { personId: leave.personId, leaveRequestId: leave.id, capacityDeltaHours: leave.durationValue * 8 } as any,
        nextAttemptAt: new Date(),
      },
    });
    await this.audit(tenantId, userId, 'approve', id);
    return updated;
  }

  async reject(tenantId: string, userId: string, id: string, body: any) {
    const leave = await this.getRaw(tenantId, id);
    await this.assertApproverScope(userId, leave.orgUnitId);
    this.assertTransition(leave.status, 'REJECTED');
    const updated = await this.db.leaveRequest.update({
      where: { id },
      data: { status: 'REJECTED', decidedAt: new Date(), decidedBy: userId, decisionNote: body?.note ?? null },
    });
    const periodCode = this.balances.periodCodeFor(leave.startAt);
    await this.balances.append(tenantId, userId, {
      personId: leave.personId,
      leavePolicyId: leave.leavePolicyId,
      periodCode,
      reason: 'LEAVE_REJECTED',
      pendingDelta: -leave.durationValue,
      sourceLeaveRequestId: leave.id,
    });
    await this.closeApprovalTask(tenantId, leave, userId, 'rejected');
    await this.audit(tenantId, userId, 'reject', id);
    return updated;
  }

  async requestChanges(tenantId: string, userId: string, id: string, body: any) {
    const leave = await this.getRaw(tenantId, id);
    await this.assertApproverScope(userId, leave.orgUnitId);
    this.assertTransition(leave.status, 'CHANGES_REQUESTED');
    const updated = await this.db.leaveRequest.update({
      where: { id },
      data: { status: 'CHANGES_REQUESTED', decisionNote: body?.note ?? null },
    });
    await this.audit(tenantId, userId, 'request-changes', id);
    return updated;
  }

  async resubmit(tenantId: string, userId: string, id: string, body: any) {
    const leave = await this.getRaw(tenantId, id);
    await this.assertOwnership(userId, leave);
    this.assertTransition(leave.status, 'SUBMITTED');
    const updated = await this.db.leaveRequest.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        reason: body?.reason ?? leave.reason,
      },
    });
    await this.audit(tenantId, userId, 'resubmit', id);
    return updated;
  }

  async cancel(tenantId: string, userId: string, id: string, body: any) {
    const leave = await this.getRaw(tenantId, id);
    await this.assertOwnership(userId, leave);
    // Only these states self-cancel; CANCEL_REQUESTED/REJECTED/CANCELLED must
    // NOT re-enter this method (a second call on CANCEL_REQUESTED would
    // otherwise fall through to the "else → CANCELLED" branch below and skip
    // the used-balance refund that only cancelApprove performs correctly).
    if (!['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED'].includes(leave.status)) {
      throw new ConflictException({ code: 'INVALID_TRANSITION', message: `cannot self-cancel from ${leave.status} (already cancel-requested or terminal)` });
    }
    const to = leave.status === 'APPROVED' ? 'CANCEL_REQUESTED' : 'CANCELLED';
    this.assertTransition(leave.status, to);
    const updated = await this.db.leaveRequest.update({
      where: { id },
      data: to === 'CANCELLED'
        ? { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: body?.reason ?? null }
        : { status: 'CANCEL_REQUESTED', cancelReason: body?.reason ?? null },
    });
    if (to === 'CANCELLED') {
      const periodCode = this.balances.periodCodeFor(leave.startAt);
      await this.balances.append(tenantId, userId, {
        personId: leave.personId,
        leavePolicyId: leave.leavePolicyId,
        periodCode,
        reason: 'LEAVE_CANCELLED',
        pendingDelta: -leave.durationValue,
        sourceLeaveRequestId: leave.id,
      });
      await this.impact.capture(tenantId, userId, leave.id, leave.personId, leave.startAt, leave.endAt, 'ON_CANCEL');
    }
    await this.audit(tenantId, userId, 'cancel', id, { to });
    return updated;
  }

  /** HR/manager approves the CANCEL_REQUESTED — finalizes the refund. */
  async cancelApprove(tenantId: string, userId: string, id: string, body: any) {
    const leave = await this.getRaw(tenantId, id);
    await this.assertApproverScope(userId, leave.orgUnitId);
    this.assertTransition(leave.status, 'CANCELLED');
    const updated = await this.db.leaveRequest.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    const periodCode = this.balances.periodCodeFor(leave.startAt);
    await this.balances.append(tenantId, userId, {
      personId: leave.personId,
      leavePolicyId: leave.leavePolicyId,
      periodCode,
      reason: 'LEAVE_CANCELLED',
      usedDelta: -leave.durationValue,
      sourceLeaveRequestId: leave.id,
    });
    await this.impact.capture(tenantId, userId, leave.id, leave.personId, leave.startAt, leave.endAt, 'ON_CANCEL');
    await this.audit(tenantId, userId, 'cancel-approve', id);
    return updated;
  }
}
