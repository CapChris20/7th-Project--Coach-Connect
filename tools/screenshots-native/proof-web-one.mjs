#!/usr/bin/env node
/**
 * Proof: one empty-state FULL-PAGE web screenshot via Playwright.
 * Why web: native Maestro needs a healthy Metro→simulator link; that kept dying here.
 * Capture method is playwright-web (stated in the tiny manifest).
 *
 * Usage: node tools/screenshots-native/proof-web-one.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'src/screenshots/empty/both');
const OUT_FILE = path.join(OUT_DIR, 'login-welcome--full.png');
const MANIFEST = path.join(ROOT, 'src/screenshots/manifest.proof.json');
const WEB_URL = process.env.SCREENSHOT_WEB_URL || 'http://127.0.0.1:8081';

async function stripPrivacyRedirect(page) {
  // public/index.html meta-refresh sends browsers to privacy.html — strip for capture.
  await page.route('**/*', async (route) => {
    const req = route.request();
    if (req.resourceType() !== 'document') {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    let body = await response.text();
    const headers = { ...response.headers() };
    if (body.includes('url=/privacy.html')) {
      body = body
        .replace(/<meta http-equiv="refresh"[^>]*>/gi, '')
        .replace(/<link rel="canonical"[^>]*>/gi, '');
    }
    await route.fulfill({ status: response.status(), headers, body });
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await stripPrivacyRedirect(page);

  console.log('Opening', WEB_URL);
  await page.goto(WEB_URL, { waitUntil: 'networkidle', timeout: 180_000 });

  // Wait for painted welcome / auth UI (not privacy page, not blank).
  await page.waitForTimeout(2500);
  const bodyText = await page.locator('body').innerText().catch(() => '');
  console.log('Visible text sample:', bodyText.slice(0, 200).replace(/\n/g, ' | '));

  // Prefer clicking into welcome if needed
  const getStarted = page.getByText(/Get Started/i).first();
  const signIn = page.getByText(/Sign In/i).first();
  if (await getStarted.isVisible().catch(() => false)) {
    console.log('Found Get Started — capturing welcome full page');
  } else if (await signIn.isVisible().catch(() => false)) {
    console.log('Found Sign In — capturing that surface full page');
  } else {
    console.log('Auth labels not found yet — capturing whatever painted');
  }

  // FULL page = Playwright scrolls and stitches the entire scrollable document.
  await page.screenshot({ path: OUT_FILE, fullPage: true });
  const size = fs.statSync(OUT_FILE).size;

  const entry = {
    screen: 'login-welcome',
    role: 'both',
    state: 'empty',
    route: null,
    file: 'src/screenshots/empty/both/login-welcome--full.png',
    status: size > 40_000 ? 'ok' : 'failed',
    reason: size > 40_000 ? null : `file too small (${size})`,
    captureMethod: 'playwright-web',
    scrollIndex: 'fullPage',
    note: 'Proof shot: fullPage:true captures the entire scrollable page in one PNG.',
    bytes: size,
  };

  fs.writeFileSync(
    MANIFEST,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        captureMethodDefault: 'playwright-web',
        notes: [
          'PROOF ONLY — one empty-state full-page web screenshot.',
          'Native Maestro was blocked by Metro/simulator load failures on this machine.',
          'Web used because user asked to try web; fullPage stitches the whole scroll.',
        ],
        entries: [entry],
      },
      null,
      2,
    ),
  );

  await browser.close();
  console.log('Wrote', entry.file, `(${size} bytes)`, entry.status);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
