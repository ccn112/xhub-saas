import { DynamicModule, Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { IdentityGuard } from './identity.guard';
import { PermissionGuard } from './permission.guard';
import { OIDC_PROVIDER } from './oidc/oidc.provider';
import { MockOidcProvider } from './oidc/mock-oidc.provider';
import { SeedModule } from '../seed/seed.module';

const COMMON: Omit<DynamicModule, 'module'> = {
  global: true,
  imports: [
    SeedModule,
    JwtModule.register({
      secret: process.env.AUTH_JWT_SECRET ?? 'dev-insecure-change-me',
      signOptions: { expiresIn: '8h' },
    }),
  ],
  providers: [
    AuthService,
    { provide: OIDC_PROVIDER, useClass: MockOidcProvider },
    { provide: APP_GUARD, useClass: IdentityGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
  exports: [AuthService],
};

/**
 * Auth module — session/JWT + membership identity, OIDC-ready.
 * Global so `@Identity()` + IdentityGuard apply across the app.
 *
 * Two global guards run in order:
 *  1. IdentityGuard (SOFT) — resolves WHO (session → header → default/anonymous).
 *  2. PermissionGuard (gated) — enforces @RequirePermission via the identity
 *     RBAC/ABAC engine when AUTH_ENFORCE=true; a NO-OP otherwise. Reuses
 *     IdentityService.can (no new perm logic) — IdentityService is resolved
 *     globally (IdentityModule.forPlatform()/forXoffice(), bound by whichever
 *     composition root loads this module; see identity.module.ts Stage C.5),
 *     not imported here directly.
 *
 * OIDC seam: OIDC_PROVIDER is bound to MockOidcProvider (dev). A real IdP
 * adapter (Azure AD) drops in by rebinding this one token.
 *
 * Phase 1.5 Stage C follow-up (2026-08-04): `AuthService` itself now injects
 * `IDENTITY_PRISMA` (see auth.service.ts) instead of a hardcoded `PrismaService`
 * — it resolves that token from whichever `IdentityModule.forPlatform()`/
 * `forXoffice()` variant is loaded in the SAME composition root (a sibling
 * global module, not imported here directly — identical to how PermissionGuard
 * already resolved it before this change). This closes a real gap: previously
 * EVERY request through the X.Office process's `IdentityGuard` opened a live
 * Postgres connection straight to the Platform database just to check
 * Membership.status (`sessionMembershipActive`) — a shared-DB dependency the
 * "physical DB split" was supposed to have eliminated. `Membership` is now a
 * local read cache in X.Office too (synced by IdentitySyncService), same
 * pattern as PersonProfile/RoleBinding.
 *
 * `forPlatform()` registers `AuthController` (login/invite/activate/forgot/
 * reset/suspend/oidc — the identity-provider surface: XHub Platform is the
 * only place a session is actually ISSUED). `forXoffice()` does NOT register
 * it — mirrors `IdentityModule.forXoffice()` not registering
 * `IdentityController` for the same reason: the frontend never calls these
 * routes against the X.Office origin (confirmed — `xhub-web`'s login/me/
 * switch-tenant routes always target `PLATFORM_BASE_SERVER`), and several of
 * `AuthService`'s admin methods touch `UserCredential`/`AuthToken`, which
 * don't exist in X.Office's schema at all. `AuthService` (for
 * `resolveIdentity`/`sessionMembershipActive`, what the global guards
 * actually need on every request) is still provided in both.
 */
@Global()
@Module({})
export class AuthModule {
  static forPlatform(): DynamicModule {
    return { module: AuthModule, ...COMMON, controllers: [AuthController] };
  }

  static forXoffice(): DynamicModule {
    return { module: AuthModule, ...COMMON, controllers: [] };
  }
}
