# SEED_MIGRATION_PLAN

Kế hoạch đưa các bộ seed trong handoff
`XTECH_XHUB_NEXT_PHASES_COMPACT_UX_SEED_HANDOFF_20260730/seed/*` vào hệ thống
seed của ứng dụng (`xhub-api`), phục vụ X-TECH Internal Pilot.

- Căn cứ handoff: `seed/SEED_MANIFEST.json`, `seed/*.seed.json`,
  `data/SEED_ACCOUNTS.csv`, `data/ROLE_CATALOG.csv`,
  `data/ROLE_PERMISSION_MATRIX.csv`, `contracts/seed-*.schema.json`,
  docs/04, docs/05, backlog `NX-029`.
- Căn cứ mã: `xhub-api/prisma/schema.prisma`, `src/seed/seed.service.ts`,
  `scripts/xoffice-db-seed.mjs`, `scripts/records-seed.mjs`,
  `seed-data/identity/xtech-identity-org.seed.json`, `src/prisma/prisma.service.ts`.
- Đọc kèm: `INTERNAL_AUTH_CUTOVER_PLAN.md`, `PHASE_EXECUTION_PLAN.md`,
  `DOCUMENT_MIGRATION_PLAN.md`, `X2BMS_BATCH0_DRYRUN_PLAN.md`.

> Non-negotiable liên quan (CLAUDE.md handoff): (5) không hardcode approver,
> (6) không plaintext password, (7) không email thật `.local`, (9) không tài
> liệu ERP giả, (10) không auto-merge fuzzy duplicate, (12) giữ `demo-isolation`
> + `MUST_NOT_LEAK`.

---

## (a) Mapping từng seed pack → model tenant-scoped của app

Ba lớp seed theo docs/04: **Canonical platform** → **Tenant X-TECH** →
**Operational scenario**.

| Handoff seed | Số bản ghi (manifest) | Target model app | Trạng thái model | Ghi chú mapping |
| --- | --- | --- | --- | --- |
| `accounts.seed.json` / `SEED_ACCOUNTS.csv` | 24 | `PersonProfile` + `Membership` + `RoleBinding` (+ `OrgUnit`/`Position`) | **CÓ** (schema.prisma:360/335/428/376/393) | id account = PersonProfile key; `primaryRole`+`extraRoles` → RoleBinding subjectType=USER; `orgUnitCode`→OrgUnit.code; `applicationAccess`→entitlement (AppAccountBinding, xem dưới) |
| `xoffice_requests.seed.json` | 42 | (đề nghị/approval) | **THIẾU model DB** — hiện phục vụ từ seed JSON `all.seed.json` + WorkflowInstance | **Gap lớn**: không có `model Request`. Xem §a.1 |
| `directives.seed.json` | 10 | (chỉ đạo/commitment) | **THIẾU model DB** (`all.seed.json.directives` = 1 bản ghi JSON tĩnh) | Cần model theo NX-025 |
| `tickets.seed.json` | 15 | (service desk) | **THIẾU model DB** (`all.seed.json.tickets` = 2 JSON tĩnh) | Cần model theo NX-026 |
| `bookings.seed.json` | 12 | (đặt tài nguyên) | **THIẾU model DB** | Cần model theo NX-027 |
| `announcements.seed.json` | 6 | (thông báo/ack) | **THIẾU model DB** | Cần model theo NX-028 |
| `documents.seed.json` | 10 | `RecordDocument` (+ `DocumentVersion`) | **CÓ** (schema.prisma:818/842) | Map `title`/`classification`/`status`/`currentVersion`/`ownerOrgUnit`; xem `DOCUMENT_MIGRATION_PLAN.md` (NX-030/031) |
| `mdm_projects_batch0.seed.json` | 50 | `SourceRecord` → `ImportJob` → `MasterRecord` (+ `DuplicatePair`) | **CÓ** (schema.prisma:649/673/717/736) | Đây là **dry-run import**, không seed thẳng master; xem `X2BMS_BATCH0_DRYRUN_PLAN.md` (NX-034) |

### (a.1) Cảnh báo trọng yếu — 5 model nghiệp vụ THIẾU

`prisma/schema.prisma` **không có** model nào cho Request / Directive / Ticket /
Booking / Announcement (đã grep xác nhận). Hiện `all.seed.json` chỉ chứa vài bản
ghi JSON tĩnh (`directives:1`, `tickets:2`) do `SeedService` đọc file phẳng, và
X.Office chủ yếu chạy qua `WorkflowInstance`/`ApprovalTask` (có model).

Hệ quả cho seed migration:
- **Không thể** seed 42 request / 10 directive / 15 ticket / 12 booking / 6
  announcement vào DB tenant-scoped cho tới khi các module PH-02
  (NX-025..NX-028, NX-020) tạo model + write-API. Seed pack này là **đầu vào
  chờ sẵn**, phụ thuộc các phase đó.
- Trong khi chờ: các seed JSON có thể nạp qua đường **seed JSON hiện có**
  (SeedService/all.seed.json) để FE demo, nhưng đó **không** phải dữ liệu
  tenant-scoped DB → **không** thỏa "no demo fallback on staging" (docs/00 §3).
  Vì vậy seed pack operational chỉ được coi là "live" khi model DB có thật.
- Đề xuất: khi tạo model mới, tuân thủ chú thích schema (mỗi bảng tenant-scoped
  mang `tenantId`, **phải** thêm vào `scripts/rls-setup.mjs` + `rls-test.mjs`).

### (a.2) Mapping account → identity plane (chi tiết)

Nguồn app đã có `seed-data/identity/xtech-identity-org.seed.json` (orgUnits,
people với `externalIdRefs.userId`, upsert idempotent theo id, seed dưới
`withBypass`). Bộ handoff `accounts.seed.json` **mở rộng** danh sách người:

- **PersonProfile**: `id`=account id, `fullName`=displayName, `email`=email
  `.local` (attribute, không phải key — schema.prisma:354), `status` map từ
  `status` (ACTIVE→active, DISABLED_BY_DEFAULT→suspended/left).
- **Membership** (`tenantId=tenant-xtech`): roles = `[primaryRole, ...extraRoles]`.
  Lưu ý `xoffice-db-seed.mjs` hiện chỉ lấy `primaryRole` → **cần mở rộng** để gộp
  extraRoles.
- **RoleBinding**: subjectType `USER`, subjectId=account id, roleCode theo
  primary/extra, scope theo orgUnit (đối chiếu `ROLE_PERMISSION_MATRIX.csv` +
  `ROLE_CATALOG.csv`). Selector workflow dùng position/role, **không** dùng tên
  (docs/05 nguyên tắc; non-negotiable 5).
- **App access = entitlement**: `applicationAccess` (XHub/X.Office/X.Space/...)
  → `TenantApplicationInstance`/`AppAccountBinding` (schema.prisma:529/545), là
  quyền dùng app, **không** tạo app-local account. docs/05: "App access chỉ là
  entitlement; app-local account dùng AppAccountBinding".
- **KHÔNG** mật khẩu: mọi account `password:null`, `mustChangePassword` là cờ
  thông tin cho flow invite (xem §c).

---

## (b) Cách tiếp cận idempotent

Mẫu đã có trong repo cần bám theo:
- `xoffice-db-seed.mjs`: **upsert theo id** trong **một transaction** với
  `SET LOCAL app.bypass_rls='on'` (vì seed đa tenant / chạy trước khi mở
  withTenant). Đây là khuôn chuẩn cho seed identity + operational DB.
- `records-seed.mjs`: **skip-by-title**, gọi HTTP `/api/records` khi server chạy,
  an toàn re-run (không wipe). Khuôn cho seed qua API (`npm run seed:records`).
- `SeedService`: đọc `seed-data/all.seed.json` (read-only, in-memory) — dùng cho
  dữ liệu demo tĩnh, **không** phải DB tenant-scoped.

Nguyên tắc cho seed pack mới:
1. **Idempotent skip-by-id**: mọi bản ghi có id ổn định (REQ-2026-xxxx,
   DIR-2026-xxx, IT-2026-xxxx, BOOK-2026-xxxx, ANN-2026-xxx, DOC-XTECH-xxxx,
   X2P-xxxxx) → `upsert where {id}` (hoặc unique tenant+code), re-run không nhân
   bản. Đối chiếu acceptance NX-029 "Manifest counts + isolation marker".
2. **Re-runnable, không destructive**: không xóa dữ liệu người dùng đã tạo; chỉ
   thêm/cập nhật bản ghi seed (đánh dấu `seedScenario:true`/`sourceKind` để lọc).
3. **RLS-aware**: seed đa/liên tenant chạy trong transaction `withBypass`
   (prisma.service.ts) hoặc `SET LOCAL app.bypass_rls='on'` như
   `xoffice-db-seed.mjs`; seed một tenant có thể dùng `withTenant`.
4. **Mở rộng script chuẩn**: thêm bước nạp account handoff vào
   `xoffice-db-seed.mjs` (hoặc script `seed:identity` mới cùng khuôn) và
   `seed:records` cho documents; các operational khác chờ module DB (§a.1) rồi
   thêm `seed:xoffice-ops`.
5. **Đọc theo contract**: validate mỗi file theo `contracts/seed-account.schema.json`
   / `seed-manifest.schema.json` trước khi nạp (fail sớm nếu lệch schema).

---

## (c) No plaintext password + xử lý invite-activation

- Tất cả account handoff: `password:null` — **không** nạp bất kỳ trường mật khẩu
  nào vào DB (khớp SECURITY.md hard invariant + non-negotiable 6). `scan:secrets`
  phải PASS sau seed.
- **Activation mode** (contract enum) quyết định cách seed đánh dấu tài khoản:
  - `INVITE_LINK` (22 account): seed để `status ACTIVE` + `mustChangePassword`,
    **không** phát token khi seed; token invite do flow PH-00 phát khi cần
    (xem `INTERNAL_AUTH_CUTOVER_PLAN.md` §b). Không email thật `.local`.
  - `MANUAL_SECURE_SETUP` (`usr-platform-admin`): seed **DISABLED_BY_DEFAULT** →
    Membership `status suspended`/không active; chỉ người vận hành kích hoạt thủ
    công. docs/04: "`usr-platform-admin` disabled by default".
  - `NO_LOGIN_IN_XTECH` (`usr-demo-isolation`): seed người dùng nhưng **cấm
    login** trong `tenant-xtech`; dùng làm chốt isolation.
- Flow invite/reset **không** thuộc bước seed — seed chỉ tạo person/membership ở
  trạng thái đúng để flow PH-00 hoạt động. Điều này giữ ranh giới: seed = dữ
  liệu; auth = flow.

---

## (d) Cổng verify manifest-count + bảo toàn isolation

Sau mỗi lần seed, chạy **gate đếm** so với `SEED_MANIFEST.json.datasets`:

| Dataset | Count kỳ vọng |
| --- | --- |
| accounts | 24 |
| xofficeRequests | 42 |
| directives | 10 |
| tickets | 15 |
| bookings | 12 |
| announcements | 6 |
| documents | 10 |
| mdmProjectsBatch0 | 50 |

- Gate FAIL nếu count DB (đã seed, `sourceKind` synthetic) **≠** manifest →
  chặn release (NX-029 acceptance "Manifest counts").
- **Isolation marker** (`SEED_MANIFEST.isolationMarker`): tenant
  `demo-isolation`, email `must.not.leak@demo-isolation.local`, marker
  `MUST_NOT_LEAK`. Phải:
  - Được seed để tồn tại như chốt kiểm thử **nhưng** không bao giờ rò sang
    `tenant-xtech`. `SeedService.assertScope` **đã** throw nếu bất kỳ collection
    chứa chuỗi `MUST_NOT_LEAK` lọt qua scope (seed.service.ts:29) — giữ nguyên
    hành vi này và bổ sung kiểm tra tương đương ở tầng DB (RLS + `test:isolation`).
  - `test:isolation` / `test:rls` phải PASS: query dưới `tenant-xtech` không trả
    bản ghi `demo-isolation`.
- Non-negotiable 12: giữ `demo-isolation` và `MUST_NOT_LEAK` xuyên suốt — không
  được xóa để "làm sạch" dữ liệu.

---

## (e) Seed packs theo phase + thứ tự chạy

Thứ tự bám implementation order handoff (PH-00 → PH-01 → PH-02 → PH-03 → PH-04)
và dependency backlog:

| Pack | Phase | Nội dung | Phụ thuộc | Model sẵn sàng? |
| --- | --- | --- | --- | --- |
| **SEED-IDENTITY-01** | PH-00 | tenant + OrgUnit + Position + PersonProfile + Membership (24 account) | NX-002 (auth) để login được | **CÓ** — mở rộng `xoffice-db-seed.mjs`/identity seed |
| **SEED-TENANT-ADMIN-01** | PH-01 | RoleBinding + PermissionPolicy + DataScope + App entitlement (AppAccountBinding) + Delegation seed | SEED-IDENTITY-01; NX-011/012/013 | **CÓ** (RoleBinding/PermissionPolicy/DataScope/AppAccountBinding) |
| **SEED-XOFFICE-OPS-01** | PH-02 | 42 requests, 10 directives, 15 tickets, 12 bookings, 6 announcements | SEED-TENANT-ADMIN-01; **NX-020/025/026/027/028** (tạo model + write-API) | **THIẾU model** — chờ PH-02 (§a.1) |
| **SEED-RECORDS-MDM-01** | PH-03 | 10 documents → RecordDocument; 50 mdm_projects_batch0 → dry-run import (SourceRecord/ImportJob) | NX-031 (Document→RecordDocument), NX-034 (batch0 rehearsal) | **CÓ** — RecordDocument + MDM pipeline |
| **SEED-UAT-01** | PH-04 | tập kịch bản UAT U1-U40 dựa trên dữ liệu các pack trên | Tất cả pack trên; NX-043/044 | phụ thuộc dữ liệu upstream |

Thứ tự chạy bắt buộc: **IDENTITY → TENANT-ADMIN → XOFFICE-OPS → RECORDS-MDM →
UAT**. Lý do: operational tham chiếu `requesterId/issuedBy/organizerId/...` là
các account id (vd `usr-sales-01`, `usr-ceo`) → phải có PersonProfile/Membership
trước; role binding phải có trước khi selector workflow giải quyết approver
(non-negotiable 5).

### Lưu ý cutover-vs-seed (giao với INTERNAL_AUTH_CUTOVER_PLAN)

- Chạy seed **trước** khi bật `AUTH_ALLOW_HEADER_IDENTITY=false`. Các script
  hiện dùng header `x-user-id/x-tenant-id` (vd `records-seed.mjs`) sẽ hỏng khi
  header identity tắt → hoặc chạy seed trước cutover, hoặc chuyển seed sang
  đường server-side dùng `withBypass` (không qua HTTP header).
- Sau seed, chạy `scan:secrets` (PASS), `test:isolation`/`test:rls` (PASS),
  gate đếm manifest (khớp) → mới coi bộ seed đạt.
