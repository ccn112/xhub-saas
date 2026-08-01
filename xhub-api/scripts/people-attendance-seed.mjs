// People Essentials — PE-02 (Attendance & Correction) seed
// (seed:people-attendance). Seeds 1 WorkCalendar DEFAULT + 1 ShiftPattern
// STANDARD (08:30-17:30) + ShiftAssignment for the 5 people already seeded by
// seed:people-leave. Idempotent (upsert-by-id). Talks straight to Postgres
// under RLS bypass (server NOT required). Run: npm run seed:people-attendance
import 'dotenv/config';
import pg from 'pg';

const TENANT = 'tenant-xtech';
const OWNER = 'usr-cfo';
const CALENDAR_ID = 'people-seed-calendar-default';
const PATTERN_ID = 'people-seed-shift-standard';
const PEOPLE = ['usr-cfo', 'usr-accountant', 'usr-sales-01', 'usr-tech-head', 'usr-hr-01'];

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");

  await c.query(
    `INSERT INTO "WorkCalendar" (id,"tenantId",code,name,"workingWeekdays",holidays,"createdBy","createdAt","updatedAt")
     VALUES ($1,$2,'DEFAULT','Lịch làm việc chuẩn',ARRAY[1,2,3,4,5]::int[],'[]'::jsonb,$3,now(),now())
     ON CONFLICT ("tenantId",code) DO UPDATE SET name=EXCLUDED.name, "updatedAt"=now()`,
    [CALENDAR_ID, TENANT, OWNER],
  );

  await c.query(
    `INSERT INTO "ShiftPattern" (id,"tenantId",code,name,"startTime","endTime","breakMinutes","graceMinutes","standardHours",status,"createdBy","createdAt","updatedAt")
     VALUES ($1,$2,'STANDARD','Giờ hành chính chuẩn','08:30','17:30',60,15,8,'ACTIVE',$3,now(),now())
     ON CONFLICT ("tenantId",code) DO UPDATE SET name=EXCLUDED.name, "updatedAt"=now()`,
    [PATTERN_ID, TENANT, OWNER],
  );

  let assignments = 0;
  for (const personId of PEOPLE) {
    const id = `people-seed-shiftassign-${personId}`;
    const res = await c.query(
      `INSERT INTO "ShiftAssignment" (id,"tenantId","personId","shiftPatternId","workCalendarId","effectiveFrom","createdBy","createdAt")
       VALUES ($1,$2,$3,$4,$5, now() - interval '1 year',$6,now())
       ON CONFLICT (id) DO NOTHING`,
      [id, TENANT, personId, PATTERN_ID, CALENDAR_ID, OWNER],
    );
    assignments += res.rowCount;
  }

  await c.query('COMMIT');
  console.log(`seed:people-attendance OK | tenant=${TENANT} calendar=DEFAULT pattern=STANDARD assignments(new)=${assignments} people=${PEOPLE.length}`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('seed:people-attendance FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
