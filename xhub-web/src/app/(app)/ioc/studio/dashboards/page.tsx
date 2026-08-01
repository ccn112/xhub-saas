import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import { listDashboards, listDataLayers, type Widget } from "@/xoffice/lib/ioc-data";

export const metadata = { title: "Trình dựng bảng điều khiển · XHub IOC" };
export const dynamic = "force-dynamic";

const WIDGET_LABEL: Record<string, string> = {
  KPI: "Thẻ KPI", GAUGE: "Đồng hồ", TREND: "Xu hướng", TABLE: "Bảng", HEATMAP: "Bản đồ nhiệt",
  ALERT_LIST: "Danh sách cảnh báo", AI_BRIEF: "Tóm tắt AI", FLOOR_2D: "Mặt bằng 2D", SCENE_3D: "Không gian 3D",
  PIPELINE: "Luồng", WORKLOAD_RANKING: "Xếp hạng tải", SKILL_MATRIX: "Ma trận kỹ năng", ACTION_LIST: "Danh sách hành động",
};

/** Render the 12-column grid the published payload declares — layout preview. */
function GridPreview({ widgets, layerNames }: { widgets: Widget[]; layerNames: Record<string, string> }) {
  const rows = Math.max(1, ...widgets.map((w) => w.layout.y + w.layout.h));
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridTemplateRows: `repeat(${rows}, 26px)` }}
    >
      {widgets.map((w) => (
        <div
          key={w.id}
          style={{ gridColumn: `${w.layout.x + 1} / span ${w.layout.w}`, gridRow: `${w.layout.y + 1} / span ${w.layout.h}` }}
          className="overflow-hidden rounded-md border border-primary-600/40 bg-primary-600/[0.07] px-1.5 py-1"
          title={`${w.type} · ${w.layout.w}×${w.layout.h}`}
        >
          <p className="truncate text-[10px] font-medium text-primary-700 dark:text-primary-300">{w.title ?? WIDGET_LABEL[w.type] ?? w.type}</p>
          <p className="truncate text-[9px] text-gray-400">
            {WIDGET_LABEL[w.type] ?? w.type}
            {w.dataLayerId ? ` · ${layerNames[w.dataLayerId] ?? w.dataLayerId}` : ""}
          </p>
        </div>
      ))}
    </div>
  );
}

// IOC-S05 — Dashboard Builder (DT-03). A dashboard is pure configuration: grid
// layout + closed-enum widget types + references to a scene and data layers.
// Adding one is a POST, never a deploy (AT-009). No custom JS/SQL/HTML is
// accepted in tenant configuration.
export default async function DashboardsPage() {
  const [dashboards, layers] = await Promise.all([listDashboards(), listDataLayers()]);
  const layerNames = Object.fromEntries(layers.items.map((l) => [l.id, l.code]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Trình dựng bảng điều khiển</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">
            Bố cục lưới 12 cột, widget thuộc danh mục đóng, gắn vào scene và lớp dữ liệu. Không chấp nhận JS/SQL/HTML tuỳ ý.
          </p>
        </div>
        <Badge tone={dashboards.source === "api" ? "success" : "warning"}>{dashboards.source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>

      {dashboards.items.map((d) => (
        <SectionCard
          key={d.id}
          title={`${d.code} · ${d.name}`}
          accent={d.status === "PUBLISHED" ? "success" : "neutral"}
          action={
            <div className="flex items-center gap-2">
              <Badge tone={d.status === "PUBLISHED" ? "success" : "neutral"}>{d.status === "PUBLISHED" ? `v${d.activeVersionNo}` : d.status}</Badge>
              {d.status === "PUBLISHED" ? (
                <Link href="/ioc/twin/office" className="rounded-md border border-gray-300 px-2 py-1 text-[11px] dark:border-dark-500 dark:text-dark-100">Xem trực tiếp</Link>
              ) : null}
            </div>
          }
        >
          <p className="mb-2 text-xs text-gray-400">
            {d.viewType} · {d.widgets?.length ?? 0} widget · bộ lọc chung: {d.globalFilters?.join(", ") || "—"}
          </p>
          <GridPreview widgets={d.widgets ?? []} layerNames={layerNames} />
        </SectionCard>
      ))}

      {dashboards.items.length === 0 ? (
        <SectionCard title="Chưa có bảng điều khiển" accent="warning">
          <p className="text-sm text-gray-600 dark:text-dark-200">Chạy <code>npm run seed:ioc</code> ở xhub-api để nạp mẫu Office Twin.</p>
        </SectionCard>
      ) : null}

      <SectionCard title="Danh mục widget được phép" accent="neutral">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(WIDGET_LABEL).map(([k, v]) => (
            <span key={k} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-dark-600 dark:text-dark-100">{v} <span className="text-gray-400">({k})</span></span>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Máy chủ từ chối widget ngoài danh mục này, widget mang <code>sql</code>/<code>script</code>/<code>html</code>,
          hoặc widget trỏ tới lớp dữ liệu không thuộc tenant.
        </p>
      </SectionCard>
    </div>
  );
}
