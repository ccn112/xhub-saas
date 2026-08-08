// DATA-01 (Wave A) — Project ↔ Operator matching (doc §12/§8, the highest-
// value asset per the source package), forward direction: for each org with
// a portfolio hint, split into candidate project name tokens and try to
// match against GlobalProject.
//
// HONEST CAVEAT (see docs/data01/XHUB_ORG_READINESS_AUDIT.md §6): only
// Hapulico is seeded in GlobalProject today (the ~6.000-project migration is
// Wave C, not run yet). This script is expected to find ZERO real matches —
// none of the 12 enriched accounts' portfolio hints mention Hapulico. That is
// the correct, disclosed outcome, not a bug: it proves the matching mechanism
// runs end-to-end (candidate extraction -> normalize -> compare -> log),
// ready to find real matches the moment Wave C populates the catalog.
//
// Run: npm run match:data01
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { normalizeVi, nameSimilarity } from './geo-text.mjs';

const MATCH_MIN_SIMILARITY = 0.7;
const enrichedAccounts = JSON.parse(
  readFileSync(join(process.cwd(), 'seed-data', 'data01', 'enriched-accounts.json'), 'utf8'),
);

// Portfolio hints are free-text, semicolon-separated project mentions (see
// column "Dự án/portfolio đã thấy") — split on common separators, drop
// parenthetical notes/qualifiers, keep short candidate name tokens only.
function extractCandidates(hint) {
  if (!hint) return [];
  return hint
    .split(/[;,]/)
    .map((s) => s.replace(/\([^)]*\)/g, '').trim())
    .filter((s) => s.length > 2 && !/^(cần|website|chưa|trụ sở)/i.test(s));
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const counts = { orgsWithHints: 0, candidatesExtracted: 0, matched: 0 };

try {
  const { rows: projects } = await client.query(`SELECT id, name, "normalizedName" FROM "GlobalProject"`);
  console.log(`DATA01_PROJECT_MATCH | comparing against ${projects.length} GlobalProject row(s) (Wave C not run yet)`);

  for (const row of enrichedAccounts) {
    const hint = row['Dự án/portfolio đã thấy'];
    const candidates = extractCandidates(hint);
    if (!candidates.length) continue;
    counts.orgsWithHints++;
    counts.candidatesExtracted += candidates.length;

    const org = await client.query(`SELECT id FROM "Organization" WHERE "normalizedName" = $1 LIMIT 1`, [
      normalizeVi(row['Tên pháp lý']),
    ]);
    const orgId = org.rows[0]?.id;
    if (!orgId) continue;

    for (const candidate of candidates) {
      let best = null;
      let bestScore = 0;
      for (const project of projects) {
        const score = nameSimilarity(candidate, project.name);
        if (score > bestScore) {
          bestScore = score;
          best = project;
        }
      }
      if (best && bestScore >= MATCH_MIN_SIMILARITY) {
        const exists = await client.query(
          `SELECT id FROM "ProjectOrganizationRelation" WHERE "globalProjectId"=$1 AND "organizationId"=$2 LIMIT 1`,
          [best.id, orgId],
        );
        if (!exists.rows.length) {
          await client.query(
            `INSERT INTO "ProjectOrganizationRelation"
               (id, "globalProjectId", "organizationId", "relationshipType", "relationshipStatus", "evidenceType", confidence, "createdAt")
             VALUES (gen_random_uuid()::text, $1, $2, 'PROPERTY_MANAGER', 'UNKNOWN', 'first_party_portfolio_mention', $3, now())`,
            [best.id, orgId, bestScore],
          );
          counts.matched++;
          console.log(`  matched: "${candidate}" ~ GlobalProject "${best.name}" (score=${bestScore.toFixed(2)})`);
        }
      }
    }
  }

  console.log(
    `DATA01_PROJECT_MATCH_OK | orgsWithHints=${counts.orgsWithHints} candidatesExtracted=${counts.candidatesExtracted} matched=${counts.matched}`,
  );
  if (counts.matched === 0) {
    console.log(
      'DATA01_PROJECT_MATCH_INFO | 0 matches is expected — only Hapulico is seeded; none of the portfolio hints mention it. ' +
        'Re-run this script after Wave C (6.000-project migration) for real matches.',
    );
  }
} catch (err) {
  console.error('DATA01_PROJECT_MATCH_FAILED', err);
  process.exitCode = 1;
} finally {
  await client.end();
}
