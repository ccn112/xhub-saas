/**
 * Phase 1.5 Stage C.5 — DI seam letting IdentityService/AssignmentResolver/
 * PermissionGuard run unchanged against EITHER database. PrismaService (XHub
 * Platform) and XofficePrismaService (X.Office) both implement this shape
 * identically (same withTenant/withBypass/.db pattern, generated from
 * different Prisma schemas) — IdentityModule.forPlatform()/forXoffice() binds
 * this token to whichever concrete service the running process owns.
 */
export const IDENTITY_PRISMA = 'IDENTITY_PRISMA';

/** Whether this process should run IdentityService's boot-time seed() (Platform only — it writes Tenant, which doesn't exist in X.Office's schema). */
export const IDENTITY_SEED_ENABLED = 'IDENTITY_SEED_ENABLED';

export interface IdentityPrismaClient {
  readonly db: any;
  withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T>;
  withBypass<T>(fn: () => Promise<T>): Promise<T>;
  enableShutdownHooks(app: import('@nestjs/common').INestApplication): void;
}
