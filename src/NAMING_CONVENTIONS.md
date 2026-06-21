# Coach Connect — Naming Conventions

Consistent names reduce ADHD navigation friction. Follow these when adding or renaming files.

---

## Folders

| Pattern | Example | When |
|---------|---------|------|
| `kebab-case` | `food-search/`, `daily-metrics/` | All multi-word folder names |
| Role suffix `-app` | `client-app/`, `trainer-app/` | Role shells only |
| Domain noun | `nutrition/`, `workouts/`, `metrics/` | Top-level features |
| Layer prefix `shared-` | `shared-ui/`, `shared-utils/` | Cross-cutting non-feature layers |

**Avoid:** `src/client/`, `src/trainer/`, `src/ai/`, `src/aiChat/` (legacy — removed).

---

## Files

### Screens

| Rule | Example |
|------|---------|
| PascalCase + `Screen` suffix | `TrainingDashboardScreen.jsx` |
| Role prefix when ambiguous | `MyMessagesScreen`, `ChatWithTrainerScreen` |
| `.jsx` for components with JSX | Prefer `.jsx` over `.js` for screens |

### Components (non-screen)

| Rule | Example |
|------|---------|
| PascalCase | `CoachFormattedReply.jsx` |
| Sheet suffix for bottom sheets | `AdjustMacroTargetsSheet.jsx` |
| Modal suffix for centered modals | `ToolConfirmationModal.jsx` |

### Services / logic modules

| Rule | Example |
|------|---------|
| camelCase | `logFoodToFirestore.js` |
| Verb-first | `searchFoodsService.js`, `sendTrainerNotification.js` |
| No `Screen` suffix | — |

### Hooks

| Rule | Example |
|------|---------|
| `use` prefix | `useClientHomeDailyMetrics.js` |
| camelCase file name | `useTrainerScreenNavigation.js` |

### Tests

| Rule | Example |
|------|---------|
| Mirror source + `.test.js` | `coachPersonalDataRouting.test.js` |
| Under `src/__tests__/unit/` or `integration/` | — |

---

## Exports

| Prefer | Avoid |
|--------|-------|
| One default export per screen | Multiple unrelated defaults |
| Named exports for utilities | Default export for pure helpers |
| `runCoachAction` (action verb) | `executeCoachTool` (legacy alias — deprecated) |

Re-export shims are OK for backward compatibility:

```js
// client-app/screens/MyMessagesScreen.jsx
export { default } from '../../messaging/MyMessagesScreen';
```

Document the **canonical path** in a comment when using a shim.

---

## Component names vs file names

**File name should match the primary export** when possible.

| Good | Bad |
|------|-----|
| `ViewMyProfileScreen.jsx` → `ViewMyProfileScreen` | `ViewMyProfileScreen.jsx` → `ViewMyViewMyProfileScreen` |
| `LoginScreen.js` → `LoginScreen` | `AuthScreen.js` (legacy name) |

Known typos to fix in a future pass (do not extend):

- `ViewMyViewMyProfileScreen` → `ViewMyProfileScreen`
- `EditViewMyViewMyProfileScreen` → `EditProfileScreen`

---

## Import path segments

After rename, use these path roots:

| Domain | Import from |
|--------|-------------|
| AI coach UI | `ai-coach/chat-ui/...` |
| AI coach logic | `ai-coach/server-logic/...` |
| AI tool parsing | `ai-coach/tools/...` |
| Daily metrics | `metrics/daily-metrics/...` |
| Push / notifications | `notifications/...` |
| Chat screens | `messaging/...` |
| Theme / glass UI | `shared-ui/...` |
| Date keys, sanitize | `shared-utils/...` |
| App entry | `app-start/...` |

**Never** import from removed paths: `shared/daily-metrics/`, `shared/notifications/`, `src/ai/`, `src/aiChat/`.

---

## Firebase / branding

| Keep | Do not rename in code/config |
|------|------------------------------|
| `anatrox-auth` | Firebase `projectId` |
| `anatrox` in env files | Unless migrating projects intentionally |

Display name “Coach Connect” is fine in UI strings.

---

## Scripts and docs

| Type | Pattern |
|------|---------|
| Generator scripts | `generateSrcFileCatalog.mjs` |
| One-off fix scripts | `fixRenameImports.mjs` |
| Architecture docs | `ARCHITECTURE.md`, `STYLE_GUIDE.md` (UPPER_SNAKE or Title Case) |

Regenerate catalog after large moves: `node scripts/generateSrcFileCatalog.mjs`
