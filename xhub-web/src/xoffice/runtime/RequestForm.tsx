"use client";

// FORM RUNTIME — renders the real intake form of a workflow (RJSF, JSON Schema
// from the form-definition) and creates a live request on submit:
// POST /workflows/:code/requests → instance + first approval task.
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Form from "@rjsf/core";
import type { IChangeEvent } from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";

import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import type { Identity } from "@/xoffice/monitor/actions.client";

import { API_BASE_CLIENT as API_BASE } from "@/lib/api-base";

interface CreatedRequest {
  instance: {
    instanceCode: string;
    title: string;
    status: string;
    currentNodeName?: string;
    currentNodeId: string;
  };
  task?: {
    id: string;
    nodeName: string;
    assigneeRole: string;
    slaHours?: number | null;
  } | null;
}

function pickTitle(data: Record<string, unknown>, fallback: string): string {
  for (const k of ["title", "subject", "name", "tieuDe"]) {
    const v = data[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return fallback;
}

export function RequestForm({
  workflowCode,
  workflowName,
  formName,
  formCode,
  jsonSchema,
  uiSchema,
  namespace,
  identity,
  source,
}: {
  workflowCode: string;
  workflowName: string;
  formName: string;
  formCode: string;
  jsonSchema: Record<string, unknown>;
  uiSchema: Record<string, unknown>;
  namespace: string | null;
  identity: Identity;
  source: "api" | "seed";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedRequest | null>(null);

  const submit = async (e: IChangeEvent) => {
    const data = (e.formData ?? {}) as Record<string, unknown>;
    setBusy(true);
    setError(null);
    // Shape the payload the way the workflow reads it (inferred namespace).
    const variables = namespace ? { [namespace]: data } : data;
    const title = pickTitle(data, `${workflowName} — yêu cầu mới`);
    try {
      const res = await fetch(
        `${API_BASE}/api/xoffice/workflows/${encodeURIComponent(workflowCode)}/requests`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-tenant-id": identity.tenantId,
            "x-user-id": identity.userId,
          },
          body: JSON.stringify({ title, variables }),
        },
      );
      if (!res.ok) throw new Error(`Tạo request thất bại (${res.status})`);
      const json = (await res.json()) as CreatedRequest;
      setCreated(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được request.");
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    const inst = created.instance;
    const task = created.task;
    return (
      <SectionCard title="Đã tạo request">
        <div className="space-y-3">
          <div className="rounded-lg border border-success-500/40 bg-success-500/5 p-3">
            <p className="text-sm font-semibold text-success-600 dark:text-success-400">
              ✓ Request đã được tạo và đưa vào vận hành
            </p>
            <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
              <dt className="text-gray-500 dark:text-dark-300">Mã instance</dt>
              <dd className="font-mono text-gray-800 dark:text-dark-100">{inst.instanceCode}</dd>
              <dt className="text-gray-500 dark:text-dark-300">Tiêu đề</dt>
              <dd className="text-gray-800 dark:text-dark-100">{inst.title}</dd>
              <dt className="text-gray-500 dark:text-dark-300">Trạng thái</dt>
              <dd className="text-gray-800 dark:text-dark-100">{inst.status}</dd>
              <dt className="text-gray-500 dark:text-dark-300">Đang chờ tại</dt>
              <dd className="text-gray-800 dark:text-dark-100">{inst.currentNodeName ?? inst.currentNodeId}</dd>
            </dl>
          </div>
          {task && (
            <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
              <p className="font-medium text-warning-darker dark:text-warning-lighter">
                Task phê duyệt đầu tiên đã phát sinh
              </p>
              <p className="mt-1 text-gray-600 dark:text-dark-200">
                {task.nodeName} · vai trò <span className="font-mono">{task.assigneeRole}</span>
                {task.slaHours ? ` · SLA ${task.slaHours}h` : ""}
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <Link
              href="/office/monitor"
              className="rounded-lg bg-primary-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
            >
              Xem trong Giám sát vận hành →
            </Link>
            <button
              onClick={() => {
                setCreated(null);
                router.refresh();
              }}
              className="rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 dark:border-dark-500 dark:text-dark-100 dark:hover:bg-dark-600"
            >
              Tạo request khác
            </button>
          </div>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title={`Biểu mẫu: ${formName}`}
      action={
        <Badge tone={source === "api" ? "success" : "warning"}>
          {source === "api" ? "Form từ backend" : "Form từ seed"}
        </Badge>
      }
    >
      {error && (
        <div className="mb-3 rounded-lg bg-error/10 px-3 py-2 text-sm text-error-darker dark:text-error-lighter">
          {error}
        </div>
      )}
      <p className="mb-3 text-tiny text-gray-400">
        Mã biểu mẫu <span className="font-mono">{formCode}</span>
        {namespace ? (
          <> · dữ liệu lưu dưới biến <span className="font-mono">{namespace}</span></>
        ) : (
          <> · dữ liệu lưu ở cấp gốc</>
        )}
      </p>
      <div className="xoffice-rjsf max-w-2xl">
        <Form schema={jsonSchema} uiSchema={uiSchema} validator={validator} onSubmit={submit} disabled={busy}>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
          >
            {busy ? "Đang gửi…" : "Gửi & tạo request"}
          </button>
        </Form>
      </div>
    </SectionCard>
  );
}
