import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OBJECTIVE_STATUSES } from './manage.constants';

/**
 * StrategicObjective aggregate (X.Office Management — MG-01). Mgmt-owned SoR:
 * a strategic direction the tenant steers by — DISTINCT from a Directive and
 * from a KPI (#3). Runs inside the caller's withTenant(tenantId) context
 * (TenantScopeInterceptor) so every read/write is RLS-scoped; the in-code
 * tenantId filter is belt-and-suspenders with RLS.
 */
@Injectable()
export class ObjectivesService {
  constructor(private readonly prisma: PrismaService) {}
  private get db() {
    return this.prisma.db;
  }

  private async audit(tenantId: string, code: string, action: string, actorId: string, data: Record<string, unknown> = {}) {
    await this.db.auditLog.create({
      data: {
        tenantId,
        instanceCode: code,
        actorId,
        action: `manage.objective.${action}`,
        detail: JSON.stringify(data).slice(0, 500),
        at: new Date(),
      },
    });
  }

  async list(tenantId: string, filter: { status?: string; ownerId?: string } = {}) {
    const items = await this.db.strategicObjective.findMany({
      where: {
        tenantId,
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.ownerId ? { ownerId: filter.ownerId } : {}),
      },
      orderBy: [{ code: 'asc' }],
    });
    return { items, count: items.length };
  }

  async get(tenantId: string, id: string) {
    const obj = await this.db.strategicObjective.findFirst({ where: { id, tenantId } });
    if (!obj) throw new NotFoundException(`objective not found: ${id}`);
    // Resolve linked metric definitions (references, not embedded) for the detail view.
    const metrics = obj.linkedMetricIds.length
      ? await this.db.metricDefinition.findMany({ where: { tenantId, id: { in: obj.linkedMetricIds } } })
      : [];
    return { ...obj, linkedMetrics: metrics };
  }

  async create(tenantId: string, actorId: string, body: any) {
    if (!body?.code) throw new BadRequestException('code is required');
    if (!body?.name) throw new BadRequestException('name is required');
    const status = (body.status ?? 'DRAFT').toUpperCase();
    if (!OBJECTIVE_STATUSES.includes(status)) {
      throw new BadRequestException(`invalid status ${status} (one of ${OBJECTIVE_STATUSES.join('/')})`);
    }
    const obj = await this.db.strategicObjective.create({
      data: {
        tenantId,
        code: body.code,
        name: body.name,
        description: body.description ?? null,
        perspective: body.perspective ?? null,
        ownerId: body.ownerId ?? actorId,
        status,
        reviewCadence: body.reviewCadence ?? null,
        parentObjectiveId: body.parentObjectiveId ?? null,
        linkedMetricIds: body.linkedMetricIds ?? [],
        linkedInitiativeIds: body.linkedInitiativeIds ?? [],
        createdBy: actorId,
      },
    });
    await this.audit(tenantId, obj.code, 'create', actorId, { id: obj.id });
    return obj;
  }

  async update(tenantId: string, actorId: string, id: string, body: any) {
    const existing = await this.db.strategicObjective.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException(`objective not found: ${id}`);
    if (body.status) {
      const status = String(body.status).toUpperCase();
      if (!OBJECTIVE_STATUSES.includes(status as any)) throw new BadRequestException(`invalid status ${status}`);
      body.status = status;
    }
    const obj = await this.db.strategicObjective.update({
      where: { id },
      data: {
        name: body.name ?? undefined,
        description: body.description ?? undefined,
        perspective: body.perspective ?? undefined,
        ownerId: body.ownerId ?? undefined,
        status: body.status ?? undefined,
        reviewCadence: body.reviewCadence ?? undefined,
        linkedMetricIds: body.linkedMetricIds ?? undefined,
        linkedInitiativeIds: body.linkedInitiativeIds ?? undefined,
      },
    });
    await this.audit(tenantId, obj.code, 'update', actorId, { id });
    return obj;
  }
}
