// Server-side data access for X.Office workflows.
// Strategy: call the X.Office backend (:4000) when available, otherwise fall
// back to the committed seed. Every call carries tenant/user headers.
import seedDefinitions from "@/data/xoffice/workflow-definitions.json";
import seedCatalog from "@/data/xoffice/node-catalog.json";
import { getWorkspaceContext } from "@/xhub/lib/workspace";
import type {
  WorkflowDefinitionDocument,
  NodeCatalogEntry,
} from "@/xoffice/workflow-types";

import { XOFFICE_BASE_SERVER as API_BASE } from "@/lib/api-base";

const SEED_DEFS = seedDefinitions as unknown as WorkflowDefinitionDocument[];
const SEED_CATALOG = seedCatalog as unknown as NodeCatalogEntry[];

export interface XOfficeContext {
  tenantId: string;
  userId: string;
  tenantSlug: string;
}

export function xofficeContext(): XOfficeContext {
  const { tenantId, tenant, actor } = getWorkspaceContext();
  return {
    tenantId,
    userId: actor.id,
    tenantSlug: (tenant as { slug?: string }).slug ?? "xtech",
  };
}

function authHeaders(ctx: XOfficeContext): HeadersInit {
  return {
    "x-tenant-id": ctx.tenantId,
    "x-user-id": ctx.userId,
    "content-type": "application/json",
  };
}

async function tryFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T | null> {
  try {
    const ctx = xofficeContext();
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...authHeaders(ctx), ...(init?.headers ?? {}) },
      // Definitions change rarely in POC; avoid caching so seed edits show.
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface WorkflowListItem {
  code: string;
  name: string;
  description: string;
  ownerRoleCode: string;
  nodeCount: number;
  version: string | number;
  usage: number;
}

// Accepts either a full definition ({ metadata, nodes }) or a flat list row
// ({ code, name, ... }) — the backend list endpoint may return either shape.
function toListItem(raw: unknown): WorkflowListItem | null {
  const r = raw as Record<string, unknown>;
  if (!r) return null;
  const meta = (r.metadata ?? r) as Record<string, unknown>;
  const code = meta.code as string | undefined;
  if (!code) return null;
  const nodes = r.nodes as unknown[] | undefined;
  return {
    code,
    name: (meta.name as string) ?? code,
    description: (meta.description as string) ?? "",
    ownerRoleCode: (meta.ownerRoleCode as string) ?? "",
    nodeCount: Array.isArray(nodes) ? nodes.length : Number(r.nodeCount ?? 0),
    version: (r.version as string | number) ?? (r.latestVersion as string | number) ?? 1,
    usage: (r.usage as number) ?? (r.instanceCount as number) ?? 0,
  };
}

/** WF-01 list. Returns items + whether they came from the live backend. */
export async function listWorkflows(): Promise<{
  items: WorkflowListItem[];
  source: "api" | "seed";
}> {
  const api = await tryFetch<WorkflowDefinitionDocument[] | { items: WorkflowDefinitionDocument[] }>(
    "/api/xoffice/workflows",
  );
  if (api) {
    const raw = Array.isArray(api) ? api : api.items;
    if (Array.isArray(raw)) {
      const items = raw.map(toListItem).filter((x): x is WorkflowListItem => x !== null);
      if (items.length > 0) return { items, source: "api" };
    }
  }
  return {
    items: SEED_DEFS.map(toListItem).filter((x): x is WorkflowListItem => x !== null),
    source: "seed",
  };
}

/** WF-02 load one definition by code. */
export async function getWorkflow(code: string): Promise<{
  definition: WorkflowDefinitionDocument | null;
  source: "api" | "seed";
}> {
  const api = await tryFetch<WorkflowDefinitionDocument>(
    `/api/xoffice/workflows/${encodeURIComponent(code)}`,
  );
  if (api && api.metadata && Array.isArray(api.nodes)) {
    return { definition: api, source: "api" };
  }
  const seed = SEED_DEFS.find((d) => d.metadata.code === code) ?? null;
  return { definition: seed, source: "seed" };
}

export async function getNodeCatalog(): Promise<NodeCatalogEntry[]> {
  const api = await tryFetch<NodeCatalogEntry[]>("/api/xoffice/node-catalog");
  if (Array.isArray(api) && api.length > 0) return api;
  return SEED_CATALOG;
}

export function seedNodeCatalog(): NodeCatalogEntry[] {
  return SEED_CATALOG;
}
