import Link from "next/link";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { listProducts, PRODUCT_TYPE_LABEL, VERSION_STATUS_LABEL, VERSION_STATUS_TONE } from "@/xhub/engineering/engineering-data";

export const metadata = { title: "Phát triển & Chất lượng · XHub" };
export const dynamic = "force-dynamic";

export default async function EngineeringOverviewPage() {
  const { items, source } = await listProducts();
  const byType = items.reduce<Record<string, number>>((acc, p) => {
    acc[p.type] = (acc[p.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">Phát triển &amp; Chất lượng</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
            Product Registry + Version core (DG-01) — điểm khởi đầu của Development &amp; Quality Hub cho toàn hệ
            sinh thái. Feature/Backlog/Tài liệu/Kiểm thử/Lỗi/AI Engineering chưa xây (DG-02 trở đi) — xem{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-dark-700">docs/implementation/engineering-hub/IMPLEMENTATION_PLAN.md</code>.
          </p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>
          {source === "api" ? "Kết nối backend" : "Backend offline"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Tổng sản phẩm" value={String(items.length)} icon="📦" tone="primary" />
        <StatCard label="Nền tảng" value={String(byType.PLATFORM ?? 0)} sub="type PLATFORM" icon="🏛️" tone="info" />
        <StatCard label="Sản phẩm SaaS" value={String(byType.SAAS_PRODUCT ?? 0)} sub="type SAAS_PRODUCT" icon="☁️" tone="success" />
        <StatCard label="Chuyên ngành" value={String(byType.DOMAIN_PRODUCT ?? 0)} sub="type DOMAIN_PRODUCT" icon="🧩" tone="warning" />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-100">Sản phẩm (theo thứ tự rollout)</h2>
          <Link href="/engineering/products" className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400">
            Xem tất cả →
          </Link>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => {
            const latest = p.versions?.[0];
            return (
              <Link
                key={p.id}
                href={`/engineering/products/${p.code}`}
                className="rounded-lg border border-gray-200 p-3 text-sm hover:border-primary-400 dark:border-dark-600"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-800 dark:text-dark-50">{p.code}</span>
                  {latest ? (
                    <Badge tone={VERSION_STATUS_TONE[latest.status] ?? "neutral"}>
                      {latest.version} · {VERSION_STATUS_LABEL[latest.status] ?? latest.status}
                    </Badge>
                  ) : (
                    <span className="text-xs text-gray-400">chưa có version</span>
                  )}
                </div>
                <p className="mt-1 truncate text-gray-600 dark:text-dark-200">{p.name}</p>
                <p className="mt-1 text-xs text-gray-400">{PRODUCT_TYPE_LABEL[p.type] ?? p.type}</p>
              </Link>
            );
          })}
          {items.length === 0 ? (
            <p className="col-span-full text-sm text-gray-400">Chưa có sản phẩm nào (backend offline hoặc chưa seed).</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
