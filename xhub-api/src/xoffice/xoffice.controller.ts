import { Body, Controller, Get, Headers, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { XofficeService } from './xoffice.service';
import { WorkflowDefinitionDocument } from './xoffice.types';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { TenantScopeInterceptor } from './tenant-scope.interceptor';

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
@UseInterceptors(TenantScopeInterceptor)
export class XofficeController {
  constructor(private readonly svc: XofficeService) {}

  private slug(id: RequestIdentity): string {
    return this.svc.slugFromTenantId(id.tenantId ?? 'tenant-xtech');
  }
  private user(id: RequestIdentity): string {
    return id.userId ?? 'user-nam';
  }

  @Get('node-catalog')
  nodeCatalog() {
    return this.svc.getNodeCatalog();
  }

  @Get('connectors')
  connectors() {
    return this.svc.getConnectorCatalog();
  }

  @Get('forms')
  forms() {
    return this.svc.getForms();
  }

  @Get('forms/:code')
  form(@Param('code') code: string) {
    return this.svc.getForm(code);
  }

  @Get('instances/:instanceCode/commands')
  commands(@Param('instanceCode') instanceCode: string, @Identity() id: RequestIdentity) {
    return this.svc.listCommands(this.slug(id), instanceCode);
  }

  @Get('workflows')
  async workflows(
    @Identity() id: RequestIdentity,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return paginate(await this.svc.listWorkflows(this.slug(id)), page, pageSize);
  }

  @Get('workflows/:code')
  workflow(@Param('code') code: string, @Identity() id: RequestIdentity) {
    return this.svc.getWorkflow(this.slug(id), code);
  }

  @Get('workflows/:code/versions')
  versions(@Param('code') code: string, @Identity() id: RequestIdentity) {
    return this.svc.getVersions(this.slug(id), code);
  }

  @Post('workflows/:code/validate')
  validate(
    @Param('code') _code: string,
    @Body() body: { definition: WorkflowDefinitionDocument },
  ) {
    return this.svc.validate(body?.definition ?? (body as any));
  }

  @Post('workflows/:code/simulate')
  simulate(
    @Param('code') _code: string,
    @Body() body: { definition: WorkflowDefinitionDocument; testData?: Record<string, any> },
  ) {
    return this.svc.simulate(body.definition, body.testData ?? {});
  }

  @Post('workflows/:code/publish')
  publish(
    @Param('code') code: string,
    @Body() body: { definition?: WorkflowDefinitionDocument } | WorkflowDefinitionDocument,
    @Identity() id: RequestIdentity,
  ) {
    const def = (body as any).definition ?? body;
    return this.svc.publish(this.slug(id), code, def);
  }

  @Post('ai/draft')
  aiDraft(
    @Body()
    body: { prompt: string; screen: string; currentDefinition?: WorkflowDefinitionDocument },
    @Identity() id: RequestIdentity,
  ) {
    return this.svc.aiDraft(this.slug(id), body.prompt, body.screen, body.currentDefinition);
  }

  @Get('instances')
  async instances(
    @Identity() id: RequestIdentity,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return paginate(await this.svc.listInstances(this.slug(id)), page, pageSize);
  }

  @Post('workflows/:code/requests')
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
  async tasks(
    @Identity() id: RequestIdentity,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return paginate(await this.svc.listTasks(this.slug(id)), page, pageSize);
  }

  // UnifiedWorkItem projection (read model — rebuildable, tenant-scoped).
  @Get('work-items')
  async workItems(
    @Identity() id: RequestIdentity,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return paginate(await this.svc.listWorkItems(this.slug(id)), page, pageSize);
  }

  @Post('work-items/rebuild')
  async rebuildWorkItems(@Identity() id: RequestIdentity) {
    const count = await this.svc.rebuildProjection(this.slug(id));
    return { count };
  }

  @Post('tasks/:id/act')
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
  enterExternalReference(
    @Param('id') execId: string,
    @Body() body: { referenceCode: string; referenceSystem?: string; note?: string },
    @Identity() id: RequestIdentity,
  ) {
    return this.svc.enterExternalReference(this.slug(id), execId, this.user(id), body);
  }

  @Get('audit')
  async audit(
    @Identity() id: RequestIdentity,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return paginate(await this.svc.getAudit(this.slug(id)), page, pageSize);
  }

  // ---- delegations -------------------------------------------------------
  @Get('delegations')
  delegations(@Identity() id: RequestIdentity) {
    return this.svc.listDelegations(this.slug(id));
  }

  @Post('delegations')
  createDelegation(
    @Body()
    body: { fromUserId: string; toUserId: string; fromAt?: string; toAt?: string; reason?: string },
    @Identity() id: RequestIdentity,
  ) {
    return this.svc.createDelegation(this.slug(id), this.user(id), body);
  }

  // ---- scheduler tick (test/demo — force one sweep, fixed clock) ---------
  @Post('scheduler/tick')
  schedulerTick(@Body() body?: { forceNow?: string; simulateOverdueTaskId?: string }) {
    return this.svc.runSchedulerSweep(body ?? {});
  }

  // ---- notifications -----------------------------------------------------
  @Get('notifications')
  notifications(@Identity() id: RequestIdentity) {
    return this.svc.listNotifications(this.slug(id), this.user(id));
  }

  @Get('notifications/unread-count')
  unreadCount(@Identity() id: RequestIdentity) {
    return this.svc.unreadNotificationCount(this.slug(id), this.user(id));
  }

  @Post('notifications/read-all')
  readAll(@Identity() id: RequestIdentity) {
    return this.svc.markAllNotificationsRead(this.slug(id), this.user(id));
  }

  @Post('notifications/:id/read')
  readOne(@Param('id') notifId: string, @Identity() id: RequestIdentity) {
    return this.svc.markNotificationRead(this.slug(id), this.user(id), notifId);
  }
}
