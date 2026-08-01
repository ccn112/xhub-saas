# MANAGEMENT OS — SYSTEM-OF-RECORD MATRIX DELTA (MG-00)

> Ai là **System-of-Record (SoR)** cho từng object MOS: định nghĩa metric vs nguồn quan sát vs quyết định vs
> họp vs mục tiêu. Ràng buộc tuyệt đối **Constitution #12**: KHÔNG direct-DB và KHÔNG dual-write với
> **FinERP, X2-BMS, XBooking, Mattermost** hay app khác — metric đến từ **certified read model / connector**,
> không phải đọc thẳng DB nguồn. Verify entity với `xhub-api/prisma/schema.prisma`.

## 0. Ba lớp SoR trong MOS
1. **Mgmt-owned SoR** — X.Office Management sở hữu vòng đời (định nghĩa, trạng thái, quyết định).
2. **Read model / Observation** — Mgmt **không** sở hữu dữ liệu gốc; chỉ **quan sát** qua connector đã chứng thực.
3. **Linked SoR (đã có trong XHub)** — dữ liệu do module XHub khác sở hữu (`ExecutionProject`/`NativeWorkItem`/
   `MasterRecord`/`Workflow`); MG **link**, không copy.

## 1. Ma trận SoR cho từng object MOS

| Object | SoR (ai sở hữu ghi) | Nguồn dữ liệu | Loại | Ghi chú #12 |
|---|---|---|---|---|
| `StrategicTheme`,`StrategicObjective` | **X.Office Management** | nhập tay / AI draft + human confirm | Mgmt-owned | — |
| `Scorecard` | **X.Office Management** | tham chiếu Objective | Mgmt-owned | — |
| **`MetricDefinition`** (định nghĩa metric) | **X.Office Management** | do METRIC_OWNER/DATA_STEWARD định nghĩa | Mgmt-owned | Định nghĩa (công thức/owner/ngưỡng) là của Mgmt; #5 |
| **`MetricObservation`** (giá trị đo) | **read model** (KHÔNG phải Mgmt) | **connector certified** từ SoR nghiệp vụ | Read model | ⚠️ **Tách bạch**: Mgmt sở hữu *định nghĩa*, KHÔNG sở hữu *số liệu*. Số liệu pull từ FinERP/X2-BMS/XBooking/Work qua read model — **no dual-write, no direct DB** |
| `OKRCycle`/`Objective`/`KeyResult` | **X.Office Management** | nhập tay; `current` của KR có thể map từ MetricObservation | Mgmt-owned | KR.current tham chiếu observation (đọc), không ghi ngược |
| `Initiative`,`Portfolio`,`BenefitProfile` | **X.Office Management** | nhập tay; benefit đo qua MetricObservation | Mgmt-owned | — |
| **`ExecutionProject`** | **X.Office Work** (đã có) | module Work v2 | Linked SoR | MG đọc tiến độ/health; **không ghi** vào ExecutionProject |
| **`NativeWorkItem`** | **X.Office Work** (đã có) | module Work v2 | Linked SoR | Đích của Action; MG tạo/đọc qua API Work, không bypass |
| `BusinessReview` | **X.Office Management** | tổng hợp snapshot | Mgmt-owned | `metricSnapshotIds[]` là snapshot đọc, bất biến |
| `MeetingSeries`/`MeetingInstance` | **X.Office Management** | — | Mgmt-owned | Lịch/phòng: **Calendar/`Booking`/X.Space là SoR**; Meeting chỉ link |
| `DecisionRecord` | **X.Office Management** | — | Mgmt-owned | Nếu sinh Directive/Action → link tới SoR tương ứng |
| **`ActionCommitment`** | **X.Office Management / linked Work** | — | Bridge | Cam kết ghi ở Mgmt; **việc thật là `NativeWorkItem`** (SoR Work). Không nhân đôi trạng thái tiến độ — đọc từ WorkItem |
| `ManagementCadence` | **X.Office Management** | — | Mgmt-owned | — |
| `ProcessDefinition` | **X.Office Management** | link `Workflow` khi số hoá | Mgmt-owned | Runtime instance là SoR của Workflow engine |
| `Risk` | **domain sở hữu** (+ Mgmt projection) | — | Linked/projection | KRI đo qua MetricObservation |
| `Control` | **X.Office Management** | — | Mgmt-owned | — |
| `DashboardDefinition` | **X.Office Management** | widget đọc MetricObservation | Mgmt-owned | Không lưu số liệu; chỉ định nghĩa cách hiển thị |
| `ManagementAlert` | **read model** | sinh từ ngưỡng metric | Read model | Không ghi ngược SoR |

## 2. Nguồn observation theo hệ thống nguồn (connector plane)
Mọi `MetricObservation` phải khai `sourceSystem` (bắt buộc trong `MetricDefinition`). Các nguồn dự kiến và **cách lấy**:

| sourceSystem | Ví dụ metric | Cách lấy (BẮT BUỘC) | Cấm |
|---|---|---|---|
| `XOFFICE_WORK` | tiến độ dự án, số việc trễ | API/read-model của Work (ExecutionProject/NativeWorkItem) | direct-DB vào bảng Work |
| `FINERP` | doanh thu, công nợ | connector certified / read model FinERP | direct-DB, dual-write |
| `X2BMS` | phí vận hành chung cư | connector X2-BMS | direct-DB, dual-write |
| `XBOOKING` | công suất đặt chỗ | connector XBooking | direct-DB, dual-write |
| `MATTERMOST` | mức tương tác kênh | connector/API | direct-DB, dual-write |
| `MANUAL` | KPI nhập tay | form nhập + audit | — |

> Hiện trạng connector (từ `TINH_HINH_DU_AN_XHUB.md`): **connector đang mock** ở môi trường demo. MG-01 phải
> thiết kế `MetricObservation` như read model để khi connector thật lên chỉ đổi nguồn, không đổi hợp đồng.

## 3. Quy tắc chống vi phạm #12 (checklist cho mọi module MG)
- [ ] Metric số liệu KHÔNG bao giờ do MG ghi vào DB nguồn.
- [ ] KHÔNG có foreign connection string tới DB FinERP/X2-BMS/XBooking/Mattermost trong xhub-api.
- [ ] Mọi observation có `sourceSystem` + timestamp + (khi có) `freshnessSlaMinutes` để đo data quality (#5).
- [ ] Action/Commitment KHÔNG lưu trạng thái tiến độ song song — đọc từ `NativeWorkItem` (SoR Work).
- [ ] Meeting KHÔNG lưu lịch riêng — link Calendar/`Booking`.
