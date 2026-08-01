import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import TemplateGallery from "@/components/ioc/TemplateGallery.client";
import { listTemplates } from "@/xoffice/lib/ioc-data";

export const metadata = { title: "Thư viện mẫu bản sao số · XHub IOC" };
export const dynamic = "force-dynamic";

// IOC-S07 — Template gallery (DT-04). The PRIMARY entry point of Twin Studio:
// người dùng xem bộ template mẫu/chuẩn → nhân bản → sửa, thay vì vẽ từ trang
// trắng. `IocTemplate` là danh mục DÙNG CHUNG cấp nền tảng (không tenantId,
// không RLS — cùng thế đứng với Blueprint); thao tác "Nhân bản" tạo bản sao
// NHÁP thuộc về chính tenant đang đăng nhập.
export default async function TemplateGalleryPage() {
  const { items, source } = await listTemplates();
  const zones = items.reduce((s, t) => s + t.zoneCount, 0);
  const layers = items.reduce((s, t) => s + t.dataLayerCount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Thư viện mẫu bản sao số</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">
            Chọn một bản mô phỏng mẫu theo ngành, xem trước mặt bằng và lớp dữ liệu, rồi <strong>nhân bản</strong> thành bản nháp của
            riêng bạn để chỉnh sửa. Không cần vẽ từ trang trắng.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
          <Link href="/ioc/studio" className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium dark:border-dark-500 dark:text-dark-100">
            Về Twin Studio
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Template chuẩn" value={String(items.length)} icon="🗂️" tone="primary" />
        <StatCard label="Vùng mẫu" value={String(zones)} icon="📐" tone="info" />
        <StatCard label="Lớp dữ liệu mẫu" value={String(layers)} icon="🧭" tone="neutral" />
      </div>

      <SectionCard title="Cách hoạt động" accent="primary">
        <ol className="flex flex-wrap items-center gap-2 text-xs">
          {["Xem template mẫu", "Nhân bản vào tenant của bạn", "Gán đơn vị còn thiếu", "Chỉnh mặt bằng", "Xuất bản (bất biến)"].map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span className="rounded-full bg-primary-600/10 px-2.5 py-1 font-medium text-primary-700 dark:text-primary-300">
                {i + 1}. {s}
              </span>
              {i < 4 ? <span className="text-gray-300">→</span> : null}
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-gray-500 dark:text-dark-300">
          Template là danh mục DÙNG CHUNG của nền tảng: nó chỉ chứa hình học và tham chiếu danh mục, không chứa dữ liệu của bất kỳ
          tenant nào. Khi nhân bản, hệ thống tạo bản sao thuộc tenant của bạn và cố gắng gán từng vùng vào đơn vị THẬT trong cây tổ
          chức của bạn. Vùng không tìm được đơn vị phù hợp sẽ để trống — hệ thống không tự tạo đơn vị ảo, và lớp dữ liệu cần chỉ số
          mà tenant chưa có sẽ bị bỏ qua thay vì hiển thị số giả.
        </p>
      </SectionCard>

      <SectionCard title={`Bộ template (${items.length})`} accent="primary">
        <TemplateGallery templates={items} />
      </SectionCard>
    </div>
  );
}
