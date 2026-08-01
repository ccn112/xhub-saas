# IOC Digital Twin — Current State Delta (DT-00 Rebase Audit)

> Gate output for `/ioc-rebase-audit`. Docs only — no feature code was written for
> this document. Source of truth is the ACTUAL repo state on 2026-08-01, verified
> by reading `xhub-api/prisma/schema.prisma`, `xhub-api/scripts/rls-setup.mjs`,
> `xhub-api/src/*`, `xhub-web/src/app/**` and `xhub-web/src/xhub/nav/navigation.model.ts`,
> plus live Postgres queries.

## 1. What `docs/00_CURRENT_STATE_REBASE.md` gets wrong (STALE)

| Handoff doc 00 claim | Actual state (verified 2026-08-01) |
| --- | --- |
| "RLS covers roughly 57 tenant tables" | **78 tables** have `relrowsecurity` in the live DB; `scripts/rls-setup.mjs` lists 78 entries. Schema has **92 Prisma models** (14 are intentionally NOT tenant-RLS: `Tenant`, `ApplicationDefinition`, `MasterRecord`, `WorkflowVersion/Node/Edge`, platform catalogs). |
| Lists modules up to Announcement | Two further product slices have SHIPPED since the handoff was written: **X.Office Work & PM v2** and the **X.Office Management Operating System**. |
| No mention of Work v2 | `NativeWorkItem`, `WorkItemComment`, `WorkItemChecklistItem`, `WorkItemEvent`, `WorkDimension`, `ExecutionProject`, `ExecutionProjectEvent`, `WorkDependency`, `ProjectBaseline`, `BaselineItem`, `ProjectRoleAssignment`, `CoordinationShare` exist. API `src/work/*` → `/api/work/*`. FE routes `/work`, `/work/tasks`, `/work/tasks/assigned-by-me`, `/work/projects`, `/work/board`, `/work/calendar`, `/work/portfolio`, `/work/reports`, `/work/projects/[id]/gantt`. |
| No mention of Management OS | `StrategicObjective`, `MetricDefinition`, `MetricObservation`, `BusinessReview`, `DecisionRecord`, `ActionCommitment` (MG-01) + `Scorecard`, `OKRCycle`, `OKRObjective`, `KeyResult`, `KeyResultCheckIn` (MG-03, landing concurrently). API `src/manage/*` → `/api/manage/*`; FE `/manage/*` is a **6th nav workspace** ("Quản trị"). |
| "Connectors and production IdP remain seams/mocks" | Still true. `MetricDefinition.sourceSystem = XOFFICE_WORK` is the ONLY real connector; FINERP / X2BMS / XBOOKING / MATTERMOST are declared-but-mock. |

### Other corrections that matter to IOC

- **Nav is no longer 5 workspaces.** `XHUB_NAVIGATION` currently holds 8 top-level
  entries: `home`, `manage`, `work`, `space`, `office`, `business`, `platform`,
  `delivery`. IOC becomes the 9th (gated, so a normal employee under
  `AUTH_ENFORCE` does not see it).
- **`NativeWorkItem` has NO `orgUnitId` column.** The handoff's data-layer seeds
  (`dl-workload.seed.json`, `groupBy: ["orgUnitId"]`) assume one. The real
  org resolution path is
  `NativeWorkItem.ownerId / assigneeIds (personId) → Position.holderPersonId → Position.orgUnitId`.
  The IOC data-layer engine MUST perform this join server-side; it cannot be a
  naive `groupBy`. See ADR-0005.
- **`NativeWorkItem` has no `weightedDemand` field.** `dl-workload.seed.json`
  aggregates `SUM(weightedDemand)`. The real weight signal is
  `weight (Float?)` + `estimateMinutes (Int?)` + `priority`. The catalog exposes a
  backend-computed `weightedDemand` **derived field**, not a raw column.
- **`PersonPresence` / `PositionCapacity` / `SkillCoverage` entities do not
  exist.** `DL-HEADCOUNT`, `DL-CAPACITY`, `DL-SKILL` from
  `data/DATA_LAYER_CATALOG.csv` have no System of Record today. Headcount is
  derivable from `Position` (`holderPersonId IS NOT NULL`); capacity and skills
  are **not** derivable and are deferred (DT-04/DT-06).
- **Real T001 org units are not the handoff's `org-*` ids.** Actual tenant-xtech
  `OrgUnit` rows: `ou-exec` (Ban Điều hành), `ou-sales` (Kinh doanh),
  `ou-fin` (Tài chính - Kế toán), `ou-hr` (Nhân sự), `ou-tech` (Công nghệ),
  `ou-admin` (Hành chính), `ou-solution` (Giải pháp), `ou-impl` (Triển khai),
  `ou-delivery` (Triển khai/TEAM), `ou-support` (Hỗ trợ), `ou-platform` (Nền tảng).
  The handoff seeds (`org-executive`, `org-sales`, …) MUST be remapped — done in
  `scripts/seed-ioc-twin.mjs`.
- **`Ticket` / `Request` / `Directive` also lack `orgUnitId`** — same person→position
  join applies; these entity keys are registered but not enabled in the MVP catalog.

## 2. Collision list (things IOC must NOT touch)

| Surface | Owner | IOC rule |
| --- | --- | --- |
| `prisma/schema.prisma` existing 92 models | Work v2 / Management OS / foundations | **Append only.** IOC models are added at the end of the file. No edits to existing models, no new relation fields on them (IOC references by id string, no FK). |
| `scripts/rls-setup.mjs` `TENANT_TABLES` | shared | **Append only** at the end of the array. |
| `navigation.model.ts` | shared (MG-03 in flight) | **Append only** — one new top-level `ioc` workspace inserted after `delivery`. No edits to `manage`/`work`/`business`. |
| `/api/work/*`, `/api/manage/*` | Work v2 / Mgmt OS | IOC **reads** these domains through Prisma inside its own service (same process, RLS-scoped) — read-only, never writes. No dual-write, no new SoR. |
| `app/api/work`, `app/api/manage` BFF proxies | FE | IOC adds its own `app/api/ioc/[[...path]]/route.ts` using the same `_forward` helper. |

## 3. Schema mapping — handoff aggregate → what actually ships in DT-01..03

`docs/16_BACKEND_PRISMA_MODEL.md` proposes 20+ aggregates. The MVP ships **10**,
collapsing the geometry/layout children into versioned JSONB payloads exactly as
doc 16 permits ("Draft/version child records may be JSONB initially").

| Handoff aggregate | DT-01..03 decision |
| --- | --- |
| TwinSite / TwinBuilding / TwinFloor | `TwinSite` + `TwinFloor` (building folded into `TwinFloor.buildingLabel` — a single-building MVP does not justify a third table). |
| FloorPlanDefinition / FloorPlanVersion | `FloorPlanDefinition` (draft head, mutable) + `FloorPlanVersion` (immutable, checksummed, geometry in JSONB per the contract schema). |
| TwinScene / TwinSceneVersion / SceneZone / SceneNode / SceneBinding | `TwinScene` (draft head) + `TwinSceneVersion` (immutable published payload) + `SceneBinding` (RELATIONAL — it is security-critical: it names the OrgUnit a zone exposes). Zones stay inside the floor-plan geometry JSONB; `SceneBinding.zoneId` references a zone id within it. |
| IconAsset / SceneAsset | `IconAsset` (tenant catalog, seeded from `data/ICON_CATALOG.csv`). `SceneAsset` (GLB upload) **deferred** — no object storage seam exists yet (ADR-0006). |
| DataSourceDefinition / DataLayerDefinition / MetricBinding | `DataLayerDefinition` only. The **source registry is CODE, not data** (`ioc.catalog.ts`) — a tenant must not be able to register a new queryable entity/field (Constitution #6). `MetricBinding` folded into `DataLayerDefinition.visualMapping`. |
| FlowDefinition / FlowStage / FlowEdge | **Deferred to DT-05.** |
| DashboardDefinition / DashboardVersion / DashboardWidget | `DashboardDefinition` (draft head) + `DashboardVersion` (immutable). Widgets are JSONB inside the definition per `contracts/dashboard-definition.schema.json`. |
| TwinMetricSnapshot / TwinAlert / SimulationScenario | **Deferred to DT-07.** |

**Ships: 8 new tables** — `TwinSite`, `TwinFloor`, `FloorPlanDefinition`,
`FloorPlanVersion`, `TwinScene`, `TwinSceneVersion`, `SceneBinding`,
`IconAsset`, `DataLayerDefinition`, `DashboardDefinition`, `DashboardVersion`
(= **11**; final count is in the release note).

## 4. Route / menu plan

New namespace `/ioc/*`, registered as a **9th, permission-gated workspace**
(`permission: "ioc.view"`), consistent with how `platform` and `delivery` are
gated. Per `docs/17_UI_SCREEN_CATALOG.md`: "Do not create a new rail at MVP;
register IOC as entitled app/workspace entry" — in this codebase a top-level
`XNavItem` with a `permission` gate IS the entitlement mechanism.

| Screen | Route | Phase | Status in this build |
| --- | --- | --- | --- |
| IOC-01 IOC Entry | `/ioc` | DT-03 | SHIPPED |
| IOC-02 Office Twin Command Center | `/ioc/twin/office` | DT-02 | SHIPPED |
| IOC-S01 Twin Studio Home | `/ioc/studio` | DT-01 | SHIPPED |
| IOC-S02 Floor Plan Editor | `/ioc/studio/scenes/[id]/floor-plan` | DT-01 | SHIPPED |
| IOC-S03 3D Scene Editor | `/ioc/studio/scenes/[id]/3d` | DT-02 | SHIPPED (viewer + fallback) |
| IOC-S04 Data Layer Builder | `/ioc/studio/data-layers` | DT-03 | SHIPPED |
| IOC-S05 Dashboard Builder | `/ioc/studio/dashboards` | DT-03 | SHIPPED |
| IOC-S07 Icon & Asset Catalog | `/ioc/studio/assets` | DT-01 | SHIPPED (built-in icons; upload deferred) |
| IOC-S08 Review & Publish | `/ioc/studio/publish` | DT-01 | SHIPPED |
| IOC-03/04/05 dept / process / people twins | `/ioc/twin/*` | DT-04..06 | DEFERRED |
| IOC-S06 Flow builder | `/ioc/studio/flows` | DT-05 | DEFERRED |

## 5. Permission plan

`data/PERMISSION_CATALOG.csv` names permissions in SCREAMING_CASE
(`IOC_VIEW`). This codebase's registry uses dotted lowercase
(`manage.objective.read`, `work.portfolio.read`, `platform.tenant.read`). To stay
consistent with the existing `RequirePermission` guard, IOC permissions are
registered in the codebase convention with a documented 1:1 mapping:

| Handoff catalog | XHub registry key |
| --- | --- |
| `IOC_VIEW` | `ioc.view` |
| `IOC_VIEW_PEOPLE_DETAIL` | `ioc.people.detail` |
| `IOC_VIEW_SENSITIVE_METRIC` | `ioc.metric.sensitive` |
| `IOC_STUDIO_VIEW` | `ioc.studio.read` |
| `IOC_STUDIO_EDIT` | `ioc.studio.write` |
| `IOC_STUDIO_REVIEW` | `ioc.studio.review` |
| `IOC_STUDIO_PUBLISH` | `ioc.studio.publish` |
| `IOC_ASSET_MANAGE` | `ioc.asset.manage` |
| `IOC_DATA_LAYER_MANAGE` | `ioc.datalayer.manage` |
| `IOC_TEMPLATE_MANAGE` | `ioc.template.manage` |

## 6. Test plan (mapped to `data/ACCEPTANCE_TESTS.csv`)

| AT | Assertion | Where |
| --- | --- | --- |
| AT-001 | Tenant B reads 0 IOC sites/scenes/dashboards/layers of Tenant A | `scripts/ioc-twin-smoke.mjs` + `scripts/rls-test.mjs` |
| AT-002 | Publishing twice yields v1 + v2; v1 payload byte-identical after; no mutation endpoint on a version | `ioc-twin-smoke.mjs` |
| AT-003 | Rollback re-activates v1 without deleting v2 | `ioc-twin-smoke.mjs` |
| AT-004 | Self-intersecting / <3-point / degenerate polygon rejected 400 | `ioc-twin-smoke.mjs` |
| AT-005 | Unregistered entityKey / field / operator rejected 400 | `ioc-data-layer-smoke.mjs` |
| AT-006 | Role preview without `ioc.people.detail` returns aggregate only | `ioc-data-layer-smoke.mjs` |
| AT-007 | 3D failure → 2D fallback | error boundary + `TwinScene2D`; manual/visual |
| AT-010 | `SYSTEM-ISOLATION` marker rows never returned to tenant-xtech | `ioc-twin-smoke.mjs` |
| AT-012 | No camera/attendance entity is registerable as a productivity metric — hard server-side ban | `ioc-data-layer-smoke.mjs` |
| AT-008/009/011 | perf disposal / no-code dashboard / AI confirm | AT-009 asserted by smoke (dashboard created purely via API); AT-008 and AT-011 deferred with DT-07 |

## 7. First reference slice (executed)

```
TwinSite(X-TECH HQ) → TwinFloor(Tầng 5) → FloorPlanDefinition(draft, 8 zones in meters)
  → publish → FloorPlanVersion v1 (immutable, checksummed)
  → TwinScene → SceneBinding × 8 (zone → REAL ou-* OrgUnit + iconKey + dataLayerIds)
  → publish → TwinSceneVersion v1
  → DataLayerDefinition × 3 (workload / headcount / projects) over EXISTING entities
  → DashboardDefinition(OFFICE_TWIN) → publish → DashboardVersion v1
  → /ioc/twin/office renders live, 2D always, 3D when WebGL is available
  → RLS + permission + immutability + rollback PASS
```

## 8. Out of scope — hard stop

**DT-08 (physical IoT: camera/VMS, access control, biometric attendance,
BMS/sensor connectors) is NOT built and MUST NOT be built** until a separate
legal/security readiness approval exists. `data/ACCEPTANCE_TESTS.csv` AT-012 is
enforced *server-side* today: the data-layer catalog contains no camera,
attendance, biometric or presence entity, and `ioc.catalog.ts` rejects any
`entityKey` outside the compiled allow-list, so such a metric is not merely
undocumented — it is unrepresentable.
