"use client";

import { useState } from "react";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import { DefRow } from "@/features/tenant-admin/AdminHeader";
import { dateTimeVN } from "@/xhub/lib/format";
import { initials } from "@/xhub/lib/repo";
import type { AdminUser, DataScope, AuditEvent } from "@/features/tenant-admin/data";

const TABS = [
  { key: "membership", label: "Thành viên & vai trò" },
  { key: "scope", label: "Phạm vi dữ liệu" },
  { key: "identity", label: "Định danh ngoài" },
  { key: "audit", label: "Nhật ký" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function UserDetailClient({ user, audit, scopes }: { user: AdminUser; audit: AuditEvent[]; scopes: DataScope[] }) {
  const [tab, setTab] = useState<TabKey>("membership");

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div>
        <SectionCard accent="neutral" title="Hồ sơ">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-primary-600/10 text-xl font-semibold text-primary-600">{initials(user.name)}</span>
            <div>
              <p className="font-heading font-semibold text-gray-800 dark:text-dark-50">{user.name}</p>
              <p className="text-xs text-gray-400">{user.title}</p>
            </div>
            <Badge tone={user.status === "active" ? "success" : "neutral"}>{user.status === "active" ? "Hoạt động" : user.status}</Badge>
          </div>
          <dl className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm dark:border-dark-600">
            <DefRow label="Email" value={user.email} />
            <DefRow label="Điện thoại" value={user.phone ?? "—"} />
            <DefRow label="Đơn vị" value={user.department} />
            <DefRow label="Hiện diện" value={user.presence} />
          </dl>
          <div className="mt-4 flex gap-2">
            <button type="button" disabled title="Cần BFF /api/admin/users/:id" className="flex-1 cursor-not-allowed rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-400 dark:border-dark-600">Chỉnh sửa</button>
            <button type="button" disabled title="Cần BFF /api/admin/users/:id/suspend" className="flex-1 cursor-not-allowed rounded-lg border border-error/40 px-3 py-1.5 text-sm text-error/70">Khoá</button>
          </div>
        </SectionCard>
      </div>

      <div className="xl:col-span-2">
        <div className="mb-3 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} aria-pressed={tab === t.key}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${tab === t.key ? "border-primary-600 bg-primary-600 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-primary-300 dark:border-dark-600 dark:bg-dark-700 dark:text-dark-200"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "membership" ? (
          <SectionCard title="Vai trò gắn với người dùng">
            {user.roleNames.length ? (
              <ul className="space-y-2">
                {user.roleNames.map((r, i) => (
                  <li key={r} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 dark:border-dark-600">
                    <span className="flex items-center gap-2"><Badge tone="info">{r}</Badge><span className="text-xs text-gray-400">{user.roleCodes[i]}</span></span>
                    <Badge tone="neutral">Trực tiếp (USER)</Badge>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-gray-500">Chưa gắn vai trò.</p>}
            <p className="mt-3 text-xs text-gray-400">Binding target: USER. Vai trò theo vị trí/đơn vị được cộng dồn khi Org Core hoạt động.</p>
          </SectionCard>
        ) : null}

        {tab === "scope" ? (
          <SectionCard title="Phạm vi dữ liệu hiệu lực">
            <ul className="space-y-2">
              {scopes.map((s) => (
                <li key={s.id} className="rounded-lg border border-gray-200 p-3 dark:border-dark-600">
                  <p className="font-medium text-gray-800 dark:text-dark-100">{s.name}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-dark-300">{s.dimension} {s.operator} [{s.values.join(", ")}]</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-gray-400">Quyền truy cập hiệu lực = giao của vai trò × phạm vi dữ liệu (ABAC). Dùng “Kiểm tra như người dùng” tại màn Phạm vi dữ liệu.</p>
          </SectionCard>
        ) : null}

        {tab === "identity" ? (
          <SectionCard title="Định danh từ IdP ngoài" accent="info">
            <ul className="space-y-2">
              {user.externalIdentities.map((ei, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 dark:border-dark-600">
                  <div>
                    <p className="font-medium text-gray-800 dark:text-dark-100">{ei.provider}</p>
                    <p className="text-xs text-gray-400">subject: {ei.subject}</p>
                  </div>
                  <div className="text-right">
                    <Badge tone={ei.mfa ? "success" : "warning"}>{ei.mfa ? "MFA bật" : "Không MFA"}</Badge>
                    {ei.lastLogin ? <p className="mt-1 text-xs text-gray-400">{dateTimeVN(ei.lastLogin)}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-gray-400">XHub chỉ hiển thị tham chiếu — không lưu mật khẩu, secret hay token.</p>
          </SectionCard>
        ) : null}

        {tab === "audit" ? (
          <SectionCard title="Hoạt động của người dùng">
            {audit.length ? (
              <ol className="space-y-3">
                {audit.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary-500" />
                    <div><p className="text-sm text-gray-700 dark:text-dark-100">{e.action}</p><p className="text-xs text-gray-400">{e.entityType}/{e.entityId} · {dateTimeVN(e.at)} · {e.ip}</p></div>
                  </li>
                ))}
              </ol>
            ) : <p className="text-sm text-gray-500">Không có hoạt động được ghi nhận cho người dùng này.</p>}
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}
