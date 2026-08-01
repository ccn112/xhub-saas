"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { DataTable, type Column } from "@/xhub/ui/DataTable";
import { Pagination } from "@/xhub/ui/Pagination";
import { DefRow } from "@/features/tenant-admin/AdminHeader";
import type { Position } from "@/features/tenant-admin/data";

type Row = Position & { orgUnitName: string };
type Person = { id: string; name: string };

interface Assignment {
  id: string;
  positionId: string;
  personId: string;
  kind: "PRIMARY" | "ACTING";
  effectiveFrom: string;
  effectiveTo: string | null;
  reason: string | null;
  status: "active" | "scheduled" | "expired";
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("vi-VN") : "∞");
const statusTone = (s: Assignment["status"]) => (s === "active" ? "success" : s === "scheduled" ? "primary" : "neutral");
const statusLabel = (s: Assignment["status"]) => (s === "active" ? "Hiệu lực" : s === "scheduled" ? "Sắp tới" : "Hết hạn");

export function PositionsClient({ positions, people }: { positions: Row[]; people: Person[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const visible = useMemo(
    () => positions.filter((p) => !query || `${p.name} ${p.person} ${p.orgUnitName} ${p.code}`.toLowerCase().includes(query.toLowerCase())),
    [positions, query],
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => { setPage(1); }, [query]);
  const paged = visible.slice((page - 1) * pageSize, page * pageSize);

  const [selected, setSelected] = useState<string>(positions[0]?.code ?? "");
  const sel = positions.find((p) => p.code === selected) ?? positions[0];
  const [actingOpen, setActingOpen] = useState(false);

  const vacant = positions.filter((p) => !p.holder).length;
  const personName = useCallback((id: string) => people.find((p) => p.id === id)?.name ?? id, [people]);

  // ---- live holder/acting timeline for the selected position -------------
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [timelineSource, setTimelineSource] = useState<"live" | "demo">("demo");
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  const loadTimeline = useCallback(async (posId?: string) => {
    if (!posId) { setAssignments([]); setTimelineSource("demo"); return; }
    setLoadingTimeline(true);
    try {
      const res = await fetch(`/api/admin/identity/positions/${encodeURIComponent(posId)}/assignments`, { cache: "no-store" });
      if (!res.ok) throw new Error("not ok");
      const rows = (await res.json()) as Assignment[];
      if (!Array.isArray(rows)) throw new Error("bad shape");
      setAssignments(rows);
      setTimelineSource("live");
    } catch {
      setAssignments([]);
      setTimelineSource("demo");
    } finally {
      setLoadingTimeline(false);
    }
  }, []);

  useEffect(() => { loadTimeline(sel?.id); }, [sel?.id, loadTimeline]);

  // ---- acting/primary assignment drawer (live POST) ----------------------
  const [form, setForm] = useState({ personId: "", kind: "ACTING" as "ACTING" | "PRIMARY", effectiveFrom: "", effectiveTo: "", reason: "" });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ tone: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    if (actingOpen) setForm({ personId: "", kind: "ACTING", effectiveFrom: "", effectiveTo: "", reason: "" });
  }, [actingOpen, selected]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const submit = useCallback(async () => {
    if (!sel?.id) { setToast({ tone: "error", msg: "Vị trí demo — cần backend trực tiếp để phân công." }); return; }
    if (!form.personId || !form.effectiveFrom) { setToast({ tone: "error", msg: "Chọn người và ngày bắt đầu." }); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/identity/positions/${encodeURIComponent(sel.id)}/assignments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          personId: form.personId,
          kind: form.kind,
          effectiveFrom: new Date(form.effectiveFrom).toISOString(),
          effectiveTo: form.effectiveTo ? new Date(form.effectiveTo).toISOString() : null,
          reason: form.reason || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data?.detail?.message ?? data?.message ?? "Không thể phân công (guardrail).";
        setToast({ tone: "error", msg: String(detail) });
        return;
      }
      setToast({ tone: "success", msg: `Đã phân công ${form.kind} cho ${personName(form.personId)}.` });
      setActingOpen(false);
      await loadTimeline(sel.id);
      router.refresh();
    } catch {
      setToast({ tone: "error", msg: "Lỗi kết nối tới backend." });
    } finally {
      setSubmitting(false);
    }
  }, [sel?.id, form, personName, loadTimeline, router]);

  const revoke = useCallback(async (assignmentId: string) => {
    if (!sel?.id) return;
    try {
      const res = await fetch(`/api/admin/identity/positions/${encodeURIComponent(sel.id)}/assignments/${encodeURIComponent(assignmentId)}`, { method: "DELETE" });
      if (!res.ok) { setToast({ tone: "error", msg: "Không thể thu hồi phân công." }); return; }
      setToast({ tone: "success", msg: "Đã thu hồi phân công." });
      await loadTimeline(sel.id);
      router.refresh();
    } catch {
      setToast({ tone: "error", msg: "Lỗi kết nối tới backend." });
    }
  }, [sel?.id, loadTimeline, router]);

  const columns: Column<Row>[] = [
    { key: "pos", header: "Vị trí", cell: (p) => (<div><p className="font-medium text-gray-800 dark:text-dark-100">{p.name}</p><p className="text-xs text-gray-400">{p.code}</p></div>) },
    { key: "unit", header: "Đơn vị", cell: (p) => <span className="text-gray-600 dark:text-dark-200">{p.orgUnitName}</span> },
    { key: "holder", header: "Người giữ", cell: (p) => p.holder ? <span className="text-gray-700 dark:text-dark-100">{p.person}</span> : <Badge tone="warning">Khuyết</Badge> },
    { key: "status", header: "Trạng thái", align: "right", cell: (p) => <Badge tone={p.holder ? "success" : "warning"}>{p.holder ? "Đang giữ" : "Trống"}</Badge> },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Vị trí" value={String(positions.length)} icon="💼" tone="primary" />
        <StatCard label="Đang có người" value={String(positions.length - vacant)} icon="✅" tone="success" />
        <StatCard label="Khuyết" value={String(vacant)} icon="⚠️" tone={vacant ? "warning" : "success"} />
        <StatCard label="Đơn vị" value={String(new Set(positions.map((p) => p.orgUnit)).size)} icon="🏢" tone="neutral" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="mb-3">
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm vị trí, người giữ, đơn vị" aria-label="Tìm vị trí"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-dark-600 dark:bg-dark-700 dark:text-dark-100 sm:max-w-sm" />
          </div>
          <SectionCard title={`Danh sách (${visible.length})`} bodyClassName="p-0">
            <DataTable columns={columns} rows={paged} rowKey={(p) => p.code} onRowClick={(p) => setSelected(p.code)} minWidthClass="min-w-[640px]" />
            {visible.length > 0 ? <Pagination page={page} pageSize={pageSize} total={visible.length} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} /> : null}
          </SectionCard>
        </div>

        <div>
          {sel ? (
            <SectionCard title="Chi tiết vị trí" accent="neutral"
              action={<button type="button" onClick={() => setActingOpen(true)} className="text-sm text-primary-600 hover:underline">Phân công tạm quyền</button>}>
              <dl className="space-y-2 text-sm">
                <DefRow label="Chức danh" value={sel.name} />
                <DefRow label="Mã" value={sel.code} />
                <DefRow label="Đơn vị" value={sel.orgUnitName} />
                <DefRow label="Người giữ" value={sel.holder ? sel.person : "Khuyết"} />
              </dl>
              <div className="mt-4 border-t border-gray-100 pt-3 dark:border-dark-600">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium uppercase text-gray-400">Lịch sử người giữ & tạm quyền</p>
                  <Badge tone={timelineSource === "live" ? "success" : "warning"}>{timelineSource === "live" ? "Trực tiếp" : "Demo"}</Badge>
                </div>
                {loadingTimeline ? (
                  <p className="text-sm text-gray-400">Đang tải…</p>
                ) : timelineSource === "live" && assignments.length > 0 ? (
                  <ol className="space-y-2 text-sm">
                    {assignments.map((a) => (
                      <li key={a.id} className="flex items-start justify-between gap-2">
                        <span className="flex gap-2">
                          <span className={`mt-1.5 size-2 shrink-0 rounded-full ${a.status === "active" ? "bg-primary-500" : a.status === "scheduled" ? "bg-info" : "bg-gray-300"}`} />
                          <span className="text-gray-700 dark:text-dark-100">
                            {a.kind === "ACTING" ? "Tạm quyền · " : ""}{personName(a.personId)} · {fmt(a.effectiveFrom)} – {fmt(a.effectiveTo)}
                            <span className="ml-2"><Badge tone={statusTone(a.status)}>{statusLabel(a.status)}</Badge></span>
                            {a.kind === "ACTING" ? <span className="ml-1"><Badge tone="info">ACTING</Badge></span> : null}
                          </span>
                        </span>
                        {a.status !== "expired" ? (
                          <button type="button" onClick={() => revoke(a.id)} className="shrink-0 text-xs text-error hover:underline" aria-label="Thu hồi">Thu hồi</button>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <ol className="space-y-2 text-sm">
                    <li className="flex gap-2"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary-500" /><span>{sel.holder ? `${sel.person} · hiện tại` : "Khuyết"}</span></li>
                    <li className="flex gap-2"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-gray-300" /><span className="text-gray-500 dark:text-dark-300">Chưa có lịch sử phân công (backend chưa sẵn)</span></li>
                  </ol>
                )}
              </div>
            </SectionCard>
          ) : null}
        </div>
      </div>

      {actingOpen && sel ? (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Phân công tạm quyền">
          <button type="button" aria-label="Đóng" onClick={() => setActingOpen(false)} className="absolute inset-0 bg-black/30" />
          <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl dark:bg-dark-700">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-dark-600">
              <h2 className="font-heading text-base font-semibold text-gray-800 dark:text-dark-50">Phân công · {sel.name}</h2>
              <button type="button" onClick={() => setActingOpen(false)} aria-label="Đóng" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-600">✕</button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
              <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-darker dark:text-warning-lighter">Phân công có ngày hiệu lực. PRIMARY cập nhật người giữ khi trong hạn; ACTING (tạm quyền) không đổi người giữ.</p>
              <label className="block"><span className="mb-1 block font-medium text-gray-700 dark:text-dark-100">Loại phân công</span>
                <select value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as "ACTING" | "PRIMARY" }))} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-dark-600 dark:bg-dark-600 dark:text-dark-100">
                  <option value="ACTING">Tạm quyền (ACTING)</option>
                  <option value="PRIMARY">Người giữ chính (PRIMARY)</option>
                </select></label>
              <label className="block"><span className="mb-1 block font-medium text-gray-700 dark:text-dark-100">Người được phân công</span>
                <select value={form.personId} onChange={(e) => setForm((f) => ({ ...f, personId: e.target.value }))} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-dark-600 dark:bg-dark-600 dark:text-dark-100">
                  <option value="">Chọn người…</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="mb-1 block font-medium text-gray-700 dark:text-dark-100">Từ ngày</span><input type="date" value={form.effectiveFrom} onChange={(e) => setForm((f) => ({ ...f, effectiveFrom: e.target.value }))} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-dark-600 dark:bg-dark-600 dark:text-dark-100" /></label>
                <label className="block"><span className="mb-1 block font-medium text-gray-700 dark:text-dark-100">Đến ngày</span><input type="date" value={form.effectiveTo} onChange={(e) => setForm((f) => ({ ...f, effectiveTo: e.target.value }))} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-dark-600 dark:bg-dark-600 dark:text-dark-100" /></label>
              </div>
              <label className="block"><span className="mb-1 block font-medium text-gray-700 dark:text-dark-100">Lý do (tuỳ chọn)</span>
                <input type="text" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="VD: đi công tác" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-dark-600 dark:bg-dark-600 dark:text-dark-100" /></label>
              {!sel.id ? <p className="text-xs text-warning-darker dark:text-warning-lighter">Vị trí demo — cần backend trực tiếp (/api/identity) để lưu.</p> : null}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-dark-600">
              <button type="button" onClick={() => setActingOpen(false)} className="rounded-lg border border-gray-200 px-3.5 py-2 text-sm text-gray-600 dark:border-dark-600 dark:text-dark-200">Huỷ</button>
              <button type="button" onClick={submit} disabled={submitting || !sel.id} className="rounded-lg bg-primary-600 px-3.5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-primary-600/50">{submitting ? "Đang lưu…" : "Phân công"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div role="status" className={`fixed bottom-4 right-4 z-[60] max-w-sm rounded-lg px-4 py-3 text-sm shadow-lg ${toast.tone === "success" ? "bg-success text-white" : "bg-error text-white"}`}>
          {toast.msg}
        </div>
      ) : null}
    </div>
  );
}
