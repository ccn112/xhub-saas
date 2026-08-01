import { Injectable } from '@nestjs/common';
import type { OidcClaims, OidcProvider } from './oidc.provider';

/**
 * MockOidcProvider — dev/test stand-in for a real IdP. Performs NO network I/O.
 *
 * The authorization URL points straight back at our own callback with a fake
 * `code` encoding the desired login hint (`mock:<userId-or-email>`); the token
 * exchange just decodes it into claims that resolve to a SEEDED PersonProfile
 * (via AuthService.login → membership). This proves the full round-trip
 * (login → callback → session cookie) without any external dependency.
 *
 * A real Azure AD adapter drops in here unchanged: implement getAuthorizationUrl
 * (build the /authorize URL) and exchangeCode (POST /token + verify id_token),
 * then bind it as OIDC_PROVIDER instead of this class.
 */
@Injectable()
export class MockOidcProvider implements OidcProvider {
  readonly name = 'mock';

  getAuthorizationUrl(input: { state: string; redirectUri: string; loginHint?: string }): string {
    const hint = input.loginHint || process.env.DEFAULT_USER_ID || 'user-nam';
    const code = `mock:${hint}`;
    const u = new URL(input.redirectUri);
    u.searchParams.set('code', code);
    u.searchParams.set('state', input.state);
    return u.toString();
  }

  async exchangeCode(input: { code: string }): Promise<OidcClaims> {
    const raw = input.code.startsWith('mock:') ? input.code.slice(5) : input.code;
    // `raw` is a seed userId or email; AuthService.login accepts either.
    return { sub: raw, email: raw.includes('@') ? raw : undefined, name: raw };
  }
}
