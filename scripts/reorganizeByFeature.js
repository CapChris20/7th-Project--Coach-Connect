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
  ['src/client-app/home/clientHomeComponents.jsx', 'src/client-app/home/clientHomeComponents.jsx'],
  ['src/client-app/home/clientAppStyles.js', 'src/client-app/home/clientAppStyles.js'],
  ['src/client-app/home/useClientHomeBootstrap.js', 'src/client-app/home/useClientHomeBootstrap.js'],
  ['src/client-app/home/useClientHomeDailyMetrics.js', 'src/client-app/home/useClientHomeDailyMetrics.js'],
  ['src/client-app/navigation/useClientScreenNavigation.js', 'src/client-app/navigation/useClientScreenNavigation.js'],
  ['src/client-app/dashboard/coachingBillingLabel.js', 'src/client-app/dashboard/coachingBillingLabel.js'],
  ['src/client-app/dashboard/TrainingDashboardScreen.jsx', 'src/client-app/dashboard/TrainingDashboardScreen.jsx'],
  ['src/client-app/dashboard/DashboardHeroCard.jsx', 'src/client-app/dashboard/DashboardHeroCard.jsx'],
  ['src/client-app/dashboard/PremiumStatsSection.jsx', 'src/client-app/dashboard/PremiumStatsSection.jsx'],
  ['src/client-app/dashboard/PremiumTrainerCard.jsx', 'src/client-app/dashboard/PremiumTrainerCard.jsx'],
  ['src/client-app/dashboard/ReviewSubmitSheet.js', 'src/client-app/dashboard/ReviewSubmitSheet.js'],
  ['src/client-app/files/ClientFilesScreen.jsx', 'src/client-app/files/ClientFilesScreen.jsx'],
  ['src/client-app/files/FileCard.jsx', 'src/client-app/files/FileCard.jsx'],
  ['src/client-app/files/MyFilesSection.jsx', 'src/client-app/files/MyFilesSection.jsx'],
  ['src/client-app/files/NotesFromTrainerSection.jsx', 'src/client-app/files/NotesFromTrainerSection.jsx'],
  ['src/client-app/files/TrainerSharedSection.jsx', 'src/client-app/files/TrainerSharedSection.jsx'],
  ['src/client-app/files/TrainerSharedFilesModal.jsx', 'src/client-app/files/TrainerSharedFilesModal.jsx'],
  ['src/client-app/messaging/ChatThreadScreen.jsx', 'src/client-app/messaging/ChatThreadScreen.jsx'],
  ['src/client-app/messaging/MyMessagesScreen.jsx', 'src/client-app/messaging/MyMessagesScreen.jsx'],
  ['src/client-app/weekly-report/ViewWeekProgressReportScreen.jsx', 'src/client-app/weekly-report/ViewWeekProgressReportScreen.jsx'],
  ['src/client-app/workout-plans/BrowseSavedWorkoutsScreen.jsx', 'src/client-app/workout-plans/BrowseSavedWorkoutsScreen.jsx'],
  ['src/client-app/workout-plans/ViewMyWorkoutPlanScreen.jsx', 'src/client-app/workout-plans/ViewMyWorkoutPlanScreen.jsx'],
  ['src/client-app/meal-plan/LogTodaysMealsScreen.jsx', 'src/client-app/meal-plan/LogTodaysMealsScreen.jsx'],
  ['src/client-app/photo-gallery/MyProgressPhotosScreen.jsx', 'src/client-app/photo-gallery/MyProgressPhotosScreen.jsx'],
  ['src/client-app/marketplace/BrowseTrainersScreen.jsx', 'src/client-app/marketplace/BrowseTrainersScreen.jsx'],
  ['src/client-app/marketplace/SearchTrainersScreen.jsx', 'src/client-app/marketplace/SearchTrainersScreen.jsx'],
  ['src/client-app/marketplace/TrainerCard.jsx', 'src/client-app/marketplace/TrainerCard.jsx'],
  ['src/client-app/marketplace/MarketplaceUI.jsx', 'src/client-app/marketplace/MarketplaceUI.jsx'],
  ['src/client-app/marketplace/MarketplaceGlass.jsx', 'src/client-app/marketplace/MarketplaceGlass.jsx'],
  ['src/client-app/marketplace/FilterModal.js', 'src/client-app/marketplace/FilterModal.js'],
  ['src/client-app/marketplace/TrainerRequestIntroModal.jsx', 'src/client-app/marketplace/TrainerRequestIntroModal.jsx'],
  ['src/client-app/marketplace/TrainerRequestConfirmModal.jsx', 'src/client-app/marketplace/TrainerRequestConfirmModal.jsx'],
  ['src/client-app/marketplace/MarketplaceTrainerProfileSheet.jsx', 'src/client-app/marketplace/MarketplaceTrainerProfileSheet.jsx'],
  ['src/client-app/marketplace/marketplaceFilters.js', 'src/client-app/marketplace/marketplaceFilters.js'],

  // ── trainer ──
  ['src/trainer-app/dashboard/TrainerDashboardContent.jsx', 'src/trainer-app/dashboard/TrainerDashboardContent.jsx'],
  ['src/trainer-app/dashboard/trainerDashboardUi.jsx', 'src/trainer-app/dashboard/trainerDashboardUi.jsx'],
  ['src/trainer-app/dashboard/TrainerMarketplaceModal.js', 'src/trainer-app/dashboard/TrainerMarketplaceModal.js'],
  ['src/trainer-app/progress-tab/TrainerProgressTab.jsx', 'src/trainer-app/progress-tab/TrainerProgressTab.jsx'],
  ['src/trainer-app/nutrition-tab/TrainerNutritionTab.jsx', 'src/trainer-app/nutrition-tab/TrainerNutritionTab.jsx'],
  ['src/trainer-app/calendar-tab/TrainerCalendarTab.jsx', 'src/trainer-app/calendar-tab/TrainerCalendarTab.jsx'],
  ['src/trainer-app/client-requests/NewTraineeRequestsScreen.jsx', 'src/trainer-app/client-requests/NewTraineeRequestsScreen.jsx'],
  ['src/trainer-app/client-requests/useTrainerPendingRequests.js', 'src/trainer-app/client-requests/useTrainerPendingRequests.js'],
  ['src/trainer-app/client-requests/loadPendingTraineeRequests.js', 'src/trainer-app/client-requests/loadPendingTraineeRequests.js'],
  ['src/trainer-app/clients-list/MyTraineesScreen.jsx', 'src/trainer-app/clients-list/MyTraineesScreen.jsx'],
  ['src/trainer-app/clients-list/useTrainerClients.js', 'src/trainer-app/clients-list/useTrainerClients.js'],
  ['src/trainer-app/clients-list/loadMyTraineeRoster.js', 'src/trainer-app/clients-list/loadMyTraineeRoster.js'],
  ['src/trainer-app/client-detail/ManageTraineeScreen.jsx', 'src/trainer-app/client-detail/ManageTraineeScreen.jsx'],
  ['src/trainer-app/sessions/BookTraineeSessionScreen.jsx', 'src/trainer-app/sessions/BookTraineeSessionScreen.jsx'],
  ['src/trainer-app/sessions/ScheduleTrainingSessionScreen.jsx', 'src/trainer-app/sessions/ScheduleTrainingSessionScreen.jsx'],
  ['src/trainer-app/sessions/SessionCard.jsx', 'src/trainer-app/sessions/SessionCard.jsx'],
  ['src/trainer-app/sessions/MonthCalendar.jsx', 'src/trainer-app/sessions/MonthCalendar.jsx'],
  ['src/trainer-app/sessions/WheelPicker.jsx', 'src/trainer-app/sessions/WheelPicker.jsx'],
  ['src/trainer-app/sessions/useMyTrainingSessions.js', 'src/trainer-app/sessions/useMyTrainingSessions.js'],
  ['src/trainer-app/sessions/pushSessionNotification.js', 'src/trainer-app/sessions/pushSessionNotification.js'],
  ['src/trainer-app/documents/DocumentEditorModal.js', 'src/trainer-app/documents/DocumentEditorModal.js'],
  ['src/trainer-app/documents/SpreadsheetEditorModal.js', 'src/trainer-app/documents/SpreadsheetEditorModal.js'],
  ['src/trainer-app/documents/ShareDocumentModal.js', 'src/trainer-app/documents/ShareDocumentModal.js'],
  ['src/trainer-app/documents/EditorHeaderActions.jsx', 'src/trainer-app/documents/EditorHeaderActions.jsx'],
  ['src/trainer-app/documents/EditorStatusPill.js', 'src/trainer-app/documents/EditorStatusPill.js'],
  ['src/trainer-app/documents/editorTheme.js', 'src/trainer-app/documents/editorTheme.js'],
  ['src/trainer-app/documents/editorGradients.jsx', 'src/trainer-app/documents/editorGradients.jsx'],
  ['src/trainer-app/payments/PaymentsScreen.jsx', 'src/trainer-app/payments/PaymentsScreen.jsx'],
  ['src/trainer-app/workout-plans/ManualWorkoutPlanBuilderScreen.jsx', 'src/trainer-app/workout-plans/ManualWorkoutPlanBuilderScreen.jsx'],
  ['src/trainer-app/workout-plans/manualWorkoutPlanService.js', 'src/trainer-app/workout-plans/manualWorkoutPlanService.js'],
  ['src/trainer-app/workout-plans/manualExerciseLibrarySeed.js', 'src/trainer-app/workout-plans/manualExerciseLibrarySeed.js'],
  ['src/trainer-app/workout-plans/BrowseSavedWorkoutsScreen.jsx', 'src/trainer-app/workout-plans/BrowseSavedWorkoutsScreen.jsx'],
  ['src/trainer-app/weekly-report/TrainerWeeklyReportSection.jsx', 'src/trainer-app/weekly-report/TrainerWeeklyReportSection.jsx'],
  ['src/trainer-app/weekly-report/WeeklyReportPremium.jsx', 'src/trainer-app/weekly-report/WeeklyReportPremium.jsx'],
  ['src/trainer-app/weekly-report/WeeklyReportHeroCard.jsx', 'src/trainer-app/weekly-report/WeeklyReportHeroCard.jsx'],
  ['src/trainer-app/weekly-report/TrainerViewWeekProgressReportScreen.jsx', 'src/trainer-app/weekly-report/TrainerViewWeekProgressReportScreen.jsx'],
  ['src/trainer-app/messaging/MyMessagesScreen.jsx', 'src/trainer-app/messaging/MyMessagesScreen.jsx'],
  ['src/trainer-app/messaging/ChatWithTraineeScreen.jsx', 'src/trainer-app/messaging/ChatWithTraineeScreen.jsx'],
  ['src/trainer-app/photo-gallery/MyProgressPhotosScreen.jsx', 'src/trainer-app/photo-gallery/MyProgressPhotosScreen.jsx'],
  ['src/trainer-app/marketplace/SearchTrainersScreen.jsx', 'src/trainer-app/marketplace/SearchTrainersScreen.jsx'],
  ['src/trainer-app/navigation/useTrainerScreenNavigation.js', 'src/trainer-app/navigation/useTrainerScreenNavigation.js'],
  ['src/trainer-app/crm/trainerClientFirestorePaths.js', 'src/trainer-app/crm/trainerClientFirestorePaths.js'],
  ['src/trainer-app/crm/loadMyLinkedTrainees.js', 'src/trainer-app/crm/loadMyLinkedTrainees.js'],
  ['src/trainer-app/crm/getTraineeDisplayName.js', 'src/trainer-app/crm/getTraineeDisplayName.js'],
  ['src/trainer-app/crm/trainerFirestoreErrors.js', 'src/trainer-app/crm/trainerFirestoreErrors.js'],

  // ── nutrition ──
  ['src/nutrition/daily-log/NutritionContainer.jsx', 'src/nutrition/daily-log/NutritionContainer.jsx'],
  ['src/nutrition/daily-log/NutritionScreen.jsx', 'src/nutrition/daily-log/NutritionScreen.jsx'],
  ['src/nutrition/daily-log/NutritionDayPicker.jsx', 'src/nutrition/daily-log/NutritionDayPicker.jsx'],
  ['src/nutrition/daily-log/MealCard.js', 'src/nutrition/daily-log/MealCard.js'],
  ['src/nutrition/daily-log/MacroBar.js', 'src/nutrition/daily-log/MacroBar.js'],
  ['src/nutrition/daily-log/logFoodToFirestore.js', 'src/nutrition/daily-log/logFoodToFirestore.js'],
  ['src/nutrition/food-search/FoodSearchScreen.js', 'src/nutrition/food-search/FoodSearchScreen.js'],
  ['src/nutrition/food-search/ConfirmFoodSelectionSheet.jsx', 'src/nutrition/food-search/ConfirmFoodSelectionSheet.jsx'],
  ['src/nutrition/food-search/SearchQualityCard.jsx', 'src/nutrition/food-search/SearchQualityCard.jsx'],
  ['src/nutrition/food-search/searchFoodsService.js', 'src/nutrition/food-search/searchFoodsService.js'],
  ['src/nutrition/food-search/sortBestFoodMatches.js', 'src/nutrition/food-search/sortBestFoodMatches.js'],
  ['src/nutrition/food-search/casualMenuSearch.js', 'src/nutrition/food-search/casualMenuSearch.js'],
  ['src/nutrition/food-search/cleanFoodCardLabels.js', 'src/nutrition/food-search/cleanFoodCardLabels.js'],
  ['src/nutrition/food-search/isReliableRestaurantFood.js', 'src/nutrition/food-search/isReliableRestaurantFood.js'],
  ['src/nutrition/food-search/normalizeFoodQuery.js', 'src/nutrition/food-search/normalizeFoodQuery.js'],
  ['src/nutrition/barcode/BarcodeScannerScreen.js', 'src/nutrition/barcode/BarcodeScannerScreen.js'],
  ['src/nutrition/barcode/renderScannedBarcode.js', 'src/nutrition/barcode/renderScannedBarcode.js'],
  ['src/nutrition/food-details/NutritionFactsScreen.jsx', 'src/nutrition/food-details/NutritionFactsScreen.jsx'],
  ['src/nutrition/food-details/EditServingModal.jsx', 'src/nutrition/food-details/EditServingModal.jsx'],
  ['src/nutrition/food-details/FoodItem.js', 'src/nutrition/food-details/FoodItem.js'],
  ['src/nutrition/food-details/parseNutritionLabel.js', 'src/nutrition/food-details/parseNutritionLabel.js'],
  ['src/nutrition/food-details/calculateServingSize.js', 'src/nutrition/food-details/calculateServingSize.js'],
  ['src/nutrition/food-details/fixFoodNutritionNumbers.js', 'src/nutrition/food-details/fixFoodNutritionNumbers.js'],
  ['src/nutrition/food-details/cleanFoodBrandName.js', 'src/nutrition/food-details/cleanFoodBrandName.js'],
  ['src/nutrition/quick-add/QuickAddNutrition.jsx', 'src/nutrition/quick-add/QuickAddNutrition.jsx'],
  ['src/nutrition/settings/NutritionSettingsScreen.js', 'src/nutrition/settings/NutritionSettingsScreen.js'],
  ['src/nutrition/settings/NutritionOnboardingWizardScreen.jsxx', 'src/nutrition/settings/NutritionOnboardingWizardScreen.jsxx'],
  ['src/nutrition/nutritionTheme.js', 'src/nutrition/nutritionTheme.js'],

  // ── aiChat ──
  ['src/ai-coach/chat-ui/chat-home/StartCoachChatScreen.jsx', 'src/ai-coach/chat-ui/chat-home/StartCoachChatScreen.jsx'],
  ['src/ai-coach/chat-ui/chat-thread/ChatWithCoachScreen.jsx', 'src/ai-coach/chat-ui/chat-thread/ChatWithCoachScreen.jsx'],
  ['src/ai-coach/chat-ui/chat-thread/CoachFormattedReply.jsx', 'src/ai-coach/chat-ui/chat-thread/CoachFormattedReply.jsx'],
  ['src/ai-coach/chat-ui/chat-thread/CoachPasteSheet.jsx', 'src/ai-coach/chat-ui/chat-thread/CoachPasteSheet.jsx'],
  ['src/ai-coach/chat-ui/chat-thread/CoachWebSources.jsx', 'src/ai-coach/chat-ui/chat-thread/CoachWebSources.jsx'],
  ['src/ai-coach/chat-ui/chat-thread/CoachSourcePreviewSheet.jsx', 'src/ai-coach/chat-ui/chat-thread/CoachSourcePreviewSheet.jsx'],
  ['src/ai-coach/chat-ui/chat-thread/ToolConfirmationModal.jsx', 'src/ai-coach/chat-ui/chat-thread/ToolConfirmationModal.jsx'],
  ['src/ai-coach/chat-ui/chat-thread/coachMarkdownStyles.js', 'src/ai-coach/chat-ui/chat-thread/coachMarkdownStyles.js'],
  ['src/ai-coach/chat-ui/chat-thread/renderSourcePreview.js', 'src/ai-coach/chat-ui/chat-thread/renderSourcePreview.js'],
  ['src/ai-coach/chat-ui/chat-thread/coachQuickPrompts.js', 'src/ai-coach/chat-ui/chat-thread/coachQuickPrompts.js'],
  ['src/ai-coach/chat-ui/chat-thread/pickAttachmentType.js', 'src/ai-coach/chat-ui/chat-thread/pickAttachmentType.js'],
  ['src/ai-coach/chat-ui/chat-thread/openAttachmentMenu.js', 'src/ai-coach/chat-ui/chat-thread/openAttachmentMenu.js'],
  ['src/ai-coach/chat-ui/chat-thread/formatCoachMessageText.js', 'src/ai-coach/chat-ui/chat-thread/formatCoachMessageText.js'],
  ['src/ai-coach/chat-ui/chat-thread/useCoachComposerInput.js', 'src/ai-coach/chat-ui/chat-thread/useCoachComposerInput.js'],
  ['src/ai-coach/chat-ui/chat-thread/useCoachComposerKeyboard.js', 'src/ai-coach/chat-ui/chat-thread/useCoachComposerKeyboard.js'],
  ['src/ai-coach/chat-ui/trainer-coach-mode/TrainerCoachClientBar.jsx', 'src/ai-coach/chat-ui/trainer-coach-mode/TrainerCoachClientBar.jsx'],
  ['src/ai-coach/chat-ui/voice/VoiceCoachScreen.jsx', 'src/ai-coach/chat-ui/voice/VoiceCoachScreen.jsx'],
  ['src/ai-coach/chat-ui/voice/useVoiceToCoach.js', 'src/ai-coach/chat-ui/voice/useVoiceToCoach.js'],
  ['src/ai-coach/chat-ui/persistence/saveCoachMessages.js', 'src/ai-coach/chat-ui/persistence/saveCoachMessages.js'],
  ['src/ai-coach/chat-ui/persistence/coachConversationDebug.js', 'src/ai-coach/chat-ui/persistence/coachConversationDebug.js'],
  ['src/ai-coach/chat-ui/aiCoachUiTokens.js', 'src/ai-coach/chat-ui/aiCoachUiTokens.js'],
  ['src/ai-coach/chat-ui/AICoachTestSuite.jsx', 'src/ai-coach/chat-ui/AICoachTestSuite.jsx'],

  // tool modals -> tool-modals/
  ...[
    'AdjustMacroTargetsSheet.jsx', 'BookTraineeSessionSheet.jsx', 'ConfirmDeleteLogSheet.jsx', 'LogMoodRatingSheet.jsx',
    'LogMealSheet.jsx', 'LogRestDaySheet.jsx', 'LogSleepHoursSheet.jsx', 'LogDailyStepsSheet.jsx',
    'LogWaterIntakeSheet.jsx', 'SendTrainerMessageSheet.jsx', 'OpenWorkoutPlanSheet.jsx', 'RateEnergyLevelSheet.jsx',
    'RateWorkoutFeelSheet.jsx', 'UpdateFitnessGoalSheet.jsx', 'UpdateWorkoutSessionSheet.jsx', 'toolModalShared.js',
  ].map((f) => [`src/ai-coach/chat-ui/tool-modals/${f}`, `src/ai-coach/chat-ui/tool-modals/${f}`]),

  // ── workouts ──
  ['src/workouts/active-workout/workout.js', 'src/workouts/active-workout/workout.js'],
  ['src/workouts/plan-builder/workoutPlanBuilderFieldEditBody.js', 'src/workouts/plan-builder/workoutPlanBuilderFieldEditBody.js'],
  ['src/workouts/plan-generator/useWorkoutGeneration.js', 'src/workouts/plan-generator/useWorkoutGeneration.js'],
  ['src/workouts/plan-generator/requestWorkoutPlan.js', 'src/workouts/plan-generator/requestWorkoutPlan.js'],
  ['src/workouts/plan-generator/workoutPlanGenerationSession.js', 'src/workouts/plan-generator/workoutPlanGenerationSession.js'],
  ['src/workouts/plan-generator/trackWorkoutGenerationUsage.js', 'src/workouts/plan-generator/trackWorkoutGenerationUsage.js'],
  ['src/workouts/plan-generator/workoutOnboardingFormConfig.js', 'src/workouts/plan-generator/workoutOnboardingFormConfig.js'],
  ['src/workouts/plan-generator/workoutOnboardingPayload.js', 'src/workouts/plan-generator/workoutOnboardingPayload.js'],
  ['src/workouts/plan-generator/workoutPlanParsing.js', 'src/workouts/plan-generator/workoutPlanParsing.js'],
  ['src/workouts/plan-viewer/WorkoutPlanResult.jsx', 'src/workouts/plan-viewer/WorkoutPlanResult.jsx'],
  ['src/workouts/plan-viewer/WorkoutPlanPdfViewerModal.js', 'src/workouts/plan-viewer/WorkoutPlanPdfViewerModal.js'],
  ['src/workouts/plan-viewer/workoutPlanUiComponents.jsx', 'src/workouts/plan-viewer/workoutPlanUiComponents.jsx'],
  ['src/workouts/plan-viewer/workoutPlanPdfService.js', 'src/workouts/plan-viewer/workoutPlanPdfService.js'],
  ['src/workouts/exercise-library/WorkoutExerciseLibraryTab.jsx', 'src/workouts/exercise-library/WorkoutExerciseLibraryTab.jsx'],
  ['src/workouts/exercise-library/clientWorkoutPlansLibrary.js', 'src/workouts/exercise-library/clientWorkoutPlansLibrary.js'],
  ['src/workouts/exercise-library/ExerciseCard.js', 'src/workouts/exercise-library/ExerciseCard.js'],
  ['src/workouts/exercise-library/ShortsCard.js', 'src/workouts/exercise-library/ShortsCard.js'],
  ['src/workouts/exercise-library/VideoPlayerModal.jsx', 'src/workouts/exercise-library/VideoPlayerModal.jsx'],
  ['src/workouts/active-workout/EditModalForm_RN.jsx', 'src/workouts/active-workout/EditModalForm_RN.jsx'],
  ['src/workouts/active-workout/WorkoutProfilePillGrid.jsx', 'src/workouts/active-workout/WorkoutProfilePillGrid.jsx'],
  ['src/workouts/exercise-library/useYouTubeAPI.js', 'src/workouts/exercise-library/useYouTubeAPI.js'],
  ['src/workouts/active-workout/workoutService.js', 'src/workouts/active-workout/workoutService.js'],

  // ── ai (coach engine) ──
  ['src/ai-coach/server-logic/chat-api/sendCoachMessageToServer.js', 'src/ai-coach/server-logic/chat-api/sendCoachMessageToServer.js'],
  ['src/ai-coach/server-logic/chat-api/loadMoreCoachConversations.js', 'src/ai-coach/server-logic/chat-api/loadMoreCoachConversations.js'],
  ['src/ai-coach/server-logic/chat-api/chatStorageService.js', 'src/ai-coach/server-logic/chat-api/chatStorageService.js'],
  ['src/ai-coach/server-logic/tools/runCoachAction.js', 'src/ai-coach/server-logic/tools/runCoachAction.js'],
  ['src/ai-coach/server-logic/tools/chooseCoachActionUI.js', 'src/ai-coach/server-logic/tools/chooseCoachActionUI.js'],
  ['src/ai-coach/server-logic/tools/shouldShowCoachAction.js', 'src/ai-coach/server-logic/tools/shouldShowCoachAction.js'],
  ['src/ai-coach/server-logic/tools/findCoachRequestsInText.js', 'src/ai-coach/server-logic/tools/findCoachRequestsInText.js'],
  ['src/ai-coach/server-logic/tools/cleanupToolParams.js', 'src/ai-coach/server-logic/tools/cleanupToolParams.js'],
  ['src/ai-coach/server-logic/tools/detectDeleteFoodRequest.js', 'src/ai-coach/server-logic/tools/detectDeleteFoodRequest.js'],
  ['src/ai-coach/server-logic/context/loadCoachPersonalContext.js', 'src/ai-coach/server-logic/context/loadCoachPersonalContext.js'],
  ['src/ai-coach/server-logic/context/loadCoachWeeklyStats.js', 'src/ai-coach/server-logic/context/loadCoachWeeklyStats.js'],
  ['src/ai-coach/server-logic/context/buildCoachPromptData.js', 'src/ai-coach/server-logic/context/buildCoachPromptData.js'],
  ['src/ai-coach/server-logic/trainer-messaging/sendTrainerNotification.js', 'src/ai-coach/server-logic/trainer-messaging/sendTrainerNotification.js'],
  ['src/ai-coach/server-logic/vision/imageStorageService.js', 'src/ai-coach/server-logic/vision/imageStorageService.js'],
  ['src/ai-coach/server-logic/chat-api/shouldUseWebSearch.js', 'src/ai-coach/server-logic/chat-api/shouldUseWebSearch.js'],
  ['src/ai-coach/server-logic/macro-recalibration/recalculateMacrosFromCoach.js', 'src/ai-coach/server-logic/macro-recalibration/recalculateMacrosFromCoach.js'],

  // ── shared services split ──
  ['src/shared/api/baseUrl.js', 'src/shared/api/baseUrl.js'],
  ['src/shared/api/apiFetch.js', 'src/shared/api/apiFetch.js'],
  ['src/shared/api/apiAuthHeaders.js', 'src/shared/api/apiAuthHeaders.js'],
  ['src/shared/api/userProfileApi.js', 'src/shared/api/userProfileApi.js'],
  ['src/shared/api/pushNotifyApi.js', 'src/shared/api/pushNotifyApi.js'],
  ['src/shared/api/onboardingSync.js', 'src/shared/api/onboardingSync.js'],
  ['src/metrics/daily-metrics/saveDailyMetricsToFirestore.js', 'src/metrics/daily-metrics/saveDailyMetricsToFirestore.js'],
  ['src/metrics/daily-metrics/parseUserDailyMetrics.js', 'src/metrics/daily-metrics/parseUserDailyMetrics.js'],
  ['src/metrics/daily-metrics/dailyDashboardDayRollover.js', 'src/metrics/daily-metrics/dailyDashboardDayRollover.js'],
  ['src/metrics/daily-metrics/useLocalTodayDateKey.js', 'src/metrics/daily-metrics/useLocalTodayDateKey.js'],
  ['src/shared/notes-files/notesAndFilesService.js', 'src/shared/notes-files/notesAndFilesService.js'],
  ['src/shared/firestore/firestoreListenerUtils.js', 'src/shared/firestore/firestoreListenerUtils.js'],
  ['src/shared/firestore/firestorePagedQuery.js', 'src/shared/firestore/firestorePagedQuery.js'],
  ['src/shared/firestore/storage.js', 'src/shared/firestore/storage.js'],
  ['src/metrics/daily-metrics/latestLoggedWeight.js', 'src/metrics/daily-metrics/latestLoggedWeight.js'],
  ['src/notifications/notificationsService.js', 'src/notifications/notificationsService.js'],
  ['src/notifications/buildPushNotificationText.js', 'src/notifications/buildPushNotificationText.js'],
  ['src/shared/api/monitoring.js', 'src/shared/api/monitoring.js'],
  ['src/shared/api/logger.js', 'src/shared/api/logger.js'],
  ['src/shared/marketplace/trainerMarketplaceSync.js', 'src/shared/marketplace/trainerMarketplaceSync.js'],
  ['src/shared/photo-gallery/MyProgressPhotosScreen.jsx', 'src/shared/photo-gallery/MyProgressPhotosScreen.jsx'],
  ['src/shared/weekly-report/ViewWeekProgressReportScreen.jsx', 'src/shared/weekly-report/ViewWeekProgressReportScreen.jsx'],
  ['src/shared/workout-plans/BrowseSavedWorkoutsScreen.jsx', 'src/shared/workout-plans/BrowseSavedWorkoutsScreen.jsx'],
  ['src/messaging/ChatThreadScreen.jsx', 'src/messaging/ChatThreadScreen.jsx'],
  ['src/messaging/MyMessagesScreen.jsx', 'src/messaging/MyMessagesScreen.jsx'],
  ['src/shared/fitness-calculations/calculations.js', 'src/shared/fitness-calculations/calculations.js'],
  ['src/shared/workout-profile/profileCardIcons.js', 'src/shared/workout-profile/profileCardIcons.js'],
  ['src/shared/workout-profile/shouldShowProfileCard.js', 'src/shared/workout-profile/shouldShowProfileCard.js'],
  ['src/shared/trainer-location/trainerLocationService.js', 'src/shared/trainer-location/trainerLocationService.js'],
  ['src/metrics/daily-quotes/dailyQuotesList.json', 'src/metrics/daily-quotes/dailyQuotesList.json'],
  ['src/ai-coach/tools/parseCoachToolCalls.js', 'src/ai-coach/tools/parseCoachToolCalls.js'],
  ['src/shared/accessibility/a11yProps.js', 'src/shared/accessibility/a11yProps.js'],
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
