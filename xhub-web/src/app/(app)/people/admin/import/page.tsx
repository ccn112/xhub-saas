import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import { listImportBatches } from "@/xoffice/lib/people-data";
import { AttendanceImportPanel } from "@/xoffice/people/AttendanceImportPanel";

export const metadata = { title: "Nhập chấm công · XHub" };
export const dynamic = "force-dynamic";

// PE-02 — HR-only import engine screen (gate people.hr.import.manage). Two-step
// "Excel Bridge": preview (parse+validate, nothing written) → commit (writes
// AttendanceEvent) → rollback (reverses exactly what that batch wrote).
export default async function AttendanceImportPage() {
  const { items: batches, source } = await listImportBatches();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Nhập dữ liệu chấm công</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">SME Lite: chấm công chỉ nạp qua file (chưa nối máy chấm công/HRIS thật). Xem trước trước khi ghi — không nhập ẩn.</p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>

      <SectionCard title="Nhập file chấm công (CSV: personId,date,clockIn,clockOut)" accent="primary">
        <AttendanceImportPanel batches={batches} />
      </SectionCard>
    </div>
  );
}
