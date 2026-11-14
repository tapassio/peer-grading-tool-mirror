import { isAbsolute, resolve } from 'path';

/**
 * SQLite file of the PGT, from DATABASE_URL (e.g. `file:./dev.db` or
 * `file:/dev.db`).
 *
 * Prisma 4 resolved a relative path against the `prisma/` folder. The
 * driver adapter of Prisma 7 would resolve it against the current folder,
 * so existing installations would suddenly use a new, empty database. To
 * keep the old location, relative paths are resolved against
 * `<current folder>/prisma` here (Prisma CLI and app use the same rule).
 */
export function databaseUrl(value = process.env.DATABASE_URL): string {
  const raw = (value || 'file:./dev.db').trim();
  const path = raw.replace(/^file:/, '');
  if (path === ':memory:' || isAbsolute(path)) {
    return `file:${path}`;
  }
  return `file:${resolve(process.cwd(), 'prisma', path)}`;
}
