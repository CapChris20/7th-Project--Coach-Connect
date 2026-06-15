# Cursor prompt: Pay down technical debt (production-grade Coach Connect)

Copy everything inside the fenced block below into a **new Cursor Agent chat**. Work phase-by-phase; do not stop after phase 1 unless the user says to pause.

---

```
You are a senior React Native + Node.js engineer working on **Coach Connect** (Expo SDK 54, React Native 0.81, Firebase project `anatrox-auth`). Your job is to **eliminate remaining technical debt** and bring the codebase to a standard where an experienced developer would say: “This is well-structured and maintainable.”

This is NOT a greenfield rewrite. Make **incremental, testable PR-sized changes**. Preserve all existing behavior unless you are fixing a confirmed bug.

## Non-negotiable constraints

1. **Firebase project ID** is `anatrox-auth`. Never bulk-rename `anatrox` → `coachconnect` in `.env`, `firebaseConfig`, `app.config.js`, or plist/json tied to the live project.
2. **Do not** migrate to a new Firebase project.
3. **Client “today”** = device local date via `getClientDateKey()` / `getLocalDateKey()` in `src/app/dateKey.js` and `src/shared/utils/getLocalDay.js`.
4. **Trainer weekly / server default day boundary** = `getDateKey()` (America/New_York) where already used for trainer jobs.
5. **Canonical daily metrics write path**: `src/shared/daily-metrics/saveDailyMetricsToFirestore.js` → `users/{uid}/dailyLogs/{date}`; mirror to `daily_tracking` only inside that service (or `server/lib/dailyMetricsServer.js` on server). **No new dual-write call sites.**
6. **Only create git commits when the user explicitly asks.**

## Already done (do not redo)

- `dailyMetricsService.js` + `dailyMetricsServer.js` (canonical writes + mirror)
- `useClientHomeDailyMetrics` hook (home rollover + live sync)
- `useLocalTodayDateKey` + `dailyDashboardDayRollover.js`
- Server modules: `server/middleware/auth.js`, `server/routes/healthRoutes.js`, `server/routes/aiCoachRoutes.js`
- Removed unused deps: `@react-navigation/*`, `@tanstack/react-query`, `zustand`
- Tests: `npm run test:daily-metrics`, `npm run test:coach-web-search`
- Parse priority: `dailyLogs` preferred over `daily_tracking` on read (`parseDailyMetricsFromSnapshots`)

Read `docs/PRODUCT_REQUIREMENTS.md` and `.cursor/rules/firebase-project-id.mdc` before large changes.

---

## Phase 1 — Daily data: single source of truth (HIGH)

**Goal:** One read path, one write path; midnight rollover reliable.

### Tasks
1. **Audit** all `daily_tracking` / `dailyLogs` reads and writes under `src/` and `server/`. Grep is the source of truth.
2. **Route every write** through `mergeClientDailyMetrics` / `saveDashboardMetricField` / `saveDashboardWorkoutLog` / `saveDashboardSleepHours` (client) and `mergeUserDailyMetrics` (server).
3. **Simplify listeners**:
   - `MyDashboardScreen` `useCardState`: `dailyLogs` only (tracking fallback only inside `parseDailyMetricsFromSnapshots` if needed for legacy docs).
   - `useWorkoutLog`: same — prefer one `onSnapshot` on `dailyLogs`; optional one-time `getDoc` on tracking for legacy hydration only.
4. **Deduplicate parse logic**: `src/shared/services/dailyMetricsParse.cjs` must stay in sync with `dailyMetricsService.js` OR be generated from one source — prefer extracting shared pure functions to `dailyMetricsParse.cjs` and importing/re-exporting in the ESM service if bundler allows, or a single `.js` pure module with no Firebase imports.
5. **Server AI tools**: ensure `logSleep`, `rateEnergy`, `logMood`, and any dashboard-touching tools use `mergeUserDailyMetrics` only.

### Acceptance criteria
- [ ] `rg "daily_tracking" src/` shows only: service mirror, parse fallback, rollover archive, and documented legacy reads with a TODO to remove.
- [ ] `npm run test:daily-metrics` passes.
- [ ] Manual: log water/sleep on dashboard → home updates; past midnight → today clears.

---

## Phase 2 — Server modularization (HIGH)

**Goal:** `server/index.js` becomes a thin composition root (~500–800 lines), not a 5k-line monolith.

### Extract route modules (handlers can stay in `server/handlers/` as you extract)
| Module | Routes (examples) |
|--------|-------------------|
| `server/routes/foodRoutes.js` | `/api/food/search`, barcode, usda, restaurant |
| `server/routes/onboardingRoutes.js` | `/api/onboarding/*` |
| `server/routes/supportRoutes.js` | `/api/support/contact`, `/api/log-error` |
| `server/routes/workoutRoutes.js` | `/api/workout/generate` |
| `server/routes/notificationsRoutes.js` | `/api/notifications/send` |
| `server/routes/marketplaceRoutes.js` | `/api/trainers*` (if still in index) |

Pattern (already used for AI coach):
```js
// server/index.js
const { registerFoodRoutes } = require('./routes/foodRoutes');
registerFoodRoutes(app, { verifyFirebaseBearerToken, db, ...deps });
```

### Acceptance criteria
- [ ] `server/index.js` line count reduced by at least 40% from current ~5000.
- [ ] `node -e "require('./server/index.js')"` or `npm run server` boots without errors.
- [ ] `curl localhost:4000/health` and `/api/health` return JSON.
- [ ] Existing scripts still pass: `test:daily-metrics`, `test:coach-web-search`.

---

## Phase 3 — App shell decomposition (HIGH)

**Goal:** `ClientApp.js` and `TrainerApp.js` are navigators + composition, not 6k-line god files.

### ClientApp — extract (minimum)
| Extract | Suggested path |
|---------|----------------|
| Home daily metrics | ✅ `useClientHomeDailyMetrics` — extend if needed |
| Home feed / stats row | `src/client/hooks/useClientHomeFeed.js` |
| Nutrition summary for home | `src/client/hooks/useClientHomeNutrition.js` |
| Sessions / calendar strip | `src/client/components/home/WeekCalendarCard.jsx` (already inline — move) |
| Screen router / tab state | `src/app/clientNavigation.js` (constants + `renderClientScreen`) |

### TrainerApp — extract (minimum)
| Extract | Suggested path |
|---------|----------------|
| Client list + selection | `src/trainer/hooks/useTrainerClientSelection.js` |
| Client dailyLogs listener | `src/trainer/hooks/useTrainerClientDailyLog.js` |
| Progress tab data | `src/trainer/hooks/useTrainerClientProgress.js` |

### Rules
- Move **one concern per PR/commit** when user asks to commit.
- No behavior change: same props to child screens.
- Run `npm run lint` on touched files.

### Acceptance criteria
- [ ] Each app shell file under **2500 lines** (stretch: under 1500).
- [ ] No new circular imports.
- [ ] App boots in Expo (`npx expo start`) without red screen.

---

## Phase 4 — Navigation (MEDIUM — do after Phases 1–3)

**Goal:** Replace boolean `currentScreen` / tab state with **React Navigation** (packages were removed — re-add intentionally).

1. Add `@react-navigation/native`, `@react-navigation/bottom-tabs`, `react-native-screens` (already present), gesture-handler.
2. **Client**: bottom tabs = Home, Dashboard, Nutrition, AI Coach, Profile (match current UX).
3. **Trainer**: bottom tabs = Hub, Clients, Schedule, Messages, Profile (match current).
4. Preserve modal flows (trainer profile sheet, AI tool modals) as stack screens or modals.
5. Deep linking can be stubbed (`linking` config) for future.

### Acceptance criteria
- [ ] Hardware back behaves correctly on Android.
- [ ] Tab state survives background/foreground.
- [ ] No duplicate mounts causing double Firestore listeners (use focus listeners carefully).

---

## Phase 5 — Legacy Firestore paths (MEDIUM)

**Goal:** One canonical path per concept.

| Concept | Canonical | Legacy to migrate/read-fallback |
|---------|-----------|--------------------------------|
| Trainer ↔ client | `trainer_clients/{trainerId}/clients/{clientId}` | `clients/` collection if still referenced |
| Client profile | `users/{uid}` + `clientProfile` helpers in `src/shared/services/clientProfileFirestore.js` | scattered `users` field names |

1. Grep `clients/` and `trainer_clients` — document each usage.
2. Add **read fallback** (canonical first, legacy second) where data might exist in old shape.
3. Optional: `scripts/backfillClientsCollection.js` — run only with user approval; never destructive without backup.

### Acceptance criteria
- [ ] New code only writes canonical paths.
- [ ] Trainer client list works for clients created under old and new paths.

---

## Phase 6 — Security & release hygiene (HIGH)

1. Fix `npm run test:security` failures that are **fixable in repo**:
   - `verifyIdToken` check targets `server/middleware/auth.js` (already moved).
   - Review `EXPO_PUBLIC_YOUTUBE` in `app.config.js` — move to server-only proxy if exposing keys (see `docs/SECURITY_APP_CHECK.md`).
2. Run `npm run prerelease` / `scripts/preReleaseCheck.sh` and fix blockers.
3. Ensure `firestore.rules` + `scripts/testSecurityRulesEmulator.js` pass (needs Java + emulators — document in PR if environment-limited).

---

## Phase 7 — Polish for “experienced dev impressed” (ONGOING)

- [ ] Add `ARCHITECTURE.md` at repo root: diagram (client ↔ Cloud Run ↔ Firestore), folder map, daily data flow, AI tool flow.
- [ ] Expand `test:daily-metrics` to cover rollover archive shape in `dailyDashboardDayRollover.js` (mock Firestore or pure extract).
- [ ] CI script in `package.json`: `"test:ci": "npm run test:daily-metrics && npm run test:coach-web-search && npm run lint:ci"`
- [ ] Remove dead code flagged in `docs/DEAD_CODE_AUDIT_REPORT.md` (verify each item still unused).

---

## How to work

1. Start by reading: `src/shared/daily-metrics/saveDailyMetricsToFirestore.js`, `src/shared/hooks/useClientHomeDailyMetrics.js`, `server/index.js` (first 150 lines + route grep), `App.js`, `ClientApp.js`, `TrainerApp.js`.
2. Execute **Phase 1 completely**, then Phase 2, etc. Report after each phase: files changed, tests run, line counts before/after.
3. Prefer **small commits** only when user asks.
4. If a task requires destructive Firestore migration, **stop and ask the user**.

## Success definition

An experienced developer cloning this repo should find:
- Clear boundaries (services, hooks, routes)
- One daily metrics contract
- Server routes discoverable by filename
- Automated tests for critical pure logic
- No “why are there two collections for the same thing?” without a documented migration plan

Begin with **Phase 1**. Show your audit grep results before making changes.
```

---

## Quick start in terminal

```bash
npm install
npm run test:daily-metrics
npm run test:coach-web-search
npm run server   # verify http://localhost:4000/api/health
```
