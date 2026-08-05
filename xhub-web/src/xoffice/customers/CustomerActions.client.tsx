"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CUSTOMER_STATUS_LABEL } from "@/xoffice/lib/customers-data";

const STATUSES = ["PROSPECT", "ACTIVE", "INACTIVE", "BLOCKED"] as const;
const CHANNELS = ["EMAIL", "SMS", "CALL", "ZALO"] as const;

/**
 * Interactive actions on the Customer 360 page (Phase 2, BO-0201): change
 * status, add a contact. POSTs through the existing /api/customers/[[...path]]
 * proxy, then router.refresh() to re-pull server data — same pattern as
 * TestCaseTable.client.tsx in the Engineering Hub.
 */
export function CustomerActions({ customerId, currentStatus }: { customerId: string; currentStatus: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [form, setForm] = useState({ displayName: "", role: "", email: "", phone: "" });
  const [channels, setChannels] = useState<string[]>([]);

  async function setStatus(status: string) {
    setPending(true);
    try {
      await fetch(`/api/customers/${customerId}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function submitContact() {
    if (!form.displayName.trim()) return;
    setPending(true);
    try {
      await fetch(`/api/customers/${customerId}/contacts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, contactPreference: channels, isPrimary: false }),
      });
      setForm({ displayName: "", role: "", email: "", phone: "" });
      setChannels([]);
      setShowAddContact(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-gray-400">Trạng thái:</span>
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending || s === currentStatus}
            onClick={() => setStatus(s)}
            className={`rounded-full border px-2.5 py-1 text-xs disabled:cursor-default ${s === currentStatus ? "border-primary-500 bg-primary-50 font-medium text-primary-700 dark:bg-primary-500/10 dark:text-primary-300" : "border-gray-200 text-gray-500 hover:border-gray-300 dark:border-dark-600 dark:text-dark-300"}`}
          >
            {CUSTOMER_STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {!showAddContact ? (
        <button
          type="button"
          onClick={() => setShowAddContact(true)}
          className="rounded-full border border-primary-300 px-3 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 dark:border-primary-500/40 dark:text-primary-400 dark:hover:bg-primary-500/10"
        >
          + Thêm liên hệ
        </button>
      ) : (
        <div className="rounded-lg border border-gray-200 p-3 text-sm dark:border-dark-600">
          <div className="grid gap-2 sm:grid-cols-2">
            <input placeholder="Họ tên *" value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} className="rounded border border-gray-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-800" />
            <input placeholder="Chức danh" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="rounded border border-gray-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-800" />
            <input placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="rounded border border-gray-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-800" />
            <input placeholder="Điện thoại" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="rounded border border-gray-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-800" />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-400">Kênh liên hệ:</span>
            {CHANNELS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setChannels((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))}
                className={`rounded-full border px-2 py-0.5 text-xs ${channels.includes(c) ? "border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300" : "border-gray-200 text-gray-500 dark:border-dark-600 dark:text-dark-300"}`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={pending || !form.displayName.trim()} onClick={submitContact} className="rounded-full bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-40">
              {pending ? "Đang lưu…" : "Lưu liên hệ"}
            </button>
            <button type="button" onClick={() => setShowAddContact(false)} className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-500 dark:border-dark-600 dark:text-dark-300">
              Huỷ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
