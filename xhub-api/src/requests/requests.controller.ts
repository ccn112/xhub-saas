import { Body, Controller, Get, Param, Post, Query, Req, UseInterceptors } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { isEnforcing } from '../auth/identity.types';
import { TenantScopeInterceptor } from '../common/tenant-scope.interceptor';

/**
 * Requests API (PH-02a — NX-020..024). Tenant-scoped via TenantScopeInterceptor
 * (prisma.withTenant). RBAC/ABAC gated by the global PermissionGuard through
 * @RequirePermission; the approve handler additionally enforces the amount ABAC
 * ceiling inside the service when enforcement is on.
 */
@Controller('api/requests')
@UseInterceptors(TenantScopeInterceptor)
export class RequestsController {
  constructor(private readonly svc: RequestsService) {}

  private tenant(id: RequestIdentity): string {
    return id.tenantId ?? 'tenant-xtech';
  }
  private user(id: RequestIdentity): string {
    return id.userId ?? 'user-nam';
  }

  @Post()
  @RequirePermission('request.create')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.create(this.tenant(id), this.user(id), body);
  }

  @Get()
  list(
    @Identity() id: RequestIdentity,
    @Query('scope') scope?: 'mine' | 'assigned' | 'all',
    @Query('state') state?: string,
    @Query('kind') kind?: string,
    @Query('procedureCode') procedureCode?: string,
    @Query('q') q?: string,
  ) {
    return this.svc.list(this.tenant(id), this.user(id), { scope, state, kind, procedureCode, q });
  }

  @Get(':id')
  get(@Param('id') id: string, @Identity() ident: RequestIdentity) {
    return this.svc.get(this.tenant(ident), id);
  }

  @Post(':id/submit')
  @RequirePermission('request.create')
  submit(@Param('id') id: string, @Identity() ident: RequestIdentity) {
    return this.svc.submit(this.tenant(ident), this.user(ident), id);
  }

  @Post(':id/approve')
  @RequirePermission('request.approve')
  approve(@Param('id') id: string, @Body() body: { note?: string }, @Identity() ident: RequestIdentity, @Req() req: any) {
    return this.svc.approve(this.tenant(ident), this.user(ident), id, { note: body?.note, enforce: isEnforcing(req?.headers) });
  }

  @Post(':id/reject')
  @RequirePermission('request.approve')
  reject(@Param('id') id: string, @Body() body: { note?: string }, @Identity() ident: RequestIdentity) {
    return this.svc.act(this.tenant(ident), this.user(ident), id, 'reject', { note: body?.note });
  }

  @Post(':id/request-supplement')
  @RequirePermission('request.approve')
  supplement(@Param('id') id: string, @Body() body: { note?: string }, @Identity() ident: RequestIdentity) {
    return this.svc.act(this.tenant(ident), this.user(ident), id, 'request-supplement', { note: body?.note });
  }

  @Post(':id/resubmit')
  @RequirePermission('request.create')
  resubmit(@Param('id') id: string, @Body() body: { note?: string }, @Identity() ident: RequestIdentity) {
    return this.svc.act(this.tenant(ident), this.user(ident), id, 'resubmit', { note: body?.note });
  }

  @Post(':id/withdraw')
  @RequirePermission('request.create')
  withdraw(@Param('id') id: string, @Body() body: { note?: string }, @Identity() ident: RequestIdentity) {
    return this.svc.act(this.tenant(ident), this.user(ident), id, 'withdraw', { note: body?.note });
  }

  @Post(':id/cancel')
  @RequirePermission('request.create')
  cancel(@Param('id') id: string, @Body() body: { note?: string }, @Identity() ident: RequestIdentity) {
    return this.svc.act(this.tenant(ident), this.user(ident), id, 'cancel', { note: body?.note });
  }

  @Post(':id/execute')
  @RequirePermission('request.approve')
  execute(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.execute(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  @Post(':id/execution/:execId/evidence')
  @RequirePermission('request.approve')
  evidence(
    @Param('id') id: string,
    @Param('execId') execId: string,
    @Body() body: any,
    @Identity() ident: RequestIdentity,
  ) {
    return this.svc.evidence(this.tenant(ident), this.user(ident), id, execId, body ?? {});
  }

  @Post(':id/comments')
  @RequirePermission('request.create')
  comment(@Param('id') id: string, @Body() body: { body: string; mentions?: string[] }, @Identity() ident: RequestIdentity) {
    return this.svc.addComment(this.tenant(ident), this.user(ident), id, body);
  }

  @Post(':id/attachments')
  @RequirePermission('request.create')
  attach(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.addAttachment(this.tenant(ident), this.user(ident), id, body);
  }
}
