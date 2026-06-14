# Firestore path map (Coach Connect)

Firebase project: **`anatrox-auth`** (do not rename in config).

## Canonical paths

| Concept | Canonical path | Notes |
|--------|----------------|-------|
| User profile | `users/{uid}` | Auth + onboarding truth |
| Client registry | `clients/{uid}` | Discovery/registry; built from `users` via `clientProfileFirestore.js` |
| Trainer registry | `trainers/{uid}` | Marketplace |
| Trainer ↔ client roster | `trainer_clients/{trainerId}/clients/{clientId}` | CRM row |
| Trainer sessions | `trainer_clients/{trainerId}/sessions/{sessionId}` | Scheduling |
| Daily metrics | `users/{uid}/dailyLogs/{dateKey}` | Writes via `dailyMetricsService.js` only |
| Daily mirror (legacy) | `users/{uid}/daily_tracking/{dateKey}` | Read fallback only; mirror on write in service |
| Trainer–client link index | `trainer_client_links/{trainerId}_{clientId}` | Written on accept |

## Legacy (read fallback / migration only)

| Legacy path | Status |
|-------------|--------|
| `clients/{clientId}` (top-level) | Old CRM; **read fallback** in `trainerClientFirestorePaths.js`; new writes go to `trainer_clients/.../clients` |
| `clients/{clientId}/progress|tasks|notes` | Subcollections; fallback read when canonical empty |
| `collectionGroup('clients')` with `documentId()` | **Invalid** — use full path (see `ClientApp` reconcile comment) |

## Code entry points

- **Trainer CRM reads/writes:** `src/trainer/lib/trainerClientFirestorePaths.js`, `TrainerApp.js` CRM exports
- **Client registry read:** `src/shared/services/clientRegistryFirestore.js`
- **Roster live listener:** `src/trainer/hooks/useTrainerClients.js` → `trainer_clients/{trainerId}/clients`
- **Server registry merge:** `server/clientProfileFirestore.js`, `server/routes/onboardingRoutes.js`

## New code rules

1. **Do not** add new top-level `clients/{id}` writes except documented legacy mirror in `createOrUpdateClient`.
2. **Do** read `trainer_clients/{trainerId}/clients/{clientId}` first, then legacy `clients/{clientId}` if missing.
3. **Do** use `users/{uid}/dailyLogs` for dashboard metrics (never a second write path).
