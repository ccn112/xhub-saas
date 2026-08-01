# TENANT BACKUP & RESTORE — GAP ANALYSIS

_Nguồn handoff: `D:\Code\handoff\Xhub\XTECH_XHUB_IDENTITY_ORG_TENANT_BACKUP_HANDOFF_20260729` (docs/06,07,08; ADR-015; contracts)._
_Audit read-only, 2026-07-29. KHÔNG sửa code/seed._

## 0. Nguyên tắc (ADR-015 + docs/06,07,08 + CLAUDE.md handoff)

- Ngoài platform backup (PostgreSQL full + PITR, object storage versioning, infra/config), **mỗi tenant có 1 logical backup package độc lập**, retention riêng, restore job riêng (ADR-015).
- Package **KHÔNG chứa secret/credential** (password hash nếu IdP ngoài, MFA secret, refresh/access token, connector secret, vault secret, encryption master key).
- Manifest chỉ lưu **key reference**, không lưu khóa bí mật; package mã hóa khi lưu & truyền.
- Backup ghi **consistency fence**: database snapshot/watermark, outbox watermark, object version IDs, schema version, application release version.
- **Restore luôn sandbox/dry-run trước production**; phải quét marker cấm (`MUST_NOT_LEAK`, tenant khác, key/secret) và **remap identity subject có kiểm soát**.

---

## 1. Hiện trạng code (evidence)

| Khía cạnh | Hiện trạng | Evidence |
|---|---|---|
| Backup/export logic | **KHÔNG có** bất kỳ backup/restore/export/dump nào | Audit toàn bộ `xhub-api/src/xoffice/*` + `prisma/schema.prisma`: không tồn tại |
| Khái niệm gần nhất | `rebuildProjection` / `listWorkItems` — xoá & tái tạo `UnifiedWorkItem` từ source (projection rebuild, KHÔNG phải backup) | `xhub-api/src/xoffice/xoffice.service.ts:1441-1466`; `prisma/schema.prisma:255-276` |
| Namespace lưu trữ per-tenant | **KHÔNG có** `xhub-data/tenants/{tenant_id}/...` hay `xhub-backups/...` | Không tồn tại |
| Consistency fence | **KHÔNG có** watermark/outbox/object-version/schema-version | Không tồn tại (outbox/webhook còn là nợ P1 — `PROJECT_STATUS_XHUB.md` §5B) |
| Encryption package | **KHÔNG có** | Không tồn tại |
| Marker cấm | Seed canary `MUST_NOT_LEAK` tồn tại (dùng cho isolation test), nhưng chưa có bước quét trong backup/restore | `xhub-api/seed-data/xoffice/role-bindings.json` (ROLE_SECRET/MUST_NOT_LEAK); `handoff/seed/demo-isolation.seed.json` |
| Isolation nền tảng | Chặn tầng service + `assertTenant` chặn `demo-isolation`; **scheduler sweep quét mọi tenant rồi lọc trong code** (rủi ro nếu thiếu RLS) | `xoffice.service.ts:221-226`, sweep lọc `slug==='demo-isolation'` |

**Nhận định:** đây là **gap toàn phần** — chưa có gì thuộc năng lực tenant logical backup/restore. Cần xây từ đầu theo ADR-015 + contracts `tenant-backup-manifest.schema.json` và `restore-job.schema.json`.

---

## 2. Cấu trúc backup package mục tiêu (docs/06)

```
Tenant Logical Backup Package
├── manifest.json            # backupId, tenantId, createdAt, applicationVersion,
│                            # schemaVersion, databaseWatermark, outboxWatermark,
│                            # sourceMode, datasets, fileInventory, excludedData,
│                            # checksums, encryption{algorithm,keyReference}, signature
├── relational-data/         # dữ liệu quan hệ theo tenant
├── files/                   # binary attachments/document versions
├── file-inventory.json      # object count + checksum + version
├── workflow-form-versions/  # published version (immutable)
├── identity-org-overlay/    # membership, profile, org (Standalone) / overlay (Federated)
├── permissions-delegations/ # role binding, data scope, group, queue, delegation
├── tenant-configuration/    # branding, preference, menu
├── audit-export/            # audit append-only
├── source-references/       # con trỏ tới hệ ngoài (không copy master)
└── checksums.sha256
```

Namespace: `xhub-data/tenants/{tenant_id}/records|attachments/...`; `xhub-backups/tenants/{tenant_id}/{backup_id}/...`.

Manifest bắt buộc (contract): `backupId, tenantId, createdAt, applicationVersion, schemaVersion, databaseWatermark, fileInventory, checksums, encryption`. `encryption` bắt buộc `{algorithm, keyReference}` — **không lưu khoá**.

---

## 3. Phân loại dữ liệu backup (docs/08)

| Nhóm | Ví dụ | Vào backup tenant? | Yêu cầu | Bảng/nguồn hiện tại |
|---|---|---|---|---|
| Public/internal config | branding, menu | Có | checksum/version | seed-data collections, navigation-preferences |
| Personal data | user profile, membership | Có | encryption + access audit | (chưa có model — xem Identity gap) |
| Sensitive business | workflow, approval, document metadata | Có | encryption + retention | Workflow/Version, WorkflowInstance, ApprovalTask, AuditLog |
| File binary | attachment, document version | Có | object version + checksum | (attachments backend chưa có — nợ P1) |
| Derived projection | inbox/search/dashboard | Tùy chọn (ưu tiên rebuild) | rebuildable | `UnifiedWorkItem` (đã rebuildable) |
| Credentials/secrets | password, token, API key | **KHÔNG** | restore qua IdP/Vault | (không lưu trong DB — đúng) |
| Platform global config | plan/catalog toàn cục | **KHÔNG** | platform backup riêng | connector-catalog, node-catalog (global) |

Package phải ghi `excludedData` + lý do (contract có field `excludedData`).

### MUST_NOT_LEAK — bảng loại trừ/kiểm tra bắt buộc
- Backup X-TECH **không được** chứa dữ liệu tenant `demo-isolation` / chuỗi `MUST_NOT_LEAK` / bất kỳ secret/token/key nào.
- Restore phải quét marker cấm (docs/07 bước 6): tenant khác, `MUST_NOT_LEAK`, key/secret.
- Acceptance (docs/11): "Package chỉ chứa đúng một tenant"; "`MUST_NOT_LEAK` không xuất hiện trong backup X-TECH".

---

## 4. Restore runbook mục tiêu (docs/07) + gap

Trình tự 16 bước: tạo RestoreJob → verify checksum/manifest/schema → giải mã sandbox quyền hạn chế → quét malware + validate inventory → kiểm tra tenant ID duy nhất → **quét marker cấm** → identity reconciliation plan → conflict plan → restore sandbox + rebuild projection/search/cache → smoke/permission/workflow-assignment/isolation tests → duyệt production → write-fence → apply theo mode → rebuild derived state → post-restore verify → gỡ fence + `RestoreAudit`.

Restore mode (contract `restore-job.schema.json`): `FULL_REPLACE_TENANT` / `POINT_IN_TIME_TENANT` / `SELECTIVE_MODULE_RESTORE` / `FILES_ONLY` / `CONFIG_ONLY`. Status machine: `REQUESTED→VALIDATING→SANDBOX_RESTORING→CONFLICT_REVIEW→APPROVED→APPLYING→VERIFYING→COMPLETED|FAILED|ROLLED_BACK`. MVP ưu tiên `FULL_REPLACE_TENANT` trong sandbox; `SELECTIVE_MODULE_RESTORE` chỉ sau khi có conflict engine tin cậy.

**Gap:** không có RestoreJob model/state machine, không có verify checksum, không có sandbox, không có identity reconciliation (remap subject), không có conflict engine, không có isolation/smoke test post-restore, không có RestoreAudit.

**Identity remap:** vì Identity Core chưa có `PersonProfile`/UUID/`ExternalIdentityReference` (xem `IDENTITY_ORG_GAP_ANALYSIS.md`), remap identity subject khi restore hiện **bất khả thi** — phụ thuộc P0 của Identity.

---

## 5. Backlog

### P0 (khung backup/restore tối thiểu cho vertical slice X-TECH)
- P0-1: `BackupManifest` + `RestoreJob` Prisma models theo contracts; BackupJob & RestoreJob state machine.
- P0-2: Logical export per-tenant (relational + file-inventory + manifest + checksums.sha256) cho X-TECH; ghi `excludedData` + `encryption{keyReference}`.
- P0-3: Consistency fence tối thiểu (schemaVersion + applicationVersion + database/outbox watermark; pilot có thể write-fence ngắn).
- P0-4: **Bước quét MUST_NOT_LEAK / tenant khác / secret** trong export & restore; test "package chỉ 1 tenant".
- P0-5: Restore **sandbox FULL_REPLACE_TENANT** + rebuild projection (`rebuildProjection`) + isolation/smoke test trước production.

### P1
- P1-1: Encryption abstraction (mã hóa lưu & truyền, per-tenant DEK/encryption context, manifest chỉ keyReference) + signature.
- P1-2: File binary backup (object version) — phụ thuộc attachments backend (nợ P1 hiện tại).
- P1-3: Identity reconciliation / remap subject (phụ thuộc P0 Identity: PersonProfile UUID + ExternalIdentityReference).
- P1-4: Conflict engine + `SELECTIVE_MODULE_RESTORE`; retention policy; Backup Admin UI.

### P2
- P2-1: `POINT_IN_TIME_TENANT` + tích hợp PITR nền tảng.
- P2-2: Restore drill định kỳ X-TECH + báo cáo RPO/RTO thực tế (acceptance docs/11).
- P2-3: sourceMode-aware backup (Standalone: org đầy đủ; Federated: chỉ overlay + external reference).
