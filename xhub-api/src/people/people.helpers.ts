import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { IdentityService } from '../identity/identity.service';

/**
 * Resolve the acting person for a session userId (userId !== personId — a
 * known trap in this codebase, see DEV_BACKLOG "Ticket module" known issue).
 * Throws instead of silently falling back so a missing PersonProfile is never
 * mistaken for "no scope" (which would fail open on ABAC checks elsewhere).
 */
export async function resolveActingPerson(identity: IdentityService, userId: string) {
  const person = await identity.personForUserId(userId);
  if (!person) throw new BadRequestException(`no PersonProfile mapped for userId ${userId}`);
  return person;
}

/**
 * Server-computed leave duration in `unit` (DAY|HOUR — only DAY implemented;
 * HOUR-unit policies pass startAt/endAt straight through as hours). A client-
 * sent durationValue is ALWAYS ignored (PE_SCHEMA_PLAN §LeaveRequest).
 * DAY unit: inclusive calendar day count, minus 0.5 for each AM/PM half-day
 * bound (FULL/FULL = whole days; AM start or PM end shaves a half day).
 */
export function computeLeaveDuration(
  startAt: Date,
  endAt: Date,
  startDayPart: string,
  endDayPart: string,
  unit: string,
): number {
  if (endAt < startAt) throw new BadRequestException('endAt must not be before startAt');
  if (unit === 'HOUR') {
    return Math.max(0, (endAt.getTime() - startAt.getTime()) / 3_600_000);
  }
  const oneDay = 24 * 60 * 60 * 1000;
  const days = Math.round((endAt.getTime() - startAt.getTime()) / oneDay) + 1;
  let duration = days;
  if (startDayPart !== 'FULL') duration -= 0.5;
  if (endDayPart !== 'FULL' && endAt.getTime() !== startAt.getTime()) duration -= 0.5;
  if (endDayPart !== 'FULL' && endAt.getTime() === startAt.getTime() && startDayPart === 'FULL') duration -= 0.5;
  return Math.max(0.5, duration);
}

/**
 * Resolve who should receive the ApprovalTask for a person's leave/overtime
 * request: the holder of the Position their Position.reportsToPositionId
 * points at (PE-01 design decision — direct manager). Falls back to an
 * unassigned ROLE_HR queue (assigneeUserId=null) when the requester holds no
 * Position, has no manager Position, or the manager seat is vacant — the task
 * still surfaces (as a role queue) instead of being silently dropped.
 */
export async function resolveApprovalAssignee(
  prisma: PrismaService,
  tenantId: string,
  personId: string,
  identity: IdentityService,
): Promise<{ assigneeRole: string; assigneeUserId: string | null }> {
  const position = await prisma.db.position.findFirst({ where: { tenantId, holderPersonId: personId } });
  if (!position?.reportsToPositionId) {
    return { assigneeRole: 'ROLE_HR', assigneeUserId: null };
  }
  const managerPosition = await prisma.db.position.findFirst({
    where: { tenantId, id: position.reportsToPositionId },
  });
  if (!managerPosition?.holderPersonId) {
    return { assigneeRole: 'ROLE_HR', assigneeUserId: null };
  }
  const managerUserId = await identity.userIdForPerson(managerPosition.holderPersonId);
  return { assigneeRole: 'ROLE_DIRECT_MANAGER', assigneeUserId: managerUserId ?? null };
}

/**
 * Spawn a lightweight WorkflowInstance + ApprovalTask pair for a People
 * request (leave/overtime submit) — reuses the SAME two tables the generic
 * BPMN engine writes (xoffice.service.ts) so the task surfaces in /approvals
 * and /inbox, WITHOUT running the full node/edge engine (PE_SOR_MATRIX_DELTA
 * §"Option B"). Caller must run this inside the same request transaction
 * (this.db already is, via TenantScopeInterceptor) so it commits atomically
 * with the LeaveRequest/OvertimeRequest status change.
 */
export async function spawnApprovalTask(
  prisma: PrismaService,
  tenantId: string,
  workflowCode: string,
  title: string,
  requesterEmail: string,
  assigneeRole: string,
  assigneeUserId: string | null,
): Promise<{ workflowInstanceId: string; approvalTaskId: string }> {
  const instanceCode = `${workflowCode}-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')}`;
  const instance = await prisma.db.workflowInstance.create({
    data: {
      tenantId,
      workflowCode,
      instanceCode,
      title,
      requesterEmail,
      variables: {},
      status: 'running',
      currentNodeId: 'approval',
    },
  });
  const task = await prisma.db.approvalTask.create({
    data: {
      tenantId,
      instanceId: instance.id,
      nodeId: 'approval',
      nodeName: 'Duyệt',
      assigneeRole,
      assigneeUserId,
      status: 'open',
    },
  });
  return { workflowInstanceId: instance.id, approvalTaskId: task.id };
}
