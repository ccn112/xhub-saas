import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { AiRecap } from "@/xhub/ui/AiRecap";
import { collection, byId } from "@/xhub/lib/seed";
import { num, dateVN, timeVN } from "@/xhub/lib/format";
import { userName, initials } from "@/xhub/lib/repo";
import type { Project, Task, CalendarEvent } from "@/xhub/lib/screen-types";

interface Milestone { id: string; projectId: string; name: string; dueDate?: string; status?: string; progress?: number }
interface Workstream { id: string; projectId: string; name: string; ownerId?: string; progress: number; status: string }
interface Risk { id: string; projectId: string; title: string; severity: string; status: string; ownerId?: string; dueDate?: string; impact?: string }
interface Decision { id: string; projectId?: string; title: string; content: string; decidedBy?: string; decidedAt?: string; status: string }
interface Doc { id: string; title: string; type?: string; projectId?: string; uploadedBy?: string; updatedAt?: string }

const docIcon: Record<string, string> = { pdf: "📄", docx: "📝", xlsx: "📊", pptx: "📑" };
const msStatus: Record<string, { label: string; tone: "success" | "primary" | "neutral" }> = {
  completed: { label: "Hoàn thành", tone: "success" },
  in_progress: { label: "Đang chạy", tone: "primary" },
  not_started: { label: "Chưa bắt đầu", tone: "neutral" },
};
const riskTone: Record<string, "error" | "warning" | "neutral"> = { high: "error", medium: "warning", low: "neutral" };
const riskStatus: Record<string, string> = { open: "Đang mở", monitoring: "Đang theo dõi", closed: "Đã đóng" };

export async function generateMetadata({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const p = byId<Project>("projects", projectId);
  return { title: `${p?.name ?? "Dự án"} · XHub` };
}

export default async function ProjectOverview({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = byId<Project>("projects", projectId);
  if (!project) notFound();

  const milestones = collection<Milestone>("milestones").filter((x) => x.projectId === projectId);
  const workstreams = collection<Workstream>("workstreams").filter((x) => x.projectId === projectId);
  const risks = collection<Risk>("projectRisks").filter((x) => x.projectId === projectId);
  const decisions = collection<Decision>("decisions").filter((x) => x.projectId === projectId);
  const tasks = collection<Task>("tasks").filter((x) => x.projectId === projectId);
  const docs = collection<Doc>("documents").filter((x) => x.projectId === projectId)
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")).slice(0, 6);
  const events = collection<CalendarEvent>("calendarEvents").filter((e) => (e.channelId ?? "").includes("finerp") || e.type === "project" || e.type === "customer");

  const recap = byId<{ bullets: string[]; generatedAt: string }>("aiInsights", "ai-project-recap");

  // Workload theo assignee
  const workloadMap = new Map<string, { total: number; open: number }>();
  for (const t of tasks) {
    const w = workloadMap.get(t.assigneeId) ?? { total: 0, open: 0 };
    w.total += 1;
    if (t.status !== "completed") w.open += 1;
    workloadMap.set(t.assigneeId, w);
  }
  const workload = [...workloadMap.entries()].sort((a, b) => b[1].open - a[1].open);
  const maxOpen = Math.max(1, ...workload.map(([, w]) => w.open));

  // Attention: tasks quá hạn hoặc chờ
  const attention = tasks.filter((t) => ["overdue", "waiting"].includes(t.status));

  return (
    <div className="space-y-4">
      {/* Identity bar */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">{project.name}</h1>
            <Badge tone={project.status === "active" ? "success" : "neutral"}>{project.status === "active" ? "Đang chạy" : project.status}</Badge>
          </div>
          <p className="text-sm text-gray-500 dark:text-dark-300">
            {project.code} · PM {userName(project.managerId)} · Owner {userName(project.ownerId)} · {dateVN(project.startDate)} → {dateVN(project.endDate)}
          </p>
        </div>
        <Link href="/projects" className="text-sm text-primary-600 hover:underline">← Danh sách dự án</Link>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Tiến độ tổng" value={`${project.progress}%`} icon="📈" tone="primary" />
        <StatCard label="Rủi ro cao" value={num(project.riskHigh)} icon="⚠️" tone="error" />
        <StatCard label="Việc đang mở" value={num(project.openTasks)} icon="📋" tone="info" />
        <StatCard label="Ticket đang mở" value={num(project.openTickets)} icon="🎫" tone="warning" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <SectionCard title="Lộ trình milestone">
            <div className="space-y-4">
              {milestones.map((ms) => {
                const st = msStatus[ms.status ?? ""] ?? { label: ms.status ?? "", tone: "neutral" as const };
                return (
                  <div key={ms.id} className="flex items-center gap-3">
                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm ${ms.status === "completed" ? "bg-success/15 text-success" : ms.status === "in_progress" ? "bg-primary-600/15 text-primary-600" : "bg-gray-150 text-gray-500 dark:bg-dark-500"}`}>{ms.status === "completed" ? "✓" : "•"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-800 dark:text-dark-100">{ms.name}</p>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-gray-150 dark:bg-dark-500"><div className={`h-1.5 rounded-full ${ms.status === "completed" ? "bg-success" : "bg-primary-600"}`} style={{ width: `${ms.progress ?? 0}%` }} /></div>
                      <p className="mt-0.5 text-xs text-gray-400">Hạn {dateVN(ms.dueDate)} · {ms.progress ?? 0}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Workstream (Gantt tóm tắt)">
            <div className="space-y-3">
              {workstreams.map((ws) => (
                <div key={ws.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-dark-100">{ws.name} <span className="text-xs text-gray-400">· {userName(ws.ownerId)}</span></span>
                    <span className="font-medium">{ws.progress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-150 dark:bg-dark-500"><div className={`h-2 rounded-full ${ws.progress >= 80 ? "bg-success" : ws.progress >= 50 ? "bg-primary-600" : "bg-warning"}`} style={{ width: `${ws.progress}%` }} /></div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard accent="error" title="Rủi ro & vấn đề">
            <div className="space-y-2">
              {risks.map((r) => (
                <div key={r.id} className="flex items-start gap-2 rounded-lg border border-gray-200 p-2.5 dark:border-dark-600">
                  <Badge tone={riskTone[r.severity] ?? "neutral"}>{r.severity}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-dark-100">{r.title}</p>
                    {r.impact ? <p className="text-xs text-gray-500 dark:text-dark-300">{r.impact}</p> : null}
                    <p className="mt-0.5 text-xs text-gray-400">{riskStatus[r.status] ?? r.status} · {userName(r.ownerId)} · hạn {dateVN(r.dueDate)}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Workload theo nhân sự">
            <div className="space-y-3">
              {workload.map(([uid, w]) => (
                <div key={uid}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="flex items-center gap-2 text-gray-700 dark:text-dark-100">
                      <span className="flex size-7 items-center justify-center rounded-full bg-primary-600/10 text-xs font-semibold text-primary-600 uppercase">{initials(userName(uid))}</span>
                      {userName(uid)}
                    </span>
                    <span className="text-xs text-gray-400">{w.open} mở / {w.total} tổng</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-150 dark:bg-dark-500"><div className="h-1.5 rounded-full bg-primary-600" style={{ width: `${(w.open / maxOpen) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-4">
          {recap ? <AiRecap points={recap.bullets} footnote={`X.AI tạo lúc ${dateVN(recap.generatedAt)} · chỉ hỗ trợ đọc, không tự phê duyệt.`} /> : null}

          <SectionCard accent="warning" title="Cần chú ý">
            <div className="space-y-2">
              {attention.length === 0 ? <p className="text-sm text-gray-400">Không có việc cần chú ý.</p> : attention.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2.5 dark:border-dark-600">
                  <Badge tone={t.status === "overdue" ? "error" : "warning"}>{t.status === "overdue" ? "quá hạn" : "chờ"}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800 dark:text-dark-100">{t.title}</p>
                    <p className="text-xs text-gray-400">{userName(t.assigneeId)} · hạn {dateVN(t.dueDate)}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard accent="neutral" title="Quyết định">
            <div className="space-y-2">
              {decisions.map((d) => (
                <div key={d.id} className="rounded-lg border border-gray-200 p-2.5 dark:border-dark-600">
                  <p className="text-sm font-medium text-gray-800 dark:text-dark-100">{d.title}</p>
                  <p className="text-xs text-gray-500 dark:text-dark-300">{d.content}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{userName(d.decidedBy)} · {dateVN(d.decidedAt)}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard accent="neutral" title="Tài liệu">
            <div className="space-y-2">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-lg border border-gray-200 p-2.5 dark:border-dark-600">
                  <span className="text-lg">{docIcon[d.type ?? ""] ?? "📁"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800 dark:text-dark-100">{d.title}</p>
                    <p className="text-xs text-gray-400">{userName(d.uploadedBy)} · {dateVN(d.updatedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard accent="info" title="Lịch họp">
            <div className="space-y-3">
              {events.map((e) => (
                <div key={e.id} className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary-600/10 text-primary-600">🗓️</span>
                  <div><p className="text-sm font-medium text-gray-800 dark:text-dark-100">{e.title}</p><p className="text-xs text-gray-400">{timeVN(e.start)} · {dateVN(e.start)}</p></div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
