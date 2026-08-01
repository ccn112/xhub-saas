import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import { getTenant, classLabel, STATUS_TONES, MODE_TONES, MODE_LABELS } from "@/xhub/platform/platform-data";
import { TenantMetaForm } from "@/xhub/platform/TenantMetaForm";
import { ResetDemoButton } from "@/xhub/platform/ResetDemoButton";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ idOrCode: string }> }) {
  const { idOrCode } = await params;
  return { title: `Tenant ${idOrCode} · Platform Console` };
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-500 dark:text-dark-300">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-800 dark:text-dark-50">{value ?? "—"}</dd>
    </div>
  );
}

export default async function TenantDetailPage({ params }: { params: Promise<{ idOrCode: string }> }) {
  const { idOrCode } = await params;
  const { tenant, source } = await getTenant(idOrCode);
  if (!tenant && source === "api") notFound();

  if (!tenant) {
    return (
      <div className="space-y-3">
        <Link href="/platform/tenants" className="text-sm text-primary-600 hover:underline dark:text-primary-400">← Sổ đăng ký</Link>
        <Card className="p-4">
          <Badge tone="warning">Backend offline</Badge>
          <p className="mt-2 text-sm text-gray-500">Không tải được tenant {idOrCode}.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/platform/tenants" className="text-sm text-primary-600 hover:underline dark:text-primary-400">← Sổ đăng ký</Link>
          <h1 className="font-heading mt-1 text-xl font-semibold text-gray-800 dark:text-dark-50">
            {tenant.tenantCode ?? tenant.id} · {tenant.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONES[tenant.status ?? ""] ?? "neutral"}>{tenant.status ?? "—"}</Badge>
          {tenant.mode ? <Badge tone={MODE_TONES[tenant.mode] ?? "neutral"}>{MODE_LABELS[tenant.mode] ?? tenant.mode}</Badge> : null}
          <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
        </div>
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-100">Metadata (bất biến)</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="tenantNo" value={<span className="tabular-nums">{tenant.tenantNo ?? "—"}</span>} />
          <Field label="tenantCode" value={tenant.tenantCode} />
          <Field label="tenantKey" value={tenant.tenantKey ?? tenant.slug} />
          <Field label="id" value={<code className="text-xs">{tenant.id}</code>} />
          <Field label="Hạng" value={classLabel(tenant.tenantClass)} />
          <Field label="Ngành" value={tenant.industry} />
          <Field label="Gói" value={tenant.planId} />
          <Field label="Blueprint" value={tenant.blueprintId} />
        </dl>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-100">Cập nhật metadata (lifecycle-safe)</h2>
        <p className="mt-1 mb-3 text-xs text-gray-500 dark:text-dark-300">
          Chỉ đổi trạng thái / gói / blueprint. tenantNo, tenantCode, tenantKey, id là bất biến (API từ chối).
        </p>
        <TenantMetaForm
          idOrCode={tenant.tenantCode ?? tenant.id}
          initial={{ status: tenant.status, planId: tenant.planId, blueprintId: tenant.blueprintId }}
        />
      </Card>

      {tenant.mode ? (
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-100">Vòng đời tenant (DEMO ↔ CHÍNH THỨC)</h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-dark-300">
                {tenant.mode === "DEMO"
                  ? "Tenant đang ở chế độ DEMO. Có thể reset về demo gốc, hoặc chạy checklist Go-Live để chuyển sang chính thức (xoá dữ liệu demo)."
                  : "Tenant đã CHÍNH THỨC (LIVE). Không thể reset về demo (một chiều)."}
              </p>
            </div>
            <Link
              href={`/platform/tenants/${tenant.tenantCode ?? tenant.id}/go-live`}
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
            >
              Go-Live checklist →
            </Link>
          </div>
          {tenant.mode === "DEMO" ? (
            <div className="mt-3 border-t border-gray-100 pt-3 dark:border-dark-700">
              <ResetDemoButton idOrCode={tenant.tenantCode ?? tenant.id} />
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
