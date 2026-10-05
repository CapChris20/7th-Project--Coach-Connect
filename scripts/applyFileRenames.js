#!/usr/bin/env node
/**
 * Apply Coach Connect feature-folder moves + descriptive renames.
 * Resolves legacy paths (pre-reorg layout) before moving.
 *
 *   node scripts/applyFileRenames.js --dry-run
 *   node scripts/applyFileRenames.js --apply
 *   node scripts/applyFileRenames.js --apply --batch=ai
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--apply');
const batchArg = args.find((a) => a.startsWith('--batch='));
const BATCH = batchArg ? batchArg.split('=')[1] : 'all';

/** When target "from" path is missing, try these legacy locations (June 14 repo layout). */
const LEGACY = {
  'src/ai-coach/logic/chat-api/deepseekService.js': 'src/ai-coach/logic/chat-api/deepseekService.js',
  'src/ai-coach/logic/chat-api/webSearchRouting.js': 'src/ai-coach/logic/chat-api/webSearchRouting.js',
  'src/ai-coach/logic/context/coachPersonalDataRouting.js': 'src/ai-coach/logic/context/coachPersonalDataRouting.js',
  'src/ai-coach/logic/context/coachWeeklyDataClient.js': 'src/ai-coach/logic/context/coachWeeklyDataClient.js',
  'src/ai-coach/logic/context/contextAggregation.js': 'src/ai-coach/logic/context/contextAggregation.js',
  'src/ai-coach/logic/macro-recalibration/macroRecalibration.js': 'src/ai-coach/logic/macro-recalibration/macroRecalibration.js',
  'src/ai-coach/logic/tools/coachDeleteLogRouting.js': 'src/ai-coach/logic/tools/coachDeleteLogRouting.js',
  'src/ai-coach/logic/tools/coachToolProposalGuards.js': 'src/ai-coach/logic/tools/coachToolProposalGuards.js',
  'src/ai-coach/logic/tools/inferCoachToolCallClient.js': 'src/ai-coach/logic/tools/inferCoachToolCallClient.js',
  'src/ai-coach/logic/tools/normalizeToolParams.js': 'src/ai-coach/logic/tools/normalizeToolParams.js',
  'src/ai-coach/logic/tools/toolExecutor.js': 'src/ai-coach/logic/tools/toolExecutor.js',
  'src/ai-coach/logic/trainer-messaging/trainerMessaging.js': 'src/ai-coach/logic/trainer-messaging/trainerMessaging.js',
  'src/ai-coach/logic/vision/imageService.js': 'src/ai-coach/logic/vision/imageService.js',
  'src/ai-coach/chat-ui/chat-thread/coachCategoryPrompts.js': 'src/ai-coach/chat-ui/chat-thread/coachCategoryPrompts.js',
  'src/ai-coach/chat-ui/chat-thread/coachSourcePreview.js': 'src/ai-coach/chat-ui/chat-thread/coachSourcePreview.js',
  'src/ai-coach/chat-ui/chat-thread/coachAttachmentPickers.js': 'src/ai-coach/chat-ui/chat-thread/coachAttachmentPickers.js',
  'src/ai-coach/chat-ui/chat-thread/showCoachAttachMenu.js': 'src/ai-coach/chat-ui/chat-thread/showCoachAttachMenu.js',
  'src/ai-coach/chat-ui/persistence/aiChatPersistence.js': 'src/ai-coach/chat-ui/persistence/aiChatPersistence.js',
  'src/ai-coach/chat-ui/tool-modals/toolModalShared.js': 'src/ai-coach/chat-ui/tool-modals/toolModalShared.js',
  'src/ai-coach/chat-ui/voice/useCoachSpeech.js': 'src/ai-coach/chat-ui/voice/useCoachSpeech.js',
  'src/app-start/authGateLogic.js': 'src/login-and-signup/decideTraineeOrTrainer.js',
  'src/app-start/config.js': 'src/app-start/config.js',
  'src/client-app/home/homeScreenPieces.jsx': 'src/client-app/home/homeScreenPieces.jsx',
  'src/client-app/home/homeLooks.js': 'src/client-app/home/homeLooks.js',
  'src/client-app/home/loadHomeScreenData.js': 'src/client-app/home/loadHomeScreenData.js',
  'src/client-app/home/keepDailyStatsFresh.js': 'src/for-both/hooks/useClientHomeDailyMetrics.js',
  'src/client-app/home/TrainingHomeScreen.jsx': 'src/client-app/home/TrainingHomeScreen.jsx',
  'src/client-app/home/TopBannerCard.jsx': 'src/client-app/home/TopBannerCard.jsx',
  'src/client-app/home/TodayStatsCards.jsx': 'src/client-app/home/TodayStatsCards.jsx',
  'src/client-app/home/MyTrainerCard.jsx': 'src/client-app/home/MyTrainerCard.jsx',
  'src/client-app/home/WriteTrainerReviewPopup.js': 'src/for-both/components/ReviewSubmitSheet.js',
  'src/client-app/files-and-notes/NotesFromTrainerSection.jsx': 'src/client-app/files-and-notes/NotesFromTrainerSection.jsx',
  'src/client-app/navigation/clientExtraScreens.jsx': 'src/client-app/navigation/clientExtraScreens.jsx',
  'src/nutrition/barcode/barcodeDisplay.js': 'src/nutrition/barcode/barcodeDisplay.js',
  'src/nutrition/daily-log/nutritionService.js': 'src/nutrition/daily-log/nutritionService.js',
  'src/nutrition/food-details/foodBrandDisplay.js': 'src/nutrition/food-details/foodBrandDisplay.js',
  'src/nutrition/food-details/nutritionFactsData.js': 'src/nutrition/food-details/nutritionFactsData.js',
  'src/nutrition/food-details/nutritionNormalization.js': 'src/nutrition/food-details/nutritionNormalization.js',
  'src/nutrition/food-details/servingMath.js': 'src/nutrition/food-details/servingMath.js',
  'src/nutrition/food-search/FoodConfirmSheet.jsx': 'src/nutrition/food-search/FoodConfirmSheet.jsx',
  'src/nutrition/food-search/FoodSearchAccuracyHeroCard.jsx': 'src/nutrition/food-search/FoodSearchAccuracyHeroCard.jsx',
  'src/nutrition/food-search/foodNormalize.js': 'src/nutrition/food-search/foodNormalize.js',
  'src/nutrition/food-search/foodSearchQueryMatch.js': 'src/nutrition/food-search/foodSearchQueryMatch.js',
  'src/nutrition/food-search/foodSearchTitle.js': 'src/nutrition/food-search/foodSearchTitle.js',
  'src/nutrition/food-search/restaurantSerperQuality.js': 'src/nutrition/food-search/restaurantSerperQuality.js',
  'src/metrics/daily-metrics/dailyDashboardDayRollover.js': 'src/daily-stats/saveYesterdaysStats.js',
  'src/metrics/daily-metrics/dailyMetricsService.js': 'src/metrics/daily-metrics/dailyMetricsService.js',
  'src/metrics/daily-metrics/latestLoggedWeight.js': 'src/daily-stats/latestWeight.js',
  'src/for-both/firestore/storage.js': 'src/for-both/cloud-database/uploadAndDownloadFiles.js',
  'src/for-both/notes-files/notesAndFilesService.js': 'src/for-both/files-and-notes/saveNotesAndFiles.js',
  'src/notifications/notificationsService.js': 'src/notifications/manageAlerts.js',
  'src/notifications/pushCopy.js': 'src/notifications/pushCopy.js',
  'src/for-both/api/apiAuthHeaders.js': 'src/for-both/online-connection/attachLoginProof.js',
  'src/for-both/api/logger.js': 'src/for-both/online-connection/sendCrashReport.js',
  'src/for-both/api/monitoring.js': 'src/for-both/online-connection/checkConnectionHealth.js',
  'src/for-both/api/onboardingSync.js': 'src/for-both/online-connection/uploadSetupAnswers.js',
  'src/for-both/api/pushNotifyApi.js': 'src/for-both/online-connection/sendPhoneAlert.js',
  'src/for-both/trainer-listing/keepTrainerListingUpdated.js': 'src/for-both/marketplace/syncTrainerMarketplaceProfile.js',
  'src/for-both/workout-profile/profileCardVisibility.js': 'src/for-both/workout-profile/profileCardVisibility.js',
  'src/trainer-app/client-records/trainerClientDisplayName.js': 'src/trainer-app/client-records/trainerClientDisplayName.js',
  'src/trainer-app/clients-list/clientCRMService.js': 'src/trainer-app/clients-list/clientCRMService.js',
  'src/logout-cleanup/clearDataOnLogout.js': 'src/logout-cleanup/clearDataOnLogout.js',
  'src/utils/errorSyncService.js': 'utils/errorSyncService.js',
  'src/workouts/active-workout/workout.js': 'src/workouts/active-workout/workout.js',
  'src/workouts/plan-generator/workoutGenerationUsage.js': 'src/workouts/active-workout/workoutGenerationUsage.js',
  'src/workouts/plan-generator/workoutPlanApi.js': 'src/workouts/active-workout/workoutPlanApi.js',
};

const MOVES = [
  ['src/ai-coach/logic/chat-api/deepseekService.js', 'src/ai-coach/conversation/sendMessageToCoach.js'],
  ['src/ai-coach/logic/chat-api/webSearchRouting.js', 'src/ai-coach/internet-lookup/shouldLookUpOnInternet.js'],
  ['src/ai-coach/logic/context/coachPersonalDataRouting.js', 'src/ai-coach/coach-knowledge/decideWhatCoachShouldKnow.js'],
  ['src/ai-coach/logic/context/coachWeeklyDataClient.js', 'src/ai-coach/coach-knowledge/loadWeeklyNumbers.js'],
  ['src/ai-coach/logic/context/contextAggregation.js', 'src/ai-coach/coach-knowledge/loadYourWeekForCoach.js'],
  ['src/ai-coach/logic/macro-recalibration/macroRecalibration.js', 'src/nutrition/targets/recalculateFoodTargets.js'],
  ['src/ai-coach/logic/tools/coachDeleteLogRouting.js', 'src/ai-coach/coach-actions/spotDeleteRequests.js'],
  ['src/ai-coach/logic/tools/coachToolProposalGuards.js', 'src/ai-coach/coach-actions/shouldAskFirst.js'],
  ['src/ai-coach/logic/tools/inferCoachToolCallClient.js', 'src/ai-coach/coach-actions/findActionsInReply.js'],
  ['src/ai-coach/logic/tools/normalizeToolParams.js', 'src/ai-coach/coach-actions/cleanUpActionDetails.js'],
  ['src/ai-coach/logic/tools/toolExecutor.js', 'src/ai-coach/coach-actions/carryOutAction.js'],
  ['src/ai-coach/logic/trainer-messaging/trainerMessaging.js', 'src/ai-coach/coach-actions/alertTrainer.js'],
  ['src/ai-coach/logic/vision/imageService.js', 'src/ai-coach/conversation/photoPermissions.js'],
  ['src/ai-coach/chat-ui/chat-thread/coachCategoryPrompts.js', 'src/ai-coach/conversation/suggestedQuestions.js'],
  ['src/ai-coach/chat-ui/chat-thread/coachSourcePreview.js', 'src/ai-coach/conversation/sourceLinkPreview.js'],
  ['src/ai-coach/chat-ui/chat-thread/coachAttachmentPickers.js', 'src/ai-coach/conversation/choosePhoto.js'],
  ['src/ai-coach/chat-ui/chat-thread/showCoachAttachMenu.js', 'src/ai-coach/conversation/openPhotoMenu.js'],
  ['src/ai-coach/chat-ui/persistence/aiChatPersistence.js', 'src/ai-coach/past-chats/saveAndLoadChats.js'],
  ['src/ai-coach/chat-ui/tool-modals/toolModalShared.js', 'src/ai-coach/confirm-popups/sharedPopupParts.js'],
  ['src/ai-coach/chat-ui/voice/useCoachSpeech.js', 'src/ai-coach/chat-ui/voice/useVoiceToCoach.js'],
  ['src/nutrition/barcode/barcodeDisplay.js', 'src/nutrition/barcode/scannedProductSummary.js'],
  ['src/nutrition/daily-log/nutritionService.js', 'src/nutrition/daily-log/saveLoggedFood.js'],
  ['src/nutrition/food-details/foodBrandDisplay.js', 'src/nutrition/food-details/tidyBrandName.js'],
  ['src/nutrition/food-details/nutritionFactsData.js', 'src/nutrition/food-details/parseNutritionLabel.js'],
  ['src/nutrition/food-details/nutritionNormalization.js', 'src/nutrition/food-details/fixPackageAmounts.js'],
  ['src/nutrition/food-details/servingMath.js', 'src/nutrition/food-details/servingSizeMath.js'],
  ['src/nutrition/food-search/FoodConfirmSheet.jsx', 'src/nutrition/food-search/ConfirmFoodPopup.jsx'],
  ['src/nutrition/food-search/FoodSearchAccuracyHeroCard.jsx', 'src/nutrition/food-search/SearchDisclaimerCard.jsx'],
  ['src/nutrition/food-search/foodNormalize.js', 'src/nutrition/food-search/cleanSearchText.js'],
  ['src/nutrition/food-search/foodSearchQueryMatch.js', 'src/nutrition/food-search/rankFoodResults.js'],
  ['src/nutrition/food-search/foodSearchTitle.js', 'src/nutrition/food-search/tidyFoodTitles.js'],
  ['src/nutrition/food-search/restaurantSerperQuality.js', 'src/nutrition/food-search/trustRestaurantResult.js'],
  ['src/metrics/daily-metrics/dailyMetricsService.js', 'src/daily-stats/saveDailyStats.js'],
  ['src/metrics/daily-metrics/dailyDashboardDayRollover.js', 'src/daily-stats/saveYesterdaysStats.js'],
  ['src/metrics/daily-metrics/latestLoggedWeight.js', 'src/daily-stats/latestWeight.js'],
  ['src/for-both/api/apiAuthHeaders.js', 'src/for-both/online-connection/attachLoginProof.js'],
  ['src/for-both/api/logger.js', 'src/for-both/online-connection/sendCrashReport.js'],
  ['src/for-both/api/monitoring.js', 'src/for-both/online-connection/checkConnectionHealth.js'],
  ['src/for-both/api/onboardingSync.js', 'src/for-both/online-connection/uploadSetupAnswers.js'],
  ['src/for-both/api/pushNotifyApi.js', 'src/for-both/online-connection/sendPhoneAlert.js'],
  ['src/for-both/notes-files/notesAndFilesService.js', 'src/for-both/files-and-notes/saveNotesAndFiles.js'],
  ['src/notifications/notificationsService.js', 'src/notifications/manageAlerts.js'],
  ['src/notifications/pushCopy.js', 'src/notifications/writeAlertText.js'],
  ['src/for-both/firestore/storage.js', 'src/for-both/cloud-database/uploadAndDownloadFiles.js'],
  ['src/helpers/localDay.js', 'src/helpers/getLocalDay.js'],
  ['src/helpers/fileFormatting.js', 'src/helpers/fileSizeAndDateText.js'],
  ['src/helpers/heightFeetInches.js', 'src/helpers/convertHeight.js'],
  ['src/helpers/notesFileView.js', 'src/helpers/whichViewerForFile.js'],
  ['src/helpers/trainerProfileMedia.js', 'src/helpers/trainerProfilePhoto.js'],
  ['src/for-both/workout-profile/profileCardVisibility.js', 'src/for-both/whichProfileCardsToShow.js'],
  ['src/trainer-app/client-records/trainerClientDisplayName.js', 'src/trainer-app/trainee-records/getTraineeDisplayName.js'],
  ['src/trainer-app/clients-list/clientCRMService.js', 'src/trainer-app/my-trainees/traineeList.js'],
  ['src/logout-cleanup/clearDataOnLogout.js', 'src/logout-cleanup/clearDataOnLogout.js'],
  ['src/utils/errorSyncService.js', 'src/crash-reports/sendSavedErrors.js'],
  ['src/workouts/plan-generator/workoutGenerationUsage.js', 'src/workouts/create-plan/countPlansCreated.js'],
  ['src/workouts/plan-generator/workoutPlanApi.js', 'src/workouts/create-plan/askForWorkoutPlan.js'],
];

function inBatch(toPath) {
  if (BATCH === 'all') return true;
  return toPath.split('/')[1] === BATCH || toPath.startsWith(`src/${BATCH}/`);
}

function resolveSource(from) {
  const candidates = [from, LEGACY[from]].filter(Boolean);
  for (const rel of candidates) {
    const full = path.join(ROOT, rel);
    if (fs.existsSync(full)) return rel;
  }
  return null;
}

function stripExt(p) {
  return p.replace(/\.(jsx?|cjs|mjs)$/, '');
}

/** Never rewrite these single-segment suffixes (package names, RN API keys). */
const SUFFIX_DENY = new Set([
  'storage', 'config', 'workout', 'workouts', 'calculations', 'logger', 'monitoring',
  'sessions', 'routes', 'linking', 'session', 'storageHelpers',
]);

function pathSuffixPairs(fromPath, toPath) {
  const fromParts = stripExt(fromPath.replace(/^src\//, '')).split('/');
  const toParts = stripExt(toPath.replace(/^src\//, '')).split('/');
  const pairs = [];
  const minLen = Math.min(fromParts.length, toParts.length);
  for (let depth = 1; depth <= minLen; depth += 1) {
    const fromSuffix = fromParts.slice(fromParts.length - depth).join('/');
    const toSuffix = toParts.slice(toParts.length - depth).join('/');
    if (fromSuffix === toSuffix) continue;
    const base = fromParts[fromParts.length - 1];
    if (SUFFIX_DENY.has(base)) continue;
    if (!fromSuffix.includes('/') && base.length < 12) continue;
    pairs.push([fromSuffix, toSuffix]);
  }
  return pairs;
}

function buildReplacements(appliedMoves) {
  const seen = new Set();
  const pairs = [];
  const add = (from, to) => {
    if (!from || !to || from === to || seen.has(from)) return;
    seen.add(from);
    pairs.push([from, to]);
  };
  for (const [from, to] of appliedMoves) {
    const fromNoExt = stripExt(from);
    const toNoExt = stripExt(to);
    add(fromNoExt, toNoExt);
    if (fromNoExt.startsWith('src/')) {
      add(fromNoExt.slice(4), toNoExt.slice(4));
    }
    for (const [fromSuffix, toSuffix] of pathSuffixPairs(from, to)) {
      add(fromSuffix, toSuffix);
    }
  }
  pairs.sort((a, b) => b[0].length - a[0].length);
  return pairs;
}

function walkFiles(dir, out = []) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return out;
  const stat = fs.statSync(full);
  if (stat.isFile()) {
    if (/\.(js|jsx|mjs|cjs|md|json|sh|rules|html)$/.test(dir) || !dir.includes('.')) out.push(full);
    return out;
  }
  for (const name of fs.readdirSync(full)) {
    if (name === 'node_modules' || name === '.git') continue;
    walkFiles(path.join(dir, name), out);
  }
  return out;
}

function moveFiles() {
  const applied = [];
  let moved = 0;
  let skipped = 0;
  let missing = 0;

  for (const [from, to] of MOVES) {
    if (!inBatch(to)) continue;
    const toPath = path.join(ROOT, to);
    if (fs.existsSync(toPath)) {
      skipped += 1;
      applied.push([from, to]);
      continue;
    }
    const source = resolveSource(from);
    if (!source) {
      console.warn('MISSING:', from);
      missing += 1;
      continue;
    }
    const sourcePath = path.join(ROOT, source);
    if (DRY_RUN) {
      console.log('WOULD MOVE:', source, '→', to);
      applied.push([source, to]);
      moved += 1;
      continue;
    }
    fs.mkdirSync(path.dirname(toPath), { recursive: true });
    fs.renameSync(sourcePath, toPath);
    console.log('MOVED:', source, '→', to);
    applied.push([source, to]);
    moved += 1;
  }
  return { moved, skipped, missing, applied };
}

function rewriteImports(replacements) {
  if (DRY_RUN && !args.includes('--rewrite-only')) {
    console.log(`Would rewrite imports using ${replacements.length} path pairs.`);
    return 0;
  }
  const scanRoots = ['src', 'server', 'scripts', 'App.js', 'utils', 'test'];
  const files = [];
  for (const r of scanRoots) walkFiles(r, files);
  let updated = 0;
  for (const file of files) {
    if (file.endsWith('applyFileRenames.js')) continue;
    let content = fs.readFileSync(file, 'utf8');
    let next = content;
    for (const [from, to] of replacements) {
      next = next.split(from).join(to);
    }
    if (next !== content) {
      fs.writeFileSync(file, next);
      updated += 1;
    }
  }
  return updated;
}

function main() {
  const rewriteOnly = args.includes('--rewrite-only');
  console.log(
    rewriteOnly ? 'REWRITE imports only' : DRY_RUN ? 'DRY RUN — pass --apply to execute' : 'APPLYING renames...',
    `(batch=${BATCH})`,
  );

  let applied = MOVES.filter(([, to]) => inBatch(to)).map(([from, to]) => {
    const source = resolveSource(from) || from;
    return [source, to];
  });

  let moved = 0;
  let skipped = 0;
  let missing = 0;

  if (!rewriteOnly) {
    const result = moveFiles();
    moved = result.moved;
    skipped = result.skipped;
    missing = result.missing;
    applied = result.applied;
  }

  const replacements = buildReplacements(applied);
  const updated = rewriteImports(replacements);
  console.log(`\nDone: ${moved} moved, ${skipped} already at target, ${missing} missing, ${updated} files import-updated.`);
  if (DRY_RUN && !rewriteOnly) console.log('Re-run with --apply when ready.');
}

main();
