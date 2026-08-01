// Directives seed (seed:directives) — loads the 10 pilot directives from the
// handoff seed/directives.seed.json into the Directive table (PH-02b — NX-025).
//
// Idempotent: insert-by (tenantId, code) via ON CONFLICT DO NOTHING — a 2nd run
// produces NO duplicates and does not wipe existing rows. Talks straight to
// Postgres under RLS bypass (app.bypass_rls='on'), mirroring requests-seed. The
// server does NOT need to be running. Run: npm run seed:directives
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const CANDIDATES = [
  join(process.cwd(), 'seed-data', 'directives', 'directives.seed.json'),
  'D:/Code/handoff/Xhub/XTECH_XHUB_NEXT_PHASES_COMPACT_UX_SEED_HANDOFF_20260730/seed/directives.seed.json',
];
const seedPath = CANDIDATES.find((p) => existsSync(p));
if (!seedPath) {
  console.error('directives seed: source JSON not found in', CANDIDATES);
  process.exit(1);
}
const rows = JSON.parse(readFileSync(seedPath, 'utf8'));

// Map the handoff org-unit CODE (TECH, DELIVERY, ...) → the seeded OrgUnit id.
const OU_BY_CODE = {
  TECH: 'ou-tech',
  DELIVERY: 'ou-delivery',
  ADMIN: 'ou-admin',
  SOLUTION: 'ou-solution',
  SUPPORT: 'ou-support',
  EXEC: 'ou-exec',
  FIN: 'ou-fin',
  HR: 'ou-hr',
  SALES: 'ou-sales',
  PLATFORM: 'ou-platform',
  IMPL: 'ou-impl',
};

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
let inserted = 0;
let skipped = 0;
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");

  for (const r of rows) {
    const tenantId = r.tenantId ?? 'tenant-xtech';
    const code = r.id; // DIR-2026-00x — stable, unique per tenant
    const state = r.status; // stored raw (Directive.state is a String; FSM tolerant)
    const audienceId = OU_BY_CODE[r.assignedOrgUnit] ?? null;
    const dueAt = r.dueAt ? new Date(r.dueAt) : null;
    const res = await c.query(
      `INSERT INTO "Directive"
         (id, "tenantId", code, title, body, "issuerId", "audienceType", "audienceId",
          priority, "dueAt", state, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,'ORG_UNIT',$7,'NORMAL',$8,$9,$10,$10)
       ON CONFLICT ("tenantId", code) DO NOTHING`,
      [code, tenantId, code, r.title, r.body ?? null, r.issuedBy, audienceId, dueAt, state, new Date(r.createdAt ?? Date.now())],
    );
    if (res.rowCount > 0) {
      inserted++;
      await c.query(
        `INSERT INTO "DirectiveEvent" (id, "tenantId", "directiveId", type, "actorId", data, "createdAt")
         VALUES ($1,$2,$3,'seeded',$4,$5::jsonb,$6)`,
        [`devt-${code}`, tenantId, code, r.issuedBy, JSON.stringify({ state, code, assignedOrgUnit: r.assignedOrgUnit }), new Date(r.createdAt ?? Date.now())],
      );
    } else {
      skipped++;
    }
  }

  await c.query('COMMIT');
  console.log(`directives seed OK | source=${rows.length} inserted=${inserted} skipped(existing)=${skipped}`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('directives seed FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
