// Engineering Governance — CI/build ingest smoke (test:engineering-ci,
// DG-06). Server up on :4000 with products seeded. Proves: forged/missing
// signature -> 401 (AT-009); valid signature creates a BuildRecord; the
// SAME externalId reported again (progressing QUEUED -> SUCCESS) upserts in
// place, not append — unlike TestResult, a build run is one row that
// advances; unknown productCode -> 400.
// Run: node scripts/engineering-ci-smoke.mjs
import 'dotenv/config';
import { createHmac } from 'node:crypto';
import pg from 'pg';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const SECRET = process.env.WEBHOOK_SIGNING_SECRET || 'dev-webhook-secret';
const sign = (raw) => createHmac('sha256', SECRET).update(raw, 'utf8').digest('hex');

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.error('  ✗ ' + msg); failed++; } };

const post = async (obj, { badSig = false, noSig = false } = {}) => {
  const raw = JSON.stringify(obj);
  const headers = { 'content-type': 'application/json' };
  if (!noSig) headers['x-webhook-signature'] = badSig ? 'deadbeef' : sign(raw);
  const r = await fetch(`${BASE}/api/engineering/ci/callback`, { method: 'POST', headers, body: raw });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};
const get = async (path) => {
  const r = await fetch(BASE + path);
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

console.log('Engineering CI ingest smoke @ ' + BASE);

const externalId = 'smoke-run-' + Date.now();
try {
  const prod = await get('/api/engineering/products/PRD-XHUB');
  const productId = prod.body.id;

  const noSig = await post({ productCode: 'PRD-XHUB', source: 'smoke-ci', externalId, commitSha: 'abc123', status: 'QUEUED' }, { noSig: true });
  ok(noSig.status === 401, `missing signature rejected 401 (got ${noSig.status})`);

  const badSig = await post({ productCode: 'PRD-XHUB', source: 'smoke-ci', externalId, commitSha: 'abc123', status: 'QUEUED' }, { badSig: true });
  ok(badSig.status === 401, `forged signature rejected 401 (AT-009, got ${badSig.status})`);

  const unknownProduct = await post({ productCode: 'PRD-DOES-NOT-EXIST', source: 'smoke-ci', externalId, commitSha: 'abc123', status: 'QUEUED' });
  ok(unknownProduct.status === 400 || unknownProduct.status === 404, `unknown productCode rejected (got ${unknownProduct.status})`);

  const queued = await post({ productCode: 'PRD-XHUB', source: 'smoke-ci', externalId, commitSha: 'abc123', branch: 'main', status: 'QUEUED', triggeredBy: 'smoke-test' });
  ok(queued.status === 201 || queued.status === 200, `valid signature accepted, QUEUED (got ${queued.status})`);
  ok(queued.body.status === 'QUEUED', `stored status=QUEUED (got ${queued.body.status})`);
  const recordId = queued.body.id;

  const success = await post({ productCode: 'PRD-XHUB', source: 'smoke-ci', externalId, commitSha: 'abc123', branch: 'main', status: 'SUCCESS', workflowRunUrl: 'https://example.test/run/1', finishedAt: new Date().toISOString() });
  ok(success.status === 200 || success.status === 201, `same externalId re-posted SUCCESS (got ${success.status})`);
  ok(success.body.id === recordId, 'same (productId,source,externalId) upserts the SAME row, not a new one');
  ok(success.body.status === 'SUCCESS', `advanced to SUCCESS (got ${success.body.status})`);

  const list = await get(`/api/engineering/ci/builds?productId=${productId}`);
  ok(list.status === 200 && list.body.some((b) => b.id === recordId), 'build appears in read-only builds list (open read, no permission gate)');
  ok(list.body.filter((b) => b.externalId === externalId).length === 1, 'exactly one row for this externalId (upsert confirmed, not duplicated)');
} catch (e) {
  console.error('  ✗ unexpected error:', e.message);
  failed++;
} finally {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const del = await c.query('DELETE FROM "BuildRecord" WHERE "externalId" = $1 RETURNING id', [externalId]);
  ok(del.rowCount === 1, 'smoke build record cleaned up');
  await c.end();
}

if (failed > 0) { console.error(`\nENGINEERING CI SMOKE FAILED (${failed})`); process.exit(1); }
console.log('\nENGINEERING CI SMOKE PASSED');
