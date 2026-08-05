import { Body, Controller, Get, Param, Patch, Post, Query, UseInterceptors } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';

/**
 * Customer/Contact API (Phase 2, BO-0201). Tenant-scoped via
 * XofficeTenantScopeInterceptor. Reads open (any authenticated tenant
 * member can browse the customer directory); writes gated by
 * `customer.manage`.
 */
@Controller('api')
@UseInterceptors(XofficeTenantScopeInterceptor)
export class CustomersController {
  constructor(private readonly svc: CustomersService) {}

  private tenant(id: RequestIdentity): string {
    return id.tenantId ?? 'tenant-xtech';
  }
  private user(id: RequestIdentity): string {
    return id.userId ?? 'user-nam';
  }

  @Post('customers')
  @RequirePermission('customer.manage')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.create(this.tenant(id), this.user(id), body);
  }

  @Get('customers')
  list(@Identity() id: RequestIdentity, @Query('status') status?: string, @Query('q') q?: string) {
    return this.svc.list(this.tenant(id), { status, q });
  }

  @Get('customers/:id')
  get(@Param('id') id: string, @Identity() ident: RequestIdentity) {
    return this.svc.get(this.tenant(ident), id);
  }

  @Patch('customers/:id/status')
  @RequirePermission('customer.manage')
  setStatus(@Param('id') id: string, @Body() body: { status: string }, @Identity() ident: RequestIdentity) {
    return this.svc.setStatus(this.tenant(ident), this.user(ident), id, body.status);
  }

  @Post('customers/:id/contacts')
  @RequirePermission('customer.manage')
  addContact(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.addContact(this.tenant(ident), this.user(ident), id, body ?? {});
  }
}
