import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';
import { MetricsService } from '../manage/metrics.service';
import { XofficeService } from '../xoffice/xoffice.service';

/**
 * IOC command-centre INSIGHTS (DT-05) — the "living operations centre" layer on
 * top of the published dashboard runtime.
 *
 * Constitution #1/#2/#12: this service owns NOTHING. Every number below is READ
 * from an existing System of Record and folded in memory:
 *
 *   flows      ← NativeWorkItem (Work v2) + Position/OrgUnit (Identity)
 *   headcount  ← Position (seats) + Position.holderPersonId (filled)
 *   workload   ← the published ZONE_COLOR data layer already resolved by the
 *                dashboard runtime (no second query, no second definition)
 *   onTime     ← ManageOS MetricsService.computeFromWork (the ONE SLA formula)
 *   pipeline   ← NativeWorkItem.status (the real stage enum, not a twin table)
 *   alerts     ← overloaded zones + genuinely overdue/blocked NativeWorkItems
 *   brief      ← XofficeService.aiAdvisory (draft-first, advisory-only)
 *
 * Deliberately NOT produced (and reported as such, rather than faked):
 *   · operating COST — no finance connector exists; a money figure would be
 *     invented. `kpi.cost` is absent and `omitted[]` says why.
 *   · a 24h workload HEATMAP — nothing in the platform buckets workload by hour
 *     yet. `heatmap.available=false` with a reason; the UI shows a truthful
 *     current-snapshot column chart instead.
 *   · a FORECAST — only emitted when >= 3 REAL MetricObservation points exist;
 *     otherwise `forecast=null` with a reason. No synthetic confidence number.
 *   · APPROVAL-based flow — ApprovalTask.assigneeUserId is a role-binding email
 *     that does not join to Position.holderPersonId (`usr-*`); see
 *     `flowSources[].available`.
 */

/** NativeWorkItem.status — the real stage enum owned by Work v2. */
const PIPELINE_STAGES: Array<{ key: string; label: string }> = [
  { key: 'BACKLOG', label: 'Chờ xếp' },
  { key: 'TODO', label: 'Sẵn sàng' },
  { key: 'IN_PROGRESS', label: 'Đang làm' },
  { key: 'REVIEW', label: 'Đang duyệt' },
  { key: 'BLOCKED', label: 'Bị chặn' },
  { key: 'DONE', label: 'Hoàn thành' },
];

/** Load penalty per zone state — the ONLY tuning constant in the health score. */
const STATE_PENALTY: Record<string, number> = {
  OVERLOADED: 1,
  RISK: 0.75,
  BUSY: 0.5,
  GOOD: 0,
  NORMAL: 0,
  NO_DATA: 0,
};

/**
 * The health score is a DERIVED score, not a measurement. It is published with
 * its formula and its raw inputs so a reader can recompute it by hand.
 */
export const HEALTH_FORMULA =
  'health = round(0.6 × onTimeRate + 0.4 × loadBalance) — ' +
  'onTimeRate = 100 × onTimeCount / totalWithDue (ManageOS XOFFICE_WORK, = 100 khi không có việc gắn hạn); ' +
  'loadBalance = 100 × (1 − Σpenalty / soVungCoDuLieu), penalty: QUÁ TẢI 1.0 · RỦI RO 0.75 · BẬN 0.5 · còn lại 0.';

const FLOW_WINDOW_DAYS = 30;

export interface ZoneView {
  zoneId: string;
  name: string;
  label: string;
  orgUnitId: string | null;
  state: string;
  workload: number;
  areaSqM: number;
  /** Position rows in this zone's org unit (định biên) */
  seats: number;
  /** …of which have a holder — the occupancy the scene draws person-dots for */
  filled: number;
}

@Injectable()
export class IocInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboards: DashboardService,
    private readonly metrics: MetricsService,
    private readonly xoffice: XofficeService,
  ) {}
  private get db() {
    return this.prisma.db;
  }

  /**
   * personId → orgUnitId, from Position (ADR-0005). Same fold the governed data
   * layer uses, so a flow edge and a zone colour can never disagree about which
   * department a person belongs to. A head seat wins on multi-position holders.
   */
  private async personOrgMap(tenantId: string): Promise<Map<string, string>> {
    const positions = await this.db.position.findMany({
      where: { tenantId, holderPersonId: { not: null } },
      select: { holderPersonId: true, orgUnitId: true, isHead: true },
    });
    const map = new Map<string, string>();
    for (const p of positions) {
      if (!p.holderPersonId) continue;
      if (!map.has(p.holderPersonId) || p.isHead) map.set(p.holderPersonId, p.orgUnitId);
    }
    return map;
  }

  /**
   * The whole insight payload for one PUBLISHED dashboard.
   * `runtime` may be passed in by a caller that already resolved it (avoids
   * executing every data layer twice).
   */
  async insights(tenantId: string, actorId: string, codeOrId: string, opts: { permissions?: string[] } = {}) {
    const rt: any = await this.dashboards.runtime(tenantId, actorId, codeOrId, opts);
    const scene = rt.scene;
    const layers: Record<string, any> = rt.dataLayers ?? {};

    // ---- headcount per org unit (Position — real seats, real holders) -------
    const positions = await this.db.position.findMany({ where: { tenantId }, select: { orgUnitId: true, holderPersonId: true } });
    const seats = new Map<string, { seats: number; filled: number }>();
    for (const p of positions) {
      const b = seats.get(p.orgUnitId) ?? { seats: 0, filled: 0 };
      b.seats++;
      if (p.holderPersonId) b.filled++;
      seats.set(p.orgUnitId, b);
    }

    // ---- zones (the same fold the 2D/3D renderer does) ----------------------
    const zones: ZoneView[] = ((scene?.zones ?? []) as any[]).map((z) => {
      const ids: string[] = z.binding?.dataLayerIds ?? [];
      const colourLayer = ids.map((id) => layers[id]).find((l) => l && !l.error && l.visualMode === 'ZONE_COLOR');
      const row = colourLayer?.rows?.find((r: any) => r.key === (z.binding?.bindingId ?? z.orgUnitId));
      const orgUnitId = z.orgUnit?.id ?? z.orgUnitId ?? null;
      const hc = orgUnitId ? seats.get(orgUnitId) : undefined;
      return {
        zoneId: z.id,
        name: z.name,
        label: z.orgUnit?.name ?? z.name,
        orgUnitId,
        state: (row?.state ?? 'NO_DATA') as string,
        workload: row?.value ?? 0,
        areaSqM: z.areaSqM ?? 0,
        seats: hc?.seats ?? 0,
        filled: hc?.filled ?? 0,
      };
    });
    const orgToZone = new Map<string, ZoneView>();
    for (const z of zones) if (z.orgUnitId) orgToZone.set(z.orgUnitId, z);

    const orgMap = await this.personOrgMap(tenantId);
    const now = new Date();
    const since = new Date(now.getTime() - FLOW_WINDOW_DAYS * 86400000);

    // ---- work items: flows + pipeline + alerts in ONE read -------------------
    const items = await this.db.nativeWorkItem.findMany({
      where: { tenantId, status: { not: 'CANCELLED' } },
      select: { id: true, title: true, status: true, priority: true, ownerId: true, assigneeIds: true, dueAt: true, updatedAt: true, createdAt: true },
    });

    // FLOW LAYER — a real inter-department HANDOFF: a work item OWNED by a
    // person in org A but ASSIGNED to a person in org B. Direction = A → B.
    // Both endpoints must resolve to a zone in THIS scene, otherwise the edge is
    // counted as unmapped and reported, never drawn.
    const edges = new Map<string, { fromZoneId: string; toZoneId: string; fromLabel: string; toLabel: string; items: number; samples: string[] }>();
    let unmappedHandoffs = 0;
    let handoffsInWindow = 0;
    for (const it of items) {
      if (it.updatedAt < since) continue;
      const fromOrg = it.ownerId ? orgMap.get(it.ownerId) : undefined;
      if (!fromOrg) continue;
      const seen = new Set<string>();
      for (const a of it.assigneeIds ?? []) {
        const toOrg = orgMap.get(a);
        if (!toOrg || toOrg === fromOrg || seen.has(toOrg)) continue;
        seen.add(toOrg);
        handoffsInWindow++;
        const from = orgToZone.get(fromOrg);
        const to = orgToZone.get(toOrg);
        if (!from || !to) {
          unmappedHandoffs++;
          continue;
        }
        const key = `${from.zoneId}>${to.zoneId}`;
        const e = edges.get(key) ?? { fromZoneId: from.zoneId, toZoneId: to.zoneId, fromLabel: from.label, toLabel: to.label, items: 0, samples: [] };
        e.items++;
        if (e.samples.length < 3) e.samples.push(it.title);
        edges.set(key, e);
      }
    }
    const flows = [...edges.values()].sort((a, b) => b.items - a.items);

    // ---- pipeline (real NativeWorkItem stage counts) -------------------------
    const byStatus = new Map<string, number>();
    for (const it of items) byStatus.set(it.status, (byStatus.get(it.status) ?? 0) + 1);
    const pipeline = PIPELINE_STAGES.map((s) => ({ ...s, count: byStatus.get(s.key) ?? 0 }));

    // ---- alerts (derived from REAL state — no generic filler text) ----------
    const overdue = items
      .filter((it) => it.dueAt && it.dueAt < now && it.status !== 'DONE')
      .sort((a, b) => (a.dueAt as Date).getTime() - (b.dueAt as Date).getTime());
    const zoneOfPerson = (pid: string | null) => (pid ? orgToZone.get(orgMap.get(pid) ?? '')?.label : undefined);

    const alerts: Array<{ severity: 'CRITICAL' | 'WARNING' | 'INFO'; title: string; detail: string; zone?: string; at: string; source: string }> = [];
    for (const z of zones.filter((x) => x.state === 'OVERLOADED')) {
      alerts.push({ severity: 'CRITICAL', title: `${z.label}: quá tải`, detail: `Tải công việc ${z.workload} (trạng thái QUÁ TẢI theo ngưỡng của lớp dữ liệu đã xuất bản)`, zone: z.label, at: rt.resolvedAt, source: 'ioc.zone-state' });
    }
    for (const it of overdue.slice(0, 5)) {
      alerts.push({
        severity: 'CRITICAL',
        title: `Quá hạn: ${it.title}`,
        detail: `Hạn ${(it.dueAt as Date).toLocaleDateString('vi-VN')} · trạng thái ${it.status}`,
        zone: zoneOfPerson(it.ownerId),
        at: (it.dueAt as Date).toISOString(),
        source: 'work.nativeWorkItem.dueAt',
      });
    }
    for (const it of items.filter((x) => x.status === 'BLOCKED').slice(0, 3)) {
      alerts.push({ severity: 'WARNING', title: `Bị chặn: ${it.title}`, detail: 'Công việc đang ở trạng thái BLOCKED trong Work v2', zone: zoneOfPerson(it.ownerId), at: it.updatedAt.toISOString(), source: 'work.nativeWorkItem.status' });
    }
    for (const z of zones.filter((x) => x.state === 'BUSY')) {
      alerts.push({ severity: 'WARNING', title: `${z.label}: đang bận`, detail: `Tải công việc ${z.workload} — theo dõi, chưa vượt ngưỡng quá tải`, zone: z.label, at: rt.resolvedAt, source: 'ioc.zone-state' });
    }

    // ---- KPI strip -----------------------------------------------------------
    const onTime = await this.metrics.computeFromWork(tenantId, now);
    // Scoped to the zones THIS scene actually shows — an org unit with no zone
    // on this floor must not inflate the twin's headcount tile.
    const totalSeats = zones.reduce((s, z) => s + z.seats, 0);
    const totalFilled = zones.reduce((s, z) => s + z.filled, 0);
    const totalWorkload = Number(zones.reduce((s, z) => s + z.workload, 0).toFixed(1));

    const zonesWithData = zones.filter((z) => z.state !== 'NO_DATA');
    const penalty = zonesWithData.reduce((s, z) => s + (STATE_PENALTY[z.state] ?? 0), 0);
    const loadBalance = zonesWithData.length ? 100 * (1 - penalty / zonesWithData.length) : 100;
    const health = Math.max(0, Math.min(100, Math.round(0.6 * onTime.value + 0.4 * loadBalance)));

    const kpi = {
      headcount: { filled: totalFilled, seats: totalSeats, note: 'Định biên có người giữ / tổng định biên (Position) của các đơn vị CÓ mặt trên sàn này. KHÔNG phải chấm công hay nhận diện — dữ liệu hiện diện bị cấm vĩnh viễn (AT-012).' },
      workload: { total: totalWorkload, zones: zones.length, note: 'Tổng giá trị lớp ZONE_COLOR đã xuất bản trên tất cả các vùng.' },
      onTime: { rate: onTime.value, ...onTime.detail, note: 'ManageOS · MetricsService.computeFromWork (XOFFICE_WORK)' },
      overdue: { count: (onTime.detail as any).overdueCount ?? 0 },
      health: { score: health, formula: HEALTH_FORMULA, inputs: { onTimeRate: onTime.value, loadBalance: Number(loadBalance.toFixed(1)), penalty: Number(penalty.toFixed(2)), zonesWithData: zonesWithData.length } },
    };

    // ---- forecast: only from REAL observation history ------------------------
    const forecast = await this.forecast(tenantId);

    // ---- AI Twin Brief (draft-first, advisory only) --------------------------
    const brief = await this.brief(zones, flows, kpi, alerts.length);

    return {
      dashboardCode: rt.dashboard.code,
      resolvedAt: rt.resolvedAt,
      zones,
      headcount: Object.fromEntries([...seats.entries()]),
      flows,
      flowMeta: {
        windowDays: FLOW_WINDOW_DAYS,
        definition: 'Bàn giao liên phòng ban THẬT: NativeWorkItem có ownerId thuộc đơn vị A và assigneeIds chứa người thuộc đơn vị B (A→B). Gộp qua Position → OrgUnit.',
        handoffsInWindow,
        unmappedHandoffs,
        sources: [
          { key: 'work.handoff', label: 'Bàn giao công việc (Work v2)', available: true },
          {
            key: 'workflow.approval',
            label: 'Chuyển bước phê duyệt (X.Office)',
            available: false,
            reason: 'ApprovalTask.assigneeUserId là email role-binding, không khớp Position.holderPersonId (usr-*) — chưa có khoá định danh chung để gộp về đơn vị. Hoãn, không suy đoán.',
          },
        ],
      },
      pipeline,
      pipelineNote: 'Đếm thật theo NativeWorkItem.status (Work v2 sở hữu enum này).',
      alerts,
      kpi,
      forecast,
      heatmap: {
        available: false,
        reason: 'Chưa có dữ liệu tải theo GIỜ trong nền tảng (không có time-series workload). Hiển thị ảnh chụp hiện tại theo vùng thay vì dựng bản đồ nhiệt 24h không có thật.',
      },
      omitted: [
        { key: 'operatingCost', reason: 'Chưa có connector tài chính (FinERP là mock). Một con số chi phí ở đây sẽ là bịa — bỏ hẳn ô KPI thay vì điền số.' },
      ],
      brief,
    };
  }

  /**
   * A trend is emitted ONLY from real MetricObservation rows of a computed
   * (XOFFICE_WORK) metric, and only when there are >= 3 distinct periods. The
   * method is a plain delta between the last two real observations — no model,
   * no confidence percentage.
   */
  private async forecast(tenantId: string) {
    const defs = await this.db.metricDefinition.findMany({ where: { tenantId, sourceSystem: 'XOFFICE_WORK' }, select: { id: true, code: true, name: true, unit: true } });
    if (!defs.length) return { available: false, reason: 'Chưa có chỉ số nguồn XOFFICE_WORK nào được định nghĩa.' } as const;
    const obs = await this.db.metricObservation.findMany({
      where: { tenantId, metricId: { in: defs.map((d) => d.id) } },
      orderBy: { periodStart: 'asc' },
      select: { metricId: true, periodStart: true, value: true },
    });
    const byMetric = new Map<string, Array<{ periodStart: Date; value: number }>>();
    for (const o of obs) byMetric.set(o.metricId, [...(byMetric.get(o.metricId) ?? []), { periodStart: o.periodStart, value: o.value }]);
    const best = defs
      .map((d) => ({ def: d, points: byMetric.get(d.id) ?? [] }))
      .filter((x) => x.points.length >= 3)
      .sort((a, b) => b.points.length - a.points.length)[0];
    if (!best) {
      return {
        available: false,
        reason: 'Chưa đủ dữ liệu lịch sử để dự báo (cần ≥ 3 kỳ quan trắc thật của một chỉ số XOFFICE_WORK). Không dựng đường xu hướng giả.',
      } as const;
    }
    const pts = best.points;
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    return {
      available: true,
      metric: { code: best.def.code, name: best.def.name, unit: best.def.unit },
      points: pts.map((p) => ({ at: p.periodStart.toISOString(), value: p.value })),
      delta: Number((last.value - prev.value).toFixed(2)),
      method: 'Chênh lệch giữa hai kỳ quan trắc THẬT gần nhất (MetricObservation). Không phải mô hình dự báo, không có chỉ số độ tin cậy.',
    } as const;
  }

  /**
   * AI Twin Brief — bottlenecks + recommendations, in Vietnamese, computed from
   * the ALREADY-AGGREGATED zone numbers. Goes through the platform's single
   * draft-first gate (XofficeService.aiAdvisory): live Claude only when
   * XOFFICE_AI_LIVE=true AND a key is configured, otherwise a deterministic
   * rule-based text built from the very same numbers.
   *
   * Constitution #8: advisory ONLY. Nothing here triggers an action, reassigns
   * work, or writes to any table.
   */
  private async brief(
    zones: ZoneView[],
    flows: Array<{ fromLabel: string; toLabel: string; items: number }>,
    kpi: any,
    alertCount: number,
  ) {
    const ranked = [...zones].sort((a, b) => b.workload - a.workload);
    const hot = ranked.filter((z) => z.state === 'OVERLOADED' || z.state === 'BUSY');
    const quiet = ranked.filter((z) => z.state === 'NORMAL' || z.state === 'GOOD').slice(-2).reverse();

    const facts = [
      `Số vùng: ${zones.length}. Tổng tải: ${kpi.workload.total}.`,
      `Tải theo vùng (cao → thấp): ${ranked.map((z) => `${z.label} ${z.workload} (${z.state})`).join('; ')}.`,
      `Tỷ lệ đúng hạn: ${kpi.onTime.rate}% (${kpi.overdue.count} việc quá hạn).`,
      `Điểm sức khỏe vận hành: ${kpi.health.score}/100.`,
      flows.length
        ? `Bàn giao liên phòng ban 30 ngày: ${flows.map((f) => `${f.fromLabel}→${f.toLabel} ${f.items}`).join('; ')}.`
        : 'Chưa ghi nhận bàn giao liên phòng ban nào trong 30 ngày.',
      `Số cảnh báo đang mở: ${alertCount}.`,
    ].join('\n');

    const fallback = () => {
      const lines: string[] = [];
      if (hot.length) {
        lines.push(`NÚT THẮT: ${hot.map((z) => `${z.label} (tải ${z.workload}, ${z.state === 'OVERLOADED' ? 'quá tải' : 'đang bận'})`).join('; ')}.`);
      } else {
        lines.push('NÚT THẮT: chưa vùng nào vượt ngưỡng bận/quá tải.');
      }
      const recs: string[] = [];
      if (hot.length && quiet.length) recs.push(`Cân nhắc điều phối bớt việc từ ${hot[0].label} sang ${quiet[0].label} (đang ở mức ${quiet[0].workload}).`);
      if (kpi.overdue.count > 0) recs.push(`Rà soát ${kpi.overdue.count} việc quá hạn trước khi nhận thêm việc mới; tỷ lệ đúng hạn hiện ${kpi.onTime.rate}%.`);
      if (flows.length) recs.push(`Tuyến bàn giao dày nhất là ${flows[0].fromLabel} → ${flows[0].toLabel} (${flows[0].items} việc) — kiểm tra thời gian chờ ở điểm nhận.`);
      if (kpi.headcount.seats > kpi.headcount.filled) recs.push(`Còn ${kpi.headcount.seats - kpi.headcount.filled} định biên trống — đối chiếu với các vùng đang quá tải trước khi tuyển thêm.`);
      if (!recs.length) recs.push('Chưa phát hiện điểm nghẽn cần xử lý ngay; duy trì theo dõi.');
      lines.push('KHUYẾN NGHỊ:');
      for (const r of recs.slice(0, 4)) lines.push(`- ${r}`);
      return lines.join('\n');
    };

    const system = [
      'Bạn là trợ lý phân tích vận hành cho trung tâm điều hành (IOC) của một doanh nghiệp Việt Nam.',
      'Bạn CHỈ được diễn giải và khuyến nghị dựa trên các con số được cung cấp. TUYỆT ĐỐI không bịa thêm số liệu,',
      'không suy đoán chi phí/tài chính, không dự báo tương lai nếu không được cấp dữ liệu lịch sử.',
      'Trả về văn bản thuần tiếng Việt, tối đa 8 dòng, theo đúng cấu trúc:',
      'dòng đầu bắt đầu bằng "NÚT THẮT:" mô tả 1-3 điểm nghẽn; sau đó một dòng "KHUYẾN NGHỊ:";',
      'rồi 2-4 dòng bắt đầu bằng "- " là khuyến nghị hành động cho con người quyết định.',
      'Đây là bản nháp tư vấn — không phải lệnh, không tự động thực thi.',
    ].join(' ');

    const res = await this.xoffice.aiAdvisory(system, facts, fallback, { maxTokens: 600 });
    const lines = res.text.split('\n').map((l) => l.trim()).filter(Boolean);
    return {
      source: res.source,
      mustRequireHumanApply: res.mustRequireHumanApply,
      bottleneck: lines.find((l) => l.startsWith('NÚT THẮT'))?.replace(/^NÚT THẮT:\s*/, '') ?? lines[0] ?? '',
      recommendations: lines.filter((l) => l.startsWith('- ')).map((l) => l.slice(2)),
      raw: res.text,
      inputs: facts,
      note: 'AI chỉ diễn giải và khuyến nghị (Hiến pháp #8) — không tự động điều chuyển việc, không ghi vào bất kỳ bảng nghiệp vụ nào.',
    };
  }
}
