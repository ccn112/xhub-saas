import Link from "next/link";
import clsx from "clsx";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import { teamAvailability, teamLeaveRequests } from "@/xoffice/lib/people-data";
import { LeaveApprovalButtons } from "@/xoffice/people/LeaveApprovalButtons";

export const metadata = { title: "Lịch hiện diện nhóm · XHub" };
export const dynamic = "force-dynamic";

// Real T001 OrgUnit ids (see PE_TEST_PLAN §2 — NOT the org-* placeholders from
// the original handoff draft).
const ORG_UNITS: { id: string; label: string }[] = [
  { id: "ou-exec", label: "Ban điều hành" },
  { id: "ou-sales", label: "Kinh doanh" },
  { id: "ou-fin", label: "Tài chính" },
  { id: "ou-hr", label: "Nhân sự" },
  { id: "ou-tech", label: "Công nghệ" },
  { id: "ou-admin", label: "Hành chính" },
  { id: "ou-solution", label: "Giải pháp" },
  { id: "ou-impl", label: "Triển khai" },
  { id: "ou-delivery", label: "Delivery" },
  { id: "ou-support", label: "Hỗ trợ" },
  { id: "ou-platform", label: "Platform" },
];

const statusTone: Record<string, "success" | "warning" | "info" | "neutral" | "error"> = {
  SUBMITTED: "info",
  IN_REVIEW: "info",
  APPROVED: "success",
  REJECTED: "error",
  CHANGES_REQUESTED: "warning",
  CANCEL_REQUESTED: "warning",
  CANCELLED: "neutral",
};

// PE-01 W07 — team availability calendar + inline approval queue, gated
// `people.team.availability.read`. Roster = Position.holderPersonId (real
// headcount), leave overlay = LeaveRequest in range — a projection, not a
// second SoR.
export default async function TeamAvailabilityPage({ searchParams }: { searchParams: Promise<{ orgUnitId?: string }> }) {
  const { orgUnitId: requested } = await searchParams;
  const orgUnitId = requested && ORG_UNITS.some((o) => o.id === requested) ? requested : "ou-fin";

  const [{ roster, source: rosterSource, forbidden }, { items: pending, source: pendingSource }] = await Promise.all([
    teamAvailability(orgUnitId),
    teamLeaveRequests(orgUnitId, "SUBMITTED"),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Lịch hiện diện nhóm</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">Định biên thật (Position) chồng lịch nghỉ phép trong 14 ngày tới.</p>
        </div>
        <Badge tone={forbidden ? "error" : rosterSource === "api" && pendingSource === "api" ? "success" : "warning"}>
          {forbidden ? "Ngoài phạm vi của bạn" : rosterSource === "api" ? "Kết nối backend" : "Backend offline"}
        </Badge>
      </div>

      {forbidden && (
        <div className="rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
          Bạn không có quyền xem đơn vị này (phạm vi dữ liệu — <code>people.team.availability.read</code> giới hạn theo <code>DataScope</code>). Chọn một đơn vị trong phạm vi của bạn bên dưới.
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {ORG_UNITS.map((o) => (
          <Link
            key={o.id}
            href={`/people/team/availability?orgUnitId=${o.id}`}
            className={clsx(
              "rounded-full border px-2.5 py-1 text-xs font-medium",
              o.id === orgUnitId
                ? "border-primary-600 bg-primary-600/10 text-primary-700 dark:text-primary-300"
                : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-dark-600 dark:text-dark-200 dark:hover:bg-dark-600/40",
            )}
          >
            {o.label}
          </Link>
        ))}
      </div>

      <SectionCard title={`Chờ duyệt (${pending.length})`} accent="warning">
        <ul className="divide-y divide-gray-100 dark:divide-dark-600">
          {pending.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-1 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-800 dark:text-dark-50">
                  {r.leaveTypeCode} · {new Date(r.startAt).toLocaleDateString("vi-VN")} → {new Date(r.endAt).toLocaleDateString("vi-VN")} · {r.durationValue}{r.durationUnit === "DAY" ? " ngày" : " giờ"}
                </p>
                <p className="text-xs text-gray-400">{r.reason || "—"}</p>
              </div>
              <LeaveApprovalButtons id={r.id} status={r.status} />
            </li>
          ))}
          {pending.length === 0 && <li className="py-3 text-sm text-gray-400">Không có đơn nào đang chờ duyệt cho đơn vị này.</li>}
        </ul>
      </SectionCard>

      <SectionCard title={`Định biên (${roster.length})`} accent="neutral">
        <ul className="divide-y divide-gray-100 dark:divide-dark-600">
          {roster.map((r) => (
            <li key={r.positionId} className="flex items-center justify-between gap-3 px-1 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-800 dark:text-dark-50">{r.fullName}</p>
                <p className="text-xs text-gray-400">{r.positionTitle}</p>
              </div>
              {r.leaves.length > 0 ? (
                <Badge tone={statusTone[r.leaves[0].status] ?? "neutral"}>
                  Nghỉ {new Date(r.leaves[0].startAt).toLocaleDateString("vi-VN")}–{new Date(r.leaves[0].endAt).toLocaleDateString("vi-VN")}
                </Badge>
              ) : (
                <Badge tone="success">Có mặt</Badge>
              )}
            </li>
          ))}
          {roster.length === 0 && <li className="py-3 text-sm text-gray-400">Đơn vị chưa có người giữ vị trí nào.</li>}
        </ul>
      </SectionCard>
    </div>
  );
}
