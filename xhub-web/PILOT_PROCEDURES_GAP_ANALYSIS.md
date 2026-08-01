# X.Office — 12 Pilot Procedures: Gap Analysis & Adapter

Nguồn handoff: `D:/Code/handoff/Xhub/XTECH_XOFFICE_12_PILOT_PROCEDURES_HANDOFF_20260729`
Backend: `D:/Code/xhub-api` (NestJS + Prisma/Postgres, :4000). Frontend: `D:/Code/xhub-web` (:3000).
Ngày: 2026-07-29.

## 1. Đối chiếu 12 thủ tục với seed hiện có (trước khi nạp)

Backend trước đây seed **3** workflow (format nội bộ, mã `WF-*`):

| Seed cũ | Tương ứng pilot | Ghi chú |
|---|---|---|
| `WF-PROCUREMENT-250M` (Đề nghị mua sắm >200tr) | **PILOT-01** Đề nghị mua sắm | Trùng nghiệp vụ; pilot chuẩn hơn (đủ MGR→IT→FIN_CHECK→CFO→gate→CEO→MR) |
| `WF-ROOM-BOOKING` (Đặt phòng họp) | **PILOT-09** Booking phòng họp | Trùng nghiệp vụ |
| `WF-IT-TICKET` (Ticket CNTT) | **PILOT-10** Ticket CNTT | Trùng nghiệp vụ |

**Đã có (≈)**: PILOT-01, PILOT-09, PILOT-10. Gần nghiệp vụ nhưng khác mã + graph so với pilot.
**Thiếu hoàn toàn (9)**: PILOT-02 (thanh toán), PILOT-03 (tạm ứng), PILOT-04 (công tác), PILOT-05 (cấp tài sản), PILOT-06 (cấp tài khoản/quyền), PILOT-07 (tuyển dụng), PILOT-08 (yêu cầu hành chính), PILOT-11 (trình ký), PILOT-12 (báo giá/chiết khấu).

Quyết định: **regenerate cả 12 từ handoff, dùng mã PILOT-01..12** (bỏ mã `WF-*` để danh mục sạch, khớp catalog). Smoke test đổi `CODE` sang `PILOT-01`.

## 2. Khác biệt format + adapter

| Khía cạnh | Handoff (`*.workflow.json`) | Nội bộ (`WorkflowDefinitionDocument`) | Adapter làm |
|---|---|---|---|
| Metadata | `code,name,version,systemOfRecord,status` phẳng | `metadata{tenantSlug,code,name,description,ownerRoleCode}` | Gom vào `metadata`; **thêm `systemOfRecord`+`ownerSystem`+`wave`+`aiPolicy`** vào metadata |
| Node | `{id,label,type}` | `{id,type,name,config,position}` | map type (bảng dưới), `label→name`, sinh `config`, **auto-layout `position` (x = thứ tự×240, y=200)** |
| Cạnh | `transitions[{from,to,condition,idempotencyTemplate}]` | `edges[{id,source,target,label?}]` | `transitions → edges` 1:1 (đánh `e1..`) |
| Form | file `*.schema.json` riêng (RJSF + `x-ui`) | node `form` + `form-definitions.json` | **chèn node `form` (id=FORM) ngay sau START**, `config.formCode`; convert schema → form-definition |

Mapping node type: `system`(START)→`start`, `end`/END→`end`, `system`(khác)→`notification`, `approval`→`approval`, `review`→`humanTask`, `task`→`humanTask`, `condition`→`condition`, `connector`→`serviceCall`, `ai`→`aiAssist`, `timer`→`timer`.

Ghi chú kỹ thuật:
- Tất cả graph handoff **tuyến tính** (mỗi node 1 transition ra); condition 1 nhánh ra ⇒ engine luôn đi tiếp ⇒ `simulate` chạm END.
- `approval`/`humanTask` được gán `config.assignment` (heuristic theo id/label: MGR→requesterManager, CFO→ROLE_CFO, CEO→ROLE_CEO, IT→ROLE_IT_MANAGER, hành chính→ROLE_ADMIN_MANAGER, còn lại→ROLE_PROCESS_ADMIN) + `slaHours:24` ⇒ qua `validate` (approval bắt buộc có assignment).
- `serviceCall`: **PILOT-01** dùng connector thật `finerp/create_material_request` với mappings `request.*` (đúng catalog); **PILOT-09** `calendar/create_reservation`; còn lại là delegated command chung `{connectorCode=<SoR>, actionCode=submit_<node>, mappings:[]}` → mock success (action ngoài catalog ⇒ không có required ⇒ resolve OK). Mapping là **DATA trên `config`**, engine resolve runtime — không hardcode.

## 3. Mapping System of Record (gắn vào `metadata.systemOfRecord`/`ownerSystem`)

| SoR | Pilot | Ý nghĩa |
|---|---|---|
| `XOFFICE` (own) | 01, 02, 05, 06, 07, 08, 09, 10, 11 | X.Office là chủ dữ liệu |
| `FRAPPE_HR` | 03, 04 | X.Office đề xuất → Frappe HR là SoR |
| `FINERP` | 12 | X.Office đề xuất → FinERP là SoR |

(Khớp `seed/CLAUDE.md` của handoff; KHÔNG sửa file source-reference.ts / docs SoR — do agent khác quản.)

## 4. Thứ tự Wave (từ `docs/01_ROLLOUT_WAVES` + catalog)

- **Wave 1** (P0, ưu tiên nạp/demo trước): 01, 02, 05, 06, 07, 09, 10.
- **Wave 2**: 03, 04, 08, 12.
- **Wave 3**: 11 (trình ký/ký số).

`wave` được ghi vào `metadata.wave` từ catalog.

## 5. Hiện thực & Verify

- Adapter: `xhub-api/scripts/xoffice-adapt-pilots.mjs` → ghi `seed-data/xoffice/workflow-definitions.json` (12) + `form-definitions.json` (12), mirror sang `xhub-web/src/data/xoffice/` (fallback offline).
- Backend: thêm `GET /api/xoffice/forms` + `/forms/:code` (form runtime đọc từ API thay vì chỉ seed). SeedService + `workflow-instances.json` cập nhật sang mã PILOT.
- SoR lưu trong `metadata` (JSON) — **không** thêm cột Prisma (tránh migration; đủ để lộ qua `GET /:code`).
- Reset + reseed: DB = **12 workflow / 12 version / 3 instance / 3 task**.
- `tsc --noEmit` (api & web) = 0 lỗi; `nest build` xanh; `xoffice-e2e-smoke.mjs` **PASSED** (PILOT-01).
- PILOT-02 & PILOT-10 chạy trọn vòng: request → nhiều task → completed (PILOT-02 phát connector mock success; PILOT-10 toàn human task).
- Frontend `/office/workflows` liệt kê đủ 12; `/office/workflows/PILOT-01/request` render form pilot.

### Hạn chế / nợ kỹ thuật
- Command hiện lấy `tenantId`/`actorId` từ header `x-tenant-id`/`x-user-id` (default tenant-xtech/user-nam) — chưa có auth thật; `idempotencyTemplate` của handoff **chưa** được engine dùng (engine chưa idempotent theo template).
- Condition trong pilot là tuyến tính (1 nhánh) nên "gate" (>200tr, chiết khấu>10%…) **chưa rẽ nhánh thật**; đã gắn `config.expression` mẫu nhưng chỉ 1 edge ra nên luôn đi tiếp. Cần bổ sung edge nhánh + label Có/Không nếu muốn bỏ bước khi dưới ngưỡng.
- Connector ngoài catalog (Frappe HR, IdP, ký số…) chạy mock success; chưa có định nghĩa action/targetFields thật trong `connector-catalog.json`.
- `ownerRoleCode` để mặc định `ROLE_PROCESS_ADMIN` cho cả 12 (chưa map chủ quy trình theo catalog).
