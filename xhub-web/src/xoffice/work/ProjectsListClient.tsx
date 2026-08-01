"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/xhub/ui/Badge";
import { SectionCard } from "@/xhub/ui/Card";
import { DataTable, type Column } from "@/xhub/ui/DataTable";
import { FormDrawer } from "@/xhub/ui/form/FormDrawer";
import { TextField, TextareaField, SelectField } from "@/xhub/ui/form/Fields";
import type { ProjectRow } from "@/xoffice/lib/work-projects-data";
import {
  PROJECT_STATUS_LABEL, PROJECT_STATUS_TONE, HEALTH_LABEL, HEALTH_TONE, KIND_LABEL, METHOD_LABEL, fmtDate,
} from "./project-states";

const PAGE_SIZE = 12;
const STATUSES = Object.keys(PROJECT_STATUS_LABEL);

/**
 * Client list for ExecutionProject (Dự án thực thi). Filters by status / kind /
 * health / search; a create drawer POSTs through the BFF proxy. All data is the
 * one authoritative work dataset — no fake ERP.
 */
export function ProjectsListClient({ rows }: { rows: ProjectRow[] }) {
  const router = useRouter();
  const [status, setStatus] = useState("ALL");
  const [kind, setKind] = useState("ALL");
  const [health, setHealth] = useState("ALL");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (status !== "ALL" && r.status !== status) return false;
      if (kind !== "ALL" && r.projectKind !== kind) return false;
      if (health !== "ALL" && r.health !== health) return false;
      if (q && !`${r.name} ${r.code}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [rows, status, kind, health, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const columns: Column<ProjectRow>[] = [
    {
      key: "name",
      header: "Dự án",
      cell: (r) => (
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-medium text-gray-800 dark:text-dark-100">
            <span className="font-mono text-[11px] text-gray-400">{r.code}</span>
            <span className="truncate">{r.name}</span>
          </p>
          <p className="mt-0.5 text-xs text-gray-400">{KIND_LABEL[r.projectKind] ?? r.projectKind} · {METHOD_LABEL[r.progressMethod] ?? r.progressMethod}</p>
        </div>
      ),
    },
    { key: "status", header: "Trạng thái", cell: (r) => <Badge tone={PROJECT_STATUS_TONE[r.status] ?? "neutral"}>{PROJECT_STATUS_LABEL[r.status] ?? r.status}</Badge> },
    { key: "health", header: "Sức khoẻ", cell: (r) => <Badge tone={HEALTH_TONE[r.health] ?? "neutral"}>{HEALTH_LABEL[r.health] ?? r.health}</Badge> },
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
    { key: "finish", header: "Kết thúc (KH)", cell: (r) => <span className="text-xs text-gray-500">{fmtDate(r.plannedFinish)}</span> },
  ];

  async function submit(form: HTMLFormElement) {
    setError(null);
    const fd = new FormData(form);
    const body: Record<string, unknown> = {
      code: String(fd.get("code") ?? "").trim(),
      name: String(fd.get("name") ?? "").trim(),
      description: String(fd.get("description") ?? "").trim() || undefined,
      projectKind: fd.get("projectKind") || "INTERNAL",
      progressMethod: fd.get("progressMethod") || "TASK_WEIGHTED",
      plannedFinish: fd.get("plannedFinish") ? new Date(String(fd.get("plannedFinish"))).toISOString() : undefined,
    };
    if (!body.code || !body.name) { setError("Mã và tên dự án là bắt buộc"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/work/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const jb = await res.json().catch(() => ({})); setError(jb?.detail?.message ?? jb?.message ?? "Không tạo được dự án"); return; }
      const created = await res.json();
      setOpen(false);
      if (created?.id) router.push(`/work/projects/${created.id}`);
      else router.refresh();
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
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Dự án thực thi</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">{filtered.length}/{rows.length} dự án — tiến độ, sức khoẻ, baseline</p>
        </div>
        <div className="flex items-center gap-2">
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Tìm theo tên/mã…" className="h-9 w-56 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-primary-500 dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50" />
          <button onClick={() => setOpen(true)} className="h-9 rounded-lg bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700">+ Tạo dự án</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-xs dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50">
          <option value="ALL">Mọi trạng thái</option>
          {STATUSES.map((s) => <option key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</option>)}
        </select>
        <select value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }} className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-xs dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50">
          <option value="ALL">Mọi loại</option>
          {Object.entries(KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={health} onChange={(e) => { setHealth(e.target.value); setPage(1); }} className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-xs dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50">
          <option value="ALL">Mọi sức khoẻ</option>
          {Object.entries(HEALTH_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <SectionCard title="Danh sách dự án" accent="primary">
        <DataTable columns={columns} rows={pageRows} rowKey={(r) => r.id} onRowClick={(r) => router.push(`/work/projects/${r.id}`)} />
        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm">
            <button disabled={clampedPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-gray-300 px-3 py-1 disabled:opacity-40 dark:border-dark-500">← Trước</button>
            <span className="text-gray-500">Trang {clampedPage}/{totalPages}</span>
            <button disabled={clampedPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-lg border border-gray-300 px-3 py-1 disabled:opacity-40 dark:border-dark-500">Sau →</button>
          </div>
        )}
      </SectionCard>

      <FormDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Tạo dự án thực thi"
        description="Dự án mới thuộc tenant hiện tại (RLS)."
        submitLabel="Tạo dự án"
        submitting={submitting}
        onSubmit={() => { const f = document.getElementById("project-create-form") as HTMLFormElement | null; if (f) submit(f); }}
        footnote={error ? <p className="text-sm text-error">{error}</p> : null}
      >
        <form id="project-create-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }}>
          <div className="grid grid-cols-2 gap-3">
            <TextField name="code" label="Mã dự án" required placeholder="VD: EP-INT-002" />
            <SelectField name="projectKind" label="Loại" options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))} defaultValue="INTERNAL" />
          </div>
          <TextField name="name" label="Tên dự án" required placeholder="VD: Nền tảng X.Office nội bộ" />
          <TextareaField name="description" label="Mô tả" placeholder="Mục tiêu, phạm vi…" />
          <div className="grid grid-cols-2 gap-3">
            <SelectField name="progressMethod" label="Cách tính tiến độ" options={Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))} defaultValue="TASK_WEIGHTED" />
            <TextField name="plannedFinish" label="Kết thúc (KH)" type="date" />
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
