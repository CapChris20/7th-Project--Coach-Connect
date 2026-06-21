# Coach Connect — Style Guide (Imports & Dependencies)

How modules should depend on each other after the folder rename.

---

## Dependency layers (top → bottom)

```
app-start, client-app, trainer-app     ← composition / navigation
         ↓
feature domains (nutrition, workouts, ai-coach, messaging, metrics, settings, auth)
         ↓
shared, shared-ui, navigation
         ↓
shared-utils, utils
```

**Rules:**

1. Lower layers must **not** import from `client-app` or `trainer-app`.
2. `client-app` and `trainer-app` must **not** import each other.
3. `shared-utils` must **not** import React, Firebase, or Expo.
4. Secrets and AI keys stay in **`server/`** only.

---

## Import path depth cheat sheet

From a file, count folders up to `src/`, then down to target.

| Your file location | To reach `shared/api/baseUrl.js` |
|--------------------|----------------------------------|
| `src/nutrition/food-search/FoodSearchScreen.js` | `../../shared/api/baseUrl` |
| `src/client-app/screens/Foo.jsx` | `../../shared/api/baseUrl` |
| `src/ai-coach/server-logic/tools/runCoachAction.js` | `../../../shared/api/baseUrl` |
| `src/ai-coach/chat-ui/chat-thread/ChatWithCoachScreen.jsx` | `../../../shared/api/baseUrl` |
| `src/messaging/MyMessagesScreen.jsx` | `../shared/api/baseUrl` |
| `src/app-start/ClientApp.js` | `../shared/api/baseUrl` |

**Common mistake:** Using `../chat-ui/` or `../server-logic/` from `app-start/` — those folders live under **`ai-coach/`**:

```js
// ✅ Correct
import ChatWithCoachScreen from '../ai-coach/chat-ui/chat-thread/ChatWithCoachScreen';
import { sendMessage } from '../ai-coach/server-logic/trainer-messaging/sendTrainerNotification';

// ❌ Wrong (folder does not exist)
import ChatWithCoachScreen from '../chat-ui/chat-thread/ChatWithCoachScreen';
```

---

## Canonical import targets

| Need | Import from |
|------|-------------|
| Firebase `auth`, `db` | `app-start/config` |
| Theme | `shared-ui/ThemeContext` |
| Local date key | `shared-utils/dateKeys` or `getLocalDay` |
| Daily metrics write | `metrics/daily-metrics/saveDailyMetricsToFirestore` |
| Push permissions | `notifications/manageNotifications` |
| Chat Firestore API | `ai-coach/server-logic/trainer-messaging/sendTrainerNotification` |
| Chat UI screens | `messaging/MyMessagesScreen`, `messaging/ChatThreadScreen` |
| Coach tool execution | `ai-coach/server-logic/tools/runCoachAction` |
| Tool call JSON parse | `ai-coach/tools/parseCoachToolCalls` |
| API base URL | `shared/api/baseUrl` |

---

## Re-export shims

Allowed for backward compatibility — keep them **one line**:

```js
export { default } from '../../messaging/MyMessagesScreen';
```

Prefer importing the **canonical** path in new code. Shims live in:

- `client-app/screens/*` → often → `shared/screens/*` → feature impl
- `client-app/messaging/*` → `client-app/screens/*`
- `ai-coach/chat-ui/chat-home/StartCoachChatScreen.jsx` → `screens/StartCoachChatScreen.jsx`

---

## Do's

- Use `@file-header` doc block on new modules (see existing files).
- Match surrounding quote style (`'` vs `"`) in the file you edit.
- Run `npm test` after import path changes.
- Run `node scripts/fixRenameImports.mjs` only after bulk renames (script is idempotent on `from '...'` lines).
- Regenerate catalog after large moves: `node scripts/generateSrcFileCatalog.mjs`

---

## Don'ts

- Don't import from deleted paths: `shared/daily-metrics/`, `shared/notifications/`, `src/ai/`, `src/aiChat/`, `src/app/`.
- Don't add business logic to `app-start/` beyond shell wiring.
- Don't duplicate Firestore write paths — use existing metrics/nutrition services.
- Don't rename `anatrox-auth` or bulk-replace `anatrox` in env/config (see `.cursor/rules/firebase-project-id.mdc`).
- Don't delete `.jsx` components without explicit confirmation (see execution plan protection rules).

---

## Relative vs absolute

This codebase uses **relative imports** only (no `@/` alias). When moving a file, update every importer — use ripgrep:

```bash
rg "from '.*/OldFileName" src/
```

---

## Server ↔ mobile boundary

| Mobile (`src/`) | Server (`server/`) |
|-----------------|-------------------|
| `shared/api/getAuthHeaders.js` | Verifies Firebase token |
| `ai-coach/server-logic/chat-api/sendCoachMessageToServer.js` | POST `/api/ai-coach/...` |
| `ai-coach/server-logic/tools/runCoachAction.js` | POST `/api/ai-coach/execute-tool` |
| Nutrition search UI | `server/routes/nutritionSearchRoutes.js` |

Mobile never calls DeepSeek/Perplexity/Serper directly.

---

## Testing imports

Tests live in `src/__tests__/` and mirror production depth:

```js
// From src/__tests__/unit/foo.test.js
import { runCoachAction } from '../../ai-coach/server-logic/tools/runCoachAction';
```

After moving modules, update test imports alongside production imports.

---

## Related

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — folder map
- [`NAMING_CONVENTIONS.md`](NAMING_CONVENTIONS.md) — file names
- [`AUDIT_REPORT.md`](AUDIT_REPORT.md) — known broken paths to fix
