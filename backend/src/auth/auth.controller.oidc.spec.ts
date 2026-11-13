import { NotFoundException } from '@nestjs/common';

// no database needed
jest.mock('./auth.service', () => ({ AuthService: class {} }));
jest.mock('../user/user.service', () => ({ UserService: class {} }));

import { AuthController } from './auth.controller';

describe('AuthController in OIDC mode', () => {
  const backup = { ...process.env };
  afterEach(() => (process.env = { ...backup }));

  const controller = (authService: any = {}) =>
    new AuthController(authService, {} as any);

  it('GET /auth/refresh is disabled (sessions only via DocPouch exchange)', () => {
    process.env.AUTH_MODE = 'oidc';
    const refreshTokens = jest.fn();
    expect(() =>
      controller({ refreshTokens }).refreshTokens({ user: { email: 'a@b.ch', refreshToken: 'x' } }),
    ).toThrow(NotFoundException);
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it('GET /auth/refresh still works in local mode', () => {
    process.env.AUTH_MODE = 'local';
    const refreshTokens = jest.fn().mockReturnValue('tokens');
    expect(
      controller({ refreshTokens }).refreshTokens({ user: { email: 'a@b.ch', refreshToken: 'x' } }),
    ).toBe('tokens');
  });

  it('exchange passes the client IP (for blocking repeated invalid tokens)', async () => {
    process.env.AUTH_MODE = 'oidc';
    const exchangeOidcToken = jest.fn().mockResolvedValue('tokens');
    await controller({ exchangeOidcToken }).exchangeOidcToken({ ip: '1.2.3.4' }, 'Bearer abc');
    expect(exchangeOidcToken).toHaveBeenCalledWith('abc', '1.2.3.4');
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
