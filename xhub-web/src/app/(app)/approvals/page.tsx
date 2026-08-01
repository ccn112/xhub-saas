import { StatCard } from "@/xhub/ui/StatCard";
import { collection, where } from "@/xhub/lib/seed";
import { userName, orgName } from "@/xhub/lib/repo";
import { slaInfo } from "@/xhub/lib/sla";
import type { Approval, ApprovalStep } from "@/xhub/lib/screen-types";
import { ApprovalsClient, type QueueApproval } from "./ApprovalsClient";

export const metadata = { title: "Trung tâm phê duyệt · XHub" };

const TYPE_LABEL: Record<string, string> = {
  payment: "Thanh toán", purchase: "Mua sắm", hiring: "Tuyển dụng", advance: "Tạm ứng", discount: "Báo giá / chiết khấu", contract_addendum: "Phụ lục hợp đồng",
};

// Liên kết work item cho các phê duyệt đã có trang xử lý chi tiết.
const DETAIL_HREF: Record<string, string> = { "approval-payment-mp-02": "/inbox/wi-payment-mp-02" };

export default function ApprovalsPage() {
  const approvals = collection<Approval>("approvals");

  const queue: QueueApproval[] = approvals
    .map((a) => {
      const sla = slaInfo(a.dueAt);
      const steps = where<ApprovalStep>("approvalSteps", "approvalId", a.id)
        .sort((x, y) => x.step - y.step)
        .map((s) => ({ name: s.name, assigneeName: userName(s.assigneeId), status: s.status }));
      return {
        id: a.id,
        code: a.code,
        type: a.type,
        typeLabel: TYPE_LABEL[a.type] ?? a.type,
        title: a.title,
        requesterName: userName(a.requesterId),
        deptName: orgName(a.departmentId),
        amount: a.amount ?? null,
        priority: a.priority,
        status: a.status,
        currentStep: a.currentStep ?? 1,
        totalSteps: a.totalSteps ?? 1,
        dueAt: a.dueAt ?? null,
        slaLabel: sla.label,
        slaTone: sla.tone,
        overdue: sla.overdue,
        href: DETAIL_HREF[a.id] ?? null,
        steps,
      };
    })
    // Ưu tiên hiển thị: quá hạn trước, rồi theo hạn gần nhất.
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));

  const pending = queue.filter((a) => a.status === "pending").length;
  const overdue = queue.filter((a) => a.overdue || a.status === "overdue").length;
  const totalAmount = queue.reduce((s, a) => s + (a.amount ?? 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Trung tâm phê duyệt</h1>
        <p className="text-sm text-gray-500 dark:text-dark-300">Hàng đợi phê duyệt, SLA theo thời gian thực, luồng xử lý và kiểm tra nhanh bằng AI</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Tổng yêu cầu" value={String(queue.length)} icon="🛡️" tone="primary" />
        <StatCard label="Chờ duyệt" value={String(pending)} icon="⏳" tone="warning" />
        <StatCard label="Quá hạn SLA" value={String(overdue)} icon="⏰" tone="error" />
        <StatCard label="Tổng giá trị" value={new Intl.NumberFormat("vi-VN", { notation: "compact" }).format(totalAmount) + " ₫"} icon="💰" tone="info" />
      </div>

      <ApprovalsClient approvals={queue} />
    </div>
  );
}
