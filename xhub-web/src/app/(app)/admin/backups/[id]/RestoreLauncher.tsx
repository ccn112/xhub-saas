"use client";

// Launches a LIVE restore against POST /api/admin/backup/:id/restore (forwards to
// xhub-api). Deliberately gated: only dry-run / sandbox modes are offered here —
// there is NO one-click full-replace. Full apply still requires the restore
// state-machine + approval flow (see /admin/restores).
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormDrawer, FormSection, SelectField, TextField } from "@/xhub/ui/form";
import { Badge } from "@/xhub/ui/Badge";
import { useToast } from "@/components/ui/Toast";

export function RestoreLauncher({ backupId, eligible }: { backupId: string; eligible: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"dry-run" | "sandbox">("dry-run");
  const [targetTenantId, setTargetTenantId] = useState("");
  const [result, setResult] = useState<{ status?: string; mode?: string; target?: string } | null>(null);

  async function run() {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/backup/${encodeURIComponent(backupId)}/restore`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, targetTenantId: targetTenantId || undefined }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const job = data?.restoreJob ?? data;
      setResult({ status: job?.status, mode: job?.mode, target: job?.targetTenantId });
      toast.success(mode === "dry-run" ? "Đã chạy kiểm thử khôi phục (dry-run)." : "Đã dựng sandbox khôi phục.");
      router.refresh();
    } catch {
      toast.error("Không chạy được phiên khôi phục. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!eligible}
        title={eligible ? "" : "Gói chưa đủ điều kiện (cần completed + checksum PASS)"}
        className={`mt-3 inline-block rounded-lg px-3.5 py-2 text-sm font-medium text-white ${eligible ? "bg-primary-600 hover:bg-primary-700" : "cursor-not-allowed bg-primary-600/50"}`}
      >
        Tạo phiên khôi phục (sandbox)
      </button>
      <Link href="/admin/restores" className="ml-2 mt-3 inline-block rounded-lg border border-primary-300 px-3.5 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 dark:border-primary-900">
        Mở quy trình restore →
      </Link>

      {result ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-dark-600">
          <Badge tone={result.status === "completed" ? "success" : "info"}>{result.status ?? "—"}</Badge>
          <span className="text-gray-600 dark:text-dark-200">chế độ {result.mode} · đích {result.target}</span>
        </div>
      ) : null}

      <FormDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Tạo phiên khôi phục"
        description="Chỉ chạy kiểm thử (dry-run) hoặc dựng sandbox — không ghi đè dữ liệu tenant hiện tại."
        submitLabel="Chạy khôi phục"
        submitting={submitting}
        onSubmit={run}
        footnote={<p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-darker dark:text-warning-lighter">Áp dụng thật (full-replace) không nằm ở đây: cần đi qua máy trạng thái restore + cổng phê duyệt (không tự duyệt).</p>}
      >
        <FormSection title="Gói nguồn">
          <TextField label="Backup nguồn" value={backupId} readOnly hint="Gói được chọn để khôi phục." />
        </FormSection>
        <FormSection title="Chế độ khôi phục">
          <SelectField
            label="Chế độ"
            value={mode}
            onChange={(e) => setMode(e.target.value as "dry-run" | "sandbox")}
            options={[
              { value: "dry-run", label: "Dry-run — kiểm thử, không ghi" },
              { value: "sandbox", label: "Sandbox — dựng bản sao cách ly" },
            ]}
          />
          <TextField
            label="Tenant đích (tuỳ chọn)"
            value={targetTenantId}
            onChange={(e) => setTargetTenantId(e.target.value)}
            placeholder="mặc định: sandbox của tenant hiện tại"
            hint="Bỏ trống để dùng sandbox mặc định. Không ghi vào tenant production."
          />
        </FormSection>
      </FormDrawer>
    </>
  );
}
