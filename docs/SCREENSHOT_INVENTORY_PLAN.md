# Screenshot inventory plan

Reference for which screens/states to capture. Paths are repo-rooted.

---

## 1. LoginGate flow

**Router:** `src/app-start/LoginGate.js`

| Gate state | Screen | Path |
|---|---|---|
| Signed out + `authLoading` | blank boot `View` | `LoginGate.js` (`bootBlankScreen`) |
| Signed out + `showForgotPasswordFlow` | `ResetPasswordScreen` | `src/login-and-signup/ForgotPasswordFlow.js` |
| Signed out | `LoginScreen` | `src/login-and-signup/LoginScreen.js` |
| Signed in + `showOnboarding` | `NewUserSetupScreen` (inside `ProPlanSetup`) | `src/login-and-signup/NewUserSetupScreen.jsx` |
| Signed in trainer | `TrainerAppStart` | `src/app-start/TrainerAppStart.js` |
| Signed in client | `ClientAppStart` | `src/app-start/ClientAppStart.js` |

### LoginScreen modes (`currentView`)

**File:** `src/login-and-signup/LoginScreen.js`  
**State:** `currentView`: `'welcome' | 'signup' | 'login'`  
**Role:** `role` (`'client' | 'trainer'`) via `RoleToggle` on signup + login forms

| Mode | How shown | Capture notes |
|---|---|---|
| `welcome` | `renderWelcomeView()` | Get Started → signup; Sign In → login |
| `signup` | `renderSignupViewLiquid()` | Role toggle + form + Google/Apple |
| `login` | `renderLoginViewLiquid()` | Role toggle + form + Forgot password → gate |
| Role toggle | `RoleToggle` | Client / Trainer on signup and login (not welcome) |

### ForgotPasswordFlow steps

**File:** `src/login-and-signup/ForgotPasswordFlow.js` (export: `ResetPasswordScreen`)  
**Not a multi-step wizard** — one screen, three UI states:

1. **Form** — email input + “Send reset link”
2. **Submitting** — CTA shows `ActivityIndicator`
3. **Error** — `errorMessage` text under field
4. **Success** — `successMessage`: “Check your inbox for a reset link.”

Opened from LoginGate when `showForgotPasswordFlow` is true (login “Forgot password” → `onForgotPasswordFlowPress`).

### NewUserSetupScreen steps

**File:** `src/login-and-signup/NewUserSetupScreen.jsx`  
**Totals:** client `9`, trainer `8`  
**Capture list:** `src/login-and-signup/setupScreenshotList.json`

#### Client (steps 1–9)

| # | Title | Primary UI / component |
|---|---|---|
| 1 | Tell us about yourself | Inline: `OnboardingInputRow` (weight/height/age) + `SelectionCard` (gender) |
| 2 | What's your fitness experience? | Inline: `SelectionCard` (beginner/intermediate/advanced) |
| 3 | What's your main goal? | Inline: multi-select `SelectionCard` (`goals`) |
| 4 | What equipment do you have access to? | Inline: grid `SelectionCard` + training environment cards |
| 5 | How many days per week can you train? | `OnboardingDayPicker` + preferred time `SelectionCard`s |
| 6 | Any injuries or limitations? | `OnboardingTextArea` + `DislikedExercisesPicker` (`src/workouts/exercise-videos/DislikedExercisesPicker.jsx`) |
| 7 | Do you have a trainer? | `TrainerCodeStep` (local in `NewUserSetupScreen.jsx`) |
| 8 | Describe Your Situation | Inline chips + required `OnboardingTextArea` (`situationDescription`) |
| 9 | AI-Powered Features | `AIPermissionStep` — `src/for-both/setup-steps/AIPermissionStep.jsx` |

Shared step chrome pieces: `src/for-both/setup-steps/setupStepPieces.jsx`

#### Trainer (steps 1–8)

| # | Title | Primary UI / component |
|---|---|---|
| 1 | What certifications do you have? | Inline: `SelectionCard`s + cert upload |
| 2 | How long have you been training clients? | Inline: `SelectionCard` (`yearsExperience`) |
| 3 | What are your specialties? | `OnboardingMultiSelectPills` |
| 4 | Describe your training philosophy | `OnboardingTextArea` |
| 5 | Availability & session format | Inline: availability + session-type `SelectionCard`s |
| 6 | Almost done! | Profile fields + face verification camera |
| 7 | Your client invite code | Inline invite-code card (copy/share) |
| 8 | Coach Connect Pro | `TrainerProOfferStep` — `src/for-both/setup-steps/TrainerProOfferStep.jsx` |

---

## 2. ClientMainScreen tabs & overlays

**Shell:** `src/client-app/navigation/ClientMainScreen.jsx`  
**State hook:** `src/client-app/navigation/goToClientScreen.js`  
**Tab keys:** `CLIENT_MAIN_TABS` in `goToClientScreen.js`

### Bottom-nav tab keys → component

| Tab key | Component shown |
|---|---|
| `'home'` | Home feed (`ScrollView` with `HomeTopBanner`, stats, `NutritionCard`, `FilesHeaderCard`, …) |
| `'nutrition'` | `DailyLogContent` — `src/nutrition/daily-log/DailyLogContent.jsx` |
| `'workout'` | `CreateWorkoutPlanScreen` — `src/workouts/create-plan/CreateWorkoutPlanScreen` (kept mounted when generating) |
| `'ai'` | `CoachHomeScreen` or `CoachConversationScreen` (when `aiChatState` is a session payload) |

Priority: boolean overlays render **before** tab content (inbox/chat/dashboard/files win over tabs).

### Boolean overlays (how to open)

| Flag (shell) | Component | How to open |
|---|---|---|
| `showTrainerMessaging` | `ChatWithTrainerScreen` (`src/messaging/ChatScreen`) | Select conversation from inbox (`handleSelectConversation`) |
| `showConversationsList` | `InboxScreen` (`src/messaging/InboxScreen`) | `handleOpenConversations` — bottom Messages / dashboard message / `onNavigate('messages')` |
| `showMyDashboard` | `TrainingHomeScreen` (`src/client-app/home/TrainingHomeScreen.jsx`) under “Dashboard” header | `setShowMyDashboard(true)` — home `TopBannerCard`, stats rows, or `openMyDashboardBilling` |
| `showNotesFiles` (alias of `showFilesScreen`) | `FilesSection` under “Notes & Files” header | `setShowNotesFiles(true)` — home `FilesHeaderCard` |

Related popups (not full overlays): `showAddFilePopup`, `showTrainerSharedFilesPopup`, `showRemoveTrainerPopup`, `showReviewSheetForPrompt`, `showCoachingPaymentModal`.

---

## 3. TrainerMainScreen

**Shell:** `src/trainer-app/navigation/TrainerMainScreen.jsx`  
**Flags:** `useTrainerAppStartShell` / `goToTrainerScreen.js` (`src/trainer-app/navigation/goToTrainerScreen.js`)

### Hub flags → screen

| Flag | Component | Path |
|---|---|---|
| *(all hub flags false)* | `DashboardContent` (`TrainerHomeContent`) | `src/trainer-app/home/TrainerHomeContent.jsx` |
| `showTrainerMessaging` | `ChatWithTraineeScreen` | `src/messaging/ChatScreen` |
| `showConversationsList` | `InboxScreen` | `src/messaging/InboxScreen` |
| `showClientRequests` | `NewTraineeRequestsScreen` | `src/trainer-app/new-requests/NewTraineeRequestsScreen` |
| `showClientsList` | `ClientsListScreen` (`MyTraineesScreen`) | `src/trainer-app/my-trainees/MyTraineesScreen` |
| `showPhotoGallery` | `MyProgressPhotosScreen` | `src/for-both/photo-gallery/MyProgressPhotosScreen.jsx` |
| `showAIWorkouts` | `SavedWorkoutsScreen` | `src/for-both/workout-plans/SavedWorkoutsScreen` |
| `showWorkoutGenerator` | `CreateWorkoutPlanScreen` (generate) | `src/workouts/create-plan/CreateWorkoutPlanScreen` |
| `showPlanViewer` | `CreateWorkoutPlanScreen` (read-only) | same |
| `showAddFilePopup` | `AddFilePopup` | `src/for-both/files-and-notes/viewers/AddFilePopup.js` |

### Home TabPills names

**Defined in:** `src/trainer-app/home/trainerHomePieces.jsx` (`TABS` / `TabPills`)  
**Used in:** `TrainerHomeContent.jsx` (default `activeTab = 'Progress'`)

Exact names:

1. `Progress`
2. `Nutrition`
3. `Sessions`
4. `Notes & Files`

(Same `TabPills` also used in `ManageTraineeScreen.jsx`.)

### ProExpired / FreeTrialBanner

| UI | Path | When it appears |
|---|---|---|
| `ProAccessCheck` wrapper | `src/trainer-pro-plan/ProAccessCheck.jsx` | Wraps entire trainer shell. On iOS with platform subscription enabled: loading spinner while Firestore loads; if `accessState.access === 'expired'` → replaces children with `ProExpiredScreen` |
| `ProExpiredScreen` | `src/trainer-pro-plan/ProExpiredScreen.jsx` | Only via `ProAccessCheck` when access is `'expired'` (bypass on non-iOS / kill switch off) |
| `FreeTrialBanner` | `src/trainer-pro-plan/FreeTrialBanner.jsx` | Rendered above shell content; visible when `accessState.access === 'free_trial'` (countdown from `trialEndsAt`); otherwise returns `null` |

---

## 4. Nutrition `DailyLogContent`

**File:** `src/nutrition/daily-log/DailyLogContent.jsx`  
**Child log UI:** `src/nutrition/daily-log/DailyFoodLogScreen.jsx`, meal empty copy in `src/nutrition/daily-log/MealCard.js`

| Concern | Supported? | Notes |
|---|---|---|
| Empty state UI | **Yes** | Per-meal “No items logged” (`MealCard`); day-level “Fuel Your Progress” empty actions in `DailyFoodLogScreen` when meal empty |
| Loading spinner | **Yes** | Full-screen pink `ActivityIndicator` while `loading === true` |
| Error UI | **No dedicated UI** | `recordError` / `setLogError` set on add-food failure; value is **not rendered** in JSX |
| Photo on food log entries | **No** | Neither payload builder nor confirm sheet includes a photo field |

### Food log field names

**`buildFoodLogPayload`** (`src/nutrition/daily-log/saveLoggedFood.js`):

`user_id`, `date`, `meal_type`, `food_name`, `brand`, `serving_size`, `serving_grams`, `calories`, `protein`, `carbs`, `fat`, `fiber`, `sugar`, `sodium`, `potassium`, `originalUnit`, `originalAmount`, `loggedUnit`, `loggedAmount`, `preferredUnit`, `metadata`, `created_at`  
→ **no `notes`, no `photo`**

**`buildConfirmedFoodPayload`** (`src/nutrition/food-search/ConfirmFoodPopup.jsx`):

spreads `nutritionBase` plus: `calories`, `protein`, `carbs`, `fat`, `servingGrams`, `servingAmount`, `servingSize`, `dataBasis`, `loggedAmount`, `loggedUnit`, `preferredUnit`, `originalUnit`, `originalAmount`, `labelServingGrams`, `serving_label`, `userVerified`, **`notes`**, `userEditedNutrition`, `scannedBarcode`  
→ **`notes` present (optional)**; **no `photo` / image field**

---

## 5. BarcodeScannerScreen — native only?

**File:** `src/nutrition/barcode/BarcodeScannerScreen.js`

- Uses `expo-camera` `CameraView` + `useCameraPermissions` — camera path is **native**.
- **No** `Platform.OS === 'web'` early-return in this file.
- Includes **typed UPC / manual entry** and miss-state search fallbacks (usable without a live scan).
- Opened from `DailyLogContent` (`showBarcodeScanner`) and client meals flow (`LogTodaysMealsScreen`).

**Inventory takeaway:** treat camera scan UI as native (iOS/Android) screenshot targets; manual-entry / miss states can still be captured without a successful camera frame.

---

## 6. Existing `captureOnboardingSnapshots.mjs` approach

**Script:** `scripts/captureOnboardingSnapshots.mjs` (`npm run snapshot:onboarding`)  
**In-app runner:** `src/login-and-signup/SetupScreenshotTool.jsx`  
**Manifest:** `src/login-and-signup/setupScreenshotList.json` (9 client + 8 trainer)  
**Output:** `docs/onboarding-snapshots/*.png` + `index.html`

How it works (brief):

1. Node HTTP server listens on `127.0.0.1:9876`.
2. Reloads Metro so the app can enter the capture runner (deep link `coachconnect://onboarding-snapshots`).
3. `SetupScreenshotTool` walks the JSON list, renders each `NewUserSetupScreen` step in preview, waits ~2.8s, then `POST /snap?file=…`.
4. Server runs `xcrun simctl io booted screenshot` for that filename, builds a gallery when all captures finish.

Prereqs: booted iOS Simulator with the app, Metro running.
