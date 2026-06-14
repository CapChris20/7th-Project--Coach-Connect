# Monitoring & crash reporting

Coach Connect uses a **no-op-by-default** monitoring layer. Nothing is sent until you set a DSN and install Sentry.

## Client (Expo app)

1. Create a project at [sentry.io](https://sentry.io).
2. Install: `npx expo install @sentry/react-native`
3. Add to `.env` (not committed):

   ```bash
   EXPO_PUBLIC_SENTRY_DSN=https://…@….ingest.sentry.io/…
   ```

4. `initMonitoring()` runs at startup in `App.js`.
5. Errors flow through `logger.error` and `autoLogError` → `captureException`.

## Server (Cloud Run / local)

1. Add `SENTRY_DSN` to Cloud Run env (or local `.env`).
2. In `server/`: `npm install @sentry/node`
3. `initServerMonitoring()` runs when `server/index.js` loads.
4. Call `captureServerException(err, { route: '…' })` from catch blocks as you add them.

## Firestore indexes (scale)

Deploy composite indexes after pulling `firestore.indexes.json`:

```bash
firebase deploy --only firestore:indexes --project anatrox-auth
```

Verify locally: `npm run test:firestore-indexes`

## Quality gate

`npm run test:quality` includes index verification plus coach/a11y scripts.
