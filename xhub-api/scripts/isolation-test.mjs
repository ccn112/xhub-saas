// Tenant isolation test (Definition of Done gate).
// 1) Canonical tenant read never returns MUST_NOT_LEAK rows even when a hostile
//    tenant's data is present in the same collections.
// 2) The MUST_NOT_LEAK guard throws if a poisoned row is mis-tagged as canonical.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const all = JSON.parse(readFileSync(join(root, "seed-data/all.seed.json"), "utf8"));
const iso = JSON.parse(readFileSync(join(root, "seed-data/demo-isolation.seed.json"), "utf8"));

const CANONICAL = all.meta.canonicalTenantId; // tenant-xtech

// Mirror of assertTenantScope in src/xhub/lib/seed.ts
function assertTenantScope(rows, tenantId) {
  const scoped = rows.filter((r) => r.tenantId === undefined || r.tenantId === tenantId);
  if (scoped.some((r) => JSON.stringify(r).includes("MUST_NOT_LEAK"))) {
    throw new Error("Tenant isolation violation: MUST_NOT_LEAK marker detected.");
  }
  return scoped;
}

let failed = 0;
const fail = (m) => { console.error("  ✗ " + m); failed++; };
const pass = (m) => console.log("  ✓ " + m);

// Test 1: hostile rows mixed in, canonical read must be clean.
console.log("Test 1 — canonical read excludes foreign-tenant MUST_NOT_LEAK rows");
for (const key of Object.keys(iso)) {
  if (key === "meta" || !Array.isArray(iso[key])) continue;
  const mixed = [...(Array.isArray(all[key]) ? all[key] : []), ...iso[key]];
  let scoped;
  try {
    scoped = assertTenantScope(mixed, CANONICAL);
  } catch (e) {
    fail(`${key}: guard threw on canonical read (${e.message})`);
    continue;
  }
  const leaked = scoped.filter((r) => JSON.stringify(r).includes("MUST_NOT_LEAK"));
  const foreign = scoped.filter((r) => r.tenantId && r.tenantId !== CANONICAL);
  if (leaked.length) fail(`${key}: ${leaked.length} MUST_NOT_LEAK row(s) leaked`);
  else if (foreign.length) fail(`${key}: ${foreign.length} foreign-tenant row(s) leaked`);
  else pass(`${key}: clean (${scoped.length} rows)`);
}

// Test 2: poisoned row tagged as canonical must trip the guard.
console.log("Test 2 — guard trips on a poisoned canonical-tagged row");
try {
  assertTenantScope([{ id: "x", tenantId: CANONICAL, note: "MUST_NOT_LEAK" }], CANONICAL);
  fail("guard did NOT throw on poisoned canonical row");
} catch {
  pass("guard threw as expected");
}

// Test 3: canonical seed itself carries no MUST_NOT_LEAK markers.
console.log("Test 3 — canonical seed has no MUST_NOT_LEAK markers");
if (JSON.stringify(all).includes("MUST_NOT_LEAK")) fail("all.seed.json contains MUST_NOT_LEAK");
else pass("all.seed.json clean");

console.log(failed === 0 ? "\nISOLATION TEST PASSED" : `\nISOLATION TEST FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
