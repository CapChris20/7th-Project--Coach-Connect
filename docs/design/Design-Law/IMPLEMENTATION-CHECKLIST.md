# Design Law implementation checklist

Living status of the PNG-first redesign. Source of truth for visuals is still `screens/<flow>/*.png`, then `DESIGN-SYSTEM.md`, then `mockups/*.html`, then `MAPPING.md`.

**Legend**
- `[x]` landed in code (still needs your eye vs the PNG in light + dark)
- `[~]` started / partial — chrome or one surface done, siblings or interiors still old
- `[ ]` not started against Design Law
- `[!]` easy-to-miss small piece (popups, sheets, empty/error, clipped text)

Owner visual mock checklist (browser ticks only): `mockups/checklist.html`

Last updated: 2026-11-12 (AI coach PNG 05 chip; workout library PNG 21 filters; DocumentEditor menus→Nb sheets; spreadsheet retired)

---

## 0. Foundation (do once, reuse everywhere)

- [x] Design Law folder + rules (`.cursor/rules/coach-connect-design.mdc`)
- [x] Theme / nb tokens in `src/look-and-feel/colorPalette.js`
- [x] Nb primitives restyled to Design Law (`NbButton`, `NbCard`, `NbSheet`, `NbIconChip`, `NbProgressBar`, `HardShadow`, …)
- [x] Nb primitives 1:1 vs `DESIGN-SYSTEM.md`: `NbField`, `NbToast`, `NbSkeleton` (+ soft pulse), `NbEmptyState`, `NbStepper`, `NbNoticeSheet`
- [x] Bottom nav / shell — **production path = `BottomMenuBar.js`** (both themes); `NbBottomNav.jsx` is preview twin only (soft chip + center +)
- [x] Old gradient / glass leftovers — screen imports of `Glass*` / unused `GradientFrame`/`CoachGlassCard` cleared; Login dead `footerLink` / Liquid cyan footer token removed

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

- [x] Basics → All set flow (`NewUserSetupScreen.jsx` + `ClientOnboardingScreens.jsx` + setup steps)
- [x] Continue button width, gender chips, ticks, All set meta, Switch (`NbSwitch` 56×34, wide-row ticks, PNG 15 meta)
- [x] AI features permission step copy/layout (`AIPermissionStep.jsx` — PNG 13/14)
- [!] Device PNG QA light+dark on client-onboarding

---

## 3. Trainer setup part 1 + part 2

Screens: `screens/trainer-setup/`, `screens/trainer-setup-part-2/`

- [x] Specialties, credentials, rates, invite, review (`DesignLawTrainerOnboardingScreens.jsx`)
- [x] Payout connect / skip / pro offer (`TrainerPayoutSetupStep.jsx`, `TrainerProOfferStep.jsx` + `designLaw`)
- [x] Face capture step (Design Law “Verify your face” + camera permission NbSheet)
- [x] Payout skip sheet (NbSheet — Clients wait / Skip anyway / Finish setup)
- [x] Best-times / availability persistence (`preferredSessionTimes` on onboardingData)
- [x] Verification submitted / almost-done states (In review badge + face preview)
- [!] Device PNG QA light+dark on trainer-setup + part-2

---

## 4. Client dashboard + nav

Screens: `screens/client-home/` + hero from `screens/hero-and-welcome-redesign/03-04`

- [x] Welcome hero (`DesignLawHomeWelcomeHero` — Welcome to Coach Connect + lifter + tagline; no stats)
- [x] Dashboard blocks (`DesignLawHomeBlocks.jsx` + `TrainingHomeScreen.jsx`) — empty shells + week Build a plan + invite CTA
- [x] My trainer sheet / review sheet (`DesignLawTrainerSheet` PNG 11/12 + `WriteTrainerReviewPopup` NbSheet PNG 13/14)
- [x] Log / check-in sheets on home (empty check-in collapsed shell)
- [x] Every home card vs PNG (welcome, up next, week ring, number tiles, nutrition, workout, go-to) — device QA still open
- [x] Empty vs filled home (`screens/empty-vs-data/`) — nutrition / workout / check-in / week / Find trainer
- [x] Bottom nav (+ sheet) — `BottomMenuBar` Design Law chrome (Add something sheet already on home)

---

## 5. Trainer home

Screens: `screens/trainer-home/` + hero from `screens/hero-and-welcome-redesign/05-06`

- [x] Welcome hero (mirrored boxer via `DesignLawTrainerMotivationCard` → `DesignLawHomeWelcomeHero`)
- [x] Shell: greeting, Needs you, client carousel, tools, weekly report (`DesignLawTrainerHomeBlocks.jsx`)
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
- [x] Chat thread chrome (`ChatScreen.jsx`) — inbox-and-money 09/10 (NbSheet attach, session cards, image captions)
- [x] Document / spreadsheet editor chrome + paper/desk tokens (`editorColors.js`, export blockquote → nb ink)
- [x] Share document sheet (`ShareDocumentPopup.js`) Design Law NbSheet
- [x] Progress photos gallery + fullscreen viewer + thumb strip (`MyProgressPhotosScreen.jsx`)
- [x] New-request Age/Weight/Height from request payload or `users/{clientUid}` when present
- [x] Tools → Workout plans list + Build custom maker chrome (Saved + Manual builder — see §7)
- [!] Trainer bottom nav slots confirmed with you
- [x] Chat: Design Law attach sheet + session Confirm/Change + image caption overlay
- [x] Compare photos flow (`MyProgressPhotosScreen` Compare slider — progress PNG 09/10)
- [x] CreateWorkoutPlanScreen generate/building/viewer chrome uses nb ink (PLAN_BUILDER_COLORS.pink → ink; edit forms nb borders; user notices → NbNoticeSheet)
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
- [x] Past chats drawer / delete (`PastChatsPanel.jsx` — HardShadow search, `NbEmptyState`, swipe delete)
- [x] Source cards / web research chip vs PNG 05 — bordered research pill + SOURCES/SAMPLE cards (pin icon fallback)
- [x] Photos-ready / paste sheets — multi-select cap 4, READY TO SEND prompt rows (PNG 09), empty/filled home gating
- [x] Empty coach home vs filled (SeesToday/PhotoWeb gating, sleep “avg”, honest trainer client chip, paste clipboard + max length)

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
- [x] Muscle/equipment filter chips on trainer library sheet (PNG 21 — Chest/Back/Shoulders/Biceps segment + Barbell/Dumbbell/Bodyweight/Cable/Machine pills)
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
- [x] Bug screenshot picker (`BugReportScreen` — ImagePicker up to 3 thumbs + names in report body)
- [!] Device PNG QA light+dark still open when Simulator has app foregrounded

---

## 11. Messages, notifications, Pro

Screens: `screens/inbox-and-money/`

- [x] Inbox (trainer + client) — PNG 01 list/search
- [x] Chat thread (`ChatScreen.jsx`) — PNG 09–13: NbSheet attach, `ChatSessionCard` Confirm/Change, image captions, blocked shell + `ReportOrBlockSheet`; device QA still open
- [x] Notifications (`NotificationsScreen.jsx` + trainer/client stack routes; home bells → `openNotifications`)
- [x] Pro offer / upgrade / expired (`ProUpgradeOffer.jsx` HardShadow hero+cards, `ProUpgradeScreen.jsx`, `ProExpiredScreen.jsx`, onboarding `TrainerProOfferStep`)
- [x] Free trial banner (`FreeTrialBanner.jsx` 3 states on trainer home; Subscribe → Settings)
- [x] Alert→Nb sheet sweep on high-traffic paths (trainer listing, plan builder notices, spreadsheet viewer); OS permission Alerts kept
- [!] Blocked empty edge cases still hunting

---

## 12. Files and notes

Screens: `screens/files-and-notes/`

- [x] Trainer home Notes tab (inline Design Law rows + eyebrow; pink border tokens retired)
- [x] Client Notes & Files workspace (`FilesSection` + `ClientMainScreen` NbPageHeader + NbSegmented)
- [x] Add sheet (`AddFilePopup` → NbSheet PNG 05/06 + PNG 07 attach-files composer: note + staged files + Add another file)
- [x] Viewer / delete sheets — `PdfViewer` / `PhotoVideoViewer` / `DeleteFileSheet` (PNG 09–16); PDF prev/next + page label chrome
- [x] Trainer shared files popup (`TrainerSharedFilesPopup` → NbPageHeader)
- [x] Document editor (`DocumentEditor.js` + `ShareDocumentPopup.js`) — Design Law PNG 17–20 chrome; **typing uses contentEditable WebView**; Clean/Bold/Handout; reading level; Export/Share; Document/Text style/Insert menus + leave/delete confirms are NbSheet / NbNoticeSheet
- [x] `FilesHeaderCard` / `FilesSection` / `AddFilePopup` / `MyFilesSection` / `FilesScreen` / `FileGrid` Design Law chrome
- [x] Spreadsheet editor — **RETIRED** (deleted; Google Sheets / upload .xlsx·CSV only)

---

## 13. Scheduling

Screens: `screens/scheduling/`

- [x] Trainer Sessions tab → `BookSessionScreen` (calendar/list) + `CalendarTab` mount
- [x] Full calendar / month / list (`BookSessionScreen`, `MonthCalendar`, `SessionCard`)
- [x] New session form (`ScheduleSessionScreen` — PNG chips)
- [x] Session detail + delete NbSheets (`SessionDetailSheet`, `DeleteSessionSheet` — PNG 13–16)
- [x] Client My sessions + Request (`MySessionsScreen`, `RequestSessionScreen` — PNG 17–22); home entry when empty
- [x] Message from session detail → chat (`CalendarTab` / `TrainerHomeContent` / `ManageTrainee` `onMessageClient`)
- [!] Device PNG QA light+dark still open when Simulator has app foregrounded

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
- [x] Error popup (`ErrorPopup.jsx` — login/settings flows); `OfflineBanner.jsx` mounted on `ClientMainScreen` + `TrainerMainScreen` via `useNetworkStatus` + `@react-native-community/netinfo`
- [x] Sign-out NbSheet on `SettingsScreen.js`
- [x] Alert.alert → Nb sheet sweep — trainer home / inbox / support / AI coach / DocumentEditor menus+confirms. OS permission Alerts + some multi-option pickers elsewhere may still use Alert

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

- [x] Choose role (`ChooseRoleScreen.jsx` — LoginScreen Get Started → tiles → Create account)
- [x] Log workout / daily check-in / mood (non–AI-coach paths) — stack screens + home links (`LogWorkoutScreen`, `DailyCheckInScreen`, `MoodCheckInScreen`)
- [x] Weekly Momentum (`WeeklyMomentumScreen` — wired from Nutrition header)
- [x] Spreadsheet editor vs missing-screens 13–16 — **RETIRED** (editor deleted; upload .xlsx/CSV / Google Sheets only; tools grid no longer shows Spreadsheet creator)
- [x] Trainer AI coach variant (`DesignLawCoachHomeBody` viewerRole=trainer + `TrainerQuietClientsCard` in conversation)
- [x] Empty vs filled audit for **client** dashboard (`empty-vs-data` nutrition/workout/check-in/week/banner)
- [x] Empty vs filled audit for trainer home, plan, coach home (`empty-vs-data` 03–08 — invite empty clients, dashed weekly report, plan empty shell, coach “Nothing logged yet”)
- [!] Device PNG QA light+dark for Batch 1 gap screens (01–12, 17–20) + Batch 2 empty-vs-data trainer lines

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
| **D** | **DONE** | **Files & notes** | `AddFilePopup`, `FilesHeaderCard`, `FilesSection`, `FilesScreen`, `MyFilesSection`, trainer shared files popup, `DeleteFileSheet` · PNGs `screens/files-and-notes/` · PDF viewer prev/next + page label |
| **E** | **DONE** | **Marketplace (Find a trainer)** | List / search / empty, filter popup, trainer card, profile, request / confirm / sent, home banner · PNGs `screens/marketplace-new/` · Map deferred (no repo screen) |
| **F** | **DONE** | **Settings & profile** | Root + support + hold/remove + privacy + ReportOrBlock + coaching payment + cert sheet · PNGs `screens/settings-and-profile/` |
| **G** | **DONE** | **Client home + empty states** | Empty nutrition/workout/check-in/week + Find trainer invite CTA · Go to Progress → charts · PNGs `screens/client-home/`, `empty-vs-data/` · device QA still open |
| **H** | **DONE** | **Scheduling** | Calendar/list/new/detail/delete + client My sessions/Request landed · device PNG QA still open · PNGs `screens/scheduling/` |
| **I** | **DONE** | **Progress** | Charts + photo compare + spreadsheet empty/error · weekly report already [x] · PNGs `screens/progress/` · device QA still open |
| **J** | **DONE** | **Trainees & records** | Roster + manage + remove + nutrition empty/filled · PNGs `screens/trainees-and-records/` |
| **K** | **DONE** | **Messages leftovers + Pro + loading/errors** | Chat attach NbSheet + session cards + blocked; notifications + FreeTrialBanner + Pro · boot poster + `NbSkeleton` + `CrashCatcher` · Settings sign-out NbSheet · `OfflineBanner` + safe NetInfo lazy load · Alert→Nb high-traffic · device QA still [!] |
| **L** | **DONE (code)** | **Batch 3 foundation leftovers + misc** | NbField/Toast/Empty/Stepper/Skeleton pulse/NoticeSheet · BottomMenuBar canonical · Glass/GradientFrame screen leftovers cleared · My trainer + review NbSheets · PastChatsPanel · AddFilePopup PNG 07 · OfflineBanner wired · Map deferred · device PNG QA still [!] |

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
