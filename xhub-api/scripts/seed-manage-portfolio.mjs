// X.Office Management Operating System — MG-04 (Portfolio & Benefit) seed
// (seed:manage-portfolio). Talks straight to Postgres under RLS bypass (server
// NOT required). Idempotent (upsert-by-id). Requires seed:manage (4
// StrategicObjective + ACT-CLOSE metric+observation) and seed:work-projects
// (ExecutionProject EP-INT-001) to have run first — reuses their rows,
// does NOT recreate them (#12/#17: link, never rebuild).
//
// Seeds:
//   1 Portfolio "PF-CORE" grouping 3 Initiative
//   3 Initiative across 3 different stage-gates:
//     INIT-01 (INTAKE, ST-CAP)          — not linked to any project yet
//     INIT-02 (DELIVERY, ST-OPS)        — linked to EP-INT-001 (proves the LINK)
//     INIT-03 (BENEFIT_REVIEW, ST-GROWTH) — linked to EP-INT-001 too, has a benefit
//   2 BenefitProfile for INIT-03:
//     one wired to ACT-CLOSE (metricCode) — realization is DERIVED from the
//     REAL MetricObservation seed-manage already computed, never hand-entered
//     one with no metricCode (stays PLANNED) — honest: not every benefit has a
//     certified metric yet
import 'dotenv/config';
import pg from 'pg';

const TENANT = 'tenant-xtech';
const OWNER = 'usr-cfo';

const PORTFOLIO_ID = 'mg04-seed-portfolio-core';
const INIT1_ID = 'mg04-seed-init-01';
const INIT2_ID = 'mg04-seed-init-02';
const INIT3_ID = 'mg04-seed-init-03';
const BENEFIT1_ID = 'mg04-seed-benefit-actclose';
const BENEFIT2_ID = 'mg04-seed-benefit-nps';
const PROJECT_ID = 'ep-seed-internal'; // EP-INT-001, from seed:work-projects

const c = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");

  // 0) Resolve prerequisite rows — fail loudly rather than silently degrading.
  const objRows = await c.query(`SELECT id, code FROM "StrategicObjective" WHERE "tenantId"=$1 AND code IN ('ST-GROWTH','ST-OPS','ST-CAP')`, [TENANT]);
  const byCode = Object.fromEntries(objRows.rows.map((r) => [r.code, r.id]));
  const missingObj = ['ST-GROWTH', 'ST-OPS', 'ST-CAP'].filter((c2) => !byCode[c2]);
  if (missingObj.length) throw new Error(`missing StrategicObjective rows (run seed:manage first): ${missingObj.join(',')}`);

  const metricRow = await c.query(`SELECT id FROM "MetricDefinition" WHERE "tenantId"=$1 AND code='ACT-CLOSE'`, [TENANT]);
  if (!metricRow.rows[0]) throw new Error('missing MetricDefinition ACT-CLOSE (run seed:manage first)');

  const projRow = await c.query(`SELECT id FROM "ExecutionProject" WHERE "tenantId"=$1 AND id=$2`, [TENANT, PROJECT_ID]);
  if (!projRow.rows[0]) throw new Error(`missing ExecutionProject ${PROJECT_ID} (run seed:work-projects first)`);

  // 1) Initiatives — 3 different stage-gates.
  const initiatives = [
    { id: INIT1_ID, code: 'INIT-01', name: 'Chuẩn hoá năng lực dữ liệu & AI', status: 'INTAKE', objId: byCode['ST-CAP'], projectId: null },
    { id: INIT2_ID, code: 'INIT-02', name: 'Chuẩn hoá vận hành nền tảng X.Office', status: 'DELIVERY', objId: byCode['ST-OPS'], projectId: PROJECT_ID },
    { id: INIT3_ID, code: 'INIT-03', name: 'Chương trình trải nghiệm khách hàng liền mạch', status: 'BENEFIT_REVIEW', objId: byCode['ST-GROWTH'], projectId: PROJECT_ID },
  ];
  for (const i of initiatives) {
    await c.query(
      `INSERT INTO "Initiative" (id,"tenantId",code,name,"ownerId","sponsorId",status,"strategicObjectiveIds","expectedBenefits","executionProjectId","createdBy","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,'usr-ceo',$6,ARRAY[$7]::text[],'[]'::jsonb,$8,$9,now(),now())
       ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, "executionProjectId"=EXCLUDED."executionProjectId", "updatedAt"=now()`,
      [i.id, TENANT, i.code, i.name, OWNER, i.status, i.objId, i.projectId, OWNER],
    );
  }

  // 2) Portfolio grouping all 3.
  await c.query(
    `INSERT INTO "Portfolio" (id,"tenantId",code,name,"ownerRole","itemIds","createdBy","createdAt","updatedAt")
     VALUES ($1,$2,'PF-CORE','Danh mục đầu tư cốt lõi','CEO',ARRAY[$3,$4,$5]::text[],$6,now(),now())
     ON CONFLICT (id) DO UPDATE SET "itemIds"=EXCLUDED."itemIds", "updatedAt"=now()`,
    [PORTFOLIO_ID, TENANT, INIT1_ID, INIT2_ID, INIT3_ID, OWNER],
  );

  // 3) Benefits for INIT-03 — one wired to a REAL certified metric (realization
  //    is derived, never hand-entered), one intentionally without a metric yet.
  await c.query(
    `INSERT INTO "BenefitProfile" (id,"tenantId","initiativeId","benefitName",unit,baseline,target,"metricCode","ownerId","realizationSchedule",status,"createdBy","createdAt","updatedAt")
     VALUES ($1,$2,$3,'Tỷ lệ cam kết hoàn thành đúng hạn','%',70,90,'ACT-CLOSE',$4,'[]'::jsonb,'PLANNED',$5,now(),now())
     ON CONFLICT (id) DO UPDATE SET target=EXCLUDED.target, "updatedAt"=now()`,
    [BENEFIT1_ID, TENANT, INIT3_ID, OWNER, OWNER],
  );
  await c.query(
    `INSERT INTO "BenefitProfile" (id,"tenantId","initiativeId","benefitName",unit,baseline,target,"metricCode","ownerId","realizationSchedule",status,"createdBy","createdAt","updatedAt")
     VALUES ($1,$2,$3,'Điểm hài lòng khách hàng (NPS)','điểm',30,50,NULL,$4,'[]'::jsonb,'PLANNED',$5,now(),now())
     ON CONFLICT (id) DO UPDATE SET "updatedAt"=now()`,
    [BENEFIT2_ID, TENANT, INIT3_ID, OWNER, OWNER],
  );

  await c.query('COMMIT');
  console.log(`seed:manage-portfolio OK | tenant=${TENANT} portfolio=1 initiatives=${initiatives.length} benefits=2 (1 wired to ACT-CLOSE, 1 without metric)`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('seed:manage-portfolio FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
