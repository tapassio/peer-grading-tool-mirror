import { TokenService } from './token.service';

describe('TokenService (access token only in memory)', () => {
  afterEach(() => localStorage.clear());

  it('never writes tokens to localStorage', () => {
    const service = new TokenService();
    service.setAccessToken('secret');
    expect(service.getToken()).toBe('secret');
    expect(service.hasToken()).toBe(true);
    expect(JSON.stringify({ ...localStorage })).not.toContain('secret');
  });

  it('removes tokens stored by older versions', () => {
    localStorage.setItem('accessToken', 'old-a');
    localStorage.setItem('refreshToken', 'old-r');
    new TokenService();
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('signOut forgets the token', () => {
    const service = new TokenService();
    service.setAccessToken('secret');
    service.signOut();
    expect(service.hasToken()).toBe(false);
    expect(service.getToken()).toBeNull();
  });
});
