"use client";

// Sơ đồ nhân sự (staff org chart) — real people in their positions, laid out as
// a STATIC HTML/CSS hierarchical tree (nested lists + connector lines). Unlike
// the React Flow unit view, a static tree prints cleanly to PDF, so this view
// doubles as the print target. Tree edges come from Position.reportsToPositionId
// (falls back to a flat set of roots when reporting lines are absent).
import { useMemo } from "react";
import { Avatar } from "@/xhub/ui/Avatar";
import type { OrgGraph, OrgGraphPosition } from "@/features/tenant-admin/identity.server";

interface StaffNode { pos: OrgGraphPosition; children: StaffNode[]; deptName: string }

function buildTree(graph: OrgGraph): StaffNode[] {
  const unitName = new Map(graph.nodes.map((n) => [n.id, n.name]));
  const byId = new Map(graph.positions.map((p) => [p.id, p]));
  const childrenOf = new Map<string, OrgGraphPosition[]>();
  const roots: OrgGraphPosition[] = [];
  for (const p of graph.positions) {
    const parent = p.reportsToPositionId && byId.has(p.reportsToPositionId) ? p.reportsToPositionId : null;
    if (parent) {
      const arr = childrenOf.get(parent) ?? [];
      arr.push(p);
      childrenOf.set(parent, arr);
    } else {
      roots.push(p);
    }
  }
  const seen = new Set<string>();
  const toNode = (p: OrgGraphPosition): StaffNode => {
    seen.add(p.id);
    const kids = (childrenOf.get(p.id) ?? []).filter((k) => !seen.has(k.id));
    return { pos: p, deptName: unitName.get(p.orgUnitId) ?? "—", children: kids.map(toNode) };
  };
  // Heads / higher positions first for a stable, readable order.
  roots.sort((a, b) => (a.isHead === b.isHead ? a.name.localeCompare(b.name) : a.isHead ? -1 : 1));
  return roots.map(toNode);
}

function PersonCard({ node }: { node: StaffNode }) {
  const { pos, deptName } = node;
  const vacant = !pos.holderName;
  const name = pos.holderName ?? "Khuyết";
  return (
    <div
      className={[
        "org-person-card inline-flex w-[220px] flex-col gap-1 rounded-xl border bg-white px-3 py-2.5 text-left shadow-soft dark:bg-dark-700",
        vacant ? "border-dashed border-warning/50" : "border-gray-200 dark:border-dark-500",
      ].join(" ")}
    >
      <div className="flex items-center gap-2.5">
        {vacant ? (
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-lg text-warning dark:bg-dark-600">?</span>
        ) : (
          <Avatar name={name} src={pos.holderAvatarUrl} size={40} />
        )}
        <div className="min-w-0">
          <p className={`truncate text-sm font-semibold ${vacant ? "text-warning" : "text-gray-800 dark:text-dark-50"}`} title={name}>{name}</p>
          <p className="truncate text-xs text-gray-500 dark:text-dark-300" title={pos.name}>{pos.name}</p>
        </div>
      </div>
      <div className="mt-0.5 space-y-0.5 text-[11px] text-gray-500 dark:text-dark-300">
        <p className="truncate" title={deptName}>🏢 {deptName}</p>
        {!vacant && pos.holderEmail && <p className="truncate" title={pos.holderEmail}>✉️ {pos.holderEmail}</p>}
        {!vacant && pos.holderPhone && <p className="truncate" title={pos.holderPhone}>📞 {pos.holderPhone}</p>}
      </div>
    </div>
  );
}

function TreeNode({ node }: { node: StaffNode }) {
  return (
    <li>
      <PersonCard node={node} />
      {node.children.length > 0 && (
        <ul>
          {node.children.map((c) => (
            <TreeNode key={c.pos.id} node={c} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function StaffOrgChart({ graph }: { graph: OrgGraph }) {
  const roots = useMemo(() => buildTree(graph), [graph]);
  return (
    <div className="org-tree-scroll w-full overflow-x-auto p-4">
      <ul className="org-tree">
        {roots.map((r) => (
          <TreeNode key={r.pos.id} node={r} />
        ))}
      </ul>
    </div>
  );
}
