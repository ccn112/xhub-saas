import Link from "next/link";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import { listBlueprints, CATALOG_STATUS_TONES } from "@/xhub/platform/platform-data";

export const metadata = { title: "Blueprint · Platform Console" };
export const dynamic = "force-dynamic";

export default async function PlatformBlueprintsPage() {
  const { items, source } = await listBlueprints();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">Blueprint Catalog</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
            Khuôn vận hành theo ngành (apps · roles · org · workflow · menu). Bản đã xuất bản là bất biến (immutable) — sửa = tạo version mới.
          </p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>
          {source === "api" ? "Kết nối backend" : "Backend offline"}
        </Badge>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-dark-600 dark:text-dark-300">
              <th className="px-3 py-2 font-medium">Mã</th>
              <th className="px-3 py-2 font-medium">Tên</th>
              <th className="px-3 py-2 font-medium">Ngành</th>
              <th className="px-3 py-2 font-medium">Version</th>
              <th className="px-3 py-2 font-medium">Trạng thái</th>
              <th className="px-3 py-2 font-medium">Apps</th>
              <th className="px-3 py-2 font-medium">Checksum</th>
            </tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <tr key={b.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-dark-700 dark:hover:bg-dark-800">
                <td className="px-3 py-2">
                  <Link href={`/platform/blueprints/${b.id}`} className="font-medium text-primary-600 hover:underline dark:text-primary-400">
                    {b.code}
                  </Link>
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-dark-200">{b.name}</td>
                <td className="px-3 py-2 text-gray-500 dark:text-dark-300">{b.industry ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">v{b.version}</td>
                <td className="px-3 py-2"><Badge tone={CATALOG_STATUS_TONES[b.status] ?? "neutral"}>{b.status}</Badge></td>
                <td className="px-3 py-2 text-gray-500 dark:text-dark-300">{(b.appsEnabled ?? []).join(", ") || "—"}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-400">{b.checksum ? b.checksum.slice(0, 10) : "—"}</td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                  Chưa có blueprint. Chạy <code>npm run seed:blueprint-catalog</code>.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
