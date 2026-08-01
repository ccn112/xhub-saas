"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/xhub/ui/Badge";
import { SectionCard } from "@/xhub/ui/Card";
import { DataTable, type Column } from "@/xhub/ui/DataTable";
import { FormDrawer } from "@/xhub/ui/form/FormDrawer";
import { TextField, TextareaField, SelectField } from "@/xhub/ui/form/Fields";
import type { WorkItemRow, WorkDimension } from "@/xoffice/lib/work-items-data";
import {
  STATUS_LABEL, STATUS_TONE, TYPE_LABEL, PRIORITY_LABEL, PRIORITY_TONE, WORK_STATUSES, fmtDate,
} from "./work-states";

const PAGE_SIZE = 12;

/**
 * Client list for NativeWorkItem (Việc của tôi / Tôi giao). Filters (status /
 * type / tag chips / dimension dropdowns) narrow the server-fetched live list;
 * a create drawer POSTs through the BFF proxy. Rows the server returned as
 * SUMMARY tier (coordination) are badged and never show hidden detail.
 */
export function WorkListClient({
  rows,
  dimensions,
  title,
  subtitle,
  showCreate = true,
}: {
  rows: WorkItemRow[];
  dimensions: WorkDimension[];
  title: string;
  subtitle: string;
  showCreate?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string>("ALL");
  const [type, setType] = useState<string>("ALL");
  const [tag, setTag] = useState<string>("ALL");
  const [dims, setDims] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) for (const t of r.tags ?? []) s.add(t);
    return [...s].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (status !== "ALL" && r.status !== status) return false;
      if (type !== "ALL" && r.type !== type) return false;
      if (tag !== "ALL" && !(r.tags ?? []).includes(tag)) return false;
      for (const [k, v] of Object.entries(dims)) {
        if (v && (r.dimensions ?? {})[k] !== v) return false;
      }
      if (q && !`${r.title}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [rows, status, type, tag, dims, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const columns: Column<WorkItemRow>[] = [
    {
      key: "title",
      header: "Công việc",
      cell: (r) => (
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-medium text-gray-800 dark:text-dark-100">
            {r.wbsCode && <span className="font-mono text-[11px] text-gray-400">{r.wbsCode}</span>}
            <span className="truncate">{r.title}</span>
            {r.tier === "SUMMARY" && <Badge tone="info">Phối hợp</Badge>}
          </p>
          <p className="mt-0.5 flex flex-wrap gap-1">
            <span className="text-xs text-gray-400">{TYPE_LABEL[r.type] ?? r.type}</span>
            {(r.tags ?? []).slice(0, 3).map((t) => (
              <span key={t} className="rounded bg-gray-100 px-1.5 text-[11px] text-gray-500 dark:bg-dark-600 dark:text-dark-200">#{t}</span>
            ))}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (r) => (
        <span className="flex items-center gap-1.5">
          <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
          {r.overdue && <Badge tone="error">Quá hạn</Badge>}
        </span>
      ),
    },
    {
      key: "priority",
      header: "Ưu tiên",
      cell: (r) => (r.priority ? <Badge tone={PRIORITY_TONE[r.priority] ?? "neutral"}>{PRIORITY_LABEL[r.priority] ?? r.priority}</Badge> : <span className="text-gray-300">—</span>),
    },
    {
      key: "progress",
      header: "Tiến độ",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-150 dark:bg-dark-600">
            <div className="h-full rounded-full bg-primary-500" style={{ width: `${r.progressPercent}%` }} />
          </div>
          <span className="text-xs text-gray-500">{r.progressPercent}%</span>
        </div>
      ),
    },
    { key: "due", header: "Hạn", cell: (r) => <span className="text-xs text-gray-500">{fmtDate(r.dueAt)}</span> },
  ];

  async function submit(form: HTMLFormElement) {
    setError(null);
    const fd = new FormData(form);
    const body: Record<string, unknown> = {
      title: String(fd.get("title") ?? "").trim(),
      description: String(fd.get("description") ?? "").trim() || undefined,
      type: fd.get("type") || "TASK",
      priority: fd.get("priority") || "NORMAL",
      dueAt: fd.get("dueAt") ? new Date(String(fd.get("dueAt"))).toISOString() : undefined,
      tags: String(fd.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean),
    };
    const dimObj: Record<string, string> = {};
    for (const d of dimensions) {
      const v = String(fd.get(`dim_${d.key}`) ?? "").trim();
      if (v) dimObj[d.key] = v;
    }
    if (Object.keys(dimObj).length) body.dimensions = dimObj;
    if (!body.title) { setError("Tiêu đề là bắt buộc"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/work/items", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j?.detail?.message ?? "Không tạo được công việc"); return; }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Backend không phản hồi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">{title}</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">{filtered.length}/{rows.length} — {subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Tìm theo tiêu đề…"
            className="h-9 w-56 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-primary-500 dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50"
          />
          {showCreate && (
            <button onClick={() => setOpen(true)} className="h-9 rounded-lg bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700">+ Tạo việc</button>
          )}
        </div>
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap gap-1.5">
        <Chip active={status === "ALL"} onClick={() => { setStatus("ALL"); setPage(1); }} label={`Mọi trạng thái (${rows.length})`} />
        {WORK_STATUSES.filter((s) => rows.some((r) => r.status === s)).map((s) => (
          <Chip key={s} active={status === s} onClick={() => { setStatus(s); setPage(1); }} label={`${STATUS_LABEL[s]} (${rows.filter((r) => r.status === s).length})`} />
        ))}
      </div>

      {/* Tag + dimension filters (owner requirement #2) */}
      {(allTags.length > 0 || dimensions.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {allTags.length > 0 && (
            <select value={tag} onChange={(e) => { setTag(e.target.value); setPage(1); }} className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-xs dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50">
              <option value="ALL">Mọi tag</option>
              {allTags.map((t) => <option key={t} value={t}>#{t}</option>)}
            </select>
          )}
          {dimensions.map((d) => (
            <select
              key={d.key}
              value={dims[d.key] ?? ""}
              onChange={(e) => { setDims((prev) => ({ ...prev, [d.key]: e.target.value })); setPage(1); }}
              className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-xs dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50"
            >
              <option value="">{d.label}: tất cả</option>
              {(d.allowedValues ?? []).map((v) => <option key={v.value} value={v.value}>{d.label}: {v.label}</option>)}
            </select>
          ))}
        </div>
      )}

      <SectionCard title="Danh sách công việc" accent="primary">
        <DataTable columns={columns} rows={pageRows} rowKey={(r) => r.id} onRowClick={(r) => router.push(`/work/items/${r.id}`)} />
        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm">
            <button disabled={clampedPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-gray-300 px-3 py-1 disabled:opacity-40 dark:border-dark-500">← Trước</button>
            <span className="text-gray-500">Trang {clampedPage}/{totalPages}</span>
            <button disabled={clampedPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-lg border border-gray-300 px-3 py-1 disabled:opacity-40 dark:border-dark-500">Sau →</button>
          </div>
        )}
      </SectionCard>

      {showCreate && (
        <FormDrawer
          open={open}
          onClose={() => setOpen(false)}
          title="Tạo công việc"
          description="Công việc mới thuộc tenant hiện tại (RLS)."
          submitLabel="Tạo việc"
          submitting={submitting}
          onSubmit={() => { const f = document.getElementById("work-create-form") as HTMLFormElement | null; if (f) submit(f); }}
          footnote={error ? <p className="text-sm text-error">{error}</p> : null}
        >
          <form id="work-create-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }}>
            <TextField name="title" label="Tiêu đề" required placeholder="VD: Chuẩn hoá tài liệu W1" />
            <TextareaField name="description" label="Mô tả" placeholder="Chi tiết công việc…" />
            <div className="grid grid-cols-2 gap-3">
              <SelectField name="type" label="Loại" options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))} defaultValue="TASK" />
              <SelectField name="priority" label="Ưu tiên" options={Object.entries(PRIORITY_LABEL).map(([value, label]) => ({ value, label }))} defaultValue="NORMAL" />
            </div>
            <TextField name="dueAt" label="Hạn" type="date" />
            <TextField name="tags" label="Tags" hint="Ngăn cách bởi dấu phẩy" placeholder="w1, kien-truc" />
            {dimensions.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {dimensions.map((d) => (
                  <SelectField key={d.key} name={`dim_${d.key}`} label={d.label} placeholder="—" options={(d.allowedValues ?? []).map((v) => ({ value: v.value, label: v.label }))} />
                ))}
              </div>
            )}
          </form>
        </FormDrawer>
      )}
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full border px-3 py-1 text-xs font-medium transition " +
        (active
          ? "border-primary-500 bg-primary-600/10 text-primary-600 dark:text-primary-400"
          : "border-gray-300 text-gray-500 hover:border-primary-300 dark:border-dark-500 dark:text-dark-200")
      }
    >
      {label}
    </button>
  );
}
