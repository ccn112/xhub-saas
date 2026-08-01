import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { listDecisions } from "@/xoffice/lib/manage-data";

export const metadata = { title: "Quyết định (RAPID) · XHub" };
export const dynamic = "force-dynamic";

const statusTone: Record<string, "success" | "warning" | "info" | "neutral"> = {
  PROPOSED: "warning", DECIDED: "info", IN_EXECUTION: "info", REALIZED: "success", SUPERSEDED: "neutral", REVERSED: "neutral",
};

// MG-10 Decision Center — the "Decide" layer. RAPID backlog with memo + aging.
// A DecisionRecord captures decision RIGHTS + rationale + evidence, distinct from
// a Directive (#3), and may spawn an ActionCommitment (the loop's next step).
export default async function DecisionsPage() {
  const { items, source } = await listDecisions();
  const open = items.filter((d) => ["PROPOSED", "DECIDED", "IN_EXECUTION"].includes(d.status)).length;
  const oldest = items.reduce((max, d) => Math.max(max, d.ageDays ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Quyết định (RAPID)</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">Nhật ký quyết định: quyền quyết (RAPID) + lý do + bằng chứng — không nhầm với chỉ đạo (#3)</p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Tổng quyết định" value={String(items.length)} icon="🗳️" tone="primary" />
        <StatCard label="Đang mở" value={String(open)} icon="⏳" tone="info" />
        <StatCard label="Tồn lâu nhất" value={`${oldest} ngày`} icon="📅" tone={oldest > 14 ? "warning" : "neutral"} />
      </div>

      <SectionCard title={`Backlog quyết định (${items.length})`} accent="primary">
        <ul className="space-y-2">
          {items.map((d) => (
            <li key={d.id} className="rounded-lg border border-gray-100 p-3 dark:border-dark-600">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-sm font-medium text-gray-800 dark:text-dark-50">{d.question}</p>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge tone={statusTone[d.status] ?? "neutral"}>{d.status}</Badge>
                  <span className="text-xs text-gray-400">{d.ageDays ?? 0}d</span>
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-600 dark:text-dark-200">→ {d.decision}</p>
              <p className="mt-1 text-xs text-gray-400">
                Người quyết {d.deciderId}{d.recommenderId ? ` · đề xuất ${d.recommenderId}` : ""}
                {d.evidenceRefs.length ? ` · ${d.evidenceRefs.length} bằng chứng` : ""}
              </p>
            </li>
          ))}
          {items.length === 0 && <li className="text-sm text-gray-400">Chưa có quyết định — chạy npm run seed:manage</li>}
        </ul>
      </SectionCard>
    </div>
  );
}
