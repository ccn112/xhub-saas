import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/xoffice-client';
import { XofficePrismaService } from '../xoffice-prisma/xoffice-prisma.service';
import { IdentityService } from '../identity/identity.service';
import { XofficeService } from '../xoffice/xoffice.service';
import { CORRECTION_TRANSITIONS } from './people.constants';
import { resolveActingPerson, resolveApprovalAssignee } from './people.helpers';

function dateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * AttendanceCorrectionRequest — employee dispute over a computed
 * AttendanceDay. Approval reuses WorkflowInstance+ApprovalTask (same helper
 * as PE-01 leave) — surfaces in /approvals + /inbox, no second queue. On
 * approve, overwrites the AttendanceDay row directly and freezes it
 * (correctionApplied=true) so a later recompute (e.g. a new import touching
 * the same day) does not silently undo the human decision.
 */
@Injectable()
export class AttendanceCorrectionService {
  constructor(
    private readonly prisma: XofficePrismaService,
    private readonly identity: IdentityService,
    private readonly xoffice: XofficeService,
  ) {}
  private get db() {
    return this.prisma.db;
  }

  private async audit(tenantId: string, actorId: string, action: string, id: string) {
    await this.db.auditLog.create({
      data: { tenantId, actorId, instanceCode: id, action: `people.attendance-correction.${action}`, detail: '', at: new Date() },
    });
  }

  /** Manager-side actions are scoped to the caller's DataScope.orgUnits — the
   * request has no stored orgUnitId, so resolve it live via the requester's
   * CURRENT Position (same resolution AvailabilityService/LeaveImpactService use). */
  private async assertApproverScope(userId: string, personId: string) {
    const eff = await this.identity.effectivePermissions(userId);
    const scopedOrgUnits = [...new Set(eff.scopes.flatMap((s: any) => s?.orgUnits ?? []))];
    if (!scopedOrgUnits.length) return;
    const position = await this.db.position.findFirst({ where: { holderPersonId: personId } });
    if (!position?.orgUnitId || !scopedOrgUnits.includes(position.orgUnitId)) {
      throw new ForbiddenException({ code: 'OUT_OF_SCOPE', message: 'this request is outside your data scope' });
    }
  }

  async listMine(tenantId: string, userId: string) {
    const person = await resolveActingPerson(this.identity, userId);
    const items = await this.db.attendanceCorrectionRequest.findMany({ where: { tenantId, personId: person.id }, orderBy: { createdAt: 'desc' } });
    return { items, count: items.length };
  }

  /**
   * Idempotency: the row is created FIRST (before spawning any approval
   * side-effects) so a racing duplicate request fails fast on the unique
   * constraint with nothing else written yet — see LeaveService.create for
   * the same pattern and rationale.
   */
  async create(tenantId: string, userId: string, body: any) {
    const idempotencyKey = body?.idempotencyKey;
    if (!idempotencyKey || String(idempotencyKey).length < 8) {
      throw new BadRequestException({ code: 'MISSING_IDEMPOTENCY_KEY', message: 'idempotencyKey (>=8 chars) is required' });
    }
    const existing = await this.db.attendanceCorrectionRequest.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } } });
    if (existing) return { ...existing, replayed: true };

    if (!body?.workDate) throw new BadRequestException('workDate is required');
    if (!body?.reason) throw new BadRequestException('reason is required');
    const person = await resolveActingPerson(this.identity, userId);

    let req;
    try {
      req = await this.db.attendanceCorrectionRequest.create({
        data: {
          tenantId,
          personId: person.id,
          workDate: dateOnly(new Date(body.workDate)),
          reason: body.reason,
          requestedStatus: body.requestedStatus ?? null,
          requestedFirstIn: body.requestedFirstIn ? new Date(body.requestedFirstIn) : null,
          requestedLastOut: body.requestedLastOut ? new Date(body.requestedLastOut) : null,
          idempotencyKey,
          createdBy: userId,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const replay = await this.db.attendanceCorrectionRequest.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } } });
        if (replay) return { ...replay, replayed: true };
      }
      throw e;
    }

    const assignee = await resolveApprovalAssignee(this.prisma, tenantId, person.id, this.identity);
    const { workflowInstanceId, approvalTaskId } = await this.xoffice.spawnLightweightApprovalTask(
      tenantId,
      'PEOPLE_ATTENDANCE_CORRECTION',
      `Báo sai chấm công — ${person.fullName} (${body.workDate})`,
      person.email ?? `${userId}@local`,
      assignee.assigneeRole,
      assignee.assigneeUserId,
    );
    req = await this.db.attendanceCorrectionRequest.update({ where: { id: req.id }, data: { workflowInstanceId, approvalTaskId } });
    await this.audit(tenantId, userId, 'submit', req.id);
    return req;
  }

  private assertTransition(from: string, to: string) {
    if (!(CORRECTION_TRANSITIONS[from] ?? []).includes(to)) {
      throw new ConflictException({ code: 'INVALID_TRANSITION', message: `cannot go ${from} → ${to}` });
    }
  }

  async approve(tenantId: string, userId: string, id: string, body: any) {
    const req = await this.db.attendanceCorrectionRequest.findFirst({ where: { id, tenantId } });
    if (!req) throw new NotFoundException(`correction request not found: ${id}`);
    await this.assertApproverScope(userId, req.personId);
    this.assertTransition(req.status, 'APPROVED');
    const updated = await this.db.attendanceCorrectionRequest.update({
      where: { id },
      data: { status: 'APPROVED', decidedAt: new Date(), decidedBy: userId, decisionNote: body?.note ?? null },
    });
    await this.db.attendanceDay.upsert({
      where: { tenantId_personId_workDate: { tenantId, personId: req.personId, workDate: req.workDate } },
      create: {
        tenantId,
        personId: req.personId,
        workDate: req.workDate,
        status: req.requestedStatus ?? 'PRESENT',
        firstIn: req.requestedFirstIn,
        lastOut: req.requestedLastOut,
        correctionApplied: true,
      },
      update: {
        status: req.requestedStatus ?? undefined,
        firstIn: req.requestedFirstIn ?? undefined,
        lastOut: req.requestedLastOut ?? undefined,
        correctionApplied: true,
        recomputedAt: new Date(),
      },
    });
    if (req.approvalTaskId) {
      await this.xoffice.closeLightweightApprovalTask(req.approvalTaskId, 'approved', userId);
    }
    await this.audit(tenantId, userId, 'approve', id);
    return updated;
  }

  async reject(tenantId: string, userId: string, id: string, body: any) {
    const req = await this.db.attendanceCorrectionRequest.findFirst({ where: { id, tenantId } });
    if (!req) throw new NotFoundException(`correction request not found: ${id}`);
    await this.assertApproverScope(userId, req.personId);
    this.assertTransition(req.status, 'REJECTED');
    const updated = await this.db.attendanceCorrectionRequest.update({
      where: { id },
      data: { status: 'REJECTED', decidedAt: new Date(), decidedBy: userId, decisionNote: body?.note ?? null },
    });
    if (req.approvalTaskId) {
      await this.xoffice.closeLightweightApprovalTask(req.approvalTaskId, 'rejected', userId);
    }
    await this.audit(tenantId, userId, 'reject', id);
    return updated;
  }
}
