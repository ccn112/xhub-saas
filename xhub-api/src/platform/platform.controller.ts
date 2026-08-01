import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { TenantRegistryService } from './tenant-registry.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';

/**
 * Platform Console — Tenant Registry API (`/api/platform/tenants`).
 *
 * Platform plane: reads/writes the SHARED Tenant table via withBypass
 * (cross-tenant metadata), NOT withTenant — so there is NO TenantScopeInterceptor.
 * Gated by the NEW platform permission codes; the canonical PLATFORM_ADMIN grant
 * (`["*"]`) satisfies them via wildcard. Full platform/tenant role separation is
 * a later step.
 */
@Controller('api/platform')
export class PlatformSummaryController {
  constructor(private readonly registry: TenantRegistryService) {}

  /** Console overview: tenant counts by class/status (shared metadata only). */
  @Get('summary')
  @RequirePermission('platform.tenant.read')
  summary() {
    return this.registry.summary();
  }
}

@Controller('api/platform/tenants')
export class PlatformController {
  constructor(private readonly registry: TenantRegistryService) {}

  @Get()
  @RequirePermission('platform.tenant.read')
  list() {
    return this.registry.list();
  }

  @Get(':idOrCode')
  @RequirePermission('platform.tenant.read')
  get(@Param('idOrCode') idOrCode: string) {
    return this.registry.getById(idOrCode);
  }

  @Post()
  @RequirePermission('platform.tenant.manage')
  register(
    @Body()
    body: {
      name: string;
      tenantKey?: string;
      industry?: string;
      planId?: string;
      blueprintId?: string;
    },
    @Identity() id: RequestIdentity,
  ) {
    return this.registry.registerCustomer({ ...body, actorId: id.userId });
  }

  @Patch(':idOrCode')
  @RequirePermission('platform.tenant.manage')
  patch(
    @Param('idOrCode') idOrCode: string,
    @Body() body: Record<string, any>,
    @Identity() id: RequestIdentity,
  ) {
    return this.registry.patch(idOrCode, body, id.userId);
  }
}
