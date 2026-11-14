import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';
import { databaseUrl } from './database-url';

/**
 * Prisma 7 talks to SQLite through a driver adapter (better-sqlite3); there
 * is no Rust query engine anymore.
 */
export function sqliteAdapter(url = databaseUrl()) {
  return new PrismaBetterSqlite3({ url });
}

/** for scripts (seeds); the app uses PrismaService */
export function createPrismaClient(): PrismaClient {
  return new PrismaClient({ adapter: sqliteAdapter() });
}
