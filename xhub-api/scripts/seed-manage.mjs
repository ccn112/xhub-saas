// X.Office Management Operating System — MG-01 reference-slice seed (seed:manage).
// Seeds ONE full management loop for tenant T001 (tenant-xtech), talking straight
// to Postgres under RLS bypass (server NOT required). Idempotent (upsert-by-id /
// upsert-by natural key). Run: npm run seed:manage
//
// The loop:
//   4 StrategicObjective (ST-GROWTH/ST-CUSTOMER/ST-OPS/ST-CAP)
//   1 MetricDefinition (ACT-CLOSE, sourceSystem=XOFFICE_WORK)
//   1 MetricObservation COMPUTED from the existing NativeWorkItem data (read model)
//   1 Monthly BusinessReview (PRE_READ snapshot referencing the observation)
//   1 DecisionRecord (RAPID roles + evidence, linked to the review)
//   1 ActionCommitment linked to a REAL NativeWorkItem (the bridge, #13)
//
// No plaintext secrets. sourceSystem=XOFFICE_WORK is the ONLY real connector; the
// value is derived, never dual-written back into Work (#12).
import 'dotenv/config';
import pg from 'pg';

const TENANT = 'tenant-xtech'; // T001
const OWNER = 'usr-cfo';
const now = new Date();
const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

const OBJECTIVES = [
  { id: 'mg-seed-obj-growth', code: 'ST-GROWTH', name: 'Tăng trưởng bền vững', perspective: 'Financial/Value', owner: OWNER, status: 'ACTIVE' },
  { id: 'mg-seed-obj-customer', code: 'ST-CUSTOMER', name: 'Trải nghiệm khách hàng liền mạch', perspective: 'Customer', owner: OWNER, status: 'ACTIVE' },
  { id: 'mg-seed-obj-ops', code: 'ST-OPS', name: 'Vận hành nhanh, chuẩn và có thể dự báo', perspective: 'Internal Process', owner: OWNER, status: 'AT_RISK' },
  { id: 'mg-seed-obj-cap', code: 'ST-CAP', name: 'Năng lực số, dữ liệu và AI', perspective: 'Learning/Capability', owner: OWNER, status: 'ACTIVE' },
];

const METRIC = {
  id: 'mg-seed-metric-actclose',
  code: 'ACT-CLOSE',
  name: 'Tỷ lệ cam kết hoàn thành đúng hạn',
  formula: 'share of NativeWorkItem with dueAt that are not overdue (status not DONE/CANCELLED, dueAt >= now)',
  unit: '%',
  direction: 'UP',
  sourceSystem: 'XOFFICE_WORK',
  frequency: 'WEEKLY',
  target: 90,
  thresholdAmber: 80,
  thresholdRed: 70,
};

const OBS_ID = `mg-seed-obs-actclose-${ym}`;
const REVIEW_ID = 'mg-seed-review-mbr';
const DECISION_ID = 'mg-seed-decision-target';
const ACTION_WI_ID = 'mg-seed-wi-action'; // the REAL NativeWorkItem the action links to
const ACTION_ID = 'mg-seed-action-otif';

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");

  // 1) Strategic objectives (link ST-OPS → the ACT-CLOSE metric).
  for (const o of OBJECTIVES) {
    const linked = o.code === 'ST-OPS' ? [METRIC.id] : [];
    await c.query(
      `INSERT INTO "StrategicObjective" (id,"tenantId",code,name,perspective,"ownerId",status,"reviewCadence","linkedMetricIds","linkedInitiativeIds","createdBy","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,'MONTHLY',$8,ARRAY[]::text[],$9,now(),now())
       ON CONFLICT ("tenantId",code) DO UPDATE SET name=EXCLUDED.name, status=EXCLUDED.status, perspective=EXCLUDED.perspective, "linkedMetricIds"=EXCLUDED."linkedMetricIds", "updatedAt"=now()`,
      [o.id, TENANT, o.code, o.name, o.perspective, o.owner, o.status, linked, OWNER],
    );
  }

  // 2) Metric definition (XOFFICE_WORK connector).
  await c.query(
    `INSERT INTO "MetricDefinition" (id,"tenantId",code,name,formula,"formulaVersion",unit,direction,"ownerId","sourceSystem",frequency,target,"thresholdAmber","thresholdRed","createdBy","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,'v1',$6,$7,$8,$9,$10,$11,$12,$13,$14,now(),now())
     ON CONFLICT ("tenantId",code) DO UPDATE SET name=EXCLUDED.name, formula=EXCLUDED.formula, target=EXCLUDED.target, "updatedAt"=now()`,
    [METRIC.id, TENANT, METRIC.code, METRIC.name, METRIC.formula, METRIC.unit, METRIC.direction, OWNER, METRIC.sourceSystem, METRIC.frequency, METRIC.target, METRIC.thresholdAmber, METRIC.thresholdRed, OWNER],
  );

  // 3) Compute the observation from the EXISTING NativeWorkItem data (read model).
  const wi = await c.query(
    `SELECT status, "dueAt" FROM "NativeWorkItem" WHERE "tenantId"=$1 AND status <> 'CANCELLED' AND "dueAt" IS NOT NULL`,
    [TENANT],
  );
  const total = wi.rows.length;
  const overdue = wi.rows.filter((r) => r.dueAt && new Date(r.dueAt) < now && r.status !== 'DONE' && r.status !== 'CANCELLED').length;
  const value = total > 0 ? Math.round(((total - overdue) / total) * 1000) / 10 : 100;
  await c.query(
    `INSERT INTO "MetricObservation" (id,"tenantId","metricId","periodStart","periodEnd",value,source,confidence,"computedAt")
     VALUES ($1,$2,$3,$4,$5,$6,'XOFFICE_WORK',$7,now())
     ON CONFLICT ("tenantId","metricId","periodStart","periodEnd") DO UPDATE SET value=EXCLUDED.value, source=EXCLUDED.source, confidence=EXCLUDED.confidence, "computedAt"=now()`,
    [OBS_ID, TENANT, METRIC.id, periodStart, periodEnd, value, total > 0 ? 1 : 0.5],
  );
  // Re-read the actual observation id (upsert may keep a pre-existing one).
  const obsRow = await c.query(
    `SELECT id FROM "MetricObservation" WHERE "tenantId"=$1 AND "metricId"=$2 AND "periodStart"=$3 AND "periodEnd"=$4`,
    [TENANT, METRIC.id, periodStart, periodEnd],
  );
  const obsId = obsRow.rows[0].id;

  // 4) Monthly Business Review with the pre-read snapshot.
  await c.query(
    `INSERT INTO "BusinessReview" (id,"tenantId",title,type,"periodStart","periodEnd",status,"ownerId","metricObservationIds","decisionIds","actionIds","createdBy","createdAt","updatedAt")
     VALUES ($1,$2,$3,'MONTHLY_BUSINESS',$4,$5,'PRE_READ',$6,ARRAY[$7]::text[],ARRAY[$8]::text[],ARRAY[$9]::text[],$10,now(),now())
     ON CONFLICT (id) DO UPDATE SET "metricObservationIds"=EXCLUDED."metricObservationIds", "decisionIds"=EXCLUDED."decisionIds", "actionIds"=EXCLUDED."actionIds", status=EXCLUDED.status, "updatedAt"=now()`,
    [REVIEW_ID, TENANT, 'Rà soát kinh doanh tháng', periodStart, periodEnd, OWNER, obsId, DECISION_ID, ACTION_ID, OWNER],
  );

  // 5) RAPID decision (DEC-TARGET catalog roles) + evidence pointing at the observation.
  const rapid = { recommend: 'METRIC_OWNER', agree: ['CFO', 'DATA_STEWARD'], decide: 'CEO', input: ['EXECUTIVE'], perform: 'METRIC_OWNER' };
  const options = [
    { name: 'Giữ target 90%', pros: ['Tham vọng, giữ chuẩn'], cons: ['Rủi ro trượt nếu tồn đọng cao'] },
    { name: 'Hạ target 85% + kế hoạch xử lý tồn đọng', pros: ['Khả thi hơn'], cons: ['Giảm áp lực cải tiến'] },
  ];
  await c.query(
    `INSERT INTO "DecisionRecord" (id,"tenantId","reviewId",question,context,"deciderId","recommenderId",decision,rationale,"decidedAt","status",rapid,options,"evidenceRefs","createdBy","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),'DECIDED',$10::jsonb,$11::jsonb,$12,$13,now(),now())
     ON CONFLICT (id) DO UPDATE SET decision=EXCLUDED.decision, status=EXCLUDED.status, rapid=EXCLUDED.rapid, "evidenceRefs"=EXCLUDED."evidenceRefs", "updatedAt"=now()`,
    [
      DECISION_ID, TENANT, REVIEW_ID,
      'Có giữ nguyên target ACT-CLOSE ở 90% cho quý tới không?',
      'Tỷ lệ cam kết đúng hạn đang dưới ngưỡng do tồn đọng việc quá hạn.',
      'usr-ceo', 'usr-cfo',
      'Giữ target 90% và mở một cam kết xử lý tồn đọng việc quá hạn.',
      'Chuẩn vận hành xuất sắc; tồn đọng là xử lý được trong 1 chu kỳ.',
      JSON.stringify(rapid), JSON.stringify(options), [`metricObservation:${obsId}`, `review:${REVIEW_ID}`], OWNER,
    ],
  );

  // 6) The REAL NativeWorkItem the action bridges to (type FOLLOW_UP).
  await c.query(
    `INSERT INTO "NativeWorkItem" (id,"tenantId",type,title,description,status,priority,"ownerId","assigneeIds","dueAt","progressPercent",tags,dimensions,"sourceContext","createdBy","createdAt","updatedAt")
     VALUES ($1,$2,'FOLLOW_UP',$3,$4,'IN_PROGRESS','HIGH',$5,ARRAY[$5]::text[],$6,35,ARRAY['manage','action-commitment']::text[],'{}'::jsonb,$7::jsonb,$8,now(),now())
     ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, status=EXCLUDED.status, "progressPercent"=EXCLUDED."progressPercent", "updatedAt"=now()`,
    [
      ACTION_WI_ID, TENANT, 'Xử lý tồn đọng việc quá hạn để nâng ACT-CLOSE', 'Cam kết từ quyết định MBR: dọn tồn đọng trong chu kỳ.',
      OWNER, periodEnd, JSON.stringify({ origin: 'manage.action', decisionId: DECISION_ID, reviewId: REVIEW_ID }), OWNER,
    ],
  );

  // 7) The ActionCommitment (bridge) linked to that real work item + the decision + review.
  await c.query(
    `INSERT INTO "ActionCommitment" (id,"tenantId",title,"ownerId","dueAt",status,"decisionId","reviewId","nativeWorkItemId","createdBy","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,'IN_PROGRESS',$6,$7,$8,$9,now(),now())
     ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, "nativeWorkItemId"=EXCLUDED."nativeWorkItemId", "updatedAt"=now()`,
    ['mg-seed-action-otif', TENANT, 'Xử lý tồn đọng việc quá hạn để nâng ACT-CLOSE', OWNER, periodEnd, DECISION_ID, REVIEW_ID, ACTION_WI_ID, OWNER],
  );

  await c.query('COMMIT');
  console.log(
    `seed:manage OK | tenant=${TENANT} objectives=${OBJECTIVES.length} metric=ACT-CLOSE observation=${value}% (from ${total} work items, ${overdue} overdue) review=1 decision=1 action=1 (→ ${ACTION_WI_ID})`,
  );
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('seed:manage FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
