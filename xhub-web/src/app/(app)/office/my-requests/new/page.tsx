import Link from "next/link";
import { Badge } from "@/xhub/ui/Badge";
import { SectionCard } from "@/xhub/ui/Card";
import { listWorkflows } from "@/xoffice/lib/workflow-data";

export const metadata = { title: "Tạo yêu cầu mới · X.Office" };
export const dynamic = "force-dynamic";

// U29 FAIL: /office/my-requests had no way to start a new request — the only
// real "create" entry point (`/office/workflows/[code]/request`) needs a
// workflow code, and the catalog that lists codes (`/office/workflows`) is
// admin-gated (`workflow.*`). This page is the missing, ungated middle step:
// pick WHICH published procedure to start, open to anyone who can create a
// request (same nav permission as /office/my-requests itself).
export default async function NewRequestPickerPage() {
  const { items, source } = await listWorkflows();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Tạo yêu cầu mới</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">Chọn thủ tục/quy trình muốn bắt đầu — biểu mẫu đúng của thủ tục đó sẽ hiện ra ở bước tiếp theo.</p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? "Kết nối backend" : "Dữ liệu seed (offline)"}</Badge>
      </div>

      {items.length === 0 ? (
        <SectionCard title="Chưa có thủ tục nào" accent="warning">
          <p className="text-sm text-gray-500 dark:text-dark-300">Chưa có quy trình nào được xuất bản. Liên hệ quản trị viên X.Office để thiết lập.</p>
        </SectionCard>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((w) => (
            <Link
              key={w.code}
              href={`/office/workflows/${w.code}/request`}
              className="group rounded-xl border border-gray-200 p-4 transition hover:border-primary-400 hover:shadow-sm dark:border-dark-600"
            >
              <p className="font-medium text-gray-800 group-hover:text-primary-600 dark:text-dark-50">{w.name}</p>
              {w.description ? <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-dark-300">{w.description}</p> : null}
              <p className="mt-2 font-mono text-[11px] text-gray-400">{w.code} · v{w.version}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
