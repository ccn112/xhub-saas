import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecordsService } from '../records/records.service';
import { AssignmentResolver, Selector } from '../identity/assignment-resolver.service';
import { IdentityService } from '../identity/identity.service';
import {
  CommitmentAction,
  commitmentLegalActions,
  commitmentNext,
  COMMITMENT_TERMINAL,
  COMMITMENT_TRANSITIONS,
  DirectiveAction,
  directiveLegalActions,
  directiveNext,
  DIRECTIVE_TERMINAL,
  DIRECTIVE_TRANSITIONS,
  isOverdue,
} from './directives.fsm';

const SUBJECT_TYPE = 'Directive';

/**
 * DirectivesService — the Directive / Decision / Commitment module (PH-02b —
 * NX-025). A Directive is an executive-issued record with an explicit lifecycle
 * (directives.fsm.ts) that rides ON TOP of the shared workflow engine. Audience
 * routing reuses the shared AssignmentResolver / Org Core — the assignees are
 * resolved from org structure (NEVER hardcoded) into per-assignee Commitment
 * rows (DirectiveAssignment). Evidence reuses RecordDocument
 * (subjectType='Directive'). Runs inside the caller's withTenant(tenantId)
 * context (TenantScopeInterceptor) so every read/write is RLS-scoped.
 */
@Injectable()
export class DirectivesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly records: RecordsService,
    private readonly assignment: AssignmentResolver,
    private readonly identity: IdentityService,
  ) {}

  private get db() {
    return this.prisma.db;
  }

  // ---- events + audit -------------------------------------------------------
  private async event(
    tenantId: string,
    directiveId: string,
    type: string,
    actorId: string,
    data: Record<string, unknown> = {},
  ) {
    await this.db.directiveEvent.create({ data: { tenantId, directiveId, type, actorId, data: data as any } });
    await this.db.auditLog.create({
      data: {
        tenantId,
        instanceCode: directiveId,
        actorId,
        action: `directive.${type}`,
        detail: JSON.stringify(data).slice(0, 500),
        at: new Date(),
      },
    });
  }

  private overdue(dueAt: Date | null, state: string, terminal: string[]) {
    return isOverdue(dueAt, state, terminal);
  }

  // ---- create (DRAFT) -------------------------------------------------------
  async create(
    tenantId: string,
    actorId: string,
    body: {
      title: string;
      body?: string;
      audienceType?: string;
      audienceId?: string;
      priority?: string;
      dueAt?: string | null;
      code?: string;
    },
  ) {
    if (!body?.title) throw new BadRequestException('title is required');
    const audienceType = (body.audienceType ?? 'ORG_UNIT').toUpperCase();
    if (!['ORG_UNIT', 'POSITION', 'USER', 'GROUP'].includes(audienceType)) {
      throw new BadRequestException(`audienceType must be one of ORG_UNIT/POSITION/USER/GROUP (got ${audienceType})`);
    }
    const code =
      body.code ?? `DIR-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const dir = await this.db.directive.create({
      data: {
        tenantId,
        code,
        title: body.title,
        body: body.body ?? null,
        issuerId: actorId,
        audienceType,
        audienceId: body.audienceId ?? null,
        priority: (body.priority ?? 'NORMAL').toUpperCase(),
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        state: 'DRAFT',
      },
    });
    await this.event(tenantId, dir.id, 'created', actorId, { code, state: 'DRAFT', audienceType, audienceId: body.audienceId ?? null });
    return dir;
  }

  // ---- list -----------------------------------------------------------------
  async list(
    tenantId: string,
    actorId: string,
    filters?: { scope?: 'issued' | 'assigned' | 'all'; state?: string; q?: string; page?: number; pageSize?: number },
  ) {
    const where: any = { tenantId };
    if (filters?.scope === 'issued') where.issuerId = actorId;
    if (filters?.state) where.state = filters.state;
    if (filters?.q) where.title = { contains: filters.q, mode: 'insensitive' };

    // 'assigned' scope: directives where the actor holds a commitment.
    if (filters?.scope === 'assigned') {
      const mine = await this.db.directiveAssignment.findMany({ where: { tenantId, assigneeId: actorId }, select: { directiveId: true } });
      where.id = { in: mine.map((a) => a.directiveId).length ? mine.map((a) => a.directiveId) : ['__none__'] };
    }

    const rows = await this.db.directive.findMany({ where, orderBy: { createdAt: 'desc' } });
    const enriched = await Promise.all(
      rows.map(async (r) => {
        const assignments = await this.db.directiveAssignment.count({ where: { tenantId, directiveId: r.id } });
        return {
          ...r,
          assignmentCount: assignments,
          overdue: this.overdue(r.dueAt, r.state, DIRECTIVE_TERMINAL),
          legalActions: directiveLegalActions(r.state),
        };
      }),
    );

    const page = Math.max(1, filters?.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, filters?.pageSize ?? 20));
    const total = enriched.length;
    const items = enriched.slice((page - 1) * pageSize, page * pageSize);
    return { items, total, page, pageSize };
  }

  // ---- detail (assignments + events + evidence) -----------------------------
  async get(tenantId: string, id: string) {
    const directive = await this.load(tenantId, id);
    const [assignmentsRaw, events, evidence] = await Promise.all([
      this.db.directiveAssignment.findMany({ where: { tenantId, directiveId: id }, orderBy: { createdAt: 'asc' } }),
      this.db.directiveEvent.findMany({ where: { tenantId, directiveId: id }, orderBy: { createdAt: 'asc' } }),
      this.records.listDocuments(tenantId, { subjectType: SUBJECT_TYPE, subjectId: id }),
    ]);
    const assignments = assignmentsRaw.map((a) => ({
      ...a,
      overdue: this.overdue(a.dueAt, a.state, COMMITMENT_TERMINAL),
      legalActions: commitmentLegalActions(a.state),
    }));
    return {
      directive: {
        ...directive,
        overdue: this.overdue(directive.dueAt, directive.state, DIRECTIVE_TERMINAL),
        legalActions: directiveLegalActions(directive.state),
      },
      assignments,
      events,
      evidence,
    };
  }

  private async load(tenantId: string, id: string) {
    const dir = await this.db.directive.findFirst({ where: { id, tenantId } });
    if (!dir) throw new NotFoundException(`directive not found: ${id}`);
    return dir;
  }

  private async loadAssignment(tenantId: string, directiveId: string, aid: string) {
    const a = await this.db.directiveAssignment.findFirst({ where: { id: aid, tenantId, directiveId } });
    if (!a) throw new NotFoundException(`directive assignment not found: ${aid}`);
    return a;
  }

  private assertDirectiveLegal(action: DirectiveAction, from: string): string {
    const to = directiveNext(action, from);
    if (!to) {
      throw new BadRequestException(
        `Illegal directive transition '${action}' from state '${from}' (legal from: ${DIRECTIVE_TRANSITIONS[action]?.from.join(', ') ?? '—'})`,
      );
    }
    return to;
  }

  private assertCommitmentLegal(action: CommitmentAction, from: string): string {
    const to = commitmentNext(action, from);
    if (!to) {
      throw new BadRequestException(
        `Illegal commitment transition '${action}' from state '${from}' (legal from: ${COMMITMENT_TRANSITIONS[action]?.from.join(', ') ?? '—'})`,
      );
    }
    return to;
  }

  // ---- audience → selector (data-driven; NO hardcoded assignee) -------------
  private selectorForAudience(audienceType: string, audienceId?: string | null): Selector {
    switch (audienceType) {
      case 'POSITION':
        return { selectorType: 'POSITION', positionId: audienceId ?? undefined, choicePolicy: 'MULTIPLE' };
      case 'GROUP':
        return { selectorType: 'GROUP', groupId: audienceId ?? undefined, choicePolicy: 'MULTIPLE' };
      case 'ORG_UNIT':
        // Whole-unit directive → all position holders of the org unit (see resolveOrgUnitMembers).
        return { selectorType: 'ORG_UNIT_HEAD', orgUnitId: audienceId ?? undefined, choicePolicy: 'MULTIPLE' };
      case 'USER':
      default:
        return { selectorType: 'ROLE', roleCode: undefined };
    }
  }

  /** Resolve every position holder in an org unit (a directive addresses the whole unit). */
  private async resolveOrgUnitMembers(orgUnitId: string): Promise<string[]> {
    const positions = await this.db.position.findMany({ where: { orgUnitId } });
    const personIds = positions.map((p: any) => p.holderPersonId).filter((x: any): x is string => !!x);
    return [...new Set(personIds)];
  }

  // ---- issue: resolve audience → DirectiveAssignments -----------------------
  async issue(tenantId: string, actorId: string, id: string) {
    const dir = await this.load(tenantId, id);
    const to = this.assertDirectiveLegal('issue', dir.state);

    // Resolve the audience into a concrete person list via the Org Core /
    // AssignmentResolver — NEVER a hardcoded assignee.
    let personIds: string[] = [];
    let provenance: any = { audienceType: dir.audienceType, audienceId: dir.audienceId };

    if (dir.audienceType === 'USER') {
      // A single named user is still resolved through identity (person ⇄ user).
      const person = dir.audienceId ? await this.identity.personForUserId(dir.audienceId) : null;
      personIds = person ? [person.id] : dir.audienceId ? [dir.audienceId] : [];
      provenance = { ...provenance, via: 'identity.personForUserId', resolvedPersonIds: personIds };
    } else if (dir.audienceType === 'ORG_UNIT' && dir.audienceId) {
      // Whole-unit directive: every position holder in the unit.
      personIds = await this.resolveOrgUnitMembers(dir.audienceId);
      provenance = { ...provenance, via: 'org-core:orgUnit-members', resolvedPersonIds: personIds };
      // Snapshot for audit (mirrors resolver provenance) even for the member-list path.
      await this.assignment
        .resolveAndSnapshot({
          tenantId,
          workflowInstanceCode: dir.code,
          nodeId: 'directive-audience',
          selector: { selectorType: 'ORG_UNIT_HEAD', orgUnitId: dir.audienceId, choicePolicy: 'MULTIPLE' },
          actorId,
        })
        .catch(() => undefined);
    } else {
      // POSITION / GROUP → resolve candidates through the shared resolver.
      const selector = this.selectorForAudience(dir.audienceType, dir.audienceId);
      const resolution = await this.assignment.resolveAndSnapshot({
        tenantId,
        workflowInstanceCode: dir.code,
        nodeId: 'directive-audience',
        selector,
        actorId,
      });
      personIds = resolution.candidates.map((c) => c.personId);
      provenance = { ...provenance, via: 'assignment-resolver', selector, resolvedPersonIds: personIds, reason: resolution.reason };
    }

    if (personIds.length === 0) {
      throw new BadRequestException(
        `Cannot issue directive: audience (${dir.audienceType}${dir.audienceId ? ':' + dir.audienceId : ''}) resolved to 0 assignees`,
      );
    }

    // Map person ids → session user ids (assignee identity) and create commitments.
    const assignments: any[] = [];
    for (const personId of personIds) {
      const assigneeUserId = (await this.identity.userIdForPerson(personId)) ?? personId;
      const a = await this.db.directiveAssignment.create({
        data: {
          tenantId,
          directiveId: id,
          assigneeId: assigneeUserId,
          state: 'ASSIGNED',
          dueAt: dir.dueAt,
        },
      });
      assignments.push(a);
    }

    const updated = await this.db.directive.update({ where: { id }, data: { state: to } });
    await this.event(tenantId, id, 'issued', actorId, {
      to,
      assignmentCount: assignments.length,
      assignment: { ...provenance, assigneeUserIds: assignments.map((a) => a.assigneeId) },
    });
    return {
      directive: { ...updated, legalActions: directiveLegalActions(updated.state) },
      assignments,
      provenance,
    };
  }

  // ---- directive-level actions (complete / cancel) --------------------------
  async directiveAct(tenantId: string, actorId: string, id: string, action: 'complete' | 'cancel', opts: { note?: string } = {}) {
    const dir = await this.load(tenantId, id);
    // Issuer-only for complete/cancel.
    if (dir.issuerId !== actorId) {
      const decision = await this.prisma.withBypass(() => this.identity.can(actorId, 'directive.issue'));
      if (!decision.allowed && dir.issuerId !== actorId) {
        throw new ForbiddenException(`Only the issuer (or an EXECUTIVE) may ${action} this directive.`);
      }
    }
    const to = this.assertDirectiveLegal(action, dir.state);
    const updated = await this.db.directive.update({ where: { id }, data: { state: to } });
    await this.event(tenantId, id, action, actorId, { to, note: opts.note ?? null });
    return { directive: { ...updated, legalActions: directiveLegalActions(updated.state) } };
  }

  // ---- commitment (per-assignee) transitions --------------------------------
  async commitmentAct(
    tenantId: string,
    actorId: string,
    id: string,
    aid: string,
    action: CommitmentAction,
    opts: { note?: string; progress?: number } = {},
  ) {
    const dir = await this.load(tenantId, id);
    const a = await this.loadAssignment(tenantId, id, aid);
    const to = this.assertCommitmentLegal(action, a.state);

    const data: any = { state: to };
    if (typeof opts.progress === 'number') data.progress = Math.max(0, Math.min(100, opts.progress));
    if (opts.note != null) data.note = opts.note;
    if (action === 'submit') {
      data.committedAt = a.committedAt ?? new Date();
      if (data.progress == null && a.progress == null) data.progress = 100;
    }
    if (action === 'accept') data.progress = 100;

    const updated = await this.db.directiveAssignment.update({ where: { id: aid }, data });

    // First commitment activity moves the directive ISSUED → IN_PROGRESS.
    if ((action === 'acknowledge' || action === 'start') && dir.state === 'ISSUED') {
      await this.db.directive.update({ where: { id }, data: { state: 'IN_PROGRESS' } });
      await this.event(tenantId, id, 'progress', actorId, { to: 'IN_PROGRESS', trigger: `commitment.${action}` });
    }

    await this.event(tenantId, id, `commitment.${action}`, actorId, { assignmentId: aid, to, note: opts.note ?? null, progress: data.progress ?? updated.progress });
    return {
      assignment: { ...updated, overdue: this.overdue(updated.dueAt, updated.state, COMMITMENT_TERMINAL), legalActions: commitmentLegalActions(updated.state) },
    };
  }

  // ---- evidence: real RecordDocument attached to the Directive --------------
  async evidence(
    tenantId: string,
    actorId: string,
    id: string,
    body: { title?: string; note?: string; content?: string; contentBase64?: string; mimeType?: string; assignmentId?: string },
  ) {
    const dir = await this.load(tenantId, id);
    const evidenceContent = body.content ?? `Evidence for ${dir.code}: ${body.note ?? 'commitment evidence'}`;
    const doc = await this.records.createDocument(tenantId, actorId, {
      kind: 'EVIDENCE',
      title: body.title ?? `Evidence — ${dir.code}`,
      subjectType: SUBJECT_TYPE,
      subjectId: id,
      tags: ['evidence', 'directive'],
      ...(body.contentBase64 ? { contentBase64: body.contentBase64 } : { content: evidenceContent }),
      mimeType: body.mimeType ?? 'text/plain',
    } as any);
    await this.event(tenantId, id, 'evidence_attached', actorId, { documentId: doc.document?.id, assignmentId: body.assignmentId ?? null, title: doc.document?.title });
    return doc;
  }
}
