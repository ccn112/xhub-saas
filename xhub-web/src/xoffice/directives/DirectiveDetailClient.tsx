"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/xhub/ui/Badge";
import { SectionCard } from "@/xhub/ui/Card";
import type { DirectiveDetail } from "@/xoffice/lib/directives-data";
import {
  COMMIT_ACTION_LABEL,
  COMMIT_STATE_LABEL,
  COMMIT_STATE_TONE,
  DIR_ACTION_LABEL,
  DIR_STATE_LABEL,
  DIR_STATE_TONE,
  PRIORITY_LABEL,
  fmtDate,
  fmtTime,
} from "./directive-states";

// Live directive detail (PH-02b — NX-025): header + state + SLA/overdue +
// assignees table (per-commitment state + state-gated actions) + timeline +
// evidence upload + issuer action bar. All mutations go through the BFF proxy
// (/api/directives/*) then refresh the server component.
export function DirectiveDetailClient({ detail }: { detail: DirectiveDetail }) {
  const router = useRouter();
  const { directive, assignments, events, evidence } = detail;
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function call(path: string, body?: unknown) {
    setBusy(path);
    setErr(null);
    try {
      const res = await fetch(`/api/directives/${directive.id}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j?.detail?.message ?? j?.error ?? `Lỗi ${res.status}`);
      } else {
        router.refresh();
      }
    } catch {
      setErr("Không kết nối được backend");
    } finally {
      setBusy(null);
    }
  }

  const legal = directive.legalActions ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">{directive.title}</h1>
            <Badge tone={DIR_STATE_TONE[directive.state] ?? "neutral"}>{DIR_STATE_LABEL[directive.state] ?? directive.state}</Badge>
            {directive.overdue && <Badge tone="error">Quá hạn (SLA)</Badge>}
          </div>
          <p className="font-mono text-xs text-gray-400">{directive.code}</p>
        </div>
        <button onClick={() => router.push("/office/directives")} className="text-sm text-primary-600 hover:underline dark:text-primary-400">
          ← Chỉ đạo &amp; cam kết
        </button>
      </div>

      {err && <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{err}</div>}

      {/* Meta + issuer action bar */}
      <SectionCard title="Thông tin & thao tác (người ban hành)" accent="primary">
        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Meta label="Người ban hành" value={directive.issuerId} />
          <Meta label="Đối tượng" value={`${directive.audienceType}${directive.audienceId ? `:${directive.audienceId}` : ""}`} />
          <Meta label="Ưu tiên" value={PRIORITY_LABEL[directive.priority] ?? directive.priority} />
          <Meta label="Hạn (SLA)" value={fmtDate(directive.dueAt)} />
        </dl>
        {directive.body && <p className="mt-3 text-sm text-gray-600 dark:text-dark-200">{directive.body}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {legal.filter((a) => a !== "progress").map((a) => {
            const meta = DIR_ACTION_LABEL[a];
            if (!meta) return null;
            return (
              <button key={a} disabled={!!busy} onClick={() => call(`/${a}`)} className={btnCls(meta.tone) + " disabled:opacity-50"}>
                {busy === `/${a}` ? "…" : meta.label}
              </button>
            );
          })}
          {legal.filter((a) => a !== "progress").length === 0 && (
            <span className="text-sm text-gray-400">Không có thao tác ban hành ở trạng thái này.</span>
          )}
        </div>
      </SectionCard>

      {/* Assignees / commitments */}
      <SectionCard title={`Cam kết được giao (${assignments.length})`} accent="info">
        {assignments.length === 0 ? (
          <p className="text-sm text-gray-400">Chưa ban hành — chưa có người được giao.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-150 text-left text-xs uppercase text-gray-400 dark:border-dark-600">
                  <th className="py-2 pr-3">Người thực hiện</th>
                  <th className="py-2 pr-3">Trạng thái</th>
                  <th className="py-2 pr-3">Tiến độ</th>
                  <th className="py-2 pr-3">Hạn</th>
                  <th className="py-2 pr-3">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} className="border-b border-gray-100 dark:border-dark-700">
                    <td className="py-2 pr-3 font-mono text-xs text-gray-600 dark:text-dark-200">{a.assigneeId}</td>
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-1.5">
                        <Badge tone={COMMIT_STATE_TONE[a.state] ?? "neutral"}>{COMMIT_STATE_LABEL[a.state] ?? a.state}</Badge>
                        {a.overdue && <Badge tone="error">Quá hạn</Badge>}
                      </span>
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-gray-700 dark:text-dark-100">{a.progress != null ? `${a.progress}%` : "—"}</td>
                    <td className="py-2 pr-3 text-xs text-gray-500">{fmtDate(a.dueAt)}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-1.5">
                        {(a.legalActions ?? []).map((act) => {
                          const meta = COMMIT_ACTION_LABEL[act];
                          if (!meta) return null;
                          return (
                            <button
                              key={act}
                              disabled={!!busy}
                              onClick={() => call(`/assignments/${a.id}/${act}`)}
                              className={btnCls(meta.tone) + " h-8 px-2.5 text-xs disabled:opacity-50"}
                            >
                              {busy === `/assignments/${a.id}/${act}` ? "…" : meta.label}
                            </button>
                          );
                        })}
                        {(a.legalActions ?? []).length === 0 && <span className="text-xs text-gray-400">—</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Timeline */}
        <SectionCard title="Dòng thời gian (audit)" accent="info">
          <ol className="space-y-3">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-primary-500" />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-dark-100">{e.type}</p>
                  <p className="text-xs text-gray-400">{fmtTime(e.createdAt)} · {e.actorId}</p>
                  {typeof (e.data as { to?: string })?.to === "string" && (
                    <p className="text-xs text-gray-500">→ {(e.data as { to: string }).to}</p>
                  )}
                </div>
              </li>
            ))}
            {events.length === 0 && <li className="text-sm text-gray-400">Chưa có sự kiện.</li>}
          </ol>
        </SectionCard>

        {/* Evidence */}
        <SectionCard title="Bằng chứng (RecordDocument)" accent="warning">
          <ul className="space-y-2">
            {evidence.map((d) => (
              <li key={d.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 dark:text-dark-100">📎 {d.title}</span>
                <span className="text-xs text-gray-400">{d.kind}</span>
              </li>
            ))}
            {evidence.length === 0 && <li className="text-sm text-gray-400">Chưa có bằng chứng.</li>}
          </ul>
          <EvidenceForm busy={!!busy} onSubmit={(b) => call(`/evidence`, b)} />
        </SectionCard>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-gray-400">{label}</dt>
      <dd className="text-sm font-medium text-gray-800 dark:text-dark-100">{value}</dd>
    </div>
  );
}

function EvidenceForm({ busy, onSubmit }: { busy: boolean; onSubmit: (b: Record<string, string>) => void }) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tên bằng chứng" className="h-9 w-48 rounded-lg border border-gray-300 px-3 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50" />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú / nội dung" className="h-9 flex-1 rounded-lg border border-gray-300 px-3 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50" />
      <button disabled={busy || !title.trim()} onClick={() => onSubmit({ title, note, content: note || title })} className={btnCls("warning") + " disabled:opacity-50"}>
        Đính bằng chứng
      </button>
    </div>
  );
}

function btnCls(tone: string): string {
  const map: Record<string, string> = {
    primary: "bg-primary-600 text-white hover:bg-primary-700",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
    error: "bg-red-600 text-white hover:bg-red-700",
    warning: "bg-amber-500 text-white hover:bg-amber-600",
    info: "bg-sky-600 text-white hover:bg-sky-700",
    neutral: "border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-dark-500 dark:text-dark-100 dark:hover:bg-dark-600",
  };
  return "inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-medium transition " + (map[tone] ?? map.neutral);
}
