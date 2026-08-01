import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { TenantLaunchService } from './tenant-launch.service';
import { RequirePermission } from '../../auth/require-permission.decorator';
import { Identity } from '../../auth/identity.decorator';
import type { RequestIdentity } from '../../auth/identity.types';

/**
 * Platform Console — Tenant Launch Factory API (`/api/platform/launches`).
 *
 * Platform plane: the launch itself is orchestrated cross-tenant (registry +
 * control-plane + backup) so there is NO TenantScopeInterceptor here — the
 * SERVICE opens withTenant(target)/withBypass per step. Gated by the platform
 * launch permission codes (`platform.launch.read` / `platform.launch.manage`),
 * satisfied by the PLT_ launch-manager role and the wildcard PLATFORM_ADMIN.
 */
@Controller('api/platform/launches')
export class TenantLaunchController {
  constructor(private readonly launch: TenantLaunchService) {}

  @Get()
  @RequirePermission('platform.launch.read')
  list() {
    return this.launch.list();
  }

  @Get(':id')
  @RequirePermission('platform.launch.read')
  get(@Param('id') id: string) {
    return this.launch.detail(id);
  }

  @Post()
  @RequirePermission('platform.launch.manage')
  create(
    @Body()
    body: {
      targetTenantId: string;
      targetTenantNo?: number;
      blueprintId?: string;
      seedPackId?: string;
      name?: string;
      tenantKey?: string;
      tenantClass?: string;
      request?: Record<string, any>;
    },
    @Identity() id: RequestIdentity,
  ) {
    return this.launch.create({ ...body, createdBy: id?.userId });
  }

  @Post(':id/run')
  @RequirePermission('platform.launch.manage')
  run(@Param('id') id: string) {
    return this.launch.run(id);
  }

  @Post(':id/retry')
  @RequirePermission('platform.launch.manage')
  retry(@Param('id') id: string) {
    return this.launch.retry(id);
  }
}
