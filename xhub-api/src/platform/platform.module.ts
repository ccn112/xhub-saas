import { Module } from '@nestjs/common';
import { PlatformController, PlatformSummaryController } from './platform.controller';
import { TenantRegistryService } from './tenant-registry.service';
import { EntitlementService } from './entitlement.service';
import { PlanController } from './plan.controller';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Platform Console module (E3 — Platform Tenant Registry + T011 plan catalog).
 * Additive. Exposes /api/platform/tenants + /api/platform/plans over the SHARED
 * Tenant/SubscriptionPlan tables (platform plane, cross-tenant via withBypass).
 * No RLS interceptor — this is not tenant-scoped. EntitlementService is exported
 * so the onboarding flow + tenant-entitlement guards reuse the SAME enforcement.
 */
@Module({
  imports: [PrismaModule],
  controllers: [PlatformSummaryController, PlatformController, PlanController],
  providers: [TenantRegistryService, EntitlementService],
  exports: [TenantRegistryService, EntitlementService],
})
export class PlatformModule {}
