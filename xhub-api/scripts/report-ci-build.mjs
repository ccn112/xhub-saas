// Report this CI run's own build status to the Engineering Hub (DG-06,
// docs/implementation/engineering-hub/INTEGRATION_CONTRACT_CI.md). This is
// the real, live cross-software proof for DG-06 — the SAME CI pipeline that
// just built/tested xhub-api reports its own result back into the Platform
// it just verified, for BOTH products living in this repo (PRD-XHUB,
// PRD-XOFFICE), using the exact contract any external repo (X1/X2/FinERP/
// X.Space) would use. Non-fatal by design: a reporting failure must never
// fail the CI run it is merely reporting about (see try/catch below).
// Run: node scripts/report-ci-build.mjs <status>  (status: SUCCESS|FAILURE)
import 'dotenv/config';
import { createHmac } from 'node:crypto';

const BASE = process.env.PLATFORM_API_URL || 'http://localhost:4000';
const SECRET = process.env.WEBHOOK_SIGNING_SECRET || 'dev-webhook-secret';
const sign = (raw) => createHmac('sha256', SECRET).update(raw, 'utf8').digest('hex');

const status = process.argv[2] || 'SUCCESS';
const commitSha = process.env.GITHUB_SHA || 'local';
const branch = (process.env.GITHUB_REF_NAME || 'local').replace(/^refs\/heads\//, '');
const runId = process.env.GITHUB_RUN_ID || String(Date.now());
const repo = process.env.GITHUB_REPOSITORY || 'xhub-saas/xhub-saas';
const triggeredBy = process.env.GITHUB_ACTOR || 'local';
const workflowRunUrl = process.env.GITHUB_SERVER_URL
  ? `${process.env.GITHUB_SERVER_URL}/${repo}/actions/runs/${runId}`
  : undefined;

const PRODUCTS = ['PRD-XHUB', 'PRD-XOFFICE'];

let failed = 0;
for (const productCode of PRODUCTS) {
  const payload = {
    productCode,
    source: 'github-actions',
    externalId: runId,
    commitSha,
    branch,
    status,
    workflowRunUrl,
    triggeredBy,
    finishedAt: new Date().toISOString(),
  };
  const raw = JSON.stringify(payload);
  try {
    const res = await fetch(`${BASE}/api/engineering/ci/callback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-webhook-signature': sign(raw) },
      body: raw,
    });
    if (res.ok) {
      console.log(`  ✓ reported ${status} for ${productCode} (run ${runId})`);
    } else {
      console.error(`  ✗ ${productCode}: HTTP ${res.status} ${await res.text()}`);
      failed++;
    }
  } catch (e) {
    console.error(`  ✗ ${productCode}: ${e.message}`);
    failed++;
  }
}

// Reporting is best-effort — never fail the CI run over it (this script's
// exit code is intentionally NOT propagated as a pipeline failure by the
// caller; see ci.yml's continue-on-error on this step).
if (failed > 0) console.error(`report-ci-build: ${failed} product(s) failed to report (non-fatal)`);
