# XOFFICE_WORK — Route & Navigation Migration Plan

> Docs-only. Kế hoạch mở rộng IA workspace **Công việc** cho X.Office Work & Project Management v2.
> Nguồn: handoff `docs/04_UI_INFORMATION_ARCHITECTURE.md`, `data/MENU_TREE_DELTA.csv`, `data/UI_SCREEN_CATALOG.csv`.
> Grounding code: `src/xhub/nav/navigation.model.ts` (ONE nav tree), routes dưới `src/app/(app)/*`.
> Tài liệu chị em: `XOFFICE_WORK_CURRENT_STATE_DELTA`, `XOFFICE_WORK_ENTITY_COLLISION_PLAN`, `XOFFICE_WORK_SCHEMA_PLAN`, `XOFFICE_WORK_UI_PLAN`, `XOFFICE_WORK_INTEGRATION_PLAN`, `XOFFICE_WORK_TEST_PLAN`.

---

## 0. Trạng thái thực tế (verified) vs giả định handoff

Handoff `docs/04` giả định các route hiện hữu là `/directives`, `/approvals`, `/service-desk`. **Codebase thực tế KHÁC** — phải bám mã, không bám handoff:

| Handoff giả định | Route THỰC TẾ trong repo | Nav id (navigation.model.ts) |
|---|---|---|
| `/directives` | **`/office/directives`** | `office.directives` |
| `/service-desk` | **`/office/service-desk`** | `office.service-desk` |
| `/approvals` | `/approvals` ✅ | `approvals.center` (perm `request.approve`) |
| Rail "Công việc" con `Việc được giao /tasks` | Rail `work` con hiện tại: `/inbox`, `/approvals`, `/work`, `/projects` | `inbox.unified`, `approvals.center`, `work.tasks`, `projects.list` |

Hệ quả migration:
- Directive/Service Desk **đã sống trong workspace X.Office** (`office` rail), KHÔNG nằm dưới workspace Công việc như `docs/04` vẽ. Plan này **không di dời** chúng; chỉ thêm liên kết ngữ cảnh (deep-link) từ Work — xem `XOFFICE_WORK_INTEGRATION_PLAN`.
- Rail `work` hiện dùng `href: "/inbox"` và `match: ["/inbox","/approvals","/work","/projects"]`. Ta mở rộng `match` để phủ cây `/work/*` mới.
- Có `src/app/(app)/work/{page.tsx,WorkClient.tsx}` (màn "Công việc & chỉ đạo" cũ, seed-based) và `src/app/(app)/projects/{page.tsx,[projectId]/page.tsx}` (MDM canonical, seed-based). Cả hai còn giữ.

---

## 1. Nguyên tắc bất biến (giữ nguyên khi migrate)

1. **Rail 5 workspace được bảo toàn.** Mọi màn Work mới sống DƯỚI workspace `work` (Công việc), không tạo workspace level-1 mới. Rail = coarse grouping; prime panel = modules của workspace.
2. **`/projects` vẫn là canonical Shared MDM** (`MENU_TREE_DELTA` M-004 = MOVE_MENU_ONLY). Không đổi route, chỉ đổi vị trí hiển thị menu (đưa nhãn "Danh mục dự án" về nhóm Doanh nghiệp/MDM ở bước sau, không bắt buộc trong W1–W3).
3. **`/tasks/[id]` = WorkflowTask runtime**, KHÔNG đụng (`M-005 = KEEP`). Native work detail dùng route MỚI `/work/items/[id]` để tránh va chạm entity (chi tiết ở `XOFFICE_WORK_ENTITY_COLLISION_PLAN`).
4. **Menu rule của repo:** mọi route mới PHẢI đăng ký trong `navigation.model.ts` (ONE tree) với `icon` + `permission` phù hợp; renderer không tự định nghĩa cây. Item không có `permission` = mọi user đã đăng nhập thấy. Group rỗng bị prune bởi `filterNavByPermissions`.

---

## 2. Cây nav Công việc sau migration (đề xuất đăng ký)

Mở rộng node `id: "work"` trong `XHUB_NAVIGATION`. `match` của rail cập nhật thành `["/inbox","/approvals","/work","/projects"]` (đã phủ `/work/*` nhờ prefix `/work`).

```text
Công việc (rail work)                         href /inbox   icon briefcase
├── Hộp việc hợp nhất        /inbox            (existing) badge inbox.open
├── Tổng quan                /work             ADD    icon chart      perm —          [WK-01]
├── Việc của tôi             /work/tasks       ADD    icon work       perm —          [WK-02]
├── Tôi giao                 /work/tasks/assigned-by-me  ADD icon approvals perm —     [WK-02 biến thể]
├── Kanban                   /work/board       ADD    icon board*     perm —          [WK-04]
├── Lịch công việc           /work/calendar    ADD    icon calendar   perm —          [WK-05]
├── Dự án thực thi           /work/projects    ADD    icon projects   perm work.project.read  [WK-06]
├── Portfolio                /work/portfolio   ADD    icon chart      perm work.portfolio.read [WK-11]
├── Báo cáo                  /work/reports     ADD    icon list       perm work.report.read    [WK-12]
├── Trung tâm phê duyệt      /approvals        (existing) perm request.approve
├── Chỉ đạo & cam kết        /office/directives  (existing — deep link, KHÔNG di dời)
└── Service Desk             /office/service-desk (existing — deep link, KHÔNG di dời)
```

Route không lên menu (chi tiết/động — vẫn phải là route thật, active-state qua `match` của cha):
- `/work/items/[id]` — chi tiết NativeWorkItem [WK-03]
- `/work/projects/[id]` — chi tiết dự án [WK-07] (+ tab con `/gantt` [WK-08], `/board` [WK-09], `/calendar` [WK-10])
- `/work/projects/[id]/reports/[reportId]` — Status Report versioned [WK-13]
- `/work/workload` — Phân bổ nguồn lực [WK-14], W4 optional (`M-008`) — có thể lên menu ở W4.

`*` icon `board`: chưa chắc có key sẵn — kiểm tra `src/navigation/icons`; nếu thiếu, tái dùng `work`/`office` hoặc bổ sung key (ghi nhận ở `XOFFICE_WORK_UI_PLAN`).

---

## 3. Ánh xạ Route → Screen → Phase (từ UI_SCREEN_CATALOG)

| Code | Route | Màn | Phase | Perm gate đề xuất | DataSource |
|---|---|---|---|---|---|
| WK-01 | `/work` | Tổng quan Công việc | W1 | — (all) | Work BFF |
| WK-02 | `/work/tasks` | Việc của tôi | W1 | — | NativeWorkItem API |
| WK-02b | `/work/tasks/assigned-by-me` | Tôi giao | W1 | — | NativeWorkItem API (filter ownerId=me) |
| WK-03 | `/work/items/[id]` | Chi tiết công việc | W1 | work.item.read (RLS) | NativeWorkItem API |
| WK-04 | `/work/board` | Kanban | W3 | — | Work Query API |
| WK-05 | `/work/calendar` | Lịch công việc | W3 | — | Work Calendar BFF |
| WK-06 | `/work/projects` | Dự án thực thi | W2 | work.project.read | ExecutionProject API |
| WK-07 | `/work/projects/[id]` | Chi tiết dự án | W3 | work.project.member | ExecutionProject BFF |
| WK-08 | `/work/projects/[id]/gantt` | Gantt dự án | W3 | work.project.member | Schedule Query/Command |
| WK-09 | `/work/projects/[id]/board` | Kanban dự án | W3 | work.project.member | Work Query API |
| WK-10 | `/work/projects/[id]/calendar` | Lịch dự án | W3 | work.project.member | Work Calendar BFF |
| WK-11 | `/work/portfolio` | Portfolio | W3 | work.portfolio.read | Portfolio Read Model |
| WK-12 | `/work/reports` | Báo cáo | W4 | work.report.read | Report API |
| WK-13 | `/work/projects/[id]/reports/[reportId]` | Status Report | W4 | work.report.read/publish | Report API |
| WK-14 | `/work/workload` | Phân bổ nguồn lực | W4 opt | work.workload.read | Workload Read Model |

Perm namespace mới đề xuất: `work.item.*`, `work.project.*`, `work.portfolio.read`, `work.report.*`, `work.view.summary` (coordination — xem UI_PLAN §Coordination Gantt). Đăng ký vào role registry cùng nhịp seed:roles ở xhub-api.

---

## 4. Kế hoạch tương thích / redirect / alias

| ChangeId | Hành động | Cơ chế | Ghi chú |
|---|---|---|---|
| M-001 | `/work` thành root Work ổn định | Giữ `src/app/(app)/work/page.tsx`, biến thành **Tổng quan** [WK-01]. Nội dung "Công việc & chỉ đạo" cũ (seed) chuyển thành widget/di sản. | Không phá route hiện có |
| M-002 | Tách "Việc của tôi" `/work/tasks` khỏi WorkflowTask | Route mới, đọc NativeWorkItem. `/tasks` (nếu có) → server-rewrite/redirect sang `/work/tasks` **sau** khi W1 UI live | Chỉ redirect khi confirm không phá inbox |
| M-003 | Thêm `/work/projects` (execution) | ADD_NEW route + model riêng | Không đụng `/projects` |
| M-004 | `/projects` = MDM canonical, chỉ đổi vị trí menu | MOVE_MENU_ONLY ở W3/W4 | Route BẤT BIẾN |
| M-005 | `/tasks/[id]` = WorkflowTask | KEEP, không đụng | Tránh phá request/approval runtime |
| M-006 | `/work/items/[id]` native detail | ADD | Không va chạm entity |
| M-007 | `/work/portfolio` | ADD | Cockpit quản lý |
| M-008 | `/work/workload` | ADD optional W4 | Lên menu ở W4 |

**Quy tắc redirect:** dùng Next rewrite/redirect ở tầng route (không client hack). `/tasks` và `/tasks/[id]` giữ nguyên cho tới khi có "explicit route plan accepted" (handoff `docs/04` dòng 25). Trong W1–W3 KHÔNG bật redirect phá vỡ inbox runtime.

---

## 5. Checklist đăng ký (mỗi route mới)

Cho mỗi mục ADD ở §2:
- [ ] Thêm `XNavItem` vào node `work` của `navigation.model.ts` với `id`, `label` (tiếng Việt), `href`, `match`, `icon`, `permission` (nếu gate).
- [ ] Tạo `src/app/(app)/work/.../page.tsx` (Server Component) + client con nếu cần tương tác.
- [ ] Trang gọi BFF qua `src/app/api/work/...` proxy (pattern `_forward.ts`), FE không chạm DB.
- [ ] Xác thực active-state (rail + expanded) qua `match`.
- [ ] Đăng ký permission vào role registry (xhub-api seed:roles) trước khi bật `menuEnforce`.
- [ ] Cập nhật `docs/DEV_BACKLOG.md` + `docs/TEST_LOG.md` theo nav & test-log workflow.

Filtering là DEFAULT-SAFE: chỉ áp khi server bật `menuEnforce/AUTH_ENFORCE`; dev/`*`/lỗi fetch perm → hiện full tree. Nên các route mới an toàn ngay cả khi perm chưa seed xong.
