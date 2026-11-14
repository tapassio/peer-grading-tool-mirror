import { normalizeBasePath } from '../config';

/**
 * The PGT refresh token lives in an HttpOnly cookie, so JavaScript in the
 * browser (and therefore an XSS bug) can never read it. The access token is
 * only kept in memory by the frontend.
 *
 * - HttpOnly: not readable with document.cookie
 * - Secure: only over HTTPS (in production)
 * - SameSite=Strict: not sent with requests from other sites (CSRF)
 * - Path: only sent to <base>/api/auth, not to other tools on the same host
 */
export const REFRESH_COOKIE = 'pgt_refresh';

export function refreshCookiePath(): string {
  return `${normalizeBasePath(process.env.APP_BASE_PATH)}/api/auth`;
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.PRODUCTION === 'true',
    sameSite: 'strict' as const,
    path: refreshCookiePath(),
  };
}

/** expiry of a JWT (without checking it; only used for the cookie lifetime) */
function jwtExpiry(token: string): Date | undefined {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    );
    return typeof payload.exp === 'number'
      ? new Date(payload.exp * 1000)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Puts the refresh token into the cookie and returns only the access token
 * for the JSON response.
 */
export function sendTokens(
  res: any,
  tokens: { accessToken: string; refreshToken: string },
): { accessToken: string } {
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...refreshCookieOptions(),
    expires: jwtExpiry(tokens.refreshToken),
  });
  return { accessToken: tokens.accessToken };
}

export function clearRefreshCookie(res: any): void {
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
}

/** reads the refresh token from the Cookie header (no cookie-parser needed) */
export function readRefreshCookie(req: {
  headers?: Record<string, any>;
}): string | null {
  const header: string = req.headers?.cookie || '';
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() === REFRESH_COOKIE) {
      const value = part.slice(index + 1).trim();
      try {
        return decodeURIComponent(value) || null;
      } catch {
        return null;
      }
    }
  }
  return null;
}
