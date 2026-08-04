import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { XofficeService } from '../xoffice/xoffice.service';
import { OT_TRANSITIONS } from './people.constants';
import { resolveActingPerson, resolveApprovalAssignee } from './people.helpers';

/**
 * OvertimeRequest — X.Office is SoR of the REQUEST regardless of payrollMode
 * (FinERP, once connected, becomes SoR of the OT *payout* — a different
 * object; see PE_SOR_MATRIX_DELTA). hours is server-computed from
 * startAt/endAt, never client-trusted.
 */
@Injectable()
export class OvertimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService,
    private readonly xoffice: XofficeService,
  ) {}
  private get db() {
    return this.prisma.db;
  }

  private async audit(tenantId: string, actorId: string, action: string, code: string) {
    await this.db.auditLog.create({
      data: { tenantId, actorId, instanceCode: code, action: `people.overtime.${action}`, detail: '', at: new Date() },
    });
  }

  /** Manager-side actions are scoped to the caller's DataScope.orgUnits — same ABAC as team endpoints. */
  private async assertApproverScope(userId: string, orgUnitId: string | null) {
    const eff = await this.identity.effectivePermissions(userId);
    const scopedOrgUnits = [...new Set(eff.scopes.flatMap((s: any) => s?.orgUnits ?? []))];
    if (scopedOrgUnits.length && (!orgUnitId || !scopedOrgUnits.includes(orgUnitId))) {
      throw new ForbiddenException({ code: 'OUT_OF_SCOPE', message: 'this request is outside your data scope' });
    }
  }

  async listMine(tenantId: string, userId: string) {
    const person = await resolveActingPerson(this.identity, userId);
    const items = await this.db.overtimeRequest.findMany({ where: { tenantId, personId: person.id }, orderBy: { workDate: 'desc' } });
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
    const existing = await this.db.overtimeRequest.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } } });
    if (existing) return { ...existing, replayed: true };

    const person = await resolveActingPerson(this.identity, userId);
    const startAt = new Date(body?.startAt);
    const endAt = new Date(body?.endAt);
    if (isNaN(startAt.getTime()) || isNaN(endAt.getTime()) || endAt <= startAt) {
      throw new BadRequestException('startAt/endAt required and endAt must be after startAt');
    }
    const hours = Math.round(((endAt.getTime() - startAt.getTime()) / 3_600_000) * 100) / 100;
    const position = await this.db.position.findFirst({ where: { tenantId, holderPersonId: person.id } });

    let ot;
    try {
      ot = await this.db.overtimeRequest.create({
        data: {
          tenantId,
          personId: person.id,
          orgUnitId: position?.orgUnitId ?? null,
          workDate: new Date(body?.workDate ?? startAt),
          startAt,
          endAt,
          hours,
          otType: body?.otType ?? 'NORMAL',
          reason: body?.reason ?? null,
          relatedWorkItemId: body?.relatedWorkItemId ?? null,
          relatedProjectId: body?.relatedProjectId ?? null,
          status: 'SUBMITTED',
          submittedAt: new Date(),
          idempotencyKey,
          createdBy: userId,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const replay = await this.db.overtimeRequest.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } } });
        if (replay) return { ...replay, replayed: true };
      }
      throw e;
    }

    const assignee = await resolveApprovalAssignee(this.prisma, tenantId, person.id, this.identity);
    const { workflowInstanceId, approvalTaskId } = await this.xoffice.spawnLightweightApprovalTask(
      tenantId,
      'PEOPLE_OVERTIME_APPROVAL',
      `Tăng ca — ${person.fullName}`,
      person.email ?? `${userId}@local`,
      assignee.assigneeRole,
      assignee.assigneeUserId,
    );
    ot = await this.db.overtimeRequest.update({ where: { id: ot.id }, data: { workflowInstanceId, approvalTaskId } });
    await this.audit(tenantId, userId, 'submit', ot.id);
    return ot;
  }

  private assertTransition(from: string, to: string) {
    if (!(OT_TRANSITIONS[from] ?? []).includes(to)) {
      throw new ConflictException({ code: 'INVALID_TRANSITION', message: `cannot go ${from} → ${to}` });
    }
  }

  async approve(tenantId: string, userId: string, id: string) {
    const ot = await this.db.overtimeRequest.findFirst({ where: { id, tenantId } });
    if (!ot) throw new NotFoundException(`overtime request not found: ${id}`);
    await this.assertApproverScope(userId, ot.orgUnitId);
    this.assertTransition(ot.status, 'APPROVED');
    const updated = await this.db.overtimeRequest.update({
      where: { id },
      data: { status: 'APPROVED', decidedAt: new Date(), decidedBy: userId },
    });
    if (ot.approvalTaskId) {
      await this.xoffice.closeLightweightApprovalTask(ot.approvalTaskId, 'approved', userId);
    }
    await this.audit(tenantId, userId, 'approve', id);
    return updated;
  }

  async reject(tenantId: string, userId: string, id: string, body: any) {
    const ot = await this.db.overtimeRequest.findFirst({ where: { id, tenantId } });
    if (!ot) throw new NotFoundException(`overtime request not found: ${id}`);
    await this.assertApproverScope(userId, ot.orgUnitId);
    this.assertTransition(ot.status, 'REJECTED');
    const updated = await this.db.overtimeRequest.update({
      where: { id },
      data: { status: 'REJECTED', decidedAt: new Date(), decidedBy: userId, decisionNote: body?.note ?? null },
    });
    if (ot.approvalTaskId) {
      await this.xoffice.closeLightweightApprovalTask(ot.approvalTaskId, 'rejected', userId);
    }
    await this.audit(tenantId, userId, 'reject', id);
    return updated;
  }
}
