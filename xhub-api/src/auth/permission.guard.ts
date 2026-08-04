import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IdentityService } from '../identity/identity.service';
import { IDENTITY_PRISMA } from '../identity/identity-prisma.token';
import type { IdentityPrismaClient } from '../identity/identity-prisma.token';
import type { RequestIdentity } from './identity.types';
import { isEnforcing, REQUIRE_PERMISSION_KEY } from './identity.types';

/**
 * Global authorization guard (runs AFTER IdentityGuard, which sets
 * req.identity). It only acts on handlers/controllers tagged with
 * `@RequirePermission('perm.code')`; untagged routes pass straight through.
 *
 * For a tagged route:
 *  1. AUTHENTICATION — if the resolved identity is `anonymous` (no session and
 *     header identity disabled via AUTH_ALLOW_HEADER_IDENTITY=false), throw 401.
 *     This is independent of enforcement.
 *  2. AUTHORIZATION — when enforcing (AUTH_ENFORCE=true or the test-only
 *     `x-authz-enforce` header), delegate the decision to the identity RBAC/ABAC
 *     engine (IdentityService.can). Throw 403 if the caller lacks the permission.
 *     When NOT enforcing (default demo), it is a NO-OP with a debug log — the
 *     running demo and all existing smokes are unchanged.
 *
 * The RBAC/ABAC data is the SHARED identity plane (spans tenants, seeded under
 * bypass) and this guard runs before any withTenant context is opened, so the
 * decision query runs under withBypass.
 *
 * IMPORTANT (Phase 1.5 Stage C.5): `prisma` here MUST be the same
 * IDENTITY_PRISMA-bound instance IdentityService itself uses, not the
 * concrete Platform PrismaService — withBypass/.db are per-instance
 * (AsyncLocalStorage-scoped), so opening bypass on the wrong database's
 * client would silently no-op the one IdentityService actually queries.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly identity: IdentityService,
    @Inject(IDENTITY_PRISMA) private readonly prisma: IdentityPrismaClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permCode = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!permCode) return true; // unprotected route

    const req = context.switchToHttp().getRequest();
    const id = req.identity as RequestIdentity | undefined;

    // 1. Authentication.
    if (!id || id.source === 'anonymous' || !id.userId) {
      throw new UnauthorizedException('Authentication required');
    }

    // 2. Authorization (gated).
    if (!isEnforcing(req.headers)) {
      this.logger.debug(
        `[soft] ${req.method} ${req.url} requires '${permCode}' (enforcement OFF) — allowing ${id.userId}`,
      );
      return true;
    }

    const decision = await this.prisma.withBypass(() =>
      this.identity.can(id.userId, permCode),
    );
    if (!decision.allowed) {
      throw new ForbiddenException(
        `Missing permission '${permCode}' (${decision.reason})`,
      );
    }
    return true;
  }
}
