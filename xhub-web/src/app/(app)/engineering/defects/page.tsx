import Link from "next/link";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import {
  listProducts,
  listDefects,
  DEFECT_STATUS_LABEL,
  DEFECT_STATUS_TONE,
  DEFECT_SEVERITY_LABEL,
} from "@/xhub/engineering/engineering-data";

export const metadata = { title: "Lỗi (Defect) · Phát triển & Chất lượng" };
export const dynamic = "force-dynamic";

const STATUS_FILTERS = ["", "NEW", "TRIAGED", "IN_PROGRESS", "FIX_READY", "VERIFYING", "CLOSED", "WONT_FIX", "REOPENED"];

export default async function EngineeringDefectsPage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const { items: products, source: productsSource } = await listProducts();
  const productId = sp.productId ?? products[0]?.id ?? "";
  const status = sp.status ?? "";
  const { items, source } = productId ? await listDefects(productId, { status: status || undefined }) : { items: [], source: "offline" as const };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">Lỗi (Defect)</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
            Lỗi theo sản phẩm — có thể phát sinh từ 1 kết quả kiểm thử FAIL (nút &quot;Báo lỗi&quot; ở trang Kiểm
            thử) hoặc tạo tay. P0/P1 bắt buộc có nguyên nhân gốc trước khi đóng (DG-05).
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
              href={`/engineering/defects?productId=${p.id}`}
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
              href={`/engineering/defects?productId=${productId}${s ? `&status=${s}` : ""}`}
              className={`rounded-full border px-3 py-1 ${s === status ? "border-primary-500 bg-primary-50 font-medium text-primary-700 dark:bg-primary-500/10 dark:text-primary-300" : "border-gray-200 text-gray-600 dark:border-dark-600 dark:text-dark-200"}`}
            >
              {s ? DEFECT_STATUS_LABEL[s] ?? s : "Tất cả"}
            </Link>
          ))}
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-dark-600 dark:text-dark-300">
              <th className="px-3 py-2 font-medium">Mã</th>
              <th className="px-3 py-2 font-medium">Tiêu đề</th>
              <th className="px-3 py-2 font-medium">Mức độ</th>
              <th className="px-3 py-2 font-medium">Trạng thái</th>
              <th className="px-3 py-2 font-medium">Cập nhật</th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id} className="border-b border-gray-100 last:border-0 dark:border-dark-700">
                <td className="px-3 py-2 font-medium text-gray-800 dark:text-dark-50">{d.code}</td>
                <td className="px-3 py-2 text-gray-700 dark:text-dark-100">
                  {d.title}
                  {d.testResultId ? <span className="ml-1.5 text-[11px] text-gray-400">(từ kết quả kiểm thử)</span> : null}
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-dark-200">{DEFECT_SEVERITY_LABEL[d.severity] ?? d.severity}</td>
                <td className="px-3 py-2">
                  <Badge tone={DEFECT_STATUS_TONE[d.status] ?? "neutral"}>{DEFECT_STATUS_LABEL[d.status] ?? d.status}</Badge>
                </td>
                <td className="px-3 py-2 text-xs text-gray-400">{new Date(d.updatedAt).toLocaleString("vi-VN")}</td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                  {source === "offline" ? "Backend offline." : "Chưa có lỗi nào khớp bộ lọc."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
