# CoachConnect production checklist

## Done in repo (baseline)

- [x] Dead code removed (42 tracked files + prior cleanup commits)
- [x] Unused bundled assets removed (105 `src/assets/` files where unreferenced)
- [x] Food search: `AbortController` timeouts and `AbortError` handling (`foodSearchProvider.js`)
- [x] `app.config.js`: Expo Notifications `icon` points at an existing file (`./assets/icon.png`)
- [x] Central logger: `src/shared/services/logger.js` (debug/warn dev-only; `error` always logs)
- [x] High-traffic modules wired to `logger`: `foodSearchProvider.js`, `AIChatScreen.jsx`, `chatService.js`, `AuthGate.js`
- [x] ESLint 8 + `.eslintrc.json` + `@babel/eslint-parser` (Expo / JSX)
- [x] `eslint-plugin-react-hooks` pinned to **4.6.2** (avoids React Compiler–style hook rules that flag most RN class components)

## Lint commands

- `npm run lint` — full `src/` pass (currently **many warnings**, mostly `no-console` + `no-unused-vars`; exit 0).
- `npm run lint:ci` — same with `--max-warnings 10000` for CI until warnings are burned down.
- `npm run lint:fix` — safe auto-fixes only.

**Note:** `npx eslint src/ --max-warnings=0` will **fail** until console / unused-var noise is reduced repo-wide.

## Pre-submission (you)

- [ ] `npm run lint:ci` in CI (or tighten `--max-warnings` over time)
- [ ] `npx expo export` or `eas build` for release binaries
- [ ] Apple / Google store listings, privacy policy URLs, support email (`EXPO_PUBLIC_SUPPORT_EMAIL`)
- [ ] Optional: wire `logger.error` to Sentry / Crashlytics

## Post-launch

- [ ] Crash and ANR dashboards
- [ ] API error rates (food search, AI coach)
- [ ] Plan v1.1 from user feedback

## Restore points (git tags)

- `backup/before-42-deletions-20260513`
- `backup/before-asset-cleanup-20260513`

Restore example: `git fetch origin tag backup/before-asset-cleanup-20260513 && git checkout backup/before-asset-cleanup-20260513`
