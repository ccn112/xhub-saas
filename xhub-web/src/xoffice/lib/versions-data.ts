// WF-08 version history — server-side loader (tenant-scoped, seed fallback).
import { xofficeContext } from "./workflow-data";
import type { WorkflowDefinitionDocument } from "@/xoffice/workflow-types";

const API_BASE = process.env.XOFFICE_API_BASE ?? "http://localhost:4000";

export interface WorkflowVersion {
  version: number | string;
  publishedAt?: string;
  checksum?: string;
  publishedBy?: string;
  definition: WorkflowDefinitionDocument;
}

export interface VersionHistory {
  versions: WorkflowVersion[];
  source: "api" | "seed";
}

export async function getVersionHistory(
  code: string,
  fallback: WorkflowDefinitionDocument | null,
): Promise<VersionHistory> {
  try {
    const ctx = xofficeContext();
    const res = await fetch(
      `${API_BASE}/api/xoffice/workflows/${encodeURIComponent(code)}/versions`,
      {
        headers: {
          "x-tenant-id": ctx.tenantId,
          "x-user-id": ctx.userId,
          "content-type": "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      },
    );
    if (res.ok) {
      const data = (await res.json()) as WorkflowVersion[] | { versions: WorkflowVersion[] };
      const list = Array.isArray(data) ? data : data.versions;
      if (Array.isArray(list) && list.length > 0) return { versions: list, source: "api" };
    }
  } catch {
    /* fall through */
  }
  // Fallback: a single synthetic v1 from the current definition.
  if (fallback) {
    return {
      versions: [{ version: 1, definition: fallback, publishedAt: undefined }],
      source: "seed",
    };
  }
  return { versions: [], source: "seed" };
}
