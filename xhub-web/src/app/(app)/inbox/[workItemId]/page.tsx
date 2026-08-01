import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge, type Tone } from "@/xhub/ui/Badge";
import { AiRecap } from "@/xhub/ui/AiRecap";
import { collection, byId, where } from "@/xhub/lib/seed";
import { vnd, dateVN, dateTimeVN, num } from "@/xhub/lib/format";
import { userName } from "@/xhub/lib/repo";
import { slaInfo } from "@/xhub/lib/sla";
import { ApprovalActions } from "./ApprovalActions";
import type { WorkItem, Approval, ApprovalStep, PaymentItem, Project, ProjectRisk } from "@/xhub/lib/screen-types";

export const metadata = { title: "Chi tiết yêu cầu · XHub" };

interface Doc { id: string; title: string; fileName: string; type: string; size: number; uploadedBy: string; updatedAt: string; projectId?: string | null }
interface Comment { id: string; approvalId: string; authorId: string; createdAt: string; content: string }

const STEP_TONE: Record<string, Tone> = { approved: "success", pending: "warning", rejected: "error" };
const STEP_LABEL: Record<string, string> = { approved: "Đã duyệt", pending: "Chờ duyệt", rejected: "Từ chối" };
const fileSize = (b: number) => (b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`);
const DOC_ICON: Record<string, string> = { pdf: "📕", xlsx: "📊", docx: "📄", pptx: "📽️" };

export default async function WorkItemDetail({ params }: { params: Promise<{ workItemId: string }> }) {
  const { workItemId } = await params;
  const workItem = byId<WorkItem>("workItems", workItemId);

  // Nguồn phê duyệt: ưu tiên sourceId của work item, fallback về work item id.
  const approval =
    byId<Approval>("approvals", workItem?.sourceId ?? workItemId) ??
    byId<Approval>("approvals", workItemId);

  // Fallback: mọi workItemId (kể cả không phải phê duyệt) vẫn trả 200.
  if (!approval) {
    return (
      <div className="space-y-4">
        <Breadcrumb title={workItem?.title ?? "Chi tiết công việc"} />
        <SectionCard title="Chi tiết công việc">
          {workItem ? (
            <div className="space-y-3 text-sm">
              <p className="text-gray-600 dark:text-dark-200">{workItem.summary ?? "Mục công việc này không phải yêu cầu phê duyệt tài chính."}</p>
              <dl className="grid grid-cols-2 gap-3">
                <Fact label="Loại" value={workItem.type} />
                <Fact label="Phụ trách" value={userName(workItem.assignedTo)} />
                <Fact label="Người tạo" value={userName(workItem.createdBy)} />
                <Fact label="Hạn" value={dateTimeVN(workItem.dueAt)} />
              </dl>
              <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-dark-600/40 dark:text-dark-300">
                Trang xử lý chuyên biệt hiện có cho yêu cầu thanh toán. Với loại việc khác, mở ứng dụng nghiệp vụ tương ứng.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <span className="text-3xl">🔍</span>
              <p className="text-sm font-medium text-gray-700 dark:text-dark-100">Không tìm thấy mục việc “{workItemId}”</p>
              <p className="text-xs text-gray-400">Mục có thể đã được xử lý hoặc thuộc không gian khác.</p>
              <Link href="/inbox" className="mt-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-primary-600 hover:border-primary-300 dark:border-dark-600">← Về hộp việc</Link>
            </div>
          )}
        </SectionCard>
      </div>
    );
  }

  const steps = where<ApprovalStep>("approvalSteps", "approvalId", approval.id).sort((a, b) => a.step - b.step);
  const payItems = where<PaymentItem>("paymentItems", "approvalId", approval.id);
  const comments = where<Comment>("approvalComments", "approvalId", approval.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const docs = approval.projectId ? collection<Doc>("documents").filter((d) => d.projectId === approval.projectId) : [];
  const project = approval.projectId ? byId<Project>("projects", approval.projectId) : undefined;
  const risks = approval.projectId ? collection<ProjectRisk>("projectRisks").filter((r) => r.projectId === approval.projectId && r.severity === "high") : [];

  const totalValue = payItems.reduce((s, p) => s + p.value, 0);
  const eligibleValue = payItems.reduce((s, p) => s + Math.round((p.value * p.completion) / 100), 0);
  const incomplete = payItems.filter((p) => p.completion < 100);
  const currentStep = steps.find((s) => s.status === "pending");
  const sla = slaInfo(approval.dueAt);

  const aiPoints = [
    `Tổng đề nghị ${vnd(approval.amount)} cho ${payItems.length} hạng mục; giá trị đã nghiệm thu tương ứng ~${vnd(eligibleValue)}.`,
    incomplete.length > 0
      ? `${incomplete.length} hạng mục chưa hoàn tất 100% (${incomplete.map((p) => `${p.name} ${p.completion}%`).join(", ")}) — cần đối chiếu biên bản nghiệm thu.`
      : "Tất cả hạng mục đã nghiệm thu 100%.",
    `Đang ở bước ${approval.currentStep}/${approval.totalSteps}: ${currentStep?.name ?? "—"}.`,
    sla.overdue ? `Cảnh báo SLA: ${sla.label}.` : `SLA còn trong hạn: ${sla.label}.`,
  ];

  return (
    <div className="space-y-4">
      <Breadcrumb title={approval.title} />

      {/* Header */}
      <SectionCard>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">{approval.title}</h1>
              <Badge tone="neutral">{approval.code}</Badge>
              <Badge tone={approval.priority === "high" ? "error" : "warning"}>Ưu tiên {approval.priority === "high" ? "cao" : "trung bình"}</Badge>
              <Badge tone={sla.tone}>{sla.label}</Badge>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">{approval.summary}</p>
            <p className="mt-1 text-xs text-gray-400">
              Người đề nghị {userName(approval.requesterId)} · {project ? project.name : "—"} · tạo {dateTimeVN(approval.createdAt)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-gray-400">Tổng đề nghị</p>
            <p className="font-heading text-2xl font-bold text-gray-800 dark:text-dark-50">{vnd(approval.amount)}</p>
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Tổng hạng mục" value={vnd(totalValue)} icon="🧾" tone="primary" />
        <StatCard label="Đã nghiệm thu" value={vnd(eligibleValue)} icon="✅" tone="success" />
        <StatCard label="Số bằng chứng" value={num(docs.length)} icon="📎" tone="info" />
        <StatCard label="Hạn xử lý" value={dateVN(approval.dueAt)} sub={sla.label} icon="⏰" tone={sla.overdue ? "error" : "warning"} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {/* Payment items */}
          <SectionCard title="Hạng mục thanh toán" bodyClassName="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 text-left text-xs text-gray-400 uppercase dark:border-dark-600 dark:text-dark-300">
                <tr><th className="px-4 py-3">Hạng mục</th><th className="px-4 py-3 w-40">Hoàn thành</th><th className="px-4 py-3 text-right">Giá trị</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-dark-600">
                {payItems.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-dark-100">{p.name}</td>
                    <td className="px-4 py-3">
                      <div className="h-1.5 w-full rounded-full bg-gray-150 dark:bg-dark-500"><div className={`h-1.5 rounded-full ${p.completion === 100 ? "bg-success" : p.completion === 0 ? "bg-error" : "bg-warning"}`} style={{ width: `${p.completion}%` }} /></div>
                      <span className="text-xs text-gray-400">{p.completion}%</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-700 dark:text-dark-100">{vnd(p.value)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-gray-200 dark:border-dark-600">
                <tr><td className="px-4 py-3 font-semibold text-gray-800 dark:text-dark-50" colSpan={2}>Tổng cộng</td><td className="px-4 py-3 text-right font-bold text-gray-800 dark:text-dark-50">{vnd(totalValue)}</td></tr>
              </tfoot>
            </table>
          </SectionCard>

          {/* Attachments */}
          <SectionCard accent="neutral" title={`Bằng chứng đính kèm (${docs.length})`}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-lg border border-gray-200 p-2.5 dark:border-dark-600">
                  <span className="text-xl">{DOC_ICON[d.type] ?? "📄"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800 dark:text-dark-100">{d.title}</p>
                    <p className="text-xs text-gray-400">{d.fileName} · {fileSize(d.size)} · {userName(d.uploadedBy)}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Workflow timeline */}
          <SectionCard accent="warning" title="Luồng phê duyệt">
            <ol className="space-y-4">
              {steps.map((s, i) => (
                <li key={s.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold ${s.status === "approved" ? "bg-success text-white" : s.status === "pending" ? "bg-warning text-white" : "bg-gray-200 text-gray-500 dark:bg-dark-500"}`}>
                      {s.status === "approved" ? "✓" : s.step}
                    </span>
                    {i < steps.length - 1 ? <span className="mt-1 h-full w-px flex-1 bg-gray-200 dark:bg-dark-600" /> : null}
                  </div>
                  <div className="pb-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-800 dark:text-dark-100">{s.name}</p>
                      <Badge tone={STEP_TONE[s.status] ?? "neutral"}>{STEP_LABEL[s.status] ?? s.status}</Badge>
                    </div>
                    <p className="text-xs text-gray-400">{userName(s.assigneeId)} {s.actedAt ? `· ${dateTimeVN(s.actedAt)}` : "· chưa xử lý"}</p>
                  </div>
                </li>
              ))}
            </ol>
          </SectionCard>

          {/* Discussion */}
          <SectionCard title={`Trao đổi (${comments.length})`}>
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-600/10 text-xs font-semibold text-primary-600">{userName(c.authorId).split(" ").pop()?.[0]}</span>
                  <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-dark-600/40">
                    <p className="text-xs text-gray-400">{userName(c.authorId)} · {dateTimeVN(c.createdAt)}</p>
                    <p className="text-sm text-gray-700 dark:text-dark-100">{c.content}</p>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          <SectionCard accent="warning" title="Quyết định phê duyệt">
            <ApprovalActions code={approval.code} stepName={currentStep?.name ?? "—"} approverName={userName(currentStep?.assigneeId)} />
          </SectionCard>

          <AiRecap points={aiPoints} footnote="X.AI tổng hợp từ hồ sơ đính kèm · chỉ hỗ trợ, không tự phê duyệt." />

          <SectionCard accent="error" title="Cảnh báo rủi ro">
            <div className="space-y-2">
              {incomplete.length > 0 ? (
                <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 p-2.5">
                  <span>⚠️</span>
                  <p className="text-sm text-gray-700 dark:text-dark-100">{incomplete.length} hạng mục chưa hoàn tất 100% nhưng nằm trong đề nghị thanh toán.</p>
                </div>
              ) : null}
              {sla.overdue ? (
                <div className="flex items-start gap-2 rounded-lg border border-error/40 bg-error/5 p-2.5">
                  <span>⏰</span>
                  <p className="text-sm text-gray-700 dark:text-dark-100">Yêu cầu đã {sla.label.toLowerCase()} so với SLA.</p>
                </div>
              ) : null}
              {risks.map((r) => (
                <div key={r.id} className="flex items-start gap-2 rounded-lg border border-gray-200 p-2.5 dark:border-dark-600">
                  <Badge tone="error">Cao</Badge>
                  <div><p className="text-sm text-gray-700 dark:text-dark-100">{r.title}</p><p className="text-xs text-gray-400">{r.impact} · hạn {dateVN(r.dueDate)}</p></div>
                </div>
              ))}
              {incomplete.length === 0 && !sla.overdue && risks.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-dark-300">Không phát hiện rủi ro nổi bật.</p>
              ) : null}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function Breadcrumb({ title }: { title: string }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-gray-400" aria-label="Breadcrumb">
      <Link href="/inbox" className="hover:text-primary-600">Hộp việc</Link>
      <span>/</span>
      <span className="truncate text-gray-600 dark:text-dark-200">{title}</span>
    </nav>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="font-medium text-gray-700 dark:text-dark-100">{value}</dd>
    </div>
  );
}
