# TÌNH HÌNH DỰ ÁN — XHub / X.Space / X.Office

> **File này để copy sang ChatGPT lên kế hoạch.** Tự‑chứa: đọc riêng file này là đủ hiểu, không cần xem code.
> **Cập nhật gần nhất:** 2026-07-30 · Chủ đầu tư: X‑TECH (tenant 001) · Trạng thái: MVP nền tảng hoàn tất, đang mở rộng tính năng + nối thật.
> Tài liệu sâu hơn (nội bộ): `HANDOFF_XHUB.md`, `PROJECT_STATUS_XHUB.md`, `xhub-web/docs/{DEVELOPER_GUIDE,USER_GUIDE,TEST_LOG}.md`, `xhub-api/SECURITY.md`.

---

## 1. Sản phẩm là gì
Nền tảng làm việc hợp nhất nội bộ cho doanh nghiệp X‑TECH, đa‑tenant (SaaS), gồm 3 khối:
- **XHub** — cổng điều hành + công việc/phê duyệt + dữ liệu doanh nghiệp.
- **X.Space** — trao đổi/cộng tác theo channel (kiểu Slack), gắn dự án & khách hàng.
- **X.Office** — thiết kế & vận hành quy trình (workflow engine) + AI Copilot (gợi ý bản nháp, người xác nhận).

Giao diện: rail **5 workspace cha** (Trang chủ · Công việc · X.Space · X.Office · Doanh nghiệp), mỗi workspace mở panel menu con. Tiếng Việt, sáng/tối, responsive (mobile bottom‑nav).

## 2. Kiến trúc & công nghệ
- **Frontend** `xhub-web`: Next.js 16 (App Router) + Tailwind v4, design system **Tailux** (mua). FE **không đụng DB** — mọi dữ liệu qua BFF. Dev `:3000`.
- **Backend** `xhub-api`: NestJS + Prisma 7 + PostgreSQL. Là ranh giới DB duy nhất. `:4000`.
- **Nguyên tắc bất biến:** tenant isolation (RLS Postgres); không tạo chứng từ ERP giả; không lưu secret/mật khẩu trong DB/backup; email không phải khoá; không dual‑write; version quy trình immutable; AI luôn draft‑first + người xác nhận.

## 3. ĐÃ LÀM (verify xanh)
**Nền tảng đa‑tenant 8/8 mục:** (1) Auth session/JWT + membership; (2) **RLS 35 bảng** (withTenant/withBypass, FORCE); (3) Identity/Org Core (PersonProfile/OrgUnit/Position/RoleBinding/DataScope + RBAC/ABAC); (4) Control Plane + Provisioning (outbox idempotent/conflict/retry/reconcile); (5) Shared MDM + ingestion (dedup, không auto‑merge); (6) Backup/restore per‑tenant (checksum + AES‑256‑GCM + sandbox/dry‑run + remap identity + MUST_NOT_LEAK); (7) **Tenant Admin UI 15 màn**; (8) Records/document + object storage · Webhook inbound + transactional outbox + reconcile · Condition AST · secret‑scan.

**Wire live + UX (các lượt gần đây):**
- FE Admin (15 màn) + Documents **wire dữ liệu thật** qua BFF (`/api/identity`, `/api/controlplane`, `/api/backup`, `/api/records`) — có chip "trực tiếp/demo", degrade an toàn.
- Write‑flow thật: tạo backup / restore / enable app / bind account / retry / reconcile / upload tài liệu + phiên bản.
- **Authz enforcement env‑gated** (`AUTH_ENFORCE`, mặc định off giữ demo) + OIDC seam (mock, chưa nối IdP thật).
- Nav gom **5 workspace**; thêm nhóm **Tài liệu & Kiểm thử** (trong app: `/docs` — Phát triển/Hướng dẫn/Kiểm thử) + trang **Danh sách dự án** `/projects`.
- **Trang kiểm thử tương tác** `/docs/test`: bảng bot‑test (12 cổng tự động PASS) + checklist người dùng U1–U17 tick được, **tự lưu về máy chủ** (`/api/testruns`).

**Cổng kiểm thử tự động (đều PASS):** api/web tsc 0 · `test:rls`(35 bảng) · `test:smoke`(13 workflow E2E) · `test:controlplane` · `test:mdm` · `test:backup` · `test:records` · `test:webhook` · `test:condition` · `test:authz`(allow/deny/401/OIDC) · `scan:secrets`.

## 4. ĐANG/CHƯA LÀM — kế hoạch tiếp (để lên plan)
| Ưu tiên | Hạng mục | Ghi chú / điều kiện |
|---|---|---|
| 🔴 Người làm | Rotate `ANTHROPIC_API_KEY` (đã lộ) | console.anthropic.com — không tự động được |
| P1 | Nối **IdP Azure AD** thật vào OIDC seam + bật enforce authz | cần issuer/clientId/secret |
| P1 | Nối **connector thật** (FinERP/Frappe HR/Mattermost) thay mock, qua outbox+webhook | cần endpoint + sandbox hệ thống ngoài |
| P2 | Thêm endpoint identity còn thiếu (invitations, role‑bindings ghi, delegations ghi) → 3 màn admin demo lên live | FE form đã dựng sẵn |
| P2 | Hợp nhất hoàn toàn `Document` (seed cũ) ↔ `RecordDocument` | màn /documents đã live |
| P2 | Dọn nợ UI: `ChannelShell` vs `ChannelHeader`; a11y; visual regression | rủi ro trung bình |
| P3 | Backup schedule/retention + luồng duyệt khôi phục production | |

## 5. Cần chủ đầu tư quyết / cấp
1. Rotate API key (ngay).
2. Cấp credential IdP Azure AD (để nối đăng nhập thật + bật bảo mật production).
3. Cấp endpoint/tài khoản sandbox các hệ thống ERP/chat để nối connector thật.
4. Xác nhận độ ưu tiên P1/P2 ở trên.

## 6. Cấu hình demo ↔ production
- Demo (hiện tại): `AUTH_ENFORCE=false`, `AUTH_ALLOW_HEADER_IDENTITY=true`, connector mock, AI có key thật (cần rotate).
- Production: `AUTH_ENFORCE=true`, `AUTH_ALLOW_HEADER_IDENTITY=false`, OIDC bật, connector thật, secret đặt qua env.

## 7. Gợi ý prompt cho ChatGPT
> "Đây là tình hình dự án nền tảng SaaS nội bộ XHub (Next.js + NestJS + Postgres, đa‑tenant RLS). Nền tảng đã xong, giờ cần lập kế hoạch [nối IdP Azure AD / nối connector ERP / roadmap giai đoạn 2…]. Dựa trên mục 3 (đã làm) và mục 4 (backlog), hãy đề xuất kế hoạch chi tiết, rủi ro, thứ tự."

---

## 8. Nhật ký cập nhật (mới nhất trên cùng)
- **2026-07-30:** **SaaS bước 1+2 xong** — Tenant Registry (10 tenant, T001=tenant-xtech, allocator ≥11) + Platform Console `/platform/*` + namespace quyền `PLT_` (fix trùng PLATFORM_ADMIN), tách quyền platform↔tenant chứng minh xong; regression đủ xanh. + Org chart: fullscreen (che rail) · sơ đồ nhân sự (avatar/email/sđt) · in/xuất PDF. **🔴 Chuyển máy: đọc `MACHINE_HANDOFF_RUNBOOK.md` (dựng lại DB + seed + server — DB/​server là local, không sync).** Không agent nào đang chạy = mốc bàn giao sạch.
- **2026-07-30:** **PH-02 ĐÓNG (6/6 nghiệp vụ)** — Request·Directive·Ticket·Booking·Announcement + Records-attachment, **53 bảng RLS**, mọi `test:*` xanh. Handoff mới **SAAS_TENANT_001_010** (reframe XHub→SaaS đa-tenant T001-010): finish PH-02 trước (xong), rồi lớp SaaS (Tenant Registry + Launch Factory + Blueprint + Platform Console). Đang sinh 10 doc SaaS (docs/saas/). Lưu ý: trùng tên PLATFORM_ADMIN (tenant vs platform) cần tách namespace; hardcode xtech rộng hơn 5 chỗ.
- **2026-07-30:** **PH-02a xong** — Request/Approval core: models Request/Comment/Event + FSM (DRAFT→…→APPROVED/EXECUTING→DONE), 42 request seed, Trung tâm yêu cầu + Yêu cầu của tôi + detail (comment/attachment/execute+evidence, no fake ERP), **41 bảng RLS**, `test:requests` PASS. Đang PH-02b (Directive/Commitment). Drawer mobile: menu theo từng workspace.
- **2026-07-30:** **PH-01 ĐÓNG** — role-binding + delegation write (guardrail + impact preview) · menu role-visibility 3 tầng (nav↔registry, default-safe) · position effective-date + acting holder (`PositionAssignment`, snapshot bất biến) → **38 bảng RLS**, 12 gate PASS. Sang **PH-02** (6 module, dài nhất): bắt đầu Request/Approval core.
- **2026-07-30:** **PH-00 ĐÓNG** — auth flows nội bộ (invite/activate/forgot/reset/suspend + session revoke, argon2, không plaintext), models UserCredential/AuthToken → **37 bảng RLS**, `test:auth-flow` 29/29 + trang Tailux + panel mời ở /admin/users. Sang **PH-01**: launch role-binding write + delegation write (NX-011/012; Invitation NX-010 đã xong ở PH-00b). Menu role-visibility NX-016 (căn nav permission ↔ role registry) làm trong PH-01.
- **2026-07-30:** Mobile responsive: StatCard nén (value 18px), tab lọc scroll ngang (hết wrap), badge whitespace-nowrap, **menu hamburger header → drawer đầy đủ 5 workspace**. PH-00a xong (23 account + org reconcile, 11 gate PASS); PH-00b (auth flows invite/reset/revoke + trang Tailux) đang chạy.
- **2026-07-30:** Handoff NEXT_PHASES: **nền role registry** (16 role + wildcard `can()` + `filterNavByPermissions` menu-level + STAGING_STRICT) PASS, giữ 10 gate xanh. Code doc `/docs/*` lên màu (rehype-highlight github-dark). Menu ngang header có icon. Phân quyền 3 tầng (module/menu/tính năng) ghi §D2 doc thẩm định.
- **2026-07-30:** UX nav: thu gọn menu dọc → **menu workspace chuyển lên ngang header** (lá=link, nhóm=dropdown). Fix **panel rỗng** trên /docs·/documents·/reports·/apps·/admin·/notifications (RailContextNavigation dùng findActivePrimary). Bắt đầu handoff `NEXT_PHASES` (docs‑first: 9 doc kế hoạch ở `xhub-web/docs/next-phases/`).
- **2026-07-30:** Sơ đồ tổ chức: **bấm node → panel Cấu hình** + **chuột phải → context menu** với 6 hành động lưu thật (Xem chi tiết · Đổi tên/loại · Đổi trưởng đơn vị · Thêm đơn vị con · Di chuyển · Xoá có guard). Thêm endpoint identity `PATCH`(name/type/headId/parentId) · `POST`(tạo con, code unique 409) · `DELETE`(chặn nếu còn con/vị trí). Fix encoding tên đơn vị HR.
- **2026-07-30:** Sơ đồ tổ chức `/admin/organization` thành **cây thừa kế** (React Flow + ELK) + **chế độ thiết lập kéo‑thả re‑parent** lưu thật (endpoint `PATCH /api/identity/org-units/:id` có chống vòng lặp, RLS). Fix menu con multi‑open (mở nhóm này không ẩn nhóm khác) + icon toggle (‹ Thu gọn / Mở menu ›). Dọn treegrid cũ.
- **2026-07-30:** + trang /projects (listing) vào menu Công việc; + auto‑lưu user‑test về máy chủ (`/api/testruns`, badge "Đã lưu máy chủ"), checklist mở rộng U17; docs/test tương tác. Rà nav: mọi trang tĩnh đều có trong menu/submenu.
- **2026-07-30:** Bộ tài liệu lên giao diện in‑app `/docs` (Phát triển/Hướng dẫn/Kiểm thử, render markdown + TOC), đăng ký nav nhóm "Tài liệu & Kiểm thử".
- **2026-07-30:** Enforce authz env‑gated + OIDC seam; dọn item nav "Thiết lập" thừa.
- **2026-07-30:** Wire FE Admin + Documents sang API thật (BFF, degrade demo); form kit Tailux; fix cột dung lượng/checksum.
- **2026-07-29→30:** Hoàn tất nền tảng 8/8 (RLS 35 bảng, backup/restore, Admin UI 15 màn, records/webhook/AST/secret‑scan); gom rail 5 workspace.
