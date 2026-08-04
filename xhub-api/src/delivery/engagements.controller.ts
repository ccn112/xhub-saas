import { Body, Controller, Get, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { EngagementsService } from './engagements.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';
import type { EngagementAction } from './engagements.fsm';

/**
 * Solution Delivery Workspace API (`/api/delivery/engagements`, SaaS step 5).
 * The THIRD workspace type — T001 (X-TECH) as solution provider. Tenant-scoped
 * via TenantScopeInterceptor (prisma.withTenant → T001). Reads gated by
 * `delivery.read`; all writes (create / lifecycle transitions / comment /
 * attachment / launch) by `delivery.manage`. The launch handler (`launchTenant`)
 * is SKIPPED by the interceptor so the Launch Factory's own contexts are real.
 */
@Controller('api/delivery')
@UseInterceptors(XofficeTenantScopeInterceptor)
export class EngagementsController {
  constructor(private readonly svc: EngagementsService) {}

  private tenant(id: RequestIdentity): string {
    return id.tenantId ?? 'tenant-xtech';
  }
  private user(id: RequestIdentity): string {
    return id.userId ?? 'user-nam';
  }

  // ---- pipeline overview ----------------------------------------------------
  @Get('pipeline')
  @RequirePermission('delivery.read')
  pipeline(@Identity() id: RequestIdentity) {
    return this.svc.pipeline(this.tenant(id));
  }

  // ---- engagements ----------------------------------------------------------
  @Post('engagements')
  @RequirePermission('delivery.manage')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.create(this.tenant(id), this.user(id), body);
  }

  @Get('engagements')
  @RequirePermission('delivery.read')
  list(
    @Identity() id: RequestIdentity,
    @Query('stage') stage?: string,
    @Query('status') status?: string,
    @Query('ownerId') ownerId?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.svc.list(this.tenant(id), {
      stage,
      status,
      ownerId,
      q,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('engagements/:id')
  @RequirePermission('delivery.read')
  get(@Param('id') id: string, @Identity() ident: RequestIdentity) {
    return this.svc.get(this.tenant(ident), id, this.user(ident));
  }

  // ---- lifecycle transitions (one endpoint per stage action) ----------------
  @Post('engagements/:id/qualify')
  @RequirePermission('delivery.manage')
  qualify(@Param('id') id: string, @Body() body: any, @Identity() i: RequestIdentity) {
    return this.svc.transition(this.tenant(i), this.user(i), id, 'qualify', body ?? {});
  }

  @Post('engagements/:id/survey')
  @RequirePermission('delivery.manage')
  survey(@Param('id') id: string, @Body() body: any, @Identity() i: RequestIdentity) {
    return this.svc.transition(this.tenant(i), this.user(i), id, 'survey', body ?? {});
  }

  @Post('engagements/:id/design')
  @RequirePermission('delivery.manage')
  design(@Param('id') id: string, @Body() body: any, @Identity() i: RequestIdentity) {
    return this.svc.transition(this.tenant(i), this.user(i), id, 'design', body ?? {});
  }

  @Post('engagements/:id/propose')
  @RequirePermission('delivery.manage')
  propose(@Param('id') id: string, @Body() body: any, @Identity() i: RequestIdentity) {
    return this.svc.transition(this.tenant(i), this.user(i), id, 'propose', body ?? {});
  }

  @Post('engagements/:id/win')
  @RequirePermission('delivery.manage')
  win(@Param('id') id: string, @Body() body: any, @Identity() i: RequestIdentity) {
    return this.svc.transition(this.tenant(i), this.user(i), id, 'win', body ?? {});
  }

  @Post('engagements/:id/implement')
  @RequirePermission('delivery.manage')
  implement(@Param('id') id: string, @Body() body: any, @Identity() i: RequestIdentity) {
    return this.svc.transition(this.tenant(i), this.user(i), id, 'implement', body ?? {});
  }

  @Post('engagements/:id/migrate')
  @RequirePermission('delivery.manage')
  migrate(@Param('id') id: string, @Body() body: any, @Identity() i: RequestIdentity) {
    return this.svc.transition(this.tenant(i), this.user(i), id, 'migrate', body ?? {});
  }

  @Post('engagements/:id/uat')
  @RequirePermission('delivery.manage')
  uat(@Param('id') id: string, @Body() body: any, @Identity() i: RequestIdentity) {
    return this.svc.transition(this.tenant(i), this.user(i), id, 'uat', body ?? {});
  }

  @Post('engagements/:id/golive')
  @RequirePermission('delivery.manage')
  golive(@Param('id') id: string, @Body() body: any, @Identity() i: RequestIdentity) {
    return this.svc.transition(this.tenant(i), this.user(i), id, 'golive', body ?? {});
  }

  @Post('engagements/:id/hypercare')
  @RequirePermission('delivery.manage')
  hypercare(@Param('id') id: string, @Body() body: any, @Identity() i: RequestIdentity) {
    return this.svc.transition(this.tenant(i), this.user(i), id, 'hypercare', body ?? {});
  }

  @Post('engagements/:id/success')
  @RequirePermission('delivery.manage')
  success(@Param('id') id: string, @Body() body: any, @Identity() i: RequestIdentity) {
    return this.svc.transition(this.tenant(i), this.user(i), id, 'success', body ?? {});
  }

  @Post('engagements/:id/lose')
  @RequirePermission('delivery.manage')
  lose(@Param('id') id: string, @Body() body: any, @Identity() i: RequestIdentity) {
    return this.svc.transition(this.tenant(i), this.user(i), id, 'lose', body ?? {});
  }

  /** Generic transition (action in body) — convenience for the action bar. */
  @Post('engagements/:id/transition')
  @RequirePermission('delivery.manage')
  transition(@Param('id') id: string, @Body() body: { action: EngagementAction; note?: string }, @Identity() i: RequestIdentity) {
    return this.svc.transition(this.tenant(i), this.user(i), id, body?.action, { note: body?.note });
  }

  @Post('engagements/:id/hold')
  @RequirePermission('delivery.manage')
  hold(@Param('id') id: string, @Body() body: any, @Identity() i: RequestIdentity) {
    return this.svc.hold(this.tenant(i), this.user(i), id, body ?? {});
  }

  @Post('engagements/:id/resume')
  @RequirePermission('delivery.manage')
  resume(@Param('id') id: string, @Body() body: any, @Identity() i: RequestIdentity) {
    return this.svc.resume(this.tenant(i), this.user(i), id, body ?? {});
  }

  @Post('engagements/:id/comment')
  @RequirePermission('delivery.manage')
  comment(@Param('id') id: string, @Body() body: any, @Identity() i: RequestIdentity) {
    return this.svc.comment(this.tenant(i), this.user(i), id, body ?? {});
  }

  @Post('engagements/:id/attachments')
  @RequirePermission('delivery.manage')
  attachment(@Param('id') id: string, @Body() body: any, @Identity() i: RequestIdentity) {
    return this.svc.attachment(this.tenant(i), this.user(i), id, body ?? {});
  }

  // ---- launch link (non-negotiable #12) — "Khởi chạy tenant khách" ----------
  @Post('engagements/:id/launch')
  @RequirePermission('delivery.manage')
  launchTenant(@Param('id') id: string, @Body() body: any, @Identity() i: RequestIdentity) {
    return this.svc.launchTenant(this.tenant(i), this.user(i), id, body ?? {});
  }
}
