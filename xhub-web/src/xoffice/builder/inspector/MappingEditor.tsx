"use client";

// ⭐ Data-driven MAPPING EDITOR (serviceCall node).
// Reads connector catalog (backend → seed fallback), NEVER hardcodes fields.
// Each targetField becomes a mapping row: source path + transform + required.
// Persists to node.config.mappings per the connector-mapping data shape.
import { useEffect, useMemo, useState } from "react";

import { useEditorStore, type WFNode } from "../store";
import { fetchConnectors, type Connector, type ConnectorAction } from "@/xoffice/lib/connectors";
import { inputClass, labelClass, btnPrimary, sectionLabel } from "./ui";

const TRANSFORMS = [
  { value: "none", label: "Không đổi" },
  { value: "toNumber", label: "→ Số" },
  { value: "toString", label: "→ Chuỗi" },
  { value: "join", label: "Nối mảng (join)" },
  { value: "constant", label: "Hằng số" },
];

interface MappingRow {
  target: string;
  source: string;
  transform: string;
  required: boolean;
}

import { XOFFICE_BASE_CLIENT as API_BASE } from "@/lib/api-base";

function configMappings(node: WFNode): MappingRow[] {
  const raw = (node.data.config as Record<string, unknown>).mappings;
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => {
    const r = m as Record<string, unknown>;
    return {
      target: String(r.target ?? ""),
      source: String(r.source ?? ""),
      transform: String(r.transform ?? "none"),
      required: Boolean(r.required),
    };
  });
}

/** Resolve a dot-path against an object (local payload preview fallback). */
function resolvePath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function applyTransform(value: unknown, transform: string, source: string): unknown {
  switch (transform) {
    case "toNumber":
      return Number(value);
    case "toString":
      return value == null ? "" : String(value);
    case "join":
      return Array.isArray(value) ? value.join(", ") : value;
    case "constant":
      return source;
    default:
      return value;
  }
}

export function MappingEditor({ node }: { node: WFNode }) {
  const updateNode = useEditorStore((s) => s.updateNode);
  const toDocument = useEditorStore((s) => s.toDocument);

  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [connSource, setConnSource] = useState<"api" | "seed">("seed");
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState(node.data.name);
  const [connectorCode, setConnectorCode] = useState(
    String((node.data.config as Record<string, unknown>).connectorCode ?? ""),
  );
  const [actionCode, setActionCode] = useState(
    String((node.data.config as Record<string, unknown>).actionCode ?? ""),
  );
  const [rows, setRows] = useState<MappingRow[]>(() => configMappings(node));
  const [saved, setSaved] = useState(false);

  const [showPayload, setShowPayload] = useState(false);
  const [testData, setTestData] = useState('{\n  "request": { "title": "Mua thiết bị", "amount": 250000000 },\n  "requesterEmail": "nguoi.gui@xtech.com.vn"\n}');
  const [payload, setPayload] = useState<string | null>(null);
  const [payloadSource, setPayloadSource] = useState<"api" | "local" | null>(null);
  const [payloadErr, setPayloadErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchConnectors().then(({ connectors: list, source }) => {
      if (!alive) return;
      setConnectors(list);
      setConnSource(source);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    setName(node.data.name);
    const c = node.data.config as Record<string, unknown>;
    setConnectorCode(String(c.connectorCode ?? ""));
    setActionCode(String(c.actionCode ?? ""));
    setRows(configMappings(node));
  }, [node]);

  const connector = connectors.find((c) => c.code === connectorCode);
  const action: ConnectorAction | undefined = connector?.actions.find((a) => a.code === actionCode);

  // Sync rows to the selected action's targetFields (keep existing sources).
  const syncedRows = useMemo(() => {
    if (!action) return rows;
    return action.targetFields.map((f) => {
      const existing = rows.find((r) => r.target === f.key);
      return existing
        ? { ...existing, required: Boolean(f.required) }
        : { target: f.key, source: "", transform: "none", required: Boolean(f.required) };
    });
  }, [action, rows]);

  const missingRequired = syncedRows.filter((r) => r.required && !r.source.trim());

  const setRow = (target: string, patch: Partial<MappingRow>) => {
    setRows((prev) => {
      const base = syncedRows.map((r) => (r.target === target ? { ...r, ...patch } : r));
      return base;
    });
    setSaved(false);
  };

  const removeRow = (target: string) => {
    setRows(syncedRows.filter((r) => r.target !== target));
    setSaved(false);
  };

  const onSelectConnector = (code: string) => {
    setConnectorCode(code);
    setActionCode("");
    setRows([]);
    setSaved(false);
  };

  const onSelectAction = (code: string) => {
    setActionCode(code);
    setRows([]); // syncedRows will seed from targetFields
    setSaved(false);
  };

  const save = () => {
    const mappings = syncedRows
      .filter((r) => r.source.trim() || r.required)
      .map((r) => {
        const m: Record<string, unknown> = { target: r.target, source: r.source };
        if (r.transform && r.transform !== "none") m.transform = r.transform;
        if (r.required) m.required = true;
        return m;
      });
    const config: Record<string, unknown> = {
      ...(node.data.config as object),
      connectorCode,
      actionCode,
      mappings,
    };
    updateNode(node.id, { name, config });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const previewPayload = async () => {
    setPayloadErr(null);
    let parsedTest: unknown = {};
    try {
      parsedTest = testData.trim() ? JSON.parse(testData) : {};
    } catch {
      setPayloadErr("Test data không phải JSON hợp lệ.");
      return;
    }
    // 1) Try backend /simulate — it may return a resolved payload per node.
    try {
      const res = await fetch(
        `${API_BASE}/api/xoffice/workflows/${encodeURIComponent(node.data.config && (node.data.config as Record<string, unknown>).workflowCode ? String((node.data.config as Record<string, unknown>).workflowCode) : "preview")}/simulate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ definition: toDocument(), testData: parsedTest }),
          signal: AbortSignal.timeout(4000),
        },
      );
      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        const found = findNodePayload(data, node.id);
        if (found !== undefined) {
          setPayload(JSON.stringify(found, null, 2));
          setPayloadSource("api");
          return;
        }
      }
    } catch {
      /* fall through to local resolve */
    }
    // 2) Local resolve from mappings (always works — data-driven).
    const resolved: Record<string, unknown> = {};
    for (const r of syncedRows) {
      if (!r.source.trim()) continue;
      const raw = r.transform === "constant" ? r.source : resolvePath(parsedTest, r.source);
      resolved[r.target] = applyTransform(raw, r.transform, r.source);
    }
    setPayload(JSON.stringify(resolved, null, 2));
    setPayloadSource("local");
  };

  if (loading) {
    return <p className="text-tiny text-gray-400">Đang tải danh mục connector…</p>;
  }

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Tên node</label>
        <input className={inputClass} value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
      </div>

      <p className="text-tiny text-gray-400">
        Nguồn connector: {connSource === "api" ? "backend" : "seed (offline)"}
      </p>

      <div>
        <label className={labelClass}>Connector</label>
        <select className={inputClass} value={connectorCode} onChange={(e) => onSelectConnector(e.target.value)}>
          <option value="">— Chọn connector —</option>
          {connectors.map((c) => (
            <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
          ))}
        </select>
      </div>

      {connector && (
        <div>
          <label className={labelClass}>Action</label>
          <select className={inputClass} value={actionCode} onChange={(e) => onSelectAction(e.target.value)}>
            <option value="">— Chọn action —</option>
            {connector.actions.map((a) => (
              <option key={a.code} value={a.code}>{a.name}</option>
            ))}
          </select>
        </div>
      )}

      {action && (
        <>
          {missingRequired.length > 0 && (
            <p className="rounded-lg border border-warning/40 bg-warning/5 px-2.5 py-1.5 text-tiny text-warning">
              ⚠ {missingRequired.length} trường bắt buộc chưa map: {missingRequired.map((r) => r.target).join(", ")}
            </p>
          )}

          <div>
            <p className={sectionLabel}>Ánh xạ trường ({syncedRows.length})</p>
            <div className="mt-1.5 space-y-2">
              {syncedRows.map((r) => (
                <div key={r.target} className="space-y-1.5 rounded-lg border border-gray-200 p-2 dark:border-dark-600">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-tiny font-semibold text-gray-700 dark:text-dark-100">
                      {r.target}
                      {r.required && <span className="ml-1 text-error">*</span>}
                    </span>
                    {!r.required && (
                      <button className="text-tiny text-error hover:underline" onClick={() => removeRow(r.target)}>
                        Xoá
                      </button>
                    )}
                  </div>
                  <input
                    className={`${inputClass} ${r.required && !r.source.trim() ? "border-warning" : ""}`}
                    placeholder="Đường dẫn biến (VD: request.amount)"
                    value={r.source}
                    onChange={(e) => setRow(r.target, { source: e.target.value })}
                  />
                  <select className={inputClass} value={r.transform} onChange={(e) => setRow(r.target, { transform: e.target.value })}>
                    {TRANSFORMS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 rounded-lg bg-gray-50 p-2 dark:bg-dark-700">
            <button
              className="w-full rounded-lg border border-info/50 py-1.5 text-xs-plus font-medium text-info transition hover:bg-info/10"
              onClick={() => setShowPayload((v) => !v)}
            >
              {showPayload ? "Ẩn xem payload" : "Xem payload"}
            </button>
            {showPayload && (
              <>
                <label className={labelClass}>Test data (JSON)</label>
                <textarea
                  className={`${inputClass} h-24 resize-y font-mono text-tiny`}
                  value={testData}
                  onChange={(e) => setTestData(e.target.value)}
                  spellCheck={false}
                />
                <button className={btnPrimary} onClick={previewPayload}>Resolve payload</button>
                {payloadErr && <p className="text-tiny text-error">{payloadErr}</p>}
                {payload && (
                  <div>
                    <p className="text-tiny text-gray-400">
                      Nguồn: {payloadSource === "api" ? "backend /simulate" : "resolve cục bộ"}
                    </p>
                    <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md bg-white p-2 font-mono text-tiny text-gray-600 dark:bg-dark-800 dark:text-dark-200">
                      {payload}
                    </pre>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      <button className={btnPrimary} onClick={save} disabled={!connectorCode || !actionCode}>
        {saved ? "Đã cập nhật ✓" : "Cập nhật"}
      </button>
    </div>
  );
}

/** Best-effort search of a simulate response for a per-node resolved payload. */
function findNodePayload(data: Record<string, unknown>, nodeId: string): unknown {
  if (!data || typeof data !== "object") return undefined;
  // Common shapes: { payloads: { [nodeId]: {...} } } or steps[].payload
  const payloads = data.payloads as Record<string, unknown> | undefined;
  if (payloads && payloads[nodeId] !== undefined) return payloads[nodeId];
  const steps = data.steps as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(steps)) {
    const step = steps.find((s) => s.nodeId === nodeId && s.payload !== undefined);
    if (step) return step.payload;
  }
  return undefined;
}
