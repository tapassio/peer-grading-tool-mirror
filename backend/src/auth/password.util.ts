import * as bcrypt from 'bcryptjs';
import { createHash, timingSafeEqual } from 'crypto';

/**
 * Central place for hashing passwords and tokens.
 *
 * Passwords: bcrypt (slow, salted). Old accounts still have unsalted MD5
 * hashes; they keep working and are upgraded to bcrypt on the next login
 * (see AuthService.validateUser).
 *
 * Refresh tokens: they are long random JWTs, so a fast SHA-256 is enough.
 */
const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/** true if the stored hash is an old unsalted MD5 hash */
export function isLegacyMd5Hash(hash: string): boolean {
  return /^[0-9a-f]{32}$/i.test(hash);
}

export async function verifyPassword(
  plain: string,
  hash: string | null | undefined,
): Promise<boolean> {
  if (!plain || !hash) return false;

  if (isLegacyMd5Hash(hash)) {
    const md5 = createHash('md5').update(plain).digest('hex');
    return safeEqual(md5, hash.toLowerCase());
  }

  return bcrypt.compare(plain, hash);
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** compares two strings in constant time (protects against timing attacks) */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a ?? '');
  const bufB = Buffer.from(b ?? '');
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
