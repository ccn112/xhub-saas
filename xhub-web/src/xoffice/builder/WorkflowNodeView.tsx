"use client";

// Custom React Flow node rendered with Tailux tokens. Color + emoji come from
// the shared node-visuals map so palette and canvas stay consistent.
import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import clsx from "clsx";

import { nodeVisual } from "@/xoffice/node-visuals";
import type { WorkflowNodeType } from "@/xoffice/node-types";

const typeLabel: Record<WorkflowNodeType, string> = {
  start: "Bắt đầu",
  end: "Kết thúc",
  approval: "Phê duyệt",
  humanTask: "Xử lý",
  form: "Biểu mẫu",
  condition: "Điều kiện",
  parallelSplit: "Tách song song",
  parallelJoin: "Gộp song song",
  timer: "Hẹn giờ",
  notification: "Thông báo",
  serviceCall: "Gọi hệ thống",
  subflow: "Quy trình con",
  aiAssist: "AI hỗ trợ",
};

function WorkflowNodeViewImpl({ data, selected }: NodeProps) {
  const d = data as { nodeType: WorkflowNodeType; name: string };
  const v = nodeVisual(d.nodeType);
  const isStart = d.nodeType === "start";
  const isEnd = d.nodeType === "end";

  return (
    <div
      className={clsx(
        "w-[210px] rounded-xl border bg-white shadow-soft dark:bg-dark-700",
        v.ring,
        selected && "ring-2 ring-primary-500 ring-offset-1 dark:ring-offset-dark-900",
      )}
    >
      {!isStart && (
        <Handle
          type="target"
          position={Position.Left}
          className="!size-2.5 !border-2 !border-white !bg-primary-500 dark:!border-dark-700"
        />
      )}
      <div className={clsx("flex items-center gap-2 rounded-t-xl px-3 py-1.5", v.headerBg)}>
        <span className="text-base" aria-hidden>
          {v.emoji}
        </span>
        <span className={clsx("text-tiny font-semibold uppercase tracking-wide", v.text)}>
          {typeLabel[d.nodeType] ?? d.nodeType}
        </span>
      </div>
      <div className="px-3 py-2">
        <p className="line-clamp-2 text-xs-plus font-medium text-gray-800 dark:text-dark-100">
          {d.name}
        </p>
      </div>
      {!isEnd && (
        <Handle
          type="source"
          position={Position.Right}
          className="!size-2.5 !border-2 !border-white !bg-primary-500 dark:!border-dark-700"
        />
      )}
    </div>
  );
}

export const WorkflowNodeView = memo(WorkflowNodeViewImpl);
