import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { XofficePrismaService } from '../xoffice-prisma/xoffice-prisma.service';
import { RecordsService } from '../records/records.service';
import { AssignmentResolver, Selector } from '../identity/assignment-resolver.service';
import { IdentityService } from '../identity/identity.service';
import { isLegalStatusChange, isOverdue, legalStatusTargets, WORK_STATUSES } from './work.fsm';
import type { CreateWorkItemDto, SummaryWorkItemDTO } from './work.types';

const SUBJECT_TYPE = 'WorkItem';
const WORK_TYPES = ['TASK', 'SUBTASK', 'ACTION', 'MILESTONE', 'DELIVERABLE', 'FOLLOW_UP'];

/**
 * WorkService — the NativeWorkItem PM aggregate (X.Office Work v2 — W1). A
 * durable unit of work with its own status FSM (work.fsm.ts), riding ALONGSIDE
 * (never replacing) the workflow-runtime ApprovalTask. Responsibility is
 * resolved through the shared AssignmentResolver into assignmentSnapshot (never
 * hardcoded). Attachments/evidence reuse RecordDocument (subjectType='WorkItem').
 * Runs inside the caller's withTenant(tenantId) context (XofficeTenantScopeInterceptor)
 * so every read/write is RLS-scoped.
 *
 * Owner requirement #1 — VISIBILITY TIERS: the read path returns a FULL DTO only
 * to an actor who is the owner / an assignee / the creator / holds
 * `work.view.full`; every other viewer receives a SUMMARY DTO with
 * description/comments/checklist/attachments/children stripped at the SERVICE
 * layer (never leaked to the client). This is the W1 seam for the W2/W3
 * CoordinationShare + Gantt roll-up.
 */
@Injectable()
export class WorkService {
  constructor(
    private readonly prisma: XofficePrismaService,
    private readonly records: RecordsService,
    private readonly assignment: AssignmentResolver,
    private readonly identity: IdentityService,
  ) {}

  private get db() {
    return this.prisma.db;
  }

  // ---- events + audit -------------------------------------------------------
  private async event(
    tenantId: string,
    workItemId: string,
    type: string,
    actorId: string,
    data: Record<string, unknown> = {},
  ) {
    await this.db.workItemEvent.create({ data: { tenantId, workItemId, type, actorId, data: data as any } });
    await this.db.auditLog.create({
      data: {
        tenantId,
        instanceCode: workItemId,
        actorId,
        action: `work.item.${type}`,
        detail: JSON.stringify(data).slice(0, 500),
        at: new Date(),
      },
    });
  }

  // ---- visibility (owner requirement #1) ------------------------------------
  /**
   * Decide whether `actorId` gets FULL access to `item`. FULL when the actor is
   * the owner / an assignee / the creator, or holds `work.view.full` (checked
   * under bypass, independent of enforcement flag — this is a read decision, not
   * a guard). Everyone else (tenant-scoped by RLS) gets SUMMARY.
   */
  private async hasFullAccess(actorId: string, item: any): Promise<boolean> {
    if (!actorId) return false;
    if (item.ownerId === actorId) return true;
    if (item.createdBy === actorId) return true;
    if (Array.isArray(item.assigneeIds) && item.assigneeIds.includes(actorId)) return true;
    const decision = await this.prisma.withBypass(() => this.identity.can(actorId, 'work.view.full'));
    return decision.allowed;
  }

  private toSummary(item: any): SummaryWorkItemDTO {
    return {
      tier: 'SUMMARY',
      id: item.id,
      title: item.title,
      type: item.type,
      isMilestone: item.type === 'MILESTONE',
      status: item.status,
      progressPercent: item.progressPercent ?? 0,
      plannedStart: item.plannedStart ?? null,
      dueAt: item.dueAt ?? null,
      overdue: isOverdue(item.dueAt, item.status),
    };
  }

  private enrichFull(item: any) {
    return {
      tier: 'FULL' as const,
      ...item,
      overdue: isOverdue(item.dueAt, item.status),
      legalStatusTargets: legalStatusTargets(item.status),
      isMilestone: item.type === 'MILESTONE',
    };
  }

  // ---- create ---------------------------------------------------------------
  async create(tenantId: string, actorId: string, body: CreateWorkItemDto) {
    if (!body?.title) throw new BadRequestException('title is required');
    const type = (body.type ?? 'TASK').toUpperCase();
    if (!WORK_TYPES.includes(type)) {
      throw new BadRequestException(`type must be one of ${WORK_TYPES.join('/')} (got ${type})`);
    }
    const status = (body.status ?? 'BACKLOG').toUpperCase();
    if (!WORK_STATUSES.includes(status as any)) {
      throw new BadRequestException(`invalid status ${status}`);
    }
    if (body.parentId) {
      const parent = await this.db.nativeWorkItem.findFirst({ where: { id: body.parentId, tenantId } });
      if (!parent) throw new BadRequestException(`parentId not found in tenant: ${body.parentId}`);
    }
    const progress = Math.max(0, Math.min(100, body.progressPercent ?? 0));
    const item = await this.db.nativeWorkItem.create({
      data: {
        tenantId,
        projectId: body.projectId ?? null,
        parentId: body.parentId ?? null,
        wbsCode: body.wbsCode ?? null,
        type,
        title: body.title,
        description: body.description ?? null,
        status,
        priority: (body.priority ?? 'NORMAL').toUpperCase(),
        ownerId: body.ownerId ?? actorId,
        assigneeIds: body.assigneeIds ?? [],
        plannedStart: body.plannedStart ? new Date(body.plannedStart) : null,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        actualStart: status === 'IN_PROGRESS' ? new Date() : null,
        progressPercent: progress,
        weight: body.weight ?? null,
        estimateMinutes: body.estimateMinutes ?? null,
        tags: body.tags ?? [],
        dimensions: (body.dimensions ?? {}) as any,
        sourceContext: (body.sourceContext ?? null) as any,
        createdBy: actorId,
      },
    });
    await this.event(tenantId, item.id, 'created', actorId, { type, status, title: item.title });
    return this.enrichFull(item);
  }

  // ---- list (filters + tags + dimensions) -----------------------------------
  async list(
    tenantId: string,
    actorId: string,
    filters: {
      scope?: 'mine' | 'assigned' | 'created' | 'all';
      status?: string;
      type?: string;
      projectId?: string;
      parentId?: string;
      q?: string;
      tags?: string[];
      dimensions?: Record<string, string>;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const where: any = { tenantId };
    if (filters.status) where.status = filters.status.toUpperCase();
    if (filters.type) where.type = filters.type.toUpperCase();
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.parentId) where.parentId = filters.parentId;
    if (filters.q) where.title = { contains: filters.q, mode: 'insensitive' };
    if (filters.scope === 'created') where.createdBy = actorId;
    if (filters.scope === 'assigned') where.assigneeIds = { has: actorId };
    if (filters.scope === 'mine') {
      where.OR = [{ ownerId: actorId }, { assigneeIds: { has: actorId } }, { createdBy: actorId }];
    }
    // tags[] AND-match (item must carry every requested tag).
    if (filters.tags?.length) where.tags = { hasEvery: filters.tags };
    // dimensions exact-match on each requested key (jsonb equality).
    if (filters.dimensions && Object.keys(filters.dimensions).length) {
      where.AND = Object.entries(filters.dimensions).map(([k, v]) => ({
        dimensions: { path: [k], equals: v },
      }));
    }

    const rows = await this.db.nativeWorkItem.findMany({ where, orderBy: { createdAt: 'desc' } });

    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.max(1, Math.min(200, filters.pageSize ?? 50));
    const total = rows.length;
    const slice = rows.slice((page - 1) * pageSize, page * pageSize);

    // Per-row visibility tier (list never returns comments/checklist/attachments;
    // FULL rows carry description/children-count, SUMMARY rows are stripped).
    const items = await Promise.all(
      slice.map(async (r) => {
        const full = await this.hasFullAccess(actorId, r);
        if (!full) return this.toSummary(r);
        return {
          tier: 'FULL' as const,
          ...r,
          overdue: isOverdue(r.dueAt, r.status),
          isMilestone: r.type === 'MILESTONE',
          legalStatusTargets: legalStatusTargets(r.status),
        };
      }),
    );
    return { items, total, page, pageSize };
  }

  // ---- detail ---------------------------------------------------------------
  async get(tenantId: string, actorId: string, id: string) {
    const item = await this.load(tenantId, id);
    const full = await this.hasFullAccess(actorId, item);
    if (!full) {
      // Coordination summary — NEVER attach description/comments/checklist/
      // attachments/children (stripped server-side).
      return { item: this.toSummary(item) };
    }
    const [comments, checklist, events, attachments, children] = await Promise.all([
      this.db.workItemComment.findMany({ where: { tenantId, workItemId: id }, orderBy: { createdAt: 'asc' } }),
      this.db.workItemChecklistItem.findMany({ where: { tenantId, workItemId: id }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
      this.db.workItemEvent.findMany({ where: { tenantId, workItemId: id }, orderBy: { createdAt: 'asc' } }),
      this.records.listDocuments(tenantId, { subjectType: SUBJECT_TYPE, subjectId: id }),
      this.db.nativeWorkItem.findMany({ where: { tenantId, parentId: id }, orderBy: { createdAt: 'asc' } }),
    ]);
    return {
      item: this.enrichFull(item),
      comments,
      checklist,
      events,
      attachments,
      children: children.map((c) => ({ id: c.id, title: c.title, type: c.type, status: c.status, progressPercent: c.progressPercent })),
    };
  }

  private async load(tenantId: string, id: string) {
    const item = await this.db.nativeWorkItem.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException(`work item not found: ${id}`);
    return item;
  }

  // ---- update ---------------------------------------------------------------
  async update(tenantId: string, actorId: string, id: string, patch: Partial<CreateWorkItemDto>) {
    await this.load(tenantId, id);
    const data: any = {};
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.description !== undefined) data.description = patch.description;
    if (patch.priority !== undefined) data.priority = String(patch.priority).toUpperCase();
    if (patch.type !== undefined) {
      const t = String(patch.type).toUpperCase();
      if (!WORK_TYPES.includes(t)) throw new BadRequestException(`invalid type ${t}`);
      data.type = t;
    }
    if (patch.wbsCode !== undefined) data.wbsCode = patch.wbsCode;
    if (patch.projectId !== undefined) data.projectId = patch.projectId;
    if (patch.plannedStart !== undefined) data.plannedStart = patch.plannedStart ? new Date(patch.plannedStart) : null;
    if (patch.dueAt !== undefined) data.dueAt = patch.dueAt ? new Date(patch.dueAt) : null;
    if (patch.weight !== undefined) data.weight = patch.weight;
    if (patch.estimateMinutes !== undefined) data.estimateMinutes = patch.estimateMinutes;
    if (patch.tags !== undefined) data.tags = patch.tags;
    if (patch.dimensions !== undefined) data.dimensions = patch.dimensions as any;
    if (patch.sourceContext !== undefined) data.sourceContext = patch.sourceContext as any;
    const updated = await this.db.nativeWorkItem.update({ where: { id }, data });
    await this.event(tenantId, id, 'updated', actorId, { fields: Object.keys(data) });
    return this.enrichFull(updated);
  }

  // ---- schedule command (Gantt drag/resize) ---------------------------------
  /**
   * Reschedule a work item's plannedStart/dueAt with server-side validation
   * (owner requirement #1 — Gantt is the SoT). Rejects (400) when:
   *  - start is after finish; or
   *  - an FS predecessor finishes AFTER this item's new start (the successor may
   *    not start before its finish-to-start predecessor completes); or
   *  - an FS successor starts BEFORE this item's new finish.
   * The client applies optimistically and rolls back on the 400.
   */
  async reschedule(tenantId: string, actorId: string, id: string, body: { plannedStart?: string | null; dueAt?: string | null }) {
    const item = await this.load(tenantId, id);
    const start = body.plannedStart !== undefined ? (body.plannedStart ? new Date(body.plannedStart) : null) : item.plannedStart;
    const due = body.dueAt !== undefined ? (body.dueAt ? new Date(body.dueAt) : null) : item.dueAt;
    if (start && due && start > due) {
      throw new BadRequestException('invalid schedule: plannedStart is after dueAt');
    }

    const deps = await this.db.workDependency.findMany({
      where: { tenantId, type: 'FS', OR: [{ successorId: id }, { predecessorId: id }] },
    });
    const otherIds = new Set<string>();
    for (const d of deps) otherIds.add(d.predecessorId === id ? d.successorId : d.predecessorId);
    const others = otherIds.size
      ? await this.db.nativeWorkItem.findMany({ where: { tenantId, id: { in: [...otherIds] } } })
      : [];
    const byId = new Map(others.map((o) => [o.id, o]));

    for (const d of deps) {
      if (d.successorId === id && start) {
        const pre = byId.get(d.predecessorId);
        if (pre?.dueAt && pre.dueAt > start) {
          throw new BadRequestException(
            `invalid schedule: FS predecessor '${pre.title}' finishes ${pre.dueAt.toISOString()} after this item's start ${start.toISOString()}`,
          );
        }
      }
      if (d.predecessorId === id && due) {
        const suc = byId.get(d.successorId);
        if (suc?.plannedStart && suc.plannedStart < due) {
          throw new BadRequestException(
            `invalid schedule: FS successor '${suc.title}' starts ${suc.plannedStart.toISOString()} before this item's finish ${due.toISOString()}`,
          );
        }
      }
    }

    const updated = await this.db.nativeWorkItem.update({ where: { id }, data: { plannedStart: start, dueAt: due } });
    await this.event(tenantId, id, 'rescheduled', actorId, { plannedStart: start, dueAt: due });
    return this.enrichFull(updated);
  }

  // ---- status transition ----------------------------------------------------
  async changeStatus(tenantId: string, actorId: string, id: string, to: string) {
    const item = await this.load(tenantId, id);
    const target = String(to ?? '').toUpperCase();
    if (!WORK_STATUSES.includes(target as any)) throw new BadRequestException(`invalid status ${target}`);
    if (!isLegalStatusChange(item.status, target)) {
      throw new BadRequestException(
        `Illegal status transition '${item.status}' → '${target}' (legal: ${legalStatusTargets(item.status).join(', ') || '—'})`,
      );
    }
    const data: any = { status: target };
    if (target === 'IN_PROGRESS' && !item.actualStart) data.actualStart = new Date();
    if (target === 'DONE') {
      data.completedAt = new Date();
      data.progressPercent = 100;
    }
    if (item.status === 'DONE' && target !== 'DONE') data.completedAt = null;
    const updated = await this.db.nativeWorkItem.update({ where: { id }, data });
    await this.event(tenantId, id, 'status_changed', actorId, { from: item.status, to: target });
    return this.enrichFull(updated);
  }

  // ---- assign (via AssignmentResolver — NEVER hardcoded) --------------------
  private selectorFor(body: { selectorType?: string; positionId?: string; orgUnitId?: string; groupId?: string; roleCode?: string }): Selector {
    const t = (body.selectorType ?? '').toUpperCase();
    switch (t) {
      case 'POSITION':
        return { selectorType: 'POSITION', positionId: body.positionId, choicePolicy: 'MULTIPLE' };
      case 'ORG_UNIT_HEAD':
        return { selectorType: 'ORG_UNIT_HEAD', orgUnitId: body.orgUnitId, choicePolicy: 'MULTIPLE' };
      case 'GROUP':
        return { selectorType: 'GROUP', groupId: body.groupId, choicePolicy: 'MULTIPLE' };
      case 'ROLE':
      default:
        return { selectorType: 'ROLE', roleCode: body.roleCode, choicePolicy: 'MULTIPLE' };
    }
  }

  async assign(
    tenantId: string,
    actorId: string,
    id: string,
    body: {
      assigneeIds?: string[];
      ownerId?: string;
      selectorType?: string;
      positionId?: string;
      orgUnitId?: string;
      groupId?: string;
      roleCode?: string;
    },
  ) {
    const item = await this.load(tenantId, id);
    let assigneeIds = body.assigneeIds ?? [];
    let snapshot: any = null;

    // Structured selector → resolve through the shared resolver (audit snapshot),
    // NEVER a hardcoded assignee. Explicit assigneeIds are still allowed (already
    // resolved upstream, e.g. picked in the UI).
    if (body.selectorType) {
      const selector = this.selectorFor(body);
      const resolution = await this.assignment.resolveAndSnapshot({
        tenantId,
        workflowInstanceCode: `work-item:${id}`,
        nodeId: 'work-item-assign',
        selector,
        actorId,
      });
      const personIds = resolution.candidates.map((c) => c.personId);
      const userIds: string[] = [];
      for (const personId of personIds) {
        userIds.push((await this.identity.userIdForPerson(personId)) ?? personId);
      }
      assigneeIds = [...new Set([...assigneeIds, ...userIds])];
      snapshot = {
        via: 'assignment-resolver',
        selector,
        resolvedPersonIds: personIds,
        assigneeUserIds: userIds,
        reason: resolution.reason,
        at: new Date().toISOString(),
      };
      if (assigneeIds.length === 0) {
        throw new BadRequestException(`assign: selector resolved to 0 assignees (${selector.selectorType})`);
      }
    } else {
      snapshot = { via: 'explicit', assigneeUserIds: assigneeIds, at: new Date().toISOString() };
    }

    const updated = await this.db.nativeWorkItem.update({
      where: { id },
      data: {
        assigneeIds,
        ownerId: body.ownerId ?? item.ownerId,
        assignmentSnapshot: snapshot as any,
      },
    });
    await this.event(tenantId, id, 'assigned', actorId, { assigneeIds, ownerId: updated.ownerId, snapshot });
    return this.enrichFull(updated);
  }

  // ---- progress -------------------------------------------------------------
  async setProgress(tenantId: string, actorId: string, id: string, progressPercent: number) {
    const item = await this.load(tenantId, id);
    const p = Math.max(0, Math.min(100, Math.round(Number(progressPercent))));
    if (Number.isNaN(p)) throw new BadRequestException('progressPercent must be a number 0..100');
    const data: any = { progressPercent: p };
    if (p === 100 && !['DONE', 'CANCELLED'].includes(item.status) && isLegalStatusChange(item.status, 'DONE')) {
      data.status = 'DONE';
      data.completedAt = new Date();
    }
    const updated = await this.db.nativeWorkItem.update({ where: { id }, data });
    await this.event(tenantId, id, 'progress', actorId, { progressPercent: p, status: updated.status });
    return this.enrichFull(updated);
  }

  // ---- comment --------------------------------------------------------------
  async addComment(tenantId: string, actorId: string, id: string, body: { body?: string }) {
    await this.load(tenantId, id);
    if (!body?.body) throw new BadRequestException('body is required');
    const comment = await this.db.workItemComment.create({ data: { tenantId, workItemId: id, authorId: actorId, body: body.body } });
    await this.event(tenantId, id, 'comment', actorId, { commentId: comment.id });
    return comment;
  }

  // ---- checklist ------------------------------------------------------------
  async addChecklistItem(tenantId: string, actorId: string, id: string, body: { label?: string; sortOrder?: number }) {
    await this.load(tenantId, id);
    if (!body?.label) throw new BadRequestException('label is required');
    const item = await this.db.workItemChecklistItem.create({
      data: { tenantId, workItemId: id, label: body.label, sortOrder: body.sortOrder ?? 0 },
    });
    await this.event(tenantId, id, 'checklist_added', actorId, { checklistItemId: item.id, label: item.label });
    return item;
  }

  async toggleChecklistItem(tenantId: string, actorId: string, id: string, itemId: string, done: boolean) {
    await this.load(tenantId, id);
    const existing = await this.db.workItemChecklistItem.findFirst({ where: { id: itemId, tenantId, workItemId: id } });
    if (!existing) throw new NotFoundException(`checklist item not found: ${itemId}`);
    const updated = await this.db.workItemChecklistItem.update({
      where: { id: itemId },
      data: { done: !!done, doneBy: done ? actorId : null, doneAt: done ? new Date() : null },
    });
    await this.event(tenantId, id, 'checklist_toggled', actorId, { checklistItemId: itemId, done: !!done });
    return updated;
  }

  // ---- attachment (RecordDocument subjectType=WorkItem) ---------------------
  async addAttachment(
    tenantId: string,
    actorId: string,
    id: string,
    body: { title?: string; note?: string; content?: string; contentBase64?: string; mimeType?: string },
  ) {
    const item = await this.load(tenantId, id);
    const doc = await this.records.createDocument(tenantId, actorId, {
      kind: 'ATTACHMENT',
      title: body.title ?? `Attachment — ${item.title}`,
      subjectType: SUBJECT_TYPE,
      subjectId: id,
      tags: ['work-item', 'attachment'],
      ...(body.contentBase64 ? { contentBase64: body.contentBase64 } : { content: body.content ?? `Attachment for ${item.title}` }),
      mimeType: body.mimeType ?? 'text/plain',
    } as any);
    await this.event(tenantId, id, 'attachment_added', actorId, { documentId: doc.document?.id, title: doc.document?.title });
    return doc;
  }

  // ---- dimension catalog ----------------------------------------------------
  async listDimensions(tenantId: string) {
    return this.db.workDimension.findMany({ where: { tenantId }, orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }] });
  }
}
