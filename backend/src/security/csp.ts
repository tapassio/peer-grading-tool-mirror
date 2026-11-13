/** Helpers for the Content-Security-Policy in main.ts */

/**
 * The frontend talks to DocPouch directly during the OIDC login: API calls go
 * to DOCPOUCH_URL, the token request goes to the issuer. Both can be on
 * different hosts, so both origins are allowed.
 */
export function docPouchOrigin(): string[] {
  const origins = ['DOCPOUCH_URL', 'DOCPOUCH_OIDC_ISSUER']
    .map((name) => process.env[name])
    .filter((url): url is string => !!url)
    .map((url) => {
      try {
        return new URL(url).origin;
      } catch {
        return '';
      }
    })
    .filter((origin) => origin !== '');
  return [...new Set(origins)];
}

/**
 * Pages that may embed the app in an iframe (e.g. the Toolchain host).
 * Comma separated list in FRAME_ANCESTORS, default: none.
 */
export function frameAncestors(): string[] {
  return (process.env.FRAME_ANCESTORS || '')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}
