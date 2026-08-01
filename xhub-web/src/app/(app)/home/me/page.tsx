import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { AiRecap } from "@/xhub/ui/AiRecap";
import { collection, byId } from "@/xhub/lib/seed";
import { num, dateVN, timeVN, dateTimeVN } from "@/xhub/lib/format";
import { getWorkspaceContext } from "@/xhub/lib/workspace";
import type { KpiSnapshot, Task, Notification, CalendarEvent } from "@/xhub/lib/screen-types";

export const metadata = { title: "Không gian của tôi · XHub" };

interface WeeklyGoal { id: string; userId: string; title: string; current: number; target: number; unit: string; dueDate: string; status: string }
interface Doc { id: string; title: string; type?: string; uploadedBy?: string; updatedAt?: string }

const prio: Record<string, "error" | "warning" | "neutral"> = { critical: "error", high: "error", medium: "warning", low: "neutral" };
const statusLabel: Record<string, string> = {
  new: "Mới", not_started: "Chưa bắt đầu", in_progress: "Đang làm", waiting: "Chờ", overdue: "Quá hạn", completed: "Hoàn thành",
};
const statusTone: Record<string, "info" | "neutral" | "primary" | "warning" | "error" | "success"> = {
  new: "info", not_started: "neutral", in_progress: "primary", waiting: "warning", overdue: "error", completed: "success",
};
const notifIcon: Record<string, string> = { mention: "💬", approval: "🛡️", task: "✅" };
const docIcon: Record<string, string> = { pdf: "📄", docx: "📝", xlsx: "📊", pptx: "📑" };

export default function MyWorkspace() {
  const { actor } = getWorkspaceContext("user-nam");
  const kpi = byId<KpiSnapshot>("kpiSnapshots", "kpi-user-nam-week32");
  const m = kpi?.metrics ?? {};
  const tasks = collection<Task>("tasks").filter((t) => t.assigneeId === actor.id);
  const notifications = collection<Notification>("notifications").filter((n) => n.userId === actor.id);
  const events = collection<CalendarEvent>("calendarEvents").filter((e) => (e.participantIds ?? []).includes(actor.id));
  const goals = collection<WeeklyGoal>("weeklyGoals").filter((g) => g.userId === actor.id);
  const docs = collection<Doc>("documents").filter((d) => d.uploadedBy === actor.id)
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")).slice(0, 5);
  const mentions = notifications.filter((n) => n.type === "mention");

  const openTasks = tasks.filter((t) => t.status !== "completed")
    .sort((a, b) => (a.dueDate).localeCompare(b.dueDate));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Không gian của tôi</h1>
        <p className="text-sm text-gray-500 dark:text-dark-300">Chào {actor.name} · việc cá nhân, lịch, thông báo và gợi ý AI</p>
      </div>

      {/* Personal KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Việc hôm nay" value={num(m.tasksToday)} icon="📋" tone="primary" />
        <StatCard label="Việc quá hạn" value={num(m.overdueTasks)} icon="⏰" tone="error" />
        <StatCard label="Chờ tôi duyệt" value={num(m.approvalsToRespond)} icon="🛡️" tone="warning" />
        <StatCard label="Cuộc họp hôm nay" value={num(m.meetingsToday)} icon="🗓️" tone="info" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <SectionCard title="Việc ưu tiên" action={<Link href="/work" className="text-sm text-primary-600 hover:underline">Tất cả công việc</Link>} bodyClassName="p-0">
            {openTasks.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">Bạn đã hoàn thành tất cả công việc. Tuyệt vời!</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 text-left text-xs text-gray-400 uppercase dark:border-dark-600 dark:text-dark-300">
                  <tr><th className="px-4 py-3">Công việc</th><th className="px-4 py-3">Hạn</th><th className="px-4 py-3">Ưu tiên</th><th className="px-4 py-3 w-32">Tiến độ</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-600">
                  {openTasks.map((t) => (
                    <tr key={t.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800 dark:text-dark-100">{t.title}</p>
                        <Badge tone={statusTone[t.status] ?? "neutral"} className="mt-1">{statusLabel[t.status] ?? t.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-dark-200">{dateVN(t.dueDate)}</td>
                      <td className="px-4 py-3"><Badge tone={prio[t.priority] ?? "neutral"}>{t.priority}</Badge></td>
                      <td className="px-4 py-3">
                        <div className="h-1.5 w-full rounded-full bg-gray-150 dark:bg-dark-500"><div className="h-1.5 rounded-full bg-primary-600" style={{ width: `${t.progress}%` }} /></div>
                        <span className="text-xs text-gray-400">{t.progress}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SectionCard>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard accent="info" title="Lịch làm việc hôm nay">
              <div className="space-y-3">
                {events.length === 0 ? <p className="text-sm text-gray-400">Không có lịch hôm nay.</p> : events.map((e) => (
                  <div key={e.id} className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-primary-600/10 text-primary-600">🗓️</span>
                    <div><p className="text-sm font-medium text-gray-800 dark:text-dark-100">{e.title}</p><p className="text-xs text-gray-400">{timeVN(e.start)}–{timeVN(e.end)} · {e.type}</p></div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard accent="neutral" title="Tài liệu gần đây">
              <div className="space-y-2">
                {docs.length === 0 ? <p className="text-sm text-gray-400">Chưa có tài liệu.</p> : docs.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 rounded-lg border border-gray-200 p-2.5 dark:border-dark-600">
                    <span className="text-lg">{docIcon[d.type ?? ""] ?? "📁"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800 dark:text-dark-100">{d.title}</p>
                      <p className="text-xs text-gray-400">Cập nhật {dateVN(d.updatedAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>

        <div className="space-y-4">
          <AiRecap
            title="X.AI gợi ý cho bạn"
            points={[
              `Bạn có ${openTasks.length} việc đang mở, ưu tiên "${openTasks[0]?.title ?? "—"}" đến hạn ${dateVN(openTasks[0]?.dueDate)}.`,
              `${num(m.meetingsToday)} cuộc họp hôm nay — chuẩn bị trước cho Demo FinERP lúc 10:00.`,
              `${num(m.approvalsToRespond)} hồ sơ đang chờ bạn phản hồi.`,
            ]}
            footnote="X.AI chỉ hỗ trợ tổng hợp, không tự thực hiện thay bạn."
          />

          <SectionCard accent="success" title="Mục tiêu tuần">
            <div className="space-y-3">
              {goals.map((g) => {
                const pct = g.target ? Math.round((g.current / g.target) * 100) : 0;
                return (
                  <div key={g.id}>
                    <div className="mb-1 flex justify-between text-sm"><span className="text-gray-700 dark:text-dark-100">{g.title}</span><span className="font-medium">{g.current}/{g.target} {g.unit}</span></div>
                    <div className="h-1.5 w-full rounded-full bg-gray-150 dark:bg-dark-500"><div className={`h-1.5 rounded-full ${pct >= 100 ? "bg-success" : "bg-primary-600"}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                    <p className="mt-0.5 text-xs text-gray-400">Hạn {dateVN(g.dueDate)}</p>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard accent="warning" title="Thông báo">
            <div className="space-y-2">
              {notifications.length === 0 ? <p className="text-sm text-gray-400">Không có thông báo mới.</p> : notifications.map((n) => (
                <div key={n.id} className="flex gap-3 rounded-lg border border-gray-200 p-2.5 dark:border-dark-600">
                  <span className="text-lg">{notifIcon[n.type] ?? "🔔"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-dark-100">{n.title}</p>
                    <p className="text-xs text-gray-500 dark:text-dark-300">{n.body}</p>
                    <p className="mt-0.5 text-xs text-gray-400">{dateTimeVN(n.createdAt)}</p>
                  </div>
                  {!n.read ? <span className="mt-1 size-2 shrink-0 rounded-full bg-primary-600" /> : null}
                </div>
              ))}
            </div>
          </SectionCard>

          {mentions.length > 0 ? (
            <SectionCard accent="warning" title="Nhắc đến bạn">
              <div className="space-y-2">
                {mentions.map((n) => (
                  <div key={n.id} className="rounded-lg border border-gray-200 p-2.5 dark:border-dark-600">
                    <p className="text-sm font-medium text-gray-800 dark:text-dark-100">{n.title}</p>
                    <p className="text-xs text-gray-500 dark:text-dark-300">{n.body}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
