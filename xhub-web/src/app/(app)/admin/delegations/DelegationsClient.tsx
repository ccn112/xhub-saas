"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge, type Tone } from "@/xhub/ui/Badge";
import { DataTable, type Column } from "@/xhub/ui/DataTable";
import { FormDrawer, FormSection, TextField, SelectField, TextareaField } from "@/xhub/ui/form";
import { useToast } from "@/components/ui/Toast";
import { dateVN } from "@/xhub/lib/format";
import type { Delegation } from "@/features/tenant-admin/data";

const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Đang hiệu lực", tone: "success" },
  scheduled: { label: "Đã lên lịch", tone: "info" },
  expired: { label: "Hết hiệu lực", tone: "neutral" },
};

export function DelegationsClient({ delegations }: { delegations: Delegation[] }) {
  const [status, setStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const visible = useMemo(() => delegations.filter((d) => status === "all" || d.status === status), [delegations, status]);
  const conflicts = delegations.filter((d) => d.conflict);

  const columns: Column<Delegation>[] = [
    { key: "from", header: "Người uỷ quyền", cell: (d) => <span className="font-medium text-gray-800 dark:text-dark-100">{d.fromPerson}</span> },
    { key: "to", header: "Người được uỷ", cell: (d) => <span className="text-gray-700 dark:text-dark-100">{d.toPerson}</span> },
    { key: "scope", header: "Phạm vi", cell: (d) => <span className="text-gray-600 dark:text-dark-200">{d.scope}</span> },
    { key: "period", header: "Thời hạn", cell: (d) => <span className="text-xs text-gray-500 dark:text-dark-300">{dateVN(d.fromAt)} → {dateVN(d.toAt)}</span> },
    { key: "status", header: "Trạng thái", cell: (d) => (
      <div className="flex flex-col items-start gap-1">
        <Badge tone={STATUS_META[d.status]?.tone ?? "neutral"}>{STATUS_META[d.status]?.label ?? d.status}</Badge>
        {d.conflict ? <Badge tone="error">⚠ {d.conflict}</Badge> : null}
      </div>
    ) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Tổng uỷ quyền" value={String(delegations.length)} icon="🤝" tone="primary" />
        <StatCard label="Đang hiệu lực" value={String(delegations.filter((d) => d.status === "active").length)} icon="✅" tone="success" />
        <StatCard label="Đã lên lịch" value={String(delegations.filter((d) => d.status === "scheduled").length)} icon="📅" tone="info" />
        <StatCard label="Vi phạm guardrail" value={String(conflicts.length)} icon="⚠️" tone={conflicts.length ? "error" : "success"} />
      </div>

      {conflicts.length ? (
        <SectionCard accent="error" title="Cảnh báo guardrail">
          <ul className="space-y-1 text-sm">
            {conflicts.map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-error-darker dark:text-error-lighter">
                <Badge tone="error">{d.conflict}</Badge> {d.fromPerson} → {d.toPerson}: {d.reason}
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {[{ k: "all", l: "Tất cả" }, { k: "active", l: "Đang hiệu lực" }, { k: "scheduled", l: "Đã lên lịch" }, { k: "expired", l: "Hết hiệu lực" }].map((f) => (
          <button key={f.k} type="button" onClick={() => setStatus(f.k)} aria-pressed={status === f.k}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${status === f.k ? "border-primary-600 bg-primary-600 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-primary-300 dark:border-dark-600 dark:bg-dark-700 dark:text-dark-200"}`}>
            {f.l}
          </button>
        ))}
        <button type="button" onClick={() => setCreateOpen(true)} className="ml-auto rounded-lg bg-primary-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">+ Tạo uỷ quyền</button>
      </div>

      <SectionCard title={`Danh sách (${visible.length})`} bodyClassName="p-0">
        <DataTable columns={columns} rows={visible} rowKey={(d) => d.id} minWidthClass="min-w-[720px]" />
      </SectionCard>

      <CreateDelegationDrawer open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function CreateDelegationDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [fromUserId, setFromUserId] = useState("");
  const [toUserId, setToUserId] = useState("");
  const [scope, setScope] = useState("Phê duyệt mua sắm");
  const [fromAt, setFromAt] = useState("");
  const [toAt, setToAt] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/identity/delegations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fromUserId: fromUserId.trim(),
          toUserId: toUserId.trim(),
          fromAt: fromAt ? new Date(fromAt).toISOString() : null,
          toAt: toAt ? new Date(toAt).toISOString() : null,
          reason: reason.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Surface the backend guardrails (self / overlap / cycle) in Vietnamese.
        const backendMsg: string | undefined = data?.detail?.message;
        let msg = backendMsg ?? "Uỷ quyền bị từ chối.";
        if (res.status === 502) msg = "Backend chưa sẵn — uỷ quyền KHÔNG được lưu.";
        else if (backendMsg?.includes("SELF_DELEGATION")) msg = "Không thể tự uỷ quyền cho chính mình (guardrail).";
        else if (backendMsg?.includes("OVERLAP")) msg = "Uỷ quyền chồng lấn thời gian với một uỷ quyền đang có của người này.";
        else if (backendMsg?.includes("CYCLE")) msg = "Uỷ quyền vòng lặp: hai người đang uỷ quyền qua lại trong cùng khoảng thời gian.";
        toast.show(msg, res.status === 502 ? "info" : "error");
        return;
      }
      toast.show(`Đã tạo uỷ quyền ${fromUserId.trim()} → ${toUserId.trim()}.`, "success");
      setFromUserId(""); setToUserId(""); setReason("");
      onClose();
      router.refresh();
    } catch {
      toast.show("Không kết nối được backend — uỷ quyền KHÔNG được lưu.", "info");
    } finally {
      setSubmitting(false);
    }
  }

  const selfDelegate = fromUserId.trim() && fromUserId.trim() === toUserId.trim();

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title="Tạo uỷ quyền"
      description="Uỷ quyền phê duyệt theo phạm vi và thời hạn. Guardrail: không tự uỷ quyền, không vòng lặp."
      submitLabel="Tạo uỷ quyền"
      submitting={submitting}
      submitDisabled={!fromUserId.trim() || !toUserId.trim() || !fromAt || !toAt || Boolean(selfDelegate)}
      onSubmit={submit}
    >
      <FormSection title="Các bên">
        <TextField label="Người uỷ quyền (userId)" required value={fromUserId} onChange={(e) => setFromUserId(e.target.value)} placeholder="vd: usr-sales-head"
          error={selfDelegate ? "Không thể tự uỷ quyền cho chính mình (guardrail)." : undefined} />
        <TextField label="Người được uỷ (userId)" required value={toUserId} onChange={(e) => setToUserId(e.target.value)} placeholder="vd: usr-sales-01" />
      </FormSection>
      <FormSection title="Phạm vi & thời hạn">
        <SelectField label="Phạm vi" value={scope} onChange={(e) => setScope(e.target.value)}
          options={["Phê duyệt mua sắm", "Phê duyệt nghỉ phép", "Phê duyệt chi", "Toàn quyền phòng ban"].map((v) => ({ value: v, label: v }))} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Từ ngày" type="date" required value={fromAt} onChange={(e) => setFromAt(e.target.value)} />
          <TextField label="Đến ngày" type="date" required value={toAt} onChange={(e) => setToAt(e.target.value)} />
        </div>
        <TextareaField label="Lý do" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="vd: Trưởng phòng đi công tác 2 tuần" />
      </FormSection>
    </FormDrawer>
  );
}
