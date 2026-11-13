#!/usr/bin/env node
/**
 * setup-local.mjs — Provisions a local DocPouch instance for the Peer Grading
 * Tool (PGT).
 *
 * Idempotent: safe to run repeatedly. Existing structures, documents and test
 * users are reused.
 *
 * It creates / ensures:
 *   1. the document structure "Peer Grading Result" (type 100 / subType 0)
 *   2. the Tool Details Document (TDD, type 0 / subType 0) with the
 *      `peerGradingResult` assignment pointing at the structure
 *   3. optional test users (pgt-admin, pgt-member) for the role-mapping cases
 *   4. the OIDC client for the PGT frontend (dynamic registration, PKCE)
 *
 * Usage:
 *   docker compose -f docpouch-dev/docker-compose.yml up -d
 *   node docpouch-dev/setup-local.mjs
 *
 * Configuration is read from the environment and from `.env` files in the
 * repository root and in `docpouch-dev/` (see docpouch-dev/.env.example).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');

/** Minimal .env parser (KEY=VALUE, ignores comments and blank lines). */
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (process.env[key] !== undefined) continue;
    let value = raw.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(join(repoRoot, '.env'));
loadEnvFile(join(here, '.env'));

const BASE = (process.env.DP_BASE || 'http://localhost:3033').replace(/\/+$/, '');
const USER = process.env.DP_USER || 'admin';
const PASS = process.env.DP_PASSWORD || '';
const REGISTRATION_TOKEN = process.env.DP_OIDC_REGISTRATION_TOKEN || '';
const PGT_PUBLIC_URL = (process.env.PGT_PUBLIC_URL || 'http://localhost:4200').replace(/\/+$/, '');
// Languages the frontend is built for. Each is served under its own base href
// (`<PGT_PUBLIC_URL>/de/`, `/en/`), so every variant needs its own OIDC
// redirect and post-logout URI.
const PGT_LOCALES = (process.env.PGT_LOCALES || 'de,en')
  .split(',')
  .map((locale) => locale.trim())
  .filter(Boolean);
const CREATE_TEST_USERS = (process.env.DP_CREATE_TEST_USERS || 'true') !== 'false';
const ADMIN_EMAIL = process.env.DP_ADMIN_EMAIL || 'admin@example.com';

const STRUCTURE_NAME = 'Peer Grading Result';
const STRUCTURE_TYPE = 100;
const STRUCTURE_SUBTYPE = 0;
const TOOL_NAME = 'Peer Grading';
const TEST_USERS = [
  { name: 'pgt-admin', email: 'pgt-admin@example.com', isAdmin: false, role: 'admin' },
  { name: 'pgt-member', email: 'pgt-member@example.com', isAdmin: false, role: 'member' },
];
const TEST_USER_PASSWORD = 'peer-grading-test';

const PACE_MS = 1500;
let lastRequest = 0;

async function api(method, path, { payload, token, retries = 4 } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  for (let attempt = 0; attempt < retries; attempt++) {
    const wait = PACE_MS - (Date.now() - lastRequest);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequest = Date.now();

    let response;
    try {
      response = await fetch(BASE + path, {
        method,
        headers,
        body: payload !== undefined ? JSON.stringify(payload) : undefined,
      });
    } catch (error) {
      console.error(`  network error (${error.message}) — retrying`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('retry-after') || 10);
      await new Promise((resolve) => setTimeout(resolve, (retryAfter + 1) * 1000));
      continue;
    }

    const text = await response.text();
    if (!response.ok) {
      console.error(`  HTTP ${response.status} on ${method} ${path}: ${text.slice(0, 300)}`);
      return null;
    }
    return text ? JSON.parse(text) : null;
  }
  return null;
}

async function login() {
  const result = await api('POST', '/users/login', {
    payload: { name: USER, password: PASS },
  });
  if (!result?.token) {
    console.error('Login failed. Check DP_USER / DP_PASSWORD (see docpouch-dev/.env.example).');
    process.exit(1);
  }
  return result;
}

/**
 * The published DocPouch image creates the initial super-admin without an
 * e-mail address, but the PGT token exchange requires one. Set a placeholder
 * address so the local admin can sign in to the PGT.
 */
async function ensureAdminEmail(session) {
  const me = await api('GET', '/users/whoami', { token: session.token });
  if (me?.email) {
    console.log(`admin email: ${me.email}`);
    return;
  }
  const updated = await api('PATCH', `/users/update/${session._id}`, {
    payload: { email: ADMIN_EMAIL },
    token: session.token,
  });
  if (updated) {
    console.log(`admin email set: ${ADMIN_EMAIL}`);
  } else {
    console.error('failed to set the admin e-mail address');
  }
}

async function ensureStructure(token) {
  const list = await api('GET', '/structures/list', { token });
  const structures = Array.isArray(list) ? list : list?.structures || list?.data || [];
  const existing = structures.find((entry) => entry.name === STRUCTURE_NAME);
  if (existing) {
    console.log(`structure exists: ${STRUCTURE_NAME} (${existing._id})`);
    return existing._id;
  }

  const definition = JSON.parse(
    readFileSync(join(here, 'structure-peer-grading-result.json'), 'utf8')
  );
  const created = await api('POST', '/structures/create', { payload: definition, token });
  if (!created?._id) {
    console.error('structure creation failed');
    process.exit(1);
  }
  console.log(`structure created: ${STRUCTURE_NAME} (${created._id})`);
  return created._id;
}

async function ensureTdd(token, structureId) {
  const result = await api('POST', '/docs/fetch/', {
    payload: { type: 0, subType: 0 },
    token,
  });
  const docs = Array.isArray(result) ? result : result?.docs || [];
  const existing = docs.find((doc) => doc.content?.name === TOOL_NAME);
  if (existing) {
    console.log(`TDD exists: ${TOOL_NAME} (${existing._id})`);
    return;
  }

  const tdd = JSON.parse(readFileSync(join(here, 'tdd-peer-grading.json'), 'utf8'));
  tdd.content.url = `${PGT_PUBLIC_URL}/`;
  tdd.content.assignments.peerGradingResult.structureId = structureId;
  tdd.content.outgoingDataStructureIDs = [structureId];

  const created = await api('POST', '/docs/create', { payload: tdd, token });
  if (created?._id) {
    console.log(`TDD created: ${TOOL_NAME} (${created._id})`);
  } else {
    console.error('TDD creation failed');
  }
}

async function ensureTestUsers(token) {
  if (!CREATE_TEST_USERS) return;
  const list = await api('GET', '/users/list', { token });
  const users = Array.isArray(list) ? list : list?.users || list?.data || [];
  const byEmail = new Set(users.map((user) => user.email));

  for (const testUser of TEST_USERS) {
    if (byEmail.has(testUser.email)) {
      console.log(`user exists: ${testUser.name} (${testUser.email})`);
      continue;
    }
    const created = await api('POST', '/users/create', {
      payload: {
        ...testUser,
        password: TEST_USER_PASSWORD,
        department: 'PGT',
        group: 'PGT',
      },
      token,
    });
    if (created) {
      console.log(`user created: ${testUser.name} (${testUser.email}, role=${testUser.role})`);
    } else {
      console.error(`user creation failed: ${testUser.name}`);
    }
  }
}

async function ensureOidcClient() {
  const clientFile = join(here, '.oidc-client.json');
  if (existsSync(clientFile)) {
    const cached = JSON.parse(readFileSync(clientFile, 'utf8'));
    console.log(`OIDC client already registered (client_id=${cached.client_id})`);
    return cached;
  }
  if (!REGISTRATION_TOKEN) {
    console.log('skipping OIDC client registration (DP_OIDC_REGISTRATION_TOKEN not set)');
    return null;
  }

  const payload = {
    client_name: 'Peer Grading Tool',
    redirect_uris: PGT_LOCALES.map(
      (locale) => `${PGT_PUBLIC_URL}/${locale}/auth/callback`,
    ),
    post_logout_redirect_uris: PGT_LOCALES.map(
      (locale) => `${PGT_PUBLIC_URL}/${locale}/`,
    ),
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    application_type: 'web',
    scope: 'openid profile email offline_access',
  };

  const registered = await api('POST', '/oidc/reg', {
    payload,
    token: REGISTRATION_TOKEN,
  });
  if (!registered?.client_id) {
    console.error('OIDC client registration failed');
    return null;
  }

  writeFileSync(clientFile, JSON.stringify(registered, null, 2));
  console.log(`OIDC client registered: client_id=${registered.client_id}`);
  return registered;
}

/**
 * Adds the freshly registered (or cached) client id to DocPouch's
 * OIDC_AUTO_CONSENT_CLIENTS environment variable via docker-compose.yml and
 * restarts the container, so subsequent logins skip the consent prompt.
 * Idempotent: a no-op when the value already matches.
 */
async function ensureAutoConsent(client) {
  if (!client?.client_id) return;
  const composeFile = join(here, 'docker-compose.yml');
  const desired = `      - OIDC_AUTO_CONSENT_CLIENTS=${client.client_id}`;
  const current = readFileSync(composeFile, 'utf8');
  const re = /^[ \t]*-[ \t]*OIDC_AUTO_CONSENT_CLIENTS=.*$/m;
  const next = re.test(current)
    ? current.replace(re, desired)
    : current.replace(/^([ \t]*-[ \t]*OIDC_ISSUER=.*)$/m, `$1\n${desired}`);

  if (next === current) {
    console.log(`OIDC_AUTO_CONSENT_CLIENTS already enabled for ${client.client_id}`);
    return;
  }

  writeFileSync(composeFile, next);
  console.log('docker-compose.yml: OIDC_AUTO_CONSENT_CLIENTS updated, restarting DocPouch');
  execSync(`docker compose -f "${composeFile}" up -d`, { stdio: 'inherit' });
  // Give DocPouch a moment to come back up before any further requests.
  await new Promise((r) => setTimeout(r, 6000));
}

async function main() {
  console.log(`DocPouch: ${BASE}`);
  const session = await login();
  const token = session.token;
  console.log(`logged in as ${USER}`);

  await ensureAdminEmail(session);

  const structureId = await ensureStructure(token);
  await ensureTdd(token, structureId);
  await ensureTestUsers(token);
  const client = await ensureOidcClient();
  await ensureAutoConsent(client);

  console.log('\nDone.');
  if (client?.client_id) {
    console.log(`Set DOCPOUCH_CLIENT_ID=${client.client_id} in backend/.env`);
  }
  console.log(`PGT frontend: ${PGT_PUBLIC_URL}/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
