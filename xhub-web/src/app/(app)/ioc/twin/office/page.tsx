import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { TwinPlan2D } from "@/components/ioc/TwinPlan2D";
import { OfficeTwinWorkspace } from "@/components/ioc/OfficeTwinWorkspace.client";
import {
  getDashboardRuntime,
  getDashboardInsights,
  zoneMetrics,
  STATE_LABEL,
  STATE_TONE,
  STATE_FILL,
  type ZoneState,
} from "@/xoffice/lib/ioc-data";

export const metadata = { title: "Office Digital Twin Command Center · XHub" };
export const dynamic = "force-dynamic";

// IOC-02 — Office Digital Twin Command Center (DT-02 + DT-03 + DT-05).
//
// The twin itself is driven by ONE published DashboardVersion: layout, widgets,
// scene and data layers all come from the immutable payload, so a tenant can
// change this screen without a deploy (AT-009). Nothing about X-TECH's floors or
// departments is hardcoded here (Constitution #10).
//
// The command-centre layer around it (KPI strip, process rail, AI brief, bottom
// panels) is served by /runtime/dashboards/:code/insights — a read-only
// projection over Work v2 / Identity / ManageOS. It ships its own honesty flags
// and this page RENDERS THEM rather than papering over them:
//   · no operating-cost tile exists (no finance connector — see `omitted`)
//   · no 24h heatmap is drawn (no hour-bucketed data — `heatmap.available`)
//   · no forecast line is drawn unless >= 3 real observations back it
//   · the AI brief is a DRAFT (Constitution #8): advisory text, never an action.
//
// Constitution #9 / AT-007: the 2D plan and the zone list are SERVER-rendered
// and always present; the Babylon canvas is an opt-in overlay inside an error
// boundary. If the insights call fails, the twin still renders — just plainer.

const SEVERITY_TONE = { CRITICAL: "error", WARNING: "warning", INFO: "info" } as const;
const SEVERITY_LABEL = { CRITICAL: "Nghiêm trọng", WARNING: "Cảnh báo", INFO: "Thông tin" } as const;

export default async function OfficeTwinPage() {
  const [rt, ins] = await Promise.all([getDashboardRuntime("DASH-OFFICE"), getDashboardInsights("DASH-OFFICE")]);

  if (!rt) {
    return (
      <div className="space-y-4">
        <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Office Digital Twin Command Center</h1>
        <SectionCard title="Chưa sẵn sàng" accent="warning">
          <p className="text-sm text-gray-600 dark:text-dark-200">
            Chưa có bảng điều khiển <code>DASH-OFFICE</code> được xuất bản, hoặc backend đang offline.
            Chạy <code>npm run seed:ioc</code> ở xhub-api, hoặc tạo scene + bảng điều khiển trong{" "}
            <Link href="/ioc/studio" className="text-primary-600 hover:underline">Twin Studio</Link>.
          </p>
        </SectionCard>
      </div>
    );
  }

  const zones = zoneMetrics(rt.scene, rt.dataLayers);
  const insightZones = ins?.zones ?? [];
  const flows = ins?.flows ?? [];
  const maxPipeline = Math.max(1, ...(ins?.pipeline ?? []).map((p) => p.count));
  const maxZoneLoad = Math.max(1, ...insightZones.map((z) => z.workload));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">{rt.dashboard.name}</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">
            {rt.scene?.name ?? "—"} · scene v{rt.scene?.versionNo ?? "?"} · bảng điều khiển v{rt.dashboard.versionNo}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">checksum {rt.dashboard.checksum.slice(0, 12)}…</Badge>
          <Badge tone="success">Bản đã xuất bản (bất biến)</Badge>
        </div>
      </div>

      {/* ---- KPI strip. Real sources only; the cost tile of the concept art is
              deliberately ABSENT (see the honesty note at the bottom). -------- */}
      {ins ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard
            label="Định biên có người giữ"
            value={`${ins.kpi.headcount.filled}/${ins.kpi.headcount.seats}`}
            sub={`${ins.kpi.workload.zones} vùng trên sàn · nguồn: Position`}
            icon="👥"
            tone="primary"
          />
          <StatCard label="Tổng tải công việc" value={String(ins.kpi.workload.total)} sub="lớp ZONE_COLOR đã xuất bản" icon="📊" tone="info" />
          <StatCard
            label="Tỷ lệ đúng hạn"
            value={`${ins.kpi.onTime.rate}%`}
            sub={`${ins.kpi.onTime.onTimeCount}/${ins.kpi.onTime.totalWithDue} việc có hạn`}
            icon="⏱️"
            tone={ins.kpi.onTime.rate >= 90 ? "success" : ins.kpi.onTime.rate >= 75 ? "warning" : "error"}
          />
          <StatCard
            label="Việc quá hạn"
            value={String(ins.kpi.overdue.count)}
            sub="Work v2 · dueAt đã qua, chưa DONE"
            icon="🚨"
            tone={ins.kpi.overdue.count ? "error" : "success"}
          />
          <StatCard
            label="Sức khỏe vận hành"
            value={`${ins.kpi.health.score}/100`}
            sub={`đúng hạn ${ins.kpi.health.inputs.onTimeRate}% · cân tải ${ins.kpi.health.inputs.loadBalance}`}
            icon="💚"
            tone={ins.kpi.health.score >= 80 ? "success" : ins.kpi.health.score >= 60 ? "warning" : "error"}
          />
        </div>
      ) : (
        <SectionCard title="Chỉ số vận hành" accent="warning">
          <p className="text-sm text-gray-500 dark:text-dark-300">
            Không lấy được lớp phân tích (backend offline) — bản sao số bên dưới vẫn hoạt động với dữ liệu đã xuất bản.
          </p>
        </SectionCard>
      )}

      {/* ---- process rail: the REAL handoff chain, ordered by volume -------- */}
      {flows.length ? (
        <SectionCard
          title={`Chuỗi bàn giao liên phòng ban (${ins?.flowMeta.windowDays ?? 30} ngày)`}
          accent="info"
          bodyClassName="space-y-2"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {flows.map((f) => (
              <span
                key={`${f.fromZoneId}>${f.toZoneId}`}
                title={f.samples.join(" · ")}
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-500/10 px-2.5 py-1 text-xs text-gray-700 dark:text-dark-100"
              >
                <span className="font-medium">{f.fromLabel}</span>
                <span aria-hidden="true" className="text-sky-500">→</span>
                <span className="font-medium">{f.toLabel}</span>
                <span className="rounded-full bg-sky-500/20 px-1.5 font-semibold tabular-nums text-sky-600 dark:text-sky-300">{f.items}</span>
              </span>
            ))}
          </div>
          <p className="text-[11px] text-gray-400">{ins?.flowMeta.definition}</p>
          {ins?.flowMeta.sources
            .filter((s) => !s.available)
            .map((s) => (
              <p key={s.key} className="text-[11px] text-warning-darker dark:text-warning-lighter">
                Chưa có: {s.label} — {s.reason}
              </p>
            ))}
        </SectionCard>
      ) : null}

      {/* ---- the twin (2D/3D, zone-click drill-down) + the AI brief -------- */}
      <OfficeTwinWorkspace
        dashboardCode={rt.dashboard.code}
        scene={rt.scene}
        zones={zones}
        insightZones={insightZones}
        flows={flows}
        plan2d={rt.scene ? <TwinPlan2D scene={rt.scene} zones={zones} insightZones={insightZones} flows={flows} /> : null}
        aiBriefPanel={
          ins ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={ins.brief.source === "live" ? "primary" : "neutral"}>
                  {ins.brief.source === "live" ? "Claude (trực tiếp)" : "Bản suy luận tại chỗ"}
                </Badge>
                <Badge tone="warning">Bản nháp — cần người quyết định</Badge>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Nút thắt hiện tại</p>
                <p className="mt-1 text-sm text-gray-700 dark:text-dark-100">{ins.brief.bottleneck || "—"}</p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Khuyến nghị</p>
                <ul className="mt-1 space-y-1.5">
                  {ins.brief.recommendations.map((r, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700 dark:text-dark-100">
                      <span aria-hidden="true" className="text-primary-600">◆</span>
                      <span>{r}</span>
                    </li>
                  ))}
                  {!ins.brief.recommendations.length ? <li className="text-sm text-gray-400">Chưa có khuyến nghị.</li> : null}
                </ul>
              </div>

              <div className="rounded-lg border border-gray-200 p-2.5 dark:border-dark-600">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Xu hướng chỉ số (thật)</p>
                {ins.forecast.available ? (
                  <>
                    <p className="mt-1 text-sm text-gray-700 dark:text-dark-100">
                      {ins.forecast.metric.name}: {ins.forecast.points[ins.forecast.points.length - 1].value}
                      {ins.forecast.metric.unit} ({ins.forecast.delta >= 0 ? "+" : ""}
                      {ins.forecast.delta} so với kỳ trước)
                    </p>
                    <div className="mt-2 flex items-end gap-1" aria-hidden="true">
                      {(() => {
                        const vals = ins.forecast.points.map((pp) => pp.value);
                        const max = Math.max(1, ...vals);
                        const min = Math.min(0, ...vals);
                        return ins.forecast.points.map((p, i) => {
                          const h = Math.max(4, Math.round(((p.value - min) / Math.max(1, max - min)) * 32));
                          return <div key={i} className="w-2.5 rounded-t bg-primary-500/70" style={{ height: h }} title={`${p.value}`} />;
                        });
                      })()}
                    </div>
                    <p className="mt-0.5 text-[11px] text-gray-400">{ins.forecast.method}</p>
                  </>
                ) : (
                  <p className="mt-1 text-xs text-gray-500 dark:text-dark-300">{ins.forecast.reason}</p>
                )}
              </div>

              <p className="text-[11px] text-gray-400">{ins.brief.note}</p>
            </>
          ) : (
            <p className="text-sm text-gray-400">Không lấy được lớp phân tích.</p>
          )
        }
      />

      {/* ---- bottom row: status table · load column · pipeline · alerts ---- */}
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        <SectionCard title="Trạng thái phòng ban" accent="neutral">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-400 dark:border-dark-600">
                  <th className="py-1.5 font-medium">Phòng ban</th>
                  <th className="py-1.5 text-right font-medium">Định biên</th>
                  <th className="py-1.5 text-right font-medium">Tải</th>
                  <th className="py-1.5 text-right font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {insightZones.map((z) => (
                  <tr key={z.zoneId} className="border-b border-gray-100 last:border-0 dark:border-dark-700">
                    <td className="py-1.5 text-gray-700 dark:text-dark-100">{z.label}</td>
                    <td className="py-1.5 text-right tabular-nums text-gray-500 dark:text-dark-300">{z.filled}/{z.seats}</td>
                    <td className="py-1.5 text-right font-semibold tabular-nums text-gray-800 dark:text-dark-50">{z.workload}</td>
                    <td className="py-1.5 text-right">
                      <Badge tone={STATE_TONE[z.state as ZoneState]}>{STATE_LABEL[z.state as ZoneState]}</Badge>
                    </td>
                  </tr>
                ))}
                {!insightZones.length ? (
                  <tr><td colSpan={4} className="py-2 text-sm text-gray-400">Chưa có dữ liệu.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Tải theo phòng ban (ảnh chụp hiện tại)" accent="warning" bodyClassName="space-y-2">
          <ul className="space-y-2">
            {[...insightZones].sort((a, b) => b.workload - a.workload).map((z) => (
              <li key={z.zoneId}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-gray-700 dark:text-dark-100">{z.label}</span>
                  <span className="font-semibold tabular-nums text-gray-800 dark:text-dark-50">{z.workload}</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-150 dark:bg-dark-600">
                  <div className="h-full rounded-full" style={{ width: `${Math.round((z.workload / maxZoneLoad) * 100)}%`, background: STATE_FILL[z.state as ZoneState] }} />
                </div>
              </li>
            ))}
          </ul>
          {ins && !ins.heatmap.available ? <p className="text-[11px] text-gray-400">{ins.heatmap.reason}</p> : null}
        </SectionCard>

        <SectionCard title="Pipeline quy trình đang hoạt động" accent="info" bodyClassName="space-y-2">
          <ul className="space-y-2">
            {(ins?.pipeline ?? []).map((p) => (
              <li key={p.key}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-gray-700 dark:text-dark-100">{p.label}</span>
                  <span className="font-semibold tabular-nums text-gray-800 dark:text-dark-50">{p.count}</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-150 dark:bg-dark-600">
                  <div className="h-full rounded-full bg-primary-600" style={{ width: `${Math.round((p.count / maxPipeline) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
          {ins ? <p className="text-[11px] text-gray-400">{ins.pipelineNote}</p> : null}
        </SectionCard>

        <SectionCard title={`Cảnh báo trực tiếp (${ins?.alerts.length ?? 0})`} accent="error">
          <ul className="space-y-2">
            {(ins?.alerts ?? []).slice(0, 8).map((a, i) => (
              <li key={i} className="rounded-lg border border-gray-200 p-2 dark:border-dark-600">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-800 dark:text-dark-50">{a.title}</p>
                  <Badge tone={SEVERITY_TONE[a.severity]}>{SEVERITY_LABEL[a.severity]}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-dark-300">{a.detail}</p>
                <p className="mt-0.5 text-[11px] text-gray-400">
                  {a.zone ? `${a.zone} · ` : ""}nguồn: {a.source}
                </p>
              </li>
            ))}
            {!ins?.alerts.length ? <li className="text-sm text-gray-400">Không có cảnh báo nào.</li> : null}
          </ul>
        </SectionCard>
      </div>

      {/* ---- arrival/departure pattern: REAL AttendanceEvent data (PE-02), or
              the honest reason it's missing — never the 24h occupancy heatmap
              this data cannot prove (see the note below the chart). --------- */}
      <SectionCard
        title={`Phân bố giờ vào/ra${ins && ins.arrivalPattern.available ? ` (${ins.arrivalPattern.windowDays} ngày qua)` : ""}`}
        accent="neutral"
        bodyClassName="space-y-2"
      >
        {ins && ins.arrivalPattern.available ? (
          <>
            <div className="flex h-24 items-end gap-0.5" aria-hidden="true">
              {(() => {
                const ap = ins.arrivalPattern;
                const max = Math.max(1, ...ap.hours.flatMap((h) => [h.clockIns, h.clockOuts]));
                return ap.hours.map((h) => (
                  <div key={h.hour} className="flex flex-1 flex-col items-center justify-end gap-0.5" title={`${h.hour}h: ${h.clockIns} vào · ${h.clockOuts} ra`}>
                    <div className="flex w-full items-end gap-px" style={{ height: 80 }}>
                      <div className="flex-1 rounded-t bg-success" style={{ height: `${Math.round((h.clockIns / max) * 80)}px` }} />
                      <div className="flex-1 rounded-t bg-sky-500" style={{ height: `${Math.round((h.clockOuts / max) * 80)}px` }} />
                    </div>
                    <span className="text-[9px] text-gray-400">{h.hour}</span>
                  </div>
                ));
              })()}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500 dark:text-dark-300">
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-success" /> Vào</span>
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-sky-500" /> Ra</span>
            </div>
            <p className="text-[11px] text-gray-400">{ins.arrivalPattern.note}</p>
          </>
        ) : (
          <p className="text-sm text-gray-400">{ins && !ins.arrivalPattern.available ? ins.arrivalPattern.reason : "Không lấy được lớp phân tích."}</p>
        )}
      </SectionCard>

      <SectionCard title="Nguồn dữ liệu & những gì KHÔNG được dựng" accent="neutral" bodyClassName="space-y-2">
        <ul className="grid gap-2 sm:grid-cols-3">
          {Object.values(rt.dataLayers).map((l) => (
            <li key={l.dataLayerId} className="rounded-lg border border-gray-200 p-2.5 text-xs dark:border-dark-600">
              <p className="font-medium text-gray-800 dark:text-dark-50">{l.name}</p>
              <p className="mt-0.5 text-gray-400">
                {l.entityKey} · {l.aggregation.op}
                {l.aggregation.field ? `(${l.aggregation.field})` : ""} · nhóm theo {l.groupBy}
              </p>
              <p className="mt-0.5 text-gray-400">Hệ thống nguồn: {l.ownedBy}</p>
              {l.error ? <p className="mt-0.5 text-error">{l.error}</p> : null}
            </li>
          ))}
        </ul>
        {ins ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Cố ý bỏ trống (không bịa số)</p>
            <ul className="space-y-1">
              {ins.omitted.map((o) => (
                <li key={o.key} className="text-xs text-gray-500 dark:text-dark-300">
                  <span className="font-medium text-gray-700 dark:text-dark-100">{o.key}</span>: {o.reason}
                </li>
              ))}
              <li className="text-xs text-gray-500 dark:text-dark-300">
                <span className="font-medium text-gray-700 dark:text-dark-100">heatmap24h</span>: {ins.heatmap.reason}
              </li>
            </ul>
            <p className="text-[11px] text-gray-400">Công thức sức khỏe: {ins.kpi.health.formula}</p>
          </>
        ) : null}
        <p className="text-[11px] text-gray-400">Cập nhật lúc {new Date(rt.resolvedAt).toLocaleString("vi-VN")}</p>
      </SectionCard>
    </div>
  );
}
