import { DynamicModule, Module } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { AssignmentResolver } from './assignment-resolver.service';
import { IdentityController } from './identity.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { XofficePrismaModule } from '../xoffice-prisma/xoffice-prisma.module';
import { XofficePrismaService } from '../xoffice-prisma/xoffice-prisma.service';
import { IDENTITY_PRISMA, IDENTITY_SEED_ENABLED } from './identity-prisma.token';

/**
 * Identity/Organization Core — Phase 1.5 Stage C.5. ONE copy of
 * IdentityService/AssignmentResolver's query code runs in BOTH processes;
 * only the underlying Prisma client differs, bound per-process via the
 * IDENTITY_PRISMA token (see identity-prisma.token.ts):
 *
 *  - forPlatform(): binds XHub Platform's PrismaService — the canonical
 *    RoleBinding/PermissionPolicy/PersonProfile/OrgUnit/Position/Group/Tenant.
 *    Registers IdentityController — Platform is the only process serving
 *    /api/identity/* (xhub-web routes /admin+/platform there).
 *  - forXoffice(): binds XofficePrismaService. PersonProfile/OrgUnit/Position/
 *    Group/RoleBinding/PermissionPolicy are a READ CACHE here, kept fresh by
 *    IdentitySyncService; DataScope/Delegation/AssignmentResolution are
 *    genuinely OWNED here (business-specific, never read by Platform's own
 *    route guards). No IdentityController — X.Office never serves these
 *    routes itself.
 *
 * Both variants are `global: true`: PermissionGuard and every business module
 * depend on IdentityService/AssignmentResolver without importing this module.
 */
@Module({})
export class IdentityModule {
  static forPlatform(): DynamicModule {
    return {
      module: IdentityModule,
      global: true,
      imports: [PrismaModule],
      controllers: [IdentityController],
      providers: [
        IdentityService,
        AssignmentResolver,
        { provide: IDENTITY_PRISMA, useExisting: PrismaService },
        { provide: IDENTITY_SEED_ENABLED, useValue: true },
      ],
      exports: [IdentityService, AssignmentResolver, IDENTITY_PRISMA],
    };
  }

  static forXoffice(): DynamicModule {
    return {
      module: IdentityModule,
      global: true,
      imports: [XofficePrismaModule],
      providers: [
        IdentityService,
        AssignmentResolver,
        { provide: IDENTITY_PRISMA, useExisting: XofficePrismaService },
        { provide: IDENTITY_SEED_ENABLED, useValue: false },
      ],
      exports: [IdentityService, AssignmentResolver, IDENTITY_PRISMA],
    };
  }
}
