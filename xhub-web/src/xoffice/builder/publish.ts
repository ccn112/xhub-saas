"use client";

// WF-09 publish client. POST /workflows/:code/publish with the current
// definition; returns the new immutable version + checksum. Best-effort: if the
// backend is offline we synthesize a local checksum so the panel still responds.
import type { WorkflowDefinitionDocument } from "@/xoffice/workflow-types";

import { XOFFICE_BASE_CLIENT as API_BASE } from "@/lib/api-base";

export interface PublishResult {
  version: number | string;
  checksum: string;
  publishedAt: string;
  source: "api" | "local";
}

async function localChecksum(doc: WorkflowDefinitionDocument): Promise<string> {
  const text = JSON.stringify({ nodes: doc.nodes, edges: doc.edges });
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
  } catch {
    return Math.abs([...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(16);
  }
}

export interface PublishIdentity {
  tenantId: string;
  userId: string;
}

export async function publishWorkflow(
  code: string,
  doc: WorkflowDefinitionDocument,
  identity?: PublishIdentity,
): Promise<PublishResult> {
  try {
    const res = await fetch(
      `${API_BASE}/api/xoffice/workflows/${encodeURIComponent(code)}/publish`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(identity
            ? { "x-tenant-id": identity.tenantId, "x-user-id": identity.userId }
            : {}),
        },
        body: JSON.stringify({ definition: doc }),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (res.ok) {
      const data = (await res.json()) as Partial<PublishResult>;
      return {
        version: data.version ?? "?",
        checksum: data.checksum ?? (await localChecksum(doc)),
        publishedAt: data.publishedAt ?? new Date().toISOString(),
        source: "api",
      };
    }
  } catch {
    /* fall through */
  }
  return {
    version: "nháp cục bộ",
    checksum: await localChecksum(doc),
    publishedAt: new Date().toISOString(),
    source: "local",
  };
}
