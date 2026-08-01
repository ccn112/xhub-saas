import Link from "next/link";
import { notFound } from "next/navigation";
import { ChannelShell } from "@/xhub/shell/ChannelShell";
import { Composer } from "@/xhub/shell/Composer";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import { AiRecap } from "@/xhub/ui/AiRecap";
import { collection, byId, where } from "@/xhub/lib/seed";
import { vnd, dateVN, timeVN } from "@/xhub/lib/format";
import { channelBySlug, userName, initials } from "@/xhub/lib/repo";
import type { Message, Task, Approval, Channel, Project } from "@/xhub/lib/screen-types";

export const metadata = { title: "Channel · X.Space" };

type ThreadRow = { id: string; parentMessageId: string; title?: string; replyCount?: number };
type DecisionRow = { id: string; title: string; content: string; decidedBy?: string; decidedAt?: string; channelId?: string };
type DocRow = { id: string; title: string; type?: string; updatedAt?: string; uploadedBy?: string };
type WeeklyGoal = { id: string; title: string; current: number; target: number; unit?: string };
type AiInsight = { id: string; scopeId?: string; bullets?: string[]; generatedAt?: string };

const docIcon: Record<string, string> = { pdf: "📕", docx: "📘", xlsx: "📗", pptx: "📙" };
const statusTone: Record<string, "success" | "warning" | "info" | "neutral" | "error"> = {
  completed: "success", in_progress: "info", waiting: "warning", new: "neutral", not_started: "neutral", overdue: "error",
};

function Avatar({ id }: { id: string }) {
  const special = id === "xai" ? "✦" : id === "system" ? "⚙" : null;
  return (
    <span
      className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
        id === "xai" ? "bg-primary-600 text-white" : "bg-gray-150 text-gray-600 dark:bg-dark-500 dark:text-dark-100"
      }`}
    >
      {special ?? initials(userName(id))}
    </span>
  );
}

export default async function ChannelConversation({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const channel = channelBySlug(slug);
  if (!channel) notFound();

  const members = where<{ userId: string }>("channelMembers", "channelId", channel.id);
  const project = channel.projectId ? byId<Project>("projects", channel.projectId) : undefined;

  const messages = where<Message>("messages", "channelId", channel.id).sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  const threads = collection<ThreadRow>("threads").filter((t) => t.parentMessageId);
  const parentIds = new Set(threads.map((t) => t.parentMessageId));
  const threadByParent = new Map(threads.map((t) => [t.parentMessageId, t]));
  const feed = messages.filter((m) => !m.threadId || parentIds.has(m.id));

  const docsById = new Map(collection<DocRow>("documents").map((d) => [d.id, d]));
  const tasks = where<Task>("tasks", "channelId", channel.id);
  const decisions = where<DecisionRow>("decisions", "channelId", channel.id);
  const docs = channel.projectId ? collection<DocRow>("documents").filter((d) => (d as { projectId?: string }).projectId === channel.projectId) : [];
  const recap = collection<AiInsight>("aiInsights").find((a) => a.scopeId === channel.id);
  const goals = collection<WeeklyGoal>("weeklyGoals");
  const goal = goals[0];

  return (
    <ChannelShell channel={channel as Channel} active="conversation" memberCount={members.length}>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Message feed + composer */}
        <div className="flex min-w-0 flex-col">
          <div className="flex-1 space-y-4">
            {feed.map((m) => {
              const thread = threadByParent.get(m.id);
              const task = m.type === "task_card" && m.linkedEntity ? byId<Task>("tasks", m.linkedEntity.id) : undefined;
              const approval = m.type === "approval_card" && m.linkedEntity ? byId<Approval>("approvals", m.linkedEntity.id) : undefined;
              const isAi = m.type === "ai";
              const isSystem = m.senderId === "system";

              if (isSystem) {
                return (
                  <div key={m.id} className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="h-px flex-1 bg-gray-100 dark:bg-dark-600" />
                    <span>{m.content}</span>
                    <span className="h-px flex-1 bg-gray-100 dark:bg-dark-600" />
                  </div>
                );
              }

              return (
                <div key={m.id} className="flex gap-3">
                  <Avatar id={m.senderId} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className={`text-sm font-semibold ${isAi ? "text-primary-700 dark:text-primary-300" : "text-gray-800 dark:text-dark-50"}`}>
                        {userName(m.senderId)}
                      </span>
                      {isAi ? <Badge tone="primary">X.AI</Badge> : null}
                      <span className="text-xs text-gray-400">{timeVN(m.sentAt)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-gray-700 dark:text-dark-100">{m.content}</p>

                    {/* File attachments */}
                    {m.documentIds?.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {m.documentIds.map((did) => {
                          const d = docsById.get(did);
                          if (!d) return null;
                          return (
                            <div key={did} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-dark-600 dark:bg-dark-750">
                              <span className="text-lg">{docIcon[d.type ?? ""] ?? "📄"}</span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-gray-800 dark:text-dark-100">{d.title}</p>
                                <p className="text-tiny-plus text-gray-400 uppercase">{d.type}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    {/* Task card */}
                    {task ? (
                      <div className="mt-2 rounded-lg border-l-4 border-info bg-info/5 p-3 dark:bg-info/10">
                        <div className="flex items-center gap-2">
                          <span>✅</span>
                          <span className="text-xs font-semibold tracking-wide text-info-darker uppercase dark:text-info-lighter">Công việc</span>
                          <Badge tone={statusTone[task.status] ?? "neutral"}>{task.status}</Badge>
                        </div>
                        <p className="mt-1.5 text-sm font-medium text-gray-800 dark:text-dark-50">{task.title}</p>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-dark-300">
                          {userName(task.assigneeId)} · hạn {dateVN(task.dueDate)} · {task.progress}%
                        </p>
                      </div>
                    ) : null}

                    {/* Approval card */}
                    {approval ? (
                      <div className="mt-2 rounded-lg border-l-4 border-warning bg-warning/5 p-3 dark:bg-warning/10">
                        <div className="flex items-center gap-2">
                          <span>🛡️</span>
                          <span className="text-xs font-semibold tracking-wide text-warning-darker uppercase dark:text-warning-lighter">Phê duyệt</span>
                          <Badge tone="warning">{approval.status}</Badge>
                        </div>
                        <p className="mt-1.5 text-sm font-medium text-gray-800 dark:text-dark-50">{approval.title}</p>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-dark-300">
                          {approval.code} · {vnd(approval.amount)} · bước {approval.currentStep}/{approval.totalSteps}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <Link
                            href={`/inbox/wi-payment-mp-02`}
                            className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
                          >
                            Xem hồ sơ
                          </Link>
                          <span className="text-tiny-plus text-gray-400">Phê duyệt cần xác nhận có chủ đích — X.AI không tự duyệt.</span>
                        </div>
                      </div>
                    ) : null}

                    {/* Thread indicator */}
                    {thread ? (
                      <Link
                        href={`/space/channels/${channel.slug}/threads`}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-primary-700 hover:bg-gray-150 dark:bg-dark-600 dark:text-primary-300"
                      >
                        🧵 {thread.replyCount ?? 0} phản hồi · {thread.title}
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="sticky bottom-0 mt-4 bg-white pt-2 dark:bg-dark-700">
            <Composer channelName={channel.name} />
          </div>
        </div>

        {/* Context panel */}
        <aside className="space-y-4">
          {recap?.bullets ? (
            <AiRecap
              title="X.AI tóm tắt channel"
              points={recap.bullets}
              footnote={`Tạo lúc ${dateVN(recap.generatedAt)} · chỉ hỗ trợ đọc.`}
            />
          ) : null}

          {goal ? (
            <SectionCard accent="success" title="Mục tiêu channel">
              <p className="text-sm font-medium text-gray-800 dark:text-dark-50">{goal.title}</p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-gray-150 dark:bg-dark-500">
                <div className="h-1.5 rounded-full bg-primary-600" style={{ width: `${Math.min(100, (goal.current / goal.target) * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-gray-400">{goal.current}/{goal.target} {goal.unit}</p>
            </SectionCard>
          ) : null}

          {project ? (
            <SectionCard title="Dự án" action={<Link href={`/space/channels/${channel.slug}/overview`} className="text-sm text-primary-600 hover:underline">Tổng quan</Link>}>
              <p className="text-sm font-medium text-gray-800 dark:text-dark-50">{project.name}</p>
              <p className="mt-0.5 text-xs text-gray-400">{project.code} · PM {userName(project.managerId)}</p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-gray-150 dark:bg-dark-500">
                <div className="h-1.5 rounded-full bg-success" style={{ width: `${project.progress}%` }} />
              </div>
              <p className="mt-1 text-xs text-gray-400">Tiến độ {project.progress}% · {project.openTasks} việc mở</p>
            </SectionCard>
          ) : null}

          <SectionCard accent="neutral" title={`Thành viên (${members.length})`}>
            <div className="flex flex-wrap gap-1.5">
              {members.slice(0, 10).map((m) => (
                <span key={m.userId} title={userName(m.userId)} className="flex size-8 items-center justify-center rounded-full bg-gray-150 text-tiny-plus font-semibold text-gray-600 dark:bg-dark-500 dark:text-dark-100">
                  {initials(userName(m.userId))}
                </span>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Công việc liên quan" bodyClassName="p-0">
            <ul className="divide-y divide-gray-100 dark:divide-dark-600">
              {tasks.slice(0, 5).map((t) => (
                <li key={t.id} className="flex items-center gap-2 px-4 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-dark-100">{t.title}</span>
                  <Badge tone={statusTone[t.status] ?? "neutral"}>{t.status}</Badge>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard accent="neutral" title="Tài liệu" bodyClassName="p-0">
            <ul className="divide-y divide-gray-100 dark:divide-dark-600">
              {docs.slice(0, 5).map((d) => (
                <li key={d.id} className="flex items-center gap-2 px-4 py-2.5">
                  <span>{docIcon[d.type ?? ""] ?? "📄"}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-dark-100">{d.title}</span>
                  <span className="text-tiny-plus text-gray-400">{dateVN(d.updatedAt)}</span>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard accent="neutral" title="Quyết định ghim">
            <div className="space-y-3">
              {decisions.map((d) => (
                <div key={d.id} className="rounded-lg border border-gray-200 p-3 dark:border-dark-600">
                  <p className="text-sm font-medium text-gray-800 dark:text-dark-50">📌 {d.title}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-dark-300">{d.content}</p>
                  <p className="mt-1 text-tiny-plus text-gray-400">{userName(d.decidedBy)} · {dateVN(d.decidedAt)}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </aside>
      </div>
    </ChannelShell>
  );
}
