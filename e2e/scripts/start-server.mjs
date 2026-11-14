// Started by Playwright (webServer in playwright.config.ts):
// 1. fresh SQLite database from backend/prisma/migrations (no Prisma engine
//    download needed), 2. test data, 3. the built backend in production mode,
//    serving the built frontend.
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const backend = join(root, 'backend');
const require = createRequire(join(backend, 'package.json'));

for (const [path, hint] of [
  [join(backend, 'dist/main.js'), 'cd backend && npx prisma generate && npm run build'],
  [join(root, 'frontend/dist/de/index.html'), 'cd frontend && npx ng build'],
]) {
  if (!existsSync(path)) {
    console.error(`missing ${path}\nbuild it first: ${hint}`);
    process.exit(1);
  }
}

// 1. database
const dataDir = join(root, 'e2e/.data');
const dbFile = join(dataDir, 'e2e.db');
rmSync(dataDir, { recursive: true, force: true });
mkdirSync(dataDir, { recursive: true });
const Database = require('better-sqlite3');
const db = new Database(dbFile);
const migrations = join(backend, 'prisma/migrations');
for (const name of readdirSync(migrations).sort()) {
  const sql = join(migrations, name, 'migration.sql');
  if (existsSync(sql)) db.exec(readFileSync(sql, 'utf8'));
}
db.close();

const env = {
  ...process.env,
  DATABASE_URL: `file:${dbFile}`,
  PRODUCTION: 'true',
  AUTH_MODE: 'local',
  APP_BASE_PATH: '/tc/PeerGrading',
  PORT: process.env.E2E_PORT || '3999',
  JWT_SECRET: randomBytes(48).toString('base64url'),
  JWT_REFRESH_SECRET: randomBytes(48).toString('base64url'),
  JWT_REGISTRATION_SECRET: randomBytes(48).toString('base64url'),
  // mails cannot be sent in tests (no real key); the app logs the error
  SENDGRID_API_KEY: 'SG.e2e',
  // the tests log in more often than the login limit allows; only direct
  // requests from localhost are skipped (see backend security/rate-limit.ts)
  E2E_DISABLE_RATE_LIMIT: 'true',
};

// 2. test data
execFileSync(process.execPath, [join(here, 'seed.cjs')], { env, stdio: 'inherit' });

// 3. the backend serves <backend>/../frontend in production mode
const frontendLink = join(root, 'backend/frontend');
if (!existsSync(frontendLink)) symlinkSync(join(root, 'frontend/dist'), frontendLink, 'dir');

const server = spawn(process.execPath, [join(backend, 'dist/main.js')], {
  cwd: backend,
  env,
  stdio: 'inherit',
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.kill(signal));
}
server.on('exit', (code) => process.exit(code ?? 0));
