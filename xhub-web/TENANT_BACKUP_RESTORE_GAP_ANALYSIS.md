# TENANT BACKUP & RESTORE — GAP ANALYSIS

> Docs-first BẮT BUỘC (handoff `XTECH_XHUB_XOFFICE_STANDALONE_SAAS_HANDOFF_20260729`).
> Đối chiếu READ-ONLY, KHÔNG sửa code. Ngày 2026-07-29 · Tenant `xtech` · Tenant isolation `demo-isolation` (marker `MUST_NOT_LEAK`).

## 0. Nguồn
- `handoff\...\docs\04_TENANT_FILE_BACKUP_RESTORE.md`
- `handoff\...\contracts\backup-manifest.schema.json`, `tenant-storage-policy.schema.json`
- `handoff\...\config\backup-policy.example.yaml`, `tenant-xtech.example.yaml`
- `handoff\...\api\openapi-outline.yaml` (paths `/api/tenants/{tenantKey}/backups`, `/restores/*`)
- `handoff\...\tests\TENANT_BACKUP_RESTORE_TEST_PLAN.md`
- Code hiện có: `D:\Code\xhub-api\prisma\schema.prisma`, `D:\Code\xhub-api\src\**`

## 1. Kết luận nhanh: GAP TOÀN PHẦN

Grep toàn `xhub-api/src` và `prisma/` cho `backup|restore|manifest|checksum|s3|minio|signedUrl|malware|objectStorage` → **0 hit** (trừ chuỗi trong `xoffice.types.ts`). Nghĩa là **chưa có bất kỳ hạ tầng backup/restore per-tenant nào**, cũng chưa có object storage để backup file. Đây là gap toàn phần; phần dưới đề xuất thiết kế bám `contracts/backup-manifest` + `docs/04`.

## 2. Hai lớp backup bắt buộc (docs 04) vs hiện trạng

| Lớp | Yêu cầu | Hiện trạng |
|---|---|---|
| A. Platform backup | PG full + WAL/PITR (RPO 15'), object storage versioning, config backup, DR runbook (RTO 4h) | ❌ Chưa tài liệu hóa/chưa có trong repo app; thuộc hạ tầng vận hành |
| B. Tenant backup package | Logical export/restore riêng từng tenant, độc lập, có manifest+checksum | ❌ Không có |

Lưu ý kiến trúc (docs 04): shared DB + PITR khôi phục toàn cluster tại một mốc → **không thể phục hồi 1 tenant mà không ghi đè tenant khác**. Do đó BẮT BUỘC có lớp B (logical tenant export/restore). Đây là lý do tồn tại của toàn bộ workstream Sprint 3.

## 3. Nội dung Tenant backup package (đối chiếu manifest schema)

`backup-manifest.schema.json` yêu cầu: `backupId, tenantId, createdAt, applicationVersion, schemaVersion, objects[], checksums.manifestSha256` (bắt buộc) + `snapshotAt, backupType(DAILY/WEEKLY/MONTHLY/ON_DEMAND/PRE_MIGRATION), encryption{algorithm,keyReference,context}, dataExports[]{domain,file,recordCount,sha256}, projectionRebuild[], excludes[]`.

| Thành phần package (docs 04) | Nguồn dữ liệu hiện có | Trạng thái |
|---|---|---|
| `manifest.json` | — | ❌ |
| Dữ liệu nghiệp vụ lọc theo tenant | `Workflow/WorkflowInstance/ApprovalTask/WorkflowEvent/AuditLog/Notification/Delegation/ConnectorCommand/CommandLog/UnifiedWorkItem` (đều có `tenantId`) | 🟡 dữ liệu có sẵn để export, chưa có exporter |
| File objects của tenant | — (chưa có object storage) | ❌ |
| Metadata hồ sơ + version | — (chưa có DocumentRecord/Version) | ❌ |
| Workflow/form definitions đã publish | `WorkflowVersion` (immutable + checksum) | 🟡 có sẵn, chưa export |
| Policy/config tenant | `Tenant` (chỉ slug/name); chưa có storage/retention policy | 🟡 tối thiểu |
| Source references | `ConnectorCommand.sourceRef`, `UnifiedWorkItem.source*` | 🟡 có sẵn |
| Audit export theo policy | `AuditLog` (append-only) | 🟡 có sẵn |
| Checksum inventory | — | ❌ |
| Schema/application version | `Workflow.schemaVersion`; app version chưa gắn manifest | 🟡 |
| Encryption + key reference metadata | — | ❌ |
| Projection rebuild instructions | `rebuildProjection(tenantId)` (`xoffice.service.ts:1441`) đã rebuildable | 🟡 có cơ chế, chưa mô tả trong manifest |
| **KHÔNG chứa secret/credential** | Không có secret store nên chưa rủi ro, nhưng phải thành rule khi build exporter | ⚠️ enforce khi build |

## 4. Tenant storage policy (đối chiếu `tenant-storage-policy.schema.json`)
Yêu cầu `tenantId, storageMode(SHARED_PREFIX/DEDICATED_BUCKET/DEDICATED_ACCOUNT), rootPrefix, encryptionMode(PLATFORM_KMS_CONTEXT/TENANT_DEK/TENANT_KMS_KEY), backupPolicyId` + `objectVersioning, malwareScanRequired, retentionPolicyId`.
- Hiện trạng: ❌ không có bảng/loại TenantStoragePolicy, không có namespace `s3://xhub-data/tenants/{tenant}/...`. Cần model + resolver để mọi object key được sinh từ policy (không lấy tenant từ path client gửi — docs 04).

## 5. Quy trình restore (docs 04, 12 bước) vs hiện trạng
Chưa có endpoint `/api/tenants/{tenantKey}/restores`, `/restores/{id}/dry-run`, `/restores/{id}/apply` (mới chỉ là outline). Cần hiện thực đủ:
1. Chọn package + verify chữ ký/checksum → 2. Restore vào **sandbox** namespace/db tạm → 3. Schema compat + migration dry-run → 4. Kiểm marker (không lẫn tenant khác) → 5. Đối chiếu số lượng record/file/version/audit → 6. Conflict plan (overwrite/merge/new-tenant-clone/point-in-time-clone) → 7. Process Owner + Security Owner duyệt → 8. Đóng băng ghi trong cửa sổ restore → 9. Restore business+file → 10. Rebuild projection/search/cache (`rebuildProjection` tái dùng được) → 11. Smoke + permission + `MUST_NOT_LEAK` tests → 12. Mở lại tenant + ghi `RestoreAudit`.

**CẤM (docs 04)**: restore package chưa kiểm vào production; raw full DB restore đè tenant đang phục vụ; gộp nhiều tenant vào một export; backup không mã hóa trên máy dev; xóa backup ngoài quy trình disposition/audit.

## 6. `MUST_NOT_LEAK` (acceptance gate 11)
- Test yêu cầu (docs 11 + test plan): package X-TECH chỉ chứa dữ liệu/file X-TECH; manifest+checksum validate; dry-run trong sandbox chạy; restore rebuild projection/search; RestoreAudit ghi approver/operator/time/result; `demo-isolation` KHÔNG xuất hiện trong package hay restore X-TECH.
- Hiện trạng: đã có isolation test tầng service/DB (status: isolation → 404), nhưng **chưa có test ở tầng export/restore/storage**. Đây là điều kiện go-live.

## 7. Backlog P0/P1 (ánh xạ CSV)

| ID | Prio | Nội dung | Acceptance |
|---|---|---|---|
| XO-S3-001 | P0 | Tenant logical export package + manifest | Package `xtech` validate, loại trừ `demo-isolation` |
| XO-S3-002 | P0 | File inventory + checksum + đóng gói mã hóa | Mọi object trong package khớp manifest (SHA-256) |
| XO-S3-003 | P0 | Sandbox dry-run + conflict plan + apply | X-TECH restore drill PASS |
| XO-S3-004 | P0 | Rebuild projection/search/cache sau restore | Critical journey chạy lại được (tái dùng `rebuildProjection`) |
| XO-S3-005 | P1 | Backup/restore admin UI + audit | Operator xem được run + evidence |
| (nền) XO-S2-002 | P0 | Tenant-scoped object key + signed URL | Điều kiện tiên quyết để có "file objects" đưa vào package |

## 8. Đề xuất thiết kế (không code, chỉ hướng)
- **Model mới**: `TenantStoragePolicy`, `TenantBackupRun`(+manifest Json+checksum), `TenantRestoreRequest`(status: DRAFT/DRY_RUN_OK/APPROVED/APPLIED/FAILED + approvers), `RestoreAudit`. Object storage abstraction (S3/MinIO) với key sinh từ policy `rootPrefix`.
- **Exporter**: duyệt theo `tenantId` trên các bảng ở §3, ghi `dataExports[]` + `objects[]` + tính SHA-256, gắn `applicationVersion/schemaVersion`, `projectionRebuild: ["UnifiedWorkItem"]`, `excludes: ["secrets","credentials"]`. Mã hóa package, `encryption.context` chứa `tenantId`.
- **Restore**: bơm vào schema/namespace sandbox (`storageMode` riêng), chạy 12 bước; endpoint theo `api/openapi-outline.yaml`.
- **Rule enforce**: không bao giờ đưa secret; luôn kiểm marker `MUST_NOT_LEAK`; ký + checksum bắt buộc trước apply.

## 9. Kết luận
Backup/restore per-tenant là **gap toàn phần** — chưa có dòng code nào. Tuy nhiên nền tảng thuận lợi: mọi bảng đã mang `tenantId`, `WorkflowVersion` immutable + checksum, `rebuildProjection` idempotent → exporter/restore có thể xây trực tiếp trên dữ liệu hiện có. Điều kiện tiên quyết là hoàn tất object storage tenant-scoped (Sprint 2) trước khi đóng gói "file objects" (Sprint 3).
