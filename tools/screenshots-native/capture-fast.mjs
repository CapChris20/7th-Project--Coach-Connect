#!/usr/bin/env node
// Fast native screenshot pass: tap real UI → simctl screenshot → swipe → repeat.
// Uses YOUR already-running Metro/dev client. No rebuild. No OCR. Short timeouts.
//
// Usage (repo root, Metro + sim already up):
//   source .env.maestro
//   node tools/screenshots-native/capture-fast.mjs
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
const MAESTRO = fs.existsSync(path.join(process.env.HOME || '', '.maestro/bin/maestro'))
  ? path.join(process.env.HOME, '.maestro/bin/maestro')
  : 'maestro';

// Manipulate here: Metro deep link host if not localhost
const METRO =
  process.env.MAESTRO_METRO_URL ||
  'exp+anatrox-app://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081';

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
  const kb = Math.round(fs.statSync(abs).size / 1024);
  console.log(`  📸 ${rel} (${kb}KB)`);
  return abs;
}

function maestro(steps, label) {
  // vocab: Maestro YAML — each run is one tiny flow (tap/wait), not a giant suite
  const body = `appId: ${APP_ID}\n---\n${steps}\n`;
  fs.mkdirSync(path.dirname(FLOW), { recursive: true });
  fs.writeFileSync(FLOW, body);
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
      timeout: 45_000,
    },
  );
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || '').slice(-600);
    throw new Error(`${label}: ${err}`);
  }
}

function tap(text, optional = false) {
  maestro(
    optional
      ? `- tapOn:\n    text: "${text}"\n    optional: true\n- waitForAnimationToEnd`
      : `- tapOn: "${text}"\n- waitForAnimationToEnd`,
    `tap:${text}`,
  );
}

function waitVisible(pattern, sec = 8) {
  maestro(
    `- extendedWaitUntil:\n    visible: "${pattern}"\n    timeout: ${sec * 1000}`,
    `wait:${pattern}`,
  );
}

function swipeUp() {
  maestro(
    `- swipe:\n    direction: UP\n    duration: 400\n- waitForAnimationToEnd`,
    'swipe-up',
  );
}

function scrollShots(baseRel, frames = 3) {
  // Capture top + scroll folds. Manipulate here: frames = how many vertical shots
  for (let i = 0; i < frames; i += 1) {
    if (i > 0) {
      swipeUp();
      sleep(300);
    }
    const suffix =
      frames === 1
        ? ''
        : i === 0
          ? '--01-top'
          : i === frames - 1
            ? `--${String(i + 1).padStart(2, '0')}-bottom`
            : `--${String(i + 1).padStart(2, '0')}-scroll`;
    shot(`${baseRel}${suffix}.png`);
  }
}

function forceMetro() {
  try {
    execFileSync('xcrun', ['simctl', 'openurl', 'booted', METRO], { stdio: 'pipe' });
  } catch {
    /* ignore */
  }
  sleep(1500);
}

function clearAndReconnect() {
  // Only clear when switching accounts — then immediately deep-link YOUR Metro
  maestro(
    `- launchApp:\n    clearState: true`,
    'clearState',
  );
  forceMetro();
  waitVisible('Get Started|Sign In|Sign in|Home|Active Clients|localhost:8081|127.0.0.1:8081', 20);
  try {
    maestro(
      `- runFlow:\n    when:\n      visible: ".*8081.*"\n    commands:\n      - tapOn: ".*8081.*"`,
      'tap-metro',
    );
  } catch {
    /* already in app */
  }
  waitVisible('Get Started|Sign In|Sign in|Home|Active Clients', 25);
}

function signIn(role) {
  // Real UI (new LoginScreen): title "Sign in", chips Client/Trainer, placeholders,
  // accessibilityLabel "Sign in email" / "Submit sign in". Maestro often matches
  // the chips + Forgot password more reliably than the title text alone.
  const who = role === 'client' ? 'CLIENT' : 'TRAINER';

  try {
    tap('Sign In', true);
  } catch {
    /* already on form */
  }
  sleep(400);
  waitVisible('Client|Trainer|Forgot password|name@example.com|Welcome Back', 12);

  // Role chip
  tap(role === 'client' ? 'Client' : 'Trainer', true);
  sleep(200);

  // Fill by accessibility labels first, fall back to placeholder taps
  maestro(
    `- tapOn:
    text: "Sign in email|Login email|name@example.com|EMAIL ADDRESS"
    optional: true
- tapOn:
    point: "50%,38%"
- eraseText
- inputText: "\${MAESTRO_${who}_EMAIL}"
- tapOn:
    text: "Sign in password|Login password"
    optional: true
- tapOn:
    point: "50%,48%"
- eraseText
- inputText: "\${MAESTRO_${who}_PASSWORD}"
- hideKeyboard
- tapOn:
    text: "Submit sign in|Submit login"
    optional: true
- tapOn:
    text: "Sign In"
`,
    `signin-${role}`,
  );
  waitVisible(
    role === 'client' ? 'Home|Nutrition|Workout|Explore Dashboard' : 'Home|Active Clients|Clients|Pending',
    30,
  );
}

function main() {
  loadEnv();
  if (!process.env.MAESTRO_CLIENT_EMAIL || !process.env.MAESTRO_TRAINER_EMAIL) {
    throw new Error('Need .env.maestro credentials');
  }
  fs.mkdirSync(OUT, { recursive: true });
  const manifest = {
    generatedAt: new Date().toISOString(),
    captureMethodDefault: 'maestro-ios-fast',
    entries: [],
  };
  const mark = (screen, role, state, file) => {
    manifest.entries.push({
      screen,
      role,
      state,
      file,
      status: 'ok',
      captureMethod: 'maestro-ios-fast',
    });
  };

  console.log('FAST capture — using your running Metro/sim (no rebuild)');

  // --- Auth empty (you're already on the app) ---
  forceMetro();
  try {
    waitVisible('Get Started|Sign In|Sign in|Welcome Back', 12);
  } catch {
    clearAndReconnect();
  }

  // Welcome
  try {
    // If on login form, go back to welcome
    maestro(
      `- runFlow:\n    when:\n      visible: "Sign in|Welcome Back"\n      notVisible: "Get Started"\n    commands:\n      - tapOn: "Go back|Back|.*back.*"\n        optional: true`,
      'back-to-welcome',
    );
  } catch {
    /* ok */
  }
  sleep(300);
  console.log('auth/welcome');
  shot('src/screenshots/empty/both/login-welcome.png');
  mark('login-welcome', 'both', 'empty', 'src/screenshots/empty/both/login-welcome.png');

  console.log('auth/login-form');
  tap('Sign In');
  sleep(400);
  shot('src/screenshots/empty/both/login-form.png');
  mark('login-form', 'both', 'empty', 'src/screenshots/empty/both/login-form.png');

  console.log('auth/forgot-password');
  try {
    tap('Forgot password?|Forgot.*', true);
    sleep(400);
    shot('src/screenshots/empty/both/forgot-password.png');
    mark('forgot-password', 'both', 'empty', 'src/screenshots/empty/both/forgot-password.png');
    maestro(
      `- tapOn:\n    text: "Go back|Back|.*back.*"\n    optional: true`,
      'back-from-forgot',
    );
  } catch (e) {
    console.log('  skip forgot:', e.message.slice(0, 120));
  }

  console.log('auth/signup');
  try {
    // From login → Sign Up, or welcome → Get Started
    maestro(
      `- runFlow:\n    when:\n      visible: "Sign Up|Get Started"\n    commands:\n      - tapOn: "Sign Up|Get Started"`,
      'open-signup',
    );
    sleep(500);
    scrollShots('src/screenshots/empty/both/signup-form', 3);
    mark('signup-form', 'both', 'empty', 'src/screenshots/empty/both/signup-form--01-top.png');
  } catch (e) {
    console.log('  skip signup:', e.message.slice(0, 120));
  }

  // --- Client with-data ---
  console.log('client sign-in');
  clearAndReconnect();
  signIn('client');

  const clientTabs = [
    ['client-home', 'Home', 3],
    ['client-nutrition', 'Nutrition', 3],
    ['client-workout', 'Workout', 3],
    ['client-ai', 'AI|AI Coach', 2],
    ['client-profile', 'Profile', 3],
  ];
  for (const [name, tab, frames] of clientTabs) {
    console.log(`client/${name}`);
    try {
      tap(tab.includes('|') ? tab : tab);
    } catch {
      try {
        tap(tab.split('|')[0], true);
      } catch {
        /* continue anyway */
      }
    }
    sleep(500);
    scrollShots(`src/screenshots/with-data/client/${name}`, frames);
    mark(name, 'client', 'with-data', `src/screenshots/with-data/client/${name}--01-top.png`);
  }

  // Extra client screens via obvious buttons
  console.log('client/dashboard');
  try {
    tap('Home');
    tap('Explore Dashboard', true);
    sleep(600);
    scrollShots('src/screenshots/with-data/client/client-dashboard', 4);
  } catch (e) {
    console.log('  skip dashboard:', e.message.slice(0, 100));
  }

  console.log('client/settings');
  try {
    tap('Profile');
    tap('Settings', true);
    sleep(500);
    scrollShots('src/screenshots/with-data/client/client-settings', 3);
  } catch (e) {
    console.log('  skip settings:', e.message.slice(0, 100));
  }

  // --- Trainer with-data ---
  console.log('trainer sign-in');
  clearAndReconnect();
  signIn('trainer');

  const trainerTabs = [
    ['trainer-home', 'Home', 4],
    ['trainer-progress', 'Progress', 3],
    ['trainer-sessions', 'Sessions', 3],
    ['trainer-nutrition-tab', 'Nutrition', 3],
    ['trainer-clients', 'Clients', 3],
    ['trainer-messages', 'Messages', 2],
    ['trainer-workout', 'Workout', 3],
    ['trainer-profile', 'Profile', 3],
  ];
  for (const [name, tab, frames] of trainerTabs) {
    console.log(`trainer/${name}`);
    try {
      tap(tab);
    } catch {
      try {
        tap(tab, true);
      } catch {
        /* skip */
      }
    }
    sleep(500);
    scrollShots(`src/screenshots/with-data/trainer/${name}`, frames);
    mark(name, 'trainer', 'with-data', `src/screenshots/with-data/trainer/${name}--01-top.png`);
  }

  console.log('trainer/settings');
  try {
    tap('Profile');
    tap('Settings', true);
    sleep(500);
    scrollShots('src/screenshots/with-data/trainer/trainer-settings', 3);
  } catch (e) {
    console.log('  skip settings:', e.message.slice(0, 100));
  }

  const manifestPath = path.join(OUT, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('Done.', manifest.entries.length, 'entries →', path.relative(ROOT, manifestPath));
}

main();
