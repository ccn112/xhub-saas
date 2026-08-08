// DATA-01 (Wave A) — proof-of-concept crawl of page 1 of the REAL MOC/SXD
// qualified-operator listing. NOT a production crawler (see
// docs/data01/X_MOC_SOURCE_AUDIT.md "Kết luận cho Wave A"): only page 1, no
// pagination exhaustion, no PDF/detail opening. Proves the ingestion +
// entity-resolution pattern extends beyond the static Excel baseline.
//
// Expected (and correct) outcome today: page 1 == the most recent notices,
// which are the SAME ones already in the Excel baseline (both collected
// 2026-08-08) — so this should find 100% exact-name matches, zero new orgs.
// That is a successful idempotency proof, not a failure to find anything new.
//
// Run: npm run crawl:data01
import 'dotenv/config';
import https from 'node:https';
import pg from 'pg';
import { normalizeVi, nameSimilarity } from './geo-text.mjs';

const LISTING_URL =
  'https://moc.gov.vn/vn/chuyen-muc/1308/danh-sach-don-vi-du-dieu-kien-thuc-hien-quan-ly-van-hanh-nha-chung-cu.aspx';
const FUZZY_MIN_SIMILARITY = 0.6;

// Real row structure (verified against the live page, richer than the audit
// doc's first look — the summary <p> actually carries the document number
// and PDF link, so this Wave A crawl gets that too, not just name+date).
// The CMS mixes raw-UTF8 and HTML-entity-encoded Vietnamese inconsistently
// within the SAME paragraph (e.g. "Văn bản số" is raw UTF-8, "Ng&agrave;y" is
// entity-encoded) — so the regex only anchors on structural HTML, and the
// Vietnamese text inside is extracted+decoded in JS afterward, not matched
// literally:
//   <div class="list_tin_tieude">
//     <a href='{detailUrl}'>{title}
//         <span class='news_datetime'>({publishedDate})</span></a>
//   </div>
//   <p>{issueDateSentence} <a href="{pdfUrl}">{documentNoText}</a> {rest}</p>
const ROW_RE =
  /class="list_tin_tieude">\s*<a href='(http:\/\/moc\.gov\.vn\/vn\/tin-tuc\/1308\/(\d+)\/[^']+)'>([\s\S]*?)<span class='news_datetime'>\(([^)]+)\)<\/span><\/a>\s*<\/div>\s*<p>([\s\S]*?)<\/p>/g;
const PDF_LINK_RE = /<a href="([^"]+\.pdf)">([^<]+)<\/a>/;
const DATE_RE = /(\d{1,2}\/\d{1,2}\/\d{4})/;
const DOC_NO_RE = /(\d{2,6}\/[A-ZĐ0-9&;\-]+)/;

// Title template observed on the live page (see audit doc §2):
// "{Cơ quan} thông báo {Tên công ty} đủ điều kiện quản lý vận hành..."
const TITLE_RE = /^(.*?)\s+thông báo\s+(.+?)\s+đủ điều kiện quản lý vận hành/i;

function decodeHtmlEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&agrave;/g, 'à')
    .replace(/&aacute;/g, 'á')
    .replace(/&atilde;/g, 'ã')
    .replace(/&acirc;/g, 'â')
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    .replace(/&ecirc;/g, 'ê')
    .replace(/&iacute;/g, 'í')
    .replace(/&igrave;/g, 'ì')
    .replace(/&oacute;/g, 'ó')
    .replace(/&ograve;/g, 'ò')
    .replace(/&otilde;/g, 'õ')
    .replace(/&ocirc;/g, 'ô')
    .replace(/&uacute;/g, 'ú')
    .replace(/&ugrave;/g, 'ù')
    .replace(/&yacute;/g, 'ý')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// moc.gov.vn's TLS chain is missing the intermediate (GlobalSign RSA OV SSL
// CA 2018) — the leaf cert itself is legitimate and correctly issued
// (verified independently via `curl -vI https://moc.gov.vn`, which trusts it
// through macOS's system CA store), but Node's fetch doesn't do AIA chasing
// the way curl/macOS does, so it fails with UNABLE_TO_VERIFY_LEAF_SIGNATURE.
// Scoped, commented, host-specific workaround — not a general pattern to
// reuse for other/untrusted hosts.
const mocAgent = new https.Agent({ rejectUnauthorized: false });

function fetchListing() {
  return new Promise((resolve, reject) => {
    // Same lesson as geo-hapulico-ingest.mjs's Overpass 406: this site's
    // Apache front-end rejects Node's bare default request headers.
    https
      .get(
        LISTING_URL,
        { headers: { Accept: '*/*', 'User-Agent': 'Mozilla/5.0 (data01-moc-crawl-poc/1.0)' }, agent: mocAgent },
        (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`MOC listing returned HTTP ${res.statusCode}`));
            return;
          }
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => resolve(data));
        },
      )
      .on('error', reject);
  });
}

function parseRows(html) {
  const rows = [];
  for (const m of html.matchAll(ROW_RE)) {
    const [, url, noticeId, titleRaw, publishedDate, pBlock] = m;
    const title = decodeHtmlEntities(titleRaw);
    const titleMatch = title.match(TITLE_RE);
    if (!titleMatch) continue; // not a qualification notice row (e.g. a random news item) — skip
    const [, authority, rawCompanyName] = titleMatch;

    // Best-effort extras from the summary paragraph — not every row has an
    // attached PDF (older entries observed without one), so these can be
    // null; that's an honest NOT_FOUND, not a parse failure.
    const issueDateMatch = pBlock.match(DATE_RE);
    const pdfMatch = pBlock.match(PDF_LINK_RE);
    let documentNo = null;
    let pdfUrl = null;
    if (pdfMatch) {
      pdfUrl = pdfMatch[1];
      const docNoMatch = decodeHtmlEntities(pdfMatch[2]).match(DOC_NO_RE);
      documentNo = docNoMatch ? docNoMatch[1] : null;
    }

    rows.push({
      noticeId,
      url,
      title,
      publishedDate,
      issueDate: issueDateMatch ? issueDateMatch[1] : null,
      documentNo,
      pdfUrl,
      authority: authority.trim(),
      companyName: rawCompanyName.trim(),
    });
  }
  return rows;
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const counts = { fetched: 0, exactMatch: 0, fuzzyCandidate: 0, newCandidate: 0 };

try {
  const html = await fetchListing();
  const rows = parseRows(html);
  counts.fetched = rows.length;
  if (rows.length === 0) {
    throw new Error('parsed 0 rows from the live listing — page structure may have changed, see TITLE_RE/ROW_RE');
  }

  const job = (
    await client.query(
      `INSERT INTO "OrgImportJob" (id, "sourceSystem", domain, stage, "runLabel", "updatedAt")
       VALUES (gen_random_uuid()::text, 'moc_gov_vn', 'ORGANIZATION', 'staging', 'moc-page-1', now())
       RETURNING id`,
    )
  ).rows[0].id;

  const { rows: allOrgs } = await client.query(`SELECT id, "legalName", "normalizedName" FROM "Organization"`);

  for (const row of rows) {
    const normalizedName = normalizeVi(row.companyName);
    await client.query(
      `INSERT INTO "OrgSourceRecord" (id, "importJobId", "sourceSystem", "sourceId", domain, raw, normalized, "updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'moc_gov_vn', $2, 'ORGANIZATION', $3, $4, now())
       ON CONFLICT ("sourceSystem","sourceId") DO UPDATE SET raw = EXCLUDED.raw, normalized = EXCLUDED.normalized, "updatedAt" = now()`,
      [job, row.noticeId, JSON.stringify(row), JSON.stringify({ ...row, normalizedName })],
    );

    const exact = allOrgs.find((o) => o.normalizedName === normalizedName);
    if (exact) {
      await client.query(
        `UPDATE "OrgSourceRecord" SET "organizationId"=$1, "matchStatus"='matched', "matchScore"=1.0 WHERE "importJobId"=$2 AND "sourceId"=$3`,
        [exact.id, job, row.noticeId],
      );
      counts.exactMatch++;
      continue;
    }

    // No exact match — check fuzzy candidates. Per doc §7 "never blind
    // name-only merge": propose only, never auto-link.
    let bestScore = 0;
    let bestOrg = null;
    for (const org of allOrgs) {
      const sim = nameSimilarity(row.companyName, org.legalName);
      if (sim > bestScore) {
        bestScore = sim;
        bestOrg = org;
      }
    }
    const srcRecordId = (
      await client.query(`SELECT id FROM "OrgSourceRecord" WHERE "sourceSystem"='moc_gov_vn' AND "sourceId"=$1`, [
        row.noticeId,
      ])
    ).rows[0].id;

    if (bestOrg && bestScore >= FUZZY_MIN_SIMILARITY) {
      await client.query(
        `INSERT INTO "OrgDuplicatePair" (id, "sourceRecordId", "candidateOrganizationId", "importJobId", score, reason, decision)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 'pending')`,
        [
          srcRecordId,
          bestOrg.id,
          job,
          bestScore,
          `fuzzy name match vs existing Organization ${bestOrg.id} ("${bestOrg.legalName}"), similarity=${bestScore.toFixed(2)}`,
        ],
      );
      await client.query(`UPDATE "OrgSourceRecord" SET "matchStatus"='duplicate', "matchScore"=$1 WHERE id=$2`, [
        bestScore,
        srcRecordId,
      ]);
      counts.fuzzyCandidate++;
    } else {
      // Genuinely new organization candidate — NOT auto-created. Left as an
      // unmatched OrgSourceRecord for a human/later-wave commit step (mirrors
      // geo-hapulico-ingest.mjs's "propose, never silently commit" discipline
      // for anything below a name-only confidence).
      counts.newCandidate++;
    }
  }

  await client.query(`UPDATE "OrgImportJob" SET stage='reviewed', counts=$1 WHERE id=$2`, [JSON.stringify(counts), job]);

  console.log(
    `DATA01_MOC_CRAWL_OK | fetched=${counts.fetched} exactMatch=${counts.exactMatch} ` +
      `fuzzyCandidate=${counts.fuzzyCandidate} newCandidate=${counts.newCandidate}`,
  );
  if (counts.newCandidate === 0 && counts.exactMatch === counts.fetched) {
    console.log(
      'DATA01_MOC_CRAWL_INFO | 100% exact match against the Excel baseline, 0 new — expected, both collected 2026-08-08 (see audit doc).',
    );
  }
} catch (err) {
  console.error('DATA01_MOC_CRAWL_FAILED', err);
  process.exitCode = 1;
} finally {
  await client.end();
}
