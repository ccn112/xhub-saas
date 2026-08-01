// X.Office Management Operating System — INDUSTRY-AWARE management seed
// (seed:manage-industries). Seeds StrategicObjective / MetricDefinition /
// MetricObservation / Scorecard / OKRCycle / OKRObjective / KeyResult /
// KeyResultCheckIn for each demo tenant using ITS OWN industry catalog entry
// (scripts/industry-kpi-catalog.mjs) — no one-size-fits-all copy of T001.
//
// T001 (tenant-xtech) is the REFERENCE slice and is never touched here; it stays
// owned by seed:manage + seed:manage-okr.
//
// Talks straight to Postgres under RLS bypass (server NOT required). Idempotent:
// upsert by natural key (tenantId,code) / fixed deterministic ids.
//
// Run:  npm run seed:manage-industries            (all seedable demo tenants)
//       npm run seed:manage-industries -- 3 4     (tenantNo / key / tenantId)
//
// #12 honesty: only ACT-CLOSE is sourceSystem=XOFFICE_WORK and actually computed
// from NativeWorkItem. Every industry KPI is sourceSystem=MANUAL and its
// observation is recorded with source='MANUAL' — no fake live connector.
import 'dotenv/config';
import pg from 'pg';
import { DEMO_TENANTS } from './demo-tenants.params.mjs';
import { industryFor, metricsWithObjective, SEEDABLE_TENANTS, P } from './industry-kpi-catalog.mjs';

const now = new Date();
const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

// --- tenant selection --------------------------------------------------------
const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
function resolveToTenantId(sel) {
  const s = String(sel);
  const row = DEMO_TENANTS.find((t) => String(t.no) === s || t.key === s || t.id === s);
  if (!row) throw new Error(`unknown demo tenant selector "${sel}"`);
  return row.id;
}
const targets = args.length ? args.map(resolveToTenantId) : SEEDABLE_TENANTS;
for (const t of targets) {
  if (!SEEDABLE_TENANTS.includes(t)) throw new Error(`tenant "${t}" is not industry-seedable (T001 is the reference slice)`);
}

const slug = (tenantId) => tenantId.replace(/^tenant-/, '').replace(/-demo$/, '');
const ownerOf = (tenantId) => DEMO_TENANTS.find((t) => t.id === tenantId)?.empId ?? 'usr-cfo';

/** A plausible "current" reading between baseline and target (~55% of the way). */
const currentValue = (mt) => {
  const v = mt.baseline + (mt.target - mt.baseline) * 0.55;
  return Math.round(v * 100) / 100;
};

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
let totals = { tenants: 0, objectives: 0, metrics: 0, observations: 0, okrObjectives: 0, keyResults: 0 };
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");

  for (const TENANT of targets) {
    const entry = industryFor(TENANT);
    const OWNER = ownerOf(TENANT);
    const s = slug(TENANT);
    const metrics = metricsWithObjective(entry);

    // 1) MetricDefinition first (objectives reference metric ids). ---------------
    const metricIdByCode = {};
    for (const mt of metrics) {
      const id = `mgind-${s}-metric-${mt.code.toLowerCase()}`;
      await c.query(
        `INSERT INTO "MetricDefinition"
           (id,"tenantId",code,name,description,formula,"formulaVersion",unit,direction,"ownerId","dataStewardId","sourceSystem",frequency,classification,baseline,target,"thresholdAmber","thresholdRed","createdBy","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,'v1',$7,$8,$9,$9,$10,$11,'INTERNAL',$12,$13,$14,$15,$9,now(),now())
         ON CONFLICT ("tenantId",code) DO UPDATE SET
           name=EXCLUDED.name, description=EXCLUDED.description, formula=EXCLUDED.formula, unit=EXCLUDED.unit,
           direction=EXCLUDED.direction, "sourceSystem"=EXCLUDED."sourceSystem", frequency=EXCLUDED.frequency,
           baseline=EXCLUDED.baseline, target=EXCLUDED.target, "thresholdAmber"=EXCLUDED."thresholdAmber",
           "thresholdRed"=EXCLUDED."thresholdRed", "updatedAt"=now()`,
        [
          id, TENANT, mt.code, mt.name, `KPI ngành: ${entry.label}`, mt.formula, mt.unit, mt.direction,
          OWNER, mt.sourceSystem, mt.frequency, mt.baseline, mt.target, mt.thresholdAmber, mt.thresholdRed,
        ],
      );
      const real = await c.query(`SELECT id FROM "MetricDefinition" WHERE "tenantId"=$1 AND code=$2`, [TENANT, mt.code]);
      metricIdByCode[mt.code] = real.rows[0].id;
      totals.metrics++;
    }

    // 2) StrategicObjective — 4, perspective-balanced, linked to their metrics. --
    const objIdByCode = {};
    for (const o of entry.objectives) {
      const id = `mgind-${s}-obj-${o.code.toLowerCase()}`;
      const linked = metrics.filter((mt) => mt.objectiveCode === o.code).map((mt) => metricIdByCode[mt.code]);
      await c.query(
        `INSERT INTO "StrategicObjective"
           (id,"tenantId",code,name,description,perspective,"ownerId",status,"reviewCadence","linkedMetricIds","linkedInitiativeIds","createdBy","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'MONTHLY',$9,ARRAY[]::text[],$7,now(),now())
         ON CONFLICT ("tenantId",code) DO UPDATE SET
           name=EXCLUDED.name, description=EXCLUDED.description, perspective=EXCLUDED.perspective,
           status=EXCLUDED.status, "linkedMetricIds"=EXCLUDED."linkedMetricIds", "updatedAt"=now()`,
        [id, TENANT, o.code, o.name, `Mục tiêu chiến lược ngành: ${entry.label}`, o.perspective, OWNER, o.status, linked],
      );
      const real = await c.query(`SELECT id FROM "StrategicObjective" WHERE "tenantId"=$1 AND code=$2`, [TENANT, o.code]);
      objIdByCode[o.code] = real.rows[0].id;
      totals.objectives++;
    }

    // 3) One MetricObservation per metric for the current period. -----------------
    //    ACT-CLOSE is COMPUTED from real NativeWorkItem rows; everything else is
    //    an honest MANUAL entry (#12).
    for (const mt of metrics) {
      let value;
      let source = 'MANUAL';
      let confidence = 0.8;
      if (mt.sourceSystem === 'XOFFICE_WORK') {
        const wi = await c.query(
          `SELECT status, "dueAt" FROM "NativeWorkItem" WHERE "tenantId"=$1 AND status <> 'CANCELLED' AND "dueAt" IS NOT NULL`,
          [TENANT],
        );
        const total = wi.rows.length;
        const overdue = wi.rows.filter((r) => r.dueAt && new Date(r.dueAt) < now && r.status !== 'DONE' && r.status !== 'CANCELLED').length;
        value = total > 0 ? Math.round(((total - overdue) / total) * 1000) / 10 : 100;
        source = 'XOFFICE_WORK';
        confidence = total > 0 ? 1 : 0.5;
      } else {
        value = currentValue(mt);
      }
      await c.query(
        `INSERT INTO "MetricObservation" (id,"tenantId","metricId","periodStart","periodEnd",value,source,confidence,"computedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
         ON CONFLICT ("tenantId","metricId","periodStart","periodEnd") DO UPDATE SET
           value=EXCLUDED.value, source=EXCLUDED.source, confidence=EXCLUDED.confidence, "computedAt"=now()`,
        [`mgind-${s}-obs-${mt.code.toLowerCase()}`, TENANT, metricIdByCode[mt.code], periodStart, periodEnd, value, source, confidence],
      );
      totals.observations++;
    }

    // 4) Scorecard — 4 perspectives referencing the 4 objective ids. --------------
    const byPerspective = (p) => entry.objectives.filter((o) => o.perspective === p).map((o) => objIdByCode[o.code]);
    const perspectives = [
      { code: 'FINANCIAL', name: 'Tài chính / Giá trị', objectiveIds: byPerspective(P.FINANCIAL) },
      { code: 'CUSTOMER', name: 'Khách hàng', objectiveIds: byPerspective(P.CUSTOMER) },
      { code: 'PROCESS', name: 'Vận hành nội bộ', objectiveIds: byPerspective(P.PROCESS) },
      { code: 'LEARNING', name: 'Năng lực / Học hỏi', objectiveIds: byPerspective(P.CAPABILITY) },
    ];
    await c.query(
      `INSERT INTO "Scorecard" (id,"tenantId",name,period,perspectives,"createdBy","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,now(),now())
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, perspectives=EXCLUDED.perspectives, "updatedAt"=now()`,
      [`mgind-${s}-scorecard-${entry.okr.code}`, TENANT, `Thẻ điểm cân bằng ${entry.okr.code} — ${entry.label}`, entry.okr.code, JSON.stringify(perspectives), OWNER],
    );

    // 5) OKR cycle + 2 objectives × 2 key results (+ 1 check-in each). -----------
    const cycleId = `mgind-${s}-cycle-${entry.okr.code}`;
    await c.query(
      `INSERT INTO "OKRCycle" (id,"tenantId",code,name,"startDate","endDate",status,"createdBy","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE',$7,now(),now())
       ON CONFLICT ("tenantId",code) DO UPDATE SET name=EXCLUDED.name, status=EXCLUDED.status, "updatedAt"=now()`,
      [cycleId, TENANT, entry.okr.code, `Chu kỳ OKR ${entry.okr.code}`, new Date(2026, 6, 1), new Date(2026, 9, 1), OWNER],
    );
    const realCycle = (await c.query(`SELECT id FROM "OKRCycle" WHERE "tenantId"=$1 AND code=$2`, [TENANT, entry.okr.code])).rows[0].id;

    for (const oo of entry.okr.objectives) {
      const okrId = `mgind-${s}-okr-${oo.key}`;
      await c.query(
        `INSERT INTO "OKRObjective" (id,"tenantId","cycleId",objective,"ownerId",status,confidence,"strategicObjectiveIds","createdBy","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,'ACTIVE',$6,$7,$5,now(),now())
         ON CONFLICT (id) DO UPDATE SET objective=EXCLUDED.objective, confidence=EXCLUDED.confidence,
           "strategicObjectiveIds"=EXCLUDED."strategicObjectiveIds", "updatedAt"=now()`,
        [okrId, TENANT, realCycle, oo.objective, OWNER, oo.confidence, oo.align.map((code) => objIdByCode[code]).filter(Boolean)],
      );
      totals.okrObjectives++;

      oo.keyResults.forEach(() => totals.keyResults++);
      for (const [i, kr] of oo.keyResults.entries()) {
        const krId = `mgind-${s}-kr-${oo.key}-${i + 1}`;
        await c.query(
          `INSERT INTO "KeyResult" (id,"tenantId","okrObjectiveId",description,baseline,target,current,unit,"linkedActionIds","createdBy","createdAt","updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,ARRAY[]::text[],$9,now(),now())
           ON CONFLICT (id) DO UPDATE SET description=EXCLUDED.description, baseline=EXCLUDED.baseline,
             target=EXCLUDED.target, current=EXCLUDED.current, unit=EXCLUDED.unit, "updatedAt"=now()`,
          [krId, TENANT, okrId, kr.description, kr.baseline, kr.target, kr.current, kr.unit, OWNER],
        );
        await c.query(`DELETE FROM "KeyResultCheckIn" WHERE id=$1`, [`${krId}-checkin-1`]);
        await c.query(
          `INSERT INTO "KeyResultCheckIn" (id,"tenantId","keyResultId","checkedAt",value,confidence,note,"authorId","createdAt")
           VALUES ($1,$2,$3,now(),$4,$5,$6,$7,now())`,
          [`${krId}-checkin-1`, TENANT, krId, kr.current, oo.confidence, `Cập nhật đầu chu kỳ ${entry.okr.code}`, OWNER],
        );
      }
    }

    totals.tenants++;
    console.log(`  ✓ ${TENANT} [${entry.key}] objectives=${entry.objectives.length} metrics=${metrics.length} (1 XOFFICE_WORK + ${metrics.length - 1} MANUAL) okr=${entry.okr.code} (${entry.okr.objectives.length} obj / ${entry.okr.objectives.reduce((n, o) => n + o.keyResults.length, 0)} KR)`);
  }

  await c.query('COMMIT');
  console.log(`\nseed:manage-industries OK | tenants=${totals.tenants} objectives=${totals.objectives} metrics=${totals.metrics} observations=${totals.observations} okrObjectives=${totals.okrObjectives} keyResults=${totals.keyResults}`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('seed:manage-industries FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
