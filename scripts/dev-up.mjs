#!/usr/bin/env node
/**
 * scripts/dev-up.mjs
 * ━━━━━━━━━━━━━━━━━━
 * Boots the local Peer Grading Tool stack on one machine:
 *
 *   • DocPouch (docker compose)
 *   • DocPouch provisioning (idempotent: structure, TDD, test users, OIDC client,
 *     auto-consent)
 *   • PGT backend (Node, dist or freshly built)
 *   • PGT frontend (Angular dev server, locale-aware)
 *
 * State lives in scripts/.pids and scripts/logs so:
 *   node scripts/dev-up.mjs          # start everything
 *   node scripts/dev-up.mjs --stop   # stop pgt backend + frontend (docpouch runs)
 *   node scripts/dev-up.mjs --status # report ports + pids
 *
 * Environment overrides (CLI flags override .env):
 *   --locale          de|en           default de
 *   --backend-port    <port>          default 3001
 *   --frontend-port   <port>          default 4200
 *   --docpouch-port   <port>          default 3033
 *   --skip-build                      do not rebuild the backend
 *   --no-frontend                     only start the backend
 *   --stop                            stop prior runs (from scripts/.pids)
 *   --status                          print status and exit
 *   --wait                            foreground process: tail the logs
 *   -h | --help                       show this
 */

import {
  spawn,
  spawnSync,
} from 'node:child_process';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  statSync,
  appendFileSync,
  openSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConnection } from 'node:net';
import process from 'node:process';

/** Resolve the repo root from this script's location (scripts/dev-up.mjs). */
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');

const logDir = join(here, 'logs');
const pidDir = join(here, '.pids');
const pidFile = (name) => join(pidDir, `${name}.pid`);
const docpouchClientFile = join(repoRoot, 'docpouch-dev', '.oidc-client.json');

const C = process.stdout.isTTY
  ? {
      reset: '\x1b[0m',
      dim: '\x1b[2m',
      bold: '\x1b[1m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      cyan: '\x1b[36m',
    }
  : Object.fromEntries(
      ['reset','dim','bold','red','green','yellow','cyan'].map((k) => [k, '']),
    );
const isWindows = process.platform === 'win32';

/* ─── tiny .env loader ─────────────────────────────────────────────────── */

function loadEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || m[1].startsWith('#')) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

function readEnv() {
  return {
    ...loadEnv(join(repoRoot, '.env')),
    ...loadEnv(join(repoRoot, 'docpouch-dev', '.env')),
  };
}

/* ─── tiny CLI parser ──────────────────────────────────────────────────── */

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') {
      printHelp();
      process.exit(0);
    }
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}

function printHelp() {
  process.stdout.write(
    [
      'Usage: node scripts/dev-up.mjs [options]',
      '',
      'Options:',
      '  --locale <de|en>      Frontend locale (default: de).',
      '  --backend-port <port> Backend listen port (default: 3001).',
      '  --frontend-port <port> Frontend listen port (default: 4200).',
      '  --docpouch-port <port> DocPouch exposed port (default: 3033).',
      '  --skip-build          Do not rebuild the backend dist/.',
      '  --no-frontend         Start only the backend.',
      '  --stop                Stop prior PGT backend + frontend.',
      '  --status              Print status and exit.',
      '  --wait | --logs       Foreground process: tail backend + frontend logs.',
      '  -h | --help           Show this message.',
      '',
    ].join('\n'),
  );
}

/* ─── pretty printing ──────────────────────────────────────────────────── */

const banner = (m) => process.stdout.write(`\n${C.cyan}━━ ${m} ━━${C.reset}\n`);
const ok = (m) => process.stdout.write(`${C.green}✔${C.reset} ${m}\n`);
const warn = (m) => process.stdout.write(`${C.yellow}⚠${C.reset}  ${m}\n`);
const err = (m) => process.stdout.write(`${C.red}✖${C.reset} ${m}\n`);
const ts = () => new Date().toISOString().split('T')[1].replace('Z', '');

/* ─── low-level helpers ────────────────────────────────────────────────── */

async function waitForPort(port, label, { timeoutMs = 90_000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const sock = createConnection({ host: '127.0.0.1', port }, () => {
        sock.destroy();
        resolve(true);
      });
      sock.on('error', () => resolve(false));
      sock.setTimeout(1000, () => {
        sock.destroy();
        resolve(false);
      });
    });
    if (ok) return true;
    process.stdout.write(`  ${C.dim}${ts()} waiting for ${label} on :${port}…${C.reset}\r`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

const writePid = (name, pid) => {
  if (!existsSync(pidDir)) mkdirSync(pidDir, { recursive: true });
  writeFileSync(pidFile(name), String(pid));
};
const readPid = (name) => {
  const f = pidFile(name);
  return existsSync(f) ? Number(readFileSync(f, 'utf8').trim()) : null;
};
const clearPid = (name) => {
  const f = pidFile(name);
  if (existsSync(f)) writeFileSync(f, '');
};
const procAlive = (pid) => {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

// Single-shot TCP probe (no retry loop) used by --status.
const probePort = (port) =>
  new Promise((resolve) => {
    const sock = createConnection({ host: '127.0.0.1', port }, () => {
      sock.destroy();
      resolve(true);
    });
    sock.on('error', () => resolve(false));
    sock.setTimeout(1500, () => {
      sock.destroy();
      resolve(false);
    });
  });
// `taskkill` must be resolved by absolute path: under Git Bash the inherited
// PATH is unix-style (with literal %NVM_HOME%/%NVM_SYMLINK% entries), so
// spawnSync('taskkill', …) fails with ENOENT and --stop silently leaves the
// processes alive.
const taskkillPath = isWindows
  ? join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe')
  : null;

function killTree(pid) {
  if (!pid) return true;
  if (!procAlive(pid)) return true; // already gone
  if (isWindows) {
    const res = spawnSync(taskkillPath, ['/pid', String(pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    if (!res.error && res.status === 0) return true;
    const reason = res.error ? res.error.code : `exit ${res.status}`;
    warn(`taskkill failed for pid ${pid} (${reason}), falling back to process.kill`);
    try {
      process.kill(pid, 'SIGKILL');
      return true;
    } catch (e) {
      warn(`could not kill pid ${pid}: ${e.message}`);
      return false;
    }
  }
  try {
    process.kill(-pid, 'SIGTERM');
    return true;
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
      return true;
    } catch (e) {
      warn(`could not kill pid ${pid}: ${e.message}`);
      return false;
    }
  }
}

const compose = (...args) =>
  spawnSync(
    'docker',
    ['compose', '-f', join(repoRoot, 'docpouch-dev', 'docker-compose.yml'), ...args],
    { stdio: ['ignore', 'pipe', 'pipe'], shell: false },
  );

/* ─── steps ────────────────────────────────────────────────────────────── */

async function ensureDocPouch(port) {
  banner('DocPouch');
  const ps = compose('ps', '--format', '{{.Names}} {{.State}}');
  const running =
    ps.status === 0 &&
    (ps.stdout?.toString() || '').includes('docpouch-dev-docpouch-1 running');
  if (running) {
    ok(`DocPouch already running on :${port}`);
  } else {
    warn('DocPouch not running — starting via docker compose…');
    const up = compose('up', '-d');
    if (up.status !== 0) {
      err('docker compose up failed:');
      process.stdout.write((up.stderr || up.stdout || '').toString());
      throw new Error('docker compose up');
    }
  }
  const ready = await waitForPort(port, 'DocPouch', { timeoutMs: 60_000 });
  if (!ready) {
    err(`DocPouch did not start listening on :${port} in time`);
    err('Try: docker compose -f docpouch-dev/docker-compose.yml logs');
    throw new Error('DocPouch not ready');
  }
  ok(`DocPouch is up on http://localhost:${port}`);
}

function readClientId() {
  if (!existsSync(docpouchClientFile)) return null;
  try {
    return JSON.parse(readFileSync(docpouchClientFile, 'utf8')).client_id ?? null;
  } catch {
    return null;
  }
}

function readBackendDotenvClientId() {
  const p = join(repoRoot, 'backend', '.env');
  if (!existsSync(p)) return null;
  const m = readFileSync(p, 'utf8').match(/^\s*DOCPOUCH_CLIENT_ID\s*=\s*"?([^"\s]+)"?/m);
  return m ? m[1] : null;
}

async function ensureProvisioned({ docpouchPort }) {
  banner('DocPouch provisioning');
  if (existsSync(docpouchClientFile) && readBackendDotenvClientId()) {
    ok(`OIDC client already registered (${readBackendDotenvClientId()})`);
    return readBackendDotenvClientId();
  }

  warn('Running setup-local.mjs…');
  const result = spawnSync(
    process.execPath,
    [join(repoRoot, 'docpouch-dev', 'setup-local.mjs')],
    {
      cwd: repoRoot,
      stdio: 'inherit',
      env: { ...process.env, DP_BASE: `http://localhost:${docpouchPort}` },
    },
  );
  if (result.status !== 0) throw new Error('setup-local.mjs failed');
  return readClientId();
}

function touchBackendEnvClient(clientId) {
  const p = join(repoRoot, 'backend', '.env');
  let text = existsSync(p) ? readFileSync(p, 'utf8') : '';
  if (/^\s*DOCPOUCH_CLIENT_ID\s*=/m.test(text)) {
    text = text.replace(/^\s*DOCPOUCH_CLIENT_ID\s*=.*$/m, `DOCPOUCH_CLIENT_ID=${clientId}`);
  } else {
    text += `\nDOCPOUCH_CLIENT_ID=${clientId}\n`;
  }
  writeFileSync(p, text);
}

/* ─── backend build / spawn ────────────────────────────────────────────── */

function needsBackendRebuild() {
  const dist = join(repoRoot, 'backend', 'dist', 'main.js');
  if (!existsSync(dist)) return true;
  const distMtime = statSync(dist).mtimeMs;
  const candidates = [
    'backend/src/main.ts',
    'backend/src/app.module.ts',
    'backend/src/auth/oidc.config.ts',
    'backend/src/auth/oidc.service.ts',
    'backend/src/auth/auth.controller.ts',
    'backend/src/auth/auth.service.ts',
    'backend/src/user/user.service.ts',
    'backend/src/toolchain/manifest.ts',
  ];
  for (const rel of candidates) {
    const p = join(repoRoot, rel);
    if (existsSync(p) && statSync(p).mtimeMs > distMtime) return true;
  }
  return false;
}

async function buildBackend() {
  banner('Building backend');
  if (!needsBackendRebuild()) {
    ok('backend dist up-to-date');
    return;
  }
  // Replicate `npm run build` (prebuild: rimraf dist + build: nest build)
  // without going through the npm wrapper, which cannot be spawned directly
  // as a .cmd shim on Windows under Node 20+.
  const backendDir = join(repoRoot, 'backend');
  rmSync(join(backendDir, 'dist'), { recursive: true, force: true });
  const nestJs = join(backendDir, 'node_modules', '@nestjs', 'cli', 'bin', 'nest.js');
  if (!existsSync(nestJs)) {
    throw new Error('nest CLI missing — run `npm install` in backend/ first');
  }
  const result = spawnSync(process.execPath, [nestJs, 'build'], {
    cwd: backendDir,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`backend build failed (exit ${result.status})`);
  ok('backend built');
}

async function pickBackendPort(preferred) {
  for (let p = preferred; p < preferred + 20; p++) {
    const ok = await new Promise((resolve) => {
      const sock = createConnection({ host: '127.0.0.1', port: p }, () => {
        sock.destroy();
        resolve(true);
      });
      sock.on('error', () => resolve(false));
      sock.setTimeout(150, () => {
        sock.destroy();
        resolve(false);
      });
    });
    if (!ok) return p;
  }
  return preferred;
}

function patchFrontendApiBase(port) {
  const path = join(repoRoot, 'frontend', 'src', 'environments', 'environment.ts');
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  const next = text.replace(
    /api:\s*['"][^'"]*['"]/,
    `api: 'http://localhost:${port}/api'`,
  );
  if (next === text) return;
  writeFileSync(path, next);
  ok(`set environment.ts api base to http://localhost:${port}/api`);
}

function spawnBackend({ backendPort, docpouchPort, frontendPort, clientId }) {
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
  const out = openSync(join(logDir, 'backend.log'), 'a');
  const envOut = {
    ...process.env,
    AUTH_MODE: 'oidc',
    DOCPOUCH_URL: `http://localhost:${docpouchPort}`,
    DOCPOUCH_CLIENT_ID: clientId,
    PGT_PUBLIC_URL: `http://localhost:${frontendPort}`,
    PORT: String(backendPort),
  };
  const proc = spawn(
    process.execPath,
    [join(repoRoot, 'backend', 'dist', 'main.js')],
    {
      // Prisma 7 resolves a relative DATABASE_URL (file:./dev.db) against
      // <cwd>/prisma and @nestjs/config loads .env from cwd, so the backend
      // has to run from backend/ (not the repo root).
      cwd: join(repoRoot, 'backend'),
      env: envOut,
      stdio: ['ignore', out, out],
      detached: true,
      windowsHide: true,
    },
  );
  proc.unref?.();
  appendFileSync(
    join(logDir, 'backend.log'),
    `\n--- dev-up @ ${ts()} pid=${proc.pid} backendPort=${backendPort} ---\n`,
  );
  return proc;
}

function spawnFrontend({ frontendPort, locale }) {
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
  const out = openSync(join(logDir, 'frontend.log'), 'a');
  const ngJs = join(repoRoot, 'frontend', 'node_modules', '@angular', 'cli', 'bin', 'ng.js');
  const proc = spawn(
    process.execPath,
    [
      ngJs,
      'serve',
      `--configuration=${locale}`,
      `--port=${frontendPort}`,
      '--host=127.0.0.1',
    ],
    {
      cwd: join(repoRoot, 'frontend'),
      env: process.env,
      stdio: ['ignore', out, out],
      detached: true,
      windowsHide: true,
    },
  );
  proc.unref?.();
  appendFileSync(
    join(logDir, 'frontend.log'),
    `\n--- dev-up @ ${ts()} pid=${proc.pid} frontendPort=${frontendPort} locale=${locale} ---\n`,
  );
  return proc;
}

/* ─── status / stop ────────────────────────────────────────────────────── */

async function status() {
  banner('Status');
  const backendPid = readPid('backend');
  const frontendPid = readPid('frontend');
  const docpouchOut =
    compose('ps', '--format', '{{.Names}} {{.State}}').stdout?.toString().trim() || '';
  const backendPort = Number(readFileIfExists(pidFile('backend.port')) || 3000);
  const frontendPort = Number(readFileIfExists(pidFile('frontend.port')) || 4200);
  // Prefer the port probe as source of truth: detached ng serve re-execs, so
  // the stored PID is not always the one that owns the socket.
  const backendUp = await probePort(backendPort);
  const frontendUp = await probePort(frontendPort);

  const row = (name, value) =>
    process.stdout.write(`  ${C.bold}${name.padEnd(15)}${C.reset} ${value}\n`);
  row(
    'DocPouch',
    docpouchOut.includes('running')
      ? `${C.green}up${C.reset}`
      : `${C.red}down${C.reset}`,
  );
  row('backend pid', backendPid ?? '—');
  row(
    'backend',
    backendUp
      ? `${C.green}listening :${backendPort}${C.reset}`
      : `${C.red}down${C.reset}`,
  );
  row('frontend pid', frontendPid ?? '—');
  row(
    'frontend',
    frontendUp
      ? `${C.green}listening :${frontendPort}${C.reset}`
      : `${C.red}down${C.reset}`,
  );
  row('OIDC client', readClientId() ?? '—');
}

const readFileIfExists = (p) => (existsSync(p) ? readFileSync(p, 'utf8').trim() : '');

async function stopAll() {
  banner('Stopping');
  for (const name of ['frontend', 'backend']) {
    const pid = readPid(name);
    if (pid) {
      if (killTree(pid)) {
        clearPid(name);
        ok(`stopped ${name} (pid ${pid})`);
      } else {
        warn(`could not stop ${name} (pid ${pid}) — kill it manually`);
      }
    }
  }
}

/* ─── summary ──────────────────────────────────────────────────────────── */

function printSummary({ backendPort, frontendPort, docpouchPort, locale, clientId }) {
  banner('Ready');
  const lines = [
    `${C.bold}DocPouch${C.reset}    http://localhost:${docpouchPort}`,
    `${C.bold}Backend${C.reset}    http://localhost:${backendPort}`,
    frontendPort
      ? `${C.bold}Frontend${C.reset}   http://localhost:${frontendPort}/${locale}/`
      : `${C.bold}Frontend${C.reset}   (skipped — --no-frontend)`,
    `${C.bold}OIDC client${C.reset} ${clientId ?? '—'}`,
    '',
    `${C.dim}Tail logs:${C.reset}`,
    '  node scripts/dev-up.mjs --wait',
    `${C.dim}Stop:${C.reset}`,
    '  node scripts/dev-up.mjs --stop',
    `${C.dim}Status:${C.reset}`,
    '  node scripts/dev-up.mjs --status',
    '',
    `${C.bold}Test users (login with "Mit DocPouch anmelden")${C.reset}`,
    '  pgt-admin  / peer-grading-test    → PGT ADMIN',
    '  pgt-member / peer-grading-test    → PGT 403 PGT_ACCESS_DENIED',
  ];
  process.stdout.write(lines.join('\n') + '\n');
}

/* ─── main ─────────────────────────────────────────────────────────────── */

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });

  if (args.stop) {
    await stopAll();
    if (!args.wait && !args.logs) process.exit(0);
  }

  if (args.status) {
    await status();
    process.exit(0);
  }

  const locale = String(args.locale || 'de');
  if (!['de', 'en'].includes(locale)) {
    err(`--locale must be de or en (got ${locale})`);
    process.exit(2);
  }
  const defaultBackendPort = 3000;
  let backendPort = Number(args['backend-port']) || defaultBackendPort;
  if (!args['backend-port']) {
    backendPort = await pickBackendPort(defaultBackendPort);
    if (backendPort !== defaultBackendPort) {
      warn(`port ${defaultBackendPort} is taken, using ${backendPort} instead`);
    }
  }
  const frontendPort = Number(args['frontend-port'] || 4200);
  const docpouchPort = Number(args['docpouch-port'] || 3033);
  const skipBuild = Boolean(args['skip-build']);
  const noFrontend = Boolean(args['no-frontend']);
  const wantTail = Boolean(args.wait || args.logs);

  patchFrontendApiBase(backendPort);

  banner('Peer Grading Tool — local dev stack');
  process.stdout.write(
    [
      `  repo          ${repoRoot}`,
      `  locale        ${locale}`,
      `  backend port  ${backendPort}`,
      `  frontend port ${frontendPort}`,
      `  DocPouch port ${docpouchPort}`,
    ].join('\n') + '\n',
  );

  await ensureDocPouch(docpouchPort);
  const clientId = await ensureProvisioned({ docpouchPort });
  if (!clientId) {
    err('could not determine DocPouch client_id after provisioning');
    process.exit(1);
  }
  touchBackendEnvClient(clientId);

  if (!skipBuild) await buildBackend();

  // Stop any prior runs from this script
  await stopAll();

  const backend = spawnBackend({ backendPort, docpouchPort, frontendPort, clientId });
  writePid('backend', backend.pid);
  writeFileSync(pidFile('backend.port'), String(backendPort));
  const backendReady = await waitForPort(backendPort, 'backend', { timeoutMs: 60_000 });
  if (!backendReady) {
    err(`backend did not start on :${backendPort} in time`);
    err(`Inspect ${C.cyan}scripts/logs/backend.log${C.reset}`);
    process.exit(1);
  }
  ok(`backend listening on http://localhost:${backendPort}`);

  let frontendReady = true;
  if (!noFrontend) {
    const frontend = spawnFrontend({ frontendPort, locale });
    writePid('frontend', frontend.pid);
    writeFileSync(pidFile('frontend.port'), String(frontendPort));
    frontendReady = await waitForPort(frontendPort, 'frontend', { timeoutMs: 120_000 });
    if (!frontendReady) {
      err(`frontend did not start on :${frontendPort} in time`);
      err(`Inspect ${C.cyan}scripts/logs/frontend.log${C.reset}`);
      process.exit(1);
    }
    ok(`frontend listening on http://localhost:${frontendPort} (locale ${locale})`);
  }

  printSummary({
    backendPort,
    frontendPort: noFrontend ? null : frontendPort,
    docpouchPort,
    locale,
    clientId,
  });

  if (wantTail) {
    process.stdout.write(`\n${C.dim}Tailing logs (Ctrl+C to stop)…${C.reset}\n`);
    process.on('SIGINT', () => process.exit(0));
    let offset = { backend: 0, frontend: 0 };
    const seek = (path, key) => {
      const buf = existsSync(path) ? readFileSync(path) : Buffer.alloc(0);
      const slice = buf.slice(offset[key]);
      offset[key] = buf.length;
      return slice.toString();
    };
    const loop = setInterval(() => {
      for (const [label, key, path] of [
        ['be', 'backend', join(logDir, 'backend.log')],
        ['fe', 'frontend', join(logDir, 'frontend.log')],
      ]) {
        const chunk = seek(path, key);
        if (!chunk) continue;
        process.stdout.write(
          chunk
            .split(/\r?\n/)
            .filter(Boolean)
            .map((l) => `[${C.dim}${label}${C.reset}] ${l}`)
            .join('\n') + '\n',
        );
      }
    }, 500);
    // lint appeasement: keep loop reachable
    void loop;
    // tail forever
    await new Promise(() => {});
  }
}

main().catch((e) => {
  err(`fatal: ${e.message}`);
  if (e?.stack) warn(e.stack);
  process.exit(1);
});
