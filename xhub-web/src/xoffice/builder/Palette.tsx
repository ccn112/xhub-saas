"use client";

// Left palette: node catalog grouped by category. Each item is a @dnd-kit
// draggable; dropping onto the canvas adds a node (handled in WorkflowBuilder).
import { useMemo } from "react";
import { useDraggable } from "@dnd-kit/core";
import clsx from "clsx";

import { nodeVisual } from "@/xoffice/node-visuals";
import type { NodeCatalogEntry } from "@/xoffice/workflow-types";

function PaletteItem({ entry }: { entry: NodeCatalogEntry }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${entry.type}`,
    data: { paletteType: entry.type, name: entry.name },
  });
  const v = nodeVisual(entry.type);

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      title={entry.description}
      className={clsx(
        "flex w-full cursor-grab items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-left transition hover:border-primary-300 hover:shadow-soft active:cursor-grabbing dark:border-dark-600 dark:bg-dark-700",
        isDragging && "opacity-40",
      )}
    >
      <span className={clsx("size-2 shrink-0 rounded-full", v.dot)} aria-hidden />
      <span className="text-sm" aria-hidden>
        {v.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs-plus font-medium text-gray-700 dark:text-dark-100">
          {entry.name}
        </span>
      </span>
    </button>
  );
}

export function Palette({ catalog }: { catalog: NodeCatalogEntry[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, NodeCatalogEntry[]>();
    for (const entry of catalog) {
      const arr = map.get(entry.category) ?? [];
      arr.push(entry);
      map.set(entry.category, arr);
    }
    return [...map.entries()];
  }, [catalog]);

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-gray-50/60 dark:border-dark-600 dark:bg-dark-800">
      <div className="border-b border-gray-200 px-3 py-2.5 dark:border-dark-600">
        <p className="text-xs-plus font-semibold text-gray-700 dark:text-dark-100">
          Thư viện node
        </p>
        <p className="text-tiny text-gray-400">Kéo vào canvas để thêm</p>
      </div>
      <div className="hide-scrollbar flex-1 space-y-3 overflow-y-auto p-3">
        {groups.map(([category, entries]) => (
          <div key={category} className="space-y-1.5">
            <p className="text-tiny font-semibold uppercase tracking-wide text-gray-400">
              {category}
            </p>
            <div className="space-y-1.5">
              {entries.map((entry) => (
                <PaletteItem key={entry.type} entry={entry} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
