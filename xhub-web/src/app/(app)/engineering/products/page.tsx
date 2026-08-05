import Link from "next/link";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import { listProducts, PRODUCT_TYPE_LABEL, VERSION_STATUS_LABEL, VERSION_STATUS_TONE } from "@/xhub/engineering/engineering-data";

export const metadata = { title: "Sản phẩm & Repository · Phát triển & Chất lượng" };
export const dynamic = "force-dynamic";

export default async function EngineeringProductsPage() {
  const { items, source } = await listProducts();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">Sản phẩm &amp; Repository</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
            Registry cấp nền tảng (không theo tenant) — xem chi tiết từng sản phẩm để biết version/component/repo.
          </p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>
          {source === "api" ? "Kết nối backend" : "Backend offline"}
        </Badge>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-dark-600 dark:text-dark-300">
              <th className="px-3 py-2 font-medium">Thứ tự</th>
              <th className="px-3 py-2 font-medium">Mã</th>
              <th className="px-3 py-2 font-medium">Tên</th>
              <th className="px-3 py-2 font-medium">Loại</th>
              <th className="px-3 py-2 font-medium">Version policy</th>
              <th className="px-3 py-2 font-medium">Version mới nhất</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => {
              const latest = p.versions?.[0];
              return (
                <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-dark-700 dark:hover:bg-dark-800">
                  <td className="px-3 py-2 tabular-nums text-gray-600 dark:text-dark-200">{p.rolloutOrder ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Link href={`/engineering/products/${p.code}`} className="font-medium text-primary-600 hover:underline dark:text-primary-400">
                      {p.code}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-gray-800 dark:text-dark-50">{p.name}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-dark-200">{PRODUCT_TYPE_LABEL[p.type] ?? p.type}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-dark-200">{p.versionPolicy}</td>
                  <td className="px-3 py-2">
                    {latest ? (
                      <Badge tone={VERSION_STATUS_TONE[latest.status] ?? "neutral"}>
                        {latest.version} · {VERSION_STATUS_LABEL[latest.status] ?? latest.status}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                  Không có sản phẩm nào (backend offline hoặc chưa seed).
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
