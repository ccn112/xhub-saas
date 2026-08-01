# PLATFORM_VS_TENANT_PERMISSION_PLAN

> Docs-first — KHÔNG code. Kế hoạch tách quyền Platform Console khỏi Tenant Admin (non-negotiable #6 và #7).
> Nguồn verify: `xhub-api/src/auth/permission.guard.ts`, `src/auth/identity.types.ts`, `src/prisma/prisma.service.ts` (`withTenant`/`withBypass`), `seed-data/identity/role-registry.seed.json` (16 role tenant).
> Data handoff: `data/PLATFORM_ROLE_CATALOG.csv` (10 platform role), `data/PLATFORM_MENU.csv` (16 mục), `data/PLATFORM_SCREEN_CATALOG.csv` (14 màn), `docs/09_PLATFORM_MENU_AND_SECURITY.md`.
> Doc anh em: `TENANT_REGISTRY_IMPLEMENTATION_PLAN`, `TENANT_LAUNCH_FACTORY_PLAN`, `XTECH_SOLUTION_DELIVERY_PLAN`.

---

## 1. Nguyên tắc (từ handoff)

`docs/09_PLATFORM_MENU_AND_SECURITY.md` + non-negotiable #6/#7:

- Platform Console **tách khỏi 5 workspace tenant**; chỉ **platform roles** được truy cập.
- Platform operator **không mặc định đọc nội dung business tenant**.
- Support access phải **time-bound, approved, audited**.
- **Bypass database chỉ dùng tác vụ hệ thống rõ ràng** (metadata/control-plane), không dùng để đọc bảng nghiệp vụ tenant.
- Mọi action tenant-lifecycle có **impact preview**.

Platform Console quản lý: tenant registry, launch, plans, blueprints, seed packs, apps, connectors, health, usage, backup, releases, support, audit. Tenant Admin quản trị **bên trong** một tenant.

---

## 2. Hai namespace vai trò tách biệt

### 2a. Tenant role registry (đã có — 16 role)
`role-registry.seed.json` seed dưới `tenant-xtech`, `dataScope ∈ {ALL, TENANT, ORG_UNIT, SELF}`: `PLATFORM_ADMIN(['*'])`, `TENANT_ADMIN`, `ORG_ADMIN`, `SECURITY_ADMIN`, `WORKFLOW_ADMIN`, `BACKUP_ADMIN`, `AUDITOR`, `DATA_STEWARD`, `RECORDS_MANAGER`, `COMM_ADMIN`, `SERVICE_DESK_MANAGER`, `SERVICE_DESK_AGENT`, `EXECUTIVE`, `CFO`, `DEPARTMENT_HEAD`, `EMPLOYEE`. Đây là quyền **trong phạm vi một tenant** (RLS-scoped).

### 2b. Platform role catalog (phải dựng mới — 10 role, `PLATFORM_ROLE_CATALOG.csv`)
`PLATFORM_OWNER`, `PLATFORM_ADMIN`, `TENANT_LAUNCH_MANAGER`, `PLATFORM_OPERATIONS`, `PLATFORM_SECURITY`, `BILLING_ADMIN`, `BLUEPRINT_MANAGER`, `SOLUTION_DELIVERY_MANAGER`, `CUSTOMER_SUCCESS_MANAGER`, `PLATFORM_AUDITOR`. Phạm vi: quản trị **cross-tenant metadata**, KHÔNG phải business data.

### ⚠️ Xung đột tên `PLATFORM_ADMIN` (gap phải xử lý)
`PLATFORM_ADMIN` xuất hiện ở **cả hai** danh mục: trong tenant registry nó là **super-admin `['*']`** (grant mọi permission, `dataScope ALL` — dùng cho test admin `usr-cfo`/`usr-ceo`), còn trong platform catalog nó là "Quản trị nền tảng" (tenant registry, app catalog, feature flags). Đây là **rủi ro nhầm quyền nghiêm trọng**: một `PLATFORM_ADMIN` tenant có `['*']` không được vô tình trở thành platform operator.

**Khuyến nghị:** đặt **namespace tiền tố riêng** cho platform role, vd `PLATFORM::OWNER`, `PLATFORM::ADMIN`, `PLATFORM::LAUNCH_MANAGER`… để không đụng roleCode tenant. Platform role KHÔNG seed vào bảng `PermissionPolicy` per-tenant; lưu ở **bình diện platform riêng** (không gắn `tenantId` nghiệp vụ, hoặc gắn tenant hệ thống `SYSTEM-*`). Đồng thời cân nhắc rút gọn super-admin tenant `['*']` để không mang nghĩa "toàn platform".

---

## 3. Ranh giới thực thi qua PermissionGuard + RLS (đã có nền)

Cơ chế hiện tại (`permission.guard.ts`): guard đọc `@RequirePermission('code')`, xác thực identity, rồi khi enforce gọi `identity.can(userId, code)` **dưới `withBypass`** (RBAC/ABAC là shared identity plane, chạy trước khi mở `withTenant`). RLS (`prisma.service.ts`): `withTenant(tenantId)` pin `app.current_tenant`; `withBypass` set `app.bypass_rls='on'` chỉ cho tác vụ hệ thống.

Áp dụng cho ranh giới platform/tenant:

- **Route platform** (`/platform/*`) gắn permission platform (vd `@RequirePermission('platform.tenant.read')`); guard kiểm tra caller có **platform role** (namespace tách). Route tenant giữ nguyên permission tenant.
- **Platform ops đọc metadata cross-tenant CHỈ qua `withBypass`** trên các bảng **control-plane/registry/health/usage/backup manifest** — KHÔNG bao giờ mở `withBypass` để đọc bảng nghiệp vụ tenant (request, ticket, document, workflow instance…). `withBypass` không được dùng như cửa hậu đọc business data.
- **Đọc business data của tenant** vẫn phải đi qua `withTenant(tenantId)` + membership hợp lệ trong tenant đó. Platform operator mặc định **không có** membership tenant → RLS trả 0 row (fail-safe sẵn có: không context → 0 row).

### Bảng phân tách truy cập

| Loại dữ liệu | Ai đọc được | Cơ chế |
|---|---|---|
| Registry/plan/blueprint/seed/app-catalog (metadata) | Platform role tương ứng | `withBypass` (tác vụ hệ thống) |
| Health/usage/quota (kỹ thuật, KHÔNG lộ nội dung business) | `PLATFORM_OPERATIONS` | `withBypass` trên bảng metric, không join business rows |
| Backup manifest (row-count, checksum — không nội dung) | `PLATFORM_OPERATIONS`, `PLATFORM_SECURITY` | manifest plaintext đã tách khỏi bundle mã hoá (`backup.service.ts`) |
| Business data trong 1 tenant (request/ticket/doc/workflow…) | Chỉ user có membership trong tenant đó | `withTenant` + `PermissionGuard` |
| Support access tạm thời vào business tenant | Chỉ khi **approved + time-bound** | Xem §5 |

---

## 4. Platform menu vs Tenant menu

- **Platform menu** (`PLATFORM_MENU.csv`, 16 mục PLAT-01..16, route `/platform/*`) với `Role visibility` theo platform role — vd `/platform/tenants`→`PLATFORM_ADMIN,TENANT_LAUNCH_MANAGER`; `/platform/audit`→`PLATFORM_SECURITY,PLATFORM_AUDITOR`. Screen catalog `PLATFORM_SCREEN_CATALOG.csv` (14 màn: Tenant Registry, Tenant 360, Launch Run, Blueprint Detail, Seed Pack, Health "without business data exposure"…).
- **Tenant menu** = 5 workspace hiện có (Trang chủ · Công việc · X.Space · X.Office · Doanh nghiệp), lọc bằng `filterNavByPermissions` theo 16 role tenant (đã có, PH-01 menu role-visibility 3 tầng).
- Hai cây menu **không trộn**: Platform Console là surface riêng trong `xhub-web` (route `/platform/*` hiện **chưa tồn tại** — gap, phải dựng), tách khỏi rail 5 workspace tenant. Cơ chế lọc menu theo permission tái dùng được, nhưng nguồn role phải là **platform namespace**.

---

## 5. Audit rule cho mọi truy cập platform vào business data

Bắt buộc (non-negotiable #7 + `09_…SECURITY.md`):

1. **Mặc định cấm**: platform operator không có đường đọc business data tenant nếu không qua support-access grant.
2. **Support access**: phải **approved** (PLATFORM_SECURITY hoặc chủ tenant), **time-bound** (hết hạn tự thu hồi), và **audited** (ghi ai/khi nào/tenant nào/lý do/hết hạn).
3. **Ghi audit**: tái dùng `AuditLog` (đã có quan hệ trên `Tenant`) — mọi lần platform truy cập business data ghi 1 bản ghi immutable; `PLATFORM_AUDITOR` đọc audit cross-tenant nhưng **không** mặc định đọc business data (đúng mô tả role trong catalog).
4. **Bypass có kiểm soát**: mỗi lần `withBypass` cho mục đích chạm dữ liệu tenant phải kèm lý do + audit; review định kỳ danh sách call-site `withBypass` để đảm bảo chỉ dùng cho metadata/seed/scheduler.
5. **Impact preview**: action tenant-lifecycle (suspend/offboard/restore/enable app) hiển thị preview trước khi thực thi (tái dùng tiền lệ impact preview của role-binding write ở PH-01).

---

## 6. Liên kết backlog

`IMPLEMENTATION_BACKLOG.csv`: SAAS-004 (`Tách quyền Platform Console`, Security P0/8) là gốc; SAAS-031 (Tenant 360), SAAS-083 (`Support access with approval/audit`, Security P0). Việc dựng route `/platform/*` + role namespace platform phải xong trước khi Launch Factory (`TENANT_LAUNCH_FACTORY_PLAN`) và Tenant 360 hiển thị dữ liệu cross-tenant.
