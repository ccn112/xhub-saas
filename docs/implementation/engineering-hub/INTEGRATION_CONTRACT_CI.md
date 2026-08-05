# INTEGRATION_CONTRACT_CI — reporting into the Engineering Hub from another repo

Status: **contract only**. Nothing in this document is DG-08 (ecosystem
rollout) — no code was changed in X1, X2, FinERP, or X.Space this pass, and
this repo (`xhub-saas`) does not call out to them either. This is the
standing spec those repos' own future work must follow when DG-08 actually
starts (see `IMPLEMENTATION_PLAN.md`). It exists now because DG-06 was built
and *proven end-to-end inside this repo* (xhub-saas's own CI reports its own
build status — see `scripts/report-ci-build.mjs` and the "Report build
status to Engineering Hub" step in `.github/workflows/ci.yml`), so the
contract below is not speculative: it is the exact path that already works,
written down for a second repo to copy.

A ready-to-load Claude Code Skill implementing this contract lives at
`docs/implementation/engineering-hub/skills/report-to-engineering-hub/`.

## Prerequisite: the product must already be registered

Every endpoint below is keyed by `productCode`, which must already exist in
the Product Registry (DG-01, `Product.code`). The 6 ecosystem products are
already seeded (`seed-data/engineering/products.seed.json`):
`PRD-XHUB`, `PRD-XOFFICE`, `PRD-X2`, `PRD-X1`, `PRD-FINERP`, `PRD-XSPACE`. A
repo integrating for the first time does not create its own Product row —
that is a Platform admin action (`POST /api/engineering/products`,
`engineering.product.manage`), done once, out of band.

## Base URL

All endpoints are served by the **XHub Platform** process (not X.Office):
`PLATFORM_API_URL`, default `http://localhost:4000` in dev. In a real
multi-repo deployment this must be the Platform's real reachable base URL
(e.g. a staging/production hostname) — not `localhost`.

## 1. CI / build status — `POST /api/engineering/ci/callback`

The only endpoint that is signature-verified (HMAC-SHA256), because the
caller (a CI runner) has no XHub identity at all.

**Signing.** Compute `HMAC-SHA256(rawRequestBody, WEBHOOK_SIGNING_SECRET)`,
hex-encoded, sent as header `x-webhook-signature`. This reuses the SAME
secret and helper (`src/webhook/hmac.util.ts`) already used for inbound
tenant webhooks — see "Known limitations" below for why this is an MVP
simplification, not a final design.

```js
import { createHmac } from 'node:crypto';
const raw = JSON.stringify(payload);
const signature = createHmac('sha256', WEBHOOK_SIGNING_SECRET).update(raw, 'utf8').digest('hex');
// POST with header 'x-webhook-signature': signature, body: raw (exact same bytes signed)
```

**Payload:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `productCode` | string | yes | must already exist, e.g. `"PRD-X1"` |
| `source` | string | yes | e.g. `"github-actions"`, `"gitlab-ci"` |
| `externalId` | string | yes | CI run id — the SAME id reported again (QUEUED→RUNNING→SUCCESS) **updates the same row**, it does not append |
| `commitSha` | string | yes | |
| `branch` | string | no | |
| `status` | string | yes | one of `QUEUED`, `RUNNING`, `SUCCESS`, `FAILURE`, `CANCELLED` |
| `workflowRunUrl` | string | no | link back to the CI run |
| `triggeredBy` | string | no | actor/username |
| `startedAt` / `finishedAt` | ISO datetime | no | |
| `metadata` | object | no | free-form JSON, e.g. test counts |

**Responses:** `200`/`201` recorded/updated · `400` bad payload or unknown
`productCode` · `401` missing/forged signature (this is the AT-009 scenario
— logged server-side, not written to a tenant AuditLog since this endpoint
is platform-wide, not tenant-scoped).

## 2. Test result — `POST /api/engineering/test-results`

Records one outcome of one `TestCase` against one `ProductVersion`. **Open**
(no HMAC, no permission gate) — matches this repo's own `/docs/test`
checklist posture of "any authenticated tester can record their own result".
Append-only: recording again never overwrites, it adds history.

```json
{ "testCaseId": "...", "productVersionId": "...", "status": "PASS", "actualResult": "...", "notes": "..." }
```

`status` is one of `NOT_RUN | PASS | FAIL | BLOCKED | NOT_APPLICABLE | NEEDS_CLARIFICATION`.
`testCaseId` must already exist (create it first via `POST /api/engineering/test-suites`
then `POST /api/engineering/test-cases` if the repo owns cases not yet modeled here).

## 3. Defect — `POST /api/engineering/defects`

Files a defect, optionally straight off a FAIL result. **Open** for create
(same reasoning as test-results — it's the direct next step after an open
action); the FSM transition (`PATCH /api/engineering/defects/:id/status`,
triage/close) IS gated (`engineering.defect.manage`) — that is a real
governance decision, not self-service.

```json
{ "productId": "...", "productVersionId": "...", "testCaseId": "...", "testResultId": "...", "title": "...", "severity": "P1" }
```

Idempotent on `testResultId`: filing twice from the same FAIL result returns
the existing defect. `severity` one of `P0|P1|P2|P3` (default `P2`); `code`
auto-generates as `DEF-<PRODUCT_CODE>-NNNN` if omitted.

## Known limitations (be honest, not aspirational)

- **Shared HMAC secret.** Every CI producer signs with the same
  `WEBHOOK_SIGNING_SECRET` — there is no per-repo secret yet. A compromised
  secret in one repo's CI config affects all producers. Per-connection
  secrets (using the already-inert `RepositoryConnection` rows from DG-01)
  are the stated V2 hardening, not done in this pass.
- **No service-identity mechanism for test-results/defects.** Those two
  endpoints are open by permission, but the global `IdentityGuard` still
  resolves *some* identity per request (session → `x-user-id`/`x-tenant-id`
  header → default demo persona — see `SEC-X.2` canonical tenant-context
  doc). A real external repo has no XHub session and today would rely on the
  header-identity fallback, which is explicitly a dev/E2E affordance
  (`AUTH_ALLOW_HEADER_IDENTITY`), not a production cross-repo credential.
  DG-08 needs a real answer here (e.g. extend HMAC signing to these routes
  too, or a dedicated per-product service account) before any external repo
  actually calls these two endpoints in production.
- **BuildRecord is per-run, not per-deployment.** It answers "did this CI
  run pass", not "what is deployed in environment X" — that is the
  Release/Deployment tracking still listed as not-built in
  `IMPLEMENTATION_PLAN.md`.
