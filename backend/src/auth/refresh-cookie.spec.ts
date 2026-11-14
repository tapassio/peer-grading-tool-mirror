import {
  clearRefreshCookie,
  readRefreshCookie,
  refreshCookiePath,
  sendTokens,
} from './refresh-cookie';

describe('refresh cookie', () => {
  const backup = { ...process.env };
  afterEach(() => (process.env = { ...backup }));

  // JWT with exp = 2000000000 (only the payload matters here)
  const payload = Buffer.from(JSON.stringify({ exp: 2000000000 })).toString(
    'base64url',
  );
  const refreshToken = `x.${payload}.y`;

  it('puts the refresh token into an HttpOnly cookie, not into the JSON', () => {
    process.env.PRODUCTION = 'true';
    process.env.APP_BASE_PATH = '/tc/PeerGrading/';
    const res = { cookie: jest.fn() };
    const body = sendTokens(res, { accessToken: 'a', refreshToken });
    expect(body).toEqual({ accessToken: 'a' });
    expect(res.cookie).toHaveBeenCalledWith('pgt_refresh', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/tc/PeerGrading/api/auth',
      expires: new Date(2000000000 * 1000),
    });
  });

  it('path without base path', () => {
    delete process.env.APP_BASE_PATH;
    expect(refreshCookiePath()).toBe('/api/auth');
  });

  it('not Secure outside production (http://localhost)', () => {
    process.env.PRODUCTION = 'false';
    const res = { cookie: jest.fn() };
    sendTokens(res, { accessToken: 'a', refreshToken });
    expect(res.cookie.mock.calls[0][2].secure).toBe(false);
  });

  it('logout clears the cookie with the same path', () => {
    delete process.env.APP_BASE_PATH;
    const res = { clearCookie: jest.fn() };
    clearRefreshCookie(res);
    expect(res.clearCookie).toHaveBeenCalledWith(
      'pgt_refresh',
      expect.objectContaining({ path: '/api/auth', httpOnly: true }),
    );
  });

  it.each([
    ['pgt_refresh=abc', 'abc'],
    ['a=1; pgt_refresh=abc; b=2', 'abc'],
    ['other_pgt_refresh=evil; pgt_refresh=abc', 'abc'],
    ['a=1', null],
    ['', null],
    ['pgt_refresh=', null],
  ])('reads %p', (cookie, expected) => {
    expect(readRefreshCookie({ headers: { cookie } })).toBe(expected);
  });

  it('ignores the Authorization header', () => {
    expect(
      readRefreshCookie({ headers: { authorization: 'Bearer abc' } }),
    ).toBeNull();
  });
});
