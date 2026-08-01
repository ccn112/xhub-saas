import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import { listReviews, getReview } from "@/xoffice/lib/manage-data";
import { ReviewLoop } from "@/xoffice/manage/ReviewLoop";

export const metadata = { title: "Rà soát (Business Review) · XHub" };
export const dynamic = "force-dynamic";

const statusTone: Record<string, "success" | "warning" | "info" | "neutral"> = {
  PLANNING: "neutral", PRE_READ: "info", LIVE: "info", FOLLOW_UP: "warning", CLOSED: "success",
};

// MG-08 Business Reviews — the "Review" layer. Lists cadence instances; the most
// recent review is expanded inline to SHOW THE LOOP IS CONNECTED: pre-read =
// metric snapshot (computed from Work) + exceptions → decisions → actions each
// linked to a REAL NativeWorkItem.
export default async function ReviewsPage() {
  const { items, source } = await listReviews();
  const newest = items[0] ? await getReview(items[0].id) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Rà soát (Business Review)</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">Vỏ nhịp điều hành: pre-read = ảnh chụp KPI + ngoại lệ → quyết định → cam kết (#7)</p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>

      <SectionCard title={`Kỳ rà soát (${items.length})`} accent="primary">
        <ul className="divide-y divide-gray-100 dark:divide-dark-600">
          {items.map((r) => (
            <li key={r.id}>
              <Link href={`/manage/reviews/${r.id}`} className="flex items-center justify-between gap-3 px-1 py-2.5 hover:bg-gray-50 dark:hover:bg-dark-600/40">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-dark-50">{r.title ?? r.type}</p>
                  <p className="text-xs text-gray-400">{r.type} · {new Date(r.periodStart).toLocaleDateString("vi-VN")} → {new Date(r.periodEnd).toLocaleDateString("vi-VN")} · {r.metricObservationIds.length} KPI · {r.decisionIds.length} quyết định · {r.actionIds.length} cam kết</p>
                </div>
                <Badge tone={statusTone[r.status] ?? "neutral"}>{r.status}</Badge>
              </Link>
            </li>
          ))}
          {items.length === 0 && <li className="py-3 text-sm text-gray-400">Chưa có kỳ rà soát — chạy npm run seed:manage</li>}
        </ul>
      </SectionCard>

      {newest && <ReviewLoop review={newest} heading="Vòng lặp kỳ gần nhất" />}
    </div>
  );
}
