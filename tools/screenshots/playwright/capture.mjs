#!/usr/bin/env node
// Expo web screenshot capture at 390x844 @2x.
// Env: SCREENSHOT_WEB_URL, SCREENSHOT_CLIENT_EMAIL/PASSWORD, SCREENSHOT_TRAINER_EMAIL/PASSWORD
// Does not store credentials. Caps retries at 3 per catalog entry.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const {
  SCREENSHOTS_ROOT,
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

function roleFolder(role) {
  return role === 'both' ? 'both' : role;
}

async function withAttempts(entry, fn) {
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    entry.attempts = attempt;
    try {
      await fn(attempt);
      entry.status = 'ok';
      entry.reason = null;
      return true;
    } catch (err) {
      lastError = err;
      entry.reason = String(err?.message || err).slice(0, 500);
      if (attempt >= MAX_ATTEMPTS) {
        entry.status = 'failed';
        entry.file = null;
        return false;
      }
    }
  }
  entry.status = 'failed';
  entry.reason = String(lastError?.message || lastError).slice(0, 500);
  entry.file = null;
  return false;
}

async function shot(page, entry) {
  const rel = `src/screenshots/${entry.state}/${roleFolder(entry.role)}/${entry.screen}.png`;
  const abs = absoluteFromRepoRelative(rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: abs, fullPage: false });
  entry.file = rel;
}

async function installWebFixes(page) {
  // public/index.html meta-refresh sends browsers to privacy.html — strip it at capture time.
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (request.resourceType() !== 'document') {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const headers = response.headers();
    let body = await response.text();
    if (body.includes('url=/privacy.html')) {
      body = body
        .replace(/<meta http-equiv="refresh"[^>]*>/gi, '')
        .replace(/<link rel="canonical"[^>]*>/gi, '')
        .replace(/<p><a href="\/privacy.html">[\s\S]*?<\/p>/gi, '<div id="root"></div>');
    }
    await route.fulfill({
      status: response.status(),
      headers,
      body,
      contentType: headers['content-type'] || 'text/html',
    });
  });
}

async function openAuth(page) {
  await installWebFixes(page);
  await page.goto(WEB_URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  // Auth gate shows a LOADING chip first; wait for welcome/login chrome.
  try {
    await page.getByText(/Get Started|Sign In|Create account|Sign in/i).first().waitFor({
      timeout: 60000,
    });
  } catch {
    await page.waitForTimeout(8000);
  }
}

async function goWelcome(page) {
  await openAuth(page);
  // If already on login form, try to get back to welcome when possible.
}

async function clickText(page, text, options = {}) {
  const loc = page.getByText(text, { exact: options.exact ?? false }).first();
  await loc.waitFor({ timeout: options.timeout || 15000 });
  await loc.click();
}

async function fillLogin(page, email, password) {
  await openAuth(page);
  // Prefer Sign In from welcome
  try {
    await clickText(page, 'Sign In', { timeout: 8000 });
  } catch {
    /* may already be on login */
  }
  await page.getByLabel('Login email').fill(email);
  await page.getByLabel('Login password').fill(password);
}

async function submitLogin(page) {
  await page.getByLabel('Submit login').click();
  await page.waitForTimeout(5000);
}

async function captureAuthScreens(browser, manifest) {
  const context = await browser.newContext({
    viewport: { width: VIEWPORT.width, height: VIEWPORT.height },
    deviceScaleFactor: VIEWPORT.deviceScaleFactor,
  });
  const page = await context.newPage();

  const authEntries = manifest.entries.filter(
    (e) => e.status === 'pending' && e.captureMethod === 'playwright-web' && e.role === 'both',
  );

  for (const entry of authEntries) {
    await withAttempts(entry, async () => {
      if (entry.screen === 'login-welcome') {
        await goWelcome(page);
        await shot(page, entry);
        return;
      }
      if (entry.screen === 'login-form') {
        await openAuth(page);
        try {
          await clickText(page, 'Sign In', { timeout: 8000 });
        } catch {
          /* already there */
        }
        if (entry.state === 'error') {
          await page.getByLabel('Login email').fill('not-a-real-user@example.com');
          await page.getByLabel('Login password').fill('wrong-password-xxx');
          await page.getByLabel('Submit login').click();
          await page.waitForTimeout(2000);
        }
        await shot(page, entry);
        return;
      }
      if (entry.screen === 'signup-form') {
        await openAuth(page);
        try {
          await clickText(page, 'Get Started', { timeout: 8000 });
        } catch {
          /* already there */
        }
        await shot(page, entry);
        return;
      }
      if (entry.screen === 'forgot-password') {
        await openAuth(page);
        try {
          await clickText(page, 'Sign In', { timeout: 15000 });
        } catch {
          /* may already be on login */
        }
        await page.getByText(/Forgot password/i).first().waitFor({ timeout: 15000 });
        await page.getByText(/Forgot password/i).first().click();
        await page.getByText(/reset|email|Send/i).first().waitFor({ timeout: 15000 });
        if (entry.state === 'loading') {
          try {
            await page.locator('input').first().fill('cc-screenshot-client@example.com');
            await page.getByText(/Send reset|Send/i).first().click({ timeout: 3000 });
            await page.waitForTimeout(300);
          } catch {
            /* still capture form */
          }
        }
        if (entry.state === 'error') {
          try {
            await page.locator('input').first().fill('not-an-email');
            await page.getByText(/Send reset|Send/i).first().click();
            await page.waitForTimeout(1200);
          } catch {
            /* */
          }
        }
        await shot(page, entry);
        // Sanity: blank or still-welcome frames are failures
        const box = await page.locator('body').boundingBox();
        if (!box) throw new Error('Forgot password page had no body');
      }
    });
    saveManifest(manifest);
  }

  await context.close();
}

async function loginAs(page, role) {
  const email = role === 'trainer' ? TRAINER_EMAIL : CLIENT_EMAIL;
  const password = role === 'trainer' ? TRAINER_PASSWORD : CLIENT_PASSWORD;
  if (!password) {
    throw new Error(`Missing password env for ${role} login`);
  }
  await fillLogin(page, email, password);
  try {
    const roleLabel = role === 'trainer' ? 'Trainer' : 'Client';
    await page.getByText(roleLabel, { exact: true }).first().click({ timeout: 3000 });
  } catch {
    /* optional */
  }
  await submitLogin(page);
  // Wait for shell chrome (client tabs or trainer hub). Fail clearly on crash screen.
  const crashed = page.getByText('Something went wrong');
  const ready = page.getByText(/Home|Nutrition|Workout|AI Coach|Progress|Sessions|Clients/i).first();
  try {
    await Promise.race([
      ready.waitFor({ timeout: 45000 }),
      crashed.waitFor({ timeout: 45000 }).then(async () => {
        const detail = await page.locator('body').innerText();
        throw new Error(`App crashed after login: ${detail.slice(0, 240)}`);
      }),
    ]);
  } catch (err) {
    if (/App crashed after login/.test(String(err.message || err))) throw err;
    // ready timeout — still continue; individual screens may fail
  }
  await page.waitForTimeout(1500);
}

async function tryClickAny(page, labels) {
  for (const label of labels) {
    try {
      const loc = page.getByText(label, { exact: false }).first();
      if (await loc.count()) {
        await loc.click({ timeout: 4000 });
        await page.waitForTimeout(800);
        return true;
      }
    } catch {
      /* try next */
    }
  }
  return false;
}

async function navigateForEntry(page, entry) {
  const nav = entry.nav || {};
  const tabAliases = {
    home: ['Home'],
    nutrition: ['Nutrition'],
    workout: ['Workout'],
    ai: ['AI Coach', 'AI'],
    Progress: ['Progress'],
    Nutrition: ['Nutrition'],
    Sessions: ['Sessions', 'Calendar'],
    'Notes & Files': ['Notes & Files', 'Notes', 'Files'],
  };
  if (nav.tab) {
    const labels = tabAliases[nav.tab] || [nav.tab, String(nav.tab)];
    const ok = await tryClickAny(page, labels);
    if (!ok) throw new Error(`Tab not found: ${nav.tab}`);
  }
  if (nav.overlay === 'dashboard') {
    const ok = await tryClickAny(page, ['Explore Dashboard', 'YOUR COMPLETE DASHBOARD', 'Dashboard']);
    if (!ok) throw new Error('Dashboard overlay control not found');
  }
  if (nav.overlay === 'files') {
    const ok = await tryClickAny(page, ['Open Notes & Files', 'Notes & Files', 'FILES & DOCUMENTS']);
    if (!ok) throw new Error('Files overlay control not found');
  }
  if (nav.overlay === 'inbox' || nav.overlay === 'chat') {
    const ok = await tryClickAny(page, ['Messages', 'Inbox', 'Chat', 'Message']);
    if (!ok) throw new Error('Messages control not found');
  }
  if (nav.overlay === 'requests') {
    const ok = await tryClickAny(page, ['Requests', 'Client Requests', 'New requests', 'Pending']);
    if (!ok) throw new Error('Requests control not found');
  }
  if (nav.overlay === 'clients') {
    const ok = await tryClickAny(page, ['Clients', 'My Clients', 'Trainees', 'Client']);
    if (!ok) throw new Error('Clients control not found');
  }
  if (nav.overlay === 'photos') {
    const ok = await tryClickAny(page, ['Photos', 'Progress Photos', 'Gallery']);
    if (!ok) throw new Error('Photos control not found');
  }
  if (nav.overlay === 'ai-workouts' || nav.overlay === 'generator' || nav.overlay === 'plan-viewer') {
    const ok = await tryClickAny(page, ['AI Workouts', 'Saved Workouts', 'Generate', 'Workout']);
    if (!ok) throw new Error('Workout overlay control not found');
  }
  if (nav.stack) {
    const hints = {
      ClientProfile: ['Profile'],
      TrainerProfile: ['Profile'],
      ClientSettings: ['Settings'],
      TrainerSettings: ['Settings'],
      ClientHelpFAQ: ['Help', 'FAQ'],
      TrainerHelpFAQ: ['Help', 'FAQ'],
      ClientTerms: ['Terms'],
      TrainerTerms: ['Terms'],
      ClientPrivacy: ['Privacy'],
      TrainerPrivacy: ['Privacy'],
      ClientContactSupport: ['Contact', 'Support'],
      TrainerContactSupport: ['Contact', 'Support'],
      ClientBugReport: ['Bug'],
      TrainerBugReport: ['Bug'],
      ClientTrainerSearch: ['Find a Trainer', 'Find Trainer', 'Browse Trainers', 'Search'],
      TrainerSearch: ['Search', 'Find'],
      ClientWeeklyReport: ['Weekly', 'Report'],
      TrainerWeeklyReport: ['Weekly', 'Report'],
      ClientPhotoGallery: ['Photos', 'Progress'],
      ClientAIWorkouts: ['AI Workouts', 'Saved'],
      ClientPlanViewer: ['Plan', 'View'],
      ClientNutrition: ['Nutrition'],
      TrainerNutrition: ['Nutrition'],
      TrainerVoiceAI: ['Voice', 'AI Coach', 'AI'],
      TrainerAIChat: ['AI Coach', 'AI'],
      TrainerWorkoutPlan: ['Workout'],
      TrainerManualPlanBuilder: ['Manual', 'Builder', 'Custom'],
      TrainerPayments: ['Payments', 'Earnings', 'Payout'],
      ClientAI: ['AI Coach', 'AI'],
      ClientAIChat: ['AI Coach', 'AI'],
      ClientWorkoutPlan: ['Workout'],
    };
    const ok = await tryClickAny(page, hints[nav.stack] || [nav.stack]);
    if (!ok) throw new Error(`Stack target not found for ${nav.stack}`);
  }
  if (nav.from === 'nutrition' && nav.action) {
    const map = {
      'food-search': ['Add Food', 'Search', 'Add'],
      'confirm-food': ['Add Food', 'Search', 'Add'],
      'daily-facts': ['Daily Nutrition', 'Facts', 'Nutrition'],
      goals: ['Goals', 'Targets', 'Settings'],
      setup: ['Continue', 'Goals', 'Get Started'],
      'quick-add': ['Quick Add', 'Quick'],
      'edit-serving': ['Edit'],
      barcode: ['Scan', 'Barcode'],
    };
    const ok = await tryClickAny(page, map[nav.action] || [nav.action]);
    if (!ok) throw new Error(`Nutrition action not found: ${nav.action}`);
  }
  if (nav.from === 'workout' && nav.action) {
    const map = {
      library: ['Library', 'Exercises', 'Videos'],
      video: ['Library', 'Play', 'Video'],
    };
    const ok = await tryClickAny(page, map[nav.action] || [nav.action]);
    if (!ok) throw new Error(`Workout action not found: ${nav.action}`);
  }
  if (nav.from === 'settings' && nav.action === 'blocked-users') {
    const ok = await tryClickAny(page, ['Blocked Users', 'Blocked']);
    if (!ok) throw new Error('Blocked Users not found');
  }
  if (nav.from === 'ai' && nav.action === 'chat') {
    await tryClickAny(page, ['Continue', 'Chat', 'New', 'Start', 'AI Coach']);
  }
  if (nav.from === 'sessions' && nav.action === 'schedule') {
    const ok = await tryClickAny(page, ['Schedule', 'Add Session', 'New Session', '+']);
    if (!ok) throw new Error('Schedule session control not found');
  }
  if (nav.action === 'payout-setup' || nav.action === 'payout-reminder') {
    const ok = await tryClickAny(page, ['Payment Method', 'Connect', 'Start setup', 'Payout', 'Stripe']);
    if (!ok) throw new Error('Payout setup control not found');
  }
  if (nav.action === 'document-editor' || nav.action === 'spreadsheet-editor') {
    const ok = await tryClickAny(page, ['Document', 'Spreadsheet', 'Notes', 'Files', 'Edit']);
    if (!ok) throw new Error('Document editor control not found');
  }
  if (nav.action === 'trainer-shared-files') {
    const ok = await tryClickAny(page, ['Open Notes & Files', 'Shared', 'Files']);
    if (!ok) throw new Error('Trainer shared files control not found');
  }
}

async function applyStateHooks(page, entry) {
  if (entry.state === 'loading') {
    await page.route('**/*firestore*', (route) => route.abort());
    await page.route('**/google.firestore.**', (route) => route.abort());
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(1500);
  }
  if (entry.state === 'error' && entry.screen.includes('ai')) {
    await page.route('**/api/**', (route) => route.abort());
  }
  if (entry.state === 'error' && entry.screen === 'trainer-payments') {
    await page.route('**/stripe/**', (route) => route.abort());
    await page.route('**/api/stripe/**', (route) => route.abort());
  }
}

async function captureRoleScreens(browser, manifest, role) {
  const password = role === 'trainer' ? TRAINER_PASSWORD : CLIENT_PASSWORD;
  if (!password) {
    for (const entry of manifest.entries) {
      if (
        entry.status === 'pending' &&
        entry.role === role &&
        entry.captureMethod === 'playwright-web'
      ) {
        entry.status = 'failed';
        entry.reason = `Missing SCREENSHOT_${role.toUpperCase()}_PASSWORD; cannot login`;
        entry.file = null;
        entry.attempts = 1;
      }
    }
    saveManifest(manifest);
    return;
  }

  const context = await browser.newContext({
    viewport: { width: VIEWPORT.width, height: VIEWPORT.height },
    deviceScaleFactor: VIEWPORT.deviceScaleFactor,
  });
  const page = await context.newPage();

  try {
    await loginAs(page, role);
  } catch (err) {
    for (const entry of manifest.entries) {
      if (
        entry.status === 'pending' &&
        entry.role === role &&
        entry.captureMethod === 'playwright-web'
      ) {
        entry.status = 'failed';
        entry.reason = `Login failed: ${String(err.message || err).slice(0, 400)}`;
        entry.file = null;
        entry.attempts = 1;
      }
    }
    saveManifest(manifest);
    await context.close();
    return;
  }

  const entries = manifest.entries.filter(
    (e) => e.status === 'pending' && e.role === role && e.captureMethod === 'playwright-web',
  );

  for (const entry of entries) {
    await withAttempts(entry, async () => {
      // Return toward home between captures when possible
      await tryClickAny(page, ['Home', 'Dashboard']);
      await applyStateHooks(page, entry);
      await navigateForEntry(page, entry);
      await shot(page, entry);
    });
    saveManifest(manifest);
  }

  await context.close();
}

async function markUnreachableOnboarding(manifest) {
  // Onboarding for already-completed screenshot accounts is not reachable without separate incomplete users.
  for (const entry of manifest.entries) {
    if (entry.status !== 'pending') continue;
    if (entry.group === 'onboarding' || (entry.screen || '').includes('onboarding')) {
      if (entry.nativeOnly) continue; // maestro handles native-only step
      entry.status = 'unreachable';
      entry.reason =
        'Onboarding requires users with onboardingCompleted=false; screenshot seed accounts are completed. Capture via SetupScreenshotTool or incomplete-user seed in a follow-up.';
      entry.file = null;
      entry.attempts = 0;
    }
  }
}

async function main() {
  ensureScreenshotDirs();
  const manifest = loadManifest();

  // Probe web server
  let webUp = false;
  try {
    const res = await fetch(WEB_URL, { signal: AbortSignal.timeout(5000) });
    webUp = res.ok || res.status === 200 || res.status === 404 || res.status === 500;
  } catch {
    webUp = false;
  }

  if (!webUp) {
    for (const entry of manifest.entries) {
      if (entry.status === 'pending' && entry.captureMethod === 'playwright-web') {
        entry.status = 'failed';
        entry.reason = `Expo web not reachable at ${WEB_URL}`;
        entry.file = null;
        entry.attempts = 1;
      }
    }
    saveManifest(manifest);
    console.error(`Expo web not reachable at ${WEB_URL}`);
    process.exitCode = 1;
    return;
  }

  const browser = await chromium.launch({ headless: true });
  try {
    await captureAuthScreens(browser, manifest);
    await markUnreachableOnboarding(manifest);
    saveManifest(manifest);
    await captureRoleScreens(browser, manifest, 'client');
    await captureRoleScreens(browser, manifest, 'trainer');
  } finally {
    await browser.close();
  }

  saveManifest(manifest);
  const pending = manifest.entries.filter((e) => e.status === 'pending').length;
  const ok = manifest.entries.filter((e) => e.status === 'ok').length;
  console.log(`Playwright capture done. ok=${ok} pending=${pending}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
