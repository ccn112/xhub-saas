"use client";

// WF-09 — Publish & deployment. Impact analysis (running instances on the active
// version, affected roles, immutability warning) → publish → new version +
// checksum + timestamp, and the published-version history with the "đang dùng"
// marker. Version data is loaded server-side; publish is the only mutation.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import { StatCard } from "@/xhub/ui/StatCard";
import { publishWorkflow, type PublishResult } from "@/xoffice/builder/publish";
import type { WorkflowDefinitionDocument } from "@/xoffice/workflow-types";
import type { PublishSnapshot } from "@/xoffice/lib/publish-data";

const roleLabel: Record<string, string> = {
  requesterManager: "Quản lý người đề nghị",
  ROLE_REQUESTER_MANAGER: "Quản lý người đề nghị",
  ROLE_IT_MANAGER: "Trưởng phòng CNTT",
  ROLE_CFO: "Giám đốc Tài chính",
  ROLE_CEO: "Tổng Giám đốc",
  ROLE_ADMIN_MANAGER: "Trưởng phòng Hành chính",
  ROLE_IT_SUPPORT: "Hỗ trợ CNTT",
  sameAsPrevious: "Như bước trước",
};

function fmtTime(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function PublishPanel({
  code,
  definition,
  snapshot,
}: {
  code: string;
  definition: WorkflowDefinitionDocument;
  snapshot: PublishSnapshot;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const { versions, source, activeVersion, runningInstances, affectedRoles, identity } = snapshot;

  const uniqueRoles = Array.from(new Set(affectedRoles.map((r) => r.role)));

  const handlePublish = async () => {
    setPublishing(true);
    setError(null);
    try {
      const res = await publishWorkflow(code, definition, identity);
      setResult(res);
      if (res.source === "api") {
        startTransition(() => router.refresh());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish thất bại.");
    } finally {
      setPublishing(false);
    }
  };

  // History newest-first; the highest version is the one in use (unless a fresh
  // publish just produced a newer one).
  const sortedVersions = [...versions].sort((a, b) => Number(b.version) - Number(a.version));
  const newlyPublished = result && result.source === "api" ? result.version : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Phiên bản đã publish" value={String(versions.length)} icon="🗂️" tone="primary" />
        <StatCard label="Đang dùng" value={activeVersion != null ? `v${activeVersion}` : "—"} icon="✅" tone="success" />
        <StatCard label="Instance đang chạy" value={String(runningInstances.length)} icon="⚙️" tone="info" />
        <StatCard label="Vai trò ảnh hưởng" value={String(uniqueRoles.length)} icon="👥" tone="warning" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Phân tích tác động trước khi publish"
          action={<Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? "Backend" : "Seed"}</Badge>}
        >
          <div className="space-y-3">
            <div className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-sm text-warning-darker dark:text-warning-lighter">
              ⚠️ Version đang dùng (<span className="font-mono">v{activeVersion ?? "?"}</span>) là bất
              biến (immutable). Publish sẽ tạo phiên bản MỚI; {runningInstances.length} instance đang
              chạy vẫn tiếp tục trên phiên bản chúng khởi tạo.
            </div>

            <div>
              <p className="mb-1 text-tiny font-semibold uppercase tracking-wide text-gray-400">
                Instance đang chạy trên phiên bản hiện hành ({runningInstances.length})
              </p>
              <div className="space-y-1">
                {runningInstances.map((i) => (
                  <div key={i.instanceCode} className="flex items-center justify-between rounded-lg bg-gray-50 px-2.5 py-1.5 text-tiny dark:bg-dark-700">
                    <span className="text-gray-700 dark:text-dark-100">{i.title}</span>
                    <span className="text-gray-400">
                      {i.currentNodeName}{i.slaHours ? ` · SLA ${i.slaHours}h` : ""}
                    </span>
                  </div>
                ))}
                {runningInstances.length === 0 && (
                  <p className="text-tiny text-gray-400">Không có instance đang chạy — publish an toàn.</p>
                )}
              </div>
            </div>

            <div>
              <p className="mb-1 text-tiny font-semibold uppercase tracking-wide text-gray-400">
                Vai trò / người phê duyệt bị ảnh hưởng ({affectedRoles.length} bước)
              </p>
              <div className="space-y-1">
                {affectedRoles.map((r) => (
                  <div key={r.nodeId} className="flex items-center justify-between rounded-lg border border-gray-200 px-2.5 py-1.5 text-tiny dark:border-dark-600">
                    <span className="text-gray-700 dark:text-dark-100">{r.nodeName}</span>
                    <Badge tone="neutral">{roleLabel[r.role] ?? r.role}</Badge>
                  </div>
                ))}
                {affectedRoles.length === 0 && (
                  <p className="text-tiny text-gray-400">Không có bước phê duyệt.</p>
                )}
              </div>
            </div>

            {!result ? (
              <div className="space-y-2 border-t border-gray-200 pt-3 dark:border-dark-600">
                <label className="flex items-start gap-2 text-tiny text-gray-600 dark:text-dark-200">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-0.5 rounded border-gray-300 text-primary-600"
                  />
                  Tôi hiểu phiên bản đang dùng là bất biến và xác nhận tạo phiên bản mới.
                </label>
                {error && (
                  <div className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error-darker dark:text-error-lighter">{error}</div>
                )}
                <button
                  onClick={handlePublish}
                  disabled={publishing || !confirmed}
                  className="w-full rounded-lg bg-primary-600 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {publishing ? "Đang publish…" : "🚀 Publish phiên bản mới"}
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-success-500/40 bg-success-500/5 p-3">
                <p className="text-sm font-semibold text-success-600 dark:text-success-400">✓ Đã publish</p>
                <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-y-1 text-sm">
                  <dt className="text-gray-500 dark:text-dark-300">Phiên bản</dt>
                  <dd className="font-medium text-gray-800 dark:text-dark-100">v{result.version}</dd>
                  <dt className="text-gray-500 dark:text-dark-300">Checksum</dt>
                  <dd className="font-mono text-gray-800 dark:text-dark-100">{result.checksum}</dd>
                  <dt className="text-gray-500 dark:text-dark-300">Thời điểm</dt>
                  <dd className="text-gray-800 dark:text-dark-100">{fmtTime(result.publishedAt)}</dd>
                  <dt className="text-gray-500 dark:text-dark-300">Nguồn</dt>
                  <dd className="text-gray-800 dark:text-dark-100">{result.source === "api" ? "backend" : "cục bộ (offline)"}</dd>
                </dl>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Lịch sử phiên bản đã publish">
          <div className="space-y-1.5">
            {sortedVersions.map((v) => {
              const isActive = newlyPublished != null ? v.version === newlyPublished : v.version === activeVersion;
              return (
                <div
                  key={String(v.version)}
                  className={clsx(
                    "flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
                    isActive
                      ? "border-success-500/50 bg-success-500/5"
                      : "border-gray-200 dark:border-dark-600",
                  )}
                >
                  <div>
                    <p className="font-medium text-gray-800 dark:text-dark-100">
                      v{v.version}
                      {isActive && <span className="ml-2"><Badge tone="success">Đang dùng</Badge></span>}
                    </p>
                    <p className="text-tiny text-gray-400">{fmtTime(v.publishedAt)}</p>
                  </div>
                  {v.checksum && (
                    <span className="font-mono text-tiny text-gray-500 dark:text-dark-300">{v.checksum}</span>
                  )}
                </div>
              );
            })}
            {newlyPublished != null && !sortedVersions.some((v) => v.version === newlyPublished) && (
              <div className="flex items-center justify-between rounded-lg border border-success-500/50 bg-success-500/5 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-gray-800 dark:text-dark-100">
                    v{newlyPublished} <span className="ml-2"><Badge tone="success">Đang dùng</Badge></span>
                  </p>
                  <p className="text-tiny text-gray-400">{fmtTime(result?.publishedAt)}</p>
                </div>
                {result?.checksum && (
                  <span className="font-mono text-tiny text-gray-500 dark:text-dark-300">{result.checksum}</span>
                )}
              </div>
            )}
            {versions.length === 0 && (
              <p className="py-4 text-center text-tiny text-gray-400">Chưa có phiên bản nào được publish.</p>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
