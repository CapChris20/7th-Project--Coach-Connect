#!/usr/bin/env node
// Live-account capture with coordinate taps for RN-web bottom tabs.
// Env: SCREENSHOT_* + SCREENSHOT_WEB_URL. Does not wipe Firestore.

import fs from 'fs';
import { createRequire } from 'module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const {
  VIEWPORT,
  MAX_ATTEMPTS,
  DEFAULT_WEB_URL,
  CLIENT_EMAIL,
  TRAINER_EMAIL,
} = require('../lib/constants');
const { loadManifest, saveManifest, absoluteFromRepoRelative, ensureScreenshotDirs } = require('../lib/manifest');

const WEB_URL = process.env.SCREENSHOT_WEB_URL || DEFAULT_WEB_URL;
const CLIENT_PASSWORD = process.env.SCREENSHOT_CLIENT_PASSWORD || '';
const TRAINER_PASSWORD = process.env.SCREENSHOT_TRAINER_PASSWORD || '';

// Bottom tab centers for 390x844 client shell (Home / Workout / + / AI Coach / Nutrition).
const CLIENT_TABS = {
  home: { x: 39, y: 800 },
  workout: { x: 117, y: 800 },
  plus: { x: 195, y: 790 },
  ai: { x: 273, y: 800 },
  nutrition: { x: 351, y: 800 },
};

const WEB_HEIGHT_CSS = `
  html, body, #root { height: 100% !important; min-height: 100vh !important; width: 100% !important; }
  #root, #root > div, #root > div > div { height: 100% !important; min-height: 100vh !important; }
`;

async function installWebFixes(page) {
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (request.resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    let body = await response.text();
    if (body.includes('url=/privacy.html')) {
      body = body
        .replace(/<meta http-equiv="refresh"[^>]*>/gi, '')
        .replace(/<p><a href="\/privacy.html">[\s\S]*?<\/p>/gi, '<div id="root"></div>');
    }
    await route.fulfill({
      status: response.status(),
      headers: response.headers(),
      body,
      contentType: response.headers()['content-type'] || 'text/html',
    });
  });
}

async function forceWebLayoutHeight(page) {
  // RN-web logged-in shell collapses to height 0 unless html/body/#root have explicit height.
  await page.addStyleTag({ content: WEB_HEIGHT_CSS });
}

async function tap(page, x, y) {
  await page.mouse.click(x, y);
  await page.waitForTimeout(900);
}

async function clickText(page, labels, timeout = 2500) {
  for (const label of labels) {
    try {
      const loc = page.getByText(label, { exact: false }).first();
      await loc.waitFor({ timeout });
      await loc.click({ timeout });
      await page.waitForTimeout(700);
      return true;
    } catch {
      /* next */
    }
  }
  return false;
}

async function bodyHas(page, re) {
  const t = await page.locator('body').innerText();
  return re.test(t);
}

async function shot(page, state, role, screen) {
  const rel = `src/screenshots/${state}/${role}/${screen}.png`;
  const abs = absoluteFromRepoRelative(rel);
  fs.mkdirSync(require('path').dirname(abs), { recursive: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: abs, fullPage: false });
  return rel;
}

function mark(manifest, screen, role, state, patch) {
  const entry = manifest.entries.find((e) => e.screen === screen && e.role === role && e.state === state);
  if (!entry) return;
  Object.assign(entry, patch);
}

async function captureOne(page, manifest, { screen, role, state, fn }) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const file = await fn();
      // Reject blank/header-only frames
      const abs = absoluteFromRepoRelative(file);
      const size = fs.statSync(abs).size;
      if (size < 25000) {
        throw new Error(`Screenshot too small (${size} bytes) — likely blank/loading`);
      }
      mark(manifest, screen, role, state, {
        status: 'ok',
        reason: null,
        file,
        attempts: attempt,
        captureMethod: 'playwright-web',
      });
      saveManifest(manifest);
      console.log('ok', state, role, screen, `${size}b`);
      return true;
    } catch (err) {
      mark(manifest, screen, role, state, {
        status: attempt >= MAX_ATTEMPTS ? 'failed' : 'pending',
        reason: String(err.message || err).slice(0, 400),
        attempts: attempt,
        file: null,
      });
      saveManifest(manifest);
      if (attempt >= MAX_ATTEMPTS) {
        console.log('failed', state, role, screen, String(err.message || err).slice(0, 140));
        return false;
      }
    }
  }
  return false;
}

async function login(page, role) {
  await installWebFixes(page);
  await page.goto(WEB_URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await forceWebLayoutHeight(page);
  await page.getByText(/Get Started|Sign In|Sign in/i).first().waitFor({ timeout: 90000 });
  await clickText(page, ['Sign In'], 8000);
  await page.waitForTimeout(400);
  await clickText(page, [role === 'trainer' ? 'Trainer' : 'Client'], 3000);
  await page.getByLabel('Login email').fill(role === 'trainer' ? TRAINER_EMAIL : CLIENT_EMAIL);
  await page.getByLabel('Login password').fill(role === 'trainer' ? TRAINER_PASSWORD : CLIENT_PASSWORD);
  await page.getByLabel('Submit login').click();
  await page.waitForTimeout(2000);
  await forceWebLayoutHeight(page);
  for (let i = 0; i < 40; i += 1) {
    await page.waitForTimeout(500);
    const t = await page.locator('body').innerText();
    if (/Something went wrong/i.test(t)) throw new Error(`Crash after login: ${t.slice(0, 200)}`);
    if (/Good Morning|Active Clients|Nutrition|Workout|AI Coach|Progress|Sessions/i.test(t)) break;
  }
  await forceWebLayoutHeight(page);
  await page.waitForTimeout(1500);
  const ready = await page.locator('body').innerText();
  if (!/Good Morning|Active Clients|CLIENTS|Coach Connect/i.test(ready)) {
    throw new Error(`Shell not ready: ${ready.slice(0, 200)}`);
  }
}

async function captureClient(browser, manifest) {
  const context = await browser.newContext({
    viewport: { width: VIEWPORT.width, height: VIEWPORT.height },
    deviceScaleFactor: VIEWPORT.deviceScaleFactor,
  });
  const page = await context.newPage();
  await login(page, 'client');

  const flows = [
    {
      screen: 'client-home',
      run: async () => {
        await tap(page, CLIENT_TABS.home.x, CLIENT_TABS.home.y);
        if (!(await bodyHas(page, /Good Morning|WELCOME TO|TODAY/i))) {
          throw new Error('Home content missing');
        }
      },
    },
    {
      screen: 'client-dashboard',
      run: async () => {
        await tap(page, CLIENT_TABS.home.x, CLIENT_TABS.home.y);
        // Scroll down to dashboard card then click
        for (let i = 0; i < 6; i += 1) {
          await page.mouse.wheel(0, 500);
          await page.waitForTimeout(200);
        }
        if (!(await clickText(page, ['Explore Dashboard', 'YOUR COMPLETE DASHBOARD'], 2000))) {
          // try mid-screen tap on dashboard card area after scroll
          await tap(page, 200, 420);
        }
        await page.waitForTimeout(800);
      },
    },
    {
      screen: 'client-files',
      run: async () => {
        await tap(page, CLIENT_TABS.home.x, CLIENT_TABS.home.y);
        for (let i = 0; i < 10; i += 1) {
          await page.mouse.wheel(0, 700);
          await page.waitForTimeout(150);
        }
        if (!(await clickText(page, ['Open Notes & Files', 'Notes & Files', 'FILES & DOCUMENTS'], 2000))) {
          throw new Error('Files CTA not found after scroll');
        }
      },
    },
    {
      screen: 'client-nutrition',
      run: async () => {
        await tap(page, CLIENT_TABS.nutrition.x, CLIENT_TABS.nutrition.y);
        if (!(await bodyHas(page, /Breakfast|Calories|Add Food|Goals|Meal|Nutrition/i))) {
          throw new Error('Nutrition content missing');
        }
      },
    },
    {
      screen: 'client-food-search',
      run: async () => {
        await tap(page, CLIENT_TABS.nutrition.x, CLIENT_TABS.nutrition.y);
        if (!(await clickText(page, ['Add Food', 'Search', '+'], 2500))) {
          // plus-ish area
          await tap(page, 350, 120);
        }
        await page.waitForTimeout(800);
      },
    },
    {
      screen: 'client-workout',
      run: async () => {
        await tap(page, CLIENT_TABS.workout.x, CLIENT_TABS.workout.y);
        if (!(await bodyHas(page, /Workout|Plan|Library|Generate|Exercise/i))) {
          throw new Error('Workout content missing');
        }
      },
    },
    {
      screen: 'client-ai',
      run: async () => {
        await tap(page, CLIENT_TABS.ai.x, CLIENT_TABS.ai.y);
        if (!(await bodyHas(page, /AI|Coach|Chat|Ask/i))) {
          throw new Error('AI content missing');
        }
      },
    },
    {
      screen: 'client-settings',
      run: async () => {
        await tap(page, CLIENT_TABS.home.x, CLIENT_TABS.home.y);
        // gear icon top-right
        await tap(page, 360, 48);
        await page.waitForTimeout(800);
        if (!(await bodyHas(page, /Settings|Account|Logout|Sign Out|Privacy|Help/i))) {
          throw new Error('Settings content missing');
        }
      },
    },
  ];

  for (const state of ['with-food', 'empty']) {
    for (const flow of flows) {
      await captureOne(page, manifest, {
        screen: flow.screen,
        role: 'client',
        state,
        fn: async () => {
          await flow.run();
          return shot(page, state, 'client', flow.screen);
        },
      });
    }
  }

  await captureOne(page, manifest, {
    screen: 'client-nutrition',
    role: 'client',
    state: 'loading',
    fn: async () => {
      await page.route('**/*firestore*', (route) => route.abort());
      await tap(page, CLIENT_TABS.nutrition.x, CLIENT_TABS.nutrition.y);
      await page.waitForTimeout(700);
      const file = await shot(page, 'loading', 'client', 'client-nutrition');
      await page.unroute('**/*firestore*');
      return file;
    },
  });

  await context.close();
}

async function captureTrainer(browser, manifest) {
  const context = await browser.newContext({
    viewport: { width: VIEWPORT.width, height: VIEWPORT.height },
    deviceScaleFactor: VIEWPORT.deviceScaleFactor,
  });
  const page = await context.newPage();
  await login(page, 'trainer');

  const selectFirstClient = async () => {
    // Prefer named client from live roster
    if (await clickText(page, ['Cade Cunningham', 'Cade', 'Cap20', 'Active Clients'], 2500)) {
      await page.waitForTimeout(800);
      return;
    }
    // Tap first client card region
    await tap(page, 200, 520);
  };

  const flows = [
    {
      screen: 'trainer-home',
      run: async () => {
        if (!(await bodyHas(page, /Active Clients|CLIENTS|Pending Requests/i))) {
          throw new Error('Trainer home missing');
        }
      },
    },
    {
      screen: 'trainer-clients',
      run: async () => {
        if (!(await clickText(page, ['All Clients', 'CLIENTS', 'Active Clients'], 2500))) {
          throw new Error('Clients control missing');
        }
      },
    },
    {
      screen: 'trainer-requests',
      run: async () => {
        if (!(await clickText(page, ['Client Requests', 'Pending Requests', 'Requests'], 2500))) {
          throw new Error('Requests control missing');
        }
      },
    },
    {
      screen: 'trainer-progress',
      run: async () => {
        await selectFirstClient();
        if (!(await clickText(page, ['Progress'], 2500))) throw new Error('Progress tab missing');
      },
    },
    {
      screen: 'trainer-nutrition-tab',
      run: async () => {
        await selectFirstClient();
        if (!(await clickText(page, ['Nutrition'], 2500))) throw new Error('Nutrition tab missing');
      },
    },
    {
      screen: 'trainer-sessions',
      run: async () => {
        await selectFirstClient();
        if (!(await clickText(page, ['Sessions', 'Calendar'], 2500))) throw new Error('Sessions missing');
      },
    },
    {
      screen: 'trainer-notes-files',
      run: async () => {
        await selectFirstClient();
        if (!(await clickText(page, ['Notes & Files', 'Notes'], 2500))) throw new Error('Notes missing');
      },
    },
    {
      screen: 'trainer-weekly-report',
      run: async () => {
        if (!(await clickText(page, ['WEEKLY REPORT', 'Weekly', "Cade's reports", 'reports'], 2500))) {
          throw new Error('Weekly report missing');
        }
      },
    },
    {
      screen: 'trainer-settings',
      run: async () => {
        await tap(page, 360, 48);
        await page.waitForTimeout(800);
        if (!(await bodyHas(page, /Settings|Account|Logout|Sign Out|Privacy|Help/i))) {
          throw new Error('Settings missing');
        }
      },
    },
  ];

  for (const state of ['with-food', 'empty']) {
    for (const flow of flows) {
      await captureOne(page, manifest, {
        screen: flow.screen,
        role: 'trainer',
        state,
        fn: async () => {
          await flow.run();
          return shot(page, state, 'trainer', flow.screen);
        },
      });
    }
  }

  await captureOne(page, manifest, {
    screen: 'trainer-home',
    role: 'trainer',
    state: 'loading',
    fn: async () => {
      await page.route('**/*firestore*', (route) => route.abort());
      await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(1200);
      const file = await shot(page, 'loading', 'trainer', 'trainer-home');
      await page.unroute('**/*firestore*');
      return file;
    },
  });

  await context.close();
}

async function main() {
  ensureScreenshotDirs();
  const manifest = loadManifest();
  if (!CLIENT_PASSWORD || !TRAINER_PASSWORD) throw new Error('SCREENSHOT_*_PASSWORD required');

  const browser = await chromium.launch({ headless: true });
  try {
    await captureClient(browser, manifest);
    await captureTrainer(browser, manifest);
  } finally {
    await browser.close();
  }

  for (const e of manifest.entries) {
    if (e.status === 'pending' && e.captureMethod === 'playwright-web' && e.role !== 'both') {
      e.status = 'failed';
      e.reason = e.reason || 'Not covered by focused live capture path; needs deeper nav or Maestro';
      e.file = null;
      e.attempts = e.attempts || 1;
    }
  }
  saveManifest(manifest);
  const counts = manifest.entries.reduce((a, e) => {
    a[e.status] = (a[e.status] || 0) + 1;
    return a;
  }, {});
  console.log('live capture counts', counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
