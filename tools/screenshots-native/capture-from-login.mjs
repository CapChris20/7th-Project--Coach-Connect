#!/usr/bin/env node
// Continue FAST capture from the Sign In screen already on the simulator.
// No clearState. No rebuild. Just: fill login → tab → screenshot → swipe.
import { spawnSync, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'src/screenshots');
const FLOW = path.join(ROOT, '.maestro/screenshot/_fast.yaml');
const APP_ID = 'com.coachconnect';
const JAVA_HOME =
  process.env.JAVA_HOME ||
  '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home';
const MAESTRO = path.join(process.env.HOME || '', '.maestro/bin/maestro');

function loadEnv() {
  const p = path.join(ROOT, '.env.maestro');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim().replace(/^["']|["']$/g, '');
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

function sleep(ms) {
  execFileSync('sleep', [String(Math.max(0.05, ms / 1000))], { stdio: 'ignore' });
}

function shot(rel) {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  execFileSync('xcrun', ['simctl', 'io', 'booted', 'screenshot', abs], { stdio: 'pipe' });
  console.log(`  📸 ${rel} (${Math.round(fs.statSync(abs).size / 1024)}KB)`);
}

function maestro(steps, label) {
  fs.mkdirSync(path.dirname(FLOW), { recursive: true });
  fs.writeFileSync(FLOW, `appId: ${APP_ID}\n---\n${steps}\n`);
  const r = spawnSync(
    MAESTRO,
    [
      'test',
      '-e',
      `APP_ID=${APP_ID}`,
      '-e',
      `MAESTRO_CLIENT_EMAIL=${process.env.MAESTRO_CLIENT_EMAIL || ''}`,
      '-e',
      `MAESTRO_CLIENT_PASSWORD=${process.env.MAESTRO_CLIENT_PASSWORD || ''}`,
      '-e',
      `MAESTRO_TRAINER_EMAIL=${process.env.MAESTRO_TRAINER_EMAIL || ''}`,
      '-e',
      `MAESTRO_TRAINER_PASSWORD=${process.env.MAESTRO_TRAINER_PASSWORD || ''}`,
      FLOW,
    ],
    {
      encoding: 'utf8',
      cwd: ROOT,
      env: { ...process.env, JAVA_HOME, PATH: `${JAVA_HOME}/bin:${process.env.PATH || ''}` },
      timeout: 60_000,
    },
  );
  if (r.status !== 0) {
    throw new Error(`${label}: ${(r.stderr || r.stdout || '').slice(-800)}`);
  }
}

function swipeUp() {
  maestro(`- swipe:\n    direction: UP\n    duration: 350`, 'swipe');
}

function scrollShots(base, n = 3) {
  for (let i = 0; i < n; i += 1) {
    if (i) {
      swipeUp();
      sleep(250);
    }
    const suf =
      n === 1
        ? ''
        : i === 0
          ? '--01-top'
          : i === n - 1
            ? `--${String(i + 1).padStart(2, '0')}-bottom`
            : `--${String(i + 1).padStart(2, '0')}-scroll`;
    shot(`${base}${suf}.png`);
  }
}

function signIn(role) {
  const who = role === 'client' ? 'CLIENT' : 'TRAINER';
  console.log(`sign-in ${role}`);
  maestro(
    `- tapOn: "${role === 'client' ? 'Client' : 'Trainer'}"
- tapOn:
    point: "50%,36%"
- eraseText
- inputText: "\${MAESTRO_${who}_EMAIL}"
- tapOn:
    point: "50%,46%"
- eraseText
- inputText: "\${MAESTRO_${who}_PASSWORD}"
- hideKeyboard
- tapOn: "Sign In"
- extendedWaitUntil:
    visible: "Home|Nutrition|Workout|Active Clients|Clients|Pending Requests|Explore Dashboard"
    timeout: 45000
`,
    `signin-${role}`,
  );
}

function tapTab(name) {
  maestro(`- tapOn: "${name}"\n- waitForAnimationToEnd`, `tab:${name}`);
}

function main() {
  loadEnv();
  console.log('Continue from current Sign In screen (no clearState)');

  // Client
  signIn('client');
  for (const [key, tab, frames] of [
    ['client-home', 'Home', 3],
    ['client-nutrition', 'Nutrition', 3],
    ['client-workout', 'Workout', 3],
    ['client-ai', 'AI', 2],
    ['client-profile', 'Profile', 3],
  ]) {
    console.log(key);
    try {
      tapTab(tab);
    } catch (e) {
      console.log('  tab fail', e.message.slice(0, 100));
    }
    sleep(400);
    scrollShots(`src/screenshots/with-data/client/${key}`, frames);
  }

  // Open settings if possible
  try {
    tapTab('Profile');
    maestro(`- tapOn:\n    text: "Settings"\n    optional: true`, 'settings');
    sleep(400);
    scrollShots('src/screenshots/with-data/client/client-settings', 3);
  } catch (e) {
    console.log('client settings skip', e.message.slice(0, 80));
  }

  // Trainer: sign out then login — prefer Profile → Sign out if present
  console.log('switch to trainer');
  try {
    tapTab('Profile');
    maestro(
      `- scrollUntilVisible:
    element: "Sign out|Sign Out|Log out"
    direction: DOWN
    timeout: 8000
    optional: true
- tapOn:
    text: "Sign out|Sign Out|Log out"
    optional: true
- tapOn:
    text: "Sign In|Get Started"
    optional: true
`,
      'signout',
    );
  } catch {
    /* fall through */
  }
  sleep(800);
  // If still logged in / wrong place, deep link won't help auth — try Sign In visible
  try {
    maestro(
      `- extendedWaitUntil:
    visible: "Sign In|Sign in|Client|Trainer|Get Started"
    timeout: 15000
- tapOn:
    text: "Sign In"
    optional: true
`,
      'to-login',
    );
  } catch (e) {
    console.log('to-login', e.message.slice(0, 120));
  }

  signIn('trainer');
  for (const [key, tab, frames] of [
    ['trainer-home', 'Home', 3],
    ['trainer-progress', 'Progress', 2],
    ['trainer-sessions', 'Sessions', 2],
    ['trainer-nutrition-tab', 'Nutrition', 2],
    ['trainer-clients', 'Clients', 3],
    ['trainer-messages', 'Messages', 2],
    ['trainer-workout', 'Workout', 2],
    ['trainer-profile', 'Profile', 3],
  ]) {
    console.log(key);
    try {
      tapTab(tab);
    } catch (e) {
      console.log('  tab fail', e.message.slice(0, 100));
    }
    sleep(400);
    scrollShots(`src/screenshots/with-data/trainer/${key}`, frames);
  }

  console.log('Done. PNGs under src/screenshots/');
  execFileSync(
    'bash',
    [
      '-lc',
      `find "${OUT}" -name '*.png' | grep -E 'empty|with-data' | sort | wc -l; find "${OUT}" -name '*.png' | grep -E 'empty|with-data' | sort`,
    ],
    { stdio: 'inherit' },
  );
}

main();
