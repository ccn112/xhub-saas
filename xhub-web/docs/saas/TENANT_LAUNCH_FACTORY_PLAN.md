# TENANT LAUNCH FACTORY PLAN

> Kế hoạch (docs-first, KHÔNG code) cho **Tenant Launch Factory** — dây chuyền provisioning tenant idempotent / retryable / audited / resumable.
> Grounded trên code `D:\Code\xhub-api` (đặc biệt `src/controlplane/*`, `src/backup/*`, `src/identity/*`) + handoff `docs/04_TENANT_LAUNCH_FACTORY.md`.
> Phase: **E4 — Tenant Launch Factory** (`PHASE_CATALOG.csv`), backlog `SAAS-040..045`. Non-negotiable **#8**: launch steps idempotent, retryable, audited.

## 0. Tài liệu liên quan

- `TENANT_REGISTRY_IMPLEMENTATION_PLAN.md` — bước đầu tiên (register tenant) + allocation tenantNo.
- `BLUEPRINT_SEED_PACK_PLAN.md` — bước apply blueprint + load seed pack.
- `PLATFORM_VS_TENANT_PERMISSION_PLAN.md` — quyền chạy launch (Platform Console).
- `T002_REAL_ESTATE_DEMO_PLAN.md` — launch thực tế đầu tiên (T001 dùng XHub tạo T002 — non-negotiable #12).
- `TENANT_NUMBERING_MIGRATION_PLAN.md` — allocation dải 011+.

## 1. Nguyên tắc cốt lõi: TÁI DÙNG outbox có sẵn, không tạo engine mới

Trong `src/controlplane/controlplane.service.ts` đã có sẵn một **outbox provisioning** hoàn chỉnh và đúng chuẩn #8 — ta dùng CHÍNH nó làm engine cho Launch Factory, chỉ nâng "đơn vị công việc" từ *bind 1 person vào 1 app* lên *một step của launch*:

| Thuộc tính #8 | Đã có trong control-plane (verified) |
|---|---|
| **Idempotent** | `ProvisioningCommand` unique `(tenantId, idempotencyKey)`; `createBinding()` phát hiện replay và trả lại result đã lưu (`tenantId_idempotencyKey`). |
| **Retryable** | `retryCommand()` chạy lại command `failed/conflict`, tăng `attempts`; `executeCommand()` cập nhật `pending→sent→completed/failed/conflict`. |
| **Audited / evidence** | mỗi command lưu `correlationId`, `attempts`, `result`, `sourceRef`, `error`, timestamps. |
| **Conflict handling** | `ProvisioningConflict` + conflict center (`listConflicts`). |
| **Resumable / drift** | `reconcile()` so bindings vs commands, báo `issues`, `consistent`. |

**Thiết kế:** một `TenantLaunch` = một chuỗi **LaunchStepCommand** (cùng khuôn `ProvisioningCommand`: `status/attempts/correlationId/idempotencyKey/result/error`). `POST /launches/{id}/run` = "drain outbox" chạy step kế tiếp còn `pending`, idempotent theo `idempotencyKey = launchId:stepKey`. Không phát minh state-machine mới; mượn đúng vòng đời `pending→sent→completed/failed/conflict` + `retry` + `reconcile`.

## 2. TenantLaunch request (contract)

Theo `contracts/tenant-launch-request.schema.json`:

```
TenantLaunchRequest {
  id, customerRef, requestedTenantClass, planId, blueprintId,
  seedPackIds[], status: DRAFT|APPROVED|ALLOCATING|PROVISIONING|VERIFYING|
                          READY_FOR_HANDOVER|COMPLETED|FAILED|CANCELLED
}
```

`status` của request map 1-1 với tiến độ chuỗi step (§3). Mỗi launch gắn `launchId` (dùng cho `correlationId` xuyên suốt evidence, giống `correlationId` trong control-plane).

## 3. Chuỗi step (ordered, mỗi step idempotent + audited + retryable + resumable)

Từ `docs/04_TENANT_LAUNCH_FACTORY.md` (luồng chuẩn) + backlog E4, ánh xạ sang primitive code có sẵn:

| # | Step (stepKey) | Việc | Idempotency key | Reuse primitive |
|---|---|---|---|---|
| 1 | `allocate-number` | Cấp `tenantNo` (011+ tuần tự, T001–010 fixed) | `launch:{id}:allocate` | Registry allocator (`POST /tenant-numbers/allocate`), transaction+lock — `TENANT_REGISTRY...PLAN §3`. |
| 2 | `register-tenant` | Tạo record registry `status=PROVISIONING` | `launch:{id}:register` | `POST /api/platform/tenants` (shared table upsert dưới `withBypass`). |
| 3 | `baseline-org-identity` | Tạo org/identity baseline + admin đầu tiên | `launch:{id}:baseline` | `IdentityService.seed`-pattern (upsert idempotent theo id) → seed pack `SP-BASE-ORG`. `SAAS-043` first-admin invite. |
| 4 | `enable-apps` | Bật app theo blueprint | `launch:{id}:enable:{appCode}` | `ControlplaneService.setTenantApplication()` (`TenantApplicationInstance` upsert enabled) — ĐÃ idempotent. |
| 5 | `apply-blueprint` | Áp module/roles/menu/entitlement | `launch:{id}:blueprint:{bpId}` | Blueprint apply (`BLUEPRINT_SEED_PACK_PLAN §5`), immutable version. |
| 6 | `load-seed-pack` | Nạp demo data theo `seedPackIds` | `launch:{id}:seed:{packId}` | Seed pack tenant-parameterized (evolve từ `scripts/*-seed.mjs`, ON CONFLICT DO NOTHING). Có **dry-run** (`POST /seed-packs/{id}/dry-run`). |
| 7 | `provision-backup` | Tạo backup policy + backup baseline | `launch:{id}:backup` | `BackupService.createBackup(tenantId)` — per-tenant, encrypted, checksum, secret-guard. Non-negotiable #11. |
| 8 | `isolation-test` | Kiểm thử cách ly cross-tenant | `launch:{id}:isolation` | RLS FORCE + canary `MUST_NOT_LEAK` pattern (`controlplane.service.ts` demo-isolation, `backup.tables assertNoSecretFields`). `SAAS-063`. |
| 9 | `readiness-verify` | Chạy readiness checks | `launch:{id}:verify` | `POST /launches/{id}/verify`; kết quả → `readinessChecks[]`. |
| 10 | `handover` | Bàn giao Tenant Admin | `launch:{id}:handover` | `POST /launches/{id}/handover` → `TenantHandover`. |

Các step branding/domain/connector-modes (`SAAS-044`) chèn giữa 6–9 tuỳ blueprint; đều theo cùng khuôn command idempotent.

> Mỗi step CHỈ chạy khi step trước `completed`. `run` là **resumable**: gọi lại chỉ chạy step `pending` còn lại (replay các step `completed`), đúng cơ chế replay của `createBinding()`.

## 4. Idempotency / retry / rollback / resume

- **Idempotent:** mỗi step có `idempotencyKey` cố định (§3). Chạy lại `run` → step `completed` được replay từ `result` đã lưu (không tác dụng phụ), giống nhánh replay trong `createBinding()`.
- **Retryable:** step `failed` → `retry` (giống `retryCommand()`), tăng `attempts`, giữ `correlationId`. Cho phép transient-failure recovery (đã có hook `attempt` trong `AppAdapterService.provision`).
- **Resumable:** `POST /launches/{id}/run` tiếp tục từ step dở; `reconcile`-pattern phát hiện drift giữa "step đã completed" và "hiệu ứng thực tế" (vd app chưa enabled dù command completed).
- **Rollback / failure:** launch có `status=FAILED`; các step đã tạo (registry record, apps, seed) để lại evidence. Vì hầu hết là upsert/skip-by-code idempotent, **rollback = compensating steps** (disable app, xoá seed theo code, set tenant `status=DRAFT/CLOSED`) chứ không xoá cứng — tôn trọng non-negotiable #10 (không secret) và tránh xoá dữ liệu ngoài phạm vi. Backup baseline (step 7) cho phép khôi phục sandbox nếu cần (`BackupService.restore` dry-run/sandbox, KHÔNG ghi đè source).
- **Audit:** toàn bộ command/step lưu evidence; màn `PS-06 Launch Run` hiển thị step timeline + evidence + retry + readiness + handover.

## 5. Handover (contract)

Theo `contracts/tenant-handover.schema.json`:

```
TenantHandover { tenantId, launchId, readinessChecks[], acceptedBy, acceptedAt, openItems[] }
```

- `readiness-verify` (step 9) sinh `readinessChecks[]`; `handover` (step 10) yêu cầu tất cả check bắt buộc PASS, ghi `acceptedBy/acceptedAt`, chuyển launch `COMPLETED` và tenant registry `status=ACTIVE`.
- `openItems[]` cho các mục non-blocking còn treo.

## 6. Map API outline (`api/openapi-platform-outline.yaml`)

| Endpoint | Vai trò trong factory |
|---|---|
| `POST /api/platform/launches` | Tạo `TenantLaunchRequest` (DRAFT/APPROVED). |
| `GET /api/platform/launches` | PS-04 danh sách. |
| `POST /api/platform/launches/{id}/run` | Execute/resume idempotent (drain step outbox). |
| `POST /api/platform/launches/{id}/verify` | Readiness checks (step 9). |
| `POST /api/platform/launches/{id}/handover` | Handover (step 10). |
| `POST /api/platform/tenant-numbers/allocate` | Step 1. |
| `POST /api/platform/tenants` | Step 2. |
| `POST /api/platform/seed-packs/{id}/dry-run` | Tiền kiểm step 6. |

## 7. Quyền & an toàn

- Toàn bộ launch chạy từ **Platform Console** (permission-gated, `@RequirePermission('platform.launch.run')` — permission platform cần bổ sung, xem `PLATFORM_VS_TENANT_PERMISSION_PLAN.md`).
- Ghi registry/apps xuyên tenant chạy dưới `withBypass` ("tác vụ hệ thống rõ ràng" theo `docs/09`); nhưng seed/backup của tenant đích chạy scoped đúng `tenantId` (backup đã explicit `where:{tenantId}` + RLS).
- Non-negotiable #12: T001 phải **dùng chính XHub** để launch T002 → factory là công cụ vận hành, không phải script một lần.

## 8. Acceptance (map `docs/10_ACCEPTANCE_GATES.md`)

- T002 được tạo **bởi Launch Factory** (không script tay).
- Backup/restore riêng mỗi tenant; cross-tenant isolation PASS (step 7–8).
- Launch resumable: chạy lại `run` không tạo trùng (idempotent).
- Handover có readinessChecks + acceptedBy.

## 9. Gaps handoff-vs-code

- **Chưa có** model `TenantLaunch`/`LaunchStep` — cần tạo (khuôn theo `ProvisioningCommand`).
- Control-plane outbox hiện gắn với `personId + applicationCode`; cần **generalize** thành step tổng quát (action/target tuỳ ý) — mở rộng, không viết lại.
- `AppAdapterService` hiện là **MOCK adapter**; các step thật (enable app x1/x2/xweb, tạo storage namespace) cần adapter thật hoặc reuse `setTenantApplication` (đã thật cho `TenantApplicationInstance`).
- Endpoint `/launches/*` mới ở outline, chưa có controller/service.
- Rollback/compensation chưa có primitive sẵn — thiết kế dựa trên tính idempotent của upsert + backup baseline.
