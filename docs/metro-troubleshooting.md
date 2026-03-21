# Metro troubleshooting (icons not updating / wrong UI)

If you see **old icons** (or any old UI) after we changed code, the most common cause is **multiple Expo/Metro servers** running at the same time (e.g. one on `8081` and another on `8082`). The Simulator can attach to the “wrong” one and keep serving stale bundles.

## Fix

- Stop all running Expo servers (in every terminal):

```bash
Ctrl+C
```

- Then start **one** Metro instance (recommended for Simulator):

```bash
npx expo start --clear --localhost --port 8081
```

## Quick check (optional)

```bash
lsof -nP -iTCP:8081 -sTCP:LISTEN
lsof -nP -iTCP:8082 -sTCP:LISTEN
ps aux | egrep 'expo start|metro' | egrep -v egrep
```






