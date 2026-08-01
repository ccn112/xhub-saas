# MANAGEMENT OS — UI / ROUTE PLAN (MG-00)

> Đặt 14 màn MOS (`data/UI_SCREEN_CATALOG.csv`) + cây menu (`data/MENU_TREE.csv`) vào nav 5-workspace hiện có
> **KHÔNG phá 5 workspace rail**. Verify nav thực tế: `xhub-web/src/xhub/nav/navigation.model.ts` (ONE tree,
> `XHUB_NAVIGATION`). Quy tắc nav (comment đầu file): **mọi item phải map tới route THẬT**; đăng ký trong
> **DUY NHẤT một nav model**; mỗi item có `permission` (optional) + `icon`. Docs-first: đây là kế hoạch, chưa code.

## 0. Nguyên tắc đặt chỗ
- Namespace route MOS = **`/manage/*`** — **KHÔNG** đụng `/projects`, `/tasks/[id]`, hay `/work/*` (đã thuộc Work v2).
- Rail hiện có đúng **5 workspace tenant**: `home · work · space · office · business` (+ platform/delivery đặc biệt).
  MOS **không tạo workspace thứ 6 phá layout**; hai lựa chọn tương thích rail:
  - **PA (khuyến nghị):** thêm segment cấp-1 mới **"Điều hành / Quản trị chiến lược"** (`id: manage`) đặt
    **sau `home`, trước `work`** — vì MOS là lớp lãnh đạo (BOARD/CEO/EXECUTIVE), tách bạch khỏi tác nghiệp.
    Rail vẫn là "coarse grouping"; đây là workspace lãnh đạo, gated mạnh nên nhân viên thường không thấy.
  - **PB (thay thế):** nhóm dưới `office` như một cụm "Điều hành" — gọn hơn nhưng trộn lớp quản trị vào X.Office
    tác nghiệp, kém rõ ràng về decision rights. **Chọn PA.**
- Tôn trọng comment nav: item không có screen thì KHÔNG đưa vào (tránh DOM rác). MG đăng ký route theo tiến độ phase.

## 1. Bảng 14 màn → route → workspace → permission

| ID | Màn (VI) | Route | Vị trí nav | primary_role → permission (đề xuất) |
|---|---|---|---|---|
| MG-01 | Trang chủ điều hành | `/manage` | manage (cấp-1, href) | EXECUTIVE → `manage.read` |
| MG-01b | Cockpit lãnh đạo | `/manage/executive` | manage | CEO/BOARD_OWNER → `manage.executive` |
| MG-02 | Bản đồ chiến lược | `/manage/strategy` | manage | STRATEGY_OFFICE → `strategy.read` |
| MG-03 | Mục tiêu (Objectives) | `/manage/objectives` | manage | OBJECTIVE_OWNER → `objective.read` |
| MG-04 | Thẻ điểm BSC | `/manage/scorecards` | manage | STRATEGY_OFFICE → `scorecard.read` |
| MG-05 | Chỉ số (Metrics/KPI) | `/manage/metrics` | manage | METRIC_OWNER/DATA_STEWARD → `metric.read` |
| MG-06 | OKR | `/manage/okrs` | manage | OBJECTIVE_OWNER → `okr.read` |
| MG-07 | Portfolio (PMO) | `/manage/portfolio` | manage | PMO → `portfolio.read` |
| MG-08 | Rà soát (Business Review) | `/manage/reviews` | manage | REVIEW_FACILITATOR → `review.read` |
| MG-09 | Cuộc họp điều hành | `/manage/meetings` | manage | REVIEW_FACILITATOR → `meeting.read` |
| MG-10 | Nhật ký quyết định (RAPID) | `/manage/decisions` | manage | DECISION_OWNER → `decision.read` |
| MG-11 | Quy trình (Process) | `/manage/processes` | manage | PROCESS_OWNER → `process.read` |
| MG-12 | Rủi ro (Risk) | `/manage/risks` | manage | EXECUTIVE → `risk.read` |
| MG-13 | Dashboard điều hành | `/manage/dashboards` | manage | EXECUTIVE → `dashboard.executive` |
| MG-14 | Phương pháp (Methods) | `/manage/methods` | manage | STRATEGY_OFFICE → `manage.read` |

> Role vocabulary lấy từ `ROLE_CATALOG` (16 role: BOARD_OWNER, CEO, EXECUTIVE, STRATEGY_OFFICE, PMO, PROCESS_OWNER,
> OBJECTIVE_OWNER, METRIC_OWNER, DATA_STEWARD, REVIEW_FACILITATOR, DECISION_OWNER, PROJECT_MANAGER, TEAM_MANAGER,
> EMPLOYEE, AUDITOR, …). Permission namespace `manage.*/strategy.*/objective.*/metric.*/okr.*/scorecard.*/portfolio.*/
> review.*/meeting.*/decision.*/process.*/risk.*` đăng ký cùng role registry (như `work.*` đã làm ở Work v2).
> `permission` optional per nav rule: group header MG-01 để mở cho mọi role điều hành thấy ≥1 con; child gated riêng.

## 2. ⚠️ Tránh trùng Portfolio (điểm va chạm quan trọng)
Nav hiện có **đã có** `work.portfolio` → `/work/portfolio` (gated `work.portfolio.read`), backed bởi `ExecutionProject`
(Work W3). MOS cũng có "Portfolio Cockpit" (`/manage/portfolio`). **Quy tắc một-portfolio-một-nguồn:**

- **`/work/portfolio`** = góc nhìn **delivery/PM** trên `ExecutionProject` (tiến độ/health/WBS) — GIỮ NGUYÊN.
- **`/manage/portfolio`** = góc nhìn **đầu tư/benefit** trên `Initiative` (value case, strategic linkage, benefit),
  **link** xuống cùng `ExecutionProject` qua `Initiative.executionProjectId`. **KHÔNG** query/đọc project theo
  đường riêng — hai màn nhìn **cùng một SoR ExecutionProject** từ hai lớp khác nhau.
- Đề xuất UX: `/manage/portfolio` có nút "Xem thực thi" deeplink sang `/work/projects/[id]`; tránh nhân đôi dữ liệu.

## 3. Sơ đồ nav đề xuất (thêm vào `XHUB_NAVIGATION`, KHÔNG sửa 5 workspace cũ)
```
manage (cấp-1, icon: chart, href: /manage, permission: manage.read)   ← đặt sau home
├─ Trang chủ điều hành ........ /manage              (manage.read)
├─ Cockpit lãnh đạo ........... /manage/executive    (manage.executive)
├─ Chiến lược (group)
│  ├─ Bản đồ chiến lược ....... /manage/strategy     (strategy.read)
│  ├─ Mục tiêu ................ /manage/objectives   (objective.read)
│  ├─ Thẻ điểm BSC ............ /manage/scorecards   (scorecard.read)
│  └─ OKR ..................... /manage/okrs         (okr.read)
├─ Hiệu năng (group)
│  ├─ Chỉ số / KPI ............ /manage/metrics      (metric.read)
│  └─ Dashboard ............... /manage/dashboards   (dashboard.executive)
├─ Danh mục đầu tư
│  └─ Portfolio (PMO) ......... /manage/portfolio    (portfolio.read)  → link ExecutionProject
├─ Điều hành nhịp (group)
│  ├─ Rà soát (Review) ........ /manage/reviews      (review.read)
│  ├─ Cuộc họp ................ /manage/meetings     (meeting.read)
│  └─ Quyết định (RAPID) ...... /manage/decisions    (decision.read)
├─ Vận hành xuất sắc (group)
│  ├─ Quy trình ............... /manage/processes    (process.read)
│  └─ Rủi ro .................. /manage/risks        (risk.read)
└─ Phương pháp ............... /manage/methods       (manage.read)
```
- Đăng ký **một lần** trong `navigation.model.ts` (`XHUB_NAVIGATION`), thêm bảng role-visibility ở comment đầu file
  (như PH-01/NX-016 đã làm). Filtering default-safe: dưới enforcement, nhân viên EMPLOYEE không có `manage.*` →
  `filterNavByPermissions` ẩn cả workspace `manage`. Dev/`*` (PLATFORM_ADMIN) thấy full.
- Chỉ đăng ký route khi phase tương ứng có screen thật (nav rule "chỉ item có route thật"). MG-00 chưa thêm gì vào code.

## 4. Reconcile với Work `/work/*` và các workspace khác
| Route | Thuộc | MOS làm gì |
|---|---|---|
| `/work/portfolio`,`/work/projects`,`/work/tasks`,`/work/board`,`/work/calendar` | Work v2 (đã có) | MOS **link/deeplink**, không tái dùng route, không sửa |
| `/office/directives` | X.Office (đã có) | DecisionRecord/ActionCommitment có thể sinh Directive → deeplink |
| `/home/executive`,`/reports` | dashboards seed | MOS `/manage/dashboards` là lớp decision-driven mới; có thể thay dần seed |
| `/manage/*` | **MOS mới** | toàn bộ 14 màn ở đây |

**Kết luận:** MOS sống trong namespace `/manage/*` dưới một workspace `manage` mới (đặt cạnh 5 workspace, không phá rail),
một portfolio duy nhất backed bởi `ExecutionProject`, mọi route đăng ký trong ONE nav model với permission + icon.
