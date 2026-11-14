import { NotFoundException } from '@nestjs/common';

// no database needed
jest.mock('./auth.service', () => ({ AuthService: class {} }));
jest.mock('../user/user.service', () => ({ UserService: class {} }));

import { AuthController } from './auth.controller';

describe('AuthController in OIDC mode', () => {
  const backup = { ...process.env };
  afterEach(() => (process.env = { ...backup }));

  const fakeRes = () => ({ cookie: jest.fn(), clearCookie: jest.fn() });

  const controller = (authService: any = {}) =>
    new AuthController(authService, {} as any);

  it('GET /auth/refresh is disabled (sessions only via DocPouch exchange)', async () => {
    process.env.AUTH_MODE = 'oidc';
    const refreshTokens = jest.fn();
    await expect(
      controller({ refreshTokens }).refreshTokens(
        { user: { email: 'a@b.ch', refreshToken: 'x' } },
        fakeRes(),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it('GET /auth/refresh still works in local mode (new refresh token as cookie)', async () => {
    process.env.AUTH_MODE = 'local';
    const refreshTokens = jest
      .fn()
      .mockResolvedValue({ accessToken: 'new-a', refreshToken: 'new-r' });
    const res = fakeRes();
    await expect(
      controller({ refreshTokens }).refreshTokens(
        { user: { email: 'a@b.ch', refreshToken: 'x' } },
        res,
      ),
    ).resolves.toEqual({ accessToken: 'new-a' });
    expect(res.cookie).toHaveBeenCalledWith(
      'pgt_refresh',
      'new-r',
      expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
    );
  });

  it('exchange passes the client IP (for blocking repeated invalid tokens)', async () => {
    process.env.AUTH_MODE = 'oidc';
    const exchangeOidcToken = jest
      .fn()
      .mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    const res = fakeRes();
    const result = await controller({ exchangeOidcToken }).exchangeOidcToken(
      { ip: '1.2.3.4' },
      res,
      'Bearer abc',
    );
    expect(exchangeOidcToken).toHaveBeenCalledWith('abc', '1.2.3.4');
    // OIDC: only the access token; no refresh token reaches the browser
    expect(result).toEqual({ accessToken: 'a' });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('config tells the frontend where to publish', () => {
    process.env.AUTH_MODE = 'oidc';
    process.env.PGT_PUBLIC_URL = 'https://host.ch/tc/PeerGrading/';
    process.env.PGT_RESULT_STRUCTURE_ID = 'abc123';
    process.env.PRODUCTION = 'true';
    const cfg: any = controller().getAuthConfig();
    expect(cfg.publicUrl).toBe('https://host.ch/tc/PeerGrading');
    expect(cfg.resultStructureId).toBe('abc123');
    expect(cfg.allowStructureNameFallback).toBe(false);
  });
});
