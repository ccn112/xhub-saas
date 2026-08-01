import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { getReadiness, READINESS_CHECK_LABELS, type ReadinessCheck } from "@/xhub/platform/platform-data";

export const metadata = { title: "Sẵn sàng v1.0 · Platform Console" };
export const dynamic = "force-dynamic";

// Platform Console — v1.0 SaaS readiness dashboard (T011 exit gate). Overall
// status + the 10-point exit criteria + a per-check checklist grouped into
// platform-wide vs per-tenant. Fetches GET /api/platform/readiness.
function CheckTable({ title, rows }: { title: string; rows: ReadinessCheck[] }) {
  if (rows.length === 0) return null;
  return (
    <Card className="overflow-x-auto">
      <div className="border-b border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 dark:border-dark-600 dark:text-dark-100">{title}</div>
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-dark-600 dark:text-dark-300">
            <th className="px-3 py-2 font-medium">Trạng thái</th>
            <th className="px-3 py-2 font-medium">Phạm vi</th>
            <th className="px-3 py-2 font-medium">Kiểm tra</th>
            <th className="px-3 py-2 font-medium">Chi tiết</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => (
            <tr key={`${c.key}-${c.scope}-${i}`} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-dark-700 dark:hover:bg-dark-800">
              <td className="px-3 py-2"><Badge tone={c.status === "PASS" ? "success" : "error"}>{c.status === "PASS" ? "✓ PASS" : "✗ FAIL"}</Badge></td>
              <td className="px-3 py-2 font-medium text-gray-700 dark:text-dark-100">{c.scope}</td>
              <td className="px-3 py-2 text-gray-800 dark:text-dark-50">{READINESS_CHECK_LABELS[c.key] ?? c.key}</td>
              <td className="px-3 py-2 text-gray-500 dark:text-dark-300">{c.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export default async function PlatformReadinessPage() {
  const { report, source } = await getReadiness();

  if (!report) {
    return (
      <div className="space-y-4">
        <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">Sẵn sàng v1.0</h1>
        <Card className="p-6 text-center text-gray-400">Không lấy được báo cáo readiness (backend offline).</Card>
      </div>
    );
  }

  const platformChecks = report.checks.filter((c) => c.scope === "platform");
  const tenantChecks = report.checks.filter((c) => c.scope !== "platform");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">Sẵn sàng v1.0</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
            Cổng thoát (exit gate) SaaS v1.0 — chạy checklist trên hệ sinh thái đã seed. Cập nhật {new Date(report.generatedAt).toLocaleString("vi-VN")}.
          </p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>
          {source === "api" ? "Kết nối backend" : "Backend offline"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Tổng thể" value={report.ok ? "SẴN SÀNG" : "CHƯA ĐẠT"} icon={report.ok ? "✅" : "⛔"} tone={report.ok ? "success" : "warning"} />
        <StatCard label="Tenant ACTIVE" value={String(report.summary.activeTenants)} icon="🏢" tone="primary" />
        <StatCard label="Đạt" value={String(report.summary.passed)} sub={`/ ${report.summary.totalChecks} kiểm tra`} icon="✔️" tone="success" />
        <StatCard label="Lỗi" value={String(report.summary.failed)} icon="🚨" tone={report.summary.failed > 0 ? "warning" : "info"} />
      </div>

      <Card className="overflow-x-auto">
        <div className="border-b border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 dark:border-dark-600 dark:text-dark-100">Tiêu chí thoát v1.0</div>
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-dark-600 dark:text-dark-300">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Tiêu chí</th>
              <th className="px-3 py-2 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {report.exitCriteria.map((e) => (
              <tr key={`${e.n}-${e.key}`} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-dark-700 dark:hover:bg-dark-800">
                <td className="px-3 py-2 tabular-nums text-gray-600 dark:text-dark-200">{e.n}</td>
                <td className="px-3 py-2 text-gray-800 dark:text-dark-50">{e.key}</td>
                <td className="px-3 py-2"><Badge tone={e.status === "PASS" ? "success" : "error"}>{e.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <CheckTable title="Kiểm tra cấp nền tảng (platform)" rows={platformChecks} />
      <CheckTable title="Kiểm tra theo từng tenant" rows={tenantChecks} />
    </div>
  );
}
