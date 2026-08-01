"use client";

// WF-05 — No-code condition builder. Rule list (var + operator + value) joined
// by a single and/or, compiled to condition-ast. "Nâng cao" tab exposes the raw
// AST JSON. Also labels the outgoing edges (Có / Không branches).
import { useEffect, useMemo, useState } from "react";

import { useEditorStore, type WFNode } from "../store";
import {
  COMPARE_OPS,
  astToRules,
  rulesToAst,
  type CombineOp,
  type ConditionRule,
} from "../condition-ast";
import { inputClass, labelClass, btnPrimary, sectionLabel } from "./ui";

const emptyRule = (): ConditionRule => ({ var: "", operator: "eq", value: "" });

export function ConditionBuilder({ node }: { node: WFNode }) {
  const updateNode = useEditorStore((s) => s.updateNode);
  const edges = useEditorStore((s) => s.edges);
  const nodes = useEditorStore((s) => s.nodes);
  const updateEdgeLabel = useEditorStore((s) => s.updateEdgeLabel);

  const initial = useMemo(() => {
    const expr = (node.data.config as Record<string, unknown>).expression;
    return astToRules(expr);
  }, [node]);

  const [name, setName] = useState(node.data.name);
  const [rules, setRules] = useState<ConditionRule[]>(
    initial.rules.length ? initial.rules : [emptyRule()],
  );
  const [combine, setCombine] = useState<CombineOp>(initial.combine);
  const [tab, setTab] = useState<"visual" | "advanced">("visual");
  const [advancedJson, setAdvancedJson] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(node.data.name);
    const parsed = astToRules((node.data.config as Record<string, unknown>).expression);
    setRules(parsed.rules.length ? parsed.rules : [emptyRule()]);
    setCombine(parsed.combine);
  }, [node]);

  const ast = useMemo(() => rulesToAst(rules, combine), [rules, combine]);

  const outgoing = edges.filter((e) => e.source === node.id);
  const nodeName = (id: string) => nodes.find((n) => n.id === id)?.data.name ?? id;

  const setRule = (i: number, patch: Partial<ConditionRule>) => {
    setRules((p) => p.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    setSaved(false);
  };

  const save = () => {
    let expression: unknown;
    if (tab === "advanced") {
      try {
        expression = advancedJson.trim() ? JSON.parse(advancedJson) : undefined;
        setJsonError(null);
      } catch {
        setJsonError("JSON không hợp lệ.");
        return;
      }
    } else {
      expression = ast ?? undefined;
    }
    const config: Record<string, unknown> = { ...(node.data.config as object) };
    if (expression) config.expression = expression;
    else delete config.expression;
    updateNode(node.id, { name, config });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const openAdvanced = () => {
    setAdvancedJson(JSON.stringify(ast ?? { operator: "and", operands: [] }, null, 2));
    setTab("advanced");
  };

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Tên node</label>
        <input className={inputClass} value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
      </div>

      <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5 dark:bg-dark-700">
        <button
          className={`flex-1 rounded-md py-1 text-xs-plus font-medium transition ${tab === "visual" ? "bg-white shadow-sm dark:bg-dark-600 dark:text-dark-50" : "text-gray-500"}`}
          onClick={() => setTab("visual")}
        >
          No-code
        </button>
        <button
          className={`flex-1 rounded-md py-1 text-xs-plus font-medium transition ${tab === "advanced" ? "bg-white shadow-sm dark:bg-dark-600 dark:text-dark-50" : "text-gray-500"}`}
          onClick={openAdvanced}
        >
          Nâng cao (AST)
        </button>
      </div>

      {tab === "visual" ? (
        <>
          {rules.length > 1 && (
            <div>
              <label className={labelClass}>Gộp điều kiện</label>
              <select className={inputClass} value={combine} onChange={(e) => { setCombine(e.target.value as CombineOp); setSaved(false); }}>
                <option value="and">TẤT CẢ đúng (AND)</option>
                <option value="or">MỘT trong số đúng (OR)</option>
              </select>
            </div>
          )}

          <div className="space-y-2">
            {rules.map((r, i) => (
              <div key={i} className="space-y-1.5 rounded-lg border border-gray-200 p-2 dark:border-dark-600">
                <div className="flex items-center justify-between">
                  <span className="text-tiny text-gray-400">Điều kiện {i + 1}</span>
                  {rules.length > 1 && (
                    <button
                      className="text-tiny text-error hover:underline"
                      onClick={() => { setRules((p) => p.filter((_, idx) => idx !== i)); setSaved(false); }}
                    >
                      Xoá
                    </button>
                  )}
                </div>
                <input
                  className={inputClass}
                  placeholder="Biến (VD: request.amount)"
                  value={r.var}
                  onChange={(e) => setRule(i, { var: e.target.value })}
                />
                <select className={inputClass} value={r.operator} onChange={(e) => setRule(i, { operator: e.target.value as ConditionRule["operator"] })}>
                  {COMPARE_OPS.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
                {r.operator !== "exists" && (
                  <input
                    className={inputClass}
                    placeholder={r.operator === "in" || r.operator === "notIn" ? "giá trị, phân tách bằng phẩy" : "giá trị"}
                    value={r.value}
                    onChange={(e) => setRule(i, { value: e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>

          <button
            className="w-full rounded-lg border border-dashed border-gray-300 py-1.5 text-xs-plus text-gray-500 transition hover:border-primary-400 hover:text-primary-600 dark:border-dark-500"
            onClick={() => { setRules((p) => [...p, emptyRule()]); setSaved(false); }}
          >
            + Thêm điều kiện
          </button>

          <div className="rounded-lg bg-gray-50 p-2 dark:bg-dark-700">
            <p className={sectionLabel}>AST xem trước</p>
            <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-tiny text-gray-500 dark:text-dark-200">
              {ast ? JSON.stringify(ast, null, 2) : "(chưa có điều kiện)"}
            </pre>
          </div>
        </>
      ) : (
        <div>
          <label className={labelClass}>Condition AST (JSON)</label>
          <textarea
            className={`${inputClass} h-52 resize-y font-mono text-tiny`}
            value={advancedJson}
            onChange={(e) => { setAdvancedJson(e.target.value); setSaved(false); }}
            spellCheck={false}
          />
          {jsonError && <p className="mt-1 text-tiny text-error">{jsonError}</p>}
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="space-y-1.5">
          <p className={sectionLabel}>Nhãn nhánh ra</p>
          {outgoing.map((e) => (
            <div key={e.id} className="flex items-center gap-2">
              <span className="w-24 shrink-0 truncate text-tiny text-gray-500 dark:text-dark-300" title={nodeName(e.target)}>
                → {nodeName(e.target)}
              </span>
              <input
                className={`${inputClass} flex-1`}
                placeholder="Có / Không"
                defaultValue={typeof e.label === "string" ? e.label : ""}
                onBlur={(ev) => updateEdgeLabel(e.id, ev.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      <button className={btnPrimary} onClick={save}>
        {saved ? "Đã cập nhật ✓" : "Cập nhật"}
      </button>
    </div>
  );
}
