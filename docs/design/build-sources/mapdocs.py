import os, glob
REPO = '/Users/captainchris20/Projects/My-Coding-Portfolio/Coach-Connect'
OUT = '/private/tmp/claude-501/-Users-captainchris20--claude-spares-spare-Ca25Yl/9eee38b5-d15b-45c8-b185-fea06ce8f3b6/scratchpad/handoff/coach-connect-design-handoff'
os.makedirs(OUT, exist_ok=True)

# page file -> (title, artifact link, [(mockup screens, [repo paths or globs]), ...])
M = [
 ('welcome-and-sign-in.html', 'Welcome, sign up, sign in, reset', '953rhucJV6tYmLJ1b2fGxP', [
   ('Welcome, Create account, Sign in, Sign-in errors', ['src/login-and-signup/LoginScreen.js', 'src/app-start/LoginGate.js']),
   ('Forgot password, Check your inbox', ['src/login-and-signup/ForgotPasswordFlow.js', 'src/login-and-signup/resetPasswordByEmail.js'])]),
 ('client-onboarding.html', 'Client onboarding (8 screens)', '3WqJR4w8LoX7YRYwtA9pmE', [
   ('Basics, Goal and level, How you train, Injuries, Trainer code, Situation, AI features, All set',
    ['src/login-and-signup/NewUserSetupScreen.jsx', 'src/login-and-signup/finishSetup.js', 'src/login-and-signup/checkTrainerCode.js', 'src/for-both/app-wide-settings/AIPermission.js', 'src/for-both/setup-steps', 'src/for-both/setup-icons'])]),
 ('trainer-setup.html', 'Trainer setup part 1', 'Y3NBEn7tuKHKidhiEe5QBi', [
   ('Specialties, Credentials, Rates, Invite code, Review and go live', ['src/login-and-signup/NewUserSetupScreen.jsx', 'src/login-and-signup/checkTrainerCode.js', 'src/login-and-signup/finishSetup.js'])]),
 ('trainer-setup-part-2.html', 'Trainer setup part 2', '1J6XFwu3EoJ4oeuUcUdjUi', [
   ('Availability, Almost done, Face capture, Verification submitted', ['src/login-and-signup/NewUserSetupScreen.jsx']),
   ('Payouts connect, verified, retry, skip', ['src/login-and-signup/TrainerPayoutSetupStep.jsx']),
   ('Pro offer, Setup complete', ['src/trainer-pro-plan/ProUpgradeOffer.jsx', 'src/trainer-pro-plan/ProPlanSetup.jsx', 'src/login-and-signup/finishSetup.js'])]),
 ('client-home.html', 'Client dashboard and navigation bar', 'YNqdWeYaPdXMkKs95aYmxS', [
   ('Dashboard (welcome card, up next, week, numbers, nutrition, log, check-in)', ['src/client-app/home/TrainingHomeScreen.jsx', 'src/client-app/home/homeScreenPieces.jsx', 'src/client-app/home/TopBannerCard.jsx', 'src/client-app/home/TodayStatsCards.jsx', 'src/client-app/home/homeLooks.js', 'src/for-both/home-cards/DailyQuoteCard.js', 'src/daily-stats/dailyQuotes.json']),
   ('My trainer sheet, Write a review', ['src/client-app/home/MyTrainerCard.jsx', 'src/client-app/home/WriteTrainerReviewPopup.js']),
   ('Navigation bar (+ sheet, AI layout)', ['src/navigation/BottomMenuBar.js', 'src/client-app/navigation/ClientBottomMenu.jsx', 'src/client-app/navigation/ClientMainScreen.jsx'])]),
 ('trainer-home.html', 'Trainer home', '24Eg1VDksjStyLrHp9EVkj', [
   ('Home, tabs, tools, weekly report', ['src/trainer-app/home/TrainerHomeContent.jsx', 'src/trainer-app/home/trainerHomePieces.jsx', 'src/trainer-app/weekly-report/TrainerWeeklyReportSection.jsx']),
   ('Needs you, payout sheet', ['src/trainer-app/home/TrainerHomeContent.jsx', 'src/login-and-signup/TrainerPayoutSetupStep.jsx']),
   ('New requests', ['src/trainer-app/new-requests/NewTraineeRequestsScreen.jsx']),
   ('Money, Edit rate', ['src/trainer-app/earnings/EarningsScreen.jsx']),
   ('Navigation', ['src/trainer-app/navigation/TrainerMainScreen.jsx', 'src/navigation/BottomMenuBar.js'])]),
 ('ai-coach.html', 'AI coach', '7iwCfRSsTBbHZna2mTNnk9', [
   ('Coach home', ['src/ai-coach/home-screen/CoachHomeScreen.jsx', 'src/ai-coach/conversation/suggestedQuestions.js']),
   ('Conversation, web answer, photos, paste', ['src/ai-coach/conversation/CoachConversationScreen.jsx', 'src/ai-coach/conversation/SourceLinkCards.jsx', 'src/ai-coach/conversation/PasteTextPopup.jsx', 'src/ai-coach/conversation/openPhotoMenu.js', 'src/ai-coach/reply-display']),
   ('Past chats drawer, delete', ['src/ai-coach/past-chats/PastChatsPanel.jsx'])]),
 ('ai-coach-popups.html', 'AI coach popups (15)', 'VY2ZjYCSGiju4dj2qKsntU', [
   ('Log meal, mood, sleep, steps, water, rate energy, rate workout, edit workout, open plan, rest day, goal, food targets, book session, message trainer, delete',
    ['src/ai-coach/confirm-popups', 'src/ai-coach/conversation/ConfirmActionPopup.jsx', 'src/ai-coach/coach-actions'])]),
 ('workouts.html', 'Workouts', '4TiqSzAvhMGaLtzxgkU16H', [
   ('My plan, plan notes, videos', ['src/client-app/workout-plans/MyWorkoutPlanScreen.jsx', 'src/workouts/view-plan', 'src/workouts/exercise-videos']),
   ('Session mode (new, no existing screen)', ['src/workouts/exercise-rows']),
   ('New plan, building', ['src/workouts/create-plan/GenerateMyWorkoutPlanScreen.jsx', 'src/workouts/create-plan/CreateWorkoutPlanScreen.js']),
   ('Saved plans', ['src/for-both/workout-plans/SavedWorkoutsScreen.jsx']),
   ('Trainer builder, library, edit exercise', ['src/trainer-app/workout-plans/ManualWorkoutPlanBuilderScreen.jsx', 'src/trainer-app/workout-plans/builtInExerciseList.js', 'src/workouts/create-plan/EditWorkoutPopup.jsx'])]),
 ('nutrition.html', 'Nutrition', 'Xt9uVdikL32NbQcGCRmUtN', [
   ('Daily log', ['src/nutrition/daily-log', 'src/client-app/meals/LogTodaysMealsScreen.jsx']),
   ('Food search and basket, no matches', ['src/nutrition/food-search']),
   ('Barcode', ['src/nutrition/barcode']),
   ('Nutrition facts, edit serving', ['src/nutrition/food-details']),
   ('Quick add', ['src/nutrition/quick-add/QuickAddNutrition.jsx']),
   ('Targets, settings, reset', ['src/nutrition/targets'])]),
 ('progress.html', 'Progress', 'ArwYbvTE6Bq9m6F9kfBxrz', [
   ('Progress charts', ['src/client-app/home/TrainingHomeScreen.jsx']),
   ('Photos, viewer, compare', ['src/for-both/photo-gallery/MyProgressPhotosScreen.jsx']),
   ('Weekly report', ['src/for-both/weekly-report']),
   ('Spreadsheet viewer', ['src/for-both/files-and-notes/viewers/SpreadsheetViewer.js', 'src/spreadsheet-support'])]),
 ('settings-and-profile.html', 'Settings and profile', 'GsHyifEV6sp9HdFPNk5cbY', [
   ('Settings (client, trainer), coaching payment', ['src/settings/SettingsScreen.js']),
   ('Edit profile', ['src/client-app/profile/MyProfileScreen.jsx']),
   ('FAQ, Contact, Bug report, Terms, Privacy', ['src/settings/HelpFAQScreen.jsx', 'src/settings/ContactSupportScreen.jsx', 'src/settings/BugReportScreen.jsx', 'src/settings/TermsOfServiceScreen.jsx', 'src/settings/PrivacyPolicyScreen.jsx']),
   ('Delete account hold to confirm', ['src/for-both/popups/HoldToConfirmPopup.jsx', 'src/logout-cleanup/clearDataOnLogout.js']),
   ('Blocked users, report or block', ['src/block-and-report']),
   ('Remove trainer', ['src/for-both/popups/RemoveTrainerPopup.js'])]),
 ('inbox-and-money.html', 'Messages, notifications, Pro plan', 'MiRPaVpP9wH5pRFvWKvBPp', [
   ('Inbox (trainer, client), chat, attach, blocked', ['src/messaging/InboxScreen.jsx', 'src/messaging/ChatScreen.jsx']),
   ('Notifications', ['src/notifications/manageAlerts.js', 'src/notifications/writeAlertText.js', 'src/for-both/online-connection/loadHomeAlerts.js']),
   ('Free trial banner, offer, upgrade, expired', ['src/trainer-pro-plan/FreeTrialBanner.jsx', 'src/trainer-pro-plan/ProUpgradeOffer.jsx', 'src/trainer-pro-plan/ProUpgradeScreen.jsx', 'src/trainer-pro-plan/ProExpiredScreen.jsx', 'src/trainer-pro-plan/ProLegalFooter.jsx'])]),
 ('files-and-notes.html', 'Files and notes', 'GdMY6NbwNbba7fCocG1WSp', [
   ('Your Notes & Files, add, viewer, delete', ['src/client-app/files-and-notes', 'src/for-both/files-and-notes/viewers', 'src/for-both/home-cards/FilesHeaderCard.jsx']),
   ('Client files (trainer)', ['src/client-app/files-and-notes/TrainerSharedFilesPopup.jsx']),
   ('Document editor, share', ['src/trainer-app/documents/DocumentEditor.js', 'src/trainer-app/documents/ShareDocumentPopup.js', 'src/trainer-app/documents/pageStylePresets.js'])]),
 ('scheduling.html', 'Scheduling', 'BRcVMsPRBAKwFdfwy3aRo5', [
   ('Calendar, month, list, new session, detail, delete', ['src/trainer-app/scheduling/CalendarTab.jsx', 'src/trainer-app/scheduling/MonthCalendar.jsx', 'src/trainer-app/scheduling/ScheduleSessionScreen.jsx', 'src/trainer-app/scheduling/SessionCard.jsx', 'src/trainer-app/scheduling/SharedSessionList.jsx']),
   ('Client sessions, request', ['src/trainer-app/scheduling/BookSessionScreen.jsx', 'src/for-both/home-cards/UpcomingSessionCard.jsx'])]),
 ('trainees-and-records.html', 'Trainees and records', '91KSGCs9XFm1QSRV8er14B', [
   ('Clients roster', ['src/trainer-app/my-trainees/MyTraineesScreen.jsx']),
   ('Client record tabs, remove', ['src/trainer-app/trainee-detail/ManageTraineeScreen.jsx', 'src/trainer-app/progress-tab', 'src/trainer-app/nutrition-tab/TrainerNutritionTab.jsx']),
   ('Weekly report (trainer)', ['src/trainer-app/weekly-report'])]),
 ('loading-and-errors.html', 'Loading and errors', 'RUc3CcX8vu7MMZ9GBZi2iE', [
   ('Startup, skeletons, loaders', ['src/for-both/loading-and-header', 'src/app-start']),
   ('Crash', ['src/crash-reports/CrashCatcher.jsx']),
   ('Errors, offline', ['src/for-both/popups/ErrorPopup.jsx', 'src/for-both/online-connection/checkConnectionHealth.js']),
   ('Sign out', ['src/logout-cleanup/clearDataOnLogout.js', 'src/settings/SettingsScreen.js'])]),
 ('marketplace-new.html', 'Find a trainer', 'PPia372geK6qZcEVWoYK7K', [
   ('List, filters, no results', ['src/client-app/find-a-trainer/BrowseTrainersScreen.jsx', 'src/client-app/find-a-trainer/SearchTrainersScreen.jsx', 'src/client-app/find-a-trainer/FilterPopup.js', 'src/client-app/find-a-trainer/trainerFilters.js', 'src/client-app/find-a-trainer/TrainerCard.jsx']),
   ('Profile, request, confirm, sent', ['src/client-app/find-a-trainer/TrainerProfilePopup.jsx', 'src/client-app/find-a-trainer/RequestIntroPopup.jsx', 'src/client-app/find-a-trainer/ConfirmRequestPopup.jsx', 'src/client-app/find-a-trainer/sendConnectionRequest.js']),
   ('Entry banner', ['src/for-both/home-cards/FindTrainerBanner.jsx']),
   ('Map view', [])]),
 ('missing-screens.html', 'Gap screens', 'T7VrMSDiqUgKzjgNHWHLHe', [
   ('Choose role', ['src/login-and-signup/decideTraineeOrTrainer.js', 'src/login-and-signup/NewUserSetupScreen.jsx']),
   ('Log workout, daily check-in, mood', ['src/client-app/home/TrainingHomeScreen.jsx', 'src/ai-coach/confirm-popups/LogMoodPopup.jsx']),
   ('Weekly Momentum', ['src/nutrition/daily-log/DailyFoodLogScreen.jsx', 'src/client-app/meals/LogTodaysMealsScreen.jsx']),
   ('Spreadsheet editor', ['src/trainer-app/documents/SpreadsheetEditor.js', 'src/trainer-app/documents/spreadsheet-grid']),
   ('Trainer AI coach', ['src/ai-coach/home-screen/CoachHomeScreen.jsx', 'src/ai-coach/conversation/suggestedQuestions.js'])]),
 ('empty-vs-data.html', 'Empty versus filled', 'GTeySwdqBNjGKYYU785Psa', [
   ('Dashboard, trainer home, plan, coach home (empty states)', ['src/client-app/home/TrainingHomeScreen.jsx', 'src/trainer-app/home/TrainerHomeContent.jsx', 'src/workouts/view-plan/WorkoutPlanView.jsx', 'src/ai-coach/home-screen/CoachHomeScreen.jsx'])]),
]

def exists(p):
    full = os.path.join(REPO, p)
    return os.path.exists(full) or bool(glob.glob(full))

lines = ['# Mockup to code map', '',
 'Each mockup page is listed with the repo files that implement the matching screens today. Paths are relative to the repo root.',
 'A path marked MISSING was guessed from a folder name and does not exist: find the real file before editing. A screen with no files is new (no existing screen).',
 '', 'This map comes from reading folders and screen text in the repo, not from reading every file in full. Treat it as a starting point and confirm in the code.', '']
missing = []
for f, title, art, rows in M:
    lines += ['## %s' % title, '', 'Mockup file: `mockups/%s`  ·  Artifact id: `%s`' % (f, art), '', '| Mockup screens | Existing code to change |', '|---|---|']
    for scr, paths in rows:
        if not paths:
            cell = 'New: no matching screen found in the repo'
        else:
            cell = '<br>'.join('`%s`%s' % (p, '' if exists(p) else ' **MISSING**') for p in paths)
            missing += [p for p in paths if not exists(p)]
        lines.append('| %s | %s |' % (scr, cell))
    lines.append('')
lines += ['## Shared pieces the mockups use everywhere', '',
 '| Piece | Where it lives today |', '|---|---|',
 '| Bottom bar | `src/navigation/BottomMenuBar.js` |', '| Theme colors | `src/look-and-feel` |', '| Icons | `src/assets/icons`, `src/for-both/icons` |', '| Lottie files | `src/assets/animations` |', '| Header and loading | `src/for-both/loading-and-header` |']
for p in ['src/look-and-feel', 'src/for-both/icons', 'src/assets/animations']:
    if not exists(p):
        missing.append(p)
open(os.path.join(OUT, 'MAPPING.md'), 'w').write('\n'.join(lines))
print('written; missing paths:', sorted(set(missing)))
