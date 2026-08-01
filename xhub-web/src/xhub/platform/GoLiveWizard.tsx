"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/xhub/ui/Badge";
import type { GoLiveView, GoLiveProgressStep } from "@/xhub/platform/platform-data";

/**
 * Go-Live wizard — sequential checklist (tick each step, assign người phụ trách,
 * open guidance + template link), progress bar, and the one-way
 * "Chuyển sang chính thức (xoá dữ liệu demo)" activation (2-step confirm, enabled
 * only when all required steps are DONE). All writes proxy the platform BFF.
 */
export function GoLiveWizard({ idOrCode, view }: { idOrCode: string; view: GoLiveView }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [clearAll, setClearAll] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const template = view.template;
  const progress = view.progress;
  const isLive = view.tenant.mode === "LIVE" || progress?.status === "LIVE";

  const stepStatus = (key: string): GoLiveProgressStep | undefined =>
    (progress?.steps ?? []).find((s) => s.key === key);

  const templateSteps = (template?.steps ?? []).slice().sort((a, b) => a.order - b.order);
  const requiredKeys = templateSteps.filter((s) => s.required).map((s) => s.key);
  const doneCount = (progress?.steps ?? []).filter((s) => s.status === "DONE").length;
  const totalSteps = templateSteps.length || (progress?.steps?.length ?? 0);
  const allRequiredDone =
    progress != null && requiredKeys.every((k) => stepStatus(k)?.status === "DONE");
  const pct = totalSteps ? Math.round((doneCount / totalSteps) * 100) : 0;

  async function call(path: string, method: string, body?: unknown) {
    const res = await fetch(`/api/platform/tenants/${encodeURIComponent(idOrCode)}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, json };
  }

  async function start() {
    setBusy("start");
    setMsg(null);
    const r = await call("/go-live", "POST");
    setBusy(null);
    if (!r.ok) return setMsg({ tone: "err", text: r.json?.detail?.message ?? r.json?.error ?? `Lỗi ${r.status}` });
    router.refresh();
  }

  async function setStep(key: string, patch: { status?: string; assigneeId?: string }) {
    setBusy(key);
    setMsg(null);
    const r = await call(`/go-live/steps/${encodeURIComponent(key)}`, "PATCH", patch);
    setBusy(null);
    if (!r.ok) return setMsg({ tone: "err", text: r.json?.detail?.message ?? r.json?.error ?? `Lỗi ${r.status}` });
    router.refresh();
  }

  async function activate() {
    setBusy("activate");
    setMsg(null);
    const r = await call("/go-live/activate", "POST", { clearAll });
    setBusy(null);
    if (!r.ok) return setMsg({ tone: "err", text: r.json?.detail?.message ?? r.json?.error ?? `Lỗi ${r.status}` });
    setMsg({ tone: "ok", text: `Đã chuyển sang CHÍNH THỨC (LIVE). Đã xoá ${r.json?.totalCleared ?? 0} bản ghi demo.` });
    setConfirming(false);
    router.refresh();
  }

  if (!template) {
    return <p className="text-sm text-error">Chưa có template Go-Live (chạy seed:golive-template).</p>;
  }

  if (!progress) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-dark-200">
          Chưa khởi tạo tiến trình Go-Live cho tenant này. Template: <b>{template.code}</b> v{template.version} ({templateSteps.length} bước).
        </p>
        <button
          onClick={start}
          disabled={busy === "start"}
          className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {busy === "start" ? "Đang khởi tạo…" : "Bắt đầu checklist Go-Live"}
        </button>
        {msg ? <p className={msg.tone === "ok" ? "text-xs text-success" : "text-xs text-error"}>{msg.text}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* progress bar */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-gray-500 dark:text-dark-300">
          <span>Tiến độ: {doneCount}/{totalSteps} bước</span>
          <Badge tone={progress.status === "LIVE" ? "success" : progress.status === "READY" ? "info" : "neutral"}>
            {progress.status}
          </Badge>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-dark-600">
          <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* sequential checklist */}
      <ol className="space-y-2">
        {templateSteps.map((s) => {
          const st = stepStatus(s.key);
          const done = st?.status === "DONE";
          return (
            <li key={s.key} className="rounded-lg border border-gray-200 p-3 dark:border-dark-600">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs tabular-nums text-gray-400">{s.order}.</span>
                    <span className="text-sm font-medium text-gray-800 dark:text-dark-50">{s.title}</span>
                    {s.required ? <Badge tone="warning">bắt buộc</Badge> : <Badge tone="neutral">tuỳ chọn</Badge>}
                    {done ? <Badge tone="success">DONE</Badge> : null}
                  </div>
                  {s.guidance ? <p className="mt-1 text-xs text-gray-500 dark:text-dark-300">{s.guidance}</p> : null}
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-400">
                    {s.suggestedRole ? <span>Gợi ý: {s.suggestedRole}</span> : null}
                    {s.templateRef ? <span>Template: {s.templateRef}</span> : null}
                    {st?.assigneeId ? <span>Phụ trách: {st.assigneeId}</span> : null}
                  </div>
                </div>
                {!isLive ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="userId phụ trách"
                      defaultValue={st?.assigneeId ?? ""}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (st?.assigneeId ?? "")) setStep(s.key, { assigneeId: v });
                      }}
                      className="w-32 rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-dark-500 dark:bg-dark-700"
                    />
                    <button
                      onClick={() => setStep(s.key, { status: done ? "TODO" : "DONE" })}
                      disabled={busy === s.key}
                      className={
                        done
                          ? "rounded-lg border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:border-dark-500 dark:text-dark-200"
                          : "rounded-lg bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                      }
                    >
                      {busy === s.key ? "…" : done ? "Bỏ đánh dấu" : "Đánh dấu xong"}
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {msg ? <p className={msg.tone === "ok" ? "text-sm text-success" : "text-sm text-error"}>{msg.text}</p> : null}

      {/* activation */}
      {!isLive ? (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">Chuyển sang chính thức (xoá dữ liệu demo)</h3>
          <p className="mt-1 text-xs text-red-700 dark:text-red-300">
            Thao tác một chiều: xoá dữ liệu nghiệp vụ demo, đặt tenant sang LIVE (snapshot trước + sau). Không thể quay lại DEMO.
          </p>
          <label className="mt-2 flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
            <input type="checkbox" checked={clearAll} onChange={(e) => setClearAll(e.target.checked)} />
            Xoá sạch (cả cơ cấu tổ chức + định danh) để bắt đầu trắng
          </label>
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              disabled={!allRequiredDone}
              title={allRequiredDone ? "" : "Hoàn thành tất cả bước bắt buộc trước"}
              className="mt-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Chuyển sang chính thức
            </button>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-red-800 dark:text-red-200">Xác nhận xoá dữ liệu demo và kích hoạt LIVE?</span>
              <button
                onClick={activate}
                disabled={busy === "activate"}
                className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
              >
                {busy === "activate" ? "Đang kích hoạt…" : "Xác nhận kích hoạt LIVE"}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={busy === "activate"}
                className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-dark-200 dark:hover:bg-dark-700"
              >
                Huỷ
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-green-300 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/30">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            Tenant đã CHÍNH THỨC (LIVE){progress.activatedAt ? ` từ ${new Date(progress.activatedAt).toLocaleString("vi-VN")}` : ""}.
          </p>
        </div>
      )}
    </div>
  );
}
