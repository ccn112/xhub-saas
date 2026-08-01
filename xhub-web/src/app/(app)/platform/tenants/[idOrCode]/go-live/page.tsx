import Link from "next/link";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import { getGoLive, MODE_TONES, MODE_LABELS } from "@/xhub/platform/platform-data";
import { GoLiveWizard } from "@/xhub/platform/GoLiveWizard";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ idOrCode: string }> }) {
  const { idOrCode } = await params;
  return { title: `Go-Live ${idOrCode} · Platform Console` };
}

export default async function TenantGoLivePage({ params }: { params: Promise<{ idOrCode: string }> }) {
  const { idOrCode } = await params;
  const { view, source } = await getGoLive(idOrCode);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/platform/tenants/${idOrCode}`} className="text-sm text-primary-600 hover:underline dark:text-primary-400">
            ← Chi tiết tenant
          </Link>
          <h1 className="font-heading mt-1 text-xl font-semibold text-gray-800 dark:text-dark-50">
            Go-Live · {idOrCode}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {view?.tenant?.mode ? (
            <Badge tone={MODE_TONES[view.tenant.mode] ?? "neutral"}>{MODE_LABELS[view.tenant.mode] ?? view.tenant.mode}</Badge>
          ) : null}
          <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
        </div>
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-100">
          Checklist chuyển sang chính thức (tuần tự)
        </h2>
        <p className="mt-1 mb-3 text-xs text-gray-500 dark:text-dark-300">
          Chuẩn hoá cơ cấu → nạp nhân sự thật → cấu hình vai trò/quyền → thiết lập quy trình duyệt → nhập danh mục gốc → cấu hình
          backup → nghiệm thu UAT → xác nhận xoá dữ liệu demo → kích hoạt LIVE.
        </p>
        {view ? (
          <GoLiveWizard idOrCode={idOrCode} view={view} />
        ) : (
          <p className="text-sm text-gray-500">Không tải được dữ liệu Go-Live cho {idOrCode} (backend offline?).</p>
        )}
      </Card>
    </div>
  );
}
