# Coach Connect — Product quality tracker

Living checklist for scalability, performance, accessibility, and reliability.  
Run automated gates: **`npm run test:quality`**

## Automated gates (CI / pre-ship)

| Command | What it verifies |
|---------|------------------|
| `npm run test:quality` | Daily metrics + coach routing + **AI audit fixes** + **core a11y** + **Firestore indexes** |
| `npm run test:firestore-indexes` | Required composites exist in `firestore.indexes.json` |
| `npm run test:ci` | Same as quality (lint + unit scripts) |
| `npm run test:ai-coach-audit-fixes` | Coach data integrity, no 400-cal fallback, weekly aggregation |
| `npm run test:a11y-core` | Core screens have accessibility labels on primary controls |
| `npm run prerelease` | Local env + production API health |

## Status legend

- ✅ Done in repo
- 🟡 Partial
- ⬜ Not started

---

## Scalability

| Item | Status | Notes |
|------|--------|-------|
| Cloud Run API (stateless scale-out) | ✅ | `coachconnect-api` on GCP |
| Firestore security rules | ✅ | `firestore.rules` |
| API rate limits (AI + food) | ✅ | `server/index.js` |
| AI usage caps (production opt-in) | ✅ | `AI_COACH_ENFORCE_LIMITS=1` |
| Cap `completedWorkouts` reads (coach weekly) | ✅ | `.limit(100)` in `coachWeeklyData.js` |
| Composite indexes for hot queries | ✅ | `firestore.indexes.json` + `test:firestore-indexes`; deploy with Firebase CLI |
| Paginate trainer client list / long histories | ✅ | `fetchTrainerClientRosterPage` + Load more in roster UI |
| Paginate conversations / messages | ✅ | `conversationService` + `trainerMessaging` + Load more / earlier UI |
| Single write path for dashboard metrics | 🟡 | Prefer `dailyMetricsService`; AI tools also write |

---

## Performance

| Item | Status | Notes |
|------|--------|-------|
| Server-side food search (no keys in app) | ✅ | `foodRoutes.js` |
| Weekly coach context aggregated on server | ✅ | `coachWeeklyData.js` |
| `useMemo` / `useCallback` on heavy screens | 🟡 | Dashboard, trainer CRM, workouts |
| `FlatList` for long lists (chat, food) | ✅ | |
| Image disk cache (workout library) | ✅ | `cachePolicy="memory-disk"` |
| Profile / onboarding AsyncStorage cache | ✅ | `AuthGate.js` |
| Audit listener count on home screen | ⬜ | One snapshot per metric where possible |
| Sentry / performance traces | 🟡 | `monitoring.js` + `docs/MONITORING.md`; install SDK + DSN when ready |

---

## Accessibility

| Item | Status | Notes |
|------|--------|-------|
| Shared helpers | ✅ | `src/for-both/accessibility/accessibilityProps.js` |
| AI Coach chat (input, send, attach, refresh) | ✅ | `AIChatScreen.jsx` |
| Tool confirm / cancel | ✅ | `toolModalShared.js` |
| Food search (back, search, clear) | ✅ | `FoodSearchScreen.js` |
| AI Coach home category orbs | ✅ | Already labeled |
| Quick action cards | ✅ | `QuickActionCard.jsx` |
| Full app VoiceOver pass | ⬜ | Settings, onboarding, trainer CRM next |
| Dynamic type / contrast audit | ⬜ | Test largest text size on iOS |

---

## Reliability & trust

| Item | Status | Notes |
|------|--------|-------|
| AI data integrity prompt rules | ✅ | `COACH_DATA_INTEGRITY_RULE` |
| No silent 400-cal nutrition fallback | ✅ | `logNutrition` returns error |
| Weekly fetch failure user-safe prompt | ✅ | `WEEKLY_FETCH_FAILURE_NOTE` |
| Client/server `includePersonalData` agreement | ✅ | `buildCoachPromptForUser` |
| Regression script for coach fixes | ✅ | `test:ai-coach-audit-fixes` |
| Crash reporting (Sentry) | 🟡 | Optional `EXPO_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` — see `docs/MONITORING.md` |
| E2E tests (Detox / Maestro) | ⬜ | Login → log food → coach message |

---

## Next 3 sprints (recommended order)

1. **Sentry** — crashes + slow `/api/ai-coach` spans  
2. **Firestore indexes** — fix any console index links from production logs  
3. **A11y pass** — onboarding + Settings + trainer client detail (reuse `a11yProps.js`)

---

## App Store / Play review checklist

Use this when submitting a build. Keep backends live for the whole review window.

| Item | Where / notes |
|------|----------------|
| Demo **client** account | App Review notes — email + password; has a linked trainer if possible |
| Demo **trainer** account | App Review notes — email + password; Pro IAP reachable from onboarding/Settings on iOS |
| Privacy URL | `https://anatrox-auth.web.app/privacy.html` (also in-app Settings → Privacy Policy) |
| Support | Settings → Contact Support / `coachconnect0@gmail.com` |
| Account deletion | Settings → Delete Account (hold to confirm). Warns that Apple Pro billing is separate |
| Report / Block | Chat thread header ⋮ → Report/Block; long-press received message → Report; marketplace trainer → Report or block; Settings → Blocked users |
| IAP (iOS trainers) | StoreKit Pro monthly/annual; Restore purchases; Terms + Privacy on paywall |
| Stripe | Client→trainer coaching payments (person-to-person); not for digital Pro unlock |
| AI disclaimer | Optional AI Coach — not medical advice |
| Sign in with Apple | Required alongside Google on iOS |

Update this file when you check an item off.
