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
  ['src/client/home/clientHomeComponents.jsx', 'src/client/home/clientHomeComponents.jsx'],
  ['src/client/home/clientAppStyles.js', 'src/client/home/clientAppStyles.js'],
  ['src/client/home/useClientHomeBootstrap.js', 'src/client/home/useClientHomeBootstrap.js'],
  ['src/client/home/useClientHomeDailyMetrics.js', 'src/client/home/useClientHomeDailyMetrics.js'],
  ['src/client/navigation/useClientScreenNavigation.js', 'src/client/navigation/useClientScreenNavigation.js'],
  ['src/client/dashboard/coachingBillingLabel.js', 'src/client/dashboard/coachingBillingLabel.js'],
  ['src/client/dashboard/MyDashboardScreen.jsx', 'src/client/dashboard/MyDashboardScreen.jsx'],
  ['src/client/dashboard/DashboardHeroCard.jsx', 'src/client/dashboard/DashboardHeroCard.jsx'],
  ['src/client/dashboard/PremiumStatsSection.jsx', 'src/client/dashboard/PremiumStatsSection.jsx'],
  ['src/client/dashboard/PremiumTrainerCard.jsx', 'src/client/dashboard/PremiumTrainerCard.jsx'],
  ['src/client/dashboard/ReviewSubmitSheet.js', 'src/client/dashboard/ReviewSubmitSheet.js'],
  ['src/client/files/ClientFilesScreen.jsx', 'src/client/files/ClientFilesScreen.jsx'],
  ['src/client/files/FileCard.jsx', 'src/client/files/FileCard.jsx'],
  ['src/client/files/MyFilesSection.jsx', 'src/client/files/MyFilesSection.jsx'],
  ['src/client/files/NotesFromTrainerSection.jsx', 'src/client/files/NotesFromTrainerSection.jsx'],
  ['src/client/files/TrainerSharedSection.jsx', 'src/client/files/TrainerSharedSection.jsx'],
  ['src/client/files/TrainerSharedFilesModal.jsx', 'src/client/files/TrainerSharedFilesModal.jsx'],
  ['src/client/messaging/MessagingScreen.js', 'src/client/messaging/MessagingScreen.js'],
  ['src/client/messaging/ConversationsListScreen.js', 'src/client/messaging/ConversationsListScreen.js'],
  ['src/client/weekly-report/WeeklyReportScreen.jsx', 'src/client/weekly-report/WeeklyReportScreen.jsx'],
  ['src/client/workout-plans/AIWorkoutPlansScreen.js', 'src/client/workout-plans/AIWorkoutPlansScreen.js'],
  ['src/client/workout-plans/PlanViewerScreen.jsx', 'src/client/workout-plans/PlanViewerScreen.jsx'],
  ['src/client/meal-plan/MealPlanHomeScreen.js', 'src/client/meal-plan/MealPlanHomeScreen.js'],
  ['src/client/photo-gallery/PhotoGalleryScreen.js', 'src/client/photo-gallery/PhotoGalleryScreen.js'],
  ['src/client/marketplace/FindTrainerScreen.js', 'src/client/marketplace/FindTrainerScreen.js'],
  ['src/client/marketplace/TrainerSearchScreen.js', 'src/client/marketplace/TrainerSearchScreen.js'],
  ['src/client/marketplace/TrainerCard.jsx', 'src/client/marketplace/TrainerCard.jsx'],
  ['src/client/marketplace/MarketplaceUI.jsx', 'src/client/marketplace/MarketplaceUI.jsx'],
  ['src/client/marketplace/MarketplaceGlass.jsx', 'src/client/marketplace/MarketplaceGlass.jsx'],
  ['src/client/marketplace/FilterModal.js', 'src/client/marketplace/FilterModal.js'],
  ['src/client/marketplace/TrainerRequestIntroModal.jsx', 'src/client/marketplace/TrainerRequestIntroModal.jsx'],
  ['src/client/marketplace/TrainerRequestConfirmModal.jsx', 'src/client/marketplace/TrainerRequestConfirmModal.jsx'],
  ['src/client/marketplace/MarketplaceTrainerProfileSheet.jsx', 'src/client/marketplace/MarketplaceTrainerProfileSheet.jsx'],
  ['src/client/marketplace/marketplaceFilters.js', 'src/client/marketplace/marketplaceFilters.js'],

  // ── trainer ──
  ['src/trainer/dashboard/TrainerDashboardContent.jsx', 'src/trainer/dashboard/TrainerDashboardContent.jsx'],
  ['src/trainer/dashboard/trainerDashboardUi.jsx', 'src/trainer/dashboard/trainerDashboardUi.jsx'],
  ['src/trainer/dashboard/TrainerMarketplaceModal.js', 'src/trainer/dashboard/TrainerMarketplaceModal.js'],
  ['src/trainer/progress-tab/TrainerProgressTab.jsx', 'src/trainer/progress-tab/TrainerProgressTab.jsx'],
  ['src/trainer/nutrition-tab/TrainerNutritionTab.jsx', 'src/trainer/nutrition-tab/TrainerNutritionTab.jsx'],
  ['src/trainer/calendar-tab/TrainerCalendarTab.jsx', 'src/trainer/calendar-tab/TrainerCalendarTab.jsx'],
  ['src/trainer/client-requests/ClientRequestsScreen.js', 'src/trainer/client-requests/ClientRequestsScreen.js'],
  ['src/trainer/client-requests/useTrainerPendingRequests.js', 'src/trainer/client-requests/useTrainerPendingRequests.js'],
  ['src/trainer/client-requests/trainerPendingRequestsService.js', 'src/trainer/client-requests/trainerPendingRequestsService.js'],
  ['src/trainer/clients-list/TrainerClientsListScreen.jsx', 'src/trainer/clients-list/TrainerClientsListScreen.jsx'],
  ['src/trainer/clients-list/useTrainerClients.js', 'src/trainer/clients-list/useTrainerClients.js'],
  ['src/trainer/clients-list/loadTrainerClientRoster.js', 'src/trainer/clients-list/loadTrainerClientRoster.js'],
  ['src/trainer/client-detail/TrainerClientDetailScreen.jsx', 'src/trainer/client-detail/TrainerClientDetailScreen.jsx'],
  ['src/trainer/sessions/SessionSchedulingScreen.jsx', 'src/trainer/sessions/SessionSchedulingScreen.jsx'],
  ['src/trainer/sessions/SessionFormScreen.jsx', 'src/trainer/sessions/SessionFormScreen.jsx'],
  ['src/trainer/sessions/SessionCard.jsx', 'src/trainer/sessions/SessionCard.jsx'],
  ['src/trainer/sessions/MonthCalendar.jsx', 'src/trainer/sessions/MonthCalendar.jsx'],
  ['src/trainer/sessions/WheelPicker.jsx', 'src/trainer/sessions/WheelPicker.jsx'],
  ['src/trainer/sessions/use-sessions.js', 'src/trainer/sessions/use-sessions.js'],
  ['src/trainer/sessions/pushSessionNotification.js', 'src/trainer/sessions/pushSessionNotification.js'],
  ['src/trainer/documents/DocumentEditorModal.js', 'src/trainer/documents/DocumentEditorModal.js'],
  ['src/trainer/documents/SpreadsheetEditorModal.js', 'src/trainer/documents/SpreadsheetEditorModal.js'],
  ['src/trainer/documents/ShareDocumentModal.js', 'src/trainer/documents/ShareDocumentModal.js'],
  ['src/trainer/documents/EditorHeaderActions.jsx', 'src/trainer/documents/EditorHeaderActions.jsx'],
  ['src/trainer/documents/EditorStatusPill.js', 'src/trainer/documents/EditorStatusPill.js'],
  ['src/trainer/documents/editorTheme.js', 'src/trainer/documents/editorTheme.js'],
  ['src/trainer/documents/editorGradients.jsx', 'src/trainer/documents/editorGradients.jsx'],
  ['src/trainer/payments/PaymentsScreen.jsx', 'src/trainer/payments/PaymentsScreen.jsx'],
  ['src/trainer/workout-plans/ManualWorkoutPlanBuilderScreen.jsx', 'src/trainer/workout-plans/ManualWorkoutPlanBuilderScreen.jsx'],
  ['src/trainer/workout-plans/manualWorkoutPlanService.js', 'src/trainer/workout-plans/manualWorkoutPlanService.js'],
  ['src/trainer/workout-plans/manualExerciseLibrarySeed.js', 'src/trainer/workout-plans/manualExerciseLibrarySeed.js'],
  ['src/trainer/workout-plans/AIWorkoutPlansScreen.js', 'src/trainer/workout-plans/AIWorkoutPlansScreen.js'],
  ['src/trainer/weekly-report/TrainerWeeklyReportSection.jsx', 'src/trainer/weekly-report/TrainerWeeklyReportSection.jsx'],
  ['src/trainer/weekly-report/WeeklyReportPremium.jsx', 'src/trainer/weekly-report/WeeklyReportPremium.jsx'],
  ['src/trainer/weekly-report/WeeklyReportHeroCard.jsx', 'src/trainer/weekly-report/WeeklyReportHeroCard.jsx'],
  ['src/trainer/weekly-report/TrainerWeeklyReportScreen.jsx', 'src/trainer/weekly-report/TrainerWeeklyReportScreen.jsx'],
  ['src/trainer/messaging/ConversationsListScreen.js', 'src/trainer/messaging/ConversationsListScreen.js'],
  ['src/trainer/messaging/TrainerMessagingScreen.js', 'src/trainer/messaging/TrainerMessagingScreen.js'],
  ['src/trainer/photo-gallery/PhotoGalleryScreen.js', 'src/trainer/photo-gallery/PhotoGalleryScreen.js'],
  ['src/trainer/marketplace/TrainerSearchScreen.js', 'src/trainer/marketplace/TrainerSearchScreen.js'],
  ['src/trainer/navigation/useTrainerScreenNavigation.js', 'src/trainer/navigation/useTrainerScreenNavigation.js'],
  ['src/trainer/crm/trainerClientFirestorePaths.js', 'src/trainer/crm/trainerClientFirestorePaths.js'],
  ['src/trainer/crm/resolveLinkedTrainerClients.js', 'src/trainer/crm/resolveLinkedTrainerClients.js'],
  ['src/trainer/crm/formatClientName.js', 'src/trainer/crm/formatClientName.js'],
  ['src/trainer/crm/trainerFirestoreErrors.js', 'src/trainer/crm/trainerFirestoreErrors.js'],

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
  ['src/nutrition/food-search/foodSearchProvider.js', 'src/nutrition/food-search/foodSearchProvider.js'],
  ['src/nutrition/food-search/rankFoodSearchResults.js', 'src/nutrition/food-search/rankFoodSearchResults.js'],
  ['src/nutrition/food-search/casualMenuSearch.js', 'src/nutrition/food-search/casualMenuSearch.js'],
  ['src/nutrition/food-search/formatFoodSearchTitle.js', 'src/nutrition/food-search/formatFoodSearchTitle.js'],
  ['src/nutrition/food-search/validateRestaurantResult.js', 'src/nutrition/food-search/validateRestaurantResult.js'],
  ['src/nutrition/food-search/normalizeFoodQuery.js', 'src/nutrition/food-search/normalizeFoodQuery.js'],
  ['src/nutrition/barcode/BarcodeScannerScreen.js', 'src/nutrition/barcode/BarcodeScannerScreen.js'],
  ['src/nutrition/barcode/renderScannedBarcode.js', 'src/nutrition/barcode/renderScannedBarcode.js'],
  ['src/nutrition/food-details/NutritionFactsScreen.jsx', 'src/nutrition/food-details/NutritionFactsScreen.jsx'],
  ['src/nutrition/food-details/EditServingModal.jsx', 'src/nutrition/food-details/EditServingModal.jsx'],
  ['src/nutrition/food-details/FoodItem.js', 'src/nutrition/food-details/FoodItem.js'],
  ['src/nutrition/food-details/parseNutritionLabel.js', 'src/nutrition/food-details/parseNutritionLabel.js'],
  ['src/nutrition/food-details/calculateServingSize.js', 'src/nutrition/food-details/calculateServingSize.js'],
  ['src/nutrition/food-details/normalizeNutritionData.js', 'src/nutrition/food-details/normalizeNutritionData.js'],
  ['src/nutrition/food-details/formatFoodBrand.js', 'src/nutrition/food-details/formatFoodBrand.js'],
  ['src/nutrition/quick-add/QuickAddNutrition.jsx', 'src/nutrition/quick-add/QuickAddNutrition.jsx'],
  ['src/nutrition/settings/NutritionSettingsScreen.js', 'src/nutrition/settings/NutritionSettingsScreen.js'],
  ['src/nutrition/settings/NutritionOnboardingScreen.jsx', 'src/nutrition/settings/NutritionOnboardingScreen.jsx'],
  ['src/nutrition/nutritionTheme.js', 'src/nutrition/nutritionTheme.js'],

  // ── aiChat ──
  ['src/aiChat/chat-home/AIChatHomeScreen.jsx', 'src/aiChat/chat-home/AIChatHomeScreen.jsx'],
  ['src/aiChat/chat-thread/AIChatScreen.jsx', 'src/aiChat/chat-thread/AIChatScreen.jsx'],
  ['src/aiChat/chat-thread/CoachFormattedReply.jsx', 'src/aiChat/chat-thread/CoachFormattedReply.jsx'],
  ['src/aiChat/chat-thread/CoachPasteSheet.jsx', 'src/aiChat/chat-thread/CoachPasteSheet.jsx'],
  ['src/aiChat/chat-thread/CoachWebSources.jsx', 'src/aiChat/chat-thread/CoachWebSources.jsx'],
  ['src/aiChat/chat-thread/CoachSourcePreviewSheet.jsx', 'src/aiChat/chat-thread/CoachSourcePreviewSheet.jsx'],
  ['src/aiChat/chat-thread/ToolConfirmationModal.jsx', 'src/aiChat/chat-thread/ToolConfirmationModal.jsx'],
  ['src/aiChat/chat-thread/coachMarkdownStyles.js', 'src/aiChat/chat-thread/coachMarkdownStyles.js'],
  ['src/aiChat/chat-thread/renderSourcePreview.js', 'src/aiChat/chat-thread/renderSourcePreview.js'],
  ['src/aiChat/chat-thread/coachQuickPrompts.js', 'src/aiChat/chat-thread/coachQuickPrompts.js'],
  ['src/aiChat/chat-thread/pickAttachmentType.js', 'src/aiChat/chat-thread/pickAttachmentType.js'],
  ['src/aiChat/chat-thread/openAttachmentMenu.js', 'src/aiChat/chat-thread/openAttachmentMenu.js'],
  ['src/aiChat/chat-thread/coachClipboard.js', 'src/aiChat/chat-thread/coachClipboard.js'],
  ['src/aiChat/chat-thread/useCoachComposerInput.js', 'src/aiChat/chat-thread/useCoachComposerInput.js'],
  ['src/aiChat/chat-thread/useCoachComposerKeyboard.js', 'src/aiChat/chat-thread/useCoachComposerKeyboard.js'],
  ['src/aiChat/trainer-coach-mode/TrainerCoachClientBar.jsx', 'src/aiChat/trainer-coach-mode/TrainerCoachClientBar.jsx'],
  ['src/aiChat/voice/VoiceAIHomeScreen.jsx', 'src/aiChat/voice/VoiceAIHomeScreen.jsx'],
  ['src/aiChat/voice/useVoiceToCoach.js', 'src/aiChat/voice/useVoiceToCoach.js'],
  ['src/aiChat/persistence/saveCoachMessagesToFirestore.js', 'src/aiChat/persistence/saveCoachMessagesToFirestore.js'],
  ['src/aiChat/persistence/coachConversationDebug.js', 'src/aiChat/persistence/coachConversationDebug.js'],
  ['src/aiChat/aiCoachUiTokens.js', 'src/aiChat/aiCoachUiTokens.js'],
  ['src/aiChat/AICoachTestSuite.jsx', 'src/aiChat/AICoachTestSuite.jsx'],

  // tool modals -> tool-modals/
  ...[
    'AdjustMacrosModal.jsx', 'BookSessionModal.jsx', 'DeleteLogModal.jsx', 'LogMoodModal.jsx',
    'LogNutritionModal.jsx', 'LogRestDayModal.jsx', 'LogSleepModal.jsx', 'LogStepsModal.jsx',
    'LogWaterModal.jsx', 'NotifyTrainerModal.jsx', 'OpenWorkoutPlanModal.jsx', 'RateEnergyModal.jsx',
    'RateWorkoutModal.jsx', 'UpdateGoalModal.jsx', 'UpdateWorkoutModal.jsx', 'toolModalShared.js',
  ].map((f) => [`src/aiChat/tool-modals/${f}`, `src/aiChat/tool-modals/${f}`]),

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
  ['src/ai/chat-api/aiCoachServerService.js', 'src/ai/chat-api/aiCoachServerService.js'],
  ['src/ai/chat-api/conversationService.js', 'src/ai/chat-api/conversationService.js'],
  ['src/ai/chat-api/chatStorageService.js', 'src/ai/chat-api/chatStorageService.js'],
  ['src/ai/tools/executeCoachTool.js', 'src/ai/tools/executeCoachTool.js'],
  ['src/ai/tools/coachToolUx.js', 'src/ai/tools/coachToolUx.js'],
  ['src/ai/tools/validateCoachToolProposal.js', 'src/ai/tools/validateCoachToolProposal.js'],
  ['src/ai/tools/parseUserMessageForTools.js', 'src/ai/tools/parseUserMessageForTools.js'],
  ['src/ai/tools/cleanupToolParams.js', 'src/ai/tools/cleanupToolParams.js'],
  ['src/ai/tools/parseDeleteLogRequest.js', 'src/ai/tools/parseDeleteLogRequest.js'],
  ['src/ai/context/CoachContextProvider.js', 'src/ai/context/CoachContextProvider.js'],
  ['src/ai/context/gatherCoachWeeklyStats.js', 'src/ai/context/gatherCoachWeeklyStats.js'],
  ['src/ai/context/gatherCoachContextFromUser.js', 'src/ai/context/gatherCoachContextFromUser.js'],
  ['src/ai/trainer-messaging/sendTrainerNotification.js', 'src/ai/trainer-messaging/sendTrainerNotification.js'],
  ['src/ai/vision/imageStorageService.js', 'src/ai/vision/imageStorageService.js'],
  ['src/ai/chat-api/detectWebSearchRequest.js', 'src/ai/chat-api/detectWebSearchRequest.js'],
  ['src/ai/macro-recalibration/recalculateMacrosFromCoach.js', 'src/ai/macro-recalibration/recalculateMacrosFromCoach.js'],

  // ── shared services split ──
  ['src/shared/api/baseUrl.js', 'src/shared/api/baseUrl.js'],
  ['src/shared/api/apiFetch.js', 'src/shared/api/apiFetch.js'],
  ['src/shared/api/apiAuthHeaders.js', 'src/shared/api/apiAuthHeaders.js'],
  ['src/shared/api/userProfileApi.js', 'src/shared/api/userProfileApi.js'],
  ['src/shared/api/pushNotifyApi.js', 'src/shared/api/pushNotifyApi.js'],
  ['src/shared/api/onboardingSync.js', 'src/shared/api/onboardingSync.js'],
  ['src/shared/daily-metrics/saveDailyMetricsToFirestore.js', 'src/shared/daily-metrics/saveDailyMetricsToFirestore.js'],
  ['src/shared/daily-metrics/dailyMetricsParse.cjs', 'src/shared/daily-metrics/dailyMetricsParse.cjs'],
  ['src/shared/daily-metrics/dailyDashboardDayRollover.js', 'src/shared/daily-metrics/dailyDashboardDayRollover.js'],
  ['src/shared/daily-metrics/useLocalTodayDateKey.js', 'src/shared/daily-metrics/useLocalTodayDateKey.js'],
  ['src/shared/notes-files/notesAndFilesService.js', 'src/shared/notes-files/notesAndFilesService.js'],
  ['src/shared/firestore/firestoreListenerUtils.js', 'src/shared/firestore/firestoreListenerUtils.js'],
  ['src/shared/firestore/firestorePagedQuery.js', 'src/shared/firestore/firestorePagedQuery.js'],
  ['src/shared/firestore/storage.js', 'src/shared/firestore/storage.js'],
  ['src/shared/daily-metrics/latestLoggedWeight.js', 'src/shared/daily-metrics/latestLoggedWeight.js'],
  ['src/shared/notifications/notificationsService.js', 'src/shared/notifications/notificationsService.js'],
  ['src/shared/notifications/pushNotificationText.js', 'src/shared/notifications/pushNotificationText.js'],
  ['src/shared/api/monitoring.js', 'src/shared/api/monitoring.js'],
  ['src/shared/api/logger.js', 'src/shared/api/logger.js'],
  ['src/shared/marketplace/trainerMarketplaceSync.js', 'src/shared/marketplace/trainerMarketplaceSync.js'],
  ['src/shared/photo-gallery/PhotoGalleryScreen.js', 'src/shared/photo-gallery/PhotoGalleryScreen.js'],
  ['src/shared/weekly-report/WeeklyReportScreen.jsx', 'src/shared/weekly-report/WeeklyReportScreen.jsx'],
  ['src/shared/workout-plans/AIWorkoutPlansScreen.js', 'src/shared/workout-plans/AIWorkoutPlansScreen.js'],
  ['src/shared/messaging/MessagingScreen.js', 'src/shared/messaging/MessagingScreen.js'],
  ['src/shared/messaging/ConversationsListScreen.js', 'src/shared/messaging/ConversationsListScreen.js'],
  ['src/shared/fitness-calculations/calculations.js', 'src/shared/fitness-calculations/calculations.js'],
  ['src/shared/workout-profile/profileCardIcons.js', 'src/shared/workout-profile/profileCardIcons.js'],
  ['src/shared/workout-profile/shouldShowProfileCard.js', 'src/shared/workout-profile/shouldShowProfileCard.js'],
  ['src/shared/trainer-location/trainerLocationService.js', 'src/shared/trainer-location/trainerLocationService.js'],
  ['src/shared/daily-quotes/dailyQuotesList.json', 'src/shared/daily-quotes/dailyQuotesList.json'],
  ['src/shared/coach-tools/parseCoachToolCalls.js', 'src/shared/coach-tools/parseCoachToolCalls.js'],
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
