# 00 — Thẩm định kế hoạch & MVP Fast-Track (đầu mối)

> Đọc file này TRƯỚC. Tổng hợp + thẩm định 9 doc kế hoạch (docs-first cho handoff `NEXT_PHASES`), chỉ ra conflict, thứ tự chống rework, và **con đường đóng MVP hoàn chỉnh nhanh nhất**. Cập nhật 2026-07-30.
> 9 doc chi tiết cùng thư mục: DELTA_ANALYSIS · PHASE_EXECUTION_PLAN · MENU_ROUTE_DELTA · INTERNAL_AUTH_CUTOVER · SEED_MIGRATION · XOFFICE_OPERATIONAL_DELTA · DOCUMENT_MIGRATION · X2BMS_BATCH0_DRYRUN · BACKUP_UAT_RUNBOOK.

## A. Đối chiếu luồng hiện tại — "đã có vs delta" (đã verify bằng đọc code)
| Vùng | Đã có (thật) | Delta phải làm | Khối lượng |
|---|---|---|---|
| Auth (PH-00) | session/JWT, IdentityGuard, PermissionGuard env-gated, OIDC **mock**, login/logout/me/switch-tenant, login validate theo Membership | invite activation · forgot/reset · **session revoke on suspend** · auth pages Tailux · cutover enforce | Trung bình |
| Admin write (PH-01) | **Org write LIVE** (PATCH/POST/DELETE org-units, PATCH positions) | **Invitation API · Role-binding write · Delegation (identity-level) write** · org effective-date · permission-matrix test-as-user · menu role-visibility | Nhỏ–TB (form FE sẵn) |
| XOffice (PH-02) | engine đủ (assignment/delegation/SLA/condition-AST/subflow/idempotency), UnifiedWorkItem projection, ExternalExecution MANUAL_TASK, /inbox live | **5 model + API CHƯA có: Request state-machine · Directive · Ticket · Booking · Announcement · comments/attachments** + ~8 màn FE | **LỚN (bottleneck)** |
| Documents (PH-03) | `/documents` LIVE `/api/records` (CRUD+version) | migrate legacy `Document` (đọc ở **14 site/13 màn**, read-only → rủi ro thấp) sang RecordDocument, giữ ID/deep-link | Nhỏ–TB |
| Projects (PH-03) | `/projects` listing đọc **seed** | chuyển sang **MDM** + dry-run 50 dự án synthetic + duplicate review (no auto-merge) | Trung bình |
| Backup (PH-04) | engine PASS (manifest/checksum/AES/sandbox/MUST_NOT_LEAK) | **schedule/retention/alert/quota · production restore mode + approval (requester≠approver)** · drill · UAT U1–U40 (hạ tầng /api/testruns đã có) | Trung bình |

## B. THẨM ĐỊNH — conflict & rủi ro (xếp theo mức độ)
1. 🔴 **Role registry lệch (conflict nặng nhất).** `SEED_ACCOUNTS.csv` dùng role code `TENANT_ADMIN/DEPARTMENT_HEAD/CFO/SECURITY_ADMIN…` nhưng PermissionPolicy đã seed chỉ có `ROLE_PLATFORM_ADMIN` (+ binding tạm cho usr-cfo/usr-ceo). Nếu **bật enforce** trước khi thống nhất map role→permission → **admin/tất cả bị 403, tự khóa**. → Phải chốt **1 role registry dùng chung** (accounts ↔ PermissionPolicy ↔ menu visibility) TRƯỚC PH-00/PH-01.
2. 🔴 **Thứ tự enforce.** Bắt buộc: seed 24 account + role binding → verify admin qua ở chế độ enforce (test:authz) → *mới* cutover `AUTH_ENFORCE=true`+`AUTH_ALLOW_HEADER_IDENTITY=false`. Không đảo. Lưu ý script seed hiện dùng header identity → **seed xong rồi mới tắt header**.
3. 🟠 **Menu role-visibility vs nguồn menu.** Handoff muốn menu-registry.seed.json; code dùng `navigation.model.ts` (giữ TS làm 1 nguồn — khuyến nghị). Nav item **đã có field `permission`** nhưng CHƯA lọc → cần thêm bộ lọc menu theo quyền hiệu lực (NX-016). Nhỏ nhưng phải làm trước khi khoe "role visibility".
4. 🟠 **"No demo fallback trên staging" vs pattern degrade-demo.** Nhiều màn hiện degrade sang demo khi API lỗi (chip demo). Gate handoff cấm điều này trên luồng đã "đóng". → Thêm cờ `STAGING_STRICT` biến degrade thành lỗi rõ ở các luồng đã đóng; giữ degrade cho dev.
5. 🟠 **Seed phụ thuộc model.** `SEED-XOFFICE-OPS-01` (42 request/10 directive/15 ticket/12 booking/6 announcement) **không nạp được** cho tới khi PH-02 dựng xong 5 model + write-API. Seed pack phải bám theo thứ tự build module.
6. 🟡 **Document migration blast radius.** 14 site đọc `collection("documents")` — read-only nên rủi ro thấp, nhưng phải migrate **đồng loạt** (hoặc giữ shim) để không nửa live nửa seed.
7. 🟡 **`/projects` double-build.** Listing seed vừa dựng sẽ bị PH-03 thay bằng MDM — reconcile, PH-03 **thay thế** (không xây song song).
8. 🟡 **Session revoke.** JWT self-contained 8h → không revoke được nếu không tái kiểm tra. Rẻ nhất: IdentityGuard **re-check `Membership.status`** mỗi request (1 query có index) thay vì dựng session store.
9. 🟡 **Config nhỏ trước enforce:** `AUTH_JWT_SECRET` đang rỗng ở `.env.example`; cookie `secure:false` → bật true sau TLS.

## C. Thứ tự thực thi chống rework (khuyến nghị)
**PH-00.5 (nền, làm 1 lần trước tiên):** chốt **role registry** + bộ lọc menu theo quyền + cờ `STAGING_STRICT`. Đây là "khóa nối" của mọi phase sau — làm sai ở đây là rework toàn bộ.
→ PH-00 auth (invite/reset/revoke + pages) + seed 24 account → verify enforce → cutover.
→ PH-01 (3 write API + effective-date + test-as-user + menu visibility).
→ PH-02 (bottleneck: 5 module) — **đây là phần dài nhất, quyết định tiến độ**.
→ PH-03 (doc migrate rẻ + projects→MDM) → PH-04 (backup ops + UAT).

## D. MVP HOÀN CHỈNH — NHANH NHẤT (đề xuất cắt scope)
Mục tiêu: pilot nội bộ **dùng thật được**, không nửa vời. Cắt PH-02 (bottleneck) xuống lõi:

**Phạm vi MVP (đóng trọn, không demo fallback):**
1. **Auth thật**: 24 account login bằng invite/reset, enforce quyền, revoke khi suspend.
2. **Admin-lite**: 3 write API (Invitation/Role-binding/Delegation) + menu theo role. (Hoãn: effective-date nâng cao, resolver v2.)
3. **1 luồng E2E lõi: Request → Approval** + comments/attachments + manual execution + XH-05 task detail live. (Hoãn: Directive/Ticket/Booking/Announcement.)
4. **Documents** đã live + migrate legacy (rẻ).
5. **Backup thủ công** + **UAT P0** (mở rộng /docs/test tới các case P0). (Hoãn: schedule/retention/approval tự động.)

**Hoãn sau MVP (fast-follow, không chặn pilot):** 4 module XOffice còn lại · `/projects`→MDM (giữ listing seed để demo) · backup automation · connector thật (PH-05).

**Vì sao nhanh:** phần nặng nhất (5 module) rút còn **1 module (Request/Approval)**; tận dụng tối đa engine + form kit + testruns + admin đã live. Ước lượng thô: MVP ≈ PH-00 + PH-01-lite + PH-02-core; ~40–50% khối lượng full pilot nhưng đã là lát cắt dùng thật.

## D2. Phân quyền chi tiết (yêu cầu chủ đầu tư — bắt buộc PH-01)
Phân quyền phải xuống **3 tầng**: (1) **Module/Workspace** (ẩn/hiện theo quyền), (2) **Menu item** — mỗi nav item đã có field `permission`, dùng `filterNavByPermissions` để ẩn menu không có quyền, (3) **Tính năng/hành động** — mỗi endpoint `@RequirePermission`, nút/thao tác ẩn/disable theo quyền hiệu lực. SECURITY_ADMIN cấu hình ma trận role × permission tới cấp menu/tính năng ở màn **Vai trò & quyền** + **Phạm vi dữ liệu**, có **test-as-user**. Role registry (đang build) là nguồn map role→permission→menu; mỗi menu/tính năng phải khai báo 1 permission để cấp phát ở granularity này.

## E. Tư vấn thêm
- **Làm "role registry" như task nền đầu tiên** — 1 map TS/JSON dùng chung (role → permissions, role → menu visibility, account → role). Chống rework #1.
- **Lọc menu theo quyền ngay** (nav đã có field `permission`) — nhỏ, mở khóa role-visibility + đúng gate.
- **`STAGING_STRICT`**: staging = fail loud (đúng gate "no demo fallback"); dev = degrade như hiện tại.
- **Session revoke rẻ**: re-check `Membership.status` trong guard, không dựng session store.
- **Quyết định của chủ đầu tư cần sớm:** (a) đồng ý cắt MVP như mục D? (b) rotate ANTHROPIC key; (c) khi nào có nguồn X2BMS thật cho 6.000 dự án (PH-03 chỉ dry-run 50 tới lúc đó).
