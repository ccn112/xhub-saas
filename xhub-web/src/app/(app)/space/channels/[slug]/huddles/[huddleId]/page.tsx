import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import { AiRecap } from "@/xhub/ui/AiRecap";
import { byId } from "@/xhub/lib/seed";
import { timeVN, dateVN, dateTimeVN } from "@/xhub/lib/format";
import { userName, user, initials, channelBySlug } from "@/xhub/lib/repo";
import { ChannelHeader, docIcon, fileSize } from "../../../../_components/ChannelHeader";

export const metadata = { title: "Họp nhanh · X.Space" };

type Huddle = { id: string; channelId: string; title: string; status: string; startedAt: string; participantIds: string[]; files: string[]; notes: string[]; decisionIds: string[]; actionTaskIds: string[] };
type Doc = { id: string; title: string; type: string; size: number };
type Decision = { id: string; title: string; content: string; decidedAt: string; decidedBy: string };
type Task = { id: string; title: string; assigneeId: string; dueDate: string; status: string; priority: string };

const statusMeta: Record<string, { tone: "success" | "warning" | "info" | "neutral"; label: string }> = {
  in_progress: { tone: "info", label: "Đang làm" },
  waiting: { tone: "warning", label: "Chờ" },
  not_started: { tone: "neutral", label: "Chưa bắt đầu" },
  completed: { tone: "success", label: "Hoàn tất" },
};

export default async function HuddlePage({ params }: { params: Promise<{ slug: string; huddleId: string }> }) {
  const { slug, huddleId } = await params;
  const channel = channelBySlug(slug);
  const huddle = byId<Huddle>("huddles", huddleId);

  if (!channel || !huddle) {
    return (
      <div className="space-y-4">
        <ChannelHeader slug={slug} active="huddles" />
        <SectionCard title="Không tìm thấy cuộc họp">
          <p className="text-sm text-gray-500 dark:text-dark-300">Cuộc họp nhanh không tồn tại hoặc đã kết thúc.</p>
        </SectionCard>
      </div>
    );
  }

  const isLive = huddle.status === "live";
  const files = huddle.files.map((id) => byId<Doc>("documents", id)).filter(Boolean) as Doc[];
  const decisions = huddle.decisionIds.map((id) => byId<Decision>("decisions", id)).filter(Boolean) as Decision[];
  const actions = huddle.actionTaskIds.map((id) => byId<Task>("tasks", id)).filter(Boolean) as Task[];

  return (
    <div className="space-y-4">
      <ChannelHeader slug={slug} active="huddles" breadcrumb="Họp nhanh" />

      {/* Huddle header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-lg bg-error/10 text-xl text-error">🎧</span>
          <div>
            <h2 className="font-heading text-lg font-bold text-gray-800 dark:text-dark-50">{huddle.title}</h2>
            <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-dark-300">
              {isLive ? <span className="inline-flex items-center gap-1 text-error"><span className="size-2 animate-pulse rounded-full bg-error" /> Đang diễn ra</span> : <span>Đã kết thúc</span>}
              · bắt đầu {timeVN(huddle.startedAt)} · {huddle.participantIds.length} người
            </p>
          </div>
        </div>
        <Badge tone={isLive ? "error" : "neutral"}>{isLive ? "LIVE" : "Kết thúc"}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {/* Participant stage */}
          <SectionCard title="Sân khấu">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {huddle.participantIds.map((id) => {
                const u = user(id);
                return (
                  <div key={id} className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 p-3 dark:border-dark-600">
                    <span className="relative flex size-14 items-center justify-center rounded-full bg-info/15 text-base font-semibold text-info-darker dark:text-info-lighter">
                      {initials(userName(id))}
                      {u?.presence === "online" ? <span className="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2 border-white bg-success dark:border-dark-700" /> : null}
                    </span>
                    <p className="text-center text-xs font-medium text-gray-700 dark:text-dark-100">{userName(id)}</p>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Meeting controls */}
          <div className="flex flex-wrap items-center justify-center gap-2 rounded-lg bg-gray-50 p-3 dark:bg-dark-700">
            <button className="rounded-full bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-soft hover:bg-gray-100 dark:bg-dark-600 dark:text-dark-100">🎤 Tắt mic</button>
            <button className="rounded-full bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-soft hover:bg-gray-100 dark:bg-dark-600 dark:text-dark-100">🎥 Bật cam</button>
            <button className="rounded-full bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-soft hover:bg-gray-100 dark:bg-dark-600 dark:text-dark-100">🖥️ Chia sẻ màn hình</button>
            <button className="rounded-full bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-soft hover:bg-gray-100 dark:bg-dark-600 dark:text-dark-100">✋ Giơ tay</button>
            <button className="rounded-full bg-error px-4 py-2 text-sm font-medium text-white hover:bg-error/90">Rời họp</button>
          </div>

          {/* Live notes */}
          <SectionCard title="Ghi chú trực tiếp" action={<span className="text-xs text-gray-400">Đồng bộ tự động</span>}>
            <ul className="space-y-2">
              {huddle.notes.map((n, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700 dark:text-dark-100"><span className="text-primary-600">•</span>{n}</li>
              ))}
            </ul>
          </SectionCard>

          {/* AI minutes */}
          <SectionCard title="Biên bản AI" action={<Badge tone="primary">X.AI</Badge>}>
            <div className="space-y-3 text-sm text-gray-700 dark:text-dark-100">
              <div>
                <p className="font-medium text-gray-800 dark:text-dark-50">Nội dung chính</p>
                <p className="text-gray-600 dark:text-dark-200">Nhóm đã chốt lịch demo với Minh Phát vào 08/08 lúc 10:00 và rà soát proposal đã bổ sung phạm vi tích hợp cùng lộ trình triển khai.</p>
              </div>
              <div>
                <p className="font-medium text-gray-800 dark:text-dark-50">Việc cần làm tiếp</p>
                <p className="text-gray-600 dark:text-dark-200">Xác nhận dữ liệu khách hàng để chuẩn bị môi trường demo; hoàn tất cập nhật proposal trước buổi họp chốt.</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-400 italic">X.AI tạo biên bản từ ghi chú họp — vui lòng rà soát trước khi chia sẻ.</p>
          </SectionCard>

          {/* Generated actions */}
          <SectionCard title="Công việc phát sinh" action={<span className="text-xs text-gray-400">Do X.AI đề xuất từ cuộc họp</span>}>
            <div className="space-y-2">
              {actions.map((t) => {
                const st = statusMeta[t.status] ?? { tone: "neutral" as const, label: t.status };
                return (
                  <div key={t.id} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2.5 dark:border-dark-600">
                    <span>📌</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800 dark:text-dark-100">{t.title}</p>
                      <p className="text-xs text-gray-400">{userName(t.assigneeId)} · hạn {dateVN(t.dueDate)}</p>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <AiRecap
            title="X.AI tóm tắt cuộc họp"
            points={[
              "Chốt lịch demo Minh Phát ngày 08/08 lúc 10:00.",
              "Proposal đã bổ sung phạm vi tích hợp và lộ trình.",
              "Cần xác nhận dữ liệu khách để dựng môi trường demo.",
              `${actions.length} công việc phát sinh, ${decisions.length} quyết định được ghi nhận.`,
            ]}
            footnote="X.AI chỉ hỗ trợ ghi biên bản — không tự giao việc."
          />

          <SectionCard accent="neutral" title={`Người tham gia (${huddle.participantIds.length})`}>
            <div className="space-y-2">
              {huddle.participantIds.map((id) => (
                <div key={id} className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-full bg-info/15 text-xs font-semibold text-info-darker dark:text-info-lighter">{initials(userName(id))}</span>
                  <div className="min-w-0"><p className="truncate text-sm text-gray-800 dark:text-dark-100">{userName(id)}</p><p className="truncate text-xs text-gray-400">{user(id)?.title}</p></div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard accent="neutral" title="Tệp đã thảo luận">
            <div className="space-y-2">
              {files.map((d) => (
                <div key={d.id} className="flex items-center gap-2 text-sm">
                  <span>{docIcon(d.type)}</span>
                  <span className="flex-1 truncate text-gray-700 dark:text-dark-100">{d.title}</span>
                  <span className="text-xs text-gray-400">{fileSize(d.size)}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard accent="neutral" title="Quyết định đã chốt">
            <div className="space-y-2">
              {decisions.map((d) => (
                <div key={d.id} className="rounded-lg border border-success/30 bg-success/5 p-2.5">
                  <p className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-dark-100"><span>✅</span>{d.title}</p>
                  <p className="mt-1 text-xs text-gray-600 dark:text-dark-200">{d.content}</p>
                  <p className="mt-1 text-xs text-gray-400">{userName(d.decidedBy)} · {dateTimeVN(d.decidedAt)}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
