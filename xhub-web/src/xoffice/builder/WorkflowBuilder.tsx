"use client";

// X.Office workflow builder shell (WF-02): React Flow canvas + dnd-kit palette
// + inspector + toolbar (undo/redo, save, auto-layout, validate, AI).
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type ReactFlowInstance,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import clsx from "clsx";

import { useEditorStore, saveToLocal, loadFromLocal, type WFNode } from "./store";
import { WorkflowNodeView } from "./WorkflowNodeView";
import { Palette } from "./Palette";
import { Inspector } from "./Inspector";
import { autoLayout } from "./layout";
import { validateWorkflow, type ValidationOutcome } from "./validation";
import {
  requestAiDraft,
  applyPatchToDocument,
  describeOperation,
  type WorkflowPatchSet,
} from "./ai-client";
import { simulateWorkflow, type SimulationResult } from "./simulate";
import { publishWorkflow, type PublishResult } from "./publish";
import Link from "next/link";
import type { WorkflowDefinitionDocument, NodeCatalogEntry } from "@/xoffice/workflow-types";
import type { WorkflowNodeType } from "@/xoffice/node-types";

const nodeTypes: NodeTypes = { workflow: WorkflowNodeView };

interface Props {
  definition: WorkflowDefinitionDocument;
  catalog: NodeCatalogEntry[];
  source: "api" | "seed";
  openAiInitially?: boolean;
}

function Toolbar({
  code,
  onValidate,
  onSimulate,
  onLayout,
  onSave,
  onToggleAi,
  onPublish,
  saved,
  validating,
}: {
  code: string;
  onValidate: () => void;
  onSimulate: () => void;
  onLayout: () => void;
  onSave: () => void;
  onToggleAi: () => void;
  onPublish: () => void;
  saved: boolean;
  validating: boolean;
}) {
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const deleteSelected = useEditorStore((s) => s.deleteSelected);
  const hasSelection = useEditorStore((s) => Boolean(s.selectedNodeId));

  const btn =
    "inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs-plus font-medium text-gray-600 transition enabled:hover:bg-gray-100 disabled:opacity-40 dark:border-dark-500 dark:bg-dark-700 dark:text-dark-100 dark:enabled:hover:bg-dark-600";

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-200 bg-white px-3 py-2 dark:border-dark-600 dark:bg-dark-800">
      <button className={btn} onClick={undo} disabled={!canUndo}>↶ Hoàn tác</button>
      <button className={btn} onClick={redo} disabled={!canRedo}>↷ Làm lại</button>
      <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-dark-500" />
      <button className={btn} onClick={deleteSelected} disabled={!hasSelection}>🗑 Xoá node</button>
      <button className={btn} onClick={onLayout}>⤢ Tự sắp xếp</button>
      <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-dark-500" />
      <button className={btn} onClick={onValidate} disabled={validating}>
        {validating ? "Đang kiểm tra…" : "✓ Validate"}
      </button>
      <button className={btn} onClick={onSimulate}>▶ Mô phỏng</button>
      <button
        className={clsx(btn, "!border-primary-300 !text-primary-600 dark:!text-primary-400")}
        onClick={onToggleAi}
      >
        ✨ AI
      </button>
      <Link className={btn} href={`/office/workflows/${code}/form`}>📝 Biểu mẫu</Link>
      <Link className={btn} href={`/office/workflows/${code}/versions`}>🗂 Phiên bản</Link>
      <div className="ml-auto flex items-center gap-2">
        {saved && <span className="text-tiny text-success-600 dark:text-success-400">Đã lưu ✓</span>}
        <button
          className="inline-flex h-8 items-center rounded-lg border border-primary-300 px-3 text-xs-plus font-medium text-primary-600 transition hover:bg-primary-600/10 dark:border-primary-900 dark:text-primary-400"
          onClick={onPublish}
        >
          🚀 Publish
        </button>
        <button
          className="inline-flex h-8 items-center rounded-lg bg-primary-600 px-3 text-xs-plus font-medium text-white transition hover:bg-primary-700"
          onClick={onSave}
        >
          💾 Lưu
        </button>
      </div>
    </div>
  );
}

function Canvas({ children }: { children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: "canvas" });
  return (
    <div ref={setNodeRef} className="relative min-w-0 flex-1">
      {children}
    </div>
  );
}

function BuilderInner({ definition, catalog, source, openAiInitially }: Props) {
  const load = useEditorStore((s) => s.load);
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const onNodesChange = useEditorStore((s) => s.onNodesChange);
  const onEdgesChange = useEditorStore((s) => s.onEdgesChange);
  const onConnect = useEditorStore((s) => s.onConnect);
  const selectNode = useEditorStore((s) => s.selectNode);
  const addNode = useEditorStore((s) => s.addNode);
  const setGraph = useEditorStore((s) => s.setGraph);
  const applyDocument = useEditorStore((s) => s.applyDocument);
  const toDocument = useEditorStore((s) => s.toDocument);

  const rfRef = useRef<ReactFlowInstance<WFNode> | null>(null);
  const { screenToFlowPosition } = useReactFlow();

  const [saved, setSaved] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationOutcome | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [showAi, setShowAi] = useState(Boolean(openAiInitially));
  const [showSim, setShowSim] = useState(false);
  const [simHighlight, setSimHighlight] = useState<string[]>([]);
  const [showPublish, setShowPublish] = useState(false);
  // Render the dnd-kit / React Flow tree only after mount — dnd-kit's draggable
  // aria ids are non-deterministic between SSR and client, so SSR-ing them
  // causes a hydration mismatch. The builder is a client-only tool anyway.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Load definition once (prefer a locally-saved draft if present).
  useEffect(() => {
    const draft = loadFromLocal(definition.metadata.code);
    load(draft ?? definition);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition.metadata.code]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (event.over?.id !== "canvas") return;
      const data = event.active.data.current as
        | { paletteType: WorkflowNodeType; name: string }
        | undefined;
      if (!data) return;
      const activator = event.activatorEvent as PointerEvent;
      const clientX = (activator?.clientX ?? 0) + event.delta.x;
      const clientY = (activator?.clientY ?? 0) + event.delta.y;
      const position = screenToFlowPosition({ x: clientX, y: clientY });
      addNode(data.paletteType, data.name, position);
    },
    [addNode, screenToFlowPosition],
  );

  const handleSave = useCallback(() => {
    saveToLocal(definition.metadata.code, toDocument());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [definition.metadata.code, toDocument]);

  const handleLayout = useCallback(async () => {
    const laid = await autoLayout(nodes, edges);
    setGraph(laid, edges);
    setTimeout(() => rfRef.current?.fitView({ padding: 0.15 }), 30);
  }, [nodes, edges, setGraph]);

  const handleValidate = useCallback(async () => {
    setValidating(true);
    setShowValidation(true);
    const result = await validateWorkflow(definition.metadata.code, toDocument());
    setValidation(result);
    setValidating(false);
  }, [definition.metadata.code, toDocument]);

  // WF-03: human-confirmed apply of an AI patch set, then auto-layout.
  const handleApplyPatch = useCallback(
    async (patch: WorkflowPatchSet) => {
      const current = toDocument();
      const { document } = applyPatchToDocument(current, patch.operations);
      applyDocument(document);
      const laid = await autoLayout(
        useEditorStore.getState().nodes,
        useEditorStore.getState().edges,
      );
      setGraph(laid, useEditorStore.getState().edges);
      setTimeout(() => rfRef.current?.fitView({ padding: 0.15 }), 40);
    },
    [toDocument, applyDocument, setGraph],
  );

  if (!mounted) {
    return (
      <div className="flex h-[calc(100vh-8.5rem)] min-h-[540px] items-center justify-center rounded-xl border border-gray-200 bg-white text-sm text-gray-400 dark:border-dark-600 dark:bg-dark-900 dark:text-dark-300">
        Đang tải trình thiết kế quy trình…
      </div>
    );
  }

  return (
    <DndContext id="xoffice-workflow-dnd" sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex h-[calc(100vh-8.5rem)] min-h-[540px] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-dark-600 dark:bg-dark-900">
        <Palette catalog={catalog} />

        <div className="flex min-w-0 flex-1 flex-col">
          <Toolbar
            code={definition.metadata.code}
            onValidate={handleValidate}
            onSimulate={() => setShowSim((v) => !v)}
            onLayout={handleLayout}
            onSave={handleSave}
            onToggleAi={() => setShowAi((v) => !v)}
            onPublish={() => setShowPublish(true)}
            saved={saved}
            validating={validating}
          />

          <div className="flex min-h-0 flex-1">
            <Canvas>
              <ReactFlow
                onInit={(inst) => {
                  rfRef.current = inst as ReactFlowInstance<WFNode>;
                }}
                nodes={
                  simHighlight.length === 0
                    ? nodes
                    : nodes.map((n) => ({
                        ...n,
                        className: simHighlight.includes(n.id)
                          ? "drop-shadow-[0_0_0_2px_var(--color-info)]"
                          : "opacity-40",
                      }))
                }
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={(_, n) => selectNode(n.id)}
                onPaneClick={() => selectNode(null)}
                fitView
                fitViewOptions={{ padding: 0.15 }}
                proOptions={{ hideAttribution: true }}
                className="bg-gray-50 dark:bg-dark-800"
              >
                <Background gap={16} className="text-gray-200 dark:text-dark-600" />
                <Controls className="!shadow-soft" />
                <MiniMap
                  pannable
                  zoomable
                  className="!bg-white dark:!bg-dark-700"
                  maskColor="rgba(0,0,0,0.06)"
                />
              </ReactFlow>

              {showValidation && (
                <ValidationOverlay
                  outcome={validation}
                  validating={validating}
                  onClose={() => setShowValidation(false)}
                />
              )}
              {showAi && (
                <AiOverlay
                  source={source}
                  toDocument={toDocument}
                  onApply={handleApplyPatch}
                  onClose={() => setShowAi(false)}
                />
              )}
              {showSim && (
                <SimulationOverlay
                  code={definition.metadata.code}
                  toDocument={toDocument}
                  onHighlight={setSimHighlight}
                  onClose={() => {
                    setShowSim(false);
                    setSimHighlight([]);
                  }}
                />
              )}
              {showPublish && (
                <PublishOverlay
                  code={definition.metadata.code}
                  toDocument={toDocument}
                  onClose={() => setShowPublish(false)}
                />
              )}
            </Canvas>

            <Inspector code={definition.metadata.code} />
          </div>
        </div>
      </div>
    </DndContext>
  );
}

function ValidationOverlay({
  outcome,
  validating,
  onClose,
}: {
  outcome: ValidationOutcome | null;
  validating: boolean;
  onClose: () => void;
}) {
  const tone: Record<string, string> = {
    error: "border-error/40 bg-error/5 text-error",
    warning: "border-warning/40 bg-warning/5 text-warning",
    info: "border-info/40 bg-info/5 text-info",
  };
  return (
    <div className="absolute bottom-3 left-3 z-10 w-80 rounded-xl border border-gray-200 bg-white shadow-soft dark:border-dark-600 dark:bg-dark-700">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-dark-600">
        <p className="text-xs-plus font-semibold text-gray-700 dark:text-dark-100">
          Kết quả kiểm tra
        </p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Đóng">
          ✕
        </button>
      </div>
      <div className="max-h-56 space-y-1.5 overflow-y-auto p-3">
        {validating ? (
          <p className="text-tiny text-gray-400">Đang kiểm tra…</p>
        ) : !outcome ? (
          <p className="text-tiny text-gray-400">Chưa có kết quả.</p>
        ) : (
          <>
            <p className="text-tiny text-gray-400">
              Nguồn: {outcome.source === "api" ? "backend" : "kiểm tra cục bộ (backend chưa sẵn sàng)"}
              {" · "}
              {outcome.ok ? "Hợp lệ ✓" : "Có lỗi"}
            </p>
            {outcome.issues.length === 0 ? (
              <p className="rounded-lg border border-success-500/40 bg-success-500/5 px-2.5 py-1.5 text-tiny text-success-600 dark:text-success-400">
                Không phát hiện vấn đề.
              </p>
            ) : (
              outcome.issues.map((issue, i) => (
                <div key={i} className={clsx("rounded-lg border px-2.5 py-1.5 text-tiny", tone[issue.severity])}>
                  {issue.message}
                  {issue.nodeId ? <span className="opacity-60"> ({issue.nodeId})</span> : null}
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

const OP_TONE: Record<string, string> = {
  add: "border-success-500/40 bg-success-500/5 text-success-600 dark:text-success-400",
  replace: "border-warning/40 bg-warning/5 text-warning",
  remove: "border-error/40 bg-error/5 text-error",
  move: "border-info/40 bg-info/5 text-info",
};
const OP_LABEL: Record<string, string> = {
  add: "Thêm",
  replace: "Sửa",
  remove: "Xoá",
  move: "Chuyển",
};

// WF-03 — AI copilot panel. Draft-first + preview/diff + human confirm.
function AiOverlay({
  source,
  toDocument,
  onApply,
  onClose,
}: {
  source: "api" | "seed";
  toDocument: () => WorkflowDefinitionDocument;
  onApply: (patch: WorkflowPatchSet) => Promise<void>;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patch, setPatch] = useState<WorkflowPatchSet | null>(null);

  const handleDraft = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setPatch(null);
    try {
      const result = await requestAiDraft(prompt.trim(), toDocument());
      setPatch(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không gọi được AI tool gateway.");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!patch) return;
    setApplying(true);
    try {
      await onApply(patch);
      setPatch(null);
      setPrompt("");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="absolute right-3 top-3 z-10 flex max-h-[calc(100%-1.5rem)] w-96 flex-col rounded-xl border border-primary-300 bg-white shadow-soft dark:border-primary-900 dark:bg-dark-700">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-dark-600">
        <p className="text-xs-plus font-semibold text-primary-600 dark:text-primary-400">
          ✨ Trợ lý AI quy trình (WF-03)
        </p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Đóng">
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="h-20 w-full resize-none rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100"
          placeholder="Ví dụ: Thêm bước phê duyệt Tổng Giám đốc khi số tiền trên 200 triệu…"
        />
        <button
          onClick={handleDraft}
          disabled={loading || !prompt.trim()}
          className="w-full rounded-lg bg-primary-600 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Đang tạo bản nháp…" : "Tạo bản nháp"}
        </button>

        {source === "seed" && (
          <p className="text-tiny text-warning">
            Backend :4000 chưa xác nhận online — nếu lỗi hãy khởi động X.Office API.
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-error/40 bg-error/5 px-2.5 py-1.5 text-tiny text-error">
            {error}
          </p>
        )}

        {patch && (
          <div className="space-y-2.5 rounded-lg border border-gray-200 bg-gray-50 p-2.5 dark:border-dark-500 dark:bg-dark-800">
            <p className="text-xs-plus font-semibold text-gray-700 dark:text-dark-100">
              {patch.summary}
            </p>

            <div>
              <p className="mb-1 text-tiny font-medium uppercase tracking-wide text-gray-400">
                Thay đổi đề xuất ({patch.operations.length})
              </p>
              <div className="space-y-1">
                {patch.operations.map((op, i) => (
                  <div
                    key={i}
                    className={clsx(
                      "rounded-md border px-2 py-1 text-tiny",
                      OP_TONE[op.op] ?? OP_TONE.add,
                    )}
                  >
                    <span className="font-semibold">{OP_LABEL[op.op] ?? op.op}</span>{" "}
                    {describeOperation(op)}
                  </div>
                ))}
              </div>
            </div>

            {patch.assumptions.length > 0 && (
              <div>
                <p className="mb-1 text-tiny font-medium uppercase tracking-wide text-gray-400">
                  Giả định
                </p>
                <ul className="list-disc space-y-0.5 pl-4 text-tiny text-gray-600 dark:text-dark-200">
                  {patch.assumptions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}

            {patch.evidence.length > 0 && (
              <div>
                <p className="mb-1 text-tiny font-medium uppercase tracking-wide text-gray-400">
                  Căn cứ
                </p>
                <div className="flex flex-wrap gap-1">
                  {patch.evidence.map((e, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-gray-150 px-2 py-0.5 text-tiny text-gray-600 dark:bg-dark-500 dark:text-dark-100"
                      title={`${e.sourceType}: ${e.sourceId}`}
                    >
                      {e.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p className="rounded-md bg-primary-600/10 px-2 py-1 text-tiny text-primary-700 dark:text-primary-300">
              X.AI đề xuất — bạn xác nhận trước khi áp dụng. Không tự động ghi.
            </p>

            <div className="flex gap-2">
              <button
                onClick={handleApply}
                disabled={applying}
                className="flex-1 rounded-lg bg-primary-600 py-1.5 text-xs-plus font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
              >
                {applying ? "Đang áp dụng…" : "Áp dụng"}
              </button>
              <button
                onClick={() => setPatch(null)}
                className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs-plus font-medium text-gray-600 transition hover:bg-gray-100 dark:border-dark-500 dark:text-dark-100 dark:hover:bg-dark-600"
              >
                Bỏ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// WF-07 — Simulation panel: run test data through the workflow and trace path.
function SimulationOverlay({
  code,
  toDocument,
  onHighlight,
  onClose,
}: {
  code: string;
  toDocument: () => WorkflowDefinitionDocument;
  onHighlight: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [testData, setTestData] = useState('{\n  "request": {\n    "amount": 250000000\n  }\n}');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    let parsed: unknown = {};
    try {
      parsed = testData.trim() ? JSON.parse(testData) : {};
    } catch {
      setError("Test data không phải JSON hợp lệ.");
      setRunning(false);
      return;
    }
    try {
      const res = await simulateWorkflow(code, toDocument(), parsed);
      setResult(res);
      onHighlight(res.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mô phỏng thất bại.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="absolute bottom-3 right-3 z-10 flex max-h-[calc(100%-1.5rem)] w-96 flex-col rounded-xl border border-info/40 bg-white shadow-soft dark:border-info/40 dark:bg-dark-700">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-dark-600">
        <p className="text-xs-plus font-semibold text-info dark:text-info">▶ Mô phỏng (WF-07)</p>
        <button
          onClick={() => {
            onHighlight([]);
            onClose();
          }}
          className="text-gray-400 hover:text-gray-600"
          aria-label="Đóng"
        >
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        <label className="text-tiny font-medium uppercase tracking-wide text-gray-400">
          Test data (JSON)
        </label>
        <textarea
          value={testData}
          onChange={(e) => setTestData(e.target.value)}
          spellCheck={false}
          className="h-28 w-full resize-none rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 font-mono text-tiny dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100"
        />
        <button
          onClick={handleRun}
          disabled={running}
          className="w-full rounded-lg bg-info py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {running ? "Đang mô phỏng…" : "Mô phỏng"}
        </button>

        {error && (
          <p className="rounded-lg border border-error/40 bg-error/5 px-2.5 py-1.5 text-tiny text-error">
            {error}
          </p>
        )}

        {result && (
          <div className="space-y-2">
            <p
              className={clsx(
                "rounded-lg px-2.5 py-1.5 text-tiny font-medium",
                result.reachedEnd
                  ? "bg-success-500/10 text-success-600 dark:text-success-400"
                  : "bg-warning/10 text-warning",
              )}
            >
              {result.reachedEnd
                ? "✓ Đường đi tới node Kết thúc."
                : "⚠ Chưa tới được node Kết thúc."}
            </p>
            <ol className="space-y-1">
              {result.steps.map((s, i) => (
                <li
                  key={`${s.nodeId}-${i}`}
                  className="flex items-start gap-2 rounded-md border border-gray-200 px-2 py-1 text-tiny dark:border-dark-500"
                >
                  <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-info/15 text-[10px] font-semibold text-info">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="font-medium text-gray-700 dark:text-dark-100">{s.name}</span>
                    <span className="ml-1 text-gray-400">({s.nodeId})</span>
                    <span className="block text-gray-500 dark:text-dark-300">→ {s.outcome}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

// WF-09 — Publish & deployment. Impact summary + publish → version + checksum.
function PublishOverlay({
  code,
  toDocument,
  onClose,
}: {
  code: string;
  toDocument: () => WorkflowDefinitionDocument;
  onClose: () => void;
}) {
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);
  const doc = toDocument();
  const approvals = doc.nodes.filter((n) => n.type === "approval" || n.type === "humanTask").length;
  const services = doc.nodes.filter((n) => n.type === "serviceCall").length;

  const handlePublish = async () => {
    setPublishing(true);
    try {
      setResult(await publishWorkflow(code, doc));
    } finally {
      setPublishing(false);
    }
  };

  const row = "flex items-center justify-between text-tiny";
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 p-4">
      <div className="w-96 rounded-xl border border-gray-200 bg-white shadow-soft dark:border-dark-600 dark:bg-dark-700">
        <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-dark-600">
          <p className="text-xs-plus font-semibold text-gray-700 dark:text-dark-100">🚀 Publish quy trình (WF-09)</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Đóng">✕</button>
        </div>
        <div className="space-y-3 p-3">
          {!result ? (
            <>
              <div className="space-y-1.5 rounded-lg bg-gray-50 p-3 dark:bg-dark-800">
                <p className="mb-1 text-tiny font-semibold uppercase tracking-wide text-gray-400">Tóm tắt ảnh hưởng</p>
                <div className={row}><span className="text-gray-500 dark:text-dark-300">Tổng số node</span><span className="font-medium text-gray-700 dark:text-dark-100">{doc.nodes.length}</span></div>
                <div className={row}><span className="text-gray-500 dark:text-dark-300">Bước phê duyệt</span><span className="font-medium text-gray-700 dark:text-dark-100">{approvals}</span></div>
                <div className={row}><span className="text-gray-500 dark:text-dark-300">Gọi hệ thống</span><span className="font-medium text-gray-700 dark:text-dark-100">{services}</span></div>
                <div className={row}><span className="text-gray-500 dark:text-dark-300">Chủ sở hữu</span><span className="font-mono text-gray-700 dark:text-dark-100">{doc.metadata.ownerRoleCode}</span></div>
              </div>
              <p className="rounded-md bg-warning/10 px-2 py-1 text-tiny text-warning">
                Version đã publish là bất biến (immutable). Xác nhận để tạo phiên bản mới.
              </p>
              <button onClick={handlePublish} disabled={publishing} className="w-full rounded-lg bg-primary-600 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50">
                {publishing ? "Đang publish…" : "Publish phiên bản mới"}
              </button>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-success-500/40 bg-success-500/5 p-3">
                <p className="text-sm font-semibold text-success-600 dark:text-success-400">✓ Đã publish</p>
                <div className={`${row} mt-2`}><span className="text-gray-500 dark:text-dark-300">Phiên bản</span><span className="font-medium text-gray-700 dark:text-dark-100">v{result.version}</span></div>
                <div className={`${row} mt-1`}><span className="text-gray-500 dark:text-dark-300">Checksum</span><span className="font-mono text-gray-700 dark:text-dark-100">{result.checksum}</span></div>
                <div className={`${row} mt-1`}><span className="text-gray-500 dark:text-dark-300">Nguồn</span><span className="text-gray-700 dark:text-dark-100">{result.source === "api" ? "backend" : "cục bộ (offline)"}</span></div>
              </div>
              <Link href={`/office/workflows/${code}/versions`} className="block w-full rounded-lg border border-gray-200 py-2 text-center text-xs-plus font-medium text-gray-600 transition hover:bg-gray-100 dark:border-dark-500 dark:text-dark-100 dark:hover:bg-dark-600">
                Xem lịch sử phiên bản →
              </Link>
              <button onClick={onClose} className="w-full rounded-lg bg-primary-600 py-2 text-sm font-medium text-white transition hover:bg-primary-700">Đóng</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function WorkflowBuilder(props: Props) {
  return (
    <ReactFlowProvider>
      <BuilderInner {...props} />
    </ReactFlowProvider>
  );
}
