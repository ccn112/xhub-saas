import Link from "next/link";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import {
  listSupportCases,
  SUPPORT_CASE_CATEGORY_LABEL,
  SUPPORT_CASE_PRIORITY_LABEL,
  SUPPORT_CASE_PRIORITY_TONE,
  SUPPORT_CASE_STATUS_LABEL,
  SUPPORT_CASE_STATUS_TONE,
} from "@/xoffice/lib/support-cases-data";
import { SupportCaseCreateButton } from "@/xoffice/support-cases/SupportCaseCreateButton.client";

export const metadata = { title: "Hỗ trợ khách hàng sản phẩm · X.Office" };
export const dynamic = "force-dynamic";

const STATUS_FILTERS = ["", "NEW", "TRIAGED", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED", "CANCELLED"];

export default async function SupportCasesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status = sp.status ?? "";
  const { items, source } = await listSupportCases({ status: status || undefined });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">Hỗ trợ khách hàng sản phẩm</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
            Ý kiến/hỗ trợ khách hàng cho X2, X1, FinERP, X.Space — thao tác, sửa dữ liệu, hướng dẫn, hoặc cần nâng cấp phần mềm (chuyển Backlog/Defect trên Engineering Hub).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? "Đã kết nối backend" : "Backend offline (demo)"}</Badge>
          <SupportCaseCreateButton />
        </div>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-500 dark:text-dark-300">Trạng thái:</span>
          {STATUS_FILTERS.map((s) => (
            <Link
              key={s || "ALL"}
              href={`/office/support-cases${s ? `?status=${s}` : ""}`}
              className={`rounded-full border px-3 py-1 ${s === status ? "border-primary-500 bg-primary-50 font-medium text-primary-700 dark:bg-primary-500/10 dark:text-primary-300" : "border-gray-200 text-gray-600 dark:border-dark-600 dark:text-dark-200"}`}
            >
              {s ? SUPPORT_CASE_STATUS_LABEL[s] ?? s : "Tất cả"}
            </Link>
          ))}
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-dark-600 dark:text-dark-300">
              <th className="px-3 py-2 font-medium">Mã case</th>
              <th className="px-3 py-2 font-medium">Tiêu đề</th>
              <th className="px-3 py-2 font-medium">Sản phẩm</th>
              <th className="px-3 py-2 font-medium">Loại</th>
              <th className="px-3 py-2 font-medium">Ưu tiên</th>
              <th className="px-3 py-2 font-medium">Trạng thái</th>
              <th className="px-3 py-2 font-medium">Chuyển kỹ thuật</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-dark-700 dark:hover:bg-dark-800">
                <td className="px-3 py-2">
                  <Link href={`/office/support-cases/${c.id}`} className="font-medium text-primary-600 hover:underline dark:text-primary-400">
                    {c.code}
                  </Link>
                </td>
                <td className="px-3 py-2 text-gray-700 dark:text-dark-100">{c.title}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-dark-200">{c.productCode}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-dark-200">{SUPPORT_CASE_CATEGORY_LABEL[c.category] ?? c.category}</td>
                <td className="px-3 py-2">
                  <Badge tone={SUPPORT_CASE_PRIORITY_TONE[c.priority] ?? "neutral"}>{SUPPORT_CASE_PRIORITY_LABEL[c.priority] ?? c.priority}</Badge>
                </td>
                <td className="px-3 py-2">
                  <Badge tone={SUPPORT_CASE_STATUS_TONE[c.status] ?? "neutral"}>{SUPPORT_CASE_STATUS_LABEL[c.status] ?? c.status}</Badge>
                </td>
                <td className="px-3 py-2">
                  {c.escalationType ? (
                    <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
                      {c.escalationType === "BACKLOG" ? "Backlog" : "Defect"} {c.escalatedItemCode}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                  {source === "offline" ? "Không tải được dữ liệu (backend offline)." : "Chưa có case hỗ trợ nào."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
