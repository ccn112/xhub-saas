"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormDrawer, FormSection, TextField, SelectField } from "@/xhub/ui/form";
import { Badge } from "@/xhub/ui/Badge";

// Platform Console — assisted customer onboarding (T011). A single-step wizard in
// a FormDrawer: name/industry + plan + blueprint → POST /api/platform/onboard via
// the BFF proxy. The API allocates tenantNo >= 11, runs the Launch Factory, and
// provisions the first admin. On success we surface the allocated tenantNo +
// launch result, then refresh the registry table. Gated platform.tenant.manage
// server-side.
export interface OnboardOption { value: string; label: string }

export interface OnboardResult {
  tenant: { id: string; tenantNo: number; tenantCode: string | null; tenantKey: string; name: string; status: string };
  plan: { code: string; name: string; tier: string; billingEnabled: boolean };
  launch: { id: string; status: string };
  admin: { userId: string; activation: { activationUrl: string; expiresAt: string } };
}

export function OnboardCustomerForm({ plans, blueprints }: { plans: OnboardOption[]; blueprints: OnboardOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [planCode, setPlanCode] = useState("");
  const [blueprintCode, setBlueprintCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OnboardResult | null>(null);

  function reset() {
    setName("");
    setIndustry("");
    setPlanCode("");
    setBlueprintCode("");
    setError(null);
    setResult(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/onboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          industry: industry.trim() || undefined,
          planCode,
          blueprintCode: blueprintCode || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.detail?.message ?? body?.message ?? body?.error ?? `Lỗi ${res.status}`);
        return;
      }
      setResult((await res.json()) as OnboardResult);
      router.refresh();
    } catch {
      setError("Không kết nối được backend");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true); }}
        className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
      >
        + Đăng ký khách hàng mới
      </button>

      <FormDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Đăng ký khách hàng mới"
        description="Onboard khách hàng thật — cấp tenantNo ≥ 11, chạy Launch Factory, tạo admin đầu tiên."
        onSubmit={submit}
        submitLabel="Onboard khách hàng"
        submitting={busy}
        submitDisabled={!name.trim() || !planCode || !!result}
        footnote={result ? undefined : <p className="text-xs text-gray-400">Áp gói + blueprint baseline (không dùng seed pack demo).</p>}
      >
        {result ? (
          <FormSection title="Đã onboard thành công" description="Tenant khách hàng đã được cấp số và khởi chạy.">
            <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm dark:border-dark-600 dark:bg-dark-800">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-dark-300">tenantNo được cấp</span>
                <Badge tone="success">T{String(result.tenant.tenantNo).padStart(3, "0")} · #{result.tenant.tenantNo}</Badge>
              </div>
              <div className="flex items-center justify-between"><span className="text-gray-500 dark:text-dark-300">Mã tenant</span><span className="font-medium text-gray-800 dark:text-dark-50">{result.tenant.tenantCode ?? result.tenant.tenantKey}</span></div>
              <div className="flex items-center justify-between"><span className="text-gray-500 dark:text-dark-300">Gói</span><span className="font-medium text-gray-800 dark:text-dark-50">{result.plan.name} ({result.plan.tier})</span></div>
              <div className="flex items-center justify-between"><span className="text-gray-500 dark:text-dark-300">Launch</span><Badge tone={result.launch.status === "COMPLETED" ? "success" : result.launch.status === "FAILED" ? "error" : "info"}>{result.launch.status}</Badge></div>
              <div className="flex items-center justify-between"><span className="text-gray-500 dark:text-dark-300">Admin</span><span className="font-medium text-gray-800 dark:text-dark-50">{result.admin.userId}</span></div>
            </div>
            <p className="text-xs text-gray-400 break-all">Link kích hoạt admin: {result.admin.activation.activationUrl}</p>
            <div className="flex gap-2">
              <a href={`/platform/launches/${result.launch.id}`} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-dark-500">Xem launch</a>
              <button type="button" onClick={reset} className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700">Onboard tiếp</button>
            </div>
          </FormSection>
        ) : (
          <FormSection title="Thông tin khách hàng" description="Chọn gói đăng ký và blueprint khởi tạo.">
            <TextField label="Tên khách hàng" name="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Công ty Minh Phát" />
            <TextField label="Ngành" name="industry" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Tuỳ chọn — VD: bất động sản" />
            <SelectField label="Gói dịch vụ" name="planCode" required value={planCode} onChange={(e) => setPlanCode(e.target.value)} placeholder="— Chọn gói —" options={plans} />
            <SelectField label="Blueprint" name="blueprintCode" value={blueprintCode} onChange={(e) => setBlueprintCode(e.target.value)} placeholder="Mặc định (BP-BASE-ENTERPRISE)" options={blueprints} hint="Bỏ trống để dùng blueprint baseline doanh nghiệp." />
            {error ? <p className="text-sm text-error">{error}</p> : null}
          </FormSection>
        )}
      </FormDrawer>
    </>
  );
}
