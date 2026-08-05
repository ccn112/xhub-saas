import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import {
  getContract,
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_TONE,
  OBLIGATION_ALERT_TONE,
  formatMoney,
} from "@/xoffice/lib/revenue-data";
import { ContractStatusActions, ObligationActions } from "@/xoffice/revenue/ContractActions.client";

export const dynamic = "force-dynamic";

const ALERT_LABEL: Record<string, string> = {
  PENDING: "Đang chờ", DUE_SOON: "Sắp đến hạn", OVERDUE: "Trễ hạn", COMPLETED: "Hoàn thành", WAIVED: "Miễn trừ",
};
const EVENT_LABEL: Record<string, string> = {
  created: "Tạo hợp đồng", line_added: "Thêm dòng hợp đồng", status_changed: "Đổi trạng thái", signed: "Ký hợp đồng",
  obligation_completed: "Hoàn thành nghĩa vụ", obligation_escalated: "Báo cáo trễ hạn", billing_request_generated: "Tạo yêu cầu xuất hoá đơn",
};

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { detail, source } = await getContract(id);
  if (source === "api" && !detail) notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">{detail?.contract.contractNo ?? id}</h1>
          {detail ? (
            <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
              {detail.contract.customer ? (
                <Link href={`/office/customers/${detail.contract.customer.id}`} className="text-primary-600 hover:underline dark:text-primary-400">
                  {detail.contract.customer.name}
                </Link>
              ) : null}
              {" · "}
              {formatMoney(detail.contract.totalAmount, detail.contract.currency)}
            </p>
          ) : null}
        </div>
        {detail ? <Badge tone={CONTRACT_STATUS_TONE[detail.contract.status] ?? "neutral"}>{CONTRACT_STATUS_LABEL[detail.contract.status] ?? detail.contract.status}</Badge> : null}
      </div>

      {!detail ? (
        <Card className="p-4 text-sm text-gray-400">Không tải được hợp đồng (backend offline).</Card>
      ) : (
        <>
          <Card className="p-4">
            <ContractStatusActions contractId={detail.contract.id} currentStatus={detail.contract.status} />
            {detail.signatures.length > 0 ? (
              <p className="mt-3 text-xs text-gray-500 dark:text-dark-300">
                Đã ký: {detail.signatures.map((s) => `${s.envelopeRef} (${s.provider})`).join(", ")}
              </p>
            ) : null}
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-100">Dòng hợp đồng</h2>
            <div className="mt-2 space-y-2">
              {detail.lines.map((l) => (
                <div key={l.id} className="rounded-lg border border-gray-200 p-2 text-sm dark:border-dark-600">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-800 dark:text-dark-50">{l.catalogItem?.name ?? l.catalogItemId}</span>
                    <span>{formatMoney(l.lineValue, l.currency)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">{l.deliveryMethod} · {l.billingMethod}{l.acceptanceRequired ? " · cần nghiệm thu" : ""}</p>
                </div>
              ))}
              {detail.lines.length === 0 ? <p className="text-sm text-gray-400">Chưa có dòng hợp đồng nào.</p> : null}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-100">Nghĩa vụ &amp; cảnh báo (BO-0208)</h2>
            <div className="mt-2 space-y-2">
              {detail.obligations.map((o) => (
                <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 p-2 text-sm dark:border-dark-600">
                  <div>
                    <p className="font-medium text-gray-800 dark:text-dark-50">{o.title}{o.billingPercent ? ` (${o.billingPercent}%)` : ""}</p>
                    <p className="text-xs text-gray-400">Hạn: {new Date(o.dueDate).toLocaleDateString("vi-VN")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={OBLIGATION_ALERT_TONE[o.alertStatus] ?? "neutral"}>{ALERT_LABEL[o.alertStatus] ?? o.alertStatus}</Badge>
                    <ObligationActions obligationId={o.id} status={o.status} />
                  </div>
                </div>
              ))}
              {detail.obligations.length === 0 ? <p className="text-sm text-gray-400">Chưa có nghĩa vụ nào (sinh tự động khi hợp đồng có hiệu lực).</p> : null}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-100">Yêu cầu xuất hoá đơn</h2>
            <div className="mt-2 space-y-1 text-sm">
              {detail.billingRequests.map((b) => (
                <div key={b.id} className="flex items-center justify-between border-b border-gray-100 pb-1 last:border-0 dark:border-dark-700">
                  <span>{formatMoney(b.requestedAmount, b.currency)}</span>
                  <Badge tone={b.status === "READY" ? "success" : b.status === "BLOCKED" ? "error" : "neutral"}>{b.status}</Badge>
                </div>
              ))}
              {detail.billingRequests.length === 0 ? <p className="text-gray-400">Chưa có yêu cầu xuất hoá đơn nào.</p> : null}
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
