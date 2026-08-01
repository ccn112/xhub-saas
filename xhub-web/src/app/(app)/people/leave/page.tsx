import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import { listLeavePolicies, listMyLeaveRequests } from "@/xoffice/lib/people-data";
import { LeaveRequestForm } from "@/xoffice/people/LeaveRequestForm";
import { LeaveCancelButton } from "@/xoffice/people/LeaveCancelButton";

export const metadata = { title: "Nghỉ phép · XHub" };
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

// PE-01 — Leave & Availability, self-service leave request screen. Approval
// happens via the platform's existing /approvals + /inbox (ApprovalTask) — this
// screen never duplicates a second approval queue (PE_UI_MOBILE_PLAN constraint).
export default async function LeavePage() {
  const [{ items: policies, source: policiesSource }, { items: requests, source }] = await Promise.all([
    listLeavePolicies(),
    listMyLeaveRequests(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Nghỉ phép</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">Đơn được duyệt qua Trung tâm phê duyệt / Hộp việc chung — không tạo hàng đợi riêng.</p>
        </div>
        <Badge tone={source === "api" && policiesSource === "api" ? "success" : "warning"}>{source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>

      <SectionCard title="Tạo đơn nghỉ phép mới" accent="primary">
        {policies.length > 0 ? (
          <LeaveRequestForm policies={policies} />
        ) : (
          <p className="text-sm text-gray-400">Chưa có chính sách nghỉ phép — chạy npm run seed:people-leave.</p>
        )}
      </SectionCard>

      <SectionCard title={`Đơn của tôi (${requests.length})`} accent="neutral">
        <ul className="divide-y divide-gray-100 dark:divide-dark-600">
          {requests.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-1 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-800 dark:text-dark-50">
                  {r.leaveTypeCode} · {new Date(r.startAt).toLocaleDateString("vi-VN")} → {new Date(r.endAt).toLocaleDateString("vi-VN")} · {r.durationValue}{r.durationUnit === "DAY" ? " ngày" : " giờ"}
                </p>
                <p className="text-xs text-gray-400">{r.reason || "—"}{r.decisionNote ? ` · Ghi chú duyệt: ${r.decisionNote}` : ""}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={statusTone[r.status] ?? "neutral"}>{r.status}</Badge>
                <LeaveCancelButton id={r.id} status={r.status} />
              </div>
            </li>
          ))}
          {requests.length === 0 && <li className="py-3 text-sm text-gray-400">Chưa có đơn nghỉ phép nào.</li>}
        </ul>
      </SectionCard>
    </div>
  );
}
