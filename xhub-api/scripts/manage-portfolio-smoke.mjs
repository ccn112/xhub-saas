// X.Office Management Operating System — MG-04 (Portfolio & Benefit) SMOKE.
// Proves the LINK layer end-to-end against the running API, then self-cleans.
// Run: npm run test:manage-portfolio.
//
// Asserted:
//   seeded Portfolio PF-CORE rollup (seed:manage-portfolio) resolves 3 initiatives
//   → new Initiative created (stage-gate starts at INTAKE)
//   → gate INTAKE→DISCOVERY ok; INTAKE→FUNDED (skip) rejected 409
//   → link-project to a bogus id → 404 (never silently creates one)
//   → link-project to a REAL ExecutionProject → decorated `.delivery` resolves
//     that project's actual status/health/progress (read-only, #17)
//   → BenefitProfile realization is DERIVED from the seeded ACT-CLOSE
//     MetricObservation (seed:manage), never hand-entered (#12)
//   → RLS isolation: a different tenant MUST_NOT_LEAK the initiative
import 'dotenv/config';
import pg from 'pg';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const TENANT = 'tenant-xtech';
const OTHER = 'tenant-demo-isolation';
const H = (t = TENANT) => ({ 'content-type': 'application/json', 'x-tenant-id': t, 'x-user-id': 'usr-cfo' });
const MARK = `MG04-SMOKE-${Date.now()}`;

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✓ ' + msg);
  else { console.error('  ✗ ' + msg); failed++; }
};
async function api(method, path, body, tenant = TENANT) {
  const res = await fetch(BASE + path, { method, headers: H(tenant), body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json };
}

console.log(`manage-portfolio smoke @ ${BASE} (mark=${MARK})`);
try {
  // 1) Seeded portfolio rollup ---------------------------------------------------
  let r = await api('GET', '/api/manage/portfolios');
  const pf = (r.json?.items ?? []).find((p) => p.code === 'PF-CORE');
  ok(!!pf, 'seeded Portfolio PF-CORE resolves (seed:manage-portfolio)');
  ok(pf?.rollup?.initiativeCount === 3, `PF-CORE rollup counts 3 initiatives (got ${pf?.rollup?.initiativeCount})`);

  r = await api('GET', `/api/manage/initiatives?portfolioId=${pf.id}`);
  ok((r.json?.items ?? []).length === 3, `initiatives?portfolioId= resolves the 3 linked initiatives (got ${r.json?.items?.length})`);
  const init2 = (r.json?.items ?? []).find((i) => i.code === 'INIT-02');
  ok(init2?.delivery?.id === 'ep-seed-internal', 'INIT-02.delivery resolves the LINKED ExecutionProject (read-only projection)');
  ok(typeof init2?.delivery?.progressPercent === 'number', `delivery carries a real progressPercent (${init2?.delivery?.progressPercent}%) — sourced from Work v2, not re-derived here`);

  // 2) Create + stage-gate ------------------------------------------------------
  const objRes = await api('GET', '/api/manage/objectives');
  const objectiveId = objRes.json?.items?.[0]?.id;
  ok(!!objectiveId, 'at least 1 StrategicObjective exists to link a new initiative to');

  r = await api('POST', '/api/manage/initiatives', { code: `${MARK}-A`, name: 'MG04 smoke initiative', strategicObjectiveIds: [objectiveId] });
  ok(r.status < 300 && r.json?.id, `initiative created (${r.status})`);
  const initId = r.json.id;
  ok(r.json?.status === 'INTAKE', 'new initiative starts at INTAKE');

  r = await api('POST', `/api/manage/initiatives/${initId}/gate`, { status: 'FUNDED' });
  ok(r.status === 409, `skipping stages (INTAKE→FUNDED) → 409 (got ${r.status})`);

  r = await api('POST', `/api/manage/initiatives/${initId}/gate`, { status: 'DISCOVERY' });
  ok(r.status < 300 && r.json?.status === 'DISCOVERY', `valid gate INTAKE→DISCOVERY (${r.status})`);

  // 3) Link-project — bogus id rejected, real id resolves -----------------------
  r = await api('POST', `/api/manage/initiatives/${initId}/link-project`, { executionProjectId: 'not-a-real-project' });
  ok(r.status === 404, `link-project with a bogus id → 404, never silently creates one (got ${r.status})`);

  r = await api('POST', `/api/manage/initiatives/${initId}/link-project`, { executionProjectId: 'ep-seed-internal' });
  ok(r.status < 300 && r.json?.executionProjectId === 'ep-seed-internal', `link-project to a REAL ExecutionProject succeeds (${r.status})`);
  ok(r.json?.delivery?.code === 'EP-INT-001', 'decorated response resolves the linked project code');

  r = await api('GET', `/api/manage/initiatives/${initId}/delivery`);
  ok(r.json?.linked === true && r.json?.project?.id === 'ep-seed-internal', 'GET .../delivery read-only proxy resolves the same linked project');

  // 4) Benefit realization — DERIVED from the real MetricObservation -----------
  r = await api('GET', '/api/manage/benefit-profiles?initiativeId=mg04-seed-init-03');
  const b1 = (r.json?.items ?? []).find((b) => b.metricCode === 'ACT-CLOSE');
  ok(!!b1, 'seeded BenefitProfile wired to ACT-CLOSE resolves');
  ok(b1?.realization?.latestValue !== null && typeof b1.realization.latestValue === 'number', `realization.latestValue is a real number from MetricObservation (${b1?.realization?.latestValue})`);
  ok(['TRACKING', 'REALIZED', 'MISSED'].includes(b1?.status), `status derived to TRACKING/REALIZED/MISSED, never hand-set (got ${b1?.status})`);
  const b2 = (r.json?.items ?? []).find((b) => !b.metricCode);
  ok(b2?.status === 'PLANNED', `benefit with no metricCode stays PLANNED — honest, no fabricated realization (got ${b2?.status})`);

  // 5) RLS isolation -------------------------------------------------------------
  r = await api('GET', '/api/manage/initiatives', undefined, OTHER);
  const leaked = (r.json?.items ?? []).some((i) => i.id === initId);
  ok(!leaked, `MUST_NOT_LEAK: tenant ${OTHER} does NOT see the smoke initiative`);
  r = await api('GET', `/api/manage/initiatives/${initId}`, undefined, OTHER);
  ok(r.status === 404, `MUST_NOT_LEAK: cross-tenant GET of the initiative is 404 (got ${r.status})`);
} catch (e) {
  console.error('  ✗ smoke threw:', e.message);
  failed++;
}

// ---- self-clean (DB, bypass RLS) — only the smoke's OWN new initiative -------
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  await c.query(`DELETE FROM "Initiative" WHERE "tenantId"=$1 AND code LIKE '${MARK}%'`, [TENANT]);
  await c.query('COMMIT');
  const residue = Number((await c.query(`SELECT count(*) AS n FROM "Initiative" WHERE "tenantId"=$1 AND code LIKE '${MARK}%'`, [TENANT])).rows[0].n);
  ok(residue === 0, `self-clean: 0 residue rows (got ${residue})`);
} catch (e) {
  console.error('  ✗ self-clean failed:', e.message);
  failed++;
} finally {
  await c.end();
}

console.log(failed === 0 ? '\nMANAGE-PORTFOLIO SMOKE PASSED' : `\nMANAGE-PORTFOLIO SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
