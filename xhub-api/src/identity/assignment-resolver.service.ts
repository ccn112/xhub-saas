import { Inject, Injectable } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { IDENTITY_PRISMA } from './identity-prisma.token';
import type { IdentityPrismaClient } from './identity-prisma.token';

export type SelectorType =
  | 'POSITION'
  | 'ORG_UNIT_HEAD'
  | 'DIRECT_MANAGER'
  | 'ROLE'
  | 'GROUP';

export interface Selector {
  selectorType: SelectorType;
  positionId?: string;
  orgUnitId?: string;
  orgUnitFrom?: string; // path into variables, e.g. "request.departmentId"
  personId?: string; // for DIRECT_MANAGER
  requesterUserId?: string; // for DIRECT_MANAGER (session user of requester)
  roleCode?: string; // for ROLE
  groupId?: string; // for GROUP
  choicePolicy?: 'SINGLE' | 'MULTIPLE' | 'QUEUE';
  fallback?: string[]; // fallback role codes
}

export interface Candidate {
  personId: string;
  fullName: string;
  email: string | null;
  via: string;
}

export interface ResolutionResult {
  selector: Selector;
  candidates: Candidate[];
  resolvedPersonId: string | null;
  choicePolicy: 'SINGLE' | 'MULTIPLE' | 'QUEUE';
  fallbackApplied: boolean;
  reason: string;
}

/**
 * AssignmentResolver — resolves a workflow assignee from a STRUCTURED selector
 * (docs/03) against the Identity/Org Core, returning a CANDIDATE LIST plus a
 * chosen person under a choice policy (SINGLE / MULTIPLE / QUEUE). Every run is
 * snapshotted into AssignmentResolution (input + candidates + resolved +
 * org/policy versions) for audit — the result is deterministic and never random.
 *
 * XOffice's legacy flat resolver (roleCode → 1 email) stays untouched; the
 * engine calls THIS resolver only when a node carries a structured selector,
 * and falls back to the flat one for plain roleCode nodes (backward-compat).
 */
@Injectable()
export class AssignmentResolver {
  constructor(
    @Inject(IDENTITY_PRISMA) private readonly prisma: IdentityPrismaClient,
    private readonly identity: IdentityService,
  ) {}

  /**
   * Build a selector from a workflow node's `config.assignment`. Structured
   * selectors are used as-is; a plain `{ type:'role', roleCode }` becomes a ROLE
   * selector so the Org Core can still produce candidates for preview.
   * Returns null when there is nothing to resolve (caller keeps legacy behavior).
   */
  selectorFromAssignment(assignment: any, variables?: Record<string, any>): Selector | null {
    if (!assignment) return null;
    const t = assignment.selectorType ?? assignment.type;
    switch (t) {
      case 'POSITION':
        return { selectorType: 'POSITION', positionId: assignment.positionId, choicePolicy: assignment.choicePolicy, fallback: assignment.fallback };
      case 'ORG_UNIT_HEAD':
        return {
          selectorType: 'ORG_UNIT_HEAD',
          orgUnitId: assignment.orgUnitId ?? this.readPath(variables, assignment.orgUnitFrom),
          choicePolicy: assignment.choicePolicy,
          fallback: assignment.fallback,
        };
      case 'DIRECT_MANAGER':
      case 'requesterManager':
        return { selectorType: 'DIRECT_MANAGER', personId: assignment.personId, requesterUserId: assignment.requesterUserId, choicePolicy: assignment.choicePolicy, fallback: assignment.fallback };
      case 'GROUP':
        return { selectorType: 'GROUP', groupId: assignment.groupId, choicePolicy: assignment.choicePolicy ?? 'QUEUE', fallback: assignment.fallback };
      case 'ROLE':
      case 'role':
      case 'org_role':
        return { selectorType: 'ROLE', roleCode: assignment.roleCode, choicePolicy: assignment.choicePolicy, fallback: assignment.fallback };
      default:
        // Unknown structured type but a roleCode is present → treat as ROLE.
        if (assignment.roleCode) return { selectorType: 'ROLE', roleCode: assignment.roleCode, fallback: assignment.fallback };
        return null;
    }
  }

  private readPath(obj: any, path?: string): string | undefined {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
  }

  private async personCandidate(personId: string | null | undefined, via: string): Promise<Candidate[]> {
    if (!personId) return [];
    const p = await this.prisma.db.personProfile.findUnique({ where: { id: personId } });
    if (!p) return [];
    return [{ personId: p.id, fullName: p.fullName, email: p.email ?? null, via }];
  }

  /** Resolve candidate persons for a selector (no snapshot written). */
  async resolveCandidates(selector: Selector): Promise<{ candidates: Candidate[]; reason: string }> {
    switch (selector.selectorType) {
      case 'POSITION': {
        const pos = selector.positionId
          ? await this.prisma.db.position.findUnique({ where: { id: selector.positionId } })
          : null;
        const cands = await this.personCandidate(pos?.holderPersonId, `POSITION:${selector.positionId}`);
        return { candidates: cands, reason: pos ? (cands.length ? 'position holder' : 'position vacant') : 'position not found' };
      }
      case 'ORG_UNIT_HEAD': {
        const head = selector.orgUnitId
          ? await this.prisma.db.position.findFirst({ where: { orgUnitId: selector.orgUnitId, isHead: true } })
          : null;
        const cands = await this.personCandidate(head?.holderPersonId, `ORG_UNIT_HEAD:${selector.orgUnitId}`);
        return { candidates: cands, reason: head ? (cands.length ? 'org unit head' : 'head position vacant') : 'no head for org unit' };
      }
      case 'DIRECT_MANAGER': {
        let personId = selector.personId;
        if (!personId && selector.requesterUserId) {
          const person = await this.identity.personForUserId(selector.requesterUserId);
          personId = person?.id;
        }
        if (!personId) return { candidates: [], reason: 'no subject person for direct manager' };
        const heldPos = await this.prisma.db.position.findFirst({ where: { holderPersonId: personId } });
        if (!heldPos?.reportsToPositionId) return { candidates: [], reason: 'no reporting line' };
        const mgrPos = await this.prisma.db.position.findUnique({ where: { id: heldPos.reportsToPositionId } });
        const cands = await this.personCandidate(mgrPos?.holderPersonId, `DIRECT_MANAGER:${heldPos.reportsToPositionId}`);
        return { candidates: cands, reason: cands.length ? 'direct manager (reportsTo)' : 'manager position vacant' };
      }
      case 'GROUP': {
        const grp = selector.groupId ? await this.prisma.db.group.findUnique({ where: { id: selector.groupId } }) : null;
        const ids = (grp?.memberPersonIds ?? []) as string[];
        const cands: Candidate[] = [];
        for (const id of ids) cands.push(...(await this.personCandidate(id, `GROUP:${selector.groupId}`)));
        return { candidates: cands, reason: grp ? `group ${ids.length} member(s)` : 'group not found' };
      }
      case 'ROLE': {
        if (!selector.roleCode) return { candidates: [], reason: 'no roleCode' };
        const bindings = await this.prisma.db.roleBinding.findMany({ where: { roleCode: selector.roleCode } });
        const cands: Candidate[] = [];
        for (const b of bindings as any[]) {
          if (b.subjectType === 'POSITION') {
            const pos = await this.prisma.db.position.findUnique({ where: { id: b.subjectId } });
            cands.push(...(await this.personCandidate(pos?.holderPersonId, `ROLE:${selector.roleCode}→POSITION:${b.subjectId}`)));
          } else if (b.subjectType === 'USER') {
            cands.push(...(await this.personCandidate(b.subjectId, `ROLE:${selector.roleCode}→USER`)));
          } else if (b.subjectType === 'GROUP') {
            const grp = await this.prisma.db.group.findUnique({ where: { id: b.subjectId } });
            for (const id of (grp?.memberPersonIds ?? []) as string[]) {
              cands.push(...(await this.personCandidate(id, `ROLE:${selector.roleCode}→GROUP:${b.subjectId}`)));
            }
          } else if (b.subjectType === 'ORG_UNIT') {
            const head = await this.prisma.db.position.findFirst({ where: { orgUnitId: b.subjectId, isHead: true } });
            cands.push(...(await this.personCandidate(head?.holderPersonId, `ROLE:${selector.roleCode}→ORG_UNIT_HEAD:${b.subjectId}`)));
          }
        }
        return { candidates: cands, reason: `role bindings: ${bindings.length}` };
      }
      default:
        return { candidates: [], reason: 'unknown selector' };
    }
  }

  /**
   * Full resolve: candidates → choice policy → WRITE AssignmentResolution
   * snapshot (+ audit). Deterministic: candidates are de-duplicated and ordered
   * by personId; SINGLE picks the first. Applies `fallback` roles when the
   * primary selector yields no candidate.
   */
  async resolveAndSnapshot(params: {
    tenantId: string;
    workflowInstanceCode: string;
    nodeId: string;
    selector: Selector;
    actorId?: string;
  }): Promise<ResolutionResult> {
    const { tenantId, workflowInstanceCode, nodeId, selector } = params;
    let { candidates, reason } = await this.resolveCandidates(selector);
    let fallbackApplied = false;

    // Fallback chain: try each fallback role until a candidate is found.
    if (candidates.length === 0 && selector.fallback?.length) {
      for (const roleCode of selector.fallback) {
        const fb = await this.resolveCandidates({ selectorType: 'ROLE', roleCode });
        if (fb.candidates.length) {
          candidates = fb.candidates;
          reason = `fallback → ROLE:${roleCode} (${fb.reason})`;
          fallbackApplied = true;
          break;
        }
      }
    }

    // De-duplicate + deterministic order.
    const seen = new Set<string>();
    candidates = candidates
      .filter((c) => (seen.has(c.personId) ? false : (seen.add(c.personId), true)))
      .sort((a, b) => a.personId.localeCompare(b.personId));

    const choicePolicy = selector.choicePolicy ?? (candidates.length > 1 ? 'MULTIPLE' : 'SINGLE');
    const resolvedPersonId =
      choicePolicy === 'QUEUE' ? null : candidates.length ? candidates[0].personId : null;

    if (candidates.length === 0) reason = `${reason}; NO CANDIDATE (needs escalation/admin)`;
    else if (candidates.length > 1 && choicePolicy === 'SINGLE') reason = `${reason}; multiple holders → picked deterministic first`;

    const snapshot = await this.prisma.db.assignmentResolution.create({
      data: {
        tenantId,
        workflowInstanceCode,
        nodeId,
        selector: selector as any,
        candidates: candidates as any,
        resolvedPersonId,
        choicePolicy,
        fallbackApplied,
        reason,
        policyVersion: '1',
        orgVersion: '1',
      },
    });

    // Append-only audit trail (mirrors XOffice AuditLog).
    await this.prisma.db.auditLog.create({
      data: {
        tenantId,
        actorId: params.actorId ?? 'system:resolver',
        instanceCode: workflowInstanceCode,
        action: 'ASSIGNMENT_RESOLVED',
        detail: `node=${nodeId} selector=${selector.selectorType} candidates=${candidates.length} resolved=${resolvedPersonId ?? '(queue/none)'} snapshot=${snapshot.id}`,
      },
    });

    return { selector, candidates, resolvedPersonId, choicePolicy, fallbackApplied, reason };
  }
}
