import Link from "next/link";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import { listAllVersions, VERSION_STATUS_LABEL, VERSION_STATUS_TONE } from "@/xhub/engineering/engineering-data";

export const metadata = { title: "Phiên bản & Phát hành · Phát triển & Chất lượng" };
export const dynamic = "force-dynamic";

export default async function EngineeringVersionsPage() {
  const { items, source } = await listAllVersions();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">Phiên bản &amp; Phát hành</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
            Toàn bộ ProductVersion xuyên sản phẩm, mới nhất trước. Release train/candidate/build/deployment thật là
            DG-05/06, chưa có ở đây.
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
              <th className="px-3 py-2 font-medium">Sản phẩm</th>
              <th className="px-3 py-2 font-medium">Version</th>
              <th className="px-3 py-2 font-medium">Trạng thái</th>
              <th className="px-3 py-2 font-medium">Kênh</th>
              <th className="px-3 py-2 font-medium">Tạo lúc</th>
            </tr>
          </thead>
          <tbody>
            {items.map((v) => (
              <tr key={v.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-dark-700 dark:hover:bg-dark-800">
                <td className="px-3 py-2">
                  <Link href={`/engineering/products/${v.productCode}`} className="font-medium text-primary-600 hover:underline dark:text-primary-400">
                    {v.productCode}
                  </Link>
                  <span className="ml-1 text-xs text-gray-400">{v.productName}</span>
                </td>
                <td className="px-3 py-2 font-medium text-gray-800 dark:text-dark-50">{v.version}</td>
                <td className="px-3 py-2">
                  <Badge tone={VERSION_STATUS_TONE[v.status] ?? "neutral"}>{VERSION_STATUS_LABEL[v.status] ?? v.status}</Badge>
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-dark-200">{v.releaseChannel ?? "—"}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-dark-200">{new Date(v.createdAt).toLocaleDateString("vi-VN")}</td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                  Không có version nào (backend offline hoặc chưa seed).
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
