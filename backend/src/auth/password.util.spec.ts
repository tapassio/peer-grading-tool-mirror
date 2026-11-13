import { createHash } from 'crypto';
import {
  hashPassword,
  hashToken,
  isLegacyMd5Hash,
  safeEqual,
  verifyPassword,
} from './password.util';

describe('password.util', () => {
  it('hashes with bcrypt and verifies', async () => {
    const hash = await hashPassword('correct horse');
    expect(hash.startsWith('$2')).toBe(true);
    expect(hash).not.toContain('correct horse');
    await expect(verifyPassword('correct horse', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong', hash)).resolves.toBe(false);
  });

  it('uses a salt (same password, different hash)', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a).not.toEqual(b);
  });

  it('still accepts old MD5 hashes', async () => {
    const md5 = createHash('md5').update('old-password').digest('hex');
    expect(isLegacyMd5Hash(md5)).toBe(true);
    await expect(verifyPassword('old-password', md5)).resolves.toBe(true);
    await expect(verifyPassword('wrong', md5)).resolves.toBe(false);
  });

  it('rejects missing password or hash', async () => {
    await expect(verifyPassword('', 'x')).resolves.toBe(false);
    await expect(verifyPassword('x', null)).resolves.toBe(false);
  });

  it('hashToken is stable, safeEqual compares correctly', () => {
    expect(hashToken('abc')).toEqual(hashToken('abc'));
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});
