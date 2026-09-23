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
  ['src/ai', 'src/ai-coach/logic'],
  ['src/app', 'src/app-start'],
  ['src/client', 'src/client-app'],
  ['src/trainer', 'src/trainer-app'],
  ['src/for-both/coach-tools', 'src/ai-coach/tools'],
  ['src/for-both/daily-metrics', 'src/metrics/daily-metrics'],
  ['src/for-both/daily-quotes', 'src/metrics/daily-quotes'],
  ['src/for-both/ui', 'src/theme'],
  ['src/for-both/utils', 'src/helpers'],
  ['src/for-both/messaging', 'src/messaging'],
  ['src/for-both/notifications', 'src/notifications'],
  ['src/assets/lottie', 'src/assets/animations/app-flows'],
  ['src/assets/Lotties for Anatrox', 'src/assets/animations/legacy'],
];

/** File moves after dirs — [from, to] under repo root */
const FILE_MOVES = [
  // Merge legacy settings into settings/screens
  ['src/screens/settings/ForgotPassword.js', 'src/login-and-signup/ForgotPasswordFlow.js'],
  ['src/screens/settings/for-both/useSettingsChrome.js', 'src/settings/screens/useSettingsPageFrame.js'],
  ['src/profile/screens/ViewMyProfileScreen.jsx', 'src/client-app/profile/MyProfileScreen.jsx'],

  // Auth
  ['src/login-and-signup/LoginScreen.js', 'src/login-and-signup/LoginScreen.js'],
  ['src/login-and-signup/ForgotPasswordFlow.js', 'src/login-and-signup/ForgotPasswordFlow.jsx'],
  ['src/login-and-signup/NewUserSetupScreen.js', 'src/login-and-signup/NewUserSetupScreen.jsx'],
  ['src/login-and-signup/decideTraineeOrTrainer.js', 'src/login-and-signup/decideTraineeOrTrainer.js'],
  ['src/login-and-signup/finishSetup.js', 'src/login-and-signup/finishSetup.js'],
  ['src/login-and-signup/cleanUpRoleName.js', 'src/login-and-signup/cleanUpRoleName.js'],
  ['src/login-and-signup/checkTrainerCode.js', 'src/login-and-signup/checkTrainerCode.js'],

  // AI server logic
  ['src/ai-coach/coach-knowledge/loadYourWeekForCoach.js', 'src/ai-coach/coach-knowledge/loadYourWeekForCoach.js'],
  ['src/ai-coach/coach-knowledge/decideWhatCoachShouldKnow.js', 'src/ai-coach/coach-knowledge/decideWhatCoachShouldKnow.js'],
  ['src/ai-coach/coach-knowledge/loadWeeklyNumbers.js', 'src/ai-coach/coach-knowledge/loadWeeklyNumbers.js'],
  ['src/ai-coach/conversation/sendMessageToCoach.js', 'src/ai-coach/conversation/sendMessageToCoach.js'],
  ['src/ai-coach/past-chats/loadOlderChats.js', 'src/ai-coach/past-chats/loadOlderChats.js'],
  ['src/ai-coach/internet-lookup/shouldLookUpOnInternet.js', 'src/ai-coach/internet-lookup/shouldLookUpOnInternet.js'],
  ['src/ai-coach/coach-actions/popupOrAutoRun.js', 'src/ai-coach/coach-actions/popupOrAutoRun.js'],
  ['src/ai-coach/coach-actions/carryOutAction.js', 'src/ai-coach/coach-actions/carryOutAction.js'],
  ['src/ai-coach/coach-actions/spotDeleteRequests.js', 'src/ai-coach/coach-actions/spotDeleteRequests.js'],
  ['src/ai-coach/coach-actions/findActionsInReply.js', 'src/ai-coach/coach-actions/findActionsInReply.js'],
  ['src/ai-coach/coach-actions/shouldAskFirst.js', 'src/ai-coach/coach-actions/shouldAskFirst.js'],

  // AI chat UI
  ['src/ai-coach/conversation/CoachConversationScreen.jsx', 'src/ai-coach/conversation/CoachConversationScreen.jsx'],
  ['src/ai-coach/home-screen/CoachHomeScreen.jsx', 'src/ai-coach/home-screen/CoachHomeScreen.jsx'],
  ['src/ai-coach/home-screen/CoachHomeScreen.jsx', 'src/ai-coach/home-screen/CoachHomeScreen.jsx'],
  ['src/ai-coach/past-chats/saveAndLoadChats.js', 'src/ai-coach/past-chats/saveAndLoadChats.js'],
  ['src/ai-coach/home-screen/CoachHomeScreen.jsx', 'src/ai-coach/home-screen/CoachHomeScreen.jsx'],
  ['src/ai-coach/chat-ui/helpers/coachCapabilities.js', 'src/ai-coach/chat-ui/helpers/coachQuickActionsList.js'],
  ['src/ai-coach/chat-ui/helpers/coachClipboard.js', 'src/ai-coach/reply-display/copyableReplyText.js'],
  ['src/ai-coach/chat-ui/toolModals/GenerateDeloadModal.jsx', 'src/ai-coach/chat-ui/tool-modals/PlanDeloadWeekSheet.jsx'],

  // Tool modals
  ['src/ai-coach/chat-ui/tool-modals/AdjustMacrosModal.jsx', 'src/ai-coach/confirm-popups/ChangeFoodTargetsPopup.jsx'],
  ['src/ai-coach/chat-ui/tool-modals/BookSessionModal.jsx', 'src/ai-coach/confirm-popups/BookSessionPopup.jsx'],
  ['src/ai-coach/chat-ui/tool-modals/DeleteLogModal.jsx', 'src/ai-coach/confirm-popups/ConfirmDeletePopup.jsx'],
  ['src/ai-coach/chat-ui/tool-modals/LogMoodModal.jsx', 'src/ai-coach/confirm-popups/LogMoodPopup.jsx'],
  ['src/ai-coach/chat-ui/tool-modals/LogNutritionModal.jsx', 'src/ai-coach/confirm-popups/LogMealPopup.jsx'],
  ['src/ai-coach/chat-ui/tool-modals/LogRestDayModal.jsx', 'src/ai-coach/confirm-popups/MarkRestDayPopup.jsx'],
  ['src/ai-coach/chat-ui/tool-modals/LogSleepModal.jsx', 'src/ai-coach/confirm-popups/LogSleepPopup.jsx'],
  ['src/ai-coach/chat-ui/tool-modals/LogStepsModal.jsx', 'src/ai-coach/confirm-popups/LogStepsPopup.jsx'],
  ['src/ai-coach/chat-ui/tool-modals/LogWaterModal.jsx', 'src/ai-coach/confirm-popups/LogWaterPopup.jsx'],
  ['src/ai-coach/chat-ui/tool-modals/NotifyTrainerModal.jsx', 'src/ai-coach/confirm-popups/MessageTrainerPopup.jsx'],
  ['src/ai-coach/chat-ui/tool-modals/OpenWorkoutPlanModal.jsx', 'src/ai-coach/confirm-popups/OpenWorkoutPlanPopup.jsx'],
  ['src/ai-coach/chat-ui/tool-modals/RateEnergyModal.jsx', 'src/ai-coach/confirm-popups/RateEnergyPopup.jsx'],
  ['src/ai-coach/chat-ui/tool-modals/RateWorkoutModal.jsx', 'src/ai-coach/confirm-popups/RateWorkoutPopup.jsx'],
  ['src/ai-coach/chat-ui/tool-modals/UpdateGoalModal.jsx', 'src/ai-coach/confirm-popups/UpdateGoalPopup.jsx'],
  ['src/ai-coach/chat-ui/tool-modals/UpdateWorkoutModal.jsx', 'src/ai-coach/confirm-popups/EditWorkoutPopup.jsx'],

  // Client app
  ['src/client-app/home/TrainingHomeScreen.jsx', 'src/client-app/home/TrainingHomeScreen.jsx'],
  ['src/client-app/screens/BrowseSavedWorkoutsScreen.js', 'src/client-app/screens/BrowseSavedWorkoutsScreen.jsx'],
  ['src/client-app/screens/MyMessagesScreen.js', 'src/client-app/screens/MyMessagesScreen.jsx'],
  ['src/client-app/screens/LogTodaysMealsScreen.js', 'src/client-app/screens/LogTodaysMealsScreen.jsx'],
  ['src/client-app/screens/ChatWithTrainerScreen.js', 'src/client-app/screens/ChatWithTrainerScreen.jsx'],
  ['src/client-app/screens/MyProgressPhotosScreen.js', 'src/client-app/screens/MyProgressPhotosScreen.jsx'],
  ['src/client-app/screens/ViewMyWorkoutPlanScreen.jsx', 'src/client-app/screens/ViewMyWorkoutPlanScreen.jsx'],
  ['src/client-app/screens/ViewWeekProgressReportScreen.jsx', 'src/client-app/screens/ViewWeekProgressReportScreen.jsx'],
  ['src/client-app/settings/EditAccountScreen.jsx', 'src/client-app/settings/EditAccountScreen.jsx'],
  ['src/client-app/settings/EditFitnessGoalsScreen.jsx', 'src/client-app/settings/EditFitnessGoalsScreen.jsx'],
  ['src/client-app/profile/MyProfileScreen.jsx', 'src/client-app/profile/ViewMyViewMyProfileScreen.jsx'],
  ['src/client-app/marketplace/screens/BrowseTrainersScreen.js', 'src/client-app/marketplace/screens/BrowseTrainersScreen.jsx'],
  ['src/client-app/marketplace/screens/SearchTrainersScreen.js', 'src/client-app/marketplace/screens/SearchTrainersScreen.jsx'],

  // Trainer app
  ['src/trainer-app/screens/BrowseSavedWorkoutsScreen.js', 'src/trainer-app/screens/GenerateTraineeWorkoutScreen.jsx'],
  ['src/trainer-app/screens/MyMessagesScreen.js', 'src/trainer-app/screens/MyMessagesScreen.jsx'],
  ['src/trainer-app/screens/MyProgressPhotosScreen.js', 'src/trainer-app/screens/ViewTraineePhotosScreen.jsx'],
  ['src/trainer-app/screens/SessionFormScreen.jsx', 'src/trainer-app/scheduling/ScheduleSessionScreen.jsx'],
  ['src/trainer-app/screens/SessionSchedulingScreen.jsx', 'src/trainer-app/screens/BookTraineeSessionScreen.jsx'],
  ['src/trainer-app/screens/TrainerChatWithTrainerScreen.js', 'src/trainer-app/screens/ChatWithTraineeScreen.jsx'],
  ['src/trainer-app/screens/SearchTrainersScreen.js', 'src/trainer-app/screens/FindTraineesScreen.jsx'],
  ['src/trainer-app/client-detail/TrainerClientDetailScreen.jsx', 'src/trainer-app/trainee-detail/ManageTraineeScreen.jsx'],
  ['src/trainer-app/clients-list/TrainerClientsListScreen.jsx', 'src/trainer-app/my-trainees/MyTraineesScreen.jsx'],
  ['src/trainer-app/client-requests/ClientRequestsScreen.js', 'src/trainer-app/new-requests/NewTraineeRequestsScreen.jsx'],
  ['src/trainer-app/client-records/formatClientName.js', 'src/trainer-app/trainee-records/getTraineeDisplayName.js'],
  ['src/trainer-app/client-records/resolveLinkedTrainerClients.js', 'src/trainer-app/trainee-records/loadMyLinkedTrainees.js'],
  ['src/trainer-app/hooks/use-sessions.js', 'src/trainer-app/scheduling/mySessions.js'],
  ['src/trainer-app/client-requests/trainerPendingRequestsService.js', 'src/trainer-app/new-requests/loadPendingTraineeRequests.js'],
  ['src/trainer-app/clients-list/loadTrainerClientRoster.js', 'src/trainer-app/my-trainees/traineeList.js'],

  // Nutrition food search
  ['src/nutrition/food-search/searchFoods.js', 'src/nutrition/food-search/searchFoods.js'],
  ['src/nutrition/food-search/tidyFoodTitles.js', 'src/nutrition/food-search/tidyFoodTitles.js'],
  ['src/nutrition/food-search/rankFoodResults.js', 'src/nutrition/food-search/rankFoodResults.js'],
  ['src/nutrition/food-search/trustRestaurantResult.js', 'src/nutrition/food-search/trustRestaurantResult.js'],
  ['src/nutrition/food-search/combineFoodSources.js', 'src/nutrition/food-search/combineFoodSources.js'],
  ['src/nutrition/food-search/guessServingLabel.js', 'src/nutrition/food-search/guessServingLabel.js'],
  ['src/nutrition/food-search/readableFoodTitle.js', 'src/nutrition/food-search/readableFoodTitle.js'],

  // Nutrition food details
  ['src/nutrition/food-details/formatFoodBrand.js', 'src/nutrition/food-details/tidyBrandName.js'],
  ['src/nutrition/food-details/normalizeNutritionData.js', 'src/nutrition/food-details/fixPackageAmounts.js'],
  ['src/nutrition/food-cards/FoodCard/mapLogToPremiumFood.js', 'src/nutrition/food-cards/foodCardText.js'],

  // Metrics
  ['src/metrics/daily-metrics/dailyMetricsParse.cjs', 'src/daily-stats/readDailyStats.js'],
  ['src/metrics/daily-metrics/getLatestWeight.js', 'src/daily-stats/latestWeight.js'],
  ['src/metrics/daily-metrics/rolloverDayAtMidnight.js', 'src/daily-stats/saveYesterdaysStats.js'],

  // Notifications
  ['src/notifications/pushNotificationText.js', 'src/notifications/writeAlertText.js'],

  // Messaging (shared → root messaging)
  ['src/messaging/InboxScreen.js', 'src/messaging/InboxScreen.jsx'],
  ['src/messaging/ChatWithTrainerScreen.js', 'src/messaging/ChatScreen.jsx'],

  // Shared screens duplicates
  ['src/for-both/workout-plans/SavedWorkoutsScreen.js', 'src/for-both/workout-plans/SavedWorkoutsScreen.jsx'],
  ['src/for-both/photo-gallery/MyProgressPhotosScreen.js', 'src/for-both/photo-gallery/MyProgressPhotosScreen.jsx'],
  ['src/for-both/weekly-report/WeeklyReportScreen.jsx', 'src/for-both/weekly-report/WeeklyReportScreen.jsx'],
  ['src/for-both/weekly-report/WeeklyReportScreen.jsx', 'src/for-both/weekly-report/WeeklyReportScreen.jsx'],
  ['src/for-both/workout-plans/SavedWorkoutsScreen.js', 'src/for-both/workout-plans/SavedWorkoutsScreen.jsx'],
  ['src/for-both/photo-gallery/MyProgressPhotosScreen.js', 'src/for-both/photo-gallery/MyProgressPhotosScreen.jsx'],

  // Workouts
  ['src/workouts/screens/WorkoutPlanGeneratorScreenUI.js', 'src/workouts/create-plan/GenerateMyWorkoutPlanScreen.jsx'],
];

/** Path prefix replacements for imports — longest first */
const PATH_REPLACEMENTS = [
  ['src/aiChat/', 'src/ai-coach/chat-ui/'],
  ['src/ai/', 'src/ai-coach/logic/'],
  ['../aiChat/', '../chat-ui/'],
  ['../ai/', '../ai-coach/logic/'],
  ['../../aiChat/', '../../chat-ui/'],
  ['../../ai/', '../../logic/'],
  ['../../../aiChat/', '../../../chat-ui/'],
  ['../../../ai/', '../../../logic/'],
  ['../../../../aiChat/', '../../../../chat-ui/'],
  ['../../../../ai/', '../../../../logic/'],
  ['src/app-start/', 'src/app-start/'],
  ['src/client-app/', 'src/client-app/'],
  ['src/trainer-app/', 'src/trainer-app/'],
  ['src/for-both/coach-tools/', 'src/ai-coach/tools/'],
  ['src/for-both/daily-metrics/', 'src/metrics/daily-metrics/'],
  ['src/for-both/daily-quotes/', 'src/metrics/daily-quotes/'],
  ['src/for-both/ui/', 'src/theme/'],
  ['src/for-both/utils/', 'src/helpers/'],
  ['src/for-both/messaging/', 'src/messaging/'],
  ['src/for-both/notifications/', 'src/notifications/'],
  ['src/profile/screens/', 'src/client-app/profile/'],
  ['assets/lottie/', 'assets/animations/app-flows/'],
  ['Lotties for Anatrox', 'animations/legacy'],
  ['../for-both/ui/', '../theme/'],
  ['../../for-both/ui/', '../../theme/'],
  ['../../../for-both/ui/', '../../../theme/'],
  ['../for-both/utils/', '../helpers/'],
  ['../../for-both/utils/', '../../helpers/'],
  ['../../../for-both/utils/', '../../../helpers/'],
  ['../for-both/daily-metrics/', '../metrics/daily-metrics/'],
  ['../../for-both/daily-metrics/', '../../metrics/daily-metrics/'],
  ['../../../for-both/daily-metrics/', '../../../metrics/daily-metrics/'],
  ['../for-both/messaging/', '../messaging/'],
  ['../../for-both/messaging/', '../../messaging/'],
  ['../for-both/notifications/', '../notifications/'],
  ['../../for-both/notifications/', '../../notifications/'],
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
