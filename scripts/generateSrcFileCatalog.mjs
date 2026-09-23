#!/usr/bin/env node
/**
 * Generate src/SRC_FILE_CATALOG.md — every file under src/, grouped by folder.
 * One plain-English paragraph per file (purpose + how it fits in).
 *
 *   node scripts/generateSrcFileCatalog.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(SRC, 'SRC_FILE_CATALOG.md');
const OUT_DOCS = path.join(ROOT, 'docs', 'SRC_FILE_CATALOG.md');
const OVERRIDES_PATH = path.join(__dirname, 'srcFileCatalogOverrides.json');
const OVERRIDES = fs.existsSync(OVERRIDES_PATH)
  ? JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf8'))
  : {};

/** Folder name pieces that confuse non-tech readers */
const JARGON_FOLDER_BITS = new Set([
  'persistence',
  'logic',
  'context',
  'vision',
  'chat-api',
  'macro-recalibration',
  'services',
  'hooks',
  'api',
  'firestore',
  'premiumFoodCard',
  'liquid',
  'utils',
  'lib',
]);

/** Paths that are known fake re-exports or dead product areas */
const KNOWN_STUBS = new Set([
  'ai-coach/home-screen/CoachHomeScreen.jsx',
  'ai-coach/home-screen/CoachHomeScreen.jsx',
  'for-both/workout-plans/SavedWorkoutsScreen.jsx',
  'for-both/photo-gallery/MyProgressPhotosScreen.jsx',
  'for-both/weekly-report/WeeklyReportScreen.jsx',
  'logout-cleanup/clearDataOnLogout.js',
  'nutrition/food-cards/FoodCard/index.js',
  'block-and-report/blockUser.js',
  'look-and-feel/lightDarkMode.js',
]);

const KNOWN_DEAD = new Set([
  'ai-coach/chat-ui/voice/speechRecognitionSafe.js',
  'ai-coach/chat-ui/voice/useVoiceToCoach.js',
  'ai-coach/home-screen/CoachHomeScreen.jsx',
]);


const FOLDER_BLURBS = {
  '': 'Root of the React Native / Expo app source. Contains the app entry loader, architecture docs, and this catalog.',
  __tests__: 'Jest test suites for unit, integration, and component tests.',
  '__tests__/components': 'React component tests rendered with Testing Library.',
  '__tests__/fixtures': 'Shared mock data and fixtures imported by multiple tests.',
  '__tests__/integration': 'Multi-module integration tests that exercise real flows (auth, food log, coach).',
  '__tests__/mocks': 'Module mocks for Expo and third-party dependencies in Jest.',
  '__tests__/unit': 'Pure unit tests for helpers, parsers, scoring, and business logic.',
  'ai-coach': 'Everything for the in-app AI Coach: home page, texting screen, popups to log food/water, and helpers that talk to the coach server.',
  'ai-coach/chat-ui': 'Screens and pieces you see when using the AI Coach (home, conversation, popups).',
  'ai-coach/chat-ui/chat-home': 'JARGON / mostly fake: intended as coach home, but one file here is only a pointer to the real home screen.',
  'ai-coach/chat-ui/chat-thread': 'The back-and-forth texting screen with the coach (messages, type box, attach photo).',
  'ai-coach/chat-ui/components': 'Small reusable coach UI pieces (reply formatting, follow-up suggestion bubbles, chat history side panel).',
  'ai-coach/chat-ui/helpers': 'Small text/formatting helpers for coach replies (copy text, markdown look, web-search reply parsing).',
  'ai-coach/chat-ui/hooks': 'Reusable “memory” pieces for coach screens (e.g. load list of past chats).',
  'ai-coach/chat-ui/lib': 'Older helper folder name for the same kind of coach text helpers (if present).',
  'ai-coach/chat-ui/persistence': 'JARGON folder name — means “save/load coach chats so they are still there next time.”',
  'ai-coach/chat-ui/screens': 'Holds the real AI Coach home / landing screen.',
  'ai-coach/chat-ui/tool-modals': 'Popups that ask you to confirm before the coach logs water, food, sleep, books a session, etc.',
  'ai-coach/chat-ui/voice': 'Voice / speak-to-coach experiments — likely removable if voice is no longer a product feature.',
  'ai-coach/logic': 'JARGON folder — behind-the-scenes coach helpers (send message, decide web search, load your stats for the coach).',
  'ai-coach/logic/chat-api': 'JARGON — helpers that send coach messages and related chat requests to your app server.',
  'ai-coach/logic/context': 'JARGON — gathers your profile/stats so the coach knows who you are when answering.',
  'ai-coach/logic/macro-recalibration': 'JARGON — recalculates protein/carbs/fats when goals change from the coach.',
  'ai-coach/logic/services': 'Thin helpers (e.g. mark messages as read).',
  'ai-coach/logic/tools': 'When the coach wants to take an action (log food, etc.), these decide what popup to show and run it after you confirm.',
  'ai-coach/logic/trainer-messaging': 'Lets the AI coach notify your human trainer.',
  'ai-coach/logic/vision': 'Saves photos you attach in coach chat.',
  'ai-coach/tools': 'Reads hidden “action instructions” inside coach replies so the app can show the right confirm popup.',
  'app-start': 'App launch: decides login vs onboarding vs open the trainee app or trainer app.',
  'error-logging': 'Captures app crashes/errors and can send them to the server for debugging.',
  'logout-cleanup': 'Wipes local saved data when the user logs out.',
  'safety': 'Block people and report bad content.',
  'spreadsheet-files': 'Spreadsheet library wiring so Excel-like files work on phone and web.',
  assets: 'Static images, Lottie animations, and icon PNGs bundled with the app.',
  'assets/animations': 'Lottie / loading animation assets (including prism loading art).',
  'assets/animations/app-flows': 'Lottie animations played during onboarding and app-flow steps.',
  'assets/animations/legacy': 'Legacy branded Lottie files (AI, food, fitness themes).',
  'assets/icons': 'Nutrition, workout, and UI icon PNGs/GIFs used across onboarding and dashboards.',
  'assets/icons/New Icons': 'Onboarding picker icons (equipment, experience level, gender).',
  'assets/logo': 'Brand logo image assets.',
  'assets/onboarding-consolidated': 'Flattened onboarding icon set for consolidated imports.',
  auth: 'Login, signup, password reset, onboarding wizard, and role-detection helpers.',
  'auth/services': 'Password-reset email requests via Firebase/backend.',
  'client-app': 'Everything specific to the client (trainee) role — home, dashboard, marketplace, files, navigation.',
  'client-app/dashboard': 'Client dashboard: hero card, stats, trainer card, workout log hook.',
  'client-app/files': 'Client view of trainer-shared files, notes, and personal file gallery.',
  'client-app/home': 'Client home tab: welcome card, bootstrap hooks, home screen styles.',
  'client-app/marketplace': 'Find-a-trainer marketplace: filters, trainer cards, request sheets.',
  'client-app/meal-plan': 'Client meal plan viewer (if assigned by trainer).',
  'client-app/navigation': 'Client app shell, bottom nav, overlay stack, screen navigation hook.',
  'client-app/profile': 'Client profile screen.',
  'client-app/workout-plans': 'Client AI workout plans list screen.',
  components: 'Root-level shared components (payments popups, Stripe sheets, onboarding steps).',
  'components/onboarding': 'Onboarding step components used during signup/profile setup.',
  lib: 'Small shared libraries at src root (sessions helper).',
  messaging: 'Conversations list and chat thread screens shared by client and trainer roles.',
  metrics: 'Daily metrics and motivational quotes feature root.',
  'metrics/daily-metrics': 'Weight, steps, sleep, water — date keys and Firestore daily log writes.',
  'metrics/daily-quotes': 'Static JSON list of motivational quotes for the home card.',
  navigation: 'Cross-app navigation utilities (shell navigate helper, route names, AppNavigationContext).',
  notifications: 'Push notification text formatting and Firestore notification management.',
  nutrition: 'Full nutrition feature: daily log, food search, barcode, facts, settings, premium food cards.',
  'nutrition/barcode': 'Barcode scanner flow and Serper/USDA lookup for packaged foods.',
  'nutrition/components': 'Shared nutrition UI widgets (gradient frames, etc.).',
  'nutrition/food-cards/FoodCard': 'Premium-styled food card, nutrition facts section, logged-food display.',
  'nutrition/daily-log': 'Daily nutrition log screen, meal cards, Firestore write helpers.',
  'nutrition/food-details': 'Food detail / nutrition facts screen, serving editor, label parsing.',
  'nutrition/food-search': 'Food search screen, ranking, consensus search, confirm-selection sheet.',
  'nutrition/quick-add': 'Quick-add macros without full food search.',
  'nutrition/settings': 'Nutrition onboarding wizard and macro/target settings.',
  'nutrition/utils': 'Nutrition-specific search helpers (casual menu search).',
  settings: 'App-wide settings screens, support config, and legal pages.',
  'settings/screens': 'Settings hub and sub-screens (password, FAQ, bug report, privacy, etc.).',
  'for-both': 'Code used by both trainees and trainers (shared screens, payments, notes/files, talking to the server).',
  'for-both/accessibility': 'Extra labels so screen readers can describe buttons and screens.',
  'for-both/api': 'Talking to the Coach Connect server (backend URL, signed-in requests, push, charges, health check).',
  'for-both/assets': 'Shared icons/animations registry used in onboarding for both roles.',
  'for-both/components': 'Reusable UI used by both roles (hero cards, home widgets, popups, notes/files viewers).',
  'for-both/components/brand': 'Brand logo display.',
  'for-both/components/home': 'Home-tab widgets both roles can show (quote card, session card, banners).',
  'for-both/components/icons': 'Colored/branded icons for navigation and profile cards.',
  'for-both/components/modals': 'Generic popups (error, hold-to-confirm, remove trainer).',
  'for-both/components/notes-files': 'UI for viewing PDFs, spreadsheets, media, and file galleries.',
  'for-both/components/onboarding': 'Shared onboarding steps (AI opt-in, trainer subscription step).',
  'for-both/components/shell': 'Loading screens and the top Coach Connect header bar.',
  'for-both/contexts': 'Shared app-wide switches (e.g. AI opt-in state).',
  'for-both/firestore': 'JARGON — helpers for reading/writing the cloud database and uploading files.',
  'for-both/fitness-calculations': 'Math for calories and macros from onboarding answers.',
  'for-both/marketplace': 'Keeps trainer marketplace profiles in sync with the cloud database.',
  'for-both/notes-files': 'Create/update/delete notes and file attachments between trainer and client.',
  'for-both/payments': 'Paying a trainer / Stripe Connect flows, payment history, education copy.',
  'for-both/photo-gallery': 'Progress photo gallery screen used by both roles.',
  'for-both/screens': 'Mostly fake pointers that re-export the real weekly report / photos / workouts screens.',
  'for-both/services': 'JARGON — fetch profile and listen for live database updates.',
  'for-both/trainer-location': 'Trainer location / map-related helpers for profiles.',
  'for-both/weekly-report': 'Weekly progress report screen shared by client and trainer views.',
  'for-both/weekly-report/components': 'Pieces inside the weekly report (day cards, charts, insight rows).',
  'for-both/weekly-report/data': 'Loads the week’s food/workout numbers that fill the report.',
  'for-both/weekly-report/theme': 'Colors/styles for the weekly report.',
  'for-both/workout-plans': 'Browse saved workout plans (shared implementation).',
  'for-both/workout-profile': 'Icons and rules for workout profile cards.',
  theme: 'Look-and-feel of the app: colors, dark/light mode, glass-style cards and backgrounds.',
  'theme/layout': 'Simple layout helpers (e.g. two-column grid).',
  'theme/liquid': '“Liquid glass” visual pieces (blurry backgrounds, glass cards, gradient buttons).',
  helpers: 'Tiny shared helpers (today’s date key, height conversion, clean data for the database, file type).',
  subscription: 'Trainer Pro paywall, trial banner, and “are they subscribed?” checks.',
  'trainer-app': 'Everything only trainers see: client list, sessions, documents, payments, dashboard.',
  'trainer-app/calendar-tab': 'Trainer calendar tab of upcoming sessions.',
  'trainer-app/client-detail': 'Manage one trainee’s detail screen.',
  'trainer-app/client-records': 'Load linked trainees and related database paths/errors.',
  'trainer-app/client-requests': 'New people asking to connect with the trainer.',
  'trainer-app/clients-list': 'Roster of the trainer’s linked clients.',
  'trainer-app/components': 'Trainer widgets (wheel picker, session calendar pieces).',
  'trainer-app/components/sessions': 'Month calendar and session card UI.',
  'trainer-app/dashboard': 'Trainer home dashboard and marketplace modal.',
  'trainer-app/documents': 'Document and spreadsheet editors trainers use for notes/files.',
  'trainer-app/documents/spreadsheet': 'Spreadsheet grid, formulas, and formatting for the editor.',
  'trainer-app/hooks': 'Reusable session list / scheduling state for trainer screens.',
  'trainer-app/navigation': 'Trainer tabs, overlays, and how screens open.',
  'trainer-app/nutrition-tab': 'Trainer looking at a client’s nutrition.',
  'trainer-app/payments': 'Trainer payments / payouts screen.',
  'trainer-app/progress-tab': 'Trainer looking at a client’s progress and weight.',
  'trainer-app/screens': 'Extra trainer full screens (scheduling wrappers).',
  'trainer-app/screens/components': 'Pickers used by trainer scheduling screens.',
  'trainer-app/sessions': 'Book / schedule training sessions and notify the client.',
  'trainer-app/weekly-report': 'Weekly report cards the trainer sees for a client.',
  'trainer-app/workout-plans': 'Trainer builds workout plans by hand.',
  workouts: 'Workouts feature: active session, exercise videos, AI plan generate/view.',
  'workouts/active-workout': 'In-the-gym workout logging (sets/reps) and related helpers.',
  'workouts/components': 'Exercise row/section UI used in plans and active workout.',
  'workouts/exercise-library': 'Exercise video library (YouTube), dislike picker, player.',
  'workouts/plan-builder': 'Manual plan builder edit forms.',
  'workouts/plan-generator': 'Ask the server to generate an AI workout plan.',
  'workouts/plan-viewer': 'Show a finished workout plan and export PDF.',
  'workouts/screens': 'Screen to start generating “my workout plan.”',
  'nutrition/restaurant-search': 'Search restaurant / casual menu foods.',
  'nutrition/food-cards/FoodCard': 'Fancy food cards and nutrition facts UI.',
  'metrics/daily-quotes': 'List of motivational quotes for the home quote card.',
};

/** Coach tool modal → plain English action */
const TOOL_MODAL_ACTIONS = {
  AdjustMacroTargetsSheet: 'adjust daily protein/carbs/fats when the coach suggests new macro targets',
  BookTraineeSessionSheet: 'book a training session with their trainer at a chosen date and time',
  ConfirmDeleteLogSheet: 'delete a previously logged food or metric entry the coach referenced',
  LogMoodRatingSheet: 'log mood on a scale when the coach asks how they are feeling',
  LogMealSheet: 'log a meal or snack with calories and macros from coach chat',
  LogRestDaySheet: 'mark today as a rest day in their workout log',
  LogSleepHoursSheet: 'log hours of sleep for the daily metrics tracker',
  LogDailyStepsSheet: 'log step count for the daily metrics tracker',
  LogWaterIntakeSheet: 'log water intake (ounces or ml) for hydration tracking',
  SendTrainerMessageSheet: 'send a message or alert to their human trainer',
  OpenWorkoutPlanSheet: 'open a specific workout plan the coach referenced',
  RateEnergyLevelSheet: 'rate energy level (1–10) for daily metrics',
  RateWorkoutFeelSheet: 'rate how a workout felt after completing it',
  UpdateFitnessGoalSheet: 'update a fitness goal (weight, strength, etc.) the coach discussed',
  UpdateWorkoutSessionSheet: 'modify an scheduled or active workout entry',
  PlanDeloadWeekSheet: 'generate a deload week plan when the coach recommends recovery',
};

const ASSET_USAGE = {
  'Carbs.png': 'Macro breakdown UI — carbohydrate icon on nutrition cards and dashboards.',
  'Protein.png': 'Macro breakdown UI — protein icon on nutrition cards and dashboards.',
  'Fats.png': 'Macro breakdown UI — fat icon on nutrition cards and dashboards.',
  'hydration.png': 'Water/hydration tracking icon on home stats and daily metrics.',
  'sleeping.png': 'Sleep tracking icon on home stats and daily metrics.',
  'energy.png': 'Energy level icon on home stats and daily metrics.',
  'dumbbell.png': 'Workout-related UI — exercise and training sections.',
  'workout.png': 'Workout tab and plan-related navigation icons.',
  'scales.png': 'Weight/body metrics icon in onboarding and profile.',
  'height.png': 'Height input icon during onboarding.',
  'apple-logo.png': 'Sign in with Apple button on auth screen.',
  'google_gemini.png': 'AI Coach nav icon — indicates Gemini-powered coach features.',
  'settings.png': 'Settings gear icon in headers and menus.',
  'Advanced.png': 'Onboarding — advanced fitness experience level option.',
  'Beginner.png': 'Onboarding — beginner fitness experience level option.',
  'Intermediate.png': 'Onboarding — intermediate fitness experience level option.',
  'dumbbells.png': 'Onboarding — home gym equipment option (dumbbells only).',
  'full_gym.png': 'Onboarding — full commercial gym equipment option.',
  'bodyweight_only.png': 'Onboarding — bodyweight-only training option.',
  'male.png': 'Onboarding — gender selection (male).',
  'female.png': 'Onboarding — gender selection (female).',
  'prefer_not_to_say.png': 'Onboarding — gender prefer-not-to-say option.',
  'ai_workouts.png': 'Marketing/hero image for AI-generated workout plans feature.',
};

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function relFromSrc(abs) {
  return path.relative(SRC, abs).replace(/\\/g, '/');
}

function dirKey(rel) {
  const d = path.dirname(rel);
  return d === '.' ? '' : d;
}

function humanize(name) {
  return name
    .replace(/\.(jsx?|tsx?|cjs|json|png|gif|webp|svg)$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .trim();
}

function stripBoilerplate(text) {
  if (!text) return '';
  return text
    .replace(/^UI screen or component:\s*/i, '')
    .replace(/^Data\/service layer:\s*/i, '')
    .replace(/^React hook:\s*/i, '')
    .replace(/\s*—?\s*Feature module for Coach Connect\.?/gi, '')
    .replace(/\.\s*Feature module for Coach Connect\.?/gi, '.')
    .replace(/\s*Purpose:\s*[^.]*Feature module for Coach Connect\.?/gi, '')
    .replace(/\s*Why it matters:\s*[^.]*\.?/gi, '')
    .replace(/\s*Area:\s*src\/\S+/gi, '')
    .replace(/\s*Key exports:\s*[^.]*\.?/gi, '')
    .replace(/Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDocBlocks(content) {
  const blocks = [];
  const re = /\/\*\*([\s\S]*?)\*\//g;
  let m;
  while ((m = re.exec(content))) {
    const body = m[1]
      .split('\n')
      .map((l) => l.replace(/^\s*\*\s?/, '').trim())
      .filter((l) => l && !l.startsWith('@file-header'))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (body && !body.includes('@file-header')) blocks.push(body);
  }
  return blocks;
}

function extractHeaderFields(content) {
  const head = content.slice(0, 2500);
  const purpose = head.match(/\*\s*Purpose:\s*(.+?)(?:\n\s*\*|$)/s)?.[1]?.trim();
  const area = head.match(/\*\s*Area:\s*(.+?)(?:\n|\*)/)?.[1]?.trim();
  const keyExports = head.match(/\*\s*Key exports:\s*(.+?)(?:\n|\*)/)?.[1]?.trim();
  return { purpose, area, keyExports };
}

/** What this file does, inferred from notable imports */
const IMPORT_HINTS = [
  ['runCoachAction', 'runs AI coach tool actions after the user taps Confirm'],
  ['sendCoachMessageWithRetry', 'sends user messages to the AI coach backend and streams replies'],
  ['saveCoachMessages', 'persists coach chat history to Firestore'],
  ['loadCoachContextEnhanced', 'loads user profile, nutrition, and workout context for the coach prompt'],
  ['parseCoachToolCalls', 'parses tool-call JSON embedded in coach model responses'],
  ['shouldShowWebSearchUI', 'detects when a coach reply used web search and shows source cards'],
  ['useCoachSpeech', 'enables voice dictation and text-to-speech in coach chat'],
  ['logFoodToFirestore', 'writes a logged food entry to the user daily nutrition log'],
  ['saveDailyMetricsToFirestore', 'writes weight, sleep, steps, water to dailyLogs'],
  ['getResilientApiBases', 'resolves the server API base URL with offline fallback'],
  ['firebase/firestore', 'reads or writes Firebase Firestore documents'],
  ['@react-navigation', 'registers or navigates between app screens'],
  ['BarcodeScanner', 'uses the device camera to scan product barcodes'],
  ['expo-camera', 'requests camera access for barcode or photo capture'],
  ['expo-image-picker', 'lets the user pick photos from the camera roll'],
  ['lottie-react-native', 'renders Lottie animations in the UI'],
  ['LinearGradient', 'renders gradient backgrounds and buttons'],
  ['onSnapshot', 'subscribes to real-time Firestore updates'],
  ['AsyncStorage', 'caches data locally on the device between app launches'],
  ['mergeFoodNutritionSources', 'calls multi-source nutrition search and merges results'],
  ['sortBestFoodMatches', 'scores and sorts food search hits by relevance'],
  ['requestWorkoutPlan', 'requests an AI-generated workout plan from the server'],
  ['ActiveWorkoutScreen', 'in-gym workout logging with sets and reps'],
  ['trainerClientFirestorePaths', 'uses canonical trainer CRM Firestore collection paths'],
];

function inferFromImports(content) {
  const hints = [];
  for (const [needle, desc] of IMPORT_HINTS) {
    if (content.includes(needle)) hints.push(desc);
  }
  return [...new Set(hints)].slice(0, 3);
}

function isDecorativeComment(line) {
  if (/^[─═\-=\s]+$/.test(line)) return true;
  if (/^─{2,}|═{2,}|-{4,}/.test(line)) return true;
  if (/^={3,}/.test(line)) return true;
  if (line.length < 8) return true;
  return false;
}

function scanExportLineComments(content) {
  const lines = content.split('\n');
  const comments = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('//') && i + 1 < lines.length && /export/.test(lines[i + 1])) {
      const text = line.replace(/^\/\/\s*/, '');
      if (!isDecorativeComment(text)) comments.push(text);
    }
  }
  return comments.slice(0, 4);
}

function describeKeyExports(keyExports, content) {
  if (!keyExports) return null;
  const names = keyExports.split(',').map((s) => s.trim()).filter(Boolean);
  const lineComments = scanExportLineComments(content);
  if (lineComments.length >= 2) {
    return `${lineComments.slice(0, 2).join('. ')}.`;
  }
  if (/permission/i.test(keyExports)) {
    const readable = names.map((n) => humanize(n)).join(', ');
    return `Requests and checks device permissions (${readable}) using Expo Camera, Audio, and ImagePicker APIs.`;
  }
  return null;
}

function scanCodeSignals(content) {
  const apis = [...content.matchAll(/['"`](\/api\/[^'"`]+)['"`]/g)].map((m) => m[1]).slice(0, 4);
  const firestore = [...content.matchAll(/['"`]((?:users|trainer_clients|clients|dailyLogs|conversations|coachThreads)[^'"`]*)['"`]/g)]
    .map((m) => m[1])
    .slice(0, 3);
  const describes = [...content.matchAll(/describe\s*\(\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);
  const its = [...content.matchAll(/\bit\s*\(\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]).slice(0, 4);
  const fnDocs = [];
  const fnRe = /\/\*\*([^*][\s\S]*?)\*\/\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
  let fm;
  while ((fm = fnRe.exec(content))) {
    const doc = fm[1].replace(/\s+/g, ' ').trim().slice(0, 120);
    if (doc && !doc.includes('@file-header')) fnDocs.push({ name: fm[2], doc });
  }
  const uiStrings = [...content.matchAll(/(?:title|label|placeholder|headerTitle)\s*[=:]\s*['"`]([^'"`]{4,60})['"`]/gi)]
    .map((m) => m[1])
    .slice(0, 3);
  return { apis, firestore, describes, its, fnDocs, uiStrings };
}

function isGenericPurpose(p) {
  if (!p) return true;
  const t = p.toLowerCase();
  return (
    t.includes('feature module for coach connect') ||
    t.startsWith('ui screen or component:') && t.length < 80 ||
    t.startsWith('data/service layer:') && t.length < 80
  );
}

function describeAsset(rel, base) {
  const folder = dirKey(rel);
  const usage = ASSET_USAGE[base] || ASSET_USAGE[base.replace(/ /g, '_')];
  if (usage) return [usage, `Bundled static asset under \`${folder}\`.`];

  const stem = humanize(base);
  if (rel.includes('lottie') || rel.includes('Lotties') || (base.endsWith('.json') && !rel.includes('daily-quotes'))) {
    return [
      `Lottie animation "${stem}" — plays during onboarding steps, loading states, or empty-state illustrations.`,
      `Imported via \`lottie-react-native\` or the onboarding icon registry in \`${folder}\`.`,
    ];
  }
  if (rel.includes('onboarding-consolidated') || rel.includes('New Icons')) {
    return [
      `Onboarding picker icon: ${stem}. Shown when the user selects equipment, experience, gender, or similar profile options.`,
      `Duplicated/consolidated asset path so onboarding screens can import icons consistently.`,
    ];
  }
  if (/\.(png|gif|webp|jpe?g)$/i.test(base)) {
    return [
      `PNG/GIF image "${stem}" used as a visual icon or illustration in the ${folder.split('/')[0] || 'app'} UI.`,
      `Loaded with \`require()\` — not executable code; safe to rename if you update all import paths.`,
    ];
  }
  if (base === 'dailyQuotesList.json') {
    return [
      'JSON array of motivational quotes rotated on the client home "daily quote" card.',
      'No logic in this file — `DailyQuoteCard` imports and picks a quote by date.',
    ];
  }
  if (base.endsWith('.md')) {
    return [
      'Developer documentation for navigating the codebase.',
      'Regenerate with `node scripts/generateSrcFileCatalog.mjs`.',
    ];
  }
  return [`Static asset \`${base}\` in \`${folder}\`.`, 'Referenced by nearby UI code via require/import.'];
}

function describeTest(rel, base, content, signals) {
  const subject = signals.describes.length
    ? signals.describes.join('; ')
    : humanize(base.replace(/\.(test|spec)\./, '.'));
  const cases = signals.its.length ? ` Tests include: ${signals.its.join('; ')}.` : '';
  return [
    `Automated Jest tests for ${subject}.`,
    `Catches regressions before deploy — run with \`npm test\`.${cases}`,
  ];
}

function describeCoachToolModal(base) {
  const stem = base.replace(/\.jsx?$/, '');
  const action = TOOL_MODAL_ACTIONS[stem];
  if (action) {
    return [
      `Popup that slides up when the AI Coach wants you to confirm: ${action}.`,
      'You review the details, tap confirm, then the app saves it — or cancel to do nothing.',
    ];
  }
  return [
    `Popup to confirm a coach action (${humanize(stem)}) before anything is saved.`,
    'Part of the coach chat flow — nothing is written until you approve.',
  ];
}

function isStubReexport(content) {
  const stripped = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .trim();
  if (stripped.length > 400) return false;
  if (/export\s*\{\s*default\s*\}\s*from\s*['"]/.test(stripped)) return true;
  if (/^module\.exports\s*=\s*require\(/.test(stripped)) return true;
  if (/^export\s*\{[^}]+\}\s*from\s*['"][^'"]+['"]\s*;?\s*$/.test(stripped)) return true;
  return false;
}

function detectFlags(rel, content) {
  const flags = [];
  const folder = dirKey(rel);
  if (KNOWN_STUBS.has(rel) || isStubReexport(content)) flags.push('STUB');
  if (KNOWN_DEAD.has(rel) || folder.includes('/voice') || folder.endsWith('/voice')) flags.push('DEAD');
  const parts = folder.split('/');
  if (parts.some((p) => JARGON_FOLDER_BITS.has(p))) flags.push('JARGON FOLDER');
  return flags;
}

function whoUsesIt(rel) {
  if (rel.startsWith('client-app/')) return 'Trainee (client) app';
  if (rel.startsWith('trainer-app/')) return 'Trainer app';
  if (rel.startsWith('ai-coach/')) return 'Both roles (AI Coach tab)';
  if (rel.startsWith('for-both/') || rel.startsWith('helpers/') || rel.startsWith('theme/')) {
    return 'Both roles';
  }
  if (rel.startsWith('auth/') || rel.startsWith('app-start/')) return 'Everyone (login / app start)';
  if (rel.startsWith('nutrition/') || rel.startsWith('workouts/') || rel.startsWith('metrics/')) {
    return 'Mostly trainees; trainers may view related data';
  }
  if (rel.startsWith('subscription/')) return 'Trainers (paid Coach Connect Pro)';
  if (rel.startsWith('__tests__/')) return 'Developers only (automated tests)';
  if (rel.startsWith('assets/')) return 'Everyone (pictures / animations)';
  return 'Shared / cross-app';
}

/** Soften common jargon so a recruiter can skim */
function recruiterize(text) {
  if (!text) return '';
  return text
    .replace(/\bFirestore\b/gi, 'cloud database')
    .replace(/\bHTTP client\b/gi, 'code that talks to the app server')
    .replace(/\bAPI calls?\b/gi, 'requests to the app server')
    .replace(/\bReact Native\b/g, 'phone app')
    .replace(/\bReact hook\b/gi, 'reusable screen helper')
    .replace(/\bReact context\b/gi, 'shared app setting')
    .replace(/\bJSX\b/g, 'screen code')
    .replace(/\bmodal\b/gi, 'popup')
    .replace(/\bbottom sheet\b/gi, 'popup that slides up')
    .replace(/\bpersistence\b/gi, 'saving data for next time')
    .replace(/\bCloud Run backend\b/gi, 'Coach Connect server')
    .replace(/\bDeepSeek\b/gi, 'the AI model')
    .replace(/\bfetch\/Firestore\b/gi, 'load/save')
    .replace(/\s+/g, ' ')
    .trim();
}


function describeScreen(rel, base, folder, content, importHints) {
  const h = humanize(base.replace(/\.(jsx?|tsx?)$/, ''));
  if (importHints.length) {
    return [
      `${h} — the screen the user sees for this part of the ${folder.split('/')[0] || 'app'} flow.`,
      importHints.join('; ') + '.',
    ];
  }
  return [
    `${h} — full-screen React Native view in \`${folder}\`.`,
    `Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in ${folder.split('/')[0] || 'app'}.`,
  ];
}

function describeByFilename(rel, base, folder, content = '') {
  const stem = base.replace(/\.(jsx?|tsx?|cjs)$/, '');
  const h = humanize(stem);
  const importHints = inferFromImports(content);

  if (base.includes('Helpers') || /helpers?\.(js|jsx)$/i.test(base)) {
    return [
      `Shared UI/logic helpers for ${folder.split('/').pop() || 'this feature'} — imported by sibling modals and screens.`,
      'Not a screen itself; contains reusable pieces like confirm/cancel rows, labels, and styling tokens.',
    ];
  }

  if (
    (folder.startsWith('ai-coach/chat-ui/tool-modals') || /tool-modals/.test(folder)) &&
    /(Modal|Sheet)\.(jsx?|tsx?)$/.test(base)
  ) {
    return describeCoachToolModal(base);
  }

  const patterns = [
    [/Screen\.(jsx?|tsx?)$/, () => describeScreen(rel, base, folder, content, importHints)],
    [/Modal\.(jsx?|tsx?)$/, () => [
      `${h} — popup overlay on top of the current screen.`,
      importHints.length
        ? importHints.join('; ') + '.'
        : 'User dismisses it after completing the action or tapping Cancel.',
    ]],
    [/Sheet\.(jsx?|tsx?)$/, () => [
      `${h} — bottom sheet that slides up for a quick decision or form.`,
      importHints.length ? importHints.join('; ') + '.' : 'Does not replace full navigation — closes when done.',
    ]],
    [/^use[A-Z]/, () => {
      const fromDoc = extractDocBlocks(content).find(
        (b) => b.length > 40 && !isGenericPurpose(b) && !b.includes('Purpose:') && !b.includes('@file-header')
      );
      if (fromDoc) {
        return [
          fromDoc.endsWith('.') ? fromDoc : `${fromDoc}.`,
          `React hook in \`${folder}\` — screens call it instead of inlining fetch/Firestore logic.`,
        ];
      }
      const stemPurpose = `${h} loads and manages state for the ${folder.split('/').pop() || 'feature'} feature`;
      const detail = importHints.filter((h) => !/reads or writes Firebase Firestore/i.test(h));
      return [
        `${stemPurpose}${detail.length ? ` (${detail.join('; ')})` : ''}.`,
        'Screens call this hook instead of putting fetch/Firestore logic inline in JSX.',
      ];
    }],
    [/Provider\.(js|jsx)$/, () => {
      if (content.includes('createContext') || content.includes('React.createContext')) {
        return [
          `React context provider for ${h} — wraps child trees so screens can read shared state.`,
          'Descendant components use useContext instead of passing props through every layer.',
        ];
      }
      return [
        `${h} — singleton service class or module (not React Context) that centralizes ${folder.split('/').pop()} operations.`,
        'Screens import the default export and call methods on it.',
      ];
    }],
    [/Service\.(js|jsx)$/, () => [`Service module handling API calls and data persistence for ${h}.`, 'Screens import functions from here rather than calling fetch/Firestore directly.']],
    [/Firestore\.(js|jsx)$/, () => [`Firestore read/write helpers for ${h} documents.`, 'Centralizes collection paths and query shapes for this feature.']],
    [/Helpers?\.(js|jsx)$/, () => [`Pure helper functions for ${h} — no UI, no side effects.`, `Imported by screens and services in \`${folder}\`.`]],
    [/Theme\.(js|jsx)$/, () => [`Color, spacing, and typography tokens for ${folder}.`, 'Import these constants to keep visual styling consistent across related screens.']],
    [/routes\.(js|jsx)$/, () => ['Central registry of route/screen names used by React Navigation.', 'Prevents typos when pushing screens — import ROUTES.X instead of raw strings.']],
    [/config\.(js|jsx)$/, () => ['App configuration constants (Firebase keys reference, feature flags, env-driven values).', 'Read by LoginGate and app entry — do not commit secrets here; use EXPO_PUBLIC_ env vars.']],
  ];

  for (const [re, fn] of patterns) {
    if (re.test(base)) return fn();
  }
  return null;
}

function describeCodeFile(rel, content) {
  if (OVERRIDES[rel]) return OVERRIDES[rel];

  const base = path.basename(rel);
  const folder = dirKey(rel);
  const { purpose, area, keyExports } = extractHeaderFields(content);
  const signals = scanCodeSignals(content);
  const docBlocks = extractDocBlocks(content);
  const byName = describeByFilename(rel, base, folder, content);
  const importHints = inferFromImports(content);
  const exportComments = scanExportLineComments(content);

  const realDoc = docBlocks.find(
    (b) =>
      b.length > 25 &&
      !b.includes('Purpose:') &&
      !b.includes('Why it matters:') &&
      !b.includes('Key exports:') &&
      !b.includes('Feature module for Coach Connect') &&
      !b.includes('Converted from Lovable') &&
      !/^[─═\-=\s]+/.test(b)
  );

  let s1 = '';
  let s2 = '';

  // Prefer real file docs over filename heuristics when the JSDoc is specific.
  // Screens/modals/hooks only fall back to byName when docs are missing/generic.
  const isUiFile = /Screen\.(jsx?|tsx?)$|Modal\.(jsx?|tsx?)$|Sheet\.(jsx?|tsx?)$|^use[A-Z]/.test(base);
  if (realDoc && realDoc.length > 30) {
    let doc = realDoc;
    if (doc.includes('Responsibilities:')) {
      const after = doc.split('Responsibilities:')[1]?.trim();
      const before = doc.split('Responsibilities:')[0]?.trim();
      // Prefer the title line + responsibilities bullets turned into prose
      if (before && before.length > 20) {
        s1 = before.endsWith('.') ? before : `${before}.`;
        if (after) {
          const bullets = after
            .split(/\s*-\s+/)
            .map((x) => x.trim())
            .filter((x) => x.length > 8)
            .slice(0, 5);
          if (bullets.length) s2 = `Responsibilities: ${bullets.join('; ')}.`;
        }
      } else {
        s1 = doc.endsWith('.') ? doc : `${doc}.`;
      }
    } else {
      s1 = doc.endsWith('.') ? doc : `${doc}.`;
    }
  } else if (exportComments.length >= 1) {
    s1 = exportComments.slice(0, 2).join(' ') + (exportComments.length ? '.' : '');
  } else if (!isGenericPurpose(purpose)) {
    s1 = stripBoilerplate(purpose);
    if (s1 && !s1.endsWith('.')) s1 += '.';
  } else if (keyExports && describeKeyExports(keyExports, content)) {
    s1 = describeKeyExports(keyExports, content);
  } else if (byName) {
    [s1, s2] = byName;
  } else if (signals.fnDocs.length) {
    const top = signals.fnDocs[0];
    s1 = top.doc || `${humanize(base)} implements ${top.name}().`;
  } else if (importHints.length) {
    const useful = importHints.filter((h) => !/reads or writes Firebase Firestore/i.test(h));
    s1 = useful.length
      ? `${humanize(base)} — ${useful[0]}.`
      : `${humanize(base)} in \`${folder}\`.`;
  } else {
    s1 = `${humanize(base)} in \`${folder}\`.`;
  }

  // If we still have nothing useful for UI files, use byName as fallback.
  if (isUiFile && byName && (!s1 || s1.length < 40 || / in `[^`]+`\.$/.test(s1))) {
    [s1, s2] = byName;
  }

  if (!s2) {
    const parts = [];
    if (byName?.[1]) s2 = byName[1];
    if (importHints.length > 1) parts.push(importHints.slice(1).join('; '));
    if (signals.apis.length) parts.push(`hits API routes ${signals.apis.slice(0, 2).join(', ')}`);
    if (signals.firestore.length) parts.push(`uses Firestore (\`${signals.firestore[0]}\`)`);
    if (signals.uiStrings.length) parts.push(`UI labels include "${signals.uiStrings[0]}"`);

    if (folder.startsWith('for-both/api')) parts.push('talks to the Coach Connect server with the signed-in user');
    if (folder.startsWith('for-both/payments')) parts.push('paying a trainer / Stripe Connect flows');
    if (folder.startsWith('subscription')) parts.push('Trainer Pro paywall / trial');
    if (folder.includes('ai-coach') && folder.includes('tools')) parts.push('coach wants an action → show popup → you confirm → app saves');
    if (folder.includes('ai-coach/logic/context')) parts.push('builds what the AI coach knows about you before answering');
    if (folder.startsWith('nutrition/food-search')) parts.push('search food → pick one → log to today’s meals');
    if (folder.startsWith('trainer-app/client-records')) parts.push('trainer–client linking in the cloud database');
    if (folder.startsWith('metrics/daily-metrics')) parts.push('saves daily steps/sleep/water/weight for the signed-in user');

    if (!s2 && parts.length) {
      s2 = parts.slice(0, 2).join('; ') + '.';
    } else if (!s2 && docBlocks.length > 1) {
      const extra = stripBoilerplate(docBlocks.find((b) => b !== s1 && b.length > 20) || '');
      if (extra.length > 20) s2 = extra.endsWith('.') ? extra : `${extra}.`;
    } else if (!s2 && area) {
      s2 = `Part of ${area.replace(/^src\//, '')} in Coach Connect.`;
    } else if (!s2) {
      s2 = `Part of \`${folder}\` — search the repo for "${base.replace(/\.(jsx?|tsx?|cjs)$/, '')}" to see what imports it before renaming.`;
    }
  }

  if (s1) s1 = s1.charAt(0).toUpperCase() + s1.slice(1);
  if (s2) s2 = s2.charAt(0).toUpperCase() + s2.slice(1);

  return [s1, s2];
}

function twoSentences(rel, content) {
  const base = path.basename(rel);
  const ext = path.extname(base).toLowerCase();

  if (/\.(png|gif|jpe?g|webp|svg)$/i.test(ext)) return describeAsset(rel, base);
  if (base.endsWith('.json')) return describeAsset(rel, base);
  if (base.endsWith('.md')) return describeAsset(rel, base);

  const isTest = rel.includes('__tests__') || /\.(test|spec)\.(js|jsx)$/.test(base);
  if (isTest) return describeTest(rel, base, content, scanCodeSignals(content));

  return describeCodeFile(rel, content);
}

function inferFolderBlurb(dir) {
  if (FOLDER_BLURBS[dir]) return FOLDER_BLURBS[dir];
  const parts = dir.split('/');
  while (parts.length) {
    const key = parts.join('/');
    if (FOLDER_BLURBS[key]) return FOLDER_BLURBS[key];
    parts.pop();
  }
  return `Source files for the \`${dir}\` module.`;
}

function build() {
  const files = walk(SRC)
    .map(relFromSrc)
    .filter((rel) => rel !== 'SRC_FILE_CATALOG.md')
    .sort();
  const byDir = new Map();
  for (const rel of files) {
    const d = dirKey(rel);
    if (!byDir.has(d)) byDir.set(d, []);
    byDir.get(d).push(rel);
  }

  const codeCount = files.filter((f) => /\.(jsx?|tsx?)$/.test(f)).length;
  const today = new Date().toISOString().slice(0, 10);

  let md = `# Coach Connect — Complete \`src/\` File Catalog

**${files.length} files** (${codeCount} JS/JSX modules) — generated ${today}.

Regenerate: \`node scripts/generateSrcFileCatalog.mjs\`

Copies: \`src/SRC_FILE_CATALOG.md\` and \`docs/SRC_FILE_CATALOG.md\`

---

## Brief for Claude (or any rename helper)

**Product:** Coach Connect — fitness app for trainees and trainers (React Native / Expo).

**Owner goal:** Make the codebase readable to a **non-technical recruiter**. Folder and file names should sound like everyday product language, not developer jargon.

**What this catalog is for:** Each entry explains **what the file actually does** in plain English. Use that to propose better names and which subfolders to delete/flatten. **Do not invent renames from the old filename alone.**

**Constraints when proposing renames later:**

- Keep the main top-level folders (\`ai-coach\`, \`client-app\`, \`trainer-app\`, \`for-both\`, \`nutrition\`, etc.).
- Prefer fewer subfolders; kill jargon folders (\`persistence\`, \`logic\`, \`chat-api\`, \`voice\` if unused, fake \`screens/\` stubs).
- Prefer short everyday names over long technical ones.
- **Never** change Firebase production project id \`anatrox-auth\` or live \`EXPO_PUBLIC_FIREBASE_*\` / \`.env\` project identity.
- Leave \`Suggested name:\` blank in this catalog — fill names in a separate rename plan Chris approves.

**Flags you will see:**

- \`STUB\` — fake file that only re-exports another file (safe delete after retargeting imports).
- \`DEAD\` — likely unused product area (e.g. voice/speech).
- \`JARGON FOLDER\` — parent folder name is confusing to non-tech readers.

---

## Architecture map (how \`src/\` is organized)

| Top-level folder | What it is (plain English) |
|---|---|
| \`app-start/\` | App launch — login gate, then open trainee app or trainer app |
| \`auth/\` | Login, signup, onboarding, password reset |
| \`client-app/\` | Everything only trainees see |
| \`trainer-app/\` | Everything only trainers see |
| \`ai-coach/\` | In-app AI Coach (home + conversation + confirm popups) |
| \`nutrition/\` | Food search, barcode, daily food log |
| \`workouts/\` | Active workout, exercise videos, AI workout plans |
| \`messaging/\` | Texting between trainee and trainer |
| \`metrics/\` | Daily steps/sleep/water/weight + home quotes |
| \`notifications/\` | Push notification wording and unread counts |
| \`subscription/\` | Trainer Pro paywall / trial |
| \`settings/\` | Settings, FAQ, privacy, bug report |
| \`for-both/\` | Shared by both roles (payments, notes, weekly report, server calls) |
| \`logout-cleanup/\` | Clear local data on logout |
| \`error-logging/\` | Capture and send error reports |
| \`safety/\` | Block / report |
| \`spreadsheet-files/\` | Spreadsheet library for phone vs web |
| \`theme/\` | Colors, dark mode, glass look |
| \`helpers/\` | Tiny shared helpers (dates, height, file types) |
| \`navigation/\` | Bottom nav and screen routing helpers |
| \`components/\` | A few leftover shared payment/onboarding pieces |
| \`assets/\` | Pictures, icons, animations (not logic) |
| \`__tests__/\` | Automated tests (developers only) |

---

## Table of contents

`;

  const dirs = [...byDir.keys()].sort((a, b) => a.localeCompare(b));
  for (const d of dirs) {
    const anchor = d.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'root';
    md += `- [${d || '(root)'}](#${anchor}) (${byDir.get(d).length} files)\n`;
  }

  md += '\n---\n\n';

  for (const d of dirs) {
    const anchor = d.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'root';
    md += `## ${d || 'src/ (root)'}\n\n`;
    md += `<a id="${anchor}"></a>\n\n`;
    md += `**Folder purpose:** ${recruiterize(inferFolderBlurb(d))}\n\n`;

    for (const rel of byDir.get(d)) {
      const abs = path.join(SRC, rel);
      let content = '';
      try {
        content = fs.readFileSync(abs, 'utf8');
      } catch {
        content = '';
      }
      const [s1, s2] = twoSentences(rel, content);
      const what = recruiterize(
        stripBoilerplate([s1, s2].filter(Boolean).join(' '))
          .replace(/\s+/g, ' ')
          .replace(/\s+\./g, '.')
          .trim()
      );
      const flags = detectFlags(rel, content);
      const base = path.basename(rel);

      md += `### \`${base}\`\n\n`;
      md += `- **Path:** \`src/${rel}\`\n`;
      md += `- **What it is:** ${what.endsWith('.') ? what : `${what}.`}\n`;
      md += `- **Who uses it:** ${whoUsesIt(rel)}\n`;
      if (flags.length) md += `- **Flags:** ${flags.map((f) => `\`${f}\``).join(', ')}\n`;
      md += `- **Suggested name:** ___\n\n`;
    }
  }

  md += `---\n\n*End of catalog — ${files.length} files. Regenerate with \`node scripts/generateSrcFileCatalog.mjs\`.*\n`;
  return md;
}

const markdown = build();
fs.writeFileSync(OUT, markdown);
fs.mkdirSync(path.dirname(OUT_DOCS), { recursive: true });
fs.writeFileSync(OUT_DOCS, markdown);
console.log(`Wrote ${OUT}`);
console.log(`Wrote ${OUT_DOCS}`);
