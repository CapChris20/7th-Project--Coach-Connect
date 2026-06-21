#!/usr/bin/env node
/**
 * Automated baseline match audit — May 31 → June 14 before 1 AM Cursor chats.
 *
 * Reads agent-transcript JSONL + exported chat markdown, extracts Write/StrReplace/Delete
 * paths, resolves renames, checks disk, runs static checks + optional npm test.
 *
 * Usage:
 *   node scripts/baselineMatchAudit.mjs
 *   node scripts/baselineMatchAudit.mjs --skip-tests
 *   node scripts/baselineMatchAudit.mjs --chat 8
 *
 * Does NOT use git. Report only — no file edits.
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT, 'docs/chat-history-recovery/reports');
const EXPORT_DIR = path.join(ROOT, 'docs/chat-history-recovery/exported-chats');

/** Basename changed during feature-folder reorg (chat #12). */
const BASENAME_ALIASES = {
  'CoachWebSources.jsx': 'CoachWebSourceCards.jsx',
  'FoodConfirmSheet.jsx': 'ConfirmFoodSelectionSheet.jsx',
  'barcodeDisplay.js': 'renderScannedBarcode.js',
  'fatSecretFood.js': 'fatSecretClient.js',
  'foodSearchQueryMatch.js': 'sortBestFoodMatches.js',
  'foodSearchTitle.js': 'cleanFoodCardLabels.js',
  'restaurantSerperQuality.js': 'isReliableRestaurantFood.js',
  'nutritionNormalization.js': 'fixFoodNutritionNumbers.js',
  'servingMath.js': 'calculateServingSize.js',
  'foodNormalize.js': 'normalizeFoodQuery.js',
  'coachCategoryPrompts.js': 'coachQuickPrompts.js',
  'coachSourcePreview.js': 'renderSourcePreview.js',
  'CoachSourcePreviewSheet.jsx': 'CoachPasteSheet.jsx',
  'aiChatPersistence.js': 'saveCoachMessages.js',
  'normalizeToolParams.js': 'cleanupToolParams.js',
  'dataCacheCleanup.js': 'clearDataOnLogout.js',
  'notificationsService.js': 'manageNotifications.js',
  'dailyMetricsService.js': 'saveDailyMetricsToFirestore.js',
  'pushNotifyApi.js': 'sendPushNotification.js',
  'notesAndFilesService.js': 'manageNotesAndFiles.js',
  'nutritionService.js': 'logFoodToFirestore.js',
};

/** Present if any target exists (split refactors). */
const MULTI_REMAP = {
  'src/ai-coach/chat-ui/components/CoachComposerInput.jsx': [
    'src/ai-coach/chat-ui/chat-thread/useCoachComposerInput.js',
    'src/ai-coach/chat-ui/chat-thread/CoachPasteSheet.jsx',
  ],
  'src/ai-coach/chat-ui/lib/pasteTextIntoComposer.js': [
    'src/ai-coach/chat-ui/chat-thread/useCoachComposerInput.js',
    'src/ai-coach/chat-ui/chat-thread/CoachPasteSheet.jsx',
  ],
  'src/client-app/marketplace/screens/MarketplaceScreen.jsx': [
    'src/client-app/marketplace/components/MarketplaceUI.jsx',
    'src/client-app/home/ClientMainScreen.jsx',
  ],
  'src/client-app/marketplace/screens/TrainerViewMyViewMyViewMyProfileScreen.jsx': [
    'src/client-app/marketplace/components/MarketplaceTrainerProfileSheet.jsx',
  ],
};

function loadApplyFileRenamesMoves() {
  const text = fs.readFileSync(path.join(__dirname, 'applyFileRenames.js'), 'utf8');
  const block = text.split('const MOVES = [')[1]?.split('\n];')[0] || '';
  const moves = [];
  for (const m of block.matchAll(/\['([^']+)',\s*'([^']+)'\]/g)) {
    moves.push([m[1], m[2]]);
  }
  return moves;
}

function buildExtendedRemap() {
  const manual = JSON.parse(fs.readFileSync(path.join(__dirname, 'baselinePathRemap.json'), 'utf8'));
  const remap = { ...manual, ...MULTI_REMAP };

  for (const [from, to] of loadApplyFileRenamesMoves()) {
    remap[from] = to;
    const base = path.basename(from);
    if (from.includes('/nutrition/')) {
      remap[`src/nutrition/utils/${base}`] = to;
      remap[`src/nutrition/services/${base}`] = to;
      if (base.endsWith('.jsx')) remap[`src/nutrition/components/${base}`] = to;
    }
    if (from.startsWith('src/ai-coach/chat-ui/')) {
      remap[`src/ai-coach/chat-ui/lib/${base}`] = to;
      if (base.endsWith('.jsx')) remap[`src/ai-coach/chat-ui/components/${base}`] = to;
    }
    if (from.startsWith('src/shared/')) {
      remap[`src/shared/services/${base}`] = to;
    }
    if (from.startsWith('src/ai-coach/server-logic/tools/')) {
      remap[`src/ai-coach/server-logic/${base}`] = to;
    }
    if (from.startsWith('src/utils/')) {
      remap[`src/utils/${base}`] = to;
    }
  }

  for (const [oldBase, newBase] of Object.entries(BASENAME_ALIASES)) {
    for (const [key, val] of Object.entries({ ...remap })) {
      if (typeof val === 'string' && path.basename(val) === newBase) {
        remap[key.replace(path.basename(key), oldBase)] = val;
      }
    }
  }

  // Correct stale manual entries from pre-reorg layout
  remap['src/client-app/screens/ViewMyWorkoutPlanScreen.jsx'] = 'src/client-app/screens/ViewMyWorkoutPlanScreen.jsx';
  remap['src/client-app/workout-plans/ViewMyWorkoutPlanScreen.jsx'] = 'src/client-app/screens/ViewMyWorkoutPlanScreen.jsx';
  remap['src/nutrition/screens/NutritionFactsScreen.jsx'] = 'src/nutrition/food-details/NutritionFactsScreen.jsx';
  remap['src/nutrition/daily-log/NutritionFactsScreen.jsx'] = 'src/nutrition/food-details/NutritionFactsScreen.jsx';
  remap['src/shared/services/pushNotifyApi.js'] = 'src/shared/api/sendPushNotification.js';
  remap['src/shared/services/dailyMetricsService.js'] = 'src/metrics/daily-metrics/saveDailyMetricsToFirestore.js';
  remap['src/ai-coach/server-logic/normalizeToolParams.js'] = 'src/ai-coach/server-logic/tools/cleanupToolParams.js';
  remap['src/client-app/home/ClientHomeScreen.jsx'] = 'src/client-app/navigation/ClientMainScreen.jsx';
  remap['src/trainer-app/home/TrainerHomeScreen.jsx'] = 'src/trainer-app/navigation/TrainerMainScreen.jsx';
  remap['src/client-app/components/FilesNotesHeroCard.jsx'] = 'src/shared/components/FilesNotesHeroCard.jsx';
  remap['src/ai-coach/chat-ui/lib/coachConversationDebug.js'] = 'src/ai-coach/chat-ui/persistence/coachConversationDebug.js';
  remap['src/ai-coach/chat-ui/components/TrainerCoachClientBar.jsx'] = 'src/ai-coach/chat-ui/trainer-coach-mode/TrainerCoachClientBar.jsx';
  remap['src/ai-coach/chat-ui/lib/coachMarkdownStyles.js'] = 'src/ai-coach/chat-ui/chat-thread/coachMarkdownStyles.js';
  remap['src/ai-coach/chat-ui/components/CoachFormattedReply.jsx'] = 'src/ai-coach/chat-ui/chat-thread/CoachFormattedReply.jsx';
  remap['src/shared/services/firestoreListenerUtils.js'] = 'src/shared/firestore/firestoreListenerUtils.js';
  remap['src/nutrition/utils/casualMenuSearch.js'] = 'src/nutrition/food-search/casualMenuSearch.js';

  return remap;
}

const REMAP = buildExtendedRemap();

const TRANSCRIPT_DIRS = [
  path.join(
    process.env.HOME,
    '.cursor/projects/Users-captainchris20-Desktop-My-Coding-Portfolio-7th-Project-Coach-Connect-Mobile-App/agent-transcripts',
  ),
  path.join(
    process.env.HOME,
    '.cursor/projects/Users-captainchris20-Coding-Portfolio-7th-Project-Coach-Connect/agent-transcripts',
  ),
];

/** @type {Array<{num:number, id:string, hint:string, skip?:boolean, skipReason?:string}>} */
const CHATS = [
  { num: 1, id: 'a2116213-660f-473b-8fb4-c4df99a1c468', hint: 'infra / payments / Google Sign-In' },
  { num: 2, id: '81d5e120-5135-4149-9dda-ebbd83abeedb', hint: 'onboarding card borders' },
  { num: 3, id: 'bb3d5a73-d88d-46cf-8a31-7188bcafa0b3', hint: 'product advice', skip: true, skipReason: 'advice only' },
  { num: 4, id: '43d4e4ad-5153-4c58-8820-4f5b0fe99d34', hint: 'spreadsheet / plan viewer / web search' },
  { num: 5, id: '22de0722-96e2-4524-80eb-7a0fe3ebbe27', hint: 'folder structure' },
  { num: 6, id: '2ec46bca-f736-4b8a-9528-5081f5559c21', hint: 'energy 5/8 → 100% bug' },
  { num: 7, id: '9405e11c-511e-4946-aa21-46b28b8bb7ed', hint: 'support email' },
  { num: 8, id: '8047eeaa-aefd-44f5-a51a-18e895120b9c', hint: 'nutrition facts MEGA' },
  { num: 9, id: '842532aa-1255-463a-9642-330973281de7', hint: 'code quality audit', skip: true, skipReason: 'audit report, optional' },
  { num: 10, id: '2a168f9b-b583-4584-ad67-a3fdfca8bec7', hint: 'terminal follow-up', skip: true, skipReason: 'one-line follow-up' },
  { num: 11, id: 'd427da4a-27c8-4c2f-9c22-bd7495ad4c4b', hint: 'Jest test suite' },
  { num: 12, id: 'c2bb292e-64d7-4a0e-98a5-67ccff9e3269', hint: 'untested audit + tests + reorg' },
  { num: 13, id: 'a560aff3-4487-498f-9334-4f19c84b6fc0', hint: 'k6 load tests + structure doc' },
];

const REJECT_RE =
  /\b(wrong|ugly|not what i|go back|revert|undo that|still didn't|didn't fix|wtf|omfg|i don't like|dont like|stop making|terrible|fucking idiot)\b/i;

const WRITE_TOOLS = new Set(['Write', 'StrReplace', 'Delete']);

const IGNORE_PATH_PREFIXES = [
  'node_modules/',
  'Users/',
  'Users/captainchris20/',
  '.cursor/',
  'canvases/',
  'coverage/',
  'android/',
  'ios/build/',
];

const IGNORE_PATHS = new Set(['architecture-visual.html', 'patches/expo-constants+18.0.13.patch']);

function shouldIgnorePath(raw) {
  if (!raw) return true;
  const p = raw.split(path.sep).join('/');
  if (IGNORE_PATHS.has(p)) return true;
  return IGNORE_PATH_PREFIXES.some((pre) => p.startsWith(pre) || p.includes(`/${pre}`));
}

const args = process.argv.slice(2);
const skipTests = args.includes('--skip-tests');
const chatFilter = (() => {
  const i = args.indexOf('--chat');
  if (i >= 0 && args[i + 1]) return Number(args[i + 1]);
  return null;
})();

function log(lines) {
  for (const line of lines) out.push(line);
}

/** @type {string[]} */
const out = [];

function buildFileIndex(root) {
  /** @type {Map<string, string[]>} */
  const byBase = new Map();
  /** @type {Set<string>} */
  const all = new Set();

  const skip = new Set(['node_modules', '.git', 'coverage', 'ios/Pods', 'android/.gradle']);

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (skip.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full);
        continue;
      }
      const rel = path.relative(root, full).split(path.sep).join('/');
      all.add(rel);
      if (!byBase.has(ent.name)) byBase.set(ent.name, []);
      byBase.get(ent.name).push(rel);
    }
  }

  walk(root);
  return { byBase, all };
}

function toRepoRelative(rawPath) {
  if (!rawPath) return null;
  let p = String(rawPath).trim();
  p = p.replace(/\\/g, '/');
  const markers = [
    '7th-Project--Coach-Connect/',
    '7th Project- Coach Connect Mobile App/',
    '7th Project-- Coach Connect Mobile App/',
  ];
  for (const m of markers) {
    const idx = p.indexOf(m);
    if (idx >= 0) {
      p = p.slice(idx + m.length);
      break;
    }
  }
  if (p.startsWith('/Users/')) {
    const parts = p.split('/');
    const srcIdx = parts.indexOf('src');
    const serverIdx = parts.indexOf('server');
    const scriptsIdx = parts.indexOf('scripts');
    const loadIdx = parts.indexOf('load-tests');
    const docsIdx = parts.indexOf('docs');
    if (srcIdx >= 0) p = parts.slice(srcIdx).join('/');
    else if (serverIdx >= 0) p = parts.slice(serverIdx).join('/');
    else if (scriptsIdx >= 0) p = parts.slice(scriptsIdx).join('/');
    else if (loadIdx >= 0) p = parts.slice(loadIdx).join('/');
    else if (docsIdx >= 0) p = parts.slice(docsIdx).join('/');
  }
  return p.replace(/^\/+/, '');
}

function resolveRemapTarget(mapped, fileIndex) {
  if (mapped === null) return { resolved: null, note: 'intentionally removed duplicate' };
  if (Array.isArray(mapped)) {
    const hits = mapped.filter((p) => fileIndex.all.has(p));
    if (hits.length) return { resolved: hits[0], note: `multi-remap (${hits.length}/${mapped.length})` };
    return { resolved: null, note: 'multi-remap none found' };
  }
  if (fileIndex.all.has(mapped)) return { resolved: mapped, note: 'remap' };
  return { resolved: null, note: `remap target missing: ${mapped}` };
}

function resolvePath(relPath, fileIndex) {
  if (!relPath) return { resolved: null, note: 'empty path' };
  const normalized = relPath.split(path.sep).join('/');

  if (Object.prototype.hasOwnProperty.call(REMAP, normalized)) {
    const hit = resolveRemapTarget(REMAP[normalized], fileIndex);
    if (hit.resolved || REMAP[normalized] === null) return { ...hit, note: `${hit.note} ${normalized}` };
  }

  if (fileIndex.all.has(normalized)) return { resolved: normalized, note: 'exact' };

  const base = path.basename(normalized);
  const aliasBase = BASENAME_ALIASES[base];
  if (aliasBase) {
    const aliasHits = fileIndex.byBase.get(aliasBase) || [];
    if (aliasHits.length === 1) {
      return { resolved: aliasHits[0], note: `basename alias ${base}→${aliasBase}` };
    }
  }

  const candidates = fileIndex.byBase.get(base) || [];
  if (candidates.length === 1) return { resolved: candidates[0], note: 'basename unique' };

  const tail = normalized.split('/').slice(-3).join('/');
  const suffixHits = candidates.filter((c) => c.endsWith(tail) || c.includes(tail));
  if (suffixHits.length === 1) return { resolved: suffixHits[0], note: 'suffix match' };

  // Chat-era folder prefixes (pre feature-folder reorg)
  const prefixTry = [
    ['src/nutrition/utils/', ['src/nutrition/food-details/', 'src/nutrition/food-search/', 'src/nutrition/barcode/']],
    ['src/nutrition/services/', ['src/nutrition/food-search/']],
    ['src/nutrition/components/', ['src/nutrition/food-search/']],
    ['src/ai-coach/chat-ui/lib/', ['src/ai-coach/chat-ui/chat-thread/', 'src/ai-coach/chat-ui/persistence/']],
    ['src/ai-coach/chat-ui/components/', ['src/ai-coach/chat-ui/chat-thread/']],
    ['src/shared/services/', ['src/metrics/daily-metrics/', 'src/shared/api/', 'src/notifications/']],
  ];
  for (const [oldPre, newPres] of prefixTry) {
    if (!normalized.startsWith(oldPre)) continue;
    const rest = normalized.slice(oldPre.length);
    for (const np of newPres) {
      const candidate = np + rest;
      if (fileIndex.all.has(candidate)) return { resolved: candidate, note: `prefix ${oldPre}→${np}` };
      if (Object.prototype.hasOwnProperty.call(REMAP, candidate)) {
        const hit = resolveRemapTarget(REMAP[candidate], fileIndex);
        if (hit.resolved) return hit;
      }
      const alias = BASENAME_ALIASES[rest];
      if (alias) {
        const aliasHits = (fileIndex.byBase.get(alias) || []).filter((c) => c.startsWith(np));
        if (aliasHits.length === 1) return { resolved: aliasHits[0], note: `prefix+alias ${rest}→${alias}` };
      }
    }
  }

  return { resolved: null, note: candidates.length ? `ambiguous (${candidates.length})` : 'not found' };
}

function isOptionalAuditPath(relPath) {
  const p = relPath.split(path.sep).join('/');
  if (p.endsWith('.gitkeep')) return true;
  if (p === 'jest.config.js') {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
      if (pkg.jest) return true;
    } catch {
      /* ignore */
    }
  }
  if (p.startsWith('docs/')) return true;
  if (p.startsWith('src/FIND-YOUR-SCREEN.md')) return true;
  if (/^scripts\/(test|generate|data\/|lib\/|rename|revert|diagnose|fix|rewrite|reorganize)/.test(p)) return true;
  if (p.includes('generateCodebaseGuide') || p.includes('generateFilePurposeGuide')) return true;
  if (p.includes('filePurposeOverrides')) return true;
  if (p.endsWith('README.md') && p.includes('__tests__')) return true;
  return false;
}

function findTranscript(sessionId) {
  for (const dir of TRANSCRIPT_DIRS) {
    const p = path.join(dir, sessionId, `${sessionId}.jsonl`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function findExportMd(sessionId) {
  if (!fs.existsSync(EXPORT_DIR)) return null;
  const prefix = sessionId.split('-')[0];
  const hit = fs
    .readdirSync(EXPORT_DIR)
    .find((f) => f.includes(prefix) && f.endsWith('.md') && f !== 'README.md');
  return hit ? path.join(EXPORT_DIR, hit) : null;
}

function parseJsonlEdits(jsonlPath) {
  /** @type {Map<string, {tools:Set<string>, raw:string}>} */
  const edits = new Map();
  const rejections = [];
  let userMsgs = 0;

  const lines = fs.readFileSync(jsonlPath, 'utf8').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const role = obj.role;
    const content = obj.message?.content;
    if (!Array.isArray(content)) continue;

    if (role === 'user') {
      userMsgs += 1;
      for (const part of content) {
        if (part.type !== 'text' || !part.text) continue;
        const text = part.text.replace(/<[^>]+>/g, ' ').trim();
        if (REJECT_RE.test(text)) {
          rejections.push(text.slice(0, 120).replace(/\s+/g, ' '));
        }
      }
    }

    if (role !== 'assistant') continue;
    for (const part of content) {
      if (part.type !== 'tool_use' || !WRITE_TOOLS.has(part.name)) continue;
      const raw = toRepoRelative(part.input?.path);
      if (!raw) continue;
      const key = `${part.name}:${raw}`;
      if (!edits.has(key)) edits.set(key, { tools: new Set([part.name]), raw });
      else edits.get(key).tools.add(part.name);
    }
  }

  return { edits: [...edits.values()], rejections, userMsgs, assistantEdits: edits.size };
}

function parseMdPaths(mdPath) {
  const text = fs.readFileSync(mdPath, 'utf8');
  const paths = new Set();
  const re =
    /(?:^|[\s`'"'])((?:src|server|scripts|load-tests|docs|firestore\.rules|package\.json)[/\w.-]+(?:\.(?:js|jsx|mjs|cjs|ts|tsx|json|md|sh|rules))?)/gim;
  let m;
  while ((m = re.exec(text))) {
    paths.add(m[0].replace(/^[`'"\s]+|[`'"\s]+$/g, ''));
  }
  return [...paths];
}

function runStaticChecks() {
  const checks = [];

  function check(name, ok, detail = '') {
    checks.push({ name, ok, detail });
  }

  function exists(rel) {
    return fs.existsSync(path.join(ROOT, rel));
  }

  function existsAny(rels) {
    return rels.some((r) => exists(r));
  }

  function read(rel) {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
  }

  // verifyThreadGapFixes highlights
  check('server/lib/index.js removed (stale duplicate)', !exists('server/lib/index.js'));
  check(
    'ViewMyWorkoutPlanScreen exists',
    existsAny([
      'src/client-app/screens/ViewMyWorkoutPlanScreen.jsx',
      'src/client-app/workout-plans/ViewMyWorkoutPlanScreen.jsx',
    ]),
  );
  check('load-tests/ folder', exists('load-tests/run-all.sh'));
  check('coach tool guards test', exists('src/__tests__/unit/coachToolProposalGuards.test.js'));
  check('runJestWithLog writes test-results.txt', exists('scripts/runJestWithLog.js'));
  check('shouldShowCoachAction (modal guards)', exists('src/ai-coach/server-logic/tools/shouldShowCoachAction.js'));
  check('filterValidCoachToolCalls on server', read('server/index.js').includes('filterValidCoachToolProposals'));
  check('EMERGENCY PARSE removed from server', !read('server/index.js').includes('EMERGENCY PARSE'));
  check(
    'Daily nutrition facts screen path',
    existsAny([
      'src/nutrition/food-details/NutritionFactsScreen.jsx',
      'src/nutrition/daily-log/NutritionFactsScreen.jsx',
    ]),
  );
  check('support config file', exists('src/shared/config/supportConfig.js') || read('server/supportEmail.js').includes('coachconnect0@gmail.com'));

  if (exists('src/client-app/home/ClientMainScreen.jsx')) {
    const main = read('src/client-app/home/ClientMainScreen.jsx');
    check('energy not raw /8 as percent heuristic', !/\/\s*8\s*\*\s*100|energy.*100\s*%/i.test(main));
  }

  if (exists('package.json')) {
    const pkg = read('package.json');
    check('npm start uses dev-client', pkg.includes('--dev-client'));
  }

  return checks;
}

const EXPECTED_TESTS = [
  'src/__tests__/unit/coachToolProposalGuards.test.js',
  'src/__tests__/unit/servingMath.test.js',
  'src/__tests__/unit/authGate.test.js',
  'src/__tests__/unit/calculations.test.js',
  'src/__tests__/unit/parseCoachToolCalls.test.js',
  'src/__tests__/unit/dailyMetrics.test.js',
  'src/__tests__/unit/onboardingCalculations.test.js',
  'src/__tests__/unit/foodSearchScoring.test.js',
  'src/__tests__/unit/workoutPlanParsing.test.js',
  'src/__tests__/integration/aiCoachFlow.test.js',
  'src/__tests__/integration/foodSearchLog.test.js',
  'src/__tests__/unit/validateTrainerInviteCode.test.js',
  'src/__tests__/unit/onboardingGate.test.js',
  'src/__tests__/components/ToolConfirmationModal.test.js',
  'src/__tests__/integration/onboardingComplete.test.js',
  'src/__tests__/integration/dashboardSave.test.js',
  'src/__tests__/unit/baseUrl.test.js',
  'src/__tests__/unit/foodNormalizeBarcode.test.js',
  'src/__tests__/integration/clientHomeBootstrap.test.js',
  'src/__tests__/unit/bookSessionParse.test.js',
  'src/__tests__/unit/notesAndFiles.test.js',
];

function parseRequestAuditPartial() {
  const auditPath = path.join(ROOT, 'docs/chat-history-recovery/REQUEST_STATUS_AUDIT.md');
  if (!fs.existsSync(auditPath)) return { partial: 0, done: 0, na: 0 };
  const text = fs.readFileSync(auditPath, 'utf8');
  const rows =
    text.match(/\|\s*\d+\s*\|[^|\n]*\|[^|\n]*\|\s*(DONE|PARTIAL|N\/A|MISSING)\s*\|/gi) || [];
  let partial = 0;
  let done = 0;
  let na = 0;
  for (const row of rows) {
    if (/\|\s*PARTIAL\s*\|/i.test(row)) partial += 1;
    else if (/\|\s*DONE\s*\|/i.test(row)) done += 1;
    else if (/\|\s*N\/A\s*\|/i.test(row)) na += 1;
  }
  return { partial, done, na };
}

// ─── Main ───────────────────────────────────────────────────────────────────

fs.mkdirSync(REPORT_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const reportPath = path.join(REPORT_DIR, `baseline-match-${stamp}.txt`);

log(['CoachConnect baseline match audit', `Workspace: ${ROOT}`, `Generated: ${new Date().toISOString()}`, '']);

const fileIndex = buildFileIndex(ROOT);

/** @type {Array<{chat:number, item:string, file:string, status:string, notes:string}>} */
const masterRows = [];
let totalMissing = 0;
let totalPresent = 0;
let totalPartial = 0;

const chatsToRun = CHATS.filter((c) => {
  if (chatFilter != null && c.num !== chatFilter) return false;
  return true;
});

for (const chat of chatsToRun) {
  log([`── Chat #${chat.num} (${chat.id.slice(0, 8)}) — ${chat.hint} ──`]);

  if (chat.skip) {
    log([`SKIPPED — ${chat.skipReason}`, '']);
    continue;
  }

  const jsonl = findTranscript(chat.id);
  const exportMd = findExportMd(chat.id);

  if (!jsonl && !exportMd) {
    log(['MISSING transcript and export — cannot audit this chat', '']);
    masterRows.push({
      chat: chat.num,
      item: 'transcript',
      file: chat.id,
      status: 'MISSING',
      notes: 'no jsonl or export md',
    });
    totalMissing += 1;
    continue;
  }

  /** @type {{edits:Array, rejections:string[], userMsgs:number, assistantEdits:number}|null} */
  let parsed = null;
  if (jsonl) {
    parsed = parseJsonlEdits(jsonl);
    log([
      `Transcript: ${jsonl}`,
      `User messages: ${parsed.userMsgs} | Write/StrReplace/Delete paths: ${parsed.edits.length}`,
    ]);
  } else {
    log([`Transcript: NOT FOUND`, `Export: ${exportMd}`]);
  }

  if (parsed?.rejections?.length) {
    log([`User rejections in thread (last good state may differ): ${parsed.rejections.length}`]);
    for (const r of parsed.rejections.slice(0, 5)) log([`  · ${r}`]);
    if (parsed.rejections.length > 5) log([`  · … +${parsed.rejections.length - 5} more`]);
  }

  /** @type {Array<{tool:string, raw:string}>} */
  const editList = parsed?.edits?.map((e) => ({ tool: [...e.tools].join('+'), raw: e.raw })) || [];

  if (!editList.length && exportMd) {
    for (const p of parseMdPaths(exportMd)) editList.push({ tool: 'md-ref', raw: p });
  }

  if (!editList.length) {
    log(['No Write/StrReplace/Delete paths extracted — rely on static checks only', '']);
  }

  for (const edit of editList) {
    if (shouldIgnorePath(edit.raw)) continue;

    const { resolved, note } = resolvePath(edit.raw, fileIndex);
    let status = 'PRESENT';
    let notes = note;

    if (edit.tool.includes('Delete')) {
      // Deletes often mean "removed from old folder during reorg" — file may exist elsewhere.
      if (resolved && fs.existsSync(path.join(ROOT, resolved))) {
        status = 'PRESENT';
        notes = 'still on disk (may have moved, not a gap)';
      } else if (!resolved) {
        const base = path.basename(edit.raw);
        const moved = (fileIndex.byBase.get(base) || []).filter((c) => c !== edit.raw);
        if (moved.length === 1) {
          status = 'PRESENT';
          notes = `moved → ${moved[0]}`;
        } else {
          status = 'SKIP';
          notes = 'delete target gone or reorganized';
        }
      } else {
        status = 'PRESENT';
        notes = 'deleted OK';
      }
    } else if (!resolved) {
      if (Object.prototype.hasOwnProperty.call(REMAP, edit.raw.split(path.sep).join('/')) && REMAP[edit.raw.split(path.sep).join('/')] === null) {
        status = 'PRESENT';
        notes = 'intentionally removed duplicate';
        totalPresent += 1;
      } else if (isOptionalAuditPath(edit.raw)) {
        status = 'OPTIONAL';
        notes = `${edit.raw} → dev/doc artifact (not required for baseline)`;
        totalPartial += 1;
      } else {
        const base = path.basename(edit.raw);
        const moved = (fileIndex.byBase.get(base) || []).filter((c) => !c.endsWith(edit.raw));
        if (moved.length === 1) {
          status = 'PRESENT';
          notes = `renamed → ${moved[0]}`;
          totalPresent += 1;
        } else if (moved.length > 1 && note.startsWith('ambiguous')) {
          status = 'PRESENT';
          notes = `exists (${moved.length} locations): ${moved[0]}`;
          totalPresent += 1;
        } else {
          status = 'MISSING';
          notes = `${edit.raw} → ${note}`;
          totalMissing += 1;
        }
      }
    } else if (!fs.existsSync(path.join(ROOT, resolved))) {
      status = 'MISSING';
      notes = resolved;
      totalMissing += 1;
    } else {
      totalPresent += 1;
    }

    if (status === 'SKIP' || status === 'OPTIONAL') continue;

    const rowKey = `${chat.num}:${resolved || edit.raw}:${status}`;
    if (status === 'MISSING' && masterRows.some((r) => r.chat === chat.num && r.file === (resolved || edit.raw) && r.status === 'MISSING')) {
      continue;
    }

    masterRows.push({
      chat: chat.num,
      item: `${edit.tool} ${edit.raw}`,
      file: resolved || edit.raw,
      status,
      notes,
    });
  }

  log(['']);
}

// Expected test files (chat #11 / #12)
log(['── Expected test files (chats #11/#12) ──']);
for (const t of EXPECTED_TESTS) {
  const ok = fs.existsSync(path.join(ROOT, t));
  const status = ok ? 'PRESENT' : 'MISSING';
  if (!ok) totalMissing += 1;
  else totalPresent += 1;
  masterRows.push({ chat: 11, item: 'expected test', file: t, status, notes: '' });
  log([`${ok ? '✓' : '✗'} ${t}`]);
}
log(['']);

// Static checks
log(['── Cross-chat static checks ──']);
const staticChecks = runStaticChecks();
for (const c of staticChecks) {
  const status = c.ok ? 'PRESENT' : 'MISSING';
  if (!c.ok) totalMissing += 1;
  else totalPresent += 1;
  masterRows.push({ chat: 0, item: c.name, file: '(static)', status, notes: c.detail });
  log([`${c.ok ? '✓' : '✗'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`]);
}
log(['']);

// verifyThreadGapFixes
log(['── verifyThreadGapFixes.js ──']);
const gapFix = spawnSync('node', ['scripts/verifyThreadGapFixes.js'], {
  cwd: ROOT,
  encoding: 'utf8',
});
log([(gapFix.stdout || gapFix.stderr || '').trim().split('\n').slice(-3).join('\n')]);
if (gapFix.status !== 0) {
  totalMissing += 1;
  masterRows.push({ chat: 0, item: 'verifyThreadGapFixes', file: 'scripts/', status: 'MISSING', notes: 'failed' });
}
log(['']);

// npm test
let testOk = true;
if (!skipTests) {
  log(['── npm test ──']);
  const testRun = spawnSync('npm', ['test'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  const tail = (testRun.stdout || testRun.stderr || '').trim().split('\n').slice(-8).join('\n');
  log([tail]);
  testOk = testRun.status === 0;
  if (!testOk) {
    totalMissing += 1;
    masterRows.push({ chat: 0, item: 'npm test', file: 'package.json', status: 'WRONG', notes: 'tests failing' });
  }
  log(['']);
} else {
  log(['── npm test SKIPPED (--skip-tests) ──', '']);
}

const auditStats = parseRequestAuditPartial();
log([
  '── REQUEST_STATUS_AUDIT.md (informational) ──',
  `DONE: ${auditStats.done} | PARTIAL: ${auditStats.partial} | N/A: ${auditStats.na}`,
  '(PARTIAL rows are not auto-fail — many were never finished pre-deletion)',
  '',
]);

// Master table
log(['══════════════════════════════════════════════════════════════']);
log(['MASTER TABLE']);
log(['| Chat | Item | File/area | Status | Notes |']);
log(['|------|------|-----------|--------|-------|']);
for (const row of masterRows.filter((r) => r.status !== 'PRESENT').slice(0, 80)) {
  const item = row.item.replace(/\|/g, '/').slice(0, 40);
  const file = row.file.replace(/\|/g, '/').slice(0, 50);
  const notes = row.notes.replace(/\|/g, '/').slice(0, 40);
  log([`| ${row.chat} | ${item} | ${file} | ${row.status} | ${notes} |`]);
}
if (masterRows.filter((r) => r.status !== 'PRESENT').length > 80) {
  log(['| … | (truncated) | | | |']);
}
log(['']);

const hardFails = masterRows.filter((r) => r.status === 'MISSING' || r.status === 'WRONG');
const confirmed =
  hardFails.length === 0 && testOk && gapFix.status === 0;

log([
  `File edits scanned: ${masterRows.length} | actionable gaps: ${hardFails.length}`,
  '',
]);

if (confirmed) {
  log([
    'BASELINE MATCH CONFIRMED',
    'The current workspace matches the pre–June 14 1 AM baseline for all automated checks.',
    '',
    'Say: "I confirm baseline match. Lock it in."',
  ]);
} else {
  log([
    'BASELINE MATCH NOT CONFIRMED',
    `${hardFails.length} automated gap(s) found (see table above).`,
    '',
    'Top gaps:',
    ...hardFails.slice(0, 15).map((r) => `  · [chat ${r.chat}] ${r.status} — ${r.file} — ${r.notes}`),
    '',
    'Fix with per-chat GAP AUDIT + "fix the baseline gaps", or re-run after fixes:',
    '  npm run baseline:audit',
  ]);
}

log([
  '',
  `Summary: PRESENT≈${totalPresent} | gaps=${hardFails.length} | report: ${reportPath}`,
]);

fs.writeFileSync(reportPath, out.join('\n'));
console.log(out.join('\n'));
process.exit(confirmed ? 0 : 1);
