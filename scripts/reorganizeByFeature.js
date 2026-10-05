#!/usr/bin/env node
/**
 * Feature-based folder reorganization.
 * Moves files per manifest, then rewrites import paths across src/, App.js, scripts/.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/** @type {Array<[string, string]>} relative paths from repo root */
const MOVES = [
  // ── client ──
  ['src/client-app/home/homeScreenPieces.jsx', 'src/client-app/home/homeScreenPieces.jsx'],
  ['src/client-app/home/homeLooks.js', 'src/client-app/home/homeLooks.js'],
  ['src/client-app/home/loadHomeScreenData.js', 'src/client-app/home/loadHomeScreenData.js'],
  ['src/client-app/home/keepDailyStatsFresh.js', 'src/client-app/home/keepDailyStatsFresh.js'],
  ['src/client-app/navigation/goToClientScreen.js', 'src/client-app/navigation/goToClientScreen.js'],
  ['src/client-app/dashboard/coachingBillingLabel.js', 'src/client-app/dashboard/coachingBillingLabel.js'],
  ['src/client-app/home/TrainingHomeScreen.jsx', 'src/client-app/home/TrainingHomeScreen.jsx'],
  ['src/client-app/home/TopBannerCard.jsx', 'src/client-app/home/TopBannerCard.jsx'],
  ['src/client-app/home/TodayStatsCards.jsx', 'src/client-app/home/TodayStatsCards.jsx'],
  ['src/client-app/home/MyTrainerCard.jsx', 'src/client-app/home/MyTrainerCard.jsx'],
  ['src/client-app/home/WriteTrainerReviewPopup.js', 'src/client-app/home/WriteTrainerReviewPopup.js'],
  ['src/client-app/files-and-notes/FilesScreen.jsx', 'src/client-app/files-and-notes/FilesScreen.jsx'],
  ['src/client-app/files-and-notes/FileCard.jsx', 'src/client-app/files-and-notes/FileCard.jsx'],
  ['src/client-app/files-and-notes/MyFilesSection.jsx', 'src/client-app/files-and-notes/MyFilesSection.jsx'],
  ['src/client-app/files-and-notes/NotesFromTrainerSection.jsx', 'src/client-app/files-and-notes/NotesFromTrainerSection.jsx'],
  ['src/client-app/files-and-notes/SharedByTrainerSection.jsx', 'src/client-app/files-and-notes/SharedByTrainerSection.jsx'],
  ['src/client-app/files-and-notes/TrainerSharedFilesPopup.jsx', 'src/client-app/files-and-notes/TrainerSharedFilesPopup.jsx'],
  ['src/client-app/messaging/ChatScreen.jsx', 'src/client-app/messaging/ChatScreen.jsx'],
  ['src/client-app/messaging/InboxScreen.jsx', 'src/client-app/messaging/InboxScreen.jsx'],
  ['src/client-app/weekly-report/ViewWeekProgressReportScreen.jsx', 'src/client-app/weekly-report/ViewWeekProgressReportScreen.jsx'],
  ['src/client-app/workout-plans/BrowseSavedWorkoutsScreen.jsx', 'src/client-app/workout-plans/BrowseSavedWorkoutsScreen.jsx'],
  ['src/client-app/workout-plans/MyWorkoutPlanScreen.jsx', 'src/client-app/workout-plans/MyWorkoutPlanScreen.jsx'],
  ['src/client-app/meals/LogTodaysMealsScreen.jsx', 'src/client-app/meals/LogTodaysMealsScreen.jsx'],
  ['src/client-app/photo-gallery/MyProgressPhotosScreen.jsx', 'src/client-app/photo-gallery/MyProgressPhotosScreen.jsx'],
  ['src/client-app/find-a-trainer/BrowseTrainersScreen.jsx', 'src/client-app/find-a-trainer/BrowseTrainersScreen.jsx'],
  ['src/client-app/find-a-trainer/SearchTrainersScreen.jsx', 'src/client-app/find-a-trainer/SearchTrainersScreen.jsx'],
  ['src/client-app/find-a-trainer/TrainerCard.jsx', 'src/client-app/find-a-trainer/TrainerCard.jsx'],
  ['src/client-app/find-a-trainer/FindTrainerPieces.jsx', 'src/client-app/find-a-trainer/FindTrainerPieces.jsx'],
  ['src/client-app/find-a-trainer/FrostedPanel.jsx', 'src/client-app/find-a-trainer/FrostedPanel.jsx'],
  ['src/client-app/find-a-trainer/FilterPopup.js', 'src/client-app/find-a-trainer/FilterPopup.js'],
  ['src/client-app/find-a-trainer/RequestIntroPopup.jsx', 'src/client-app/find-a-trainer/RequestIntroPopup.jsx'],
  ['src/client-app/find-a-trainer/ConfirmRequestPopup.jsx', 'src/client-app/find-a-trainer/ConfirmRequestPopup.jsx'],
  ['src/client-app/find-a-trainer/TrainerProfilePopup.jsx', 'src/client-app/find-a-trainer/TrainerProfilePopup.jsx'],
  ['src/client-app/find-a-trainer/trainerFilters.js', 'src/client-app/find-a-trainer/trainerFilters.js'],

  // ── trainer ──
  ['src/trainer-app/home/TrainerHomeContent.jsx', 'src/trainer-app/home/TrainerHomeContent.jsx'],
  ['src/trainer-app/home/trainerHomePieces.jsx', 'src/trainer-app/home/trainerHomePieces.jsx'],
  ['src/trainer-app/home/TrainerListingPopup.js', 'src/trainer-app/home/TrainerListingPopup.js'],
  ['src/trainer-app/progress-tab/TrainerProgressTab.jsx', 'src/trainer-app/progress-tab/TrainerProgressTab.jsx'],
  ['src/trainer-app/nutrition-tab/TrainerNutritionTab.jsx', 'src/trainer-app/nutrition-tab/TrainerNutritionTab.jsx'],
  ['src/trainer-app/scheduling/CalendarTab.jsx', 'src/trainer-app/scheduling/CalendarTab.jsx'],
  ['src/trainer-app/new-requests/NewTraineeRequestsScreen.jsx', 'src/trainer-app/new-requests/NewTraineeRequestsScreen.jsx'],
  ['src/trainer-app/new-requests/pendingRequestCount.js', 'src/trainer-app/new-requests/pendingRequestCount.js'],
  ['src/trainer-app/new-requests/loadPendingTraineeRequests.js', 'src/trainer-app/new-requests/loadPendingTraineeRequests.js'],
  ['src/trainer-app/my-trainees/MyTraineesScreen.jsx', 'src/trainer-app/my-trainees/MyTraineesScreen.jsx'],
  ['src/trainer-app/my-trainees/pagedTraineeList.js', 'src/trainer-app/my-trainees/pagedTraineeList.js'],
  ['src/trainer-app/my-trainees/traineeList.js', 'src/trainer-app/my-trainees/traineeList.js'],
  ['src/trainer-app/trainee-detail/ManageTraineeScreen.jsx', 'src/trainer-app/trainee-detail/ManageTraineeScreen.jsx'],
  ['src/trainer-app/scheduling/BookSessionScreen.jsx', 'src/trainer-app/scheduling/BookSessionScreen.jsx'],
  ['src/trainer-app/sessions/ScheduleTrainingSessionScreen.jsx', 'src/trainer-app/sessions/ScheduleTrainingSessionScreen.jsx'],
  ['src/trainer-app/sessions/SessionCard.jsx', 'src/trainer-app/sessions/SessionCard.jsx'],
  ['src/trainer-app/sessions/MonthCalendar.jsx', 'src/trainer-app/sessions/MonthCalendar.jsx'],
  ['src/trainer-app/sessions/WheelPicker.jsx', 'src/trainer-app/sessions/WheelPicker.jsx'],
  ['src/trainer-app/sessions/useMyTrainingSessions.js', 'src/trainer-app/sessions/useMyTrainingSessions.js'],
  ['src/trainer-app/scheduling/alertTraineeOfSession.js', 'src/trainer-app/scheduling/alertTraineeOfSession.js'],
  ['src/trainer-app/documents/DocumentEditor.js', 'src/trainer-app/documents/DocumentEditor.js'],
  ['src/trainer-app/documents/SpreadsheetEditor.js', 'src/trainer-app/documents/SpreadsheetEditor.js'],
  ['src/trainer-app/documents/ShareDocumentPopup.js', 'src/trainer-app/documents/ShareDocumentPopup.js'],
  ['src/trainer-app/documents/EditorTopButtons.jsx', 'src/trainer-app/documents/EditorTopButtons.jsx'],
  ['src/trainer-app/documents/SaveStatusLabel.js', 'src/trainer-app/documents/SaveStatusLabel.js'],
  ['src/trainer-app/documents/editorColors.js', 'src/trainer-app/documents/editorColors.js'],
  ['src/trainer-app/documents/editorGradients.jsx', 'src/trainer-app/documents/editorGradients.jsx'],
  ['src/trainer-app/earnings/EarningsScreen.jsx', 'src/trainer-app/earnings/EarningsScreen.jsx'],
  ['src/trainer-app/workout-plans/ManualWorkoutPlanBuilderScreen.jsx', 'src/trainer-app/workout-plans/ManualWorkoutPlanBuilderScreen.jsx'],
  ['src/trainer-app/workout-plans/manualPlanToWorkoutPlan.js', 'src/trainer-app/workout-plans/manualPlanToWorkoutPlan.js'],
  ['src/trainer-app/workout-plans/builtInExerciseList.js', 'src/trainer-app/workout-plans/builtInExerciseList.js'],
  ['src/trainer-app/workout-plans/BrowseSavedWorkoutsScreen.jsx', 'src/trainer-app/workout-plans/BrowseSavedWorkoutsScreen.jsx'],
  ['src/trainer-app/weekly-report/TrainerWeeklyReportSection.jsx', 'src/trainer-app/weekly-report/TrainerWeeklyReportSection.jsx'],
  ['src/trainer-app/weekly-report/WeeklyReportBars.jsx', 'src/trainer-app/weekly-report/WeeklyReportBars.jsx'],
  ['src/trainer-app/weekly-report/WeeklyReportBanner.jsx', 'src/trainer-app/weekly-report/WeeklyReportBanner.jsx'],
  ['src/trainer-app/weekly-report/TrainerViewWeekProgressReportScreen.jsx', 'src/trainer-app/weekly-report/TrainerViewWeekProgressReportScreen.jsx'],
  ['src/trainer-app/messaging/InboxScreen.jsx', 'src/trainer-app/messaging/InboxScreen.jsx'],
  ['src/trainer-app/messaging/ChatWithTraineeScreen.jsx', 'src/trainer-app/messaging/ChatWithTraineeScreen.jsx'],
  ['src/trainer-app/photo-gallery/MyProgressPhotosScreen.jsx', 'src/trainer-app/photo-gallery/MyProgressPhotosScreen.jsx'],
  ['src/trainer-app/marketplace/SearchTrainersScreen.jsx', 'src/trainer-app/marketplace/SearchTrainersScreen.jsx'],
  ['src/trainer-app/navigation/goToTrainerScreen.js', 'src/trainer-app/navigation/goToTrainerScreen.js'],
  ['src/trainer-app/trainee-records/traineeDatabaseLocations.js', 'src/trainer-app/trainee-records/traineeDatabaseLocations.js'],
  ['src/trainer-app/trainee-records/loadMyLinkedTrainees.js', 'src/trainer-app/trainee-records/loadMyLinkedTrainees.js'],
  ['src/trainer-app/trainee-records/getTraineeDisplayName.js', 'src/trainer-app/trainee-records/getTraineeDisplayName.js'],
  ['src/trainer-app/trainee-records/calmDatabaseErrors.js', 'src/trainer-app/trainee-records/calmDatabaseErrors.js'],

  // ── nutrition ──
  ['src/nutrition/daily-log/DailyLogContent.jsx', 'src/nutrition/daily-log/DailyLogContent.jsx'],
  ['src/nutrition/daily-log/DailyFoodLogScreen.jsx', 'src/nutrition/daily-log/DailyFoodLogScreen.jsx'],
  ['src/nutrition/daily-log/DayPicker.jsx', 'src/nutrition/daily-log/DayPicker.jsx'],
  ['src/nutrition/daily-log/MealCard.js', 'src/nutrition/daily-log/MealCard.js'],
  ['src/nutrition/daily-log/MacroBar.js', 'src/nutrition/daily-log/MacroBar.js'],
  ['src/nutrition/daily-log/saveLoggedFood.js', 'src/nutrition/daily-log/saveLoggedFood.js'],
  ['src/nutrition/food-search/FoodSearchScreen.js', 'src/nutrition/food-search/FoodSearchScreen.js'],
  ['src/nutrition/food-search/ConfirmFoodPopup.jsx', 'src/nutrition/food-search/ConfirmFoodPopup.jsx'],
  ['src/nutrition/food-search/SearchDisclaimerCard.jsx', 'src/nutrition/food-search/SearchDisclaimerCard.jsx'],
  ['src/nutrition/food-search/searchFoods.js', 'src/nutrition/food-search/searchFoods.js'],
  ['src/nutrition/food-search/rankFoodResults.js', 'src/nutrition/food-search/rankFoodResults.js'],
  ['src/nutrition/food-search/casualMenuSearch.js', 'src/nutrition/food-search/casualMenuSearch.js'],
  ['src/nutrition/food-search/tidyFoodTitles.js', 'src/nutrition/food-search/tidyFoodTitles.js'],
  ['src/nutrition/food-search/trustRestaurantResult.js', 'src/nutrition/food-search/trustRestaurantResult.js'],
  ['src/nutrition/food-search/cleanSearchText.js', 'src/nutrition/food-search/cleanSearchText.js'],
  ['src/nutrition/barcode/BarcodeScannerScreen.js', 'src/nutrition/barcode/BarcodeScannerScreen.js'],
  ['src/nutrition/barcode/scannedProductSummary.js', 'src/nutrition/barcode/scannedProductSummary.js'],
  ['src/nutrition/food-details/NutritionFactsScreen.jsx', 'src/nutrition/food-details/NutritionFactsScreen.jsx'],
  ['src/nutrition/food-details/EditServingPopup.jsx', 'src/nutrition/food-details/EditServingPopup.jsx'],
  ['src/nutrition/food-details/FoodItem.js', 'src/nutrition/food-details/FoodItem.js'],
  ['src/nutrition/food-details/parseNutritionLabel.js', 'src/nutrition/food-details/parseNutritionLabel.js'],
  ['src/nutrition/food-details/servingSizeMath.js', 'src/nutrition/food-details/servingSizeMath.js'],
  ['src/nutrition/food-details/fixPackageAmounts.js', 'src/nutrition/food-details/fixPackageAmounts.js'],
  ['src/nutrition/food-details/tidyBrandName.js', 'src/nutrition/food-details/tidyBrandName.js'],
  ['src/nutrition/quick-add/QuickAddNutrition.jsx', 'src/nutrition/quick-add/QuickAddNutrition.jsx'],
  ['src/nutrition/targets/NutritionSettingsScreen.js', 'src/nutrition/targets/NutritionSettingsScreen.js'],
  ['src/nutrition/settings/NutritionOnboardingWizardScreen.jsxx', 'src/nutrition/settings/NutritionOnboardingWizardScreen.jsxx'],
  ['src/nutrition/nutritionColors.js', 'src/nutrition/nutritionColors.js'],

  // ── aiChat ──
  ['src/ai-coach/home-screen/CoachHomeScreen.jsx', 'src/ai-coach/home-screen/CoachHomeScreen.jsx'],
  ['src/ai-coach/conversation/CoachConversationScreen.jsx', 'src/ai-coach/conversation/CoachConversationScreen.jsx'],
  ['src/ai-coach/chat-ui/chat-thread/CoachFormattedReply.jsx', 'src/ai-coach/chat-ui/chat-thread/CoachFormattedReply.jsx'],
  ['src/ai-coach/conversation/PasteTextPopup.jsx', 'src/ai-coach/conversation/PasteTextPopup.jsx'],
  ['src/ai-coach/chat-ui/chat-thread/CoachWebSources.jsx', 'src/ai-coach/chat-ui/chat-thread/CoachWebSources.jsx'],
  ['src/ai-coach/chat-ui/chat-thread/CoachSourcePreviewSheet.jsx', 'src/ai-coach/chat-ui/chat-thread/CoachSourcePreviewSheet.jsx'],
  ['src/ai-coach/conversation/ConfirmActionPopup.jsx', 'src/ai-coach/conversation/ConfirmActionPopup.jsx'],
  ['src/ai-coach/chat-ui/chat-thread/coachMarkdownStyles.js', 'src/ai-coach/chat-ui/chat-thread/coachMarkdownStyles.js'],
  ['src/ai-coach/conversation/sourceLinkPreview.js', 'src/ai-coach/conversation/sourceLinkPreview.js'],
  ['src/ai-coach/conversation/suggestedQuestions.js', 'src/ai-coach/conversation/suggestedQuestions.js'],
  ['src/ai-coach/conversation/choosePhoto.js', 'src/ai-coach/conversation/choosePhoto.js'],
  ['src/ai-coach/conversation/openPhotoMenu.js', 'src/ai-coach/conversation/openPhotoMenu.js'],
  ['src/ai-coach/chat-ui/chat-thread/formatCoachMessageText.js', 'src/ai-coach/chat-ui/chat-thread/formatCoachMessageText.js'],
  ['src/ai-coach/conversation/typingBox.js', 'src/ai-coach/conversation/typingBox.js'],
  ['src/ai-coach/conversation/keyboardBehavior.js', 'src/ai-coach/conversation/keyboardBehavior.js'],
  ['src/ai-coach/chat-ui/trainer-coach-mode/TrainerCoachClientBar.jsx', 'src/ai-coach/chat-ui/trainer-coach-mode/TrainerCoachClientBar.jsx'],
  ['src/ai-coach/home-screen/CoachHomeScreen.jsx', 'src/ai-coach/home-screen/CoachHomeScreen.jsx'],
  ['src/ai-coach/chat-ui/voice/useVoiceToCoach.js', 'src/ai-coach/chat-ui/voice/useVoiceToCoach.js'],
  ['src/ai-coach/past-chats/saveAndLoadChats.js', 'src/ai-coach/past-chats/saveAndLoadChats.js'],
  ['src/ai-coach/chat-ui/persistence/coachConversationDebug.js', 'src/ai-coach/chat-ui/persistence/coachConversationDebug.js'],
  ['src/ai-coach/coachColors.js', 'src/ai-coach/coachColors.js'],
  ['src/ai-coach/CoachSelfTest.jsx', 'src/ai-coach/CoachSelfTest.jsx'],

  // tool modals -> tool-modals/
  ...[
    'AdjustMacroTargetsSheet.jsx', 'BookTraineeSessionSheet.jsx', 'ConfirmDeleteLogSheet.jsx', 'LogMoodRatingSheet.jsx',
    'LogMealSheet.jsx', 'LogRestDaySheet.jsx', 'LogSleepHoursSheet.jsx', 'LogDailyStepsSheet.jsx',
    'LogWaterIntakeSheet.jsx', 'SendTrainerMessageSheet.jsx', 'OpenWorkoutPlanSheet.jsx', 'RateEnergyLevelSheet.jsx',
    'RateWorkoutFeelSheet.jsx', 'UpdateFitnessGoalSheet.jsx', 'UpdateWorkoutSessionSheet.jsx', 'toolModalShared.js',
  ].map((f) => [`src/ai-coach/chat-ui/tool-modals/${f}`, `src/ai-coach/chat-ui/tool-modals/${f}`]),

  // ── workouts ──
  ['src/workouts/active-workout/workout.js', 'src/workouts/active-workout/workout.js'],
  ['src/workouts/create-plan/editPlanFieldForms.js', 'src/workouts/create-plan/editPlanFieldForms.js'],
  ['src/workouts/create-plan/workoutPlanCreation.js', 'src/workouts/create-plan/workoutPlanCreation.js'],
  ['src/workouts/create-plan/askForWorkoutPlan.js', 'src/workouts/create-plan/askForWorkoutPlan.js'],
  ['src/workouts/create-plan/keepPlanBuildingInBackground.js', 'src/workouts/create-plan/keepPlanBuildingInBackground.js'],
  ['src/workouts/create-plan/countPlansCreated.js', 'src/workouts/create-plan/countPlansCreated.js'],
  ['src/workouts/create-plan/planQuestionLabels.js', 'src/workouts/create-plan/planQuestionLabels.js'],
  ['src/workouts/create-plan/planRequestAnswers.js', 'src/workouts/create-plan/planRequestAnswers.js'],
  ['src/workouts/create-plan/readPlanText.js', 'src/workouts/create-plan/readPlanText.js'],
  ['src/workouts/view-plan/WorkoutPlanView.jsx', 'src/workouts/view-plan/WorkoutPlanView.jsx'],
  ['src/workouts/view-plan/PlanPdfViewer.js', 'src/workouts/view-plan/PlanPdfViewer.js'],
  ['src/workouts/view-plan/planViewPieces.jsx', 'src/workouts/view-plan/planViewPieces.jsx'],
  ['src/workouts/view-plan/makePlanPdf.js', 'src/workouts/view-plan/makePlanPdf.js'],
  ['src/workouts/exercise-videos/ExerciseVideosTab.jsx', 'src/workouts/exercise-videos/ExerciseVideosTab.jsx'],
  ['src/workouts/exercise-videos/loadSavedWorkoutPlans.js', 'src/workouts/exercise-videos/loadSavedWorkoutPlans.js'],
  ['src/workouts/exercise-videos/ExerciseCard.js', 'src/workouts/exercise-videos/ExerciseCard.js'],
  ['src/workouts/exercise-videos/ShortVideoCard.js', 'src/workouts/exercise-videos/ShortVideoCard.js'],
  ['src/workouts/exercise-videos/VideoPlayer.jsx', 'src/workouts/exercise-videos/VideoPlayer.jsx'],
  ['src/workouts/create-plan/EditWorkoutPopup.jsx', 'src/workouts/create-plan/EditWorkoutPopup.jsx'],
  ['src/workouts/create-plan/WorkoutProfileTags.jsx', 'src/workouts/create-plan/WorkoutProfileTags.jsx'],
  ['src/workouts/exercise-videos/findExerciseVideos.js', 'src/workouts/exercise-videos/findExerciseVideos.js'],
  ['src/workouts/create-plan/saveAndLoadWorkoutPlan.js', 'src/workouts/create-plan/saveAndLoadWorkoutPlan.js'],

  // ── ai (coach engine) ──
  ['src/ai-coach/conversation/sendMessageToCoach.js', 'src/ai-coach/conversation/sendMessageToCoach.js'],
  ['src/ai-coach/past-chats/loadOlderChats.js', 'src/ai-coach/past-chats/loadOlderChats.js'],
  ['src/ai-coach/past-chats/savedChatShape.js', 'src/ai-coach/past-chats/savedChatShape.js'],
  ['src/ai-coach/coach-actions/carryOutAction.js', 'src/ai-coach/coach-actions/carryOutAction.js'],
  ['src/ai-coach/coach-actions/popupOrAutoRun.js', 'src/ai-coach/coach-actions/popupOrAutoRun.js'],
  ['src/ai-coach/coach-actions/shouldAskFirst.js', 'src/ai-coach/coach-actions/shouldAskFirst.js'],
  ['src/ai-coach/coach-actions/findActionsInReply.js', 'src/ai-coach/coach-actions/findActionsInReply.js'],
  ['src/ai-coach/coach-actions/cleanUpActionDetails.js', 'src/ai-coach/coach-actions/cleanUpActionDetails.js'],
  ['src/ai-coach/coach-actions/spotDeleteRequests.js', 'src/ai-coach/coach-actions/spotDeleteRequests.js'],
  ['src/ai-coach/coach-knowledge/loadYourWeekForCoach.js', 'src/ai-coach/coach-knowledge/loadYourWeekForCoach.js'],
  ['src/ai-coach/coach-knowledge/loadWeeklyNumbers.js', 'src/ai-coach/coach-knowledge/loadWeeklyNumbers.js'],
  ['src/ai-coach/coach-knowledge/decideWhatCoachShouldKnow.js', 'src/ai-coach/coach-knowledge/decideWhatCoachShouldKnow.js'],
  ['src/ai-coach/coach-actions/alertTrainer.js', 'src/ai-coach/coach-actions/alertTrainer.js'],
  ['src/ai-coach/conversation/photoPermissions.js', 'src/ai-coach/conversation/photoPermissions.js'],
  ['src/ai-coach/internet-lookup/shouldLookUpOnInternet.js', 'src/ai-coach/internet-lookup/shouldLookUpOnInternet.js'],
  ['src/nutrition/targets/recalculateFoodTargets.js', 'src/nutrition/targets/recalculateFoodTargets.js'],

  // ── shared services split ──
  ['src/for-both/online-connection/baseUrl.js', 'src/for-both/online-connection/baseUrl.js'],
  ['src/for-both/online-connection/sendOnlineRequest.js', 'src/for-both/online-connection/sendOnlineRequest.js'],
  ['src/for-both/api/apiAuthHeaders.js', 'src/for-both/api/apiAuthHeaders.js'],
  ['src/for-both/api/userProfileApi.js', 'src/for-both/api/userProfileApi.js'],
  ['src/for-both/api/pushNotifyApi.js', 'src/for-both/api/pushNotifyApi.js'],
  ['src/for-both/api/onboardingSync.js', 'src/for-both/api/onboardingSync.js'],
  ['src/daily-stats/saveDailyStats.js', 'src/daily-stats/saveDailyStats.js'],
  ['src/daily-stats/readDailyStats.js', 'src/daily-stats/readDailyStats.js'],
  ['src/metrics/daily-metrics/dailyDashboardDayRollover.js', 'src/metrics/daily-metrics/dailyDashboardDayRollover.js'],
  ['src/daily-stats/todaysDate.js', 'src/daily-stats/todaysDate.js'],
  ['src/for-both/notes-files/notesAndFilesService.js', 'src/for-both/notes-files/notesAndFilesService.js'],
  ['src/for-both/firestore/firestoreListenerUtils.js', 'src/for-both/firestore/firestoreListenerUtils.js'],
  ['src/for-both/cloud-database/loadInPages.js', 'src/for-both/cloud-database/loadInPages.js'],
  ['src/for-both/firestore/storage.js', 'src/for-both/firestore/storage.js'],
  ['src/metrics/daily-metrics/latestLoggedWeight.js', 'src/metrics/daily-metrics/latestLoggedWeight.js'],
  ['src/notifications/notificationsService.js', 'src/notifications/notificationsService.js'],
  ['src/notifications/writeAlertText.js', 'src/notifications/writeAlertText.js'],
  ['src/for-both/api/monitoring.js', 'src/for-both/api/monitoring.js'],
  ['src/for-both/api/logger.js', 'src/for-both/api/logger.js'],
  ['src/for-both/trainer-listing/keepTrainerListingUpdated.js', 'src/for-both/trainer-listing/keepTrainerListingUpdated.js'],
  ['src/for-both/photo-gallery/MyProgressPhotosScreen.jsx', 'src/for-both/photo-gallery/MyProgressPhotosScreen.jsx'],
  ['src/for-both/weekly-report/WeeklyReportScreen.jsx', 'src/for-both/weekly-report/WeeklyReportScreen.jsx'],
  ['src/for-both/workout-plans/SavedWorkoutsScreen.jsx', 'src/for-both/workout-plans/SavedWorkoutsScreen.jsx'],
  ['src/messaging/ChatScreen.jsx', 'src/messaging/ChatScreen.jsx'],
  ['src/messaging/InboxScreen.jsx', 'src/messaging/InboxScreen.jsx'],
  ['src/for-both/calorieAndMacroMath.js', 'src/for-both/calorieAndMacroMath.js'],
  ['src/for-both/profileCardIconSizes.js', 'src/for-both/profileCardIconSizes.js'],
  ['src/for-both/whichProfileCardsToShow.js', 'src/for-both/whichProfileCardsToShow.js'],
  ['src/for-both/trainerCity.js', 'src/for-both/trainerCity.js'],
  ['src/daily-stats/dailyQuotes.json', 'src/daily-stats/dailyQuotes.json'],
  ['src/ai-coach/coach-actions/readActionsFromReply.js', 'src/ai-coach/coach-actions/readActionsFromReply.js'],
  ['src/for-both/screenReaderLabels.js', 'src/for-both/screenReaderLabels.js'],
];

function ensureDirFor(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function moveFiles() {
  let moved = 0;
  let skipped = 0;
  for (const [fromRel, toRel] of MOVES) {
    const from = path.join(ROOT, fromRel);
    const to = path.join(ROOT, toRel);
    if (!fs.existsSync(from)) {
      skipped += 1;
      continue;
    }
    if (fs.existsSync(to)) {
      console.warn(`skip (dest exists): ${toRel}`);
      skipped += 1;
      continue;
    }
    ensureDirFor(to);
    fs.renameSync(from, to);
    moved += 1;
  }
  console.log(`Moved ${moved} files, skipped ${skipped}`);
}

function walkFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'coverage') continue;
      walkFiles(p, acc);
    } else if (/\.(js|jsx|cjs|mjs|ts|tsx|json)$/.test(ent.name)) {
      acc.push(p);
    }
  }
  return acc;
}

function buildReplacements() {
  /** longest first to avoid partial overlaps */
  const reps = MOVES.map(([from, to]) => {
    const fromNoExt = from.replace(/\.(jsx?|cjs|mjs)$/, '');
    const toNoExt = to.replace(/\.(jsx?|cjs|mjs)$/, '');
    return [fromNoExt, toNoExt];
  });
  reps.sort((a, b) => b[0].length - a[0].length);
  return reps;
}

function rewriteImports() {
  const reps = buildReplacements();
  const roots = [path.join(ROOT, 'src'), path.join(ROOT, 'App.js'), path.join(ROOT, 'scripts')];
  const files = [];
  for (const r of roots) {
    if (fs.existsSync(r) && fs.statSync(r).isFile()) files.push(r);
    else if (fs.existsSync(r)) walkFiles(r, files);
  }
  let changed = 0;
  for (const file of files) {
    let text = fs.readFileSync(file, 'utf8');
    const orig = text;
    for (const [from, to] of reps) {
      text = text.split(from).join(to);
    }
    if (text !== orig) {
      fs.writeFileSync(file, text);
      changed += 1;
    }
  }
  console.log(`Updated imports in ${changed} files`);
}

function pruneEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) pruneEmptyDirs(path.join(dir, ent.name));
  }
  if (dir === path.join(ROOT, 'src')) return;
  try {
    const items = fs.readdirSync(dir);
    if (items.length === 0) fs.rmdirSync(dir);
  } catch (_) {}
}

moveFiles();
rewriteImports();
pruneEmptyDirs(path.join(ROOT, 'src'));

console.log('Done. Run tests and fix any remaining relative imports inside moved files.');
