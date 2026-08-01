import { Badge } from "@/xhub/ui/Badge";
import { StatCard } from "@/xhub/ui/StatCard";
import { listBackupSchedules, listTenants } from "@/xhub/platform/platform-data";
import { BackupScheduleTable, type TenantLite } from "@/xhub/platform/BackupScheduleTable";

export const metadata = { title: "Backup định kỳ · Platform Console" };
export const dynamic = "force-dynamic";

// Platform Console — per-tenant periodic backup + retention (PH-04 / SaaS
// non-negotiable #11). Each tenant has its OWN schedule, storage folder and
// retention. Gated platform.backup.read (nav) / platform.backup.manage (writes).
export default async function PlatformBackupsPage() {
  const [{ items: schedules, source }, { items: tenants }] = await Promise.all([
    listBackupSchedules(),
    listTenants(),
  ]);

  const enabled = schedules.filter((s) => s.enabled).length;
  const alerts = schedules.filter((s) => s.alert || s.lastStatus === "FAILED").length;
  const tenantsLite: TenantLite[] = tenants.map((t) => ({ id: t.id, name: t.name, tenantCode: t.tenantCode }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">Backup định kỳ</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
            Lịch backup + chính sách giữ (retention) theo từng tenant. Mỗi tenant có lịch riêng, thư mục lưu riêng, retention riêng.
          </p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>
          {source === "api" ? "Kết nối backend" : "Backend offline"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Tổng lịch" value={String(schedules.length)} icon="🗓️" tone="primary" />
        <StatCard label="Đang bật" value={String(enabled)} sub="backup tự động" icon="✅" tone="success" />
        <StatCard label="Cảnh báo lỗi" value={String(alerts)} sub="lần chạy gần nhất thất bại" icon="🚨" tone={alerts > 0 ? "warning" : "info"} />
      </div>

      <BackupScheduleTable schedules={schedules} tenants={tenantsLite} />
    </div>
  );
}
