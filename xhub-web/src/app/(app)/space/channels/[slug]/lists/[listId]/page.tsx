import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { AiRecap } from "@/xhub/ui/AiRecap";
import { collection, byId } from "@/xhub/lib/seed";
import { dateVN, dateTimeVN } from "@/xhub/lib/format";
import { userName, initials, channelBySlug } from "@/xhub/lib/repo";
import { ChannelHeader, docIcon, fileSize } from "../../../../_components/ChannelHeader";

export const metadata = { title: "Danh sách cộng tác · X.Space" };

type List = { id: string; channelId: string; title: string; description: string; views: string[]; updatedAt: string; itemIds: string[] };
type Task = { id: string; title: string; assigneeId: string; dueDate: string; priority: string; status: string; progress: number };
type Doc = { id: string; title: string; type: string; size: number };

const statusMeta: Record<string, { tone: "success" | "warning" | "info" | "neutral" | "error"; label: string }> = {
  in_progress: { tone: "info", label: "Đang làm" },
  waiting: { tone: "warning", label: "Chờ" },
  completed: { tone: "success", label: "Hoàn tất" },
  not_started: { tone: "neutral", label: "Chưa bắt đầu" },
  new: { tone: "neutral", label: "Mới" },
  overdue: { tone: "error", label: "Quá hạn" },
};
const prioTone: Record<string, "error" | "warning" | "neutral"> = { high: "error", medium: "warning", low: "neutral" };
const viewLabel: Record<string, string> = { list: "Danh sách", kanban: "Bảng", calendar: "Lịch" };

export default async function CollaborationListPage({ params }: { params: Promise<{ slug: string; listId: string }> }) {
  const { slug, listId } = await params;
  const channel = channelBySlug(slug);
  const list = byId<List>("collaborationLists", listId);

  if (!channel || !list) {
    return (
      <div className="space-y-4">
        <ChannelHeader slug={slug} active="lists" />
        <SectionCard title="Không tìm thấy danh sách">
          <p className="text-sm text-gray-500 dark:text-dark-300">Danh sách không tồn tại hoặc đã bị xoá.</p>
        </SectionCard>
      </div>
    );
  }

  const items = list.itemIds.map((id) => byId<Task>("tasks", id)).filter(Boolean) as Task[];
  const total = items.length;
  const done = items.filter((t) => t.status === "completed").length;
  const inProgress = items.filter((t) => t.status === "in_progress").length;
  const waiting = items.filter((t) => t.status === "waiting" || t.status === "not_started").length;
  const pinned = items.find((t) => t.priority === "high" && t.status !== "completed");

  // Workload ranking theo người phụ trách
  const workload = new Map<string, { open: number; total: number }>();
  for (const t of items) {
    const w = workload.get(t.assigneeId) ?? { open: 0, total: 0 };
    w.total += 1;
    if (t.status !== "completed") w.open += 1;
    workload.set(t.assigneeId, w);
  }
  const ranking = Array.from(workload.entries()).sort((a, b) => b[1].open - a[1].open);

  const relatedFiles = collection<Doc>("documents").slice(0, 4);

  return (
    <div className="space-y-4">
      <ChannelHeader slug={slug} active="lists" breadcrumb="Danh sách" />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold text-gray-800 dark:text-dark-50">{list.title}</h2>
          <p className="text-sm text-gray-500 dark:text-dark-300">{list.description}</p>
          <p className="mt-1 text-xs text-gray-400">Cập nhật {dateTimeVN(list.updatedAt)}</p>
        </div>
        {/* View toggle */}
        <div className="flex rounded-lg border border-gray-200 p-0.5 dark:border-dark-600">
          {list.views.map((v, i) => (
            <button key={v} className={`rounded-md px-3 py-1 text-xs font-medium ${i === 0 ? "bg-primary-600 text-white" : "text-gray-500 hover:text-gray-800 dark:text-dark-300"}`}>
              {viewLabel[v] ?? v}
            </button>
          ))}
        </div>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Tổng mục" value={String(total)} icon="🗂️" tone="primary" />
        <StatCard label="Đang làm" value={String(inProgress)} icon="🔄" tone="info" />
        <StatCard label="Chờ / chưa bắt đầu" value={String(waiting)} icon="⏳" tone="warning" />
        <StatCard label="Hoàn tất" value={String(done)} icon="✅" tone="success" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {/* Filters + quick actions */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              {["Tất cả", "Của tôi", "Quá hạn", "Ưu tiên cao"].map((f, i) => (
                <button key={f} className={`rounded-full px-3 py-1 text-xs font-medium ${i === 0 ? "bg-primary-600 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-dark-600 dark:text-dark-100 dark:hover:bg-dark-600"}`}>{f}</button>
              ))}
            </div>
            <span className="flex-1" />
            <button className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700">+ Thêm mục</button>
            <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-dark-600 dark:text-dark-100 dark:hover:bg-dark-600">↑ Nâng thành work item</button>
          </div>

          {/* Collaborative item table */}
          {items.length ? (
            <SectionCard title="Danh sách công việc" bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 text-left text-xs text-gray-400 uppercase dark:border-dark-600 dark:text-dark-300">
                    <tr>
                      <th className="px-4 py-3">Công việc</th>
                      <th className="px-4 py-3">Phụ trách</th>
                      <th className="px-4 py-3">Hạn</th>
                      <th className="px-4 py-3">Ưu tiên</th>
                      <th className="px-4 py-3 w-32">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-dark-600">
                    {items.map((t) => {
                      const st = statusMeta[t.status] ?? { tone: "neutral" as const, label: t.status };
                      return (
                        <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-dark-600/40">
                          <td className="px-4 py-3">
                            <Link href="/work" className="font-medium text-gray-800 hover:text-primary-600 dark:text-dark-100">{t.title}</Link>
                            <div className="mt-1 h-1 w-28 rounded-full bg-gray-150 dark:bg-dark-500"><div className="h-1 rounded-full bg-primary-600" style={{ width: `${t.progress}%` }} /></div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="flex size-6 items-center justify-center rounded-full bg-info/15 text-[10px] font-semibold text-info-darker dark:text-info-lighter">{initials(userName(t.assigneeId))}</span>
                              <span className="text-gray-600 dark:text-dark-200">{userName(t.assigneeId)}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-dark-200">{dateVN(t.dueDate)}</td>
                          <td className="px-4 py-3"><Badge tone={prioTone[t.priority] ?? "neutral"}>{t.priority}</Badge></td>
                          <td className="px-4 py-3"><Badge tone={st.tone}>{st.label}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          ) : (
            <SectionCard title="Danh sách trống">
              <p className="text-sm text-gray-500 dark:text-dark-300">Chưa có mục nào. Thêm mục đầu tiên để bắt đầu cộng tác.</p>
              <button className="mt-3 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700">+ Thêm mục</button>
            </SectionCard>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <AiRecap
            title="X.AI tóm tắt tiến độ"
            points={[
              `${done}/${total} mục đã hoàn tất, ${inProgress} mục đang triển khai.`,
              `${waiting} mục đang chờ hoặc chưa bắt đầu, cần theo dõi hạn.`,
              ranking[0] ? `${userName(ranking[0][0])} đang tải nhiều nhất (${ranking[0][1].open} việc mở).` : "Khối lượng công việc phân bổ đều.",
            ]}
            footnote="X.AI chỉ tóm tắt — không tự đổi trạng thái công việc."
          />

          {pinned ? (
            <SectionCard accent="neutral" title="Mục được ghim">
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                <div className="flex items-center gap-2"><span>📌</span><span className="flex-1 text-sm font-medium text-gray-800 dark:text-dark-100">{pinned.title}</span></div>
                <p className="mt-1 text-xs text-gray-500 dark:text-dark-300">{userName(pinned.assigneeId)} · hạn {dateVN(pinned.dueDate)} · {pinned.progress}%</p>
              </div>
            </SectionCard>
          ) : null}

          <SectionCard title="Xếp hạng khối lượng">
            <div className="space-y-3">
              {ranking.map(([uid, w]) => (
                <div key={uid}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-dark-100">{userName(uid)}</span>
                    <span className="text-xs text-gray-400">{w.open} mở / {w.total}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-150 dark:bg-dark-500"><div className="h-1.5 rounded-full bg-primary-600" style={{ width: `${(w.open / Math.max(1, total)) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard accent="neutral" title="Tệp liên quan">
            <div className="space-y-2">
              {relatedFiles.map((d) => (
                <div key={d.id} className="flex items-center gap-2 text-sm">
                  <span>{docIcon(d.type)}</span>
                  <span className="flex-1 truncate text-gray-700 dark:text-dark-100">{d.title}</span>
                  <span className="text-xs text-gray-400">{fileSize(d.size)}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
