import { Body, Controller, Get, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { SupportCasesService } from './support-cases.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';
import type { SupportCaseAction } from './support-cases.fsm';

/**
 * Product Customer Support API (2026-08-06). Tenant-scoped via
 * XofficeTenantScopeInterceptor. Create/comment are open to any support
 * agent (`support-case.create`); manage actions (triage/assign/escalate) →
 * `support-case.manage`; resolve/close → `support-case.resolve`.
 */
@Controller('api/support-cases')
@UseInterceptors(XofficeTenantScopeInterceptor)
export class SupportCasesController {
  constructor(private readonly svc: SupportCasesService) {}

  private tenant(id: RequestIdentity): string {
    return id.tenantId ?? 'tenant-xtech';
  }
  private user(id: RequestIdentity): string {
    return id.userId ?? 'user-nam';
  }

  @Post()
  @RequirePermission('support-case.create')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.create(this.tenant(id), this.user(id), body);
  }

  @Get()
  list(
    @Identity() id: RequestIdentity,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('priority') priority?: string,
    @Query('productCode') productCode?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.svc.list(this.tenant(id), {
      status,
      category,
      priority,
      productCode,
      assigneeId,
      q,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get(':id')
  get(@Param('id') id: string, @Identity() ident: RequestIdentity) {
    return this.svc.get(this.tenant(ident), id);
  }

  @Post(':id/triage')
  @RequirePermission('support-case.manage')
  triage(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.transition(this.tenant(ident), this.user(ident), id, 'triage' as SupportCaseAction, body ?? {});
  }

  @Post(':id/start')
  @RequirePermission('support-case.manage')
  start(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.transition(this.tenant(ident), this.user(ident), id, 'start' as SupportCaseAction, body ?? {});
  }

  @Post(':id/wait')
  @RequirePermission('support-case.manage')
  wait(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.transition(this.tenant(ident), this.user(ident), id, 'wait' as SupportCaseAction, body ?? {});
  }

  @Post(':id/resume')
  @RequirePermission('support-case.manage')
  resume(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.transition(this.tenant(ident), this.user(ident), id, 'resume' as SupportCaseAction, body ?? {});
  }

  @Post(':id/resolve')
  @RequirePermission('support-case.resolve')
  resolve(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.transition(this.tenant(ident), this.user(ident), id, 'resolve' as SupportCaseAction, body ?? {});
  }

  @Post(':id/close')
  @RequirePermission('support-case.manage')
  close(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.transition(this.tenant(ident), this.user(ident), id, 'close' as SupportCaseAction, body ?? {});
  }

  @Post(':id/cancel')
  @RequirePermission('support-case.manage')
  cancel(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.transition(this.tenant(ident), this.user(ident), id, 'cancel' as SupportCaseAction, body ?? {});
  }

  @Post(':id/assign')
  @RequirePermission('support-case.manage')
  assign(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.assign(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  @Post(':id/comment')
  @RequirePermission('support-case.create')
  comment(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.comment(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  @Post(':id/escalate')
  @RequirePermission('support-case.manage')
  escalate(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.escalate(this.tenant(ident), this.user(ident), id, body ?? {});
  }
}
