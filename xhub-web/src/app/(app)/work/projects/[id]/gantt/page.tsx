import Link from "next/link";
import { Badge } from "@/xhub/ui/Badge";
import { getProject, getProjectGantt } from "@/xoffice/lib/work-projects-data";
import { GanttClient } from "@/xoffice/work/GanttClient";

export const metadata = { title: "Gantt dự án · XHub" };
export const dynamic = "force-dynamic";

// Project Gantt (W3, WK-08). The operational schedule editor: planned-vs-actual
// bars, dependency edges, milestone diamonds, drag/resize → server-validated
// reschedule. Coordination mode (owner requirement #1) renders rolled-up parent
// summary bars only — children/description are stripped SERVER-SIDE for a
// summary viewer, never shipped to the browser.
export default async function ProjectGanttPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ detail }, { gantt }] = await Promise.all([getProject(id), getProjectGantt(id)]);

  if (!detail && !gantt) {
    return (
      <div className="space-y-3">
        <Link href="/work/projects" className="text-sm text-primary-600 hover:underline">← Dự án thực thi</Link>
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center dark:border-dark-500">
          <p className="text-sm text-gray-500">Không tải được dự án (backend offline hoặc không có quyền).</p>
        </div>
      </div>
    );
  }

  const access = detail?.access ?? gantt?.access ?? "SUMMARY";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href={`/work/projects/${id}`} className="text-sm text-primary-600 hover:underline">← Chi tiết dự án</Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium text-gray-700 dark:text-dark-100">Gantt</span>
        </div>
        {access === "SUMMARY" && <Badge tone="info">Chia sẻ phối hợp</Badge>}
      </div>
      <GanttClient projectId={id} detail={detail} coordination={gantt} canEdit={access === "FULL"} />
    </div>
  );
}
