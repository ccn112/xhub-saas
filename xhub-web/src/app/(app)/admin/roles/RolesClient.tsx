"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { FormDrawer, FormSection, SelectField, TextField } from "@/xhub/ui/form";
import { useToast } from "@/components/ui/Toast";
import type { RoleCatalogEntry } from "@/features/tenant-admin/data";

interface PreviewResult { rolePermissions: string[]; willAdd: string[]; alreadyHas: string[]; noNetChange: boolean }

type Cell = "allow" | "deny" | "none";

export function RolesClient({ roles, allPermissions }: { roles: RoleCatalogEntry[]; allPermissions: string[] }) {
  const [selected, setSelected] = useState<string>(roles[0]?.code ?? "");
  const role = roles.find((r) => r.code === selected) ?? roles[0];
  const [bindOpen, setBindOpen] = useState(false);

  const cellFor = (r: RoleCatalogEntry, perm: string): Cell =>
    r.permissions.includes(perm) ? "allow" : r.restricted.includes(perm) ? "deny" : "none";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Vai trò" value={String(roles.length)} icon="🔑" tone="primary" />
        <StatCard label="Quyền theo dõi" value={String(allPermissions.length)} icon="🧩" tone="info" />
        <StatCard label="Quyền hạn chế" value={String(new Set(roles.flatMap((r) => r.restricted)).size)} icon="🚫" tone="error" />
        <StatCard label="Có toàn quyền" value="0" sub="không role nào là superadmin" icon="🛡️" tone="success" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-2">
          {roles.map((r) => (
            <button key={r.code} type="button" onClick={() => setSelected(r.code)} aria-pressed={r.code === selected}
              className={`w-full rounded-lg border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${r.code === selected ? "border-primary-500 bg-primary-50/60 dark:border-primary-700 dark:bg-primary-950/30" : "border-gray-200 hover:border-primary-300 dark:border-dark-600"}`}>
              <p className="font-medium text-gray-800 dark:text-dark-100">{r.name}</p>
              <p className="text-xs text-gray-400">{r.code}</p>
              <div className="mt-2 flex gap-1"><Badge tone="success">{r.permissions.length} cho phép</Badge><Badge tone="error">{r.restricted.length} hạn chế</Badge></div>
            </button>
          ))}
        </div>

        <div className="xl:col-span-2">
          {role ? (
            <SectionCard title={`Ràng buộc & quyền · ${role.name}`}
              action={<button type="button" onClick={() => setBindOpen(true)} className="text-sm text-primary-600 hover:underline">+ Gán vai trò</button>}>
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-medium uppercase text-gray-400">Quyền được cấp</p>
                  <div className="flex flex-wrap gap-1">{role.permissions.map((p) => <Badge key={p} tone="success">{p}</Badge>)}</div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase text-gray-400">Quyền bị hạn chế (guardrail)</p>
                  <div className="flex flex-wrap gap-1">{role.restricted.map((p) => <Badge key={p} tone="error">{p}</Badge>)}</div>
                </div>
              </div>
              <p className="rounded-lg bg-info/10 px-3 py-2 text-xs text-info-darker dark:text-info-lighter">
                Nguồn quyền hiệu lực: trực tiếp (role) · kế thừa (đơn vị) · theo vị trí · uỷ quyền · giao với phạm vi dữ liệu.
              </p>
            </SectionCard>
          ) : null}
        </div>
      </div>

      <SectionCard title="Ma trận quyền hiệu lực" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase text-gray-400 dark:bg-dark-750 dark:text-dark-300">
              <tr>
                <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 dark:bg-dark-750">Quyền</th>
                {roles.map((r) => <th key={r.code} className="px-3 py-3 text-center font-medium">{r.code}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-dark-600">
              {allPermissions.map((perm) => (
                <tr key={perm} className="hover:bg-gray-50 dark:hover:bg-dark-600/40">
                  <td className="sticky left-0 z-10 bg-white px-4 py-2 font-mono text-xs text-gray-700 dark:bg-dark-700 dark:text-dark-100">{perm}</td>
                  {roles.map((r) => {
                    const c = cellFor(r, perm);
                    return (
                      <td key={r.code} className="px-3 py-2 text-center">
                        {c === "allow" ? <span title="Cho phép" className="text-success">✓</span>
                          : c === "deny" ? <span title="Hạn chế" className="text-error">✕</span>
                          : <span className="text-gray-300 dark:text-dark-500">·</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-4 border-t border-gray-200 px-4 py-3 text-xs text-gray-500 dark:border-dark-600 dark:text-dark-300">
          <span><span className="text-success">✓</span> Cho phép</span>
          <span><span className="text-error">✕</span> Bị hạn chế (guardrail)</span>
          <span><span className="text-gray-300">·</span> Không áp dụng</span>
        </div>
      </SectionCard>

      {role ? <BindDrawer open={bindOpen} onClose={() => setBindOpen(false)} role={role} /> : null}
    </div>
  );
}

function BindDrawer({ open, onClose, role }: { open: boolean; onClose: () => void; role: RoleCatalogEntry }) {
  const toast = useToast();
  const router = useRouter();
  const [subjectType, setSubjectType] = useState("USER");
  const [subjectId, setSubjectId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  async function runPreview() {
    if (!subjectId.trim()) return;
    setPreviewing(true);
    setPreview(null);
    try {
      const res = await fetch("/api/admin/identity/role-bindings/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subjectId: subjectId.trim(), roleCode: role.code }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.show(res.status === 502 ? "Backend chưa sẵn — không xem trước được." : (data?.detail?.message ?? "Không xem trước được tác động."), res.status === 502 ? "info" : "error");
        return;
      }
      setPreview(data as PreviewResult);
    } catch {
      toast.show("Không kết nối được backend để xem trước.", "info");
    } finally {
      setPreviewing(false);
    }
  }

  async function submit() {
    if (!subjectId.trim()) { toast.show("Nhập mã đối tượng (subjectId) trước khi ràng buộc.", "error"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/identity/role-bindings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subjectType, subjectId: subjectId.trim(), roleCode: role.code }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = res.status === 502 ? "Backend chưa sẵn — ràng buộc KHÔNG được lưu." : (data?.detail?.message ?? "Ràng buộc bị từ chối.");
        toast.show(msg, res.status === 502 ? "info" : "error");
        return;
      }
      toast.show(`Đã gán vai trò ${role.name} cho ${subjectId.trim()}.`, "success");
      setSubjectId("");
      setPreview(null);
      onClose();
      router.refresh();
    } catch {
      toast.show("Không kết nối được backend — ràng buộc KHÔNG được lưu.", "info");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title={`Gán vai trò · ${role.name}`}
      description="Ràng buộc vai trò cho một đối tượng (người dùng / vị trí / đơn vị / nhóm)."
      submitLabel="Xác nhận ràng buộc"
      submitting={submitting}
      submitDisabled={!subjectId.trim()}
      onSubmit={submit}
    >
      <FormSection title="Đối tượng ràng buộc">
        <SelectField label="Loại đối tượng" value={subjectType} onChange={(e) => { setSubjectType(e.target.value); setPreview(null); }}
          options={[
            { value: "USER", label: "USER — người dùng cụ thể" },
            { value: "POSITION", label: "POSITION — vị trí" },
            { value: "ORG_UNIT", label: "ORG_UNIT — đơn vị" },
            { value: "GROUP", label: "GROUP — nhóm" },
          ]} />
        <TextField label="Mã đối tượng (subjectId)" required value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setPreview(null); }}
          placeholder="vd: usr-sales-01 / pos-sales-01" />
      </FormSection>
      <FormSection title="Xem trước tác động">
        <div className="space-y-2">
          <button type="button" onClick={runPreview} disabled={!subjectId.trim() || previewing}
            className="rounded-lg border border-primary-300 px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 disabled:opacity-50 dark:border-primary-700 dark:hover:bg-primary-950/30">
            {previewing ? "Đang tính…" : "Xem trước tác động"}
          </button>
          {preview ? (
            <div className="rounded-lg border border-gray-200 p-3 text-sm dark:border-dark-600">
              {preview.noNetChange
                ? <p className="text-gray-600 dark:text-dark-200">Đối tượng đã có đủ mọi quyền của vai trò này — ràng buộc không thêm quyền mới.</p>
                : <p className="text-gray-700 dark:text-dark-100">Sẽ <b>thêm {preview.willAdd.length}</b> quyền mới; đã có sẵn {preview.alreadyHas.length}/{preview.rolePermissions.length} quyền của vai trò.</p>}
              {preview.willAdd.length ? <div className="mt-2 flex flex-wrap gap-1">{preview.willAdd.map((p) => <Badge key={p} tone="success">+ {p}</Badge>)}</div> : null}
              {preview.alreadyHas.length ? <div className="mt-2 flex flex-wrap gap-1">{preview.alreadyHas.map((p) => <Badge key={p} tone="neutral">{p}</Badge>)}</div> : null}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-gray-200 p-3 text-xs text-gray-500 dark:border-dark-600 dark:text-dark-300">Vai trò cấp {role.permissions.length} quyền theo danh mục. Bấm “Xem trước tác động” để so quyền hiệu lực của đối tượng.</p>
          )}
        </div>
      </FormSection>
    </FormDrawer>
  );
}
