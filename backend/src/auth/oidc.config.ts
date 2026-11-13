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
  /** public URL of this installation, used to find its Tool Details Document */
  publicUrl: string;
  /**
   * Optional: id of the DocPouch structure for published results. When set,
   * it has priority over the lookup in the Tool Details Document.
   */
  resultStructureId: string;
  /**
   * Max. DocPouch requests (whoami) per 15 minutes for the whole PGT server.
   * DocPouch allows 100 GET requests per 15 minutes per IP; keep a reserve.
   */
  docPouchRequestBudget: number;
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
    process.env['DOCPOUCH_URL'] || 'http://localhost:3033',
  );
  const publicUrl = trimTrailingSlash(
    process.env['PGT_PUBLIC_URL'] || 'http://localhost:4200',
  );
  // Fallbacks only: the localized frontend derives the effective redirect and
  // post-logout URIs from its own <base href> (e.g. /tc/PeerGrading/de/), so
  // they include the language prefix. These values are used when the browser
  // cannot compute them.
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
    // OIDC: short access token. When it expires the frontend exchanges a
    // fresh DocPouch token, so blocked DocPouch accounts lose access quickly.
    accessTokenTtl:
      process.env['PGT_ACCESS_TOKEN_TTL'] || (mode === 'oidc' ? '1h' : '10m'),
    refreshTokenTtl: process.env['PGT_REFRESH_TOKEN_TTL'] || '2d',
    publicUrl,
    resultStructureId: process.env['PGT_RESULT_STRUCTURE_ID'] || '',
    docPouchRequestBudget: Number(
      process.env['DOCPOUCH_REQUEST_BUDGET'] || 60,
    ),
  };
}
