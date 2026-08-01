import Link from "next/link";
import { notFound } from "next/navigation";
import { ChannelShell } from "@/xhub/shell/ChannelShell";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { AiRecap } from "@/xhub/ui/AiRecap";
import { collection, byId, where } from "@/xhub/lib/seed";
import { dateVN, num } from "@/xhub/lib/format";
import { channelBySlug, userName, initials } from "@/xhub/lib/repo";
import type { Channel, Project, Task, Milestone, ProjectRisk } from "@/xhub/lib/screen-types";

export const metadata = { title: "Tổng quan dự án · X.Space" };

type Workstream = { id: string; name: string; ownerId?: string; progress: number; status: string };
type DocRow = { id: string; title: string; type?: string; updatedAt?: string; projectId?: string };
type DecisionRow = { id: string; title: string; content: string; decidedBy?: string; decidedAt?: string; projectId?: string };
type AiInsight = { id: string; scopeId?: string; bullets?: string[]; generatedAt?: string };

const docIcon: Record<string, string> = { pdf: "📕", docx: "📘", xlsx: "📗", pptx: "📙" };
const msTone: Record<string, "success" | "info" | "neutral"> = { completed: "success", in_progress: "info", not_started: "neutral" };
const taskTone: Record<string, "success" | "warning" | "info" | "neutral" | "error"> = {
  completed: "success", in_progress: "info", waiting: "warning", new: "neutral", not_started: "neutral", overdue: "error",
};

export default async function ProjectOverview({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const channel = channelBySlug(slug);
  if (!channel || !channel.projectId) notFound();

  const project = byId<Project>("projects", channel.projectId);
  if (!project) notFound();

  const members = where<{ userId: string }>("channelMembers", "channelId", channel.id);
  const milestones = where<Milestone>("milestones", "projectId", project.id).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  const workstreams = where<Workstream>("workstreams", "projectId", project.id);
  const tasks = where<Task>("tasks", "projectId", project.id);
  const attention = tasks.filter((t) => t.status === "overdue" || t.priority === "high").slice(0, 6);
  const risks = where<ProjectRisk>("projectRisks", "projectId", project.id);
  const docs = collection<DocRow>("documents").filter((d) => d.projectId === project.id).slice(0, 6);
  const decisions = collection<DecisionRow>("decisions").filter((d) => d.projectId === project.id);
  const recap = collection<AiInsight>("aiInsights").find((a) => a.scopeId === project.id);

  // Workload: task count per assignee
  const workload = new Map<string, number>();
  tasks.filter((t) => t.status !== "completed").forEach((t) => workload.set(t.assigneeId, (workload.get(t.assigneeId) ?? 0) + 1));
  const workloadRows = [...workload.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxLoad = Math.max(1, ...workloadRows.map(([, n]) => n));

  return (
    <ChannelShell channel={channel as Channel} active="overview" memberCount={members.length}>
      <div className="space-y-5">
        {/* Project summary */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-bold text-gray-800 dark:text-dark-50">{project.name}</h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-dark-300">
              {project.code} · PM {userName(project.managerId)} · {dateVN(project.startDate)} → {dateVN(project.endDate)}
            </p>
          </div>
          <Badge tone={project.status === "active" ? "success" : "neutral"}>{project.status}</Badge>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Tiến độ" value={`${project.progress}%`} icon="📈" tone="primary" />
          <StatCard label="Việc mở" value={num(project.openTasks)} icon="✅" tone="info" />
          <StatCard label="Rủi ro cao" value={num(project.riskHigh)} icon="⚠️" tone="error" />
          <StatCard label="Ticket mở" value={num(project.openTickets)} icon="🎫" tone="warning" />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="space-y-5 xl:col-span-2">
            {/* Milestones */}
            <SectionCard title="Cột mốc">
              <ol className="relative space-y-4 border-l border-gray-200 pl-5 dark:border-dark-600">
                {milestones.map((ms) => (
                  <li key={ms.id} className="relative">
                    <span className={`absolute -left-[26px] top-1 size-3 rounded-full border-2 border-white dark:border-dark-700 ${ms.status === "completed" ? "bg-success" : ms.status === "in_progress" ? "bg-primary-600" : "bg-gray-300 dark:bg-dark-500"}`} />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-800 dark:text-dark-50">{ms.name}</span>
                      <Badge tone={msTone[ms.status ?? ""] ?? "neutral"}>{ms.status}</Badge>
                    </div>
                    <p className="text-xs text-gray-400">Hạn {dateVN(ms.dueDate)} · {ms.progress}%</p>
                  </li>
                ))}
              </ol>
            </SectionCard>

            {/* Workstream progress */}
            <SectionCard title="Tiến độ workstream">
              <div className="space-y-3">
                {workstreams.map((w) => (
                  <div key={w.id}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-dark-100">{w.name}</span>
                      <span className="text-xs text-gray-400">{userName(w.ownerId)} · {w.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-150 dark:bg-dark-500">
                      <div className={`h-1.5 rounded-full ${w.progress >= 75 ? "bg-success" : w.progress >= 50 ? "bg-primary-600" : "bg-warning"}`} style={{ width: `${w.progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Attention tasks */}
            <SectionCard accent="warning" title="Việc cần chú ý" bodyClassName="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 text-left text-xs text-gray-400 uppercase dark:border-dark-600 dark:text-dark-300">
                  <tr><th className="px-4 py-2.5">Công việc</th><th className="px-4 py-2.5">Phụ trách</th><th className="px-4 py-2.5">Hạn</th><th className="px-4 py-2.5">Trạng thái</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-600">
                  {attention.map((t) => (
                    <tr key={t.id}>
                      <td className="px-4 py-2.5 text-gray-800 dark:text-dark-100">{t.title}</td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-dark-200">{userName(t.assigneeId)}</td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-dark-200">{dateVN(t.dueDate)}</td>
                      <td className="px-4 py-2.5"><Badge tone={taskTone[t.status] ?? "neutral"}>{t.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>
          </div>

          <div className="space-y-5">
            {recap?.bullets ? <AiRecap title="X.AI tóm tắt dự án" points={recap.bullets} footnote={`Tạo lúc ${dateVN(recap.generatedAt)}`} /> : null}

            {/* Risks */}
            <SectionCard accent="error" title="Rủi ro">
              <div className="space-y-2">
                {risks.map((r) => (
                  <div key={r.id} className="rounded-lg border border-gray-200 p-2.5 dark:border-dark-600">
                    <div className="flex items-center gap-2">
                      <Badge tone={r.severity === "high" ? "error" : "warning"}>{r.severity}</Badge>
                      <span className="text-tiny-plus text-gray-400">Hạn {dateVN(r.dueDate)}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-700 dark:text-dark-100">{r.title}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Workload */}
            <SectionCard title="Khối lượng công việc">
              <div className="space-y-2.5">
                {workloadRows.map(([uid, n]) => (
                  <div key={uid} className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-full bg-gray-150 text-tiny-plus font-semibold text-gray-600 dark:bg-dark-500 dark:text-dark-100">{initials(userName(uid))}</span>
                    <span className="w-24 truncate text-sm text-gray-700 dark:text-dark-100">{userName(uid)}</span>
                    <div className="h-1.5 flex-1 rounded-full bg-gray-150 dark:bg-dark-500">
                      <div className="h-1.5 rounded-full bg-primary-600" style={{ width: `${(n / maxLoad) * 100}%` }} />
                    </div>
                    <span className="w-6 text-right text-xs text-gray-400">{n}</span>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Documents */}
            <SectionCard accent="neutral" title="Tài liệu" bodyClassName="p-0">
              <ul className="divide-y divide-gray-100 dark:divide-dark-600">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 px-4 py-2.5">
                    <span>{docIcon[d.type ?? ""] ?? "📄"}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-dark-100">{d.title}</span>
                    <span className="text-tiny-plus text-gray-400">{dateVN(d.updatedAt)}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>

            {/* Decisions */}
            <SectionCard accent="neutral" title="Quyết định">
              <div className="space-y-2">
                {decisions.map((d) => (
                  <div key={d.id} className="rounded-lg border border-gray-200 p-2.5 dark:border-dark-600">
                    <p className="text-sm font-medium text-gray-800 dark:text-dark-50">📌 {d.title}</p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-dark-300">{d.content}</p>
                    <p className="mt-1 text-tiny-plus text-gray-400">{userName(d.decidedBy)} · {dateVN(d.decidedAt)}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </ChannelShell>
  );
}
