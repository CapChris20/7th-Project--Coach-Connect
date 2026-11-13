# Design Law implementation checklist

Living status of the PNG-first redesign. Source of truth for visuals is still `screens/<flow>/*.png`, then `DESIGN-SYSTEM.md`, then `mockups/*.html`, then `MAPPING.md`.

**Legend**
- `[x]` landed in code (still needs your eye vs the PNG in light + dark)
- `[~]` started / partial — chrome or one surface done, siblings or interiors still old
- `[ ]` not started against Design Law
- `[!]` easy-to-miss small piece (popups, sheets, empty/error, clipped text)

Owner visual mock checklist (browser ticks only): `mockups/checklist.html`

Last updated: 2026-11-12 (Batches A–K code-landed; device PNG QA still open)

---

## 0. Foundation (do once, reuse everywhere)

- [x] Design Law folder + rules (`.cursor/rules/coach-connect-design.mdc`)
- [x] Theme / nb tokens in `src/look-and-feel/colorPalette.js`
- [~] Nb primitives restyled to Design Law (`NbButton`, `NbCard`, `NbSheet`, `NbIconChip`, `NbProgressBar`, `HardShadow`, …)
- [ ] Nb primitives still to verify 1:1 vs `DESIGN-SYSTEM.md`: field, toast, skeleton, empty-state shell, stepper polish
- [~] Bottom nav / shell (`BottomMenuBar` vs `NbBottomNav` — pick one, finish both themes)
- [!] Old gradient / glass leftovers still imported in places (`Glass*`, `GradientFrame`, soft 1px borders)

---

## 1. Welcome, sign in, reset

Screens: `screens/welcome-and-sign-in/` + `screens/hero-and-welcome-redesign/` (welcome wins)

- [x] Welcome stage (`DesignLawWelcomeStage` + LoginScreen — CC logo, rings, 3 tiles, in sync.)
- [x] Create account / Sign in (`LoginScreen.js` — role toggle, AuthField, social, Design Law chrome)
- [x] Sign-in error states (`LoginScreen` — `AuthField` dashed border + ! row, `AuthBannerErrorCard`, role-mismatch `NbSheet` — PNG 07/08)
- [x] Forgot password + Check your inbox (`ForgotPasswordFlow.js` — PNG 09–12)
- [!] Device PNG QA light+dark on welcome-and-sign-in

---

## 2. Client onboarding

Screens: `screens/client-onboarding/`

- [~] Basics → All set flow (`NewUserSetupScreen.jsx` + setup steps) — Batch 2 polish landed
- [!] Continue button width, gender chips, ticks, All set meta, Switch — verify still PNG-true after later edits
- [!] AI features permission step copy/layout

---

## 3. Trainer setup part 1 + part 2

Screens: `screens/trainer-setup/`, `screens/trainer-setup-part-2/`

- [~] Specialties, credentials, rates, invite, review (`DesignLawTrainerOnboardingScreens.jsx`)
- [~] Payout connect / skip / pro offer (`TrainerPayoutSetupStep.jsx`, `TrainerProOfferStep.jsx` + `designLaw`)
- [!] Face capture step
- [!] Payout skip sheet
- [!] Best-times / availability persistence
- [!] Verification submitted / almost-done states

---

## 4. Client dashboard + nav

Screens: `screens/client-home/` + hero from `screens/hero-and-welcome-redesign/03-04`

- [x] Welcome hero (`DesignLawHomeWelcomeHero` — Welcome to Coach Connect + lifter + tagline; no stats)
- [x] Dashboard blocks (`DesignLawHomeBlocks.jsx` + `TrainingHomeScreen.jsx`) — empty shells + week Build a plan + invite CTA
- [~] My trainer sheet / review sheet
- [x] Log / check-in sheets on home (empty check-in collapsed shell)
- [x] Every home card vs PNG (welcome, up next, week ring, number tiles, nutrition, workout, go-to) — device QA still open
- [x] Empty vs filled home (`screens/empty-vs-data/`) — nutrition / workout / check-in / week / Find trainer
- [~] Bottom nav (+ sheet)

---

## 5. Trainer home

Screens: `screens/trainer-home/` + hero from `screens/hero-and-welcome-redesign/05-06`

- [x] Welcome hero (mirrored boxer via `DesignLawTrainerMotivationCard` → `DesignLawHomeWelcomeHero`)
- [~] Shell: greeting, Needs you, client carousel, tools, weekly report (`DesignLawTrainerHomeBlocks.jsx`)
- [x] Client tab pills (segmented; Notes label no longer clips)
- [x] Progress tab interior → metric list (PNG 01/02)
- [x] Nutrition tab interior → ring + bars + meals (PNG 03/04), empty day = Design Law shell (not old Lottie)
- [x] Your Clients carousel card width widened (Sleep/Steps no longer clipped)
- [x] Spacing between client tabs block and Tools section
- [x] Sessions tab interior → agenda + Schedule CTA
- [x] Notes tab interior → inline rows + note card
- [x] Create something sheet (Tools document + spreadsheet → `DesignLawTrainerCreateSheet.jsx`, PNG 09/10)
- [x] Payout sheet over home (`PayoutSetupReminderPopup.jsx`, PNG 07/08)
- [x] New requests screen (`NewTraineeRequestsScreen.jsx`) — PNG 11/12; payout nudge wired to Money
- [x] Money / Edit rate (`EarningsScreen.jsx`) — PNG 13–16; history UI not on PNG (deferred)
- [x] Messages inbox chrome (`InboxScreen.jsx`) — inbox-and-money 01 (no glass/purple)
- [x] Chat thread chrome (`ChatScreen.jsx`) — inbox-and-money 09/10 (session cards / attach still ActionSheet)
- [x] Document / spreadsheet editor chrome + paper/desk tokens (`editorColors.js`, export blockquote → nb ink)
- [x] Share document sheet (`ShareDocumentPopup.js`) Design Law NbSheet
- [x] Progress photos gallery + fullscreen viewer + thumb strip (`MyProgressPhotosScreen.jsx`)
- [x] New-request Age/Weight/Height from request payload or `users/{clientUid}` when present
- [x] Tools → Workout plans list + Build custom maker chrome (Saved + Manual builder — see §7)
- [!] Trainer bottom nav slots confirmed with you
- [!] Chat: Design Law attach sheet + session-scheduled cards (still native ActionSheet / plain bubbles)
- [x] Compare photos flow (`MyProgressPhotosScreen` Compare slider — progress PNG 09/10)
- [!] CreateWorkoutPlanScreen full generate/building/viewer still pink in places (coach banner fixed)
- [!] Spot-check light+dark vs PNGs on device before calling any of the above “final”

---

## 6. AI Coach

Screens: `screens/ai-coach/`, `screens/ai-coach-popups/`

- [x] Coach home (PNG 01 structure)
- [x] Conversation chrome (header, Copy reply, Ask Next, attach/paste)
- [x] Reply typography (Design Law sans / square bullets)
- [x] Kill “didn’t search the web / coaching knowledge” copy (prompt + strip)
- [x] Daily rate limits raised (100 / 200 / 400)
- [x] Confirm popups restyle pass (meal/mood/sleep/steps/water + shared chrome)
- [~] Past chats drawer / delete
- [!] Source cards / web research chip vs PNG 05
- [!] Photos-ready / paste sheets edge cases
- [!] Empty coach home vs filled

---

## 7. Workouts

Screens: `screens/workouts/`

- [x] My plan / Notes / Videos shell (`MyWorkoutPlanScreen.jsx` — PNG 01 Plan|Notes|Videos + Start session → `openWorkoutSession`)
- [x] Session mode log + rest (`DesignLawWorkoutSessionScreen.jsx` — PNG 09–12)
- [x] Videos tab + Avoid sheet (`ExerciseVideosTab.jsx`, ShortVideoCard, ExerciseCard, DislikedExercisesPicker — PNG 05–08 HardShadow filters / journey / grid)
- [x] New plan / building (`NewPlanDesignLawPanel.jsx` + `BuildingYourPlanView.jsx` via `CreateWorkoutPlanScreen.js` — PNG 13–16 list rows, Build with AI | Ask my trainer, full building screen)
- [x] Workout root tabs restored: **Workout Plans | Exercise Library** (`CreateWorkoutPlanScreen` → `ExerciseVideosTab`)
- [x] Saved plans (`SavedWorkoutsScreen.jsx` — PNG 17 list + PNG 18 delete NbSheet)
- [x] Trainer builder chrome (`ManualWorkoutPlanBuilderScreen.jsx` — PNG 19–24)
- [!] Muscle/equipment filter chips on trainer library sheet still search-only (PNG 21)
- [!] Spot-check light+dark vs workouts PNGs on device

---

## 8. Nutrition

Screens: `screens/nutrition/`

- [x] Daily log (`DailyFoodLogScreen.jsx` + `MealCard` / `DayPicker` / `MacroBar` — PNG 01–04 HardShadow)
- [x] Food search (`FoodSearchScreen.js` — PNG 05–08; Scan/Quick Add + NbSegmented; basket pill + sequential confirm for multi-select)
- [x] Barcode (`BarcodeScannerScreen.js` — PNG 09–12)
- [x] Nutrition facts confirm + edit serving (`ConfirmFoodPopup.jsx`, `EditServingPopup.jsx` — PNG 13–16)
- [x] Daily Nutrition facts report (`NutritionFactsScreen.jsx` — HardShadow; opened from daily log row)
- [x] Quick add (`QuickAddNutrition.jsx` — PNG 17/18)
- [x] Targets / settings / reset (`NutritionSettingsScreen.js` — PNG 19–24)
- [x] Onboarding setup (`NutritionSetupScreen.jsx` — HardShadow cards)
- [x] Daily facts report + FoodCard/panel siblings → HardShadow (no GradientFrame in nutrition/)
- [x] `LogTodaysMealsScreen.jsx` → thin alias to `DailyLogContent` (no parallel pink path)
- [!] Device PNG QA light+dark for full nutrition stack

---

## 9. Progress (client)

Screens: `screens/progress/`

- [x] Progress charts (`ProgressChartsScreen.jsx` — Weight / Body fat / Lifts; Go to → Progress)
- [x] Photos / viewer / compare (`MyProgressPhotosScreen.jsx` — grid + viewer PNG 07/08 + Compare slider PNG 09/10)
- [x] Weekly report (client) — `WeeklyReportScreen` / body Design Law; `WeeklyReportBars` legacy helpers only
- [x] Spreadsheet viewer chrome (`SpreadsheetViewer.js` — HardShadow table + empty/error shells)
- [x] Empty gallery / no-data charts (dashed empty shells on charts + gallery)
- [!] Device PNG QA light+dark for charts / compare / spreadsheet

---

## 10. Settings and profile

Screens: `screens/settings-and-profile/`

- [x] Edit profile list screen (`MyProfileScreen.jsx` — NbPageHeader / Save)
- [x] Field edit popup (weight/name/etc.) → Design Law bottom sheet (client + trainer share this)
- [x] Settings root (client + trainer) — Batch F
- [x] FAQ / Contact / Bug / Terms / Privacy (+ `PrivacyDataRightsScreen`)
- [x] Delete account hold-to-confirm (`HoldToConfirmPopup`)
- [x] Blocked users + ReportOrBlock sheet (PNG 29 — reasons + Also block)
- [x] Remove trainer popup (Design Law sheet)
- [x] Change password (3-field reauth on Settings)
- [x] Certification upload sheet (`CertificationUploadSheet`)
- [x] Coaching payment (`CoachingPaymentScreen` — PNG 07/08 active + empty)
- [!] Device PNG QA light+dark; bug screenshot picker still visual-only

---

## 11. Messages, notifications, Pro

Screens: `screens/inbox-and-money/`

- [x] Inbox (trainer + client) — PNG 01 list/search
- [x] Chat thread (`ChatScreen.jsx`) — PNG 09–13: NbSheet attach, `ChatSessionCard`, blocked shell + `ReportOrBlockSheet`; device QA still open
- [x] Notifications (`NotificationsScreen.jsx` + trainer/client stack routes; home bells → `openNotifications`)
- [x] Pro offer / upgrade / expired (`ProUpgradeOffer.jsx` HardShadow hero+cards, `ProUpgradeScreen.jsx`, `ProExpiredScreen.jsx`, onboarding `TrainerProOfferStep`)
- [x] Free trial banner (`FreeTrialBanner.jsx` 3 states on trainer home; Subscribe → Settings)
- [!] Alert→Nb sheet sweep + blocked empty edge cases still hunting

---

## 12. Files and notes

Screens: `screens/files-and-notes/`

- [~] Trainer home Notes tab (inline Design Law rows)
- [x] Client Notes & Files workspace (`FilesSection` + `ClientMainScreen` NbPageHeader + NbSegmented)
- [~] Add sheet (`AddFilePopup` → NbSheet PNG 05/06); compact note step in-sheet; full PNG 07 attach-files composer still [ ]
- [x] Viewer / delete sheets — `PdfViewer` / `PhotoVideoViewer` / `DeleteFileSheet` (PNG 09–16); prev/next page chrome still light
- [x] Trainer shared files popup (`TrainerSharedFilesPopup` → NbPageHeader)
- [~] Document editor (`DocumentEditor.js` + `ShareDocumentPopup.js`) — Design Law chrome pass landed (PNG 17–20): HardShadow header/toolbar/page card, Clean/Bold/Handout chips, reading-level row, Export/Share; interior still WebView contentEditable; next: TipTap/Lexical via Expo DOM
- [x] `FilesHeaderCard` / `FilesSection` / `AddFilePopup` / `MyFilesSection` / `FilesScreen` / `FileGrid` Design Law chrome
- [~] Spreadsheet editor (`SpreadsheetEditor.js`) — Design Law chrome pass landed: DocumentEditor-style header, HardShadow toolbar/grid frame/tabs/toasts, `editorColors` nb tokens (no green formula chrome), SlideUpMenu + FormulaBar skinned; still custom grid + SlideUpMenu; next: native `expo-modern-table` OR Univer in Expo DOM

---

## 13. Scheduling

Screens: `screens/scheduling/`

- [x] Trainer Sessions tab → `BookSessionScreen` (calendar/list) + `CalendarTab` mount
- [x] Full calendar / month / list (`BookSessionScreen`, `MonthCalendar`, `SessionCard`)
- [x] New session form (`ScheduleSessionScreen` — PNG chips)
- [x] Session detail + delete NbSheets (`SessionDetailSheet`, `DeleteSessionSheet` — PNG 13–16)
- [x] Client My sessions + Request (`MySessionsScreen`, `RequestSessionScreen` — PNG 17–22); home entry when empty
- [!] Device PNG QA light+dark; Message from detail needs chat wiring when available

---

## 14. Trainees and records

Screens: `screens/trainees-and-records/`

- [x] Clients roster (`MyTraineesScreen` — search, requests row, filters, empty invite code, toast)
- [x] Manage trainee / client record (`ManageTraineeScreen` — Design Law header + Progress/Nutrition/Sessions/Notes)
- [x] Nutrition empty dashed shell + Remind CTA; filled micros + foods list (PNG 07–10)
- [x] Remove client flow (`RemoveClientSheet` — PNG 17/18; roster + manage + home)
- [x] Trainer weekly report screens (shared `WeeklyReportScreen` + trainer layout); Add-a-priority still visual-only
- [!] Device PNG QA light+dark

---

## 15. Loading and errors

Screens: `screens/loading-and-errors/`

- [x] Startup poster (`StartupLoadingCover.js`) — `LoginGate` + `ClientAppStart` + trainer first-roster lock in `TrainerAppStart`; `NbSkeleton.jsx` inbox rows
- [x] Crash screen (`CrashCatcher.jsx`)
- [x] Error popup (`ErrorPopup.jsx` — login/settings flows); `OfflineBanner.jsx` built, **not mounted** — deferred until `@react-native-community/netinfo` is added
- [x] Sign-out NbSheet on `SettingsScreen.js`
- [!] Every Alert.alert that should be an Nb sheet instead

---

## 16. Find a trainer (marketplace)

Screens: `screens/marketplace-new/`

- [x] List / filters / no results (Batch E)
- [x] Profile / request / confirm / sent (Batch E)
- [x] Entry banner (`FindTrainerBanner` on home when no trainer)
- [ ] Map view (deferred — no screen in repo yet)
- [!] Device PNG QA light+dark for full marketplace stack

---

## 17. Gap screens + empty states

Screens: `screens/missing-screens/`, `screens/empty-vs-data/`

- [ ] Choose role
- [ ] Log workout / daily check-in / mood (non–AI-coach paths)
- [ ] Weekly Momentum
- [~] Spreadsheet editor rewrite candidate (`SpreadsheetEditor.js` — see §12; pick Expo DOM Univer vs native grid)
- [ ] Trainer AI coach variant (if separate)
- [x] Empty vs filled audit for **client** dashboard (`empty-vs-data` nutrition/workout/check-in/week/banner)
- [ ] Empty vs filled audit for trainer home, plan, coach home

---

## Easy-to-miss inventory (keep hunting these)

These are the pieces that usually stay “old shit” after a screen pass:

1. **Edit / confirm / delete popups** opened from a Design Law screen
2. **Bottom sheets** (attach, create, filter, share, payout skip)
3. **Empty states** and **loading skeletons**
4. **Error / offline / hold-to-confirm**
5. **Segmented tabs** with clipped labels (`adjustsFontSizeToFit`)
6. **Gradient primary buttons** left over from the old brand
7. **1px borders + soft iOS shadows** instead of 3px + HardShadow
8. **Purple / green accents** outside allowed gradient chips
9. **Alert.alert** where Design Law shows a sheet
10. **Trainer vs client duplicate screens** (same popup, two entry points)

---

## Batches (do in order — PNG-first, leave nothing behind)

### Done (device QA still required light + dark)

| Batch | Scope | Screens / key files |
|---|---|---|
| **A** | Foundation + Nb* chrome | `look-and-feel`, theme tokens, HardShadow |
| **B** | Workouts (client) | `screens/workouts/` — plan / notes / videos / session / new plan / library / saved |
| **C** | Nutrition | `screens/nutrition/` — log / search / barcode / confirm / quick add / settings |

### Remaining

| Batch | Status | Scope | Must finish (no leftovers) |
|---|---|---|---|
| **D** | **DONE** | **Files & notes** | `AddFilePopup`, `FilesHeaderCard`, `FilesSection`, `FilesScreen`, `MyFilesSection`, trainer shared files popup, `DeleteFileSheet` · PNGs `screens/files-and-notes/` · Viewer chrome polish (PDF/media) can tighten later |
| **E** | **DONE** | **Marketplace (Find a trainer)** | List / search / empty, filter popup, trainer card, profile, request / confirm / sent, home banner · PNGs `screens/marketplace-new/` · Map deferred (no repo screen) |
| **F** | **DONE** | **Settings & profile** | Root + support + hold/remove + privacy + ReportOrBlock + coaching payment + cert sheet · PNGs `screens/settings-and-profile/` |
| **G** | **DONE** | **Client home + empty states** | Empty nutrition/workout/check-in/week + Find trainer invite CTA · Go to Progress → charts · PNGs `screens/client-home/`, `empty-vs-data/` · device QA still open |
| **H** | **DONE** | **Scheduling** | Calendar/list/new/detail/delete + client My sessions/Request landed · device PNG QA still open · PNGs `screens/scheduling/` |
| **I** | **DONE** | **Progress** | Charts + photo compare + spreadsheet empty/error · weekly report already [x] · PNGs `screens/progress/` · device QA still open |
| **J** | **DONE** | **Trainees & records** | Roster + manage + remove + nutrition empty/filled · PNGs `screens/trainees-and-records/` |
| **K** | **DONE** | **Messages leftovers + Pro + loading/errors** | Chat attach NbSheet + session cards + blocked; `NotificationsScreen` + client/trainer bells (`openNotifications`); `FreeTrialBanner` 3 states; Pro stack wired · boot poster + `NbSkeleton` inbox + `CrashCatcher` both shells; Settings sign-out NbSheet · `OfflineBanner` deferred (no NetInfo) · PayTrainerPopup `NbSheet` import fixed · Alert→Nb sweep still [!] · device QA still [!] |

### Batch rules

1. **PNG first** — match `screens/<flow>/*.png` light + dark before calling a batch done.
2. **Nothing left behind** — every popup / sheet / empty / error opened from that flow is in the same batch.
3. **One batch at a time** for “done” claims — D and E may run in parallel only while both are unfinished; do not start F until D+E are `[x]` or explicitly deferred.
4. **Headers** — every tab/root header uses `NbPageHeader` or `useShellTopPad` (shell SafeArea is left/right only).

---

## How we use this

- When a flow is finished: flip `[ ]` → `[x]` and note the PNG numbers you compared.
- When something looks done but a popup is still old: leave the flow `[~]` and add a `[!]` line.
- Do not start the next big batch until the current `[~]` audit items you care about are either `[x]` or explicitly deferred.
