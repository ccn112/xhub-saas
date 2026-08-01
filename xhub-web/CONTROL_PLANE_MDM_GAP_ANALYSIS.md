# Control Plane + MDM + Sync — Gap Analysis

_Docs-first · READ-ONLY audit · 2026-07-29_
_Nguồn handoff: `handoff/Xhub/XTECH_XHUB_TENANT_CONTROL_PLANE_MDM_SYNC_HANDOFF_20260729`_
_Đối chiếu code: `xhub-api/src` (backend NestJS+Prisma), `xhub-web/src` (FE Next.js+Tailux)_

> Tài liệu này KHÔNG sửa code/seed. Chỉ đối chiếu hiện trạng với 9 năng lực Control Plane theo `docs/00_EXECUTIVE_DECISION.md` và đề xuất backlog P0/P1/P2 ánh xạ `backlog/IMPLEMENTATION_BACKLOG.csv` (CP-001…CP-030). Ranh giới SoR theo `data/SYSTEM_OWNERSHIP_MATRIX.csv`.

---

## 0. Tóm tắt điều hành

XHub hiện đã có **nền identity/membership + auth INTERNAL/STANDALONE + adapter seam** (khớp quyết định auth trong `docs/00`), **app catalog deep-link** (x1/x2/xweb) và **lớp vận hành workflow** (assignment resolution + delegation + connector command + idempotency ledger + projection rebuildable). Đây là điểm tựa tốt cho Sprint 1.

Tuy nhiên **6/9 năng lực Control Plane gần như chưa có backing model**:
- **App User Provisioning & Sync** (AppAccountBinding / ProvisioningCommand outbox / Conflict center) — CHƯA.
- **Shared Master Data Hub + overlay + governance/lineage** — CHƯA.
- **Ingestion 6.000 dự án X2BMS** (ImportJob / SourceRecord / staging / matching) — CHƯA.
- **Org/Position/Delegation/DataScope như domain chuẩn** — mới ở mức phẳng (roleCode→email, Delegation cơ bản).
- **Tách backup tenant vs platform** — CHƯA.
- **Reconciliation** — CHƯA (mới có projection rebuild-on-read cho work-items).

Không phát hiện vi phạm SoR: code hiện tại tôn trọng "app operational không vào MDM" và "connector→FinERP là delegated command" (xem `ExternalExecution`, `ConnectorCommand`).

---

## 1. Bảng đối chiếu 9 năng lực Control Plane

| # | Năng lực (docs/00) | Trạng thái | Evidence (file:dòng) |
|---|---|---|---|
| 1 | Identity + tenant membership | 🟡 CÓ nền, thiếu IdentityAccount chuẩn | `xhub-api/prisma/schema.prisma:335-345` (Membership); `xhub-api/src/auth/auth.service.ts:60-229`; `identity.guard.ts:11-19` |
| 2 | App enablement (bật app cho tenant) | 🔴 THIẾU model (chỉ có deep-link catalog + demo dashboard) | `xhub-web/src/xhub/config/member-apps.ts:15-40`; `xhub-web/src/app/(app)/admin/page.tsx:20-34` |
| 3 | Provisioning/sync user sang app | 🔴 THIẾU (không có AppAccountBinding/ProvisioningCommand) | grep 0 hit trong `xhub-api/src` (chỉ `xoffice/contracts/source-reference.ts`) |
| 4 | Mapping role/group/external-ID | 🟡 CÓ role→user phẳng, THIẾU AppRoleMapping versioned + externalId | `xhub-api/src/xoffice/xoffice.service.ts:76,868,924,972` (role-bindings.json) |
| 5 | Org/Position/Delegation/DataScope | 🟡 Delegation cơ bản CÓ; Org/Position/Scope THIẾU | `schema.prisma:219-231` (Delegation); `xoffice.service.ts:2011-2045` (onBehalfOf) |
| 6 | Shared Master Data + tenant overlay | 🔴 THIẾU (không có MasterRecord/TenantMasterOverlay) | grep 0 hit |
| 7 | Import/quality/dedup/lineage/governance | 🔴 THIẾU (không có ImportJob/SourceRecord/staging) | grep 0 hit |
| 8 | Backup/restore riêng tenant | 🔴 THIẾU (chưa tách tenant vs platform) | grep 0 hit; nợ đã ghi ở `TENANT_BACKUP_GAP_ANALYSIS.md` |
| 9 | Audit + reconciliation | 🟡 Audit CÓ; reconciliation THIẾU | `schema.prisma:270-282` (AuditLog); `285-310` (UnifiedWorkItem projection rebuildable); `312-328` (CommandLog idempotency) |

Chú thích: 🟢 đủ · 🟡 có nền/một phần · 🔴 thiếu.

---

## 2. ĐÃ CÓ (điểm tựa, khớp quyết định handoff)

### 2.1 Auth INTERNAL + STANDALONE + adapter seam ✅ khớp `docs/00`
- `auth.service.ts:47-58` ghi rõ "OIDC HOOK … replace `login()` with authorization-code flow … everything downstream stays identical" — đúng chủ trương "giữ provider adapter để chuyển sang OIDC/Keycloak/SAML sau" (`docs/00:18-24`).
- Session JWT cookie `xhub_session` httpOnly; precedence session → header → default (`auth.service.ts:194-228`).
- KHÔNG lưu credential trong DB (`schema.prisma:331-334` comment "carries NO credential/password/secret") — khớp ID-02 `SYSTEM_OWNERSHIP_MATRIX.csv:3` (Credential = PLATFORM_SECRET, không vào tenant backup).
- `Membership` model tenant-scoped, multi-tenant, có `switchTenant` chỉ khi hold membership (`auth.service.ts:172-187`).

### 2.2 App catalog (member-apps) ✅ một phần
- `member-apps.ts:15-40`: x1 (Meyland), x2 (X2-BMS), xweb — nhưng chỉ là **deep-link external launch**, KHÔNG có `provisioningMode`/`entitlement`/`ownerSystem` như `data/application-catalog.json` (xoffice NATIVE, xspace MOCK, finerp MANUAL…).
- `admin/page.tsx:20-34`: dashboard đọc seed (users/roles/orgs/connectors/tenants) — read-only demo, không phải TenantApplicationInstance thật.

### 2.3 Assignment resolution + delegation cơ bản ✅
- `resolveAssignee(slug, roleCode)` map role→user thật từ `role-bindings.json` (`xoffice.service.ts:972-`), gắn `assigneeUserId` vào ApprovalTask (`schema.prisma:198-199`).
- Delegation: `findValidDelegate` cho phép act on-behalf trong `[fromAt,toAt]`, chặn 403 người lạ, audit `onBehalfOf` (`xoffice.service.ts:2011-2045`; `schema.prisma:219-231`).

### 2.4 Lớp SoR/command/projection ✅ (nền cho năng lực 3 & 9)
- `ConnectorCommand` (`schema.prisma:135-154`): delegated command + `sourceRef` (SourceReference) + status pending/success/failed/manual — hình mẫu cho ProvisioningCommand.
- `ExternalExecution` (`schema.prisma:163-188`): MANUAL_TASK không bịa id giả, nhập referenceCode thật → SourceReference — khớp "manual/mock execution" (`docs/08:46`).
- `CommandLog` idempotency `@@unique(tenantId, idempotencyKey)` (`schema.prisma:312-328`) — khớp yêu cầu "mọi command có correlation/idempotency/audit" (`CLAUDE.md:20`).
- `UnifiedWorkItem` projection REBUILDABLE, không dual-write (`schema.prisma:285-310`) — hình mẫu cho reconciliation.

---

## 3. THIẾU (gap chi tiết + evidence)

### 3.1 App User Provisioning & Sync (Năng lực 2, 3, 4) — 🔴 P0
| Thiếu | Contract handoff | Ghi chú |
|---|---|---|
| `ApplicationDefinition` + `TenantApplicationInstance` | `data/application-catalog.json`; matrix APP-01/02 | Hiện chỉ deep-link `member-apps.ts`; chưa có provisioningMode/entitlement |
| `AppAccountBinding` (externalUserId, status 6 trạng thái) | `contracts/app-account-binding.schema.json` | grep 0 hit; matrix APP-03 |
| `AppRoleMapping` versioned | matrix APP-04 | role-bindings.json phẳng, không versioned |
| `ProvisioningCommand` outbox (idempotent/retry/DLQ) | `contracts/provisioning-command.schema.json`; `docs/08:4-16` | Có `CommandLog` idempotency nhưng chưa có outbox provisioning; `ConnectorCommand` là mẫu tham chiếu |
| `ProvisioningConflict` center | matrix APP-06; `docs/02` | Không auto-link thiếu bằng chứng (acceptance `docs/11:11`) |
| Sync modes NATIVE/MANUAL/PUSH/PULL/SCIM/WEBHOOK/DISABLED | `docs/02:23-30` | Chưa có |
| Deprovision impact plan (suspend membership → khóa từng app) | `docs/02:34-42`; acceptance `docs/11:9` | Chưa có |

### 3.2 Shared Master Data Hub + overlay + governance (Năng lực 6, 7) — 🔴 P0
| Thiếu | Contract handoff | Ghi chú |
|---|---|---|
| `MasterRecord` (5 entityType, visibility, version, lineageRefs, qualityScore) | `contracts/master-record.schema.json`; matrix MDM-01/02/03 | 5 lớp dữ liệu `docs/03:4-9` |
| `TenantMasterOverlay` (tags/owner/visibilityWithinTenant) | `contracts/tenant-master-overlay.schema.json`; matrix MDM-04 | Tenant không sửa canonical, chỉ overlay (`docs/03:34`) |
| `SourceRecord` immutable + lineage 9 trường | `contracts/source-record.schema.json`; matrix MDM-05; `docs/03:37-49` | rawPayloadHash, matchConfidence… |
| `MasterMergeDecision` (reviewer/audit) | matrix MDM-06; governance `docs/05` | Merge/split cần reviewer |
| Geography reference (Country/Province/District/Ward + successor) | matrix REF-01…06; `docs/03:4` | KHÔNG nhân bản per tenant (acceptance `docs/11:15`) |
| `MetadataTaxonomy` + lifecycle DRAFT→…→RETIRED | matrix MDM-07; `docs/05:14-21` | Global chỉ Platform Steward publish |
| `DataQualityIssue` + quality dashboard | matrix MDM-08; `docs/04:32-43` | 6 chiều chất lượng |

### 3.3 Ingestion 6.000 dự án X2BMS (Năng lực 7) — 🔴 P0
- Không có pipeline `staging → mapping → normalization → validation → geography → matching → duplicate review → publish → reconciliation` (`docs/04:7-21`).
- Không có `MasterDataImportJob` (10 status) `contracts/import-job.schema.json`.
- Seed mẫu sẵn sàng để dựng vertical slice: `seed/x2bms-project-import-sample.json` (2 record, có `duplicateCandidateOf` X2P-000001↔X2P-000002 — case fuzzy "X Riverside" cùng developer/địa bàn).
- Batch gate 0/1/2/3, không publish batch sau khi batch trước chưa reconciliation (`docs/04:24-29`).

### 3.4 Org/Position/Delegation/Scope như domain chuẩn (Năng lực 5) — 🟡 P1
- Hiện: roleCode→email phẳng (role-bindings.json) + Delegation cơ bản. Thiếu OrgUnit/Position/EmploymentAssignment (matrix ORG-02/03/04), DataScope, RBAC/ABAC. Đã ghi ở `IDENTITY_ORG_GAP_ANALYSIS.md`. **Phụ thuộc**: Identity/Org Core.

### 3.5 Tách backup tenant vs platform (Năng lực 8) — 🔴 P0/P1
- Chưa có `TenantBackupScope` (`contracts/tenant-backup-scope.schema.json`) với `sharedMasterHandling` REFERENCE_ONLY/REFERENCE_WITH_SNAPSHOT/PORTABLE_EXPORT (`docs/06:39-42`).
- Platform backup (global reference + canonical + lineage) vs tenant logical backup (membership/overlay/bindings/mappings) chưa tách (`docs/06`).
- MUST_NOT_LEAK: không password/token/secret trong tenant backup (acceptance `docs/11:29-30`).

### 3.6 Reconciliation (Năng lực 9) — 🟡 P0/P1
- Có projection rebuildable + audit + idempotency (§2.4) nhưng chưa có reconciliation cho: identity sync, MDM import batch, merge, backup/restore (`docs/06:44`; backlog CP-027, CP-030).

---

## 4. Ranh giới SoR — KHÔNG được vi phạm (tuân thủ hiện tại: OK)

- XHub Identity Core sở hữu IdentityAccount ID bất biến + membership; app sở hữu app-local state (`docs/02:15-20`). Không tái tạo master user cho từng app (`docs/12:14`).
- XHub MDM chỉ chứa shared master + overlay; KHÔNG chứa giao dịch app (BookingTransaction/ERPDocument/BuildingOperationalData = APPLICATION_OPERATIONAL, matrix X2-01/XB-01/ERP-01). Code hiện tôn trọng: `ExternalExecution`/`ConnectorCommand` là delegated command sang FinERP, không copy master.
- FinERP/Frappe HR/Mattermost giữ SoR riêng — XHub chỉ mapping externalUserId + delegated command.

---

## 5. Backlog P0 (ưu tiên, ánh xạ IMPLEMENTATION_BACKLOG.csv)

| CP | Hạng mục | Workstream | Trạng thái audit |
|---|---|---|---|
| CP-001 | Internal auth provider abstraction | Identity | 🟢 phần lớn CÓ (`auth.service.ts:47-58`) — cần tách interface adapter tường minh |
| CP-002 | IdentityAccount + secure session | Identity | 🟡 session CÓ; IdentityAccount model CHƯA (mới Membership) |
| CP-003 | Application catalog + tenant instances | Control Plane | 🔴 chỉ deep-link |
| CP-004 | AppAccountBinding | Control Plane | 🔴 CHƯA |
| CP-005 | App role/group mapping (versioned) | Control Plane | 🔴 role-bindings phẳng |
| CP-006 | Provisioning command/job (idempotent/retry/DLQ) | Integration | 🔴 CHƯA (có mẫu ConnectorCommand + CommandLog) |
| CP-007 | Provisioning conflict center | Integration | 🔴 CHƯA |
| CP-010 | Shared Master Data core (MasterRecord/SourceRecord/Overlay/lineage) | MDM | 🔴 CHƯA |
| CP-011 | Geography reference | MDM | 🔴 CHƯA |
| CP-012 | Organization/Developer master | MDM | 🔴 CHƯA |
| CP-013 | Real estate project master | MDM | 🔴 CHƯA |
| CP-015 | Import staging framework | MDM | 🔴 CHƯA |
| CP-016 | X2BMS 6000 project adapter | MDM | 🔴 CHƯA (có seed sample) |
| CP-017 | Normalization pipeline | MDM | 🔴 CHƯA |
| CP-018 | Duplicate matching engine | MDM | 🔴 CHƯA |
| CP-019 | Duplicate review UI | Frontend | 🔴 CHƯA |
| CP-021/022 | Master search + detail | Frontend | 🔴 CHƯA |
| CP-023/024 | Tenant backup scope + platform shared-data backup | Backup | 🔴 CHƯA |
| CP-026 | RLS + visibility policies | Security | 🔴 CHƯA (đang có agent khác thêm RLS) |
| CP-027 | Audit + correlation | Security | 🟡 audit CÓ, correlation MDM/backup CHƯA |
| CP-029 | E2E app provisioning | QA | 🔴 CHƯA |
| CP-030 | E2E 6000-project import rehearsal | QA | 🔴 CHƯA |

**P1**: CP-008/009 (Mattermost/FinERP adapter skeleton), CP-014 (taxonomy), CP-020 (quality dashboard), CP-025 (portable export), CP-028 (AI data steward).

---

## 6. Kết luận

- Sprint 1 khả thi nhanh vì auth/membership/adapter-seam đã có (chỉ cần nâng Membership → IdentityAccount + ApplicationDefinition/TenantApplicationInstance/AppAccountBinding).
- Khối lớn nhất là **MDM Hub + Ingestion 6.000 dự án** (Sprint 3-4) — hoàn toàn greenfield, nhưng đã có contracts + seed sample rõ ràng.
- Ràng buộc cứng: không auto-merge fuzzy, không import thẳng vào master, không nhân bản geography, không master user per app, không app-transaction vào MDM (`docs/12:13-19`).
- Phụ thuộc chéo: MDM & provisioning cần **Identity/Org Core** (IDENTITY_ORG_GAP_ANALYSIS) + **RLS Postgres** (đang triển khai) làm nền.
</content>
</invoke>
