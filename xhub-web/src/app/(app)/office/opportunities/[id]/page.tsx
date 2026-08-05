import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import {
  getOpportunity,
  OPPORTUNITY_STAGE_LABEL,
  OPPORTUNITY_STAGE_TONE,
  PROPOSAL_STATUS_LABEL,
  PROPOSAL_STATUS_TONE,
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_TONE,
  formatMoney,
} from "@/xoffice/lib/revenue-data";
import { OpportunityActions } from "@/xoffice/revenue/OpportunityActions.client";

export const dynamic = "force-dynamic";

const EVENT_LABEL: Record<string, string> = { created: "Tạo cơ hội", stage_changed: "Đổi giai đoạn" };

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { detail, source } = await getOpportunity(id);
  if (source === "api" && !detail) notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">{detail?.opportunity.title ?? id}</h1>
          {detail ? (
            <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
              {detail.customer ? (
                <Link href={`/office/customers/${detail.customer.id}`} className="text-primary-600 hover:underline dark:text-primary-400">
                  {detail.customer.name}
                </Link>
              ) : null}
              {" · "}
              {formatMoney(detail.opportunity.expectedAmount, detail.opportunity.currency)}
              {detail.opportunity.probability != null ? ` · ${Math.round(detail.opportunity.probability * 100)}%` : ""}
            </p>
          ) : null}
        </div>
        {detail ? <Badge tone={OPPORTUNITY_STAGE_TONE[detail.opportunity.stage] ?? "neutral"}>{OPPORTUNITY_STAGE_LABEL[detail.opportunity.stage] ?? detail.opportunity.stage}</Badge> : null}
      </div>

      {!detail ? (
        <Card className="p-4 text-sm text-gray-400">Không tải được cơ hội (backend offline).</Card>
      ) : (
        <>
          <Card className="p-4">
            {detail.opportunity.lostReason ? (
              <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
                Lý do thua: {detail.opportunity.lostReason}
              </p>
            ) : null}
            <OpportunityActions opportunityId={detail.opportunity.id} currentStage={detail.opportunity.stage} />
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-100">Đề xuất (Proposal)</h2>
            <div className="mt-2 space-y-2">
              {detail.proposals.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-2 text-sm dark:border-dark-600">
                  <span>
                    v{p.version} · {formatMoney(p.totalAmount, p.currency)}
                    {p.requiresApproval ? <span className="ml-1 text-[11px] text-amber-600 dark:text-amber-400">(cần duyệt giảm giá)</span> : null}
                  </span>
                  <Badge tone={PROPOSAL_STATUS_TONE[p.status] ?? "neutral"}>{PROPOSAL_STATUS_LABEL[p.status] ?? p.status}</Badge>
                </div>
              ))}
              {detail.proposals.length === 0 ? <p className="text-sm text-gray-400">Chưa có đề xuất nào.</p> : null}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-100">Hợp đồng</h2>
            <div className="mt-2 space-y-2">
              {detail.contracts.map((c) => (
                <Link key={c.id} href={`/office/contracts/${c.id}`} className="flex items-center justify-between rounded-lg border border-gray-200 p-2 text-sm hover:border-primary-400 dark:border-dark-600">
                  <span>{c.contractNo} · {formatMoney(c.totalAmount, c.currency)}</span>
                  <Badge tone={CONTRACT_STATUS_TONE[c.status] ?? "neutral"}>{CONTRACT_STATUS_LABEL[c.status] ?? c.status}</Badge>
                </Link>
              ))}
              {detail.contracts.length === 0 ? <p className="text-sm text-gray-400">Chưa có hợp đồng nào từ cơ hội này.</p> : null}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-100">Lịch sử</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {detail.events.map((e) => (
                <li key={e.id} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0 dark:border-dark-700">
                  <span className="text-gray-700 dark:text-dark-100">{EVENT_LABEL[e.type] ?? e.type}</span>
                  <span className="text-xs text-gray-400">{new Date(e.createdAt).toLocaleString("vi-VN")}</span>
                </li>
              ))}
              {detail.events.length === 0 ? <li className="text-gray-400">Chưa có hoạt động nào.</li> : null}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
