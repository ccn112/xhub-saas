import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import {
  listProcessingActivities,
  ASSESSMENT_STATUS_LABEL,
  ASSESSMENT_STATUS_TONE,
} from "@/xhub/engineering/engineering-data";

export const metadata = { title: "Bảo vệ dữ liệu (Privacy/DPIA) · Phát triển & Chất lượng" };
export const dynamic = "force-dynamic";

export default async function EngineeringPrivacyPage() {
  const { items, source } = await listProcessingActivities();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">Bảo vệ dữ liệu (Privacy/DPIA)</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
            Đăng ký các hoạt động xử lý dữ liệu cá nhân đang THẬT SỰ diễn ra (DG-11) — không phải danh mục giả
            định. Đánh giá tác động dữ liệu (DPIA) luôn cần con người xác nhận.
          </p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((a) => {
          const latest = a.assessments[0];
          return (
            <Card key={a.id} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-gray-800 dark:text-dark-50">{a.name}</span>
                <span className="text-xs text-gray-400">{a.code}</span>
              </div>
              {a.purpose ? <p className="mt-2 text-sm text-gray-600 dark:text-dark-200">{a.purpose}</p> : null}
              {a.dataCategories.length > 0 ? (
                <p className="mt-2 flex flex-wrap gap-1">
                  {a.dataCategories.map((d) => (
                    <span key={d} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500 dark:bg-dark-700 dark:text-dark-300">
                      {d}
                    </span>
                  ))}
                </p>
              ) : null}
              {a.legalBasis ? (
                <p className="mt-2 text-xs text-gray-500 dark:text-dark-300">
                  <span className="font-medium">Căn cứ pháp lý:</span> {a.legalBasis}
                </p>
              ) : null}
              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 text-xs dark:border-dark-700">
                <span className="text-gray-400">DPIA gần nhất:</span>
                {latest ? (
                  <Badge tone={ASSESSMENT_STATUS_TONE[latest.status] ?? "neutral"}>{ASSESSMENT_STATUS_LABEL[latest.status] ?? latest.status}</Badge>
                ) : (
                  <span className="text-gray-400">Chưa có</span>
                )}
              </div>
            </Card>
          );
        })}
        {items.length === 0 ? (
          <Card className="p-4 text-sm text-gray-400 md:col-span-2">
            {source === "offline" ? "Backend offline." : "Chưa có hoạt động xử lý dữ liệu nào đăng ký."}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
