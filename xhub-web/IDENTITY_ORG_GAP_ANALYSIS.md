# IDENTITY & ORGANIZATION — GAP ANALYSIS

_Nguồn handoff: `D:\Code\handoff\Xhub\XTECH_XHUB_IDENTITY_ORG_TENANT_BACKUP_HANDOFF_20260729`_
_Audit read-only, cập nhật 2026-07-29. Tài liệu này KHÔNG sửa code/seed — chỉ đối chiếu & đề xuất._

## 0. Nguyên tắc bất biến (từ CLAUDE.md handoff + ADR-013/014)

- **Identity & Organization Core là SHARED PLATFORM DOMAIN của XHub**, không phải module con của XOffice. XHub/X.Space/XOffice dùng chung user, role, scope qua API/contracts (ADR-013).
- **XOffice KHÔNG sở hữu employee master.** XOffice chỉ sở hữu Workflow role, Assignment rule, Approval policy, Workflow task, Assignment resolution snapshot (docs/00, 01).
- **KHÔNG đặt credential/password/MFA secret/token trong DB XOffice hoặc XHub.** Credential là System of Record của IdP (docs/01, docs/09 OIDC).
- **KHÔNG tạo module quản lý user riêng cho từng sản phẩm.**
- **Không hardcode tên người trong workflow** — phân công theo `position / org_role / group / assignment_rule`; kết quả resolver phải **snapshot + audit**.
- Hai chế độ tenant: `STANDALONE` (XHub Org Core là nguồn) và `FEDERATED` (HRIS là nguồn + projection/overlay) — ADR-014.
- Mọi bảng tenant-scoped có `tenant_id` + **RLS policy** (Postgres), không chỉ chặn ở tầng service.

---

## 1. Hiện trạng code (evidence)

| Khía cạnh | Hiện trạng | Evidence |
|---|---|---|
| Assignment resolution | Chỉ map **roleCode → 1 userEmail** phẳng, không scope, không effective-date, không candidate list | `xhub-api/src/xoffice/xoffice.service.ts:912-917` (`resolveAssignee`); seed `xhub-api/seed-data/xoffice/role-bindings.json` |
| Role binding data | File JSON phẳng `{tenantSlug, code, name, userEmail?}` — subject luôn ngầm là USER, không có POSITION/GROUP, không `scope`/`validFrom`/`validTo` | `xhub-api/seed-data/xoffice/role-bindings.json:1-45` |
| Task assignee | `ApprovalTask.assigneeUserId` (nullable → role queue), `onBehalfOf` khi duyệt thay | `xhub-api/prisma/schema.prisma:156-181` |
| Delegation | Có model `Delegation{fromUserId,toUserId,fromAt,toAt}` + `findValidDelegate` chặn người lạ (403) | `prisma/schema.prisma:185-197`; `xoffice.service.ts:1650-1657` |
| Tenant isolation | Chặn ở **tầng service** (mọi query có `tenantId`), isolation test PASS; **CHƯA có Postgres RLS** | `xoffice.service.ts:517,969,...`; `PROJECT_STATUS_XHUB.md` §6 "RLS per-tenant Postgres chưa bật" |
| Audit resolver | Có `AuditLog` (append-only) ghi assignee khi tạo task, nhưng **KHÔNG ghi snapshot resolution đầy đủ** (input/candidates/orgVersion/policyVersion) | `prisma/schema.prisma:236-248`; `xoffice.service.ts:1507` |
| Org model | **KHÔNG có** OrgUnit / Position / ReportingLine / Group / LegalEntity / PersonProfile / EmploymentAssignment | Không tồn tại trong `prisma/schema.prisma` |
| RBAC/ABAC | **KHÔNG có** PermissionPolicy, DataScope, policy evaluation, relationship checks | Không tồn tại trong schema/service |
| Tenant mode | **KHÔNG có** STANDALONE/FEDERATED, sourceMode, ExternalIdentityReference | Không tồn tại |
| Credential | Không có credential trong DB (đúng nguyên tắc); auth hiện dùng header demo `x-user-id`/`x-tenant-id` | `PROJECT_STATUS_XHUB.md` §6 |

**Nhận định:** Tầng vận hành phân công/ủy quyền đã có phiên bản đơn giản chạy được, nhưng **model tổ chức thật chưa tồn tại**. `userEmail` đang bị dùng như khóa định danh — vi phạm quy tắc "không dùng email làm khóa bất biến; dùng internal UUID + external reference" (docs/02).

---

## 2. Đối chiếu Identity/Org model mục tiêu vs hiện có

| Thực thể mục tiêu (docs/02, contracts) | Hiện có? | Gap |
|---|---|---|
| `Tenant` | Có (`prisma:13`) | OK |
| `TenantMembership` (1 người ↔ nhiều tenant) | Không | Chưa có khái niệm membership; user chỉ là email trong seed |
| `PersonProfile` (UUID + external subject) | Không | Không có bảng người; danh tính = email chuỗi |
| `LegalEntity` / `OrgUnit` (cây `type/parent_id/path/valid_from/valid_to`) | Không | Toàn phần thiếu — contract `org-unit.schema.json` |
| `Position` (`isHead`, `reportsToPositionId`, effective date) | Không | Toàn phần thiếu — contract `position.schema.json` |
| `ReportingLine` (effective date) | Không | Thiếu — cần cho selector DIRECT_MANAGER/MANAGER_LEVEL_N |
| `EmploymentAssignment` (người ↔ position, nhiều position hiệu lực) | Không | Thiếu |
| `PlatformRole` / `RoleBinding` (subjectType USER/POSITION/GROUP + scope + effective) | Một phần | Chỉ roleCode→email; thiếu subjectType, scope, effective — contract `role-binding.schema.json` |
| `DataScope` | Không | Thiếu — nền tảng ABAC |
| `Group` / `ProcessingQueue` | Không | Thiếu — selector GROUP không dùng được |
| `DelegationPolicy` (scope, status DRAFT/ACTIVE/REVOKED/EXPIRED) | Một phần | Model `Delegation` có window nhưng thiếu `scope`, `status`, và không phải shared-core (đang nằm trong DB XOffice) — contract `delegation.schema.json` |
| `ExternalIdentityReference` | Không | Thiếu — cần cho FEDERATED |

---

## 3. Gap Assignment Resolution

Contract mục tiêu `assignment-resolution.schema.json` yêu cầu snapshot gồm: `selector`, `candidateUserIds`, `resolvedUserIds`, `delegationsApplied`, `fallbackApplied`, `policyVersion`, `orgVersion`, `auditReason`.

| Yêu cầu (docs/03) | Hiện có | Gap |
|---|---|---|
| Selector đa dạng: USER / POSITION / ORG_ROLE / DIRECT_MANAGER / MANAGER_LEVEL_N / ORG_UNIT_HEAD / GROUP / REQUEST_FIELD_USER / PROJECT_ROLE / EXPRESSION | Chỉ ORG_ROLE (roleCode) → 1 user | Thiếu 9/10 selector; đặc biệt các selector dựa org (DIRECT_MANAGER, ORG_UNIT_HEAD) bất khả thi vì chưa có org tree |
| Resolve time `RESOLVE_AT_TASK_CREATION` + snapshot đầy đủ | Resolve tại tạo task nhưng **không snapshot** input/candidate/version | Thiếu bảng `AssignmentResolution` |
| Fallback / escalation chain | Không có fallback selector | Thiếu |
| Xử lý ngoại lệ có policy (không tìm thấy / nhiều người / requester = approver / user bị khóa / delegation vòng lặp / delegate thiếu scope) | Không xử lý theo policy | Thiếu toàn bộ exception policy |
| Deterministic result | Có (find đầu tiên) nhưng dựa dữ liệu phẳng | Không deterministic khi nhiều người giữ position (chưa hỗ trợ) |

---

## 4. Gap RBAC + ABAC

Mục tiêu (docs/04): `permission = action + resource + scope + conditions`, kết hợp RBAC (role) + ABAC (tenant/legal entity/org unit/owner/classification) + relationship checks (requester/assignee/approver/manager). Phân lớp 7 loại role.

**Hiện có:** không có evaluation engine. Chỉ có kiểm tra "actor có phải assignee/ người được ủy quyền" tại `act` (`xoffice.service.ts:1650`). Không có DataScope, không có condition (vd `maxAmount`).

**Gap chính:**
- Thiếu `PermissionPolicy` (action+resource+scope+conditions).
- Thiếu DataScope filter (org unit / legal entity / classification / record sensitivity).
- Thiếu 7-layer role hierarchy (System/Tenant admin/Business/Position/Workflow/Project/Queue).
- Thiếu admin-bypass tách riêng + audit.
- AI tool chưa dùng chung permission context (yêu cầu docs/11).

---

## 5. Gap STANDALONE vs FEDERATED (ADR-014)

| | STANDALONE | FEDERATED |
|---|---|---|
| Nguồn org/position/employee | XHub Org Core | HRIS (Frappe HR/SAP/Workday/Odoo) qua SCIM/API/event |
| XHub giữ | Toàn bộ | Projection + **local overlay** (app role, data scope, queue, delegation, tenant preference, external identity mapping) |
| Hiện trạng code | Không có mode nào; dữ liệu phẳng trong seed | Không có adapter/projection/overlay |

**Gap:** thiếu `TenantMode` (sourceMode theo tenant), `ExternalIdentityReference`, SCIM-compatible endpoints, và quy trình migration Standalone→Federated (dry-run matching → map external reference → freeze master → import projection → re-resolve → switch mode, không xóa audit — docs/05).

**Định vị đúng:** Credential luôn ở IdP (OIDC) cả 2 mode; employee master ở HRIS khi Federated; role/scope/overlay luôn thuộc XHub Identity Core.

---

## 6. Đề xuất model (Prisma, shared Identity/Org Core)

Model mới cần thêm (tenant-scoped, có `tenantId` + RLS): `TenantMembership`, `PersonProfile`, `LegalEntity`, `OrgUnit` (cây type/parentId/path/validFrom/validTo), `Position` (isHead, reportsToPositionId, effective), `ReportingLine`, `EmploymentAssignment`, `PlatformRole`, `RoleBinding` (subjectType USER/POSITION/GROUP + scope + effective — thay `role-bindings.json` phẳng), `DataScope`, `Group`/`ProcessingQueue`, `DelegationPolicy` (nâng cấp `Delegation` + scope + status), `ExternalIdentityReference`, `TenantMode`, `PermissionPolicy`, và bảng snapshot `AssignmentResolution`.

**RLS Postgres đề xuất:** mỗi bảng tenant-scoped bật `ROW LEVEL SECURITY`; policy `USING (tenant_id = current_setting('app.tenant_id'))`; BFF set `app.tenant_id` từ session (không lấy tenant từ input không tin cậy — docs/11); admin-bypass qua role riêng có audit. Đây là defense-in-depth bổ sung cho chặn tầng service hiện tại.

---

## 7. Backlog

### P0 (nền tảng — bắt buộc trước khi mở rộng workflow thật)
- P0-1: Thêm Org Core models (OrgUnit/Position/ReportingLine/PersonProfile/EmploymentAssignment/TenantMembership) + seed X-TECH từ `xtech-identity-org.seed.json`.
- P0-2: RoleBinding chuẩn (subjectType + scope + effective) thay seed phẳng; PersonProfile dùng **UUID** thay email làm khóa.
- P0-3: Resolver theo POSITION/ORG_UNIT_HEAD/DIRECT_MANAGER + **snapshot `AssignmentResolution`** (input/candidates/resolved/policyVersion/orgVersion/audit).
- P0-4: Bật **Postgres RLS** cho bảng tenant-scoped + set `app.tenant_id` từ session; giữ isolation test `demo-isolation`.

### P1
- P1-1: PermissionPolicy (RBAC+ABAC) + DataScope + relationship checks + admin-bypass audit.
- P1-2: DelegationPolicy nâng cấp (scope + status + chống vòng lặp) đưa về shared core.
- P1-3: Group/ProcessingQueue + selector GROUP; fallback/escalation chain; exception policy đầy đủ.
- P1-4: AI tool dùng chung permission context.

### P2
- P2-1: TenantMode STANDALONE/FEDERATED + ExternalIdentityReference.
- P2-2: SCIM-compatible endpoints/adapters (RFC 7643/7644) + HRIS source mode.
- P2-3: Migration dry-run Standalone→Federated.
