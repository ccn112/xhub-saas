import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import {
  listAISystems,
  AI_RISK_TIER_LABEL,
  AI_RISK_TIER_TONE,
  ASSESSMENT_STATUS_LABEL,
  ASSESSMENT_STATUS_TONE,
} from "@/xhub/engineering/engineering-data";

export const metadata = { title: "Quản trị AI (AI Governance) · Phát triển & Chất lượng" };
export const dynamic = "force-dynamic";

export default async function EngineeringAiSystemsPage() {
  const { items, source } = await listAISystems();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">Quản trị AI (AI Governance)</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
            Đăng ký các hệ thống/tính năng AI đang dùng trong hệ sinh thái (DG-10) — chỉ ghi nhận những gì THẬT SỰ
            đang chạy, không phải danh mục giả định. Đánh giá tác động (impact assessment) luôn cần con người xác
            nhận, AI không tự phê duyệt.
          </p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((s) => {
          const latest = s.impactAssessments[0];
          return (
            <Card key={s.id} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-gray-800 dark:text-dark-50">{s.name}</span>
                <Badge tone={AI_RISK_TIER_TONE[s.riskTier] ?? "neutral"}>{AI_RISK_TIER_LABEL[s.riskTier] ?? s.riskTier}</Badge>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {s.code} {s.provider ? `· ${s.provider}` : ""}
              </p>
              {s.purpose ? <p className="mt-2 text-sm text-gray-600 dark:text-dark-200">{s.purpose}</p> : null}
              {s.humanOversight ? (
                <p className="mt-2 rounded-lg bg-gray-50 p-2 text-xs text-gray-500 dark:bg-dark-800 dark:text-dark-300">
                  <span className="font-medium">Giám sát con người:</span> {s.humanOversight}
                </p>
              ) : null}
              {s.standardsRefs.length > 0 ? (
                <p className="mt-2 flex flex-wrap gap-1">
                  {s.standardsRefs.map((r) => (
                    <span key={r} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500 dark:bg-dark-700 dark:text-dark-300">
                      {r}
                    </span>
                  ))}
                </p>
              ) : null}
              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 text-xs dark:border-dark-700">
                <span className="text-gray-400">Đánh giá tác động gần nhất:</span>
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
            {source === "offline" ? "Backend offline." : "Chưa có AI system nào đăng ký."}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
