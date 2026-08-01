import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { AiRecap } from "@/xhub/ui/AiRecap";
import { collection, byId, where } from "@/xhub/lib/seed";
import { dateTimeVN, dateVN } from "@/xhub/lib/format";
import { userName, channelBySlug } from "@/xhub/lib/repo";
import { ChannelHeader, docIcon } from "../../../../_components/ChannelHeader";

export const metadata = { title: "Workflow trong channel · X.Space" };

type WfStep = { key: string; name: string };
type WfDef = { id: string; name: string; version: string; description: string; steps: WfStep[] };
type WfInstance = {
  id: string; workflowId: string; code: string; customerId: string; title: string; currentStep: string;
  status: string; ownerId: string; slaHours: number; dueAt: string;
  formData: { goal?: string; demoAt?: string; format?: string; scope?: string[]; supporterIds?: string[]; documentIds?: string[] };
};
type WfHistory = { id: string; instanceId: string; step: string; status: string; actorId: string; at: string; note: string };
type Customer = { id: string; name: string };
type Doc = { id: string; title: string; type: string };

const instStatus: Record<string, { tone: "info" | "warning" | "error" | "success" | "neutral"; label: string }> = {
  in_progress: { tone: "info", label: "Đang xử lý" },
  overdue: { tone: "error", label: "Quá hạn" },
  completed: { tone: "success", label: "Hoàn tất" },
};

export default async function WorkflowPage({ params }: { params: Promise<{ slug: string; workflowId: string }> }) {
  const { slug, workflowId } = await params;
  const channel = channelBySlug(slug);
  const def = byId<WfDef>("workflowDefinitions", workflowId);

  if (!channel || !def) {
    return (
      <div className="space-y-4">
        <ChannelHeader slug={slug} active="workflows" />
        <SectionCard title="Không tìm thấy workflow">
          <p className="text-sm text-gray-500 dark:text-dark-300">Quy trình không tồn tại trong channel này.</p>
        </SectionCard>
      </div>
    );
  }

  const instances = where<WfInstance>("workflowInstances", "workflowId", workflowId);
  const selected = instances.find((i) => Object.keys(i.formData ?? {}).length > 0) ?? instances[0];
  const history = selected ? where<WfHistory>("workflowHistory", "instanceId", selected.id).sort((a, b) => a.at.localeCompare(b.at)) : [];
  const otherDefs = collection<WfDef>("workflowDefinitions").filter((d) => d.id !== workflowId);
  const customer = (id: string) => byId<Customer>("customers", id)?.name ?? id;

  const currentIdx = selected ? def.steps.findIndex((s) => s.key === selected.currentStep) : -1;
  const overdueCount = instances.filter((i) => i.status === "overdue").length;
  const inProgressCount = instances.filter((i) => i.status === "in_progress").length;

  const stepStatusOf = (idx: number): "done" | "current" | "todo" =>
    idx < currentIdx ? "done" : idx === currentIdx ? "current" : "todo";

  return (
    <div className="space-y-4">
      <ChannelHeader slug={slug} active="workflows" breadcrumb="Workflow" />

      {/* Workflow header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold text-gray-800 dark:text-dark-50">{def.name}</h2>
          <p className="text-sm text-gray-500 dark:text-dark-300">{def.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="neutral">v{def.version}</Badge>
          <button className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700">+ Tạo yêu cầu</button>
        </div>
      </div>

      {/* Workflow KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Đang chạy" value={String(instances.length)} icon="⚙️" tone="primary" />
        <StatCard label="Đang xử lý" value={String(inProgressCount)} icon="🔄" tone="info" />
        <StatCard label="Quá hạn SLA" value={String(overdueCount)} icon="⏰" tone="error" />
        <StatCard label="Số bước" value={String(def.steps.length)} icon="🧩" tone="neutral" />
      </div>

      {/* Step progress */}
      {selected ? (
        <SectionCard title={`Tiến trình · ${selected.code}`}>
          <ol className="flex flex-wrap items-center gap-y-3">
            {def.steps.map((s, i) => {
              const st = stepStatusOf(i);
              return (
                <li key={s.key} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <span className={`flex size-8 items-center justify-center rounded-full text-xs font-semibold ${st === "done" ? "bg-success text-white" : st === "current" ? "bg-primary-600 text-white ring-4 ring-primary-600/20" : "bg-gray-150 text-gray-500 dark:bg-dark-500 dark:text-dark-200"}`}>
                      {st === "done" ? "✓" : i + 1}
                    </span>
                    <span className={`mt-1 max-w-20 text-center text-xs ${st === "current" ? "font-medium text-primary-600" : "text-gray-500 dark:text-dark-300"}`}>{s.name}</span>
                  </div>
                  {i < def.steps.length - 1 ? <span className={`mx-1 h-0.5 w-8 sm:w-12 ${i < currentIdx ? "bg-success" : "bg-gray-200 dark:bg-dark-500"}`} /> : null}
                </li>
              );
            })}
          </ol>
        </SectionCard>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {/* Running instances */}
          <SectionCard title="Các yêu cầu đang chạy" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 text-left text-xs text-gray-400 uppercase dark:border-dark-600 dark:text-dark-300">
                  <tr><th className="px-4 py-3">Mã</th><th className="px-4 py-3">Yêu cầu</th><th className="px-4 py-3">Khách hàng</th><th className="px-4 py-3">Bước</th><th className="px-4 py-3">Hạn SLA</th><th className="px-4 py-3">Trạng thái</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-600">
                  {instances.map((inst) => {
                    const st = instStatus[inst.status] ?? { tone: "neutral" as const, label: inst.status };
                    const stepName = def.steps.find((s) => s.key === inst.currentStep)?.name ?? inst.currentStep;
                    return (
                      <tr key={inst.id} className={`hover:bg-gray-50 dark:hover:bg-dark-600/40 ${inst.id === selected?.id ? "bg-primary-50/40 dark:bg-primary-950/10" : ""}`}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-dark-300">{inst.code}</td>
                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-dark-100">{inst.title}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-dark-200">{customer(inst.customerId)}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-dark-200">{stepName}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-dark-200">{dateVN(inst.dueAt)}</td>
                        <td className="px-4 py-3"><Badge tone={st.tone}>{st.label}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* Selected instance form */}
          {selected ? (
            <SectionCard title={`Chi tiết yêu cầu · ${selected.code}`} action={<Badge tone={instStatus[selected.status]?.tone ?? "neutral"}>{instStatus[selected.status]?.label ?? selected.status}</Badge>}>
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-gray-400 uppercase">Khách hàng</dt><dd className="text-gray-800 dark:text-dark-100">{customer(selected.customerId)}</dd></div>
                <div><dt className="text-xs text-gray-400 uppercase">Phụ trách</dt><dd className="text-gray-800 dark:text-dark-100">{userName(selected.ownerId)}</dd></div>
                {selected.formData.goal ? <div className="sm:col-span-2"><dt className="text-xs text-gray-400 uppercase">Mục tiêu</dt><dd className="text-gray-800 dark:text-dark-100">{selected.formData.goal}</dd></div> : null}
                {selected.formData.demoAt ? <div><dt className="text-xs text-gray-400 uppercase">Lịch demo</dt><dd className="text-gray-800 dark:text-dark-100">{dateTimeVN(selected.formData.demoAt)}</dd></div> : null}
                {selected.formData.format ? <div><dt className="text-xs text-gray-400 uppercase">Hình thức</dt><dd className="text-gray-800 dark:text-dark-100">{selected.formData.format}</dd></div> : null}
                {selected.formData.scope?.length ? <div className="sm:col-span-2"><dt className="text-xs text-gray-400 uppercase">Phạm vi</dt><dd className="mt-1 flex flex-wrap gap-1">{selected.formData.scope.map((s) => <Badge key={s} tone="info">{s}</Badge>)}</dd></div> : null}
                {selected.formData.supporterIds?.length ? <div className="sm:col-span-2"><dt className="text-xs text-gray-400 uppercase">Hỗ trợ</dt><dd className="text-gray-800 dark:text-dark-100">{selected.formData.supporterIds.map((id) => userName(id)).join(", ")}</dd></div> : null}
              </dl>

              {/* Files */}
              {selected.formData.documentIds?.length ? (
                <div className="mt-3 space-y-2 border-t border-gray-100 pt-3 dark:border-dark-600">
                  <p className="text-xs font-medium text-gray-400 uppercase">Tài liệu đính kèm</p>
                  {selected.formData.documentIds.map((id) => {
                    const d = byId<Doc>("documents", id);
                    if (!d) return null;
                    return <div key={id} className="flex items-center gap-2 text-sm"><span>{docIcon(d.type)}</span><span className="text-gray-700 dark:text-dark-100">{d.title}</span></div>;
                  })}
                </div>
              ) : null}

              {/* Workflow actions */}
              <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3 dark:border-dark-600">
                <button className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700">Chuyển bước tiếp theo</button>
                <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-dark-600 dark:text-dark-100 dark:hover:bg-dark-600">Giao lại</button>
                <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-dark-600 dark:text-dark-100 dark:hover:bg-dark-600">Trả lại bước trước</button>
                <span className="ml-auto self-center text-xs text-gray-400">Duyệt nội bộ cần xác nhận rõ ràng · có ghi audit log.</span>
              </div>
            </SectionCard>
          ) : null}

          {/* Activity log / timeline */}
          <SectionCard accent="neutral" title="Lịch sử & tiến trình">
            {history.length ? (
              <ol className="relative space-y-4 border-l-2 border-gray-150 pl-5 dark:border-dark-500">
                {history.map((h) => {
                  const stepName = def.steps.find((s) => s.key === h.step)?.name ?? h.step;
                  const done = h.status === "completed";
                  return (
                    <li key={h.id} className="relative">
                      <span className={`absolute -left-[27px] top-0.5 flex size-4 items-center justify-center rounded-full border-2 border-white dark:border-dark-700 ${done ? "bg-success" : "bg-primary-600"}`} />
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800 dark:text-dark-100">{stepName}</span>
                        <Badge tone={done ? "success" : "info"}>{done ? "Hoàn tất" : "Đang làm"}</Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-dark-200">{h.note}</p>
                      <p className="text-xs text-gray-400">{userName(h.actorId)} · {dateTimeVN(h.at)}</p>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-sm text-gray-400">Chưa có lịch sử cho yêu cầu này.</p>
            )}
          </SectionCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <AiRecap
            title="X.AI gợi ý tối ưu"
            points={[
              overdueCount > 0 ? `${overdueCount} yêu cầu đang quá hạn SLA — nên ưu tiên xử lý.` : "Không có yêu cầu nào quá hạn SLA.",
              "Bước 'Xác nhận lịch' thường tốn thời gian nhất — cân nhắc nhắc tự động.",
              "Đề xuất gắn mẫu tài liệu chuẩn để giảm thời gian bước chuẩn bị.",
            ]}
            footnote="X.AI chỉ gợi ý — không tự chuyển bước hay phê duyệt."
          />

          <SectionCard accent="neutral" title="Lịch sử gần đây">
            <ol className="space-y-3">
              {[...history].reverse().slice(0, 5).map((h) => (
                <li key={h.id} className="flex gap-2 text-sm">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary-500" />
                  <div><p className="text-gray-700 dark:text-dark-100">{h.note}</p><p className="text-xs text-gray-400">{userName(h.actorId)} · {dateTimeVN(h.at)}</p></div>
                </li>
              ))}
            </ol>
          </SectionCard>

          <SectionCard accent="neutral" title="Mẫu quy trình liên quan">
            <div className="space-y-2">
              {otherDefs.map((d) => (
                <div key={d.id} className="rounded-lg border border-gray-200 p-2.5 dark:border-dark-600">
                  <div className="flex items-center gap-2"><span className="flex-1 text-sm font-medium text-gray-800 dark:text-dark-100">{d.name}</span><Badge tone="neutral">v{d.version}</Badge></div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-dark-300">{d.steps.length} bước · {d.description}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
