// DATA-04 (Wave A) smoke test — DB pipeline assertions only (no API module
// was built for this dataset yet, per the plan's Wave A scope: "minimal read
// API ... scoped to what's checkable against Hapulico [which] will
// legitimately return empty" — deferred rather than built against 0 real
// matches). Run AFTER: seed:data01, seed:data02, seed:data03, seed:data04.
// Run: node scripts/data04-smoke.mjs   (or: npm run test:data04)
import 'dotenv/config';
import pg from 'pg';

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✓ ' + msg);
  else {
    console.error('  ✗ ' + msg);
    failed++;
  }
};

console.log('DATA04 smoke — DB pipeline assertions');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows: candRows } = await client.query(`SELECT count(*)::int AS n FROM "ProjectCandidate"`);
ok(candRows[0].n === 81, `81 ProjectCandidate rows (got ${candRows[0].n})`);

const { rows: edgeRows } = await client.query(`SELECT count(*)::int AS n FROM "ProjectGraphEdge"`);
ok(edgeRows[0].n === 85, `85 ProjectGraphEdge rows — every supplied edge preserved (got ${edgeRows[0].n})`);

const { rows: hierRows } = await client.query(`SELECT count(*)::int AS n FROM "ProjectHierarchyRelation"`);
ok(hierRows[0].n === 8, `8 ProjectHierarchyRelation rows resolved (6 of 14 skipped — parent name not itself a seeded candidate, a source-data note, got ${hierRows[0].n})`);

const { rows: gapRows } = await client.query(`SELECT count(*)::int AS n FROM "ProjectSupplyGap"`);
ok(gapRows[0].n === 10, `10 ProjectSupplyGap rows (got ${gapRows[0].n})`);

// The package's own rule: never invent an XHub project ID. Checked directly
// against the source Excel — none of the 81 candidates is Hapulico — so 0
// real matches is the CORRECT, honest outcome for Wave A, not a bug.
const { rows: matchedRows } = await client.query(
  `SELECT count(*)::int AS n FROM "ProjectCandidate" WHERE "matchedGlobalProjectId" IS NOT NULL`,
);
ok(matchedRows[0].n === 0, `0 candidates matched to a real GlobalProject — correct, only Hapulico is seeded and it isn't among the 81 (got ${matchedRows[0].n})`);

const { rows: pendingRows } = await client.query(
  `SELECT count(*)::int AS n FROM "ProjectCandidate" WHERE "matchStatus" = 'PENDING_XHUB_MATCH'`,
);
ok(pendingRows[0].n === 81, `all 81 candidates correctly sit at PENDING_XHUB_MATCH, not silently resolved (got ${pendingRows[0].n})`);

// No edge may reference a nonexistent candidate (FK already enforces this at
// insert time — this re-checks the join integrity end to end).
const { rows: orphanEdges } = await client.query(
  `SELECT count(*)::int AS n FROM "ProjectGraphEdge" e
   WHERE NOT EXISTS (SELECT 1 FROM "ProjectCandidate" c WHERE c.id = e."projectCandidateId")`,
);
ok(orphanEdges[0].n === 0, `0 orphaned edges (got ${orphanEdges[0].n})`);

const { rows: resolvedOrgRows } = await client.query(
  `SELECT count(*)::int AS n FROM "ProjectGraphEdge" WHERE "organizationId" IS NOT NULL`,
);
console.log(`  (info) edges resolved to a canonical Organization: ${resolvedOrgRows[0].n}/85`);
ok(resolvedOrgRows[0].n > 0, 'at least some edges resolved to a real DATA-01/02/03 Organization (name-match reuse works)');

const { rows: unresolvedWithRaw } = await client.query(
  `SELECT count(*)::int AS n FROM "ProjectGraphEdge" WHERE "organizationId" IS NULL AND "rawProviderName" IS NOT NULL`,
);
console.log(`  (info) edges NOT resolved but rawProviderName preserved (never force-linked, never dropped): ${unresolvedWithRaw[0].n}/85`);

const { rows: resolvedProductRows } = await client.query(
  `SELECT count(*)::int AS n FROM "ProjectGraphEdge" WHERE "productId" IS NOT NULL`,
);
console.log(`  (info) edges resolved to a canonical EquipmentProduct: ${resolvedProductRows[0].n}/85`);

await client.end();

console.log(failed === 0 ? '\nDATA04_SMOKE_OK' : `\nDATA04_SMOKE_FAILED (${failed} check(s) failed)`);
process.exitCode = failed === 0 ? 0 : 1;
