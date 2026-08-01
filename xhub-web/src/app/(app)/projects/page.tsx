import { StatCard } from "@/xhub/ui/StatCard";
import { collection } from "@/xhub/lib/seed";
import { userName } from "@/xhub/lib/repo";
import { num } from "@/xhub/lib/format";
import type { Project } from "@/xhub/lib/screen-types";
import { ProjectsBrowser, type ProjectRow } from "./ProjectsBrowser";

export const metadata = { title: "Dự án · XHub" };

interface Milestone { id: string; projectId: string }

export default function ProjectsPage() {
  const projects = collection<Project>("projects");
  const milestones = collection<Milestone>("milestones");

  const msCount = (pid: string) => milestones.filter((m) => m.projectId === pid).length;

  const rows: ProjectRow[] = projects.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    status: p.status,
    progress: p.progress,
    managerName: userName(p.managerId),
    ownerName: userName(p.ownerId),
    milestoneCount: msCount(p.id),
    openTasks: p.openTasks ?? 0,
  }));

  const total = projects.length;
  const active = projects.filter((p) => p.status === "active").length;
  const totalMilestones = milestones.length;
  const avgProgress = total ? Math.round(projects.reduce((s, p) => s + (p.progress ?? 0), 0) / total) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Dự án</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">Danh mục dự án — theo dõi trạng thái, tiến độ và chủ nhiệm.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Tổng dự án" value={num(total)} icon="📁" tone="primary" />
        <StatCard label="Đang chạy" value={num(active)} icon="🚀" tone="success" />
        <StatCard label="Milestone" value={num(totalMilestones)} icon="🎯" tone="info" />
        <StatCard label="Tiến độ trung bình" value={`${avgProgress}%`} icon="📈" tone="neutral" />
      </div>

      <ProjectsBrowser projects={rows} />
    </div>
  );
}
