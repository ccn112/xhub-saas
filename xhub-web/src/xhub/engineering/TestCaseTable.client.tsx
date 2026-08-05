"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/xhub/ui/Badge";
import type { TestCaseRow } from "./engineering-data";
import { TEST_RESULT_STATUS_LABEL, TEST_RESULT_STATUS_TONE } from "./engineering-data";

const RECORDABLE_STATUSES = ["PASS", "FAIL", "BLOCKED", "NOT_APPLICABLE", "NEEDS_CLARIFICATION"] as const;

/**
 * Interactive test-case row list (DG-04-lite) — the "để tôi test luôn" part.
 * Client component: records a TestResult via the existing
 * /api/engineering/[[...path]] proxy (no new route needed — it already
 * forwards any /api/engineering/* path), then router.refresh() to re-pull
 * server data (current status, history) cleanly rather than hand-syncing
 * client state. Mirrors the existing /docs/test checklist's own directness.
 */
export function TestCaseTable({
  cases,
  productId,
  productVersionId,
}: {
  cases: TestCaseRow[];
  productId: string;
  productVersionId: string | undefined;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { status: string; notes: string }>>({});

  async function record(testCaseId: string) {
    const draft = drafts[testCaseId];
    if (!draft?.status) return;
    setPending(testCaseId);
    try {
      await fetch("/api/engineering/test-results", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          testCaseId,
          productVersionId,
          status: draft.status,
          notes: draft.notes || undefined,
        }),
      });
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  /** File a Defect straight from a FAIL result (DG-05) — idempotent server-side. */
  async function fileDefect(tc: TestCaseRow) {
    if (!tc.lastResult) return;
    setPending(`defect:${tc.id}`);
    try {
      await fetch("/api/engineering/defects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId,
          productVersionId,
          testCaseId: tc.id,
          testResultId: tc.lastResult.id,
          title: `Lỗi: ${tc.title}`,
          description: tc.lastResult.actualResult || tc.lastResult.notes || undefined,
        }),
      });
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="divide-y divide-gray-100 dark:divide-dark-700">
      {cases.map((tc) => {
        const draft = drafts[tc.id] ?? { status: "", notes: "" };
        return (
          <div key={tc.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-gray-800 dark:text-dark-50">{tc.title}</span>
                <Badge tone={TEST_RESULT_STATUS_TONE[tc.currentStatus] ?? "neutral"}>
                  {TEST_RESULT_STATUS_LABEL[tc.currentStatus] ?? tc.currentStatus}
                </Badge>
                {tc.requiredForRelease ? <span className="text-[11px] text-gray-400">bắt buộc trước phát hành</span> : null}
              </div>
              <p className="mt-0.5 text-xs text-gray-400">
                {tc.code}
                {tc.externalLegacyCode ? ` · legacy ${tc.externalLegacyCode}` : ""} · {tc.level}
              </p>
              {tc.expectedResult ? <p className="mt-1 text-sm text-gray-600 dark:text-dark-200">{tc.expectedResult}</p> : null}
              {tc.deepLinkTemplate ? (
                <a href={tc.deepLinkTemplate} className="mt-1 inline-block text-xs font-medium text-primary-600 hover:underline dark:text-primary-400">
                  Mở màn →
                </a>
              ) : null}
              {tc.standardsRefs.length > 0 ? (
                <p className="mt-1 flex flex-wrap gap-1">
                  {tc.standardsRefs.map((s) => (
                    <span key={s} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-dark-700 dark:text-dark-300">
                      {s}
                    </span>
                  ))}
                </p>
              ) : null}
              {tc.lastResult ? (
                <p className="mt-1 text-xs text-gray-400">
                  Lần cuối: {new Date(tc.lastResult.testedAt).toLocaleString("vi-VN")}
                  {tc.lastResult.notes ? ` — “${tc.lastResult.notes}”` : ""}
                </p>
              ) : null}
              {tc.currentStatus === "FAIL" ? (
                tc.defect ? (
                  <a
                    href={`/engineering/defects?productId=${productId}&status=${tc.defect.status}`}
                    className="mt-1 inline-block text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                  >
                    Đã báo lỗi {tc.defect.code} →
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled={pending === `defect:${tc.id}`}
                    onClick={() => fileDefect(tc)}
                    className="mt-1 rounded-full border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    {pending === `defect:${tc.id}` ? "Đang tạo…" : "Báo lỗi"}
                  </button>
                )
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              {RECORDABLE_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setDrafts((d) => ({ ...d, [tc.id]: { status: s, notes: d[tc.id]?.notes ?? "" } }))}
                  className={`rounded-full border px-2.5 py-1 text-xs ${draft.status === s ? "border-primary-500 bg-primary-50 font-medium text-primary-700 dark:bg-primary-500/10 dark:text-primary-300" : "border-gray-200 text-gray-500 hover:border-gray-300 dark:border-dark-600 dark:text-dark-300"}`}
                >
                  {TEST_RESULT_STATUS_LABEL[s]}
                </button>
              ))}
              <button
                type="button"
                disabled={!draft.status || pending === tc.id}
                onClick={() => record(tc.id)}
                className="rounded-full bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-40"
              >
                {pending === tc.id ? "Đang lưu…" : "Ghi kết quả"}
              </button>
            </div>
          </div>
        );
      })}
      {cases.length === 0 ? <p className="py-6 text-center text-sm text-gray-400">Không có test case nào khớp bộ lọc.</p> : null}
    </div>
  );
}
