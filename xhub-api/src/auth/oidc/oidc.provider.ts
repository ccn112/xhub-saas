/**
 * OIDC seam (adapter-ready) — the interface a real IdP adapter (e.g. Azure AD
 * via openid-client / passport-openidconnect) will implement later. NO live
 * network call lives behind this in the current build; the only implementation
 * is MockOidcProvider (dev). Swapping in a real provider is a one-line DI change
 * in AuthModule — every downstream piece (session cookie, /me, switch-tenant)
 * stays identical.
 */

export interface OidcClaims {
  /** IdP subject id. */
  sub: string;
  email?: string;
  name?: string;
}

export interface OidcProvider {
  readonly name: string;
  /** Build the IdP authorization-request URL to redirect the browser to. */
  getAuthorizationUrl(input: { state: string; redirectUri: string; loginHint?: string }): string;
  /** Exchange an authorization code for verified identity claims. */
  exchangeCode(input: { code: string; redirectUri: string }): Promise<OidcClaims>;
}

export const OIDC_PROVIDER = Symbol('OIDC_PROVIDER');
