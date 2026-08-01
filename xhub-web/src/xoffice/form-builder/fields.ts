// WF-06 form builder — field catalog + JSON Schema / uiSchema generator.
// Data-driven: a form is a list of BuilderField; we compile to a
// form-definition (form-definition.schema.json) with jsonSchema + uiSchema.

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "money"
  | "date"
  | "datetime"
  | "select"
  | "multiselect"
  | "checkbox"
  | "user"
  | "email"
  | "file";

export interface BuilderField {
  id: string;
  key: string;
  title: string;
  type: FieldType;
  required: boolean;
  /** comma-separated options for select / multiselect */
  options?: string;
}

export interface FieldTypeMeta {
  type: FieldType;
  label: string;
  icon: string;
}

export const FIELD_CATALOG: FieldTypeMeta[] = [
  { type: "text", label: "Văn bản ngắn", icon: "🔤" },
  { type: "textarea", label: "Văn bản dài", icon: "📄" },
  { type: "number", label: "Số", icon: "🔢" },
  { type: "money", label: "Tiền (VND)", icon: "💰" },
  { type: "date", label: "Ngày", icon: "📅" },
  { type: "datetime", label: "Ngày giờ", icon: "🕒" },
  { type: "select", label: "Chọn một", icon: "🔽" },
  { type: "multiselect", label: "Chọn nhiều", icon: "☑️" },
  { type: "checkbox", label: "Đúng/Sai", icon: "✅" },
  { type: "user", label: "Chọn người", icon: "👤" },
  { type: "email", label: "Email", icon: "✉️" },
  { type: "file", label: "Tệp đính kèm", icon: "📎" },
];

let counter = 0;
export function newField(type: FieldType): BuilderField {
  counter += 1;
  const meta = FIELD_CATALOG.find((f) => f.type === type);
  return {
    id: `f_${Date.now()}_${counter}`,
    key: `field_${counter}`,
    title: meta?.label ?? "Trường mới",
    type,
    required: false,
    options: type === "select" || type === "multiselect" ? "Lựa chọn 1, Lựa chọn 2" : undefined,
  };
}

function optionList(field: BuilderField): string[] {
  return (field.options ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export interface CompiledForm {
  jsonSchema: Record<string, unknown>;
  uiSchema: Record<string, unknown>;
}

/** Compile builder fields into JSON Schema + uiSchema. */
export function compileForm(fields: BuilderField[]): CompiledForm {
  const properties: Record<string, unknown> = {};
  const uiSchema: Record<string, unknown> = {};
  const required: string[] = [];

  for (const f of fields) {
    if (!f.key.trim()) continue;
    if (f.required) required.push(f.key);
    let prop: Record<string, unknown> = { title: f.title };

    switch (f.type) {
      case "text":
      case "user":
        prop.type = "string";
        if (f.type === "user") uiSchema[f.key] = { "ui:placeholder": "email@đơn-vị" };
        break;
      case "email":
        prop = { ...prop, type: "string", format: "email" };
        break;
      case "textarea":
        prop.type = "string";
        uiSchema[f.key] = { "ui:widget": "textarea" };
        break;
      case "number":
        prop.type = "number";
        break;
      case "money":
        prop = { ...prop, type: "number", minimum: 0 };
        uiSchema[f.key] = { "ui:help": "Đơn vị: VND" };
        break;
      case "date":
        prop = { ...prop, type: "string", format: "date" };
        break;
      case "datetime":
        prop = { ...prop, type: "string", format: "date-time" };
        break;
      case "checkbox":
        prop.type = "boolean";
        break;
      case "select":
        prop = { ...prop, type: "string", enum: optionList(f) };
        break;
      case "multiselect":
        prop = {
          ...prop,
          type: "array",
          uniqueItems: true,
          items: { type: "string", enum: optionList(f) },
        };
        break;
      case "file":
        prop = { ...prop, type: "string", format: "data-url" };
        break;
    }
    properties[f.key] = prop;
  }

  const jsonSchema: Record<string, unknown> = { type: "object", properties };
  if (required.length) jsonSchema.required = required;
  return { jsonSchema, uiSchema };
}

/** Best-effort decompile of an existing jsonSchema into builder fields. */
export function decompileForm(jsonSchema: unknown, uiSchema: unknown): BuilderField[] {
  const js = jsonSchema as { properties?: Record<string, Record<string, unknown>>; required?: string[] };
  const ui = (uiSchema ?? {}) as Record<string, Record<string, unknown>>;
  if (!js?.properties) return [];
  const required = new Set(js.required ?? []);
  return Object.entries(js.properties).map(([key, prop]) => {
    const widget = ui[key]?.["ui:widget"];
    let type: FieldType = "text";
    let options: string | undefined;
    if (prop.type === "number") type = prop.minimum === 0 ? "money" : "number";
    else if (prop.type === "boolean") type = "checkbox";
    else if (prop.type === "array") {
      type = "multiselect";
      const items = prop.items as { enum?: string[] } | undefined;
      options = (items?.enum ?? []).join(", ");
    } else if (prop.format === "email") type = "email";
    else if (prop.format === "date") type = "date";
    else if (prop.format === "date-time") type = "datetime";
    else if (prop.format === "data-url") type = "file";
    else if (Array.isArray(prop.enum)) { type = "select"; options = (prop.enum as string[]).join(", "); }
    else if (widget === "textarea") type = "textarea";
    counter += 1;
    return {
      id: `f_${Date.now()}_${counter}`,
      key,
      title: String(prop.title ?? key),
      type,
      required: required.has(key),
      options,
    };
  });
}
