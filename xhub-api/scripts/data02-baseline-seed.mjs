// DATA-02 (Wave A) — imports the 153-row Building Service Contractor universe
// (18 verified seeds + 135 research candidates) from
// seed-data/data02/*.json — a read-only extract of the official Excel
// package (ChatGPT Research Agent's baseline, not re-researched by Claude —
// see docs/data02/). Read directly from the file.
//
// Pipeline: OrgImportJob('data02_agent_research') -> OrgSourceRecord (raw, 1
// per universe row) -> commit ONLY the 29 rows with real evidence
// (VERIFIED_SEED | FIRST_PARTY_VERIFIED | DIRECTORY_VERIFIED) to canonical
// Organization + ServiceCapability; the 124 DISCOVERED rows stay in
// OrgSourceRecord as unmatched/review — never blindly promoted (doc's own
// rule: "do not promote a directory candidate to PROCUREMENT_READY solely
// because it appears in a directory").
//
// Entity resolution: reuses DATA-01's Organization table — checks
// normalizedName (and taxCode when present) BEFORE creating a new row, so a
// company already in DATA-01 never gets duplicated here.
// Idempotent. Run: npm run seed:data02
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { normalizeVi } from './geo-text.mjs';

const DIR = join(process.cwd(), 'seed-data', 'data02');
const providerMaster = JSON.parse(readFileSync(join(DIR, 'provider-master.json'), 'utf8'));
const allUniverse = JSON.parse(readFileSync(join(DIR, 'all-provider-universe.json'), 'utf8'));

const PROMOTABLE_VERIFICATION = new Set(['VERIFIED_SEED', 'FIRST_PARTY_VERIFIED', 'DIRECTORY_VERIFIED']);

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const counts = { staged: 0, promoted: 0, keptAsDiscovered: 0, serviceCapabilities: 0, enrichedFromProviderMaster: 0 };

try {
  const job = (
    await client.query(
      `INSERT INTO "OrgImportJob" (id, "sourceSystem", domain, stage, "runLabel", "updatedAt")
       VALUES (gen_random_uuid()::text, 'data02_agent_research', 'ORGANIZATION', 'staging', 'data02-baseline-20260808', now())
       RETURNING id`,
    )
  ).rows[0].id;

  // provider-master.json has richer fields for 18 of the 29 promotable rows —
  // index by normalized name for the enrichment step below.
  const providerMasterByName = new Map(
    providerMaster.map((r) => [normalizeVi(r['Tên pháp lý']), r]),
  );

  for (const row of allUniverse) {
    const sourceId = row['Universe ID'];
    const name = row['Provider/Candidate'];
    const normalizedName = normalizeVi(name);
    const verification = row['Verification'];

    await client.query(
      `INSERT INTO "OrgSourceRecord" (id, "importJobId", "sourceSystem", "sourceId", domain, raw, normalized, "updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'data02_agent_research', $2, 'ORGANIZATION', $3, $4, now())
       ON CONFLICT ("sourceSystem","sourceId") DO UPDATE SET raw = EXCLUDED.raw, normalized = EXCLUDED.normalized, "updatedAt" = now()`,
      [job, sourceId, JSON.stringify(row), JSON.stringify({ name, normalizedName, verification })],
    );
    counts.staged++;

    if (!PROMOTABLE_VERIFICATION.has(verification)) {
      counts.keptAsDiscovered++;
      continue; // stays unmatched — reviewable, never silently promoted
    }

    // Entity resolution: reuse an existing Organization (from DATA-01 or a
    // prior DATA-02 run) by taxCode first, else normalizedName — never
    // duplicate an identity (doc §7 priority: tax_code exact > ... > name-only
    // never auto-merge; here it's the SAME company across runs, not a fuzzy
    // candidate, so normalizedName match is the right idempotency key).
    const mst = row['MST'] != null ? String(row['MST']) : null;
    let orgId = null;
    if (mst) {
      orgId = (await client.query(`SELECT id FROM "Organization" WHERE "taxCode" = $1 LIMIT 1`, [mst])).rows[0]?.id;
    }
    if (!orgId) {
      orgId = (
        await client.query(`SELECT id FROM "Organization" WHERE "normalizedName" = $1 LIMIT 1`, [normalizedName])
      ).rows[0]?.id;
    }

    const enrichment = providerMasterByName.get(normalizedName);
    if (enrichment) counts.enrichedFromProviderMaster++;

    const legalAddress = enrichment?.['Địa chỉ chính thức/văn phòng'] ?? row['Address'] ?? null;
    const phone = enrichment?.['Điện thoại'] ?? row['Phone'] ?? null;
    const email = enrichment?.['Email'] ?? row['Email'] ?? null;
    const website = enrichment?.['Website'] ?? row['Website'] ?? null;
    const region = enrichment?.['Khu vực'] ?? row['Region'] ?? null;

    if (!orgId) {
      orgId = (
        await client.query(
          `INSERT INTO "Organization"
             (id, "organizationType", "legalName", "normalizedName", "taxCode", "legalAddress",
              "companyPhone", "generalEmail", website, "provinceCode", "researchStatus",
              "dataConfidence", "firstObservedAt", "lastObservedAt", "updatedAt")
           VALUES (gen_random_uuid()::text, 'BUILDING_SERVICE_CONTRACTOR', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now(), now())
           RETURNING id`,
          [name, normalizedName, mst, legalAddress, phone, email, website, region, verification, null],
        )
      ).rows[0].id;
    } else {
      await client.query(
        `UPDATE "Organization" SET "researchStatus"=$1, "lastObservedAt"=now(), "updatedAt"=now() WHERE id=$2`,
        [verification, orgId],
      );
    }

    await client.query(`UPDATE "OrgSourceRecord" SET "organizationId"=$1, "matchStatus"='matched', "updatedAt"=now() WHERE "importJobId"=$2 AND "sourceId"=$3`, [
      orgId,
      job,
      sourceId,
    ]);
    counts.promoted++;

    // Service categories — doc §2, Categories column is `;`-separated
    // (e.g. "MEP;HVAC;FIRE_SAFETY").
    const categoriesRaw = enrichment?.['Category codes'] ?? row['Categories'];
    if (categoriesRaw) {
      for (const code of String(categoriesRaw).split(';').map((c) => c.trim()).filter(Boolean)) {
        const seen = await client.query(
          `SELECT id FROM "ServiceCapability" WHERE "organizationId"=$1 AND "categoryCode"=$2 LIMIT 1`,
          [orgId, code],
        );
        if (seen.rows.length) continue;
        await client.query(
          `INSERT INTO "ServiceCapability" (id, "organizationId", "categoryCode", "sourceEvidenceId", "createdAt")
           VALUES (gen_random_uuid()::text, $1, $2, $3, now())`,
          [orgId, code, row['Evidence source'] ?? null],
        );
        counts.serviceCapabilities++;
      }
    }
  }

  await client.query(`UPDATE "OrgImportJob" SET stage='committed', counts=$1 WHERE id=$2`, [JSON.stringify(counts), job]);

  console.log(
    `DATA02_BASELINE_SEED_OK | staged=${counts.staged} promoted=${counts.promoted} keptAsDiscovered=${counts.keptAsDiscovered} ` +
      `serviceCapabilities=${counts.serviceCapabilities} enrichedFromProviderMaster=${counts.enrichedFromProviderMaster}`,
  );
  if (counts.promoted !== 29) {
    console.warn(`DATA02_BASELINE_SEED_WARN | expected 29 promotable rows (18+7+4), got ${counts.promoted}`);
  }
} catch (err) {
  console.error('DATA02_BASELINE_SEED_FAILED', err);
  process.exitCode = 1;
} finally {
  await client.end();
}
