# TENANT ADMIN UI (TA-01) — GAP ANALYSIS

_Nguồn handoff: `D:\Code\handoff\Xhub\XTECH_XHUB_TENANT_ADMIN_UI_HANDOFF_20260729` (SET TA-01)._
_Audit READ-ONLY, cập nhật 2026-07-29. Tài liệu này KHÔNG sửa code/seed — chỉ đối chiếu & đề xuất._
_Liên quan: `IDENTITY_ORG_GAP_ANALYSIS.md`, `TENANT_BACKUP_RESTORE_GAP_ANALYSIS.md`, `IMPLEMENTATION_PLAN_IDENTITY_ORG_BACKUP.md` (cùng thư mục `xhub-web`)._

## 0. Nguyên tắc bất biến (từ handoff docs/00, 01, 04 + CLAUDE.md)

- **Tenant Admin là lớp QUẢN TRỊ DÙNG CHUNG.** Identity/Org Core sở hữu user/role/scope/org; XOffice chỉ sở hữu workflow role, assignment rule, approval policy, task, resolution snapshot. Tenant Admin UI chỉ là mặt trước cho lớp shared này.
- **IdP ngoài giữ credential/MFA/token.** Không lưu password/secret trong DB XHub/XOffice; màn user detail chỉ hiển thị *external identities* (reference), không hiện secret.
- **X-TECH = Tenant 001, chế độ STANDALONE.** Không branch/schema riêng cho từng tenant; cách ly bằng `tenant_id` + RLS.
- **Tenant context lấy từ session/membership**, không lấy từ query/body/header không tin cậy (docs/03, docs/11 Acceptance Gate).
- **AI luôn là suggestion** — không tự apply role/scope/delegation/restore (docs/09).
- **Mọi hành động nhạy cảm** có impact preview + confirm + audit (correlationId, idempotencyKey — docs/08).

---

## 1. Hiện trạng FE (evidence)

| Khía cạnh | Hiện trạng | Evidence |
|---|---|---|
| Route admin | **Chỉ 1 route** `/admin` (không có sub-route nào trong 15 màn TA) | `xhub-web/src/app/(app)/admin/page.tsx`; `find … -path '*admin*'` chỉ ra đúng 1 file |
| Nội dung /admin | Trang **server component tĩnh, đọc thẳng seed**, đánh dấu "Demo · thao tác nhạy cảm bị vô hiệu hóa"; nút "Thêm người dùng"/"Sửa · Khóa" đều `disabled` | `admin/page.tsx:20-181` (`collection<...>("users"/"roles"/…)`, badge warning dòng 43) |
| Users | Bảng đọc `users` + `userRoles` + `roles` seed, không filter/paginate/invite/suspend, không link chi tiết | `admin/page.tsx:60-91` |
| Roles | Danh sách role phẳng + list permission strings; **không có permission matrix, không binding target, không effective** | `admin/page.tsx:94-108`; seed `data/seed/roles.json` |
| Org | Chỉ **cây 2 cấp tĩnh** (root + children `parentId`), không tree canvas, không version/effective-date, không position/holder | `admin/page.tsx:110-126`; seed `organizations.json` (model phẳng `parentId`) |
| Connectors / Tenant | Bảng connectors + card tenant/feature (đọc seed) | `admin/page.tsx:129-179` |
| UI kit sẵn có | `DataTable`, `Pagination`, `PaginatedTable`, `Card/SectionCard`, `StatCard`, `Badge`, `AiRecap`, charts — đã dùng ở customers/documents/inbox/office | `xhub/ui/*`; `CustomersTable.tsx`, `InstancesTable.tsx`, `WorkflowsTable.tsx` |
| Auth/session | Có login thật + `/api/auth/me` trả `memberships[]` (roles per tenant) + switch-tenant; guard soft | `xhub-api/src/auth/auth.controller.ts:29-60`; `auth.service.ts` `MembershipView{roles[]}` |
| Nav | Một entry `/admin` với `permission: admin.access`; **chưa có sub-nav** cho users/org/roles/backup… | `data/nav/navigation-tree.vi.json:15` |

**Nhận định:** FE mới có **1/15 màn** ở mức "dashboard demo chỉ đọc". 14 màn còn lại (TA-02…TA-15) **chưa tồn tại**. UI kit (DataTable/Pagination/Tailux) đã đủ để dựng các bảng, nhưng **các thành phần đặc thù TA** (org tree canvas, permission matrix, scope builder, assignment resolver, restore state machine, AI admin) đều **thiếu hoàn toàn**.

---

## 2. Đối chiếu 15 màn TA (SCREEN_CATALOG / screens.json + docs/03)

| Mã | Route | Màn | Trạng thái FE | Gap chính |
|---|---|---|---|---|
| TA-01 | `/admin` | Tổng quan quản trị | **CÓ (một phần)** — dashboard đọc seed | Thiếu: cảnh báo cấu hình, thay đổi gần đây (audit), AI Admin Brief, quick actions có quyền |
| TA-02 | `/admin/users` | DS người dùng | **THIẾU** | Table + filter + status chip + bulk + Invite drawer + suspend/reactivate |
| TA-03 | `/admin/users/[id]` | Chi tiết người dùng | **THIẾU** | Profile header, tabs, role bindings, **scope viewer**, audit timeline, external identities |
| TA-04 | `/admin/organization` | Sơ đồ tổ chức | **THIẾU** (chỉ có cây tĩnh 2 cấp trong TA-01) | **Tree canvas + accessible tree-grid**, details panel, version selector, effective-date, AI integrity check |
| TA-05 | `/admin/organization/units/[id]` | Chi tiết đơn vị | **THIẾU** | Trưởng đơn vị, members, positions, reporting line, scope mặc định, history |
| TA-06 | `/admin/positions` | Vị trí & người giữ | **THIẾU** | Position table, holder timeline, vacancy, acting assignment drawer, ngày hiệu lực |
| TA-07 | `/admin/roles` | Vai trò & quyền | **THIẾU** (chỉ list role phẳng trong TA-01) | **Permission matrix** (direct/inherited/position/delegation/scope/effective + lý do), role binding drawer, impact preview |
| TA-08 | `/admin/data-scopes` | Phạm vi dữ liệu | **THIẾU** | **Scope builder**, preview effective access, conflict warnings, **test-as-user** |
| TA-09 | `/admin/delegations` | Ủy quyền & người thay | **THIẾU** | Delegation table, calendar, scope selector, conflict detector, guardrails (docs/06) |
| TA-10 | `/admin/assignment-resolver` | Trình kiểm tra phân công | **THIẾU** | Input context, resolution steps, candidates + lý do loại, selected approver, **snapshot JSON** |
| TA-11 | `/admin/backups` | Quản lý backup | **THIẾU** | Backup list, policy summary, storage usage, run backup, integrity status |
| TA-12 | `/admin/backups/[id]` | Chi tiết backup | **THIẾU** | Manifest, modules, files, checksum, encryption, restore eligibility |
| TA-13 | `/admin/restores` | Lịch sử & kế hoạch restore | **THIẾU** | **Restore state machine** (11 state), conflict report, approval gate, verification; KHÔNG dùng nút "Restore" đơn |
| TA-14 | `/admin/audit` | Audit Explorer | **THIẾU** (P1) | Advanced filter, event timeline, before/after, **correlation chain**, export |
| TA-15 | `/admin/settings/tenant` | Cấu hình tenant | **THIẾU** (P1) | General/branding, **STANDALONE/FEDERATED mode**, storage, backup, security, integrations, feature flags |

**Tổng kết màn:** ĐÃ CÓ 1 (TA-01 mức demo). THIẾU 14 (12 P0 + 2 P1).

### Nhóm năng lực ĐÃ CÓ vs THIẾU

- **ĐÃ CÓ (nền tảng):** shell nav 2 lớp Tailux; login/session/`/auth/me` với membership + roles per tenant; DataTable/Pagination/PaginatedTable; dashboard đọc seed users/roles/org/connectors/tenant.
- **THIẾU (đặc thù TA):**
  - Org chart tương tác (tree canvas + tree-grid a11y) + versioning/effective-date.
  - Assignment resolver preview ("ai sẽ duyệt trong ngữ cảnh" + candidate/loại + snapshot).
  - Delegation UX (calendar, scope selector, conflict/guardrail).
  - Permission & Data Scope viewer (RBAC/ABAC hiệu lực, effective permission + lý do, test-as-user).
  - Backup/Restore admin (create/verify/dry-run/sandbox + state machine + conflict + approval gate).
  - AI Admin assistant (brief, orphan/vacant/loop detection, giải thích quyền — draft-first).
  - Audit/correlation explorer.

---

## 3. Đối chiếu API contracts (docs/08) với backend hiện có

Backend `xhub-api` hiện chỉ có các module: `auth`, `preferences`, `prisma`, `seed`, `xoffice`. **Không có module `admin`.** Endpoint dưới `/api/admin/*` trong docs/08 **chưa tồn tại** trừ phần trùng với auth/xoffice.

| Nhóm docs/08 | Endpoint | Backend hiện có? | Ghi chú / Evidence |
|---|---|---|---|
| Users & membership | `GET /api/admin/users`, `invite`, `GET/:id`, `PATCH/:id`, `suspend`, `reactivate` | **THIẾU** | Chỉ có `Membership` model + `/auth/me` trả memberships; không có CRUD/invite/suspend (`auth.service.ts`) |
| Organization | `org/versions` (GET/POST/publish), `org/tree`, `org/units` (POST/PATCH), `positions` (GET/POST/assign) | **THIẾU toàn bộ** | Không có OrgUnit/Position/OrgVersion trong `prisma/schema.prisma` (xem IDENTITY_ORG_GAP §1) |
| Roles & scopes | `roles` (GET/POST), `role-bindings` (GET/POST/DELETE), `data-scopes` (GET/POST), `access/simulate` | **THIẾU** | Role-binding hiện là **file JSON phẳng** `roleCode→userEmail` (`seed-data/xoffice/role-bindings.json`), không API quản trị; không có DataScope/PermissionPolicy/simulate |
| Delegation & assignment | `delegations` (GET/POST/PATCH), `assignment-resolver/simulate` | **MỘT PHẦN** | Có model `Delegation{fromUserId,toUserId,fromAt,toAt}` + `findValidDelegate` (403 người lạ), resolver `resolveAssignee` roleCode→1 user (`xoffice.service.ts`); **CHƯA có** REST admin CRUD, chưa có simulate trả candidate/snapshot |
| Backup | `backups` (GET/POST/:id/verify/restore-sandbox) | **THIẾU** | Chưa có tenant backup job/manifest/checksum (xem TENANT_BACKUP_RESTORE_GAP) |
| Restore | `restores` (GET/:id/approve/apply/cancel) | **THIẾU** | Chưa có restore state machine/sandbox/conflict |
| Cross-cutting | correlationId + idempotencyKey + audit cho mọi command | **MỘT PHẦN** | Có `CommandLog @@unique(tenantId,idempotencyKey)` + `AuditLog` append-only cho xoffice; chưa mở cho admin commands |

**Nhận định API:** Toàn bộ vùng `/api/admin/*` cần được backend Identity/Org Core + Backup xây trước (hoặc song song). FE TA phụ thuộc trực tiếp các endpoint này; hiện chỉ `/auth/me` (membership) + `Delegation`/`resolveAssignee` (mức đơn giản) là có thật.

---

## 4. Rủi ro & ràng buộc gate (docs/11)

- **Tenant context:** dashboard TA-01 hiện đọc seed toàn cục, chưa scope theo membership/session → khi lên thật phải lấy tenant từ session (gate "không lấy từ body/query").
- **RLS:** chưa bật Postgres RLS (PROJECT_STATUS §6) → gate "RLS chặn raw query sai tenant" chưa đạt; ảnh hưởng TA-07/08/14.
- **Hardcode assignee:** resolver hiện map phẳng roleCode→email; gate "không workflow nào hardcode người duyệt theo tên" + "assignment snapshot đầy đủ" chưa đạt → khối TA-10 phụ thuộc resolver v2.
- **MUST_NOT_LEAK / isolation:** chưa có backup/restore → toàn bộ gate Backup chưa kiểm được.
- **A11y:** gate yêu cầu accessible list view cho org chart + keyboard cho critical journey → phải thiết kế OrgTreeGrid ngay từ đầu, không chỉ canvas.

---

## 5. Backlog gap theo ưu tiên

### P0 (nền tảng vận hành + vertical slice)
- P0-1 Route scaffold `/admin/*` + sub-nav (users, organization, positions, roles, data-scopes, delegations, assignment-resolver, backups, restores) với permission-gating theo membership.
- P0-2 TA-02/03 Users & Membership (list/filter/invite/suspend + detail tabs + external identities read-only) — cần backend `admin/users`.
- P0-3 TA-04/05/06 Org chart tương tác + version/effective-date + position/holder — cần Org Core backend.
- P0-4 TA-10 Assignment resolver preview + snapshot JSON — cần resolver v2 + assignment-snapshot contract.
- P0-5 TA-09 Delegation UX + guardrails — mở rộng model Delegation + scope/conflict.
- P0-6 TA-07/08 Permission matrix + Data scope builder + **test-as-user** — cần PermissionPolicy/DataScope + `access/simulate`.
- P0-7 TA-11/12/13 Backup/Restore admin + **restore state machine** (không nút Restore đơn) — cần backup job/manifest + restore engine.
- P0-8 TA-01 nâng cấp: cảnh báo cấu hình + recent changes (audit) + quick actions gated.

### P1
- P1-1 TA-14 Audit Explorer + correlation chain + export.
- P1-2 TA-15 Cấu hình tenant (branding, STANDALONE/FEDERATED, storage, security, integrations, feature flags).
- P1-3 AI Admin Assistant (brief + orphan/vacant/loop detection + giải thích quyền, draft-first, có preview/confirm).
- P1-4 Bật Postgres RLS + enforce guard cứng cho `/api/admin/*`.

### P2
- P2-1 Federated-readiness skeleton (projection/overlay từ HRIS) cho org/position.
- P2-2 Visual regression + performance cho org chart dữ liệu lớn.
- P2-3 Saved views / export theo quyền cho toàn bộ bảng TA.

---

## 6. Evidence tóm tắt

- FE admin: `xhub-web/src/app/(app)/admin/page.tsx` (chỉ 1 file, đọc seed, hành động disabled).
- UI kit: `xhub-web/src/xhub/ui/{DataTable,Pagination,PaginatedTable,Card,StatCard,Badge,AiRecap}.tsx`.
- Nav: `xhub-web/src/data/nav/navigation-tree.vi.json:15`.
- Auth/membership: `xhub-api/src/auth/{auth.controller.ts,auth.service.ts}` (`/me` trả `memberships[].roles`).
- Resolver/Delegation hiện có: `xhub-api/src/xoffice/xoffice.service.ts` (`resolveAssignee`, `findValidDelegate`), `prisma/schema.prisma` (`Delegation`, `CommandLog`, `AuditLog`).
- Backend module list: `xhub-api/src/{auth,preferences,prisma,seed,xoffice}` — không có `admin`.
- Handoff catalog: `data/SCREEN_CATALOG.csv` (15 màn), `data/role_catalog.json` (6 role TA), `data/org_units_seed.json` (10 unit), `data/positions_seed.json` (9 position).
</content>
</invoke>
