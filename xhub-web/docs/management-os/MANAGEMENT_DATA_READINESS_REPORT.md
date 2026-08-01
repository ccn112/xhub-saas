# MANAGEMENT OS — DATA READINESS REPORT (MG-00)

> Cho TỪNG KPI trong `data/KPI_DICTIONARY_SEED.csv` (19 metric): `sourceSystem` khai báo, có **connector THẬT**
> hôm nay hay không, và mức sẵn sàng dữ liệu (**READY / PARTIAL / BLOCKED-needs-connector**).
> Nền tảng ràng buộc: **Constitution #5** (mỗi metric cần owner · công thức · nguồn · tần suất · baseline · target ·
> ngưỡng · chiều hướng · data quality) và **#12** (KHÔNG direct-DB, KHÔNG dual-write — metric đến qua
> **certified read model / connector**, không đọc thẳng DB nguồn). Đọc kèm `MANAGEMENT_SOR_MATRIX_DELTA.md` (§2 connector plane).
> Ngày: 2026-08-01. Docs-first, KHÔNG code.

## 0. TL;DR — thực trạng connector (verify bằng code)

Chỉ **một** nguồn có API/read-model THẬT hôm nay:

| sourceSystem | Trạng thái connector THỰC TẾ | Bằng chứng |
|---|---|---|
| **`XOFFICE_WORK`** | ✅ **LIVE** — API/read-model của Work v2 | `NativeWorkItem`, `ExecutionProject` tồn tại thật trong `xhub-api/prisma/schema.prisma` (Work W1/W2 xong, W3 đang chạy) |
| `XOFFICE` / `X.Office` (Strategy/Decision) | ⚠️ **SẼ CÓ** khi MG-01/02 build (Mgmt-owned, self-produced) | greenfield — số liệu do chính MOS sinh, không cần connector ngoài |
| **`FINERP`** | ❌ **MOCK/ABSENT** — không có connector | không có model/route FinERP trong xhub-api; connector đang mock ở demo |
| **`X2BMS`** | ❌ **MOCK/ABSENT** — app riêng, chưa nối | X2-BMS là dự án Laravel/Flutter riêng; không có read model trong xhub-api |
| **`XBOOKING`** | ❌ **ABSENT** | chưa có connector |
| **`CRM/Survey`, `HR/LMS`, `Process source`** | ❌ **ABSENT** | không có hệ nguồn tương ứng trong monorepo |
| **`MATTERMOST`** | ❌ **NONE** | không có connector/API |

> Vì thế: **duy nhất metric nguồn `XOFFICE_WORK` (và metric Mgmt tự sinh) là buildable NGAY**. Mọi metric
> Financial/Customer/People/X2 **BLOCKED trên connector** — được phép định nghĩa (`MetricDefinition`) nhưng
> KHÔNG có `MetricObservation` thật cho đến khi connector certified lên (MG-08).

## 1. Bảng data-readiness cho 19 KPI

Quy ước:
- **READY** = có connector/nguồn THẬT hôm nay → observation lấy được ngay.
- **PARTIAL** = nguồn tồn tại một phần / phải suy ra từ dữ liệu Work / cần chuẩn hoá công thức trước.
- **BLOCKED-needs-connector** = không có connector THẬT → chỉ định nghĩa được metric, chưa có số liệu certified.

| code | name_vi | perspective | source_system (khai báo) | Nguồn THẬT hôm nay? | Readiness | Ghi chú connector |
|---|---|---|---|---|---|---|
| FIN-REV-GROWTH | Tăng trưởng doanh thu | Financial | FinERP | ❌ mock | **BLOCKED** | Cần FinERP read model (MG-08) |
| FIN-GM | Biên lợi nhuận gộp | Financial | FinERP | ❌ mock | **BLOCKED** | FinERP |
| FIN-CASH-CONV | Chu kỳ chuyển đổi tiền mặt | Financial | FinERP | ❌ mock | **BLOCKED** | FinERP |
| CUS-NPS | Net Promoter Score | Customer | CRM/Survey | ❌ absent | **BLOCKED** | Cần connector CRM/Survey; có thể `MANUAL` tạm |
| CUS-RETENTION | Tỷ lệ duy trì khách hàng | Customer | CRM/Subscription | ❌ absent | **BLOCKED** | CRM/Subscription |
| OPS-OTIF | Giao đúng và đủ | Process | ERP/Operations | ❌ absent | **BLOCKED** | ERP/Operations |
| OPS-SLA | Tỷ lệ đáp ứng SLA | Process | X2/XOffice/Service | ⚠️ một phần | **PARTIAL** | SLA của Ticket/Directive X.Office có thể suy từ Work/office data; phần X2 thì BLOCKED |
| OPS-CYCLE | Thời gian chu kỳ quy trình trọng yếu | Process | Process source | ❌ absent | **BLOCKED** | Cần Process/Workflow analytics (MG-06) |
| PEO-ENGAGE | Mức gắn kết nhân viên | Capability | HR/Survey | ❌ absent | **BLOCKED** | HR/Survey |
| PEO-CRITICAL-CAP | Năng lực trọng yếu đạt chuẩn | Capability | HR/LMS | ❌ absent | **BLOCKED** | HR/LMS |
| STR-OBJ-ONTRACK | Mục tiêu chiến lược đúng hướng | Strategy | X.Office | ⚠️ Mgmt tự sinh (MG-01) | **PARTIAL** | Do MOS tính từ `StrategicObjective.status` sau khi MG-01 build — không cần connector ngoài |
| PFM-BENEFIT | Lợi ích danh mục đã hiện thực hóa | Portfolio | X.Office/FinERP | ❌ FinERP phụ thuộc | **BLOCKED** | Benefit định lượng cần FinERP; định tính thì Mgmt tự sinh |
| **PFM-PREDICT** | Dự án dự báo đúng thời hạn | Portfolio | **X.Office Work** | ✅ **có** | **READY** | Từ `ExecutionProject` health/baseline (Work W2) |
| DEC-CYCLE | Chu kỳ quyết định trọng yếu | Decision | X.Office | ⚠️ Mgmt tự sinh (MG-02) | **PARTIAL** | Tính từ `DecisionRecord` timestamps sau MG-02 |
| **ACT-CLOSE** | Cam kết hoàn thành đúng hạn | Execution | **X.Office Work** | ✅ **có** | **READY** | Từ `NativeWorkItem` (status + dueDate) — connector THẬT |
| DATA-CERT | KPI có dữ liệu chứng nhận đúng hạn | Data | XHub Data | ❌ chưa có pipeline | **BLOCKED** | Cần certification pipeline (xem §4) — hiện chưa tồn tại |
| X2-COLLECT | Tỷ lệ thu phí quản lý | X2-BMS | X2-BMS | ❌ absent | **BLOCKED** | Connector X2-BMS (MG-08) |
| X2-FEEDBACK-SLA | Phản ánh hoàn thành trong SLA | X2-BMS | X2-BMS | ❌ absent | **BLOCKED** | X2-BMS |
| X2-ADOPTION | Cư dân active app | X2-BMS | X2-BMS | ❌ absent | **BLOCKED** | X2-BMS |

### Tổng hợp
- **READY (2):** `PFM-PREDICT`, `ACT-CLOSE` — cả hai nguồn `XOFFICE_WORK`.
- **PARTIAL (3):** `OPS-SLA` (một phần X.Office), `STR-OBJ-ONTRACK`, `DEC-CYCLE` (Mgmt tự sinh sau MG-01/02).
- **BLOCKED-needs-connector (14):** toàn bộ Financial, Customer, People, hầu hết Process, Portfolio-benefit, X2-BMS, và `DATA-CERT`.

## 2. ⭐ Khuyến nghị: reference-slice KPI đến từ `XOFFICE_WORK`

Đồng nhất với `MANAGEMENT_ROADMAP_REBASE.md` §2 (vertical slice T001). Slice đầu **PHẢI** chọn metric nguồn
`XOFFICE_WORK` vì đó là connector THẬT duy nhất — tránh phụ thuộc mock FinERP/X2-BMS:

- **Ứng viên số 1: `ACT-CLOSE`** (Cam kết hoàn thành đúng hạn, WEEKLY, UP). Đóng đúng vòng lặp reference:
  Objective → KPI observation từ nguồn → Review → Decision → **ActionCommitment/NativeWorkItem** → follow-up.
  `ACT-CLOSE` đo trực tiếp bước Action của chính vòng lặp → evidence tự nhiên (Constitution #15).
- **Ứng viên số 2: `PFM-PREDICT`** (dự báo đúng hạn, từ `ExecutionProject` health) — dùng khi slice chạm Portfolio (MG-04).

→ Slice T001 gắn 1 `StrategicObjective` với `MetricDefinition(ACT-CLOSE)`, `MetricObservation` pull từ read-model Work.
Không đụng connector ngoài. Đây là cách chứng minh MOS **trước khi** mở connector FinERP/X2.

## 3. Nợ định nghĩa metric (Constitution #5) trong seed

`KPI_DICTIONARY_SEED.csv` mới có: `code, name_vi, perspective, unit, direction, source_system, frequency`.
Constitution #5 đòi **9 thuộc tính**; seed còn **thiếu**:

| #5 yêu cầu | Có trong seed? | Còn thiếu / cần bổ sung khi MG-01 |
|---|---|---|
| owner | ❌ | `ownerId` (role `METRIC_OWNER`/`DATA_STEWARD`) — bắt buộc |
| công thức (formula) | ❌ | `formula` versioned (T-003 đòi reproducibility theo phiên bản công thức) |
| nguồn (source) | ✅ (`source_system`) | phải nâng thành enum connector chuẩn (`XOFFICE_WORK/FINERP/X2BMS/XBOOKING/MATTERMOST/MANUAL`) |
| tần suất (frequency) | ✅ | — |
| baseline | ❌ | thêm khi tạo `MetricDefinition` |
| target | ❌ | thêm |
| ngưỡng (threshold) | ❌ | thêm (nuôi `ManagementAlert` read model, #4) |
| chiều hướng (direction) | ✅ | mở rộng enum `UP/DOWN/RANGE/ZERO` |
| data quality | ❌ | `freshnessSlaMinutes` + trạng thái certification (T-004 stale-observation warning) |

→ **Kết luận #5:** không metric nào được đánh DONE với chỉ 6 cột seed; MG-01 phải hoàn chỉnh đủ 9 thuộc tính
trong `MetricDefinition` trước khi metric coi là "định nghĩa xong".

## 4. ⚠️ GAP then chốt: CHƯA có pipeline chứng nhận `MetricObservation`

Constitution #12 đòi số liệu đến từ **certified read model**, và `DATA-CERT` (metric riêng!) đo tỷ lệ KPI có
**dữ liệu chứng nhận đúng hạn**. Nhưng **hôm nay CHƯA tồn tại** bất kỳ thành phần nào của pipeline này:

- ❌ Chưa có model `MetricObservation` (greenfield MG-01).
- ❌ Chưa có lớp connector/read-model chuẩn hoá `sourceSystem` → observation (chỉ Work có API thô).
- ❌ Chưa có cơ chế **certification** (ai duyệt số, freshness SLA, version công thức, đánh dấu stale — T-003/T-004).
- ❌ Chưa có `ManagementAlert` read model sinh từ ngưỡng.

**Hệ quả:** `DATA-CERT` tự nó là **BLOCKED** cho đến khi pipeline observation+certification được xây (một phần MG-01,
hoàn thiện MG-05/MG-08). Cho tới lúc đó, mọi observation ngoài `XOFFICE_WORK` chỉ ở mức `MANUAL` (form nhập + audit)
hoặc mock — và phải được đánh dấu rõ ràng là **chưa certified** trên cockpit, tránh vanity dashboard (#4).

## 5. Checklist tuân thủ #12 khi hiện thực Observation (nhắc lại từ SoR Matrix §3)
- [ ] KHÔNG connection string tới DB FinERP/X2-BMS/XBooking/Mattermost trong `xhub-api`.
- [ ] Mọi `MetricObservation` khai `sourceSystem` + timestamp + `freshnessSlaMinutes`.
- [ ] Số liệu READY chỉ pull từ read-model Work; các nguồn khác đánh dấu `MANUAL`/`MOCK` + `certified=false`.
- [ ] MG không ghi ngược DB nguồn; KR.current / benefit **đọc** observation, không dual-write.
