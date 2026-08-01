import Link from "next/link";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import { listLaunches, LAUNCH_STATUS_TONES } from "@/xhub/platform/platform-data";
import { StartLaunchForm } from "@/xhub/platform/StartLaunchForm";

export const metadata = { title: "Khởi chạy tenant · Platform Console" };
export const dynamic = "force-dynamic";

export default async function PlatformLaunchesPage() {
  const { items, source } = await listLaunches();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">Khởi chạy tenant (Launch Factory)</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
            Dây chuyền provisioning 8 bước: idempotent · retry · resumable · audited. Tái dùng control-plane outbox, backup và registry.
          </p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>
          {source === "api" ? "Kết nối backend" : "Backend offline"}
        </Badge>
      </div>

      <StartLaunchForm />

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-dark-600 dark:text-dark-300">
              <th className="px-3 py-2 font-medium">Tenant đích</th>
              <th className="px-3 py-2 font-medium">Trạng thái</th>
              <th className="px-3 py-2 font-medium">Bước hiện tại</th>
              <th className="px-3 py-2 font-medium">Tạo bởi</th>
              <th className="px-3 py-2 font-medium">Thời điểm</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-dark-700 dark:hover:bg-dark-800">
                <td className="px-3 py-2">
                  <Link href={`/platform/launches/${l.id}`} className="font-medium text-primary-600 hover:underline dark:text-primary-400">
                    {l.targetTenantId}
                  </Link>
                </td>
                <td className="px-3 py-2"><Badge tone={LAUNCH_STATUS_TONES[l.status] ?? "neutral"}>{l.status}</Badge></td>
                <td className="px-3 py-2 text-gray-600 dark:text-dark-200">{l.currentStepKey ?? "—"}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-dark-200">{l.createdBy ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums text-gray-500 dark:text-dark-300">{new Date(l.createdAt).toLocaleString("vi-VN")}</td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                  Chưa có launch nào. Nhấn “Khởi chạy tenant” để bắt đầu.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
