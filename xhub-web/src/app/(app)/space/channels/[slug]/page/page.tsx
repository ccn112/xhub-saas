import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { AiRecap } from "@/xhub/ui/AiRecap";
import { collection, byId, where } from "@/xhub/lib/seed";
import { dateVN, dateTimeVN, num } from "@/xhub/lib/format";
import { userName, initials, channelBySlug } from "@/xhub/lib/repo";
import { ChannelHeader, docIcon, fileSize } from "../../../_components/ChannelHeader";

export const metadata = { title: "Trang channel · X.Space" };

type PageBlock =
  | { type: "goal"; title: string; content: string }
  | { type: "scope"; title: string; items: string[] }
  | { type: "milestones"; title: string; milestoneIds: string[] }
  | { type: "checklist"; title: string; taskIds: string[] }
  | { type: "rules"; title: string; items: string[] };
type ChannelPage = { id: string; channelId: string; title: string; updatedAt: string; blocks: PageBlock[] };
type Milestone = { id: string; name: string; dueDate: string; status: string; progress: number };
type Task = { id: string; title: string; assigneeId: string; dueDate: string; status: string; progress: number };
type Doc = { id: string; title: string; type: string; size: number; updatedAt: string; uploadedBy: string; projectId?: string };
type Project = { id: string; name: string; progress: number; openTasks: number; openTickets: number; riskHigh: number; managerId: string };
type Member = { channelId: string; userId: string; role: string };
type Activity = { id: string; actorId: string; summary: string; occurredAt: string; channelId: string };

const msStatus: Record<string, { tone: "success" | "info" | "neutral"; label: string }> = {
  completed: { tone: "success", label: "Hoàn tất" },
  in_progress: { tone: "info", label: "Đang làm" },
  not_started: { tone: "neutral", label: "Chưa bắt đầu" },
};

const workingRules = [
  "Cập nhật trạng thái công việc mỗi ngày trước 17:00.",
  "Mọi quyết định phải được ghim và gắn người chịu trách nhiệm.",
  "Tài liệu lưu đúng thư mục, đặt tên theo quy ước dự án.",
];
const faqs = [
  { q: "Ai là đầu mối liên hệ khách hàng?", a: "Trần Thu Hà (Kinh doanh) phụ trách trao đổi chính với Minh Phát." },
  { q: "Môi trường demo ở đâu?", a: "Truy cập qua Microsoft Teams, tài khoản mẫu do nhóm kỹ thuật cấp." },
  { q: "Quy trình đổi scope?", a: "Gửi CR, chờ duyệt nội bộ rồi ký xác nhận scope với khách." },
];
const quickLinks = [
  { label: "Kế hoạch dự án", href: "/work", icon: "📋" },
  { label: "Kho tài liệu", href: "/space", icon: "📁" },
  { label: "Bảng công việc", href: "/work", icon: "✅" },
  { label: "Lịch dự án", href: "/home/executive", icon: "🗓️" },
];

export default async function ChannelInfoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const channel = channelBySlug(slug);
  const page = channel ? collection<ChannelPage>("channelPages").find((p) => p.channelId === channel.id) : undefined;

  if (!channel || !page) {
    return (
      <div className="space-y-4">
        <ChannelHeader slug={slug} active="page" />
        <SectionCard title="Chưa có trang channel">
          <p className="text-sm text-gray-500 dark:text-dark-300">Channel này chưa được cấu hình trang thông tin. Hãy tạo trang để onboarding thành viên nhanh hơn.</p>
          <button className="mt-3 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700">+ Tạo trang channel</button>
        </SectionCard>
      </div>
    );
  }

  const project = channel.projectId ? byId<Project>("projects", channel.projectId) : undefined;
  const members = where<Member>("channelMembers", "channelId", channel.id);
  const activity = where<Activity>("activityEvents", "channelId", channel.id).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 5);
  const newDocs = collection<Doc>("documents")
    .filter((d) => d.projectId === channel.projectId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 4);

  const block = <T extends PageBlock["type"]>(type: T) => page.blocks.find((b) => b.type === type) as Extract<PageBlock, { type: T }> | undefined;
  const goal = block("goal");
  const scope = block("scope");
  const msBlock = block("milestones");
  const checklist = block("checklist");
  const rulesBlock = block("rules");

  return (
    <div className="space-y-4">
      <ChannelHeader slug={slug} active="page" breadcrumb="Trang channel" />

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">Cập nhật lần cuối {dateTimeVN(page.updatedAt)}</p>
        <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-dark-600 dark:text-dark-100 dark:hover:bg-dark-600">✎ Chỉnh sửa trang</button>
      </div>

      {/* Project KPI */}
      {project ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Tiến độ dự án" value={`${project.progress}%`} icon="📈" tone="primary" />
          <StatCard label="Việc đang mở" value={num(project.openTasks)} icon="✅" tone="info" />
          <StatCard label="Ticket mở" value={num(project.openTickets)} icon="🎫" tone="warning" />
          <StatCard label="Rủi ro cao" value={num(project.riskHigh)} icon="⚠️" tone="error" />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {goal ? (
            <SectionCard title={goal.title}>
              <p className="text-sm text-gray-700 dark:text-dark-100">{goal.content}</p>
            </SectionCard>
          ) : null}

          {scope ? (
            <SectionCard title={scope.title}>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {scope.items.map((it, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2.5 text-sm text-gray-700 dark:border-dark-600 dark:text-dark-100">
                    <span className="text-primary-600">◆</span>{it}
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}

          {msBlock ? (
            <SectionCard title={msBlock.title} bodyClassName="p-0">
              <ol className="divide-y divide-gray-100 dark:divide-dark-600">
                {msBlock.milestoneIds.map((id) => {
                  const ms = byId<Milestone>("milestones", id);
                  if (!ms) return null;
                  const st = msStatus[ms.status] ?? { tone: "neutral" as const, label: ms.status };
                  return (
                    <li key={id} className="flex items-center gap-3 px-4 py-3">
                      <span className={`size-2.5 shrink-0 rounded-full ${ms.status === "completed" ? "bg-success" : ms.status === "in_progress" ? "bg-info" : "bg-gray-300 dark:bg-dark-500"}`} />
                      <span className="flex-1 text-sm font-medium text-gray-800 dark:text-dark-100">{ms.name}</span>
                      <span className="text-xs text-gray-400">{dateVN(ms.dueDate)}</span>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </li>
                  );
                })}
              </ol>
            </SectionCard>
          ) : null}

          {checklist ? (
            <SectionCard title={checklist.title}>
              <div className="space-y-2">
                {checklist.taskIds.map((id) => {
                  const t = byId<Task>("tasks", id);
                  if (!t) return null;
                  const done = t.status === "completed";
                  return (
                    <div key={id} className="flex items-center gap-2 text-sm">
                      <span className={`flex size-4 items-center justify-center rounded border ${done ? "border-success bg-success text-white" : "border-gray-300 dark:border-dark-500"}`}>{done ? "✓" : ""}</span>
                      <span className={`flex-1 ${done ? "text-gray-400 line-through" : "text-gray-700 dark:text-dark-100"}`}>{t.title}</span>
                      <span className="text-xs text-gray-400">{userName(t.assigneeId)}</span>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          ) : null}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard accent="neutral" title="Quy tắc làm việc">
              <ul className="space-y-2 text-sm text-gray-700 dark:text-dark-100">
                {(rulesBlock?.items ?? workingRules).map((r, i) => (
                  <li key={i} className="flex gap-2"><span className="text-primary-600">›</span>{r}</li>
                ))}
              </ul>
            </SectionCard>
            <SectionCard accent="neutral" title="FAQ">
              <div className="space-y-3">
                {faqs.map((f, i) => (
                  <div key={i}>
                    <p className="text-sm font-medium text-gray-800 dark:text-dark-100">{f.q}</p>
                    <p className="text-sm text-gray-500 dark:text-dark-300">{f.a}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          <SectionCard accent="neutral" title="Biên bản họp gần nhất">
            {(() => {
              const minutes = collection<Doc>("documents").find((d) => d.id === "doc-week31-minutes");
              if (!minutes) return <p className="text-sm text-gray-400">Chưa có biên bản.</p>;
              return (
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 dark:border-dark-600">
                  <span className="text-xl">{docIcon(minutes.type)}</span>
                  <div className="flex-1"><p className="text-sm font-medium text-gray-800 dark:text-dark-100">{minutes.title}</p><p className="text-xs text-gray-400">Cập nhật {dateVN(minutes.updatedAt)} · {userName(minutes.uploadedBy)}</p></div>
                  <button className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:border-dark-600 dark:text-dark-100 dark:hover:bg-dark-600">Mở</button>
                </div>
              );
            })()}
          </SectionCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <AiRecap
            title="X.AI mẹo bảo trì trang"
            points={[
              "Trang chưa cập nhật mục FAQ trong 7 ngày — nên rà soát lại.",
              "Có 2 mốc sắp đến hạn: UAT và Go-live, nên kiểm tra tiến độ.",
              "Gợi ý ghim quyết định lịch demo lên đầu trang.",
            ]}
            footnote="X.AI chỉ gợi ý — không tự sửa nội dung trang."
          />

          <SectionCard accent="neutral" title={`Thành viên (${members.length})`}>
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.userId} className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-full bg-info/15 text-xs font-semibold text-info-darker dark:text-info-lighter">{initials(userName(m.userId))}</span>
                  <span className="flex-1 truncate text-sm text-gray-800 dark:text-dark-100">{userName(m.userId)}</span>
                  {m.role === "admin" ? <Badge tone="primary">Admin</Badge> : null}
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard accent="neutral" title="Liên kết nhanh">
            <div className="grid grid-cols-2 gap-2">
              {quickLinks.map((l) => (
                <Link key={l.label} href={l.href} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2.5 text-sm text-gray-700 hover:border-primary-300 dark:border-dark-600 dark:text-dark-100">
                  <span>{l.icon}</span>{l.label}
                </Link>
              ))}
            </div>
          </SectionCard>

          <SectionCard accent="neutral" title="Tài liệu mới">
            <div className="space-y-2">
              {newDocs.map((d) => (
                <div key={d.id} className="flex items-center gap-2 text-sm">
                  <span>{docIcon(d.type)}</span>
                  <span className="flex-1 truncate text-gray-700 dark:text-dark-100">{d.title}</span>
                  <span className="text-xs text-gray-400">{fileSize(d.size)}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard accent="neutral" title="Hoạt động gần đây">
            <ol className="space-y-3">
              {activity.map((a) => (
                <li key={a.id} className="flex gap-2 text-sm">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary-500" />
                  <div><p className="text-gray-700 dark:text-dark-100">{a.summary}</p><p className="text-xs text-gray-400">{dateTimeVN(a.occurredAt)}</p></div>
                </li>
              ))}
            </ol>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
