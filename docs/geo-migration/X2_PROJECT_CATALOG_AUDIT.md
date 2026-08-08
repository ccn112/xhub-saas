# X2 Project Catalog Audit

**Ngày:** 2026-08-08
**Repo audited:** `x2/x2backend` (Laravel 13, PHP 8.3, MySQL `x2bms`)
**Method:** read-only (grep/read migrations/models/seeders/controllers + `php artisan tinker` read counts against the live local DB). No seeders/migrations were run.

## 1. Stack

- Laravel 13 + Filament 5 (admin UI), Sanctum (API tokens). `composer.json:1-30`.
- DB: MySQL, `DB_DATABASE=x2bms`, confirmed live via `DB::connection()->getDatabaseName()`. `.env:20-24`, `config/database.php:20`.

## 2. Two tables, already split — catalog vs operational

| | `public_projects` (+ `developers`, `project_media`) | `projects` |
|---|---|---|
| Role | **Public catalog** — batdongsan-sourced real estate listing | **Operational** tenant-scoped SaaS entity |
| Scope | Platform-wide, `is_public` flag | `tenant_id`-scoped |
| Created | `2026_07_01_000019_create_platform_content.php:49-76` | `2026_06_28_000001_create_org_structure_tables.php:19-25`, extended `2026_06_30_000003_extend_tier1_org_structure.php:71-90` |
| Key columns | `code` (unique), `name`, `developer_name`/`developer_id`, `address`, `province`, `district`, `ward`, `latitude`/`longitude` (decimal 10,7), `project_type`, `status`, `blocks`, `apartments`, `amenities_json`, `metadata_json`, `is_public` | `tenant_id`, `code`, `name`, `type`, `status`, `sales_status`, `address/ward/district/city`, `latitude/longitude`, `land_area_sqm`, `building_count`, `apartment_count`, `investor`, `legal_no`, `handover_date`, `contact_person/phone`, `public_project_id` (FK → `public_projects`) |
| Link | — | `public_project_id` nullable FK added `2026_07_29_100000_community_group_ladder.php:36-38`, **mostly null today** |

Models: `app/Models/PublicProject.php` (catalog, `SoftDeletes`), `app/Models/Project.php` (operational, has `publicProject(): BelongsTo`).

Interest/follow tables also kept separate by design: `user_public_projects` (pre-signup interest in catalog) vs `user_project_follows` (follow on operational project) — see docblock at `database/migrations/2026_07_31_310000_create_user_project_follows.php:8-17` explaining why two tables exist.

Third association table `tenant_project_links` (`platform_content.php:78-87`) links `tenant_id` ↔ `projects.id` ↔ `public_projects.id` with a CMS-style `override_content_json` — a per-tenant content override, unrelated to the XHub migration.

**No `batdongsan_id`/`source_url` first-class column** — source URL/id/images live inside `public_projects.metadata_json` (`source`, `source_url`, `imported_at`, `detail`, `images[]`, `cover_image`).

## 3. Source of the ~6.000 rows

Scraped from **batdongsan.com.vn**, not hand-authored:

- `app/Services/Projects/BdsProjectImporter.php` — HTTP/curl scraper (Cloudflare-challenge fallback), parses cards + detail pages via `DOMDocument`/XPath, `upsertCard()` writes `public_projects` keyed by `code`.
- `app/Console/Commands/FetchMoreProjects.php` — `php artisan projects:fetch-more --pages=N --city=...`, paginated per-city via `bds_import_states` table.
- `app/Console/Commands/ExportProjectsJson.php` (`projects:export-json`) — dumps all rows, chunked, to `database/seeders/data/public_projects_export.json`. Comment explicitly references *"6k dự án"*.
- `database/seeders/PublicProjectImportSeeder.php` — reads that JSON, idempotent `updateOrCreate` keyed by `code`. Documented flow: scrape locally → export JSON → commit to git → server runs the seeder (no live scraping in prod).
- `database/seeders/PublicProjectBdsSeeder.php` — alternate seeder reading raw scrape `database/seeders/data/bds_projects.json`.
- **Neither import seeder is wired into `DatabaseSeeder.php`** — run manually/on demand.

**Row count — verified, not assumed:**
- `database/seeders/data/public_projects_export.json`: **exactly 6000 records** (`php -r 'count(json_decode(...))'`).
- Live local DB (`x2bms`), via `php artisan tinker` (read-only):
  ```
  public_projects: 5          (demo rows from DemoDataSeeder, not the real catalog)
  projects: 29
  developers: 0
  project_media: 7
  user_public_projects: 0
  user_project_follows: 0
  bds_import_states: 0
  projects.public_project_id IS NOT NULL: 0
  ```
- A migration docblock (`2026_07_29_100000_community_group_ladder.php:20-21`) records a **prior/production-like state of 6.005 rows in `public_projects` vs 27 in `projects`** — i.e. the 6000-row catalog has existed live before, just not in this local dev DB.
- **Hapulico Complex confirmed present** in the export JSON: `code: BDS-PJ158`, `name: "Hapulico Complex"`, `latitude: 21.0004883`, `longitude: 105.8071594`, `address: "Số 1 Nguyễn Huy Tưởng, Phường Thanh Xuân Trung, Thanh Xuân, Hà Nội"`, `status: handover`, `source: batdongsan.com.vn`. This is the Wave A AOI anchor.

Reconfirm counts later with: `php artisan tinker --execute="echo App\Models\PublicProject::count();"` or `mysql -h127.0.0.1 -uroot -p x2bms -e "SELECT COUNT(*) FROM public_projects;"`.

## 4. Public API surface

`routes/api.php`:
- `GET /api/v1/public/projects[/{slug}]` (lines 73-74) → `App\Http\Controllers\Api\V1\PublicProjectController@index|show`, `throttle:public-read`, **no auth**.
- `GET/POST/DELETE /api/v1/me/project-follows...` (lines 111-113) → `ProjectFollowController`, `auth:sanctum` — operates on operational `projects` + `user_project_follows`, not catalog data.

`PublicProjectController` (hand-built arrays, no API Resources):
- `card()` (145-170): `id, slug(code), name, location, status, image, summary, units, area_range, towers, handover_year, developer_name, operational_project_id`.
- `detail()` (173-203): adds `highlights, amenities, gallery_count, gallery, description, specs[], faq[], address, latitude, longitude`.
- Only `operational_project_id` (linked `projects.id`, usually null) touches operational data — everything else is clean public catalog. Safe to keep exposing as-is; XHub migration doesn't need to change this controller's contract, only add a `nearby` sibling route.

Filament (admin) resources confirm the same split: `ProjectResource` (operational) vs `PublicProjectResource` (catalog) vs SuperAdmin tools `PublicProjectLibrary` and `ProjectCatalogLinking` (manual catalog↔operational linking UI).

## 5. Flutter/mobile consumers

Repo `x2/x2mobile`, app `apps/resident_mobile`, feature `public_experience`:
- `domain/entities/project.dart` — `Project` entity mirrors the API `card()+detail()` shape, incl. `operationalProjectId`/`canFollow`.
- `data/dto/public_dto.dart` — `ProjectDto` (nullable/defaulted fields).
- `data/mappers/public_mappers.dart` — `ProjectDtoMapper.toEntity()`.
- `data/repositories/remote_public_repository.dart` — calls `public/bootstrap` + `public/projects`; comment says *"~1.8k dự án"* (stale vs. the real 6000/6005 — documentation drift, not a data issue); falls back to `bootstrap.featured_projects` on 404 (old-server compat).
- Screens: `projects_screen.dart`, `project_detail_screen.dart`, `project_picker_sheet.dart`, `project_status_chip.dart`, `public_home_screen.dart`, `public_shell.dart`. Test: `test/public_projects_test.dart`.

A future `nearby` endpoint would plug into this same `remote_public_repository.dart` layer — not evaluated further, Flutter UI wiring is out of scope for Wave A (backend only).

## 6. Geospatial

None. `latitude`/`longitude` are plain `decimal(10,7)` on both tables — no MySQL spatial type, no PostGIS, no `ST_*` usage anywhere in `app/`/`database/`/`config/`. City filtering (`PublicProjectController::applyCity()`) is string `LIKE` matching, not geo-distance.

## 7. Outbox / events

- **No transactional outbox exists yet** — `docs/handoff/x2-audit-remediation/docs/06_API_EVENT_OUTBOX.md` describes it only as a **target design** (tables `domain_events`, `outbox_messages`, etc. — zero matches in actual migrations).
- A generic, unrelated **Integration Center** (webhooks/integration events, `2026_07_01_000026_create_integration_center_batch08.php`) exists but is **not wired to `Project`/`PublicProject`** changes (no Observers touch either model).
- Conclusion: X2 has nothing to consume XHub events with yet. For Wave A, the X2→XHub direction is a plain synchronous service-to-service HTTP call (public discovery proxy), not an event subscription. Event consumption is a later-wave concern once X2's own outbox exists.

## 8. Correction to the master handoff doc

`docs/XHUB_GEO_PROJECT_PROVIDER_MASTER_HANDOFF_20260808.md` §6.5/§0.1 refers to "X2 project" as one entity and proposes a `xhub_project_links` bridge table keyed by `x2_project_id`. In reality X2 already separates **catalog** (`public_projects`) from **operational** (`projects`), and XHub's `GlobalProject` is the direct analog of `public_projects`, not of the operational `projects` table. Hapulico exists only in the catalog table (no operational tenant project yet) — so the Wave A link target is `public_projects.id`, via a direct nullable `xhub_project_id` column (simpler than a join table given today's 1:1 relationship), not `projects.id`.

## Stray repo note

`x2/x2mobile/xhub-saas/` is a second, stale git clone of `ccn112/xhub-saas` (last commit 2026-08-02) sitting inside the x2mobile tree. Not the target of this migration — the canonical repo is `Code/xhub-saas` (current, tracks `origin/main`). Flagging so it isn't mistaken for a second XHub target; not modified as part of this work.
