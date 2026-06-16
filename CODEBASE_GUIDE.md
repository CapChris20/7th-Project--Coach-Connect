# Coach Connect — Codebase Guide

Quick orientation for developers. **Full per-file catalog (409+ files):** [`src/CODEBASE_GUIDE.md`](src/CODEBASE_GUIDE.md)

Regenerate the catalog: `node scripts/appendSrcInventoryToGuide.mjs`

For architecture diagrams see [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`docs/SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md).

## Stack

| Layer | Tech |
|-------|------|
| Mobile | Expo SDK 54, React Native 0.81, React Navigation 6 |
| Backend | Node.js on Cloud Run (`server/`) |
| Data | Firebase Auth + Firestore (project **`anatrox-auth`** — do not rename in config) |
| AI | DeepSeek + Perplexity + Serper (server-routed) |

## Where to start

| Task | Start here |
|------|------------|
| Auth / routing | `src/app/AuthGate.js`, `src/auth/authGateHelpers.js` |
| Client home | `src/client/components/home/clientHomeComponents.jsx` |
| Client dashboard | `src/client/screens/MyDashboardScreen.jsx` |
| AI Coach chat | `src/aiChat/screens/AIChatScreen.jsx`, `src/aiChat/screens/AIChatHomeScreen.jsx` |
| AI tools | `src/ai/tools/executeCoachTool.js`, `src/ai/tools/validateCoachToolProposal.js` |
| Nutrition | `src/nutrition/screens/NutritionContainer.jsx`, `src/nutrition/daily-log/logFoodToFirestore.js` |
| Daily metrics | `src/shared/daily-metrics/saveDailyMetricsToFirestore.js` |
| Trainer CRM | `src/trainer/`, `src/trainer/lib/trainerClientFirestorePaths.js` |
| API routes | `server/routes/`, `server/index.js` |

## Folder map (`src/`)

```
src/
├── app/           # AuthGate, ClientApp, TrainerApp, firebase config
├── auth/          # Login, onboarding, auth helpers
├── client/        # Client screens, home components, navigation
├── trainer/       # Trainer screens, CRM, sessions
├── ai/            # Coach context, tools, DeepSeek client, guards
├── aiChat/        # AI Coach UI (home, chat, modals, persistence)
├── nutrition/     # Food log, search, barcode, facts screen
├── workouts/      # Workout plan viewer, generation, active workout
├── shared/        # Cross-feature services, UI kit, utils
├── navigation/    # Route names, bottom nav, deep links
└── settings/      # Support config, app settings helpers
```

## Data conventions

1. **Client “today”** = device local date (`src/app/dateKey.js`, `src/shared/utils/getLocalDay.js`).
2. **Canonical daily writes** → `users/{uid}/dailyLogs/{date}` via `dailyMetricsService.js` only.
3. **Trainer CRM** → `trainer_clients/{trainerId}/clients/{clientId}` (legacy `clients/` still read as fallback).
4. **AI tool execution** → client confirms → `POST /api/ai-coach/execute-tool` → Firestore.

## Scripts

```bash
npm start                    # Expo dev client
npm run server               # Local API (port 4000)
npm test                     # Jest unit + integration (see test-results.txt)
npm run test:food-search:smoke
npm run test:quality         # Node smoke scripts (metrics, coach routing, a11y)
node scripts/addFileHeaders.js          # Add @file-header blocks (safe to re-run)
node scripts/applyFileRenames.js        # Feature reorg + renames (see --dry-run)
node scripts/applyFileRenames.js --dry-run
```

## Tests

- **Jest** (`src/__tests__/`): guards, auth helpers, nutrition math, coach parsing, integrations.
- **Node scripts** (`scripts/test*.js`): API routing, daily metrics, food search accuracy.
- **k6** (`load-tests/coach-api-smoke.js`): health + auth smoke against local/staging API.

## Firebase safety

- Production project ID is **`anatrox-auth`**. Display name may say “Coach Connect”.
- Never bulk-rename `anatrox` → `coachconnect` in `.env`, `firebaseConfig`, or `google-services` files.
- See `.cursor/rules/firebase-project-id.mdc`.

## UI reference screenshots

June 2026 design targets: `.ui-refs-temp/ref1.png` … `ref16.png` (client home, nutrition, AI Coach).

## Related docs

- [`docs/FIRESTORE_PATHS.md`](docs/FIRESTORE_PATHS.md) — collection paths
- [`docs/PRODUCT_REQUIREMENTS.md`](docs/PRODUCT_REQUIREMENTS.md) — product scope
- [`docs/PRODUCT_QUALITY.md`](docs/PRODUCT_QUALITY.md) — quality bar
- [`RESTORE-INSTRUCTIONS.md`](RESTORE-INSTRUCTIONS.md) — emergency rollback
