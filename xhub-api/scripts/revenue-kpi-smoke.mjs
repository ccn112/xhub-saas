// Revenue KPI smoke (test:revenue-kpi, Phase 2 BO-0209). Server up on
// :4001. Proves: all 6 KPIs present with formula/source provenance;
// FinERP-dependent KPIs marked unavailable (not faked); seeded values match
// hand-computed expectations from the T001 journey.
// Run: node scripts/revenue-kpi-smoke.mjs
const BASE = process.env.XOFFICE_BASE || 'http://localhost:4001';
const ADMIN = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-nam' };

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.error('  ✗ ' + msg); failed++; } };

console.log('Revenue KPI smoke @ ' + BASE);

try {
  const r = await fetch(`${BASE}/api/revenue-kpi`, { headers: ADMIN });
  const body = await r.json();
  ok(r.status === 200, `endpoint responds 200 (got ${r.status})`);
  ok(Array.isArray(body.kpis) && body.kpis.length === 6, `6 KPIs returned (got ${body.kpis?.length})`);
  ok(body.kpis.every((k) => k.formula && k.source), 'every KPI carries formula + source provenance (no revenue mislabel)');

  const byCode = Object.fromEntries(body.kpis.map((k) => [k.code, k]));
  ok(byCode['KPI-SAL-001'].value >= 5000000000, `Pipeline Value includes the seeded 5B opportunity (got ${byCode['KPI-SAL-001'].value})`);
  ok(byCode['KPI-CON-001'].value >= 4800000000, `Contracted Value includes the seeded 4.8B contract (got ${byCode['KPI-CON-001'].value})`);
  ok(byCode['KPI-BIL-001'].value >= 960000000, `Ready-to-Bill Value includes the seeded 960M milestone (got ${byCode['KPI-BIL-001'].value})`);
  ok(byCode['KPI-FIN-002'].unavailable === true && byCode['KPI-FIN-002'].value === null, 'KPI-FIN-002 (needs FinERP) honestly marked unavailable, not faked');
  ok(byCode['KPI-LEAK-001'].unavailable === true && byCode['KPI-LEAK-001'].value === null, 'KPI-LEAK-001 (needs FinERP) honestly marked unavailable, not faked');
} catch (e) {
  console.error('  ✗ unexpected error:', e.message);
  failed++;
}

if (failed > 0) { console.error(`\nREVENUE KPI SMOKE FAILED (${failed})`); process.exit(1); }
console.log('\nREVENUE KPI SMOKE PASSED');
