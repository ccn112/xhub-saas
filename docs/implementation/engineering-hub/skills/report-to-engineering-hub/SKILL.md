---
name: Report to Engineering Hub
description: This skill should be used when the user asks to "report CI status to the Engineering Hub", "wire this repo's CI into XHub", "report build status to xhub-saas", "record a test result in the Engineering Hub", "file a defect in the Engineering Hub", or "integrate with the XHub Development & Quality Hub". Applies to any repo other than xhub-saas itself (X1/XBooking, X2/XBuilding, FinERP, X.Space) that needs to push its own CI build status, test results, or defects into the shared XHub Engineering Governance module.
version: 0.1.0
---

# Report to Engineering Hub

Push this repo's own CI build status, test results, or defects into the
XHub Engineering Governance module (`engineering-governance`, part of the
`xhub-saas` repo's Platform process). That module is the canonical registry
for Products/Versions/TestCases/Defects across the whole XTech ecosystem
(XHub, X.Office, X2, X1, FinERP, X.Space) — this skill is the client side of
that contract for a repo that is NOT `xhub-saas` itself.

This skill is a portable copy of `xhub-saas`'s own
`docs/implementation/engineering-hub/INTEGRATION_CONTRACT_CI.md` — the exact
contract `xhub-saas`'s own CI already uses on itself (see
`xhub-api/scripts/report-ci-build.mjs` in that repo). Nothing about this
skill assumes access to that repo; everything needed is in
`references/api-reference.md` and `scripts/report-build.mjs`.

## Before doing anything: confirm the product is registered

Every call below is keyed by a `productCode` (e.g. `PRD-X1`, `PRD-X2`,
`PRD-FINERP`, `PRD-XSPACE`) that must already exist in the Engineering Hub's
Product Registry. Do NOT try to create it from this repo — registering a new
product is a one-time Platform-admin action taken directly against
`xhub-saas`, out of band from this skill. If unsure whether the product
code is already registered, ask the user rather than guessing a code.

## Step 1: Get the two required secrets from the user

1. `ENGINEERING_HUB_URL` — the Platform's base URL (e.g.
   `https://api.xhub.example.com` in a real deployment, `http://localhost:4000`
   for local dev against a running `xhub-saas` Platform process).
2. `WEBHOOK_SIGNING_SECRET` — the shared HMAC secret used to sign CI
   callbacks. This is a real secret: never hardcode it, never commit it,
   never print it back. Ask the user how it is supplied in this repo's CI
   (a secret manager, a CI provider's encrypted secret store, etc.) and read
   it from environment at run time only.

Do not proceed to Step 2 by guessing or fabricating either value.

## Step 2: Report CI build status (signed, the only endpoint that needs a secret)

Use `scripts/report-build.mjs` (bundled with this skill) as-is, or port its
logic into the target repo's own CI script language. It:

1. Reads `ENGINEERING_HUB_URL`, `WEBHOOK_SIGNING_SECRET`, `PRODUCT_CODE`,
   and CI-provided values (commit SHA, branch, run id, actor, run URL) from
   environment variables — see the script's header comment for the exact
   variable names per CI provider (GitHub Actions vs. generic).
2. Computes `HMAC-SHA256(rawBody, secret)` hex and sends it as header
   `x-webhook-signature`.
3. POSTs to `{ENGINEERING_HUB_URL}/api/engineering/ci/callback`.
4. Never fails the calling pipeline on a reporting error (this is a
   best-effort side-report, not a build gate) — wire it with
   `continue-on-error` / the target CI's equivalent.

Call it once per build stage that matters (e.g. `QUEUED` at start, `SUCCESS`/
`FAILURE` at end) with the SAME `externalId` (the CI run id) each time — the
Hub updates one row per run, it does not create duplicates.

Full payload schema, response codes, and the exact HMAC recipe are in
`references/api-reference.md` — read it before modifying the script's
request-building logic.

## Step 3 (optional): Record test results or file defects

Only do this if the user explicitly asks for test/defect reporting, not as
an automatic extension of Step 2 — these two endpoints are open (no HMAC)
but still resolve to SOME caller identity server-side (see "Known
limitations" in `references/api-reference.md`); confirm with the user how
this repo should authenticate before wiring either one into real CI.

- `POST {ENGINEERING_HUB_URL}/api/engineering/test-results` — one outcome of
  one test case against one product version. Append-only: never overwrites.
- `POST {ENGINEERING_HUB_URL}/api/engineering/defects` — file a defect,
  optionally referencing a `testResultId` (idempotent — filing twice off the
  same result returns the existing defect, does not duplicate).

Exact payload shapes are in `references/api-reference.md`.

## What NOT to do

- Do not invent a `productCode` — confirm it with the user or check the
  Engineering Hub's product list first (`GET /api/engineering/products`, no
  auth needed for reads).
- Do not sign requests with a fabricated or placeholder secret "to test it
  out" — an unsigned/wrongly-signed request to `/ci/callback` correctly
  returns 401; that is the security boundary working, not a bug to route
  around.
- Do not add this repo's product/version/test-suite data by writing directly
  to any database — everything goes through the HTTP contract above.
- Do not treat a successful report as proof the target repo now has "live
  integration" with XHub in the DG-08 sense — this skill only covers CI/test/
  defect reporting, not identity, tenancy, or deployment integration.

## Additional Resources

- **`references/api-reference.md`** — full payload schema for all 3
  endpoints, HMAC signing recipe, response codes, known limitations.
- **`scripts/report-build.mjs`** — working, parameterized Node script for
  the CI callback; copy into the target repo's own scripts/ directory and
  wire into its CI config.
