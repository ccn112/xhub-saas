# IMPLEMENTATION PLAN — Identity, Organization & Tenant Backup

_Nguồn: handoff docs/10 (Roadmap) + docs/11 (Acceptance Gates); đối chiếu `IDENTITY_ORG_GAP_ANALYSIS.md` + `TENANT_BACKUP_GAP_ANALYSIS.md`._
_2026-07-29. Tài liệu kế hoạch — chưa sửa code/seed. Mọi thay đổi thực thi ở giai đoạn sau._

## 0. Mục tiêu: một VERTICAL SLICE chạy được cho X-TECH

Chuỗi end-to-end chứng minh toàn bộ trục Identity → Approval → Permission → Backup → Restore → Isolation:

```
seed tổ chức X-TECH (từ xtech-identity-org.seed.json)
  → PILOT-01 phân công theo position/role (resolver snapshot + audit)
  → delegation hiệu lực (act on behalf, audit onBehalfOf)
  → permission scope (RBAC + ABAC / data scope)
  → logical backup X-TECH (manifest + checksum + excludedData, no secret)
  → restore vào sandbox (FULL_REPLACE_TENANT)
  → kiểm tra MUST_NOT_LEAK (package chỉ 1 tenant, không rò secret)
```

Acceptance của slice bám docs/11: không credential trong backup; workflow không hardcode người; org/version/effective-date audited; user disable không nhận task; delegation không vòng lặp; resolver deterministic + fallback; tenant ID từ session (không từ input); service test + RLS test chặn `demo-isolation`; backup 1 tenant; `MUST_NOT_LEAK` vắng mặt; restore sandbox PASS trước production.

---

## 1. Thứ tự triển khai theo Sprint (docs/10) và ưu tiên

| Bước | Sprint (docs/10) | Priority | Sản phẩm |
|---|---|---|---|
| A | I — Identity & Org Foundation | **P0** | Org Core models + seed X-TECH |
| B | II — Approval Resolver | **P0** | Resolver theo selector + snapshot |
| C | III — Permission & RLS | **P0/P1** | RLS Postgres (P0) + policy engine (P1) |
| D | IV — Tenant Backup Export | **P0** | Backup package X-TECH |
| E | V — Tenant Restore | **P0** | Restore sandbox + isolation test |
| F | VI — Federated Readiness | **P2** | SCIM/HRIS mode |

---

## 2. Ánh xạ file / model / endpoint sẽ đụng

### Prisma models mới (`xhub-api/prisma/schema.prisma`) — tất cả tenant-scoped + RLS
`OrgUnit`, `Position`, `ReportingLine`, `PersonProfile`, `EmploymentAssignment`, `TenantMembership`, `LegalEntity`, `Group`/`ProcessingQueue`, `RoleBinding` (thay seed phẳng), `DataScope`, `PermissionPolicy`, `DelegationPolicy` (nâng cấp `Delegation` hiện có), `ExternalIdentityReference`, `TenantMode`, `AssignmentResolution` (snapshot), `BackupManifest`, `RestoreJob`.

### Backend (`xhub-api/src/xoffice/` + module Identity Core mới)
- Identity/Org nên là **module shared riêng** (vd `src/identity/`), KHÔNG nhét vào XOffice (ADR-013). XOffice gọi qua service/contract.
- `xoffice.service.ts:912-917 resolveAssignee` → thay bằng resolver đa selector đọc Org Core + ghi `AssignmentResolution`.
- `xoffice.service.ts:1650-1657 findValidDelegate` / `Delegation` → nâng lên `DelegationPolicy` (scope + status + chống vòng lặp), chuyển về shared core.
- Isolation: bật RLS thay vì chỉ `assertTenant` (`xoffice.service.ts:221-226`) và tránh scheduler sweep quét mọi tenant.
- Backup/Restore: service + state machine mới; dùng lại `rebuildProjection` (`:1441-1466`) cho bước rebuild projection sau restore.

### Contracts nguồn (đã có trong handoff — tham chiếu, không sửa)
`contracts/org-unit`, `position`, `role-binding`, `assignment-resolution`, `delegation`, `tenant-backup-manifest`, `restore-job`.schema.json.

### Endpoints dự kiến
`/api/identity/org-units`, `/positions`, `/role-bindings`, `/memberships` (Identity Core);
`/api/xoffice/instances/:id/resolution` (đọc snapshot);
`/api/tenants/:id/backups` (POST tạo, GET list), `/api/tenants/:id/restore-jobs` (POST + state transitions).

### Seed
Nạp `handoff/.../seed/xtech-identity-org.seed.json` → Org Core (7 orgUnit, 6 position, 6 người, 3 roleBinding theo POSITION). Giữ `demo-isolation.seed.json` làm canary. **KHÔNG sửa seed hiện có** ở giai đoạn plan.

---

## 3. Chi tiết vertical slice

### Bước 1 — Seed tổ chức X-TECH (P0, Sprint I)
- Model + import `xtech-identity-org.seed.json`: OrgUnit cây (`type/parentId/path/validFrom/validTo`), Position (`isHead`, `reportsToPositionId`), PersonProfile (**UUID**, không dùng email làm khóa), EmploymentAssignment (người↔position), TenantMembership, RoleBinding subjectType=POSITION + scope + effective.
- Acceptance: org/version/effective-date audited.

### Bước 2 — PILOT-01 phân công theo position/role (P0, Sprint II)
- Resolver hỗ trợ selector: `POSITION`, `ORG_UNIT_HEAD`, `DIRECT_MANAGER`, `ORG_ROLE`, `GROUP`, `USER`, fallback chain.
- `RESOLVE_AT_TASK_CREATION`: ghi `AssignmentResolution` snapshot (input, selector, candidateUserIds, resolvedUserIds, policyVersion, orgVersion, delegationsApplied, fallbackApplied, auditReason).
- Exception policy: không tìm thấy / nhiều người / requester=approver / user khóa / delegation vòng lặp / delegate thiếu scope.
- Acceptance: không hardcode người; user disable không nhận task; resolver deterministic + fallback.

### Bước 3 — Delegation hiệu lực (P0/P1, Sprint II)
- `DelegationPolicy` (delegator/delegate/scope/window/status); apply trong resolver (`APPLY_EFFECTIVE_DELEGATION`) + tại act (giữ `onBehalfOf` + audit).
- Acceptance: delegation không tạo vòng lặp.

### Bước 4 — Permission scope RBAC/ABAC (P0 RLS / P1 policy, Sprint III)
- **P0:** bật Postgres RLS mọi bảng tenant-scoped; BFF set `app.tenant_id` từ **session** (không từ input không tin cậy); admin-bypass role riêng + audit.
- **P1:** PermissionPolicy `action+resource+scope+conditions` + DataScope + relationship checks; AI tool dùng chung permission context.
- Acceptance: tenant ID không từ input; service test + RLS test đều chặn `demo-isolation`; admin bypass audited.

### Bước 5 — Logical backup X-TECH (P0, Sprint IV)
- BackupJob state machine + export: relational-data, file-inventory, manifest (schema/app version, database + outbox watermark), checksums.sha256, `excludedData` + lý do, `encryption{algorithm,keyReference}`.
- **Loại trừ** credential/token/secret; ghi consistency fence.
- Acceptance: package chỉ 1 tenant; inventory khớp count/checksum/version; không password/token/secret.

### Bước 6 — Restore sandbox (P0, Sprint V)
- RestoreJob (`FULL_REPLACE_TENANT`, env `SANDBOX`): verify checksum/manifest/schema → giải mã sandbox → quét marker cấm → restore → `rebuildProjection` → smoke/permission/workflow-assignment/isolation tests → RestoreAudit. Chỉ duyệt production sau khi sandbox PASS.
- Acceptance: restore sandbox PASS trước production; projection/search rebuild được.

### Bước 7 — Kiểm tra MUST_NOT_LEAK (P0, gate cuối)
- Assert: backup X-TECH không chứa `demo-isolation` / `MUST_NOT_LEAK` / secret; restore sandbox không kéo tenant khác.
- Acceptance: `MUST_NOT_LEAK` không xuất hiện trong backup X-TECH; restore drill sinh báo cáo RPO/RTO.

---

## 4. Tổng hợp Backlog P0 / P1 / P2

### P0 (nền tảng + vertical slice)
- Org Core models + seed X-TECH (UUID PersonProfile).
- RoleBinding chuẩn (subjectType/scope/effective) thay `role-bindings.json` phẳng.
- Resolver đa selector + `AssignmentResolution` snapshot + exception policy.
- Postgres RLS + `app.tenant_id` từ session; bỏ phụ thuộc scheduler sweep.
- BackupManifest/RestoreJob models + export/restore X-TECH tối thiểu.
- Bước quét MUST_NOT_LEAK trong export & restore + restore sandbox FULL_REPLACE.

### P1
- PermissionPolicy (RBAC+ABAC) + DataScope + relationship checks + admin-bypass audit; AI tool cùng context.
- DelegationPolicy nâng cấp (scope/status/chống vòng lặp) về shared core.
- Group/ProcessingQueue + selector GROUP; fallback/escalation.
- Encryption abstraction + signature + retention; file binary backup (object version); identity reconciliation/remap; conflict engine + SELECTIVE_MODULE_RESTORE + Backup Admin UI.

### P2
- TenantMode STANDALONE/FEDERATED + ExternalIdentityReference.
- SCIM endpoints/adapters + HRIS source mode + migration dry-run.
- POINT_IN_TIME_TENANT + restore drill định kỳ + báo cáo RPO/RTO.

---

## 5. Ràng buộc kiến trúc (không được vi phạm)
- Identity/Org là shared platform domain; XOffice không sở hữu employee master; UI admin có thể ở XOffice/Tenant Admin nhưng backend là shared core.
- Không credential trong DB XHub/XOffice.
- Không hardcode người trong workflow; resolver snapshot + audit.
- Published workflow/form/permission version immutable.
- Backup không secret; restore luôn sandbox trước production + remap identity có kiểm soát.
