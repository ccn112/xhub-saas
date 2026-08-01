import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Immutable, never-reused. Customers start here; T001–T010 are reserved. */
const CUSTOMER_TENANT_NO_START = 11;

/** Fields a PATCH may change. tenantNo/tenantCode/tenantKey/id are IMMUTABLE. */
const PATCHABLE = ['name', 'status', 'planId', 'blueprintId', 'industry', 'tenantClass'] as const;
const IMMUTABLE = ['tenantNo', 'tenantCode', 'tenantKey', 'id', 'slug'];

const VALID_STATUS = ['ACTIVE', 'PLANNED', 'SUSPENDED', 'CLOSED'];

export interface RegisterTenantInput {
  name: string;
  tenantKey?: string;
  industry?: string;
  planId?: string;
  blueprintId?: string;
  actorId?: string;
}

/**
 * TenantRegistryService — reads/writes the SHARED `Tenant` table (platform
 * plane, cross-tenant) exclusively via `prisma.withBypass`; it NEVER opens
 * withTenant. The registry holds administrative metadata only (no tenant
 * business data). T001–T010 are fixed/reserved; customers are allocated
 * tenantNo >= 11, monotonically, never reused. All mutations write an AuditLog.
 */
@Injectable()
export class TenantRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- reads (helpers reusable by later hardcoded-xtech cleanup) -----------

  list() {
    return this.prisma.withBypass(() =>
      this.prisma.db.tenant.findMany({
        where: { tenantNo: { not: null } },
        orderBy: { tenantNo: 'asc' },
      }),
    );
  }

  /**
   * Console dashboard summary: counts by tenantClass and by status over the
   * commercial registry (tenantNo NOT NULL). Reads shared Tenant metadata only.
   */
  async summary() {
    const rows = await this.prisma.withBypass(() =>
      this.prisma.db.tenant.findMany({
        where: { tenantNo: { not: null } },
        select: { tenantClass: true, status: true },
      }),
    );
    const byClass: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    for (const r of rows as any[]) {
      const cls = r.tenantClass ?? 'UNKNOWN';
      const st = r.status ?? 'UNKNOWN';
      byClass[cls] = (byClass[cls] ?? 0) + 1;
      byStatus[st] = (byStatus[st] ?? 0) + 1;
    }
    return { total: rows.length, byClass, byStatus };
  }

  /** Resolve a registry row by id, tenantCode (T001) or tenantKey. */
  async getById(idOrCode: string) {
    const row = await this.prisma.withBypass(() =>
      this.prisma.db.tenant.findFirst({
        where: {
          OR: [{ id: idOrCode }, { tenantCode: idOrCode }, { tenantKey: idOrCode }],
        },
      }),
    );
    if (!row) throw new NotFoundException(`tenant not found: ${idOrCode}`);
    return row;
  }

  /** Registry lookup by friendly key (e.g. "xtech"). Null if absent. */
  getByKey(tenantKey: string) {
    return this.prisma.withBypass(() =>
      this.prisma.db.tenant.findUnique({ where: { tenantKey } }),
    );
  }

  // ---- allocator -----------------------------------------------------------

  /**
   * Allocate the next CUSTOMER tenantNo (>= 11), monotonic and never reused.
   * Runs inside a transaction with a row lock (`SELECT ... FOR UPDATE`) over the
   * current max customer tenantNo so concurrent allocations cannot collide.
   * T001–T010 are fixed/reserved and are never returned here.
   */
  async allocateCustomerTenantNo(): Promise<number> {
    return this.prisma.withBypass(async () => {
      // Transaction-scoped advisory lock serializes concurrent allocators even
      // when no customer rows exist yet (an aggregate MAX() cannot take
      // FOR UPDATE). Released automatically at commit/rollback.
      await this.prisma.db.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(987001)`);
      const rows = await this.prisma.db.$queryRawUnsafe<{ max: number | null }[]>(
        `SELECT MAX("tenantNo") AS max FROM "Tenant" WHERE "tenantNo" >= ${CUSTOMER_TENANT_NO_START}`,
      );
      const currentMax = rows[0]?.max ?? null;
      return currentMax == null ? CUSTOMER_TENANT_NO_START : Number(currentMax) + 1;
    });
  }

  private tenantCodeFor(tenantNo: number): string {
    return `T${String(tenantNo).padStart(3, '0')}`;
  }

  // ---- writes --------------------------------------------------------------

  /**
   * Register a new CUSTOMER tenant: allocates tenantNo >= 11 and a derived
   * tenantCode, both immutable. Creates a registry row only (status PLANNED;
   * no org/user/business data — that is the Launch Factory's job).
   */
  async registerCustomer(input: RegisterTenantInput) {
    if (!input.name?.trim()) throw new BadRequestException('name is required');

    return this.prisma.withBypass(async () => {
      const tenantNo = await this.allocateCustomerTenantNo();
      const tenantCode = this.tenantCodeFor(tenantNo);
      const tenantKey = (input.tenantKey?.trim() || `customer-${tenantNo}`).toLowerCase();
      const id = `tenant-${tenantKey}`;

      const dup = await this.prisma.db.tenant.findFirst({
        where: { OR: [{ id }, { tenantKey }] },
      });
      if (dup) throw new BadRequestException(`tenantKey already in use: ${tenantKey}`);

      const row = await this.prisma.db.tenant.create({
        data: {
          id,
          slug: tenantKey,
          name: input.name.trim(),
          tenantNo,
          tenantCode,
          tenantKey,
          tenantClass: 'CUSTOMER',
          industry: input.industry ?? null,
          status: 'PLANNED',
          planId: input.planId ?? null,
          blueprintId: input.blueprintId ?? null,
          // Tenant Lifecycle: new CUSTOMER tenants start in DEMO (go-live → LIVE).
          mode: 'DEMO',
        },
      });
      await this.audit(row.id, input.actorId, 'register', {
        tenantNo,
        tenantCode,
        tenantClass: 'CUSTOMER',
      });
      return row;
    });
  }

  /**
   * Patch mutable registry metadata. Any attempt to change an immutable field
   * (tenantNo/tenantCode/tenantKey/id/slug) → 400.
   */
  async patch(idOrCode: string, body: Record<string, any>, actorId?: string) {
    for (const k of IMMUTABLE) {
      if (k in body) {
        throw new BadRequestException(`field '${k}' is immutable and cannot be changed`);
      }
    }
    if (body.status != null && !VALID_STATUS.includes(body.status)) {
      throw new BadRequestException(`invalid status: ${body.status}`);
    }

    const current = await this.getById(idOrCode);
    const data: Record<string, any> = {};
    for (const k of PATCHABLE) {
      if (body[k] !== undefined) data[k] = body[k];
    }
    if (Object.keys(data).length === 0) return current;

    return this.prisma.withBypass(async () => {
      const row = await this.prisma.db.tenant.update({ where: { id: current.id }, data });
      await this.audit(row.id, actorId, 'patch', data);
      return row;
    });
  }

  // ---- audit (runs under the caller's withBypass tx) -----------------------

  private async audit(
    tenantId: string,
    actorId: string | undefined,
    action: string,
    detail: Record<string, any>,
  ) {
    try {
      await this.prisma.db.auditLog.create({
        data: {
          tenantId,
          actorId: actorId || 'platform',
          instanceCode: 'platform.tenant-registry',
          action,
          detail: JSON.stringify(detail),
        },
      });
    } catch {
      // best-effort — never fail the registry write on audit append.
    }
  }
}
