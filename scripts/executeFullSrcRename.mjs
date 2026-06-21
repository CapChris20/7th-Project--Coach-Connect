#!/usr/bin/env node
/**
 * Full src/ rename per user plan — folders + files + import rewrite.
 *   node scripts/executeFullSrcRename.mjs --dry-run
 *   node scripts/executeFullSrcRename.mjs --apply
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const APPLY = process.argv.includes('--apply');

function mv(fromRel, toRel) {
  const from = path.join(ROOT, fromRel);
  const to = path.join(ROOT, toRel);
  if (!fs.existsSync(from)) {
    console.warn('SKIP missing:', fromRel);
    return false;
  }
  if (fs.existsSync(to)) {
    console.warn('SKIP exists:', toRel);
    return false;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (APPLY) {
    try {
      execSync(`git mv "${from}" "${to}"`, { cwd: ROOT, stdio: 'pipe' });
    } catch {
      fs.renameSync(from, to);
    }
  }
  console.log(APPLY ? 'MOVED' : 'WOULD MOVE', fromRel, '→', toRel);
  return true;
}

function mergeFile(fromRel, toRel) {
  return mv(fromRel, toRel);
}

/** Directory moves — order matters */
const DIR_MOVES = [
  ['src/aiChat', 'src/ai-coach/chat-ui'],
  ['src/ai', 'src/ai-coach/server-logic'],
  ['src/app', 'src/app-start'],
  ['src/client', 'src/client-app'],
  ['src/trainer', 'src/trainer-app'],
  ['src/shared/coach-tools', 'src/ai-coach/tools'],
  ['src/shared/daily-metrics', 'src/metrics/daily-metrics'],
  ['src/shared/daily-quotes', 'src/metrics/daily-quotes'],
  ['src/shared/ui', 'src/shared-ui'],
  ['src/shared/utils', 'src/shared-utils'],
  ['src/shared/messaging', 'src/messaging'],
  ['src/shared/notifications', 'src/notifications'],
  ['src/assets/lottie', 'src/assets/animations/app-flows'],
  ['src/assets/Lotties for Anatrox', 'src/assets/animations/legacy'],
];

/** File moves after dirs — [from, to] under repo root */
const FILE_MOVES = [
  // Merge legacy settings into settings/screens
  ['src/screens/settings/ForgotPassword.js', 'src/settings/screens/ForgotPasswordFlow.js'],
  ['src/screens/settings/shared/useSettingsChrome.js', 'src/settings/screens/useSettingsPageFrame.js'],
  ['src/profile/screens/ViewMyProfileScreen.jsx', 'src/client-app/profile/ViewMyProfileScreen.jsx'],

  // Auth
  ['src/auth/LoginScreen.js', 'src/auth/LoginScreen.js'],
  ['src/auth/ResetPasswordScreen.js', 'src/auth/ResetPasswordScreen.jsx'],
  ['src/auth/OnboardingWizardScreen.js', 'src/auth/OnboardingWizardScreen.jsx'],
  ['src/auth/detectUserRole.js', 'src/auth/detectUserRole.js'],
  ['src/auth/finishOnboarding.js', 'src/auth/finishOnboarding.js'],
  ['src/auth/normalizeOnboardingRole.js', 'src/auth/normalizeOnboardingRole.js'],
  ['src/auth/validateTrainerInviteCode.js', 'src/auth/validateTrainerInviteCode.js'],

  // AI server logic
  ['src/ai-coach/server-logic/context/loadCoachPersonalContext.js', 'src/ai-coach/server-logic/context/loadCoachPersonalContext.js'],
  ['src/ai-coach/server-logic/context/buildCoachPromptData.js', 'src/ai-coach/server-logic/context/buildCoachPromptData.js'],
  ['src/ai-coach/server-logic/context/loadCoachWeeklyStats.js', 'src/ai-coach/server-logic/context/loadCoachWeeklyStats.js'],
  ['src/ai-coach/server-logic/chat-api/sendCoachMessageToServer.js', 'src/ai-coach/server-logic/chat-api/sendCoachMessageToServer.js'],
  ['src/ai-coach/server-logic/chat-api/loadMoreCoachConversations.js', 'src/ai-coach/server-logic/chat-api/loadMoreCoachConversations.js'],
  ['src/ai-coach/server-logic/chat-api/shouldUseWebSearch.js', 'src/ai-coach/server-logic/chat-api/shouldUseWebSearch.js'],
  ['src/ai-coach/server-logic/tools/chooseCoachActionUI.js', 'src/ai-coach/server-logic/tools/chooseCoachActionUI.js'],
  ['src/ai-coach/server-logic/tools/runCoachAction.js', 'src/ai-coach/server-logic/tools/runCoachAction.js'],
  ['src/ai-coach/server-logic/tools/detectDeleteFoodRequest.js', 'src/ai-coach/server-logic/tools/detectDeleteFoodRequest.js'],
  ['src/ai-coach/server-logic/tools/findCoachRequestsInText.js', 'src/ai-coach/server-logic/tools/findCoachRequestsInText.js'],
  ['src/ai-coach/server-logic/tools/shouldShowCoachAction.js', 'src/ai-coach/server-logic/tools/shouldShowCoachAction.js'],

  // AI chat UI
  ['src/ai-coach/chat-ui/chat-thread/ChatWithCoachScreen.jsx', 'src/ai-coach/chat-ui/chat-thread/ChatWithCoachScreen.jsx'],
  ['src/ai-coach/chat-ui/chat-home/StartCoachChatScreen.jsx', 'src/ai-coach/chat-ui/chat-home/StartCoachChatScreen.jsx'],
  ['src/ai-coach/chat-ui/screens/StartCoachChatScreen.jsx', 'src/ai-coach/chat-ui/screens/StartCoachChatScreen.jsx'],
  ['src/ai-coach/chat-ui/persistence/saveCoachMessages.js', 'src/ai-coach/chat-ui/persistence/saveCoachMessages.js'],
  ['src/ai-coach/chat-ui/voice/VoiceCoachScreen.jsx', 'src/ai-coach/chat-ui/voice/VoiceCoachScreen.jsx'],
  ['src/ai-coach/chat-ui/lib/coachCapabilities.js', 'src/ai-coach/chat-ui/lib/coachQuickActionsList.js'],
  ['src/ai-coach/chat-ui/lib/coachClipboard.js', 'src/ai-coach/chat-ui/lib/formatCoachMessageText.js'],
  ['src/ai-coach/chat-ui/toolModals/GenerateDeloadModal.jsx', 'src/ai-coach/chat-ui/tool-modals/PlanDeloadWeekSheet.jsx'],

  // Tool modals
  ['src/ai-coach/chat-ui/tool-modals/AdjustMacrosModal.jsx', 'src/ai-coach/chat-ui/tool-modals/AdjustMacroTargetsSheet.jsx'],
  ['src/ai-coach/chat-ui/tool-modals/BookSessionModal.jsx', 'src/ai-coach/chat-ui/tool-modals/BookTraineeSessionSheet.jsx'],
  ['src/ai-coach/chat-ui/tool-modals/DeleteLogModal.jsx', 'src/ai-coach/chat-ui/tool-modals/ConfirmDeleteLogSheet.jsx'],
  ['src/ai-coach/chat-ui/tool-modals/LogMoodModal.jsx', 'src/ai-coach/chat-ui/tool-modals/LogMoodRatingSheet.jsx'],
  ['src/ai-coach/chat-ui/tool-modals/LogNutritionModal.jsx', 'src/ai-coach/chat-ui/tool-modals/LogMealSheet.jsx'],
  ['src/ai-coach/chat-ui/tool-modals/LogRestDayModal.jsx', 'src/ai-coach/chat-ui/tool-modals/LogRestDaySheet.jsx'],
  ['src/ai-coach/chat-ui/tool-modals/LogSleepModal.jsx', 'src/ai-coach/chat-ui/tool-modals/LogSleepHoursSheet.jsx'],
  ['src/ai-coach/chat-ui/tool-modals/LogStepsModal.jsx', 'src/ai-coach/chat-ui/tool-modals/LogDailyStepsSheet.jsx'],
  ['src/ai-coach/chat-ui/tool-modals/LogWaterModal.jsx', 'src/ai-coach/chat-ui/tool-modals/LogWaterIntakeSheet.jsx'],
  ['src/ai-coach/chat-ui/tool-modals/NotifyTrainerModal.jsx', 'src/ai-coach/chat-ui/tool-modals/SendTrainerMessageSheet.jsx'],
  ['src/ai-coach/chat-ui/tool-modals/OpenWorkoutPlanModal.jsx', 'src/ai-coach/chat-ui/tool-modals/OpenWorkoutPlanSheet.jsx'],
  ['src/ai-coach/chat-ui/tool-modals/RateEnergyModal.jsx', 'src/ai-coach/chat-ui/tool-modals/RateEnergyLevelSheet.jsx'],
  ['src/ai-coach/chat-ui/tool-modals/RateWorkoutModal.jsx', 'src/ai-coach/chat-ui/tool-modals/RateWorkoutFeelSheet.jsx'],
  ['src/ai-coach/chat-ui/tool-modals/UpdateGoalModal.jsx', 'src/ai-coach/chat-ui/tool-modals/UpdateFitnessGoalSheet.jsx'],
  ['src/ai-coach/chat-ui/tool-modals/UpdateWorkoutModal.jsx', 'src/ai-coach/chat-ui/tool-modals/UpdateWorkoutSessionSheet.jsx'],

  // Client app
  ['src/client-app/dashboard/TrainingDashboardScreen.jsx', 'src/client-app/dashboard/TrainingDashboardScreen.jsx'],
  ['src/client-app/screens/BrowseSavedWorkoutsScreen.js', 'src/client-app/screens/BrowseSavedWorkoutsScreen.jsx'],
  ['src/client-app/screens/MyMessagesScreen.js', 'src/client-app/screens/MyMessagesScreen.jsx'],
  ['src/client-app/screens/LogTodaysMealsScreen.js', 'src/client-app/screens/LogTodaysMealsScreen.jsx'],
  ['src/client-app/screens/ChatWithTrainerScreen.js', 'src/client-app/screens/ChatWithTrainerScreen.jsx'],
  ['src/client-app/screens/MyProgressPhotosScreen.js', 'src/client-app/screens/MyProgressPhotosScreen.jsx'],
  ['src/client-app/screens/ViewMyWorkoutPlanScreen.jsx', 'src/client-app/screens/ViewMyWorkoutPlanScreen.jsx'],
  ['src/client-app/screens/ViewWeekProgressReportScreen.jsx', 'src/client-app/screens/ViewWeekProgressReportScreen.jsx'],
  ['src/client-app/settings/EditAccountScreen.jsx', 'src/client-app/settings/EditAccountScreen.jsx'],
  ['src/client-app/settings/EditFitnessGoalsScreen.jsx', 'src/client-app/settings/EditFitnessGoalsScreen.jsx'],
  ['src/client-app/profile/ViewMyProfileScreen.jsx', 'src/client-app/profile/ViewMyViewMyProfileScreen.jsx'],
  ['src/client-app/marketplace/screens/BrowseTrainersScreen.js', 'src/client-app/marketplace/screens/BrowseTrainersScreen.jsx'],
  ['src/client-app/marketplace/screens/SearchTrainersScreen.js', 'src/client-app/marketplace/screens/SearchTrainersScreen.jsx'],

  // Trainer app
  ['src/trainer-app/screens/BrowseSavedWorkoutsScreen.js', 'src/trainer-app/screens/GenerateTraineeWorkoutScreen.jsx'],
  ['src/trainer-app/screens/MyMessagesScreen.js', 'src/trainer-app/screens/MyMessagesScreen.jsx'],
  ['src/trainer-app/screens/MyProgressPhotosScreen.js', 'src/trainer-app/screens/ViewTraineePhotosScreen.jsx'],
  ['src/trainer-app/screens/SessionFormScreen.jsx', 'src/trainer-app/screens/ScheduleTrainingSessionScreen.jsx'],
  ['src/trainer-app/screens/SessionSchedulingScreen.jsx', 'src/trainer-app/screens/BookTraineeSessionScreen.jsx'],
  ['src/trainer-app/screens/TrainerChatWithTrainerScreen.js', 'src/trainer-app/screens/ChatWithTraineeScreen.jsx'],
  ['src/trainer-app/screens/SearchTrainersScreen.js', 'src/trainer-app/screens/FindTraineesScreen.jsx'],
  ['src/trainer-app/client-detail/TrainerClientDetailScreen.jsx', 'src/trainer-app/client-detail/ManageTraineeScreen.jsx'],
  ['src/trainer-app/clients-list/TrainerClientsListScreen.jsx', 'src/trainer-app/clients-list/MyTraineesScreen.jsx'],
  ['src/trainer-app/client-requests/ClientRequestsScreen.js', 'src/trainer-app/client-requests/NewTraineeRequestsScreen.jsx'],
  ['src/trainer-app/crm/formatClientName.js', 'src/trainer-app/crm/getTraineeDisplayName.js'],
  ['src/trainer-app/crm/resolveLinkedTrainerClients.js', 'src/trainer-app/crm/loadMyLinkedTrainees.js'],
  ['src/trainer-app/hooks/use-sessions.js', 'src/trainer-app/hooks/useMyTrainingSessions.js'],
  ['src/trainer-app/client-requests/trainerPendingRequestsService.js', 'src/trainer-app/client-requests/loadPendingTraineeRequests.js'],
  ['src/trainer-app/clients-list/loadTrainerClientRoster.js', 'src/trainer-app/clients-list/loadMyTraineeRoster.js'],

  // Nutrition food search
  ['src/nutrition/food-search/searchFoodsService.js', 'src/nutrition/food-search/searchFoodsService.js'],
  ['src/nutrition/food-search/cleanFoodCardLabels.js', 'src/nutrition/food-search/cleanFoodCardLabels.js'],
  ['src/nutrition/food-search/sortBestFoodMatches.js', 'src/nutrition/food-search/sortBestFoodMatches.js'],
  ['src/nutrition/food-search/isReliableRestaurantFood.js', 'src/nutrition/food-search/isReliableRestaurantFood.js'],
  ['src/nutrition/food-search/mergeFoodNutritionSources.js', 'src/nutrition/food-search/mergeFoodNutritionSources.js'],
  ['src/nutrition/food-search/guessServingSize.js', 'src/nutrition/food-search/guessServingSize.js'],
  ['src/nutrition/food-search/makeReadableFoodTitle.js', 'src/nutrition/food-search/makeReadableFoodTitle.js'],

  // Nutrition food details
  ['src/nutrition/food-details/formatFoodBrand.js', 'src/nutrition/food-details/cleanFoodBrandName.js'],
  ['src/nutrition/food-details/normalizeNutritionData.js', 'src/nutrition/food-details/fixFoodNutritionNumbers.js'],
  ['src/nutrition/components/premiumFoodCard/mapLogToPremiumFood.js', 'src/nutrition/components/premiumFoodCard/formatLoggedFoodDisplay.js'],

  // Metrics
  ['src/metrics/daily-metrics/dailyMetricsParse.cjs', 'src/metrics/daily-metrics/parseUserDailyMetrics.js'],
  ['src/metrics/daily-metrics/getLatestWeight.js', 'src/metrics/daily-metrics/getRecentWeight.js'],
  ['src/metrics/daily-metrics/rolloverDayAtMidnight.js', 'src/metrics/daily-metrics/archiveDailyMetricsAtMidnight.js'],

  // Notifications
  ['src/notifications/pushNotificationText.js', 'src/notifications/buildPushNotificationText.js'],

  // Messaging (shared → root messaging)
  ['src/messaging/MyMessagesScreen.js', 'src/messaging/MyMessagesScreen.jsx'],
  ['src/messaging/ChatWithTrainerScreen.js', 'src/messaging/ChatThreadScreen.jsx'],

  // Shared screens duplicates
  ['src/shared/screens/BrowseSavedWorkoutsScreen.js', 'src/shared/screens/BrowseSavedWorkoutsScreen.jsx'],
  ['src/shared/screens/MyProgressPhotosScreen.js', 'src/shared/screens/MyProgressPhotosScreen.jsx'],
  ['src/shared/screens/ViewWeekProgressReportScreen.jsx', 'src/shared/screens/ViewWeekProgressReportScreen.jsx'],
  ['src/shared/weekly-report/ViewWeekProgressReportScreen.jsx', 'src/shared/weekly-report/ViewWeekProgressReportScreen.jsx'],
  ['src/shared/workout-plans/BrowseSavedWorkoutsScreen.js', 'src/shared/workout-plans/BrowseSavedWorkoutsScreen.jsx'],
  ['src/shared/photo-gallery/MyProgressPhotosScreen.js', 'src/shared/photo-gallery/MyProgressPhotosScreen.jsx'],

  // Workouts
  ['src/workouts/screens/WorkoutPlanGeneratorScreenUI.js', 'src/workouts/screens/GenerateMyWorkoutPlanScreen.jsx'],
];

/** Path prefix replacements for imports — longest first */
const PATH_REPLACEMENTS = [
  ['src/aiChat/', 'src/ai-coach/chat-ui/'],
  ['src/ai/', 'src/ai-coach/server-logic/'],
  ['../aiChat/', '../chat-ui/'],
  ['../ai/', '../ai-coach/server-logic/'],
  ['../../aiChat/', '../../chat-ui/'],
  ['../../ai/', '../../server-logic/'],
  ['../../../aiChat/', '../../../chat-ui/'],
  ['../../../ai/', '../../../server-logic/'],
  ['../../../../aiChat/', '../../../../chat-ui/'],
  ['../../../../ai/', '../../../../server-logic/'],
  ['src/app-start/', 'src/app-start/'],
  ['src/client-app/', 'src/client-app/'],
  ['src/trainer-app/', 'src/trainer-app/'],
  ['src/shared/coach-tools/', 'src/ai-coach/tools/'],
  ['src/shared/daily-metrics/', 'src/metrics/daily-metrics/'],
  ['src/shared/daily-quotes/', 'src/metrics/daily-quotes/'],
  ['src/shared/ui/', 'src/shared-ui/'],
  ['src/shared/utils/', 'src/shared-utils/'],
  ['src/shared/messaging/', 'src/messaging/'],
  ['src/shared/notifications/', 'src/notifications/'],
  ['src/profile/screens/', 'src/client-app/profile/'],
  ['assets/lottie/', 'assets/animations/app-flows/'],
  ['Lotties for Anatrox', 'animations/legacy'],
  ['../shared/ui/', '../shared-ui/'],
  ['../../shared/ui/', '../../shared-ui/'],
  ['../../../shared/ui/', '../../../shared-ui/'],
  ['../shared/utils/', '../shared-utils/'],
  ['../../shared/utils/', '../../shared-utils/'],
  ['../../../shared/utils/', '../../../shared-utils/'],
  ['../shared/daily-metrics/', '../metrics/daily-metrics/'],
  ['../../shared/daily-metrics/', '../../metrics/daily-metrics/'],
  ['../../../shared/daily-metrics/', '../../../metrics/daily-metrics/'],
  ['../shared/messaging/', '../messaging/'],
  ['../../shared/messaging/', '../../messaging/'],
  ['../shared/notifications/', '../notifications/'],
  ['../../shared/notifications/', '../../notifications/'],
];

function stripExt(p) {
  return p.replace(/\.(jsx?|cjs|mjs)$/, '');
}

function buildFileReplacementPairs() {
  const pairs = [];
  const seen = new Set();
  const add = (from, to) => {
    if (!from || !to || from === to || seen.has(from)) return;
    seen.add(from);
    pairs.push([from, to]);
  };

  for (const [from, to] of FILE_MOVES) {
    add(from, to);
    add(stripExt(from), stripExt(to));
    if (from.startsWith('src/')) add(from.slice(4), to.slice(4));
    if (stripExt(from).startsWith('src/')) add(stripExt(from).slice(4), stripExt(to).slice(4));
    const fb = path.basename(from);
    const tb = path.basename(to);
    add(fb, tb);
    add(stripExt(fb), stripExt(tb));
  }
  pairs.sort((a, b) => b[0].length - a[0].length);
  return pairs;
}

function walkFiles(dir, out = []) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return out;
  const stat = fs.statSync(full);
  if (stat.isFile()) {
    if (/\.(js|jsx|mjs|cjs|md|json|tsx?)$/.test(dir) || dir === 'App.js') out.push(full);
    return out;
  }
  for (const name of fs.readdirSync(full)) {
    if (name === 'node_modules' || name === '.git') continue;
    walkFiles(path.join(dir, name), out);
  }
  return out;
}

function rewriteAll(appliedMoves) {
  const filePairs = buildFileReplacementPairs();
  const allPairs = [...PATH_REPLACEMENTS, ...filePairs].sort((a, b) => b[0].length - a[0].length);

  const roots = ['src', 'server', 'scripts', 'App.js', 'load-tests'];
  const files = [];
  for (const r of roots) walkFiles(r, files);

  let updated = 0;
  for (const file of files) {
    if (file.includes('executeFullSrcRename.mjs')) continue;
    let content = fs.readFileSync(file, 'utf8');
    let next = content;
    for (const [from, to] of allPairs) {
      if (next.includes(from)) next = next.split(from).join(to);
    }
    if (next !== content && APPLY) {
      fs.writeFileSync(file, next);
      updated++;
    } else if (next !== content) updated++;
  }
  console.log(`Import rewrite: ${updated} files ${APPLY ? 'updated' : 'would update'}`);
}

function cleanupEmptyDirs() {
  for (const d of ['src/screens/settings/shared', 'src/screens/settings', 'src/screens', 'src/profile/screens', 'src/profile', 'src/ai-coach/chat-ui/toolModals']) {
    const full = path.join(ROOT, d);
    if (fs.existsSync(full) && fs.readdirSync(full).length === 0 && APPLY) {
      fs.rmdirSync(full);
      console.log('Removed empty:', d);
    }
  }
}

function main() {
  console.log(APPLY ? '=== APPLYING FULL RENAME ===' : '=== DRY RUN ===');

  fs.mkdirSync(path.join(ROOT, 'src/ai-coach'), { recursive: true });
  fs.mkdirSync(path.join(ROOT, 'src/metrics'), { recursive: true });
  fs.mkdirSync(path.join(ROOT, 'src/assets/animations'), { recursive: true });
  fs.mkdirSync(path.join(ROOT, 'src/client-app/profile'), { recursive: true });

  let moved = 0;
  for (const [from, to] of DIR_MOVES) {
    if (mv(from, to)) moved++;
  }

  for (const [from, to] of FILE_MOVES) {
    if (mv(from, to)) moved++;
  }

  cleanupEmptyDirs();
  rewriteAll(FILE_MOVES);

  console.log(`\nTotal moves attempted: ${moved}`);
  if (!APPLY) console.log('Re-run with --apply to execute.');
}

main();
