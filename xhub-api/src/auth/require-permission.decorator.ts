import { SetMetadata } from '@nestjs/common';
import { REQUIRE_PERMISSION_KEY } from './identity.types';

/**
 * `@RequirePermission('perm.code')` — marks a handler (or controller) as
 * requiring the caller to hold `permCode` in the identity RBAC/ABAC engine.
 *
 * The PermissionGuard reads this metadata. Behaviour is ADDITIVE and gated:
 *  - default runtime (AUTH_ENFORCE unset/false): NO-OP (debug log only) — the
 *    demo + every existing smoke are unaffected;
 *  - enforcing (AUTH_ENFORCE=true, or the test-only `x-authz-enforce` header):
 *    the guard asks IdentityService.can(userId, permCode) and throws 403 if the
 *    caller does not hold it. An anonymous caller (no session + header identity
 *    disabled) gets 401 on any protected route, regardless of enforcement.
 */
export const RequirePermission = (permCode: string) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permCode);
