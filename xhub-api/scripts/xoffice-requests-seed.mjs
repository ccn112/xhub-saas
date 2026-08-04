// Requests seed (seed:requests) — loads the 42 pilot requests from the handoff
// seed/xoffice_requests.seed.json into the Request table (PH-02a — NX-020..024).
//
// Idempotent: upsert-by (tenantId, code) via ON CONFLICT — a 2nd run produces NO
// duplicates and does not wipe existing rows. Talks straight to Postgres under
// RLS bypass (app.bypass_rls='on'), mirroring role-registry-seed / *-reset. The
// server does NOT need to be running. Run: npm run seed:requests
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

// Prefer a repo-local copy under seed-data/; fall back to the handoff bundle.
const CANDIDATES = [
  join(process.cwd(), 'seed-data', 'requests', 'xoffice_requests.seed.json'),
  'D:/Code/handoff/Xhub/XTECH_XHUB_NEXT_PHASES_COMPACT_UX_SEED_HANDOFF_20260730/seed/xoffice_requests.seed.json',
];
const seedPath = CANDIDATES.find((p) => existsSync(p));
if (!seedPath) {
  console.error('requests seed: source JSON not found in', CANDIDATES);
  process.exit(1);
}
const rows = JSON.parse(readFileSync(seedPath, 'utf8'));

const PROC_ROLE = { 'PILOT-02': 'CFO' };

const c = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
await c.connect();
let inserted = 0;
let skipped = 0;
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");

  for (const r of rows) {
    const tenantId = r.tenantId ?? 'tenant-xtech';
    const code = r.id; // REQ-2026-000x — stable, unique per tenant
    const amount = r.amountVnd ?? null;
    const state = r.status; // stored raw (Request.state is a String; FSM tolerant)
    const approverRole = PROC_ROLE[r.procedureCode] ?? 'DEPARTMENT_HEAD';
    const payload = JSON.stringify({
      dueAt: r.dueAt ?? null,
      sourceKind: r.sourceKind ?? null,
      seedScenario: r.seedScenario ?? true,
    });
    const res = await c.query(
      `INSERT INTO "Request"
         (id, "tenantId", code, kind, "procedureCode", "procedureName", title, "requesterId",
          amount, currency, state, "approverRole", payload, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'VND',$10,$11,$12::jsonb,$13,$13)
       ON CONFLICT ("tenantId", code) DO NOTHING`,
      [
        code, tenantId, code, r.procedureCode ?? 'GENERIC', r.procedureCode ?? 'GENERIC',
        r.procedureName ?? null, r.title, r.requesterId, amount, state, approverRole,
        payload, new Date(r.createdAt ?? Date.now()),
      ],
    );
    if (res.rowCount > 0) {
      inserted++;
      // Seed a single 'created' timeline event (idempotent: only for new rows).
      await c.query(
        `INSERT INTO "RequestEvent" (id, "tenantId", "requestId", type, "actorId", data, "createdAt")
         VALUES ($1,$2,$3,'seeded',$4,$5::jsonb,$6)`,
        [`evt-${code}`, tenantId, code, r.requesterId, JSON.stringify({ state, code }), new Date(r.createdAt ?? Date.now())],
      );
    } else {
      skipped++;
    }
  }

  await c.query('COMMIT');
  console.log(`requests seed OK | source=${rows.length} inserted=${inserted} skipped(existing)=${skipped}`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('requests seed FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
