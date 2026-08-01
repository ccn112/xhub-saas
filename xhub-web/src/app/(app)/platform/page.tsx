import Link from "next/link";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { getSummary, listTenants, classLabel, STATUS_TONES } from "@/xhub/platform/platform-data";

export const metadata = { title: "Tổng quan SaaS · Platform Console" };
export const dynamic = "force-dynamic";

export default async function PlatformOverviewPage() {
  const [{ summary, source }, { items }] = await Promise.all([getSummary(), listTenants()]);
  const active = summary.byStatus.ACTIVE ?? 0;
  const planned = summary.byStatus.PLANNED ?? 0;
  const customers =
    (summary.byClass.CUSTOMER ?? 0) + (summary.byClass.CUSTOMER_SUBSCRIBER ?? 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">Platform Console</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
            Quản trị nền tảng XHub SaaS — sổ đăng ký tenant, gói dịch vụ, sức khoẻ hệ thống. Tách khỏi 5 workspace tenant.
          </p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>
          {source === "api" ? "Kết nối backend" : "Backend offline"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Tổng tenant" value={String(summary.total)} icon="🏢" tone="primary" />
        <StatCard label="Đang hoạt động" value={String(active)} sub="status ACTIVE" icon="✅" tone="success" />
        <StatCard label="Đã hoạch định" value={String(planned)} sub="status PLANNED" icon="🗺️" tone="info" />
        <StatCard label="Khách hàng" value={String(customers)} sub="class CUSTOMER" icon="🤝" tone="warning" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-100">Theo hạng tenant</h2>
          <ul className="mt-3 space-y-2">
            {Object.entries(summary.byClass).map(([cls, n]) => (
              <li key={cls} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-dark-200">{classLabel(cls)}</span>
                <span className="font-semibold text-gray-800 dark:text-dark-50">{n}</span>
              </li>
            ))}
            {Object.keys(summary.byClass).length === 0 ? (
              <li className="text-sm text-gray-400">Chưa có dữ liệu.</li>
            ) : null}
          </ul>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-100">Theo trạng thái</h2>
          <ul className="mt-3 space-y-2">
            {Object.entries(summary.byStatus).map(([st, n]) => (
              <li key={st} className="flex items-center justify-between text-sm">
                <Badge tone={STATUS_TONES[st] ?? "neutral"}>{st}</Badge>
                <span className="font-semibold text-gray-800 dark:text-dark-50">{n}</span>
              </li>
            ))}
            {Object.keys(summary.byStatus).length === 0 ? (
              <li className="text-sm text-gray-400">Chưa có dữ liệu.</li>
            ) : null}
          </ul>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-100">Truy cập nhanh</h2>
          <Link href="/platform/tenants" className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400">
            Sổ đăng ký tenant →
          </Link>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.slice(0, 6).map((t) => (
            <Link
              key={t.id}
              href={`/platform/tenants/${t.tenantCode ?? t.id}`}
              className="rounded-lg border border-gray-200 p-3 text-sm hover:border-primary-400 dark:border-dark-600"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-800 dark:text-dark-50">{t.tenantCode ?? "—"}</span>
                <Badge tone={STATUS_TONES[t.status ?? ""] ?? "neutral"}>{t.status ?? "—"}</Badge>
              </div>
              <p className="mt-1 truncate text-gray-600 dark:text-dark-200">{t.name}</p>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
