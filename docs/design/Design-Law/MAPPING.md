# Mockup to code map

Each mockup page is listed with the repo files that implement the matching screens today. Paths are relative to the repo root.
A path marked MISSING was guessed from a folder name and does not exist: find the real file before editing. A screen with no files is new (no existing screen).

This map comes from reading folders and screen text in the repo, not from reading every file in full. Treat it as a starting point and confirm in the code.

## Welcome, sign up, sign in, reset

Mockup file: `mockups/welcome-and-sign-in.html`  ·  Artifact id: `953rhucJV6tYmLJ1b2fGxP`

| Mockup screens | Existing code to change |
|---|---|
| Welcome, Create account, Sign in, Sign-in errors | `src/login-and-signup/LoginScreen.js`<br>`src/app-start/LoginGate.js` |
| Forgot password, Check your inbox | `src/login-and-signup/ForgotPasswordFlow.js`<br>`src/login-and-signup/resetPasswordByEmail.js` |

## Client onboarding (8 screens)

Mockup file: `mockups/client-onboarding.html`  ·  Artifact id: `3WqJR4w8LoX7YRYwtA9pmE`

| Mockup screens | Existing code to change |
|---|---|
| Basics, Goal and level, How you train, Injuries, Trainer code, Situation, AI features, All set | `src/login-and-signup/NewUserSetupScreen.jsx`<br>`src/login-and-signup/finishSetup.js`<br>`src/login-and-signup/checkTrainerCode.js`<br>`src/for-both/app-wide-settings/AIPermission.js`<br>`src/for-both/setup-steps`<br>`src/for-both/setup-icons` |

## Trainer setup part 1

Mockup file: `mockups/trainer-setup.html`  ·  Artifact id: `Y3NBEn7tuKHKidhiEe5QBi`

| Mockup screens | Existing code to change |
|---|---|
| Specialties, Credentials, Rates, Invite code, Review and go live | `src/login-and-signup/NewUserSetupScreen.jsx`<br>`src/login-and-signup/checkTrainerCode.js`<br>`src/login-and-signup/finishSetup.js` |

## Trainer setup part 2

Mockup file: `mockups/trainer-setup-part-2.html`  ·  Artifact id: `1J6XFwu3EoJ4oeuUcUdjUi`

| Mockup screens | Existing code to change |
|---|---|
| Availability, Almost done, Face capture, Verification submitted | `src/login-and-signup/NewUserSetupScreen.jsx` |
| Payouts connect, verified, retry, skip | `src/login-and-signup/TrainerPayoutSetupStep.jsx` |
| Pro offer, Setup complete | `src/trainer-pro-plan/ProUpgradeOffer.jsx`<br>`src/trainer-pro-plan/ProPlanSetup.jsx`<br>`src/login-and-signup/finishSetup.js` |

## Client dashboard and navigation bar

Mockup file: `mockups/client-home.html`  ·  Artifact id: `YNqdWeYaPdXMkKs95aYmxS`

| Mockup screens | Existing code to change |
|---|---|
| Dashboard (welcome card, up next, week, numbers, nutrition, log, check-in) | `src/client-app/home/TrainingHomeScreen.jsx`<br>`src/client-app/home/homeScreenPieces.jsx`<br>`src/client-app/home/TopBannerCard.jsx`<br>`src/client-app/home/TodayStatsCards.jsx`<br>`src/client-app/home/homeLooks.js`<br>`src/for-both/home-cards/DailyQuoteCard.js`<br>`src/daily-stats/dailyQuotes.json` |
| My trainer sheet, Write a review | `src/client-app/home/MyTrainerCard.jsx`<br>`src/client-app/home/WriteTrainerReviewPopup.js` |
| Navigation bar (+ sheet, AI layout) | `src/navigation/BottomMenuBar.js`<br>`src/client-app/navigation/ClientBottomMenu.jsx`<br>`src/client-app/navigation/ClientMainScreen.jsx` |

## Trainer home

Mockup file: `mockups/trainer-home.html`  ·  Artifact id: `24Eg1VDksjStyLrHp9EVkj`

| Mockup screens | Existing code to change |
|---|---|
| Home, tabs, tools, weekly report | `src/trainer-app/home/TrainerHomeContent.jsx`<br>`src/trainer-app/home/trainerHomePieces.jsx`<br>`src/trainer-app/weekly-report/TrainerWeeklyReportSection.jsx` |
| Needs you, payout sheet | `src/trainer-app/home/TrainerHomeContent.jsx`<br>`src/login-and-signup/TrainerPayoutSetupStep.jsx` |
| New requests | `src/trainer-app/new-requests/NewTraineeRequestsScreen.jsx` |
| Money, Edit rate | `src/trainer-app/earnings/EarningsScreen.jsx` |
| Navigation | `src/trainer-app/navigation/TrainerMainScreen.jsx`<br>`src/navigation/BottomMenuBar.js` |

## AI coach

Mockup file: `mockups/ai-coach.html`  ·  Artifact id: `7iwCfRSsTBbHZna2mTNnk9`

| Mockup screens | Existing code to change |
|---|---|
| Coach home | `src/ai-coach/home-screen/CoachHomeScreen.jsx`<br>`src/ai-coach/conversation/suggestedQuestions.js` |
| Conversation, web answer, photos, paste | `src/ai-coach/conversation/CoachConversationScreen.jsx`<br>`src/ai-coach/conversation/SourceLinkCards.jsx`<br>`src/ai-coach/conversation/PasteTextPopup.jsx`<br>`src/ai-coach/conversation/openPhotoMenu.js`<br>`src/ai-coach/reply-display` |
| Past chats drawer, delete | `src/ai-coach/past-chats/PastChatsPanel.jsx` |

## AI coach popups (15)

Mockup file: `mockups/ai-coach-popups.html`  ·  Artifact id: `VY2ZjYCSGiju4dj2qKsntU`

| Mockup screens | Existing code to change |
|---|---|
| Log meal, mood, sleep, steps, water, rate energy, rate workout, edit workout, open plan, rest day, goal, food targets, book session, message trainer, delete | `src/ai-coach/confirm-popups`<br>`src/ai-coach/conversation/ConfirmActionPopup.jsx`<br>`src/ai-coach/coach-actions` |

## Workouts

Mockup file: `mockups/workouts.html`  ·  Artifact id: `4TiqSzAvhMGaLtzxgkU16H`

| Mockup screens | Existing code to change |
|---|---|
| My plan, plan notes, videos | `src/client-app/workout-plans/MyWorkoutPlanScreen.jsx`<br>`src/workouts/view-plan`<br>`src/workouts/exercise-videos` |
| Session mode (new, no existing screen) | `src/workouts/exercise-rows` |
| New plan, building | `src/workouts/create-plan/GenerateMyWorkoutPlanScreen.jsx`<br>`src/workouts/create-plan/CreateWorkoutPlanScreen.js` |
| Saved plans | `src/for-both/workout-plans/SavedWorkoutsScreen.jsx` |
| Trainer builder, library, edit exercise | `src/trainer-app/workout-plans/ManualWorkoutPlanBuilderScreen.jsx`<br>`src/trainer-app/workout-plans/builtInExerciseList.js`<br>`src/workouts/create-plan/EditWorkoutPopup.jsx` |

## Nutrition

Mockup file: `mockups/nutrition.html`  ·  Artifact id: `Xt9uVdikL32NbQcGCRmUtN`

| Mockup screens | Existing code to change |
|---|---|
| Daily log | `src/nutrition/daily-log`<br>`src/client-app/meals/LogTodaysMealsScreen.jsx` |
| Food search and basket, no matches | `src/nutrition/food-search` |
| Barcode | `src/nutrition/barcode` |
| Nutrition facts, edit serving | `src/nutrition/food-details` |
| Quick add | `src/nutrition/quick-add/QuickAddNutrition.jsx` |
| Targets, settings, reset | `src/nutrition/targets` |

## Progress

Mockup file: `mockups/progress.html`  ·  Artifact id: `ArwYbvTE6Bq9m6F9kfBxrz`

| Mockup screens | Existing code to change |
|---|---|
| Progress charts | `src/client-app/home/TrainingHomeScreen.jsx` |
| Photos, viewer, compare | `src/for-both/photo-gallery/MyProgressPhotosScreen.jsx` |
| Weekly report | `src/for-both/weekly-report` |
| Spreadsheet viewer | `src/for-both/files-and-notes/viewers/SpreadsheetViewer.js`<br>`src/spreadsheet-support` |

## Settings and profile

Mockup file: `mockups/settings-and-profile.html`  ·  Artifact id: `GsHyifEV6sp9HdFPNk5cbY`

| Mockup screens | Existing code to change |
|---|---|
| Settings (client, trainer), coaching payment | `src/settings/SettingsScreen.js` |
| Edit profile | `src/client-app/profile/MyProfileScreen.jsx` |
| FAQ, Contact, Bug report, Terms, Privacy | `src/settings/HelpFAQScreen.jsx`<br>`src/settings/ContactSupportScreen.jsx`<br>`src/settings/BugReportScreen.jsx`<br>`src/settings/TermsOfServiceScreen.jsx`<br>`src/settings/PrivacyPolicyScreen.jsx` |
| Delete account hold to confirm | `src/for-both/popups/HoldToConfirmPopup.jsx`<br>`src/logout-cleanup/clearDataOnLogout.js` |
| Blocked users, report or block | `src/block-and-report` |
| Remove trainer | `src/for-both/popups/RemoveTrainerPopup.js` |

## Messages, notifications, Pro plan

Mockup file: `mockups/inbox-and-money.html`  ·  Artifact id: `MiRPaVpP9wH5pRFvWKvBPp`

| Mockup screens | Existing code to change |
|---|---|
| Inbox (trainer, client), chat, attach, blocked | `src/messaging/InboxScreen.jsx`<br>`src/messaging/ChatScreen.jsx` |
| Notifications | `src/notifications/manageAlerts.js`<br>`src/notifications/writeAlertText.js`<br>`src/for-both/online-connection/loadHomeAlerts.js` |
| Free trial banner, offer, upgrade, expired | `src/trainer-pro-plan/FreeTrialBanner.jsx`<br>`src/trainer-pro-plan/ProUpgradeOffer.jsx`<br>`src/trainer-pro-plan/ProUpgradeScreen.jsx`<br>`src/trainer-pro-plan/ProExpiredScreen.jsx`<br>`src/trainer-pro-plan/ProLegalFooter.jsx` |

## Files and notes

Mockup file: `mockups/files-and-notes.html`  ·  Artifact id: `GdMY6NbwNbba7fCocG1WSp`

| Mockup screens | Existing code to change |
|---|---|
| Your Notes & Files, add, viewer, delete | `src/client-app/files-and-notes`<br>`src/for-both/files-and-notes/viewers`<br>`src/for-both/home-cards/FilesHeaderCard.jsx` |
| Client files (trainer) | `src/client-app/files-and-notes/TrainerSharedFilesPopup.jsx` |
| Document editor, share | `src/trainer-app/documents/DocumentEditor.js`<br>`src/trainer-app/documents/ShareDocumentPopup.js`<br>`src/trainer-app/documents/pageStylePresets.js` |

## Scheduling

Mockup file: `mockups/scheduling.html`  ·  Artifact id: `BRcVMsPRBAKwFdfwy3aRo5`

| Mockup screens | Existing code to change |
|---|---|
| Calendar, month, list, new session, detail, delete | `src/trainer-app/scheduling/CalendarTab.jsx`<br>`src/trainer-app/scheduling/MonthCalendar.jsx`<br>`src/trainer-app/scheduling/ScheduleSessionScreen.jsx`<br>`src/trainer-app/scheduling/SessionCard.jsx`<br>`src/trainer-app/scheduling/SharedSessionList.jsx` |
| Client sessions, request | `src/trainer-app/scheduling/BookSessionScreen.jsx`<br>`src/for-both/home-cards/UpcomingSessionCard.jsx` |

## Trainees and records

Mockup file: `mockups/trainees-and-records.html`  ·  Artifact id: `91KSGCs9XFm1QSRV8er14B`

| Mockup screens | Existing code to change |
|---|---|
| Clients roster | `src/trainer-app/my-trainees/MyTraineesScreen.jsx` |
| Client record tabs, remove | `src/trainer-app/trainee-detail/ManageTraineeScreen.jsx`<br>`src/trainer-app/progress-tab`<br>`src/trainer-app/nutrition-tab/TrainerNutritionTab.jsx` |
| Weekly report (trainer) | `src/trainer-app/weekly-report` |

## Loading and errors

Mockup file: `mockups/loading-and-errors.html`  ·  Artifact id: `RUc3CcX8vu7MMZ9GBZi2iE`

| Mockup screens | Existing code to change |
|---|---|
| Startup, skeletons, loaders | `src/for-both/loading-and-header`<br>`src/app-start` |
| Crash | `src/crash-reports/CrashCatcher.jsx` |
| Errors, offline | `src/for-both/popups/ErrorPopup.jsx`<br>`src/for-both/online-connection/checkConnectionHealth.js` |
| Sign out | `src/logout-cleanup/clearDataOnLogout.js`<br>`src/settings/SettingsScreen.js` |

## Find a trainer

Mockup file: `mockups/marketplace-new.html`  ·  Artifact id: `PPia372geK6qZcEVWoYK7K`

| Mockup screens | Existing code to change |
|---|---|
| List, filters, no results | `src/client-app/find-a-trainer/BrowseTrainersScreen.jsx`<br>`src/client-app/find-a-trainer/SearchTrainersScreen.jsx`<br>`src/client-app/find-a-trainer/FilterPopup.js`<br>`src/client-app/find-a-trainer/trainerFilters.js`<br>`src/client-app/find-a-trainer/TrainerCard.jsx` |
| Profile, request, confirm, sent | `src/client-app/find-a-trainer/TrainerProfilePopup.jsx`<br>`src/client-app/find-a-trainer/RequestIntroPopup.jsx`<br>`src/client-app/find-a-trainer/ConfirmRequestPopup.jsx`<br>`src/client-app/find-a-trainer/sendConnectionRequest.js` |
| Entry banner | `src/for-both/home-cards/FindTrainerBanner.jsx` |
| Map view | New: no matching screen found in the repo |

## Gap screens

Mockup file: `mockups/missing-screens.html`  ·  Artifact id: `T7VrMSDiqUgKzjgNHWHLHe`

| Mockup screens | Existing code to change |
|---|---|
| Choose role | `src/login-and-signup/decideTraineeOrTrainer.js`<br>`src/login-and-signup/NewUserSetupScreen.jsx` |
| Log workout, daily check-in, mood | `src/client-app/home/TrainingHomeScreen.jsx`<br>`src/ai-coach/confirm-popups/LogMoodPopup.jsx` |
| Weekly Momentum | `src/nutrition/daily-log/DailyFoodLogScreen.jsx`<br>`src/client-app/meals/LogTodaysMealsScreen.jsx` |
| Spreadsheet editor | `src/trainer-app/documents/SpreadsheetEditor.js`<br>`src/trainer-app/documents/spreadsheet-grid` |
| Trainer AI coach | `src/ai-coach/home-screen/CoachHomeScreen.jsx`<br>`src/ai-coach/conversation/suggestedQuestions.js` |

## Empty versus filled

Mockup file: `mockups/empty-vs-data.html`  ·  Artifact id: `GTeySwdqBNjGKYYU785Psa`

| Mockup screens | Existing code to change |
|---|---|
| Dashboard, trainer home, plan, coach home (empty states) | `src/client-app/home/TrainingHomeScreen.jsx`<br>`src/trainer-app/home/TrainerHomeContent.jsx`<br>`src/workouts/view-plan/WorkoutPlanView.jsx`<br>`src/ai-coach/home-screen/CoachHomeScreen.jsx` |

## Shared pieces the mockups use everywhere

| Piece | Where it lives today |
|---|---|
| Bottom bar | `src/navigation/BottomMenuBar.js` |
| Theme colors | `src/look-and-feel` |
| Icons | `src/assets/icons`, `src/for-both/icons` |
| Lottie files | `src/assets/animations` |
| Header and loading | `src/for-both/loading-and-header` |