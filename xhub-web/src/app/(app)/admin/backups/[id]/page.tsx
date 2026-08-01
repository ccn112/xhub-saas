import { notFound } from "next/navigation";
import { SectionCard } from "@/xhub/ui/Card";
import { RestoreLauncher } from "./RestoreLauncher";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { AdminHeader, DefRow } from "@/features/tenant-admin/AdminHeader";
import { fetchBackup } from "@/features/tenant-admin/backup.server";
import { BACKUP_POLICY, humanBytes } from "@/features/tenant-admin/data";
import { dateTimeVN } from "@/xhub/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `${id} · Backup · XHub` };
}

export default async function BackupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { source, job } = await fetchBackup(id);
  if (!job) notFound();

  const restoreEligible = job.status === "completed" && job.checksumStatus === "PASS";

  return (
    <div className="space-y-4">
      <AdminHeader title={job.label} subtitle={`${job.id} · ${job.mode}`} back={{ href: "/admin/backups", label: "Quản lý backup" }}
        chip={{ label: source === "api" ? "Kết nối /api/backup" : "Dữ liệu demo", tone: source === "api" ? "success" : "warning" }} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Dung lượng" value={humanBytes(job.sizeBytes)} icon="🗄️" tone="primary" />
        <StatCard label="Bản ghi" value={job.recordCount ? job.recordCount.toLocaleString("vi-VN") : "—"} icon="📊" tone="info" />
        <StatCard label="File" value={String(job.fileCount)} icon="📁" tone="neutral" />
        <StatCard label="Checksum" value={job.checksumStatus} icon="🔐" tone={job.checksumStatus === "PASS" ? "success" : "warning"} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard accent="neutral" title="Manifest">
          <dl className="space-y-2 text-sm">
            <DefRow label="Chế độ" value={job.mode} />
            <DefRow label="Tạo lúc" value={dateTimeVN(job.createdAt)} />
            <DefRow label="Mã hoá" value={<Badge tone={job.encrypted ? "success" : "error"}>{job.encrypted ? "AES-256 (bật)" : "Chưa mã hoá"}</Badge>} />
            <DefRow label="Đủ điều kiện restore" value={<Badge tone={restoreEligible ? "success" : "warning"}>{restoreEligible ? "Đủ điều kiện" : "Chưa"}</Badge>} />
          </dl>
        </SectionCard>

        <SectionCard title="Module trong gói" bodyClassName="p-0">
          <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto text-sm dark:divide-dark-600">
            {BACKUP_POLICY.requiredContents.map((m) => (
              <li key={m} className="flex items-center justify-between px-4 py-2"><span className="font-mono text-xs text-gray-700 dark:text-dark-100">{m}</span><Badge tone="success">✓</Badge></li>
            ))}
          </ul>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard accent="error" title="Không nằm trong gói">
            <div className="flex flex-wrap gap-1">{BACKUP_POLICY.excludedContents.map((c) => <Badge key={c} tone="error">{c}</Badge>)}</div>
            <p className="mt-2 text-xs text-gray-400">Gói không chứa mật khẩu/secret/token — thoả gate isolation (MUST_NOT_LEAK).</p>
          </SectionCard>
          <SectionCard accent="neutral" title="Khôi phục">
            <p className="text-sm text-gray-600 dark:text-dark-200">Khôi phục phải đi qua máy trạng thái restore (sandbox → xung đột → phê duyệt), không có nút “Restore” đơn.</p>
            <RestoreLauncher backupId={job.id} eligible={restoreEligible} />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
