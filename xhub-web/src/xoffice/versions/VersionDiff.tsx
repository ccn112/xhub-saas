"use client";

// WF-08 — Version diff & review.
// Detailed structural diff between two immutable versions: nodes added / removed
// / changed (with per-field config & mapping changes), edges, and variables —
// colour-coded (green add / red remove / amber change). Plus a review panel:
// optimistic comment thread + "Phê duyệt" / "Yêu cầu chỉnh" with toast.
import { useMemo, useState } from "react";
import clsx from "clsx";

import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import type { WorkflowVersion } from "@/xoffice/lib/versions-data";
import type {
  WorkflowDefinitionDocument,
  WorkflowNodeDoc,
} from "@/xoffice/workflow-types";

type Status = "added" | "removed" | "changed" | "same";

interface FieldChange {
  path: string;
  before?: unknown;
  after?: unknown;
  kind: "added" | "removed" | "changed";
}

interface NodeDiff {
  id: string;
  status: Status;
  name?: string;
  before?: string;
  after?: string;
  type?: string;
  changes: FieldChange[];
}

// Turn a `mappings: [{target, source, ...}]` array into an object keyed by
// target so a reordering doesn't read as a wholesale change, and each mapping
// diffs field-by-field.
function normalizeConfig(config: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...config };
  const mappings = config.mappings;
  if (Array.isArray(mappings)) {
    const byTarget: Record<string, unknown> = {};
    for (const m of mappings as Array<Record<string, unknown>>) {
      const t = String(m.target ?? m.source ?? Math.random());
      const { target, ...rest } = m;
      void target;
      byTarget[t] = rest;
    }
    out.mappings = byTarget;
  }
  return out;
}

function flatten(value: unknown, prefix: string, out: Record<string, unknown>): void {
  if (value === null || typeof value !== "object") {
    out[prefix] = value;
    return;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    out[prefix] = Array.isArray(value) ? "[]" : "{}";
    return;
  }
  for (const k of keys) {
    flatten(obj[k], prefix ? `${prefix}.${k}` : k, out);
  }
}

function fmt(v: unknown): string {
  if (v === undefined) return "—";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

function configChanges(a: WorkflowNodeDoc, b: WorkflowNodeDoc): FieldChange[] {
  const fa: Record<string, unknown> = {};
  const fb: Record<string, unknown> = {};
  flatten(normalizeConfig(a.config ?? {}), "", fa);
  flatten(normalizeConfig(b.config ?? {}), "", fb);
  const paths = new Set([...Object.keys(fa), ...Object.keys(fb)]);
  const changes: FieldChange[] = [];
  for (const p of paths) {
    const inA = p in fa;
    const inB = p in fb;
    if (inA && !inB) changes.push({ path: p, before: fa[p], kind: "removed" });
    else if (!inA && inB) changes.push({ path: p, after: fb[p], kind: "added" });
    else if (JSON.stringify(fa[p]) !== JSON.stringify(fb[p]))
      changes.push({ path: p, before: fa[p], after: fb[p], kind: "changed" });
  }
  return changes.sort((x, y) => x.path.localeCompare(y.path));
}

function diffNodes(a: WorkflowDefinitionDocument, b: WorkflowDefinitionDocument): NodeDiff[] {
  const mapA = new Map(a.nodes.map((n) => [n.id, n]));
  const mapB = new Map(b.nodes.map((n) => [n.id, n]));
  const ids = new Set([...mapA.keys(), ...mapB.keys()]);
  const out: NodeDiff[] = [];
  for (const id of ids) {
    const na = mapA.get(id);
    const nb = mapB.get(id);
    if (na && !nb) out.push({ id, status: "removed", before: na.name, type: na.type, changes: [] });
    else if (!na && nb) out.push({ id, status: "added", after: nb.name, type: nb.type, changes: [] });
    else if (na && nb) {
      const changes = configChanges(na, nb);
      const nameChanged = na.name !== nb.name;
      const changed = nameChanged || changes.length > 0;
      out.push({
        id,
        status: changed ? "changed" : "same",
        before: na.name,
        after: nb.name,
        type: nb.type,
        changes,
      });
    }
  }
  return out.sort((x, y) => x.id.localeCompare(y.id));
}

function edgeKey(e: { source: string; target: string; label?: string }): string {
  return `${e.source}→${e.target}${e.label ? ` [${e.label}]` : ""}`;
}

function variableKeys(def: WorkflowDefinitionDocument): Map<string, string> {
  const out = new Map<string, string>();
  for (const v of def.variables ?? []) {
    const rec = v as Record<string, unknown>;
    const key = String(rec.key ?? rec.name ?? JSON.stringify(rec));
    out.set(key, JSON.stringify(rec));
  }
  return out;
}

const statusTone: Record<Status, string> = {
  added: "border-success-500/40 bg-success-500/5",
  removed: "border-error/40 bg-error/5",
  changed: "border-warning/40 bg-warning/5",
  same: "border-gray-200 dark:border-dark-600",
};
const badgeTone: Record<Status, "success" | "error" | "warning" | "neutral"> = {
  added: "success",
  removed: "error",
  changed: "warning",
  same: "neutral",
};
const statusLabel: Record<Status, string> = {
  added: "Thêm",
  removed: "Xoá",
  changed: "Sửa",
  same: "Giữ nguyên",
};

interface Comment {
  text: string;
  at: string;
  kind: "note" | "approve" | "request-changes";
}

export function VersionDiff({
  code,
  history,
  source,
}: {
  code: string;
  history: WorkflowVersion[];
  source: "api" | "seed";
}) {
  const [aIdx, setAIdx] = useState(history.length > 1 ? 1 : 0);
  const [bIdx, setBIdx] = useState(0);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [decision, setDecision] = useState<"approve" | "request-changes" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showSame, setShowSame] = useState(false);

  const va = history[aIdx];
  const vb = history[bIdx];

  const nodeDiffs = useMemo(
    () => (va && vb ? diffNodes(va.definition, vb.definition) : []),
    [va, vb],
  );

  const edgeDiff = useMemo(() => {
    if (!va || !vb) return { added: [] as string[], removed: [] as string[] };
    const setA = new Set(va.definition.edges.map(edgeKey));
    const setB = new Set(vb.definition.edges.map(edgeKey));
    return {
      added: [...setB].filter((k) => !setA.has(k)),
      removed: [...setA].filter((k) => !setB.has(k)),
    };
  }, [va, vb]);

  const varDiff = useMemo(() => {
    if (!va || !vb) return { added: [] as string[], removed: [] as string[], changed: [] as string[] };
    const ma = variableKeys(va.definition);
    const mb = variableKeys(vb.definition);
    const keys = new Set([...ma.keys(), ...mb.keys()]);
    const added: string[] = [];
    const removed: string[] = [];
    const changed: string[] = [];
    for (const k of keys) {
      if (ma.has(k) && !mb.has(k)) removed.push(k);
      else if (!ma.has(k) && mb.has(k)) added.push(k);
      else if (ma.get(k) !== mb.get(k)) changed.push(k);
    }
    return { added, removed, changed };
  }, [va, vb]);

  const nameChanged =
    va && vb && va.definition.metadata.name !== vb.definition.metadata.name;

  const visibleNodeDiffs = showSame ? nodeDiffs : nodeDiffs.filter((d) => d.status !== "same");
  const changedCount =
    nodeDiffs.filter((d) => d.status !== "same").length +
    edgeDiff.added.length +
    edgeDiff.removed.length +
    varDiff.added.length +
    varDiff.removed.length +
    varDiff.changed.length +
    (nameChanged ? 1 : 0);

  const fireToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  };

  const addComment = (kind: Comment["kind"], text: string) => {
    setComments((p) => [...p, { text, at: new Date().toLocaleString("vi-VN"), kind }]);
  };

  const submitNote = () => {
    if (!comment.trim()) return;
    addComment("note", comment.trim());
    setComment("");
    fireToast("Đã thêm ý kiến.");
  };

  const approve = () => {
    setDecision("approve");
    addComment("approve", comment.trim() || `Phê duyệt phiên bản ${label(vb!)}`);
    setComment("");
    fireToast("Đã phê duyệt phiên bản (optimistic).");
  };

  const requestChanges = () => {
    setDecision("request-changes");
    addComment("request-changes", comment.trim() || "Yêu cầu chỉnh sửa trước khi publish");
    setComment("");
    fireToast("Đã gửi yêu cầu chỉnh (optimistic).");
  };

  if (history.length === 0) {
    return <p className="text-sm text-gray-400">Chưa có phiên bản nào cho quy trình này.</p>;
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed right-4 top-4 z-50 rounded-lg bg-gray-800 px-4 py-2 text-sm text-white shadow-soft dark:bg-dark-500">
          {toast}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={source === "api" ? "success" : "warning"}>
          {source === "api" ? "Kết nối backend" : "Seed (chỉ 1 phiên bản)"}
        </Badge>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 dark:text-dark-300">So sánh</span>
          <select
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-100"
            value={aIdx}
            onChange={(e) => setAIdx(Number(e.target.value))}
          >
            {history.map((v, i) => (
              <option key={i} value={i}>{label(v)}</option>
            ))}
          </select>
          <span className="text-gray-400">→</span>
          <select
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-100"
            value={bIdx}
            onChange={(e) => setBIdx(Number(e.target.value))}
          >
            {history.map((v, i) => (
              <option key={i} value={i}>{label(v)}</option>
            ))}
          </select>
        </div>
        <span className="text-tiny text-gray-400">{changedCount} thay đổi</span>
        <label className="ml-auto flex items-center gap-1.5 text-tiny text-gray-500 dark:text-dark-300">
          <input
            type="checkbox"
            checked={showSame}
            onChange={(e) => setShowSame(e.target.checked)}
            className="rounded border-gray-300 text-primary-600"
          />
          Hiện node không đổi
        </label>
      </div>

      {nameChanged && (
        <div className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-sm text-warning-darker dark:text-warning-lighter">
          Tên quy trình:{" "}
          <span className="line-through opacity-70">{va!.definition.metadata.name}</span> →{" "}
          <span className="font-medium">{vb!.definition.metadata.name}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title={`Khác biệt node (${visibleNodeDiffs.length})`}>
          <div className="space-y-2">
            {visibleNodeDiffs.map((d) => (
              <div key={d.id} className={clsx("rounded-lg border px-2.5 py-2", statusTone[d.status])}>
                <div className="flex items-center justify-between gap-2 text-tiny">
                  <span className="flex items-center gap-1.5">
                    <Badge tone={badgeTone[d.status]}>{statusLabel[d.status]}</Badge>
                    <span className="font-mono text-gray-700 dark:text-dark-100">{d.id}</span>
                    {d.type && <span className="text-gray-400">· {d.type}</span>}
                  </span>
                  <span className="text-gray-500 dark:text-dark-300">
                    {d.status === "added" ? d.after : d.status === "removed" ? d.before : d.after}
                  </span>
                </div>
                {d.status === "changed" && d.before !== d.after && (
                  <p className="mt-1 text-tiny">
                    <span className="text-gray-400">tên:</span>{" "}
                    <span className="text-error line-through opacity-70">{d.before}</span> →{" "}
                    <span className="text-success-600 dark:text-success-400">{d.after}</span>
                  </p>
                )}
                {d.changes.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {d.changes.map((c) => (
                      <li key={c.path} className="font-mono text-tiny leading-relaxed">
                        <span className="text-gray-400">{c.path}:</span>{" "}
                        {c.kind !== "added" && (
                          <span className="text-error line-through opacity-70">{fmt(c.before)}</span>
                        )}
                        {c.kind === "changed" && " → "}
                        {c.kind !== "removed" && (
                          <span className="text-success-600 dark:text-success-400">{fmt(c.after)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {visibleNodeDiffs.length === 0 && (
              <p className="py-4 text-center text-tiny text-gray-400">Không có node thay đổi.</p>
            )}
          </div>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Khác biệt luồng (edge) & biến">
            <div className="space-y-1.5">
              {edgeDiff.added.map((k) => (
                <div key={k} className="rounded-lg border border-success-500/40 bg-success-500/5 px-2.5 py-1.5 font-mono text-tiny text-success-600 dark:text-success-400">+ {k}</div>
              ))}
              {edgeDiff.removed.map((k) => (
                <div key={k} className="rounded-lg border border-error/40 bg-error/5 px-2.5 py-1.5 font-mono text-tiny text-error">− {k}</div>
              ))}
              {edgeDiff.added.length === 0 && edgeDiff.removed.length === 0 && (
                <p className="text-tiny text-gray-400">Không có thay đổi luồng.</p>
              )}

              <div className="mt-2 border-t border-gray-200 pt-2 dark:border-dark-600">
                {varDiff.added.map((k) => (
                  <div key={`va-${k}`} className="font-mono text-tiny text-success-600 dark:text-success-400">+ biến {k}</div>
                ))}
                {varDiff.removed.map((k) => (
                  <div key={`vr-${k}`} className="font-mono text-tiny text-error">− biến {k}</div>
                ))}
                {varDiff.changed.map((k) => (
                  <div key={`vc-${k}`} className="font-mono text-tiny text-warning-darker dark:text-warning-lighter">~ biến {k}</div>
                ))}
                {varDiff.added.length + varDiff.removed.length + varDiff.changed.length === 0 && (
                  <p className="text-tiny text-gray-400">Không có thay đổi biến.</p>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Kiểm duyệt phiên bản">
            <div className="space-y-2">
              {decision && (
                <Badge tone={decision === "approve" ? "success" : "warning"}>
                  {decision === "approve" ? "Đã phê duyệt" : "Đang yêu cầu chỉnh"}
                </Badge>
              )}
              {comments.length > 0 && (
                <div className="space-y-1.5">
                  {comments.map((c, i) => (
                    <div
                      key={i}
                      className={clsx(
                        "rounded-lg px-2.5 py-1.5 text-tiny",
                        c.kind === "approve"
                          ? "bg-success-500/10 text-success-darker dark:text-success-lighter"
                          : c.kind === "request-changes"
                            ? "bg-warning/10 text-warning-darker dark:text-warning-lighter"
                            : "bg-gray-50 text-gray-600 dark:bg-dark-700 dark:text-dark-200",
                      )}
                    >
                      {c.kind === "approve" && "✓ "}
                      {c.kind === "request-changes" && "✎ "}
                      {c.text} <span className="text-gray-400">· {c.at}</span>
                    </div>
                  ))}
                </div>
              )}
              <textarea
                className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-100"
                placeholder="Ghi chú kiểm duyệt…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={submitNote}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs-plus font-medium text-gray-600 transition hover:bg-gray-100 dark:border-dark-500 dark:text-dark-100 dark:hover:bg-dark-600"
                >
                  Thêm ý kiến
                </button>
                <button
                  onClick={approve}
                  className="rounded-lg bg-success px-3 py-1.5 text-xs-plus font-medium text-white transition hover:bg-success-darker"
                >
                  Phê duyệt version
                </button>
                <button
                  onClick={requestChanges}
                  className="rounded-lg border border-warning/60 px-3 py-1.5 text-xs-plus font-medium text-warning-darker transition hover:bg-warning/10 dark:text-warning-lighter"
                >
                  Yêu cầu chỉnh
                </button>
              </div>
              <p className="text-tiny text-gray-400">
                Quy trình <span className="font-mono">{code}</span> — kiểm duyệt hiển thị ở giao diện
                (optimistic); version đã publish là bất biến.
              </p>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function label(v: WorkflowVersion): string {
  return `v${v.version}${v.publishedAt ? ` · ${new Date(v.publishedAt).toLocaleDateString("vi-VN")}` : ""}`;
}
