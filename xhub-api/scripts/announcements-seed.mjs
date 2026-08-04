// Announcements seed (seed:announcements) — loads the 6 pilot announcements from
// the handoff seed/announcements.seed.json into Announcement (+ AnnouncementReceipt
// for PUBLISHED ones, resolved from the audience) — PH-02e — NX-028.
//
// Idempotent: insert-by (tenantId, code) via ON CONFLICT DO NOTHING — a 2nd run
// produces NO duplicates and does not wipe existing rows. Talks straight to
// Postgres under RLS bypass (app.bypass_rls='on'), mirroring bookings-seed. The
// server does NOT need to be running. Run: npm run seed:announcements
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const CANDIDATES = [
  join(process.cwd(), 'seed-data', 'announcements', 'announcements.seed.json'),
  'D:/Code/handoff/Xhub/XTECH_XHUB_NEXT_PHASES_COMPACT_UX_SEED_HANDOFF_20260730/seed/announcements.seed.json',
];
const seedPath = CANDIDATES.find((p) => existsSync(p));
if (!seedPath) {
  console.error('announcements seed: source JSON not found in', CANDIDATES);
  process.exit(1);
}
const rows = JSON.parse(readFileSync(seedPath, 'utf8'));

// Handoff free-text audience → {audienceType, audienceId (org unit code)}.
const AUDIENCE_MAP = {
  ALL: { audienceType: 'ALL', orgUnitCode: null },
  ADMIN: { audienceType: 'ORG_UNIT', orgUnitCode: 'ADMIN' },
  FIN: { audienceType: 'ORG_UNIT', orgUnitCode: 'FIN' },
};

const STATE_BY_STATUS = { PUBLISHED: 'PUBLISHED', DRAFT: 'DRAFT', ARCHIVED: 'ARCHIVED', CANCELLED: 'CANCELLED' };

const c = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
await c.connect();
let inserted = 0;
let skipped = 0;
let receiptsCreated = 0;
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");

  const tenantId = 'tenant-xtech';

  // Resolve recipient PERSON ids for an audience (mirrors the runtime resolver).
  async function resolveRecipients(audienceType, orgUnitCode) {
    if (audienceType === 'ALL') {
      const r = await c.query(`SELECT id FROM "PersonProfile" WHERE "tenantId"=$1`, [tenantId]);
      return r.rows.map((x) => x.id);
    }
    if (audienceType === 'ORG_UNIT' && orgUnitCode) {
      const ou = await c.query(`SELECT id FROM "OrgUnit" WHERE "tenantId"=$1 AND code=$2`, [tenantId, orgUnitCode]);
      if (!ou.rows.length) return [];
      const r = await c.query(
        `SELECT DISTINCT "holderPersonId" AS id FROM "Position"
          WHERE "orgUnitId"=$1 AND "holderPersonId" IS NOT NULL`,
        [ou.rows[0].id],
      );
      return r.rows.map((x) => x.id);
    }
    return [];
  }

  for (const r of rows) {
    const code = r.id; // ANN-2026-00x — stable, unique per tenant
    const state = STATE_BY_STATUS[r.status] ?? 'DRAFT';
    const aud = AUDIENCE_MAP[r.audience] ?? { audienceType: 'ALL', orgUnitCode: null };
    let audienceId = null;
    if (aud.audienceType === 'ORG_UNIT' && aud.orgUnitCode) {
      const ou = await c.query(`SELECT id FROM "OrgUnit" WHERE "tenantId"=$1 AND code=$2`, [tenantId, aud.orgUnitCode]);
      audienceId = ou.rows[0]?.id ?? null;
    }
    const publishAt = r.publishedAt ? new Date(r.publishedAt) : null;
    const res = await c.query(
      `INSERT INTO "Announcement"
         (id, "tenantId", code, title, body, "authorId", "audienceType", "audienceId",
          priority, "requireAck", "publishAt", "expireAt", state, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now(),now())
       ON CONFLICT ("tenantId", code) DO NOTHING`,
      [code, tenantId, code, r.title, null, r.publisherId, aud.audienceType, audienceId, 'NORMAL', !!r.requiresAcknowledgement, publishAt, null, state],
    );
    if (res.rowCount > 0) {
      inserted++;
      await c.query(
        `INSERT INTO "AnnouncementEvent" (id, "tenantId", "announcementId", type, "actorId", data, "createdAt")
         VALUES ($1,$2,$3,'seeded',$4,$5::jsonb,now())`,
        [`aevt-${code}`, tenantId, code, r.publisherId, JSON.stringify({ state, code, audience: r.audience, sourceKind: r.sourceKind })],
      );
      // Receipts for PUBLISHED announcements (resolved from the audience).
      if (state === 'PUBLISHED') {
        const recipients = await resolveRecipients(aud.audienceType, aud.orgUnitCode);
        for (const personId of recipients) {
          const rr = await c.query(
            `INSERT INTO "AnnouncementReceipt"
               (id, "tenantId", "announcementId", "userId", "deliveredAt", "createdAt", "updatedAt")
             VALUES ($1,$2,$3,$4,now(),now(),now())
             ON CONFLICT ("announcementId","userId") DO NOTHING`,
            [`arc-${code}-${personId}`.slice(0, 60), tenantId, code, personId],
          );
          if (rr.rowCount > 0) receiptsCreated++;
        }
      }
    } else {
      skipped++;
    }
  }

  await c.query('COMMIT');
  console.log(
    `announcements seed OK | source=${rows.length} inserted=${inserted} skipped(existing)=${skipped} receiptsCreated=${receiptsCreated}`,
  );
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('announcements seed FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
