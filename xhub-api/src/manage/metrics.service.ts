import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { METRIC_DIRECTIONS, METRIC_SOURCE_SYSTEMS } from './manage.constants';

/**
 * MetricDefinition + MetricObservation (X.Office Management — MG-01).
 *
 * SoR split (#5/#12): the DEFINITION (formula/owner/thresholds) is Mgmt-owned;
 * the VALUE is a READ MODEL — never hand-entered for a real source. For
 * `sourceSystem = XOFFICE_WORK` the value is COMPUTED here by querying the
 * EXISTING NativeWorkItem data (the one real connector today). No dual-write,
 * no direct external DB (FinERP/X2-BMS stay mock). When a real connector lands
 * later, only this compute method changes — the MetricObservation contract holds.
 */
@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}
  private get db() {
    return this.prisma.db;
  }

  async list(tenantId: string, filter: { sourceSystem?: string } = {}) {
    const items = await this.db.metricDefinition.findMany({
      where: { tenantId, ...(filter.sourceSystem ? { sourceSystem: filter.sourceSystem } : {}) },
      orderBy: [{ code: 'asc' }],
    });
    return { items, count: items.length };
  }

  async get(tenantId: string, id: string) {
    const m = await this.db.metricDefinition.findFirst({ where: { id, tenantId } });
    if (!m) throw new NotFoundException(`metric not found: ${id}`);
    return m;
  }

  async create(tenantId: string, actorId: string, body: any) {
    if (!body?.code) throw new BadRequestException('code is required');
    if (!body?.name) throw new BadRequestException('name is required');
    if (!body?.formula) throw new BadRequestException('formula is required');
    if (!body?.unit) throw new BadRequestException('unit is required');
    const direction = (body.direction ?? 'UP').toUpperCase();
    if (!METRIC_DIRECTIONS.includes(direction)) throw new BadRequestException(`invalid direction ${direction}`);
    const sourceSystem = (body.sourceSystem ?? 'MANUAL').toUpperCase();
    if (!METRIC_SOURCE_SYSTEMS.includes(sourceSystem)) throw new BadRequestException(`invalid sourceSystem ${sourceSystem}`);
    if (!body?.frequency) throw new BadRequestException('frequency is required');
    const m = await this.db.metricDefinition.create({
      data: {
        tenantId,
        code: body.code,
        name: body.name,
        description: body.description ?? null,
        formula: body.formula,
        formulaVersion: body.formulaVersion ?? 'v1',
        unit: body.unit,
        direction,
        ownerId: body.ownerId ?? actorId,
        dataStewardId: body.dataStewardId ?? null,
        sourceSystem,
        frequency: body.frequency,
        freshnessSlaMinutes: body.freshnessSlaMinutes ?? null,
        classification: body.classification ?? null,
        baseline: body.baseline ?? null,
        target: body.target ?? null,
        thresholdRed: body.thresholdRed ?? null,
        thresholdAmber: body.thresholdAmber ?? null,
        dimensions: body.dimensions ?? undefined,
        createdBy: actorId,
      },
    });
    return m;
  }

  // ---- observation read model (#12) ----------------------------------------

  /**
   * Compute the observation VALUE for a metric over [periodStart, periodEnd) from
   * the certified read model of its sourceSystem. Only XOFFICE_WORK is real today
   * (computed off NativeWorkItem). Returns { value, source, confidence, detail }.
   *
   * XOFFICE_WORK / "Tỷ lệ cam kết đúng hạn" (on-time rate): among the tenant's
   * NativeWorkItems that carry a dueAt and are not CANCELLED, the share that are
   * NOT overdue. Overdue = dueAt < asOf AND status not in (DONE, CANCELLED).
   * A companion "overdueCount" is surfaced in detail for the exception view.
   *
   * PUBLIC because it is the ONE on-time definition in the platform: the IOC
   * command centre (IocInsightsService) reuses this exact method rather than
   * inventing a second SLA number (#12 — one read model, one formula).
   */
  async computeFromWork(tenantId: string, asOf: Date) {
    const items = await this.db.nativeWorkItem.findMany({
      where: { tenantId, status: { not: 'CANCELLED' }, dueAt: { not: null } },
      select: { id: true, status: true, dueAt: true },
    });
    const total = items.length;
    const overdue = items.filter(
      (it) => it.dueAt && it.dueAt < asOf && it.status !== 'DONE' && it.status !== 'CANCELLED',
    ).length;
    const onTime = total - overdue;
    const value = total > 0 ? Math.round((onTime / total) * 1000) / 10 : 100;
    return {
      value,
      source: 'XOFFICE_WORK',
      confidence: total > 0 ? 1 : 0.5,
      detail: { totalWithDue: total, overdueCount: overdue, onTimeCount: onTime },
    };
  }

  /**
   * Trigger a compute for the metric's current period and upsert the observation
   * (idempotent per [tenant, metric, period]), then return the observation series
   * newest-first. For non-XOFFICE_WORK (mock) sources nothing is computed — the
   * existing observations (if any) are returned as-is (never fabricated).
   */
  async observations(tenantId: string, metricId: string, opts: { compute?: boolean } = {}) {
    const metric = await this.db.metricDefinition.findFirst({ where: { id: metricId, tenantId } });
    if (!metric) throw new NotFoundException(`metric not found: ${metricId}`);

    if ((opts.compute ?? true) && metric.sourceSystem === 'XOFFICE_WORK') {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const computed = await this.computeFromWork(tenantId, now);
      await this.db.metricObservation.upsert({
        where: { tenantId_metricId_periodStart_periodEnd: { tenantId, metricId, periodStart, periodEnd } },
        create: {
          tenantId,
          metricId,
          periodStart,
          periodEnd,
          value: computed.value,
          source: computed.source,
          confidence: computed.confidence,
        },
        update: { value: computed.value, source: computed.source, confidence: computed.confidence, computedAt: new Date() },
      });
    }

    const observations = await this.db.metricObservation.findMany({
      where: { tenantId, metricId },
      orderBy: [{ periodStart: 'desc' }],
    });
    return { metric, observations, latest: observations[0] ?? null };
  }
}
