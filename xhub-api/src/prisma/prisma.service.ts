import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * The tenant-scoped client type used inside a withTenant / withBypass context.
 * It is the interactive-transaction client (no $transaction / $connect etc.).
 */
type ScopedClient = Prisma.TransactionClient;

/**
 * Nest-managed PrismaClient. Prisma 7 requires a driver adapter for a direct
 * database connection; we use the pg adapter built from DATABASE_URL.
 *
 * ---- Postgres RLS (per-tenant) support ---------------------------------
 * Postgres Row-Level Security scopes every tenant table to the value of the
 * session GUC `app.current_tenant`. Because @prisma/adapter-pg uses a
 * connection pool, the ONLY reliable way to pin that GUC to a request is to run
 * the work inside a single interactive transaction and `SET LOCAL` the value at
 * its start (SET LOCAL is scoped to the transaction / its one connection).
 *
 *  - `withTenant(tenantId, fn)` opens such a transaction, sets
 *    app.current_tenant, and runs `fn` with the transaction client stored in an
 *    AsyncLocalStorage. Every model call routed through `this.db` then joins
 *    that transaction and is RLS-scoped to the tenant.
 *  - `withBypass(fn)` sets app.bypass_rls='on' instead — for platform / seed /
 *    scheduler work that legitimately spans tenants (the RLS policies allow a
 *    bypass only when that GUC is 'on').
 *  - `db` returns the active scoped client, or the base client when no context
 *    is open (base client with no GUC set → RLS returns zero rows, fail-safe).
 *
 * Both helpers are RE-ENTRANT: if a scoped context is already open, they simply
 * run `fn` without opening a nested transaction (Prisma forbids those).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly als = new AsyncLocalStorage<{ tx: ScopedClient }>();

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  enableShutdownHooks(app: INestApplication): void {
    process.on('beforeExit', () => {
      void app.close();
    });
  }

  /**
   * The tenant-scoped client for the current async context. Inside
   * withTenant/withBypass this is the interactive-transaction client that
   * carries the SET LOCAL app.current_tenant / app.bypass_rls; outside any
   * context it is the base client (unscoped → RLS yields zero rows).
   */
  get db(): ScopedClient {
    return this.als.getStore()?.tx ?? (this as unknown as ScopedClient);
  }

  /**
   * Run `fn` in a transaction pinned to `tenantId` via SET LOCAL
   * app.current_tenant, so Postgres RLS scopes every query. Re-entrant.
   */
  async withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    if (this.als.getStore()) return fn();
    return this.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.current_tenant', $1, true)",
          tenantId,
        );
        return this.als.run({ tx }, fn);
      },
      { maxWait: 10_000, timeout: 30_000 },
    );
  }

  /**
   * Run `fn` with RLS bypassed (SET LOCAL app.bypass_rls='on') for platform /
   * seed / scheduler operations that legitimately span tenants. Re-entrant.
   */
  async withBypass<T>(fn: () => Promise<T>): Promise<T> {
    if (this.als.getStore()) return fn();
    return this.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.bypass_rls', 'on', true)",
        );
        return this.als.run({ tx }, fn);
      },
      { maxWait: 10_000, timeout: 30_000 },
    );
  }
}
