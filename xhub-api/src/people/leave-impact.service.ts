import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { XofficeService } from '../xoffice/xoffice.service';

/**
 * LeaveImpactSnapshot — X.Office-owned, ALWAYS computed (never hand-entered).
 * Resolves which real NativeWorkItem/ApprovalTask/Booking/DirectiveAssignment
 * rows fall inside a leave window for the requester. Org resolution goes
 * personId → Position.holderPersonId → OrgUnit (NativeWorkItem itself has no
 * orgUnitId column — PE_SCHEMA_PLAN / DT-00 constraint).
 *
 * `preview()` computes the SAME summary WITHOUT writing a row (impact-preview
 * endpoint, called by FE before submit). `capture()` writes the immutable
 * LeaveImpactSnapshot row at ON_SUBMIT/ON_APPROVE/ON_CANCEL.
 */
@Injectable()
export class LeaveImpactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService,
    private readonly xoffice: XofficeService,
  ) {}
  private get db() {
    return this.prisma.db;
  }

  private async computeImpact(tenantId: string, personId: string, startAt: Date, endAt: Date) {
    const actingUserId = await this.identity.userIdForPerson(personId);

    const workItems = await this.db.nativeWorkItem.findMany({
      where: {
        tenantId,
        status: { notIn: ['DONE', 'CANCELLED'] },
        dueAt: { gte: startAt, lte: endAt },
        OR: [{ ownerId: personId }, { assigneeIds: { has: personId } }],
      },
    });
    const impactedWorkItemIds = workItems.filter((w: any) => w.type !== 'MILESTONE').map((w: any) => w.id);
    const impactedMilestoneIds = workItems.filter((w: any) => w.type === 'MILESTONE').map((w: any) => w.id);
    const impactedProjectIds = [
      ...new Set(workItems.map((w: any) => w.projectId).filter((id: any): id is string => !!id)),
    ];

    const approvalTasks = actingUserId
      ? await this.xoffice.listOpenApprovalTasksForAssignee(tenantId, actingUserId)
      : [];
    const impactedApprovalTaskIds = approvalTasks.map((t: any) => t.id);

    const bookings = actingUserId
      ? await this.db.booking.findMany({
          where: {
            tenantId,
            requesterId: actingUserId,
            state: { notIn: ['CANCELLED', 'COMPLETED'] },
            startAt: { lte: endAt },
            endAt: { gte: startAt },
          },
        })
      : [];
    const impactedBookingIds = bookings.map((b: any) => b.id);

    const directiveAssignments = await this.db.directiveAssignment.findMany({
      where: {
        tenantId,
        assigneeId: actingUserId ? { in: [personId, actingUserId] } : personId,
        state: { notIn: ['ACCEPTED', 'RETURNED'] },
        dueAt: { gte: startAt, lte: endAt },
      },
    });
    const impactedDirectiveIds = directiveAssignments.map((d: any) => d.directiveId);

    const capacityDeltaHours = impactedWorkItemIds.length
      ? Math.round(((endAt.getTime() - startAt.getTime()) / 3_600_000) * 100) / 100
      : 0;

    const summary = {
      workItems: impactedWorkItemIds.length,
      milestones: impactedMilestoneIds.length,
      approvals: impactedApprovalTaskIds.length,
      bookings: impactedBookingIds.length,
      directives: impactedDirectiveIds.length,
      riskLevel: impactedApprovalTaskIds.length > 0 || impactedMilestoneIds.length > 0 ? 'HIGH' : impactedWorkItemIds.length > 0 ? 'MEDIUM' : 'LOW',
    };

    return {
      impactedWorkItemIds,
      impactedMilestoneIds,
      impactedApprovalTaskIds,
      impactedBookingIds,
      impactedDirectiveIds,
      impactedProjectIds,
      summary,
      capacityDeltaHours,
    };
  }

  async preview(tenantId: string, personId: string, startAt: Date, endAt: Date) {
    return this.computeImpact(tenantId, personId, startAt, endAt);
  }

  async capture(
    tenantId: string,
    actorId: string,
    leaveRequestId: string,
    personId: string,
    startAt: Date,
    endAt: Date,
    capturedPhase: 'ON_SUBMIT' | 'ON_APPROVE' | 'ON_CANCEL',
  ) {
    const impact = await this.computeImpact(tenantId, personId, startAt, endAt);
    return this.db.leaveImpactSnapshot.create({
      data: {
        tenantId,
        leaveRequestId,
        personId,
        capturedPhase,
        ...impact,
        createdBy: actorId,
      },
    });
  }
}
