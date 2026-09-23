#!/usr/bin/env node
/** Second pass: rewrite relative import path segments after feature-folder move. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const REPLACEMENTS = [
  // client
  ['client/dashboard/TrainingDashboardScreen', 'client/dashboard/TrainingDashboardScreen'],
  ['client/files/ClientFilesScreen', 'client/files/ClientFilesScreen'],
  ['client/messaging/ChatScreen', 'client/messaging/ChatScreen'],
  ['client/messaging/InboxScreen', 'client/messaging/InboxScreen'],
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
  ['trainer/messaging/InboxScreen', 'trainer/messaging/InboxScreen'],
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
  ['trainer/client-records/trainerClientFirestorePaths', 'trainer/client-records/trainerClientFirestorePaths'],
  ['trainer/client-records/loadMyLinkedTrainees', 'trainer/client-records/loadMyLinkedTrainees'],
  ['trainer/client-records/getTraineeDisplayName', 'trainer/client-records/getTraineeDisplayName'],
  ['trainer/client-records/trainerFirestoreErrors', 'trainer/client-records/trainerFirestoreErrors'],
  ['trainer/workout-plans/manualExerciseLibrarySeed', 'trainer/workout-plans/manualExerciseLibrarySeed'],

  // nutrition
  ['nutrition/daily-log/DailyLogContent', 'nutrition/daily-log/DailyLogContent'],
  ['nutrition/daily-log/DailyFoodLogScreen', 'nutrition/daily-log/DailyFoodLogScreen'],
  ['nutrition/food-search/FoodSearchScreen', 'nutrition/food-search/FoodSearchScreen'],
  ['nutrition/barcode/BarcodeScannerScreen', 'nutrition/barcode/BarcodeScannerScreen'],
  ['nutrition/food-details/NutritionFactsScreen', 'nutrition/food-details/NutritionFactsScreen'],
  ['nutrition/quick-add/QuickAddNutrition', 'nutrition/quick-add/QuickAddNutrition'],
  ['nutrition/targets/NutritionSettingsScreen', 'nutrition/targets/NutritionSettingsScreen'],
  ['nutrition/settings/NutritionOnboardingWizardScreen', 'nutrition/settings/NutritionOnboardingWizardScreen'],
  ['nutrition/daily-log/saveLoggedFood', 'nutrition/daily-log/saveLoggedFood'],
  ['nutrition/food-search/searchFoods', 'nutrition/food-search/searchFoods'],
  ['nutrition/food-search/rankFoodResults', 'nutrition/food-search/rankFoodResults'],
  ['nutrition/daily-log/DayPicker', 'nutrition/daily-log/DayPicker'],
  ['nutrition/daily-log/MealCard', 'nutrition/daily-log/MealCard'],
  ['nutrition/daily-log/MacroBar', 'nutrition/daily-log/MacroBar'],
  ['nutrition/food-search/ConfirmFoodPopup', 'nutrition/food-search/ConfirmFoodPopup'],
  ['nutrition/food-search/SearchDisclaimerCard', 'nutrition/food-search/SearchDisclaimerCard'],
  ['nutrition/food-details/EditServingPopup', 'nutrition/food-details/EditServingPopup'],
  ['nutrition/food-details/FoodItem', 'nutrition/food-details/FoodItem'],
  ['nutrition/food-details/servingSizeMath', 'nutrition/food-details/servingSizeMath'],
  ['nutrition/food-details/parseNutritionLabel', 'nutrition/food-details/parseNutritionLabel'],
  ['nutrition/food-details/fixPackageAmounts', 'nutrition/food-details/fixPackageAmounts'],
  ['nutrition/food-search/cleanSearchText', 'nutrition/food-search/cleanSearchText'],
  ['nutrition/food-details/tidyBrandName', 'nutrition/food-details/tidyBrandName'],
  ['nutrition/barcode/scannedProductSummary', 'nutrition/barcode/scannedProductSummary'],
  ['nutrition/food-search/casualMenuSearch', 'nutrition/food-search/casualMenuSearch'],
  ['nutrition/food-search/tidyFoodTitles', 'nutrition/food-search/tidyFoodTitles'],
  ['nutrition/food-search/trustRestaurantResult', 'nutrition/food-search/trustRestaurantResult'],

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
  ['workouts/create-plan/CreateWorkoutPlanScreen', 'workouts/create-plan/CreateWorkoutPlanScreen'],
  ['workouts/create-plan/editPlanFieldForms', 'workouts/create-plan/editPlanFieldForms'],
  ['workouts/create-plan/saveAndLoadWorkoutPlan', 'workouts/create-plan/saveAndLoadWorkoutPlan'],
  ['workouts/view-plan/makePlanPdf', 'workouts/view-plan/makePlanPdf'],
  ['workouts/exercise-videos/loadSavedWorkoutPlans', 'workouts/exercise-videos/loadSavedWorkoutPlans'],
  ['workouts/create-plan/workoutPlanCreation', 'workouts/create-plan/workoutPlanCreation'],
  ['workouts/exercise-videos/findExerciseVideos', 'workouts/exercise-videos/findExerciseVideos'],
  ['workouts/create-plan/askForWorkoutPlan', 'workouts/create-plan/askForWorkoutPlan'],
  ['workouts/create-plan/keepPlanBuildingInBackground', 'workouts/create-plan/keepPlanBuildingInBackground'],
  ['workouts/create-plan/countPlansCreated', 'workouts/create-plan/countPlansCreated'],
  ['workouts/create-plan/planQuestionLabels', 'workouts/create-plan/planQuestionLabels'],
  ['workouts/create-plan/planRequestAnswers', 'workouts/create-plan/planRequestAnswers'],
  ['workouts/create-plan/readPlanText', 'workouts/create-plan/readPlanText'],
  ['workouts/view-plan/WorkoutPlanView', 'workouts/view-plan/WorkoutPlanView'],
  ['workouts/view-plan/PlanPdfViewer', 'workouts/view-plan/PlanPdfViewer'],
  ['workouts/view-plan/planViewPieces', 'workouts/view-plan/planViewPieces'],
  ['workouts/exercise-videos/ExerciseVideosTab', 'workouts/exercise-videos/ExerciseVideosTab'],
  ['workouts/exercise-videos/ExerciseCard', 'workouts/exercise-videos/ExerciseCard'],
  ['workouts/exercise-videos/ShortVideoCard', 'workouts/exercise-videos/ShortVideoCard'],
  ['workouts/exercise-videos/VideoPlayer', 'workouts/exercise-videos/VideoPlayer'],
  ['workouts/create-plan/EditWorkoutPopup', 'workouts/create-plan/EditWorkoutPopup'],
  ['workouts/create-plan/WorkoutProfileTags', 'workouts/create-plan/WorkoutProfileTags'],

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
  ['shared/fitness-calculations/fitnessMath', 'shared/fitness-calculations/fitnessMath'],
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
