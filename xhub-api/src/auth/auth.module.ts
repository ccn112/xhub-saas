import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { IdentityGuard } from './identity.guard';
import { PermissionGuard } from './permission.guard';
import { OIDC_PROVIDER } from './oidc/oidc.provider';
import { MockOidcProvider } from './oidc/mock-oidc.provider';
import { PrismaModule } from '../prisma/prisma.module';
import { SeedModule } from '../seed/seed.module';
import { IdentityModule } from '../identity/identity.module';

/**
 * Auth module — session/JWT + membership identity, OIDC-ready.
 * Global so `@Identity()` + IdentityGuard apply across the app.
 *
 * Two global guards run in order:
 *  1. IdentityGuard (SOFT) — resolves WHO (session → header → default/anonymous).
 *  2. PermissionGuard (gated) — enforces @RequirePermission via the identity
 *     RBAC/ABAC engine when AUTH_ENFORCE=true; a NO-OP otherwise. IdentityModule
 *     is imported so the guard reuses IdentityService.can (no new perm logic).
 *
 * OIDC seam: OIDC_PROVIDER is bound to MockOidcProvider (dev). A real IdP
 * adapter (Azure AD) drops in by rebinding this one token.
 */
@Global()
@Module({
  imports: [
    PrismaModule,
    SeedModule,
    IdentityModule,
    JwtModule.register({
      secret: process.env.AUTH_JWT_SECRET ?? 'dev-insecure-change-me',
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: OIDC_PROVIDER, useClass: MockOidcProvider },
    { provide: APP_GUARD, useClass: IdentityGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
