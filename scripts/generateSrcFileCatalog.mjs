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
const OVERRIDES_PATH = path.join(__dirname, 'srcFileCatalogOverrides.json');
const OVERRIDES = fs.existsSync(OVERRIDES_PATH)
  ? JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf8'))
  : {};

const FOLDER_BLURBS = {
  '': 'Root of the React Native / Expo app source. Contains the app entry loader, architecture docs, and this catalog.',
  __tests__: 'Jest test suites for unit, integration, and component tests.',
  '__tests__/components': 'React component tests rendered with Testing Library.',
  '__tests__/fixtures': 'Shared mock data and fixtures imported by multiple tests.',
  '__tests__/integration': 'Multi-module integration tests that exercise real flows (auth, food log, coach).',
  '__tests__/mocks': 'Module mocks for Expo and third-party dependencies in Jest.',
  '__tests__/unit': 'Pure unit tests for helpers, parsers, scoring, and business logic.',
  'ai-coach': 'AI Coach feature root — chat UI plus client-side server-logic helpers.',
  'ai-coach/chat-ui': 'All AI Coach UI — home, chat thread, voice mode, tool confirmation sheets, Firestore persistence.',
  'ai-coach/chat-ui/chat-home': 'Landing screen before entering a coach conversation (prompts, history entry).',
  'ai-coach/chat-ui/chat-thread': 'Main chat screen: message list, composer, attachments, source cards, tool confirmations.',
  'ai-coach/chat-ui/components': 'Reusable coach UI pieces — formatted replies, follow-up bubbles, glass cards, history sidebar.',
  'ai-coach/chat-ui/hooks': 'React hooks for coach chat sessions and related UI state.',
  'ai-coach/chat-ui/lib': 'Coach UI helpers: markdown styles, clipboard, follow-up prompts, web-search reply parsing.',
  'ai-coach/chat-ui/persistence': 'Saves and loads coach message threads to/from Firestore.',
  'ai-coach/chat-ui/screens': 'Top-level screen wrappers that re-export or host coach navigation targets.',
  'ai-coach/chat-ui/tool-modals': 'Confirmation sheets for each coach tool (log water, book session, adjust macros, etc.).',
  'ai-coach/chat-ui/voice': 'Voice-to-text coach interface and speech-recognition helpers.',
  'ai-coach/server-logic': 'Client-side coach backend glue: chat API, context building, tools, vision uploads.',
  'ai-coach/server-logic/chat-api': 'HTTP clients for coach conversations, titles, web-search detection, and chat storage.',
  'ai-coach/server-logic/context': 'Builds the prompt context the coach sees — profile, weekly stats, personal data.',
  'ai-coach/server-logic/macro-recalibration': 'Recalculates macro targets when the coach or user adjusts goals.',
  'ai-coach/server-logic/services': 'Thin service wrappers (e.g. mark-all-messages-read).',
  'ai-coach/server-logic/tools': 'Parses coach tool proposals, decides which UI to show, and runs confirmed actions.',
  'ai-coach/server-logic/trainer-messaging': 'Sends push/in-app notifications from the AI coach to the user\'s trainer.',
  'ai-coach/server-logic/vision': 'Uploads and stores images the user attaches in coach chat.',
  'ai-coach/tools': 'Shared coach tool-call parsers used by chat UI and server-logic.',
  'app-start': 'App shell: AuthGate decides client vs trainer vs login; ClientApp and TrainerApp mount role trees.',
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
  'nutrition/components/premiumFoodCard': 'Premium-styled food card, nutrition facts section, logged-food display.',
  'nutrition/daily-log': 'Daily nutrition log screen, meal cards, Firestore write helpers.',
  'nutrition/food-details': 'Food detail / nutrition facts screen, serving editor, label parsing.',
  'nutrition/food-search': 'Food search screen, ranking, consensus search, confirm-selection sheet.',
  'nutrition/quick-add': 'Quick-add macros without full food search.',
  'nutrition/settings': 'Nutrition onboarding wizard and macro/target settings.',
  'nutrition/utils': 'Nutrition-specific search helpers (casual menu search).',
  settings: 'App-wide settings screens, support config, and legal pages.',
  'settings/screens': 'Settings hub and sub-screens (password, FAQ, bug report, privacy, etc.).',
  shared: 'Cross-cutting code used by both client and trainer: API, components, Firestore, payments, reports.',
  'shared/accessibility': 'a11y prop helpers for screen readers.',
  'shared/api': 'Base URL, auth headers, apiFetch, error logging, push notifications, onboarding sync.',
  'shared/assets': 'Shared Lottie assets and generated onboarding icon registry.',
  'shared/components': 'Reusable components: hero cards, home widgets, modals, notes/files sections.',
  'shared/components/brand': 'Brand logo component.',
  'shared/components/home': 'Home tab shared widgets (aurora banner, daily quote, session card).',
  'shared/components/icons': 'Gradient/icon components for nav and profile cards.',
  'shared/components/modals': 'Generic modals (error, hold-to-confirm, remove trainer).',
  'shared/components/notes-files': 'Files & notes section: PDF/spreadsheet viewers, gallery grid, add modal.',
  'shared/components/onboarding': 'Onboarding form fields (AI opt-in, trainer subscription step).',
  'shared/components/shell': 'App loading screen, boot loading, Coach Connect header, prism flip.',
  'shared/contexts': 'React contexts (AI context provider wrapper).',
  'shared/firestore': 'Generic Firestore pagination and storage upload helpers.',
  'shared/fitness-calculations': 'BMR, TDEE, macro calculations from onboarding inputs.',
  'shared/marketplace': 'Trainer marketplace profile sync to Firestore.',
  'shared/notes-files': 'CRUD helpers for trainer/client notes and file attachments.',
  'shared/payments': 'Stripe Connect / native payment hooks, education copy, payment history.',
  'shared/photo-gallery': 'Shared progress photo gallery screen.',
  'shared/screens': 'Screens used by both roles (weekly report, workout plans, photo gallery re-exports).',
  'shared/services': 'User profile fetch, client registry, Firestore listener utilities.',
  'shared/trainer-location': 'Geocoding / location picker service for trainer profiles.',
  'shared/weekly-report': 'Weekly report screen body, theme, and data builders shared by client/trainer.',
  'shared/weekly-report/components': 'Weekly report UI building blocks (day cards, charts, insights).',
  'shared/weekly-report/data': 'Fetch/map week nutrition, daily logs, and coaching insights for the report.',
  'shared/weekly-report/theme': 'Weekly report theme tokens and React context.',
  'shared/workout-plans': 'Browse-saved-workouts screen shared implementation.',
  'shared/workout-profile': 'Workout profile card icons and visibility rules.',
  'shared-ui': 'Design system: theme, iOS-style tokens, liquid glass, FluidGlass, brand gradients.',
  'shared-ui/layout': 'Layout primitives (centered two-column grid).',
  'shared-ui/liquid': 'Liquid glass UI kit (backgrounds, cards, buttons, halos).',
  'shared-utils': 'Date keys, height conversion, file type detection, Firestore sanitize, workout day labels.',
  subscription: 'Trainer Pro subscription gate, IAP/provider wiring, paywall screens, trial banner.',
  'trainer-app': 'Trainer role: CRM, client list, sessions, documents, payments, dashboard, navigation.',
  'trainer-app/calendar-tab': 'Trainer calendar tab showing upcoming sessions.',
  'trainer-app/client-detail': 'Single-client detail / manage-trainee screen.',
  'trainer-app/client-requests': 'Pending client connection requests and approval flow.',
  'trainer-app/clients-list': 'Roster of linked clients with Firestore load hook.',
  'trainer-app/components': 'Trainer UI widgets (wheel picker, session calendar pieces).',
  'trainer-app/components/sessions': 'Month calendar and session card components.',
  'trainer-app/crm': 'Firestore paths, client name formatting, linked-client resolution, CRM errors.',
  'trainer-app/dashboard': 'Trainer home dashboard content and marketplace modal.',
  'trainer-app/documents': 'Rich document/spreadsheet editor modals for trainer notes and files.',
  'trainer-app/documents/spreadsheet': 'Spreadsheet grid, formulas, format helpers for DocFlow editors.',
  'trainer-app/hooks': 'Trainer session scheduling hooks and SessionsContext.',
  'trainer-app/navigation': 'Trainer shell, stack, overlay screens, navigation hook.',
  'trainer-app/nutrition-tab': 'Trainer view of a client\'s nutrition tab.',
  'trainer-app/payments': 'Payments/billing screen for trainers (Stripe payouts & history).',
  'trainer-app/progress-tab': 'Trainer view of client progress metrics and weight resolution.',
  'trainer-app/screens': 'Misc trainer full screens (scheduling wrappers).',
  'trainer-app/screens/components': 'Picker widgets used by trainer scheduling screens.',
  'trainer-app/sessions': 'Book/schedule training sessions and session push notifications.',
  'trainer-app/weekly-report': 'Trainer weekly report cards/sections for a selected client.',
  'trainer-app/workout-plans': 'Trainer manual workout plan builder screens and services.',
  utils: 'App-wide utilities: error logging, cache cleanup, logout cleanup, xlsx platform shims.',
  workouts: 'Workout plans, active workout tracking, exercise library, plan generation and PDF export.',
  'workouts/active-workout': 'In-gym active workout screen, set logging, workout service, creative plan names.',
  'workouts/components': 'Exercise row and section UI used in plans and active workout.',
  'workouts/exercise-library': 'YouTube exercise library tab, video player, dislike picker.',
  'workouts/plan-builder': 'Manual plan builder field edit forms.',
  'workouts/plan-generator': 'AI workout plan generation: onboarding form, API request, parsing, usage tracking.',
  'workouts/plan-viewer': 'Rendered workout plan result, PDF viewer modal and export service.',
  'workouts/screens': 'Workout plan generator onboarding UI screen.',
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
      `Bottom sheet modal shown when the AI coach proposes a "${humanize(stem)}" tool action.`,
      `User reviews the form, confirms, then the app calls the server to ${action}.`,
    ];
  }
  return [
    `Confirmation modal for an AI coach tool action (${humanize(stem)}).`,
    'Part of the coach chat flow — user must approve before data is written to Firestore.',
  ];
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
    [/config\.(js|jsx)$/, () => ['App configuration constants (Firebase keys reference, feature flags, env-driven values).', 'Read by AuthGate and app entry — do not commit secrets here; use EXPO_PUBLIC_ env vars.']],
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

    if (folder.includes('ai-coach') && folder.includes('tools')) parts.push('part of coach tool parse → validate → confirm → execute flow');
    if (folder.includes('ai-coach/server-logic/context')) parts.push('builds data the AI coach sees in its system prompt');
    if (folder.startsWith('nutrition/food-search')) parts.push('part of search → pick food → log to daily nutrition');
    if (folder.startsWith('trainer-app/crm')) parts.push('trainer–client linking in Firestore CRM collections');
    if (folder.startsWith('metrics/daily-metrics')) parts.push('writes to users/{uid}/dailyLogs/{date}');
    if (folder.startsWith('shared/api')) parts.push('shared authenticated HTTP — prefer over raw fetch');
    if (folder.startsWith('shared/payments')) parts.push('Stripe Connect / client–trainer payment flows');
    if (folder.startsWith('subscription')) parts.push('Trainer Pro / IAP subscription gating');

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
  const files = walk(SRC).map(relFromSrc).sort();
  const byDir = new Map();
  for (const rel of files) {
    const d = dirKey(rel);
    if (!byDir.has(d)) byDir.set(d, []);
    byDir.get(d).push(rel);
  }

  const codeCount = files.filter((f) => /\.(jsx?|tsx?)$/.test(f)).length;

  let md = `# Coach Connect — Complete \`src/\` File Catalog

**${files.length} files** (${codeCount} JS/JSX modules) — generated ${new Date().toISOString().slice(0, 10)}.

Regenerate: \`node scripts/generateSrcFileCatalog.mjs\`

Every file under \`src/\` is listed below (no summaries, no skipped files). Each folder has a purpose blurb; each file has a full paragraph on what it does and how it fits the app — useful before renaming.

Firebase production project ID stays \`anatrox-auth\` (do not rename in config / \`.env\`).

## Architecture map (how \`src/\` is organized)

| Top-level folder | Role |
|---|---|
| \`app-start/\` | Boot + role gate: \`AuthGate\` → \`ClientApp\` or \`TrainerApp\` |
| \`auth/\` | Login, signup, onboarding, password reset |
| \`client-app/\` | Trainee UI: home, dashboard, marketplace, files, client navigation |
| \`trainer-app/\` | Trainer UI: CRM, sessions, documents, payments, trainer navigation |
| \`ai-coach/\` | AI Coach chat UI + client-side coach API/tools/context |
| \`nutrition/\` | Food search, barcode, daily log, food details, nutrition settings |
| \`workouts/\` | Active workout, exercise library, AI plan generate/view |
| \`messaging/\` | Shared chat list + thread screens |
| \`metrics/\` | Daily metrics (steps/sleep/water/weight) + daily quotes |
| \`notifications/\` | Push notification helpers |
| \`subscription/\` | Trainer Pro paywall / IAP / trial gate |
| \`settings/\` | Settings hub, support, privacy, bug report |
| \`shared/\` | Cross-role components, API, payments, weekly report, Firestore helpers |
| \`shared-ui/\` | Design system / liquid glass / theme tokens |
| \`shared-utils/\` | Pure helpers (dates, height, sanitize, file types) |
| \`navigation/\` | Route names + shell navigation context |
| \`components/\` | Root-level components (payments / onboarding leftovers) |
| \`assets/\` | Images, icons, Lottie JSON (not logic) |
| \`utils/\` | Error logging, logout cache clear, xlsx shims |
| \`__tests__/\` | Jest unit / integration / component tests |
| \`lib/\` | Tiny root libs (e.g. sessions) |

**Rename tip:** Prefer renaming folders first with a clear map (\`client\`→\`client-app\` style), then files. Grep for the old basename before renaming — many screens have duplicate re-export wrappers under \`shared/screens\` or \`*/screens\`.

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
    md += `## ${d || 'src/ (root)'} {#${anchor}}\n\n`;
    md += `**Folder purpose:** ${inferFolderBlurb(d)}\n\n`;

    for (const rel of byDir.get(d)) {
      const abs = path.join(SRC, rel);
      let content = '';
      try {
        content = fs.readFileSync(abs, 'utf8');
      } catch {
        content = '';
      }
      const [s1, s2] = twoSentences(rel, content);
      const paragraph = stripBoilerplate([s1, s2].filter(Boolean).join(' '))
        .replace(/\s+/g, ' ')
        .replace(/\s+\./g, '.')
        .trim();
      md += `### \`${rel}\`\n\n`;
      md += `${paragraph.endsWith('.') ? paragraph : `${paragraph}.`}\n\n`;
    }
  }

  md += `---\n\n*End of catalog — ${files.length} files. Regenerate with \`node scripts/generateSrcFileCatalog.mjs\`.*\n`;
  return md;
}

fs.writeFileSync(OUT, build());
console.log(`Wrote ${OUT}`);
