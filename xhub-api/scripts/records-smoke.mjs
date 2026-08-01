// Records / Documents smoke (Mục 8a). Re-runnable (run records-reset first).
// Server must be up on :4000. Run: npm run test:records
//
// Asserts: create document + first version; append-only versioning (old versions
// immutable, versionNo increments); content-by-hash dedup; version history;
// version content retrieval; secret-metadata guard (MUST_NOT_LEAK); tenant
// isolation via RLS.
import 'dotenv/config';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const H = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-nam' };

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.error('  ✗ ' + msg); failed++; } };
const j = async (path, opts = {}, headers = H) => {
  const r = await fetch(BASE + path, { headers, ...opts });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};

console.log('Records smoke @ ' + BASE);

// 1. Create document + first version.
const created = await j('/api/records', {
  method: 'POST',
  body: JSON.stringify({ kind: 'CONTRACT', title: 'NDA Acme', tags: ['legal'], subjectType: 'WorkflowInstance', subjectId: 'PR-1001', content: 'hello', mimeType: 'text/plain' }),
});
ok(created.status === 201 || created.status === 200, 'POST /api/records 200/201');
const doc = created.body?.document;
const v1 = created.body?.version;
ok(!!doc?.id, `document created (${doc?.id})`);
ok(v1?.versionNo === 1, `first version is v1 (got ${v1?.versionNo})`);
ok(doc?.currentVersionId === v1?.id, 'currentVersionId points at v1');
ok(typeof v1?.contentHash === 'string' && v1.contentHash.length === 64, `v1 sha256 hash (${v1?.contentHash?.slice(0, 10)}…)`);
const v1Hash = v1?.contentHash;
const v1Key = v1?.storageKey;

// 2. Append v2 (different content) — v1 stays immutable.
const add2 = await j(`/api/records/${doc.id}/versions`, { method: 'POST', body: JSON.stringify({ content: 'hello v2', mimeType: 'text/plain' }) });
ok(add2.body?.version?.versionNo === 2, `append v2 (got ${add2.body?.version?.versionNo})`);
ok(add2.body?.version?.contentHash !== v1Hash, 'v2 has a different content hash');
ok(add2.body?.version?.deduped === false, 'v2 not deduped (new content)');

// 3. Append v3 with SAME content as v1 → deduped to v1 storageKey.
const add3 = await j(`/api/records/${doc.id}/versions`, { method: 'POST', body: JSON.stringify({ content: 'hello', mimeType: 'text/plain' }) });
ok(add3.body?.version?.versionNo === 3, `append v3 (got ${add3.body?.version?.versionNo})`);
ok(add3.body?.version?.contentHash === v1Hash, 'v3 content hash equals v1 (identical content)');
ok(add3.body?.version?.deduped === true, 'v3 deduped by contentHash');
ok(add3.body?.version?.storageKey === v1Key, 'v3 reuses v1 storageKey (dedup)');

// 4. Version history + immutability of v1.
const got = await j(`/api/records/${doc.id}`);
const versions = got.body?.versions ?? [];
ok(versions.length === 3, `history has 3 versions (got ${versions.length})`);
ok(versions.map((v) => v.versionNo).join(',') === '1,2,3', 'versionNos are 1,2,3 (append-only)');
const v1Now = versions.find((v) => v.versionNo === 1);
ok(v1Now?.contentHash === v1Hash && v1Now?.id === v1.id, 'v1 unchanged after appends (immutable)');
ok(got.body?.document?.currentVersionId === add3.body?.version?.id, 'currentVersionId advanced to v3');

// 5. Retrieve a version's content.
const content = await j(`/api/records/${doc.id}/versions/1/content`);
ok(Buffer.from(content.body?.contentBase64 ?? '', 'base64').toString('utf8') === 'hello', 'v1 content round-trips to "hello"');

// 6. Secret-metadata guard (MUST_NOT_LEAK) — a secret-like tag is rejected.
const secret = await j('/api/records', { method: 'POST', body: JSON.stringify({ title: 'x', tags: ['password'], content: 'y' }) });
ok(secret.status === 400, `secret-like tag rejected with 400 (got ${secret.status})`);

// 7. List.
const listed = await j('/api/records');
ok((listed.body ?? []).some((d) => d.id === doc.id), 'GET /api/records lists the document');

// 8. Tenant isolation — demo-isolation sees 0 xtech documents.
const demo = await j('/api/records', {}, { ...H, 'x-tenant-id': 'tenant-demo-isolation' });
ok(!(demo.body ?? []).some((d) => d.tenantId === 'tenant-xtech'), 'demo-isolation sees no xtech documents');

console.log(failed === 0 ? '\nRECORDS SMOKE PASSED' : `\nRECORDS SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
