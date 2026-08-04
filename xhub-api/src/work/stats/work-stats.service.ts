import { BadRequestException, Injectable } from '@nestjs/common';
import { XofficePrismaService } from '../../xoffice-prisma/xoffice-prisma.service';
import { isOverdue } from '../work.fsm';

/**
 * WorkStatsService — the multi-dimensional statistics read model (owner
 * requirement #2). Deterministic aggregation over NativeWorkItem, grouped by any
 * tag or tenant-defined dimension (Loại việc/Giai đoạn/Nhóm chi phí/Bộ phận) or a
 * built-in facet (status/type/priority/project). Optionally cross-tabbed by a
 * second axis. Runs inside the caller's withTenant(tenantId) RLS context so every
 * counted row is tenant-scoped — the pivot never leaks cross-tenant data.
 *
 * Read-only: no SoR is stored; the cross-tab is recomputed on every request.
 */
@Injectable()
export class WorkStatsService {
  constructor(private readonly prisma: XofficePrismaService) {}

  private get db() {
    return this.prisma.db;
  }

  private static readonly FACETS = ['status', 'type', 'priority', 'project'];
  private static readonly NONE = '__none__';

  /** Resolve the bucket keys an item contributes to for a given axis spec. */
  private buckets(item: any, axis: string, dimLabels: Map<string, Map<string, string>>): Array<{ key: string; label: string }> {
    if (axis === 'tag') {
      const tags: string[] = Array.isArray(item.tags) ? item.tags : [];
      if (!tags.length) return [{ key: WorkStatsService.NONE, label: '(Không thẻ)' }];
      return tags.map((t) => ({ key: t, label: t }));
    }
    if (axis.startsWith('dimension:')) {
      const key = axis.slice('dimension:'.length);
      const raw = item.dimensions && typeof item.dimensions === 'object' ? item.dimensions[key] : undefined;
      const value = raw != null && raw !== '' ? String(raw) : WorkStatsService.NONE;
      const label = value === WorkStatsService.NONE ? '(Không có)' : dimLabels.get(key)?.get(value) ?? value;
      return [{ key: value, label }];
    }
    // built-in facets
    let value: string | null | undefined;
    if (axis === 'status') value = item.status;
    else if (axis === 'type') value = item.type;
    else if (axis === 'priority') value = item.priority;
    else if (axis === 'project') value = item.projectId;
    const key = value != null && value !== '' ? String(value) : WorkStatsService.NONE;
    return [{ key, label: key === WorkStatsService.NONE ? '(Không có)' : key }];
  }

  private validateAxis(axis: string) {
    if (axis.startsWith('dimension:')) return;
    if (!WorkStatsService.FACETS.includes(axis) && axis !== 'tag') {
      throw new BadRequestException(`invalid groupBy/col axis '${axis}' (use tag | dimension:<key> | ${WorkStatsService.FACETS.join(' | ')})`);
    }
  }

  async stats(
    tenantId: string,
    opts: {
      groupBy: string;
      col?: string;
      metric?: 'count' | 'progress' | 'overdue';
      status?: string;
      type?: string;
      priority?: string;
      projectId?: string;
      tags?: string[];
      dimensions?: Record<string, string>;
    },
  ) {
    const groupBy = opts.groupBy;
    if (!groupBy) throw new BadRequestException('groupBy is required (tag | dimension:<key> | status | type | priority | project)');
    this.validateAxis(groupBy);
    const col = opts.col || undefined;
    if (col) this.validateAxis(col);
    const metric = opts.metric ?? 'count';
    if (!['count', 'progress', 'overdue'].includes(metric)) throw new BadRequestException(`invalid metric '${metric}'`);

    // Filter set (mirrors GET /api/work/items so a report drills to the list).
    const where: any = { tenantId };
    if (opts.status) where.status = opts.status.toUpperCase();
    if (opts.type) where.type = opts.type.toUpperCase();
    if (opts.priority) where.priority = opts.priority.toUpperCase();
    if (opts.projectId) where.projectId = opts.projectId;
    if (opts.tags?.length) where.tags = { hasEvery: opts.tags };
    if (opts.dimensions && Object.keys(opts.dimensions).length) {
      where.AND = Object.entries(opts.dimensions).map(([k, v]) => ({ dimensions: { path: [k], equals: v } }));
    }

    const [rows, dims] = await Promise.all([
      this.db.nativeWorkItem.findMany({ where }),
      this.db.workDimension.findMany({ where: { tenantId } }),
    ]);

    // dimension value → label lookup (from the tenant catalog allowedValues).
    const dimLabels = new Map<string, Map<string, string>>();
    for (const d of dims) {
      const m = new Map<string, string>();
      const allowed = Array.isArray(d.allowedValues) ? (d.allowedValues as any[]) : [];
      for (const a of allowed) if (a && a.value != null) m.set(String(a.value), String(a.label ?? a.value));
      dimLabels.set(d.key, m);
    }

    // Accumulate: rowKey → colKey → { sum, n } (sum semantics depend on metric).
    const rowMeta = new Map<string, string>(); // key → label
    const colMeta = new Map<string, string>();
    const acc = new Map<string, Map<string, { sum: number; n: number }>>();
    const bump = (rk: string, ck: string, add: number) => {
      if (!acc.has(rk)) acc.set(rk, new Map());
      const r = acc.get(rk)!;
      if (!r.has(ck)) r.set(ck, { sum: 0, n: 0 });
      const cell = r.get(ck)!;
      cell.sum += add;
      cell.n += 1;
    };

    for (const item of rows) {
      const value =
        metric === 'progress' ? Number(item.progressPercent ?? 0) : metric === 'overdue' ? (isOverdue(item.dueAt, item.status) ? 1 : 0) : 1;
      const rowBuckets = this.buckets(item, groupBy, dimLabels);
      const colBuckets = col ? this.buckets(item, col, dimLabels) : [{ key: '__all__', label: 'Tổng' }];
      for (const rb of rowBuckets) {
        rowMeta.set(rb.key, rb.label);
        for (const cb of colBuckets) {
          colMeta.set(cb.key, cb.label);
          bump(rb.key, cb.key, value);
        }
      }
    }

    const finalize = (cell?: { sum: number; n: number }): number => {
      if (!cell) return 0;
      if (metric === 'progress') return cell.n ? Math.round(cell.sum / cell.n) : 0;
      return cell.sum; // count / overdue
    };

    const colKeys = [...colMeta.keys()].sort();
    const columns = colKeys.map((k) => ({ key: k, label: colMeta.get(k)! }));

    const resultRows = [...rowMeta.keys()]
      .sort()
      .map((rk) => {
        const rmap = acc.get(rk)!;
        const cells: Record<string, number> = {};
        let total = 0;
        let totalN = 0;
        for (const ck of colKeys) cells[ck] = finalize(rmap.get(ck));
        // row total across the raw rmap (all col buckets), metric-aware
        for (const cell of rmap.values()) {
          total += cell.sum;
          totalN += cell.n;
        }
        const rowTotal = metric === 'progress' ? (totalN ? Math.round(total / totalN) : 0) : total;
        return { key: rk, label: rowMeta.get(rk)!, cells, total: rowTotal };
      });

    return {
      groupBy,
      col: col ?? null,
      metric,
      columns,
      rows: resultRows,
      grandTotal: metric === 'progress'
        ? (rows.length ? Math.round(rows.reduce((s, i) => s + Number(i.progressPercent ?? 0), 0) / rows.length) : 0)
        : metric === 'overdue'
          ? rows.filter((i) => isOverdue(i.dueAt, i.status)).length
          : rows.length,
      itemCount: rows.length,
    };
  }
}
