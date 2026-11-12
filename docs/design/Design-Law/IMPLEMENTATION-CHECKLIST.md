# Design Law implementation checklist

Living status of the PNG-first redesign. Source of truth for visuals is still `screens/<flow>/*.png`, then `DESIGN-SYSTEM.md`, then `mockups/*.html`, then `MAPPING.md`.

**Legend**
- `[x]` landed in code (still needs your eye vs the PNG in light + dark)
- `[~]` started / partial — chrome or one surface done, siblings or interiors still old
- `[ ]` not started against Design Law
- `[!]` easy-to-miss small piece (popups, sheets, empty/error, clipped text)

Owner visual mock checklist (browser ticks only): `mockups/checklist.html`

Last updated: 2026-11-12 (Batches A–E code-landed; F–K queued; device PNG QA still open)

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

Screens: `screens/welcome-and-sign-in/`

- [~] Welcome / Create account / Sign in (`LoginScreen.js`)
- [ ] Sign-in error states 1:1
- [ ] Forgot password + Check your inbox (`ForgotPasswordFlow.js`)

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

Screens: `screens/client-home/`

- [~] Dashboard blocks (`DesignLawHomeBlocks.jsx` + `TrainingHomeScreen.jsx`)
- [~] My trainer sheet / review sheet
- [~] Log / check-in sheets on home
- [!] Every home card vs PNG (welcome, up next, week ring, number tiles, nutrition, workout, go-to)
- [!] Empty vs filled home (`screens/empty-vs-data/`)
- [~] Bottom nav (+ sheet)

---

## 5. Trainer home

Screens: `screens/trainer-home/`

- [~] Shell: greeting, motivation, Needs you, client carousel, tools, weekly report (`DesignLawTrainerHomeBlocks.jsx`)
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
- [!] Compare photos flow (progress PNG compare) not built here
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

- [ ] Progress charts
- [~] Photos / viewer / compare (`MyProgressPhotosScreen.jsx` — grid + fullscreen viewer PNG 07/08 [~]; compare slider [ ])
- [ ] Weekly report (client)
- [ ] Spreadsheet viewer chrome
- [!] Empty gallery / no-data charts

---

## 10. Settings and profile

Screens: `screens/settings-and-profile/`

- [~] Edit profile list screen (`MyProfileScreen.jsx`)
- [x] Field edit popup (weight/name/etc.) → Design Law bottom sheet (client + trainer share this)
- [ ] Settings root (client + trainer)
- [ ] FAQ / Contact / Bug / Terms / Privacy
- [ ] Delete account hold-to-confirm
- [ ] Blocked users / report-or-block
- [ ] Remove trainer popup
- [!] Change password screen
- [!] Certification upload sheet on trainer profile
- [!] Any remaining gradient Save buttons in settings popups

---

## 11. Messages, notifications, Pro

Screens: `screens/inbox-and-money/`

- [x] Inbox (trainer + client) — PNG 01 list/search
- [~] Chat thread (`ChatScreen.jsx`) — PNG 09/10 bubbles/header/composer [x]; session cards / attach sheet still old
- [ ] Notifications surfaces
- [~] Pro offer pieces (touched in trainer setup)
- [ ] Free trial banner / upgrade / expired screens
- [!] Message composer, attach sheet, blocked empty state

---

## 12. Files and notes

Screens: `screens/files-and-notes/`

- [~] Trainer home Notes tab (inline Design Law rows)
- [x] Client Notes & Files workspace (`FilesSection` + `ClientMainScreen` NbPageHeader + NbSegmented)
- [~] Add sheet (`AddFilePopup` → NbSheet PNG 05/06); compact note step in-sheet; full PNG 07 attach-files composer still [ ]
- [x] Viewer / delete sheets — `PdfViewer` / `PhotoVideoViewer` / `DeleteFileSheet` (PNG 09–16); prev/next page chrome still light
- [x] Trainer shared files popup (`TrainerSharedFilesPopup` → NbPageHeader)
- [x] Document editor + share popup (`DocumentEditor.js`, `ShareDocumentPopup.js` — PNG 17–20); file-error cards PNG 21–22 still [ ]
- [x] `FilesHeaderCard` / `FilesSection` / `AddFilePopup` / `MyFilesSection` / `FilesScreen` / `FileGrid` Design Law chrome
- [~] Spreadsheet editor shell (`SpreadsheetEditor.js`) — share title wired; Google-docs chrome still [~]

---

## 13. Scheduling

Screens: `screens/scheduling/`

- [~] Trainer home Sessions agenda (simplified to Design Law list)
- [ ] Full calendar / month / list screens
- [ ] New session / detail / delete
- [ ] Client book / request session
- [!] Upcoming session home card

---

## 14. Trainees and records

Screens: `screens/trainees-and-records/`

- [ ] Clients roster
- [ ] Manage trainee / client record tabs (separate from trainer-home tabs)
- [ ] Remove client flow
- [ ] Trainer weekly report screens
- [!] Roster search, empty roster, remove confirm popup

---

## 15. Loading and errors

Screens: `screens/loading-and-errors/`

- [ ] Startup / skeletons / loaders
- [ ] Crash screen
- [ ] Error popup / offline
- [ ] Sign-out chrome
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
- [~] Spreadsheet editor (`SpreadsheetEditor.js` + `editorColors.js` — tabs/toolbars; grid cell chrome + `SlideUpMenu` still older)
- [ ] Trainer AI coach variant (if separate)
- [ ] Empty vs filled audit for dashboard, trainer home, plan, coach home

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
| **F** | Queued | **Settings & profile** | Settings root (client + trainer), FAQ / Contact / Bug / Terms / Privacy, delete account hold-to-confirm, blocked users, remove trainer, change password · PNGs `screens/settings-and-profile/` |
| **G** | Queued | **Client home + empty states** | Card-by-card vs `screens/client-home/`, Find trainer banner polish, empty-vs-data audit for home / trainer home / plan / coach |
| **H** | Queued | **Scheduling** | Full calendar / month / list, new session / detail / delete, client book / request, upcoming session home card · PNGs `screens/scheduling/` |
| **I** | Queued | **Progress** | Charts, photos compare slider, weekly report (client), spreadsheet viewer chrome · PNGs `screens/progress/` |
| **J** | Queued | **Trainees & records** | Clients roster, manage trainee / record tabs (outside trainer-home), remove client, trainer weekly report · PNGs `screens/trainees-and-records/` |
| **K** | Queued | **Messages leftovers + Pro + loading/errors** | Chat attach sheet + session cards, notifications, trial / upgrade / expired, skeletons / crash / offline / sign-out, Alert→Nb sheet sweep · PNGs `screens/inbox-and-money/`, `screens/loading-and-errors/` |

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
