// Person avatars + phones seeder (seed:person-avatars) — PH-ORG-AVATAR-01.
//
// Backfills PersonProfile.phone (deterministic Vietnamese-style, per id) for all
// tenant-xtech people, and PersonProfile.avatarUrl (a deterministic INLINE SVG
// data-URI initials avatar — colored circle + white initials) for a handful of
// senior people. NO external network image is used (offline-safe).
//
// ADDITIVE + IDEMPOTENT: pg direct (no server), one transaction, RLS bypass via
// SET LOCAL app.bypass_rls='on'. Re-running produces the SAME values (phone is a
// pure function of the id; avatar is a pure function of the name).
//
// Run: npm run seed:person-avatars   (needs DATABASE_URL)
import 'dotenv/config';
import pg from 'pg';

const tenantId = 'tenant-xtech';

// Deterministic 32-bit hash of a string (FNV-1a-ish) → non-negative int.
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Deterministic Vietnamese-style mobile: "09x xxx xx xx" grouped as "09xx xxx xxx".
function phoneFor(id) {
  const h = hash(`phone:${id}`);
  const nine = String(h % 1_000_000_000).padStart(9, '0'); // 9 digits after leading 0
  return `0${nine.slice(0, 3)} ${nine.slice(3, 6)} ${nine.slice(6, 9)}`;
}

// Initials from a full name (last two "words" of a Vietnamese name read best as
// given-name initials, but first+last is clearer for a badge).
function initials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const PALETTE = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#2563eb'];

// Inline SVG data-URI initials avatar (colored circle + white initials). No net.
function avatarFor(name) {
  const color = PALETTE[hash(`avatar:${name}`) % PALETTE.length];
  const text = initials(name);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">` +
    `<circle cx="48" cy="48" r="48" fill="${color}"/>` +
    `<text x="50%" y="50%" dy=".35em" text-anchor="middle" ` +
    `font-family="Arial,Helvetica,sans-serif" font-size="40" font-weight="600" fill="#ffffff">${text}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");

  const { rows } = await c.query(
    `SELECT id, "fullName" FROM "PersonProfile" WHERE "tenantId"=$1 ORDER BY "fullName" ASC`,
    [tenantId],
  );

  // Give ~1/3 of people (deterministic) an inline-SVG avatar; leave the rest null
  // so both the <img> and initials-fallback code paths are exercised in the UI.
  let phones = 0;
  let avatars = 0;
  for (const p of rows) {
    const phone = phoneFor(p.id);
    const withAvatar = hash(`pick:${p.id}`) % 3 === 0;
    const avatarUrl = withAvatar ? avatarFor(p.fullName) : null;
    await c.query(
      `UPDATE "PersonProfile" SET phone=$2, "avatarUrl"=COALESCE($3, "avatarUrl"), "updatedAt"=now() WHERE id=$1`,
      [p.id, phone, avatarUrl],
    );
    phones++;
    if (withAvatar) avatars++;
  }

  await c.query('COMMIT');
  console.log(
    `person-avatars seed OK | tenant=${tenantId} people=${rows.length} phones=${phones} avatars=${avatars}`,
  );
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('person-avatars seed FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
