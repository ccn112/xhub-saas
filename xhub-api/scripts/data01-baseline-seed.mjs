// DATA-01 (Wave A) — imports the official baseline snapshot (205 orgs / 206
// qualification events / 12 enriched accounts) from seed-data/data01/*.json
// (a read-only extract of the official Excel package — see MANIFEST.json).
// Read directly from the file, never re-scraped for this seed step (the
// Excel IS the audit evidence per the source package's own instruction).
//
// Pipeline: OrgImportJob('excel_baseline') -> OrgSourceRecord (raw, 1 per
// company-master row) -> commit Organization + OrganizationQualification
// (derived current state) -> attach OrganizationQualificationEvent per
// matched official-registry row -> attach enriched-account detail (address/
// contact/representative/field-observations) for the 12 rows that have it.
// Idempotent: upsert-by taxCode when present, else by normalizedName.
// Run: npm run seed:data01
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { normalizeVi } from './geo-text.mjs';

const DIR = join(process.cwd(), 'seed-data', 'data01');
const companyMaster = JSON.parse(readFileSync(join(DIR, 'company-master.json'), 'utf8'));
const officialRegistry = JSON.parse(readFileSync(join(DIR, 'official-registry.json'), 'utf8'));
const enrichedAccounts = JSON.parse(readFileSync(join(DIR, 'enriched-accounts.json'), 'utf8'));

// Qualification notices are valid 5 years from effective date unless
// superseded/revoked/expired by an official event (doc §11/§12).
const QUALIFICATION_YEARS = 5;
function addYears(dateStr, years) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString();
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const counts = { orgs: 0, qualEvents: 0, matchedEvents: 0, unmatchedEvents: 0, enrichedFields: 0, personRoles: 0 };

try {
  const job = (
    await client.query(
      `INSERT INTO "OrgImportJob" (id, "sourceSystem", domain, stage, "runLabel", "updatedAt")
       VALUES (gen_random_uuid()::text, 'excel_baseline', 'ORGANIZATION', 'staging', 'excel-baseline-20260808', now())
       RETURNING id`,
    )
  ).rows[0].id;

  // --- 1. Organization + derived-current OrganizationQualification, from company-master ---
  const orgIdBySeedId = new Map(); // "OPR-0187" -> Organization.id
  const orgIdByNormalizedName = new Map();

  for (const row of companyMaster) {
    const seedId = row['Organization Seed ID'];
    const legalName = row['Tên pháp lý'];
    // NOT row['Normalized name'] — the workbook's own column lowercases but
    // KEEPS diacritics, while normalizeVi() strips them; matching registry/
    // enriched-account rows against this org needs the SAME normalizer on
    // both sides, so always compute it here rather than trusting the sheet.
    const normalizedName = normalizeVi(legalName);

    await client.query(
      `INSERT INTO "OrgSourceRecord" (id, "importJobId", "sourceSystem", "sourceId", domain, raw, normalized, "matchStatus", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'excel_baseline', $2, 'ORGANIZATION', $3, $4, 'matched', now())
       ON CONFLICT ("sourceSystem","sourceId") DO UPDATE SET raw = EXCLUDED.raw, "updatedAt" = now()`,
      [job, seedId, JSON.stringify(row), JSON.stringify({ legalName, normalizedName })],
    );

    // `normalizedName` has no unique DB constraint (only taxCode does — most
    // orgs here have no known taxCode yet), so re-runs are made idempotent by
    // an explicit SELECT-then-insert-if-missing rather than ON CONFLICT.
    let finalOrgId = (
      await client.query(`SELECT id FROM "Organization" WHERE "normalizedName" = $1 LIMIT 1`, [normalizedName])
    ).rows[0]?.id;
    if (!finalOrgId) {
      finalOrgId = (
        await client.query(
          `INSERT INTO "Organization" (id, "legalName", "normalizedName", "provinceCode", "dataConfidence", "firstObservedAt", "lastObservedAt", "updatedAt")
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, now(), now(), now()) RETURNING id`,
          [legalName, normalizedName, row['Tỉnh/TP'] ?? null, row['Confidence'] ?? null],
        )
      ).rows[0].id;
    }

    orgIdBySeedId.set(seedId, finalOrgId);
    orgIdByNormalizedName.set(normalizedName, finalOrgId);
    await client.query(`UPDATE "OrgSourceRecord" SET "organizationId"=$1 WHERE "importJobId"=$2 AND "sourceId"=$3`, [
      finalOrgId,
      job,
      seedId,
    ]);
    counts.orgs++;

    // Derived-current qualification (doc §11/§12: revocation overrides computed expiry).
    const status = row['Qualification status'] ?? 'UNKNOWN';
    const effectiveDate = row['Latest effective date'] ?? null;
    const expiryDate = status === 'REVOKED' ? null : addYears(effectiveDate, QUALIFICATION_YEARS);
    await client.query(
      `INSERT INTO "OrganizationQualification"
         (id, "organizationId", authority, "documentNo", "effectiveDate", "expiryDate", status, "sourceEvidenceId", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, NULL, $2, $3, $4, $5, $6, now())
       ON CONFLICT ("organizationId") DO UPDATE SET
         "documentNo"=EXCLUDED."documentNo", "effectiveDate"=EXCLUDED."effectiveDate",
         "expiryDate"=EXCLUDED."expiryDate", status=EXCLUDED.status, "updatedAt"=now()`,
      [finalOrgId, row['Latest document'] ?? null, effectiveDate, expiryDate, status, row['Nguồn mới nhất'] ?? null],
    );
  }

  // --- 2. OrganizationQualificationEvent, one per official-registry row, matched by name ---
  for (const row of officialRegistry) {
    const orgName = row['Tên đơn vị'];
    const normalizedName = normalizeVi(orgName);
    const orgId = orgIdByNormalizedName.get(normalizedName) ?? null;

    // Idempotency guard — no natural unique key on this append-only table, so
    // re-running the seed shouldn't duplicate the same (name, documentNo,
    // eventType) event. Event ID itself isn't stored (append-only rows don't
    // carry it), so match on the fields that make an event unique in practice.
    const dup = await client.query(
      `SELECT id FROM "OrganizationQualificationEvent"
       WHERE "rawLegalName" = $1 AND "documentNo" IS NOT DISTINCT FROM $2 AND "eventType" = $3 LIMIT 1`,
      [orgName, row['Số văn bản'] ?? null, row['Event'] ?? 'UNKNOWN'],
    );
    if (dup.rows.length) continue;

    if (orgId) counts.matchedEvents++;
    else counts.unmatchedEvents++;

    await client.query(
      `INSERT INTO "OrganizationQualificationEvent"
         (id, "organizationId", "eventType", authority, "documentNo", "effectiveDate",
          "qualificationStatus", "rawLegalName", "sourceEvidenceId", "sourceUrl", "observedAt", "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())`,
      [
        orgId,
        row['Event'] ?? 'UNKNOWN',
        row['Cơ quan'] ?? null,
        row['Số văn bản'] ?? null,
        row['Ngày hiệu lực'] ?? null,
        row['Status'] ?? null,
        orgName,
        row['Event ID'] ?? null,
        row['Nguồn chính thức'] ?? null,
      ],
    );
    counts.qualEvents++;
  }

  // --- 3. Enriched-account detail for the 12 already-enriched organizations ---
  for (const row of enrichedAccounts) {
    const normalizedName = normalizeVi(row['Tên pháp lý']);
    const orgId = orgIdByNormalizedName.get(normalizedName);
    if (!orgId) {
      console.warn(`DATA01_SEED_WARN | enriched account not matched to a baseline org: ${row['Tên pháp lý']}`);
      continue;
    }
    const sourceUrl = row['Nguồn chính thức'] ?? null;
    const taxCode = row['MST'] != null ? String(row['MST']) : null;

    await client.query(
      `UPDATE "Organization" SET
         "shortName"=$1, "taxCode"=$2, "legalAddress"=$3, "officeAddress"=$4,
         "companyPhone"=$5, hotline=$6, "generalEmail"=$7, website=$8,
         "operatorType"=$9, "lastVerifiedAt"=$10, "updatedAt"=now()
       WHERE id=$11`,
      [
        row['Tên ngắn'] ?? null,
        taxCode,
        row['Địa chỉ pháp lý'] ?? null,
        row['Địa chỉ văn phòng'] ?? null,
        row['Điện thoại công bố'] ?? null,
        row['Hotline/Business phone'] ?? null,
        row['Email chung'] ?? null,
        row['Website'] ?? null,
        'INDEPENDENT',
        row['Ngày xác minh'] ?? null,
        orgId,
      ],
    );

    // Field-level evidence — every enriched field gets an explicit VERIFIED
    // observation (doc §14/§7: "not found" must be explicit, never a silent blank).
    const fieldMap = {
      taxCode: row['MST'],
      legalAddress: row['Địa chỉ pháp lý'],
      officeAddress: row['Địa chỉ văn phòng'],
      companyPhone: row['Điện thoại công bố'],
      hotline: row['Hotline/Business phone'],
      generalEmail: row['Email chung'],
      website: row['Website'],
      legalRepresentative: row['Người đại diện công khai'],
    };
    for (const [fieldName, value] of Object.entries(fieldMap)) {
      const status = value == null || value === '' ? 'NOT_FOUND' : 'VERIFIED';
      const seen = await client.query(
        `SELECT id FROM "OrganizationFieldObservation" WHERE "organizationId"=$1 AND "fieldName"=$2 LIMIT 1`,
        [orgId, fieldName],
      );
      if (seen.rows.length) continue;
      await client.query(
        `INSERT INTO "OrganizationFieldObservation"
           (id, "organizationId", "fieldName", value, "sourceType", "sourceUrl", confidence, status, "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, 'TIER_1_OFFICIAL', $4, $5, $6, now())`,
        [orgId, fieldName, value != null ? String(value) : null, sourceUrl, 0.9, status],
      );
      counts.enrichedFields++;
    }

    // Location rows (legal vs office — never conflated, doc §2/§6).
    const hasLoc = async (type) =>
      (
        await client.query(`SELECT id FROM "OrganizationLocation" WHERE "organizationId"=$1 AND "locationType"=$2 LIMIT 1`, [
          orgId,
          type,
        ])
      ).rows.length > 0;
    if (row['Địa chỉ pháp lý'] && !(await hasLoc('HQ_LEGAL'))) {
      await client.query(
        `INSERT INTO "OrganizationLocation" (id, "organizationId", "locationType", "addressRaw", "sourceEvidenceId", "isCurrent", confidence, "createdAt")
         VALUES (gen_random_uuid()::text, $1, 'HQ_LEGAL', $2, $3, true, 0.9, now())`,
        [orgId, row['Địa chỉ pháp lý'], sourceUrl],
      );
    }
    if (row['Địa chỉ văn phòng'] && !(await hasLoc('OFFICE'))) {
      await client.query(
        `INSERT INTO "OrganizationLocation" (id, "organizationId", "locationType", "addressRaw", "sourceEvidenceId", "isCurrent", confidence, "createdAt")
         VALUES (gen_random_uuid()::text, $1, 'OFFICE', $2, $3, true, 0.7, now())`,
        [orgId, row['Địa chỉ văn phòng'], sourceUrl],
      );
    }

    // Public representative name -> Person + PersonCompanyRole. NO identifier
    // number anywhere in this source — see prisma/schema.prisma DATA-01 block
    // comment. Match Person by normalizedName only (never auto-merge people
    // across different name spellings).
    const repName = row['Người đại diện công khai'];
    if (repName) {
      const normRep = normalizeVi(repName);
      let personId = (await client.query(`SELECT id FROM "Person" WHERE "normalizedName" = $1 LIMIT 1`, [normRep]))
        .rows[0]?.id;
      if (!personId) {
        personId = (
          await client.query(
            `INSERT INTO "Person" (id, "fullName", "normalizedName", "firstObservedAt", "lastObservedAt")
             VALUES (gen_random_uuid()::text, $1, $2, now(), now()) RETURNING id`,
            [repName, normRep],
          )
        ).rows[0].id;
      }
      const alreadyHasRole = await client.query(
        `SELECT id FROM "PersonCompanyRole" WHERE "personId"=$1 AND "organizationId"=$2 LIMIT 1`,
        [personId, orgId],
      );
      if (!alreadyHasRole.rows.length) {
        await client.query(
          `INSERT INTO "PersonCompanyRole" (id, "personId", "organizationId", "roleType", status, "sourceEvidenceId", "observedAt", confidence, "createdAt")
           VALUES (gen_random_uuid()::text, $1, $2, 'LEGAL_REPRESENTATIVE', 'OBSERVED', $3, now(), 0.85, now())`,
          [personId, orgId, sourceUrl],
        );
        counts.personRoles++;
      }
    }
  }

  await client.query(`UPDATE "OrgImportJob" SET stage='committed', counts=$1 WHERE id=$2`, [
    JSON.stringify(counts),
    job,
  ]);

  console.log(
    `DATA01_BASELINE_SEED_OK | orgs=${counts.orgs} qualEvents=${counts.qualEvents} ` +
      `(matched=${counts.matchedEvents} unmatched=${counts.unmatchedEvents}) ` +
      `enrichedFields=${counts.enrichedFields} personRoles=${counts.personRoles}`,
  );
  if (counts.unmatchedEvents > 0) {
    console.warn(
      `DATA01_BASELINE_SEED_WARN | ${counts.unmatchedEvents} registry event(s) did not match any organization by name — ` +
        `not silently dropped, stored with organizationId=NULL for later review.`,
    );
  }
} catch (err) {
  console.error('DATA01_BASELINE_SEED_FAILED', err);
  process.exitCode = 1;
} finally {
  await client.end();
}
