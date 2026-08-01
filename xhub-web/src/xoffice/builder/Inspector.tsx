"use client";

// Right inspector: dispatches to a specialized panel per node type.
//  - approval / humanTask → ApprovalConfig (WF-04)
//  - condition            → ConditionBuilder (WF-05)
//  - serviceCall          → MappingEditor (data-driven mapping)
//  - others               → generic property form (form/timer/notification…)
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import Link from "next/link";

import { useEditorStore, type WFNode } from "./store";
import { nodeVisual } from "@/xoffice/node-visuals";
import { ApprovalConfig } from "./inspector/ApprovalConfig";
import { ConditionBuilder } from "./inspector/ConditionBuilder";
import { MappingEditor } from "./inspector/MappingEditor";
import { inputClass, labelClass, btnPrimary } from "./inspector/ui";

// --- Generic form for the remaining node types ------------------------------
function GenericConfig({ node, code }: { node: WFNode; code: string }) {
  const updateNode = useEditorStore((s) => s.updateNode);
  const type = node.data.nodeType;
  const c = node.data.config as Record<string, unknown>;

  const [name, setName] = useState(node.data.name);
  const [formCode, setFormCode] = useState(String(c.formCode ?? ""));
  const [duration, setDuration] = useState(String(c.duration ?? ""));
  const [channels, setChannels] = useState(
    Array.isArray(c.channels) ? (c.channels as string[]).join(", ") : "",
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const cfg = node.data.config as Record<string, unknown>;
    setName(node.data.name);
    setFormCode(String(cfg.formCode ?? ""));
    setDuration(String(cfg.duration ?? ""));
    setChannels(Array.isArray(cfg.channels) ? (cfg.channels as string[]).join(", ") : "");
  }, [node]);

  const save = () => {
    const config: Record<string, unknown> = { ...(node.data.config as object) };
    if (type === "form") config.formCode = formCode;
    if (type === "timer") config.duration = duration;
    if (type === "notification") {
      config.channels = channels.split(",").map((s) => s.trim()).filter(Boolean);
    }
    updateNode(node.id, { name, config });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Tên node</label>
        <input className={inputClass} value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
      </div>

      {type === "form" && (
        <div>
          <label className={labelClass}>Mã biểu mẫu</label>
          <input className={inputClass} placeholder="FORM-PROCUREMENT" value={formCode} onChange={(e) => { setFormCode(e.target.value); setSaved(false); }} />
          <Link href={`/office/workflows/${code}/form`} className="mt-1.5 inline-block text-tiny text-primary-600 hover:underline dark:text-primary-400">
            Mở trình thiết kế biểu mẫu →
          </Link>
        </div>
      )}

      {type === "timer" && (
        <div>
          <label className={labelClass}>Thời lượng (ISO 8601)</label>
          <input className={inputClass} placeholder="PT8H" value={duration} onChange={(e) => { setDuration(e.target.value); setSaved(false); }} />
        </div>
      )}

      {type === "notification" && (
        <div>
          <label className={labelClass}>Kênh (phân tách bằng dấu phẩy)</label>
          <input className={inputClass} placeholder="in_app, xspace, email" value={channels} onChange={(e) => { setChannels(e.target.value); setSaved(false); }} />
        </div>
      )}

      {!["form", "timer", "notification"].includes(type) && (
        <p className="rounded-lg bg-gray-50 px-2.5 py-2 text-tiny text-gray-400 dark:bg-dark-700">
          Node loại “{type}” không có cấu hình bổ sung ở bản này.
        </p>
      )}

      <button className={btnPrimary} onClick={save}>
        {saved ? "Đã cập nhật ✓" : "Cập nhật"}
      </button>
    </div>
  );
}

export function Inspector({ code = "" }: { code?: string }) {
  const selectedId = useEditorStore((s) => s.selectedNodeId);
  const nodes = useEditorStore((s) => s.nodes);

  const node = useMemo(() => nodes.find((n) => n.id === selectedId), [nodes, selectedId]);

  if (!node) {
    return (
      <aside className="flex w-72 shrink-0 flex-col items-center justify-center border-l border-gray-200 bg-gray-50/60 p-6 text-center dark:border-dark-600 dark:bg-dark-800">
        <span className="text-2xl" aria-hidden>👆</span>
        <p className="mt-2 text-sm font-medium text-gray-600 dark:text-dark-200">Chọn một node</p>
        <p className="mt-1 text-tiny text-gray-400">Nhấp vào node trên canvas để chỉnh thuộc tính.</p>
      </aside>
    );
  }

  const type = node.data.nodeType;
  const v = nodeVisual(type);

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-gray-200 bg-white dark:border-dark-600 dark:bg-dark-800">
      <div className={clsx("flex items-center gap-2 border-b border-gray-200 px-3 py-2.5 dark:border-dark-600", v.headerBg)}>
        <span aria-hidden>{v.emoji}</span>
        <span className={clsx("text-xs-plus font-semibold", v.text)}>Thuộc tính node</span>
      </div>

      <div className="hide-scrollbar flex-1 overflow-y-auto p-3">
        <p className="mb-3 font-mono text-tiny text-gray-400">{node.id}</p>
        {type === "approval" || type === "humanTask" ? (
          <ApprovalConfig node={node} />
        ) : type === "condition" ? (
          <ConditionBuilder node={node} />
        ) : type === "serviceCall" ? (
          <MappingEditor node={node} />
        ) : (
          <GenericConfig node={node} code={code} />
        )}
      </div>
    </aside>
  );
}
