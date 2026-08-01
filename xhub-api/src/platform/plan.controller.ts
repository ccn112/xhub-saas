import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { EntitlementService } from './entitlement.service';
import { RequirePermission } from '../auth/require-permission.decorator';

/**
 * Platform Console — Subscription Plan catalog API (`/api/platform/plans`).
 * SHARED / platform-plane (SubscriptionPlan, no RLS). Gated by the platform
 * plan permission codes (`platform.plan.read`), satisfied by PLT_BILLING_ADMIN
 * and the wildcard PLATFORM_OWNER/ADMIN.
 */
@Controller('api/platform/plans')
export class PlanController {
  constructor(private readonly entitlement: EntitlementService) {}

  @Get()
  @RequirePermission('platform.plan.read')
  list() {
    return this.entitlement.listPlans();
  }

  @Get(':code')
  @RequirePermission('platform.plan.read')
  async get(@Param('code') code: string) {
    const plan = await this.entitlement.getPlanByCode(code);
    if (!plan) throw new NotFoundException(`plan not found: ${code}`);
    return plan;
  }
}
