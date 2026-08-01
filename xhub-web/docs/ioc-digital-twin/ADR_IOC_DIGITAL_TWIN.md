# ADR set — XHub IOC Digital Twin (DT-00 gate)

Status of every ADR below: **ACCEPTED** (2026-08-01), scope DT-01 → DT-03.

---

## ADR-0001 — 2D editor renderer: React-Konva

**Context.** The floor-plan editor needs a canvas with hit-testing on hundreds of
polygons, drag handles, pan/zoom transform and an undo stack. The repo already
ships `@xyflow/react` (node graphs) and `apexcharts`, neither of which does
free-form polygon geometry.

**Decision.** `konva@9` + `react-konva@19`, loaded **client-only** via
`next/dynamic({ ssr: false })`. Geometry is stored in **meters**; pixels exist
only in the viewport transform (`metersPerUnit` + pan/zoom), per
`docs/04_FLOOR_PLAN_EDITOR.md`.

**Alternatives rejected.** Raw SVG + React (no scene graph, hit-testing on 8+
polygons with handles gets quadratic); `@xyflow/react` (graph semantics, not
geometry); fabric.js (imperative, poor React story).

**Consequences.** Konva touches `window` at import time → every editor entry
point must be a dynamic client component with a server-rendered skeleton.

---

## ADR-0002 — 3D runtime: Babylon.js, always with a 2D/list fallback

**Decision.** `@babylonjs/core@8`, client-only, mounted inside an error boundary.
The runtime **probes WebGL support before mounting**. Zones are extruded from the
same meter-space polygons the 2D view uses — there is one geometry source, not
two.

**Non-negotiable (Constitution #9).** The Office Twin page renders the 2D plan and
the zone data table **first**; 3D is an opt-in overlay. With WebGL disabled the
page loses nothing but the 3D canvas. This is why the 2D view is not a "fallback
screen" but the primary render path.

**Consequences.** No `@babylonjs/loaders` yet → no GLB import (see ADR-0006).
Every scene must dispose its engine on unmount (AT-008).

---

## ADR-0003 — Routes: new `/ioc/*` namespace, 9th gated workspace

**Decision.** All IOC screens live under `/ioc/*`; the API under `/api/ioc/*`;
the BFF proxy is `xhub-web/src/app/api/ioc/[[...path]]/route.ts` reusing
`src/app/api/admin/_forward.ts`. `XHUB_NAVIGATION` gains exactly one new
top-level entry, `id: "ioc"`, appended after `delivery` — **additive**, no
existing entry is modified.

**Rationale.** `docs/17_UI_SCREEN_CATALOG.md` says "do not create a new rail;
register IOC as an entitled workspace entry". In this codebase a top-level
`XNavItem` carrying a `permission` IS that entitlement mechanism
(`filterNavByPermissions` hides the whole subtree under `AUTH_ENFORCE`), exactly
as `platform` and `delivery` already do.

---

## ADR-0004 — Permissions: dotted lowercase `ioc.*`, aggregate-by-default

**Decision.** Handoff `IOC_VIEW`-style keys map 1:1 to the codebase's existing
`RequirePermission` vocabulary (`ioc.view`, `ioc.studio.write`, …) — see the
delta doc §5 for the full table. Registered in
`seed-data/identity/role-registry.seed.json`.

**Privacy (Constitution #7).** Every data-layer execution returns
**department-aggregate** rows. Individual rows require BOTH
`ioc.people.detail` AND an explicit `?scope=individual`, and every such call
writes an `AuditLog` row (`ioc.datalayer.people_detail`). Without the
permission the server does not filter the response — it **refuses the request**,
so an individual row never crosses the process boundary.

**Hard ban (AT-012).** No camera, attendance, biometric, presence or
badge-swipe entity exists in the catalog, and `assertEntity()` rejects any
`entityKey` not in the compiled allow-list. An individual productivity score
built from physical sensing is therefore *unrepresentable*, not merely
disallowed.

---

## ADR-0005 — Governed query: compiled catalog in CODE, never tenant data

**Decision.** `src/ioc/ioc.catalog.ts` is a **compile-time constant** declaring,
per entity, the allowed fields, their types, allowed operators, allowed
aggregations and allowed group keys. A `DataLayerDefinition` row stores only
*references into that catalog*. The frontend never sends SQL, Prisma filters, or
raw field names that aren't validated against it (Constitution #6).

**Org resolution.** None of `NativeWorkItem` / `ExecutionProject` / `Ticket`
carry `orgUnitId`. The engine builds a
`personId → orgUnitId` map from `Position` (server-side, RLS-scoped) and folds
work items into org units through `ownerId`/`assigneeIds`. `weightedDemand` is a
**derived** field (`weight ?? estimateMinutes/60 ?? priority weight`), computed
in the engine — never a stored column, never dual-written.

**SoR (Constitution #1/#2).** The engine only **reads**
`NativeWorkItem`, `ExecutionProject`, `Position`, `MetricObservation`, `OrgUnit`.
It writes nothing back to them. IOC owns no business fact.

---

## ADR-0006 — Asset storage: built-in icon catalog now, object storage deferred

**Decision.** `IconAsset` rows of `type = BUILT_IN` only, seeded from
`data/ICON_CATALOG.csv`; the visual is an emoji/semantic token resolved in the
FE token map, so no binary leaves the DB. `type = SVG | GLB_MARKER`, underlay
image upload and GLB import are **deferred**: the platform has no object-storage
seam, and accepting tenant-uploaded SVG/GLB without a sanitizer + checksum +
quarantine pipeline (`docs/23_ASSET_PIPELINE.md`) would be a live XSS/parser
surface. `FloorPlanDefinition.underlayAssetId` is present but stays null; a plan
is authored by drawing, and calibration (`metersPerUnit`) works without an
underlay.

**Revisit when** object storage + `scan:secrets`-style asset scanning exist.

---

## ADR-0007 — Table naming and immutability

**Decision.** PascalCase singular, no `Ioc` prefix except where the domain word is
ambiguous — `TwinSite`, `TwinFloor`, `FloorPlanDefinition`, `FloorPlanVersion`,
`TwinScene`, `TwinSceneVersion`, `SceneBinding`, `IconAsset`,
`DataLayerDefinition`, `DashboardDefinition`, `DashboardVersion`. Consistent with
`StrategicObjective` / `ExecutionProject` (no module prefix anywhere in this
schema).

**Immutability (Constitution #5).** `*Version` tables are append-only: no
update/delete endpoint is exposed, the payload is JSONB with a SHA-256
`checksum`, and `versionNo` is monotonic per parent. Publishing marks the prior
`PUBLISHED` version `SUPERSEDED` and creates a new row. Rollback flips
`activeVersionNo` back — it never deletes. Every publish/rollback writes an
`AuditLog` row.

**No FKs to existing domains.** IOC references `OrgUnit.id`, `NativeWorkItem.id`
etc. as plain strings (the schema-wide convention — `NativeWorkItem.projectId`
does the same). This keeps IOC a projection that can be dropped without touching
the SoR.

---

## ADR-0008 — DT-08 physical/IoT stays out

**Decision.** No camera/VMS, access-control, biometric or BMS/sensor integration
is designed, stubbed or configured. It is gated behind a separate legal/security
readiness approval (`docs/24_FUTURE_PHYSICAL_IOT.md`). See ADR-0004 for how the
ban is enforced in code rather than in prose.
