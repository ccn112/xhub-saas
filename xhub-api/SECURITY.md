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

**Gated endpoints → permission codes** (all codes exist in the identity seed):

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

`user-nam` (→ `usr-cfo`) and the CEO (`usr-ceo`) hold the `ROLE_PLATFORM_ADMIN`
role (seed) which grants all of the above, so an enforced run still lets the
admin through. A low-privilege person such as `user-huyvu` (→ `usr-it-support`,
`ROLE_IT_SUPPORT`) is denied.

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
