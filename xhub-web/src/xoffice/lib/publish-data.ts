// WF-09 publish & deployment — server-side snapshot: version history + impact
// analysis (running instances on the active version, affected roles/assignees).
import { xofficeContext } from "./workflow-data";
import { getVersionHistory, type WorkflowVersion } from "./versions-data";
import type { WorkflowDefinitionDocument } from "@/xoffice/workflow-types";

import { API_BASE_SERVER as API_BASE } from "@/lib/api-base";

export interface AffectedRole {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  role: string;
}

export interface RunningInstanceLite {
  instanceCode: string;
  title: string;
  currentNodeName: string;
  slaHours?: number | null;
}

export interface PublishSnapshot {
  versions: WorkflowVersion[];
  source: "api" | "seed";
  activeVersion: number | string | null;
  runningInstances: RunningInstanceLite[];
  affectedRoles: AffectedRole[];
  identity: { tenantId: string; userId: string };
}

function assignmentRole(config: Record<string, unknown>): string {
  const a = (config.assignment ?? {}) as Record<string, unknown>;
  if (typeof a.roleCode === "string") return a.roleCode;
  if (typeof a.type === "string") return a.type;
  return "—";
}

/** Affected approval/humanTask assignees derived from the active definition. */
export function deriveAffectedRoles(def: WorkflowDefinitionDocument): AffectedRole[] {
  return def.nodes
    .filter((n) => n.type === "approval" || n.type === "humanTask")
    .map((n) => ({
      nodeId: n.id,
      nodeName: n.name,
      nodeType: n.type,
      role: assignmentRole(n.config ?? {}),
    }));
}

export async function getPublishSnapshot(
  code: string,
  definition: WorkflowDefinitionDocument,
): Promise<PublishSnapshot> {
  const ctx = xofficeContext();
  const { versions, source } = await getVersionHistory(code, definition);

  // Highest version number is the one currently in use.
  const activeVersion =
    versions.length > 0
      ? versions.reduce<number | string>((max, v) => {
          const n = Number(v.version);
          return Number.isFinite(n) && n > Number(max) ? v.version : max;
        }, versions[0].version)
      : null;

  // Running instances for THIS workflow (they execute on the active version).
  let runningInstances: RunningInstanceLite[] = [];
  try {
    const res = await fetch(`${API_BASE}/api/xoffice/instances`, {
      headers: {
        "x-tenant-id": ctx.tenantId,
        "x-user-id": ctx.userId,
        "content-type": "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const all = (await res.json()) as Array<{
        workflowCode: string;
        instanceCode: string;
        title: string;
        status: string;
        currentNodeName?: string;
        currentNodeId: string;
        slaHours?: number | null;
      }>;
      runningInstances = all
        .filter((i) => i.workflowCode === code && i.status === "running")
        .map((i) => ({
          instanceCode: i.instanceCode,
          title: i.title,
          currentNodeName: i.currentNodeName ?? i.currentNodeId,
          slaHours: i.slaHours ?? null,
        }));
    }
  } catch {
    /* leave empty */
  }

  // Prefer the active version's definition for the affected-role list.
  const activeDef =
    versions.find((v) => v.version === activeVersion)?.definition ?? definition;

  return {
    versions,
    source,
    activeVersion,
    runningInstances,
    affectedRoles: deriveAffectedRoles(activeDef),
    identity: { tenantId: ctx.tenantId, userId: ctx.userId },
  };
}
