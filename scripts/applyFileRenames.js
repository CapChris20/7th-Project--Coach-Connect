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
  'src/ai/chat-api/deepseekService.js': 'src/ai/deepseekService.js',
  'src/ai/chat-api/webSearchRouting.js': 'src/ai/webSearchRouting.js',
  'src/ai/context/coachPersonalDataRouting.js': 'src/ai/coachPersonalDataRouting.js',
  'src/ai/context/coachWeeklyDataClient.js': 'src/ai/coachWeeklyDataClient.js',
  'src/ai/context/contextAggregation.js': 'src/ai/contextAggregation.js',
  'src/ai/macro-recalibration/macroRecalibration.js': 'src/ai/macroRecalibration.js',
  'src/ai/tools/coachDeleteLogRouting.js': 'src/ai/coachDeleteLogRouting.js',
  'src/ai/tools/coachToolProposalGuards.js': 'src/ai/coachToolProposalGuards.js',
  'src/ai/tools/inferCoachToolCallClient.js': 'src/ai/inferCoachToolCallClient.js',
  'src/ai/tools/normalizeToolParams.js': 'src/ai/normalizeToolParams.js',
  'src/ai/tools/toolExecutor.js': 'src/ai/toolExecutor.js',
  'src/ai/trainer-messaging/trainerMessaging.js': 'src/ai/services/trainerMessaging.js',
  'src/ai/vision/imageService.js': 'src/ai/services/imageService.js',
  'src/aiChat/chat-thread/coachCategoryPrompts.js': 'src/aiChat/lib/coachCategoryPrompts.js',
  'src/aiChat/chat-thread/coachSourcePreview.js': 'src/aiChat/lib/coachSourcePreview.js',
  'src/aiChat/chat-thread/coachAttachmentPickers.js': 'src/aiChat/lib/coachAttachmentPickers.js',
  'src/aiChat/chat-thread/showCoachAttachMenu.js': 'src/aiChat/lib/showCoachAttachMenu.js',
  'src/aiChat/persistence/aiChatPersistence.js': 'src/aiChat/lib/aiChatPersistence.js',
  'src/aiChat/tool-modals/toolModalShared.js': 'src/aiChat/toolModals/toolModalShared.js',
  'src/aiChat/voice/useCoachSpeech.js': 'src/aiChat/hooks/useCoachSpeech.js',
  'src/app/authGateLogic.js': 'src/auth/authGateHelpers.js',
  'src/app/config.js': 'src/app/config.js',
  'src/client/home/clientHomeComponents.jsx': 'src/client/components/home/clientHomeComponents.jsx',
  'src/client/home/clientAppStyles.js': 'src/client/components/home/clientAppStyles.js',
  'src/client/home/useClientHomeBootstrap.js': 'src/client/hooks/useClientHomeBootstrap.js',
  'src/client/home/useClientHomeDailyMetrics.js': 'src/shared/hooks/useClientHomeDailyMetrics.js',
  'src/client/dashboard/MyDashboardScreen.jsx': 'src/client/screens/MyDashboardScreen.jsx',
  'src/client/dashboard/DashboardHeroCard.jsx': 'src/client/components/DashboardHeroCard.jsx',
  'src/client/dashboard/PremiumStatsSection.jsx': 'src/client/components/PremiumStatsSection.jsx',
  'src/client/dashboard/PremiumTrainerCard.jsx': 'src/client/components/PremiumTrainerCard.jsx',
  'src/client/dashboard/ReviewSubmitSheet.js': 'src/shared/components/ReviewSubmitSheet.js',
  'src/client/files/NotesFromTrainerSection.jsx': 'src/client/components/files/NotesFromTrainerSection.jsx',
  'src/client/navigation/clientOverlayScreens.jsx': 'src/client/navigation/clientOverlayScreens.jsx',
  'src/nutrition/barcode/barcodeDisplay.js': 'src/nutrition/utils/barcodeDisplay.js',
  'src/nutrition/daily-log/nutritionService.js': 'src/nutrition/services/nutritionService.js',
  'src/nutrition/food-details/foodBrandDisplay.js': 'src/nutrition/utils/foodBrandDisplay.js',
  'src/nutrition/food-details/nutritionFactsModel.js': 'src/nutrition/utils/nutritionFactsModel.js',
  'src/nutrition/food-details/nutritionNormalization.js': 'src/nutrition/utils/nutritionNormalization.js',
  'src/nutrition/food-details/servingMath.js': 'src/nutrition/utils/servingMath.js',
  'src/nutrition/food-search/FoodConfirmSheet.jsx': 'src/nutrition/components/FoodConfirmSheet.jsx',
  'src/nutrition/food-search/FoodSearchAccuracyHeroCard.jsx': 'src/nutrition/components/FoodSearchAccuracyHeroCard.jsx',
  'src/nutrition/food-search/foodNormalize.js': 'src/nutrition/utils/foodNormalize.js',
  'src/nutrition/food-search/foodSearchQueryMatch.js': 'src/nutrition/services/foodSearchQueryMatch.js',
  'src/nutrition/food-search/foodSearchTitle.js': 'src/nutrition/utils/foodSearchTitle.js',
  'src/nutrition/food-search/restaurantSerperQuality.js': 'src/nutrition/utils/restaurantSerperQuality.js',
  'src/shared/daily-metrics/dailyDashboardDayRollover.js': 'src/shared/daily-metrics/rolloverDayAtMidnight.js',
  'src/shared/daily-metrics/dailyMetricsService.js': 'src/shared/services/dailyMetricsService.js',
  'src/shared/daily-metrics/latestLoggedWeight.js': 'src/shared/daily-metrics/getLatestWeight.js',
  'src/shared/firestore/storage.js': 'src/shared/firestore/storageHelpers.js',
  'src/shared/notes-files/notesAndFilesService.js': 'src/shared/notes-files/manageNotesAndFiles.js',
  'src/shared/notifications/notificationsService.js': 'src/shared/notifications/manageNotifications.js',
  'src/shared/notifications/pushCopy.js': 'src/shared/notifications/pushCopy.js',
  'src/shared/api/apiAuthHeaders.js': 'src/shared/api/getAuthHeaders.js',
  'src/shared/api/logger.js': 'src/shared/api/logErrorToServer.js',
  'src/shared/api/monitoring.js': 'src/shared/api/monitorAppHealth.js',
  'src/shared/api/onboardingSync.js': 'src/shared/api/syncOnboardingToServer.js',
  'src/shared/api/pushNotifyApi.js': 'src/shared/api/sendPushNotification.js',
  'src/shared/marketplace/trainerMarketplaceSync.js': 'src/shared/marketplace/syncTrainerMarketplaceProfile.js',
  'src/shared/workout-profile/profileCardVisibility.js': 'src/shared/workout/profileCardVisibility.js',
  'src/trainer/crm/trainerClientDisplayName.js': 'src/trainer/lib/trainerClientDisplayName.js',
  'src/trainer/clients-list/clientCRMService.js': 'src/trainer/services/clientCRMService.js',
  'src/utils/dataCacheCleanup.js': 'src/utils/dataCacheCleanup.js',
  'src/utils/errorSyncService.js': 'utils/errorSyncService.js',
  'src/workouts/active-workout/workout.js': 'src/workouts/screens/workout.js',
  'src/workouts/plan-generator/workoutGenerationUsage.js': 'src/workouts/screens/workoutGenerationUsage.js',
  'src/workouts/plan-generator/workoutPlanApi.js': 'src/workouts/screens/workoutPlanApi.js',
};

const MOVES = [
  ['src/ai/chat-api/deepseekService.js', 'src/ai/chat-api/aiCoachServerService.js'],
  ['src/ai/chat-api/webSearchRouting.js', 'src/ai/chat-api/detectWebSearchRequest.js'],
  ['src/ai/context/coachPersonalDataRouting.js', 'src/ai/context/gatherCoachContextFromUser.js'],
  ['src/ai/context/coachWeeklyDataClient.js', 'src/ai/context/gatherCoachWeeklyStats.js'],
  ['src/ai/context/contextAggregation.js', 'src/ai/context/CoachContextProvider.js'],
  ['src/ai/macro-recalibration/macroRecalibration.js', 'src/ai/macro-recalibration/recalculateMacrosFromCoach.js'],
  ['src/ai/tools/coachDeleteLogRouting.js', 'src/ai/tools/parseDeleteLogRequest.js'],
  ['src/ai/tools/coachToolProposalGuards.js', 'src/ai/tools/validateCoachToolProposal.js'],
  ['src/ai/tools/inferCoachToolCallClient.js', 'src/ai/tools/parseUserMessageForTools.js'],
  ['src/ai/tools/normalizeToolParams.js', 'src/ai/tools/cleanupToolParams.js'],
  ['src/ai/tools/toolExecutor.js', 'src/ai/tools/executeCoachTool.js'],
  ['src/ai/trainer-messaging/trainerMessaging.js', 'src/ai/trainer-messaging/sendTrainerNotification.js'],
  ['src/ai/vision/imageService.js', 'src/ai/vision/imageStorageService.js'],
  ['src/aiChat/chat-thread/coachCategoryPrompts.js', 'src/aiChat/chat-thread/coachQuickPrompts.js'],
  ['src/aiChat/chat-thread/coachSourcePreview.js', 'src/aiChat/chat-thread/renderSourcePreview.js'],
  ['src/aiChat/chat-thread/coachAttachmentPickers.js', 'src/aiChat/chat-thread/pickAttachmentType.js'],
  ['src/aiChat/chat-thread/showCoachAttachMenu.js', 'src/aiChat/chat-thread/openAttachmentMenu.js'],
  ['src/aiChat/persistence/aiChatPersistence.js', 'src/aiChat/persistence/saveCoachMessagesToFirestore.js'],
  ['src/aiChat/tool-modals/toolModalShared.js', 'src/aiChat/tool-modals/toolModalHelpers.js'],
  ['src/aiChat/voice/useCoachSpeech.js', 'src/aiChat/voice/useVoiceToCoach.js'],
  ['src/nutrition/barcode/barcodeDisplay.js', 'src/nutrition/barcode/renderScannedBarcode.js'],
  ['src/nutrition/daily-log/nutritionService.js', 'src/nutrition/daily-log/logFoodToFirestore.js'],
  ['src/nutrition/food-details/foodBrandDisplay.js', 'src/nutrition/food-details/formatFoodBrand.js'],
  ['src/nutrition/food-details/nutritionFactsModel.js', 'src/nutrition/food-details/parseNutritionLabel.js'],
  ['src/nutrition/food-details/nutritionNormalization.js', 'src/nutrition/food-details/normalizeNutritionData.js'],
  ['src/nutrition/food-details/servingMath.js', 'src/nutrition/food-details/calculateServingSize.js'],
  ['src/nutrition/food-search/FoodConfirmSheet.jsx', 'src/nutrition/food-search/ConfirmFoodSelectionSheet.jsx'],
  ['src/nutrition/food-search/FoodSearchAccuracyHeroCard.jsx', 'src/nutrition/food-search/SearchQualityCard.jsx'],
  ['src/nutrition/food-search/foodNormalize.js', 'src/nutrition/food-search/normalizeFoodQuery.js'],
  ['src/nutrition/food-search/foodSearchQueryMatch.js', 'src/nutrition/food-search/rankFoodSearchResults.js'],
  ['src/nutrition/food-search/foodSearchTitle.js', 'src/nutrition/food-search/formatFoodSearchTitle.js'],
  ['src/nutrition/food-search/restaurantSerperQuality.js', 'src/nutrition/food-search/validateRestaurantResult.js'],
  ['src/shared/daily-metrics/dailyMetricsService.js', 'src/shared/daily-metrics/saveDailyMetricsToFirestore.js'],
  ['src/shared/daily-metrics/dailyDashboardDayRollover.js', 'src/shared/daily-metrics/rolloverDayAtMidnight.js'],
  ['src/shared/daily-metrics/latestLoggedWeight.js', 'src/shared/daily-metrics/getLatestWeight.js'],
  ['src/shared/api/apiAuthHeaders.js', 'src/shared/api/getAuthHeaders.js'],
  ['src/shared/api/logger.js', 'src/shared/api/logErrorToServer.js'],
  ['src/shared/api/monitoring.js', 'src/shared/api/monitorAppHealth.js'],
  ['src/shared/api/onboardingSync.js', 'src/shared/api/syncOnboardingToServer.js'],
  ['src/shared/api/pushNotifyApi.js', 'src/shared/api/sendPushNotification.js'],
  ['src/shared/notes-files/notesAndFilesService.js', 'src/shared/notes-files/manageNotesAndFiles.js'],
  ['src/shared/notifications/notificationsService.js', 'src/shared/notifications/manageNotifications.js'],
  ['src/shared/notifications/pushCopy.js', 'src/shared/notifications/pushNotificationText.js'],
  ['src/shared/firestore/storage.js', 'src/shared/firestore/storageHelpers.js'],
  ['src/shared/utils/localDay.js', 'src/shared/utils/getLocalDay.js'],
  ['src/shared/utils/fileFormatting.js', 'src/shared/utils/formatFileSize.js'],
  ['src/shared/utils/heightFeetInches.js', 'src/shared/utils/convertHeightUnits.js'],
  ['src/shared/utils/notesFileView.js', 'src/shared/utils/getFileViewType.js'],
  ['src/shared/utils/trainerProfileMedia.js', 'src/shared/utils/getTrainerProfileMedia.js'],
  ['src/shared/workout-profile/profileCardVisibility.js', 'src/shared/workout-profile/shouldShowProfileCard.js'],
  ['src/trainer/crm/trainerClientDisplayName.js', 'src/trainer/crm/formatClientName.js'],
  ['src/trainer/clients-list/clientCRMService.js', 'src/trainer/clients-list/loadTrainerClientRoster.js'],
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
