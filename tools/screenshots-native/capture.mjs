#!/usr/bin/env node
/**
 * Native iOS Simulator screenshot capture via Maestro + simctl.
 *
 * Prereqs:
 *   - Coach Connect iPhone simulator booted
 *   - Dev client installed (com.coachconnect)
 *   - Metro on :8081, API on :4000
 *   - .env.maestro with MAESTRO_CLIENT_* / MAESTRO_TRAINER_* (never committed)
 *
 * Usage (from repo root):
 *   source .env.maestro
 *   node tools/screenshots-native/capture.mjs
 *
 * Output: src/screenshots/<state>/<role>/*.png + src/screenshots/manifest.json
 */
import { spawnSync, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { buildManifestSeed, AUTH_SCREENS, CLIENT_WITH_DATA, TRAINER_WITH_DATA } = require('./lib/catalog.js');
const { verifyPng } = require('./lib/verify-png.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT_ROOT = path.join(ROOT, 'src/screenshots');
const FLOW_DIR = path.join(ROOT, '.maestro/screenshot');
const TMP_FLOW = path.join(FLOW_DIR, '_tmp-step.yaml');
const APP_ID = process.env.APP_ID || 'com.coachconnect';
const MAX_ATTEMPTS = 3;
const JAVA_HOME =
  process.env.JAVA_HOME ||
  '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home';

function loadDotEnvMaestro() {
  const p = path.join(ROOT, '.env.maestro');
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

function maestroBin() {
  const home = path.join(process.env.HOME || '', '.maestro/bin/maestro');
  if (fs.existsSync(home)) return home;
  return 'maestro';
}

function runMaestroYaml(yamlBody, label) {
  fs.mkdirSync(FLOW_DIR, { recursive: true });
  fs.writeFileSync(TMP_FLOW, yamlBody, 'utf8');
  const env = {
    ...process.env,
    JAVA_HOME,
    PATH: `${JAVA_HOME}/bin:${process.env.PATH || ''}`,
    APP_ID,
  };
  const args = [
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
    TMP_FLOW,
  ];
  const result = spawnSync(maestroBin(), args, {
    encoding: 'utf8',
    cwd: ROOT,
    env,
    timeout: 180_000,
  });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || '').slice(-1200);
    throw new Error(`Maestro step failed (${label}): ${err}`);
  }
}

function simScreenshot(absPath) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  execFileSync('xcrun', ['simctl', 'io', 'booted', 'screenshot', absPath], {
    stdio: 'pipe',
  });
}

function sleep(ms) {
  const sec = Math.max(0.1, ms / 1000);
  try {
    execFileSync('sleep', [String(sec)], { stdio: 'ignore' });
  } catch {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      /* spin */
    }
  }
}

function ensureBootedSim() {
  const out = execFileSync('xcrun', ['simctl', 'list', 'devices', 'booted'], {
    encoding: 'utf8',
  });
  if (!/Booted/.test(out)) {
    throw new Error('No booted iOS Simulator. Boot Coach Connect iPhone first.');
  }
}

// vocab: Expo dev-client deep link — opens YOUR already-running Metro, not a new build
// Manipulate here: change host/port if Metro is not on 127.0.0.1:8081
const METRO_DEEP_LINK =
  process.env.MAESTRO_METRO_URL ||
  'exp+anatrox-app://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081';

function forceMetroDeepLink() {
  // Why: clearState / relaunch dumps you on the Expo launcher. Tapping “localhost”
  // is flaky; openurl hits the same Metro the user already started with `npm start`.
  try {
    execFileSync('xcrun', ['simctl', 'openurl', 'booted', METRO_DEEP_LINK], {
      stdio: 'pipe',
    });
  } catch {
    // optional — Maestro tap fallback below still runs
  }
  sleep(2500);
}

function reconnectMetroYaml() {
  // Shared “if launcher → connect” block. Used after any clearState.
  return `- runFlow:
    when:
      visible: "localhost:8081|127.0.0.1:8081"
    commands:
      - tapOn: ".*8081.*"
- runFlow:
    when:
      visible: "Enter URL manually"
      notVisible: "Get Started|Welcome Back|Home|Active Clients|Sign In"
    commands:
      - tapOn: "Enter URL manually"
      - eraseText
      - inputText: "http://127.0.0.1:8081"
      - tapOn: "Connect"
`;
}

function connectDevClient() {
  // Prefer the user's already-loaded UI. Do NOT rebuild or install a new binary.
  // Only deep-link + tap if we're stuck on the Expo development-server launcher.
  forceMetroDeepLink();
  const yaml = `appId: ${APP_ID}
---
- launchApp
- extendedWaitUntil:
    visible: "Home|Get Started|Welcome Back|DEVELOPMENT SERVERS|localhost:8081|127.0.0.1:8081|No development servers|Sign In"
    timeout: 60000
${reconnectMetroYaml()}- extendedWaitUntil:
    visible: "Get Started|Welcome Back|Home|Active Clients|Sign In"
    timeout: 120000
`;
  runMaestroYaml(yaml, 'connect-dev-client');
}

function flowHeader() {
  return `appId: ${APP_ID}\n---\n`;
}

function scrollDownYaml() {
  return `${flowHeader()}- swipe:
    direction: UP
    duration: 600
- waitForAnimationToEnd
`;
}

function scrollToTopYaml() {
  return `${flowHeader()}- repeat:
    times: 4
    commands:
      - swipe:
          direction: DOWN
          duration: 400
- waitForAnimationToEnd
`;
}

const NAV = {
  // No clearState here — wiping JS state boots the Expo launcher and fights the
  // user's already-running Metro. Welcome is the signed-out landing screen.
  'auth-welcome': `${flowHeader()}- launchApp
- extendedWaitUntil:
    visible: "Get Started|Sign In|DEVELOPMENT SERVERS|localhost:8081|127.0.0.1:8081"
    timeout: 60000
${reconnectMetroYaml()}- extendedWaitUntil:
    visible: "Get Started|Sign In"
    timeout: 120000
`,

  'auth-login-form': `${flowHeader()}- runFlow:
    when:
      visible: "Get Started"
    commands:
      - tapOn: "Sign In"
- extendedWaitUntil:
    visible: "Welcome Back|Submit login|Login email"
    timeout: 30000
`,

  'auth-signup-form': `${flowHeader()}- runFlow:
    when:
      visible: "Welcome Back"
    commands:
      - tapOn: ".*[Cc]reate.*|Sign [Uu]p|Get Started"
        optional: true
- runFlow:
    when:
      visible: "Get Started"
    commands:
      - tapOn: "Get Started"
- extendedWaitUntil:
    visible: "Sign|email|Password|Create"
    timeout: 30000
    optional: true
`,

  'auth-forgot-password': `${flowHeader()}- runFlow:
    when:
      visible: "Get Started"
    commands:
      - tapOn: "Sign In"
- extendedWaitUntil:
    visible: "Welcome Back|Forgot|password"
    timeout: 30000
- tapOn:
    text: "Forgot.*|Reset.*"
    optional: true
`,

  // clearState only when switching accounts — then forceMetroDeepLink() runs in JS
  // before this YAML (see runSignedInCapture).
  'client-sign-in': `${flowHeader()}- extendedWaitUntil:
    visible: "Get Started|Welcome Back|Home|localhost:8081|127.0.0.1:8081"
    timeout: 90000
${reconnectMetroYaml()}- extendedWaitUntil:
    visible: "Get Started|Welcome Back|Home"
    timeout: 120000
- runFlow:
    when:
      visible: "Get Started"
    commands:
      - tapOn: "Sign In"
- runFlow:
    when:
      visible: "Welcome Back|Sign in|Login email"
    commands:
      - tapOn: "Login email"
      - inputText: "\${MAESTRO_CLIENT_EMAIL}"
      - tapOn: "Login password"
      - inputText: "\${MAESTRO_CLIENT_PASSWORD}"
      - hideKeyboard
      - tapOn: "Submit login"
- extendedWaitUntil:
    visible: "Home"
    timeout: 120000
- assertVisible: "Home"
`,

  'client-tab-home': `${flowHeader()}- tapOn: "Home"
- extendedWaitUntil:
    visible: "Nutrition Today|Good Morning|Good Afternoon|Good Evening|Explore Dashboard|Home"
    timeout: 30000
`,

  'client-dashboard': `${flowHeader()}- tapOn: "Home"
- tapOn:
    text: "Explore Dashboard"
    optional: true
- extendedWaitUntil:
    visible: "YOUR DASHBOARD|Welcome back|Dashboard"
    timeout: 30000
`,

  'client-tab-nutrition': `${flowHeader()}- tapOn: "Nutrition"
- extendedWaitUntil:
    visible: "Nutrition|Search foods|Set Your Calorie Goal|Calories"
    timeout: 30000
- runFlow:
    when:
      visible: "Set Your Calorie Goal|Next"
    commands:
      - tapOn:
          text: "Next"
          optional: true
      - tapOn:
          text: "Next"
          optional: true
      - tapOn:
          text: "Finish Setup"
          optional: true
`,

  'client-food-search': `${flowHeader()}- tapOn: "Nutrition"
- tapOn:
    text: "Search foods.*"
    optional: true
- tapOn:
    text: "Search"
    optional: true
- extendedWaitUntil:
    visible: "Add Food|Search foods"
    timeout: 30000
`,

  'client-confirm-food': `${flowHeader()}- tapOn: "Nutrition"
- tapOn:
    text: "Search foods.*"
    optional: true
- tapOn: "Search foods"
- inputText: "chicken"
- pressKey: Enter
- extendedWaitUntil:
    visible: "CAL|chicken|Chicken"
    timeout: 45000
- tapOn:
    text: ".*[Cc]hicken.*"
    index: 0
    optional: true
- extendedWaitUntil:
    visible: "Log it|CAL|Serving"
    timeout: 30000
`,

  'client-nutrition-goals': `${flowHeader()}- tapOn: "Nutrition"
- tapOn:
    text: "Goals|Settings|Target|Edit goals|Calorie"
    optional: true
- extendedWaitUntil:
    visible: "Goal|Calorie|Protein|Target|Nutrition"
    timeout: 30000
    optional: true
`,

  'client-tab-workout': `${flowHeader()}- tapOn: "Workout"
- extendedWaitUntil:
    visible: "Workout|Generate Plan|Workout Plans|Library"
    timeout: 30000
`,

  'client-exercise-library': `${flowHeader()}- tapOn: "Workout"
- tapOn:
    text: "Library|Exercise Library|Browse|Saved Workouts"
    optional: true
- extendedWaitUntil:
    visible: "Library|Exercise|Saved|Plan|Workout"
    timeout: 30000
    optional: true
`,

  'client-tab-ai': `${flowHeader()}- tapOn: "AI Coach"
- extendedWaitUntil:
    visible: "AI Coach|Ask your coach"
    timeout: 30000
`,

  'client-ai-chat': `${flowHeader()}- tapOn: "AI Coach"
- extendedWaitUntil:
    visible: "Ask your coach|Message input|AI Coach"
    timeout: 30000
`,

  'client-profile': `${flowHeader()}- tapOn: "Open profile"
- extendedWaitUntil:
    visible: "Profile|Sign out|Edit"
    timeout: 30000
`,

  'client-settings': `${flowHeader()}- tapOn: "Open settings"
- extendedWaitUntil:
    visible: "Settings|Edit Profile|Blocked users|Workout Reminders"
    timeout: 30000
`,

  'client-help-faq': `${flowHeader()}- tapOn: "Open settings"
- tapOn:
    text: "Help|FAQ|Help & FAQ"
    optional: true
- extendedWaitUntil:
    visible: "Help|FAQ"
    timeout: 30000
    optional: true
`,

  'client-trainer-search': `${flowHeader()}- tapOn: "Home"
- tapOn:
    text: "Browse Trainers|Find a Trainer"
    optional: true
- extendedWaitUntil:
    visible: "Find a Trainer|Browse|Trainer"
    timeout: 30000
`,

  'client-inbox': `${flowHeader()}- tapOn: "Home"
- tapOn:
    text: "Messages"
    optional: true
- extendedWaitUntil:
    visible: "Messages|Conversations|Inbox|No messages"
    timeout: 30000
    optional: true
`,

  'client-weekly-report': `${flowHeader()}- tapOn: "Home"
- tapOn:
    text: "Weekly report|Weekly Report|Open weekly report"
    optional: true
- extendedWaitUntil:
    visible: "Weekly|Report|Sleep|Water"
    timeout: 30000
    optional: true
`,

  'trainer-sign-in': `${flowHeader()}- extendedWaitUntil:
    visible: "Get Started|Welcome Back|Home|localhost:8081|127.0.0.1:8081|Active Clients"
    timeout: 90000
${reconnectMetroYaml()}- extendedWaitUntil:
    visible: "Get Started|Welcome Back|Home|Active Clients"
    timeout: 120000
- runFlow:
    when:
      visible: "Get Started"
    commands:
      - tapOn: "Sign In"
- runFlow:
    when:
      visible: "Welcome Back|Sign in|Login email"
    commands:
      - tapOn: "Login email"
      - inputText: "\${MAESTRO_TRAINER_EMAIL}"
      - tapOn: "Login password"
      - inputText: "\${MAESTRO_TRAINER_PASSWORD}"
      - hideKeyboard
      - tapOn: "Submit login"
- extendedWaitUntil:
    visible: "Home|Active Clients"
    timeout: 120000
`,

  'trainer-home': `${flowHeader()}- tapOn: "Home"
- extendedWaitUntil:
    visible: "Active Clients|Pending Requests|Clients"
    timeout: 30000
`,

  'trainer-progress-tab': `${flowHeader()}- tapOn:
    text: "Progress"
    optional: true
- extendedWaitUntil:
    visible: "Progress|Weight"
    timeout: 30000
    optional: true
`,

  'trainer-sessions-tab': `${flowHeader()}- tapOn:
    text: "Sessions"
    optional: true
- extendedWaitUntil:
    visible: "Sessions|Schedule|Upcoming"
    timeout: 30000
    optional: true
`,

  'trainer-nutrition-tab': `${flowHeader()}- tapOn:
    text: "Nutrition"
    optional: true
- extendedWaitUntil:
    visible: "Nutrition|Calories|Protein|Meal"
    timeout: 30000
    optional: true
`,

  'trainer-clients': `${flowHeader()}- tapOn:
    text: "All Clients|Clients"
    optional: true
- extendedWaitUntil:
    visible: "Clients|Trainee|All Clients"
    timeout: 30000
`,

  'trainer-client-detail': `${flowHeader()}- tapOn:
    text: "All Clients|Clients"
    optional: true
- tapOn:
    text: ".*"
    index: 0
    optional: true
- extendedWaitUntil:
    visible: "Progress|Sessions|Nutrition|Messages"
    timeout: 30000
    optional: true
`,

  'trainer-messages': `${flowHeader()}- tapOn:
    text: "Messages"
    optional: true
- extendedWaitUntil:
    visible: "Messages|Conversations|No messages"
    timeout: 30000
`,

  'trainer-workout': `${flowHeader()}- tapOn: "Workout"
- extendedWaitUntil:
    visible: "Workout|Generate|Plan|Library"
    timeout: 30000
`,

  'trainer-settings': `${flowHeader()}- tapOn: "Open settings"
- extendedWaitUntil:
    visible: "Settings|Edit Profile|Blocked users"
    timeout: 30000
`,

  'trainer-profile': `${flowHeader()}- tapOn: "Open profile"
- extendedWaitUntil:
    visible: "Profile|Sign out|Edit"
    timeout: 30000
`,

  'trainer-payments': `${flowHeader()}- tapOn: "Open settings"
- tapOn:
    text: "Payments|Billing|Payout|Subscription|Pro"
    optional: true
- extendedWaitUntil:
    visible: "Payment|Payout|Stripe|Pro|Billing|Settings"
    timeout: 30000
    optional: true
`,
};

function frameFileName(screen, scrollIndex, scrollFrames) {
  if (!scrollFrames || scrollFrames <= 1) return `${screen}.png`;
  if (scrollIndex === 0) return `${screen}--01-top.png`;
  if (scrollIndex === scrollFrames - 1) {
    return `${screen}--${String(scrollIndex + 1).padStart(2, '0')}-bottom.png`;
  }
  return `${screen}--${String(scrollIndex + 1).padStart(2, '0')}-scroll.png`;
}

function captureScrollSeries(def, roleStateDir) {
  const frames = def.long ? def.scrollFrames || 3 : 1;
  const results = [];

  // Navigate once, reset scroll to top, then capture each fold.
  for (const navKey of def.navigate) {
    if (!NAV[navKey]) throw new Error(`Unknown navigate key: ${navKey}`);
    runMaestroYaml(NAV[navKey], navKey);
  }
  try {
    runMaestroYaml(scrollToTopYaml(), 'scroll-top');
  } catch {
    // optional
  }

  for (let i = 0; i < frames; i += 1) {
    if (i > 0) {
      runMaestroYaml(scrollDownYaml(), `scroll-${i}`);
      sleep(700);
    } else {
      sleep(500);
    }
    const fileName = frameFileName(def.screen, i, frames);
    const abs = path.join(roleStateDir, fileName);
    const rel = path.relative(ROOT, abs).split(path.sep).join('/');

    let lastFail = null;
    let okEntry = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      simScreenshot(abs);
      const v = verifyPng(abs, def.expect);
      if (v.ok) {
        okEntry = {
          screen: def.screen,
          role: def.role,
          state: def.state,
          route: def.route || null,
          file: rel,
          status: 'ok',
          reason: null,
          captureMethod: 'maestro-ios',
          scrollIndex: i,
          attempts: attempt,
          verify: { size: v.size, matched: v.matched, pixel: v.pixel },
        };
        break;
      }
      lastFail = v.reason;
      sleep(800);
    }
    if (okEntry) {
      results.push(okEntry);
    } else {
      results.push({
        screen: def.screen,
        role: def.role,
        state: def.state,
        route: def.route || null,
        file: rel,
        status: 'failed',
        reason: lastFail || 'verify failed',
        captureMethod: 'maestro-ios',
        scrollIndex: i,
        attempts: MAX_ATTEMPTS,
      });
    }
  }
  return results;
}

function main() {
  loadDotEnvMaestro();
  ensureBootedSim();

  if (!process.env.MAESTRO_CLIENT_EMAIL || !process.env.MAESTRO_TRAINER_EMAIL) {
    throw new Error('Missing MAESTRO_CLIENT_* / MAESTRO_TRAINER_* in env / .env.maestro');
  }

  fs.mkdirSync(OUT_ROOT, { recursive: true });
  const manifest = {
    generatedAt: new Date().toISOString(),
    captureMethodDefault: 'maestro-ios',
    viewportNote: 'iPhone logical ~390x844; physical pixels from Coach Connect iPhone simulator',
    notes: [
      'Prefer Maestro on iOS Simulator (real native UI). Web/Playwright was not used.',
      'Live Maestro accounts → with-data only for logged-in screens; empty logged-in marked skipped.',
      'Long screens captured as numbered scroll frames (--01-top / --NN-scroll / --NN-bottom).',
      'Credentials never written to repo files (env only).',
    ],
    entries: [],
  };

  console.log('Using your already-running Metro/dev client (no rebuild)…');
  connectDevClient();

  // --- Auth (signed out / empty) ---
  console.log('Capturing auth screens…');
  for (const def of AUTH_SCREENS) {
    console.log(`  empty/both/${def.screen}`);
    const dir = path.join(OUT_ROOT, def.state, def.role === 'both' ? 'both' : def.role);
    try {
      const series = captureScrollSeries(
        { ...def, state: 'empty', long: !!def.long, scrollFrames: def.scrollFrames || (def.long ? 3 : 1) },
        dir,
      );
      manifest.entries.push(...series);
    } catch (err) {
      manifest.entries.push({
        screen: def.screen,
        role: def.role,
        state: 'empty',
        route: null,
        file: null,
        status: 'failed',
        reason: err.message.slice(0, 500),
        captureMethod: 'maestro-ios',
        scrollIndex: 0,
        attempts: MAX_ATTEMPTS,
      });
    }
  }

  // Seed skipped empty entries for logged-in screens
  const seed = buildManifestSeed().filter((e) => e.status === 'skipped');
  manifest.entries.push(...seed);

  // --- Client with-data ---
  // clearState once to drop any session, then deep-link back to YOUR Metro.
  console.log('Signing in as client…');
  runMaestroYaml(
    `${flowHeader()}- launchApp:
    clearState: true
`,
    'client-clear-state',
  );
  forceMetroDeepLink();
  runMaestroYaml(NAV['client-sign-in'], 'client-sign-in');
  for (const def of CLIENT_WITH_DATA) {
    console.log(`  client/${def.screen}`);
    const dir = path.join(OUT_ROOT, def.state, def.role);
    try {
      const series = captureScrollSeries(def, dir);
      manifest.entries.push(...series);
    } catch (err) {
      manifest.entries.push({
        screen: def.screen,
        role: def.role,
        state: def.state,
        route: def.route || null,
        file: null,
        status: 'failed',
        reason: err.message.slice(0, 500),
        captureMethod: 'maestro-ios',
        scrollIndex: 0,
        attempts: MAX_ATTEMPTS,
      });
    }
  }

  // --- Trainer with-data ---
  console.log('Signing in as trainer…');
  runMaestroYaml(
    `${flowHeader()}- launchApp:
    clearState: true
`,
    'trainer-clear-state',
  );
  forceMetroDeepLink();
  runMaestroYaml(NAV['trainer-sign-in'], 'trainer-sign-in');
  for (const def of TRAINER_WITH_DATA) {
    console.log(`  trainer/${def.screen}`);
    const dir = path.join(OUT_ROOT, def.state, def.role);
    try {
      const series = captureScrollSeries(def, dir);
      manifest.entries.push(...series);
    } catch (err) {
      manifest.entries.push({
        screen: def.screen,
        role: def.role,
        state: def.state,
        route: def.route || null,
        file: null,
        status: 'failed',
        reason: err.message.slice(0, 500),
        captureMethod: 'maestro-ios',
        scrollIndex: 0,
        attempts: MAX_ATTEMPTS,
      });
    }
  }

  const manifestPath = path.join(OUT_ROOT, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const counts = manifest.entries.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {});
  console.log('Done.', counts);
  console.log('Manifest:', path.relative(ROOT, manifestPath));

  // Fail CI-style if too many failures
  if ((counts.failed || 0) > (counts.ok || 0)) {
    process.exitCode = 1;
  }
}

main();
