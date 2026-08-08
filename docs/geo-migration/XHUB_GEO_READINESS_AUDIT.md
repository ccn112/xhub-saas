# XHub Geo/Provider Readiness Audit

**Ngày:** 2026-08-08
**Repo audited:** `xhub-saas/xhub-api` (NestJS + Prisma 7, two Postgres DBs: `xhub` platform / `xoffice`)
**Method:** read-only (grep schema/src, read scripts).

## 1. Prisma setup — two schemas confirmed

- `prisma/schema.prisma` (platform DB `xhub`) — **141 models**. Connection via `prisma.config.ts:14` (`DATABASE_URL`).
- `prisma-xoffice/schema.prisma` (DB `xoffice`) — **111 models**, physically separate DB per header comment (lines 1-11), synced/cached copies of some platform entities (Workflow, Requests, Tickets, ...). Connection via `prisma-xoffice.config.ts:11` (`XOFFICE_DATABASE_URL`).
- New Geo/Provider models belong in the **platform schema** (`prisma/schema.prisma`) — this is public/global data, not X.Office-specific.

## 2. Existing geo/place/provider models — none, one near-miss

- Zero `latitude`/`longitude` fields anywhere in either schema. Zero PostGIS/`geography` usage.
- No `Poi`/`Address`/`Province`/`District`/`Ward` entities.
- `TwinSite.address String?` (`schema.prisma:2197`) — free-text address only, no geocoding.
- `RepositoryConnection.provider` / `AISystem.provider` — unrelated "provider" usages (git host, AI vendor), not business/place providers.
- **The real near-miss**: MDM's `domain` string field already recognizes a `'GEOGRAPHY'` value (`schema.prisma:689,715,758` comment), seeded as two demo `MasterRecord` rows (`geo-hanoi`, `geo-namtuliem`, flat `level: province|district`, no lat/lng) in `src/mdm/mdm.service.ts:458-475`. Confirms the *intent* to have a geography domain existed, but no real schema was ever built for it.

## 3. MDM module — reuse this for pipeline bookkeeping

`prisma/schema.prisma:661-788`, module `src/mdm/`:

- `MasterRecord` (686-705): canonical record, `tenantId String?` (null = shared/global), `domain`, `canonicalKey`, `canonicalFields Json`, `aliases String[]`, `visibility` (GLOBAL/SHARED_WITH_VISIBILITY/TENANT_PRIVATE/RESTRICTED), `status` (DRAFT/ACTIVE/MERGED/RETIRED), `qualityScore Float?`, `version Int`.
- `SourceRecord` (710-732): lineage — `sourceSystem`, `sourceId`, `raw Json`, `rawHash`, `normalized Json?`, `matchStatus` (unmatched/matched/duplicate), `matchScore Float?`, unique on `(tenantId, sourceSystem, sourceId)`.
- `TenantMasterOverlay` (736-750): per-tenant customization layered on a shared master.
- `ImportJob` (754-768): one ingestion run, `stage`: staging → normalized → matched → reviewed → committed.
- `DuplicatePair` (773-788): fuzzy-match proposal, `score Float`, `decision` (pending/merge/keep_separate) — never auto-merged.
- Module files: `mdm.module.ts`, `mdm.controller.ts` (`@Controller('api/mdm')`), `mdm.service.ts` (525 lines), `mdm.normalize.ts` (96 lines).

**Decision**: reuse `ImportJob`/`SourceRecord`/`DuplicatePair` as-is for the Geo/Provider ingestion pipeline (new `domain` values `'PLACE'`/`'PROVIDER'`), since that's exactly the staging→normalize→dedupe→commit workflow the migration doc asks for. **Do not** store canonical Place/Provider data in `MasterRecord.canonicalFields` JSON — it can't be spatially indexed. Canonical records land in new dedicated relational tables instead (see §9).

## 4. Outbox — real, reusable as-is

- `OutboxEvent` model (`schema.prisma:951-969`): `tenantId, aggregateType, aggregateId, eventType, payload Json, status (pending/sent/failed), attempts, maxAttempts, nextAttemptAt, lastError`. **No `schemaVersion` field** — payload versioning isn't modeled today; new `xhub.geo.*`/`xhub.provider.*` events should embed a version key inside `payload` themselves rather than assuming a column exists.
- Writer: `src/common/outbox.ts:13-33` `enqueueOutboxEvent(prisma, tenantId, aggregateType, aggregateId, eventType, payload)` — same-transaction write.
- Dispatcher: `src/webhook/webhook.dispatcher.ts` `OutboxDispatcher.sweep()` on `@Interval(15_000)` → `WebhookService.dispatch()`.
- Cross-process variant for X.Office-side processes: `src/common/outbox-http.client.ts` `OutboxHttpClient.enqueue()` POSTs to `/api/webhooks/outbox` on the platform process (since `OutboxEvent` is platform-DB-only post-split).

## 5. RLS — explicit convention for global/non-tenant tables

- `scripts/rls-setup.mjs` builds `TENANT_TABLES` and applies `ENABLE + FORCE ROW LEVEL SECURITY` + a policy filtering on GUC `app.current_tenant` (bypassed via `app.bypass_rls='on'`).
- Enforcement: `src/prisma/prisma.service.ts` `withTenant()`/`withBypass()`; wired per-request via `TenantScopeInterceptor` (`src/common/tenant-scope.interceptor.ts:53-70`).
- **Global-table convention, already precedented** at `scripts/rls-setup.mjs:44-53`: `ApplicationDefinition` and `MasterRecord` are *intentionally not listed* in `TENANT_TABLES`, each with a one-line comment explaining why ("platform catalog — NOT tenant-scoped"). Same pattern used for `Tenant` itself and `BackupSchedule`.
- **Decision**: all new Geo/Provider/Catalog tables follow this exact convention — omit from `TENANT_TABLES`, add the same style of comment. Only `ProviderProjectOverlay` (tenant-specific recommend/featured/booking flags) carries `tenantId` and gets RLS-protected like any other tenant table.

## 6. NestJS module conventions

Representative modules: `src/bookings/`, `src/directives/`, `src/customers/`, `src/mdm/` — all `controller.ts` + `service.ts` + `module.ts` (+ an optional domain-specific sidecar like `.fsm.ts` or `.normalize.ts`), **no `dto/` folder** in the overwhelming majority of modules (only `src/records/dto/` and `src/backup/dto/` exist in the whole repo — 4 files total). Request bodies are typed with inline TS interfaces directly in controller method signatures (e.g. `src/mdm/mdm.controller.ts:26-28`), no class-validator decorators.

Module wiring (`src/directives/directives.module.ts:15-21`, `src/mdm/mdm.module.ts:12-18`): imports its Prisma module + any reused module, providers `[Service]`, exports `Service`. Tenant scoping via `@UseInterceptors(TenantScopeInterceptor)` at controller-class level; X.Office-side modules use the sibling `XofficeTenantScopeInterceptor`.

**Decision**: new `src/catalog/`, `src/geo/`, `src/providers/`, `src/discovery/` modules follow the `mdm`/`directives` shape exactly — no `dto/` folder, inline interfaces, plain controller/service/module files. These are **global** endpoints, so they should NOT use `TenantScopeInterceptor` (no tenant context needed to read public catalog data) — only `ProviderProjectOverlay`-touching endpoints (if any land in Wave A) would need it.

## 7. API route convention

Flat `api/...`, **no `/v1` segment**, contrary to the migration doc's `/api/v1/...` examples:
- `src/mdm/mdm.controller.ts:17` → `@Controller('api/mdm')`
- `src/directives/directives.controller.ts:15` → `@Controller('api/directives')`
- `src/platform/lifecycle/tenant-lifecycle.controller.ts:19` → `@Controller('api/platform/tenants')`
- `src/ioc/ioc.controllers.ts:46` → `@Controller('api/ioc/sites')` (nested-domain style)

**Decision**: use `api/catalog/projects`, `api/providers`, `api/discovery` (no `/v1`).

## 8. Migrations, seed/smoke pattern

- Migration folders: `YYYYMMDDHHMMSS_description/`, e.g. `20260805150000_engineering_governance_control_ai_privacy_evidence`. New migration for this work: a `..._geo_provider_master` folder following the same pattern.
- Seed/smoke pair convention, closest analog `scripts/mdm-reset.mjs` + `scripts/mdm-smoke.mjs` (wired `"test:mdm": "node scripts/mdm-reset.mjs && node scripts/mdm-smoke.mjs"` in `package.json`):
  - `*-reset.mjs` connects via raw `pg.Client`, sets `app.bypass_rls='on'`, deletes tenant-scoped rows for a demo tenant while preserving shared/global rows (e.g. `domain='GEOGRAPHY'` MasterRecords).
  - `*-smoke.mjs` connects via plain `fetch()` against a running server, sends `x-tenant-id`/`x-user-id` headers, asserts the pipeline step-by-step (staged counts, no ACTIVE master pre-commit, duplicate scoring, merge, commit produces exactly one ACTIVE, shared record visible with `tenantId===null`, and a `MUST_NOT_LEAK` cross-tenant canary check).
- **Decision**: new work follows `geo-hapulico-reset.mjs` / `geo-hapulico-ingest.mjs` / `geo-hapulico-smoke.mjs`, wired as `test:geo-hapulico` in `package.json`.

## 9. Staging tables, PostGIS, raw SQL, HTTP client precedent — gaps identified

- **No `stg_*`/raw staging table pattern** anywhere — MDM's `SourceRecord.raw`/`normalized` Json columns + `ImportJob.stage` string enum is the closest precedent (staging is a *lifecycle state*, not a separate table). New raw ingestion rows (`raw_osm_pois`, `raw_overture_places` per the migration doc) will reuse `SourceRecord` with `domain='PLACE'`/`'PROVIDER'` rather than inventing new raw tables.
- **PostGIS is not installed** on the local Postgres 18 (Homebrew) — `brew info postgis` → not installed; `SELECT * FROM pg_available_extensions WHERE name='postgis'` → 0 rows. Needs `brew install postgis` + `CREATE EXTENSION IF NOT EXISTS postgis;` before any spatial column/query.
- **No Prisma raw-SQL precedent** — zero `$queryRaw`/`$executeRaw` in `src/` today. Ops scripts (`scripts/rls-setup.mjs`) use the `pg` driver directly instead. Spatial columns (`geography(Point,4326)`) will be modeled as Prisma `Unsupported(...)` types, and `ST_DWithin` nearby queries will need `$queryRaw` — **this is a first for the codebase**, called out explicitly in the new module's code comments so it isn't mistaken for an established pattern.
- **HTTP-client-for-third-party-API precedent exists and is reusable**: small `Injectable` classes wrapping native `fetch()` — `src/common/outbox-http.client.ts`, `src/delivery/launch-factory.client.ts`, `src/support-cases/engineering-support.client.ts`, `src/identity-sync/identity-sync.service.ts`. A future FSQ/Overture/Overpass client should follow this exact shape (small class, `base` URL from env, native `fetch`, explicit non-2xx throw) — no `axios` needed.
- **Dependencies**: no geospatial packages present (`turf`, `geojson`, `mapbox`, etc. — none). `@prisma/adapter-pg` + `pg` (^8.22.0) already present, sufficient for raw spatial SQL. `duckdb` (for reading Overture's public GeoParquet by bbox) is **not installed** — will add as a dev dependency for the ingestion script only, not a runtime dependency of the API.

## Gate check (doc §2.3)

- ✅ Source table confirmed (X2: `public_projects` file export; XHub: no pre-existing conflicting table).
- ✅ Current API inventory confirmed (both repos).
- ✅ SoR matrix implicit in §2/§6 of this doc and the X2 audit (X2 = catalog+operational source until cutover; XHub = new canonical Geo/Place/Provider + Global Project mirror).
- ✅ Data sample: Hapulico record fully inspected (X2 audit doc §3).
- ⚠️ Duplicate/null report across the full 6000: **not run** — out of scope for Wave A (single-project pilot), required before Wave C.
- ✅ Rollback plan: additive-only changes on both sides (new tables/columns only, no destructive migration), matches the plan's Wave A scope.
