# Security — xhub-api

## Secrets policy (hard invariant)

- **No credential, password, secret, token, or API key is ever stored in the
  database.** Authentication is delegated to the IdP; identity rows carry no
  secret. Backup manifests and document metadata are secret-scanned on write
  (`SECRET_FIELD_REGEX` / `assertNoSecretFields`).
- **Secrets live only in `.env` / `.env.*`**, which are gitignored (see
  `.gitignore`). `.env.example` is the committed template and contains only empty
  placeholders.
- Run `npm run scan:secrets` to scan the repo source for high-entropy strings and
  known secret patterns (Anthropic `sk-ant-`, AWS `AKIA…`, private-key blocks,
  Google/Slack tokens, generic `key/secret/token/password = "…"` assignments).
  It **fails (exit 1)** if a secret is found **outside** an `.env*` file. It runs
  over source only (excludes `node_modules`, `.git`, `dist`, `.next`, `storage`,
  lockfiles).

## Environment secrets

| Env var                  | Purpose                                             | Stored in DB? |
| ------------------------ | --------------------------------------------------- | ------------- |
| `ANTHROPIC_API_KEY`      | Claude API key for the AI copilot (live mode)       | No            |
| `WEBHOOK_SIGNING_SECRET` | Verify inbound webhook HMAC-SHA256 signatures       | No            |
| `BACKUP_ENCRYPTION_KEY`  | AES-256-GCM key for backup bundles at rest          | No            |
| `AUTH_JWT_SECRET`        | Sign the `xhub_session` JWT                         | No            |
| `DATABASE_URL`           | Postgres connection (password percent-encoded)      | No            |

The webhook signing secret is used ONLY to verify signatures at intake; it is
never persisted (only the boolean verification result is stored on
`WebhookEvent.signatureValid`).

## API key rotation procedure (ANTHROPIC_API_KEY)

The Anthropic key is a **live secret** and must be provided via env only — never
committed. To rotate:

1. Sign in at <https://console.anthropic.com/settings/keys>.
2. **Create a new key**, then **revoke/delete the old key** so any exposed value
   is dead.
3. Update `ANTHROPIC_API_KEY` in the local/deploy `.env` (never in tracked
   files). Restart the server.
4. Confirm `npm run scan:secrets` passes (the key must appear only in `.env`).

> **Best-effort startup guard.** `src/main.ts` holds a small allowlist of
> **fingerprints** (sha256 prefixes) of keys known to have been exposed — never
> the keys themselves. If the running `ANTHROPIC_API_KEY` matches one, the server
> logs a loud `[SECURITY]` warning at boot telling the operator to rotate. After
> rotating, the new key's fingerprint won't match and the warning disappears.

### ⚠️ Action required by a human

The `ANTHROPIC_API_KEY` currently in `.env` (fingerprint `d9d24a2d90654ea4`) has
been exposed and **must be rotated at <https://console.anthropic.com>** by a
person. This cannot and must not be done automatically. Rotate it, revoke the old
key, and replace the value via env only.

---

## Authentication & Authorization (hardening)

Authorization is layered on top of the identity RBAC/ABAC engine (`src/identity`)
and is **additive + env-gated** — default runtime behaviour is unchanged so the
demo and every smoke stay green.

### Identity resolution (authentication)

`IdentityGuard` (global, soft) resolves WHO on every request, in precedence:

1. **Session** — the `xhub_session` JWT cookie (issued by `POST /api/auth/login`
   or the OIDC callback). This is the primary, production identity.
2. **Header** — `x-user-id` / `x-tenant-id`. DEV/E2E/legacy-FE convenience,
   gated by `AUTH_ALLOW_HEADER_IDENTITY` (default `true`). When set to `false`
   and there is no valid session, the request resolves to an **anonymous**
   identity and any protected route returns **401**.
3. **Default** — the demo persona (`user-nam` / `tenant-xtech`).

`POST /api/auth/login` validates the identifier against the seeded users /
memberships (`AuthService.login`) — it never mints an identity for an arbitrary id.

### Authorization enforcement

`PermissionGuard` (global) acts only on handlers tagged with
`@RequirePermission('perm.code')`. Untagged routes pass through.

- **`AUTH_ENFORCE=false`** (default): NO-OP (debug log only). Demo/dev unchanged.
- **`AUTH_ENFORCE=true`** (production): the guard calls
  `IdentityService.can(userId, permCode)` (the single source of truth — no new
  permission logic) and throws **403** if the caller lacks the permission. An
  anonymous caller gets **401** first, regardless of enforcement.

The permission decision reuses the shared identity plane and runs under
`withBypass` (guards run before any tenant transaction is opened).

**Gated endpoints → permission codes** (all codes exist in the identity seed).
Updated 2026-08-04 (security/privacy audit remediation — see
`../docs/implementation/xoffice-ai/ACCEPTANCE_EVIDENCE.md` (repo root) for the
full inventory and evidence trail):

| Endpoint | Permission |
| --- | --- |
| `POST /api/controlplane/tenant-applications` (enable app) | `provisioning.manage` |
| `POST /api/controlplane/app-account-bindings` (bind) | `provisioning.manage` |
| `POST /api/controlplane/provisioning-commands/:id/retry` | `provisioning.manage` |
| `POST /api/controlplane/reconcile` | `provisioning.manage` |
| `POST /api/backup` (create) | `backup.manage` |
| `POST /api/backup/:id/restore` | `backup.manage` |
| `POST /api/records` (create) | `records.manage` |
| `POST /api/records/:id/versions` (add version) | `records.manage` |
| `POST /api/identity/assignment/preview` (writes snapshot) | `identity.manage` |
| `GET /api/identity/permissions/effective` | `identity.read` |
| `PATCH/POST/DELETE /api/identity/org-units*` (reparent/create/delete) | `org.write` |
| `PATCH /api/identity/positions/:id` (move/set holder) | `position.write` |
| `POST /api/mdm/import-jobs*`, `duplicate-pairs/:id/resolve`, `PUT tenant-overlays` | `mdm.manage` |
| `POST /api/webhooks/reconcile`, `POST /api/webhooks/dispatch` | `platform.webhook.manage` |

The last four rows were added 2026-08-04: these routes previously had **zero**
permission gate (any authenticated tenant member could reparent/delete org
units, move positions, run MDM import/merge, or trigger webhook
reconcile/dispatch). `org.write`/`position.write`/`mdm.manage` are covered by
the existing `ORG_ADMIN` (`org.*`, `position.*`) and `DATA_STEWARD` (`mdm.*`)
roles; `platform.webhook.manage` and `PLATFORM_ADMIN`'s `*` cover the webhook
routes without any new role-seed change.

### Object-level authorization (BOLA prevention)

A route-level permission (`@RequirePermission`) proves the caller holds a
ROLE — it does not prove the caller owns the SPECIFIC record being acted on.
Several lifecycle-transition routes in Request/Ticket/Booking/Directive were
found (2026-08-04 audit) reachable by ANY authenticated tenant member
regardless of role, because the underlying generic transition method
(`RequestsService.act`, `TicketsService.transition`,
`BookingsService.transition/checkIn/checkOut`,
`DirectivesService.commitmentAct`) had no actor check at all — a classic BOLA
(OWASP API1:2023). Fixed by adding an explicit ownership gate inside each of
those methods: the action is allowed only for the record's own
requester/assignee, or a caller holding the domain's `*.manage`/`.issue`
permission as a manager override. See the affected `*.service.ts` files for
the exact `assert*Actor` helper in each module.

### Tenant context (multi-tenant isolation)

`identity.tenantId` is resolved via the SAME precedence as identity above
(session → header → default) — there is no separate "tenant" resolution
mechanism to bypass. Every request is wrapped by `TenantScopeInterceptor`
(XHub Platform) or `XofficeTenantScopeInterceptor` (X.Office) in
`prisma.withTenant(identity.tenantId)`, which `SET LOCAL app.current_tenant`
for the request's transaction — Postgres Row-Level Security is the FINAL
backstop even if a service forgets to filter by tenant explicitly (a query
run with no tenant context set returns **zero rows**, fail-safe, never another
tenant's data).

Since Phase 1.5 Stage C (2026-08-04) the platform runs as **two physically
separate processes and two separate Postgres databases** (`xhub` for XHub
Platform, `xoffice` for X.Office) — RLS is enforced independently in each.
Isolation evidence: `npm run test:rls` (Platform DB, 105 tables),
`npm run test:rls-xoffice` (X.Office DB, 89 tables), `npm run test:isolation`
(seed-level MUST_NOT_LEAK guard), `npm run test:db-split` (negative test
proving the two databases are genuinely separate Postgres instances, not a
shared schema pretending to be split).

`user-nam` (→ `usr-cfo`) and the CEO (`usr-ceo`) hold the `ROLE_PLATFORM_ADMIN`
role (seed) which grants all of the above, so an enforced run still lets the
admin through. A low-privilege person such as `user-huyvu` (→ `usr-it-support`,
`ROLE_IT_SUPPORT`) is denied.

### Auth/session database independence (fixed 2026-08-04, same day as the DB split)

Stage C's DB split (above) only covered business data and the identity CACHE
(PersonProfile/OrgUnit/RoleBinding/PermissionPolicy). It missed `AuthModule`:
`AuthService` was still hardcoded to `PrismaService` (the Platform DB) even
when running inside the X.Office process. Since `IdentityGuard` (the global
guard resolving WHO on every single request, in both processes) calls
`AuthService.sessionMembershipActive()` whenever identity comes from the
session cookie, **every session-authenticated request to X.Office opened a
live Postgres connection straight to the Platform database** — a real
shared-DB dependency the "physical DB split" was supposed to have eliminated
(this directly matches the ecosystem security handoff's prohibited-shortcut
rule: *"Do not integrate XHub↔product by shared DB/dual-write"*).

Fixed the same way `IdentityModule`/`IdentityService` were split in Stage C.5:
- `AuthService` now injects `IDENTITY_PRISMA` (see `identity-prisma.token.ts`)
  instead of a concrete `PrismaService` — resolves to `PrismaService` in the
  Platform process, `XofficePrismaService` in X.Office.
- `Membership` (the table `sessionMembershipActive` reads) is now ALSO a local
  read cache in X.Office (`prisma-xoffice/schema.prisma`), synced by
  `IdentitySyncService` every 60s (same mechanism/cadence as
  PersonProfile/RoleBinding) via a new read route, `GET /api/auth/memberships`.
- `AuthModule` became a dynamic module (`forPlatform()`/`forXoffice()`,
  mirroring `IdentityModule`): only `forPlatform()` registers `AuthController`
  — X.Office never served `/api/auth/login`/`invite`/`activate`/etc. anyway
  (confirmed: `xhub-web`'s login/me/switch-tenant calls always target
  `PLATFORM_BASE_SERVER`), and several of those routes touch
  `UserCredential`/`AuthToken`, which don't exist in X.Office's schema.
- `xoffice-app.module.ts` no longer imports `PrismaModule` at all — nothing in
  the X.Office process needs the Platform database anymore. `bootstrap.ts`
  (shared by all 3 entrypoints) was updated to fetch `IDENTITY_PRISMA` instead
  of a hardcoded `PrismaService` for its shutdown-hook registration, since that
  hardcoded lookup would otherwise crash the X.Office process boot.

**Tradeoff accepted:** revoke-on-suspend on the X.Office side now has up to
~60s staleness (same latency class already accepted for role/permission
changes) instead of being instant. Verified end-to-end (2026-08-04): suspended
`user-nam`'s membership via Platform → immediately 401 on Platform (canonical,
instant) → still 200 on X.Office (stale cache, as designed) → triggered
`POST /api/identity-sync/run` → immediately 401 on X.Office too. Also verified:
`npm run test:e2e`, `test:authz`, `test:auth-flow`, `test:rls-xoffice` (90
tables now, +`Membership`), and the full X.Office domain smoke matrix all pass
unchanged.

### Feature flags (`.env.example`)

| Var | Default | Production |
| --- | --- | --- |
| `AUTH_ENFORCE` | `false` | **`true`** |
| `AUTH_ALLOW_HEADER_IDENTITY` | `true` | **`false`** |
| `AUTH_OIDC_ENABLED` | `false` | `true` (with a real IdP) |
| `STAGING_STRICT` | `false` | `true` (staging) |

> **Production = `AUTH_ENFORCE=true` + `AUTH_ALLOW_HEADER_IDENTITY=false`.**

#### `STAGING_STRICT` (scaffold — inert this step)

Read via `isStagingStrict()` in `src/auth/identity.types.ts`. Default `false`.
It is **additive and currently has NO behavioural effect** — only the accessor
is exposed. A later phase uses it to convert degrade-demo fallbacks (soft
authz no-op, mock AI gateway, in-memory stand-ins) into **hard errors** so a
staging deployment cannot silently run in demo mode. Until then, setting it
changes nothing.

### Role registry (canonical roles)

The 16 pilot roles live in `seed-data/identity/role-registry.seed.json`
(mirrors handoff `data/ROLE_CATALOG.csv`) and are seeded as `PermissionPolicy`
rows (version 1, tenant `tenant-xtech`) by `npm run seed:roles`. Permission
checks are **wildcard-aware**: `permissionMatches()`
(`src/identity/permission-match.ts`) grants `tenant.user.invite` from a granted
`tenant.*`, grants everything from `*`, and keeps exact matches — used by
`IdentityService.can()`. `PLATFORM_ADMIN` (`["*"]`) is the canonical
super-admin; the legacy `ROLE_PLATFORM_ADMIN` policy still exists and both keep
working during migration.

### How `test:authz` toggles enforcement

To prove enforcement without changing the default runtime, the guard also honours
per-request **test-only headers** (mirroring controlplane's `__failUntilAttempt`
hook). They can only make a request *stricter*, never looser:

- `x-authz-enforce: true` — enforce authorization for this request.
- `x-authz-allow-header: false` — disable the header identity fallback (→ 401).
- `x-authz-oidc: true` — enable the OIDC routes for this request.

`test:authz` (`scripts/authz-smoke.mjs`) uses these to assert: admin ALLOWED
(2xx), low-priv DENIED (403), anonymous → 401, and the mock OIDC round-trip to a
session — all against the same single `:4000` server running with enforcement OFF.

### OIDC seam (adapter-ready, not a live IdP)

`OidcProvider` (`src/auth/oidc/oidc.provider.ts`) is the interface a real IdP
adapter (e.g. Azure AD) will implement. The only binding today is
`MockOidcProvider` (dev) which performs **no network I/O**: `GET
/api/auth/oidc/login` redirects to `GET /api/auth/oidc/callback` with a fake code
that resolves to a seeded PersonProfile and issues the same `xhub_session`
cookie. Routes are gated by `AUTH_OIDC_ENABLED` (default `false` → 503). Swapping
in a real IdP is a one-line DI change on the `OIDC_PROVIDER` token; nothing
downstream (session, `/me`, switch-tenant) changes. `AUTH_OIDC_ISSUER` /
`_CLIENT_ID` / `_CLIENT_SECRET` / `_REDIRECT_URI` are the placeholder env seams.
