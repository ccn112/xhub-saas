import { notFound } from "next/navigation";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import {
  getSupportCase,
  SUPPORT_CASE_CATEGORY_LABEL,
  SUPPORT_CASE_CHANNEL_LABEL,
  SUPPORT_CASE_EVENT_LABEL,
  SUPPORT_CASE_PRIORITY_LABEL,
  SUPPORT_CASE_PRIORITY_TONE,
  SUPPORT_CASE_STATUS_LABEL,
  SUPPORT_CASE_STATUS_TONE,
} from "@/xoffice/lib/support-cases-data";
import { SupportCaseActions } from "@/xoffice/support-cases/SupportCaseActions.client";

export const dynamic = "force-dynamic";

export default async function SupportCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { detail, source } = await getSupportCase(id);
  if (source === "api" && !detail) notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">{detail?.case.title ?? id}</h1>
          {detail ? (
            <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
              {detail.case.code} · {detail.case.productCode}
              {detail.customer ? ` · ${detail.customer.name}` : ""}
            </p>
          ) : null}
        </div>
        {detail ? (
          <div className="flex items-center gap-2">
            <Badge tone={SUPPORT_CASE_PRIORITY_TONE[detail.case.priority] ?? "neutral"}>{SUPPORT_CASE_PRIORITY_LABEL[detail.case.priority] ?? detail.case.priority}</Badge>
            <Badge tone={SUPPORT_CASE_STATUS_TONE[detail.case.status] ?? "neutral"}>{SUPPORT_CASE_STATUS_LABEL[detail.case.status] ?? detail.case.status}</Badge>
          </div>
        ) : null}
      </div>

      {!detail ? (
        <Card className="p-4 text-sm text-gray-400">Không tải được case hỗ trợ (backend offline).</Card>
      ) : (
        <>
          <Card className="p-4 space-y-3">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-gray-400">Loại yêu cầu</p>
                <p className="text-gray-700 dark:text-dark-100">{SUPPORT_CASE_CATEGORY_LABEL[detail.case.category] ?? detail.case.category}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Kênh nhận</p>
                <p className="text-gray-700 dark:text-dark-100">{SUPPORT_CASE_CHANNEL_LABEL[detail.case.channel] ?? detail.case.channel}</p>
              </div>
              {detail.case.requesterName ? (
                <div>
                  <p className="text-xs text-gray-400">Người yêu cầu</p>
                  <p className="text-gray-700 dark:text-dark-100">{detail.case.requesterName}</p>
                </div>
              ) : null}
              {detail.case.requesterContact ? (
                <div>
                  <p className="text-xs text-gray-400">Liên hệ</p>
                  <p className="text-gray-700 dark:text-dark-100">{detail.case.requesterContact}</p>
                </div>
              ) : null}
              {detail.case.description ? (
                <div className="sm:col-span-2">
                  <p className="text-xs text-gray-400">Mô tả</p>
                  <p className="whitespace-pre-wrap text-gray-700 dark:text-dark-100">{detail.case.description}</p>
                </div>
              ) : null}
            </div>
            <div className="border-t border-gray-100 pt-3 dark:border-dark-700">
              <SupportCaseActions
                caseId={detail.case.id}
                legalActions={detail.case.legalActions}
                alreadyEscalated={detail.case.escalationType ? { type: detail.case.escalationType, code: detail.case.escalatedItemCode ?? null } : null}
              />
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-100">Lịch sử xử lý</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {detail.events.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 border-b border-gray-100 pb-2 last:border-0 dark:border-dark-700">
                  <div className="min-w-0">
                    <span className="text-gray-700 dark:text-dark-100">{SUPPORT_CASE_EVENT_LABEL[e.type] ?? e.type}</span>
                    {e.type === "comment" && typeof e.data?.body === "string" ? (
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-dark-300">{e.data.body}</p>
                    ) : null}
                    {e.type === "escalate" ? (
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-dark-300">
                        {String(e.data?.type)} {String(e.data?.code ?? "")}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-gray-400">{new Date(e.createdAt).toLocaleString("vi-VN")}</span>
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
