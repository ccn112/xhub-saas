import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestIdentity } from './identity.types';

/**
 * `@Identity()` param decorator — returns `req.identity` populated by
 * IdentityGuard. Controllers read this instead of parsing headers directly;
 * the header fallback still lives in the guard for E2E + legacy FE.
 */
export const Identity = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestIdentity => {
    const req = ctx.switchToHttp().getRequest();
    return req.identity as RequestIdentity;
  },
);
