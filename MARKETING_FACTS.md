# Coach Connect — Marketing Facts Audit (code-based, read-only)

Scope: This document audits landing-page claims against the current repository code. Every finding below is backed by evidence (`path:line`) or explicitly marked **NOT FOUND** with what was searched. Anything inferred is tagged **INFERENCE**.

---

## Summary table (landing claims → verdict + evidence)

| Landing claim | Verdict | Evidence (path:line) |
|---|---|---|
| 1) Trainer marketplace / clients can browse and find coaches | **VERIFIED** | `src/client-app/find-a-trainer/BrowseTrainersScreen.jsx:70` ; `src/for-both/home-cards/FindTrainerBanner.jsx:39` ; `src/app-start/ClientAppStart.js:359` ; `server/routes/marketplaceRoutes.js:1` |
| 2) CRM for trainers (client list, statuses, tags, history) | **VERIFIED** | `src/app-start/TrainerAppStart.js:170` ; `src/app-start/TrainerAppStart.js:269` ; `src/app-start/TrainerAppStart.js:468` ; `src/app-start/TrainerAppStart.js:605` ; `src/app-start/TrainerAppStart.js:658` ; `src/app-start/TrainerAppStart.js:746` |
| 3) Plan builder (workout plans, programs, templates) | **VERIFIED** | `src/client-app/navigation/ClientMainScreen.jsx:64` ; `src/workouts/create-plan/CreateWorkoutPlanScreen.js:7` ; `src/workouts/create-plan/saveAndLoadWorkoutPlan.js:7` ; `src/workouts/view-plan/makePlanPdf.js:7` |
| 4) Notes, files, PDFs and spreadsheets | **VERIFIED** | `src/app-start/ClientAppStart.js:149` ; `src/for-both/files-and-notes/saveNotesAndFiles.js:12` ; `src/for-both/files-and-notes/viewers/PdfViewer.js:17` ; `src/for-both/files-and-notes/viewers/SpreadsheetViewer.js:12` |
| 5) In-app payments with Stripe (who pays, what flow) | **VERIFIED** | `src/for-both/payments/PayTrainerPopup.jsx:4` ; `src/for-both/payments/chargeCard.js:4` ; `server/routes/stripePaymentRoutes.js:1` ; `server/routes/stripePaymentRoutes.js:6` ; `server/routes/stripePaymentRoutes.js:120` ; `server/routes/stripePaymentRoutes.js:125` ; `server/routes/stripeConnectRoutes.js:1` |
| 6) Wellness rings | **PARTIAL** | `src/client-app/home/TodayStatsCards.jsx:95` ; `src/client-app/home/homeScreenPieces.jsx:1146` ; **also** “no Apple Health / Google Fit sync” `src/settings/HelpFAQScreen.jsx:152` |
| 7) Week-in-review narratives | **VERIFIED** | `src/trainer-app/weekly-report/WeeklyReportBars.jsx:987` ; “Generated from logged check-ins (no AI)” `src/trainer-app/weekly-report/WeeklyReportBars.jsx:455` |
| 8) Messaging between trainer and client | **VERIFIED** | `src/app-start/ClientAppStart.js:175` ; `src/app-start/TrainerAppStart.js:66` ; `src/messaging/InboxScreen.jsx:180` ; `src/messaging/ChatScreen.jsx:553` |
| 9) Nutrition logging, barcode scanner, macro tracking, data sources, “consensus” logic | **VERIFIED** | Client nutrition log + barcode: `src/client-app/meals/LogTodaysMealsScreen.jsx:38` ; Server multi-source consensus endpoint: `server/routes/nutritionSearchRoutes.js:1` ; Consensus algorithm: `server/lib/nutritionMultiSourceSearch/getFoodNutritionConsensus.js:1` ; Wired consensus sources: `server/lib/nutritionMultiSourceSearch/scrapers/index.js:9` ; Barcode sources: `server/lib/resolveBarcodeLookup.js:2` |
| 10) Workout history, PRs, progress photos | **PARTIAL** | Workout history fetch: `src/workouts/create-plan/saveAndLoadWorkoutPlan.js:386` ; Progress photos screen: `src/for-both/photo-gallery/MyProgressPhotosScreen.jsx:641` ; PR tracking **NOT FOUND** (searched `one rep max`, `oneRepMax`, `personalRecords`, `1RM`, `pr_history` in `src/`) |
| 11) AI Coach (tools/actions + confirmations, models, limits) | **VERIFIED** | Confirmed tool modal mapping: `src/ai-coach/conversation/ConfirmActionPopup.jsx:45-100` ; Server tool executor: `server/lib/coachTools/executeTool.js:10` ; LLM providers/models: `server/lib/llm/coachLlmProviders.js:27` , `:60` , `:93` ; Vision model: `server/lib/coachVision.js:48` ; Daily cap logic: `server/lib/aiCoachRateLimit.js:4-14` |
| 12) Unlimited clients for trainers (any cap or paywall?) | **PARTIAL** | Marketing copy in Pro benefits: `src/trainer-pro-plan/proPlanSwitches.js:34` ; Roster fetch is capped at 300: `src/trainer-app/trainee-records/traineeDatabaseLocations.js:146` |
| 13) Clients use the app free (any client feature gated/paid?) | **PARTIAL** | No client IAP purchase code found (searched `expo-iap`, `requestPurchase`, `restorePurchases` under `src/client-app/`; none found). Client→trainer card payments exist: `src/for-both/payments/PayTrainerPopup.jsx:4` |
| 14) Dark/light mode | **VERIFIED** | Theme supports `system`/`light`/`dark` + persisted toggle: `src/look-and-feel/lightDarkMode.js:22` , `:50` ; Settings Appearance selector: `src/settings/SettingsScreen.js:256` , `:259` , `:529-537` |

---

## Part 1 — claim-by-claim details (what the user actually sees)

### 1) Trainer marketplace
- **Verdict**: **VERIFIED**
- **Evidence**: Marketplace UI: `src/client-app/find-a-trainer/BrowseTrainersScreen.jsx:70` ; entry banner: `src/for-both/home-cards/FindTrainerBanner.jsx:39` ; navigation handler: `src/app-start/ClientAppStart.js:359` ; server routes exist: `server/routes/marketplaceRoutes.js:1`
- **User sees**: A “Trainer Marketplace” screen where clients can browse trainers (with filters and a profile sheet).

### 2) CRM for trainers (client list, statuses, tags, history)
- **Verdict**: **VERIFIED**
- **Evidence**: Trainer CRM layer is explicitly in the trainer shell: `src/app-start/TrainerAppStart.js:1` and “CLIENT CRM SERVICE”: `src/app-start/TrainerAppStart.js:170`; includes client CRUD: `src/app-start/TrainerAppStart.js:269` and list/history endpoints: `src/app-start/TrainerAppStart.js:468` , `:605` (progress history), `:658` (tasks), `:746` (notes)
- **User sees**: A trainer-facing roster/CRM backed by Firestore (`trainer_clients/...`) with client records plus progress entries, tasks, and notes history surfaces.
- **INFERENCE**: “Tags” are referenced in comments/merge logic, but I did not find a dedicated UI editor for tags in `MyTraineesScreen.jsx` (searched `tag`/`tags` in `src/trainer-app/my-trainees/`; no matches).

### 3) Plan builder (workout plans, programs, templates)
- **Verdict**: **VERIFIED**
- **Evidence**: Client shell can open the plan builder screen: `src/client-app/navigation/ClientMainScreen.jsx:64`; the plan builder is `CreateWorkoutPlanScreen`: `src/workouts/create-plan/CreateWorkoutPlanScreen.js:7`; there are template helpers exported: `src/workouts/create-plan/saveAndLoadWorkoutPlan.js:7`; plan PDF generation exists: `src/workouts/view-plan/makePlanPdf.js:7`
- **User sees**: A guided workout-plan builder/generator flow that produces a structured plan and can render/export a plan PDF inside the app.
- **Limits/unfinished**: Workout plan generation is capped per month (see “Monthly limit reached” UX in `CreateWorkoutPlanScreen` `src/workouts/create-plan/CreateWorkoutPlanScreen.js:2442-2454` and server limit is `3`/month: `server/lib/workoutGenerationLimit.js:3`).

### 4) Notes, files, PDFs and spreadsheets
- **Verdict**: **VERIFIED**
- **Evidence**: Notes & Files service explicitly supports notes/photos/videos/PDFs/spreadsheets: `src/for-both/files-and-notes/saveNotesAndFiles.js:12-13` and uploads to `users/{clientId}/notes_and_files`: `src/for-both/files-and-notes/saveNotesAndFiles.js:149-152`; PDF viewer: `src/for-both/files-and-notes/viewers/PdfViewer.js:17`; spreadsheet viewer: `src/for-both/files-and-notes/viewers/SpreadsheetViewer.js:12`
- **User sees**: A Notes & Files area where a trainer and/or client can upload documents (including PDFs and spreadsheets) and view them in-app.
- **Important nuance**: The AI Coach chat UI itself states document/PDF reading is not wired (photo only): `src/ai-coach/conversation/CoachConversationScreen.jsx:1381`.

### 5) In-app payments with Stripe (who pays, what flow)
- **Verdict**: **VERIFIED**
- **Evidence (client UX)**: Client card form explicitly posts to `/api/charges`: `src/for-both/payments/PayTrainerPopup.jsx:4`; client request helper: `src/for-both/payments/chargeCard.js:4` and it calls `/api/charges`: `src/for-both/payments/chargeCard.js:34`
- **Evidence (server flow)**: Charges are created as Connect **direct charges** on the trainer’s connected account with `application_fee_amount` based on `PLATFORM_FEE_RATE`: `server/routes/stripePaymentRoutes.js:6` , `:120` , `:125-137`
- **Evidence (payout setup)**: Trainer onboarding to Stripe Connect Express exists: `server/routes/stripeConnectRoutes.js:1` (and creates accounts `type: 'express'`: `server/routes/stripeConnectRoutes.js:103-110`)
- **User sees**: Clients can enter a card in-app to pay a linked trainer; trainers must complete Stripe Connect onboarding to receive payouts.

### 6) Wellness rings
- **Verdict**: **PARTIAL**
- **Evidence**: The home UI has ring visuals (SVG “ring” component): `src/client-app/home/TodayStatsCards.jsx:95` and the home copy references “Nutrition Today” rings: `src/client-app/home/homeScreenPieces.jsx:1146`
- **User sees**: Ring-style progress visuals on the home dashboard (notably “Nutrition Today” rings) tied to what the user logs in-app.
- **Not supported / clarify**: The app explicitly says there is **no** Apple Health / Google Fit sync: `src/settings/HelpFAQScreen.jsx:152`. If marketing implies wearable/HealthKit rings, that would be inaccurate.

### 7) Week-in-review narratives
- **Verdict**: **VERIFIED**
- **Evidence**: Weekly report UI uses “week in review” language: `src/trainer-app/weekly-report/WeeklyReportBars.jsx:987` and explicitly labels it as generated from logged check-ins (no AI): `src/trainer-app/weekly-report/WeeklyReportBars.jsx:455`
- **User sees**: A readable weekly recap screen (“week in review”) that summarizes the week from logged check-ins and metrics.
- **Unfinished-looking**: “Weekly digest” exists as a row but has no implementation (it just closes the sheet): `src/for-both/weekly-report/ReportOptionsPopup.jsx:142-150`.

### 8) Messaging between trainer and client
- **Verdict**: **VERIFIED**
- **Evidence**: Messaging screens are imported into both shells: `src/app-start/ClientAppStart.js:175-177`, `src/app-start/TrainerAppStart.js:65-66`; inbox UI exists: `src/messaging/InboxScreen.jsx:180`; chat sends messages: `src/messaging/ChatScreen.jsx:553`; chat supports attachments upload path under `conversations/{conversationId}/attachments/...`: `src/messaging/ChatScreen.jsx:623`
- **User sees**: An in-app inbox and 1:1 chat thread between trainer and client, including attachments.

### 9) Nutrition logging + barcode + macros + sources + “consensus”
- **Verdict**: **VERIFIED**
- **Evidence (client logging)**: Nutrition “Log Today’s Meals” screen exists and totals macros: `src/client-app/meals/LogTodaysMealsScreen.jsx:57` and integrates barcode scanner: `src/client-app/meals/LogTodaysMealsScreen.jsx:38`
- **Evidence (server consensus endpoint)**: `/api/nutrition/search` exists: `server/routes/nutritionSearchRoutes.js:1` and returns `consensus`, `sourceResults`, `sources_used`: `server/routes/nutritionSearchRoutes.js:20-28`
- **Evidence (consensus logic)**: IQR-based consensus filter: `server/lib/nutritionMultiSourceSearch/getFoodNutritionConsensus.js:1` and it returns `sources_used`: `server/lib/nutritionMultiSourceSearch/getFoodNutritionConsensus.js:193`
- **Exactly which nutrition data sources are currently wired**:
  - The active scraper map (`ALL_SCRAPERS`) includes: FatSecret, FastFoodNutrition, CalorieKing, FoodFacto, OpenFoodFacts, Serper, USDA FoodData Central: `server/lib/nutritionMultiSourceSearch/scrapers/index.js:9-16`
  - Display names include those same sources: `server/lib/nutritionMultiSourceSearch/constants.js:20-27`
- **Sources present in repo but not wired into the current consensus map (unfinished/disabled)**:
  - Cronometer scraper exists: `server/lib/nutritionMultiSourceSearch/scrapers/cronometer.js:4`
  - MyFitnessPal scraper exists: `server/lib/nutritionMultiSourceSearch/scrapers/myFitnessPal.js:4`
  - MenuStat scraper exists: `server/lib/nutritionMultiSourceSearch/scrapers/menuStat.js:4`
  - Yazio scraper exists: `server/lib/nutritionMultiSourceSearch/scrapers/yazio.js:4`
  - **But** these are not listed in the active `ALL_SCRAPERS` map: `server/lib/nutritionMultiSourceSearch/scrapers/index.js:9-16`
- **Barcode lookup data sources (server-side)**:
  - Barcode resolution explicitly: “USDA + FatSecret + OFF → merge → Serper → validate”: `server/lib/resolveBarcodeLookup.js:2`
- **Daily caps**:
  - Nutrition search daily cap is 500: `server/lib/nutritionSearchDailyLimit.js:7`
- **User sees**: A nutrition tab where they can log meals and macros, scan barcodes, and (for some queries) see nutrition cards sourced/filtered from multiple online databases.

### 10) Workout history, PRs, progress photos
- **Verdict**: **PARTIAL**
- **Evidence (workout history)**: A function to fetch workout history exists: `src/workouts/create-plan/saveAndLoadWorkoutPlan.js:386`
- **Evidence (progress photos)**: Progress photos screen exists and has an empty state: `src/for-both/photo-gallery/MyProgressPhotosScreen.jsx:641-645`
- **PRs**: **NOT FOUND** as a real feature. Searched `src/` for `one rep max`, `oneRepMax`, `personalRecords`, `1RM`, `pr_history` (no matches).
- **User sees**: Workout history and progress photos exist; “PRs” appear to be copy-level only rather than a dedicated PR tracker.

### 11) AI Coach (tools/actions + confirmations, models, limits)
- **Verdict**: **VERIFIED**

#### Tool-calling actions (server-side tools)
All of these are implemented in the server tool executor and are therefore real “tool actions”:
- **adjustMacroTargets**: updates macro/calorie targets in Firestore: `server/lib/coachTools/executeTool.js:16-74`
- **logNutrition**: logs a meal entry (and may fallback to USDA lookup if calories missing): `server/lib/coachTools/executeTool.js:320-380`
- **logSleep**: logs sleep hours: `server/lib/coachTools/executeTool.js:74-102`
- **logWater**: logs water in ounces: `server/lib/coachTools/executeTool.js:104-129`
- **logSteps**: logs step count: `server/lib/coachTools/executeTool.js:132-158`
- **rateEnergy**: logs an energy rating 1–10: `server/lib/coachTools/executeTool.js:160-194`
- **logMood**: logs mood (limited to: happy/okay/stressed/tired/anxious): `server/lib/coachTools/executeTool.js:196-229`
- **rateWorkout**: logs workout rating, or rest day logic: `server/lib/coachTools/executeTool.js:232-287`
- **logRestDay**: logs rest day: `server/lib/coachTools/executeTool.js:289-315`
- **deleteLog**: deletes a specified log type/date: `server/lib/coachTools/executeTool.js:316-318`
- **bookSession**: creates a pending trainer session request: `server/lib/coachTools/executeTool.js:382-420`
- **updateGoal**: writes `users/{uid}.goal`: `server/lib/coachTools/executeTool.js:422-428`
- **notifyTrainer**: writes an alert to the trainer: `server/lib/coachTools/executeTool.js:430-468`
- **openWorkoutPlan**: fetches and returns a plan payload for the chat to cite: `server/lib/coachTools/executeTool.js:470-493`
- **updateWorkout**: edits an exercise inside a stored plan: `server/lib/coachTools/executeTool.js:496-569`

#### Confirmation modal guardrails (client UI)
The AI Coach chat shows a “Confirm action” UI and opens a dedicated modal with a tool-specific body:
- Tool modal mapping is a `switch(name)` with explicit cases: `src/ai-coach/conversation/ConfirmActionPopup.jsx:45-100`
- **Which modal guards which tool** (by tool name):
  - `updateWorkout` → `EditWorkoutPopup`: `src/ai-coach/conversation/ConfirmActionPopup.jsx:48-52`
  - `adjustMacroTargets` → `ChangeFoodTargetsPopup`: `src/ai-coach/conversation/ConfirmActionPopup.jsx:51-55`
  - `logNutrition` → `LogMealPopup`: `src/ai-coach/conversation/ConfirmActionPopup.jsx:54-57`
  - `logSleep` → `LogSleepPopup`: `src/ai-coach/conversation/ConfirmActionPopup.jsx:57-59`
  - `logWater` → `LogWaterPopup`: `src/ai-coach/conversation/ConfirmActionPopup.jsx:60-62`
  - `logSteps` → `LogStepsPopup`: `src/ai-coach/conversation/ConfirmActionPopup.jsx:63-65`
  - `rateEnergy` → `RateEnergyPopup`: `src/ai-coach/conversation/ConfirmActionPopup.jsx:66-68`
  - `logMood` → `LogMoodPopup`: `src/ai-coach/conversation/ConfirmActionPopup.jsx:69-71`
  - `rateWorkout` → `RateWorkoutPopup`: `src/ai-coach/conversation/ConfirmActionPopup.jsx:72-74`
  - `bookSession` → `BookSessionPopup`: `src/ai-coach/conversation/ConfirmActionPopup.jsx:75-77`
  - `updateGoal` → `UpdateGoalPopup`: `src/ai-coach/conversation/ConfirmActionPopup.jsx:78-80`
  - `notifyTrainer` → `MessageTrainerPopup`: `src/ai-coach/conversation/ConfirmActionPopup.jsx:81-83`
  - `openWorkoutPlan` → `OpenWorkoutPlanPopup`: `src/ai-coach/conversation/ConfirmActionPopup.jsx:84-86`
  - `logRestDay` → `MarkRestDayPopup`: `src/ai-coach/conversation/ConfirmActionPopup.jsx:87-89`
  - `deleteLog` → `ConfirmDeletePopup`: `src/ai-coach/conversation/ConfirmActionPopup.jsx:90-91`

#### Models used (server-side)
- **Perplexity**: `pplx-70b-online`: `server/lib/llm/coachLlmProviders.js:27`
- **DeepSeek chat** (default): `deepseek-chat`: `server/lib/llm/coachLlmProviders.js:60`
- **Claude** (default): `claude-3-5-sonnet-20240620`: `server/lib/llm/coachLlmProviders.js:93`
- **Vision**: OpenAI vision model defaults to `gpt-4o-mini`: `server/lib/coachVision.js:48` (with DeepSeek-VL2 fallbacks mentioned in same file: `server/lib/coachVision.js:416`)

#### Per-user limits/caps (server-side)
- Daily AI Coach message cap resolves to **30 / 50 / 100** depending on user tier fields: `server/lib/aiCoachRateLimit.js:4-14`
- Enforcement is enabled on production Cloud Run by default, with overrides: `server/lib/aiCoachRateLimit.js:16-36`

#### User sees
An in-app AI Coach chat tab that can propose concrete actions (logging metrics, editing plans, messaging trainer, booking sessions) and requires explicit in-app confirmation before applying them.

### 12) “Unlimited clients” for trainers
- **Verdict**: **PARTIAL**
- **Evidence (marketing copy inside app)**: Pro benefits include “Unlimited clients”: `src/trainer-pro-plan/proPlanSwitches.js:34`
- **Evidence (practical cap)**: Roster “all clients” fetch defaults to a cap of 300: `src/trainer-app/trainee-records/traineeDatabaseLocations.js:146` (returns `all.slice(0, maxClients)` in same function body).
- **User sees**: A trainer roster that loads clients in pages; on typical usage it will feel “unlimited,” but the implementation has a 300-client cap unless overridden by code changes.

### 13) Clients use the app free (gating / paid client features)
- **Verdict**: **PARTIAL**
- **Evidence**: No client subscription purchase code found in `src/client-app/` (searched `expo-iap`, `requestPurchase`, `restorePurchases`). Client card payments to trainers exist: `src/for-both/payments/PayTrainerPopup.jsx:4`.
- **User sees**: Clients can use the app without buying an App Store subscription, but can be asked to pay a trainer via in-app card payments.
- **INFERENCE**: Some “coaching relationship” functionality (messaging, sessions, weekly report context) likely depends on being linked to a trainer, but “free vs paid” for clients is not expressed as an IAP paywall in the codebase.

### 14) Dark/light mode
- **Verdict**: **VERIFIED**
- **Evidence**: Theme provider supports `system | light | dark` and persists preference: `src/look-and-feel/lightDarkMode.js:22` , `:50`; Settings UI exposes appearance selection: `src/settings/SettingsScreen.js:256` , `:259` , `:529-537`
- **User sees**: A Settings “Appearance” control allowing Light/Dark (or following device settings).

---

## Part 2 — Money Facts (exact values + flow)

### Stripe Connect platform/application fee (exact)
- **Platform fee percentage**: **10%** (exact `0.1`).
  - Evidence: `server/routes/stripePaymentRoutes.js:6` (`PLATFORM_FEE_RATE = 0.1`)
  - Evidence of usage: `application_fee_amount` computed from it: `server/routes/stripePaymentRoutes.js:116` and passed into charge: `server/routes/stripePaymentRoutes.js:130`
- **Flat fee**: **NOT FOUND**.
  - Searched `server/` for `+ 30`, `0.30`, `flat fee`, `application_fee_amount: .*+` — no matching fee constant/logic beyond %.

### Who bears Stripe processing fees (Connect charge flow)
- **What the code does (fact)**: Creates a charge as a **direct charge on the trainer’s connected account** via `stripe.charges.create(..., { stripeAccount: stripeAccountId })`: `server/routes/stripePaymentRoutes.js:120` and `:125`.
- **Who pays Stripe processing fees**: **INFERENCE: the trainer/connected account** pays Stripe processing fees for direct charges (because the charge is created on the connected account, not as a destination charge from the platform).
- **Important accounting nuance (fact)**: App-side “trainer keeps 90%” math is computed as `amountCents - applicationFeeCents` (10% platform fee only) and does not incorporate Stripe’s processing fee: `server/routes/stripePaymentRoutes.js:185-188`.

### Trainer subscription (exact): price, trial, annual, billing method, gating
- **Billing channel**: **Apple in-app subscriptions (StoreKit) via `expo-iap`**.
  - Evidence: `expo-iap` import: `src/trainer-pro-plan/ProPlanPurchases.jsx:6-10`
  - Evidence: `requestPurchase(..., type: 'subs')`: `src/trainer-pro-plan/ProPlanPurchases.jsx:217-224`
- **Monthly price**: **`$59.99/month`**
  - Evidence: `src/trainer-pro-plan/proPlanSwitches.js:30`
- **Free trial length**: **`3-day free trial`**
  - Evidence: `src/trainer-pro-plan/proPlanSwitches.js:31`
- **Annual offer**: **`$49/month` billed `($588/year)`**
  - Evidence: `src/trainer-pro-plan/proPlanSwitches.js:55-58`
- **Product IDs**:
  - Monthly: `com.coachconnect.month`: `src/trainer-pro-plan/proPlanSwitches.js:16`
  - Annual: `com.coachconnect.year`: `src/trainer-pro-plan/proPlanSwitches.js:21`
- **What the paywall gates (fact)**:
  - The trainer app is only hard-gated when a **prior** subscription is **expired** (not when a trainer has never subscribed): `src/trainer-pro-plan/ProAccessCheck.jsx:8-13` and `:29`
  - Pro benefits advertised in-app include “Unlimited clients”, “AI workout generation”, “Nutrition tracking”, etc: `src/trainer-pro-plan/proPlanSwitches.js:33-39`
- **Potential mismatch (fact)**: The app claims “Unlimited clients” in benefits but client roster fetch is capped at 300 by default: `src/trainer-pro-plan/proPlanSwitches.js:34` vs `src/trainer-app/trainee-records/traineeDatabaseLocations.js:146`.

### Conflicts with marketing phrases provided
Compared against: **“$59.99/mo”, “Annual $49/mo billed $588/yr”, “3-day free trial”, “you keep 90%”**
- **$59.99/mo**: supported (see `src/trainer-pro-plan/proPlanSwitches.js:30`).
- **Annual $49/mo billed $588/yr**: supported (see `src/trainer-pro-plan/proPlanSwitches.js:55-58`).
- **3-day free trial**: supported (trainer Pro trial label: `src/trainer-pro-plan/proPlanSwitches.js:31`).
- **You keep 90%**: supported only in the sense of a **10% platform fee** (application fee) (see `server/routes/stripePaymentRoutes.js:6` and `:130`), but **INFERENCE**: the trainer’s net is less than 90% after Stripe processing fees (direct charge on connected account: `server/routes/stripePaymentRoutes.js:120`).
- **Additional mismatch to watch**: Client marketplace copy references “/month will be charged” and “trial ends” language: `src/client-app/find-a-trainer/ConfirmRequestPopup.jsx:152-156`, while the payment education copy says **client coaching payments are one-time charges**: `src/for-both/payments/howPaymentsWorkText.js:83`.

---

## Part 3 — Strong selling points reachable in code but not usually in landing copy (up to 10)

1) **Push notifications** (device setup + permissions flow exist)
   - Evidence: app config calls notifications setup: `App.js:20` (imports `configureNotifications`)
   - Evidence: notifications dependency present: `package.json:138` (`expo-notifications`)

2) **Trainer session scheduling + client session requests**
   - Evidence: scheduling tabs/screens exist: `src/trainer-app/scheduling/CalendarTab.jsx:43-54`
   - Evidence: AI Coach can create a pending session request: `server/lib/coachTools/executeTool.js:382-420`

3) **Weekly report export to PDF**
   - Evidence: weekly report settings includes “Export PDF”: `src/for-both/weekly-report/ReportOptionsPopup.jsx:130-141`

4) **In-app document editor + spreadsheet editor for trainers**
   - Evidence: document editor exists: `src/trainer-app/documents/DocumentEditor.js:394`
   - Evidence: spreadsheet editor exists (undo history, etc.): `src/trainer-app/documents/SpreadsheetEditor.js:1132`

5) **User safety: block/report**
   - Evidence: blocked users screen: `src/block-and-report/BlockedUsersScreen.jsx:24`
   - Evidence: blocking impacts messaging/inbox filters (module-level docs): `src/block-and-report/blockUser.js:2-3`

6) **Workout generation caps + clear UX**
   - Evidence: server cap is 3 per month: `server/lib/workoutGenerationLimit.js:3`
   - Evidence: client shows “Monthly limit reached”: `src/workouts/create-plan/CreateWorkoutPlanScreen.js:2449-2454`

7) **Trainer payouts via Stripe Connect Express (guided onboarding link)**
   - Evidence: creates Express account: `server/routes/stripeConnectRoutes.js:103-110`
   - Evidence: in-app trainer payout setup popup exists: `src/for-both/payments/TrainerPayoutSetupPopup.jsx:35`

8) **Attachments in chat (images/files)**
   - Evidence: uploads to `conversations/.../attachments/`: `src/messaging/ChatScreen.jsx:623-654`

9) **Progress photos**
   - Evidence: progress photo screen exists: `src/for-both/photo-gallery/MyProgressPhotosScreen.jsx:270` and empty state: `:641`

10) **“No Apple Health / Google Fit sync” transparency**
   - Evidence: explicit FAQ statement: `src/settings/HelpFAQScreen.jsx:152` (this is a trust-building positioning point if framed correctly).

---

## Part 4 — Market positioning (code-based)

### Who is each side for? (**INFERENCE**)
- **Trainer side**: Independent coaches/trainers managing a roster, sharing plans/docs, scheduling sessions, messaging, viewing weekly reports. (Evidence surface: `src/app-start/TrainerAppStart.js:170`; weekly report trainer entry points: `src/trainer-app/weekly-report/TrainerWeeklyReportSection.jsx:31-33`.)
- **Client side**: Individuals following a trainer’s plan, logging nutrition and daily metrics, chatting with their trainer, viewing weekly recaps. (Evidence surface: nutrition logging: `src/client-app/meals/LogTodaysMealsScreen.jsx:57`; messaging: `src/messaging/InboxScreen.jsx:180`.)

### Core job statements (based only on VERIFIED items)
- **Trainer core job**: Keep a client roster organized and deliver coaching through plans, chat, and weekly progress summaries (CRM + messaging + weekly report + plan builder).
- **Client core job**: Follow a plan and log progress (nutrition + daily metrics + workouts + photos) while staying connected to a trainer via in-app chat.

### 5 strongest differentiators (must be backed by VERIFIED findings)
1) **Marketplace built into the client app** (discover/browse trainers): `src/client-app/find-a-trainer/BrowseTrainersScreen.jsx:70`
2) **Trainer CRM service with tasks/notes/progress history subcollections**: `src/app-start/TrainerAppStart.js:170`, `:605`, `:658`, `:746`
3) **Weekly “week in review” screen generated from check-ins (no AI)**: `src/trainer-app/weekly-report/WeeklyReportBars.jsx:455`, `:987`
4) **Notes & Files includes PDFs + spreadsheet viewing**: `src/for-both/files-and-notes/viewers/PdfViewer.js:17`, `src/for-both/files-and-notes/viewers/SpreadsheetViewer.js:12`
5) **AI Coach can propose and execute logged actions with explicit confirmation modals**: `src/ai-coach/conversation/ConfirmActionPopup.jsx:45-100` and server tool executor `server/lib/coachTools/executeTool.js:10`

### Weakest / missing vs typical coaching apps (honest)
- **No wearable health sync** (explicitly stated): `src/settings/HelpFAQScreen.jsx:152`
- **“Unlimited clients” is not literally true in code** (default roster cap 300): `src/trainer-app/trainee-records/traineeDatabaseLocations.js:146`
- **Some planned features look stubbed** (weekly digest row has no action): `src/for-both/weekly-report/ReportOptionsPopup.jsx:142-150`
- **PR tracking** is not implemented as a real feature (see Claim 10).

### Claims the landing page should NOT make yet (and why)
- **“Wearable/HealthKit rings”**: Not supported; explicitly “no Apple Health / Google Fit sync”: `src/settings/HelpFAQScreen.jsx:152`
- **“Unlimited clients” (literal)**: implementation caps roster fetch at 300: `src/trainer-app/trainee-records/traineeDatabaseLocations.js:146`
- **“Monthly auto-billing for coaching”**: Client UI copy references “/month will be charged” but server payment education says one-time charges; recurring billing is not evident in Stripe routes: `src/client-app/find-a-trainer/ConfirmRequestPopup.jsx:152-156` vs `src/for-both/payments/howPaymentsWorkText.js:83` and charge endpoint is a single POST: `server/routes/stripePaymentRoutes.js:32`
- **“Tracks PRs”**: Not found as a real feature (see Claim 10).

### Recommended hero headline + support line (VERIFIED-only)
- **Hero (VERIFIED-only)**: “Find a trainer. Follow your plan. Track nutrition and progress — all in one app.”
- **Support line (VERIFIED-only)**: “Coach Connect includes a built-in trainer marketplace, in-app messaging, workout plan builder with PDF viewing, nutrition + barcode logging with macro tracking, and weekly ‘week in review’ summaries from your check-ins.”

---

## Open questions for the owner (to de-risk landing claims)

1) Should client/trainer coaching payments be marketed as **one-time** or **recurring monthly**? The client marketplace UI copy suggests monthly billing (`src/client-app/find-a-trainer/ConfirmRequestPopup.jsx:152-156`) but the payment education copy says one-time charges (`src/for-both/payments/howPaymentsWorkText.js:83`).
2) Is “Unlimited clients” intended to be literal? Current code caps roster fetch at 300 by default (`src/trainer-app/trainee-records/traineeDatabaseLocations.js:146`).
3) Which AI model(s) should marketing name, if any? The server uses multiple providers/models (`server/lib/llm/coachLlmProviders.js:27`, `:60`, `:93`; vision `server/lib/coachVision.js:48`).
4) Should “weekly digest” be marketed? The UI affordance exists but appears unimplemented (`src/for-both/weekly-report/ReportOptionsPopup.jsx:142-150`).
5) Do we want to market “multi-source nutrition consensus” as 7 sources (currently wired) or broader? Extra scrapers exist but are not wired (e.g. Cronometer/MyFitnessPal/MenuStat/Yazio).

