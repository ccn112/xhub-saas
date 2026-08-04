"use client";

// WF-03 AI copilot client. Calls the mock tool gateway (POST /ai/draft) and
// applies the returned WorkflowPatchSet to a definition document.
// Draft-first: the patch is ONLY applied after an explicit human confirm.
import type { WorkflowDefinitionDocument } from "@/xoffice/workflow-types";

import { API_BASE_CLIENT as API_BASE } from "@/lib/api-base";

export interface PatchOperation {
  op: "add" | "replace" | "remove" | "move";
  path: string;
  from?: string;
  value?: unknown;
}

export interface PatchEvidence {
  sourceType: string;
  sourceId: string;
  label: string;
}

export interface WorkflowPatchSet {
  summary: string;
  operations: PatchOperation[];
  assumptions: string[];
  evidence: PatchEvidence[];
  validation?: { requiresHumanApply?: boolean; appliedToProduction?: boolean };
  mustRequireHumanApply?: boolean;
}

/** POST /api/xoffice/ai/draft — returns a draft patch set (never auto-applied). */
export async function requestAiDraft(
  prompt: string,
  currentDefinition: WorkflowDefinitionDocument,
): Promise<WorkflowPatchSet> {
  const res = await fetch(`${API_BASE}/api/xoffice/ai/draft`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      prompt,
      screen: "workflow_builder",
      currentDefinition,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`AI draft thất bại (${res.status})`);
  return (await res.json()) as WorkflowPatchSet;
}

// --- Minimal RFC 6902 JSON Patch applier (add/replace/remove/move) ----------

function unescape(token: string): string {
  return token.replace(/~1/g, "/").replace(/~0/g, "~");
}

function parsePointer(path: string): string[] {
  if (path === "") return [];
  return path.split("/").slice(1).map(unescape);
}

function getParent(root: unknown, tokens: string[]): { parent: unknown; key: string } {
  let node = root;
  for (let i = 0; i < tokens.length - 1; i++) {
    node = (node as Record<string, unknown>)[tokens[i]];
    if (node === undefined || node === null) {
      throw new Error(`Đường dẫn không hợp lệ: ${tokens.join("/")}`);
    }
  }
  return { parent: node, key: tokens[tokens.length - 1] };
}

function setValue(root: unknown, tokens: string[], value: unknown, op: "add" | "replace") {
  if (tokens.length === 0) return;
  const { parent, key } = getParent(root, tokens);
  if (Array.isArray(parent)) {
    if (key === "-") {
      parent.push(value);
    } else {
      const idx = Number(key);
      if (op === "add") parent.splice(idx, 0, value);
      else parent[idx] = value;
    }
  } else {
    (parent as Record<string, unknown>)[key] = value;
  }
}

function removeValue(root: unknown, tokens: string[]): unknown {
  const { parent, key } = getParent(root, tokens);
  if (Array.isArray(parent)) {
    const idx = key === "-" ? parent.length - 1 : Number(key);
    return parent.splice(idx, 1)[0];
  }
  const rec = parent as Record<string, unknown>;
  const prev = rec[key];
  delete rec[key];
  return prev;
}

/**
 * Apply a patch set to a definition, returning a new document. Best-effort:
 * unsupported/failed operations are skipped and reported, so a partial patch
 * still previews. Pure — does not mutate the input.
 */
export function applyPatchToDocument(
  doc: WorkflowDefinitionDocument,
  operations: PatchOperation[],
): { document: WorkflowDefinitionDocument; applied: number; skipped: string[] } {
  const draft = structuredClone(doc) as unknown as WorkflowDefinitionDocument;
  const skipped: string[] = [];
  let applied = 0;

  for (const op of operations) {
    try {
      const tokens = parsePointer(op.path);
      if (op.op === "add" || op.op === "replace") {
        setValue(draft, tokens, op.value, op.op);
      } else if (op.op === "remove") {
        removeValue(draft, tokens);
      } else if (op.op === "move") {
        const fromTokens = parsePointer(op.from ?? "");
        const moved = removeValue(draft, fromTokens);
        setValue(draft, tokens, moved, "add");
      }
      applied += 1;
    } catch {
      skipped.push(op.path);
    }
  }

  return { document: draft, applied, skipped };
}

/** Short human-readable summary of a single operation for the diff preview. */
export function describeOperation(op: PatchOperation): string {
  const v = op.value as { type?: string; name?: string } | undefined;
  const label = v?.name ? `"${v.name}"` : v?.type ? `(${v.type})` : "";
  switch (op.op) {
    case "add":
      return `Thêm ${label} tại ${op.path}`.trim();
    case "replace":
      return `Sửa ${op.path} ${label}`.trim();
    case "remove":
      return `Xoá ${op.path}`;
    case "move":
      return `Di chuyển ${op.from} → ${op.path}`;
    default:
      return op.path;
  }
}
