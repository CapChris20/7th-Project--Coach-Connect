#!/usr/bin/env node
/** Second pass: rewrite relative import path segments after feature-folder move. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const REPLACEMENTS = [
  // client
  ['client/dashboard/MyDashboardScreen', 'client/dashboard/MyDashboardScreen'],
  ['client/files/ClientFilesScreen', 'client/files/ClientFilesScreen'],
  ['client/messaging/MessagingScreen', 'client/messaging/MessagingScreen'],
  ['client/messaging/ConversationsListScreen', 'client/messaging/ConversationsListScreen'],
  ['client/weekly-report/WeeklyReportScreen', 'client/weekly-report/WeeklyReportScreen'],
  ['client/workout-plans/AIWorkoutPlansScreen', 'client/workout-plans/AIWorkoutPlansScreen'],
  ['client/workout-plans/PlanViewerScreen', 'client/workout-plans/PlanViewerScreen'],
  ['client/meal-plan/MealPlanHomeScreen', 'client/meal-plan/MealPlanHomeScreen'],
  ['client/photo-gallery/PhotoGalleryScreen', 'client/photo-gallery/PhotoGalleryScreen'],
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
  ['trainer/client-requests/ClientRequestsScreen', 'trainer/client-requests/ClientRequestsScreen'],
  ['trainer/clients-list/TrainerClientsListScreen', 'trainer/clients-list/TrainerClientsListScreen'],
  ['trainer/client-detail/TrainerClientDetailScreen', 'trainer/client-detail/TrainerClientDetailScreen'],
  ['trainer/sessions/SessionSchedulingScreen', 'trainer/sessions/SessionSchedulingScreen'],
  ['trainer/sessions/SessionFormScreen', 'trainer/sessions/SessionFormScreen'],
  ['trainer/payments/PaymentsScreen', 'trainer/payments/PaymentsScreen'],
  ['trainer/workout-plans/ManualWorkoutPlanBuilderScreen', 'trainer/workout-plans/ManualWorkoutPlanBuilderScreen'],
  ['trainer/weekly-report/TrainerWeeklyReportScreen', 'trainer/weekly-report/TrainerWeeklyReportScreen'],
  ['trainer/messaging/ConversationsListScreen', 'trainer/messaging/ConversationsListScreen'],
  ['trainer/messaging/TrainerMessagingScreen', 'trainer/messaging/TrainerMessagingScreen'],
  ['trainer/photo-gallery/PhotoGalleryScreen', 'trainer/photo-gallery/PhotoGalleryScreen'],
  ['trainer/marketplace/TrainerSearchScreen', 'trainer/marketplace/TrainerSearchScreen'],
  ['trainer/workout-plans/AIWorkoutPlansScreen', 'trainer/workout-plans/AIWorkoutPlansScreen'],
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
  ['trainer/sessions/use-sessions', 'trainer/sessions/use-sessions'],
  ['trainer/clients-list/loadTrainerClientRoster', 'trainer/clients-list/loadTrainerClientRoster'],
  ['trainer/workout-plans/manualWorkoutPlanService', 'trainer/workout-plans/manualWorkoutPlanService'],
  ['trainer/sessions/pushSessionNotification', 'trainer/sessions/pushSessionNotification'],
  ['trainer/client-requests/trainerPendingRequestsService', 'trainer/client-requests/trainerPendingRequestsService'],
  ['trainer/crm/trainerClientFirestorePaths', 'trainer/crm/trainerClientFirestorePaths'],
  ['trainer/crm/resolveLinkedTrainerClients', 'trainer/crm/resolveLinkedTrainerClients'],
  ['trainer/crm/formatClientName', 'trainer/crm/formatClientName'],
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
  ['nutrition/settings/NutritionOnboardingScreen', 'nutrition/settings/NutritionOnboardingScreen'],
  ['nutrition/daily-log/logFoodToFirestore', 'nutrition/daily-log/logFoodToFirestore'],
  ['nutrition/food-search/foodSearchProvider', 'nutrition/food-search/foodSearchProvider'],
  ['nutrition/food-search/rankFoodSearchResults', 'nutrition/food-search/rankFoodSearchResults'],
  ['nutrition/daily-log/NutritionDayPicker', 'nutrition/daily-log/NutritionDayPicker'],
  ['nutrition/daily-log/MealCard', 'nutrition/daily-log/MealCard'],
  ['nutrition/daily-log/MacroBar', 'nutrition/daily-log/MacroBar'],
  ['nutrition/food-search/ConfirmFoodSelectionSheet', 'nutrition/food-search/ConfirmFoodSelectionSheet'],
  ['nutrition/food-search/SearchQualityCard', 'nutrition/food-search/SearchQualityCard'],
  ['nutrition/food-details/EditServingModal', 'nutrition/food-details/EditServingModal'],
  ['nutrition/food-details/FoodItem', 'nutrition/food-details/FoodItem'],
  ['nutrition/food-details/calculateServingSize', 'nutrition/food-details/calculateServingSize'],
  ['nutrition/food-details/parseNutritionLabel', 'nutrition/food-details/parseNutritionLabel'],
  ['nutrition/food-details/normalizeNutritionData', 'nutrition/food-details/normalizeNutritionData'],
  ['nutrition/food-search/normalizeFoodQuery', 'nutrition/food-search/normalizeFoodQuery'],
  ['nutrition/food-details/formatFoodBrand', 'nutrition/food-details/formatFoodBrand'],
  ['nutrition/barcode/renderScannedBarcode', 'nutrition/barcode/renderScannedBarcode'],
  ['nutrition/food-search/casualMenuSearch', 'nutrition/food-search/casualMenuSearch'],
  ['nutrition/food-search/formatFoodSearchTitle', 'nutrition/food-search/formatFoodSearchTitle'],
  ['nutrition/food-search/validateRestaurantResult', 'nutrition/food-search/validateRestaurantResult'],

  // aiChat
  ['aiChat/chat-home/AIChatHomeScreen', 'aiChat/chat-home/AIChatHomeScreen'],
  ['aiChat/chat-thread/AIChatScreen', 'aiChat/chat-thread/AIChatScreen'],
  ['aiChat/voice/VoiceAIHomeScreen', 'aiChat/voice/VoiceAIHomeScreen'],
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
  ['aiChat/chat-thread/coachClipboard', 'aiChat/chat-thread/coachClipboard'],
  ['aiChat/persistence/saveCoachMessagesToFirestore', 'aiChat/persistence/saveCoachMessagesToFirestore'],
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
  ['ai/chat-api/aiCoachServerService', 'ai/chat-api/aiCoachServerService'],
  ['ai/chat-api/conversationService', 'ai/chat-api/conversationService'],
  ['ai/chat-api/chatStorageService', 'ai/chat-api/chatStorageService'],
  ['ai/trainer-messaging/sendTrainerNotification', 'ai/trainer-messaging/sendTrainerNotification'],
  ['ai/vision/imageStorageService', 'ai/vision/imageStorageService'],
  ['ai/tools/executeCoachTool', 'ai/tools/executeCoachTool'],
  ['ai/tools/coachToolUx', 'ai/tools/coachToolUx'],
  ['ai/tools/validateCoachToolProposal', 'ai/tools/validateCoachToolProposal'],
  ['ai/tools/parseUserMessageForTools', 'ai/tools/parseUserMessageForTools'],
  ['ai/tools/cleanupToolParams', 'ai/tools/cleanupToolParams'],
  ['ai/tools/parseDeleteLogRequest', 'ai/tools/parseDeleteLogRequest'],
  ['ai/context/CoachContextProvider', 'ai/context/CoachContextProvider'],
  ['ai/context/gatherCoachWeeklyStats', 'ai/context/gatherCoachWeeklyStats'],
  ['ai/context/gatherCoachContextFromUser', 'ai/context/gatherCoachContextFromUser'],
  ['ai/chat-api/detectWebSearchRequest', 'ai/chat-api/detectWebSearchRequest'],
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
  ['shared/daily-metrics/dailyMetricsParse', 'shared/daily-metrics/dailyMetricsParse'],
  ['shared/daily-metrics/dailyDashboardDayRollover', 'shared/daily-metrics/dailyDashboardDayRollover'],
  ['shared/daily-metrics/latestLoggedWeight', 'shared/daily-metrics/latestLoggedWeight'],
  ['shared/notes-files/notesAndFilesService', 'shared/notes-files/notesAndFilesService'],
  ['shared/firestore/firestoreListenerUtils', 'shared/firestore/firestoreListenerUtils'],
  ['shared/firestore/firestorePagedQuery', 'shared/firestore/firestorePagedQuery'],
  ['shared/firestore/storage', 'shared/firestore/storage'],
  ['shared/notifications/notificationsService', 'shared/notifications/notificationsService'],
  ['shared/marketplace/trainerMarketplaceSync', 'shared/marketplace/trainerMarketplaceSync'],
  ['shared/daily-metrics/useLocalTodayDateKey', 'shared/daily-metrics/useLocalTodayDateKey'],
  ['shared/photo-gallery/PhotoGalleryScreen', 'shared/photo-gallery/PhotoGalleryScreen'],
  ['shared/weekly-report/WeeklyReportScreen', 'shared/weekly-report/WeeklyReportScreen'],
  ['shared/workout-plans/AIWorkoutPlansScreen', 'shared/workout-plans/AIWorkoutPlansScreen'],
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
