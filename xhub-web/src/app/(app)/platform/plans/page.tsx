import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { listPlans } from "@/xhub/platform/platform-data";

export const metadata = { title: "Gói dịch vụ · Platform Console" };
export const dynamic = "force-dynamic";

// Platform Console — subscription plan catalog (T011). Read-only view of the
// SHARED SubscriptionPlan catalog: tier, apps allowed, feature flags, limits.
// Gated platform.plan.read (nav uses platform.tenant.read).
function flagList(flags: Record<string, unknown>): string[] {
  return Object.entries(flags)
    .filter(([, v]) => v === true)
    .map(([k]) => k);
}

function limitLabel(limits: Record<string, unknown>): string {
  const parts: string[] = [];
  if (limits.maxUsers != null) parts.push(`${limits.maxUsers} user`);
  if (limits.storageGb != null) parts.push(`${limits.storageGb} GB`);
  if (limits.maxProjects != null) parts.push(`${limits.maxProjects} dự án`);
  return parts.length ? parts.join(" · ") : "Không giới hạn";
}

export default async function PlatformPlansPage() {
  const { items, source } = await listPlans();
  const billing = items.filter((p) => p.billingEnabled).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">Gói dịch vụ</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
            Danh mục gói đăng ký (SubscriptionPlan) — điểm thực thi entitlement duy nhất: ứng dụng được phép, cờ tính năng, hạn mức.
          </p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>
          {source === "api" ? "Kết nối backend" : "Backend offline"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Tổng số gói" value={String(items.length)} icon="📦" tone="primary" />
        <StatCard label="Có tính phí" value={String(billing)} sub="billingEnabled" icon="💳" tone="success" />
        <StatCard label="Demo / partner" value={String(items.length - billing)} sub="miễn phí" icon="🎁" tone="info" />
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-dark-600 dark:text-dark-300">
              <th className="px-3 py-2 font-medium">Mã</th>
              <th className="px-3 py-2 font-medium">Tên</th>
              <th className="px-3 py-2 font-medium">Tier</th>
              <th className="px-3 py-2 font-medium">Ứng dụng</th>
              <th className="px-3 py-2 font-medium">Cờ tính năng</th>
              <th className="px-3 py-2 font-medium">Hạn mức</th>
              <th className="px-3 py-2 font-medium">Billing</th>
              <th className="px-3 py-2 font-medium">Min No</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => {
              const apps = p.appsAllowed ?? [];
              const flags = flagList(p.featureFlags ?? {});
              return (
                <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-dark-700 dark:hover:bg-dark-800">
                  <td className="px-3 py-2 font-medium text-primary-600 dark:text-primary-400">{p.code}</td>
                  <td className="px-3 py-2 text-gray-800 dark:text-dark-50">{p.name}</td>
                  <td className="px-3 py-2"><Badge tone="neutral">{p.tier}</Badge></td>
                  <td className="px-3 py-2 text-gray-600 dark:text-dark-200">
                    {apps.includes("*") ? <Badge tone="info">Tất cả (*)</Badge> : (
                      <div className="flex flex-wrap gap-1">
                        {apps.map((a) => <span key={a} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-dark-600">{a}</span>)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-dark-200">
                    <div className="flex flex-wrap gap-1">
                      {flags.length ? flags.map((f) => <span key={f} className="rounded bg-primary-50 px-1.5 py-0.5 text-xs text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">{f}</span>) : <span className="text-gray-400">—</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-dark-200">{limitLabel(p.limits ?? {})}</td>
                  <td className="px-3 py-2"><Badge tone={p.billingEnabled ? "success" : "neutral"}>{p.billingEnabled ? "Có" : "Không"}</Badge></td>
                  <td className="px-3 py-2 tabular-nums text-gray-600 dark:text-dark-200">{p.customerTenantMinNo ?? "—"}</td>
                </tr>
              );
            })}
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-400">
                  Không có gói nào (backend offline hoặc chưa seed).
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
