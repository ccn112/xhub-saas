import { Injectable, Logger } from '@nestjs/common';
import { XofficePrismaService } from '../xoffice-prisma/xoffice-prisma.service';

/**
 * Phase 1.5 Stage C.4/C.5 — periodic read-only cache sync. XHub Platform
 * stays the canonical source for org-directory AND role/permission data
 * (PersonProfile/OrgUnit/Position/Group/RoleBinding/PermissionPolicy);
 * X.Office pulls a local read cache here instead of querying the platform's
 * database directly (that database no longer exists from X.Office's point of
 * view after the split). NOT real-time: this is a periodic full-refresh pull
 * (matches Identity-P0's own "Wave 1/2, additive, no live per-request call to
 * the hub" guidance) — see docs/implementation/xoffice-ai/IMPLEMENTATION_PLAN.md
 * Phase 1.5 Stage C.
 *
 * RoleBinding/PermissionPolicy are cached READ-ONLY: X.Office's copy of
 * IdentityService technically exposes create/deleteRoleBinding too (same
 * class as Platform's), but nothing in X.Office calls them in-process and
 * IdentityController (the HTTP surface for those writes) is only registered
 * in the Platform process — so this cache is never fought over by a second
 * writer. DataScope/Delegation/AssignmentResolution are NOT synced here: per
 * Stage C's identity-placement decision they are genuinely X.Office-owned
 * (written directly into X.Office's own database, not mirrored from Platform).
 *
 * Membership (added same-day follow-up, 2026-08-04) is ALSO cached READ-ONLY
 * here now, via GET /api/auth/memberships — closes a gap where
 * AuthService.sessionMembershipActive() (the revoke-on-suspend check
 * IdentityGuard runs on every session-authenticated request, in EITHER
 * process) previously opened a live cross-process Postgres connection
 * straight to the Platform database on every single request. `AuthModule`'s
 * X.Office variant never registers `AuthController`, so — same as
 * RoleBinding/PermissionPolicy above — this cache has exactly one writer.
 *
 * PositionAssignment (the historical holder timeline) is NOT synced yet —
 * only Position.holderPersonId (the current-holder cache field, already
 * present on Position itself) is kept fresh. A documented gap, not an
 * oversight: the org-chart / assignment-resolution code paths X.Office
 * actually runs today only read holderPersonId, never the full history.
 */
@Injectable()
export class IdentitySyncService {
  private readonly logger = new Logger(IdentitySyncService.name);
  private readonly platformBase = process.env.PLATFORM_API_URL ?? 'http://localhost:4000';
  // Represents "the sync job itself", not a real end user — matches the
  // header-identity mechanism every script/service in this codebase already
  // uses to call another process. Needs platform.tenant.read (to list
  // tenants); the org-directory reads themselves are ungated.
  private readonly actorUserId = process.env.IDENTITY_SYNC_ACTOR_USER_ID ?? 'user-nam';

  constructor(private readonly xoffice: XofficePrismaService) {}

  private headers(tenantId: string) {
    return { 'x-tenant-id': tenantId, 'x-user-id': this.actorUserId };
  }

  private async getJson<T>(path: string, tenantId: string): Promise<T> {
    const res = await fetch(`${this.platformBase}${path}`, { headers: this.headers(tenantId) });
    if (!res.ok) throw new Error(`identity-sync GET ${path} failed (${res.status})`);
    return res.json() as Promise<T>;
  }

  /** List every registered tenant (tenantNo not null) from the platform registry. */
  private async listTenantIds(): Promise<string[]> {
    const res = await fetch(`${this.platformBase}/api/platform/tenants`, {
      // Tenant list itself isn't tenant-scoped — any valid identity with
      // platform.tenant.read works; tenantId here is just to resolve a session.
      headers: this.headers('tenant-xtech'),
    });
    if (!res.ok) throw new Error(`identity-sync GET /api/platform/tenants failed (${res.status})`);
    const rows = (await res.json()) as Array<{ id: string }>;
    return rows.map((r) => r.id);
  }

  /** Pull + upsert one tenant's PersonProfile/OrgUnit/Position/Group/RoleBinding/PermissionPolicy/Membership into the local cache. */
  async syncTenant(tenantId: string): Promise<{ people: number; orgUnits: number; positions: number; groups: number; roleBindings: number; permissionPolicies: number; memberships: number }> {
    const [people, orgUnits, positions, groups, roleBindings, permissionPolicies, memberships] = await Promise.all([
      this.getJson<any[]>('/api/identity/people', tenantId),
      this.getJson<any[]>('/api/identity/org-units/flat', tenantId),
      this.getJson<any[]>('/api/identity/positions', tenantId),
      this.getJson<any[]>('/api/identity/groups', tenantId),
      this.getJson<any[]>('/api/identity/role-bindings', tenantId),
      this.getJson<any[]>('/api/identity/permission-policies', tenantId),
      this.getJson<any[]>('/api/auth/memberships', tenantId),
    ]);

    await this.xoffice.withBypass(async () => {
      for (const p of people) {
        await this.xoffice.db.personProfile.upsert({
          where: { id: p.id },
          create: {
            id: p.id, tenantId: p.tenantId, fullName: p.fullName, email: p.email,
            phone: p.phone, avatarUrl: p.avatarUrl, status: p.status, externalIdRefs: p.externalIdRefs ?? undefined,
          },
          update: {
            fullName: p.fullName, email: p.email, phone: p.phone,
            avatarUrl: p.avatarUrl, status: p.status, externalIdRefs: p.externalIdRefs ?? undefined,
          },
        });
      }
      for (const o of orgUnits) {
        await this.xoffice.db.orgUnit.upsert({
          where: { id: o.id },
          create: { id: o.id, tenantId: o.tenantId, code: o.code, name: o.name, parentId: o.parentId, type: o.type },
          update: { code: o.code, name: o.name, parentId: o.parentId, type: o.type },
        });
      }
      for (const pos of positions) {
        await this.xoffice.db.position.upsert({
          where: { id: pos.id },
          create: {
            id: pos.id, tenantId: pos.tenantId, code: pos.code, title: pos.title, orgUnitId: pos.orgUnitId,
            holderPersonId: pos.holderPersonId, reportsToPositionId: pos.reportsToPositionId, isHead: pos.isHead,
          },
          update: {
            title: pos.title, orgUnitId: pos.orgUnitId, holderPersonId: pos.holderPersonId,
            reportsToPositionId: pos.reportsToPositionId, isHead: pos.isHead,
          },
        });
      }
      for (const g of groups) {
        await this.xoffice.db.group.upsert({
          where: { id: g.id },
          create: { id: g.id, tenantId: g.tenantId, code: g.code, name: g.name, memberPersonIds: g.memberPersonIds ?? [] },
          update: { code: g.code, name: g.name, memberPersonIds: g.memberPersonIds ?? [] },
        });
      }
      for (const rb of roleBindings) {
        await this.xoffice.db.roleBinding.upsert({
          where: { id: rb.id },
          create: {
            id: rb.id, tenantId: rb.tenantId, subjectType: rb.subjectType, subjectId: rb.subjectId,
            roleCode: rb.roleCode, scope: rb.scope ?? {}, effectiveFrom: rb.effectiveFrom ?? null, effectiveTo: rb.effectiveTo ?? null,
          },
          update: {
            subjectType: rb.subjectType, subjectId: rb.subjectId, roleCode: rb.roleCode,
            scope: rb.scope ?? {}, effectiveFrom: rb.effectiveFrom ?? null, effectiveTo: rb.effectiveTo ?? null,
          },
        });
      }
      for (const pp of permissionPolicies) {
        await this.xoffice.db.permissionPolicy.upsert({
          where: { id: pp.id },
          create: { id: pp.id, tenantId: pp.tenantId, roleCode: pp.roleCode, permissions: pp.permissions ?? [], condition: pp.condition ?? null, version: pp.version ?? 1 },
          update: { roleCode: pp.roleCode, permissions: pp.permissions ?? [], condition: pp.condition ?? null, version: pp.version ?? 1 },
        });
      }
      for (const m of memberships) {
        await this.xoffice.db.membership.upsert({
          where: { tenantId_userId: { tenantId: m.tenantId, userId: m.userId } },
          create: { id: m.id, tenantId: m.tenantId, userId: m.userId, roles: m.roles ?? [], status: m.status ?? 'active' },
          update: { roles: m.roles ?? [], status: m.status ?? 'active' },
        });
      }
    });

    return {
      people: people.length, orgUnits: orgUnits.length, positions: positions.length,
      groups: groups.length, roleBindings: roleBindings.length, permissionPolicies: permissionPolicies.length,
      memberships: memberships.length,
    };
  }

  /** Sync every registered tenant. Errors on one tenant don't abort the rest. */
  async syncAll(): Promise<void> {
    let tenantIds: string[];
    try {
      tenantIds = await this.listTenantIds();
    } catch (e) {
      this.logger.error(`identity-sync: could not list tenants — ${(e as Error).message}`);
      return;
    }
    for (const tenantId of tenantIds) {
      try {
        const n = await this.syncTenant(tenantId);
        this.logger.log(
          `identity-sync ${tenantId}: people=${n.people} orgUnits=${n.orgUnits} positions=${n.positions} groups=${n.groups} roleBindings=${n.roleBindings} permissionPolicies=${n.permissionPolicies} memberships=${n.memberships}`,
        );
      } catch (e) {
        this.logger.error(`identity-sync ${tenantId} failed: ${(e as Error).message}`);
      }
    }
  }
}
