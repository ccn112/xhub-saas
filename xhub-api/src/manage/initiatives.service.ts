import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { XofficePrismaService } from '../xoffice-prisma/xoffice-prisma.service';
import { INITIATIVE_GATE_ORDER, INITIATIVE_STATUSES } from './manage.constants';

/**
 * Initiative — MG-04 Portfolio & Benefit. LINK layer only: `executionProjectId`
 * points at an EXISTING ExecutionProject (Work v2) — this service NEVER
 * creates/updates a project, milestone, or task. Progress/health shown to the
 * caller are always read straight off ExecutionProject (a snapshot at read
 * time, not cached/duplicated here) so there is exactly one source of truth
 * (#12 — no dual-write, no second PM engine).
 */
@Injectable()
export class InitiativesService {
  constructor(private readonly prisma: XofficePrismaService) {}
  private get db() {
    return this.prisma.db;
  }

  private async audit(tenantId: string, code: string, action: string, actorId: string, data: Record<string, unknown> = {}) {
    await this.db.auditLog.create({
      data: { tenantId, instanceCode: code, actorId, action: `manage.initiative.${action}`, detail: JSON.stringify(data).slice(0, 500), at: new Date() },
    });
  }

  /** Attach the linked ExecutionProject's read-only status/health/progress (null if not yet linked). */
  private async decorate(initiative: any) {
    if (!initiative.executionProjectId) return { ...initiative, delivery: null };
    const project = await this.db.executionProject.findFirst({
      where: { id: initiative.executionProjectId },
      select: { id: true, code: true, name: true, status: true, health: true, progressPercent: true, plannedFinish: true, forecastFinish: true },
    });
    return { ...initiative, delivery: project ?? null };
  }

  async list(tenantId: string, filter: { status?: string; portfolioId?: string } = {}) {
    let itemIds: string[] | undefined;
    if (filter.portfolioId) {
      const portfolio = await this.db.portfolio.findFirst({ where: { id: filter.portfolioId, tenantId } });
      if (!portfolio) throw new NotFoundException(`portfolio not found: ${filter.portfolioId}`);
      itemIds = portfolio.itemIds;
    }
    const items = await this.db.initiative.findMany({
      where: {
        tenantId,
        ...(filter.status ? { status: filter.status } : {}),
        ...(itemIds ? { id: { in: itemIds.length ? itemIds : ['__none__'] } } : {}),
      },
      orderBy: [{ code: 'asc' }],
    });
    const decorated = await Promise.all(items.map((i: any) => this.decorate(i)));
    return { items: decorated, count: decorated.length };
  }

  async get(tenantId: string, id: string) {
    const initiative = await this.db.initiative.findFirst({ where: { id, tenantId } });
    if (!initiative) throw new NotFoundException(`initiative not found: ${id}`);
    return this.decorate(initiative);
  }

  async create(tenantId: string, actorId: string, body: any) {
    if (!body?.code) throw new BadRequestException('code is required');
    if (!body?.name) throw new BadRequestException('name is required');
    if (!Array.isArray(body?.strategicObjectiveIds) || body.strategicObjectiveIds.length === 0) {
      throw new BadRequestException('strategicObjectiveIds must have at least 1 entry');
    }
    const initiative = await this.db.initiative.create({
      data: {
        tenantId,
        code: body.code,
        name: body.name,
        description: body.description ?? null,
        ownerId: body.ownerId ?? actorId,
        sponsorId: body.sponsorId ?? null,
        status: 'INTAKE',
        strategicObjectiveIds: body.strategicObjectiveIds,
        expectedBenefits: body.expectedBenefits ?? [],
        createdBy: actorId,
      },
    });
    await this.audit(tenantId, initiative.code, 'create', actorId, { id: initiative.id });
    return this.decorate(initiative);
  }

  async update(tenantId: string, actorId: string, id: string, body: any) {
    const existing = await this.db.initiative.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException(`initiative not found: ${id}`);
    const updated = await this.db.initiative.update({
      where: { id },
      data: {
        name: body.name ?? undefined,
        description: body.description ?? undefined,
        ownerId: body.ownerId ?? undefined,
        sponsorId: body.sponsorId ?? undefined,
        strategicObjectiveIds: body.strategicObjectiveIds ?? undefined,
        expectedBenefits: body.expectedBenefits ?? undefined,
        prioritization: body.prioritization ?? undefined,
      },
    });
    await this.audit(tenantId, updated.code, 'update', actorId, { id });
    return this.decorate(updated);
  }

  /** Stage-gate transition — the ONLY way Initiative.status changes. Audited. */
  async gate(tenantId: string, actorId: string, id: string, body: any) {
    const initiative = await this.db.initiative.findFirst({ where: { id, tenantId } });
    if (!initiative) throw new NotFoundException(`initiative not found: ${id}`);
    const to = String(body?.status ?? '').toUpperCase();
    if (!INITIATIVE_STATUSES.includes(to as any)) throw new BadRequestException(`invalid status ${to}`);
    const allowed = INITIATIVE_GATE_ORDER[initiative.status] ?? [];
    if (!allowed.includes(to)) {
      throw new ConflictException({ code: 'INVALID_GATE_TRANSITION', message: `cannot go ${initiative.status} → ${to}` });
    }
    const updated = await this.db.initiative.update({ where: { id }, data: { status: to } });
    await this.audit(tenantId, updated.code, 'gate', actorId, { from: initiative.status, to, note: body?.note });
    return this.decorate(updated);
  }

  /**
   * Attach an EXISTING ExecutionProject — never creates one. 404 if the id
   * doesn't resolve to a real project in this tenant (link-only, #17).
   */
  async linkProject(tenantId: string, actorId: string, id: string, body: any) {
    const initiative = await this.db.initiative.findFirst({ where: { id, tenantId } });
    if (!initiative) throw new NotFoundException(`initiative not found: ${id}`);
    const executionProjectId = body?.executionProjectId;
    if (!executionProjectId) throw new BadRequestException('executionProjectId is required');
    const project = await this.db.executionProject.findFirst({ where: { id: executionProjectId, tenantId } });
    if (!project) throw new NotFoundException(`execution project not found: ${executionProjectId}`);
    const updated = await this.db.initiative.update({ where: { id }, data: { executionProjectId } });
    await this.audit(tenantId, updated.code, 'link-project', actorId, { executionProjectId });
    return this.decorate(updated);
  }

  /** Read-only proxy to the linked ExecutionProject — never writes Work data. */
  async delivery(tenantId: string, id: string) {
    const initiative = await this.db.initiative.findFirst({ where: { id, tenantId } });
    if (!initiative) throw new NotFoundException(`initiative not found: ${id}`);
    if (!initiative.executionProjectId) return { linked: false, project: null };
    const project = await this.db.executionProject.findFirst({ where: { id: initiative.executionProjectId, tenantId } });
    return { linked: true, project };
  }

  async benefits(tenantId: string, id: string) {
    const initiative = await this.db.initiative.findFirst({ where: { id, tenantId } });
    if (!initiative) throw new NotFoundException(`initiative not found: ${id}`);
    const items = await this.db.benefitProfile.findMany({ where: { tenantId, initiativeId: id } });
    return { items, count: items.length };
  }
}
