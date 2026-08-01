# XTECH_SOLUTION_DELIVERY_PLAN — Solution Delivery Workspace cho T001

> Docs-first, KHÔNG code. Nguồn: handoff `XTECH_XHUB_SAAS_TENANT_001_010_HANDOFF_20260730`
> (`docs/02_THREE_WORKSPACES_ARCHITECTURE.md`, `docs/06_XTECH_DOGFOODING_AND_DELIVERY.md`,
> `data/TENANT_CATALOG_001_010.csv`, `data/BLUEPRINT_CATALOG.csv`, `data/SEED_PACK_CATALOG.csv`,
> `config/subscription-plans.example.json`, `backlog/IMPLEMENTATION_BACKLOG.csv` Phase E2).
> Trạng thái code hiện tại: `D:\Code\TINH_HINH_DU_AN_XHUB.md`, `xhub-web/docs/DEV_BACKLOG.md`.
> Tài liệu chị em (tham chiếu theo tên, không lặp nội dung):
> `SAAS_POSITIONING_DELTA_ANALYSIS`, `TENANT_REGISTRY_IMPLEMENTATION_PLAN`,
> `TENANT_LAUNCH_FACTORY_PLAN`, `BLUEPRINT_SEED_PACK_PLAN`, `PLATFORM_VS_TENANT_PERMISSION_PLAN`.

## 1. Mục tiêu & định vị

Solution Delivery Workspace là **loại không gian thứ BA** trong kiến trúc XHub, bên cạnh
**Platform Console** và **Tenant Workspace** (`docs/02`). Nó thuộc riêng T001 (X-TECH) với vai
trò **đơn vị cung cấp và triển khai giải pháp** (solution provider), khác hẳn với 5 workspace
nghiệp vụ tenant (X.Office/X.Space...) mà mọi tenant đều có.

T001 trong `TENANT_CATALOG_001_010.csv` là `PLATFORM_OWNER_REFERENCE_CUSTOMER`, plan
`ENTERPRISE_DESIGN_PARTNER` (`billingEnabled=false`, `apps=ALL_CONFIGURED`), blueprint
`TECHNOLOGY_SOLUTION_PROVIDER` (`BP-TECH-001`). Delivery Workspace hiện thực hoá đúng vai trò
"solution provider + reference customer" đó.

Vòng đời phủ (từ `docs/06`): quản lý khách hàng → khảo sát → solution blueprint →
implementation → migration → integration → training → UAT → go-live → hypercare →
customer success.

## 2. Nguyên tắc bất di bất dịch (bám non-negotiable của handoff)

- **KHÔNG dual-write dữ liệu nghiệp vụ** (non-negotiable trọng tâm — `docs/02`): ba không gian
  **dùng chung identity + references** nhưng Delivery Workspace **không được ghi song song** dữ
  liệu nghiệp vụ vào tenant khách. Delivery quản lý *dự án triển khai của X-TECH*; khi cần dữ
  liệu tenant đích thì đi qua **Launch Factory** (provisioning) và **Platform Console** (vận
  hành), không phải ghi trực tiếp bảng nghiệp vụ tenant kia.
- **Không hardcode X-TECH** (non-negotiable #1): Delivery Workspace là *cấu hình của T001* (từ
  registry + blueprint `BP-TECH-001`), KHÔNG phải một nhánh `if tenantKey==='xtech'`. Đây cũng
  là điều kiện dọn 5 chỗ hardcode đang nợ (xem DEV_BACKLOG "Known issues").
- **Platform ≠ Delivery ≠ Tenant Admin**: Delivery Workspace dùng quyền tenant của T001, KHÔNG
  phải quyền Platform Console (non-negotiable #6/#7). Chi tiết phân tách ở
  `PLATFORM_VS_TENANT_PERMISSION_PLAN`.
- **Non-negotiable #12**: T001 phải dùng chính XHub (Delivery Workspace) để launch và bàn giao
  T002 — xem §5.

## 3. Tái sử dụng module đã có — KHÔNG xây engine mới

Nguyên tắc cốt lõi: Delivery Workspace là **cấu hình + seed pack + workflow** trên các primitive
đã build ở PH-02, KHÔNG phải hệ thống mới. Ánh xạ:

| Nhu cầu Delivery (docs/06) | Primitive đã có (đã verify trong `xhub-api/src/`) | Ghi chú |
|---|---|---|
| Presales/Sales: lead, opportunity, proposal | `requests/` (FSM approval đầy đủ) + Records | Dùng loại request/biểu mẫu riêng, không engine mới |
| Solution blueprint per-customer | `records/` (RecordDocument + classification) + `mdm/` (master data khách hàng) | Blueprint sản phẩm chuẩn nằm ở `BLUEPRINT_SEED_PACK_PLAN`; đây là "hồ sơ giải pháp" của 1 khách |
| Implementation project + milestone | `directives/` (Directive/Commitment 2 tầng + SLA) | Milestone = commitment có hạn |
| Requirement/Risk/Issue/Decision/Deliverable | `tickets/` (Service Desk, catalog + queue + SLA) | Mỗi loại = catalog item + FSM ticket |
| Migration/Integration task | `tickets/` + `directives/` | Theo dõi bằng ticket/commitment |
| Training/UAT lịch, phòng, tài nguyên | `bookings/` (BookableResource + conflict 409) | Lịch training/UAT session |
| Go-live/Hypercare/Service review thông báo | `announcements/` | Loan báo mốc go-live, review |
| Support sau go-live, adoption, health, renewal | `tickets/` + `records/` + workflow engine | Customer success dựa ticket + hồ sơ |
| Quy trình xuyên suốt | `workflow` engine (Workflow/WorkflowVersion, đã có) | Versioned, immutable snapshot |

Kết luận: **0 engine mới**. Delivery = (a) một tập **loại/biểu mẫu/catalog** mới trên các module
trên, (b) **workflow** riêng cho lifecycle triển khai, (c) **seed pack `SP-XTECH-OPS`** cho T001.

## 4. Delivery lifecycle — các trạng thái

Dựa `docs/06` (4 nhóm) + backlog E2 (SAAS-020..025). Đề xuất state machine cấp "engagement"
(mỗi khách hàng/dự án triển khai của X-TECH là 1 engagement), map lên FSM sẵn có:

```
LEAD → QUALIFIED → SOLUTION_DESIGN → PROPOSAL → WON
     → IMPLEMENTATION → MIGRATION → INTEGRATION → TRAINING
     → UAT → GO_LIVE → HYPERCARE → CUSTOMER_SUCCESS (renewal/health)
   (nhánh phụ: LOST tại QUALIFIED/PROPOSAL)
```

- Giai đoạn **presales** (LEAD→WON) chạy trên `requests` (approval proposal) + `records`.
- Giai đoạn **implementation→UAT→go-live** chạy trên `directives` (milestone/commitment) +
  `tickets` (requirement/risk/issue/decision/deliverable) + `bookings` (training/UAT).
- Giai đoạn **sau go-live** (hypercare→customer success) chạy trên `tickets` (support) +
  `announcements` (service review) + health/adoption từ `records`/report.

Mỗi chuyển trạng thái ghi audit qua `AuditLog` (đã có trong schema) — phục vụ TC-018.

## 5. Chứng minh non-negotiable #12: "T001 dùng XHub để launch & bàn giao T002"

Đây là bằng chứng dogfooding bắt buộc. Kịch bản end-to-end (khớp TC-008, TC-018):

1. Trong Delivery Workspace của T001, tạo **engagement "Triển khai T002 — Chủ đầu tư BĐS
   Demo"** (LEAD→WON, dùng như khách hàng nội bộ/demo).
2. Ở bước IMPLEMENTATION, engagement phát sinh **launch request** → chuyển sang **Tenant Launch
   Factory** (`TENANT_LAUNCH_FACTORY_PLAN`) chứ KHÔNG tự ghi dữ liệu T002.
3. Launch Factory chạy các step idempotent (allocate tenantNo=2 → registry → plan
   `ENTERPRISE_VERTICAL_DEMO` → blueprint `REAL_ESTATE_DEVELOPER`/`BP-RE-002` → seed `SP-RE-DEMO`
   → namespace/backup → first admin → readiness → handover). Chi tiết ở
   `T002_REAL_ESTATE_DEMO_PLAN`.
4. Delivery Workspace của T001 **theo dõi tiến độ** launch (milestone/deliverable/UAT) nhưng
   **không đọc/ghi dữ liệu nghiệp vụ của T002** — chứng minh TC-018 (delivery quản lý launch mà
   không dual-write) và TC-005/TC-006 (isolation).
5. Sau go-live T002 → engagement chuyển HYPERCARE → CUSTOMER_SUCCESS; support T002 mở qua
   `tickets` của Delivery Workspace, truy cập dữ liệu T002 (nếu cần) phải qua **support access
   time-bound + approved + audited** (TC-023, `docs/09`).

## 6. Phạm vi công việc (backlog E2)

Từ `IMPLEMENTATION_BACKLOG.csv` Phase E2 (docs-first ở đây, hiện thực sau khi E1 đóng XOffice):
SAAS-020 Sales/Presales · SAAS-021 Solution Blueprint per-customer · SAAS-022 Implementation
project & milestones · SAAS-023 Requirement/Risk/Issue/Decision/Deliverable · SAAS-024
UAT/Go-live/Hypercare · SAAS-025 Customer Success account health (P1).

Exit gate E2 (`PHASE_CATALOG.csv`): "X-TECH dùng XHub triển khai khách hàng" —
đo bằng kịch bản §5 chạy được đến handover T002.

## 7. Điều kiện tiên quyết & khoảng trống (gaps)

- **Phụ thuộc E1**: các module trên đã build (requests/directives/tickets/bookings) nhưng
  Announcement còn "đang" (4/5 PH-02) — cần đóng trước khi seed lifecycle đầy đủ.
- **Phụ thuộc Registry**: engagement cần trỏ tới tenant đích qua `tenantNo` immutable, mà model
  `Tenant` hiện chỉ có `slug`+`name` (đã verify `prisma/schema.prisma`). `tenantNo`/`TenantClass`
  do `TENANT_REGISTRY_IMPLEMENTATION_PLAN` bổ sung — Delivery Workspace **không tự định nghĩa**.
- **Gap dữ liệu**: chưa có Delivery Workspace + platform tenants trong code (đúng như đề bài nêu).
  Đây là kế hoạch, chưa hiện thực.
- **Nợ hardcode**: 5 chỗ `xtech` (DEV_BACKLOG) phải dọn khi seed `SP-XTECH-OPS` lấy tên/slug từ
  registry — nếu không sẽ vi phạm non-negotiable #1.
