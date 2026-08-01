"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/xhub/ui/Badge";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import type { ProjectDetail, ProjectWorkItem } from "@/xoffice/lib/work-projects-data";
import {
  PROJECT_STATUS_LABEL, PROJECT_STATUS_TONE, HEALTH_LABEL, HEALTH_TONE, KIND_LABEL, METHOD_LABEL, ROLE_LABEL, DEP_LABEL, fmtDate,
} from "./project-states";

type Tab = "overview" | "work" | "roles";

/**
 * ExecutionProject detail (W2). Overview (health/progress/baseline/forecast/PM/
 * sponsor) + Work tab (WBS tree with roll-up progress + dependency list) + roles.
 * A SUMMARY-access viewer (CoordinationShare) only ever receives summary bars —
 * this component renders whatever the server returned; it never un-hides fields.
 * The interactive Gantt is W3 — this provides the WBS + dependency + baseline data.
 */
export function ProjectDetailClient({ detail }: { detail: ProjectDetail }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [busy, setBusy] = useState(false);
  const { project, access } = detail;
  const items = detail.workItems ?? [];
  const summaryOnly = access === "SUMMARY";

  const tree = useMemo(() => buildTree(items), [items]);
  const idToTitle = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i.title])), [items]);

  async function createBaseline() {
    setBusy(true);
    try {
      const res = await fetch(`/api/work/projects/${project.id}/baseline`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const progress = (project as any).computedProgress ?? project.progressPercent;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/work/projects" className="text-sm text-gray-400 hover:text-primary-500">← Dự án</Link>
            {summaryOnly && <Badge tone="info">Phối hợp (tóm tắt)</Badge>}
          </div>
          <h1 className="mt-1 font-heading text-xl font-bold text-gray-800 dark:text-dark-50">
            <span className="font-mono text-sm text-gray-400">{project.code}</span> {project.name}
          </h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-dark-300">
            <Badge tone={PROJECT_STATUS_TONE[project.status] ?? "neutral"}>{PROJECT_STATUS_LABEL[project.status] ?? project.status}</Badge>
            <Badge tone={HEALTH_TONE[project.health] ?? "neutral"}>{HEALTH_LABEL[project.health] ?? project.health}</Badge>
            <span>{KIND_LABEL[project.projectKind] ?? project.projectKind}</span>
            {!summaryOnly && <span>· {METHOD_LABEL[project.progressMethod] ?? project.progressMethod}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/work/projects/${project.id}/gantt`} className="h-9 rounded-lg border border-gray-300 px-4 text-sm font-medium leading-9 text-gray-700 hover:bg-gray-50 dark:border-dark-500 dark:text-dark-100 dark:hover:bg-dark-700">
            Gantt
          </Link>
          {!summaryOnly && (
            <button onClick={createBaseline} disabled={busy} className="h-9 rounded-lg border border-primary-400 px-4 text-sm font-medium text-primary-600 hover:bg-primary-50 disabled:opacity-50 dark:text-primary-400 dark:hover:bg-primary-900/20">
              {busy ? "Đang lưu…" : project.currentBaselineVersion ? `Rebaseline (đang v${project.currentBaselineVersion})` : "Tạo baseline"}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Tiến độ" value={`${progress}%`} icon="📈" tone="primary" />
        <StatCard label="Kết thúc (KH)" value={fmtDate(project.plannedFinish)} icon="🎯" tone="info" />
        <StatCard label="Dự báo kết thúc" value={fmtDate(project.forecastFinish)} icon="🔮" tone={project.health === "RED" ? "error" : "warning"} />
        <StatCard label="Baseline" value={project.currentBaselineVersion ? `v${project.currentBaselineVersion}` : "—"} icon="📌" tone="success" />
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-dark-500">
        <TabBtn active={tab === "overview"} onClick={() => setTab("overview")} label="Tổng quan" />
        <TabBtn active={tab === "work"} onClick={() => setTab("work")} label={`Công việc (WBS)${items.length ? ` · ${items.length}` : ""}`} />
        {!summaryOnly && <TabBtn active={tab === "roles"} onClick={() => setTab("roles")} label={`Vai trò${detail.roles?.length ? ` · ${detail.roles.length}` : ""}`} />}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 md:grid-cols-2">
          <SectionCard title="Thông tin dự án" accent="primary">
            <dl className="space-y-2 text-sm">
              <Row k="Quản lý dự án (PM)" v={project.projectManagerId ?? "—"} />
              <Row k="Bảo trợ (Sponsor)" v={project.sponsorId ?? "—"} />
              <Row k="Bắt đầu (KH)" v={fmtDate(project.plannedStart)} />
              <Row k="Kết thúc (KH)" v={fmtDate(project.plannedFinish)} />
              <Row k="Dự báo kết thúc" v={fmtDate(project.forecastFinish)} />
              {!summaryOnly && <Row k="Cách tính tiến độ" v={METHOD_LABEL[project.progressMethod] ?? project.progressMethod} />}
            </dl>
          </SectionCard>
          <SectionCard title="Mốc (Milestones)" accent="warning">
            <ul className="space-y-2">
              {(detail.milestones ?? []).map((m) => (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <span className="truncate text-gray-700 dark:text-dark-100">◆ {m.title}</span>
                  <span className="flex items-center gap-2">
                    {m.overdue && <Badge tone="error">Trễ</Badge>}
                    <span className="text-xs text-gray-400">{fmtDate(m.dueAt)}</span>
                  </span>
                </li>
              ))}
              {(detail.milestones ?? []).length === 0 && <li className="text-sm text-gray-400">Chưa có mốc</li>}
            </ul>
          </SectionCard>
        </div>
      )}

      {tab === "work" && (
        <div className="space-y-4">
          <SectionCard title="Cấu trúc phân rã công việc (WBS)" accent="primary">
            {tree.length === 0 ? (
              <p className="text-sm text-gray-400">Chưa có công việc nào thuộc dự án.</p>
            ) : (
              <ul className="space-y-0.5">{tree.map((n) => <WbsNode key={n.item.id} node={n} depth={0} summaryOnly={summaryOnly} />)}</ul>
            )}
          </SectionCard>
          {!summaryOnly && (
            <SectionCard title="Phụ thuộc (Dependencies)" accent="info">
              <ul className="space-y-1.5 text-sm">
                {(detail.dependencies ?? []).map((d) => (
                  <li key={d.id} className="flex items-center gap-2">
                    <span className="truncate text-gray-700 dark:text-dark-100">{idToTitle[d.predecessorId] ?? d.predecessorId}</span>
                    <Badge tone="neutral">{DEP_LABEL[d.type] ?? d.type}</Badge>
                    <span className="truncate text-gray-700 dark:text-dark-100">→ {idToTitle[d.successorId] ?? d.successorId}</span>
                    {d.lagMinutes ? <span className="text-xs text-gray-400">+{d.lagMinutes}′</span> : null}
                  </li>
                ))}
                {(detail.dependencies ?? []).length === 0 && <li className="text-gray-400">Chưa có phụ thuộc</li>}
              </ul>
            </SectionCard>
          )}
        </div>
      )}

      {tab === "roles" && !summaryOnly && (
        <SectionCard title="Vai trò dự án" accent="primary">
          <ul className="space-y-2 text-sm">
            {(detail.roles ?? []).map((r) => (
              <li key={r.id} className="flex items-center justify-between">
                <span className="text-gray-700 dark:text-dark-100">{r.subjectId} <span className="text-xs text-gray-400">({r.subjectType})</span></span>
                <span className="flex items-center gap-2">
                  <Badge tone="primary">{ROLE_LABEL[r.role] ?? r.role}</Badge>
                  <Badge tone={r.visibilityTier === "FULL" ? "success" : "info"}>{r.visibilityTier === "FULL" ? "Đầy đủ" : "Tóm tắt"}</Badge>
                </span>
              </li>
            ))}
            {(detail.roles ?? []).length === 0 && <li className="text-gray-400">Chưa phân vai trò</li>}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}

interface TreeNode { item: ProjectWorkItem; children: TreeNode[]; }

function buildTree(items: ProjectWorkItem[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  for (const i of items) byId.set(i.id, { item: i, children: [] });
  const roots: TreeNode[] = [];
  for (const i of items) {
    const node = byId.get(i.id)!;
    if (i.parentId && byId.has(i.parentId)) byId.get(i.parentId)!.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function WbsNode({ node, depth, summaryOnly }: { node: TreeNode; depth: number; summaryOnly: boolean }) {
  const i = node.item;
  const pct = i.rolledUpProgress ?? i.progressPercent;
  return (
    <>
      <li className="flex items-center gap-2 rounded px-2 py-1 hover:bg-gray-50 dark:hover:bg-dark-600/40" style={{ paddingLeft: `${depth * 20 + 8}px` }}>
        {i.wbsCode && <span className="font-mono text-[11px] text-gray-400">{i.wbsCode}</span>}
        <span className="truncate text-sm text-gray-700 dark:text-dark-100">{i.isMilestone ? "◆ " : ""}{i.title}</span>
        {node.children.length > 0 && <span className="text-[11px] text-gray-400">(roll-up)</span>}
        {i.overdue && <Badge tone="error">Trễ</Badge>}
        <span className="ml-auto flex items-center gap-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-150 dark:bg-dark-600">
            <div className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="w-9 text-right text-xs text-gray-500">{pct}%</span>
        </span>
      </li>
      {node.children.map((c) => <WbsNode key={c.item.id} node={c} depth={depth + 1} summaryOnly={summaryOnly} />)}
    </>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className={"border-b-2 px-3 py-2 text-sm font-medium transition " + (active ? "border-primary-500 text-primary-600 dark:text-primary-400" : "border-transparent text-gray-500 hover:text-gray-700 dark:text-dark-300")}>
      {label}
    </button>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-gray-500 dark:text-dark-300">{k}</dt>
      <dd className="truncate font-medium text-gray-800 dark:text-dark-100">{v}</dd>
    </div>
  );
}
