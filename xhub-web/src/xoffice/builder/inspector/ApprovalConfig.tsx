"use client";

// WF-04 — Approval / humanTask node config.
// assignment (role/manager/user/sameAsPrevious) + mode (one/all/quorum) + SLA
// + allowed actions (approve/reject/return). Persists to node.config.
import { useEffect, useState } from "react";

import { useEditorStore, type WFNode } from "../store";
import { SEED_ROLES } from "@/xoffice/lib/connectors";
import { inputClass, labelClass, btnPrimary, sectionLabel } from "./ui";

const assignmentTypes = [
  { value: "requesterManager", label: "Quản lý của người yêu cầu" },
  { value: "role", label: "Theo vai trò (role)" },
  { value: "sameAsPrevious", label: "Giống bước trước" },
  { value: "user", label: "Người cụ thể" },
];

const modes = [
  { value: "one", label: "Một người duyệt là đủ" },
  { value: "all", label: "Tất cả phải duyệt" },
  { value: "quorum", label: "Theo số lượng tối thiểu" },
];

const ALL_ACTIONS = [
  { value: "approve", label: "Duyệt" },
  { value: "reject", label: "Từ chối" },
  { value: "return", label: "Trả lại" },
];

interface State {
  name: string;
  assignmentType: string;
  roleCode: string;
  userEmail: string;
  mode: string;
  quorum: string;
  slaHours: string;
  actions: string[];
}

function fromConfig(node: WFNode): State {
  const c = node.data.config as Record<string, unknown>;
  const assignment = (c.assignment ?? {}) as Record<string, unknown>;
  const actions = Array.isArray(c.allowedActions)
    ? (c.allowedActions as string[])
    : ["approve", "reject"];
  return {
    name: node.data.name,
    assignmentType: String(assignment.type ?? "requesterManager"),
    roleCode: String(assignment.roleCode ?? ""),
    userEmail: String(assignment.userEmail ?? ""),
    mode: String(c.mode ?? "one"),
    quorum: c.quorum != null ? String(c.quorum) : "2",
    slaHours: c.slaHours != null ? String(c.slaHours) : "",
    actions,
  };
}

export function ApprovalConfig({ node }: { node: WFNode }) {
  const updateNode = useEditorStore((s) => s.updateNode);
  const [s, setS] = useState<State>(() => fromConfig(node));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setS(fromConfig(node));
  }, [node]);

  const set = <K extends keyof State>(k: K, v: State[K]) => {
    setS((p) => ({ ...p, [k]: v }));
    setSaved(false);
  };

  const toggleAction = (value: string) => {
    setS((p) => ({
      ...p,
      actions: p.actions.includes(value)
        ? p.actions.filter((a) => a !== value)
        : [...p.actions, value],
    }));
    setSaved(false);
  };

  const save = () => {
    const assignment: Record<string, unknown> = { type: s.assignmentType };
    if (s.assignmentType === "role" && s.roleCode) assignment.roleCode = s.roleCode;
    if (s.assignmentType === "user" && s.userEmail) assignment.userEmail = s.userEmail;
    const config: Record<string, unknown> = {
      assignment,
      mode: s.mode,
      allowedActions: s.actions,
    };
    if (s.mode === "quorum") config.quorum = Number(s.quorum) || 1;
    if (s.slaHours) config.slaHours = Number(s.slaHours);
    updateNode(node.id, { name: s.name, config });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Tên node</label>
        <input className={inputClass} value={s.name} onChange={(e) => set("name", e.target.value)} />
      </div>

      <div>
        <label className={labelClass}>Giao cho</label>
        <select
          className={inputClass}
          value={s.assignmentType}
          onChange={(e) => set("assignmentType", e.target.value)}
        >
          {assignmentTypes.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </div>

      {s.assignmentType === "role" && (
        <div>
          <label className={labelClass}>Vai trò</label>
          <select className={inputClass} value={s.roleCode} onChange={(e) => set("roleCode", e.target.value)}>
            <option value="">— Chọn vai trò —</option>
            {SEED_ROLES.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name} ({r.code})
              </option>
            ))}
          </select>
        </div>
      )}

      {s.assignmentType === "user" && (
        <div>
          <label className={labelClass}>Email người duyệt</label>
          <input
            className={inputClass}
            placeholder="ten@xtech.com.vn"
            value={s.userEmail}
            onChange={(e) => set("userEmail", e.target.value)}
          />
        </div>
      )}

      <div>
        <label className={labelClass}>Cơ chế duyệt</label>
        <select className={inputClass} value={s.mode} onChange={(e) => set("mode", e.target.value)}>
          {modes.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {s.mode === "quorum" && (
        <div>
          <label className={labelClass}>Số người tối thiểu</label>
          <input
            type="number"
            min={1}
            className={inputClass}
            value={s.quorum}
            onChange={(e) => set("quorum", e.target.value)}
          />
        </div>
      )}

      <div>
        <label className={labelClass}>SLA (giờ)</label>
        <input
          type="number"
          step="0.5"
          className={inputClass}
          value={s.slaHours}
          onChange={(e) => set("slaHours", e.target.value)}
        />
      </div>

      <div>
        <p className={sectionLabel}>Hành động cho phép</p>
        <div className="mt-1.5 space-y-1">
          {ALL_ACTIONS.map((a) => (
            <label key={a.value} className="flex items-center gap-2 text-sm text-gray-700 dark:text-dark-100">
              <input
                type="checkbox"
                checked={s.actions.includes(a.value)}
                onChange={() => toggleAction(a.value)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              {a.label}
            </label>
          ))}
        </div>
      </div>

      <button className={btnPrimary} onClick={save}>
        {saved ? "Đã cập nhật ✓" : "Cập nhật"}
      </button>
    </div>
  );
}
