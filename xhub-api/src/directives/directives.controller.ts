import { Body, Controller, Get, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { DirectivesService } from './directives.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { TenantScopeInterceptor } from '../xoffice/tenant-scope.interceptor';

/**
 * Directives API (PH-02b — NX-025). Tenant-scoped via TenantScopeInterceptor
 * (prisma.withTenant). Issue/complete/cancel are gated by `directive.issue`
 * (EXECUTIVE) through the global PermissionGuard; assignee (commitment) actions
 * are open so any assigned member can act (server still scopes by tenant). List
 * + detail are readable so assignees can see directives addressed to them.
 */
@Controller('api/directives')
@UseInterceptors(TenantScopeInterceptor)
export class DirectivesController {
  constructor(private readonly svc: DirectivesService) {}

  private tenant(id: RequestIdentity): string {
    return id.tenantId ?? 'tenant-xtech';
  }
  private user(id: RequestIdentity): string {
    return id.userId ?? 'user-nam';
  }

  @Post()
  @RequirePermission('directive.issue')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.create(this.tenant(id), this.user(id), body);
  }

  @Get()
  list(
    @Identity() id: RequestIdentity,
    @Query('scope') scope?: 'issued' | 'assigned' | 'all',
    @Query('state') state?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.svc.list(this.tenant(id), this.user(id), {
      scope,
      state,
      q,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get(':id')
  get(@Param('id') id: string, @Identity() ident: RequestIdentity) {
    return this.svc.get(this.tenant(ident), id);
  }

  @Post(':id/issue')
  @RequirePermission('directive.issue')
  issue(@Param('id') id: string, @Identity() ident: RequestIdentity) {
    return this.svc.issue(this.tenant(ident), this.user(ident), id);
  }

  @Post(':id/complete')
  @RequirePermission('directive.issue')
  complete(@Param('id') id: string, @Body() body: { note?: string }, @Identity() ident: RequestIdentity) {
    return this.svc.directiveAct(this.tenant(ident), this.user(ident), id, 'complete', { note: body?.note });
  }

  @Post(':id/cancel')
  @RequirePermission('directive.issue')
  cancel(@Param('id') id: string, @Body() body: { note?: string }, @Identity() ident: RequestIdentity) {
    return this.svc.directiveAct(this.tenant(ident), this.user(ident), id, 'cancel', { note: body?.note });
  }

  // ---- assignee (commitment) actions — open to assigned members -------------
  @Post(':id/assignments/:aid/acknowledge')
  acknowledge(@Param('id') id: string, @Param('aid') aid: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.commitmentAct(this.tenant(ident), this.user(ident), id, aid, 'acknowledge', body ?? {});
  }

  @Post(':id/assignments/:aid/start')
  start(@Param('id') id: string, @Param('aid') aid: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.commitmentAct(this.tenant(ident), this.user(ident), id, aid, 'start', body ?? {});
  }

  @Post(':id/assignments/:aid/submit')
  submit(@Param('id') id: string, @Param('aid') aid: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.commitmentAct(this.tenant(ident), this.user(ident), id, aid, 'submit', body ?? {});
  }

  // ---- issuer review of a commitment ----------------------------------------
  @Post(':id/assignments/:aid/accept')
  @RequirePermission('directive.issue')
  accept(@Param('id') id: string, @Param('aid') aid: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.commitmentAct(this.tenant(ident), this.user(ident), id, aid, 'accept', body ?? {});
  }

  @Post(':id/assignments/:aid/return')
  @RequirePermission('directive.issue')
  returnCommit(@Param('id') id: string, @Param('aid') aid: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.commitmentAct(this.tenant(ident), this.user(ident), id, aid, 'return', body ?? {});
  }

  @Post(':id/evidence')
  evidence(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.evidence(this.tenant(ident), this.user(ident), id, body ?? {});
  }
}
