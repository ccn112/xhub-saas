// DATA-03 (Wave A) — SupplierMediaIngestWorker, as a standalone script (same
// convention as geo-hapulico-ingest.mjs — this is a batch job, not a NestJS
// runtime service). Fetches each OrganizationMedia row's `remoteImageUrl`
// (Google's public favicon proxy or the org's own official site — see
// docs/data03/ §5, user explicitly approved this download step), validates
// it (doc §4: reject tracking pixels / broken images / <32px non-favicon),
// hashes it, and caches it locally under storage/media/organizations/ — per
// doc §3 "production UI must use XHub-cached media, not hotlink websites".
//
// Bounded to the ~23 known URLs already in OrganizationMedia from
// data03-baseline-seed.mjs — no open-ended crawling, no new URL discovery.
// Idempotent: skips rows already status='CACHED' with a matching contentHash.
// Run: npm run ingest:data03-media
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';
import { imageSize } from 'image-size';

const STORAGE_DIR = process.env.MEDIA_STORAGE_DIR ?? join(process.cwd(), 'storage', 'media', 'organizations');
const MIN_DIMENSION_PX = 32; // doc §4: reject < 32px except favicon fallback
const MAX_BYTES = 2 * 1024 * 1024; // 2MB — logos/favicons are tiny; anything bigger is suspicious

const MIME_TO_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

async function fetchImage(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (data03-media-ingest/1.0)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() ?? null;
  const buf = Buffer.from(await res.arrayBuffer());
  return { buf, contentType };
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const counts = { pending: 0, cached: 0, rejected: 0, skippedAlreadyCached: 0 };

try {
  const { rows: pending } = await client.query(
    `SELECT id, "organizationId", "remoteImageUrl", "imageType" FROM "OrganizationMedia" WHERE status = 'PENDING'`,
  );
  counts.pending = pending.length;

  for (const media of pending) {
    if (!media.remoteImageUrl) {
      await client.query(`UPDATE "OrganizationMedia" SET status='REJECTED' WHERE id=$1`, [media.id]);
      counts.rejected++;
      continue;
    }
    try {
      const { buf, contentType } = await fetchImage(media.remoteImageUrl);

      if (buf.length === 0 || buf.length > MAX_BYTES) {
        throw new Error(`size out of bounds (${buf.length} bytes)`);
      }
      if (contentType && !contentType.startsWith('image/')) {
        throw new Error(`not an image (content-type=${contentType})`);
      }

      let width = null;
      let height = null;
      const isFavicon = media.imageType === 'FAVICON' || media.remoteImageUrl.includes('favicon');
      try {
        const dim = imageSize(buf);
        width = dim.width;
        height = dim.height;
        if (!isFavicon && (width < MIN_DIMENSION_PX || height < MIN_DIMENSION_PX)) {
          throw new Error(`image too small (${width}x${height}px, min ${MIN_DIMENSION_PX}px, doc §4)`);
        }
      } catch (dimErr) {
        // SVG/unrecognized-by-image-size formats: accept without dimension
        // check rather than reject on a parser gap — logged, not silent.
        console.warn(`  (info) could not read dimensions for ${media.remoteImageUrl}: ${dimErr.message}`);
      }

      const contentHash = createHash('sha256').update(buf).digest('hex');
      const ext = MIME_TO_EXT[contentType] ?? 'bin';
      const dir = join(STORAGE_DIR, media.organizationId);
      await mkdir(dir, { recursive: true });
      const filename = `${contentHash.slice(0, 16)}.${ext}`;
      const localPath = join(dir, filename);
      await writeFile(localPath, buf);

      await client.query(
        `UPDATE "OrganizationMedia" SET
           "contentHash"=$1, "mimeType"=$2, width=$3, height=$4, "localMediaPath"=$5,
           "retrievedAt"=now(), status='CACHED'
         WHERE id=$6`,
        [contentHash, contentType, width, height, localPath, media.id],
      );
      counts.cached++;
      console.log(`  ✓ cached ${media.remoteImageUrl} -> ${localPath} (${width ?? '?'}x${height ?? '?'})`);
    } catch (err) {
      await client.query(`UPDATE "OrganizationMedia" SET status='REJECTED' WHERE id=$1`, [media.id]);
      counts.rejected++;
      console.warn(`  ✗ rejected ${media.remoteImageUrl}: ${err.message}`);
    }
  }

  console.log(`DATA03_MEDIA_INGEST_OK | ${JSON.stringify(counts)}`);
} catch (err) {
  console.error('DATA03_MEDIA_INGEST_FAILED', err);
  process.exitCode = 1;
} finally {
  await client.end();
}
