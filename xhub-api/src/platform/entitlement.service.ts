import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * EntitlementService (T011) — the single enforcement point for subscription
 * plans. Reads the SHARED SubscriptionPlan catalog + a tenant's `planId`
 * exclusively via withBypass (platform plane). Enforcement is DEFAULT-SAFE:
 *
 *   - a tenant whose planId is NULL or resolves to no plan → UNLIMITED (no gate),
 *     so existing tenants are NEVER retro-broken;
 *   - a plan with `appsAllowed = ["*"]` → all apps allowed (design-partner/demo);
 *   - `limits.maxUsers == null` → no user cap.
 *
 * Gates are applied only on the NEW customer-onboarding path + the couple of
 * explicit guards wired in the platform tenant controller (enable-app, add-user).
 */
export interface PlanView {
  id: string;
  code: string;
  name: string;
  tier: string;
  appsAllowed: string[];
  featureFlags: Record<string, any>;
  limits: Record<string, any>;
  billingEnabled: boolean;
  customerTenantMinNo: number | null;
  status: string;
}

@Injectable()
export class EntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.db;
  }

  /** Resolve one plan by code (SHARED catalog). Null if absent. */
  async getPlanByCode(code: string | null | undefined): Promise<PlanView | null> {
    if (!code) return null;
    const row = await this.prisma.withBypass(() =>
      (this.db as any).subscriptionPlan.findUnique({ where: { code } }),
    );
    return row ? (row as PlanView) : null;
  }

  /** All active plans (BILLING_ADMIN console). */
  listPlans(): Promise<PlanView[]> {
    return this.prisma.withBypass(() =>
      (this.db as any).subscriptionPlan.findMany({ orderBy: [{ billingEnabled: 'desc' }, { code: 'asc' }] }),
    );
  }

  /** Resolve the plan a tenant is on (via Tenant.planId → SubscriptionPlan.code). */
  async planForTenant(tenantId: string): Promise<PlanView | null> {
    const tenant: any = await this.prisma.withBypass(() =>
      (this.db as any).tenant.findUnique({ where: { id: tenantId }, select: { planId: true } }),
    );
    return this.getPlanByCode(tenant?.planId ?? null);
  }

  /** Count active memberships in a tenant (usage vs the maxUsers limit). */
  async userCount(tenantId: string): Promise<number> {
    const rows = await this.prisma.withBypass(() =>
      (this.db as any).membership.count({ where: { tenantId, status: 'active' } }),
    );
    return Number(rows);
  }

  private appAllowed(plan: PlanView, appCode: string): boolean {
    const allowed = plan.appsAllowed ?? [];
    return allowed.includes('*') || allowed.includes(appCode);
  }

  // ---- assertions (throw ForbiddenException on a real breach) ---------------

  /** App-entitlement gate. DEFAULT-SAFE: no plan → allowed. */
  async assertAppAllowed(tenantId: string, appCode: string): Promise<PlanView | null> {
    const plan = await this.planForTenant(tenantId);
    if (!plan) return null; // default-safe (unlimited)
    if (!this.appAllowed(plan, appCode)) {
      throw new ForbiddenException(
        `app '${appCode}' is not included in plan '${plan.code}' (allowed: ${(plan.appsAllowed ?? []).join(', ') || 'none'})`,
      );
    }
    return plan;
  }

  /** User-quota gate. DEFAULT-SAFE: no plan / no cap → allowed. */
  async assertUserQuota(tenantId: string, addCount = 1): Promise<PlanView | null> {
    const plan = await this.planForTenant(tenantId);
    if (!plan) return null;
    const max = plan.limits?.maxUsers;
    if (max == null) return plan;
    const current = await this.userCount(tenantId);
    if (current + addCount > Number(max)) {
      throw new ForbiddenException(
        `user quota exceeded for plan '${plan.code}': ${current} + ${addCount} > maxUsers ${max}`,
      );
    }
    return plan;
  }

  /**
   * A CUSTOMER plan (customerTenantMinNo set) may not be assigned to a reserved
   * tenant (tenantNo < customerTenantMinNo). Protects TC-002/TC-003.
   */
  assertPlanForTenantNo(plan: PlanView | null, tenantNo: number | null | undefined): void {
    if (!plan || plan.customerTenantMinNo == null) return;
    if (tenantNo != null && tenantNo < plan.customerTenantMinNo) {
      throw new ForbiddenException(
        `plan '${plan.code}' is a customer plan and cannot be assigned to reserved tenantNo ${tenantNo} (< ${plan.customerTenantMinNo})`,
      );
    }
  }

  /** Feature-flag check (e.g. can(tenantId, 'ai')). DEFAULT-SAFE: no plan → true. */
  async can(tenantId: string, feature: string): Promise<boolean> {
    const plan = await this.planForTenant(tenantId);
    if (!plan) return true;
    return plan.featureFlags?.[feature] === true;
  }

  /** Tenant entitlement summary (console). */
  async summaryForTenant(tenantId: string) {
    const plan = await this.planForTenant(tenantId);
    const users = await this.userCount(tenantId);
    return {
      tenantId,
      plan: plan ? { code: plan.code, name: plan.name, tier: plan.tier, billingEnabled: plan.billingEnabled } : null,
      appsAllowed: plan?.appsAllowed ?? ['*'],
      featureFlags: plan?.featureFlags ?? {},
      limits: plan?.limits ?? {},
      usage: { users, maxUsers: plan?.limits?.maxUsers ?? null },
      unlimited: !plan,
    };
  }
}
