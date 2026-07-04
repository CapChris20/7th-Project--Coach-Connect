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
  'src/ai-coach/server-logic/chat-api/deepseekService.js': 'src/ai-coach/server-logic/chat-api/deepseekService.js',
  'src/ai-coach/server-logic/chat-api/webSearchRouting.js': 'src/ai-coach/server-logic/chat-api/webSearchRouting.js',
  'src/ai-coach/server-logic/context/coachPersonalDataRouting.js': 'src/ai-coach/server-logic/context/coachPersonalDataRouting.js',
  'src/ai-coach/server-logic/context/coachWeeklyDataClient.js': 'src/ai-coach/server-logic/context/coachWeeklyDataClient.js',
  'src/ai-coach/server-logic/context/contextAggregation.js': 'src/ai-coach/server-logic/context/contextAggregation.js',
  'src/ai-coach/server-logic/macro-recalibration/macroRecalibration.js': 'src/ai-coach/server-logic/macro-recalibration/macroRecalibration.js',
  'src/ai-coach/server-logic/tools/coachDeleteLogRouting.js': 'src/ai-coach/server-logic/tools/coachDeleteLogRouting.js',
  'src/ai-coach/server-logic/tools/coachToolProposalGuards.js': 'src/ai-coach/server-logic/tools/coachToolProposalGuards.js',
  'src/ai-coach/server-logic/tools/inferCoachToolCallClient.js': 'src/ai-coach/server-logic/tools/inferCoachToolCallClient.js',
  'src/ai-coach/server-logic/tools/normalizeToolParams.js': 'src/ai-coach/server-logic/tools/normalizeToolParams.js',
  'src/ai-coach/server-logic/tools/toolExecutor.js': 'src/ai-coach/server-logic/tools/toolExecutor.js',
  'src/ai-coach/server-logic/trainer-messaging/trainerMessaging.js': 'src/ai-coach/server-logic/trainer-messaging/trainerMessaging.js',
  'src/ai-coach/server-logic/vision/imageService.js': 'src/ai-coach/server-logic/vision/imageService.js',
  'src/ai-coach/chat-ui/chat-thread/coachCategoryPrompts.js': 'src/ai-coach/chat-ui/chat-thread/coachCategoryPrompts.js',
  'src/ai-coach/chat-ui/chat-thread/coachSourcePreview.js': 'src/ai-coach/chat-ui/chat-thread/coachSourcePreview.js',
  'src/ai-coach/chat-ui/chat-thread/coachAttachmentPickers.js': 'src/ai-coach/chat-ui/chat-thread/coachAttachmentPickers.js',
  'src/ai-coach/chat-ui/chat-thread/showCoachAttachMenu.js': 'src/ai-coach/chat-ui/chat-thread/showCoachAttachMenu.js',
  'src/ai-coach/chat-ui/persistence/aiChatPersistence.js': 'src/ai-coach/chat-ui/persistence/aiChatPersistence.js',
  'src/ai-coach/chat-ui/tool-modals/toolModalShared.js': 'src/ai-coach/chat-ui/tool-modals/toolModalShared.js',
  'src/ai-coach/chat-ui/voice/useCoachSpeech.js': 'src/ai-coach/chat-ui/voice/useCoachSpeech.js',
  'src/app-start/authGateLogic.js': 'src/auth/detectUserRole.js',
  'src/app-start/config.js': 'src/app-start/config.js',
  'src/client-app/home/clientHomeComponents.jsx': 'src/client-app/home/clientHomeComponents.jsx',
  'src/client-app/home/clientAppStyles.js': 'src/client-app/home/clientAppStyles.js',
  'src/client-app/home/useClientHomeBootstrap.js': 'src/client-app/home/useClientHomeBootstrap.js',
  'src/client-app/home/useClientHomeDailyMetrics.js': 'src/shared/hooks/useClientHomeDailyMetrics.js',
  'src/client-app/dashboard/TrainingDashboardScreen.jsx': 'src/client-app/dashboard/TrainingDashboardScreen.jsx',
  'src/client-app/dashboard/DashboardHeroCard.jsx': 'src/client-app/dashboard/DashboardHeroCard.jsx',
  'src/client-app/dashboard/PremiumStatsSection.jsx': 'src/client-app/dashboard/PremiumStatsSection.jsx',
  'src/client-app/dashboard/PremiumTrainerCard.jsx': 'src/client-app/dashboard/PremiumTrainerCard.jsx',
  'src/client-app/dashboard/ReviewSubmitSheet.js': 'src/shared/components/ReviewSubmitSheet.js',
  'src/client-app/files/NotesFromTrainerSection.jsx': 'src/client-app/files/NotesFromTrainerSection.jsx',
  'src/client-app/navigation/clientOverlayScreens.jsx': 'src/client-app/navigation/clientOverlayScreens.jsx',
  'src/nutrition/barcode/barcodeDisplay.js': 'src/nutrition/barcode/barcodeDisplay.js',
  'src/nutrition/daily-log/nutritionService.js': 'src/nutrition/daily-log/nutritionService.js',
  'src/nutrition/food-details/foodBrandDisplay.js': 'src/nutrition/food-details/foodBrandDisplay.js',
  'src/nutrition/food-details/nutritionFactsModel.js': 'src/nutrition/food-details/nutritionFactsModel.js',
  'src/nutrition/food-details/nutritionNormalization.js': 'src/nutrition/food-details/nutritionNormalization.js',
  'src/nutrition/food-details/servingMath.js': 'src/nutrition/food-details/servingMath.js',
  'src/nutrition/food-search/FoodConfirmSheet.jsx': 'src/nutrition/food-search/FoodConfirmSheet.jsx',
  'src/nutrition/food-search/FoodSearchAccuracyHeroCard.jsx': 'src/nutrition/food-search/FoodSearchAccuracyHeroCard.jsx',
  'src/nutrition/food-search/foodNormalize.js': 'src/nutrition/food-search/foodNormalize.js',
  'src/nutrition/food-search/foodSearchQueryMatch.js': 'src/nutrition/food-search/foodSearchQueryMatch.js',
  'src/nutrition/food-search/foodSearchTitle.js': 'src/nutrition/food-search/foodSearchTitle.js',
  'src/nutrition/food-search/restaurantSerperQuality.js': 'src/nutrition/food-search/restaurantSerperQuality.js',
  'src/metrics/daily-metrics/dailyDashboardDayRollover.js': 'src/metrics/daily-metrics/archiveDailyMetricsAtMidnight.js',
  'src/metrics/daily-metrics/dailyMetricsService.js': 'src/metrics/daily-metrics/dailyMetricsService.js',
  'src/metrics/daily-metrics/latestLoggedWeight.js': 'src/metrics/daily-metrics/getRecentWeight.js',
  'src/shared/firestore/storage.js': 'src/shared/firestore/storageHelpers.js',
  'src/shared/notes-files/notesAndFilesService.js': 'src/shared/notes-files/manageNotesAndFiles.js',
  'src/notifications/notificationsService.js': 'src/notifications/manageNotifications.js',
  'src/notifications/pushCopy.js': 'src/notifications/pushCopy.js',
  'src/shared/api/apiAuthHeaders.js': 'src/shared/api/getAuthHeaders.js',
  'src/shared/api/logger.js': 'src/shared/api/logErrorToServer.js',
  'src/shared/api/monitoring.js': 'src/shared/api/monitorAppHealth.js',
  'src/shared/api/onboardingSync.js': 'src/shared/api/syncOnboardingToServer.js',
  'src/shared/api/pushNotifyApi.js': 'src/shared/api/sendPushNotification.js',
  'src/shared/marketplace/trainerMarketplaceSync.js': 'src/shared/marketplace/syncTrainerMarketplaceProfile.js',
  'src/shared/workout-profile/profileCardVisibility.js': 'src/shared/workout-profile/profileCardVisibility.js',
  'src/trainer-app/crm/trainerClientDisplayName.js': 'src/trainer-app/crm/trainerClientDisplayName.js',
  'src/trainer-app/clients-list/clientCRMService.js': 'src/trainer-app/clients-list/clientCRMService.js',
  'src/utils/dataCacheCleanup.js': 'src/utils/dataCacheCleanup.js',
  'src/utils/errorSyncService.js': 'utils/errorSyncService.js',
  'src/workouts/active-workout/workout.js': 'src/workouts/active-workout/workout.js',
  'src/workouts/plan-generator/workoutGenerationUsage.js': 'src/workouts/active-workout/workoutGenerationUsage.js',
  'src/workouts/plan-generator/workoutPlanApi.js': 'src/workouts/active-workout/workoutPlanApi.js',
};

const MOVES = [
  ['src/ai-coach/server-logic/chat-api/deepseekService.js', 'src/ai-coach/server-logic/chat-api/sendCoachMessageToServer.js'],
  ['src/ai-coach/server-logic/chat-api/webSearchRouting.js', 'src/ai-coach/server-logic/chat-api/shouldUseWebSearch.js'],
  ['src/ai-coach/server-logic/context/coachPersonalDataRouting.js', 'src/ai-coach/server-logic/context/buildCoachPromptData.js'],
  ['src/ai-coach/server-logic/context/coachWeeklyDataClient.js', 'src/ai-coach/server-logic/context/loadCoachWeeklyStats.js'],
  ['src/ai-coach/server-logic/context/contextAggregation.js', 'src/ai-coach/server-logic/context/loadCoachPersonalContext.js'],
  ['src/ai-coach/server-logic/macro-recalibration/macroRecalibration.js', 'src/ai-coach/server-logic/macro-recalibration/recalculateMacrosFromCoach.js'],
  ['src/ai-coach/server-logic/tools/coachDeleteLogRouting.js', 'src/ai-coach/server-logic/tools/detectDeleteFoodRequest.js'],
  ['src/ai-coach/server-logic/tools/coachToolProposalGuards.js', 'src/ai-coach/server-logic/tools/shouldShowCoachAction.js'],
  ['src/ai-coach/server-logic/tools/inferCoachToolCallClient.js', 'src/ai-coach/server-logic/tools/findCoachRequestsInText.js'],
  ['src/ai-coach/server-logic/tools/normalizeToolParams.js', 'src/ai-coach/server-logic/tools/cleanupToolParams.js'],
  ['src/ai-coach/server-logic/tools/toolExecutor.js', 'src/ai-coach/server-logic/tools/runCoachAction.js'],
  ['src/ai-coach/server-logic/trainer-messaging/trainerMessaging.js', 'src/ai-coach/server-logic/trainer-messaging/sendTrainerNotification.js'],
  ['src/ai-coach/server-logic/vision/imageService.js', 'src/ai-coach/server-logic/vision/imageStorageService.js'],
  ['src/ai-coach/chat-ui/chat-thread/coachCategoryPrompts.js', 'src/ai-coach/chat-ui/chat-thread/coachQuickPrompts.js'],
  ['src/ai-coach/chat-ui/chat-thread/coachSourcePreview.js', 'src/ai-coach/chat-ui/chat-thread/renderSourcePreview.js'],
  ['src/ai-coach/chat-ui/chat-thread/coachAttachmentPickers.js', 'src/ai-coach/chat-ui/chat-thread/pickAttachmentType.js'],
  ['src/ai-coach/chat-ui/chat-thread/showCoachAttachMenu.js', 'src/ai-coach/chat-ui/chat-thread/openAttachmentMenu.js'],
  ['src/ai-coach/chat-ui/persistence/aiChatPersistence.js', 'src/ai-coach/chat-ui/persistence/saveCoachMessages.js'],
  ['src/ai-coach/chat-ui/tool-modals/toolModalShared.js', 'src/ai-coach/chat-ui/tool-modals/toolModalHelpers.js'],
  ['src/ai-coach/chat-ui/voice/useCoachSpeech.js', 'src/ai-coach/chat-ui/voice/useVoiceToCoach.js'],
  ['src/nutrition/barcode/barcodeDisplay.js', 'src/nutrition/barcode/renderScannedBarcode.js'],
  ['src/nutrition/daily-log/nutritionService.js', 'src/nutrition/daily-log/logFoodToFirestore.js'],
  ['src/nutrition/food-details/foodBrandDisplay.js', 'src/nutrition/food-details/cleanFoodBrandName.js'],
  ['src/nutrition/food-details/nutritionFactsModel.js', 'src/nutrition/food-details/parseNutritionLabel.js'],
  ['src/nutrition/food-details/nutritionNormalization.js', 'src/nutrition/food-details/fixFoodNutritionNumbers.js'],
  ['src/nutrition/food-details/servingMath.js', 'src/nutrition/food-details/calculateServingSize.js'],
  ['src/nutrition/food-search/FoodConfirmSheet.jsx', 'src/nutrition/food-search/ConfirmFoodSelectionSheet.jsx'],
  ['src/nutrition/food-search/FoodSearchAccuracyHeroCard.jsx', 'src/nutrition/food-search/SearchQualityCard.jsx'],
  ['src/nutrition/food-search/foodNormalize.js', 'src/nutrition/food-search/normalizeFoodQuery.js'],
  ['src/nutrition/food-search/foodSearchQueryMatch.js', 'src/nutrition/food-search/sortBestFoodMatches.js'],
  ['src/nutrition/food-search/foodSearchTitle.js', 'src/nutrition/food-search/cleanFoodCardLabels.js'],
  ['src/nutrition/food-search/restaurantSerperQuality.js', 'src/nutrition/food-search/isReliableRestaurantFood.js'],
  ['src/metrics/daily-metrics/dailyMetricsService.js', 'src/metrics/daily-metrics/saveDailyMetricsToFirestore.js'],
  ['src/metrics/daily-metrics/dailyDashboardDayRollover.js', 'src/metrics/daily-metrics/archiveDailyMetricsAtMidnight.js'],
  ['src/metrics/daily-metrics/latestLoggedWeight.js', 'src/metrics/daily-metrics/getRecentWeight.js'],
  ['src/shared/api/apiAuthHeaders.js', 'src/shared/api/getAuthHeaders.js'],
  ['src/shared/api/logger.js', 'src/shared/api/logErrorToServer.js'],
  ['src/shared/api/monitoring.js', 'src/shared/api/monitorAppHealth.js'],
  ['src/shared/api/onboardingSync.js', 'src/shared/api/syncOnboardingToServer.js'],
  ['src/shared/api/pushNotifyApi.js', 'src/shared/api/sendPushNotification.js'],
  ['src/shared/notes-files/notesAndFilesService.js', 'src/shared/notes-files/manageNotesAndFiles.js'],
  ['src/notifications/notificationsService.js', 'src/notifications/manageNotifications.js'],
  ['src/notifications/pushCopy.js', 'src/notifications/buildPushNotificationText.js'],
  ['src/shared/firestore/storage.js', 'src/shared/firestore/storageHelpers.js'],
  ['src/shared-utils/localDay.js', 'src/shared-utils/getLocalDay.js'],
  ['src/shared-utils/fileFormatting.js', 'src/shared-utils/formatFileSize.js'],
  ['src/shared-utils/heightFeetInches.js', 'src/shared-utils/convertHeightUnits.js'],
  ['src/shared-utils/notesFileView.js', 'src/shared-utils/getFileViewType.js'],
  ['src/shared-utils/trainerProfileMedia.js', 'src/shared-utils/getTrainerProfileMedia.js'],
  ['src/shared/workout-profile/profileCardVisibility.js', 'src/shared/workout-profile/shouldShowProfileCard.js'],
  ['src/trainer-app/crm/trainerClientDisplayName.js', 'src/trainer-app/crm/getTraineeDisplayName.js'],
  ['src/trainer-app/clients-list/clientCRMService.js', 'src/trainer-app/clients-list/loadMyTraineeRoster.js'],
  ['src/utils/dataCacheCleanup.js', 'src/utils/clearDataOnLogout.js'],
  ['src/utils/errorSyncService.js', 'src/utils/syncErrorsToServer.js'],
  ['src/workouts/plan-generator/workoutGenerationUsage.js', 'src/workouts/plan-generator/trackWorkoutGenerationUsage.js'],
  ['src/workouts/plan-generator/workoutPlanApi.js', 'src/workouts/plan-generator/requestWorkoutPlan.js'],
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
