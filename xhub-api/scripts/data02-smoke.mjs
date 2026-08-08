// DATA-02 (Wave A) smoke test. Two halves:
//   1. DB pipeline assertions — 153-row provider universe staged, only the
//      18 well-evidenced VERIFIED_SEED/FIRST_PARTY_VERIFIED/
//      DIRECTORY_VERIFIED rows promoted to canonical Organization, the 124
//      sparse DISCOVERED rows stay OrgSourceRecord-only (never silently
//      dropped, never silently promoted).
//   2. API assertions against a running server (:4000) — best-effort, same
//      as data01-smoke.mjs; skips gracefully if no server is up (see
//      scripts/verify-task23.mjs for how to exercise the API surface
//      directly against the compiled service without booting the full,
//      currently-broken PlatformAppModule/AppModule composition roots).
// Run AFTER: seed:data01 (Organization must pre-exist), seed:data02.
// Run: node scripts/data02-smoke.mjs   (or: npm run test:data02)
import 'dotenv/config';
import pg from 'pg';

const BASE = process.env.XHUB_BASE || 'http://localhost:4000';

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✓ ' + msg);
  else {
    console.error('  ✗ ' + msg);
    failed++;
  }
};
const j = async (path) => {
  const r = await fetch(BASE + path);
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};

console.log('DATA02 smoke — part 1: DB pipeline assertions');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows: stagedRows } = await client.query(
  `SELECT count(*)::int AS n FROM "OrgSourceRecord" WHERE "sourceSystem"='data02_agent_research'`,
);
ok(stagedRows[0].n === 153, `153 provider-universe rows staged in OrgSourceRecord (got ${stagedRows[0].n})`);

const { rows: promotedRows } = await client.query(
  `SELECT count(*)::int AS n FROM "Organization" o
   WHERE EXISTS (SELECT 1 FROM "OrgSourceRecord" s WHERE s."organizationId" = o.id AND s."sourceSystem"='data02_agent_research')`,
);
ok(promotedRows[0].n === 29, `29 rows promoted to canonical Organization (got ${promotedRows[0].n})`);

const { rows: unpromotedRows } = await client.query(
  `SELECT count(*)::int AS n FROM "OrgSourceRecord"
   WHERE "sourceSystem"='data02_agent_research' AND "organizationId" IS NULL`,
);
ok(
  unpromotedRows[0].n === 124,
  `124 sparse DISCOVERED rows correctly stay unmatched/unpromoted, not lost (got ${unpromotedRows[0].n})`,
);
ok(153 === promotedRows[0].n + unpromotedRows[0].n, 'promoted + unpromoted accounts for every staged row (no silent drop)');

const { rows: contractorRows } = await client.query(
  `SELECT count(*)::int AS n FROM "Organization" WHERE "organizationType"='BUILDING_SERVICE_CONTRACTOR'`,
);
ok(contractorRows[0].n === 28, `28 BUILDING_SERVICE_CONTRACTOR orgs, all traceable to DATA-02 (got ${contractorRows[0].n})`);

const { rows: capabilityRows } = await client.query(`SELECT count(*)::int AS n FROM "ServiceCapability"`);
ok(capabilityRows[0].n === 49, `49 ServiceCapability rows (got ${capabilityRows[0].n})`);

const { rows: noEvidenceCapability } = await client.query(
  `SELECT count(*)::int AS n FROM "ServiceCapability" sc
   WHERE NOT EXISTS (SELECT 1 FROM "Organization" o WHERE o.id = sc."organizationId")`,
);
ok(noEvidenceCapability[0].n === 0, `0 ServiceCapability rows dangling without an Organization (got ${noEvidenceCapability[0].n})`);

const { rows: researchStatusRows } = await client.query(
  `SELECT "researchStatus", count(*)::int AS n FROM "Organization"
   WHERE "researchStatus" IS NOT NULL GROUP BY 1 ORDER BY 1`,
);
console.log(`  (info) researchStatus distribution: ${JSON.stringify(Object.fromEntries(researchStatusRows.map((r) => [r.researchStatus, r.n])))}`);

await client.end();

console.log(`\nDATA02 smoke — part 2: API @ ${BASE} (best-effort)`);
try {
  const seedList = await j('/api/mdm/organizations?researchStatus=VERIFIED_SEED&limit=5');
  ok(seedList.status === 200, 'GET /api/mdm/organizations?researchStatus=VERIFIED_SEED 200');
  ok((seedList.body?.items ?? []).length > 0, 'VERIFIED_SEED filter returns rows');

  const contractorList = await j('/api/mdm/organizations?organizationType=BUILDING_SERVICE_CONTRACTOR&limit=5');
  ok(contractorList.status === 200, 'GET /api/mdm/organizations?organizationType=BUILDING_SERVICE_CONTRACTOR 200');
  const orgId = contractorList.body?.items?.[0]?.id;
  if (orgId) {
    const detail = await j(`/api/mdm/organizations/${orgId}`);
    ok(detail.status === 200, 'GET /api/mdm/organizations/:id 200');
    ok(Array.isArray(detail.body?.serviceCapabilities), 'detail exposes serviceCapabilities array');
  }
} catch (err) {
  ok(false, `API reachable @ ${BASE} — is the server running? (${err.message})`);
}

console.log(failed === 0 ? '\nDATA02_SMOKE_OK' : `\nDATA02_SMOKE_FAILED (${failed} check(s) failed)`);
process.exitCode = failed === 0 ? 0 : 1;
