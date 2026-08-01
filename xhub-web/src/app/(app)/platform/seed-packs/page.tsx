import Link from "next/link";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import { listSeedPacks, CATALOG_STATUS_TONES } from "@/xhub/platform/platform-data";

export const metadata = { title: "Seed Pack · Platform Console" };
export const dynamic = "force-dynamic";

export default async function PlatformSeedPacksPage() {
  const { items, source } = await listSeedPacks();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">Seed Pack Catalog</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
            Dữ liệu demo/vận hành có version, tham số hoá theo tenant, KHÔNG chứa secret (guard khi publish). Bản đã xuất bản là bất biến.
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
              <th className="px-3 py-2 font-medium">Blueprint</th>
              <th className="px-3 py-2 font-medium">Version</th>
              <th className="px-3 py-2 font-medium">Trạng thái</th>
              <th className="px-3 py-2 font-medium">Dependencies</th>
              <th className="px-3 py-2 font-medium">Checksum</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-dark-700 dark:hover:bg-dark-800">
                <td className="px-3 py-2">
                  <Link href={`/platform/seed-packs/${p.id}`} className="font-medium text-primary-600 hover:underline dark:text-primary-400">
                    {p.code}
                  </Link>
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-dark-200">{p.name}</td>
                <td className="px-3 py-2 text-gray-500 dark:text-dark-300">{p.blueprintCode ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">v{p.version}</td>
                <td className="px-3 py-2"><Badge tone={CATALOG_STATUS_TONES[p.status] ?? "neutral"}>{p.status}</Badge></td>
                <td className="px-3 py-2 text-gray-500 dark:text-dark-300">{(p.dependencies ?? []).join(", ") || "—"}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-400">{p.checksum ? p.checksum.slice(0, 10) : "—"}</td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                  Chưa có seed pack. Chạy <code>npm run seed:blueprint-catalog</code>.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
