"use client";

import { useState } from "react";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";

interface Candidate { code: string; name: string; person: string; orgUnit: string }
interface WorkflowSelector { code: string; name: string; nodes: { id: string; name: string; type: string }[] }
interface LivePreview {
  workflowCode: string; nodeId: string; nodeName?: string;
  selector?: { selectorType?: string; roleCode?: string } | null;
  candidates?: { personId: string; fullName: string; via: string }[];
  resolvedPersonId?: string | null; reason?: string; note?: string; error?: string;
}

const REQUESTERS = ["Trần Thu Hà (Trưởng phòng Kinh doanh)", "Lê Thùy Linh (Chuyên viên Kinh doanh)"];

// Deterministic escalation chain by amount threshold (demo resolver v2 preview).
function resolve(amount: number): { chain: { role: string; person: string; reason: string }[]; excluded: { person: string; reason: string }[] } {
  const chain = [
    { role: "TP Kinh doanh", person: "Trần Thu Hà", reason: "Trưởng đơn vị của người đề nghị" },
  ];
  if (amount >= 50_000_000) chain.push({ role: "TP Công nghệ", person: "Phạm Anh Khoa", reason: "Đồng duyệt kỹ thuật cho mua sắm CNTT" });
  if (amount >= 100_000_000) chain.push({ role: "CFO", person: "Nguyễn Hoài Nam", reason: "Ngưỡng tài chính ≥ 100tr" });
  if (amount >= 200_000_000) chain.push({ role: "TGĐ", person: "Trần Mạnh Tuấn", reason: "Ngưỡng phê duyệt cuối ≥ 200tr" });
  const excluded = [
    { person: "Lê Minh Anh (KT thanh toán)", reason: "Không đủ thẩm quyền ngưỡng này" },
    { person: "Trần Thu Hà", reason: "Là người đề nghị — loại khỏi bước duyệt cao hơn (tránh tự duyệt)" },
  ];
  return { chain, excluded };
}

export function ResolverClient({ candidates, workflows = [], live = false }: { candidates: Candidate[]; workflows?: WorkflowSelector[]; live?: boolean }) {
  const [requester, setRequester] = useState(REQUESTERS[0]);
  const [amount, setAmount] = useState(250_000_000);
  const [type, setType] = useState("Đề nghị mua sắm");
  const [result, setResult] = useState<ReturnType<typeof resolve> | null>(null);

  const run = () => setResult(resolve(amount));

  // ---- live preview state (real workflow nodes → assignment/preview) --------
  const [wfCode, setWfCode] = useState(workflows[0]?.code ?? "");
  const wf = workflows.find((w) => w.code === wfCode) ?? workflows[0];
  const [nodeId, setNodeId] = useState(wf?.nodes[0]?.id ?? "");
  const [preview, setPreview] = useState<LivePreview | null>(null);
  const [busy, setBusy] = useState(false);

  async function runLive() {
    if (!wfCode || !nodeId) return;
    setBusy(true); setPreview(null);
    try {
      const res = await fetch("/api/admin/assignment-preview", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ workflowCode: wfCode, nodeId }),
      });
      if (res.ok) setPreview(await res.json());
    } catch { /* keep demo simulator */ } finally { setBusy(false); }
  }

  const snapshot = result
    ? {
        correlationId: "corr-sim-001",
        idempotencyKey: "sim-" + amount,
        context: { requester, type, amount, currency: "VND", tenantId: "tenant-xtech" },
        resolvedAt: "2026-08-08T11:45:00+07:00",
        policyVersion: "assignment@v2",
        candidates: candidates.slice(0, 5).map((c) => ({ position: c.code, person: c.person })),
        chain: result.chain,
        excluded: result.excluded,
        selectedApprover: result.chain[result.chain.length - 1],
      }
    : null;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      {live && wf ? (
        <SectionCard accent="info" title="Preview trực tiếp (workflow thật)">
          <div className="space-y-3 text-sm">
            <label className="block"><span className="mb-1 block font-medium text-gray-700 dark:text-dark-100">Quy trình</span>
              <select value={wfCode} onChange={(e) => { setWfCode(e.target.value); const nw = workflows.find((w) => w.code === e.target.value); setNodeId(nw?.nodes[0]?.id ?? ""); setPreview(null); }} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-dark-600 dark:bg-dark-600 dark:text-dark-100">
                {workflows.map((w) => <option key={w.code} value={w.code}>{w.code} · {w.name}</option>)}
              </select></label>
            <label className="block"><span className="mb-1 block font-medium text-gray-700 dark:text-dark-100">Bước duyệt</span>
              <select value={nodeId} onChange={(e) => { setNodeId(e.target.value); setPreview(null); }} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-dark-600 dark:bg-dark-600 dark:text-dark-100">
                {wf.nodes.map((n) => <option key={n.id} value={n.id}>{n.name} ({n.id})</option>)}
              </select></label>
            <button type="button" onClick={runLive} disabled={busy} className="w-full rounded-lg bg-primary-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">{busy ? "Đang giải…" : "Ai sẽ duyệt?"}</button>
            {preview ? (
              preview.error ? (
                <p className="rounded-lg bg-error/10 px-3 py-2 text-xs text-error-darker dark:text-error-lighter">{preview.error}</p>
              ) : (
                <div className="rounded-lg border border-gray-200 p-3 dark:border-dark-600">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium text-gray-700 dark:text-dark-100">{preview.nodeName ?? preview.nodeId}</span>
                    <Badge tone="info">{preview.selector?.selectorType ?? "—"}</Badge>
                  </div>
                  <ul className="space-y-1 text-xs text-gray-500 dark:text-dark-300">
                    {(preview.candidates ?? []).map((c) => (
                      <li key={c.personId}>• <span className="font-medium text-gray-700 dark:text-dark-100">{c.fullName}</span> — {c.via}</li>
                    ))}
                    {!preview.candidates?.length ? <li>Không có ứng viên. {preview.note}</li> : null}
                    <li className="pt-1">Lý do: {preview.reason ?? preview.note ?? "—"}</li>
                  </ul>
                </div>
              )
            ) : null}
          </div>
        </SectionCard>
      ) : null}
      <SectionCard accent="neutral" title={live ? "Ngữ cảnh mô phỏng (demo theo ngưỡng)" : "Ngữ cảnh mô phỏng"}>
        <div className="space-y-3 text-sm">
          <label className="block"><span className="mb-1 block font-medium text-gray-700 dark:text-dark-100">Người đề nghị</span>
            <select value={requester} onChange={(e) => setRequester(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-dark-600 dark:bg-dark-600 dark:text-dark-100">{REQUESTERS.map((r) => <option key={r}>{r}</option>)}</select></label>
          <label className="block"><span className="mb-1 block font-medium text-gray-700 dark:text-dark-100">Loại yêu cầu</span>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-dark-600 dark:bg-dark-600 dark:text-dark-100"><option>Đề nghị mua sắm</option><option>Duyệt báo giá</option><option>Duyệt hợp đồng</option></select></label>
          <label className="block"><span className="mb-1 block font-medium text-gray-700 dark:text-dark-100">Giá trị (VND)</span>
            <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} step={10_000_000} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-dark-600 dark:bg-dark-600 dark:text-dark-100" /></label>
          <button type="button" onClick={run} className="w-full rounded-lg bg-primary-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">Chạy resolver</button>
        </div>
      </SectionCard>

      <div className="space-y-4 xl:col-span-2">
        {result ? (
          <>
            <SectionCard title="Chuỗi phê duyệt (resolution)">
              <ol className="space-y-3">
                {result.chain.map((s, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">{i + 1}</span>
                    <div><p className="font-medium text-gray-800 dark:text-dark-100">{s.person} <span className="text-xs text-gray-400">· {s.role}</span></p><p className="text-xs text-gray-500 dark:text-dark-300">{s.reason}</p></div>
                  </li>
                ))}
              </ol>
              <div className="mt-3 rounded-lg bg-success/10 px-3 py-2 text-sm text-success-darker dark:text-success-lighter">
                Người duyệt cuối: <strong>{result.chain[result.chain.length - 1].person}</strong> ({result.chain[result.chain.length - 1].role})
              </div>
            </SectionCard>

            <SectionCard accent="neutral" title="Ứng viên bị loại & lý do">
              <ul className="space-y-2 text-sm">
                {result.excluded.map((e, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 dark:border-dark-600">
                    <span className="text-gray-700 dark:text-dark-100">{e.person}</span><Badge tone="neutral">{e.reason}</Badge>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard accent="neutral" title="Assignment Resolution Snapshot (JSON)" bodyClassName="p-0">
              <pre className="max-h-96 overflow-auto rounded-b-lg bg-gray-900 p-4 text-xs leading-relaxed text-gray-100">{JSON.stringify(snapshot, null, 2)}</pre>
            </SectionCard>
          </>
        ) : (
          <SectionCard title="Kết quả">
            <p className="text-sm text-gray-500 dark:text-dark-300">Nhập ngữ cảnh và bấm “Chạy resolver” để xem chuỗi phê duyệt, ứng viên bị loại và snapshot JSON.</p>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
