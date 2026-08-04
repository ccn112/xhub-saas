import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseInterceptors } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { AssignmentResolver } from './assignment-resolver.service';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { isEnforcing } from '../auth/identity.types';
import { TenantScopeInterceptor } from '../common/tenant-scope.interceptor';

/**
 * Identity/Org Core API. Tenant-scoped: TenantScopeInterceptor wraps every
 * handler in prisma.withTenant(identity.tenantId) so all reads are RLS-scoped
 * (the demo-isolation canary is never served through here).
 */
@Controller('api/identity')
@UseInterceptors(TenantScopeInterceptor)
export class IdentityController {
  constructor(
    private readonly identity: IdentityService,
    private readonly resolver: AssignmentResolver,
    private readonly prisma: PrismaService,
  ) {}

  @Get('org-units')
  orgUnits() {
    return this.identity.orgUnitTree();
  }

  /**
   * Flat (non-tree) OrgUnit rows — for X.Office's identity-sync job (Phase 1.5
   * Stage C.4), not for UI rendering. `orgUnits()` above shapes a tree, which
   * a cache-sync consumer would just have to flatten back out.
   */
  @Get('org-units/flat')
  orgUnitsFlat() {
    return this.identity.listOrgUnitsFlat();
  }

  @Get('positions')
  positions() {
    return this.identity.listPositions();
  }

  /**
   * Update an org unit (drag-and-drop reparent + rename/retype/change head).
   * Accepts any subset of { name, type, headId, parentId }. Tenant-scoped +
   * cycle-guarded. Backward-compatible with the reparent-only { parentId } call.
   */
  @Patch('org-units/:id')
  @RequirePermission('org.write')
  updateOrgUnit(
    @Param('id') id: string,
    @Body() body: { name?: string; type?: string; headId?: string | null; parentId?: string | null },
    @Identity() identity: RequestIdentity,
  ) {
    return this.identity.updateOrgUnit(
      id,
      { name: body?.name, type: body?.type, headId: body?.headId, parentId: body?.parentId },
      { parentId: !!body && 'parentId' in body, headId: !!body && 'headId' in body },
      identity.tenantId,
    );
  }

  /** Create a child org unit. Tenant-scoped; 409 on duplicate code. */
  @Post('org-units')
  @RequirePermission('org.write')
  createOrgUnit(
    @Body() body: { code: string; name: string; type: string; parentId: string | null },
    @Identity() identity: RequestIdentity,
  ) {
    return this.identity.createOrgUnit(body ?? {}, identity.tenantId);
  }

  /** Delete a leaf/empty org unit. Tenant-scoped; 409 if it has children/positions. */
  @Delete('org-units/:id')
  @RequirePermission('org.write')
  deleteOrgUnit(@Param('id') id: string) {
    return this.identity.deleteOrgUnit(id);
  }

  /**
   * Update a position (setup mode). Backward-compatible: `{ orgUnitId }` moves
   * the position (unchanged). Additively accepts `{ holderPersonId, effectiveFrom?,
   * reason? }` to set/replace the PRIMARY holder effective-dated (records a
   * PositionAssignment + syncs holderPersonId). Both may be present.
   */
  @Patch('positions/:id')
  @RequirePermission('position.write')
  async movePosition(
    @Param('id') id: string,
    @Body() body: { orgUnitId?: string; holderPersonId?: string | null; effectiveFrom?: string | null; reason?: string | null },
    @Identity() identity: RequestIdentity,
  ) {
    if (body && 'orgUnitId' in body && body.orgUnitId) {
      await this.identity.movePosition(id, body.orgUnitId);
    }
    if (body && 'holderPersonId' in body) {
      return this.identity.setPositionHolder(
        id,
        { holderPersonId: body.holderPersonId, effectiveFrom: body.effectiveFrom, reason: body.reason },
        identity.tenantId,
        identity.userId,
      );
    }
    return this.identity.listPositions().then((rows) => rows.find((p: any) => p.id === id) ?? { ok: true, id });
  }

  // ---- position assignments / holder history (PH-01 / NX-013) --------------

  /** Holder + acting history for a position (newest first, with status). */
  @Get('positions/:id/assignments')
  positionAssignments(@Param('id') id: string) {
    return this.identity.listPositionAssignments(id);
  }

  /** Create a PRIMARY/ACTING assignment (effective-dated). Guardrailed + audited. */
  @Post('positions/:id/assignments')
  @RequirePermission('position.assign')
  createPositionAssignment(
    @Param('id') id: string,
    @Body() body: { personId?: string; kind?: string; effectiveFrom?: string; effectiveTo?: string | null; reason?: string | null },
    @Identity() ident: RequestIdentity,
  ) {
    return this.identity.createPositionAssignment(id, body ?? {}, ident.tenantId, ident.userId);
  }

  /** Revoke an assignment (+ re-derive current primary + audit). */
  @Delete('positions/:id/assignments/:assignmentId')
  @RequirePermission('position.assign')
  deletePositionAssignment(
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
    @Identity() ident: RequestIdentity,
  ) {
    return this.identity.deletePositionAssignment(id, assignmentId, ident.tenantId, ident.userId);
  }

  @Get('people')
  people() {
    return this.identity.listPeople();
  }

  @Get('groups')
  groups() {
    return this.identity.listGroups();
  }

  @Get('role-bindings')
  roleBindings() {
    return this.identity.listRoleBindings();
  }

  /** Read-only, for X.Office's identity-sync job (Stage C.5) — same pattern as org-units/flat. */
  @Get('permission-policies')
  permissionPolicies() {
    return this.identity.listPermissionPolicies();
  }

  /** Create a role binding (NX-011). Validates roleCode + subject; audits. */
  @Post('role-bindings')
  @RequirePermission('role.binding.write')
  createRoleBinding(
    @Body() body: { subjectType?: string; subjectId?: string; roleCode?: string; scope?: any; effectiveFrom?: string | null; effectiveTo?: string | null },
    @Identity() id: RequestIdentity,
  ) {
    return this.identity.createRoleBinding(body ?? {}, id.tenantId, id.userId);
  }

  /**
   * Impact preview for a prospective binding — the permissions it would add vs.
   * those the subject already holds. Read-only (no write). Placed before :id so
   * "preview" is never captured as a binding id.
   */
  @Post('role-bindings/preview')
  @RequirePermission('role.binding.write')
  previewRoleBinding(@Body() body: { subjectId?: string; roleCode?: string }) {
    return this.identity.previewRoleBinding(body ?? {});
  }

  /** Remove a role binding (NX-011). Audits. */
  @Delete('role-bindings/:id')
  @RequirePermission('role.binding.write')
  deleteRoleBinding(@Param('id') id: string, @Identity() ident: RequestIdentity) {
    return this.identity.deleteRoleBinding(id, ident.tenantId, ident.userId);
  }

  // ---- delegations (NX-012) ------------------------------------------------

  @Get('delegations')
  delegations() {
    return this.identity.listDelegations();
  }

  /** Create a delegation with self/overlap/cycle guardrails. Audits. */
  @Post('delegations')
  @RequirePermission('delegation.write')
  createDelegation(
    @Body() body: { fromUserId?: string; toUserId?: string; fromAt?: string; toAt?: string; reason?: string | null },
    @Identity() id: RequestIdentity,
  ) {
    return this.identity.createDelegation(body ?? {}, id.tenantId, id.userId);
  }

  /** Revoke a delegation. Audits. */
  @Delete('delegations/:id')
  @RequirePermission('delegation.write')
  deleteDelegation(@Param('id') id: string, @Identity() ident: RequestIdentity) {
    return this.identity.deleteDelegation(id, ident.tenantId, ident.userId);
  }

  @Get('permissions/effective')
  @RequirePermission('identity.read')
  effective(@Query('userId') userId: string, @Identity() id: RequestIdentity) {
    return this.identity.effectivePermissions(userId || id.userId);
  }

  /**
   * SELF menu-permission payload for the current identity (PH-01 / NX-016).
   * NO @RequirePermission — a restricted user must be able to read their OWN
   * effective permissions even when enforcing (otherwise the menu filter could
   * never narrow). Returns just what the nav filter needs: the caller's granted
   * permission codes, their role codes, and whether menu enforcement is active
   * (`menuEnforce` = isEnforcing(), driven by AUTH_ENFORCE / x-authz-enforce).
   */
  @Get('me/nav-permissions')
  async navPermissions(@Identity() id: RequestIdentity, @Req() req: any) {
    const eff = await this.prisma.withBypass(() =>
      this.identity.effectivePermissions(id.userId),
    );
    return {
      userId: id.userId,
      roles: eff.roles,
      permissions: eff.permissions,
      menuEnforce: isEnforcing(req?.headers),
    };
  }

  /**
   * "Who will approve" preview (Admin UI). Loads the workflow definition, finds
   * the node, derives its selector, resolves candidates, and WRITES an
   * AssignmentResolution snapshot. Returns candidates + the snapshot summary.
   */
  @Post('assignment/preview')
  @RequirePermission('identity.manage')
  async preview(
    @Body() body: { workflowCode: string; nodeId: string; variables?: Record<string, any>; instanceCode?: string },
    @Identity() id: RequestIdentity,
  ) {
    const tenantId = id.tenantId;
    // KNOWN BOUNDARY RESIDUAL (Phase 1.5 Stage A, XHub/X.Office cleanup):
    // `Workflow` is owned by X.Office (`xoffice.service.ts`), not Identity.
    // Not extracted to a XofficeService call in this pass because XofficeModule
    // already imports IdentityModule (for `identity.can()`/delegation), so the
    // reverse call would require a forwardRef() circular module dependency —
    // and this same read has to become a real cross-process HTTP call once
    // Stage C splits Identity/XOffice into separate services anyway, making a
    // forwardRef() here throwaway work. Left as a flagged, read-only exception;
    // fix properly when Stage C's HTTP boundary exists.
    // See docs/implementation/xoffice-ai/IMPLEMENTATION_PLAN.md Phase 1.5.
    // eslint-disable-next-line no-restricted-syntax -- documented residual above, not a new violation
    const wf = await this.prisma.db.workflow.findFirst({ where: { code: body.workflowCode } });
    if (!wf) return { error: 'workflow not found', workflowCode: body.workflowCode };

    const def: any = wf.workingDefinition;
    const node = (def?.nodes ?? []).find((n: any) => n.id === body.nodeId);
    if (!node) return { error: 'node not found', nodeId: body.nodeId, workflowCode: body.workflowCode };

    const selector = this.resolver.selectorFromAssignment(node.config?.assignment, body.variables);
    if (!selector) {
      return { workflowCode: body.workflowCode, nodeId: body.nodeId, selector: null, candidates: [], note: 'node has no structured/role selector; legacy flat resolver applies' };
    }

    // Carry the requester through for DIRECT_MANAGER selectors.
    if (selector.selectorType === 'DIRECT_MANAGER' && !selector.personId && !selector.requesterUserId) {
      selector.requesterUserId = id.userId;
    }

    const result = await this.resolver.resolveAndSnapshot({
      tenantId,
      workflowInstanceCode: body.instanceCode ?? `preview:${body.workflowCode}:${body.nodeId}`,
      nodeId: body.nodeId,
      selector,
      actorId: id.userId,
    });

    return {
      workflowCode: body.workflowCode,
      nodeId: body.nodeId,
      nodeName: node.name,
      ...result,
    };
  }

  /** RBAC/ABAC check helper (also drivable from Admin UI / AI tools). */
  @Post('permissions/check')
  check(
    @Body() body: { userId?: string; permission: string; resource?: { amount?: number; orgUnitId?: string } },
    @Identity() id: RequestIdentity,
  ) {
    return this.identity.can(body.userId || id.userId, body.permission, body.resource);
  }
}
