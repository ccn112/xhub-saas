// Form runtime data access. Loads a form-definition (JSON Schema + uiSchema) by
// code — backend first (best-effort), committed seed as fallback — and derives
// how the workflow expects the submitted data to be shaped (variable namespace).
import seedForms from "@/data/xoffice/form-definitions.json";
import { xofficeContext } from "./workflow-data";
import type { WorkflowDefinitionDocument, WorkflowNodeDoc } from "@/xoffice/workflow-types";

import { API_BASE_SERVER as API_BASE } from "@/lib/api-base";

export interface FormDefinition {
  code: string;
  name: string;
  jsonSchema: Record<string, unknown>;
  uiSchema: Record<string, unknown>;
}

interface SeedForm {
  code: string;
  name: string;
  jsonSchema: Record<string, unknown>;
  uiSchema: Record<string, unknown>;
}

const SEED_FORMS = seedForms as unknown as SeedForm[];

/** The first `form` node in a workflow (golden path uses a single intake form). */
export function findFormNode(def: WorkflowDefinitionDocument): WorkflowNodeDoc | null {
  return def.nodes.find((n) => n.type === "form") ?? null;
}

/** Read the formCode a form node points at (config.formCode). */
export function formCodeOf(node: WorkflowNodeDoc): string | null {
  const code = (node.config as { formCode?: unknown }).formCode;
  return typeof code === "string" && code ? code : null;
}

/** Load a form-definition by code: backend best-effort, then seed fallback. */
export async function getFormDefinition(
  formCode: string,
): Promise<{ form: FormDefinition | null; source: "api" | "seed" }> {
  try {
    const ctx = xofficeContext();
    const res = await fetch(
      `${API_BASE}/api/xoffice/forms/${encodeURIComponent(formCode)}`,
      {
        headers: {
          "x-tenant-id": ctx.tenantId,
          "x-user-id": ctx.userId,
          "content-type": "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(2500),
      },
    );
    if (res.ok) {
      const data = (await res.json()) as Partial<SeedForm> | null;
      if (data && data.jsonSchema) {
        return {
          form: {
            code: data.code ?? formCode,
            name: data.name ?? formCode,
            jsonSchema: data.jsonSchema as Record<string, unknown>,
            uiSchema: (data.uiSchema as Record<string, unknown>) ?? {},
          },
          source: "api",
        };
      }
    }
  } catch {
    /* fall through to seed */
  }
  const seed = SEED_FORMS.find((f) => f.code === formCode);
  if (seed) {
    return {
      form: {
        code: seed.code,
        name: seed.name,
        jsonSchema: seed.jsonSchema,
        uiSchema: seed.uiSchema ?? {},
      },
      source: "seed",
    };
  }
  return { form: null, source: "seed" };
}

/**
 * Infer the variable namespace the workflow expects the form data under.
 * Data-driven: scans the workflow (condition expressions, connector mappings…)
 * for references like `request.amount` whose leaf matches a form field key. If a
 * dominant prefix emerges we nest under it (procurement → `request`); otherwise
 * the data is stored flat (room booking / IT ticket).
 */
export function inferFormNamespace(
  def: WorkflowDefinitionDocument,
  jsonSchema: Record<string, unknown>,
): string | null {
  const props = (jsonSchema.properties as Record<string, unknown> | undefined) ?? {};
  const keys = Object.keys(props);
  if (keys.length === 0) return null;
  const haystack = JSON.stringify(def);
  const counts = new Map<string, number>();
  for (const key of keys) {
    const re = new RegExp(`([A-Za-z_][A-Za-z0-9_]*)\\.${key}\\b`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(haystack)) !== null) {
      const prefix = m[1];
      counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return null;
  let best: string | null = null;
  let bestN = 0;
  for (const [prefix, n] of counts) {
    if (n > bestN) {
      best = prefix;
      bestN = n;
    }
  }
  return best;
}
