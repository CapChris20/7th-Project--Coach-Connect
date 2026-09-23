#!/usr/bin/env node
/**
 * Apply Chris's plain-English rename plan (whole src/).
 *
 *   node scripts/applyPlainEnglishRename.mjs --dry-run
 *   node scripts/applyPlainEnglishRename.mjs --apply
 *   node scripts/applyPlainEnglishRename.mjs --apply --batch=ai-coach
 *
 * Batches: ai-coach | auth-start | client-app | trainer-app | for-both |
 *          nutrition | workouts | rest | stubs | all
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const APPLY = process.argv.includes('--apply');
const SKIP_STUBS = process.argv.includes('--skip-stubs');
const batchArg = process.argv.find((a) => a.startsWith('--batch='));
const BATCH = batchArg ? batchArg.split('=')[1] : 'all';

/** @type {Record<string, [string, string][]>} oldRel → newRel under src/ */
const BATCHES = {
  'ai-coach': [
    // home
    ['ai-coach/home-screen/CoachHomeScreen.jsx', 'ai-coach/home-screen/CoachHomeScreen.jsx'],
    // conversation
    ['ai-coach/conversation/CoachConversationScreen.jsx', 'ai-coach/conversation/CoachConversationScreen.jsx'],
    ['ai-coach/conversation/PasteTextPopup.jsx', 'ai-coach/conversation/PasteTextPopup.jsx'],
    ['ai-coach/conversation/SourceLinkCards.jsx', 'ai-coach/conversation/SourceLinkCards.jsx'],
    ['ai-coach/conversation/ConfirmActionPopup.jsx', 'ai-coach/conversation/ConfirmActionPopup.jsx'],
    ['ai-coach/conversation/copyReplyText.js', 'ai-coach/conversation/copyReplyText.js'],
    ['ai-coach/conversation/suggestedQuestions.js', 'ai-coach/conversation/suggestedQuestions.js'],
    ['ai-coach/conversation/openPhotoMenu.js', 'ai-coach/conversation/openPhotoMenu.js'],
    ['ai-coach/conversation/choosePhoto.js', 'ai-coach/conversation/choosePhoto.js'],
    ['ai-coach/conversation/sourceLinkPreview.js', 'ai-coach/conversation/sourceLinkPreview.js'],
    ['ai-coach/conversation/typingBox.js', 'ai-coach/conversation/typingBox.js'],
    ['ai-coach/conversation/keyboardBehavior.js', 'ai-coach/conversation/keyboardBehavior.js'],
    ['ai-coach/conversation/sendMessageToCoach.js', 'ai-coach/conversation/sendMessageToCoach.js'],
    ['ai-coach/conversation/preparePhotosToSend.js', 'ai-coach/conversation/preparePhotosToSend.js'],
    ['ai-coach/conversation/photoPermissions.js', 'ai-coach/conversation/photoPermissions.js'],
    // confirm-popups
    ['ai-coach/confirm-popups/ChangeFoodTargetsPopup.jsx', 'ai-coach/confirm-popups/ChangeFoodTargetsPopup.jsx'],
    ['ai-coach/confirm-popups/BookSessionPopup.jsx', 'ai-coach/confirm-popups/BookSessionPopup.jsx'],
    ['ai-coach/confirm-popups/ConfirmDeletePopup.jsx', 'ai-coach/confirm-popups/ConfirmDeletePopup.jsx'],
    ['ai-coach/confirm-popups/LogStepsPopup.jsx', 'ai-coach/confirm-popups/LogStepsPopup.jsx'],
    ['ai-coach/confirm-popups/LogMealPopup.jsx', 'ai-coach/confirm-popups/LogMealPopup.jsx'],
    ['ai-coach/confirm-popups/LogMoodPopup.jsx', 'ai-coach/confirm-popups/LogMoodPopup.jsx'],
    ['ai-coach/confirm-popups/MarkRestDayPopup.jsx', 'ai-coach/confirm-popups/MarkRestDayPopup.jsx'],
    ['ai-coach/confirm-popups/LogSleepPopup.jsx', 'ai-coach/confirm-popups/LogSleepPopup.jsx'],
    ['ai-coach/confirm-popups/LogWaterPopup.jsx', 'ai-coach/confirm-popups/LogWaterPopup.jsx'],
    ['ai-coach/confirm-popups/OpenWorkoutPlanPopup.jsx', 'ai-coach/confirm-popups/OpenWorkoutPlanPopup.jsx'],
    ['ai-coach/confirm-popups/RateEnergyPopup.jsx', 'ai-coach/confirm-popups/RateEnergyPopup.jsx'],
    ['ai-coach/confirm-popups/RateWorkoutPopup.jsx', 'ai-coach/confirm-popups/RateWorkoutPopup.jsx'],
    ['ai-coach/confirm-popups/MessageTrainerPopup.jsx', 'ai-coach/confirm-popups/MessageTrainerPopup.jsx'],
    ['ai-coach/confirm-popups/UpdateGoalPopup.jsx', 'ai-coach/confirm-popups/UpdateGoalPopup.jsx'],
    ['ai-coach/confirm-popups/EditWorkoutPopup.jsx', 'ai-coach/confirm-popups/EditWorkoutPopup.jsx'],
    ['ai-coach/confirm-popups/sharedPopupParts.js', 'ai-coach/confirm-popups/sharedPopupParts.js'],
    // reply-display
    ['ai-coach/reply-display/CoachGlassCard.jsx', 'ai-coach/reply-display/CoachGlassCard.jsx'],
    ['ai-coach/reply-display/SuggestedQuestionChips.jsx', 'ai-coach/reply-display/SuggestedQuestionChips.jsx'],
    ['ai-coach/reply-display/CoachReplyText.jsx', 'ai-coach/reply-display/CoachReplyText.jsx'],
    ['ai-coach/reply-display/InternetAnswerReply.jsx', 'ai-coach/reply-display/InternetAnswerReply.jsx'],
    ['ai-coach/reply-display/replyTextStyles.js', 'ai-coach/reply-display/replyTextStyles.js'],
    ['ai-coach/reply-display/copyableReplyText.js', 'ai-coach/reply-display/copyableReplyText.js'],
    ['ai-coach/reply-display/splitInternetAnswer.js', 'ai-coach/reply-display/splitInternetAnswer.js'],
    ['ai-coach/reply-display/suggestedQuestionMaker.js', 'ai-coach/reply-display/suggestedQuestionMaker.js'],
    ['ai-coach/reply-display/developerChatLog.js', 'ai-coach/reply-display/developerChatLog.js'],
    ['ai-coach/coachColors.js', 'ai-coach/coachColors.js'],
    // past-chats
    ['ai-coach/past-chats/saveAndLoadChats.js', 'ai-coach/past-chats/saveAndLoadChats.js'],
    ['ai-coach/past-chats/PastChatsPanel.jsx', 'ai-coach/past-chats/PastChatsPanel.jsx'],
    ['ai-coach/past-chats/chatHistoryList.js', 'ai-coach/past-chats/chatHistoryList.js'],
    ['ai-coach/past-chats/savedChatShape.js', 'ai-coach/past-chats/savedChatShape.js'],
    ['ai-coach/past-chats/chatTitles.js', 'ai-coach/past-chats/chatTitles.js'],
    ['ai-coach/past-chats/makeChatTitle.js', 'ai-coach/past-chats/makeChatTitle.js'],
    ['ai-coach/past-chats/fixOldChatTitles.js', 'ai-coach/past-chats/fixOldChatTitles.js'],
    ['ai-coach/past-chats/loadOlderChats.js', 'ai-coach/past-chats/loadOlderChats.js'],
    // coach-actions
    ['ai-coach/coach-actions/popupOrAutoRun.js', 'ai-coach/coach-actions/popupOrAutoRun.js'],
    ['ai-coach/coach-actions/cleanUpActionDetails.js', 'ai-coach/coach-actions/cleanUpActionDetails.js'],
    ['ai-coach/coach-actions/spotDeleteRequests.js', 'ai-coach/coach-actions/spotDeleteRequests.js'],
    ['ai-coach/coach-actions/findActionsInReply.js', 'ai-coach/coach-actions/findActionsInReply.js'],
    ['ai-coach/coach-actions/carryOutAction.js', 'ai-coach/coach-actions/carryOutAction.js'],
    ['ai-coach/coach-actions/shouldAskFirst.js', 'ai-coach/coach-actions/shouldAskFirst.js'],
    ['ai-coach/coach-actions/readActionsFromReply.js', 'ai-coach/coach-actions/readActionsFromReply.js'],
    ['ai-coach/coach-actions/alertTrainer.js', 'ai-coach/coach-actions/alertTrainer.js'],
    // coach-knowledge
    ['ai-coach/coach-knowledge/decideWhatCoachShouldKnow.js', 'ai-coach/coach-knowledge/decideWhatCoachShouldKnow.js'],
    ['ai-coach/coach-knowledge/loadYourWeekForCoach.js', 'ai-coach/coach-knowledge/loadYourWeekForCoach.js'],
    ['ai-coach/coach-knowledge/loadWeeklyNumbers.js', 'ai-coach/coach-knowledge/loadWeeklyNumbers.js'],
    // internet-lookup
    ['ai-coach/internet-lookup/internetLookupRules.js', 'ai-coach/internet-lookup/internetLookupRules.js'],
    ['ai-coach/internet-lookup/shouldLookUpOnInternet.js', 'ai-coach/internet-lookup/shouldLookUpOnInternet.js'],
    // moves out
    ['nutrition/targets/recalculateFoodTargets.js', 'nutrition/targets/recalculateFoodTargets.js'],
    ['messaging/markMessagesRead.js', 'messaging/markMessagesRead.js'],
    ['ai-coach/CoachSelfTest.jsx', 'ai-coach/CoachSelfTest.jsx'],
  ],

  'auth-start': [
    ['app-start/LoginGate.js', 'app-start/LoginGate.js'],
    ['app-start/ClientAppStart.js', 'app-start/ClientAppStart.js'],
    ['app-start/TrainerAppStart.js', 'app-start/TrainerAppStart.js'],
    ['app-start/cloudConnection.js', 'app-start/cloudConnection.js'],
    ['login-and-signup/LoginScreen.js', 'login-and-signup/LoginScreen.js'],
    ['login-and-signup/NewUserSetupScreen.jsx', 'login-and-signup/NewUserSetupScreen.jsx'],
    ['login-and-signup/SetupPreviewScreen.jsx', 'login-and-signup/SetupPreviewScreen.jsx'],
    ['login-and-signup/SetupScreenshotTool.jsx', 'login-and-signup/SetupScreenshotTool.jsx'],
    ['login-and-signup/setupScreenshotList.json', 'login-and-signup/setupScreenshotList.json'],
    ['login-and-signup/signOutCleanupSteps.js', 'login-and-signup/signOutCleanupSteps.js'],
    ['login-and-signup/decideTraineeOrTrainer.js', 'login-and-signup/decideTraineeOrTrainer.js'],
    ['login-and-signup/finishSetup.js', 'login-and-signup/finishSetup.js'],
    ['login-and-signup/cleanUpRoleName.js', 'login-and-signup/cleanUpRoleName.js'],
    ['login-and-signup/checkTrainerCode.js', 'login-and-signup/checkTrainerCode.js'],
    ['login-and-signup/resetPasswordByEmail.js', 'login-and-signup/resetPasswordByEmail.js'],
    ['login-and-signup/ForgotPasswordFlow.js', 'login-and-signup/ForgotPasswordFlow.js'],
    ['login-and-signup/TrainerPayoutSetupStep.jsx', 'login-and-signup/TrainerPayoutSetupStep.jsx'],
    ['crash-reports/reportCrashAutomatically.js', 'crash-reports/reportCrashAutomatically.js'],
    ['crash-reports/recordError.js', 'crash-reports/recordError.js'],
    ['crash-reports/sendSavedErrors.js', 'crash-reports/sendSavedErrors.js'],
    ['crash-reports/CrashCatcher.jsx', 'crash-reports/CrashCatcher.jsx'],
  ],

  'client-app': [
    ['client-app/home/TopBannerCard.jsx', 'client-app/home/TopBannerCard.jsx'],
    ['client-app/home/TodayStatsCards.jsx', 'client-app/home/TodayStatsCards.jsx'],
    ['client-app/home/MyTrainerCard.jsx', 'client-app/home/MyTrainerCard.jsx'],
    ['client-app/home/WriteTrainerReviewPopup.js', 'client-app/home/WriteTrainerReviewPopup.js'],
    ['client-app/home/TrainingHomeScreen.jsx', 'client-app/home/TrainingHomeScreen.jsx'],
    ['client-app/home/workoutDiary.js', 'client-app/home/workoutDiary.js'],
    ['client-app/home/homeLooks.js', 'client-app/home/homeLooks.js'],
    ['client-app/home/homeScreenPieces.jsx', 'client-app/home/homeScreenPieces.jsx'],
    ['client-app/home/loadHomeScreenData.js', 'client-app/home/loadHomeScreenData.js'],
    ['client-app/home/keepDailyStatsFresh.js', 'client-app/home/keepDailyStatsFresh.js'],
    ['client-app/files-and-notes/FilesScreen.jsx', 'client-app/files-and-notes/FilesScreen.jsx'],
    ['client-app/files-and-notes/FileCard.jsx', 'client-app/files-and-notes/FileCard.jsx'],
    ['client-app/files-and-notes/MyFilesSection.jsx', 'client-app/files-and-notes/MyFilesSection.jsx'],
    ['client-app/files-and-notes/NotesFromTrainerSection.jsx', 'client-app/files-and-notes/NotesFromTrainerSection.jsx'],
    ['client-app/files-and-notes/TrainerSharedFilesPopup.jsx', 'client-app/files-and-notes/TrainerSharedFilesPopup.jsx'],
    ['client-app/files-and-notes/SharedByTrainerSection.jsx', 'client-app/files-and-notes/SharedByTrainerSection.jsx'],
    ['client-app/find-a-trainer/BrowseTrainersScreen.jsx', 'client-app/find-a-trainer/BrowseTrainersScreen.jsx'],
    ['client-app/find-a-trainer/SearchTrainersScreen.jsx', 'client-app/find-a-trainer/SearchTrainersScreen.jsx'],
    ['client-app/find-a-trainer/TrainerCard.jsx', 'client-app/find-a-trainer/TrainerCard.jsx'],
    ['client-app/find-a-trainer/FilterPopup.js', 'client-app/find-a-trainer/FilterPopup.js'],
    ['client-app/find-a-trainer/FrostedPanel.jsx', 'client-app/find-a-trainer/FrostedPanel.jsx'],
    ['client-app/find-a-trainer/TrainerProfilePopup.jsx', 'client-app/find-a-trainer/TrainerProfilePopup.jsx'],
    ['client-app/find-a-trainer/FindTrainerPieces.jsx', 'client-app/find-a-trainer/FindTrainerPieces.jsx'],
    ['client-app/find-a-trainer/ConfirmRequestPopup.jsx', 'client-app/find-a-trainer/ConfirmRequestPopup.jsx'],
    ['client-app/find-a-trainer/RequestIntroPopup.jsx', 'client-app/find-a-trainer/RequestIntroPopup.jsx'],
    ['client-app/find-a-trainer/trainerFilters.js', 'client-app/find-a-trainer/trainerFilters.js'],
    ['client-app/find-a-trainer/sendConnectionRequest.js', 'client-app/find-a-trainer/sendConnectionRequest.js'],
    ['client-app/meals/LogTodaysMealsScreen.jsx', 'client-app/meals/LogTodaysMealsScreen.jsx'],
    ['client-app/profile/MyProfileScreen.jsx', 'client-app/profile/MyProfileScreen.jsx'],
    ['client-app/workout-plans/MyWorkoutPlanScreen.jsx', 'client-app/workout-plans/MyWorkoutPlanScreen.jsx'],
    ['client-app/navigation/ClientOpenScreenTracker.jsx', 'client-app/navigation/ClientOpenScreenTracker.jsx'],
    ['client-app/navigation/ClientScreenList.jsx', 'client-app/navigation/ClientScreenList.jsx'],
    ['client-app/navigation/ClientBottomMenu.jsx', 'client-app/navigation/ClientBottomMenu.jsx'],
    ['client-app/navigation/clientExtraScreens.jsx', 'client-app/navigation/clientExtraScreens.jsx'],
    ['client-app/navigation/goToClientScreen.js', 'client-app/navigation/goToClientScreen.js'],
  ],

  'trainer-app': [
    ['trainer-app/scheduling/CalendarTab.jsx', 'trainer-app/scheduling/CalendarTab.jsx'],
    ['trainer-app/scheduling/WheelPicker.jsx', 'trainer-app/scheduling/WheelPicker.jsx'],
    ['trainer-app/scheduling/MonthCalendar.jsx', 'trainer-app/scheduling/MonthCalendar.jsx'],
    ['trainer-app/scheduling/SessionCard.jsx', 'trainer-app/scheduling/SessionCard.jsx'],
    ['trainer-app/scheduling/ScheduleSessionScreen.jsx', 'trainer-app/scheduling/ScheduleSessionScreen.jsx'],
    ['trainer-app/scheduling/SessionTimePicker.jsx', 'trainer-app/scheduling/SessionTimePicker.jsx'],
    ['trainer-app/scheduling/BookSessionScreen.jsx', 'trainer-app/scheduling/BookSessionScreen.jsx'],
    ['trainer-app/scheduling/alertTraineeOfSession.js', 'trainer-app/scheduling/alertTraineeOfSession.js'],
    ['trainer-app/scheduling/schedulingColors.js', 'trainer-app/scheduling/schedulingColors.js'],
    ['trainer-app/scheduling/SharedSessionList.jsx', 'trainer-app/scheduling/SharedSessionList.jsx'],
    ['trainer-app/scheduling/mySessions.js', 'trainer-app/scheduling/mySessions.js'],
    ['trainer-app/trainee-detail/ManageTraineeScreen.jsx', 'trainer-app/trainee-detail/ManageTraineeScreen.jsx'],
    ['trainer-app/trainee-records/getTraineeDisplayName.js', 'trainer-app/trainee-records/getTraineeDisplayName.js'],
    ['trainer-app/trainee-records/loadMyLinkedTrainees.js', 'trainer-app/trainee-records/loadMyLinkedTrainees.js'],
    ['trainer-app/trainee-records/traineeDatabaseLocations.js', 'trainer-app/trainee-records/traineeDatabaseLocations.js'],
    ['trainer-app/trainee-records/calmDatabaseErrors.js', 'trainer-app/trainee-records/calmDatabaseErrors.js'],
    ['trainer-app/new-requests/NewTraineeRequestsScreen.jsx', 'trainer-app/new-requests/NewTraineeRequestsScreen.jsx'],
    ['trainer-app/new-requests/loadPendingTraineeRequests.js', 'trainer-app/new-requests/loadPendingTraineeRequests.js'],
    ['trainer-app/new-requests/pendingRequestCount.js', 'trainer-app/new-requests/pendingRequestCount.js'],
    ['trainer-app/my-trainees/MyTraineesScreen.jsx', 'trainer-app/my-trainees/MyTraineesScreen.jsx'],
    ['trainer-app/my-trainees/traineeList.js', 'trainer-app/my-trainees/traineeList.js'],
    ['trainer-app/my-trainees/pagedTraineeList.js', 'trainer-app/my-trainees/pagedTraineeList.js'],
    ['trainer-app/home/TrainerHomeContent.jsx', 'trainer-app/home/TrainerHomeContent.jsx'],
    ['trainer-app/home/TrainerListingPopup.js', 'trainer-app/home/TrainerListingPopup.js'],
    ['trainer-app/home/trainerHomePieces.jsx', 'trainer-app/home/trainerHomePieces.jsx'],
    ['trainer-app/earnings/EarningsScreen.jsx', 'trainer-app/earnings/EarningsScreen.jsx'],
    ['trainer-app/progress-tab/ProgressTopCard.jsx', 'trainer-app/progress-tab/ProgressTopCard.jsx'],
    ['trainer-app/progress-tab/pickWeightToShow.js', 'trainer-app/progress-tab/pickWeightToShow.js'],
    ['trainer-app/weekly-report/WeeklyReportBanner.jsx', 'trainer-app/weekly-report/WeeklyReportBanner.jsx'],
    ['trainer-app/weekly-report/WeeklyReportBars.jsx', 'trainer-app/weekly-report/WeeklyReportBars.jsx'],
    ['trainer-app/workout-plans/builtInExerciseList.js', 'trainer-app/workout-plans/builtInExerciseList.js'],
    ['trainer-app/workout-plans/manualPlanToWorkoutPlan.js', 'trainer-app/workout-plans/manualPlanToWorkoutPlan.js'],
    ['trainer-app/navigation/TrainerOpenScreenTracker.jsx', 'trainer-app/navigation/TrainerOpenScreenTracker.jsx'],
    ['trainer-app/navigation/TrainerScreenList.jsx', 'trainer-app/navigation/TrainerScreenList.jsx'],
    ['trainer-app/navigation/trainerExtraScreens.jsx', 'trainer-app/navigation/trainerExtraScreens.jsx'],
    ['trainer-app/navigation/goToTrainerScreen.js', 'trainer-app/navigation/goToTrainerScreen.js'],
    ['trainer-app/documents/DocumentEditor.js', 'trainer-app/documents/DocumentEditor.js'],
    ['trainer-app/documents/EditorTopButtons.jsx', 'trainer-app/documents/EditorTopButtons.jsx'],
    ['trainer-app/documents/SaveStatusLabel.js', 'trainer-app/documents/SaveStatusLabel.js'],
    ['trainer-app/documents/ShareDocumentPopup.js', 'trainer-app/documents/ShareDocumentPopup.js'],
    ['trainer-app/documents/SpreadsheetEditor.js', 'trainer-app/documents/SpreadsheetEditor.js'],
    ['trainer-app/documents/exportDocument.js', 'trainer-app/documents/exportDocument.js'],
    ['trainer-app/documents/pageStylePresets.js', 'trainer-app/documents/pageStylePresets.js'],
    ['trainer-app/documents/editorColors.js', 'trainer-app/documents/editorColors.js'],
    ['trainer-app/documents/readingLevel.js', 'trainer-app/documents/readingLevel.js'],
    ['trainer-app/documents/documentEditorTools.js', 'trainer-app/documents/documentEditorTools.js'],
    ['trainer-app/documents/spreadsheet-grid/SlideUpMenu.jsx', 'trainer-app/documents/spreadsheet-grid/SlideUpMenu.jsx'],
    ['trainer-app/documents/spreadsheet-grid/FormulaBar.jsx', 'trainer-app/documents/spreadsheet-grid/FormulaBar.jsx'],
    ['trainer-app/documents/spreadsheet-grid/SpreadsheetGrid.jsx', 'trainer-app/documents/spreadsheet-grid/SpreadsheetGrid.jsx'],
    ['trainer-app/documents/spreadsheet-grid/SpreadsheetGridRow.jsx', 'trainer-app/documents/spreadsheet-grid/SpreadsheetGridRow.jsx'],
    ['trainer-app/documents/spreadsheet-grid/prepareCellText.js', 'trainer-app/documents/spreadsheet-grid/prepareCellText.js'],
    ['trainer-app/documents/spreadsheet-grid/cellFormatting.js', 'trainer-app/documents/spreadsheet-grid/cellFormatting.js'],
    ['trainer-app/documents/spreadsheet-grid/formulaCalculator.js', 'trainer-app/documents/spreadsheet-grid/formulaCalculator.js'],
    ['trainer-app/documents/spreadsheet-grid/columnWidths.js', 'trainer-app/documents/spreadsheet-grid/columnWidths.js'],
    ['trainer-app/documents/spreadsheet-grid/saveAndLoadSheet.js', 'trainer-app/documents/spreadsheet-grid/saveAndLoadSheet.js'],
    ['trainer-app/documents/spreadsheet-grid/spreadsheetConstants.js', 'trainer-app/documents/spreadsheet-grid/spreadsheetConstants.js'],
  ],

  'for-both': [
    ['for-both/online-connection/sendOnlineRequest.js', 'for-both/online-connection/sendOnlineRequest.js'],
    ['for-both/online-connection/whereToConnect.js', 'for-both/online-connection/whereToConnect.js'],
    ['for-both/online-connection/loadHomeAlerts.js', 'for-both/online-connection/loadHomeAlerts.js'],
    ['for-both/online-connection/attachLoginProof.js', 'for-both/online-connection/attachLoginProof.js'],
    ['for-both/online-connection/sendCrashReport.js', 'for-both/online-connection/sendCrashReport.js'],
    ['for-both/online-connection/checkConnectionHealth.js', 'for-both/online-connection/checkConnectionHealth.js'],
    ['for-both/online-connection/sendPhoneAlert.js', 'for-both/online-connection/sendPhoneAlert.js'],
    ['for-both/online-connection/uploadSetupAnswers.js', 'for-both/online-connection/uploadSetupAnswers.js'],
    ['for-both/online-connection/linkTrainerAndTrainee.js', 'for-both/online-connection/linkTrainerAndTrainee.js'],
    ['for-both/online-connection/checkTrainerCertificate.js', 'for-both/online-connection/checkTrainerCertificate.js'],
    ['for-both/payments/chargeCard.js', 'for-both/payments/chargeCard.js'],
    ['for-both/payments/trainerPayoutSetup.js', 'for-both/payments/trainerPayoutSetup.js'],
    ['for-both/payments/PayTrainerPopup.jsx', 'for-both/payments/PayTrainerPopup.jsx'],
    ['for-both/payments/PayoutSetupReminderPopup.jsx', 'for-both/payments/PayoutSetupReminderPopup.jsx'],
    ['for-both/payments/CardPaymentWrapper.jsx', 'for-both/payments/CardPaymentWrapper.jsx'],
    ['for-both/payments/HowPaymentsWorkSections.jsx', 'for-both/payments/HowPaymentsWorkSections.jsx'],
    ['for-both/payments/TrainerPayoutSetupPopup.jsx', 'for-both/payments/TrainerPayoutSetupPopup.jsx'],
    ['for-both/payments/howPaymentsWorkText.js', 'for-both/payments/howPaymentsWorkText.js'],
    ['for-both/payments/whenToAskForPayoutSetup.js', 'for-both/payments/whenToAskForPayoutSetup.js'],
    ['for-both/payments/canThisPhoneTakeCards.js', 'for-both/payments/canThisPhoneTakeCards.js'],
    ['for-both/payments/traineePaymentHistory.js', 'for-both/payments/traineePaymentHistory.js'],
    ['for-both/payments/trainerPayoutSetupFlow.js', 'for-both/payments/trainerPayoutSetupFlow.js'],
    ['for-both/payments/trainerPaymentHistory.js', 'for-both/payments/trainerPaymentHistory.js'],
    ['for-both/home-cards/HomeTopBanner.jsx', 'for-both/home-cards/HomeTopBanner.jsx'],
    ['for-both/home-cards/CardGlow.jsx', 'for-both/home-cards/CardGlow.jsx'],
    ['for-both/home-cards/UpcomingSessionCard.jsx', 'for-both/home-cards/UpcomingSessionCard.jsx'],
    ['for-both/home-cards/DailyQuoteCard.js', 'for-both/home-cards/DailyQuoteCard.js'],
    ['for-both/home-cards/QuickActionCard.jsx', 'for-both/home-cards/QuickActionCard.jsx'],
    ['for-both/home-cards/FilesHeaderCard.jsx', 'for-both/home-cards/FilesHeaderCard.jsx'],
    ['for-both/home-cards/FindTrainerBanner.jsx', 'for-both/home-cards/FindTrainerBanner.jsx'],
    ['for-both/home-cards/SectionTitle.jsx', 'for-both/home-cards/SectionTitle.jsx'],
    ['for-both/icons/ColorfulIcon.jsx', 'for-both/icons/ColorfulIcon.jsx'],
    ['for-both/icons/OutlinedColorText.jsx', 'for-both/icons/OutlinedColorText.jsx'],
    ['for-both/icons/CalendarIcon.jsx', 'for-both/icons/CalendarIcon.jsx'],
    ['for-both/icons/ChatIcon.jsx', 'for-both/icons/ChatIcon.jsx'],
    ['for-both/icons/AICoachTabIcon.jsx', 'for-both/icons/AICoachTabIcon.jsx'],
    ['for-both/icons/WorkoutTabIcon.jsx', 'for-both/icons/WorkoutTabIcon.jsx'],
    ['for-both/icons/ProfileIcon.jsx', 'for-both/icons/ProfileIcon.jsx'],
    ['for-both/icons/iconShapes.js', 'for-both/icons/iconShapes.js'],
    ['for-both/icons/AppLogo.jsx', 'for-both/icons/AppLogo.jsx'],
    ['for-both/popups/ErrorPopup.jsx', 'for-both/popups/ErrorPopup.jsx'],
    ['for-both/popups/HoldToConfirmPopup.jsx', 'for-both/popups/HoldToConfirmPopup.jsx'],
    ['for-both/popups/RemoveTrainerPopup.js', 'for-both/popups/RemoveTrainerPopup.js'],
    ['for-both/setup-steps/AIPermissionStep.jsx', 'for-both/setup-steps/AIPermissionStep.jsx'],
    ['for-both/setup-steps/TrainerProOfferStep.jsx', 'for-both/setup-steps/TrainerProOfferStep.jsx'],
    ['for-both/setup-steps/setupStepPieces.jsx', 'for-both/setup-steps/setupStepPieces.jsx'],
    ['for-both/setup-steps/setupColors.js', 'for-both/setup-steps/setupColors.js'],
    ['for-both/loading-and-header/StartupLoadingCover.js', 'for-both/loading-and-header/StartupLoadingCover.js'],
    ['for-both/loading-and-header/TopHeader.js', 'for-both/loading-and-header/TopHeader.js'],
    ['for-both/loading-and-header/LoadingBarAnimation.jsx', 'for-both/loading-and-header/LoadingBarAnimation.jsx'],
    ['for-both/loading-and-header/AppLoadingScreen.js', 'for-both/loading-and-header/AppLoadingScreen.js'],
    ['for-both/loading-and-header/BouncingDots.js', 'for-both/loading-and-header/BouncingDots.js'],
    ['for-both/files-and-notes/saveNotesAndFiles.js', 'for-both/files-and-notes/saveNotesAndFiles.js'],
    ['for-both/files-and-notes/packSpreadsheetRows.js', 'for-both/files-and-notes/packSpreadsheetRows.js'],
    ['for-both/files-and-notes/viewers/AddFilePopup.js', 'for-both/files-and-notes/viewers/AddFilePopup.js'],
    ['for-both/files-and-notes/viewers/DocumentViewer.js', 'for-both/files-and-notes/viewers/DocumentViewer.js'],
    ['for-both/files-and-notes/viewers/WebPageViewer.jsx', 'for-both/files-and-notes/viewers/WebPageViewer.jsx'],
    ['for-both/files-and-notes/viewers/FileGrid.jsx', 'for-both/files-and-notes/viewers/FileGrid.jsx'],
    ['for-both/files-and-notes/viewers/FilesSection.jsx', 'for-both/files-and-notes/viewers/FilesSection.jsx'],
    ['for-both/files-and-notes/viewers/PhotoVideoViewer.jsx', 'for-both/files-and-notes/viewers/PhotoVideoViewer.jsx'],
    ['for-both/files-and-notes/viewers/PdfViewer.js', 'for-both/files-and-notes/viewers/PdfViewer.js'],
    ['for-both/files-and-notes/viewers/SpreadsheetViewer.js', 'for-both/files-and-notes/viewers/SpreadsheetViewer.js'],
    ['for-both/cloud-database/loadInPages.js', 'for-both/cloud-database/loadInPages.js'],
    ['for-both/cloud-database/uploadAndDownloadFiles.js', 'for-both/cloud-database/uploadAndDownloadFiles.js'],
    ['for-both/cloud-database/traineeProfileLocations.js', 'for-both/cloud-database/traineeProfileLocations.js'],
    ['for-both/cloud-database/loadMyProfile.js', 'for-both/cloud-database/loadMyProfile.js'],
    ['for-both/cloud-database/handleLiveUpdateErrors.js', 'for-both/cloud-database/handleLiveUpdateErrors.js'],
    ['for-both/app-wide-settings/AIPermission.js', 'for-both/app-wide-settings/AIPermission.js'],
    ['for-both/screenReaderLabels.js', 'for-both/screenReaderLabels.js'],
    ['for-both/calorieAndMacroMath.js', 'for-both/calorieAndMacroMath.js'],
    ['for-both/trainer-listing/keepTrainerListingUpdated.js', 'for-both/trainer-listing/keepTrainerListingUpdated.js'],
    ['for-both/trainerCity.js', 'for-both/trainerCity.js'],
    ['for-both/profileCardIconSizes.js', 'for-both/profileCardIconSizes.js'],
    ['for-both/whichProfileCardsToShow.js', 'for-both/whichProfileCardsToShow.js'],
    ['for-both/workout-plans/SavedWorkoutsScreen.jsx', 'for-both/workout-plans/SavedWorkoutsScreen.jsx'],
    ['for-both/photo-gallery/MyProgressPhotosScreen.jsx', 'for-both/photo-gallery/MyProgressPhotosScreen.jsx'],
    ['for-both/setup-icons/onboardingIconRegistry.js', 'for-both/setup-icons/onboardingIconRegistry.js'],
    ['for-both/setup-icons/onboardingIconRegistry.generated.js', 'for-both/setup-icons/onboardingIconRegistry.generated.js'],
    ['for-both/weekly-report/WeeklyReportScreen.jsx', 'for-both/weekly-report/WeeklyReportScreen.jsx'],
    ['for-both/weekly-report/WeeklyReportBody.jsx', 'for-both/weekly-report/WeeklyReportBody.jsx'],
    ['for-both/weekly-report/WinsAndWorkOnsSection.jsx', 'for-both/weekly-report/WinsAndWorkOnsSection.jsx'],
    ['for-both/weekly-report/ColorBorder.jsx', 'for-both/weekly-report/ColorBorder.jsx'],
    ['for-both/weekly-report/ColorButton.jsx', 'for-both/weekly-report/ColorButton.jsx'],
    ['for-both/weekly-report/TipRow.jsx', 'for-both/weekly-report/TipRow.jsx'],
    ['for-both/weekly-report/StatIcon.jsx', 'for-both/weekly-report/StatIcon.jsx'],
    ['for-both/weekly-report/ReportOptionsPopup.jsx', 'for-both/weekly-report/ReportOptionsPopup.jsx'],
    ['for-both/weekly-report/WeekPicker.jsx', 'for-both/weekly-report/WeekPicker.jsx'],
    ['for-both/weekly-report/TrainerTipsForWeek.jsx', 'for-both/weekly-report/TrainerTipsForWeek.jsx'],
    ['for-both/weekly-report/NoReportYet.jsx', 'for-both/weekly-report/NoReportYet.jsx'],
    ['for-both/weekly-report/DayCard.jsx', 'for-both/weekly-report/DayCard.jsx'],
    ['for-both/weekly-report/StatCard.jsx', 'for-both/weekly-report/StatCard.jsx'],
    ['for-both/weekly-report/WeeklyChart.jsx', 'for-both/weekly-report/WeeklyChart.jsx'],
    ['for-both/weekly-report/writeTrainerTips.js', 'for-both/weekly-report/writeTrainerTips.js'],
    ['for-both/weekly-report/pickBestTips.js', 'for-both/weekly-report/pickBestTips.js'],
    ['for-both/weekly-report/loadWeekDailyEntries.js', 'for-both/weekly-report/loadWeekDailyEntries.js'],
    ['for-both/weekly-report/loadWeekFoodTotals.js', 'for-both/weekly-report/loadWeekFoodTotals.js'],
    ['for-both/weekly-report/prepareReportForScreen.js', 'for-both/weekly-report/prepareReportForScreen.js'],
    ['for-both/weekly-report/reportColorSettings.jsx', 'for-both/weekly-report/reportColorSettings.jsx'],
    ['for-both/weekly-report/reportColors.js', 'for-both/weekly-report/reportColors.js'],
  ],

  nutrition: [
    ['nutrition/nutritionColors.js', 'nutrition/nutritionColors.js'],
    ['nutrition/food-cards/FoodCard.jsx', 'nutrition/food-cards/FoodCard.jsx'],
    ['nutrition/food-cards/ColorText.jsx', 'nutrition/food-cards/ColorText.jsx'],
    ['nutrition/food-cards/LoggedFoodRow.jsx', 'nutrition/food-cards/LoggedFoodRow.jsx'],
    ['nutrition/food-cards/NutritionFactsPanel.jsx', 'nutrition/food-cards/NutritionFactsPanel.jsx'],
    ['nutrition/food-cards/FoodListScreen.jsx', 'nutrition/food-cards/FoodListScreen.jsx'],
    ['nutrition/food-cards/foodCardColors.js', 'nutrition/food-cards/foodCardColors.js'],
    ['nutrition/food-cards/foodCardText.js', 'nutrition/food-cards/foodCardText.js'],
    ['nutrition/food-cards/ColorFieldFrame.jsx', 'nutrition/food-cards/ColorFieldFrame.jsx'],
    ['nutrition/barcode/fixBarcodeDigits.js', 'nutrition/barcode/fixBarcodeDigits.js'],
    ['nutrition/barcode/scannedProductSummary.js', 'nutrition/barcode/scannedProductSummary.js'],
    ['nutrition/barcode/rejectBadBarcodeResults.js', 'nutrition/barcode/rejectBadBarcodeResults.js'],
    ['nutrition/daily-log/DailyLogContent.jsx', 'nutrition/daily-log/DailyLogContent.jsx'],
    ['nutrition/daily-log/DayPicker.jsx', 'nutrition/daily-log/DayPicker.jsx'],
    ['nutrition/daily-log/DailyFoodLogScreen.jsx', 'nutrition/daily-log/DailyFoodLogScreen.jsx'],
    ['nutrition/daily-log/saveLoggedFood.js', 'nutrition/daily-log/saveLoggedFood.js'],
    ['nutrition/food-details/EditServingPopup.jsx', 'nutrition/food-details/EditServingPopup.jsx'],
    ['nutrition/food-details/servingSizeMath.js', 'nutrition/food-details/servingSizeMath.js'],
    ['nutrition/food-details/tidyBrandName.js', 'nutrition/food-details/tidyBrandName.js'],
    ['nutrition/food-details/fixPackageAmounts.js', 'nutrition/food-details/fixPackageAmounts.js'],
    ['nutrition/food-details/nutritionFactsData.js', 'nutrition/food-details/nutritionFactsData.js'],
    ['nutrition/food-search/ConfirmFoodPopup.jsx', 'nutrition/food-search/ConfirmFoodPopup.jsx'],
    ['nutrition/food-search/SearchDisclaimerCard.jsx', 'nutrition/food-search/SearchDisclaimerCard.jsx'],
    ['nutrition/food-search/tidyFoodTitles.js', 'nutrition/food-search/tidyFoodTitles.js'],
    ['nutrition/food-search/guessServingLabel.js', 'nutrition/food-search/guessServingLabel.js'],
    ['nutrition/food-search/trustRestaurantResult.js', 'nutrition/food-search/trustRestaurantResult.js'],
    ['nutrition/food-search/readableFoodTitle.js', 'nutrition/food-search/readableFoodTitle.js'],
    ['nutrition/food-search/combineFoodSources.js', 'nutrition/food-search/combineFoodSources.js'],
    ['nutrition/food-search/cleanSearchText.js', 'nutrition/food-search/cleanSearchText.js'],
    ['nutrition/food-search/searchFoods.js', 'nutrition/food-search/searchFoods.js'],
    ['nutrition/food-search/rankFoodResults.js', 'nutrition/food-search/rankFoodResults.js'],
    ['nutrition/food-search/knownRestaurantFoods.js', 'nutrition/food-search/knownRestaurantFoods.js'],
    ['nutrition/food-search/restaurantMenuSearch.js', 'nutrition/food-search/restaurantMenuSearch.js'],
    ['nutrition/targets/NutritionSetupScreen.jsx', 'nutrition/targets/NutritionSetupScreen.jsx'],
    ['nutrition/targets/NutritionSettingsScreen.js', 'nutrition/targets/NutritionSettingsScreen.js'],
  ],

  workouts: [
    ['workouts/create-plan/CreateWorkoutPlanScreen.js', 'workouts/create-plan/CreateWorkoutPlanScreen.js'],
    ['workouts/create-plan/EditWorkoutPopup.jsx', 'workouts/create-plan/EditWorkoutPopup.jsx'],
    ['workouts/create-plan/WorkoutProfileTags.jsx', 'workouts/create-plan/WorkoutProfileTags.jsx'],
    ['workouts/create-plan/nameWorkoutPlan.js', 'workouts/create-plan/nameWorkoutPlan.js'],
    ['workouts/create-plan/saveAndLoadWorkoutPlan.js', 'workouts/create-plan/saveAndLoadWorkoutPlan.js'],
    ['workouts/create-plan/editPlanFieldForms.js', 'workouts/create-plan/editPlanFieldForms.js'],
    ['workouts/create-plan/askForWorkoutPlan.js', 'workouts/create-plan/askForWorkoutPlan.js'],
    ['workouts/create-plan/countPlansCreated.js', 'workouts/create-plan/countPlansCreated.js'],
    ['workouts/create-plan/workoutPlanCreation.js', 'workouts/create-plan/workoutPlanCreation.js'],
    ['workouts/create-plan/planQuestionLabels.js', 'workouts/create-plan/planQuestionLabels.js'],
    ['workouts/create-plan/planRequestAnswers.js', 'workouts/create-plan/planRequestAnswers.js'],
    ['workouts/create-plan/keepPlanBuildingInBackground.js', 'workouts/create-plan/keepPlanBuildingInBackground.js'],
    ['workouts/create-plan/readPlanText.js', 'workouts/create-plan/readPlanText.js'],
    ['workouts/create-plan/GenerateMyWorkoutPlanScreen.jsx', 'workouts/create-plan/GenerateMyWorkoutPlanScreen.jsx'],
    ['workouts/view-plan/PlanPdfViewer.js', 'workouts/view-plan/PlanPdfViewer.js'],
    ['workouts/view-plan/WorkoutPlanView.jsx', 'workouts/view-plan/WorkoutPlanView.jsx'],
    ['workouts/view-plan/makePlanPdf.js', 'workouts/view-plan/makePlanPdf.js'],
    ['workouts/view-plan/planViewPieces.jsx', 'workouts/view-plan/planViewPieces.jsx'],
    ['workouts/exercise-videos/DislikedExercisesPicker.jsx', 'workouts/exercise-videos/DislikedExercisesPicker.jsx'],
    ['workouts/exercise-videos/ShortVideoCard.js', 'workouts/exercise-videos/ShortVideoCard.js'],
    ['workouts/exercise-videos/VideoPlayer.jsx', 'workouts/exercise-videos/VideoPlayer.jsx'],
    ['workouts/exercise-videos/ExerciseVideosTab.jsx', 'workouts/exercise-videos/ExerciseVideosTab.jsx'],
    ['workouts/exercise-videos/loadSavedWorkoutPlans.js', 'workouts/exercise-videos/loadSavedWorkoutPlans.js'],
    ['workouts/exercise-videos/dislikableExercises.js', 'workouts/exercise-videos/dislikableExercises.js'],
    ['workouts/exercise-videos/dislikedExercisesText.js', 'workouts/exercise-videos/dislikedExercisesText.js'],
    ['workouts/exercise-videos/findExerciseVideos.js', 'workouts/exercise-videos/findExerciseVideos.js'],
    ['workouts/exercise-videos/ExerciseCard.js', 'workouts/exercise-videos/ExerciseCard.js'],
    ['workouts/exercise-rows/ExerciseRow.jsx', 'workouts/exercise-rows/ExerciseRow.jsx'],
    ['workouts/exercise-rows/ExerciseSection.js', 'workouts/exercise-rows/ExerciseSection.js'],
  ],

  rest: [
    ['helpers/convertHeight.js', 'helpers/convertHeight.js'],
    ['helpers/dateStrings.js', 'helpers/dateStrings.js'],
    ['helpers/fileSizeAndDateText.js', 'helpers/fileSizeAndDateText.js'],
    ['helpers/cleanDataBeforeSaving.js', 'helpers/cleanDataBeforeSaving.js'],
    ['helpers/showSetupAnswers.js', 'helpers/showSetupAnswers.js'],
    ['helpers/whichViewerForFile.js', 'helpers/whichViewerForFile.js'],
    ['helpers/trainerProfilePhoto.js', 'helpers/trainerProfilePhoto.js'],
    ['helpers/combineTraineeProfile.js', 'helpers/combineTraineeProfile.js'],
    ['helpers/fillTraineeProfile.js', 'helpers/fillTraineeProfile.js'],
    ['helpers/sessionTimeText.js', 'helpers/sessionTimeText.js'],
    ['helpers/workoutDayNames.js', 'helpers/workoutDayNames.js'],
    ['messaging/ChatScreen.jsx', 'messaging/ChatScreen.jsx'],
    ['messaging/InboxScreen.jsx', 'messaging/InboxScreen.jsx'],
    ['messaging/unreadMessageCounts.js', 'messaging/unreadMessageCounts.js'],
    ['daily-stats/saveYesterdaysStats.js', 'daily-stats/saveYesterdaysStats.js'],
    ['daily-stats/latestWeight.js', 'daily-stats/latestWeight.js'],
    ['daily-stats/readDailyStats.js', 'daily-stats/readDailyStats.js'],
    ['daily-stats/saveDailyStats.js', 'daily-stats/saveDailyStats.js'],
    ['daily-stats/todaysDate.js', 'daily-stats/todaysDate.js'],
    ['daily-stats/dailyQuotes.json', 'daily-stats/dailyQuotes.json'],
    ['navigation/whichScreenIsOpen.js', 'navigation/whichScreenIsOpen.js'],
    ['navigation/BottomMenuBar.js', 'navigation/BottomMenuBar.js'],
    ['navigation/bottomMenuSpacing.js', 'navigation/bottomMenuSpacing.js'],
    ['navigation/webLinks.js', 'navigation/webLinks.js'],
    ['navigation/openScreenFromAnywhere.js', 'navigation/openScreenFromAnywhere.js'],
    ['navigation/screenNames.js', 'navigation/screenNames.js'],
    ['navigation/goToScreenByKeyword.js', 'navigation/goToScreenByKeyword.js'],
    ['notifications/writeAlertText.js', 'notifications/writeAlertText.js'],
    ['notifications/manageAlerts.js', 'notifications/manageAlerts.js'],
    ['notifications/removeEmojiFromAlerts.js', 'notifications/removeEmojiFromAlerts.js'],
    ['notifications/unreadAlertCount.js', 'notifications/unreadAlertCount.js'],
    ['block-and-report/BlockedUsersScreen.jsx', 'block-and-report/BlockedUsersScreen.jsx'],
    ['block-and-report/ReportOrBlockPopup.jsx', 'block-and-report/ReportOrBlockPopup.jsx'],
    ['block-and-report/blockUser.js', 'block-and-report/blockUser.js'],
    ['block-and-report/reportContent.js', 'block-and-report/reportContent.js'],
    ['block-and-report/reportReasons.js', 'block-and-report/reportReasons.js'],
    ['block-and-report/blockedList.js', 'block-and-report/blockedList.js'],
    ['settings/supportContact.js', 'settings/supportContact.js'],
    ['settings/emailSupport.js', 'settings/emailSupport.js'],
    ['settings/BugReportScreen.jsx', 'settings/BugReportScreen.jsx'],
    ['settings/ContactSupportScreen.jsx', 'settings/ContactSupportScreen.jsx'],
    ['settings/HelpFAQScreen.jsx', 'settings/HelpFAQScreen.jsx'],
    ['settings/PrivacyPolicyScreen.jsx', 'settings/PrivacyPolicyScreen.jsx'],
    ['settings/SettingsScreen.js', 'settings/SettingsScreen.js'],
    ['settings/TermsOfServiceScreen.jsx', 'settings/TermsOfServiceScreen.jsx'],
    ['spreadsheet-support/spreadsheetReader.js', 'spreadsheet-support/spreadsheetReader.js'],
    ['spreadsheet-support/spreadsheetReader.native.js', 'spreadsheet-support/spreadsheetReader.native.js'],
    ['spreadsheet-support/spreadsheetReader.web.js', 'spreadsheet-support/spreadsheetReader.web.js'],
    ['trainer-pro-plan/ProExpiredScreen.jsx', 'trainer-pro-plan/ProExpiredScreen.jsx'],
    ['trainer-pro-plan/ProLegalFooter.jsx', 'trainer-pro-plan/ProLegalFooter.jsx'],
    ['trainer-pro-plan/ProPlanSetup.jsx', 'trainer-pro-plan/ProPlanSetup.jsx'],
    ['trainer-pro-plan/ProPlanPurchases.jsx', 'trainer-pro-plan/ProPlanPurchases.jsx'],
    ['trainer-pro-plan/FreeTrialBanner.jsx', 'trainer-pro-plan/FreeTrialBanner.jsx'],
    ['trainer-pro-plan/ProUpgradeOffer.jsx', 'trainer-pro-plan/ProUpgradeOffer.jsx'],
    ['trainer-pro-plan/ProAccessCheck.jsx', 'trainer-pro-plan/ProAccessCheck.jsx'],
    ['trainer-pro-plan/ProUpgradeScreen.jsx', 'trainer-pro-plan/ProUpgradeScreen.jsx'],
    ['trainer-pro-plan/verifyProPurchase.js', 'trainer-pro-plan/verifyProPurchase.js'],
    ['trainer-pro-plan/proPlanStatus.js', 'trainer-pro-plan/proPlanStatus.js'],
    ['trainer-pro-plan/proPlanSwitches.js', 'trainer-pro-plan/proPlanSwitches.js'],
    ['trainer-pro-plan/proAccessRules.js', 'trainer-pro-plan/proAccessRules.js'],
    ['look-and-feel/BlurredBackground.jsx', 'look-and-feel/BlurredBackground.jsx'],
    ['look-and-feel/GlassPanel.jsx', 'look-and-feel/GlassPanel.jsx'],
    ['look-and-feel/LabeledRow.jsx', 'look-and-feel/LabeledRow.jsx'],
    ['look-and-feel/ColorText.jsx', 'look-and-feel/ColorText.jsx'],
    ['look-and-feel/lightDarkMode.js', 'look-and-feel/lightDarkMode.js'],
    ['look-and-feel/brandColors.js', 'look-and-feel/brandColors.js'],
    ['look-and-feel/colorPalette.js', 'look-and-feel/colorPalette.js'],
    ['look-and-feel/homeStatColors.js', 'look-and-feel/homeStatColors.js'],
    ['look-and-feel/TwoColumnGrid.jsx', 'look-and-feel/TwoColumnGrid.jsx'],
    ['look-and-feel/GlassBackgroundDark.jsx', 'look-and-feel/GlassBackgroundDark.jsx'],
    ['look-and-feel/GlassBackgroundLight.jsx', 'look-and-feel/GlassBackgroundLight.jsx'],
    ['look-and-feel/GlassCard.jsx', 'look-and-feel/GlassCard.jsx'],
    ['look-and-feel/GlassButton.jsx', 'look-and-feel/GlassButton.jsx'],
    ['look-and-feel/glassSettings.js', 'look-and-feel/glassSettings.js'],
  ],
};

/** Stubs / dead files — retarget imports first, then delete (batch stubs) */
const STUB_DELETE = []; // cleared — already applied; do not re-run deletes from corrupted list

/** When deleting stubs, rewrite these import targets first */
const STUB_REDIRECTS = [];

const SCAN_DIRS = ['src', 'server', 'scripts', 'functions', 'tests', 'load-tests'];
const EXT = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.md']);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXT.has(path.extname(name))) out.push(p);
  }
  return out;
}

function stripExt(p) {
  return p.replace(/\.(jsx?|tsx?|mjs|cjs)$/, '');
}

function gitMv(fromAbs, toAbs) {
  fs.mkdirSync(path.dirname(toAbs), { recursive: true });
  if (fs.existsSync(toAbs)) {
    console.warn('SKIP exists:', path.relative(ROOT, toAbs));
    return false;
  }
  try {
    execSync(`git mv "${fromAbs}" "${toAbs}"`, { cwd: ROOT, stdio: 'pipe' });
  } catch {
    fs.renameSync(fromAbs, toAbs);
    try {
      execSync(`git add -A -- "${fromAbs}" "${toAbs}"`, { cwd: ROOT, stdio: 'pipe' });
    } catch {
      /* untracked */
    }
  }
  return true;
}

function collectMoves() {
  const keys = BATCH === 'all' ? Object.keys(BATCHES) : [BATCH];
  const moves = [];
  for (const k of keys) {
    if (k === 'stubs') continue;
    if (!BATCHES[k]) {
      console.error('Unknown batch', k);
      process.exit(1);
    }
    moves.push(...BATCHES[k]);
  }
  // longest old paths first (avoid partial conflicts)
  moves.sort((a, b) => b[0].length - a[0].length);
  return moves;
}

function rewriteImports(moves) {
  // Build replacement pairs: path without ext, and with common prefixes
  const pairs = [];
  for (const [from, to] of moves) {
    if (from === to) continue;
    pairs.push([stripExt(from), stripExt(to)]);
    pairs.push([from, to]);
  }
  // stub redirects
  if (BATCH === 'all' || BATCH === 'stubs') {
    for (const [from, to] of STUB_REDIRECTS) {
      if (!to) continue;
      pairs.push([from, to]);
    }
  }
  pairs.sort((a, b) => b[0].length - a[0].length);

  let filesChanged = 0;
  for (const dir of SCAN_DIRS) {
    for (const file of walk(path.join(ROOT, dir))) {
      // skip catalog noise optional
      if (file.endsWith('SRC_FILE_CATALOG.md')) continue;
      let text = fs.readFileSync(file, 'utf8');
      let next = text;
      for (const [a, b] of pairs) {
        if (a === b) continue;
        if (next.includes(a)) next = next.split(a).join(b);
      }
      if (next !== text) {
        if (APPLY) fs.writeFileSync(file, next);
        filesChanged += 1;
      }
    }
  }
  return filesChanged;
}

function deleteStubs() {
  if (SKIP_STUBS) return 0;
  if (BATCH !== 'all' && BATCH !== 'stubs') return 0;
  let n = 0;
  for (const rel of STUB_DELETE) {
    const abs = path.join(ROOT, 'src', rel);
    if (!fs.existsSync(abs)) {
      console.warn('STUB missing:', rel);
      continue;
    }
    console.log(APPLY ? 'DELETE' : 'WOULD DELETE', rel);
    if (APPLY) {
      try {
        execSync(`git rm -f "${abs}"`, { cwd: ROOT, stdio: 'pipe' });
      } catch {
        fs.unlinkSync(abs);
      }
    }
    n += 1;
  }
  return n;
}

function pruneEmptyDirs(startRel = 'src') {
  const start = path.join(ROOT, startRel);
  function walkDel(dir) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) walkDel(p);
    }
    try {
      if (fs.readdirSync(dir).length === 0 && dir !== start) {
        fs.rmdirSync(dir);
        console.log('RMDIR', path.relative(ROOT, dir));
      }
    } catch {
      /* ignore */
    }
  }
  if (APPLY) walkDel(start);
}

// --- main ---
console.log(APPLY ? 'APPLY mode' : 'DRY-RUN mode', 'batch=', BATCH);

if (BATCH !== 'stubs') {
  const moves = collectMoves();
  let moved = 0;
  let skipped = 0;
  for (const [fromRel, toRel] of moves) {
    const fromAbs = path.join(ROOT, 'src', fromRel);
    const toAbs = path.join(ROOT, 'src', toRel);
    if (!fs.existsSync(fromAbs)) {
      console.warn('SKIP missing:', fromRel);
      skipped += 1;
      continue;
    }
    if (fromRel === toRel) continue;
    console.log(APPLY ? 'MOVE' : 'WOULD MOVE', fromRel, '→', toRel);
    if (APPLY) {
      if (gitMv(fromAbs, toAbs)) moved += 1;
      else skipped += 1;
    } else moved += 1;
  }
  console.log('Moves:', moved, 'skipped:', skipped);

  const allMovesForRewrite =
    BATCH === 'all'
      ? Object.values(BATCHES).flat()
      : BATCHES[BATCH] || [];
  // Always rewrite using all known moves so partial batches still fix cross-imports when re-run with all
  const rewriteMap =
    BATCH === 'all' ? Object.values(BATCHES).flat() : [...allMovesForRewrite, ...Object.values(BATCHES).flat()];
  // For a single batch, only rewrite that batch's paths (plus prior if already moved — use only this batch to avoid rewriting to missing paths)
  const rewritePairs = BATCH === 'all' ? Object.values(BATCHES).flat() : BATCHES[BATCH];
  const changed = rewriteImports(rewritePairs);
  console.log('Import files touched:', changed);
}

const deleted = deleteStubs();
console.log('Stub deletes:', deleted);
pruneEmptyDirs('src');
console.log('Done.');
