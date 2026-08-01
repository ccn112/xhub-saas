// PH-01 / NX-016 filtering proof (node native type-stripping smoke).
// Run:  node src/xhub/nav/__tests__/filter.proof.ts
//
// Asserts the DEFAULT-SAFE contract of filterNavByPermissions against the real
// XHUB_NAVIGATION model:
//   1. EMPLOYEE (request.create/task.self/document.read) + enforce  → restricted
//   2. PLATFORM_ADMIN ("*") + enforce                               → full tree
//   3. enforce:false                                                → full tree
import { XHUB_NAVIGATION, type XNavItem } from "../navigation.model.ts";
import { filterNavByPermissions } from "../filter-by-permissions.ts";

function ids(tree: XNavItem[]): Set<string> {
  const out = new Set<string>();
  const walk = (items: XNavItem[]) => {
    for (const i of items) {
      out.add(i.id);
      if (i.children) walk(i.children);
    }
  };
  walk(tree);
  return out;
}

function count(tree: XNavItem[]): number {
  return ids(tree).size;
}

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed++;
    console.error("  FAIL:", msg);
  } else {
    console.log("  ok  :", msg);
  }
}

const FULL = count(XHUB_NAVIGATION);

// 3. enforce:false → identical (no-op), regardless of grants.
console.log("[enforce:false]");
const noop = filterNavByPermissions(XHUB_NAVIGATION, ["request.create"], { enforce: false });
assert(count(noop) === FULL, `full tree unchanged (${FULL} nodes)`);

// 2. PLATFORM_ADMIN "*" + enforce → full tree.
console.log('[enforce:true, grants=["*"]]');
const admin = filterNavByPermissions(XHUB_NAVIGATION, ["*"], { enforce: true });
assert(count(admin) === FULL, `PLATFORM_ADMIN sees full tree (${FULL} nodes)`);

// 1. EMPLOYEE + enforce → restricted.
console.log('[enforce:true, grants=EMPLOYEE]');
const emp = filterNavByPermissions(
  XHUB_NAVIGATION,
  ["request.create", "task.self", "document.read"],
  { enforce: true },
);
const empIds = ids(emp);
assert(empIds.size < FULL, `employee tree is narrower (${empIds.size} < ${FULL})`);
// Kept (open to all / document.read):
for (const keep of ["home", "work", "inbox.unified", "space", "documents.library", "docs"]) {
  assert(empIds.has(keep), `keeps "${keep}"`);
}
// Hidden (admin / workflow / approver gated):
for (const hide of [
  "admin.console", "admin.users", "admin.roles", "admin.backups", "admin.audit",
  "office", "office.workflows", "approvals.center", "apps.catalog", "reports.summary", "customers",
]) {
  assert(!empIds.has(hide), `hides "${hide}"`);
}

if (failed) {
  console.error(`\nNX-016 FILTER PROOF: ${failed} FAILED`);
  process.exit(1);
}
console.log("\nNX-016 FILTER PROOF: ALL PASSED");
