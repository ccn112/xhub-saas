#!/usr/bin/env node
// Generic CI -> Engineering Hub build-status reporter. Portable: works from
// any repo, any CI provider that can run Node and set env vars. Mirrors
// xhub-saas's own xhub-api/scripts/report-ci-build.mjs (which reports on
// itself), generalized to ONE product driven by PRODUCT_CODE instead of a
// hardcoded pair.
//
// Required env:
//   ENGINEERING_HUB_URL      e.g. https://api.xhub.example.com (no trailing slash)
//   WEBHOOK_SIGNING_SECRET   shared HMAC secret (never hardcode, never log)
//   PRODUCT_CODE             e.g. PRD-X1 — must already be registered
//
// Optional env (auto-detected for GitHub Actions, override for others):
//   CI_SOURCE            default 'github-actions'
//   CI_EXTERNAL_ID        default GITHUB_RUN_ID, else Date.now()
//   CI_COMMIT_SHA         default GITHUB_SHA, else 'unknown'
//   CI_BRANCH             default GITHUB_REF_NAME, else 'unknown'
//   CI_TRIGGERED_BY       default GITHUB_ACTOR, else 'unknown'
//   CI_WORKFLOW_RUN_URL   default derived from GITHUB_SERVER_URL/REPOSITORY/RUN_ID
//
// Usage: node report-build.mjs <QUEUED|RUNNING|SUCCESS|FAILURE|CANCELLED>
// Exit code is always 0 — this is a best-effort side report, never a build
// gate. Wire the calling CI step with continue-on-error (or that CI
// provider's equivalent) as well, as defense in depth.
import { createHmac } from 'node:crypto';

const BASE = process.env.ENGINEERING_HUB_URL;
const SECRET = process.env.WEBHOOK_SIGNING_SECRET;
const PRODUCT_CODE = process.env.PRODUCT_CODE;
const status = process.argv[2];

if (!BASE || !SECRET || !PRODUCT_CODE) {
  console.error('report-build.mjs: ENGINEERING_HUB_URL, WEBHOOK_SIGNING_SECRET, and PRODUCT_CODE are all required.');
  process.exit(0); // never fail the pipeline over a misconfigured reporter
}
if (!status) {
  console.error('report-build.mjs: usage: node report-build.mjs <QUEUED|RUNNING|SUCCESS|FAILURE|CANCELLED>');
  process.exit(0);
}

const sign = (raw) => createHmac('sha256', SECRET).update(raw, 'utf8').digest('hex');

const externalId = process.env.CI_EXTERNAL_ID || process.env.GITHUB_RUN_ID || String(Date.now());
const commitSha = process.env.CI_COMMIT_SHA || process.env.GITHUB_SHA || 'unknown';
const branch = (process.env.CI_BRANCH || process.env.GITHUB_REF_NAME || 'unknown').replace(/^refs\/heads\//, '');
const triggeredBy = process.env.CI_TRIGGERED_BY || process.env.GITHUB_ACTOR || 'unknown';
const workflowRunUrl =
  process.env.CI_WORKFLOW_RUN_URL ||
  (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${externalId}`
    : undefined);

const payload = {
  productCode: PRODUCT_CODE,
  source: process.env.CI_SOURCE || 'github-actions',
  externalId,
  commitSha,
  branch,
  status,
  workflowRunUrl,
  triggeredBy,
  finishedAt: ['SUCCESS', 'FAILURE', 'CANCELLED'].includes(status) ? new Date().toISOString() : undefined,
};
const raw = JSON.stringify(payload);

try {
  const res = await fetch(`${BASE}/api/engineering/ci/callback`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-webhook-signature': sign(raw) },
    body: raw,
  });
  if (res.ok) {
    console.log(`report-build.mjs: reported ${status} for ${PRODUCT_CODE} (run ${externalId})`);
  } else {
    console.error(`report-build.mjs: HTTP ${res.status} — ${await res.text()}`);
  }
} catch (e) {
  console.error(`report-build.mjs: request failed — ${e.message}`);
}
// Always exit 0 (see header comment).
