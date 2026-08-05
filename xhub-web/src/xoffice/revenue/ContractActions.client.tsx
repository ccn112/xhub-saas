"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CONTRACT_STATUS_LABEL } from "@/xoffice/lib/revenue-data";

const STATUSES = ["DRAFT", "REVIEW", "NEGOTIATION", "APPROVED", "SIGNING", "EFFECTIVE", "SUSPENDED", "TERMINATED", "COMPLETED", "EXPIRED"] as const;

/** Contract status-transition + e-signature actions (Phase 2, BO-0206/0207). */
export function ContractStatusActions({ contractId, currentStatus }: { contractId: string; currentStatus: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function setStatus(status: string) {
    setPending(true);
    try {
      await fetch(`/api/contracts/${contractId}/status`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function sign() {
    setPending(true);
    try {
      await fetch(`/api/contracts/${contractId}/sign`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-gray-400">Trạng thái:</span>
      {STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          disabled={pending || s === currentStatus}
          onClick={() => setStatus(s)}
          className={`rounded-full border px-2.5 py-1 text-xs disabled:cursor-default disabled:opacity-40 ${s === currentStatus ? "border-primary-500 bg-primary-50 font-medium text-primary-700 dark:bg-primary-500/10 dark:text-primary-300" : "border-gray-200 text-gray-500 hover:border-gray-300 dark:border-dark-600 dark:text-dark-300"}`}
        >
          {CONTRACT_STATUS_LABEL[s]}
        </button>
      ))}
      {['APPROVED', 'SIGNING'].includes(currentStatus) ? (
        <button type="button" disabled={pending} onClick={sign} className="rounded-full bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-40">
          Ký hợp đồng (mock)
        </button>
      ) : null}
    </div>
  );
}

/** Obligation complete/escalate + billing-request generation (BO-0208). */
export function ObligationActions({ obligationId, status }: { obligationId: string; status: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [evidence, setEvidence] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function complete() {
    if (!evidence.trim()) return;
    setPending(true);
    try {
      await fetch(`/api/contracts/obligations/${obligationId}/complete`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ evidenceRef: evidence }) });
      setShowForm(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function escalate() {
    setPending(true);
    try {
      await fetch(`/api/contracts/obligations/${obligationId}/escalate`, { method: 'POST' });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function generateBilling() {
    setPending(true);
    try {
      await fetch(`/api/contracts/obligations/${obligationId}/billing-request`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idempotencyKey: `ui-${obligationId}-${Date.now()}` }),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (status === 'COMPLETED') {
    return (
      <button type="button" disabled={pending} onClick={generateBilling} className="rounded-full border border-primary-300 px-2.5 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 dark:border-primary-500/40 dark:text-primary-400 dark:hover:bg-primary-500/10">
        Tạo yêu cầu xuất hoá đơn
      </button>
    );
  }
  if (status !== 'PENDING') return null;

  return showForm ? (
    <div className="flex items-center gap-1.5">
      <input value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Bằng chứng hoàn thành" className="rounded border border-gray-200 px-2 py-1 text-xs dark:border-dark-600 dark:bg-dark-800" />
      <button type="button" disabled={pending || !evidence.trim()} onClick={complete} className="rounded-full bg-primary-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-40">Lưu</button>
      <button type="button" onClick={() => setShowForm(false)} className="text-xs text-gray-400">Huỷ</button>
    </div>
  ) : (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => setShowForm(true)} className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:border-gray-300 dark:border-dark-600 dark:text-dark-300">Hoàn thành</button>
      <button type="button" disabled={pending} onClick={escalate} className="rounded-full border border-amber-300 px-2.5 py-1 text-xs text-amber-600 hover:bg-amber-50 dark:border-amber-500/40 dark:text-amber-400">Báo cáo trễ hạn</button>
    </div>
  );
}
