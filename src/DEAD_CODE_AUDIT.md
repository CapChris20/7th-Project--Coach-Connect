# Dead Code & Usage Audit

**Generated:** 2026-06-21  
**Method:** Static import graph from `App.js` + all `src/**/*.js(x)` (tests excluded from inbound count — see note below).  
**Re-run:** `node scripts/auditUnusedSrcFiles.mjs`

---

## TL;DR

| Question | Answer |
|----------|--------|
| Is **`shared-ui/` useless**? | **No.** 12 of 16 files are actively imported. It holds theme, glass UI, gradients — used across auth, nutrition, client home, trainer dashboard, messaging. |
| Why does it *feel* useless? | (1) Old path `shared/ui/` still referenced in 4 files — **broken after rename**. (2) 4 files in `shared-ui/` are genuinely unused. (3) Lots of **re-export shims** and **orphan screens** that look like real features but nothing imports them. |
| Did we audit before the folder cleanup? | **No** — that was structure-only. This is the first usage pass. |

---

## `shared-ui/` — file by file

| File | Status | Imported by (examples) |
|------|--------|------------------------|
| `ThemeContext.js` | **USED** | `App.js`, auth, nutrition, settings, messaging, dashboards |
| `BlurBackdropPlate.jsx` | **USED** | ClientApp, TrainerApp, food search, marketplace modals |
| `FluidGlass.jsx` | **USED** | Meal plan, MealCard, LogTodaysMealsScreen |
| `homeStatGradients.js` | **USED** | Client home, coach home, trainer progress, food search |
| `brandGradients.js` | **USED** | BottomNavBar, nutrition theme |
| `theme.js` | **USED** | Trainer document editor theme |
| `liquid/*` (backgrounds, card, button, tokens) | **USED** | Login, onboarding, auth screens |
| `layout/CenteredTwoColumnGrid.jsx` | **USED** | NutritionFactsScreen |
| `FluidGlass.examples.jsx` | **DEAD** | Example/doc file only — safe to delete |
| `ios18Theme.js` | **DEAD** | Nothing imports it |
| `liquid/LiquidIconHalo.jsx` | **DEAD** | Nothing imports it |
| `lovableColors.js` | **DEAD** | Only referenced from `useSettingsPageFrame.js`, which is itself unwired |

**Verdict:** Keep `shared-ui/`. Delete or archive the 4 dead files above.

---

## Broken imports (still point at old `shared/ui/`)

These paths **do not exist** on disk (`shared-ui/` replaced `shared/ui/`):

| File | Broken import |
|------|----------------|
| `shared/components/shell/CoachConnectHeader.js` | `../../ui/BlurBackdropPlate`, `../../ui/ThemeContext` |
| `shared/components/home/DailyQuoteCard.js` | `../../ui/ThemeContext` |
| `shared/components/icons/GradientChatBubblesIcon.jsx` | `../../ui/brandGradients` |
| `shared/components/icons/GradientGeminiNavIcon.jsx` | `../../ui/brandGradients` |

`CoachConnectHeader` is used in **30+ screens**. This should be `../../../shared-ui/...`. Jest doesn't catch it because unit tests rarely load header components.

---

## Junk / accidental files

| Path | Action |
|------|--------|
| `src/trainer-app/Untitled` | Delete (empty scratch file) |
| `**/.DS_Store` under `src/` | Delete, add to `.gitignore` if not already |

---

## High-confidence DEAD (nothing imports them)

### Client app
| File | Notes |
|------|-------|
| `client-app/dashboard/coachingBillingLabel.js` | Billing label helpers — zero imports |
| `client-app/home/PremiumWelcomeCard.jsx` | Never wired into home |
| `client-app/home/useClientHomeNutrition.js` | Duplicate — `ClientApp.js` defines same hook inline |
| `client-app/home/ClientHomeScreen.styles.js` | Unused styles split |
| `client-app/navigation/ClientStackScreens.jsx` | Unused navigator fragment |

### Settings (orphan sub-screens — not linked from `SettingsScreen.js`)
| File |
|------|
| `settings/screens/AboutAppScreen.jsx` |
| `settings/screens/ChangePasswordScreen.jsx` |
| `settings/screens/EditProfileScreen.jsx` |
| `settings/screens/EmailPreferencesScreen.jsx` |
| `settings/screens/RestTimerSettingsScreen.jsx` |
| `settings/screens/WorkoutRemindersSettingsScreen.jsx` |
| `settings/screens/useSettingsPageFrame.js` |

These were built but never hooked into navigation. **Keep or delete** — your call.

### Trainer app (same shim problem client-app had)
| File | Notes |
|------|-------|
| `trainer-app/messaging/*` | Re-export shims only |
| `trainer-app/photo-gallery/PhotoGalleryScreen.js` | Re-export shim |
| `trainer-app/workout-plans/AIWorkoutPlansScreen.js` | Re-export shim |
| `trainer-app/weekly-report/TrainerWeeklyReportScreen.jsx` | Re-export shim |
| `trainer-app/screens/*` (several) | Re-export shims to `shared/` |
| `trainer-app/marketplace/TrainerSearchScreen.js` | One-line re-export |

### Nutrition
| File | Notes |
|------|-------|
| `nutrition/screens/MacroTrackerScreen.js` | Full screen — never imported |
| `nutrition/settings/NutritionOnboardingScreen.jsx` | Never imported |
| `nutrition/food-details/parseNutritionLabel.js` | Never imported |

### AI coach
| File | Notes |
|------|-------|
| `ai-coach/server-logic/aiCoachService.js` | Legacy wrapper — unused |
| `ai-coach/server-logic/services/askServer.js` | Unused |
| `ai-coach/server-logic/services/webSearch.js` | Unused (server routes used instead) |
| Several chat-ui components/modals | AttachActionSheet, ContextChips, MiniOrb, PlanDeloadWeekSheet, etc. |

### App entry
| File | Notes |
|------|-------|
| `app-start/authGateLogic.js` | Split from AuthGate — unused |
| `app-start/permissions.js` | Camera/audio helpers — unused |

### Utils
| File | Notes |
|------|-------|
| `utils/migrateTrainers.js` | One-off migration script in src |
| `utils/restaurantNutrition.js` | Duplicate of server util? |
| `utils/logError.js` | Superseded by `autoLogError.js` / sync? |

---

## FALSE POSITIVES (audit script says "unused" but they ARE used)

The script excludes `__tests__/` from the import graph, so **all 56 test files** show as unused (expected).

These show as unused but are imported dynamically or from files outside the scan:

| File | Why it looks unused |
|------|---------------------|
| `workouts/plan-viewer/WorkoutPlanResult.jsx` | Imported by active workout flow |
| `trainer-app/screens/FindTraineesScreen.jsx` | Used via trainer navigation |
| `utils/dataCacheCleanup.js` | Imported by tests + logout flow |
| `AICoachTestSuite.jsx` | Loaded via `require()` in dev only |

---

## What belongs vs what doesn't

| Layer | Belongs? | Why |
|-------|----------|-----|
| `shared-ui/` | **Yes** | Design system — heavily used |
| `shared-utils/` | **Yes** | Pure helpers (dates, sanitize) |
| `shared/` | **Yes, but bloated** | Mix of real components + orphan screens + duplicate workout/photo/report modules |
| `utils/` vs `shared-utils/` | **Overlaps** | Two utility roots — confusing, merge over time |
| `src/lib/sessions.js` | **Yes** | Used by session cards + trainer booking |
| `metrics/`, `notifications/`, `messaging/` | **Yes** | Extracted features with clear roles |
| Re-export shims in `trainer-app/` | **No** | Same noise we removed from `client-app/` |

---

## Recommended next steps (pick what you want)

1. **Fix broken `shared/ui` → `shared-ui` imports** (4 files — runtime risk)
2. **Delete obvious junk:** `Untitled`, `FluidGlass.examples.jsx`, `ios18Theme.js`, `coachingBillingLabel.js`
3. **Flatten `trainer-app/`** same as we did for `client-app/`
4. **Wire or delete** the 7 orphan `settings/screens/*` sub-screens
5. **Consolidate** duplicate shared screens (`shared/workout-plans`, `shared/photo-gallery`, `shared/weekly-report` vs `shared/screens/` barrels)

---

## Audit limitations

- Does not trace `require()` unless static string
- Does not trace Expo route names / navigation string refs
- Does not include `server/` backend usage
- `"Unused"` means **zero inbound JS imports** — not "never shown in UI"
