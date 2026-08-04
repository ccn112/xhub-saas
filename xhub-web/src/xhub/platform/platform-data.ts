// Platform Console — server-side data access (:4000, platform plane).
// Reads the SHARED Tenant registry via the platform API. Degrades gracefully to
// an empty result with source='offline' (dev only) — never demo data.
import { PLATFORM_BASE_SERVER as API_BASE } from "@/lib/api-base";
// Canonical platform-operator identity for server reads. user-nam holds the
// tenant PLATFORM_ADMIN=['*'] grant, which satisfies platform.* in dev.
const HEADERS = { "content-type": "application/json", "x-tenant-id": "tenant-xtech", "x-user-id": "user-nam" } as const;

export interface TenantRow {
  id: string;
  tenantNo: number | null;
  tenantCode: string | null;
  tenantKey: string | null;
  slug: string;
  name: string;
  tenantClass: string | null;
  industry: string | null;
  status: string | null;
  planId: string | null;
  blueprintId: string | null;
  mode: string | null; // DEMO | LIVE | null (exempt: T001/SYSTEM)
  createdAt?: string;
  updatedAt?: string;
}

export interface PlatformSummary {
  total: number;
  byClass: Record<string, number>;
  byStatus: Record<string, number>;
}

export type Source = "api" | "offline";

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { headers: HEADERS, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function listTenants(): Promise<{ items: TenantRow[]; source: Source }> {
  const data = await get<TenantRow[]>("/api/platform/tenants");
  return { items: Array.isArray(data) ? data : [], source: data ? "api" : "offline" };
}

export async function getTenant(idOrCode: string): Promise<{ tenant: TenantRow | null; source: Source }> {
  const data = await get<TenantRow>(`/api/platform/tenants/${encodeURIComponent(idOrCode)}`);
  return { tenant: data ?? null, source: data ? "api" : "offline" };
}

export interface BackupScheduleRow {
  id: string;
  tenantId: string;
  enabled: boolean;
  frequency: string; // DAILY | WEEKLY | MONTHLY
  hourUtc: number;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  retentionDays: number;
  retentionWeeks: number;
  retentionMonths: number;
  lastRunAt: string | null;
  lastStatus: string | null; // completed | FAILED
  lastError: string | null;
  alert: boolean;
  nextRunAt: string | null;
}

/** All tenants' backup schedules (platform plane, gated platform.backup.read). */
export async function listBackupSchedules(): Promise<{ items: BackupScheduleRow[]; source: Source }> {
  const data = await get<BackupScheduleRow[]>("/api/platform/backup-schedules");
  return { items: Array.isArray(data) ? data : [], source: data ? "api" : "offline" };
}

export async function getSummary(): Promise<{ summary: PlatformSummary; source: Source }> {
  const data = await get<PlatformSummary>("/api/platform/summary");
  return {
    summary: data ?? { total: 0, byClass: {}, byStatus: {} },
    source: data ? "api" : "offline",
  };
}

// ---- Tenant Launch Factory (SaaS step 3) ------------------------------------

export interface LaunchStep {
  id: string;
  stepKey: string;
  seq: number;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED" | "SKIPPED";
  attempts: number;
  result: unknown;
  error: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export interface Launch {
  id: string;
  targetTenantId: string;
  targetTenantNo: number | null;
  blueprintId: string | null;
  seedPackId: string | null;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  currentStepKey: string | null;
  createdBy: string | null;
  createdAt: string;
  finishedAt: string | null;
  steps?: LaunchStep[];
}

export async function listLaunches(): Promise<{ items: Launch[]; source: Source }> {
  const data = await get<Launch[]>("/api/platform/launches");
  return { items: Array.isArray(data) ? data : [], source: data ? "api" : "offline" };
}

export async function getLaunch(id: string): Promise<{ launch: Launch | null; source: Source }> {
  const data = await get<Launch>(`/api/platform/launches/${encodeURIComponent(id)}`);
  return { launch: data ?? null, source: data ? "api" : "offline" };
}

export const LAUNCH_STATUS_TONES: Record<string, "success" | "warning" | "neutral" | "error" | "info"> = {
  QUEUED: "neutral",
  RUNNING: "info",
  COMPLETED: "success",
  FAILED: "error",
};

export const STEP_STATUS_TONES: Record<string, "success" | "warning" | "neutral" | "error" | "info"> = {
  PENDING: "neutral",
  RUNNING: "info",
  DONE: "success",
  FAILED: "error",
  SKIPPED: "warning",
};

export const STEP_LABELS: Record<string, string> = {
  register: "1 · Đăng ký tenant (registry)",
  "identity-baseline": "2 · Nền tảng định danh (org + admin)",
  "enable-apps": "3 · Bật ứng dụng (control-plane)",
  "apply-blueprint": "4 · Áp blueprint (catalog, immutable)",
  "load-seed-pack": "5 · Nạp seed pack (catalog, tham số tenant)",
  "provision-backup": "6 · Tạo backup baseline",
  "isolation-test": "7 · Kiểm thử cách ly (MUST_NOT_LEAK)",
  handover: "8 · Bàn giao + kích hoạt registry",
};

// ---- Blueprint & Seed Pack catalog (SaaS step 4) ----------------------------

export interface Blueprint {
  id: string;
  code: string;
  name: string;
  industry: string | null;
  version: number;
  status: "DRAFT" | "PUBLISHED" | "SUPERSEDED" | "RETIRED";
  inheritsCode: string | null;
  appsEnabled: string[];
  roleSet: unknown;
  orgTemplate: unknown;
  workflowSet: unknown;
  menuEntitlement: unknown;
  compatiblePlans: string[];
  checksum: string;
  publishedAt: string | null;
  createdAt: string;
}

export interface SeedPack {
  id: string;
  code: string;
  name: string;
  version: number;
  status: "DRAFT" | "PUBLISHED" | "SUPERSEDED" | "RETIRED";
  blueprintCode: string | null;
  dependencies: string[];
  datasets: unknown;
  checksum: string;
  publishedAt: string | null;
  createdAt: string;
}

export async function listBlueprints(): Promise<{ items: Blueprint[]; source: Source }> {
  const data = await get<Blueprint[]>("/api/platform/blueprints");
  return { items: Array.isArray(data) ? data : [], source: data ? "api" : "offline" };
}

export async function getBlueprint(id: string): Promise<{ blueprint: Blueprint | null; source: Source }> {
  const data = await get<Blueprint>(`/api/platform/blueprints/${encodeURIComponent(id)}`);
  return { blueprint: data ?? null, source: data ? "api" : "offline" };
}

export async function listSeedPacks(): Promise<{ items: SeedPack[]; source: Source }> {
  const data = await get<SeedPack[]>("/api/platform/seed-packs");
  return { items: Array.isArray(data) ? data : [], source: data ? "api" : "offline" };
}

export async function getSeedPack(id: string): Promise<{ seedPack: SeedPack | null; source: Source }> {
  const data = await get<SeedPack>(`/api/platform/seed-packs/${encodeURIComponent(id)}`);
  return { seedPack: data ?? null, source: data ? "api" : "offline" };
}

export const CATALOG_STATUS_TONES: Record<string, "success" | "warning" | "neutral" | "error" | "info"> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  SUPERSEDED: "warning",
  RETIRED: "error",
};

// ---- presentation helpers ---------------------------------------------------

export const CLASS_LABELS: Record<string, string> = {
  PLATFORM_OWNER_REFERENCE_CUSTOMER: "Chủ nền tảng (T001)",
  VERTICAL_DEMO: "Demo ngành",
  CUSTOMER: "Khách hàng",
  CUSTOMER_SUBSCRIBER: "Khách hàng",
  SYSTEM_TEST: "Hệ thống / test",
};

export const STATUS_TONES: Record<string, "success" | "warning" | "neutral" | "error" | "info"> = {
  ACTIVE: "success",
  PLANNED: "info",
  PROVISIONING: "warning",
  DRAFT: "neutral",
  SUSPENDED: "warning",
  OFFBOARDING: "warning",
  CLOSED: "error",
};

export function classLabel(cls: string | null | undefined): string {
  if (!cls) return "—";
  return CLASS_LABELS[cls] ?? cls;
}

// ---- Tenant Lifecycle — DEMO ↔ LIVE mode ------------------------------------

export const MODE_TONES: Record<string, "success" | "warning" | "neutral" | "error" | "info"> = {
  DEMO: "warning",
  LIVE: "success",
};

export const MODE_LABELS: Record<string, string> = {
  DEMO: "DEMO",
  LIVE: "CHÍNH THỨC",
};

export interface GoLiveTemplateStep {
  order: number;
  key: string;
  title: string;
  guidance?: string;
  suggestedRole?: string;
  templateRef?: string;
  required?: boolean;
}
export interface GoLiveProgressStep {
  key: string;
  status: "TODO" | "DONE";
  assigneeId?: string | null;
  note?: string | null;
  at?: string | null;
}
export interface GoLiveTemplate {
  code: string;
  version: number;
  name: string;
  steps: GoLiveTemplateStep[];
}
export interface GoLiveProgress {
  tenantId: string;
  templateCode: string;
  templateVersion: number;
  steps: GoLiveProgressStep[];
  status: "IN_PROGRESS" | "READY" | "LIVE";
  activatedAt: string | null;
}
export interface GoLiveView {
  tenant: { id: string; mode: string | null; status: string | null };
  template: GoLiveTemplate | null;
  progress: GoLiveProgress | null;
}

/** Per-tenant go-live checklist (template + progress). Platform plane. */
export async function getGoLive(idOrCode: string): Promise<{ view: GoLiveView | null; source: Source }> {
  const data = await get<GoLiveView>(`/api/platform/tenants/${encodeURIComponent(idOrCode)}/go-live`);
  return { view: data ?? null, source: data ? "api" : "offline" };
}

// ---- Subscription plan catalog (T011) ---------------------------------------

export interface PlanRow {
  id: string;
  code: string;
  name: string;
  tier: string;
  appsAllowed: string[];
  featureFlags: Record<string, unknown>;
  limits: Record<string, unknown>;
  priceRef: string | null;
  billingEnabled: boolean;
  customerTenantMinNo: number | null;
  status: string;
}

/** Subscription plan catalog (platform plane, gated platform.plan.read). */
export async function listPlans(): Promise<{ items: PlanRow[]; source: Source }> {
  const data = await get<PlanRow[]>("/api/platform/plans");
  return { items: Array.isArray(data) ? data : [], source: data ? "api" : "offline" };
}

// ---- v1.0 SaaS readiness (T011 exit gate) -----------------------------------

export interface ReadinessCheck {
  key: string;
  scope: string; // 'platform' | tenantCode
  status: "PASS" | "FAIL";
  detail: string;
}

export interface ReadinessExitCriterion {
  n: number;
  key: string;
  status: "PASS" | "FAIL";
}

export interface ReadinessReport {
  ok: boolean;
  generatedAt: string;
  summary: { activeTenants: number; totalChecks: number; passed: number; failed: number };
  exitCriteria: ReadinessExitCriterion[];
  checks: ReadinessCheck[];
}

/** v1.0 readiness checklist (platform plane, gated platform.tenant.read). */
export async function getReadiness(): Promise<{ report: ReadinessReport | null; source: Source }> {
  const data = await get<ReadinessReport>("/api/platform/readiness");
  return { report: data ?? null, source: data ? "api" : "offline" };
}

/** Human labels for the granular readiness check keys. */
export const READINESS_CHECK_LABELS: Record<string, string> = {
  isolation: "Cách ly dữ liệu (không rò rỉ tenant khác)",
  backup: "Backup định kỳ (lịch + job)",
  plan: "Gói/entitlement hợp lệ",
  secrets: "Không lưu mật khẩu dạng thô (argon2)",
  "platform-permission-separation": "Tách quyền nền tảng (chỉ platform.*)",
  "tenantno-unique": "tenantNo duy nhất + bất biến",
  "allocator-min": "Bộ cấp số khách hàng ≥ 11",
};
