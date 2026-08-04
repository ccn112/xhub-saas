// WF-10 runtime monitor — server-side data access (:4000, tenant-scoped).
import { xofficeContext, type XOfficeContext } from "./workflow-data";

import { API_BASE_SERVER as API_BASE } from "@/lib/api-base";

export interface RuntimeInstance {
  tenantSlug: string;
  workflowCode: string;
  instanceCode: string;
  title: string;
  requesterEmail: string;
  variables: Record<string, unknown>;
  status: string;
  currentNodeId: string;
  currentNodeName?: string;
  currentNodeType?: string;
  slaHours?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalTask {
  id: string;
  tenantSlug: string;
  instanceCode: string;
  nodeId: string;
  nodeName: string;
  assigneeRole: string;
  status: string;
  slaHours?: number | null;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  tenantSlug: string;
  at: string;
  actorId: string;
  instanceCode: string;
  action: string;
  detail: string;
}

async function get<T>(path: string, ctx: XOfficeContext): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: {
        "x-tenant-id": ctx.tenantId,
        "x-user-id": ctx.userId,
        "content-type": "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface ConnectorCommand {
  id: string;
  instanceCode: string;
  nodeId?: string;
  connectorCode: string;
  actionCode: string;
  status: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown> | string | null;
  createdAt?: string;
}

export interface MonitorSnapshot {
  instances: RuntimeInstance[];
  tasks: ApprovalTask[];
  audit: AuditEntry[];
  commands: ConnectorCommand[];
  source: "api" | "offline";
  identity: { tenantId: string; userId: string };
}

export interface ExternalExecution {
  id: string;
  instanceCode: string;
  nodeId?: string;
  connectorCode: string;
  actionCode: string;
  mode: string;
  status: string;
  payload?: Record<string, unknown>;
  referenceCode?: string | null;
  referenceSystem?: string | null;
  createdAt?: string;
}

// Backend list endpoints return a plain array by default, or `{ items, total,
// page, pageSize }` when `?page=` is passed. This normalizes both.
interface PageEnvelope<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface InstancesPage {
  items: RuntimeInstance[];
  total: number;
  page: number;
  pageSize: number;
  source: "api" | "offline";
}

/** WF listing — server-side, tenant-scoped, backend pagination via ?page=. */
export async function listInstancesPaged(page: number, pageSize: number): Promise<InstancesPage> {
  const ctx = xofficeContext();
  const res = await get<PageEnvelope<RuntimeInstance> | RuntimeInstance[]>(
    `/api/xoffice/instances?page=${page}&pageSize=${pageSize}`,
    ctx,
  );
  if (res && !Array.isArray(res) && Array.isArray(res.items)) {
    return { ...res, source: "api" };
  }
  if (Array.isArray(res)) {
    // Backend without pagination support → slice locally.
    const start = (page - 1) * pageSize;
    return { items: res.slice(start, start + pageSize), total: res.length, page, pageSize, source: "api" };
  }
  return { items: [], total: 0, page, pageSize, source: "offline" };
}

export interface InstanceDetail {
  instance: RuntimeInstance | null;
  tasks: ApprovalTask[];
  audit: AuditEntry[];
  commands: ConnectorCommand[];
  externals: ExternalExecution[];
  source: "api" | "offline";
}

/** One instance + its tasks / audit / connector commands / external executions. */
export async function getInstanceDetail(code: string): Promise<InstanceDetail> {
  const ctx = xofficeContext();
  const [instances, tasks, audit, commands, externals] = await Promise.all([
    get<RuntimeInstance[]>("/api/xoffice/instances", ctx),
    get<ApprovalTask[]>("/api/xoffice/tasks", ctx),
    get<AuditEntry[]>("/api/xoffice/audit", ctx),
    get<ConnectorCommand[]>(`/api/xoffice/instances/${encodeURIComponent(code)}/commands`, ctx),
    get<ExternalExecution[]>(`/api/xoffice/external-executions?instanceCode=${encodeURIComponent(code)}`, ctx),
  ]);
  const source: "api" | "offline" = instances !== null ? "api" : "offline";
  const instance = (instances ?? []).find((i) => i.instanceCode === code) ?? null;
  return {
    instance,
    tasks: (tasks ?? []).filter((t) => t.instanceCode === code),
    audit: (audit ?? []).filter((a) => a.instanceCode === code),
    commands: Array.isArray(commands) ? commands.map((c) => ({ ...c, instanceCode: c.instanceCode ?? code })) : [],
    externals: Array.isArray(externals) ? externals : [],
    source,
  };
}

export async function getMonitorSnapshot(): Promise<MonitorSnapshot> {
  const ctx = xofficeContext();
  const [instances, tasks, audit] = await Promise.all([
    get<RuntimeInstance[]>("/api/xoffice/instances", ctx),
    get<ApprovalTask[]>("/api/xoffice/tasks", ctx),
    get<AuditEntry[]>("/api/xoffice/audit", ctx),
  ]);
  const source: "api" | "offline" = instances !== null ? "api" : "offline";

  // Connector commands per instance (GET /instances/:code/commands).
  const commands: ConnectorCommand[] = [];
  for (const inst of instances ?? []) {
    const cmds = await get<ConnectorCommand[]>(
      `/api/xoffice/instances/${encodeURIComponent(inst.instanceCode)}/commands`,
      ctx,
    );
    if (Array.isArray(cmds)) {
      commands.push(...cmds.map((c) => ({ ...c, instanceCode: c.instanceCode ?? inst.instanceCode })));
    }
  }

  return {
    instances: instances ?? [],
    tasks: tasks ?? [],
    audit: audit ?? [],
    commands,
    source,
    identity: { tenantId: ctx.tenantId, userId: ctx.userId },
  };
}
