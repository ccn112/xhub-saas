import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Identity } from './identity.decorator';
import { RequirePermission } from './require-permission.decorator';
import type { RequestIdentity } from './identity.types';
import { SESSION_COOKIE, isOidcEnabled } from './identity.types';
import { OIDC_PROVIDER, type OidcProvider } from './oidc/oidc.provider';
import { randomBytes } from 'node:crypto';

const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 8; // 8h

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(OIDC_PROVIDER) private readonly oidc: OidcProvider,
  ) {}

  private redirectUri(): string {
    return (
      process.env.AUTH_OIDC_REDIRECT_URI ||
      `http://localhost:${process.env.PORT ?? 4000}/api/auth/oidc/callback`
    );
  }

  private setCookie(res: Response, token: string): void {
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // dev over http; flip to true behind TLS
      path: '/',
      maxAge: SESSION_MAX_AGE_MS,
    });
  }

  /**
   * DEV login (passwordless): body { email } or { userId }. Loads user +
   * memberships, signs a JWT, sets the httpOnly `xhub_session` cookie, and also
   * returns the token in the body for non-browser clients.
   */
  @Post('login')
  async login(
    @Body() body: { email?: string; userId?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const identifier = body?.userId || body?.email || '';
    const result = await this.auth.login(identifier, body?.password);
    this.setCookie(res, result.token);
    return result;
  }

  // ---- INTERNAL auth flows (PH-00b) ---------------------------------------

  /** Admin: create a single-use invite → returns the activation URL + token
   *  (SURFACED, not emailed — `.local` accounts). Idempotent. */
  @Post('invite')
  @RequirePermission('tenant.user.invite')
  invite(@Identity() identity: RequestIdentity, @Body() body: { userId: string }) {
    return this.auth.invite(identity, body?.userId);
  }

  /** Admin: list outstanding (unused, unexpired) invites for the tenant. */
  @Get('pending-invites')
  @RequirePermission('tenant.user.invite')
  pendingInvites(@Identity() identity: RequestIdentity) {
    return this.auth.pendingInvites(identity.tenantId);
  }

  /** Public: activate an account with an invite token → sets password + session. */
  @Post('activate')
  async activate(
    @Body() body: { token: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.activate(body?.token, body?.password);
    this.setCookie(res, result.token);
    return result;
  }

  /** Public: request a password reset → returns the reset URL + token (surfaced). */
  @Post('forgot')
  forgot(@Body() body: { email?: string; userId?: string }) {
    return this.auth.forgot(body?.userId || body?.email || '');
  }

  /** Public: consume a reset token → set a new password. */
  @Post('reset')
  reset(@Body() body: { token: string; password: string }) {
    return this.auth.reset(body?.token, body?.password);
  }

  /** Admin: suspend a membership → the user's next session request is revoked. */
  @Post('suspend')
  @RequirePermission('tenant.user.suspend')
  suspend(@Identity() identity: RequestIdentity, @Body() body: { userId: string }) {
    return this.auth.suspend(identity, body?.userId);
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  me(@Identity() identity: RequestIdentity) {
    return this.auth.me(identity);
  }

  /** Read source for IdentitySyncService's periodic X.Office cache pull. */
  @Get('memberships')
  memberships(@Identity() identity: RequestIdentity) {
    return this.auth.listMemberships(identity.tenantId);
  }

  /**
   * OIDC login start (SEAM — mock provider only in this build). When enabled,
   * redirects the browser to the IdP authorization URL. With MockOidcProvider
   * that URL points straight at the callback with a fake code. `loginHint`
   * selects which seeded person to log in as (dev convenience).
   */
  @Get('oidc/login')
  oidcLogin(
    @Req() req: Request,
    @Res() res: Response,
    @Query('loginHint') loginHint?: string,
  ) {
    if (!isOidcEnabled(req.headers)) {
      throw new ServiceUnavailableException('OIDC is disabled (AUTH_OIDC_ENABLED=false)');
    }
    const state = randomBytes(16).toString('hex');
    const url = this.oidc.getAuthorizationUrl({
      state,
      redirectUri: this.redirectUri(),
      loginHint,
    });
    return res.redirect(302, url);
  }

  /**
   * OIDC callback (SEAM). Exchanges the authorization code for verified claims,
   * resolves them to a seeded PersonProfile/membership, and issues the SAME
   * `xhub_session` cookie as password login. A real IdP swaps in behind
   * OIDC_PROVIDER with no change here.
   */
  @Get('oidc/callback')
  async oidcCallback(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Query('code') code: string,
  ) {
    if (!isOidcEnabled(req.headers)) {
      throw new ServiceUnavailableException('OIDC is disabled (AUTH_OIDC_ENABLED=false)');
    }
    const claims = await this.oidc.exchangeCode({ code, redirectUri: this.redirectUri() });
    const result = await this.auth.login(claims.email || claims.sub);
    this.setCookie(res, result.token);
    return { ...result, via: 'oidc', provider: this.oidc.name };
  }

  @Post('switch-tenant')
  async switchTenant(
    @Identity() identity: RequestIdentity,
    @Body() body: { tenantId: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.switchTenant(identity, body?.tenantId);
    this.setCookie(res, result.token);
    return result;
  }
}
