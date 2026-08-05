import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import { listCatalogItems } from "@/xoffice/lib/revenue-data";

export const metadata = { title: "Danh mục thương mại · X.Office" };
export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const { items, source } = await listCatalogItems();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">Danh mục thương mại</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
            Sản phẩm/dịch vụ dùng để lập đề xuất &amp; hợp đồng (BO-0203). Tạo/sửa qua API — trang này chỉ xem
            (chưa có form tạo trong đợt này).
          </p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-dark-600 dark:text-dark-300">
              <th className="px-3 py-2 font-medium">Mã</th>
              <th className="px-3 py-2 font-medium">Tên</th>
              <th className="px-3 py-2 font-medium">Loại</th>
              <th className="px-3 py-2 font-medium">Mô hình giá</th>
              <th className="px-3 py-2 font-medium">Phiên bản</th>
              <th className="px-3 py-2 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-b border-gray-100 last:border-0 dark:border-dark-700">
                <td className="px-3 py-2 font-medium text-gray-800 dark:text-dark-50">{i.code}</td>
                <td className="px-3 py-2 text-gray-700 dark:text-dark-100">{i.name}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-dark-200">{i.commercialType}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-dark-200">{i.priceModel ?? "—"}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-dark-200">v{i.version}</td>
                <td className="px-3 py-2">
                  <Badge tone={i.active ? "success" : "neutral"}>{i.active ? "Đang dùng" : "Ngừng dùng"}</Badge>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                  {source === "offline" ? "Backend offline." : "Chưa có mục nào trong danh mục."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
