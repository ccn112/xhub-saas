# TENANT REGISTRY IMPLEMENTATION PLAN

> Kế hoạch (docs-first, KHÔNG code) cho **Platform Tenant Registry** — sổ đăng ký tenant cấp nền tảng của XHub SaaS (Tenant 001–010).
> Grounded trên code thật `D:\Code\xhub-api` + handoff `XTECH_XHUB_SAAS_TENANT_001_010_HANDOFF_20260730`.
> Phase liên quan: **E3 — Platform Tenant Registry** (`PHASE_CATALOG.csv`), backlog `SAAS-030..034`.

## 0. Tài liệu liên quan (đọc kèm)

- `SAAS_POSITIONING_DELTA_ANALYSIS.md` — định vị SaaS multi-tenant, xoá giả định "X-TECH là sản phẩm".
- `TENANT_NUMBERING_MIGRATION_PLAN.md` — migration numbering + cách `tenant-xtech` hiện tại thành T001.
- `PLATFORM_VS_TENANT_PERMISSION_PLAN.md` — tách quyền Platform Console vs Tenant Admin (`SAAS-004`).
- `TENANT_LAUNCH_FACTORY_PLAN.md` — Launch Factory tiêu thụ registry để tạo tenant mới.
- `BLUEPRINT_SEED_PACK_PLAN.md` — blueprint/seed pack gắn vào record registry.
- `T002_REAL_ESTATE_DEMO_PLAN.md` — tenant demo đầu tiên do Launch Factory tạo.

## 1. Vấn đề & hiện trạng code (verified)

Hôm nay hệ thống **chưa có Tenant Registry đúng nghĩa**:

- `prisma/schema.prisma` có `model Tenant` (dòng 13) nhưng CHỈ là bảng neo cho workflow:
  ```
  model Tenant { id String @id @default(cuid())  slug String @unique  name String  createdAt DateTime
                 workflows/instances/tasks/events/auditLogs (relations) }
  ```
  Không có `tenantNo`, `tenantClass`, `status`, `planId`, `blueprintId`, `industry`. Đây là bảng **shared, KHÔNG RLS** — hiện được upsert dưới `withBypass` trong các seed (`identity.service.ts:46`, `xoffice.service.ts:110`, `backup.service.ts:322`).
- Tenant "id" đang là literal `tenant-xtech`; slug `xtech`; quy ước `tenantId = "tenant-" + slug` (`xoffice.service.ts` `tenantId(slug)`).
- Không tồn tại khái niệm `TenantClass` / immutable `tenantNo` / plan / blueprint ở tầng dữ liệu.

**Kết luận:** Registry KHÔNG phải bảng RLS tenant-scoped. Nó là **bảng platform dùng chung** — cùng loại với `ApplicationDefinition` và `MasterRecord`/catalog (đã no-RLS, truy cập qua `withBypass`). Ta **mở rộng chính `model Tenant` hiện có** thành registry (giữ nguyên nó là shared table), thay vì tạo engine mới.

## 2. Mô hình dữ liệu (design, chưa code)

Mở rộng `model Tenant` (shared, no-RLS) theo `contracts/tenant-registration.schema.json` + `data/TENANT_CATALOG_001_010.csv`:

| Field | Kiểu | Ghi chú / nguồn |
|---|---|---|
| `id` | String @id | GIỮ NGUYÊN literal hiện có (`tenant-xtech` không đổi để không vỡ FK workflow/audit). Với tenant mới: `tenant-<tenantKey>`. |
| `tenantNo` | Int @unique | **Bất biến, không tái sử dụng** (non-negotiable #2). `TenantNumberAllocation.reusable = const false`. |
| `tenantCode` | String @unique | `^T[0-9]{3,6}$` (`tenant-number-allocation.schema.json`). Ví dụ `T001`. |
| `tenantKey` | String @unique | thay cho `slug` hiện tại; giữ backward-compat bằng cách `slug` = `tenantKey`. |
| `displayName` | String | = `name` hiện tại. |
| `tenantClass` | Enum | `PLATFORM_OWNER_REFERENCE_CUSTOMER \| VERTICAL_DEMO \| CUSTOMER_SUBSCRIBER \| SYSTEM_TEST`. |
| `industry` | String? | từ catalog. |
| `status` | Enum | `DRAFT \| PROVISIONING \| ACTIVE \| SUSPENDED \| OFFBOARDING \| CLOSED` (registration schema). |
| `planId` | String | subscription plan (`config/subscription-plans.example.json`, PS-07). |
| `blueprintId` | String? | tham chiếu Blueprint (E5). |
| `metadata` | Json | mở rộng. |
| `createdAt` | DateTime | đã có. |

Quan hệ workflow/audit hiện có **giữ nguyên**. Migration mở cột nullable trước, backfill T001, rồi siết `NOT NULL`/`@unique` (chi tiết ở `TENANT_NUMBERING_MIGRATION_PLAN.md`).

### 2.1 tenantNo lifecycle & tính bất biến

- `tenantNo` và `tenantCode` là **write-once**: cấp lúc tạo, không API nào được PATCH (xem §4). Ràng buộc ở tầng service (reject nếu body cố đổi) + `@unique` DB.
- Không tái sử dụng số kể cả khi tenant `CLOSED` (số vẫn nằm trong registry với `status=CLOSED`).

## 3. Cấp phát tenantNo (allocation)

Theo `data/TENANT_NUMBERING_POLICY.csv` + `data/PLATFORM_ROLE_CATALOG.csv` + non-negotiable #3/#4/#5:

| Dải | Quy tắc | Class |
|---|---|---|
| `001` | Cố định X-TECH | `PLATFORM_OWNER_REFERENCE_CUSTOMER` |
| `002–010` | Cố định demo ngành | `VERTICAL_DEMO` |
| `011+` | **Tuần tự**, cấp cho khách subscribe | `CUSTOMER_SUBSCRIBER` |
| `SYSTEM-*` | ngoài dải thương mại | `SYSTEM_TEST` (không hiển thị như tenant thương mại) |

**Endpoint** `POST /api/platform/tenant-numbers/allocate` (đã có trong `api/openapi-platform-outline.yaml`):

- Trả `TenantNumberAllocation` (`tenantNo, tenantCode, tenantClass, allocatedAt, reusable:false`).
- T001–T010: **không cấp động** — đã fixed trong `seed/tenants_001_010.seed.json`; allocate cho các dải này chỉ trả record cố định (hoặc từ chối nếu đã tồn tại).
- Customer `011+`: cấp tuần tự với **transaction + lock** để tránh trùng số dưới đồng thời. Thiết kế: bên trong một `$transaction`, `SELECT ... FOR UPDATE` trên một hàng sequence/`MAX(tenantNo)` ở dải customer rồi `+1` (không dùng bare autoincrement vì ba dải khác nhau). Bắt đầu tại **11** (`SAAS-034`: "allocator starting at 011"). Đây là điểm tương tự pattern giao dịch của `PrismaService.withTenant`/`withBypass` (interactive transaction) — dùng `withBypass` vì registry là shared table.
- `SYSTEM_TEST` cấp mã ngoài dải (`SYSTEM-*`), không tăng đếm thương mại.

## 4. API (Platform Console — PS-02/PS-03)

Từ `api/openapi-platform-outline.yaml` + `data/PLATFORM_SCREEN_CATALOG.csv`:

| Method + path | Màn | Mô tả |
|---|---|---|
| `GET /api/platform/tenants` | PS-02 Tenant Registry | List T001–T010 + T011+. |
| `POST /api/platform/tenants` | PS-05 (qua Launch) | Tạo record từ allocation đã duyệt (`TenantRegistration`). |
| `GET /api/platform/tenants/{id}` | PS-03 Tenant 360 | plan, apps, domain, usage, health, backup, support, audit. |
| `PATCH /api/platform/tenants/{id}` | PS-03 | **lifecycle-safe metadata only** — cho đổi `displayName/status(hợp lệ theo state machine)/planId/blueprintId/metadata`; **CẤM** đổi `tenantNo/tenantCode/tenantKey/id`. |
| `POST /api/platform/tenant-numbers/allocate` | — | §3. |

- `status` chuyển theo state machine `SAAS-033` (`DRAFT→PROVISIONING→ACTIVE→SUSPENDED/OFFBOARDING→CLOSED`); PATCH chỉ nhận transition hợp lệ.
- Registry là **nguồn sự thật** cho danh sách tenant; Launch Factory (`TENANT_LAUNCH_FACTORY_PLAN.md`) là bên duy nhất tạo record ở trạng thái `PROVISIONING`.

## 5. X-TECH đăng ký thành T001 (không đổi id)

Non-negotiable #1 (không branch theo `tenantKey=xtech`) và #3 (T001 cố định):

- Backfill 1 record registry cho tenant hiện hữu: `id="tenant-xtech"` **GIỮ NGUYÊN**, gán `tenantNo=1, tenantCode="T001", tenantKey="xtech", tenantClass=PLATFORM_OWNER_REFERENCE_CUSTOMER, status=ACTIVE, planId=ENTERPRISE_DESIGN_PARTNER, blueprintId=<BP-TECH-001>` theo `seed/tenants_001_010.seed.json` (record #1).
- Vì `id` không đổi, mọi FK workflow/instance/task/audit/RLS-row đang trỏ `tenant-xtech` vẫn hợp lệ → migration an toàn, không remap dữ liệu nghiệp vụ.
- Chi tiết migration ở `TENANT_NUMBERING_MIGRATION_PLAN.md`.

## 6. Thay 5 điểm hardcoded-xtech bằng đọc registry

Hiện có các điểm tra cứu slug/name cứng `xtech` (verified qua grep) — sau khi có registry, chúng đọc từ record thay vì literal:

| # | File:vị trí | Hiện tại | Sau khi có registry |
|---|---|---|---|
| 1 | `src/xoffice/xoffice.service.ts:112-113` | `name: slug==='xtech' ? 'XTech' : slug` khi upsert Tenant | đọc `displayName` từ registry (record là nguồn); seed thôi hardcode name. |
| 2 | `src/xoffice/xoffice.service.ts:224` `slugFromTenantId()` | `if (tenantId==='tenant-xtech') return 'xtech'` | tra `tenantKey` theo `id` trong registry (bỏ nhánh literal). |
| 3 | `src/xoffice/notification.service.ts:31` | `tenantSlug: row.tenantId==='tenant-xtech' ? 'xtech' : ...` | tra `tenantKey` từ registry theo `tenantId`. |
| 4 | `src/identity/identity.service.ts:75` | `if (tenantId==='tenant-xtech')` để seed history | chuyển khối history vào **seed pack SP-XTECH-OPS** (xem `BLUEPRINT_SEED_PACK_PLAN.md` §7), không branch theo key. |
| 5 | `src/mdm/mdm.service.ts:455/482` | `const XTECH='tenant-xtech'` + demo import job | tham số hoá tenant từ registry/seed pack; job demo là dữ liệu seed pack, không literal. |

Ngoài ra các fallback controller `id.tenantId ?? 'tenant-xtech'` (`directives/requests/tickets/bookings/announcements.controller.ts`) và `DEFAULT_TENANT_ID` (`auth/identity.types.ts:23`, đã `process.env.DEFAULT_TENANT_ID ?? 'tenant-xtech'`) được coi là **default runtime dev**, KHÔNG phải business logic — giữ được nhưng nên trỏ về T001 qua ENV, và không được là điều kiện rẽ nhánh nghiệp vụ (non-negotiable #1). Danh sách đầy đủ đối chiếu trong `SAAS_POSITIONING_DELTA_ANALYSIS.md`.

## 7. Phân quyền: chỉ Platform Console

Theo `docs/09_PLATFORM_MENU_AND_SECURITY.md` + non-negotiable #6/#7:

- Toàn bộ `/api/platform/*` (gồm registry) chỉ **platform role** truy cập — tách khỏi 5 workspace tenant. Chi tiết mô hình quyền ở `PLATFORM_VS_TENANT_PERMISSION_PLAN.md`.
- Cơ chế gating tái dùng `@RequirePermission()` + `PermissionGuard` hiện có (`src/auth/require-permission.decorator.ts`, gated bởi `AUTH_ENFORCE`). Cần thêm **permission code cấp platform** (vd `platform.tenant.manage`, `platform.tenant.read`) — hôm nay chưa có role/permission "platform" trong code (grep `platform` ở `src/auth` = rỗng) → đây là **gap** phải bổ sung ở E3/`SAAS-004`.
- Platform operator **không mặc định đọc business data tenant**: registry chỉ chứa metadata quản trị (plan/status/health refs), KHÔNG chứa nội dung nghiệp vụ; truy cập sâu phải time-bound/approved/audited (Support Operations PS-14, `SAAS-083`).
- Registry là shared table nên đọc/ghi dưới `withBypass` — nhưng chỉ cho "tác vụ hệ thống rõ ràng" (bypass DB) đúng như §09.

## 8. Acceptance (map `docs/10_ACCEPTANCE_GATES.md`)

- T001–T010 có registry record đúng numbering; customer bắt đầu tại T011.
- `tenantNo` bất biến, unique, không tái sử dụng (test: PATCH đổi số → reject).
- Không hardcode X-TECH ở nhánh nghiệp vụ (5 điểm §6 chuyển sang đọc registry/seed pack).
- Registry chỉ truy cập qua Platform Console (permission-gated).

## 9. Gaps handoff-vs-code

- **Chưa có** `TenantClass`, `tenantNo`, `status`, `planId`, `blueprintId` ở schema — `model Tenant` hiện chỉ 4 cột + workflow relations.
- **Chưa có** role/permission "platform" trong `src/auth` → cần trước khi mở `/api/platform/*`.
- **Chưa có** allocator/sequence cho dải 011+ (chỉ có schema `tenant-number-allocation`).
- `subscription-plans.example.json` mới là ví dụ config, chưa có `Plan` model (E3 `SAAS-032`).
