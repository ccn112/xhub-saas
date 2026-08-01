# MANAGEMENT OS — TRAINING PLAN (MG-00)

> Ai cần đào tạo cái gì, ở phase nào, dưới hình thức nào — để **nhịp rà soát (cadence) thật sự chạy được**.
> Nguồn: `data/TRAINING_CATALOG.csv` (6 khoá) × `data/ROLE_CATALOG.csv` (16 role) × `data/MANAGEMENT_CADENCE.csv` (7 nhịp).
> Nền tảng: **Constitution #15** (không DONE nếu chưa chứng minh **management outcome bằng evidence**) và **#14**
> (training delta là một phần bắt buộc của DONE mỗi module). Đọc kèm `MANAGEMENT_DOCUMENTATION_PLAN.md` (§2 cột "Training delta").
> Docs-first, KHÔNG code. Ngày: 2026-08-01.

## 0. Nguyên tắc: training là "chất bôi trơn" của cadence

MOS chỉ tạo ra giá trị khi **vòng lặp quản trị chạy đều** (Sense→Align→Decide→Execute→Review→Learn). Mỗi nhịp
(`MANAGEMENT_CADENCE`) cần **con người biết vận hành object điều hành** (metric, review, decision, action) đúng cách —
nếu không, màn hình có mà nhịp không chạy → không có evidence → không DONE (#15). Vì thế mỗi phase MG **phải kèm
training delta** cho đúng vai trò trước khi coi là hoàn tất.

## 1. 6 khoá đào tạo × đối tượng (từ TRAINING_CATALOG)

| Khoá | Đối tượng | Outcomes | Phút | Role (ROLE_CATALOG) phủ |
|---|---|---|---|---|
| **TR-EXEC** | Executives | Strategy, exception, decision, review | 180 | BOARD_OWNER, CEO, EXECUTIVE, STRATEGY_OFFICE |
| **TR-MGR** | Managers | KPI, review, action, escalation | 180 | TEAM_MANAGER, EXECUTIVE, OBJECTIVE_OWNER |
| **TR-PMO** | PMO/PM | Intake, prioritization, health, benefit | 240 | PMO, PROJECT_MANAGER |
| **TR-METRIC** | Owners/Stewards | Definition, quality, commentary | 150 | METRIC_OWNER, DATA_STEWARD, OBJECTIVE_OWNER |
| **TR-FAC** | Facilitators | Pre-read, agenda, decision/action capture | 150 | REVIEW_FACILITATOR, DECISION_OWNER |
| **TR-EMP** | Employees | Work update, evidence, commitment | 60 | EMPLOYEE (+ mọi người thực thi action) |

> `AUDITOR` không có khoá riêng trong catalog → dùng TR-EXEC (phần exception/review) + đọc `/docs` assurance.

## 2. Ai học gì, theo TỪNG vai trò điều hành cốt lõi

Sáu vai trò làm vòng lặp chạy (khớp câu hỏi đề bài): objective owner · metric owner · review facilitator ·
decision owner · PMO · executive.

| Vai trò | Khoá chính | Object điều hành phải thạo | Nhịp họ vận hành |
|---|---|---|---|
| **OBJECTIVE_OWNER** (chủ mục tiêu) | TR-METRIC + TR-MGR | `StrategicObjective`, gắn KR/metric, cập nhật status/on-track | Monthly Strategy Execution |
| **METRIC_OWNER / DATA_STEWARD** (chủ KPI) | **TR-METRIC** | `MetricDefinition` (#5 đủ 9 field), certify observation, viết commentary, xử lý stale (T-004) | Monthly Business Review (cấp số liệu) |
| **REVIEW_FACILITATOR** (điều phối review) | **TR-FAC** | pre-read, agenda INFORM/DISCUSS/DECIDE, chốt decision+action, không đóng review khi còn DECIDE chưa xử (T-007) | Weekly/Monthly Review, Huddle |
| **DECISION_OWNER** (người quyết định) | TR-FAC + TR-EXEC | `DecisionRecord` RAPID (#6): decider, recommendation, evidence, deadline, execution owner | Monthly Business Review, Quarterly |
| **PMO** | **TR-PMO** | intake `Initiative` (value+sponsor, T-009), prioritization, health, benefit; link `ExecutionProject` | Weekly Project Review, Quarterly Portfolio |
| **EXECUTIVE / CEO / BOARD** | **TR-EXEC** | đọc cockpit theo exception, drill tới action (#4), ra quyết định trọng yếu | Monthly Business Review, Quarterly Strategy |
| *(nền)* **EMPLOYEE** | TR-EMP | cập nhật `NativeWorkItem`, đính evidence, chốt commitment (T-006) | Weekly Team Review, Daily Huddle |

## 3. Training delta theo phase MG (song song DOCUMENTATION_PLAN §2)

| Phase | Khoá phải phát hành/cập nhật | Vì sao gắn với phase này |
|---|---|---|
| **MG-01** Objective+Metric | **TR-METRIC** (mới), TR-EXEC (phần strategy/metric) | Có metric → metric owner phải biết định nghĩa #5 + certify; slice T001 cần đọc KPI |
| **MG-02** Meeting+Decision+Review | **TR-FAC** (mới), TR-MGR (review/action/escalation) | Cadence bắt đầu chạy được → facilitator + manager phải điều phối review, chốt decision/action |
| **MG-03** Scorecard+OKR | TR-EXEC + TR-MGR (module OKR) | BSC/OKR không được biến thành task list (#9) — cần huấn luyện phân biệt |
| **MG-04** Portfolio+Benefit | **TR-PMO** (mới) | Intake/health/benefit + link ExecutionProject; T-009 value+sponsor |
| **MG-05** Cockpit | TR-EXEC + TR-MGR (đọc cockpit theo exception, drill→action) | Chống vanity dashboard (#4): phải huấn luyện đọc-để-hành-động |
| **MG-06** Process+Risk | TR-MGR + TR-PMO (risk/control) | Process có owner/measure (#2); KRI |
| **MG-07** AI Copilot | **delta cho MỌI khoá**: dùng AI-draft an toàn (source/confidence/human-confirm #11; AI-06 RESTRICTED, AI-07 PROHIBITED) | AI xuyên suốt mọi màn → mọi vai trò phải hiểu "AI đề xuất, người xác nhận" |
| **MG-08** Ecosystem/connector | **TR-METRIC** (data steward certify connector, đọc certified vs manual/stale) | Connector certified read model thay mock; DATA-CERT |
| *(nền)* **TR-EMP** | phát hành sớm (từ MG-02, khi Action→NativeWorkItem chạy) | Nhân viên phải cập nhật việc + đính evidence để cadence có số thật |

## 4. Hình thức phát hành (format) × nơi lưu

| Format | Dùng cho | Nơi | Ghi chú |
|---|---|---|---|
| **In-app guide** (tooltip/coach-mark trên `/manage/*`) | thao tác ngắn theo màn (nhập objective, chốt decision) | ngay trong màn + tab `/docs` | khớp `USER_GUIDE_DELTA` từng phase |
| **`/docs` (in-app docs tab)** | khoá dài TR-* (mục tiêu, ví dụ, ảnh chụp) | tab "Điều hành" trong `/docs` | đồng bộ với USER_GUIDE |
| **Playbook** (quy trình chạy nhịp) | REVIEW_FACILITATOR/PMO: cách chạy Monthly Business Review, Quarterly Portfolio đầu-đến-cuối | `docs/management-os/` + `/docs` | 1 playbook / nhịp trong `MANAGEMENT_CADENCE` |

## 5. Gắn training vào nhịp vận hành (MANAGEMENT_CADENCE)

Training chỉ "xong" khi nhịp tương ứng chạy có evidence. Ánh xạ khoá → nhịp:

| Nhịp (cadence) | Tần suất | Vai trò dẫn | Khoá điều kiện để nhịp chạy | Required output (phải tạo được sau training) |
|---|---|---|---|---|
| Daily Operations Huddle | DAILY | TEAM_MANAGER | TR-MGR, TR-EMP | Action/escalation |
| Weekly Team Review | WEEKLY | TEAM_MANAGER | TR-MGR, TR-EMP | Replan/actions |
| Weekly Project Review | WEEKLY | PROJECT_MANAGER/PMO | TR-PMO | Decision/actions |
| Monthly Business Review | MONTHLY | REVIEW_FACILITATOR + EXECUTIVE | TR-FAC, TR-EXEC, TR-METRIC | Decisions/resource/actions |
| Monthly Strategy Execution | MONTHLY | STRATEGY_OFFICE + OBJECTIVE_OWNER | TR-EXEC, TR-METRIC | Adapt initiatives |
| Quarterly Strategy & Portfolio | QUARTERLY | EXECUTIVE + PMO | TR-EXEC, TR-PMO | Reset priorities/funding |
| Post Implementation Review | EVENT | PMO + DECISION_OWNER | TR-PMO, TR-FAC | Standardize/close (benefit, lessons) |

## 6. Training delta = một phần của DONE (#14/#15)

Một phase MG **không DONE** nếu thiếu:
- [ ] Khoá TR-* liên quan (bảng §3) đã phát hành hoặc cập nhật (in-app + `/docs`).
- [ ] Playbook cho nhịp mới mở đã có (nếu phase mở nhịp mới).
- [ ] Vai trò dẫn nhịp đã có tài liệu để **chạy thật 1 lần** → tạo ra `required output` của nhịp = **evidence** (#15).
- [ ] `TRAINING_DELTA.md` của phase ghi rõ: ai học gì, format, nơi lưu (khớp Documentation Plan).

> Kết luận: đào tạo không phải phụ lục — nó là điều kiện để **management outcome được chứng minh bằng evidence**.
> Không có metric owner biết certify, không có facilitator biết chốt decision/action, thì cadence chỉ là lịch trống.
