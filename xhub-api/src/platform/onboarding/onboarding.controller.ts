import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { ReadinessService } from './readiness.service';
import { EntitlementService } from '../entitlement.service';
import { TenantRegistryService } from '../tenant-registry.service';
import { RequirePermission } from '../../auth/require-permission.decorator';
import { Identity } from '../../auth/identity.decorator';
import type { RequestIdentity } from '../../auth/identity.types';

/**
 * Platform Console — customer onboarding + v1.0 readiness (T011).
 * Platform plane (cross-tenant orchestration) — NO TenantScopeInterceptor.
 * Gated by platform permission codes; a non-platform user is DENIED (403 under
 * enforcement).
 */
@Controller('api/platform')
export class OnboardingController {
  constructor(
    private readonly onboarding: OnboardingService,
    private readonly readiness: ReadinessService,
    private readonly entitlement: EntitlementService,
    private readonly registry: TenantRegistryService,
  ) {}

  /** Assisted customer onboarding (allocates tenantNo >= 11, runs Launch Factory). */
  @Post('onboard')
  @RequirePermission('platform.tenant.manage')
  onboard(
    @Body()
    body: {
      name: string;
      tenantKey?: string;
      industry?: string;
      planCode: string;
      blueprintCode?: string;
      seedPackCode?: string;
      adminUserId?: string;
      adminFullName?: string;
    },
    @Identity() id: RequestIdentity,
  ) {
    return this.onboarding.onboard({ ...body, actorId: id?.userId });
  }

  /** v1.0 SaaS readiness checklist (pass/fail per item). */
  @Get('readiness')
  @RequirePermission('platform.tenant.read')
  readinessReport() {
    return this.readiness.report();
  }

  /** Tenant entitlement summary (plan + usage). */
  @Get('tenants/:idOrCode/entitlement')
  @RequirePermission('platform.tenant.read')
  async entitlementSummary(@Param('idOrCode') idOrCode: string) {
    const tenant = await this.registry.getById(idOrCode);
    return this.entitlement.summaryForTenant(tenant.id);
  }

  /** Enable/disable an app for a tenant — entitlement-gated (app in plan). */
  @Post('tenants/:idOrCode/apps')
  @RequirePermission('platform.tenant.manage')
  enableApp(
    @Param('idOrCode') idOrCode: string,
    @Body() body: { appCode: string; status?: 'enabled' | 'disabled' },
  ) {
    return this.onboarding.enableApp(idOrCode, body.appCode, body.status ?? 'enabled');
  }

  /** Add a user to a tenant — entitlement-gated (maxUsers quota). */
  @Post('tenants/:idOrCode/users')
  @RequirePermission('platform.tenant.manage')
  addUser(
    @Param('idOrCode') idOrCode: string,
    @Body() body: { userId: string; fullName?: string; roles?: string[] },
  ) {
    return this.onboarding.addUser(idOrCode, body);
  }
}
