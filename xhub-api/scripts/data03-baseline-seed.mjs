// DATA-03 (Wave A) — imports the Equipment/Manufacturer/Product baseline (25
// suppliers, 61 products, 14 channel relations, 7 price observations, 14
// more discovery candidates) from seed-data/data03/*.json — a read-only
// extract of the official v2 Excel package (ChatGPT Research Agent's
// baseline — see docs/data03/).
//
// Reuses the SAME Organization table as DATA-01/02 — manufacturers/
// distributors are Organization rows (organizationType from the source's own
// "Role" column, e.g. 'MANUFACTURER_SERVICE'), never a separate Manufacturer
// table. Entity resolution tries taxCode, then WEBSITE DOMAIN (doc's own
// "verified domain + legal name" tier — this is what correctly reuses
// DATA-02's "KONE VIETNAM"/"SCHINDLER VIETNAM LTD." rows here instead of
// creating duplicates, since the legal names differ but kone.vn/schindler.vn
// domains match exactly), then normalizedName.
//
// Installed-base (06_Installed Base sheet) is intentionally NOT committed
// here — none of its projects (Khai Sơn City, etc.) exist in GlobalProject
// yet (only Hapulico is seeded), and ProjectInstalledProduct requires a real
// match. Those rows are handled by DATA-04's ProjectCandidate-based staging
// instead (see docs/data04/) — committing them here would either fail the FK
// or require inventing a project, both wrong.
//
// Idempotent. Run: npm run seed:data03
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { normalizeVi } from './geo-text.mjs';

const DIR = join(process.cwd(), 'seed-data', 'data03');
const load = (name) => JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8'));
const supplierMaster = load('supplier-master');
const productCatalog = load('product-catalog');
const channelRelations = load('channel-relations');
const priceObservations = load('price-observations');
const agentDiscovery = load('agent-discovery');

function domainOf(url) {
  if (!url) return null;
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const counts = {
  suppliers: 0,
  suppliersReusedFromDATA02: 0,
  media: 0,
  products: 0,
  specs: 0,
  channelRelations: 0,
  priceObservations: 0,
  priceObservationsSkippedNoProduct: 0,
  discoveryStagedOnly: 0,
};

try {
  const job = (
    await client.query(
      `INSERT INTO "OrgImportJob" (id, "sourceSystem", domain, stage, "runLabel", "updatedAt")
       VALUES (gen_random_uuid()::text, 'data03_agent_research', 'ORGANIZATION', 'staging', 'data03-baseline-20260808', now())
       RETURNING id`,
    )
  ).rows[0].id;

  // --- 1. Suppliers -> Organization (entity resolution: taxCode > domain > normalizedName) ---
  const orgIdByD03Id = new Map(); // "ORG-D03-001" -> Organization.id (for channel-relations join)
  const orgIdByBrandNorm = new Map(); // normalized brand -> Organization.id (for product manufacturer join)

  for (const row of supplierMaster) {
    const legalName = row['Tên pháp lý'];
    const normalizedName = normalizeVi(legalName);
    const website = row['Website'];
    const domain = domainOf(website);

    await client.query(
      `INSERT INTO "OrgSourceRecord" (id, "importJobId", "sourceSystem", "sourceId", domain, raw, normalized, "matchStatus", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'data03_agent_research', $2, 'ORGANIZATION', $3, $4, 'matched', now())
       ON CONFLICT ("sourceSystem","sourceId") DO UPDATE SET raw = EXCLUDED.raw, "updatedAt" = now()`,
      [job, row['Org ID'], JSON.stringify(row), JSON.stringify({ legalName, normalizedName, domain })],
    );

    let orgId = null;
    let reused = false;
    if (domain) {
      const byDomain = await client.query(`SELECT id FROM "Organization" WHERE website ILIKE $1 LIMIT 1`, [
        `%${domain}%`,
      ]);
      orgId = byDomain.rows[0]?.id;
    }
    if (!orgId) {
      const byName = await client.query(`SELECT id FROM "Organization" WHERE "normalizedName" = $1 LIMIT 1`, [
        normalizedName,
      ]);
      orgId = byName.rows[0]?.id;
    }
    if (orgId) reused = true;

    if (!orgId) {
      orgId = (
        await client.query(
          `INSERT INTO "Organization"
             (id, "organizationType", "legalName", "normalizedName", website, "provinceCode", "companyPhone",
              "researchStatus", "firstObservedAt", "lastObservedAt", "updatedAt")
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, now(), now(), now())
           RETURNING id`,
          [row['Role'] ?? 'MANUFACTURER', legalName, normalizedName, website, row['Region'] ?? null, row['Phone'] ?? null, row['Verification'] ?? null],
        )
      ).rows[0].id;
    } else {
      counts.suppliersReusedFromDATA02++;
      await client.query(`UPDATE "Organization" SET website=COALESCE(website,$1), "lastObservedAt"=now(), "updatedAt"=now() WHERE id=$2`, [
        website,
        orgId,
      ]);
    }
    await client.query(`UPDATE "OrgSourceRecord" SET "organizationId"=$1 WHERE "importJobId"=$2 AND "sourceId"=$3`, [
      orgId,
      job,
      row['Org ID'],
    ]);
    orgIdByD03Id.set(row['Org ID'], orgId);
    for (const brand of String(row['Brand'] ?? '').split(';').map((b) => normalizeVi(b.trim())).filter(Boolean)) {
      orgIdByBrandNorm.set(brand, orgId);
    }
    counts.suppliers++;

    // Media candidate (doc's 04_SUPPLIER_MEDIA_LOGO_HANDOFF.md contract) —
    // metadata only here; scripts/data03-media-ingest.mjs does the real fetch.
    if (row['Display image URL']) {
      const seen = await client.query(`SELECT id FROM "OrganizationMedia" WHERE "organizationId"=$1 LIMIT 1`, [orgId]);
      if (!seen.rows.length) {
        await client.query(
          `INSERT INTO "OrganizationMedia"
             (id, "organizationId", "sourceWebsite", "logoSourcePage", "remoteImageUrl", "imageType", "sourceTier", status, "createdAt")
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, 'PENDING', now())`,
          [
            orgId,
            website,
            row['Image source page'] ?? null,
            row['Display image URL'],
            row['Image type'] ?? 'DIRECTORY_LOGO',
            row['Image source tier'] ?? null,
          ],
        );
        counts.media++;
      }
    }
  }

  // --- 2. Products -> EquipmentProduct + ProductSpec ---
  const productIdByD03Id = new Map();
  for (const row of productCatalog) {
    const brandNorm = normalizeVi(row['Brand'] ?? '');
    // Product catalog's short Brand ("KONE") vs supplier's own Brand field
    // ("KONE Vietnam") rarely match exactly — try substring both ways.
    let manufacturerOrgId = orgIdByBrandNorm.get(brandNorm) ?? null;
    if (!manufacturerOrgId) {
      for (const [b, id] of orgIdByBrandNorm.entries()) {
        if (b.includes(brandNorm) || brandNorm.includes(b)) {
          manufacturerOrgId = id;
          break;
        }
      }
    }

    const productId = (
      await client.query(
        `INSERT INTO "EquipmentProduct"
           (id, "manufacturerOrgId", "categoryCode", "familyName", "modelCode", "productType",
            "lifecycleStatus", "officialProductUrl", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, now())
         RETURNING id`,
        [
          manufacturerOrgId,
          row['Category'],
          row['Family'] ?? null,
          row['Model/SKU'] ?? null,
          row['Product type'] ?? null,
          row['Lifecycle'] ?? 'UNKNOWN',
          row['Source URL'] ?? null,
        ],
      )
    ).rows[0].id;
    productIdByD03Id.set(row['Product ID'], productId);
    counts.products++;

    // "Key specs" is free-text prose in the source (e.g. "MRL; max travel
    // 120m; max speed 3.0m/s..."), not clean key:value pairs — store as one
    // summary spec rather than guessing a parse that isn't there yet.
    if (row['Key specs']) {
      await client.query(
        `INSERT INTO "ProductSpec" (id, "productId", "specKey", "valueText", "observedAt")
         VALUES (gen_random_uuid()::text, $1, 'summary', $2, now())`,
        [productId, row['Key specs']],
      );
      counts.specs++;
    }
    if (row['Digital/Integration']) {
      await client.query(
        `INSERT INTO "ProductSpec" (id, "productId", "specKey", "valueText", "observedAt")
         VALUES (gen_random_uuid()::text, $1, 'digital_integration', $2, now())`,
        [productId, row['Digital/Integration']],
      );
      counts.specs++;
    }
  }

  // --- 3. Channel relations -> OrganizationProductRelation ---
  for (const row of channelRelations) {
    const orgId = orgIdByD03Id.get(row['Org ID']);
    if (!orgId) continue;
    await client.query(
      `INSERT INTO "OrganizationProductRelation"
         (id, "organizationId", "categoryCode", "relationType", "authorizationStatus", "regionScope", "sourceEvidenceId", "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, 'FIRST_PARTY_CLAIM', $4, $5, now())`,
      [orgId, row['Categories'] ?? null, row['Relation type'] ?? 'DEALER', row['Scope/Notes'] ?? null, row['Evidence'] ?? null],
    );
    counts.channelRelations++;
  }

  // --- 4. Price observations -> ProductPriceObservation ---
  for (const row of priceObservations) {
    const productId = productIdByD03Id.get(row['Product ID']);
    if (!productId) {
      counts.priceObservationsSkippedNoProduct++;
      continue; // one row has no Product ID in the source — never force-link it
    }
    await client.query(
      `INSERT INTO "ProductPriceObservation"
         (id, "productId", amount, currency, "priceScope", "sourceUrl", "sourceVintage", "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, now())`,
      [productId, row['Price'], row['Currency'] ?? 'VND', row['Scope'] ?? 'PUBLIC_RETAIL', row['Source URL'] ?? null, row['Source vintage'] ?? null],
    );
    counts.priceObservations++;
  }

  // --- 5. Agent discovery candidates -> staged only, never auto-promoted ---
  for (const row of agentDiscovery) {
    const name = row['Candidate'];
    await client.query(
      `INSERT INTO "OrgSourceRecord" (id, "importJobId", "sourceSystem", "sourceId", domain, raw, normalized, "updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'data03_agent_research', $2, 'ORGANIZATION', $3, $4, now())
       ON CONFLICT ("sourceSystem","sourceId") DO UPDATE SET raw = EXCLUDED.raw, "updatedAt" = now()`,
      [job, `discovery-${name}`, JSON.stringify(row), JSON.stringify({ name, normalizedName: normalizeVi(name) })],
    );
    counts.discoveryStagedOnly++;
  }

  await client.query(`UPDATE "OrgImportJob" SET stage='committed', counts=$1 WHERE id=$2`, [JSON.stringify(counts), job]);

  console.log('DATA03_BASELINE_SEED_OK |', JSON.stringify(counts));
  console.log(
    `DATA03_BASELINE_SEED_INFO | installed-base sheet (5 rows) intentionally NOT committed here — ` +
      `see docs/data04/ (ProjectCandidate-based staging handles project-linked rows).`,
  );
} catch (err) {
  console.error('DATA03_BASELINE_SEED_FAILED', err);
  process.exitCode = 1;
} finally {
  await client.end();
}
