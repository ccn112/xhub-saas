import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { XofficePrismaService } from '../../xoffice-prisma/xoffice-prisma.service';
import { AssignmentResolver, Selector } from '../../identity/assignment-resolver.service';
import { IdentityService } from '../../identity/identity.service';
import { isOverdue } from '../work.fsm';
import {
  computeHealth,
  computeProgress,
  PROGRESS_METHODS,
  type ProgressInput,
  type ProgressMethod,
} from './progress';

const PROJECT_KINDS = ['INTERNAL', 'IMPLEMENTATION', 'PRODUCT', 'CUSTOMER_SUCCESS', 'OPERATIONS', 'OTHER'];
const PROJECT_STATUSES = ['DRAFT', 'PLANNED', 'ACTIVE', 'ON_HOLD', 'AT_RISK', 'COMPLETED', 'CANCELLED'];
const DEP_TYPES = ['FS', 'SS', 'FF', 'SF'];
const PROJECT_ROLES = ['PROJECT_MANAGER', 'SPONSOR', 'DELIVERY_LEAD', 'MEMBER', 'OBSERVER', 'DATA_STEWARD'];
const SHARE_SCOPES = ['PROJECT', 'WORK_ITEM', 'DEPENDENCY'];

export type ProjectAccess = 'FULL' | 'SUMMARY' | 'NONE';

/**
 * WorkProjectsService — the ExecutionProject aggregate (X.Office Work v2 — W2).
 * Owns projects, the WBS roll-up over NativeWorkItems, WorkDependency (with a
 * server-side cycle guard), immutable ProjectBaseline versions, ProjectRole
 * assignment (via the shared AssignmentResolver, never hardcoded) and the
 * CoordinationShare seam that makes W1's Summary/Full read real for cross-team
 * coordination. Runs inside the caller's withTenant(tenantId) RLS context.
 */
@Injectable()
export class WorkProjectsService {
  constructor(
    private readonly prisma: XofficePrismaService,
    private readonly assignment: AssignmentResolver,
    private readonly identity: IdentityService,
  ) {}

  private get db() {
    return this.prisma.db;
  }

  // ---- events + audit -------------------------------------------------------
  private async event(tenantId: string, projectId: string, type: string, actorId: string, data: Record<string, unknown> = {}) {
    await this.db.executionProjectEvent.create({ data: { tenantId, projectId, type, actorId, data: data as any } });
    await this.db.auditLog.create({
      data: { tenantId, instanceCode: projectId, actorId, action: `work.project.${type}`, detail: JSON.stringify(data).slice(0, 500), at: new Date() },
    });
  }

  private async load(tenantId: string, id: string) {
    const p = await this.db.executionProject.findFirst({ where: { id, tenantId } });
    if (!p) throw new NotFoundException(`project not found: ${id}`);
    return p;
  }

  // ==========================================================================
  // CRUD
  // ==========================================================================
  async create(tenantId: string, actorId: string, body: any) {
    if (!body?.code) throw new BadRequestException('code is required');
    if (!body?.name) throw new BadRequestException('name is required');
    const projectKind = String(body.projectKind ?? 'INTERNAL').toUpperCase();
    if (!PROJECT_KINDS.includes(projectKind)) throw new BadRequestException(`invalid projectKind ${projectKind}`);
    const status = String(body.status ?? 'DRAFT').toUpperCase();
    if (!PROJECT_STATUSES.includes(status)) throw new BadRequestException(`invalid status ${status}`);
    const progressMethod = String(body.progressMethod ?? 'TASK_WEIGHTED').toUpperCase();
    if (!PROGRESS_METHODS.includes(progressMethod as ProgressMethod)) throw new BadRequestException(`invalid progressMethod ${progressMethod}`);

    const dup = await this.db.executionProject.findFirst({ where: { tenantId, code: body.code } });
    if (dup) throw new ConflictException(`project code already exists in tenant: ${body.code}`);

    const p = await this.db.executionProject.create({
      data: {
        tenantId,
        code: body.code,
        name: body.name,
        description: body.description ?? null,
        projectKind,
        status,
        progressMethod,
        progressPercent: progressMethod === 'MANUAL' ? Math.max(0, Math.min(100, body.progressPercent ?? 0)) : 0,
        plannedStart: body.plannedStart ? new Date(body.plannedStart) : null,
        plannedFinish: body.plannedFinish ? new Date(body.plannedFinish) : null,
        forecastStart: body.forecastStart ? new Date(body.forecastStart) : null,
        forecastFinish: body.forecastFinish ? new Date(body.forecastFinish) : null,
        ownerId: body.ownerId ?? actorId,
        projectManagerId: body.projectManagerId ?? null,
        sponsorId: body.sponsorId ?? null,
        orgUnitId: body.orgUnitId ?? null,
        canonicalProjectId: body.canonicalProjectId ?? null,
        customerAccountId: body.customerAccountId ?? null,
        tenantLaunchId: body.tenantLaunchId ?? null,
        sourceRef: (body.sourceRef ?? null) as any,
        tags: body.tags ?? [],
        dimensions: (body.dimensions ?? {}) as any,
        createdBy: actorId,
      },
    });
    await this.event(tenantId, p.id, 'created', actorId, { code: p.code, name: p.name, projectKind, status });
    return p;
  }

  async update(tenantId: string, actorId: string, id: string, patch: any) {
    await this.load(tenantId, id);
    const data: any = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.description !== undefined) data.description = patch.description;
    if (patch.projectKind !== undefined) {
      const k = String(patch.projectKind).toUpperCase();
      if (!PROJECT_KINDS.includes(k)) throw new BadRequestException(`invalid projectKind ${k}`);
      data.projectKind = k;
    }
    if (patch.status !== undefined) {
      const s = String(patch.status).toUpperCase();
      if (!PROJECT_STATUSES.includes(s)) throw new BadRequestException(`invalid status ${s}`);
      data.status = s;
    }
    if (patch.progressMethod !== undefined) {
      const m = String(patch.progressMethod).toUpperCase();
      if (!PROGRESS_METHODS.includes(m as ProgressMethod)) throw new BadRequestException(`invalid progressMethod ${m}`);
      data.progressMethod = m;
    }
    if (patch.progressPercent !== undefined) data.progressPercent = Math.max(0, Math.min(100, Math.round(Number(patch.progressPercent) || 0)));
    for (const f of ['plannedStart', 'plannedFinish', 'forecastStart', 'forecastFinish', 'actualStart', 'actualFinish'] as const) {
      if (patch[f] !== undefined) data[f] = patch[f] ? new Date(patch[f]) : null;
    }
    for (const f of ['ownerId', 'projectManagerId', 'sponsorId', 'orgUnitId', 'canonicalProjectId', 'customerAccountId', 'tenantLaunchId'] as const) {
      if (patch[f] !== undefined) data[f] = patch[f];
    }
    if (patch.tags !== undefined) data.tags = patch.tags;
    if (patch.dimensions !== undefined) data.dimensions = patch.dimensions as any;
    if (patch.sourceRef !== undefined) data.sourceRef = patch.sourceRef as any;
    const updated = await this.db.executionProject.update({ where: { id }, data });
    await this.event(tenantId, id, 'updated', actorId, { fields: Object.keys(data) });
    return updated;
  }

  async list(tenantId: string, filters: any = {}) {
    const where: any = { tenantId };
    if (filters.status) where.status = String(filters.status).toUpperCase();
    if (filters.projectKind) where.projectKind = String(filters.projectKind).toUpperCase();
    if (filters.health) where.health = String(filters.health).toUpperCase();
    if (filters.q) where.OR = [{ name: { contains: filters.q, mode: 'insensitive' } }, { code: { contains: filters.q, mode: 'insensitive' } }];
    if (filters.tags?.length) where.tags = { hasEvery: filters.tags };
    if (filters.dimensions && Object.keys(filters.dimensions).length) {
      where.AND = Object.entries(filters.dimensions).map(([k, v]) => ({ dimensions: { path: [k], equals: v } }));
    }
    const rows = await this.db.executionProject.findMany({ where, orderBy: { createdAt: 'desc' } });
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.max(1, Math.min(200, filters.pageSize ?? 50));
    const total = rows.length;
    const slice = rows.slice((page - 1) * pageSize, page * pageSize);
    return { items: slice, total, page, pageSize };
  }

  // ==========================================================================
  // WBS + progress roll-up
  // ==========================================================================
  private async projectItems(tenantId: string, projectId: string) {
    return this.db.nativeWorkItem.findMany({ where: { tenantId, projectId }, orderBy: [{ wbsCode: 'asc' }, { createdAt: 'asc' }] });
  }

  private toProgressInput(i: any): ProgressInput {
    return { type: i.type, status: i.status, progressPercent: i.progressPercent ?? 0, weight: i.weight };
  }

  /**
   * Compute per-parent roll-up + the project total under the project's declared
   * method. A parent item's progress = computeProgress(method, its direct
   * children). The project total = computeProgress(method, top-level items /
   * their rolled-up values). MANUAL keeps the project's stored progressPercent.
   */
  private rollUp(project: any, items: any[]) {
    const byParent = new Map<string, any[]>();
    for (const it of items) {
      const key = it.parentId ?? '__root__';
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(it);
    }
    const method = project.progressMethod as ProgressMethod;
    const rolled = new Map<string, number>();
    // Roll up parents from their direct children (leaves keep own progress).
    for (const it of items) {
      const kids = byParent.get(it.id);
      rolled.set(it.id, kids && kids.length ? computeProgress(method, kids.map((k) => this.toProgressInput(k)), it.progressPercent) : it.progressPercent ?? 0);
    }
    const roots = byParent.get('__root__') ?? [];
    const projectProgress =
      method === 'MANUAL'
        ? project.progressPercent ?? 0
        : computeProgress(
            method,
            roots.map((r) => ({ ...this.toProgressInput(r), progressPercent: rolled.get(r.id) ?? 0 })),
          );
    return { rolled, projectProgress, roots };
  }

  /** Recompute + persist project progress + deterministic health. */
  async recompute(tenantId: string, actorId: string, id: string) {
    const project = await this.load(tenantId, id);
    const items = await this.projectItems(tenantId, id);
    const { projectProgress } = this.rollUp(project, items);

    const baseline = project.currentBaselineVersion
      ? await this.db.projectBaseline.findFirst({ where: { tenantId, projectId: id, version: project.currentBaselineVersion } })
      : null;
    let baselineFinish: Date | null = null;
    if (baseline) {
      const bitems = await this.db.baselineItem.findMany({ where: { tenantId, baselineId: baseline.id } });
      baselineFinish = bitems.reduce<Date | null>((max, b) => (b.dueAt && (!max || b.dueAt > max) ? b.dueAt : max), null);
    }
    const overdueItemCount = items.filter((i) => isOverdue(i.dueAt, i.status)).length;
    const overdueMilestoneCount = items.filter((i) => i.type === 'MILESTONE' && isOverdue(i.dueAt, i.status)).length;
    const blockedHighCount = items.filter((i) => i.status === 'BLOCKED' && ['HIGH', 'URGENT'].includes(i.priority)).length;
    const health = computeHealth({
      status: project.status,
      hasBaseline: !!baseline,
      baselineFinish,
      forecastFinish: project.forecastFinish,
      plannedFinish: project.plannedFinish,
      overdueItemCount,
      overdueMilestoneCount,
      blockedHighCount,
    });

    const updated = await this.db.executionProject.update({
      where: { id },
      data: { progressPercent: projectProgress, health },
    });
    return { project: updated, metrics: { projectProgress, health, overdueItemCount, overdueMilestoneCount, blockedHighCount, baselineFinish } };
  }

  /** Attach existing NativeWorkItems to this project (WBS). Optionally set a
   *  parent + wbsCode. Reuses NativeWorkItem (no new work-item write path). */
  async attachItems(tenantId: string, actorId: string, id: string, body: { workItemIds?: string[]; parentId?: string | null; wbsCode?: string | null }) {
    await this.load(tenantId, id);
    const ids = body.workItemIds ?? [];
    if (!ids.length) throw new BadRequestException('workItemIds is required');
    if (body.parentId) {
      const parent = await this.db.nativeWorkItem.findFirst({ where: { id: body.parentId, tenantId } });
      if (!parent) throw new BadRequestException(`parentId not found: ${body.parentId}`);
    }
    const data: any = { projectId: id };
    if (body.parentId !== undefined) data.parentId = body.parentId;
    if (body.wbsCode !== undefined) data.wbsCode = body.wbsCode;
    const res = await this.db.nativeWorkItem.updateMany({ where: { tenantId, id: { in: ids } }, data });
    await this.event(tenantId, id, 'items_attached', actorId, { count: res.count, workItemIds: ids });
    await this.recompute(tenantId, actorId, id);
    return { attached: res.count };
  }

  // ==========================================================================
  // Detail
  // ==========================================================================
  async get(tenantId: string, actorId: string, id: string) {
    const project = await this.load(tenantId, id);
    const access = await this.resolveAccess(tenantId, actorId, project);
    if (access === 'NONE') throw new NotFoundException(`project not found: ${id}`);

    const items = await this.projectItems(tenantId, id);
    const { rolled, projectProgress } = this.rollUp(project, items);
    const milestones = items.filter((i) => i.type === 'MILESTONE');

    if (access === 'SUMMARY') {
      // Coordination viewer: rolled-up parent bars ONLY (no children/description).
      const roots = items.filter((i) => !i.parentId);
      return {
        access,
        project: this.projectSummary(project, projectProgress),
        workItems: roots.map((r) => this.itemSummary(r, rolled.get(r.id) ?? r.progressPercent)),
        milestones: milestones.map((m) => this.itemSummary(m, rolled.get(m.id) ?? m.progressPercent)),
      };
    }

    const [roles, baselines, dependencies] = await Promise.all([
      this.db.projectRoleAssignment.findMany({ where: { tenantId, projectId: id }, orderBy: { createdAt: 'asc' } }),
      this.db.projectBaseline.findMany({ where: { tenantId, projectId: id }, orderBy: { version: 'desc' } }),
      this.listDependencies(tenantId, id),
    ]);
    return {
      access,
      project: { ...project, computedProgress: projectProgress },
      workItems: items.map((i) => ({ ...i, rolledUpProgress: rolled.get(i.id) ?? i.progressPercent, overdue: isOverdue(i.dueAt, i.status), isMilestone: i.type === 'MILESTONE' })),
      milestones,
      roles,
      baselines,
      dependencies,
    };
  }

  private projectSummary(p: any, progress: number) {
    return {
      tier: 'SUMMARY' as const,
      id: p.id,
      code: p.code,
      name: p.name,
      status: p.status,
      health: p.health,
      progressPercent: progress,
      plannedStart: p.plannedStart ?? null,
      plannedFinish: p.plannedFinish ?? null,
      forecastFinish: p.forecastFinish ?? null,
    };
  }

  private itemSummary(i: any, progress: number) {
    return {
      tier: 'SUMMARY' as const,
      id: i.id,
      title: i.title,
      type: i.type,
      isMilestone: i.type === 'MILESTONE',
      status: i.status,
      progressPercent: progress,
      plannedStart: i.plannedStart ?? null,
      dueAt: i.dueAt ?? null,
      overdue: isOverdue(i.dueAt, i.status),
      rolledUp: true,
    };
  }

  // ==========================================================================
  // Visibility (owner requirement #1) — CoordinationShare enforcement
  // ==========================================================================
  /**
   * Resolve an actor's tier over a project: FULL (owner/pm/sponsor/creator, a
   * FULL project-role member, or `work.view.full`), SUMMARY (a SUMMARY
   * CoordinationShare on the project, an OBSERVER/SUMMARY role, or
   * `work.view.summary`), else NONE.
   */
  async resolveAccess(tenantId: string, actorId: string, project: any): Promise<ProjectAccess> {
    if (!actorId) return 'NONE';
    if ([project.ownerId, project.projectManagerId, project.sponsorId, project.createdBy].includes(actorId)) return 'FULL';
    if (await this.hasPerm(actorId, 'work.view.full')) return 'FULL';
    const roles = await this.db.projectRoleAssignment.findMany({ where: { tenantId, projectId: project.id, subjectType: 'USER', subjectId: actorId } });
    if (roles.some((r) => r.visibilityTier === 'FULL')) return 'FULL';
    // Summary tier.
    const share = await this.db.coordinationShare.findFirst({
      where: { tenantId, scope: 'PROJECT', scopeId: project.id, audienceType: 'USER', audienceId: actorId },
    });
    if (share) return share.tier === 'FULL' ? 'FULL' : 'SUMMARY';
    if (roles.length) return 'SUMMARY'; // OBSERVER / SUMMARY-tier role
    if (await this.hasPerm(actorId, 'work.view.summary')) return 'SUMMARY';
    return 'NONE';
  }

  private async hasPerm(actorId: string, perm: string): Promise<boolean> {
    const decision = await this.prisma.withBypass(() => this.identity.can(actorId, perm));
    return decision.allowed;
  }

  /** Coordination Gantt read — parent summary bars rolled-up, children omitted at
   *  the SERVICE layer (never leaked). Requires SUMMARY or FULL access. */
  async coordinationGantt(tenantId: string, actorId: string, id: string) {
    const project = await this.load(tenantId, id);
    const access = await this.resolveAccess(tenantId, actorId, project);
    if (access === 'NONE') throw new NotFoundException(`project not found: ${id}`);
    const items = await this.projectItems(tenantId, id);
    const { rolled, projectProgress } = this.rollUp(project, items);
    const roots = items.filter((i) => !i.parentId);
    return {
      view: 'coordination',
      access,
      project: this.projectSummary(project, projectProgress),
      // SummaryWorkItemDTO bars ONLY — parents rolled-up, children absent.
      bars: roots.map((r) => this.itemSummary(r, rolled.get(r.id) ?? r.progressPercent)),
    };
  }

  // ==========================================================================
  // Portfolio cockpit (W3) — read-only roll-up across projects. RLS-scoped;
  // computes health/progress/overdue/blocked per project WITHOUT persisting.
  // ==========================================================================
  async portfolio(tenantId: string, filters: { status?: string; projectKind?: string } = {}) {
    const where: any = { tenantId };
    if (filters.status) where.status = String(filters.status).toUpperCase();
    if (filters.projectKind) where.projectKind = String(filters.projectKind).toUpperCase();
    const projects = await this.db.executionProject.findMany({ where, orderBy: { createdAt: 'desc' } });

    const byHealth: Record<string, number> = { GREEN: 0, YELLOW: 0, RED: 0, UNKNOWN: 0 };
    const byStatus: Record<string, number> = {};
    let totalOverdueItems = 0;
    let totalBlockedItems = 0;
    let totalOverdueMilestones = 0;
    let totalHighRisk = 0;

    const rowsOut = [] as any[];
    for (const project of projects) {
      const items = await this.projectItems(tenantId, project.id);
      const { projectProgress } = this.rollUp(project, items);
      const overdueItems = items.filter((i) => isOverdue(i.dueAt, i.status)).length;
      const blockedItems = items.filter((i) => i.status === 'BLOCKED').length;
      const milestones = items.filter((i) => i.type === 'MILESTONE');
      const overdueMilestones = milestones.filter((m) => isOverdue(m.dueAt, m.status)).length;
      const highRisk = items.filter((i) => i.status === 'BLOCKED' && ['HIGH', 'URGENT'].includes(i.priority)).length;

      const baseline = project.currentBaselineVersion
        ? await this.db.projectBaseline.findFirst({ where: { tenantId, projectId: project.id, version: project.currentBaselineVersion } })
        : null;
      let baselineFinish: Date | null = null;
      if (baseline) {
        const bitems = await this.db.baselineItem.findMany({ where: { tenantId, baselineId: baseline.id } });
        baselineFinish = bitems.reduce<Date | null>((max, b) => (b.dueAt && (!max || b.dueAt > max) ? b.dueAt : max), null);
      }
      const health = computeHealth({
        status: project.status,
        hasBaseline: !!baseline,
        baselineFinish,
        forecastFinish: project.forecastFinish,
        plannedFinish: project.plannedFinish,
        overdueItemCount: overdueItems,
        overdueMilestoneCount: overdueMilestones,
        blockedHighCount: highRisk,
      });

      byHealth[health] = (byHealth[health] ?? 0) + 1;
      byStatus[project.status] = (byStatus[project.status] ?? 0) + 1;
      totalOverdueItems += overdueItems;
      totalBlockedItems += blockedItems;
      totalOverdueMilestones += overdueMilestones;
      totalHighRisk += highRisk;

      rowsOut.push({
        id: project.id,
        code: project.code,
        name: project.name,
        status: project.status,
        projectKind: project.projectKind,
        health,
        progressPercent: projectProgress,
        itemCount: items.length,
        overdueItems,
        blockedItems,
        milestoneCount: milestones.length,
        overdueMilestones,
        highRisk,
        plannedFinish: project.plannedFinish,
        forecastFinish: project.forecastFinish,
      });
    }

    return {
      totals: {
        projects: projects.length,
        active: byStatus['ACTIVE'] ?? 0,
        byHealth,
        byStatus,
        overdueItems: totalOverdueItems,
        blockedItems: totalBlockedItems,
        overdueMilestones: totalOverdueMilestones,
        highRisk: totalHighRisk,
      },
      projects: rowsOut,
    };
  }

  // ==========================================================================
  // Dependencies (+ cycle guard)
  // ==========================================================================
  async listDependencies(tenantId: string, projectId?: string) {
    if (projectId) {
      const items = await this.db.nativeWorkItem.findMany({ where: { tenantId, projectId }, select: { id: true } });
      const ids = items.map((i) => i.id);
      return this.db.workDependency.findMany({ where: { tenantId, OR: [{ predecessorId: { in: ids } }, { successorId: { in: ids } }] }, orderBy: { createdAt: 'asc' } });
    }
    return this.db.workDependency.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
  }

  async addDependency(tenantId: string, actorId: string, body: { predecessorId?: string; successorId?: string; type?: string; lagMinutes?: number }) {
    const predecessorId = body.predecessorId;
    const successorId = body.successorId;
    if (!predecessorId || !successorId) throw new BadRequestException('predecessorId and successorId are required');
    if (predecessorId === successorId) throw new BadRequestException('self-dependency is not allowed');
    const type = String(body.type ?? 'FS').toUpperCase();
    if (!DEP_TYPES.includes(type)) throw new BadRequestException(`invalid dependency type ${type}`);

    const [pre, suc] = await Promise.all([
      this.db.nativeWorkItem.findFirst({ where: { id: predecessorId, tenantId } }),
      this.db.nativeWorkItem.findFirst({ where: { id: successorId, tenantId } }),
    ]);
    if (!pre) throw new BadRequestException(`predecessor not found: ${predecessorId}`);
    if (!suc) throw new BadRequestException(`successor not found: ${successorId}`);

    // Cycle guard: adding predecessor→successor is illegal if successor can
    // already reach predecessor through the existing dependency graph.
    if (await this.wouldCycle(tenantId, predecessorId, successorId)) {
      throw new ConflictException('dependency rejected: would create a cycle');
    }

    const existing = await this.db.workDependency.findFirst({ where: { tenantId, predecessorId, successorId, type } });
    if (existing) throw new ConflictException('dependency already exists');

    const dep = await this.db.workDependency.create({
      data: { tenantId, predecessorId, successorId, type, lagMinutes: body.lagMinutes ?? 0, createdBy: actorId },
    });
    return dep;
  }

  /** True if a path successor →…→ predecessor already exists (so adding
   *  predecessor→successor would close a cycle). BFS over the edge set. */
  private async wouldCycle(tenantId: string, predecessorId: string, successorId: string): Promise<boolean> {
    const edges = await this.db.workDependency.findMany({ where: { tenantId }, select: { predecessorId: true, successorId: true } });
    const adj = new Map<string, string[]>();
    for (const e of edges) {
      if (!adj.has(e.predecessorId)) adj.set(e.predecessorId, []);
      adj.get(e.predecessorId)!.push(e.successorId);
    }
    const seen = new Set<string>();
    const queue = [successorId];
    while (queue.length) {
      const node = queue.shift()!;
      if (node === predecessorId) return true;
      if (seen.has(node)) continue;
      seen.add(node);
      for (const nxt of adj.get(node) ?? []) queue.push(nxt);
    }
    return false;
  }

  async removeDependency(tenantId: string, actorId: string, depId: string) {
    const dep = await this.db.workDependency.findFirst({ where: { id: depId, tenantId } });
    if (!dep) throw new NotFoundException(`dependency not found: ${depId}`);
    await this.db.workDependency.delete({ where: { id: depId } });
    return { deleted: true, id: depId };
  }

  // ==========================================================================
  // Baseline (immutable versions)
  // ==========================================================================
  async createBaseline(tenantId: string, actorId: string, id: string, body: { label?: string; note?: string }) {
    const project = await this.load(tenantId, id);
    const last = await this.db.projectBaseline.findFirst({ where: { tenantId, projectId: id }, orderBy: { version: 'desc' } });
    const version = (last?.version ?? 0) + 1;
    const items = await this.projectItems(tenantId, id);

    const baseline = await this.db.projectBaseline.create({
      data: { tenantId, projectId: id, version, label: body.label ?? `v${version}`, note: body.note ?? null, createdBy: actorId },
    });
    if (items.length) {
      await this.db.baselineItem.createMany({
        data: items.map((i) => ({
          tenantId,
          baselineId: baseline.id,
          workItemId: i.id,
          plannedStart: i.plannedStart,
          dueAt: i.dueAt,
          weight: i.weight,
          progressPercent: i.progressPercent,
        })),
      });
    }
    const updated = await this.db.executionProject.update({ where: { id }, data: { currentBaselineVersion: version } });
    await this.event(tenantId, id, 'baseline', actorId, { version, itemCount: items.length, label: baseline.label });
    return { baseline, version, itemCount: items.length, project: updated };
  }

  /** Rebaseline = a NEW immutable version (never overwrites an existing one). */
  async rebaseline(tenantId: string, actorId: string, id: string, body: { label?: string; note?: string }) {
    await this.event(tenantId, id, 'rebaseline', actorId, { note: body.note ?? null });
    return this.createBaseline(tenantId, actorId, id, { label: body.label, note: body.note ?? 'rebaseline' });
  }

  async listBaselines(tenantId: string, id: string) {
    await this.load(tenantId, id);
    const baselines = await this.db.projectBaseline.findMany({ where: { tenantId, projectId: id }, orderBy: { version: 'desc' } });
    return baselines;
  }

  // ==========================================================================
  // Project roles (via AssignmentResolver snapshot)
  // ==========================================================================
  private selectorFor(body: any): Selector | null {
    const t = String(body.selectorType ?? '').toUpperCase();
    switch (t) {
      case 'POSITION':
        return { selectorType: 'POSITION', positionId: body.positionId, choicePolicy: 'MULTIPLE' };
      case 'ORG_UNIT_HEAD':
        return { selectorType: 'ORG_UNIT_HEAD', orgUnitId: body.orgUnitId, choicePolicy: 'MULTIPLE' };
      case 'GROUP':
        return { selectorType: 'GROUP', groupId: body.groupId, choicePolicy: 'MULTIPLE' };
      case 'ROLE':
        return { selectorType: 'ROLE', roleCode: body.roleCode, choicePolicy: 'MULTIPLE' };
      default:
        return null;
    }
  }

  async assignRole(tenantId: string, actorId: string, id: string, body: any) {
    await this.load(tenantId, id);
    const role = String(body.role ?? '').toUpperCase();
    if (!PROJECT_ROLES.includes(role)) throw new BadRequestException(`invalid role ${role} (one of ${PROJECT_ROLES.join('/')})`);
    let subjectType = String(body.subjectType ?? 'USER').toUpperCase();
    let subjectId = body.subjectId as string | undefined;
    let snapshot: any = { via: 'explicit', at: new Date().toISOString() };

    // A structured selector (incl. PROJECT_ROLE via Org selectors) resolves the
    // subject through the shared resolver — never hardcoded.
    const selector = this.selectorFor(body);
    if (selector) {
      const resolution = await this.assignment.resolveAndSnapshot({
        tenantId,
        workflowInstanceCode: `project-role:${id}`,
        nodeId: 'project-role-assign',
        selector,
        actorId,
      });
      const personIds = resolution.candidates.map((c) => c.personId);
      const userIds: string[] = [];
      for (const pid of personIds) userIds.push((await this.identity.userIdForPerson(pid)) ?? pid);
      if (!userIds.length) throw new BadRequestException(`role assign: selector resolved to 0 subjects (${selector.selectorType})`);
      subjectType = 'USER';
      subjectId = userIds[0];
      snapshot = { via: 'assignment-resolver', selector, resolvedPersonIds: personIds, subjectUserIds: userIds, reason: resolution.reason, at: new Date().toISOString() };
    }
    if (!subjectId) throw new BadRequestException('subjectId (or a resolvable selector) is required');

    const visibilityTier = role === 'OBSERVER' ? 'SUMMARY' : String(body.visibilityTier ?? 'FULL').toUpperCase();
    const assignment = await this.db.projectRoleAssignment.create({
      data: {
        tenantId,
        projectId: id,
        subjectType,
        subjectId,
        role,
        visibilityTier,
        assignmentSnapshot: snapshot as any,
        effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : null,
        effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
        createdBy: actorId,
      },
    });
    // Keep the PM/sponsor pointer in sync for the common single roles.
    if (role === 'PROJECT_MANAGER') await this.db.executionProject.update({ where: { id }, data: { projectManagerId: subjectId } });
    if (role === 'SPONSOR') await this.db.executionProject.update({ where: { id }, data: { sponsorId: subjectId } });
    await this.event(tenantId, id, 'role_assigned', actorId, { role, subjectType, subjectId, visibilityTier });
    return assignment;
  }

  async listRoles(tenantId: string, id: string) {
    await this.load(tenantId, id);
    return this.db.projectRoleAssignment.findMany({ where: { tenantId, projectId: id }, orderBy: { createdAt: 'asc' } });
  }

  // ==========================================================================
  // Coordination shares
  // ==========================================================================
  async createShare(tenantId: string, actorId: string, id: string, body: any) {
    await this.load(tenantId, id);
    const scope = String(body.scope ?? 'PROJECT').toUpperCase();
    if (!SHARE_SCOPES.includes(scope)) throw new BadRequestException(`invalid scope ${scope}`);
    const scopeId = body.scopeId ?? id;
    const audienceType = String(body.audienceType ?? 'USER').toUpperCase();
    const tier = String(body.tier ?? 'SUMMARY').toUpperCase();
    if (!['SUMMARY', 'FULL'].includes(tier)) throw new BadRequestException(`invalid tier ${tier}`);
    const share = await this.db.coordinationShare.create({
      data: { tenantId, scope, scopeId, audienceType, audienceId: body.audienceId ?? null, tier, createdBy: actorId },
    });
    await this.event(tenantId, id, 'share', actorId, { scope, scopeId, audienceType, audienceId: body.audienceId, tier });
    return share;
  }

  async listShares(tenantId: string, id: string) {
    await this.load(tenantId, id);
    return this.db.coordinationShare.findMany({ where: { tenantId, scope: 'PROJECT', scopeId: id }, orderBy: { createdAt: 'asc' } });
  }
}
