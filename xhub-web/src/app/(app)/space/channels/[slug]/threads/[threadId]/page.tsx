import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import { AiRecap } from "@/xhub/ui/AiRecap";
import { collection, byId, where } from "@/xhub/lib/seed";
import { dateTimeVN, timeVN, dateVN } from "@/xhub/lib/format";
import { userName, user, initials, channelBySlug } from "@/xhub/lib/repo";
import { ChannelHeader, docIcon, fileSize } from "../../../../_components/ChannelHeader";
import { MessageComposer } from "../../../../_components/MessageComposer";

export const metadata = { title: "Thread chi tiết · X.Space" };

type Msg = {
  id: string; senderId: string; sentAt: string; content: string; type: string;
  threadId: string | null; documentIds?: string[]; linkedEntity?: { type: string; id: string };
};
type Doc = { id: string; title: string; fileName: string; type: string; size: number; updatedAt: string; uploadedBy: string };
type Task = { id: string; title: string; assigneeId: string; dueDate: string; priority: string; status: string; progress: number };
type Decision = { id: string; title: string; content: string; decidedAt: string; decidedBy: string; status: string };
type Reaction = { id: string; messageId: string; userId: string; emoji: string };

const statusTone: Record<string, "success" | "warning" | "info" | "neutral" | "error"> = {
  in_progress: "info", waiting: "warning", completed: "success", not_started: "neutral", new: "neutral", overdue: "error",
};
const statusLabel: Record<string, string> = {
  in_progress: "Đang làm", waiting: "Chờ", completed: "Hoàn tất", not_started: "Chưa bắt đầu", new: "Mới", overdue: "Quá hạn",
};

function Avatar({ id }: { id: string }) {
  const isAi = id === "xai";
  const isSystem = id === "system";
  return (
    <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${isAi ? "bg-primary-600 text-white" : isSystem ? "bg-gray-200 text-gray-600 dark:bg-dark-500 dark:text-dark-100" : "bg-info/15 text-info-darker dark:text-info-lighter"}`}>
      {isAi ? "✦" : isSystem ? "⚙" : initials(userName(id))}
    </span>
  );
}

export default async function ThreadDetailPage({ params }: { params: Promise<{ slug: string; threadId: string }> }) {
  const { slug, threadId } = await params;
  const channel = channelBySlug(slug);
  const thread = byId<{ id: string; title: string; createdBy: string; createdAt: string; participantIds: string[]; followerIds: string[]; replyCount: number; status: string; parentMessageId: string }>("threads", threadId);

  if (!thread || !channel) {
    return (
      <div className="space-y-4">
        <ChannelHeader slug={slug} active="chat" />
        <SectionCard title="Không tìm thấy thread">
          <p className="text-sm text-gray-500 dark:text-dark-300">Thread không tồn tại hoặc bạn không có quyền truy cập.</p>
          <Link href={`/space/channels/${slug}`} className="mt-3 inline-block text-sm text-primary-600 hover:underline">← Về channel</Link>
        </SectionCard>
      </div>
    );
  }

  const parent = byId<Msg>("messages", thread.parentMessageId);
  const replies = where<Msg>("messages", "threadId", threadId).sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  const reactions = collection<Reaction>("reactions");
  const docsIndex = collection<Doc>("documents");
  const doc = (id: string) => docsIndex.find((d) => d.id === id);

  const decision = byId<Decision>("decisions", "decision-proposal-structure");
  const linkedTaskIds = Array.from(new Set(replies.filter((m) => m.type === "task_card" && m.linkedEntity?.type === "task").map((m) => m.linkedEntity!.id)));
  const linkedTasks = linkedTaskIds.map((id) => byId<Task>("tasks", id)).filter(Boolean) as Task[];
  const threadFiles = Array.from(new Set(replies.flatMap((m) => m.documentIds ?? []))).map((id) => doc(id)).filter(Boolean) as Doc[];
  const recap = byId<{ bullets: string[]; generatedAt: string }>("aiInsights", "ai-thread-recap");

  const reactionsFor = (msgId: string) => {
    const rs = reactions.filter((r) => r.messageId === msgId);
    const grouped = new Map<string, number>();
    for (const r of rs) grouped.set(r.emoji, (grouped.get(r.emoji) ?? 0) + 1);
    return Array.from(grouped.entries());
  };

  return (
    <div className="space-y-4">
      <ChannelHeader slug={slug} active="chat" breadcrumb="Thread" />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {/* Thread header + actions */}
          <SectionCard
            title={thread.title}
            action={
              <div className="flex items-center gap-1">
                <button className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-dark-600 dark:text-dark-100 dark:hover:bg-dark-600">Theo dõi</button>
                <button className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-dark-600 dark:text-dark-100 dark:hover:bg-dark-600">Ghim</button>
                <button className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-dark-600 dark:text-dark-100 dark:hover:bg-dark-600">Chia sẻ</button>
              </div>
            }
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-dark-300">
              <Badge tone={thread.status === "active" ? "success" : "neutral"}>{thread.status === "active" ? "Đang mở" : thread.status}</Badge>
              <span>Tạo bởi {userName(thread.createdBy)}</span>
              <span>· {dateTimeVN(thread.createdAt)}</span>
              <span>· {thread.replyCount} trả lời</span>
              <span>· {thread.followerIds.length} người theo dõi</span>
            </div>
            {parent ? (
              <div className="mt-3 rounded-lg border-l-2 border-primary-400 bg-gray-50 p-3 dark:bg-dark-600/40">
                <p className="text-xs font-medium text-gray-500 dark:text-dark-300">{userName(parent.senderId)} · {timeVN(parent.sentAt)}</p>
                <p className="mt-1 text-sm text-gray-700 dark:text-dark-100">{parent.content}</p>
              </div>
            ) : null}
          </SectionCard>

          {/* Reply stream */}
          <SectionCard title="Dòng trả lời">
            <ol className="space-y-4">
              {replies.map((m) => (
                <li key={m.id} className="flex gap-3">
                  <Avatar id={m.senderId} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800 dark:text-dark-100">{userName(m.senderId)}</span>
                      <span className="text-xs text-gray-400">{timeVN(m.sentAt)}</span>
                      {m.type === "ai" ? <Badge tone="primary">X.AI</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-sm text-gray-700 dark:text-dark-100">{m.content}</p>

                    {/* File cards */}
                    {m.documentIds?.length ? (
                      <div className="mt-2 space-y-2">
                        {m.documentIds.map((id) => {
                          const d = doc(id);
                          if (!d) return null;
                          return (
                            <div key={id} className="flex items-center gap-3 rounded-lg border border-gray-200 p-2.5 dark:border-dark-600">
                              <span className="text-xl">{docIcon(d.type)}</span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-gray-800 dark:text-dark-100">{d.title}</p>
                                <p className="text-xs text-gray-400">{d.fileName} · {fileSize(d.size)}</p>
                              </div>
                              <button className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:border-dark-600 dark:text-dark-100 dark:hover:bg-dark-600">Mở</button>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    {/* Task card */}
                    {m.type === "task_card" && m.linkedEntity?.type === "task" ? (() => {
                      const t = byId<Task>("tasks", m.linkedEntity.id);
                      if (!t) return null;
                      return (
                        <div className="mt-2 rounded-lg border border-primary-200 bg-primary-50/50 p-2.5 dark:border-primary-900 dark:bg-primary-950/20">
                          <div className="flex items-center gap-2">
                            <span>📌</span>
                            <span className="flex-1 text-sm font-medium text-gray-800 dark:text-dark-100">{t.title}</span>
                            <Badge tone={statusTone[t.status] ?? "neutral"}>{statusLabel[t.status] ?? t.status}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-gray-500 dark:text-dark-300">{userName(t.assigneeId)} · hạn {dateVN(t.dueDate)} · {t.progress}%</p>
                        </div>
                      );
                    })() : null}

                    {/* Reactions */}
                    {reactionsFor(m.id).length ? (
                      <div className="mt-2 flex gap-1">
                        {reactionsFor(m.id).map(([emoji, count]) => (
                          <span key={emoji} className="rounded-full border border-gray-200 px-2 py-0.5 text-xs dark:border-dark-600">{emoji} {count}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </SectionCard>

          {/* Reply composer */}
          <SectionCard title="Trả lời thread">
            <MessageComposer placeholder="Viết trả lời trong thread…" />
          </SectionCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {recap ? <AiRecap points={recap.bullets} footnote={`X.AI tóm tắt lúc ${dateTimeVN(recap.generatedAt)} · chỉ hỗ trợ đọc.`} /> : null}

          {decision ? (
            <SectionCard accent="neutral" title="Quyết định">
              <div className="rounded-lg border border-success/30 bg-success/5 p-3">
                <div className="flex items-center gap-2">
                  <span>✅</span>
                  <span className="text-sm font-semibold text-gray-800 dark:text-dark-100">{decision.title}</span>
                </div>
                <p className="mt-1 text-sm text-gray-600 dark:text-dark-200">{decision.content}</p>
                <p className="mt-2 text-xs text-gray-400">Chốt bởi {userName(decision.decidedBy)} · {dateTimeVN(decision.decidedAt)}</p>
              </div>
            </SectionCard>
          ) : null}

          <SectionCard title="Công việc liên kết">
            {linkedTasks.length ? (
              <div className="space-y-2">
                {linkedTasks.map((t) => (
                  <Link key={t.id} href="/work" className="block rounded-lg border border-gray-200 p-2.5 hover:border-primary-300 dark:border-dark-600">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate text-sm font-medium text-gray-800 dark:text-dark-100">{t.title}</span>
                      <Badge tone={statusTone[t.status] ?? "neutral"}>{statusLabel[t.status] ?? t.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">{userName(t.assigneeId)} · hạn {dateVN(t.dueDate)}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Chưa có công việc nào liên kết.</p>
            )}
          </SectionCard>

          <SectionCard accent="neutral" title="Tệp trong thread">
            {threadFiles.length ? (
              <div className="space-y-2">
                {threadFiles.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 text-sm">
                    <span>{docIcon(d.type)}</span>
                    <span className="flex-1 truncate text-gray-700 dark:text-dark-100">{d.title}</span>
                    <span className="text-xs text-gray-400">{fileSize(d.size)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Chưa có tệp nào.</p>
            )}
          </SectionCard>

          <SectionCard accent="neutral" title={`Người tham gia (${thread.participantIds.length})`}>
            <div className="space-y-2">
              {thread.participantIds.map((id) => {
                const u = user(id);
                return (
                  <div key={id} className="flex items-center gap-2">
                    <Avatar id={id} />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-gray-800 dark:text-dark-100">{userName(id)}</p>
                      <p className="truncate text-xs text-gray-400">{u?.title}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
