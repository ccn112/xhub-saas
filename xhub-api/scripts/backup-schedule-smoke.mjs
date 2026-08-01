// Per-tenant periodic backup SCHEDULE + retention smoke (test:backup-schedule).
// PH-04 backup ops / SaaS non-negotiable #11. Server up on :4000; run
// `npm run seed:tenant-registry`, `npm run seed:platform-roles`,
// `npm run seed:backup-schedules` first. Self-cleaning: deletes every extra
// backup (rows + folders) it creates, keeping seeds/T002 sane.
//
// Asserts:
//  - both T001 (tenant-xtech) + T002 (tenant-realestate-demo) have a schedule;
//  - POST /backups/tick?force=true → a NEW backup for EACH ACTIVE tenant in its
//    OWN folder (storage/backups/<tenantId>/…) — the two folders get DISTINCT
//    new backups (per-tenant folder separation / MUST_NOT_LEAK boundary);
//  - retention prunes an OLD backup WITHIN one tenant, never touches the other
//    tenant's folder, and never deletes the most-recent backup;
//  - failure isolation: a forced failure on T002 → T002 lastStatus=FAILED+alert
//    (+ backup.schedule.failed AuditLog) while T001 still SUCCEEDS;
//  - enforcement: a non-platform user → 403 on /api/platform/backup-schedules.
import 'dotenv/config';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const T1 = 'tenant-xtech';
const T2 = 'tenant-realestate-demo';
const STORAGE = process.env.BACKUP_STORAGE_DIR || join(process.cwd(), 'storage', 'backups');

const OP = { 'content-type': 'application/json', 'x-tenant-id': T1, 'x-user-id': 'usr-plt-ops', 'x-authz-enforce': 'true' };
const TENANT_ONLY = { ...OP, 'x-user-id': 'user-huyvu' };

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.error('  ✗ ' + msg); failed++; } };
const call = async (path, headers = OP, opts = {}) => {
  const r = await fetch(BASE + path, { headers, ...opts });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const bypass = async (sql, args = []) => {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  const r = await c.query(sql, args);
  await c.query('COMMIT');
  return r;
};
const backupIds = async (tid) =>
  (await bypass(`SELECT id FROM "BackupJob" WHERE "tenantId"=$1 ORDER BY "createdAt"`, [tid])).rows.map((r) => r.id);
const folderExists = (tid, id) => existsSync(join(STORAGE, tid, id));

console.log('Backup schedule smoke @ ' + BASE);

// snapshot pre-existing backups so cleanup only removes what WE add
const before1 = new Set(await backupIds(T1));
const before2 = new Set(await backupIds(T2));
const oldRowIds = [];

try {
  // 1. Both registry tenants have a schedule.
  const list = await call('/api/platform/backup-schedules');
  ok(list.status === 200 && Array.isArray(list.body), `GET /backup-schedules 200 (got ${list.status})`);
  const s1 = (list.body ?? []).find((s) => s.tenantId === T1);
  const s2 = (list.body ?? []).find((s) => s.tenantId === T2);
  ok(!!s1 && !!s2, `both T001 (${!!s1}) and T002 (${!!s2}) have a schedule`);
  ok(s1?.frequency === 'DAILY' && s1?.retentionDays === 35, `T001 default DAILY / retention 35d (got ${s1?.frequency}/${s1?.retentionDays})`);

  // 2. Enforcement: non-platform user 403.
  const denied = await call('/api/platform/backup-schedules', TENANT_ONLY);
  ok(denied.status === 403, `non-platform user DENIED 403 (got ${denied.status})`);

  // 3. force tick → a new backup for EACH tenant in its OWN folder.
  const tick = await call('/api/platform/backups/tick?force=true', OP, { method: 'POST' });
  ok(tick.status === 200 || tick.status === 201, `POST /backups/tick?force=true (got ${tick.status})`);
  ok(tick.body?.ran?.includes(T1) && tick.body?.ran?.includes(T2), `tick ran BOTH tenants (ran=${JSON.stringify(tick.body?.ran)})`);

  const after1 = await backupIds(T1);
  const after2 = await backupIds(T2);
  const new1 = after1.filter((id) => !before1.has(id));
  const new2 = after2.filter((id) => !before2.has(id));
  ok(new1.length >= 1 && new2.length >= 1, `each tenant got a NEW backup (T001=${new1.length}, T002=${new2.length})`);
  ok(new1.every((id) => !after2.includes(id)) && new2.every((id) => !after1.includes(id)), 'the two tenants got DISTINCT backups (no shared id)');
  ok(new1.every((id) => folderExists(T1, id)), `T001 backups live under storage/backups/${T1}/…`);
  ok(new2.every((id) => folderExists(T2, id)), `T002 backups live under storage/backups/${T2}/…`);
  ok(new1.every((id) => !folderExists(T2, id)), 'T001 backups do NOT appear in the T002 folder (per-tenant separation)');

  // 4. Retention: insert an OLD (60d) completed backup for T001 + its folder,
  //    then run-now (retentionDays=35) → old one pruned, recent ones + folder
  //    kept, and T002 folder UNTOUCHED, most-recent never deleted.
  const oldId = 'bkp-smoke-old-' + randomUUID().slice(0, 8);
  oldRowIds.push(oldId);
  const oldDir = join(STORAGE, T1, oldId);
  mkdirSync(oldDir, { recursive: true });
  writeFileSync(join(oldDir, 'manifest.json'), '{"backupId":"' + oldId + '"}');
  await bypass(
    `INSERT INTO "BackupJob" (id,"tenantId",status,kind,manifest,checksum,location,"createdAt","finishedAt")
     VALUES ($1,$2,'completed','LOGICAL_TENANT','{}','x',$3, now() - interval '60 days', now() - interval '60 days')`,
    [oldId, T1, join('storage', 'backups', T1, oldId)],
  );
  ok(folderExists(T1, oldId), 'seeded a 60-day-old T001 backup (older than 35d retention)');

  const t2Before = new Set(await backupIds(T2));
  const runNow = await call(`/api/platform/backup-schedules/${T1}/run-now`, OP, { method: 'POST' });
  ok(runNow.status === 200 || runNow.status === 201, `run-now T001 (got ${runNow.status})`);
  ok(runNow.body?.pruned >= 1, `retention pruned the old backup (pruned=${runNow.body?.pruned})`);

  const afterPrune1 = await backupIds(T1);
  ok(!afterPrune1.includes(oldId), 'old (>35d) T001 backup ROW pruned');
  ok(!folderExists(T1, oldId), 'old T001 backup FOLDER pruned');
  ok(afterPrune1.length >= 1, 'most-recent T001 backup NEVER deleted (>=1 remains)');
  const t2After = await backupIds(T2);
  ok(t2After.length === t2Before.size, `retention on T001 did NOT touch T002 folder/rows (T2 count ${t2Before.size} -> ${t2After.length})`);

  // 5. Failure isolation: fail T002 only → T002 FAILED+alert, T001 still succeeds.
  await bypass(`DELETE FROM "AuditLog" WHERE "tenantId"=$1 AND action='backup.schedule.failed'`, [T2]);
  const failTick = await call(`/api/platform/backups/tick?force=true&failTenant=${T2}`, OP, { method: 'POST' });
  ok(failTick.body?.ran?.includes(T1), `T001 STILL succeeded despite T002 failure (ran=${JSON.stringify(failTick.body?.ran)})`);
  ok(failTick.body?.failed?.includes(T2) && !failTick.body?.failed?.includes(T1), `only T002 FAILED (failed=${JSON.stringify(failTick.body?.failed)})`);
  const g2 = await call(`/api/platform/backup-schedules/${T2}`);
  ok(g2.body?.lastStatus === 'FAILED' && g2.body?.alert === true, `T002 schedule lastStatus=FAILED + alert=true (got ${g2.body?.lastStatus}/${g2.body?.alert})`);
  const g1 = await call(`/api/platform/backup-schedules/${T1}`);
  ok(g1.body?.lastStatus === 'completed' && g1.body?.alert === false, `T001 schedule lastStatus=completed + alert=false (got ${g1.body?.lastStatus}/${g1.body?.alert})`);
  const alertRows = (await bypass(`SELECT count(*)::int n FROM "AuditLog" WHERE "tenantId"=$1 AND action='backup.schedule.failed'`, [T2])).rows[0].n;
  ok(alertRows >= 1, `backup.schedule.failed AuditLog alert written for T002 (${alertRows})`);

  // 6. Per-tenant history endpoint.
  const hist = await call(`/api/platform/backup-schedules/${T1}/backups`);
  ok(hist.status === 200 && Array.isArray(hist.body) && hist.body.every((b) => b.tenantId === T1), 'per-tenant history returns only that tenant backups');

  // restore T002 schedule to a clean state (recompute next run, clear alert)
  await call(`/api/platform/backup-schedules/${T2}`, OP, { method: 'PUT', body: JSON.stringify({ enabled: true }) });
} finally {
  // Self-cleaning: remove every backup (rows + folders) this smoke created.
  const rmFolder = (await import('node:fs')).rmSync;
  const cleanup = async (tid, before) => {
    const now = await backupIds(tid);
    for (const id of now) {
      if (before.has(id)) continue;
      try { rmFolder(join(STORAGE, tid, id), { recursive: true, force: true }); } catch {}
      await bypass(`DELETE FROM "BackupJob" WHERE id=$1`, [id]).catch(() => {});
    }
  };
  await cleanup(T1, before1);
  await cleanup(T2, before2);
  for (const id of oldRowIds) {
    try { rmFolder(join(STORAGE, T1, id), { recursive: true, force: true }); } catch {}
    await bypass(`DELETE FROM "BackupJob" WHERE id=$1`, [id]).catch(() => {});
  }
  await bypass(`DELETE FROM "AuditLog" WHERE action='backup.schedule.failed'`).catch(() => {});
  // clear the alert flags we set so the seeded schedules stay green
  await bypass(`UPDATE "BackupSchedule" SET alert=false, "lastStatus"=NULL, "lastError"=NULL, "lastRunAt"=NULL WHERE "tenantId" IN ($1,$2)`, [T1, T2]).catch(() => {});
  await c.end();
  console.log('  · cleaned up smoke backups + reset schedule status');
}

console.log(failed === 0 ? '\nBACKUP SCHEDULE SMOKE PASSED' : `\nBACKUP SCHEDULE SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
