import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import { listIcons, ICON_GLYPHS } from "@/xoffice/lib/ioc-data";

export const metadata = { title: "Danh mục icon & asset · XHub IOC" };
export const dynamic = "force-dynamic";

// IOC-S07 — Icon & Asset Catalog (DT-01). BUILT_IN keys only in this phase
// (ADR-0006): the visual is a semantic token resolved in the FE, so no tenant
// binary is stored or served. SVG/GLB upload stays closed until an object-storage
// seam with sanitisation + checksum + quarantine exists.
export default async function AssetsPage() {
  const icons = await listIcons();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Danh mục icon & asset</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">Khoá icon dùng cho vùng phòng ban và đối tượng nghiệp vụ trên bản sao số.</p>
        </div>
        <Badge tone={icons.source === "api" ? "success" : "warning"}>{icons.source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>

      <SectionCard title={`Icon dựng sẵn (${icons.items.length})`} accent="primary">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {icons.items.map((i) => (
            <li key={i.id} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2.5 dark:border-dark-600">
              <span className="text-xl" aria-hidden="true">{ICON_GLYPHS[i.key] ?? "•"}</span>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-gray-800 dark:text-dark-50">{i.label}</p>
                <p className="truncate text-[11px] text-gray-400">{i.key}</p>
              </div>
            </li>
          ))}
          {icons.items.length === 0 ? <li className="text-sm text-gray-400">Chưa nạp danh mục — chạy <code>npm run seed:ioc</code>.</li> : null}
        </ul>
      </SectionCard>

      <SectionCard title="Tải asset tuỳ chỉnh (chưa mở)" accent="warning">
        <p className="text-sm text-gray-600 dark:text-dark-200">
          Tải SVG/GLB của tenant chưa được mở trong giai đoạn này. Nền tảng chưa có lớp lưu trữ object cùng quy trình
          làm sạch, checksum và cách ly (quarantine); nhận file tuỳ ý sẽ tạo bề mặt XSS/parser thực sự.
          Mặt bằng vẫn vẽ được và hiệu chỉnh tỷ lệ mét vẫn hoạt động mà không cần ảnh nền.
        </p>
      </SectionCard>
    </div>
  );
}
