// People Essentials — PE-01 (Leave & Availability) seed (seed:people-leave).
// Seeds PeopleTenantConfig (SME Lite — PE-001 owner-approved 2026-08-01) + 5
// LeavePolicyRef + an INITIAL LeaveBalanceSnapshot per policy for a handful of
// REAL seeded people (usr-cfo/usr-accountant/usr-sales-01/usr-tech-head/
// usr-hr-01 — see identity-accounts-seed.mjs). Idempotent (upsert-by-id).
// Talks straight to Postgres under RLS bypass (server NOT required).
// Run: npm run seed:people-leave
import 'dotenv/config';
import pg from 'pg';

const TENANT = 'tenant-xtech'; // T001
const OWNER = 'usr-cfo';
const PERIOD_CODE = String(new Date().getFullYear());

// Real T001 person ids (identity-accounts-seed.mjs) — NOT placeholders.
const PEOPLE = ['usr-cfo', 'usr-accountant', 'usr-sales-01', 'usr-tech-head', 'usr-hr-01'];

const POLICIES = [
  { id: 'people-seed-policy-annual', code: 'ANNUAL', name: 'Nghỉ phép năm', paid: true, unit: 'DAY', accrualMethod: 'ANNUAL', accrualPerPeriod: 12, maxCarryOver: 5, opening: 12 },
  { id: 'people-seed-policy-sick', code: 'SICK', name: 'Nghỉ ốm', paid: true, unit: 'DAY', accrualMethod: 'ANNUAL', accrualPerPeriod: 5, maxCarryOver: 0, opening: 5 },
  { id: 'people-seed-policy-unpaid', code: 'UNPAID', name: 'Nghỉ không lương', paid: false, unit: 'DAY', accrualMethod: 'NONE', accrualPerPeriod: 0, maxCarryOver: 0, opening: 0, allowNegative: true },
  { id: 'people-seed-policy-comp', code: 'COMP', name: 'Nghỉ bù', paid: true, unit: 'DAY', accrualMethod: 'NONE', accrualPerPeriod: 0, maxCarryOver: 0, opening: 0 },
  { id: 'people-seed-policy-remote', code: 'REMOTE', name: 'Làm việc từ xa', paid: true, unit: 'DAY', accrualMethod: 'MONTHLY', accrualPerPeriod: 2, maxCarryOver: 0, opening: 2 },
];

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");

  // 1) PeopleTenantConfig — SME Lite singleton (PE-001).
  await c.query(
    `INSERT INTO "PeopleTenantConfig" (id,"tenantId","attendanceMode","leaveMode","payrollMode","timesheetEnabled","performanceBridgeEnabled","iocCapacityEnabled","defaultStandardHoursPerDay","workingWeekdays","createdBy","createdAt","updatedAt")
     VALUES ('people-seed-config-xtech',$1,'FILE_IMPORT','XOFFICE','FILE_IMPORT',true,false,false,8,ARRAY[1,2,3,4,5]::int[],$2,now(),now())
     ON CONFLICT ("tenantId") DO NOTHING`,
    [TENANT, OWNER],
  );

  // 2) Leave policies.
  for (const p of POLICIES) {
    await c.query(
      `INSERT INTO "LeavePolicyRef" (id,"tenantId",code,name,paid,unit,"accrualMethod","accrualPerPeriod","maxCarryOver","allowNegative","requiresAttachment","minNoticeDays","status","createdBy","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,1,'ACTIVE',$11,now(),now())
       ON CONFLICT ("tenantId",code) DO UPDATE SET name=EXCLUDED.name, "updatedAt"=now()`,
      [p.id, TENANT, p.code, p.name, p.paid, p.unit, p.accrualMethod, p.accrualPerPeriod, p.maxCarryOver, !!p.allowNegative, OWNER],
    );
  }

  // 3) INITIAL balance snapshot (sequence=1) per person × policy for the current period.
  let balanceRows = 0;
  for (const personId of PEOPLE) {
    for (const p of POLICIES) {
      const id = `people-seed-bal-${personId}-${p.code.toLowerCase()}-${PERIOD_CODE}`;
      const res = await c.query(
        `INSERT INTO "LeaveBalanceSnapshot" (id,"tenantId","personId","leavePolicyId","periodCode","openingBalance","accrued","used","pending","adjusted","carriedOver","available",unit,sequence,reason,"createdBy","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,0,0,0,0,0,$6,$7,1,'INITIAL',$8,now())
         ON CONFLICT ("tenantId","personId","leavePolicyId","periodCode",sequence) DO NOTHING`,
        [id, TENANT, personId, p.id, PERIOD_CODE, p.opening, p.unit, OWNER],
      );
      balanceRows += res.rowCount;
    }
  }

  await c.query('COMMIT');
  console.log(`seed:people-leave OK | tenant=${TENANT} config=SME_LITE policies=${POLICIES.length} balances(new)=${balanceRows} people=${PEOPLE.length} periodCode=${PERIOD_CODE}`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('seed:people-leave FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
