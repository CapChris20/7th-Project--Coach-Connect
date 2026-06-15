# Coach Connect — Architecture

Expo SDK 54 client + Node.js API on Google Cloud Run, backed by Firebase project **`anatrox-auth`** (do not rename in config).

## How to navigate `src/`

Folders are named after **features and screens**, not file types (`screens/`, `components/`, `hooks/`).

| You want… | Go to… |
|-----------|--------|
| Client home bootstrap | `src/client/home/useClientHomeBootstrap.js` |
| Client dashboard | `src/client/dashboard/MyDashboardScreen.jsx` |
| Client files & notes | `src/client/files/` |
| Find a trainer | `src/client/marketplace/` |
| Trainer dashboard | `src/trainer/dashboard/` |
| Trainer progress tab | `src/trainer/progress-tab/` |
| Client requests | `src/trainer/client-requests/` |
| Spreadsheet / docs editor | `src/trainer/documents/SpreadsheetEditorModal.js` |
| Food search | `src/nutrition/food-search/` |
| AI coach thread | `src/aiChat/chat-thread/` |
| Daily metrics writes | `src/shared/daily-metrics/saveDailyMetricsToFirestore.js` |

## Client (`src/client/`)

- `home/` — home tab UI + bootstrap hooks
- `dashboard/` — My Dashboard screen + hero/stats cards
- `files/` — trainer files, notes, shared docs
- `marketplace/` — find trainer flow
- `messaging/`, `weekly-report/`, `photo-gallery/`, `workout-plans/`, `meal-plan/`
- `navigation/` — tab shell (kept as-is)

## Trainer (`src/trainer/`)

- `dashboard/`, `progress-tab/`, `nutrition-tab/`, `calendar-tab/`
- `client-requests/`, `clients-list/`, `client-detail/`, `crm/`
- `sessions/`, `documents/`, `payments/`, `messaging/`, `weekly-report/`
- `navigation/` — tab shell

## Nutrition (`src/nutrition/`)

- `daily-log/`, `food-search/`, `food-details/`, `barcode/`, `quick-add/`, `settings/`

## AI Coach (`src/aiChat/`)

- `chat-home/`, `chat-thread/`, `tool-modals/`, `voice/`, `persistence/`

## Workouts (`src/workouts/`)

- `active-workout/`, `plan-generator/`, `plan-viewer/`, `exercise-library/`

## Shared (`src/shared/`)

- `api/`, `daily-metrics/`, `firestore/`, `notes-files/`, `coach-tools/`
- `components/` — UI reused by **both** client and trainer only

## Reorg scripts

```bash
node scripts/reorganizeByFeature.js   # feature-folder moves (already applied)
node scripts/fixRelativeImports.js    # fix ../ paths after moves
node scripts/rewriteFeatureImports.js # second import pass
node scripts/applyFileRenames.js --apply  # descriptive file renames
```

## Tests

```bash
npm test
npm run test:quality
```

See also `docs/FIRESTORE_PATHS.md`, `docs/PRODUCT_QUALITY.md`.
