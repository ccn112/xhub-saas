import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { XofficePrismaService } from '../xoffice-prisma/xoffice-prisma.service';

/**
 * BenefitProfile — MG-04. `status` is ALWAYS derived by this service from
 * `realizationSchedule` vs the metric's ACTUAL MetricObservation — never
 * accepted as input on create/update (#12: a certified metric's value is
 * never hand-entered, and neither is the benefit status computed from it).
 */
@Injectable()
export class BenefitProfilesService {
  constructor(private readonly prisma: XofficePrismaService) {}
  private get db() {
    return this.prisma.db;
  }

  private async audit(tenantId: string, id: string, action: string, actorId: string) {
    await this.db.auditLog.create({
      data: { tenantId, instanceCode: id, actorId, action: `manage.benefit.${action}`, detail: '', at: new Date() },
    });
  }

  private async realizationFor(tenantId: string, profile: any) {
    if (!profile.metricCode) {
      return { status: 'PLANNED', latestValue: null, latestPeriodEnd: null, metric: null };
    }
    const metric = await this.db.metricDefinition.findFirst({ where: { tenantId, code: profile.metricCode } });
    if (!metric) {
      return { status: 'PLANNED', latestValue: null, latestPeriodEnd: null, metric: null };
    }
    const latest = await this.db.metricObservation.findFirst({
      where: { tenantId, metricId: metric.id },
      orderBy: { periodEnd: 'desc' },
    });
    if (!latest) {
      return { status: 'PLANNED', latestValue: null, latestPeriodEnd: null, metric: { code: metric.code, direction: metric.direction } };
    }
    let status: 'TRACKING' | 'REALIZED' | 'MISSED' = 'TRACKING';
    if (profile.target != null) {
      const reached = metric.direction === 'DOWN' ? latest.value <= profile.target : latest.value >= profile.target;
      if (reached) {
        status = 'REALIZED';
      } else {
        const schedule: any[] = Array.isArray(profile.realizationSchedule) ? profile.realizationSchedule : [];
        const overdue = schedule.some((s) => s?.dueAt && new Date(s.dueAt) < new Date());
        status = overdue ? 'MISSED' : 'TRACKING';
      }
    }
    return { status, latestValue: latest.value, latestPeriodEnd: latest.periodEnd, metric: { code: metric.code, direction: metric.direction } };
  }

  private async decorate(tenantId: string, profile: any) {
    const realization = await this.realizationFor(tenantId, profile);
    if (realization.status !== profile.status) {
      profile = await this.db.benefitProfile.update({ where: { id: profile.id }, data: { status: realization.status } });
    }
    return { ...profile, realization };
  }

  async list(tenantId: string, initiativeId?: string) {
    const items = await this.db.benefitProfile.findMany({
      where: { tenantId, ...(initiativeId ? { initiativeId } : {}) },
      orderBy: [{ createdAt: 'asc' }],
    });
    const decorated = await Promise.all(items.map((i: any) => this.decorate(tenantId, i)));
    return { items: decorated, count: decorated.length };
  }

  async get(tenantId: string, id: string) {
    const profile = await this.db.benefitProfile.findFirst({ where: { id, tenantId } });
    if (!profile) throw new NotFoundException(`benefit profile not found: ${id}`);
    return this.decorate(tenantId, profile);
  }

  async create(tenantId: string, actorId: string, body: any) {
    if (!body?.initiativeId) throw new BadRequestException('initiativeId is required');
    const initiative = await this.db.initiative.findFirst({ where: { id: body.initiativeId, tenantId } });
    if (!initiative) throw new NotFoundException(`initiative not found: ${body.initiativeId}`);
    if (!body?.benefitName) throw new BadRequestException('benefitName is required');
    if (!body?.unit) throw new BadRequestException('unit is required');
    const profile = await this.db.benefitProfile.create({
      data: {
        tenantId,
        initiativeId: body.initiativeId,
        benefitName: body.benefitName,
        unit: body.unit,
        baseline: body.baseline ?? null,
        target: body.target ?? null,
        metricCode: body.metricCode ?? null,
        ownerId: body.ownerId ?? actorId,
        realizationSchedule: body.realizationSchedule ?? [],
        status: 'PLANNED',
        createdBy: actorId,
      },
    });
    await this.audit(tenantId, profile.id, 'create', actorId);
    return this.decorate(tenantId, profile);
  }

  async update(tenantId: string, actorId: string, id: string, body: any) {
    const existing = await this.db.benefitProfile.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException(`benefit profile not found: ${id}`);
    const updated = await this.db.benefitProfile.update({
      where: { id },
      data: {
        benefitName: body.benefitName ?? undefined,
        unit: body.unit ?? undefined,
        baseline: body.baseline ?? undefined,
        target: body.target ?? undefined,
        metricCode: body.metricCode ?? undefined,
        ownerId: body.ownerId ?? undefined,
        realizationSchedule: body.realizationSchedule ?? undefined,
      },
    });
    await this.audit(tenantId, updated.id, 'update', actorId);
    return this.decorate(tenantId, updated);
  }

  async realization(tenantId: string, id: string) {
    const profile = await this.db.benefitProfile.findFirst({ where: { id, tenantId } });
    if (!profile) throw new NotFoundException(`benefit profile not found: ${id}`);
    return this.realizationFor(tenantId, profile);
  }
}
