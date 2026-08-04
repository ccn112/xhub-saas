// Server-side BFF client for the Tenant Control Plane (/api/controlplane).
// Resilient (mirrors backup.server.ts / identity.server.ts): returns { source }
// + data; degrades to an empty demo set (flagged) on any failure. Used by the
// TA-01 overview connectors/provisioning card and the connectors screens.
import "server-only";

import { API_BASE_SERVER as API } from "@/lib/api-base";
const HEADERS = { "x-tenant-id": "tenant-xtech", "x-user-id": "user-nam" } as const;

export type Source = "live" | "demo";

export interface Application { code: string; name: string; ownerSystem: string; provisioningMode: string; capabilities: string[]; userSoR: string; deepLink: string | null; notes?: string }
export interface TenantApplication { id: string; applicationCode: string; status: "enabled" | "disabled"; config: Record<string, unknown> }
export interface ProvisioningCommand { id: string; personId: string; applicationCode: string; action: string; status: string; attempts: number; correlationId: string; idempotencyKey: string }
export interface ProvisioningConflict { id: string; commandId: string; reason: string; detail: Record<string, unknown>; resolved: boolean; createdAt: string }
export interface AppAccountBinding { id: string; personId: string; applicationCode: string; externalAccountId: string; externalUsername: string; status: string; lastSyncedAt: string | null }
export interface RoleMapping { id: string; applicationCode: string; xhubRoleCode: string; appRole: string; version: number }

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { headers: HEADERS, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getApplications(): Promise<{ source: Source; apps: Application[] }> {
  const rows = await get<Application[]>("/api/controlplane/applications");
  if (!Array.isArray(rows) || rows.length === 0) return { source: "demo", apps: [] };
  return { source: "live", apps: rows };
}

export async function getTenantApplications(): Promise<{ source: Source; apps: TenantApplication[] }> {
  const rows = await get<TenantApplication[]>("/api/controlplane/tenant-applications");
  if (!Array.isArray(rows) || rows.length === 0) return { source: "demo", apps: [] };
  return { source: "live", apps: rows };
}

export async function getProvisioningCommands(): Promise<{ source: Source; commands: ProvisioningCommand[] }> {
  const rows = await get<ProvisioningCommand[]>("/api/controlplane/provisioning-commands");
  if (!Array.isArray(rows)) return { source: "demo", commands: [] };
  return { source: rows.length ? "live" : "demo", commands: rows };
}

export async function getProvisioningConflicts(): Promise<{ source: Source; conflicts: ProvisioningConflict[] }> {
  const rows = await get<ProvisioningConflict[]>("/api/controlplane/provisioning-conflicts");
  if (!Array.isArray(rows)) return { source: "demo", conflicts: [] };
  return { source: rows.length ? "live" : "demo", conflicts: rows };
}

export async function getAppAccountBindings(): Promise<{ source: Source; bindings: AppAccountBinding[] }> {
  const rows = await get<AppAccountBinding[]>("/api/controlplane/app-account-bindings");
  if (!Array.isArray(rows) || rows.length === 0) return { source: "demo", bindings: [] };
  return { source: "live", bindings: rows };
}

export async function getRoleMappings(): Promise<{ source: Source; mappings: RoleMapping[] }> {
  const rows = await get<RoleMapping[]>("/api/controlplane/role-mappings");
  if (!Array.isArray(rows) || rows.length === 0) return { source: "demo", mappings: [] };
  return { source: "live", mappings: rows };
}
