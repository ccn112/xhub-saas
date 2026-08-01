# MACHINE HANDOFF — Runbook dựng lại trên máy mới

> **Đọc file này đầu tiên khi mở dự án trên máy khác.**
> **XHub là 1 git MONOREPO** tự chứa tại `D:\Code\xhub-saas\` (branch `main`, track `xhub-api`+`xhub-web`+docs; `.gitignore` allowlist bỏ node_modules/.env/dist/.next/storage + dự án khác). Remote: `https://github.com/ccn112/xhub-saas` (private). Máy mới: `git clone https://github.com/ccn112/xhub-saas.git` → code về. **DB Postgres + server + `.env` là LOCAL — không theo git**, phải tạo lại `.env` + dựng DB + seed + chạy server (các mục dưới).
> Cập nhật: 2026-08-01. Mốc bàn giao: **SaaS v1.0 (10 tenant) + Work/PM v2 + Management OS MG-01→03 + KPI/OKR theo ngành + IOC Digital Twin DT-01→03 + Template Gallery — tất cả verified xanh.** People Essentials: PE-00 rebase-audit xong (docs-only, chưa build code) ở `xhub-web/docs/people-essentials/`.

## 0. Trạng thái tại mốc bàn giao
- Nền tảng 8/8 · PH-00/01/02 đóng · SaaS bước 1+2 (Tenant Registry + Platform Console) · Work/PM v2 (5 view) · Management OS MG-01→03 (reference slice + Scorecard/OKR + KPI ngành) · IOC Digital Twin DT-01→03 + Template Gallery.
- **RLS 89 bảng** (đọc động, xem lệnh ở mục 6); ~40+ `test:*` PASS.
- Repo: `D:\Code\xhub-saas\xhub-api` (NestJS :4000) · `D:\Code\xhub-saas\xhub-web` (Next 16 :3000) — **đường dẫn đã đổi, không còn `D:\Code\xhub-web` root**.
- 🔴 **`ANTHROPIC_API_KEY` VẪN CHƯA rotate** (đã lộ, xác nhận lại fingerprint khớp) — làm ngay tại console.anthropic.com trước khi dùng máy mới cho production.

## 1. Prerequisites máy mới
- Node (v24 như máy cũ), PostgreSQL (bản 18), Git Bash/PowerShell.
- Postgres: tạo DB `xhub` + user `xhub` (password khớp `.env`).
- `xhub-api/.env` (KHÔNG sync — tạo lại): `DATABASE_URL="postgresql://xhub:<pass percent-encode>@localhost:5432/xhub?schema=public"` · `ANTHROPIC_API_KEY=...` (🔴 **rotate key mới** — key cũ đã lộ) · `XOFFICE_AI_MODEL=claude-haiku-4-5` · `XOFFICE_AI_LIVE=true` · `AUTH_JWT_SECRET=<đặt chuỗi>` · `BACKUP_ENCRYPTION_KEY=<base64 32B>` · `WEBHOOK_SIGNING_SECRET=<chuỗi>` · `DEFAULT_TENANT_ID=tenant-xtech` · `DEFAULT_USER_ID=user-nam`. (Xem `.env.example` để đủ biến.)
- `xhub-web/.env.local`: `XHUB_API_URL=http://localhost:4000` · `NEXT_PUBLIC_XHUB_API_URL=http://localhost:4000`.

## 2. Cài đặt
```bash
cd D:/Code/xhub-saas/xhub-api && npm ci
cd D:/Code/xhub-saas/xhub-web && npm ci
```

## 3. Dựng schema + RLS (trong xhub-api)
```bash
npx prisma db push --schema=prisma/schema.prisma   # KHÔNG dùng --accept-data-loss
npx prisma generate
node scripts/rls-setup.mjs                          # áp RLS policy (FORCE) cho mọi bảng tenant
```

## 4. Seed dữ liệu — THỨ TỰ QUAN TRỌNG
Khởi động api 1 lần để seed nền (IdentityService seed org/position/people khi boot), rồi chạy các seeder:
```bash
npm run build && node dist/src/main.js   # để boot seed nền, rồi Ctrl+C (hoặc để chạy luôn)
```
Sau khi api đã boot ít nhất 1 lần, chạy (api đang chạy):
```bash
npm run seed:roles            # 16 role registry (wildcard)
npm run seed:accounts         # 23 tài khoản + org units + role binding
npm run seed:person-avatars   # avatar + sđt
npm run seed:tenant-registry  # 10 tenant (T001=tenant-xtech ... T010)
npm run seed:platform-roles   # 10 role PLT_ (platform)
npm run seed:blueprint-catalog # 11 blueprint + 14 seed pack (versioned-immutable); áp SP-XTECH-OPS cho T001
npm run seed:records          # tài liệu
npm run seed:requests         # 42 request
npm run seed:directives       # 10 chỉ đạo
npm run seed:tickets          # catalog + 15 ticket
npm run seed:bookings         # 4 resource + 12 booking
npm run seed:announcements    # 6 thông báo + receipts
npm run seed:backup-schedules # lịch backup định kỳ + retention cho tenant ACTIVE (T001,T002); DAILY 02:00 VN / 35d-12w-12m
```
> Mọi seeder idempotent (skip-by-id/code) — chạy lại an toàn.

## 5. Chạy server
```bash
# API — CHỈ 1 instance trên :4000 (KHÔNG dùng start:prod — trỏ sai dist/main)
cd D:/Code/xhub-saas/xhub-api && node dist/src/main.js
# Provision T002 (BĐS demo) — SAU KHI server :4000 chạy + đã seed ở §4.
# Idempotent: reuse launch, không tạo trùng; T002 -> ACTIVE (tenantNo=2, VERTICAL_DEMO).
cd D:/Code/xhub-saas/xhub-api && npm run provision:t002
# Provision T003–T010 (8 vertical demo tenants) — 1 batch idempotent, SAU provision:t002.
# Reuse cùng Launch Factory + catalog + registry; skip tenant đã ACTIVE (không trùng);
# tự tạo backup schedule cho từng tenant mới. Resumable: chạy lại để hoàn tất phần còn lại.
cd D:/Code/xhub-saas/xhub-api && npm run provision:demos
# (tuỳ chọn) 1 tenant lẻ: npm run provision:tenant <tenantNo|key>  (vd: 8 | healthcare-demo)
# Web
cd D:/Code/xhub-saas/xhub-web && npm run dev            # :3000
```
> `provision:t002` chạy Launch Factory (BP-RE-002 + SP-RE-DEMO) tạo tenant T002 thật:
> org/users/apps(x1,x2)/dữ liệu demo + backup riêng + cô lập T001↔T002. In ra 2 user
> login-able (admin + employee, mật khẩu ENV `T002_ADMIN_PASSWORD`/`T002_EMP_PASSWORD`
> hoặc random mỗi lần — KHÔNG lưu repo). Đăng nhập với `x-tenant-id: tenant-realestate-demo`.
> `provision:demos` chạy CÙNG engine đã tổng quát hoá (`provision-tenant.mjs`, tham số từ
> `scripts/demo-tenants.params.mjs` — KHÔNG code branch/tenant) cho T003–T010: mỗi tenant
> 1 TenantLaunch (blueprint+seedpack theo catalog) → ACTIVE + backup schedule + 2 user
> login-able (`T00N_ADMIN_PASSWORD`/`T00N_EMP_PASSWORD` hoặc random). T008 y tế: CHỈ hành
> chính, KHÔNG bệnh án/PHI. Dữ liệu demo tổng hợp (`@demo.local`, `synthetic=true`).

## 6. Verify (nên chạy hết để chắc)
```bash
cd D:/Code/xhub-saas/xhub-api && npx tsc --noEmit       # 0 lỗi
# chạy lần lượt, tất cả PASS:
npm run test:rls && npm run test:smoke && npm run test:controlplane && npm run test:mdm && \
npm run test:backup && npm run test:records && npm run test:webhook && npm run test:condition && \
npm run test:authz && npm run test:roles && npm run test:auth-flow && npm run test:requests && \
npm run test:directives && npm run test:tickets && npm run test:bookings && npm run test:announcements && \
npm run test:tenant-registry && npm run test:platform-console && \
npm run test:launch-factory && npm run test:catalog && npm run test:delivery && \
npm run test:t002 && npm run test:backup-schedule && npm run test:demos && \
npm run test:readiness && npm run test:lifecycle && npm run test:work-item && npm run test:work-project && npm run test:work-views && \
npm run test:manage-slice && npm run scan:secrets
cd D:/Code/xhub-saas/xhub-web && npx tsc --noEmit        # 0 lỗi src/**
```

### X.Office Work & Project Management v2 — W1 (Native Work Core) — seed/smoke
```bash
cd D:/Code/xhub-saas/xhub-api
npm run rls:setup                # 60 bảng RLS (thêm NativeWorkItem + WorkItemComment/ChecklistItem/Event + WorkDimension) + GIN index tags/dimensions
npm run seed:work-items          # WorkDimension catalog + ~15 NativeWorkItem (tenant-xtech), idempotent upsert-by-id
npm run test:work-item           # smoke self-cleaning (prefix WI-SMOKE-): create→assign(resolver snapshot)→status/progress→comment/checklist/attachment→filter tag+dimension→visibility SUMMARY vs FULL→isolation→403
```
> API: `/api/work/items` (module `src/work`) — CRUD + `/:id/{status,assign,progress,comment,checklist,checklist/:itemId/toggle,attachments}`; đọc FULL vs SUMMARY theo actor (owner req #1: owner/assignee/creator/`work.view.full` = FULL, còn lại SUMMARY — KHÔNG lộ description/comments/attachments/children).

### X.Office Work & Project Management v2 — W2 (Execution Project Core) — seed/smoke
```bash
cd D:/Code/xhub-saas/xhub-api
npm run rls:setup                # 67 bảng RLS (+ExecutionProject/Event, WorkDependency, ProjectBaseline, BaselineItem, ProjectRoleAssignment, CoordinationShare)
npm run seed:work-items          # (chạy trước) — W1 items mà W2 gắn vào WBS
npm run seed:work-projects       # 3 ExecutionProject (tenant-xtech) + WBS + deps(FS/SS/FF) + baseline v1 + roles + 1 CoordinationShare, idempotent
npm run test:work-project        # smoke self-cleaning (prefix WP-SMOKE-/WI-WPSMOKE-): create→attach WBS→roll-up(4 method)→dep FS/SS/FF/SF→cycle 409→self 400→baseline immutable→rebaseline→health→role(resolver snapshot)→CoordinationShare SUMMARY vs NONE→isolation→403
```
> API: `/api/work/projects` (module `src/work/projects`) — CRUD + `/:id/{items(WBS),recompute,gantt?view=coordination,dependencies,baseline,rebaseline,baselines,roles,shares}` + `DELETE dependencies/:id`. Tiến độ roll-up theo `progressMethod` (MANUAL/TASK_WEIGHTED/MILESTONE_WEIGHTED/DELIVERABLE_WEIGHTED); health tất định theo lệch lịch vs baseline (không AI). WorkDependency có cycle-guard (409) + no self-dep. ProjectBaseline bất biến (rebaseline = version mới). CoordinationShare = seam cho việc xem TÓM TẮT cross-team (chỉ title/progress/dates của việc cha, ẩn con/mô tả/tài liệu). `Engagement.executionProjectId?` nối Solution Delivery dùng chung engine PM. FE: `/work/projects` + `/work/projects/[id]` (Overview/WBS tree roll-up/dependency list/roles/baseline); nav "Dự án thực thi" trong workspace `work` (Gantt/Kanban/Calendar/Portfolio = W3).

### X.Office Work & Project Management v2 — W3 (Management Views) — smoke
```bash
cd D:/Code/xhub-saas/xhub-api
npm run seed:work-items          # (chạy trước) — dimension catalog + items cho stats/portfolio demo
npm run test:work-views          # smoke self-cleaning (tag WV-SMOKE-TAG / prefix WV-SMOKE-): stats cross-tab (dimension bo_phan + tag, count/progress/overdue + pivot bo_phan×giai_doan) → coordination Gantt SUMMARY vs FULL → portfolio roll-up → kanban status PATCH → gantt schedule PATCH FS-invalid 400
```
> API mới: `GET /api/work/stats?groupBy=<tag|dimension:KEY|status|type|priority|project>&col=<axis>&metric=count|progress|overdue&filters` (cross-tab tất định, RLS-scoped, gated `work.report.read`); `GET /api/work/portfolio` (roll-up health/overdue/blocked toàn dự án, gated `work.portfolio.read`); `POST /api/work/items/:id/schedule` (Gantt drag/resize — validate FS predecessor/successor + start≤finish → 400 khi vi phạm; optimistic + rollback ở FE). FE views (workspace `work`): `/work/board` (Kanban dnd-kit, swimlane theo tag/dimension), `/work/calendar` (lịch theo dueAt), `/work/portfolio` (cockpit), `/work/reports` (Thống kê đa chiều — pivot + chart ApexCharts), `/work/projects/[id]/gantt` (timeline planned-vs-actual + dependency edges + milestone + baseline overlay + "Chế độ phối hợp" roll-up cho viewer SUMMARY). Coordination Gantt (owner #1): viewer SUMMARY chỉ nhận `bars` roll-up cha (title/%/dates), KHÔNG con/mô tả — enforce ở service, không lộ về client.
> tags[] + dimensions(jsonb) first-class (owner req #2); attachments reuse RecordDocument subjectType=WorkItem.
> UI: workspace Công việc → Tổng quan `/work`, Việc của tôi `/work/tasks`, Tôi giao `/work/tasks/assigned-by-me`, chi tiết `/work/items/[id]`; BFF `src/app/api/work/[[...path]]`.

### X.Office Management Operating System — MG-01 "reference slice" — seed/smoke
```bash
cd D:/Code/xhub-saas/xhub-api
npm run rls:setup                # 73 bảng RLS (thêm StrategicObjective/MetricDefinition/MetricObservation/BusinessReview/DecisionRecord/ActionCommitment)
npm run seed:manage              # 1 vòng lặp quản trị T001: 4 StrategicObjective (ST-*) + 1 MetricDefinition ACT-CLOSE (sourceSystem=XOFFICE_WORK) + observation TÍNH TỪ NativeWorkItem + 1 MONTHLY_BUSINESS review (pre-read snapshot) + 1 DecisionRecord (RAPID) + 1 ActionCommitment → NativeWorkItem thật (bridge)
npm run test:manage-slice        # reset && smoke self-cleaning: chứng minh TRỌN vòng lặp resolve (objective→metric observation tính từ Work→review chứa snapshot→decision→action→NativeWorkItem→follow-up) + RLS isolation MUST_NOT_LEAK; giá trị on-time-rate GIẢM khi thêm 1 việc quá hạn (bằng chứng #12 read-model)
```
> API: `/api/manage/*` (module `src/manage`, gated `manage.objective|metric|review|decision|action.*`, soft trừ khi AUTH_ENFORCE): objectives (list/get/create/update), metrics (list/get/create + `GET /metrics/:id/observations` compute-from-Work), reviews (list/get/create + `POST /reviews/:id/close` → follow-up), decisions (list/get/create/update), actions (list/get/create — spawn/link NativeWorkItem). MetricObservation là READ MODEL: giá trị `sourceSystem=XOFFICE_WORK` tính từ NativeWorkItem (KHÔNG dual-write, KHÔNG direct-DB #12); ActionCommitment LINK NativeWorkItem (KHÔNG bảng task thứ 3 #13). BSC/Scorecard/OKR/Initiative/Portfolio/Risk/AI nằm NGOÀI slice (MG-03/04/06/07 sau).
> FE (workspace mới **Quản trị**, đặt sau `home`, gated `manage.*`): `/manage` (health tiles), `/manage/objectives`(+`/[id]`), `/manage/metrics` (chart observation từ Work), `/manage/reviews`(+`/[id]`, hiển thị vòng lặp: pre-read→decision→action→việc thật), `/manage/decisions`. BFF `src/app/api/manage/[[...path]]`; data-lib `src/xoffice/lib/manage-data.ts`. KHÔNG phá 5 workspace cũ, KHÔNG trùng `/work/*`,`/projects`,`/tasks/[id]`.

### X.Office Management OS — MG-03 (Scorecard/OKR) + KPI/OKR theo NGÀNH — seed/smoke
```bash
cd D:/Code/xhub-saas/xhub-api
npm run rls:setup                # 89 bảng RLS hiện tại (đọc động từ scripts/rls-setup.mjs — KHÔNG hardcode số, xem thực tế bằng: node -e "console.log(require('fs').readFileSync('scripts/rls-setup.mjs','utf8').match(/TENANT_TABLES\s*=\s*\[([\s\S]*?)\];/)[1].match(/'[^']+'/g).length)")
npm run seed:manage-okr          # Scorecard 4 góc nhìn + OKRCycle 2026Q3 (O-001/O-002, KR-001..004) cho T001
npm run test:manage-okr          # 25 assertions: KPI-tree theo góc nhìn, KPI đỏ KHÔNG bị điểm gộp che, check-in giữ lịch sử (append-only), RLS
npm run seed:manage-industries   # KPI/OKR ĐÚNG NGÀNH cho T002-010 (BĐS/Sản xuất/Phân phối/Xây dựng/Khách sạn/Giáo dục/Y tế/Logistics/Dịch vụ) — mỗi tenant 4 objective+7-8 KPI+OKR riêng, chỉ chung 1 KPI thật ACT-CLOSE
npm run test:manage-industry     # tự chạy lại seed:manage + seed:manage-okr + seed:manage-industries trước khi assert (self-healing thứ tự) — xác nhận T003≠T004 KHÔNG trùng KPI ngoài ACT-CLOSE, T001 không bị ghi đè
```
> FE thêm: `/manage/scorecards`, `/manage/okrs`(+`/[id]`, check-in form).

### IOC Digital Twin — DT-01→03 + Template Gallery — seed/smoke
```bash
cd D:/Code/xhub-saas/xhub-api
npm run seed:ioc                 # X-TECH HQ Tầng 5, 8 vùng → 8 OrgUnit thật, 3 lớp dữ liệu, dashboard DASH-OFFICE v1
npm run seed:ioc-demo-load       # thêm việc thật để tải phòng ban KHÁC NHAU rõ rệt (không phẳng lặng) — chứng minh IOC chỉ chiếu lại Work thật
npm run seed:ioc-templates       # 4 mẫu dùng chung (TPL-OFFICE/FACTORY/RETAIL/HOSPITALITY) — bảng IocTemplate KHÔNG có tenantId (shared, giống Blueprint, cố ý ngoài RLS)
npm run test:ioc-twin            # 44 assertions: mặt bằng/scene/publish-rollback bất biến, 2D luôn dùng được khi tắt WebGL
npm run test:ioc-data-layer      # 45 assertions: lớp dữ liệu chiếu từ Work thật, cấm camera/chấm công/sinh trắc học (403)
npm run test:ioc-templates       # 60 assertions: nhân bản template → chỉ ghi vào tenant gọi, KHÔNG tự bịa OrgUnit nếu không khớp, cách ly tenant qua 404 chéo
```
> FE: workspace **IOC — Bản sao số** `/ioc/*` (9+ route, gate `ioc.*`) + **`/ioc/studio/templates`** (thư viện mẫu → "Nhân bản & sửa"). Icon catalog 14→30 (thêm icon theo ngành). Xem toàn màn hình ở twin viewer + studio editor (đúng pattern OrgChart: `z-[70]`, Esc thoát, canvas Konva/Babylon tự resize thật — không chỉ CSS).
> ⚠️ Nếu route `/ioc/*`/`/manage/*` mới 404 hoặc trang nháy liên tục sau khi pull code mới: xóa cache `.next` và khởi động lại `npm run dev` (lỗi cache Turbopack đã gặp, không phải bug thật):
> ```bash
> cd D:/Code/xhub-saas/xhub-web && rm -rf .next && npm run dev
> ```

### Tenant Lifecycle (DEMO ↔ LIVE + reset-demo + go-live) — seed/backfill idempotent
```bash
cd D:/Code/xhub-saas/xhub-api
npm run seed:golive-template     # 1 template GOLIVE-GENERIC (shared, no-RLS)
npm run seed:tenant-registry     # backfill Tenant.mode: T001=null(exempt), T002–T010=DEMO (non-destructive)
npm run ensure:demo-baselines    # chụp DEMO_BASELINE bất biến cho T002–T010 (skip nếu đã có)
npm run test:lifecycle           # reset-demo + go-live + guards (self-cleaning throwaway tenant)
```
> Reset-demo: `POST /api/platform/tenants/:id/reset-demo` (chỉ DEMO, 409 nếu LIVE) — restore in-place từ DEMO_BASELINE.
> Go-Live: `GET/POST /api/platform/tenants/:id/go-live`, `PATCH .../go-live/steps/:key`, `POST .../go-live/activate` (clear demo + mode=LIVE, một chiều).
> UI: badge DEMO/LIVE ở `/platform/tenants` + detail; nút "Reset về demo" + `/platform/tenants/:id/go-live` (wizard).
> Lưu ý: `test:records`/`test:authz`/`test:t002` in "PASSED" rồi kèm 1 dòng assertion teardown libuv trên Windows — **KHÔNG phải lỗi** (đã biết).

## 7. Tài liệu tiếp tục
- [HANDOFF_XHUB.md](HANDOFF_XHUB.md) · [PROJECT_STATUS_XHUB.md](PROJECT_STATUS_XHUB.md) · [TINH_HINH_DU_AN_XHUB.md](TINH_HINH_DU_AN_XHUB.md) (cho ChatGPT).
- Kế hoạch SaaS: `xhub-web/docs/saas/*` (10 doc) — tiếp **bước 3 Launch Factory**.
- Backlog + thứ tự build SaaS: `xhub-web/docs/DEV_BACKLOG.md` (xem cũng ở /docs/backlog trong app).
- 🔴 **Việc người:** rotate `ANTHROPIC_API_KEY`.

## 8. Điểm tiếp theo (cho phiên máy mới)
- **People Essentials PE-01 (Nghỉ phép & lịch rảnh)** — PE-00 rebase-audit đã xong (`xhub-web/docs/people-essentials/`), sẵn sàng build: 6 bảng mới (RLS 89→95), operating mode đã chốt **SME Lite**, workspace mới **"Nhân sự & Công"** (top-level, không gate).
- **Management OS MG-04→07** (Portfolio/Cockpit/AI Copilot) — design spec sẵn ở `xhub-web/docs/management-os/design/`.
- **IOC DT-04→07** (năng lực phòng ban — chờ PE-07 giải blocker định biên; pipeline quy trình; nhân sự/vị trí; realtime/AI).
- SaaS **bước 3 — Launch Factory** (tái dùng outbox control-plane; `TenantLaunch` = chuỗi step idempotent register→org→enable app→blueprint→seed pack→backup→isolation→handover). Xem `xhub-web/docs/saas/TENANT_LAUNCH_FACTORY_PLAN.md`.
</content>
