"use client";

// WF-06 — Form builder. dnd-kit-free palette (click to add) + reorderable field
// list → JSON Schema (form-definition.schema.json) + live RJSF preview.
// "AI sinh biểu mẫu" calls /ai/draft screen=form_builder (optional, no crash).
import { useMemo, useState } from "react";
import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";

import { SectionCard } from "@/xhub/ui/Card";
import {
  FIELD_CATALOG,
  compileForm,
  decompileForm,
  newField,
  type BuilderField,
  type FieldType,
} from "./fields";
import { inputClass, labelClass } from "@/xoffice/builder/inspector/ui";

import { API_BASE_CLIENT as API_BASE } from "@/lib/api-base";

export interface FormTemplate {
  code: string;
  name: string;
  jsonSchema: unknown;
  uiSchema: unknown;
}

export function FormBuilder({
  workflowCode,
  templates,
}: {
  workflowCode: string;
  templates: FormTemplate[];
}) {
  const [formCode, setFormCode] = useState(templates[0]?.code ?? `FORM-${workflowCode}`);
  const [formName, setFormName] = useState(templates[0]?.name ?? "Biểu mẫu mới");
  const [fields, setFields] = useState<BuilderField[]>(() =>
    templates[0] ? decompileForm(templates[0].jsonSchema, templates[0].uiSchema) : [],
  );
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);

  const compiled = useMemo(() => compileForm(fields), [fields]);

  const addField = (type: FieldType) => setFields((p) => [...p, newField(type)]);
  const updateField = (id: string, patch: Partial<BuilderField>) =>
    setFields((p) => p.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const removeField = (id: string) => setFields((p) => p.filter((f) => f.id !== id));
  const move = (id: string, dir: -1 | 1) =>
    setFields((p) => {
      const i = p.findIndex((f) => f.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.length) return p;
      const next = [...p];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const loadTemplate = (code: string) => {
    const t = templates.find((x) => x.code === code);
    if (!t) return;
    setFormCode(t.code);
    setFormName(t.name);
    setFields(decompileForm(t.jsonSchema, t.uiSchema));
  };

  const runAi = async () => {
    if (!aiPrompt.trim()) return;
    setAiBusy(true);
    setAiNote(null);
    try {
      const res = await fetch(`${API_BASE}/api/xoffice/ai/draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt.trim(), screen: "form_builder" }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { jsonSchema?: unknown; uiSchema?: unknown };
      if (data.jsonSchema) {
        setFields(decompileForm(data.jsonSchema, data.uiSchema));
        setAiNote("AI đã sinh biểu mẫu — kiểm tra lại trước khi lưu.");
      } else {
        setAiNote("AI chưa trả biểu mẫu (backend chưa hỗ trợ form_builder).");
      }
    } catch {
      setAiNote("Không gọi được AI (backend chưa hỗ trợ). Bạn có thể tự dựng biểu mẫu.");
    } finally {
      setAiBusy(false);
    }
  };

  const definition = {
    schemaVersion: "1.0",
    code: formCode,
    name: formName,
    jsonSchema: compiled.jsonSchema,
    uiSchema: compiled.uiSchema,
    rules: [],
    metadata: { tenantSlug: "xtech", workflowCode },
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[13rem_1fr_1fr]">
      {/* Palette */}
      <aside className="rounded-xl border border-gray-200 bg-white p-3 dark:border-dark-600 dark:bg-dark-800">
        <p className="mb-2 text-xs-plus font-semibold text-gray-700 dark:text-dark-100">Thêm trường</p>
        <div className="space-y-1.5">
          {FIELD_CATALOG.map((f) => (
            <button
              key={f.type}
              onClick={() => addField(f.type)}
              className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-2 text-left text-xs-plus font-medium text-gray-700 transition hover:border-primary-300 hover:bg-primary-600/5 dark:border-dark-600 dark:text-dark-100"
            >
              <span aria-hidden>{f.icon}</span>
              {f.label}
            </button>
          ))}
        </div>
      </aside>

      {/* Field editor */}
      <SectionCard title="Cấu hình biểu mẫu">
        <div className="space-y-3">
          {templates.length > 0 && (
            <div>
              <label className={labelClass}>Mẫu có sẵn</label>
              <select className={inputClass} value={formCode} onChange={(e) => loadTemplate(e.target.value)}>
                {templates.map((t) => (
                  <option key={t.code} value={t.code}>{t.name} ({t.code})</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Mã biểu mẫu</label>
              <input className={inputClass} value={formCode} onChange={(e) => setFormCode(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Tên biểu mẫu</label>
              <input className={inputClass} value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
          </div>

          <div className="rounded-lg border border-primary-200 bg-primary-600/5 p-2.5 dark:border-primary-900">
            <label className={labelClass}>✨ AI sinh biểu mẫu</label>
            <textarea
              className={`${inputClass} h-16 resize-none`}
              placeholder="Mô tả biểu mẫu cần tạo…"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
            />
            <button
              onClick={runAi}
              disabled={aiBusy || !aiPrompt.trim()}
              className="mt-1.5 w-full rounded-lg bg-primary-600 py-1.5 text-xs-plus font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
            >
              {aiBusy ? "Đang sinh…" : "Sinh biểu mẫu"}
            </button>
            {aiNote && <p className="mt-1 text-tiny text-gray-500 dark:text-dark-300">{aiNote}</p>}
          </div>

          <div className="space-y-2">
            {fields.length === 0 && (
              <p className="rounded-lg border border-dashed border-gray-300 py-6 text-center text-tiny text-gray-400 dark:border-dark-500">
                Chưa có trường nào. Chọn loại trường ở bên trái để thêm.
              </p>
            )}
            {fields.map((f, i) => (
              <div key={f.id} className="space-y-1.5 rounded-lg border border-gray-200 p-2 dark:border-dark-600">
                <div className="flex items-center justify-between">
                  <span className="text-tiny text-gray-400">
                    {FIELD_CATALOG.find((c) => c.type === f.type)?.label}
                  </span>
                  <div className="flex items-center gap-1">
                    <button className="text-tiny text-gray-400 hover:text-gray-600 disabled:opacity-30" onClick={() => move(f.id, -1)} disabled={i === 0}>↑</button>
                    <button className="text-tiny text-gray-400 hover:text-gray-600 disabled:opacity-30" onClick={() => move(f.id, 1)} disabled={i === fields.length - 1}>↓</button>
                    <button className="text-tiny text-error hover:underline" onClick={() => removeField(f.id)}>Xoá</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <input className={inputClass} placeholder="key" value={f.key} onChange={(e) => updateField(f.id, { key: e.target.value })} />
                  <input className={inputClass} placeholder="Nhãn" value={f.title} onChange={(e) => updateField(f.id, { title: e.target.value })} />
                </div>
                {(f.type === "select" || f.type === "multiselect") && (
                  <input className={inputClass} placeholder="Lựa chọn, phân tách bằng phẩy" value={f.options ?? ""} onChange={(e) => updateField(f.id, { options: e.target.value })} />
                )}
                <label className="flex items-center gap-2 text-tiny text-gray-600 dark:text-dark-200">
                  <input type="checkbox" checked={f.required} onChange={(e) => updateField(f.id, { required: e.target.checked })} className="rounded border-gray-300 text-primary-600" />
                  Bắt buộc
                </label>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Preview + JSON */}
      <div className="space-y-4">
        <SectionCard title="Xem trước (RJSF)">
          {fields.length ? (
            <div className="xoffice-rjsf">
              <Form schema={compiled.jsonSchema} uiSchema={compiled.uiSchema} validator={validator}>
                <button type="submit" className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs-plus font-medium text-white">Gửi (demo)</button>
              </Form>
            </div>
          ) : (
            <p className="py-6 text-center text-tiny text-gray-400">Thêm trường để xem trước.</p>
          )}
        </SectionCard>
        <SectionCard title="form-definition (JSON)">
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-gray-50 p-3 font-mono text-tiny text-gray-600 dark:bg-dark-800 dark:text-dark-200">
            {JSON.stringify(definition, null, 2)}
          </pre>
        </SectionCard>
      </div>
    </div>
  );
}
