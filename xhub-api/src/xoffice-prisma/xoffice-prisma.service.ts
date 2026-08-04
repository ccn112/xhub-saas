import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/xoffice-client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * X.Office's own PrismaService — Phase 1.5 Stage C. Same RLS-aware
 * withTenant/withBypass pattern as `src/prisma/prisma.service.ts` (XHub
 * Platform's), but pointed at the physically separate X.Office database
 * (`XOFFICE_DATABASE_URL`, generated client at `@prisma/xoffice-client`).
 * XOFFICE_BUSINESS modules inject THIS instead of the platform's
 * PrismaService as they're migrated off the shared database.
 */
type ScopedClient = Prisma.TransactionClient;

@Injectable()
export class XofficePrismaService extends PrismaClient implements OnModuleInit {
  private readonly als = new AsyncLocalStorage<{ tx: ScopedClient }>();

  constructor() {
    const connectionString = process.env.XOFFICE_DATABASE_URL;
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

  get db(): ScopedClient {
    return this.als.getStore()?.tx ?? (this as unknown as ScopedClient);
  }

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
