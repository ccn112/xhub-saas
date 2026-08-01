// X.Office Management Operating System — MG-03 (KPI/OKR/Scorecard) seed
// (seed:manage-okr). Talks straight to Postgres under RLS bypass (server NOT
// required). Idempotent (upsert-by natural key / delete+recreate check-in).
// Requires seed:manage to have run first (reuses its 4 StrategicObjective rows
// + ACT-CLOSE MetricDefinition — does NOT recreate them, per handoff instructions).
//
// Seeds:
//   1 Scorecard "2026Q3" with 4 perspectives → the 4 existing StrategicObjective
//   1 OKRCycle "2026Q3" with 2 Objectives (O-001/O-002) + 4 KeyResults (KR-001..004)
//   1 check-in per KeyResult (from OKR_SEED baseline → a value between baseline/target)
import 'dotenv/config';
import pg from 'pg';

const TENANT = 'tenant-xtech';
const OWNER = 'usr-cfo';

const SCORECARD_ID = 'mg03-seed-scorecard-2026q3';
const CYCLE_ID = 'mg03-seed-cycle-2026q3';
const OBJ1_ID = 'mg03-seed-okr-o001';
const OBJ2_ID = 'mg03-seed-okr-o002';
const KR = {
  'KR-001': { id: 'mg03-seed-kr-001', objId: OBJ1_ID, description: '100% Monthly Business Review dùng pre-read chứng nhận', baseline: 0, target: 100, unit: '%', checkin: 45 },
  'KR-002': { id: 'mg03-seed-kr-002', objId: OBJ1_ID, description: 'Giảm thời gian chuẩn bị báo cáo quản trị', baseline: 16, target: 4, unit: 'hours', checkin: 10 },
  'KR-003': { id: 'mg03-seed-kr-003', objId: OBJ2_ID, description: 'Dự án có baseline và forecast cập nhật', baseline: 20, target: 90, unit: '%', checkin: 55 },
  'KR-004': { id: 'mg03-seed-kr-004', objId: OBJ2_ID, description: 'Giảm action quá hạn sau review', baseline: 35, target: 10, unit: '%', checkin: 22 },
};

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");

  // 0) Resolve the 4 existing StrategicObjective ids seeded by seed:manage.
  const objRows = await c.query(`SELECT id, code FROM "StrategicObjective" WHERE "tenantId"=$1 AND code IN ('ST-GROWTH','ST-CUSTOMER','ST-OPS','ST-CAP')`, [TENANT]);
  const byCode = Object.fromEntries(objRows.rows.map((r) => [r.code, r.id]));
  const missing = ['ST-GROWTH', 'ST-CUSTOMER', 'ST-OPS', 'ST-CAP'].filter((c2) => !byCode[c2]);
  if (missing.length) throw new Error(`missing StrategicObjective rows (run seed:manage first): ${missing.join(',')}`);

  // 1) Scorecard — 4 perspectives, REFERENCING the existing objective ids only.
  const perspectives = [
    { code: 'FINANCIAL', name: 'Tài chính / Giá trị', objectiveIds: [byCode['ST-GROWTH']] },
    { code: 'CUSTOMER', name: 'Khách hàng', objectiveIds: [byCode['ST-CUSTOMER']] },
    { code: 'PROCESS', name: 'Vận hành nội bộ', objectiveIds: [byCode['ST-OPS']] },
    { code: 'LEARNING', name: 'Năng lực / Học hỏi', objectiveIds: [byCode['ST-CAP']] },
  ];
  await c.query(
    `INSERT INTO "Scorecard" (id,"tenantId",name,period,perspectives,"createdBy","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,now(),now())
     ON CONFLICT (id) DO UPDATE SET perspectives=EXCLUDED.perspectives, "updatedAt"=now()`,
    [SCORECARD_ID, TENANT, 'Thẻ điểm cân bằng 2026Q3', '2026Q3', JSON.stringify(perspectives), OWNER],
  );

  // 2) OKRCycle 2026Q3.
  await c.query(
    `INSERT INTO "OKRCycle" (id,"tenantId",code,name,"startDate","endDate",status,"createdBy","createdAt","updatedAt")
     VALUES ($1,$2,'2026Q3','Chu kỳ OKR 2026Q3',$3,$4,'ACTIVE',$5,now(),now())
     ON CONFLICT ("tenantId",code) DO UPDATE SET status=EXCLUDED.status, "updatedAt"=now()`,
    [CYCLE_ID, TENANT, new Date(2026, 6, 1), new Date(2026, 9, 1), OWNER],
  );

  // 3) Objectives O-001/O-002, linked to StrategicObjective (alignment).
  await c.query(
    `INSERT INTO "OKRObjective" (id,"tenantId","cycleId",objective,"ownerId",status,confidence,"strategicObjectiveIds","createdBy","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,'ACTIVE',0.6,$6,$7,now(),now())
     ON CONFLICT (id) DO UPDATE SET objective=EXCLUDED.objective, confidence=EXCLUDED.confidence, "updatedAt"=now()`,
    [OBJ1_ID, TENANT, CYCLE_ID, 'Đưa XHub trở thành hệ điều hành quản trị chạy thật tại X-TECH', OWNER, [byCode['ST-CAP'], byCode['ST-OPS']], OWNER],
  );
  await c.query(
    `INSERT INTO "OKRObjective" (id,"tenantId","cycleId",objective,"ownerId",status,confidence,"strategicObjectiveIds","createdBy","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,'ACTIVE',0.55,$6,$7,now(),now())
     ON CONFLICT (id) DO UPDATE SET objective=EXCLUDED.objective, confidence=EXCLUDED.confidence, "updatedAt"=now()`,
    [OBJ2_ID, TENANT, CYCLE_ID, 'Tăng tính dự báo của danh mục triển khai', OWNER, [byCode['ST-OPS']], OWNER],
  );

  // 4) Key results KR-001..004.
  for (const [code, kr] of Object.entries(KR)) {
    await c.query(
      `INSERT INTO "KeyResult" (id,"tenantId","okrObjectiveId",description,baseline,target,current,unit,"linkedActionIds","createdBy","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,ARRAY[]::text[],$9,now(),now())
       ON CONFLICT (id) DO UPDATE SET current=EXCLUDED.current, "updatedAt"=now()`,
      [kr.id, TENANT, kr.objId, kr.description, kr.baseline, kr.target, kr.checkin, kr.unit, OWNER],
    );
    // 5) One check-in per KeyResult (append-only — delete+recreate the seed row is fine, it's a fixed id).
    await c.query(`DELETE FROM "KeyResultCheckIn" WHERE id = $1`, [`${kr.id}-checkin-1`]);
    await c.query(
      `INSERT INTO "KeyResultCheckIn" (id,"tenantId","keyResultId","checkedAt",value,confidence,note,"authorId","createdAt")
       VALUES ($1,$2,$3,now(),$4,0.6,$5,$6,now())`,
      [`${kr.id}-checkin-1`, TENANT, kr.id, kr.checkin, `Cập nhật đầu chu kỳ 2026Q3 (${code})`, OWNER],
    );
  }

  await c.query('COMMIT');
  console.log(`seed:manage-okr OK | tenant=${TENANT} scorecard=1 (4 perspectives) cycle=2026Q3 objectives=2 keyResults=4 checkIns=4`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('seed:manage-okr FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
