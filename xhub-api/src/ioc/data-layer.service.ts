import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  BANNED_ENTITY_PATTERNS,
  REFRESH_POLICIES,
  TIME_WINDOWS,
  VISUAL_MODES,
  ZONE_STATES,
  catalogSummary,
  findEntity,
  type AggOp,
  type CatalogEntity,
  type CatalogField,
  type Operator,
} from './ioc.catalog';

/**
 * IOC governed data layer (DT-03).
 *
 * Constitution #6: the frontend NEVER sends SQL, a Prisma filter, or an
 * unregistered field. A DataLayerDefinition holds only catalog references; this
 * service compiles them into a Prisma `where` and executes it against the
 * EXISTING entity, read-only. Anything the catalog does not declare is a 400.
 *
 * Constitution #1/#2: no entity here is owned by IOC. NativeWorkItem and
 * ExecutionProject belong to Work v2, Position/OrgUnit to Identity/Org,
 * MetricObservation to the Management OS. The engine never writes them.
 *
 * Constitution #7 + AT-006/AT-012: results are DEPARTMENT-AGGREGATE by default.
 * Individual rows require BOTH `ioc.people.detail` AND an explicit
 * scope=individual, and are audited. The request is REFUSED (not filtered) when
 * the permission is absent, so no individual row ever leaves the process.
 */

export interface ExecOptions {
  scope?: 'aggregate' | 'individual';
  /** permission keys the caller holds (from the identity/permission guard) */
  permissions?: string[];
  orgUnitIds?: string[];
}

interface CompiledFilter {
  field: CatalogField;
  operator: Operator;
  value: unknown;
}

@Injectable()
export class DataLayerService {
  constructor(private readonly prisma: PrismaService) {}
  private get db() {
    return this.prisma.db;
  }

  private async audit(tenantId: string, code: string, action: string, actorId: string, data: Record<string, unknown> = {}) {
    await this.db.auditLog.create({
      data: { tenantId, instanceCode: code, actorId, action: `ioc.${action}`, detail: JSON.stringify(data).slice(0, 500), at: new Date() },
    });
  }

  // ---- validation ------------------------------------------------------------

  /** AT-005 + AT-012: the ONLY gate through which an entityKey may pass. */
  private assertEntity(entityKey: unknown): CatalogEntity {
    if (typeof entityKey !== 'string' || !entityKey) throw new BadRequestException('entityKey is required');
    for (const re of BANNED_ENTITY_PATTERNS) {
      if (re.test(entityKey)) {
        throw new ForbiddenException(
          `entityKey "${entityKey}" is permanently banned: camera / attendance / biometric / presence data may not be used as an IOC metric (AT-012, DT-08 not approved)`,
        );
      }
    }
    const entity = findEntity(entityKey);
    if (!entity) throw new BadRequestException(`unregistered entityKey "${entityKey}" — not in the IOC catalog`);
    return entity;
  }

  /** Compile a query definition against the catalog. Throws on anything unknown. */
  private compileQuery(entity: CatalogEntity, query: any): { filters: CompiledFilter[]; timeWindow: string; groupBy: string[] } {
    const q = query ?? {};
    const rawFilters = Array.isArray(q.filters) ? q.filters : [];
    if (rawFilters.length > 20) throw new BadRequestException('too many filters (max 20)');
    const filters: CompiledFilter[] = rawFilters.map((f: any, i: number) => {
      if (!f || typeof f.field !== 'string') throw new BadRequestException(`filters[${i}]: field is required`);
      const field = entity.fields.find((x) => x.key === f.field);
      if (!field) throw new BadRequestException(`filters[${i}]: unregistered field "${f.field}" for ${entity.entityKey}`);
      const operator = String(f.operator ?? '').toUpperCase() as Operator;
      if (!field.operators.includes(operator)) {
        throw new BadRequestException(`filters[${i}]: operator ${operator} not allowed on ${entity.entityKey}.${field.key} (allowed: ${field.operators.join('/')})`);
      }
      if (field.type === 'enum' && field.values) {
        const vals = Array.isArray(f.value) ? f.value : [f.value];
        for (const v of vals) {
          if (operator === 'IS_NULL') break;
          if (!field.values.includes(String(v))) {
            throw new BadRequestException(`filters[${i}]: value "${v}" is not a registered member of ${field.key} (${field.values.join('/')})`);
          }
        }
      }
      if ((operator === 'IN' || operator === 'NOT_IN') && !Array.isArray(f.value)) {
        throw new BadRequestException(`filters[${i}]: ${operator} needs an array value`);
      }
      if (operator === 'BETWEEN' && (!Array.isArray(f.value) || f.value.length !== 2)) {
        throw new BadRequestException(`filters[${i}]: BETWEEN needs a [min, max] value`);
      }
      return { field, operator, value: f.value };
    });

    const timeWindow = String(q.timeWindow ?? 'LIVE').toUpperCase();
    if (!(TIME_WINDOWS as readonly string[]).includes(timeWindow)) throw new BadRequestException(`invalid timeWindow ${timeWindow}`);

    const groupBy: string[] = Array.isArray(q.groupBy) && q.groupBy.length ? q.groupBy : ['orgUnitId'];
    for (const g of groupBy) {
      if (!entity.groupBy.includes(g)) throw new BadRequestException(`unregistered groupBy "${g}" for ${entity.entityKey} (allowed: ${entity.groupBy.join('/')})`);
    }
    if (groupBy.length > 1) throw new BadRequestException('MVP supports a single groupBy key');
    return { filters, timeWindow, groupBy };
  }

  private compileAggregation(entity: CatalogEntity, agg: any): { op: AggOp; field: CatalogField | null } {
    const op = String(agg?.op ?? 'COUNT').toUpperCase() as AggOp;
    if (!entity.aggregations.includes(op)) {
      throw new BadRequestException(`aggregation ${op} not allowed on ${entity.entityKey} (allowed: ${entity.aggregations.join('/')})`);
    }
    if (op === 'COUNT') return { op, field: null };
    const key = agg?.field;
    if (!key) throw new BadRequestException(`aggregation ${op} requires a field`);
    const field = entity.fields.find((f) => f.key === key);
    if (!field) throw new BadRequestException(`unregistered aggregation field "${key}" for ${entity.entityKey}`);
    if (op !== 'DISTINCT_COUNT' && !field.measure) throw new BadRequestException(`field ${key} is not a measure and cannot be ${op}-ed`);
    return { op, field };
  }

  private validateVisualMapping(vm: any) {
    const mode = String(vm?.mode ?? 'CARD').toUpperCase();
    if (!(VISUAL_MODES as readonly string[]).includes(mode)) throw new BadRequestException(`invalid visual mode ${mode}`);
    const thresholds = Array.isArray(vm?.thresholds) ? vm.thresholds : [];
    for (const [i, t] of thresholds.entries()) {
      if (typeof t?.min !== 'number') throw new BadRequestException(`visualMapping.thresholds[${i}]: min must be a number`);
      if (t.max != null && typeof t.max !== 'number') throw new BadRequestException(`visualMapping.thresholds[${i}]: max must be a number or null`);
      if (!(ZONE_STATES as readonly string[]).includes(String(t.state))) throw new BadRequestException(`visualMapping.thresholds[${i}]: invalid state ${t.state}`);
    }
    return { mode, thresholds };
  }

  // ---- CRUD ------------------------------------------------------------------

  catalog() {
    return {
      entities: catalogSummary(),
      timeWindows: TIME_WINDOWS,
      visualModes: VISUAL_MODES,
      zoneStates: ZONE_STATES,
      refreshPolicies: REFRESH_POLICIES,
      note: 'Catalog is compiled into the server. A tenant cannot register a new entity or field; camera/attendance/biometric sources are permanently banned (AT-012).',
    };
  }

  async list(tenantId: string, filter: { entityKey?: string } = {}) {
    const items = await this.db.dataLayerDefinition.findMany({
      where: { tenantId, ...(filter.entityKey ? { entityKey: filter.entityKey } : {}) },
      orderBy: { code: 'asc' },
    });
    return { items, count: items.length };
  }

  async get(tenantId: string, id: string) {
    const dl = await this.db.dataLayerDefinition.findFirst({ where: { id, tenantId } });
    if (!dl) throw new NotFoundException(`data layer not found: ${id}`);
    return dl;
  }

  async create(tenantId: string, actorId: string, body: any) {
    if (!body?.code) throw new BadRequestException('code is required');
    if (!body?.name) throw new BadRequestException('name is required');
    const entity = this.assertEntity(body.entityKey);
    const query = this.compileQuery(entity, body.query);
    const aggregation = this.compileAggregation(entity, body.aggregation);
    const visualMapping = this.validateVisualMapping(body.visualMapping);
    const refreshPolicy = String(body.refreshPolicy ?? 'ONE_MINUTE').toUpperCase();
    if (!(REFRESH_POLICIES as readonly string[]).includes(refreshPolicy)) throw new BadRequestException(`invalid refreshPolicy ${refreshPolicy}`);
    const sensitivity = String(body.sensitivity ?? 'AGGREGATE').toUpperCase();
    if (!['AGGREGATE', 'INDIVIDUAL'].includes(sensitivity)) throw new BadRequestException(`invalid sensitivity ${sensitivity}`);

    const dl = await this.db.dataLayerDefinition.create({
      data: {
        tenantId,
        code: body.code,
        name: body.name,
        sourceKey: entity.sourceKey,
        entityKey: entity.entityKey,
        query: {
          filters: query.filters.map((f) => ({ field: f.field.key, operator: f.operator, value: f.value })),
          timeWindow: query.timeWindow,
          groupBy: query.groupBy,
        } as any,
        aggregation: { op: aggregation.op, field: aggregation.field?.key ?? null } as any,
        refreshPolicy,
        visualMapping: visualMapping as any,
        sensitivity,
        createdBy: actorId,
      },
    });
    await this.audit(tenantId, dl.code, 'datalayer.create', actorId, { id: dl.id, entityKey: dl.entityKey });
    return dl;
  }

  async update(tenantId: string, actorId: string, id: string, body: any) {
    const dl = await this.get(tenantId, id);
    const entity = this.assertEntity(body?.entityKey ?? dl.entityKey);
    const data: Record<string, unknown> = {};
    if (body?.name) data.name = body.name;
    if (body?.entityKey) {
      data.entityKey = entity.entityKey;
      data.sourceKey = entity.sourceKey;
    }
    if (body?.query !== undefined) {
      const q = this.compileQuery(entity, body.query);
      data.query = { filters: q.filters.map((f) => ({ field: f.field.key, operator: f.operator, value: f.value })), timeWindow: q.timeWindow, groupBy: q.groupBy };
    }
    if (body?.aggregation !== undefined) {
      const a = this.compileAggregation(entity, body.aggregation);
      data.aggregation = { op: a.op, field: a.field?.key ?? null };
    }
    if (body?.visualMapping !== undefined) data.visualMapping = this.validateVisualMapping(body.visualMapping);
    if (body?.refreshPolicy) {
      const rp = String(body.refreshPolicy).toUpperCase();
      if (!(REFRESH_POLICIES as readonly string[]).includes(rp)) throw new BadRequestException(`invalid refreshPolicy ${rp}`);
      data.refreshPolicy = rp;
    }
    const updated = await this.db.dataLayerDefinition.update({ where: { id }, data: data as any });
    await this.audit(tenantId, updated.code, 'datalayer.update', actorId, { id, keys: Object.keys(data) });
    return updated;
  }

  // ---- execution -------------------------------------------------------------

  private windowStart(timeWindow: string): Date | null {
    const now = Date.now();
    switch (timeWindow) {
      case 'TODAY': {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
      }
      case 'LAST_7D':
        return new Date(now - 7 * 86400000);
      case 'LAST_30D':
        return new Date(now - 30 * 86400000);
      default:
        return null; // LIVE = no time bound
    }
  }

  /** Compile catalog filters into a Prisma where object. Field keys are catalog-verified. */
  private toPrismaWhere(entity: CatalogEntity, filters: CompiledFilter[], tenantId: string): Record<string, unknown> {
    const where: Record<string, unknown> = { tenantId };
    for (const f of filters) {
      if (f.field.derived) continue; // derived fields are post-filtered in memory
      const k = f.field.key;
      switch (f.operator) {
        case 'EQ': where[k] = f.field.type === 'enum' && f.field.values?.includes('true') ? String(f.value) === 'true' : f.value; break;
        case 'NE': where[k] = { not: f.value }; break;
        case 'IN': where[k] = { in: f.value }; break;
        case 'NOT_IN': where[k] = { notIn: f.value }; break;
        case 'GT': where[k] = { gt: f.field.type === 'date' ? new Date(f.value as string) : f.value }; break;
        case 'GTE': where[k] = { gte: f.field.type === 'date' ? new Date(f.value as string) : f.value }; break;
        case 'LT': where[k] = { lt: f.field.type === 'date' ? new Date(f.value as string) : f.value }; break;
        case 'LTE': where[k] = { lte: f.field.type === 'date' ? new Date(f.value as string) : f.value }; break;
        case 'BETWEEN': {
          const [a, b] = f.value as [unknown, unknown];
          where[k] = f.field.type === 'date' ? { gte: new Date(a as string), lte: new Date(b as string) } : { gte: a, lte: b };
          break;
        }
        case 'IS_NULL': where[k] = f.value === false ? { not: null } : null; break;
      }
    }
    return where;
  }

  /**
   * personId → orgUnitId map, built from Position (ADR-0005). NativeWorkItem has
   * no orgUnitId column, so this join is the ONLY correct way to fold work into
   * departments. Built server-side, RLS-scoped, per execution.
   */
  private async personOrgMap(tenantId: string): Promise<Map<string, string>> {
    const positions = await this.db.position.findMany({
      where: { tenantId, holderPersonId: { not: null } },
      select: { holderPersonId: true, orgUnitId: true, isHead: true },
    });
    const map = new Map<string, string>();
    for (const p of positions) {
      if (!p.holderPersonId) continue;
      // A head seat wins when someone holds several positions.
      if (!map.has(p.holderPersonId) || p.isHead) map.set(p.holderPersonId, p.orgUnitId);
    }
    return map;
  }

  /** Derived measure: weightedDemand (ADR-0005) — never a stored column. */
  private weightedDemand(item: { weight: number | null; estimateMinutes: number | null; priority: string }): number {
    if (item.weight != null) return item.weight;
    if (item.estimateMinutes != null) return item.estimateMinutes / 60;
    return { URGENT: 8, HIGH: 5, NORMAL: 3, LOW: 1 }[item.priority] ?? 3;
  }

  private stateFor(value: number, thresholds: Array<{ min: number; max: number | null; state: string }>): string {
    if (!thresholds.length) return 'NORMAL';
    for (const t of thresholds) {
      if (value >= t.min && (t.max == null || value < t.max)) return t.state;
    }
    return 'NO_DATA';
  }

  /**
   * Execute a saved data layer and return DEPARTMENT-AGGREGATE rows.
   * @throws ForbiddenException when individual scope is requested without
   *         `ioc.people.detail` (Constitution #7 / AT-006) — the row is never
   *         computed, not merely hidden.
   */
  async execute(tenantId: string, actorId: string, id: string, opts: ExecOptions = {}) {
    const dl = await this.get(tenantId, id);
    return this.executeDefinition(tenantId, actorId, dl, opts);
  }

  async executeDefinition(tenantId: string, actorId: string, dl: { id: string; code: string; name: string; entityKey: string; query: any; aggregation: any; visualMapping: any; sensitivity: string }, opts: ExecOptions = {}) {
    const entity = this.assertEntity(dl.entityKey);
    const q = this.compileQuery(entity, dl.query);
    const agg = this.compileAggregation(entity, dl.aggregation);
    const vm = this.validateVisualMapping(dl.visualMapping);
    const scope = opts.scope ?? 'aggregate';

    if (scope === 'individual') {
      const perms = opts.permissions ?? [];
      const allowed = perms.includes('*') || perms.includes('ioc.people.detail');
      if (!allowed) {
        throw new ForbiddenException('individual drill-down requires the ioc.people.detail permission (Constitution #7)');
      }
      if (!entity.personal) throw new BadRequestException(`${entity.entityKey} has no individual dimension`);
      await this.audit(tenantId, dl.code, 'datalayer.people_detail', actorId, { dataLayerId: dl.id, entityKey: entity.entityKey });
    }

    const where = this.toPrismaWhere(entity, q.filters, tenantId);
    const since = this.windowStart(q.timeWindow);
    const groupKey = q.groupBy[0];

    let rows: Array<{ key: string; label?: string; value: number; count: number; personId?: string }> = [];

    if (entity.entityKey === 'NativeWorkItem') {
      if (since) (where as any).updatedAt = { gte: since };
      const items = await this.db.nativeWorkItem.findMany({
        where: where as any,
        select: { id: true, ownerId: true, assigneeIds: true, status: true, priority: true, type: true, projectId: true, weight: true, estimateMinutes: true, progressPercent: true, dueAt: true },
      });
      const orgMap = groupKey === 'orgUnitId' ? await this.personOrgMap(tenantId) : null;
      const buckets = new Map<string, { values: number[]; ids: Set<string> }>();
      const now = Date.now();
      for (const it of items) {
        const measure =
          agg.op === 'COUNT' ? 1
          : agg.field?.key === 'weightedDemand' ? this.weightedDemand(it)
          : agg.field?.key === 'isOverdue' ? (it.dueAt && it.dueAt.getTime() < now && it.status !== 'DONE' && it.status !== 'CANCELLED' ? 1 : 0)
          : agg.field?.key === 'progressPercent' ? it.progressPercent
          : agg.field?.key === 'weight' ? (it.weight ?? 0)
          : agg.field?.key === 'estimateMinutes' ? (it.estimateMinutes ?? 0)
          : 1;
        let key: string;
        if (groupKey === 'orgUnitId') {
          const person = it.ownerId ?? it.assigneeIds[0] ?? null;
          key = (person && orgMap?.get(person)) || 'UNASSIGNED';
        } else {
          key = String((it as any)[groupKey] ?? 'UNASSIGNED');
        }
        const b = buckets.get(key) ?? { values: [], ids: new Set<string>() };
        b.values.push(measure);
        b.ids.add(it.ownerId ?? it.id);
        buckets.set(key, b);
      }
      rows = [...buckets.entries()].map(([key, b]) => ({
        key,
        value: this.reduce(agg.op, b.values, b.ids.size),
        count: b.values.length,
      }));
    } else if (entity.entityKey === 'ExecutionProject') {
      // ExecutionProject carries orgUnitId natively — no person fold needed.
      if (since) (where as any).updatedAt = { gte: since };
      const items = await this.db.executionProject.findMany({
        where: where as any,
        select: { id: true, orgUnitId: true, status: true, health: true, progressPercent: true },
      });
      const buckets = new Map<string, number[]>();
      for (const it of items) {
        const key = String((it as any)[groupKey] ?? 'UNASSIGNED');
        const measure = agg.op === 'COUNT' ? 1 : agg.field?.key === 'progressPercent' ? it.progressPercent : 1;
        buckets.set(key, [...(buckets.get(key) ?? []), measure]);
      }
      rows = [...buckets.entries()].map(([key, values]) => ({ key, value: this.reduce(agg.op, values, values.length), count: values.length }));
    } else if (entity.entityKey === 'Position') {
      const items = await this.db.position.findMany({ where: where as any, select: { id: true, orgUnitId: true, holderPersonId: true } });
      const buckets = new Map<string, { values: number[]; ids: Set<string> }>();
      for (const it of items) {
        const key = it.orgUnitId ?? 'UNASSIGNED';
        const b = buckets.get(key) ?? { values: [], ids: new Set<string>() };
        b.values.push(1);
        if (it.holderPersonId) b.ids.add(it.holderPersonId);
        buckets.set(key, b);
      }
      rows = [...buckets.entries()].map(([key, b]) => ({ key, value: agg.op === 'DISTINCT_COUNT' ? b.ids.size : b.values.length, count: b.values.length }));
    } else if (entity.entityKey === 'MetricObservation') {
      if (since) (where as any).periodStart = { gte: since };
      const items = await this.db.metricObservation.findMany({ where: where as any, select: { metricId: true, value: true } });
      const buckets = new Map<string, number[]>();
      for (const it of items) buckets.set(it.metricId, [...(buckets.get(it.metricId) ?? []), it.value]);
      rows = [...buckets.entries()].map(([key, values]) => ({ key, value: this.reduce(agg.op, values, values.length), count: values.length }));
    }

    // Resolve group labels (never hardcoded in the UI — Constitution #10).
    if (groupKey === 'orgUnitId') {
      const orgs = await this.db.orgUnit.findMany({ where: { tenantId }, select: { id: true, code: true, name: true } });
      const m = new Map(orgs.map((o) => [o.id, o]));
      rows = rows.map((r) => ({ ...r, label: m.get(r.key)?.name ?? (r.key === 'UNASSIGNED' ? 'Chưa gán đơn vị' : r.key) }));
    } else {
      rows = rows.map((r) => ({ ...r, label: r.key }));
    }

    rows.sort((a, b) => b.value - a.value);
    const withState = rows.map((r) => ({ ...r, value: Number(r.value.toFixed(2)), state: this.stateFor(r.value, vm.thresholds as any) }));
    const total = withState.reduce((s, r) => s + r.value, 0);

    return {
      dataLayerId: dl.id,
      code: dl.code,
      name: dl.name,
      entityKey: entity.entityKey,
      ownedBy: entity.ownedBy,
      groupBy: groupKey,
      aggregation: { op: agg.op, field: agg.field?.key ?? null },
      visualMode: vm.mode,
      scope,
      rows: withState,
      total: Number(total.toFixed(2)),
      computedAt: new Date().toISOString(),
    };
  }

  private reduce(op: AggOp, values: number[], distinct: number): number {
    if (!values.length) return 0;
    switch (op) {
      case 'COUNT': return values.length;
      case 'SUM': return values.reduce((a, b) => a + b, 0);
      case 'AVG': return values.reduce((a, b) => a + b, 0) / values.length;
      case 'DISTINCT_COUNT': return distinct;
      case 'PERCENTILE': {
        const s = [...values].sort((a, b) => a - b);
        return s[Math.floor(s.length * 0.95)] ?? s[s.length - 1];
      }
      default: return values.length;
    }
  }

  /** Ad-hoc preview from an UNSAVED definition — same validation, nothing persisted. */
  async preview(tenantId: string, actorId: string, body: any, opts: ExecOptions = {}) {
    const entity = this.assertEntity(body?.entityKey);
    this.compileQuery(entity, body?.query);
    this.compileAggregation(entity, body?.aggregation);
    this.validateVisualMapping(body?.visualMapping);
    return this.executeDefinition(
      tenantId,
      actorId,
      {
        id: 'preview',
        code: 'PREVIEW',
        name: body?.name ?? 'Xem thử',
        entityKey: entity.entityKey,
        query: body?.query,
        aggregation: body?.aggregation,
        visualMapping: body?.visualMapping,
        sensitivity: 'AGGREGATE',
      },
      opts,
    );
  }
}
