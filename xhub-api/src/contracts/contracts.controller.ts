import { Body, Controller, Get, Param, Patch, Post, Query, UseInterceptors } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';

/** Contract API (Phase 2, BO-0206/0207/0208). Reads open; writes gated `contract.manage`. */
@Controller('api/contracts')
@UseInterceptors(XofficeTenantScopeInterceptor)
export class ContractsController {
  constructor(private readonly svc: ContractsService) {}

  private tenant(id: RequestIdentity): string {
    return id.tenantId ?? 'tenant-xtech';
  }
  private user(id: RequestIdentity): string {
    return id.userId ?? 'user-nam';
  }

  @Post()
  @RequirePermission('contract.manage')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.create(this.tenant(id), this.user(id), body);
  }

  @Get()
  list(@Identity() id: RequestIdentity, @Query('status') status?: string, @Query('customerId') customerId?: string) {
    return this.svc.list(this.tenant(id), { status, customerId });
  }

  @Get('billing-requests')
  listBillingRequests(@Identity() id: RequestIdentity, @Query('contractId') contractId?: string) {
    return this.svc.listBillingRequests(this.tenant(id), contractId);
  }

  @Get(':id')
  get(@Param('id') id: string, @Identity() ident: RequestIdentity) {
    return this.svc.get(this.tenant(ident), id);
  }

  @Post(':id/lines')
  @RequirePermission('contract.manage')
  addLine(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.addLine(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  @Patch(':id/status')
  @RequirePermission('contract.manage')
  transition(@Param('id') id: string, @Body() body: { status: string }, @Identity() ident: RequestIdentity) {
    return this.svc.transition(this.tenant(ident), this.user(ident), id, body.status);
  }

  @Post(':id/sign')
  @RequirePermission('contract.manage')
  sign(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.sign(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  @Post('obligations/:obligationId/complete')
  @RequirePermission('contract.manage')
  completeObligation(@Param('obligationId') obligationId: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.completeObligation(this.tenant(ident), this.user(ident), obligationId, body ?? {});
  }

  @Post('obligations/:obligationId/escalate')
  @RequirePermission('contract.manage')
  escalateObligation(@Param('obligationId') obligationId: string, @Identity() ident: RequestIdentity) {
    return this.svc.escalateObligation(this.tenant(ident), this.user(ident), obligationId);
  }

  @Post('obligations/:obligationId/billing-request')
  @RequirePermission('contract.manage')
  generateBillingRequest(@Param('obligationId') obligationId: string, @Body() body: { idempotencyKey: string }, @Identity() ident: RequestIdentity) {
    return this.svc.generateBillingRequest(this.tenant(ident), this.user(ident), obligationId, body);
  }
}
