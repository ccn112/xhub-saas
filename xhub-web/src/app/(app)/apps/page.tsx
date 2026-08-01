import { SectionCard, Card } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { AiRecap } from "@/xhub/ui/AiRecap";
import { collection } from "@/xhub/lib/seed";
import { num, dateTimeVN } from "@/xhub/lib/format";
import { MEMBER_APPS } from "@/xhub/config/member-apps";
import type { AppCatalogItem, Connector } from "@/xhub/lib/screen-types";

export const metadata = { title: "Danh mục ứng dụng · XHub" };

interface ProductInstance { id: string; productId?: string; name: string; status: string; users?: number; domain?: string }

const statusMeta: Record<string, { label: string; tone: "success" | "info" | "warning" | "neutral" }> = {
  active: { label: "Đang dùng", tone: "success" },
  connected: { label: "Đã kết nối", tone: "info" },
  recommended: { label: "Gợi ý", tone: "warning" },
};
const launchMeta: Record<string, string> = {
  embedded: "Nhúng", sso: "SSO", native: "Gốc", config: "Cấu hình",
};
const appEmoji: Record<string, string> = {
  "app-xbooking": "📅", "app-xbuilding": "🏢", "app-finerp": "💰", "app-xai": "🤖",
  "app-xspace": "💬", "app-erpnext-connector": "🔌", "app-mattermost-connector": "🔗",
  "app-digital-signature": "✒️", "app-einvoice": "🧾", "app-bi": "📊",
};
const connTone: Record<string, "success" | "warning" | "error"> = { healthy: "success", warning: "warning", error: "error" };
const memberEmoji: Record<string, string> = { x1: "🏗️", x2: "🏙️", xweb: "🌐" };

export default function AppsCatalog() {
  const apps = collection<AppCatalogItem>("appCatalog");
  const connectors = collection<Connector>("connectors");
  const instances = collection<ProductInstance>("productInstances");

  const activeApps = apps.filter((a) => a.status === "active");
  const connectedApps = apps.filter((a) => a.status === "connected");
  const recommended = apps.filter((a) => a.status === "recommended");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Danh mục ứng dụng</h1>
        <p className="text-sm text-gray-500 dark:text-dark-300">Khám phá, mở và quản trị ứng dụng, connector và tình trạng tích hợp</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Ứng dụng đang dùng" value={num(activeApps.length)} icon="🧩" tone="primary" />
        <StatCard label="Connector" value={num(connectedApps.length + connectors.length)} icon="🔌" tone="info" />
        <StatCard label="Instance triển khai" value={num(instances.length)} icon="🖥️" tone="success" />
        <StatCard label="Gợi ý mở rộng" value={num(recommended.length)} icon="✨" tone="warning" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <SectionCard title="Lưới ứng dụng">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {apps.map((a) => {
                const st = statusMeta[a.status] ?? { label: a.status, tone: "neutral" as const };
                return (
                  <div key={a.id} className="flex gap-3 rounded-lg border border-gray-200 p-3 dark:border-dark-600">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary-600/10 text-xl">{appEmoji[a.id] ?? "📦"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-medium text-gray-800 dark:text-dark-100">{a.name}</p>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-dark-300">{a.description}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        {a.users ? `${num(a.users)} người dùng · ` : ""}{a.instances ? `${a.instances} instance · ` : ""}{launchMeta[a.launchMode ?? ""] ?? a.launchMode}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Ứng dụng thành viên — mở tab mới */}
          <SectionCard title="Ứng dụng thành viên">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {MEMBER_APPS.map((app) => (
                <a
                  key={app.key}
                  href={app.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col gap-2 rounded-lg border border-gray-200 p-3 transition hover:border-primary-300 hover:shadow-soft dark:border-dark-600"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-primary-600/10 text-xl">{memberEmoji[app.key] ?? "🚀"}</span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-800 group-hover:text-primary-600 dark:text-dark-100">{app.name}</p>
                      <p className="text-xs text-gray-400">{app.category}</p>
                    </div>
                    <span className="ml-auto text-xs text-gray-400 group-hover:text-primary-600">↗</span>
                  </div>
                  <p className="line-clamp-2 text-xs text-gray-500 dark:text-dark-300">{app.description}</p>
                </a>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Instance đang triển khai" bodyClassName="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 text-left text-xs text-gray-400 uppercase dark:border-dark-600 dark:text-dark-300">
                <tr><th className="px-4 py-3">Instance</th><th className="px-4 py-3">Tên miền</th><th className="px-4 py-3">Người dùng</th><th className="px-4 py-3">Trạng thái</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-dark-600">
                {instances.map((i) => (
                  <tr key={i.id}>
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-dark-100">{i.name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-dark-200">{i.domain}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-dark-200">{num(i.users)}</td>
                    <td className="px-4 py-3"><Badge tone={i.status === "healthy" ? "success" : i.status === "implementing" ? "warning" : "neutral"}>{i.status === "healthy" ? "Ổn định" : i.status === "implementing" ? "Đang triển khai" : i.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </div>

        <div className="space-y-4">
          <AiRecap
            title="X.AI gợi ý mở rộng"
            points={[
              "BI Dashboard đang được gợi ý — kết nối để trực quan hóa doanh thu theo sản phẩm.",
              "Webhook Gateway có tỷ lệ lỗi cao (3,5%), nên kiểm tra cấu hình endpoint.",
              "5 ứng dụng đang hoạt động ổn định với hơn 500 lượt dùng/tháng.",
            ]}
            footnote="X.AI chỉ gợi ý, việc bật/tắt tích hợp cần quản trị viên xác nhận."
          />

          <SectionCard title="Tình trạng connector">
            <div className="space-y-2">
              {connectors.map((c) => (
                <div key={c.id} className="rounded-lg border border-gray-200 p-2.5 dark:border-dark-600">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-800 dark:text-dark-100">{c.name}</p>
                    <Badge tone={connTone[c.status] ?? "neutral"}>{c.status === "healthy" ? "Ổn định" : c.status === "warning" ? "Cảnh báo" : c.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    Trễ {c.latencyMs}ms · Lỗi {((c.errorRate ?? 0) * 100).toFixed(2)}% · Đồng bộ {dateTimeVN(c.lastSyncAt)}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>

          {recommended.length > 0 ? (
            <SectionCard title="Đề xuất cho bạn">
              <div className="space-y-2">
                {recommended.map((a) => (
                  <Card key={a.id} className="flex items-center gap-3 border border-dashed border-primary-300 p-3 dark:border-primary-900">
                    <span className="text-xl">{appEmoji[a.id] ?? "✨"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800 dark:text-dark-100">{a.name}</p>
                      <p className="line-clamp-1 text-xs text-gray-400">{a.description}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
