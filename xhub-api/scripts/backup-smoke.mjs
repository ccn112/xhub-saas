// Per-tenant logical Backup / Restore smoke (Mục 6). Re-runnable (run
// scripts/backup-reset.mjs first). Server must be up on :4000.
// Run: node scripts/backup-smoke.mjs   (or: npm run test:backup)
//
// Asserts:
//  - backup completes; manifest has per-table row counts + checksum + outbox watermark;
//  - MUST_NOT_LEAK: no serialized field matches the secret regex; shared/global tables excluded;
//  - checksum verify passes on the produced bundle; a tampered checksum is rejected;
//  - dry-run restore reports counts and writes nothing;
//  - sandbox restore into a sandbox tenant succeeds + remaps identity ids
//    (restored PersonProfile ids differ from source; references stay consistent);
//  - tenant isolation: tenant-demo-isolation cannot see tenant-xtech backup jobs.
import 'dotenv/config';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const H = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-nam' };

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✓ ' + msg);
  else { console.error('  ✗ ' + msg); failed++; }
};
const j = async (path, opts = {}, headers = H) => {
  const r = await fetch(BASE + path, { headers, ...opts });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};

const SECRET_RE = /password|secret|token|apikey|api[_-]?key|credential|privatekey|private[_-]?key/i;
const SHARED_TABLES = ['ApplicationDefinition', 'MasterRecord', 'WorkflowVersion', 'Tenant'];

console.log('Backup smoke @ ' + BASE);

// 1. Create a backup for the current tenant.
const created = await j('/api/backup', { method: 'POST' });
ok(created.status === 201 || created.status === 200, 'POST /api/backup 200/201');
const job = created.body?.job;
const manifest = created.body?.manifest;
ok(!!job?.id, `backup job created (${job?.id})`);
ok(job?.status === 'completed', `backup completed (got ${job?.status})`);
ok(!!manifest?.tables && Object.keys(manifest.tables).length >= 20, `manifest has per-table row counts (${Object.keys(manifest?.tables ?? {}).length} tables)`);
ok(typeof manifest?.checksum === 'string' && manifest.checksum.length === 64, `manifest has sha256 checksum (${manifest?.checksum?.slice(0, 12)}…)`);
ok(manifest?.outboxWatermark && 'provisioningCommandCount' in manifest.outboxWatermark, `manifest has outbox watermark (count=${manifest?.outboxWatermark?.provisioningCommandCount})`);
ok(manifest?.tables?.PersonProfile >= 1, `PersonProfile rows backed up (${manifest?.tables?.PersonProfile})`);
ok(manifest?.encryption?.algorithm === 'aes-256-gcm' && !('key' in (manifest?.encryption ?? {})), 'manifest records AES-256-GCM + key REFERENCE (no key)');
ok(typeof job?.byteSize === 'number' && job.byteSize > 0, `encrypted bundle has a byte size (${job?.byteSize})`);

// 2. MUST_NOT_LEAK — no secret-like field name anywhere in the manifest.
const manifestStr = JSON.stringify(manifest);
const secretKeyHit = (function scan(v) {
  if (Array.isArray(v)) return v.some(scan);
  if (v && typeof v === 'object') return Object.entries(v).some(([k, val]) => SECRET_RE.test(k) && k !== 'keyReference' && k !== 'secretGuard' ? true : scan(val));
  return false;
})(manifest);
ok(manifest?.secretGuard?.status === 'passed', `secret-field guard passed (${manifest?.secretGuard?.fieldsScanned} fields scanned)`);
ok(!secretKeyHit, 'no secret-like data field name in manifest');
ok(!manifestStr.includes('MUST_NOT_LEAK'), 'no MUST_NOT_LEAK marker in manifest');

// 3. Shared/global tables excluded (never per-tenant).
const excludedTables = (manifest?.excludedData ?? []).map((e) => e.table);
ok(SHARED_TABLES.every((t) => excludedTables.includes(t)), `shared tables excluded (${SHARED_TABLES.join(',')})`);
ok(!Object.keys(manifest?.tables ?? {}).some((t) => SHARED_TABLES.includes(t)), 'no shared table appears in backed-up tables');

// 4. Checksum verify passes on the produced bundle.
const verify = await j(`/api/backup/${job.id}/verify`);
ok(verify.body?.checksumValid === true, `bundle checksum verifies (expected=${verify.body?.expected?.slice(0, 8)} actual=${verify.body?.actual?.slice(0, 8)})`);

// 5. GET job + manifest, and list.
const got = await j(`/api/backup/${job.id}`);
ok(got.body?.id === job.id && !!got.body?.manifest?.checksum, 'GET /api/backup/:id returns job + manifest');
const listed = await j('/api/backup');
ok((listed.body ?? []).some((b) => b.id === job.id), 'GET /api/backup lists the job');

// 6. Dry-run restore: reports counts, writes nothing.
const dry = await j(`/api/backup/${job.id}/restore`, { method: 'POST', body: JSON.stringify({ mode: 'dry-run' }) });
ok(dry.body?.report?.wouldWrite === false, 'dry-run writes nothing (wouldWrite=false)');
ok(dry.body?.report?.checksumValid === true, 'dry-run checksum valid');
ok(dry.body?.report?.totalRows === manifest?.totalRows, `dry-run reports the backup row count (${dry.body?.report?.totalRows})`);

// 7. Tampered checksum is rejected.
const tampered = await j(`/api/backup/${job.id}/restore`, { method: 'POST', body: JSON.stringify({ mode: 'dry-run', tamper: 'checksum' }) });
ok(tampered.status === 400, `tampered checksum rejected with 400 (got ${tampered.status})`);

// 8. Sandbox restore: succeeds + remaps identity ids consistently.
const sb = await j(`/api/backup/${job.id}/restore`, { method: 'POST', body: JSON.stringify({ mode: 'sandbox' }) });
ok(sb.body?.restoreJob?.status === 'completed', `sandbox restore completed (got ${sb.body?.restoreJob?.status})`);
const report = sb.body?.report ?? {};
ok(report?.targetTenantId === 'tenant-xtech:restore-sandbox', `restored into sandbox tenant (${report?.targetTenantId})`);
ok(report?.tables?.PersonProfile === manifest?.tables?.PersonProfile, `all PersonProfile rows restored (${report?.tables?.PersonProfile})`);
const remap = report?.identityRemap?.PersonProfile ?? [];
ok(remap.length >= 1, `identity remap produced (${remap.length} persons)`);
ok(remap.every((r) => r.oldId !== r.newId), 'every restored PersonProfile id DIFFERS from source');
ok(report?.consistent === true && report?.danglingHolders === 0, `identity references stay consistent (dangling=${report?.danglingHolders})`);
ok(typeof report?.inFlightHeld === 'number', `outbox in-flight commands held, not re-executed (${report?.inFlightHeld})`);

// 8b. Sandbox tenant's own backup jobs isolated from source (RLS on new tables).
const sandboxList = await j('/api/backup', {}, { ...H, 'x-tenant-id': 'tenant-xtech:restore-sandbox' });
ok(!(sandboxList.body ?? []).some((b) => b.tenantId === 'tenant-xtech'), 'sandbox tenant sees no source backup jobs');

// 9. Restore job listed under the source tenant.
const restores = await j('/api/backup/restores');
ok((restores.body ?? []).some((r) => r.sourceBackupId === job.id && r.mode === 'sandbox'), 'GET /api/backup/restores lists the sandbox restore');

// 10. Tenant isolation — demo-isolation cannot see xtech backup jobs.
const DH = { ...H, 'x-tenant-id': 'tenant-demo-isolation' };
const demo = await j('/api/backup', {}, DH);
const leak = (demo.body ?? []).filter((b) => b.tenantId === 'tenant-xtech');
ok(leak.length === 0, `demo-isolation sees 0 xtech backup jobs (got ${leak.length})`);

console.log(failed === 0 ? '\nBACKUP SMOKE PASSED' : `\nBACKUP SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
