"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge, type Tone } from "@/xhub/ui/Badge";
import { DataTable, type Column } from "@/xhub/ui/DataTable";
import { FormDrawer, FormSection } from "@/xhub/ui/form";
import { useToast } from "@/components/ui/Toast";
import { dateTimeVN } from "@/xhub/lib/format";
import { humanBytes, type BackupJob } from "@/features/tenant-admin/data";

const STATUS_TONE: Record<string, Tone> = { completed: "success", verifying: "warning", failed: "error", running: "info" };
const STATUS_LABEL: Record<string, string> = { completed: "Hoàn tất", verifying: "Đang xác minh", failed: "Thất bại", running: "Đang chạy" };

export function BackupsClient({ jobs, policy, live }: { jobs: BackupJob[]; policy: typeof import("@/features/tenant-admin/data").BACKUP_POLICY; live: boolean }) {
  const completed = jobs.filter((j) => j.status === "completed");
  const totalSize = completed.reduce((s, j) => s + j.sizeBytes, 0);

  const router = useRouter();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function createBackup() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/backup", { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("Đã tạo bản sao lưu logical cho tenant.");
      setCreateOpen(false);
      router.refresh();
    } catch {
      toast.error("Không tạo được bản sao lưu. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  const columns: Column<BackupJob>[] = [
    { key: "label", header: "Gói backup", cell: (j) => (<div><Link href={`/admin/backups/${j.id}`} className="font-medium text-gray-800 hover:text-primary-600 hover:underline dark:text-dark-100">{j.label}</Link><p className="text-xs text-gray-400">{j.id}</p></div>) },
    { key: "created", header: "Thời điểm", cell: (j) => <span className="text-gray-600 dark:text-dark-200">{dateTimeVN(j.createdAt)}</span> },
    { key: "size", header: "Dung lượng", cell: (j) => humanBytes(j.sizeBytes) },
    { key: "records", header: "Bản ghi", align: "right", cell: (j) => j.recordCount ? j.recordCount.toLocaleString("vi-VN") : "—" },
    { key: "checksum", header: "Checksum", cell: (j) => <Badge tone={j.checksumStatus === "PASS" ? "success" : j.checksumStatus === "PENDING" ? "warning" : "error"}>{j.checksumStatus}</Badge> },
    { key: "status", header: "Trạng thái", align: "right", cell: (j) => <Badge tone={STATUS_TONE[j.status] ?? "neutral"}>{STATUS_LABEL[j.status] ?? j.status}</Badge> },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Gói backup" value={String(jobs.length)} icon="💾" tone="primary" />
        <StatCard label="Hoàn tất" value={String(completed.length)} icon="✅" tone="success" />
        <StatCard label="Tổng dung lượng" value={humanBytes(totalSize)} icon="🗄️" tone="info" />
        <StatCard label="Checksum PASS" value={`${completed.filter((j) => j.checksumStatus === "PASS").length}/${completed.length}`} icon="🔐" tone="success" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="mb-3 flex items-center justify-end gap-2">
            <button type="button" onClick={() => setCreateOpen(true)} className="rounded-lg bg-primary-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">+ Tạo bản sao lưu</button>
          </div>
          <SectionCard title={`Danh sách gói (${jobs.length})`} bodyClassName="p-0">
            <DataTable columns={columns} rows={jobs} rowKey={(j) => j.id} minWidthClass="min-w-[760px]"
              empty={<p className="text-sm text-gray-500">Chưa có gói backup nào. Khi <code>/api/backup</code> sẵn sàng, các gói sẽ hiển thị tại đây.</p>} />
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard accent="neutral" title="Chính sách backup">
            <dl className="space-y-2 text-sm">
              <Row label="Chế độ" value={policy.backupMode} />
              <Row label="Hằng ngày" value={policy.schedule.daily} />
              <Row label="Hằng tuần" value={policy.schedule.weekly} />
              <Row label="Giữ (ngày/tuần/tháng)" value={`${policy.retention.dailyCopies}/${policy.retention.weeklyCopies}/${policy.retention.monthlyCopies}`} />
              <Row label="RPO / RTO" value={`${policy.targets.logicalBackupRpoHours}h / ${policy.targets.tenantRestoreRtoHours}h`} />
            </dl>
          </SectionCard>
          <SectionCard accent="error" title="Loại trừ khỏi gói (không secret)">
            <div className="flex flex-wrap gap-1">{policy.excludedContents.map((c) => <Badge key={c} tone="error">{c}</Badge>)}</div>
          </SectionCard>
        </div>
      </div>

      <FormDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Tạo bản sao lưu"
        description="Sao lưu logical toàn bộ dữ liệu nghiệp vụ của tenant (không gồm secret)."
        submitLabel="Tạo bản sao lưu"
        submitting={submitting}
        onSubmit={createBackup}
        footnote={<p className="rounded-lg bg-info/10 px-3 py-2 text-xs text-info-darker dark:text-info-lighter">Gói backup được mã hoá AES-256 và tự tính checksum để xác minh toàn vẹn. Secret/khoá không nằm trong gói.</p>}
      >
        <FormSection title="Phạm vi" description="Backup logical theo tenant — RLS đảm bảo chỉ dữ liệu của X-TECH.">
          <dl className="space-y-2 text-sm">
            <Row label="Loại gói" value="LOGICAL_TENANT" />
            <Row label="Chế độ" value={policy.backupMode} />
            <Row label="Mã hoá" value="AES-256" />
            <Row label="Loại trừ" value={`${policy.excludedContents.length} nhóm secret`} />
          </dl>
        </FormSection>
      </FormDrawer>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-2"><dt className="text-gray-400">{label}</dt><dd className="text-right font-medium text-gray-700 dark:text-dark-100">{value}</dd></div>;
}
