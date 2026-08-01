"use client";

// ELK top-down (DOWN) layout for the org chart — mirrors the xoffice builder's
// ELK setup (layered algorithm) but flows parent→child vertically like an org
// chart. Returns node positions keyed by id; edges are derived from parentId.
import ELK from "elkjs/lib/elk.bundled.js";

const elk = new ELK();

export const ORG_NODE_W = 236;
export const ORG_NODE_H = 104;

export interface LayoutInput { id: string; parentId: string | null }

/** Compute {x,y} per node id using ELK layered, top-down. */
export async function layoutOrg(nodes: LayoutInput[]): Promise<Map<string, { x: number; y: number }>> {
  const pos = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return pos;

  const ids = new Set(nodes.map((n) => n.id));
  const edges = nodes
    .filter((n) => n.parentId && ids.has(n.parentId))
    .map((n) => ({ id: `e-${n.parentId}-${n.id}`, sources: [n.parentId as string], targets: [n.id] }));

  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.layered.spacing.nodeNodeBetweenLayers": "70",
      "elk.spacing.nodeNode": "40",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
    },
    children: nodes.map((n) => ({ id: n.id, width: ORG_NODE_W, height: ORG_NODE_H })),
    edges,
  };

  const res = await elk.layout(graph);
  for (const child of res.children ?? []) {
    pos.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
  }
  return pos;
}
