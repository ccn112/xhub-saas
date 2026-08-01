import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { listSites, listPlans, listScenes, listDataLayers, listDashboards } from "@/xoffice/lib/ioc-data";

export const metadata = { title: "Twin Studio · XHub IOC" };
export const dynamic = "force-dynamic";

const statusTone: Record<string, "success" | "warning" | "info" | "neutral"> = {
  PUBLISHED: "success",
  IN_REVIEW: "warning",
  DRAFT: "neutral",
  SUPERSEDED: "info",
  ARCHIVED: "neutral",
};

// IOC-S01 — Twin Studio home (DT-01). The configuration chain in one screen:
// Site → Floor → FloorPlan → Scene (+ bindings) → DataLayer → Dashboard.
export default async function TwinStudioPage() {
  const [sites, plans, scenes, layers, dashboards] = await Promise.all([
    listSites(), listPlans(), listScenes(), listDataLayers(), listDashboards(),
  ]);
  const floors = sites.items.flatMap((s) => s.floors ?? []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Twin Studio</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">
            Cấu hình bản sao số: mặt bằng → vùng → gán đơn vị → lớp dữ liệu → bảng điều khiển. Không cần lập trình viên.
          </p>
        </div>
        <Badge tone={sites.source === "api" ? "success" : "warning"}>{sites.source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Địa điểm" value={String(sites.items.length)} icon="📍" tone="neutral" />
        <StatCard label="Tầng" value={String(floors.length)} icon="🏢" tone="neutral" />
        <StatCard label="Mặt bằng" value={String(plans.items.length)} icon="📐" tone="info" />
        <StatCard label="Scene" value={String(scenes.items.length)} icon="🎬" tone="primary" />
        <StatCard label="Lớp dữ liệu" value={String(layers.items.length)} icon="🧭" tone="neutral" />
      </div>

      <SectionCard title="Chuỗi cấu hình" accent="primary">
        <ol className="flex flex-wrap items-center gap-2 text-xs">
          {["Địa điểm/Tầng", "Mặt bằng (mét)", "Vùng phòng ban", "Gán OrgUnit + icon", "Lớp dữ liệu", "Bảng điều khiển", "Xuất bản (bất biến)"].map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span className="rounded-full bg-primary-600/10 px-2.5 py-1 font-medium text-primary-700 dark:text-primary-300">{i + 1}. {s}</span>
              {i < 6 ? <span className="text-gray-300">→</span> : null}
            </li>
          ))}
        </ol>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title={`Scene (${scenes.items.length})`} accent="primary">
          <ul className="divide-y divide-gray-100 dark:divide-dark-600">
            {scenes.items.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <Link href={`/ioc/studio/scenes/${s.id}/floor-plan`} className="truncate text-sm font-medium text-gray-800 hover:text-primary-600 dark:text-dark-50">{s.name}</Link>
                  <p className="text-xs text-gray-400">{s.bindings?.length ?? 0} vùng đã gán · chủ đề {s.themeKey}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={statusTone[s.status] ?? "neutral"}>{s.status === "PUBLISHED" ? `v${s.activeVersionNo}` : s.status}</Badge>
                  <Link href={`/ioc/studio/scenes/${s.id}/3d`} className="rounded-md border border-gray-300 px-2 py-1 text-[11px] dark:border-dark-500 dark:text-dark-100">3D</Link>
                </div>
              </li>
            ))}
            {scenes.items.length === 0 ? <li className="py-3 text-sm text-gray-400">Chưa có scene — chạy <code>npm run seed:ioc</code> ở xhub-api.</li> : null}
          </ul>
        </SectionCard>

        <SectionCard title={`Mặt bằng (${plans.items.length})`} accent="info">
          <ul className="divide-y divide-gray-100 dark:divide-dark-600">
            {plans.items.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-dark-50">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.geometry?.zones?.length ?? 0} vùng · {p.metersPerUnit} m/đơn vị · revision {p.revision}</p>
                </div>
                <Badge tone={statusTone[p.status] ?? "neutral"}>{p.status === "PUBLISHED" ? `v${p.activeVersionNo}` : p.status}</Badge>
              </li>
            ))}
            {plans.items.length === 0 ? <li className="py-3 text-sm text-gray-400">Chưa có mặt bằng.</li> : null}
          </ul>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Lớp dữ liệu" accent="neutral">
          <p className="text-sm text-gray-600 dark:text-dark-200">{layers.items.length} lớp truy vấn có kiểm soát trên các thực thể sẵn có.</p>
          <Link href="/ioc/studio/data-layers" className="mt-2 inline-block text-sm font-medium text-primary-600 hover:underline">Mở trình dựng lớp dữ liệu →</Link>
        </SectionCard>
        <SectionCard title="Bảng điều khiển" accent="neutral">
          <p className="text-sm text-gray-600 dark:text-dark-200">{dashboards.items.length} bảng · {dashboards.items.filter((d) => d.status === "PUBLISHED").length} đã xuất bản.</p>
          <Link href="/ioc/studio/dashboards" className="mt-2 inline-block text-sm font-medium text-primary-600 hover:underline">Mở trình dựng bảng →</Link>
        </SectionCard>
        <SectionCard title="Rà soát & xuất bản" accent="neutral">
          <p className="text-sm text-gray-600 dark:text-dark-200">Lịch sử phiên bản, checksum và rollback cho mọi bản sao số.</p>
          <Link href="/ioc/studio/publish" className="mt-2 inline-block text-sm font-medium text-primary-600 hover:underline">Mở trang xuất bản →</Link>
        </SectionCard>
      </div>
    </div>
  );
}
