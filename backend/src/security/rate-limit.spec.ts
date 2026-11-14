import { isDirectLocalRequest, skipRateLimit } from './rate-limit';

const context = (req: any) =>
  ({ switchToHttp: () => ({ getRequest: () => req }) }) as any;

describe('rate limit switch for end-to-end tests', () => {
  const backup = { ...process.env };
  afterEach(() => (process.env = { ...backup }));

  const local = { socket: { remoteAddress: '127.0.0.1' }, headers: {} };

  it('is off by default (always limited)', () => {
    delete process.env.E2E_DISABLE_RATE_LIMIT;
    expect(skipRateLimit(context(local))).toBe(false);
  });

  it('skips only direct requests from localhost', () => {
    process.env.E2E_DISABLE_RATE_LIMIT = 'true';
    expect(skipRateLimit(context(local))).toBe(true);
    expect(
      skipRateLimit(context({ socket: { remoteAddress: '::1' }, headers: {} })),
    ).toBe(true);
  });

  it('never skips requests from other machines', () => {
    process.env.E2E_DISABLE_RATE_LIMIT = 'true';
    expect(
      skipRateLimit(
        context({ socket: { remoteAddress: '203.0.113.5' }, headers: {} }),
      ),
    ).toBe(false);
  });

  it('never skips requests through a reverse proxy on the same host', () => {
    process.env.E2E_DISABLE_RATE_LIMIT = 'true';
    expect(
      isDirectLocalRequest({
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'x-forwarded-for': '203.0.113.5' },
      }),
    ).toBe(false);
  });
});
