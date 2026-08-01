import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import { myAttendance, myAttendanceCorrections } from "@/xoffice/lib/people-data";
import { AttendanceCorrectionForm } from "@/xoffice/people/AttendanceCorrectionForm";

export const metadata = { title: "Chấm công · XHub" };
export const dynamic = "force-dynamic";

const statusTone: Record<string, "success" | "warning" | "info" | "neutral" | "error"> = {
  PRESENT: "success",
  LATE: "warning",
  HALF_DAY: "warning",
  ABSENT: "error",
  LEAVE: "info",
  HOLIDAY: "neutral",
  WEEKEND: "neutral",
};

const statusLabel: Record<string, string> = {
  PRESENT: "Có mặt",
  LATE: "Đi muộn",
  HALF_DAY: "Nửa ngày",
  ABSENT: "Vắng",
  LEAVE: "Nghỉ phép",
  HOLIDAY: "Ngày lễ",
  WEEKEND: "Cuối tuần",
};

const corrStatusTone: Record<string, "success" | "warning" | "info" | "error"> = {
  SUBMITTED: "info",
  APPROVED: "success",
  REJECTED: "error",
};

// PE-02 — Attendance & Correction. Data enters ONLY via file import (SME Lite,
// attendanceMode=FILE_IMPORT) — this screen is read-only for the employee
// except "báo sai" (correction request), which goes through the SAME approval
// queue as leave (no second approval mechanism).
export default async function AttendancePage() {
  const to = new Date();
  const from = new Date(to.getTime() - 13 * 24 * 60 * 60 * 1000);
  const [{ items: days, source }, { items: corrections }] = await Promise.all([myAttendance(from, to), myAttendanceCorrections()]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Chấm công</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">Dữ liệu nạp từ file chấm công (SME Lite) — 14 ngày gần nhất.</p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>

      <SectionCard title={`Chấm công của tôi (${days.length} ngày)`} accent="primary">
        <ul className="divide-y divide-gray-100 dark:divide-dark-600">
          {days.map((d) => (
            <li key={d.id} className="space-y-2 px-1 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-dark-50">{new Date(d.workDate).toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" })}</p>
                  <p className="text-xs text-gray-400">
                    {d.firstIn ? new Date(d.firstIn).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                    {" → "}
                    {d.lastOut ? new Date(d.lastOut).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                    {d.lateMinutes > 0 ? ` · muộn ${d.lateMinutes} phút` : ""}
                    {d.correctionApplied ? " · đã điều chỉnh" : ""}
                  </p>
                </div>
                <Badge tone={statusTone[d.status] ?? "neutral"}>{statusLabel[d.status] ?? d.status}</Badge>
              </div>
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-dark-100">Báo sai ngày này</summary>
                <div className="mt-2">
                  <AttendanceCorrectionForm workDate={new Date(d.workDate).toISOString().slice(0, 10)} />
                </div>
              </details>
            </li>
          ))}
          {days.length === 0 && <li className="py-3 text-sm text-gray-400">Chưa có dữ liệu chấm công — chờ HR nhập file hoặc chạy npm run seed:people-attendance.</li>}
        </ul>
      </SectionCard>

      <SectionCard title={`Báo cáo sai đã gửi (${corrections.length})`} accent="neutral">
        <ul className="divide-y divide-gray-100 dark:divide-dark-600">
          {corrections.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-1 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-800 dark:text-dark-50">{new Date(c.workDate).toLocaleDateString("vi-VN")}</p>
                <p className="text-xs text-gray-400">{c.reason}{c.decisionNote ? ` · ${c.decisionNote}` : ""}</p>
              </div>
              <Badge tone={corrStatusTone[c.status] ?? "neutral"}>{c.status}</Badge>
            </li>
          ))}
          {corrections.length === 0 && <li className="py-3 text-sm text-gray-400">Chưa có báo cáo sai nào.</li>}
        </ul>
      </SectionCard>
    </div>
  );
}
