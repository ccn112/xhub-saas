# DATA-04 — Project Supply & Vendor Graph — Readiness Audit

**Ngày:** 2026-08-08
**Nguồn:** `DATA04_OFFICIAL_AGENT_RESEARCH_PACKAGE_20260808` — nối DATA-01+02+03 vào dự án thật.

## 1. Baseline thật

`01_DATA04_MASTER.xlsx`, đã đọc trực tiếp:

| Sheet | Rows |
|---|---|
| `01_Project Supply Graph` (edge chính) | 85 |
| `02_Project Candidates` | 81 |
| `03_Project Hierarchy` | 14 |
| `04_Installed Products` | 27 |
| `05_Service Contractors` | 39 |
| `06_Operator Relations` | 19 |
| `07_Contract Intelligence` | 22 |
| `08_Gap Queue` | 10 |
| `09_Evidence Sources` | 40 |

## 2. Sự thật quan trọng nhất — đã verify, không phải bug

Doc tự nói rõ: **KHÔNG tự bịa `xhub_project_id`** — cả 81 candidate đều ở trạng thái `PENDING_XHUB_MATCH`.

Đã kiểm tra trực tiếp: **không có "Hapulico" nào trong 81 candidate** (Hapulico là `GlobalProject` DUY NHẤT đã seed tới giờ). Nghĩa là **0/81 sẽ match được dự án thật** trong pass này — đây là kết quả đúng/trung thực (giống hệt caveat "chỉ Hapulico" đã lặp lại ở DATA-01/02/03), không phải lỗi. Nhưng theo luật "không dòng nào được biến mất" của chính doc này, cả 81+85+14+10 dòng vẫn phải lưu bền vững kèm trạng thái rõ ràng — không phải "insert 0 dòng rồi im lặng".

## 3. Quyết định schema — không tái dùng thẳng `ProjectOrganizationRelation`/`ProjectInstalledProduct`

Hai bảng đó (xây cho DATA-01/02/03) bắt buộc `globalProjectId` NOT NULL — đúng cho nguyên tắc "chỉ commit khi match thật". DATA-04 cần một chỗ ở TẠM cho dữ liệu CHƯA match:

- `ProjectCandidate` — 81 dự án chưa resolve, `matchStatus` + `matchedGlobalProjectId` nullable (FK `GlobalProject`, null cho tới khi match thật).
- `ProjectGraphEdge` — 85 edge, trỏ `ProjectCandidate` (không trỏ thẳng `GlobalProject`), có `organizationId`/`productId` nullable (resolve được thì set, không thì giữ `rawProviderName` text).
- `ProjectHierarchyRelation` — 14 dòng, parent/child đều trỏ `ProjectCandidate`.
- `ProjectSupplyGap` — 10 dòng "known unknown" (vd Hope Garden: có CCTV nhưng chưa biết hãng).

Khi Wave C chạy xong (6.000 dự án thật), 1 script matcher sau này chạy lại trên `ProjectCandidate` để set `matchedGlobalProjectId` thật, rồi mới materialize sang `ProjectOrganizationRelation`/`ProjectInstalledProduct`. Pass này chỉ chứng minh pipeline chạy đúng + giữ đủ 100% dòng nguồn.

## 4. Tái dùng entity resolution

`Provider / Supplier` trong edge sheet đã trùng tên với org đã có ở DATA-01/02/03 hôm nay (vd "Mitsubishi Elevator Vietnam", "Hawee M&E", "BEE HOME") — resolve bằng match tên chuẩn hoá (giống `normalizeVi` đã dùng xuyên suốt hôm nay) trước khi lưu `rawProviderName` fallback.

## Gate check (rút gọn cho Wave A)
- ✅ Nguồn xác nhận: Excel đọc trực tiếp, khớp số liệu doc công bố (85/81/14/10/40).
- ✅ Xác nhận 0/81 match Hapulico — không giả vờ đã map xong.

## 5. Kết quả thực thi (`npm run seed:data04` + `test:data04`, 2026-08-08)

```
DATA04_BASELINE_SEED_OK | {"candidates":81,"edges":85,"edgesResolvedToOrganization":34,
"edgesResolvedToProduct":3,"hierarchyRelations":8,"hierarchyRelationsSkippedUnresolved":6,
"gaps":10,"gapsSkippedUnresolved":0,"matchedToRealProject":0}
DATA04_SMOKE_OK (8/8 checks passed)
```

- 81 `ProjectCandidate` + 85 `ProjectGraphEdge` + 10 `ProjectSupplyGap` — đúng 100% số dòng nguồn, không dòng nào biến mất.
- 34/85 edge resolve được `organizationId` thật (tái dùng Organization đã có từ DATA-01/02/03 qua match tên chuẩn hoá); 51/85 còn lại giữ `rawProviderName` — không ép link, không bịa.
- 3/85 edge resolve thêm được `productId` (EquipmentProduct) khi org đã resolve và model/product tên khớp.
- `ProjectHierarchyRelation`: 8/14 resolve được (cả parent lẫn child đều là 1 trong 81 candidate); 6 dòng còn lại bị skip có log rõ lý do — parent chỉ xuất hiện dưới dạng tên tham chiếu (vd "Vinhomes Central Park", "Ciputra / Nam Thang Long") chứ không phải chính nó là 1 trong 81 candidate — đây là đặc điểm dữ liệu nguồn, không phải lỗi import.
- 0/81 candidate match được `GlobalProject` thật — đúng như dự đoán, không giả vờ.
- Script: `scripts/data04-baseline-seed.mjs` (idempotent qua `candidateCode` unique), `scripts/data04-reset.mjs`, `scripts/data04-smoke.mjs` (`npm run seed:data04` / `reset:data04` / `test:data04`).

## 6. Read API — `GET api/catalog/projects/:id/supply-graph`

Thêm vào `ProjectCatalogService`/`ProjectCatalogController` (không tạo module riêng — cùng chỗ với `getNearby`/`getProviders`, doc §16 X2 projection contract). Trả về các `ProjectCandidate` đã `matchedGlobalProjectId = :id` kèm `edges`/`gaps` của chúng; project chưa có candidate nào match thì trả mảng rỗng + `note` giải thích rõ tại sao (không phải lỗi, không im lặng).

Verify qua `scripts/verify-task27.mjs` (cùng kiểu app-context như `verify-task23.mjs`, tránh né PlatformAppModule đang bị chặn bởi bug prisma) — gọi `getSupplyGraph('BDS-PJ158')` (Hapulico) trên DB thật: `matchedCandidateCount=0`, `edges=[]`, `gaps=[]`, có `note`, unknown id → 404. 6/6 assertion pass.
- ✅ Schema mới không đụng bảng DATA-01/02/03 đã có, chỉ thêm 1 lớp "candidate" ở giữa.
