// Condition AST unit check (Mục 8c). Asserts evaluateCondition over a table of
// cases: AND/OR/NOT, all comparisons, in/notIn/contains/exists, nesting, {var}
// dot-paths, literals, AND the backward-compat simple form (operator+operands,
// `ne`). Requires a prior build (imports from dist). Run: npm run test:condition
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const distPath = join(process.cwd(), 'dist', 'src', 'xoffice', 'condition-ast.js');
if (!existsSync(distPath)) {
  console.error(`✗ ${distPath} not found — run "npm run build" first.`);
  process.exit(1);
}
const { evaluateCondition } = await import(pathToFileURL(distPath).href);

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✓ ' + msg);
  else { console.error('  ✗ ' + msg); failed++; }
};

const ctx = {
  amount: 1500,
  dept: 'IT',
  status: 'approved',
  tags: ['urgent', 'finance'],
  flags: { blocked: false, vip: true },
  note: 'please review the invoice',
  missing: null,
};

const cases = [
  // comparisons
  [{ operator: 'gt', operands: [{ var: 'amount' }, 1000] }, true, 'gt: amount > 1000'],
  [{ operator: 'gte', operands: [{ var: 'amount' }, 1500] }, true, 'gte: amount >= 1500'],
  [{ operator: 'lt', operands: [{ var: 'amount' }, 1000] }, false, 'lt: amount < 1000 (false)'],
  [{ operator: 'lte', operands: [{ var: 'amount' }, 1500] }, true, 'lte: amount <= 1500'],
  [{ operator: 'eq', operands: [{ var: 'dept' }, 'IT'] }, true, 'eq: dept == IT'],
  [{ operator: 'neq', operands: [{ var: 'dept' }, 'HR'] }, true, 'neq: dept != HR'],
  // backward-compat simple form uses `ne`
  [{ operator: 'ne', operands: [{ var: 'dept' }, 'HR'] }, true, 'ne (legacy alias): dept != HR'],
  // boolean
  [{ operator: 'and', operands: [
    { operator: 'gt', operands: [{ var: 'amount' }, 1000] },
    { operator: 'eq', operands: [{ var: 'status' }, 'approved'] },
  ] }, true, 'and: amount>1000 AND status==approved'],
  [{ operator: 'or', operands: [
    { operator: 'eq', operands: [{ var: 'dept' }, 'HR'] },
    { operator: 'eq', operands: [{ var: 'dept' }, 'IT'] },
  ] }, true, 'or: dept==HR OR dept==IT'],
  [{ operator: 'not', operands: [{ var: 'flags.blocked' }] }, true, 'not: !flags.blocked'],
  // membership
  [{ operator: 'in', operands: [{ var: 'dept' }, ['IT', 'HR']] }, true, 'in: dept ∈ [IT,HR]'],
  [{ operator: 'in', operands: [{ var: 'dept' }, ['HR', 'FIN']] }, false, 'in: dept ∉ [HR,FIN] (false)'],
  [{ operator: 'notIn', operands: [{ var: 'dept' }, ['HR', 'FIN']] }, true, 'notIn: dept ∉ [HR,FIN]'],
  // contains (array + string)
  [{ operator: 'contains', operands: [{ var: 'tags' }, 'urgent'] }, true, 'contains: tags ⊇ urgent'],
  [{ operator: 'contains', operands: [{ var: 'note' }, 'invoice'] }, true, 'contains: note has "invoice"'],
  // exists
  [{ operator: 'exists', operands: [{ var: 'flags.vip' }] }, true, 'exists: flags.vip is set'],
  [{ operator: 'exists', operands: [{ var: 'missing' }] }, false, 'exists: null → false'],
  [{ operator: 'exists', operands: [{ var: 'nope.deep' }] }, false, 'exists: undefined dot-path → false'],
  // deep nesting: (amount>1000 AND dept in [IT,HR]) AND NOT blocked
  [{ operator: 'and', operands: [
    { operator: 'and', operands: [
      { operator: 'gt', operands: [{ var: 'amount' }, 1000] },
      { operator: 'in', operands: [{ var: 'dept' }, ['IT', 'HR']] },
    ] },
    { operator: 'not', operands: [{ var: 'flags.blocked' }] },
  ] }, true, 'nested: (amount>1000 AND dept∈[IT,HR]) AND !blocked'],
  // fail-safe: unknown operator → false
  [{ operator: 'bogus', operands: [1, 2] }, false, 'unknown operator → false (fail-safe)'],
];

console.log('Condition AST unit check');
for (const [ast, expected, msg] of cases) {
  ok(evaluateCondition(ast, ctx) === expected, msg);
}

console.log(failed === 0 ? '\nCONDITION AST TEST PASSED' : `\nCONDITION AST TEST FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
