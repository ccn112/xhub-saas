import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { TwinPlan2D } from "@/components/ioc/TwinPlan2D";
import { TwinViewer } from "@/components/ioc/TwinViewer.client";
import {
  getDashboardRuntime,
  zoneMetrics,
  STATE_LABEL,
  STATE_TONE,
  type ZoneState,
  type LayerResult,
} from "@/xoffice/lib/ioc-data";

export const metadata = { title: "Office Digital Twin Command Center · XHub" };
export const dynamic = "force-dynamic";

// IOC-02 — Office Digital Twin Command Center (DT-02 + DT-03).
//
// The whole page is driven by ONE published DashboardVersion: layout, widgets,
// scene and data layers all come from the immutable payload, so a tenant can
// change this screen without a deploy (AT-009). Nothing about X-TECH's floors or
// departments is hardcoded here (Constitution #10) — the zone labels come from
// the SceneBinding → OrgUnit resolution done server-side.
//
// Constitution #9 / AT-007: the 2D plan and the zone list are SERVER-rendered
// and always present; the Babylon canvas is an opt-in overlay inside an error
// boundary.
export default async function OfficeTwinPage() {
  const rt = await getDashboardRuntime("DASH-OFFICE");

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
  const layers = Object.values(rt.dataLayers) as LayerResult[];
  const kpiWidgets = rt.widgets.filter((w) => w.type === "KPI");
  const rankWidget = rt.widgets.find((w) => w.type === "WORKLOAD_RANKING");
  const tableWidget = rt.widgets.find((w) => w.type === "TABLE");
  const rankLayer = rankWidget?.dataLayerId ? rt.dataLayers[rankWidget.dataLayerId] : undefined;
  const tableLayer = tableWidget?.dataLayerId ? rt.dataLayers[tableWidget.dataLayerId] : undefined;
  const maxRank = Math.max(1, ...(rankLayer?.rows ?? []).map((r) => r.value));
  const alerts = zones.filter((z) => z.state === "OVERLOADED" || z.state === "BUSY");

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

      {/* KPI row — driven by the published widget list, not by this file. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpiWidgets.map((w) => {
          const l = w.dataLayerId ? rt.dataLayers[w.dataLayerId] : undefined;
          return (
            <StatCard
              key={w.id}
              label={w.title ?? l?.name ?? w.id}
              value={l ? String(l.total) : "—"}
              sub={l ? `${l.rows.length} đơn vị · ${l.aggregation.op}` : "chưa có lớp dữ liệu"}
              icon="📊"
              tone="primary"
            />
          );
        })}
        <StatCard label="Cảnh báo tải" value={String(alerts.length)} sub={`${zones.length} vùng`} icon="🚨" tone={alerts.length ? "error" : "success"} />
      </div>

      <SectionCard title="Bản sao số văn phòng" accent="primary" bodyClassName="space-y-3">
        {rt.scene ? (
          <TwinViewer scene={rt.scene} zones={zones} plan2d={<TwinPlan2D scene={rt.scene} zones={zones} />} />
        ) : (
          <p className="text-sm text-gray-400">Scene chưa được xuất bản — hãy xuất bản trong Twin Studio.</p>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title={rankWidget?.title ?? "Xếp hạng tải theo phòng ban"} accent="warning">
          <ul className="space-y-2">
            {(rankLayer?.rows ?? []).map((r) => (
              <li key={r.key}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-gray-700 dark:text-dark-100">{r.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums text-gray-800 dark:text-dark-50">{r.value}</span>
                    <Badge tone={STATE_TONE[r.state as ZoneState]}>{STATE_LABEL[r.state as ZoneState]}</Badge>
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-150 dark:bg-dark-600">
                  <div className="h-full rounded-full bg-primary-600" style={{ width: `${Math.round((r.value / maxRank) * 100)}%` }} />
                </div>
              </li>
            ))}
            {!rankLayer ? <li className="text-sm text-gray-400">Widget chưa gắn lớp dữ liệu</li> : null}
          </ul>
        </SectionCard>

        <SectionCard title={tableWidget?.title ?? "Bảng dữ liệu"} accent="info">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-400 dark:border-dark-600">
                  <th className="py-1.5 font-medium">Đơn vị</th>
                  <th className="py-1.5 text-right font-medium">Giá trị</th>
                  <th className="py-1.5 text-right font-medium">Bản ghi</th>
                </tr>
              </thead>
              <tbody>
                {(tableLayer?.rows ?? []).map((r) => (
                  <tr key={r.key} className="border-b border-gray-100 last:border-0 dark:border-dark-700">
                    <td className="py-1.5 text-gray-700 dark:text-dark-100">{r.label}</td>
                    <td className="py-1.5 text-right font-semibold tabular-nums text-gray-800 dark:text-dark-50">{r.value}</td>
                    <td className="py-1.5 text-right tabular-nums text-gray-400">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!tableLayer ? <p className="text-sm text-gray-400">Widget chưa gắn lớp dữ liệu</p> : null}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Nguồn dữ liệu (chiếu, không phải sổ cái)" accent="neutral">
        <ul className="grid gap-2 sm:grid-cols-3">
          {layers.map((l) => (
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
        <p className="mt-2 text-[11px] text-gray-400">Cập nhật lúc {new Date(rt.resolvedAt).toLocaleString("vi-VN")}</p>
      </SectionCard>
    </div>
  );
}
