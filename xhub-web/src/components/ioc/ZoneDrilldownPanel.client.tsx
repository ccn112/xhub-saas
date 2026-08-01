"use client";

import { useEffect, useState } from "react";
import { Badge, type Tone } from "@/xhub/ui/Badge";

interface DrilldownData {
  zone: { zoneId: string; label: string; orgUnitId: string | null };
  roster: Array<{ positionId: string; positionTitle: string; personId: string; fullName: string }>;
  tasks: Array<{ id: string; title: string; status: string; priority?: string; dueAt?: string | null }>;
  alerts: Array<{ severity: "CRITICAL" | "WARNING" | "INFO"; title: string; detail: string }>;
  note?: string;
}

const SEVERITY_TONE: Record<DrilldownData["alerts"][number]["severity"], Tone> = {
  CRITICAL: "error",
  WARNING: "warning",
  INFO: "info",
};

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ok"; data: DrilldownData };

/**
 * Zone drill-down (DT-06) — roster + open tasks + zone-scoped alerts for the
 * zone the user clicked on the twin. Client-fetched through the existing IOC
 * BFF proxy (`/api/ioc/...`), which forwards to the same
 * `ioc.people.detail`-gated backend endpoint used everywhere else in this
 * module — a caller lacking that permission or out of their DataScope sees
 * the SAME 403 message here as they would on a direct API call, not a
 * silently empty panel.
 */
export function ZoneDrilldownPanel({
  dashboardCode,
  zoneId,
  onClose,
}: {
  dashboardCode: string;
  zoneId: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetch(`/api/ioc/runtime/dashboards/${encodeURIComponent(dashboardCode)}/zones/${encodeURIComponent(zoneId)}/drilldown`, { cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setState({ status: "error", message: body?.error === "backend rejected" ? body?.detail?.message ?? `Lỗi ${res.status}` : body?.message ?? `Lỗi ${res.status}` });
          return;
        }
        setState({ status: "ok", data: body as DrilldownData });
      })
      .catch((e) => {
        if (!cancelled) setState({ status: "error", message: e?.message ?? "Không kết nối được backend" });
      });
    return () => {
      cancelled = true;
    };
  }, [dashboardCode, zoneId]);

  return (
    <div className="space-y-3">
      <button type="button" onClick={onClose} className="text-xs font-medium text-primary-600 hover:underline">
        ← Quay lại AI Twin Brief
      </button>

      {state.status === "loading" ? <p className="text-sm text-gray-400">Đang tải…</p> : null}
      {state.status === "error" ? <p className="text-sm text-error">{state.message}</p> : null}

      {state.status === "ok" ? (
        <>
          <p className="text-sm font-semibold text-gray-800 dark:text-dark-50">{state.data.zone.label}</p>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Định biên ({state.data.roster.length})</p>
            <ul className="mt-1 space-y-1">
              {state.data.roster.map((r) => (
                <li key={r.positionId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-gray-700 dark:text-dark-100">{r.fullName}</span>
                  <span className="shrink-0 truncate text-xs text-gray-400">{r.positionTitle}</span>
                </li>
              ))}
              {!state.data.roster.length ? <li className="text-sm text-gray-400">{state.data.note ?? "Chưa có người giữ vị trí nào."}</li> : null}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Việc đang xử lý ({state.data.tasks.length})</p>
            <ul className="mt-1 space-y-1.5">
              {state.data.tasks.map((t) => (
                <li key={t.id} className="text-sm text-gray-700 dark:text-dark-100">
                  <span className="truncate">{t.title}</span>
                  <span className="ml-1.5 text-xs text-gray-400">
                    ({t.status}
                    {t.dueAt ? ` · hạn ${new Date(t.dueAt).toLocaleDateString("vi-VN")}` : ""})
                  </span>
                </li>
              ))}
              {!state.data.tasks.length ? <li className="text-sm text-gray-400">Không có việc nào đang xử lý.</li> : null}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Cảnh báo ({state.data.alerts.length})</p>
            <ul className="mt-1 space-y-1.5">
              {state.data.alerts.map((a, i) => (
                <li key={i} className="rounded-lg border border-gray-200 p-2 dark:border-dark-600">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-800 dark:text-dark-50">{a.title}</p>
                    <Badge tone={SEVERITY_TONE[a.severity]}>{a.severity}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-dark-300">{a.detail}</p>
                </li>
              ))}
              {!state.data.alerts.length ? <li className="text-sm text-gray-400">Không có cảnh báo nào.</li> : null}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}
