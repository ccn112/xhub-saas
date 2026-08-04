// X.Office Management Operating System — INDUSTRY KPI/OKR SMOKE.
// Proves the industry-aware management seed: every demo tenant carries objectives
// and KPIs that belong to ITS OWN industry (not a copy of T001's tech set), the
// #5 metric contract is complete, the #12 connector honesty holds, RLS isolation
// still applies cross-tenant, and the shipped T001 reference slice is untouched.
//
// Read-only (no fixtures created ⇒ nothing to clean).
// Prereqs: npm run seed:manage && npm run seed:manage-okr (T001 reference slice —
// note test:manage-slice intentionally wipes it, so re-seed after running that)
// and npm run seed:manage-industries (T002–T010), with the API up on :4000.
// Run: npm run test:manage-industry
import 'dotenv/config';
import pg from 'pg';
import { INDUSTRIES, TENANT_INDUSTRY, SEEDABLE_TENANTS, industryFor, metricsWithObjective } from './industry-kpi-catalog.mjs';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const T001 = 'tenant-xtech';
const H = (t) => ({ 'content-type': 'application/json', 'x-tenant-id': t, 'x-user-id': 'user-nam' });

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✓ ' + msg);
  else { console.error('  ✗ ' + msg); failed++; }
};
async function api(path, tenant) {
  const res = await fetch(BASE + path, { headers: H(tenant) });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json };
}

/** Industry fingerprints — a metric or objective name MUST match, proving the
 *  content is genuinely industry-specific and not the generic tech set. */
const FINGERPRINT = {
  REAL_ESTATE: /hấp thụ|bàn giao|pháp lý|rổ hàng/i,
  MANUFACTURING: /OEE|lỗi sản xuất|defect|phế phẩm|làm lại/i,
  DISTRIBUTION: /tồn kho|điểm bán|CAC|thu hút khách/i,
  CONSTRUCTION: /công trường|vật tư|tiến độ|thi công|SPI|LTIFR/i,
  HOSPITALITY: /phòng|RevPAR|lưu trú|lấp đầy/i,
  EDUCATION: /học|khóa học|giảng viên|chuyên cần/i,
  HEALTHCARE: /người bệnh|chờ khám|bảo hiểm|ca trực/i,
  LOGISTICS: /OTIF|vận chuyển|đội xe|chạy rỗng|kho/i,
  PROFESSIONAL_SERVICES: /utilization|thắng thầu|thực thu|realization|chuyên môn/i,
};
/** Generic T001 tech codes that must NOT appear in an industry tenant. */
const TECH_CODES = ['ST-GROWTH', 'ST-CUSTOMER', 'ST-OPS', 'ST-CAP'];

const c = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
await c.connect();
try {
  await c.query("SELECT set_config('app.bypass_rls','on',false)");

  console.log(`manage-industry smoke @ ${BASE}`);

  // --- 0) Catalog shape ------------------------------------------------------
  console.log('\n[catalog]');
  const industryKeys = Object.keys(INDUSTRIES).filter((k) => !INDUSTRIES[k].reference);
  ok(industryKeys.length >= 9, `catalog defines >= 9 non-reference industries (got ${industryKeys.length})`);
  ok(Object.keys(TENANT_INDUSTRY).length === 10, `10 demo tenants mapped to an industry (got ${Object.keys(TENANT_INDUSTRY).length})`);
  for (const key of industryKeys) {
    const e = INDUSTRIES[key];
    const perspectives = new Set(e.objectives.map((o) => o.perspective));
    ok(e.objectives.length === 4 && perspectives.size === 4, `${key}: 4 perspective-balanced objectives`);
    ok(e.metrics.length >= 7, `${key}: >= 7 industry metrics (got ${e.metrics.length})`);
    ok(e.okr?.objectives?.length === 2 && e.okr.objectives.every((o) => o.keyResults.length === 2), `${key}: OKR cycle with 2 objectives × 2 key results`);
  }

  // --- 1) Per-tenant seeded content is industry-appropriate ------------------
  const seenCodes = {};
  for (const tenant of SEEDABLE_TENANTS) {
    const entry = industryFor(tenant);
    console.log(`\n[${tenant} → ${entry.key}]`);

    const objs = (await c.query(`SELECT code,name,perspective,"linkedMetricIds" FROM "StrategicObjective" WHERE "tenantId"=$1 AND code LIKE 'ST-%'`, [tenant])).rows;
    const mets = (await c.query(`SELECT code,name,unit,direction,"ownerId",formula,"sourceSystem",frequency,baseline,target,"thresholdAmber","thresholdRed" FROM "MetricDefinition" WHERE "tenantId"=$1`, [tenant])).rows;
    const objCodes = objs.map((o) => o.code);
    const metCodes = mets.map((m) => m.code);
    seenCodes[tenant] = { objCodes, metCodes };

    const wantObj = entry.objectives.map((o) => o.code);
    ok(wantObj.every((cd) => objCodes.includes(cd)), `has its 4 industry objectives (${wantObj.join(', ')})`);
    ok(!TECH_CODES.some((cd) => objCodes.includes(cd)), 'does NOT carry T001 generic tech objective codes');

    const fp = FINGERPRINT[entry.key];
    const names = [...objs.map((o) => o.name), ...mets.map((m) => m.name)].join(' | ');
    ok(fp.test(names), `content matches its industry fingerprint ${fp}`);

    const wantMet = metricsWithObjective(entry).map((m) => m.code);
    ok(wantMet.every((cd) => metCodes.includes(cd)), `has all ${wantMet.length} catalog metrics incl. the universal ACT-CLOSE`);

    // #5 — every metric fully specified, even the MANUAL ones.
    const incomplete = mets.filter((m) => !m.ownerId || !m.formula || !m.sourceSystem || !m.frequency || !m.direction
      || m.baseline == null || m.target == null || m.thresholdAmber == null || m.thresholdRed == null);
    ok(incomplete.length === 0, `#5: all ${mets.length} metrics have owner/formula/source/frequency/direction/baseline/target/thresholds (${incomplete.map((m) => m.code).join(',') || 'none missing'})`);

    // #12 — exactly ONE real connector; everything else honestly MANUAL.
    const work = mets.filter((m) => m.sourceSystem === 'XOFFICE_WORK');
    ok(work.length === 1 && work[0].code === 'ACT-CLOSE', `#12: exactly 1 XOFFICE_WORK metric (ACT-CLOSE), got ${work.map((m) => m.code).join(',') || 'none'}`);
    ok(mets.filter((m) => m.sourceSystem === 'MANUAL').length === mets.length - 1, '#12: every non-Work KPI is honestly marked MANUAL (no fake connectors)');

    // Observations exist and MANUAL metrics record source=MANUAL.
    const obs = (await c.query(
      `SELECT o.source, m.code FROM "MetricObservation" o JOIN "MetricDefinition" m ON m.id=o."metricId" WHERE o."tenantId"=$1`, [tenant])).rows;
    ok(obs.length >= mets.length, `has an observation per metric (${obs.length} >= ${mets.length})`);
    ok(obs.filter((o) => o.code !== 'ACT-CLOSE').every((o) => o.source === 'MANUAL'), '#12: industry observations recorded with source=MANUAL');

    // #3/#9 — Objective, Metric and OKR stay distinct objects, linked by reference.
    ok(objs.some((o) => (o.linkedMetricIds ?? []).length > 0), '#3/#9: objectives link to metrics BY REFERENCE (linkedMetricIds)');

    // OKR content, industry-worded.
    const okrs = (await c.query(
      `SELECT o.id, o.objective, o."strategicObjectiveIds", count(k.id)::int AS krs
         FROM "OKRObjective" o LEFT JOIN "KeyResult" k ON k."okrObjectiveId"=o.id
        WHERE o."tenantId"=$1 AND o.id LIKE 'mgind-%' GROUP BY o.id`, [tenant])).rows;
    ok(okrs.length === 2, `has 2 industry OKR objectives (got ${okrs.length})`);
    ok(okrs.every((o) => o.krs === 2), 'each OKR objective has 2 key results');
    ok(okrs.every((o) => (o.strategicObjectiveIds ?? []).length > 0), '#9: OKR objectives align to StrategicObjective by reference');
    const krs = (await c.query(`SELECT description, unit, baseline, target, current FROM "KeyResult" WHERE "tenantId"=$1 AND id LIKE 'mgind-%'`, [tenant])).rows;
    ok(krs.length === 4 && krs.every((k) => k.unit && k.baseline != null && k.target != null && k.current != null), 'key results carry unit + baseline/target/current');
    ok(fp.test(krs.map((k) => k.description).join(' | ') + ' ' + okrs.map((o) => o.objective).join(' | ')), 'OKR wording is industry-specific too');
  }

  // --- 2) Genuine cross-industry differentiation -----------------------------
  console.log('\n[differentiation]');
  const mfg = seenCodes['tenant-manufacturing-demo'];
  const dist = seenCodes['tenant-distribution-demo'];
  const overlapObj = mfg.objCodes.filter((cd) => dist.objCodes.includes(cd));
  ok(overlapObj.length === 0, `manufacturing vs distribution share 0 objective codes (overlap: ${overlapObj.join(',') || 'none'})`);
  const overlapMet = mfg.metCodes.filter((cd) => dist.metCodes.includes(cd) && cd !== 'ACT-CLOSE');
  ok(overlapMet.length === 0, `manufacturing vs distribution share 0 KPI codes besides the universal ACT-CLOSE (overlap: ${overlapMet.join(',') || 'none'})`);
  const allObjCodes = SEEDABLE_TENANTS.flatMap((t) => seenCodes[t].objCodes);
  ok(new Set(allObjCodes).size === allObjCodes.length, 'no two demo tenants reuse the same objective code (fully differentiated)');

  // --- 3) T001 reference slice UNCHANGED (regression guard) ------------------
  console.log('\n[T001 regression]');
  const t1obj = (await c.query(`SELECT code FROM "StrategicObjective" WHERE "tenantId"=$1`, [T001])).rows.map((r) => r.code);
  ok(TECH_CODES.every((cd) => t1obj.includes(cd)), `T001 still has its 4 shipped objectives (${TECH_CODES.join(', ')})`);
  const t1metric = (await c.query(`SELECT code, "sourceSystem" FROM "MetricDefinition" WHERE "tenantId"=$1 AND code='ACT-CLOSE'`, [T001])).rows[0];
  ok(t1metric?.sourceSystem === 'XOFFICE_WORK', 'T001 ACT-CLOSE metric still sourced from XOFFICE_WORK');
  const t1mgind = Number((await c.query(
    `SELECT (SELECT count(*) FROM "StrategicObjective" WHERE "tenantId"=$1 AND id LIKE 'mgind-%')
          + (SELECT count(*) FROM "MetricDefinition" WHERE "tenantId"=$1 AND id LIKE 'mgind-%')
          + (SELECT count(*) FROM "OKRObjective" WHERE "tenantId"=$1 AND id LIKE 'mgind-%') AS n`, [T001])).rows[0].n);
  ok(t1mgind === 0, `industry seed never wrote into T001 (got ${t1mgind} mgind- rows)`);
  const t1okr = (await c.query(`SELECT count(*)::int AS n FROM "OKRObjective" WHERE "tenantId"=$1 AND id LIKE 'mg03-seed-%'`, [T001])).rows[0].n;
  ok(t1okr === 2, `T001 MG-03 OKR objectives intact (got ${t1okr})`);

  // --- 4) RLS isolation through the API -------------------------------------
  console.log('\n[RLS via API]');
  const r3 = await api('/api/manage/objectives', 'tenant-manufacturing-demo');
  const r4 = await api('/api/manage/objectives', 'tenant-distribution-demo');
  ok(r3.status < 300 && r4.status < 300, `API objectives readable for both tenants (${r3.status}/${r4.status})`);
  const c3 = (r3.json?.items ?? []).map((o) => o.code);
  const c4 = (r4.json?.items ?? []).map((o) => o.code);
  ok(c3.some((cd) => cd.startsWith('ST-MFG-')), `T003 API returns manufacturing objectives (${c3.join(',')})`);
  ok(c4.some((cd) => cd.startsWith('ST-DIST-')), `T004 API returns distribution objectives (${c4.join(',')})`);
  ok(!c3.some((cd) => cd.startsWith('ST-DIST-')) && !c4.some((cd) => cd.startsWith('ST-MFG-')), 'MUST_NOT_LEAK: neither tenant sees the other industry objectives');
  const r1 = await api('/api/manage/objectives', T001);
  const c1 = (r1.json?.items ?? []).map((o) => o.code);
  ok(!c1.some((cd) => cd.startsWith('ST-MFG-') || cd.startsWith('ST-DIST-')), 'MUST_NOT_LEAK: T001 sees no industry-tenant objectives');

  const k3 = await api('/api/manage/kpis', 'tenant-manufacturing-demo');
  const k4 = await api('/api/manage/kpis', 'tenant-distribution-demo');
  const names3 = JSON.stringify(k3.json ?? {});
  const names4 = JSON.stringify(k4.json ?? {});
  ok(/OEE|lỗi sản xuất/i.test(names3), 'KPI tree for T003 surfaces manufacturing KPIs (OEE / lỗi sản xuất)');
  ok(/tồn kho|CAC|điểm bán/i.test(names4), 'KPI tree for T004 surfaces retail/distribution KPIs (tồn kho / CAC)');
  ok(!/OEE/i.test(names4) && !/vòng quay tồn kho/i.test(names3), 'MUST_NOT_LEAK: KPI trees do not cross industries');
} catch (e) {
  console.error('  ✗ smoke threw:', e.message);
  failed++;
} finally {
  await c.end();
}

console.log(failed === 0 ? '\nMANAGE-INDUSTRY SMOKE PASSED' : `\nMANAGE-INDUSTRY SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
