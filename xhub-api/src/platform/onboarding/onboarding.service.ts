import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantRegistryService } from '../tenant-registry.service';
import { EntitlementService } from '../entitlement.service';
import { TenantLaunchService } from '../launch/tenant-launch.service';
import { CatalogService } from '../catalog/catalog.service';
import { BackupScheduleService } from '../../backup/backup-schedule.service';
import { ControlplaneService } from '../../controlplane/controlplane.service';
import { AuthService } from '../../auth/auth.service';
import type { RequestIdentity } from '../../auth/identity.types';

/**
 * Customer onboarding (T011 — the ASSISTED onboarding path). A real paying
 * customer starts at tenantNo >= 11. This service is a thin ORCHESTRATOR that
 * REUSES existing primitives — the registry allocator (tenantNo >= 11 in a
 * lock), the Launch Factory (8-step pipeline), the catalog (blueprint + a
 * BLANK/baseline seed pack, NEVER a demo pack), the backup schedule, and the
 * internal auth invite/activate flow. It adds NO per-tenant branch logic.
 *
 * Idempotent + audited: re-onboarding the same tenantKey reuses the registry row
 * + the single launch (found-or-create) and does not re-allocate a number.
 */

/** Default baseline for a REAL customer — a blank org, NOT a demo seed pack. */
const DEFAULT_BLUEPRINT = 'BP-BASE-ENTERPRISE';
const DEFAULT_BASELINE_SEED = 'SP-BASE-ORG';

export interface OnboardInput {
  name: string;
  tenantKey?: string;
  industry?: string;
  planCode: string;
  blueprintCode?: string;
  seedPackCode?: string;
  adminUserId?: string;
  adminFullName?: string;
  actorId?: string;
}

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: TenantRegistryService,
    private readonly entitlement: EntitlementService,
    private readonly launch: TenantLaunchService,
    private readonly catalog: CatalogService,
    private readonly backupSchedule: BackupScheduleService,
    private readonly controlplane: ControlplaneService,
    private readonly auth: AuthService,
  ) {}

  private get db() {
    return this.prisma.db;
  }

  async onboard(input: OnboardInput) {
    const name = (input.name ?? '').trim();
    if (!name) throw new BadRequestException('name is required');
    if (!input.planCode) throw new BadRequestException('planCode is required');

    const plan = await this.entitlement.getPlanByCode(input.planCode);
    if (!plan) throw new BadRequestException(`unknown plan: ${input.planCode}`);

    const blueprintCode = input.blueprintCode || DEFAULT_BLUEPRINT;
    const seedPackCode = input.seedPackCode || DEFAULT_BASELINE_SEED;
    const tenantKey = (input.tenantKey?.trim() || name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // ---- 1. Registry row (idempotent by tenantKey; allocate >= 11 in-lock) ---
    const existing: any = await this.prisma.withBypass(() =>
      (this.db as any).tenant.findUnique({ where: { tenantKey } }),
    );
    let registryRow: any;
    if (existing) {
      registryRow = existing;
      // Ensure the plan/blueprint are set (idempotent patch).
      if (existing.planId !== plan.code || existing.blueprintId !== blueprintCode) {
        registryRow = await this.registry.patch(existing.id, { planId: plan.code, blueprintId: blueprintCode }, input.actorId);
      }
    } else {
      registryRow = await this.registry.registerCustomer({
        name,
        tenantKey,
        industry: input.industry,
        planId: plan.code,
        blueprintId: blueprintCode,
        actorId: input.actorId,
      });
    }

    // Guard: a customer plan may never land on a reserved tenantNo (<11).
    this.entitlement.assertPlanForTenantNo(plan, registryRow.tenantNo);

    const tenantId = registryRow.id;
    const tenantNo = registryRow.tenantNo;

    // ---- 2. Launch Factory (found-or-create ONE launch, then run) -----------
    const launches = await this.launch.list();
    let launchRow = (launches as any[]).find((l) => l.targetTenantId === tenantId);
    if (!launchRow) {
      launchRow = await this.launch.create({
        targetTenantId: tenantId,
        targetTenantNo: tenantNo,
        blueprintId: blueprintCode,
        seedPackId: seedPackCode,
        name,
        tenantKey,
        tenantClass: 'CUSTOMER',
        createdBy: input.actorId ?? 'platform',
      });
    }
    const ran: any = await this.launch.run(launchRow.id);
    if (ran.status !== 'COMPLETED') {
      throw new BadRequestException(`launch did not COMPLETE: ${ran.status} @ ${ran.currentStepKey}`);
    }

    // ---- 3. Backup schedule (ensure a per-tenant schedule row exists) -------
    await this.backupSchedule.upsert(tenantId, { enabled: true });

    // ---- 4. First tenant admin via invite (NO plaintext) --------------------
    const adminUserId = input.adminUserId || `${tenantId}-admin`;
    await this.ensureAdminPerson(tenantId, adminUserId, input.adminFullName);
    const actor: RequestIdentity = {
      userId: input.actorId ?? 'platform',
      tenantId,
      roles: [],
      source: 'header' as any,
    };
    const invite = await this.auth.invite(actor, adminUserId);

    // ---- 5. Audit -----------------------------------------------------------
    await this.audit(tenantId, input.actorId, 'onboard', {
      tenantNo, plan: plan.code, blueprint: blueprintCode, seedPack: seedPackCode, launchId: launchRow.id,
    });

    return {
      tenant: {
        id: tenantId,
        tenantNo,
        tenantCode: registryRow.tenantCode,
        tenantKey,
        name,
        status: 'ACTIVE',
        tenantClass: 'CUSTOMER',
      },
      plan: { code: plan.code, name: plan.name, tier: plan.tier, billingEnabled: plan.billingEnabled },
      launch: { id: launchRow.id, status: ran.status },
      admin: {
        userId: adminUserId,
        activation: { token: invite.token, activationUrl: invite.activationUrl, expiresAt: invite.expiresAt },
      },
    };
  }

  /** Ensure the first-admin PersonProfile + TENANT_ADMIN Membership exist. */
  private async ensureAdminPerson(tenantId: string, userId: string, fullName?: string) {
    await this.prisma.withTenant(tenantId, async () => {
      await this.db.personProfile.upsert({
        where: { id: userId },
        update: fullName ? { fullName } : {},
        create: {
          id: userId,
          tenantId,
          fullName: fullName ?? 'Quản trị viên tenant',
          email: `${userId}@${tenantId}.local`,
          status: 'active',
        },
      });
      await this.db.membership.upsert({
        where: { tenantId_userId: { tenantId, userId } },
        update: { roles: ['TENANT_ADMIN'], status: 'active' },
        create: { tenantId, userId, roles: ['TENANT_ADMIN'], status: 'active' },
      });
    });
  }

  // ---- entitlement-guarded tenant operations (T011 enforcement points) ------

  /** Enable an app for a tenant — REJECTED if the app is outside the plan. */
  async enableApp(idOrCode: string, appCode: string, status: 'enabled' | 'disabled' = 'enabled') {
    const tenant = await this.registry.getById(idOrCode);
    if (status === 'enabled') {
      await this.entitlement.assertAppAllowed(tenant.id, appCode);
    }
    const instance = await this.prisma.withBypass(() =>
      this.controlplane.setTenantApplication(tenant.id, appCode, status),
    );
    await this.audit(tenant.id, undefined, 'app.set', { appCode, status });
    return instance;
  }

  /** Add a user to a tenant — REJECTED if it would exceed the plan's maxUsers. */
  async addUser(idOrCode: string, body: { userId: string; fullName?: string; roles?: string[] }) {
    const tenant = await this.registry.getById(idOrCode);
    const userId = (body.userId ?? '').trim();
    if (!userId) throw new BadRequestException('userId is required');
    await this.entitlement.assertUserQuota(tenant.id, 1);
    await this.prisma.withTenant(tenant.id, async () => {
      await this.db.personProfile.upsert({
        where: { id: userId },
        update: body.fullName ? { fullName: body.fullName } : {},
        create: {
          id: userId,
          tenantId: tenant.id,
          fullName: body.fullName ?? userId,
          email: `${userId}@${tenant.id}.local`,
          status: 'active',
        },
      });
      await this.db.membership.upsert({
        where: { tenantId_userId: { tenantId: tenant.id, userId } },
        update: { roles: body.roles ?? ['EMPLOYEE'], status: 'active' },
        create: { tenantId: tenant.id, userId, roles: body.roles ?? ['EMPLOYEE'], status: 'active' },
      });
    });
    await this.audit(tenant.id, undefined, 'user.add', { userId });
    return { tenantId: tenant.id, userId, added: true };
  }

  private async audit(tenantId: string, actorId: string | undefined, action: string, detail: Record<string, any>) {
    try {
      await this.prisma.withTenant(tenantId, () =>
        this.db.auditLog.create({
          data: {
            tenantId,
            actorId: actorId || 'platform',
            instanceCode: 'platform.onboarding',
            action,
            detail: JSON.stringify(detail),
          },
        }),
      );
    } catch {
      // best-effort audit
    }
  }
}
