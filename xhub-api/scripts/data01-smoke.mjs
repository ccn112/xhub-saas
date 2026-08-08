// DATA-01 (Wave A) smoke test. Two halves:
//   1. DB pipeline assertions — baseline import counts match the workbook
//      exactly, revoked orgs never read as qualified, crawl POC matched
//      cleanly, no false-positive duplicates.
//   2. API assertions against a running server (:4000) — contract shape, no
//      raw payload leak, 404 on unknown id.
// Run AFTER: seed:data01, crawl:data01, match:data01. Server must be up for
// part 2. Run: node scripts/data01-smoke.mjs   (or: npm run test:data01)
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

console.log('DATA01 smoke — part 1: DB pipeline assertions');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// NOTE: Organization is a shared table across DATA-01/02/03 (by design —
// "don't create duplicate company identities" — see docs/data02/). Total
// row count grows as later datasets run, so this checks DATA-01's own
// PROPERTY_OPERATOR rows specifically, not the whole table.
const { rows: orgCountRows } = await client.query(
  `SELECT count(*)::int AS n FROM "Organization" WHERE "organizationType" = 'PROPERTY_OPERATOR'`,
);
ok(orgCountRows[0].n === 205, `205 DATA-01 (PROPERTY_OPERATOR) organizations imported (got ${orgCountRows[0].n})`);

const { rows: qualRows } = await client.query(
  `SELECT status, count(*)::int AS n FROM "OrganizationQualification" GROUP BY status ORDER BY status`,
);
const qualMap = Object.fromEntries(qualRows.map((r) => [r.status, r.n]));
ok(qualMap.QUALIFIED === 193, `193 QUALIFIED (got ${qualMap.QUALIFIED ?? 0})`);
ok(qualMap.UPDATED === 10, `10 UPDATED (got ${qualMap.UPDATED ?? 0})`);
ok(qualMap.REVOKED === 2, `2 REVOKED (got ${qualMap.REVOKED ?? 0})`);

const { rows: revokedWithExpiry } = await client.query(
  `SELECT count(*)::int AS n FROM "OrganizationQualification" WHERE status='REVOKED' AND "expiryDate" IS NOT NULL`,
);
ok(revokedWithExpiry[0].n === 0, 'revoked orgs never carry a computed expiry (revocation overrides expiry, doc §11/§12)');

const { rows: eventCountRows } = await client.query(`SELECT count(*)::int AS n FROM "OrganizationQualificationEvent"`);
ok(eventCountRows[0].n === 206, `206 qualification events imported (got ${eventCountRows[0].n})`);
const { rows: unmatchedEvents } = await client.query(
  `SELECT count(*)::int AS n FROM "OrganizationQualificationEvent" WHERE "organizationId" IS NULL`,
);
ok(unmatchedEvents[0].n === 0, `0 unmatched events (got ${unmatchedEvents[0].n}) — baseline names all resolve to a seeded org`);

const { rows: fieldObsRows } = await client.query(`SELECT count(*)::int AS n FROM "OrganizationFieldObservation"`);
ok(fieldObsRows[0].n === 96, `96 field observations for the 12 enriched accounts (got ${fieldObsRows[0].n})`);

const { rows: personRows } = await client.query(`SELECT count(*)::int AS n FROM "Person"`);
ok(personRows[0].n > 0, `Person rows created from public representative names (${personRows[0].n})`);
const { rows: personTable } = await client.query(`SELECT "personIdentityKey" FROM "Person" WHERE "personIdentityKey" IS NOT NULL`);
ok(personTable.length === 0, 'no personIdentityKey populated anywhere — HMAC/identity vault correctly deferred (Wave A has no raw CCCD)');

const { rows: mocRows } = await client.query(
  `SELECT "matchStatus", count(*)::int AS n FROM "OrgSourceRecord" WHERE "sourceSystem"='moc_gov_vn' GROUP BY "matchStatus"`,
);
const mocMatched = mocRows.find((r) => r.matchStatus === 'matched')?.n ?? 0;
ok(mocMatched >= 10, `MOC crawl POC produced >=10 matched OrgSourceRecord rows (got ${mocMatched})`);

const { rows: dupRows } = await client.query(`SELECT count(*)::int AS n FROM "OrgDuplicatePair"`);
ok(dupRows[0].n === 0, `0 duplicate-pair false positives from the crawl (exact-name matches only, got ${dupRows[0].n})`);

const { rows: relRows } = await client.query(`SELECT count(*)::int AS n FROM "ProjectOrganizationRelation"`);
console.log(
  `  (info) ProjectOrganizationRelation=${relRows[0].n} — 0 is EXPECTED until Wave C (6.000-project migration) seeds real projects.`,
);

await client.end();

console.log(`\nDATA01 smoke — part 2: API @ ${BASE}`);
try {
  const list = await j('/api/mdm/organizations?limit=5');
  ok(list.status === 200, 'GET /api/mdm/organizations 200');
  ok(Array.isArray(list.body?.items) && list.body.items.length > 0, 'organizations list is non-empty');

  const search = await j('/api/mdm/organizations?q=long%20duong');
  ok(search.status === 200 && (search.body?.items ?? []).length >= 1, 'search by name (q=) finds Long Dương Group');
  const orgId = search.body.items[0]?.id;
  ok(!!orgId, `resolved orgId=${orgId}`);

  if (orgId) {
    const detail = await j(`/api/mdm/organizations/${orgId}`);
    ok(detail.status === 200, 'GET /api/mdm/organizations/:id 200');
    ok(detail.body?.taxCode === '3702712525', `taxCode matches baseline (got ${detail.body?.taxCode})`);
    ok(detail.body?.qualification?.status === 'QUALIFIED', 'qualification.status=QUALIFIED for this org');
    ok(!('rawTaxCode' in detail.body) && !('sourcePayload' in detail.body), 'detail does NOT leak raw source payload fields');

    const quals = await j(`/api/mdm/organizations/${orgId}/qualifications`);
    ok(quals.status === 200 && Array.isArray(quals.body?.events) && quals.body.events.length > 0, 'qualifications history is a non-empty array');

    const projects = await j(`/api/mdm/organizations/${orgId}/projects`);
    ok(projects.status === 200 && Array.isArray(projects.body?.items), 'projects endpoint returns an array (empty expected pre-Wave-C)');
  }

  const notFound = await j('/api/mdm/organizations/does-not-exist');
  ok(notFound.status === 404, 'unknown organization id → 404');
} catch (err) {
  ok(false, `API reachable @ ${BASE} — is the server running? (${err.message})`);
}

console.log(failed === 0 ? '\nDATA01_SMOKE_OK' : `\nDATA01_SMOKE_FAILED (${failed} check(s) failed)`);
process.exitCode = failed === 0 ? 0 : 1;
