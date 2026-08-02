"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionCard } from "@/xhub/ui/Card";
import { DataTable, type Column } from "@/xhub/ui/DataTable";
import { Badge } from "@/xhub/ui/Badge";
import type { BookableResourceRow } from "@/xoffice/lib/bookings-data";
import { RESOURCE_TYPE_LABEL, RESOURCE_TYPE_ORDER } from "./booking-states";

// U32 FAIL: bookable resources (phòng/xe/thiết bị) had NO management UI at
// all — the catalog only ever existed via the seed script. This is the
// missing "công ty tự thiết lập danh mục" screen: list + create, gated
// server-side by booking.manage (this page renders regardless; the API
// 403s under enforcement for a caller who lacks it — same soft-render
// convention as the rest of X.Office today).
export function ResourceManager({ resources }: { resources: BookableResourceRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState(RESOURCE_TYPE_ORDER[0]);
  const [capacity, setCapacity] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const byType = new Map<string, BookableResourceRow[]>();
    for (const r of resources) {
      const list = byType.get(r.type) ?? [];
      list.push(r);
      byType.set(r.type, list);
    }
    return byType;
  }, [resources]);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/bookable-resources`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          code,
          type,
          capacity: capacity ? Number(capacity) : undefined,
          location: location || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j?.detail?.message ?? j?.error ?? `Lỗi ${res.status}`);
        return;
      }
      setOpen(false);
      setName(""); setCode(""); setCapacity(""); setLocation("");
      router.refresh();
    } catch {
      setErr("Không kết nối được backend");
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<BookableResourceRow>[] = [
    { key: "name", header: "Tên", cell: (r) => <span className="font-medium text-gray-800 dark:text-dark-100">{r.name}</span> },
    { key: "code", header: "Mã", cell: (r) => <span className="font-mono text-xs text-gray-400">{r.code}</span> },
    { key: "capacity", header: "Sức chứa", cell: (r) => <span className="text-sm text-gray-600 dark:text-dark-200">{r.capacity ?? "—"}</span> },
    { key: "location", header: "Vị trí", cell: (r) => <span className="text-sm text-gray-600 dark:text-dark-200">{r.location ?? "—"}</span> },
    { key: "active", header: "Trạng thái", cell: (r) => <Badge tone={r.active === false ? "neutral" : "success"}>{r.active === false ? "Ngừng dùng" : "Đang dùng"}</Badge> },
  ];

  return (
    <SectionCard
      title="Quản lý danh mục tài nguyên"
      accent="neutral"
      action={
        <button onClick={() => setOpen((v) => !v)} className="inline-flex h-8 items-center rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-dark-500 dark:text-dark-100 dark:hover:bg-dark-600">
          {open ? "Đóng" : "+ Thêm tài nguyên"}
        </button>
      }
      bodyClassName="space-y-4"
    >
      {open && (
        <div className="rounded-lg border border-gray-200 p-3 dark:border-dark-600">
          {err && <div className="mb-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{err}</div>}
          <div className="grid gap-2 md:grid-cols-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên (vd. Phòng họp Ban điều hành)" className="h-9 rounded-lg border border-gray-300 px-3 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50" />
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Mã (vd. ROOM-EXEC)" className="h-9 rounded-lg border border-gray-300 px-3 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50" />
            <select value={type} onChange={(e) => setType(e.target.value)} className="h-9 rounded-lg border border-gray-300 px-3 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50">
              {RESOURCE_TYPE_ORDER.map((t) => <option key={t} value={t}>{RESOURCE_TYPE_LABEL[t]}</option>)}
            </select>
            <input value={capacity} onChange={(e) => setCapacity(e.target.value)} type="number" min={0} placeholder="Sức chứa (tuỳ chọn)" className="h-9 rounded-lg border border-gray-300 px-3 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50" />
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Vị trí (tuỳ chọn)" className="h-9 rounded-lg border border-gray-300 px-3 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50 md:col-span-2" />
          </div>
          <div className="mt-3 flex gap-2">
            <button disabled={busy || !name.trim() || !code.trim()} onClick={submit} className="inline-flex h-9 items-center rounded-lg bg-primary-600 px-3.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50">
              {busy ? "…" : "Lưu tài nguyên"}
            </button>
          </div>
        </div>
      )}

      {RESOURCE_TYPE_ORDER.map((t) => {
        const list = grouped.get(t);
        if (!list?.length) return null;
        return (
          <div key={t}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{RESOURCE_TYPE_LABEL[t]} ({list.length})</p>
            <DataTable columns={columns} rows={list} rowKey={(r) => r.id} />
          </div>
        );
      })}
      {resources.length === 0 && <p className="text-sm text-gray-400">Chưa có tài nguyên nào — thêm phòng họp/xe/thiết bị đầu tiên ở trên.</p>}
    </SectionCard>
  );
}
