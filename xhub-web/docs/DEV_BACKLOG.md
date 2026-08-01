# Backlog phát triển — XHub / X.Space / X.Office

> Nhật ký phát triển: đã làm gì, mốc version, việc đang làm, known issues. Cập nhật 2026-07-30.
> Repo **không dùng git** (D:\Code) → "version" = mốc milestone nội bộ. Kiểm thử = các `npm run test:*` (xem trang Kiểm thử).

## Sơ đồ version (milestone)
| Version | Nội dung | Trạng thái |
|---|---|---|
| **v0.8.0** platform-complete | Nền tảng 8/8 (auth·RLS·identity·control-plane·MDM·backup·admin·records/webhook/AST) | ✅ |
| **v0.8.1** wire-live + UX | Admin 15 màn wire API thật · Documents→/api/records · docs UI /docs · mobile responsive · sơ đồ tổ chức cây kéo-thả | ✅ |
| **v0.9.0** role-foundation + PH-00 | Role registry 16 role + wildcard `can()` + menu-filter · Internal Auth (invite/reset/session-revoke, 24 account) | ✅ |
| **v0.9.1** PH-01 | Role-binding/Delegation write · menu role-visibility 3 tầng · position effective-date/acting | ✅ |
| **v0.10.0** PH-02 (6 nghiệp vụ) | Request ✅ · Directive ✅ · Ticket ✅ · Booking ✅ · Announcement ✅ · Records-attachment ✅ | ✅ **ĐÓNG** |
| **v0.11** PH-03 | Documents↔RecordDocument hợp nhất · /projects→MDM · dry-run 50 | ⬜ |
| **v0.12** PH-04 | Backup ops + UAT U1–U40 | ⬜ |
| **v1.0-RC** Pilot | Internal Pilot release candidate (T001) | ⬜ |
| **v2.x SaaS** (handoff SAAS_TENANT_001_010) | Sau PH-02: Solution Delivery WS · Platform Tenant Registry (tenantNo immutable) · Launch Factory · Blueprint/Seed Catalog · T002 BĐS demo · T003–010 batch · T011 readiness · Platform Console (tách quyền khỏi Tenant Admin) | ⬜ docs-first |

## Đã hoàn thành (chi tiết, mới nhất trên cùng)
- **PH-02 Ticket/Service Desk** ✅ — models ServiceCatalogItem/Ticket/TicketEvent, FSM NEW→…→RESOLVED→CLOSED + CSAT, catalog+queue+SLA, 15 ticket + 5 catalog seed, màn `/office/service-desk` + detail, nav + icon lifebuoy. **47 bảng RLS.** `test:tickets` PASS (đã fix bug assign person-id↔user-id).
- **PH-02 ĐÓNG (6/6 nghiệp vụ)** — thêm **Announcement** ✅: audience→receipt, đọc/xác nhận, report thống kê, nhắc lại (mock), 6 thông báo + 76 receipt, **53 bảng RLS**, `test:announcements` 38/38. XOffice Operational cho T001 hoàn tất.
- **PH-02 Booking** ✅ — BookableResource/Booking/BookingEvent, FSM REQUESTED→APPROVED→CHECKED_IN→CHECKED_OUT/NO_SHOW, **conflict 409** cùng tài nguyên, 4 resource + 12 booking, màn Đặt phòng & tài nguyên, **50 bảng RLS**, `test:bookings` PASS.
- **PH-02 Directive/Commitment** ✅ — FSM 2 tầng + SLA, 10 directive, màn Chỉ đạo & cam kết, `test:directives` PASS.
- **PH-02 Request/Approval** ✅ — FSM đầy đủ, 42 request, Trung tâm yêu cầu + Yêu cầu của tôi + detail (comment/attachment/execute+evidence), `test:requests` PASS.
- **PH-01** ✅ — Role-binding write (+impact preview) · Delegation write (guardrail) · menu role-visibility (nav↔registry, 3 tầng) · position effective-date + acting holder.
- **PH-00** ✅ — 24 account + org reconcile · invite/activate/forgot/reset/suspend + session revoke (argon2, no plaintext) · trang Tailux auth.
- **Nền role registry** ✅ — 16 role, wildcard `can()`, `filterNavByPermissions`, STAGING_STRICT.
- **UX (rải rác)** ✅ — menu ngang header + icon · code doc lên màu (github-dark) · mobile: StatCard nén/tab scroll/badge nowrap/hamburger drawer theo workspace · sơ đồ tổ chức cây kéo-thả + config node · rail gom 5 workspace.

## Lớp SaaS (handoff SAAS_TENANT_001_010) — sau PH-02, docs-first ĐÃ XONG (10 doc ở /docs/saas)
Thứ tự build đề xuất (mở khóa dần 12 non-negotiable — hiện 1/12 đạt, 6/12 chưa):
✅ **B1 Tenant Registry** · ✅ **B2 Platform Console + PLT_ namespace** · ✅ **B3 Launch Factory** (8-step idempotent/retry/resume) · ✅ **B4 Blueprint/Seed Pack** (11 BP + 14 SP, wire vào launch, dọn hardcode) · ✅ **B5 Solution Delivery** (Engagement FSM + GO_LIVE→launch #12, no dual-write, 55 RLS) · ✅ **B6a T002 BĐS provisioned** (tenantNo=2 ACTIVE, isolation 2 chiều, 2 user login, test:t002 21/21) · ✅ **B6b Backup định kỳ per-tenant** (schedule/retention/alert riêng, folder tách, failure isolate) · ✅ **T003-010 batch** (10 tenant ACTIVE, isolation, backup+blueprint mỗi tenant, T008 no-PHI) · ✅ **T011 readiness** (plan/entitlement/onboarding ≥11/readiness 43/43 + FE plans/readiness/wizard) → **✅ SaaS v1.0 hoàn tất (10 tenant live)**. 🔵 **Lifecycle DEMO/LIVE + reset-demo + go-live checklist (đang)**.

1. **Tenant Registry** — mở rộng `model Tenant` (thêm tenantNo/class/status/plan/blueprint), bảng platform shared (no-RLS như ApplicationDefinition), map `tenant-xtech`→T001 (giữ id, không vỡ 53 FK), allocator ≥11 in-lock. → mở #2/#3/#4/#5.
2. **Platform Console + platform permission namespace** — tách quyền khỏi Tenant Admin, role `PLATFORM::*` (fix trùng tên PLATFORM_ADMIN), platform menu, operator KHÔNG tự đọc data nghiệp vụ tenant. → mở #6/#7.
3. **Launch Factory** — tái dùng outbox control-plane (idempotent/retry/audit/resumable), `TenantLaunch` = chuỗi step (register→org→enable app→blueprint→seed pack→backup→isolation→handover). → #8.
4. **Blueprint/Seed Pack catalog** — versioned/immutable (khuôn version+checksum), tham số hóa seeder theo tenantId, gói data T001 thành `SP-XTECH-OPS`+`BP-TECH-001`, **dọn 5 chỗ hardcode xtech vào seed pack**. → #1/#9.
5. **Solution Delivery Workspace** (T001) — tái dùng module Request/Directive/Ticket/Booking/Announcement + Records; no dual-write. → #12.
6. **T002 BĐS demo** (phép thử SaaS đầu tiên) → **T003–010 batch** → **T011 readiness** → Platform Ops v1.0.

Gap cần lưu: XBuilding chưa có (T002 tạm proxy); allocator/Plan/Blueprint/SeedPack/TenantLaunch models chưa có (mới CSV+schema); AppAdapter mock.

## Đang làm
- ✅ PH-02 đóng hoàn toàn. Docs-first SaaS xong (10 doc). Kế tiếp: **build lớp SaaS** bắt đầu từ **Tenant Registry** (bước 1 ở trên).

## UI đã thêm (2026-07-30, đợt polish)
- Org chart: **chế độ full** canvas (che cả rail, z-70), **sơ đồ nhân sự** (avatar/tên/chức danh/phòng ban/email/sđt) + **In/Xuất PDF** (print-CSS). PersonProfile +avatarUrl/+phone (seed 24 phone/8 avatar SVG). Menu ngang header khi thu gọn + icon. Code doc lên màu. Mobile: StatCard nén/tab scroll/badge nowrap/hamburger drawer theo workspace.

## Known issues / nợ kỹ thuật
- 🟡 Seed sđt đôi khi prefix không chuẩn VN (vd `0053...`) — cosmetic, chỉnh format nếu cần.
- 🟡 Workflow-builder chưa có nút fullscreen (org chart đã có) — sẽ áp cùng pattern.
- 🟡 **Hardcode xtech (5 chỗ, seed/hiển thị)** — `identity.service.ts:75` (seed lịch sử vị trí xtech), `notification.service.ts:31` + `xoffice.service.ts:112/113/224` (suy slug/tên `xtech→XTech`). Không phá đa-tenant runtime; dọn khi làm **Tenant Registry + Seed Pack** (dữ liệu/tên tenant lấy từ registry/blueprint thay vì hardcode). Non-negotiable #1 của handoff SaaS.
- Agent nền đôi lúc gặp lỗi stream API giữa chừng → cần verify state thủ công (đã có quy trình cứu: prisma generate + db push + rebuild).
- **1 server/cổng**: nhiều bản dev server trùng gây trả data cũ (đã gặp ở Ticket — restart sạch là hết).
- 🔴 **Rotate `ANTHROPIC_API_KEY`** (việc của chủ đầu tư — đã lộ).
- Connector/AI còn mock · authz enforcement env-gated off ở demo · IdP Azure AD chỉ có seam.

## Cách kiểm thử (gate)
`npm run test:*` trong xhub-api: rls · smoke · controlplane · mdm · backup · records · webhook · condition · authz · roles · auth-flow · requests · directives · tickets(⚠) · scan:secrets. Xem bảng bot-test ở trang **Kiểm thử** (/docs/test).

## Tài liệu liên quan (trên giao diện /docs)
- **Phát triển** (/docs/developer) · **Hướng dẫn sử dụng** (/docs/user) · **Nghiệp vụ** (/docs/business) · **Backlog** (/docs/backlog) · **Kiểm thử** (/docs/test).
- Kế hoạch chi tiết: `xhub-web/docs/next-phases/*` (delta analysis, phase plan, thẩm định MVP…).
