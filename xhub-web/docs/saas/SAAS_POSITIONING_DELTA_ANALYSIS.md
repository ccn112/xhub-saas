# SAAS_POSITIONING_DELTA_ANALYSIS

> Docs-first — KHÔNG code. Phân tích khoảng cách (delta) giữa hiện trạng codebase và định vị SaaS đa tenant theo handoff `XTECH_XHUB_SAAS_TENANT_001_010_HANDOFF_20260730`.
> Nguồn đã verify: `xhub-api/prisma/schema.prisma`, `src/prisma/prisma.service.ts`, `src/auth/*`, `src/controlplane/*`, `src/backup/*`, `seed-data/identity/role-registry.seed.json`, `TINH_HINH_DU_AN_XHUB.md`, `xhub-web/docs/DEV_BACKLOG.md`.
> Doc anh em cùng thư mục: `TENANT_NUMBERING_MIGRATION_PLAN`, `PLATFORM_VS_TENANT_PERMISSION_PLAN`, `TENANT_REGISTRY_IMPLEMENTATION_PLAN`, `TENANT_LAUNCH_FACTORY_PLAN`, `BLUEPRINT_SEED_PACK_PLAN`, `XTECH_SOLUTION_DELIVERY_PLAN`, `T002_REAL_ESTATE_DEMO_PLAN`.

---

## 1. Reframe: từ "ứng dụng nội bộ X-TECH" sang "hệ sinh thái SaaS đa tenant"

Hiện trạng (`TINH_HINH_DU_AN_XHUB.md`) mô tả sản phẩm là "Nền tảng làm việc hợp nhất nội bộ cho doanh nghiệp X‑TECH, đa‑tenant (SaaS)". Nền tảng **đã đa tenant về hạ tầng** (RLS Postgres, ~50 bảng, `withTenant`/`withBypass`) nhưng **runtime chỉ phục vụ một tenant literal** `tenant-xtech` (id cố định, mọi seed/default trỏ về đó).

Handoff yêu cầu đảo định vị (`docs/00_EXECUTIVE_RESET.md`):

- **T001 = X-TECH** vừa là Platform Owner, Platform Operator, Solution Provider, **vừa là** Reference Customer (khách hàng trải nghiệm đầu tiên).
- **T002–T010** = tenant demo theo ngành (đã có catalog, xem `data/TENANT_CATALOG_001_010.csv`).
- **T011+** = khách hàng thuê bao thật.
- "X-TECH không phải nhánh tùy biến của sản phẩm" — mọi khác biệt phải đến từ plan / entitlement / blueprint / seed pack / connector / workflow / tenant configuration, **không** từ code nhánh `if tenantKey==='xtech'`.

Hệ quả: hạ tầng cô lập đã sẵn sàng, nhưng còn thiếu toàn bộ **mặt phẳng quản trị SaaS** (tenant registry có đánh số, platform console, launch factory, blueprint/seed catalog, solution-delivery workspace) và còn tồn tại các điểm **hardcode xtech** vi phạm non-negotiable #1.

---

## 2. Bảng delta năng lực

| Năng lực | Đã có (tenant-scoped?) | Delta cho SaaS | Rủi ro |
|---|---|---|---|
| **Cô lập RLS** (`withTenant`/`withBypass`, `SET LOCAL app.current_tenant`, ~50 bảng FORCE RLS) | ✅ Có, đã tenant-scoped chuẩn; `db` không context → 0 row (fail-safe) | Giữ nguyên. Cần tenantId ổn định lấy từ registry thay vì literal | Thấp — nền tảng vững |
| **Control Plane / provisioning app** (`controlplane.service.ts`: catalog app, `TenantApplicationInstance`, outbox idempotent/retry/reconcile) | ✅ Có, per-tenant enablement | Seed hiện enable `['x1','x2','xweb']` cứng cho `XTECH`; phải chuyển sang bật app theo **blueprint/entitlement** của từng tenant | Trung bình — logic đúng, dữ liệu bị neo vào xtech |
| **Backup/restore per-tenant** (`backup.service.ts`: export trong `withTenant(source)`, checksum + AES-256-GCM, sandbox/dry-run, remap identity, secret-scan) | ✅ Có, đúng per-tenant, non-negotiable #10/#11 sẵn sàng | Cần drill backup/restore + isolation test cho **từng** tenant T002–T010 (backlog SAAS-064) | Thấp |
| **Identity/Org Core + RBAC/ABAC** (`identity.service.ts`, `PermissionGuard`, `can()`) | ✅ Có; shared identity plane seed dưới bypass | Cần tách **platform-role namespace** khỏi tenant role; xử lý membership cross-tenant | Trung bình — xem `PLATFORM_VS_TENANT_PERMISSION_PLAN` |
| **Role registry 16 role** (`role-registry.seed.json`, dataScope TENANT/ORG_UNIT/SELF) | ✅ Có, nhưng **seed cứng dưới `tenant-xtech`** (`"tenant": {id:"tenant-xtech"}`) | Registry phải seed cho mọi tenant theo blueprint; `PLATFORM_ADMIN=['*']` đang là super-admin tenant → **trùng tên** với platform role | Cao nếu không tách — nhầm quyền platform/tenant |
| **Tenant model** (`schema.prisma model Tenant`: chỉ `id, slug, name, createdAt`) | ⚠️ Có bảng nhưng **thiếu** tenantNo/code/class/status/plan/blueprint | Mở rộng thành **Tenant Registry** đầy đủ (xem `TENANT_REGISTRY_IMPLEMENTATION_PLAN`, `TENANT_NUMBERING_MIGRATION_PLAN`) | Cao — là gốc của cả roadmap |
| **Đánh số tenant (tenantNo/tenantCode)** | ❌ Không có; chỉ có `slug` unique | Thêm `tenantNo` immutable integer, `tenantCode` (T001…), allocator bắt đầu tại 11 trong transaction/lock | Cao |
| **Platform Console** (menu/route `/platform/*`, screen catalog) | ❌ Không có route platform nào trong `xhub-web` | Dựng console tách khỏi 5 workspace tenant (`data/PLATFORM_MENU.csv`, `PLATFORM_SCREEN_CATALOG.csv`) | Cao |
| **Launch Factory** (provisioning tenant mới idempotent/retry/audit) | ❌ Không có | Dựng orchestration khởi tạo tenant (backlog E4) — xem `TENANT_LAUNCH_FACTORY_PLAN` | Cao |
| **Blueprint / Seed Pack catalog** (versioned/immutable) | ⚠️ Có seed-data JSON tĩnh nhưng không có catalog versioned | Dựng blueprint/seed pack có version, dry-run, dependency — xem `BLUEPRINT_SEED_PACK_PLAN` | Cao |
| **Solution Delivery Workspace** (T001 quản lý triển khai khách hàng) | ❌ Không có | Dựng workspace presales→UAT→go-live→hypercare (backlog E2) — xem `XTECH_SOLUTION_DELIVERY_PLAN` | Cao |
| **Hardcode xtech** (5 điểm, xem §3) | ⚠️ Đang tồn tại | Thay bằng registry lookup / dữ liệu blueprint | Cao (non-negotiable #1) |

---

## 3. Ba nhóm trạng thái mã nguồn

### 3a. ĐÃ tenant-generic (giữ nguyên, chỉ cấp tenantId từ registry)
- `PrismaService.withTenant/withBypass` — RLS đúng, re-entrant, fail-safe (`src/prisma/prisma.service.ts:69,87`).
- `BackupService` — export/restore trong `withTenant(source)`, per-tenant folder, checksum + AES-256-GCM (`src/backup/backup.service.ts`).
- `PermissionGuard` — chỉ tác động route gắn `@RequirePermission`, quyết định qua `identity.can()` dưới bypass (`src/auth/permission.guard.ts`).
- Cơ chế control-plane outbox/reconcile (logic không neo tenant, chỉ **dữ liệu seed** neo).

### 3b. HARDCODE tenant-xtech (phải thay bằng registry lookup)
DEV_BACKLOG chốt **5 điểm** cần dọn khi làm Tenant Registry + Seed Pack:

| # | Vị trí | Nội dung hardcode | Thay bằng |
|---|---|---|---|
| 1 | `src/identity/identity.service.ts:75` | `if (tenantId === 'tenant-xtech')` → seed lịch sử bổ nhiệm vị trí | Dữ liệu lịch sử từ **seed pack theo blueprint**, không branch theo tenant |
| 2 | `src/xoffice/notification.service.ts:31` | `row.tenantId === 'tenant-xtech' ? 'xtech' : …` (suy slug hiển thị) | `tenantCode`/`slug` từ **registry lookup** |
| 3–5 | `src/xoffice/xoffice.service.ts:112,113,224` | `slug === 'xtech' ? 'XTech'` (tên), `slugFromTenantId` map `tenant-xtech→xtech` | Tên/slug từ registry record (`displayName`, `tenantKey`) |

**Ngoài "5 điểm" chốt**, khảo sát code còn phát hiện các điểm neo xtech tương tự cần đưa vào phạm vi dọn (ghi nhận gap handoff-vs-code):
- `src/auth/identity.types.ts:23` — `DEFAULT_TENANT_ID = … ?? 'tenant-xtech'` (default persona demo).
- `src/controlplane/controlplane.service.ts:58` — `const XTECH = 'tenant-xtech'` + enable `['x1','x2','xweb']` cứng.
- `src/mdm/mdm.service.ts:455` — `const XTECH = 'tenant-xtech'` (demo import job).
- `src/seed/seed.service.ts:16,22` — `canonicalTenantId = 'tenant-xtech'`.
- Các controller `*.controller.ts` (announcements/bookings/directives/requests/tickets/xoffice) fallback `id.tenantId ?? 'tenant-xtech'`.

> Khuyến nghị: coi "5 điểm branch nghiệp vụ" là bắt buộc-phải-dọn cho non-negotiable #1; nhóm "default/seed constant" là hạng dọn kèm — an toàn giữ làm **default fallback** miễn không rẽ nhánh business logic, nhưng nên đọc từ registry để nhất quán.

### 3c. HOÀN TOÀN THIẾU (phải dựng mới)
Tenant Registry có đánh số · `tenantNo`/`tenantCode`/class/status/plan/blueprint · Platform Console (`/platform/*`) · Launch Factory · Blueprint & Seed Pack catalog versioned · Solution Delivery Workspace · Platform-role namespace tách khỏi tenant registry · Subscription plans/entitlements · Tenant lifecycle state machine.

---

## 4. 12 Non-negotiable — trạng thái tuân thủ hiện tại

| # | Non-negotiable (CLAUDE.md) | Trạng thái | Ghi chú verify |
|---|---|---|---|
| 1 | Không branch/business logic cho `tenantKey=xtech` | ❌ VI PHẠM | 5 điểm §3b (+ các constant/default). Cần dọn khi làm Registry/Seed |
| 2 | `tenantNo` immutable, không tái sử dụng | ❌ CHƯA | `Tenant` model chưa có `tenantNo` |
| 3 | T001 cố định cho X-TECH | ⚠️ MỘT PHẦN | Đang có `tenant-xtech` nhưng chưa map về `tenantNo=1`/`T001` |
| 4 | T002–T010 reserved cho demo | ❌ CHƯA | Chỉ có trong CSV handoff, chưa vào DB |
| 5 | Customer allocation bắt đầu tại T011 | ❌ CHƯA | Chưa có allocator |
| 6 | Platform Console tách quyền khỏi Tenant Admin | ❌ CHƯA | Xem `PLATFORM_VS_TENANT_PERMISSION_PLAN`; platform-role chưa có |
| 7 | Platform operator KHÔNG mặc định đọc business data tenant | ⚠️ NỀN CÓ | RLS + `withBypass` chỉ cho tác vụ hệ thống; nhưng chưa có audit rule + role namespace ràng buộc |
| 8 | Launch steps idempotent/retryable/audited | ⚠️ NỀN CÓ | Control-plane outbox đã idempotent/retry/reconcile; nhưng chưa có Launch Factory |
| 9 | Blueprint & seed pack versioned/immutable | ⚠️ MỘT PHẦN | Có tiền lệ immutable (WorkflowVersion, appRoleMapping version); seed-data JSON chưa versioned catalog |
| 10 | Không plaintext password/secret trong seed | ✅ ĐẠT | `assertNoSecretFields`/`scan:secrets` PASS; argon2, no plaintext (PH-00) |
| 11 | Mỗi tenant có backup/restore + isolation test riêng | ⚠️ NỀN CÓ | Backup per-tenant + `test:rls` isolation canary (`demo-isolation`) đã có; cần drill cho T002–T010 |
| 12 | T001 phải dùng XHub để launch & deliver T002 | ❌ CHƯA | Phụ thuộc Launch Factory + Solution Delivery (dogfooding) |

**Tóm tắt tuân thủ:** ĐẠT 1/12 (#10) · NỀN CÓ nhưng chưa đủ 4/12 (#7,#8,#9,#11) · MỘT PHẦN 1/12 (#3) · CHƯA/VI PHẠM 6/12 (#1,#2,#4,#5,#6,#12). Rào cản gốc là **thiếu Tenant Registry có đánh số** (#2,#3,#4,#5) và **thiếu tách quyền Platform Console** (#6,#7) — hai việc này mở khóa phần còn lại.
