/**
 * Configuration helpers for the optional DocPouch OIDC integration.
 *
 * In production the PGT authenticates against DocPouch (OIDC only). For local
 * development `AUTH_MODE=local` keeps the legacy email/password login working.
 */

export type AuthMode = 'local' | 'oidc';

export interface DocPouchOidcConfig {
  mode: AuthMode;
  docPouchUrl: string;
  issuer: string;
  clientId: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scope: string;
  timeoutMs: number;
  accessTokenTtl: string;
  refreshTokenTtl: string;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function getAuthMode(): AuthMode {
  return (process.env['AUTH_MODE'] || 'local').toLowerCase() === 'oidc'
    ? 'oidc'
    : 'local';
}

export function isOidcMode(): boolean {
  return getAuthMode() === 'oidc';
}

export function getOidcConfig(): DocPouchOidcConfig {
  const mode = getAuthMode();
  const docPouchUrl = trimTrailingSlash(
    process.env['DOCPOUCH_URL'] || 'http://localhost:3031',
  );
  const publicUrl = trimTrailingSlash(
    process.env['PGT_PUBLIC_URL'] || 'http://localhost:4200',
  );
  const redirectUri =
    process.env['PGT_OIDC_REDIRECT_URI'] || `${publicUrl}/auth/callback`;
  const postLogoutRedirectUri =
    process.env['PGT_POST_LOGOUT_REDIRECT_URI'] || `${publicUrl}/`;

  return {
    mode: getAuthMode(),
    docPouchUrl,
    issuer: trimTrailingSlash(
      process.env['DOCPOUCH_OIDC_ISSUER'] || `${docPouchUrl}/oidc`,
    ),
    clientId: process.env['DOCPOUCH_CLIENT_ID'] || '',
    redirectUri,
    postLogoutRedirectUri,
    scope:
      process.env['DOCPOUCH_OIDC_SCOPE'] ||
      'openid profile email offline_access',
    timeoutMs: Number(process.env['DOCPOUCH_TIMEOUT_MS'] || 5000),
    accessTokenTtl:
      process.env['PGT_ACCESS_TOKEN_TTL'] || (mode === 'oidc' ? '8h' : '10m'),
    refreshTokenTtl: process.env['PGT_REFRESH_TOKEN_TTL'] || '2d',
  };
}
