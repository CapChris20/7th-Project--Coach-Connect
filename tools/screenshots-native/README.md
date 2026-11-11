# Native UI screenshot capture (Maestro + iOS Simulator)

Captures real Coach Connect UI on the **Coach Connect iPhone** simulator for redesign planning.

## Requirements

- Booted iOS Simulator with `com.coachconnect` dev client installed
- Metro: `npx expo start --dev-client --localhost --port 8081`
- API: `npm run server`
- Maestro CLI + Java 17
- Env credentials in `.env.maestro` (gitignored):

```bash
export MAESTRO_CLIENT_EMAIL="..."
export MAESTRO_CLIENT_PASSWORD="..."
export MAESTRO_TRAINER_EMAIL="..."
export MAESTRO_TRAINER_PASSWORD="..."
```

Live accounts → **with-data only**; empty logged-in states are marked `skipped` in the manifest (no production data wipe).

## Run

```bash
source .env.maestro
node tools/screenshots-native/capture.mjs
```

## Output

```
src/screenshots/<state>/<role>/<screen>--01-top.png
src/screenshots/<state>/<role>/<screen>--02-scroll.png
src/screenshots/<state>/<role>/<screen>--03-bottom.png
src/screenshots/manifest.json
```

Each PNG is verified (file size + lower-frame pixel variance + OCR expected text). Up to 3 attempts, then `failed` in the manifest.

`captureMethod` is always `maestro-ios` for this pipeline (not Playwright web).
