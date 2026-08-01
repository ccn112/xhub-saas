import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecordsService } from '../records/records.service';
import { AssignmentResolver } from '../identity/assignment-resolver.service';
import { IdentityService } from '../identity/identity.service';
import { RequestAction, legalActions, nextState, TRANSITIONS } from './requests.fsm';

const SUBJECT_TYPE = 'Request';

/**
 * RequestsService — the electronic-office Request module (PH-02a). A Request is a
 * human-facing record with an explicit state machine (requests.fsm.ts) that rides
 * ON TOP of the existing workflow engine. Approval routing reuses the shared
 * AssignmentResolver (the approver is resolved from role bindings — NEVER
 * hardcoded). Attachments reuse RecordDocument (subjectType='Request'); manual
 * external execution reuses the ExternalExecution MANUAL_TASK boundary (NO
 * fabricated ERP document). Runs inside the caller's withTenant(tenantId) context
 * (TenantScopeInterceptor) so every read/write is RLS-scoped.
 */
@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly records: RecordsService,
    private readonly assignment: AssignmentResolver,
    private readonly identity: IdentityService,
  ) {}

  private get db() {
    return this.prisma.db;
  }

  // ---- approver role mapping (data-driven default; never a hardcoded user) --
  private approverRoleFor(procedureCode?: string): { roleCode: string; fallback: string[] } {
    const p = (procedureCode ?? '').toUpperCase();
    // Payment / purchase-heavy procedures route to finance first, then executive.
    if (p === 'PILOT-02') return { roleCode: 'CFO', fallback: ['DEPARTMENT_HEAD', 'EXECUTIVE'] };
    return { roleCode: 'DEPARTMENT_HEAD', fallback: ['EXECUTIVE'] };
  }

  // ---- events + audit -------------------------------------------------------
  private async event(
    tenantId: string,
    requestId: string,
    type: string,
    actorId: string,
    data: Record<string, unknown> = {},
  ) {
    await this.db.requestEvent.create({ data: { tenantId, requestId, type, actorId, data: data as any } });
    await this.db.auditLog.create({
      data: { tenantId, instanceCode: requestId, actorId, action: `request.${type}`, detail: JSON.stringify(data).slice(0, 500), at: new Date() },
    });
  }

  // ---- create (DRAFT) -------------------------------------------------------
  async create(
    tenantId: string,
    actorId: string,
    body: {
      title: string;
      procedureCode?: string;
      procedureName?: string;
      kind?: string;
      summary?: string;
      amount?: number | null;
      currency?: string;
      orgUnitId?: string;
      payload?: Record<string, unknown>;
    },
  ) {
    if (!body?.title) throw new BadRequestException('title is required');
    const code = `RQ-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const req = await this.db.request.create({
      data: {
        tenantId,
        code,
        kind: body.kind ?? body.procedureCode ?? 'GENERIC',
        procedureCode: body.procedureCode ?? 'GENERIC',
        procedureName: body.procedureName ?? null,
        title: body.title,
        summary: body.summary ?? null,
        requesterId: actorId,
        orgUnitId: body.orgUnitId ?? null,
        amount: body.amount ?? null,
        currency: body.currency ?? 'VND',
        state: 'DRAFT',
        payload: (body.payload ?? {}) as any,
      },
    });
    await this.event(tenantId, req.id, 'created', actorId, { code, state: 'DRAFT' });
    return req;
  }

  // ---- list -----------------------------------------------------------------
  async list(
    tenantId: string,
    actorId: string,
    filters?: { scope?: 'mine' | 'assigned' | 'all'; state?: string; kind?: string; procedureCode?: string; q?: string },
  ) {
    const where: any = { tenantId };
    if (filters?.scope === 'mine') where.requesterId = actorId;
    if (filters?.scope === 'assigned') where.approverId = actorId;
    if (filters?.state) where.state = filters.state;
    if (filters?.kind) where.kind = filters.kind;
    if (filters?.procedureCode) where.procedureCode = filters.procedureCode;
    if (filters?.q) where.title = { contains: filters.q, mode: 'insensitive' };
    const rows = await this.db.request.findMany({ where, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => ({ ...r, legalActions: legalActions(r.state) }));
  }

  // ---- detail (events + comments + attachments) -----------------------------
  async get(tenantId: string, id: string) {
    const request = await this.db.request.findFirst({ where: { id, tenantId } });
    if (!request) throw new NotFoundException(`request not found: ${id}`);
    const [events, comments, attachments, executions] = await Promise.all([
      this.db.requestEvent.findMany({ where: { tenantId, requestId: id }, orderBy: { createdAt: 'asc' } }),
      this.db.requestComment.findMany({ where: { tenantId, requestId: id }, orderBy: { createdAt: 'asc' } }),
      this.records.listDocuments(tenantId, { subjectType: SUBJECT_TYPE, subjectId: id }),
      this.db.externalExecution.findMany({ where: { tenantId, instanceCode: request.code }, orderBy: { createdAt: 'asc' } }),
    ]);
    return { request: { ...request, legalActions: legalActions(request.state) }, events, comments, attachments, executions };
  }

  // ---- generic transition ---------------------------------------------------
  private assertLegal(action: RequestAction, from: string): string {
    const to = nextState(action, from);
    if (!to) {
      throw new BadRequestException(
        `Illegal transition '${action}' from state '${from}' (legal from: ${TRANSITIONS[action]?.from.join(', ') ?? '—'})`,
      );
    }
    return to;
  }

  private async load(tenantId: string, id: string) {
    const req = await this.db.request.findFirst({ where: { id, tenantId } });
    if (!req) throw new NotFoundException(`request not found: ${id}`);
    return req;
  }

  // ---- submit (routes approval via the engine assignment resolver) ----------
  async submit(tenantId: string, actorId: string, id: string) {
    const req = await this.load(tenantId, id);
    const to = this.assertLegal('submit', req.state);

    // Route approval THROUGH the shared engine resolver (never a hardcoded user).
    const roleSel = this.approverRoleFor(req.procedureCode);
    const resolution = await this.assignment.resolveAndSnapshot({
      tenantId,
      workflowInstanceCode: req.code,
      nodeId: 'request-approval',
      selector: { selectorType: 'ROLE', roleCode: roleSel.roleCode, fallback: roleSel.fallback, choicePolicy: 'SINGLE' },
      actorId,
    });
    const approverUserId = resolution.resolvedPersonId
      ? await this.identity.userIdForPerson(resolution.resolvedPersonId)
      : null;

    const updated = await this.db.request.update({
      where: { id },
      data: { state: to, approverId: approverUserId, approverRole: roleSel.roleCode },
    });
    await this.event(tenantId, id, 'submitted', actorId, {
      to,
      assignment: {
        via: 'assignment-resolver',
        selector: { selectorType: 'ROLE', roleCode: roleSel.roleCode, fallback: roleSel.fallback },
        resolvedPersonId: resolution.resolvedPersonId,
        approverUserId,
        reason: resolution.reason,
      },
    });
    return { request: { ...updated, legalActions: legalActions(updated.state) }, approver: { userId: approverUserId, role: roleSel.roleCode, reason: resolution.reason } };
  }

  // ---- approve (RBAC gated by guard; ABAC amount ceiling enforced here) ------
  async approve(tenantId: string, actorId: string, id: string, opts: { note?: string; enforce?: boolean }) {
    const req = await this.load(tenantId, id);
    const to = this.assertLegal('approve', req.state);
    if (opts.enforce) {
      const decision = await this.prisma.withBypass(() =>
        this.identity.can(actorId, 'request.approve', req.amount != null ? { amount: req.amount } : undefined),
      );
      if (!decision.allowed) throw new ForbiddenException(`Cannot approve: ${decision.reason}`);
    }
    const updated = await this.db.request.update({ where: { id }, data: { state: to } });
    await this.event(tenantId, id, 'approved', actorId, { to, note: opts.note ?? null, amount: req.amount });
    return { request: { ...updated, legalActions: legalActions(updated.state) } };
  }

  // ---- other simple transitions ---------------------------------------------
  async act(
    tenantId: string,
    actorId: string,
    id: string,
    action: Exclude<RequestAction, 'submit' | 'approve' | 'execute' | 'evidence'>,
    opts: { note?: string } = {},
  ) {
    const req = await this.load(tenantId, id);
    // withdraw is requester-only.
    if (action === 'withdraw' && req.requesterId !== actorId) {
      throw new ForbiddenException('Only the requester may withdraw this request.');
    }
    const to = this.assertLegal(action, req.state);
    const updated = await this.db.request.update({ where: { id }, data: { state: to } });
    await this.event(tenantId, id, action.replace('-', '_'), actorId, { to, note: opts.note ?? null });
    return { request: { ...updated, legalActions: legalActions(updated.state) } };
  }

  // ---- manual external execution (NX-023) — NO fake ERP document ------------
  async execute(tenantId: string, actorId: string, id: string, opts: { connectorCode?: string; actionCode?: string; note?: string } = {}) {
    const req = await this.load(tenantId, id);
    const to = this.assertLegal('execute', req.state);
    const connectorCode = opts.connectorCode ?? (req.payload as any)?.connectorCode ?? 'manual';
    const actionCode = opts.actionCode ?? 'execute_request';
    const ee = await this.db.externalExecution.create({
      data: {
        tenantId,
        instanceCode: req.code,
        nodeId: 'request-execute',
        connectorCode,
        actionCode,
        mode: 'MANUAL_TASK',
        status: 'pending',
        payload: { requestId: id, title: req.title, amount: req.amount } as any,
        note: opts.note ?? null,
      },
    });
    const updated = await this.db.request.update({
      where: { id },
      data: { state: to, workflowInstanceId: req.workflowInstanceId ?? null },
    });
    await this.event(tenantId, id, 'execute_started', actorId, { to, externalExecutionId: ee.id, connectorCode, actionCode, mode: 'MANUAL_TASK' });
    return { request: { ...updated, legalActions: legalActions(updated.state) }, externalExecution: ee };
  }

  // ---- evidence: attach real evidence + mark execution DONE ------------------
  async evidence(
    tenantId: string,
    actorId: string,
    id: string,
    execId: string,
    body: { referenceCode?: string; referenceSystem?: string; note?: string; evidence?: string; evidenceBase64?: string; mimeType?: string; title?: string },
  ) {
    const req = await this.load(tenantId, id);
    if (req.state !== 'EXECUTING') {
      throw new BadRequestException(`Illegal transition 'evidence' from state '${req.state}' (must be EXECUTING)`);
    }
    const ee = await this.db.externalExecution.findFirst({ where: { id: execId, tenantId, instanceCode: req.code } });
    if (!ee) throw new NotFoundException(`external execution not found: ${execId}`);

    // Evidence is a REAL RecordDocument attached to the Request (no fabricated
    // ERP doc — this is the responsible person's own evidence note/file).
    const evidenceContent = body.evidence ?? `Evidence for ${req.code}: ${body.note ?? body.referenceCode ?? 'completed'}`;
    const doc = await this.records.createDocument(tenantId, actorId, {
      kind: 'EVIDENCE',
      title: body.title ?? `Evidence — ${req.code}`,
      subjectType: SUBJECT_TYPE,
      subjectId: id,
      tags: ['evidence', 'request'],
      ...(body.evidenceBase64 ? { contentBase64: body.evidenceBase64 } : { content: evidenceContent }),
      mimeType: body.mimeType ?? 'text/plain',
    } as any);

    const referenceCode = (body.referenceCode ?? '').trim() || null;
    const sourceRef = referenceCode
      ? {
          tenantId,
          sourceSystem: (body.referenceSystem ?? ee.connectorCode).toUpperCase(),
          sourceType: ee.actionCode,
          sourceId: referenceCode,
          deepLink: `/external/${(body.referenceSystem ?? ee.connectorCode).toLowerCase()}/${encodeURIComponent(referenceCode)}`,
        }
      : null;

    await this.db.externalExecution.update({
      where: { id: ee.id },
      data: {
        status: 'completed',
        referenceCode,
        referenceSystem: body.referenceSystem ?? (referenceCode ? ee.connectorCode.toUpperCase() : null),
        enteredBy: actorId,
        enteredAt: new Date(),
        sourceRef: sourceRef as any,
        note: body.note ?? ee.note ?? null,
      },
    });

    const updated = await this.db.request.update({ where: { id }, data: { state: 'DONE' } });
    await this.event(tenantId, id, 'evidence_attached', actorId, {
      to: 'DONE',
      externalExecutionId: ee.id,
      documentId: doc.document?.id,
      referenceCode,
      sourceRef,
    });
    return { request: { ...updated, legalActions: legalActions(updated.state) }, externalExecution: await this.db.externalExecution.findUnique({ where: { id: ee.id } }), document: doc.document };
  }

  // ---- comments -------------------------------------------------------------
  async addComment(tenantId: string, actorId: string, id: string, body: { body: string; mentions?: string[] }) {
    await this.load(tenantId, id);
    if (!body?.body?.trim()) throw new BadRequestException('comment body is required');
    // Auto-extract @mentions from the body in addition to any explicit ones.
    const inline = Array.from(body.body.matchAll(/@([a-zA-Z0-9_.-]+)/g)).map((m) => m[1]);
    const mentions = Array.from(new Set([...(body.mentions ?? []), ...inline]));
    const comment = await this.db.requestComment.create({
      data: { tenantId, requestId: id, authorId: actorId, body: body.body, mentions },
    });
    await this.event(tenantId, id, 'commented', actorId, { commentId: comment.id, mentions });
    return comment;
  }

  // ---- attachments (RecordDocument subjectType=Request) ---------------------
  async addAttachment(
    tenantId: string,
    actorId: string,
    id: string,
    body: { title: string; content?: string; contentBase64?: string; mimeType?: string; tags?: string[] },
  ) {
    await this.load(tenantId, id);
    const doc = await this.records.createDocument(tenantId, actorId, {
      kind: 'ATTACHMENT',
      title: body.title,
      subjectType: SUBJECT_TYPE,
      subjectId: id,
      tags: body.tags ?? ['request'],
      content: body.content,
      contentBase64: body.contentBase64,
      mimeType: body.mimeType,
    } as any);
    await this.event(tenantId, id, 'attachment_added', actorId, { documentId: doc.document?.id, title: body.title });
    return doc;
  }
}
