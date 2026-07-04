#!/usr/bin/env node
/** Second pass: rewrite relative import path segments after feature-folder move. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const REPLACEMENTS = [
  // client
  ['client/dashboard/TrainingDashboardScreen', 'client/dashboard/TrainingDashboardScreen'],
  ['client/files/ClientFilesScreen', 'client/files/ClientFilesScreen'],
  ['client/messaging/ChatThreadScreen', 'client/messaging/ChatThreadScreen'],
  ['client/messaging/MyMessagesScreen', 'client/messaging/MyMessagesScreen'],
  ['client/weekly-report/ViewWeekProgressReportScreen', 'client/weekly-report/ViewWeekProgressReportScreen'],
  ['client/workout-plans/BrowseSavedWorkoutsScreen', 'client/workout-plans/BrowseSavedWorkoutsScreen'],
  ['client/workout-plans/ViewMyWorkoutPlanScreen', 'client/workout-plans/ViewMyWorkoutPlanScreen'],
  ['client/meal-plan/LogTodaysMealsScreen', 'client/meal-plan/LogTodaysMealsScreen'],
  ['client/photo-gallery/MyProgressPhotosScreen', 'client/photo-gallery/MyProgressPhotosScreen'],
  ['client/home/', 'client/home/'],
  ['client/files/', 'client/files/'],
  ['client/dashboard/PremiumTrainerCard', 'client/dashboard/PremiumTrainerCard'],
  ['client/dashboard/PremiumStatsSection', 'client/dashboard/PremiumStatsSection'],
  ['client/dashboard/DashboardHeroCard', 'client/dashboard/DashboardHeroCard'],
  ['client/dashboard/ReviewSubmitSheet', 'client/dashboard/ReviewSubmitSheet'],
  ['client/files/TrainerSharedFilesModal', 'client/files/TrainerSharedFilesModal'],
  ['client/home/useClientHomeBootstrap', 'client/home/useClientHomeBootstrap'],
  ['client/home/useClientHomeDailyMetrics', 'client/home/useClientHomeDailyMetrics'],
  ['client/navigation/useClientScreenNavigation', 'client/navigation/useClientScreenNavigation'],
  ['client/dashboard/coachingBillingLabel', 'client/dashboard/coachingBillingLabel'],
  ['client/marketplace/', 'client/marketplace/'],
  ['client/marketplace/', 'client/marketplace/'],
  ['client/marketplace/', 'client/marketplace/'],

  // trainer
  ['trainer/dashboard/TrainerDashboardContent', 'trainer/dashboard/TrainerDashboardContent'],
  ['trainer/progress-tab/TrainerProgressTab', 'trainer/progress-tab/TrainerProgressTab'],
  ['trainer/nutrition-tab/TrainerNutritionTab', 'trainer/nutrition-tab/TrainerNutritionTab'],
  ['trainer/calendar-tab/TrainerCalendarTab', 'trainer/calendar-tab/TrainerCalendarTab'],
  ['trainer/client-requests/NewTraineeRequestsScreen', 'trainer/client-requests/NewTraineeRequestsScreen'],
  ['trainer/clients-list/MyTraineesScreen', 'trainer/clients-list/MyTraineesScreen'],
  ['trainer/client-detail/ManageTraineeScreen', 'trainer/client-detail/ManageTraineeScreen'],
  ['trainer/sessions/BookTraineeSessionScreen', 'trainer/sessions/BookTraineeSessionScreen'],
  ['trainer/sessions/ScheduleTrainingSessionScreen', 'trainer/sessions/ScheduleTrainingSessionScreen'],
  ['trainer/payments/PaymentsScreen', 'trainer/payments/PaymentsScreen'],
  ['trainer/workout-plans/ManualWorkoutPlanBuilderScreen', 'trainer/workout-plans/ManualWorkoutPlanBuilderScreen'],
  ['trainer/weekly-report/TrainerViewWeekProgressReportScreen', 'trainer/weekly-report/TrainerViewWeekProgressReportScreen'],
  ['trainer/messaging/MyMessagesScreen', 'trainer/messaging/MyMessagesScreen'],
  ['trainer/messaging/ChatWithTraineeScreen', 'trainer/messaging/ChatWithTraineeScreen'],
  ['trainer/photo-gallery/MyProgressPhotosScreen', 'trainer/photo-gallery/MyProgressPhotosScreen'],
  ['trainer/marketplace/SearchTrainersScreen', 'trainer/marketplace/SearchTrainersScreen'],
  ['trainer/workout-plans/BrowseSavedWorkoutsScreen', 'trainer/workout-plans/BrowseSavedWorkoutsScreen'],
  ['trainer/dashboard/', 'trainer/dashboard/'],
  ['trainer/documents/', 'trainer/documents/'],
  ['trainer/sessions/', 'trainer/sessions/'],
  ['trainer/weekly-report/', 'trainer/weekly-report/'],
  ['trainer/dashboard/TrainerMarketplaceModal', 'trainer/dashboard/TrainerMarketplaceModal'],
  ['trainer/weekly-report/TrainerWeeklyReportSection', 'trainer/weekly-report/TrainerWeeklyReportSection'],
  ['trainer/sessions/WheelPicker', 'trainer/sessions/WheelPicker'],
  ['trainer/clients-list/useTrainerClients', 'trainer/clients-list/useTrainerClients'],
  ['trainer/client-requests/useTrainerPendingRequests', 'trainer/client-requests/useTrainerPendingRequests'],
  ['trainer/navigation/useTrainerScreenNavigation', 'trainer/navigation/useTrainerScreenNavigation'],
  ['trainer/sessions/useMyTrainingSessions', 'trainer/sessions/useMyTrainingSessions'],
  ['trainer/clients-list/loadMyTraineeRoster', 'trainer/clients-list/loadMyTraineeRoster'],
  ['trainer/workout-plans/manualWorkoutPlanService', 'trainer/workout-plans/manualWorkoutPlanService'],
  ['trainer/sessions/pushSessionNotification', 'trainer/sessions/pushSessionNotification'],
  ['trainer/client-requests/loadPendingTraineeRequests', 'trainer/client-requests/loadPendingTraineeRequests'],
  ['trainer/crm/trainerClientFirestorePaths', 'trainer/crm/trainerClientFirestorePaths'],
  ['trainer/crm/loadMyLinkedTrainees', 'trainer/crm/loadMyLinkedTrainees'],
  ['trainer/crm/getTraineeDisplayName', 'trainer/crm/getTraineeDisplayName'],
  ['trainer/crm/trainerFirestoreErrors', 'trainer/crm/trainerFirestoreErrors'],
  ['trainer/workout-plans/manualExerciseLibrarySeed', 'trainer/workout-plans/manualExerciseLibrarySeed'],

  // nutrition
  ['nutrition/daily-log/NutritionContainer', 'nutrition/daily-log/NutritionContainer'],
  ['nutrition/daily-log/NutritionScreen', 'nutrition/daily-log/NutritionScreen'],
  ['nutrition/food-search/FoodSearchScreen', 'nutrition/food-search/FoodSearchScreen'],
  ['nutrition/barcode/BarcodeScannerScreen', 'nutrition/barcode/BarcodeScannerScreen'],
  ['nutrition/food-details/NutritionFactsScreen', 'nutrition/food-details/NutritionFactsScreen'],
  ['nutrition/quick-add/QuickAddNutrition', 'nutrition/quick-add/QuickAddNutrition'],
  ['nutrition/settings/NutritionSettingsScreen', 'nutrition/settings/NutritionSettingsScreen'],
  ['nutrition/settings/NutritionOnboardingWizardScreen', 'nutrition/settings/NutritionOnboardingWizardScreen'],
  ['nutrition/daily-log/logFoodToFirestore', 'nutrition/daily-log/logFoodToFirestore'],
  ['nutrition/food-search/searchFoodsService', 'nutrition/food-search/searchFoodsService'],
  ['nutrition/food-search/sortBestFoodMatches', 'nutrition/food-search/sortBestFoodMatches'],
  ['nutrition/daily-log/NutritionDayPicker', 'nutrition/daily-log/NutritionDayPicker'],
  ['nutrition/daily-log/MealCard', 'nutrition/daily-log/MealCard'],
  ['nutrition/daily-log/MacroBar', 'nutrition/daily-log/MacroBar'],
  ['nutrition/food-search/ConfirmFoodSelectionSheet', 'nutrition/food-search/ConfirmFoodSelectionSheet'],
  ['nutrition/food-search/SearchQualityCard', 'nutrition/food-search/SearchQualityCard'],
  ['nutrition/food-details/EditServingModal', 'nutrition/food-details/EditServingModal'],
  ['nutrition/food-details/FoodItem', 'nutrition/food-details/FoodItem'],
  ['nutrition/food-details/calculateServingSize', 'nutrition/food-details/calculateServingSize'],
  ['nutrition/food-details/parseNutritionLabel', 'nutrition/food-details/parseNutritionLabel'],
  ['nutrition/food-details/fixFoodNutritionNumbers', 'nutrition/food-details/fixFoodNutritionNumbers'],
  ['nutrition/food-search/normalizeFoodQuery', 'nutrition/food-search/normalizeFoodQuery'],
  ['nutrition/food-details/cleanFoodBrandName', 'nutrition/food-details/cleanFoodBrandName'],
  ['nutrition/barcode/renderScannedBarcode', 'nutrition/barcode/renderScannedBarcode'],
  ['nutrition/food-search/casualMenuSearch', 'nutrition/food-search/casualMenuSearch'],
  ['nutrition/food-search/cleanFoodCardLabels', 'nutrition/food-search/cleanFoodCardLabels'],
  ['nutrition/food-search/isReliableRestaurantFood', 'nutrition/food-search/isReliableRestaurantFood'],

  // aiChat
  ['aiChat/chat-home/StartCoachChatScreen', 'aiChat/chat-home/StartCoachChatScreen'],
  ['aiChat/chat-thread/ChatWithCoachScreen', 'aiChat/chat-thread/ChatWithCoachScreen'],
  ['aiChat/voice/VoiceCoachScreen', 'aiChat/voice/VoiceCoachScreen'],
  ['aiChat/chat-thread/CoachFormattedReply', 'aiChat/chat-thread/CoachFormattedReply'],
  ['aiChat/chat-thread/CoachPasteSheet', 'aiChat/chat-thread/CoachPasteSheet'],
  ['aiChat/chat-thread/CoachWebSources', 'aiChat/chat-thread/CoachWebSources'],
  ['aiChat/chat-thread/CoachSourcePreviewSheet', 'aiChat/chat-thread/CoachSourcePreviewSheet'],
  ['aiChat/chat-thread/ToolConfirmationModal', 'aiChat/chat-thread/ToolConfirmationModal'],
  ['aiChat/trainer-coach-mode/TrainerCoachClientBar', 'aiChat/trainer-coach-mode/TrainerCoachClientBar'],
  ['aiChat/chat-thread/useCoachComposerInput', 'aiChat/chat-thread/useCoachComposerInput'],
  ['aiChat/chat-thread/useCoachComposerKeyboard', 'aiChat/chat-thread/useCoachComposerKeyboard'],
  ['aiChat/voice/useVoiceToCoach', 'aiChat/voice/useVoiceToCoach'],
  ['aiChat/chat-thread/coachMarkdownStyles', 'aiChat/chat-thread/coachMarkdownStyles'],
  ['aiChat/chat-thread/renderSourcePreview', 'aiChat/chat-thread/renderSourcePreview'],
  ['aiChat/chat-thread/coachQuickPrompts', 'aiChat/chat-thread/coachQuickPrompts'],
  ['aiChat/chat-thread/pickAttachmentType', 'aiChat/chat-thread/pickAttachmentType'],
  ['aiChat/chat-thread/openAttachmentMenu', 'aiChat/chat-thread/openAttachmentMenu'],
  ['aiChat/chat-thread/formatCoachMessageText', 'aiChat/chat-thread/formatCoachMessageText'],
  ['aiChat/persistence/saveCoachMessages', 'aiChat/persistence/saveCoachMessages'],
  ['aiChat/persistence/coachConversationDebug', 'aiChat/persistence/coachConversationDebug'],
  ['aiChat/tool-modals/', 'aiChat/tool-modals/'],

  // workouts
  ['workouts/active-workout/workout', 'workouts/active-workout/workout'],
  ['workouts/plan-builder/workoutPlanBuilderFieldEditBody', 'workouts/plan-builder/workoutPlanBuilderFieldEditBody'],
  ['workouts/active-workout/workoutService', 'workouts/active-workout/workoutService'],
  ['workouts/plan-viewer/workoutPlanPdfService', 'workouts/plan-viewer/workoutPlanPdfService'],
  ['workouts/exercise-library/clientWorkoutPlansLibrary', 'workouts/exercise-library/clientWorkoutPlansLibrary'],
  ['workouts/plan-generator/useWorkoutGeneration', 'workouts/plan-generator/useWorkoutGeneration'],
  ['workouts/exercise-library/useYouTubeAPI', 'workouts/exercise-library/useYouTubeAPI'],
  ['workouts/plan-generator/requestWorkoutPlan', 'workouts/plan-generator/requestWorkoutPlan'],
  ['workouts/plan-generator/workoutPlanGenerationSession', 'workouts/plan-generator/workoutPlanGenerationSession'],
  ['workouts/plan-generator/trackWorkoutGenerationUsage', 'workouts/plan-generator/trackWorkoutGenerationUsage'],
  ['workouts/plan-generator/workoutOnboardingFormConfig', 'workouts/plan-generator/workoutOnboardingFormConfig'],
  ['workouts/plan-generator/workoutOnboardingPayload', 'workouts/plan-generator/workoutOnboardingPayload'],
  ['workouts/plan-generator/workoutPlanParsing', 'workouts/plan-generator/workoutPlanParsing'],
  ['workouts/plan-viewer/WorkoutPlanResult', 'workouts/plan-viewer/WorkoutPlanResult'],
  ['workouts/plan-viewer/WorkoutPlanPdfViewerModal', 'workouts/plan-viewer/WorkoutPlanPdfViewerModal'],
  ['workouts/plan-viewer/workoutPlanUiComponents', 'workouts/plan-viewer/workoutPlanUiComponents'],
  ['workouts/exercise-library/WorkoutExerciseLibraryTab', 'workouts/exercise-library/WorkoutExerciseLibraryTab'],
  ['workouts/exercise-library/ExerciseCard', 'workouts/exercise-library/ExerciseCard'],
  ['workouts/exercise-library/ShortsCard', 'workouts/exercise-library/ShortsCard'],
  ['workouts/exercise-library/VideoPlayerModal', 'workouts/exercise-library/VideoPlayerModal'],
  ['workouts/active-workout/EditModalForm_RN', 'workouts/active-workout/EditModalForm_RN'],
  ['workouts/active-workout/WorkoutProfilePillGrid', 'workouts/active-workout/WorkoutProfilePillGrid'],

  // ai
  ['ai/chat-api/sendCoachMessageToServer', 'ai/chat-api/sendCoachMessageToServer'],
  ['ai/chat-api/loadMoreCoachConversations', 'ai/chat-api/loadMoreCoachConversations'],
  ['ai/chat-api/chatStorageService', 'ai/chat-api/chatStorageService'],
  ['ai/trainer-messaging/sendTrainerNotification', 'ai/trainer-messaging/sendTrainerNotification'],
  ['ai/vision/imageStorageService', 'ai/vision/imageStorageService'],
  ['ai/tools/runCoachAction', 'ai/tools/runCoachAction'],
  ['ai/tools/chooseCoachActionUI', 'ai/tools/chooseCoachActionUI'],
  ['ai/tools/shouldShowCoachAction', 'ai/tools/shouldShowCoachAction'],
  ['ai/tools/findCoachRequestsInText', 'ai/tools/findCoachRequestsInText'],
  ['ai/tools/cleanupToolParams', 'ai/tools/cleanupToolParams'],
  ['ai/tools/detectDeleteFoodRequest', 'ai/tools/detectDeleteFoodRequest'],
  ['ai/context/loadCoachPersonalContext', 'ai/context/loadCoachPersonalContext'],
  ['ai/context/loadCoachWeeklyStats', 'ai/context/loadCoachWeeklyStats'],
  ['ai/context/buildCoachPromptData', 'ai/context/buildCoachPromptData'],
  ['ai/chat-api/shouldUseWebSearch', 'ai/chat-api/shouldUseWebSearch'],
  ['ai/macro-recalibration/recalculateMacrosFromCoach', 'ai/macro-recalibration/recalculateMacrosFromCoach'],

  // shared
  ['shared/api/baseUrl', 'shared/api/baseUrl'],
  ['shared/api/apiFetch', 'shared/api/apiFetch'],
  ['shared/api/apiAuthHeaders', 'shared/api/apiAuthHeaders'],
  ['shared/api/userProfileApi', 'shared/api/userProfileApi'],
  ['shared/api/pushNotifyApi', 'shared/api/pushNotifyApi'],
  ['shared/api/onboardingSync', 'shared/api/onboardingSync'],
  ['shared/api/monitoring', 'shared/api/monitoring'],
  ['shared/api/logger', 'shared/api/logger'],
  ['shared/daily-metrics/saveDailyMetricsToFirestore', 'shared/daily-metrics/saveDailyMetricsToFirestore'],
  ['shared/daily-metrics/parseUserDailyMetrics', 'shared/daily-metrics/parseUserDailyMetrics'],
  ['shared/daily-metrics/dailyDashboardDayRollover', 'shared/daily-metrics/dailyDashboardDayRollover'],
  ['shared/daily-metrics/latestLoggedWeight', 'shared/daily-metrics/latestLoggedWeight'],
  ['shared/notes-files/notesAndFilesService', 'shared/notes-files/notesAndFilesService'],
  ['shared/firestore/firestoreListenerUtils', 'shared/firestore/firestoreListenerUtils'],
  ['shared/firestore/firestorePagedQuery', 'shared/firestore/firestorePagedQuery'],
  ['shared/firestore/storage', 'shared/firestore/storage'],
  ['shared/notifications/notificationsService', 'shared/notifications/notificationsService'],
  ['shared/marketplace/trainerMarketplaceSync', 'shared/marketplace/trainerMarketplaceSync'],
  ['shared/daily-metrics/useLocalTodayDateKey', 'shared/daily-metrics/useLocalTodayDateKey'],
  ['shared/photo-gallery/MyProgressPhotosScreen', 'shared/photo-gallery/MyProgressPhotosScreen'],
  ['shared/weekly-report/ViewWeekProgressReportScreen', 'shared/weekly-report/ViewWeekProgressReportScreen'],
  ['shared/workout-plans/BrowseSavedWorkoutsScreen', 'shared/workout-plans/BrowseSavedWorkoutsScreen'],
  ['shared/fitness-calculations/calculations', 'shared/fitness-calculations/calculations'],
  ['shared/workout-profile/profileCardIcons', 'shared/workout-profile/profileCardIcons'],
  ['shared/workout-profile/shouldShowProfileCard', 'shared/workout-profile/shouldShowProfileCard'],
  ['shared/trainer-location/trainerLocationService', 'shared/trainer-location/trainerLocationService'],
  ['shared/daily-quotes/dailyQuotesList', 'shared/daily-quotes/dailyQuotesList'],
  ['shared/coach-tools/parseCoachToolCalls', 'shared/coach-tools/parseCoachToolCalls'],
];

REPLACEMENTS.sort((a, b) => b[0].length - a[0].length);

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (['node_modules', 'coverage', '.git'].includes(ent.name)) continue;
      walk(p, acc);
    } else if (/\.(js|jsx|cjs|mjs|ts|tsx|json|md)$/.test(ent.name)) {
      acc.push(p);
    }
  }
  return acc;
}

const files = walk(path.join(ROOT, 'src'));
if (fs.existsSync(path.join(ROOT, 'App.js'))) files.push(path.join(ROOT, 'App.js'));
walk(path.join(ROOT, 'server'), files);
walk(path.join(ROOT, 'scripts'), files);

let changed = 0;
for (const file of files) {
  let text = fs.readFileSync(file, 'utf8');
  const orig = text;
  for (const [from, to] of REPLACEMENTS) {
    text = text.split(from).join(to);
  }
  if (text !== orig) {
    fs.writeFileSync(file, text);
    changed += 1;
  }
}
console.log(`Import pass 2: updated ${changed} files`);
