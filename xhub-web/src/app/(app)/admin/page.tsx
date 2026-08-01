import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { AiRecap } from "@/xhub/ui/AiRecap";
import { dateTimeVN } from "@/xhub/lib/format";
import { userName } from "@/xhub/lib/repo";
import {
  getRoles, getConnectors, getAuditLogs, connectorTone,
  DELEGATIONS,
} from "@/features/tenant-admin/data";
import { getOrgStructure, getPeople } from "@/features/tenant-admin/identity.server";
import { getApplications, getTenantApplications, getProvisioningConflicts } from "@/features/tenant-admin/controlplane.server";

export const metadata = { title: "Quản trị · XHub" };
export const dynamic = "force-dynamic";

const QUICK_ACTIONS: { href: string; label: string; icon: string; desc: string }[] = [
  { href: "/admin/users", label: "Người dùng", icon: "👤", desc: "Mời · khoá · phân vai trò" },
  { href: "/admin/organization", label: "Sơ đồ tổ chức", icon: "🏢", desc: "Đơn vị · phiên bản · hiệu lực" },
  { href: "/admin/roles", label: "Vai trò & quyền", icon: "🔑", desc: "Ma trận quyền hiệu lực" },
  { href: "/admin/assignment-resolver", label: "Kiểm tra phân công", icon: "🧭", desc: "Ai sẽ duyệt trong ngữ cảnh" },
  { href: "/admin/backups", label: "Backup", icon: "💾", desc: "Chạy · xác minh · checksum" },
  { href: "/admin/audit", label: "Nhật ký kiểm toán", icon: "📜", desc: "Chuỗi correlation · export" },
];

export default async function AdminOverviewPage() {
  // Live where an endpoint exists; demo fallback otherwise (roles/audit/delegations
  // have no live endpoint yet — kept on seed/demo data).
  const [{ users }, org, appsRes, tenantAppsRes, conflictsRes] = await Promise.all([
    getPeople(), getOrgStructure(), getApplications(), getTenantApplications(), getProvisioningConflicts(),
  ]);
  const roles = getRoles();
  const audit = getAuditLogs().slice().sort((a, b) => (a.at < b.at ? 1 : -1));
  const activeDelegations = DELEGATIONS.filter((d) => d.status === "active").length;

  // Connectors card: derive from Control Plane applications + tenant enablement.
  // Falls back to the seed connectors when the control plane is down.
  const tenantByCode = new Map(tenantAppsRes.apps.map((t) => [t.applicationCode, t]));
  const cpLive = appsRes.source === "live";
  const connectors = cpLive
    ? appsRes.apps.map((a) => {
        const enabled = tenantByCode.get(a.code)?.status === "enabled";
        const mock = a.provisioningMode === "MOCK" || a.provisioningMode === "MANUAL";
        return { id: a.code, name: a.name, status: !enabled ? "down" : mock ? "degraded" : "healthy", latencyMs: undefined as number | undefined, errorRate: undefined as number | undefined, lastSyncAt: undefined as string | undefined };
      })
    : getConnectors();
  const healthy = connectors.filter((c) => c.status === "healthy").length;

  // Config warnings (derived; shared-layer integrity checks).
  const vacant = org.positions.filter((p) => !p.holder).length;
  const degraded = connectors.filter((c) => c.status !== "healthy");
  const selfDelegation = DELEGATIONS.filter((d) => d.conflict === "SELF_DELEGATION");
  const openConflicts = conflictsRes.conflicts.filter((c) => !c.resolved);
  const warnings: { tone: "warning" | "error"; text: string; href: string }[] = [];
  if (cpLive && openConflicts.length) warnings.push({ tone: "error", text: `${openConflicts.length} xung đột cấp phát tài khoản chưa xử lý`, href: "/admin/settings/tenant" });
  if (degraded.length) warnings.push({ tone: "warning", text: `${degraded.length} kết nối không khỏe mạnh (${degraded.map((c) => c.name).join(", ")})`, href: "/admin/settings/tenant" });
  if (selfDelegation.length) warnings.push({ tone: "error", text: `${selfDelegation.length} uỷ quyền vi phạm guardrail (tự uỷ quyền)`, href: "/admin/delegations" });
  if (vacant) warnings.push({ tone: "warning", text: `${vacant} vị trí đang khuyết người giữ`, href: "/admin/positions" });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Tổng quan quản trị</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">Tenant X-TECH (001) · chế độ STANDALONE · quản trị dùng chung Identity/Org</p>
        </div>
        <Badge tone="info">Tenant 001 · STANDALONE</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Người dùng" value={String(users.length)} icon="👤" tone="primary" />
        <StatCard label="Vai trò" value={String(roles.length)} icon="🔑" tone="info" />
        <StatCard label="Đơn vị" value={String(org.units.length)} icon="🏢" tone="neutral" />
        <StatCard label="Vị trí" value={String(org.positions.length)} icon="💼" tone="neutral" />
        <StatCard label="Uỷ quyền hiệu lực" value={String(activeDelegations)} icon="🤝" tone="warning" />
        <StatCard label="Kết nối" value={`${healthy}/${connectors.length}`} sub="khỏe mạnh" icon="🔌" tone={healthy === connectors.length ? "success" : "warning"} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <SectionCard accent={warnings.some((w) => w.tone === "error") ? "error" : "warning"} title="Cảnh báo cấu hình">
            {warnings.length ? (
              <ul className="space-y-2">
                {warnings.map((w, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 dark:border-dark-600">
                    <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-dark-100">
                      <Badge tone={w.tone}>{w.tone === "error" ? "Nghiêm trọng" : "Chú ý"}</Badge>
                      {w.text}
                    </span>
                    <Link href={w.href} className="shrink-0 text-sm text-primary-600 hover:underline">Xử lý →</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 dark:text-dark-300">Không có cảnh báo cấu hình.</p>
            )}
          </SectionCard>

          <SectionCard accent="neutral" title="Tác vụ nhanh">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {QUICK_ACTIONS.map((a) => (
                <Link key={a.href} href={a.href} className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:border-primary-300 hover:bg-primary-50/50 dark:border-dark-600 dark:hover:bg-primary-950/20">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-600/10 text-lg">{a.icon}</span>
                  <span className="min-w-0">
                    <span className="block font-medium text-gray-800 dark:text-dark-100">{a.label}</span>
                    <span className="block text-xs text-gray-400">{a.desc}</span>
                  </span>
                </Link>
              ))}
            </div>
          </SectionCard>

          <SectionCard accent="neutral" title="Kết nối hệ thống" bodyClassName="p-0"
            action={<Badge tone={cpLive ? "success" : "warning"}>{cpLive ? "Control Plane trực tiếp" : "demo"}</Badge>}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 text-left text-xs uppercase text-gray-400 dark:border-dark-600 dark:text-dark-300">
                  <tr><th className="px-4 py-3">Kết nối</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Độ trễ</th><th className="px-4 py-3">Tỷ lệ lỗi</th><th className="px-4 py-3">Đồng bộ</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-600">
                  {connectors.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-dark-100">{c.name}</td>
                      <td className="px-4 py-3"><Badge tone={connectorTone[c.status] ?? "neutral"}>{c.status}</Badge></td>
                      <td className="px-4 py-3 text-gray-600 dark:text-dark-200">{c.latencyMs != null ? `${c.latencyMs} ms` : "—"}</td>
                      <td className="px-4 py-3"><span className={(c.errorRate ?? 0) > 0.01 ? "text-error" : "text-gray-600 dark:text-dark-200"}>{c.errorRate != null ? `${(c.errorRate * 100).toFixed(2)}%` : "—"}</span></td>
                      <td className="px-4 py-3 text-gray-600 dark:text-dark-200">{dateTimeVN(c.lastSyncAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-4">
          <AiRecap
            title="X.AI · Bản tin quản trị"
            points={[
              `${users.length} người dùng, ${DELEGATIONS.filter((d) => d.status === "active").length} uỷ quyền đang hiệu lực.`,
              selfDelegation.length ? `Phát hiện ${selfDelegation.length} uỷ quyền tự cấp — nên thu hồi.` : "Không phát hiện uỷ quyền bất thường.",
              degraded.length ? `Kết nối ${degraded.map((c) => c.name).join(", ")} cần theo dõi.` : "Tất cả kết nối khỏe mạnh.",
              "Gợi ý chỉ mang tính tham khảo — mọi thay đổi cần xác nhận thủ công.",
            ]}
            footnote="X.AI chỉ đề xuất, không tự áp dụng thay đổi quyền/uỷ quyền/khôi phục."
          />

          <SectionCard accent="neutral" title="Thay đổi gần đây">
            <ol className="space-y-3">
              {audit.slice(0, 6).map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary-500" />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-700 dark:text-dark-100"><span className="font-medium">{userName(e.actorId)}</span> · <span className="text-gray-500 dark:text-dark-300">{e.action}</span></p>
                    <p className="text-xs text-gray-400">{e.entityType}/{e.entityId} · {dateTimeVN(e.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link href="/admin/audit" className="mt-3 inline-block text-sm text-primary-600 hover:underline">Xem toàn bộ nhật ký →</Link>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
