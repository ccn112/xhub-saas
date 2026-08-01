"use client";

// Zustand editor store for the X.Office workflow builder.
// Holds React Flow nodes/edges + selection + undo/redo history.
// Canvas x/y is presentation only; the canonical DSL is rebuilt on save/export.
import { create } from "zustand";
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  MarkerType,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from "@xyflow/react";

import type { WorkflowNodeType } from "@/xoffice/node-types";
import type {
  WorkflowDefinitionDocument,
  WorkflowMetadata,
} from "@/xoffice/workflow-types";

export interface WFNodeData extends Record<string, unknown> {
  nodeType: WorkflowNodeType;
  name: string;
  config: Record<string, unknown>;
}

export type WFNode = Node<WFNodeData>;
export type WFEdge = Edge;

interface Snapshot {
  nodes: WFNode[];
  edges: WFEdge[];
}

interface EditorState {
  code: string;
  metadata: WorkflowMetadata | null;
  nodes: WFNode[];
  edges: WFEdge[];
  selectedNodeId: string | null;
  past: Snapshot[];
  future: Snapshot[];
  dirty: boolean;
  seq: number;

  // lifecycle
  load: (def: WorkflowDefinitionDocument) => void;

  // react-flow handlers
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (conn: Connection) => void;

  // mutations (history-tracked)
  addNode: (type: WorkflowNodeType, name: string, position: { x: number; y: number }) => void;
  updateNode: (id: string, patch: { name?: string; config?: Record<string, unknown> }) => void;
  deleteSelected: () => void;
  updateEdgeLabel: (id: string, label: string) => void;
  selectNode: (id: string | null) => void;
  setGraph: (nodes: WFNode[], edges: WFEdge[]) => void;
  /** Replace the whole graph from a definition document (history-tracked). */
  applyDocument: (def: WorkflowDefinitionDocument) => void;

  // history
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // exports
  toDocument: () => WorkflowDefinitionDocument;
}

function connectionToEdge(conn: Connection): WFEdge {
  return {
    id: `e-${conn.source}-${conn.target}-${Math.random().toString(36).slice(2, 7)}`,
    source: conn.source,
    target: conn.target,
    sourceHandle: conn.sourceHandle ?? undefined,
    targetHandle: conn.targetHandle ?? undefined,
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
  };
}

function docToGraph(def: WorkflowDefinitionDocument): Snapshot {
  const nodes: WFNode[] = def.nodes.map((n) => ({
    id: n.id,
    type: "workflow",
    position: { x: n.position?.x ?? 0, y: n.position?.y ?? 0 },
    data: { nodeType: n.type, name: n.name, config: n.config ?? {} },
  }));
  const edges: WFEdge[] = def.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
  }));
  return { nodes, edges };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  code: "",
  metadata: null,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  past: [],
  future: [],
  dirty: false,
  seq: 0,

  load: (def) => {
    const { nodes, edges } = docToGraph(def);
    set({
      code: def.metadata.code,
      metadata: def.metadata,
      nodes,
      edges,
      selectedNodeId: null,
      past: [],
      future: [],
      dirty: false,
      seq: nodes.length,
    });
  },

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) as WFNode[] });
    // Mark dirty on position/removal changes without spamming history.
    if (changes.some((c) => c.type === "remove" || c.type === "position")) {
      set({ dirty: true });
    }
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) as WFEdge[] });
    if (changes.some((c) => c.type === "remove")) set({ dirty: true });
  },

  onConnect: (conn) => {
    const past = [...get().past, { nodes: get().nodes, edges: get().edges }];
    set({
      edges: addEdge(connectionToEdge(conn), get().edges) as WFEdge[],
      past,
      future: [],
      dirty: true,
    });
  },

  addNode: (type, name, position) => {
    const s = get();
    const past = [...s.past, { nodes: s.nodes, edges: s.edges }];
    const id = `${type}-${s.seq + 1}`;
    const node: WFNode = {
      id,
      type: "workflow",
      position,
      data: { nodeType: type, name, config: {} },
    };
    set({
      nodes: [...s.nodes, node],
      seq: s.seq + 1,
      selectedNodeId: id,
      past,
      future: [],
      dirty: true,
    });
  },

  updateNode: (id, patch) => {
    const s = get();
    const past = [...s.past, { nodes: s.nodes, edges: s.edges }];
    set({
      nodes: s.nodes.map((n) =>
        n.id === id
          ? {
              ...n,
              data: {
                ...n.data,
                name: patch.name ?? n.data.name,
                config: patch.config ?? n.data.config,
              },
            }
          : n,
      ),
      past,
      future: [],
      dirty: true,
    });
  },

  deleteSelected: () => {
    const s = get();
    if (!s.selectedNodeId) return;
    const id = s.selectedNodeId;
    const past = [...s.past, { nodes: s.nodes, edges: s.edges }];
    set({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: null,
      past,
      future: [],
      dirty: true,
    });
  },

  updateEdgeLabel: (id, label) => {
    const s = get();
    const past = [...s.past, { nodes: s.nodes, edges: s.edges }];
    set({
      edges: s.edges.map((e) => (e.id === id ? { ...e, label: label || undefined } : e)),
      past,
      future: [],
      dirty: true,
    });
  },

  selectNode: (id) => set({ selectedNodeId: id }),

  setGraph: (nodes, edges) => {
    const s = get();
    const past = [...s.past, { nodes: s.nodes, edges: s.edges }];
    set({ nodes, edges, past, future: [], dirty: true });
  },

  applyDocument: (def) => {
    const s = get();
    const past = [...s.past, { nodes: s.nodes, edges: s.edges }];
    const { nodes, edges } = docToGraph(def);
    set({
      nodes,
      edges,
      selectedNodeId: null,
      past,
      future: [],
      dirty: true,
      seq: Math.max(s.seq, nodes.length),
    });
  },

  undo: () => {
    const s = get();
    if (s.past.length === 0) return;
    const previous = s.past[s.past.length - 1];
    set({
      past: s.past.slice(0, -1),
      future: [{ nodes: s.nodes, edges: s.edges }, ...s.future],
      nodes: previous.nodes,
      edges: previous.edges,
      dirty: true,
    });
  },

  redo: () => {
    const s = get();
    if (s.future.length === 0) return;
    const next = s.future[0];
    set({
      future: s.future.slice(1),
      past: [...s.past, { nodes: s.nodes, edges: s.edges }],
      nodes: next.nodes,
      edges: next.edges,
      dirty: true,
    });
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  toDocument: () => {
    const s = get();
    const meta =
      s.metadata ??
      ({
        tenantSlug: "xtech",
        code: s.code,
        name: s.code,
        description: "",
        ownerRoleCode: "ROLE_PROCESS_ADMIN",
      } as WorkflowMetadata);
    return {
      schemaVersion: "1.0",
      metadata: meta,
      nodes: s.nodes.map((n) => ({
        id: n.id,
        type: n.data.nodeType,
        name: n.data.name,
        config: n.data.config,
        position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      })),
      edges: s.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: typeof e.label === "string" ? e.label : undefined,
      })),
      variables: [],
      forms: [],
    };
  },
}));

const storageKey = (code: string) => `xoffice.builder.${code}`;

export function saveToLocal(code: string, doc: WorkflowDefinitionDocument) {
  try {
    localStorage.setItem(storageKey(code), JSON.stringify(doc));
  } catch {
    /* ignore quota / SSR */
  }
}

export function loadFromLocal(code: string): WorkflowDefinitionDocument | null {
  try {
    const raw = localStorage.getItem(storageKey(code));
    return raw ? (JSON.parse(raw) as WorkflowDefinitionDocument) : null;
  } catch {
    return null;
  }
}
