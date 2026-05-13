# CoachConnect — Dead code audit report

**Repo:** Coach Connect (Expo / React Native)  
**Date:** 2026-05-12  
**Method:** Static analysis of `import … from '…'` under `src/` (relative paths resolved), plus manual review of `ClientApp.js` / `TrainerApp.js`.  
**Limits:** Does **not** trace `require()`, dynamic `import()`, or imports from outside `src/` (e.g. root `utils/`). JSON/Lottie `import` paths may look “broken” if only `src/` is considered.

---

## STEP 1 — Routed / imported screens (`src/app/ClientApp.js`)

| Screen name (symbol) | File path | Line |
|----------------------|-----------|------|
| AIChatHomeScreen | `src/aiChat/screens/AIChatHomeScreen.jsx` | 65 |
| AIChatScreen | `src/aiChat/screens/AIChatScreen.jsx` | 66 |
| TrainerSearchScreen (+ named `TrainerProfileSheet`) | `src/ai/screens/TrainerSearchScreen.js` | 67 |
| MyDashboardScreen | `src/client/screens/MyDashboardScreen.jsx` | 68 |
| SettingsScreen | `src/client/screens/SettingsScreen.js` | 69 |
| HelpFAQScreen | `src/settings/screens/HelpFAQScreen.jsx` | 70 |
| TermsOfServiceScreen | `src/settings/screens/TermsOfServiceScreen.jsx` | 71 |
| PrivacyPolicyScreen | `src/settings/screens/PrivacyPolicyScreen.jsx` | 72 |
| ContactSupportScreen | `src/settings/screens/ContactSupportScreen.jsx` | 73 |
| BugReportScreen | `src/settings/screens/BugReportScreen.jsx` | 74 |
| MealPlanHomeScreen | `src/nutrition/screens/MealPlanHomeScreen.js` | 78 |
| NutritionContainer | `src/nutrition/screens/NutritionContainer.jsx` | 79 |
| ProfileScreen | `src/profile/screens/ProfileScreen.jsx` | 80 |
| AppLoadingScreen | `src/shared/components/AppLoadingScreen.js` | 82 |
| ClientFilesScreen | `src/client/screens/ClientFilesScreen.jsx` | 95 |
| ConversationsListScreen | `src/trainer/screens/ConversationsListScreen.js` | 117 |
| PhotoGalleryScreen | `src/trainer/screens/PhotoGalleryScreen.js` | 118 |
| TrainerMessagingScreen | `src/trainer/screens/TrainerMessagingScreen.js` | 119 |
| AIWorkoutPlansScreen | `src/trainer/screens/AIWorkoutPlansScreen.js` | 120 |
| TrainerWeeklyReportScreen | `src/trainer/screens/TrainerWeeklyReportScreen.jsx` | 121 |
| WorkoutPlanGeneratorScreen | `src/workouts/screens/workout.js` | 123 |

**Also used as full-page flows (same file):** conditional returns render `WorkoutPlanGeneratorScreen` as read-only “plan viewer” (`showPlanViewer`, ~2754) without a separate `PlanViewerScreen` import.

---

## STEP 2 — Routed / imported screens (`src/app/TrainerApp.js`)

| Screen name (symbol) | File path | Line |
|----------------------|-----------|------|
| TrainerSearchScreen | `src/trainer/screens/TrainerSearchScreen.js` | 59 |
| TrainerMessagingScreen | `src/trainer/screens/TrainerMessagingScreen.js` | 60 |
| ConversationsListScreen | `src/trainer/screens/ConversationsListScreen.js` | 61 |
| VoiceAIHomeScreen | `src/aiChat/screens/VoiceAIHomeScreen.jsx` | 62 |
| AIChatScreen | `src/aiChat/screens/AIChatScreen.jsx` | 63 |
| NutritionContainer | `src/nutrition/screens/NutritionContainer.jsx` | 64 |
| ProfileScreen | `src/profile/screens/ProfileScreen.jsx` | 65 |
| SettingsScreen | `src/client/screens/SettingsScreen.js` | 66 |
| HelpFAQScreen | `src/settings/screens/HelpFAQScreen.jsx` | 67 |
| TermsOfServiceScreen | `src/settings/screens/TermsOfServiceScreen.jsx` | 68 |
| PrivacyPolicyScreen | `src/settings/screens/PrivacyPolicyScreen.jsx` | 69 |
| ContactSupportScreen | `src/settings/screens/ContactSupportScreen.jsx` | 70 |
| BugReportScreen | `src/settings/screens/BugReportScreen.jsx` | 71 |
| WorkoutPlanGeneratorScreen | `src/workouts/screens/workout.js` | 72 |
| ClientRequestsScreen | `src/trainer/screens/ClientRequestsScreen.js` | 73 |
| SessionSchedulingScreen | `src/trainer/screens/SessionSchedulingScreen.jsx` | 74 |
| SessionFormScreen | `src/trainer/screens/SessionFormScreen.jsx` | 75 |
| PhotoGalleryScreen | `src/trainer/screens/PhotoGalleryScreen.js` | 119 |
| AIWorkoutPlansScreen | `src/trainer/screens/AIWorkoutPlansScreen.js` | 120 |
| ManualWorkoutPlanBuilderScreen | `src/trainer/screens/ManualWorkoutPlanBuilderScreen.jsx` | 121 |
| TrainerWeeklyReportScreen | `src/trainer/screens/TrainerWeeklyReportScreen.jsx` | 125 |

---

## STEP 3 — Physical screen files

### `src/client/screens/`

| Filename | Full path | Type |
|----------|-----------|------|
| AccountProfileScreen.jsx | `src/client/screens/AccountProfileScreen.jsx` | .jsx |
| ClientFilesScreen.jsx | `src/client/screens/ClientFilesScreen.jsx` | .jsx |
| DashboardScreen.js | `src/client/screens/DashboardScreen.js` | .js |
| DataStorageScreen.jsx | `src/client/screens/DataStorageScreen.jsx` | .jsx |
| GoalsTargetsScreen.jsx | `src/client/screens/GoalsTargetsScreen.jsx` | .jsx |
| MyDashboardScreen.jsx | `src/client/screens/MyDashboardScreen.jsx` | .jsx |
| NotificationsSettingsScreen.jsx | `src/client/screens/NotificationsSettingsScreen.jsx` | .jsx |
| PrivacySecurityScreen.jsx | `src/client/screens/PrivacySecurityScreen.jsx` | .jsx |
| ProfileScreen.js | `src/client/screens/ProfileScreen.js` | .js |
| ProgressAnalyticsScreen.js | `src/client/screens/ProgressAnalyticsScreen.js` | .js |
| SettingsScreen.js | `src/client/screens/SettingsScreen.js` | .js |
| SocialSharingScreen.jsx | `src/client/screens/SocialSharingScreen.jsx` | .jsx |
| UnitsMeasurementsScreen.jsx | `src/client/screens/UnitsMeasurementsScreen.jsx` | .jsx |

### `src/trainer/screens/`

| Filename | Full path | Type |
|----------|-----------|------|
| AIWorkoutPlansScreen.js | `src/trainer/screens/AIWorkoutPlansScreen.js` | .js |
| ClientDetailScreen.js | `src/trainer/screens/ClientDetailScreen.js` | .js |
| ClientRequestsScreen.js | `src/trainer/screens/ClientRequestsScreen.js` | .js |
| ConversationsListScreen.js | `src/trainer/screens/ConversationsListScreen.js` | .js |
| ManualWorkoutPlanBuilderScreen.jsx | `src/trainer/screens/ManualWorkoutPlanBuilderScreen.jsx` | .jsx |
| PhotoGalleryScreen.js | `src/trainer/screens/PhotoGalleryScreen.js` | .js |
| SessionFormScreen.jsx | `src/trainer/screens/SessionFormScreen.jsx` | .jsx |
| SessionSchedulerScreen.jsx | `src/trainer/screens/SessionSchedulerScreen.jsx` | .jsx |
| SessionSchedulingScreen.jsx | `src/trainer/screens/SessionSchedulingScreen.jsx` | .jsx |
| TrainerMessagingScreen.js | `src/trainer/screens/TrainerMessagingScreen.js` | .js |
| TrainerSearchScreen.js | `src/trainer/screens/TrainerSearchScreen.js` | .js |
| TrainerWeeklyReportScreen.jsx | `src/trainer/screens/TrainerWeeklyReportScreen.jsx` | .jsx |

---

## STEP 4 & 5 — Potentially dead screens + inline duplicates

**Inline trainer “screen” (replaces file-based client detail):**

- `ClientDetailScreen` is defined **inline** in `TrainerApp.js` starting at **line 3001** (comment block `// CLIENT DETAIL SCREEN` at 2998–3000).  
- `src/trainer/screens/ClientDetailScreen.js` is a **5-line stub** pointing to that inline implementation → treat file as **obsolete / duplicate**.

**`ClientApp.js` inline screens:** No separate `const FooScreen = (` full-screen components besides large inline UI inside the main component; settings sub-routes use `onNavigate('profile' | 'helpFaq' | …)` (see ~2458–2521), not separate files under `client/screens/`.

---

## STEP 6 — Dead screens (strict criteria)

Files in `src/client/screens/` or `src/trainer/screens/` that are:

1. **Not** imported from `ClientApp.js` or `TrainerApp.js` (see Steps 1–2), **and**  
2. **Not** imported by any other file under `src/` via relative `import` (static scan), **and**  
3. **Not** the active inline implementation (stub only).

| Full path | Lines | Notes |
|-----------|------:|-------|
| `src/client/screens/AccountProfileScreen.jsx` | 118 | No imports anywhere under `src/`. |
| `src/client/screens/DashboardScreen.js` | 723 | Legacy dashboard; app uses `MyDashboardScreen` only. |
| `src/client/screens/DataStorageScreen.jsx` | 127 | No imports. |
| `src/client/screens/GoalsTargetsScreen.jsx` | 119 | No imports. |
| `src/client/screens/NotificationsSettingsScreen.jsx` | 131 | No imports. |
| `src/client/screens/PrivacySecurityScreen.jsx` | 119 | No imports. |
| `src/client/screens/ProfileScreen.js` | 638 | **Duplicate** of `src/profile/screens/ProfileScreen.jsx` (routed). |
| `src/client/screens/ProgressAnalyticsScreen.js` | 0 | **Empty file** (0 lines). |
| `src/client/screens/SocialSharingScreen.jsx` | 109 | No imports. |
| `src/client/screens/UnitsMeasurementsScreen.jsx` | 118 | No imports. |
| `src/trainer/screens/SessionSchedulerScreen.jsx` | 493 | No imports (scheduling uses `SessionSchedulingScreen.jsx`). |
| `src/trainer/screens/ClientDetailScreen.js` | 4 | Stub only; real UI is **inline in `TrainerApp.js`**. |

**Last git touch (sample):** `SessionSchedulerScreen.jsx`, `prompts.js` (see services) last committed **2026-03-20** on this repo (`git log -1`).

---

## Extra: legacy screen outside those folders

| Path | Issue |
|------|--------|
| `src/ai/screens/ChatScreen.js` | **Not imported** anywhere; app uses `src/aiChat/screens/AIChatScreen.jsx`. Likely legacy. |

---

## Component import extraction (routing-related files)

### `ClientApp.js` — non-screen components (sample of `src/`-relative imports)

| Component / module | Source path | Imported in |
|--------------------|-------------|-------------|
| BlurBackdropPlate | `src/shared/ui/BlurBackdropPlate.jsx` | `ClientApp.js` |
| AddNotesFilesModal | `src/shared/components/AddNotesFilesModal.js` | `ClientApp.js` |
| CoachConnectHeader | `src/shared/components/CoachConnectHeader.js` | `ClientApp.js` |
| DailyQuoteCard, DailyQuotePill | `src/shared/components/DailyQuoteCard.js` | `ClientApp.js` |
| DocumentViewerModal | `src/shared/components/DocumentViewerModal.js` | `ClientApp.js` |
| … | *(see file lines 37–116)* | `ClientApp.js` |

*(Full list: open `ClientApp.js` lines 37–116, 101–116 for `notificationsService`, `notesFileView`, etc.)*

### `TrainerApp.js` — non-screen components (sample)

HoldToConfirmModal, DocumentEditorModal, ShareDocumentModal, SpreadsheetEditorModal, GradientChatBubblesIcon, FileGalleryGrid, TrainerWeeklyReportSection, … (see `TrainerApp.js` lines 36–124).

### `src/navigation/BottomNavBar.js`

| Component | Source | Imported in |
|-----------|--------|-------------|
| GradientGeminiNavIcon | `src/shared/components/GradientGeminiNavIcon.jsx` | `BottomNavBar.js` |
| BlurBackdropPlate | `src/shared/ui/BlurBackdropPlate.jsx` | `BottomNavBar.js` |
| useTheme | `src/shared/ui/ThemeContext.js` | `BottomNavBar.js` |
| useMergedNavigation | `src/navigation/AppNavigationContext.js` | `BottomNavBar.js` |
| useAI | `src/contexts/AIContext.js` | `BottomNavBar.js` |

---

## Shared context providers — imports

### `src/shared/ui/ThemeContext.js`

- `react`, `react-native` (`useColorScheme`), `@react-native-async-storage/async-storage`, `./theme` (`lightColors`, `darkColors`, …).

### `src/contexts/AIContext.js`

- `react`, `@react-native-async-storage/async-storage`, `firebase/auth` (`onAuthStateChanged`), `../app/config` (`auth`).

### `src/navigation/AppNavigationContext.js`

- `react` only (`createContext`, `useContext`, `useCallback`, `useRef`, `useState`).

---

## Services under `src/**/services/` — low import count

| File | Feature | Import usage (static) |
|------|---------|------------------------|
| `src/ai/services/claudeClient.js` | AI | **0** importers under `src/` (only self-reference in comment). |
| `src/ai/services/prompts.js` | AI | **0** importers (word “prompts” appears only in unrelated comments). |
| `src/workouts/services/claudeWorkoutService.js` | Workouts | **0** importers. **593 lines** — largest dead service candidate. |

Other service modules **are** referenced (e.g. `trainerMessaging`, `nutritionService`, `conversationService`); not listed here for brevity.

---

## Duplicate filenames (requested set)

### `ProfileScreen`

| Path | Lines (approx) | Status |
|------|----------------|--------|
| `src/profile/screens/ProfileScreen.jsx` | 1100+ | **USED** — imported in `ClientApp.js` & `TrainerApp.js`. |
| `src/client/screens/ProfileScreen.js` | 639 | **DEAD** — no imports. |

### `ForgotPassword` / `ForgotPasswordScreen`

| Path | Status |
|------|--------|
| `src/auth/ForgotPasswordScreen.js` | Re-exports `../screens/settings/ForgotPassword`. **USED** via `AuthGate.js`. |
| `src/screens/settings/ForgotPassword.js` | **USED** (target of re-export). |

### `SettingsScreen`

- Only `src/client/screens/SettingsScreen.js` (used by both apps).

### `ChatScreen`

| Path | Status |
|------|--------|
| `src/aiChat/screens/AIChatScreen.jsx` | **USED** |
| `src/ai/screens/ChatScreen.js` | **Unused** (legacy path). |

### `MealCard`

- Single implementation: `src/nutrition/components/MealCard.js` — imported from `MealPlanHomeScreen.js`.

### Messaging-style services

- `src/ai/services/trainerMessaging.js` (service) vs `src/trainer/screens/TrainerMessagingScreen.js` (screen) — **different roles**, not duplicates.

---

## Broken imports (relative → file missing **under `src/`**)

**False positives:** many `from '../assets/...json'` in `OnboardingScreen.js` — files **exist** under `src/assets/`; a naive `src/`-only resolver flags them.

**Worth fixing / verifying:**

| Importing file | Import spec | Note |
|----------------|-------------|------|
| `src/app/RoleMigrationScreen.js` | `../utils/migrateUserRoles` | Import is **commented**; file **missing**. Screen still references undefined `migrationResult` — **bug**. |
| `src/app/config.js` | `../supabase/supabase-js` | Path likely outside `src/` or optional; verify at runtime. |

Imports like `../../utils/errorSyncService` from `AuthGate.js` resolve to **repo root** `utils/errorSyncService.js` (exists) — not “broken” for Metro.

---

## Potentially dead **components** (0 static importers under `src/`)

> **Caveat:** Trainer CRM may have migrated to inline JSX in `TrainerApp.js`; several `src/trainer/components/*` files may be legacy. Confirm with product owner before deleting.

Confirmed **no** `import … from '…/thatFile'` in `src/`:

- `src/shared/components/Avatar.js`, `Button.js`, `Card.js`, `CreateModal.js`, `FadeInUp.jsx`, `Input.js`, `LoadingSpinner.js`, `NavIcon.js`, `ProgressChart.js`, `WeightChart.js`
- `src/shared/components/onboarding/GradientCard.jsx`, `OnboardingProgress.jsx` (onboarding uses local `OnboardingProgressBar` / inline cards elsewhere)
- `src/client/components/TrainerProfileCardModal.jsx`
- `src/trainer/components/AnatroxDashboard.jsx`, `CalendarView.jsx`, `ClientHeader.jsx`, `HeaderSection.jsx`, `MessagesView.jsx`, `NotesView.jsx`, `NutritionView.jsx`, `ProgressView.jsx`, `QuickActions.jsx`, `StatsCards.jsx`, `StatsRow.jsx`, `TabNavigation.jsx`, `WeekCalendar.jsx`
- `src/workouts/components/ExerciseCard.jsx`, `ExerciseCarousel.jsx`, `ExerciseGrid.jsx`, `ExerciseLibrarySection.jsx`, `LoadingOverlay.jsx`, `PlanLimitBanner.jsx`, `WorkoutDayCard.jsx`, `YouTubeDebugOverlay.jsx`

**Sanity check:** `PlanLimitBanner.jsx` has **zero** imports — workout limit UI may be duplicated inside `workout.js`.

---

## UNUSED EXPORTS (not run exhaustively)

Per-export usage across 251 files needs **eslint-plugin-import** / **knip** / **ts-prune** (with Metro aliases). This audit only flags **whole files** with zero import paths.

---

# FINAL DEAD CODE AUDIT REPORT

============================

## DEAD SCREENS (not routed + not imported elsewhere)

- **Count:** **12** files (11 real + 1 stub)
- **List:**  
  `src/client/screens/AccountProfileScreen.jsx`  
  `src/client/screens/DashboardScreen.js`  
  `src/client/screens/DataStorageScreen.jsx`  
  `src/client/screens/GoalsTargetsScreen.jsx`  
  `src/client/screens/NotificationsSettingsScreen.jsx`  
  `src/client/screens/PrivacySecurityScreen.jsx`  
  `src/client/screens/ProfileScreen.js`  
  `src/client/screens/ProgressAnalyticsScreen.js`  
  `src/client/screens/SocialSharingScreen.jsx`  
  `src/client/screens/UnitsMeasurementsScreen.jsx`  
  `src/trainer/screens/SessionSchedulerScreen.jsx`  
  `src/trainer/screens/ClientDetailScreen.js` (stub)

## DEAD COMPONENTS (never imported — static `src/` scan)

- **Count:** **34** (see list above; highest risk: entire `src/trainer/components/` set if trainer UI was inlined)
- **List:** see section “Potentially dead **components**”.

## DEAD SERVICES (0 importers in `src/`)

- **Count:** **3**
- **List:**  
  `src/ai/services/claudeClient.js`  
  `src/ai/services/prompts.js`  
  `src/workouts/services/claudeWorkoutService.js`

## DUPLICATE FILES (possible dead code)

- **Count:** **2** conflicts called out (`ProfileScreen` client vs profile; `ChatScreen` ai vs aiChat) + **ForgotPassword** re-export chain (not duplicate dead).

## BROKEN IMPORTS

- **Count (strict `src/` resolver):** ~29 patterns in automated scan; **many are JSON assets or root `utils/`**.  
- **Real issues:** `RoleMigrationScreen` / missing `migrateUserRoles`; review `config.js` supabase path.

## UNUSED EXPORTS

- **Count:** Not computed file-by-file (see note above).

## TOTAL FILES AT RISK (unique, approximate)

- Dead screens: **12**  
- Dead components: **34**  
- Dead services: **3**  
- Legacy screen `src/ai/screens/ChatScreen.js`: **1**  
- **Rough total:** **50** file paths to review before deletion.

## CONFIDENCE LEVEL

| Signal | Confidence |
|--------|------------|
| 0 imports under `src/` for a screen file | **~95%** dead (unless `require()` or entry outside `src/`). |
| Empty `ProgressAnalyticsScreen.js` | **99%** safe to delete or implement. |
| `ProfileScreen.js` (client) vs routed `profile/ProfileScreen.jsx` | **99%** duplicate. |
| `trainer/components/*` with 0 imports | **70–85%** — may match old Trainer UI replaced by `TrainerApp.js` monolith; verify UX. |
| `claudeWorkoutService.js` (593 lines, 0 imports) | **95%** dead module. |

---

**Recommendation:** Before deleting, run a quick **`rg "<FileName>" src`** and a **production build**; add **Knip** or **depcheck** for ongoing hygiene.
