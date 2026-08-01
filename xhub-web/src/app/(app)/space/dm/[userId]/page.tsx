import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import { AiRecap } from "@/xhub/ui/AiRecap";
import { collection, byId } from "@/xhub/lib/seed";
import { timeVN, dateVN, dateTimeVN } from "@/xhub/lib/format";
import { userName, user, initials } from "@/xhub/lib/repo";
import { docIcon, fileSize } from "../../_components/ChannelHeader";
import { MessageComposer } from "../../_components/MessageComposer";

export const metadata = { title: "Tin nhắn trực tiếp · X.Space" };

// Người dùng hiện tại (viewer) trong demo.
const ME = "user-nam";

type Dm = { id: string; conversationId: string; senderId: string; recipientId: string; sentAt: string; content: string; type: string; documentIds?: string[]; linkedEntity?: { type: string; id: string } };
type Doc = { id: string; title: string; fileName: string; type: string; size: number };
type Task = { id: string; title: string; assigneeId: string; dueDate: string; priority: string; status: string; progress: number };
type CalEvent = { id: string; title: string; start: string; end: string; type: string; participantIds: string[] };

const statusTone: Record<string, "success" | "warning" | "info" | "neutral" | "error"> = {
  in_progress: "info", waiting: "warning", completed: "success", not_started: "neutral", new: "neutral", overdue: "error",
};
const statusLabel: Record<string, string> = {
  in_progress: "Đang làm", waiting: "Chờ", completed: "Hoàn tất", not_started: "Chưa bắt đầu", new: "Mới", overdue: "Quá hạn",
};
const presenceLabel: Record<string, string> = { online: "Đang hoạt động", away: "Vắng mặt", offline: "Ngoại tuyến" };

export default async function DirectMessagePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const contact = user(userId);

  if (!contact) {
    return (
      <div className="space-y-4">
        <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Tin nhắn trực tiếp</h1>
        <SectionCard title="Không tìm thấy người dùng">
          <p className="text-sm text-gray-500 dark:text-dark-300">Người dùng không tồn tại trong không gian làm việc.</p>
          <Link href="/space" className="mt-3 inline-block text-sm text-primary-600 hover:underline">← Về X.Space</Link>
        </SectionCard>
      </div>
    );
  }

  const conversationId = `dm-${[ME, userId].sort().join("-")}`;
  const messages = collection<Dm>("directMessages")
    .filter((m) => m.conversationId === conversationId)
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt));

  const docsIndex = collection<Doc>("documents");
  const doc = (id: string) => docsIndex.find((d) => d.id === id);
  const sharedFiles = Array.from(new Set(messages.flatMap((m) => m.documentIds ?? []))).map((id) => doc(id)).filter(Boolean) as Doc[];

  const relatedTasks = collection<Task>("tasks").filter((t) => t.assigneeId === userId).slice(0, 4);
  const meetings = collection<CalEvent>("calendarEvents").filter((e) => e.participantIds?.includes(userId) && e.participantIds?.includes(ME));
  const nextMeeting = meetings.sort((a, b) => a.start.localeCompare(b.start))[0];

  return (
    <div className="space-y-4">
      {/* DM header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="relative flex size-11 items-center justify-center rounded-full bg-info/15 text-sm font-semibold text-info-darker dark:text-info-lighter">
            {initials(contact.name)}
            <span className={`absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-white dark:border-dark-800 ${contact.presence === "online" ? "bg-success" : contact.presence === "away" ? "bg-warning" : "bg-gray-300"}`} />
          </span>
          <div>
            <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">{contact.name}</h1>
            <p className="text-sm text-gray-500 dark:text-dark-300">{contact.title} · {presenceLabel[contact.presence ?? ""] ?? contact.presence}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-dark-600 dark:text-dark-100 dark:hover:bg-dark-600">📞 Gọi</button>
          <button className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-dark-600 dark:text-dark-100 dark:hover:bg-dark-600">🎥 Họp nhanh</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {/* Private note */}
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
            <p className="flex items-center gap-2 text-xs font-medium text-warning-darker dark:text-warning-lighter">🔒 Ghi chú riêng (chỉ mình bạn thấy)</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-dark-200">Đầu mối kỹ thuật cho demo Minh Phát. Cần theo dõi việc chuẩn bị môi trường demo và tài khoản mẫu.</p>
          </div>

          {/* DM stream */}
          <SectionCard title="Cuộc trò chuyện">
            <ol className="space-y-3">
              {messages.map((m) => {
                const mine = m.senderId === ME;
                return (
                  <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] ${mine ? "items-end text-right" : ""}`}>
                      <div className={`rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-800 dark:bg-dark-600 dark:text-dark-100"}`}>
                        {m.content}
                      </div>
                      {/* File card in DM */}
                      {m.documentIds?.length ? (
                        <div className="mt-1.5 space-y-1.5">
                          {m.documentIds.map((id) => {
                            const d = doc(id);
                            if (!d) return null;
                            return (
                              <div key={id} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2 text-left dark:border-dark-600">
                                <span className="text-lg">{docIcon(d.type)}</span>
                                <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-gray-800 dark:text-dark-100">{d.title}</p><p className="text-xs text-gray-400">{fileSize(d.size)}</p></div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                      {/* Task card in DM */}
                      {m.type === "task_card" && m.linkedEntity?.type === "task" ? (() => {
                        const t = byId<Task>("tasks", m.linkedEntity.id);
                        if (!t) return null;
                        return (
                          <div className="mt-1.5 rounded-lg border border-primary-200 bg-primary-50/50 p-2 text-left dark:border-primary-900 dark:bg-primary-950/20">
                            <div className="flex items-center gap-2"><span>📌</span><span className="flex-1 text-xs font-medium text-gray-800 dark:text-dark-100">{t.title}</span><Badge tone={statusTone[t.status] ?? "neutral"}>{statusLabel[t.status] ?? t.status}</Badge></div>
                          </div>
                        );
                      })() : null}
                      <p className="mt-0.5 text-xs text-gray-400">{mine ? "Bạn" : contact.name.split(" ").slice(-1)} · {timeVN(m.sentAt)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </SectionCard>

          {/* Composer */}
          <SectionCard title={`Nhắn cho ${contact.name}`}>
            <MessageComposer placeholder={`Nhắn cho ${contact.name}…`} />
          </SectionCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <SectionCard accent="neutral" title="Hồ sơ liên hệ">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Chức danh</span><span className="text-gray-700 dark:text-dark-100">{contact.title}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Email</span><span className="text-gray-700 dark:text-dark-100">{contact.email}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Điện thoại</span><span className="text-gray-700 dark:text-dark-100">{contact.phone}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Trạng thái</span><Badge tone={contact.presence === "online" ? "success" : "neutral"}>{presenceLabel[contact.presence ?? ""] ?? contact.presence}</Badge></div>
            </div>
          </SectionCard>

          {nextMeeting ? (
            <SectionCard accent="info" title="Lịch họp sắp tới">
              <div className="flex items-start gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary-600/10 text-primary-600">🗓️</span>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-dark-100">{nextMeeting.title}</p>
                  <p className="text-xs text-gray-400">{dateVN(nextMeeting.start)} · {timeVN(nextMeeting.start)}–{timeVN(nextMeeting.end)}</p>
                </div>
              </div>
            </SectionCard>
          ) : null}

          <SectionCard title="Công việc liên quan">
            {relatedTasks.length ? (
              <div className="space-y-2">
                {relatedTasks.map((t) => (
                  <Link key={t.id} href="/work" className="block rounded-lg border border-gray-200 p-2.5 hover:border-primary-300 dark:border-dark-600">
                    <div className="flex items-center gap-2"><span className="flex-1 truncate text-sm font-medium text-gray-800 dark:text-dark-100">{t.title}</span><Badge tone={statusTone[t.status] ?? "neutral"}>{statusLabel[t.status] ?? t.status}</Badge></div>
                    <p className="mt-1 text-xs text-gray-400">Hạn {dateVN(t.dueDate)} · {t.progress}%</p>
                  </Link>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400">Không có công việc liên quan.</p>}
          </SectionCard>

          <SectionCard accent="neutral" title="Tệp đã chia sẻ">
            {sharedFiles.length ? (
              <div className="space-y-2">
                {sharedFiles.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 text-sm"><span>{docIcon(d.type)}</span><span className="flex-1 truncate text-gray-700 dark:text-dark-100">{d.title}</span><span className="text-xs text-gray-400">{fileSize(d.size)}</span></div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400">Chưa có tệp chia sẻ.</p>}
          </SectionCard>

          <AiRecap
            title="X.AI tóm tắt trao đổi"
            points={[
              "Đã thống nhất bản proposal cập nhật theo góp ý tài chính.",
              "Chốt lịch demo 08/08 lúc 10:00–11:30 qua Microsoft Teams.",
              "Khách xác nhận tham dự, mời thêm Kế toán trưởng.",
              "Đã tạo task theo dõi phê duyệt proposal.",
            ]}
            footnote="X.AI chỉ tóm tắt nội dung DM — không tự gửi tin nhắn."
          />
        </div>
      </div>
    </div>
  );
}
