import Link from "next/link";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import {
  listProducts,
  listBacklog,
  BACKLOG_STATUS_LABEL,
  BACKLOG_STATUS_TONE,
  BACKLOG_TYPE_LABEL,
} from "@/xhub/engineering/engineering-data";

export const metadata = { title: "Backlog · Phát triển & Chất lượng" };
export const dynamic = "force-dynamic";

const STATUS_FILTERS = ["", "IDEA", "TRIAGED", "READY", "IN_PROGRESS", "IN_REVIEW", "READY_FOR_TEST", "TESTING", "ACCEPTED", "RELEASED", "BLOCKED"];

export default async function EngineeringBacklogPage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const { items: products, source: productsSource } = await listProducts();
  const productId = sp.productId ?? products[0]?.id ?? "";
  const status = sp.status ?? "";
  const { items, source } = productId ? await listBacklog(productId, status || undefined) : { items: [], source: "offline" as const };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">Backlog</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
            Kế hoạch theo sản phẩm — trạng thái theo FSM (không nhảy cóc). Feature/BacklogItem (DG-02).
          </p>
        </div>
        <Badge tone={productsSource === "api" ? "success" : "warning"}>
          {productsSource === "api" ? "Kết nối backend" : "Backend offline"}
        </Badge>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-500 dark:text-dark-300">Sản phẩm:</span>
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/engineering/backlog?productId=${p.id}`}
              className={`rounded-full border px-3 py-1 ${p.id === productId ? "border-primary-500 bg-primary-50 font-medium text-primary-700 dark:bg-primary-500/10 dark:text-primary-300" : "border-gray-200 text-gray-600 dark:border-dark-600 dark:text-dark-200"}`}
            >
              {p.code}
            </Link>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-500 dark:text-dark-300">Trạng thái:</span>
          {STATUS_FILTERS.map((s) => (
            <Link
              key={s || "ALL"}
              href={`/engineering/backlog?productId=${productId}${s ? `&status=${s}` : ""}`}
              className={`rounded-full border px-3 py-1 ${s === status ? "border-primary-500 bg-primary-50 font-medium text-primary-700 dark:bg-primary-500/10 dark:text-primary-300" : "border-gray-200 text-gray-600 dark:border-dark-600 dark:text-dark-200"}`}
            >
              {s ? BACKLOG_STATUS_LABEL[s] ?? s : "Tất cả"}
            </Link>
          ))}
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-dark-600 dark:text-dark-300">
              <th className="px-3 py-2 font-medium">Mã</th>
              <th className="px-3 py-2 font-medium">Tiêu đề</th>
              <th className="px-3 py-2 font-medium">Loại</th>
              <th className="px-3 py-2 font-medium">Ưu tiên</th>
              <th className="px-3 py-2 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <tr key={b.id} className="border-b border-gray-100 last:border-0 dark:border-dark-700">
                <td className="px-3 py-2 font-medium text-gray-800 dark:text-dark-50">{b.code}</td>
                <td className="px-3 py-2 text-gray-700 dark:text-dark-100">{b.title}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-dark-200">{BACKLOG_TYPE_LABEL[b.type] ?? b.type}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-dark-200">{b.priority}</td>
                <td className="px-3 py-2">
                  <Badge tone={BACKLOG_STATUS_TONE[b.status] ?? "neutral"}>{BACKLOG_STATUS_LABEL[b.status] ?? b.status}</Badge>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                  {source === "offline" ? "Backend offline." : "Không có backlog item nào khớp bộ lọc."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
