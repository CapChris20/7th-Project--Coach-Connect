# Coach Connect — Codebase Guide

Quick orientation for developers. **Full per-file catalog (565 files, every folder):** [`src/SRC_FILE_CATALOG.md`](src/SRC_FILE_CATALOG.md)

Regenerate the catalog: `node scripts/generateSrcFileCatalog.mjs`

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
| Auth / routing | `src/app-start/AuthGate.js`, `src/auth/detectUserRole.js` |
| Client home | `src/client-app/home/clientHomeComponents.jsx` |
| Client dashboard | `src/client-app/dashboard/TrainingDashboardScreen.jsx` |
| AI Coach chat | `src/ai-coach/chat-ui/chat-thread/ChatWithCoachScreen.jsx`, `src/ai-coach/chat-ui/chat-home/StartCoachChatScreen.jsx` |
| AI tools | `src/ai-coach/server-logic/tools/runCoachAction.js`, `src/ai-coach/tools/parseCoachToolCalls.js` |
| Nutrition | `src/nutrition/daily-log/NutritionContainer.jsx`, `src/nutrition/daily-log/logFoodToFirestore.js` |
| Daily metrics | `src/metrics/daily-metrics/saveDailyMetricsToFirestore.js` |
| Trainer CRM | `src/trainer-app/`, `src/trainer-app/crm/trainerClientFirestorePaths.js` |
| Messaging | `src/messaging/MyMessagesScreen.jsx`, `src/messaging/ChatThreadScreen.jsx` |
| API routes | `server/routes/`, `server/index.js` |

## Folder map (`src/`)

```
src/
├── app-start/     # AuthGate, ClientApp, TrainerApp, firebase config
├── auth/          # Login, onboarding, role detection
├── client-app/    # Client screens, home, navigation, profile
├── trainer-app/   # Trainer screens, CRM, sessions
├── ai-coach/      # Coach server logic, chat UI, shared tools
├── nutrition/     # Food log, search, barcode, facts screen
├── workouts/      # Workout plan viewer, generation, active workout
├── metrics/       # Daily metrics + quotes (moved from shared/)
├── messaging/     # Client/trainer chat screens (moved from shared/)
├── notifications/ # Push tokens + notification copy (moved from shared/)
├── shared/        # Cross-feature services, API helpers, components
├── shared-ui/     # Theme, layout, liquid glass UI kit
├── shared-utils/  # Date keys, Firestore sanitize, formatting helpers
├── navigation/    # Route names, bottom nav, deep links
└── settings/      # Support config, app settings screens
```

## Data conventions

1. **Client “today”** = device local date (`src/shared-utils/dateKeys.js`, `src/shared-utils/getLocalDay.js`).
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
`