import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { listWorkItems } from "@/xoffice/lib/work-items-data";
import { STATUS_LABEL, STATUS_TONE, fmtDate } from "@/xoffice/work/work-states";

export const metadata = { title: "Tổng quan công việc · XHub" };
export const dynamic = "force-dynamic";

// Work Overview (WK-01) — live KPIs over the actor's NativeWorkItems. Replaces
// the legacy seed board (Route Migration Plan M-001). Degrades gracefully to an
// empty state with an offline badge when the backend is down.
export default async function WorkOverviewPage() {
  const { items, source } = await listWorkItems({ scope: "mine", pageSize: 200 });

  const active = items.filter((t) => ["TODO", "IN_PROGRESS", "REVIEW"].includes(t.status)).length;
  const overdue = items.filter((t) => t.overdue).length;
  const blocked = items.filter((t) => t.status === "BLOCKED").length;
  const done = items.filter((t) => t.status === "DONE").length;
  const upcoming = items
    .filter((t) => t.dueAt && !["DONE", "CANCELLED"].includes(t.status))
    .sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)))
    .slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Tổng quan công việc</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">Việc của tôi — tiến độ, quá hạn, bị chặn và các mốc sắp tới</p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Tổng việc của tôi" value={String(items.length)} icon="📋" tone="primary" />
        <StatCard label="Đang thực hiện" value={String(active)} icon="🔄" tone="info" />
        <StatCard label="Quá hạn" value={String(overdue)} icon="⏰" tone="error" />
        <StatCard label="Bị chặn / Hoàn tất" value={`${blocked} / ${done}`} icon="✅" tone="success" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/work/tasks" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">Việc của tôi →</Link>
        <Link href="/work/tasks/assigned-by-me" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:border-primary-400 dark:border-dark-500 dark:text-dark-100">Tôi giao →</Link>
      </div>

      <SectionCard title="Sắp đến hạn" accent="warning">
        <ul className="space-y-2">
          {upcoming.map((t) => (
            <li key={t.id}>
              <Link href={`/work/items/${t.id}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-dark-600/40">
                <span className="truncate text-gray-700 dark:text-dark-100">{t.title}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge tone={STATUS_TONE[t.status] ?? "neutral"}>{STATUS_LABEL[t.status] ?? t.status}</Badge>
                  <span className="text-xs text-gray-400">{fmtDate(t.dueAt)}</span>
                </span>
              </Link>
            </li>
          ))}
          {upcoming.length === 0 && <li className="text-sm text-gray-400">Không có việc nào sắp đến hạn</li>}
        </ul>
      </SectionCard>
    </div>
  );
}
