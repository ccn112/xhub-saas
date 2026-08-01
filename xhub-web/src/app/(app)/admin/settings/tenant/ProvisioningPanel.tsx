"use client";

// LIVE control-plane provisioning admin. All four writes forward through the BFF
// proxies under /api/admin/controlplane/* to xhub-api:
//   • enable/disable app  → POST tenant-applications
//   • bind account        → POST app-account-bindings
//   • retry command       → POST provisioning-commands/:id/retry
//   • reconcile           → POST reconcile
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge, type Tone } from "@/xhub/ui/Badge";
import { FormDrawer, FormSection, SelectField, TextField } from "@/xhub/ui/form";
import { useToast } from "@/components/ui/Toast";
import type { Application, TenantApplication, ProvisioningCommand } from "@/features/tenant-admin/controlplane.server";

interface PersonOption { id: string; name: string }

const CMD_TONE: Record<string, Tone> = { completed: "success", failed: "error", pending: "warning", processing: "info" };

export function ProvisioningPanel({
  apps, tenantApps, commands, people, live,
}: {
  apps: Application[]; tenantApps: TenantApplication[]; commands: ProvisioningCommand[]; people: PersonOption[]; live: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [bindOpen, setBindOpen] = useState(false);

  const statusByCode = new Map(tenantApps.map((t) => [t.applicationCode, t.status]));
  const failed = commands.filter((c) => c.status === "failed");

  async function post(url: string, body?: unknown, okMsg?: string, key?: string) {
    setBusy(key ?? url);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error();
      if (okMsg) toast.success(okMsg);
      router.refresh();
      return true;
    } catch {
      toast.error("Thao tác thất bại. Vui lòng thử lại.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  function toggleApp(code: string, enabled: boolean) {
    return post(
      "/api/admin/controlplane/tenant-applications",
      { applicationCode: code, status: enabled ? "disabled" : "enabled" },
      enabled ? `Đã tắt ứng dụng ${code} cho tenant.` : `Đã bật ứng dụng ${code} cho tenant.`,
      `app:${code}`,
    );
  }

  function retry(id: string) {
    return post(`/api/admin/controlplane/provisioning-commands/${id}/retry`, undefined, "Đã yêu cầu chạy lại lệnh cấp phát.", `retry:${id}`);
  }

  function reconcile() {
    return post("/api/admin/controlplane/reconcile", undefined, "Đã chạy đối soát control plane.", "reconcile");
  }

  return (
    <SectionCard
      title="Cấp phát ứng dụng (control plane)"
      accent={live ? "primary" : "warning"}
      bodyClassName="p-0"
      action={
        <div className="flex items-center gap-2">
          <Badge tone={live ? "success" : "warning"}>{live ? "Control Plane trực tiếp" : "demo"}</Badge>
          <button type="button" onClick={reconcile} disabled={busy === "reconcile"} className="rounded-lg border border-primary-300 px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-50 disabled:opacity-50 dark:border-primary-900">
            {busy === "reconcile" ? "Đang đối soát…" : "Đối soát"}
          </button>
          <button type="button" onClick={() => setBindOpen(true)} className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700">
            + Gắn tài khoản
          </button>
        </div>
      }
    >
      <ul className="divide-y divide-gray-100 dark:divide-dark-600">
        {apps.map((a) => {
          const enabled = statusByCode.get(a.code) === "enabled";
          return (
            <li key={a.code} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-800 dark:text-dark-100">{a.name}</p>
                <p className="text-xs text-gray-400">{a.code} · {a.provisioningMode}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={enabled ? "success" : "neutral"}>{enabled ? "Đã bật" : "Chưa bật"}</Badge>
                <button type="button" onClick={() => toggleApp(a.code, enabled)} disabled={busy === `app:${a.code}`}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${enabled ? "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-dark-600 dark:text-dark-200" : "border-primary-300 text-primary-600 hover:bg-primary-50 dark:border-primary-900"}`}>
                  {busy === `app:${a.code}` ? "…" : enabled ? "Tắt" : "Bật"}
                </button>
              </div>
            </li>
          );
        })}
        {apps.length === 0 ? <li className="px-4 py-6 text-sm text-gray-500 dark:text-dark-300">Chưa có ứng dụng nào trong catalog.</li> : null}
      </ul>

      {failed.length ? (
        <div className="border-t border-gray-200 px-4 py-3 dark:border-dark-600">
          <p className="mb-2 text-xs font-medium uppercase text-gray-400">Lệnh cấp phát lỗi ({failed.length})</p>
          <ul className="space-y-2">
            {failed.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-dark-600">
                <span className="min-w-0 truncate text-gray-700 dark:text-dark-100">
                  <Badge tone={CMD_TONE[c.status] ?? "neutral"}>{c.status}</Badge> {c.applicationCode} · {c.action} · {c.attempts} lần
                </span>
                <button type="button" onClick={() => retry(c.id)} disabled={busy === `retry:${c.id}`} className="shrink-0 rounded-lg border border-primary-300 px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-50 disabled:opacity-50 dark:border-primary-900">
                  {busy === `retry:${c.id}` ? "…" : "Chạy lại"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <BindDrawer open={bindOpen} onClose={() => setBindOpen(false)} apps={apps} people={people} onSubmit={post} />
    </SectionCard>
  );
}

function BindDrawer({
  open, onClose, apps, people, onSubmit,
}: {
  open: boolean; onClose: () => void; apps: Application[]; people: PersonOption[];
  onSubmit: (url: string, body: unknown, okMsg: string, key: string) => Promise<boolean>;
}) {
  const [personId, setPersonId] = useState(people[0]?.id ?? "");
  const [applicationCode, setApplicationCode] = useState(apps[0]?.code ?? "");
  const [externalUsername, setExternalUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    const ok = await onSubmit(
      "/api/admin/controlplane/app-account-bindings",
      { personId, applicationCode, payload: externalUsername ? { externalUsername } : {} },
      "Đã gửi lệnh gắn tài khoản ứng dụng.",
      "bind",
    );
    setSubmitting(false);
    if (ok) onClose();
  }

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title="Gắn tài khoản ứng dụng"
      description="Tạo binding giữa nhân sự XHub và tài khoản trên ứng dụng đích (idempotent qua control plane)."
      submitLabel="Gắn tài khoản"
      submitting={submitting}
      submitDisabled={!personId || !applicationCode}
      onSubmit={submit}
    >
      <FormSection title="Đối tượng">
        <SelectField label="Nhân sự" value={personId} onChange={(e) => setPersonId(e.target.value)}
          options={people.map((p) => ({ value: p.id, label: p.name }))} placeholder={people.length ? undefined : "Không có nhân sự"} />
        <SelectField label="Ứng dụng" value={applicationCode} onChange={(e) => setApplicationCode(e.target.value)}
          options={apps.map((a) => ({ value: a.code, label: `${a.name} (${a.code})` }))} />
        <TextField label="Tên đăng nhập trên ứng dụng (tuỳ chọn)" value={externalUsername} onChange={(e) => setExternalUsername(e.target.value)} placeholder="vd: nam.nguyen" />
      </FormSection>
    </FormDrawer>
  );
}
