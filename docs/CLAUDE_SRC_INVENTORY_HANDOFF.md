# Handoff for Claude — full `src/` inventory

**Do not rename or move anything until the human approves a concrete tree.**

## What this file is
Complete inventory of Coach Connect `src/`: every folder and file, with what it is for / what it does. Use this to propose a clearer folder + file organization.

## How the human thinks about the app (journey order)
1. Welcome / boot
2. Sign-in / sign-up
3. First-time account setup (currently called “onboarding” in code)
4. Role: client-app or trainer-app
5. Trainer UI order: home/hero → clients → tabs
6. Shared features opened from tabs: nutrition, workouts, ai-coach, messaging, etc.

## Naming rule the human wants
File/folder name = **the job** (verb + object), clear and professional — not jargon (`Wizard`, `crm`, `guess`, `premium`), not dumbed-down UI nouns alone.
Example that clicked: `guessServingSize.js` → something like `pickServingSize.js` (job = pick the correct serving size for the food card).

## What to produce for the human
1. Target folder tree in journey order
2. Table: `| current path | job (1–2 sentences) | KEEP or → new path |` for folders and files that need change
3. Stop for APPROVE / APPROVE WITH EDITS / REJECT — no code changes until then

## Constraints
- Do not touch Firebase project id `anatrox-auth` / env project ids
- Do not rewrite business logic — organize and rename only
- Kill dump folders (`utils/`, `lib/`, root `components/`) by moving into real homes
- Fix imports only after approval, in waves

## Full inventory starts below
(Generated catalog — every path under `src/`.)

---


**629 files** (518 JS/JSX modules) — generated 2026-08-06.

Regenerate: `node scripts/generateSrcFileCatalog.mjs`

Every file under `src/` is listed below (no summaries, no skipped files). Each folder has a purpose blurb; each file has a full paragraph on what it does and how it fits the app — useful before renaming.

Firebase production project ID stays `anatrox-auth` (do not rename in config / `.env`).

## Architecture map (how `src/` is organized)

| Top-level folder | Role |
|---|---|
| `app-start/` | Boot + role gate: `AuthGate` → `ClientApp` or `TrainerApp` |
| `auth/` | Login, signup, onboarding, password reset |
| `client-app/` | Trainee UI: home, dashboard, marketplace, files, client navigation |
| `trainer-app/` | Trainer UI: CRM, sessions, documents, payments, trainer navigation |
| `ai-coach/` | AI Coach chat UI + client-side coach API/tools/context |
| `nutrition/` | Food search, barcode, daily log, food details, nutrition settings |
| `workouts/` | Active workout, exercise library, AI plan generate/view |
| `messaging/` | Shared chat list + thread screens |
| `metrics/` | Daily metrics (steps/sleep/water/weight) + daily quotes |
| `notifications/` | Push notification helpers |
| `subscription/` | Trainer Pro paywall / IAP / trial gate |
| `settings/` | Settings hub, support, privacy, bug report |
| `shared/` | Cross-role components, API, payments, weekly report, Firestore helpers |
| `shared-ui/` | Design system / liquid glass / theme tokens |
| `shared-utils/` | Pure helpers (dates, height, sanitize, file types) |
| `navigation/` | Route names + shell navigation context |
| `components/` | Root-level components (payments / onboarding leftovers) |
| `assets/` | Images, icons, Lottie JSON (not logic) |
| `utils/` | Error logging, logout cache clear, xlsx shims |
| `__tests__/` | Jest unit / integration / component tests |
| `lib/` | Tiny root libs (e.g. sessions) |

**Rename tip:** Prefer renaming folders first with a clear map (`client`→`client-app` style), then files. Grep for the old basename before renaming — many screens have duplicate re-export wrappers under `shared/screens` or `*/screens`.

---

## Table of contents

- [(root)](#root) (9 files)
- [__tests__](#tests) (1 files)
- [__tests__/components](#tests-components) (1 files)
- [__tests__/fixtures](#tests-fixtures) (1 files)
- [__tests__/integration](#tests-integration) (6 files)
- [__tests__/mocks](#tests-mocks) (1 files)
- [__tests__/unit](#tests-unit) (67 files)
- [ai-coach/chat-ui](#ai-coach-chat-ui) (2 files)
- [ai-coach/chat-ui/chat-home](#ai-coach-chat-ui-chat-home) (1 files)
- [ai-coach/chat-ui/chat-thread](#ai-coach-chat-ui-chat-thread) (11 files)
- [ai-coach/chat-ui/components](#ai-coach-chat-ui-components) (5 files)
- [ai-coach/chat-ui/hooks](#ai-coach-chat-ui-hooks) (1 files)
- [ai-coach/chat-ui/lib](#ai-coach-chat-ui-lib) (6 files)
- [ai-coach/chat-ui/persistence](#ai-coach-chat-ui-persistence) (1 files)
- [ai-coach/chat-ui/screens](#ai-coach-chat-ui-screens) (1 files)
- [ai-coach/chat-ui/tool-modals](#ai-coach-chat-ui-tool-modals) (16 files)
- [ai-coach/chat-ui/voice](#ai-coach-chat-ui-voice) (3 files)
- [ai-coach/server-logic](#ai-coach-server-logic) (1 files)
- [ai-coach/server-logic/chat-api](#ai-coach-server-logic-chat-api) (7 files)
- [ai-coach/server-logic/context](#ai-coach-server-logic-context) (3 files)
- [ai-coach/server-logic/macro-recalibration](#ai-coach-server-logic-macro-recalibration) (1 files)
- [ai-coach/server-logic/services](#ai-coach-server-logic-services) (1 files)
- [ai-coach/server-logic/tools](#ai-coach-server-logic-tools) (6 files)
- [ai-coach/server-logic/trainer-messaging](#ai-coach-server-logic-trainer-messaging) (1 files)
- [ai-coach/server-logic/vision](#ai-coach-server-logic-vision) (1 files)
- [ai-coach/tools](#ai-coach-tools) (1 files)
- [app-start](#app-start) (4 files)
- [assets](#assets) (5 files)
- [assets/animations](#assets-animations) (3 files)
- [assets/animations/app-flows](#assets-animations-app-flows) (16 files)
- [assets/animations/legacy](#assets-animations-legacy) (12 files)
- [assets/icons](#assets-icons) (34 files)
- [assets/icons/New Icons](#assets-icons-New-Icons) (13 files)
- [assets/logo](#assets-logo) (3 files)
- [assets/onboarding-consolidated](#assets-onboarding-consolidated) (15 files)
- [auth](#auth) (12 files)
- [auth/services](#auth-services) (2 files)
- [client-app/dashboard](#client-app-dashboard) (6 files)
- [client-app/files](#client-app-files) (6 files)
- [client-app/home](#client-app-home) (4 files)
- [client-app/marketplace](#client-app-marketplace) (11 files)
- [client-app/meal-plan](#client-app-meal-plan) (1 files)
- [client-app/navigation](#client-app-navigation) (6 files)
- [client-app/profile](#client-app-profile) (1 files)
- [client-app/workout-plans](#client-app-workout-plans) (1 files)
- [components](#components) (3 files)
- [components/onboarding](#components-onboarding) (1 files)
- [lib](#lib) (1 files)
- [messaging](#messaging) (3 files)
- [metrics/daily-metrics](#metrics-daily-metrics) (5 files)
- [metrics/daily-quotes](#metrics-daily-quotes) (1 files)
- [navigation](#navigation) (7 files)
- [notifications](#notifications) (4 files)
- [nutrition](#nutrition) (1 files)
- [nutrition/barcode](#nutrition-barcode) (4 files)
- [nutrition/components](#nutrition-components) (1 files)
- [nutrition/components/premiumFoodCard](#nutrition-components-premiumFoodCard) (8 files)
- [nutrition/daily-log](#nutrition-daily-log) (6 files)
- [nutrition/food-details](#nutrition-food-details) (7 files)
- [nutrition/food-search](#nutrition-food-search) (12 files)
- [nutrition/quick-add](#nutrition-quick-add) (1 files)
- [nutrition/settings](#nutrition-settings) (2 files)
- [nutrition/utils](#nutrition-utils) (1 files)
- [settings](#settings) (2 files)
- [settings/screens](#settings-screens) (7 files)
- [shared-ui](#shared-ui) (9 files)
- [shared-ui/layout](#shared-ui-layout) (1 files)
- [shared-ui/liquid](#shared-ui-liquid) (5 files)
- [shared-utils](#shared-utils) (11 files)
- [shared/accessibility](#shared-accessibility) (1 files)
- [shared/api](#shared-api) (12 files)
- [shared/assets](#shared-assets) (4 files)
- [shared/components](#shared-components) (3 files)
- [shared/components/brand](#shared-components-brand) (1 files)
- [shared/components/home](#shared-components-home) (5 files)
- [shared/components/icons](#shared-components-icons) (8 files)
- [shared/components/modals](#shared-components-modals) (3 files)
- [shared/components/notes-files](#shared-components-notes-files) (8 files)
- [shared/components/onboarding](#shared-components-onboarding) (4 files)
- [shared/components/shell](#shared-components-shell) (4 files)
- [shared/contexts](#shared-contexts) (1 files)
- [shared/firestore](#shared-firestore) (2 files)
- [shared/fitness-calculations](#shared-fitness-calculations) (1 files)
- [shared/marketplace](#shared-marketplace) (1 files)
- [shared/notes-files](#shared-notes-files) (2 files)
- [shared/payments](#shared-payments) (9 files)
- [shared/photo-gallery](#shared-photo-gallery) (1 files)
- [shared/screens](#shared-screens) (3 files)
- [shared/services](#shared-services) (3 files)
- [shared/trainer-location](#shared-trainer-location) (1 files)
- [shared/weekly-report](#shared-weekly-report) (2 files)
- [shared/weekly-report/components](#shared-weekly-report-components) (12 files)
- [shared/weekly-report/data](#shared-weekly-report-data) (5 files)
- [shared/weekly-report/theme](#shared-weekly-report-theme) (2 files)
- [shared/workout-plans](#shared-workout-plans) (1 files)
- [shared/workout-profile](#shared-workout-profile) (2 files)
- [subscription](#subscription) (12 files)
- [trainer-app/calendar-tab](#trainer-app-calendar-tab) (1 files)
- [trainer-app/client-detail](#trainer-app-client-detail) (1 files)
- [trainer-app/client-requests](#trainer-app-client-requests) (3 files)
- [trainer-app/clients-list](#trainer-app-clients-list) (3 files)
- [trainer-app/components](#trainer-app-components) (1 files)
- [trainer-app/components/sessions](#trainer-app-components-sessions) (2 files)
- [trainer-app/crm](#trainer-app-crm) (4 files)
- [trainer-app/dashboard](#trainer-app-dashboard) (3 files)
- [trainer-app/documents](#trainer-app-documents) (12 files)
- [trainer-app/documents/spreadsheet](#trainer-app-documents-spreadsheet) (10 files)
- [trainer-app/hooks](#trainer-app-hooks) (2 files)
- [trainer-app/navigation](#trainer-app-navigation) (5 files)
- [trainer-app/nutrition-tab](#trainer-app-nutrition-tab) (1 files)
- [trainer-app/payments](#trainer-app-payments) (1 files)
- [trainer-app/progress-tab](#trainer-app-progress-tab) (3 files)
- [trainer-app/screens](#trainer-app-screens) (1 files)
- [trainer-app/screens/components](#trainer-app-screens-components) (1 files)
- [trainer-app/sessions](#trainer-app-sessions) (4 files)
- [trainer-app/weekly-report](#trainer-app-weekly-report) (3 files)
- [trainer-app/workout-plans](#trainer-app-workout-plans) (3 files)
- [utils](#utils) (9 files)
- [workouts/active-workout](#workouts-active-workout) (6 files)
- [workouts/components](#workouts-components) (2 files)
- [workouts/exercise-library](#workouts-exercise-library) (9 files)
- [workouts/plan-builder](#workouts-plan-builder) (1 files)
- [workouts/plan-generator](#workouts-plan-generator) (7 files)
- [workouts/plan-viewer](#workouts-plan-viewer) (4 files)
- [workouts/screens](#workouts-screens) (1 files)

---

## src/ (root) {#root}

**Folder purpose:** Root of the React Native / Expo app source. Contains the app entry loader, architecture docs, and this catalog.

### `ARCHITECTURE.md`

Developer documentation for navigating the codebase. Regenerate with `node scripts/generateSrcFileCatalog.mjs`.

### `AUDIT_REPORT.md`

Developer documentation for navigating the codebase. Regenerate with `node scripts/generateSrcFileCatalog.mjs`.

### `CODEBASE_GUIDE.md`

Developer documentation for navigating the codebase. Regenerate with `node scripts/generateSrcFileCatalog.mjs`.

### `DEAD_CODE_AUDIT.md`

Developer documentation for navigating the codebase. Regenerate with `node scripts/generateSrcFileCatalog.mjs`.

### `FEATURE_TEMPLATE.md`

Developer documentation for navigating the codebase. Regenerate with `node scripts/generateSrcFileCatalog.mjs`.

### `Loader.js`

Animated loading spinner (five bouncing dots) shown while async work completes. Used as a lightweight loading indicator anywhere the app needs a visual wait state.

### `NAMING_CONVENTIONS.md`

Developer documentation for navigating the codebase. Regenerate with `node scripts/generateSrcFileCatalog.mjs`.

### `SRC_FILE_CATALOG.md`

Developer documentation for navigating the codebase. Regenerate with `node scripts/generateSrcFileCatalog.mjs`.

### `STYLE_GUIDE.md`

Developer documentation for navigating the codebase. Regenerate with `node scripts/generateSrcFileCatalog.mjs`.

## __tests__ {#tests}

**Folder purpose:** Jest test suites for unit, integration, and component tests.

### `__tests__/ClientPaymentModal.test.js`

Automated Jest tests for ClientPaymentModal. Catches regressions before deploy — run with `npm test`.

## __tests__/components {#tests-components}

**Folder purpose:** React component tests rendered with Testing Library.

### `__tests__/components/ToolConfirmationModal.test.js`

Automated Jest tests for ToolConfirmationModal rendering. Catches regressions before deploy — run with `npm test`. Tests include: does not render when no tool is present; renders logSleep modal with hours and action buttons; renders logNutrition modal with food and calories; renders adjustMacroTargets modal with calorie and protein values.

## __tests__/fixtures {#tests-fixtures}

**Folder purpose:** Shared mock data and fixtures imported by multiple tests.

### `__tests__/fixtures/coachToolGuardFixtures.js`

Automated Jest tests for coach Tool Guard Fixtures. Catches regressions before deploy — run with `npm test`.

## __tests__/integration {#tests-integration}

**Folder purpose:** Multi-module integration tests that exercise real flows (auth, food log, coach).

### `__tests__/integration/aiCoachFlow.test.js`

Automated Jest tests for ai coach flow integration. Catches regressions before deploy — run with `npm test`.

### `__tests__/integration/clientHomeBootstrap.test.js`

Automated Jest tests for client home bootstrap. Catches regressions before deploy — run with `npm test`.

### `__tests__/integration/dashboardSave.test.js`

Automated Jest tests for dashboard save integration; useWorkoutLog save. Catches regressions before deploy — run with `npm test`. Tests include: saveDashboardWorkoutLog writes canonical dailyLogs payload; persists workout log and notifies linked trainer; Write succeeds locally but push to trainer fails → local save still confirmed, push failure logged.

### `__tests__/integration/foodSearchLog.test.js`

Automated Jest tests for Food search → results; Food log → Firestore write. Catches regressions before deploy — run with `npm test`. Tests include: returns 3 structured results from a successful server search; uses in-memory cache on the second identical search (server called once); falls back to Open Food Facts when the server is unreachable; returns an empty array (not null) when the server has no matches.

### `__tests__/integration/onboardingComplete.test.js`

Automated Jest tests for Onboarding complete → trainer link creation. Catches regressions before deploy — run with `npm test`. Tests include: writes all 3 link surfaces when onboarding completes with a trainer code; skips trainer link collections when no trainer code is provided; does not write trainer links when the server call fails; sets onboardingCompleted in Firestore and AsyncStorage on success.

### `__tests__/integration/toolExecutorReal.test.js`

Automated Jest tests for logSleep real execution; logWater real execution; logNutrition real execution; deleteLog real execution; adjustMacroTargets real execution; trainer mode blocks all writes. Catches regressions before deploy — run with `npm test`. Tests include: Valid hours → writes to correct Firestore path dashboard_sleep field; Hours as string ; Hours as 0 → writes 0 not null; Hours over 24 → rejected or capped.

## __tests__/mocks {#tests-mocks}

**Folder purpose:** Module mocks for Expo and third-party dependencies in Jest.

### `__tests__/mocks/expoVirtualEnv.js`

Automated Jest tests for expo Virtual Env. Catches regressions before deploy — run with `npm test`.

## __tests__/unit {#tests-unit}

**Folder purpose:** Pure unit tests for helpers, parsers, scoring, and business logic.

### `__tests__/unit/ALL_FIXES_VERIFICATION.test.js`

Automated Jest tests for ALL_FIXES_VERIFICATION. Catches regressions before deploy — run with `npm test`. Tests include: registers fix suite ${name}.

### `__tests__/unit/AuthGate.logout.test.js`

Automated Jest tests for AuthGate logout cleanup. Catches regressions before deploy — run with `npm test`. Tests include: clears push tokens and local data on sign-out using previous uid ref; clears data when switching accounts; does not clear on first sign-in.

### `__tests__/unit/ErrorBoundary.test.js`

Automated Jest tests for ErrorBoundary. Catches regressions before deploy — run with `npm test`. Tests include: getDerivedStateFromError captures the error; componentDidCatch logs without throwing.

### `__tests__/unit/ScheduleTrainingSessionScreen.listeners.test.js`

Automated Jest tests for ScheduleTrainingSessionScreen listener sharing. Catches regressions before deploy — run with `npm test`. Tests include: wraps TrainerApp in SessionsProvider; thin session hooks require SessionsContext.

### `__tests__/unit/TrainerApp.unreadListener.test.js`

Automated Jest tests for TrainerApp unread listener contract; TrainerApp wiring. Catches regressions before deploy — run with `npm test`. Tests include: subscribes and receives unread count for trainer uid; cleans up listener on unsubscribe; imports useUnreadNotificationCount hook.

### `__tests__/unit/aiCoachCapabilities.test.js`

Automated Jest tests for offline — delete log, personal data, tool inference; inferDeleteLogParams; wantsDeleteAllFoodLogs; coerceMisroutedDeleteTool; shouldIncludeWeeklyContextInCoachPrompt; mergeCoachToolCalls; inferCoachToolCall; parseCoachToolCalls; isCoachVisionConfigured; API health; Live API — coach chat & tools; Basic coach reply; Food log query loads personal data; Delete all food today → deleteLog tool; Log sleep → logSleep tool; General question (no weekly nag); Vision — DeepSeek-VL2 + coach polish; Live API — photo attachment route. Catches regressions before deploy — run with `npm test`. Tests include: delete: ; delete: today omits fixed date; delete: ; delete: pizza keyword.

### `__tests__/unit/aiCoachToolsComplete.test.js`

Automated Jest tests for AI Coach tools — complete regression; inference fallback (model forgot tool JSON); model toolCalls JSON path; deleteLog metric routing (no food chip for sleep); informational questions must not propose tools; rest day never becomes rateWorkout; parseCoachToolCalls accepts every registered tool name. Catches regressions before deploy — run with `npm test`. Tests include: registry still lists all 15 tools; coerces nutrition deleteLog → sleep when user asked for sleep; Do it after sleep-delete promise still yields sleep deleteLog; merge fixes model JSON that wrongly used nutrition for sleep.

### `__tests__/unit/appleSubscriptionVerify.test.js`

Automated Jest tests for appleSubscriptionVerify. Catches regressions before deploy — run with `npm test`. Tests include: maps trial offer to free_trial status; decodes JWS payload.

### `__tests__/unit/authFlows.test.js`

Automated Jest tests for Authentication flows; Trainer sign-up payload; Client sign-up payload; Login role routing; Logout / restricted fields; Password reset / new user detection; Role-based onboarding gate; Onboarding smuggling blocked server-side. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/authGate.test.js`

Automated Jest tests for normalizeAppRole; profileNeedsOnboarding; isLikelyNewFirebaseUser. Catches regressions before deploy — run with `npm test`. Tests include: returns false when onboardingCompleted is true; returns true when onboardingCompleted is false; handles empty profile; handles null profile.

### `__tests__/unit/barcodeSerperLookup.test.js`

Automated Jest tests for barcodeSerperLookup. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/baseUrl.test.js`

Automated Jest tests for baseUrl helpers. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/bookSessionParse.test.js`

Automated Jest tests for book Session Parse. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/calculations.test.js`

Automated Jest tests for calculateBMR; calculateTDEE; calculateBMI; calculateMacros; estimateBodyFat. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/coachCategoryPrompts.test.js`

Automated Jest tests for coach category prompts. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/coachFollowUpPrompts.test.js`

Automated Jest tests for coachFollowUpPrompts. Catches regressions before deploy — run with `npm test`. Tests include: extracts ## Suggested follow-ups from reply and strips from display; builds follow-ups anchored to nutrition web search thread; references assistant reply bullets instead of vague profile prompts; builds contextual follow-ups for sleep web search.

### `__tests__/unit/coachPersonalDataRouting.test.js`

Automated Jest tests for coach personal-data routing. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/coachProgressCycle.test.js`

Automated Jest tests for coach progress cycle timeline. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/coachSourcePreview.test.js`

Automated Jest tests for coach Source Preview. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/coachToolProposalGuards.test.js`

Automated Jest tests for informational questions reject tool proposals; explicit log requests accept tool proposals; ambiguous statements reject tool proposals; filterValidCoachToolProposals; Client coachToolProposalGuards; Server coachToolProposalGuards. Catches regressions before deploy — run with `npm test`. Tests include: returns only valid proposals from a mixed list; returns an empty array for an empty input; does not throw for null input; does not throw for undefined input.

### `__tests__/unit/coachWebSourceCards.test.js`

Automated Jest tests for CoachWebSourceCards helpers. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/dailyMetrics.test.js`

Automated Jest tests for dailyMetricsService. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/dailyMetricsParse.test.js`

Automated Jest tests for parseDailyMetricsFromSnapshots; trackingMirrorFromLogs; buildWorkoutLogHydration; rollover archive payload shape. Catches regressions before deploy — run with `npm test`. Tests include: prefers dailyLogs water over tracking; prefers dailyLogs sleep over tracking; reads soreness from logs; reads energy from logs.

### `__tests__/unit/dataCacheCleanup.test.js`

Automated Jest tests for clearUserSpecificData; onUserSignOut; onUserSwitch; clearAllUserData. Catches regressions before deploy — run with `npm test`. Tests include: Clears all keys containing the uid; Does NOT clear keys for other uids; AsyncStorage error → caught, does not crash app; Missing uid → no keys cleared, no crash.

### `__tests__/unit/dateAndRollover.test.js`

Automated Jest tests for local day helpers. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/exerciseDislikeHelpers.test.js`

Automated Jest tests for exerciseDislikeHelpers. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/foodNormalize.test.js`

Automated Jest tests for foodNormalize. Catches regressions before deploy — run with `npm test`. Tests include: normalizes FatSecret-style rows; cleans Serper titles when search query provided.

### `__tests__/unit/foodNormalizeBarcode.test.js`

Automated Jest tests for foodNormalizeBarcode. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/foodSearchQualityGuards.test.js`

Automated Jest tests for trustedFoodCatalog; junk title guards; serving / food conflicts; Serper ranking quality guards; branded restaurant ranking; near-duplicate dedupe; presentation + DB preference; rankSerperFoodResultRows acceptance. Catches regressions before deploy — run with `npm test`. Tests include: returns Crazy Bread for Little Caesars crazy bread; returns Big Mac for McDonalds Big Mac; returns curated Cherry Coke 20oz; flags Crazy Breadmenu Items as junk.

### `__tests__/unit/foodSearchScoring.test.js`

Automated Jest tests for normalizeQueryText; significantQueryTokens; itemMatchesQuery; filterFoodSearchRows general behavior; isMenuStyleQuery branded supplements; isMenuStyleQuery; scoreSerperFoodResultRow; extractMacrosFromChunk. Catches regressions before deploy — run with `npm test`. Tests include: lowercases and trims brand queries; collapses extra spaces; strips special characters; returns empty string for empty input without throwing.

### `__tests__/unit/foodSearchShipBlockers.aug2026.test.js`

Automated Jest tests for SHIP: junk / tracker titles never win the card; SHIP: zero / nonsense macros are rejected; SHIP: serving labels must match the food; SHIP: ranking prefers the actual menu item over noise; SHIP: trusted catalog beats random web junk for known items; SHIP: presentation + dedupe do not resurrect junk; SHIP: consensus mapper never emits junk-only cards; SHIP: serper scorer prefers matching menu cards. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/foodSearchTitle.test.js`

Automated Jest tests for sanitizeFoodCardTitle (all sources); applyFoodCardPresentation (every provider). Catches regressions before deploy — run with `npm test`. Tests include: strips legacy source suffixes from cached titles; rejects source-only junk titles and uses the user query; removes dangling em dashes; cleans USDA and packaged food titles with site suffixes.

### `__tests__/unit/formatFoodBrand.test.js`

Automated Jest tests for cleanFoodBrandName. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/inferFoodServingLabel.test.js`

Automated Jest tests for guessServingSize. Catches regressions before deploy — run with `npm test`. Tests include: flags generic gram labels as weak; infers pizza as slice; infers nugget counts from query; infers bread as piece.

### `__tests__/unit/inferToolCallFromCoachMessage.test.js`

Automated Jest tests for inferToolCallFromCoachMessage. Catches regressions before deploy — run with `npm test`. Tests include: does not infer deleteLog from coach prose on informational web-search questions; still infers deleteLog when the user explicitly asks to delete food; does not infer logSleep from ambiguous sleep statements; infers logSleep when the user explicitly asks to log sleep.

### `__tests__/unit/markAllMessagesRead.pagination.test.js`

Automated Jest tests for markConversationMessagesReadPaginated. Catches regressions before deploy — run with `npm test`. Tests include: marks unread messages in batches of READ_PAGE_SIZE.

### `__tests__/unit/marketplaceFilters.test.js`

Automated Jest tests for marketplace filter utils. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/mergeTrainerClientProfile.test.js`

Automated Jest tests for mergeTrainerClientProfile. Catches regressions before deploy — run with `npm test`. Tests include: prefers live users/{uid} weight over stale CRM copy; does not copy one client CRM weight to another user profile; falls back to CRM weight when user profile has no weight yet; resolves daysPerWeek from legacy frequency on user doc.

### `__tests__/unit/normalizeFoodDisplayName.test.js`

Automated Jest tests for makeReadableFoodTitle; normalizeFoodRecordForStorage; helpers. Catches regressions before deploy — run with `npm test`. Tests include: title-cases ALL CAPS packaged foods; collapses repeated comma segments; strips site suffixes and uses user query for junk titles; shortens USDA scientific descriptions.

### `__tests__/unit/notesAndFiles.test.js`

Automated Jest tests for notes file helpers. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/nutritionConsensusSearch.test.js`

Automated Jest tests for parseNutritionSearchQuery; mapConsensusToFoodRow; mapNutritionSearchToFoodRows; mergeNutritionSearchWithLegacy. Catches regressions before deploy — run with `npm test`. Tests include: splits Jet\; splits mcnuggets queries; keeps plain grocery queries as foodName only; maps consensus payload into a loggable food row.

### `__tests__/unit/nutritionSearchConsensus.test.js`

Automated Jest tests for removeOutliersIqr; buildNutrientConsensus; getFoodNutritionConsensus. Catches regressions before deploy — run with `npm test`. Tests include: removes extreme outliers; returns original values when only two data points; includes nutrient when variance is under 10%; flags verify_manually when variance is 10-20%.

### `__tests__/unit/nutritionSearchInliers.test.js`

Automated Jest tests for classifyCalorieSources; getFoodNutritionConsensus sourceResults. Catches regressions before deploy — run with `npm test`. Tests include: marks per_100g USDA as wrong_serving_basis; flags calorie outliers when 3+ sources disagree; returns sourceResults and consensus for agreeing sources; buildSourceResultRow includes url and sourceKey.

### `__tests__/unit/nutritionSearchRoute.test.js`

Automated Jest tests for POST /api/nutrition/search handler. Catches regressions before deploy — run with `npm test`. Tests include: returns source rows without consensus when only one inlier; non-existent food returns 404 when no validated sources; returns 503 when all sources error out; timeout on one site still returns consensus when 3+ sources succeed.

### `__tests__/unit/onboardingCalculations.test.js`

Automated Jest tests for calculateBMR; calculateTDEE; calculateMacros; calculateBMI. Catches regressions before deploy — run with `npm test`. Tests include: male 80kg 180cm 30yo → Mifflin-St Jeor result; female 60kg 165cm 25yo → Mifflin-St Jeor result; zero weight input does not return a nonsense positive number; negative height does not return a valid-looking BMR.

### `__tests__/unit/onboardingGate.test.js`

Automated Jest tests for onboarding gate. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/parseCoachToolCalls.test.js`

Automated Jest tests for parseCoachToolCalls; stripCoachToolJsonFromReply; normalizeToolParams. Catches regressions before deploy — run with `npm test`. Tests include: parses valid JSON at end of reply; parses fenced JSON inside backticks; returns empty array for plain text with no JSON; returns empty array for malformed JSON without throwing.

### `__tests__/unit/parseDeleteLogRequest.test.js`

Automated Jest tests for userWantsDeleteLog; inferDeleteLogParams metric routing; coerceMisroutedDeleteTool. Catches regressions before deploy — run with `npm test`. Tests include: accepts explicit delete-food requests; accepts sleep dashboard deletes; rejects generic coaching prose about removing foods; routes sleep removes to logType sleep.

### `__tests__/unit/parseWebSearchReply.test.js`

Automated Jest tests for parseWebSearchReply. Catches regressions before deploy — run with `npm test`. Tests include: parses ## sections without dropping content; preserves full wall-of-text when unstructured; preprocessWebSearchLayout keeps every sentence for unstructured text; stripInlineWebCitations preserves newlines.

### `__tests__/unit/paymentSetupPrompt.test.js`

Automated Jest tests for shouldShowPaymentSetupPopup. Catches regressions before deploy — run with `npm test`. Tests include: hides when no account timestamps (avoid login spam); shows for recent onboarded trainers without Stripe; hides when stripe account exists or is active; hides when dismissed recently.

### `__tests__/unit/premiumFoodCard.test.js`

Automated Jest tests for premiumFoodCard. Catches regressions before deploy — run with `npm test`. Tests include: maps logged food to card shape with calorie-based macro percents; uses low-opacity pill gradient stops; demo food matches mockup macros; embedded palette is transparent for meal sections.

### `__tests__/unit/repo.cleanliness.test.js`

Automated Jest tests for repo cleanliness. Catches regressions before deploy — run with `npm test`. Tests include: has no.tmp files in server/lib; gitignore includes firestore-debug.log.

### `__tests__/unit/resolveClientProfileFields.test.js`

Automated Jest tests for resolveClientProfileFields. Catches regressions before deploy — run with `npm test`. Tests include: fills profile fields from the first source when merged starts empty; prefers later non-empty sources (Firestore over local cache); keeps cached values when Firestore fields are empty; unwraps nested onboardingData and maps aliases.

### `__tests__/unit/resolveCoachToolCalls.test.js`

Automated Jest tests for resolveCoachToolCalls (server). Catches regressions before deploy — run with `npm test`. Tests include: returns no tools for informational protein web-search questions; returns adjustMacroTargets when user explicitly asks to change targets.

### `__tests__/unit/resolveTrainerProgressWeight.test.js`

Automated Jest tests for resolveTrainerProgressWeight. Catches regressions before deploy — run with `npm test`. Tests include: prefers today log, then recent log, then profile weight; shows different profile weights per client when logs are empty; does not reuse another client logged weight when profile differs; resolves baseline from starting weight first.

### `__tests__/unit/saveCoachMessagesFirestore.test.js`

Automated Jest tests for saveCoachMessages Firestore payloads. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/servingMath.test.js`

Automated Jest tests for servingMath. Catches regressions before deploy — run with `npm test`. Tests include: scales macros by serving count; computes total grams from qty × grams-per-serving; parses fractional serving qty.

### `__tests__/unit/shouldUseWebSearch.test.js`

Automated Jest tests for shouldUseWebSearch routing. Catches regressions before deploy — run with `npm test`. Tests include: routes pizza-on-cut web questions when user says on the web; does not treat bare calories in a web question as a personal log lookup; still blocks personal log lookups without web intent; blocks dashboard sleep lookups.

### `__tests__/unit/subscriptionState.test.js`

Automated Jest tests for resolveSubscriptionAccess; formatTrialCountdown. Catches regressions before deploy — run with `npm test`. Tests include: returns no_subscription when missing; grants free_trial while trialEndsAt is in the future; grants active for paid subscription; keeps access for cancelled until expiresAt.

### `__tests__/unit/supportConfig.test.js`

Automated Jest tests for supportConfig. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/trainerClientDisplayName.test.js`

Automated Jest tests for trainer client display name resolver. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/trainerCodeValidation.test.js`

Automated Jest tests for normalizeInviteCodeForQuery; validateTrainerCode. Catches regressions before deploy — run with `npm test`. Tests include: formats a 6-character code as XXX-XXX; rejects too-short and over-long codes; returns valid true and sets trainerId from a working API response; returns valid false when the API reports an invalid code.

### `__tests__/unit/trainerMessaging.test.js`

Automated Jest tests for filterChatMessages; getOrCreateConversation; sendMessage; markMessagesAsRead; subscribeToMessages. Catches regressions before deploy — run with `npm test`. Tests include: Regular messages returned in result; Pending connection request type messages filtered OUT of thread; Empty array input returns empty array; Null input does not throw.

### `__tests__/unit/validateBarcodeFood.test.js`

Automated Jest tests for validateBarcodeFood. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/workoutDayLabels.test.js`

Automated Jest tests for workout Day Labels. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/workoutOnboardingPayload.test.js`

Automated Jest tests for buildWorkoutOnboardingPayload. Catches regressions before deploy — run with `npm test`. Tests include: includes normalized daysPerWeek and omits null fields; coerces string daysPerWeek to a number; flattens nested onboardingData before building payload.

### `__tests__/unit/workoutPlanParsing.test.js`

Automated Jest tests for workoutPlanPdfService parsing. Catches regressions before deploy — run with `npm test`.

## ai-coach/chat-ui {#ai-coach-chat-ui}

**Folder purpose:** All AI Coach UI — home, chat thread, voice mode, tool confirmation sheets, Firestore persistence.

### `ai-coach/chat-ui/AICoachTestSuite.jsx`

AICoach Test Suite — runs AI coach tool actions after the user taps Confirm. Loads user profile, nutrition, and workout context for the coach prompt; UI labels include "AI Coach Tests".

### `ai-coach/chat-ui/aiCoachUiTokens.js`

AI Coach UI tokens — aligned with design-system.md (premium dark neon glass). Use only inside src/ai-coach/chat-ui/*. UI labels include "rgba(255,255,255,0.45)".

## ai-coach/chat-ui/chat-home {#ai-coach-chat-ui-chat-home}

**Folder purpose:** Landing screen before entering a coach conversation (prompts, history entry).

### `ai-coach/chat-ui/chat-home/StartCoachChatScreen.jsx`

Start Coach Chat Screen — full-screen React Native view in `ai-coach/chat-ui/chat-home`. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in ai-coach.

## ai-coach/chat-ui/chat-thread {#ai-coach-chat-ui-chat-thread}

**Folder purpose:** Main chat screen: message list, composer, attachments, source cards, tool confirmations.

### `ai-coach/chat-ui/chat-thread/ChatWithCoachScreen.jsx`

The main AI Coach chat screen — message thread, composer, photo attach, voice input, and tool confirmations. Sends messages to the server, saves history to Firestore, and opens modals when the coach wants to log food, water, sessions, etc.

### `ai-coach/chat-ui/chat-thread/CoachPasteSheet.jsx`

Dedicated paste surface — avoids stale Simulator clipboard reads. Does not replace full navigation — closes when done.

### `ai-coach/chat-ui/chat-thread/CoachWebSourceCards.jsx`

Renders collapsible citation cards under coach replies that used web search. Each card links to the source URL so users can verify nutrition or fitness claims.

### `ai-coach/chat-ui/chat-thread/ToolConfirmationModal.jsx`

Tool Confirmation Modal — popup overlay on top of the current screen. Runs AI coach tool actions after the user taps Confirm; renders gradient backgrounds and buttons.

### `ai-coach/chat-ui/chat-thread/coachClipboard.js`

Strip [1] [2] inline citation markers — preserve newlines and markdown structure. Strip lightweight markdown so coach replies render as one selectable Text block.

### `ai-coach/chat-ui/chat-thread/coachQuickPrompts.js`

Hourly-rotating AI Coach prompts + capability carousel copy. Pools refresh every hour; daily reshuffle reduces repetition. UI labels include "Log sleep, water, steps, or mood".

### `ai-coach/chat-ui/chat-thread/openAttachmentMenu.js`

Native attach menu — avoids Modal + ImagePicker stacking bugs on iOS. Show Coach Attach Menu Purpose: show Coach Attach Menu.

### `ai-coach/chat-ui/chat-thread/pickAttachmentType.js`

Resize + JPEG compress so we always have base64 for the vision API. Coach Attachment Pickers Purpose: coach Attachment Pickers.

### `ai-coach/chat-ui/chat-thread/renderSourcePreview.js`

Visual helpers for AI Coach web source cards. Coach Source Preview Purpose: coach Source Preview.

### `ai-coach/chat-ui/chat-thread/useCoachComposerInput.js`

Use Coach Composer Input loads and manages state for the chat-thread feature. Screens call this hook instead of putting fetch/Firestore logic inline in JSX.

### `ai-coach/chat-ui/chat-thread/useCoachComposerKeyboard.js`

Prevent iOS Passwords / strong-password autofill bar on the coach chat field. React hook in `ai-coach/chat-ui/chat-thread` — screens call it instead of inlining fetch/Firestore logic.

## ai-coach/chat-ui/components {#ai-coach-chat-ui-components}

**Folder purpose:** Reusable coach UI pieces — formatted replies, follow-up bubbles, glass cards, history sidebar.

### `ai-coach/chat-ui/components/AICoachGlassCard.jsx`

Premium glass card — gradient border + dark inner fill (matches dashboard heroes). AICoach Glass Card Purpose: UI screen or component: AICoach Glass Card.

### `ai-coach/chat-ui/components/CoachChatHistorySidebar.jsx`

Collapsible chat history — docked rail, inline panel, or overlay drawer. UI labels include "Delete conversation".

### `ai-coach/chat-ui/components/CoachFollowUpBubbles.jsx`

SuppCo-style follow-up suggestion chips — lavender pills, context from the thread. UI labels include "Suggested follow-up questions".

### `ai-coach/chat-ui/components/CoachFormattedReply.jsx`

Renders coach text replies with markdown formatting (bold, lists, links) and strips hidden tool-call JSON. Sits in the message bubble so users see clean prose instead of raw model output.

### `ai-coach/chat-ui/components/CoachWebSearchReply.jsx`

Special renderer for coach answers that came from web search — preserves headings and structured nutrition info. Used instead of plain markdown when the reply includes search-sourced facts.

## ai-coach/chat-ui/hooks {#ai-coach-chat-ui-hooks}

**Folder purpose:** React hooks for coach chat sessions and related UI state.

### `ai-coach/chat-ui/hooks/useCoachChatSessions.js`

React hook that subscribes to the user AI coach chat sessions in Firestore (ordered, limited), formats sidebar titles/dates, groups sessions (today/earlier), and triggers refresh of stale or junk creative titles. Used by StartCoachChatScreen and CoachChatHistorySidebar so the coach home can list and open past threads without inlining Firestore queries.

## ai-coach/chat-ui/lib {#ai-coach-chat-ui-lib}

**Folder purpose:** Coach UI helpers: markdown styles, clipboard, follow-up prompts, web-search reply parsing.

### `ai-coach/chat-ui/lib/coachConversationDebug.js`

Dev-only AI Coach conversation logs — copy from Metro when reporting issues. Log what the user sent (before API call).

### `ai-coach/chat-ui/lib/coachFollowUpPrompts.js`

Context-aware follow-up chips after coach replies — anchored to the thread, not vague profile prompts. Heuristic follow-ups when the model omits the ## Suggested follow-ups section.

### `ai-coach/chat-ui/lib/coachMarkdownStyles.js`

StyleSheet rules for rendering markdown inside coach bubbles (headings, code, links, citations). Also turns inline [Source Name] tags into tappable citation pills.

### `ai-coach/chat-ui/lib/formatCoachMessageText.js`

Copy/paste helpers for coach messages — long-press to copy plain text from a reply. Shared between ChatWithCoachScreen and CoachPasteSheet.

### `ai-coach/chat-ui/lib/parseWebSearchReply.js`

Parse web-search replies — preserve full content, extract sections for tests/tools only. Light layout pass — adds ## headers only when missing; never drops content.

### `ai-coach/chat-ui/lib/prepareCoachAttachments.js`

Convert local coach chat attachments into API-safe image payloads (base64 data URLs). Prepare Coach Attachments Purpose: prepare Coach Attachments.

## ai-coach/chat-ui/persistence {#ai-coach-chat-ui-persistence}

**Folder purpose:** Saves and loads coach message threads to/from Firestore.

### `ai-coach/chat-ui/persistence/saveCoachMessages.js`

AI Coach chat persistence — session meta + per-message docs (avoids full-array rewrites). Uses Firestore (`users`).

## ai-coach/chat-ui/screens {#ai-coach-chat-ui-screens}

**Folder purpose:** Top-level screen wrappers that re-export or host coach navigation targets.

### `ai-coach/chat-ui/screens/StartCoachChatScreen.jsx`

Single card that auto-rotates through suggestions with fade/slide. Persists coach chat history to Firestore; enables voice dictation and text-to-speech in coach chat; writes a logged food entry to the user daily nutrition log.

## ai-coach/chat-ui/tool-modals {#ai-coach-chat-ui-tool-modals}

**Folder purpose:** Confirmation sheets for each coach tool (log water, book session, adjust macros, etc.).

### `ai-coach/chat-ui/tool-modals/AdjustMacroTargetsSheet.jsx`

Bottom sheet modal shown when the AI coach proposes a "Adjust Macro Targets Sheet" tool action. User reviews the form, confirms, then the app calls the server to adjust daily protein/carbs/fats when the coach suggests new macro targets.

### `ai-coach/chat-ui/tool-modals/BookTraineeSessionSheet.jsx`

Bottom sheet modal shown when the AI coach proposes a "Book Trainee Session Sheet" tool action. User reviews the form, confirms, then the app calls the server to book a training session with their trainer at a chosen date and time.

### `ai-coach/chat-ui/tool-modals/ConfirmDeleteLogSheet.jsx`

Bottom sheet modal shown when the AI coach proposes a "Confirm Delete Log Sheet" tool action. User reviews the form, confirms, then the app calls the server to delete a previously logged food or metric entry the coach referenced.

### `ai-coach/chat-ui/tool-modals/LogDailyStepsSheet.jsx`

Bottom sheet modal shown when the AI coach proposes a "Log Daily Steps Sheet" tool action. User reviews the form, confirms, then the app calls the server to log step count for the daily metrics tracker.

### `ai-coach/chat-ui/tool-modals/LogMealSheet.jsx`

Bottom sheet modal shown when the AI coach proposes a "Log Meal Sheet" tool action. User reviews the form, confirms, then the app calls the server to log a meal or snack with calories and macros from coach chat.

### `ai-coach/chat-ui/tool-modals/LogMoodRatingSheet.jsx`

Bottom sheet modal shown when the AI coach proposes a "Log Mood Rating Sheet" tool action. User reviews the form, confirms, then the app calls the server to log mood on a scale when the coach asks how they are feeling.

### `ai-coach/chat-ui/tool-modals/LogRestDaySheet.jsx`

Bottom sheet modal shown when the AI coach proposes a "Log Rest Day Sheet" tool action. User reviews the form, confirms, then the app calls the server to mark today as a rest day in their workout log.

### `ai-coach/chat-ui/tool-modals/LogSleepHoursSheet.jsx`

Bottom sheet modal shown when the AI coach proposes a "Log Sleep Hours Sheet" tool action. User reviews the form, confirms, then the app calls the server to log hours of sleep for the daily metrics tracker.

### `ai-coach/chat-ui/tool-modals/LogWaterIntakeSheet.jsx`

Bottom sheet modal shown when the AI coach proposes a "Log Water Intake Sheet" tool action. User reviews the form, confirms, then the app calls the server to log water intake (ounces or ml) for hydration tracking.

### `ai-coach/chat-ui/tool-modals/OpenWorkoutPlanSheet.jsx`

Bottom sheet modal shown when the AI coach proposes a "Open Workout Plan Sheet" tool action. User reviews the form, confirms, then the app calls the server to open a specific workout plan the coach referenced.

### `ai-coach/chat-ui/tool-modals/RateEnergyLevelSheet.jsx`

Bottom sheet modal shown when the AI coach proposes a "Rate Energy Level Sheet" tool action. User reviews the form, confirms, then the app calls the server to rate energy level (1–10) for daily metrics.

### `ai-coach/chat-ui/tool-modals/RateWorkoutFeelSheet.jsx`

Bottom sheet modal shown when the AI coach proposes a "Rate Workout Feel Sheet" tool action. User reviews the form, confirms, then the app calls the server to rate how a workout felt after completing it.

### `ai-coach/chat-ui/tool-modals/SendTrainerMessageSheet.jsx`

Bottom sheet modal shown when the AI coach proposes a "Send Trainer Message Sheet" tool action. User reviews the form, confirms, then the app calls the server to send a message or alert to their human trainer.

### `ai-coach/chat-ui/tool-modals/UpdateFitnessGoalSheet.jsx`

Bottom sheet modal shown when the AI coach proposes a "Update Fitness Goal Sheet" tool action. User reviews the form, confirms, then the app calls the server to update a fitness goal (weight, strength, etc.) the coach discussed.

### `ai-coach/chat-ui/tool-modals/UpdateWorkoutSessionSheet.jsx`

Bottom sheet modal shown when the AI coach proposes a "Update Workout Session Sheet" tool action. User reviews the form, confirms, then the app calls the server to modify an scheduled or active workout entry.

### `ai-coach/chat-ui/tool-modals/toolModalHelpers.js`

Shared building blocks for all coach tool modals: title row, confirm/cancel buttons, detail rows, colors. Not a modal itself — imported by LogWaterIntakeSheet, BookTraineeSessionSheet, etc. so they look consistent.

## ai-coach/chat-ui/voice {#ai-coach-chat-ui-voice}

**Folder purpose:** Voice-to-text coach interface and speech-recognition helpers.

### `ai-coach/chat-ui/voice/VoiceCoachScreen.jsx`

Voice Coach Screen — full-screen React Native view in `ai-coach/chat-ui/voice`. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in ai-coach.

### `ai-coach/chat-ui/voice/speechRecognitionSafe.js`

Safe access to expo-speech-recognition — never loads the native module in Expo Go. Voice typing needs `npx expo run:ios` / `run:android`; Expo Go will not crash. Lazy load — skipped entirely in Expo Go.

### `ai-coach/chat-ui/voice/useVoiceToCoach.js`

Voice for AI Coach: speech-to-text (dictate) + text-to-speech (read replies). React hook in `ai-coach/chat-ui/voice` — screens call it instead of inlining fetch/Firestore logic.

## ai-coach/server-logic {#ai-coach-server-logic}

**Folder purpose:** Client-side coach backend glue: chat API, context building, tools, vision uploads.

### `ai-coach/server-logic/perplexityService.js`

Client-side Perplexity routing heuristics (mirrors server shouldUsePerplexity). Screens import functions from here rather than calling fetch/Firestore directly.

## ai-coach/server-logic/chat-api {#ai-coach-server-logic-chat-api}

**Folder purpose:** HTTP clients for coach conversations, titles, web-search detection, and chat storage.

### `ai-coach/server-logic/chat-api/chatStorageService.js`

Chat structure: { id: string (unique ID), title: string (first message or "New Chat"), messages: Array<{ role: 'user'|'assistant', content: string, imageUri?: string, timestamp: number }>, createdAt: number (timestamp), updatedAt: number (timestamp), }. Screens import functions from here rather than calling fetch/Firestore directly.

### `ai-coach/server-logic/chat-api/chatTitleUtils.js`

Chat title helpers — creative short titles for AI Coach history. UI labels include "Skinny-Fat Fix".

### `ai-coach/server-logic/chat-api/generateCreativeChatTitle.js`

Generate a short creative chat title from the first few messages via the coach API. Fallback when /chat-title is not deployed — uses the main coach route on Cloud Run.

### `ai-coach/server-logic/chat-api/loadMoreCoachConversations.js`

Fetch next page of conversations (call from Load more). Subscribes to real-time Firestore updates; uses Firestore (`conversations`).

### `ai-coach/server-logic/chat-api/refreshStaleChatSessionTitles.js`

Retroactively retitle sessions that still have raw/derived message titles. Uses Firestore (`users`).

### `ai-coach/server-logic/chat-api/sendCoachMessageToServer.js`

Client-side HTTP client for the AI coach chat API — sends messages, handles retries, and parses server responses. Called from ChatWithCoachScreen; routes to your Cloud Run backend, not directly to DeepSeek.

### `ai-coach/server-logic/chat-api/shouldUseWebSearch.js`

AI Coach web-search routing (client). Keep in sync with server/lib/coachWebSearch.js. Web Search Routing Purpose: web Search Routing.

## ai-coach/server-logic/context {#ai-coach-server-logic-context}

**Folder purpose:** Builds the prompt context the coach sees — profile, weekly stats, personal data.

### `ai-coach/server-logic/context/buildCoachPromptData.js`

Decides whether the AI Coach should load this user's app history (nutrition, workouts, sleep, etc.) into the system prompt. Why: Loading full account context costs Firestore reads and makes the prompt large. We only fetch it when the user's message is clearly about *their* data — not for generic questions like "how much protein should I eat?" Data window: since account creation (up to 2 years), with lifetime averages + last 45 days of meal detail + monthly rollups for older months. Keep patterns in sync with: server/lib/coachPersonalDataRouting.js --- Regex cheat sheet (used in every pattern below) --- /... / → regular expression (pattern matcher for text) \b → "word boundary" — start/end of a word (so "log" won't match "blog") (a|b) → "a OR b" — match either option inside the parentheses '? → the ? before ' makes the apostrophe optional ("arent" vs "aren't").* → any characters (.* = "anything in between" two phrases) \b at end → word must end cleanly (not be part of a longer word). Builds data the AI coach sees in its system prompt.

### `ai-coach/server-logic/context/loadCoachPersonalContext.js`

7-day coach context for AI Coach UI chips + server payload. Prefer GET /api/weekly-context (same logic as server getWeeklyContext). Falls back to client Firestore reads when offline or API unavailable. Resolves the server API base URL with offline fallback; reads or writes Firebase Firestore documents; uses Firestore (`users`).

### `ai-coach/server-logic/context/loadCoachWeeklyStats.js`

Client Firestore reads for 7-day AI context (matches server/lib/coachWeeklyData.js). Uses Firestore (`users`); builds data the AI coach sees in its system prompt.

## ai-coach/server-logic/macro-recalibration {#ai-coach-server-logic-macro-recalibration}

**Folder purpose:** Recalculates macro targets when the coach or user adjusts goals.

### `ai-coach/server-logic/macro-recalibration/recalculateMacrosFromCoach.js`

Day-14 macro recalibration from actual nutrition_logs + nutrition_goals. Reads or writes Firebase Firestore documents; uses Firestore (`users`).

## ai-coach/server-logic/services {#ai-coach-server-logic-services}

**Folder purpose:** Thin service wrappers (e.g. mark-all-messages-read).

### `ai-coach/server-logic/services/markAllMessagesRead.js`

Marks all unread trainer/client messages as read in Firestore when the user opens the inbox. Prevents stale unread badges after the user views their conversations.

## ai-coach/server-logic/tools {#ai-coach-server-logic-tools}

**Folder purpose:** Parses coach tool proposals, decides which UI to show, and runs confirmed actions.

### `ai-coach/server-logic/tools/chooseCoachActionUI.js`

When coach tools should interrupt with a modal vs inline chip vs auto-run. Part of coach tool parse → validate → confirm → execute flow.

### `ai-coach/server-logic/tools/cleanupToolParams.js`

Sanitizes and normalizes parameters on AI coach tool calls before execution (strips junk, fixes types). Runs in the tool pipeline so bad model output does not crash Firestore writes.

### `ai-coach/server-logic/tools/detectDeleteFoodRequest.js`

Delete-log intent detection + fix model misrouting logNutrition → deleteLog. Part of coach tool parse → validate → confirm → execute flow.

### `ai-coach/server-logic/tools/findCoachRequestsInText.js`

Lightweight client-side tool inference when the API didn't attach toolCalls but the coach message implies an action (or embeds JSON). Parses tool-call JSON embedded in coach model responses; part of coach tool parse → validate → confirm → execute flow.

### `ai-coach/server-logic/tools/runCoachAction.js`

AI Coach tool execution — server-first via /api/ai-coach/execute-tool, with client fallbacks. Writes a logged food entry to the user daily nutrition log; writes weight, sleep, steps, water to dailyLogs; uses Firestore (`users`).

### `ai-coach/server-logic/tools/shouldShowCoachAction.js`

Whether a tool proposal should be shown for user confirmation given their message intent. Part of coach tool parse → validate → confirm → execute flow.

## ai-coach/server-logic/trainer-messaging {#ai-coach-server-logic-trainer-messaging}

**Folder purpose:** Sends push/in-app notifications from the AI coach to the user's trainer.

### `ai-coach/server-logic/trainer-messaging/sendTrainerNotification.js`

Client → trainer requests (not normal chat). Subscribes to real-time Firestore updates; uses Firestore (`conversations`).

## ai-coach/server-logic/vision {#ai-coach-server-logic-vision}

**Folder purpose:** Uploads and stores images the user attaches in coach chat.

### `ai-coach/server-logic/vision/imageStorageService.js`

Request camera/media library permissions. Screens import functions from here rather than calling fetch/Firestore directly.

## ai-coach/tools {#ai-coach-tools}

**Folder purpose:** Shared coach tool-call parsers used by chat UI and server-logic.

### `ai-coach/tools/parseCoachToolCalls.js`

Parse AI Coach tool JSON from model replies (shared by server + Expo client). Part of coach tool parse → validate → confirm → execute flow.

## app-start {#app-start}

**Folder purpose:** App shell: AuthGate decides client vs trainer vs login; ClientApp and TrainerApp mount role trees.

### `app-start/AuthGate.js`

Top-level auth router: listens to Firebase auth, shows splash/login/signup/forgot-password, checks onboarding, then mounts TrainerApp or ClientApp by role inside SubscriptionProvider. Also clears coach chat/local caches and push tokens on logout and flushes pending onboarding sync — this is the real app entry after Expo loads.

### `app-start/ClientApp.js`

Client-role app root: owns client dashboard rendering, navigation/state, loading conversations/trainer/workouts/nutrition, and real-time conversation updates for the trainee experience. Mounted by AuthGate when the signed-in user is a client; wraps the client navigation shell rather than being a single screen.

### `app-start/TrainerApp.js`

Trainer-role app root: mounts the trainer navigation shell and trainer-specific data wiring after AuthGate confirms trainer role. Counterpart to ClientApp — keep trainer-only CRM/session/payment screens under trainer-app/, not here.

### `app-start/config.js`

Firebase app initialization and exports for auth/db/storage used across the client — projectId must remain anatrox-auth in production. Imported almost everywhere; renaming is fine but never swap the Firebase project id when rebranding display names.

## assets {#assets}

**Folder purpose:** Static images, Lottie animations, and icon PNGs bundled with the app.

### `assets/Run Hamster... run.json`

Lottie animation "Run Hamster... run" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets`.

### `assets/Stressed Employee At Work.json`

Lottie animation "Stressed Employee At Work" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets`.

### `assets/ai_workouts.png`

Marketing/hero image for AI-generated workout plans feature. Bundled static asset under `assets`.

### `assets/sad reaction.json`

Lottie animation "sad reaction" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets`.

### `assets/sneakers.gif`

PNG/GIF image "sneakers" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

## assets/animations {#assets-animations}

**Folder purpose:** Lottie / loading animation assets (including prism loading art).

### `assets/animations/Rubiks Cube Animation.json`

Lottie animation "Rubiks Cube Animation" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations`.

### `assets/animations/loading-prism-sheet.png`

PNG/GIF image "loading prism sheet" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/animations/rubiks-cube-loading.json`

Lottie animation "rubiks cube loading" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations`.

## assets/animations/app-flows {#assets-animations-app-flows}

**Folder purpose:** Lottie animations played during onboarding and app-flow steps.

### `assets/animations/app-flows/Exercise for diet or health.json`

Lottie animation "Exercise for diet or health" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/Guy talking to Robot _ AI Help.json`

Lottie animation "Guy talking to Robot AI Help" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/certifications.json`

Lottie animation "certifications" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/equipment.json`

Lottie animation "equipment" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/experience-timeline.json`

Lottie animation "experience timeline" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/fitness-experience.json`

Lottie animation "fitness experience" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/fitness-goal.json`

Lottie animation "fitness goal" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/injuries.json`

Lottie animation "injuries" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/invite-code.json`

Lottie animation "invite code" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/personal-info.json`

Lottie animation "personal info" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/philosophy.json`

Lottie animation "philosophy" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/rates.json`

Lottie animation "rates" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/role-selection.json`

Lottie animation "role selection" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/specialties.json`

Lottie animation "specialties" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/trainer-code.json`

Lottie animation "trainer code" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/training-frequency.json`

Lottie animation "training frequency" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

## assets/animations/legacy {#assets-animations-legacy}

**Folder purpose:** Legacy branded Lottie files (AI, food, fitness themes).

### `assets/animations/legacy/Artificial intelligence digital technology (1).json`

Lottie animation "Artificial intelligence digital technology (1)" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.

### `assets/animations/legacy/Cloud robotics abstract.json`

Lottie animation "Cloud robotics abstract" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.

### `assets/animations/legacy/Fast food.json`

Lottie animation "Fast food" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.

### `assets/animations/legacy/Fitness.json`

Lottie animation "Fitness" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.

### `assets/animations/legacy/Food squeeze_With Burger and hot dog.json`

Lottie animation "Food squeeze With Burger and hot dog" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.

### `assets/animations/legacy/Healthy food for diet & fitness.json`

Lottie animation "Healthy food for diet & fitness" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.

### `assets/animations/legacy/boxer lottie.json`

Lottie animation "boxer lottie" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.

### `assets/animations/legacy/fitness (1).json`

Lottie animation "fitness (1)" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.

### `assets/animations/legacy/food around the city.json`

Lottie animation "food around the city" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.

### `assets/animations/legacy/glass water.json`

Lottie animation "glass water" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.

### `assets/animations/legacy/loading.json`

Lottie animation "loading" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.

### `assets/animations/legacy/sleep.json`

Lottie animation "sleep" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.

## assets/icons {#assets-icons}

**Folder purpose:** Nutrition, workout, and UI icon PNGs/GIFs used across onboarding and dashboards.

### `assets/icons/Carbs.png`

Macro breakdown UI — carbohydrate icon on nutrition cards and dashboards. Bundled static asset under `assets/icons`.

### `assets/icons/Check in.png`

PNG/GIF image "Check in" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/Fats.png`

Macro breakdown UI — fat icon on nutrition cards and dashboards. Bundled static asset under `assets/icons`.

### `assets/icons/Illustration-of-Google-icon-on-transparent-background-PNG.png`

PNG/GIF image "Illustration of Google icon on transparent background PNG" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/Progress.png`

PNG/GIF image "Progress" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/Protein.png`

Macro breakdown UI — protein icon on nutrition cards and dashboards. Bundled static asset under `assets/icons`.

### `assets/icons/Schedule.png`

PNG/GIF image "Schedule" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/This Week.png`

PNG/GIF image "This Week" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/apple-logo.png`

Sign in with Apple button on auth screen. Bundled static asset under `assets/icons`.

### `assets/icons/arm-muscle.gif`

PNG/GIF image "arm muscle" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/banned.png`

PNG/GIF image "banned" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/burger.png`

PNG/GIF image "burger" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/delete.png`

PNG/GIF image "delete" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/digital-gift-card-abstract-concept-illustration.png`

PNG/GIF image "digital gift card abstract concept illustration" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/dumbbell.png`

Workout-related UI — exercise and training sections. Bundled static asset under `assets/icons`.

### `assets/icons/energy.png`

Energy level icon on home stats and daily metrics. Bundled static asset under `assets/icons`.

### `assets/icons/enviro.png`

PNG/GIF image "enviro" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/environment.png`

PNG/GIF image "environment" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/frequency-2.svg`

Static asset `frequency-2.svg` in `assets/icons`. Referenced by nearby UI code via require/import.

### `assets/icons/frequency2SvgXml.js`

Frequency2Svg Xml in `assets/icons`. Part of `assets/icons` — search the repo for "frequency2SvgXml" to see what imports it before renaming.

### `assets/icons/google_gemini.png`

AI Coach nav icon — indicates Gemini-powered coach features. Bundled static asset under `assets/icons`.

### `assets/icons/height.png`

Height input icon during onboarding. Bundled static asset under `assets/icons`.

### `assets/icons/hydration.png`

Water/hydration tracking icon on home stats and daily metrics. Bundled static asset under `assets/icons`.

### `assets/icons/injury.png`

PNG/GIF image "injury" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/journey.png`

PNG/GIF image "journey" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/people.png`

PNG/GIF image "people" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/picture.png`

PNG/GIF image "picture" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/scales.png`

Weight/body metrics icon in onboarding and profile. Bundled static asset under `assets/icons`.

### `assets/icons/settings.png`

Settings gear icon in headers and menus. Bundled static asset under `assets/icons`.

### `assets/icons/sleeping.png`

Sleep tracking icon on home stats and daily metrics. Bundled static asset under `assets/icons`.

### `assets/icons/stress.png`

PNG/GIF image "stress" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/supplement.png`

PNG/GIF image "supplement" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/weightlifting-competition.json`

Lottie animation "weightlifting competition" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/icons`.

### `assets/icons/workout.png`

Workout tab and plan-related navigation icons. Bundled static asset under `assets/icons`.

## assets/icons/New Icons {#assets-icons-New-Icons}

**Folder purpose:** Onboarding picker icons (equipment, experience level, gender).

### `assets/icons/New Icons/Advanced.png`

Onboarding — advanced fitness experience level option. Bundled static asset under `assets/icons/New Icons`.

### `assets/icons/New Icons/Age.png`

Onboarding picker icon: Age. Shown when the user selects equipment, experience, gender, or similar profile options. Duplicated/consolidated asset path so onboarding screens can import icons consistently.

### `assets/icons/New Icons/Beginner.png`

Onboarding — beginner fitness experience level option. Bundled static asset under `assets/icons/New Icons`.

### `assets/icons/New Icons/Bodyweight Only.png`

Onboarding picker icon: Bodyweight Only. Shown when the user selects equipment, experience, gender, or similar profile options. Duplicated/consolidated asset path so onboarding screens can import icons consistently.

### `assets/icons/New Icons/Full Gym.png`

Onboarding picker icon: Full Gym. Shown when the user selects equipment, experience, gender, or similar profile options. Duplicated/consolidated asset path so onboarding screens can import icons consistently.

### `assets/icons/New Icons/Intermediate.png`

Onboarding — intermediate fitness experience level option. Bundled static asset under `assets/icons/New Icons`.

### `assets/icons/New Icons/Other.png`

Onboarding picker icon: Other. Shown when the user selects equipment, experience, gender, or similar profile options. Duplicated/consolidated asset path so onboarding screens can import icons consistently.

### `assets/icons/New Icons/Pull Up Bar.png`

Onboarding picker icon: Pull Up Bar. Shown when the user selects equipment, experience, gender, or similar profile options. Duplicated/consolidated asset path so onboarding screens can import icons consistently.

### `assets/icons/New Icons/Resistance Bands.png`

Onboarding picker icon: Resistance Bands. Shown when the user selects equipment, experience, gender, or similar profile options. Duplicated/consolidated asset path so onboarding screens can import icons consistently.

### `assets/icons/New Icons/dumbbells.png`

Onboarding — home gym equipment option (dumbbells only). Bundled static asset under `assets/icons/New Icons`.

### `assets/icons/New Icons/female.png`

Onboarding — gender selection (female). Bundled static asset under `assets/icons/New Icons`.

### `assets/icons/New Icons/male.png`

Onboarding — gender selection (male). Bundled static asset under `assets/icons/New Icons`.

### `assets/icons/New Icons/prefer not to say.png`

Onboarding — gender prefer-not-to-say option. Bundled static asset under `assets/icons/New Icons`.

## assets/logo {#assets-logo}

**Folder purpose:** Brand logo image assets.

### `assets/logo/Logo.PNG`

PNG/GIF image "Logo" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/logo/Transparent Logo.PNG`

PNG/GIF image "Transparent Logo" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/logo/brandLogo.js`

Official Coach Connect brand mark (interlocking CC infinity gradient). Native asset aspect ratio — width / height.

## assets/onboarding-consolidated {#assets-onboarding-consolidated}

**Folder purpose:** Flattened onboarding icon set for consolidated imports.

### `assets/onboarding-consolidated/Advanced.png`

Onboarding — advanced fitness experience level option. Bundled static asset under `assets/onboarding-consolidated`.

### `assets/onboarding-consolidated/Age.png`

Onboarding picker icon: Age. Shown when the user selects equipment, experience, gender, or similar profile options. Duplicated/consolidated asset path so onboarding screens can import icons consistently.

### `assets/onboarding-consolidated/Beginner.png`

Onboarding — beginner fitness experience level option. Bundled static asset under `assets/onboarding-consolidated`.

### `assets/onboarding-consolidated/Intermediate.png`

Onboarding — intermediate fitness experience level option. Bundled static asset under `assets/onboarding-consolidated`.

### `assets/onboarding-consolidated/Other.png`

Onboarding picker icon: Other. Shown when the user selects equipment, experience, gender, or similar profile options. Duplicated/consolidated asset path so onboarding screens can import icons consistently.

### `assets/onboarding-consolidated/bodyweight_only.png`

Onboarding — bodyweight-only training option. Bundled static asset under `assets/onboarding-consolidated`.

### `assets/onboarding-consolidated/dumbbells.png`

Onboarding — home gym equipment option (dumbbells only). Bundled static asset under `assets/onboarding-consolidated`.

### `assets/onboarding-consolidated/female.png`

Onboarding — gender selection (female). Bundled static asset under `assets/onboarding-consolidated`.

### `assets/onboarding-consolidated/full_gym.png`

Onboarding — full commercial gym equipment option. Bundled static asset under `assets/onboarding-consolidated`.

### `assets/onboarding-consolidated/height.png`

Height input icon during onboarding. Bundled static asset under `assets/onboarding-consolidated`.

### `assets/onboarding-consolidated/male.png`

Onboarding — gender selection (male). Bundled static asset under `assets/onboarding-consolidated`.

### `assets/onboarding-consolidated/prefer_not_to_say.png`

Onboarding — gender prefer-not-to-say option. Bundled static asset under `assets/onboarding-consolidated`.

### `assets/onboarding-consolidated/pull_up_bar.png`

Onboarding picker icon: pull up bar. Shown when the user selects equipment, experience, gender, or similar profile options. Duplicated/consolidated asset path so onboarding screens can import icons consistently.

### `assets/onboarding-consolidated/resistance_bands.png`

Onboarding picker icon: resistance bands. Shown when the user selects equipment, experience, gender, or similar profile options. Duplicated/consolidated asset path so onboarding screens can import icons consistently.

### `assets/onboarding-consolidated/scales.png`

Weight/body metrics icon in onboarding and profile. Bundled static asset under `assets/onboarding-consolidated`.

## auth {#auth}

**Folder purpose:** Login, signup, password reset, onboarding wizard, and role-detection helpers.

### `auth/LoginScreen.js`

Combined auth UI (welcome, role selection, signup, login) with internal step state — the screen users see when signed out. AuthGate mounts this during the unauthenticated flow; Firebase email/password and social sign-in live here.

### `auth/OnboardingPreviewScreen.jsx`

Dev-only onboarding gallery — browse every client/trainer step without signing up. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in auth.

### `auth/OnboardingSnapshotRunner.jsx`

Auto-cycles real OnboardingWizardScreen steps and pings the Mac capture server. Trigger: coachconnect://onboarding-snapshots (dev only). Part of `auth` — search the repo for "OnboardingSnapshotRunner" to see what imports it before renaming.

### `auth/OnboardingWizardScreen.jsx`

OnboardingWizardScreen - Combined onboarding flow for clients and trainers Handles all 6 onboarding steps for both client and trainer roles with Apple-style subtle gradients throughout. Reads or writes Firebase Firestore documents; requests camera access for barcode or photo capture; renders Lottie animations in the UI.

### `auth/ResetPasswordScreen.jsx`

Reset Password Screen — full-screen React Native view in `auth`. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in auth.

### `auth/authSessionTransition.js`

Clears local session when auth uid changes or signs out. Part of `auth` — search the repo for "authSessionTransition" to see what imports it before renaming.

### `auth/detectUserRole.js`

Helper functions for AuthGate: normalizeAppRole, profileNeedsOnboarding, isLikelyNewFirebaseUser. Exported for unit tests in authGate.test.js — not UI, just boolean routing decisions.

### `auth/finishOnboarding.js`

Client-side onboarding completion writes (extracted from OnboardingWizardScreen.handleFinish). Hits API routes /api/onboarding/complete; uses Firestore (`users`).

### `auth/normalizeOnboardingRole.js`

Normalizes whether the user chose client or trainer during onboarding into values AuthGate expects. Prevents role string mismatches ('Client' vs 'client') from routing to the wrong app shell.

### `auth/onboardingSnapshotManifest.json`

Lottie animation "onboarding Snapshot Manifest" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `auth`.

### `auth/onboardingSnapshotSteps.js`

Onboarding Snapshot Steps in `auth`. Part of `auth` — search the repo for "onboardingSnapshotSteps" to see what imports it before renaming.

### `auth/validateTrainerInviteCode.js`

Normalize client input to match stored format (XXX-XXX). Returns null if invalid. Hits API routes /api/onboarding/validate-trainer-code.

## auth/services {#auth-services}

**Folder purpose:** Password-reset email requests via Firebase/backend.

### `auth/services/requestPasswordReset.js`

Request a password reset email — branded via API when deployed, else Firebase client SDK. Continue URL must be on Firebase Authorized domains — not an undeployed API path.

### `auth/services/sendPasswordResetEmail.js`

Thin wrapper that triggers password-reset email via Firebase or the backend API. Called from ForgotPasswordFlow screens when the user submits their email.

## client-app/dashboard {#client-app-dashboard}

**Folder purpose:** Client dashboard: hero card, stats, trainer card, workout log hook.

### `client-app/dashboard/DashboardHeroCard.jsx`

Matches Aurora hero + Settings: dark pink → dark orange. UI labels include "Workouts".

### `client-app/dashboard/PremiumStatsSection.jsx`

Dashboard grid of premium stat cards (workouts, nutrition, hydration, sleep) on the client home/dashboard. Wraps each stat in gradient borders and pulls live values from daily metrics hooks.

### `client-app/dashboard/PremiumTrainerCard.jsx`

Dark pink → dark orange brand CTA. UI labels include "Message".

### `client-app/dashboard/ReviewSubmitSheet.js`

Bottom sheet for submitting or editing a trainer review. Reads or writes Firebase Firestore documents.

### `client-app/dashboard/TrainingDashboardScreen.jsx`

Same purple → orange stripe as hero / training agenda cards. Writes weight, sleep, steps, water to dailyLogs; reads or writes Firebase Firestore documents; renders Lottie animations in the UI.

### `client-app/dashboard/useWorkoutLog.js`

Structured workout logger: exercises + sets stored as workoutLog in dailyLogs. React hook in `client-app/dashboard` — screens call it instead of inlining fetch/Firestore logic.

## client-app/files {#client-app-files}

**Folder purpose:** Client view of trainer-shared files, notes, and personal file gallery.

### `client-app/files/ClientFilesScreen.jsx`

Client Files Screen — the screen the user sees for this part of the client-app flow. Renders gradient backgrounds and buttons.

### `client-app/files/FileCard.jsx`

File Card — renders gradient backgrounds and buttons. UI labels include "Photo".

### `client-app/files/MyFilesSection.jsx`

My Files Section — lets the user pick photos from the camera roll. Renders gradient backgrounds and buttons; UI labels include "All Files".

### `client-app/files/NotesFromTrainerSection.jsx`

Notes From Trainer Section in `client-app/files`. Part of client in Coach Connect.

### `client-app/files/TrainerSharedFilesModal.jsx`

Full-screen list of trainer-shared files (same grid chrome as home preview). User dismisses it after completing the action or tapping Cancel.

### `client-app/files/TrainerSharedSection.jsx`

Trainer Shared Section in `client-app/files`. UI labels include "Documents".

## client-app/home {#client-app-home}

**Folder purpose:** Client home tab: welcome card, bootstrap hooks, home screen styles.

### `client-app/home/clientAppStyles.js`

Wellness row: stack title + value as one centered group (no space-between gap). Client App Styles Purpose: client App Styles.

### `client-app/home/clientHomeComponents.jsx`

Client Home Components — renders Lottie animations in the UI. Renders gradient backgrounds and buttons; UI labels include "Calories".

### `client-app/home/useClientHomeBootstrap.js`

Initial home dashboard Firestore fetch (user doc, goals, nutrition, workouts). React hook in `client-app/home` — screens call it instead of inlining fetch/Firestore logic.

### `client-app/home/useClientHomeDailyMetrics.js`

Home-screen daily metrics: midnight rollover, archive, live Firestore sync. React hook in `client-app/home` — screens call it instead of inlining fetch/Firestore logic.

## client-app/marketplace {#client-app-marketplace}

**Folder purpose:** Find-a-trainer marketplace: filters, trainer cards, request sheets.

### `client-app/marketplace/BrowseTrainersScreen.jsx`

Matches ClientApp AI Coach `HeroWelcomeCard` / home hero banner shell (static border). Renders gradient backgrounds and buttons.

### `client-app/marketplace/FilterModal.js`

Filter Modal — popup overlay on top of the current screen. Renders gradient backgrounds and buttons.

### `client-app/marketplace/MarketplaceGlass.jsx`

Frosted glass panel — blur backdrop + translucent tint + soft top-lit border (web.glass-card). Marketplace Glass Purpose: Marketplace Glass.

### `client-app/marketplace/MarketplaceTrainerProfileSheet.jsx`

Marketplace Trainer Profile Sheet — bottom sheet that slides up for a quick decision or form. Renders gradient backgrounds and buttons.

### `client-app/marketplace/MarketplaceUI.jsx`

Pink → orange gradient text (web.text-gradient). UI labels include "Filter".

### `client-app/marketplace/SearchTrainersScreen.jsx`

When false, this screen skips its own nav but parent shell still shows BottomNavBar. Reads or writes Firebase Firestore documents.

### `client-app/marketplace/TrainerCard.jsx`

Trainer Card — marketplace browse list. Part of `client-app/marketplace` — search the repo for "TrainerCard" to see what imports it before renaming.

### `client-app/marketplace/TrainerRequestConfirmModal.jsx`

Trainer Request Confirm Modal — popup overlay on top of the current screen. Renders gradient backgrounds and buttons.

### `client-app/marketplace/TrainerRequestIntroModal.jsx`

Trainer Request Intro Modal — popup overlay on top of the current screen. Renders gradient backgrounds and buttons.

### `client-app/marketplace/marketplaceFilters.js`

Marketplace filter shape, theme tokens, and filter logic (reference UI spec; Firebase as source). Marketplace Filters Purpose: marketplace Filters.

### `client-app/marketplace/useTrainerConnectFlow.js`

Shared connect / request flow for marketplace trainer profiles. React hook in `client-app/marketplace` — screens call it instead of inlining fetch/Firestore logic.

## client-app/meal-plan {#client-app-meal-plan}

**Folder purpose:** Client meal plan viewer (if assigned by trainer).

### `client-app/meal-plan/LogTodaysMealsScreen.jsx`

Log Todays Meals Screen — the screen the user sees for this part of the client-app flow. Writes a logged food entry to the user daily nutrition log; reads or writes Firebase Firestore documents; uses the device camera to scan product barcodes.

## client-app/navigation {#client-app-navigation}

**Folder purpose:** Client app shell, bottom nav, overlay stack, screen navigation hook.

### `client-app/navigation/ClientAppShellContext.jsx`

React context holding client shell state: which overlay screen is open, back handlers, and tab visibility. ClientMainScreen and overlay screens read this instead of prop-drilling navigation state.

### `client-app/navigation/ClientMainScreen.jsx`

Client Main Screen — the screen the user sees for this part of the client-app flow. Writes weight, sleep, steps, water to dailyLogs; reads or writes Firebase Firestore documents; registers or navigates between app screens.

### `client-app/navigation/ClientRootNavigator.jsx`

Client Root Navigator — registers or navigates between app screens. Part of client in Coach Connect.

### `client-app/navigation/ClientShellBottomNav.jsx`

Floating bottom navigation bar on client stack screens (Profile, Settings, etc.) when not on the main tab bar. Lets users jump back to Home or Coach without losing their place in a sub-screen.

### `client-app/navigation/clientOverlayScreens.jsx`

Maps overlay route names to screens: Profile, Settings, FAQ, Terms, Nutrition, Marketplace, Weekly Report, etc. Rendered on top of ClientMainScreen when user opens settings or support from the client shell.

### `client-app/navigation/useClientScreenNavigation.js`

Primary bottom-nav destinations stay on MainTabs (not stack) so the bar stays visible. React hook in `client-app/navigation` — screens call it instead of inlining fetch/Firestore logic.

## client-app/profile {#client-app-profile}

**Folder purpose:** Client profile screen.

### `client-app/profile/ViewMyProfileScreen.jsx`

Unified profile chrome — CoachConnect warm accent (dark pink → dark orange). Reads or writes Firebase Firestore documents; lets the user pick photos from the camera roll; renders gradient backgrounds and buttons.

## client-app/workout-plans {#client-app-workout-plans}

**Folder purpose:** Client AI workout plans list screen.

### `client-app/workout-plans/ViewMyWorkoutPlanScreen.jsx`

One unique muted rim gradient per weekday — not oversaturated. Renders gradient backgrounds and buttons.

## components {#components}

**Folder purpose:** Root-level shared components (payments popups, Stripe sheets, onboarding steps).

### `components/ClientPaymentModal.jsx`

In-app card form for a client to pay their coach via Stripe (POST /api/charges). Renders gradient backgrounds and buttons.

### `components/ErrorBoundary.jsx`

Error Boundary in `components`. Part of `components` — search the repo for "ErrorBoundary" to see what imports it before renaming.

### `components/PaymentSetupPopup.jsx`

Post-signup payment setup modal — shown on trainer dashboard, not during onboarding. UI labels include "Close".

## components/onboarding {#components-onboarding}

**Folder purpose:** Onboarding step components used during signup/profile setup.

### `components/onboarding/Step4_BankAccount.jsx`

Optional bank setup during trainer signup so coaches can receive client payments. UI labels include "Connect with Stripe".

## lib {#lib}

**Folder purpose:** Small shared libraries at src root (sessions helper).

### `lib/sessions.js`

Date/time formatting helpers for trainer session scheduling (pad2, long date, 12-hour time). Used by session cards and calendar views to display human-readable session times.

## messaging {#messaging}

**Folder purpose:** Conversations list and chat thread screens shared by client and trainer roles.

### `messaging/ChatThreadScreen.jsx`

Trainer Messaging (Chat) Screen — new glass UI, existing Firebase and send flow. Real-time via subscribeToMessages; send via trainerMessaging.sendMessage. Reads or writes Firebase Firestore documents; lets the user pick photos from the camera roll; renders gradient backgrounds and buttons.

### `messaging/MyMessagesScreen.jsx`

Conversations List Screen — new glass UI, existing Firebase and navigation. Real-time via subscribeToConversations; account isolation via participants + trainer clients filter. Reads or writes Firebase Firestore documents; renders gradient backgrounds and buttons.

### `messaging/unreadCountIndex.js`

Denormalized unread message counts — single listener on users/{uid}/unreadCount/index. Subscribes to real-time Firestore updates; uses Firestore (`users`).

## metrics/daily-metrics {#metrics-daily-metrics}

**Folder purpose:** Weight, steps, sleep, water — date keys and Firestore daily log writes.

### `metrics/daily-metrics/archiveDailyMetricsAtMidnight.js`

Archive yesterday's dashboard metrics into `daily_logs/{uid}_{date}`. Idempotent merge write. Caches data locally on the device between app launches; uses Firestore (`users`).

### `metrics/daily-metrics/getRecentWeight.js`

Resolves the client's most recent logged weight from dailyLogs (dashboard_weight). Used for trainer progress "Current" when today has no weight entry — not profile weight. Uses Firestore (`users`); writes to users/{uid}/dailyLogs/{date}.

### `metrics/daily-metrics/parseUserDailyMetrics.js`

Pure parse/mirror helpers (CJS for Node tests). Keep in sync with dailyMetricsService.js. Writes to users/{uid}/dailyLogs/{date}.

### `metrics/daily-metrics/saveDailyMetricsToFirestore.js`

Canonical client daily metrics: `users/{uid}/dailyLogs/{date}`. Mirrors home-screen fields into `daily_tracking` on write (legacy compat). Centralizes collection paths and query shapes for this feature.

### `metrics/daily-metrics/useLocalTodayDateKey.js`

YYYY-MM-DD for "today" in the device timezone. Updates at local midnight (and every 30s) so Firestore listeners re-bind to the new daily doc. React hook in `metrics/daily-metrics` — screens call it instead of inlining fetch/Firestore logic.

## metrics/daily-quotes {#metrics-daily-quotes}

**Folder purpose:** Static JSON list of motivational quotes for the home card.

### `metrics/daily-quotes/dailyQuotesList.json`

JSON array of motivational quotes rotated on the client home "daily quote" card. No logic in this file — `DailyQuoteCard` imports and picks a quote by date.

## navigation {#navigation}

**Folder purpose:** Cross-app navigation utilities (shell navigate helper, route names, AppNavigationContext).

### `navigation/AppNavigationContext.js`

AppNavigationContext - Centralized navigation for CoachConnect header and bottom nav Apps (ClientApp, TrainerApp) provide handlers via the provider. CoachConnectHeader and BottomNavBar consume this context, falling back to props when no provider. This keeps navigation logic out of app files and in the shared components. App Navigation Context Purpose: App Navigation Context.

### `navigation/BottomNavBar.js`

Logo-aligned vertical gradient for all tab icons (pink → purple → indigo). Caches data locally on the device between app launches.

### `navigation/bottomNavMetrics.js`

Visual height of BottomNavBar (excludes home-indicator inset). Bottom Nav Metrics Purpose: bottom Nav Metrics.

### `navigation/linking.js`

Deep linking stub — expand when universal links are configured. Linking Purpose: linking.

### `navigation/navigationRef.js`

Global React Navigation ref so code outside components can navigate (rootNavigate, goBack, reset). Used by push notifications and deep links that need to open a specific screen.

### `navigation/routes.js`

React Navigation route names — keep stable for deep linking stubs. Prevents typos when pushing screens — import ROUTES.X instead of raw strings.

### `navigation/shellNavigate.js`

Resolve stack/tab navigation from app shell when a screen prop is missing. Shell Navigate Purpose: shell Navigate.

## notifications {#notifications}

**Folder purpose:** Push notification text formatting and Firestore notification management.

### `notifications/buildPushNotificationText.js`

DetailLine e.g. "Session scheduled: Mon at 3:00 PM". Push Copy Purpose: push Copy.

### `notifications/manageNotifications.js`

@type {((data: Record<string, unknown>) => void) | null}. Caches data locally on the device between app launches; uses Firestore (`users`).

### `notifications/stripNotificationEmoji.js`

Remove emoji / pictographs from push notification title and body (client). Keep logic aligned with server/stripNotificationEmoji.js. Strip Notification Emoji Purpose: strip Notification Emoji.

### `notifications/useUnreadNotificationCount.js`

Live unread message badge count — single Firestore listener with cleanup on unmount. React hook in `notifications` — screens call it instead of inlining fetch/Firestore logic.

## nutrition {#nutrition}

**Folder purpose:** Full nutrition feature: daily log, food search, barcode, facts, settings, premium food cards.

### `nutrition/nutritionTheme.js`

Color gradients and tokens for nutrition UI (calorie ring, macro bars, action buttons). Import NUT_* constants so food cards and the daily log share the same visual language.

## nutrition/barcode {#nutrition-barcode}

**Folder purpose:** Barcode scanner flow and Serper/USDA lookup for packaged foods.

### `nutrition/barcode/BarcodeScannerScreen.js`

Barcode viewfinder corners — dark pink / dark orange. Writes a logged food entry to the user daily nutrition log; uses the device camera to scan product barcodes; requests camera access for barcode or photo capture.

### `nutrition/barcode/normalizeBarcodeForLookup.js`

Fixes barcode digits from the camera (leading zeros, UPC-A vs EAN-13) before server lookup. Mobile scanners often drop check digits; this prevents false 'product not found' results.

### `nutrition/barcode/renderScannedBarcode.js`

Formats scanned barcode results for display: macro summary, source label, and confidence badge. Used after a successful barcode lookup to show what the user scanned before they log it.

### `nutrition/barcode/validateBarcodeFood.js`

Reject junk barcode hits (GS1 tracker pages, zero-macro Serper guesses, etc.) Shared by client scanner + server /api/food/barcode. @returns {boolean} true when safe to show on Confirm & log.

## nutrition/components {#nutrition-components}

**Folder purpose:** Shared nutrition UI widgets (gradient frames, etc.).

### `nutrition/components/GradientFieldFrame.jsx`

Soft violet→mauve→steel border (matches FoodSearchScreen, not harsh rainbow). Gradient Field Frame Purpose: Gradient Field Frame.

## nutrition/components/premiumFoodCard {#nutrition-components-premiumFoodCard}

**Folder purpose:** Premium-styled food card, nutrition facts section, logged-food display.

### `nutrition/components/premiumFoodCard/FoodCard.jsx`

Premium expandable food logging card. UI labels include "Edit food".

### `nutrition/components/premiumFoodCard/GradientText.jsx`

Renders gradient-colored text using MaskedView (React Native has no CSS background-clip). Used on premium food cards for stylized calorie/macro numbers.

### `nutrition/components/premiumFoodCard/LoggedFoodCard.jsx`

Single logged-food row in the daily meal list — transparent card over the meal section background. Shows food name, serving, calories, and tap-to-edit; used inside NutritionContainer meal cards.

### `nutrition/components/premiumFoodCard/NutritionFactsSection.jsx`

Premium expanded nutrition breakdown — macro split + stylized facts panel. UI labels include "Fiber".

### `nutrition/components/premiumFoodCard/NutritionFoodListScreen.jsx`

Premium nutrition list screen — FlatList of FoodCards with sticky-style header. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in nutrition.

### `nutrition/components/premiumFoodCard/formatLoggedFoodDisplay.js`

Maps a logged food entry (Firestore / meal list) to premium FoodCard shape. UI labels include "Chobani · 1 bowl · 320g".

### `nutrition/components/premiumFoodCard/index.js`

Barrel export file — re-exports FoodCard, LoggedFoodCard, NutritionFactsSection for clean imports. Import from this index instead of individual files when using the premium food card kit.

### `nutrition/components/premiumFoodCard/theme.js`

Premium food card design tokens — Coach Connect macro palette. Macro mapping — full stops for accents (dots, thin bars).

## nutrition/daily-log {#nutrition-daily-log}

**Folder purpose:** Daily nutrition log screen, meal cards, Firestore write helpers.

### `nutrition/daily-log/MacroBar.js`

Macro Bar in `nutrition/daily-log`. Part of nutrition in Coach Connect.

### `nutrition/daily-log/MealCard.js`

Meal Card — renders gradient backgrounds and buttons. Part of nutrition in Coach Connect.

### `nutrition/daily-log/NutritionContainer.jsx`

Parent tab bar overlays content (e.g. ClientMainScreen absolute BottomNavBar). Reads or writes Firebase Firestore documents; uses the device camera to scan product barcodes; UI labels include "Protein".

### `nutrition/daily-log/NutritionDayPicker.jsx`

Week calendar — circular day buttons with prev/next week navigation. Nutrition Day Picker Purpose: Nutrition Day Picker.

### `nutrition/daily-log/NutritionScreen.jsx`

Meal card actions — brand gradients (dark orange → pink / purple / gold). Renders Lottie animations in the UI; renders gradient backgrounds and buttons.

### `nutrition/daily-log/logFoodToFirestore.js`

Peel nested metadata.metadata… layers and drop undefined before Firestore writes. Centralizes collection paths and query shapes for this feature.

## nutrition/food-details {#nutrition-food-details}

**Folder purpose:** Food detail / nutrition facts screen, serving editor, label parsing.

### `nutrition/food-details/EditServingModal.jsx`

Slim “Edit serving” dialog for a food log — gradient accents, compact fields. Renders gradient backgrounds and buttons.

### `nutrition/food-details/FoodItem.js`

Food Item — renders gradient backgrounds and buttons. Part of nutrition in Coach Connect.

### `nutrition/food-details/NutritionFactsScreen.jsx`

Muted accents — Nutrition Facts screen only (do not change global theme). Writes a logged food entry to the user daily nutrition log; renders gradient backgrounds and buttons.

### `nutrition/food-details/calculateServingSize.js`

Shared serving / gram math for barcode and per-100g food sources. calories and macros on openfoodfacts + usda barcode hits are per 100 g (or 100 ml). Serving Math Purpose: serving Math.

### `nutrition/food-details/cleanFoodBrandName.js`

Consumer-facing brands that should win over parent-company prefixes in titles. Food Brand Display Purpose: Serving size editor and nutrition facts detail views. Food Brand Display supports the `nutrition/food-details` feature area — helpers, parsers, or UI pieces used by nearby files. Logic module with exports: see file for exports. Check who imports this file before refactoring. Area: nutrition/food-details.

### `nutrition/food-details/fixFoodNutritionNumbers.js`

Nutrition portion normalization for Open Food Facts and other sources. Parses product.quantity (e.g. "500 ml", "16.9 fl oz", "340 g") and computes default serving amount + total calories so full packages (e.g. Pepsi bottle) log correctly. Nutrition Normalization Purpose: nutrition Normalization.

### `nutrition/food-details/nutritionFactsModel.js`

Build a full nutrition-facts view model from a logged food entry. UI labels include "Calories".

## nutrition/food-search {#nutrition-food-search}

**Folder purpose:** Food search screen, ranking, consensus search, confirm-selection sheet.

### `nutrition/food-search/ConfirmFoodSelectionSheet.jsx`

Food Confirm Sheet — Weber-style premium Confirm & log UI (barcode + search). Renders gradient backgrounds and buttons.

### `nutrition/food-search/FoodSearchScreen.js`

Main food search UI: query input, recent/favorites, ranked multi-source results, and navigation into confirm/log flows for daily nutrition. Talks to server search pipelines (FatSecret/USDA/OFF/Serper) via search helpers; part of search → pick → log.

### `nutrition/food-search/SearchQualityCard.jsx`

Hero disclaimer for food search — matches DashboardHeroCard / marketplace heroes. Always fully expanded on open (no collapse / expand dance). UI labels include "Calories"; part of search → pick food → log to daily nutrition.

### `nutrition/food-search/cleanFoodCardLabels.js`

Clean web-search (Serper) titles for food cards — never show [PDF] / "Nutrition Information". Part of search → pick food → log to daily nutrition.

### `nutrition/food-search/guessServingSize.js`

Infers human-readable serving labels for food search cards across sources using food-family allowlists and a cross-family conflict matrix so junk units (nugget/wing/piece) do not attach to bread/pizza/burger-style foods. Pure ranking/label helper imported by food search/confirm UI — safe rename target if you update imports.

### `nutrition/food-search/isReliableRestaurantFood.js`

Generic Serper quality for restaurant / menu-item searches (no per-chain hardcoding). Used by server nutritionSearchHelpers + food search ranking. Part of search → pick food → log to daily nutrition.

### `nutrition/food-search/makeReadableFoodTitle.js`

Canonical food display names — one pipeline for search, confirm, log, and read-back. Part of search → pick food → log to daily nutrition.

### `nutrition/food-search/mergeFoodNutritionSources.js`

Client helpers for POST /api/nutrition/search — multi-source consensus rows. UI labels include "McDonald"; part of search → pick food → log to daily nutrition.

### `nutrition/food-search/normalizeFoodQuery.js`

Shared food normalization + serving unit guards for search, barcode, and logging. Part of search → pick food → log to daily nutrition.

### `nutrition/food-search/searchFoodsService.js`

Singleton class that runs all food search: server API, consensus search, Open Food Facts fallback, and local cache. FoodSearchScreen calls search() here — you should not call food APIs directly from UI components.

### `nutrition/food-search/sortBestFoodMatches.js`

Category / size words titles often omit — still used for ranking, not hard-required. Part of search → pick food → log to daily nutrition.

### `nutrition/food-search/trustedFoodCatalog.js`

Trusted curated catalog for high-traffic restaurant searches. Used as an authoritative first hit so Serper junk cannot crowd out famous items. Macros sourced from public chain nutrition pages / FastFoodNutrition (approx 2024–2026). Ranges are intentional — restaurant formulas change; we store a representative serving. UI labels include "1 bottle (20 fl oz)"; part of search → pick food → log to daily nutrition.

## nutrition/quick-add {#nutrition-quick-add}

**Folder purpose:** Quick-add macros without full food search.

### `nutrition/quick-add/QuickAddNutrition.jsx`

* Quick Add Nutrition * * Purpose: UI screen or component: Quick Add Nutrition. * Why Renders gradient backgrounds and buttons; UI labels include "rgba(255,255,255,0.38)".

## nutrition/settings {#nutrition-settings}

**Folder purpose:** Nutrition onboarding wizard and macro/target settings.

### `nutrition/settings/NutritionOnboardingScreen.jsx`

Matches BottomNavBar minHeight when tab bar overlays this screen. Reads or writes Firebase Firestore documents; renders gradient backgrounds and buttons.

### `nutrition/settings/NutritionSettingsScreen.js`

Settings screen to edit daily calorie goal, macro split, and nutrition preferences after initial onboarding. Changes here update what the daily log rings and AI coach context use as targets.

## nutrition/utils {#nutrition-utils}

**Folder purpose:** Nutrition-specific search helpers (casual menu search).

### `nutrition/utils/casualMenuSearch.js`

Casual restaurant search — users type short queries like: "mcdonalds big mac", "chick fil a sandwich", "chipotle chicken bowl", "dominos large pepperoni slice", "starbucks grande latte" Server-side only: enriches Serper + ranking. The user's typed query is unchanged in UI. UI labels include "McDonald".

## settings {#settings}

**Folder purpose:** App-wide settings screens, support config, and legal pages.

### `settings/supportConfig.js`

Shown in Privacy Policy, Terms, Contact Support, etc. Override with EXPO_PUBLIC_SUPPORT_EMAIL in.env if needed. Support Config Purpose: support Config.

### `settings/supportMailto.js`

Opens the device mail app to coachconnect0@gmail.com (or configured support inbox). When the API cannot send (no Resend/SMTP on server), offer the same content via mailto.

## settings/screens {#settings-screens}

**Folder purpose:** Settings hub and sub-screens (password, FAQ, bug report, privacy, etc.).

### `settings/screens/BugReportScreen.jsx`

Bug Report Screen — the screen the user sees for this part of the settings flow. Renders gradient backgrounds and buttons.

### `settings/screens/ContactSupportScreen.jsx`

Contact Support Screen — the screen the user sees for this part of the settings flow. Renders gradient backgrounds and buttons.

### `settings/screens/ForgotPasswordFlow.js`

Forgot Password Flow — renders gradient backgrounds and buttons. UI labels include "Go back".

### `settings/screens/HelpFAQScreen.jsx`

Help FAQScreen — the screen the user sees for this part of the settings flow. Renders gradient backgrounds and buttons.

### `settings/screens/PrivacyPolicyScreen.jsx`

Privacy Policy Screen — the screen the user sees for this part of the settings flow. Renders gradient backgrounds and buttons.

### `settings/screens/SettingsScreen.js`

Settings UI — dark pink → dark orange gradient (no purple). Reads or writes Firebase Firestore documents; renders gradient backgrounds and buttons.

### `settings/screens/TermsOfServiceScreen.jsx`

Terms Of Service Screen — the screen the user sees for this part of the settings flow. Renders gradient backgrounds and buttons.

## shared-ui {#shared-ui}

**Folder purpose:** Design system: theme, iOS-style tokens, liquid glass, FluidGlass, brand gradients.

### `shared-ui/BlurBackdropPlate.jsx`

Pull padding off the outer shell so blur/backdrop fill edge-to-edge (padding only insets content). Blur Backdrop Plate Purpose: Blur Backdrop Plate.

### `shared-ui/FluidGlass.jsx`

FluidGlass - True Liquid Glass Effect Component for React Native Creates Apple iOS 26-style liquid glass effect using advanced styling Mimics refraction, light scattering, and soft glass tint Optimized for performance with memoization and reduced re-renders. Fluid Glass Purpose: Fluid Glass.

### `shared-ui/FormRow.jsx`

Section label row: uppercase label + thin divider (web ScheduleSessionScreen pattern). Vertical section wrapper with optional bottom spacing.

### `shared-ui/StableGradientText.jsx`

Gradient text via react-native-svg (no MaskedView). Shows a solid fallback immediately, then swaps to SVG gradient once measured — avoids blank/flickering text/icons common with MaskedView in dev builds. Part of `shared-ui` — search the repo for "StableGradientText" to see what imports it before renaming.

### `shared-ui/ThemeContext.js`

React context for light/dark theme — ThemeProvider wraps the app, useTheme() reads colors in screens. Drives text/background colors across Coach Connect without hardcoding hex values in every file.

### `shared-ui/brandGradients.js`

Brand gradient aligned with cg logo (pink → purple → indigo), top → bottom. Brand Gradients Purpose: brand Gradients.

### `shared-ui/homeStatGradients.js`

Gradient color arrays for home stat pills (workout, water, sleep, soreness, etc.). PremiumStatsSection and dashboard cards import these for consistent stat card styling.

### `shared-ui/index.js`

Index in `shared-ui`. Part of `shared-ui` — search the repo for "index" to see what imports it before renaming.

### `shared-ui/theme.js`

Light mode colors (Modern Neutral theme) Dark mode colors (Modern Neutral theme). Part of shared in Coach Connect.

## shared-ui/layout {#shared-ui-layout}

**Folder purpose:** Layout primitives (centered two-column grid).

### `shared-ui/layout/CenteredTwoColumnGrid.jsx`

Simple two-column grid for micronutrient rows and similar compact lists. Centered Two Column Grid Purpose: Centered Two Column Grid.

## shared-ui/liquid {#shared-ui-liquid}

**Folder purpose:** Liquid glass UI kit (backgrounds, cards, buttons, halos).

### `shared-ui/liquid/LiquidBackground.jsx`

Deep obsidian base with 3 mesh-like radial blurs in the corners. Lightweight (single SVG) + works on iOS/Android/Web. Liquid Background Purpose: Liquid Background.

### `shared-ui/liquid/LiquidBackgroundLight.jsx`

Light-mode mesh background: soft paper base with subtle pastel corner blurs. Designed to sit behind frosted-glass materials. Liquid Background Light Purpose: Liquid Background Light.

### `shared-ui/liquid/LiquidGlassCard.jsx`

Custom "glass material": - background blur ~30 - semi-transparent surface - linear border brighter at top, fading to bottom - squircle geometry (continuous curve on iOS). Liquid Glass Card Purpose: UI screen or component: Liquid Glass Card.

### `shared-ui/liquid/LiquidGradientButton.jsx`

Liquid Gradient Button — renders gradient backgrounds and buttons. Part of shared in Coach Connect.

### `shared-ui/liquid/liquidTokens.js`

Liquid Tokens in `shared-ui/liquid`. Part of shared in Coach Connect.

## shared-utils {#shared-utils}

**Folder purpose:** Date keys, height conversion, file type detection, Firestore sanitize, workout day labels.

### `shared-utils/convertHeightUnits.js`

US height input: single field like 5'11" or 5,11 → { feet, inches }. Height Feet Inches Purpose: height Feet Inches.

### `shared-utils/dateKeys.js`

Client-facing "today" (device timezone). Prefer this for dailyLogs / daily_tracking. DateKeys Purpose: Date key utilities for Firestore daily documents. - **getDateKey** — America/New_York (trainer weekly jobs / legacy server defaults).

### `shared-utils/firestoreSanitize.js`

Recursively strip `undefined` values from an object (or array) so it is safe to write to Firestore. @template T @param {T} input @returns {T}. FirestoreSanitize Purpose: Strip undefined values from objects before writing to Firestore.

### `shared-utils/formatFileSize.js`

Formats byte sizes (KB/MB), short dates, and friendly filenames for the files gallery. Also detects auto-generated upload names so the UI can show cleaner labels.

### `shared-utils/formatOnboardingDisplay.js`

Human-readable labels for onboarding tokens stored in Firestore (snake_case ids). Format Onboarding Display Purpose: format Onboarding Display.

### `shared-utils/getFileViewType.js`

Helpers for opening notes & files in-app (images, video, embeds) instead of Safari. Notes File View Purpose: notes File View.

### `shared-utils/getLocalDay.js`

Local-day helpers (device timezone). Used for dashboards that reset at the user's local midnight. Local Day Purpose: local Day.

### `shared-utils/getTrainerProfileMedia.js`

Resolve a usable profile image URL from trainer / user shapes used across the app. Prefers explicit top-level fields, then common nested marketplace/profile objects. Trainer Profile Media Purpose: trainer Profile Media.

### `shared-utils/mergeTrainerClientProfile.js`

Merge trainer CRM roster rows with live users/{uid} profile fields. users doc wins for metrics the client updates (weight, age, height, training prefs). @param {object} crmRow — trainer_clients/{trainerId}/clients/{clientId} @param {object} userData — users/{clientId}.

### `shared-utils/resolveClientProfileFields.js`

Merge client profile / onboarding fields from Firestore, AuthGate userData, and local cache. Map legacy / alternate onboarding keys to what the profile UI expects.

### `shared-utils/workoutDayLabels.js`

Allowed labels for "today's workout" / workout day on the client dashboard. Normalized matching is case-insensitive; extra spaces are collapsed. Workout Day Labels Purpose: workout Day Labels.

## shared/accessibility {#shared-accessibility}

**Folder purpose:** a11y prop helpers for screen readers.

### `shared/accessibility/a11yProps.js`

Shared accessibility props for Coach Connect core flows. Use on Pressable / TouchableOpacity / TextInput so VoiceOver/TalkBack get clear names. A11y Props Purpose: a11y Props.

## shared/api {#shared-api}

**Folder purpose:** Base URL, auth headers, apiFetch, error logging, push notifications, onboarding sync.

### `shared/api/apiFetch.js`

Shared fetch helpers for Coach Connect API calls. Shared authenticated HTTP — prefer over raw fetch.

### `shared/api/baseUrl.js`

Always-on production API (Google Cloud Run) — no local `npm run server` required. Shared authenticated HTTP — prefer over raw fetch.

### `shared/api/chargesApi.js`

Charge the signed-in client and pay the given trainer. @param {{ trainerId: string, amount: number, token: string }} params @returns {Promise<{ success: boolean, charge_id: string, trainer_gets: number }>}. Shared authenticated HTTP — prefer over raw fetch.

### `shared/api/dashboardNotificationApi.js`

Server-backed Firestore notifications (dashboard metric updates). Shared authenticated HTTP — prefer over raw fetch.

### `shared/api/getAuthHeaders.js`

Bearer token headers for Coach Connect API routes (Firebase ID token). Shared authenticated HTTP — prefer over raw fetch.

### `shared/api/logErrorToServer.js`

Centralized logging for CoachConnect. - debug/info: development only - warn: development only (keeps production logs quiet) - error: always emitted; forwarded to Sentry when configured (see monitoring.js). Shared authenticated HTTP — prefer over raw fetch.

### `shared/api/monitorAppHealth.js`

Optional crash reporting — no-op until EXPO_PUBLIC_SENTRY_DSN is set and @sentry/react-native is installed. See docs/MONITORING.md for setup. Shared authenticated HTTP — prefer over raw fetch.

### `shared/api/sendPushNotification.js`

Remote push via Express POST /api/notifications/send (Expo path on server). Uses the same candidate bases as messaging so physical devices reach the API. Shared authenticated HTTP — prefer over raw fetch.

### `shared/api/stripeConnectApi.js`

Normalize backend + legacy Firestore stripe status fields. Hits API routes /api/stripe/create-account, /api/stripe/verify-status; shared authenticated HTTP — prefer over raw fetch.

### `shared/api/syncOnboardingToServer.js`

Queue a pending onboarding completion payload to sync later. Non-blocking; best-effort persistence. Hits API routes /api/onboarding/complete; shared authenticated HTTP — prefer over raw fetch.

### `shared/api/trainerClientApi.js`

Trainer CRM actions via server (Admin SDK writes). Shared authenticated HTTP — prefer over raw fetch.

### `shared/api/verifyTrainerCertification.js`

Extra copy under the status line (ETA / next step). Shared authenticated HTTP — prefer over raw fetch.

## shared/assets {#shared-assets}

**Folder purpose:** Shared Lottie assets and generated onboarding icon registry.

### `shared/assets/Happy SUN.json`

Lottie animation "Happy SUN" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `shared/assets`.

### `shared/assets/Walking steps.json`

Lottie animation "Walking steps" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `shared/assets`.

### `shared/assets/onboardingIconRegistry.generated.js`

Onboarding Icon Registry.generated in `shared/assets`. Part of shared in Coach Connect.

### `shared/assets/onboardingIconRegistry.js`

Maps onboarding option keys (e.g. 'full_gym', 'beginner') to bundled PNG icon require() paths. OnboardingWizardScreen uses getOnboardingIconSource() so icon paths live in one place.

## shared/components {#shared-components}

**Folder purpose:** Reusable components: hero cards, home widgets, modals, notes/files sections.

### `shared/components/FilesNotesHeroCard.jsx`

Hero header for the Files & Notes section with gradient background and add button. Used on both client and trainer dashboards above the file gallery grid.

### `shared/components/MarketplaceHeroCard.jsx`

Hero card on home that promotes finding a trainer — tap opens marketplace search. Shown to clients who are not yet linked to a trainer.

### `shared/components/PremiumSectionHeader.jsx`

Premium uppercase section label — centered gradient type, no accent bar. Brighter pink → orange — matches workout tab header treatment.

## shared/components/brand {#shared-components-brand}

**Folder purpose:** Brand logo component.

### `shared/components/brand/BrandLogo.jsx`

Renders the official Coach Connect logo (src/assets/logo/Logo.PNG). UI labels include "Coach Connect".

## shared/components/home {#shared-components-home}

**Folder purpose:** Home tab shared widgets (aurora banner, daily quote, session card).

### `shared/components/home/AuroraHeroBanner.jsx`

Dark purple → dark orange — Today/time card icon accent. Renders gradient backgrounds and buttons.

### `shared/components/home/DailyQuoteCard.js`

Curated quotes from `dailyQuotesList.json` (nutrition, training, discipline). Daily Quote Card Purpose: UI screen or component: Daily Quote Card.

### `shared/components/home/HeroCardBackGlow.jsx`

Flat glow wash behind hero cards — tinted plate + colored shadow only (no blobs). Same idea as FilesNotesHeroCard cardShadow — orange luminous spill behind the card.

### `shared/components/home/QuickActionCard.jsx`

Dark purple → dark orange (matches Today card & Training Agenda). UI labels include "View all".

### `shared/components/home/SessionMeetingCard.jsx`

Glass-style session card (matches PremiumWelcomeCard / app chrome — no rainbow frame). mode="invite" — Pass + I'm in mode="reminder" — optional View / Log Workout when onPressViewWorkout provided. Session Meeting Card Purpose: UI screen or component: Session Meeting Card.

## shared/components/icons {#shared-components-icons}

**Folder purpose:** Gradient/icon components for nav and profile cards.

### `shared/components/icons/BrandGradientIcon.jsx`

Brand-gradient icons via react-native-svg (no MaskedView). MaskedView + icon fonts/PNGs often vanish or flicker on iOS dev builds. Part of `shared/components/icons` — search the repo for "BrandGradientIcon" to see what imports it before renaming.

### `shared/components/icons/BrandGradientStrokeText.jsx`

Solid fill + purple→orange gradient stroke (SVG). Measures with hidden Text first. Brand Gradient Stroke Text Purpose: Brand Gradient Stroke Text.

### `shared/components/icons/FrequencyCalendarIcon.jsx`

Frequency Calendar Icon in `shared/components/icons`. Part of `shared/components/icons` — search the repo for "FrequencyCalendarIcon" to see what imports it before renaming.

### `shared/components/icons/GradientChatBubblesIcon.jsx`

Gradient Chat Bubbles Icon — SVG gradient (no MaskedView). Part of `shared/components/icons` — search the repo for "GradientChatBubblesIcon" to see what imports it before renaming.

### `shared/components/icons/GradientGeminiNavIcon.jsx`

Google Gemini mark — filled with the brand gradient (original nav icon). Part of `shared/components/icons` — search the repo for "GradientGeminiNavIcon" to see what imports it before renaming.

### `shared/components/icons/MaskedBrandIonicon.jsx`

Original Ionicons + brand gradient via MaskedView (barbell tab only). Kept separate from SVG nav icons — matches the legacy workout tab look. Part of `shared/components/icons` — search the repo for "MaskedBrandIonicon" to see what imports it before renaming.

### `shared/components/icons/ProfileCardIcon.jsx`

Filled PNG icon for workout profile cards — shared by ClientApp and TrainerApp (WorkoutPlanGeneratorScreen) and client ViewMyViewMyProfileScreen rows. Profile Card Icon Purpose: UI screen or component: Profile Card Icon.

### `shared/components/icons/brandGradientSvgPaths.js`

SVG paths for brand-gradient icons (24×24 viewBox). Pure SVG — no MaskedView / icon fonts — so icons stay visible in dev builds. Part of `shared/components/icons` — search the repo for "brandGradientSvgPaths" to see what imports it before renaming.

## shared/components/modals {#shared-components-modals}

**Folder purpose:** Generic modals (error, hold-to-confirm, remove trainer).

### `shared/components/modals/ErrorModal.jsx`

CoachConnect-styled error / alert modal (gradient rim, glass inner, optional retry). Uses Ionicons names (default `alert-circle`). Renders gradient backgrounds and buttons.

### `shared/components/modals/HoldToConfirmModal.jsx`

Destructive confirmation: user must press and hold until the progress bar fills. Release early → bar resets; complete → `onHoldComplete` runs (should throw on failure). Renders gradient backgrounds and buttons.

### `shared/components/modals/RemoveTrainerSheet.js`

Bottom sheet for removing trainer/client relationship. Used from client Settings (Remove Trainer) and trainer ClientDetail (Remove Client). Reads or writes Firebase Firestore documents.

## shared/components/notes-files {#shared-components-notes-files}

**Folder purpose:** Files & notes section: PDF/spreadsheet viewers, gallery grid, add modal.

### `shared/components/notes-files/AddNotesFilesModal.js`

Modal triggered by the bottom nav plus button. Add: Photo, Video, PDF/Doc (+ trainer create/import options). Lets the user pick photos from the camera roll; renders gradient backgrounds and buttons.

### `shared/components/notes-files/DocumentViewerModal.js`

DocumentViewerModal — read-only full-screen modal for trainer text/rich-text documents. Used when a client (or trainer) taps a document in Files. Loads content from Firestore via getTrainerDocument(trainerId, documentId) → users/{trainerId}/documents/{documentId}. Props (from parent screen): visible — show/hide the modal trainerId — owner of the document in Firestore documentId — document id under that trainer title — optional title before fetch completes (titleProp below) trainerName — shown in footer + share message createdAt — shown in footer isDark — reserved for theme (UI is mostly fixed dark today) onClose — called when user taps back or Android hardware back. User dismisses it after completing the action or tapping Cancel.

### `shared/components/notes-files/EmbedWebViewModal.jsx`

Fullscreen embedded viewer (Office Online / Google gview) — keeps user in the app. User dismisses it after completing the action or tapping Cancel.

### `shared/components/notes-files/FileGalleryGrid.jsx`

Shared file gallery UI — gradient-bordered cards in a 2-column grid. Previews: stored thumbnailUrl (upload), Google embedded viewer for PDFs/docs/sheets, expo-av Video for video without thumb. File Gallery Grid Purpose: File Gallery Grid.

### `shared/components/notes-files/FilesNotesSectionPremium.jsx`

Dark orange → dark purple accent gradient. UI labels include "VIDEO".

### `shared/components/notes-files/MediaViewerModal.jsx`

Media Viewer Modal — popup overlay on top of the current screen. Renders gradient backgrounds and buttons.

### `shared/components/notes-files/PdfViewerModal.js`

Pdf Viewer Modal — popup overlay on top of the current screen. Renders gradient backgrounds and buttons.

### `shared/components/notes-files/SpreadsheetViewerModal.js`

SpreadsheetViewerModal — read-only viewer for uploaded.csv /.xlsx files. NOTE: This is NOT SpreadsheetEditorModal (trainer edit UI lives at src/trainer-app/documents/SpreadsheetEditorModal.js). Clients and trainers use this modal to preview file attachments from a download URL. Flow: 1. Parent passes visible + url + filename 2. fetch(url) → parse CSV text OR XLSX binary 3. Render rows in a scrollable table (horizontal + vertical ScrollViews) Props: visible — show/hide modal url — Firebase Storage or HTTPS URL to the file name — filename (used to detect.csv vs.xlsx) isDark — light/dark chrome for header and cells onClose — back button / Android back. User dismisses it after completing the action or tapping Cancel.

## shared/components/onboarding {#shared-components-onboarding}

**Folder purpose:** Onboarding form fields (AI opt-in, trainer subscription step).

### `shared/components/onboarding/AIOptInStep.jsx`

AIOpt In Step — renders Lottie animations in the UI. UI labels include "AI Fitness Coach".

### `shared/components/onboarding/TrainerSubscriptionOnboardingStep.jsx`

FitFlow paywall gradient: orange → pink → magenta. UI labels include "Unlimited clients".

### `shared/components/onboarding/onboardingAiDeps.jsx`

Food-card style icon well — thin gradient accent + soft pill fill. UI labels include "rgba(255,255,255,0.35)".

### `shared/components/onboarding/onboardingThemeTokens.js`

Onboarding color tokens — literal values from premiumFoodCard/theme.js. Kept in a dependency-free module so onboarding screens never crash on import order. Pill background: 135° gradient at low opacity (matches food-card MacroPill).

## shared/components/shell {#shared-components-shell}

**Folder purpose:** App loading screen, boot loading, Coach Connect header, prism flip.

### `shared/components/shell/AppLoadingScreen.js`

AppLoadingScreen — shared full-screen loading for the entire app (client and trainer). Exact IconScout loading-bar motion (recolored preview frames, pink → orange). Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in shared.

### `shared/components/shell/BootLoading.js`

Boot loading lock — one overlay stays mounted for the whole cold start so the loader never remounts between App → AuthGate → ClientApp. Hold the boot overlay while `active` is true.

### `shared/components/shell/CoachConnectHeader.js`

Matches Settings screen pill gradient (dark pink → dark orange). UI labels include "Open profile".

### `shared/components/shell/LoadingPrismFlip.jsx`

IconScout-style loading bar via compact spritesheet + Reanimated (UI thread). No video — no buffer stalls / remount pauses. UI labels include "Loading".

## shared/contexts {#shared-contexts}

**Folder purpose:** React contexts (AI context provider wrapper).

### `shared/contexts/AIContext.js`

Canonical per-user AI toggle — survives AuthGate profile refresh; key avoids clearAllUserData() coachconnect_* wipe. UI labels include "About AI in Coach Connect".

## shared/firestore {#shared-firestore}

**Folder purpose:** Generic Firestore pagination and storage upload helpers.

### `shared/firestore/firestorePagedQuery.js`

Firestore query helpers — indexed query with safe fallback before indexes finish building. UI labels include "query".

### `shared/firestore/storageHelpers.js`

Upload a file to Firebase Storage Get download URL for a file. Not a screen itself; contains reusable pieces like confirm/cancel rows, labels, and styling tokens.

## shared/fitness-calculations {#shared-fitness-calculations}

**Folder purpose:** BMR, TDEE, macro calculations from onboarding inputs.

### `shared/fitness-calculations/calculations.js`

BMR calculation using Mifflin-St Jeor equation. Calculations Purpose: Fitness math utilities — BMR, TDEE, macros, body composition.

## shared/marketplace {#shared-marketplace}

**Folder purpose:** Trainer marketplace profile sync to Firestore.

### `shared/marketplace/trainerMarketplaceSync.js`

Keeps trainers/{uid} (marketplace / Find Trainers) in sync with users/{uid} (profile + onboarding). Clients read trainers/* — not users/* — so profile edits must mirror here. Uses Firestore (`users`).

## shared/notes-files {#shared-notes-files}

**Folder purpose:** CRUD helpers for trainer/client notes and file attachments.

### `shared/notes-files/manageNotesAndFiles.js`

Notes & Files — client and trainer can add notes, photos, videos, PDFs. Single source: users/{clientId}/notes_and_files. Each doc has addedBy: 'client' | 'trainer'. Client view: group by "From you" / "From trainer". Trainer view: group by "From client" / "From you". Uses Firestore (`users`).

### `shared/notes-files/spreadsheetRows.js`

Encodes spreadsheet rows for Firestore — flattens nested arrays because Firestore forbids them. Used when trainers edit shared spreadsheets in DocumentEditorModal.

## shared/payments {#shared-payments}

**Folder purpose:** Stripe Connect / native payment hooks, education copy, payment history.

### `shared/payments/AppStripeProvider.jsx`

Wrap the app in Stripe's provider so CardField / createToken work. Screens import the default export and call methods on it.

### `shared/payments/PaymentEducationSections.jsx`

Reusable payment education UI — how payments work, Venmo comparison, earnings preview. Stripe Connect / client–trainer payment flows.

### `shared/payments/StripeConnectWebViewModal.jsx`

Load Stripe Account Link URL and detect return/refresh deep links. User dismisses it after completing the action or tapping Cancel.

### `shared/payments/paymentEducationCopy.js`

Shared payment clarity copy — trainers get 90%, platform keeps 10%. UI labels include "$450 pending"; Stripe Connect / client–trainer payment flows.

### `shared/payments/paymentSetupPrompt.js`

Payment setup popup eligibility + Firestore dismissal helpers. Uses Firestore (`users`); Stripe Connect / client–trainer payment flows.

### `shared/payments/stripeNativeStatus.js`

Detect whether Stripe native (CardField / useStripe) is usable in this build. UI labels include "Expo Go cannot take card payments"; Stripe Connect / client–trainer payment flows.

### `shared/payments/useClientPaymentHistory.js`

React hook that loads a client payment history from the Firestore payments collection (by clientId), with date/status formatting for list rows. Used on the client payments/history UI when reviewing charges to a linked trainer.

### `shared/payments/useStripeConnectFlow.js`

@param {{ email: string, onActive?: () => void }} options. React hook in `shared/payments` — screens call it instead of inlining fetch/Firestore logic.

### `shared/payments/useTrainerPaymentHistory.js`

React hook that loads a trainer payment history rows from the Firestore payments collection (by trainerId), formatting dates and status labels for the UI. Consumed by trainer PaymentsScreen to show completed/pending/failed payouts and charges.

## shared/photo-gallery {#shared-photo-gallery}

**Folder purpose:** Shared progress photo gallery screen.

### `shared/photo-gallery/MyProgressPhotosScreen.jsx`

Pinch + double-tap zoom. Notifies JS when zoomed so horizontal FlatList can lock scroll. Reads or writes Firebase Firestore documents; lets the user pick photos from the camera roll; renders gradient backgrounds and buttons.

## shared/screens {#shared-screens}

**Folder purpose:** Screens used by both roles (weekly report, workout plans, photo gallery re-exports).

### `shared/screens/BrowseSavedWorkoutsScreen.jsx`

Browse Saved Workouts Screen — full-screen React Native view in `shared/screens`. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in shared.

### `shared/screens/MyProgressPhotosScreen.jsx`

My Progress Photos Screen — full-screen React Native view in `shared/screens`. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in shared.

### `shared/screens/ViewWeekProgressReportScreen.jsx`

View Week Progress Report Screen — full-screen React Native view in `shared/screens`. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in shared.

## shared/services {#shared-services}

**Folder purpose:** User profile fetch, client registry, Firestore listener utilities.

### `shared/services/clientProfileFirestore.js`

Canonical Firestore registry: clients/{uid} — one doc per account with role "client". Mirrors trainers/{uid} for marketplace/discovery. Populated on signup, onboarding, and server sync. Centralizes collection paths and query shapes for this feature.

### `shared/services/fetchUserProfile.js`

User profile fetch — Firestore-first (production project anatrox-auth). Hits API routes /api/me failed (${resp.status}); uses Firestore (`users`).

### `shared/services/firestoreListenerUtils.js`

True when Firestore rejected the request — expected during/after sign-out. Log snapshot errors except expected sign-out permission denials.

## shared/trainer-location {#shared-trainer-location}

**Folder purpose:** Geocoding / location picker service for trainer profiles.

### `shared/trainer-location/trainerLocationService.js`

Trainer city/location helpers — lazy-loads expo-location so app startup does not crash when the native ExpoLocation module is missing from a dev build. Screens import functions from here rather than calling fetch/Firestore directly.

## shared/weekly-report {#shared-weekly-report}

**Folder purpose:** Weekly report screen body, theme, and data builders shared by client/trainer.

### `shared/weekly-report/ViewWeekProgressReportScreen.jsx`

Weekly Report Screen Loads `users/{clientId}/weeklySummaries` from Firestore and renders the premium weekly report UI from mapped client check-in data. Reads or writes Firebase Firestore documents.

### `shared/weekly-report/WeeklyReportScreenBody.jsx`

Weekly report scroll body — poop-main.zip layout + real Firestore data. UI labels include "Avg Sleep".

## shared/weekly-report/components {#shared-weekly-report-components}

**Folder purpose:** Weekly report UI building blocks (day cards, charts, insights).

### `shared/weekly-report/components/CoachingProsConsSection.jsx`

Coaching Pros Cons Section — renders gradient backgrounds and buttons. Part of `shared/weekly-report/components` — search the repo for "CoachingProsConsSection" to see what imports it before renaming.

### `shared/weekly-report/components/DayCard.jsx`

Day Card — renders gradient backgrounds and buttons. UI labels include "WORKOUT".

### `shared/weekly-report/components/GradientBorder.jsx`

Gradient Border — renders gradient backgrounds and buttons. Part of `shared/weekly-report/components` — search the repo for "GradientBorder" to see what imports it before renaming.

### `shared/weekly-report/components/GradientButton.jsx`

Gradient Button — renders gradient backgrounds and buttons. Part of `shared/weekly-report/components` — search the repo for "GradientButton" to see what imports it before renaming.

### `shared/weekly-report/components/InsightItem.jsx`

Insight Item — renders gradient backgrounds and buttons. Part of `shared/weekly-report/components` — search the repo for "InsightItem" to see what imports it before renaming.

### `shared/weekly-report/components/ReportMetricIcon.jsx`

Extra metric visuals for nutrition macros (app PNG assets). Gradient ring + custom PNG — same treatment as home / premium report.

### `shared/weekly-report/components/SettingsSheet.jsx`

Settings Sheet — bottom sheet that slides up for a quick decision or form. Does not replace full navigation — closes when done.

### `shared/weekly-report/components/StatCard.jsx`

Stat Card — renders gradient backgrounds and buttons. Part of `shared/weekly-report/components` — search the repo for "StatCard" to see what imports it before renaming.

### `shared/weekly-report/components/WeekSelectorHeader.jsx`

Week Selector Header in `shared/weekly-report/components`. UI labels include "Go back".

### `shared/weekly-report/components/WeekTrainerInsights.jsx`

Week Trainer Insights — renders gradient backgrounds and buttons. Part of `shared/weekly-report/components` — search the repo for "WeekTrainerInsights" to see what imports it before renaming.

### `shared/weekly-report/components/WeeklyChart.jsx`

@param {object} props @param {object[]} props.days @param {string} props.metricKey — day field to plot (e.g. sleepHours, steps, calories) @param {string} props.title — chart header title @param {string} props.legend — legend label @param {string} props.valueSuffix — tooltip suffix (h, cal, etc.) @param {number} [props.maxValue] — Y-axis max; auto if omitted. UI labels include "This week".

### `shared/weekly-report/components/WeeklyReportEmptyState.jsx`

Weekly Report Empty State — renders gradient backgrounds and buttons. Part of `shared/weekly-report/components` — search the repo for "WeeklyReportEmptyState" to see what imports it before renaming.

## shared/weekly-report/data {#shared-weekly-report-data}

**Folder purpose:** Fetch/map week nutrition, daily logs, and coaching insights for the report.

### `shared/weekly-report/data/buildTrainerWeekInsights.js`

Build Trainer Week Insights in `shared/weekly-report/data`. UI labels include "${completed} training day${completed === 1 ? ".

### `shared/weekly-report/data/curateCoachingPoints.js`

Drop filler coaching copy; keep the most specific, useful lines only. Part of `shared/weekly-report/data` — search the repo for "curateCoachingPoints" to see what imports it before renaming.

### `shared/weekly-report/data/fetchWeekDailyLogs.js`

Fetch users/{uid}/dailyLogs for each day in a week range. @returns {Promise<Record<string, object>>}. Uses Firestore (`users`).

### `shared/weekly-report/data/fetchWeekNutrition.js`

Fetch nutrition totals keyed by YYYY-MM-DD for a client across a date range. @returns {Promise<Record<string, { calories: number, protein: number, carbs: number, fat: number }>>}. Uses Firestore (`users`).

### `shared/weekly-report/data/mapFirestoreReport.js`

Fallback when structured parser misses inline Workout: chunks. UI labels include "Check-ins".

## shared/weekly-report/theme {#shared-weekly-report-theme}

**Folder purpose:** Weekly report theme tokens and React context.

### `shared/weekly-report/theme/WeeklyReportThemeContext.jsx`

Weekly Report Theme Context — caches data locally on the device between app launches. Part of `shared/weekly-report/theme` — search the repo for "WeeklyReportThemeContext" to see what imports it before renaming.

### `shared/weekly-report/theme/tokens.js`

Design tokens — matches poop-main.zip reference exactly. Part of `shared/weekly-report/theme` — search the repo for "tokens" to see what imports it before renaming.

## shared/workout-plans {#shared-workout-plans}

**Folder purpose:** Browse-saved-workouts screen shared implementation.

### `shared/workout-plans/BrowseSavedWorkoutsScreen.jsx`

Design-system.md — card rims & CTAs (dark pink → dark orange), not cyan/purple rainbow. Reads or writes Firebase Firestore documents; renders gradient backgrounds and buttons.

## shared/workout-profile {#shared-workout-profile}

**Folder purpose:** Workout profile card icons and visibility rules.

### `shared/workout-profile/profileCardIcons.js`

Shared profile-card PNG sizing (ClientApp + TrainerApp workout screens). Profile Card Icons Purpose: UI screen or component: profile Card Icons.

### `shared/workout-profile/shouldShowProfileCard.js`

Profile card visibility — only show cards for onboarding fields the user actually answered. Shared by ClientApp + TrainerApp (WorkoutPlanGeneratorScreen). Profile Card Visibility Purpose: UI screen or component: profile Card Visibility.

## subscription {#subscription}

**Folder purpose:** Trainer Pro subscription gate, IAP/provider wiring, paywall screens, trial banner.

### `subscription/SubscriptionExpiredScreen.jsx`

Subscription Expired Screen — full-screen React Native view in `subscription`. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in subscription.

### `subscription/SubscriptionLegalFooter.jsx`

App Store Guideline 3.1.2 subscription disclosure (title, length, price, auto-renew, legal links). Trainer Pro / IAP subscription gating.

### `subscription/SubscriptionProvider.jsx`

Subscription Provider — singleton service class or module (not React Context) that centralizes subscription operations. Screens import the default export and call methods on it.

### `subscription/SubscriptionProviderIap.jsx`

@param {import('expo-iap').Purchase} purchase. Subscribes to real-time Firestore updates; uses Firestore (`users`).

### `subscription/SubscriptionTrialBanner.jsx`

Subscription Trial Banner — renders gradient backgrounds and buttons. Trainer Pro / IAP subscription gating.

### `subscription/TrainerProSubscriptionOffer.jsx`

Onboarding step-9 style Pro subscription offer (hero image + feature cards + CTA). Trainer Pro / IAP subscription gating.

### `subscription/TrainerSubscriptionGate.jsx`

Gates trainer app when a *prior* subscription has expired. Does NOT block login for trainers with no subscription yet — Pro IAP is offered in onboarding / Settings, not as a hard login wall (legacy accounts and TestFlight trainers otherwise get stuck on payment forever). Trainer Pro / IAP subscription gating.

### `subscription/TrainerSubscriptionPaywallScreen.jsx`

Trainer Subscription Paywall Screen — full-screen React Native view in `subscription`. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in subscription.

### `subscription/constants.js`

Live StoreKit paywall + real IAP in onboarding. Enabled for EAS production/preview builds unless EXPO_PUBLIC_TRAINER_IAP_ENABLED=false. UI labels include "Coach Connect Pro"; Trainer Pro / IAP subscription gating.

### `subscription/subscriptionApi.js`

@param {'verify' | 'restore'} action @param {Record<string, unknown>} body. Trainer Pro / IAP subscription gating.

### `subscription/subscriptionContext.js`

Subscription Context in `subscription`. Trainer Pro / IAP subscription gating.

### `subscription/subscriptionState.js`

Pure helpers for trainer platform subscription access. Firestore shape: users/{uid}.subscription. Trainer Pro / IAP subscription gating.

## trainer-app/calendar-tab {#trainer-app-calendar-tab}

**Folder purpose:** Trainer calendar tab showing upcoming sessions.

### `trainer-app/calendar-tab/TrainerCalendarTab.jsx`

Trainer Sessions tab — calendar home + inline form routing. UI labels include "Calendar".

## trainer-app/client-detail {#trainer-app-client-detail}

**Folder purpose:** Single-client detail / manage-trainee screen.

### `trainer-app/client-detail/ManageTraineeScreen.jsx`

Trainer — single-client detail (sessions + notes/files). Writes a logged food entry to the user daily nutrition log; reads or writes Firebase Firestore documents; renders gradient backgrounds and buttons.

## trainer-app/client-requests {#trainer-app-client-requests}

**Folder purpose:** Pending client connection requests and approval flow.

### `trainer-app/client-requests/NewTraineeRequestsScreen.jsx`

New Trainee Requests Screen — the screen the user sees for this part of the trainer-app flow. Renders gradient backgrounds and buttons.

### `trainer-app/client-requests/loadPendingTraineeRequests.js`

Service to fetch pending client requests for a trainer. Client requests are stored in top-level messages with conversationId, senderId, status: 'pending'. Uses Firestore (`conversations`).

### `trainer-app/client-requests/useTrainerPendingRequests.js`

Hook to fetch and refresh pending client requests for a trainer. Subscribes to the trainer's conversations so the badge/count updates in realtime when a new request comes in or an existing one is accepted/rejected. React hook in `trainer-app/client-requests` — screens call it instead of inlining fetch/Firestore logic.

## trainer-app/clients-list {#trainer-app-clients-list}

**Folder purpose:** Roster of linked clients with Firestore load hook.

### `trainer-app/clients-list/MyTraineesScreen.jsx`

My Trainees Screen — the screen the user sees for this part of the trainer-app flow. Renders gradient backgrounds and buttons.

### `trainer-app/clients-list/loadMyTraineeRoster.js`

Trainer client CRM — Firestore helpers. Implementation lives in `src/app-start/TrainerApp.js` (search: "CLIENT CRM SERVICE"). This file re-exports the same API for hooks/screens that import from here. Uses lazy `require()` so we never create a static cycle: TrainerApp → useTrainerClients → this module → TrainerApp (unfinished), which can surface as `ReferenceError: AppNavigationProvider doesn't exist` and similar. Client CRMService Purpose: Data/service layer: client CRMService.

### `trainer-app/clients-list/useTrainerClients.js`

Trainer client roster — paginated Firestore reads (Load more), no full-collection listeners. React hook in `trainer-app/clients-list` — screens call it instead of inlining fetch/Firestore logic.

## trainer-app/components {#trainer-app-components}

**Folder purpose:** Trainer UI widgets (wheel picker, session calendar pieces).

### `trainer-app/components/WheelPicker.jsx`

Off-center rows dim via opacity only — hue stays pure white/black. Wheel Picker Purpose: Wheel Picker.

## trainer-app/components/sessions {#trainer-app-components-sessions}

**Folder purpose:** Month calendar and session card components.

### `trainer-app/components/sessions/MonthCalendar.jsx`

Month Calendar in `trainer-app/components/sessions`. Part of components in Coach Connect.

### `trainer-app/components/sessions/SessionCard.jsx`

Premium session row for trainer calendar / list views. `showDate` — include date chip (useful in upcoming list across multiple days). UI labels include "Confirmed".

## trainer-app/crm {#trainer-app-crm}

**Folder purpose:** Firestore paths, client name formatting, linked-client resolution, CRM errors.

### `trainer-app/crm/getTraineeDisplayName.js`

Trainer roster: CRM `trainer_clients/.../clients` rows often store placeholder `name: "Client"` while the real label lives on `users/{uid}` (and may use many field shapes across signup, onboarding, OAuth, and profile edits). Uses Firestore (`trainer_clients/.../clients`); trainer–client linking in Firestore CRM collections.

### `trainer-app/crm/loadMyLinkedTrainees.js`

@param {string} trainerUid @param {object[]} rawRows @returns {Promise<object[]>}. Uses Firestore (`users`); trainer–client linking in Firestore CRM collections.

### `trainer-app/crm/trainerClientFirestorePaths.js`

Canonical trainer ↔ client Firestore paths. Reads: trainer_clients/{trainerId}/clients/{clientId} first, legacy clients/{clientId} fallback. Writes: canonical path only (legacy mirror only where explicitly documented in CRM create). Uses Firestore (`clients`); trainer–client linking in Firestore CRM collections.

### `trainer-app/crm/trainerFirestoreErrors.js`

Benign Firestore listener errors (offline / permission flicker) — ignore in trainer client listeners. Trainer–client linking in Firestore CRM collections.

## trainer-app/dashboard {#trainer-app-dashboard}

**Folder purpose:** Trainer home dashboard content and marketplace modal.

### `trainer-app/dashboard/TrainerDashboardContent.jsx`

Trainer home dashboard (client roster + tabs). Reads or writes Firebase Firestore documents; renders gradient backgrounds and buttons; uses Firestore (`users/{id}/weeklySummaries`).

### `trainer-app/dashboard/TrainerMarketplaceModal.js`

Notify the client that their request was accepted. Best-effort — never blocks the accept flow. Reads or writes Firebase Firestore documents; renders gradient backgrounds and buttons.

### `trainer-app/dashboard/trainerDashboardUi.jsx`

Roster / cards: show feet/inches; treat plain numbers as total inches (legacy onboarding). Renders gradient backgrounds and buttons; UI labels include "Client workspace".

## trainer-app/documents {#trainer-app-documents}

**Folder purpose:** Rich document/spreadsheet editor modals for trainer notes and files.

### `trainer-app/documents/DocumentEditorModal.js`

Trainer document editor — create or edit a document. Save to users/{trainerId}/documents. Reads or writes Firebase Firestore documents.

### `trainer-app/documents/EditorHeaderActions.jsx`

Shown in UI only — never saved as the file title. UI labels include "Untitled document".

### `trainer-app/documents/EditorStatusPill.js`

Editor Status Pill in `trainer-app/documents`. UI labels include "Draft".

### `trainer-app/documents/ShareDocumentModal.js`

Share trainer document with clients. Toggles per client; saves sharedWith to Firestore. User dismisses it after completing the action or tapping Cancel.

### `trainer-app/documents/SpreadsheetEditorModal.js`

Spreadsheet Editor Modal — sheet-genius engine + Coach Connect Firestore shell. Reads or writes Firebase Firestore documents; renders gradient backgrounds and buttons.

### `trainer-app/documents/docFlowExporters.js`

Doc Flow Exporters in `trainer-app/documents`. Part of `trainer-app/documents` — search the repo for "docFlowExporters" to see what imports it before renaming.

### `trainer-app/documents/editorGradients.jsx`

Neutral editor accent — no cyan/orange gradients. @deprecated Use theme.accentBorder — kept for callers that still read [0].

### `trainer-app/documents/editorTheme.js`

DocFlow brand gradient — rose → purple → amber. Import these constants to keep visual styling consistent across related screens.

### `trainer-app/documents/presets.js`

RN wrapper styles for the paper container. UI labels include "Default".

### `trainer-app/documents/readability.js`

Readability in `trainer-app/documents`. Part of `trainer-app/documents` — search the repo for "readability" to see what imports it before renaming.

### `trainer-app/documents/smartPaste.js`

Smart Paste in `trainer-app/documents`. Part of `trainer-app/documents` — search the repo for "smartPaste" to see what imports it before renaming.

### `trainer-app/documents/useDocFlowEditor.js`

Inject helpers for features not in TenTapStarterKit. React hook in `trainer-app/documents` — screens call it instead of inlining fetch/Firestore logic.

## trainer-app/documents/spreadsheet {#trainer-app-documents-spreadsheet}

**Folder purpose:** Spreadsheet grid, formulas, format helpers for DocFlow editors.

### `trainer-app/documents/spreadsheet/BottomSheetMenu.jsx`

Bottom Sheet Menu in `trainer-app/documents/spreadsheet`. Part of `trainer-app/documents/spreadsheet` — search the repo for "BottomSheetMenu" to see what imports it before renaming.

### `trainer-app/documents/spreadsheet/SpreadsheetFormulaBar.jsx`

Formula bar — controlled by parent so it stays in sync with the active cell editor. UI labels include "Type a value or =formula".

### `trainer-app/documents/spreadsheet/SpreadsheetGrid.jsx`

Spreadsheet Grid — renders gradient backgrounds and buttons. Part of `trainer-app/documents/spreadsheet` — search the repo for "SpreadsheetGrid" to see what imports it before renaming.

### `trainer-app/documents/spreadsheet/SpreadsheetGridRow.jsx`

Spreadsheet Grid Row — renders gradient backgrounds and buttons. Part of `trainer-app/documents/spreadsheet` — search the repo for "SpreadsheetGridRow" to see what imports it before renaming.

### `trainer-app/documents/spreadsheet/buildDisplayCache.js`

Precompute display strings only for populated cells (avoids 5200 formula evals per frame). Part of `trainer-app/documents/spreadsheet` — search the repo for "buildDisplayCache" to see what imports it before renaming.

### `trainer-app/documents/spreadsheet/format.js`

Format in `trainer-app/documents/spreadsheet`. Part of `trainer-app/documents/spreadsheet` — search the repo for "format" to see what imports it before renaming.

### `trainer-app/documents/spreadsheet/formula.js`

Formula in `trainer-app/documents/spreadsheet`. Part of `trainer-app/documents/spreadsheet` — search the repo for "formula" to see what imports it before renaming.

### `trainer-app/documents/spreadsheet/measureText.js`

Approximate text width for auto-sizing columns (RN has no canvas measureText). Widest content in column c across all cells. @param {{ r: number, c: number, text: string, bold?: boolean } | null} draft - live edit overlay.

### `trainer-app/documents/spreadsheet/sheetAdapter.js`

Load Firestore rows/formats into sheet-genius sheet model. Serialize sheets back to Firestore-compatible payload (sparse — only populated bounds).

### `trainer-app/documents/spreadsheet/types.js`

Types in `trainer-app/documents/spreadsheet`. Part of `trainer-app/documents/spreadsheet` — search the repo for "types" to see what imports it before renaming.

## trainer-app/hooks {#trainer-app-hooks}

**Folder purpose:** Trainer session scheduling hooks and SessionsContext.

### `trainer-app/hooks/SessionsContext.jsx`

Shared trainer sessions state — one Firestore listener for the trainer app tree. Part of `trainer-app/hooks` — search the repo for "SessionsContext" to see what imports it before renaming.

### `trainer-app/hooks/useMyTrainingSessions.js`

UseSessions — Trainer-wide session scheduling (across all clients). Firestore: - `trainer_clients/{trainerUid}/sessions/{sessionId}` Session doc shape: - clientId: string - date: YYYY-MM-DD - time: HH:mm (24h) - durationMin: number - notes?: string - zoomLink?: string - createdAt/updatedAt: server timestamps. React hook in `trainer-app/hooks` — screens call it instead of inlining fetch/Firestore logic.

## trainer-app/navigation {#trainer-app-navigation}

**Folder purpose:** Trainer shell, stack, overlay screens, navigation hook.

### `trainer-app/navigation/TrainerAppShellContext.jsx`

React context for trainer shell navigation: overlay stack, selected client, and back behavior. TrainerMainScreen and trainer overlay screens consume this context.

### `trainer-app/navigation/TrainerMainScreen.jsx`

Trainer Main Screen — the screen the user sees for this part of the trainer-app flow. Renders gradient backgrounds and buttons.

### `trainer-app/navigation/TrainerRootNavigator.jsx`

Trainer Root Navigator — registers or navigates between app screens. Part of trainer in Coach Connect.

### `trainer-app/navigation/trainerOverlayScreens.jsx`

Maps trainer overlay routes to Profile, Settings, FAQ, Legal, Bug Report, and similar stack screens. Same pattern as clientOverlayScreens but for the trainer app shell.

### `trainer-app/navigation/useTrainerScreenNavigation.js`

Trainer hub layout flags + stack navigation for full-screen flows. React hook in `trainer-app/navigation` — screens call it instead of inlining fetch/Firestore logic.

## trainer-app/nutrition-tab {#trainer-app-nutrition-tab}

**Folder purpose:** Trainer view of a client's nutrition tab.

### `trainer-app/nutrition-tab/TrainerNutritionTab.jsx`

Trainer dashboard — Nutrition tab. UI labels include "No nutrition logged yet".

## trainer-app/payments {#trainer-app-payments}

**Folder purpose:** Payments/billing screen for trainers (Stripe payouts & history).

### `trainer-app/payments/PaymentsScreen.jsx`

Stored rates are cents (>= 100 for $1+). Tiny legacy dollar values still supported. Reads or writes Firebase Firestore documents; renders gradient backgrounds and buttons; uses canonical trainer CRM Firestore collection paths.

## trainer-app/progress-tab {#trainer-app-progress-tab}

**Folder purpose:** Trainer view of client progress metrics and weight resolution.

### `trainer-app/progress-tab/ProgressHeroMetricCard.jsx`

Progress Hero Metric Card — renders gradient backgrounds and buttons. Part of `trainer-app/progress-tab` — search the repo for "ProgressHeroMetricCard" to see what imports it before renaming.

### `trainer-app/progress-tab/TrainerProgressTab.jsx`

Trainer dashboard — Progress tab. Renders gradient backgrounds and buttons; UI labels include "Weight".

### `trainer-app/progress-tab/resolveTrainerProgressWeight.js`

Resolve trainer Progress tab weight display per client. Priority: today's log → most recent log → live profile weight from users/{id}. Current weight shown on the hero card.

## trainer-app/screens {#trainer-app-screens}

**Folder purpose:** Misc trainer full screens (scheduling wrappers).

### `trainer-app/screens/ScheduleTrainingSessionScreen.jsx`

Schedule Training Session — inline tab form, wheel pickers, theme-responsive. Registers or navigates between app screens; renders gradient backgrounds and buttons.

## trainer-app/screens/components {#trainer-app-screens-components}

**Folder purpose:** Picker widgets used by trainer scheduling screens.

### `trainer-app/screens/components/SessionWheelPicker.jsx`

Session Wheel Picker in `trainer-app/screens/components`. Part of `trainer-app/screens/components` — search the repo for "SessionWheelPicker" to see what imports it before renaming.

## trainer-app/sessions {#trainer-app-sessions}

**Folder purpose:** Book/schedule training sessions and session push notifications.

### `trainer-app/sessions/BookTraineeSessionScreen.jsx`

Book Trainee Session Screen — the screen the user sees for this part of the trainer-app flow. Renders gradient backgrounds and buttons.

### `trainer-app/sessions/ScheduleTrainingSessionScreen.jsx`

@deprecated Import from `../screens/ScheduleTrainingSessionScreen` instead. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in trainer-app.

### `trainer-app/sessions/pushSessionNotification.js`

Send a session-scheduled push to the client from the trainer app. Does not require the Node server or Cloud Functions (reads client pushToken from users/{clientId}). Uses Firestore (`users`).

### `trainer-app/sessions/sessionSchedulingTheme.js`

Shared colors for trainer session scheduling (calendar + form). Import these constants to keep visual styling consistent across related screens.

## trainer-app/weekly-report {#trainer-app-weekly-report}

**Folder purpose:** Trainer weekly report cards/sections for a selected client.

### `trainer-app/weekly-report/TrainerWeeklyReportSection.jsx`

Trainer dashboard: hero card under client chips → opens full weekly report for selected client. Uses Firestore (`users`).

### `trainer-app/weekly-report/WeeklyReportHeroCard.jsx`

Dark purple → dark orange (matches Today card & Quick Actions). UI labels include "Weekly report".

### `trainer-app/weekly-report/WeeklyReportPremium.jsx`

Progress bar fill colors — first stop of each metric gradient. UI labels include "rgba(255,255,255,0.45)".

## trainer-app/workout-plans {#trainer-app-workout-plans}

**Folder purpose:** Trainer manual workout plan builder screens and services.

### `trainer-app/workout-plans/ManualWorkoutPlanBuilderScreen.jsx`

Manual Workout Plan Builder Screen — the screen the user sees for this part of the trainer-app flow. Renders gradient backgrounds and buttons.

### `trainer-app/workout-plans/manualExerciseLibrarySeed.js`

Offline exercise library for the manual workout plan builder (search + autocomplete). IDs are stable strings for Firestore references; trainers may still save custom names. Manual Exercise Library Seed Purpose: manual Exercise Library Seed.

### `trainer-app/workout-plans/manualWorkoutPlanService.js`

Maps manual builder state → WorkoutPlanGeneratorScreen `structuredPlan.workoutPlan` rows. Screens import functions from here rather than calling fetch/Firestore directly.

## utils {#utils}

**Folder purpose:** App-wide utilities: error logging, cache cleanup, logout cleanup, xlsx platform shims.

### `utils/autoLogError.js`

Lightweight error logger used across the app. Forwards to monitoring (Sentry when configured). Auto Log Error Purpose: auto Log Error.

### `utils/clearDataOnLogout.js`

Shared keys cleared on account switch (not other users' uid-scoped data). Data Cache Cleanup Purpose: data Cache Cleanup.

### `utils/dataCacheCleanup.js`

Old cache-clearing helper — deprecated in favor of clearDataOnLogout.js. Do not use in new code; call clearDataOnLogout on sign-out instead.

### `utils/devLog.js`

Dev Log in `utils`. Part of `utils` — search the repo for "devLog" to see what imports it before renaming.

### `utils/logError.js`

Client-side error logger — captures JS errors and optionally forwards them to the server. Wraps console.error and integrates with autoLogError for crash reporting.

### `utils/syncErrorsToServer.js`

Queue an error in AsyncStorage (React Native) This is called automatically by autoLogErrorSync. Queue an error in AsyncStorage (React Native) This is called automatically by autoLogErrorSync.

### `utils/xlsx.js`

Keep it safe for native bundling.. Part of utils in Coach Connect.

### `utils/xlsx.native.js`

Xlsx.native in `utils`. Part of utils in Coach Connect.

### `utils/xlsx.web.js`

Xlsx.web in `utils`. Part of utils in Coach Connect.

## workouts/active-workout {#workouts-active-workout}

**Folder purpose:** In-gym active workout screen, set logging, workout service, creative plan names.

### `workouts/active-workout/ActiveWorkoutScreen.js`

Active workout flow lives in workout.js (WorkoutPlanGeneratorScreen). Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in workouts.

### `workouts/active-workout/EditModalForm_RN.jsx`

UI-only “nice” edit modal for Workout Plan builder fields. Uses the existing field editor (`WorkoutPlanBuilderFieldEditBody`) so functionality stays identical. Edit Modal Form RN Purpose: UI screen or component: Edit Modal Form RN.

### `workouts/active-workout/WorkoutProfilePillGrid.jsx`

Workout Profile Pill Grid — renders gradient backgrounds and buttons. UI labels include "Personal Info".

### `workouts/active-workout/buildCreativeWorkoutPlanName.js`

Creative display names for saved AI workout plans (library cards). Avoids bland "AI Plan – Jul 6, 2026" defaults. @param {object} [planData] - generated plan payload ({ structuredPlan, goal,... }) @param {string} [fallbackSeed] @returns {string}.

### `workouts/active-workout/workout.js`

Workout Plan Generator Screen Review onboarding data, allow edits, and generate personalized workout plan using DeepSeek API. Renders Lottie animations in the UI; renders gradient backgrounds and buttons; uses Firestore (`users`).

### `workouts/active-workout/workoutService.js`

Single doc path for current workout plan: users/{uid}/workoutPlan. Screens import functions from here rather than calling fetch/Firestore directly.

## workouts/components {#workouts-components}

**Folder purpose:** Exercise row and section UI used in plans and active workout.

### `workouts/components/ExerciseRow.jsx`

ExerciseRow Component Displays a single exercise with inline editing for sets, reps, rest, and notes. This is a UI-only component for cleaner organization. UI labels include "seconds".

### `workouts/components/ExerciseSection.js`

Exercise Section — renders gradient backgrounds and buttons. Part of workouts in Coach Connect.

## workouts/exercise-library {#workouts-exercise-library}

**Folder purpose:** YouTube exercise library tab, video player, dislike picker.

### `workouts/exercise-library/ExerciseCard.js`

Exercise Card — renders gradient backgrounds and buttons. Part of workouts in Coach Connect.

### `workouts/exercise-library/ExerciseDislikePicker.jsx`

Multi-select exercise preference picker with lottery-cage style drifting pill animation. UI labels include "Search exercises...".

### `workouts/exercise-library/ShortsCard.js`

Shorts Card — renders gradient backgrounds and buttons. Part of workouts in Coach Connect.

### `workouts/exercise-library/VideoPlayerModal.jsx`

YouTube IFrame API player (replaces raw WebView embed URLs — helps avoid Error 153). Keep width ≥ ~320 and height ≥ ~220 so controls fit per YouTube embed guidelines. User dismisses it after completing the action or tapping Cancel.

### `workouts/exercise-library/WorkoutExerciseLibraryTab.jsx`

Aurora rim — hot pink → dark orange (matches home hero + user prefs). Renders gradient backgrounds and buttons; caches data locally on the device between app launches; uses Firestore (`users`).

### `workouts/exercise-library/clientWorkoutPlansLibrary.js`

Loads all workout plans visible in the AI Workout Library for a client (subcollection, current doc, legacy global + savedWorkoutPlans). Uses Firestore (`users`).

### `workouts/exercise-library/exerciseDislikeCatalog.js`

Curated exercise catalog for onboarding "exercises you dislike" multi-select. IDs align with MANUAL_EXERCISE_LIBRARY where possible; extras cover cardio, machines, etc. UI labels include "Chest & Push".

### `workouts/exercise-library/exerciseDislikeHelpers.js`

Selected catalog IDs + optional custom names → stored profile string. Not a screen itself; contains reusable pieces like confirm/cancel rows, labels, and styling tokens.

### `workouts/exercise-library/useYouTubeAPI.js`

Bust in-memory cache when search/filter logic changes. React hook in `workouts/exercise-library` — screens call it instead of inlining fetch/Firestore logic.

## workouts/plan-builder {#workouts-plan-builder}

**Folder purpose:** Manual plan builder field edit forms.

### `workouts/plan-builder/workoutPlanBuilderFieldEditBody.js`

Inline edit bodies for workout plan builder rows — logic copied from WorkoutPlanGeneratorScreen. UI labels include "Beginner".

## workouts/plan-generator {#workouts-plan-generator}

**Folder purpose:** AI workout plan generation: onboarding form, API request, parsing, usage tracking.

### `workouts/plan-generator/requestWorkoutPlan.js`

Calls the server to generate an AI workout plan from onboarding answers and Claude/DeepSeek. Also loads saved onboarding artifacts and plan history from AsyncStorage/Firestore.

### `workouts/plan-generator/trackWorkoutGenerationUsage.js`

Keep in sync with server/lib/workoutGenerationLimit.js. Uses Firestore (`users`).

### `workouts/plan-generator/useWorkoutGeneration.js`

Workout plan generation state + API orchestration. React hook in `workouts/plan-generator` — screens call it instead of inlining fetch/Firestore logic.

### `workouts/plan-generator/workoutOnboardingFormConfig.js`

Field labels, icons, and display config for the workout plan generator onboarding form. Drives the profile pill grid on GenerateMyWorkoutPlanScreen.

### `workouts/plan-generator/workoutOnboardingPayload.js`

Fields used by server/lib/workoutPlanPrompt.js — keep payload small and JSON-safe. Strip Firestore types / extra user-doc fields before POSTing to /api/workout/generate.

### `workouts/plan-generator/workoutPlanGenerationSession.js`

Tracks AI workout plan generation across tab switches / screen unmounts. Generation continues in JS; UI re-subscribes via AsyncStorage + listeners. @param {{ userAwayFromWorkout?: boolean }} opts.

### `workouts/plan-generator/workoutPlanParsing.js`

Workout plan parsing helpers for plan viewer screens. UI labels include "Profile".

## workouts/plan-viewer {#workouts-plan-viewer}

**Folder purpose:** Rendered workout plan result, PDF viewer modal and export service.

### `workouts/plan-viewer/WorkoutPlanPdfViewerModal.js`

In-app PDF viewer for generated workout plan. Shows PDF (from local uri or remote url), bottom bar: Save to Files, Share, Send to Trainer. User dismisses it after completing the action or tapping Cancel.

### `workouts/plan-viewer/WorkoutPlanResult.jsx`

Workout Plan Result — renders gradient backgrounds and buttons. UI labels include "Weekly Plan".

### `workouts/plan-viewer/workoutPlanPdfService.js`

Workout plan PDF: parse plan text, generate PDF (expo-print), save to Storage + Firestore. Only used AFTER the plan is generated; does not change AI or prompts. Screens import functions from here rather than calling fetch/Firestore directly.

### `workouts/plan-viewer/workoutPlanUiComponents.jsx`

Shared JSX pieces for rendering a generated workout plan (day headers, exercise blocks, rest notes). Used by WorkoutPlanResult and the PDF export pipeline.

## workouts/screens {#workouts-screens}

**Folder purpose:** Workout plan generator onboarding UI screen.

### `workouts/screens/GenerateMyWorkoutPlanScreen.jsx`

UI wrapper for workout plan generation. Rendering of plans is intentionally NOT handled here. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in workouts.

---

*End of catalog — 629 files. Regenerate with `node scripts/generateSrcFileCatalog.mjs`.*
