#!/usr/bin/env node
/** Third pass: fix broken relative imports inside feature folders. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/** [directory prefix from src/, [[from, to], ...]] */
const DIR_RULES = [
  ['src/client-app/home/', [
    ['../../../assets/', '../../assets/'],
    ['../components/home/', './'],
  ]],
  ['src/client-app/navigation/', [
    ['../screens/ChatWithTrainerScreen', '../messaging/ChatThreadScreen'],
    ['../screens/MyMessagesScreen', '../messaging/MyMessagesScreen'],
    ['../screens/TrainingDashboardScreen', '../dashboard/TrainingDashboardScreen'],
    ['../screens/ViewWeekProgressReportScreen', '../weekly-report/ViewWeekProgressReportScreen'],
    ['../screens/MyProgressPhotosScreen', '../photo-gallery/MyProgressPhotosScreen'],
    ['../screens/BrowseSavedWorkoutsScreen', '../workout-plans/BrowseSavedWorkoutsScreen'],
    ['../components/home/', '../home/'],
    ['../components/TrainerSharedFilesModal', '../files/TrainerSharedFilesModal'],
    ['../components/ReviewSubmitSheet', '../dashboard/ReviewSubmitSheet'],
    ['../components/DashboardHeroCard', '../dashboard/DashboardHeroCard'],
    ['../hooks/useClientScreenNavigation', './useClientScreenNavigation'],
    ['../marketplace/screens/SearchTrainersScreen', '../marketplace/SearchTrainersScreen'],
  ]],
  ['src/client-app/navigation/clientOverlayScreens.jsx', [
    ['../screens/ViewWeekProgressReportScreen', '../weekly-report/ViewWeekProgressReportScreen'],
    ['../screens/MyProgressPhotosScreen', '../photo-gallery/MyProgressPhotosScreen'],
    ['../screens/BrowseSavedWorkoutsScreen', '../workout-plans/BrowseSavedWorkoutsScreen'],
    ['../marketplace/screens/SearchTrainersScreen', '../marketplace/SearchTrainersScreen'],
  ]],
  ['src/client-app/dashboard/', [
    ['../components/PremiumTrainerCard', './PremiumTrainerCard'],
    ['../components/PremiumStatsSection', './PremiumStatsSection'],
    ['../lib/coachingBillingLabel', './coachingBillingLabel'],
  ]],
  ['src/client-app/marketplace/', [
    ['../../../app-start/', '../../app-start/'],
    ['../../../shared/', '../../shared/'],
    ['../../../navigation/', '../../navigation/'],
    ['../components/', './'],
    ['../utils/', './'],
    ['../screens/', './'],
  ]],
  ['src/trainer-app/navigation/', [
    ['../screens/ChatWithTraineeScreen', '../messaging/ChatWithTraineeScreen'],
    ['../screens/MyMessagesScreen', '../messaging/MyMessagesScreen'],
    ['../screens/NewTraineeRequestsScreen', '../client-requests/NewTraineeRequestsScreen'],
    ['../screens/MyTraineesScreen', '../clients-list/MyTraineesScreen'],
    ['../screens/TrainerDashboardContent', '../dashboard/TrainerDashboardContent'],
    ['../screens/MyProgressPhotosScreen', '../photo-gallery/MyProgressPhotosScreen'],
    ['../screens/BrowseSavedWorkoutsScreen', '../workout-plans/BrowseSavedWorkoutsScreen'],
    ['../components/documents/', '../documents/'],
    ['../components/dashboard/', '../dashboard/'],
  ]],
  ['src/trainer-app/navigation/trainerOverlayScreens.jsx', [
    ['../screens/SearchTrainersScreen', '../marketplace/SearchTrainersScreen'],
    ['../screens/TrainerViewWeekProgressReportScreen', '../weekly-report/TrainerViewWeekProgressReportScreen'],
    ['../screens/ManualWorkoutPlanBuilderScreen', '../workout-plans/ManualWorkoutPlanBuilderScreen'],
    ['../screens/PaymentsScreen', '../payments/PaymentsScreen'],
  ]],
  ['src/trainer-app/weekly-report/', [
    ['../../../assets/', '../../assets/'],
    ['./weeklyReport/WeeklyReportHeroCard', './WeeklyReportHeroCard'],
  ]],
  ['src/trainer-app/dashboard/', [
    ['../../../assets/', '../../assets/'],
    ['../../../shared/assets/', '../../shared/assets/'],
    ['../components/documents/', '../documents/'],
    ['../components/TrainerWeeklyReportSection', '../weekly-report/TrainerWeeklyReportSection'],
    ['../components/dashboard/', './'],
    ['../lib/trainerFirestoreErrors', '../crm/trainerFirestoreErrors'],
    ['../services/clientCRMService', '../clients-list/clientCRMService'],
  ]],
  ['src/trainer-app/client-detail/', [
    ['../components/documents/', '../documents/'],
    ['../components/dashboard/', '../dashboard/'],
    ['../lib/trainerFirestoreErrors', '../crm/trainerFirestoreErrors'],
  ]],
  ['src/trainer-app/progress-tab/', [['../components/dashboard/', '../dashboard/']]],
  ['src/trainer-app/nutrition-tab/', [['../components/dashboard/', '../dashboard/']]],
  ['src/trainer-app/payments/', [['../components/dashboard/', '../dashboard/']]],
  ['src/trainer-app/clients-list/', [['../components/dashboard/', '../dashboard/']]],
  ['src/trainer-app/sessions/', [
    ['../hooks/useMyTrainingSessions', './useMyTrainingSessions'],
    ['../components/sessions/', './'],
    ['../components/WheelPicker', './WheelPicker'],
    ['../services/pushSessionNotification', './pushSessionNotification'],
  ]],
  ['src/trainer-app/documents/', [
    ['../../services/clientCRMService', '../clients-list/clientCRMService'],
  ]],
  ['src/trainer-app/client-requests/', [
    ['../services/loadPendingTraineeRequests', './loadPendingTraineeRequests'],
  ]],
  ['src/trainer-app/clients-list/', [
    ['../lib/trainerClientFirestorePaths', '../crm/trainerClientFirestorePaths'],
    ['../lib/loadMyLinkedTrainees', '../crm/loadMyLinkedTrainees'],
  ]],
  ['src/trainer-app/workout-plans/', [
    ['../services/manualWorkoutPlanService', './manualWorkoutPlanService'],
  ]],
  ['src/nutrition/daily-log/', [
    ['../services/nutritionService', './nutritionService'],
    ['../services/searchFoodsService', '../food-search/searchFoodsService'],
    ['../components/EditServingModal', '../food-details/EditServingModal'],
    ['../components/NutritionDayPicker', './NutritionDayPicker'],
    ['../components/MacroBar', './MacroBar'],
    ['../components/MealCard', './MealCard'],
    ['./NutritionOnboardingWizardScreen', '../settings/NutritionOnboardingWizardScreen'],
    ['./NutritionFactsScreen', '../food-details/NutritionFactsScreen'],
    ['./QuickAddNutrition', '../quick-add/QuickAddNutrition'],
    ['./FoodSearchScreen', '../food-search/FoodSearchScreen'],
    ['./BarcodeScannerScreen', '../barcode/BarcodeScannerScreen'],
    ['./NutritionSettingsScreen', '../settings/NutritionSettingsScreen'],
    ['../utils/foodNormalize', '../food-search/foodNormalize'],
    ['../utils/servingMath', '../food-details/servingMath'],
    ['../utils/nutritionFactsModel', '../food-details/nutritionFactsModel'],
  ]],
  ['src/nutrition/screens/', [
    ['../components/MacroBar', '../daily-log/MacroBar'],
    ['../../Loader', '../../shared/components/shell/AppLoadingScreen'],
  ]],
  ['src/shared/api/', [
    ['../services/baseUrl', './baseUrl'],
    ['../services/getAuthHeaders', './getAuthHeaders'],
  ]],
  ['src/nutrition/food-search/', [
    ['../services/nutritionService', '../daily-log/nutritionService'],
    ['../services/foodSearchQueryMatch', './foodSearchQueryMatch'],
    ['../components/FoodConfirmSheet', './FoodConfirmSheet'],
    ['../components/FoodSearchAccuracyHeroCard', './FoodSearchAccuracyHeroCard'],
    ['../utils/foodBrandDisplay', '../food-details/foodBrandDisplay'],
    ['../utils/foodSearchTitle', './foodSearchTitle'],
    ['../utils/foodNormalize', './foodNormalize'],
    ['../utils/servingMath', '../food-details/servingMath'],
    ['../utils/nutritionNormalization', '../food-details/nutritionNormalization'],
    ['../utils/barcodeDisplay', '../barcode/barcodeDisplay'],
  ]],
  ['src/nutrition/barcode/', [
    ['../services/searchFoodsService', '../food-search/searchFoodsService'],
    ['../services/nutritionService', '../daily-log/nutritionService'],
    ['../utils/servingMath', '../food-details/servingMath'],
    ['../components/FoodConfirmSheet', '../food-search/FoodConfirmSheet'],
  ]],
  ['src/nutrition/food-details/', [
    ['../services/searchFoodsService', '../food-search/searchFoodsService'],
    ['../services/nutritionService', '../daily-log/nutritionService'],
    ['../utils/nutritionFactsModel', './nutritionFactsModel'],
  ]],
  ['src/nutrition/quick-add/', [
    ['../services/nutritionService', '../daily-log/nutritionService'],
  ]],
  ['src/ai-coach/chat-ui/chat-home/', [
    ['../lib/showCoachAttachMenu', '../chat-thread/showCoachAttachMenu'],
    ['../lib/coachAttachmentPickers', '../chat-thread/coachAttachmentPickers'],
    ['../lib/aiChatPersistence', '../persistence/aiChatPersistence'],
    ['../lib/coachCategoryPrompts', '../chat-thread/coachCategoryPrompts'],
    ['../hooks/useCoachSpeech', '../voice/useCoachSpeech'],
    ['../hooks/useCoachComposerKeyboard', '../chat-thread/useCoachComposerKeyboard'],
    ['../hooks/useCoachComposerInput', '../chat-thread/useCoachComposerInput'],
    ['../components/CoachPasteSheet', '../chat-thread/CoachPasteSheet'],
  ]],
  ['src/ai-coach/chat-ui/chat-thread/', [
    ['../toolModals/', '../tool-modals/'],
    ['../lib/showCoachAttachMenu', './showCoachAttachMenu'],
    ['../lib/coachAttachmentPickers', './coachAttachmentPickers'],
    ['../lib/aiChatPersistence', '../persistence/aiChatPersistence'],
    ['../lib/coachCategoryPrompts', './coachCategoryPrompts'],
    ['../lib/formatCoachMessageText', './formatCoachMessageText'],
    ['../lib/coachMarkdownStyles', './coachMarkdownStyles'],
    ['../lib/coachSourcePreview', './coachSourcePreview'],
    ['../lib/coachConversationDebug', '../persistence/coachConversationDebug'],
    ['../hooks/useCoachSpeech', '../voice/useCoachSpeech'],
    ['../hooks/useCoachComposerKeyboard', './useCoachComposerKeyboard'],
    ['../hooks/useCoachComposerInput', './useCoachComposerInput'],
    ['../components/TrainerCoachClientBar', '../trainer-coach-mode/TrainerCoachClientBar'],
    ['../components/ToolConfirmationModal', './ToolConfirmationModal'],
    ['../components/CoachWebSources', './CoachWebSources'],
    ['../components/CoachPasteSheet', './CoachPasteSheet'],
    ['../components/CoachFormattedReply', './CoachFormattedReply'],
  ]],
  ['src/workouts/active-workout/', [
    ['../services/workoutService', './workoutService'],
    ['../services/workoutPlanPdfService', '../plan-viewer/workoutPlanPdfService'],
    ['../components/WorkoutPlanPdfViewerModal', '../plan-viewer/WorkoutPlanPdfViewerModal'],
    ['../components/WorkoutExerciseLibraryTab', '../exercise-library/WorkoutExerciseLibraryTab'],
    ['../components/EditModalForm_RN', './EditModalForm_RN'],
    ['../components/WorkoutProfilePillGrid', './WorkoutProfilePillGrid'],
    ['../components/WorkoutPlanResult', '../plan-viewer/WorkoutPlanResult'],
    ['../components/workoutPlanUiComponents', '../plan-viewer/workoutPlanUiComponents'],
    ['../hooks/useWorkoutGeneration', '../plan-generator/useWorkoutGeneration'],
    ['../lib/workoutPlanGenerationSession', '../plan-generator/workoutPlanGenerationSession'],
    ['../lib/workoutGenerationUsage', '../plan-generator/workoutGenerationUsage'],
    ['../lib/workoutPlanApi', '../plan-generator/workoutPlanApi'],
    ['../lib/workoutOnboardingFormConfig', '../plan-generator/workoutOnboardingFormConfig'],
    ['../lib/workoutPlanParsing', '../plan-generator/workoutPlanParsing'],
  ]],
  ['src/workouts/plan-viewer/', [
    ['../lib/workoutPlanParsing', '../plan-generator/workoutPlanParsing'],
  ]],
  ['src/workouts/plan-generator/', [
    ['../services/workoutService', '../active-workout/workoutService'],
  ]],
  ['src/workouts/exercise-library/', [
    ['../hooks/useYouTubeAPI', './useYouTubeAPI'],
  ]],
  ['src/workouts/active-workout/WorkoutProfilePillGrid.jsx', [
    ['../lib/workoutOnboardingFormConfig', '../plan-generator/workoutOnboardingFormConfig'],
  ]],
  ['src/shared/components/notes-files/', [
    ['../../services/notesAndFilesService', '../../notes-files/notesAndFilesService'],
  ]],
];

function applyRules() {
  let changed = 0;
  for (const [prefix, rules] of DIR_RULES) {
    const fullPrefix = path.join(ROOT, prefix);
    let files = [];
    if (prefix.endsWith('.jsx') || prefix.endsWith('.js')) {
      if (fs.existsSync(fullPrefix)) files = [fullPrefix];
    } else if (fs.existsSync(fullPrefix)) {
      for (const ent of fs.readdirSync(fullPrefix, { withFileTypes: true, recursive: true })) {
        if (ent.isFile() && /\.(js|jsx)$/.test(ent.name)) {
          files.push(path.join(fullPrefix, ent.name));
        }
      }
      // node without recursive - walk manually
      function walk(d) {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, e.name);
          if (e.isDirectory()) walk(p);
          else if (/\.(js|jsx)$/.test(e.name)) files.push(p);
        }
      }
      files = [];
      walk(fullPrefix);
    }
    for (const file of files) {
      let text = fs.readFileSync(file, 'utf8');
      const orig = text;
      for (const [from, to] of rules) {
        text = text.split(from).join(to);
      }
      if (text !== orig) {
        fs.writeFileSync(file, text);
        changed += 1;
      }
    }
  }
  console.log(`Relative import fixes: ${changed} files`);
}

applyRules();
