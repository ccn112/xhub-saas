import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { AiRecap } from "@/xhub/ui/AiRecap";
import { collection, byId } from "@/xhub/lib/seed";
import { dateVN, dateTimeVN } from "@/xhub/lib/format";
import { userName } from "@/xhub/lib/repo";
import { slaInfo } from "@/xhub/lib/sla";
import type { Task, Directive, Project } from "@/xhub/lib/screen-types";
import { WorkClient, type WorkTask } from "./WorkClient";

export const metadata = { title: "Công việc và chỉ đạo · XHub" };

interface Decision { id: string; title: string; content: string; decidedAt: string; decidedBy: string; status: string }

const STATUS_LABEL: Record<string, string> = {
  not_started: "Chưa bắt đầu", new: "Mới", in_progress: "Đang làm", waiting: "Chờ", completed: "Hoàn tất", overdue: "Quá hạn",
};

export default function WorkPage() {
  const tasks = collection<Task>("tasks");
  const directive = byId<Directive>("directives", "directive-week31");

  const projectName = (id?: string | null) => (id ? byId<Project>("projects", id)?.name ?? id : "—");

  const workTasks: WorkTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    assigneeName: userName(t.assigneeId),
    projectName: projectName(t.projectId),
    dueDate: t.dueDate,
    priority: t.priority,
    status: t.status,
    progress: t.progress,
    overdue: slaInfo(`${t.dueDate}T17:00:00+07:00`).overdue && t.status !== "completed",
  }));

  const subtasks = (directive?.taskIds ?? []).map((id) => byId<Task>("tasks", id)).filter(Boolean) as Task[];
  const decisions = collection<Decision>("decisions").sort((a, b) => b.decidedAt.localeCompare(a.decidedAt));

  const overdue = workTasks.filter((t) => t.overdue).length;
  const completed = workTasks.filter((t) => t.status === "completed").length;
  const active = workTasks.filter((t) => ["in_progress", "new", "not_started", "waiting"].includes(t.status)).length;

  const aiPoints = [
    `${workTasks.length} công việc đang theo dõi: ${active} đang chạy, ${overdue} quá hạn, ${completed} hoàn tất.`,
    directive ? `Chỉ đạo tuần 31 đạt ${directive.progress}%, còn ${subtasks.filter((s) => s.status !== "completed").length}/${subtasks.length} hạng mục chưa xong.` : "Chưa có chỉ đạo hoạt động.",
    overdue > 0 ? `Ưu tiên xử lý ${overdue} việc quá hạn để không ảnh hưởng golive.` : "Không có việc quá hạn.",
    `${decisions.length} quyết định gần đây đã được chốt và ghi nhận.`,
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Công việc và chỉ đạo</h1>
        <p className="text-sm text-gray-500 dark:text-dark-300">Theo dõi công việc, chỉ đạo điều hành, quyết định và cam kết thực hiện</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Tổng công việc" value={String(workTasks.length)} icon="📋" tone="primary" />
        <StatCard label="Đang thực hiện" value={String(active)} icon="🔄" tone="info" />
        <StatCard label="Quá hạn" value={String(overdue)} icon="⏰" tone="error" />
        <StatCard label="Hoàn tất" value={String(completed)} icon="✅" tone="success" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <WorkClient tasks={workTasks} />
        </div>

        <div className="space-y-4">
          {directive ? (
            <SectionCard title="Chỉ đạo tuần 31">
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-800 dark:text-dark-100">{directive.title}</p>
                <p className="text-sm text-gray-600 dark:text-dark-200">{directive.objective}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                  <span>Ban hành: {userName(directive.issuedBy)}</span>
                  <span>Phụ trách: {userName(directive.ownerId)}</span>
                  <span>Hạn: {dateVN(directive.dueDate)}</span>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-sm"><span className="text-gray-600 dark:text-dark-200">Tiến độ chung</span><span className="font-medium">{directive.progress}%</span></div>
                  <div className="h-2 w-full rounded-full bg-gray-150 dark:bg-dark-500"><div className="h-2 rounded-full bg-primary-600" style={{ width: `${directive.progress}%` }} /></div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Hạng mục thực hiện</p>
                  <ul className="space-y-2">
                    {subtasks.map((s) => (
                      <li key={s.id} className="flex items-start gap-2">
                        <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] ${s.status === "completed" ? "bg-success text-white" : "border border-gray-300 text-transparent dark:border-dark-500"}`}>✓</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-700 dark:text-dark-100">{s.title}</p>
                          <p className="text-xs text-gray-400">{userName(s.assigneeId)} · {STATUS_LABEL[s.status] ?? s.status} · {s.progress}%</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </SectionCard>
          ) : null}

          <AiRecap title="X.AI phân tích" points={aiPoints} footnote="X.AI phân tích tiến độ · chỉ hỗ trợ, không thay quyết định." />

          <SectionCard accent="neutral" title="Quyết định gần đây">
            <ul className="space-y-3">
              {decisions.map((d) => (
                <li key={d.id} className="rounded-lg border border-gray-200 p-3 dark:border-dark-600">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-800 dark:text-dark-100">{d.title}</p>
                    <Badge tone="success">Đã chốt</Badge>
                  </div>
                  <p className="mt-1 text-sm text-gray-600 dark:text-dark-200">{d.content}</p>
                  <p className="mt-1 text-xs text-gray-400">{userName(d.decidedBy)} · {dateTimeVN(d.decidedAt)}</p>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
