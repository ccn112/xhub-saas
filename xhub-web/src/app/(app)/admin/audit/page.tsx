import { AdminHeader } from "@/features/tenant-admin/AdminHeader";
import { getAuditLogs } from "@/features/tenant-admin/data";
import { userName } from "@/xhub/lib/repo";
import { AuditClient, type AuditRow } from "./AuditClient";

export const metadata = { title: "Nhật ký kiểm toán · Quản trị · XHub" };

export default function AdminAuditPage() {
  const rows: AuditRow[] = getAuditLogs()
    .slice()
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .map((e) => ({
      id: e.id, actor: userName(e.actorId), action: e.action, entity: `${e.entityType}/${e.entityId}`,
      at: e.at, ip: e.ip, correlationId: (e.metadata?.["correlationId"] as string) ?? `corr-${e.id}`,
      metadata: e.metadata ?? {},
    }));
  return (
    <div className="space-y-4">
      <AdminHeader title="Nhật ký kiểm toán" subtitle="Bộ lọc nâng cao, dòng thời gian sự kiện, before/after và chuỗi correlation. Xuất theo quyền."
        chip={{ label: "AUDITOR", tone: "info" }} />
      <AuditClient rows={rows} />
    </div>
  );
}
