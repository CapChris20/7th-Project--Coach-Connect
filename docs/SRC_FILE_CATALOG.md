# Coach Connect — Complete `src/` File Catalog

**613 files** (510 JS/JSX modules) — generated 2026-09-23.

Regenerate: `node scripts/generateSrcFileCatalog.mjs`

Copies: `src/SRC_FILE_CATALOG.md` and `docs/SRC_FILE_CATALOG.md`

---

## Brief for Claude (or any rename helper)

**Product:** Coach Connect — fitness app for trainees and trainers (React Native / Expo).

**Owner goal:** Make the codebase readable to a **non-technical recruiter**. Folder and file names should sound like everyday product language, not developer jargon.

**What this catalog is for:** Each entry explains **what the file actually does** in plain English. Use that to propose better names and which subfolders to delete/flatten. **Do not invent renames from the old filename alone.**

**Constraints when proposing renames later:**

- Keep the main top-level folders (`ai-coach`, `client-app`, `trainer-app`, `for-both`, `nutrition`, etc.).
- Prefer fewer subfolders; kill jargon folders (`persistence`, `logic`, `chat-api`, `voice` if unused, fake `screens/` stubs).
- Prefer short everyday names over long technical ones.
- **Never** change Firebase production project id `anatrox-auth` or live `EXPO_PUBLIC_FIREBASE_*` / `.env` project identity.
- Leave `Suggested name:` blank in this catalog — fill names in a separate rename plan Chris approves.

**Flags you will see:**

- `STUB` — fake file that only re-exports another file (safe delete after retargeting imports).
- `DEAD` — likely unused product area (e.g. voice/speech).
- `JARGON FOLDER` — parent folder name is confusing to non-tech readers.

---

## Architecture map (how `src/` is organized)

| Top-level folder | What it is (plain English) |
|---|---|
| `app-start/` | App launch — login gate, then open trainee app or trainer app |
| `auth/` | Login, signup, onboarding, password reset |
| `client-app/` | Everything only trainees see |
| `trainer-app/` | Everything only trainers see |
| `ai-coach/` | In-app AI Coach (home + conversation + confirm popups) |
| `nutrition/` | Food search, barcode, daily food log |
| `workouts/` | Active workout, exercise videos, AI workout plans |
| `messaging/` | Texting between trainee and trainer |
| `metrics/` | Daily steps/sleep/water/weight + home quotes |
| `notifications/` | Push notification wording and unread counts |
| `subscription/` | Trainer Pro paywall / trial |
| `settings/` | Settings, FAQ, privacy, bug report |
| `for-both/` | Shared by both roles (payments, notes, weekly report, server calls) |
| `logout-cleanup/` | Clear local data on logout |
| `error-logging/` | Capture and send error reports |
| `safety/` | Block / report |
| `spreadsheet-files/` | Spreadsheet library for phone vs web |
| `theme/` | Colors, dark mode, glass look |
| `helpers/` | Tiny shared helpers (dates, height, file types) |
| `navigation/` | Bottom nav and screen routing helpers |
| `components/` | A few leftover shared payment/onboarding pieces |
| `assets/` | Pictures, icons, animations (not logic) |
| `__tests__/` | Automated tests (developers only) |

---

## Table of contents

- [__tests__](#tests) (1 files)
- [__tests__/components](#tests-components) (1 files)
- [__tests__/fixtures](#tests-fixtures) (1 files)
- [__tests__/integration](#tests-integration) (6 files)
- [__tests__/mocks](#tests-mocks) (1 files)
- [__tests__/unit](#tests-unit) (67 files)
- [ai-coach](#ai-coach) (2 files)
- [ai-coach/coach-actions](#ai-coach-coach-actions) (8 files)
- [ai-coach/coach-knowledge](#ai-coach-coach-knowledge) (3 files)
- [ai-coach/confirm-popups](#ai-coach-confirm-popups) (16 files)
- [ai-coach/conversation](#ai-coach-conversation) (15 files)
- [ai-coach/home-screen](#ai-coach-home-screen) (1 files)
- [ai-coach/internet-lookup](#ai-coach-internet-lookup) (2 files)
- [ai-coach/past-chats](#ai-coach-past-chats) (8 files)
- [ai-coach/reply-display](#ai-coach-reply-display) (9 files)
- [app-start](#app-start) (4 files)
- [assets](#assets) (5 files)
- [assets/animations](#assets-animations) (3 files)
- [assets/animations/app-flows](#assets-animations-app-flows) (16 files)
- [assets/animations/legacy](#assets-animations-legacy) (12 files)
- [assets/icons](#assets-icons) (34 files)
- [assets/icons/New Icons](#assets-icons-New-Icons) (13 files)
- [assets/logo](#assets-logo) (3 files)
- [assets/onboarding-consolidated](#assets-onboarding-consolidated) (15 files)
- [block-and-report](#block-and-report) (7 files)
- [client-app/files-and-notes](#client-app-files-and-notes) (6 files)
- [client-app/find-a-trainer](#client-app-find-a-trainer) (11 files)
- [client-app/home](#client-app-home) (10 files)
- [client-app/meals](#client-app-meals) (1 files)
- [client-app/navigation](#client-app-navigation) (6 files)
- [client-app/profile](#client-app-profile) (1 files)
- [client-app/workout-plans](#client-app-workout-plans) (1 files)
- [crash-reports](#crash-reports) (4 files)
- [daily-stats](#daily-stats) (6 files)
- [for-both](#for-both) (5 files)
- [for-both/app-wide-settings](#for-both-app-wide-settings) (1 files)
- [for-both/assets](#for-both-assets) (2 files)
- [for-both/cloud-database](#for-both-cloud-database) (5 files)
- [for-both/files-and-notes](#for-both-files-and-notes) (2 files)
- [for-both/files-and-notes/viewers](#for-both-files-and-notes-viewers) (8 files)
- [for-both/home-cards](#for-both-home-cards) (8 files)
- [for-both/icons](#for-both-icons) (9 files)
- [for-both/loading-and-header](#for-both-loading-and-header) (5 files)
- [for-both/online-connection](#for-both-online-connection) (10 files)
- [for-both/payments](#for-both-payments) (13 files)
- [for-both/photo-gallery](#for-both-photo-gallery) (1 files)
- [for-both/popups](#for-both-popups) (3 files)
- [for-both/setup-icons](#for-both-setup-icons) (2 files)
- [for-both/setup-steps](#for-both-setup-steps) (4 files)
- [for-both/trainer-listing](#for-both-trainer-listing) (1 files)
- [for-both/weekly-report](#for-both-weekly-report) (21 files)
- [for-both/workout-plans](#for-both-workout-plans) (1 files)
- [helpers](#helpers) (12 files)
- [login-and-signup](#login-and-signup) (13 files)
- [logout-cleanup](#logout-cleanup) (1 files)
- [look-and-feel](#look-and-feel) (14 files)
- [messaging](#messaging) (4 files)
- [navigation](#navigation) (7 files)
- [notifications](#notifications) (4 files)
- [nutrition](#nutrition) (1 files)
- [nutrition/barcode](#nutrition-barcode) (4 files)
- [nutrition/daily-log](#nutrition-daily-log) (6 files)
- [nutrition/food-cards](#nutrition-food-cards) (8 files)
- [nutrition/food-details](#nutrition-food-details) (7 files)
- [nutrition/food-search](#nutrition-food-search) (13 files)
- [nutrition/quick-add](#nutrition-quick-add) (1 files)
- [nutrition/targets](#nutrition-targets) (3 files)
- [settings](#settings) (8 files)
- [spreadsheet-support](#spreadsheet-support) (3 files)
- [trainer-app/documents](#trainer-app-documents) (12 files)
- [trainer-app/documents/spreadsheet-grid](#trainer-app-documents-spreadsheet-grid) (10 files)
- [trainer-app/earnings](#trainer-app-earnings) (1 files)
- [trainer-app/home](#trainer-app-home) (3 files)
- [trainer-app/my-trainees](#trainer-app-my-trainees) (3 files)
- [trainer-app/navigation](#trainer-app-navigation) (5 files)
- [trainer-app/new-requests](#trainer-app-new-requests) (3 files)
- [trainer-app/nutrition-tab](#trainer-app-nutrition-tab) (1 files)
- [trainer-app/progress-tab](#trainer-app-progress-tab) (3 files)
- [trainer-app/scheduling](#trainer-app-scheduling) (11 files)
- [trainer-app/trainee-detail](#trainer-app-trainee-detail) (1 files)
- [trainer-app/trainee-records](#trainer-app-trainee-records) (4 files)
- [trainer-app/weekly-report](#trainer-app-weekly-report) (3 files)
- [trainer-app/workout-plans](#trainer-app-workout-plans) (3 files)
- [trainer-pro-plan](#trainer-pro-plan) (12 files)
- [workouts/create-plan](#workouts-create-plan) (14 files)
- [workouts/exercise-rows](#workouts-exercise-rows) (2 files)
- [workouts/exercise-videos](#workouts-exercise-videos) (9 files)
- [workouts/view-plan](#workouts-view-plan) (4 files)

---

## __tests__

<a id="tests"></a>

**Folder purpose:** Jest test suites for unit, integration, and component tests.

### `ClientPaymentModal.test.js`

- **Path:** `src/__tests__/ClientPaymentModal.test.js`
- **What it is:** Automated Jest tests for PayTrainerPopup. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

## __tests__/components

<a id="tests-components"></a>

**Folder purpose:** React component tests rendered with Testing Library.

### `ToolConfirmationModal.test.js`

- **Path:** `src/__tests__/components/ToolConfirmationModal.test.js`
- **What it is:** Automated Jest tests for ConfirmActionPopup rendering. Catches regressions before deploy — run with `npm test`. Tests include: does not render when no tool is present; renders logSleep popup with hours and action buttons; renders logNutrition popup with food and calories; renders adjustMacroTargets popup with calorie and protein values.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

## __tests__/fixtures

<a id="tests-fixtures"></a>

**Folder purpose:** Shared mock data and fixtures imported by multiple tests.

### `coachToolGuardFixtures.js`

- **Path:** `src/__tests__/fixtures/coachToolGuardFixtures.js`
- **What it is:** Automated Jest tests for coach Tool Guard Fixtures. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

## __tests__/integration

<a id="tests-integration"></a>

**Folder purpose:** Multi-module integration tests that exercise real flows (auth, food log, coach).

### `aiCoachFlow.test.js`

- **Path:** `src/__tests__/integration/aiCoachFlow.test.js`
- **What it is:** Automated Jest tests for ai coach flow integration. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `clientHomeBootstrap.test.js`

- **Path:** `src/__tests__/integration/clientHomeBootstrap.test.js`
- **What it is:** Automated Jest tests for client home bootstrap. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `dashboardSave.test.js`

- **Path:** `src/__tests__/integration/dashboardSave.test.js`
- **What it is:** Automated Jest tests for dashboard save integration; workoutDiary save. Catches regressions before deploy — run with `npm test`. Tests include: saveDashboardWorkoutLog writes canonical dailyLogs payload; persists workout log and notifies linked trainer; Write succeeds locally but push to trainer fails → local save still confirmed, push failure logged.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `foodSearchLog.test.js`

- **Path:** `src/__tests__/integration/foodSearchLog.test.js`
- **What it is:** Automated Jest tests for Food search → results; Food log → cloud database write. Catches regressions before deploy — run with `npm test`. Tests include: returns 3 structured results from a successful server search; uses in-memory cache on the second identical search (server called once); falls back to Open Food Facts when the server is unreachable; returns an empty array (not null) when the server has no matches.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `onboardingComplete.test.js`

- **Path:** `src/__tests__/integration/onboardingComplete.test.js`
- **What it is:** Automated Jest tests for Onboarding complete → trainer link creation. Catches regressions before deploy — run with `npm test`. Tests include: writes all 3 link surfaces when onboarding completes with a trainer code; skips trainer link collections when no trainer code is provided; does not write trainer links when the server call fails; sets onboardingCompleted in cloud database and AsyncStorage on success.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `toolExecutorReal.test.js`

- **Path:** `src/__tests__/integration/toolExecutorReal.test.js`
- **What it is:** Automated Jest tests for logSleep real execution; logWater real execution; logNutrition real execution; deleteLog real execution; adjustMacroTargets real execution; trainer mode blocks all writes. Catches regressions before deploy — run with `npm test`. Tests include: Valid hours → writes to correct cloud database path dashboard_sleep field; Hours as string ; Hours as 0 → writes 0 not null; Hours over 24 → rejected or capped.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

## __tests__/mocks

<a id="tests-mocks"></a>

**Folder purpose:** Module mocks for Expo and third-party dependencies in Jest.

### `expoVirtualEnv.js`

- **Path:** `src/__tests__/mocks/expoVirtualEnv.js`
- **What it is:** Automated Jest tests for expo Virtual Env. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

## __tests__/unit

<a id="tests-unit"></a>

**Folder purpose:** Pure unit tests for helpers, parsers, scoring, and business logic.

### `ALL_FIXES_VERIFICATION.test.js`

- **Path:** `src/__tests__/unit/ALL_FIXES_VERIFICATION.test.js`
- **What it is:** Automated Jest tests for ALL_FIXES_VERIFICATION. Catches regressions before deploy — run with `npm test`. Tests include: registers fix suite ${name}.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `AuthGate.logout.test.js`

- **Path:** `src/__tests__/unit/AuthGate.logout.test.js`
- **What it is:** Automated Jest tests for LoginGate logout cleanup. Catches regressions before deploy — run with `npm test`. Tests include: clears push reportColors and local data on sign-out using previous uid ref; clears data when switching accounts; does not clear on first sign-in.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `ErrorBoundary.test.js`

- **Path:** `src/__tests__/unit/ErrorBoundary.test.js`
- **What it is:** Automated Jest tests for CrashCatcher. Catches regressions before deploy — run with `npm test`. Tests include: getDerivedStateFromError captures the error; componentDidCatch logs without throwing.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `ScheduleTrainingSessionScreen.listeners.test.js`

- **Path:** `src/__tests__/unit/ScheduleTrainingSessionScreen.listeners.test.js`
- **What it is:** Automated Jest tests for ScheduleSessionScreen listener sharing. Catches regressions before deploy — run with `npm test`. Tests include: wraps TrainerAppStart in SessionsProvider; thin session hooks require SharedSessionList.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `TrainerApp.unreadListener.test.js`

- **Path:** `src/__tests__/unit/TrainerApp.unreadListener.test.js`
- **What it is:** Automated Jest tests for TrainerAppStart unread listener contract; TrainerAppStart wiring. Catches regressions before deploy — run with `npm test`. Tests include: subscribes and receives unread count for trainer uid; cleans up listener on unsubscribe; imports unreadAlertCount hook.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `aiCoachCapabilities.test.js`

- **Path:** `src/__tests__/unit/aiCoachCapabilities.test.js`
- **What it is:** Automated Jest tests for offline — delete log, personal data, tool inference; inferDeleteLogParams; wantsDeleteAllFoodLogs; coerceMisroutedDeleteTool; shouldIncludeWeeklyContextInCoachPrompt; mergeCoachToolCalls; inferCoachToolCall; readActionsFromReply; isCoachVisionConfigured; API health; Live API — coach chat & tools; Basic coach reply; Food log query loads personal data; Delete all food today → deleteLog tool; Log sleep → logSleep tool; General question (no weekly nag); Vision — the AI model-VL2 + coach polish; Live API — photo attachment route. Catches regressions before deploy — run with `npm test`. Tests include: delete: ; delete: today omits fixed date; delete: ; delete: pizza keyword.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `aiCoachToolsComplete.test.js`

- **Path:** `src/__tests__/unit/aiCoachToolsComplete.test.js`
- **What it is:** Automated Jest tests for AI Coach tools — complete regression; inference fallback (model forgot tool JSON); model toolCalls JSON path; deleteLog metric routing (no food chip for sleep); incellFormattingional questions must not propose tools; rest day never becomes rateWorkout; readActionsFromReply accepts every registered tool name. Catches regressions before deploy — run with `npm test`. Tests include: registry still lists all 15 tools; coerces nutrition deleteLog → sleep when user asked for sleep; Do it after sleep-delete promise still yields sleep deleteLog; merge fixes model JSON that wrongly used nutrition for sleep.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `appleSubscriptionVerify.test.js`

- **Path:** `src/__tests__/unit/appleSubscriptionVerify.test.js`
- **What it is:** Automated Jest tests for appleSubscriptionVerify. Catches regressions before deploy — run with `npm test`. Tests include: maps trial offer to free_trial status; decodes JWS payload.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `authFlows.test.js`

- **Path:** `src/__tests__/unit/authFlows.test.js`
- **What it is:** Automated Jest tests for Authentication flows; Trainer sign-up payload; Client sign-up payload; Login role routing; Logout / restricted fields; Password reset / new user detection; Role-based onboarding gate; Onboarding smuggling blocked server-side. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `authGate.test.js`

- **Path:** `src/__tests__/unit/authGate.test.js`
- **What it is:** Automated Jest tests for normalizeAppRole; profileNeedsOnboarding; isLikelyNewFirebaseUser. Catches regressions before deploy — run with `npm test`. Tests include: returns false when onboardingCompleted is true; returns true when onboardingCompleted is false; handles empty profile; handles null profile.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `barcodeSerperLookup.test.js`

- **Path:** `src/__tests__/unit/barcodeSerperLookup.test.js`
- **What it is:** Automated Jest tests for barcodeSerperLookup. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `baseUrl.test.js`

- **Path:** `src/__tests__/unit/baseUrl.test.js`
- **What it is:** Automated Jest tests for whereToConnect helpers. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `bookSessionParse.test.js`

- **Path:** `src/__tests__/unit/bookSessionParse.test.js`
- **What it is:** Automated Jest tests for book Session Parse. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `calculations.test.js`

- **Path:** `src/__tests__/unit/calculations.test.js`
- **What it is:** Automated Jest tests for calculateBMR; calculateTDEE; calculateBMI; calculateMacros; estimateBodyFat. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `coachCategoryPrompts.test.js`

- **Path:** `src/__tests__/unit/coachCategoryPrompts.test.js`
- **What it is:** Automated Jest tests for coach category prompts. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `coachFollowUpPrompts.test.js`

- **Path:** `src/__tests__/unit/coachFollowUpPrompts.test.js`
- **What it is:** Automated Jest tests for suggestedQuestionMaker. Catches regressions before deploy — run with `npm test`. Tests include: extracts ## Suggested follow-ups from reply and strips from display; builds follow-ups anchored to nutrition web search thread; references assistant reply bullets instead of vague profile prompts; builds contextual follow-ups for sleep web search.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `coachPersonalDataRouting.test.js`

- **Path:** `src/__tests__/unit/coachPersonalDataRouting.test.js`
- **What it is:** Automated Jest tests for coach personal-data routing. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `coachProgressCycle.test.js`

- **Path:** `src/__tests__/unit/coachProgressCycle.test.js`
- **What it is:** Automated Jest tests for coach progress cycle timeline. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `coachSourcePreview.test.js`

- **Path:** `src/__tests__/unit/coachSourcePreview.test.js`
- **What it is:** Automated Jest tests for coach Source Preview. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `coachToolProposalGuards.test.js`

- **Path:** `src/__tests__/unit/coachToolProposalGuards.test.js`
- **What it is:** Automated Jest tests for incellFormattingional questions reject tool proposals; explicit log requests accept tool proposals; ambiguous statements reject tool proposals; filterValidCoachToolProposals; Client coachToolProposalGuards; Server coachToolProposalGuards. Catches regressions before deploy — run with `npm test`. Tests include: returns only valid proposals from a mixed list; returns an empty array for an empty input; does not throw for null input; does not throw for undefined input.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `coachWebSourceCards.test.js`

- **Path:** `src/__tests__/unit/coachWebSourceCards.test.js`
- **What it is:** Automated Jest tests for SourceLinkCards helpers. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `dailyMetrics.test.js`

- **Path:** `src/__tests__/unit/dailyMetrics.test.js`
- **What it is:** Automated Jest tests for dailyMetricsService. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `dailyMetricsParse.test.js`

- **Path:** `src/__tests__/unit/dailyMetricsParse.test.js`
- **What it is:** Automated Jest tests for parseDailyMetricsFromSnapshots; trackingMirrorFromLogs; buildWorkoutLogHydration; rollover archive payload shape. Catches regressions before deploy — run with `npm test`. Tests include: prefers dailyLogs water over tracking; prefers dailyLogs sleep over tracking; reads soreness from logs; reads energy from logs.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `dataCacheCleanup.test.js`

- **Path:** `src/__tests__/unit/dataCacheCleanup.test.js`
- **What it is:** Automated Jest tests for clearUserSpecificData; onUserSignOut; onUserSwitch; clearAllUserData. Catches regressions before deploy — run with `npm test`. Tests include: Clears all keys containing the uid; Does NOT clear keys for other uids; AsyncStorage error → caught, does not crash app; Missing uid → no keys cleared, no crash.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `dateAndRollover.test.js`

- **Path:** `src/__tests__/unit/dateAndRollover.test.js`
- **What it is:** Automated Jest tests for local day helpers. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `exerciseDislikeHelpers.test.js`

- **Path:** `src/__tests__/unit/exerciseDislikeHelpers.test.js`
- **What it is:** Automated Jest tests for dislikedExercisesText. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `foodNormalize.test.js`

- **Path:** `src/__tests__/unit/foodNormalize.test.js`
- **What it is:** Automated Jest tests for foodNormalize. Catches regressions before deploy — run with `npm test`. Tests include: normalizes FatSecret-style rows; cleans Serper titles when search query provided.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `foodNormalizeBarcode.test.js`

- **Path:** `src/__tests__/unit/foodNormalizeBarcode.test.js`
- **What it is:** Automated Jest tests for foodNormalizeBarcode. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `foodSearchQualityGuards.test.js`

- **Path:** `src/__tests__/unit/foodSearchQualityGuards.test.js`
- **What it is:** Automated Jest tests for knownRestaurantFoods; junk title guards; serving / food conflicts; Serper ranking quality guards; branded restaurant ranking; near-duplicate dedupe; presentation + DB preference; rankSerperFoodResultRows acceptance. Catches regressions before deploy — run with `npm test`. Tests include: returns Crazy Bread for Little Caesars crazy bread; returns Big Mac for McDonalds Big Mac; returns curated Cherry Coke 20oz; flags Crazy Breadmenu Items as junk.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `foodSearchScoring.test.js`

- **Path:** `src/__tests__/unit/foodSearchScoring.test.js`
- **What it is:** Automated Jest tests for normalizeQueryText; significantQueryTokens; itemMatchesQuery; filterFoodSearchRows general behavior; isMenuStyleQuery branded supplements; isMenuStyleQuery; scoreSerperFoodResultRow; extractMacrosFromChunk. Catches regressions before deploy — run with `npm test`. Tests include: lowercases and trims brand queries; collapses extra spaces; strips special characters; returns empty string for empty input without throwing.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `foodSearchShipBlockers.aug2026.test.js`

- **Path:** `src/__tests__/unit/foodSearchShipBlockers.aug2026.test.js`
- **What it is:** Automated Jest tests for SHIP: junk / tracker titles never win the card; SHIP: zero / nonsense macros are rejected; SHIP: serving labels must match the food; SHIP: ranking prefers the actual menu item over noise; SHIP: trusted catalog beats random web junk for known items; SHIP: presentation + dedupe do not resurrect junk; SHIP: consensus mapper never emits junk-only cards; SHIP: serper scorer prefers matching menu cards. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `foodSearchTitle.test.js`

- **Path:** `src/__tests__/unit/foodSearchTitle.test.js`
- **What it is:** Automated Jest tests for sanitizeFoodCardTitle (all sources); applyFoodCardPresentation (every provider). Catches regressions before deploy — run with `npm test`. Tests include: strips legacy source suffixes from cached titles; rejects source-only junk titles and uses the user query; removes dangling em dashes; cleans USDA and packaged food titles with site suffixes.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `formatFoodBrand.test.js`

- **Path:** `src/__tests__/unit/formatFoodBrand.test.js`
- **What it is:** Automated Jest tests for tidyBrandName. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `inferFoodServingLabel.test.js`

- **Path:** `src/__tests__/unit/inferFoodServingLabel.test.js`
- **What it is:** Automated Jest tests for guessServingLabel. Catches regressions before deploy — run with `npm test`. Tests include: flags generic gram labels as weak; infers pizza as slice; infers nugget counts from query; infers bread as piece.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `inferToolCallFromCoachMessage.test.js`

- **Path:** `src/__tests__/unit/inferToolCallFromCoachMessage.test.js`
- **What it is:** Automated Jest tests for inferToolCallFromCoachMessage. Catches regressions before deploy — run with `npm test`. Tests include: does not infer deleteLog from coach prose on incellFormattingional web-search questions; still infers deleteLog when the user explicitly asks to delete food; does not infer logSleep from ambiguous sleep statements; infers logSleep when the user explicitly asks to log sleep.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `markAllMessagesRead.pagination.test.js`

- **Path:** `src/__tests__/unit/markAllMessagesRead.pagination.test.js`
- **What it is:** Automated Jest tests for markConversationMessagesReadPaginated. Catches regressions before deploy — run with `npm test`. Tests include: marks unread messages in batches of READ_PAGE_SIZE.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `marketplaceFilters.test.js`

- **Path:** `src/__tests__/unit/marketplaceFilters.test.js`
- **What it is:** Automated Jest tests for marketplace filter utils. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `mergeTrainerClientProfile.test.js`

- **Path:** `src/__tests__/unit/mergeTrainerClientProfile.test.js`
- **What it is:** Automated Jest tests for combineTraineeProfile. Catches regressions before deploy — run with `npm test`. Tests include: prefers live users/{uid} weight over stale CRM copy; does not copy one client CRM weight to another user profile; falls back to CRM weight when user profile has no weight yet; resolves daysPerWeek from legacy frequency on user doc.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `normalizeFoodDisplayName.test.js`

- **Path:** `src/__tests__/unit/normalizeFoodDisplayName.test.js`
- **What it is:** Automated Jest tests for readableFoodTitle; normalizeFoodRecordForStorage; helpers. Catches regressions before deploy — run with `npm test`. Tests include: title-cases ALL CAPS packaged foods; collapses repeated comma segments; strips site suffixes and uses user query for junk titles; shortens USDA scientific descriptions.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `notesAndFiles.test.js`

- **Path:** `src/__tests__/unit/notesAndFiles.test.js`
- **What it is:** Automated Jest tests for notes file helpers. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `nutritionConsensusSearch.test.js`

- **Path:** `src/__tests__/unit/nutritionConsensusSearch.test.js`
- **What it is:** Automated Jest tests for parseNutritionSearchQuery; mapConsensusToFoodRow; mapNutritionSearchToFoodRows; mergeNutritionSearchWithLegacy. Catches regressions before deploy — run with `npm test`. Tests include: splits Jet\; splits mcnuggets queries; keeps plain grocery queries as foodName only; maps consensus payload into a loggable food row.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `nutritionSearchConsensus.test.js`

- **Path:** `src/__tests__/unit/nutritionSearchConsensus.test.js`
- **What it is:** Automated Jest tests for removeOutliersIqr; buildNutrientConsensus; getFoodNutritionConsensus. Catches regressions before deploy — run with `npm test`. Tests include: removes extreme outliers; returns original values when only two data points; includes nutrient when variance is under 10%; flags verify_manually when variance is 10-20%.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `nutritionSearchInliers.test.js`

- **Path:** `src/__tests__/unit/nutritionSearchInliers.test.js`
- **What it is:** Automated Jest tests for classifyCalorieSources; getFoodNutritionConsensus sourceResults. Catches regressions before deploy — run with `npm test`. Tests include: marks per_100g USDA as wrong_serving_basis; flags calorie outliers when 3+ sources disagree; returns sourceResults and consensus for agreeing sources; buildSourceResultRow includes url and sourceKey.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `nutritionSearchRoute.test.js`

- **Path:** `src/__tests__/unit/nutritionSearchRoute.test.js`
- **What it is:** Automated Jest tests for POST /api/nutrition/search handler. Catches regressions before deploy — run with `npm test`. Tests include: returns source rows without consensus when only one inlier; non-existent food returns 404 when no validated sources; returns 503 when all sources error out; timeout on one site still returns consensus when 3+ sources succeed.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `onboardingCalculations.test.js`

- **Path:** `src/__tests__/unit/onboardingCalculations.test.js`
- **What it is:** Automated Jest tests for calculateBMR; calculateTDEE; calculateMacros; calculateBMI. Catches regressions before deploy — run with `npm test`. Tests include: male 80kg 180cm 30yo → Mifflin-St Jeor result; female 60kg 165cm 25yo → Mifflin-St Jeor result; zero weight input does not return a nonsense positive number; negative height does not return a valid-looking BMR.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `onboardingGate.test.js`

- **Path:** `src/__tests__/unit/onboardingGate.test.js`
- **What it is:** Automated Jest tests for onboarding gate. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `parseCoachToolCalls.test.js`

- **Path:** `src/__tests__/unit/parseCoachToolCalls.test.js`
- **What it is:** Automated Jest tests for readActionsFromReply; stripCoachToolJsonFromReply; normalizeToolParams. Catches regressions before deploy — run with `npm test`. Tests include: parses valid JSON at end of reply; parses fenced JSON inside backticks; returns empty array for plain text with no JSON; returns empty array for malformed JSON without throwing.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `parseDeleteLogRequest.test.js`

- **Path:** `src/__tests__/unit/parseDeleteLogRequest.test.js`
- **What it is:** Automated Jest tests for userWantsDeleteLog; inferDeleteLogParams metric routing; coerceMisroutedDeleteTool. Catches regressions before deploy — run with `npm test`. Tests include: accepts explicit delete-food requests; accepts sleep dashboard deletes; rejects generic coaching prose about removing foods; screenNames sleep removes to logType sleep.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `parseWebSearchReply.test.js`

- **Path:** `src/__tests__/unit/parseWebSearchReply.test.js`
- **What it is:** Automated Jest tests for splitInternetAnswer. Catches regressions before deploy — run with `npm test`. Tests include: parses ## sections without dropping content; preserves full wall-of-text when unstructured; preprocessWebSearchLayout keeps every sentence for unstructured text; stripInlineWebCitations preserves newlines.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `paymentSetupPrompt.test.js`

- **Path:** `src/__tests__/unit/paymentSetupPrompt.test.js`
- **What it is:** Automated Jest tests for shouldShowPayoutSetupReminderPopup. Catches regressions before deploy — run with `npm test`. Tests include: hides when no account timestamps (avoid login spam); shows for recent onboarded trainers without Stripe; hides when stripe account exists or is active; hides when dismissed recently.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `premiumFoodCard.test.js`

- **Path:** `src/__tests__/unit/premiumFoodCard.test.js`
- **What it is:** Automated Jest tests for premiumFoodCard. Catches regressions before deploy — run with `npm test`. Tests include: maps logged food to card shape with calorie-based macro percents; uses low-opacity pill gradient stops; demo food matches mockup macros; embedded palette is transparent for meal sections.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `repo.cleanliness.test.js`

- **Path:** `src/__tests__/unit/repo.cleanliness.test.js`
- **What it is:** Automated Jest tests for repo cleanliness. Catches regressions before deploy — run with `npm test`. Tests include: has no.tmp files in server/lib; gitignore includes cloud database-debug.log.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `resolveClientProfileFields.test.js`

- **Path:** `src/__tests__/unit/resolveClientProfileFields.test.js`
- **What it is:** Automated Jest tests for fillTraineeProfile. Catches regressions before deploy — run with `npm test`. Tests include: fills profile fields from the first source when merged starts empty; prefers later non-empty sources (cloud database over local cache); keeps cached values when cloud database fields are empty; unwraps nested onboardingData and maps aliases.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `resolveCoachToolCalls.test.js`

- **Path:** `src/__tests__/unit/resolveCoachToolCalls.test.js`
- **What it is:** Automated Jest tests for resolveCoachToolCalls (server). Catches regressions before deploy — run with `npm test`. Tests include: returns no tools for incellFormattingional protein web-search questions; returns adjustMacroTargets when user explicitly asks to change targets.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `resolveTrainerProgressWeight.test.js`

- **Path:** `src/__tests__/unit/resolveTrainerProgressWeight.test.js`
- **What it is:** Automated Jest tests for pickWeightToShow. Catches regressions before deploy — run with `npm test`. Tests include: prefers today log, then recent log, then profile weight; shows different profile weights per client when logs are empty; does not reuse another client logged weight when profile differs; resolves baseline from starting weight first.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `saveCoachMessagesFirestore.test.js`

- **Path:** `src/__tests__/unit/saveCoachMessagesFirestore.test.js`
- **What it is:** Automated Jest tests for saveAndLoadChats cloud database payloads. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `servingMath.test.js`

- **Path:** `src/__tests__/unit/servingMath.test.js`
- **What it is:** Automated Jest tests for servingMath. Catches regressions before deploy — run with `npm test`. Tests include: scales macros by serving count; computes total grams from qty × grams-per-serving; parses fractional serving qty.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `shouldUseWebSearch.test.js`

- **Path:** `src/__tests__/unit/shouldUseWebSearch.test.js`
- **What it is:** Automated Jest tests for shouldLookUpOnInternet routing. Catches regressions before deploy — run with `npm test`. Tests include: screenNames pizza-on-cut web questions when user says on the web; does not treat bare calories in a web question as a personal log lookup; still blocks personal log lookups without web intent; blocks dashboard sleep lookups.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `subscriptionState.test.js`

- **Path:** `src/__tests__/unit/subscriptionState.test.js`
- **What it is:** Automated Jest tests for resolveSubscriptionAccess; cellFormattingTrialCountdown. Catches regressions before deploy — run with `npm test`. Tests include: returns no_subscription when missing; grants free_trial while trialEndsAt is in the future; grants active for paid subscription; keeps access for cancelled until expiresAt.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `supportConfig.test.js`

- **Path:** `src/__tests__/unit/supportConfig.test.js`
- **What it is:** Automated Jest tests for supportContact. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `trainerClientDisplayName.test.js`

- **Path:** `src/__tests__/unit/trainerClientDisplayName.test.js`
- **What it is:** Automated Jest tests for trainer client display name resolver. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `trainerCodeValidation.test.js`

- **Path:** `src/__tests__/unit/trainerCodeValidation.test.js`
- **What it is:** Automated Jest tests for normalizeInviteCodeForQuery; validateTrainerCode. Catches regressions before deploy — run with `npm test`. Tests include: cellFormattings a 6-character code as XXX-XXX; rejects too-short and over-long codes; returns valid true and sets trainerId from a working API response; returns valid false when the API reports an invalid code.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `trainerMessaging.test.js`

- **Path:** `src/__tests__/unit/trainerMessaging.test.js`
- **What it is:** Automated Jest tests for filterChatMessages; getOrCreateConversation; sendMessage; markMessagesAsRead; subscribeToMessages. Catches regressions before deploy — run with `npm test`. Tests include: Regular messages returned in result; Pending connection request type messages filtered OUT of thread; Empty array input returns empty array; Null input does not throw.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `validateBarcodeFood.test.js`

- **Path:** `src/__tests__/unit/validateBarcodeFood.test.js`
- **What it is:** Automated Jest tests for rejectBadBarcodeResults. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `workoutDayLabels.test.js`

- **Path:** `src/__tests__/unit/workoutDayLabels.test.js`
- **What it is:** Automated Jest tests for workout Day Labels. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `workoutOnboardingPayload.test.js`

- **Path:** `src/__tests__/unit/workoutOnboardingPayload.test.js`
- **What it is:** Automated Jest tests for buildWorkoutOnboardingPayload. Catches regressions before deploy — run with `npm test`. Tests include: includes normalized daysPerWeek and omits null fields; coerces string daysPerWeek to a number; flattens nested onboardingData before building payload.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

### `workoutPlanParsing.test.js`

- **Path:** `src/__tests__/unit/workoutPlanParsing.test.js`
- **What it is:** Automated Jest tests for makePlanPdf parsing. Catches regressions before deploy — run with `npm test`.
- **Who uses it:** Developers only (automated tests)
- **Suggested name:** ___

## ai-coach

<a id="ai-coach"></a>

**Folder purpose:** Everything for the in-app AI Coach: home page, texting screen, popups to log food/water, and helpers that talk to the coach server.

### `CoachSelfTest.jsx`

- **Path:** `src/ai-coach/CoachSelfTest.jsx`
- **What it is:** Coach Self Test — loads user profile, nutrition, and workout context for the coach prompt. UI labels include "AI Coach Tests".
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `coachColors.js`

- **Path:** `src/ai-coach/coachColors.js`
- **What it is:** AI Coach UI reportColors — aligned with design-system.md (premium dark neon glass). Use only inside src/ai-coach/chat-ui/*. UI labels include "rgba(255,255,255,0.45)".
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

## ai-coach/coach-actions

<a id="ai-coach-coach-actions"></a>

**Folder purpose:** Everything for the in-app AI Coach: home page, texting screen, popups to log food/water, and helpers that talk to the coach server.

### `alertTrainer.js`

- **Path:** `src/ai-coach/coach-actions/alertTrainer.js`
- **What it is:** Client → trainer requests (not normal chat). Subscribes to real-time cloud database updates; uses cloud database (`conversations`).
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `carryOutAction.js`

- **Path:** `src/ai-coach/coach-actions/carryOutAction.js`
- **What it is:** AI Coach tool execution — server-first via /api/ai-coach/execute-tool, with client fallbacks. Uses cloud database (`users`).
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `cleanUpActionDetails.js`

- **Path:** `src/ai-coach/coach-actions/cleanUpActionDetails.js`
- **What it is:** Sanitizes and normalizes parameters on AI coach tool calls before execution (strips junk, fixes types). Runs in the tool pipeline so bad model output does not crash cloud database writes.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `findActionsInReply.js`

- **Path:** `src/ai-coach/coach-actions/findActionsInReply.js`
- **What it is:** Lightweight client-side tool inference when the API didn't attach toolCalls but the coach message implies an action (or embeds JSON). Infer Coach Tool Call Client Purpose: infer Coach Tool Call Client.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `popupOrAutoRun.js`

- **Path:** `src/ai-coach/coach-actions/popupOrAutoRun.js`
- **What it is:** When coach tools should interrupt with a popup vs inline chip vs auto-run. Destructive or affects others — auto-open confirm popup.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `readActionsFromReply.js`

- **Path:** `src/ai-coach/coach-actions/readActionsFromReply.js`
- **What it is:** Parse AI Coach tool JSON from model replies (shared by server + Expo client). Parse Coach Tool Calls Purpose: parse Coach Tool Calls.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `shouldAskFirst.js`

- **Path:** `src/ai-coach/coach-actions/shouldAskFirst.js`
- **What it is:** Whether a tool proposal should be shown for user confirmation given their message intent. Coach Tool Proposal Guards Purpose: coach Tool Proposal Guards.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `spotDeleteRequests.js`

- **Path:** `src/ai-coach/coach-actions/spotDeleteRequests.js`
- **What it is:** Delete-log intent detection + fix model misrouting logNutrition → deleteLog. Coach Delete Log Routing Purpose: Detect delete intent and route food vs dashboard metrics (sleep/water/…).
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

## ai-coach/coach-knowledge

<a id="ai-coach-coach-knowledge"></a>

**Folder purpose:** Everything for the in-app AI Coach: home page, texting screen, popups to log food/water, and helpers that talk to the coach server.

### `decideWhatCoachShouldKnow.js`

- **Path:** `src/ai-coach/coach-knowledge/decideWhatCoachShouldKnow.js`
- **What it is:** Decides whether the AI Coach should load this user's app history (nutrition, workouts, sleep, etc.) into the system prompt. Why: Loading full account context costs cloud database reads and makes the prompt large. We only fetch it when the user's message is clearly about *their* data — not for generic questions like "how much protein should I eat?" Data window: since account creation (up to 2 years), with lifetime averages + last 45 days of meal detail + monthly rollups for older months. Keep patterns in sync with: server/lib/coachPersonalDataRouting.js --- Regex cheat sheet (used in every pattern below) --- /... / → regular expression (pattern matcher for text) \b → "word boundary" — start/end of a word (so "log" won't match "blog") (a|b) → "a OR b" — match either option inside the parentheses '? → the ? before ' makes the apostrophe optional ("arent" vs "aren't").* → any characters (.* = "anything in between" two phrases) \b at end → word must end cleanly (not be part of a longer word). Coach Personal Data Routing Purpose: coach Personal Data Routing.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `loadWeeklyNumbers.js`

- **Path:** `src/ai-coach/coach-knowledge/loadWeeklyNumbers.js`
- **What it is:** Client cloud database reads for 7-day AI context (matches server/lib/coachWeeklyData.js). Uses cloud database (`users`).
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `loadYourWeekForCoach.js`

- **Path:** `src/ai-coach/coach-knowledge/loadYourWeekForCoach.js`
- **What it is:** 7-day coach context for AI Coach UI chips + server payload. Prefer GET /api/weekly-context (same logic as server getWeeklyContext). Falls back to client cloud database reads when offline or API unavailable. Resolves the server API base URL with offline fallback; reads or writes Firebase cloud database documents; uses cloud database (`users`).
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

## ai-coach/confirm-popups

<a id="ai-coach-confirm-popups"></a>

**Folder purpose:** Everything for the in-app AI Coach: home page, texting screen, popups to log food/water, and helpers that talk to the coach server.

### `BookSessionPopup.jsx`

- **Path:** `src/ai-coach/confirm-popups/BookSessionPopup.jsx`
- **What it is:** Book Session Popup in `ai-coach/confirm-popups`. UI labels include "Book session?".
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `ChangeFoodTargetsPopup.jsx`

- **Path:** `src/ai-coach/confirm-popups/ChangeFoodTargetsPopup.jsx`
- **What it is:** Change Food Targets Popup in `ai-coach/confirm-popups`. UI labels include "Update nutrition targets?".
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `ConfirmDeletePopup.jsx`

- **Path:** `src/ai-coach/confirm-popups/ConfirmDeletePopup.jsx`
- **What it is:** Confirm Delete Popup in `ai-coach/confirm-popups`. UI labels include "Type".
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `EditWorkoutPopup.jsx`

- **Path:** `src/ai-coach/confirm-popups/EditWorkoutPopup.jsx`
- **What it is:** Edit Workout Popup in `ai-coach/confirm-popups`. UI labels include "Swap exercise?".
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `LogMealPopup.jsx`

- **Path:** `src/ai-coach/confirm-popups/LogMealPopup.jsx`
- **What it is:** Log Meal Popup in `ai-coach/confirm-popups`. UI labels include "Log this meal?".
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `LogMoodPopup.jsx`

- **Path:** `src/ai-coach/confirm-popups/LogMoodPopup.jsx`
- **What it is:** Log Mood Popup in `ai-coach/confirm-popups`. UI labels include "Log mood on dashboard?".
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `LogSleepPopup.jsx`

- **Path:** `src/ai-coach/confirm-popups/LogSleepPopup.jsx`
- **What it is:** Log Sleep Popup in `ai-coach/confirm-popups`. UI labels include "Log sleep on dashboard?".
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `LogStepsPopup.jsx`

- **Path:** `src/ai-coach/confirm-popups/LogStepsPopup.jsx`
- **What it is:** Log Steps Popup in `ai-coach/confirm-popups`. UI labels include "Log steps on dashboard?".
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `LogWaterPopup.jsx`

- **Path:** `src/ai-coach/confirm-popups/LogWaterPopup.jsx`
- **What it is:** Log Water Popup in `ai-coach/confirm-popups`. UI labels include "Log water intake?".
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `MarkRestDayPopup.jsx`

- **Path:** `src/ai-coach/confirm-popups/MarkRestDayPopup.jsx`
- **What it is:** Mark Rest Day Popup in `ai-coach/confirm-popups`. UI labels include "Log rest day?".
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `MessageTrainerPopup.jsx`

- **Path:** `src/ai-coach/confirm-popups/MessageTrainerPopup.jsx`
- **What it is:** Message Trainer Popup in `ai-coach/confirm-popups`. UI labels include "Alert your trainer?".
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `OpenWorkoutPlanPopup.jsx`

- **Path:** `src/ai-coach/confirm-popups/OpenWorkoutPlanPopup.jsx`
- **What it is:** Open Workout Plan Popup in `ai-coach/confirm-popups`. UI labels include "Open workout plan?".
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `RateEnergyPopup.jsx`

- **Path:** `src/ai-coach/confirm-popups/RateEnergyPopup.jsx`
- **What it is:** Rate Energy Popup in `ai-coach/confirm-popups`. UI labels include "Log energy level?".
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `RateWorkoutPopup.jsx`

- **Path:** `src/ai-coach/confirm-popups/RateWorkoutPopup.jsx`
- **What it is:** Rate Workout Popup in `ai-coach/confirm-popups`. UI labels include "Log workout rating?".
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `UpdateGoalPopup.jsx`

- **Path:** `src/ai-coach/confirm-popups/UpdateGoalPopup.jsx`
- **What it is:** Update Goal Popup in `ai-coach/confirm-popups`. UI labels include "Change goal?".
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `sharedPopupParts.js`

- **Path:** `src/ai-coach/confirm-popups/sharedPopupParts.js`
- **What it is:** Shared building blocks for all coach tool modals: title row, confirm/cancel buttons, detail rows, colors. Not a popup itself — imported by LogWaterIntakeSheet, BookTraineeSessionSheet, etc. so they look consistent.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

## ai-coach/conversation

<a id="ai-coach-conversation"></a>

**Folder purpose:** Everything for the in-app AI Coach: home page, texting screen, popups to log food/water, and helpers that talk to the coach server.

### `CoachConversationScreen.jsx`

- **Path:** `src/ai-coach/conversation/CoachConversationScreen.jsx`
- **What it is:** The screen where you and the AI Coach text back and forth (message bubbles, type box, send, attach photo). Sends what you type to the Coach Connect server, saves the chat, and opens confirm popups when the coach wants to log food, water, sessions, etc.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `ConfirmActionPopup.jsx`

- **Path:** `src/ai-coach/conversation/ConfirmActionPopup.jsx`
- **What it is:** Confirm Action Popup — renders gradient backgrounds and buttons. UI labels include "Dismiss".
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `PasteTextPopup.jsx`

- **Path:** `src/ai-coach/conversation/PasteTextPopup.jsx`
- **What it is:** Dedicated paste surface — avoids stale Simulator clipboard reads. UI labels include "Paste your message…".
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `SourceLinkCards.jsx`

- **Path:** `src/ai-coach/conversation/SourceLinkCards.jsx`
- **What it is:** Renders collapsible citation cards under coach replies that used web search. Each card links to the source URL so users can verify nutrition or fitness claims.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `_voiceStub.js`

- **Path:** `src/ai-coach/conversation/_voiceStub.js`
- **What it is:** Temporary no-op after voice feature removal. Safe to delete once call sites drop speech.. Part of `ai-coach/conversation` — search the repo for "_voiceStub" to see what imports it before renaming.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `choosePhoto.js`

- **Path:** `src/ai-coach/conversation/choosePhoto.js`
- **What it is:** Resize + JPEG compress so we always have base64 for the vision API. Coach Attachment Pickers Purpose: coach Attachment Pickers.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `copyReplyText.js`

- **Path:** `src/ai-coach/conversation/copyReplyText.js`
- **What it is:** Strip [1] [2] inline citation markers — preserve newlines and markdown structure. Strip lightweight markdown so coach replies render as one selectable Text block.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `keyboardBehavior.js`

- **Path:** `src/ai-coach/conversation/keyboardBehavior.js`
- **What it is:** Prevent iOS Passwords / strong-password autofill bar on the coach chat field. Keyboard inset for AI Coach composer — positions input flush above the keyboard. Avoids KeyboardAvoidingView, which double-pads and leaves a floating gap on iOS. Layout contract: - FlatList / ScrollView sits above the composer in normal flow. - Composer sits above the absolute ShellBottomNavAnchor. - Only the composer needs BOTTOM_NAV_BAR_HEIGHT reserve; the list only needs a small breathing gap above the composer (not a second full nav pad).
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `openPhotoMenu.js`

- **Path:** `src/ai-coach/conversation/openPhotoMenu.js`
- **What it is:** Native attach menu — avoids popup + ImagePicker stacking bugs on iOS. Show Coach Attach Menu Purpose: show Coach Attach Menu.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `photoPermissions.js`

- **Path:** `src/ai-coach/conversation/photoPermissions.js`
- **What it is:** Request camera/media library permissions. Image Service Purpose: Data/service layer: image Service.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `preparePhotosToSend.js`

- **Path:** `src/ai-coach/conversation/preparePhotosToSend.js`
- **What it is:** Convert local coach chat attachments into API-safe image payloads (base64 data URLs). Prepare Coach Attachments Purpose: prepare Coach Attachments.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `sendMessageToCoach.js`

- **Path:** `src/ai-coach/conversation/sendMessageToCoach.js`
- **What it is:** Sends what you typed to the Coach Connect server and brings back the coach’s reply (with retries if the network fails). Used by the coach conversation screen — talks to your server, not directly to the AI model.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `sourceLinkPreview.js`

- **Path:** `src/ai-coach/conversation/sourceLinkPreview.js`
- **What it is:** Visual helpers for AI Coach web source cards. Coach Source Preview Purpose: coach Source Preview.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `suggestedQuestions.js`

- **Path:** `src/ai-coach/conversation/suggestedQuestions.js`
- **What it is:** Hourly-rotating AI Coach prompts + capability carousel copy. Pools refresh every hour; daily reshuffle reduces repetition. UI labels include "Log sleep, water, steps, or mood".
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `typingBox.js`

- **Path:** `src/ai-coach/conversation/typingBox.js`
- **What it is:** Typing Box in `ai-coach/conversation`. Part of aiChat in Coach Connect.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

## ai-coach/home-screen

<a id="ai-coach-home-screen"></a>

**Folder purpose:** Everything for the in-app AI Coach: home page, texting screen, popups to log food/water, and helpers that talk to the coach server.

### `CoachHomeScreen.jsx`

- **Path:** `src/ai-coach/home-screen/CoachHomeScreen.jsx`
- **What it is:** Fake pointer that used to open a voice coach screen; now just re-exports the coach home. Safe delete candidate with the voice folder.
- **Who uses it:** Both roles (AI Coach tab)
- **Flags:** `STUB`, `DEAD`
- **Suggested name:** ___

## ai-coach/internet-lookup

<a id="ai-coach-internet-lookup"></a>

**Folder purpose:** Everything for the in-app AI Coach: home page, texting screen, popups to log food/water, and helpers that talk to the coach server.

### `internetLookupRules.js`

- **Path:** `src/ai-coach/internet-lookup/internetLookupRules.js`
- **What it is:** Client-side Perplexity routing heuristics (mirrors server shouldUsePerplexity). Perplexity Service Purpose: Data/service layer: perplexity Service.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `shouldLookUpOnInternet.js`

- **Path:** `src/ai-coach/internet-lookup/shouldLookUpOnInternet.js`
- **What it is:** Decides whether the coach should look something up on the public internet (vs answer from your personal logs). Example: “latest research on creatine” → web search; “what did I eat today?” → personal data.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

## ai-coach/past-chats

<a id="ai-coach-past-chats"></a>

**Folder purpose:** Everything for the in-app AI Coach: home page, texting screen, popups to log food/water, and helpers that talk to the coach server.

### `PastChatsPanel.jsx`

- **Path:** `src/ai-coach/past-chats/PastChatsPanel.jsx`
- **What it is:** Collapsible chat history — docked rail, inline panel, or overlay drawer. UI labels include "Delete conversation".
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `chatHistoryList.js`

- **Path:** `src/ai-coach/past-chats/chatHistoryList.js`
- **What it is:** reusable screen helper that subscribes to the user AI coach chat sessions in cloud database (ordered, limited), formats sidebar titles/dates, groups sessions (today/earlier), and triggers refresh of stale or junk creative titles. Used by StartCoachChatScreen and CoachChatHistorySidebar so the coach home can list and open past threads without inlining cloud database queries.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `chatTitles.js`

- **Path:** `src/ai-coach/past-chats/chatTitles.js`
- **What it is:** Chat title helpers — creative short titles for AI Coach history. UI labels include "Skinny-Fat Fix".
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `fixOldChatTitles.js`

- **Path:** `src/ai-coach/past-chats/fixOldChatTitles.js`
- **What it is:** Retroactively retitle sessions that still have raw/derived message titles. Uses cloud database (`users`).
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `loadOlderChats.js`

- **Path:** `src/ai-coach/past-chats/loadOlderChats.js`
- **What it is:** Fetch next page of conversations (call from Load more). Subscribes to real-time cloud database updates; uses cloud database (`conversations`).
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `makeChatTitle.js`

- **Path:** `src/ai-coach/past-chats/makeChatTitle.js`
- **What it is:** Generate a short creative chat title from the first few messages via the coach API. Fallback when /chat-title is not deployed — uses the main coach route on Cloud Run.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `saveAndLoadChats.js`

- **Path:** `src/ai-coach/past-chats/saveAndLoadChats.js`
- **What it is:** Saves and loads AI Coach chats so past conversations are still there next time you open the app. Used by the coach home and conversation screens.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `savedChatShape.js`

- **Path:** `src/ai-coach/past-chats/savedChatShape.js`
- **What it is:** Chat structure: { id: string (unique ID), title: string (first message or "New Chat"), messages: Array<{ role: 'user'|'assistant', content: string, imageUri?: string, timestamp: number }>, createdAt: number (timestamp), updatedAt: number (timestamp), }. UI labels include "New Chat".
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

## ai-coach/reply-display

<a id="ai-coach-reply-display"></a>

**Folder purpose:** Everything for the in-app AI Coach: home page, texting screen, popups to log food/water, and helpers that talk to the coach server.

### `CoachGlassCard.jsx`

- **Path:** `src/ai-coach/reply-display/CoachGlassCard.jsx`
- **What it is:** Premium glass card — gradient border + dark inner fill (matches dashboard heroes). AICoach Glass Card Purpose: UI screen or component: AICoach Glass Card.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `CoachReplyText.jsx`

- **Path:** `src/ai-coach/reply-display/CoachReplyText.jsx`
- **What it is:** Renders coach text replies with markdown formatting (bold, lists, links) and strips hidden tool-call JSON. Sits in the message bubble so users see clean prose instead of raw model output.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `InternetAnswerReply.jsx`

- **Path:** `src/ai-coach/reply-display/InternetAnswerReply.jsx`
- **What it is:** How a coach answer looks when it came from an internet lookup (clear headings and structured text). Shown inside the conversation bubble instead of plain text for those replies.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `SuggestedQuestionChips.jsx`

- **Path:** `src/ai-coach/reply-display/SuggestedQuestionChips.jsx`
- **What it is:** SuppCo-style follow-up suggestion chips — lavender pills, context from the thread. UI labels include "Suggested follow-up questions".
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `copyableReplyText.js`

- **Path:** `src/ai-coach/reply-display/copyableReplyText.js`
- **What it is:** Copy/paste helpers for coach messages — long-press to copy plain text from a reply. Shared between ChatWithCoachScreen and CoachPasteSheet.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `developerChatLog.js`

- **Path:** `src/ai-coach/reply-display/developerChatLog.js`
- **What it is:** Dev-only AI Coach conversation logs — copy from Metro when reporting issues. Log what the user sent (before requests to the app server).
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `replyTextStyles.js`

- **Path:** `src/ai-coach/reply-display/replyTextStyles.js`
- **What it is:** StyleSheet rules for rendering markdown inside coach bubbles (headings, code, links, citations). Also turns inline [Source Name] tags into tappable citation pills.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `splitInternetAnswer.js`

- **Path:** `src/ai-coach/reply-display/splitInternetAnswer.js`
- **What it is:** Parse web-search replies — preserve full content, extract sections for tests/tools only. Light layout pass — adds ## headers only when missing; never drops content.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

### `suggestedQuestionMaker.js`

- **Path:** `src/ai-coach/reply-display/suggestedQuestionMaker.js`
- **What it is:** Context-aware follow-up chips after coach replies — anchored to the thread, not vague profile prompts. Heuristic follow-ups when the model omits the ## Suggested follow-ups section.
- **Who uses it:** Both roles (AI Coach tab)
- **Suggested name:** ___

## app-start

<a id="app-start"></a>

**Folder purpose:** App launch: decides login vs onboarding vs open the trainee app or trainer app.

### `ClientAppStart.js`

- **Path:** `src/app-start/ClientAppStart.js`
- **What it is:** Root of the trainee experience after login — wires home, messages, workouts, nutrition, and navigation. Opened by AuthGate when the signed-in person is a trainee.
- **Who uses it:** Everyone (login / app start)
- **Suggested name:** ___

### `LoginGate.js`

- **Path:** `src/app-start/LoginGate.js`
- **What it is:** The real front door of the app: watches who is signed in, shows login/onboarding if needed, then opens the trainee app or trainer app. Also clears local data on logout. This is what runs after the app finishes launching.
- **Who uses it:** Everyone (login / app start)
- **Suggested name:** ___

### `TrainerAppStart.js`

- **Path:** `src/app-start/TrainerAppStart.js`
- **What it is:** Root of the trainer experience after login — wires dashboard, clients, sessions, and navigation. Opened by AuthGate when the signed-in person is a trainer.
- **Who uses it:** Everyone (login / app start)
- **Suggested name:** ___

### `cloudConnection.js`

- **Path:** `src/app-start/cloudConnection.js`
- **What it is:** Starts the cloud login/database connection for the whole app. Production project id must stay anatrox-auth. Imported almost everywhere — you can rename the file, but never change the live Firebase project id when rebranding.
- **Who uses it:** Everyone (login / app start)
- **Suggested name:** ___

## assets

<a id="assets"></a>

**Folder purpose:** Static images, Lottie animations, and icon PNGs bundled with the app.

### `Run Hamster... run.json`

- **Path:** `src/assets/Run Hamster... run.json`
- **What it is:** Lottie animation "Run Hamster... run" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `Stressed Employee At Work.json`

- **Path:** `src/assets/Stressed Employee At Work.json`
- **What it is:** Lottie animation "Stressed Employee At Work" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `ai_workouts.png`

- **Path:** `src/assets/ai_workouts.png`
- **What it is:** Marketing/hero image for AI-generated workout plans feature. Bundled static asset under `assets`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `sad reaction.json`

- **Path:** `src/assets/sad reaction.json`
- **What it is:** Lottie animation "sad reaction" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `sneakers.gif`

- **Path:** `src/assets/sneakers.gif`
- **What it is:** PNG/GIF image "sneakers" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

## assets/animations

<a id="assets-animations"></a>

**Folder purpose:** Lottie / loading animation assets (including prism loading art).

### `Rubiks Cube Animation.json`

- **Path:** `src/assets/animations/Rubiks Cube Animation.json`
- **What it is:** Lottie animation "Rubiks Cube Animation" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `loading-prism-sheet.png`

- **Path:** `src/assets/animations/loading-prism-sheet.png`
- **What it is:** PNG/GIF image "loading prism sheet" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `rubiks-cube-loading.json`

- **Path:** `src/assets/animations/rubiks-cube-loading.json`
- **What it is:** Lottie animation "rubiks cube loading" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

## assets/animations/app-flows

<a id="assets-animations-app-flows"></a>

**Folder purpose:** Lottie animations played during onboarding and app-flow steps.

### `Exercise for diet or health.json`

- **Path:** `src/assets/animations/app-flows/Exercise for diet or health.json`
- **What it is:** Lottie animation "Exercise for diet or health" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `Guy talking to Robot _ AI Help.json`

- **Path:** `src/assets/animations/app-flows/Guy talking to Robot _ AI Help.json`
- **What it is:** Lottie animation "Guy talking to Robot AI Help" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `certifications.json`

- **Path:** `src/assets/animations/app-flows/certifications.json`
- **What it is:** Lottie animation "certifications" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `equipment.json`

- **Path:** `src/assets/animations/app-flows/equipment.json`
- **What it is:** Lottie animation "equipment" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `experience-timeline.json`

- **Path:** `src/assets/animations/app-flows/experience-timeline.json`
- **What it is:** Lottie animation "experience timeline" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `fitness-experience.json`

- **Path:** `src/assets/animations/app-flows/fitness-experience.json`
- **What it is:** Lottie animation "fitness experience" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `fitness-goal.json`

- **Path:** `src/assets/animations/app-flows/fitness-goal.json`
- **What it is:** Lottie animation "fitness goal" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `injuries.json`

- **Path:** `src/assets/animations/app-flows/injuries.json`
- **What it is:** Lottie animation "injuries" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `invite-code.json`

- **Path:** `src/assets/animations/app-flows/invite-code.json`
- **What it is:** Lottie animation "invite code" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `personal-info.json`

- **Path:** `src/assets/animations/app-flows/personal-info.json`
- **What it is:** Lottie animation "personal info" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `philosophy.json`

- **Path:** `src/assets/animations/app-flows/philosophy.json`
- **What it is:** Lottie animation "philosophy" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `rates.json`

- **Path:** `src/assets/animations/app-flows/rates.json`
- **What it is:** Lottie animation "rates" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `role-selection.json`

- **Path:** `src/assets/animations/app-flows/role-selection.json`
- **What it is:** Lottie animation "role selection" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `specialties.json`

- **Path:** `src/assets/animations/app-flows/specialties.json`
- **What it is:** Lottie animation "specialties" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `trainer-code.json`

- **Path:** `src/assets/animations/app-flows/trainer-code.json`
- **What it is:** Lottie animation "trainer code" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `training-frequency.json`

- **Path:** `src/assets/animations/app-flows/training-frequency.json`
- **What it is:** Lottie animation "training frequency" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

## assets/animations/legacy

<a id="assets-animations-legacy"></a>

**Folder purpose:** Legacy branded Lottie files (AI, food, fitness themes).

### `Artificial intelligence digital technology (1).json`

- **Path:** `src/assets/animations/legacy/Artificial intelligence digital technology (1).json`
- **What it is:** Lottie animation "Artificial intelligence digital technology (1)" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `Cloud robotics abstract.json`

- **Path:** `src/assets/animations/legacy/Cloud robotics abstract.json`
- **What it is:** Lottie animation "Cloud robotics abstract" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `Fast food.json`

- **Path:** `src/assets/animations/legacy/Fast food.json`
- **What it is:** Lottie animation "Fast food" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `Fitness.json`

- **Path:** `src/assets/animations/legacy/Fitness.json`
- **What it is:** Lottie animation "Fitness" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `Food squeeze_With Burger and hot dog.json`

- **Path:** `src/assets/animations/legacy/Food squeeze_With Burger and hot dog.json`
- **What it is:** Lottie animation "Food squeeze With Burger and hot dog" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `Healthy food for diet & fitness.json`

- **Path:** `src/assets/animations/legacy/Healthy food for diet & fitness.json`
- **What it is:** Lottie animation "Healthy food for diet & fitness" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `boxer lottie.json`

- **Path:** `src/assets/animations/legacy/boxer lottie.json`
- **What it is:** Lottie animation "boxer lottie" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `fitness (1).json`

- **Path:** `src/assets/animations/legacy/fitness (1).json`
- **What it is:** Lottie animation "fitness (1)" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `food around the city.json`

- **Path:** `src/assets/animations/legacy/food around the city.json`
- **What it is:** Lottie animation "food around the city" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `glass water.json`

- **Path:** `src/assets/animations/legacy/glass water.json`
- **What it is:** Lottie animation "glass water" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `loading.json`

- **Path:** `src/assets/animations/legacy/loading.json`
- **What it is:** Lottie animation "loading" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `sleep.json`

- **Path:** `src/assets/animations/legacy/sleep.json`
- **What it is:** Lottie animation "sleep" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

## assets/icons

<a id="assets-icons"></a>

**Folder purpose:** Nutrition, workout, and UI icon PNGs/GIFs used across onboarding and dashboards.

### `Carbs.png`

- **Path:** `src/assets/icons/Carbs.png`
- **What it is:** Macro breakdown UI — carbohydrate icon on nutrition cards and dashboards. Bundled static asset under `assets/icons`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `Check in.png`

- **Path:** `src/assets/icons/Check in.png`
- **What it is:** PNG/GIF image "Check in" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `Fats.png`

- **Path:** `src/assets/icons/Fats.png`
- **What it is:** Macro breakdown UI — fat icon on nutrition cards and dashboards. Bundled static asset under `assets/icons`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `Illustration-of-Google-icon-on-transparent-background-PNG.png`

- **Path:** `src/assets/icons/Illustration-of-Google-icon-on-transparent-background-PNG.png`
- **What it is:** PNG/GIF image "Illustration of Google icon on transparent background PNG" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `Progress.png`

- **Path:** `src/assets/icons/Progress.png`
- **What it is:** PNG/GIF image "Progress" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `Protein.png`

- **Path:** `src/assets/icons/Protein.png`
- **What it is:** Macro breakdown UI — protein icon on nutrition cards and dashboards. Bundled static asset under `assets/icons`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `Schedule.png`

- **Path:** `src/assets/icons/Schedule.png`
- **What it is:** PNG/GIF image "Schedule" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `This Week.png`

- **Path:** `src/assets/icons/This Week.png`
- **What it is:** PNG/GIF image "This Week" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `apple-logo.png`

- **Path:** `src/assets/icons/apple-logo.png`
- **What it is:** Sign in with Apple button on auth screen. Bundled static asset under `assets/icons`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `arm-muscle.gif`

- **Path:** `src/assets/icons/arm-muscle.gif`
- **What it is:** PNG/GIF image "arm muscle" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `banned.png`

- **Path:** `src/assets/icons/banned.png`
- **What it is:** PNG/GIF image "banned" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `burger.png`

- **Path:** `src/assets/icons/burger.png`
- **What it is:** PNG/GIF image "burger" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `delete.png`

- **Path:** `src/assets/icons/delete.png`
- **What it is:** PNG/GIF image "delete" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `digital-gift-card-abstract-concept-illustration.png`

- **Path:** `src/assets/icons/digital-gift-card-abstract-concept-illustration.png`
- **What it is:** PNG/GIF image "digital gift card abstract concept illustration" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `dumbbell.png`

- **Path:** `src/assets/icons/dumbbell.png`
- **What it is:** Workout-related UI — exercise and training sections. Bundled static asset under `assets/icons`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `energy.png`

- **Path:** `src/assets/icons/energy.png`
- **What it is:** Energy level icon on home stats and daily metrics. Bundled static asset under `assets/icons`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `enviro.png`

- **Path:** `src/assets/icons/enviro.png`
- **What it is:** PNG/GIF image "enviro" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `environment.png`

- **Path:** `src/assets/icons/environment.png`
- **What it is:** PNG/GIF image "environment" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `frequency-2.svg`

- **Path:** `src/assets/icons/frequency-2.svg`
- **What it is:** Static asset `frequency-2.svg` in `assets/icons`. Referenced by nearby UI code via require/import.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `frequency2SvgXml.js`

- **Path:** `src/assets/icons/frequency2SvgXml.js`
- **What it is:** Frequency2Svg Xml in `assets/icons`. Part of `assets/icons` — search the repo for "frequency2SvgXml" to see what imports it before renaming.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `google_gemini.png`

- **Path:** `src/assets/icons/google_gemini.png`
- **What it is:** AI Coach nav icon — indicates Gemini-powered coach features. Bundled static asset under `assets/icons`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `height.png`

- **Path:** `src/assets/icons/height.png`
- **What it is:** Height input icon during onboarding. Bundled static asset under `assets/icons`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `hydration.png`

- **Path:** `src/assets/icons/hydration.png`
- **What it is:** Water/hydration tracking icon on home stats and daily metrics. Bundled static asset under `assets/icons`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `injury.png`

- **Path:** `src/assets/icons/injury.png`
- **What it is:** PNG/GIF image "injury" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `journey.png`

- **Path:** `src/assets/icons/journey.png`
- **What it is:** PNG/GIF image "journey" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `people.png`

- **Path:** `src/assets/icons/people.png`
- **What it is:** PNG/GIF image "people" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `picture.png`

- **Path:** `src/assets/icons/picture.png`
- **What it is:** PNG/GIF image "picture" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `scales.png`

- **Path:** `src/assets/icons/scales.png`
- **What it is:** Weight/body metrics icon in onboarding and profile. Bundled static asset under `assets/icons`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `settings.png`

- **Path:** `src/assets/icons/settings.png`
- **What it is:** Settings gear icon in headers and menus. Bundled static asset under `assets/icons`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `sleeping.png`

- **Path:** `src/assets/icons/sleeping.png`
- **What it is:** Sleep tracking icon on home stats and daily metrics. Bundled static asset under `assets/icons`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `stress.png`

- **Path:** `src/assets/icons/stress.png`
- **What it is:** PNG/GIF image "stress" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `supplement.png`

- **Path:** `src/assets/icons/supplement.png`
- **What it is:** PNG/GIF image "supplement" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `weightlifting-competition.json`

- **Path:** `src/assets/icons/weightlifting-competition.json`
- **What it is:** Lottie animation "weightlifting competition" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `assets/icons`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `workout.png`

- **Path:** `src/assets/icons/workout.png`
- **What it is:** Workout tab and plan-related navigation icons. Bundled static asset under `assets/icons`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

## assets/icons/New Icons

<a id="assets-icons-New-Icons"></a>

**Folder purpose:** Onboarding picker icons (equipment, experience level, gender).

### `Advanced.png`

- **Path:** `src/assets/icons/New Icons/Advanced.png`
- **What it is:** Onboarding — advanced fitness experience level option. Bundled static asset under `assets/icons/New Icons`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `Age.png`

- **Path:** `src/assets/icons/New Icons/Age.png`
- **What it is:** Onboarding picker icon: Age. Shown when the user selects equipment, experience, gender, or similar profile options. Duplicated/consolidated asset path so onboarding screens can import icons consistently.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `Beginner.png`

- **Path:** `src/assets/icons/New Icons/Beginner.png`
- **What it is:** Onboarding — beginner fitness experience level option. Bundled static asset under `assets/icons/New Icons`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `Bodyweight Only.png`

- **Path:** `src/assets/icons/New Icons/Bodyweight Only.png`
- **What it is:** Onboarding picker icon: Bodyweight Only. Shown when the user selects equipment, experience, gender, or similar profile options. Duplicated/consolidated asset path so onboarding screens can import icons consistently.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `Full Gym.png`

- **Path:** `src/assets/icons/New Icons/Full Gym.png`
- **What it is:** Onboarding picker icon: Full Gym. Shown when the user selects equipment, experience, gender, or similar profile options. Duplicated/consolidated asset path so onboarding screens can import icons consistently.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `Intermediate.png`

- **Path:** `src/assets/icons/New Icons/Intermediate.png`
- **What it is:** Onboarding — intermediate fitness experience level option. Bundled static asset under `assets/icons/New Icons`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `Other.png`

- **Path:** `src/assets/icons/New Icons/Other.png`
- **What it is:** Onboarding picker icon: Other. Shown when the user selects equipment, experience, gender, or similar profile options. Duplicated/consolidated asset path so onboarding screens can import icons consistently.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `Pull Up Bar.png`

- **Path:** `src/assets/icons/New Icons/Pull Up Bar.png`
- **What it is:** Onboarding picker icon: Pull Up Bar. Shown when the user selects equipment, experience, gender, or similar profile options. Duplicated/consolidated asset path so onboarding screens can import icons consistently.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `Resistance Bands.png`

- **Path:** `src/assets/icons/New Icons/Resistance Bands.png`
- **What it is:** Onboarding picker icon: Resistance Bands. Shown when the user selects equipment, experience, gender, or similar profile options. Duplicated/consolidated asset path so onboarding screens can import icons consistently.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `dumbbells.png`

- **Path:** `src/assets/icons/New Icons/dumbbells.png`
- **What it is:** Onboarding — home gym equipment option (dumbbells only). Bundled static asset under `assets/icons/New Icons`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `female.png`

- **Path:** `src/assets/icons/New Icons/female.png`
- **What it is:** Onboarding — gender selection (female). Bundled static asset under `assets/icons/New Icons`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `male.png`

- **Path:** `src/assets/icons/New Icons/male.png`
- **What it is:** Onboarding — gender selection (male). Bundled static asset under `assets/icons/New Icons`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `prefer not to say.png`

- **Path:** `src/assets/icons/New Icons/prefer not to say.png`
- **What it is:** Onboarding — gender prefer-not-to-say option. Bundled static asset under `assets/icons/New Icons`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

## assets/logo

<a id="assets-logo"></a>

**Folder purpose:** Brand logo image assets.

### `Logo.PNG`

- **Path:** `src/assets/logo/Logo.PNG`
- **What it is:** PNG/GIF image "Logo" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `Transparent Logo.PNG`

- **Path:** `src/assets/logo/Transparent Logo.PNG`
- **What it is:** PNG/GIF image "Transparent Logo" used as a visual icon or illustration in the assets UI. Loaded with `require()` — not executable code; safe to rename if you update all import paths.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `brandLogo.js`

- **Path:** `src/assets/logo/brandLogo.js`
- **What it is:** Official Coach Connect brand mark (interlocking CC infinity gradient). Native asset aspect ratio — width / height.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

## assets/onboarding-consolidated

<a id="assets-onboarding-consolidated"></a>

**Folder purpose:** Flattened onboarding icon set for consolidated imports.

### `Advanced.png`

- **Path:** `src/assets/onboarding-consolidated/Advanced.png`
- **What it is:** Onboarding — advanced fitness experience level option. Bundled static asset under `assets/onboarding-consolidated`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `Age.png`

- **Path:** `src/assets/onboarding-consolidated/Age.png`
- **What it is:** Onboarding picker icon: Age. Shown when the user selects equipment, experience, gender, or similar profile options. Duplicated/consolidated asset path so onboarding screens can import icons consistently.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `Beginner.png`

- **Path:** `src/assets/onboarding-consolidated/Beginner.png`
- **What it is:** Onboarding — beginner fitness experience level option. Bundled static asset under `assets/onboarding-consolidated`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `Intermediate.png`

- **Path:** `src/assets/onboarding-consolidated/Intermediate.png`
- **What it is:** Onboarding — intermediate fitness experience level option. Bundled static asset under `assets/onboarding-consolidated`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `Other.png`

- **Path:** `src/assets/onboarding-consolidated/Other.png`
- **What it is:** Onboarding picker icon: Other. Shown when the user selects equipment, experience, gender, or similar profile options. Duplicated/consolidated asset path so onboarding screens can import icons consistently.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `bodyweight_only.png`

- **Path:** `src/assets/onboarding-consolidated/bodyweight_only.png`
- **What it is:** Onboarding — bodyweight-only training option. Bundled static asset under `assets/onboarding-consolidated`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `dumbbells.png`

- **Path:** `src/assets/onboarding-consolidated/dumbbells.png`
- **What it is:** Onboarding — home gym equipment option (dumbbells only). Bundled static asset under `assets/onboarding-consolidated`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `female.png`

- **Path:** `src/assets/onboarding-consolidated/female.png`
- **What it is:** Onboarding — gender selection (female). Bundled static asset under `assets/onboarding-consolidated`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `full_gym.png`

- **Path:** `src/assets/onboarding-consolidated/full_gym.png`
- **What it is:** Onboarding — full commercial gym equipment option. Bundled static asset under `assets/onboarding-consolidated`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `height.png`

- **Path:** `src/assets/onboarding-consolidated/height.png`
- **What it is:** Height input icon during onboarding. Bundled static asset under `assets/onboarding-consolidated`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `male.png`

- **Path:** `src/assets/onboarding-consolidated/male.png`
- **What it is:** Onboarding — gender selection (male). Bundled static asset under `assets/onboarding-consolidated`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `prefer_not_to_say.png`

- **Path:** `src/assets/onboarding-consolidated/prefer_not_to_say.png`
- **What it is:** Onboarding — gender prefer-not-to-say option. Bundled static asset under `assets/onboarding-consolidated`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `pull_up_bar.png`

- **Path:** `src/assets/onboarding-consolidated/pull_up_bar.png`
- **What it is:** Onboarding picker icon: pull up bar. Shown when the user selects equipment, experience, gender, or similar profile options. Duplicated/consolidated asset path so onboarding screens can import icons consistently.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `resistance_bands.png`

- **Path:** `src/assets/onboarding-consolidated/resistance_bands.png`
- **What it is:** Onboarding picker icon: resistance bands. Shown when the user selects equipment, experience, gender, or similar profile options. Duplicated/consolidated asset path so onboarding screens can import icons consistently.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

### `scales.png`

- **Path:** `src/assets/onboarding-consolidated/scales.png`
- **What it is:** Weight/body metrics icon in onboarding and profile. Bundled static asset under `assets/onboarding-consolidated`.
- **Who uses it:** Everyone (pictures / animations)
- **Suggested name:** ___

## block-and-report

<a id="block-and-report"></a>

**Folder purpose:** Source files for the `block-and-report` module.

### `BlockedUsersScreen.jsx`

- **Path:** `src/block-and-report/BlockedUsersScreen.jsx`
- **What it is:** Used by: SettingsScreen (local overlay — no shell route required).. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in block-and-report.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `ReportOrBlockPopup.jsx`

- **Path:** `src/block-and-report/ReportOrBlockPopup.jsx`
- **What it is:** Report / Block / Cancel for the other person in a chat or marketplace profile. @param {{ peerName?: string, onReport: () => void, onBlock: () => void, }} opts. UI labels include "Why are you reporting?".
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `blockUser.js`

- **Path:** `src/block-and-report/blockUser.js`
- **What it is:** @param {string} uid - signed-in user @param {string} blockedUid - person to hide @param {{ displayName?: string } } [meta]. Subscribes to real-time cloud database updates; uses cloud database (`users`).
- **Who uses it:** Shared / cross-app
- **Flags:** `STUB`
- **Suggested name:** ___

### `blockedList.js`

- **Path:** `src/block-and-report/blockedList.js`
- **What it is:** @param {string | null | undefined} uid @returns {{ blockedIds: Set<string>, loading: boolean }}. Part of `block-and-report` — search the repo for "blockedList" to see what imports it before renaming.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `index.js`

- **Path:** `src/block-and-report/index.js`
- **What it is:** Barrel for block / report helpers used by chat and trainer profile menus.. Part of `block-and-report` — search the repo for "index" to see what imports it before renaming.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `reportContent.js`

- **Path:** `src/block-and-report/reportContent.js`
- **What it is:** @param {object} params @param {string} params.reporterId @param {'user'|'message'|'trainer_profile'} params.type @param {string} params.targetUid @param {string} params.reason - REPORT_REASONS id @param {string} [params.details] @param {string} [params.conversationId] @param {string} [params.messageId] @param {string} [params.targetDisplayName] @param {boolean} [params.notifySupport=true] - open mailto after write. Part of `block-and-report` — search the repo for "reportContent" to see what imports it before renaming.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `reportReasons.js`

- **Path:** `src/block-and-report/reportReasons.js`
- **What it is:** Report Reasons in `block-and-report`. UI labels include "Spam or scam".
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

## client-app/files-and-notes

<a id="client-app-files-and-notes"></a>

**Folder purpose:** Everything specific to the client (trainee) role — home, dashboard, marketplace, files, navigation.

### `FileCard.jsx`

- **Path:** `src/client-app/files-and-notes/FileCard.jsx`
- **What it is:** File Card — renders gradient backgrounds and buttons. UI labels include "Photo".
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `FilesScreen.jsx`

- **Path:** `src/client-app/files-and-notes/FilesScreen.jsx`
- **What it is:** Files Screen — the screen the user sees for this part of the client-app flow. Renders gradient backgrounds and buttons.
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `MyFilesSection.jsx`

- **Path:** `src/client-app/files-and-notes/MyFilesSection.jsx`
- **What it is:** My Files Section — lets the user pick photos from the camera roll. Renders gradient backgrounds and buttons; UI labels include "All Files".
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `NotesFromTrainerSection.jsx`

- **Path:** `src/client-app/files-and-notes/NotesFromTrainerSection.jsx`
- **What it is:** Notes From Trainer Section in `client-app/files-and-notes`. Part of `client-app/files-and-notes` — search the repo for "NotesFromTrainerSection" to see what imports it before renaming.
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `SharedByTrainerSection.jsx`

- **Path:** `src/client-app/files-and-notes/SharedByTrainerSection.jsx`
- **What it is:** Shared By Trainer Section in `client-app/files-and-notes`. UI labels include "Documents".
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `TrainerSharedFilesPopup.jsx`

- **Path:** `src/client-app/files-and-notes/TrainerSharedFilesPopup.jsx`
- **What it is:** Full-screen list of trainer-shared files (same grid chrome as home preview). UI labels include "Trainer shared files".
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

## client-app/find-a-trainer

<a id="client-app-find-a-trainer"></a>

**Folder purpose:** Everything specific to the client (trainee) role — home, dashboard, marketplace, files, navigation.

### `BrowseTrainersScreen.jsx`

- **Path:** `src/client-app/find-a-trainer/BrowseTrainersScreen.jsx`
- **What it is:** Matches ClientAppStart AI Coach `HeroWelcomeCard` / home hero banner shell (static border). Renders gradient backgrounds and buttons.
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `ConfirmRequestPopup.jsx`

- **Path:** `src/client-app/find-a-trainer/ConfirmRequestPopup.jsx`
- **What it is:** Confirm Request Popup — renders gradient backgrounds and buttons. Part of marketplace in Coach Connect.
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `FilterPopup.js`

- **Path:** `src/client-app/find-a-trainer/FilterPopup.js`
- **What it is:** Filter Popup — renders gradient backgrounds and buttons. UI labels include "Sort by".
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `FindTrainerPieces.jsx`

- **Path:** `src/client-app/find-a-trainer/FindTrainerPieces.jsx`
- **What it is:** Pink → orange gradient text (web.text-gradient). UI labels include "Filter".
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `FrostedPanel.jsx`

- **Path:** `src/client-app/find-a-trainer/FrostedPanel.jsx`
- **What it is:** Frosted glass panel — blur backdrop + translucent tint + soft top-lit border (web.glass-card). Part of `client-app/find-a-trainer` — search the repo for "FrostedPanel" to see what imports it before renaming.
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `RequestIntroPopup.jsx`

- **Path:** `src/client-app/find-a-trainer/RequestIntroPopup.jsx`
- **What it is:** Request Intro Popup — renders gradient backgrounds and buttons. UI labels include "Write a message (optional)…".
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `SearchTrainersScreen.jsx`

- **Path:** `src/client-app/find-a-trainer/SearchTrainersScreen.jsx`
- **What it is:** When false, this screen skips its own nav but parent shell still shows BottomMenuBar. Reads or writes Firebase cloud database documents.
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `TrainerCard.jsx`

- **Path:** `src/client-app/find-a-trainer/TrainerCard.jsx`
- **What it is:** Trainer Card — renders gradient backgrounds and buttons. Part of `client-app/find-a-trainer` — search the repo for "TrainerCard" to see what imports it before renaming.
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `TrainerProfilePopup.jsx`

- **Path:** `src/client-app/find-a-trainer/TrainerProfilePopup.jsx`
- **What it is:** Marketplace Trainer Profile Sheet. UI labels include "Custom workouts".
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `sendConnectionRequest.js`

- **Path:** `src/client-app/find-a-trainer/sendConnectionRequest.js`
- **What it is:** Native alert after a connection request is sent successfully. Part of `client-app/find-a-trainer` — search the repo for "sendConnectionRequest" to see what imports it before renaming.
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `trainerFilters.js`

- **Path:** `src/client-app/find-a-trainer/trainerFilters.js`
- **What it is:** Marketplace filter shape, theme reportColors, and filter logic (reference UI spec; Firebase as source). Marketplace Filters Purpose: marketplace Filters.
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

## client-app/home

<a id="client-app-home"></a>

**Folder purpose:** Client home tab: welcome card, bootstrap hooks, home screen styles.

### `MyTrainerCard.jsx`

- **Path:** `src/client-app/home/MyTrainerCard.jsx`
- **What it is:** Dark pink → dark orange brand CTA. UI labels include "Message".
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `TodayStatsCards.jsx`

- **Path:** `src/client-app/home/TodayStatsCards.jsx`
- **What it is:** Dashboard grid of premium stat cards (workouts, nutrition, hydration, sleep) on the client home/dashboard. Wraps each stat in gradient borders and pulls live values from daily metrics hooks.
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `TopBannerCard.jsx`

- **Path:** `src/client-app/home/TopBannerCard.jsx`
- **What it is:** Matches Aurora hero + Settings: dark pink → dark orange. UI labels include "Workouts".
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `TrainingHomeScreen.jsx`

- **Path:** `src/client-app/home/TrainingHomeScreen.jsx`
- **What it is:** Same purple → orange stripe as hero / training agenda cards. Reads or writes Firebase cloud database documents; renders Lottie animations in the UI; renders gradient backgrounds and buttons.
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `WriteTrainerReviewPopup.js`

- **Path:** `src/client-app/home/WriteTrainerReviewPopup.js`
- **What it is:** popup that slides up for submitting or editing a trainer review. Uses cloud database (`users`); UI labels include "Share your experience (optional)".
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `homeLooks.js`

- **Path:** `src/client-app/home/homeLooks.js`
- **What it is:** Wellness row: stack title + value as one centered group (no space-between gap). Client App Styles Purpose: client App Styles.
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `homeScreenPieces.jsx`

- **Path:** `src/client-app/home/homeScreenPieces.jsx`
- **What it is:** Home Screen Pieces — renders Lottie animations in the UI. Renders gradient backgrounds and buttons; UI labels include "Calories".
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `keepDailyStatsFresh.js`

- **Path:** `src/client-app/home/keepDailyStatsFresh.js`
- **What it is:** Home-screen daily metrics: midnight rollover, archive, live cloud database sync. Subscribes to real-time cloud database updates; uses cloud database (`users`).
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `loadHomeScreenData.js`

- **Path:** `src/client-app/home/loadHomeScreenData.js`
- **What it is:** Initial home dashboard cloud database fetch (user doc, goals, nutrition, workouts). Caches data locally on the device between app launches; uses cloud database (`users`).
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `workoutDiary.js`

- **Path:** `src/client-app/home/workoutDiary.js`
- **What it is:** Structured workout logger: exercises + sets stored as workoutLog in dailyLogs. Subscribes to real-time cloud database updates; uses cloud database (`users`).
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

## client-app/meals

<a id="client-app-meals"></a>

**Folder purpose:** Everything specific to the client (trainee) role — home, dashboard, marketplace, files, navigation.

### `LogTodaysMealsScreen.jsx`

- **Path:** `src/client-app/meals/LogTodaysMealsScreen.jsx`
- **What it is:** Log Todays Meals Screen — the screen the user sees for this part of the client-app flow. Reads or writes Firebase cloud database documents; uses the device camera to scan product barcodes; renders gradient backgrounds and buttons.
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

## client-app/navigation

<a id="client-app-navigation"></a>

**Folder purpose:** Client app shell, bottom nav, overlay stack, screen navigation hook.

### `ClientBottomMenu.jsx`

- **Path:** `src/client-app/navigation/ClientBottomMenu.jsx`
- **What it is:** Floating bottom navigation bar on client stack screens (Profile, Settings, etc.) when not on the main tab bar. Lets users jump back to Home or Coach without losing their place in a sub-screen.
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `ClientMainScreen.jsx`

- **Path:** `src/client-app/navigation/ClientMainScreen.jsx`
- **What it is:** Client Main Screen — the screen the user sees for this part of the client-app flow. Reads or writes Firebase cloud database documents; registers or navigates between app screens; renders gradient backgrounds and buttons.
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `ClientOpenScreenTracker.jsx`

- **Path:** `src/client-app/navigation/ClientOpenScreenTracker.jsx`
- **What it is:** shared app setting holding client shell state: which overlay screen is open, back handlers, and tab visibility. ClientMainScreen and overlay screens read this instead of prop-drilling navigation state.
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `ClientScreenList.jsx`

- **Path:** `src/client-app/navigation/ClientScreenList.jsx`
- **What it is:** Client Screen List — registers or navigates between app screens. Part of `client-app/navigation` — search the repo for "ClientScreenList" to see what imports it before renaming.
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `clientExtraScreens.jsx`

- **Path:** `src/client-app/navigation/clientExtraScreens.jsx`
- **What it is:** Maps overlay route names to screens: Profile, Settings, FAQ, Terms, Nutrition, Marketplace, Weekly Report, etc. Rendered on top of ClientMainScreen when user opens settings or support from the client shell.
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

### `goToClientScreen.js`

- **Path:** `src/client-app/navigation/goToClientScreen.js`
- **What it is:** Primary bottom-nav destinations stay on MainTabs (not stack) so the bar stays visible. Registers or navigates between app screens.
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

## client-app/profile

<a id="client-app-profile"></a>

**Folder purpose:** Client profile screen.

### `MyProfileScreen.jsx`

- **Path:** `src/client-app/profile/MyProfileScreen.jsx`
- **What it is:** Unified profile chrome — CoachConnect warm accent (dark pink → dark orange). Reads or writes Firebase cloud database documents; lets the user pick photos from the camera roll; renders gradient backgrounds and buttons.
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

## client-app/workout-plans

<a id="client-app-workout-plans"></a>

**Folder purpose:** Client AI workout plans list screen.

### `MyWorkoutPlanScreen.jsx`

- **Path:** `src/client-app/workout-plans/MyWorkoutPlanScreen.jsx`
- **What it is:** One unique muted rim gradient per weekday — not oversaturated. Renders gradient backgrounds and buttons.
- **Who uses it:** Trainee (client) app
- **Suggested name:** ___

## crash-reports

<a id="crash-reports"></a>

**Folder purpose:** Source files for the `crash-reports` module.

### `CrashCatcher.jsx`

- **Path:** `src/crash-reports/CrashCatcher.jsx`
- **What it is:** Crash Catcher in `crash-reports`. Part of `crash-reports` — search the repo for "CrashCatcher" to see what imports it before renaming.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `recordError.js`

- **Path:** `src/crash-reports/recordError.js`
- **What it is:** Client-side error logger — captures JS errors and optionally forwards them to the server. Wraps console.error and integrates with autoLogError for crash reporting.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `reportCrashAutomatically.js`

- **Path:** `src/crash-reports/reportCrashAutomatically.js`
- **What it is:** Where a crash came from in the monitoring dashboard. sites `await` it without special-casing, which keeps error paths uniform.. Part of `crash-reports` — search the repo for "reportCrashAutomatically" to see what imports it before renaming.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `sendSavedErrors.js`

- **Path:** `src/crash-reports/sendSavedErrors.js`
- **What it is:** Queue an error in AsyncStorage (phone app) This is called automatically by reportCrashAutomaticallySync. Queue an error in AsyncStorage (phone app) This is called automatically by reportCrashAutomaticallySync.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

## daily-stats

<a id="daily-stats"></a>

**Folder purpose:** Source files for the `daily-stats` module.

### `dailyQuotes.json`

- **Path:** `src/daily-stats/dailyQuotes.json`
- **What it is:** Lottie animation "daily Quotes" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `daily-stats`.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `latestWeight.js`

- **Path:** `src/daily-stats/latestWeight.js`
- **What it is:** Latest finite `dashboard_weight` from dailyLogs, newest day first; null if never logged. Uses cloud database (`users`).
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `readDailyStats.js`

- **Path:** `src/daily-stats/readDailyStats.js`
- **What it is:** Merge legacy tracking into dailyLogs-shaped doc for workout logger hydration. Part of `daily-stats` — search the repo for "readDailyStats" to see what imports it before renaming.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `saveDailyStats.js`

- **Path:** `src/daily-stats/saveDailyStats.js`
- **What it is:** One-time legacy read — prefer live `dailyLogs` listener. TODO: remove after backfill. Uses cloud database (`users/{uid}/dailyLogs/{date}`).
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `saveYesterdaysStats.js`

- **Path:** `src/daily-stats/saveYesterdaysStats.js`
- **What it is:** Archive yesterday's dashboard metrics into `daily_logs/{uid}_{date}`. Idempotent merge write. Caches data locally on the device between app launches; uses cloud database (`dailyLogs`).
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `todaysDate.js`

- **Path:** `src/daily-stats/todaysDate.js`
- **What it is:** Todays Date in `daily-stats`. Part of `daily-stats` — search the repo for "todaysDate" to see what imports it before renaming.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

## for-both

<a id="for-both"></a>

**Folder purpose:** Code used by both trainees and trainers (shared screens, payments, notes/files, talking to the server).

### `calorieAndMacroMath.js`

- **Path:** `src/for-both/calorieAndMacroMath.js`
- **What it is:** BMR calculation using Mifflin-St Jeor equation. Calculations Purpose: Fitness math utilities — BMR, TDEE, macros, body composition.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `profileCardIconSizes.js`

- **Path:** `src/for-both/profileCardIconSizes.js`
- **What it is:** Shared profile-card PNG sizing (ClientAppStart + TrainerAppStart workout screens). Profile Card Icons Purpose: UI screen or component: profile Card Icons.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `screenReaderLabels.js`

- **Path:** `src/for-both/screenReaderLabels.js`
- **What it is:** Shared accessibility props for Coach Connect core flows. Use on Pressable / TouchableOpacity / TextInput so VoiceOver/TalkBack get clear names. A11y Props Purpose: a11y Props.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `trainerCity.js`

- **Path:** `src/for-both/trainerCity.js`
- **What it is:** Trainer city/location helpers — lazy-loads expo-location so app startup does not crash when the native ExpoLocation module is missing from a dev build. Lazy-load so app startup does not require the native ExpoLocation module.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `whichProfileCardsToShow.js`

- **Path:** `src/for-both/whichProfileCardsToShow.js`
- **What it is:** Profile card visibility — only show cards for onboarding fields the user actually answered. Shared by ClientAppStart + TrainerAppStart (CreateWorkoutPlanScreen). Profile Card Visibility Purpose: UI screen or component: profile Card Visibility.
- **Who uses it:** Both roles
- **Suggested name:** ___

## for-both/app-wide-settings

<a id="for-both-app-wide-settings"></a>

**Folder purpose:** Code used by both trainees and trainers (shared screens, payments, notes/files, talking to the server).

### `AIPermission.js`

- **Path:** `src/for-both/app-wide-settings/AIPermission.js`
- **What it is:** Canonical per-user AI toggle — survives LoginGate profile refresh; key avoids clearAllUserData() coachconnect_* wipe. UI labels include "About AI in Coach Connect".
- **Who uses it:** Both roles
- **Suggested name:** ___

## for-both/assets

<a id="for-both-assets"></a>

**Folder purpose:** Shared icons/animations registry used in onboarding for both roles.

### `Happy SUN.json`

- **Path:** `src/for-both/assets/Happy SUN.json`
- **What it is:** Lottie animation "Happy SUN" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `for-both/assets`.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `Walking steps.json`

- **Path:** `src/for-both/assets/Walking steps.json`
- **What it is:** Lottie animation "Walking steps" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `for-both/assets`.
- **Who uses it:** Both roles
- **Suggested name:** ___

## for-both/cloud-database

<a id="for-both-cloud-database"></a>

**Folder purpose:** Code used by both trainees and trainers (shared screens, payments, notes/files, talking to the server).

### `handleLiveUpdateErrors.js`

- **Path:** `src/for-both/cloud-database/handleLiveUpdateErrors.js`
- **What it is:** True when cloud database rejected the request — expected during/after sign-out. Log snapshot errors except expected sign-out permission denials.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `loadInPages.js`

- **Path:** `src/for-both/cloud-database/loadInPages.js`
- **What it is:** cloud database query helpers — indexed query with safe fallback before indexes finish building. UI labels include "query".
- **Who uses it:** Both roles
- **Suggested name:** ___

### `loadMyProfile.js`

- **Path:** `src/for-both/cloud-database/loadMyProfile.js`
- **What it is:** User profile fetch — cloud database-first (production project anatrox-auth). Hits API routes /api/me failed (${resp.status}); uses cloud database (`users`).
- **Who uses it:** Both roles
- **Suggested name:** ___

### `traineeProfileLocations.js`

- **Path:** `src/for-both/cloud-database/traineeProfileLocations.js`
- **What it is:** Canonical cloud database registry: clients/{uid} — one doc per account with role "client". Mirrors trainers/{uid} for marketplace/discovery. Populated on signup, onboarding, and server sync. Client Profile cloud database Purpose: Data/service layer: client Profile cloud database.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `uploadAndDownloadFiles.js`

- **Path:** `src/for-both/cloud-database/uploadAndDownloadFiles.js`
- **What it is:** Upload a file to Firebase Storage Get download URL for a file. Uses cloud database (`users/${userId}/profile/profile-image-${Date.now()}`).
- **Who uses it:** Both roles
- **Suggested name:** ___

## for-both/files-and-notes

<a id="for-both-files-and-notes"></a>

**Folder purpose:** Code used by both trainees and trainers (shared screens, payments, notes/files, talking to the server).

### `packSpreadsheetRows.js`

- **Path:** `src/for-both/files-and-notes/packSpreadsheetRows.js`
- **What it is:** Encodes spreadsheet rows for cloud database — flattens nested arrays because cloud database forbids them. Used when trainers edit shared spreadsheets in DocumentEditorModal.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `saveNotesAndFiles.js`

- **Path:** `src/for-both/files-and-notes/saveNotesAndFiles.js`
- **What it is:** Notes & Files — client and trainer can add notes, photos, videos, PDFs. Single source: users/{clientId}/notes_and_files. Each doc has addedBy: 'client' | 'trainer'. Client view: group by "From you" / "From trainer". Trainer view: group by "From client" / "From you". Uses cloud database (`users`).
- **Who uses it:** Both roles
- **Suggested name:** ___

## for-both/files-and-notes/viewers

<a id="for-both-files-and-notes-viewers"></a>

**Folder purpose:** Code used by both trainees and trainers (shared screens, payments, notes/files, talking to the server).

### `AddFilePopup.js`

- **Path:** `src/for-both/files-and-notes/viewers/AddFilePopup.js`
- **What it is:** popup triggered by the bottom nav plus button. Add: Photo, Video, PDF/Doc (+ trainer create/import options). Renders gradient backgrounds and buttons; UI labels include "Photo".
- **Who uses it:** Both roles
- **Suggested name:** ___

### `DocumentViewer.js`

- **Path:** `src/for-both/files-and-notes/viewers/DocumentViewer.js`
- **What it is:** DocumentViewer — read-only full-screen popup for trainer text/rich-text documents. Used when a client (or trainer) taps a document in Files. Loads content from cloud database via getTrainerDocument(trainerId, documentId) → users/{trainerId}/documents/{documentId}. Props (from parent screen): visible — show/hide the popup trainerId — owner of the document in cloud database documentId — document id under that trainer title — optional title before fetch completes (titleProp below) trainerName — shown in footer + share message createdAt — shown in footer isDark — reserved for theme (UI is mostly fixed dark today) onClose — called when user taps back or Android hardware back. Document Viewer popup Purpose: UI screen or component: Document Viewer popup.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `FileGrid.jsx`

- **Path:** `src/for-both/files-and-notes/viewers/FileGrid.jsx`
- **What it is:** Shared file gallery UI — gradient-bordered cards in a 2-column grid. Previews: stored thumbnailUrl (upload), Google embedded viewer for PDFs/docs/sheets, expo-av Video for video without thumb. File Gallery Grid Purpose: File Gallery Grid.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `FilesSection.jsx`

- **Path:** `src/for-both/files-and-notes/viewers/FilesSection.jsx`
- **What it is:** Dark orange → dark purple accent gradient. UI labels include "VIDEO".
- **Who uses it:** Both roles
- **Suggested name:** ___

### `PdfViewer.js`

- **Path:** `src/for-both/files-and-notes/viewers/PdfViewer.js`
- **What it is:** Pdf Viewer — renders gradient backgrounds and buttons. Part of shared in Coach Connect.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `PhotoVideoViewer.jsx`

- **Path:** `src/for-both/files-and-notes/viewers/PhotoVideoViewer.jsx`
- **What it is:** Photo Video Viewer — renders gradient backgrounds and buttons. Part of shared in Coach Connect.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `SpreadsheetViewer.js`

- **Path:** `src/for-both/files-and-notes/viewers/SpreadsheetViewer.js`
- **What it is:** SpreadsheetViewer — read-only viewer for uploaded.csv /.spreadsheetReader files. NOTE: This is NOT SpreadsheetEditor (trainer edit UI lives at src/trainer-app/documents/SpreadsheetEditor.js). Clients and trainers use this popup to preview file attachments from a download URL. Flow: 1. Parent passes visible + url + filename 2. fetch(url) → parse CSV text OR XLSX binary 3. Render rows in a scrollable table (horizontal + vertical ScrollViews) Props: visible — show/hide popup url — Firebase Storage or HTTPS URL to the file name — filename (used to detect.csv vs.spreadsheetReader) isDark — light/dark chrome for header and cells onClose — back button / Android back. UI labels include "Copy CSV".
- **Who uses it:** Both roles
- **Suggested name:** ___

### `WebPageViewer.jsx`

- **Path:** `src/for-both/files-and-notes/viewers/WebPageViewer.jsx`
- **What it is:** Fullscreen embedded viewer (Office Online / Google gview) — keeps user in the app. Embed Web View popup Purpose: UI screen or component: Embed Web View popup.
- **Who uses it:** Both roles
- **Suggested name:** ___

## for-both/home-cards

<a id="for-both-home-cards"></a>

**Folder purpose:** Code used by both trainees and trainers (shared screens, payments, notes/files, talking to the server).

### `CardGlow.jsx`

- **Path:** `src/for-both/home-cards/CardGlow.jsx`
- **What it is:** Flat glow wash behind hero cards — tinted plate + colored shadow only (no blobs). Same idea as FilesHeaderCard cardShadow — orange luminous spill behind the card.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `DailyQuoteCard.js`

- **Path:** `src/for-both/home-cards/DailyQuoteCard.js`
- **What it is:** Curated quotes from `dailyQuotes.json` (nutrition, training, discipline). Daily Quote Card Purpose: UI screen or component: Daily Quote Card.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `FilesHeaderCard.jsx`

- **Path:** `src/for-both/home-cards/FilesHeaderCard.jsx`
- **What it is:** Hero header for the Files & Notes section with gradient background and add button. Used on both client and trainer dashboards above the file gallery grid.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `FindTrainerBanner.jsx`

- **Path:** `src/for-both/home-cards/FindTrainerBanner.jsx`
- **What it is:** Hero card on home that promotes finding a trainer — tap opens marketplace search. Shown to clients who are not yet linked to a trainer.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `HomeTopBanner.jsx`

- **Path:** `src/for-both/home-cards/HomeTopBanner.jsx`
- **What it is:** Dark purple → dark orange — Today/time card icon accent. Renders gradient backgrounds and buttons.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `QuickActionCard.jsx`

- **Path:** `src/for-both/home-cards/QuickActionCard.jsx`
- **What it is:** Dark purple → dark orange (matches Today card & Training Agenda). UI labels include "View all".
- **Who uses it:** Both roles
- **Suggested name:** ___

### `SectionTitle.jsx`

- **Path:** `src/for-both/home-cards/SectionTitle.jsx`
- **What it is:** Premium uppercase section label — centered gradient type, no accent bar. Brighter pink → orange — matches workout tab header treatment.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `UpcomingSessionCard.jsx`

- **Path:** `src/for-both/home-cards/UpcomingSessionCard.jsx`
- **What it is:** Glass-style session card (matches PremiumWelcomeCard / app chrome — no rainbow frame). mode="invite" — Pass + I'm in mode="reminder" — optional View / Log Workout when onPressViewWorkout provided. Session Meeting Card Purpose: UI screen or component: Session Meeting Card.
- **Who uses it:** Both roles
- **Suggested name:** ___

## for-both/icons

<a id="for-both-icons"></a>

**Folder purpose:** Code used by both trainees and trainers (shared screens, payments, notes/files, talking to the server).

### `AICoachTabIcon.jsx`

- **Path:** `src/for-both/icons/AICoachTabIcon.jsx`
- **What it is:** Google Gemini mark — filled with the brand gradient (original nav icon). Part of `for-both/icons` — search the repo for "AICoachTabIcon" to see what imports it before renaming.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `AppLogo.jsx`

- **Path:** `src/for-both/icons/AppLogo.jsx`
- **What it is:** Renders the official Coach Connect logo (src/assets/logo/Logo.PNG). UI labels include "Coach Connect".
- **Who uses it:** Both roles
- **Suggested name:** ___

### `CalendarIcon.jsx`

- **Path:** `src/for-both/icons/CalendarIcon.jsx`
- **What it is:** Calendar Icon in `for-both/icons`. Part of `for-both/icons` — search the repo for "CalendarIcon" to see what imports it before renaming.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `ChatIcon.jsx`

- **Path:** `src/for-both/icons/ChatIcon.jsx`
- **What it is:** Gradient Chat Bubbles Icon — SVG gradient (no MaskedView). Part of `for-both/icons` — search the repo for "ChatIcon" to see what imports it before renaming.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `ColorfulIcon.jsx`

- **Path:** `src/for-both/icons/ColorfulIcon.jsx`
- **What it is:** Brand-gradient icons via react-native-svg (no MaskedView). MaskedView + icon fonts/PNGs often vanish or flicker on iOS dev builds. Part of `for-both/icons` — search the repo for "ColorfulIcon" to see what imports it before renaming.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `OutlinedColorText.jsx`

- **Path:** `src/for-both/icons/OutlinedColorText.jsx`
- **What it is:** Solid fill + purple→orange gradient stroke (SVG). Measures with hidden Text first. Brand Gradient Stroke Text Purpose: Brand Gradient Stroke Text.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `ProfileIcon.jsx`

- **Path:** `src/for-both/icons/ProfileIcon.jsx`
- **What it is:** Filled PNG icon for workout profile cards — shared by ClientAppStart and TrainerAppStart (CreateWorkoutPlanScreen) and client ViewMyMyProfileScreen rows. Profile Card Icon Purpose: UI screen or component: Profile Card Icon.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `WorkoutTabIcon.jsx`

- **Path:** `src/for-both/icons/WorkoutTabIcon.jsx`
- **What it is:** Original Ionicons + brand gradient via MaskedView (barbell tab only). Kept separate from SVG nav icons — matches the legacy workout tab look. Part of `for-both/icons` — search the repo for "WorkoutTabIcon" to see what imports it before renaming.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `iconShapes.js`

- **Path:** `src/for-both/icons/iconShapes.js`
- **What it is:** SVG paths for brand-gradient icons (24×24 viewBox). Pure SVG — no MaskedView / icon fonts — so icons stay visible in dev builds. Part of `for-both/icons` — search the repo for "iconShapes" to see what imports it before renaming.
- **Who uses it:** Both roles
- **Suggested name:** ___

## for-both/loading-and-header

<a id="for-both-loading-and-header"></a>

**Folder purpose:** Code used by both trainees and trainers (shared screens, payments, notes/files, talking to the server).

### `AppLoadingScreen.js`

- **Path:** `src/for-both/loading-and-header/AppLoadingScreen.js`
- **What it is:** AppLoadingScreen — shared full-screen loading for the entire app (client and trainer). Exact IconScout loading-bar motion (recolored preview frames, pink → orange). Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in for-both.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `BouncingDots.js`

- **Path:** `src/for-both/loading-and-header/BouncingDots.js`
- **What it is:** Animated bouncing-dots loading spinner shown while something is loading. Used as a simple “please wait” visual anywhere in the app.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `LoadingBarAnimation.jsx`

- **Path:** `src/for-both/loading-and-header/LoadingBarAnimation.jsx`
- **What it is:** IconScout-style loading bar via compact spritesheet + Reanimated (UI thread). No video — no buffer stalls / remount pauses. UI labels include "Loading".
- **Who uses it:** Both roles
- **Suggested name:** ___

### `StartupLoadingCover.js`

- **Path:** `src/for-both/loading-and-header/StartupLoadingCover.js`
- **What it is:** Boot loading lock — one overlay stays mounted for the whole cold start so the loader never remounts between App → LoginGate → ClientAppStart. Hold the boot overlay while `active` is true.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `TopHeader.js`

- **Path:** `src/for-both/loading-and-header/TopHeader.js`
- **What it is:** Matches Settings screen pill gradient (dark pink → dark orange). UI labels include "Open profile".
- **Who uses it:** Both roles
- **Suggested name:** ___

## for-both/online-connection

<a id="for-both-online-connection"></a>

**Folder purpose:** Code used by both trainees and trainers (shared screens, payments, notes/files, talking to the server).

### `attachLoginProof.js`

- **Path:** `src/for-both/online-connection/attachLoginProof.js`
- **What it is:** Builds the “who is signed in” headers so the server knows which user is calling. Used before talking to protected server routes.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `checkConnectionHealth.js`

- **Path:** `src/for-both/online-connection/checkConnectionHealth.js`
- **What it is:** Checks whether the Coach Connect server is healthy / reachable. Used for diagnostics and resilient startup.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `checkTrainerCertificate.js`

- **Path:** `src/for-both/online-connection/checkTrainerCertificate.js`
- **What it is:** Asks the server to verify a trainer’s certification documents. Part of trainer onboarding / trust checks.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `linkTrainerAndTrainee.js`

- **Path:** `src/for-both/online-connection/linkTrainerAndTrainee.js`
- **What it is:** Server helpers for linking / managing the trainer–client relationship. Used when connecting a trainee to a trainer.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `loadHomeAlerts.js`

- **Path:** `src/for-both/online-connection/loadHomeAlerts.js`
- **What it is:** Loads dashboard notification items from the server for home badges/alerts. Used by home/dashboard screens for both roles.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `sendCrashReport.js`

- **Path:** `src/for-both/online-connection/sendCrashReport.js`
- **What it is:** Sends an app error report to the Coach Connect server so developers can debug crashes. Called from error-logging helpers.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `sendOnlineRequest.js`

- **Path:** `src/for-both/online-connection/sendOnlineRequest.js`
- **What it is:** Shared helper to call the Coach Connect server with the right URL and headers. Prefer this over writing raw network calls in screens.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `sendPhoneAlert.js`

- **Path:** `src/for-both/online-connection/sendPhoneAlert.js`
- **What it is:** Asks the server to send a push notification to a user’s phone. Used for session reminders, messages, and similar alerts.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `uploadSetupAnswers.js`

- **Path:** `src/for-both/online-connection/uploadSetupAnswers.js`
- **What it is:** Uploads onboarding answers to the server after signup so the backend has the same profile. Runs after onboarding finishes or when pending sync is flushed.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `whereToConnect.js`

- **Path:** `src/for-both/online-connection/whereToConnect.js`
- **What it is:** Picks which Coach Connect server address the phone should talk to (production cloud vs your computer while developing). Almost every server request starts here.
- **Who uses it:** Both roles
- **Suggested name:** ___

## for-both/payments

<a id="for-both-payments"></a>

**Folder purpose:** Paying a trainer / Stripe Connect flows, payment history, education copy.

### `CardPaymentWrapper.jsx`

- **Path:** `src/for-both/payments/CardPaymentWrapper.jsx`
- **What it is:** Wrap the app in Stripe's provider so CardField / createToken work. Paying a trainer / Stripe Connect flows.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `HowPaymentsWorkSections.jsx`

- **Path:** `src/for-both/payments/HowPaymentsWorkSections.jsx`
- **What it is:** Reusable payment education UI — how payments work, Venmo comparison, earnings preview. Paying a trainer / Stripe Connect flows.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `PayTrainerPopup.jsx`

- **Path:** `src/for-both/payments/PayTrainerPopup.jsx`
- **What it is:** In-app card form for a client to pay their coach via Stripe (POST /api/charges). UI labels include "0.00"; paying a trainer / Stripe Connect flows.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `PayoutSetupReminderPopup.jsx`

- **Path:** `src/for-both/payments/PayoutSetupReminderPopup.jsx`
- **What it is:** Post-signup payment setup popup — shown on trainer dashboard, not during onboarding. UI labels include "Close"; paying a trainer / Stripe Connect flows.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `TrainerPayoutSetupPopup.jsx`

- **Path:** `src/for-both/payments/TrainerPayoutSetupPopup.jsx`
- **What it is:** Load Stripe Account Link URL and detect return/refresh deep links. Paying a trainer / Stripe Connect flows.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `canThisPhoneTakeCards.js`

- **Path:** `src/for-both/payments/canThisPhoneTakeCards.js`
- **What it is:** Detect whether Stripe native (CardField / useStripe) is usable in this build. UI labels include "Expo Go cannot take card payments"; paying a trainer / Stripe Connect flows.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `chargeCard.js`

- **Path:** `src/for-both/payments/chargeCard.js`
- **What it is:** Charges a trainee’s card and pays their trainer (coaching session payment). Used from payment popups — not a screen itself.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `howPaymentsWorkText.js`

- **Path:** `src/for-both/payments/howPaymentsWorkText.js`
- **What it is:** Shared payment clarity copy — trainers get 90%, platform keeps 10%. UI labels include "$450 pending"; paying a trainer / Stripe Connect flows.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `traineePaymentHistory.js`

- **Path:** `src/for-both/payments/traineePaymentHistory.js`
- **What it is:** reusable screen helper that loads a client payment history from the cloud database payments collection (by clientId), with date/status formatting for list rows. Used on the client payments/history UI when reviewing charges to a linked trainer.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `trainerPaymentHistory.js`

- **Path:** `src/for-both/payments/trainerPaymentHistory.js`
- **What it is:** reusable screen helper that loads a trainer payment history rows from the cloud database payments collection (by trainerId), formatting dates and status labels for the UI. Consumed by trainer PaymentsScreen to show completed/pending/failed payouts and charges.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `trainerPayoutSetup.js`

- **Path:** `src/for-both/payments/trainerPayoutSetup.js`
- **What it is:** Talks to the server about connecting a trainer’s Stripe payout account. Part of “trainers get paid” setup.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `trainerPayoutSetupFlow.js`

- **Path:** `src/for-both/payments/trainerPayoutSetupFlow.js`
- **What it is:** @param {{ email: string, onActive?: () => void }} options. Paying a trainer / Stripe Connect flows.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `whenToAskForPayoutSetup.js`

- **Path:** `src/for-both/payments/whenToAskForPayoutSetup.js`
- **What it is:** Payment setup popup eligibility + cloud database dismissal helpers. Uses cloud database (`users`); paying a trainer / Stripe Connect flows.
- **Who uses it:** Both roles
- **Suggested name:** ___

## for-both/photo-gallery

<a id="for-both-photo-gallery"></a>

**Folder purpose:** Progress photo gallery screen used by both roles.

### `MyProgressPhotosScreen.jsx`

- **Path:** `src/for-both/photo-gallery/MyProgressPhotosScreen.jsx`
- **What it is:** Fake pointer — re-exports the real progress photos screen. Safe to delete after imports point at the real file.
- **Who uses it:** Both roles
- **Flags:** `STUB`
- **Suggested name:** ___

## for-both/popups

<a id="for-both-popups"></a>

**Folder purpose:** Code used by both trainees and trainers (shared screens, payments, notes/files, talking to the server).

### `ErrorPopup.jsx`

- **Path:** `src/for-both/popups/ErrorPopup.jsx`
- **What it is:** CoachConnect-styled error / alert popup (gradient rim, glass inner, optional retry). Uses Ionicons names (default `alert-circle`). UI labels include "Error".
- **Who uses it:** Both roles
- **Suggested name:** ___

### `HoldToConfirmPopup.jsx`

- **Path:** `src/for-both/popups/HoldToConfirmPopup.jsx`
- **What it is:** Destructive confirmation: user must press and hold until the progress bar fills. Release early → bar resets; complete → `onHoldComplete` runs (should throw on failure). UI labels include "Confirm".
- **Who uses it:** Both roles
- **Suggested name:** ___

### `RemoveTrainerPopup.js`

- **Path:** `src/for-both/popups/RemoveTrainerPopup.js`
- **What it is:** popup that slides up for removing trainer/client relationship. Used from client Settings (Remove Trainer) and trainer ClientDetail (Remove Client). UI labels include "Tell us more (optional)".
- **Who uses it:** Both roles
- **Suggested name:** ___

## for-both/setup-icons

<a id="for-both-setup-icons"></a>

**Folder purpose:** Code used by both trainees and trainers (shared screens, payments, notes/files, talking to the server).

### `onboardingIconRegistry.generated.js`

- **Path:** `src/for-both/setup-icons/onboardingIconRegistry.generated.js`
- **What it is:** Onboarding Icon Registry.generated in `for-both/setup-icons`. Part of shared in Coach Connect.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `onboardingIconRegistry.js`

- **Path:** `src/for-both/setup-icons/onboardingIconRegistry.js`
- **What it is:** Maps onboarding option keys (e.g. 'full_gym', 'beginner') to bundled PNG icon require() paths. OnboardingWizardScreen uses getOnboardingIconSource() so icon paths live in one place.
- **Who uses it:** Both roles
- **Suggested name:** ___

## for-both/setup-steps

<a id="for-both-setup-steps"></a>

**Folder purpose:** Code used by both trainees and trainers (shared screens, payments, notes/files, talking to the server).

### `AIPermissionStep.jsx`

- **Path:** `src/for-both/setup-steps/AIPermissionStep.jsx`
- **What it is:** Requests and checks device permissions (AIPermission Step) using Expo Camera, Audio, and ImagePicker APIs. UI labels include "AI Fitness Coach".
- **Who uses it:** Both roles
- **Suggested name:** ___

### `TrainerProOfferStep.jsx`

- **Path:** `src/for-both/setup-steps/TrainerProOfferStep.jsx`
- **What it is:** FitFlow paywall gradient: orange → pink → magenta. UI labels include "Unlimited clients".
- **Who uses it:** Both roles
- **Suggested name:** ___

### `setupColors.js`

- **Path:** `src/for-both/setup-steps/setupColors.js`
- **What it is:** Onboarding color reportColors — literal values from food-cards/foodCardColors.js. Kept in a dependency-free module so onboarding screens never crash on import order. Pill background: 135° gradient at low opacity (matches food-card MacroPill).
- **Who uses it:** Both roles
- **Suggested name:** ___

### `setupStepPieces.jsx`

- **Path:** `src/for-both/setup-steps/setupStepPieces.jsx`
- **What it is:** Food-card style icon well — thin gradient accent + soft pill fill. UI labels include "rgba(255,255,255,0.35)".
- **Who uses it:** Both roles
- **Suggested name:** ___

## for-both/trainer-listing

<a id="for-both-trainer-listing"></a>

**Folder purpose:** Code used by both trainees and trainers (shared screens, payments, notes/files, talking to the server).

### `keepTrainerListingUpdated.js`

- **Path:** `src/for-both/trainer-listing/keepTrainerListingUpdated.js`
- **What it is:** Keeps trainers/{uid} (marketplace / Find Trainers) in sync with users/{uid} (profile + onboarding). Clients read trainers/* — not users/* — so profile edits must mirror here. Uses cloud database (`users`).
- **Who uses it:** Both roles
- **Suggested name:** ___

## for-both/weekly-report

<a id="for-both-weekly-report"></a>

**Folder purpose:** Weekly progress report screen shared by client and trainer views.

### `ColorBorder.jsx`

- **Path:** `src/for-both/weekly-report/ColorBorder.jsx`
- **What it is:** Color Border — renders gradient backgrounds and buttons. Part of `for-both/weekly-report` — search the repo for "ColorBorder" to see what imports it before renaming.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `ColorButton.jsx`

- **Path:** `src/for-both/weekly-report/ColorButton.jsx`
- **What it is:** Color Button — renders gradient backgrounds and buttons. Part of `for-both/weekly-report` — search the repo for "ColorButton" to see what imports it before renaming.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `DayCard.jsx`

- **Path:** `src/for-both/weekly-report/DayCard.jsx`
- **What it is:** Day Card — renders gradient backgrounds and buttons. UI labels include "WORKOUT".
- **Who uses it:** Both roles
- **Suggested name:** ___

### `NoReportYet.jsx`

- **Path:** `src/for-both/weekly-report/NoReportYet.jsx`
- **What it is:** No Report Yet — renders gradient backgrounds and buttons. Part of `for-both/weekly-report` — search the repo for "NoReportYet" to see what imports it before renaming.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `ReportOptionsPopup.jsx`

- **Path:** `src/for-both/weekly-report/ReportOptionsPopup.jsx`
- **What it is:** Report Options Popup in `for-both/weekly-report`. UI labels include "Export PDF".
- **Who uses it:** Both roles
- **Suggested name:** ___

### `StatCard.jsx`

- **Path:** `src/for-both/weekly-report/StatCard.jsx`
- **What it is:** Stat Card — renders gradient backgrounds and buttons. Part of `for-both/weekly-report` — search the repo for "StatCard" to see what imports it before renaming.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `StatIcon.jsx`

- **Path:** `src/for-both/weekly-report/StatIcon.jsx`
- **What it is:** Extra metric visuals for nutrition macros (app PNG assets). Gradient ring + custom PNG — same treatment as home / premium report.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `TipRow.jsx`

- **Path:** `src/for-both/weekly-report/TipRow.jsx`
- **What it is:** Tip Row — renders gradient backgrounds and buttons. Part of `for-both/weekly-report` — search the repo for "TipRow" to see what imports it before renaming.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `TrainerTipsForWeek.jsx`

- **Path:** `src/for-both/weekly-report/TrainerTipsForWeek.jsx`
- **What it is:** Trainer Tips For Week — renders gradient backgrounds and buttons. Part of `for-both/weekly-report` — search the repo for "TrainerTipsForWeek" to see what imports it before renaming.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `WeekPicker.jsx`

- **Path:** `src/for-both/weekly-report/WeekPicker.jsx`
- **What it is:** Week Picker in `for-both/weekly-report`. UI labels include "Go back".
- **Who uses it:** Both roles
- **Suggested name:** ___

### `WeeklyChart.jsx`

- **Path:** `src/for-both/weekly-report/WeeklyChart.jsx`
- **What it is:** @param {object} props @param {object[]} props.days @param {string} props.metricKey — day field to plot (e.g. sleepHours, steps, calories) @param {string} props.title — chart header title @param {string} props.legend — legend label @param {string} props.valueSuffix — tooltip suffix (h, cal, etc.) @param {number} [props.maxValue] — Y-axis max; auto if omitted. UI labels include "This week".
- **Who uses it:** Both roles
- **Suggested name:** ___

### `WeeklyReportBody.jsx`

- **Path:** `src/for-both/weekly-report/WeeklyReportBody.jsx`
- **What it is:** Weekly report scroll body — poop-main.zip layout + real cloud database data. UI labels include "Avg Sleep".
- **Who uses it:** Both roles
- **Suggested name:** ___

### `WeeklyReportScreen.jsx`

- **Path:** `src/for-both/weekly-report/WeeklyReportScreen.jsx`
- **What it is:** Fake pointer — re-exports the real weekly progress report screen. Safe to delete after imports point at the real file.
- **Who uses it:** Both roles
- **Flags:** `STUB`
- **Suggested name:** ___

### `WinsAndWorkOnsSection.jsx`

- **Path:** `src/for-both/weekly-report/WinsAndWorkOnsSection.jsx`
- **What it is:** Wins And Work Ons Section — renders gradient backgrounds and buttons. Part of `for-both/weekly-report` — search the repo for "WinsAndWorkOnsSection" to see what imports it before renaming.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `loadWeekDailyEntries.js`

- **Path:** `src/for-both/weekly-report/loadWeekDailyEntries.js`
- **What it is:** Fetch users/{uid}/dailyLogs for each day in a week range. @returns {Promise<Record<string, object>>}. Uses cloud database (`users`).
- **Who uses it:** Both roles
- **Suggested name:** ___

### `loadWeekFoodTotals.js`

- **Path:** `src/for-both/weekly-report/loadWeekFoodTotals.js`
- **What it is:** Fetch nutrition totals keyed by YYYY-MM-DD for a client across a date range. @returns {Promise<Record<string, { calories: number, protein: number, carbs: number, fat: number }>>}. Uses cloud database (`users`).
- **Who uses it:** Both roles
- **Suggested name:** ___

### `pickBestTips.js`

- **Path:** `src/for-both/weekly-report/pickBestTips.js`
- **What it is:** Drop filler coaching copy; keep the most specific, useful lines only. Part of `for-both/weekly-report` — search the repo for "pickBestTips" to see what imports it before renaming.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `prepareReportForScreen.js`

- **Path:** `src/for-both/weekly-report/prepareReportForScreen.js`
- **What it is:** Fallback when structured parser misses inline Workout: chunks. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in for-both.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `reportColorSettings.jsx`

- **Path:** `src/for-both/weekly-report/reportColorSettings.jsx`
- **What it is:** Report Color Settings — caches data locally on the device between app launches. Part of `for-both/weekly-report` — search the repo for "reportColorSettings" to see what imports it before renaming.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `reportColors.js`

- **Path:** `src/for-both/weekly-report/reportColors.js`
- **What it is:** Design reportColors — matches poop-main.zip reference exactly. Part of `for-both/weekly-report` — search the repo for "reportColors" to see what imports it before renaming.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `writeTrainerTips.js`

- **Path:** `src/for-both/weekly-report/writeTrainerTips.js`
- **What it is:** Write Trainer Tips in `for-both/weekly-report`. UI labels include "${completed} training day${completed === 1 ? ".
- **Who uses it:** Both roles
- **Suggested name:** ___

## for-both/workout-plans

<a id="for-both-workout-plans"></a>

**Folder purpose:** Browse saved workout plans (shared implementation).

### `SavedWorkoutsScreen.jsx`

- **Path:** `src/for-both/workout-plans/SavedWorkoutsScreen.jsx`
- **What it is:** Fake pointer — re-exports the real browse-saved-workouts screen. Safe to delete after imports point at the real file.
- **Who uses it:** Both roles
- **Flags:** `STUB`
- **Suggested name:** ___

## helpers

<a id="helpers"></a>

**Folder purpose:** Tiny shared helpers (today’s date key, height conversion, clean data for the database, file type).

### `cleanDataBeforeSaving.js`

- **Path:** `src/helpers/cleanDataBeforeSaving.js`
- **What it is:** Recursively strip `undefined` values from an object (or array) so it is safe to write to cloud database. @template T @param {T} input @returns {T}. Part of `helpers` — search the repo for "cleanDataBeforeSaving" to see what imports it before renaming.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `combineTraineeProfile.js`

- **Path:** `src/helpers/combineTraineeProfile.js`
- **What it is:** @param {object} crmRow — trainer_clients/{trainerId}/clients/{clientId} @param {object} userData — users/{clientId}. Part of `helpers` — search the repo for "combineTraineeProfile" to see what imports it before renaming.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `convertHeight.js`

- **Path:** `src/helpers/convertHeight.js`
- **What it is:** Normalize first, then keep digits + foot/inch marks only. Parse height while typing. Returns the sanitized draft as `text` so ' and " stay visible. @returns {{ text: string, height: { feet: number, inches: number } | null }}.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `dateStrings.js`

- **Path:** `src/helpers/dateStrings.js`
- **What it is:** Client-facing "today" (device timezone). Prefer this for dailyLogs / daily_tracking. Trainer / weekly-summary boundary (Eastern Time). @param {string} [timeZone] IANA timezone.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `fileSizeAndDateText.js`

- **Path:** `src/helpers/fileSizeAndDateText.js`
- **What it is:** Formats byte sizes (KB/MB), short dates, and friendly filenames for the files gallery. Also detects auto-generated upload names so the UI can show cleaner labels.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `fillTraineeProfile.js`

- **Path:** `src/helpers/fillTraineeProfile.js`
- **What it is:** Map legacy / alternate onboarding keys to what the profile UI expects. Merge profile sources left-to-right; later non-empty values win (cloud database over cache). @param {...(object|null|undefined)} sources.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `getLocalDay.js`

- **Path:** `src/helpers/getLocalDay.js`
- **What it is:** @returns {string} YYYY-MM-DD in the device's local timezone. @returns {string} YYYY-MM-DD in the device's local timezone.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `sessionTimeText.js`

- **Path:** `src/helpers/sessionTimeText.js`
- **What it is:** Date/time formatting helpers for trainer session scheduling (pad2, long date, 12-hour time). Used by session cards and calendar views to display human-readable session times.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `showSetupAnswers.js`

- **Path:** `src/helpers/showSetupAnswers.js`
- **What it is:** @param {string|string[]|number|null|undefined} raw @param {string} [emptyFallback='—']. Part of `helpers` — search the repo for "showSetupAnswers" to see what imports it before renaming.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `trainerProfilePhoto.js`

- **Path:** `src/helpers/trainerProfilePhoto.js`
- **What it is:** Resolve a usable profile image URL from trainer / user shapes used across the app. Prefers explicit top-level fields, then common nested marketplace/profile objects. Clients often cannot read users/{trainerId}; photos may only exist in Storage at profile_photos/{uid} (public read). If the doc has no usable URL, try Storage once.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `whichViewerForFile.js`

- **Path:** `src/helpers/whichViewerForFile.js`
- **What it is:** Stable dedupe key for notes_and_files items (avoids Timestamp collisions). First fullscreen WebView URI for generic docs (Office → Google). PDFs should use PdfViewer with raw URL.
- **Who uses it:** Both roles
- **Suggested name:** ___

### `workoutDayNames.js`

- **Path:** `src/helpers/workoutDayNames.js`
- **What it is:** Single-word splits some clients use instead of "X day". Single-word splits some clients use instead of "X day".
- **Who uses it:** Both roles
- **Suggested name:** ___

## login-and-signup

<a id="login-and-signup"></a>

**Folder purpose:** Source files for the `login-and-signup` module.

### `ForgotPasswordFlow.js`

- **Path:** `src/login-and-signup/ForgotPasswordFlow.js`
- **What it is:** Forgot Password Flow — renders gradient backgrounds and buttons. UI labels include "Go back".
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `LoginScreen.js`

- **Path:** `src/login-and-signup/LoginScreen.js`
- **What it is:** The signed-out welcome / login / signup screen (pick trainee vs trainer, create account, sign in). Shown by AuthGate when nobody is signed in.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `NewUserSetupScreen.jsx`

- **Path:** `src/login-and-signup/NewUserSetupScreen.jsx`
- **What it is:** NewUserSetupScreen - Combined onboarding flow for clients and trainers Handles all 6 onboarding steps for both client and trainer roles with Apple-style subtle gradients throughout. Reads or writes Firebase cloud database documents; requests camera access for barcode or photo capture; renders Lottie animations in the UI.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `SetupPreviewScreen.jsx`

- **Path:** `src/login-and-signup/SetupPreviewScreen.jsx`
- **What it is:** Setup Preview Screen — full-screen phone app view in `login-and-signup`. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in login-and-signup.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `SetupScreenshotTool.jsx`

- **Path:** `src/login-and-signup/SetupScreenshotTool.jsx`
- **What it is:** Setup Screenshot Tool in `login-and-signup`. Part of `login-and-signup` — search the repo for "SetupScreenshotTool" to see what imports it before renaming.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `TrainerPayoutSetupStep.jsx`

- **Path:** `src/login-and-signup/TrainerPayoutSetupStep.jsx`
- **What it is:** Optional bank setup during trainer signup so coaches can receive client payments. UI labels include "Connect with Stripe".
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `checkTrainerCode.js`

- **Path:** `src/login-and-signup/checkTrainerCode.js`
- **What it is:** Used by NewUserSetupScreen's trainer-code step; every setter is injected so unit tests can assert without React. Returns null = "not a valid code", which the caller treats as a cellFormatting error without a network call.. Hits API routes /api/onboarding/validate-trainer-code.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `cleanUpRoleName.js`

- **Path:** `src/login-and-signup/cleanUpRoleName.js`
- **What it is:** Normalizes whether the user chose client or trainer during onboarding into values AuthGate expects. Prevents role string mismatches ('Client' vs 'client') from routing to the wrong app shell.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `decideTraineeOrTrainer.js`

- **Path:** `src/login-and-signup/decideTraineeOrTrainer.js`
- **What it is:** Helper functions for AuthGate: normalizeAppRole, profileNeedsOnboarding, isLikelyNewFirebaseUser. Exported for unit tests in authGate.test.js — not UI, just boolean routing decisions.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `finishSetup.js`

- **Path:** `src/login-and-signup/finishSetup.js`
- **What it is:** Called by NewUserSetupScreen's finish handler; LoginGate reads the leftover "pending" flag to retry a failed server sync on next launch. the shape without mocking cloud database.. Hits API routes /api/onboarding/complete; uses cloud database (`users`).
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `resetPasswordByEmail.js`

- **Path:** `src/login-and-signup/resetPasswordByEmail.js`
- **What it is:** Thin wrapper that triggers password-reset email via Firebase or the backend API. Called from ForgotPasswordFlow screens when the user submits their email.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `setupScreenshotList.json`

- **Path:** `src/login-and-signup/setupScreenshotList.json`
- **What it is:** Lottie animation "setup Screenshot List" — plays during onboarding steps, loading states, or empty-state illustrations. Imported via `lottie-react-native` or the onboarding icon registry in `login-and-signup`.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `signOutCleanupSteps.js`

- **Path:** `src/login-and-signup/signOutCleanupSteps.js`
- **What it is:** Deps = injected helpers ({ clearPushTokensForUid, clearAllUserData }) so this stays testable and import-free.. Part of `login-and-signup` — search the repo for "signOutCleanupSteps" to see what imports it before renaming.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

## logout-cleanup

<a id="logout-cleanup"></a>

**Folder purpose:** Wipes local saved data when the user logs out.

### `clearDataOnLogout.js`

- **Path:** `src/logout-cleanup/clearDataOnLogout.js`
- **What it is:** Wipes local saved data (caches, tokens, coach chat leftovers) when the user logs out. Called from the login gate on sign-out so the next person on the phone does not see old data.
- **Who uses it:** Shared / cross-app
- **Flags:** `STUB`
- **Suggested name:** ___

## look-and-feel

<a id="look-and-feel"></a>

**Folder purpose:** Source files for the `look-and-feel` module.

### `BlurredBackground.jsx`

- **Path:** `src/look-and-feel/BlurredBackground.jsx`
- **What it is:** Pull padding off the outer shell so blur/backdrop fill edge-to-edge (padding only insets content). Blur Backdrop Plate Purpose: Blur Backdrop Plate.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `ColorText.jsx`

- **Path:** `src/look-and-feel/ColorText.jsx`
- **What it is:** Gradient text via react-native-svg (no MaskedView). Shows a solid fallback immediately, then swaps to SVG gradient once measured — avoids blank/flickering text/icons common with MaskedView in dev builds. Part of `look-and-feel` — search the repo for "ColorText" to see what imports it before renaming.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `GlassBackgroundDark.jsx`

- **Path:** `src/look-and-feel/GlassBackgroundDark.jsx`
- **What it is:** Deep obsidian base with 3 mesh-like radial blurs in the corners. Lightweight (single SVG) + works on iOS/Android/Web. Liquid Background Purpose: Liquid Background.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `GlassBackgroundLight.jsx`

- **Path:** `src/look-and-feel/GlassBackgroundLight.jsx`
- **What it is:** Light-mode mesh background: soft paper base with subtle pastel corner blurs. Designed to sit behind frosted-glass materials. Liquid Background Light Purpose: Liquid Background Light.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `GlassButton.jsx`

- **Path:** `src/look-and-feel/GlassButton.jsx`
- **What it is:** Glass Button — renders gradient backgrounds and buttons. Part of shared in Coach Connect.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `GlassCard.jsx`

- **Path:** `src/look-and-feel/GlassCard.jsx`
- **What it is:** Custom "glass material": - background blur ~30 - semi-transparent surface - linear border brighter at top, fading to bottom - squircle geometry (continuous curve on iOS). Liquid Glass Card Purpose: UI screen or component: Liquid Glass Card.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `GlassPanel.jsx`

- **Path:** `src/look-and-feel/GlassPanel.jsx`
- **What it is:** GlassPanel - True Liquid Glass Effect Component for phone app Creates Apple iOS 26-style liquid glass effect using advanced styling Mimics refraction, light scattering, and soft glass tint Optimized for performance with memoization and reduced re-renders. Fluid Glass Purpose: Fluid Glass.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `LabeledRow.jsx`

- **Path:** `src/look-and-feel/LabeledRow.jsx`
- **What it is:** Section label row: uppercase label + thin divider (web ScheduleSessionScreen pattern). Vertical section wrapper with optional bottom spacing.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `TwoColumnGrid.jsx`

- **Path:** `src/look-and-feel/TwoColumnGrid.jsx`
- **What it is:** Simple two-column grid for micronutrient rows and similar compact lists. Centered Two Column Grid Purpose: Centered Two Column Grid.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `brandColors.js`

- **Path:** `src/look-and-feel/brandColors.js`
- **What it is:** Brand gradient aligned with cg logo (pink → purple → indigo), top → bottom. Brand Gradients Purpose: brand Gradients.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `colorPalette.js`

- **Path:** `src/look-and-feel/colorPalette.js`
- **What it is:** Light mode colors (Modern Neutral theme) Dark mode colors (Modern Neutral theme). Part of shared in Coach Connect.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `glassSettings.js`

- **Path:** `src/look-and-feel/glassSettings.js`
- **What it is:** Glass Settings in `look-and-feel`. Part of shared in Coach Connect.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `homeStatColors.js`

- **Path:** `src/look-and-feel/homeStatColors.js`
- **What it is:** Gradient color arrays for home stat pills (workout, water, sleep, soreness, etc.). PremiumStatsSection and dashboard cards import these for consistent stat card styling.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `lightDarkMode.js`

- **Path:** `src/look-and-feel/lightDarkMode.js`
- **What it is:** shared app setting for light/dark theme — ThemeProvider wraps the app, useTheme() reads colors in screens. Drives text/background colors across Coach Connect without hardcoding hex values in every file.
- **Who uses it:** Shared / cross-app
- **Flags:** `STUB`
- **Suggested name:** ___

## messaging

<a id="messaging"></a>

**Folder purpose:** Conversations list and chat thread screens shared by client and trainer roles.

### `ChatScreen.jsx`

- **Path:** `src/messaging/ChatScreen.jsx`
- **What it is:** Trainer Messaging (Chat) Screen — new glass UI, existing Firebase and send flow. Real-time via subscribeToMessages; send via trainerMessaging.sendMessage. Reads or writes Firebase cloud database documents; lets the user pick photos from the camera roll; renders gradient backgrounds and buttons.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `InboxScreen.jsx`

- **Path:** `src/messaging/InboxScreen.jsx`
- **What it is:** Conversations List Screen — new glass UI, existing Firebase and navigation. Real-time via subscribeToConversations; account isolation via participants + trainer clients filter. Reads or writes Firebase cloud database documents; renders gradient backgrounds and buttons.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `markMessagesRead.js`

- **Path:** `src/messaging/markMessagesRead.js`
- **What it is:** Marks all unread trainer/client messages as read in cloud database when the user opens the inbox. Prevents stale unread badges after the user views their conversations.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `unreadMessageCounts.js`

- **Path:** `src/messaging/unreadMessageCounts.js`
- **What it is:** Denormalized unread message counts — single listener on users/{uid}/unreadCount/index. Subscribes to real-time cloud database updates; uses cloud database (`users`).
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

## navigation

<a id="navigation"></a>

**Folder purpose:** Cross-app navigation utilities (shell navigate helper, route names, AppNavigationContext).

### `BottomMenuBar.js`

- **Path:** `src/navigation/BottomMenuBar.js`
- **What it is:** Pink dot on Workout tab when a background-generated plan is ready. Caches data locally on the device between app launches.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `bottomMenuSpacing.js`

- **Path:** `src/navigation/bottomMenuSpacing.js`
- **What it is:** Used by client/trainer shells and any long-scroll screen that sits under the bottom nav. bottom padding will be wrong (content tucked under the bar, or a floating gap above it).. Part of `navigation` — search the repo for "bottomMenuSpacing" to see what imports it before renaming.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `goToScreenByKeyword.js`

- **Path:** `src/navigation/goToScreenByKeyword.js`
- **What it is:** Used by shared screens/components that are reused in both shells and can't rely on a navigation prop being passed in. booleans/state inside the shell, which is why this maps keywords to shell methods instead of route names.. Part of `navigation` — search the repo for "goToScreenByKeyword" to see what imports it before renaming.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `openScreenFromAnywhere.js`

- **Path:** `src/navigation/openScreenFromAnywhere.js`
- **What it is:** Global React Navigation ref so code outside components can navigate (rootNavigate, goBack, reset). Used by push notifications and deep links that need to open a specific screen.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `screenNames.js`

- **Path:** `src/navigation/screenNames.js`
- **What it is:** Used everywhere we navigate, so nobody has to hand-type a route string and typo it silently.. Part of `navigation` — search the repo for "screenNames" to see what imports it before renaming.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `webLinks.js`

- **Path:** `src/navigation/webLinks.js`
- **What it is:** Handed to NavigationContainer's `webLinks` prop by the client and trainer shells. Currently a stub — universal (https) links aren't wired yet. Manipulate here: add an https:// prefix here once universal/app links are set up on the domain.. Part of `navigation` — search the repo for "webLinks" to see what imports it before renaming.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `whichScreenIsOpen.js`

- **Path:** `src/navigation/whichScreenIsOpen.js`
- **What it is:** Exists so the shared chrome doesn't need a dozen callback props threaded down through every screen. `...handlers` collects all remaining props, so a shell just spreads the callbacks it supports.. Part of `navigation` — search the repo for "whichScreenIsOpen" to see what imports it before renaming.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

## notifications

<a id="notifications"></a>

**Folder purpose:** Push notification text formatting and cloud database notification management.

### `manageAlerts.js`

- **Path:** `src/notifications/manageAlerts.js`
- **What it is:** @type {((data: Record<string, unknown>) => void) | null}. Caches data locally on the device between app launches; uses cloud database (`users`).
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `removeEmojiFromAlerts.js`

- **Path:** `src/notifications/removeEmojiFromAlerts.js`
- **What it is:** Character budget. Keep this in sync with server/removeEmojiFromAlerts.js.. Part of `notifications` — search the repo for "removeEmojiFromAlerts" to see what imports it before renaming.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `unreadAlertCount.js`

- **Path:** `src/notifications/unreadAlertCount.js`
- **What it is:** Unread Alert Count in `notifications`. Part of `notifications` — search the repo for "unreadAlertCount" to see what imports it before renaming.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `writeAlertText.js`

- **Path:** `src/notifications/writeAlertText.js`
- **What it is:** DetailLine e.g. "Session scheduled: Mon at 3:00 PM". Part of `notifications` — search the repo for "writeAlertText" to see what imports it before renaming.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

## nutrition

<a id="nutrition"></a>

**Folder purpose:** Full nutrition feature: daily log, food search, barcode, facts, settings, premium food cards.

### `nutritionColors.js`

- **Path:** `src/nutrition/nutritionColors.js`
- **What it is:** Color gradients and tokens for nutrition UI (calorie ring, macro bars, action buttons). Import NUT_* constants so food cards and the daily log share the same visual language.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

## nutrition/barcode

<a id="nutrition-barcode"></a>

**Folder purpose:** Barcode scanner flow and Serper/USDA lookup for packaged foods.

### `BarcodeScannerScreen.js`

- **Path:** `src/nutrition/barcode/BarcodeScannerScreen.js`
- **What it is:** Barcode viewfinder corners — dark pink / dark orange. Uses the device camera to scan product barcodes; requests camera access for barcode or photo capture; renders gradient backgrounds and buttons.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `fixBarcodeDigits.js`

- **Path:** `src/nutrition/barcode/fixBarcodeDigits.js`
- **What it is:** Fixes barcode digits from the camera (leading zeros, UPC-A vs EAN-13) before server lookup. Mobile scanners often drop check digits; this prevents false 'product not found' results.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `rejectBadBarcodeResults.js`

- **Path:** `src/nutrition/barcode/rejectBadBarcodeResults.js`
- **What it is:** Reject junk barcode hits (GS1 tracker pages, zero-macro Serper guesses, etc.) Shared by client scanner + server /api/food/barcode. @returns {boolean} true when safe to show on Confirm & log.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `scannedProductSummary.js`

- **Path:** `src/nutrition/barcode/scannedProductSummary.js`
- **What it is:** Formats scanned barcode results for display: macro summary, source label, and confidence badge. Used after a successful barcode lookup to show what the user scanned before they log it.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

## nutrition/daily-log

<a id="nutrition-daily-log"></a>

**Folder purpose:** Daily nutrition log screen, meal cards, cloud database write helpers.

### `DailyFoodLogScreen.jsx`

- **Path:** `src/nutrition/daily-log/DailyFoodLogScreen.jsx`
- **What it is:** Meal card actions — brand gradients (dark orange → pink / purple / gold). Renders Lottie animations in the UI; renders gradient backgrounds and buttons.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `DailyLogContent.jsx`

- **Path:** `src/nutrition/daily-log/DailyLogContent.jsx`
- **What it is:** Parent tab bar overlays content (e.g. ClientMainScreen absolute BottomMenuBar). Uses the device camera to scan product barcodes; subscribes to real-time cloud database updates; UI labels include "Protein".
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `DayPicker.jsx`

- **Path:** `src/nutrition/daily-log/DayPicker.jsx`
- **What it is:** Week calendar — circular day buttons with prev/next week navigation. Nutrition Day Picker Purpose: Nutrition Day Picker.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `MacroBar.js`

- **Path:** `src/nutrition/daily-log/MacroBar.js`
- **What it is:** Macro Bar in `nutrition/daily-log`. Part of nutrition in Coach Connect.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `MealCard.js`

- **Path:** `src/nutrition/daily-log/MealCard.js`
- **What it is:** Meal Card — renders gradient backgrounds and buttons. Part of nutrition in Coach Connect.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `saveLoggedFood.js`

- **Path:** `src/nutrition/daily-log/saveLoggedFood.js`
- **What it is:** Peel nested metadata.metadata… layers and drop undefined before cloud database writes. Caches data locally on the device between app launches; uses cloud database (`users`).
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

## nutrition/food-cards

<a id="nutrition-food-cards"></a>

**Folder purpose:** Full nutrition feature: daily log, food search, barcode, facts, settings, premium food cards.

### `ColorFieldFrame.jsx`

- **Path:** `src/nutrition/food-cards/ColorFieldFrame.jsx`
- **What it is:** Soft violet→mauve→steel border (matches FoodSearchScreen, not harsh rainbow). Gradient Field Frame Purpose: Gradient Field Frame.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `ColorText.jsx`

- **Path:** `src/nutrition/food-cards/ColorText.jsx`
- **What it is:** Renders gradient-colored text using MaskedView (phone app has no CSS background-clip). Used on premium food cards for stylized calorie/macro numbers.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `FoodCard.jsx`

- **Path:** `src/nutrition/food-cards/FoodCard.jsx`
- **What it is:** Premium expandable food logging card. UI labels include "Edit food".
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `FoodListScreen.jsx`

- **Path:** `src/nutrition/food-cards/FoodListScreen.jsx`
- **What it is:** Premium nutrition list screen — FlatList of FoodCards with sticky-style header. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in nutrition.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `LoggedFoodRow.jsx`

- **Path:** `src/nutrition/food-cards/LoggedFoodRow.jsx`
- **What it is:** Single logged-food row in the daily meal list — transparent card over the meal section background. Shows food name, serving, calories, and tap-to-edit; used inside NutritionContainer meal cards.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `NutritionFactsPanel.jsx`

- **Path:** `src/nutrition/food-cards/NutritionFactsPanel.jsx`
- **What it is:** Premium expanded nutrition breakdown — macro split + stylized facts panel. UI labels include "Fiber".
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `foodCardColors.js`

- **Path:** `src/nutrition/food-cards/foodCardColors.js`
- **What it is:** Premium food card design reportColors — Coach Connect macro palette. Macro mapping — full stops for accents (dots, thin bars).
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `foodCardText.js`

- **Path:** `src/nutrition/food-cards/foodCardText.js`
- **What it is:** Maps a logged food entry (cloud database / meal list) to premium FoodCard shape. UI labels include "Chobani · 1 bowl · 320g".
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

## nutrition/food-details

<a id="nutrition-food-details"></a>

**Folder purpose:** Food detail / nutrition facts screen, serving editor, label parsing.

### `EditServingPopup.jsx`

- **Path:** `src/nutrition/food-details/EditServingPopup.jsx`
- **What it is:** Slim “Edit serving” dialog for a food log — gradient accents, compact fields. UI labels include "Quantity (servings)".
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `FoodItem.js`

- **Path:** `src/nutrition/food-details/FoodItem.js`
- **What it is:** Food Item — renders gradient backgrounds and buttons. Part of nutrition in Coach Connect.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `NutritionFactsScreen.jsx`

- **Path:** `src/nutrition/food-details/NutritionFactsScreen.jsx`
- **What it is:** Muted accents — Nutrition Facts screen only (do not change global theme). Renders gradient backgrounds and buttons.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `fixPackageAmounts.js`

- **Path:** `src/nutrition/food-details/fixPackageAmounts.js`
- **What it is:** Nutrition portion normalization for Open Food Facts and other sources. Parses product.quantity (e.g. "500 ml", "16.9 fl oz", "340 g") and computes default serving amount + total calories so full packages (e.g. Pepsi bottle) log correctly. Nutrition Normalization Purpose: nutrition Normalization.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `nutritionFactsData.js`

- **Path:** `src/nutrition/food-details/nutritionFactsData.js`
- **What it is:** Build a full nutrition-facts view model from a logged food entry. UI labels include "Calories".
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `servingSizeMath.js`

- **Path:** `src/nutrition/food-details/servingSizeMath.js`
- **What it is:** Shared serving / gram math for barcode and per-100g food sources. calories and macros on openfoodfacts + usda barcode hits are per 100 g (or 100 ml). Serving Math Purpose: serving Math.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `tidyBrandName.js`

- **Path:** `src/nutrition/food-details/tidyBrandName.js`
- **What it is:** Consumer-facing brands that should win over parent-company prefixes in titles. Food Brand Display Purpose: Serving size editor and nutrition facts detail views. Food Brand Display supports the `nutrition/food-details` feature area — helpers, parsers, or UI pieces used by nearby files. Logic module with exports: see file for exports. Check who imports this file before refactoring. Area: nutrition/food-details.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

## nutrition/food-search

<a id="nutrition-food-search"></a>

**Folder purpose:** Food search screen, ranking, consensus search, confirm-selection sheet.

### `ConfirmFoodPopup.jsx`

- **Path:** `src/nutrition/food-search/ConfirmFoodPopup.jsx`
- **What it is:** Food Confirm Sheet — Weber-style premium Confirm & log UI (barcode + search). UI labels include "Servings"; search food → pick one → log to today’s meals.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `FoodSearchScreen.js`

- **Path:** `src/nutrition/food-search/FoodSearchScreen.js`
- **What it is:** Screen to search for foods, see results, and start logging a meal. Part of search → pick food → add to today’s log.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `SearchDisclaimerCard.jsx`

- **Path:** `src/nutrition/food-search/SearchDisclaimerCard.jsx`
- **What it is:** Hero disclaimer for food search — matches TopBannerCard / marketplace heroes. Always fully expanded on open (no collapse / expand dance). UI labels include "Calories"; search food → pick one → log to today’s meals.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `cleanSearchText.js`

- **Path:** `src/nutrition/food-search/cleanSearchText.js`
- **What it is:** Shared food normalization + serving unit guards for search, barcode, and logging. Search food → pick one → log to today’s meals.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `combineFoodSources.js`

- **Path:** `src/nutrition/food-search/combineFoodSources.js`
- **What it is:** Client helpers for POST /api/nutrition/search — multi-source consensus rows. UI labels include "McDonald"; search food → pick one → log to today’s meals.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `guessServingLabel.js`

- **Path:** `src/nutrition/food-search/guessServingLabel.js`
- **What it is:** Infers human-readable serving labels for food search cards across sources using food-family allowlists and a cross-family conflict matrix so junk units (nugget/wing/piece) do not attach to bread/pizza/burger-style foods. Pure ranking/label helper imported by food search/confirm UI — safe rename target if you update imports.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `knownRestaurantFoods.js`

- **Path:** `src/nutrition/food-search/knownRestaurantFoods.js`
- **What it is:** Trusted curated catalog for high-traffic restaurant searches. Used as an authoritative first hit so Serper junk cannot crowd out famous items. Macros sourced from public chain nutrition pages / FastFoodNutrition (approx 2024–2026). Ranges are intentional — restaurant formulaCalculators change; we store a representative serving. UI labels include "1 bottle (20 fl oz)"; search food → pick one → log to today’s meals.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `rankFoodResults.js`

- **Path:** `src/nutrition/food-search/rankFoodResults.js`
- **What it is:** Category / size words titles often omit — still used for ranking, not hard-required. Search food → pick one → log to today’s meals.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `readableFoodTitle.js`

- **Path:** `src/nutrition/food-search/readableFoodTitle.js`
- **What it is:** Canonical food display names — one pipeline for search, confirm, log, and read-back. Search food → pick one → log to today’s meals.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `restaurantMenuSearch.js`

- **Path:** `src/nutrition/food-search/restaurantMenuSearch.js`
- **What it is:** Casual restaurant search — users type short queries like: "mcdonalds big mac", "chick fil a sandwich", "chipotle chicken bowl", "dominos large pepperoni slice", "starbucks grande latte" Server-side only: enriches Serper + ranking. The user's typed query is unchanged in UI. UI labels include "McDonald"; search food → pick one → log to today’s meals.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `searchFoods.js`

- **Path:** `src/nutrition/food-search/searchFoods.js`
- **What it is:** Runs food search against the app’s food sources and returns ranked matches. The food search screen calls this instead of talking to food databases directly.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `tidyFoodTitles.js`

- **Path:** `src/nutrition/food-search/tidyFoodTitles.js`
- **What it is:** Clean web-search (Serper) titles for food cards — never show [PDF] / "Nutrition IncellFormattingion". Search food → pick one → log to today’s meals.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `trustRestaurantResult.js`

- **Path:** `src/nutrition/food-search/trustRestaurantResult.js`
- **What it is:** Generic Serper quality for restaurant / menu-item searches (no per-chain hardcoding). Used by server nutritionSearchHelpers + food search ranking. Search food → pick one → log to today’s meals.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

## nutrition/quick-add

<a id="nutrition-quick-add"></a>

**Folder purpose:** Quick-add macros without full food search.

### `QuickAddNutrition.jsx`

- **Path:** `src/nutrition/quick-add/QuickAddNutrition.jsx`
- **What it is:** * Quick Add Nutrition * * Purpose: UI screen or component: Quick Add Nutrition. * Why UI labels include "rgba(255,255,255,0.38)".
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

## nutrition/targets

<a id="nutrition-targets"></a>

**Folder purpose:** Full nutrition feature: daily log, food search, barcode, facts, settings, premium food cards.

### `NutritionSettingsScreen.js`

- **Path:** `src/nutrition/targets/NutritionSettingsScreen.js`
- **What it is:** Settings screen to edit daily calorie goal, macro split, and nutrition preferences after initial onboarding. Changes here update what the daily log rings and AI coach context use as targets.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `NutritionSetupScreen.jsx`

- **Path:** `src/nutrition/targets/NutritionSetupScreen.jsx`
- **What it is:** Matches BottomMenuBar minHeight when tab bar overlays this screen. Reads or writes Firebase cloud database documents; renders gradient backgrounds and buttons.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `recalculateFoodTargets.js`

- **Path:** `src/nutrition/targets/recalculateFoodTargets.js`
- **What it is:** Day-14 macro recalibration from actual nutrition_logs + nutrition_goals. Uses cloud database (`users`).
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

## settings

<a id="settings"></a>

**Folder purpose:** App-wide settings screens, support config, and legal pages.

### `BugReportScreen.jsx`

- **Path:** `src/settings/BugReportScreen.jsx`
- **What it is:** Bug Report Screen — the screen the user sees for this part of the settings flow. Renders gradient backgrounds and buttons.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `ContactSupportScreen.jsx`

- **Path:** `src/settings/ContactSupportScreen.jsx`
- **What it is:** Contact Support Screen — the screen the user sees for this part of the settings flow. Renders gradient backgrounds and buttons.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `HelpFAQScreen.jsx`

- **Path:** `src/settings/HelpFAQScreen.jsx`
- **What it is:** Help FAQScreen — the screen the user sees for this part of the settings flow. Renders gradient backgrounds and buttons.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `PrivacyPolicyScreen.jsx`

- **Path:** `src/settings/PrivacyPolicyScreen.jsx`
- **What it is:** Privacy Policy Screen — the screen the user sees for this part of the settings flow. Renders gradient backgrounds and buttons.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `SettingsScreen.js`

- **Path:** `src/settings/SettingsScreen.js`
- **What it is:** Settings UI — dark pink → dark orange gradient (no purple). Reads or writes Firebase cloud database documents; renders gradient backgrounds and buttons.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `TermsOfServiceScreen.jsx`

- **Path:** `src/settings/TermsOfServiceScreen.jsx`
- **What it is:** Terms Of Service Screen — the screen the user sees for this part of the settings flow. Renders gradient backgrounds and buttons.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `emailSupport.js`

- **Path:** `src/settings/emailSupport.js`
- **What it is:** Opens the device mail app to coachconnect0@gmail.com (or cloudConnectionured support inbox). When the API cannot send (no Resend/SMTP on server), offer the same content via mailto.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `supportContact.js`

- **Path:** `src/settings/supportContact.js`
- **What it is:** Shown in Privacy Policy, Terms, Contact Support, etc. Override with EXPO_PUBLIC_SUPPORT_EMAIL in.env if needed. Support Config Purpose: support Config.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

## spreadsheet-support

<a id="spreadsheet-support"></a>

**Folder purpose:** Source files for the `spreadsheet-support` module.

### `spreadsheetReader.js`

- **Path:** `src/spreadsheet-support/spreadsheetReader.js`
- **What it is:** Map over the results without null checks.. Part of `spreadsheet-support` — search the repo for "spreadsheetReader" to see what imports it before renaming.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `spreadsheetReader.native.js`

- **Path:** `src/spreadsheet-support/spreadsheetReader.native.js`
- **What it is:** Spreadsheet Reader.native in `spreadsheet-support`. Part of `spreadsheet-support` — search the repo for "spreadsheetReader.native" to see what imports it before renaming.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `spreadsheetReader.web.js`

- **Path:** `src/spreadsheet-support/spreadsheetReader.web.js`
- **What it is:** Spreadsheet Reader.web in `spreadsheet-support`. Part of `spreadsheet-support` — search the repo for "spreadsheetReader.web" to see what imports it before renaming.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

## trainer-app/documents

<a id="trainer-app-documents"></a>

**Folder purpose:** Document and spreadsheet editors trainers use for notes/files.

### `DocumentEditor.js`

- **Path:** `src/trainer-app/documents/DocumentEditor.js`
- **What it is:** Trainer document editor — create or edit a document. Save to users/{trainerId}/documents. Uses cloud database (`users`); UI labels include "Export document".
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `EditorTopButtons.jsx`

- **Path:** `src/trainer-app/documents/EditorTopButtons.jsx`
- **What it is:** Shown in UI only — never saved as the file title. UI labels include "Untitled document".
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `SaveStatusLabel.js`

- **Path:** `src/trainer-app/documents/SaveStatusLabel.js`
- **What it is:** Save Status Label in `trainer-app/documents`. UI labels include "Draft".
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `ShareDocumentPopup.js`

- **Path:** `src/trainer-app/documents/ShareDocumentPopup.js`
- **What it is:** Share trainer document with clients. Toggles per client; saves sharedWith to cloud database. Share Document popup Purpose: UI screen or component: Share Document popup.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `SpreadsheetEditor.js`

- **Path:** `src/trainer-app/documents/SpreadsheetEditor.js`
- **What it is:** Spreadsheet Editor popup — sheet-genius engine + Coach Connect cloud database shell. Renders gradient backgrounds and buttons; uses cloud database (`users`).
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `documentEditorTools.js`

- **Path:** `src/trainer-app/documents/documentEditorTools.js`
- **What it is:** Inject helpers for features not in TenTapStarterKit. UI labels include "Start writing… or paste from anywhere. We".
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `editorAccent.jsx`

- **Path:** `src/trainer-app/documents/editorAccent.jsx`
- **What it is:** Neutral editor accent — no cyan/orange gradients. @deprecated Use theme.accentBorder — kept for callers that still read [0].
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `editorColors.js`

- **Path:** `src/trainer-app/documents/editorColors.js`
- **What it is:** DocFlow brand gradient — rose → purple → amber. DocFlow brand gradient — rose → purple → amber.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `exportDocument.js`

- **Path:** `src/trainer-app/documents/exportDocument.js`
- **What it is:** Share sheet so the trainer can AirDrop / email / save it. vocab: Turndown = library that converts HTML → Markdown. Built once at module load because it's. Part of `trainer-app/documents` — search the repo for "exportDocument" to see what imports it before renaming.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `pageStylePresets.js`

- **Path:** `src/trainer-app/documents/pageStylePresets.js`
- **What it is:** RN wrapper styles for the paper container. UI labels include "Default".
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `readingLevel.js`

- **Path:** `src/trainer-app/documents/readingLevel.js`
- **What it is:** Share the same green — the letter carries the distinction, not the color. Most-repeated meaningful words, for the "you keep saying this" hint. n = how many to return.. Part of `trainer-app/documents` — search the repo for "readingLevel" to see what imports it before renaming.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `smartPaste.js`

- **Path:** `src/trainer-app/documents/smartPaste.js`
- **What it is:** Signal 3: starts with a keyword from a common language.. Part of `trainer-app/documents` — search the repo for "smartPaste" to see what imports it before renaming.
- **Who uses it:** Trainer app
- **Suggested name:** ___

## trainer-app/documents/spreadsheet-grid

<a id="trainer-app-documents-spreadsheet-grid"></a>

**Folder purpose:** Document and spreadsheet editors trainers use for notes/files.

### `FormulaBar.jsx`

- **Path:** `src/trainer-app/documents/spreadsheet-grid/FormulaBar.jsx`
- **What it is:** Formula bar — controlled by parent so it stays in sync with the active cell editor. UI labels include "Type a value or =formulaCalculator".
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `SlideUpMenu.jsx`

- **Path:** `src/trainer-app/documents/spreadsheet-grid/SlideUpMenu.jsx`
- **What it is:** Flow: tap outside OR drag down past a threshold → onClose; children scroll inside the sheet. keeps the row's padding consistent with the sheet's.. Part of `trainer-app/documents/spreadsheet-grid` — search the repo for "SlideUpMenu" to see what imports it before renaming.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `SpreadsheetGrid.jsx`

- **Path:** `src/trainer-app/documents/spreadsheet-grid/SpreadsheetGrid.jsx`
- **What it is:** Spreadsheet Grid — renders gradient backgrounds and buttons. Part of `trainer-app/documents/spreadsheet-grid` — search the repo for "SpreadsheetGrid" to see what imports it before renaming.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `SpreadsheetGridRow.jsx`

- **Path:** `src/trainer-app/documents/spreadsheet-grid/SpreadsheetGridRow.jsx`
- **What it is:** Grid scroll or selection change would re-render all 26 cells of all visible rows.. Part of `trainer-app/documents/spreadsheet-grid` — search the repo for "SpreadsheetGridRow" to see what imports it before renaming.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `cellFormatting.js`

- **Path:** `src/trainer-app/documents/spreadsheet-grid/cellFormatting.js`
- **What it is:** Currency string like "$1,200" would also loosely resemble a number. so bad data shows the raw text instead of "NaN" or a crash.. Part of `trainer-app/documents/spreadsheet-grid` — search the repo for "cellFormatting" to see what imports it before renaming.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `columnWidths.js`

- **Path:** `src/trainer-app/documents/spreadsheet-grid/columnWidths.js`
- **What it is:** Approximate text width for auto-sizing columns (RN has no canvas columnWidths). Widest content in column c across all cells. @param {{ r: number, c: number, text: string, bold?: boolean } | null} draft - live edit overlay.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `formulaCalculator.js`

- **Path:** `src/trainer-app/documents/spreadsheet-grid/formulaCalculator.js`
- **What it is:** Formula Calculator in `trainer-app/documents/spreadsheet-grid`. Part of `trainer-app/documents/spreadsheet-grid` — search the repo for "formulaCalculator" to see what imports it before renaming.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `prepareCellText.js`

- **Path:** `src/trainer-app/documents/spreadsheet-grid/prepareCellText.js`
- **What it is:** Precompute display strings only for populated cells (avoids 5200 formulaCalculator evals per frame). Part of `trainer-app/documents/spreadsheet-grid` — search the repo for "prepareCellText" to see what imports it before renaming.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `saveAndLoadSheet.js`

- **Path:** `src/trainer-app/documents/spreadsheet-grid/saveAndLoadSheet.js`
- **What it is:** Load cloud database rows/cellFormattings into sheet-genius sheet model. Does not replace full navigation — closes when done.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `spreadsheetConstants.js`

- **Path:** `src/trainer-app/documents/spreadsheet-grid/spreadsheetConstants.js`
- **What it is:** Small controls become genuinely hard to hit. vocab: String.fromCharCode(65) = 'A' — 65 is the character code for capital A. Part of `trainer-app/documents/spreadsheet-grid` — search the repo for "spreadsheetConstants" to see what imports it before renaming.
- **Who uses it:** Trainer app
- **Suggested name:** ___

## trainer-app/earnings

<a id="trainer-app-earnings"></a>

**Folder purpose:** Everything only trainers see: client list, sessions, documents, payments, dashboard.

### `EarningsScreen.jsx`

- **Path:** `src/trainer-app/earnings/EarningsScreen.jsx`
- **What it is:** Stored rates are cents (>= 100 for $1+). Tiny legacy dollar values still supported. Reads or writes Firebase cloud database documents; renders gradient backgrounds and buttons.
- **Who uses it:** Trainer app
- **Suggested name:** ___

## trainer-app/home

<a id="trainer-app-home"></a>

**Folder purpose:** Everything only trainers see: client list, sessions, documents, payments, dashboard.

### `TrainerHomeContent.jsx`

- **Path:** `src/trainer-app/home/TrainerHomeContent.jsx`
- **What it is:** Trainer home dashboard (client roster + tabs). Renders gradient backgrounds and buttons; subscribes to real-time cloud database updates; uses cloud database (`users/{id}/weeklySummaries`).
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `TrainerListingPopup.js`

- **Path:** `src/trainer-app/home/TrainerListingPopup.js`
- **What it is:** Notify the client that their request was accepted. Best-effort — never blocks the accept flow. Renders gradient backgrounds and buttons; uses cloud database (`users`).
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `trainerHomePieces.jsx`

- **Path:** `src/trainer-app/home/trainerHomePieces.jsx`
- **What it is:** Roster / cards: show feet/inches; treat plain numbers as total inches (legacy onboarding). Renders gradient backgrounds and buttons; UI labels include "Client workspace".
- **Who uses it:** Trainer app
- **Suggested name:** ___

## trainer-app/my-trainees

<a id="trainer-app-my-trainees"></a>

**Folder purpose:** Everything only trainers see: client list, sessions, documents, payments, dashboard.

### `MyTraineesScreen.jsx`

- **Path:** `src/trainer-app/my-trainees/MyTraineesScreen.jsx`
- **What it is:** My Trainees Screen — the screen the user sees for this part of the trainer-app flow. Renders gradient backgrounds and buttons.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `pagedTraineeList.js`

- **Path:** `src/trainer-app/my-trainees/pagedTraineeList.js`
- **What it is:** Trainer client roster — paginated cloud database reads (Load more), no full-collection listeners. Part of `trainer-app/my-trainees` — search the repo for "pagedTraineeList" to see what imports it before renaming.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `traineeList.js`

- **Path:** `src/trainer-app/my-trainees/traineeList.js`
- **What it is:** Trainer client CRM — cloud database helpers. Implementation lives in `src/app-start/TrainerAppStart.js` (search: "CLIENT CRM SERVICE"). This file re-exports the same API for hooks/screens that import from here. Uses lazy `require()` so we never create a static cycle: TrainerAppStart → pagedTraineeList → this module → TrainerAppStart (unfinished), which can surface as `ReferenceError: AppNavigationProvider doesn't exist` and similar. Part of `trainer-app/my-trainees` — search the repo for "traineeList" to see what imports it before renaming.
- **Who uses it:** Trainer app
- **Suggested name:** ___

## trainer-app/navigation

<a id="trainer-app-navigation"></a>

**Folder purpose:** Trainer tabs, overlays, and how screens open.

### `TrainerMainScreen.jsx`

- **Path:** `src/trainer-app/navigation/TrainerMainScreen.jsx`
- **What it is:** Trainer Main Screen — the screen the user sees for this part of the trainer-app flow. Renders gradient backgrounds and buttons.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `TrainerOpenScreenTracker.jsx`

- **Path:** `src/trainer-app/navigation/TrainerOpenScreenTracker.jsx`
- **What it is:** shared app setting for trainer shell navigation: overlay stack, selected client, and back behavior. TrainerMainScreen and trainer overlay screens consume this context.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `TrainerScreenList.jsx`

- **Path:** `src/trainer-app/navigation/TrainerScreenList.jsx`
- **What it is:** Trainer Screen List — registers or navigates between app screens. Part of `trainer-app/navigation` — search the repo for "TrainerScreenList" to see what imports it before renaming.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `goToTrainerScreen.js`

- **Path:** `src/trainer-app/navigation/goToTrainerScreen.js`
- **What it is:** Trainer hub layout flags + stack navigation for full-screen flows. Registers or navigates between app screens.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `trainerExtraScreens.jsx`

- **Path:** `src/trainer-app/navigation/trainerExtraScreens.jsx`
- **What it is:** Maps trainer overlay routes to Profile, Settings, FAQ, Legal, Bug Report, and similar stack screens. Same pattern as clientOverlayScreens but for the trainer app shell.
- **Who uses it:** Trainer app
- **Suggested name:** ___

## trainer-app/new-requests

<a id="trainer-app-new-requests"></a>

**Folder purpose:** Everything only trainers see: client list, sessions, documents, payments, dashboard.

### `NewTraineeRequestsScreen.jsx`

- **Path:** `src/trainer-app/new-requests/NewTraineeRequestsScreen.jsx`
- **What it is:** New Trainee Requests Screen — the screen the user sees for this part of the trainer-app flow. Renders gradient backgrounds and buttons.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `loadPendingTraineeRequests.js`

- **Path:** `src/trainer-app/new-requests/loadPendingTraineeRequests.js`
- **What it is:** Service to fetch pending client requests for a trainer. Client requests are stored in top-level messages with conversationId, senderId, status: 'pending'. Subscribes to real-time cloud database updates; uses cloud database (`conversations`).
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `pendingRequestCount.js`

- **Path:** `src/trainer-app/new-requests/pendingRequestCount.js`
- **What it is:** Hook to fetch and refresh pending client requests for a trainer. Subscribes to the trainer's conversations so the badge/count updates in realtime when a new request comes in or an existing one is accepted/rejected. Subscribes to real-time cloud database updates; uses cloud database (`conversations`).
- **Who uses it:** Trainer app
- **Suggested name:** ___

## trainer-app/nutrition-tab

<a id="trainer-app-nutrition-tab"></a>

**Folder purpose:** Trainer looking at a client’s nutrition.

### `TrainerNutritionTab.jsx`

- **Path:** `src/trainer-app/nutrition-tab/TrainerNutritionTab.jsx`
- **What it is:** Trainer dashboard — Nutrition tab. UI labels include "No nutrition logged yet".
- **Who uses it:** Trainer app
- **Suggested name:** ___

## trainer-app/progress-tab

<a id="trainer-app-progress-tab"></a>

**Folder purpose:** Trainer looking at a client’s progress and weight.

### `ProgressTopCard.jsx`

- **Path:** `src/trainer-app/progress-tab/ProgressTopCard.jsx`
- **What it is:** Progress Top Card in `trainer-app/progress-tab`. Part of `trainer-app/progress-tab` — search the repo for "ProgressTopCard" to see what imports it before renaming.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `TrainerProgressTab.jsx`

- **Path:** `src/trainer-app/progress-tab/TrainerProgressTab.jsx`
- **What it is:** Trainer dashboard — Progress tab. Renders gradient backgrounds and buttons; UI labels include "Weight".
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `pickWeightToShow.js`

- **Path:** `src/trainer-app/progress-tab/pickWeightToShow.js`
- **What it is:** Resolve trainer Progress tab weight display per client. Priority: today's log → most recent log → live profile weight from users/{id}. Current weight shown on the hero card.
- **Who uses it:** Trainer app
- **Suggested name:** ___

## trainer-app/scheduling

<a id="trainer-app-scheduling"></a>

**Folder purpose:** Everything only trainers see: client list, sessions, documents, payments, dashboard.

### `BookSessionScreen.jsx`

- **Path:** `src/trainer-app/scheduling/BookSessionScreen.jsx`
- **What it is:** Book Session Screen — the screen the user sees for this part of the trainer-app flow. Renders gradient backgrounds and buttons.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `CalendarTab.jsx`

- **Path:** `src/trainer-app/scheduling/CalendarTab.jsx`
- **What it is:** Trainer Sessions tab — calendar home + inline form routing. UI labels include "Calendar".
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `MonthCalendar.jsx`

- **Path:** `src/trainer-app/scheduling/MonthCalendar.jsx`
- **What it is:** Month Calendar in `trainer-app/scheduling`. Part of components in Coach Connect.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `ScheduleSessionScreen.jsx`

- **Path:** `src/trainer-app/scheduling/ScheduleSessionScreen.jsx`
- **What it is:** Schedule Training Session — inline tab form, wheel pickers, theme-responsive. Registers or navigates between app screens; renders gradient backgrounds and buttons.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `SessionCard.jsx`

- **Path:** `src/trainer-app/scheduling/SessionCard.jsx`
- **What it is:** Premium session row for trainer calendar / list views. `showDate` — include date chip (useful in upcoming list across multiple days). UI labels include "Confirmed".
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `SessionTimePicker.jsx`

- **Path:** `src/trainer-app/scheduling/SessionTimePicker.jsx`
- **What it is:** Session Time Picker in `trainer-app/scheduling`. Part of `trainer-app/scheduling` — search the repo for "SessionTimePicker" to see what imports it before renaming.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `SharedSessionList.jsx`

- **Path:** `src/trainer-app/scheduling/SharedSessionList.jsx`
- **What it is:** Component: mounting subscribes, unmounting tears the subscription down. Throwing here turns a confusing blank screen into an obvious "you forgot the Provider".. Part of `trainer-app/scheduling` — search the repo for "SharedSessionList" to see what imports it before renaming.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `WheelPicker.jsx`

- **Path:** `src/trainer-app/scheduling/WheelPicker.jsx`
- **What it is:** Off-center rows dim via opacity only — hue stays pure white/black. Wheel Picker Purpose: Wheel Picker.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `alertTraineeOfSession.js`

- **Path:** `src/trainer-app/scheduling/alertTraineeOfSession.js`
- **What it is:** Send a session-scheduled push to the client from the trainer app. Does not require the Node server or Cloud Functions (reads client pushToken from users/{clientId}). Uses cloud database (`users`).
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `mySessions.js`

- **Path:** `src/trainer-app/scheduling/mySessions.js`
- **What it is:** UseSessions — Trainer-wide session scheduling (across all clients). cloud database: - `trainer_clients/{trainerUid}/sessions/{sessionId}` Session doc shape: - clientId: string - date: YYYY-MM-DD - time: HH:mm (24h) - durationMin: number - notes?: string - zoomLink?: string - createdAt/updatedAt: server timestamps. Subscribes to real-time cloud database updates; uses cloud database (`users`).
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `schedulingColors.js`

- **Path:** `src/trainer-app/scheduling/schedulingColors.js`
- **What it is:** Surface follows — do NOT hardcode these values inside screens or they'll fall out of sync. Manipulate here: order matters — index 0 renders first (top/left), last renders last.. Part of `trainer-app/scheduling` — search the repo for "schedulingColors" to see what imports it before renaming.
- **Who uses it:** Trainer app
- **Suggested name:** ___

## trainer-app/trainee-detail

<a id="trainer-app-trainee-detail"></a>

**Folder purpose:** Everything only trainers see: client list, sessions, documents, payments, dashboard.

### `ManageTraineeScreen.jsx`

- **Path:** `src/trainer-app/trainee-detail/ManageTraineeScreen.jsx`
- **What it is:** Trainer — single-client detail (sessions + notes/files). Reads or writes Firebase cloud database documents; renders gradient backgrounds and buttons; subscribes to real-time cloud database updates.
- **Who uses it:** Trainer app
- **Suggested name:** ___

## trainer-app/trainee-records

<a id="trainer-app-trainee-records"></a>

**Folder purpose:** Everything only trainers see: client list, sessions, documents, payments, dashboard.

### `calmDatabaseErrors.js`

- **Path:** `src/trainer-app/trainee-records/calmDatabaseErrors.js`
- **What it is:** So the UI stays calm, and let everything else bubble up as a real failure.. Part of `trainer-app/trainee-records` — search the repo for "calmDatabaseErrors" to see what imports it before renaming.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `getTraineeDisplayName.js`

- **Path:** `src/trainer-app/trainee-records/getTraineeDisplayName.js`
- **What it is:** Trainer roster: CRM `trainer_clients/.../clients` rows often store placeholder `name: "Client"` while the real label lives on `users/{uid}` (and may use many field shapes across signup, onboarding, OAuth, and profile edits). Uses cloud database (`trainer_clients/.../clients`).
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `loadMyLinkedTrainees.js`

- **Path:** `src/trainer-app/trainee-records/loadMyLinkedTrainees.js`
- **What it is:** @param {string} trainerUid @param {object[]} rawRows @returns {Promise<object[]>}. Uses cloud database (`users`).
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `traineeDatabaseLocations.js`

- **Path:** `src/trainer-app/trainee-records/traineeDatabaseLocations.js`
- **What it is:** Canonical trainer ↔ client cloud database paths. Reads: trainer_clients/{trainerId}/clients/{clientId} first, legacy clients/{clientId} fallback. Writes: canonical path only (legacy mirror only where explicitly documented in CRM create). Uses cloud database (`clients`).
- **Who uses it:** Trainer app
- **Suggested name:** ___

## trainer-app/weekly-report

<a id="trainer-app-weekly-report"></a>

**Folder purpose:** Weekly report cards the trainer sees for a client.

### `TrainerWeeklyReportSection.jsx`

- **Path:** `src/trainer-app/weekly-report/TrainerWeeklyReportSection.jsx`
- **What it is:** Trainer dashboard: hero card under client chips → opens full weekly report for selected client. Uses cloud database (`users`).
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `WeeklyReportBanner.jsx`

- **Path:** `src/trainer-app/weekly-report/WeeklyReportBanner.jsx`
- **What it is:** Dark purple → dark orange (matches Today card & Quick Actions). UI labels include "Weekly report".
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `WeeklyReportBars.jsx`

- **Path:** `src/trainer-app/weekly-report/WeeklyReportBars.jsx`
- **What it is:** Progress bar fill colors — first stop of each metric gradient. UI labels include "rgba(255,255,255,0.45)".
- **Who uses it:** Trainer app
- **Suggested name:** ___

## trainer-app/workout-plans

<a id="trainer-app-workout-plans"></a>

**Folder purpose:** Trainer builds workout plans by hand.

### `ManualWorkoutPlanBuilderScreen.jsx`

- **Path:** `src/trainer-app/workout-plans/ManualWorkoutPlanBuilderScreen.jsx`
- **What it is:** Manual Workout Plan Builder Screen — the screen the user sees for this part of the trainer-app flow. Renders gradient backgrounds and buttons.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `builtInExerciseList.js`

- **Path:** `src/trainer-app/workout-plans/builtInExerciseList.js`
- **What it is:** Offline exercise library for the manual workout plan builder (search + autocomplete). IDs are stable strings for cloud database references; trainers may still save custom names. Part of `trainer-app/workout-plans` — search the repo for "builtInExerciseList" to see what imports it before renaming.
- **Who uses it:** Trainer app
- **Suggested name:** ___

### `manualPlanToWorkoutPlan.js`

- **Path:** `src/trainer-app/workout-plans/manualPlanToWorkoutPlan.js`
- **What it is:** Maps manual builder state → CreateWorkoutPlanScreen `structuredPlan.workoutPlan` rows. Uses cloud database (`usersSubcollection`).
- **Who uses it:** Trainer app
- **Suggested name:** ___

## trainer-pro-plan

<a id="trainer-pro-plan"></a>

**Folder purpose:** Source files for the `trainer-pro-plan` module.

### `FreeTrialBanner.jsx`

- **Path:** `src/trainer-pro-plan/FreeTrialBanner.jsx`
- **What it is:** Free Trial Banner — renders gradient backgrounds and buttons. Part of `trainer-pro-plan` — search the repo for "FreeTrialBanner" to see what imports it before renaming.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `ProAccessCheck.jsx`

- **Path:** `src/trainer-pro-plan/ProAccessCheck.jsx`
- **What it is:** Gates trainer app when a *prior* subscription has expired. Does NOT block login for trainers with no subscription yet — Pro IAP is offered in onboarding / Settings, not as a hard login wall (legacy accounts and TestFlight trainers otherwise get stuck on payment forever). Part of `trainer-pro-plan` — search the repo for "ProAccessCheck" to see what imports it before renaming.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `ProExpiredScreen.jsx`

- **Path:** `src/trainer-pro-plan/ProExpiredScreen.jsx`
- **What it is:** Pro Expired Screen — full-screen phone app view in `trainer-pro-plan`. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in trainer-pro-plan.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `ProLegalFooter.jsx`

- **Path:** `src/trainer-pro-plan/ProLegalFooter.jsx`
- **What it is:** App Store Guideline 3.1.2 subscription disclosure (title, length, price, auto-renew, legal links). Part of `trainer-pro-plan` — search the repo for "ProLegalFooter" to see what imports it before renaming.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `ProPlanPurchases.jsx`

- **Path:** `src/trainer-pro-plan/ProPlanPurchases.jsx`
- **What it is:** @param {import('expo-iap').Purchase} purchase. Subscribes to real-time cloud database updates; uses cloud database (`users`).
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `ProPlanSetup.jsx`

- **Path:** `src/trainer-pro-plan/ProPlanSetup.jsx`
- **What it is:** Pro Plan Setup — subscribes to real-time cloud database updates. Subscribes to real-time cloud database updates; uses cloud database (`users`).
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `ProUpgradeOffer.jsx`

- **Path:** `src/trainer-pro-plan/ProUpgradeOffer.jsx`
- **What it is:** Onboarding step-9 style Pro subscription offer (hero image + feature cards + CTA). Part of `trainer-pro-plan` — search the repo for "ProUpgradeOffer" to see what imports it before renaming.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `ProUpgradeScreen.jsx`

- **Path:** `src/trainer-pro-plan/ProUpgradeScreen.jsx`
- **What it is:** Pro Upgrade Screen — full-screen phone app view in `trainer-pro-plan`. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in trainer-pro-plan.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `proAccessRules.js`

- **Path:** `src/trainer-pro-plan/proAccessRules.js`
- **What it is:** Pure helpers for trainer platform subscription access. cloud database shape: users/{uid}.subscription. Pure helpers for trainer platform subscription access. cloud database shape: users/{uid}.subscription.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `proPlanStatus.js`

- **Path:** `src/trainer-pro-plan/proPlanStatus.js`
- **What it is:** Pro Plan Status in `trainer-pro-plan`. Part of `trainer-pro-plan` — search the repo for "proPlanStatus" to see what imports it before renaming.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `proPlanSwitches.js`

- **Path:** `src/trainer-pro-plan/proPlanSwitches.js`
- **What it is:** Live StoreKit paywall + real IAP in onboarding. Enabled for EAS production/preview builds unless EXPO_PUBLIC_TRAINER_IAP_ENABLED=false. UI labels include "Coach Connect Pro".
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

### `verifyProPurchase.js`

- **Path:** `src/trainer-pro-plan/verifyProPurchase.js`
- **What it is:** @param {'verify' | 'restore'} action @param {Record<string, unknown>} body. @param {'verify' | 'restore'} action @param {Record<string, unknown>} body.
- **Who uses it:** Shared / cross-app
- **Suggested name:** ___

## workouts/create-plan

<a id="workouts-create-plan"></a>

**Folder purpose:** Workouts feature: active session, exercise videos, AI plan generate/view.

### `CreateWorkoutPlanScreen.js`

- **Path:** `src/workouts/create-plan/CreateWorkoutPlanScreen.js`
- **What it is:** Workout Plan Generator Screen Review onboarding data, allow edits, and generate personalized workout plan using the AI model API. Reads or writes Firebase cloud database documents; renders Lottie animations in the UI; renders gradient backgrounds and buttons.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `EditWorkoutPopup.jsx`

- **Path:** `src/workouts/create-plan/EditWorkoutPopup.jsx`
- **What it is:** UI-only “nice” edit popup for Workout Plan builder fields. Uses the existing field editor (`WorkoutPlanBuilderFieldEditBody`) so functionality stays identical. Edit popup Form RN Purpose: UI screen or component: Edit popup Form RN.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `GenerateMyWorkoutPlanScreen.jsx`

- **Path:** `src/workouts/create-plan/GenerateMyWorkoutPlanScreen.jsx`
- **What it is:** UI wrapper for workout plan generation. Rendering of plans is intentionally NOT handled here. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in workouts.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `WorkoutProfileTags.jsx`

- **Path:** `src/workouts/create-plan/WorkoutProfileTags.jsx`
- **What it is:** Workout Profile Tags — renders gradient backgrounds and buttons. UI labels include "Personal Info".
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `askForWorkoutPlan.js`

- **Path:** `src/workouts/create-plan/askForWorkoutPlan.js`
- **What it is:** Calls the server to generate an AI workout plan from onboarding answers and Claude/the AI model. Also loads saved onboarding artifacts and plan history from AsyncStorage/cloud database.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `countPlansCreated.js`

- **Path:** `src/workouts/create-plan/countPlansCreated.js`
- **What it is:** Keep in sync with server/lib/workoutGenerationLimit.js. Uses cloud database (`users`).
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `editPlanFieldForms.js`

- **Path:** `src/workouts/create-plan/editPlanFieldForms.js`
- **What it is:** Inline edit bodies for workout plan builder rows — logic copied from CreateWorkoutPlanScreen. UI labels include "Beginner".
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `keepPlanBuildingInBackground.js`

- **Path:** `src/workouts/create-plan/keepPlanBuildingInBackground.js`
- **What it is:** Tracks AI workout plan generation across tab switches / screen unmounts. Generation continues in JS; UI re-subscribes via AsyncStorage + listeners. @param {{ userAwayFromWorkout?: boolean }} opts.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `nameWorkoutPlan.js`

- **Path:** `src/workouts/create-plan/nameWorkoutPlan.js`
- **What it is:** Creative display names for saved AI workout plans (library cards). Avoids bland "AI Plan – Jul 6, 2026" defaults. @param {object} [planData] - generated plan payload ({ structuredPlan, goal,... }) @param {string} [fallbackSeed] @returns {string}.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `planQuestionLabels.js`

- **Path:** `src/workouts/create-plan/planQuestionLabels.js`
- **What it is:** Field labels, icons, and display config for the workout plan generator onboarding form. Drives the profile pill grid on GenerateMyWorkoutPlanScreen.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `planRequestAnswers.js`

- **Path:** `src/workouts/create-plan/planRequestAnswers.js`
- **What it is:** Fields used by server/lib/workoutPlanPrompt.js — keep payload small and JSON-safe. Strip cloud database spreadsheetConstants / extra user-doc fields before POSTing to /api/workout/generate.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `readPlanText.js`

- **Path:** `src/workouts/create-plan/readPlanText.js`
- **What it is:** Workout plan parsing helpers for plan viewer screens. UI labels include "Profile".
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `saveAndLoadWorkoutPlan.js`

- **Path:** `src/workouts/create-plan/saveAndLoadWorkoutPlan.js`
- **What it is:** Single doc path for current workout plan: users/{uid}/workoutPlan. Subscribes to real-time cloud database updates; uses cloud database (`users`).
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `workoutPlanCreation.js`

- **Path:** `src/workouts/create-plan/workoutPlanCreation.js`
- **What it is:** Workout plan generation state + API orchestration. Part of `workouts/create-plan` — search the repo for "workoutPlanCreation" to see what imports it before renaming.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

## workouts/exercise-rows

<a id="workouts-exercise-rows"></a>

**Folder purpose:** Workouts feature: active session, exercise videos, AI plan generate/view.

### `ExerciseRow.jsx`

- **Path:** `src/workouts/exercise-rows/ExerciseRow.jsx`
- **What it is:** ExerciseRow Component Displays a single exercise with inline editing for sets, reps, rest, and notes. This is a UI-only component for cleaner organization. UI labels include "seconds".
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `ExerciseSection.js`

- **Path:** `src/workouts/exercise-rows/ExerciseSection.js`
- **What it is:** Exercise Section — renders gradient backgrounds and buttons. Part of workouts in Coach Connect.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

## workouts/exercise-videos

<a id="workouts-exercise-videos"></a>

**Folder purpose:** Workouts feature: active session, exercise videos, AI plan generate/view.

### `DislikedExercisesPicker.jsx`

- **Path:** `src/workouts/exercise-videos/DislikedExercisesPicker.jsx`
- **What it is:** Multi-select exercise preference picker with lottery-cage style drifting pill animation. UI labels include "Search exercises...".
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `ExerciseCard.js`

- **Path:** `src/workouts/exercise-videos/ExerciseCard.js`
- **What it is:** Exercise Card — renders gradient backgrounds and buttons. Part of workouts in Coach Connect.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `ExerciseVideosTab.jsx`

- **Path:** `src/workouts/exercise-videos/ExerciseVideosTab.jsx`
- **What it is:** Aurora rim — hot pink → dark orange (matches home hero + user prefs). Renders gradient backgrounds and buttons; caches data locally on the device between app launches; uses cloud database (`users`).
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `ShortVideoCard.js`

- **Path:** `src/workouts/exercise-videos/ShortVideoCard.js`
- **What it is:** Short Video Card — renders gradient backgrounds and buttons. Part of workouts in Coach Connect.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `VideoPlayer.jsx`

- **Path:** `src/workouts/exercise-videos/VideoPlayer.jsx`
- **What it is:** YouTube IFrame API player (replaces raw WebView embed URLs — helps avoid Error 153). Keep width ≥ ~320 and height ≥ ~220 so controls fit per YouTube embed guidelines. Video Player popup Purpose: UI screen or component: Video Player popup.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `dislikableExercises.js`

- **Path:** `src/workouts/exercise-videos/dislikableExercises.js`
- **What it is:** Curated exercise catalog for onboarding "exercises you dislike" multi-select. IDs align with MANUAL_EXERCISE_LIBRARY where possible; extras cover cardio, machines, etc. UI labels include "Chest & Push".
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `dislikedExercisesText.js`

- **Path:** `src/workouts/exercise-videos/dislikedExercisesText.js`
- **What it is:** Selected catalog IDs + optional custom names → stored profile string. Parse stored string back into catalog IDs + leftover custom text.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `findExerciseVideos.js`

- **Path:** `src/workouts/exercise-videos/findExerciseVideos.js`
- **What it is:** Bust in-memory cache when search/filter logic changes. Hits API routes /api/youtube/search.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `loadSavedWorkoutPlans.js`

- **Path:** `src/workouts/exercise-videos/loadSavedWorkoutPlans.js`
- **What it is:** Loads all workout plans visible in the AI Workout Library for a client (subcollection, current doc, legacy global + savedWorkoutPlans). Uses cloud database (`users`).
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

## workouts/view-plan

<a id="workouts-view-plan"></a>

**Folder purpose:** Workouts feature: active session, exercise videos, AI plan generate/view.

### `PlanPdfViewer.js`

- **Path:** `src/workouts/view-plan/PlanPdfViewer.js`
- **What it is:** In-app PDF viewer for generated workout plan. Shows PDF (from local uri or remote url), bottom bar: Save to Files, Share, Send to Trainer. UI labels include "Workout Plan".
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `WorkoutPlanView.jsx`

- **Path:** `src/workouts/view-plan/WorkoutPlanView.jsx`
- **What it is:** Workout Plan View — renders gradient backgrounds and buttons. UI labels include "Weekly Plan".
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `makePlanPdf.js`

- **Path:** `src/workouts/view-plan/makePlanPdf.js`
- **What it is:** Workout plan PDF: parse plan text, generate PDF (expo-print), save to Storage + cloud database. Only used AFTER the plan is generated; does not change AI or prompts. Uses cloud database (`users`); UI labels include "Workout Plan".
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

### `planViewPieces.jsx`

- **Path:** `src/workouts/view-plan/planViewPieces.jsx`
- **What it is:** Shared screen code pieces for rendering a generated workout plan (day headers, exercise blocks, rest notes). Used by WorkoutPlanResult and the PDF export pipeline.
- **Who uses it:** Mostly trainees; trainers may view related data
- **Suggested name:** ___

---

*End of catalog — 613 files. Regenerate with `node scripts/generateSrcFileCatalog.mjs`.*
