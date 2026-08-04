import { Body, Controller, ForbiddenException, Get, Headers, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { XofficeService } from './xoffice.service';
import { WorkflowDefinitionDocument } from './xoffice.types';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { isStagingStrict } from '../auth/identity.types';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';
import { RequirePermission } from '../auth/require-permission.decorator';

/**
 * Optional pagination for list endpoints. Backward-compatible by design:
 *  - no `page` query → return the SAME array as before (E2E smoke + legacy FE);
 *  - `page` present  → return `{ items, total, page, pageSize }` (1-based page).
 * Never changes the element shape; only wraps/slices an already-built array.
 */
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

function paginate<T>(
  rows: T[],
  page?: string,
  pageSize?: string,
): T[] | PageResult<T> {
  if (page === undefined || page === null || page === '') return rows;
  const p = Math.max(1, Number.parseInt(page, 10) || 1);
  const rawSize = Number.parseInt(pageSize ?? '', 10);
  const size = Number.isFinite(rawSize) && rawSize > 0 ? Math.min(rawSize, 200) : 20;
  const start = (p - 1) * size;
  return {
    items: rows.slice(start, start + size),
    total: rows.length,
    page: p,
    pageSize: size,
  };
}

/**
 * X.Office API. Identity comes from `req.identity` (IdentityGuard): session JWT
 * → header fallback (x-tenant-id/x-user-id, kept for E2E + legacy FE) → default
 * demo (tenant-xtech/user-nam). All reads/writes are tenant-scoped.
 */
@Controller('api/xoffice')
@UseInterceptors(XofficeTenantScopeInterceptor)
export class XofficeController {
  constructor(private readonly svc: XofficeService) {}

  private slug(id: RequestIdentity): string {
    return this.svc.slugFromTenantId(id.tenantId);
  }
  private user(id: RequestIdentity): string {
    return id.userId;
  }

  @Get('node-catalog')
  @RequirePermission('workflow.read')
  nodeCatalog() {
    return this.svc.getNodeCatalog();
  }

  @Get('connectors')
  @RequirePermission('workflow.read')
  connectors() {
    return this.svc.getConnectorCatalog();
  }

  @Get('forms')
  @RequirePermission('form.read')
  forms() {
    return this.svc.getForms();
  }

  @Get('forms/:code')
  @RequirePermission('form.read')
  form(@Param('code') code: string) {
    return this.svc.getForm(code);
  }

  @Get('instances/:instanceCode/commands')
  @RequirePermission('workflow.read')
  commands(@Param('instanceCode') instanceCode: string, @Identity() id: RequestIdentity) {
    return this.svc.listCommands(this.slug(id), instanceCode);
  }

  @Get('workflows')
  @RequirePermission('workflow.read')
  async workflows(
    @Identity() id: RequestIdentity,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return paginate(await this.svc.listWorkflows(this.slug(id)), page, pageSize);
  }

  @Get('workflows/:code')
  @RequirePermission('workflow.read')
  workflow(@Param('code') code: string, @Identity() id: RequestIdentity) {
    return this.svc.getWorkflow(this.slug(id), code);
  }

  @Get('workflows/:code/versions')
  @RequirePermission('workflow.read')
  versions(@Param('code') code: string, @Identity() id: RequestIdentity) {
    return this.svc.getVersions(this.slug(id), code);
  }

  @Post('workflows/:code/validate')
  @RequirePermission('workflow.write')
  validate(
    @Param('code') _code: string,
    @Body() body: { definition: WorkflowDefinitionDocument },
  ) {
    return this.svc.validate(body?.definition ?? (body as any));
  }

  @Post('workflows/:code/simulate')
  @RequirePermission('workflow.write')
  simulate(
    @Param('code') _code: string,
    @Body() body: { definition: WorkflowDefinitionDocument; testData?: Record<string, any> },
  ) {
    return this.svc.simulate(body.definition, body.testData ?? {});
  }

  @Post('workflows/:code/publish')
  @RequirePermission('workflow.publish')
  publish(
    @Param('code') code: string,
    @Body() body: { definition?: WorkflowDefinitionDocument } | WorkflowDefinitionDocument,
    @Identity() id: RequestIdentity,
  ) {
    const def = (body as any).definition ?? body;
    return this.svc.publish(this.slug(id), code, def);
  }

  @Post('ai/draft')
  @RequirePermission('workflow.write')
  aiDraft(
    @Body()
    body: { prompt: string; screen: string; currentDefinition?: WorkflowDefinitionDocument },
    @Identity() id: RequestIdentity,
  ) {
    return this.svc.aiDraft(this.slug(id), body.prompt, body.screen, body.currentDefinition);
  }

  @Get('instances')
  @RequirePermission('workflow.read')
  async instances(
    @Identity() id: RequestIdentity,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return paginate(await this.svc.listInstances(this.slug(id)), page, pageSize);
  }

  @Post('workflows/:code/requests')
  @RequirePermission('workflow.request.create')
  createRequest(
    @Param('code') code: string,
    @Body()
    body: {
      variables?: Record<string, any>;
      title?: string;
      correlationId?: string;
      idempotencyKey?: string;
    },
    @Identity() id: RequestIdentity,
    @Headers('x-correlation-id') corr?: string,
    @Headers('x-idempotency-key') idem?: string,
  ) {
    return this.svc.createRequest(this.slug(id), code, this.user(id), body.variables ?? {}, body.title, {
      correlationId: corr ?? body.correlationId,
      idempotencyKey: idem ?? body.idempotencyKey,
    });
  }

  @Get('tasks')
  @RequirePermission('workflow.read')
  async tasks(
    @Identity() id: RequestIdentity,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return paginate(await this.svc.listTasks(this.slug(id)), page, pageSize);
  }

  // UnifiedWorkItem projection (read model — rebuildable, tenant-scoped).
  @Get('work-items')
  @RequirePermission('workflow.read')
  async workItems(
    @Identity() id: RequestIdentity,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return paginate(await this.svc.listWorkItems(this.slug(id)), page, pageSize);
  }

  @Post('work-items/rebuild')
  @RequirePermission('workflow.write')
  async rebuildWorkItems(@Identity() id: RequestIdentity) {
    const count = await this.svc.rebuildProjection(this.slug(id));
    return { count };
  }

  @Post('tasks/:id/act')
  @RequirePermission('workflow.task.act')
  act(
    @Param('id') taskId: string,
    @Body()
    body: { action: 'approve' | 'reject'; note?: string; correlationId?: string; idempotencyKey?: string },
    @Identity() id: RequestIdentity,
    @Headers('x-correlation-id') corr?: string,
    @Headers('x-idempotency-key') idem?: string,
  ) {
    return this.svc.actOnTask(this.slug(id), taskId, this.user(id), body.action, body.note, {
      correlationId: corr ?? body.correlationId,
      idempotencyKey: idem ?? body.idempotencyKey,
    });
  }

  // ---- external executions (External Action manual-task boundary) --------
  @Get('external-executions')
  @RequirePermission('workflow.read')
  async externalExecutions(
    @Query('instanceCode') instanceCode: string | undefined,
    @Identity() id: RequestIdentity,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return paginate(
      await this.svc.listExternalExecutions(this.slug(id), instanceCode),
      page,
      pageSize,
    );
  }

  @Post('external-executions/:id/reference')
  @RequirePermission('workflow.write')
  enterExternalReference(
    @Param('id') execId: string,
    @Body() body: { referenceCode: string; referenceSystem?: string; note?: string },
    @Identity() id: RequestIdentity,
  ) {
    return this.svc.enterExternalReference(this.slug(id), execId, this.user(id), body);
  }

  @Get('audit')
  @RequirePermission('audit.read')
  async audit(
    @Identity() id: RequestIdentity,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return paginate(await this.svc.getAudit(this.slug(id)), page, pageSize);
  }

  // ---- delegations -------------------------------------------------------
  @Get('delegations')
  @RequirePermission('delegation.read')
  delegations(@Identity() id: RequestIdentity) {
    return this.svc.listDelegations(this.slug(id));
  }

  /**
   * Create a delegation. `delegation.write` lets an actor delegate their OWN
   * work away (fromUserId === self). Granting on behalf of someone else
   * (e.g. an admin setting up cover for a manager) additionally requires
   * `delegation.grant-any` — closes the self-grant-admin-access PoC, where an
   * unprivileged caller previously delegated an arbitrary `fromUserId` (e.g.
   * the platform admin) to themselves with no check at all.
   */
  @Post('delegations')
  @RequirePermission('delegation.write')
  async createDelegation(
    @Body()
    body: { fromUserId: string; toUserId: string; fromAt?: string; toAt?: string; reason?: string },
    @Identity() id: RequestIdentity,
  ) {
    if (body?.fromUserId && body.fromUserId !== this.user(id)) {
      const decision = await this.svc.canGrantDelegationOnBehalf(this.user(id));
      if (!decision.allowed) {
        throw new ForbiddenException(
          `cannot create a delegation on behalf of another user without delegation.grant-any (${decision.reason})`,
        );
      }
    }
    return this.svc.createDelegation(this.slug(id), this.user(id), body);
  }

  // ---- scheduler tick (test/demo — force one sweep, fixed clock) ---------
  /**
   * Test/demo-only hook to force a scheduler sweep with a fake clock. Refused
   * entirely when STAGING_STRICT is on — this endpoint has no legitimate
   * non-local caller.
   */
  @Post('scheduler/tick')
  @RequirePermission('workflow.admin')
  schedulerTick(@Body() body?: { forceNow?: string; simulateOverdueTaskId?: string }) {
    if (isStagingStrict()) {
      throw new ForbiddenException('scheduler/tick is a test/demo-only endpoint, disabled under STAGING_STRICT');
    }
    return this.svc.runSchedulerSweep(body ?? {});
  }

  // ---- notifications -----------------------------------------------------
  @Get('notifications')
  @RequirePermission('workflow.read')
  notifications(@Identity() id: RequestIdentity) {
    return this.svc.listNotifications(this.slug(id), this.user(id));
  }

  @Get('notifications/unread-count')
  @RequirePermission('workflow.read')
  unreadCount(@Identity() id: RequestIdentity) {
    return this.svc.unreadNotificationCount(this.slug(id), this.user(id));
  }

  @Post('notifications/read-all')
  @RequirePermission('workflow.write')
  readAll(@Identity() id: RequestIdentity) {
    return this.svc.markAllNotificationsRead(this.slug(id), this.user(id));
  }

  @Post('notifications/:id/read')
  @RequirePermission('workflow.write')
  readOne(@Param('id') notifId: string, @Identity() id: RequestIdentity) {
    return this.svc.markNotificationRead(this.slug(id), this.user(id), notifId);
  }
}
