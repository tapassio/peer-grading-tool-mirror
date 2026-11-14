import { ExecutionContext, Logger } from '@nestjs/common';

/**
 * Rate limiting can be switched off ONLY for the end-to-end tests
 * (E2E_DISABLE_RATE_LIMIT=true): the tests log in more often than the
 * login limit (5 per minute) allows.
 *
 * Even then, only requests that come directly from this machine are
 * skipped: the socket must be a loopback address AND there must be no
 * X-Forwarded-For header. Requests through a reverse proxy (which adds the
 * header) or from other machines are always limited, so the switch cannot
 * be used to brute-force logins in a real installation.
 */
export function isRateLimitDisabled(): boolean {
  return process.env.E2E_DISABLE_RATE_LIMIT === 'true';
}

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export function isDirectLocalRequest(req: {
  socket?: { remoteAddress?: string };
  headers?: Record<string, unknown>;
}): boolean {
  const address = req.socket?.remoteAddress ?? '';
  return LOOPBACK.has(address) && !req.headers?.['x-forwarded-for'];
}

export function skipRateLimit(context: ExecutionContext): boolean {
  if (!isRateLimitDisabled()) return false;
  return isDirectLocalRequest(context.switchToHttp().getRequest());
}

export function warnIfRateLimitDisabled(): void {
  if (isRateLimitDisabled()) {
    new Logger('Security').warn(
      'E2E_DISABLE_RATE_LIMIT=true: no rate limit for direct requests from ' +
        'localhost. Only for end-to-end tests, never in a real installation.',
    );
  }
}
