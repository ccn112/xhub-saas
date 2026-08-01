import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface Perspective {
  code: string;
  name: string;
  objectiveIds: string[];
}

/**
 * Scorecard (BSC) — X.Office Management MG-03. A strategy MAP over 4(+) BSC
 * perspectives; perspectives[].objectiveIds REFERENCES StrategicObjective.id
 * only (no embedded KPI values, per scorecard.schema.json / design doc §2.1).
 *
 * Constitution #5: the rollup returned by get() is a WORST-OF status per
 * perspective (never a single blended average) — a RED KPI on any linked
 * objective always surfaces, it is never hidden by averaging with GREEN ones.
 */
@Injectable()
export class ScorecardsService {
  constructor(private readonly prisma: PrismaService) {}
  private get db() {
    return this.prisma.db;
  }

  private validatePerspectives(perspectives: unknown): Perspective[] {
    if (!Array.isArray(perspectives) || perspectives.length === 0) {
      throw new BadRequestException('perspectives must be a non-empty array');
    }
    return perspectives.map((p: any, i: number) => {
      if (!p?.code) throw new BadRequestException(`perspectives[${i}].code is required`);
      if (!p?.name) throw new BadRequestException(`perspectives[${i}].name is required`);
      return { code: p.code, name: p.name, objectiveIds: Array.isArray(p.objectiveIds) ? p.objectiveIds : [] };
    });
  }

  async list(tenantId: string, filter: { period?: string } = {}) {
    const items = await this.db.scorecard.findMany({
      where: { tenantId, ...(filter.period ? { period: filter.period } : {}) },
      orderBy: [{ period: 'desc' }],
    });
    return { items, count: items.length };
  }

  /**
   * Resolve each perspective's objectiveIds → StrategicObjective (+ its linked
   * MetricDefinition → latest MetricObservation → RAG status vs threshold) and
   * compute a WORST-OF rollup per perspective. No blended score is returned.
   */
  async get(tenantId: string, id: string) {
    const sc = await this.db.scorecard.findFirst({ where: { id, tenantId } });
    if (!sc) throw new NotFoundException(`scorecard not found: ${id}`);

    const perspectives = (sc.perspectives as unknown as Perspective[]) ?? [];
    const allObjectiveIds = [...new Set(perspectives.flatMap((p) => p.objectiveIds))];
    const objectives = allObjectiveIds.length
      ? await this.db.strategicObjective.findMany({ where: { tenantId, id: { in: allObjectiveIds } } })
      : [];
    const objectiveById = new Map(objectives.map((o) => [o.id, o]));

    const metricIds = [...new Set(objectives.flatMap((o) => o.linkedMetricIds))];
    const metrics = metricIds.length
      ? await this.db.metricDefinition.findMany({ where: { tenantId, id: { in: metricIds } } })
      : [];
    const metricById = new Map(metrics.map((m) => [m.id, m]));
    const latestObs = new Map<string, any>();
    for (const m of metrics) {
      const obs = await this.db.metricObservation.findFirst({
        where: { tenantId, metricId: m.id },
        orderBy: [{ periodStart: 'desc' }],
      });
      if (obs) latestObs.set(m.id, obs);
    }

    function ragForMetric(metricId: string): 'GREEN' | 'YELLOW' | 'RED' | 'STALE' | 'UNKNOWN' {
      const m = metricById.get(metricId);
      const obs = latestObs.get(metricId);
      if (!m || !obs) return 'UNKNOWN';
      if (m.freshnessSlaMinutes) {
        const ageMin = (Date.now() - new Date(obs.computedAt).getTime()) / 60000;
        if (ageMin > m.freshnessSlaMinutes) return 'STALE';
      }
      const v = obs.value;
      if (m.thresholdRed != null) {
        const bad = m.direction === 'DOWN' ? v >= m.thresholdRed : v <= m.thresholdRed;
        if (bad) return 'RED';
      }
      if (m.thresholdAmber != null) {
        const warn = m.direction === 'DOWN' ? v >= m.thresholdAmber : v <= m.thresholdAmber;
        if (warn) return 'YELLOW';
      }
      return 'GREEN';
    }

    const WORST_ORDER = ['RED', 'STALE', 'YELLOW', 'UNKNOWN', 'GREEN'];
    const perspectiveViews = perspectives.map((p) => {
      const objs = p.objectiveIds.map((oid) => {
        const o = objectiveById.get(oid);
        const kpis = (o?.linkedMetricIds ?? []).map((mid) => ({
          metricId: mid,
          metricCode: metricById.get(mid)?.code,
          rag: ragForMetric(mid),
          value: latestObs.get(mid)?.value ?? null,
        }));
        return o ? { ...o, kpis } : { id: oid, missing: true, kpis: [] };
      });
      const allRag = objs.flatMap((o: any) => o.kpis.map((k: any) => k.rag));
      const worst = WORST_ORDER.find((r) => allRag.includes(r)) ?? 'UNKNOWN';
      const redItems = objs.flatMap((o: any) => o.kpis.filter((k: any) => k.rag === 'RED').map((k: any) => ({ objectiveId: o.id, ...k })));
      return { code: p.code, name: p.name, objectives: objs, rollup: worst, redItems };
    });

    return { ...sc, perspectiveViews };
  }

  async create(tenantId: string, actorId: string, body: any) {
    if (!body?.name) throw new BadRequestException('name is required');
    if (!body?.period) throw new BadRequestException('period is required');
    const perspectives = this.validatePerspectives(body.perspectives);
    const sc = await this.db.scorecard.create({
      data: { tenantId, name: body.name, period: body.period, perspectives: perspectives as any, createdBy: actorId },
    });
    return sc;
  }

  async update(tenantId: string, actorId: string, id: string, body: any) {
    const existing = await this.db.scorecard.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException(`scorecard not found: ${id}`);
    const perspectives = body.perspectives ? this.validatePerspectives(body.perspectives) : undefined;
    const sc = await this.db.scorecard.update({
      where: { id },
      data: {
        name: body.name ?? undefined,
        period: body.period ?? undefined,
        perspectives: (perspectives as any) ?? undefined,
      },
    });
    return sc;
  }
}
