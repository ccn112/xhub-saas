"use client";

import { useState } from "react";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import type { DataScope } from "@/features/tenant-admin/data";

interface SimUser { id: string; name: string; department: string; roleNames: string[] }

const RESOURCES = ["Khách hàng Minh Phát", "Hợp đồng FinERP", "Ticket #2201 (Hỗ trợ)", "Báo cáo tài chính Q3", "Dự án FinERP Minh Phát"];
// Permissions offered to the live RBAC/ABAC check (POST /api/identity/permissions/check).
const TEST_PERMISSIONS = ["request.approve", "workflow.read", "tenant.read", "backup.read", "audit.read"];

interface LiveResult { allowed: boolean; reason: string; effective?: { roles?: string[]; permissions?: string[]; scopes?: unknown[] } }

export function DataScopesClient({ scopes, users, live = false }: { scopes: DataScope[]; users: SimUser[]; live?: boolean }) {
  const [testUser, setTestUser] = useState(users[0]?.id ?? "");
  const [resource, setResource] = useState(RESOURCES[0]);
  const [permission, setPermission] = useState(TEST_PERMISSIONS[0]);
  const [ran, setRan] = useState(false);
  const [liveResult, setLiveResult] = useState<LiveResult | null>(null);
  const [busy, setBusy] = useState(false);
  const user = users.find((u) => u.id === testUser);

  // Deterministic demo evaluation (fallback when backend is down): allow if user
  // has a matching scope dimension by simple heuristic; shows the reasoning chain.
  const matchedScope = scopes.find((s) =>
    (s.dimension === "org_unit" && user?.department?.includes("Kinh doanh") && s.values.includes("SALES")) ||
    (s.dimension === "org_unit" && user?.department?.includes("Hỗ trợ") && s.values.includes("SUPPORT")) ||
    (s.dimension === "tenant"));
  const allowed = Boolean(matchedScope) && !resource.includes("tài chính") ? true : Boolean(matchedScope && resource.includes("tài chính") && user?.roleNames.some((r) => r.includes("Tài chính") || r.includes("Quản trị")));

  async function runTest() {
    setRan(true);
    setLiveResult(null);
    if (!live) return; // demo heuristic below
    setBusy(true);
    try {
      const res = await fetch("/api/admin/permission-check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: testUser, permission }),
      });
      if (res.ok) setLiveResult(await res.json());
    } catch { /* falls back to demo view */ } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Phạm vi" value={String(scopes.length)} icon="🗂️" tone="primary" />
        <StatCard label="Chiều dữ liệu" value={String(new Set(scopes.map((s) => s.dimension)).size)} icon="📐" tone="info" />
        <StatCard label="Vai trò gắn" value={String(new Set(scopes.map((s) => s.boundRole)).size)} icon="🔑" tone="neutral" />
        <StatCard label="Xung đột" value="0" icon="⚠️" tone="success" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          <SectionCard title="Danh mục phạm vi" bodyClassName="p-0">
            <ul className="divide-y divide-gray-100 dark:divide-dark-600">
              {scopes.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 dark:text-dark-100">{s.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-gray-500 dark:text-dark-300">{s.dimension} {s.operator} [{s.values.join(", ")}]</p>
                    {s.note ? <p className="mt-0.5 text-xs text-gray-400">{s.note}</p> : null}
                  </div>
                  <Badge tone="info">{s.boundRole}</Badge>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard accent="neutral" title="Trình dựng phạm vi (scope builder)">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block text-sm"><span className="mb-1 block font-medium text-gray-700 dark:text-dark-100">Chiều</span>
                <select className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-dark-600 dark:bg-dark-600 dark:text-dark-100"><option>org_unit</option><option>project</option><option>customer</option><option>tenant</option></select></label>
              <label className="block text-sm"><span className="mb-1 block font-medium text-gray-700 dark:text-dark-100">Toán tử</span>
                <select className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-dark-600 dark:bg-dark-600 dark:text-dark-100"><option>IN</option><option>EQ</option><option>NOT_IN</option></select></label>
              <label className="block text-sm"><span className="mb-1 block font-medium text-gray-700 dark:text-dark-100">Giá trị</span>
                <input className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-dark-600 dark:bg-dark-600 dark:text-dark-100" placeholder="SALES, SOLUTION" /></label>
            </div>
            <button type="button" disabled title="Cần BFF data-scopes" className="mt-3 cursor-not-allowed rounded-lg bg-primary-600/50 px-3.5 py-2 text-sm font-medium text-white">Xem trước phạm vi</button>
          </SectionCard>
        </div>

        <SectionCard accent="info" title="Kiểm tra như người dùng">
          <div className="space-y-3 text-sm">
            <label className="block"><span className="mb-1 block font-medium text-gray-700 dark:text-dark-100">Người dùng</span>
              <select value={testUser} onChange={(e) => { setTestUser(e.target.value); setRan(false); }} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-dark-600 dark:bg-dark-600 dark:text-dark-100">
                {users.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.department}</option>)}
              </select></label>
            {live ? (
              <label className="block"><span className="mb-1 block font-medium text-gray-700 dark:text-dark-100">Quyền cần kiểm tra</span>
                <select value={permission} onChange={(e) => { setPermission(e.target.value); setRan(false); }} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-xs dark:border-dark-600 dark:bg-dark-600 dark:text-dark-100">
                  {TEST_PERMISSIONS.map((p) => <option key={p}>{p}</option>)}
                </select></label>
            ) : (
              <label className="block"><span className="mb-1 block font-medium text-gray-700 dark:text-dark-100">Tài nguyên</span>
                <select value={resource} onChange={(e) => { setResource(e.target.value); setRan(false); }} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-dark-600 dark:bg-dark-600 dark:text-dark-100">
                  {RESOURCES.map((r) => <option key={r}>{r}</option>)}
                </select></label>
            )}
            <button type="button" onClick={runTest} disabled={busy} className="w-full rounded-lg bg-primary-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">{busy ? "Đang kiểm tra…" : "Chạy kiểm tra"}</button>

            {ran && live && liveResult ? (
              <div className="rounded-lg border border-gray-200 p-3 dark:border-dark-600">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium text-gray-700 dark:text-dark-100">Kết quả trực tiếp</span>
                  <Badge tone={liveResult.allowed ? "success" : "error"}>{liveResult.allowed ? "CHO PHÉP" : "TỪ CHỐI"}</Badge>
                </div>
                <ul className="space-y-1 text-xs text-gray-500 dark:text-dark-300">
                  <li>• Quyền: <span className="font-mono">{permission}</span></li>
                  <li>• Vai trò hiệu lực: {liveResult.effective?.roles?.join(", ") || "—"}</li>
                  <li>• Số quyền hiệu lực: {liveResult.effective?.permissions?.length ?? 0}</li>
                  <li>• Phạm vi (scope): {liveResult.effective?.scopes?.length ?? 0}</li>
                  <li>• Lý do: {liveResult.reason}</li>
                </ul>
              </div>
            ) : ran ? (
              <div className="rounded-lg border border-gray-200 p-3 dark:border-dark-600">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium text-gray-700 dark:text-dark-100">Kết quả {live ? "(demo — backend lỗi)" : "(demo)"}</span>
                  <Badge tone={allowed ? "success" : "error"}>{allowed ? "CHO PHÉP" : "TỪ CHỐI"}</Badge>
                </div>
                <ul className="space-y-1 text-xs text-gray-500 dark:text-dark-300">
                  <li>• Vai trò: {user?.roleNames.join(", ") || "—"}</li>
                  <li>• Phiên bản policy: policy@v3</li>
                  <li>• Phạm vi khớp: {matchedScope?.name ?? "không có phạm vi khớp"}</li>
                  <li>• Điều kiện thất bại: {allowed ? "không" : "chiều dữ liệu không bao phủ tài nguyên"}</li>
                  <li>• Uỷ quyền áp dụng: không</li>
                </ul>
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
