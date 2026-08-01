import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { allowHeaderIdentity, SESSION_COOKIE } from './identity.types';

/**
 * Global SOFT identity guard. It resolves the request identity (session JWT →
 * header fallback → default demo) and attaches it to `req.identity` for
 * controllers to read via `@Identity()`.
 *
 * SESSION REVOKE-ON-SUSPEND (PH-00b): when the identity was resolved from the
 * `xhub_session` cookie, re-check the membership status (one indexed query). If
 * it is no longer active (admin suspended the user), clear the cookie and 401 —
 * so a suspended user's next request is revoked. The header/default dev paths
 * are unaffected (they carry no session), keeping every existing smoke green.
 */
@Injectable()
export class IdentityGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const identity = this.auth.resolveIdentity(req, {
      allowHeaderIdentity: allowHeaderIdentity(req.headers),
    });
    if (identity.source === 'session') {
      const active = await this.auth.sessionMembershipActive(
        identity.userId,
        identity.tenantId,
      );
      if (!active) {
        const res = context.switchToHttp().getResponse<Response>();
        res.clearCookie(SESSION_COOKIE, { path: '/' });
        throw new UnauthorizedException('Phiên đã bị thu hồi (tài khoản bị khoá)');
      }
    }
    req.identity = identity;
    return true;
  }
}
