# Engineering Hub API reference (client side)

Self-contained copy of the relevant parts of `xhub-saas`'s
`docs/implementation/engineering-hub/INTEGRATION_CONTRACT_CI.md`, for use
from a repo that does not have that file. If both are available, the
`xhub-saas` copy is the source of truth — this one may lag behind it.

Base URL: `ENGINEERING_HUB_URL` (the XHub Platform process, e.g.
`http://localhost:4000` in dev — this is a different process from X.Office
even inside `xhub-saas`).

## POST /api/engineering/ci/callback (HMAC-signed)

**Signing:** hex `HMAC-SHA256(rawRequestBodyBytes, WEBHOOK_SIGNING_SECRET)`
in header `x-webhook-signature`. Sign the EXACT bytes sent as the body — do
not re-serialize after signing (whitespace/key-order differences break
verification).

| Field | Type | Required |
|---|---|---|
| `productCode` | string | yes |
| `source` | string | yes |
| `externalId` | string | yes — same id across QUEUED→RUNNING→SUCCESS updates one row |
| `commitSha` | string | yes |
| `branch` | string | no |
| `status` | `QUEUED\|RUNNING\|SUCCESS\|FAILURE\|CANCELLED` | yes |
| `workflowRunUrl` | string | no |
| `triggeredBy` | string | no |
| `startedAt` / `finishedAt` | ISO datetime | no |
| `metadata` | object | no |

Responses: `200`/`201` ok · `400` bad payload/unknown productCode ·
`401` missing/forged signature.

## POST /api/engineering/test-results (open)

```json
{ "testCaseId": "...", "productVersionId": "...", "status": "PASS", "actualResult": "...", "notes": "..." }
```

`status`: `NOT_RUN|PASS|FAIL|BLOCKED|NOT_APPLICABLE|NEEDS_CLARIFICATION`.
Append-only — every call adds a new row, never overwrites the previous one.

## POST /api/engineering/defects (open create, gated transition)

```json
{ "productId": "...", "productVersionId": "...", "testCaseId": "...", "testResultId": "...", "title": "...", "severity": "P1" }
```

`severity`: `P0|P1|P2|P3` (default `P2`). Idempotent on `testResultId`.
`PATCH /api/engineering/defects/:id/status` (triage/close) requires the
`engineering.defect.manage` permission — a real XHub identity, not this
skill's use case.

## Known limitations

- One shared HMAC secret across all CI producers today — no per-repo secret
  yet (planned: per-`RepositoryConnection` secrets).
- `test-results`/`defects` are open by permission but still resolve to SOME
  caller identity server-side (session → header fallback → default demo
  persona) — there is no real service-identity mechanism for an external
  repo's CI to call these two in production yet. Confirm with the Engineering
  Hub's maintainers before wiring either into real automation.
- `BuildRecord` answers "did this CI run pass", not "what is deployed where".
