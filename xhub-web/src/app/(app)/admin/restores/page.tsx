import { AdminHeader } from "@/features/tenant-admin/AdminHeader";
import { fetchRestores } from "@/features/tenant-admin/backup.server";
import { RESTORE_STATES } from "@/features/tenant-admin/data";
import { RestoresClient } from "./RestoresClient";

export const metadata = { title: "Khôi phục · Quản trị · XHub" };
export const dynamic = "force-dynamic";

export default async function AdminRestoresPage() {
  const { source, jobs } = await fetchRestores();
  return (
    <div className="space-y-4">
      <AdminHeader title="Khôi phục (restore)" subtitle="Máy trạng thái khôi phục 11 bước: sandbox → phân tích xung đột → xác minh → phê duyệt → áp dụng. Không có nút Restore đơn."
        chip={{ label: source === "api" ? "Kết nối /api/backup" : "Backend restore chưa sẵn — demo", tone: source === "api" ? "success" : "warning" }} />
      <RestoresClient jobs={jobs} states={RESTORE_STATES} live={source === "api"} />
    </div>
  );
}
