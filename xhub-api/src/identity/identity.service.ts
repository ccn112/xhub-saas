import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { permissionMatches } from './permission-match';

/**
 * IdentityService — the SHARED Identity/Organization Core (module src/identity).
 *
 * Owns PersonProfile / OrgUnit / Position / Group / RoleBinding /
 * PermissionPolicy / DataScope. NOT owned by XOffice: XHub / X.Space / XOffice
 * all read the same org/role/scope through this service. STANDALONE mode — the
 * Org Core IS the source of truth; externalIdRefs on PersonProfile is the seam
 * for a future FEDERATED (HRIS) projection.
 *
 * NO credential/password/secret is stored here (auth stays at the IdP). Email
 * is only an attribute; PersonProfile.id (UUID) is the immutable identity key.
 *
 * All tenant tables are RLS-protected; seeding legitimately spans tenants
 * (xtech + the demo-isolation canary) so it runs under withBypass and is
 * idempotent (upsert by id).
 */
@Injectable()
export class IdentityService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.seed();
    } catch {
      // DB not reachable at boot → skip; endpoints degrade gracefully.
    }
  }

  // ---- seed (idempotent, deterministic, under RLS bypass) ------------------
  private async seed(): Promise<void> {
    const dir = join(process.cwd(), 'seed-data', 'identity');
    const read = (f: string) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
    const files = ['xtech-identity-org.seed.json', 'demo-isolation-identity.seed.json'];

    await this.prisma.withBypass(async () => {
      for (const f of files) {
        const s = read(f);
        const tenantId: string = s.tenant.id;
        // Tenant row (not tenant-scoped) — ensure it exists.
        await this.prisma.db.tenant.upsert({
          where: { id: tenantId },
          update: { slug: s.tenant.slug, name: s.tenant.name },
          create: { id: tenantId, slug: s.tenant.slug, name: s.tenant.name },
        });

        for (const o of s.orgUnits ?? []) {
          await this.prisma.db.orgUnit.upsert({
            where: { id: o.id },
            update: { tenantId, code: o.code, name: o.name, type: o.type, parentId: o.parentId ?? null },
            create: { id: o.id, tenantId, code: o.code, name: o.name, type: o.type, parentId: o.parentId ?? null },
          });
        }
        for (const p of s.people ?? []) {
          await this.prisma.db.personProfile.upsert({
            where: { id: p.id },
            update: { tenantId, fullName: p.fullName, email: p.email ?? null, externalIdRefs: p.externalIdRefs ?? null },
            create: { id: p.id, tenantId, fullName: p.fullName, email: p.email ?? null, status: 'active', externalIdRefs: p.externalIdRefs ?? null },
          });
        }
        for (const p of s.positions ?? []) {
          await this.prisma.db.position.upsert({
            where: { id: p.id },
            update: { tenantId, code: p.code, title: p.title, orgUnitId: p.orgUnitId, holderPersonId: p.holderPersonId ?? null, reportsToPositionId: p.reportsToPositionId ?? null, isHead: !!p.isHead },
            create: { id: p.id, tenantId, code: p.code, title: p.title, orgUnitId: p.orgUnitId, holderPersonId: p.holderPersonId ?? null, reportsToPositionId: p.reportsToPositionId ?? null, isHead: !!p.isHead },
          });
        }
        // Position holder/acting HISTORY (PH-01 / NX-013) has MOVED OUT of the
        // boot seed into the `SP-XTECH-OPS` seed pack (T001 operational data),
        // applied to tenant-xtech by the catalog seed / launch factory. No
        // `=== 'tenant-xtech'` code branch here (non-negotiable #1).

        for (const g of s.groups ?? []) {
          await this.prisma.db.group.upsert({
            where: { id: g.id },
            update: { tenantId, code: g.code, name: g.name, memberPersonIds: g.memberPersonIds ?? [] },
            create: { id: g.id, tenantId, code: g.code, name: g.name, memberPersonIds: g.memberPersonIds ?? [] },
          });
        }
        for (const rb of s.roleBindings ?? []) {
          await this.prisma.db.roleBinding.upsert({
            where: { id: rb.id },
            update: { tenantId, subjectType: rb.subjectType, subjectId: rb.subjectId, roleCode: rb.roleCode, scope: rb.scope ?? {} },
            create: { id: rb.id, tenantId, subjectType: rb.subjectType, subjectId: rb.subjectId, roleCode: rb.roleCode, scope: rb.scope ?? {}, effectiveFrom: null, effectiveTo: null },
          });
        }
        for (const pp of s.permissionPolicies ?? []) {
          await this.prisma.db.permissionPolicy.upsert({
            where: { id: pp.id },
            update: { tenantId, roleCode: pp.roleCode, permissions: pp.permissions ?? [], condition: pp.condition ?? null },
            create: { id: pp.id, tenantId, roleCode: pp.roleCode, permissions: pp.permissions ?? [], condition: pp.condition ?? null, version: 1 },
          });
        }
        for (const ds of s.dataScopes ?? []) {
          await this.prisma.db.dataScope.upsert({
            where: { id: ds.id },
            update: { tenantId, subjectType: ds.subjectType, subjectId: ds.subjectId, scope: ds.scope ?? {} },
            create: { id: ds.id, tenantId, subjectType: ds.subjectType, subjectId: ds.subjectId, scope: ds.scope ?? {} },
          });
        }
      }
    });
  }

  // ---- org queries (tenant-scoped via interceptor withTenant) --------------

  /** Org units as a nested tree (roots first). */
  async orgUnitTree() {
    const rows = await this.prisma.db.orgUnit.findMany({ orderBy: { code: 'asc' } });
    const byId = new Map<string, any>();
    for (const r of rows) byId.set(r.id, { ...r, children: [] });
    const roots: any[] = [];
    for (const r of rows) {
      const node = byId.get(r.id);
      if (r.parentId && byId.has(r.parentId)) byId.get(r.parentId).children.push(node);
      else roots.push(node);
    }
    return roots;
  }

  listPositions() {
    return this.prisma.db.position.findMany({ orderBy: { code: 'asc' } });
  }

  // ---- org mutations (tenant-scoped via interceptor withTenant) ------------

  /**
   * Re-parent an org unit (drag-and-drop in the Sơ đồ tổ chức screen).
   * RLS-scoped: runs inside the interceptor's withTenant transaction, so only
   * units of the caller's tenant are visible/updatable. Guards against cycles —
   * the new parent may not be the node itself nor any of its descendants.
   */
  async reparentOrgUnit(id: string, parentId: string | null) {
    const rows = await this.prisma.db.orgUnit.findMany();
    const byId = new Map<string, { id: string; parentId: string | null }>();
    for (const r of rows as any[]) byId.set(r.id, { id: r.id, parentId: r.parentId });

    const node = byId.get(id);
    if (!node) throw new NotFoundException(`org unit ${id} not found`);

    if (parentId) {
      if (parentId === id) throw new BadRequestException('an org unit cannot be its own parent');
      const parent = byId.get(parentId);
      if (!parent) throw new NotFoundException(`parent org unit ${parentId} not found`);
      // Walk up the ancestor chain of the proposed parent; if we reach `id`,
      // then `parentId` is a descendant of `id` → would create a cycle.
      let cur: string | null = parentId;
      const seen = new Set<string>();
      while (cur) {
        if (cur === id) throw new BadRequestException('cannot move a unit under its own descendant (cycle)');
        if (seen.has(cur)) break; // pre-existing loop guard
        seen.add(cur);
        cur = byId.get(cur)?.parentId ?? null;
      }
    }

    return this.prisma.db.orgUnit.update({ where: { id }, data: { parentId: parentId ?? null } });
  }

  /**
   * Update an org unit's editable fields. Any subset of { name, type, headId,
   * parentId } may be present (presence flags let a caller clear headId to null).
   * parentId keeps the reparent cycle-guard. headId is applied to the unit's
   * head Position (isHead=true) — set its holder, clear it (null), or create a
   * head seat if none exists yet. RLS-scoped via the interceptor.
   */
  async updateOrgUnit(
    id: string,
    patch: { name?: string; type?: string; headId?: string | null; parentId?: string | null },
    present: { parentId: boolean; headId: boolean },
    tenantId: string,
  ) {
    const rows = await this.prisma.db.orgUnit.findMany();
    const byId = new Map<string, { id: string; parentId: string | null; code: string }>();
    for (const r of rows as any[]) byId.set(r.id, { id: r.id, parentId: r.parentId, code: r.code });
    const node = byId.get(id);
    if (!node) throw new NotFoundException(`org unit ${id} not found`);

    const data: { name?: string; type?: string; parentId?: string | null } = {};
    if (patch.name !== undefined) {
      const name = String(patch.name).trim();
      if (!name) throw new BadRequestException('name cannot be empty');
      data.name = name;
    }
    if (patch.type !== undefined) {
      const type = String(patch.type).trim();
      if (!type) throw new BadRequestException('type cannot be empty');
      data.type = type;
    }

    if (present.parentId) {
      const parentId = patch.parentId ?? null;
      if (parentId) {
        if (parentId === id) throw new BadRequestException('an org unit cannot be its own parent');
        if (!byId.has(parentId)) throw new NotFoundException(`parent org unit ${parentId} not found`);
        let cur: string | null = parentId;
        const seen = new Set<string>();
        while (cur) {
          if (cur === id) throw new BadRequestException('cannot move a unit under its own descendant (cycle)');
          if (seen.has(cur)) break;
          seen.add(cur);
          cur = byId.get(cur)?.parentId ?? null;
        }
      }
      data.parentId = parentId;
    }

    if (Object.keys(data).length) {
      await this.prisma.db.orgUnit.update({ where: { id }, data });
    }

    // headId → the unit's head Position holder (create the seat if missing).
    if (present.headId) {
      const headId = patch.headId ?? null;
      const headPos = await this.prisma.db.position.findFirst({ where: { orgUnitId: id, isHead: true } });
      if (headPos) {
        await this.prisma.db.position.update({ where: { id: headPos.id }, data: { holderPersonId: headId } });
      } else if (headId) {
        await this.prisma.db.position.create({
          data: { tenantId, code: `${node.code}-HEAD`, title: 'Trưởng đơn vị', orgUnitId: id, holderPersonId: headId, isHead: true },
        });
      }
    }

    return this.prisma.db.orgUnit.findUnique({ where: { id } });
  }

  /**
   * Create a child org unit. Validates the parent exists (when given) and that
   * `code` is unique within the tenant (→ 409 on dup). RLS-scoped.
   */
  async createOrgUnit(input: { code?: string; name?: string; type?: string; parentId?: string | null }, tenantId: string) {
    const code = String(input.code ?? '').trim();
    const name = String(input.name ?? '').trim();
    const type = String(input.type ?? '').trim() || 'DEPARTMENT';
    if (!code) throw new BadRequestException('code is required');
    if (!name) throw new BadRequestException('name is required');
    const parentId = input.parentId ?? null;
    if (parentId) {
      const parent = await this.prisma.db.orgUnit.findUnique({ where: { id: parentId } });
      if (!parent) throw new NotFoundException(`parent org unit ${parentId} not found`);
    }
    const dup = await this.prisma.db.orgUnit.findFirst({ where: { code } });
    if (dup) throw new ConflictException(`org unit code "${code}" already exists`);
    return this.prisma.db.orgUnit.create({ data: { tenantId, code, name, type, parentId } });
  }

  /**
   * Delete an org unit. Guarded: rejects (409) if it has child units OR
   * positions attached, so nothing is left dangling. Only leaf, empty units go.
   */
  async deleteOrgUnit(id: string) {
    const unit = await this.prisma.db.orgUnit.findUnique({ where: { id } });
    if (!unit) throw new NotFoundException(`org unit ${id} not found`);
    const [childCount, posCount] = await Promise.all([
      this.prisma.db.orgUnit.count({ where: { parentId: id } }),
      this.prisma.db.position.count({ where: { orgUnitId: id } }),
    ]);
    if (childCount > 0) throw new ConflictException(`đơn vị còn ${childCount} đơn vị con — không thể xoá`);
    if (posCount > 0) throw new ConflictException(`đơn vị còn ${posCount} vị trí — không thể xoá`);
    await this.prisma.db.orgUnit.delete({ where: { id } });
    return { ok: true, id };
  }

  /** Move a position to another org unit (setup mode). RLS-scoped. */
  async movePosition(id: string, orgUnitId: string) {
    const [pos, unit] = await Promise.all([
      this.prisma.db.position.findUnique({ where: { id } }),
      this.prisma.db.orgUnit.findUnique({ where: { id: orgUnitId } }),
    ]);
    if (!pos) throw new NotFoundException(`position ${id} not found`);
    if (!unit) throw new NotFoundException(`org unit ${orgUnitId} not found`);
    return this.prisma.db.position.update({ where: { id }, data: { orgUnitId } });
  }

  listPeople() {
    return this.prisma.db.personProfile.findMany({ orderBy: { fullName: 'asc' } });
  }

  listRoleBindings() {
    return this.prisma.db.roleBinding.findMany({ orderBy: { roleCode: 'asc' } });
  }

  listGroups() {
    return this.prisma.db.group.findMany({ orderBy: { code: 'asc' } });
  }

  // ---- person lookup helpers ----------------------------------------------

  /**
   * Map a session userId (legacy all.seed user id) → PersonProfile. Link is via
   * externalIdRefs.userId; falls back to email match. Returns null if unmapped.
   */
  async personForUserId(userId: string) {
    const people = await this.prisma.db.personProfile.findMany();
    return (
      people.find((p: any) => p.externalIdRefs && (p.externalIdRefs as any).userId === userId) ??
      people.find((p: any) => p.id === userId) ??
      null
    );
  }

  /**
   * Map a PersonProfile id → the legacy session userId (externalIdRefs.userId),
   * falling back to email then the person id. Used by XOffice to fill
   * ApprovalTask.assigneeUserId from a structured resolution.
   */
  async userIdForPerson(personId: string): Promise<string | null> {
    const p = await this.prisma.db.personProfile.findUnique({ where: { id: personId } });
    if (!p) return null;
    const ext = (p.externalIdRefs as any) ?? {};
    return ext.userId ?? p.email ?? p.id;
  }

  /** Role codes a person effectively holds (via POSITION / USER / GROUP bindings). */
  async roleCodesForPerson(personId: string): Promise<{ roleCode: string; via: string; scope: any }[]> {
    const [positions, groups, bindings] = await Promise.all([
      this.prisma.db.position.findMany({ where: { holderPersonId: personId } }),
      this.prisma.db.group.findMany(),
      this.prisma.db.roleBinding.findMany(),
    ]);
    const heldPositionIds = new Set(positions.map((p: any) => p.id));
    const memberGroupIds = new Set(
      groups.filter((g: any) => (g.memberPersonIds ?? []).includes(personId)).map((g: any) => g.id),
    );
    const out: { roleCode: string; via: string; scope: any }[] = [];
    for (const b of bindings as any[]) {
      if (b.subjectType === 'USER' && b.subjectId === personId) out.push({ roleCode: b.roleCode, via: 'USER', scope: b.scope });
      else if (b.subjectType === 'POSITION' && heldPositionIds.has(b.subjectId)) out.push({ roleCode: b.roleCode, via: `POSITION:${b.subjectId}`, scope: b.scope });
      else if (b.subjectType === 'GROUP' && memberGroupIds.has(b.subjectId)) out.push({ roleCode: b.roleCode, via: `GROUP:${b.subjectId}`, scope: b.scope });
    }
    return out;
  }

  // ---- RBAC + ABAC ---------------------------------------------------------

  /**
   * Effective permissions for a session userId: role codes (RBAC) → union of
   * PermissionPolicy.permissions, plus ABAC conditions and DataScope. Returns a
   * structured view used by GET /api/identity/permissions/effective and can().
   */
  async effectivePermissions(userId: string) {
    const person = await this.personForUserId(userId);
    if (!person) {
      return {
        userId,
        personId: null as string | null,
        fullName: undefined as string | undefined,
        roles: [] as string[],
        roleBindings: [] as { roleCode: string; via: string; scope: any }[],
        permissions: [] as string[],
        conditions: {} as Record<string, any>,
        scopes: [] as any[],
      };
    }
    const roleEntries = await this.roleCodesForPerson(person.id);
    const roleCodes = [...new Set(roleEntries.map((r) => r.roleCode))];

    const policies = await this.prisma.db.permissionPolicy.findMany({
      where: { roleCode: { in: roleCodes.length ? roleCodes : ['__none__'] } },
    });
    const permissions = new Set<string>();
    const conditions: Record<string, any> = {};
    for (const p of policies as any[]) {
      for (const perm of p.permissions ?? []) permissions.add(perm);
      if (p.condition) conditions[p.roleCode] = p.condition;
    }

    // DataScope for the person's positions (ABAC narrowing).
    const positions = await this.prisma.db.position.findMany({ where: { holderPersonId: person.id } });
    const positionIds = positions.map((p: any) => p.id);
    const dataScopes = await this.prisma.db.dataScope.findMany({
      where: { subjectType: 'POSITION', subjectId: { in: positionIds.length ? positionIds : ['__none__'] } },
    });

    return {
      userId,
      personId: person.id,
      fullName: person.fullName,
      roles: roleCodes,
      roleBindings: roleEntries,
      permissions: [...permissions],
      conditions,
      scopes: (dataScopes as any[]).map((d) => d.scope),
    };
  }

  /**
   * RBAC/ABAC check. `actor` is a session userId. Grants when a held role's
   * PermissionPolicy contains `permission` (RBAC). When `resource.amount` is
   * given, any per-role `maxAmount` ABAC condition must be satisfied.
   */
  async can(actorUserId: string, permission: string, resource?: { amount?: number; orgUnitId?: string }) {
    const eff = await this.effectivePermissions(actorUserId);
    // Wildcard-aware: a granted pattern like `tenant.*` matches `tenant.user.invite`,
    // `*` matches everything, and exact matches still work.
    const hasRbac = permissionMatches(eff.permissions, permission);
    if (!hasRbac) return { allowed: false, reason: 'no matching role permission (RBAC)', effective: eff };

    // ABAC: amount ceiling — allowed if ANY granting role's condition permits it.
    if (resource?.amount != null) {
      const ceilings = Object.values(eff.conditions)
        .map((c: any) => (c && typeof c.maxAmount === 'number' ? c.maxAmount : null))
        .filter((x): x is number => x != null);
      if (ceilings.length && !ceilings.some((c) => resource.amount! <= c)) {
        return { allowed: false, reason: `amount ${resource.amount} exceeds every maxAmount ceiling`, effective: eff };
      }
    }
    return { allowed: true, reason: 'granted', effective: eff };
  }

  // ---- audit helper --------------------------------------------------------

  /** Append an AuditLog row (runs inside the caller's withTenant transaction). */
  private async audit(tenantId: string, actorId: string, instanceCode: string, action: string, detail: string) {
    try {
      await this.prisma.db.auditLog.create({
        data: { tenantId, actorId: actorId || 'system', instanceCode, action, detail, at: new Date() },
      });
    } catch {
      // Audit is best-effort — never fail the write because the log could not be appended.
    }
  }

  // ---- role-binding write (NX-011) -----------------------------------------

  private readonly VALID_SUBJECT_TYPES = ['USER', 'POSITION', 'GROUP', 'ORG_UNIT'];

  /** Union of a roleCode's granted permissions across all its policy versions. */
  private async permissionsForRole(roleCode: string): Promise<string[]> {
    const policies = await this.prisma.db.permissionPolicy.findMany({ where: { roleCode } });
    const set = new Set<string>();
    for (const p of policies as any[]) for (const perm of p.permissions ?? []) set.add(perm);
    return [...set];
  }

  /** Assert the binding subject exists (tenant-scoped). Throws 404 otherwise. */
  private async assertSubjectExists(subjectType: string, subjectId: string) {
    let exists: unknown = null;
    if (subjectType === 'USER') exists = await this.prisma.db.personProfile.findUnique({ where: { id: subjectId } });
    else if (subjectType === 'POSITION') exists = await this.prisma.db.position.findUnique({ where: { id: subjectId } });
    else if (subjectType === 'GROUP') exists = await this.prisma.db.group.findUnique({ where: { id: subjectId } });
    else if (subjectType === 'ORG_UNIT') exists = await this.prisma.db.orgUnit.findUnique({ where: { id: subjectId } });
    if (!exists) throw new NotFoundException(`${subjectType.toLowerCase()} "${subjectId}" not found`);
  }

  /**
   * Create a RoleBinding. Validates the roleCode exists in the PermissionPolicy
   * registry (else 400) and the subject exists (else 404). Writes an AuditLog.
   * RLS-scoped via the interceptor's withTenant.
   */
  async createRoleBinding(
    input: { subjectType?: string; subjectId?: string; roleCode?: string; scope?: any; effectiveFrom?: string | null; effectiveTo?: string | null },
    tenantId: string,
    actorId: string,
  ) {
    const subjectType = String(input.subjectType ?? '').trim().toUpperCase();
    const subjectId = String(input.subjectId ?? '').trim();
    const roleCode = String(input.roleCode ?? '').trim();
    if (!this.VALID_SUBJECT_TYPES.includes(subjectType)) throw new BadRequestException(`subjectType must be one of ${this.VALID_SUBJECT_TYPES.join('/')}`);
    if (!subjectId) throw new BadRequestException('subjectId is required');
    if (!roleCode) throw new BadRequestException('roleCode is required');

    const rolePerms = await this.permissionsForRole(roleCode);
    const policyCount = (await this.prisma.db.permissionPolicy.count({ where: { roleCode } }));
    if (policyCount === 0) throw new BadRequestException(`roleCode "${roleCode}" is not in the permission registry`);

    await this.assertSubjectExists(subjectType, subjectId);

    const rb = await this.prisma.db.roleBinding.create({
      data: {
        tenantId,
        subjectType,
        subjectId,
        roleCode,
        scope: (input.scope ?? {}) as any,
        effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
      },
    });
    await this.audit(tenantId, actorId, `role-binding:${rb.id}`, 'role.binding.created', `bind ${subjectType}:${subjectId} → ${roleCode} (+${rolePerms.length} perms)`);
    return rb;
  }

  /** Remove a RoleBinding (+ audit). 404 if not found. RLS-scoped. */
  async deleteRoleBinding(id: string, tenantId: string, actorId: string) {
    const rb = await this.prisma.db.roleBinding.findUnique({ where: { id } });
    if (!rb) throw new NotFoundException(`role binding ${id} not found`);
    await this.prisma.db.roleBinding.delete({ where: { id } });
    await this.audit(tenantId, actorId, `role-binding:${id}`, 'role.binding.deleted', `unbind ${rb.subjectType}:${rb.subjectId} → ${rb.roleCode}`);
    return { ok: true, id };
  }

  /**
   * Impact preview (no write): the permissions this role would confer to the
   * subject, split into those it would ADD vs. those the subject ALREADY holds.
   */
  async previewRoleBinding(input: { subjectId?: string; roleCode?: string }) {
    const subjectId = String(input.subjectId ?? '').trim();
    const roleCode = String(input.roleCode ?? '').trim();
    if (!subjectId) throw new BadRequestException('subjectId is required');
    if (!roleCode) throw new BadRequestException('roleCode is required');
    const policyCount = await this.prisma.db.permissionPolicy.count({ where: { roleCode } });
    if (policyCount === 0) throw new BadRequestException(`roleCode "${roleCode}" is not in the permission registry`);

    const rolePermissions = await this.permissionsForRole(roleCode);
    const eff = await this.effectivePermissions(subjectId);
    const current = eff.permissions;
    const willAdd = rolePermissions.filter((p) => !permissionMatches(current, p));
    const alreadyHas = rolePermissions.filter((p) => permissionMatches(current, p));
    return {
      subjectId,
      roleCode,
      subjectPersonId: eff.personId,
      rolePermissions,
      currentPermissionCount: current.length,
      willAdd,
      alreadyHas,
      noNetChange: willAdd.length === 0,
    };
  }

  // ---- delegation write (NX-012) -------------------------------------------

  listDelegations() {
    return this.prisma.db.delegation.findMany({ orderBy: { fromAt: 'desc' } });
  }

  /**
   * Create a Delegation with guardrails:
   *  - self-delegation (from===to) → 400;
   *  - time-window OVERLAP with an existing delegation for the same fromUserId → 409;
   *  - a simple cycle (A→B while B→A is active in an overlapping window) → 409.
   * Writes an AuditLog. RLS-scoped via the interceptor's withTenant.
   */
  async createDelegation(
    input: { fromUserId?: string; toUserId?: string; fromAt?: string; toAt?: string; reason?: string | null },
    tenantId: string,
    actorId: string,
  ) {
    const fromUserId = String(input.fromUserId ?? '').trim();
    const toUserId = String(input.toUserId ?? '').trim();
    if (!fromUserId || !toUserId) throw new BadRequestException('fromUserId and toUserId are required');
    if (!input.fromAt || !input.toAt) throw new BadRequestException('fromAt and toAt are required');
    const fromAt = new Date(input.fromAt);
    const toAt = new Date(input.toAt);
    if (isNaN(fromAt.getTime()) || isNaN(toAt.getTime())) throw new BadRequestException('fromAt/toAt must be valid dates');
    if (toAt < fromAt) throw new BadRequestException('toAt must not precede fromAt');
    if (fromUserId === toUserId) throw new BadRequestException('không thể tự uỷ quyền cho chính mình (SELF_DELEGATION)');

    // Overlap = existing.fromAt <= new.toAt AND existing.toAt >= new.fromAt.
    const overlap = await this.prisma.db.delegation.findFirst({
      where: { fromUserId, fromAt: { lte: toAt }, toAt: { gte: fromAt } },
    });
    if (overlap) throw new ConflictException(`uỷ quyền chồng lấn thời gian với uỷ quyền đang có (OVERLAP:${overlap.id})`);

    // Simple cycle: an active B→A delegation whose window overlaps the new A→B.
    const cycle = await this.prisma.db.delegation.findFirst({
      where: { fromUserId: toUserId, toUserId: fromUserId, fromAt: { lte: toAt }, toAt: { gte: fromAt } },
    });
    if (cycle) throw new ConflictException(`uỷ quyền vòng lặp: ${toUserId}→${fromUserId} đang hiệu lực (CYCLE:${cycle.id})`);

    const dlg = await this.prisma.db.delegation.create({
      data: { tenantId, fromUserId, toUserId, fromAt, toAt, reason: input.reason ?? null },
    });
    await this.audit(tenantId, actorId, `delegation:${dlg.id}`, 'delegation.created', `${fromUserId} → ${toUserId} [${fromAt.toISOString()}..${toAt.toISOString()}]`);
    return dlg;
  }

  /** Revoke a Delegation (+ audit). 404 if not found. RLS-scoped. */
  async deleteDelegation(id: string, tenantId: string, actorId: string) {
    const dlg = await this.prisma.db.delegation.findUnique({ where: { id } });
    if (!dlg) throw new NotFoundException(`delegation ${id} not found`);
    await this.prisma.db.delegation.delete({ where: { id } });
    await this.audit(tenantId, actorId, `delegation:${id}`, 'delegation.revoked', `revoke ${dlg.fromUserId} → ${dlg.toUserId}`);
    return { ok: true, id };
  }

  // ---- position assignments / holder history (PH-01 / NX-013) --------------

  /** Classify an assignment window against `now` → active | scheduled | expired. */
  private assignmentStatus(effectiveFrom: Date, effectiveTo: Date | null, now = new Date()): 'active' | 'scheduled' | 'expired' {
    if (now < effectiveFrom) return 'scheduled';
    if (effectiveTo && now > effectiveTo) return 'expired';
    return 'active';
  }

  /** Is `now` inside [from, to] (to null = open-ended)? */
  private isWithinWindow(effectiveFrom: Date, effectiveTo: Date | null, now = new Date()): boolean {
    return now >= effectiveFrom && (!effectiveTo || now <= effectiveTo);
  }

  /**
   * The active PRIMARY assignment (window contains now) for a position, if any.
   * Used to re-derive Position.holderPersonId (the current-primary cache).
   */
  private activePrimary(rows: any[], now = new Date()): any | null {
    return rows.find((a) => a.kind === 'PRIMARY' && this.isWithinWindow(a.effectiveFrom, a.effectiveTo, now)) ?? null;
  }

  /**
   * Re-derive Position.holderPersonId from the position's assignments: the
   * active PRIMARY's person, else null (vacant). Keeps the cache in sync so the
   * org chart / role resolution (which read holderPersonId) stay correct.
   * ACTING assignments never affect the cache.
   */
  private async syncHolderCache(positionId: string): Promise<string | null> {
    const rows = await this.prisma.db.positionAssignment.findMany({ where: { positionId } });
    const active = this.activePrimary(rows);
    await this.prisma.db.position.update({
      where: { id: positionId },
      data: { holderPersonId: active ? active.personId : null },
    });
    return active ? active.personId : null;
  }

  /** Assignment history for a position (newest first) with computed status. */
  async listPositionAssignments(positionId: string) {
    const pos = await this.prisma.db.position.findUnique({ where: { id: positionId } });
    if (!pos) throw new NotFoundException(`position ${positionId} not found`);
    const rows = await this.prisma.db.positionAssignment.findMany({
      where: { positionId },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });
    const now = new Date();
    return rows.map((a: any) => ({ ...a, status: this.assignmentStatus(a.effectiveFrom, a.effectiveTo, now) }));
  }

  /**
   * Create a PositionAssignment (PRIMARY or ACTING) with an effective window.
   * Guardrails:
   *  - PRIMARY: reject overlap with another PRIMARY window (409); close the
   *    previous active PRIMARY (set its effectiveTo just before the new start);
   *    then re-sync holderPersonId (→ new primary IF its window contains now).
   *  - ACTING: never touches holderPersonId; may overlap a PRIMARY.
   * Audits. RLS-scoped via the interceptor's withTenant.
   */
  async createPositionAssignment(
    positionId: string,
    input: { personId?: string; kind?: string; effectiveFrom?: string; effectiveTo?: string | null; reason?: string | null },
    tenantId: string,
    actorId: string,
  ) {
    const pos = await this.prisma.db.position.findUnique({ where: { id: positionId } });
    if (!pos) throw new NotFoundException(`position ${positionId} not found`);

    const personId = String(input.personId ?? '').trim();
    const kind = String(input.kind ?? '').trim().toUpperCase();
    if (!personId) throw new BadRequestException('personId is required');
    if (kind !== 'PRIMARY' && kind !== 'ACTING') throw new BadRequestException('kind must be PRIMARY or ACTING');
    if (!input.effectiveFrom) throw new BadRequestException('effectiveFrom is required');
    const effectiveFrom = new Date(input.effectiveFrom);
    if (isNaN(effectiveFrom.getTime())) throw new BadRequestException('effectiveFrom must be a valid date');
    const effectiveTo = input.effectiveTo ? new Date(input.effectiveTo) : null;
    if (effectiveTo && isNaN(effectiveTo.getTime())) throw new BadRequestException('effectiveTo must be a valid date');
    if (effectiveTo && effectiveTo < effectiveFrom) throw new BadRequestException('effectiveTo must not precede effectiveFrom');

    const person = await this.prisma.db.personProfile.findUnique({ where: { id: personId } });
    if (!person) throw new NotFoundException(`person "${personId}" not found`);

    const existing = await this.prisma.db.positionAssignment.findMany({ where: { positionId } });
    const now = new Date();

    if (kind === 'PRIMARY') {
      // Window OVERLAP with an existing PRIMARY = existing.from <= new.to AND existing.to >= new.from.
      // An EARLIER-starting overlapping PRIMARY is the outgoing holder → auto-close it
      // (set effectiveTo just before the new start). An overlapping PRIMARY that starts
      // at/after the new start is a genuine conflict (e.g. two active primaries) → 409.
      const toClose: any[] = [];
      for (const a of existing as any[]) {
        if (a.kind !== 'PRIMARY') continue;
        const aFrom = new Date(a.effectiveFrom);
        const aTo = a.effectiveTo ? new Date(a.effectiveTo) : null;
        const overlaps = (!effectiveTo || aFrom <= effectiveTo) && (!aTo || aTo >= effectiveFrom);
        if (!overlaps) continue;
        if (aFrom < effectiveFrom) toClose.push(a);
        else throw new ConflictException(`PRIMARY chồng lấn thời gian với phân công PRIMARY đang có (OVERLAP:${a.id})`);
      }
      const closeAt = new Date(effectiveFrom.getTime() - 1000);
      for (const a of toClose) {
        await this.prisma.db.positionAssignment.update({ where: { id: a.id }, data: { effectiveTo: closeAt } });
      }
    }

    const created = await this.prisma.db.positionAssignment.create({
      data: { tenantId, positionId, personId, kind, effectiveFrom, effectiveTo, reason: input.reason ?? null, createdBy: actorId || null },
    });

    // PRIMARY → re-derive the holder cache (ACTING never touches it).
    if (kind === 'PRIMARY') await this.syncHolderCache(positionId);

    await this.audit(
      tenantId,
      actorId,
      `position:${positionId}`,
      'position.assignment.created',
      `${kind} ${personId} [${effectiveFrom.toISOString()}..${effectiveTo ? effectiveTo.toISOString() : '∞'}]`,
    );

    const status = this.assignmentStatus(created.effectiveFrom, created.effectiveTo, now);
    return { ...created, status };
  }

  /**
   * Revoke a PositionAssignment (+ re-derive current primary + audit). If the
   * revoked row was the active PRIMARY, holderPersonId re-derives to the next
   * active PRIMARY (or null / vacant). 404 if not found. RLS-scoped.
   */
  async deletePositionAssignment(positionId: string, assignmentId: string, tenantId: string, actorId: string) {
    const row = await this.prisma.db.positionAssignment.findUnique({ where: { id: assignmentId } });
    if (!row || row.positionId !== positionId) throw new NotFoundException(`assignment ${assignmentId} not found for position ${positionId}`);
    await this.prisma.db.positionAssignment.delete({ where: { id: assignmentId } });
    let holderPersonId: string | null = null;
    if (row.kind === 'PRIMARY') holderPersonId = await this.syncHolderCache(positionId);
    await this.audit(tenantId, actorId, `position:${positionId}`, 'position.assignment.revoked', `revoke ${row.kind} ${row.personId}`);
    return { ok: true, id: assignmentId, holderPersonId };
  }

  /**
   * Set/replace a position's PRIMARY holder from the org-chart "Đổi trưởng đơn
   * vị" path, optionally effective-dated. Backward-compatible: when the caller
   * passes only holderPersonId (no effectiveFrom) it behaves like the previous
   * direct holderPersonId set AND records a PRIMARY assignment so the timeline
   * reflects reality. holderPersonId=null clears the seat (vacant).
   */
  async setPositionHolder(
    positionId: string,
    input: { holderPersonId?: string | null; effectiveFrom?: string | null; reason?: string | null },
    tenantId: string,
    actorId: string,
  ) {
    const pos = await this.prisma.db.position.findUnique({ where: { id: positionId } });
    if (!pos) throw new NotFoundException(`position ${positionId} not found`);
    const holderPersonId = input.holderPersonId ?? null;

    if (!holderPersonId) {
      const now = new Date();
      const existing = await this.prisma.db.positionAssignment.findMany({ where: { positionId } });
      const active = this.activePrimary(existing, now);
      if (active && !active.effectiveTo) {
        await this.prisma.db.positionAssignment.update({ where: { id: active.id }, data: { effectiveTo: now } });
      }
      await this.prisma.db.position.update({ where: { id: positionId }, data: { holderPersonId: null } });
      await this.audit(tenantId, actorId, `position:${positionId}`, 'position.holder.cleared', 'holder → (vacant)');
      return this.prisma.db.position.findUnique({ where: { id: positionId } });
    }

    await this.createPositionAssignment(
      positionId,
      { personId: holderPersonId, kind: 'PRIMARY', effectiveFrom: input.effectiveFrom ?? new Date().toISOString(), reason: input.reason ?? null },
      tenantId,
      actorId,
    );
    return this.prisma.db.position.findUnique({ where: { id: positionId } });
  }
}
