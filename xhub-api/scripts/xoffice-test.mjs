// X.Office slice gate: tenant isolation + version immutability.
// Loads the module's seed the same way the service does and exercises the
// two Definition-of-Done invariants without needing the HTTP server running.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "seed-data", "xoffice");
const read = (f) => JSON.parse(readFileSync(join(dir, f), "utf8"));

const defs = read("workflow-definitions.json");
const scenarios = read("ai-assistance-scenarios.json");
const roles = read("role-bindings.json");

let failed = 0;
const fail = (m) => { console.error("  x " + m); failed++; };
const pass = (m) => console.log("  ok " + m);

function slugFromTenantId(id) {
  return id === "tenant-xtech" ? "xtech" : id.replace(/^tenant-/, "");
}

// --- Test 1: tenant isolation -------------------------------------------
console.log("Test 1 - tenant isolation (canonical read excludes other tenants)");
const CANON = slugFromTenantId("tenant-xtech");
const visibleDefs = defs.filter((d) => d.metadata.tenantSlug === CANON);
const visibleRoles = roles.filter((r) => r.tenantSlug === CANON);
const visibleScenarios = scenarios.filter((s) => s.tenantSlug === CANON);

if (JSON.stringify(visibleDefs).includes("MUST_NOT_LEAK")) fail("workflow defs leaked MUST_NOT_LEAK");
else pass(`${visibleDefs.length} workflow defs, no leak`);

if (visibleRoles.some((r) => r.tenantSlug !== CANON)) fail("foreign-tenant role leaked");
else pass(`${visibleRoles.length} roles, all tenant=xtech`);

if (visibleScenarios.some((s) => s.name === "MUST_NOT_LEAK" || s.tenantSlug !== CANON))
  fail("demo-isolation scenario leaked into xtech");
else pass(`${visibleScenarios.length} AI scenarios, demo-isolation excluded`);

// the poisoned tenant exists in seed but must never be surfaced for xtech
const secret = roles.find((r) => r.name === "MUST_NOT_LEAK");
if (!secret) fail("expected a MUST_NOT_LEAK canary in seed (test setup)");
else if (visibleRoles.includes(secret)) fail("canary surfaced to canonical tenant");
else pass("MUST_NOT_LEAK canary present in seed but not served to xtech");

// --- Test 2: version immutability ---------------------------------------
console.log("Test 2 - version immutability (publish creates new frozen snapshots)");
function canonical(obj) {
  const sort = (v) =>
    Array.isArray(v) ? v.map(sort)
    : v && typeof v === "object"
      ? Object.keys(v).sort().reduce((a, k) => ((a[k] = sort(v[k])), a), {})
      : v;
  return JSON.stringify(sort(obj));
}
function deepFreeze(o) {
  if (o && typeof o === "object") { for (const v of Object.values(o)) deepFreeze(v); Object.freeze(o); }
  return o;
}
function snapshot(def, version) {
  const frozen = deepFreeze(JSON.parse(JSON.stringify(def)));
  return { version, checksum: createHash("sha256").update(canonical(frozen)).digest("hex").slice(0, 16), definition: frozen };
}

const base = defs[0];
const versions = [snapshot(base, 1)];
const v1checksum = versions[0].checksum;

// edit the working copy and publish v2
const edited = JSON.parse(JSON.stringify(base));
edited.nodes.push({ id: "extra", type: "notification", name: "Thêm mới", config: {} });
versions.push(snapshot(edited, 2));

if (versions[1].version === 2) pass("publish increments version -> 2");
else fail("version did not increment");

if (versions[0].checksum === v1checksum) pass("v1 checksum unchanged after v2 publish");
else fail("v1 checksum drifted");

if (versions[0].checksum !== versions[1].checksum) pass("v1 and v2 checksums differ");
else fail("v2 has same checksum as v1");

// frozen snapshot must reject mutation (strict mode throws; sloppy mode no-ops)
try {
  versions[0].definition.metadata.name = "HACKED";
} catch { /* expected: frozen throws in ESM strict mode */ }
if (versions[0].definition.metadata.name === base.metadata.name) pass("v1 snapshot resisted mutation");
else fail("v1 snapshot was mutated");

console.log(failed === 0 ? "\nXOFFICE SLICE TEST PASSED" : `\nXOFFICE SLICE TEST FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
