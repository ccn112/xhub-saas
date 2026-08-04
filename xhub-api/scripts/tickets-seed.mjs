// Tickets seed (seed:tickets) — loads a small Service Catalog (derived from the
// categories in the handoff seed/tickets.seed.json) + the 15 pilot tickets into
// ServiceCatalogItem / Ticket (PH-02c — NX-026).
//
// Idempotent: insert-by (tenantId, code) via ON CONFLICT DO NOTHING — a 2nd run
// produces NO duplicates and does not wipe existing rows. Talks straight to
// Postgres under RLS bypass (app.bypass_rls='on'), mirroring directives-seed. The
// server does NOT need to be running. Run: npm run seed:tickets
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const CANDIDATES = [
  join(process.cwd(), 'seed-data', 'tickets', 'tickets.seed.json'),
  'D:/Code/handoff/Xhub/XTECH_XHUB_NEXT_PHASES_COMPACT_UX_SEED_HANDOFF_20260730/seed/tickets.seed.json',
];
const seedPath = CANDIDATES.find((p) => existsSync(p));
if (!seedPath) {
  console.error('tickets seed: source JSON not found in', CANDIDATES);
  process.exit(1);
}
const rows = JSON.parse(readFileSync(seedPath, 'utf8'));

// Human-readable service catalog derived from the ticket serviceCode categories.
const CATALOG = {
  ACCESS: { name: 'Cấp / khôi phục quyền truy cập', defaultSlaHours: 4 },
  DEVICE: { name: 'Hỗ trợ thiết bị làm việc', defaultSlaHours: 8 },
  NETWORK: { name: 'Sự cố kết nối mạng', defaultSlaHours: 4 },
  APPLICATION: { name: 'Lỗi ứng dụng nội bộ', defaultSlaHours: 8 },
  SECURITY: { name: 'Cảnh báo an ninh / bảo mật', defaultSlaHours: 2 },
};

// Handoff ticket status → Ticket FSM state.
const STATE_BY_STATUS = {
  OPEN: 'NEW',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_USER: 'PENDING_REQUESTER',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
};

const c = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
await c.connect();
let catInserted = 0;
let catSkipped = 0;
let inserted = 0;
let skipped = 0;
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");

  const tenantId = 'tenant-xtech';

  // Only seed catalog items for categories actually present in the tickets.
  const usedCodes = [...new Set(rows.map((r) => r.serviceCode))].filter((code) => CATALOG[code]);
  const catalogIdByCode = {};
  for (const code of usedCodes) {
    const meta = CATALOG[code];
    const id = `svc-${code.toLowerCase()}`;
    catalogIdByCode[code] = id;
    const res = await c.query(
      `INSERT INTO "ServiceCatalogItem"
         (id, "tenantId", code, name, category, "defaultSlaHours", description, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,now(),now())
       ON CONFLICT ("tenantId", code) DO NOTHING`,
      [id, tenantId, code, meta.name, code, meta.defaultSlaHours, meta.name],
    );
    if (res.rowCount > 0) catInserted++;
    else catSkipped++;
  }

  for (const r of rows) {
    const code = r.id; // IT-2026-000x — stable, unique per tenant
    const state = STATE_BY_STATUS[r.status] ?? 'NEW';
    const catalogItemId = catalogIdByCode[r.serviceCode] ?? null;
    const category = r.serviceCode;
    const slaDueAt = r.slaDueAt ? new Date(r.slaDueAt) : null;
    const resolvedAt = state === 'RESOLVED' || state === 'CLOSED' ? slaDueAt : null;
    // Only ASSIGNED+ states carry a resolved assignee.
    const assigneeId = ['NEW', 'TRIAGED'].includes(state) ? null : r.assigneeId ?? null;
    const res = await c.query(
      `INSERT INTO "Ticket"
         (id, "tenantId", code, title, description, "requesterId", "catalogItemId", category,
          priority, state, "assigneeId", "slaDueAt", "resolvedAt", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now(),now())
       ON CONFLICT ("tenantId", code) DO NOTHING`,
      [code, tenantId, code, r.title, r.title, r.requesterId, catalogItemId, category, r.priority ?? 'MEDIUM', state, assigneeId, slaDueAt, resolvedAt],
    );
    if (res.rowCount > 0) {
      inserted++;
      await c.query(
        `INSERT INTO "TicketEvent" (id, "tenantId", "ticketId", type, "actorId", data, "createdAt")
         VALUES ($1,$2,$3,'seeded',$4,$5::jsonb,now())`,
        [`tevt-${code}`, tenantId, code, r.requesterId, JSON.stringify({ state, code, serviceCode: r.serviceCode, sourceKind: r.sourceKind })],
      );
    } else {
      skipped++;
    }
  }

  await c.query('COMMIT');
  console.log(
    `tickets seed OK | catalog: inserted=${catInserted} skipped=${catSkipped} | tickets: source=${rows.length} inserted=${inserted} skipped(existing)=${skipped}`,
  );
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('tickets seed FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
