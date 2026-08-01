# IDENTITY HUB & SHARED MDM — SYSTEM-OF-RECORD MATRIX DELTA (FND-00)

> Ai là **System of Record (SoR)** cho từng object, theo MASTER_HANDOFF.md §4 ("System of Record cốt lõi") và
> `data/SOR_MATRIX.csv`, verify lại với thực tế: object đó có SoR THẬT trong code hôm nay, hay chỉ là khái niệm
> trên giấy chờ kết nối connector thật. Ràng buộc Constitution **#3** (Credential/MFA thuộc IdP) · **#10** (không
> dual-write account/master data giữa XHub và app con) · **#11** (Shared MDM không chứa transaction ERP/X2/XBooking).

## 0. Ba lớp SoR (kế thừa khung MG-00/PE-00, áp dụng cho Identity + MDM)

1. **XHub-owned SoR** — XHub sở hữu vòng đời thật (ghi, đọc, xoá) của object.
2. **Read model / Projection** — XHub không sở hữu dữ liệu gốc, chỉ chiếu qua connector đã chứng thực.
3. **External SoR (chưa kết nối)** — hệ thống ngoài (Entra, FinERP, Frappe HR, X2-BMS, Mattermost) LẼ RA là SoR,
   nhưng **kết nối thật chưa tồn tại** — mọi "SoR ngoài" hôm nay chỉ là **mock adapter** hoặc **hằng số chuỗi**,
   không phải HTTP client thật. Đây là điểm khác biệt quan trọng nhất cần verify (§2).

## 1. Ma trận SoR — Identity

| Object | SoR theo MASTER_HANDOFF §4 / SOR_MATRIX.csv | SoR thật hôm nay (verify code) | Trạng thái kết nối | Ghi chú Constitution |
|---|---|---|---|---|
| Credential/MFA | IdP/Entra | 🟡 **IdP về mặt thiết kế, nhưng chưa có IdP thật nối vào.** `UserCredential` (`schema.prisma:990`) tồn tại cho **INTERNAL auth only** (argon2 hash, PH-00b) — dùng cho invite/activate/reset khi KHÔNG có OIDC, không phải "XHub tự làm IdP". | 🔴 Mock — `mock-oidc.provider.ts` không verify credential thật nào | #3 — XHub **không** lưu password hệ thống ngoài; `UserCredential` là password NỘI BỘ XHub cho tài khoản chưa có IdP, không vi phạm #3 (đây không phải "hệ thống ngoài") nhưng cần làm rõ trong docs để tránh hiểu lầm |
| `IdentityAccount` (= `PersonProfile`) | XHub Identity Hub | ✅ **XHub — đã đúng, đã shipped** (`schema.prisma:380`) | 🟢 Thật | — |
| `ExternalIdentity` | XHub Identity Hub (theo docs/03) | 🔴 **Không tồn tại — không ai là SoR vì object chưa được tạo** | 🔴 Chưa xây | Việc của ID-01 |
| `TenantMembership` (= `Membership`) | XHub Control Plane | ✅ **XHub — đã đúng** (`schema.prisma:355`), nhưng thiếu effective-dating | 🟢 Thật (form hẹp) | Xem Collision Map §1 |
| Employee/payroll | FinERP/Frappe HR khi kết nối | 🔴 **KHÔNG CÓ ADAPTER NÀO.** `grep -rn "FINERP\|FRAPPE" xhub-api/src` → chỉ xuất hiện như **chuỗi hằng** trong danh sách enum/comment (ví dụ `src/manage/manage.constants.ts` — nếu tồn tại — và ghi chú rải rác), không có module/client/HTTP call. | 🔴 Mock/none | SME mode (T001 tự vận hành) tạm thời là SoR tối thiểu cho employee data qua `PersonProfile` — đúng như `SOR_MATRIX.csv` ghi "SME mode may temporarily own minimum profile" |
| App local account | Application (binding/provisioning) | ✅ **Đã có desired/observed pattern (gộp) qua `AppAccountBinding` + `ProvisioningCommand`** (`controlplane.service.ts`) | 🟡 **Reconcile thật, nhưng target là MOCK adapter** (`app-adapter.service.ts` — không tạo tài khoản thật ở x1/x2/xweb) | #8, #10 — pattern đúng, target chưa thật |
| Canonical organization | XHub Shared MDM | 🔴 **Model có sẵn (`MasterRecord`), 0 dòng dữ liệu, 0 logic normalize** | 🔴 Chưa xây nội dung | MDM-02 |
| Supplier transaction | FinERP | 🔴 **Không tồn tại kết nối** — không có gì để "reference/deep-link" tới vì chưa có adapter | 🔴 Chưa xây | MDM-06 |
| Canonical project | XHub Shared MDM | ✅ **Duy nhất domain có logic thật** (`MasterRecord(domain=PROJECT)`, `mdm.normalize.ts`) | 🟢 Thật (nhưng chỉ ingest qua API thủ công `POST /api/mdm/import-jobs`, không connector tự động) | Link `ExecutionProject.canonicalProjectId` đã có field sẵn ở Work v2 (`schema.prisma:1748`) — chưa có dữ liệu nào thật sự link |
| Execution project | X.Office Work | ✅ **Đã có, ngoài phạm vi Identity/MDM** (`ExecutionProject` — Work v2) | 🟢 Thật | Không đụng — chỉ LINK |
| Inventory/price | FinERP | 🔴 Không tồn tại — không có `CanonicalProduct` nào có dữ liệu | 🔴 Chưa xây | MDM-06 |

## 2. Connector plane — trạng thái thật từng kết nối (`data/CONNECTOR_CATALOG.csv` đối chiếu code)

| Connector (handoff `CONNECTOR_CATALOG.csv`) | Domain | Trạng thái tuyên bố (`gd1=YES` nghĩa là ưu tiên GĐ1) | Trạng thái thật verify | Blocker |
|---|---|---|---|---|
| Microsoft Entra ID | IDENTITY | `gd1=YES`, `credential_required=YES` | 🔴 **Chưa nối.** `AUTH_OIDC_ENABLED=false`; chỉ có seam interface + mock. | Cần Entra tenant + client credentials (docs/28 open question chưa chốt "Entra tenant model") — **quyết định của owner, không phải việc code** |
| Mattermost/X.Space | IDENTITY | `gd1=YES` | 🔴 **Chưa có adapter thật** — `AppAdapterService` là MOCK dùng chung cho MỌI app (x1/x2/xweb), không riêng Mattermost | Cần vendor API credentials |
| X2-BMS | IDENTITY+MDM | `gd1=YES` | 🟡 **MDM ingestion nhận dữ liệu X2BMS qua seed JSON tĩnh** (`seed-data/mdm/x2bms-project-import-sample.json`), KHÔNG qua API/event thật từ hệ thống X2-BMS sống | Cần kết nối event/API thật tới X2-BMS |
| FinERP/Frappe | IDENTITY+MDM | `gd1=YES` | 🔴 **Hoàn toàn chưa có** — chỉ tên chuỗi rải rác | Cần sandbox + credentials (đúng blocker mà PE-00 đã ghi nhận cho PE-08 — **cùng một blocker, hai audit độc lập xác nhận**) |
| CSV Bridge | IDENTITY+MDM | `gd1=YES`, `credential_required=NO` | 🟡 **Có pipeline tổng quát (`ImportJob`/`SourceRecord` nhận JSON qua API), nhưng không có UI upload CSV, không có "template version + dry-run + row errors" như docs/05/24 yêu cầu** | Việc code thuần tuý (không blocker ngoài) — ưu tiên cao vì đây là connector DUY NHẤT không cần credential |

**Nhận xét quan trọng:** trong 5 connector, **CSV Bridge là connector duy nhất không có blocker bên ngoài**
(không cần credential/sandbox của bên thứ ba). Đây là tín hiệu mạnh cho việc chọn first-slice (xem
`ID_MDM_ROADMAP_REBASE.md` §2) — giống hệt cách PE-00 nhận ra "SME Lite" là mode duy nhất ship được ngay vì
không phụ thuộc FinERP/Frappe.

## 3. Quy tắc chống vi phạm #10/#11 (checklist cho mọi module ID/MDM)

- [ ] `AppAccountBinding`/`ProvisioningCommand` không bao giờ ghi trực tiếp vào DB của x1/x2/xweb — chỉ qua
      adapter (mock hôm nay, connector thật sau này), không connection string nào tới DB ứng dụng con trong
      `xhub-api` (verify: `grep -rn "postgres://\|mysql://" src/ | grep -v DATABASE_URL` → chỉ 1 kết nối, của
      chính xhub-api).
- [ ] `MasterRecord`/`SourceRecord`/`TenantMasterOverlay` không bao giờ chứa `price`/`stockQty`/`invoiceNo`/
      `PO number` — hiện tại đúng (chỉ có `canonicalFields` cho project: name/developer/type/geography).
- [ ] `CanonicalProject` (MasterRecord domain=PROJECT) không có field WBS/task/baseline — verify:
      `mdm.normalize.ts` `CanonicalProject` interface chỉ có `canonicalName/aliases/developerName/
      projectTypeCode/countryCode/provinceCode/districtCode/addressText/visibility/sourceConfidence` — **sạch**,
      không có field thực thi nào.
- [ ] Employee/payroll KHÔNG được XHub tự ý trở thành SoR vĩnh viễn khi FinERP/Frappe kết nối — `PersonProfile`
      hiện là SoR tạm thời hợp lệ CHỈ trong SME mode; khi ID-0x kết nối HRIS thật, phải chuyển
      `PersonProfile`/`Membership` sang **projection** (đọc `sourceVersion`/`syncedAt`), không giữ làm SoR song
      song — đúng pattern PE-00 đã dùng cho `LeaveBalanceSnapshot` khi chuyển `leaveMode → FRAPPE_HR`.
- [ ] Không bảng nào trong Identity/MDM có foreign connection string trực tiếp tới Entra/FinERP/Frappe/X2-BMS —
      xác nhận đúng tại thời điểm audit (0 kết quả grep).
