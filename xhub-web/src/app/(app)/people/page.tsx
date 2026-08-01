import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import { StatCard } from "@/xhub/ui/StatCard";
import { myLeaveBalances, listMyLeaveRequests } from "@/xoffice/lib/people-data";

export const metadata = { title: "Nhân sự & Công · XHub" };
export const dynamic = "force-dynamic";

const statusTone: Record<string, "success" | "warning" | "info" | "neutral" | "error"> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  IN_REVIEW: "info",
  APPROVED: "success",
  REJECTED: "error",
  CHANGES_REQUESTED: "warning",
  CANCEL_REQUESTED: "warning",
  CANCELLED: "neutral",
};

// PE-01 — People Essentials home. Balance tiles per leave policy (SME Lite:
// X.Office is the SoR — see PeopleTenantConfig.leaveMode) + upcoming/pending
// requests. Other People Essentials modules (attendance/payslip/timesheet/
// performance) are NOT built yet (PE-02..08) — intentionally absent here, not
// hidden behind a fake "coming soon" tile that implies more than what ships.
export default async function PeopleHomePage() {
  const [{ items: balances, periodCode, source }, { items: requests }] = await Promise.all([
    myLeaveBalances(),
    listMyLeaveRequests(),
  ]);
  const pending = requests.filter((r) => ["SUBMITTED", "IN_REVIEW", "CHANGES_REQUESTED"].includes(r.status));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Nhân sự & Công — của tôi</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">Số dư nghỉ phép kỳ {periodCode || "—"} · chế độ SME Lite (X.Office là nguồn dữ liệu gốc)</p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {balances.map(({ policy, balance }) => (
          <StatCard
            key={policy.id}
            label={policy.name}
            value={`${balance.available} ${balance.unit === "DAY" ? "ngày" : "giờ"}`}
            sub={balance.pending > 0 ? `${balance.pending} đang chờ duyệt` : policy.paid ? "Có lương" : "Không lương"}
            tone={balance.available <= 0 ? "warning" : "primary"}
          />
        ))}
        {balances.length === 0 && (
          <div className="col-span-full text-sm text-gray-400">Chưa có chính sách nghỉ phép — chạy npm run seed:people-leave</div>
        )}
      </div>

      <SectionCard title={`Đơn đang chờ (${pending.length})`} accent="warning">
        <ul className="divide-y divide-gray-100 dark:divide-dark-600">
          {pending.map((r) => (
            <li key={r.id}>
              <Link href={`/people/leave`} className="flex items-center justify-between gap-3 px-1 py-2.5 hover:bg-gray-50 dark:hover:bg-dark-600/40">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-dark-50">
                    {r.leaveTypeCode} · {new Date(r.startAt).toLocaleDateString("vi-VN")} → {new Date(r.endAt).toLocaleDateString("vi-VN")}
                  </p>
                  <p className="text-xs text-gray-400">{r.durationValue} {r.durationUnit === "DAY" ? "ngày" : "giờ"}</p>
                </div>
                <Badge tone={statusTone[r.status] ?? "neutral"}>{r.status}</Badge>
              </Link>
            </li>
          ))}
          {pending.length === 0 && <li className="py-3 text-sm text-gray-400">Không có đơn nào đang chờ duyệt.</li>}
        </ul>
      </SectionCard>

      <div className="flex gap-2">
        <Link href="/people/leave" className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700">
          Tạo đơn nghỉ phép
        </Link>
        <Link href="/people/team/availability" className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-dark-600 dark:text-dark-100 dark:hover:bg-dark-600/40">
          Xem lịch hiện diện nhóm
        </Link>
      </div>
    </div>
  );
}
