# Screenshot capture tooling

Captures Coach Connect UI for redesign planning. **Does not modify app source.**

## Requirements

Environment variables (never commit these):

- `SCREENSHOT_CLIENT_EMAIL` (default `cc-screenshot-client@example.com`)
- `SCREENSHOT_CLIENT_PASSWORD`
- `SCREENSHOT_TRAINER_EMAIL` (default `cc-screenshot-trainer@example.com`)
- `SCREENSHOT_TRAINER_PASSWORD`
- Firebase Admin: `FIREBASE_SERVICE_ACCOUNT` **or** `GOOGLE_APPLICATION_CREDENTIALS` / `FIREBASE_SERVICE_ACCOUNT_PATH`
- App web: `EXPO_PUBLIC_FIREBASE_*` in the repo `.env` used by `npm run web`
- Optional: `SCREENSHOT_WEB_URL` (default `http://127.0.0.1:8081`)

## Commands

```bash
cd tools/screenshots
npm install
npx playwright install chromium

# Write portable seed JSON only
node import-seed.js --scenario empty --write-json-only
node import-seed.js --scenario with-food --write-json-only

# Live Admin seed (creates/updates Auth users + Firestore docs)
node import-seed.js --scenario with-food --apply

# Start Expo web in another terminal from repo root
npm run web

# Full pipeline
node run-all.mjs
```

## Output

```
src/screenshots/
  empty|with-food|loading|error/<role>/<screen>.png
  manifest.json
```

Statuses: `ok` | `failed` | `skipped` | `unreachable`. Failed screens stop after 3 attempts.

## Native-only (Maestro)

Requires local iOS/Android simulator + `maestro` CLI:

- Barcode scanner, Add File camera, Pay trainer (Stripe native), Pro expired / free trial banner, trainer onboarding face camera

```bash
node maestro/run-maestro.mjs
```
