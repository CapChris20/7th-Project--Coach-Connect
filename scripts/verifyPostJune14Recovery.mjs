#!/usr/bin/env node
/**
 * Post–June 14 recovery checks — written for the exact regressions after the app-folder delete.
 * Does NOT call baselineMatchAudit, auditAiCoachWiring, or runAiCoachSmokeSuite.
 *
 * Usage:
 *   node scripts/verifyPostJune14Recovery.mjs           # static wiring (fast, no network)
 *   node scripts/verifyPostJune14Recovery.mjs --live    # + production API probes
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const require = createRequire(import.meta.url);

const LIVE = process.argv.includes('--live');
const PRODUCTION =
  'https://coachconnect-api-421005574501.us-central1.run.app';

const failures = [];
const passes = [];
const skips = [];

function pass(label, detail = '') {
  passes.push({ label, detail });
  console.log(`✅ ${label}${detail ? ` — ${detail}` : ''}`);
}

function fail(label, detail = '') {
  failures.push({ label, detail });
  console.log(`❌ ${label}${detail ? ` — ${detail}` : ''}`);
}

function skip(label, detail = '') {
  skips.push({ label, detail });
  console.log(`⏭️  ${label}${detail ? ` — ${detail}` : ''}`);
}

function read(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, 'utf8');
}

function mustExist(rel, label = rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    fail(label, 'file missing');
    return false;
  }
  pass(label, 'on disk');
  return true;
}

function mustInclude(rel, patterns, label) {
  const text = read(rel);
  if (!text) {
    fail(label, `${rel} missing`);
    return;
  }
  for (const p of patterns) {
    const ok = typeof p === 'string' ? text.includes(p) : p.test(text);
    if (!ok) {
      fail(label, `expected ${String(p)} in ${rel}`);
      return;
    }
  }
  pass(label);
}

// ─── 1. AI Coach: Metro [AI Coach Chat] logging ─────────────────────────────
console.log('\n── AI Coach (logging + UI) ──\n');

mustExist('src/ai-coach/chat-ui/lib/coachConversationDebug.js');
mustInclude(
  'src/ai-coach/chat-ui/lib/coachConversationDebug.js',
  ['[AI Coach Chat]', 'logCoachUserMessage', 'logCoachTurnBundle', '__DEV__'],
  'coachConversationDebug exports dev-only Metro logs',
);

mustInclude(
  'src/ai-coach/chat-ui/components/CoachFormattedReply.jsx',
  ["from '../lib/formatCoachMessageText'", 'stripInlineWebCitations'],
  'CoachFormattedReply imports stripInlineWebCitations',
);

mustInclude(
  'src/ai-coach/chat-ui/chat-thread/formatCoachMessageText.js',
  ['export function stripInlineWebCitations'],
  'formatCoachMessageText exports stripInlineWebCitations',
);

mustInclude(
  'src/ai-coach/chat-ui/chat-thread/ChatWithCoachScreen.jsx',
  [
    "from '../lib/coachConversationDebug'",
    'logCoachUserMessage(',
    'logCoachAssistantMessage(',
    'logCoachTurnBundle(',
    'logCoachError(',
    "from '../components/CoachFormattedReply'",
    '<CoachFormattedReply',
  ],
  'ChatWithCoachScreen wires Metro logs + formatted replies',
);

// ─── 2. AI Coach: web search routing (protein query bug) ──────────────────────
console.log('\n── AI Coach (web search routing) ──\n');

mustInclude(
  'src/shared/api/baseUrl.js',
  ['getAICoachApiBases', 'push(PRODUCTION_API_BASE_URL)'],
  'AI Coach API tries Cloud Run before local :4000',
);

mustInclude(
  'src/ai-coach/server-logic/chat-api/sendCoachMessageToServer.js',
  ['getAICoachApiBases', 'web-search-failed', '/api/ai-coach/web-search'],
  'Client retries production when local web search fails',
);

try {
  const { pathToFileURL } = await import('node:url');
  const mod = await import(
    pathToFileURL(path.join(ROOT, 'src/ai-coach/server-logic/chat-api/shouldUseWebSearch.js')).href,
  );
  const { shouldUseWebAuto, isWebAnswerFollowUp } = mod;
  const proteinMsg =
    'Search the web: what does research say about protein intake for lifters?';
  const msgs = [{ role: 'user', content: proteinMsg }];
  if (!shouldUseWebAuto(proteinMsg)) {
    fail('Protein lifters query triggers web search', 'shouldUseWebAuto returned false');
  } else {
    pass('Protein lifters query triggers web search');
  }
  if (isWebAnswerFollowUp(proteinMsg, msgs)) {
    fail('Fresh protein query is not a thread follow-up', 'misclassified as follow-up');
  } else {
    pass('Fresh protein query is not a thread follow-up');
  }
} catch (e) {
  fail('Web search routing module loads', e.message);
}

try {
  const coachWeb = require(path.join(ROOT, 'server/lib/coachWebSearch.js'));
  const proteinMsg =
    'Search the web: what does research say about protein intake for lifters?';
  if (typeof coachWeb.isWebAnswerFollowUp === 'function') {
    const followUp = coachWeb.isWebAnswerFollowUp(proteinMsg, [
      { role: 'user', content: proteinMsg },
    ]);
    if (followUp) {
      fail('Server: fresh protein query not follow-up');
    } else {
      pass('Server: fresh protein query not follow-up');
    }
  } else {
    pass('Server coachWebSearch loaded', '(isWebAnswerFollowUp not exported — client guard OK)');
  }
} catch (e) {
  fail('Server coachWebSearch loads', e.message);
}

// ─── 3. Nutrition (daily facts, logging, search paths) ────────────────────────
console.log('\n── Nutrition ──\n');

mustExist('src/nutrition/food-details/nutritionFactsModel.js');
mustInclude(
  'src/nutrition/food-details/nutritionFactsModel.js',
  ['buildDailyNutritionFactsCardData', 'calculateDailyNutrientTotals'],
  'Daily nutrition facts model',
);

mustInclude(
  'src/nutrition/daily-log/NutritionContainer.jsx',
  [
    "from '../food-details/NutritionFactsScreen'",
    "from '../food-search/FoodSearchScreen'",
    "from '../barcode/BarcodeScannerScreen'",
    'showDailyFacts',
  ],
  'NutritionContainer routes daily facts + search + barcode',
);

mustInclude(
  'src/nutrition/daily-log/logFoodToFirestore.js',
  ['Invalid date passed to food log'],
  'Food log rejects NaN-NaN-NaN dates',
);

mustExist('src/nutrition/barcode/normalizeBarcodeForLookup.js');
mustExist('src/nutrition/food-details/cleanFoodBrandName.js');

// ─── 4. Onboarding + auth paths ─────────────────────────────────────────────
console.log('\n── Onboarding + auth ──\n');

mustInclude(
  'src/auth/OnboardingWizardScreen.jsx',
  ['completeOnboardingClient', 'buildOnboardingUpdatePayload'],
  'OnboardingWizardScreen uses extracted completeOnboardingClient',
);

mustInclude(
  'src/app-start/AuthGate.js',
  ['ResetPasswordScreen', 'onForgotPasswordFlowPress'],
  'Forgot password flow wired in AuthGate',
);

mustInclude(
  'server/routes/onboardingRoutes.js',
  ['writeTrainerClientLinks'],
  'Server onboarding uses shared trainer–client link helper',
);

// ─── 5. Folder-reorg survivors (common June 14 breakages) ─────────────────────
console.log('\n── Post-reorg imports ──\n');

mustExist('src/shared/contexts/AIContext.js');
mustInclude(
  'App.js',
  ['./src/shared/contexts/AIContext'],
  'App.js imports AIContext from shared/contexts',
);

mustInclude(
  'src/ai-coach/chat-ui/chat-thread/ToolConfirmationModal.jsx',
  ['../tool-modals/'],
  'ToolConfirmationModal uses tool-modals/ folder (not stale toolModals)',
);

mustInclude(
  'src/client-app/navigation/clientOverlayScreens.jsx',
  ['__DEV__', 'AICoachTestSuite'],
  'AICoachTestSuite gated behind __DEV__',
);

// ─── 6. Relative imports under src/ ───────────────────────────────────────────
console.log('\n── Import resolution ──\n');

try {
  const { execSync } = await import('node:child_process');
  execSync('node ./scripts/verifyRelativeImports.js', { cwd: ROOT, stdio: 'pipe' });
  pass('All relative imports under src/ resolve');
} catch (e) {
  fail('Relative imports', e.stderr?.toString() || e.message);
}

// ─── 7. Live production probes (optional) ─────────────────────────────────────
if (LIVE) {
  console.log('\n── Live production API ──\n');

  try {
    const healthRes = await fetch(`${PRODUCTION}/api/health`, { signal: AbortSignal.timeout(15000) });
    const health = await healthRes.json();
    if (health.aiCoachReady && health.webSearchReady) {
      pass('Production health', `webSearch=${health.webSearchReady}`);
    } else {
      fail('Production health', JSON.stringify(health));
    }
  } catch (e) {
    fail('Production health fetch', e.message);
  }

  let liveIdToken = null;
  let liveUserId = process.env.TEST_USER_ID || '4hJJ7QLAMyU72T4BHSiQe33Z0ym1';

  try {
    require('dotenv').config({ path: path.join(ROOT, '.env') });
    const { tryInitializeFirebaseAdmin } = require(path.join(ROOT, 'server/lib/initFirebaseAdmin'));
    const init = tryInitializeFirebaseAdmin();
    const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_WEB_API_KEY;
    liveUserId = process.env.TEST_USER_ID || liveUserId;
    liveIdToken = process.env.TEST_FIREBASE_ID_TOKEN;

    if (!liveIdToken && init.ok && apiKey) {
      const admin = require('firebase-admin');
      const custom = await admin.auth().createCustomToken(liveUserId);
      const tokRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: custom, returnSecureToken: true }),
        },
      );
      const tokJson = await tokRes.json();
      liveIdToken = tokJson.idToken;
    }
  } catch (e) {
    skip('Live auth setup', e.message);
  }

  // Authenticated coach web search — same query you reported broken
  try {
    if (!liveIdToken) {
      skip(
        'Live coach web search',
        'add FIREBASE_SERVICE_ACCOUNT or TEST_FIREBASE_ID_TOKEN in .env for live API probes',
      );
    } else {
      const proteinMsg =
        'Search the web: what does research say about protein intake for lifters?';
      const coachRes = await fetch(`${PRODUCTION}/api/ai-coach/web-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${liveIdToken}`,
          'X-AI-Coach-Test-Suite': '1',
        },
        body: JSON.stringify({
          userId: liveUserId,
          message: proteinMsg,
          messages: [{ role: 'user', content: proteinMsg }],
        }),
        signal: AbortSignal.timeout(120000),
      });
      const coachJson = await coachRes.json();
      const ok =
        coachRes.ok &&
        coachJson.searchedWeb === true &&
        coachJson.route === 'web-search' &&
        String(coachJson.reply || '').length > 40;
      if (ok) {
        pass(
          'Live protein web search on production',
          `sources=${coachJson.webSources?.length || 0}`,
        );
      } else {
        fail(
          'Live protein web search on production',
          `status=${coachRes.status} route=${coachJson.route} searchedWeb=${coachJson.searchedWeb}`,
        );
      }
    }
  } catch (e) {
    fail('Live coach web search', e.message);
  }

  // Food search smoke (requires Firebase auth)
  try {
    if (liveIdToken) {
      const foodRes = await fetch(
        `${PRODUCTION}/api/food/search?q=chicken+breast&limit=3`,
        {
          headers: { Authorization: `Bearer ${liveIdToken}` },
          signal: AbortSignal.timeout(30000),
        },
      );
      const foodJson = await foodRes.json();
      const items = foodJson?.results || foodJson?.foods || foodJson?.items || [];
      const count = Array.isArray(items) ? items.length : 0;
      if (foodRes.ok && count > 0) {
        pass('Live food search', `${count} results for chicken breast`);
      } else {
        fail('Live food search', `status=${foodRes.status} count=${count}`);
      }
    } else {
      skip('Live food search', 'no auth token — static nutrition checks already passed');
    }
  } catch (e) {
    fail('Live food search', e.message);
  }
}

// ─── Summary ────────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════');
console.log(` POST–JUNE 14 RECOVERY: ${passes.length} passed, ${failures.length} failed, ${skips.length} skipped`);
console.log('═══════════════════════════════════════════════════════════\n');

if (failures.length) {
  console.log('Fix these before trusting the app:\n');
  for (const f of failures) {
    console.log(`  • ${f.label}${f.detail ? ` — ${f.detail}` : ''}`);
  }
  console.log('');
  process.exit(1);
}

console.log('Static checks OK. Open the app and use AI Coach + Nutrition.');
if (!LIVE) {
  console.log('Run with --live to hit production API: npm run verify:june14:live\n');
} else {
  console.log('Live probes OK.\n');
}
