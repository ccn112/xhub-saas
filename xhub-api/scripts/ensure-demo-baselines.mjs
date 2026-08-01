// Backfill golden DEMO_BASELINE snapshots for the existing demo tenants
// T002–T010 (ensure:demo-baselines). Idempotent: the endpoint skips a tenant
// that already has a completed DEMO_BASELINE. Server must be up on :4000.
// Run: npm run ensure:demo-baselines
import 'dotenv/config';
import { DEMO_TENANTS } from './demo-tenants.params.mjs';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const PLATFORM = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-nam' };

let failed = 0;
for (const t of DEMO_TENANTS) {
  const r = await fetch(`${BASE}/api/platform/tenants/${t.id}/demo-baseline`, { method: 'POST', headers: PLATFORM });
  const body = await r.json().catch(() => ({}));
  if (r.status >= 400) {
    console.error(`  ✗ ${t.id} demo-baseline failed ${r.status}: ${JSON.stringify(body)}`);
    failed++;
  } else {
    console.log(`  ✓ ${t.id} DEMO_BASELINE ${body?.created ? 'captured' : 'present'} (${body?.job?.id ?? '?'})`);
  }
}
console.log(failed === 0 ? '\nensure:demo-baselines OK' : `\nensure:demo-baselines FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
