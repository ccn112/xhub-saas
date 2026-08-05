import { Body, Controller, Get, Param, Patch, Post, Query, UseInterceptors } from '@nestjs/common';
import { ProposalsService } from './proposals.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';

/** Proposal/Quotation API (Phase 2, BO-0204/BO-0205). Reads open; writes gated `proposal.manage`. */
@Controller('api/proposals')
@UseInterceptors(XofficeTenantScopeInterceptor)
export class ProposalsController {
  constructor(private readonly svc: ProposalsService) {}

  private tenant(id: RequestIdentity): string {
    return id.tenantId ?? 'tenant-xtech';
  }
  private user(id: RequestIdentity): string {
    return id.userId ?? 'user-nam';
  }

  @Post()
  @RequirePermission('proposal.manage')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.create(this.tenant(id), this.user(id), body);
  }

  @Get()
  list(@Identity() id: RequestIdentity, @Query('opportunityId') opportunityId?: string, @Query('status') status?: string) {
    return this.svc.list(this.tenant(id), { opportunityId, status });
  }

  @Get(':id')
  get(@Param('id') id: string, @Identity() ident: RequestIdentity) {
    return this.svc.get(this.tenant(ident), id);
  }

  @Post(':id/lines')
  @RequirePermission('proposal.manage')
  addLine(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.addLine(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  @Patch(':id/status')
  @RequirePermission('proposal.manage')
  transition(@Param('id') id: string, @Body() body: { status: string; approverNote?: string }, @Identity() ident: RequestIdentity) {
    return this.svc.transition(this.tenant(ident), this.user(ident), id, body.status, { approverNote: body.approverNote });
  }
}
