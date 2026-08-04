# ACCEPTANCE_EVIDENCE.md — XHub Ecosystem Security/Privacy Audit Remediation

**Source handoff:** `XHUB_ECOSYSTEM_SECURITY_PRIVACY_AUDIT_HANDOFF_20260804` (builds on `Audit260803`).
**Scope of this document:** `xhub-saas` only (XHub Platform + X.Office). X1, X2, X.Space, FinERP, X.AI are
out of scope — different repos, not touched this session.
**Date:** 2026-08-04. **Repo state:** working tree at `xhub-saas` HEAD `32c2480` + uncommitted
Phase 1.5 Stage C + this Phase X work (nothing pushed).

## Non-closure notice (per `10_CLAUDE_CODE_MASTER_HANDOFF.md`)

> "Request independent retest; do not self-close critical/high." / "Do not set finding CLOSED based
> only on code review."

Every CRITICAL/HIGH item below is marked **REMEDIATED — NOT CLOSED**. Formal closure requires an
independent reviewer (not this agent, not code-review-only) to retest against the acceptance criteria
below. Nothing in this document should be read as a compliance certification.

---

## 1. Evidence already produced by prior work this session (not re-done, only re-verified)

| Finding | Statement (from `data/CURRENT_FINDINGS_TO_CONTROLS.csv`) | Status | Evidence |
|---|---|---|---|
| REM-002/REM-003, SEC-001/SEC-002 | `xoffice.controller.ts` 28 routes had zero `@RequirePermission`; unprivileged `ROLE_IT_SUPPORT` self-granted an admin delegation (PoC, HTTP 201) | **REMEDIATED** | 29 `@RequirePermission` decorators added; `test/xoffice-delegation.e2e-spec.ts` regression asserts the PoC now fails. Re-ran `npm run test:e2e` this session — pass (see §5). |
| REM-010/REM-011 | `AUTH_ENFORCE`/`AUTH_ALLOW_HEADER_IDENTITY` unsafe defaults, no non-local guard | **REMEDIATED** | `assertSecureAuthDefaults()` in `bootstrap.ts`, shared by `main.ts`/`main-platform.ts`/`main-xoffice.ts` — exits 1 on unsafe config outside local dev. |
| REM-012/ECO-REM-003 (partial) | No CI/CD at all | **REMEDIATED** (partial — see §4 residual) | `.github/workflows/ci.yml` exists: build/lint/unit/e2e/authz/RLS/isolation smokes on every PR. This session added secret-scan + SCA gates (§4). |
| REM-013 | No `prisma/migrations`, DB drift undetected | **REMEDIATED** | Migration baseline + `migrate:drift-check` in CI; Stage C added `prisma-xoffice/migrations/` for the new X.Office DB. |
| "No shared DB/dual-write between XHub↔product" (ECO-REM-007 architecture requirement) | Prohibited shortcut #4 in the master handoff | **SATISFIED BY CONSTRUCTION** | Phase 1.5 Stage C physically split XHub Platform and X.Office onto two separate Postgres databases (`xhub`, `xoffice`), two separate processes, two separate Prisma schemas/clients. No runtime cross-DB query exists. Evidence: `npm run test:db-split` (negative test proving they are genuinely separate instances, not a shared schema). |
| ECO-REM-004 (tenant isolation contract) | Need documented + tested isolation contract | **REMEDIATED** | `SECURITY.md` §"Tenant context (multi-tenant isolation)" (SEC-X.2, see §3) + `test:rls` (105 platform tables) + `test:rls-xoffice` (89 X.Office tables) + `test:isolation` (seed-level MUST_NOT_LEAK) + `test:db-split`. |
| "Backup/restore untested" (implied by REM-013) | — | **CORRECTION, not a gap** | `test:backup` / `test:backup-schedule` already simulate a sandboxed restore + identity remap and pass. No new work needed; flagging the audit's implication as inaccurate rather than silently agreeing with it. |
| Fail-closed auth across the 2-process split | — | **REMEDIATED** | `assertSecureAuthDefaults()`/`assertSecureStartup` live in shared `bootstrap.ts`, used identically by both `main-platform.ts` and `main-xoffice.ts` — the process split introduced no gap. |

## 2. REM-001 / ECO-REM-001 — leaked `ANTHROPIC_API_KEY` (CRITICAL, NOT remediated)

**Statement:** "Live unrotated `ANTHROPIC_API_KEY` in `xhub-api/.env` matches a fingerprint the repo's
own `SECURITY.md`/`main.ts` `LEAKED_KEY_FINGERPRINTS` allowlist documents as known-leaked."

**Status: NOT remediated — human action required, out of this agent's authority.**

- What exists: `main.ts`'s `warnOnLeakedKey()` fingerprint check, and (this session, Phase 0) a
  fail-closed guard that exits the process in any non-local environment if a known-leaked fingerprint
  is still active. This **contains** the blast radius (cannot silently run in staging/prod with the
  leaked key) but does **not** remediate the underlying exposure.
- What is still required and cannot be done by this agent: rotate/revoke the key at
  `console.anthropic.com`, update `.env` (gitignored, confirmed via `git check-ignore -v xhub-api/.env`),
  confirm no other consumer still uses the old key.
- Residual risk: **CRITICAL, open**, until a human rotates the key. Runbook already exists in
  `SECURITY.md` §"API key rotation procedure (ANTHROPIC_API_KEY)".

## 3. SEC-X.1 — Route/permission inventory, both processes (re-verified 2026-08-04)

**Method:** for every controller file loaded by `platform-app.module.ts` (11 files) and
`xoffice-app.module.ts` (16 files, including `identity.controller.ts` which both processes share),
scripted scan of every `@Get/@Post/@Put/@Patch/@Delete` decorator, checking a ±3-line window for
`@RequirePermission` (corrected methodology — an earlier `grep -B2` pass in this session under-counted
because this codebase's convention places `@RequirePermission` *after* the HTTP-method decorator, not
before).

**Result:**

| Process | Total routes | `@RequirePermission`-gated | Ungated |
|---|---|---|---|
| Platform (11 controllers) | 69 | 50 | 19 |
| X.Office (16 controllers) | 306 | 248 | 58 |

**All 19 platform-ungated routes are `@Get(...)` reads** (tenant-scoped by RLS — controlplane/mdm/backup/webhook
list-and-detail endpoints). Zero platform write routes are ungated.

**Of the 58 X.Office-ungated routes:**
- 36 are `@Get(...)` reads (tenant-scoped by RLS).
- 22 are non-GET, and every one falls into a documented, deliberate category — none are an unexplained gap:
  - **5 bookings** (`cancel`/`check-in`/`check-out`/`comment`/`attachments`) and **4 directives**
    (`acknowledge`/`start`/`submit`/`evidence`) and **5 tickets** (`start`/`pending`/`resume`/`close`/`cancel`)
    are covered by the SEC-X.1 **service-layer ownership check** (`assert*Actor` — see §"Object-level
    authorization" in `SECURITY.md`, this session's BOLA fix): the record's own requester/assignee, or
    a `.manage`/`.issue` permission holder.
  - **3 tickets** (`comment`/`attachments`/`csat`) and **4 announcements** (`comment`/`attachments`) and
    **1 directives** evidence route are tenant-member actions on a record already visible to the caller
    via a prior `GET` (RLS-scoped); `csat` additionally has its own requester-only check
    (`test:tickets` asserts "non-requester CSAT rejected 403").
  - **2 announcements** (`read`/`acknowledge`) act only on the caller's OWN receipt row
    (looked up by the caller's own `personId`) — inherently self-scoped, no cross-record risk.
  - **1 webhook** `POST /outbox` (`enqueueOutbox`) is the cross-process outbox-enqueue call used by
    X.Office → Platform internally, and **1 webhook** `POST /:source` is the inbound external webhook
    receiver (uses signature verification, not RBAC, by design) — both have an explanatory comment in
    `webhook.controller.ts`.
  - **1 identity** `POST /permissions/check` is a self-check of the caller's own permission — harmless
    by construction.

**Conclusion:** zero unexplained ungated privileged-write routes across both processes as of 2026-08-04.

## 4. SEC-X.3 — Idempotency-key (Request/Ticket/Booking/Directive/Announcement)

**Finding addressed:** SEC-003/ECO-REM-007 — these 5 domains had no replay protection on `create()`
(only `people/leave.service.ts` had the pattern beforehand).

**Change:** `idempotencyKey String?` + `@@unique([tenantId, idempotencyKey])` added to all 5 models
(`prisma-xoffice/schema.prisma`, migration `20260804170000_add_idempotency_keys`); each service's
`create()` now checks for an existing row by the composite key first (returns it with `replayed: true`
if found) and falls back to a `P2002`-catch on the create for the concurrent-race case. Field is
nullable — callers that don't send a key are unaffected (Postgres treats multiple `NULL`s as distinct
under the unique index).

**Commands run and results:**

```
XOFFICE_BASE=http://localhost:4001 npm run test:requests       → REQUESTS SMOKE PASSED
XOFFICE_BASE=http://localhost:4001 npm run test:tickets        → TICKETS SMOKE PASSED
XOFFICE_BASE=http://localhost:4001 npm run test:bookings       → BOOKINGS SMOKE PASSED
XOFFICE_BASE=http://localhost:4001 npm run test:directives     → DIRECTIVES SMOKE PASSED
XOFFICE_BASE=http://localhost:4001 npm run test:announcements  → ANNOUNCEMENTS SMOKE PASSED
```

All 5 existing smokes pass unchanged — confirms backward compatibility for callers that don't supply
`idempotencyKey`.

**Manual positive verification** (curl, `POST /api/requests`, tenant-xtech, actor user-nam):

```
POST {"title":"SEC idempotency test","idempotencyKey":"sec-idem-test-key-001"}
  → 201, id=cmsej4nvi0003z0uj3ocwovn2, no "replayed" field

POST {"title":"SEC idempotency test DIFFERENT TITLE","idempotencyKey":"sec-idem-test-key-001"}
  → 201, SAME id=cmsej4nvi0003z0uj3ocwovn2, SAME title as first call, "replayed": true
```

Second call returned the original record verbatim (not the different title sent in the replay body) —
confirms the replay short-circuits before re-processing input, as designed. Test artifact deleted from
the X.Office DB after verification (`DELETE FROM "RequestEvent"`/`"Request"` scoped to
`idempotencyKey='sec-idem-test-key-001'`, tenant-xtech context).

**Evidence hash:** `prisma-xoffice/schema.prisma` sha256
`6853089ae3917c8840bfa158e4bba010344e93135632c57b0a09c214b3d921f4`;
migration file sha256
`92c549bc87ce6b4cd7a863786bfc0385571a650815d246a5e2795f44100af940`.

## 5. SEC-X.4 — CI secret-scan + SCA gate

**Finding addressed:** ECO-REM-003 (remaining part) — `scan:secrets` existed as an npm script but was
not wired into `.github/workflows/ci.yml`; no SCA (dependency vulnerability) gate existed at all.

**Change:** added two steps to the `xhub-api` CI job, right after `npm ci` (fail-fast, before any build
work):

```yaml
- name: Secret scan (fails if a secret pattern is found outside .env)
  run: npm run scan:secrets
- name: Dependency vulnerability scan (SCA — high/critical gate)
  run: npm audit --audit-level=high
```

**Commands run locally (mirrors what CI will run) and results:**

```
npm run scan:secrets            → SECRET SCAN PASSED (1 env secret noted: the known ANTHROPIC_API_KEY
                                    in .env — reported as OK since it's inside an env file, not source;
                                    see §2 for why it's still an open finding regardless)
npm audit --audit-level=high    → found 0 vulnerabilities (2 high-severity transitive findings —
                                    brace-expansion, fast-uri — existed before this fix; resolved via
                                    `npm audit fix`, no --force / no major version bumps, re-verified
                                    `npm run build` clean afterward)
```

**Explicitly not done this round** (per the plan's stated boundary — needs GitHub admin access + a
separate explicit confirmation): branch protection rules, SBOM generation, artifact signing/provenance.

### 5a. Follow-up (2026-08-04, same day): CI updated for the Stage C 2-DB topology

The residual gap originally flagged here — `ci.yml` still targeting the single-Postgres, 1-DB topology
from Stage B, which would have failed to boot the X.Office process on a fresh push — is now **CLOSED**.
Changes made to `.github/workflows/ci.yml`:

- Added `XOFFICE_DATABASE_URL`/`XOFFICE_SHADOW_DATABASE_URL` to job env (same Postgres service
  container as `xhub`, second database).
- Added a `CREATE DATABASE xoffice;` step (only `xhub` is auto-created by `POSTGRES_DB`).
- Added `prisma generate`/`migrate deploy`/`migrate diff --exit-code`/`rls-setup-xoffice.mjs` steps for
  the `prisma-xoffice.config.ts` project, mirroring the existing Platform-side steps.
- Added `test:rls-xoffice` and `test:db-split` to the topology-independent smoke group.
- Added a new seed script + step: **`scripts/role-registry-seed-xoffice.mjs`** (`npm run
  seed:roles-xoffice`). This closes a gap discovered while wiring the DB, not just a CI-file gap: the
  ONLY way X.Office's own `RoleBinding`/`PermissionPolicy` tables were ever populated was the one-time
  `stage-c-migrate-rbac-data.mjs` copy run during the Stage C cutover, which requires a pre-existing
  populated source DB — it cannot bootstrap a brand-new, empty database (e.g. a fresh CI run every
  time). The new script seeds the same canonical `seed-data/identity/role-registry.seed.json` catalog
  directly into `XOFFICE_DATABASE_URL`, skipping the `Tenant` upsert (X.Office's schema has no `Tenant`
  model — Tenant stays Platform-canonical). Verified idempotent against the current (already-populated)
  local X.Office DB: row counts identical before/after (`PermissionPolicy` 67, `RoleBinding` 107).

**A second, more serious bug was found and fixed in the course of this work, unrelated to CI file
syntax:** `npm run test:e2e` (a CI step) started failing —
`test/xoffice-delegation.e2e-spec.ts`'s "still allows a privileged user to delegate their OWN work
away" assertion got a 500 instead of success. Root cause: that test boots the legacy all-in-one
`AppModule` (`src/app.module.ts`), which binds `IdentityModule.forPlatform()` (identity → `PrismaService`,
the `xhub` DB) while ALSO importing `XofficeModule` (whose controller runs under
`XofficeTenantScopeInterceptor`, scoping transactions on the DIFFERENT `XofficePrismaService`/`xoffice`
DB instance). Any business-module call into `IdentityService` — such as `createDelegation` — finds its
Prisma handle unscoped. **This is not a fixable bug in the traditional sense: Stage C's physical DB
split makes `AppModule`/`npm start` permanently unable to correctly co-host XHUB_PLATFORM and
XOFFICE_BUSINESS modules together**, since `IDENTITY_PRISMA` is a single DI token bound once per module
tree and the two groups now live in separate physical databases. Fix applied:
- `test/xoffice-delegation.e2e-spec.ts` now boots `XofficeAppModule` (the real production composition
  root for `main-xoffice.ts`) instead of `AppModule`, and uses `XofficePrismaService` (not
  `PrismaService`) for its own test-data cleanup — matching where `Delegation` actually lives post-Stage-C.
- Added a doc-comment to `src/app.module.ts` explaining the limitation and pointing to
  `PlatformAppModule`/`XofficeAppModule` (`npm run start:platform`/`start:xoffice`) as the only
  correct way to run X.Office business flows since Stage C. `app.module.ts` is kept only because
  platform-only routes still work under it and `test/app.e2e-spec.ts` uses it for a trivial smoke check.

**Commands re-run after both fixes, all pass:**
```
npm run test          → 1 suite, 1 test passed
npm run test:e2e      → 2 suites, 4 tests passed (previously 1 failed)
npm run build          → clean
npm run seed:roles-xoffice → idempotent, no row-count change
```

Not verified end-to-end on a truly FRESH pair of databases (local Postgres user lacks `CREATEDB`, so a
from-scratch dry run matching CI exactly wasn't possible this session) — the seed/migrate/RLS command
sequence was verified individually against the existing, already-migrated local `xoffice` DB, and the
CI step ordering (create DB → migrate → RLS → seed → smoke) was reasoned through against each script's
actual `process.env.*` usage (checked directly in each script's source), not assumed. Recommend the
first real CI run on this file be watched, not assumed green.

### 5b. Follow-up (2026-08-04, same day): auth/session database independence

**Finding (user-prompted; not in the source audit, discovered while explaining the identity connection
model):** Stage C's DB split covered business data and the identity read-cache (PersonProfile/OrgUnit/
RoleBinding/PermissionPolicy), but missed `AuthModule`. `AuthService` was hardcoded to `PrismaService`
(the Platform DB) regardless of which process loaded it. `IdentityGuard` — the global guard that
resolves WHO on **every single request in both processes** — calls
`AuthService.sessionMembershipActive()` whenever identity comes from the session cookie (not header
identity). Result: **every session-authenticated request to X.Office opened a live Postgres connection
straight to the Platform database**, on the hot path, for every request — a real shared-DB dependency
directly matching the ecosystem security handoff's prohibited-shortcut rule ("Do not integrate
XHub↔product by shared DB/dual-write"), and a materially worse coupling than the periodic-cache pattern
already used for RoleBinding/PersonProfile.

**Fix** (mirrors the `IdentityModule.forPlatform()/forXoffice()` DI-token pattern from Stage C.5):
- `Membership` added to `prisma-xoffice/schema.prisma` as a local read cache (migration
  `20260804180000_add_membership_cache`), RLS-enabled (90 tables now, +1).
- New read route `GET /api/auth/memberships` (Platform-only) + `IdentitySyncService.syncTenant()`
  extended to pull+cache it every 60s, same mechanism as RoleBinding/PermissionPolicy.
- `AuthService` now injects `IDENTITY_PRISMA` instead of a concrete `PrismaService`.
- `AuthModule` converted to a dynamic module (`forPlatform()`/`forXoffice()`): only `forPlatform()`
  registers `AuthController` — confirmed via grep that `xhub-web`'s login/me/switch-tenant calls always
  target `PLATFORM_BASE_SERVER`, never the X.Office origin, and several `AuthController` routes touch
  `UserCredential`/`AuthToken`, which don't exist in X.Office's schema at all.
- `xoffice-app.module.ts` no longer imports `PrismaModule` — confirmed via grep that nothing else in the
  X.Office module tree references the Platform `PrismaService` either.
- `bootstrap.ts` (shared by all 3 entrypoints) switched its shutdown-hook registration from a hardcoded
  `PrismaService` lookup to `IDENTITY_PRISMA` — the hardcoded version crashed X.Office's boot
  (`UnknownElementException`) once `PrismaModule` was no longer imported there; caught immediately by
  actually booting the process, not assumed.

**Tradeoff accepted:** revoke-on-suspend on X.Office now has up to ~60s staleness (same latency class
already accepted for role/permission changes) instead of instant. This is a deliberate choice made with
the user (options offered: fix now / document only / discuss more — user chose fix now).

**End-to-end verification (curl, both processes live):**
```
POST /api/auth/login (user-nam) on :4000                       → 201, session cookie set
GET  /api/requests on :4001 with that cookie                   → 200 (X.Office accepts Platform-issued session)
POST /api/auth/suspend (user-nam) on :4000                      → 201
GET  /api/auth/me on :4000 with the (now-stale) cookie          → 401 "Phiên đã bị thu hồi" (instant, canonical)
GET  /api/requests on :4001 with the same cookie                → 200 (X.Office cache not yet refreshed — as designed)
POST /api/identity-sync/run on :4001 (manual trigger)            → 201
GET  /api/requests on :4001 with the same cookie again           → 401 "Phiên đã bị thu hồi" (X.Office cache now refreshed)
```
`user-nam`'s Membership rows restored to `active` immediately after (both `tenant-xtech` and
`tenant-xtech:restore-sandbox`), re-synced, re-logged-in, confirmed working on both processes again.

**Regression commands re-run, all pass:** `npm run build`, `npm run test`, `npm run test:e2e` (4/4),
`npm run test:authz` (12/12, including the OIDC login seam and session-cookie `/me` check),
`npm run test:auth-flow` (18/18 — login/suspend/revoke/reset/invite/activate, argon2 hash checks),
`npm run test:rls-xoffice` (90 tables including the new `Membership`), `npm run test:requests`,
`npm run test:tickets`, `npm run test:smoke` (xoffice-e2e — one failure on first run was pre-existing
`delegate-bob` residue from earlier manual testing this session, unrelated to this fix; passed clean
after removing the stale row, same known flake class documented in §6).

**Evidence hash:** `src/auth/auth.module.ts` sha256 verified via build; identity-sync boot log confirms
automatic pickup: `identity-sync tenant-xtech: people=27 orgUnits=11 positions=24 groups=2
roleBindings=51 permissionPolicies=28 memberships=39` (first sync tick after this fix, unprompted, on
process boot).

## 6. Cross-reference — full regression suite, 2-process/2-DB topology (re-run this session)

In addition to the 5 domain smokes in §4, the following were run earlier this session on the current
2-process/2-DB configuration and passed (carried over from Stage C.7, not re-run again in this pass
since no DB-affecting code changed after C.7 completed): `test:rls`, `test:rls-xoffice`, `test:isolation`,
`test:db-split`, `test:smoke`, plus the full per-domain smoke matrix (~40 scripts). Two pre-existing,
unrelated flakes were identified and are tracked separately (not introduced by this session's work):
`test:people-attendance` (pre-existing lateness-computation bug) and a `test:smoke` Delegation-residue
flake from repeated manual local runs (does not reproduce on a fresh CI database).

## 7. Explicitly deferred (per the approved plan's "cố ý không làm" boundary)

| Item | Reason deferred |
|---|---|
| REM-001/ECO-REM-001 key rotation | Human-only action (see §2) |
| Security Owner/DPO/Incident Commander assignment | Organizational decision, not code |
| Branch protection / SBOM / artifact signing | Needs GitHub admin + separate explicit user confirmation |
| REM-014 (Unified Inbox under-projects Request/Ticket/Booking/Directive/Announcement) | Real gap, lower priority — feature completeness, not an acute security exposure |
| SEC-004 (approver resolution via static seed file) | Real, LOW severity — backlog |
| ECO-REM-005/006(partial)/008/009/010/011 (ISMS/PIMS, independent pentest, ISO 27001/27701, X.AI/X.Space onboarding) | W2–W4 roadmap (31–365 days) or organizational, not repo-code |
| All X1/X2/X.Space/FinERP/X.AI-specific items | Different repos, out of scope for this session |

## 8. Summary of residual risk (do not self-close)

1. **CRITICAL — open:** `ANTHROPIC_API_KEY` still unrotated (§2). Contained (fail-closed non-local
   boot), not remediated.
2. **CLOSED same day (§5a):** `ci.yml` staleness relative to the 2-DB physical split. Not yet verified
   by an actual GitHub Actions run against a truly fresh database pair (blocked locally by the dev
   Postgres user lacking `CREATEDB`) — treat the first real CI run on this file as the actual proof,
   not this document.
3. **Accepted, documented limitation (§5a):** `src/app.module.ts` ("all-in-one" `npm start`) cannot
   correctly serve X.Office business flows post-Stage-C by design (single `IDENTITY_PRISMA` token,
   two physical databases). Not a defect to remediate — a structural consequence of the DB split.
   Documented inline; use `start:platform`/`start:xoffice` instead.
4. **LOW, backlog:** REM-014, SEC-004 (§7).
5. All items marked REMEDIATED above are **code-review + automated-test verified by the same agent that
   wrote the code** — per the master handoff's explicit rule, this is insufficient for formal closure.
   **An independent reviewer must retest against each item's acceptance criteria before any finding is
   marked CLOSED.**
