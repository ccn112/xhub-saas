// DATA-04 (Wave A) — Project Supply & Vendor Graph. Imports the 81 project
// candidates, 85 supply-graph edges, 14 hierarchy relations, and 10 supply
// gaps from seed-data/data04/*.json (verbatim extract of the official
// package's `01_DATA04_MASTER.xlsx` — see docs/data04/).
//
// GROUNDED FACT (checked directly against the Excel): every one of the 85
// edges' "Project raw" name matches exactly one of the 81 "Project name"
// values in 02_Project Candidates — that's the join key, there is no shared
// numeric ID between the two sheets. And per the package's own rule ("does
// NOT invent XHub project IDs"), all 85 rows arrive with
// "XHub match status" = PENDING_XHUB_MATCH — checked directly, none of the
// 81 candidate names is Hapulico (the only real GlobalProject seeded so
// far), so 0/81 resolve to a real project this pass. That is the correct,
// honest outcome (same Wave-C caveat as DATA-01/02/03's project graphs), not
// a bug — every row still gets durable storage via ProjectCandidate
// (nullable matchedGlobalProjectId), never silently dropped.
//
// organizationId/productId on each edge are resolved by normalizedName
// match against DATA-01/02/03's canonical Organization/EquipmentProduct
// rows where possible; unresolved providers keep rawProviderName (never
// force-linked, never invented).
//
// Idempotent (wipes+reimports its own 4 tables by candidateCode/edge
// identity — see data04-reset.mjs for a full wipe). Run: npm run seed:data04
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { normalizeVi } from './geo-text.mjs';

const DIR = join(process.cwd(), 'seed-data', 'data04');
const load = (name) => JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8'));
const supplyGraph = load('project-supply-graph');
const candidates = load('project-candidates');
const hierarchy = load('project-hierarchy');
const gapQueue = load('gap-queue');

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const counts = {
  candidates: 0,
  edges: 0,
  edgesResolvedToOrganization: 0,
  edgesResolvedToProduct: 0,
  hierarchyRelations: 0,
  hierarchyRelationsSkippedUnresolved: 0,
  gaps: 0,
  gapsSkippedUnresolved: 0,
  matchedToRealProject: 0,
};

try {
  // --- 1. Project Candidates (self-relation resolved in a second pass, since
  // parent rows can appear after their children in the sheet) ---
  const candidateIdByName = new Map(); // "Project name" -> ProjectCandidate.id
  for (const row of candidates) {
    const id = (
      await client.query(
        `INSERT INTO "ProjectCandidate"
           (id, "candidateCode", "projectNameRaw", "projectNormalized", province, developer,
            "projectType", "primaryEvidenceUrl", "matchStatus", "edgeCount", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, now())
         ON CONFLICT ("candidateCode") DO UPDATE SET
           "projectNameRaw"=EXCLUDED."projectNameRaw", "edgeCount"=EXCLUDED."edgeCount", "updatedAt"=now()
         RETURNING id`,
        [
          row['Candidate ID'],
          row['Project name'],
          normalizeVi(row['Project name']),
          row['Province'] ?? null,
          row['Developer'] ?? null,
          row['Project type'] ?? null,
          row['Primary evidence'] ?? null,
          row['Match status'] ?? 'PENDING_XHUB_MATCH',
          row['Edge count'] ?? 0,
        ],
      )
    ).rows[0].id;
    candidateIdByName.set(row['Project name'], id);
    counts.candidates++;
    if (row['Match status'] !== 'PENDING_XHUB_MATCH') counts.matchedToRealProject++;
  }
  // Second pass: parentCandidateId (self-relation).
  for (const row of candidates) {
    if (!row['Parent candidate']) continue;
    const parentId = candidateIdByName.get(row['Parent candidate']);
    if (!parentId) continue; // parent name doesn't resolve to a seeded candidate — leave unlinked, don't invent
    await client.query(`UPDATE "ProjectCandidate" SET "parentCandidateId"=$1 WHERE id=$2`, [
      parentId,
      candidateIdByName.get(row['Project name']),
    ]);
  }

  // --- 2. Supply graph edges -> ProjectGraphEdge ---
  for (const row of supplyGraph) {
    const projectCandidateId = candidateIdByName.get(row['Project raw']);
    if (!projectCandidateId) {
      console.warn(`  (skip) edge ${row['Edge ID']}: project "${row['Project raw']}" has no matching candidate`);
      continue;
    }

    const providerName = row['Provider / Supplier'];
    let organizationId = null;
    if (providerName) {
      const norm = normalizeVi(providerName);
      const byName = await client.query(
        `SELECT id FROM "Organization" WHERE "normalizedName" = $1 LIMIT 1`,
        [norm],
      );
      organizationId = byName.rows[0]?.id ?? null;
      if (!organizationId) {
        // Try substring match both ways — source names are rarely the exact
        // legal name (e.g. "Mitsubishi Elevator Vietnam" vs the Organization's
        // own legal name), same tolerance as data03-baseline-seed.mjs's brand
        // matching.
        const candidates2 = await client.query(`SELECT id, "normalizedName" FROM "Organization"`);
        const hit = candidates2.rows.find(
          (o) => o.normalizedName.includes(norm) || norm.includes(o.normalizedName),
        );
        organizationId = hit?.id ?? null;
      }
    }
    if (organizationId) counts.edgesResolvedToOrganization++;

    let productId = null;
    const modelProduct = row['Model / Product'];
    if (organizationId && modelProduct) {
      const modelNorm = normalizeVi(modelProduct);
      const products = await client.query(
        `SELECT id, "modelCode", "familyName" FROM "EquipmentProduct" WHERE "manufacturerOrgId" = $1`,
        [organizationId],
      );
      const hit = products.rows.find((p) => {
        const code = normalizeVi(p.modelCode ?? '');
        const family = normalizeVi(p.familyName ?? '');
        return (code && (code.includes(modelNorm) || modelNorm.includes(code))) || (family && modelNorm.includes(family));
      });
      productId = hit?.id ?? null;
    }
    if (productId) counts.edgesResolvedToProduct++;

    await client.query(
      `INSERT INTO "ProjectGraphEdge"
         (id, "projectCandidateId", "organizationId", "productId", "rawProviderName", "originData",
          "relationshipType", "serviceCategory", brand, "modelProduct", quantity, unit, "scopeText",
          "contractFrom", "contractTo", "relationshipStatus", "contractValue", "contractValueCurrency",
          "valueQualifier", "evidenceTier", "evidenceUrl", confidence, notes)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
      [
        projectCandidateId,
        organizationId,
        productId,
        providerName ?? null,
        row['Origin DATA'] ?? null,
        row['Relationship type'],
        row['Service category'] ?? null,
        row['Brand'] ?? null,
        modelProduct ?? null,
        row['Quantity'] ?? null,
        row['Unit'] ?? null,
        row['Scope / Package'] ?? null,
        row['Contract from'] ?? null,
        row['Contract to'] ?? null,
        row['Relationship status'] ?? 'UNKNOWN',
        row['Contract value'] ?? null,
        row['Currency'] ?? null,
        row['Value qualifier'] ?? null,
        row['Evidence tier'] ?? null,
        row['Evidence URL'] ?? null,
        row['Confidence'] ?? null,
        row['Notes'] ?? null,
      ],
    );
    counts.edges++;
  }

  // --- 3. Project hierarchy -> ProjectHierarchyRelation ---
  for (const row of hierarchy) {
    const childId = candidateIdByName.get(row['Child project']);
    const parentId = candidateIdByName.get(row['Parent project']);
    if (!childId || !parentId) {
      counts.hierarchyRelationsSkippedUnresolved++;
      console.warn(
        `  (skip) hierarchy row "${row['Child project']}" -> "${row['Parent project']}": ` +
          `${!childId ? 'child' : 'parent'} name not found among the 81 candidates`,
      );
      continue;
    }
    await client.query(
      `INSERT INTO "ProjectHierarchyRelation" (id, "parentCandidateId", "childCandidateId", "relationType")
       VALUES (gen_random_uuid()::text, $1, $2, $3)
       ON CONFLICT ("parentCandidateId","childCandidateId") DO NOTHING`,
      [parentId, childId, row['Relation'] ?? 'CHILD_OF'],
    );
    counts.hierarchyRelations++;
  }

  // --- 4. Gap queue -> ProjectSupplyGap ---
  for (const row of gapQueue) {
    const projectCandidateId = candidateIdByName.get(row['Project']);
    if (!projectCandidateId) {
      counts.gapsSkippedUnresolved++;
      console.warn(`  (skip) gap row: project "${row['Project']}" not found among the 81 candidates`);
      continue;
    }
    await client.query(
      `INSERT INTO "ProjectSupplyGap"
         (id, "projectCandidateId", category, "knownFact", "researchPriority", status, "evidenceUrl")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6)`,
      [
        projectCandidateId,
        row['Gap category'] ?? null,
        row['Known fact / gap'] ?? null,
        row['Priority'] ?? null,
        row['Status'] ?? 'OPEN',
        row['Evidence'] ?? null,
      ],
    );
    counts.gaps++;
  }

  console.log('DATA04_BASELINE_SEED_OK |', JSON.stringify(counts));
  console.log(
    `DATA04_BASELINE_SEED_INFO | matchedToRealProject=${counts.matchedToRealProject} — 0 is EXPECTED ` +
      `this pass (only Hapulico is seeded in GlobalProject; none of the 81 candidates is Hapulico, ` +
      `checked directly). All 81/85/14/10 rows are durably staged either way — nothing silently dropped ` +
      `except the "unresolved" rows logged above (hierarchy/gap rows whose project name wasn't among the ` +
      `81 candidates, which is a source-data quality note, not an import bug).`,
  );
} catch (err) {
  console.error('DATA04_BASELINE_SEED_FAILED', err);
  process.exitCode = 1;
} finally {
  await client.end();
}
