# Document Migration Plan (PH-03)

> Mục tiêu: **một hợp đồng tài liệu duy nhất**. Di trú `Document` (seed cũ, dùng bởi các
> panel "tài liệu liên quan") sang `RecordDocument`, giữ nguyên ID/deep link, hợp nhất
> `/documents` + attachment của workflow trên `/api/records`.
> Nguồn chuẩn: handoff `docs/07_DOCUMENT_AND_PROJECT_MIGRATION.md`, `data/FLOW_CATALOG.csv`
> (FLOW-10), `SCREEN_CATALOG` (DOC-01..DOC-03), backlog **NX-030..NX-032**.
> Anh em: `XOFFICE_OPERATIONAL_DELTA_PLAN.md` (attachment tái dùng contract này),
> `SEED_MIGRATION_PLAN.md`, `CURRENT_RELEASE_DELTA_ANALYSIS.md`, `PHASE_EXECUTION_PLAN.md`.

## 1. Hợp đồng đích (verified)

`/documents` **đã live** trên `/api/records`. Backend `xhub-api/src/records/*` cung cấp
(`records.controller.ts`):

```
POST   /api/records                          tạo document
GET    /api/records                          list (?kind & subjectType & subjectId), enrich versionCount + byteSize
GET    /api/records/:id                      document + version history
POST   /api/records/:id/versions             thêm version (immutable)
GET    /api/records/:id/versions/:no/content tải nội dung version
```

Cây model đích (handoff 07):
```
RecordDocument
├── DocumentVersion        (immutable)
├── FileObjectReference
├── RecordClassification
├── RetentionPolicy
├── BusinessRecordReference (subjectType/subjectId)
└── Audit
```
FE contract: `src/features/documents/records.server.ts` (`DocumentView`/`VersionView`,
`fetchDocuments`/`fetchDocument`). Chỉ 2 màn đọc trực tiếp file này: `/documents/page.tsx`,
`/documents/[id]/page.tsx`.

## 2. Vấn đề: hai nguồn tài liệu song song

- `/documents` đọc **live** `/api/records` (RecordDocument), **nhưng fallback demo** vẫn
  suy ra từ collection seed `documents` (`records.server.ts` L96-140: `collection<SeedDoc>("documents")`,
  map `type`→`kind`, `projectId/customerId`→`subjectType/subjectId`).
- Các màn khác **vẫn đọc trực tiếp** collection seed `documents` (kiểu `Document` cũ:
  `id,title,fileName,type,size,uploadedBy,updatedAt,projectId,customerId,version`) để dựng
  panel "tài liệu liên quan".

Seed nằm ở `src/data/seed/all.seed.json`, key `documents`, truy cập qua
`collection("documents")` (`src/xhub/lib/seed.ts`). → PH-03 (NX-030) yêu cầu **một model**,
xoá nhánh `Document` cũ.

## 3. Blast radius — mọi reader của collection `documents` (grep)

14 điểm đọc `collection<...>("documents")` (đã grep toàn `src`):

| # | File | Cách dùng | Kiểu sau migration |
|---|---|---|---|
| 1 | `src/features/documents/records.server.ts` L107 | demo fallback list | thay bằng đọc `/api/records` (bỏ nhánh seed) |
| 2 | `src/features/documents/records.server.ts` L127 | demo fallback detail | như trên |
| 3 | `src/app/(app)/home/me/page.tsx` L34 | tài liệu tôi upload (`uploadedBy`) | `GET /api/records?…` theo actor |
| 4 | `src/app/(app)/inbox/[workItemId]/page.tsx` L67 | doc theo `projectId` của approval | `GET /api/records?subjectType=Project&subjectId=` |
| 5 | `src/app/(app)/projects/[projectId]/page.tsx` L43 | doc của dự án | `?subjectType=Project&subjectId=` |
| 6 | `src/app/(app)/space/channels/[slug]/customer/page.tsx` L39 | doc theo `customerId` | `?subjectType=Customer&subjectId=` |
| 7 | `src/app/(app)/space/channels/[slug]/lists/[listId]/page.tsx` L61 | 4 file gần đây | `GET /api/records` (top-N) |
| 8 | `src/app/(app)/space/channels/[slug]/overview/page.tsx` L40 | doc theo dự án | `?subjectType=Project…` |
| 9 | `src/app/(app)/space/channels/[slug]/page/page.tsx` L70, L182 | doc mới + biên bản theo id | list + `GET /api/records/:id` |
| 10 | `src/app/(app)/space/channels/[slug]/page.tsx` L53, L56 | index theo id + theo dự án | map từ `/api/records` |
| 11 | `src/app/(app)/space/channels/[slug]/threads/[threadId]/page.tsx` L59 | index tài liệu | list |
| 12 | `src/app/(app)/space/dm/[userId]/page.tsx` L50 | index tài liệu | list |
| 13 | `src/app/(app)/space/home/page.tsx` L51 | 5 doc mới nhất | list sort updatedAt |

**Blast radius = 13 màn/module** (home/me, inbox work-item, projects detail, 8 màn X.Space,
+ records.server). Không màn nào ghi vào seed `documents` — tất cả chỉ đọc → migration là
**read-path only**, rủi ro thấp nhưng phải cập nhật đồng loạt để giữ panel "tài liệu liên quan".

Lưu ý ánh xạ subject: seed cũ phân biệt `projectId` vs `customerId`; RecordDocument dùng
`subjectType` + `subjectId` (đã có sẵn trong `normalizeDoc`). Cần giữ mapping
`Project`/`Customer` khi seed sang RecordDocument.

## 4. Các bước migration (NX-031)

1. **Contract freeze (NX-030)**: chốt `RecordDocument` là model duy nhất; khai tử kiểu
   `Document` cũ trong `screen-types`. Tài liệu này = artefact của NX-030.
2. **Seed transform**: chuyển 10 bản ghi seed `documents` (`DOC-XTECH-0001..0010`, có
   `classification`, `currentVersion`, `ownerOrgUnit`) + các doc "space/project/customer"
   trong `all.seed.json` sang bản ghi RecordDocument (records service), **giữ nguyên `id`**
   và sinh `DocumentVersion` theo `currentVersion`/`version`. Map `type`→`kind`
   (`KIND_BY_TYPE`), `projectId|customerId`→`subjectType/subjectId`.
3. **Deep link không đổi**: route `/documents/[id]` giữ nguyên id cũ → link cũ vẫn mở (U27).
4. **Chuyển 13 reader** sang helper server đọc `/api/records` (mở rộng `records.server.ts`
   thêm `fetchDocumentsBySubject(subjectType, subjectId)` + `fetchRecentDocuments(n)`), bỏ
   `collection("documents")` ở component (tuân 03_SCREEN_CLOSURE_RULES: không hardcode seed).
5. **Attachment hợp nhất (NX-032)**: comment/evidence của XOffice (xem
   `XOFFICE_OPERATIONAL_DELTA_PLAN.md` §Records) và upload màn DOC dùng chung
   `POST /api/records` + `/versions`. FLOW-10 guardrail "Single contract".
6. **Xoá nhánh demo seed** trong `records.server.ts` sau khi live ổn định; giữ empty/error
   state thật thay cho demo fallback (staging: no demo — NX-020 tinh thần chung).

## 5. Màn DOC (SCREEN_CATALOG)
| Screen | Route | Trạng thái | Backlog |
|---|---|---|---|
| DOC-01 | /documents | refactor-live (single contract) | NX-032 |
| DOC-02 | /documents/[id] | refactor-live (versions/classification/audit) | NX-032 |
| DOC-03 | /documents/[id]/versions | new-live (upload/publish/compare) | NX-031/032 |

## 6. Rollback
- Migration chỉ đọc; giữ collection seed `documents` trong `all.seed.json` cho tới khi
  RecordDocument seed + 13 reader đã verify. Rollback = revert 13 reader về
  `collection("documents")` và bật lại nhánh demo fallback (còn nguyên trong git). Không
  mất dữ liệu vì `id`/deep link được bảo toàn hai chiều.
- Cổng nghiệm thu: gate **G-08 records** (`npm run test:records`) PASS, U26 (upload/publish
  version), U27 (deep link cũ sau migration) PASS.

## 7. Ranh giới handoff-vs-code
- Handoff 07 liệt kê `FileObjectReference/RecordClassification/RetentionPolicy/
  BusinessRecordReference` như thành phần model đích; code hiện expose ở mức
  document+version+subject+kind. Các thành phần classification/retention có thể đã ở tầng
  service (chưa expose qua controller) — cần xác nhận khi build DOC-02/DOC-03; nếu thiếu,
  bổ sung field, **không tạo model tài liệu thứ hai**.
