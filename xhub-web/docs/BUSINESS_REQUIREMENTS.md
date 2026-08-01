# Tài liệu nghiệp vụ — XHub (Business / Requirements)

> Nguồn: bộ handoff `XTECH_XHUB_NEXT_PHASES_COMPACT_UX_SEED_HANDOFF_20260730`
> (executive handoff, XOffice operational scope, FLOW/SCREEN/ROLE/PERMISSION catalog)
> **và** các module đã hiện thực trong `xhub-api` (`requests`, `directives`, `tickets`, admin/identity).
> Mọi vai trò · route · trạng thái nêu ở đây đều đối chiếu với code/handoff thật — không bịa.
> Trạng thái build chi tiết xem trang **Backlog**.

## Tổng quan nghiệp vụ

**XHub** là cổng làm việc hợp nhất nội bộ của X-TECH: một điểm đăng nhập, một menu, một
lớp phân quyền chung cho toàn bộ nghiệp vụ điều hành. Mục tiêu giai đoạn hiện tại là đưa
nền tảng tới **X-TECH Internal Pilot** bằng cách nối các màn hình vào dữ liệu thật (không
phụ thuộc demo fallback), có seed đủ vai trò và tình huống.

Sản phẩm tổ chức thành **3 khối** (5 workspace trên thanh điều hướng):

- **XHub** — trang chủ vai trò, hộp việc, KPI điều hành tổng hợp (aggregated BFF).
- **X.Space** — không gian trao đổi/cộng tác (kênh, tin nhắn, khách hàng).
- **X.Office** — trục nghiệp vụ vận hành: Yêu cầu & Phê duyệt, Chỉ đạo & Cam kết,
  Service Desk, Booking, Thông báo, Tài liệu (Records), Dữ liệu chủ (MDM).
- Cùng với khối **Quản trị** (Identity/Org/Authz/Backup) và **AI** (chỉ gợi ý).

**Mô hình đa-tenant (multi-tenant):** mỗi tổ chức là một tenant tách biệt. Người dùng đăng
nhập rồi **chọn tenant** (`/select-tenant`, chỉ hiện tenant đang active). Dữ liệu cô lập theo
tenant ở tầng hàng (RLS — row-level security, 47 bảng tính tới mốc hiện tại). Mọi phạm vi
dữ liệu (data scope) trong tài liệu này đều nằm **trong** ranh giới tenant.

## Vai trò & phân quyền

Nguồn: `ROLE_CATALOG.csv` + `ROLE_PERMISSION_MATRIX.csv`. Hệ thống định nghĩa **16 vai trò**
với quy ước quyền dạng wildcard (ví dụ `tenant.*`, `request.approve`) và `can()` kiểm tra ở
runtime; menu được lọc theo quyền (`filterNavByPermissions`).

### Ba tầng phân quyền

1. **Module / workspace** — thấy được khối nào (XHub · X.Space · X.Office · Quản trị · AI).
2. **Menu / màn hình** — trong khối, thấy được mục nào (nav lọc theo registry vai trò).
3. **Tính năng / hành động** — trong màn, làm được nút nào (create/approve/publish…).

### Phạm vi dữ liệu (data scope)

Mỗi vai trò gắn một `Data scope` quyết định **thấy/tác động tới bản ghi nào**: `NONE`
(bypass nền tảng, phải audit) · `TENANT` / `TENANT_READ` · `ORG_UNIT` / `ORG_UNIT_TREE`
(theo đơn vị và cây con) · `LEGAL_ENTITY` · `ASSIGNED` (chỉ việc được giao) ·
`SELF_AND_GRANTED` (của mình + được chia sẻ) · `TENANT_AND_SHARED` (dữ liệu chủ dùng chung).

### Danh mục 16 vai trò

| Vai trò | Mô tả | Phạm vi dữ liệu |
|---|---|---|
| PLATFORM_ADMIN | Quản trị nền tảng; bypass phải audit | NONE |
| TENANT_ADMIN | Người dùng, ứng dụng, cấu hình tenant | TENANT |
| ORG_ADMIN | Org unit, position, reporting line, ủy quyền | TENANT |
| SECURITY_ADMIN | Role, permission, data scope, test-as-user | TENANT |
| WORKFLOW_ADMIN | Workflow/form/catalog/runtime | TENANT |
| BACKUP_ADMIN | Backup/restore sandbox (không tự duyệt restore production) | TENANT |
| AUDITOR | Đọc audit, backup, permission, assignment snapshot | TENANT_READ |
| DATA_STEWARD | MDM/import/duplicate/quality/taxonomy | TENANT_AND_SHARED |
| RECORDS_MANAGER | Document/version/classification/retention | TENANT |
| COMM_ADMIN | Announcement/policy/audience/read report | TENANT |
| SERVICE_DESK_MANAGER | Catalog/queue/SLA/escalation/report | ORG_UNIT |
| SERVICE_DESK_AGENT | Nhận/xử lý ticket | ASSIGNED |
| EXECUTIVE | Xem điều hành, ban hành chỉ đạo, duyệt theo position | TENANT_SCOPE |
| CFO | Duyệt tài chính theo scope/amount | LEGAL_ENTITY |
| DEPARTMENT_HEAD | Duyệt/giao việc trong đơn vị | ORG_UNIT_TREE |
| EMPLOYEE | Tạo yêu cầu, xem việc & tài liệu được phép | SELF_AND_GRANTED |

### Ma trận quyền then chốt (trích)

| Quyền | Hành động | Vai trò | Audit | Guardrail |
|---|---|---|---|---|
| `tenant.user.invite` | Mời người dùng | TENANT_ADMIN | có | idempotent invite |
| `tenant.user.suspend` | Tạm khóa người dùng | TENANT_ADMIN | có | Impact preview (không xóa lịch sử) |
| `role.binding.write` | Gán vai trò | SECURITY_ADMIN | có | Impact preview |
| `scope.write` | Sửa phạm vi dữ liệu | SECURITY_ADMIN | có | Test-as-user |
| `delegation.write` | Tạo ủy quyền | ORG_ADMIN | có | Không lặp/chồng |
| `request.create` | Tạo yêu cầu | EMPLOYEE | — | Theo procedure policy |
| `request.approve` | Phê duyệt yêu cầu | EXECUTIVE / CFO / DEPARTMENT_HEAD | có | Re-check quyền tại nguồn |
| `directive.issue` | Ban hành chỉ đạo | EXECUTIVE | có | Theo audience/assignee |
| `ticket.resolve` | Đóng ticket | SERVICE_DESK_AGENT | có | Bắt buộc có resolution |
| `document.publish` | Phát hành tài liệu | RECORDS_MANAGER | có | Immutable version |
| `restore.production.approve` | Duyệt restore production | TENANT_ADMIN | có | Người yêu cầu không tự duyệt |

## Các luồng nghiệp vụ

Mô tả theo **actor → các bước → trạng thái → SLA/guardrail**. Trạng thái lấy đúng theo FSM
đã hiện thực (`*.fsm.ts`) và `06_XOFFICE_OPERATIONAL_SCOPE.md`.

### 1. Yêu cầu & Phê duyệt (Request) — `FLOW-04/05`, đã chạy

**Actor:** EMPLOYEE tạo · DEPARTMENT_HEAD / CFO / EXECUTIVE duyệt.
**Màn:** `/office/requests` (trung tâm yêu cầu) → `/office/requests/new/[code]` (tạo, có AI
gợi ý mức đủ) → `/requests` (yêu cầu của tôi) → `/requests/[id]` (chi tiết) →
`/approvals/[id]` (phê duyệt).

**Vòng đời (FSM thật):**

```text
DRAFT → SUBMITTED → (WAITING_SUPPLEMENT ⇄ RESUBMITTED) → APPROVED → EXECUTING → DONE
                  ↘ REJECTED
DRAFT/đang duyệt → WITHDRAWN | CANCELLED   (IN_REVIEW/COMPLETED = alias seed/legacy)
```

- **Các bước:** tạo → nộp (submit) → duyệt nhiều nấc (quản lý → kỹ thuật → kế toán → CFO,
  và **CEO nếu ≥ 200M**) → **thực thi thủ công + đính bằng chứng** → hoàn tất.
- **Bổ sung:** approver yêu cầu bổ sung → requester sửa → nộp lại, **giữ nguyên phiên bản
  workflow**.
- **Guardrail:** *không tạo chứng từ ERP giả* — thực thi ngoài hệ thống rồi ghi bằng chứng;
  phê duyệt **theo position**, không hardcode người duyệt; ABAC theo **amount**; **audit mọi
  transition**.

### 2. Chỉ đạo & Cam kết (Directive) — `FLOW-06`, đã chạy

**Actor:** EXECUTIVE / DEPARTMENT_HEAD ban hành · người/đơn vị nhận cam kết.
**Màn:** `/directives` (danh sách + KPI + rủi ro) → `/directives/[id]` (action items, tiến
độ, bằng chứng).

**Vòng đời hai tầng (FSM thật):**

```text
Chỉ đạo:   DRAFT → ISSUED → IN_PROGRESS → COMPLETED | CANCELLED
Cam kết:   ASSIGNED → ACKNOWLEDGED → IN_PROGRESS → SUBMITTED → ACCEPTED
                                                            ↘ RETURNED ⇄ IN_PROGRESS
```

- **Các bước:** ban hành → giao theo đối tượng (org/user) → tạo action item → cập nhật tiến
  độ → rủi ro/escalation → nộp bằng chứng → nghiệm thu (accept) hoặc trả lại (return, làm lại).
- **SLA/Guardrail:** overdue tính theo `dueAt`; *không hardcode người thực hiện* trong
  workflow — thực thể `Directive/Decision/Commitment/ActionItem/ProgressUpdate/CompletionEvidence`.

### 3. Service Desk (Ticket) — `FLOW-07`, đã chạy (core)

**Actor:** EMPLOYEE gửi · SERVICE_DESK_AGENT xử lý · SERVICE_DESK_MANAGER phân hàng đợi/SLA.
**Màn:** `/service-desk` (catalog + queue + SLA) → `/service-desk/[id]` (ghi chú
public/private, resolution).

**Vòng đời (FSM thật):**

```text
NEW → TRIAGED → ASSIGNED → IN_PROGRESS → (PENDING_REQUESTER ⇄ IN_PROGRESS)
    → RESOLVED → CLOSED          (CANCELLED từ mọi trạng thái đang hoạt động)
```

- **Các bước:** chọn dịch vụ trong catalog → tiếp nhận → phân công / tự nhận (claim) → xử lý
  → chờ người yêu cầu (pause SLA) → giải quyết → đóng → CSAT.
- **SLA/Guardrail:** `slaDueAt` suy từ `defaultSlaHours` của catalog item; **pause/resume**
  khi chờ requester; ticket **overdue** khi quá hạn và chưa terminal; đóng phải có resolution.

### 4. Booking & Announcement — sắp có (`FLOW-08/09`)

- **Booking** (`/bookings`): tìm chỗ trống → giữ chỗ (hold) → kiểm tra xung đột → duyệt ngoại
  lệ → xác nhận → check-in / no-show. Guardrail: lịch ở chế độ thủ công.
- **Announcement** (`/office/announcements`): soạn → chọn audience → duyệt → phát hành → xác
  nhận đã đọc (read acknowledgement) → nhắc → báo cáo chưa đọc. Guardrail: read receipt bất biến.

### 5. Tài liệu (Records) & Dữ liệu chủ (MDM) — `FLOW-10/11`

- **Records** (`/documents`, `/documents/[id]/versions`): tải bản nháp → tạo **phiên bản** →
  review → **phát hành bất biến** → phân loại/retention → audit. Một hợp đồng dữ liệu duy nhất
  (single document contract), do RECORDS_MANAGER phát hành.
- **MDM dự án** (`/projects`, `/admin/master-data/*`): import → staging → mapping → validate →
  chuẩn hóa → match → **duyệt trùng** → publish. Guardrail: **dry-run trước**, có lineage +
  cổng chống trùng; DATA_STEWARD quản lý.

## Quy tắc bất biến (nghiệp vụ)

Các nguyên tắc dưới đây áp cho **mọi** luồng, được thực thi ở FSM/service và guardrail:

- **Không chứng từ ERP giả** — thao tác thực thi diễn ra ngoài hệ thống, chỉ ghi lại **bằng
  chứng** (evidence), không tự sinh chứng từ ảo.
- **Không hardcode người duyệt/người thực hiện** — phân công giải theo **position + ủy quyền +
  fallback**, có snapshot (`/admin/assignment-resolver`).
- **Phân quyền theo vai trò** — mọi hành động re-check quyền tại nguồn; menu lọc 3 tầng.
- **Audit mọi thao tác** — mọi transition/hành động nhạy cảm ghi audit (before/after,
  correlation) — `/admin/audit`.
- **Cô lập tenant (tenant isolation)** — RLS ở tầng hàng; data scope trong ranh giới tenant.
- **AI chỉ gợi ý** — AI đề xuất (ví dụ completeness khi tạo yêu cầu), **con người xác nhận**.

## Trạng thái hiện tại (tóm tắt)

| Khối | Trạng thái | Ghi chú |
|---|---|---|
| Nền tảng (auth · RLS · Identity/Org · Authz · Backup · Records · MDM) | ✅ đã chạy | PH-00 / PH-01 hoàn tất |
| Request & Approval | ✅ đã chạy | FSM đầy đủ, seed 42 yêu cầu |
| Directive & Commitment | ✅ đã chạy | FSM 2 tầng + SLA |
| Service Desk (Ticket) | 🔵 đang hoàn thiện | core chạy; CSAT/close đang fix |
| Booking · Announcement | ⬜ sắp có | PH-02d / PH-02e |
| Records hợp nhất · MDM 50 dự án · Backup ops · UAT | ⬜ kế hoạch | PH-03 / PH-04 |

> Chi tiết version, việc đang làm và known issues: xem trang **Backlog** (`/docs/backlog`).
