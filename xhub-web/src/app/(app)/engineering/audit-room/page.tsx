import Link from "next/link";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import {
  listProducts,
  listControlImplementations,
  listAISystems,
  listProcessingActivities,
  CONTROL_IMPL_STATUS_LABEL,
} from "@/xhub/engineering/engineering-data";

export const metadata = { title: "Phòng kiểm toán (Audit Room) · Phát triển & Chất lượng" };
export const dynamic = "force-dynamic";

function StatCard({ label, value, href, tone }: { label: string; value: string | number; href: string; tone: "neutral" | "success" | "warning" | "error" }) {
  const toneClass = {
    neutral: "text-gray-700 dark:text-dark-100",
    success: "text-green-600 dark:text-green-400",
    warning: "text-amber-600 dark:text-amber-400",
    error: "text-red-600 dark:text-red-400",
  }[tone];
  return (
    <Link href={href}>
      <Card className="p-4 hover:border-primary-400">
        <p className="text-xs text-gray-500 dark:text-dark-300">{label}</p>
        <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
      </Card>
    </Link>
  );
}

export default async function EngineeringAuditRoomPage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string }>;
}) {
  const sp = await searchParams;
  const { items: products, source } = await listProducts();
  const productId = sp.productId ?? products[0]?.id ?? "";

  const [{ items: implementations }, { items: aiSystems }, { items: activities }] = await Promise.all([
    productId ? listControlImplementations(productId) : Promise.resolve({ items: [] as any[] }),
    listAISystems(productId || undefined),
    listProcessingActivities(productId || undefined),
  ]);

  const inPlace = implementations.filter((i) => i.status === "IN_PLACE").length;
  const partial = implementations.filter((i) => i.status === "PARTIAL").length;
  const proposed = implementations.filter((i) => i.status === "PROPOSED").length;
  const aiNeedsAssessment = aiSystems.filter((s) => !s.impactAssessments[0] || s.impactAssessments[0].status !== "APPROVED").length;
  const dpiaNeedsAssessment = activities.filter((a) => !a.assessments[0] || a.assessments[0].status !== "APPROVED").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">Phòng kiểm toán (Audit Room) — bản rút gọn</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
            Tổng hợp trạng thái kiểm soát/AI/dữ liệu cá nhân theo sản phẩm (DG-12-lite). Chỉ đọc, tổng hợp từ dữ
            liệu thật — không phải bằng chứng đã được kiểm toán độc lập.
          </p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-500 dark:text-dark-300">Sản phẩm:</span>
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/engineering/audit-room?productId=${p.id}`}
              className={`rounded-full border px-3 py-1 ${p.id === productId ? "border-primary-500 bg-primary-50 font-medium text-primary-700 dark:bg-primary-500/10 dark:text-primary-300" : "border-gray-200 text-gray-600 dark:border-dark-600 dark:text-dark-200"}`}
            >
              {p.code}
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label={`Kiểm soát: ${CONTROL_IMPL_STATUS_LABEL.IN_PLACE}`} value={inPlace} href={`/engineering/controls?productId=${productId}`} tone="success" />
        <StatCard label={`Kiểm soát: ${CONTROL_IMPL_STATUS_LABEL.PARTIAL}`} value={partial} href={`/engineering/controls?productId=${productId}`} tone="warning" />
        <StatCard label={`Kiểm soát: ${CONTROL_IMPL_STATUS_LABEL.PROPOSED}`} value={proposed} href={`/engineering/controls?productId=${productId}`} tone="neutral" />
        <StatCard label="Hệ thống AI cần đánh giá tác động" value={aiNeedsAssessment} href="/engineering/ai-systems" tone={aiNeedsAssessment > 0 ? "warning" : "success"} />
        <StatCard label="Hoạt động xử lý dữ liệu cần DPIA" value={dpiaNeedsAssessment} href="/engineering/privacy" tone={dpiaNeedsAssessment > 0 ? "warning" : "success"} />
        <StatCard label="Tổng hệ thống AI đã đăng ký" value={aiSystems.length} href="/engineering/ai-systems" tone="neutral" />
      </div>

      <Card className="p-4 text-sm text-gray-500 dark:text-dark-300">
        <p>
          Đây là bản rút gọn (lite) của khái niệm Audit Room — tổng hợp trạng thái, chưa có sổ bằng chứng
          (Evidence Ledger) hiển thị trực tiếp trên trang này, chưa có phân quyền riêng cho vai trò Auditor. Xem{" "}
          <code className="rounded bg-gray-100 px-1 py-0.5 dark:bg-dark-700">docs/implementation/engineering-hub/IMPLEMENTATION_PLAN.md</code> mục DG-12.
        </p>
      </Card>
    </div>
  );
}
