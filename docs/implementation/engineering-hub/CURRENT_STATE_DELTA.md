# CURRENT_STATE_DELTA — XHub Development & Quality Hub (DG-00)

Source handoff: `XHUB_DEVELOPMENT_QUALITY_HUB_HANDOFF_20260805`. Compares the
handoff's target design against the *actual* current code (verified via 2
parallel Explore passes on 2026-08-05, not guessed from filenames).

## What already exists (do not throw away, do not redesign from scratch)

- **`/docs` area (`xhub-web/src/app/(app)/docs/**`)**: 7 tabs hard-coded in
  `DocsNav.tsx` — Tổng quan, Nghiệp vụ, SaaS, Phát triển, Backlog, Hướng dẫn
  sử dụng, Kiểm thử. Markdown-driven pages use `MarkdownDoc.tsx` (TOC +
  anchored headings) + `slug.ts`.
- **`/docs/test` (`TestConsole.tsx` + `test-data.ts`)**: already has most of
  what the handoff's "hiện trạng tốt cần giữ" list asks for —
  - Test rows carry a code (`U1`…`U111`, **110 unique codes, `U55` missing** —
    a gap, not a bug — not strictly sequential).
  - Grouped by topic (`USER_TEST_GROUPS`, 14 groups; `XOFFICE_TEST_GROUPS`/
    `PLATFORM_TEST_GROUPS` split serves `/office/docs/test` vs `/docs/test`).
  - Each row has an expected-result string and a deep link (`link` field,
    "Mở màn").
  - Tester picks `untested | pass | fail` + a free-text note.
  - State persists: `localStorage` (`xhub-usertest-v1`, immediate) **and**
    debounced `PUT /api/testruns` (800ms) — server wins over local on load if
    non-empty.
  - Bot-test table (`BOT_TEST_RESULTS`, 41 rows) sits in the same page as the
    manual checklist — but it's **always-PASS, no fail state modeled** (a real
    gap vs the handoff's evidence-based PASS requirement — see below).
- **A second, X.Office-scoped copy** of the test/docs pages already exists
  (`/office/docs/test`, `/office/docs/developer`, `/office/docs/backlog`,
  added 2026-08-04, Stage D) — reads the *same* `USER_TEST_ROWS`/
  `BOT_TEST_RESULTS` source, filtered by group. Any redesign must account for
  **both** locations, not just `/docs/test`.

## Confirmed gaps (matches the handoff's own `docs/00` list, verified against real code)

1. **No Product/Version/Feature/Release concept anywhere.** Grepped both
   Prisma schemas (`prisma/schema.prisma`, `prisma-xoffice/schema.prisma`) —
   zero `model Product`, `Feature`, `Backlog`, `Defect`. The only
   "Version"-named models are per-entity versioning sub-tables
   (`WorkflowVersion`, `DocumentVersion`, `FloorPlanVersion`,
   `TwinSceneVersion`, `DashboardVersion`) — not a generic release/product
   version. Confirms handoff gap #1 exactly.
2. **PASS/FAIL carries no environment/actual-result/evidence.** `RowState` is
   just `{ result, notes }` — no build/version/tester/environment/screenshot
   fields. Confirms gap #2.
3. **No defect/change-request flow from FAIL.** A FAIL row is just a note in
   a JSON blob — nothing creates a trackable record. Confirms gap #3.
4. **No conversation/owner/SLA/retest history on a note.** Confirms gap #4.
5. **No image/annotation on a case.** Confirms gap #5.
6. **No trace from a FAIL to backlog/PR/build/release.** Confirms gap #6 —
   there is no backlog/PR/build model to trace to at all yet.
7. **Bot-test has no build/commit-anchored evidence.** `BOT_TEST_RESULTS` is
   a static array with an `expected` string per row; nothing links a PASS
   badge to an actual CI run/commit. Confirms gap #7. (Also found, not in the
   handoff's list: the file's own header comment claiming "27/27 PASS,
   2026-07-30" is stale — the array has grown to 41 rows without updating
   that count/date; only `BOT_TEST_UPDATED` is kept current. This is exactly
   the class of problem the handoff is trying to prevent structurally.)
8. **Docs have no ownership/version/review-state/sync.** Confirmed — markdown
   pages under `xhub-web/docs/*.md` are plain files with no metadata header
   schema, no review cadence, no sync-from-repo mechanism. Confirms gap #8.
9. **No Product Registry / manifest across X1/X2/X.Office/X.Space/FinERP.**
   Confirmed — nothing in this repo models another product's existence.
   Confirms gap #9.
10. **No AI engineering gateway.** Confirmed — no `AIWorkOrder`-shaped
    anything exists; the closest analogue is `XofficeService.aiAdvisory`
    (IOC's draft-first AI brief), which is a narrow read-only advisory
    feature, not a code-change work order. Confirms gap #10.

## `testruns` and `records` — placement matters for the ADR (new finding, not in the handoff)

- **`testruns`** (`xhub-api/src/testruns/*`): **file-based JSON**, no Prisma
  model at all (`storage/testruns/<tenantId>/<userId>.json`). Registered only
  in `xoffice-app.module.ts` (X.Office process, `:4001`). Its own module
  comment already flags it as one of "the two small AMBIGUOUS modules
  (preferences, testruns) — low-stakes, revisit placement if it turns out
  wrong" — i.e. its current home was always a pragmatic, not architectural,
  choice.
- **`records`** (`RecordDocument`/`DocumentVersion`): real Prisma models,
  **only present/wired in the X.Office schema+process** (the Platform schema
  has copies of the same model bodies but no controller/service ever talks to
  them — dead tables on that side). `RecordsService` depends on
  `XofficePrismaService` directly.
- **Why this matters**: the handoff's target architecture puts
  `engineering-governance` on **XHub Platform** (`README.md`, `CLAUDE.md` both
  explicit: `:4000`, DB `xhub`). Neither `testruns` nor `records` can be
  reused in-place by a Platform-side module without violating the "no
  cross-DB Prisma call" rule this whole session has enforced (Stage
  B/C — see `docs/implementation/xoffice-ai/IMPLEMENTATION_PLAN.md`). See
  `ADR_MODULE_OWNERSHIP.md` for the resolution.

## Nav — two locations, not one

`xhub-web/src/xhub/nav/navigation.model.ts` currently has the "Tài liệu &
Kiểm thử" group in **two places**:

1. Nested under the `business` (Doanh nghiệp) top-level workspace, id `docs`,
   **no `permission` field — visible to every authenticated user** —
   children: `docs.overview/business/saas/developer/backlog/user/test`.
2. Nested under `office.workflowAdmin` ("Quản trị quy trình"), ids
   `office.docs.test/developer/backlog` (added 2026-08-04).

Any future rename/restructure of this area (DG-04+) must update both, plus
`DocsNav.tsx`'s own hard-coded tab list, plus the `business` workspace's
`match` array. **Not touched in this pass (DG-01)** — DG-01 only *adds* a new,
separate nav group for the Product/Version registry; it does not rename or
remove the existing docs/test nav.

## Conclusion for DG-00

The existing UAT checklist is a legitimate, working foundation — the
handoff's own instruction ("không nên phá bỏ và làm lại") is followed: DG-04
(when it happens) upgrades this in place, migrating `U#` codes into
`TestCase.externalLegacyCode` per `CLAUDE.md`'s migration rule, not replacing
the page. DG-01 (this pass) does not touch `/docs/test`, `testruns`, or
`records` at all — it only adds the Product/Version registry, which is a
clean, additive, zero-collision layer on the Platform side.
