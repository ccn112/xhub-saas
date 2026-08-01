# IOC Digital Twin — Release Note DT-01 → DT-03 (2026-08-01)

Evidence-based status per `CLAUDE_IOC_TWIN_CONSTITUTION.md` "Definition of Done".
Anything not listed as SHIPPED is DEFERRED, not partially claimed.

## SHIPPED — DT-00 Rebase Audit

- `docs/ioc-digital-twin/IOC_CURRENT_STATE_DELTA.md` — what doc 00 gets wrong
  (57→**78** RLS tables at audit time, Work v2 and the Management OS both shipped,
  `NativeWorkItem` has no `orgUnitId`/`weightedDemand`, `PersonPresence`/
  `PositionCapacity`/`SkillCoverage` have no SoR, the handoff's `org-*` ids do not
  exist), the collision list, the schema mapping, the route/permission plan and
  the AT→test mapping.
- `docs/ioc-digital-twin/ADR_IOC_DIGITAL_TWIN.md` — ADR-0001 React-Konva,
  ADR-0002 Babylon + mandatory 2D fallback, ADR-0003 `/ioc/*` routes,
  ADR-0004 permissions + privacy, ADR-0005 compiled governed catalog,
  ADR-0006 asset storage, ADR-0007 table naming + immutability, ADR-0008 DT-08 out.

## SHIPPED — DT-01 Twin Studio Foundation

**Schema (11 new models, 92 → 103):** `TwinSite`, `TwinFloor`,
`FloorPlanDefinition`, `FloorPlanVersion`, `TwinScene`, `SceneBinding`,
`TwinSceneVersion`, `IconAsset`, `DataLayerDefinition`, `DashboardDefinition`,
`DashboardVersion`. All 11 added to `scripts/rls-setup.mjs` and
`scripts/rls-test.mjs` — **RLS 78 → 89 FORCE-RLS tables**.

**API** (`src/ioc/`, all under `/api/ioc/*`, tenant-scoped + permission-gated):
sites/floors CRUD, floor-plan create/autosave/publish/versions/rollback,
scene create/update/bindings/publish/versions/rollback/**runtime**, icons.

**Geometry** (`ioc.geometry.ts`): meters-only, ≥3 vertices, no zero-length edge,
min area 0.25 m², O(n²) simple-polygon test, clockwise normalisation, duplicate
zone-id rejection, SHA-256 canonical checksum.

**UI:** `/ioc/studio`, `/ioc/studio/scenes/[id]/floor-plan` (React-Konva editor:
draw/select/move-vertex/delete, 1 m grid + scale bar, calibration, undo/redo,
debounced autosave with optimistic `revision`, OrgUnit + icon binding, publish),
`/ioc/studio/assets`, `/ioc/studio/publish`.

## SHIPPED — DT-02 Basic 3D Office Twin

- `TwinScene3D.client.tsx`: Babylon.js 8, WebGL probe **before** importing the
  renderer, extrusion from the same published meter polygons, height scaled by
  the ZONE_COLOR metric, ArcRotate camera, full engine/scene disposal on unmount.
- `TwinViewer.client.tsx`: 2D/3D toggle inside an error boundary; any failure
  snaps back to 2D and disables the 3D tab with a reason.
- `TwinPlan2D.tsx`: **server-rendered SVG** — the PRIMARY path. Verified: the
  Office Twin page ships 8 `<polygon>` elements with live labels and states with
  no client JS involved.
- `/ioc/studio/scenes/[id]/3d` preview.

## SHIPPED — DT-03 Data Layer & Dashboard Builder

- `ioc.catalog.ts` — **compiled** source registry: 4 entities
  (`NativeWorkItem`, `ExecutionProject`, `Position`, `MetricObservation`) with
  per-field allowed operators, measures, aggregations and group keys. A tenant
  cannot register an entity by writing a row.
- `data-layer.service.ts` — validate → compile → execute. Person→OrgUnit fold via
  `Position.holderPersonId` (ADR-0005), derived `weightedDemand`/`isOverdue`,
  threshold→state mapping, group-label resolution from Identity.
- `dashboard.service.ts` — closed widget enum, 12-column layout validation,
  data-layer reference checking, script/SQL/HTML rejection, publish/versions/
  rollback, and a runtime resolver that returns layout + scene + executed layers.
- **UI:** `/ioc` entry, `/ioc/twin/office` (the reference view), `/ioc/studio/data-layers`
  (catalog + live results), `/ioc/studio/dashboards` (grid preview).

## Seed

`npm run seed:ioc` (idempotent, verified by re-run): X-TECH HQ → Tầng 5 →
8 department zones in meters → published plan v1 → scene with 8 `SceneBinding`s
onto the **real** `ou-exec/sales/fin/hr/tech/solution/delivery/support` OrgUnits →
3 data layers → `DASH-OFFICE` dashboard published v1 (7 widgets). Plus
`MUST_NOT_LEAK_*` marker rows in `tenant-demo-isolation`.

## Verification evidence

| Gate | Result |
| --- | --- |
| `prisma generate` + `db push` | in sync, 103 models |
| `npm run rls:setup` | **RLS SETUP OK \| 89 tables** |
| `tsc --noEmit` xhub-api / xhub-web | **0 / 0 errors** |
| `npm run test:ioc-twin` (new) | **PASSED** — 44 assertions |
| `npm run test:ioc-data-layer` (new) | **PASSED** — 45 assertions |
| `test:rls` | PASSED — MUST_NOT_LEAK across **89** tables |
| `test:work-item` / `test:work-project` / `test:work-views` | PASSED |
| `test:manage-slice` / `test:smoke` / `test:lifecycle` / `scan:secrets` | PASSED |
| FE routes | 9 IOC routes → HTTP 200 with real content |

### Acceptance tests

| AT | Status | Proof |
| --- | --- | --- |
| AT-001 cross-tenant isolation | **PASS** | scene/plan/layer/dashboard all 404 for the other tenant; list endpoints exclude foreign rows; DB-level `test:rls` |
| AT-002 published version immutable | **PASS** | v1 checksum + payload unchanged after v2; v1 keeps 2 zones while v2 has 3; no mutation endpoint (404) |
| AT-003 rollback without delete | **PASS** | `activeVersionNo` returns to 1, `versionCount` stays 2, `deleted: 0`; runtime serves the rolled-back layout |
| AT-004 invalid geometry rejected | **PASS** | self-intersecting / <3 points / degenerate area / duplicate zone id all 400 |
| AT-005 unregistered query rejected | **PASS** | unknown entity, field, operator (LIKE), enum value (SQL-injection shaped), groupBy, non-measure SUM, visual mode — all 400 |
| AT-006 privacy gate | **PASS** | `scope=individual` → 403 for an actor without `ioc.people.detail`; same actor still reads the aggregate; a permitted drill-down writes `ioc.datalayer.people_detail` to `AuditLog` |
| AT-007 3D failure → 2D | **PASS (structural)** | 2D SVG is server-rendered and always in the DOM; WebGL probe + error boundary + `onUnavailable`. Not asserted by an automated browser test — see Deferred. |
| AT-009 no-code dashboard | **PASS** | a new dashboard is created, published and rendered purely over HTTP |
| AT-010 SYSTEM-ISOLATION markers | **PASS** | `MUST_NOT_LEAK` absent from T001 sites/dashboards/data-layers |
| AT-012 no camera/attendance scoring | **PASS** | 5 banned entity keys → 403 on both the save and preview paths; catalog contains none |
| AT-008 renderer disposal | **NOT ASSERTED** | disposal implemented; no automated memory test |
| AT-011 AI confirmation | **N/A** | DT-07 not built |

## DEFERRED (not started — do not treat as partial)

- **DT-04 Department Capacity Twin** — `/ioc/twin/departments`. Blocked on real
  capacity/FTE data: `PositionCapacity` has no SoR (delta doc §1).
- **DT-05 Process Pipeline Twin** — `/ioc/twin/process`, `FlowDefinition`/
  `FlowStage`/`FlowEdge`, `/ioc/studio/flows`.
- **DT-06 People & Position Twin** — `/ioc/twin/people`. The privacy gate
  (permission + audit + hard ban) is already enforced server-side, so the
  guardrail exists ahead of the screen; `SkillCoverage` has no SoR.
- **DT-07 Realtime / Forecast / AI** — SSE, `TwinMetricSnapshot`, `TwinAlert`,
  `SimulationScenario`, AI brief. Must reuse the existing draft-first pattern in
  `xoffice.service.ts`; AI may never auto-publish.
- Underlay image upload, tenant SVG/GLB assets (ADR-0006), visual-regression
  baselines for the four reference views, performance budget measurement.

## DT-08 — OUT OF SCOPE, GATED

Physical IoT (camera/VMS, access control, biometric attendance, BMS/sensors) is
**not built and must not be built** without a separate legal/security readiness
approval. This is enforced in code, not prose: `BANNED_ENTITY_PATTERNS` in
`ioc.catalog.ts` makes any camera/attendance/biometric/presence entity key a 403
on every write and preview path, so an individual productivity score derived from
physical sensing is unrepresentable.

## Rollback note

The slice is purely additive. To back it out: remove `IocModule` from
`app.module.ts`, delete `src/ioc/`, drop the 11 models from `schema.prisma` and
their entries from `rls-setup.mjs` / `rls-test.mjs`, delete `src/app/(app)/ioc`,
`src/app/api/ioc`, `src/components/ioc`, `src/xoffice/lib/ioc-data.ts` and the
`ioc` node in `navigation.model.ts`. No existing table, route or service is
modified, so nothing else regresses.
