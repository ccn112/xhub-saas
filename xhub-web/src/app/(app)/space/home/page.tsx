import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { AiRecap } from "@/xhub/ui/AiRecap";
import { collection, where } from "@/xhub/lib/seed";
import { dateVN, timeVN } from "@/xhub/lib/format";
import { userName, initials } from "@/xhub/lib/repo";
import { getWorkspaceContext } from "@/xhub/lib/workspace";
import type { Notification, WorkItem, CalendarEvent, Channel } from "@/xhub/lib/screen-types";

export const metadata = { title: "Trang chủ · X.Space" };

type ThreadRow = { id: string; title?: string; channelId: string; replyCount?: number; followerIds?: string[]; parentMessageId?: string };
type DMRow = { id: string; conversationId: string; senderId: string; recipientId: string; sentAt: string; content: string; type: string };
type DocRow = { id: string; title: string; type?: string; updatedAt?: string; uploadedBy?: string };
type DecisionRow = { id: string; title: string; content: string; decidedBy?: string; decidedAt?: string; status?: string };
type WeeklyGoal = { id: string; userId: string; title: string; current: number; target: number; unit?: string; dueDate?: string };
type AiInsight = { id: string; scopeId?: string; bullets?: string[]; generatedAt?: string };

const docIcon: Record<string, string> = { pdf: "📕", docx: "📘", xlsx: "📗", pptx: "📙" };
const wiIcon: Record<string, string> = { approval: "🛡️", task: "✅", conversation: "💬", customer: "🤝", project: "📌" };
const wiTone: Record<string, "error" | "warning" | "info" | "neutral"> = { overdue: "error", needs_action: "warning", in_progress: "info" };

const TODAY = "2026-08-08";

export default function SpaceHome() {
  const { actor } = getWorkspaceContext();

  const notifs = collection<Notification>("notifications");
  const unread = notifs.filter((n) => !n.read);
  const mentions = notifs.filter((n) => n.type === "mention" && !n.read);

  const workItems = collection<WorkItem>("workItems");
  const myWork = workItems.filter((w) => w.assignedTo === actor.id);
  const continueWork = (myWork.length ? myWork : workItems).slice(0, 6);
  const needsAction = workItems.filter((w) => w.status === "needs_action" || w.status === "overdue");

  const threads = collection<ThreadRow>("threads").filter((t) => t.followerIds?.includes(actor.id));

  const dms = collection<DMRow>("directMessages").sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  const dmByConvo = new Map<string, DMRow>();
  for (const dm of dms) if (!dmByConvo.has(dm.conversationId)) dmByConvo.set(dm.conversationId, dm);

  const channels = collection<Channel>("channels").filter((c) => c.section !== "my_channels").slice(0, 5);

  const events = collection<CalendarEvent>("calendarEvents")
    .filter((e) => e.start.startsWith(TODAY))
    .sort((a, b) => a.start.localeCompare(b.start));

  const docs = collection<DocRow>("documents").sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")).slice(0, 5);
  const decisions = collection<DecisionRow>("decisions").filter((d) => d.status === "active");
  const goals = collection<WeeklyGoal>("weeklyGoals").filter((g) => g.userId === actor.id);
  const recap = collection<AiInsight>("aiInsights").find((a) => a.scopeId === "XH-01");

  const channelName = (id: string) => collection<Channel>("channels").find((c) => c.id === id)?.name ?? id;
  const channelSlug = (id: string) => collection<Channel>("channels").find((c) => c.id === id)?.slug ?? "";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Chào {actor.name.split(" ").slice(-1)}, đây là X.Space hôm nay</h1>
        <p className="text-sm text-gray-500 dark:text-dark-300">Nơi bắt đầu ngày làm việc: nhắc đến bạn, việc cần làm tiếp, thread theo dõi, tin nhắn và cuộc họp.</p>
      </div>

      {/* Priority summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Chưa đọc" value={`${unread.length}`} icon="🔔" tone="primary" />
        <StatCard label="Được nhắc đến" value={`${mentions.length}`} icon="@" tone="info" />
        <StatCard label="Việc cần xử lý" value={`${needsAction.length}`} icon="⚡" tone="warning" />
        <StatCard label="Họp hôm nay" value={`${events.length}`} icon="🗓️" tone="success" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {/* Continue work */}
          <SectionCard title="Tiếp tục công việc" action={<Link href="/inbox" className="text-sm text-primary-600 hover:underline">Hộp việc</Link>} bodyClassName="p-0">
            <ul className="divide-y divide-gray-100 dark:divide-dark-600">
              {continueWork.map((w) => (
                <li key={w.id}>
                  <Link href={`/inbox/${w.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-dark-600">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-gray-150 text-base dark:bg-dark-500">{wiIcon[w.type] ?? "•"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800 dark:text-dark-100">{w.title}</p>
                      {w.summary ? <p className="truncate text-xs text-gray-400">{w.summary}</p> : null}
                    </div>
                    {w.dueAt ? <span className="hidden text-xs text-gray-400 sm:block">{dateVN(w.dueAt)}</span> : null}
                    <Badge tone={wiTone[w.status] ?? "neutral"}>{w.status}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </SectionCard>

          {/* Followed threads */}
          <SectionCard title="Thread đang theo dõi">
            <div className="space-y-2">
              {threads.map((t) => (
                <Link
                  key={t.id}
                  href={`/space/channels/${channelSlug(t.channelId)}/threads`}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 hover:border-primary-300 dark:border-dark-600"
                >
                  <span className="text-lg">🧵</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800 dark:text-dark-100">{t.title}</p>
                    <p className="text-xs text-gray-400">#{channelName(t.channelId)} · {t.replyCount ?? 0} phản hồi</p>
                  </div>
                </Link>
              ))}
            </div>
          </SectionCard>

          {/* Highlighted channels */}
          <SectionCard title="Channel nổi bật">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {channels.map((c) => (
                <Link key={c.id} href={`/space/channels/${c.slug}`} className="rounded-lg border border-gray-200 p-3 hover:border-primary-300 dark:border-dark-600">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-gray-800 dark:text-dark-100">
                    <span className="text-gray-400">{c.type === "private" ? "🔒" : "#"}</span>{c.name}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-gray-400">{c.purpose}</p>
                </Link>
              ))}
            </div>
          </SectionCard>

          {/* Shared files */}
          <SectionCard accent="neutral" title="Tài liệu chia sẻ gần đây" bodyClassName="p-0">
            <ul className="divide-y divide-gray-100 dark:divide-dark-600">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-lg">{docIcon[d.type ?? ""] ?? "📄"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-gray-800 dark:text-dark-100">{d.title}</p>
                    <p className="text-tiny-plus text-gray-400">{userName(d.uploadedBy)} · {dateVN(d.updatedAt)}</p>
                  </div>
                  <span className="text-tiny-plus text-gray-400 uppercase">{d.type}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        <div className="space-y-4">
          {recap?.bullets ? <AiRecap title="X.AI tóm tắt buổi sáng" points={recap.bullets} footnote={`Tạo lúc ${dateVN(recap.generatedAt)} · chỉ hỗ trợ đọc.`} /> : null}

          {/* Recent DMs */}
          <SectionCard title="Tin nhắn trực tiếp">
            <div className="space-y-2">
              {[...dmByConvo.values()].map((dm) => {
                const partner = dm.senderId === actor.id ? dm.recipientId : dm.senderId;
                return (
                  <Link key={dm.id} href={`/space/dm/${partner}`} className="flex items-start gap-2.5 rounded-lg p-2 hover:bg-gray-50 dark:hover:bg-dark-600">
                    <span className="flex size-9 items-center justify-center rounded-full bg-gray-150 text-tiny-plus font-semibold text-gray-600 dark:bg-dark-500 dark:text-dark-100">{initials(userName(partner))}</span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center justify-between gap-2 text-sm font-medium text-gray-800 dark:text-dark-100"><span className="truncate">{userName(partner)}</span><span className="text-tiny-plus text-gray-400">{timeVN(dm.sentAt)}</span></p>
                      <p className="line-clamp-1 text-xs text-gray-400">{dm.type === "task_card" ? "📎 Đã liên kết công việc" : dm.content}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </SectionCard>

          {/* Today meetings */}
          <SectionCard accent="info" title="Lịch họp hôm nay">
            <div className="space-y-3">
              {events.map((e) => (
                <div key={e.id} className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary-600/10 text-primary-600">🗓️</span>
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-gray-800 dark:text-dark-100">{e.title}</p><p className="text-xs text-gray-400">{timeVN(e.start)}–{timeVN(e.end)} · {e.type}</p></div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Weekly goals */}
          <SectionCard accent="success" title="Mục tiêu tuần">
            <div className="space-y-3">
              {goals.map((g) => (
                <div key={g.id}>
                  <div className="mb-1 flex justify-between text-sm"><span className="text-gray-700 dark:text-dark-100">{g.title}</span><span className="font-medium">{g.current}/{g.target}{g.unit === "%" ? "%" : ""}</span></div>
                  <div className="h-1.5 w-full rounded-full bg-gray-150 dark:bg-dark-500"><div className="h-1.5 rounded-full bg-primary-600" style={{ width: `${Math.min(100, (g.current / g.target) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Pinned decisions */}
          <SectionCard accent="neutral" title="Quyết định đã ghim">
            <div className="space-y-2">
              {decisions.map((d) => (
                <div key={d.id} className="rounded-lg border border-gray-200 p-2.5 dark:border-dark-600">
                  <p className="text-sm font-medium text-gray-800 dark:text-dark-50">📌 {d.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-dark-300">{d.content}</p>
                  <p className="mt-1 text-tiny-plus text-gray-400">{userName(d.decidedBy)} · {dateVN(d.decidedAt)}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
