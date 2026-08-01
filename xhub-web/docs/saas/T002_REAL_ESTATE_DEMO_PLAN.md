# T002_REAL_ESTATE_DEMO_PLAN — Provisioning tenant T002 (BĐS Demo)

> Docs-first, KHÔNG code. Nguồn: handoff `docs/04_TENANT_LAUNCH_FACTORY.md`,
> `docs/07_DEMO_TENANTS_002_010.md`, `docs/10_ACCEPTANCE_GATES.md`,
> `data/TENANT_CATALOG_001_010.csv`, `data/BLUEPRINT_CATALOG.csv`, `data/SEED_PACK_CATALOG.csv`,
> `config/subscription-plans.example.json`, `tests/TEST_SCENARIOS.csv`.
> Chị em: `TENANT_LAUNCH_FACTORY_PLAN`, `BLUEPRINT_SEED_PACK_PLAN`,
> `TENANT_REGISTRY_IMPLEMENTATION_PLAN`, `PLATFORM_VS_TENANT_PERMISSION_PLAN`,
> `XTECH_SOLUTION_DELIVERY_PLAN` (§5 — T001 launch T002).

## 1. Vì sao T002 là bằng chứng SaaS đầu tiên (first end-to-end proof)

T002 là tenant **thực** đầu tiên do **Launch Factory** tạo ra, không phải test tenant. Nó chứng
minh toàn bộ chuỗi SaaS: registry → plan → blueprint → seed → namespace/backup → first admin →
entitlement → isolation → readiness → handover. `docs/07` yêu cầu T002 **ưu tiên đầu tiên** và
phải chứng minh **XBooking + XBuilding + Shared MDM**. Exit gate v1.0 (`docs/10`) lấy "T002 được
tạo bởi Launch Factory" làm mốc.

## 2. Hồ sơ tenant (từ TENANT_CATALOG_001_010.csv)

| Trường | Giá trị |
|---|---|
| Tenant No | **2** (immutable, không tái sử dụng — non-negotiable #2) |
| Code / Key | `T002` / `realestate-demo` |
| Tên | Chủ đầu tư Bất động sản Demo |
| Class | `VERTICAL_DEMO` |
| Ngành | Chủ đầu tư và phát triển bất động sản |
| Plan | `ENTERPRISE_VERTICAL_DEMO` (`VERTICAL_DEMO`: `billingEnabled=false`, `apps=BY_BLUEPRINT`) |
| Blueprint | `REAL_ESTATE_DEVELOPER` = `BP-RE-002` |
| Seed pack | `SP-RE-DEMO` (kế thừa Base Enterprise Pack) |
| Mục đích | Demo chuỗi đầu tư, dự án, bán hàng, cư dân, vận hành |

`tenantNo=2` nằm trong `reservedTenantNos` của plan `VERTICAL_DEMO`
(`subscription-plans.example.json`) → không thể cấp cho khách hàng (khách bắt đầu T011).

## 3. Phạm vi vertical (đầu tư / dự án / bán hàng / cư dân / vận hành)

Blueprint `BP-RE-002` (`BLUEPRINT_CATALOG.csv`) phạm vi: *Developer/project master, sales,
booking, living/operations*. Ánh xạ 5 mảng theo catalog:

- **Đầu tư & dự án**: master "chủ đầu tư + dự án" → **Shared MDM** (`mdm/` đã có) làm nguồn
  master data; hồ sơ dự án qua `records/`.
- **Bán hàng**: rổ hàng/booking căn → **XBooking** (module `bookings/` đã có: BookableResource +
  Booking + conflict 409) demo giữ chỗ/đặt căn.
- **Cư dân & vận hành (living/operations)**: → **XBuilding** (vận hành toà nhà). *Gap*: XBuilding
  chưa có trong `xhub-api/src/` (đã verify — chỉ có bookings/records/mdm...); phần vận hành cư dân
  ở giai đoạn này demo bằng `tickets` (yêu cầu cư dân) + `announcements` (thông báo) + `bookings`
  (tiện ích) như proxy, và ghi rõ XBuilding đầy đủ là hạng mục sau. Xem §8 Gaps.

`docs/07` chốt trục chứng minh: **XBooking + XBuilding + Shared MDM** — đây là 3 năng lực demo
phải bật cho T002.

## 4. Apps / roles / workflows mà blueprint bật

- **Apps**: theo `apps=BY_BLUEPRINT` → blueprint `BP-RE-002` quyết định enabled apps (không lấy
  danh sách cứng của plan STARTER/PRO/ENT). Bao gồm tối thiểu: XOffice (base), XBooking, Shared
  MDM; XBuilding khi sẵn sàng.
- **Roles**: từ `SP-BASE-ORG` (org units, positions, roles, scopes) + role vertical BĐS trong
  `SP-RE-DEMO` (developer/sales/CSKH cư dân). Định nghĩa role platform vs tenant tách bạch theo
  `PLATFORM_VS_TENANT_PERMISSION_PLAN`.
- **Workflows**: từ `SP-BASE-OFFICE` (12 procedures, forms, SLA, notifications) + workflow bán
  hàng/vận hành của `SP-RE-DEMO`. Dùng workflow engine đã có (Workflow/WorkflowVersion versioned).

Seed dependency: `SP-RE-DEMO` **kế thừa Base Enterprise Pack** (`SP-BASE-ORG`, `SP-BASE-OFFICE`,
`SP-BASE-RECORDS`, `SP-BASE-BACKUP`) — quy tắc ở `BLUEPRINT_SEED_PACK_PLAN` / handoff `docs/05`.

## 5. Seed data demo — ràng buộc dữ liệu

Nội dung `SP-RE-DEMO` (`SEED_PACK_CATALOG.csv`): *Developers, projects, sales, booking, building,
customer*. Ràng buộc bắt buộc:

- **KHÔNG dữ liệu cá nhân thật**: chủ đầu tư/dự án/cư dân/khách hàng là dữ liệu bịa demo.
- **KHÔNG plaintext password/secret trong seed** (non-negotiable #10, handoff `docs/05`, TC-011):
  first admin nhận **invite** (không mật khẩu trong seed) — nhất quán với PH-00 đã dùng argon2,
  no plaintext (DEV_BACKLOG). Kiểm bằng `scan:secrets` (đã có).
- **Dry-run trước apply** (TC-013, `docs/05`): seed báo conflict trước khi ghi.
- **Published seed immutable + versioned** (non-negotiable #9).

## 6. Quy trình launch (idempotent, retryable, audited)

Theo `docs/04` (Launch Factory), mọi step idempotent/retryable/audited/có evidence
(non-negotiable #8; TC-009/TC-010/TC-011):

```
Launch request (từ Delivery Workspace T001, §5 XTECH_SOLUTION_DELIVERY_PLAN)
→ allocate tenantNo=2 (reserved VERTICAL_DEMO)
→ create tenant registry record (T002/realestate-demo)
→ select plan ENTERPRISE_VERTICAL_DEMO
→ select blueprint BP-RE-002
→ select seed packs (Base Enterprise + SP-RE-DEMO)
→ create storage namespace (riêng T002)
→ create backup policy (SP-BASE-BACKUP)
→ enable applications (BY_BLUEPRINT)
→ create first admin (invite, no plaintext) 
→ seed org/roles/workflows/data (dry-run → apply)
→ configure branding/domain
→ configure connector modes
→ run readiness checks
→ handover Tenant Admin
```

Chi tiết orchestration/idempotency ở `TENANT_LAUNCH_FACTORY_PLAN`. Retry KHÔNG tạo tenant trùng
(TC-009) nhờ allocate + registry unique theo tenantNo.

## 7. Isolation + backup/restore riêng cho T002 (bằng chứng cô lập)

- **Isolation MUST_NOT_LEAK** (TC-005/TC-006/TC-016): T001 **không đọc** dữ liệu T002; cặp
  T001–T002 deny chéo. Nền tảng đã có RLS scope `(tenantId, ...)` trên ~50 bảng (đã verify
  `schema.prisma`) — T002 kiểm bằng isolation matrix (SAAS-063).
- **Backup riêng** (non-negotiable #11, TC-016): backup T002 **không chứa** dữ liệu T001/T003.
  Dùng module `backup/` đã có (backup.tables + crypto). Restore T002 vào sandbox **giữ nguyên
  tenantNo/code** (TC-017).
- **Support access** vào T002 phải time-bound + approved + audited (TC-023).

## 8. Acceptance gate T002 & Gaps

**Acceptance (khớp `docs/10` + TEST_SCENARIOS):**
1. T002 được tạo **bởi Launch Factory** từ launch request của Delivery Workspace T001 (TC-008,
   TC-018) — không dual-write.
2. Chứng minh **XBooking + XBuilding + Shared MDM** (`docs/07`).
3. Entitlement đúng: T002 chỉ thấy app được cấp (TC-014).
4. Backup T002 độc lập (TC-016) + restore giữ tenantNo (TC-017).
5. Cross-tenant isolation PASS T001↔T002 (TC-005/006).
6. Không hardcode X-TECH; seed không plaintext (TC-024, TC-011).

**Gaps:**
- **XBuilding chưa tồn tại** trong `xhub-api/src/` → mảng vận hành cư dân demo bằng
  tickets/announcements/bookings ở giai đoạn này; XBuilding đầy đủ là hạng mục kế tiếp. Cần chốt
  với chủ đầu tư trước khi seed (`docs/07`: ngành trong catalog "có thể đổi trước khi seed").
- **Registry/Launch Factory chưa build**: `Tenant` model mới có `slug`+`name`, thiếu
  `tenantNo`/class/plan/entitlement → phụ thuộc `TENANT_REGISTRY_IMPLEMENTATION_PLAN` +
  `TENANT_LAUNCH_FACTORY_PLAN` hoàn thành trước.
- **Announcement 4/5 PH-02**: cần đóng để seed thông báo vận hành đầy đủ.
