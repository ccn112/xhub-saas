"use client";

// WF-07 simulation client. Calls POST /workflows/:code/simulate with the
// current definition + test data and returns the traced execution path.
import type { WorkflowDefinitionDocument } from "@/xoffice/workflow-types";

const API_BASE =
  process.env.NEXT_PUBLIC_XHUB_API_URL ?? "http://localhost:4000";

export interface SimulationStep {
  nodeId: string;
  name: string;
  outcome: string;
}

export interface SimulationResult {
  path: string[];
  steps: SimulationStep[];
  reachedEnd: boolean;
  source: "api";
}

export async function simulateWorkflow(
  code: string,
  definition: WorkflowDefinitionDocument,
  testData: unknown,
): Promise<SimulationResult> {
  const res = await fetch(
    `${API_BASE}/api/xoffice/workflows/${encodeURIComponent(code)}/simulate`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ definition, testData }),
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!res.ok) throw new Error(`Mô phỏng thất bại (${res.status})`);
  const data = (await res.json()) as Omit<SimulationResult, "source">;
  return { ...data, source: "api" };
}
