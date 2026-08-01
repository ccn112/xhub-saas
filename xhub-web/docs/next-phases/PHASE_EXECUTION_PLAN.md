# PHASE_EXECUTION_PLAN — PH-00 → PH-04 (PH-05 sau Pilot)

> Docs-first, KHÔNG code. Cập nhật: 2026-07-30. Tenant: X-TECH (001), Internal Pilot.
> Nguồn: `PHASE_CATALOG.csv`, `IMPLEMENTATION_BACKLOG.csv`, `10_ACCEPTANCE_GATES.md`, `AUTOMATED_GATE_MATRIX.csv`, `01_PHASE_BY_PHASE_PLAN.md`, `CLAUDE.md` (handoff).
> Đọc kèm: `CURRENT_RELEASE_DELTA_ANALYSIS.md`, `MENU_ROUTE_DELTA_PLAN.md`, `INTERNAL_AUTH_CUTOVER_PLAN.md`, `SEED_MIGRATION_PLAN.md`, `XOFFICE_OPERATIONAL_DELTA_PLAN.md`, `DOCUMENT_MIGRATION_PLAN.md`, `X2BMS_BATCH0_DRYRUN_PLAN.md`, `BACKUP_UAT_RUNBOOK.md`.

## Thứ tự bắt buộc (handoff CLAUDE.md)
`PH-00 → PH-01 → PH-02 → PH-03 → PH-04`. **PH-05 chỉ sau Pilot** hoặc khi có sandbox ngoài. Không đảo thứ tự: mỗi phase khoá menu + màn + flow + seed + test trước khi sang phase sau.

## "Định nghĩa DONE" chung (áp cho MỌI phase)
Một phase DONE khi đủ 7 lát cắt (`00_EXECUTIVE_HANDOFF.md`) + đóng gọn màn (`03_SCREEN_CLOSURE_RULES.md`):
1. **Menu** đã sắp xếp (mục mới vào 5 workspace, role visibility đúng — xem `MENU_ROUTE_DELTA_PLAN.md`).
2. **Màn live** nối BFF, typed contract, đủ states (loading/empty/error/permission-denied/stale).
3. **Flow không phụ thuộc demo fallback trên staging.**
4. **Seed** đủ role + tình huống (manifest counts khớp, không plaintext password, không mail `.local`).
5. **Automated gate PASS** (theo `AUTOMATED_GATE_MATRIX.csv`).
6. **UAT phase PASS.**
7. **Release note + rollback.**

Gate luôn bật mọi phase: **G-01** api tsc, **G-02** web build, **G-03** `test:rls` (35 bảng), **G-12** `scan:secrets`, + "không critical demo fallback staging", **MUST_NOT_LEAK**, không dual-write, AI không tự approve/provision/merge/restore.

---

## PH-00 — Khóa baseline + Internal Auth Production
- **Thời lượng:** 2–4 ngày. **Màn:** AUTH-01..05. **Seed pack:** SEED-IDENTITY-01.
- **Mục tiêu:** đóng baseline platform-complete; bật xác thực nội bộ thật trên staging; loại header identity khỏi luồng pilot. KHÔNG Azure AD/Keycloak.
- **Backlog & trạng thái:**
  - `NX-001` Rotate Anthropic key + tag `v0.8.0-platform-complete` — **việc chủ dự án** (agent không revoke được).
  - `NX-002` Internal login/forgot/reset/select-tenant — *một phần đã có*: `POST /api/auth/login|logout`, `GET /me`, `switch-tenant`, cookie `xhub_session`, Membership; **thiếu** forgot/reset/select-tenant UI + bật enforce.
  - `NX-003` Session management + revoke — **mới** (suspend/revoke terminates session).
  - `NX-004` Auth pages Tailux polish — **mới**.
- **Thứ tự:** NX-001 → NX-002 → (NX-003, NX-004 song song).
- **Dependencies:** NX-002 phụ thuộc NX-001; là chốt chặn cho gần như toàn bộ PH-01+ (đa số NX-01x/02x `depends on NX-002`).
- **Exit gate (PHASE_CATALOG):** Login/reset/invite/session/isolation PASS; không demo identity trong staging. **G-11 `test:authz` chạy ở profile `AUTH_ENFORCE=true`.**
- **DONE:** auth pages live + revoke thật + `AUTH_ENFORCE=true`/`AUTH_ALLOW_HEADER_IDENTITY=false` trên staging + G-01/02/03/11/12 PASS + release note. Chi tiết cutover: `INTERNAL_AUTH_CUTOVER_PLAN.md`.

## PH-01 — Tenant Admin Live Closure
- **Thời lượng:** 5–7 ngày. **Màn:** TA-02,03,04,06,07,08,09,10,14. **Seed pack:** SEED-TENANT-ADMIN-01.
- **Mục tiêu:** đưa các write admin còn demo thành live; hoàn thiện role binding / delegation / data scope / assignment resolver; menu theo role. KHÔNG thêm màn admin mới nếu 15 màn đã đủ.
- **Backlog & trạng thái:**
  - `NX-010` Invitation write API — **mới** (FE form đã dựng; endpoint chưa có).
  - `NX-011` Role binding write API — **mới** (chỉ có GET role-bindings).
  - `NX-012` Delegation write API (identity/org) — **mới** (lưu ý xoffice đã có delegation cấp workflow — khác domain).
  - `NX-013` Org version/effective date/acting holder — *một phần đã có*: PATCH/POST/DELETE org-units + PATCH positions đã live; **thiếu** version hoá + effective date + acting holder.
  - `NX-014` Permission matrix + Test-as-user — *một phần*: `permissions/effective|check`, màn roles/data-scopes live-read; **thiếu** explainable matrix + test-as-user hoàn chỉnh.
  - `NX-015` Assignment resolver UI v2 — *một phần*: `assignment/preview` + màn resolver có; **thiếu** candidates/delegation/fallback snapshot v2.
  - `NX-016` Menu registry role visibility — **mới** (nav hiện grant-all demo).
- **Thứ tự:** NX-010, NX-011, NX-013 (nền) → NX-012 (cần NX-002) → NX-014 (cần NX-011) → NX-015 (cần NX-012, NX-013) → NX-016 (cần NX-014).
- **Dependencies:** toàn bộ cần NX-002 (auth). NX-015 mở khoá phần lớn PH-02 (`NX-020..028` depends NX-015).
- **Exit gate:** Không workflow Wave 1 hardcode user; allow/deny/audit/RLS PASS. **Gate: G-05 `test:controlplane`, G-11 authz.**
- **DONE:** 3 write demo (invite/role/delegation) lên live + org versioning + menu lọc theo role + `test:authz`/`test:controlplane` PASS + UAT admin + release note.

## PH-02 — XOffice Nghiệp vụ Vận hành
- **Thời lượng:** 8–12 ngày (nặng nhất). **Màn:** XO-01..XO-14. **Seed pack:** SEED-XOFFICE-OPS-01.
- **Mục tiêu:** 6 nghiệp vụ văn phòng chạy độc lập, không cần ERP/chat/calendar thật. KHÔNG mở rộng engine nếu không phục vụ trực tiếp 6 flow (Request/Approval, Directive/Commitment, Ticket, Booking, Announcement, Records attachment).
- **Backlog & trạng thái:**
  - `NX-020` Request Center + My Requests — *một phần*: `POST workflows/:code/requests`, `GET work-items`, `/inbox` live; **thiếu** `/office/requests` + `/requests` live không demo-fallback.
  - `NX-021` Comments/mentions/attachments — **mới** (backend chưa có; attachments đi qua Records API).
  - `NX-022` Supplement/return/resubmit/withdraw/cancel — *một phần*: `tasks/:id/act` cơ bản; **thiếu** state machine đầy đủ + tests.
  - `NX-023` Manual external execution + evidence — *một phần*: `external-executions/:id/reference` (no fake ERP) có; **thiếu** UI evidence hoàn chỉnh.
  - `NX-024` Task detail XH-05 live — **mới** (hiện đọc seed).
  - `NX-025` Directive/Decision/Commitment — **mới** (21 SP).
  - `NX-026` Internal Service Desk — **mới** (21 SP).
  - `NX-027` Booking resource — **mới** (13 SP).
  - `NX-028` Announcement/read acknowledgement — *một phần*: notification hạ tầng có; **thiếu** module announcement audience/report.
  - `NX-029` Seed operational data + accounts — **mới**.
- **Thứ tự:** NX-020 → NX-024 → NX-022 → NX-023 → NX-021 → (NX-025, NX-026, NX-027, NX-028 song song theo năng lực) → NX-029 (seed cuối, phủ tất cả).
- **Dependencies:** NX-020 cần NX-015 (PH-01). NX-021/022 cần NX-020. Attachments (NX-021) phụ thuộc Records API (giao thoa PH-03 — dùng `/api/records` sẵn có, KHÔNG tạo model tài liệu thứ 2).
- **Exit gate:** 7 pilot Wave 1 E2E PASS; không chứng từ ERP giả; XH-05 task detail live. **Gate: G-04 `test:smoke`, G-10 `test:condition`, G-13 visual regression, G-14 a11y.**
- **DONE:** 6 module live + seed vận hành + G-04/10/13/14 PASS + UAT nghiệp vụ + release note. Chi tiết: `XOFFICE_OPERATIONAL_DELTA_PLAN.md`.

## PH-03 — Records, Documents và Projects Live
- **Thời lượng:** 6–9 ngày. **Màn:** DOC-01,02,03, PRJ-01,02, MDM-01,02,03. **Seed pack:** SEED-RECORDS-MDM-01.
- **Mục tiêu:** hợp nhất document model; `/documents` và `/projects` về một contract + nguồn thật. Hợp nhất model TRƯỚC khi thêm tính năng.
- **Backlog & trạng thái:**
  - `NX-030` Document contract migration plan — **mới** (docs). Xem `DOCUMENT_MIGRATION_PLAN.md`.
  - `NX-031` Migrate `Document` → `RecordDocument` (giữ IDs/deep-link) — **mới**.
  - `NX-032` Documents screens unified (one API `/api/records`) — *một phần*: `/documents` đã live trên `/api/records`; **thiếu** gỡ hẳn seed `Document` cũ ở panel liên quan.
  - `NX-033` `/projects` route live từ MDM — **mới** (hiện đọc seed `collection("projects")`).
  - `NX-034` X2BMS batch0 50 import dry-run — **mới**. Xem `X2BMS_BATCH0_DRYRUN_PLAN.md`.
  - `NX-035` Duplicate review + tenant overlay — *một phần*: `duplicate-pairs/:id/resolve`, `tenant-overlays` có; **thiếu** UI review + gắn vào batch0.
- **Thứ tự:** NX-030 → NX-031 → NX-032 (nhánh document); NX-033 → NX-034 → NX-035 (nhánh project/MDM). Hai nhánh song song được.
- **Dependencies:** NX-030 cần NX-021 (attachments dùng contract chung). NX-034 cần NX-033. Dữ liệu 6.000 thật CHỈ khi có nguồn X2BMS — batch0 synthetic không publish production.
- **Exit gate:** Một document contract; 50 project dry-run đối soát được; không auto-merge fuzzy. **Gate: G-06 `test:mdm`, G-08 `test:records`.**
- **DONE:** một contract document + `/projects` từ MDM + dry-run 50 có metrics/reconciliation + duplicate review + G-06/08 PASS + UAT + release note.

## PH-04 — Backup Vận hành, Restore Drill và UAT
- **Thời lượng:** 6–8 ngày. **Màn:** BKP-01,02, RST-01, UAT-01,02. **Seed pack:** SEED-UAT-01.
- **Mục tiêu:** biến backup/restore từ nền kỹ thuật thành quy trình vận hành; hoàn thành UAT X-TECH → Pilot RC.
- **Backlog & trạng thái:**
  - `NX-040` Backup schedule/retention/alerts — **mới** (core backup đã PASS).
  - `NX-041` Restore production approval workflow (requester ≠ self-approve) — **mới** (P1).
  - `NX-042` X-TECH sandbox restore drill (MUST_NOT_LEAK PASS) — **mới**.
  - `NX-043` Mở rộng UAT U1–U40 — *một phần*: console `/docs/test` U1–U17 persist `/api/testruns`; **thiếu** U18–U40.
  - `NX-044` UAT run detail/evidence/signoff (server-persisted) — *một phần* (persist có; thiếu evidence/signoff).
  - `NX-045` Pilot RC bugfix/perf/a11y (no P0 defect) — **mới**.
- **Thứ tự:** NX-040 → NX-041 → NX-042 → NX-043 → NX-044 → NX-045.
- **Dependencies:** NX-043 cần NX-020 + NX-034 + NX-042 (UAT phủ nghiệp vụ + import + drill). NX-041 cần NX-040.
- **Exit gate:** Backup/restore drill PASS; P0 UAT 100%; MUST_NOT_LEAK/secret scan PASS. **Gate: G-07 `test:backup`.**
- **DONE:** schedule/retention/alert + restore approval + drill PASS + UAT U1–U40 P0 100% + Pilot RC không P0 + runbook + release note. Chi tiết: `BACKUP_UAT_RUNBOOK.md`.

## PH-05 — Integration-ready / Connector Live (SAU Pilot)
- Chỉ khi có sandbox ngoài + chủ đầu tư duyệt. `NX-050` Integration Monitor (outbox/DLQ/reconcile), `NX-051` FinERP/Mattermost/HR live adapters (chỉ với sandbox credentials). Gate G-09 `test:webhook`. Không nằm trong điều kiện Pilot.

---

## Dependency order tổng (rút gọn)
```
NX-001 → NX-002 ─┬─→ NX-003, NX-004                (PH-00)
                 ├─→ NX-010, NX-011 → NX-014        (PH-01)
                 ├─→ NX-013                          (PH-01)
                 └─→ NX-012 → NX-015 → NX-016        (PH-01)
NX-015 → NX-020 ─┬─→ NX-024, NX-022 → NX-023        (PH-02)
                 ├─→ NX-021 ─────────→ NX-030        (→PH-03)
                 └─→ NX-025/026/027/028 → NX-029     (PH-02)
NX-030 → NX-031 → NX-032                             (PH-03 document)
NX-033 → NX-034 → NX-035                             (PH-03 project/MDM)
NX-040 → NX-041; NX-042; (NX-020+NX-034+NX-042) → NX-043 → NX-044 → NX-045  (PH-04)
```

## Sequencing thô (giả định 1 luồng thực thi chính)
| Tuần | Phase | Trọng tâm |
|---|---|---|
| T1 | PH-00 | Auth cutover + revoke + auth pages; rotate key (chủ dự án). |
| T1–T2 | PH-01 | 3 write API (invite/role/delegation) + org versioning + menu role visibility. |
| T2–T4 | PH-02 | Request Center + XH-05 live + state machine; song song 3 module lớn (directive/service-desk/booking) + announcement; seed vận hành. |
| T4–T5 | PH-03 | Document contract migrate + `/projects`→MDM + batch0 dry-run 50 + duplicate review. |
| T5–T6 | PH-04 | Schedule/retention/approval + drill + UAT U1–U40 + Pilot RC. |

Rủi ro tiến độ lớn nhất: **PH-02** (NX-025+NX-026 = 42 SP hai module nghiệp vụ mới). Nếu trượt, cân nhắc thu hẹp scope service-desk/booking cho Wave 1 nhưng vẫn giữ 6 flow tối thiểu theo `01_PHASE_BY_PHASE_PLAN.md`.
