// MDM ingestion smoke: import job from the X2BMS sample → pipeline stages →
// master created ONLY after commit → "X Riverside" duplicate pair pending →
// resolve merge → single merged master → tenant overlay → demo isolation.
// Re-runnable (run scripts/mdm-reset.mjs first). Server must be up on :4000.
// Run: node scripts/mdm-smoke.mjs   (or: npm run test:mdm)
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

console.log('MDM smoke @ ' + BASE);

// 1. Import job from the X2BMS sample (no records posted → loads seed sample).
const imp = await j('/api/mdm/import-jobs', { method: 'POST', body: JSON.stringify({ sourceSystem: 'X2BMS' }) });
ok(imp.status === 201 || imp.status === 200, 'POST import-jobs 200/201');
const jobId = imp.body?.id;
ok(!!jobId, `import job created (${jobId})`);
ok(imp.body?.counts?.staged === 2, `staged 2 source records (got ${imp.body?.counts?.staged})`);
ok(imp.body?.counts?.duplicatesPending === 1, `1 duplicate pending (got ${imp.body?.counts?.duplicatesPending})`);
ok(imp.body?.stage === 'matched', `job stage=matched with pending dup (got ${imp.body?.stage})`);

// 2. GET import job → stage + counts.
const jg = await j(`/api/mdm/import-jobs/${jobId}`);
ok(jg.body?.id === jobId && jg.body?.counts?.staged === 2, 'GET import-jobs/:id returns stage + counts');

// 3. NO active master yet (never straight into master — only DRAFT proposals).
const before = await j('/api/mdm/master-records?domain=PROJECT&q=Riverside');
ok((before.body ?? []).length === 0, `no ACTIVE project master before commit (got ${(before.body ?? []).length})`);

// 4. Duplicate pair "X Riverside" pending, with a score.
const dups = await j('/api/mdm/duplicate-pairs?decision=pending');
ok((dups.body ?? []).length === 1, `1 pending duplicate pair (got ${(dups.body ?? []).length})`);
const pair = (dups.body ?? [])[0];
ok(pair?.score >= 0.7, `duplicate pair carries a score (${pair?.score})`);
ok(!!pair?.candidateMasterId, `duplicate pair points at a candidate master (${pair?.candidateMasterId})`);

// 5. Resolve merge → folds into the candidate master.
const res = await j(`/api/mdm/duplicate-pairs/${pair.id}/resolve`, { method: 'POST', body: JSON.stringify({ decision: 'merge' }) });
ok(res.body?.pair?.decision === 'merge', `pair resolved as merge (got ${res.body?.pair?.decision})`);
const mergedId = res.body?.master?.id;
ok(!!mergedId, `merge returned surviving master (${mergedId})`);
ok((res.body?.master?.aliases ?? []).length >= 2, `merged master accumulated aliases (${JSON.stringify(res.body?.master?.aliases)})`);

// 6. Commit the reviewed job → master ACTIVATED (only now visible as master).
const commit = await j(`/api/mdm/import-jobs/${jobId}/commit`, { method: 'POST' });
ok(commit.body?.stage === 'committed', `job committed (got ${commit.body?.stage})`);
ok(commit.body?.counts?.committed === 1, `1 master committed (got ${commit.body?.counts?.committed})`);

// 7. Exactly one ACTIVE "X Riverside" master, with 2-record lineage + aliases.
const after = await j('/api/mdm/master-records?domain=PROJECT&q=Riverside');
ok((after.body ?? []).length === 1, `exactly 1 ACTIVE merged master after commit (got ${(after.body ?? []).length})`);
const master = (after.body ?? [])[0];
const detail = await j(`/api/mdm/master-records/${master.id}`);
ok((detail.body?.lineage ?? []).length === 2, `master lineage has both source records (got ${(detail.body?.lineage ?? []).length})`);
ok(detail.body?.status === 'ACTIVE', `master is ACTIVE (got ${detail.body?.status})`);

// 8. Tenant overlay (never touches canonical master).
const put = await j('/api/mdm/tenant-overlays', { method: 'PUT', body: JSON.stringify({ masterRecordId: master.id, overlayFields: { internalName: 'Riverside (nội bộ)' }, privateTags: ['vip'] }) });
ok(put.status === 200 && put.body?.version === 1, `overlay created v1 (got ${put.body?.version})`);
const put2 = await j('/api/mdm/tenant-overlays', { method: 'PUT', body: JSON.stringify({ masterRecordId: master.id, privateTags: ['vip', 'hot'] }) });
ok(put2.body?.version === 2, `overlay edit bumps version to 2 (got ${put2.body?.version})`);
const det2 = await j(`/api/mdm/master-records/${master.id}`);
ok(det2.body?.overlay?.overlayFields?.internalName === 'Riverside (nội bộ)', 'overlay carried on master detail, canonical untouched');

// 9. Shared geography master is visible (shared, not per-tenant duplicated).
const geo = await j('/api/mdm/master-records?domain=GEOGRAPHY');
ok((geo.body ?? []).some((m) => m.tenantId === null), 'shared GEOGRAPHY master visible (tenantId null)');

// 10. Tenant isolation — demo-isolation must NOT see xtech MDM lineage/dups.
const DH = { ...H, 'x-tenant-id': 'tenant-demo-isolation' };
const demoDups = await j('/api/mdm/duplicate-pairs', {}, DH);
const dupLeak = (demoDups.body ?? []).filter((d) => d.tenantId === 'tenant-xtech');
ok(dupLeak.length === 0, `demo-isolation sees 0 xtech duplicate pairs (got ${dupLeak.length})`);
const demoDetail = await j(`/api/mdm/master-records/${master.id}`, {}, DH);
const leakLineage = (demoDetail.body?.lineage ?? []).filter((s) => s.tenantId === 'tenant-xtech');
ok(leakLineage.length === 0, `demo-isolation sees 0 xtech lineage rows on shared master (got ${leakLineage.length})`);
const leakMarker = JSON.stringify(demoDetail.body ?? {}).includes('MUST_NOT_LEAK');
ok(!leakMarker, 'no MUST_NOT_LEAK marker leaks across tenants');

console.log(failed === 0 ? '\nMDM SMOKE PASSED' : `\nMDM SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
