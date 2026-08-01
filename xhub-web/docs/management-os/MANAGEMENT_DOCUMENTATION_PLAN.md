# MANAGEMENT OS — DOCUMENTATION PLAN (MG-00)

> Delta tài liệu MOS bắt buộc theo **Constitution #14**: *mọi module phải có tài liệu nghiệp vụ, data contract,
> UI contract, test, user guide và training delta*; và **#15**: không đánh DONE nếu chưa chứng minh outcome bằng evidence.
> Ánh xạ vào hệ tài liệu ĐANG CÓ của `xhub-web` (các tab `/docs`, `DEVELOPER_GUIDE`, `USER_GUIDE`).
> Đọc kèm 5 docs MG-00 + `docs/xhub-nav-and-testlog-workflow` (mọi trang mới vào nav + đồng bộ TEST_LOG).
> Docs-first, KHÔNG code. Ngày: 2026-08-01.

## 0. Bộ artifact chuẩn cho MỖI capability (Constitution "Mandatory artifacts")

Handoff liệt kê 14 artifact/capability. Gộp thành **6 nhóm #14** để bám checklist:

| Nhóm #14 | Artifact Constitution tương ứng | Nội dung |
|---|---|---|
| **1. Tài liệu nghiệp vụ** | `MANAGEMENT_OUTCOME.md`, `OPERATING_MODEL.md`, `ROLE_DECISION_MATRIX.md`, `PROCESS_AND_CADENCE.md` | Outcome quản trị, mô hình vận hành, quyền quyết định (RAPID), nhịp |
| **2. Data contract** | `INFORMATION_AND_METRIC_MODEL.md`, `DOMAIN_CONTRACT.md`, `SYSTEM_OF_RECORD.md` | Thông tin/metric model, hợp đồng domain/state-machine, SoR |
| **3. UI contract** | `UI_SCREEN_CONTRACT.md` | Màn hình, widget, drill/decision/action (#4) |
| **4. Test** | `TEST_MATRIX.md`, `SEED_MANIFEST.md` | Ma trận test (gate) + seed |
| **5. User guide** | `USER_GUIDE_DELTA.md` | Hướng dẫn người dùng |
| **6. Training delta** | `TRAINING_DELTA.md` | Delta đào tạo (chi tiết ở `MANAGEMENT_TRAINING_PLAN.md`) |
| *(+ AI + evidence)* | `AI_AUTOMATION_POLICY.md`, `ACCEPTANCE_EVIDENCE.md` | Chính sách AI (#10/#11) + bằng chứng DONE (#15) |

## 1. Hệ tài liệu ĐÃ CÓ trong xhub-web (chỗ để đặt delta)

| Nơi | Vai trò | MOS thêm gì |
|---|---|---|
| `xhub-web/docs/management-os/*` | (mới, MG-00) delta kiến trúc/kế hoạch | 5 docs MG-00 + 3 docs này; tiếp tục chứa artifact per-phase |
| Các tab `/docs` trong app (nav workflow) | tài liệu trong-app cho người dùng cuối | thêm tab/section "Điều hành" cho USER_GUIDE_DELTA từng phase |
| `DEVELOPER_GUIDE` | hợp đồng kỹ thuật cho dev/build agent | data contract + domain contract + SoR per phase |
| `USER_GUIDE` | hướng dẫn vận hành người dùng | user-guide delta per màn `/manage/*` |
| `/docs/test` → `TEST_LOG` | user-test đồng bộ khi user tick | TEST_MATRIX per phase nối vào TEST_LOG (T-001..T-015) |
| `TINH_HINH_DU_AN_XHUB.md` | trạng thái tổng cho ChatGPT/điều phối | cập nhật mỗi phase MG đóng |

> Quy tắc nav (từ workflow memory): mọi màn `/manage/*` mới **phải** vào `navigation.model.ts` (workspace `manage`,
> xem `MANAGEMENT_UI_ROUTE_PLAN.md`) và đồng bộ `/docs/test` → `TEST_LOG` khi user tick.

## 2. Delta tài liệu theo phase MG-01..MG-08 (checklist)

Mỗi phase phải sinh đủ 6 nhóm #14. `✎` = phải viết mới ở phase này; `↺` = cập nhật doc đã có; `—` = không đổi.
Nơi lưu: `MO` = `docs/management-os/`, `DG` = DEVELOPER_GUIDE, `UG` = USER_GUIDE + tab `/docs`, `TL` = TEST_LOG.

| Phase (màn/route chính) | 1. Nghiệp vụ | 2. Data contract | 3. UI contract | 4. Test+Seed | 5. User guide | 6. Training delta | Evidence (#15) |
|---|---|---|---|---|---|---|---|
| **MG-01** Objective + Metric (`/manage/objectives`,`/manage/metrics`) | ✎ MO: OUTCOME + OPERATING_MODEL + ROLE_DECISION (Objective/Metric owner) | ✎ DG: `MetricDefinition`(#5 đủ 9 field)+`MetricObservation`(read model)+`StrategicObjective`; SoR | ✎ UG/DG: màn Objectives + Metrics | ✎ TL: T-001,T-002,T-003,T-004 + SEED objectives/metrics | ✎ UG: nhập objective, đọc KPI | ✎ TR-METRIC, TR-EXEC (xem Training Plan) | ✎ ACCEPTANCE: slice T001 KPI READY |
| **MG-02** Meeting+Decision+Review (`/manage/reviews`,`/manage/meetings`,`/manage/decisions`) | ✎ MO: PROCESS_AND_CADENCE (nhịp) + ROLE_DECISION (RAPID #6) | ✎ DG: `MeetingSeries/Instance`,`DecisionRecord`,`BusinessReview`,`ManagementCadence`; link Calendar/Booking; Action→`NativeWorkItem` | ✎ UG/DG: 3 màn review/meeting/decision | ✎ TL: T-005,T-006,T-007 + SEED cadence/meeting-type | ✎ UG: chạy 1 Monthly Business Review | ✎ TR-FAC, TR-MGR | ✎ ACCEPTANCE: 1 review đóng có decision+action |
| **MG-03** Scorecard+OKR (`/manage/scorecards`,`/manage/okrs`) | ✎ MO: OPERATING_MODEL (BSC≠KPI≠OKR #3/#9) | ✎ DG: `Scorecard`,`OKRCycle/Objective/KeyResult` | ✎ UG/DG: màn Scorecard + OKR | ✎ TL: T-008 + SEED OKR/strategy | ✎ UG: lập OKR, gắn KR-metric | ✎ TR-EXEC, TR-MGR (OKR module) | ✎ ACCEPTANCE: KR có outcome đo được |
| **MG-04** Portfolio+Benefit (`/manage/portfolio`) | ✎ MO: value case + benefit owner (#8) | ✎ DG: `Initiative`(+`executionProjectId`→ExecutionProject có sẵn),`Portfolio`,`BenefitProfile`; **LINK không rebuild** | ✎ UG/DG: Portfolio cockpit + deeplink `/work/projects/[id]` | ✎ TL: T-009 + SEED portfolio/initiative | ✎ UG: intake initiative, đọc benefit | ✎ TR-PMO | ✎ ACCEPTANCE: initiative có sponsor+value; link project chạy |
| **MG-05** Cockpit+semantic (`/manage/dashboards`,`/manage/executive`) | ↺ MO: quyết định-driven dashboard (#4) | ✎ DG: `DashboardDefinition`(audienceRoles+decisionQuestions+drill),`ManagementAlert`(read model), semantic metric layer | ✎ UG/DG: cockpit + widget drill/action | ✎ TL: T-010 + SEED dashboard | ✎ UG: đọc cockpit, drill tới action | ✎ TR-EXEC, TR-MGR | ✎ ACCEPTANCE: alert deeplink evidence/action |
| **MG-06** Process+Risk (`/manage/processes`,`/manage/risks`) | ✎ MO: quy trình có owner/measure (#2) | ✎ DG: `ProcessDefinition`(link `Workflow`),`Risk`,`Control` | ✎ UG/DG: màn Process + Risk | ✎ TL: T-014,T-015 (giữ phân tách) + SEED risk/control | ✎ UG: đăng ký process/risk | ✎ TR-MGR, TR-PMO (risk) | ✎ ACCEPTANCE: KRI đo qua observation |
| **MG-07** AI Copilot (xuyên màn) | ↺ MO: AI governance | ✎ DG: `AI_AUTOMATION_POLICY.md` (AI-01..05 draft-first; AI-06 RESTRICTED, AI-07 PROHIBITED #10/#11) — kế thừa pattern `xoffice.service.ts` | ↺ UG: chú thích AI-draft trên các màn | ✎ TL: T-011,T-012 (source/confidence, human confirm) | ↺ UG: "AI đề xuất — người xác nhận" | ✎ toàn bộ audience: cách dùng AI-draft an toàn | ✎ ACCEPTANCE: mọi AI output có source+confidence |
| **MG-08** Ecosystem/connector (nền) | ↺ MO: connector governance | ✎ DG: connector certified read model (FinERP/X2-BMS/XBooking/Mattermost); **no dual-write #12**; certification pipeline `MetricObservation` | ↺ UG: nguồn số liệu certified vs manual | ✎ TL: T-013 (X2 projection không mutate nguồn) + SEED connector | ↺ UG: đọc trạng thái certified/stale | ✎ TR-METRIC (data steward certify) | ✎ ACCEPTANCE: metric BLOCKED → READY khi connector lên |

## 3. Định nghĩa DONE tài liệu cho mỗi phase (#14/#15)

Một phase MG chỉ được đánh **DONE** khi:
- [ ] Đủ **6 nhóm #14**: nghiệp vụ · data contract · UI contract · test · user guide · training delta.
- [ ] Mọi màn `/manage/*` mới đã vào `navigation.model.ts` + có route THẬT.
- [ ] TEST_MATRIX nối vào `/docs/test` → `TEST_LOG`; các gate liên quan (Security/Data/Domain/Business/UX/AI/
      Integration/Architecture) đã có scenario.
- [ ] `ACCEPTANCE_EVIDENCE.md`: **chứng minh outcome bằng evidence** (#15) — không chỉ "màn render".
- [ ] `TINH_HINH_DU_AN_XHUB.md` cập nhật; USER_GUIDE/DEVELOPER_GUIDE có delta phase.

## 4. Ghi chú thứ tự (Constitution "Required design sequence")

Tài liệu phải sinh theo trình tự: Management problem → policy → operating cadence → role/decision rights →
information model → metric/evidence → domain/state machine → API/event/UI → seed/test → user guide/training.
→ **Không** bắt đầu từ UI/DB (#1). Nghĩa là trong mỗi phase, nhóm 1 (nghiệp vụ) và nhóm 2 (data contract) phải
viết **trước** UI contract; user guide + training delta là **cuối cùng** nhưng bắt buộc để DONE.
