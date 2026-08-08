# XHUB GEO / PROJECT / PROVIDER MASTER
## Handoff triển khai đồng bộ 6.000 dự án từ X2 → XHub, thu thập POI/Provider và cấp API cho App Cư dân

**Ngày:** 2026-08-08  
**Đối tượng thực thi:** Claude Code / team XHub + X2  
**Mục tiêu:** đưa danh mục ~6.000 dự án bất động sản đang nằm/seeding ở X2 về XHub làm master công khai dùng chung; xây kho Geo/Place/Provider/Catalog/Price dùng chung; X2 và App Cư dân thừa hưởng qua API mà không shared DB, không dual-write.

---

# 0. QUYẾT ĐỊNH KIẾN TRÚC BẮT BUỘC

## 0.1. Phân biệt hai khái niệm "Dự án"

Không được gộp hai loại sau thành một bảng/SoR:

### A. `Global Project Catalog`
Danh mục ~6.000 dự án bất động sản công khai dùng cho:
- khám phá dự án;
- trang public;
- dữ liệu vị trí;
- tiện ích xung quanh;
- thông tin thị trường;
- liên kết X1/X2/XHub;
- AI/location intelligence.

**System of Record mới: XHub.**

### B. `Managed Property / Operational Project`
Dự án/tòa/khu đang được một tenant dùng X2 để vận hành:
- building hierarchy;
- tầng/căn hộ;
- cư dân;
- BQL;
- phí/công nợ;
- phản ánh;
- tiện ích đặt chỗ;
- access;
- handover;
- community.

**System of Record tiếp tục là X2.**

Một Operational Project của X2 có thể link tới một Global Project của XHub:

```text
XHub GlobalProject
       1
       │
       │ xhub_project_id
       ▼
X2 ManagedProject / Building Context
```

Không chuyển cư dân/căn hộ/phí sang XHub trong task này.

## 0.2. Không shared database / không dual-write

Giữ nguyên nguyên tắc hệ sinh thái:
- XHub DB riêng;
- X2 DB riêng;
- không foreign key vật lý xuyên DB;
- không transaction ghi đồng thời hai DB;
- giao tiếp bằng API + event/outbox + projection/cache;
- mọi mapping dùng immutable external ID.

## 0.3. XHub sở hữu các master mới

XHub là SoR cho:
- Global Project Catalog;
- project geolocation/boundary;
- Place/POI Master;
- Provider/Merchant Master;
- provider locations;
- provider contacts/social;
- product/service catalog public;
- observed price / price history;
- taxonomy dùng chung;
- data source lineage;
- freshness/confidence;
- project ↔ place/provider spatial relation.

X2 chỉ:
- lưu `xhub_project_id` cho project đang vận hành;
- giữ projection/cache tối thiểu nếu cần;
- expose Resident BFF API;
- không tự sở hữu lại Provider Master.

---

# 1. MỤC TIÊU NGHIỆP VỤ

Sau triển khai phải đạt được hành trình:

```text
~6.000 project hiện đang seed ở X2
        │
        │ migrate + reconcile
        ▼
XHub Global Project Master
        │
        ├── Project geometry / lat lng / boundary
        │
        ├── FSQ OS Places
        ├── Overture Places
        ├── OSM Vietnam extract
        └── Website/Social enrichment
                 │
                 ▼
        Place / Provider Master
                 │
                 ├── contact
                 ├── website/social
                 ├── products/services
                 ├── prices/history
                 └── freshness/confidence
                 │
                 ▼
        Spatial join project <= 3km
                 │
                 ▼
       XHub Discovery API
                 │
                 ▼
       X2 Resident BFF API
                 │
                 ▼
             Flutter App
```

Resident use case:

```text
Cư dân đang ở căn A1208
→ X2 biết managed_project_id
→ map sang xhub_project_id
→ gọi XHub Nearby API
→ trả về các nhóm:
   - Nội khu
   - Gần cổng
   - Đi bộ
   - Lân cận <= 3km
→ xem provider
→ xem dịch vụ/sản phẩm/giá
→ gọi điện / website / Facebook / đặt dịch vụ nếu partner
```

---

# 2. PHASE 0 — AUDIT SOURCE THẬT TRƯỚC KHI CODE

Claude phải audit cả hai repo trước, không giả định table name/schema.

## 2.1. Audit X2

Tìm toàn bộ nguồn của ~6.000 dự án:

```text
- migrations
- models
- seeders
- factories
- import scripts
- public project APIs
- Flutter DTO/repository
- public project search/detail
- source fields từ batdongsan.com.vn
```

Phải xuất báo cáo:

```text
docs/geo-migration/X2_PROJECT_CATALOG_AUDIT.md
```

Báo cáo tối thiểu:

```text
table/model thực tế
số record thực tế
duplicate count
null lat/lng count
null address count
province/district coverage
source URL/source ID coverage
image coverage
developer/investor coverage
project status coverage
API nào đang đọc
Flutter màn nào đang dùng
field nào là public catalog
field nào là X2 operational
```

Không tin con số "6.000" cho tới khi query DB/repo xác nhận.

## 2.2. Audit XHub

Xác nhận:
- NestJS module structure;
- Prisma schema hiện tại;
- PostgreSQL DB `xhub`;
- MDM patterns đã có;
- ingestion/dedup pattern đã có;
- transactional outbox hiện có;
- RLS/tenant handling;
- API/BFF route conventions;
- migration mechanism;
- CI tests;
- current `/projects` implementation.

Xuất:

```text
docs/geo-migration/XHUB_GEO_READINESS_AUDIT.md
```

## 2.3. Gate Phase 0

Không tạo migration mới trước khi có:
- source table confirmed;
- current project API inventory;
- SoR matrix;
- data sample 100 records;
- duplicate/null report;
- rollback plan.

---

# 3. DATA MODEL XHUB

Tên cuối cùng phải theo convention repo thật; schema dưới là logical contract.

## 3.1. Global projects

```text
global_projects
---------------
id                      UUID/ULID
code                    unique canonical code
slug
name
normalized_name
project_type
status
description
address_text
province_code
district_code
ward_code
latitude
longitude
geom                    geography(Point,4326)
boundary_geom           geography(MultiPolygon,4326) nullable
developer_name
developer_id             nullable
website                  nullable
source_quality_score
data_confidence
freshness_score
last_verified_at
is_public
created_at
updated_at
```

Không nhồi operational X2 fields như apartment count đang dùng vận hành, resident IDs, billing config vào đây nếu chúng là transaction/runtime của X2.

## 3.2. Project source lineage

```text
global_project_sources
----------------------
id
global_project_id
source_type              x2_seed | batdongsan | manual | partner | other
source_system
source_record_id
source_url
source_payload_json
source_hash
observed_at
import_job_id
is_current
```

Bắt buộc giữ lại ID X2 cũ và nếu có ID/url Batdongsan.

## 3.3. Mapping X2 ↔ XHub

Trong XHub:

```text
external_entity_links
---------------------
system                   X2
entity_type              project
external_id
canonical_id             global_project_id
status
linked_at
```

Trong X2 thêm additive field/table:

```text
xhub_project_links
------------------
x2_project_id
xhub_project_id
link_status
linked_at
last_synced_at
source_version
```

Không đổi primary key cũ của X2.

---

# 4. GEO / PLACE / PROVIDER DOMAIN

## 4.1. Places

```text
places
------
id
canonical_name
normalized_name
primary_category_id
latitude
longitude
geom
address_text
province_code
district_code
ward_code
phone_primary
website_primary
email_primary
operating_status
date_opened
date_closed
data_confidence
freshness_score
last_observed_at
last_verified_at
is_public
```

`Place` = địa điểm thực tế.
Không mặc định Place = Provider.

## 4.2. Place sources

```text
place_sources
-------------
id
place_id
source
source_place_id
source_url
source_payload_json
source_hash
source_observed_at
source_refreshed_at
license_code
confidence
status
```

Nguồn:
- `fsq_os`
- `overture`
- `osm`
- `official_website`
- `official_social`
- `merchant_claim`
- `bql_verified`
- `manual`

## 4.3. Provider

```text
providers
---------
id
legal_name               nullable
display_name
normalized_name
provider_type
verification_status
claim_status
partner_status
tax_code                 nullable
website
email
phone
description
logo_asset_id
data_confidence
last_verified_at
```

Lifecycle chuẩn:

```text
DISCOVERED
→ VERIFIED
→ CLAIMED
→ PARTNER
```

`DISCOVERED` chỉ là dữ liệu public.
`PARTNER` mới được bật booking/payment/voucher/commission.

## 4.4. Provider locations

```text
provider_locations
------------------
id
provider_id
place_id
location_name
address
lat/lng/geom
phone
opening_hours_json
is_primary
status
```

Một chuỗi WinMart/Circle K có nhiều location, không tạo provider khác nhau cho từng cửa hàng nếu entity matching xác định cùng chain.

## 4.5. Contacts / socials

```text
provider_contacts
-----------------
provider_id
location_id nullable
type        phone|email|website|facebook|zalo|instagram|tiktok|youtube
value
source_id
observed_at
verified_at
confidence
is_primary
```

Không overwrite khi hai nguồn mâu thuẫn.
Giữ nhiều candidate + confidence.

## 4.6. Products / services

```text
catalog_items
-------------
id
provider_id
item_type               product|service
category_id
name
description
brand
sku_external
unit
image
status
```

## 4.7. Price observations

Không lưu một cột `price` duy nhất trong product.

```text
catalog_price_observations
--------------------------
id
catalog_item_id
provider_location_id nullable
price_vnd_integer
original_price_vnd_integer nullable
unit
currency                 VND
valid_from nullable
valid_until nullable
source_id
source_url
observed_at
confidence
is_promotional
```

Giữ lịch sử để biết giá mới/cũ.

---

# 5. TAXONOMY DÙNG CHUNG

Tạo taxonomy XHub, không cho App phụ thuộc category ID của FSQ/OSM/Overture.

Minimum groups:

```text
food_drink
grocery
supermarket_market
education
healthcare
pharmacy
beauty_hair
laundry
home_cleaning
home_repair
sports_fitness
kids_childcare
pets
vehicle_services
ev_charging_fuel
bank_atm
logistics_delivery
shopping
entertainment
public_service
real_estate_service
```

Bảng mapping:

```text
external_category_mappings
--------------------------
source
external_category_id
external_category_name
xhub_category_id
confidence
mapping_version
```

Version taxonomy, không hardcode trong Flutter.

---

# 6. MIGRATE 6.000 PROJECT TỪ X2 SANG XHUB

## 6.1. Không "move rồi delete"

Lần đầu làm theo pattern:

```text
SNAPSHOT
→ STAGING
→ NORMALIZE
→ DEDUPE
→ LOAD XHUB
→ MAP BACK TO X2
→ SHADOW READ
→ CUTOVER
→ RETAIN OLD DATA
```

Không xóa project seed ở X2 ngay.

## 6.2. Export snapshot X2

Tạo command read-only, ví dụ theo convention repo:

```text
php artisan xhub:export-project-catalog --output=...
```

Output:
- NDJSON hoặc Parquet/CSV có schema version;
- checksum;
- exported_at;
- source DB/release version;
- row count.

Mỗi record phải có:
- old X2 ID;
- source original ID/url nếu có;
- all public catalog fields;
- coordinates;
- images;
- timestamps.

## 6.3. XHub staging

```text
stg_x2_projects
stg_x2_project_images
stg_x2_project_sources
```

Staging không phải API production.

Validation:
- reject invalid lat/lng;
- normalize Unicode;
- trim phone/url;
- normalize province/district;
- detect duplicate source IDs;
- detect impossible geolocation.

## 6.4. Dedupe project

Matching score gợi ý:

```text
same original source id       1.00
same x2 source id             1.00
normalized name               0.30
address similarity            0.20
developer similarity          0.10
distance/geospatial           0.25
website/domain                0.15
```

Không auto-merge nếu confidence dưới threshold.
Tạo review queue.

## 6.5. Backfill mapping vào X2

Sau khi XHub canonical IDs đã ổn định:

```text
XHub export/link API
→ X2 xhub_project_links
```

Acceptance:
- mọi project public X2 có canonical mapping hoặc explicit exception;
- không orphan;
- mapping idempotent;
- rerun không sinh duplicate.

## 6.6. Cutover public project read

Các màn public của App đang có ~6.000 project không được đổi thẳng trong một lần.

Triển khai feature flag:

```text
PUBLIC_PROJECT_CATALOG_SOURCE=x2|xhub_shadow|xhub
```

Mode:
1. `x2`: hiện trạng.
2. `xhub_shadow`: user vẫn đọc X2, background compare response XHub.
3. `xhub`: XHub canonical.

Shadow compare các field quan trọng:
- ID mapping;
- name;
- address;
- lat/lng;
- image;
- province;
- detail availability.

---

# 7. DATA INGESTION — POI / PROVIDER

## 7.1. Nguồn chính

### FSQ OS Places
Dùng bản Open Source.
Điểm cần code theo tài liệu hiện hành:
- access qua Foursquare Places Portal;
- token;
- Iceberg catalog;
- Places + Categories + Deltas;
- monthly release;
- xử lý delta theo thứ tự:
  `add → update → merge → remove`.

Không code theo public S3 legacy cũ.

### Overture Places
Dùng GeoParquet.
Query theo geographic area / bbox.
Không cần tải toàn cầu.

### OpenStreetMap
Dùng Vietnam extract (`.osm.pbf`) / replication.
Không dùng public Nominatim để quét systematic toàn quốc.

## 7.2. Chiến lược không ingest thừa

Không cần lấy toàn bộ POI thế giới.

Tạo AOI:

```text
union(
  buffer(global_project.geom, 3000m)
)
```

Hoặc chia tile/H3/geohash.

Chỉ ingest POI Việt Nam giao với:
- buffer 3km của ít nhất một project;
- cộng một buffer mở rộng 5km cho hospital/school/TTCM nếu policy bật.

Lưu `ingestion_area_version`.

## 7.3. Raw source tables

Không map thẳng raw → canonical.

```text
raw_fsq_places
raw_overture_places
raw_osm_pois
```

Mỗi raw record:
- source ID;
- raw payload;
- source version;
- fetched/imported time;
- spatial key;
- hash.

## 7.4. Normalize

```text
raw
→ normalized_place_candidate
→ entity_match
→ canonical place
```

Chuẩn hóa:
- name;
- Vietnamese diacritics for search, nhưng giữ original;
- phone E.164/candidate;
- URL/domain;
- address components;
- social handles;
- category;
- operating status.

## 7.5. Dedupe place

Score khởi điểm:

```text
distance                35%
normalized_name         25%
phone                   15%
website/domain          10%
address                  10%
category                  5%
```

Hard signals:
- same phone + near location;
- same domain + near location;
- exact source bridge/GERS nếu có.

Mọi auto-merge phải:
- lưu match evidence;
- reversible;
- có audit;
- không mất source record.

---

# 8. ENRICHMENT CONTACT / WEBSITE / FACEBOOK / PRODUCT / PRICE

## 8.1. Nguyên tắc

Nguồn ưu tiên:
1. merchant claim / first-party;
2. official website;
3. official social page;
4. current marketplace/menu page được phép;
5. trusted directory;
6. base POI sources.

Không scrape source cấm automated scraping.
Tôn trọng robots/Terms/rate limit.

## 8.2. Field-level evidence

Mỗi field có evidence riêng:

```text
provider_field_observations
---------------------------
provider_id
field_name
value
source_id
observed_at
confidence
status
```

Ví dụ hai phone khác nhau không overwrite nhau.

## 8.3. Website crawler

Module worker:
- fetch official website;
- discover Contact/About/Menu/Services/Products;
- parse structured data JSON-LD trước;
- fallback DOM extraction;
- detect phone/email/social links;
- store snapshot hash;
- do not store unnecessary personal data.

## 8.4. Product/service extraction

Chỉ tạo item khi có:
- provider match chắc chắn;
- source URL;
- item name;
- observed date.

AI có thể:
- classify;
- normalize product/service name;
- extract unit/price;
nhưng phải lưu source evidence và confidence.

## 8.5. Price freshness

Suggested labels:

```text
fresh       <= 7 days
recent      <= 30 days
aging       31-90 days
stale       > 90 days
unknown     no observed date
```

App không hiển thị stale price như giá chắc chắn.
Nếu không phải partner, UI ghi:
`Giá tham khảo · cập nhật dd/mm/yyyy`.

---

# 9. PROJECT ↔ PLACE SPATIAL JOIN

## 9.1. Project point vs boundary

Ưu tiên:
1. project polygon/boundary;
2. project centroid + radius fallback.

Relations:

```text
project_place_edges
-------------------
global_project_id
place_id
relation_type
distance_m
inside_project
walk_distance_m nullable
walk_duration_s nullable
rank_score
category_id
generated_at
spatial_version
```

## 9.2. Zone

```text
inside       inside polygon
gate         0-300m
walkable     300-800m
nearby       800-2000m
extended     2000-3000m
```

User request mặc định hiện tại:
`radius <= 3000m`.

## 9.3. Ranking

Không chỉ sort distance.

Suggested rank:

```text
distance_score
+ confidence
+ freshness
+ verified/claimed/partner boost
+ category relevance
+ rating/popularity if licensed
+ tenant/BQL recommendation boost
```

Partner không được giả thành "gần nhất"; ranking sponsored/recommended phải có label nếu áp dụng.

---

# 10. HAPULICO GOLDEN DATASET

Trước khi mass 6.000 project:

## Scope
- tâm: Hapulico Complex;
- radius: 3km;
- 15-20 category;
- target 100-300 provider/place;
- enrich contact + website/social;
- cố lấy product/service/price cho subset đủ dữ liệu.

## Deliverables

```text
data/golden/hapulico_places.ndjson
data/golden/hapulico_providers.ndjson
data/golden/hapulico_catalog_items.ndjson
data/golden/hapulico_prices.ndjson
docs/geo-migration/HAPULICO_GOLDEN_DATA_REPORT.md
```

Report:
- total place;
- dedupe ratio;
- phone coverage;
- website coverage;
- social coverage;
- email coverage;
- product/service coverage;
- price coverage;
- stale/conflict count;
- sample top 20;
- manual verification result.

Hapulico là acceptance dataset, không dùng seed fake.

---

# 11. XHUB API CONTRACT

Prefix theo convention repo thật; ví dụ logical:

## Projects

```http
GET /api/v1/catalog/projects
GET /api/v1/catalog/projects/:id
GET /api/v1/catalog/projects/:id/nearby
GET /api/v1/catalog/projects/:id/providers
```

Nearby params:

```text
radius_m=3000
category=
q=
zone=
verified_only=false
partner_only=false
open_now=
sort=relevance|distance|freshness
page=
limit=
```

## Places/providers

```http
GET /api/v1/places/:id
GET /api/v1/providers/:id
GET /api/v1/providers/:id/locations
GET /api/v1/providers/:id/catalog
GET /api/v1/providers/:id/prices
```

## Search

```http
GET /api/v1/discovery/search?q=...
GET /api/v1/discovery/nearby?lat=&lng=&radius_m=
```

## Example response

```json
{
  "projectId": "prj_xhub_...",
  "radiusM": 3000,
  "generatedAt": "2026-08-08T07:00:00Z",
  "items": [
    {
      "placeId": "plc_...",
      "providerId": "pvd_...",
      "name": "MAY Hair Salon",
      "category": {
        "code": "beauty_hair",
        "label": "Làm đẹp & Cắt tóc"
      },
      "distanceM": 420,
      "zone": "walkable",
      "address": "...",
      "contacts": {
        "phone": "...",
        "email": null,
        "website": "...",
        "facebook": "..."
      },
      "verificationStatus": "VERIFIED",
      "partnerStatus": "NONE",
      "freshness": {
        "lastObservedAt": "...",
        "score": 0.91
      },
      "priceSummary": {
        "fromVnd": 100000,
        "toVnd": 2000000,
        "observedAt": "...",
        "isReferencePrice": true
      }
    }
  ],
  "meta": {
    "sourceVersion": "...",
    "nextCursor": null
  }
}
```

Không expose raw source payload cho mobile.

---

# 12. X2 RESIDENT BFF — CÁCH APP THỪA HƯỞNG

Khuyến nghị **App không gọi XHub trực tiếp ở phase đầu**.

App tiếp tục dùng một base API X2.
X2 gọi XHub service-to-service.

## 12.1. Resident endpoints

Additive:

```http
GET /api/v1/resident/discovery/nearby
GET /api/v1/resident/discovery/categories
GET /api/v1/resident/providers/:id
GET /api/v1/resident/providers/:id/catalog
```

X2 server flow:

```text
Resident token
→ resolve active apartment server-side
→ resolve X2 managed project
→ xhub_project_links
→ call XHub with service identity
→ apply tenant/project feature rules
→ return mobile-safe DTO
```

Client không được tự gửi `xhub_project_id` rồi tin thẳng.

## 12.2. Public mode

App public ~6.000 project:

```http
GET /api/v1/public/projects
GET /api/v1/public/projects/:id
GET /api/v1/public/projects/:id/nearby
```

Có thể BFF qua X2 trước để không đổi mobile contract lớn.
Sau khi XHub Identity/API gateway ổn định mới cân nhắc direct XHub public API.

## 12.3. Cache

Suggested:
- project detail: 24h;
- nearby edge list: 6h;
- provider contact: 6-24h;
- catalog item: 6h;
- observed price: 1-6h nếu nguồn dynamic;
- stale-while-revalidate.

Event invalidation ưu tiên hơn TTL khi đã có outbox.

---

# 13. EVENT / SYNC CONTRACT

XHub outbox events:

```text
xhub.catalog.project.created
xhub.catalog.project.updated
xhub.catalog.project.merged
xhub.geo.place.updated
xhub.provider.updated
xhub.provider.location.updated
xhub.provider.catalog.updated
xhub.provider.price.updated
```

Envelope tối thiểu:

```json
{
  "eventId": "...",
  "eventType": "...",
  "schemaVersion": 1,
  "occurredAt": "...",
  "sourceSystem": "xhub",
  "aggregateId": "...",
  "sourceVersion": "...",
  "correlationId": "...",
  "causationId": "...",
  "payload": {}
}
```

X2 consumer:
- idempotent;
- inbox/dedup;
- không ghi ngược master;
- chỉ refresh mapping/cache/projection.

---

# 14. SOURCE REFRESH / SCHEDULER

## Daily
- provider websites selected;
- stale contact check;
- failed import retry;
- source health.

## Weekly
- OSM replication/update;
- high-traffic provider enrichment;
- unresolved conflict queue;
- top-project refresh.

## Monthly
- FSQ OS Places full/delta release;
- Overture release;
- recompute affected project-place edges;
- DQ report.

Đừng recompute toàn bộ 6.000 × all places nếu chỉ một delta nhỏ.
Dùng changed place IDs + spatial affected-project lookup.

---

# 15. DATA QUALITY / CONFIDENCE

Tối thiểu có:

```text
data_confidence
freshness_score
verification_status
last_observed_at
last_verified_at
source_count
conflict_count
```

Suggested confidence dimensions:

```text
identity_confidence
location_confidence
contact_confidence
catalog_confidence
price_confidence
```

Manual review queue khi:
- phone conflict;
- address conflict;
- duplicate candidate;
- impossible location;
- stale > threshold;
- closed vs active conflict;
- price outlier.

---

# 16. SECURITY / PRIVACY / TENANT

Geo/public place data không được kéo theo PII cư dân.

Rules:
- XHub geo API không cần resident identity để xử lý canonical place.
- X2 BFF chỉ gửi project/context tối thiểu.
- không log resident phone/email cùng discovery query nếu không cần.
- service-to-service auth;
- correlation ID;
- rate limit;
- timeout/circuit breaker;
- no cross-tenant recommendation config leak.
- tenant-specific `recommended/partner` overlays tách khỏi global canonical data.

Global provider:
```text
Provider A
```

Tenant/project overlay:
```text
provider_project_overlays
-------------------------
tenant_id
global_project_id
provider_id
relationship
recommended
featured
booking_enabled
payment_enabled
voucher_enabled
valid_from
valid_until
```

Canonical provider không bị tenant A sửa cho tenant B.

---

# 17. APP CƯ DÂN — UX CONTRACT TỐI THIỂU

## Trong Resident mode

Entry:
- Tiện ích → "Dịch vụ quanh tôi";
- Home quick action optional;
- X2AI query.

Sections:

```text
Trong khu
Gần cổng
Đi bộ được
Trong 3 km
```

Categories:
- Ăn uống
- Tạp hóa/Siêu thị
- Y tế/Nhà thuốc
- Trường học
- Cắt tóc/Làm đẹp
- Giặt là
- Dịch vụ gia đình
- Gym/Thể thao
- Trẻ em
- Xe/EV
- Ngân hàng/ATM
- Giao nhận
- Khác

Provider detail:
- name;
- verified/partner badge;
- distance;
- address;
- opening hours;
- phone;
- website/social;
- products/services;
- reference price;
- "updated at";
- call/open map/website;
- booking only if supported.

Không hiện nút "Đặt" nếu provider chỉ DISCOVERED.

---

# 18. TEST MATRIX

## Project migration
- row count reconciliation;
- duplicate source IDs;
- null/invalid coordinate;
- 100% lineage;
- idempotent rerun;
- rollback.

## Mapping X2↔XHub
- mapping same record twice;
- project merged in XHub;
- missing mapping;
- X2 project not in public catalog;
- operational project links to global canonical.

## Geo
- radius exactly 3000m;
- boundary contains;
- coordinate SRID;
- near poles/not relevant;
- same place linked multiple projects allowed.

## Dedupe
- same phone/name close;
- same name far apart;
- chain branches;
- same building multiple providers;
- alias names;
- Vietnamese diacritic differences.

## API
- pagination;
- filters;
- stale cache;
- XHub timeout;
- malformed upstream;
- no raw payload leak.

## Security
- resident tenant A cannot receive project-specific partner overlay B;
- guessed project ID;
- public vs resident data scope;
- service credential rotation;
- rate limit.

## Mobile
- switch apartment → nearby reloads;
- project without mapping;
- empty nearby;
- offline cached;
- provider stale;
- price outdated label;
- no booking if not partner.

---

# 19. ACCEPTANCE GATES

## G0 — Audit
- current schema confirmed;
- current count confirmed;
- data/API consumers confirmed.

## G1 — 6.000 Project Migration
- 100% source rows accounted for:
  canonical + duplicate + explicit rejected;
- 100% canonical records have lineage;
- idempotent import;
- X2 mapping completed;
- no destructive delete.

## G2 — Hapulico Golden Dataset
- <=3km computed spatially;
- 100-300 candidates target;
- duplicates manually sampled;
- contact/source evidence visible;
- prices carry observed date;
- DQ report generated.

## G3 — Nationwide/AOI ingestion
- FSQ/Overture/OSM source jobs reproducible;
- incremental sync;
- no systematic public Nominatim abuse;
- taxonomy mapping versioned.

## G4 — XHub API
- project/nearby/provider/catalog endpoints;
- OpenAPI;
- auth/rate-limit;
- cache;
- source version/freshness.

## G5 — X2 Resident BFF
- active apartment server-derived;
- xhub project mapping;
- fallback;
- no cross-tenant overlay leak;
- integration tests.

## G6 — Flutter
- resident can browse nearby providers;
- switch apartment updates results;
- price freshness clear;
- only partner provider offers transactional actions.

---

# 20. ROLLOUT

## Wave A — Golden slice
Hapulico only:
- migrate/link project;
- radius 3km;
- 100-300 POI;
- enrich sample;
- XHub API;
- X2 BFF;
- app internal test.

## Wave B — Hà Nội
- 50-100 priority projects;
- validate taxonomy/dedupe;
- performance/load test.

## Wave C — 6.000 projects
- migrate full project catalog;
- compute AOI;
- ingest Vietnam sources;
- incremental updates;
- DQ dashboard.

## Wave D — Merchant claim / Partner
- provider claim;
- verification;
- catalog management;
- booking/voucher/payment optional;
- tenant/project partnership overlay.

---

# 21. DELIVERABLES CLAUDE PHẢI TẠO

```text
docs/geo-migration/
  00_MASTER_PLAN.md
  X2_PROJECT_CATALOG_AUDIT.md
  XHUB_GEO_READINESS_AUDIT.md
  SYSTEM_OF_RECORD_MATRIX.md
  PROJECT_MIGRATION_MAPPING.md
  SOURCE_LICENSE_REGISTER.md
  TAXONOMY_MAPPING.md
  DEDUPE_RULES.md
  DATA_QUALITY_RULES.md
  HAPULICO_GOLDEN_DATA_REPORT.md
  XHUB_API_CONTRACT.md
  X2_RESIDENT_BFF_CONTRACT.md
  EVENT_CATALOG.md
  CUTOVER_ROLLBACK_RUNBOOK.md
  PRODUCTION_REFRESH_RUNBOOK.md

data/
  taxonomy/
  golden/
  migration-reconciliation/

openapi/
  xhub-geo-provider.openapi.yaml
  x2-resident-discovery.openapi.yaml
```

Code modules naming theo repo convention, nhưng logical modules cần có:

```text
ProjectCatalog
Geo
Places
Providers
ProviderCatalog
ProviderPrices
SourceIngestion
EntityResolution
DataQuality
Discovery
```

---

# 22. COPY-PASTE PROMPT CHO CLAUDE CODE

```md
Bạn đang triển khai XHub Geo / Project / Provider Master và tích hợp X2.

MỤC TIÊU:
1. Audit và di chuyển danh mục khoảng 6.000 dự án public hiện đang nằm/seeding trong X2 sang XHub làm canonical Global Project Catalog.
2. KHÔNG chuyển dữ liệu vận hành căn hộ/cư dân/phí/BQL khỏi X2.
3. Xây Place/POI/Provider/Product-Service/Price Master tại XHub.
4. Ingest nguồn FSQ OS Places, Overture Places, OSM Vietnam theo pipeline raw→normalize→dedupe→canonical.
5. Enrich website/contact/social/catalog/price với source evidence, observed_at và confidence.
6. Spatial join provider/place với project, mặc định radius 3km.
7. Tạo API XHub.
8. Tạo X2 Resident BFF để Flutter thừa hưởng dữ liệu theo active apartment/project.
9. Pilot Hapulico trước rồi mới mass 6.000 dự án.

RÀNG BUỘC KIẾN TRÚC:
- Không shared DB XHub/X2.
- Không dual-write transaction.
- XHub là SoR của Global Project Catalog + Geo/Place/Provider Master.
- X2 vẫn là SoR của managed property/building/apartment/resident/billing/feedback/amenity/community.
- Một X2 managed project chỉ link tới XHub global project bằng immutable mapping.
- Không đổi/xóa primary key project cũ.
- Không xóa dữ liệu project cũ trong X2 ở lần cutover đầu.
- Tích hợp API + transactional outbox/event + projection/cache.
- Tenant context server-derived.
- Không expose raw source payload cho mobile.

BẮT BUỘC AUDIT TRƯỚC:
- Tìm table/model/seeder/import/API thật của ~6.000 dự án trong X2.
- Query count, duplicate, null lat/lng, source IDs/URLs.
- Liệt kê Flutter screens/repositories đang dùng project catalog.
- Audit XHub Prisma/Postgres/MDM/outbox/RLS/migration conventions.
- Viết X2_PROJECT_CATALOG_AUDIT.md và XHUB_GEO_READINESS_AUDIT.md trước migration.

PROJECT MIGRATION:
snapshot X2
→ XHub staging
→ normalize
→ dedupe
→ canonical global_projects
→ source lineage
→ external mapping
→ backfill xhub_project_links trong X2
→ shadow compare
→ feature-flag cutover.

POI SOURCES:
- FSQ OS Places: dùng Places Portal/Iceberg access hiện hành; hỗ trợ monthly delta add→update→merge→remove.
- Overture: GeoParquet, query/download theo bbox/AOI; dùng basic_category/taxonomy thay vì phụ thuộc categories legacy.
- OSM: dùng Vietnam PBF/replication; không dùng public Nominatim để systematic bulk query.

AOI:
- union buffer 3.000m quanh global projects;
- không tải POI toàn cầu không cần thiết.

CANONICAL DATA:
- global_projects
- global_project_sources
- external_entity_links
- places
- place_sources
- providers
- provider_locations
- provider_contacts
- catalog_items
- catalog_price_observations
- external_category_mappings
- project_place_edges
- provider_project_overlays
- import_jobs/source_versions/data_quality_issues.

ENTITY RESOLUTION:
Không overwrite nguồn mâu thuẫn.
Giữ field-level observations và confidence.
Auto-merge phải reversible + audit.

PRICE:
VND integer.
Mỗi price là observation có source, observed_at, valid_from/to, confidence.
App phải biết reference price vs partner price.
Không hiển thị stale price như chắc chắn.

HAPULICO:
Làm golden slice đầu tiên:
- project Hapulico;
- radius <= 3km;
- target 100-300 place/provider;
- 15-20 category;
- enrich phone/email/website/Facebook nếu có;
- extract product/service/price nơi có nguồn hợp lệ;
- generate DQ report.

XHUB API:
GET /api/v1/catalog/projects
GET /api/v1/catalog/projects/:id
GET /api/v1/catalog/projects/:id/nearby
GET /api/v1/catalog/projects/:id/providers
GET /api/v1/places/:id
GET /api/v1/providers/:id
GET /api/v1/providers/:id/catalog
GET /api/v1/discovery/search
GET /api/v1/discovery/nearby

X2 RESIDENT BFF:
GET /api/v1/resident/discovery/categories
GET /api/v1/resident/discovery/nearby
GET /api/v1/resident/providers/:id
GET /api/v1/resident/providers/:id/catalog

Flow:
resident token
→ server resolve active apartment
→ X2 managed project
→ xhub_project_links
→ XHub service-to-service
→ tenant/project overlay
→ mobile DTO.

Feature flags:
PUBLIC_PROJECT_CATALOG_SOURCE=x2|xhub_shadow|xhub
RESIDENT_DISCOVERY_XHUB=false|true

TEST/GATE:
- migration reconciliation;
- idempotency;
- source lineage;
- no orphan mapping;
- exact 3km spatial;
- dedupe chain branches correctly;
- XHub timeout fallback;
- tenant overlay MUST_NOT_LEAK;
- switching apartment changes nearby results;
- stale price label;
- partner-only transactional action.

KHÔNG ĐƯỢC:
- viết lại X2 sang NestJS;
- cho Flutter đọc DB/Raw XHub trực tiếp;
- hardcode provider/project/sample price ở UI;
- bulk scrape Google/OSM public endpoints để tạo master;
- xóa dữ liệu X2 trước cutover evidence;
- gọi DONE nếu chỉ có schema/seeder/UI mà chưa có integration test và reconciliation.

Sau mỗi phase:
1. ghi changed files;
2. chạy tests;
3. lưu evidence;
4. cập nhật status PARTIAL/DONE;
5. không tự đánh dấu production-ready khi chưa deploy/verify.
```

---

# 23. KẾT LUẬN KIẾN TRÚC

Canonical target:

```text
XHub
├── Global Project Catalog (~6.000+)
├── Geo/Place Master
├── Provider Master
├── Product/Service Catalog
├── Price observations
├── Source/Lineage
├── Taxonomy
└── Discovery API

X2
├── Managed Project/Building
├── Apartment/Resident
├── Operations/Billing
├── xhub_project_links
└── Resident BFF

Flutter
└── chỉ dùng API contract; không biết nguồn FSQ/Overture/OSM.
```

Đây là migration + federation, không phải database merge.
