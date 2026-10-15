// Reads every src/**/*.js(x) file and guesses whether it belongs in a nested
// backend/ subfolder (Firestore reads/writes, API calls, AI-reply parsing, pure
// business logic) or should stay where it is (renders JSX, or is a UI-only
// support file like colors/constants with no data logic).
//
// This does NOT move any files. It only prints/report a proposal so a human
// can review it before anything gets moved and imports get rewritten.
//
// Usage: node scripts/classifyBackendVsFrontend.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { createRequire } from 'node:module';

const requireFromRepo = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), '../package.json'),
);
const { parse } = requireFromRepo('@babel/parser');
const traverseModule = requireFromRepo('@babel/traverse');
const traverse = traverseModule.default || traverseModule;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

const PLUGINS = [
  'jsx',
  'classProperties',
  'optionalChaining',
  'nullishCoalescingOperator',
  'objectRestSpread',
  'exportDefaultFrom',
];

// Signals that suggest "this file manages data", regardless of JSX.
const BACKEND_SIGNAL_PATTERNS = [
  /firebase\/(firestore|auth|storage|functions)/,
  /from ['"].*firebaseConfig['"]/,
  /\bgetFirestore\(/,
  /\bcollection\(/,
  /\bdoc\(/,
  /\bonSnapshot\(/,
  /\bgetDocs?\(/,
  /\bsetDoc\(/,
  /\baddDoc\(/,
  /\bupdateDoc\(/,
  /\bdeleteDoc\(/,
  /\bwriteBatch\(/,
  /\bfetch\(/,
  /\baxios\b/,
  /AsyncStorage/,
  /apiBase|API_BASE|getApiBase/,
  /JSON\.parse\(/,
  /\bAbortController\b/,
];

// Filename patterns that are almost always pure UI-support (not "backend" even
// though they hold no JSX) — colors, icon maps, layout constants, style tokens.
const UI_SUPPORT_NAME_PATTERNS = [
  /colors?\.js$/i,
  /theme\.js$/i,
  /styles?\.js$/i,
  /icons?\.js$/i,
  /constants\.js$/i,
  /spacing\.js$/i,
];

function listSourceFiles(dirPath) {
  const out = [];
  const require2 = createRequire(import.meta.url);
  const fs = require2('node:fs');
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.name === '__tests__') continue;
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(fullPath));
    } else if (/\.(js|jsx)$/.test(entry.name)) {
      out.push(fullPath);
    }
  }
  return out;
}

function hasJsxInFile(sourceText) {
  try {
    const ast = parse(sourceText, { sourceType: 'unambiguous', plugins: PLUGINS });
    let found = false;
    traverse(ast, {
      JSXElement() {
        found = true;
      },
      JSXFragment() {
        found = true;
      },
    });
    return found;
  } catch {
    // If it won't even parse, flag it for manual look rather than guessing.
    return null;
  }
}

// A "real logic" function has a block body AND does actual work inside it
// (a branch, a loop, or a data-transform call) — not just "return someConst".
// Used to tell "this file computes/validates/transforms data" (= backend-ish
// business logic, no Firestore call needed to count) apart from "this file is
// just a table of fixed values" (= a constants/asset file, stays put).
const LOGIC_BODY_SIGNS = [
  /\bif\s*\(/,
  /\bfor\s*\(/,
  /\bwhile\s*\(/,
  /\bswitch\s*\(/,
  /\.filter\(/,
  /\.map\(/,
  /\.reduce\(/,
  /\.replace\(/,
  /\.match\(/,
  /\.split\(/,
  /\.sort\(/,
  /\.toFixed\(/,
  /\btry\s*{/,
];
const RAW_ASSET_SIGNS = [/<svg[\s>]/i, /<path[\s>]/i, /xmlns=/i];

// Hand-read calls for the files the auto-signals couldn't confidently place
// (checked one by one on 2026-10-10 per Chris's "just read the code" rule).
// BACKEND = Firestore-adjacent hooks, pure business logic/parsing, no render.
// FRONTEND = UI behavior hooks, navigation glue, style/asset/constant tables.
// BARREL = re-exports a mix of both; stays put, only its imports get fixed.
const MANUAL_OVERRIDES = {
  'src/ai-coach/coach-actions/cleanUpActionDetails.js': 'BACKEND',
  'src/ai-coach/coach-actions/popupOrAutoRun.js': 'BACKEND',
  'src/ai-coach/coach-knowledge/decideWhatCoachShouldKnow.js': 'BACKEND',
  'src/ai-coach/reply-display/copyableReplyText.js': 'BACKEND',
  'src/block-and-report/blockedList.js': 'BACKEND',
  'src/daily-stats/todaysDate.js': 'BACKEND',
  'src/for-both/cloud-database/handleLiveUpdateErrors.js': 'BACKEND',
  'src/for-both/online-connection/attachLoginProof.js': 'BACKEND',
  'src/for-both/online-connection/sendCrashReport.js': 'BACKEND',
  'src/helpers/getLocalDay.js': 'BACKEND',
  'src/login-and-signup/cleanUpRoleName.js': 'BACKEND',
  'src/notifications/unreadAlertCount.js': 'BACKEND',
  'src/nutrition/barcode/rejectBadBarcodeResults.js': 'BACKEND',
  'src/nutrition/barcode/scannedProductSummary.js': 'BACKEND',
  'src/spreadsheet-support/spreadsheetReader.js': 'BACKEND',
  'src/spreadsheet-support/spreadsheetReader.native.js': 'BACKEND',
  'src/spreadsheet-support/spreadsheetReader.web.js': 'BACKEND',
  'src/trainer-app/my-trainees/traineeList.js': 'BACKEND',
  'src/trainer-app/progress-tab/pickWeightToShow.js': 'BACKEND',
  'src/trainer-app/trainee-records/calmDatabaseErrors.js': 'BACKEND',
  'src/trainer-pro-plan/proAccessRules.js': 'BACKEND',
  'src/workouts/create-plan/workoutPlanCreation.js': 'BACKEND',

  'src/ai-coach/conversation/_voiceStub.js': 'FRONTEND',
  'src/ai-coach/conversation/keyboardBehavior.js': 'FRONTEND',
  'src/ai-coach/conversation/openPhotoMenu.js': 'FRONTEND',
  'src/assets/logo/brandLogo.js': 'FRONTEND',
  'src/block-and-report/reportReasons.js': 'FRONTEND',
  'src/client-app/home/homeLooks.js': 'FRONTEND',
  'src/client-app/navigation/goToClientScreen.js': 'FRONTEND',
  'src/for-both/icons/iconShapes.js': 'FRONTEND',
  'src/for-both/profileCardIconSizes.js': 'FRONTEND',
  'src/for-both/screenReaderLabels.js': 'FRONTEND',
  'src/for-both/setup-icons/onboardingIconRegistry.generated.js': 'FRONTEND',
  'src/look-and-feel/colorPalette.js': 'FRONTEND',
  'src/look-and-feel/glassSettings.js': 'FRONTEND',
  'src/navigation/goToScreenByKeyword.js': 'FRONTEND',
  'src/navigation/openScreenFromAnywhere.js': 'FRONTEND',
  'src/navigation/screenNames.js': 'FRONTEND',
  'src/navigation/webLinks.js': 'FRONTEND',
  'src/settings/emailSupport.js': 'FRONTEND',
  'src/settings/supportContact.js': 'FRONTEND',
  'src/trainer-app/documents/pageStylePresets.js': 'FRONTEND',
  'src/trainer-app/navigation/goToTrainerScreen.js': 'FRONTEND',
  'src/trainer-pro-plan/proPlanStatus.js': 'FRONTEND',
  'src/trainer-pro-plan/proPlanSwitches.js': 'FRONTEND',
  'src/workouts/view-plan/planViewPieces.jsx': 'FRONTEND',

  'src/block-and-report/index.js': 'BARREL',
};

function classify(absPath, sourceText) {
  const relPath = relative(ROOT, absPath);

  if (MANUAL_OVERRIDES[relPath]) {
    return { relPath, bucket: MANUAL_OVERRIDES[relPath], reason: 'manually read and classified' };
  }

  const jsx = hasJsxInFile(sourceText);

  if (jsx === null) {
    return { relPath, bucket: 'PARSE-ERROR', reason: 'could not parse' };
  }
  if (jsx) {
    return { relPath, bucket: 'FRONTEND', reason: 'renders JSX' };
  }

  const fileNameOnly = relPath.split('/').pop();
  const matchedSignal = BACKEND_SIGNAL_PATTERNS.find((pattern) => pattern.test(sourceText));
  if (matchedSignal) {
    return { relPath, bucket: 'BACKEND', reason: `matched ${matchedSignal}` };
  }

  if (RAW_ASSET_SIGNS.some((pattern) => pattern.test(sourceText))) {
    return { relPath, bucket: 'UI-SUPPORT', reason: 'raw SVG/icon markup, not logic' };
  }

  const isUiSupportName = UI_SUPPORT_NAME_PATTERNS.some((pattern) => pattern.test(fileNameOnly));
  if (isUiSupportName) {
    return { relPath, bucket: 'UI-SUPPORT', reason: 'no JSX, no data signal, name looks like style/constants' };
  }

  const logicHitCount = LOGIC_BODY_SIGNS.filter((pattern) => pattern.test(sourceText)).length;
  if (logicHitCount >= 2) {
    return { relPath, bucket: 'BACKEND', reason: `pure logic/calculation (${logicHitCount} control/transform signs, no UI)` };
  }

  return { relPath, bucket: 'AMBIGUOUS', reason: 'no JSX, no data signal, needs a human read' };
}

const files = listSourceFiles(SRC).sort();
const results = files.map((absPath) => classify(absPath, readFileSync(absPath, 'utf8')));

const buckets = { FRONTEND: [], BACKEND: [], 'UI-SUPPORT': [], BARREL: [], AMBIGUOUS: [], 'PARSE-ERROR': [] };
for (const result of results) {
  buckets[result.bucket].push(result);
}

console.log(`Total files scanned: ${results.length}\n`);
for (const bucketName of Object.keys(buckets)) {
  console.log(`${bucketName}: ${buckets[bucketName].length}`);
}

const outDir = join(ROOT, 'scripts', 'full-rewrite');
writeFileSync(
  join(outDir, 'backend-split-proposal.json'),
  JSON.stringify(buckets, null, 2),
);

// Human-readable per-folder breakdown: for every folder, how many files would
// stay vs move, so the folder-by-folder plan is easy to review at a glance.
const folderCounts = {};
for (const result of results) {
  const folder = dirname(result.relPath);
  folderCounts[folder] ||= { FRONTEND: 0, BACKEND: 0, 'UI-SUPPORT': 0, BARREL: 0, AMBIGUOUS: 0, 'PARSE-ERROR': 0 };
  folderCounts[folder][result.bucket] += 1;
}

let report = 'Per-folder breakdown (FRONTEND stays, BACKEND moves to <folder>/backend/, UI-SUPPORT stays, AMBIGUOUS needs a human look)\n';
report += '='.repeat(100) + '\n';
for (const folder of Object.keys(folderCounts).sort()) {
  const counts = folderCounts[folder];
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  if (counts.BACKEND === 0 && counts.AMBIGUOUS === 0 && counts['PARSE-ERROR'] === 0) continue; // nothing to decide here
  report += `${folder}  (${total} files)\n`;
  report += `  frontend=${counts.FRONTEND}  backend=${counts.BACKEND}  ui-support=${counts['UI-SUPPORT']}  barrel=${counts.BARREL}  ambiguous=${counts.AMBIGUOUS}  parse-error=${counts['PARSE-ERROR']}\n`;
}
writeFileSync(join(outDir, 'backend-split-report.txt'), report);

console.log(`\nFull classification: scripts/full-rewrite/backend-split-proposal.json`);
console.log(`Per-folder report:   scripts/full-rewrite/backend-split-report.txt`);
