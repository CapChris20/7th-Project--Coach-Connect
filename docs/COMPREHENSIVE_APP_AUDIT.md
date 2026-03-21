# CoachConnect AI - Comprehensive App Audit

**Generated:** February 2025  
**Last Updated:** February 2025 (fixes applied)  
**Purpose:** Identify all issues, dead code, Firebase errors, API gaps, and action items to make the app production-ready.

---

## 1. DEAD / UNUSED FILES

### Auth
| File | Status | Action Taken |
|------|--------|--------------|
| `src/auth/LoginScreen.js` | Replaced by AuthScreen | Moved to `archive/` |
| `src/auth/SignupScreen.js` | Replaced by AuthScreen | Moved to `archive/` |
| `src/auth/RoleSelectionScreen.js` | Replaced by AuthScreen | Moved to `archive/` |
| `src/auth/WelcomeScreen.js` | **Now in use** | Wired into AuthScreen as first view (Lottie welcome-robot) |

### Duplicate / Unused Screens
| File | Status | Action Taken |
|------|--------|--------------|
| `src/voice/screens/VoiceCoachHomeScreen.js` | Never imported | Moved to `archive/` |
| `src/voice/components/voiceService.js` | Empty file | Deleted |
| `src/shared/ui/FluidGlass.examples.jsx` | Examples only | Kept (no linter errors) |
| `CoachConnectScreens.jsx` (root) | Orphaned | Moved to `archive/` |
| `TrainerUi.jsx` (root) | Orphaned | Moved to `archive/` |
| `Ui.jsx` (root) | Orphaned | Moved to `archive/` |

---

## 2. DUPLICATE IMPLEMENTATIONS

### TrainerSearchScreen
| Path | Status |
|------|--------|
| `src/ai/screens/TrainerSearchScreen.js` | **Primary** – used by both ClientApp and TrainerApp |
| `src/trainer/screens/TrainerSearchScreen.js` | Re-exports from ai module |

**Action Taken:** Trainer version now re-exports ai version. Single source of truth.

---

## 3. BROKEN / INCOMPLETE CODE

### useTrainerClients.js
- **Status:** Fixed
- **Change:** Removed broken `firestore()` usage. Removed dead hooks (`useClientWorkouts`, `useMessages`, `useTrainerNotifications`). Kept only `useTrainerClients` with `clients`, `loading`, `error`, `refresh` using `getTrainerClients` from clientCRMService (Firebase JS SDK).

### Firestore Rules
- **Status:** Documented
- **Note:** Top-level `messages/{messageId}` uses `senderId` (trainerMessaging.js). Nested `messages/{combinedUid}/messages/{messageId}` uses `senderUid`. Both paths supported.

### trainerMessaging.js – Two message systems
- **Status:** Documented, no change
- **Note:** trainerMessaging writes to top-level `messages`. Find Trainer flow writes to nested `messages/{trainerUid}_{clientUid}/messages`. Both coexist; rules support both.

---

## 4. FIREBASE CONFIGURATION

### Current Setup
- Uses Firebase JS SDK (`firebase` v10+)
- Auth with AsyncStorage persistence
- Firestore, Storage initialized
- Config from `process.env.EXPO_PUBLIC_*`

### Fixes Applied
- Removed `@react-native-firebase/app` and `@react-native-firebase/firestore` from package.json
- Removed `@react-native-firebase/app` from app.json plugins

### Known Issues
- **"Firebase not available"** – Ensure `.env` has all `EXPO_PUBLIC_FIREBASE_*` vars. Restart with `npx expo start --clear`.
- **Firestore index:** Deploy with `firebase deploy --only firestore:indexes` if needed.

---

## 5. API KEYS & ENVIRONMENT

### Required .env Variables
| Variable | Used By | Required |
|----------|---------|----------|
| `EXPO_PUBLIC_FIREBASE_*` | config.js | Yes |
| `EXPO_PUBLIC_OPENAI_API_KEY` | apiKeyService, openai, chatService | For AI chat |
| `EXPO_PUBLIC_CLAUDE_API_KEY` or `EXPO_PUBLIC_API_CLADE_URL` | claudeWorkoutService, WorkoutPlanGenerator | For workout generation |
| `EXPO_PUBLIC_API_BASE_URL` | askServer, webSearch | For web deployment / server proxy |

### docs/env.example
- Updated with `EXPO_PUBLIC_CLAUDE_API_KEY`, `EXPO_PUBLIC_API_CLADE_URL`

---

## 6. TYPESCRIPT / LINTER ERRORS

| File | Status |
|------|--------|
| `MealPlanGeneratorScreen.js` | Fixed (indentation) |
| `FluidGlass.examples.jsx` | No linter errors |

---

## 7. DEPRECATED / WARNINGS

- **expo-av Video:** Deprecated in favor of `expo-video`. See SplashScreen.
- **expo-notifications:** Will be removed from Expo Go in SDK 53. Use development build.
- **BarCodeScanner:** Not available in Expo Go - manual entry fallback.

---

## 8. SECURITY / BEST PRACTICES

- API keys in `process.env` - OK for client (Expo bundles them). For production, consider server proxy for sensitive keys.
- Firestore rules: Generally well-structured.
- No hardcoded secrets found in codebase.

---

## 9. SUMMARY OF FIXES APPLIED

| Item | Action |
|------|--------|
| useTrainerClients firestore() | Removed broken code; kept working `getTrainerClients` flow |
| WelcomeScreen | Wired into AuthScreen as first view |
| Dead auth files | LoginScreen, SignupScreen, RoleSelectionScreen → `archive/` |
| voiceService.js (empty) | Deleted |
| TrainerSearchScreen | Consolidated – trainer re-exports from ai |
| Firestore rules | Added comment for top-level messages |
| Orphaned root files | CoachConnectScreens, TrainerUi, Ui → `archive/` |
| @react-native-firebase | Removed from package.json and app.json |
| VoiceCoachHomeScreen | Moved to `archive/` |

---

## 10. QUICK FIXES SUMMARY

```bash
# 1. Ensure .env has all vars (see docs/env.example)
# 2. Deploy Firestore indexes
firebase deploy --only firestore:indexes

# 3. Clear cache and restart
npx expo start --clear

# 4. After removing @react-native-firebase, run:
npm install
```

---

## 11. FILE STRUCTURE HEALTH

- **Auth:** AuthScreen with WelcomeScreen as first view. Old screens in `archive/`.
- **Trainer/Client:** Clear separation. TrainerSearchScreen consolidated.
- **Messages:** Two paths – both supported by Firestore rules.
- **Archive:** `archive/` contains LoginScreen, SignupScreen, RoleSelectionScreen, CoachConnectScreens, TrainerUi, Ui, VoiceCoachHomeScreen.

---

*Audit fixes completed. Run `npm install` after package changes.*
