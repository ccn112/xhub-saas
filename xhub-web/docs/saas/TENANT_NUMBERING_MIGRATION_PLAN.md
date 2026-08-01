# TENANT_NUMBERING_MIGRATION_PLAN

> Docs-first — KHÔNG code. Kế hoạch chuyển từ tenant literal duy nhất `tenant-xtech` sang lược đồ đánh số T001..T010 / T011+ / SYSTEM-*.
> Nguồn verify: `xhub-api/prisma/schema.prisma` (`model Tenant`), `src/prisma/prisma.service.ts`, `seed-data/identity/role-registry.seed.json`, `src/xoffice/xoffice.service.ts`, `src/identity/identity.service.ts`, `src/xoffice/notification.service.ts`.
> Contracts handoff: `contracts/tenant-number-allocation.schema.json`, `contracts/tenant-registration.schema.json`, `data/TENANT_CATALOG_001_010.csv`, `data/TENANT_NUMBERING_POLICY.csv`.
> Doc anh em: `TENANT_REGISTRY_IMPLEMENTATION_PLAN` (shape đầy đủ + lifecycle), `SAAS_POSITIONING_DELTA_ANALYSIS`, `TENANT_LAUNCH_FACTORY_PLAN`.

---

## 1. Hiện trạng (đã verify)

`model Tenant` hiện chỉ có: `id (cuid)`, `slug (unique, "xtech")`, `name`, `createdAt` + các quan hệ workflow/audit (`prisma/schema.prisma:13`). **Không** có tenantNo, tenantCode, class, status, plan, blueprint.

- tenantId thực tế là literal chuỗi `tenant-xtech`, xuất hiện làm **id ngoại lai (foreign key value) trên ~50 bảng RLS** (mọi bảng có cột `tenantId` tham chiếu `app.current_tenant`).
- Helper suy tenantId: `xoffice.service.ts:228 tenantId(slug) => `tenant-${slug}``; suy ngược `slugFromTenantId` map `tenant-xtech→xtech`.
- Role registry seed cứng `"tenant": {id:"tenant-xtech", slug:"xtech"}`.

**Ràng buộc bất biến quan trọng:** đổi chuỗi `tenant-xtech` sẽ phá vỡ toàn bộ FK trên ~50 bảng + mọi seed dùng id đó. Do đó migration **PHẢI giữ nguyên `tenantId` chuỗi**, chỉ **bổ sung** các trường đánh số bên cạnh.

---

## 2. Chính sách đánh số (từ handoff `01_TENANT_NUMBERING_POLICY.md` + `TENANT_NUMBERING_POLICY.csv`)

| Dải | Quy tắc | Class |
|---|---|---|
| `T001` | Cố định X-TECH | `PLATFORM_OWNER_REFERENCE_CUSTOMER` |
| `T002`–`T010` | Cố định, demo ngành | `VERTICAL_DEMO` |
| `T011+` | Tuần tự, cấp trong transaction/lock, không tái sử dụng | `CUSTOMER_SUBSCRIBER` |
| `SYSTEM-*` | Ngoài dải thương mại, không hiển thị như tenant thương mại | `SYSTEM_TEST` |

Quy tắc cốt lõi:
- `tenantNo` = immutable integer, số đã cấp **không tái sử dụng** kể cả tenant đã CLOSED.
- `tenantCode` **sinh từ** `tenantNo` (`T` + zero-pad; contract cho phép `^T[0-9]{3,6}$`).
- `tenantKey` thân thiện (vd `xtech`, `realestate-demo`) nhưng **không** dùng thay tenant ID.
- Sequence customer bắt đầu tại **11**.

---

## 3. Shape bản ghi Tenant Registry (đề xuất, khớp `tenant-registration.schema.json`)

Mở rộng `model Tenant` (chi tiết đầy đủ + lifecycle ở `TENANT_REGISTRY_IMPLEMENTATION_PLAN`):

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `id` | String @id (giữ nguyên `tenant-xtech`…) | **KHÔNG đổi** — là FK value trên ~50 bảng RLS |
| `tenantNo` | Int @unique, immutable | 1 cho X-TECH; 2–10 demo; ≥11 customer |
| `tenantCode` | String @unique | Sinh từ tenantNo (`T001`); khớp pattern `^T[0-9]{3,6}$` |
| `tenantKey` | String @unique | = `slug` hiện tại (`xtech`); thân thiện, không thay ID |
| `slug` | String @unique (giữ) | Có thể alias `tenantKey` để tương thích ngược |
| `name`/`displayName` | String | `X-TECH` |
| `tenantClass` | enum | `PLATFORM_OWNER_REFERENCE_CUSTOMER` / `VERTICAL_DEMO` / `CUSTOMER_SUBSCRIBER` / `SYSTEM_TEST` (khớp `tenant-number-allocation.schema.json`) |
| `status` | enum | `DRAFT/PROVISIONING/ACTIVE/SUSPENDED/OFFBOARDING/CLOSED` (khớp `tenant-registration.schema.json`) |
| `planId` | String | vd `ENTERPRISE_DESIGN_PARTNER` (từ catalog) |
| `blueprintId` | String? | vd `TECHNOLOGY_SOLUTION_PROVIDER`; null cho SYSTEM_TEST |
| `metadata` | Json? | ngành, mục đích… |

Bảng cấp số phụ (khớp `tenant-number-allocation.schema.json`): `tenantNo`, `tenantCode`, `tenantClass`, `allocatedAt`, `reusable: const false`.

---

## 4. Migration `tenant-xtech` → T001 (giữ id ổn định)

Nguyên tắc vàng: **map, không rename**.

1. **Backfill hàng T001**: cập nhật hàng `Tenant` có `id='tenant-xtech'` — set `tenantNo=1`, `tenantCode='T001'`, `tenantKey='xtech'`, `tenantClass=PLATFORM_OWNER_REFERENCE_CUSTOMER`, `status=ACTIVE`, `planId=ENTERPRISE_DESIGN_PARTNER`, `blueprintId=TECHNOLOGY_SOLUTION_PROVIDER` (giá trị lấy từ `TENANT_CATALOG_001_010.csv` dòng 1). **`id` giữ nguyên `tenant-xtech`.**
2. **Không đụng ~50 bảng RLS**: vì `id` không đổi, mọi FK `tenantId='tenant-xtech'` vẫn hợp lệ; RLS `SET LOCAL app.current_tenant='tenant-xtech'` vẫn hoạt động.
3. **Bổ sung ánh xạ tra cứu**: registry cung cấp hàm `tenantIdByNo(1) => 'tenant-xtech'` và `codeByTenantId('tenant-xtech') => 'T001'` để thay các suy diễn hardcode.
4. **Reserve T002–T010**: seed 9 hàng registry class `VERTICAL_DEMO`, status `PLANNED`/`DRAFT`, id đề xuất `tenant-<tenantKey>` (vd `tenant-realestate-demo`) từ `TENANT_CATALOG_001_010.csv`. Chưa provision dữ liệu nghiệp vụ (đó là việc Launch Factory).
5. **Allocator T011+**: sequence bắt đầu tại 11, cấp trong transaction + row lock (advisory lock hoặc `SELECT … FOR UPDATE` trên bảng sequence), ghi `reusable=false`. Xem `TENANT_LAUNCH_FACTORY_PLAN`.

> Idempotent: mọi bước dùng upsert-by-key (theo tiền lệ seed hiện có) để chạy lại an toàn.

---

## 5. Cô lập demo & SYSTEM-*

- Canary `demo-isolation` hiện đã tồn tại (`tenant-demo-isolation`) và bị chặn cứng khỏi phục vụ (`xoffice.service.ts:232 assertTenant` ném NotFound; `test:rls` dùng làm isolation canary). Giữ nguyên vai trò.
- Theo policy, các tenant kỹ thuật/test dùng namespace `SYSTEM-*`, class `SYSTEM_TEST`, **không tiêu thụ số thương mại** và **không hiển thị** trong Tenant Registry thương mại (Platform Console lọc bỏ). `demo-isolation` nên được gắn class `SYSTEM_TEST` khi backfill để nhất quán chính sách (ghi nhận: hiện `demo-isolation` không theo tên `SYSTEM-*` — gap handoff-vs-code, xử lý bằng class flag thay vì đổi id để không phá canary).

---

## 6. Thay 5 điểm hardcode-xtech bằng registry lookup

Sau khi registry có mặt, các điểm ở `SAAS_POSITIONING_DELTA_ANALYSIS §3b` được thay như sau:

| Vị trí | Hiện tại | Sau migration |
|---|---|---|
| `identity.service.ts:75` `if(tenantId==='tenant-xtech')` seed lịch sử vị trí | branch theo tenant | Dữ liệu lịch sử đến từ **seed pack theo blueprint** (T001 blueprint), không branch |
| `notification.service.ts:31` suy `xtech`/slug | ternary literal | `registry.codeByTenantId(row.tenantId)` / `tenantKey` |
| `xoffice.service.ts:112,113` `slug==='xtech'?'XTech'` (tên) | literal | `registry.displayNameByKey(slug)` |
| `xoffice.service.ts:224` `slugFromTenantId('tenant-xtech'→'xtech')` | literal map | tra `tenantKey` từ registry theo `tenantId` |

Constant/default kèm dọn (không phải branch nghiệp vụ, ưu tiên sau): `DEFAULT_TENANT_ID` (`identity.types.ts:23`), `XTECH` const (`controlplane.service.ts:58`, `mdm.service.ts:455`), `seed.service.ts canonicalTenantId`, và các controller fallback `?? 'tenant-xtech'` — có thể giữ làm default demo miễn không rẽ nhánh logic, nhưng nên trỏ về `registry.tenantIdByNo(1)`.

---

## 7. Thứ tự thực thi & liên kết backlog

Khớp `IMPLEMENTATION_BACKLOG.csv`: SAAS-002 (`TenantClass + immutable tenantNo`) → SAAS-030 (`Tenant Registry T001-T010`) → SAAS-033 (`lifecycle state machine`) → SAAS-034 (`allocator starting at 011`). Việc dọn 5 điểm hardcode gắn với SAAS-003. Chi tiết dựng bảng + state machine: `TENANT_REGISTRY_IMPLEMENTATION_PLAN`. Việc dùng số để provision tenant mới: `TENANT_LAUNCH_FACTORY_PLAN`.
