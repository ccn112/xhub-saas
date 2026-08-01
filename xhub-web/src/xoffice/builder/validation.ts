"use client";

// Client-side workflow validation. Tries the backend /validate endpoint first;
// falls back to a lightweight structural check so the panel always shows results.
import type {
  WorkflowDefinitionDocument,
  WorkflowValidationIssue,
  WorkflowValidationResult,
} from "@/xoffice/workflow-types";

const API_BASE = "http://localhost:4000";

export interface ValidationOutcome extends WorkflowValidationResult {
  source: "api" | "local";
}

export function localValidate(doc: WorkflowDefinitionDocument): WorkflowValidationResult {
  const issues: WorkflowValidationIssue[] = [];
  const nodes = doc.nodes;
  const edges = doc.edges;

  const starts = nodes.filter((n) => n.type === "start");
  const ends = nodes.filter((n) => n.type === "end");
  if (starts.length === 0) issues.push({ severity: "error", message: "Thiếu node Bắt đầu." });
  if (starts.length > 1) issues.push({ severity: "warning", message: "Có nhiều hơn 1 node Bắt đầu." });
  if (ends.length === 0) issues.push({ severity: "error", message: "Thiếu node Kết thúc." });

  const hasIncoming = new Set(edges.map((e) => e.target));
  const hasOutgoing = new Set(edges.map((e) => e.source));

  for (const n of nodes) {
    if (n.type !== "start" && !hasIncoming.has(n.id)) {
      issues.push({ severity: "warning", nodeId: n.id, message: `Node "${n.name}" không có luồng vào.` });
    }
    if (n.type !== "end" && !hasOutgoing.has(n.id)) {
      issues.push({ severity: "warning", nodeId: n.id, message: `Node "${n.name}" không có luồng ra.` });
    }
    if (n.type === "condition") {
      const outs = edges.filter((e) => e.source === n.id);
      if (outs.length < 2) {
        issues.push({ severity: "warning", nodeId: n.id, message: `Điều kiện "${n.name}" nên có ít nhất 2 nhánh.` });
      }
    }
    if (n.type === "serviceCall" && !(n.config as Record<string, unknown>).connectorCode) {
      issues.push({ severity: "error", nodeId: n.id, message: `Gọi hệ thống "${n.name}" thiếu connector.` });
    }
  }

  return { ok: issues.every((i) => i.severity !== "error"), issues };
}

export async function validateWorkflow(
  code: string,
  doc: WorkflowDefinitionDocument,
): Promise<ValidationOutcome> {
  try {
    const res = await fetch(
      `${API_BASE}/api/xoffice/workflows/${encodeURIComponent(code)}/validate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(doc),
        signal: AbortSignal.timeout(3000),
      },
    );
    if (res.ok) {
      const data = (await res.json()) as {
        ok?: boolean;
        issues?: Array<{ level?: string; severity?: string; message: string; nodeId?: string; code?: string }>;
      };
      const issues: WorkflowValidationIssue[] = (data.issues ?? []).map((i) => ({
        severity: (i.severity ?? i.level ?? "info") as WorkflowValidationIssue["severity"],
        message: i.message,
        nodeId: i.nodeId,
        code: i.code,
      }));
      const ok = data.ok ?? issues.every((i) => i.severity !== "error");
      return { ok, issues, source: "api" };
    }
  } catch {
    /* fall through to local */
  }
  return { ...localValidate(doc), source: "local" };
}
