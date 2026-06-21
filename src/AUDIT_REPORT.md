# Coach Connect — Folder Structure Audit Report

**Generated:** 2026-06-21  
**Scope:** Part 5 verification only — findings reported, **no auto-fixes applied**.

---

## 1. Required major folders

| Folder | Status | Notes |
|--------|--------|-------|
| `app-start/` | ✅ Exists | 6 JS/JSX files — AuthGate, ClientApp, TrainerApp, config |
| `client-app/` | ✅ Exists | 57 JS/JSX — role shell + feature subfolders |
| `trainer-app/` | ✅ Exists | 58 JS/JSX |
| `ai-coach/` | ✅ Exists | 72 JS/JSX — `chat-ui/`, `server-logic/`, `tools/` |
| `nutrition/` | ✅ Exists | 44 JS/JSX |
| `workouts/` | ✅ Exists | 29 JS/JSX |
| `metrics/` | ✅ Exists | 5 JS/JSX — `daily-metrics/`, `daily-quotes/` |
| `messaging/` | ✅ Exists | 2 JS/JSX — top-level shared chat screens |
| `notifications/` | ✅ Exists | 3 JS/JSX |
| `settings/` | ✅ Exists | 16 JS/JSX — mostly `screens/` |
| `shared-ui/` | ✅ Exists | 16 JS/JSX — theme, layout, liquid glass |
| `shared-utils/` | ✅ Exists | 9 JS/JSX — dates, sanitize, formatting |
| `shared/` | ✅ Exists | 64 JS/JSX — cross-feature API, components, services |
| `assets/` | ✅ Exists (two locations) | See §3 — **both** `assets/` (root) and `src/assets/` |
| `utils/` | ✅ Exists | 10 JS/JSX — logout, error sync, xlsx shims |
| `navigation/` | ✅ Exists | 8 JS/JSX — routes, linking, bottom nav |
| `lib/` | ✅ Exists | 1 file — `sessions.js` |

**Missing from checklist but present and intentional:**

| Folder | Files | Role |
|--------|-------|------|
| `auth/` | 9 | Login, onboarding, password reset (pre-app-entry) |
| `__tests__/` | 57 | Jest unit + integration |

**Legacy folders (removed from disk):** `src/app/`, `src/client/`, `src/trainer/`, `src/ai/`, `src/aiChat/`, `src/shared/daily-metrics/`, `src/shared/messaging/`, `src/shared/notifications/` — ✅ not present on disk.

---

## 2. All top-level `src/` folders — are they needed?

```
__tests__     ✅ Yes — test suite
ai-coach      ✅ Yes — AI coach UI + server client logic
app-start     ✅ Yes — app entry, AuthGate, role shells
assets        ⚠️  Review — duplicates root `assets/` (see §3)
auth          ✅ Yes — login/onboarding before role routing
client-app    ✅ Yes — client role features
lib           ⚠️  Review — only `sessions.js`; candidate to merge into `shared/` or `trainer-app/sessions/`
messaging     ✅ Yes — canonical chat list + thread screens
metrics       ✅ Yes — daily metrics + quotes (extracted from shared)
navigation    ✅ Yes — global routes and nav chrome
notifications ✅ Yes — push token + copy helpers
nutrition     ✅ Yes — food log domain
settings      ✅ Yes — support/legal/settings screens
shared        ✅ Yes — still large; cross-cutting components + services
shared-ui     ✅ Yes — design system / theme
shared-utils  ✅ Yes — pure helpers
trainer-app   ✅ Yes — trainer role features
utils         ⚠️  Review — overlaps `shared-utils/` and `shared/api/`; consider consolidating over time
workouts      ✅ Yes — workout plans + active workout
```

**Also at repo root (not under `src/`):** `assets/` — Expo app icon + splash only (2 files).

---

## 3. Structural issues (report only)

### 🔴 Broken import paths in `app-start/` — **FIXED** (2026-06-21)

Resolved in commits after audit: `ClientApp.js` and `TrainerApp.js` now import from `../ai-coach/chat-ui/` and `../ai-coach/server-logic/`.

### 🔴 Profile screen filename mismatch — **FIXED** (2026-06-21)

Overlay navigators import from `client-app/profile/ViewMyProfileScreen.jsx` (default export is `ViewMyViewMyProfileScreen`). Component rename to `ViewMyProfileScreen` remains optional cleanup.

### 🔴 Password reset shim — **FIXED** (2026-06-21)

`auth/ResetPasswordScreen.jsx` re-export pointed at non-existent `ForgotPasswordFlowFlow`; corrected to `ForgotPasswordFlow.js`.

---

### ~~Broken import paths in `app-start/` (runtime risk)~~

<details>
<summary>Original finding (superseded)</summary>

These paths assume `src/chat-ui/` and `src/server-logic/` exist at the **top level of `src/`**. They do not — they live under `src/ai-coach/`.

| File | Broken import | Should likely be |
|------|---------------|------------------|
| `app-start/ClientApp.js` | `../chat-ui/chat-home/StartCoachChatScreen` | `../ai-coach/chat-ui/chat-home/StartCoachChatScreen` |
| `app-start/ClientApp.js` | `../chat-ui/chat-thread/ChatWithCoachScreen` | `../ai-coach/chat-ui/chat-thread/ChatWithCoachScreen` |
| `app-start/TrainerApp.js` | `../chat-ui/voice/VoiceCoachScreen` | `../ai-coach/chat-ui/voice/VoiceCoachScreen` |
| `app-start/TrainerApp.js` | `../chat-ui/chat-thread/ChatWithCoachScreen` | `../ai-coach/chat-ui/chat-thread/ChatWithCoachScreen` |
| `app-start/TrainerApp.js` | `../server-logic/trainer-messaging/...` | `../ai-coach/server-logic/trainer-messaging/...` |
| `app-start/TrainerApp.js` | `../server-logic/chat-api/...` | `../ai-coach/server-logic/chat-api/...` |
| `app-start/TrainerApp.js` | `../server-logic/services/...` | `../ai-coach/server-logic/services/...` |

</details>

### ~~Profile screen filename mismatch~~

<details>
<summary>Original finding (superseded)</summary>

- **File on disk:** `client-app/profile/ViewMyProfileScreen.jsx`
- **Imported as:** `../client-app/profile/ViewMyViewMyProfileScreen` (in ClientApp, TrainerApp, overlay navigators)

</details>

### 🟡 Duplicate asset roots

| Location | Contents |
|----------|----------|
| `/assets/` | `icon.png`, `splash.png` (Expo config) |
| `/src/assets/` | Lotties, icons, onboarding art, GIFs, `animations/` |

Not wrong, but confusing. Document which to use for new assets (see `ARCHITECTURE.md`).

### 🟡 Messaging — three layers

| Location | Role |
|----------|------|
| `src/messaging/` | **Canonical** — `MyMessagesScreen.jsx`, `ChatThreadScreen.jsx` |
| `src/client-app/messaging/` | Re-export shims → `client-app/screens/` |
| `src/trainer-app/messaging/` | Re-export shims → trainer screens |

Pattern is intentional (backward-compatible import paths) but adds indirection. Consider documenting the canonical import path as `messaging/`.

### 🟡 `shared/screens/` barrel re-exports

Three files re-export from feature subfolders:

- `shared/screens/BrowseSavedWorkoutsScreen.jsx` → `shared/workout-plans/`
- `shared/screens/ViewWeekProgressReportScreen.jsx` → `shared/weekly-report/`
- `shared/screens/MyProgressPhotosScreen.jsx` → `shared/photo-gallery/`

`client-app/screens/*` and `trainer-app/screens/*` often re-export from `shared/screens/`. **Not duplicates** — barrel chain. Could be simplified in a future cleanup pass.

### 🟡 `StartCoachChatScreen` — two paths, one real screen

| Path | Size | Role |
|------|------|------|
| `ai-coach/chat-ui/screens/StartCoachChatScreen.jsx` | ~1761 lines | **Implementation** |
| `ai-coach/chat-ui/chat-home/StartCoachChatScreen.jsx` | 11 lines | Re-export shim |

Not a duplicate — intentional alias. Navigation imports `chat-home/` path.

### 🟡 Naming typos carried into exports

Examples found during rename (cosmetic but confusing):

- `ViewMyViewMyProfileScreen` (double “ViewMy”)
- `EditViewMyViewMyProfileScreen` in settings
- `ViewMyViewMyViewMyProfileScreen` mentioned in stale `CODEBASE_GUIDE.md` catalog lines

### 🟡 Thin / orphan candidates (keep until user confirms)

| Item | Notes |
|------|-------|
| `src/lib/sessions.js` | Single file at top level — unclear why not under `trainer-app/sessions/` |
| `src/utils/` vs `src/shared-utils/` | Split is workable but boundaries are fuzzy (`logError` vs `autoLogError`) |
| `src/CODEBASE_GUIDE.md` | Duplicate/stale copy inside `src/` — root `CODEBASE_GUIDE.md` is the maintained guide |

---

## 4. Feature subfolder checklist

Legend: ✓ = present · — = not expected · ⚠️ = missing but logic lives elsewhere · ○ = optional gap

### Role apps

| Area | screens | components | services | hooks | Notes |
|------|---------|------------|----------|-------|-------|
| **client-app** | ✓ | ✓ | — | ✓ | Also has `home/`, `navigation/`, `dashboard/`, feature subdirs |
| **trainer-app** | ✓ | ✓ | — | ✓ | No top-level `lib/`; CRM in `crm/` |
| **app-start** | — | — | — | — | OK — shell only, not a feature domain |

### Feature domains

| Area | screens | components | services | hooks | Notes |
|------|---------|------------|----------|-------|-------|
| **ai-coach** | ⚠️ | ⚠️ | ⚠️ | — | Uses `chat-ui/screens`, `chat-ui/components`, `server-logic/services` instead of flat names — **by design** |
| **nutrition** | ✓ | ✓ | — | — | Logic in `food-search/`, `daily-log/`, `utils/` |
| **workouts** | ✓ | ✓ | — | — | Logic in `active-workout/`, `plan-builder/` |
| **metrics** | — | — | — | — | OK — data modules in `daily-metrics/`, `daily-quotes/` |
| **messaging** | — | — | ⚠️ | — | Screens at folder root; Firestore logic in `ai-coach/server-logic/trainer-messaging/` |
| **notifications** | — | — | — | — | OK — 3 service modules at root |
| **settings** | ✓ | — | — | — | OK |
| **auth** | ○ | — | ✓ | — | Screens at auth root (Login, Onboarding) — fine for small module |

### Shared layers

| Area | screens | components | services | hooks | Notes |
|------|---------|------------|----------|-------|-------|
| **shared** | ✓ | ✓ | ✓ | ✓ | Still contains feature-ish subdirs (`photo-gallery`, `workout-plans`) — migration in progress |
| **shared-ui** | — | ⚠️ | — | — | Components live at root + `layout/`, `liquid/` — no `components/` subfolder |
| **shared-utils** | — | — | — | — | OK — flat pure helpers |
| **navigation** | — | — | — | — | OK — infra only |
| **utils** | — | — | — | — | OK — app-wide utilities |

---

## 5. Test status at audit time

- **Jest:** 55/55 suites passing, 440 tests (imports under test coverage are fixed)
- **Not covered by Jest:** `app-start/ClientApp.js`, `app-start/TrainerApp.js` import paths listed in §3

---

## 6. Recommended next steps (awaiting approval)

Per execution plan — **no changes made automatically**.

| Priority | Item | Action type |
|----------|------|-------------|
| P0 | Fix `app-start/*` `chat-ui` / `server-logic` imports | Import fix |
| P0 | Fix `ViewMyViewMyProfileScreen` import path → `ViewMyProfileScreen.jsx` | Import fix (+ optional rename cleanup) |
| P1 | Confirm Expo smoke test (client home → AI coach, trainer messaging) | Manual QA |
| P2 | Consolidate `utils/` vs `shared-utils/` | Structural (optional) |
| P2 | Move `lib/sessions.js` into `trainer-app/sessions/` | Move (optional) |
| P3 | Remove `src/CODEBASE_GUIDE.md` duplicate | Docs cleanup |
| P3 | Standardize profile component naming (`ViewMyProfileScreen`) | Rename (optional) |

---

**Review this report?** Reply with which sections to approve for Step 2 (Y/N per section).
