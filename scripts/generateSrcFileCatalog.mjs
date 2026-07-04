#!/usr/bin/env node
/**
 * Generate src/SRC_FILE_CATALOG.md — every file under src/, grouped by folder.
 * Two plain-English sentences per file (what it does + how it fits in).
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
  '': 'Root of the React Native / Expo app source. Contains the app entry loader and this catalog.',
  __tests__: 'Jest test suites for unit, integration, and component tests.',
  '__tests__/components': 'React component tests rendered with Testing Library.',
  '__tests__/fixtures': 'Shared mock data and fixtures imported by multiple tests.',
  '__tests__/integration': 'Multi-module integration tests that exercise real flows (auth, food log, coach).',
  '__tests__/mocks': 'Module mocks for Expo and third-party dependencies in Jest.',
  '__tests__/unit': 'Pure unit tests for helpers, parsers, scoring, and business logic.',
  ai: 'Server-facing AI coach logic: context gathering, tool execution, chat API clients, and vision uploads.',
  'ai/chat-api': 'HTTP clients and routing for AI coach conversations, web search detection, and chat storage.',
  'ai/context': 'Builds the prompt context the coach sees — user profile, weekly stats, nutrition, workouts.',
  'ai/macro-recalibration': 'Recalculates macro targets when the coach or user adjusts goals.',
  'ai/services': 'Thin service wrappers for ask-server, web search, and read-receipt helpers.',
  'ai/tools': 'Parses coach tool-call proposals from messages, validates them, and executes confirmed actions.',
  'ai/trainer-messaging': 'Sends push/in-app notifications from the AI coach to the user\'s trainer.',
  'ai/vision': 'Uploads and stores images the user attaches in coach chat.',
  aiChat: 'All AI Coach UI — home screen, chat thread, voice mode, tool confirmation modals, and Firestore persistence.',
  'aiChat/chat-home': 'Landing screen before entering a coach conversation (prompts, history entry).',
  'aiChat/chat-thread': 'Main chat screen: message list, composer, attachments, source cards, tool confirmations.',
  'aiChat/components': 'Reusable coach UI pieces — formatted replies, follow-up bubbles, glass cards, orb.',
  'aiChat/lib': 'Coach UI helpers: markdown styles, clipboard, capabilities list, web-search reply parsing.',
  'aiChat/persistence': 'Saves and loads coach message threads to/from Firestore.',
  'aiChat/screens': 'Top-level screen wrappers that re-export or host coach navigation targets.',
  'aiChat/tool-modals': 'Confirmation sheets for each coach tool (log water, book session, adjust macros, etc.).',
  'aiChat/toolModals': 'Legacy/alternate location for deload-generation modal (may overlap tool-modals).',
  'aiChat/voice': 'Voice-to-text coach interface and home entry for hands-free coaching.',
  app: 'App shell: AuthGate decides client vs trainer vs login; ClientApp and TrainerApp mount role-specific trees.',
  assets: 'Static images, Lottie animations, and icon PNGs bundled with the app.',
  'assets/icons': 'Nutrition, workout, and UI icon PNGs/GIFs used across onboarding and dashboards.',
  'assets/icons/New Icons': 'Onboarding picker icons (equipment, experience level, gender).',
  'assets/lottie': 'Lottie JSON animations for onboarding steps and empty states.',
  'assets/animations/legacy': 'Legacy branded Lottie files (AI, food, fitness themes).',
  'assets/onboarding-consolidated': 'Flattened onboarding icon set (duplicate paths for consolidated imports).',
  auth: 'Login, signup, password reset, onboarding wizard, and auth-gate helper logic.',
  'auth/services': 'Password-reset email requests via Firebase/backend.',
  client: 'Everything specific to the client (trainee) role — home, dashboard, marketplace, files, navigation.',
  'client/components': 'Shared client-only components (review sheets, trainer file modals).',
  'client/dashboard': 'Client dashboard: hero card, stats, trainer card, workout log hook.',
  'client/files': 'Client view of trainer-shared files, notes, and personal file gallery.',
  'client/home': 'Client home tab: welcome card, bootstrap hooks, home screen styles.',
  'client/hooks': 'Client-specific React hooks (daily metrics for home).',
  'client/lib': 'Small client-only utilities (billing label formatting).',
  'client/marketplace': 'Find-a-trainer marketplace: filters, trainer cards, request modals.',
  'client/marketplace/components': 'Marketplace UI building blocks (glass cards, profile sheets, filter modal).',
  'client/marketplace/screens': 'Full-screen marketplace flows (search, trainer detail).',
  'client/meal-plan': 'Client meal plan viewer (if assigned by trainer).',
  'client/messaging': 'Client-side messaging entry screens.',
  'client/navigation': 'Client app shell, bottom nav, overlay stack, screen navigation hook.',
  'client/photo-gallery': 'Client progress photo gallery screen wrapper.',
  'client/screens': 'Misc client full screens (plan viewer, conversations re-exports).',
  'client/settings': 'Client-specific settings sub-screens (goals, units, social sharing, account).',
  'client/weekly-report': 'Client weekly progress report view.',
  'client/workout-plans': 'Client AI workout plans list screen.',
  lib: 'Small shared libraries at src root (sessions helper).',
  navigation: 'Cross-app navigation utilities (shell navigate helper).',
  nutrition: 'Full nutrition feature: daily log, food search, barcode, facts, settings, premium food cards.',
  'nutrition/barcode': 'Barcode scanner flow and Serper/USDA lookup for packaged foods.',
  'nutrition/components': 'Shared nutrition UI widgets (gradient frames, etc.).',
  'nutrition/components/premiumFoodCard': 'Premium-styled food card, nutrition facts section, logged-food display.',
  'nutrition/daily-log': 'Daily nutrition log screen, meal cards, Firestore write helpers.',
  'nutrition/food-details': 'Food detail / nutrition facts screen, serving editor, label parsing.',
  'nutrition/food-search': 'Food search screen, ranking, consensus search, confirm-selection sheet.',
  'nutrition/quick-add': 'Quick-add macros without full food search.',
  'nutrition/screens': 'Standalone nutrition screens (macro tracker).',
  'nutrition/settings': 'Nutrition onboarding wizard and macro/target settings.',
  'nutrition/utils': 'Nutrition-specific search helpers (casual menu search).',
  profile: 'User profile screens shared or routed from settings.',
  'profile/screens': 'Profile view/edit screen.',
  screens: 'Legacy screen location (some settings screens still here).',
  'screens/settings': 'Older settings screens (ForgotPasswordFlow) and shared settings chrome hook.',
  'screens/settings/shared': 'Shared hooks/styles for settings screens.',
  settings: 'App-wide settings screens, support config, and legal pages.',
  'settings/screens': 'Settings hub and sub-screens (password, FAQ, bug report, rest timer, etc.).',
  shared: 'Cross-cutting code used by both client and trainer: API, UI kit, Firestore, messaging, metrics.',
  'shared/accessibility': 'a11y prop helpers for screen readers.',
  'shared/api': 'Base URL, auth headers, apiFetch, error logging, push notifications, onboarding sync.',
  'shared/assets': 'Shared Lottie assets and generated onboarding icon registry.',
  'shared/coach-tools': 'Parses structured tool-call JSON from coach model responses.',
  'shared/components': 'Reusable components: hero cards, home widgets, modals, notes/files sections.',
  'shared/components/home': 'Home tab shared widgets (aurora banner, daily quote, session card).',
  'shared/components/icons': 'Gradient/icon components for nav and profile cards.',
  'shared/components/modals': 'Generic modals (error, hold-to-confirm, remove trainer).',
  'shared/components/notes-files': 'Files & notes section: PDF/spreadsheet viewers, gallery grid, add modal.',
  'shared/components/onboarding': 'Onboarding form fields (AI opt-in, trainer location).',
  'shared/components/shell': 'App loading screen and Coach Connect header bar.',
  'shared/contexts': 'React contexts (AI context provider wrapper).',
  'shared/daily-metrics': 'Weight, steps, sleep, water — local date keys and Firestore daily log writes.',
  'shared/daily-quotes': 'Static JSON list of motivational quotes for home card.',
  'shared/firestore': 'Generic Firestore pagination and storage upload helpers.',
  'shared/fitness-calculations': 'BMR, TDEE, macro calculations from onboarding inputs.',
  'shared/hooks': 'Shared hooks (exercise library fetch).',
  'shared/icons': 'Lucide-like icon wrapper.',
  'shared/marketplace': 'Trainer marketplace profile sync to Firestore.',
  'shared/messaging': 'Conversations list and messaging thread screens (shared between roles).',
  'shared/notes-files': 'CRUD helpers for trainer/client notes and file attachments.',
  'shared/notifications': 'Push notification text formatting and Firestore notification management.',
  'shared/photo-gallery': 'Shared progress photo gallery screen.',
  'shared/screens': 'Screens used by both roles (weekly report, workout plans, photo gallery).',
  'shared/services': 'User profile fetch, client registry, Firestore listener utilities.',
  'shared/trainer-location': 'Geocoding / location picker service for trainer profiles.',
  'shared/ui': 'Design system: theme, iOS 18 tokens, liquid glass components, brand gradients.',
  'shared/ui/layout': 'Layout primitives (centered two-column grid).',
  'shared/ui/liquid': 'Liquid glass UI kit (backgrounds, cards, buttons, halos).',
  'shared/utils': 'Date keys, height conversion, file type detection, Firestore sanitize, workout day labels.',
  'shared/weekly-report': 'Weekly report screen component shared by client/trainer flows.',
  'shared/workout-plans': 'AI workout plans screen shared implementation.',
  'shared/workout-profile': 'Workout profile card icons and visibility rules.',
  trainer: 'Trainer role: CRM, client list, sessions, documents, payments, dashboard, navigation.',
  'trainer/calendar-tab': 'Trainer calendar tab showing upcoming sessions.',
  'trainer/client-detail': 'Single-client detail screen (notes, plans, metrics).',
  'trainer/client-requests': 'Pending client connection requests and approval flow.',
  'trainer/clients-list': 'Roster of linked clients with Firestore load hook.',
  'trainer/components': 'Trainer dashboard hero, wheel picker, session calendar widgets.',
  'trainer/components/sessions': 'Month calendar and session card components.',
  'trainer/crm': 'Firestore paths, client name formatting, linked-client resolution, CRM errors.',
  'trainer/dashboard': 'Trainer home dashboard content and marketplace modal.',
  'trainer/documents': 'Rich document/spreadsheet editor modals shared with clients.',
  'trainer/home': 'Trainer home tab UI building blocks.',
  'trainer/hooks': 'Trainer session scheduling hooks.',
  'trainer/marketplace': 'Trainer-side marketplace/search screen.',
  'trainer/messaging': 'Trainer messaging screens.',
  'trainer/navigation': 'Trainer shell, stack, overlay screens, navigation hook.',
  'trainer/nutrition-tab': 'Trainer view of a client\'s nutrition tab.',
  'trainer/payments': 'Payments/billing screen for trainers.',
  'trainer/photo-gallery': 'Trainer view of client progress photos.',
  'trainer/progress-tab': 'Trainer view of client progress metrics.',
  'trainer/screens': 'Misc trainer full screens (session form, scheduling, re-export wrappers).',
  'trainer/sessions': 'Session push notification helper.',
  'trainer/weekly-report': 'Trainer weekly report for a client.',
  'trainer/workout-plans': 'Trainer workout plan builder (manual + AI) screens and services.',
  utils: 'App-wide utilities: error logging, cache cleanup, logout cleanup, xlsx platform shims.',
  workouts: 'Workout plans, active workout tracking, exercise library, plan generation and PDF export.',
  'workouts/active-workout': 'In-gym active workout screen, set logging, workout service.',
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
    .replace(/\s*—?\s*Feature module for Coach Connect\.?$/i, '')
    .replace(/\.\s*Feature module for Coach Connect\.?$/i, '.')
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
    (folder.startsWith('aiChat/tool-modals') || folder === 'aiChat/toolModals') &&
    /Modal\.(jsx?|tsx?)$/.test(base)
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
    [/^use[A-Z]/, () => [
      importHints.length
        ? `Hook: ${importHints[0]}.`
        : `${h} — React hook encapsulating data loading and state for ${folder}.`,
      'Screens call this hook instead of putting fetch/Firestore logic inline in JSX.',
    ]],
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

  // Screens, modals, hooks only — not services named *Provider.js
  const isUiFile = /Screen\.(jsx?|tsx?)$|Modal\.(jsx?|tsx?)$|Sheet\.(jsx?|tsx?)$|^use[A-Z]/.test(base);
  if (byName && isUiFile) {
    [s1, s2] = byName;
  } else   if (realDoc && realDoc.length > 30) {
    let doc = realDoc;
    if (doc.includes('Responsibilities:')) {
      doc = doc.split('Responsibilities:')[0].trim();
    }
    s1 = doc.endsWith('.') ? doc : `${doc}.`;
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
    s1 = `${humanize(base)} — ${importHints[0]}.`;
  } else {
    s1 = `${humanize(base)} in \`${folder}\`.`;
  }

  if (!s2) {
    const parts = [];
    if (byName?.[1]) s2 = byName[1];
    if (importHints.length > 1) parts.push(importHints.slice(1).join('; '));
    if (signals.apis.length) parts.push(`hits API routes ${signals.apis.slice(0, 2).join(', ')}`);
    if (signals.firestore.length) parts.push(`uses Firestore (\`${signals.firestore[0]}\`)`);
    if (signals.uiStrings.length) parts.push(`UI labels include "${signals.uiStrings[0]}"`);

    if (folder.startsWith('ai/tools')) parts.push('part of coach tool parse → validate → confirm → execute flow');
    if (folder.startsWith('ai/context')) parts.push('builds data the AI coach sees in its system prompt');
    if (folder.startsWith('nutrition/food-search')) parts.push('part of search → pick food → log to daily nutrition');
    if (folder.startsWith('trainer/crm')) parts.push('trainer–client linking in Firestore CRM collections');
    if (folder.startsWith('shared/daily-metrics')) parts.push('writes to users/{uid}/dailyLogs/{date}');
    if (folder.startsWith('shared/api')) parts.push('shared authenticated HTTP — prefer over raw fetch');

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

Each folder explains its role. Each file gets **two plain-English sentences** — what it does and how it fits in the app.

Firebase production project ID stays \`anatrox-auth\` (do not rename in config).

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
      md += `### \`${rel}\`\n\n`;
      md += `1. ${s1}\n`;
      md += `2. ${s2}\n\n`;
    }
  }

  md += `---\n\n*End of catalog — ${files.length} files.*\n`;
  return md;
}

fs.writeFileSync(OUT, build());
console.log(`Wrote ${OUT}`);
