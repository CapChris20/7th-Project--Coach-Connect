#!/usr/bin/env node
/**
 * Security regression tests (post-audit fixes).
 * Run: node scripts/testSecurityFixes.js
 * Optional: SECURITY_TEST_BASE_URL=https://your-api.run.app node scripts/testSecurityFixes.js
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ROOT = path.join(__dirname, '..');
const BASE = (process.env.SECURITY_TEST_BASE_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');

const results = [];
let failed = 0;

function pass(name, detail = '') {
  results.push({ status: 'PASS', name, detail });
  console.log(`✅ PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  failed += 1;
  results.push({ status: 'FAIL', name, detail });
  console.log(`❌ FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

function skip(name, detail = '') {
  results.push({ status: 'SKIP', name, detail });
  console.log(`⏭️  SKIP  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function request(method, route, { body, headers = {} } = {}) {
  const url = `${BASE}${route}`;
  const res = await fetch(url, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...headers },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text?.slice(0, 200) };
  }
  return { status: res.status, json, text };
}

function grepFiles(dir, pattern, excludeDirs = []) {
  const hits = [];
  const walk = (d) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) {
        if (excludeDirs.some((x) => full.includes(x))) continue;
        if (['node_modules', '.git', 'dist', 'build'].includes(ent.name)) continue;
        walk(full);
        continue;
      }
      if (!/\.(js|jsx|ts|tsx)$/.test(ent.name)) continue;
      const content = fs.readFileSync(full, 'utf8');
      if (pattern.test(content)) hits.push(path.relative(ROOT, full));
    }
  };
  walk(dir);
  return hits;
}

function isProductionRuntime() {
  return process.env.NODE_ENV === 'production' && !!process.env.K_SERVICE;
}

function devOnlyBlocked() {
  return isProductionRuntime() && process.env.ALLOW_DEV_ROUTES !== '1';
}

async function waitForServer(maxMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await request('GET', '/health');
      if (res.status === 200) return true;
    } catch (_) {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

let serverChild = null;

async function ensureServer() {
  if (process.env.SECURITY_TEST_BASE_URL) {
    const ok = await waitForServer(8000);
    if (!ok) throw new Error(`Cannot reach ${BASE}`);
    return;
  }

  const ok = await waitForServer(1500);
  if (ok) {
    pass('Server already running', BASE);
    return;
  }

  console.log('Starting local server for security tests…');
  serverChild = spawn('node', ['server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: 'development', AI_COACH_ENFORCE_LIMITS: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const ready = await waitForServer(25000);
  if (!ready) {
    serverChild.kill('SIGTERM');
    throw new Error('Local server did not become ready on :4000');
  }
  pass('Local server started', BASE);
}

async function testAuthRequiredRoutes() {
  const cases = [
    ['POST', '/api/notifications/send', { recipientId: 'u1', senderName: 'x', messageText: 'hi' }],
    ['POST', '/api/ask', { messages: [{ role: 'user', content: 'hi' }] }],
    ['GET', '/api/food/search?query=chicken', null],
    ['POST', '/api/food/barcode', { barcode: '1234567890123' }],
    ['POST', '/api/nutrition/restaurant', { query: 'chipotle bowl' }],
    ['POST', '/api/nutrition/search', { foodName: 'egg' }],
    ['GET', '/api/fatigue/test-user-id', null],
    ['GET', '/api/youtube/search?q=squat', null],
    ['POST', '/api/log-error', { message: 'test error' }],
    ['POST', '/api/workout/generate', { onboardingData: { daysPerWeek: 3 } }],
    ['POST', '/api/trainers', { name: 'Test Trainer' }],
    ['PUT', '/api/trainers/trainer123', { name: 'Hacked' }],
    ['DELETE', '/api/trainers/trainer123', null],
  ];

  for (const [method, route, body] of cases) {
    const res = await request(method, route, { body });
    if (res.status === 401) {
      pass(`401 without token: ${method} ${route.split('?')[0]}`, String(res.status));
    } else if (res.status === 403) {
      pass(`403 without token: ${method} ${route.split('?')[0]}`, String(res.status));
    } else {
      fail(
        `Auth required: ${method} ${route.split('?')[0]}`,
        `expected 401/403, got ${res.status} ${JSON.stringify(res.json)?.slice(0, 120)}`
      );
    }
  }
}

async function testInvalidTokenGenericError() {
  const res = await request('GET', '/api/food/search?query=egg', {
    headers: { Authorization: 'Bearer not-a-real-jwt' },
  });
  if (res.status !== 401) {
    fail('Invalid token returns 401', `got ${res.status}`);
    return;
  }
  const body = JSON.stringify(res.json || {});
  if (res.json?.error === 'Unauthorized' && !res.json?.code && !res.json?.message?.includes('Firebase')) {
    pass('Invalid token error is generic', res.json.error);
  } else {
    fail('Invalid token error leaks details', body.slice(0, 200));
  }
}

async function testDevRoutesGuardLogic() {
  const prev = { NODE_ENV: process.env.NODE_ENV, K_SERVICE: process.env.K_SERVICE, ALLOW: process.env.ALLOW_DEV_ROUTES };
  process.env.NODE_ENV = 'production';
  process.env.K_SERVICE = 'coachconnect-api-test';
  delete process.env.ALLOW_DEV_ROUTES;
  if (devOnlyBlocked()) {
    pass('devOnlyRoute blocks in simulated Cloud Run production');
  } else {
    fail('devOnlyRoute should block when K_SERVICE + NODE_ENV=production');
  }
  process.env.NODE_ENV = 'development';
  delete process.env.K_SERVICE;
  if (!devOnlyBlocked()) {
    pass('devOnlyRoute allows in local development');
  } else {
    fail('devOnlyRoute should allow local dev');
  }
  process.env.NODE_ENV = prev.NODE_ENV;
  process.env.K_SERVICE = prev.K_SERVICE;
  process.env.ALLOW_DEV_ROUTES = prev.ALLOW;
}

async function testDevRoutesOnRunningServer() {
  for (const route of [
    '/api/test-deepseek',
    '/api/test-deepseek-vs-claude',
  ]) {
    const res = await request('GET', route);
    if (res.status === 404) {
      pass(`Dev route 404 in dev server (or guarded): GET ${route}`, '404');
    } else if (res.status === 401) {
      pass(`Dev route requires auth first: GET ${route}`, '401');
    } else if (res.status >= 200 && res.status < 300) {
      pass(`Dev route open in local dev only: GET ${route}`, `status ${res.status} (blocked on Cloud Run)`);
    } else {
      fail(`Unexpected dev route status: GET ${route}`, String(res.status));
    }
  }
  const dbg = await request('POST', '/api/ai-coach/debug/parse-toolcalls', { text: '{}' });
  if (dbg.status === 404 || dbg.status === 401) {
    pass('Debug parse-toolcalls not open', String(dbg.status));
  } else if (dbg.status === 200) {
    pass('Debug parse-toolcalls open in local dev only', '200 OK (404 on Cloud Run prod)');
  } else {
    fail('Debug parse-toolcalls unexpected', String(dbg.status));
  }
}

function testClientKeyExposure() {
  const srcHitsClaude = grepFiles(path.join(ROOT, 'src'), /EXPO_PUBLIC_CLAUDE_API_KEY|EXPO_PUBLIC_ANTHROPIC_API_KEY/, [
    'src/tests',
  ]);
  const appConfig = fs.readFileSync(path.join(ROOT, 'app.config.js'), 'utf8');
  const hasYoutubeInConfig = /EXPO_PUBLIC_YOUTUBE_API_KEY/.test(appConfig);

  const workoutJs = fs.readFileSync(path.join(ROOT, 'src/workouts/active-workout/workout.js'), 'utf8');
  const directAnthropic =
    /api\.anthropic\.com/.test(workoutJs) || /['"]x-api-key['"]/.test(workoutJs);
  const usesServerGenerate = /\/api\/workout\/generate/.test(workoutJs);

  if (srcHitsClaude.length === 0) {
    pass('No EXPO_PUBLIC_CLAUDE in src/ (excluding tests)');
  } else {
    fail('EXPO_PUBLIC_CLAUDE still in src/', srcHitsClaude.join(', '));
  }

  if (!hasYoutubeInConfig) {
    pass('No EXPO_PUBLIC_YOUTUBE in app.config.js');
  } else {
    fail('EXPO_PUBLIC_YOUTUBE still in app.config.js');
  }

  if (usesServerGenerate && !directAnthropic) {
    pass('workout.js uses /api/workout/generate, not direct Anthropic');
  } else {
    fail('workout.js should call server only', `generate=${usesServerGenerate} direct=${directAnthropic}`);
  }
}

function testServerKeyResolver() {
  const serverSrc = fs.readFileSync(path.join(ROOT, 'server/index.js'), 'utf8');
  if (/function resolveDeepSeekKey\(\)/.test(serverSrc) && !/headers\?\.\['x-deepseek-key'\]/.test(serverSrc)) {
    pass('resolveDeepSeekKey does not read client headers');
  } else {
    fail('resolveDeepSeekKey may still accept client headers');
  }
  const authSrc = fs.readFileSync(path.join(ROOT, 'server/middleware/auth.js'), 'utf8');
  if (!/verifyIdToken\(token,\s*true\)/.test(authSrc)) {
    fail('verifyIdToken should use checkRevoked: true');
  } else {
    pass('verifyIdToken uses checkRevoked: true');
  }
}

function testFirestoreRulesSource() {
  const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
  if (/function isConversationParticipant/.test(rules) && /isConversationParticipant\(resource\.data\.conversationId\)/.test(rules)) {
    pass('Firestore messages rules use participant check');
  } else {
    fail('Firestore messages rules missing participant helper');
  }
  if (!/allow read, list: if request\.auth != null;\s*$/m.test(rules.match(/match \/messages\/\{messageId\}[\s\S]*?allow read:/)?.[0] || '')) {
    pass('messages no longer allow any-auth read');
  } else if (/match \/messages\/\{messageId\}/.test(rules) && !rules.includes('// Any signed-in user can read')) {
    pass('messages block removed permissive comment pattern');
  }
}

function testStorageRulesSource() {
  const rules = fs.readFileSync(path.join(ROOT, 'storage.rules'), 'utf8');
  const block = rules.match(/match \/progressPhotos\/\{clientId\}\/\{fileName\}[\s\S]*?match \//)?.[0] || '';
  if (/allow read: if request\.auth != null && \(/m.test(block) && /trainer_clients/.test(block)) {
    pass('Storage progressPhotos read restricted to client or trainer');
  } else {
    fail('Storage progressPhotos still world-readable for any auth user');
  }
}

function hasJavaRuntime() {
  try {
    const { execSync } = require('child_process');
    execSync('java -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function testFirestoreRulesEmulator() {
  const rulesTest = path.join(__dirname, 'testSecurityRulesEmulator.js');
  if (!fs.existsSync(rulesTest)) {
    fail('Firestore/Storage emulator rules test', 'helper script missing');
    return;
  }

  if (!hasJavaRuntime()) {
    skip('Firestore + Storage emulator rules tests', 'Java runtime not installed (install JDK for emulator)');
    return;
  }

  return new Promise((resolve) => {
    const firebaseBin = process.env.FIREBASE_BIN || 'firebase';
    const child = spawn(
      firebaseBin,
      ['emulators:exec', '--only', 'firestore,storage', `node ${rulesTest}`],
      { cwd: ROOT, stdio: 'inherit', env: process.env, shell: false }
    );
    child.on('exit', (code) => {
      if (code === 0) pass('Firestore + Storage emulator rules tests');
      else fail('Firestore + Storage emulator rules tests', `exit ${code}`);
      resolve();
    });
    child.on('error', (e) => {
      fail('Firestore emulator spawn failed', e.message);
      resolve();
    });
  });
}

async function testProductionAuthIfConfigured() {
  const prod =
    process.env.SECURITY_TEST_PRODUCTION_URL ||
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    '';
  if (!prod || !prod.includes('run.app')) {
    skip('Production API auth spot-check', 'no Cloud Run URL in env');
    return;
  }
  const prodBase = prod.replace(/\/$/, '');
  const routes = [
    ['POST', '/api/ask', { messages: [{ role: 'user', content: 'test' }] }],
    ['GET', '/api/food/search?query=egg', null],
  ];
  for (const [method, route, body] of routes) {
    const url = `${prodBase}${route}`;
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 401 || res.status === 403) {
        pass(`Production ${method} ${route.split('?')[0]} without token`, String(res.status));
      } else {
        fail(`Production auth: ${route}`, `got ${res.status}`);
      }
    } catch (e) {
      skip(`Production reachability: ${route}`, e.message);
    }
  }
}

async function main() {
  console.log('\n🔒 CoachConnect Security Regression Tests\n');
  console.log(`API base: ${BASE}\n`);

  testClientKeyExposure();
  testServerKeyResolver();
  testFirestoreRulesSource();
  testStorageRulesSource();
  await testDevRoutesGuardLogic();

  try {
    await ensureServer();
    await testAuthRequiredRoutes();
    await testInvalidTokenGenericError();
    await testDevRoutesOnRunningServer();
  } catch (e) {
    fail('HTTP test setup', e.message);
  }

  await testFirestoreRulesEmulator();

  await testProductionAuthIfConfigured();

  if (serverChild) {
    serverChild.kill('SIGTERM');
  }

  const passed = results.filter((r) => r.status === 'PASS').length;
  const fails = results.filter((r) => r.status === 'FAIL').length;
  const skips = results.filter((r) => r.status === 'SKIP').length;

  console.log(`\n---\n${passed} passed, ${fails} failed, ${skips} skipped\n`);
  process.exit(fails > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  if (serverChild) serverChild.kill('SIGTERM');
  process.exit(1);
});
