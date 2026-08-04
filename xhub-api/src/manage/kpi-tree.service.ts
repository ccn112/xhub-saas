import { Injectable, NotFoundException } from '@nestjs/common';
import { XofficePrismaService } from '../xoffice-prisma/xoffice-prisma.service';

/**
 * KPI tree (X.Office Management MG-03) — READ-ONLY projection layered on the
 * EXISTING MetricDefinition (Constitution #13: no 2nd/duplicate metric table).
 * Groups MetricDefinition rows by `perspective` (via any StrategicObjective
 * that links the metric) and computes a derived RAG status from the latest
 * MetricObservation + threshold + freshness. Values are read, never written
 * here (#12) — this service issues no writes to MetricObservation.
 */
@Injectable()
export class KpiTreeService {
  constructor(private readonly prisma: XofficePrismaService) {}
  private get db() {
    return this.prisma.db;
  }

  private ragFor(metric: any, obs: any): 'GREEN' | 'YELLOW' | 'RED' | 'STALE' | 'UNKNOWN' {
    if (!obs) return 'UNKNOWN';
    if (metric.freshnessSlaMinutes) {
      const ageMin = (Date.now() - new Date(obs.computedAt).getTime()) / 60000;
      if (ageMin > metric.freshnessSlaMinutes) return 'STALE';
    }
    const v = obs.value;
    if (metric.thresholdRed != null) {
      const bad = metric.direction === 'DOWN' ? v >= metric.thresholdRed : v <= metric.thresholdRed;
      if (bad) return 'RED';
    }
    if (metric.thresholdAmber != null) {
      const warn = metric.direction === 'DOWN' ? v >= metric.thresholdAmber : v <= metric.thresholdAmber;
      if (warn) return 'YELLOW';
    }
    return 'GREEN';
  }

  /**
   * GET /api/manage/kpis?objectiveId= — the tree: for each StrategicObjective
   * (optionally filtered to one), list its linked MetricDefinition rows as KPI
   * nodes with derived status. Grouped by perspective for the tree view.
   */
  async tree(tenantId: string, filter: { objectiveId?: string } = {}) {
    const objectives = await this.db.strategicObjective.findMany({
      where: { tenantId, ...(filter.objectiveId ? { id: filter.objectiveId } : {}) },
      orderBy: [{ code: 'asc' }],
    });
    const metricIds = [...new Set(objectives.flatMap((o) => o.linkedMetricIds))];
    const metrics = metricIds.length
      ? await this.db.metricDefinition.findMany({ where: { tenantId, id: { in: metricIds } } })
      : [];
    const metricById = new Map(metrics.map((m) => [m.id, m]));
    const latestByMetric = new Map<string, any>();
    for (const m of metrics) {
      const obs = await this.db.metricObservation.findFirst({ where: { tenantId, metricId: m.id }, orderBy: [{ periodStart: 'desc' }] });
      latestByMetric.set(m.id, obs ?? null);
    }

    const perspectives = new Map<string, any[]>();
    for (const o of objectives) {
      const key = o.perspective ?? 'UNASSIGNED';
      const nodes = (o.linkedMetricIds ?? [])
        .map((mid) => metricById.get(mid))
        .filter(Boolean)
        .map((m: any) => {
          const obs = latestByMetric.get(m.id);
          return {
            metricCode: m.code,
            metricId: m.id,
            name: m.name,
            unit: m.unit,
            direction: m.direction,
            objectiveId: o.id,
            objectiveCode: o.code,
            baseline: m.baseline,
            target: m.target,
            thresholdRed: m.thresholdRed,
            thresholdAmber: m.thresholdAmber,
            value: obs?.value ?? null,
            observedAt: obs?.computedAt ?? null,
            status: this.ragFor(m, obs),
          };
        });
      if (!perspectives.has(key)) perspectives.set(key, []);
      perspectives.get(key)!.push(...nodes);
    }

    const groups = [...perspectives.entries()].map(([perspective, kpis]) => {
      const redCount = kpis.filter((k) => k.status === 'RED').length;
      const staleCount = kpis.filter((k) => k.status === 'STALE').length;
      return { perspective, kpis, redCount, staleCount, count: kpis.length };
    });
    return { groups, totalKpis: metrics.length };
  }

  /** GET /api/manage/kpis/:metricCode/series — time series from MetricObservation (read model). */
  async series(tenantId: string, metricCode: string) {
    const metric = await this.db.metricDefinition.findFirst({ where: { tenantId, code: metricCode } });
    if (!metric) throw new NotFoundException(`metric not found: ${metricCode}`);
    const observations = await this.db.metricObservation.findMany({
      where: { tenantId, metricId: metric.id },
      orderBy: [{ periodStart: 'asc' }],
    });
    return { metric, observations };
  }
}
