import { DocPouchRequestGuard } from './oidc.service';

describe('DocPouchRequestGuard (protects the DocPouch rate limit)', () => {
  let time = 0;
  const now = () => time;
  beforeEach(() => (time = 1_000_000));

  it('remembers rejected tokens for 15 minutes', () => {
    const g = new DocPouchRequestGuard(() => 60, now);
    g.rememberInvalid('bad-token');
    expect(g.isKnownInvalid('bad-token')).toBe(true);
    expect(g.isKnownInvalid('other-token')).toBe(false);
    time += 15 * 60 * 1000 + 1;
    expect(g.isKnownInvalid('bad-token')).toBe(false);
  });

  it('blocks an IP after 3 rejected tokens', () => {
    const g = new DocPouchRequestGuard(() => 60, now);
    g.rememberInvalid('a', '1.2.3.4');
    g.rememberInvalid('b', '1.2.3.4');
    expect(g.isBlockedIp('1.2.3.4')).toBe(false);
    g.rememberInvalid('c', '1.2.3.4');
    expect(g.isBlockedIp('1.2.3.4')).toBe(true);
    expect(g.isBlockedIp('5.6.7.8')).toBe(false);
    time += 15 * 60 * 1000 + 1;
    expect(g.isBlockedIp('1.2.3.4')).toBe(false);
  });

  it('limits DocPouch requests per 15 minutes for the whole server', () => {
    const g = new DocPouchRequestGuard(() => 3, now);
    expect([g.tryAcquire(), g.tryAcquire(), g.tryAcquire()]).toEqual([
      true,
      true,
      true,
    ]);
    expect(g.tryAcquire()).toBe(false);
    time += 15 * 60 * 1000 + 1;
    expect(g.tryAcquire()).toBe(true);
  });
});
