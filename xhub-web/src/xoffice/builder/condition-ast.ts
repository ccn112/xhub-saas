// No-code condition builder <-> condition-ast (condition-ast.schema.json).
// A rule is { var, operator, value }; rules combine with a single top-level
// and/or. Round-trips to the safe AST used by the runtime.

export type CompareOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "notIn" | "contains" | "exists";
export type CombineOp = "and" | "or";

export interface ConditionRule {
  var: string;
  operator: CompareOp;
  /** Raw string from the input; coerced on build. */
  value: string;
}

export interface ConditionAst {
  operator: string;
  operands: unknown[];
}

export const COMPARE_OPS: { value: CompareOp; label: string }[] = [
  { value: "eq", label: "= bằng" },
  { value: "neq", label: "≠ khác" },
  { value: "gt", label: "> lớn hơn" },
  { value: "gte", label: "≥ lớn hơn hoặc bằng" },
  { value: "lt", label: "< nhỏ hơn" },
  { value: "lte", label: "≤ nhỏ hơn hoặc bằng" },
  { value: "in", label: "∈ thuộc danh sách" },
  { value: "notIn", label: "∉ không thuộc" },
  { value: "contains", label: "chứa" },
  { value: "exists", label: "tồn tại" },
];

/** Coerce a raw string value to number/boolean/null or keep as string. */
function coerce(raw: string): unknown {
  const t = raw.trim();
  if (t === "") return "";
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "null") return null;
  if (!Number.isNaN(Number(t)) && /^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return raw;
}

function coerceList(raw: string): unknown[] {
  return raw
    .split(",")
    .map((s) => coerce(s.trim()))
    .filter((v) => v !== "");
}

/** Build a single comparison operand AST node from a rule. */
function ruleToAst(rule: ConditionRule): ConditionAst {
  const varOperand = { var: rule.var };
  if (rule.operator === "exists") {
    return { operator: "exists", operands: [varOperand] };
  }
  if (rule.operator === "in" || rule.operator === "notIn") {
    return { operator: rule.operator, operands: [varOperand, coerceList(rule.value)] };
  }
  return { operator: rule.operator, operands: [varOperand, coerce(rule.value)] };
}

/** Compose rules into a condition AST under a single and/or combinator. */
export function rulesToAst(rules: ConditionRule[], combine: CombineOp): ConditionAst | null {
  const valid = rules.filter((r) => r.var.trim());
  if (valid.length === 0) return null;
  if (valid.length === 1) return ruleToAst(valid[0]);
  return { operator: combine, operands: valid.map(ruleToAst) };
}

/** Best-effort parse of an AST back into rules + combinator for round-trip. */
export function astToRules(ast: unknown): { rules: ConditionRule[]; combine: CombineOp } {
  const empty = { rules: [] as ConditionRule[], combine: "and" as CombineOp };
  if (!ast || typeof ast !== "object") return empty;
  const node = ast as ConditionAst;
  const isCombine = node.operator === "and" || node.operator === "or";

  const parseLeaf = (leaf: unknown): ConditionRule | null => {
    if (!leaf || typeof leaf !== "object") return null;
    const n = leaf as ConditionAst;
    const operands = n.operands ?? [];
    const varOperand = operands.find(
      (o) => o && typeof o === "object" && "var" in (o as object),
    ) as { var: string } | undefined;
    if (!varOperand) return null;
    const rest = operands.filter((o) => o !== varOperand);
    let value = "";
    if (rest.length > 0) {
      const v = rest[0];
      value = Array.isArray(v) ? v.join(", ") : v === null ? "null" : String(v);
    }
    return { var: varOperand.var, operator: n.operator as CompareOp, value };
  };

  if (isCombine) {
    const rules = (node.operands ?? [])
      .map(parseLeaf)
      .filter((r): r is ConditionRule => r !== null);
    return { rules, combine: node.operator as CombineOp };
  }
  const single = parseLeaf(node);
  return single ? { rules: [single], combine: "and" } : empty;
}
