# IMPLEMENTATION_PLAN — XHub Development & Quality Hub (`engineering-governance`)

Source handoff: `XHUB_DEVELOPMENT_QUALITY_HUB_HANDOFF_20260805`. This adapts
the handoff's own `docs/13_IMPLEMENTATION_PLAN.md` (DG-00→DG-08) to the real
`xhub-saas` codebase, using the findings in `CURRENT_STATE_DELTA.md` and the
decisions in `ADR_MODULE_OWNERSHIP.md`/`ADR_SCOPE_MODEL.md`/
`DECISIONS_LOG.md`. Each phase lists the actual files touched, not a generic
description — later phases are less concrete since their design happens when
that phase is actually scoped.

## DG-00 — Audit và ADR/SOR — ✅ DONE 2026-08-05

Deliverables (this directory): `CURRENT_STATE_DELTA.md`,
`ADR_MODULE_OWNERSHIP.md`, `ADR_SCOPE_MODEL.md`, `DECISIONS_LOG.md`, this
file. Gate satisfied: schema changes below (DG-01) only proceed because these
were written first, per the handoff's own explicit rule.

## DG-01 — Product Registry + Version Core — 🚧 THIS PASS (2026-08-05)

**Scope, precisely:** registry-only. No Feature/Backlog/Test/Defect/AI — those
are later phases, listed below for context but not started.

Backend (`xhub-api`, all on `prisma/schema.prisma` / Platform DB):
- New models: `Product`, `ProductComponent`, `RepositoryConnection`,
  `Environment`, `ProductVersion`, `ReleaseTrain` (see `ADR_SCOPE_MODEL.md`
  for why these carry no RLS).
- New migration (hand-written, excluding any unrelated drift, matching the
  convention already used for every migration this session).
- New module `src/engineering/` (`engineering.module.ts`,
  `products.controller.ts`/`.service.ts`, `versions.controller.ts`/
  `.service.ts`), registered in `platform-app.module.ts` only.
- Routes: `GET/POST /api/engineering/products`, `GET /api/engineering/
  products/:id`, `GET/POST /api/engineering/products/:id/versions`,
  `PATCH /api/engineering/versions/:id` (FSM transition) — matches
  `data/MENU.csv`/`contracts/openapi-engineering-outline.yaml`'s route
  naming. Reads open; writes gated `@RequirePermission('engineering.
  product.manage'|'engineering.version.manage')`.
- New role `PLT_ENGINEERING_ADMIN` (`["engineering.*"]`) in
  `seed-data/identity/role-registry.seed.json`. Not seeding the remaining 10
  new roles / full 38-row `ROLE_PERMISSION.csv` yet — added incrementally as
  each later DG phase actually needs its own permission codes (matches how
  `seed:roles-xoffice` was added only when Stage C needed it, not upfront).
- Seed `scripts/engineering-products-seed.mjs` — the 6 products from
  `data/SEED_PRODUCTS.csv`, in the stated rollout order, registry rows only
  (no repo connector, no live integration for products 2-6).
- Smoke `scripts/engineering-products-smoke.mjs` (`npm run
  test:engineering-products`) — CRUD + `ProductVersion` FSM guard tests
  (illegal transition rejected, matching the pattern already used for every
  other FSM in this codebase — Request/Ticket/Booking/Directive).

Frontend (`xhub-web`):
- `app/(app)/engineering/page.tsx` (overview + product/version switcher),
  `app/(app)/engineering/products/page.tsx`, `app/(app)/engineering/
  products/[id]/page.tsx` (Product 360 — Overview/Versions tabs only; other
  tabs from `docs/17_SCREEN_CONTRACTS.md`'s contract explicitly marked
  "not built yet", not faked), `app/(app)/engineering/versions/page.tsx`.
- `app/api/engineering/[[...path]]/route.ts` reusing the existing
  `admin/_forward.ts` helper (already targets `PLATFORM_BASE_SERVER`).
- Nav: new group `engineering` ("Phát triển & Chất lượng") added to the
  pinned "Vận hành nền tảng" cluster, alongside `platform`/`delivery`. The
  existing "Tài liệu & Kiểm thử" nav (both locations, see
  `CURRENT_STATE_DELTA.md`) is untouched.

**Exit check:** `npm run build` (both processes) clean; `npx tsc --noEmit`
(api+web) clean; `npm run test:engineering-products` PASS; 6 products
visible at `/engineering` with correct rollout-order seed data; confirm (grep)
none of the new tables appear in `scripts/rls-setup.mjs`'s `TENANT_TABLES`.

## DG-02 — Feature/Backlog/Traceability — NOT STARTED

Feature, Requirement, AcceptanceCriterion, BacklogItem (FSM per
`data/STATE_MACHINES.csv`), DependencyLink. Import existing backlog (the
various `xhub-web/docs/*-backlog*.md`/UAT-FAIL lists tracked all session in
`TINH_HINH_DU_AN_XHUB.md` §4b) as seed data. Needs decision #2
(`DECISIONS_LOG.md`) re-confirmed before starting — determines whether
`ExternalIssueLink` is a first-class sync target or just a free-text ref.

## DG-03 — Documentation Catalog & Sync — NOT STARTED

`DocumentSpace`/`EngineeringDocument`/`DocumentVersion`(new, engineering-owned
— distinct from the existing X.Office `DocumentVersion`)/`DocumentReview`/
`DocumentationManifest`/`SyncRun`/`SyncConflict`. Repo connector read-only
first (per `contracts/document-manifest.schema.json`). Real risk item: this
is the first phase that talks to an external Git provider — needs its own
security review before granting any repo read token.

## DG-04 — Test/UAT nâng cấp — NOT STARTED (highest-risk migration)

This is where `testruns`'s file-based JSON and the 110 `U#` codes in
`test-data.ts` actually migrate into `TestCase`/`TestCaseVersion`/
`TestSuite`/`TestCampaign`/`TestResult`/`TestObservation`/`TestEvidence` on
Platform (see `ADR_MODULE_OWNERSHIP.md`). Must ship with: dry-run report
(count before/after, unmapped rows, duplicate legacy codes — per `docs/15`'s
mapping table), rollback script, and the existing `/docs/test` +
`/office/docs/test` pages kept working throughout (route alias, not a
flag-day cutover). FAIL drawer + evidence/annotation UI is new frontend work,
not a retrofit of `TestConsole.tsx`.

## DG-05 — Defect FSM — ✅ DONE 2026-08-05 (Change/Upgrade NOT started)

**Scope actually delivered:** Defect FSM only (NEW→TRIAGED→IN_PROGRESS→
FIX_READY→VERIFYING→CLOSED, +WONT_FIX/DUPLICATE/REOPENED), with P0/P1
RCA-mandatory-before-CLOSED guard. `ChangeRequest`/`SecurityFinding`/
`TechDebt`/`CompatibilityRule`/`UpgradePlan` from the source handoff's full
DG-05 scope are **not built** — deferred, no data model yet.

- New model `Defect` (migration `20260805130000_engineering_defects_builds`,
  shared with DG-06 below) — `testCaseId`/`testResultId`/`backlogItemId` are
  plain string refs (no `@relation`), `testResultId` is `@unique` (idempotent
  create-from-FAIL). Code auto-generates `DEF-<PRODUCT>-NNNN` if omitted.
- `src/engineering/defects.service.ts`/`.controller.ts` — `create()` is
  OPEN (no permission gate — the direct next step after an open TestResult
  record, mirrors that route's own posture); `transition()` (triage/RCA/
  close) IS gated `engineering.defect.manage`.
- `test-cases.service.ts` extended to attach `defect: {id,code,status}|null`
  onto each case's `lastResult`, so the UI can show "Đã báo lỗi #CODE"
  instead of a dead-end button.
- Smoke `scripts/engineering-defects-smoke.mjs` (`test:engineering-defects`,
  17 assertions) — auto-code, idempotent create, FSM illegal/legal
  transitions, P0-cannot-close-without-rootCause, non-admin open-create +
  gated-transition. Wired into CI.
- Frontend: `app/(app)/engineering/defects/page.tsx` (product + status
  filter); `TestCaseTable.client.tsx` extended with a "Báo lỗi" button on
  FAIL rows (idempotent — repeat click just re-shows the same defect); nav
  entry `engineering.defects`.

## DG-06 — Git/CI/Release Integration — 🟡 PARTIAL, DONE 2026-08-05 (build ingestion only)

**Scope actually delivered:** real HMAC signature verification + idempotent
CI build-status ingestion (`AT-009`: forged signature → 401 — see smoke).
**Release candidate/readiness cockpit is NOT built** — `BuildRecord` answers
"did this CI run pass", not release/deployment tracking. Decision #3
(GitHub) and the `RepositoryConnection` rows seeded inert in DG-01 are
**still not load-bearing** — this pass reuses the simpler global
`WEBHOOK_SIGNING_SECRET` (same one already used for tenant webhooks), not a
per-`RepositoryConnection` secret; see `INTEGRATION_CONTRACT_CI.md`'s "Known
limitations" for why that's a stated MVP simplification, not final design.

- New model `BuildRecord`, upserted (not append-only, unlike TestResult) by
  `(productId, source, externalId)` — the same CI run reports QUEUED, then
  RUNNING, then SUCCESS/FAILURE against the same row.
- `src/engineering/ci.service.ts`/`.controller.ts` —
  `POST /api/engineering/ci/callback` (HMAC-verified via the existing
  `src/webhook/hmac.util.ts`, NOT `@RequirePermission`-gated — the caller has
  no XHub identity, its boundary is the signature, mirroring
  `WebhookController.receive()`'s own justification), `GET
  /api/engineering/ci/builds` (open read).
- Smoke `scripts/engineering-ci-smoke.mjs` (`test:engineering-ci`, 10
  assertions: missing/forged signature → 401, unknown product → 400/404,
  same externalId upserts not duplicates, appears in read list). Wired into
  CI.
- **Real cross-software proof, not simulated:** `xhub-api/scripts/report-ci-build.mjs`
  + a new "Report build status to Engineering Hub" step in
  `.github/workflows/ci.yml` — this repo's OWN CI reports its own real build
  result for both `PRD-XHUB` and `PRD-XOFFICE` after tests pass, over the
  exact same signed HTTP contract an external repo would use. Verified
  locally end-to-end (script run against the live dev server, `BuildRecord`
  row confirmed via the read endpoint, then cleaned up).
- Frontend: Product 360 page (`products/[idOrCode]/page.tsx`) gained a
  "CI / Build gần đây" table + a "Kế hoạch & Chất lượng" quick-link row
  (Backlog/Tài liệu/Kiểm thử/Lỗi) — also corrected that page's stale
  "chưa xây" list, which had not been updated since DG-01 despite DG-02/03/
  04-lite/05/06 all landing since.
- **Contract handed to other repos (not DG-08 — no code touched there):**
  `docs/implementation/engineering-hub/INTEGRATION_CONTRACT_CI.md` (full
  payload schemas, HMAC recipe, response codes, known limitations) and a
  portable Claude Code Skill at
  `docs/implementation/engineering-hub/skills/report-to-engineering-hub/`
  (SKILL.md + references/api-reference.md + a generalized, parameterized
  `scripts/report-build.mjs` — sanity-tested locally against `PRD-X1`) for
  X1/X2/FinERP/X.Space to adopt when DG-08 actually starts.

## DG-07 — AI Engineering Copilot — NOT STARTED

`AIWorkOrder` FSM, the 7 agent roles from `docs/09`, tool policy/allowlist,
redaction. Governed end-to-end by `prompts/MASTER_PROMPT_CLAUDE_CODE.md`'s
10-step process (already read in full during DG-00 survey). Depends on
DG-04 (defects to triage) and DG-05 (work orders link to defects).

## DG-08 — Ecosystem rollout — NOT STARTED

Onboard X.Office → X2/XBuilding → X1/XBooking → FinERP → X.Space as real,
live-integrated products (not just inert seed rows) — each needs its own
manifest, repo connector, test mapping, release process in *that* repository.
Explicitly out of scope for this repo (`xhub-saas`) beyond the registry seed
rows already created in DG-01.

## DG-09 — Unified Control Framework — ✅ DONE 2026-08-05

Source: additive-only adoption from
`XHUB_SOFTWARE_AI_GOVERNANCE_AUDIT_READY_HANDOFF_20260805`, per
`ADR_GOVERNANCE_RECONCILIATION.md` (its Product/Backlog/Version/Test/Defect
redesign was REJECTED; only this genuinely-new domain was adopted).

- New models `Control` (catalog) + `ControlImplementation` (per-Product
  status, upserted not append-only) — migration
  `20260805150000_engineering_governance_control_ai_privacy_evidence`
  (shared with DG-10/11/12 below).
- `src/engineering/controls.service.ts`/`.controller.ts` —
  `GET/POST /api/engineering/controls`,
  `GET/PUT /api/engineering/controls/implementations`. Reads open; writes
  gated `engineering.control.manage` (covered by the existing
  `PLT_ENGINEERING_ADMIN` role's `engineering.*` wildcard, no new role
  seeded).
- Seed `seed-data/engineering/controls.seed.json` — 16 curated controls (not
  a copy of the source handoff's 80-row catalog) + 16 `ControlImplementation`
  rows for `PRD-XHUB`, every `evidenceRef` pointing at a real file/command
  already verified this session (reuses the same evidence as
  `XHUB-SEC-STANDARDS`).
- Smoke `scripts/engineering-controls-smoke.mjs`
  (`test:engineering-controls`, 8 assertions: catalog size, create gated,
  upsert-not-duplicate, non-admin 403/200). Wired into CI.
- Frontend `app/(app)/engineering/controls/page.tsx` — product picker +
  catalog table with per-product implementation status badge.

## DG-10 — AI Governance — ✅ DONE 2026-08-05

- New models `AISystem` (registry) + `AIImpactAssessment` (FSM: DRAFT→
  IN_REVIEW→APPROVED/REJECTED/NEEDS_UPDATE; `APPROVED` requires
  `approverRole` — a human always signs off, matching the source handoff's
  own "AI never self-approves" principle).
- `src/engineering/ai-governance.service.ts`/`.controller.ts` —
  `GET/POST /api/engineering/ai-systems`,
  `PATCH /api/engineering/ai-systems/:id/status`,
  `POST /api/engineering/ai-systems/:id/impact-assessments`,
  `PATCH /api/engineering/ai-systems/impact-assessments/:id/status`. Reads
  open; writes gated `engineering.ai-governance.manage`.
- Seed `seed-data/engineering/ai-systems.seed.json` — deliberately **just 1
  row**: `AI-XOFFICE-WORKFLOW-DRAFT`, the only real AI feature in this
  codebase today (`xhub-api/src/xoffice/xoffice.service.ts`'s `aiDraft()`/
  `aiDraftLive()`, human-confirm-before-apply). Not a hypothetical
  inventory — honest about scope.
- Smoke `scripts/engineering-ai-governance-smoke.mjs`
  (`test:engineering-ai-governance`, 10 assertions: seeded system present,
  FSM illegal/legal transitions, `APPROVED` requires `approverRole`,
  non-admin 403/200). Wired into CI.
- Frontend `app/(app)/engineering/ai-systems/page.tsx` — card grid: risk
  tier, human-oversight note, latest impact-assessment status.

## DG-11 — Privacy/DPIA — ✅ DONE 2026-08-05

- New models `ProcessingActivity` (registry) + `PrivacyImpactAssessment`
  (identical FSM shape to DG-10's AIImpactAssessment).
- `src/engineering/privacy.service.ts`/`.controller.ts` —
  `GET/POST /api/engineering/processing-activities`,
  `PATCH /api/engineering/processing-activities/:id/status`,
  `POST /api/engineering/processing-activities/:id/assessments`,
  `PATCH /api/engineering/processing-activities/assessments/:id/status`.
  Reads open; writes gated `engineering.privacy.manage`.
- Seed `seed-data/engineering/processing-activities.seed.json` — 2 real
  activities: `PA-IDENTITY-DIRECTORY` (Platform, PersonProfile/OrgUnit) and
  `PA-ATTENDANCE-LEAVE` (X.Office, AttendanceEvent/LeaveRequest) — not a
  hypothetical inventory.
- Smoke `scripts/engineering-privacy-smoke.mjs` (`test:engineering-privacy`,
  9 assertions, same shape as DG-10's). Wired into CI.
- Frontend `app/(app)/engineering/privacy/page.tsx` — card grid: data
  categories, legal basis, latest DPIA status.

## DG-12-lite — Evidence Ledger — ✅ DONE 2026-08-05 (Audit Room is lite, no separate Auditor role yet)

- New model `Evidence` — append-only (like `TestResult`), keyed by a loose
  `(subjectType, subjectId)` pair so it can point at a
  `ControlImplementation`, `AIImpactAssessment`, `PrivacyImpactAssessment`,
  `Defect`, or `EngineeringDocument` without a hard relation. `level` is
  this session's own 6-step interpretation of the source handoff's E1→E6
  evidence-maturity concept (only the E1/E6 names were confirmed from the
  survey; E2–E5 are this codebase's own staging, not copied text).
- `src/engineering/evidence.service.ts`/`.controller.ts` —
  `GET/POST /api/engineering/evidence`. Both routes OPEN (no permission
  gate) — logging a pointer to proof is self-service, same reasoning as
  `TestResultsController`/`DefectsController.create()`.
- Smoke `scripts/engineering-evidence-smoke.mjs` (`test:engineering-evidence`,
  7 assertions: default level, auto-code, append-only history, invalid
  level rejected). Wired into CI.
- Frontend: no dedicated Evidence-ledger UI this pass. Instead,
  `app/(app)/engineering/audit-room/page.tsx` — a read-only aggregate
  dashboard (Control implementation counts by status, AI systems needing
  assessment, processing activities needing DPIA) per product. Explicitly
  labeled "bản rút gọn" (lite) — no dedicated Evidence browsing UI, no
  separate Auditor-role scoping, no completeness scoring. Full Audit Room
  (per `docs/12` of the source handoff) remains a future phase if asked for.

## Suggested release split (from the handoff, unchanged)

```text
v1.1 Phase A: Product/Version/Backlog/Test migration   (DG-00, DG-01, DG-02, DG-04-lite) — DONE
v1.1 Phase B: Docs sync + UAT evidence/defect           (DG-03-lite, DG-05 Defect FSM) — DONE
                                                          (full DG-03 repo-connector sync, DG-04 legacy
                                                          U# migration, DG-05 Change/Upgrade — still open)
v1.2: Git/CI/Release cockpit                            (DG-06 build ingestion DONE; release/
                                                          readiness cockpit still open)
v1.3: AI Engineering Copilot controlled pilot           (DG-07) — NOT STARTED
                                                          (DG-08 ongoing, per-product) — NOT STARTED
```

DG-09→12 (Control Framework, AI Governance, Privacy/DPIA, Evidence-lite) are
not part of this original release split — they were adopted later
(2026-08-05) from a separate handoff
(`XHUB_SOFTWARE_AI_GOVERNANCE_AUDIT_READY_HANDOFF_20260805`), additively,
per `ADR_GOVERNANCE_RECONCILIATION.md`. Treat them as a parallel "v1.1
Phase C" that shipped alongside Phase B, not a renumbering of the phases
above.
