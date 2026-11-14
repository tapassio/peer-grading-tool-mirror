import { defineConfig } from 'prisma/config';
import { databaseUrl } from './src/database-url';

// Prisma 7 CLI configuration (migrate, generate, seed). The database URL is
// no longer in schema.prisma.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: databaseUrl(),
    // only for `prisma migrate diff --from-migrations` (CI check)
    ...(process.env.SHADOW_DATABASE_URL
      ? { shadowDatabaseUrl: databaseUrl(process.env.SHADOW_DATABASE_URL) }
      : {}),
  },
});
