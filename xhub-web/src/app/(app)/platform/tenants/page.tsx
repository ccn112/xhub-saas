import Link from "next/link";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import { listTenants, listPlans, listBlueprints, classLabel, STATUS_TONES, MODE_TONES, MODE_LABELS } from "@/xhub/platform/platform-data";
import { RegisterTenantForm } from "@/xhub/platform/RegisterTenantForm";
import { OnboardCustomerForm } from "@/xhub/platform/OnboardCustomerForm";

export const metadata = { title: "Sổ đăng ký tenant · Platform Console" };
export const dynamic = "force-dynamic";

export default async function PlatformTenantsPage() {
  const [{ items, source }, { items: plans }, { items: blueprints }] = await Promise.all([
    listTenants(),
    listPlans(),
    listBlueprints(),
  ]);
  const planOptions = plans.map((p) => ({ value: p.code, label: `${p.name} (${p.tier})` }));
  const blueprintOptions = blueprints.map((b) => ({ value: b.code, label: `${b.code} — ${b.name}` }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">Sổ đăng ký tenant</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
            T001 (chủ nền tảng) · T002–T010 (demo ngành) · T011+ (khách hàng). tenantNo bất biến, không tái sử dụng.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={source === "api" ? "success" : "warning"}>
            {source === "api" ? "Kết nối backend" : "Backend offline"}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <OnboardCustomerForm plans={planOptions} blueprints={blueprintOptions} />
        <RegisterTenantForm />
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-dark-600 dark:text-dark-300">
              <th className="px-3 py-2 font-medium">No</th>
              <th className="px-3 py-2 font-medium">Mã</th>
              <th className="px-3 py-2 font-medium">Tên</th>
              <th className="px-3 py-2 font-medium">Hạng</th>
              <th className="px-3 py-2 font-medium">Trạng thái</th>
              <th className="px-3 py-2 font-medium">Chế độ</th>
              <th className="px-3 py-2 font-medium">Gói</th>
              <th className="px-3 py-2 font-medium">Blueprint</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-dark-700 dark:hover:bg-dark-800">
                <td className="px-3 py-2 tabular-nums text-gray-600 dark:text-dark-200">{t.tenantNo ?? "—"}</td>
                <td className="px-3 py-2">
                  <Link href={`/platform/tenants/${t.tenantCode ?? t.id}`} className="font-medium text-primary-600 hover:underline dark:text-primary-400">
                    {t.tenantCode ?? t.id}
                  </Link>
                </td>
                <td className="px-3 py-2 text-gray-800 dark:text-dark-50">{t.name}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-dark-200">{classLabel(t.tenantClass)}</td>
                <td className="px-3 py-2"><Badge tone={STATUS_TONES[t.status ?? ""] ?? "neutral"}>{t.status ?? "—"}</Badge></td>
                <td className="px-3 py-2">{t.mode ? <Badge tone={MODE_TONES[t.mode] ?? "neutral"}>{MODE_LABELS[t.mode] ?? t.mode}</Badge> : <span className="text-gray-400">—</span>}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-dark-200">{t.planId ?? "—"}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-dark-200">{t.blueprintId ?? "—"}</td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-400">
                  Không có tenant nào (backend offline hoặc chưa seed).
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
