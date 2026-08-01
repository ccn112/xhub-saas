import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import { AdminHeader, DefRow } from "@/features/tenant-admin/AdminHeader";
import { collection } from "@/xhub/lib/seed";
import { BACKUP_POLICY, getConnectors, connectorTone } from "@/features/tenant-admin/data";
import { getApplications, getTenantApplications, getProvisioningCommands } from "@/features/tenant-admin/controlplane.server";
import { getPeople } from "@/features/tenant-admin/identity.server";
import { ProvisioningPanel } from "./ProvisioningPanel";

export const metadata = { title: "Cấu hình tenant · Quản trị · XHub" };
export const dynamic = "force-dynamic";

interface Tenant { id: string; name: string; legalName?: string; slug: string; status: string; currency?: string; timezone?: string; locale?: string; features?: string[]; branding?: { productName?: string; workspaceName?: string; primaryColor?: string } }

export default async function TenantSettingsPage() {
  const tenant = collection<Tenant>("tenants")[0];
  const connectors = getConnectors();
  const [appsRes, tenantAppsRes, commandsRes, peopleRes] = await Promise.all([
    getApplications(), getTenantApplications(), getProvisioningCommands(), getPeople(),
  ]);
  const cpLive = appsRes.source === "live";
  const people = peopleRes.users.map((u) => ({ id: u.id, name: u.name }));

  return (
    <div className="space-y-4">
      <AdminHeader title="Cấu hình tenant" subtitle="Thông tin chung, thương hiệu, chế độ triển khai, lưu trữ/backup, bảo mật, tích hợp và feature flags."
        chip={{ label: "TENANT_ADMIN", tone: "info" }} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard accent="neutral" title="Thông tin chung & thương hiệu">
          <dl className="space-y-2 text-sm">
            <DefRow label="Tên tenant" value={tenant?.name ?? "—"} />
            <DefRow label="Pháp nhân" value={tenant?.legalName ?? "—"} />
            <DefRow label="Slug" value={tenant?.slug ?? "—"} />
            <DefRow label="Múi giờ / Locale" value={`${tenant?.timezone ?? "—"} · ${tenant?.locale ?? "—"}`} />
            <DefRow label="Tiền tệ" value={tenant?.currency ?? "—"} />
            <DefRow label="Sản phẩm / Workspace" value={`${tenant?.branding?.productName ?? "—"} · ${tenant?.branding?.workspaceName ?? "—"}`} />
            <DefRow label="Màu thương hiệu" value={<span className="inline-flex items-center gap-2">{tenant?.branding?.primaryColor}<span className="inline-block size-4 rounded" style={{ backgroundColor: tenant?.branding?.primaryColor }} /></span>} />
          </dl>
        </SectionCard>

        <SectionCard accent="info" title="Chế độ triển khai">
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border-2 border-primary-500 bg-primary-50/50 px-3 py-2 dark:border-primary-700 dark:bg-primary-950/30">
              <div><p className="font-medium text-gray-800 dark:text-dark-100">STANDALONE</p><p className="text-xs text-gray-500 dark:text-dark-300">Cách ly bằng tenant_id + RLS, không schema riêng</p></div>
              <Badge tone="success">Đang dùng</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 dark:border-dark-600">
              <div><p className="font-medium text-gray-500 dark:text-dark-300">FEDERATED</p><p className="text-xs text-gray-400">Đồng bộ org/position từ HRIS (projection/overlay)</p></div>
              <Badge tone="neutral">Chưa bật</Badge>
            </div>
          </div>
        </SectionCard>

        <SectionCard accent="neutral" title="Lưu trữ & backup">
          <dl className="space-y-2 text-sm">
            <DefRow label="Chế độ backup" value={BACKUP_POLICY.backupMode} />
            <DefRow label="Lịch hằng ngày" value={BACKUP_POLICY.schedule.daily} />
            <DefRow label="RPO / RTO" value={`${BACKUP_POLICY.targets.logicalBackupRpoHours}h / ${BACKUP_POLICY.targets.tenantRestoreRtoHours}h`} />
            <DefRow label="Giữ (ngày)" value={String(BACKUP_POLICY.retention.dailyCopies)} />
          </dl>
        </SectionCard>

        <SectionCard accent="warning" title="Bảo mật">
          <dl className="space-y-2 text-sm">
            <DefRow label="Danh tính / MFA" value={<Badge tone="success">Do IdP ngoài (Azure AD)</Badge>} />
            <DefRow label="RLS Postgres" value={<Badge tone="warning">Đang triển khai</Badge>} />
            <DefRow label="Mã hoá backup" value={<Badge tone="success">AES-256</Badge>} />
            <DefRow label="Lưu secret trong DB" value={<Badge tone="success">Không</Badge>} />
          </dl>
        </SectionCard>

        {cpLive ? (
          <div className="xl:col-span-2">
            <ProvisioningPanel apps={appsRes.apps} tenantApps={tenantAppsRes.apps} commands={commandsRes.commands} people={people} live={cpLive} />
          </div>
        ) : (
          <SectionCard title="Tích hợp (connectors)" bodyClassName="p-0">
            <ul className="divide-y divide-gray-100 dark:divide-dark-600">
              {connectors.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-4 py-3"><span className="font-medium text-gray-800 dark:text-dark-100">{c.name}</span><Badge tone={connectorTone[c.status] ?? "neutral"}>{c.status}</Badge></li>
              ))}
            </ul>
          </SectionCard>
        )}

        <SectionCard accent="neutral" title="Feature flags">
          <div className="flex flex-wrap gap-1">{(tenant?.features ?? []).map((f) => <Badge key={f} tone="primary">{f}</Badge>)}</div>
        </SectionCard>
      </div>

      <p className="text-xs text-gray-400">Thay đổi cấu hình cần quyền TENANT_ADMIN và có xem trước tác động + audit (correlationId). Nút lưu sẽ mở khi BFF <code>/api/identity/tenant</code> sẵn sàng.</p>
    </div>
  );
}
