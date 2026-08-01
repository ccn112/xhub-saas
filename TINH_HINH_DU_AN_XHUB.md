# TÌNH HÌNH DỰ ÁN — XHub / X.Space / X.Office

> **File này để copy sang ChatGPT lên kế hoạch.** Tự‑chứa: đọc riêng file này là đủ hiểu, không cần xem code.
> **Cập nhật gần nhất:** 2026-08-01 · Chủ đầu tư: X‑TECH (tenant 001) · Trạng thái: SaaS v1.0 (10 tenant, KPI/OKR theo ngành) + Work/PM v2 + **Management OS MG‑01→03** + **IOC Digital Twin DT‑01→03** — nền tảng vững, đang mở rộng theo roadmap.
> Tài liệu sâu hơn (nội bộ, xem mục 9 "Tài liệu liên quan" bên dưới để có danh sách đầy đủ).

---

## 1. Sản phẩm là gì
Nền tảng làm việc hợp nhất nội bộ cho doanh nghiệp X‑TECH, đa‑tenant (SaaS), gồm 4 khối:
- **XHub** — cổng điều hành + công việc/phê duyệt + dữ liệu doanh nghiệp.
- **X.Space** — trao đổi/cộng tác theo channel (kiểu Slack), gắn dự án & khách hàng.
- **X.Office** — thiết kế & vận hành quy trình (workflow engine) + AI Copilot (gợi ý bản nháp, người xác nhận) + **Management OS** (quản trị chiến lược/KPI/OKR/quyết định) + **IOC Digital Twin** (bản sao số văn phòng/phòng ban).
- **Platform Console** — vận hành nền tảng SaaS đa‑tenant (onboard/launch/blueprint/backup khách hàng).

Giao diện: rail **6 workspace cha** (Trang chủ · Công việc · Quản trị · X.Space · X.Office · Doanh nghiệp) + workspace **IOC — Bản sao số** (gated) + Platform Console (chỉ platform‑operator). Tiếng Việt, sáng/tối, responsive (mobile bottom‑nav).

**Nguyên tắc viết tài liệu (áp dụng từ 2026-08-01):** mọi tài liệu vận hành/hướng dẫn phải nêu **logic/nguyên tắc quản trị** (chuẩn quốc tế: BSC/OKR/RAPID/COSO/ISO/PMI/APQC/CPM) TRƯỚC khi hướng dẫn thao tác — để lãnh đạo hiểu "vì sao thiết kế vậy", không chỉ "bấm nút gì". Xem `xhub-web/docs/USER_GUIDE.md` mục 2 làm mẫu.

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

**SaaS v1.0 (đa‑tenant thương mại):** Tenant Registry 10 tenant (T001=X‑TECH; T002‑010 demo ngành, đã provision) + Platform Console `/platform/*` (namespace quyền `PLT_`) + Launch Factory + Blueprint/SeedPack (immutable, no‑secret) + vòng đời **DEMO/LIVE** (go‑live checklist + reset‑demo) + backup/folder riêng từng tenant.

**Work / Project Management v2 (X.Office Execute):** 3 tầng task tách bạch (WorkflowTask/NativeWorkItem/UnifiedWorkItem) + 2 khái niệm project (CanonicalProject/ExecutionProject) + WBS roll‑up, phụ thuộc FS/SS/FF/SF (chống chu trình), baseline immutable, tag/đa chiều. **5 view:** Gantt (kéo/resize lưu server, **Gantt phối hợp phân quyền: người chia sẻ SUMMARY chỉ thấy việc cha tiêu đề+% , không thấy việc con/mô tả**), Kanban swimlane theo tag, Lịch, Portfolio cockpit, **Thống kê đa chiều** (pivot tag×dimension×metric).

**Management Operating System — MG‑01+02+03 (T001):** vòng quản trị chạy thật: **Mục tiêu chiến lược → KPI (tính từ Work thật) → Business Review tháng → Quyết định RAPID → Action → NativeWorkItem → Follow‑up**. Workspace **"Quản trị"** `/manage/*`: Home/Mục tiêu/Chỉ số/Review/Quyết định + **Scorecard** (4 góc nhìn BSC, KPI đỏ không bị điểm gộp che) + **OKR** (chu kỳ/objective/key‑result/check‑in giữ lịch sử, tách biệt KPI vận hành≠OKR≠task list). KPI `ACT-CLOSE` tính từ NativeWorkItem (đúng hạn %) — **nguồn thật, không nhập tay** (smoke chứng minh 100%→50% khi thêm việc quá hạn). Docs‑first: 8 doc MG‑00 + 3 design spec MG‑03/04/07 (`xhub-web/docs/management-os/`).

**KPI/OKR theo NGÀNH cho 9 tenant demo** (không còn dùng chung 1 bộ của T001): mỗi tenant (T002 BĐS, T003 Sản xuất, T004 Phân phối/Bán lẻ, T005 Xây dựng, T006 Khách sạn, T007 Giáo dục, T008 Y tế, T009 Logistics, T010 Dịch vụ chuyên nghiệp) có 4 Mục tiêu (cân bằng 4 góc nhìn) + 7‑8 KPI + 1 chu kỳ OKR **đúng đặc thù ngành** (vd Sản xuất: OEE/tỷ lệ lỗi/MTBF; Bán lẻ: vòng quay tồn kho/CAC) — chỉ chung đúng 1 chỉ số `ACT-CLOSE` (nguồn thật từ Work), còn lại ghi rõ `MANUAL` (chưa có connector ERP ngành — trung thực, không giả).

**IOC Digital Twin — DT‑01→03:** workspace **"IOC — Bản sao số"** `/ioc/*`: trình vẽ mặt bằng 2D (React‑Konva, mét, undo/redo, autosave) → gán vùng vào **OrgUnit thật**; runtime 3D (Babylon.js) **luôn kèm 2D dựng server** (tắt WebGL vẫn dùng đủ); lớp dữ liệu **có kiểm soát** (FE không gửi filter SQL/Prisma thô); dashboard builder. IOC chỉ **chiếu lại** dữ liệu Work/Identity thật, không phải sổ cái mới (chứng minh: thêm việc → tải phòng ban tăng theo). Riêng tư: mặc định gộp phòng ban, xem cá nhân cần quyền `ioc.people.detail`+audit; **cấm cứng (403) chấm điểm cá nhân qua camera/chấm công** ở tầng mã. Hoãn: DT‑04 (thiếu nguồn định biên/năng lực nhân sự thật), DT‑05 (pipeline quy trình), DT‑06 (twin nhân sự — rào đã có ở server), DT‑07 (realtime/AI). **DT‑08 (camera/IoT/sinh trắc thật) CHƯA làm — cần duyệt pháp lý/an ninh riêng, ngoài phạm vi hiện tại.**

**Tổng bảng RLS hiện tại: 89** (tăng dần theo mỗi phase: 35→53→57→73→78→89).

## 4. ĐANG/CHƯA LÀM — kế hoạch tiếp (để lên plan)
| Ưu tiên | Hạng mục | Ghi chú / điều kiện |
|---|---|---|
| 🔴 Người làm | Rotate `ANTHROPIC_API_KEY` (đã lộ, phát hiện lại lần 2) | console.anthropic.com — không tự động được |
| P1 | **MG‑04 Portfolio & Benefit** — Initiative link ExecutionProject (1 SoR 2 lăng kính) | spec sẵn `docs/management-os/design/MG-04_*.md` |
| P1 | **MG‑05 Cockpit điều hành** (dashboard tổng hợp đa chỉ số) | phụ thuộc MG‑03/04 xong |
| P1 | **MG‑07 AI Copilot cho Management OS** (gợi ý mỗi action, draft‑first) | spec sẵn; mở rộng `xoffice.service.ts` có sẵn; cần chốt namespace API `/manage` vs `/xoffice` |
| P1 | Nối **IdP Azure AD** thật vào OIDC seam + bật enforce authz | cần issuer/clientId/secret |
| P1 | Nối **connector thật** (FinERP/Frappe HR/Mattermost) thay mock, qua outbox+webhook | cần endpoint + sandbox hệ thống ngoài — cũng là điều kiện để mở khoá phần lớn KPI ngành (hiện đa số ghi MANUAL) |
| P2 | **IOC DT‑04 Twin năng lực phòng ban** | cần dựng nguồn dữ liệu định biên/capacity thật trước (chưa có SoR) |
| P2 | **IOC DT‑05/06** (pipeline quy trình, nhân sự/vị trí) | |
| P2 | Thêm endpoint identity còn thiếu (invitations, role‑bindings ghi, delegations ghi) → 3 màn admin demo lên live | FE form đã dựng sẵn |
| P2 | Hợp nhất hoàn toàn `Document` (seed cũ) ↔ `RecordDocument` | màn /documents đã live |
| P2 | Dọn nợ UI: `ChannelShell` vs `ChannelHeader`; a11y; visual regression | rủi ro trung bình |
| P2 | Highlight **Critical Path** trực quan trên Gantt (nguyên tắc CPM đã có trong tài liệu, UI chưa vẽ) | |
| P3 | Backup schedule/retention + luồng duyệt khôi phục production | |
| GATE | **IOC DT‑08** (camera/IoT/sinh trắc học thật) | KHÔNG làm nếu chưa có duyệt pháp lý/an ninh riêng — không tự quyết |

## 5. Cần chủ đầu tư quyết / cấp
1. Rotate API key (ngay — đã phát hiện 2 lần).
2. Cấp credential IdP Azure AD (để nối đăng nhập thật + bật bảo mật production).
3. Cấp endpoint/tài khoản sandbox các hệ thống ERP/chat (FinERP/HR/CRM theo từng ngành) để nối connector thật — mở khoá phần lớn KPI ngành hiện đang MANUAL.
4. Duyệt roadmap MG‑04→08 (Portfolio/Cockpit/AI Copilot/Process‑Risk/Ecosystem) theo thứ tự đề xuất, hoặc chỉnh ưu tiên.
5. Duyệt/từ chối chủ trương IOC DT‑08 (IoT vật lý thật) — cần ý kiến pháp lý/an ninh riêng trước khi cân nhắc.

## 6. Cấu hình demo ↔ production
- Demo (hiện tại): `AUTH_ENFORCE=false`, `AUTH_ALLOW_HEADER_IDENTITY=true`, connector mock, AI có key thật (cần rotate).
- Production: `AUTH_ENFORCE=true`, `AUTH_ALLOW_HEADER_IDENTITY=false`, OIDC bật, connector thật, secret đặt qua env.

## 7. Gợi ý prompt cho ChatGPT
> "Đây là tình hình dự án nền tảng SaaS nội bộ XHub (Next.js + NestJS + Postgres, đa‑tenant RLS + Management OS + IOC Digital Twin). Nền tảng đã xong, giờ cần lập kế hoạch [nối IdP Azure AD / nối connector ERP theo ngành / MG‑04→08 Management OS / IOC DT‑04→07 / app mobile riêng cho XHub…]. Dựa trên mục 3 (đã làm) và mục 4 (backlog), hãy đề xuất kế hoạch chi tiết, rủi ro, thứ tự, và các câu hỏi cần chủ đầu tư trả lời trước khi làm."

## 8. Tài liệu liên quan (đọc thêm nếu cần chi tiết — không bắt buộc để hiểu tổng quan)

**Vận hành/bàn giao máy:**
- `MACHINE_HANDOFF_RUNBOOK.md` (gốc `xhub-saas/`) — dựng lại DB/seed/server khi đổi máy, đầy đủ thứ tự lệnh + toàn bộ `test:*` regression hiện có (~35 cổng).

**Tài liệu trong app** (`xhub-web/docs/`, xem trực tiếp qua `/docs` trên web):
- `USER_GUIDE.md` — hướng dẫn dùng, có **"Nguyên tắc quản trị nền tảng"** (mục 2) + nguyên tắc riêng mỗi tính năng (BSC/OKR/RAPID/CPM/quản trị theo ngoại lệ...) trước phần thao tác.
- `DEVELOPER_GUIDE.md` — kiến trúc kỹ thuật, catalog Tailux↔xhub/ui.
- `TEST_LOG.md` — nhật ký kết quả UAT thủ công theo U#.
- `UAT_HANDOFF_GUIDE.md` — bộ giao nhân viên test độc lập (tài khoản demo + checklist U1‑U89 in được).

**Management OS (`xhub-web/docs/management-os/`):** 8 doc MG‑00 rebase‑audit (CURRENT_STATE_DELTA, DOMAIN_COLLISION_MAP, SOR_MATRIX_DELTA, ROADMAP_REBASE, UI_ROUTE_PLAN, DATA_READINESS_REPORT, DOCUMENTATION_PLAN, TRAINING_PLAN) + `design/` 3 spec kỹ thuật MG‑03/04/07 sẵn sàng để build tiếp.

**Work/PM v2 (`xhub-web/docs/work-pm/`):** 7 doc kế hoạch (CURRENT_STATE_DELTA, ENTITY_COLLISION_PLAN, SCHEMA_PLAN, ROUTE_MIGRATION_PLAN, UI_PLAN, INTEGRATION_PLAN, TEST_PLAN).

**IOC Digital Twin (`xhub-web/docs/ioc-digital-twin/`):** `IOC_CURRENT_STATE_DELTA.md`, `ADR_IOC_DIGITAL_TWIN.md` (8 quyết định kiến trúc), `IOC_RELEASE_NOTE_DT01_DT03.md`.

**Bảo mật:** `xhub-api/SECURITY.md` — quy trình rotate secret, authz production.

**Handoff gốc (thiết kế ban đầu, tham khảo khi cần đối chiếu ý định thiết kế — đã có phần LẠC HẬU so với code, ưu tiên đọc code/docs trên trước):**
- `D:\Code\handoff\Xhub\XHUB_XOFFICE_MANAGEMENT_OPERATING_SYSTEM_HANDOFF_20260801\` — thiết kế gốc Management OS.
- `D:\Code\handoff\Xhub\XHUB_XOFFICE_WORK_PROJECT_HANDOFF_V2_20260731\` — thiết kế gốc Work/PM v2.
- `D:\Code\handoff\Xhub\XHUB_ENTERPRISE_IOC_DIGITAL_TWIN_BUILDER_HANDOFF_20260801\` — thiết kế gốc IOC Digital Twin.

---

## 9. Nhật ký cập nhật (mới nhất trên cùng)
- **2026-08-01:** **MG‑03 (Scorecard/OKR) + KPI/OKR theo ngành (9 tenant) xong**, verify xanh 0 regression. Scorecard 4 góc nhìn (không che KPI đỏ) + OKR chu kỳ/check‑in giữ lịch sử. 9 tenant demo (BĐS/Sản xuất/Phân phối/Xây dựng/Khách sạn/Giáo dục/Y tế/Logistics/Dịch vụ) có Mục tiêu+KPI+OKR đúng đặc thù ngành thay vì copy bộ của T001 — chỉ chung 1 KPI thật `ACT-CLOSE`. Đồng thời: cập nhật `USER_GUIDE.md` theo nguyên tắc **"logic quản trị trước thao tác"** (BSC/OKR/RAPID + bổ sung **Critical Path Method** cho phần Gantt — ghi rõ UI chưa highlight trực quan đường găng, chỉ mới có nguyên tắc/dữ liệu nền `WorkDependency`) + `UAT_HANDOFF_GUIDE.md`. Checklist `/docs/test` cập nhật đủ U1‑U89 cho toàn bộ tính năng mới (Work v2/Management OS/KPI ngành/IOC).
- **2026-08-01:** **IOC Digital Twin — DT-01→DT-03 XONG (chạy thật, verify xanh).** Workspace mới **IOC — Bản sao số** `/ioc/*` (9 route, gate `ioc.*`): trình vẽ mặt bằng React‑Konva (toạ độ MÉT, undo/redo, autosave optimistic `revision`, gán vùng → OrgUnit thật `ou-*`), runtime 3D Babylon.js **luôn kèm 2D SVG dựng ở server** (tắt WebGL vẫn dùng đủ), lớp dữ liệu **có kiểm soát** (catalog biên dịch trong máy chủ — FE không gửi SQL/Prisma filter) và trình dựng bảng điều khiển. **11 model mới → 89 bảng RLS** (78→89). IOC là lớp **chiếu**, không tạo sổ cái mới: số liệu lấy từ NativeWorkItem/ExecutionProject/Position/MetricObservation (chứng minh: thêm 1 việc → tải phòng ban tăng). Phiên bản xuất bản **bất biến + checksum SHA‑256**, rollback không xoá. Quyền riêng tư: mặc định **tổng hợp phòng ban**, xem cá nhân cần `ioc.people.detail` + ghi audit; **cấm cứng camera/chấm công/sinh trắc học ở tầng mã (403)**. Seed `seed:ioc` (X‑TECH HQ Tầng 5, 8 vùng, 3 lớp dữ liệu, dashboard `DASH-OFFICE` v1). Test mới `test:ioc-twin` + `test:ioc-data-layer` PASS (AT‑001..006, 009, 010, 012); regression cũ đủ xanh. **Hoãn:** DT‑04 (năng lực phòng ban — thiếu SoR định biên), DT‑05 (luồng quy trình), DT‑06 (nhân sự/vị trí), DT‑07 (SSE + dự báo + AI). **DT‑08 (camera/IoT/sinh trắc) NGOÀI phạm vi, phải có phê duyệt pháp lý/an ninh riêng.**
- **2026-08-01:** **Management OS — reference slice XONG (chạy thật, verify xanh).** Vòng quản trị Mục tiêu→KPI→Review→Quyết định(RAPID)→Action→NativeWorkItem→Follow‑up cho T001; workspace mới **Quản trị** `/manage/*`; 6 model → **73 bảng RLS**; KPI `ACT-CLOSE` tính từ Work thật (proof 100%→50%); `test:manage-slice` PASS + regression đủ xanh (10 tenant nguyên, không lộ secret). Trước đó cùng ngày: **Work v2 W1/W2/W3** (Execution Project + 5 view: Gantt phối hợp phân quyền, Kanban swimlane, Lịch, Portfolio, Thống kê đa chiều). **Docs‑first MOS:** 8 doc MG‑00 (`docs/management-os/`) + 3 design spec MG‑03/04/07 (`docs/management-os/design/`). Repo đã dời `D:\Code\xhub-saas\` + push GitHub (private). Kế tiếp (chờ chủ đầu tư duyệt roadmap MG): MG‑03 KPI/OKR/Scorecard → MG‑04 Portfolio/Benefit (link ExecutionProject) → MG‑05 Cockpit → MG‑07 AI Copilot. **Cần chốt:** namespace API MOS `/manage` vs `/xoffice` (nơi AI service đang sống).
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
