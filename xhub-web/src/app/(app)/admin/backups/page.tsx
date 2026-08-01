import { AdminHeader } from "@/features/tenant-admin/AdminHeader";
import { fetchBackups } from "@/features/tenant-admin/backup.server";
import { BACKUP_POLICY } from "@/features/tenant-admin/data";
import { BackupsClient } from "./BackupsClient";

export const metadata = { title: "Quản lý backup · Quản trị · XHub" };
export const dynamic = "force-dynamic";

export default async function AdminBackupsPage() {
  const { source, jobs } = await fetchBackups();
  return (
    <div className="space-y-4">
      <AdminHeader title="Quản lý backup" subtitle="Gói backup logic theo tenant (1 tenant/gói). Checksum, mã hoá và tồn kho file. Không chứa secret."
        chip={{ label: source === "api" ? "Kết nối /api/backup" : "Backend backup chưa sẵn — dữ liệu demo", tone: source === "api" ? "success" : "warning" }} />
      <BackupsClient jobs={jobs} policy={BACKUP_POLICY} live={source === "api"} />
    </div>
  );
}
