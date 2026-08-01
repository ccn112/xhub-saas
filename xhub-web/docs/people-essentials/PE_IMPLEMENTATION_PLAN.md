# PEOPLE ESSENTIALS — IMPLEMENTATION PLAN (PE-00 → PE-08, rebased)

> Lộ trình `docs/15_IMPLEMENTATION_PHASES.md` + `backlog/IMPLEMENTATION_BACKLOG.csv` (25 mục PE-000…PE-081)
> **rebase lên trạng thái code thật**. Kèm **khuyến nghị dứt khoát cho quyết định PE-001 (operating mode)**.
> Đọc kèm cả 7 tài liệu delta còn lại.

---

## 1. Rebase: giữ gì, đổi gì

| Điểm | Handoff nói | Sau rebase |
|---|---|---|
| Thứ tự PE-00→08 | PE-00 → Leave → Attendance → Timekeeping → Payslip → Timesheet → Performance → IOC Capacity → Connector | ✅ **GIỮ NGUYÊN** — thứ tự này hợp lý và đã được kiểm chứng: Leave là thứ duy nhất không cần input ngoài |
| MG là "MG-01→03" | ngụ ý lát mỏng | ✅ Đúng về code, nhưng **MG-03 đã HOÀN CHỈNH** → **PE-06 có bề mặt rộng hơn**: đọc được `StrategicObjective`, `MetricDefinition/Observation`, `Scorecard`, `OKRCycle/Objective/KeyResult/KeyResultCheckIn`, `DecisionRecord`, `ActionCommitment`. **Không** phải đợi MG-04+ |
| DT-04 chờ SoR capacity | đúng | ✅ **Xác nhận** — `IOC_CURRENT_STATE_DELTA` §1 ghi rõ `PositionCapacity`/`SkillCoverage` không tồn tại. **PE-07 mở khoá DT-04** |
| Namespace `/people/v1/*` | ❌ sai convention | Đổi thành `/api/people/*` (`PE_API_ROUTE_PLAN` §1) |
| `PayrollQuestion` là bảng mới | ❌ | Tái dùng `Ticket` (Collision Map §7) |
| `PeopleSyncJob` ở giai đoạn sớm | ❌ | Thu hẹp + hoãn tới PE-08 (không có adapter nào để sync) |
| 89 bảng RLS | ✅ đúng | Nhưng là **moving target** — test đọc động |
| "rotate API key" là blocker | đúng | 🔴 **VẪN CHƯA LÀM** — việc của người, không chặn PE-01 |

---

## 2. ⭐ QUYẾT ĐỊNH PE-001 — Operating mode cho T001

### Khuyến nghị: **SME Lite** (`leaveMode=XOFFICE`, `attendanceMode=FILE_IMPORT`, `payrollMode=FILE_IMPORT`)

**Nói thẳng: đây là mode DUY NHẤT ship được, không phải lựa chọn ưa thích trong ba lựa chọn ngang nhau.**

| Mode | Điều kiện cần | Trạng thái thật hôm nay |
|---|---|---|
| **Connected FinERP** | Cần adapter FinERP/Frappe HR **hoạt động** + sandbox + credentials | 🔴 **KHÔNG TỒN TẠI.** `FINERP` chỉ là **chuỗi hằng** trong `src/manage/manage.constants.ts:28` (danh sách `sourceSystem` hợp lệ) và một comment ở `src/xoffice/contracts/source-reference.ts:25`. Không có module, client, HTTP call, hay biến env nào. `FRAPPE_HR` chỉ có trong comment. Backlog `PE-080` ghi rõ *"Requires credentials"* — chưa có |
| **Excel Bridge** | Cần import engine có template version + checksum + preview + row errors + rollback (Constitution #15) | 🟡 **CHƯA CÓ.** Đó chính là **PE-02** (`PE-020`). Chọn mode này = phải build import engine **trước** khi có bất kỳ nghiệp vụ nào chạy → đi ngược "vertical slice", trì hoãn giá trị |
| **SME Lite** | Chỉ cần `PersonProfile` + `OrgUnit` + `Position` + RLS + Workflow | ✅ **ĐỦ HẾT.** Tất cả đã chạy trong production T001 |

**Lập luận bổ sung (không chỉ là "vì không còn cách khác"):**
1. **T001 (X-TECH) là tenant của chính nhà cung cấp** — `tenantClass = PLATFORM_OWNER_REFERENCE_CUSTOMER`.
   Dùng chính mình làm reference customer thì SME Lite là đúng hình dạng: quy mô nhỏ, chưa cần payroll engine.
2. **Mode có thể nâng cấp mà không phá dữ liệu.** `PeopleTenantConfig` là switch per-tenant; khi adapter
   FinERP có thật ở PE-08, đổi `leaveMode → FRAPPE_HR` và `LeaveBalanceSnapshot` chuyển từ SoR sang projection
   — schema **đã có sẵn** cột `sourceSystem`/`sourceVersion`/`syncedAt` cho việc đó (`PE_SCHEMA_PLAN` §4).
   **Không phải migrate lại.**
3. **Nó khoá được rủi ro dual-write ngay từ đầu**: guard `SOR_NOT_XOFFICE` được viết và **được test** (D6)
   ở PE-01, trước khi có connector thật để mà sai.

> 🔴 **Việc cần chủ sở hữu duyệt (không phải việc code):** chốt SME Lite cho T001, duyệt policy attendance /
> payslip / privacy, và **rotate `ANTHROPIC_API_KEY`** (fingerprint `d9d24a2d90654ea4` vẫn đang dùng thật với
> `XOFFICE_AI_LIVE=true`).

---

## 3. Lộ trình rebased

| Phase | Ước lượng | Điều kiện tiên quyết | Sản phẩm | Rủi ro / ghi chú |
|---|---|---|---|---|
| **PE-00** Rebase audit | 2–3 ngày | — | ✅ **XONG** — 8 tài liệu delta này | Không code |
| **PE-001** Chốt mode + SoR | 1 ngày | PE-00 | Owner duyệt **SME Lite** | 🔴 Chờ người. Có thể chạy song song PE-01 vì SME Lite là mặc định của schema |
| **PE-01 Leave & Availability** ⭐ | 7–10 ngày | PE-00 | 6 bảng + `src/people/*` + `/api/people/*` + BFF + 3 màn web + workspace nav + seed + smoke | **Lát dọc đầu tiên buildable.** Không phụ thuộc external nào |
| **PE-02** Attendance & Correction | 7–10 ngày | PE-01 | `WorkCalendar`/`ShiftPattern`/`ShiftAssignment`/`AttendanceEvent`(bất biến)/`AttendanceDay`/`AttendanceCorrectionRequest` + **import engine** (template version + checksum + preview + rollback) | Import engine là phần nặng nhất. Tái dùng `SECRET_FIELD_REGEX` guard đã có |
| **PE-03** Timekeeping & Lock | 8–12 ngày | PE-02 | `TimekeepingPeriod/Row/Adjustment/ExportBatch` + maker-checker lock | FSM `LOCKED` **không quay ngược** — test bất biến bắt buộc |
| **PE-04** Payslip Portal | 6–8 ngày | PE-02 | `PayrollImportBatch`/`PayslipProjection`/`PayslipReadReceipt` + luồng hỏi qua `Ticket` | 🔒 Constitution #8. Chốt cuối cùng `PayrollQuestion` reuse-vs-new tại đây |
| **PE-05** Project Timesheet | 6–8 ngày | PE-01 (không cần PE-04) | `TimeEntry`/`Timesheet` link `NativeWorkItem`/`ExecutionProject` | **Có thể chạy SONG SONG với PE-03/04** — phụ thuộc Work v2 (đã có), không phụ thuộc chấm công |
| **PE-06** Performance Bridge | 8–12 ngày | PE-05 + MG-03 (**đã có**) | `PerformanceEvidenceSnapshot`/`ManagerPerformanceReview`/`VariablePayRecommendation` | Bề mặt MG rộng hơn dự kiến (§1). AI tái dùng pattern draft-first `xoffice.service.ts` |
| **PE-07** IOC Capacity Bridge | 5–7 ngày | PE-01 (leave) + PE-02 (attendance) | `CapacitySnapshot`/`OrgUnitCapacityProjection` + `DataLayerDefinition` cho IOC | ✅ **MỞ KHOÁ DT-04.** ⚠️ Chờ agent IOC template-gallery đóng trước khi chạm `src/ioc/*` |
| **PE-08** Connector & Hardening | 8–12 ngày | 🔴 **Credentials FinERP/Frappe** | `ExternalEmployeeMapping`, `PeopleSyncJob`, adapter thật, docs/training/UAT | **Bị chặn bởi yếu tố ngoài code.** Không đưa vào đường găng |

**Tổng: 8–12 tuần** (khớp handoff), với PE-08 tách khỏi đường găng.

### Đường găng thật
```
PE-00 ✅ → PE-01 (Leave) → PE-02 (Attendance) → PE-03 (Timekeeping) → PE-04 (Payslip)
                    ↘ PE-05 (Timesheet, song song) → PE-06 (Performance)
                    ↘ PE-07 (IOC Capacity, sau PE-02) ⇒ mở khoá DT-04
PE-08 (Connector) — treo ngoài, chờ credentials
```

---

## 4. PE-01 — phân rã chi tiết (slice sẵn sàng build)

Ánh xạ backlog `PE-010 … PE-015`:

| Bước | Backlog | Việc | Gate |
|---|---|---|---|
| 1 | PE-010 | Append 6 model vào **cuối** `schema.prisma` (**sau khi agent IOC xong**) → `prisma generate` → `db push` | Schema build được |
| 2 | PE-010 | Append 6 tên bảng vào `rls-setup.mjs` **và** `rls-test.mjs` → `npm run rls:setup` | `npm run test:rls` PASS |
| 3 | PE-011 | `src/people/*`: config · leave-policy · leave-balance (append-only) · leave (FSM + idempotency) · leave-impact · availability · overtime | Unit-level qua smoke |
| 4 | PE-011 | Spawn `ApprovalTask` khi submit; ghi `AuditLog` + `OutboxEvent` **trong cùng transaction** | Assert E6, E7 |
| 5 | PE-011 | Guard `SOR_NOT_XOFFICE` theo `PeopleTenantConfig.leaveMode` | Assert D6 |
| 6 | PE-011 | 18 endpoint `/api/people/*` + `@RequirePermission` + scope check qua `DataScope` | Assert G1–G3 |
| 7 | PE-015 | `people-leave-seed.mjs` + `people-leave-reset.mjs` + `people-leave-smoke.mjs` + npm scripts | `test:people-leave` 0 failure |
| 8 | PE-012 | BFF `app/api/people/[[...path]]/route.ts` (copy khuôn `manage`) | Proxy trả đúng |
| 9 | PE-012 | Nav: append workspace `people` + 3 mục; cập nhật MENU ROLE-VISIBILITY MAP | Menu hiện đúng |
| 10 | PE-012 | 3 màn web: `/people`, `/people/leave`, `/people/team/availability` — đủ empty/loading/error/403 | Kiểm thử tay PE-U01..U09 |
| 11 | PE-013 | Chốt hợp đồng mobile (deep link + idempotency + payload) — **tài liệu, không code app** (app XHub mobile chưa tồn tại) | Doc review |
| 12 | PE-014 | `capacityDeltaHours` trong `LeaveImpactSnapshot` + event `availability.changed` (**đầu vào PE-07**) | Assert E5, E7 |
| 13 | PE-015 | Regression: `test:manage-slice`, `test:ioc-twin`, `test:smoke`, `scan:secrets` | Không vỡ gì (#13) |
| 14 | — | Cập nhật `DEV_BACKLOG.md`, `TEST_LOG.md`, `TINH_HINH_DU_AN_XHUB.md` (theo quy ước dự án) | Docs đồng bộ |

---

## 5. Rủi ro & cách giảm

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| **Xung đột file với agent IOC template-gallery** (`schema.prisma`, `navigation.model.ts`) | 🔴 Cao | **Append-only** vào cuối cả hai file; chờ agent IOC đóng trước khi ghi; `prisma generate` + `db push` một lần cho cả hai |
| `userId` ≠ `personId` | 🟡 TB | Bẫy đã gây bug ở module Ticket (`DEV_BACKLOG` known issue). Viết một helper phân giải **duy nhất** trong `src/people/`, không so sánh thẳng |
| `NativeWorkItem` không có `orgUnitId` | 🟡 TB | Join `personId → Position.holderPersonId → Position.orgUnitId` trong code (cùng cách IOC data-layer engine đã làm). Không `groupBy` ngây thơ |
| Seed dùng `org-*` thay vì `ou-*` | 🟡 TB | Đã ghi rõ id thật của T001 ở `PE_TEST_PLAN` §2 |
| Số dư sai do race condition (hai đơn cùng lúc) | 🟡 TB | Bảng append-only + `@@unique(..., sequence)` → ghi đồng thời sẽ **xung đột unique** thay vì âm thầm sai. Bọc trong transaction |
| `AUTH_ENFORCE=false` ở demo che lỗi phân quyền | 🟡 TB | Scope check nằm trong **service**, không chỉ ở guard. Smoke test G1–G3 chạy được cả khi enforcement tắt |
| Người dùng coi đơn nghỉ là "Request" | 🟢 Thấp | Đơn nghỉ **vẫn hiện** ở `/approvals` + `/inbox` nhờ `ApprovalTask` |
| Key Anthropic chưa rotate | 🔴 Cao (bảo mật) | Không chặn PE-01 (Leave không dùng AI). **Chặn PE-06** — phải rotate trước khi bật AI recommendation |

---

## 6. Điều kiện "sẵn sàng build PE-01" — checklist

- [x] Baseline handoff đã verify với repo thật (`PE_CURRENT_STATE_DELTA.md`)
- [x] 29 thực thể kiểm va chạm, 2 nghi ngờ đã giải quyết (`PE_DOMAIN_COLLISION_MAP.md`)
- [x] SoR từng object theo mode (`PE_SOR_MATRIX_DELTA.md`)
- [x] 6 model Prisma với field/index/quy ước khớp code thật (`PE_SCHEMA_PLAN.md`)
- [x] 18 endpoint + 15 quyền + BFF + event (`PE_API_ROUTE_PLAN.md`)
- [x] Workspace placement đã quyết (`PE_UI_MOBILE_PLAN.md`)
- [x] Seed + smoke + RLS `MUST_NOT_LEAK_LEAVE` (`PE_TEST_PLAN.md`)
- [ ] 🔴 Owner chốt **SME Lite** (PE-001)
- [ ] 🟡 Agent IOC template-gallery đóng phần sửa `schema.prisma` + `navigation.model.ts`

➡️ **Kết luận: PE-01 (Leave & Availability) SẴN SÀNG BUILD** ngay khi hai ô cuối được đóng.
Không có phụ thuộc kỹ thuật nào khác còn treo.
