import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { listDashboards, listScenes, listDataLayers, getDashboardRuntime, STATE_LABEL, STATE_TONE, type ZoneState } from "@/xoffice/lib/ioc-data";

export const metadata = { title: "IOC — Trung tâm điều hành số · XHub" };
export const dynamic = "force-dynamic";

const VIEW_LABEL: Record<string, string> = {
  OFFICE_TWIN: "Bản sao số văn phòng",
  DEPARTMENT_CAPACITY: "Năng lực phòng ban",
  PROCESS_PIPELINE: "Luồng quy trình",
  PEOPLE_POSITION: "Nhân sự & vị trí",
  CUSTOM: "Tuỳ chỉnh",
};

// IOC-01 — IOC entry (DT-03). The executive door into the digital twin: which
// twin dashboards are published, the live state of the office twin, and the
// governed data layers feeding them. Everything is READ from /api/ioc/* — IOC
// owns no business fact of its own (Constitution #1).
export default async function IocEntryPage() {
  const [dashboards, scenes, layers] = await Promise.all([listDashboards(), listScenes(), listDataLayers()]);
  const office = await getDashboardRuntime("DASH-OFFICE");

  const published = dashboards.items.filter((d) => d.status === "PUBLISHED");
  const publishedScenes = scenes.items.filter((s) => s.status === "PUBLISHED");
  const zones = office?.scene?.zones ?? [];
  const workload = office ? Object.values(office.dataLayers).find((l) => l.visualMode === "ZONE_COLOR") : undefined;
  const overloaded = (workload?.rows ?? []).filter((r) => r.state === "OVERLOADED" || r.state === "BUSY");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">IOC — Trung tâm điều hành số</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">
            Bản sao số vận hành: không gian · vận hành · quản trị. IOC chỉ chiếu dữ liệu từ hệ thống nguồn, không tạo sổ cái mới.
          </p>
        </div>
        <Badge tone={dashboards.source === "api" ? "success" : "warning"}>{dashboards.source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Bảng điều khiển đã xuất bản" value={`${published.length}/${dashboards.items.length}`} icon="🖥️" tone="primary" />
        <StatCard label="Scene đã xuất bản" value={`${publishedScenes.length}/${scenes.items.length}`} icon="🏢" tone="info" />
        <StatCard label="Lớp dữ liệu có kiểm soát" value={String(layers.items.length)} sub="chỉ trường trong catalog" icon="🧭" tone="neutral" />
        <StatCard label="Phòng ban đang bận/quá tải" value={String(overloaded.length)} sub={`${zones.length} vùng trên mặt bằng`} icon="🔥" tone={overloaded.length ? "warning" : "success"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Bản sao số đang hoạt động" accent="primary">
          {office ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-dark-50">{office.dashboard.name}</p>
                  <p className="text-xs text-gray-400">
                    {VIEW_LABEL[office.dashboard.viewType] ?? office.dashboard.viewType} · phiên bản v{office.dashboard.versionNo} · checksum {office.dashboard.checksum.slice(0, 12)}…
                  </p>
                </div>
                <Link href="/ioc/twin/office" className="shrink-0 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white">Mở twin →</Link>
              </div>
              <ul className="space-y-1.5">
                {(workload?.rows ?? []).slice(0, 6).map((r) => (
                  <li key={r.key} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-gray-700 dark:text-dark-100">{r.label}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold tabular-nums text-gray-800 dark:text-dark-50">{r.value}</span>
                      <Badge tone={STATE_TONE[r.state as ZoneState]}>{STATE_LABEL[r.state as ZoneState]}</Badge>
                    </span>
                  </li>
                ))}
                {!workload ? <li className="text-sm text-gray-400">Chưa gắn lớp tải công việc</li> : null}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Chưa có bảng điều khiển nào được xuất bản — chạy <code>npm run seed:ioc</code> hoặc tạo trong Twin Studio.</p>
          )}
        </SectionCard>

        <SectionCard title="Bảng điều khiển twin" accent="info">
          <ul className="divide-y divide-gray-100 dark:divide-dark-600">
            {dashboards.items.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-dark-50">{d.code} · {d.name}</p>
                  <p className="text-xs text-gray-400">{VIEW_LABEL[d.viewType] ?? d.viewType} · {d.widgets?.length ?? 0} widget</p>
                </div>
                <Badge tone={d.status === "PUBLISHED" ? "success" : "neutral"}>{d.status === "PUBLISHED" ? `v${d.activeVersionNo}` : d.status}</Badge>
              </li>
            ))}
            {dashboards.items.length === 0 ? <li className="py-3 text-sm text-gray-400">Chưa có bảng điều khiển — chạy npm run seed:ioc</li> : null}
          </ul>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href="/ioc/studio" className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-primary-400 dark:border-dark-500 dark:text-dark-100">Twin Studio</Link>
            <Link href="/ioc/studio/data-layers" className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-primary-400 dark:border-dark-500 dark:text-dark-100">Lớp dữ liệu</Link>
            <Link href="/ioc/studio/dashboards" className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-primary-400 dark:border-dark-500 dark:text-dark-100">Bảng điều khiển</Link>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Phạm vi & giới hạn (theo Hiến chương IOC)" accent="neutral">
        <ul className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2 dark:text-dark-200">
          <li>• IOC là lớp chiếu + mô phỏng — không sở hữu Task, Approval, KPI hay nhân sự.</li>
          <li>• Mọi truy vấn đi qua catalog đã biên dịch ở máy chủ; frontend không gửi SQL.</li>
          <li>• Dữ liệu cá nhân mặc định ở mức tổng hợp phòng ban; xem chi tiết cần quyền riêng + ghi nhật ký.</li>
          <li>• 3D luôn có phương án 2D/danh sách; tắt WebGL vẫn dùng được đầy đủ.</li>
          <li>• Phiên bản đã xuất bản là bất biến; sửa tạo phiên bản mới, rollback không xoá.</li>
          <li>• Camera / chấm công / sinh trắc học bị CẤM tuyệt đối làm chỉ số năng suất cá nhân.</li>
        </ul>
      </SectionCard>
    </div>
  );
}
