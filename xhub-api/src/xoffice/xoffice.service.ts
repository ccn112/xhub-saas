import { ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import Ajv2020, { ValidateFunction } from 'ajv/dist/2020';
import { PrismaService } from '../prisma/prisma.service';
import {
  ApprovalTask,
  AuditEvent,
  ConnectorAction,
  ConnectorCatalog,
  ConnectorCommandView,
  ConnectorNodeConfig,
  ConnectorResolveResult,
  ExternalExecutionView,
  ServiceCallMode,
  SimulationResult,
  ValidationIssue,
  WorkflowDefinitionDocument,
  WorkflowEdge,
  WorkflowInstance,
  WorkflowNode,
  WorkflowPatchSet,
  WorkflowVersion,
} from './xoffice.types';
import { CommandEnvelope, SourceReference } from './contracts/source-reference';
import { evaluateCondition } from './condition-ast';
import { NotificationService } from './notification.service';
import { Delegation as DelegationView } from './xoffice.types';
import { AssignmentResolver } from '../identity/assignment-resolver.service';
import { IdentityService } from '../identity/identity.service';

const DEFAULT_SLA_HOURS = 24;

const STOP_TYPES = new Set(['approval', 'humanTask']);
const MAX_WALK = 60;

/**
 * Postgres-backed (Prisma) store + workflow engine for X.Office.
 * All state is scoped by tenant. Published versions are immutable.
 * Engine logic (validate/simulate/advance) is unchanged; only the storage
 * layer moved from in-memory Maps to Prisma. Seed timestamps are deterministic
 * (manifest.canonicalNow); runtime rows use real time.
 */
@Injectable()
export class XofficeService implements OnModuleInit {
  private nodeCatalog: any[] = [];
  private roleBindings: any[] = [];
  private scenarios: any[] = [];
  private formDefinitions: any[] = [];
  private connectorCatalog: ConnectorCatalog = { version: '', connectors: [] };

  // deterministic monotonic clock seeded from manifest.canonicalNow (seed only)
  private clockBase = 0;
  private clockTick = 0;

  // monotonic counter for synchronous subflow child instance codes (no Math.random)
  private subflowSeq = 1;

  // AI
  private ajv = new Ajv2020({ allErrors: true, strict: false });
  private patchValidator?: ValidateFunction;
  private anthropic?: Anthropic;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly assignmentResolver: AssignmentResolver,
    private readonly identity: IdentityService,
  ) {}

  async onModuleInit(): Promise<void> {
    const dir = join(process.cwd(), 'seed-data', 'xoffice');
    const read = (f: string) => JSON.parse(readFileSync(join(dir, f), 'utf8'));

    const manifest = read('manifest.json');
    this.clockBase = new Date(manifest.canonicalNow).getTime();

    this.nodeCatalog = read('node-catalog.json');
    this.roleBindings = read('role-bindings.json');
    this.scenarios = read('ai-assistance-scenarios.json');
    this.formDefinitions = read('form-definitions.json');
    this.connectorCatalog = read('connector-catalog.json') as ConnectorCatalog;

    // Ajv validator for AI patch output
    const schema = read('../../src/xoffice/contracts/workflow-patch-set.schema.json');
    this.patchValidator = this.ajv.compile(schema);

    // Anthropic client (only if key present)
    const key = process.env.ANTHROPIC_API_KEY;
    if (key) this.anthropic = new Anthropic({ apiKey: key });

    await this.seedDatabase(read);
  }

  // ---- seed (idempotent upserts) -----------------------------------------
  private async seedDatabase(read: (f: string) => any): Promise<void> {
    // Seed writes to MULTIPLE tenants (xtech + the isolation canary) and must
    // read/write regardless of app.current_tenant → run under RLS bypass.
    await this.prisma.withBypass(async () => {
    const defs: WorkflowDefinitionDocument[] = read('workflow-definitions.json');

    // Tenants referenced by seed (xtech + the isolation canary).
    const slugs = new Set<string>();
    for (const d of defs) slugs.add(d.metadata.tenantSlug);
    slugs.add('xtech');
    for (const slug of slugs) {
      const tenantId = this.tenantId(slug);
      // The DISPLAY NAME is registry-owned (Tenant registry) — do NOT clobber it
      // on update; only ensure the row + slug exist. On first create use a
      // human-friendly default (xtech → "XTech") that the registry can override.
      await this.prisma.db.tenant.upsert({
        where: { id: tenantId },
        update: { slug },
        create: { id: tenantId, slug, name: slug === 'xtech' ? 'XTech' : slug },
      });
    }

    // Workflows + immutable v1 version.
    for (const d of defs) {
      const slug = d.metadata.tenantSlug;
      const tenantId = this.tenantId(slug);
      const workflowId = `wf-${slug}-${d.metadata.code}`;
      await this.prisma.db.workflow.upsert({
        where: { id: workflowId },
        update: {
          name: d.metadata.name,
          description: d.metadata.description ?? null,
          ownerRoleCode: d.metadata.ownerRoleCode ?? null,
          workingDefinition: d as any,
          schemaVersion: d.schemaVersion ?? '1.0',
        },
        create: {
          id: workflowId,
          tenantId,
          code: d.metadata.code,
          name: d.metadata.name,
          description: d.metadata.description ?? null,
          ownerRoleCode: d.metadata.ownerRoleCode ?? null,
          workingDefinition: d as any,
          schemaVersion: d.schemaVersion ?? '1.0',
        },
      });

      // Seed immutable v1 if the workflow has no versions yet.
      const existing = await this.prisma.db.workflowVersion.findFirst({
        where: { workflowId },
      });
      if (!existing) {
        const snap = this.snapshotMeta(d);
        await this.prisma.db.workflowVersion.create({
          data: {
            id: `${workflowId}-v1`,
            workflowId,
            version: 1,
            checksum: snap.checksum,
            publishedAt: new Date(this.seedNow()),
            definition: d as any,
          },
        });
      }
    }

    // Seeded runtime instances (+ open task if sitting on a human node).
    const seededInstances: any[] = read('workflow-instances.json');
    for (const si of seededInstances) {
      const slug = si.tenantSlug;
      const tenantId = this.tenantId(slug);
      const def = defs.find(
        (d) => d.metadata.tenantSlug === slug && d.metadata.code === si.workflowCode,
      );
      const at = new Date(this.seedNow());
      const inst = await this.prisma.db.workflowInstance.upsert({
        where: { tenantId_instanceCode: { tenantId, instanceCode: si.instanceCode } },
        update: {
          title: si.title,
          requesterEmail: si.requesterEmail,
          variables: (si.variables ?? {}) as any,
          status: si.status ?? 'running',
          currentNodeId: si.currentNodeId ?? null,
        },
        create: {
          tenantId,
          workflowCode: si.workflowCode,
          instanceCode: si.instanceCode,
          title: si.title,
          requesterEmail: si.requesterEmail,
          variables: (si.variables ?? {}) as any,
          status: si.status ?? 'running',
          currentNodeId: si.currentNodeId ?? null,
          createdAt: at,
          updatedAt: at,
        },
      });

      const node = def?.nodes.find((n) => n.id === si.currentNodeId);
      if (node && STOP_TYPES.has(node.type)) {
        const seedTaskId = `seed-task-${si.instanceCode}`;
        const already = await this.prisma.db.approvalTask.findUnique({ where: { id: seedTaskId } });
        if (!already) {
          const assignment = node.config?.assignment ?? {};
          let role = assignment.roleCode ?? assignment.type ?? 'ROLE_PROCESS_ADMIN';
          if (assignment.type === 'requesterManager') role = 'ROLE_REQUESTER_MANAGER';
          await this.prisma.db.approvalTask.create({
            data: {
              id: seedTaskId,
              tenantId,
              instanceId: inst.id,
              nodeId: node.id,
              nodeName: node.name,
              assigneeRole: role,
              assigneeUserId: this.resolveAssignee(slug, role),
              status: 'open',
              slaHours: node.config?.slaHours ?? null,
              createdAt: at,
            },
          });
        }
      }
    }
    });
  }

  // ---- tenant helpers -----------------------------------------------------
  slugFromTenantId(tenantId: string): string {
    // Registry key == the `tenant-` prefix-stripped id (tenant-xtech → xtech),
    // so no X-TECH special case is needed.
    return tenantId.replace(/^tenant-/, '');
  }

  private tenantId(slug: string): string {
    return `tenant-${slug}`;
  }

  private assertTenant(slug: string): void {
    // hard guard: the isolation-canary tenant must never be served
    if (slug === 'demo-isolation') {
      throw new NotFoundException('Tenant not accessible');
    }
  }

  // ---- deterministic seed clock ------------------------------------------
  private seedNow(): string {
    const t = this.clockBase + this.clockTick * 60_000;
    this.clockTick += 1;
    return new Date(t).toISOString();
  }

  private snapshotMeta(def: WorkflowDefinitionDocument): { checksum: string } {
    const frozen: WorkflowDefinitionDocument = JSON.parse(JSON.stringify(def));
    const checksum = createHash('sha256')
      .update(this.canonical(frozen))
      .digest('hex')
      .slice(0, 16);
    return { checksum };
  }

  private canonical(obj: any): string {
    const sort = (v: any): any => {
      if (Array.isArray(v)) return v.map(sort);
      if (v && typeof v === 'object') {
        return Object.keys(v)
          .sort()
          .reduce((acc: any, k) => {
            acc[k] = sort(v[k]);
            return acc;
          }, {});
      }
      return v;
    };
    return JSON.stringify(sort(obj));
  }

  // ---- catalog ------------------------------------------------------------
  getNodeCatalog() {
    return this.nodeCatalog;
  }

  getConnectorCatalog(): ConnectorCatalog {
    return this.connectorCatalog;
  }

  // ---- form definitions (JSON Schema + uiSchema for the form runtime) -----
  getForms() {
    return this.formDefinitions.map((f) => ({ code: f.code, name: f.name }));
  }

  getForm(code: string) {
    const form = this.formDefinitions.find((f) => f.code === code);
    if (!form) throw new NotFoundException(`Form ${code} not found`);
    return form;
  }

  // ---- connector: catalog lookup -----------------------------------------
  private findAction(connectorCode: string, actionCode: string): ConnectorAction | undefined {
    const connector = this.connectorCatalog.connectors.find((c) => c.code === connectorCode);
    return connector?.actions.find((a) => a.code === actionCode);
  }

  /**
   * External systems whose connector is NOT live in the standalone SaaS. Crossing
   * a serviceCall bound to one of these NEVER fabricates a document — it defaults
   * to MANUAL_TASK (park + real manual reference entry). Office-owned connectors
   * (xoffice/calendar/resource-booking) stay AUTO so office-owned flows are unchanged.
   */
  private static readonly EXTERNAL_NOT_LIVE = new Set(['finerp', 'frappe-hr', 'hr', 'esign', 'e-sign']);

  /**
   * Resolve the execution mode of a serviceCall node. Priority:
   *  1) explicit config.executionMode (AUTO / MANUAL_TASK / WAITING_FOR_CONNECTOR);
   *  2) catalog ownerSystem — non-office owner → MANUAL_TASK;
   *  3) connectorCode in EXTERNAL_NOT_LIVE → MANUAL_TASK;
   *  4) otherwise AUTO (office-owned simulate). Deterministic (no randomness).
   */
  private serviceCallMode(config: ConnectorNodeConfig): ServiceCallMode {
    const explicit = config.executionMode;
    if (explicit === 'AUTO' || explicit === 'MANUAL_TASK' || explicit === 'WAITING_FOR_CONNECTOR') {
      return explicit;
    }
    const connector = this.connectorCatalog.connectors.find((c) => c.code === config.connectorCode);
    const owner = (connector?.ownerSystem ?? '').toUpperCase();
    if (owner && owner !== 'XOFFICE') return 'MANUAL_TASK';
    if (XofficeService.EXTERNAL_NOT_LIVE.has((config.connectorCode ?? '').toLowerCase())) {
      return 'MANUAL_TASK';
    }
    return 'AUTO';
  }

  // ---- mapping resolver (data-driven, generic — no per-field logic) ------
  private applyTransform(transform: string | undefined, raw: unknown, constant: unknown): unknown {
    switch (transform) {
      case 'constant':
        return constant;
      case 'toNumber': {
        if (raw === null || raw === undefined || raw === '') return undefined;
        const n = Number(raw);
        return Number.isNaN(n) ? undefined : n;
      }
      case 'toString':
        return raw === null || raw === undefined ? undefined : String(raw);
      case 'join':
        return Array.isArray(raw) ? raw.join(', ') : raw;
      case 'none':
      case undefined:
      default:
        return raw;
    }
  }

  /**
   * Resolve a serviceCall node's config.mappings against instance variables.
   * Generic: reads `source` as a dot-path, applies the declared transform, and
   * writes to `target`. Required is the union of the mapping flag and the
   * catalog targetField.required. Returns the payload + any missing required
   * target keys. No connector- or field-specific branching lives here.
   */
  private resolveConnectorPayload(
    config: ConnectorNodeConfig,
    variables: Record<string, any>,
  ): ConnectorResolveResult {
    const action = this.findAction(config.connectorCode, config.actionCode);
    const requiredByCatalog = new Set(
      (action?.targetFields ?? []).filter((f) => f.required).map((f) => f.key),
    );
    const payload: Record<string, unknown> = {};
    const missingRequired: string[] = [];

    for (const m of config.mappings ?? []) {
      const raw =
        m.transform === 'constant' ? undefined : this.resolveVar(m.source, variables);
      const value = this.applyTransform(m.transform, raw, m.constant);
      if (value !== undefined) payload[m.target] = value;

      const isRequired = m.required === true || requiredByCatalog.has(m.target);
      if (isRequired && (value === undefined || value === null || value === '')) {
        missingRequired.push(m.target);
      }
    }

    // catalog-required targets that no mapping covers at all
    for (const key of requiredByCatalog) {
      const covered = (config.mappings ?? []).some((m) => m.target === key);
      if (!covered && !missingRequired.includes(key)) missingRequired.push(key);
    }

    return {
      connectorCode: config.connectorCode,
      actionCode: config.actionCode,
      payload,
      missingRequired,
    };
  }

  /**
   * Mock adapter for AUTO, OFFICE-OWNED connectors only (calendar / resource-booking).
   * It never calls a real system and — critically — it NEVER fabricates an external
   * ERP/HR document. Not-live external systems (finerp / frappe-hr / esign) do not
   * reach here: they are parked as MANUAL_TASK ExternalExecutions instead. The old
   * `create_material_request` fabrication (`MR-…`, `system:FinERP`) was removed to
   * uphold the invariant "no fake ERP documents".
   */
  private mockConnectorResult(
    connectorCode: string,
    actionCode: string,
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const ref = randomUUID().slice(0, 6).toUpperCase();
    switch (actionCode) {
      case 'check_availability':
        return { available: true, roomCode: payload.roomCode ?? null, conflicts: [] };
      case 'create_reservation':
        return {
          reservationId: `RES-${ref}`,
          roomCode: payload.roomCode ?? null,
          calendarSynced: true,
        };
      default:
        return { ok: true, connectorCode, actionCode, ref: `CMD-${ref}` };
    }
  }

  /**
   * Build a SourceReference from a REAL manual reference code entered by the
   * responsible person (external-action MANUAL_TASK completion). This is the ONLY
   * sourceRef path for not-live external systems — the id is the code the target
   * system actually issued, never a fabricated one. deepLink carries no token.
   */
  private buildManualSourceRef(
    tenantId: string,
    connectorCode: string,
    actionCode: string,
    referenceCode: string,
    referenceSystem?: string,
  ): SourceReference {
    const sourceSystem =
      (referenceSystem && referenceSystem.trim()) ||
      (connectorCode === 'finerp'
        ? 'FINERP'
        : connectorCode === 'frappe-hr' || connectorCode === 'hr'
          ? 'FRAPPE_HR'
          : connectorCode.toUpperCase());
    const action = this.findAction(connectorCode, actionCode);
    const sourceType =
      actionCode === 'create_material_request' ? 'Material Request' : action?.name ?? actionCode;
    return {
      tenantId,
      sourceSystem,
      sourceType,
      sourceId: referenceCode,
      deepLink: `/external/${sourceSystem.toLowerCase()}/${encodeURIComponent(referenceCode)}`,
    };
  }

  /**
   * Normalize a connector result into a SourceReference (ADR-SOR-003): a pointer
   * to the record the target system now owns — NOT a copy of that record. Used
   * ONLY for AUTO office-owned simulations and (future) live connector results;
   * it is NEVER fed a fabricated external-ERP id — not-live external systems go
   * through buildManualSourceRef with a real entered code instead.
   */
  private buildSourceRef(
    tenantId: string,
    connectorCode: string,
    actionCode: string,
    result: Record<string, unknown>,
  ): SourceReference {
    const sourceSystem =
      connectorCode === 'finerp'
        ? 'FINERP'
        : connectorCode === 'xbooking'
          ? 'XBOOKING'
          : connectorCode.toUpperCase();

    let sourceType = actionCode;
    let sourceId = String(result.ref ?? `${connectorCode}-${actionCode}`);
    switch (actionCode) {
      case 'create_material_request':
        sourceType = 'Material Request';
        sourceId = String(result.materialRequestId ?? sourceId);
        break;
      case 'create_reservation':
        sourceType = 'Reservation';
        sourceId = String(result.reservationId ?? sourceId);
        break;
      case 'check_availability':
        sourceType = 'Availability Check';
        sourceId = String(result.roomCode ?? sourceId);
        break;
    }

    return {
      tenantId,
      sourceSystem,
      sourceType,
      sourceId,
      deepLink: `/external/${sourceSystem.toLowerCase()}/${encodeURIComponent(sourceId)}`,
    };
  }

  // ---- mappers (Prisma row -> legacy response shape) ---------------------
  private mapVersion(row: any, slug: string, code: string): WorkflowVersion {
    return {
      tenantSlug: slug,
      code,
      version: row.version,
      publishedAt:
        row.publishedAt instanceof Date ? row.publishedAt.toISOString() : row.publishedAt,
      checksum: row.checksum,
      definition: row.definition as WorkflowDefinitionDocument,
    };
  }

  private mapInstance(row: any): WorkflowInstance {
    return {
      tenantSlug: this.slugFromTenantId(row.tenantId),
      workflowCode: row.workflowCode,
      instanceCode: row.instanceCode,
      title: row.title,
      requesterEmail: row.requesterEmail,
      variables: (row.variables ?? {}) as Record<string, any>,
      status: row.status,
      currentNodeId: row.currentNodeId ?? null,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    };
  }

  private mapTask(row: any, instanceCode: string): ApprovalTask {
    return {
      id: row.id,
      tenantSlug: this.slugFromTenantId(row.tenantId),
      instanceCode,
      nodeId: row.nodeId,
      nodeName: row.nodeName,
      assigneeRole: row.assigneeRole,
      assigneeUserId: row.assigneeUserId ?? null,
      status: row.status,
      slaHours: row.slaHours ?? undefined,
      escalated: row.escalated ?? false,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    };
  }

  private mapAudit(row: any): AuditEvent {
    return {
      id: row.id,
      tenantSlug: this.slugFromTenantId(row.tenantId),
      at: row.at instanceof Date ? row.at.toISOString() : row.at,
      actorId: row.actorId,
      instanceCode: row.instanceCode,
      action: row.action,
      detail: row.detail,
    };
  }

  // ---- definitions --------------------------------------------------------
  async listWorkflows(slug: string) {
    this.assertTenant(slug);
    const tenantId = this.tenantId(slug);
    const workflows = await this.prisma.db.workflow.findMany({
      where: { tenantId },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 1 },
        _count: { select: { versions: true } },
      },
    });
    const out: any[] = [];
    for (const w of workflows) {
      const def = w.workingDefinition as unknown as WorkflowDefinitionDocument;
      const instanceCount = await this.prisma.db.workflowInstance.count({
        where: { tenantId, workflowCode: w.code },
      });
      out.push({
        code: w.code,
        name: w.name,
        description: w.description ?? '',
        ownerRoleCode: w.ownerRoleCode ?? null,
        nodeCount: def.nodes.length,
        latestVersion: w.versions.length ? w.versions[0].version : 0,
        instanceCount,
      });
    }
    return out;
  }

  async getWorkflow(slug: string, code: string): Promise<WorkflowDefinitionDocument> {
    this.assertTenant(slug);
    const w = await this.prisma.db.workflow.findUnique({
      where: { tenantId_code: { tenantId: this.tenantId(slug), code } },
    });
    if (!w) throw new NotFoundException(`Workflow ${code} not found`);
    return w.workingDefinition as unknown as WorkflowDefinitionDocument;
  }

  async getVersions(slug: string, code: string): Promise<WorkflowVersion[]> {
    this.assertTenant(slug);
    const w = await this.prisma.db.workflow.findUnique({
      where: { tenantId_code: { tenantId: this.tenantId(slug), code } },
      include: { versions: { orderBy: { version: 'asc' } } },
    });
    if (!w) throw new NotFoundException(`Workflow ${code} not found`);
    return w.versions.map((v) => this.mapVersion(v, slug, code));
  }

  // ---- validation (semantic) — unchanged engine --------------------------
  validate(def: WorkflowDefinitionDocument): { issues: ValidationIssue[] } {
    const issues: ValidationIssue[] = [];
    const nodes = def.nodes ?? [];
    const edges = def.edges ?? [];
    const byId = new Map(nodes.map((n) => [n.id, n]));

    const starts = nodes.filter((n) => n.type === 'start');
    if (starts.length === 0)
      issues.push({ level: 'error', message: 'Thiếu node start (bắt đầu).' });
    if (starts.length > 1)
      issues.push({ level: 'error', message: `Có ${starts.length} node start, chỉ được 1.` });

    const ends = nodes.filter((n) => n.type === 'end');
    if (ends.length === 0)
      issues.push({ level: 'error', message: 'Cần ít nhất 1 node end (kết thúc).' });

    for (const e of edges) {
      if (!byId.has(e.source))
        issues.push({ level: 'error', nodeId: e.source, message: `Edge ${e.id}: source không tồn tại.` });
      if (!byId.has(e.target))
        issues.push({ level: 'error', nodeId: e.target, message: `Edge ${e.id}: target không tồn tại.` });
    }

    for (const n of nodes) {
      if (n.type === 'approval' && !n.config?.assignment) {
        issues.push({ level: 'error', nodeId: n.id, message: `Node "${n.name}" (approval) thiếu assignment.` });
      }
    }

    if (starts.length === 1) {
      const adj = new Map<string, string[]>();
      for (const e of edges) {
        if (!adj.has(e.source)) adj.set(e.source, []);
        adj.get(e.source)!.push(e.target);
      }
      const seen = new Set<string>();
      const stack = [starts[0].id];
      while (stack.length) {
        const cur = stack.pop()!;
        if (seen.has(cur)) continue;
        seen.add(cur);
        for (const t of adj.get(cur) ?? []) stack.push(t);
      }
      for (const n of nodes) {
        if (!seen.has(n.id))
          issues.push({ level: 'warning', nodeId: n.id, message: `Node "${n.name}" không thể đến được từ start (treo).` });
      }

      for (const cyc of this.findCycles(nodes, edges)) {
        const hasCondition = cyc.some((id) => byId.get(id)?.type === 'condition');
        if (!hasCondition) {
          issues.push({
            level: 'error',
            nodeId: cyc[0],
            message: `Vòng lặp vô hạn ở control-flow (${cyc.join(' → ')}): không có node điều kiện để thoát.`,
          });
        }
      }
    }

    return { issues };
  }

  private findCycles(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[][] {
    const adj = new Map<string, string[]>();
    for (const e of edges) {
      if (!adj.has(e.source)) adj.set(e.source, []);
      adj.get(e.source)!.push(e.target);
    }
    const cycles: string[][] = [];
    const state = new Map<string, number>();
    const stackArr: string[] = [];
    const dfs = (u: string) => {
      state.set(u, 1);
      stackArr.push(u);
      for (const v of adj.get(u) ?? []) {
        const s = state.get(v) ?? 0;
        if (s === 0) dfs(v);
        else if (s === 1) {
          const idx = stackArr.indexOf(v);
          if (idx >= 0) cycles.push(stackArr.slice(idx));
        }
      }
      stackArr.pop();
      state.set(u, 2);
    };
    for (const n of nodes) if ((state.get(n.id) ?? 0) === 0) dfs(n.id);
    return cycles;
  }

  // ---- condition evaluation — unchanged ----------------------------------
  private resolveVar(path: string, data: Record<string, any>): any {
    return path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), data);
  }

  private operand(o: any, data: Record<string, any>): any {
    if (o && typeof o === 'object' && 'var' in o) return this.resolveVar(o.var, data);
    return o;
  }

  /**
   * Evaluate a branch condition. Delegates to the standalone safe AST evaluator
   * (condition-ast.ts) which supports the FULL grammar (and/or/not, comparisons,
   * in/notIn/contains/exists, {var}, literals). Backward-compatible with the
   * simple form used by the 13 seeded workflows. `this.operand` is retained for
   * any legacy callers.
   */
  private evalExpr(expr: any, data: Record<string, any>): boolean {
    if (!expr || typeof expr !== 'object') return false;
    return evaluateCondition(expr, data);
  }

  private nextEdge(
    node: WorkflowNode,
    edges: WorkflowEdge[],
    data: Record<string, any>,
  ): WorkflowEdge | undefined {
    const outs = edges.filter((e) => e.source === node.id);
    if (outs.length === 0) return undefined;
    if (node.type === 'condition') {
      const truthy = this.evalExpr(node.config?.expression, data);
      const wantYes = truthy;
      const yes = outs.find((e) => /^(có|yes|true)$/i.test(e.label ?? ''));
      const no = outs.find((e) => /^(không|no|false)$/i.test(e.label ?? ''));
      if (wantYes) return yes ?? outs[0];
      return no ?? outs[outs.length - 1];
    }
    return outs[0];
  }

  // ---- simulation — unchanged --------------------------------------------
  simulate(def: WorkflowDefinitionDocument, testData: Record<string, any>): SimulationResult {
    const nodes = def.nodes ?? [];
    const edges = def.edges ?? [];
    const start = nodes.find((n) => n.type === 'start');
    const path: string[] = [];
    const steps: SimulationResult['steps'] = [];
    let reachedEnd = false;
    if (!start) return { path, steps, reachedEnd };

    let cur: WorkflowNode | undefined = start;
    let guard = 0;
    while (cur && guard < MAX_WALK) {
      guard += 1;
      path.push(cur.id);
      let outcome = 'passed';
      let connectorPreview: ConnectorResolveResult | undefined;
      if (cur.type === 'condition') {
        outcome = this.evalExpr(cur.config?.expression, testData) ? 'condition:Có' : 'condition:Không';
      } else if (STOP_TYPES.has(cur.type)) {
        outcome = 'human:auto-approved(sim)';
      } else if (cur.type === 'serviceCall') {
        // dry-run: resolve the mapping payload so the builder can preview it
        connectorPreview = this.resolveConnectorPayload(
          (cur.config ?? {}) as ConnectorNodeConfig,
          testData,
        );
        outcome =
          connectorPreview.missingRequired.length > 0
            ? `serviceCall:missing(${connectorPreview.missingRequired.join(',')})`
            : 'serviceCall:resolved';
      } else if (cur.type === 'end') {
        outcome = 'end';
      }
      steps.push({ nodeId: cur.id, name: cur.name, outcome, connectorPreview });
      if (cur.type === 'end') {
        reachedEnd = true;
        break;
      }
      const edge = this.nextEdge(cur, edges, testData);
      if (!edge) break;
      cur = nodes.find((n) => n.id === edge.target);
    }
    return { path, steps, reachedEnd };
  }

  // ---- publish (immutable version) ---------------------------------------
  async publish(
    slug: string,
    code: string,
    def: WorkflowDefinitionDocument,
  ): Promise<WorkflowVersion> {
    this.assertTenant(slug);
    const tenantId = this.tenantId(slug);
    const w = await this.prisma.db.workflow.findUnique({
      where: { tenantId_code: { tenantId, code } },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!w) throw new NotFoundException(`Workflow ${code} not found`);

    const nextVersion = (w.versions.length ? w.versions[0].version : 0) + 1;
    const { checksum } = this.snapshotMeta(def);
    const frozen = JSON.parse(JSON.stringify(def));

    const created = await this.prisma.db.workflowVersion.create({
      data: {
        workflowId: w.id,
        version: nextVersion,
        checksum,
        publishedAt: new Date(),
        definition: frozen as any,
      },
    });

    // the editable working copy becomes the newly published definition
    await this.prisma.db.workflow.update({
      where: { id: w.id },
      data: { workingDefinition: frozen as any },
    });

    return this.mapVersion(created, slug, code);
  }

  // ---- AI draft (live Claude with mock fallback) -------------------------
  async aiDraft(
    slug: string,
    prompt: string,
    screen: string,
    currentDefinition?: WorkflowDefinitionDocument,
  ): Promise<WorkflowPatchSet & { source: 'live' | 'mock' }> {
    this.assertTenant(slug);

    const live = process.env.XOFFICE_AI_LIVE === 'true';
    if (live && this.anthropic) {
      try {
        const patch = await this.aiDraftLive(slug, prompt, currentDefinition);
        if (patch) return { ...patch, mustRequireHumanApply: true, source: 'live' };
      } catch {
        // fall through to mock on any error/timeout/invalid schema
      }
    }
    return { ...this.aiDraftMock(slug, prompt, screen), source: 'mock' };
  }

  /**
   * DRAFT-FIRST advisory TEXT (Constitution #8/#10/#11) — the same gate as
   * `aiDraft` above, exposed for callers that need prose rather than a patch set
   * (e.g. the IOC "AI Twin Brief"). It is deliberately the ONLY other AI entry
   * point in the platform so there is exactly one place where the live-model
   * switch lives:
   *
   *   live  ⇔ XOFFICE_AI_LIVE === 'true'  AND  ANTHROPIC_API_KEY is present
   *   otherwise (and on ANY error/timeout) → the caller's deterministic
   *   `fallback()` text, tagged source='mock'
   *
   * The result is ALWAYS advisory: `mustRequireHumanApply` is hard-coded true and
   * nothing here writes to any business table. The model never sees raw personal
   * data — callers pass pre-aggregated department numbers.
   */
  async aiAdvisory(
    system: string,
    user: string,
    fallback: () => string,
    opts: { maxTokens?: number; timeoutMs?: number } = {},
  ): Promise<{ text: string; source: 'live' | 'mock'; mustRequireHumanApply: true }> {
    const live = process.env.XOFFICE_AI_LIVE === 'true';
    if (live && this.anthropic) {
      try {
        const resp = await this.anthropic.messages.create(
          {
            model: process.env.XOFFICE_AI_MODEL || 'claude-opus-4-8',
            max_tokens: opts.maxTokens ?? 800,
            system,
            messages: [{ role: 'user', content: user }],
          },
          // Hard ceiling: a dashboard read must never hang on the model. On
          // timeout we fall through to the deterministic fallback below.
          { timeout: opts.timeoutMs ?? 15000, maxRetries: 0 },
        );
        const text = resp.content
          .map((b: any) => (b.type === 'text' ? b.text : ''))
          .join('')
          .trim();
        if (text) return { text, source: 'live', mustRequireHumanApply: true };
      } catch {
        // fall through to the deterministic fallback on any error/timeout
      }
    }
    return { text: fallback(), source: 'mock', mustRequireHumanApply: true };
  }

  private async aiDraftLive(
    slug: string,
    prompt: string,
    currentDefinition?: WorkflowDefinitionDocument,
  ): Promise<WorkflowPatchSet | null> {
    const model = process.env.XOFFICE_AI_MODEL || 'claude-opus-4-8';
    const system = [
      'Bạn là trợ lý thiết kế quy trình (workflow) cho nền tảng X.Office.',
      'Nhiệm vụ: từ mô tả tiếng Việt của người dùng và định nghĩa hiện tại (nếu có),',
      'sinh MỘT WorkflowPatchSet dạng JSON THUẦN (không markdown, không giải thích ngoài JSON).',
      'Cấu trúc bắt buộc:',
      '{ "summary": string, "operations": [{ "op": "add|replace|remove|move", "path": string, "value"?: any, "from"?: string }],',
      '  "assumptions": string[], "evidence": [{ "sourceType": string, "sourceId": string, "label": string }] }',
      'operations dùng JSON Pointer trên tài liệu định nghĩa (vd path "/nodes/-" để thêm node).',
      'KHÔNG tự áp dụng vào production. Chỉ đề xuất bản nháp để người dùng xác nhận.',
      'Chỉ trả về JSON hợp lệ, không kèm text khác.',
    ].join(' ');

    const roles = this.roleBindings
      .filter((r) => r.tenantSlug === slug)
      .map((r) => `${r.code} (${r.name})`)
      .join(', ');

    const userContent = [
      `Mô tả yêu cầu: ${prompt}`,
      `Các role khả dụng của tenant: ${roles || '(không có)'}`,
      currentDefinition
        ? `Định nghĩa hiện tại (JSON): ${JSON.stringify(currentDefinition).slice(0, 4000)}`
        : 'Chưa có định nghĩa hiện tại (tạo mới).',
    ].join('\n');

    const resp = await this.anthropic!.messages.create({
      model,
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: userContent }],
    });

    const text = resp.content
      .map((b: any) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim();

    const parsed = this.extractJson(text);
    if (!parsed) return null;

    if (!this.patchValidator || !this.patchValidator(parsed)) return null;
    return parsed as WorkflowPatchSet;
  }

  private extractJson(text: string): any | null {
    // strip code fences and grab the outermost JSON object
    const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  private aiDraftMock(slug: string, prompt: string, screen: string): WorkflowPatchSet {
    const scenario = this.scenarios.find(
      (s) =>
        s.tenantSlug === slug &&
        (s.screen === screen || !screen) &&
        (s.prompt === prompt || (prompt && s.prompt?.includes(prompt.slice(0, 12)))),
    );
    if (scenario?.patch) {
      return { ...scenario.patch, mustRequireHumanApply: true };
    }

    const roleEvidence = this.roleBindings
      .filter((r) => r.tenantSlug === slug)
      .slice(0, 3)
      .map((r) => ({ sourceType: 'role', sourceId: r.code, label: r.name }));

    const newNodeId = `ai-approval-${Date.now().toString(36)}`;
    return {
      summary: `Đề xuất bổ sung bước phê duyệt cho yêu cầu: "${prompt.slice(0, 80)}"`,
      operations: [
        {
          op: 'add',
          path: '/nodes/-',
          value: {
            id: newNodeId,
            type: 'approval',
            name: 'Bước phê duyệt (AI đề xuất)',
            config: { assignment: { type: 'role', roleCode: 'ROLE_PROCESS_ADMIN' }, slaHours: 24 },
            position: { x: 600, y: 360 },
          },
        },
      ],
      assumptions: [
        'Người duyệt mặc định là ROLE_PROCESS_ADMIN; hãy điều chỉnh nếu cần.',
        'SLA gợi ý 24 giờ theo mẫu mua sắm.',
        'Patch chỉ là bản nháp — cần người xác nhận trước khi áp dụng.',
      ],
      evidence: roleEvidence.length
        ? roleEvidence
        : [{ sourceType: 'node-catalog', sourceId: 'approval', label: 'Node phê duyệt' }],
      validation: { requiresHumanApply: true, appliedToProduction: false },
      mustRequireHumanApply: true,
    };
  }

  // ---- runtime: instances / tasks / audit --------------------------------
  private taskRole(node: WorkflowNode): string {
    const assignment = node.config?.assignment ?? {};
    let role = assignment.roleCode ?? assignment.type ?? 'ROLE_PROCESS_ADMIN';
    if (assignment.type === 'requesterManager') role = 'ROLE_REQUESTER_MANAGER';
    return role;
  }

  /**
   * Resolve a roleCode to a concrete recipient (userEmail as the user id) from
   * role-bindings.json for the tenant. Returns null when the role has no mapped
   * user — the task then stays a role queue (assigneeRole only). Never crosses
   * tenants (binding must match the tenant slug).
   */
  private resolveAssignee(slug: string, roleCode: string): string | null {
    const binding = this.roleBindings.find(
      (r) => r.tenantSlug === slug && r.code === roleCode,
    );
    return binding?.userEmail ?? binding?.userId ?? null;
  }

  /**
   * NEW: resolve an assignee via the shared Identity/Org resolver — but ONLY
   * when the node carries an EXPLICIT structured `selectorType`. This keeps the
   * golden path (nodes with plain `{ type:'role', roleCode }`) on the legacy
   * flat resolver. Returns a session userId (mapped from the resolved person)
   * or null so the caller falls back. Writes an AssignmentResolution snapshot
   * + audit as a side effect (via resolveAndSnapshot).
   */
  private async resolveStructuredAssignee(
    tenantId: string,
    instanceCode: string,
    node: WorkflowNode,
  ): Promise<string | null> {
    const assignment: any = node.config?.assignment;
    if (!assignment?.selectorType) return null; // legacy roleCode node → flat resolver
    const selector = this.assignmentResolver.selectorFromAssignment(assignment);
    if (!selector) return null;
    const result = await this.assignmentResolver.resolveAndSnapshot({
      tenantId,
      workflowInstanceCode: instanceCode,
      nodeId: node.id,
      selector,
      actorId: 'system:engine',
    });
    if (!result.resolvedPersonId) return null; // queue / no candidate → leave as role queue
    return this.identity.userIdForPerson(result.resolvedPersonId);
  }

  private taskSla(node: WorkflowNode): number {
    const sla = node.config?.slaHours;
    return typeof sla === 'number' && sla > 0 ? sla : DEFAULT_SLA_HOURS;
  }

  async listInstances(slug: string) {
    this.assertTenant(slug);
    const tenantId = this.tenantId(slug);
    const rows = await this.prisma.db.workflowInstance.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
    const out: any[] = [];
    for (const r of rows) {
      const def = await this.getWorkflowSafe(slug, r.workflowCode);
      const node = def?.nodes.find((n) => n.id === r.currentNodeId);
      out.push({
        ...this.mapInstance(r),
        currentNodeName: node?.name ?? null,
        currentNodeType: node?.type ?? null,
        slaHours: node?.config?.slaHours ?? null,
      });
    }
    return out;
  }

  private async getWorkflowSafe(
    slug: string,
    code: string,
  ): Promise<WorkflowDefinitionDocument | null> {
    const w = await this.prisma.db.workflow.findUnique({
      where: { tenantId_code: { tenantId: this.tenantId(slug), code } },
    });
    return w ? (w.workingDefinition as unknown as WorkflowDefinitionDocument) : null;
  }

  async listTasks(slug: string) {
    this.assertTenant(slug);
    const tenantId = this.tenantId(slug);
    const rows = await this.prisma.db.approvalTask.findMany({
      where: { tenantId, status: 'open' },
      include: { instance: { select: { instanceCode: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.mapTask(r, r.instance.instanceCode));
  }

  async getAudit(slug: string) {
    this.assertTenant(slug);
    const rows = await this.prisma.db.auditLog.findMany({
      where: { tenantId: this.tenantId(slug) },
      orderBy: { at: 'asc' },
    });
    return rows.map((r) => this.mapAudit(r));
  }

  private async appendAudit(
    tenantId: string,
    instanceCode: string,
    actorId: string,
    action: string,
    detail: string,
  ): Promise<AuditEvent> {
    const row = await this.prisma.db.auditLog.create({
      data: { tenantId, instanceCode, actorId, action, detail, at: new Date() },
    });
    return this.mapAudit(row);
  }

  /**
   * Walk forward from a node, auto-executing automatic nodes, until we hit a
   * human stop node (approval/humanTask) or the end. Mutates `state`
   * (status/currentNodeId) in place. Returns the stop node or null.
   */
  private advance(
    def: WorkflowDefinitionDocument,
    fromNodeId: string,
    state: { status: string; currentNodeId: string | null; variables: Record<string, any> },
    serviceCalls?: WorkflowNode[],
  ): WorkflowNode | null {
    const nodes = def.nodes;
    let cur: WorkflowNode | undefined = nodes.find((n) => n.id === fromNodeId);
    let guard = 0;
    while (cur && guard < MAX_WALK) {
      guard += 1;
      if (STOP_TYPES.has(cur.type)) return cur;
      if (cur.type === 'serviceCall' && serviceCalls) serviceCalls.push(cur);
      if (cur.type === 'end') {
        state.status = 'completed';
        state.currentNodeId = cur.id;
        return null;
      }
      const edge = this.nextEdge(cur, def.edges, state.variables);
      if (!edge) {
        state.currentNodeId = cur.id;
        return null;
      }
      cur = nodes.find((n) => n.id === edge.target);
    }
    return cur && STOP_TYPES.has(cur.type) ? cur : null;
  }

  // ---- multi-token engine (additive) -------------------------------------
  /**
   * Multi-token orchestrator. Moves a set of freshly-entered tokens
   * (`entryNodes`) forward through the graph, mutating `active` — a MULTISET of
   * node ids where tokens currently rest. Resting tokens are human stops
   * (approval/humanTask) and tokens parked at a parallelJoin awaiting siblings.
   *
   * Node semantics:
   *  - start / form / notification / aiAssist / timer: pass through (single out).
   *    (timer keeps its legacy pass-through so the golden path is unchanged; the
   *    scheduler sweep still parks timers via the currentNodeId path.)
   *  - condition: eval expression → follow exactly one branch (nextEdge labels).
   *  - serviceCall: queue for execution (ctx.serviceCalls), then continue.
   *  - subflow: queue for synchronous child run (ctx.subflows), then continue.
   *  - parallelSplit: fork one token per outgoing edge.
   *  - parallelJoin: park a token; fire ONE token onward only when the number of
   *    parked tokens reaches the count of incoming edges (all branches arrived).
   *  - approval / humanTask: rest here — add to `active` and ctx.newStops.
   *  - end: token dies; ctx.endReached = true.
   *
   * Linear workflows (no fork/join) drive exactly one token and behave
   * identically to the legacy advance(): active ends as [] (completed) or the
   * single human stop.
   */
  private advanceMulti(
    def: WorkflowDefinitionDocument,
    entryNodes: string[],
    active: string[],
    variables: Record<string, any>,
    ctx: {
      serviceCalls: WorkflowNode[];
      subflows: WorkflowNode[];
      newStops: WorkflowNode[];
      newExternals: WorkflowNode[];
      endReached: boolean;
    },
  ): void {
    const nodes = def.nodes;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const outsOf = (id: string) => def.edges.filter((e) => e.source === id);
    const worklist = [...entryNodes];
    let guard = 0;

    while (worklist.length && guard < MAX_WALK * 4) {
      guard += 1;
      const nodeId = worklist.shift()!;
      const node = byId.get(nodeId);
      if (!node) continue;

      switch (node.type) {
        case 'approval':
        case 'humanTask': {
          active.push(node.id);
          ctx.newStops.push(node);
          break;
        }
        case 'end': {
          ctx.endReached = true;
          break; // token dies
        }
        case 'parallelSplit': {
          for (const e of outsOf(node.id)) worklist.push(e.target);
          break;
        }
        case 'parallelJoin': {
          active.push(node.id); // park this arriving token
          const parked = active.filter((n) => n === node.id).length;
          const incoming = def.edges.filter((e) => e.target === node.id).length;
          if (parked >= Math.max(1, incoming)) {
            // all branches arrived → consume parked tokens, emit ONE token
            for (let i = active.length - 1; i >= 0; i -= 1) {
              if (active[i] === node.id) active.splice(i, 1);
            }
            const out = outsOf(node.id)[0];
            if (out) worklist.push(out.target);
          }
          // else: park (token stays in active), this branch stops here
          break;
        }
        case 'condition': {
          const edge = this.nextEdge(node, def.edges, variables);
          if (edge) worklist.push(edge.target);
          break;
        }
        case 'serviceCall': {
          const mode = this.serviceCallMode((node.config ?? {}) as ConnectorNodeConfig);
          if (mode === 'AUTO') {
            // office-owned simulate → run + continue (unchanged behavior)
            ctx.serviceCalls.push(node);
            const out = outsOf(node.id)[0];
            if (out) worklist.push(out.target);
          } else {
            // external not-live → PARK the token here; a manual reference must be
            // entered before the token may advance past this External Action node.
            active.push(node.id);
            ctx.newExternals.push(node);
          }
          break;
        }
        case 'subflow': {
          ctx.subflows.push(node);
          const out = outsOf(node.id)[0];
          if (out) worklist.push(out.target);
          break;
        }
        // start / form / notification / timer / aiAssist and any other
        // automatic node: pass through the first outgoing edge.
        default: {
          const out = outsOf(node.id)[0];
          if (out) worklist.push(out.target);
          break;
        }
      }
    }
  }

  /**
   * Run a subflow node synchronously (POC). Creates a CHILD instance of the
   * referenced published workflow, auto-drives it to completion (auto-approving
   * every human step so the POC never blocks), records the child instanceCode on
   * the parent's event + audit stream, then lets the parent token continue.
   * Synchronous by design — the child is assumed to complete before the parent
   * advances. Returns the child instanceCode (or null if the child workflow is
   * missing).
   */
  private async runSubflow(
    slug: string,
    tenantId: string,
    parentInstanceId: string,
    parentInstanceCode: string,
    actorId: string,
    parentVariables: Record<string, any>,
    node: WorkflowNode,
  ): Promise<string | null> {
    const childCode: string | undefined =
      node.config?.workflowCode ?? node.config?.subWorkflowCode;
    if (!childCode) return null;
    const childDef = await this.getWorkflowSafe(slug, childCode);
    if (!childDef) return null;

    const start = childDef.nodes.find((n) => n.type === 'start');
    if (!start) return null;

    const childInstanceCode = `SUB-${Date.now().toString(36).toUpperCase()}-${this.subflowSeq++}`;

    // Auto-drive the child to completion: walk tokens, auto-clearing any human
    // stop by re-entering its outgoing edge, until no active tokens remain.
    const childVars = { ...(parentVariables ?? {}) };
    const active: string[] = [];
    let guard = 0;
    const ctx = {
      serviceCalls: [] as WorkflowNode[],
      subflows: [] as WorkflowNode[],
      newStops: [] as WorkflowNode[],
      newExternals: [] as WorkflowNode[],
      endReached: false,
    };
    const firstEdge = this.nextEdge(start, childDef.edges, childVars);
    this.advanceMulti(childDef, firstEdge ? [firstEdge.target] : [], active, childVars, ctx);
    // Auto-approve human stops until the child settles (POC: never blocks).
    while (active.length && guard < MAX_WALK) {
      guard += 1;
      ctx.newStops.length = 0;
      // pop one resting token and re-enter the node after it
      const restId = active.shift()!;
      const restNode = childDef.nodes.find((n) => n.id === restId);
      if (!restNode) continue;
      if (restNode.type === 'parallelJoin') {
        // a parked join that never fired (shouldn't happen in a well-formed POC)
        continue;
      }
      const outEdge = this.nextEdge(restNode, childDef.edges, childVars);
      this.advanceMulti(
        childDef,
        outEdge ? [outEdge.target] : [],
        active,
        childVars,
        ctx,
      );
    }

    const at = new Date();
    const childInst = await this.prisma.db.workflowInstance.create({
      data: {
        tenantId,
        workflowCode: childCode,
        instanceCode: childInstanceCode,
        title: `Subflow ${childCode} ← ${parentInstanceCode}`,
        requesterEmail: `${actorId}@${slug}.local`,
        variables: childVars as any,
        status: 'completed' as any,
        currentNodeId: null,
        activeNodes: [] as any,
        createdAt: at,
        updatedAt: at,
      },
    });

    await this.appendEvent(tenantId, parentInstanceId, 'xoffice.subflow.completed.v1', {
      nodeId: node.id,
      childWorkflowCode: childCode,
      childInstanceCode,
      childInstanceId: childInst.id,
      mode: 'synchronous-poc',
    });
    await this.appendAudit(
      tenantId,
      parentInstanceCode,
      actorId,
      'subflow.completed',
      `Subflow ${childCode} chạy đồng bộ (POC) → child ${childInstanceCode} hoàn tất`,
    );
    return childInstanceCode;
  }

  /**
   * Execute each serviceCall node crossed during an advance: resolve the
   * mapping payload, run the mock adapter (or fail on missing required),
   * persist a ConnectorCommand row + audit + event. Retry counts attempts up
   * to config.retry.maxAttempts (mock always succeeds once required is met).
   */
  private async executeServiceCalls(
    tenantId: string,
    instanceId: string,
    instanceCode: string,
    actorId: string,
    variables: Record<string, any>,
    serviceCalls: WorkflowNode[],
  ): Promise<void> {
    for (const node of serviceCalls) {
      const config = (node.config ?? {}) as ConnectorNodeConfig;
      const resolved = this.resolveConnectorPayload(config, variables);
      const maxAttempts = Math.max(1, config.retry?.maxAttempts ?? 1);
      const action = this.findAction(config.connectorCode, config.actionCode);

      await this.appendEvent(tenantId, instanceId, 'xoffice.connector.command.requested.v1', {
        nodeId: node.id,
        connectorCode: config.connectorCode,
        actionCode: config.actionCode,
        payload: resolved.payload,
      });

      let status: 'success' | 'failed';
      let result: Record<string, unknown> | null = null;
      let sourceRef: SourceReference | null = null;
      let error: string | null = null;
      let attempts: number;

      if (resolved.missingRequired.length > 0) {
        status = 'failed';
        attempts = maxAttempts; // retried up to the cap, still missing required
        error = `Thiếu trường bắt buộc: ${resolved.missingRequired.join(', ')}`;
      } else {
        status = 'success';
        attempts = 1; // mock succeeds on first attempt
        result = this.mockConnectorResult(config.connectorCode, config.actionCode, resolved.payload);
        sourceRef = this.buildSourceRef(tenantId, config.connectorCode, config.actionCode, result);
        // additive: expose the SourceReference inside result WITHOUT changing old keys
        result = { ...result, sourceRef };
      }

      await this.prisma.db.connectorCommand.create({
        data: {
          tenantId,
          instanceId,
          nodeId: node.id,
          connectorCode: config.connectorCode,
          actionCode: config.actionCode,
          payload: resolved.payload as any,
          status,
          result: result as any,
          sourceRef: sourceRef as any,
          error,
          attempts,
        },
      });

      await this.appendAudit(
        tenantId,
        instanceCode,
        actorId,
        `connector.${status}`,
        `${config.connectorCode}/${config.actionCode}` +
          (status === 'failed' ? ` — ${error}` : ` — ${JSON.stringify(result)}`),
      );

      if (status === 'success') {
        await this.appendEvent(
          tenantId,
          instanceId,
          action?.eventOnComplete ?? 'xoffice.connector.command.completed.v1',
          { nodeId: node.id, connectorCode: config.connectorCode, actionCode: config.actionCode, result },
        );
        await this.notifications.dispatch({
          tenantId,
          userId: actorId,
          type: 'connector.completed',
          title: `Lệnh ${config.connectorCode}/${config.actionCode} hoàn tất`,
          body: sourceRef ? `${sourceRef.sourceType} ${sourceRef.sourceId}` : undefined,
          sourceSystem: sourceRef?.sourceSystem,
          sourceType: sourceRef?.sourceType,
          sourceId: sourceRef?.sourceId,
          deepLink: sourceRef?.deepLink,
        });
      }
    }
  }

  /**
   * Handle serviceCall nodes whose connector is NOT live: instead of fabricating an
   * ERP document, create ONE ExternalExecution (mode=MANUAL_TASK/status=pending) with
   * the resolved mapping payload, plus a ConnectorCommand marked `manual_pending`
   * (NOT a fake "success"), audit `external_execution.created`, an event, and a
   * notification to the fallback assignee. The instance is left PARKED on this node.
   */
  private async createExternalExecutions(
    slug: string,
    tenantId: string,
    instanceId: string,
    instanceCode: string,
    actorId: string,
    variables: Record<string, any>,
    externals: WorkflowNode[],
  ): Promise<void> {
    for (const node of externals) {
      const config = (node.config ?? {}) as ConnectorNodeConfig;
      const resolved = this.resolveConnectorPayload(config, variables);
      const mode = this.serviceCallMode(config);
      const fallbackRole = config.fallbackAssigneeRole ?? 'ROLE_PROCESS_ADMIN';
      const assignee = this.resolveAssignee(slug, fallbackRole);

      const ee = await this.prisma.db.externalExecution.create({
        data: {
          tenantId,
          instanceCode,
          nodeId: node.id,
          connectorCode: config.connectorCode,
          actionCode: config.actionCode,
          mode,
          status: 'pending',
          payload: resolved.payload as any,
        },
      });

      // Persist a ConnectorCommand as a manual-pending record — NO fake success,
      // NO fabricated result / sourceRef (those come only from a real reference).
      await this.prisma.db.connectorCommand.create({
        data: {
          tenantId,
          instanceId,
          nodeId: node.id,
          connectorCode: config.connectorCode,
          actionCode: config.actionCode,
          payload: resolved.payload as any,
          status: 'manual_pending',
          result: null as any,
          sourceRef: null as any,
          error: null,
          attempts: 0,
        },
      });

      await this.appendEvent(tenantId, instanceId, 'xoffice.external_execution.created.v1', {
        externalExecutionId: ee.id,
        nodeId: node.id,
        connectorCode: config.connectorCode,
        actionCode: config.actionCode,
        mode,
        status: 'pending',
        payload: resolved.payload,
      });

      await this.appendAudit(
        tenantId,
        instanceCode,
        actorId,
        'external_execution.created',
        `${config.connectorCode}/${config.actionCode} chờ nhập mã tham chiếu thật ` +
          `(mode=${mode}, assignee=${assignee ?? `queue:${fallbackRole}`}) — KHÔNG tạo chứng từ giả`,
      );

      await this.notifications.dispatch({
        tenantId,
        userId: assignee,
        type: 'external.manual_pending',
        title: `Cần thực hiện thủ công: ${config.connectorCode}/${config.actionCode}`,
        body: `Yêu cầu ${instanceCode} đang chờ nhập mã tham chiếu thật`,
        sourceSystem: 'XOFFICE',
        sourceType: 'external-execution',
        sourceId: ee.id,
        deepLink: '/office/monitor',
        channelHint: 'xspace_card',
      });
    }
  }

  private mapExternalExecution(row: any): ExternalExecutionView {
    return {
      id: row.id,
      tenantSlug: this.slugFromTenantId(row.tenantId),
      instanceCode: row.instanceCode,
      nodeId: row.nodeId,
      connectorCode: row.connectorCode,
      actionCode: row.actionCode,
      mode: row.mode,
      status: row.status,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      referenceCode: row.referenceCode ?? null,
      referenceSystem: row.referenceSystem ?? null,
      enteredBy: row.enteredBy ?? null,
      enteredAt: row.enteredAt instanceof Date ? row.enteredAt.toISOString() : row.enteredAt ?? null,
      sourceRef: (row.sourceRef ?? null) as Record<string, unknown> | null,
      note: row.note ?? null,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    };
  }

  async listExternalExecutions(
    slug: string,
    instanceCode?: string,
  ): Promise<ExternalExecutionView[]> {
    this.assertTenant(slug);
    const tenantId = this.tenantId(slug);
    const rows = await this.prisma.db.externalExecution.findMany({
      where: { tenantId, ...(instanceCode ? { instanceCode } : {}) },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.mapExternalExecution(r));
  }

  /**
   * Enter the REAL reference code for a parked External Action, then advance the
   * instance. status pending → reference_entered → completed; a SourceReference is
   * built from the entered code (never fabricated); the parked serviceCall token is
   * consumed and the engine advances past it (possibly to END).
   */
  async enterExternalReference(
    slug: string,
    id: string,
    actorId: string,
    body: { referenceCode: string; referenceSystem?: string; note?: string },
  ) {
    this.assertTenant(slug);
    const tenantId = this.tenantId(slug);
    const referenceCode = (body?.referenceCode ?? '').trim();
    if (!referenceCode) {
      throw new NotFoundException('referenceCode (mã tham chiếu thật) là bắt buộc.');
    }
    const ee = await this.prisma.db.externalExecution.findFirst({ where: { id, tenantId } });
    if (!ee) throw new NotFoundException(`ExternalExecution ${id} không tồn tại.`);
    if (ee.status === 'completed') {
      // idempotent-ish: already done, return current state
      const inst = await this.prisma.db.workflowInstance.findUnique({
        where: { tenantId_instanceCode: { tenantId, instanceCode: ee.instanceCode } },
      });
      return {
        externalExecution: this.mapExternalExecution(ee),
        instance: inst ? await this.decorate(inst, slug) : null,
      };
    }

    const sourceRef = this.buildManualSourceRef(
      tenantId,
      ee.connectorCode,
      ee.actionCode,
      referenceCode,
      body.referenceSystem,
    );
    const enteredAt = new Date();

    // pending → reference_entered
    await this.prisma.db.externalExecution.update({
      where: { id: ee.id },
      data: {
        status: 'reference_entered',
        referenceCode,
        referenceSystem: body.referenceSystem?.trim() || sourceRef.sourceSystem,
        enteredBy: actorId,
        enteredAt,
        sourceRef: sourceRef as any,
        note: body.note ?? null,
      },
    });

    // Mark the manual ConnectorCommand completed with the REAL sourceRef.
    const cmd = await this.prisma.db.connectorCommand.findFirst({
      where: { tenantId, nodeId: ee.nodeId, status: 'manual_pending' },
      orderBy: { createdAt: 'desc' },
    });
    if (cmd) {
      await this.prisma.db.connectorCommand.update({
        where: { id: cmd.id },
        data: {
          status: 'manual_completed',
          result: { sourceRef, referenceCode, mode: ee.mode } as any,
          sourceRef: sourceRef as any,
          attempts: 1,
        },
      });
    }

    await this.appendAudit(
      tenantId,
      ee.instanceCode,
      actorId,
      'external_execution.completed',
      `${ee.connectorCode}/${ee.actionCode} — nhập mã tham chiếu THẬT ${sourceRef.sourceSystem}:${referenceCode}` +
        (body.note ? ` — ${body.note}` : ''),
    );
    await this.notifications.dispatch({
      tenantId,
      userId: actorId,
      type: 'external.completed',
      title: `${ee.connectorCode}/${ee.actionCode} đã ghi nhận mã tham chiếu`,
      body: `${sourceRef.sourceType} ${sourceRef.sourceId}`,
      sourceSystem: sourceRef.sourceSystem,
      sourceType: sourceRef.sourceType,
      sourceId: sourceRef.sourceId,
      deepLink: sourceRef.deepLink,
    });

    // Advance the instance: consume the parked serviceCall token, walk forward.
    const inst = await this.prisma.db.workflowInstance.findUnique({
      where: { tenantId_instanceCode: { tenantId, instanceCode: ee.instanceCode } },
    });
    if (inst) {
      const def = await this.getWorkflow(slug, inst.workflowCode);
      const vars = (inst.variables ?? {}) as Record<string, any>;
      const active: string[] = Array.isArray(inst.activeNodes)
        ? [...(inst.activeNodes as string[])]
        : ([inst.currentNodeId].filter(Boolean) as string[]);
      const consumeIdx = active.indexOf(ee.nodeId);
      if (consumeIdx >= 0) active.splice(consumeIdx, 1);

      const ctx = {
        serviceCalls: [] as WorkflowNode[],
        subflows: [] as WorkflowNode[],
        newStops: [] as WorkflowNode[],
        newExternals: [] as WorkflowNode[],
        endReached: false,
      };
      const parkedNode = def.nodes.find((n) => n.id === ee.nodeId);
      const edge = parkedNode ? this.nextEdge(parkedNode, def.edges, vars) : undefined;
      this.advanceMulti(def, edge ? [edge.target] : [], active, vars, ctx);

      const status = active.length ? 'running' : 'completed';
      const currentNodeId = active[0] ?? (ctx.endReached ? this.findEndId(def) : ee.nodeId);

      if (ctx.serviceCalls.length) {
        await this.executeServiceCalls(tenantId, inst.id, ee.instanceCode, actorId, vars, ctx.serviceCalls);
      }
      if (ctx.subflows.length) {
        await this.executeSubflows(slug, tenantId, inst.id, ee.instanceCode, actorId, vars, ctx.subflows);
      }
      if (ctx.newExternals.length) {
        await this.createExternalExecutions(slug, tenantId, inst.id, ee.instanceCode, actorId, vars, ctx.newExternals);
      }

      const updated = await this.prisma.db.workflowInstance.update({
        where: { id: inst.id },
        data: { status: status as any, currentNodeId, activeNodes: active as any, updatedAt: new Date() },
      });

      await this.materializeStops(slug, tenantId, inst.id, ee.instanceCode, inst.title, actorId, ctx.newStops);

      if (status === 'completed') {
        await this.appendAudit(tenantId, ee.instanceCode, actorId, 'instance.completed', 'Quy trình hoàn tất');
        await this.notifications.dispatch({
          tenantId,
          userId: inst.requesterEmail,
          type: 'request.completed',
          title: `Yêu cầu "${inst.title}" đã hoàn tất`,
          sourceSystem: 'XOFFICE',
          sourceType: 'workflow-instance',
          sourceId: ee.instanceCode,
          deepLink: '/office/monitor',
        });
      }

      // reference_entered → completed
      const done = await this.prisma.db.externalExecution.update({
        where: { id: ee.id },
        data: { status: 'completed' },
      });
      return {
        externalExecution: this.mapExternalExecution(done),
        instance: await this.decorate(updated, slug),
      };
    }

    const done = await this.prisma.db.externalExecution.update({
      where: { id: ee.id },
      data: { status: 'completed' },
    });
    return { externalExecution: this.mapExternalExecution(done), instance: null };
  }

  private async appendEvent(
    tenantId: string,
    instanceId: string,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.db.workflowEvent.create({
      data: { tenantId, instanceId, type, payload: payload as any, at: new Date() },
    });
  }

  private mapCommand(row: any, instanceCode: string): ConnectorCommandView {
    return {
      id: row.id,
      tenantSlug: this.slugFromTenantId(row.tenantId),
      instanceCode,
      nodeId: row.nodeId,
      connectorCode: row.connectorCode,
      actionCode: row.actionCode,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      status: row.status,
      result: (row.result ?? null) as Record<string, unknown> | null,
      error: row.error ?? null,
      attempts: row.attempts,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    };
  }

  async listCommands(slug: string, instanceCode: string): Promise<ConnectorCommandView[]> {
    this.assertTenant(slug);
    const tenantId = this.tenantId(slug);
    const inst = await this.prisma.db.workflowInstance.findUnique({
      where: { tenantId_instanceCode: { tenantId, instanceCode } },
    });
    if (!inst) throw new NotFoundException(`Instance ${instanceCode} không tồn tại.`);
    const rows = await this.prisma.db.connectorCommand.findMany({
      where: { tenantId, instanceId: inst.id },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.mapCommand(r, instanceCode));
  }

  // ---- CommandEnvelope + idempotency (ADR-SOR-002) -----------------------
  /** Fill missing correlation/idempotency ids at runtime (crypto, not Math.random). */
  private resolveEnvelope(
    tenantId: string,
    actorId: string,
    partial?: { correlationId?: string; idempotencyKey?: string },
  ): CommandEnvelope {
    return {
      tenantId,
      actorId,
      correlationId: partial?.correlationId?.trim() || randomUUID(),
      idempotencyKey: partial?.idempotencyKey?.trim() || randomUUID(),
    };
  }

  /** Return the stored result of a previously-processed command with this key. */
  private async findIdempotent(tenantId: string, idempotencyKey: string): Promise<any | null> {
    const row = await this.prisma.db.commandLog.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
    });
    return row ? (row.result as any) : null;
  }

  private async recordCommand(
    env: CommandEnvelope,
    commandType: string,
    resultRef: string,
    result: unknown,
  ): Promise<void> {
    await this.prisma.db.commandLog.create({
      data: {
        tenantId: env.tenantId,
        commandType,
        idempotencyKey: env.idempotencyKey,
        correlationId: env.correlationId,
        actorId: env.actorId,
        resultRef,
        result: result as any,
      },
    });
  }

  // ---- UnifiedWorkItem projection (READ MODEL, rebuildable) --------------
  /**
   * Derive UnifiedWorkItem rows from the current sources of record. Today the
   * only source is open ApprovalTask (office-owned). Pure/derived — no writes.
   * Add more sources (FinERP/HR/Mattermost) here later without schema change.
   */
  private async projectUnifiedWorkItems(tenantId: string): Promise<any[]> {
    const tasks = await this.prisma.db.approvalTask.findMany({
      where: { tenantId, status: 'open' },
      include: { instance: { select: { instanceCode: true, title: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return tasks.map((t) => {
      const dueAt =
        t.slaHours != null ? new Date(t.createdAt.getTime() + t.slaHours * 3_600_000) : null;
      return {
        tenantId,
        type: 'approval-task',
        title: `${t.nodeName} — ${t.instance.title}`,
        status: t.status,
        priority: t.slaHours != null && t.slaHours <= 8 ? 'high' : 'normal',
        assignedTo: t.assigneeRole ?? null,
        dueAt,
        sourceSystem: 'XOFFICE',
        sourceType: 'approval-task',
        sourceId: t.id,
        sourceVersion: t.createdAt.toISOString(),
        deepLink: '/office/monitor',
        ownerSystem: 'XOFFICE',
        allowedActionsSnapshot: ['approve', 'reject'] as any,
        updatedAt: new Date(),
      };
    });
  }

  /**
   * Rebuild the projection for a tenant: wipe the tenant's rows and repopulate
   * from source. Idempotent and rebuildable by design (ADR-SOR-002). Returns row count.
   */
  async rebuildProjection(slug: string): Promise<number> {
    this.assertTenant(slug);
    return this.prisma.withTenant(this.tenantId(slug), async () => {
      const tenantId = this.tenantId(slug);
      const items = await this.projectUnifiedWorkItems(tenantId);
      // Runs inside the tenant transaction (this.prisma.db). Sequential wipe +
      // repopulate is atomic within that one transaction — no nested
      // $transaction (Prisma forbids nesting an interactive transaction).
      await this.prisma.db.unifiedWorkItem.deleteMany({ where: { tenantId } });
      if (items.length) {
        await this.prisma.db.unifiedWorkItem.createMany({ data: items });
      }
      return items.length;
    });
  }

  /**
   * Read the projection. Safe strategy: rebuild lazily on read so the read model
   * is always consistent with source and can never diverge (no dual-write).
   */
  async listWorkItems(slug: string) {
    this.assertTenant(slug);
    const tenantId = this.tenantId(slug);
    await this.rebuildProjection(slug);
    return this.prisma.db.unifiedWorkItem.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'asc' },
    });
  }

  /**
   * Create an ApprovalTask row for each fresh human stop produced by an advance,
   * appending audit + assigned-notification (unchanged per-task behavior). The
   * FIRST created task is returned as the "primary" for backward compatibility
   * (createRequest.task / actOnTask.nextTask); parallel siblings are still
   * persisted and surface via listTasks.
   */
  private async materializeStops(
    slug: string,
    tenantId: string,
    instanceId: string,
    instanceCode: string,
    instanceTitle: string,
    actorId: string,
    stops: WorkflowNode[],
  ): Promise<ApprovalTask[]> {
    const created: ApprovalTask[] = [];
    for (const stop of stops) {
      const role = this.taskRole(stop);
      // Structured selector (POSITION / ORG_UNIT_HEAD / DIRECT_MANAGER / GROUP /
      // ROLE) → new Identity resolver with snapshot+audit. Plain roleCode nodes
      // (no explicit selectorType) keep the legacy flat resolver — golden path
      // unchanged.
      const assigneeUserId =
        (await this.resolveStructuredAssignee(tenantId, instanceCode, stop)) ??
        this.resolveAssignee(slug, role);
      const row = await this.prisma.db.approvalTask.create({
        data: {
          tenantId,
          instanceId,
          nodeId: stop.id,
          nodeName: stop.name,
          assigneeRole: role,
          assigneeUserId,
          status: 'open',
          slaHours: stop.config?.slaHours ?? null,
          createdAt: new Date(),
        },
      });
      created.push(this.mapTask(row, instanceCode));
      await this.appendAudit(
        tenantId,
        instanceCode,
        actorId,
        'task.created',
        `Phát sinh task "${stop.name}" (assignee=${assigneeUserId ?? `queue:${role}`})`,
      );
      await this.notifyAssigned(tenantId, instanceCode, instanceTitle, row);
    }
    return created;
  }

  /** Execute queued subflow nodes synchronously (POC), one child instance each. */
  private async executeSubflows(
    slug: string,
    tenantId: string,
    instanceId: string,
    instanceCode: string,
    actorId: string,
    variables: Record<string, any>,
    subflows: WorkflowNode[],
  ): Promise<void> {
    for (const node of subflows) {
      await this.runSubflow(slug, tenantId, instanceId, instanceCode, actorId, variables, node);
    }
  }

  async createRequest(
    slug: string,
    code: string,
    actorId: string,
    variables: Record<string, any>,
    title?: string,
    env?: { correlationId?: string; idempotencyKey?: string },
  ) {
    this.assertTenant(slug);
    const tenantId = this.tenantId(slug);
    const envelope = this.resolveEnvelope(tenantId, actorId, env);
    const replay = await this.findIdempotent(tenantId, envelope.idempotencyKey);
    if (replay) return replay;
    const def = await this.getWorkflow(slug, code);
    const start = def.nodes.find((n) => n.type === 'start');
    if (!start) throw new NotFoundException('Workflow thiếu node start.');

    const instanceCode = `REQ-${Date.now().toString(36).toUpperCase()}-${Math.floor(
      Math.random() * 1000,
    )
      .toString()
      .padStart(3, '0')}`;

    const vars = variables ?? {};
    // Multi-token advance from the node after start. Linear workflows drive a
    // single token and settle exactly as the legacy engine did.
    const active: string[] = [];
    const ctx = {
      serviceCalls: [] as WorkflowNode[],
      subflows: [] as WorkflowNode[],
      newStops: [] as WorkflowNode[],
      newExternals: [] as WorkflowNode[],
      endReached: false,
    };
    const firstEdge = this.nextEdge(start, def.edges, vars);
    this.advanceMulti(def, firstEdge ? [firstEdge.target] : [], active, vars, ctx);
    const status = active.length ? 'running' : 'completed';
    const currentNodeId = active[0] ?? (ctx.endReached ? this.findEndId(def) : start.id);

    const now = new Date();
    const inst = await this.prisma.db.workflowInstance.create({
      data: {
        tenantId,
        workflowCode: code,
        instanceCode,
        title: title ?? `${def.metadata.name} — ${instanceCode}`,
        requesterEmail: `${actorId}@${slug}.local`,
        variables: vars as any,
        status: status as any,
        currentNodeId,
        activeNodes: active as any,
        createdAt: now,
        updatedAt: now,
      },
    });
    await this.appendAudit(
      tenantId,
      instanceCode,
      actorId,
      'request.created',
      `Tạo yêu cầu theo ${code} [corr=${envelope.correlationId} idem=${envelope.idempotencyKey}]`,
    );

    if (ctx.serviceCalls.length) {
      await this.executeServiceCalls(tenantId, inst.id, instanceCode, actorId, vars, ctx.serviceCalls);
    }
    if (ctx.subflows.length) {
      await this.executeSubflows(slug, tenantId, inst.id, instanceCode, actorId, vars, ctx.subflows);
    }
    if (ctx.newExternals.length) {
      await this.createExternalExecutions(slug, tenantId, inst.id, instanceCode, actorId, vars, ctx.newExternals);
    }

    const tasks = await this.materializeStops(
      slug,
      tenantId,
      inst.id,
      instanceCode,
      inst.title,
      actorId,
      ctx.newStops,
    );
    const task: ApprovalTask | null = tasks[0] ?? null;

    if (status === 'completed') {
      await this.appendAudit(tenantId, instanceCode, actorId, 'instance.completed', 'Quy trình hoàn tất');
    }

    const response = { instance: await this.decorate(inst, slug), task, tasks };
    await this.recordCommand(envelope, 'createRequest', instanceCode, response);
    return response;
  }

  private findEndId(def: WorkflowDefinitionDocument): string | null {
    return def.nodes.find((n) => n.type === 'end')?.id ?? null;
  }

  async actOnTask(
    slug: string,
    taskId: string,
    actorId: string,
    action: 'approve' | 'reject',
    note?: string,
    env?: { correlationId?: string; idempotencyKey?: string },
  ) {
    this.assertTenant(slug);
    const tenantId = this.tenantId(slug);
    const envelope = this.resolveEnvelope(tenantId, actorId, env);
    const replay = await this.findIdempotent(tenantId, envelope.idempotencyKey);
    if (replay) return replay;
    const task = await this.prisma.db.approvalTask.findFirst({
      where: { id: taskId, tenantId },
      include: { instance: true },
    });
    if (!task) throw new NotFoundException(`Task ${taskId} không tồn tại.`);
    if (task.status !== 'open') throw new NotFoundException(`Task ${taskId} đã xử lý.`);

    const inst = task.instance;
    const instanceCode = inst.instanceCode;
    const def = await this.getWorkflow(slug, inst.workflowCode);

    // Authorization: the resolved assignee may act; OR a valid delegate acting
    // on their behalf. When the task is a role queue (no assigneeUserId), any
    // actor in the role may act (unchanged legacy behavior).
    let onBehalfOf: string | null = null;
    if (task.assigneeUserId && actorId !== task.assigneeUserId) {
      const delegate = await this.findValidDelegate(tenantId, task.assigneeUserId, actorId);
      if (!delegate) {
        throw new ForbiddenException(
          `Actor ${actorId} không phải người được giao (${task.assigneeUserId}) và không có ủy quyền hợp lệ.`,
        );
      }
      onBehalfOf = task.assigneeUserId;
    }

    await this.prisma.db.approvalTask.update({
      where: { id: task.id },
      data: {
        status: action === 'approve' ? 'approved' : 'rejected',
        actedAt: new Date(),
        actorId,
        onBehalfOf,
      },
    });
    const audit = await this.appendAudit(
      tenantId,
      instanceCode,
      actorId,
      `task.${action}`,
      `${action === 'approve' ? 'Duyệt' : 'Từ chối'} "${task.nodeName}"${note ? ` — ${note}` : ''}` +
        (onBehalfOf ? ` (acted on behalf of ${onBehalfOf})` : '') +
        ` [corr=${envelope.correlationId} idem=${envelope.idempotencyKey}]`,
    );
    // Notify the original assignee (if a delegate acted) + the requester.
    await this.notifications.dispatch({
      tenantId,
      userId: onBehalfOf ?? task.assigneeUserId,
      type: `task.${action === 'approve' ? 'approved' : 'rejected'}`,
      title: `Task "${task.nodeName}" đã ${action === 'approve' ? 'được duyệt' : 'bị từ chối'}`,
      body: onBehalfOf ? `Được xử lý thay bởi ${actorId}` : undefined,
      sourceSystem: 'XOFFICE',
      sourceType: 'approval-task',
      sourceId: task.id,
      deepLink: '/office/monitor',
    });

    let nextTask: ApprovalTask | null = null;

    if (action === 'reject') {
      const updated = await this.prisma.db.workflowInstance.update({
        where: { id: inst.id },
        data: { status: 'rejected', updatedAt: new Date() },
      });
      await this.appendAudit(
        tenantId,
        instanceCode,
        actorId,
        'instance.rejected',
        `Yêu cầu bị từ chối tại "${task.nodeName}"`,
      );
      const rejectResponse = { instance: await this.decorate(updated, slug), nextTask, audit };
      await this.recordCommand(envelope, 'actOnTask', taskId, rejectResponse);
      return rejectResponse;
    }

    // approved → consume THIS token from the instance's active set and advance.
    // Remaining resting tokens (parallel siblings still awaiting their own tasks)
    // are preserved; the join fires only once every branch has arrived.
    const vars = (inst.variables ?? {}) as Record<string, any>;
    const active: string[] = Array.isArray(inst.activeNodes)
      ? [...(inst.activeNodes as string[])]
      : ([inst.currentNodeId].filter(Boolean) as string[]);
    const consumeIdx = active.indexOf(task.nodeId);
    if (consumeIdx >= 0) active.splice(consumeIdx, 1);

    const ctx = {
      serviceCalls: [] as WorkflowNode[],
      subflows: [] as WorkflowNode[],
      newStops: [] as WorkflowNode[],
      newExternals: [] as WorkflowNode[],
      endReached: false,
    };
    const approvedNode = def.nodes.find((n) => n.id === task.nodeId);
    const edge = approvedNode ? this.nextEdge(approvedNode, def.edges, vars) : undefined;
    this.advanceMulti(def, edge ? [edge.target] : [], active, vars, ctx);

    const status = active.length ? 'running' : 'completed';
    const currentNodeId = active[0] ?? (ctx.endReached ? this.findEndId(def) : task.nodeId);

    if (ctx.serviceCalls.length) {
      await this.executeServiceCalls(tenantId, inst.id, instanceCode, actorId, vars, ctx.serviceCalls);
    }
    if (ctx.subflows.length) {
      await this.executeSubflows(slug, tenantId, inst.id, instanceCode, actorId, vars, ctx.subflows);
    }
    if (ctx.newExternals.length) {
      await this.createExternalExecutions(slug, tenantId, inst.id, instanceCode, actorId, vars, ctx.newExternals);
    }

    const updated = await this.prisma.db.workflowInstance.update({
      where: { id: inst.id },
      data: {
        status: status as any,
        currentNodeId,
        activeNodes: active as any,
        updatedAt: new Date(),
      },
    });

    const nextTasks = await this.materializeStops(
      slug,
      tenantId,
      inst.id,
      instanceCode,
      inst.title,
      actorId,
      ctx.newStops,
    );
    nextTask = nextTasks[0] ?? null;

    if (status === 'completed') {
      await this.appendAudit(tenantId, instanceCode, actorId, 'instance.completed', 'Quy trình hoàn tất');
      await this.notifications.dispatch({
        tenantId,
        userId: inst.requesterEmail,
        type: 'request.completed',
        title: `Yêu cầu "${inst.title}" đã hoàn tất`,
        sourceSystem: 'XOFFICE',
        sourceType: 'workflow-instance',
        sourceId: instanceCode,
        deepLink: '/office/monitor',
      });
    }

    const response = { instance: await this.decorate(updated, slug), nextTask, nextTasks, audit };
    await this.recordCommand(envelope, 'actOnTask', taskId, response);
    return response;
  }

  private async decorate(row: any, slug: string) {
    const def = await this.getWorkflowSafe(slug, row.workflowCode);
    const node = def?.nodes.find((n) => n.id === row.currentNodeId);
    return {
      ...this.mapInstance(row),
      currentNodeName: node?.name ?? null,
      currentNodeType: node?.type ?? null,
    };
  }

  // ---- notification helpers (operational layer) --------------------------
  private async notifyAssigned(
    tenantId: string,
    instanceCode: string,
    instanceTitle: string,
    task: { id: string; nodeName: string; assigneeUserId: string | null },
  ): Promise<void> {
    if (!task.assigneeUserId) return; // role queue: nobody concrete to notify
    await this.notifications.dispatch({
      tenantId,
      userId: task.assigneeUserId,
      type: 'task.assigned',
      title: `Bạn có task cần xử lý: "${task.nodeName}"`,
      body: `Yêu cầu: ${instanceTitle} (${instanceCode})`,
      sourceSystem: 'XOFFICE',
      sourceType: 'approval-task',
      sourceId: task.id,
      deepLink: '/office/monitor',
    });
  }

  // ---- notification endpoints (tenant + user scoped) ---------------------
  async listNotifications(slug: string, userId: string) {
    this.assertTenant(slug);
    return this.notifications.list(this.tenantId(slug), userId);
  }

  async unreadNotificationCount(slug: string, userId: string) {
    this.assertTenant(slug);
    const count = await this.notifications.unreadCount(this.tenantId(slug), userId);
    return { count };
  }

  async markNotificationRead(slug: string, userId: string, id: string) {
    this.assertTenant(slug);
    const n = await this.notifications.markRead(this.tenantId(slug), userId, id);
    if (!n) throw new NotFoundException(`Notification ${id} không tồn tại.`);
    return n;
  }

  async markAllNotificationsRead(slug: string, userId: string) {
    this.assertTenant(slug);
    const count = await this.notifications.markAllRead(this.tenantId(slug), userId);
    return { count };
  }

  // ---- delegation --------------------------------------------------------
  private mapDelegation(row: any): DelegationView {
    return {
      id: row.id,
      tenantSlug: this.slugFromTenantId(row.tenantId),
      fromUserId: row.fromUserId,
      toUserId: row.toUserId,
      fromAt: row.fromAt instanceof Date ? row.fromAt.toISOString() : row.fromAt,
      toAt: row.toAt instanceof Date ? row.toAt.toISOString() : row.toAt,
      reason: row.reason ?? null,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    };
  }

  async listDelegations(slug: string): Promise<DelegationView[]> {
    this.assertTenant(slug);
    const rows = await this.prisma.db.delegation.findMany({
      where: { tenantId: this.tenantId(slug) },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.mapDelegation(r));
  }

  /** Can `actorId` create a delegation with an arbitrary `fromUserId` (not themselves)? */
  async canGrantDelegationOnBehalf(actorId: string): Promise<{ allowed: boolean; reason: string }> {
    const decision = await this.identity.can(actorId, 'delegation.grant-any');
    return { allowed: decision.allowed, reason: decision.reason };
  }

  async createDelegation(
    slug: string,
    actorId: string,
    body: { fromUserId: string; toUserId: string; fromAt?: string; toAt?: string; reason?: string },
  ): Promise<DelegationView> {
    this.assertTenant(slug);
    const tenantId = this.tenantId(slug);
    const fromAt = body.fromAt ? new Date(body.fromAt) : new Date();
    const toAt = body.toAt ? new Date(body.toAt) : new Date(Date.now() + 7 * 24 * 3_600_000);
    const row = await this.prisma.db.delegation.create({
      data: {
        tenantId,
        fromUserId: body.fromUserId,
        toUserId: body.toUserId,
        fromAt,
        toAt,
        reason: body.reason ?? null,
      },
    });
    await this.appendAudit(
      tenantId,
      '-',
      actorId,
      'delegation.created',
      `Ủy quyền ${body.fromUserId} → ${body.toUserId} [${fromAt.toISOString()}..${toAt.toISOString()}]` +
        (body.reason ? ` — ${body.reason}` : ''),
    );
    return this.mapDelegation(row);
  }

  /** Find a delegation letting `toUserId` act for `fromUserId` at `now`. */
  private async findValidDelegate(
    tenantId: string,
    fromUserId: string,
    toUserId: string,
    now: Date = new Date(),
  ): Promise<boolean> {
    const row = await this.prisma.db.delegation.findFirst({
      where: {
        tenantId,
        fromUserId,
        toUserId,
        fromAt: { lte: now },
        toAt: { gte: now },
      },
    });
    return !!row;
  }

  // ---- SLA / reminder / escalation / timer sweep -------------------------
  /**
   * One pass of the operational worker. Scans open ApprovalTask rows across all
   * served tenants (isolation canary excluded). Emits reminders before the SLA
   * deadline, escalations after it, and advances any instance parked on a due
   * timer node. `opts.forceNow` overrides the clock; `opts.simulateOverdueTaskId`
   * forces a specific task to be treated as overdue (for the fixed demo clock).
   */
  async runSchedulerSweep(opts?: {
    forceNow?: string;
    simulateOverdueTaskId?: string;
  }): Promise<{ reminders: number; escalations: number; advanced: number }> {
    // The sweep scans OPEN tasks / RUNNING instances across ALL served tenants
    // (isolation canary excluded in-loop) → run under RLS bypass. Per-tenant
    // filtering still happens in code (slug checks) as defense-in-depth.
    return this.prisma.withBypass(async () => {
    const now = opts?.forceNow ? new Date(opts.forceNow) : new Date();
    let reminders = 0;
    let escalations = 0;
    let advanced = 0;

    const openTasks = await this.prisma.db.approvalTask.findMany({
      where: { status: 'open' },
      include: { instance: { select: { instanceCode: true, title: true, workflowCode: true } } },
    });

    for (const t of openTasks) {
      const slug = this.slugFromTenantId(t.tenantId);
      if (slug === 'demo-isolation') continue; // never operate on the canary
      const slaHours = typeof t.slaHours === 'number' && t.slaHours > 0 ? t.slaHours : DEFAULT_SLA_HOURS;
      const created = t.createdAt instanceof Date ? t.createdAt.getTime() : new Date(t.createdAt).getTime();
      const deadline = created + slaHours * 3_600_000;
      const forcedOverdue = opts?.simulateOverdueTaskId === t.id;
      const remaining = deadline - now.getTime();

      // Reminder: within the last quarter of the SLA window, once.
      if (!t.reminded && !t.escalated && !forcedOverdue && remaining > 0 && remaining <= slaHours * 3_600_000 * 0.25) {
        await this.prisma.db.approvalTask.update({ where: { id: t.id }, data: { reminded: true } });
        await this.notifications.dispatch({
          tenantId: t.tenantId,
          userId: t.assigneeUserId,
          type: 'task.reminder',
          title: `Sắp đến hạn: "${t.nodeName}"`,
          body: `Yêu cầu ${t.instance.title} (${t.instance.instanceCode})`,
          sourceSystem: 'XOFFICE',
          sourceType: 'approval-task',
          sourceId: t.id,
          deepLink: '/office/monitor',
          channelHint: 'xspace_card',
        });
        reminders += 1;
        continue;
      }

      // Escalation: past the deadline (or forced), once.
      if (!t.escalated && (forcedOverdue || now.getTime() >= deadline)) {
        await this.prisma.db.approvalTask.update({
          where: { id: t.id },
          data: { escalated: true, escalatedAt: now },
        });
        const def = await this.getWorkflowSafe(slug, t.instance.workflowCode);
        const ownerRole = def?.metadata?.ownerRoleCode ?? 'ROLE_PROCESS_ADMIN';
        const ownerUser = this.resolveAssignee(slug, ownerRole);
        await this.appendAudit(
          t.tenantId,
          t.instance.instanceCode,
          'system-scheduler',
          'task.escalated',
          `Task "${t.nodeName}" quá hạn SLA (${slaHours}h) → escalate tới ${ownerUser ?? ownerRole}`,
        );
        await this.notifications.dispatch({
          tenantId: t.tenantId,
          userId: ownerUser ?? t.assigneeUserId,
          type: 'task.escalated',
          title: `QUÁ HẠN: "${t.nodeName}" cần xử lý gấp`,
          body: `Yêu cầu ${t.instance.title} (${t.instance.instanceCode}) đã vượt SLA ${slaHours}h`,
          sourceSystem: 'XOFFICE',
          sourceType: 'approval-task',
          sourceId: t.id,
          deepLink: '/office/monitor',
          channelHint: 'xspace_card',
        });
        escalations += 1;
      }
    }

    // Timer nodes: advance any running instance parked on a due timer.
    const running = await this.prisma.db.workflowInstance.findMany({ where: { status: 'running' } });
    for (const inst of running) {
      const slug = this.slugFromTenantId(inst.tenantId);
      if (slug === 'demo-isolation') continue;
      const def = await this.getWorkflowSafe(slug, inst.workflowCode);
      if (!def || !inst.currentNodeId) continue;
      const node = def.nodes.find((n) => n.id === inst.currentNodeId);
      if (!node || node.type !== 'timer') continue;
      const dueMs = (node.config?.durationHours ?? 0) * 3_600_000;
      const base = inst.updatedAt instanceof Date ? inst.updatedAt.getTime() : new Date(inst.updatedAt).getTime();
      if (!opts?.forceNow && now.getTime() < base + dueMs) continue;
      const state = {
        status: 'running',
        currentNodeId: node.id as string | null,
        variables: (inst.variables ?? {}) as Record<string, any>,
      };
      const edge = this.nextEdge(node, def.edges, state.variables);
      const stop = edge ? this.advance(def, edge.target, state, []) : null;
      if (stop) state.currentNodeId = stop.id;
      await this.prisma.db.workflowInstance.update({
        where: { id: inst.id },
        data: { status: state.status as any, currentNodeId: state.currentNodeId, updatedAt: new Date() },
      });
      advanced += 1;
    }

    return { reminders, escalations, advanced };
    });
  }
}
