# MANAGEMENT OS — ROADMAP REBASE (MG-00 → MG-08)

> Rebase các phase MG của handoff (`docs/18_IMPLEMENTATION_ROADMAP.md`, `data/IMPLEMENTATION_BACKLOG.csv` 45 mục
> MG-001..045) **lên trạng thái code thực tế**. Nguyên tắc handoff: **"no big-bang — chạy MỘT vòng lặp quản trị
> thật cho T001 trước"**, không số hoá cả 23 thực thể một lúc. Docs-first, KHÔNG code ở MG-00.

## 0. Rebase: bỏ gì, giữ gì
- ❌ **BỎ** mọi bước "finish current XOffice operational (PH-02b→f)" — **PH-02 đã đóng 6/6** (code thắng handoff).
- ✅ **GIỮ nguyên** cấu trúc MG-00→MG-08 nhưng **MG-04 chuyển từ "build Portfolio/Project" sang "LINK"**:
  `Initiative.executionProjectId` → `ExecutionProject` đã có (Work W2). Không rebuild engine PM.
- ✅ MG "Action" **link** `NativeWorkItem` đã có (Work W1) — không tạo bảng task thứ 3.
- ✅ Nền không tạo lại: Identity/RLS/Workflow/MDM/Records/Backup/Control Plane/SaaS registry.

## 1. Các phase MG (rebased)

| Phase | Handoff giao | Trạng thái sau rebase | Hành động cụ thể |
|---|---|---|---|
| **MG-00** Rebase audit | Docs, no code | **ĐANG LÀM** = bộ 5 docs này | Hoàn tất delta/collision/SoR/roadmap/UI. Không code. |
| **MG-01** Objective + Metric | Align+Sense nền | Greenfield | ADD-NEW `StrategicObjective`,`MetricDefinition`,`MetricObservation`(read model). RLS +N vào 53 bảng. |
| **MG-02** Meeting + Decision + Review | Decide+Review | Greenfield | ADD-NEW `MeetingSeries/Instance`,`DecisionRecord`,`BusinessReview`,`ManagementCadence`; link Calendar/Booking; Action→`NativeWorkItem`. |
| **MG-03** Scorecard + OKR | Align đầy đủ | Greenfield | ADD-NEW `Scorecard`,`OKRCycle/Objective/KeyResult`. Enforce #3/#9 (BSC≠KPI≠OKR). |
| **MG-04** Portfolio + Benefit | Handoff nói "build" | **REBASE → LINK** | ADD-NEW `Initiative`,`Portfolio`,`BenefitProfile`; **`Initiative.executionProjectId`→ExecutionProject có sẵn**. KHÔNG rebuild PM. |
| **MG-05** Cockpit + semantic | Intelligence | Greenfield | ADD-NEW `DashboardDefinition`(decision-driven, #4),`ManagementAlert`(read model), semantic metric layer. |
| **MG-06** Process + Risk | Operations | Greenfield + link | ADD-NEW `ProcessDefinition`(link `Workflow`),`Risk`,`Control`. |
| **MG-07** AI Copilot | AI augmentation | Nền đã có | Mở rộng pattern AI **đã wire** ở `xoffice.service.ts` (draft-first + `mustRequireHumanApply`) cho AI-01..05; enforce policy AI-06/AI-07. |
| **MG-08** Ecosystem | FinERP/XBooking/X2-BMS/Mattermost/industry packs | Sau cùng | Connector certified read models (thay mock); no dual-write (#12). |

## 2. ⭐ Khuyến nghị: VERTICAL SLICE đầu tiên (sau Work W3)
Handoff yêu cầu chạy **một vòng lặp quản trị thật cho T001 trước**. Reference slice (verbatim priority):

> **Strategic Objective → KPI observation from source → Monthly Business Review → Decision Record →
> Action Commitment/NativeWorkItem → Follow-up and metric outcome.**

**Đề xuất:** gộp phần mỏng của **MG-01 + MG-02** thành **1 lát dọc chạy được cho T001**, thay vì làm hết bề rộng:

| Bước slice | Thực thể tối thiểu | Tái dùng code có sẵn |
|---|---|---|
| 1. Objective | 1 `StrategicObjective` (T001) | greenfield |
| 2. KPI observation | 1 `MetricDefinition` + `MetricObservation` từ 1 nguồn (ưu tiên `XOFFICE_WORK` vì đã có API thật) | connector Work đã có |
| 3. Monthly Business Review | 1 `BusinessReview(type=MONTHLY_BUSINESS)` + `MeetingInstance` | link `Booking`/Calendar |
| 4. Decision | 1 `DecisionRecord` gắn review | greenfield |
| 5. Action | `ActionCommitment` → **`NativeWorkItem` có sẵn** | Work W1 |
| 6. Follow-up | đóng vòng: review kỳ sau đọc lại MetricObservation + trạng thái WorkItem | Work + Metric |

Slice này chứng minh **management outcome bằng evidence** (Constitution #15) trước khi mở rộng — đúng "no big-bang".
Ưu tiên chọn metric nguồn `XOFFICE_WORK` cho slice đầu vì đó là connector **duy nhất đã có API thật** (Work v2),
tránh phụ thuộc connector mock của FinERP/X2-BMS.

## 3. Ánh xạ 4 mục tiêu của chủ sở hữu → phase
> ⚠️ **Lưu ý độ chính xác:** "4 mục tiêu" (doanh thu / phối hợp / độ chính xác quyết định / AI-per-action)
> **KHÔNG** là danh sách đánh số trong handoff — đây là **diễn giải mục tiêu người dùng đặt ra**, ánh xạ vào năng lực MOS.

| Mục tiêu chủ sở hữu | Năng lực MOS | Phase chính | Cách hiện thực |
|---|---|---|---|
| **Doanh thu** (tăng trưởng) | Sense + Align | MG-01, MG-03, MG-08 | `MetricDefinition` doanh thu (source `FINERP` read model) → gắn `StrategicObjective`/`KeyResult`; cockpit MG-05 drill. |
| **Phối hợp** (coordination) | Execute + Review | MG-02, MG-04 (+ Work đã có) | Meeting/Review executable + `ActionCommitment`→`NativeWorkItem`; Portfolio link `ExecutionProject` cho phối hợp đa dự án (Coordination đã có ở Work W2 `CoordinationShare`). |
| **Độ chính xác quyết định** | Decide | MG-02 | `DecisionRecord` (RAPID: decider/recommendation/evidence/deadline, #6) + `options[pros/cons]`; PIR ở `BusinessReview(type=PIR)` đo lại chất lượng quyết định. |
| **AI cho từng hành động** (AI-per-action) | xuyên suốt | MG-07 (+ nền đã có) | Mở rộng AI draft-first đã wire; mỗi object có AI use case (AI-01..05) với **source+confidence+human-confirm** (#11). |

## 4. AI governance ràng buộc theo phase (Constitution #10/#11 + AI_USE_CASE_CATALOG)
| Use case | Rủi ro | Ràng buộc bắt buộc |
|---|---|---|
| AI-01 pre-read tổng hợp | LOW | draft + human confirm |
| AI-02 KPI anomaly | MEDIUM | source + confidence; không tự tạo alert quyết định |
| AI-03 meeting→decisions | MEDIUM | đề xuất, người xác nhận DecisionRecord |
| AI-04 decision brief | MEDIUM | evidence + assumptions hiện rõ |
| AI-05 delay prediction | MEDIUM | không tự đổi baseline (#10) |
| **AI-06 employee eval** | **HIGH** | **RESTRICTED — chỉ advisory, KHÔNG tự động chấm hiệu suất con người (#10)** |
| **AI-07 auto-approve financial** | **PROHIBITED** | **CẤM tuyệt đối — AI không tự phê duyệt/ra quyết định tài chính (#10)** |

Nền tảng: AI đã chạy đúng pattern (draft-first, `mustRequireHumanApply:true`, mock fallback) tại
`xhub-api/src/xoffice/xoffice.service.ts` — MG-07 kế thừa, không phát minh lại cơ chế.
