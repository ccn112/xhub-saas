# IDENTITY HUB & SHARED MDM — ROADMAP REBASE (FND-00 → ID-01..05 → MDM-01..06 → FND-01)

> Rebase roadmap của handoff (`docs/22_IMPLEMENTATION_ROADMAP_GD1.md`, `data/IMPLEMENTATION_BACKLOG.csv` — 25 mục
> FND-00x/ID-00x/MDM-00x) lên trạng thái code thật (`ID_MDM_CURRENT_STATE_DELTA.md`,
> `ID_MDM_DOMAIN_COLLISION_MAP.md`, `ID_MDM_SOR_MATRIX_DELTA.md`). Docs-first — **KHÔNG code ở FND-00.**

## 0. Rebase: bỏ gì, giữ gì, LINK-not-build ở đâu

| Điểm | Handoff nói | Sau rebase |
|---|---|---|
| Thứ tự FND-00→ID-01..05→MDM-01..06→FND-01 | Song song sau FND-00 (MASTER_HANDOFF §6) | ✅ **GIỮ NGUYÊN thứ tự phase**, nhưng nội dung từng phase co lại đáng kể — xem §1 |
| ID-01 "Identity domain closure" | Ngụ ý cần đóng domain Identity từ đầu | ❌ **KHÔNG — domain đã đóng.** `PersonProfile/OrgUnit/Position/PositionAssignment/RoleBinding/PermissionPolicy/DataScope/Delegation/AssignmentResolution` đã shipped đầy đủ kể cả API ghi. ID-01 thật chỉ còn: `ExternalIdentity` (mới), effective-dating cho `Membership` (additive), chuẩn hoá state `PENDING_LINK/OFFBOARDED` (additive) |
| ID-04 "App Account Registry & provisioning" | Ngụ ý xây desired/observed + reconcile từ đầu | ❌ **KHÔNG — pattern đã có ~70%.** `TenantApplicationInstance/AppAccountBinding/AppRoleMapping/ProvisioningCommand/ProvisioningConflict` + `reconcile()` thật đã chạy. Việc thật: tách `desiredState`/`observedState`, mở rộng `action` enum, thêm dead-letter |
| MDM-01 "Metadata Registry + Geography" | Ngụ ý xây registry mới | 🟡 **REUSE `MasterRecord`(domain=GEOGRAPHY) — LINK không build lại physical table**, nhưng nội dung (version/predecessor/successor) và registry thật (ISO/IEC 11179 concept/value-domain) là greenfield 100% |
| MDM-02 "Party/Organization/Supplier" | Ngụ ý xây model mới | 🟡 **REUSE `MasterRecord`+`TenantMasterOverlay` — LINK, không build bảng mới.** Việc thật (ADD-NEW) là logic normalize/match theo domain ORG + toàn bộ UI steward |
| MDM-03 "Canonical Project/Location" | Ngụ ý xây từ đầu | ❌ **PHẦN LỚN ĐÃ CÓ.** Domain `PROJECT` là domain DUY NHẤT đã có pipeline normalize/match/dedup thật, tested (`test:mdm`). Việc còn lại: liên kết geography/org thật (hiện chỉ string tự do), UI |
| MDM-06 "FinERP/X2 reference connectors" | Ngụ ý xây connector | 🔴 **Blocked bởi yếu tố ngoài code** (không sandbox/credentials FinERP/Frappe — giống hệt blocker PE-08 mà PE-00 đã ghi nhận). Không đưa vào đường găng |
| README "Identity JML + Supplier MDM là 2 reference slice đầu" | Cả hai chạy song song | ⚠️ **Cần tách rõ: phần "backbone" (schema/service) của cả hai chạy song song được; phần "end-to-end demo" của Identity JML bị chặn bởi quyết định Entra tenant (owner), còn Supplier MDM end-to-end demo được KHÔNG cần chờ ai** — xem §2 |

## 1. Các phase (rebased)

| Phase | Handoff giao | Trạng thái sau rebase | Hành động cụ thể |
|---|---|---|---|
| **FND-00** Rebase audit | 8 tài liệu, docs-only | **ĐANG LÀM** = 4 tài liệu này (`ID_MDM_CURRENT_STATE_DELTA`, `ID_MDM_DOMAIN_COLLISION_MAP`, `ID_MDM_SOR_MATRIX_DELTA`, `ID_MDM_ROADMAP_REBASE`) | Không code. Chờ duyệt trước khi mở ID-01/MDM-01 |
| **ID-01** Identity domain closure | Đóng domain Identity | **Thu hẹp mạnh** | Chỉ: (a) `ExternalIdentity{providerType,issuer,subject,status,claimsVersion}` + `@@unique([providerType,issuer,subject])`; (b) additive `validFrom/validTo/revision` lên `Membership`; (c) giải quyết `userId` vs `personId` (cột `personId` additive + backfill); (d) chuẩn hoá `status` state machine `PENDING_LINK→ACTIVE→SUSPENDED→OFFBOARDED` |
| **ID-02** Entra OIDC production | Nối Entra thật | **Không đổi phạm vi, nhưng phụ thuộc owner decision** | Viết adapter thật thay `MockOidcProvider` (DI swap, `oidc.provider.ts` đã seam-ready). **Chờ**: Entra tenant + client credentials (docs/28 open question #1) — việc của owner, không phải code |
| **ID-03** Lifecycle/import/SCIM | JML + SCIM + CSV import | **Giữ nguyên phạm vi** | JML state machine dùng `Membership`/`PersonProfile` đã EXTEND ở ID-01. CSV Bridge import — **không blocker ngoài, có thể làm sớm** (xem SoR Matrix §2) |
| **ID-04** App Account Registry & provisioning | Đóng registry | **Thu hẹp mạnh — chỉ additive** | Tách `desiredState`/`observedState` trên `AppAccountBinding`; mở rộng `ProvisioningCommand.action` (`deprovision`/`reinstate`/`reconcile`); KHÔNG cần `ProvisioningJob/Step` riêng cho GĐ1 (over-engineering nếu volume thấp — `ProvisioningCommand` hiện đủ) |
| **ID-05** Mattermost/X2 reference connectors | Connector thật | **Blocked bởi credential** | Cùng lớp rủi ro như MDM-06 — không đường găng nếu chưa có credential Mattermost |
| **MDM-01** Metadata Registry + Geography | Registry mới | **REUSE MasterRecord, nội dung mới** | Version-aware geography service; registry ISO/IEC 11179 (Concept/ValueDomain/CodeSet) — **ADD-NEW thật**, không có model tương đương nào hôm nay |
| **MDM-02** Party/Organization/Supplier | Model mới | **REUSE MasterRecord/TenantMasterOverlay, logic + UI mới** | `normalizeOrganization()`/match theo mã số thuế; UI steward review (0% tồn tại hôm nay) |
| **MDM-03** Canonical Project/Location | Xây mới | **Phần lớn đã có — chỉ link + UI** | Link `geographyUnitId`/`developerOrganizationId` thật (hiện string tự do); build UI (không có UI MDM nào hôm nay, kể cả cho PROJECT domain đã hoạt động ở backend) |
| **MDM-04** Product/Service Catalog | Model mới | **REUSE MasterRecord, logic + UI mới** | `normalizeProduct()`/match theo GTIN/category |
| **MDM-05** Stewardship/Quality/Lineage | — | **ADD-NEW thật (MergeDecision, DataQualityResult)** | Không trùng bảng nào — an toàn để thêm. Mở rộng enum `DuplicatePair.decision` |
| **MDM-06** FinERP/X2 reference connectors | Connector thật | **Blocked bởi credential** | Không đường găng |
| **FND-01** Security/observability/pilot | Hardening | **Giữ nguyên** | OTel, security review, UAT T001, isolation test T002 |

## 2. ⭐ Recommended FIRST vertical slice — Supplier MDM trước, Identity JML backbone song song

README của handoff nói: *"Thực hiện hai reference slice: Identity Joiner–Mover–Leaver và Supplier MDM"* — không
phân biệt cái nào trước. Sau rebase, câu trả lời **không phải "cả hai cùng lúc bằng nhau"** mà là:

### Lập luận

1. **Identity JML end-to-end (ID-REF-01) có một bước KHÔNG THỂ hoàn thành bằng code**: bước 3 của
   `examples/flows/identity-reference-journey.md` là *"User signs in through Entra"* — điều này cần một Entra
   tenant + client credentials thật. `docs/28` liệt kê "Entra tenant model" là **open question chưa chốt bởi
   owner**. Đây là **đúng cùng một lớp blocker** mà PE-00 xác nhận cho PE-08 (FinERP/Frappe credentials) và
   MG-00 không gặp phải (Management OS không cần credential ngoài). **Hai audit độc lập (PE-00, ID_MDM FND-00)
   giờ xác nhận cùng một loại rủi ro: mọi slice cần credential IdP/ERP thật đều bị chặn bởi quyết định owner,
   không phải năng lực code.**
2. **Supplier MDM end-to-end (MDM-REF-01) KHÔNG có bước nào cần credential ngoài để demo được TRỌN VẸN hôm
   nay**: `POST /api/mdm/import-jobs` nhận `sourceSystem` là **string tự do** — không cần kết nối FinERP thật để
   chạy toàn bộ pipeline (staging→normalize→match→dedup→steward decision→commit→overlay) với dữ liệu giả lập có
   cấu trúc y hệt FinERP thật (đúng cách `x2bms-project-import-sample.json` đang mô phỏng X2BMS cho domain
   PROJECT). Chỉ có bước 7 "purchase/invoice transaction stays in FinERP" là bên ngoài phạm vi demo (đúng — vì
   theo Constitution #11, transaction đó **không bao giờ nên vào Shared MDM**).
3. **Backend pipeline cho Supplier MDM chỉ thiếu 2 thứ, cả hai đều thuần code**: (a) hàm
   `normalizeOrganization()`/`canonicalKeyForOrganization()` (tương tự `normalizeProject()` đã có, không phải
   thiết kế mới — chỉ đổi field input), (b) UI steward review (0% tồn tại — nhưng đây là công việc UI thuần,
   không phụ thuộc ai). Identity JML's `ExternalIdentity` cũng thuần code, nhưng **giá trị demo đầy đủ của nó bị
   khoá bởi credential**, còn giá trị demo của Supplier MDM thì không.
4. **Rủi ro "làm slice sai thứ tự"**: nếu ưu tiên Identity JML trước, sau khi xây xong `ExternalIdentity` +
   effective-dating, đội vẫn KHÔNG THỂ demo trọn vẹn "login qua Entra thật" cho tới khi owner chốt Entra tenant
   — tạo cảm giác "đã code xong nhưng vẫn treo", giống hệt tình huống PE-01 (Leave) phải chọn SME Lite thay vì
   chờ FinERP.

### Khuyến nghị cụ thể

| Track | Việc | Có thể demo trọn vẹn ngay không? |
|---|---|---|
| **Supplier MDM (MDM-REF-01)** ⭐ ưu tiên slice đầu | `normalizeOrganization()` + `TenantMasterOverlay(relationshipType=SUPPLIER)` + UI steward review + UI request form deep-link tới overlay | ✅ **CÓ — không phụ thuộc credential ngoài nào.** Dùng seed giả lập FinERP giống cách `x2bms-project-import-sample.json` mô phỏng X2BMS |
| **Identity JML backbone (ID-REF-01, phần schema/service)** — chạy song song | `ExternalIdentity` model + effective-dating `Membership` + state machine | ✅ Có thể xây và TEST song song (unique constraint, conflict detection) mà **không cần Entra thật** — dùng `MockOidcProvider` NHƯNG sửa nó để trả về một `issuer` giả (`mock://xhub-dev-idp`) thay vì bỏ trống, để `ExternalIdentity` được test đầy đủ vòng đời trước khi có Entra thật |
| **Identity JML full demo ("login qua Entra thật")** — TÁCH RA, gắn với ID-02 | Adapter Entra thật thay `MockOidcProvider` | 🔴 **KHÔNG — chờ owner chốt Entra tenant + credentials** (docs/28 open question #1). Không đưa vào Sprint 1 |

**Kết luận:** Chạy **Supplier MDM làm slice trình diễn đầu tiên trọn vẹn** (vì không bị chặn bởi ai), đồng thời
xây **Identity JML backbone** song song ngay (ExternalIdentity + effective-dating là additive, an toàn, không
phụ thuộc ai) — nhưng **tách riêng "login qua Entra thật" thành tiêu chí của ID-02, không phải tiêu chí demo
Sprint 1 của ID-REF-01**. Đây chính là tinh thần "no big-bang" của Constitution/MASTER_HANDOFF §7, áp dụng
tương tự cách PE-00 chọn SME Lite làm mode ship-được-ngay thay vì chờ FinERP.

## 3. Rủi ro & giảm thiểu

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Xung đột file với agent PE-01/MG-04 đang chạy song song (`schema.prisma`, `rls-setup.mjs`, `rls-test.mjs`) | 🔴 Cao | **Append-only** vào cuối cả hai file, sau khi agent PE-01/MG-04 đóng. Không hardcode số RLS/model hiện tại (98/113) trong test — đọc động |
| `userId` vs `personId` trong `Membership` lan sang `ExternalIdentity` | 🟡 TB | Giải quyết ở ID-01 bước đầu tiên, TRƯỚC khi tạo `ExternalIdentity.personId` — nếu không, gap này nhân đôi |
| MDM ingestion pipeline hiện chỉ test cho domain PROJECT (`test:mdm`) — thêm domain ORG/PRODUCT có thể vỡ giả định ẩn trong `mdm.normalize.ts` (hard-code field project) | 🟡 TB | Viết `normalizeOrganization()`/`normalizeProduct()` như module **riêng**, không sửa `normalizeProject()` hiện có; `MdmService.runImport()` cần refactor nhỏ để nhận normalize-function theo `domain` thay vì gọi cứng `normalizeProject()` |
| Nav/`navigation.model.ts` đang bị PE-01 sửa (thêm `people`) | 🟡 TB | Không đụng `navigation.model.ts` cho tới khi PE-01 đóng; khi MDM-02/03 cần UI, **append-only** một mục hoặc submenu mới, không sửa 10 mục hiện có |
| Entra tenant/credential là quyết định owner, không phải việc kỹ thuật | 🔴 Cao (ngoài tầm code) | Không chặn ID-01 (backbone). Chỉ chặn ID-02 full-demo và ID-REF-01 acceptance criterion cuối cùng |
| FinERP/Frappe credential (giống PE-08) | 🔴 Cao (ngoài tầm code) | Không chặn MDM-01→05. Chỉ chặn MDM-06 |

## 4. Checklist "sẵn sàng mở ID-01/MDM-01"

- [x] Baseline handoff verify với code thật (`ID_MDM_CURRENT_STATE_DELTA.md`)
- [x] Collision map cho 9 thực thể cốt lõi + entity phụ (`ID_MDM_DOMAIN_COLLISION_MAP.md`)
- [x] SoR matrix + connector plane thật (`ID_MDM_SOR_MATRIX_DELTA.md`)
- [x] First-slice recommendation với lập luận (§2 tài liệu này)
- [ ] 🔴 Owner quyết định Entra tenant model (docs/28 open question #1) — không chặn backbone, chỉ chặn ID-02 full-demo
- [ ] 🟡 Agent PE-01/MG-04 đóng phần sửa `schema.prisma`/`rls-setup.mjs`/`rls-test.mjs`/`navigation.model.ts`
- [ ] 🔴 4 tài liệu FND-00 này được duyệt (theo `START-HERE.md`: "Chỉ code sau khi tám tài liệu delta được duyệt"
      — lưu ý handoff gốc liệt kê 8 tài liệu bao gồm cả Schema/API/UI/Test plan; 4 tài liệu ở đây là
      **Current State Delta + Domain Collision Map + SoR Matrix + Roadmap Rebase**, tương đương phạm vi task
      được giao. Schema/API-Event/UI-Route/Test plan chi tiết là bước kế tiếp sau khi 4 tài liệu này được duyệt)

➡️ **Kết luận FND-00**: Identity/Org Core và App Account Registry đã đóng phần lớn — không cần "closure" lớn
như tên phase ngụ ý. Việc thật của ID-01..05 nhỏ hơn nhiều so với ấn tượng đọc handoff. MDM-01..05 có nhiều việc
thật hơn (logic normalize/match theo domain mới + toàn bộ UI), nhưng đều REUSE bảng vật lý sẵn có, không có
bảng nào cần tạo trùng nghĩa. Slice trình diễn đầu tiên nên là **Supplier MDM**, không phải Identity JML full
end-to-end — vì Supplier MDM không có blocker bên ngoài nào, còn Identity JML's "real Entra login" acceptance
criterion phụ thuộc quyết định owner chưa có.
