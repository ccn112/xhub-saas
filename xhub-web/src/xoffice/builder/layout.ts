"use client";

// ELK auto-layout (left-to-right). Returns new node positions; edges unchanged.
import ELK from "elkjs/lib/elk.bundled.js";
import type { WFNode, WFEdge } from "./store";

const elk = new ELK();

const NODE_W = 210;
const NODE_H = 84;

export async function autoLayout(
  nodes: WFNode[],
  edges: WFEdge[],
): Promise<WFNode[]> {
  if (nodes.length === 0) return nodes;

  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.layered.spacing.nodeNodeBetweenLayers": "90",
      "elk.spacing.nodeNode": "50",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
    },
    children: nodes.map((n) => ({ id: n.id, width: NODE_W, height: NODE_H })),
    edges: edges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  const res = await elk.layout(graph);
  const posById = new Map<string, { x: number; y: number }>();
  for (const child of res.children ?? []) {
    posById.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
  }

  return nodes.map((n) => {
    const p = posById.get(n.id);
    return p ? { ...n, position: p } : n;
  });
}
