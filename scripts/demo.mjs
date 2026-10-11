#!/usr/bin/env node
/**
 * `npm run demo`: app sul telefono e pannello nel browser, tutto su questo
 * computer, con i dati demo (persone, viaggi, cinque settimane di metriche).
 *
 * Avvia Postgres (Docker), applica le migrazioni, riscrive i dati demo con le
 * date di oggi, poi il Supabase finto degli e2e, il backend e il pannello. Per
 * ultimo Expo, in primo piano: il QR da inquadrare con Expo Go. Il telefono
 * raggiunge tutto dall'indirizzo del computer nella rete Wi-Fi.
 *
 *   npm run demo             dati demo da capo, con le date di oggi
 *   npm run demo -- --keep   tiene i dati della demo precedente
 *
 * Variabili facoltative: DEMO_HOST (l'indirizzo da dare al telefono, se quello
 * trovato non va), DEMO_DATABASE_URL (un Postgres già pronto, senza Docker;
 * il nome del database deve contenere "demo").
 *
 * Solo per demo su una rete fidata: login e file passano da un Supabase finto
 * con password note. Non è un modo di andare online.
 */
import { spawn, spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import { connect } from 'node:net';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ACCOUNTS } from '../e2e/support/stack.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = {
  backend: join(ROOT, 'apps/backend'),
  admin: join(ROOT, 'apps/admin'),
  mobile: join(ROOT, 'apps/mobile'),
  e2e: join(ROOT, 'e2e'),
};
const LOGS = join(ROOT, '.demo');
const PORTS = { supabase: 54321, api: 4000, panel: 5173, metro: 8081 };
const WINDOWS = process.platform === 'win32';
const KEEP = process.argv.includes('--keep');
const COMPOSE = ['compose', '-f', join(DIRS.backend, 'docker-compose.yml')];
/** La chiave "publishable" del Supabase finto: non controlla niente, serve solo che ci sia. */
const PUBLISHABLE_KEY = 'demo-publishable-key';

const children = [];

function step(message) {
  console.log(`\n▸ ${message}`);
}

function fail(message) {
  console.error(`\n✖ ${message}`);
  stopAll();
  process.exit(1);
}

/** Un comando che deve riuscire, con l'output a schermo. */
function run(command, args, { cwd = ROOT, env = {}, quiet = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: quiet ? 'pipe' : 'inherit',
    shell: WINDOWS,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    if (quiet) process.stderr.write(result.stderr ?? '');
    fail(`${command} ${args.join(' ')} è fallito (uscita ${result.status}).`);
  }
  return result.stdout ?? '';
}

function succeeds(command, args) {
  return spawnSync(command, args, { stdio: 'ignore', shell: WINDOWS }).status === 0;
}

/** L'indirizzo del computer nella rete locale: quello che il telefono può raggiungere. */
function lanAddress() {
  if (process.env.DEMO_HOST) return process.env.DEMO_HOST;
  const virtual = /^(docker|br-|veth|vEthernet|vmnet|vboxnet|utun|tun|tap|lo)/i;
  const candidates = Object.entries(networkInterfaces())
    .filter(([name]) => !virtual.test(name))
    .flatMap(([, addresses]) => addresses ?? [])
    .filter((address) => address.family === 'IPv4' && !address.internal)
    .map((address) => address.address);
  const isPrivate = (ip) => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
  return candidates.find((ip) => ip.startsWith('192.168.')) ?? candidates.find(isPrivate) ?? candidates[0];
}

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

async function waitFor(name, url, logFile, timeoutMs = 180_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      // non ancora in ascolto
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const log = existsSync(logFile) ? readFileSync(logFile, 'utf8').split('\n').slice(-25).join('\n') : '';
  fail(`${name} non risponde su ${url}. Ultime righe di ${logFile}:\n${log}`);
}

/** Un servizio in background, con l'output in .demo/<nome>.log. */
function background(name, command, args, { cwd, env }) {
  const logFile = join(LOGS, `${name}.log`);
  const out = openSync(logFile, 'w');
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', out, out],
    shell: WINDOWS,
    // Un gruppo di processi a sé: chiudendo la demo si chiude anche quello che npm ha avviato.
    detached: !WINDOWS,
  });
  closeSync(out);
  children.push(child);
  child.once('exit', (code) => {
    if (!stopping) console.error(`\n✖ ${name} si è fermato (uscita ${code}): vedi ${logFile}`);
  });
  return logFile;
}

let stopping = false;
/** Expo in primo piano: si chiude anche lui, non solo con il Ctrl+C del terminale. */
let expo = null;
function stopAll() {
  stopping = true;
  if (expo && expo.exitCode === null) expo.kill('SIGINT');
  for (const child of children) {
    if (child.exitCode !== null || child.pid === undefined) continue;
    try {
      if (WINDOWS) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      else process.kill(-child.pid, 'SIGTERM');
    } catch {
      // già chiuso
    }
  }
}

process.on('SIGINT', () => {
  stopAll();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stopAll();
  process.exit(0);
});

// ── 1. Dipendenze ────────────────────────────────────────────────────────
for (const [name, dir] of Object.entries(DIRS)) {
  if (existsSync(join(dir, 'node_modules'))) continue;
  step(`Installo le dipendenze di ${name} (solo la prima volta, qualche minuto)`);
  run('npm', ['install'], { cwd: dir });
}

// ── 2. Database ──────────────────────────────────────────────────────────
let databaseUrl = process.env.DEMO_DATABASE_URL;
if (!databaseUrl) {
  step('Avvio Postgres (Docker)');
  if (!succeeds('docker', ['info']))
    fail('Serve Docker Desktop, installato e acceso (oppure DEMO_DATABASE_URL).');
  run('docker', [...COMPOSE, 'up', '-d', '--wait']);
  const exists = run(
    'docker',
    [
      ...COMPOSE,
      'exec',
      '-T',
      'db',
      'psql',
      '-U',
      'postgres',
      '-tAc',
      "SELECT 1 FROM pg_database WHERE datname = 'app_viaggi_demo'",
    ],
    { quiet: true },
  ).trim();
  if (exists !== '1')
    run('docker', [...COMPOSE, 'exec', '-T', 'db', 'createdb', '-U', 'postgres', 'app_viaggi_demo']);
  databaseUrl = 'postgresql://postgres:postgres@127.0.0.1:5432/app_viaggi_demo';
}

step('Migrazioni');
run('npx', ['prisma', 'migrate', 'deploy'], {
  cwd: DIRS.backend,
  env: { DATABASE_URL: databaseUrl },
  quiet: true,
});

if (KEEP) step('Tengo i dati della demo precedente (--keep)');
else {
  step('Dati demo, con le date di oggi');
  run('npm', ['run', '-s', 'seed:demo'], { cwd: DIRS.backend, env: { DATABASE_URL: databaseUrl } });
}

// ── 3. Servizi ───────────────────────────────────────────────────────────
const host = lanAddress();
if (!host) fail('Non trovo l’indirizzo di questo computer in rete: collegati al Wi-Fi o imposta DEMO_HOST.');

for (const [name, port] of Object.entries(PORTS))
  if (await portInUse(port))
    fail(`La porta ${port} (${name}) è già occupata: c'è un'altra demo o un server di sviluppo acceso?`);

mkdirSync(LOGS, { recursive: true });
const urls = {
  supabase: `http://${host}:${PORTS.supabase}`,
  api: `http://${host}:${PORTS.api}`,
  panel: `http://${host}:${PORTS.panel}`,
};

step('Avvio Supabase finto, backend e pannello');
const supabaseLog = background(
  'supabase',
  'node',
  [join(DIRS.e2e, 'support/fake-supabase.mjs'), String(PORTS.supabase)],
  {
    cwd: DIRS.e2e,
    env: { FAKE_SUPABASE_HOST: '0.0.0.0', FAKE_SUPABASE_URL: urls.supabase },
  },
);
const backendLog = background('backend', 'npm', ['run', 'dev'], {
  cwd: DIRS.backend,
  env: {
    NODE_ENV: 'development',
    HOST: '0.0.0.0',
    PORT: String(PORTS.api),
    DATABASE_URL: databaseUrl,
    SUPABASE_URL: urls.supabase,
    SUPABASE_SERVICE_ROLE_KEY: 'demo-service-role',
    SUPABASE_STORAGE_BUCKET: 'trip-assets',
    CORS_ORIGIN: [
      `http://localhost:${PORTS.panel}`,
      `http://127.0.0.1:${PORTS.panel}`,
      urls.panel,
      `http://localhost:${PORTS.metro}`,
      `http://${host}:${PORTS.metro}`,
    ].join(','),
  },
});
const panelLog = background(
  'pannello',
  'npm',
  ['run', 'dev', '--', '--host', '0.0.0.0', '--port', String(PORTS.panel), '--strictPort'],
  {
    cwd: DIRS.admin,
    env: { VITE_API_URL: urls.api, VITE_SUPABASE_URL: urls.supabase, VITE_SUPABASE_KEY: PUBLISHABLE_KEY },
  },
);

await waitFor(
  'Il Supabase finto',
  `http://127.0.0.1:${PORTS.supabase}/auth/v1/.well-known/jwks.json`,
  supabaseLog,
);
await waitFor('Il backend', `http://127.0.0.1:${PORTS.api}/health`, backendLog);
await waitFor('Il pannello', `http://127.0.0.1:${PORTS.panel}/`, panelLog);

const account = ({ email, password }) => `${email.padEnd(26)} ${password}`;
console.log(`
────────────────────────────────────────────────────────────────────
  Demo pronta ✈️

  PANNELLO, nel browser:  ${urls.panel}
  (da questo computer anche http://localhost:${PORTS.panel})
    staff            ${account(ACCOUNTS.staff)}

  APP, sul telefono: apri Expo Go e inquadra il QR qui sotto.
  Telefono e computer sulla stessa rete Wi-Fi.
    coordinatrice    ${account(ACCOUNTS.coordinator)}
    viaggiatore      ${account(ACCOUNTS.traveller)}

  Islanda in corso (giorno 3 di 10), Lisbona in corso, tre
  partenze in arrivo, cinque settimane di uso e prestazioni.
  Log dei servizi in .demo/ · Ctrl+C chiude tutto.
────────────────────────────────────────────────────────────────────
`);

// ── 4. App: Expo in primo piano, con il suo QR ───────────────────────────
// La CLI di Expo direttamente, senza npx in mezzo: il segnale di chiusura le arriva di sicuro.
const expoCli = join(DIRS.mobile, 'node_modules/expo/bin/cli');
expo = spawn(process.execPath, [expoCli, 'start', '--clear', '--port', String(PORTS.metro)], {
  cwd: DIRS.mobile,
  stdio: 'inherit',
  env: {
    ...process.env,
    // Le variabili EXPO_PUBLIC_* entrano nel bundle: --clear le rilegge ogni volta.
    EXPO_PUBLIC_API_URL: urls.api,
    EXPO_PUBLIC_SUPABASE_URL: urls.supabase,
    EXPO_PUBLIC_SUPABASE_KEY: PUBLISHABLE_KEY,
    // Il QR punta a questo indirizzo anche quando il computer ne ha più d'uno.
    REACT_NATIVE_PACKAGER_HOSTNAME: host,
  },
});
expo.once('exit', (code) => {
  stopAll();
  process.exit(code ?? 0);
});
