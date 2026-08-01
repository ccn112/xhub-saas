import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import { getObjective } from "@/xoffice/lib/manage-data";

export const metadata = { title: "Chi tiết mục tiêu · XHub" };
export const dynamic = "force-dynamic";

export default async function ObjectiveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const obj = await getObjective(id);
  if (!obj) notFound();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/manage/objectives" className="text-xs text-primary-600 hover:underline">← Mục tiêu</Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">{obj.code} · {obj.name}</h1>
          <Badge tone={obj.status === "AT_RISK" ? "warning" : obj.status === "ACHIEVED" ? "success" : "info"}>{obj.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">{obj.perspective ?? "—"} · nhịp {obj.reviewCadence ?? "—"} · chủ {obj.ownerId}</p>
      </div>

      <SectionCard title="KPI liên kết (đo lường mục tiêu)" accent="info">
        {obj.linkedMetrics && obj.linkedMetrics.length > 0 ? (
          <ul className="divide-y divide-gray-100 dark:divide-dark-600">
            {obj.linkedMetrics.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-800 dark:text-dark-50">{m.code} · {m.name}</p>
                  <p className="text-xs text-gray-400">Nguồn {m.sourceSystem} · đơn vị {m.unit} · hướng {m.direction}</p>
                </div>
                <Link href="/manage/metrics" className="shrink-0 text-xs font-medium text-primary-600 hover:underline">Xem KPI →</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">Chưa liên kết KPI nào (linkedMetricIds là tham chiếu, không nhúng).</p>
        )}
      </SectionCard>
    </div>
  );
}
