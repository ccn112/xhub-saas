// Adapter: convert the "12 Pilot Procedures" handoff (workflow.json + form.schema.json)
// into X.Office internal seed format (WorkflowDefinitionDocument[] + form-definitions[]).
//
// Handoff shape:  { code, name, version, systemOfRecord, status, nodes:[{id,label,type}],
//                   transitions:[{from,to,condition,idempotencyTemplate}], aiPolicy }
// Internal shape: { schemaVersion, metadata:{tenantSlug,code,name,description,ownerRoleCode,
//                   systemOfRecord,ownerSystem,wave,aiPolicy}, nodes:[{id,type,name,config,position}],
//                   edges:[{id,source,target,label?}], variables, forms, presentation }
//
// Run: node scripts/xoffice-adapt-pilots.mjs
// Writes: seed-data/xoffice/workflow-definitions.json, form-definitions.json
//         and mirrors both into ../xhub-web/src/data/xoffice/.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const HANDOFF = join(
  root,
  '..',
  'handoff',
  'Xhub',
  'XTECH_XOFFICE_12_PILOT_PROCEDURES_HANDOFF_20260729',
);
const WF_DIR = join(HANDOFF, 'workflows');
const FORM_DIR = join(HANDOFF, 'forms');
const seedDir = join(root, 'seed-data', 'xoffice');
const webSeedDir = join(root, '..', 'xhub-web', 'src', 'data', 'xoffice');

const TENANT = 'xtech';

// ---- CSV (quote-aware) → map by procedure code -----------------------------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      if (field !== '' || row.length) { row.push(field); rows.push(row); row = []; field = ''; }
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const catalog = {};
try {
  const rows = parseCsv(readFileSync(join(HANDOFF, 'data', 'PROCEDURE_CATALOG.csv'), 'utf8'));
  const header = rows[0];
  const idx = (name) => header.indexOf(name);
  for (const r of rows.slice(1)) {
    const code = r[idx('Mã')];
    if (!code) continue;
    catalog[code] = {
      domain: r[idx('Miền')],
      sor: r[idx('SoR')],
      wave: r[idx('Wave')],
      processOwner: r[idx('Chủ quy trình')],
      integration: r[idx('Tích hợp')],
      sla: r[idx('SLA')],
    };
  }
} catch (e) {
  console.warn('CSV parse skipped:', e.message);
}

// ---- node type mapping (handoff → internal) --------------------------------
function mapNode(n) {
  const id = n.id;
  const t = n.type;
  if (id === 'START' || (t === 'system' && id === 'START')) return 'start';
  if (id === 'END' || t === 'end') return 'end';
  switch (t) {
    case 'approval': return 'approval';
    case 'review': return 'humanTask';
    case 'task': return 'humanTask';
    case 'condition': return 'condition';
    case 'connector': return 'serviceCall';
    case 'ai': return 'aiAssist';
    case 'timer': return 'timer';
    case 'system': return 'notification'; // non-start automatic step
    default: return 'humanTask';
  }
}

// role heuristic for approval/humanTask assignment
function assignmentFor(node) {
  const id = node.id.toUpperCase();
  const label = (node.label || '').toLowerCase();
  if (id === 'MGR' || label.includes('trưởng đơn vị') || label.includes('quản lý'))
    return { type: 'requesterManager' };
  if (id === 'CFO' || label.includes('tài chính') || label.includes('cfo'))
    return { type: 'role', roleCode: 'ROLE_CFO' };
  if (id === 'CEO' || label.includes('tgđ') || label.includes('tổng giám đốc'))
    return { type: 'role', roleCode: 'ROLE_CEO' };
  if (id === 'IT' || label.includes('cntt') || label.includes('công nghệ'))
    return { type: 'role', roleCode: 'ROLE_IT_MANAGER' };
  if (label.includes('hành chính')) return { type: 'role', roleCode: 'ROLE_ADMIN_MANAGER' };
  if (label.includes('queue') || label.includes('tiếp nhận') || label.includes('xử lý'))
    return { type: 'role', roleCode: 'ROLE_IT_SUPPORT' };
  return { type: 'role', roleCode: 'ROLE_PROCESS_ADMIN' };
}

// connector config per node. Real (catalogued) mapping for PILOT-01; generic
// delegated command (mock success) for the rest — connectorCode/actionCode are
// DATA, engine resolves at runtime; unknown actions succeed with empty mapping.
function connectorConfig(procCode, node, sor) {
  if (procCode === 'PILOT-01') {
    return {
      connectorCode: 'finerp',
      actionCode: 'create_material_request',
      retry: { maxAttempts: 3 },
      mappings: [
        { target: 'itemDescription', source: 'request.title', required: true },
        { target: 'amount', source: 'request.amount', transform: 'toNumber', required: true },
        { target: 'purpose', source: 'request.business_justification' },
        { target: 'department', source: 'request.department' },
        { target: 'requesterEmail', source: 'requesterEmail', required: true },
      ],
    };
  }
  if (procCode === 'PILOT-09') {
    return {
      connectorCode: 'calendar',
      actionCode: 'create_reservation',
      mappings: [
        { target: 'roomCode', source: 'request.roomCode' },
        { target: 'title', source: 'request.subject' },
      ],
    };
  }
  // generic delegated command — actionCode intentionally not in catalog → mock ok
  const sysCode = (sor || 'XOFFICE').toLowerCase().replace(/_/g, '-');
  const action = 'submit_' + node.id.toLowerCase();
  return { connectorCode: sysCode, actionCode: action, mappings: [] };
}

// ---- x-ui component → RJSF ui:widget ---------------------------------------
function uiWidgetFor(component) {
  switch (component) {
    case 'textarea':
    case 'richtext':
      return 'textarea';
    default:
      return null;
  }
}

// convert a handoff JSON-Schema form → internal form-definition
function convertForm(procCode, formCode, formName, schema) {
  const props = {};
  const uiSchema = {};
  const srcProps = schema.properties || {};
  for (const [key, def] of Object.entries(srcProps)) {
    const p = { type: def.type || 'string' };
    if (def.title) p.title = def.title;
    if (def.description) p.description = def.description;
    const comp = def['x-ui']?.component;
    if (comp === 'date') p.format = 'date';
    props[key] = p;
    const w = uiWidgetFor(comp);
    if (w) uiSchema[key] = { 'ui:widget': w };
    // carry AI-assist hint (draft/validate/explain only) as metadata for the runtime
    if (def['x-ui']?.aiAssist) {
      uiSchema[key] = { ...(uiSchema[key] || {}), 'ui:help': def['x-ui'].aiAssist };
    }
  }
  return {
    schemaVersion: '1.0',
    code: formCode,
    name: formName,
    jsonSchema: { type: 'object', required: schema.required || [], properties: props },
    uiSchema,
    rules: [],
    metadata: { tenantSlug: TENANT, procedureCode: procCode },
  };
}

// ---- main conversion -------------------------------------------------------
const wfFiles = readdirSync(WF_DIR).filter((f) => f.endsWith('.workflow.json')).sort();
const definitions = [];
const forms = [];

for (const file of wfFiles) {
  const base = basename(file, '.workflow.json'); // e.g. purchase-proposal
  const wf = JSON.parse(readFileSync(join(WF_DIR, file), 'utf8'));
  const procCode = wf.code;
  const cat = catalog[procCode] || {};
  const formCode = 'FORM-' + base.toUpperCase();

  // form (paired by basename)
  const schemaPath = join(FORM_DIR, base + '.schema.json');
  let formName = wf.name;
  if (existsSync(schemaPath)) {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
    formName = schema.title || wf.name;
    forms.push(convertForm(procCode, formCode, formName, schema));
  }

  // nodes: map + inject a `form` node right after START
  const nodes = [];
  const startNode = wf.nodes.find((n) => n.id === 'START') || wf.nodes[0];
  const orderIndex = new Map();
  wf.nodes.forEach((n, i) => orderIndex.set(n.id, i));

  // layout: x by order, insert form as 0.5 slot after start
  const X = (i) => i * 240;
  const Y = 200;

  for (const n of wf.nodes) {
    const type = mapNode(n);
    const node = {
      id: n.id,
      type,
      name: n.label,
      config: {},
      position: { x: X(orderIndex.get(n.id)), y: Y },
    };
    if (type === 'approval' || type === 'humanTask') {
      node.config.assignment = assignmentFor(n);
      node.config.slaHours = 24;
    } else if (type === 'condition') {
      // gate expression referencing request.amount when a value-threshold gate
      if (/hạn mức|>|trên|chiết khấu|vượt|đặc biệt|gate/i.test(n.label) || n.id.includes('GATE')) {
        node.config.expression = {
          operator: 'gt',
          operands: [{ var: 'request.amount' }, 0],
        };
      }
    } else if (type === 'serviceCall') {
      node.config = connectorConfig(procCode, n, wf.systemOfRecord);
    } else if (type === 'aiAssist') {
      node.config.mode = 'assist';
    } else if (type === 'timer') {
      node.config.duration = 'PT8H';
    } else if (type === 'notification') {
      node.config.channels = ['in_app', 'xspace'];
    }
    nodes.push(node);
  }

  // inject form node
  const formNode = {
    id: 'FORM',
    type: 'form',
    name: 'Nhập ' + formName,
    config: { formCode },
    position: { x: X(orderIndex.get(startNode.id)) + 120, y: Y },
  };
  // place form node right after start in array order
  const startPos = nodes.findIndex((n) => n.id === startNode.id);
  nodes.splice(startPos + 1, 0, formNode);

  // edges: transitions 1:1, with form node spliced between START and its target
  const edges = [];
  let e = 0;
  const startTargets = [];
  for (const t of wf.transitions) {
    if (t.from === startNode.id) startTargets.push(t.to);
  }
  // START → FORM
  edges.push({ id: `e${++e}`, source: startNode.id, target: 'FORM' });
  // FORM → (original START targets)
  for (const tgt of startTargets) {
    edges.push({ id: `e${++e}`, source: 'FORM', target: tgt });
  }
  // remaining transitions (skip the START → * ones we rerouted)
  for (const t of wf.transitions) {
    if (t.from === startNode.id) continue;
    const edge = { id: `e${++e}`, source: t.from, target: t.to };
    edges.push(edge);
  }

  const def = {
    schemaVersion: '1.0',
    metadata: {
      tenantSlug: TENANT,
      code: procCode,
      name: wf.name,
      description:
        `${cat.domain ? cat.domain + ' — ' : ''}${wf.name}` +
        `${cat.sor ? ` (SoR: ${cat.sor})` : ''}`,
      ownerRoleCode: 'ROLE_PROCESS_ADMIN',
      systemOfRecord: wf.systemOfRecord || cat.sor || 'XOFFICE',
      ownerSystem: wf.systemOfRecord || cat.sor || 'XOFFICE',
      wave: cat.wave || null,
      aiPolicy: wf.aiPolicy || { canDraft: true, canValidate: true, canExplain: true, canPublish: false, canApprove: false },
    },
    nodes,
    edges,
    variables: [],
    forms: [],
    presentation: { viewport: { x: 0, y: 0, zoom: 0.85 } },
  };
  definitions.push(def);
}

// stable order by code (PILOT-01 .. PILOT-12)
definitions.sort((a, b) => a.metadata.code.localeCompare(b.metadata.code, undefined, { numeric: true }));
forms.sort((a, b) => a.code.localeCompare(b.code));

function writeJson(dir, name, data) {
  writeFileSync(join(dir, name), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

writeJson(seedDir, 'workflow-definitions.json', definitions);
writeJson(seedDir, 'form-definitions.json', forms);
if (existsSync(webSeedDir)) {
  writeJson(webSeedDir, 'workflow-definitions.json', definitions);
  writeJson(webSeedDir, 'form-definitions.json', forms);
}

console.log(
  `ADAPTED | workflows=${definitions.length} forms=${forms.length}\n` +
    definitions.map((d) => `  ${d.metadata.code} ${d.metadata.systemOfRecord.padEnd(9)} ${d.nodes.length} nodes  ${d.metadata.name}`).join('\n'),
);
