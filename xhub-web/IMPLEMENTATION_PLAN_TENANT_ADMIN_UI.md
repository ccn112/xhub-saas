# IMPLEMENTATION PLAN — TENANT ADMIN UI (TA-01)

_Nguồn: handoff `XTECH_XHUB_TENANT_ADMIN_UI_HANDOFF_20260729` — docs/10 (plan), docs/12 (component map), docs/11 (acceptance), tests/E2E_VERTICAL_SLICE._
_Đi kèm `TENANT_ADMIN_UI_GAP_ANALYSIS.md`. Docs-first: kế hoạch, KHÔNG sửa code/seed._
_Phụ thuộc thượng nguồn: Identity/Org Core (Mục 3 backend), Tenant Backup (Mục 6), Control Plane — xem `IMPLEMENTATION_PLAN_IDENTITY_ORG_BACKUP.md`._

## 0. Nguyên tắc thực thi

- Tenant Admin = lớp quản trị **dùng chung**; Identity/Org Core sở hữu dữ liệu, IdP ngoài giữ credential/MFA. X-TECH = Tenant 001 STANDALONE, không branch/schema riêng.
- **FE không chạm DB** — mọi truy cập qua BFF `/api/admin/*`. Tenant lấy từ session/membership.
- **Tái dùng Tailux + `xhub/ui`**, không tạo design system thứ hai (docs/12).
- Mỗi màn phải có 5 state: loading / empty / error / permission-denied / stale (docs/03).
- Hành động nhạy cảm: impact preview → confirm → audit (correlationId + idempotencyKey).
- AI draft-first, không tự apply (docs/09).

---

## 1. Cây route đề xuất (Next.js App Router, group `(app)`)

```
app/(app)/admin/
├── page.tsx                         TA-01  (nâng cấp bản demo hiện có)
├── users/
│   ├── page.tsx                     TA-02
│   └── [id]/page.tsx                TA-03
├── organization/
│   ├── page.tsx                     TA-04
│   └── units/[id]/page.tsx          TA-05
├── positions/page.tsx               TA-06
├── roles/page.tsx                   TA-07
├── data-scopes/page.tsx             TA-08
├── delegations/page.tsx             TA-09
├── assignment-resolver/page.tsx     TA-10
├── backups/
│   ├── page.tsx                     TA-11
│   └── [id]/page.tsx                TA-12
├── restores/page.tsx                TA-13
├── audit/page.tsx                   TA-14  (P1)
└── settings/tenant/page.tsx         TA-15  (P1)
```

- **Nav:** mở rộng `data/nav/navigation-tree.vi.json` (entry `admin` hiện có `permission: admin.access`) thành nhóm con; mỗi mục gắn permission riêng (`admin.users`, `admin.org`, `admin.roles`, `admin.scope`, `admin.delegation`, `admin.backup`, `admin.audit`).
- **Layout:** thêm `admin/layout.tsx` để gate quyền theo membership (`/auth/me`) + sub-nav trái; ẩn action khi không có quyền (gate docs/11 "không có quyền không thấy action").

---

## 2. Component tái dùng & mới (theo docs/12 component map)

| Component (docs/12) | Cơ sở tái dùng | Ghi chú |
|---|---|---|
| `UserTable`, `UserFilters` | `xhub/ui/DataTable` + `Pagination` + `PaginatedTable`, mẫu `CustomersTable.tsx` | filter/status chip/bulk |
| `InviteUserDrawer`, `UserDetailTabs` | Drawer Tailux + `Card`/`Badge` | tab: membership, role binding, scope, audit, external identity |
| `OrgTreeCanvas` | React Flow (đã dùng ở office builder) | view trực quan |
| `OrgTreeGrid` | table/tree-grid a11y (mới) | **bắt buộc** cho keyboard/screen-reader + dữ liệu lớn (gate a11y) |
| `OrgUnitPanel`, `PositionTable`, `OrgVersionDiff` | `Card` + `DataTable` + diff view | effective-date + version |
| `RoleCatalog`, `PermissionMatrix` | ma trận mới trên `Card`/`Badge` | direct/inherited/position/delegation/scope/effective + lý do |
| `RoleBindingDrawer` | Drawer + confirm + impact preview | binding target USER/POSITION/GROUP/ORG_UNIT/TENANT_DEFAULT |
| `DataScopeBuilder`, `EffectiveAccessViewer`, `TestAsUserPanel` | form builder + preview (mới) | test-as-user: allow/deny + policy version + scope khớp + điều kiện fail + delegation |
| `assignment-resolver/*` | input form + steps + `<pre>` snapshot JSON | candidate + lý do loại + selected + snapshot |
| `delegation/*` | table + calendar + scope selector + conflict badge | guardrails docs/06 |
| `BackupList`, `BackupManifestViewer`, `FileInventoryTable`, `BackupPolicyForm` | `DataTable` + `Card` | checksum/encryption/retention/eligibility |
| `RestoreTimeline`, `ConflictReview`, `RestoreApprovalPanel`, `VerificationResults` | stepper state machine (mới) | 11 state; **không** nút "Restore" đơn |
| `audit/*` | `DataTable` + timeline + before/after diff | correlation chain + export |
| `AiRecap` / AI Admin Brief | `xhub/ui/AiRecap.tsx` | draft-first + preview/confirm |

Thư mục đề xuất: `xhub-web/src/features/tenant-admin/{overview,users,organization,access,delegation,assignment-resolver,backup,restore,audit}` (khớp docs/12).

---

## 3. Vertical slice (tests/E2E_VERTICAL_SLICE + docs/10)

Mục tiêu chuỗi end-to-end chứng minh lớp TA hoạt động thật:

```
Seed cơ cấu X-TECH (org unit + position + holder, STANDALONE)
→ TA-10 Assignment resolver: Trần Thu Hà đề nghị mua sắm 250.000.000đ
   → resolver tìm đúng 4 cấp: TP Kinh doanh → TP Công nghệ → CFO → TGĐ
   → sinh Assignment Resolution Snapshot (candidate + lý do loại + selected)
→ TA-09 Delegation: kích hoạt uỷ quyền CFO → kiểm tra onBehalfOf + delegationId
→ workflow hoàn thành + tạo file báo giá (namespace theo tenant)
→ TA-11 Backup tenant X-TECH (logical package 1 tenant)
   → verify manifest + checksum + record count + file inventory
→ TA-13 Restore vào sandbox → rebuild UnifiedWorkItem
→ kiểm tra quyền + assignment snapshot
→ Xác minh package/restore KHÔNG chứa `MUST_NOT_LEAK` (isolation gate)
```

Slice này chạm P0-3 (org), P0-4 (resolver), P0-5 (delegation), P0-7 (backup/restore) và các acceptance gate Identity/Backup/UX (docs/11).

---

## 4. Phụ thuộc backend (endpoint cần có trước — docs/08)

| FE màn | Endpoint backend cần | Trạng thái (xem GAP §3) |
|---|---|---|
| TA-02/03 | `GET/POST /api/admin/users`, `invite`, `GET/PATCH /:id`, `suspend`, `reactivate` | THIẾU (chỉ có `Membership` + `/auth/me`) |
| TA-04/05/06 | `org/versions`, `org/tree`, `org/units`, `org/versions/:id/publish`, `positions`, `positions/:id/assign` | THIẾU (Org Core chưa có) |
| TA-07/08 | `roles`, `role-bindings`, `data-scopes`, `access/simulate` | THIẾU (role-binding còn là JSON phẳng) |
| TA-09/10 | `delegations` (GET/POST/PATCH), `assignment-resolver/simulate` | MỘT PHẦN (`Delegation` + `resolveAssignee` đơn giản; cần v2 + simulate + snapshot) |
| TA-11/12/13 | `backups` (+verify/restore-sandbox), `restores` (+approve/apply/cancel) | THIẾU (backup/restore chưa có) |
| Cross | correlationId + idempotencyKey + audit cho mọi command | MỘT PHẦN (có `CommandLog`/`AuditLog` ở xoffice) |

**Thứ tự bắt buộc:** Identity/Org Core + PermissionPolicy/DataScope + resolver v2 (Mục 3 backend) → Backup/Restore engine (Mục 6) → Control Plane. FE TA của mỗi màn chỉ nên bắt đầu khi endpoint tương ứng sẵn sàng (hoặc dùng mock BFF có contract cố định để không chặn UI).

---

## 5. Ánh xạ file/route xhub-web sẽ đụng

- **Sửa/nâng cấp:** `src/app/(app)/admin/page.tsx` (TA-01 thêm cảnh báo cấu hình, recent changes, AI brief, quick actions gated); `src/data/nav/navigation-tree.vi.json` (sub-nav admin).
- **Tạo mới:** toàn bộ cây route Mục 1 + `src/app/(app)/admin/layout.tsx` (gate quyền) + `src/features/tenant-admin/*` (component Mục 2).
- **Tái dùng nguyên trạng:** `src/xhub/ui/{DataTable,Pagination,PaginatedTable,Card,StatCard,Badge,AiRecap}.tsx`; mẫu bảng `CustomersTable.tsx`, `InstancesTable.tsx`, `WorkflowsTable.tsx`; React Flow (office builder) cho OrgTreeCanvas.
- **Client dữ liệu:** thêm lớp gọi BFF cho `/api/admin/*` (dùng session cookie `xhub_session`); KHÔNG đọc seed trực tiếp trong component TA (khác cách TA-01 demo hiện tại).

---

## 6. Thứ tự triển khai (theo Sprint docs/10)

| Ưu tiên | Hạng mục | Màn TA | Phụ thuộc backend |
|---|---|---|---|
| **P0** | Sprint 1 — Org foundation | scaffold route/nav, TA-02→06, TA-09, TA-10 | Membership, Org tree/version, Position/holder, Role binding, Delegation, Assignment Resolver v2 |
| **P0** | Sprint 2 — Auth/permission/RLS | TA-07, TA-08, (TA-14 khung) | Permission evaluator, Data scope, test-as-user, Postgres RLS, AI ACL |
| **P0** | Sprint 3 — Backup/restore | TA-11, TA-12, TA-13 | Backup job/manifest/checksum/encryption, sandbox restore, conflict report + restore drill X-TECH |
| **P1** | Sprint 4 — Hardening | TA-14 (đầy đủ), TA-15, AI Admin | Audit explorer, AI Assistant, visual regression, a11y, performance, federated skeleton |

### Definition of Done theo gate (docs/11)
- Không màn nào hardcode assignee/tenant; tenant lấy từ session.
- Người không quyền không thấy action + API từ chối; RLS chặn raw query sai tenant.
- Org chart có accessible list view; destructive action có impact preview; keyboard cho critical journey.
- Backup 1 tenant, checksum PASS, không secret, sandbox PASS, `MUST_NOT_LEAK` không xuất hiện.
- AI chỉ suggestion, mọi đề xuất có preview/diff + lý do + nguồn + nút confirm.

---

## 7. Backlog P0 (rút gọn để bắt tay ngay)

1. Scaffold `/admin/*` route tree + `admin/layout.tsx` gate quyền + sub-nav (permission-gated).
2. TA-02/03 Users & Membership (list/filter/invite/suspend + detail tabs + external identities read-only).
3. TA-04/05/06 Org chart (canvas + tree-grid a11y) + version/effective-date + position/holder.
4. TA-10 Assignment resolver preview + snapshot JSON (candidate + lý do loại + selected).
5. TA-09 Delegation UX + guardrails (không tự uỷ quyền, không vòng lặp, không vượt quyền nguồn).
6. TA-07/08 Permission matrix + Data scope builder + test-as-user.
7. TA-11/12/13 Backup/Restore admin + restore state machine (11 state, không nút Restore đơn).
8. TA-01 nâng cấp (cảnh báo cấu hình + recent changes/audit + AI brief + quick actions gated).

> Mọi hạng mục P0 chỉ hoàn tất khi endpoint `/api/admin/*` tương ứng có thật; nếu backend chưa sẵn, dựng mock BFF theo contract docs/08 để UI không bị chặn nhưng không hardcode seed trong component.
</content>
