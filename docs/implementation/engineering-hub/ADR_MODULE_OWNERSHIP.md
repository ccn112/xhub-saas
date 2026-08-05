# ADR — Module Ownership: `engineering-governance`

**Status:** PROPOSED — draft ready for review, not self-signed (matches this
session's convention for every ADR touched: I draft, you approve).
**Date:** 2026-08-05.

## Decision

`engineering-governance` (display name "Phát triển & Chất lượng") is a
**XHub Platform** bounded context: new NestJS module `src/engineering/`,
registered in `platform-app.module.ts` only, backed exclusively by
`prisma/schema.prisma` (the `xhub` database, port `:4000`). It is **not**
part of X.Office, and no code in it may import `XofficePrismaService` or
otherwise reach into the `xoffice` database.

This matches the handoff's own explicit statement (`README.md`, `CLAUDE.md`
§1): *"`engineering-governance` thuộc XHub Platform, không thuộc X.Office"*
— and it matches where every other control-plane-shaped module already lives
(`controlplane`, `mdm`, `backup`, `webhook`, `platform`).

## Context

DG-00's survey (`CURRENT_STATE_DELTA.md`) found the handoff's own two closest
existing analogues — `testruns` (server-side blob store for `/docs/test`)
and `records` (`RecordDocument`/`DocumentVersion`, versioned attachments) —
**both currently live on the X.Office process/DB**, not Platform. This
session's Stage B/C work (physical DB split, 2026-08-04) established a hard
rule: no process may hold a live Prisma connection into the other's database.
A naive "just extend `records`" or "just extend `testruns`" approach would
either violate that rule outright, or require moving those two modules to
Platform first — a bigger, separate migration this ADR does not authorize.

## Decision detail — what happens to `testruns` and `records`

- **Leave both exactly where they are for now.** `testruns` stays X.Office,
  file-based, unchanged. `records` stays X.Office, Prisma-backed, unchanged.
  Neither is touched by DG-01.
- **DG-04** (Test/UAT upgrade — out of scope this pass) is where the U#
  migration actually happens. At that point, the *canonical* `TestCase`/
  `TestResult`/`TestEvidence` models will live on **Platform** (per the
  handoff's own SoR table, `docs/02`: "Manual test/UAT | XHub Platform |
  canonical case/run/result/evidence"). The existing X.Office `testruns` blob
  becomes a **migration source**, not a merge target — its JSON files get
  read once, mapped into the new Platform-side `TestResult` rows (legacy
  code preserved per `CLAUDE.md` §6), and the old `/api/testruns` routes stay
  live and untouched (read-only fallback) until the new UI fully replaces
  the checklist page. No `DROP`, no silent overwrite — matches
  `CLAUDE.md`'s "không xoá dữ liệu `/api/testruns` cũ" rule.
- **Evidence storage** (screenshots/logs attached to a `TestResult`/`Defect`
  — needed starting DG-04/DG-07, not this pass) will **not** reuse
  X.Office's `RecordDocument`/`DocumentVersion` tables (cross-DB, prohibited).
  It gets its own Platform-side model (working name `EngineeringEvidence` —
  final name decided when DG-04 is scoped) following the *exact same pattern*
  `RecordDocument`/`DocumentVersion` already proves out: content-hash
  (`sha256`) dedup, immutable append-only versions, `storage/` filesystem
  path convention, `assertNoSecretFields` guard. The pattern is reused; the
  table and the database are not. `src/common/document-guards.ts` (already
  shared between `backup` and `records` today) is the natural home for the
  shared checksum/secret-guard utilities this new model will also call.

## Consequences

- DG-01 (this pass) is fully additive: new tables, new module, zero changes
  to any existing X.Office code, zero risk of regressing `test:rls-xoffice`/
  `test:smoke`/existing docs-test smokes.
- DG-04 carries real migration risk (it touches live user-facing UAT data)
  and is explicitly **not** authorized by this ADR — it needs its own
  dry-run/rollback design when scoped, per `CLAUDE.md` §6's migration rules.
- If a future session decides `testruns`/`records` should actually move to
  Platform (undoing the "ambiguous placement, low-stakes" call already
  flagged in `xoffice-app.module.ts`'s own comment), that is a separate,
  explicit ADR — not silently bundled into DG-04.

## Alternatives considered

- **Put `engineering-governance` on X.Office instead** (since `testruns`/
  `records` already live there) — rejected: contradicts the handoff's
  explicit architecture decision, and conceptually wrong — this module
  governs *all* products (X1/X2/FinERP/X.Space), not just X.Office's own
  business domain; it belongs with the other ecosystem-wide registries
  (`Tenant`, `ApplicationDefinition`) on Platform.
- **Call X.Office's Records API over HTTP from Platform** (matching the
  `Delivery→Launch` HTTP-client pattern already used in this repo) — rejected
  for DG-01: no evidence storage is needed yet at this stage (Product/Version
  registry has no binary attachments); revisit only when DG-04/07 actually
  need evidence storage, at which point a dedicated Platform-side model
  (above) is simpler and avoids a live cross-process dependency for every
  evidence read/write.
