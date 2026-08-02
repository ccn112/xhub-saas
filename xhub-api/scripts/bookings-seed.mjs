// Bookings seed (seed:bookings) — loads a small set of BookableResources
// (derived from the distinct resourceNames in the handoff seed/bookings.seed.json)
// + the 12 pilot bookings into BookableResource / Booking (PH-02d — NX-027).
//
// Idempotent: insert-by (tenantId, code) via ON CONFLICT DO NOTHING — a 2nd run
// produces NO duplicates and does not wipe existing rows. Talks straight to
// Postgres under RLS bypass (app.bypass_rls='on'), mirroring tickets-seed. The
// server does NOT need to be running. Run: npm run seed:bookings
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const CANDIDATES = [
  join(process.cwd(), 'seed-data', 'bookings', 'bookings.seed.json'),
  'D:/Code/handoff/Xhub/XTECH_XHUB_NEXT_PHASES_COMPACT_UX_SEED_HANDOFF_20260730/seed/bookings.seed.json',
];
const seedPath = CANDIDATES.find((p) => existsSync(p));
if (!seedPath) {
  console.error('bookings seed: source JSON not found in', CANDIDATES);
  process.exit(1);
}
const rows = JSON.parse(readFileSync(seedPath, 'utf8'));

// Derive a stable resource CODE + TYPE from the free-text resourceName.
const RESOURCE_META = {
  'Phòng họp lớn Tầng 8': { code: 'ROOM-8F', type: 'ROOM', capacity: 20, location: 'Tầng 8' },
  'Phòng họp Dự án': { code: 'ROOM-PRJ', type: 'ROOM', capacity: 10, location: 'Tầng 5' },
  'Xe 7 chỗ X-TECH': { code: 'VEH-7S', type: 'VEHICLE', capacity: 7, location: 'Hầm B1' },
  'Bộ thiết bị trình chiếu': { code: 'ASSET-PROJ', type: 'ASSET', capacity: null, location: 'Kho thiết bị' },
};

// Handoff booking status → Booking FSM state.
const STATE_BY_STATUS = {
  PENDING_APPROVAL: 'REQUESTED',
  CONFIRMED: 'APPROVED',
  CHECKED_IN: 'CHECKED_IN',
  CANCELLED: 'CANCELLED',
  REJECTED: 'REJECTED',
  CHECKED_OUT: 'CHECKED_OUT',
  NO_SHOW: 'NO_SHOW',
};

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
let resInserted = 0;
let resSkipped = 0;
let inserted = 0;
let skipped = 0;
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");

  const tenantId = 'tenant-xtech';

  // Seed only the resources actually referenced by the bookings.
  const usedNames = [...new Set(rows.map((r) => r.resourceName))].filter((n) => RESOURCE_META[n]);
  const resourceIdByName = {};
  for (const name of usedNames) {
    const meta = RESOURCE_META[name];
    const id = `res-${meta.code.toLowerCase()}`;
    resourceIdByName[name] = id;
    const res = await c.query(
      `INSERT INTO "BookableResource"
         (id, "tenantId", code, name, type, capacity, location, "orgUnitId", active, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,now(),now())
       ON CONFLICT ("tenantId", code) DO NOTHING`,
      [id, tenantId, meta.code, name, meta.type, meta.capacity, meta.location, null],
    );
    if (res.rowCount > 0) resInserted++;
    else resSkipped++;
  }

  // U32 FAIL: "Đặt mới, cần phân theo loại: Xe, phòng họp, Họp lãnh đạo" — no
  // pilot booking references a leadership room yet, so seed one directly
  // (independent of the bookings-derived loop above) so the new EXEC_ROOM
  // category has a real, visible row in the demo, not just a code path.
  const execRoom = await c.query(
    `INSERT INTO "BookableResource"
       (id, "tenantId", code, name, type, capacity, location, "orgUnitId", active, "createdAt", "updatedAt")
     VALUES ('res-room-exec',$1,'ROOM-EXEC','Phòng họp Ban điều hành','EXEC_ROOM',8,'Tầng 9',null,true,now(),now())
     ON CONFLICT ("tenantId", code) DO NOTHING`,
    [tenantId],
  );
  if (execRoom.rowCount > 0) resInserted++;
  else resSkipped++;

  for (const r of rows) {
    const code = r.id; // BOOK-2026-000x — stable, unique per tenant
    const state = STATE_BY_STATUS[r.status] ?? 'REQUESTED';
    const resourceId = resourceIdByName[r.resourceName];
    if (!resourceId) {
      console.warn(`  ! skip ${code}: unknown resourceName '${r.resourceName}'`);
      continue;
    }
    const checkedInAt = state === 'CHECKED_IN' || state === 'CHECKED_OUT' ? new Date(r.startAt) : null;
    const noShow = state === 'NO_SHOW';
    const res = await c.query(
      `INSERT INTO "Booking"
         (id, "tenantId", code, "resourceId", "requesterId", title, purpose, "startAt", "endAt",
          state, attendees, "checkedInAt", "checkedOutAt", "noShow", "orgUnitId", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now(),now())
       ON CONFLICT ("tenantId", code) DO NOTHING`,
      [code, tenantId, code, resourceId, r.organizerId, r.title, null, new Date(r.startAt), new Date(r.endAt), state, null, checkedInAt, null, noShow, null],
    );
    if (res.rowCount > 0) {
      inserted++;
      await c.query(
        `INSERT INTO "BookingEvent" (id, "tenantId", "bookingId", type, "actorId", data, "createdAt")
         VALUES ($1,$2,$3,'seeded',$4,$5::jsonb,now())`,
        [`bevt-${code}`, tenantId, code, r.organizerId, JSON.stringify({ state, code, resourceName: r.resourceName, sourceKind: r.sourceKind })],
      );
    } else {
      skipped++;
    }
  }

  await c.query('COMMIT');
  console.log(
    `bookings seed OK | resources: inserted=${resInserted} skipped=${resSkipped} | bookings: source=${rows.length} inserted=${inserted} skipped(existing)=${skipped}`,
  );
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('bookings seed FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
