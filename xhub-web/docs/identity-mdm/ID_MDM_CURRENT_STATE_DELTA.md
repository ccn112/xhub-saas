# IDENTITY HUB & SHARED MDM — CURRENT STATE DELTA (Rebase Audit FND-00)

> Đối chiếu **giả định của handoff** `XHUB_IDENTITY_SHARED_MDM_HANDOFF_20260801` (MASTER_HANDOFF.md, README.md,
> START-HERE.md, `docs/00_CURRENT_STATE_AND_REBASE.md` và `docs/01`–`docs/30`) với **thực tế mã nguồn** tại
> `xhub-api` (NestJS + Prisma 7 + PostgreSQL) và `xhub-web` (Next.js). Nguyên tắc nguồn sự thật (kế thừa MG-00/PE-00):
> **Code/schema/test thực tế > handoff này > lịch sử.** Mọi khẳng định dưới đây verify bằng đọc file trực tiếp
> (`grep`/`Read`), không suy diễn từ tên biến. Ngày rebase: **2026-08-01**. Bộ tài liệu anh em:
> `ID_MDM_DOMAIN_COLLISION_MAP.md`, `ID_MDM_SOR_MATRIX_DELTA.md`, `ID_MDM_ROADMAP_REBASE.md`.
> Docs-first: **KHÔNG code** trong FND-00. Một agent khác đang sửa `schema.prisma`, `rls-setup.mjs`, `rls-test.mjs`,
> `navigation.model.ts`, `src/people/*`, `src/manage/*` (PE-01 Leave + MG-04 Portfolio) — mọi số liệu dưới đây
> là **snapshot tại thời điểm audit**, không phải hằng số cố định (xem §1 và §6).

## 0. TL;DR — handoff **tự nhận thức đúng** hơn MG/PE handoff, nhưng đánh giá thấp mức độ đã xây

Khác hẳn với handoff MOS (lỗi thời nặng, phải viết lại toàn bộ) và gần giống cách tiếp cận thận trọng của handoff
People Essentials, handoff Identity/MDM này **tự đóng dấu "Audit" cho mọi dòng** ở `docs/00` — bảng collision map
của chính nó để trống cột "Gap"/"Quyết định" và nói thẳng "Không dùng handoff để áp model mới mù quáng". Đây là
điểm cộng lớn: handoff không giả vờ biết trạng thái code. Nhưng khi verify từng khẳng định nền:

| Claim của handoff | Nguồn | Thực tế verify được | Phán quyết |
|---|---|---|---|
| "Identity/Org Core... đã có foundation" (README, `docs/00`) | MASTER_HANDOFF, `docs/00` | ✅ **ĐÚNG — và SÂU HƠN mô tả.** `PersonProfile/OrgUnit/Position/PositionAssignment/Group/RoleBinding/PermissionPolicy/DataScope/AssignmentResolution` đã có RBAC+ABAC, resolver đa selector (POSITION/ORG_UNIT_HEAD/DIRECT_MANAGER/ROLE/GROUP), và **API ghi đầy đủ** (xem §2). | ĐÚNG nhưng **understate mức độ hoàn thiện** |
| "App Account Registry / provisioning... đã có foundation" (`docs/00`, ENTITY_CATALOG `AUDIT_EXISTING_BINDING`) | `docs/00`, ENTITY_CATALOG.csv | ✅ **ĐÚNG — gần trùng khớp desired/observed pattern của docs/07** (`TenantApplicationInstance`/`AppAccountBinding`/`AppRoleMapping`/`ProvisioningCommand`/`ProvisioningConflict` + `reconcile()` thật). Xem §3. | ĐÚNG, understate |
| "Shared MDM, ingestion, dedup no-auto-merge foundation" (`docs/00`) | `docs/00`, `docs/09` ("Use current MasterRecord/overlay foundation") | ✅ **ĐÚNG cho pipeline** (staging→normalized→matched→reviewed→committed, human-only merge) — nhưng **CHỈ chạy cho `domain=PROJECT`**. Không có logic normalize/match cho ORG/PRODUCT. Xem §4. | ĐÚNG nhưng **phạm vi hẹp hơn nhiều** so với ngụ ý "foundation" tổng quát |
| "OIDC seam nhưng chưa nối Entra production" (`docs/00`) | `docs/00` | ✅ **ĐÚNG, khớp chính xác.** `AUTH_OIDC_ENABLED=false`; `src/auth/oidc/` chỉ có interface (`oidc.provider.ts`) + `mock-oidc.provider.ts`. Xem §5. | ĐÚNG — hiếm khi một claim khớp 100% |
| Constitution #4 "external identity key = issuer + subject" | Constitution, `contracts/external-identity.schema.json` | 🔴 **CHƯA TỒN TẠI Ở BẤT KỲ ĐÂU.** `OidcClaims{sub,email,name}` không có `issuer`. Không có bảng `ExternalIdentity`. `PersonProfile.externalIdRefs` là Json rời rạc `{userId, hrisEmployeeNo}`, không có khoá composite issuer+subject, không unique index. Xem §5. | Constitution đúng, **code hiện tại vi phạm #4 vì chưa xây, không phải vì làm sai** — ID-01 (`ID-001`) là việc thật, đúng ưu tiên P0 |
| Source doc "invitations/role-bindings ghi/delegations ghi... còn thiếu" (P2 backlog, theo trích xuất từ `source/TINH_HINH_DU_AN_XHUB_20260801.md`) | source doc trong gói handoff | 🔴 **SAI — code đã có đủ.** `POST/DELETE /api/identity/role-bindings`, `/role-bindings/preview`, `POST/DELETE /api/identity/delegations` **đã implement với guardrail đầy đủ** (overlap/cycle/self-delegation check + audit) — `identity.controller.ts:141-190`, `identity.service.ts:457-582`. `POST /api/auth/invite` cũng đã có — `auth.controller.ts:67`. | **Code thắng — claim "còn thiếu" đã lỗi thời** |
| "Global identity / TenantMembership foundation" cần audit tên (Constitution #2 nhắc `TenantMembership`) | Constitution #2, ENTITY_CATALOG (`TenantMembership: REUSE_EXISTING`) | ⚠️ **KHÔNG có model tên `TenantMembership`.** Model thật là **`Membership`** (`schema.prisma:355`), khác hẳn field-shape so với `contracts/tenant-membership.schema.json` (thiếu `validFrom/validTo/revision`, `status` là string tự do chứ không phải enum `INVITED/ACTIVE/SUSPENDED/OFFBOARDED`, khoá theo `userId` — chuỗi id phiên đăng nhập cũ — không phải `identityAccountId`). | **Naming mismatch xác nhận đúng như Constitution cảnh báo — chi tiết ở Collision Map §2 |
| `IdentityAccount` là "global principal reference" (`docs/03`, ENTITY_CATALOG `AUDIT_EXISTING`) | `docs/03`, ENTITY_CATALOG | 🔴 **KHÔNG tồn tại model nào tên `IdentityAccount`.** `PersonProfile` (`schema.prisma:380`) đã đóng vai trò này cho principal loại HUMAN — không có khái niệm `ServicePrincipal`/SERVICE accountType nào. | AUDIT_EXISTING → kết luận: **PersonProfile chính là nó**, không tạo bảng mới (Collision Map §1) |
| RLS "89 bảng" (số kế thừa từ audit PE-00 hai chu kỳ trước, KHÔNG phải số do handoff này tự nêu — handoff này không nêu con số) | audit trước (PE-00), không phải handoff hiện tại | ⚠️ **ĐÃ THAY ĐỔI — hiện tại 98.** Đếm trực tiếp `TENANT_TABLES` trong cả `rls-setup.mjs` và `rls-test.mjs` (parse mảng, không ước lượng): **98 phần tử ở cả hai file, khớp nhau** (không phát hiện lệch giữa hai file tại thời điểm audit). Nguyên nhân tăng từ 89→98: agent PE-01 (+6: `PeopleTenantConfig`…`OvertimeRequest`) và agent MG-04 (+3: `Initiative/Portfolio/BenefitProfile`) đang chạy song song. Xem §6. | Số liệu là **moving target**, không hardcode |
| Tổng model Prisma "104" (kế thừa từ PE-00) | audit trước (PE-00) | ⚠️ **ĐÃ THAY ĐỔI — hiện tại 113** (đếm bằng `grep '^model '`). | Moving target, xem §6 |
| Nav "5 workspaces" (comment cũ) / "9 mục" (PE-00 đã sửa) | code comment cũ / PE-00 | ⚠️ **ĐÃ THAY ĐỔI LẦN NỮA — hiện tại 10 mục top-level** (`home, manage, work, space, office, business, people, platform, delivery, ioc`) — `people` vừa được agent PE-01 thêm. Xem §7. | Moving target |

## 1. Nguồn baseline handoff tự khai — đối chiếu (docs/00 §"Baseline được xác nhận")

`docs/00_CURRENT_STATE_AND_REBASE.md` liệt kê baseline rồi để **collision map trống** ("Audit" cho mọi dòng —
Global identity/External identity/Membership/App binding/Master record/Tenant overlay/Source mapping/Match
candidate). Đây chính xác là những gì FND-00 phải điền — bảng dưới là kết quả điền đó (chi tiết đầy đủ ở
`ID_MDM_DOMAIN_COLLISION_MAP.md`):

| Concept (handoff) | Model/Service hiện tại (verify) | Gap | Quyết định sơ bộ |
|---|---|---|---|
| Global identity (`IdentityAccount`) | `PersonProfile` — `schema.prisma:380` | Không có `accountType`/`ServicePrincipal` | REUSE (PersonProfile = IdentityAccount cho HUMAN) |
| External identity | *(không tồn tại)* | Toàn bộ — không bảng, không issuer trong `OidcClaims` | ADD-NEW (greenfield thật, đúng P0) |
| Membership | `Membership` — `schema.prisma:355` | Thiếu effective-dating/revision/status enum; khoá `userId` không phải `personId` | REUSE + additive columns |
| App binding | `AppAccountBinding` — `schema.prisma:588` | Thiếu cột `desiredState`/`observedState` tách bạch (hiện dùng 1 `status`) | REUSE + additive columns |
| Master record | `MasterRecord` — `schema.prisma:692` | `domain` chỉ có dữ liệu thật cho `PROJECT`; `GEOGRAPHY` có 2 dòng cứng, không versioning | REUSE (typed extension) |
| Tenant overlay | `TenantMasterOverlay` — `schema.prisma:742` | Thiếu `relationshipType` (SUPPLIER/CUSTOMER/…) — có thể nhét vào `overlayFields` Json | REUSE overlay pattern |
| Source mapping | `SourceRecord` — `schema.prisma:716` | Field name khác (`sourceSystem` vs `sourceSystemId`, `rawHash` vs `payloadChecksum`) — ngữ nghĩa khớp | REUSE |
| Match candidate | `DuplicatePair` — `schema.prisma:779` | State machine chỉ có `pending/merge/keep_separate`, handoff muốn `OPEN/LINKED/CREATED_NEW/MERGED/REJECTED/DEFERRED` (6 state) | REUSE + mở rộng enum quyết định ở MDM-05 |

## 2. Identity/Org Core — code reality (module `src/identity`)

Đã shipped **đầy đủ hơn** những gì `docs/00` mô tả bằng một câu ngắn:

- **Models** (`schema.prisma:380-534`): `PersonProfile`, `OrgUnit`, `Position`, `PositionAssignment` (lịch sử
  holder PRIMARY/ACTING theo effective window), `Group`, `RoleBinding`, `PermissionPolicy` (RBAC + ABAC
  `condition.maxAmount`), `DataScope`, `AssignmentResolution` (snapshot bất biến mỗi lần resolve).
- **Service** (`identity.service.ts`, 761 dòng): org tree, reparent với cycle-guard, RBAC/ABAC `effectivePermissions()`
  + `can()` (wildcard-aware qua `permissionMatches`), **role-binding write** (`createRoleBinding`/`deleteRoleBinding`/
  `previewRoleBinding` — dòng 452-526, có validate roleCode tồn tại trong registry + subject tồn tại + audit),
  **delegation write** (`createDelegation`/`deleteDelegation` — dòng 528-582, guard self-delegation/overlap/cycle),
  **position assignment** history đầy đủ (PRIMARY/ACTING, auto-close overlap, holder cache re-sync — dòng 584-760).
- **Resolver** (`assignment-resolver.service.ts`): 5 selector type (`POSITION/ORG_UNIT_HEAD/DIRECT_MANAGER/ROLE/GROUP`)
  + fallback chain + choice policy (SINGLE/MULTIPLE/QUEUE), ghi `AssignmentResolution` bất biến cho mọi lần chạy —
  **đây chính là engine `docs/03`'s "workflow resolve đúng vị trí/quyền" của ID-REF-01 muốn, đã có sẵn.**
- **Controller** (`identity.controller.ts`, 20 endpoint): org-units CRUD, positions + assignment history CRUD,
  role-bindings CRUD + preview, delegations CRUD, `permissions/effective`, `permissions/check`, `me/nav-permissions`,
  `assignment/preview`. Tất cả `@UseInterceptors(TenantScopeInterceptor)` (RLS-scoped).

**Kết luận:** ID-01 "Identity domain closure" **KHÔNG cần xây lại domain Identity/Org** — domain này đã đóng.
Việc thật của ID-01 là: (a) đóng `ExternalIdentity` (issuer+subject — §5), (b) làm giàu `Membership` (effective
dating — §1), (c) chuẩn hoá state machine `PENDING_LINK → ACTIVE → SUSPENDED → OFFBOARDED` mà `docs/03` muốn
(hiện `Membership.status` chỉ có `'active'|'suspended'`, `PersonProfile.status` chỉ có
`'active'|'suspended'|'left'` — chưa có `PENDING_LINK`/`OFFBOARDED`/`CONFLICT`).

## 3. App Account Registry & Provisioning — code reality (module `src/controlplane`)

`docs/07`'s desired-state pipeline (`Entitlement → ProvisioningCommand → connector → observed state →
AppAccountBinding → reconcile`) **đã tồn tại gần như nguyên văn**:

- **Models** (`schema.prisma:558-665`): `ApplicationDefinition` (platform catalog, không RLS — đúng như comment
  dòng 14 của file: "ApplicationDefinition is a platform catalog — NOT tenant-scoped — so it is intentionally NOT
  listed" trong `rls-setup.mjs`), `TenantApplicationInstance`, `AppAccountBinding`, `AppRoleMapping`,
  `ProvisioningCommand` (outbox + `CommandLog`-style idempotency qua `@@unique([tenantId, idempotencyKey])`),
  `ProvisioningConflict` (conflict center).
- **Service** (`controlplane.service.ts`, 614 dòng): `createBinding()` với **idempotent replay** (dòng 315-334),
  conflict detection khi binding đã active (dòng 354-392, không phải "silent overwrite"), `executeCommand()` qua
  **mock adapter** (`app-adapter.service.ts` — deterministic externalAccountId, conflict/transient-failure injection
  qua flag rõ ràng, không hidden behavior), `retryCommand()`, và **`reconcile()` thật** (dòng 571-613: so khớp
  bindings active vs commands completed, phát hiện `active_binding_without_completed_command` và
  `completed_command_without_active_binding`).
- **Gap thật so với `docs/07`:** (a) không có cột `desiredState`/`observedState` tách bạch trên
  `AppAccountBinding` — hiện dùng một `status` gộp (`pending|active|suspended|conflict|failed`); (b)
  `ProvisioningCommand.action` chỉ có 3 giá trị tự do (`create_account|update_roles|suspend`), thiếu
  `deprovision`/`reinstate`/`reconcile` mà `contracts/provisioning-command.schema.json` liệt kê
  (`PROVISION/UPDATE/SUSPEND/REINSTATE/DEPROVISION/RECONCILE`); (c) không có `ProvisioningJob/Step` phân tách —
  hiện `ProvisioningCommand` gộp cả role của job lẫn step.

**Kết luận:** ID-04 "App Account Registry & provisioning" **~70% đã xây**. Việc còn lại là additive
(tách desiredState/observedState, mở rộng action enum, thêm dead-letter sau N lần retry) — **không phải xây mới
từ đầu** như README ngụ ý.

## 4. Shared MDM ingestion — code reality (module `src/mdm`), nhưng hẹp hơn "foundation" ngụ ý

`docs/09` giả định "Use current MasterRecord/overlay foundation where semantically correct" — **đúng nhưng
phạm vi hẹp hơn nhiều** so với ngụ ý một "Shared MDM foundation" tổng quát cho mọi domain:

- **Models** (`schema.prisma:692-813`): `MasterRecord` (`tenantId=null`→shared, `domain: PROJECT|GEOGRAPHY|ORG|...`
  tự do, `status: DRAFT|ACTIVE|MERGED|RETIRED`), `SourceRecord` (lineage bất biến, idempotent theo
  `(tenantId,sourceSystem,sourceId)`), `TenantMasterOverlay`, `ImportJob` (stage
  `staging→normalized→matched→reviewed→committed`), `DuplicatePair` (`decision: pending|merge|keep_separate`,
  KHÔNG BAO GIỜ auto-merge — verify `mdm.service.ts:274-354`).
- **Pipeline** (`mdm.service.ts`, `runImport()` dòng 69-226): staging → normalize → rule-based exact match
  (`canonicalKeyForProject`) → group theo key → primary/duplicate split → propose `DuplicatePair` cho phần dư.
  `commitJob()` (dòng 248-270) **từ chối commit khi còn `DuplicatePair` pending** — đúng Constitution #14
  ("Fuzzy matching chỉ tạo candidate; không auto-merge").
- ⚠️ **Giới hạn quan trọng: TOÀN BỘ logic normalize/match trong `mdm.normalize.ts` là PROJECT-SPECIFIC.**
  `normalizeProject()`, `canonicalKeyForProject()`, `duplicateScore()` đọc field `developerName`, `projectTypeCode`,
  `provinceCode`, `districtCode` — không có hàm tương đương cho tổ chức (mã số thuế, tên pháp lý) hay sản phẩm
  (SKU, GTIN, category). **Chỉ 1/5 domain của ENTITY_CATALOG (`PROJECT`) có logic ingestion thật; `GEOGRAPHY` chỉ
  có 2 dòng seed cứng** (`geo-hanoi`, `geo-namtuliem` — `mdm.service.ts:460-480`) **không có version/effective
  date/predecessor/successor** như Constitution #16 yêu cầu. `ORG`/`PRODUCT` chưa có bất kỳ dòng dữ liệu nào.
- 🔴 **KHÔNG có UI frontend nào tiêu thụ `/api/mdm/*`.** `grep -rn "api/mdm" xhub-web/src/app` → 0 kết quả.
  Route `/projects` trong nav (nhãn "Dự án (MDM)") thực ra đọc `collection<Project>("projects")` — **seed tĩnh
  cũ, hoàn toàn không liên quan đến `MasterRecord`** (`xhub-web/src/app/(app)/projects/page.tsx:12-13`, field
  `managerName/openTasks/milestoneCount` không tồn tại trong `MasterRecord.canonicalFields`). Đây là một
  **misleading label giống hệt kiểu phát hiện của PE-00 (nav comment "5 workspaces" lỗi thời)** — nhãn nav nói
  MDM nhưng nội dung trang không phải MDM.

**Kết luận:** MDM-02 (Party/Organization/Supplier) và MDM-04 (Product/Service) **KHÔNG thể chỉ "bật thêm domain"**
— cần viết mới hàm normalize/match cho từng domain (việc thật, không phải cấu hình), cộng thêm **toàn bộ UI
steward review** (duyệt trùng lặp, xem lineage, publish overlay) là greenfield 100% cho FE.

## 5. Auth / OIDC seam — code reality (module `src/auth`)

- `oidc.provider.ts`: interface thuần (`OidcClaims{sub,email?,name?}`, `OidcProvider{getAuthorizationUrl,
  exchangeCode}`) — **không có `issuer`/`iss` field nào trong `OidcClaims`.**
- `mock-oidc.provider.ts`: **implementation duy nhất**, không gọi mạng, mã hoá `mock:<userId-or-email>` thành
  "code" giả, decode thẳng thành claims. Không verify signature/nonce/state/audience (đúng — vì đây là mock,
  không phải bug).
- `.env.example`: `AUTH_OIDC_ENABLED=false`; `AUTH_OIDC_ISSUER=` (rỗng nhưng biến đã có sẵn — seam đã dự trù cho
  issuer ở cấp connection, không phải ở cấp claims).
- `AuthService` (`auth.service.ts`): login qua `Membership` (khoá `userId`, không phải `PersonProfile.id`),
  session JWT `{sub:userId, tenant, roles}`, `sessionMembershipActive()` cho revoke-on-suspend.
  **Không có bất kỳ bảng nào lưu external-identity link** — `PersonProfile.externalIdRefs` (Json, ví dụ
  `{userId, hrisEmployeeNo}`) là chỗ gần nhất nhưng không có unique index, không `issuer`, không `status`.

**Kết luận:** Constitution #4 ("External identity key là `issuer + subject`") **chưa được implement ở đâu cả** —
đây là gap thật 100%, và backlog `ID-001` (P0, "Close ExternalIdentity issuer+subject model") của chính handoff
đã đúng khi xếp việc này ưu tiên cao nhất. `docs/00`'s claim "OIDC seam nhưng chưa nối Entra production" là
**claim chính xác nhất trong toàn bộ handoff** — hiếm khi một baseline claim khớp code 100%.

## 6. Con số nền — đếm trực tiếp, không ước lượng (thời điểm audit 2026-08-01)

| Số liệu | Cách đếm | Kết quả | Ghi chú |
|---|---|---|---|
| Tổng model Prisma | `grep -c '^model ' schema.prisma` | **113** | PE-00 (2 audit trước) đo được 104; tăng do PE-01 (+6) và MG-04 (+3) đang chạy song song ngay lúc audit này |
| Bảng RLS (`rls-setup.mjs`) | parse mảng `TENANT_TABLES` | **98** | Khớp với `rls-test.mjs` (không lệch — cả hai file cùng 98 phần tử) |
| Bảng RLS (`rls-test.mjs`) | parse mảng `TENANT_TABLES` | **98** | — |
| Model KHÔNG RLS (platform/shared) | `models − TENANT_TABLES` | **15**: `Tenant, WorkflowVersion, WorkflowNode, WorkflowEdge, ApplicationDefinition, MasterRecord, BackupSchedule, TenantLaunch, TenantLaunchStep, Blueprint, SeedPack, SubscriptionPlan, GoLiveChecklistTemplate, TenantGoLive, IocTemplate` | `MasterRecord` **cố ý** không RLS (shared/global canonical, comment `schema.prisma:677-681`) |
| Contract JSON Schema trong `contracts/` | `ls contracts/*.schema.json \| wc -l` | **17** | Task ban đầu ước lượng "18" — số thật là 17, không có file thứ 18 nào bị thiếu |

⚠️ **Không hardcode 98/113 trong bất kỳ tài liệu/test nào của ID_MDM** — đọc động từ `TENANT_TABLES.length` /
`schema.prisma` giống khuyến nghị PE-00 §1.

## 7. Nav / UI — trạng thái thực

`XHUB_NAVIGATION` (`xhub-web/src/xhub/nav/navigation.model.ts`) hiện có **10 mục top-level**:
`home, manage, work, space, office, business, people, platform, delivery, ioc` — `people` vừa được agent PE-01
thêm đồng thời với audit này (không có trong audit PE-00 hai chu kỳ trước, lúc đó là 9 mục). Route Identity đã
tồn tại dưới `admin.*`: `/admin/organization`, `/admin/positions`, `/admin/roles`, `/admin/data-scopes`,
`/admin/delegations`, `/admin/assignment-resolver`, `/admin/users`, `/admin/audit` — **đây chính là UI Identity
Hub hiện tại**, không phải một `/identity/*` namespace riêng như `docs/21` đề xuất. `/apps` là App Catalog UI
(tiêu thụ `ApplicationDefinition`). **Không có UI nào cho MDM** (`/projects` là legacy, xem §4).

## 8. Kết luận FND-00 (current-state)

1. Identity/Org Core, RBAC/ABAC, resolver, App Account Registry/provisioning, MDM ingestion pipeline — **đều đã
   tồn tại thật**, sâu hơn handoff mô tả. FND-00 không cần "khép kín" các domain này từ đầu.
2. Khoảng trống thật, đúng như backlog `ID-001` xác định: `ExternalIdentity` (issuer+subject) — 100% greenfield.
3. Khoảng trống thật thứ hai: logic normalize/match cho `ORG`/`PRODUCT` domain trong MDM — pipeline có sẵn,
   nhưng hàm chuẩn hoá theo domain phải viết mới (không "bật cấu hình" được).
4. Khoảng trống thứ ba: toàn bộ UI MDM (steward review, duplicate resolution, publish overlay) — 0% tồn tại.
5. Một claim "còn thiếu" trong tài liệu nguồn của handoff đã **lỗi thời** (role-binding/delegation write) — code
   đã có, verify trực tiếp `identity.controller.ts`.
6. Mọi con số (RLS/model count) là **snapshot di động** do có agent khác đang chạy song song — không hardcode.
