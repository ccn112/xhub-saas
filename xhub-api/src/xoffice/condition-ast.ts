/**
 * Safe Condition AST evaluator (Mục 8c) — a small, side-effect-free expression
 * engine used by the X.Office workflow engine to select branches on `condition`
 * / `parallelSplit` nodes. There is NO `eval` and no dynamic code: the AST is a
 * plain JSON tree walked recursively.
 *
 * ---- JSON-AST shape --------------------------------------------------------
 * A node is either:
 *   - a LITERAL: string | number | boolean | null
 *   - a VARIABLE reference:  { "var": "dot.path.into.context" }
 *   - an EXPRESSION:         { "operator": <op>, "operands": [ ...nodes ] }
 *
 * Operators:
 *   boolean:      and, or, not
 *   comparison:   eq (==), neq/ne (!=), gt (>), gte (>=), lt (<), lte (<=)
 *   membership:   in       (operands[0] in operands[1] where operands[1] is an
 *                           array literal or a {var} resolving to an array)
 *                 notIn    (negation of `in`)
 *                 contains (operands[0] is an array/string that contains operands[1])
 *   presence:     exists   (operands[0], typically a {var}, is not null/undefined)
 *
 * `and` / `or` accept any number of operands; `not` / `exists` take one;
 * comparisons / membership take two. This is BACKWARD-COMPATIBLE with the
 * previously-shipped simple form (operator + operands, {var}, `ne`) that the 13
 * seeded workflows use — those keep evaluating identically.
 *
 * Examples:
 *   { "operator": "gt", "operands": [ { "var": "amount" }, 1000 ] }
 *       → true when context.amount > 1000
 *   { "operator": "and", "operands": [
 *       { "operator": "in", "operands": [ { "var": "dept" }, ["IT","HR"] ] },
 *       { "operator": "not", "operands": [ { "var": "flags.blocked" } ] } ] }
 *       → true when dept ∈ {IT,HR} AND flags.blocked is falsy
 */

export type ConditionContext = Record<string, unknown>;

export interface VarRef {
  var: string;
}

export interface ExprNode {
  operator: string;
  operands: ConditionAst[];
}

export type ConditionAst =
  | string
  | number
  | boolean
  | null
  | VarRef
  | ExprNode;

/** Resolve a dot-path into the context (null-safe). */
export function resolveVar(path: string, ctx: ConditionContext): unknown {
  if (!path) return undefined;
  return path
    .split('.')
    .reduce<unknown>(
      (acc, k) => (acc == null ? undefined : (acc as Record<string, unknown>)[k]),
      ctx,
    );
}

function isVarRef(v: unknown): v is VarRef {
  return !!v && typeof v === 'object' && 'var' in (v as Record<string, unknown>);
}

function isExpr(v: unknown): v is ExprNode {
  return (
    !!v &&
    typeof v === 'object' &&
    'operator' in (v as Record<string, unknown>) &&
    typeof (v as ExprNode).operator === 'string'
  );
}

/**
 * Resolve an operand to a concrete VALUE. Literals pass through; {var} resolves
 * from context; a nested expression evaluates to its boolean result. Array
 * literals resolve element-wise (so `in` / `contains` can hold {var} members).
 */
function operandValue(node: ConditionAst, ctx: ConditionContext): unknown {
  if (isVarRef(node)) return resolveVar(node.var, ctx);
  if (isExpr(node)) return evaluateCondition(node, ctx);
  if (Array.isArray(node)) {
    return (node as unknown as ConditionAst[]).map((el) => operandValue(el, ctx));
  }
  return node; // literal string / number / boolean / null
}

/**
 * Evaluate a condition AST against `context`, returning a boolean. Pure: no I/O,
 * no mutation, no `eval`. Unknown operators / malformed nodes evaluate to false
 * (fail-safe) rather than throwing, so a bad branch config never crashes a run.
 */
export function evaluateCondition(ast: ConditionAst, context: ConditionContext): boolean {
  // A bare literal / var used as a condition → truthiness.
  if (!isExpr(ast)) return Boolean(operandValue(ast, context));

  const { operator } = ast;
  const ops = Array.isArray(ast.operands) ? ast.operands : [];

  switch (operator) {
    case 'and':
      return ops.every((e) => evaluateCondition(e, context));
    case 'or':
      return ops.some((e) => evaluateCondition(e, context));
    case 'not':
      return !evaluateCondition(ops[0], context);
    case 'exists': {
      const v = operandValue(ops[0], context);
      return v !== undefined && v !== null;
    }
    case 'in':
    case 'notIn': {
      const needle = operandValue(ops[0], context);
      const hay = operandValue(ops[1], context);
      const found = Array.isArray(hay)
        ? hay.some((h) => h === needle)
        : typeof hay === 'string'
          ? hay.includes(String(needle))
          : false;
      return operator === 'in' ? found : !found;
    }
    case 'contains': {
      const hay = operandValue(ops[0], context);
      const needle = operandValue(ops[1], context);
      if (Array.isArray(hay)) return hay.some((h) => h === needle);
      if (typeof hay === 'string') return hay.includes(String(needle));
      return false;
    }
    default: {
      // binary comparisons
      const a = operandValue(ops[0], context);
      const b = operandValue(ops[1], context);
      switch (operator) {
        case 'eq':
          return a === b;
        case 'neq':
        case 'ne':
          return a !== b;
        case 'gt':
          return (a as any) > (b as any);
        case 'gte':
          return (a as any) >= (b as any);
        case 'lt':
          return (a as any) < (b as any);
        case 'lte':
          return (a as any) <= (b as any);
        default:
          return false; // unknown operator → fail-safe
      }
    }
  }
}
