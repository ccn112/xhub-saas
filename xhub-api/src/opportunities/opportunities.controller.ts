import { Body, Controller, Get, Param, Patch, Post, Query, UseInterceptors } from '@nestjs/common';
import { OpportunitiesService } from './opportunities.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';

/** Opportunity pipeline API (Phase 2, BO-0202). Reads open; writes gated `opportunity.manage`. */
@Controller('api')
@UseInterceptors(XofficeTenantScopeInterceptor)
export class OpportunitiesController {
  constructor(private readonly svc: OpportunitiesService) {}

  private tenant(id: RequestIdentity): string {
    return id.tenantId ?? 'tenant-xtech';
  }
  private user(id: RequestIdentity): string {
    return id.userId ?? 'user-nam';
  }

  @Post('opportunities')
  @RequirePermission('opportunity.manage')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.create(this.tenant(id), this.user(id), body);
  }

  @Get('opportunities')
  list(@Identity() id: RequestIdentity, @Query('stage') stage?: string, @Query('customerId') customerId?: string) {
    return this.svc.list(this.tenant(id), { stage, customerId });
  }

  @Get('opportunities/:id')
  get(@Param('id') id: string, @Identity() ident: RequestIdentity) {
    return this.svc.get(this.tenant(ident), id);
  }

  @Patch('opportunities/:id/stage')
  @RequirePermission('opportunity.manage')
  transition(@Param('id') id: string, @Body() body: { stage: string; lostReason?: string }, @Identity() ident: RequestIdentity) {
    return this.svc.transition(this.tenant(ident), this.user(ident), id, body.stage, { lostReason: body.lostReason });
  }
}
