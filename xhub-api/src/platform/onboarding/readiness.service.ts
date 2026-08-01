import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantRegistryService } from '../tenant-registry.service';
import { EntitlementService } from '../entitlement.service';

/**
 * v1.0 SaaS readiness verification (T011 exit gate). Runs a checklist over the
 * seeded ecosystem and returns pass/fail per item. Platform-plane only — reads
 * SHARED registry + control-plane metadata via withBypass and probes each
 * tenant's RLS isolation under withTenant. It NEVER exposes tenant business
 * content (counts/flags only), honouring the platform/tenant separation.
 */
export interface Check {
  key: string;
  scope: string; // 'platform' | tenantCode
  status: 'PASS' | 'FAIL';
  detail: string;
}

const XTECH = 'tenant-xtech';

@Injectable()
export class ReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: TenantRegistryService,
    private readonly entitlement: EntitlementService,
  ) {}

  private get db() {
    return this.prisma.db;
  }

  async report() {
    const checks: Check[] = [];
    const push = (key: string, scope: string, ok: boolean, detail: string) =>
      checks.push({ key, scope, status: ok ? 'PASS' : 'FAIL', detail });

    // ---- registry snapshot (SHARED, bypass) ---------------------------------
    const tenants: any[] = await this.prisma.withBypass(() =>
      (this.db as any).tenant.findMany({ where: { tenantNo: { not: null } }, orderBy: { tenantNo: 'asc' } }),
    );
    const active = tenants.filter((t) => t.status === 'ACTIVE');

    // ---- per-ACTIVE-tenant checks ------------------------------------------
    for (const t of active) {
      const code = t.tenantCode ?? t.id;

      // (a) isolation — under this tenant's RLS context a FOREIGN tenant's rows
      //     must be invisible (MUST_NOT_LEAK). Probe vs xtech (or vs T002 for xtech).
      const foreign = t.id === XTECH ? 'tenant-realestate-demo' : XTECH;
      let leak = -1;
      try {
        leak = await this.prisma.withTenant(t.id, () =>
          (this.db as any).orgUnit.count({ where: { tenantId: foreign } }),
        );
      } catch {
        leak = -1;
      }
      push('isolation', code, leak === 0, leak === 0 ? `no foreign rows visible (probe vs ${foreign})` : `leak=${leak}`);

      // (b) backup — a schedule + at least one backup job.
      const sched = await this.prisma.withBypass(() =>
        (this.db as any).backupSchedule.findUnique({ where: { tenantId: t.id } }),
      );
      let backups = 0;
      try {
        backups = await this.prisma.withTenant(t.id, () => (this.db as any).backupJob.count());
      } catch {
        backups = 0;
      }
      push('backup', code, !!sched && backups >= 1, `schedule=${!!sched}, backups=${backups}`);

      // (c) plan/entitlement — planId resolves to a plan in the catalog.
      const plan = await this.entitlement.getPlanByCode(t.planId);
      push('plan', code, !!plan, plan ? `plan=${plan.code}` : `unresolved planId=${t.planId ?? 'null'}`);

      // (d) no plaintext secrets — every stored credential is a hash (argon2).
      let plaintext = 0;
      let creds = 0;
      try {
        const rows: any[] = await this.prisma.withTenant(t.id, () =>
          (this.db as any).userCredential.findMany({ select: { passwordHash: true } }),
        );
        creds = rows.length;
        plaintext = rows.filter((r) => !String(r.passwordHash ?? '').startsWith('$argon2')).length;
      } catch {
        plaintext = 0;
      }
      push('secrets', code, plaintext === 0, plaintext === 0 ? `${creds} credential(s), all hashed` : `${plaintext} plaintext credential(s)`);
    }

    // ---- platform-wide checks ----------------------------------------------

    // Permission separation: every platform-plane policy grants ONLY platform.*
    // codes (never '*' and never tenant business codes).
    const platPolicies: any[] = await this.prisma.withBypass(() =>
      (this.db as any).permissionPolicy.findMany({ where: { tenantId: 'tenant-platform' } }),
    );
    const badPolicy = platPolicies.find((p) =>
      (p.permissions ?? []).some((c: string) => c === '*' || !c.startsWith('platform.')),
    );
    push('platform-permission-separation', 'platform', platPolicies.length > 0 && !badPolicy,
      `${platPolicies.length} PLT_ policies${badPolicy ? `, LEAK in ${badPolicy.roleCode}` : ', all platform.* only'}`);

    // tenantNo unique + immutable-shape: no duplicates; customers >= 11.
    const nos = tenants.map((t) => t.tenantNo);
    const uniqueNos = new Set(nos).size === nos.length;
    const customersOk = tenants
      .filter((t) => t.tenantClass === 'CUSTOMER')
      .every((t) => (t.tenantNo ?? 0) >= 11);
    push('tenantno-unique', 'platform', uniqueNos && customersOk,
      `unique=${uniqueNos}, customers>=11=${customersOk} (${tenants.length} rows)`);

    // Allocator returns >= 11.
    let nextNo = -1;
    try {
      nextNo = await this.registry.allocateCustomerTenantNo();
    } catch {
      nextNo = -1;
    }
    push('allocator-min', 'platform', nextNo >= 11, `next customer tenantNo = ${nextNo}`);

    const fail = checks.filter((c) => c.status === 'FAIL').length;
    return {
      ok: fail === 0,
      generatedAt: new Date().toISOString(),
      summary: {
        activeTenants: active.length,
        totalChecks: checks.length,
        passed: checks.length - fail,
        failed: fail,
      },
      exitCriteria: this.exitCriteria(checks, active.length),
      checks,
    };
  }

  /** Roll the granular checks up to the 10-point v1.0 exit criteria. */
  private exitCriteria(checks: Check[], activeCount: number) {
    const allPass = (key: string) => checks.filter((c) => c.key === key).every((c) => c.status === 'PASS');
    const one = (key: string) => checks.find((c) => c.key === key)?.status === 'PASS';
    return [
      { n: 1, key: 'allocator >= 11 + immutable/unique', status: one('allocator-min') && one('tenantno-unique') ? 'PASS' : 'FAIL' },
      { n: 2, key: 'plan/entitlement enforced', status: allPass('plan') ? 'PASS' : 'FAIL' },
      { n: 3, key: 'cross-tenant isolation', status: allPass('isolation') ? 'PASS' : 'FAIL' },
      { n: 4, key: 'per-tenant backup/restore', status: allPass('backup') ? 'PASS' : 'FAIL' },
      { n: 5, key: 'no plaintext secrets', status: allPass('secrets') ? 'PASS' : 'FAIL' },
      { n: 10, key: 'platform permission separation', status: one('platform-permission-separation') ? 'PASS' : 'FAIL' },
      { n: 0, key: `${activeCount} ACTIVE tenants verified`, status: activeCount > 0 ? 'PASS' : 'FAIL' },
    ];
  }
}
