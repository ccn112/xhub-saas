# XOFFICE_WORK — UI Plan (List / Kanban / Gantt / Calendar / Portfolio / Reports)

> Docs-only. Thiết kế các view quản lý cho X.Office Work & PM v2.
> Nguồn: handoff `docs/05_UI_LIST_KANBAN_GANTT_CALENDAR.md`, `docs/06_PROJECT_DASHBOARD_AND_REPORTING.md`, `docs/14_GANTT_LIBRARY_ADR_TEMPLATE.md`.
> Grounding: `src/xhub/ui/*` (Card/SectionCard, Badge, StatCard, DataTable, PaginatedTable, Pagination, AiRecap, charts, form), stack đã có `@xyflow/react` + `elkjs` + `@dnd-kit/{core,sortable}` trong `src/xoffice/builder/*`, AppShell `h-dvh`.
> Chị em: `XOFFICE_WORK_ROUTE_MIGRATION_PLAN`, `XOFFICE_WORK_INTEGRATION_PLAN`, `XOFFICE_WORK_SCHEMA_PLAN`, `XOFFICE_WORK_TEST_PLAN`.

---

## 0. Nền tảng UI tái dùng

- **Layout:** AppShell `h-dvh` (prime panel scroll độc lập). Mọi view Work fit trong prime panel của workspace `work`.
- **Component kit:** `@/xhub/ui` — `SectionCard`, `StatCard` (KPI), `Badge`/`Tone` (status/priority), `DataTable` + `PaginatedTable` + `Pagination` (List), `charts` (trend/burndown), `AiRecap` (draft status report), `form` kit (filter/inline edit).
- **Đồ thị/kéo thả:** `@xyflow/react` (React Flow) + `elkjs` (auto-layout LTR, `layout.ts`) + `@dnd-kit` (drag Kanban). Đây là stack Gantt/Kanban tái dùng, KHÔNG thêm thư viện Gantt nặng trừ khi ADR (`docs/14`) chốt khác.
- **Data:** mọi view đọc qua BFF proxy (`src/app/api/work/*`, pattern `_forward.ts`), FE không chạm DB; label tiếng Việt, mã/route/event tiếng Anh.

---

## 1. Query domain chung (URL/search state)

Theo `docs/05`: List/Kanban/Gantt/Calendar dùng CHUNG một query model và cùng URL search-state:
`tenant scope · project · owner · orgUnit · status · priority · tag[] · dimension{loaiViec,giaiDoan,nhomChiPhi,boPhan} · dateRange · savedView`.

Chuyển view (List↔Kanban↔Gantt↔Calendar) KHÔNG mất filter — state nằm trên URL query. Một hook `useWorkQuery()` (client) parse/serialize search params, gọi Work Query BFF.

Trạng thái bắt buộc mọi view: `loading / empty / error / permission-denied / offline-degraded`.

---

## 2. List (`/work/tasks`, `/work/tasks/assigned-by-me`) — [WK-02]

- Server pagination/virtualization (target 100k+ item/tenant, `docs/11`) — dùng `PaginatedTable` + server cursor.
- Column chooser, reorder/resize; filter/sort/group; **saved views** per user/team (lưu qua BFF).
- Chế độ tree/WBS (indent theo `parentId`/`wbsCode`).
- Inline safe edits (status, dueAt, assignee) qua command API; bulk assign/status/due với **impact preview** + permission.
- Export chỉ hàng/cột được phép (async cho tập lớn).
- **Việc của tôi** = filter assignee=me; **Tôi giao** = filter ownerId=me (M-002 tách khỏi WorkflowTask).

---

## 3. Kanban (`/work/board`, `/work/projects/[id]/board`) — [WK-04/09]

- Cột theo status policy của project/workflow (configurable).
- Drag/drop bằng `@dnd-kit/sortable`: **optimistic update → server command validate → rollback** nếu 4xx (scheduling/permission fail).
- Card: priority, due/overdue, owner, assignees, project, progress, badge blocked/dependency.
- Quick create; swimlane optional (assignee/project/team/priority); WIP limit + cảnh báo; virtualization board lớn.

---

## 4. Gantt (`/work/projects/[id]/gantt`) — [WK-08] — Editor vận hành

### 4.1 Cách tiếp cận kỹ thuật (tái dùng stack repo)
Gantt = **editor**, không phải chart tĩnh. Dựng trên **React Flow + ELK + dnd-kit đã có** (`src/xoffice/builder`), không nạp lib Gantt mới ở W3 (chốt cuối theo ADR `docs/14`):
- **Trái = WBS tree** (expand/collapse, indent theo `parentId`), **phải = timeline canvas**.
- Task bar / milestone diamond render như custom React Flow node; **dependency FS/SS/FF/SF** = React Flow edge có type; `elkjs` chỉ dùng để gợi ý sắp xếp/kiểm tra, KHÔNG override vị trí thời gian (trục X = thời gian tuyến tính, không auto-layout).
- Zoom day/week/month/quarter (đổi thang trục X); today line; progress bar trong task.
- **Baseline overlay:** vẽ thanh baseline (mờ) song song với actual/forecast (đậm) — phân biệt planned vs actual/forecast.
- Drag/resize task bar: chỉ khi permission + scheduling constraint pass → gọi Schedule Command BFF; **optimistic + rollback** khi server từ chối.
- **Dependency cycle prevention** (server là nguồn chân lý; client cảnh báo sớm), **impact preview** cho cascade tới hạn.
- Unscheduled backlog panel (task chưa lịch); filter owner/team/status/criticality.
- **Accessibility fallback:** bảng chỉnh sửa bằng bàn phím tương đương (edit dueAt/start/dependency không cần chuột) — bắt buộc Gate C.

### 4.2 Yêu cầu CHỦ CHỐT của owner #1 — Coordination Gantt (chia sẻ phối hợp)

Một Gantt phối hợp/chia sẻ liên phòng ban. Người xem chỉ có `work.view.summary` trên item cross-team **chỉ** được thấy ở mức tổng hợp:

**Được thấy (summary row):** parent title · % progress (rolled-up) · planned dates (start/finish) · milestone.
**KHÔNG được:** child task NOT expandable (không bung được), description ẩn, attachments ẩn, không comment/evidence.

Thiết kế UI:
- Server chỉ trả **`SummaryWorkItemDTO`** cho các hàng này (title, progressPercent, plannedStart, plannedFinish, milestoneFlag) — client KHÔNG BAO GIỜ nhận child/description/attachment cho hàng summary (enforcement server-side; xem `XOFFICE_WORK_SCHEMA_PLAN` + TEST_PLAN assert 403/omitted).
- Hàng summary render dạng **rolled-up summary bar** (thanh gộp, không có nút expand ▸), gắn chỉ báo **"Chia sẻ phối hợp"** (badge/icon) để phân biệt với hàng full.
- Hai UI state của một hàng:
  - **Full row** (đủ quyền): expand child, mở detail, thấy description/attachment/dependency.
  - **Summary row** (`work.view.summary`): chỉ summary bar + tooltip % + milestone diamond; click → panel tối giản (title, %, dates, milestone), không có tab Documents/Activity.
- Cùng một Gantt có thể trộn full row (item của mình) và summary row (item team khác) → viewer thấy bức tranh phối hợp mà không rò rỉ chi tiết nội bộ team khác.

Đây là **ask chính của owner** — mọi thành phần Gantt/List/Report phải tôn trọng ranh giới `SummaryWorkItemDTO`.

---

## 5. Calendar (`/work/calendar`, `/work/projects/[id]/calendar`) — [WK-05/10]

- Month/week/day; sự kiện typed riêng: due date · scheduled task · milestone · booking.
- Drag/reschedule qua **command API** (không update DB trực tiếp từ client).
- Filter resource/owner. Lịch cá nhân tổng hợp Work + Booking + external Calendar **projection** mà không đổi SoR (xem INTEGRATION_PLAN).

---

## 6. Portfolio cockpit (`/work/portfolio`) — [WK-11]

- KPI (`StatCard`): active projects, Green/Yellow/Red, milestone slipped, overdue critical work, blocked work, open high risks/issues, decisions waiting, workload hotspots.
- Drill path: Tenant → Legal Entity/Org Unit → Portfolio → ExecutionProject → NativeWorkItem.
- Đọc **Portfolio Read Model** (materialized, tránh N+1 — `docs/11`).

---

## 7. Project Detail tabs (`/work/projects/[id]`) — [WK-07]

Tabs (theo `docs/04`, đồng bộ pattern `src/app/(app)/projects/[projectId]` đã có sẵn milestones/risks/decisions/docs):
`Overview · Work · Gantt · Milestones · Risks & Issues · Decisions · Reports · Documents/Links · Activity · Settings`.

- Header: health, progress, baseline finish, forecast finish, variance, PM, sponsor (`docs/06`).
- Widgets Overview: milestones, progress trend (charts), overdue/blocked, dependency risk, workload, risk/issue/decision, recent activity, next 14 days.
- Tab Work = List project-scoped; Gantt = [WK-08]; Documents/Links = RecordDocument + WorkLink/ExternalWorkLink (INTEGRATION_PLAN).

---

## 8. Status Reports (`/work/projects/[id]/reports/[reportId]`) — [WK-13]

First-class **versioned object** (không phải file Word đính kèm):
`reportingPeriod · overallHealth · achievements · inProgress · nextPeriod · milestoneStatus · schedule/scope/budget refStatus · risks/issues · decisionsNeeded · changes · generatedSnapshotSourceTimestamp`.

- `AiRecap` có thể **draft** từ dữ liệu quyền uy; con người review/publish; report đã publish **immutable + versioned** (draft/review/publish/version, `docs/06`).

---

## 9. Yêu cầu CHỦ CHỐT của owner #2 — Tags + thống kê đa chiều

List/Kanban/Reports PHẢI filter + group + pivot theo `tags` và các **dimension do tenant định nghĩa**: **Loại việc · Giai đoạn · Nhóm chi phí · Bộ phận** (lưu trong `metadata`/bảng dimension — xem `XOFFICE_WORK_SCHEMA_PLAN`).

- **Filter bar dùng chung** (mọi view): chip filter cho `tags[]` (multi-select, AND/OR) + dropdown mỗi dimension; đồng bộ URL query (§1).
- **Group/Swimlane theo dimension:** List group-by và Kanban swimlane có thể chọn bất kỳ tag/dimension.
- **Report view "Thống kê đa chiều"** (`/work/reports`): bảng cross-tab/pivot — chọn trục hàng (vd Bộ phận) × trục cột (vd Giai đoạn), ô = count/sum progress/hạn trễ; hỗ trợ đổi metric và drill xuống List đã lọc. Charts (`@/xhub/ui/charts`) cho phân bố theo tag/dimension.
- Enforcement quyền: pivot chỉ tính trên hàng viewer được phép; hàng summary-only (§4.2) chỉ đóng góp field summary (progress/dates), không lộ chi tiết.

---

## 10. Responsive (Gate C)

Desktop tối ưu Gantt/List; tablet split view; mobile ưu tiên My Work / task detail / quick status / calendar agenda / project summary. Gantt mobile có thể read/limited-edit. Tất cả dùng breakpoint của AppShell `h-dvh`.
