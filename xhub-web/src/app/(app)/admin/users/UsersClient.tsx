"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge, type Tone } from "@/xhub/ui/Badge";
import { DataTable, type Column } from "@/xhub/ui/DataTable";
import { Pagination } from "@/xhub/ui/Pagination";
import { FormDrawer, FormSection, TextField, SelectField } from "@/xhub/ui/form";
import { useToast } from "@/components/ui/Toast";
import type { AdminUser } from "@/features/tenant-admin/data";

const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Hoạt động", tone: "success" },
  suspended: { label: "Đã khoá", tone: "error" },
  invited: { label: "Đã mời", tone: "warning" },
};

export function UsersClient({ users }: { users: AdminUser[] }) {
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  const visible = useMemo(
    () => users.filter((u) => {
      if (status !== "all" && u.status !== status) return false;
      if (query && !`${u.name} ${u.email} ${u.title} ${u.department}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    }),
    [users, status, query],
  );

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => { setPage(1); }, [status, query]);
  const paged = visible.slice((page - 1) * pageSize, page * pageSize);

  const columns: Column<AdminUser>[] = [
    {
      key: "user", header: "Người dùng",
      cell: (u) => (
        <div className="min-w-0">
          <Link href={`/admin/users/${u.id}`} className="font-medium text-gray-800 hover:text-primary-600 hover:underline dark:text-dark-100">{u.name}</Link>
          <p className="truncate text-xs text-gray-400">{u.email}</p>
        </div>
      ),
    },
    { key: "title", header: "Chức danh", cell: (u) => <span className="text-gray-600 dark:text-dark-200">{u.title}</span> },
    { key: "dept", header: "Đơn vị", cell: (u) => <span className="text-gray-600 dark:text-dark-200">{u.department}</span> },
    { key: "roles", header: "Vai trò", cell: (u) => <div className="flex flex-wrap gap-1">{u.roleNames.map((r) => <Badge key={r} tone="info">{r}</Badge>)}</div> },
    { key: "status", header: "Trạng thái", cell: (u) => { const s = STATUS_META[u.status]; return <Badge tone={s?.tone ?? "neutral"}>{s?.label ?? u.status}</Badge>; } },
    { key: "act", header: "", align: "right", cell: (u) => <Link href={`/admin/users/${u.id}`} className="text-sm text-primary-600 hover:underline">Chi tiết →</Link> },
  ];

  const count = (s: string) => users.filter((u) => u.status === s).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Tổng thành viên" value={String(users.length)} icon="👥" tone="primary" />
        <StatCard label="Hoạt động" value={String(count("active"))} icon="✅" tone="success" />
        <StatCard label="Đã mời" value={String(count("invited"))} icon="✉️" tone="warning" />
        <StatCard label="Đã khoá" value={String(count("suspended"))} icon="🔒" tone="error" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[{ k: "all", l: "Tất cả" }, { k: "active", l: "Hoạt động" }, { k: "invited", l: "Đã mời" }, { k: "suspended", l: "Đã khoá" }].map((f) => (
          <button key={f.k} type="button" onClick={() => setStatus(f.k)} aria-pressed={status === f.k}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${status === f.k ? "border-primary-600 bg-primary-600 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-primary-300 dark:border-dark-600 dark:bg-dark-700 dark:text-dark-200"}`}>
            {f.l}
          </button>
        ))}
        <div className="relative ml-auto min-w-56 flex-1 sm:max-w-xs">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm tên, email, đơn vị" aria-label="Tìm người dùng"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-dark-600 dark:bg-dark-700 dark:text-dark-100" />
        </div>
        <button type="button" onClick={() => setInviteOpen(true)}
          className="rounded-lg bg-primary-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
          + Mời người dùng
        </button>
      </div>

      <SectionCard title={`Danh sách (${visible.length})`} bodyClassName="p-0">
        <DataTable columns={columns} rows={paged} rowKey={(u) => u.id} minWidthClass="min-w-[760px]"
          empty={<p className="text-sm text-gray-500">Không có người dùng khớp bộ lọc.</p>} />
        {visible.length > 0 ? (
          <Pagination page={page} pageSize={pageSize} total={visible.length} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        ) : null}
      </SectionCard>

      <InviteDrawer open={inviteOpen} onClose={() => setInviteOpen(false)} users={users} />
    </div>
  );
}

interface PendingInvite {
  personId: string;
  fullName?: string;
  email?: string;
  expiresAt: string;
  createdBy: string;
  createdAt: string;
}

// Real invite drawer (PH-00b): create a single-use INVITE for an existing
// account and SURFACE the activation link (internal `.local` accounts are not
// emailed). Lists outstanding invites via GET /api/auth/pending-invites.
function InviteDrawer({ open, onClose, users }: { open: boolean; onClose: () => void; users: AdminUser[] }) {
  const toast = useToast();
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [activationUrl, setActivationUrl] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  async function loadPending() {
    setLoadingPending(true);
    try {
      const res = await fetch("/api/auth/pending-invites", { cache: "no-store" });
      const data = await res.json().catch(() => []);
      setPending(Array.isArray(data) ? data : []);
    } catch {
      setPending([]);
    } finally {
      setLoadingPending(false);
    }
  }

  useEffect(() => {
    if (open) {
      setActivationUrl(null);
      void loadPending();
    }
  }, [open]);

  async function submit() {
    if (!userId) return;
    setSubmitting(true);
    setActivationUrl(null);
    try {
      const res = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.activationUrl) {
        toast.show(data?.detail?.message ?? "Tạo lời mời thất bại", "error");
        setSubmitting(false);
        return;
      }
      setActivationUrl(data.activationUrl as string);
      toast.show("Đã tạo lời mời — sao chép liên kết kích hoạt để gửi cho người dùng.", "success");
      await loadPending();
    } catch {
      toast.show("Không kết nối được máy chủ", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title="Tạo lời mời"
      description="Tạo liên kết kích hoạt một lần cho tài khoản đã có. Môi trường nội bộ (.local) KHÔNG gửi email — sao chép liên kết để chuyển cho người dùng."
      submitLabel="Tạo lời mời"
      submitting={submitting}
      submitDisabled={!userId}
      onSubmit={submit}
    >
      <FormSection title="Chọn tài khoản">
        <SelectField
          label="Người dùng"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          options={users.map((u) => ({ value: u.id, label: `${u.name}${u.email ? ` · ${u.email}` : ""}` }))}
        />
      </FormSection>

      {activationUrl && (
        <FormSection title="Liên kết kích hoạt (không gửi email)">
          <div className="flex items-center gap-2">
            <TextField readOnly value={activationUrl} onFocus={(e) => e.currentTarget.select()} className="flex-1" />
            <button
              type="button"
              onClick={() => { void navigator.clipboard?.writeText(activationUrl); toast.show("Đã sao chép liên kết", "info"); }}
              className="mt-6 shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-dark-500 dark:text-dark-100 dark:hover:bg-dark-600"
            >
              Sao chép
            </button>
          </div>
        </FormSection>
      )}

      <FormSection title={`Lời mời đang chờ (${pending.length})`}>
        {loadingPending ? (
          <p className="text-sm text-gray-400">Đang tải…</p>
        ) : pending.length === 0 ? (
          <p className="text-sm text-gray-400">Không có lời mời nào đang chờ.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-dark-600">
            {pending.map((p) => (
              <li key={p.personId} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-gray-700 dark:text-dark-100">{p.fullName ?? p.personId}</span>
                  <span className="block truncate text-xs text-gray-400">{p.email ?? p.personId}</span>
                </span>
                <span className="shrink-0 text-xs text-gray-400">Hết hạn {new Date(p.expiresAt).toLocaleDateString("vi-VN")}</span>
              </li>
            ))}
          </ul>
        )}
      </FormSection>
    </FormDrawer>
  );
}
