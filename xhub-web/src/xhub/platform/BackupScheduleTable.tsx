"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/xhub/ui/Badge";
import { FormDrawer, FormSection, SelectField, TextField, SwitchField } from "@/xhub/ui/form";
import type { BackupScheduleRow } from "./platform-data";

// Platform Console — per-tenant backup SCHEDULE table + edit drawer + run-now.
// All writes go through the BFF proxy (/api/platform/*) → xhub-api (platform
// plane, gated platform.backup.manage). FE never touches the DB.

export interface TenantLite { id: string; name: string; tenantCode: string | null }

const FREQ_LABEL: Record<string, string> = { DAILY: "Hàng ngày", WEEKLY: "Hàng tuần", MONTHLY: "Hàng tháng" };
const DOW = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function fmt(dt: string | null): string {
  if (!dt) return "—";
  try { return new Date(dt).toLocaleString("vi-VN", { hour12: false }); } catch { return dt; }
}
// hourUtc → Asia/Bangkok (UTC+7) HH:00 for display.
function localTime(hourUtc: number): string {
  const h = (hourUtc + 7) % 24;
  return `${String(h).padStart(2, "0")}:00`;
}

export function BackupScheduleTable({
  schedules, tenants,
}: { schedules: BackupScheduleRow[]; tenants: TenantLite[] }) {
  const router = useRouter();
  const nameOf = (tid: string) => tenants.find((t) => t.id === tid)?.name ?? tid;
  const codeOf = (tid: string) => tenants.find((t) => t.id === tid)?.tenantCode ?? "—";

  const [editing, setEditing] = useState<BackupScheduleRow | null>(null);
  const [busyTenant, setBusyTenant] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function runNow(tid: string) {
    setBusyTenant(tid);
    setMsg(null);
    try {
      const res = await fetch(`/api/platform/backup-schedules/${encodeURIComponent(tid)}/run-now`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(body?.detail?.message ?? body?.error ?? `Lỗi ${res.status}`); return; }
      setMsg(`Đã tạo backup cho ${nameOf(tid)} (đã dọn ${body?.pruned ?? 0} bản cũ).`);
      router.refresh();
    } catch { setMsg("Không kết nối được backend"); }
    finally { setBusyTenant(null); }
  }

  return (
    <div className="space-y-3">
      {msg && <div className="rounded-lg bg-primary-50 px-4 py-2 text-sm text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">{msg}</div>}

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-dark-600">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-dark-800 dark:text-dark-300">
            <tr>
              <th className="px-4 py-3">Tenant</th>
              <th className="px-4 py-3">Lịch</th>
              <th className="px-4 py-3">Giữ (ngày/tuần/tháng)</th>
              <th className="px-4 py-3">Chạy gần nhất</th>
              <th className="px-4 py-3">Lần tới</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-dark-600">
            {schedules.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50/60 dark:hover:bg-dark-700/40">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-800 dark:text-dark-50">{nameOf(s.tenantId)}</div>
                  <div className="text-xs text-gray-400">{codeOf(s.tenantId)} · {s.tenantId}</div>
                </td>
                <td className="px-4 py-3">
                  {s.enabled ? (
                    <div>
                      <Badge tone="success">{FREQ_LABEL[s.frequency] ?? s.frequency}</Badge>
                      <div className="mt-1 text-xs text-gray-500 dark:text-dark-300">
                        {localTime(s.hourUtc)} (giờ VN)
                        {s.frequency === "WEEKLY" && s.dayOfWeek != null ? ` · ${DOW[s.dayOfWeek]}` : ""}
                        {s.frequency === "MONTHLY" && s.dayOfMonth != null ? ` · ngày ${s.dayOfMonth}` : ""}
                      </div>
                    </div>
                  ) : <Badge tone="neutral">Tắt</Badge>}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-dark-200">
                  {s.retentionDays}d / {s.retentionWeeks}w / {s.retentionMonths}m
                </td>
                <td className="px-4 py-3">
                  {s.lastStatus === "FAILED" || s.alert ? (
                    <div>
                      <Badge tone="error">Lỗi</Badge>
                      <div className="mt-1 max-w-[180px] truncate text-xs text-error" title={s.lastError ?? ""}>{s.lastError ?? ""}</div>
                    </div>
                  ) : s.lastStatus === "completed" ? (
                    <Badge tone="success">Thành công</Badge>
                  ) : <span className="text-gray-400">Chưa chạy</span>}
                  <div className="mt-1 text-xs text-gray-400">{fmt(s.lastRunAt)}</div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 dark:text-dark-300">{fmt(s.nextRunAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => runNow(s.tenantId)}
                      disabled={busyTenant === s.tenantId}
                      className="rounded-lg border border-primary-300 px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-50 disabled:opacity-50 dark:border-primary-500/40 dark:text-primary-300"
                    >
                      {busyTenant === s.tenantId ? "Đang chạy…" : "Chạy ngay"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(s)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-dark-500 dark:text-dark-100"
                    >
                      Sửa lịch
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {schedules.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Chưa có lịch backup. Chạy seed:backup-schedules.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditScheduleDrawer
          schedule={editing}
          tenantName={nameOf(editing.tenantId)}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function EditScheduleDrawer({
  schedule, tenantName, onClose, onSaved,
}: { schedule: BackupScheduleRow; tenantName: string; onClose: () => void; onSaved: () => void }) {
  const [enabled, setEnabled] = useState(schedule.enabled);
  const [frequency, setFrequency] = useState(schedule.frequency);
  const [hourUtc, setHourUtc] = useState(schedule.hourUtc);
  const [dayOfWeek, setDayOfWeek] = useState(schedule.dayOfWeek ?? 0);
  const [dayOfMonth, setDayOfMonth] = useState(schedule.dayOfMonth ?? 1);
  const [retentionDays, setRetentionDays] = useState(schedule.retentionDays);
  const [retentionWeeks, setRetentionWeeks] = useState(schedule.retentionWeeks);
  const [retentionMonths, setRetentionMonths] = useState(schedule.retentionMonths);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/platform/backup-schedules/${encodeURIComponent(schedule.tenantId)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled, frequency, hourUtc: Number(hourUtc),
          dayOfWeek: frequency === "WEEKLY" ? Number(dayOfWeek) : null,
          dayOfMonth: frequency === "MONTHLY" ? Number(dayOfMonth) : null,
          retentionDays: Number(retentionDays),
          retentionWeeks: Number(retentionWeeks),
          retentionMonths: Number(retentionMonths),
        }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); setError(b?.detail?.message ?? b?.error ?? `Lỗi ${res.status}`); return; }
      onSaved();
    } catch { setError("Không kết nối được backend"); }
    finally { setBusy(false); }
  }

  return (
    <FormDrawer
      open
      onClose={onClose}
      onSubmit={submit}
      title={`Lịch backup · ${tenantName}`}
      description="Tần suất, thời điểm và chính sách giữ (retention) của tenant này."
      submitting={busy}
      submitLabel="Lưu lịch"
      footnote={error ? <div className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{error}</div> : undefined}
    >
      <FormSection title="Kích hoạt">
        <SwitchField label="Bật lịch backup định kỳ" description="Tắt sẽ ngừng backup tự động (vẫn có thể Chạy ngay)." checked={enabled} onChange={setEnabled} />
      </FormSection>

      <FormSection title="Tần suất & thời điểm">
        <SelectField label="Tần suất" value={frequency} onChange={(e) => setFrequency(e.target.value)}
          options={[{ value: "DAILY", label: "Hàng ngày" }, { value: "WEEKLY", label: "Hàng tuần" }, { value: "MONTHLY", label: "Hàng tháng" }]} />
        <TextField label="Giờ chạy (UTC, 0–23)" type="number" min={0} max={23} value={hourUtc} onChange={(e) => setHourUtc(Number(e.target.value))} hint="19 UTC = 02:00 giờ VN" />
        {frequency === "WEEKLY" && (
          <SelectField label="Thứ trong tuần" value={String(dayOfWeek)} onChange={(e) => setDayOfWeek(Number(e.target.value))}
            options={DOW.map((d, i) => ({ value: String(i), label: d === "CN" ? "Chủ nhật" : `Thứ ${i + 1}` }))} />
        )}
        {frequency === "MONTHLY" && (
          <TextField label="Ngày trong tháng (1–28)" type="number" min={1} max={28} value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))} />
        )}
      </FormSection>

      <FormSection title="Chính sách giữ (retention)">
        <TextField label="Giữ số ngày (daily)" type="number" min={1} value={retentionDays} onChange={(e) => setRetentionDays(Number(e.target.value))} />
        <TextField label="Giữ số tuần (weekly)" type="number" min={0} value={retentionWeeks} onChange={(e) => setRetentionWeeks(Number(e.target.value))} />
        <TextField label="Giữ số tháng (monthly)" type="number" min={0} value={retentionMonths} onChange={(e) => setRetentionMonths(Number(e.target.value))} />
      </FormSection>
    </FormDrawer>
  );
}
