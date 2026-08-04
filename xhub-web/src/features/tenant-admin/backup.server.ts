// Server-side BFF client for the tenant backup module (/api/backup).
// Resilient: if the endpoint is not up yet, degrade to the demo dataset with a
// clear source flag so the screen renders instead of crashing. FE never touches
// the DB — always via the API base the rest of the app uses (XHUB_API_URL).
import "server-only";
import { CANONICAL_TENANT_ID, DEMO_BACKUPS, DEMO_RESTORES, type BackupJob, type RestoreJob } from "./data";

import { API_BASE_SERVER as API } from "@/lib/api-base";

export type Source = "api" | "demo";

export interface BackupListResult { source: Source; jobs: BackupJob[] }
export interface RestoreListResult { source: Source; jobs: RestoreJob[] }

// The xhub-api job shape differs from the FE BackupJob view model
// (byteSize→sizeBytes, checksum string→checksumStatus, manifest.totalRows→
// recordCount). Normalize the live rows so the list columns render real values.
interface ApiBackupJob {
  id: string; status: string; kind?: string; createdAt: string; byteSize?: number;
  checksum?: string | null; manifest?: { kind?: string; totalRows?: number; tables?: Record<string, unknown>; encryption?: unknown } | null;
}

function normalizeBackup(j: ApiBackupJob): BackupJob {
  const m = j.manifest ?? {};
  const created = new Date(j.createdAt);
  const stamp = Number.isNaN(created.getTime()) ? "" : ` · ${created.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`;
  return {
    id: j.id,
    label: `${m.kind ?? j.kind ?? "Gói backup"}${stamp}`,
    mode: m.kind ?? j.kind ?? "—",
    status: j.status,
    createdAt: j.createdAt,
    sizeBytes: j.byteSize ?? 0,
    recordCount: m.totalRows ?? 0,
    fileCount: m.tables ? Object.keys(m.tables).length : 0,
    checksumStatus: j.checksum ? (j.status === "completed" ? "PASS" : "PENDING") : "PENDING",
    encrypted: !!m.encryption,
  };
}

/** GET /api/backup — list backup jobs. Falls back to demo data on any failure. */
export async function fetchBackups(): Promise<BackupListResult> {
  try {
    const res = await fetch(`${API}/api/backup`, {
      headers: { "x-tenant-id": CANONICAL_TENANT_ID },
      cache: "no-store",
    });
    if (!res.ok) return { source: "demo", jobs: DEMO_BACKUPS };
    const rows = (await res.json()) as ApiBackupJob[];
    if (!Array.isArray(rows) || rows.length === 0) return { source: "demo", jobs: DEMO_BACKUPS };
    return { source: "api", jobs: rows.map(normalizeBackup) };
  } catch {
    return { source: "demo", jobs: DEMO_BACKUPS };
  }
}

export async function fetchBackup(id: string): Promise<{ source: Source; job: BackupJob | undefined }> {
  const { source, jobs } = await fetchBackups();
  return { source, job: jobs.find((j) => j.id === id) };
}

/** GET /api/backup/restores — list restore jobs. Falls back to demo data. */
export async function fetchRestores(): Promise<RestoreListResult> {
  try {
    const res = await fetch(`${API}/api/backup/restores`, {
      headers: { "x-tenant-id": CANONICAL_TENANT_ID },
      cache: "no-store",
    });
    if (!res.ok) return { source: "demo", jobs: DEMO_RESTORES };
    const rows = (await res.json()) as RestoreJob[];
    if (!Array.isArray(rows) || rows.length === 0) return { source: "demo", jobs: DEMO_RESTORES };
    return { source: "api", jobs: rows };
  } catch {
    return { source: "demo", jobs: DEMO_RESTORES };
  }
}
