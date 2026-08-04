import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ControlplaneService } from '../../controlplane/controlplane.service';
import { assertNoSecretFields, contentChecksum } from '../../common/document-guards';

/**
 * Blueprint & Seed Pack catalog (SaaS step 4 — E5). SHARED / platform-plane
 * (Blueprint / SeedPack: NO tenantId, NO RLS) — every DB access is wrapped in
 * withBypass so the Prisma model accessors resolve on the als-bound proxy client
 * (see tenant-launch.service note). Tenant-scoped seed writes open withTenant.
 *
 * Immutability (non-negotiable #9): a PUBLISHED (code, version) is frozen — an
 * edit is rejected (create a new version instead). Secret guard (non-negotiable
 * #10): assertNoSecretFields() runs over a seed pack's datasets on publish.
 * Both reuse the WorkflowVersion checksum precedent + the backup secret guard.
 */
@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly controlplane: ControlplaneService,
  ) {}

  private get db() {
    return this.prisma.db;
  }

  // ---- checksums -----------------------------------------------------------

  private blueprintChecksum(b: any): string {
    return contentChecksum({
      code: b.code,
      version: b.version,
      industry: b.industry ?? null,
      inheritsCode: b.inheritsCode ?? null,
      appsEnabled: b.appsEnabled ?? [],
      roleSet: b.roleSet ?? [],
      orgTemplate: b.orgTemplate ?? {},
      workflowSet: b.workflowSet ?? [],
      menuEntitlement: b.menuEntitlement ?? {},
      compatiblePlans: b.compatiblePlans ?? [],
    });
  }

  private seedPackChecksum(p: any): string {
    return contentChecksum({
      code: p.code,
      version: p.version,
      blueprintCode: p.blueprintCode ?? null,
      dependencies: p.dependencies ?? [],
      datasets: p.datasets ?? [],
    });
  }

  // ---- blueprint reads -----------------------------------------------------

  listBlueprints() {
    return this.prisma.withBypass(() =>
      this.db.blueprint.findMany({ orderBy: [{ code: 'asc' }, { version: 'desc' }] }),
    );
  }

  async getBlueprint(code: string, version?: number) {
    const row = await this.prisma.withBypass(() =>
      version != null
        ? this.db.blueprint.findUnique({ where: { code_version: { code, version } } })
        : this.db.blueprint.findFirst({
            where: { code, status: 'PUBLISHED' },
            orderBy: { version: 'desc' },
          }),
    );
    // fall back to latest of any status when no PUBLISHED exists (draft view)
    const found =
      row ??
      (await this.prisma.withBypass(() =>
        this.db.blueprint.findFirst({ where: { code }, orderBy: { version: 'desc' } }),
      ));
    if (!found) throw new NotFoundException(`blueprint not found: ${code}${version != null ? '@' + version : ''}`);
    return found;
  }

  async getBlueprintById(id: string) {
    const row = await this.prisma.withBypass(() => this.db.blueprint.findUnique({ where: { id } }));
    if (!row) throw new NotFoundException(`blueprint not found: ${id}`);
    return row;
  }

  // ---- blueprint writes ----------------------------------------------------

  async createBlueprint(input: any) {
    const code = String(input.code ?? '').trim();
    if (!code) throw new BadRequestException('code is required');
    const version = Number(input.version ?? 1);
    return this.prisma.withBypass(async () => {
      const existing = await this.db.blueprint.findUnique({ where: { code_version: { code, version } } });
      if (existing) throw new BadRequestException(`blueprint ${code}@${version} already exists`);
      const data: any = {
        code,
        version,
        name: input.name ?? code,
        industry: input.industry ?? null,
        inheritsCode: input.inheritsCode ?? null,
        appsEnabled: input.appsEnabled ?? [],
        roleSet: input.roleSet ?? [],
        orgTemplate: input.orgTemplate ?? {},
        workflowSet: input.workflowSet ?? [],
        menuEntitlement: input.menuEntitlement ?? {},
        compatiblePlans: input.compatiblePlans ?? [],
        status: 'DRAFT',
      };
      data.checksum = this.blueprintChecksum(data);
      return this.db.blueprint.create({ data });
    });
  }

  /** Patch a DRAFT blueprint. A PUBLISHED (code,version) is IMMUTABLE → 400. */
  async patchBlueprint(id: string, patch: any) {
    return this.prisma.withBypass(async () => {
      const row = await this.db.blueprint.findUnique({ where: { id } });
      if (!row) throw new NotFoundException(`blueprint not found: ${id}`);
      if (row.status === 'PUBLISHED') {
        throw new BadRequestException(
          `blueprint ${row.code}@${row.version} is PUBLISHED and immutable — create a new version instead`,
        );
      }
      const mutable = ['name', 'industry', 'inheritsCode', 'appsEnabled', 'roleSet', 'orgTemplate', 'workflowSet', 'menuEntitlement', 'compatiblePlans'];
      const data: any = {};
      for (const k of mutable) if (patch[k] !== undefined) data[k] = patch[k];
      const merged = { ...row, ...data };
      data.checksum = this.blueprintChecksum(merged);
      return this.db.blueprint.update({ where: { id }, data });
    });
  }

  async publishBlueprint(id: string) {
    return this.prisma.withBypass(async () => {
      const row = await this.db.blueprint.findUnique({ where: { id } });
      if (!row) throw new NotFoundException(`blueprint not found: ${id}`);
      if (row.status === 'PUBLISHED') return row; // idempotent no-op
      const checksum = this.blueprintChecksum(row);
      // Supersede any prior PUBLISHED version of the same code.
      await this.db.blueprint.updateMany({
        where: { code: row.code, status: 'PUBLISHED' },
        data: { status: 'SUPERSEDED' },
      });
      return this.db.blueprint.update({
        where: { id },
        data: { status: 'PUBLISHED', checksum, publishedAt: new Date() },
      });
    });
  }

  // ---- seed pack reads -----------------------------------------------------

  listSeedPacks() {
    return this.prisma.withBypass(() =>
      this.db.seedPack.findMany({ orderBy: [{ code: 'asc' }, { version: 'desc' }] }),
    );
  }

  async getSeedPack(code: string, version?: number) {
    const row = await this.prisma.withBypass(() =>
      version != null
        ? this.db.seedPack.findUnique({ where: { code_version: { code, version } } })
        : this.db.seedPack.findFirst({ where: { code, status: 'PUBLISHED' }, orderBy: { version: 'desc' } }),
    );
    const found =
      row ??
      (await this.prisma.withBypass(() =>
        this.db.seedPack.findFirst({ where: { code }, orderBy: { version: 'desc' } }),
      ));
    if (!found) throw new NotFoundException(`seed pack not found: ${code}${version != null ? '@' + version : ''}`);
    return found;
  }

  async getSeedPackById(id: string) {
    const row = await this.prisma.withBypass(() => this.db.seedPack.findUnique({ where: { id } }));
    if (!row) throw new NotFoundException(`seed pack not found: ${id}`);
    return row;
  }

  // ---- seed pack writes ----------------------------------------------------

  async createSeedPack(input: any) {
    const code = String(input.code ?? '').trim();
    if (!code) throw new BadRequestException('code is required');
    const version = Number(input.version ?? 1);
    return this.prisma.withBypass(async () => {
      const existing = await this.db.seedPack.findUnique({ where: { code_version: { code, version } } });
      if (existing) throw new BadRequestException(`seed pack ${code}@${version} already exists`);
      const data: any = {
        code,
        version,
        name: input.name ?? code,
        blueprintCode: input.blueprintCode ?? null,
        dependencies: input.dependencies ?? [],
        datasets: input.datasets ?? [],
        status: 'DRAFT',
      };
      data.checksum = this.seedPackChecksum(data);
      return this.db.seedPack.create({ data });
    });
  }

  /**
   * Publish a seed pack: run the SECRET GUARD over its datasets (reject on any
   * password/token/secret field — non-negotiable #10), then freeze. Republish of
   * an already-published pack is an idempotent no-op.
   */
  async publishSeedPack(id: string) {
    return this.prisma.withBypass(async () => {
      const row = await this.db.seedPack.findUnique({ where: { id } });
      if (!row) throw new NotFoundException(`seed pack not found: ${id}`);
      if (row.status === 'PUBLISHED') return row; // idempotent no-op
      // SECRET GUARD (reuses backup assertNoSecretFields) — throws MUST_NOT_LEAK.
      try {
        assertNoSecretFields(row.datasets);
      } catch (e: any) {
        throw new BadRequestException(String(e?.message ?? e));
      }
      const checksum = this.seedPackChecksum(row);
      await this.db.seedPack.updateMany({
        where: { code: row.code, status: 'PUBLISHED' },
        data: { status: 'SUPERSEDED' },
      });
      return this.db.seedPack.update({
        where: { id },
        data: { status: 'PUBLISHED', checksum, publishedAt: new Date() },
      });
    });
  }

  // ---- apply (idempotent) --------------------------------------------------

  /**
   * Apply a blueprint to a tenant: enable its apps (control-plane, idempotent
   * upsert) and ensure its org template (idempotent upsert, RLS-scoped). Roles
   * are resolved through the shared role registry, so a blueprint's roleSet is
   * recorded but not re-seeded here. Re-apply is a no-op.
   */
  async applyBlueprint(tenantId: string, blueprintCode: string, version?: number) {
    const bp = await this.getBlueprint(blueprintCode, version);
    const enabled: string[] = [];
    await this.prisma.withBypass(async () => {
      for (const code of (bp.appsEnabled as string[]) ?? []) {
        await this.controlplane.setTenantApplication(tenantId, code, 'enabled');
        enabled.push(code);
      }
    });
    // Org template — ensure units exist (parent resolved by code within tenant).
    const units: any[] = ((bp.orgTemplate as any)?.units ?? []) as any[];
    let orgUnits = 0;
    if (units.length) {
      await this.prisma.withTenant(tenantId, async () => {
        for (const u of units) {
          const id = `${tenantId}:bp:${u.code}`;
          const parentId = u.parentCode ? `${tenantId}:bp:${u.parentCode}` : null;
          // ROOT falls back to the launch identity-baseline root when present.
          const resolvedParent = u.parentCode === 'ROOT' ? `${tenantId}-org-root` : parentId;
          await this.db.orgUnit.upsert({
            where: { id },
            update: { name: u.name, type: u.type ?? 'DEPARTMENT' },
            create: {
              id,
              tenantId,
              code: `BP-${u.code}`,
              name: u.name,
              type: u.type ?? 'DEPARTMENT',
              parentId: resolvedParent,
            },
          });
          orgUnits++;
        }
      });
    }
    return {
      blueprintCode: bp.code,
      version: bp.version,
      status: bp.status,
      appsEnabled: enabled,
      orgUnits,
      roleSet: bp.roleSet,
      menuEntitlement: bp.menuEntitlement,
      checksum: bp.checksum,
    };
  }

  /**
   * Apply a seed pack (+ its dependencies, published-first) to a tenant. Each
   * dataset is an idempotent per-model upsert-by-id, parameterized by tenantId.
   * `prefixId` derives a per-tenant id (`<tenantId>:<rowId>`); otherwise the row
   * id is used verbatim (for a tenant-fixed pack like SP-XTECH-OPS). Re-apply is
   * a no-op (upsert by id).
   */
  async applySeedPack(tenantId: string, seedPackCode: string, version?: number, _seen = new Set<string>()): Promise<any> {
    if (_seen.has(seedPackCode)) return { seedPackCode, skipped: 'already-applied-in-chain' };
    _seen.add(seedPackCode);
    const pack = await this.getSeedPack(seedPackCode, version);

    // Dependencies first (published latest).
    const applied: any[] = [];
    for (const dep of (pack.dependencies as string[]) ?? []) {
      applied.push(await this.applySeedPack(tenantId, dep, undefined, _seen));
    }

    const datasets: any[] = (pack.datasets as any[]) ?? [];
    const rowsByModel: Record<string, number> = {};
    if (datasets.length) {
      await this.prisma.withTenant(tenantId, async () => {
        for (const ds of datasets) {
          const model = ds.model as string;
          const delegate = (this.db as any)[model];
          if (!delegate?.upsert) throw new BadRequestException(`unknown seed dataset model: ${model}`);
          for (const raw of ds.rows ?? []) {
            const id = ds.prefixId ? `${tenantId}:${raw.id}` : raw.id;
            const record = this.coerceRow({ ...raw, id, tenantId });
            const { id: _id, ...rest } = record;
            await delegate.upsert({ where: { id }, update: rest, create: record });
            rowsByModel[model] = (rowsByModel[model] ?? 0) + 1;
          }
        }
      });
    }
    return { seedPackCode: pack.code, version: pack.version, status: pack.status, rows: rowsByModel, dependencies: applied };
  }

  /** Coerce ISO date strings to Date for DateTime columns (effectiveFrom / publishedAt). */
  private coerceRow(row: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) out[k] = new Date(v);
      else out[k] = v;
    }
    return out;
  }
}
