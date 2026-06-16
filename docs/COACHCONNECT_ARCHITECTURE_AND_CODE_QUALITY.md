# CoachConnect — Architecture & Code Quality Report

> Generated from codebase audit (June 2026). Firebase production project: **`anatrox-auth`** (do not rename).

---

## 1. System overview

CoachConnect is an Expo React Native app with an Express API on Cloud Run and Firebase (`anatrox-auth`).

```
App → AuthGate → TrainerApp | ClientApp
                    ↓
              AI Coach → DeepSeek (server) + tool executor → Firestore
              Workout gen → Claude (server) → Firestore plans
              Nutrition → Cloud Run food API → nutrition_logs
```

**Key paths (current layout):**
- Auth: `src/app/AuthGate.js`, `src/shared/services/fetchUserProfile.js`
- AI context: `src/ai/context/CoachContextProvider.js`
- AI chat persistence: `src/aiChat/persistence/saveCoachMessagesToFirestore.js`
- Nutrition logs: `src/nutrition/daily-log/logFoodToFirestore.js`
- Workout screen: `src/workouts/active-workout/workout.js`
- Trainer CRM: `src/trainer/crm/resolveLinkedTrainerClients.js`

---

## 2. Data flow (user → Firebase → AI → response)

1. User signs in → `AuthGate` reads `users/{uid}` from Firestore (not `/api/me` on bootstrap).
2. AI Coach sends message → `POST /api/ai-coach` → DeepSeek + optional web search.
3. Tool proposals → user confirms → `executeCoachTool` → server and/or client Firestore writes.
4. Chat history → `users/{uid}/aiChats/{sessionId}` metadata + `messages/{msgId}` subcollection.

---

## 3. Trainer–client linking

- `users.trainerId` on client doc
- `trainer_clients/{trainerId}/clients/{clientId}` CRM rows
- `trainer_client_links` for invite codes
- `removeTrainerClientLink` Cloud Function — caller must be trainer or client

---

## 4. Code quality findings (summary)

| Area | Issue | Severity |
|------|--------|----------|
| `workout.js` | ~5,300-line monolith | P0 (partial split done elsewhere) |
| Auth bootstrap | Was unreachable `/api/me` fallback | P0 — fixed |
| `aggregateUserContext` | Sequential Firestore reads | P0 — parallelized in `CoachContextProvider` |
| Trainer client list | N+1 `getDoc` per CRM row | P1 — batched `documentId in` |
| AI chat storage | Full `messages[]` rewrite | P1 — subcollection + incremental upsert |
| Workout limits | Duplicate constant names | P2 — `WORKOUT_GENERATION_LIMIT` in `trackWorkoutGenerationUsage.js` |
| Debug logs | `[DEBUG]` in prod paths | P2 — removed from client/server hot paths |
| Nutrition search | `boneless` → branded mis-route | P1 — `isGroceryIngredientQuery` |
| Scale barcodes | Not in USDA/OFF | P1 — `variableWeightBarcode.js` hint |

---

## 5. DeepSeek + Claude integration

| Feature | Provider | Entry |
|---------|----------|-------|
| AI Coach chat | DeepSeek | `server/index.js`, `aiCoachServerService.js` |
| AI Coach vision | Replicate VL | server routes |
| Web search | Serper / Perplexity | `detectWebSearchRequest.js` |
| Workout plan generation | Claude (Anthropic) | `requestWorkoutPlan.js`, `workoutRoutes.js` |

---

## 6. Module map (selected)

```
src/app/AuthGate.js
src/ai/context/CoachContextProvider.js
src/ai/tools/executeCoachTool.js
src/ai/tools/cleanupToolParams.js
src/aiChat/persistence/saveCoachMessagesToFirestore.js
src/nutrition/daily-log/logFoodToFirestore.js
src/nutrition/food-search/rankFoodSearchResults.js
server/lib/variableWeightBarcode.js
server/nutritionSearchHelpers.js
functions/index.js
```

---

## 7. Remediation status (2026-06)

| Priority | Issue | Status |
|----------|-------|--------|
| P0 | AuthGate dead `/api/me` block in bootstrap | **Done** — Firestore-first; `fetchUserProfile()` helper |
| P0 | Split `workout.js` | **Partial** — usage/API extracted; main screen still ~5,300 lines |
| P0 | Parallelize context aggregation | **Done** — `CoachContextProvider` `Promise.allSettled` |
| P1 | Incremental aiChat message storage | **Done** — message subcollection; `upsertAiChatMessages`; legacy field cleared |
| P1 | N+1 trainer clients | **Done** — batched lookups in `resolveLinkedTrainerClients` |
| P1 | Nutrition scale barcode + grocery search | **Done** — `variableWeightBarcode`, `isGroceryIngredientQuery` |
| P1 | Food history on every log | **Done** — `saveFoodToHistory`, Quick Add + search chips |
| P2 | Tool param aliases | **Done** — `cleanupToolParams.js` |
| P2 | Debug logs | **Done** — removed `[DEBUG]` from hot paths |
| P2 | Unused `Constants` in config | **Done** |
| P2 | Firestore index `user_id + created_at` | **Done** — `firestore.indexes.json` + verify script |
| P2 | Workout limit constant alignment | **Done** — `WORKOUT_GENERATION_LIMIT` exported |

**Still optional:** further `workout.js` UI extraction (`WorkoutPlanResult`, hooks); `useAICoachChat` hook for `AIChatScreen`.

---

*See also: `docs/SYSTEM_DESIGN.md`, `docs/FIRESTORE_PATHS.md`, `docs/TRAINER_APP_COMPETITOR_AUDIT.md`.*
