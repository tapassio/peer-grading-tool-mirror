function normalizeBasePath(value?: string): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === '/') return '';
  return '/' + trimmed.replace(/^\/+|\/+$/g, '');
}

export default () => ({
  production: process.env.PRODUCTION === 'true',
  /**
   * Optional sub-path the app is deployed under, e.g. `/tc/PeerGrading`.
   * Empty string means the app is served from the root.
   */
  basePath: normalizeBasePath(process.env.APP_BASE_PATH),
  /**
   * Comma separated list of origins allowed to call the API. When empty,
   * CORS stays open (development default).
   */
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0),
});
