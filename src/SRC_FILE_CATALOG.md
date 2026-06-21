# Coach Connect — Complete `src/` File Catalog

**565 files** (467 JS/JSX modules) — generated 2026-06-21.

Regenerate: `node scripts/generateSrcFileCatalog.mjs`

Each folder explains its role. Each file gets **two plain-English sentences** — what it does and how it fits in the app.

Firebase production project ID stays `anatrox-auth` (do not rename in config).

---

## Table of contents

- [(root)](#root) (3 files)
- [__tests__/components](#tests-components) (1 files)
- [__tests__/fixtures](#tests-fixtures) (1 files)
- [__tests__/integration](#tests-integration) (6 files)
- [__tests__/mocks](#tests-mocks) (1 files)
- [__tests__/unit](#tests-unit) (48 files)
- [ai-coach/chat-ui](#ai-coach-chat-ui) (2 files)
- [ai-coach/chat-ui/chat-home](#ai-coach-chat-ui-chat-home) (1 files)
- [ai-coach/chat-ui/chat-thread](#ai-coach-chat-ui-chat-thread) (11 files)
- [ai-coach/chat-ui/components](#ai-coach-chat-ui-components) (8 files)
- [ai-coach/chat-ui/lib](#ai-coach-chat-ui-lib) (7 files)
- [ai-coach/chat-ui/persistence](#ai-coach-chat-ui-persistence) (1 files)
- [ai-coach/chat-ui/screens](#ai-coach-chat-ui-screens) (1 files)
- [ai-coach/chat-ui/tool-modals](#ai-coach-chat-ui-tool-modals) (17 files)
- [ai-coach/chat-ui/voice](#ai-coach-chat-ui-voice) (2 files)
- [ai-coach/server-logic](#ai-coach-server-logic) (2 files)
- [ai-coach/server-logic/chat-api](#ai-coach-server-logic-chat-api) (4 files)
- [ai-coach/server-logic/context](#ai-coach-server-logic-context) (3 files)
- [ai-coach/server-logic/macro-recalibration](#ai-coach-server-logic-macro-recalibration) (1 files)
- [ai-coach/server-logic/services](#ai-coach-server-logic-services) (3 files)
- [ai-coach/server-logic/tools](#ai-coach-server-logic-tools) (6 files)
- [ai-coach/server-logic/trainer-messaging](#ai-coach-server-logic-trainer-messaging) (1 files)
- [ai-coach/server-logic/vision](#ai-coach-server-logic-vision) (1 files)
- [ai-coach/tools](#ai-coach-tools) (1 files)
- [app-start](#app-start) (6 files)
- [assets](#assets) (6 files)
- [assets/animations/app-flows](#assets-animations-app-flows) (16 files)
- [assets/animations/legacy](#assets-animations-legacy) (12 files)
- [assets/icons](#assets-icons) (31 files)
- [assets/icons/New Icons](#assets-icons-New-Icons) (13 files)
- [assets/onboarding-consolidated](#assets-onboarding-consolidated) (15 files)
- [auth](#auth) (7 files)
- [auth/services](#auth-services) (2 files)
- [client-app/components](#client-app-components) (2 files)
- [client-app/dashboard](#client-app-dashboard) (5 files)
- [client-app/files](#client-app-files) (5 files)
- [client-app/home](#client-app-home) (6 files)
- [client-app/hooks](#client-app-hooks) (1 files)
- [client-app/lib](#client-app-lib) (1 files)
- [client-app/marketplace](#client-app-marketplace) (1 files)
- [client-app/marketplace/components](#client-app-marketplace-components) (7 files)
- [client-app/marketplace/screens](#client-app-marketplace-screens) (2 files)
- [client-app/messaging](#client-app-messaging) (2 files)
- [client-app/navigation](#client-app-navigation) (7 files)
- [client-app/photo-gallery](#client-app-photo-gallery) (1 files)
- [client-app/profile](#client-app-profile) (1 files)
- [client-app/screens](#client-app-screens) (7 files)
- [client-app/settings](#client-app-settings) (7 files)
- [client-app/weekly-report](#client-app-weekly-report) (1 files)
- [client-app/workout-plans](#client-app-workout-plans) (1 files)
- [lib](#lib) (1 files)
- [messaging](#messaging) (2 files)
- [metrics/daily-metrics](#metrics-daily-metrics) (5 files)
- [metrics/daily-quotes](#metrics-daily-quotes) (1 files)
- [navigation](#navigation) (8 files)
- [notifications](#notifications) (3 files)
- [nutrition](#nutrition) (1 files)
- [nutrition/barcode](#nutrition-barcode) (4 files)
- [nutrition/components](#nutrition-components) (1 files)
- [nutrition/components/premiumFoodCard](#nutrition-components-premiumFoodCard) (8 files)
- [nutrition/daily-log](#nutrition-daily-log) (6 files)
- [nutrition/food-details](#nutrition-food-details) (8 files)
- [nutrition/food-search](#nutrition-food-search) (11 files)
- [nutrition/quick-add](#nutrition-quick-add) (1 files)
- [nutrition/screens](#nutrition-screens) (1 files)
- [nutrition/settings](#nutrition-settings) (2 files)
- [nutrition/utils](#nutrition-utils) (1 files)
- [settings](#settings) (2 files)
- [settings/screens](#settings-screens) (14 files)
- [shared-ui](#shared-ui) (9 files)
- [shared-ui/layout](#shared-ui-layout) (1 files)
- [shared-ui/liquid](#shared-ui-liquid) (6 files)
- [shared-utils](#shared-utils) (9 files)
- [shared/accessibility](#shared-accessibility) (1 files)
- [shared/api](#shared-api) (10 files)
- [shared/assets](#shared-assets) (4 files)
- [shared/components](#shared-components) (2 files)
- [shared/components/home](#shared-components-home) (6 files)
- [shared/components/icons](#shared-components-icons) (4 files)
- [shared/components/modals](#shared-components-modals) (3 files)
- [shared/components/notes-files](#shared-components-notes-files) (9 files)
- [shared/components/onboarding](#shared-components-onboarding) (3 files)
- [shared/components/shell](#shared-components-shell) (2 files)
- [shared/contexts](#shared-contexts) (1 files)
- [shared/firestore](#shared-firestore) (2 files)
- [shared/fitness-calculations](#shared-fitness-calculations) (1 files)
- [shared/hooks](#shared-hooks) (1 files)
- [shared/icons](#shared-icons) (1 files)
- [shared/marketplace](#shared-marketplace) (1 files)
- [shared/notes-files](#shared-notes-files) (2 files)
- [shared/photo-gallery](#shared-photo-gallery) (1 files)
- [shared/screens](#shared-screens) (3 files)
- [shared/services](#shared-services) (4 files)
- [shared/trainer-location](#shared-trainer-location) (1 files)
- [shared/weekly-report](#shared-weekly-report) (1 files)
- [shared/workout-plans](#shared-workout-plans) (1 files)
- [shared/workout-profile](#shared-workout-profile) (2 files)
- [trainer-app/calendar-tab](#trainer-app-calendar-tab) (1 files)
- [trainer-app/client-detail](#trainer-app-client-detail) (1 files)
- [trainer-app/client-requests](#trainer-app-client-requests) (3 files)
- [trainer-app/clients-list](#trainer-app-clients-list) (3 files)
- [trainer-app/components](#trainer-app-components) (2 files)
- [trainer-app/components/sessions](#trainer-app-components-sessions) (2 files)
- [trainer-app/crm](#trainer-app-crm) (4 files)
- [trainer-app/dashboard](#trainer-app-dashboard) (3 files)
- [trainer-app/documents](#trainer-app-documents) (7 files)
- [trainer-app/home](#trainer-app-home) (1 files)
- [trainer-app/hooks](#trainer-app-hooks) (1 files)
- [trainer-app/marketplace](#trainer-app-marketplace) (1 files)
- [trainer-app/messaging](#trainer-app-messaging) (2 files)
- [trainer-app/navigation](#trainer-app-navigation) (6 files)
- [trainer-app/nutrition-tab](#trainer-app-nutrition-tab) (1 files)
- [trainer-app/payments](#trainer-app-payments) (1 files)
- [trainer-app/photo-gallery](#trainer-app-photo-gallery) (1 files)
- [trainer-app/progress-tab](#trainer-app-progress-tab) (1 files)
- [trainer-app/screens](#trainer-app-screens) (8 files)
- [trainer-app/sessions](#trainer-app-sessions) (1 files)
- [trainer-app/weekly-report](#trainer-app-weekly-report) (4 files)
- [trainer-app/workout-plans](#trainer-app-workout-plans) (4 files)
- [utils](#utils) (10 files)
- [workouts/active-workout](#workouts-active-workout) (5 files)
- [workouts/components](#workouts-components) (2 files)
- [workouts/exercise-library](#workouts-exercise-library) (9 files)
- [workouts/plan-builder](#workouts-plan-builder) (1 files)
- [workouts/plan-generator](#workouts-plan-generator) (7 files)
- [workouts/plan-viewer](#workouts-plan-viewer) (4 files)
- [workouts/screens](#workouts-screens) (1 files)

---

## src/ (root) {#root}

**Folder purpose:** Root of the React Native / Expo app source. Contains the app entry loader and this catalog.

### `CODEBASE_GUIDE.md`

1. Developer documentation for navigating the codebase.
2. Regenerate with `node scripts/generateSrcFileCatalog.mjs`.

### `Loader.js`

1. Animated loading spinner (five bouncing dots) shown while async work completes.
2. Used as a lightweight loading indicator anywhere the app needs a visual wait state.

### `SRC_FILE_CATALOG.md`

1. Developer documentation for navigating the codebase.
2. Regenerate with `node scripts/generateSrcFileCatalog.mjs`.

## __tests__/components {#tests-components}

**Folder purpose:** React component tests rendered with Testing Library.

### `__tests__/components/ToolConfirmationModal.test.js`

1. Automated Jest tests for ToolConfirmationModal rendering.
2. Catches regressions before deploy — run with `npm test`. Tests include: does not render when no tool is present; renders logSleep modal with hours and action buttons; renders logNutrition modal with food and calories; renders adjustMacroTargets modal with calorie and protein values.

## __tests__/fixtures {#tests-fixtures}

**Folder purpose:** Shared mock data and fixtures imported by multiple tests.

### `__tests__/fixtures/coachToolGuardFixtures.js`

1. Automated Jest tests for coach Tool Guard Fixtures.
2. Catches regressions before deploy — run with `npm test`.

## __tests__/integration {#tests-integration}

**Folder purpose:** Multi-module integration tests that exercise real flows (auth, food log, coach).

### `__tests__/integration/aiCoachFlow.test.js`

1. Automated Jest tests for ai coach flow integration.
2. Catches regressions before deploy — run with `npm test`.

### `__tests__/integration/clientHomeBootstrap.test.js`

1. Automated Jest tests for client home bootstrap.
2. Catches regressions before deploy — run with `npm test`.

### `__tests__/integration/dashboardSave.test.js`

1. Automated Jest tests for dashboard save integration; useWorkoutLog save.
2. Catches regressions before deploy — run with `npm test`. Tests include: saveDashboardWorkoutLog writes canonical dailyLogs payload; persists workout log and notifies linked trainer; Write succeeds locally but push to trainer fails → local save still confirmed, push failure logged.

### `__tests__/integration/foodSearchLog.test.js`

1. Automated Jest tests for Food search → results; Food log → Firestore write.
2. Catches regressions before deploy — run with `npm test`. Tests include: returns 3 structured results from a successful server search; uses in-memory cache on the second identical search (server called once); falls back to Open Food Facts when the server is unreachable; returns an empty array (not null) when the server has no matches.

### `__tests__/integration/onboardingComplete.test.js`

1. Automated Jest tests for Onboarding complete → trainer link creation.
2. Catches regressions before deploy — run with `npm test`. Tests include: writes all 3 link surfaces when onboarding completes with a trainer code; skips trainer link collections when no trainer code is provided; does not write trainer links when the server call fails; sets onboardingCompleted in Firestore and AsyncStorage on success.

### `__tests__/integration/toolExecutorReal.test.js`

1. Automated Jest tests for logSleep real execution; logWater real execution; logNutrition real execution; deleteLog real execution; adjustMacroTargets real execution; trainer mode blocks all writes.
2. Catches regressions before deploy — run with `npm test`. Tests include: Valid hours → writes to correct Firestore path dashboard_sleep field; Hours as string ; Hours as 0 → writes 0 not null; Hours over 24 → rejected or capped.

## __tests__/mocks {#tests-mocks}

**Folder purpose:** Module mocks for Expo and third-party dependencies in Jest.

### `__tests__/mocks/expoVirtualEnv.js`

1. Automated Jest tests for expo Virtual Env.
2. Catches regressions before deploy — run with `npm test`.

## __tests__/unit {#tests-unit}

**Folder purpose:** Pure unit tests for helpers, parsers, scoring, and business logic.

### `__tests__/unit/aiCoachCapabilities.test.js`

1. Automated Jest tests for offline — delete log, personal data, tool inference; inferDeleteLogParams; wantsDeleteAllFoodLogs; coerceMisroutedDeleteTool; shouldIncludeWeeklyContextInCoachPrompt; mergeCoachToolCalls; inferCoachToolCall; parseCoachToolCalls; isCoachVisionConfigured; API health; Live API — coach chat & tools; Basic coach reply; Food log query loads personal data; Delete all food today → deleteLog tool; Log sleep → logSleep tool; General question (no weekly nag); Vision — DeepSeek-VL2 + coach polish; Live API — photo attachment route.
2. Catches regressions before deploy — run with `npm test`. Tests include: delete: ; delete: today omits fixed date; delete: ; delete: pizza keyword.

### `__tests__/unit/authGate.test.js`

1. Automated Jest tests for normalizeAppRole; profileNeedsOnboarding; isLikelyNewFirebaseUser.
2. Catches regressions before deploy — run with `npm test`. Tests include: returns false when onboardingCompleted is true; returns true when onboardingCompleted is false; handles empty profile; handles null profile.

### `__tests__/unit/barcodeSerperLookup.test.js`

1. Automated Jest tests for barcodeSerperLookup.
2. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/baseUrl.test.js`

1. Automated Jest tests for baseUrl helpers.
2. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/bookSessionParse.test.js`

1. Automated Jest tests for book Session Parse.
2. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/calculations.test.js`

1. Automated Jest tests for calculateBMR; calculateTDEE; calculateBMI; calculateMacros; estimateBodyFat.
2. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/coachCategoryPrompts.test.js`

1. Automated Jest tests for coach category prompts.
2. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/coachFollowUpPrompts.test.js`

1. Automated Jest tests for coachFollowUpPrompts.
2. Catches regressions before deploy — run with `npm test`. Tests include: extracts ## Suggested follow-ups from reply and strips from display; builds follow-ups anchored to nutrition web search thread; references assistant reply bullets instead of vague profile prompts; builds contextual follow-ups for sleep web search.

### `__tests__/unit/coachPersonalDataRouting.test.js`

1. Automated Jest tests for coach personal-data routing.
2. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/coachProgressCycle.test.js`

1. Automated Jest tests for coach progress cycle timeline.
2. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/coachSourcePreview.test.js`

1. Automated Jest tests for coach Source Preview.
2. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/coachToolProposalGuards.test.js`

1. Automated Jest tests for informational questions reject tool proposals; explicit log requests accept tool proposals; ambiguous statements reject tool proposals; filterValidCoachToolProposals; Client coachToolProposalGuards; Server coachToolProposalGuards.
2. Catches regressions before deploy — run with `npm test`. Tests include: returns only valid proposals from a mixed list; returns an empty array for an empty input; does not throw for null input; does not throw for undefined input.

### `__tests__/unit/coachWebSourceCards.test.js`

1. Automated Jest tests for CoachWebSourceCards helpers.
2. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/dailyMetrics.test.js`

1. Automated Jest tests for dailyMetricsService.
2. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/dailyMetricsParse.test.js`

1. Automated Jest tests for parseDailyMetricsFromSnapshots; trackingMirrorFromLogs; buildWorkoutLogHydration; rollover archive payload shape.
2. Catches regressions before deploy — run with `npm test`. Tests include: prefers dailyLogs water over tracking; prefers dailyLogs sleep over tracking; reads soreness from logs; reads energy from logs.

### `__tests__/unit/dataCacheCleanup.test.js`

1. Automated Jest tests for clearUserSpecificData; onUserSignOut; onUserSwitch; clearAllUserData.
2. Catches regressions before deploy — run with `npm test`. Tests include: Clears all keys containing the uid; Does NOT clear keys for other uids; AsyncStorage error → caught, does not crash app; Missing uid → no keys cleared, no crash.

### `__tests__/unit/dateAndRollover.test.js`

1. Automated Jest tests for local day helpers.
2. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/exerciseDislikeHelpers.test.js`

1. Automated Jest tests for exerciseDislikeHelpers.
2. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/foodNormalize.test.js`

1. Automated Jest tests for foodNormalize.
2. Catches regressions before deploy — run with `npm test`. Tests include: normalizes FatSecret-style rows; cleans Serper titles when search query provided.

### `__tests__/unit/foodNormalizeBarcode.test.js`

1. Automated Jest tests for foodNormalizeBarcode.
2. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/foodSearchScoring.test.js`

1. Automated Jest tests for normalizeQueryText; significantQueryTokens; itemMatchesQuery; filterFoodSearchRows general behavior; isMenuStyleQuery branded supplements; isMenuStyleQuery; scoreSerperFoodResultRow; extractMacrosFromChunk.
2. Catches regressions before deploy — run with `npm test`. Tests include: lowercases and trims brand queries; collapses extra spaces; strips special characters; returns empty string for empty input without throwing.

### `__tests__/unit/foodSearchTitle.test.js`

1. Automated Jest tests for sanitizeFoodCardTitle (all sources); applyFoodCardPresentation (every provider).
2. Catches regressions before deploy — run with `npm test`. Tests include: strips legacy source suffixes from cached titles; rejects source-only junk titles and uses the user query; removes dangling em dashes; cleans USDA and packaged food titles with site suffixes.

### `__tests__/unit/formatFoodBrand.test.js`

1. Automated Jest tests for cleanFoodBrandName.
2. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/inferFoodServingLabel.test.js`

1. Automated Jest tests for guessServingSize.
2. Catches regressions before deploy — run with `npm test`. Tests include: flags generic gram labels as weak; infers pizza as slice; infers nugget counts from query; infers bread as piece.

### `__tests__/unit/inferToolCallFromCoachMessage.test.js`

1. Automated Jest tests for inferToolCallFromCoachMessage.
2. Catches regressions before deploy — run with `npm test`. Tests include: does not infer deleteLog from coach prose on informational web-search questions; still infers deleteLog when the user explicitly asks to delete food; does not infer logSleep from ambiguous sleep statements; infers logSleep when the user explicitly asks to log sleep.

### `__tests__/unit/marketplaceFilters.test.js`

1. Automated Jest tests for marketplace filter utils.
2. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/normalizeFoodDisplayName.test.js`

1. Automated Jest tests for makeReadableFoodTitle; normalizeFoodRecordForStorage; helpers.
2. Catches regressions before deploy — run with `npm test`. Tests include: title-cases ALL CAPS packaged foods; collapses repeated comma segments; strips site suffixes and uses user query for junk titles; shortens USDA scientific descriptions.

### `__tests__/unit/notesAndFiles.test.js`

1. Automated Jest tests for notes file helpers.
2. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/nutritionConsensusSearch.test.js`

1. Automated Jest tests for parseNutritionSearchQuery; mapConsensusToFoodRow; mapNutritionSearchToFoodRows; mergeNutritionSearchWithLegacy.
2. Catches regressions before deploy — run with `npm test`. Tests include: splits Jet\; splits mcnuggets queries; keeps plain grocery queries as foodName only; maps consensus payload into a loggable food row.

### `__tests__/unit/nutritionSearchConsensus.test.js`

1. Automated Jest tests for removeOutliersIqr; buildNutrientConsensus; getFoodNutritionConsensus.
2. Catches regressions before deploy — run with `npm test`. Tests include: removes extreme outliers; returns original values when only two data points; includes nutrient when variance is under 10%; flags verify_manually when variance is 10-20%.

### `__tests__/unit/nutritionSearchInliers.test.js`

1. Automated Jest tests for classifyCalorieSources; getFoodNutritionConsensus sourceResults.
2. Catches regressions before deploy — run with `npm test`. Tests include: marks per_100g USDA as wrong_serving_basis; flags calorie outliers when 3+ sources disagree; returns sourceResults and consensus for agreeing sources; buildSourceResultRow includes url and sourceKey.

### `__tests__/unit/nutritionSearchRoute.test.js`

1. Automated Jest tests for POST /api/nutrition/search handler.
2. Catches regressions before deploy — run with `npm test`. Tests include: returns source rows without consensus when only one inlier; non-existent food returns 404 when no validated sources; returns 503 when all sources error out; timeout on one site still returns consensus when 3+ sources succeed.

### `__tests__/unit/onboardingCalculations.test.js`

1. Automated Jest tests for calculateBMR; calculateTDEE; calculateMacros; calculateBMI.
2. Catches regressions before deploy — run with `npm test`. Tests include: male 80kg 180cm 30yo → Mifflin-St Jeor result; female 60kg 165cm 25yo → Mifflin-St Jeor result; zero weight input does not return a nonsense positive number; negative height does not return a valid-looking BMR.

### `__tests__/unit/onboardingGate.test.js`

1. Automated Jest tests for onboarding gate.
2. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/parseCoachToolCalls.test.js`

1. Automated Jest tests for parseCoachToolCalls; stripCoachToolJsonFromReply; normalizeToolParams.
2. Catches regressions before deploy — run with `npm test`. Tests include: parses valid JSON at end of reply; parses fenced JSON inside backticks; returns empty array for plain text with no JSON; returns empty array for malformed JSON without throwing.

### `__tests__/unit/parseDeleteLogRequest.test.js`

1. Automated Jest tests for userWantsDeleteLog; coerceMisroutedDeleteTool.
2. Catches regressions before deploy — run with `npm test`. Tests include: accepts explicit delete-food requests; rejects generic coaching prose about removing foods; does not coerce delete from coach reply alone.

### `__tests__/unit/parseWebSearchReply.test.js`

1. Automated Jest tests for parseWebSearchReply.
2. Catches regressions before deploy — run with `npm test`. Tests include: parses ## sections without dropping content; preserves full wall-of-text when unstructured; preprocessWebSearchLayout keeps every sentence for unstructured text; stripInlineWebCitations preserves newlines.

### `__tests__/unit/premiumFoodCard.test.js`

1. Automated Jest tests for premiumFoodCard.
2. Catches regressions before deploy — run with `npm test`. Tests include: maps logged food to card shape with calorie-based macro percents; uses low-opacity pill gradient stops; demo food matches mockup macros; embedded palette is transparent for meal sections.

### `__tests__/unit/resolveCoachToolCalls.test.js`

1. Automated Jest tests for resolveCoachToolCalls (server).
2. Catches regressions before deploy — run with `npm test`. Tests include: returns no tools for informational protein web-search questions; returns adjustMacroTargets when user explicitly asks to change targets.

### `__tests__/unit/saveCoachMessagesFirestore.test.js`

1. Automated Jest tests for saveCoachMessages Firestore payloads.
2. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/servingMath.test.js`

1. Automated Jest tests for servingMath.
2. Catches regressions before deploy — run with `npm test`. Tests include: scales macros by serving count; computes total grams from qty × grams-per-serving; parses fractional serving qty.

### `__tests__/unit/supportConfig.test.js`

1. Automated Jest tests for supportConfig.
2. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/trainerClientDisplayName.test.js`

1. Automated Jest tests for trainer client display name resolver.
2. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/trainerCodeValidation.test.js`

1. Automated Jest tests for normalizeInviteCodeForQuery; validateTrainerCode.
2. Catches regressions before deploy — run with `npm test`. Tests include: formats a 6-character code as XXX-XXX; rejects too-short and over-long codes; returns valid true and sets trainerId from a working API response; returns valid false when the API reports an invalid code.

### `__tests__/unit/trainerMessaging.test.js`

1. Automated Jest tests for filterChatMessages; getOrCreateConversation; sendMessage; markMessagesAsRead; subscribeToMessages.
2. Catches regressions before deploy — run with `npm test`. Tests include: Regular messages returned in result; Pending connection request type messages filtered OUT of thread; Empty array input returns empty array; Null input does not throw.

### `__tests__/unit/validateBarcodeFood.test.js`

1. Automated Jest tests for validateBarcodeFood.
2. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/workoutDayLabels.test.js`

1. Automated Jest tests for workout Day Labels.
2. Catches regressions before deploy — run with `npm test`.

### `__tests__/unit/workoutPlanParsing.test.js`

1. Automated Jest tests for workoutPlanPdfService parsing.
2. Catches regressions before deploy — run with `npm test`.

## ai-coach/chat-ui {#ai-coach-chat-ui}

**Folder purpose:** Source files for the `ai-coach/chat-ui` module.

### `ai-coach/chat-ui/AICoachTestSuite.jsx`

1. AICoach Test Suite — runs AI coach tool actions after the user taps Confirm.
2. Loads user profile, nutrition, and workout context for the coach prompt; UI labels include "AI Coach Tests".

### `ai-coach/chat-ui/aiCoachUiTokens.js`

1. AI Coach UI tokens — aligned with design-system.md (premium dark neon glass). Use only inside src/ai-coach/chat-ui/*.
2. UI labels include "rgba(255,255,255,0.45)".

## ai-coach/chat-ui/chat-home {#ai-coach-chat-ui-chat-home}

**Folder purpose:** Source files for the `ai-coach/chat-ui/chat-home` module.

### `ai-coach/chat-ui/chat-home/StartCoachChatScreen.jsx`

1. Start Coach Chat Screen — full-screen React Native view in `ai-coach/chat-ui/chat-home`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in ai-coach.

## ai-coach/chat-ui/chat-thread {#ai-coach-chat-ui-chat-thread}

**Folder purpose:** Source files for the `ai-coach/chat-ui/chat-thread` module.

### `ai-coach/chat-ui/chat-thread/ChatWithCoachScreen.jsx`

1. Chat With Coach Screen — the screen the user sees for this part of the ai-coach flow.
2. Runs AI coach tool actions after the user taps Confirm; sends user messages to the AI coach backend and streams replies; persists coach chat history to Firestore.

### `ai-coach/chat-ui/chat-thread/CoachPasteSheet.jsx`

1. Coach Paste Sheet — bottom sheet that slides up for a quick decision or form.
2. Does not replace full navigation — closes when done.

### `ai-coach/chat-ui/chat-thread/CoachWebSourceCards.jsx`

1. Coach Web Source Cards Collapsible source links under AI Coach web-search replies.
2. Part of `ai-coach/chat-ui/chat-thread` — search the repo for "CoachWebSourceCards" to see what imports it before renaming.

### `ai-coach/chat-ui/chat-thread/ToolConfirmationModal.jsx`

1. Tool Confirmation Modal — popup overlay on top of the current screen.
2. Runs AI coach tool actions after the user taps Confirm; renders gradient backgrounds and buttons.

### `ai-coach/chat-ui/chat-thread/coachClipboard.js`

1. Strip [1] [2] inline citation markers — preserve newlines and markdown structure.
2. Strip lightweight markdown so coach replies render as one selectable Text block.

### `ai-coach/chat-ui/chat-thread/coachQuickPrompts.js`

1. Hourly-rotating AI Coach prompts + capability carousel copy. Pools refresh every hour; daily reshuffle reduces repetition.
2. UI labels include "Log sleep, water, steps, or mood".

### `ai-coach/chat-ui/chat-thread/openAttachmentMenu.js`

1. Native attach menu — avoids Modal + ImagePicker stacking bugs on iOS.
2. Show Coach Attach Menu Purpose: show Coach Attach Menu — Feature module for Coach Connect. Why it matters: Area: src/aiChat Key exports: showCoachAttachMenu.

### `ai-coach/chat-ui/chat-thread/pickAttachmentType.js`

1. Resize + JPEG compress so we always have base64 for the vision API.
2. Coach Attachment Pickers Purpose: coach Attachment Pickers — Feature module for Coach Connect. Why it matters: Area: src/aiChat Key exports: pickCoachPhotosFromLibrary, pickCoachPhotoFromCamera, pickCoachDocuments.

### `ai-coach/chat-ui/chat-thread/renderSourcePreview.js`

1. Visual helpers for AI Coach web source cards.
2. Coach Source Preview Purpose: coach Source Preview — Feature module for Coach Connect. Why it matters: Area: src/aiChat Key exports: hostLabel, faviconUrl, screenshotPreviewUrl, resolveSourcePreviewUri.

### `ai-coach/chat-ui/chat-thread/useCoachComposerInput.js`

1. Use Coach Composer Input — React hook encapsulating data loading and state for ai-coach/chat-ui/chat-thread.
2. Screens call this hook instead of putting fetch/Firestore logic inline in JSX.

### `ai-coach/chat-ui/chat-thread/useCoachComposerKeyboard.js`

1. Use Coach Composer Keyboard — React hook encapsulating data loading and state for ai-coach/chat-ui/chat-thread.
2. Screens call this hook instead of putting fetch/Firestore logic inline in JSX.

## ai-coach/chat-ui/components {#ai-coach-chat-ui-components}

**Folder purpose:** Source files for the `ai-coach/chat-ui/components` module.

### `ai-coach/chat-ui/components/AICoachGlassCard.jsx`

1. Premium glass card — gradient border + dark inner fill (matches dashboard heroes).
2. AICoach Glass Card Purpose: UI screen or component: AICoach Glass Card. Feature module for Coach Connect. Why it matters: Area: src/aiChat Key exports: AICoachGlassCard.

### `ai-coach/chat-ui/components/AttachActionSheet.jsx`

1. Attach Action Sheet — bottom sheet that slides up for a quick decision or form.
2. Does not replace full navigation — closes when done.

### `ai-coach/chat-ui/components/CoachFollowUpBubbles.jsx`

1. SuppCo-style follow-up suggestion chips — lavender pills, context from the thread.
2. UI labels include "Suggested follow-up questions".

### `ai-coach/chat-ui/components/CoachFormattedReply.jsx`

1. Coach Formatted Reply — parses tool-call JSON embedded in coach model responses.
2. Part of `ai-coach/chat-ui/components` — search the repo for "CoachFormattedReply" to see what imports it before renaming.

### `ai-coach/chat-ui/components/CoachWebSearchReply.jsx`

1. Web-search replies — full markdown render, structure without dropping content.
2. Part of `ai-coach/chat-ui/components` — search the repo for "CoachWebSearchReply" to see what imports it before renaming.

### `ai-coach/chat-ui/components/ContextChips.jsx`

1. Matches dashboard hero pills (DashboardHeroCard / FilesNotesHeroCard).
2. UI labels include "${context.nutritionDaysLogged} food days".

### `ai-coach/chat-ui/components/MiniOrb.jsx`

1. Mini Orb in `ai-coach/chat-ui/components`.
2. Part of aiChat in Coach Connect.

### `ai-coach/chat-ui/components/TrainerCoachClientBar.jsx`

1. Trainer AI Coach — pick which client's data to load into the coach prompt.
2. Part of `ai-coach/chat-ui/components` — search the repo for "TrainerCoachClientBar" to see what imports it before renaming.

## ai-coach/chat-ui/lib {#ai-coach-chat-ui-lib}

**Folder purpose:** Source files for the `ai-coach/chat-ui/lib` module.

### `ai-coach/chat-ui/lib/coachConversationDebug.js`

1. Dev-only AI Coach conversation logs — copy from Metro when reporting issues.
2. Log what the user sent (before API call).

### `ai-coach/chat-ui/lib/coachFollowUpPrompts.js`

1. Context-aware follow-up chips after coach replies — anchored to the thread, not vague profile prompts.
2. Heuristic follow-ups when the model omits the ## Suggested follow-ups section.

### `ai-coach/chat-ui/lib/coachMarkdownStyles.js`

1. Turn inline [Source Name] citations into pill-styled markdown links.
2. Part of `ai-coach/chat-ui/lib` — search the repo for "coachMarkdownStyles" to see what imports it before renaming.

### `ai-coach/chat-ui/lib/coachQuickActionsList.js`

1. AI Coach home — capability tiles + quick action prefills (not coaching questions).
2. UI labels include "Log food".

### `ai-coach/chat-ui/lib/formatCoachMessageText.js`

1. Format Coach Message Text in `ai-coach/chat-ui/lib`.
2. Part of `ai-coach/chat-ui/lib` — search the repo for "formatCoachMessageText" to see what imports it before renaming.

### `ai-coach/chat-ui/lib/parseWebSearchReply.js`

1. Parse web-search replies — preserve full content, extract sections for tests/tools only.
2. Light layout pass — adds ## headers only when missing; never drops content.

### `ai-coach/chat-ui/lib/prepareCoachAttachments.js`

1. Convert local coach chat attachments into API-safe image payloads (base64 data URLs).
2. Prepare Coach Attachments Purpose: prepare Coach Attachments — Feature module for Coach Connect. Why it matters: Area: src/aiChat Key exports: prepareCoachAttachmentsForApi.

## ai-coach/chat-ui/persistence {#ai-coach-chat-ui-persistence}

**Folder purpose:** Source files for the `ai-coach/chat-ui/persistence` module.

### `ai-coach/chat-ui/persistence/saveCoachMessages.js`

1. AI Coach chat persistence — session meta + per-message docs (avoids full-array rewrites).
2. Uses Firestore (`users`).

## ai-coach/chat-ui/screens {#ai-coach-chat-ui-screens}

**Folder purpose:** Source files for the `ai-coach/chat-ui/screens` module.

### `ai-coach/chat-ui/screens/StartCoachChatScreen.jsx`

1. Start Coach Chat Screen — the screen the user sees for this part of the ai-coach flow.
2. Persists coach chat history to Firestore; enables voice dictation and text-to-speech in coach chat; writes a logged food entry to the user daily nutrition log.

## ai-coach/chat-ui/tool-modals {#ai-coach-chat-ui-tool-modals}

**Folder purpose:** Source files for the `ai-coach/chat-ui/tool-modals` module.

### `ai-coach/chat-ui/tool-modals/AdjustMacroTargetsSheet.jsx`

1. Adjust Macro Targets Sheet — bottom sheet that slides up for a quick decision or form.
2. Reads or writes Firebase Firestore documents.

### `ai-coach/chat-ui/tool-modals/BookTraineeSessionSheet.jsx`

1. Book Trainee Session Sheet — bottom sheet that slides up for a quick decision or form.
2. Does not replace full navigation — closes when done.

### `ai-coach/chat-ui/tool-modals/ConfirmDeleteLogSheet.jsx`

1. Confirm Delete Log Sheet — bottom sheet that slides up for a quick decision or form.
2. Does not replace full navigation — closes when done.

### `ai-coach/chat-ui/tool-modals/LogDailyStepsSheet.jsx`

1. Log Daily Steps Sheet — bottom sheet that slides up for a quick decision or form.
2. Does not replace full navigation — closes when done.

### `ai-coach/chat-ui/tool-modals/LogMealSheet.jsx`

1. Log Meal Sheet — bottom sheet that slides up for a quick decision or form.
2. Does not replace full navigation — closes when done.

### `ai-coach/chat-ui/tool-modals/LogMoodRatingSheet.jsx`

1. Log Mood Rating Sheet — bottom sheet that slides up for a quick decision or form.
2. Does not replace full navigation — closes when done.

### `ai-coach/chat-ui/tool-modals/LogRestDaySheet.jsx`

1. Log Rest Day Sheet — bottom sheet that slides up for a quick decision or form.
2. Does not replace full navigation — closes when done.

### `ai-coach/chat-ui/tool-modals/LogSleepHoursSheet.jsx`

1. Log Sleep Hours Sheet — bottom sheet that slides up for a quick decision or form.
2. Does not replace full navigation — closes when done.

### `ai-coach/chat-ui/tool-modals/LogWaterIntakeSheet.jsx`

1. Log Water Intake Sheet — bottom sheet that slides up for a quick decision or form.
2. Does not replace full navigation — closes when done.

### `ai-coach/chat-ui/tool-modals/OpenWorkoutPlanSheet.jsx`

1. Open Workout Plan Sheet — bottom sheet that slides up for a quick decision or form.
2. Does not replace full navigation — closes when done.

### `ai-coach/chat-ui/tool-modals/PlanDeloadWeekSheet.jsx`

1. Plan Deload Week Sheet — bottom sheet that slides up for a quick decision or form.
2. Does not replace full navigation — closes when done.

### `ai-coach/chat-ui/tool-modals/RateEnergyLevelSheet.jsx`

1. Rate Energy Level Sheet — bottom sheet that slides up for a quick decision or form.
2. Does not replace full navigation — closes when done.

### `ai-coach/chat-ui/tool-modals/RateWorkoutFeelSheet.jsx`

1. Rate Workout Feel Sheet — bottom sheet that slides up for a quick decision or form.
2. Does not replace full navigation — closes when done.

### `ai-coach/chat-ui/tool-modals/SendTrainerMessageSheet.jsx`

1. Send Trainer Message Sheet — bottom sheet that slides up for a quick decision or form.
2. Does not replace full navigation — closes when done.

### `ai-coach/chat-ui/tool-modals/UpdateFitnessGoalSheet.jsx`

1. Update Fitness Goal Sheet — bottom sheet that slides up for a quick decision or form.
2. Does not replace full navigation — closes when done.

### `ai-coach/chat-ui/tool-modals/UpdateWorkoutSessionSheet.jsx`

1. Update Workout Session Sheet — bottom sheet that slides up for a quick decision or form.
2. Does not replace full navigation — closes when done.

### `ai-coach/chat-ui/tool-modals/toolModalHelpers.js`

1. Shared UI/logic helpers for tool-modals — imported by sibling modals and screens.
2. Not a screen itself; contains reusable pieces like confirm/cancel rows, labels, and styling tokens.

## ai-coach/chat-ui/voice {#ai-coach-chat-ui-voice}

**Folder purpose:** Source files for the `ai-coach/chat-ui/voice` module.

### `ai-coach/chat-ui/voice/VoiceCoachScreen.jsx`

1. Voice Coach Screen — full-screen React Native view in `ai-coach/chat-ui/voice`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in ai-coach.

### `ai-coach/chat-ui/voice/useVoiceToCoach.js`

1. Hook: enables voice dictation and text-to-speech in coach chat.
2. Screens call this hook instead of putting fetch/Firestore logic inline in JSX.

## ai-coach/server-logic {#ai-coach-server-logic}

**Folder purpose:** Source files for the `ai-coach/server-logic` module.

### `ai-coach/server-logic/aiCoachService.js`

1. AI Coach public API — context + chat. DeepSeek runs on the server (/api/ai-coach), not in the mobile bundle.
2. Screens import functions from here rather than calling fetch/Firestore directly.

### `ai-coach/server-logic/perplexityService.js`

1. Client-side Perplexity routing heuristics (mirrors server shouldUsePerplexity).
2. Screens import functions from here rather than calling fetch/Firestore directly.

## ai-coach/server-logic/chat-api {#ai-coach-server-logic-chat-api}

**Folder purpose:** Source files for the `ai-coach/server-logic/chat-api` module.

### `ai-coach/server-logic/chat-api/chatStorageService.js`

1. Chat structure: { id: string (unique ID), title: string (first message or "New Chat"), messages: Array<{ role: 'user'|'assistant', content: string, imageUri?: string, timestamp: number }>, createdAt: number (timestamp), updatedAt: number (timestamp), }.
2. Screens import functions from here rather than calling fetch/Firestore directly.

### `ai-coach/server-logic/chat-api/loadMoreCoachConversations.js`

1. Fetch next page of conversations (call from Load more).
2. Subscribes to real-time Firestore updates; uses Firestore (`conversations`).

### `ai-coach/server-logic/chat-api/sendCoachMessageToServer.js`

1. AI Coach chat — proxies to Express /api/ai-coach (DeepSeek on server). Do NOT put DEEPSEEK_API_KEY in the React Native bundle; keys stay in server .env / Cloud Run.
2. Sends user messages to the AI coach backend and streams replies; loads user profile, nutrition, and workout context for the coach prompt; hits API routes /api/ai-coach/web-search, /api/ai-coach.

### `ai-coach/server-logic/chat-api/shouldUseWebSearch.js`

1. AI Coach web-search routing (client). Keep in sync with server/lib/coachWebSearch.js.
2. Web Search Routing Purpose: web Search Routing — Feature module for Coach Connect. Why it matters: Area: src/ai Key exports: shouldUseWebAuto, shouldShowWebSearchUI, shouldInvokeWebSearch, shouldForceDedicatedWebSearchRoute.

## ai-coach/server-logic/context {#ai-coach-server-logic-context}

**Folder purpose:** Source files for the `ai-coach/server-logic/context` module.

### `ai-coach/server-logic/context/buildCoachPromptData.js`

1. Decides whether the AI Coach should load this user's app history (nutrition, workouts, sleep, etc.) into the system prompt. Why: Loading full account context costs Firestore reads and makes the prompt large. We only fetch it when the user's message is clearly about *their* data — not for generic questions like "how much protein should I eat?" Data window: since account creation (up to 2 years), with lifetime averages + last 45 days of meal detail + monthly rollups for older months. Keep patterns in sync with: server/lib/coachPersonalDataRouting.js --- Regex cheat sheet (used in every pattern below) --- / ... / → regular expression (pattern matcher for text) \b → "word boundary" — start/end of a word (so "log" won't match "blog") (a|b) → "a OR b" — match either option inside the parentheses '? → the ? before ' makes the apostrophe optional ("arent" vs "aren't") .* → any characters (.* = "anything in between" two phrases) \b at end → word must end cleanly (not be part of a longer word).
2. Coach Personal Data Routing Purpose: coach Personal Data Routing — Feature module for Coach Connect. Why it matters: Area: src/ai Key exports: shouldIncludeWeeklyContextInCoachPrompt.

### `ai-coach/server-logic/context/loadCoachPersonalContext.js`

1. 7-day coach context for AI Coach UI chips + server payload. Prefer GET /api/weekly-context (same logic as server getWeeklyContext). Falls back to client Firestore reads when offline or API unavailable.
2. Resolves the server API base URL with offline fallback; reads or writes Firebase Firestore documents; uses Firestore (`users`).

### `ai-coach/server-logic/context/loadCoachWeeklyStats.js`

1. Client Firestore reads for 7-day AI context (matches server/lib/coachWeeklyData.js).
2. Uses Firestore (`users`).

## ai-coach/server-logic/macro-recalibration {#ai-coach-server-logic-macro-recalibration}

**Folder purpose:** Source files for the `ai-coach/server-logic/macro-recalibration` module.

### `ai-coach/server-logic/macro-recalibration/recalculateMacrosFromCoach.js`

1. Day-14 macro recalibration from actual nutrition_logs + nutrition_goals.
2. Reads or writes Firebase Firestore documents; uses Firestore (`users`).

## ai-coach/server-logic/services {#ai-coach-server-logic-services}

**Folder purpose:** Source files for the `ai-coach/server-logic/services` module.

### `ai-coach/server-logic/services/askServer.js`

1. Ask Server in `ai-coach/server-logic/services`.
2. Part of ai in Coach Connect.

### `ai-coach/server-logic/services/markAllMessagesRead.js`

1. Mark All Messages Read — reads or writes Firebase Firestore documents.
2. Uses Firestore (`conversations`).

### `ai-coach/server-logic/services/webSearch.js`

1. Try server-side web search first (uses Serper API if available), fallback to DuckDuckGo Prefers server-side search (Serper API) if available, falls back to client-side.
2. UI labels include "Web Search Results".

## ai-coach/server-logic/tools {#ai-coach-server-logic-tools}

**Folder purpose:** Source files for the `ai-coach/server-logic/tools` module.

### `ai-coach/server-logic/tools/chooseCoachActionUI.js`

1. When coach tools should interrupt with a modal vs inline chip vs auto-run.
2. Destructive or affects others — auto-open confirm modal.

### `ai-coach/server-logic/tools/cleanupToolParams.js`

1. * normalize Tool Params * * Purpose: normalize Tool Params — Feature module for Coach Connect. * Why it matters: Keeps f
2. Part of ai in Coach Connect.

### `ai-coach/server-logic/tools/detectDeleteFoodRequest.js`

1. Delete-log intent detection + fix model misrouting logNutrition → deleteLog.
2. Coach Delete Log Routing Purpose: coach Delete Log Routing — Feature module for Coach Connect. Why it matters: Area: src/ai Key exports: userWantsDeleteLog, coachTextImpliesDelete, parseLooseDateKey, sanitizeDeleteFoodQuery, wantsDeleteAllFoodLogs, inferDeleteLogParams, coerceMisroutedDeleteTool.

### `ai-coach/server-logic/tools/findCoachRequestsInText.js`

1. Lightweight client-side tool inference when the API didn't attach toolCalls but the coach message implies an action (or embeds JSON).
2. Parses tool-call JSON embedded in coach model responses.

### `ai-coach/server-logic/tools/runCoachAction.js`

1. AI Coach tool execution — server-first via /api/ai-coach/execute-tool, with client fallbacks.
2. Writes a logged food entry to the user daily nutrition log; writes weight, sleep, steps, water to dailyLogs; uses Firestore (`users`).

### `ai-coach/server-logic/tools/shouldShowCoachAction.js`

1. Whether a tool proposal should be shown for user confirmation given their message intent.
2. Coach Tool Proposal Guards Purpose: coach Tool Proposal Guards — Feature module for Coach Connect. Why it matters: Area: src/ai Key exports: guardCoachToolProposal, guardCoachToolProposals, isValidCoachToolProposal, filterValidCoachToolProposals.

## ai-coach/server-logic/trainer-messaging {#ai-coach-server-logic-trainer-messaging}

**Folder purpose:** Source files for the `ai-coach/server-logic/trainer-messaging` module.

### `ai-coach/server-logic/trainer-messaging/sendTrainerNotification.js`

1. Client → trainer requests (not normal chat).
2. Subscribes to real-time Firestore updates; uses Firestore (`conversations`).

## ai-coach/server-logic/vision {#ai-coach-server-logic-vision}

**Folder purpose:** Source files for the `ai-coach/server-logic/vision` module.

### `ai-coach/server-logic/vision/imageStorageService.js`

1. Request camera/media library permissions.
2. Screens import functions from here rather than calling fetch/Firestore directly.

## ai-coach/tools {#ai-coach-tools}

**Folder purpose:** Source files for the `ai-coach/tools` module.

### `ai-coach/tools/parseCoachToolCalls.js`

1. Parse AI Coach tool JSON from model replies (shared by server + Expo client).
2. Parse Coach Tool Calls Purpose: parse Coach Tool Calls — Feature module for Coach Connect. Why it matters: Area: src/shared Key exports: parseCoachToolCalls, stripCoachToolJsonFromReply, COACH_TOOL_NAMES.

## app-start {#app-start}

**Folder purpose:** Source files for the `app-start` module.

### `app-start/AuthGate.js`

1. AuthGate - Handles authentication state and routes to appropriate app.
2. Caches data locally on the device between app launches; hits API routes /api/me.

### `app-start/ClientApp.js`

1. ClientApp - Client-specific application interface with integrated home screen.
2. Writes weight, sleep, steps, water to dailyLogs; reads or writes Firebase Firestore documents; uses Firestore (`trainer_clients/${userData.trainerId}/clients/${clientUid}`).

### `app-start/TrainerApp.js`

1. TrainerApp.jsx Trainer CRM dashboard with full conditional rendering. When client has data → Lovable-style populated UI. When no data → clean empty states with CTAs.
2. Reads or writes Firebase Firestore documents; registers or navigates between app screens; uses Firestore (`clients`).

### `app-start/authGateLogic.js`

1. Single source for routing + onboarding; avoids null/undefined flashing the wrong shell.
2. Only force onboarding when explicitly incomplete — missing field = legacy users who already use the app.

### `app-start/config.js`

1. App configuration constants (Firebase keys reference, feature flags, env-driven values).
2. Read by AuthGate and app entry — do not commit secrets here; use EXPO_PUBLIC_ env vars.

### `app-start/permissions.js`

1. Request camera permission Request microphone permission.
2. Lets the user pick photos from the camera roll.

## assets {#assets}

**Folder purpose:** Static images, Lottie animations, and icon PNGs bundled with the app.

### `assets/IMG_2562.png`

1. PNG/GIF image "IMG 2562" used as a visual icon or illustration in the assets UI.
2. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/Run Hamster... run.json`

1. Lottie animation "Run Hamster... run" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets`.

### `assets/Stressed Employee At Work.json`

1. Lottie animation "Stressed Employee At Work" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets`.

### `assets/ai_workouts.png`

1. Marketing/hero image for AI-generated workout plans feature.
2. Bundled static asset under `assets`.

### `assets/sad reaction.json`

1. Lottie animation "sad reaction" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets`.

### `assets/sneakers.gif`

1. PNG/GIF image "sneakers" used as a visual icon or illustration in the assets UI.
2. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

## assets/animations/app-flows {#assets-animations-app-flows}

**Folder purpose:** Static images, Lottie animations, and icon PNGs bundled with the app.

### `assets/animations/app-flows/Exercise for diet or health.json`

1. Lottie animation "Exercise for diet or health" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/Guy talking to Robot _ AI Help.json`

1. Lottie animation "Guy talking to Robot   AI Help" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/certifications.json`

1. Lottie animation "certifications" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/equipment.json`

1. Lottie animation "equipment" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/experience-timeline.json`

1. Lottie animation "experience timeline" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/fitness-experience.json`

1. Lottie animation "fitness experience" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/fitness-goal.json`

1. Lottie animation "fitness goal" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/injuries.json`

1. Lottie animation "injuries" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/invite-code.json`

1. Lottie animation "invite code" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/personal-info.json`

1. Lottie animation "personal info" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/philosophy.json`

1. Lottie animation "philosophy" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/rates.json`

1. Lottie animation "rates" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/role-selection.json`

1. Lottie animation "role selection" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/specialties.json`

1. Lottie animation "specialties" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/trainer-code.json`

1. Lottie animation "trainer code" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

### `assets/animations/app-flows/training-frequency.json`

1. Lottie animation "training frequency" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/app-flows`.

## assets/animations/legacy {#assets-animations-legacy}

**Folder purpose:** Legacy branded Lottie files (AI, food, fitness themes).

### `assets/animations/legacy/Artificial intelligence digital technology (1).json`

1. Lottie animation "Artificial intelligence digital technology (1)" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.

### `assets/animations/legacy/Cloud robotics abstract.json`

1. Lottie animation "Cloud robotics abstract" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.

### `assets/animations/legacy/Fast food.json`

1. Lottie animation "Fast food" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.

### `assets/animations/legacy/Fitness.json`

1. Lottie animation "Fitness" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.

### `assets/animations/legacy/Food squeeze_With Burger and hot dog.json`

1. Lottie animation "Food squeeze With Burger and hot dog" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.

### `assets/animations/legacy/Healthy food for diet & fitness.json`

1. Lottie animation "Healthy food for diet & fitness" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.

### `assets/animations/legacy/boxer lottie.json`

1. Lottie animation "boxer lottie" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.

### `assets/animations/legacy/fitness (1).json`

1. Lottie animation "fitness (1)" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.

### `assets/animations/legacy/food around the city.json`

1. Lottie animation "food around the city" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.

### `assets/animations/legacy/glass water.json`

1. Lottie animation "glass water" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.

### `assets/animations/legacy/loading.json`

1. Lottie animation "loading" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.

### `assets/animations/legacy/sleep.json`

1. Lottie animation "sleep" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/animations/legacy`.

## assets/icons {#assets-icons}

**Folder purpose:** Nutrition, workout, and UI icon PNGs/GIFs used across onboarding and dashboards.

### `assets/icons/Carbs.png`

1. Macro breakdown UI — carbohydrate icon on nutrition cards and dashboards.
2. Bundled static asset under `assets/icons`.

### `assets/icons/Check in.png`

1. PNG/GIF image "Check in" used as a visual icon or illustration in the assets UI.
2. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/Fats.png`

1. Macro breakdown UI — fat icon on nutrition cards and dashboards.
2. Bundled static asset under `assets/icons`.

### `assets/icons/Illustration-of-Google-icon-on-transparent-background-PNG.png`

1. PNG/GIF image "Illustration of Google icon on transparent background PNG" used as a visual icon or illustration in the assets UI.
2. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/Progress.png`

1. PNG/GIF image "Progress" used as a visual icon or illustration in the assets UI.
2. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/Protein.png`

1. Macro breakdown UI — protein icon on nutrition cards and dashboards.
2. Bundled static asset under `assets/icons`.

### `assets/icons/Schedule.png`

1. PNG/GIF image "Schedule" used as a visual icon or illustration in the assets UI.
2. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/This Week.png`

1. PNG/GIF image "This Week" used as a visual icon or illustration in the assets UI.
2. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/apple-logo.png`

1. Sign in with Apple button on auth screen.
2. Bundled static asset under `assets/icons`.

### `assets/icons/arm-muscle.gif`

1. PNG/GIF image "arm muscle" used as a visual icon or illustration in the assets UI.
2. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/banned.png`

1. PNG/GIF image "banned" used as a visual icon or illustration in the assets UI.
2. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/burger.png`

1. PNG/GIF image "burger" used as a visual icon or illustration in the assets UI.
2. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/delete.png`

1. PNG/GIF image "delete" used as a visual icon or illustration in the assets UI.
2. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/dumbbell.png`

1. Workout-related UI — exercise and training sections.
2. Bundled static asset under `assets/icons`.

### `assets/icons/energy.png`

1. Energy level icon on home stats and daily metrics.
2. Bundled static asset under `assets/icons`.

### `assets/icons/enviro.png`

1. PNG/GIF image "enviro" used as a visual icon or illustration in the assets UI.
2. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/environment.png`

1. PNG/GIF image "environment" used as a visual icon or illustration in the assets UI.
2. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/google_gemini.png`

1. AI Coach nav icon — indicates Gemini-powered coach features.
2. Bundled static asset under `assets/icons`.

### `assets/icons/height.png`

1. Height input icon during onboarding.
2. Bundled static asset under `assets/icons`.

### `assets/icons/hydration.png`

1. Water/hydration tracking icon on home stats and daily metrics.
2. Bundled static asset under `assets/icons`.

### `assets/icons/injury.png`

1. PNG/GIF image "injury" used as a visual icon or illustration in the assets UI.
2. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/journey.png`

1. PNG/GIF image "journey" used as a visual icon or illustration in the assets UI.
2. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/people.png`

1. PNG/GIF image "people" used as a visual icon or illustration in the assets UI.
2. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/picture.png`

1. PNG/GIF image "picture" used as a visual icon or illustration in the assets UI.
2. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/scales.png`

1. Weight/body metrics icon in onboarding and profile.
2. Bundled static asset under `assets/icons`.

### `assets/icons/settings.png`

1. Settings gear icon in headers and menus.
2. Bundled static asset under `assets/icons`.

### `assets/icons/sleeping.png`

1. Sleep tracking icon on home stats and daily metrics.
2. Bundled static asset under `assets/icons`.

### `assets/icons/stress.png`

1. PNG/GIF image "stress" used as a visual icon or illustration in the assets UI.
2. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/supplement.png`

1. PNG/GIF image "supplement" used as a visual icon or illustration in the assets UI.
2. Loaded with `require()` — not executable code; safe to rename if you update all import paths.

### `assets/icons/weightlifting-competition.json`

1. Lottie animation "weightlifting competition" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `assets/icons`.

### `assets/icons/workout.png`

1. Workout tab and plan-related navigation icons.
2. Bundled static asset under `assets/icons`.

## assets/icons/New Icons {#assets-icons-New-Icons}

**Folder purpose:** Onboarding picker icons (equipment, experience level, gender).

### `assets/icons/New Icons/Advanced.png`

1. Onboarding — advanced fitness experience level option.
2. Bundled static asset under `assets/icons/New Icons`.

### `assets/icons/New Icons/Age.png`

1. Onboarding picker icon: Age. Shown when the user selects equipment, experience, gender, or similar profile options.
2. Duplicated/consolidated asset path so onboarding screens can import icons consistently.

### `assets/icons/New Icons/Beginner.png`

1. Onboarding — beginner fitness experience level option.
2. Bundled static asset under `assets/icons/New Icons`.

### `assets/icons/New Icons/Bodyweight Only.png`

1. Onboarding picker icon: Bodyweight Only. Shown when the user selects equipment, experience, gender, or similar profile options.
2. Duplicated/consolidated asset path so onboarding screens can import icons consistently.

### `assets/icons/New Icons/Full Gym.png`

1. Onboarding picker icon: Full Gym. Shown when the user selects equipment, experience, gender, or similar profile options.
2. Duplicated/consolidated asset path so onboarding screens can import icons consistently.

### `assets/icons/New Icons/Intermediate.png`

1. Onboarding — intermediate fitness experience level option.
2. Bundled static asset under `assets/icons/New Icons`.

### `assets/icons/New Icons/Other.png`

1. Onboarding picker icon: Other. Shown when the user selects equipment, experience, gender, or similar profile options.
2. Duplicated/consolidated asset path so onboarding screens can import icons consistently.

### `assets/icons/New Icons/Pull Up Bar.png`

1. Onboarding picker icon: Pull Up Bar. Shown when the user selects equipment, experience, gender, or similar profile options.
2. Duplicated/consolidated asset path so onboarding screens can import icons consistently.

### `assets/icons/New Icons/Resistance Bands.png`

1. Onboarding picker icon: Resistance Bands. Shown when the user selects equipment, experience, gender, or similar profile options.
2. Duplicated/consolidated asset path so onboarding screens can import icons consistently.

### `assets/icons/New Icons/dumbbells.png`

1. Onboarding — home gym equipment option (dumbbells only).
2. Bundled static asset under `assets/icons/New Icons`.

### `assets/icons/New Icons/female.png`

1. Onboarding — gender selection (female).
2. Bundled static asset under `assets/icons/New Icons`.

### `assets/icons/New Icons/male.png`

1. Onboarding — gender selection (male).
2. Bundled static asset under `assets/icons/New Icons`.

### `assets/icons/New Icons/prefer not to say.png`

1. Onboarding — gender prefer-not-to-say option.
2. Bundled static asset under `assets/icons/New Icons`.

## assets/onboarding-consolidated {#assets-onboarding-consolidated}

**Folder purpose:** Flattened onboarding icon set (duplicate paths for consolidated imports).

### `assets/onboarding-consolidated/Advanced.png`

1. Onboarding — advanced fitness experience level option.
2. Bundled static asset under `assets/onboarding-consolidated`.

### `assets/onboarding-consolidated/Age.png`

1. Onboarding picker icon: Age. Shown when the user selects equipment, experience, gender, or similar profile options.
2. Duplicated/consolidated asset path so onboarding screens can import icons consistently.

### `assets/onboarding-consolidated/Beginner.png`

1. Onboarding — beginner fitness experience level option.
2. Bundled static asset under `assets/onboarding-consolidated`.

### `assets/onboarding-consolidated/Intermediate.png`

1. Onboarding — intermediate fitness experience level option.
2. Bundled static asset under `assets/onboarding-consolidated`.

### `assets/onboarding-consolidated/Other.png`

1. Onboarding picker icon: Other. Shown when the user selects equipment, experience, gender, or similar profile options.
2. Duplicated/consolidated asset path so onboarding screens can import icons consistently.

### `assets/onboarding-consolidated/bodyweight_only.png`

1. Onboarding — bodyweight-only training option.
2. Bundled static asset under `assets/onboarding-consolidated`.

### `assets/onboarding-consolidated/dumbbells.png`

1. Onboarding — home gym equipment option (dumbbells only).
2. Bundled static asset under `assets/onboarding-consolidated`.

### `assets/onboarding-consolidated/female.png`

1. Onboarding — gender selection (female).
2. Bundled static asset under `assets/onboarding-consolidated`.

### `assets/onboarding-consolidated/full_gym.png`

1. Onboarding — full commercial gym equipment option.
2. Bundled static asset under `assets/onboarding-consolidated`.

### `assets/onboarding-consolidated/height.png`

1. Height input icon during onboarding.
2. Bundled static asset under `assets/onboarding-consolidated`.

### `assets/onboarding-consolidated/male.png`

1. Onboarding — gender selection (male).
2. Bundled static asset under `assets/onboarding-consolidated`.

### `assets/onboarding-consolidated/prefer_not_to_say.png`

1. Onboarding — gender prefer-not-to-say option.
2. Bundled static asset under `assets/onboarding-consolidated`.

### `assets/onboarding-consolidated/pull_up_bar.png`

1. Onboarding picker icon: pull up bar. Shown when the user selects equipment, experience, gender, or similar profile options.
2. Duplicated/consolidated asset path so onboarding screens can import icons consistently.

### `assets/onboarding-consolidated/resistance_bands.png`

1. Onboarding picker icon: resistance bands. Shown when the user selects equipment, experience, gender, or similar profile options.
2. Duplicated/consolidated asset path so onboarding screens can import icons consistently.

### `assets/onboarding-consolidated/scales.png`

1. Weight/body metrics icon in onboarding and profile.
2. Bundled static asset under `assets/onboarding-consolidated`.

## auth {#auth}

**Folder purpose:** Login, signup, password reset, onboarding wizard, and auth-gate helper logic.

### `auth/LoginScreen.js`

1. Login Screen — the screen the user sees for this part of the auth flow.
2. Reads or writes Firebase Firestore documents; renders Lottie animations in the UI; renders gradient backgrounds and buttons.

### `auth/OnboardingWizardScreen.jsx`

1. Onboarding Wizard Screen — the screen the user sees for this part of the auth flow.
2. Reads or writes Firebase Firestore documents; renders Lottie animations in the UI; renders gradient backgrounds and buttons.

### `auth/ResetPasswordScreen.jsx`

1. Reset Password Screen — full-screen React Native view in `auth`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in auth.

### `auth/detectUserRole.js`

1. Helper functions for AuthGate: normalizeAppRole, profileNeedsOnboarding, isLikelyNewFirebaseUser.
2. Exported for unit tests in authGate.test.js — not UI, just boolean routing decisions.

### `auth/finishOnboarding.js`

1. Client-side onboarding completion writes (extracted from OnboardingWizardScreen.handleFinish).
2. Hits API routes /api/onboarding/complete; uses Firestore (`users`).

### `auth/normalizeOnboardingRole.js`

1. Normalizes whether the user chose client or trainer during onboarding into values AuthGate expects.
2. Prevents role string mismatches ('Client' vs 'client') from routing to the wrong app shell.

### `auth/validateTrainerInviteCode.js`

1. Normalize client input to match stored format (XXX-XXX). Returns null if invalid.
2. Hits API routes /api/onboarding/validate-trainer-code.

## auth/services {#auth-services}

**Folder purpose:** Password-reset email requests via Firebase/backend.

### `auth/services/requestPasswordReset.js`

1. Request a password reset email — branded via API when deployed, else Firebase client SDK.
2. Continue URL must be on Firebase Authorized domains — not an undeployed API path.

### `auth/services/sendPasswordResetEmail.js`

1. Thin wrapper that triggers password-reset email via Firebase or the backend API.
2. Called from ForgotPasswordFlow screens when the user submits their email.

## client-app/components {#client-app-components}

**Folder purpose:** Source files for the `client-app/components` module.

### `client-app/components/ReviewSubmitSheet.js`

1. Review Submit Sheet — bottom sheet that slides up for a quick decision or form.
2. Reads or writes Firebase Firestore documents.

### `client-app/components/TrainerSharedFilesModal.jsx`

1. Trainer Shared Files Modal — popup overlay on top of the current screen.
2. User dismisses it after completing the action or tapping Cancel.

## client-app/dashboard {#client-app-dashboard}

**Folder purpose:** Source files for the `client-app/dashboard` module.

### `client-app/dashboard/DashboardHeroCard.jsx`

1. Matches Aurora hero + Settings: dark pink → dark orange.
2. UI labels include "Workouts".

### `client-app/dashboard/PremiumStatsSection.jsx`

1. Premium Stats Section — renders gradient backgrounds and buttons.
2. Part of client in Coach Connect.

### `client-app/dashboard/PremiumTrainerCard.jsx`

1. Premium Trainer Card — renders gradient backgrounds and buttons.
2. UI labels include "Message".

### `client-app/dashboard/TrainingDashboardScreen.jsx`

1. Training Dashboard Screen — the screen the user sees for this part of the client-app flow.
2. Writes weight, sleep, steps, water to dailyLogs; reads or writes Firebase Firestore documents; renders Lottie animations in the UI.

### `client-app/dashboard/useWorkoutLog.js`

1. Hook: writes weight, sleep, steps, water to dailyLogs.
2. Screens call this hook instead of putting fetch/Firestore logic inline in JSX.

## client-app/files {#client-app-files}

**Folder purpose:** Source files for the `client-app/files` module.

### `client-app/files/ClientFilesScreen.jsx`

1. Client Files Screen — the screen the user sees for this part of the client-app flow.
2. Renders gradient backgrounds and buttons.

### `client-app/files/FileCard.jsx`

1. File Card — renders gradient backgrounds and buttons.
2. UI labels include "Photo".

### `client-app/files/MyFilesSection.jsx`

1. My Files Section — lets the user pick photos from the camera roll.
2. Renders gradient backgrounds and buttons; UI labels include "All Files".

### `client-app/files/NotesFromTrainerSection.jsx`

1. Notes From Trainer Section in `client-app/files`.
2. Part of client in Coach Connect.

### `client-app/files/TrainerSharedSection.jsx`

1. Trainer Shared Section in `client-app/files`.
2. UI labels include "Documents".

## client-app/home {#client-app-home}

**Folder purpose:** Source files for the `client-app/home` module.

### `client-app/home/ClientHomeScreen.styles.js`

1. @deprecated Use clientAppStyles.js — kept for baseline / legacy imports.
2. Part of `client-app/home` — search the repo for "ClientHomeScreen.styles" to see what imports it before renaming.

### `client-app/home/PremiumWelcomeCard.jsx`

1. PremiumWelcomeCard - Glass card with mascot/illustration, personalized greeting, and one clear primary action.
2. Renders gradient backgrounds and buttons.

### `client-app/home/clientAppStyles.js`

1. Wellness row: stack title + value as one centered group (no space-between gap).
2. Client App Styles Purpose: client App Styles — Feature module for Coach Connect. Why it matters: Area: src/client Key exports: CARD_GAP, SCREEN_WIDTH, STATS_ROW_PAD_H, STATS_ROW_CARD_GAP.

### `client-app/home/clientHomeComponents.jsx`

1. Client Home Components — renders Lottie animations in the UI.
2. Renders gradient backgrounds and buttons; UI labels include "Calories".

### `client-app/home/useClientHomeBootstrap.js`

1. Hook: writes a logged food entry to the user daily nutrition log.
2. Screens call this hook instead of putting fetch/Firestore logic inline in JSX.

### `client-app/home/useClientHomeNutrition.js`

1. Hook: writes a logged food entry to the user daily nutrition log.
2. Screens call this hook instead of putting fetch/Firestore logic inline in JSX.

## client-app/hooks {#client-app-hooks}

**Folder purpose:** Source files for the `client-app/hooks` module.

### `client-app/hooks/useClientHomeDailyMetrics.js`

1. Hook: writes weight, sleep, steps, water to dailyLogs.
2. Screens call this hook instead of putting fetch/Firestore logic inline in JSX.

## client-app/lib {#client-app-lib}

**Folder purpose:** Source files for the `client-app/lib` module.

### `client-app/lib/coachingBillingLabel.js`

1. Client coaching subscription pill copy (dashboard trainer card).
2. UI labels include "Coaching · ${rateLabel}".

## client-app/marketplace {#client-app-marketplace}

**Folder purpose:** Source files for the `client-app/marketplace` module.

### `client-app/marketplace/marketplaceFilters.js`

1. Marketplace filter shape, theme tokens, and filter logic (reference UI spec; Firebase as source).
2. Marketplace Filters Purpose: marketplace Filters — Feature module for Coach Connect. Why it matters: Area: src/marketplace Key exports: getGlass, specPillGradient, getTheme, trainerFirstName, gradColor, gradGradient, getTrainerPrice, normalizeTrainer.

## client-app/marketplace/components {#client-app-marketplace-components}

**Folder purpose:** Source files for the `client-app/marketplace/components` module.

### `client-app/marketplace/components/FilterModal.js`

1. Filter Modal — popup overlay on top of the current screen.
2. Renders gradient backgrounds and buttons.

### `client-app/marketplace/components/MarketplaceGlass.jsx`

1. Frosted glass panel — blur backdrop + translucent tint + soft top-lit border (web .glass-card).
2. Marketplace Glass Purpose: Marketplace Glass — Feature module for Coach Connect. Why it matters: Area: src/marketplace Key exports: MarketplaceGlass.

### `client-app/marketplace/components/MarketplaceTrainerProfileSheet.jsx`

1. Marketplace Trainer Profile Sheet — bottom sheet that slides up for a quick decision or form.
2. Renders gradient backgrounds and buttons.

### `client-app/marketplace/components/MarketplaceUI.jsx`

1. Pink → orange gradient text (web .text-gradient).
2. UI labels include "Filter".

### `client-app/marketplace/components/TrainerCard.jsx`

1. Trainer Card — renders gradient backgrounds and buttons.
2. Part of marketplace in Coach Connect.

### `client-app/marketplace/components/TrainerRequestConfirmModal.jsx`

1. Trainer Request Confirm Modal — popup overlay on top of the current screen.
2. Renders gradient backgrounds and buttons.

### `client-app/marketplace/components/TrainerRequestIntroModal.jsx`

1. Trainer Request Intro Modal — popup overlay on top of the current screen.
2. Renders gradient backgrounds and buttons.

## client-app/marketplace/screens {#client-app-marketplace-screens}

**Folder purpose:** Source files for the `client-app/marketplace/screens` module.

### `client-app/marketplace/screens/BrowseTrainersScreen.jsx`

1. Browse Trainers Screen — the screen the user sees for this part of the client-app flow.
2. Renders gradient backgrounds and buttons.

### `client-app/marketplace/screens/SearchTrainersScreen.jsx`

1. Search Trainers Screen — the screen the user sees for this part of the client-app flow.
2. Reads or writes Firebase Firestore documents.

## client-app/messaging {#client-app-messaging}

**Folder purpose:** Source files for the `client-app/messaging` module.

### `client-app/messaging/ConversationsListScreen.js`

1. Conversations List Screen — full-screen React Native view in `client-app/messaging`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in client-app.

### `client-app/messaging/MessagingScreen.js`

1. Messaging Screen — full-screen React Native view in `client-app/messaging`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in client-app.

## client-app/navigation {#client-app-navigation}

**Folder purpose:** Source files for the `client-app/navigation` module.

### `client-app/navigation/ClientAppShellContext.jsx`

1. Client App Shell Context in `client-app/navigation`.
2. Part of client in Coach Connect.

### `client-app/navigation/ClientMainScreen.jsx`

1. Client Main Screen — the screen the user sees for this part of the client-app flow.
2. Writes weight, sleep, steps, water to dailyLogs; reads or writes Firebase Firestore documents; registers or navigates between app screens.

### `client-app/navigation/ClientRootNavigator.jsx`

1. Client Root Navigator — registers or navigates between app screens.
2. Part of client in Coach Connect.

### `client-app/navigation/ClientShellBottomNav.jsx`

1. Floating bottom nav for client stack screens (Profile, Settings, etc.) so tab navigation stays available outside MainTabs.
2. Part of `client-app/navigation` — search the repo for "ClientShellBottomNav" to see what imports it before renaming.

### `client-app/navigation/ClientStackScreens.jsx`

1. @deprecated Use clientOverlayScreens.jsx — kept for baseline / legacy imports.
2. Part of `client-app/navigation` — search the repo for "ClientStackScreens" to see what imports it before renaming.

### `client-app/navigation/clientOverlayScreens.jsx`

1. Client Overlay Screens — reads or writes Firebase Firestore documents.
2. Uses Firestore (`users`).

### `client-app/navigation/useClientScreenNavigation.js`

1. Hook: registers or navigates between app screens.
2. Screens call this hook instead of putting fetch/Firestore logic inline in JSX.

## client-app/photo-gallery {#client-app-photo-gallery}

**Folder purpose:** Source files for the `client-app/photo-gallery` module.

### `client-app/photo-gallery/PhotoGalleryScreen.js`

1. Photo Gallery Screen — full-screen React Native view in `client-app/photo-gallery`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in client-app.

## client-app/profile {#client-app-profile}

**Folder purpose:** Source files for the `client-app/profile` module.

### `client-app/profile/ViewMyProfileScreen.jsx`

1. View My Profile Screen — the screen the user sees for this part of the client-app flow.
2. Reads or writes Firebase Firestore documents; lets the user pick photos from the camera roll; renders gradient backgrounds and buttons.

## client-app/screens {#client-app-screens}

**Folder purpose:** Source files for the `client-app/screens` module.

### `client-app/screens/BrowseSavedWorkoutsScreen.jsx`

1. Browse Saved Workouts Screen — full-screen React Native view in `client-app/screens`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in client-app.

### `client-app/screens/ChatWithTrainerScreen.jsx`

1. Chat With Trainer Screen — full-screen React Native view in `client-app/screens`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in client-app.

### `client-app/screens/LogTodaysMealsScreen.jsx`

1. Log Todays Meals Screen — the screen the user sees for this part of the client-app flow.
2. Writes a logged food entry to the user daily nutrition log; reads or writes Firebase Firestore documents; uses the device camera to scan product barcodes.

### `client-app/screens/MyMessagesScreen.jsx`

1. My Messages Screen — full-screen React Native view in `client-app/screens`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in client-app.

### `client-app/screens/MyProgressPhotosScreen.jsx`

1. My Progress Photos Screen — full-screen React Native view in `client-app/screens`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in client-app.

### `client-app/screens/ViewMyWorkoutPlanScreen.jsx`

1. View My Workout Plan Screen — the screen the user sees for this part of the client-app flow.
2. Renders gradient backgrounds and buttons.

### `client-app/screens/ViewWeekProgressReportScreen.jsx`

1. View Week Progress Report Screen — full-screen React Native view in `client-app/screens`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in client-app.

## client-app/settings {#client-app-settings}

**Folder purpose:** Source files for the `client-app/settings` module.

### `client-app/settings/DataStorageScreen.jsx`

1. Data Storage Screen — full-screen React Native view in `client-app/settings`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in client-app.

### `client-app/settings/EditAccountScreen.jsx`

1. Edit Account Screen — full-screen React Native view in `client-app/settings`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in client-app.

### `client-app/settings/EditFitnessGoalsScreen.jsx`

1. Edit Fitness Goals Screen — full-screen React Native view in `client-app/settings`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in client-app.

### `client-app/settings/NotificationsSettingsScreen.jsx`

1. Notifications Settings Screen — full-screen React Native view in `client-app/settings`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in client-app.

### `client-app/settings/PrivacySecurityScreen.jsx`

1. Privacy Security Screen — full-screen React Native view in `client-app/settings`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in client-app.

### `client-app/settings/SocialSharingScreen.jsx`

1. Social Sharing Screen — full-screen React Native view in `client-app/settings`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in client-app.

### `client-app/settings/UnitsMeasurementsScreen.jsx`

1. Units Measurements Screen — full-screen React Native view in `client-app/settings`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in client-app.

## client-app/weekly-report {#client-app-weekly-report}

**Folder purpose:** Source files for the `client-app/weekly-report` module.

### `client-app/weekly-report/WeeklyReportScreen.jsx`

1. Weekly Report Screen — full-screen React Native view in `client-app/weekly-report`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in client-app.

## client-app/workout-plans {#client-app-workout-plans}

**Folder purpose:** Source files for the `client-app/workout-plans` module.

### `client-app/workout-plans/AIWorkoutPlansScreen.js`

1. AIWorkout Plans Screen — full-screen React Native view in `client-app/workout-plans`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in client-app.

## lib {#lib}

**Folder purpose:** Small shared libraries at src root (sessions helper).

### `lib/sessions.js`

1. Date/time formatting helpers for trainer session scheduling (pad2, long date, 12-hour time).
2. Used by session cards and calendar views to display human-readable session times.

## messaging {#messaging}

**Folder purpose:** Source files for the `messaging` module.

### `messaging/ChatThreadScreen.jsx`

1. Chat Thread Screen — the screen the user sees for this part of the messaging flow.
2. Reads or writes Firebase Firestore documents; lets the user pick photos from the camera roll; renders gradient backgrounds and buttons.

### `messaging/MyMessagesScreen.jsx`

1. My Messages Screen — the screen the user sees for this part of the messaging flow.
2. Reads or writes Firebase Firestore documents; renders gradient backgrounds and buttons.

## metrics/daily-metrics {#metrics-daily-metrics}

**Folder purpose:** Source files for the `metrics/daily-metrics` module.

### `metrics/daily-metrics/archiveDailyMetricsAtMidnight.js`

1. Archive yesterday's dashboard metrics into `daily_logs/{uid}_{date}`. Idempotent merge write.
2. Caches data locally on the device between app launches; uses Firestore (`users`).

### `metrics/daily-metrics/getRecentWeight.js`

1. Resolves the client's most recent logged weight from dailyLogs (dashboard_weight). Used for trainer progress "Current" when today has no weight entry — not profile weight.
2. Uses Firestore (`users`).

### `metrics/daily-metrics/parseUserDailyMetrics.js`

1. Pure parse/mirror helpers (CJS for Node tests). Keep in sync with dailyMetricsService.js.
2. Pure parse/mirror helpers (CJS for Node tests). Keep in sync with dailyMetricsService.js.

### `metrics/daily-metrics/saveDailyMetricsToFirestore.js`

1. Canonical client daily metrics: `users/{uid}/dailyLogs/{date}`. Mirrors home-screen fields into `daily_tracking` on write (legacy compat).
2. Centralizes collection paths and query shapes for this feature.

### `metrics/daily-metrics/useLocalTodayDateKey.js`

1. Use Local Today Date Key — React hook encapsulating data loading and state for metrics/daily-metrics.
2. Screens call this hook instead of putting fetch/Firestore logic inline in JSX.

## metrics/daily-quotes {#metrics-daily-quotes}

**Folder purpose:** Source files for the `metrics/daily-quotes` module.

### `metrics/daily-quotes/dailyQuotesList.json`

1. JSON array of motivational quotes rotated on the client home "daily quote" card.
2. No logic in this file — `DailyQuoteCard` imports and picks a quote by date.

## navigation {#navigation}

**Folder purpose:** Cross-app navigation utilities (shell navigate helper).

### `navigation/AppNavigationContext.js`

1. AppNavigationContext - Centralized navigation for CoachConnect header and bottom nav Apps (ClientApp, TrainerApp) provide handlers via the provider. CoachConnectHeader and BottomNavBar consume this context, falling back to props when no provider. This keeps navigation logic out of app files and in the shared components.
2. App Navigation Context Purpose: App Navigation Context — Feature module for Coach Connect. Why it matters: Area: src/navigation Key exports: AppNavigationProvider, useAppNavigation, useMergedNavigation.

### `navigation/BottomNavBar.js`

1. Logo-aligned vertical gradient for all tab icons (pink → purple → indigo).
2. Caches data locally on the device between app launches.

### `navigation/CustomNavigationBar.jsx`

1. Custom Navigation Bar in `navigation`.
2. Part of navigation in Coach Connect.

### `navigation/bottomNavMetrics.js`

1. Visual height of BottomNavBar (excludes home-indicator inset).
2. Bottom Nav Metrics Purpose: bottom Nav Metrics — Feature module for Coach Connect. Why it matters: Area: src/navigation Key exports: useShellBottomNavInset, BOTTOM_NAV_BAR_HEIGHT.

### `navigation/linking.js`

1. Deep linking stub — expand when universal links are configured.
2. Linking Purpose: linking — Feature module for Coach Connect. Why it matters: Area: src/navigation Key exports: clientLinking, trainerLinking.

### `navigation/navigationRef.js`

1. Global React Navigation ref so code outside components can navigate (rootNavigate, goBack, reset).
2. Used by push notifications and deep links that need to open a specific screen.

### `navigation/routes.js`

1. React Navigation route names — keep stable for deep linking stubs.
2. Prevents typos when pushing screens — import ROUTES.X instead of raw strings.

### `navigation/shellNavigate.js`

1. Resolve stack/tab navigation from app shell when a screen prop is missing.
2. Shell Navigate Purpose: shell Navigate — Feature module for Coach Connect. Why it matters: Area: src/navigation Key exports: buildNavigateFromShell, useShellNavigate.

## notifications {#notifications}

**Folder purpose:** Source files for the `notifications` module.

### `notifications/buildPushNotificationText.js`

1. DetailLine e.g. "Session scheduled: Mon at 3:00 PM".
2. Push Copy Purpose: push Copy — Feature module for Coach Connect. Why it matters: Area: src/shared Key exports: pickRandom, randomTrainerMessageTitle, randomClientRequestTitle, randomSessionUpdateClientBody, randomSessionCancelledClientBody, randomSessionResponseTrainerMessage, randomNotesSharedBody, randomSessionScheduledTitle.

### `notifications/manageNotifications.js`

1. @type {((data: Record<string, unknown>) => void) | null}.
2. Caches data locally on the device between app launches; uses Firestore (`users`).

### `notifications/stripNotificationEmoji.js`

1. Remove emoji / pictographs from push notification title and body (client). Keep logic aligned with server/stripNotificationEmoji.js.
2. Strip Notification Emoji Purpose: strip Notification Emoji — Feature module for Coach Connect. Why it matters: Area: src/shared Key exports: stripNotificationEmoji.

## nutrition {#nutrition}

**Folder purpose:** Full nutrition feature: daily log, food search, barcode, facts, settings, premium food cards.

### `nutrition/nutritionTheme.js`

1. Color gradients and tokens for nutrition UI (calorie ring, macro bars, action buttons).
2. Import NUT_* constants so food cards and the daily log share the same visual language.

## nutrition/barcode {#nutrition-barcode}

**Folder purpose:** Barcode scanner flow and Serper/USDA lookup for packaged foods.

### `nutrition/barcode/BarcodeScannerScreen.js`

1. Barcode Scanner Screen — the screen the user sees for this part of the nutrition flow.
2. Writes a logged food entry to the user daily nutrition log; uses the device camera to scan product barcodes; requests camera access for barcode or photo capture.

### `nutrition/barcode/normalizeBarcodeForLookup.js`

1. Fixes barcode digits from the camera (leading zeros, UPC-A vs EAN-13) before server lookup.
2. Mobile scanners often drop check digits; this prevents false 'product not found' results.

### `nutrition/barcode/renderScannedBarcode.js`

1. Formats scanned barcode results for display: macro summary, source label, and confidence badge.
2. Used after a successful barcode lookup to show what the user scanned before they log it.

### `nutrition/barcode/validateBarcodeFood.js`

1. Reject junk barcode hits (GS1 tracker pages, zero-macro Serper guesses, etc.) Shared by client scanner + server /api/food/barcode.
2. @returns {boolean} true when safe to show on Confirm & log.

## nutrition/components {#nutrition-components}

**Folder purpose:** Shared nutrition UI widgets (gradient frames, etc.).

### `nutrition/components/GradientFieldFrame.jsx`

1. Soft violet→mauve→steel border (matches FoodSearchScreen, not harsh rainbow).
2. Gradient Field Frame Purpose: Gradient Field Frame — Feature module for Coach Connect. Why it matters: Area: src/nutrition Key exports: GradientFieldFrame.

## nutrition/components/premiumFoodCard {#nutrition-components-premiumFoodCard}

**Folder purpose:** Premium-styled food card, nutrition facts section, logged-food display.

### `nutrition/components/premiumFoodCard/FoodCard.jsx`

1. Premium expandable food logging card.
2. UI labels include "Edit food".

### `nutrition/components/premiumFoodCard/GradientText.jsx`

1. Renders gradient-colored text using MaskedView (React Native has no CSS background-clip).
2. Used on premium food cards for stylized calorie/macro numbers.

### `nutrition/components/premiumFoodCard/LoggedFoodCard.jsx`

1. Single logged-food row in the daily meal list — transparent card over the meal section background.
2. Shows food name, serving, calories, and tap-to-edit; used inside NutritionContainer meal cards.

### `nutrition/components/premiumFoodCard/NutritionFactsSection.jsx`

1. Premium expanded nutrition breakdown — macro split + stylized facts panel.
2. UI labels include "Fiber".

### `nutrition/components/premiumFoodCard/NutritionFoodListScreen.jsx`

1. Nutrition Food List Screen — full-screen React Native view in `nutrition/components/premiumFoodCard`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in nutrition.

### `nutrition/components/premiumFoodCard/formatLoggedFoodDisplay.js`

1. Maps a logged food entry (Firestore / meal list) to premium FoodCard shape.
2. UI labels include "Chobani · 1 bowl · 320g".

### `nutrition/components/premiumFoodCard/index.js`

1. Barrel export file — re-exports FoodCard, LoggedFoodCard, NutritionFactsSection for clean imports.
2. Import from this index instead of individual files when using the premium food card kit.

### `nutrition/components/premiumFoodCard/theme.js`

1. Premium food card design tokens — gold, dark orange, dark pink palette.
2. Dark gold → bright gold.

## nutrition/daily-log {#nutrition-daily-log}

**Folder purpose:** Daily nutrition log screen, meal cards, Firestore write helpers.

### `nutrition/daily-log/MacroBar.js`

1. Macro Bar in `nutrition/daily-log`.
2. Part of nutrition in Coach Connect.

### `nutrition/daily-log/MealCard.js`

1. Meal Card — renders gradient backgrounds and buttons.
2. Part of nutrition in Coach Connect.

### `nutrition/daily-log/NutritionContainer.jsx`

1. Parent tab bar overlays content (e.g. ClientMainScreen absolute BottomNavBar).
2. Reads or writes Firebase Firestore documents; uses the device camera to scan product barcodes; UI labels include "Protein".

### `nutrition/daily-log/NutritionDayPicker.jsx`

1. Week calendar — circular day buttons with prev/next week navigation.
2. Nutrition Day Picker Purpose: Nutrition Day Picker — Feature module for Coach Connect. Why it matters: Area: src/nutrition Key exports: NutritionDayPicker.

### `nutrition/daily-log/NutritionScreen.jsx`

1. Nutrition Screen — the screen the user sees for this part of the nutrition flow.
2. Renders Lottie animations in the UI; renders gradient backgrounds and buttons.

### `nutrition/daily-log/logFoodToFirestore.js`

1. Peel nested metadata.metadata… layers and drop undefined before Firestore writes.
2. Centralizes collection paths and query shapes for this feature.

## nutrition/food-details {#nutrition-food-details}

**Folder purpose:** Food detail / nutrition facts screen, serving editor, label parsing.

### `nutrition/food-details/EditServingModal.jsx`

1. Edit Serving Modal — popup overlay on top of the current screen.
2. Renders gradient backgrounds and buttons.

### `nutrition/food-details/FoodItem.js`

1. Food Item — renders gradient backgrounds and buttons.
2. Part of nutrition in Coach Connect.

### `nutrition/food-details/NutritionFactsScreen.jsx`

1. Nutrition Facts Screen — the screen the user sees for this part of the nutrition flow.
2. Writes a logged food entry to the user daily nutrition log; renders gradient backgrounds and buttons.

### `nutrition/food-details/calculateServingSize.js`

1. Shared serving / gram math for barcode and per-100g food sources. calories and macros on openfoodfacts + usda barcode hits are per 100 g (or 100 ml).
2. Serving Math Purpose: serving Math — Feature module for Coach Connect. Why it matters: Area: src/nutrition Key exports: PER_100G_SOURCES, MAX_SANE_KCAL_PER_100, isPer100gSource, resolveServingGrams, resolveServingFactor, nutrientTotalForGrams, caloriesForGrams, scaleMacroForGrams.

### `nutrition/food-details/cleanFoodBrandName.js`

1. Consumer-facing brands that should win over parent-company prefixes in titles.
2. Food Brand Display Purpose: Serving size editor and nutrition facts detail views. Food Brand Display supports the `nutrition/food-details` feature area — helpers, parsers, or UI pieces used by nearby files. Logic module with exports: see file for exports. Why it matters: Nutrition tracking — food logs, macros, search, barcode, meal planning. Check who imports this file before refactoring. Area: nutrition/food-details Key exports: see file for exports.

### `nutrition/food-details/fixFoodNutritionNumbers.js`

1. Nutrition portion normalization for Open Food Facts and other sources. Parses product.quantity (e.g. "500 ml", "16.9 fl oz", "340 g") and computes default serving amount + total calories so full packages (e.g. Pepsi bottle) log correctly.
2. Nutrition Normalization Purpose: nutrition Normalization — Feature module for Coach Connect. Why it matters: Area: src/nutrition Key exports: parseQuantityToGramsOrMl, normalizeOpenFoodFactsProduct, getKcalPer100, num, numOrNull.

### `nutrition/food-details/nutritionFactsModel.js`

1. Build a full nutrition-facts view model from a logged food entry.
2. UI labels include "Calories".

### `nutrition/food-details/parseNutritionLabel.js`

1. Build a full nutrition-facts view model from a logged food entry.
2. UI labels include "Calories".

## nutrition/food-search {#nutrition-food-search}

**Folder purpose:** Food search screen, ranking, consensus search, confirm-selection sheet.

### `nutrition/food-search/ConfirmFoodSelectionSheet.jsx`

1. Confirm Food Selection Sheet — bottom sheet that slides up for a quick decision or form.
2. Renders gradient backgrounds and buttons.

### `nutrition/food-search/FoodSearchScreen.js`

1. Food Search Screen — the screen the user sees for this part of the nutrition flow.
2. Writes a logged food entry to the user daily nutrition log; renders gradient backgrounds and buttons.

### `nutrition/food-search/SearchQualityCard.jsx`

1. Hero disclaimer for food search — matches DashboardHeroCard / marketplace heroes.
2. UI labels include "Calories"; part of search → pick food → log to daily nutrition.

### `nutrition/food-search/cleanFoodCardLabels.js`

1. Clean web-search (Serper) titles for food cards — never show [PDF] / "Nutrition Information".
2. Part of search → pick food → log to daily nutrition.

### `nutrition/food-search/guessServingSize.js`

1. Infer human-readable serving labels for food search cards (all sources). Avoids generic "100g serving" for restaurant/menu items when we can do better.
2. Part of search → pick food → log to daily nutrition.

### `nutrition/food-search/isReliableRestaurantFood.js`

1. Generic Serper quality for restaurant / menu-item searches (no per-chain hardcoding). Used by server nutritionSearchHelpers + food search ranking.
2. Part of search → pick food → log to daily nutrition.

### `nutrition/food-search/makeReadableFoodTitle.js`

1. Canonical food display names — one pipeline for search, confirm, log, and read-back.
2. Part of search → pick food → log to daily nutrition.

### `nutrition/food-search/mergeFoodNutritionSources.js`

1. Client helpers for POST /api/nutrition/search — multi-source consensus rows.
2. UI labels include "McDonald"; part of search → pick food → log to daily nutrition.

### `nutrition/food-search/normalizeFoodQuery.js`

1. Shared food normalization + serving unit guards for search, barcode, and logging.
2. Part of search → pick food → log to daily nutrition.

### `nutrition/food-search/searchFoodsService.js`

1. Singleton class that runs all food search: server API, consensus search, Open Food Facts fallback, and local cache.
2. FoodSearchScreen calls search() here — you should not call food APIs directly from UI components.

### `nutrition/food-search/sortBestFoodMatches.js`

1. Menu / prepared-food language — not a brand list.
2. Part of search → pick food → log to daily nutrition.

## nutrition/quick-add {#nutrition-quick-add}

**Folder purpose:** Quick-add macros without full food search.

### `nutrition/quick-add/QuickAddNutrition.jsx`

1. * Quick Add Nutrition * * Purpose: UI screen or component: Quick Add Nutrition. Feature module for Coach Connect. * Why 
2. Renders gradient backgrounds and buttons; UI labels include "rgba(255,255,255,0.38)".

## nutrition/screens {#nutrition-screens}

**Folder purpose:** Standalone nutrition screens (macro tracker).

### `nutrition/screens/MacroTrackerScreen.js`

1. Macro Tracker Screen — the screen the user sees for this part of the nutrition flow.
2. Writes a logged food entry to the user daily nutrition log.

## nutrition/settings {#nutrition-settings}

**Folder purpose:** Nutrition onboarding wizard and macro/target settings.

### `nutrition/settings/NutritionOnboardingScreen.jsx`

1. Nutrition Onboarding Screen — the screen the user sees for this part of the nutrition flow.
2. Reads or writes Firebase Firestore documents; renders gradient backgrounds and buttons.

### `nutrition/settings/NutritionSettingsScreen.js`

1. Settings screen to edit daily calorie goal, macro split, and nutrition preferences after initial onboarding.
2. Changes here update what the daily log rings and AI coach context use as targets.

## nutrition/utils {#nutrition-utils}

**Folder purpose:** Nutrition-specific search helpers (casual menu search).

### `nutrition/utils/casualMenuSearch.js`

1. Casual restaurant search — users type short queries like: "mcdonalds big mac", "chick fil a sandwich", "chipotle chicken bowl", "dominos large pepperoni slice", "starbucks grande latte" Server-side only: enriches Serper + ranking. The user's typed query is unchanged in UI.
2. UI labels include "McDonald".

## settings {#settings}

**Folder purpose:** App-wide settings screens, support config, and legal pages.

### `settings/supportConfig.js`

1. Shown in Privacy Policy, Terms, Contact Support, etc. Override with EXPO_PUBLIC_SUPPORT_EMAIL in .env if needed.
2. Support Config Purpose: support Config — Feature module for Coach Connect. Why it matters: Area: src/settings Key exports: getSupportEmail, DEFAULT_SUPPORT_EMAIL.

### `settings/supportMailto.js`

1. Opens the device mail app to coachconnect0@gmail.com (or configured support inbox).
2. When the API cannot send (no Resend/SMTP on server), offer the same content via mailto.

## settings/screens {#settings-screens}

**Folder purpose:** Settings hub and sub-screens (password, FAQ, bug report, rest timer, etc.).

### `settings/screens/AboutAppScreen.jsx`

1. About App Screen — full-screen React Native view in `settings/screens`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in settings.

### `settings/screens/BugReportScreen.jsx`

1. Bug Report Screen — the screen the user sees for this part of the settings flow.
2. Renders gradient backgrounds and buttons.

### `settings/screens/ChangePasswordScreen.jsx`

1. Change Password Screen — full-screen React Native view in `settings/screens`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in settings.

### `settings/screens/ContactSupportScreen.jsx`

1. Contact Support Screen — the screen the user sees for this part of the settings flow.
2. Renders gradient backgrounds and buttons.

### `settings/screens/EditProfileScreen.jsx`

1. Edit Profile Screen — full-screen React Native view in `settings/screens`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in settings.

### `settings/screens/EmailPreferencesScreen.jsx`

1. Email Preferences Screen — full-screen React Native view in `settings/screens`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in settings.

### `settings/screens/ForgotPasswordFlow.js`

1. Forgot Password Flow — renders gradient backgrounds and buttons.
2. UI labels include "Go back".

### `settings/screens/HelpFAQScreen.jsx`

1. Help FAQScreen — the screen the user sees for this part of the settings flow.
2. Renders gradient backgrounds and buttons.

### `settings/screens/PrivacyPolicyScreen.jsx`

1. Privacy Policy Screen — the screen the user sees for this part of the settings flow.
2. Renders gradient backgrounds and buttons.

### `settings/screens/RestTimerSettingsScreen.jsx`

1. Rest Timer Settings Screen — full-screen React Native view in `settings/screens`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in settings.

### `settings/screens/SettingsScreen.js`

1. Settings Screen — the screen the user sees for this part of the settings flow.
2. Reads or writes Firebase Firestore documents; renders gradient backgrounds and buttons.

### `settings/screens/TermsOfServiceScreen.jsx`

1. Terms Of Service Screen — the screen the user sees for this part of the settings flow.
2. Renders gradient backgrounds and buttons.

### `settings/screens/WorkoutRemindersSettingsScreen.jsx`

1. Workout Reminders Settings Screen — full-screen React Native view in `settings/screens`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in settings.

### `settings/screens/useSettingsPageFrame.js`

1. Use Settings Page Frame — React hook encapsulating data loading and state for settings/screens.
2. Screens call this hook instead of putting fetch/Firestore logic inline in JSX.

## shared-ui {#shared-ui}

**Folder purpose:** Source files for the `shared-ui` module.

### `shared-ui/BlurBackdropPlate.jsx`

1. Use blur as a backdrop only. Do not nest {@link Image}, vector icons, MaskedView, or TextInput inside {@link BlurView} — on iOS/Android (including Expo Go) they often fail to composite (blank, flicker, or vanish until layout changes). Children render in a normal layer above the blur. If `style` includes flex layout (e.g. `flexDirection: 'row'`), that applies to the **outer** shell; the **inner** wrapper defaults to column. Pass the same flex direction via `contentWrapperStyle` when children must stay in a row (see BottomNavBar).
2. Blur Backdrop Plate Purpose: Blur Backdrop Plate — Feature module for Coach Connect. Why it matters: Area: src/shared Key exports: BlurBackdropPlate.

### `shared-ui/FluidGlass.examples.jsx`

1. FluidGlass Usage Examples This file shows how to convert existing UI components to use FluidGlass.
2. UI labels include "e.g., Push Day, Leg Day, Cardio...".

### `shared-ui/FluidGlass.jsx`

1. FluidGlass - True Liquid Glass Effect Component for React Native Creates Apple iOS 26-style liquid glass effect using advanced styling Mimics refraction, light scattering, and soft glass tint Optimized for performance with memoization and reduced re-renders.
2. Fluid Glass Purpose: Fluid Glass — Feature module for Coach Connect. Why it matters: Area: src/shared Key exports: (see file).

### `shared-ui/ThemeContext.js`

1. Theme Context — caches data locally on the device between app launches.
2. Part of shared in Coach Connect.

### `shared-ui/brandGradients.js`

1. Brand gradient aligned with cg logo (pink → purple → indigo), top → bottom.
2. Brand Gradients Purpose: brand Gradients — Feature module for Coach Connect. Why it matters: Area: src/shared Key exports: BRAND_NAV_ICON_GRADIENT, BRAND_NAV_ICON_GRADIENT_LOCATIONS, BRAND_ICON_GRADIENT_START, BRAND_ICON_GRADIENT_END.

### `shared-ui/homeStatGradients.js`

1. Home Stat Gradients — renders gradient backgrounds and buttons.
2. Home Stat Gradients Purpose: home Stat Gradients — Feature module for Coach Connect. Why it matters: Area: src/client Key exports: HOME_STAT_WORKOUT_GRADIENT, HOME_STAT_WATER_GRADIENT, HOME_STAT_SLEEP_GRADIENT, HOME_STAT_SORENESS_GRADIENT, HOME_STAT_ENERGY_GRADIENT, HOME_STAT_STRESS_GRADIENT, HOME_STAT_MOOD_GRADIENT, StatGradientText.

### `shared-ui/ios18Theme.js`

1. Color, spacing, and typography tokens for shared-ui.
2. Import these constants to keep visual styling consistent across related screens.

### `shared-ui/lovableColors.js`

1. Lovable Colors in `shared-ui`.
2. Part of `shared-ui` — search the repo for "lovableColors" to see what imports it before renaming.

### `shared-ui/theme.js`

1. Light mode colors (Modern Neutral theme) Dark mode colors (Modern Neutral theme).
2. Part of shared in Coach Connect.

## shared-ui/layout {#shared-ui-layout}

**Folder purpose:** Source files for the `shared-ui/layout` module.

### `shared-ui/layout/CenteredTwoColumnGrid.jsx`

1. Simple two-column grid for micronutrient rows and similar compact lists.
2. Centered Two Column Grid Purpose: Centered Two Column Grid — Feature module for Coach Connect. Why it matters: Area: src/shared Key exports: CenteredTwoColumnGrid.

## shared-ui/liquid {#shared-ui-liquid}

**Folder purpose:** Source files for the `shared-ui/liquid` module.

### `shared-ui/liquid/LiquidBackground.jsx`

1. Deep obsidian base with 3 mesh-like radial blurs in the corners. Lightweight (single SVG) + works on iOS/Android/Web.
2. Liquid Background Purpose: Liquid Background — Feature module for Coach Connect. Why it matters: Area: src/shared Key exports: LiquidBackground.

### `shared-ui/liquid/LiquidBackgroundLight.jsx`

1. Light-mode mesh background: soft paper base with subtle pastel corner blurs. Designed to sit behind frosted-glass materials.
2. Liquid Background Light Purpose: Liquid Background Light — Feature module for Coach Connect. Why it matters: Area: src/shared Key exports: LiquidBackgroundLight.

### `shared-ui/liquid/LiquidGlassCard.jsx`

1. Custom "glass material": - background blur ~30 - semi-transparent surface - linear border brighter at top, fading to bottom - squircle geometry (continuous curve on iOS).
2. Liquid Glass Card Purpose: UI screen or component: Liquid Glass Card. Feature module for Coach Connect. Why it matters: Area: src/shared Key exports: LiquidGlassCard.

### `shared-ui/liquid/LiquidGradientButton.jsx`

1. Liquid Gradient Button — renders gradient backgrounds and buttons.
2. Part of shared in Coach Connect.

### `shared-ui/liquid/LiquidIconHalo.jsx`

1. Subtle glassmorphic halo behind an icon (quiet luxury): - no shadows - soft gradient + faint stroke - squircle geometry.
2. Liquid Icon Halo Purpose: Liquid Icon Halo — Feature module for Coach Connect. Why it matters: Area: src/shared Key exports: LiquidIconHalo.

### `shared-ui/liquid/liquidTokens.js`

1. Liquid Tokens in `shared-ui/liquid`.
2. Part of shared in Coach Connect.

## shared-utils {#shared-utils}

**Folder purpose:** Source files for the `shared-utils` module.

### `shared-utils/convertHeightUnits.js`

1. US height input: single field like 5'11" or 5,11 → { feet, inches }.
2. Height Feet Inches Purpose: height Feet Inches — Feature module for Coach Connect. Why it matters: Area: src/shared Key exports: formatHeightInputDisplay, isHeightComplete, parseHeightInputText, finalizeHeightFromDraft.

### `shared-utils/dateKeys.js`

1. Client-facing "today" (device timezone). Prefer this for dailyLogs / daily_tracking.
2. DateKeys Purpose: Date key utilities for Firestore daily documents. Why it matters: Single source of truth for date-keyed collection paths across the app. Area: src/shared/utils Key exports: getClientDateKey, getDateKey - **getClientDateKey** — device local midnight (client home, dashboard, AI tools). - **getDateKey** — America/New_York (trainer weekly jobs / legacy server defaults).

### `shared-utils/firestoreSanitize.js`

1. Recursively strip `undefined` values from an object (or array) so it is safe to write to Firestore. @template T @param {T} input @returns {T}.
2. FirestoreSanitize Purpose: Strip undefined values from objects before writing to Firestore. Why it matters: Firestore rejects `undefined` anywhere in nested objects/arrays — this utility prevents silent write failures by recursively removing undefined-valued keys. Area: src/shared/utils Key exports: stripUndefinedForFirestore.

### `shared-utils/formatFileSize.js`

1. * file Formatting * * Purpose: file Formatting — Feature module for Coach Connect. * Why it matters: Keeps feature logic
2. Part of shared in Coach Connect.

### `shared-utils/formatOnboardingDisplay.js`

1. Human-readable labels for onboarding tokens stored in Firestore (snake_case ids).
2. Format Onboarding Display Purpose: format Onboarding Display — Feature module for Coach Connect. Why it matters: Area: src/shared Key exports: humanizeOnboardingToken, formatOnboardingDisplay, formatEquipmentFromProfile, formatDaysPerWeek.

### `shared-utils/getFileViewType.js`

1. Helpers for opening notes & files in-app (images, video, embeds) instead of Safari.
2. Notes File View Purpose: notes File View — Feature module for Coach Connect. Why it matters: Area: src/shared Key exports: isImageFile, isVideoFile, isPdfFile, googleEmbedUrl, officeEmbedUrl, notesFileDedupeKey, getEmbedViewerUri.

### `shared-utils/getLocalDay.js`

1. Local-day helpers (device timezone). Used for dashboards that reset at the user's local midnight.
2. Local Day Purpose: local Day — Feature module for Coach Connect. Why it matters: Area: src/shared Key exports: getLocalDateKey, msUntilLocalMidnight, nextLocalMidnight.

### `shared-utils/getTrainerProfileMedia.js`

1. Resolve a usable profile image URL from trainer / user shapes used across the app. Prefers explicit top-level fields, then common nested marketplace/profile objects.
2. Trainer Profile Media Purpose: trainer Profile Media — Feature module for Coach Connect. Why it matters: Area: src/shared Key exports: trainerPhotoUri, resolveTrainerPhotoWithStorageFallback.

### `shared-utils/workoutDayLabels.js`

1. Allowed labels for "today's workout" / workout day on the client dashboard. Normalized matching is case-insensitive; extra spaces are collapsed.
2. Workout Day Labels Purpose: workout Day Labels — Feature module for Coach Connect. Why it matters: Area: src/shared Key exports: isAllowedClientWorkoutDayLabel, normalizeWorkoutDayLabel, WORKOUT_DAY_EXAMPLES_SHORT.

## shared/accessibility {#shared-accessibility}

**Folder purpose:** a11y prop helpers for screen readers.

### `shared/accessibility/a11yProps.js`

1. Shared accessibility props for Coach Connect core flows. Use on Pressable / TouchableOpacity / TextInput so VoiceOver/TalkBack get clear names.
2. A11y Props Purpose: a11y Props — Feature module for Coach Connect. Why it matters: Area: src/shared Key exports: a11yButton, a11yTextField, a11yHeader, MIN_TOUCH_HIT_SLOP.

## shared/api {#shared-api}

**Folder purpose:** Base URL, auth headers, apiFetch, error logging, push notifications, onboarding sync.

### `shared/api/apiFetch.js`

1. Shared fetch helpers for Coach Connect API calls.
2. Shared authenticated HTTP — prefer over raw fetch.

### `shared/api/baseUrl.js`

1. Always-on production API (Google Cloud Run) — no local `npm run server` required.
2. Shared authenticated HTTP — prefer over raw fetch.

### `shared/api/dashboardNotificationApi.js`

1. Server-backed Firestore notifications (dashboard metric updates).
2. Shared authenticated HTTP — prefer over raw fetch.

### `shared/api/getAuthHeaders.js`

1. Bearer token headers for Coach Connect API routes (Firebase ID token).
2. Shared authenticated HTTP — prefer over raw fetch.

### `shared/api/logErrorLocallyToServer.js`

1. @deprecated Import from ./logErrorToServer — alias kept for legacy paths after rename.
2. Shared authenticated HTTP — prefer over raw fetch.

### `shared/api/logErrorToServer.js`

1. Centralized logging for CoachConnect. - debug/info: development only - warn: development only (keeps production logs quiet) - error: always emitted; forwarded to Sentry when configured (see monitoring.js).
2. Shared authenticated HTTP — prefer over raw fetch.

### `shared/api/monitorAppHealth.js`

1. Optional crash reporting — no-op until EXPO_PUBLIC_SENTRY_DSN is set and @sentry/react-native is installed. See docs/MONITORING.md for setup.
2. Shared authenticated HTTP — prefer over raw fetch.

### `shared/api/sendPushNotification.js`

1. Remote push via Express POST /api/notifications/send (Expo path on server). Uses the same candidate bases as messaging so physical devices reach the API.
2. Shared authenticated HTTP — prefer over raw fetch.

### `shared/api/syncOnboardingToServer.js`

1. Queue a pending onboarding completion payload to sync later. Non-blocking; best-effort persistence.
2. Shared authenticated HTTP — prefer over raw fetch.

### `shared/api/trainerClientApi.js`

1. Trainer CRM actions via server (Admin SDK writes).
2. Shared authenticated HTTP — prefer over raw fetch.

## shared/assets {#shared-assets}

**Folder purpose:** Shared Lottie assets and generated onboarding icon registry.

### `shared/assets/Happy SUN.json`

1. Lottie animation "Happy SUN" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `shared/assets`.

### `shared/assets/Walking steps.json`

1. Lottie animation "Walking steps" — plays during onboarding steps, loading states, or empty-state illustrations.
2. Imported via `lottie-react-native` or the onboarding icon registry in `shared/assets`.

### `shared/assets/onboardingIconRegistry.generated.js`

1. Onboarding Icon Registry.generated in `shared/assets`.
2. Part of shared in Coach Connect.

### `shared/assets/onboardingIconRegistry.js`

1. Maps onboarding option keys (e.g. 'full_gym', 'beginner') to bundled PNG icon require() paths.
2. OnboardingWizardScreen uses getOnboardingIconSource() so icon paths live in one place.

## shared/components {#shared-components}

**Folder purpose:** Reusable components: hero cards, home widgets, modals, notes/files sections.

### `shared/components/FilesNotesHeroCard.jsx`

1. Dark orange → dark purple — border, CTA, glow.
2. UI labels include "Docs".

### `shared/components/MarketplaceHeroCard.jsx`

1. Cohesive accent rim (pink → purple). Not full-spectrum / rainbow.
2. UI labels include "Trainer Marketplace".

## shared/components/home {#shared-components-home}

**Folder purpose:** Home tab shared widgets (aurora banner, daily quote, session card).

### `shared/components/home/AuroraHeroBanner.jsx`

1. Dark purple → dark orange — Today/time card icon accent.
2. Renders gradient backgrounds and buttons.

### `shared/components/home/DailyQuoteCard.js`

1. Curated quotes from `dailyQuotesList.json` (nutrition, training, discipline).
2. Daily Quote Card Purpose: UI screen or component: Daily Quote Card. Feature module for Coach Connect. Why it matters: Area: src/shared Key exports: DailyQuotePill, DailyQuoteCard.

### `shared/components/home/HeroCardBackGlow.jsx`

1. Flat glow wash behind hero cards — tinted plate + colored shadow only (no blobs).
2. Same idea as FilesNotesHeroCard cardShadow — orange luminous spill behind the card.

### `shared/components/home/MarketplaceHeroCard.jsx`

1. Hero card on home that promotes finding a trainer — tap opens marketplace search.
2. Shown to clients who are not yet linked to a trainer.

### `shared/components/home/QuickActionCard.jsx`

1. Dark purple → dark orange (matches Today card & Training Agenda).
2. UI labels include "View all".

### `shared/components/home/SessionMeetingCard.jsx`

1. Glass-style session card (matches PremiumWelcomeCard / app chrome — no rainbow frame). mode="invite" — Pass + I'm in mode="reminder" — optional View / Log Workout when onPressViewWorkout provided.
2. Session Meeting Card Purpose: UI screen or component: Session Meeting Card. Feature module for Coach Connect. Why it matters: Area: src/shared Key exports: SessionMeetingCard.

## shared/components/icons {#shared-components-icons}

**Folder purpose:** Gradient/icon components for nav and profile cards.

### `shared/components/icons/BrandGradientStrokeText.jsx`

1. Solid fill + purple→orange gradient stroke (SVG). Measures with hidden Text first.
2. Brand Gradient Stroke Text Purpose: Brand Gradient Stroke Text — Feature module for Coach Connect. Why it matters: Area: src/shared Key exports: BRAND_GRADIENT, BrandGradientStrokeText.

### `shared/components/icons/GradientChatBubblesIcon.jsx`

1. Chat bubbles masked with brand gradient (matches BottomNavBar / cg logo).
2. Gradient Chat Bubbles Icon Purpose: Gradient Chat Bubbles Icon — Feature module for Coach Connect. Why it matters: Area: src/shared Key exports: GradientChatBubblesIcon.

### `shared/components/icons/GradientGeminiNavIcon.jsx`

1. Google Gemini mark — filled with the same brand gradient as other tab icons (`BrandGradientIcon`).
2. Gradient Gemini Nav Icon Purpose: Gradient Gemini Nav Icon — Feature module for Coach Connect. Why it matters: Area: src/shared Key exports: GradientGeminiNavIcon.

### `shared/components/icons/ProfileCardIcon.jsx`

1. Filled PNG icon for workout profile cards — shared by ClientApp and TrainerApp (WorkoutPlanGeneratorScreen) and client ViewMyViewMyProfileScreen rows.
2. Profile Card Icon Purpose: UI screen or component: Profile Card Icon. Feature module for Coach Connect. Why it matters: Area: src/shared Key exports: ProfileCardIcon.

## shared/components/modals {#shared-components-modals}

**Folder purpose:** Generic modals (error, hold-to-confirm, remove trainer).

### `shared/components/modals/ErrorModal.jsx`

1. Error Modal — popup overlay on top of the current screen.
2. Renders gradient backgrounds and buttons.

### `shared/components/modals/HoldToConfirmModal.jsx`

1. Hold To Confirm Modal — popup overlay on top of the current screen.
2. Renders gradient backgrounds and buttons.

### `shared/components/modals/RemoveTrainerSheet.js`

1. Remove Trainer Sheet — bottom sheet that slides up for a quick decision or form.
2. Reads or writes Firebase Firestore documents.

## shared/components/notes-files {#shared-components-notes-files}

**Folder purpose:** Files & notes section: PDF/spreadsheet viewers, gallery grid, add modal.

### `shared/components/notes-files/AddNotesFilesModal.js`

1. Add Notes Files Modal — popup overlay on top of the current screen.
2. Lets the user pick photos from the camera roll; renders gradient backgrounds and buttons.

### `shared/components/notes-files/DocumentViewerModal.js`

1. Document Viewer Modal — popup overlay on top of the current screen.
2. User dismisses it after completing the action or tapping Cancel.

### `shared/components/notes-files/EmbedWebViewModal.jsx`

1. Embed Web View Modal — popup overlay on top of the current screen.
2. User dismisses it after completing the action or tapping Cancel.

### `shared/components/notes-files/FileGalleryGrid.jsx`

1. Shared file gallery UI — gradient-bordered cards in a 2-column grid. Previews: stored thumbnailUrl (upload), Google embedded viewer for PDFs/docs/sheets, expo-av Video for video without thumb.
2. File Gallery Grid Purpose: File Gallery Grid — Feature module for Coach Connect. Why it matters: Area: src/shared Key exports: FileGalleryGrid.

### `shared/components/notes-files/FilesNotesHeroCard.jsx`

1. Hero header for the Files & Notes section with gradient background and add button.
2. Used on both client and trainer dashboards above the file gallery grid.

### `shared/components/notes-files/FilesNotesSectionPremium.jsx`

1. Dark orange → dark purple accent gradient.
2. UI labels include "VIDEO".

### `shared/components/notes-files/MediaViewerModal.jsx`

1. Media Viewer Modal — popup overlay on top of the current screen.
2. Renders gradient backgrounds and buttons.

### `shared/components/notes-files/PdfViewerModal.js`

1. Pdf Viewer Modal — popup overlay on top of the current screen.
2. Renders gradient backgrounds and buttons.

### `shared/components/notes-files/SpreadsheetViewerModal.js`

1. Spreadsheet Viewer Modal — popup overlay on top of the current screen.
2. User dismisses it after completing the action or tapping Cancel.

## shared/components/onboarding {#shared-components-onboarding}

**Folder purpose:** Onboarding form fields (AI opt-in, trainer location).

### `shared/components/onboarding/AIOptInStep.jsx`

1. AIOpt In Step — renders Lottie animations in the UI.
2. UI labels include "AI Fitness Coach".

### `shared/components/onboarding/TrainerLocationField.jsx`

1. Trainer onboarding city field with optional GPS fill.
2. UI labels include "City / location".

### `shared/components/onboarding/onboardingAiDeps.jsx`

1. Shared onboarding tokens + primary CTA only. Used by AIOptInStep (avoids circular import with OnboardingWizardScreen.jsx).
2. UI labels include "rgba(255,255,255,0.35)".

## shared/components/shell {#shared-components-shell}

**Folder purpose:** App loading screen and Coach Connect header bar.

### `shared/components/shell/AppLoadingScreen.js`

1. App Loading Screen — the screen the user sees for this part of the shared flow.
2. Renders Lottie animations in the UI.

### `shared/components/shell/CoachConnectHeader.js`

1. Matches Settings screen pill gradient (dark pink → dark orange).
2. UI labels include "COACHCONNECT".

## shared/contexts {#shared-contexts}

**Folder purpose:** React contexts (AI context provider wrapper).

### `shared/contexts/AIContext.js`

1. Canonical per-user AI toggle — survives AuthGate profile refresh; key avoids clearAllUserData() coachconnect_* wipe.
2. UI labels include "About AI in Coach Connect".

## shared/firestore {#shared-firestore}

**Folder purpose:** Generic Firestore pagination and storage upload helpers.

### `shared/firestore/firestorePagedQuery.js`

1. Firestore query helpers — indexed query with safe fallback before indexes finish building.
2. UI labels include "query".

### `shared/firestore/storageHelpers.js`

1. Upload a file to Firebase Storage Get download URL for a file.
2. Not a screen itself; contains reusable pieces like confirm/cancel rows, labels, and styling tokens.

## shared/fitness-calculations {#shared-fitness-calculations}

**Folder purpose:** BMR, TDEE, macro calculations from onboarding inputs.

### `shared/fitness-calculations/calculations.js`

1. BMR calculation using Mifflin-St Jeor equation.
2. Calculations Purpose: Fitness math utilities — BMR, TDEE, macros, body composition. Why it matters: Single source of truth for all energy and macro calculations across the app. Area: src/shared/fitness Key exports: calculateBMR, calculateTDEE, calculateMacros, estimateBodyFat, calculateBMI, calculateWeightGoal.

## shared/hooks {#shared-hooks}

**Folder purpose:** Shared hooks (exercise library fetch).

### `shared/hooks/useExercises.js`

1. Use Exercises — React hook encapsulating data loading and state for shared/hooks.
2. Screens call this hook instead of putting fetch/Firestore logic inline in JSX.

## shared/icons {#shared-icons}

**Folder purpose:** Lucide-like icon wrapper.

### `shared/icons/LucideLike.js`

1. Hand-drawn SVG icon components (Home, Flame, Target, etc.) matching Lucide style without the dependency.
2. Used in nav bars and stat cards where @expo/vector-icons does not match the design.

## shared/marketplace {#shared-marketplace}

**Folder purpose:** Trainer marketplace profile sync to Firestore.

### `shared/marketplace/trainerMarketplaceSync.js`

1. Keeps trainers/{uid} (marketplace / Find Trainers) in sync with users/{uid} (profile + onboarding). Clients read trainers/* — not users/* — so profile edits must mirror here.
2. Uses Firestore (`users`).

## shared/notes-files {#shared-notes-files}

**Folder purpose:** CRUD helpers for trainer/client notes and file attachments.

### `shared/notes-files/manageNotesAndFiles.js`

1. Notes & Files — client and trainer can add notes, photos, videos, PDFs. Single source: users/{clientId}/notes_and_files. Each doc has addedBy: 'client' | 'trainer'. Client view: group by "From you" / "From trainer". Trainer view: group by "From client" / "From you".
2. Uses Firestore (`users`).

### `shared/notes-files/spreadsheetRows.js`

1. Encodes spreadsheet rows for Firestore — flattens nested arrays because Firestore forbids them.
2. Used when trainers edit shared spreadsheets in DocumentEditorModal.

## shared/photo-gallery {#shared-photo-gallery}

**Folder purpose:** Shared progress photo gallery screen.

### `shared/photo-gallery/MyProgressPhotosScreen.jsx`

1. My Progress Photos Screen — the screen the user sees for this part of the shared flow.
2. Reads or writes Firebase Firestore documents; lets the user pick photos from the camera roll; renders gradient backgrounds and buttons.

## shared/screens {#shared-screens}

**Folder purpose:** Screens used by both roles (weekly report, workout plans, photo gallery).

### `shared/screens/BrowseSavedWorkoutsScreen.jsx`

1. Browse Saved Workouts Screen — full-screen React Native view in `shared/screens`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in shared.

### `shared/screens/MyProgressPhotosScreen.jsx`

1. My Progress Photos Screen — full-screen React Native view in `shared/screens`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in shared.

### `shared/screens/ViewWeekProgressReportScreen.jsx`

1. View Week Progress Report Screen — full-screen React Native view in `shared/screens`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in shared.

## shared/services {#shared-services}

**Folder purpose:** User profile fetch, client registry, Firestore listener utilities.

### `shared/services/clientProfileFirestore.js`

1. Canonical Firestore registry: clients/{uid} — one doc per account with role "client". Mirrors trainers/{uid} for marketplace/discovery. Populated on signup, onboarding, and server sync.
2. Centralizes collection paths and query shapes for this feature.

### `shared/services/clientRegistryFirestore.js`

1. Client registry: canonical clients/{uid}, profile truth in users/{uid}.
2. Centralizes collection paths and query shapes for this feature.

### `shared/services/fetchUserProfile.js`

1. User profile fetch — Firestore-first (production project anatrox-auth).
2. Hits API routes /api/me failed (${resp.status}); uses Firestore (`users`).

### `shared/services/firestoreListenerUtils.js`

1. True when Firestore rejected the request — expected during/after sign-out.
2. Log snapshot errors except expected sign-out permission denials.

## shared/trainer-location {#shared-trainer-location}

**Folder purpose:** Geocoding / location picker service for trainer profiles.

### `shared/trainer-location/trainerLocationService.js`

1. Trainer city/location helpers — lazy-loads expo-location so app startup does not crash when the native ExpoLocation module is missing from a dev build.
2. Screens import functions from here rather than calling fetch/Firestore directly.

## shared/weekly-report {#shared-weekly-report}

**Folder purpose:** Weekly report screen component shared by client/trainer flows.

### `shared/weekly-report/ViewWeekProgressReportScreen.jsx`

1. View Week Progress Report Screen — the screen the user sees for this part of the shared flow.
2. Reads or writes Firebase Firestore documents.

## shared/workout-plans {#shared-workout-plans}

**Folder purpose:** AI workout plans screen shared implementation.

### `shared/workout-plans/BrowseSavedWorkoutsScreen.jsx`

1. Browse Saved Workouts Screen — the screen the user sees for this part of the shared flow.
2. Reads or writes Firebase Firestore documents; renders gradient backgrounds and buttons.

## shared/workout-profile {#shared-workout-profile}

**Folder purpose:** Workout profile card icons and visibility rules.

### `shared/workout-profile/profileCardIcons.js`

1. Shared profile-card PNG sizing (ClientApp + TrainerApp workout screens).
2. Profile Card Icons Purpose: UI screen or component: profile Card Icons. Feature module for Coach Connect. Why it matters: Area: src/shared Key exports: PROFILE_CARD_ICON_SIZE, PROFILE_CARD_ICON_WRAP, PROFILE_ROW_ICON_SIZE, PROFILE_ROW_ICON_WRAP, PROFILE_CARD_ICON_ASSETS, PROFILE_FIELD_ICON_ID, resolveProfileCardIconSource, profileCardIconWrapStyle.

### `shared/workout-profile/shouldShowProfileCard.js`

1. Profile card visibility — only show cards for onboarding fields the user actually answered. Shared by ClientApp + TrainerApp (WorkoutPlanGeneratorScreen).
2. Profile Card Visibility Purpose: UI screen or component: profile Card Visibility. Feature module for Coach Connect. Why it matters: Area: src/shared Key exports: hasOnboardingFieldData, resolveProfileCardFieldKey, filterProfileCardItems, filterProfileCardSections, getProfileCardSectionLabels, PROFILE_CARD_FIELD_KEY.

## trainer-app/calendar-tab {#trainer-app-calendar-tab}

**Folder purpose:** Source files for the `trainer-app/calendar-tab` module.

### `trainer-app/calendar-tab/TrainerCalendarTab.jsx`

1. Trainer dashboard — Calendar tab.
2. Trainer Calendar Tab Purpose: UI screen or component: Trainer Calendar Tab. Feature module for Coach Connect. Why it matters: Area: src/trainer Key exports: (see file).

## trainer-app/client-detail {#trainer-app-client-detail}

**Folder purpose:** Source files for the `trainer-app/client-detail` module.

### `trainer-app/client-detail/ManageTraineeScreen.jsx`

1. Manage Trainee Screen — the screen the user sees for this part of the trainer-app flow.
2. Reads or writes Firebase Firestore documents; renders gradient backgrounds and buttons; subscribes to real-time Firestore updates.

## trainer-app/client-requests {#trainer-app-client-requests}

**Folder purpose:** Source files for the `trainer-app/client-requests` module.

### `trainer-app/client-requests/NewTraineeRequestsScreen.jsx`

1. New Trainee Requests Screen — the screen the user sees for this part of the trainer-app flow.
2. Renders gradient backgrounds and buttons.

### `trainer-app/client-requests/loadPendingTraineeRequests.js`

1. Service to fetch pending client requests for a trainer. Client requests are stored in top-level messages with conversationId, senderId, status: 'pending'.
2. Uses Firestore (`conversations`).

### `trainer-app/client-requests/useTrainerPendingRequests.js`

1. Use Trainer Pending Requests — React hook encapsulating data loading and state for trainer-app/client-requests.
2. Screens call this hook instead of putting fetch/Firestore logic inline in JSX.

## trainer-app/clients-list {#trainer-app-clients-list}

**Folder purpose:** Source files for the `trainer-app/clients-list` module.

### `trainer-app/clients-list/MyTraineesScreen.jsx`

1. My Trainees Screen — the screen the user sees for this part of the trainer-app flow.
2. Renders gradient backgrounds and buttons.

### `trainer-app/clients-list/loadMyTraineeRoster.js`

1. Trainer client CRM — Firestore helpers. Implementation lives in `src/app-start/TrainerApp.js` (search: "CLIENT CRM SERVICE"). This file re-exports the same API for hooks/screens that import from here. Uses lazy `require()` so we never create a static cycle: TrainerApp → useTrainerClients → this module → TrainerApp (unfinished), which can surface as `ReferenceError: AppNavigationProvider doesn't exist` and similar.
2. Client CRMService Purpose: Data/service layer: client CRMService. Feature module for Coach Connect. Why it matters: Area: src/trainer Key exports: getClient, createOrUpdateClient, syncClientDataFromUsers, removeClient, getTrainerClients, updateClient, addProgress, getProgressHistory.

### `trainer-app/clients-list/useTrainerClients.js`

1. Hook: uses canonical trainer CRM Firestore collection paths.
2. Screens call this hook instead of putting fetch/Firestore logic inline in JSX.

## trainer-app/components {#trainer-app-components}

**Folder purpose:** Source files for the `trainer-app/components` module.

### `trainer-app/components/TrainerDashboardHeroCard.jsx`

1. Trainer home hero — mirrors client DashboardHeroCard hierarchy.
2. UI labels include "Clients".

### `trainer-app/components/WheelPicker.jsx`

1. Off-center rows dim via opacity only — hue stays pure white/black.
2. Wheel Picker Purpose: Wheel Picker — Feature module for Coach Connect. Why it matters: Area: src/components Key exports: WheelPicker.

## trainer-app/components/sessions {#trainer-app-components-sessions}

**Folder purpose:** Source files for the `trainer-app/components/sessions` module.

### `trainer-app/components/sessions/MonthCalendar.jsx`

1. Month Calendar in `trainer-app/components/sessions`.
2. Part of components in Coach Connect.

### `trainer-app/components/sessions/SessionCard.jsx`

1. Premium session row for trainer calendar / list views. `showDate` — include date chip (useful in upcoming list across multiple days).
2. UI labels include "Confirmed".

## trainer-app/crm {#trainer-app-crm}

**Folder purpose:** Source files for the `trainer-app/crm` module.

### `trainer-app/crm/getTraineeDisplayName.js`

1. Trainer roster: CRM `trainer_clients/.../clients` rows often store placeholder `name: "Client"` while the real label lives on `users/{uid}` (and may use many field shapes across signup, onboarding, OAuth, and profile edits).
2. Uses Firestore (`trainer_clients/.../clients`).

### `trainer-app/crm/loadMyLinkedTrainees.js`

1. @param {string} trainerUid @param {object[]} rawRows @returns {Promise<object[]>}.
2. Uses Firestore (`users`).

### `trainer-app/crm/trainerClientFirestorePaths.js`

1. Canonical trainer ↔ client Firestore paths. Reads: trainer_clients/{trainerId}/clients/{clientId} first, legacy clients/{clientId} fallback. Writes: canonical path only (legacy mirror only where explicitly documented in CRM create).
2. Uses Firestore (`clients`).

### `trainer-app/crm/trainerFirestoreErrors.js`

1. Benign Firestore listener errors (offline / permission flicker) — ignore in trainer client listeners.
2. Trainer Firestore Errors Purpose: Data/service layer: trainer Firestore Errors. Feature module for Coach Connect. Why it matters: Area: src/trainer Key exports: isBenignTrainerClientFirestoreError.

## trainer-app/dashboard {#trainer-app-dashboard}

**Folder purpose:** Source files for the `trainer-app/dashboard` module.

### `trainer-app/dashboard/TrainerDashboardContent.jsx`

1. Trainer home dashboard (client roster + tabs).
2. Reads or writes Firebase Firestore documents; renders gradient backgrounds and buttons; uses Firestore (`users/{id}/weeklySummaries`).

### `trainer-app/dashboard/TrainerMarketplaceModal.js`

1. Trainer Marketplace Modal — popup overlay on top of the current screen.
2. Reads or writes Firebase Firestore documents; renders gradient backgrounds and buttons.

### `trainer-app/dashboard/trainerDashboardUi.jsx`

1. Roster / cards: show feet/inches; treat plain numbers as total inches (legacy onboarding).
2. Renders gradient backgrounds and buttons; UI labels include "Client workspace".

## trainer-app/documents {#trainer-app-documents}

**Folder purpose:** Source files for the `trainer-app/documents` module.

### `trainer-app/documents/DocumentEditorModal.js`

1. Document Editor Modal — popup overlay on top of the current screen.
2. Reads or writes Firebase Firestore documents.

### `trainer-app/documents/EditorHeaderActions.jsx`

1. Shown in UI only — never saved as the file title.
2. UI labels include "Untitled document".

### `trainer-app/documents/EditorStatusPill.js`

1. Editor Status Pill in `trainer-app/documents`.
2. UI labels include "Draft".

### `trainer-app/documents/ShareDocumentModal.js`

1. Share Document Modal — popup overlay on top of the current screen.
2. User dismisses it after completing the action or tapping Cancel.

### `trainer-app/documents/SpreadsheetEditorModal.js`

1. Spreadsheet Editor Modal — popup overlay on top of the current screen.
2. Reads or writes Firebase Firestore documents.

### `trainer-app/documents/editorGradients.jsx`

1. Neutral editor accent — no cyan/orange gradients.
2. @deprecated Use theme.accentBorder — kept for callers that still read [0].

### `trainer-app/documents/editorTheme.js`

1. Shared light/dark tokens for document + spreadsheet editors.
2. Import these constants to keep visual styling consistent across related screens.

## trainer-app/home {#trainer-app-home}

**Folder purpose:** Source files for the `trainer-app/home` module.

### `trainer-app/home/TrainerHomeUIComponents.jsx`

1. @deprecated Use trainerDashboardUi.jsx — kept for baseline / legacy imports.
2. Part of `trainer-app/home` — search the repo for "TrainerHomeUIComponents" to see what imports it before renaming.

## trainer-app/hooks {#trainer-app-hooks}

**Folder purpose:** Source files for the `trainer-app/hooks` module.

### `trainer-app/hooks/useMyTrainingSessions.js`

1. Hook: reads or writes Firebase Firestore documents.
2. Screens call this hook instead of putting fetch/Firestore logic inline in JSX.

## trainer-app/marketplace {#trainer-app-marketplace}

**Folder purpose:** Source files for the `trainer-app/marketplace` module.

### `trainer-app/marketplace/TrainerSearchScreen.js`

1. Trainer Search Screen — full-screen React Native view in `trainer-app/marketplace`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in trainer-app.

## trainer-app/messaging {#trainer-app-messaging}

**Folder purpose:** Source files for the `trainer-app/messaging` module.

### `trainer-app/messaging/ConversationsListScreen.js`

1. Conversations List Screen — full-screen React Native view in `trainer-app/messaging`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in trainer-app.

### `trainer-app/messaging/TrainerMessagingScreen.js`

1. Trainer Messaging Screen — full-screen React Native view in `trainer-app/messaging`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in trainer-app.

## trainer-app/navigation {#trainer-app-navigation}

**Folder purpose:** Source files for the `trainer-app/navigation` module.

### `trainer-app/navigation/TrainerAppShellContext.jsx`

1. Trainer App Shell Context in `trainer-app/navigation`.
2. Part of trainer in Coach Connect.

### `trainer-app/navigation/TrainerMainScreen.jsx`

1. Trainer Main Screen — the screen the user sees for this part of the trainer-app flow.
2. Renders gradient backgrounds and buttons.

### `trainer-app/navigation/TrainerRootNavigator.jsx`

1. Trainer Root Navigator — registers or navigates between app screens.
2. Part of trainer in Coach Connect.

### `trainer-app/navigation/TrainerStackScreens.jsx`

1. @deprecated Use trainerOverlayScreens.jsx — kept for baseline / legacy imports.
2. Part of `trainer-app/navigation` — search the repo for "TrainerStackScreens" to see what imports it before renaming.

### `trainer-app/navigation/trainerOverlayScreens.jsx`

1. Trainer Overlay Screens — registers or navigates between app screens.
2. UI labels include "Find a Trainer".

### `trainer-app/navigation/useTrainerScreenNavigation.js`

1. Hook: registers or navigates between app screens.
2. Screens call this hook instead of putting fetch/Firestore logic inline in JSX.

## trainer-app/nutrition-tab {#trainer-app-nutrition-tab}

**Folder purpose:** Source files for the `trainer-app/nutrition-tab` module.

### `trainer-app/nutrition-tab/TrainerNutritionTab.jsx`

1. Trainer dashboard — Nutrition tab.
2. UI labels include "No nutrition logged yet".

## trainer-app/payments {#trainer-app-payments}

**Folder purpose:** Source files for the `trainer-app/payments` module.

### `trainer-app/payments/PaymentsScreen.jsx`

1. Payments Screen — the screen the user sees for this part of the trainer-app flow.
2. Renders gradient backgrounds and buttons.

## trainer-app/photo-gallery {#trainer-app-photo-gallery}

**Folder purpose:** Source files for the `trainer-app/photo-gallery` module.

### `trainer-app/photo-gallery/PhotoGalleryScreen.js`

1. Photo Gallery Screen — full-screen React Native view in `trainer-app/photo-gallery`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in trainer-app.

## trainer-app/progress-tab {#trainer-app-progress-tab}

**Folder purpose:** Source files for the `trainer-app/progress-tab` module.

### `trainer-app/progress-tab/TrainerProgressTab.jsx`

1. Trainer dashboard — Progress tab.
2. Renders gradient backgrounds and buttons; UI labels include "ENERGY / 8".

## trainer-app/screens {#trainer-app-screens}

**Folder purpose:** Source files for the `trainer-app/screens` module.

### `trainer-app/screens/BookTraineeSessionScreen.jsx`

1. Book Trainee Session Screen — the screen the user sees for this part of the trainer-app flow.
2. Renders gradient backgrounds and buttons.

### `trainer-app/screens/ChatWithTraineeScreen.jsx`

1. Chat With Trainee Screen — full-screen React Native view in `trainer-app/screens`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in trainer-app.

### `trainer-app/screens/FindTraineesScreen.jsx`

1. Find Trainees Screen — full-screen React Native view in `trainer-app/screens`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in trainer-app.

### `trainer-app/screens/GenerateTraineeWorkoutScreen.jsx`

1. Generate Trainee Workout Screen — full-screen React Native view in `trainer-app/screens`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in trainer-app.

### `trainer-app/screens/MyMessagesScreen.jsx`

1. My Messages Screen — full-screen React Native view in `trainer-app/screens`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in trainer-app.

### `trainer-app/screens/ScheduleTrainingSessionScreen.jsx`

1. Schedule Training Session Screen — the screen the user sees for this part of the trainer-app flow.
2. Renders gradient backgrounds and buttons.

### `trainer-app/screens/TrainerWeeklyReportScreen.jsx`

1. Trainer Weekly Report Screen — full-screen React Native view in `trainer-app/screens`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in trainer-app.

### `trainer-app/screens/ViewTraineePhotosScreen.jsx`

1. View Trainee Photos Screen — full-screen React Native view in `trainer-app/screens`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in trainer-app.

## trainer-app/sessions {#trainer-app-sessions}

**Folder purpose:** Source files for the `trainer-app/sessions` module.

### `trainer-app/sessions/pushSessionNotification.js`

1. Send a session-scheduled push to the client from the trainer app. Does not require the Node server or Cloud Functions (reads client pushToken from users/{clientId}).
2. Uses Firestore (`users`).

## trainer-app/weekly-report {#trainer-app-weekly-report}

**Folder purpose:** Source files for the `trainer-app/weekly-report` module.

### `trainer-app/weekly-report/TrainerWeeklyReportScreen.jsx`

1. Trainer Weekly Report Screen — full-screen React Native view in `trainer-app/weekly-report`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in trainer-app.

### `trainer-app/weekly-report/TrainerWeeklyReportSection.jsx`

1. Trainer dashboard: hero card under client chips → opens full weekly report for selected client.
2. Uses Firestore (`users`).

### `trainer-app/weekly-report/WeeklyReportHeroCard.jsx`

1. Dark purple → dark orange (matches Today card & Quick Actions).
2. UI labels include "Weekly report".

### `trainer-app/weekly-report/WeeklyReportPremium.jsx`

1. Progress bar fill colors — first stop of each metric gradient.
2. UI labels include "rgba(255,255,255,0.45)".

## trainer-app/workout-plans {#trainer-app-workout-plans}

**Folder purpose:** Source files for the `trainer-app/workout-plans` module.

### `trainer-app/workout-plans/AIWorkoutPlansScreen.js`

1. AIWorkout Plans Screen — full-screen React Native view in `trainer-app/workout-plans`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in trainer-app.

### `trainer-app/workout-plans/ManualWorkoutPlanBuilderScreen.jsx`

1. Manual Workout Plan Builder Screen — the screen the user sees for this part of the trainer-app flow.
2. Renders gradient backgrounds and buttons.

### `trainer-app/workout-plans/manualExerciseLibrarySeed.js`

1. Offline exercise library for the manual workout plan builder (search + autocomplete). IDs are stable strings for Firestore references; trainers may still save custom names.
2. Manual Exercise Library Seed Purpose: manual Exercise Library Seed — Feature module for Coach Connect. Why it matters: Area: src/trainer Key exports: searchManualExerciseLibrary, MANUAL_EXERCISE_LIBRARY.

### `trainer-app/workout-plans/manualWorkoutPlanService.js`

1. Maps manual builder state → WorkoutPlanGeneratorScreen `structuredPlan.workoutPlan` rows.
2. Screens import functions from here rather than calling fetch/Firestore directly.

## utils {#utils}

**Folder purpose:** App-wide utilities: error logging, cache cleanup, logout cleanup, xlsx platform shims.

### `utils/autoLogError.js`

1. Lightweight error logger used across the app. Forwards to monitoring (Sentry when configured).
2. Auto Log Error Purpose: auto Log Error — Feature module for Coach Connect. Why it matters: Area: src/utils Key exports: autoLogErrorSync, autoLogError.

### `utils/clearDataOnLogout.js`

1. Shared keys cleared on account switch (not other users' uid-scoped data).
2. Data Cache Cleanup Purpose: data Cache Cleanup — Feature module for Coach Connect. Why it matters: Area: src/utils Key exports: clearAllUserData, clearUserSpecificData, onUserSignOut, onUserSwitch.

### `utils/dataCacheCleanup.js`

1. Old cache-clearing helper — deprecated in favor of clearDataOnLogout.js.
2. Do not use in new code; call clearDataOnLogout on sign-out instead.

### `utils/logError.js`

1. Client-side error logger — captures JS errors and optionally forwards them to the server.
2. Wraps console.error and integrates with autoLogError for crash reporting.

### `utils/migrateTrainers.js`

1. Migrates all users with role 'trainer' to the trainers collection This should be run once to migrate existing trainer accounts.
2. Uses Firestore (`users`).

### `utils/restaurantNutrition.js`

1. Restaurant nutrition: detect restaurant queries, build search query, and run full pipeline (Firestore cache + server extraction). Returns structured macros only.
2. Scores and sorts food search hits by relevance.

### `utils/syncErrorsToServer.js`

1. Queue an error in AsyncStorage (React Native) This is called automatically by autoLogErrorSync.
2. Queue an error in AsyncStorage (React Native) This is called automatically by autoLogErrorSync.

### `utils/xlsx.js`

1. Keep it safe for native bundling..
2. Part of utils in Coach Connect.

### `utils/xlsx.native.js`

1. Xlsx.native in `utils`.
2. Part of utils in Coach Connect.

### `utils/xlsx.web.js`

1. Xlsx.web in `utils`.
2. Part of utils in Coach Connect.

## workouts/active-workout {#workouts-active-workout}

**Folder purpose:** In-gym active workout screen, set logging, workout service.

### `workouts/active-workout/ActiveWorkoutScreen.js`

1. Active Workout Screen — full-screen React Native view in `workouts/active-workout`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in workouts.

### `workouts/active-workout/EditModalForm_RN.jsx`

1. UI-only “nice” edit modal for Workout Plan builder fields. Uses the existing field editor (`WorkoutPlanBuilderFieldEditBody`) so functionality stays identical.
2. Edit Modal Form RN Purpose: UI screen or component: Edit Modal Form RN. Feature module for Coach Connect. Why it matters: Area: src/workouts Key exports: EditModalForm.

### `workouts/active-workout/WorkoutProfilePillGrid.jsx`

1. Workout Profile Pill Grid — renders gradient backgrounds and buttons.
2. UI labels include "Personal Info".

### `workouts/active-workout/workout.js`

1. Workout Plan Generator Screen Review onboarding data, allow edits, and generate personalized workout plan using DeepSeek API.
2. Renders Lottie animations in the UI; renders gradient backgrounds and buttons; uses Firestore (`users`).

### `workouts/active-workout/workoutService.js`

1. Single doc path for current workout plan: users/{uid}/workoutPlan.
2. Screens import functions from here rather than calling fetch/Firestore directly.

## workouts/components {#workouts-components}

**Folder purpose:** Exercise row and section UI used in plans and active workout.

### `workouts/components/ExerciseRow.jsx`

1. ExerciseRow Component Displays a single exercise with inline editing for sets, reps, rest, and notes. This is a UI-only component for cleaner organization.
2. UI labels include "seconds".

### `workouts/components/ExerciseSection.js`

1. Exercise Section — renders gradient backgrounds and buttons.
2. Part of workouts in Coach Connect.

## workouts/exercise-library {#workouts-exercise-library}

**Folder purpose:** YouTube exercise library tab, video player, dislike picker.

### `workouts/exercise-library/ExerciseCard.js`

1. Exercise Card — renders gradient backgrounds and buttons.
2. Part of workouts in Coach Connect.

### `workouts/exercise-library/ExerciseDislikePicker.jsx`

1. Multi-select exercise dislike picker with lottery-cage style drifting pill animation.
2. UI labels include "Search exercises...".

### `workouts/exercise-library/ShortsCard.js`

1. Shorts Card — renders gradient backgrounds and buttons.
2. Part of workouts in Coach Connect.

### `workouts/exercise-library/VideoPlayerModal.jsx`

1. Video Player Modal — popup overlay on top of the current screen.
2. User dismisses it after completing the action or tapping Cancel.

### `workouts/exercise-library/WorkoutExerciseLibraryTab.jsx`

1. Aurora rim — hot pink → dark orange (matches home hero + user prefs).
2. Caches data locally on the device between app launches; UI labels include "Chest".

### `workouts/exercise-library/clientWorkoutPlansLibrary.js`

1. Loads all workout plans visible in the AI Workout Library for a client (subcollection, current doc, legacy global + savedWorkoutPlans).
2. Uses Firestore (`users`).

### `workouts/exercise-library/exerciseDislikeCatalog.js`

1. Curated exercise catalog for onboarding "exercises you dislike" multi-select. IDs align with MANUAL_EXERCISE_LIBRARY where possible; extras cover cardio, machines, etc.
2. UI labels include "Chest & Push".

### `workouts/exercise-library/exerciseDislikeHelpers.js`

1. Selected catalog IDs + optional custom names → stored profile string.
2. Not a screen itself; contains reusable pieces like confirm/cancel rows, labels, and styling tokens.

### `workouts/exercise-library/useYouTubeAPI.js`

1. Hook: resolves the server API base URL with offline fallback.
2. Screens call this hook instead of putting fetch/Firestore logic inline in JSX.

## workouts/plan-builder {#workouts-plan-builder}

**Folder purpose:** Manual plan builder field edit forms.

### `workouts/plan-builder/workoutPlanBuilderFieldEditBody.js`

1. Inline edit bodies for workout plan builder rows — logic copied from WorkoutPlanGeneratorScreen.
2. UI labels include "Beginner".

## workouts/plan-generator {#workouts-plan-generator}

**Folder purpose:** AI workout plan generation: onboarding form, API request, parsing, usage tracking.

### `workouts/plan-generator/requestWorkoutPlan.js`

1. Calls the server to generate an AI workout plan from onboarding answers and Claude/DeepSeek.
2. Also loads saved onboarding artifacts and plan history from AsyncStorage/Firestore.

### `workouts/plan-generator/trackWorkoutGenerationUsage.js`

1. Keep in sync with server/lib/workoutGenerationLimit.js.
2. Uses Firestore (`users`).

### `workouts/plan-generator/useWorkoutGeneration.js`

1. Hook: requests an AI-generated workout plan from the server.
2. Screens call this hook instead of putting fetch/Firestore logic inline in JSX.

### `workouts/plan-generator/workoutOnboardingFormConfig.js`

1. Field labels, icons, and display config for the workout plan generator onboarding form.
2. Drives the profile pill grid on GenerateMyWorkoutPlanScreen.

### `workouts/plan-generator/workoutOnboardingPayload.js`

1. Fields used by server/lib/workoutPlanPrompt.js — keep payload small and JSON-safe.
2. Strip Firestore types / extra user-doc fields before POSTing to /api/workout/generate.

### `workouts/plan-generator/workoutPlanGenerationSession.js`

1. Tracks AI workout plan generation across tab switches / screen unmounts. Generation continues in JS; UI re-subscribes via AsyncStorage + listeners.
2. @param {{ userAwayFromWorkout?: boolean }} opts.

### `workouts/plan-generator/workoutPlanParsing.js`

1. Workout plan parsing helpers for plan viewer screens.
2. UI labels include "Profile".

## workouts/plan-viewer {#workouts-plan-viewer}

**Folder purpose:** Rendered workout plan result, PDF viewer modal and export service.

### `workouts/plan-viewer/WorkoutPlanPdfViewerModal.js`

1. Workout Plan Pdf Viewer Modal — popup overlay on top of the current screen.
2. User dismisses it after completing the action or tapping Cancel.

### `workouts/plan-viewer/WorkoutPlanResult.jsx`

1. Workout Plan Result — renders gradient backgrounds and buttons.
2. UI labels include "Weekly Plan".

### `workouts/plan-viewer/workoutPlanPdfService.js`

1. Workout plan PDF: parse plan text, generate PDF (expo-print), save to Storage + Firestore. Only used AFTER the plan is generated; does not change AI or prompts.
2. Screens import functions from here rather than calling fetch/Firestore directly.

### `workouts/plan-viewer/workoutPlanUiComponents.jsx`

1. Shared JSX pieces for rendering a generated workout plan (day headers, exercise blocks, rest notes).
2. Used by WorkoutPlanResult and the PDF export pipeline.

## workouts/screens {#workouts-screens}

**Folder purpose:** Workout plan generator onboarding UI screen.

### `workouts/screens/GenerateMyWorkoutPlanScreen.jsx`

1. Generate My Workout Plan Screen — full-screen React Native view in `workouts/screens`.
2. Opened via React Navigation from tabs, bottom nav, or stack pushes elsewhere in workouts.

---

*End of catalog — 565 files.*
