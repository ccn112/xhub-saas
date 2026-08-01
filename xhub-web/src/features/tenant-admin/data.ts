// Tenant Admin (TA) shared data layer.
//
// Rules (handoff docs/00,01,03,08,11 + gap analysis):
//   - FE never touches the DB. Where a real BFF endpoint exists (/api/backup),
//     call it and DEGRADE GRACEFULLY. Where it does not exist yet, compose the
//     app's existing tenant-scoped seed collections + the TA structure catalog
//     from the handoff so screens render meaningfully (never hardcode secrets).
//   - Tenant comes from the canonical session tenant, not from query/body.
//   - IdP owns credentials/MFA — user detail shows external identities only
//     (references), never secrets.
import { collection, indexById, CANONICAL_TENANT_ID } from "@/xhub/lib/seed";
import type { Tone } from "@/xhub/ui/Badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface SeedUser {
  id: string; tenantId?: string; name: string; email: string; title?: string;
  departmentId?: string; primaryRole?: string; phone?: string; status: string; presence?: string;
}
export interface SeedRole { id: string; name: string; permissions: string[] }
export interface SeedUserRole { userId: string; roleId: string }
export interface SeedOrg { id: string; name: string; type: string; parentId: string | null; code?: string }

export interface AdminUser {
  id: string; name: string; email: string; title: string; department: string;
  departmentId?: string; status: "active" | "suspended" | "invited"; presence: string;
  roleNames: string[]; roleCodes: string[]; phone?: string;
  externalIdentities: ExternalIdentity[];
}
export interface ExternalIdentity { provider: string; subject: string; mfa: boolean; lastLogin?: string }

export interface OrgUnit { code: string; name: string; type: string; parent: string | null; headPosition: string | null }
export interface Position { code: string; name: string; orgUnit: string; holder: string; person: string; id?: string; holderId?: string }

export interface RoleCatalogEntry { code: string; name: string; permissions: string[]; restricted: string[] }

export interface Delegation {
  id: string; fromPerson: string; toPerson: string; scope: string;
  fromAt: string; toAt: string; status: "active" | "scheduled" | "expired"; reason: string; conflict?: string;
}
export interface DataScope {
  id: string; name: string; dimension: string; operator: string; values: string[];
  boundRole: string; note?: string;
}
export interface BackupJob {
  id: string; label: string; mode: string; status: string; createdAt: string;
  sizeBytes: number; recordCount: number; fileCount: number; checksumStatus: string; encrypted: boolean;
}
export interface RestoreJob {
  id: string; backupId: string; target: string; state: string; requestedBy: string; requestedAt: string;
  conflicts: number; approvedBy?: string | null;
}

// ---------------------------------------------------------------------------
// TA structure catalog (from handoff data/{org_units,positions,role_catalog,
// backup_policy}). This is the shared admin layer the Identity/Org Core will
// own once its BFF is live; embedded here so screens render before that.
// ---------------------------------------------------------------------------
export const ORG_UNITS: OrgUnit[] = [
  { code: "XTECH", name: "Công ty X-TECH", type: "LEGAL_ENTITY", parent: null, headPosition: "POS-CEO" },
  { code: "EXEC", name: "Ban Điều hành", type: "DIVISION", parent: "XTECH", headPosition: "POS-CEO" },
  { code: "FIN", name: "Tài chính - Kế toán", type: "DEPARTMENT", parent: "XTECH", headPosition: "POS-CFO" },
  { code: "SALES", name: "Kinh doanh", type: "DEPARTMENT", parent: "XTECH", headPosition: "POS-SALES-HEAD" },
  { code: "TECH", name: "Công nghệ", type: "DEPARTMENT", parent: "XTECH", headPosition: "POS-TECH-HEAD" },
  { code: "HR", name: "Nhân sự", type: "DEPARTMENT", parent: "XTECH", headPosition: "POS-HR-HEAD" },
  { code: "ADMIN", name: "Hành chính", type: "DEPARTMENT", parent: "XTECH", headPosition: "POS-ADMIN-HEAD" },
  { code: "DELIVERY", name: "Triển khai", type: "DEPARTMENT", parent: "TECH", headPosition: "POS-DELIVERY-HEAD" },
  { code: "SOLUTION", name: "Giải pháp", type: "DEPARTMENT", parent: "SALES", headPosition: "POS-SOLUTION-HEAD" },
  { code: "SUPPORT", name: "Hỗ trợ khách hàng", type: "DEPARTMENT", parent: "TECH", headPosition: "POS-SUPPORT-HEAD" },
];

export const POSITIONS: Position[] = [
  { code: "POS-CEO", name: "Tổng Giám đốc", orgUnit: "EXEC", holder: "usr-ceo", person: "Trần Mạnh Tuấn" },
  { code: "POS-CFO", name: "Giám đốc Tài chính", orgUnit: "FIN", holder: "usr-cfo", person: "Nguyễn Hoài Nam" },
  { code: "POS-SALES-HEAD", name: "Trưởng phòng Kinh doanh", orgUnit: "SALES", holder: "usr-sales-head", person: "Trần Thu Hà" },
  { code: "POS-TECH-HEAD", name: "Trưởng phòng Công nghệ", orgUnit: "TECH", holder: "usr-tech-head", person: "Phạm Anh Khoa" },
  { code: "POS-HR-HEAD", name: "Trưởng phòng Nhân sự", orgUnit: "HR", holder: "usr-hr-head", person: "Nguyễn Lan Phương" },
  { code: "POS-ADMIN-HEAD", name: "Trưởng phòng Hành chính", orgUnit: "ADMIN", holder: "usr-admin-head", person: "Lê Thu Trang" },
  { code: "POS-DELIVERY-HEAD", name: "Trưởng nhóm Triển khai", orgUnit: "DELIVERY", holder: "usr-delivery-head", person: "Lê Minh Anh" },
  { code: "POS-SOLUTION-HEAD", name: "Trưởng nhóm Giải pháp", orgUnit: "SOLUTION", holder: "usr-solution-head", person: "Đỗ Minh Quân" },
  { code: "POS-SUPPORT-HEAD", name: "Trưởng nhóm Hỗ trợ", orgUnit: "SUPPORT", holder: "usr-support-head", person: "Vũ Ngọc Bảo" },
];

export const ROLE_CATALOG: RoleCatalogEntry[] = [
  { code: "TENANT_ADMIN", name: "Quản trị tenant", permissions: ["tenant.read", "tenant.update", "membership.manage", "org.manage", "role.bind", "delegation.manage", "backup.read", "restore.request"], restricted: ["platform.superadmin", "backup.decrypt_key", "credential.read_secret"] },
  { code: "ORG_ADMIN", name: "Quản trị tổ chức", permissions: ["membership.read", "org.manage", "position.manage", "reporting_line.manage", "assignment.simulate"], restricted: ["role.permission_definition", "backup.restore_apply"] },
  { code: "SECURITY_ADMIN", name: "Quản trị an toàn và phân quyền", permissions: ["role.manage", "permission.manage", "data_scope.manage", "access.test_as_user", "audit.read"], restricted: ["business.approve_on_behalf", "backup.decrypt_key"] },
  { code: "WORKFLOW_ADMIN", name: "Quản trị workflow", permissions: ["workflow.manage", "assignment.simulate", "delegation.read", "org.read", "role.read"], restricted: ["membership.manage", "backup.restore_apply"] },
  { code: "BACKUP_ADMIN", name: "Quản trị backup và restore", permissions: ["backup.read", "backup.run", "backup.verify", "restore.create_sandbox", "restore.view_conflicts", "restore.request_apply"], restricted: ["backup.decrypt_key", "restore.approve_own_request"] },
  { code: "AUDITOR", name: "Kiểm toán viên", permissions: ["audit.read", "backup.read", "restore.read", "permission.read", "assignment.snapshot.read"], restricted: ["data.mutate", "restore.apply", "role.bind"] },
];

/** Superset of permissions across the catalog — matrix columns. */
export const ALL_PERMISSIONS: string[] = Array.from(
  new Set(ROLE_CATALOG.flatMap((r) => [...r.permissions, ...r.restricted])),
).sort();

export const BACKUP_POLICY = {
  tenantKey: "xtech",
  backupMode: "LOGICAL_TENANT_PACKAGE",
  schedule: { daily: "02:00", weekly: "Chủ nhật 03:00", monthly: "Ngày 1 · 04:00", timezone: "Asia/Ho_Chi_Minh" },
  retention: { dailyCopies: 35, weeklyCopies: 12, monthlyCopies: 12 },
  targets: { logicalBackupRpoHours: 24, tenantRestoreRtoHours: 8, platformPitrRpoMinutes: 15, platformRtoHours: 4 },
  requiredContents: ["tenant_config", "memberships", "org_units", "positions", "reporting_lines", "role_bindings", "data_scopes", "delegations", "workflow_versions", "form_versions", "requests", "tasks", "documents", "file_inventory", "source_references", "audit_export"],
  excludedContents: ["passwords", "mfa_secrets", "access_tokens", "refresh_tokens", "api_keys", "connector_secrets", "vault_secrets", "master_encryption_keys"],
} as const;

// ---------------------------------------------------------------------------
// Delegations & data scopes (demo shared-layer datasets — no equivalent seed).
// ---------------------------------------------------------------------------
export const DELEGATIONS: Delegation[] = [
  { id: "dlg-001", fromPerson: "Nguyễn Hoài Nam", toPerson: "Lê Minh Anh", scope: "Phê duyệt tài chính ≤ 200tr", fromAt: "2026-07-28T00:00:00+07:00", toAt: "2026-08-05T23:59:00+07:00", status: "active", reason: "CFO đi công tác" },
  { id: "dlg-002", fromPerson: "Trần Mạnh Tuấn", toPerson: "Nguyễn Hoài Nam", scope: "Phê duyệt mua sắm toàn tenant", fromAt: "2026-08-10T00:00:00+07:00", toAt: "2026-08-14T23:59:00+07:00", status: "scheduled", reason: "TGĐ nghỉ phép" },
  { id: "dlg-003", fromPerson: "Trần Thu Hà", toPerson: "Trần Minh Quân", scope: "Duyệt báo giá phòng Kinh doanh", fromAt: "2026-07-01T00:00:00+07:00", toAt: "2026-07-15T23:59:00+07:00", status: "expired", reason: "Nghỉ thai sản (đã hết hiệu lực)" },
  { id: "dlg-004", fromPerson: "Phạm Anh Khoa", toPerson: "Phạm Anh Khoa", scope: "Duyệt triển khai", fromAt: "2026-07-20T00:00:00+07:00", toAt: "2026-07-25T23:59:00+07:00", status: "expired", reason: "Tự uỷ quyền — vi phạm guardrail", conflict: "SELF_DELEGATION" },
];

export const DATA_SCOPES: DataScope[] = [
  { id: "scope-sales-region", name: "Kinh doanh — Miền Bắc", dimension: "org_unit", operator: "IN", values: ["SALES", "SOLUTION"], boundRole: "SECURITY_ADMIN", note: "Chỉ thấy dữ liệu khách hàng khu vực phụ trách" },
  { id: "scope-fin-all", name: "Tài chính — Toàn tenant", dimension: "tenant", operator: "EQ", values: ["xtech"], boundRole: "TENANT_ADMIN" },
  { id: "scope-delivery-project", name: "Triển khai — Dự án phụ trách", dimension: "project", operator: "IN", values: ["project-finerp-minhphat"], boundRole: "WORKFLOW_ADMIN" },
  { id: "scope-support-tickets", name: "Hỗ trợ — Ticket đơn vị", dimension: "org_unit", operator: "EQ", values: ["SUPPORT"], boundRole: "ORG_ADMIN" },
];

// Fallback backup/restore datasets when /api/backup is not yet up.
export const DEMO_BACKUPS: BackupJob[] = [
  { id: "bkp-20260808-0200", label: "Backup hằng ngày · 08/08", mode: "LOGICAL_TENANT_PACKAGE", status: "completed", createdAt: "2026-08-08T02:00:00+07:00", sizeBytes: 268_435_456, recordCount: 18452, fileCount: 214, checksumStatus: "PASS", encrypted: true },
  { id: "bkp-20260807-0200", label: "Backup hằng ngày · 07/08", mode: "LOGICAL_TENANT_PACKAGE", status: "completed", createdAt: "2026-08-07T02:00:00+07:00", sizeBytes: 260_000_000, recordCount: 18310, fileCount: 210, checksumStatus: "PASS", encrypted: true },
  { id: "bkp-20260804-0300", label: "Backup hằng tuần · 04/08", mode: "LOGICAL_TENANT_PACKAGE", status: "completed", createdAt: "2026-08-04T03:00:00+07:00", sizeBytes: 255_000_000, recordCount: 18050, fileCount: 205, checksumStatus: "PASS", encrypted: true },
  { id: "bkp-20260808-1130", label: "Backup thủ công (dry-run)", mode: "LOGICAL_TENANT_PACKAGE", status: "verifying", createdAt: "2026-08-08T11:30:00+07:00", sizeBytes: 0, recordCount: 0, fileCount: 0, checksumStatus: "PENDING", encrypted: true },
];

// Restore state machine — 11 canonical states (docs/03, no single "Restore" button).
export const RESTORE_STATES: { key: string; label: string }[] = [
  { key: "requested", label: "Yêu cầu" },
  { key: "validating", label: "Kiểm tra gói" },
  { key: "sandbox_provisioning", label: "Dựng sandbox" },
  { key: "restoring_sandbox", label: "Restore vào sandbox" },
  { key: "conflict_analysis", label: "Phân tích xung đột" },
  { key: "verification", label: "Xác minh dữ liệu" },
  { key: "approval_pending", label: "Chờ phê duyệt" },
  { key: "approved", label: "Đã phê duyệt" },
  { key: "applying", label: "Áp dụng" },
  { key: "completed", label: "Hoàn tất" },
  { key: "cancelled", label: "Đã huỷ" },
];

export const DEMO_RESTORES: RestoreJob[] = [
  { id: "rst-001", backupId: "bkp-20260807-0200", target: "sandbox", state: "verification", requestedBy: "Nguyễn Hoài Nam", requestedAt: "2026-08-08T08:15:00+07:00", conflicts: 3, approvedBy: null },
  { id: "rst-002", backupId: "bkp-20260804-0300", target: "sandbox", state: "approval_pending", requestedBy: "Nguyễn Hoài Nam", requestedAt: "2026-08-08T09:40:00+07:00", conflicts: 0, approvedBy: null },
  { id: "rst-003", backupId: "bkp-20260808-0200", target: "sandbox", state: "completed", requestedBy: "Trần Mạnh Tuấn", requestedAt: "2026-08-06T14:00:00+07:00", conflicts: 1, approvedBy: "Trần Mạnh Tuấn" },
];

// ---------------------------------------------------------------------------
// Derivations over the tenant-scoped seed
// ---------------------------------------------------------------------------
const DEPT_LABEL: Record<string, string> = {}; // filled lazily

function deptLabel(id?: string): string {
  if (!id) return "—";
  if (Object.keys(DEPT_LABEL).length === 0) {
    for (const o of collection<SeedOrg>("organizations")) DEPT_LABEL[o.id] = o.name;
  }
  return DEPT_LABEL[id] ?? id;
}

// A couple of synthetic external-identity references (IdP owns real values).
function externalIdentitiesFor(u: SeedUser): ExternalIdentity[] {
  return [
    { provider: "Azure AD (X-TECH)", subject: u.email, mfa: true, lastLogin: "2026-08-08T07:42:00+07:00" },
    ...(u.primaryRole === "executive" ? [{ provider: "Google Workspace", subject: u.email, mfa: true } as ExternalIdentity] : []),
  ];
}

export function getAdminUsers(): AdminUser[] {
  const users = collection<SeedUser>("users");
  const roles = indexById<SeedRole>("roles");
  const userRoles = collection<SeedUserRole>("userRoles");
  return users.map((u) => {
    const urs = userRoles.filter((ur) => ur.userId === u.id);
    const roleNames = urs.map((ur) => roles.get(ur.roleId)?.name ?? ur.roleId);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      title: u.title ?? "—",
      department: deptLabel(u.departmentId),
      departmentId: u.departmentId,
      status: (u.status as AdminUser["status"]) ?? "active",
      presence: u.presence ?? "offline",
      roleNames,
      roleCodes: urs.map((ur) => ur.roleId),
      phone: u.phone,
      externalIdentities: externalIdentitiesFor(u),
    } satisfies AdminUser;
  });
}

export function getAdminUser(id: string): AdminUser | undefined {
  return getAdminUsers().find((u) => u.id === id);
}

export function getRoles(): SeedRole[] {
  return collection<SeedRole>("roles");
}

export interface AuditEvent {
  id: string; actorId: string; action: string; entityType: string; entityId: string;
  at: string; ip: string; metadata?: Record<string, unknown>;
}
export function getAuditLogs(): AuditEvent[] {
  return collection<AuditEvent>("auditLogs");
}

export interface Connector { id: string; name: string; status: string; lastSyncAt?: string; latencyMs?: number; errorRate?: number }
export function getConnectors(): Connector[] {
  return collection<Connector>("connectors");
}

export const connectorTone: Record<string, Tone> = { healthy: "success", degraded: "warning", warning: "warning", down: "error", error: "error" };

export function humanBytes(n: number): string {
  if (!n) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0; let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}

export { CANONICAL_TENANT_ID };
