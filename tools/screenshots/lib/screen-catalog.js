// Every reachable screen/overlay to capture, plus orphans recorded as skipped.
// Nested nutrition / payout / library screens from the inventory follow-up are included.

const SCREENS = [
  // Auth (signed out)
  { screen: 'login-welcome', role: 'both', stateModes: ['empty'], route: null, captureMethod: 'playwright-web', nativeOnly: false, group: 'auth' },
  { screen: 'login-form', role: 'both', stateModes: ['empty', 'error'], route: null, captureMethod: 'playwright-web', nativeOnly: false, group: 'auth' },
  { screen: 'signup-form', role: 'both', stateModes: ['empty'], route: null, captureMethod: 'playwright-web', nativeOnly: false, group: 'auth' },
  { screen: 'forgot-password', role: 'both', stateModes: ['empty', 'error', 'loading'], route: null, captureMethod: 'playwright-web', nativeOnly: false, group: 'auth' },

  // Client onboarding
  ...Array.from({ length: 9 }, (_, i) => ({
    screen: `client-onboarding-${String(i + 1).padStart(2, '0')}`,
    role: 'client',
    stateModes: ['empty'],
    route: 'NewUserSetup',
    captureMethod: 'playwright-web',
    nativeOnly: i === 0 ? false : false,
    group: 'onboarding',
    step: i + 1,
  })),

  // Trainer onboarding (step 6 face camera = native)
  ...Array.from({ length: 8 }, (_, i) => ({
    screen: `trainer-onboarding-${String(i + 1).padStart(2, '0')}`,
    role: 'trainer',
    stateModes: ['empty'],
    route: 'NewUserSetup',
    captureMethod: i === 5 ? 'maestro' : 'playwright-web',
    nativeOnly: i === 5,
    group: 'onboarding',
    step: i + 1,
  })),

  // Client shell
  { screen: 'client-home', role: 'client', stateModes: ['empty', 'with-food', 'loading'], route: 'ClientMainTabs', captureMethod: 'playwright-web', nativeOnly: false, nav: { tab: 'home' } },
  { screen: 'client-dashboard', role: 'client', stateModes: ['empty', 'with-food', 'loading'], route: 'ClientDashboard', captureMethod: 'playwright-web', nativeOnly: false, nav: { overlay: 'dashboard' } },
  { screen: 'client-files', role: 'client', stateModes: ['empty', 'with-food'], route: 'ClientFiles', captureMethod: 'playwright-web', nativeOnly: false, nav: { overlay: 'files' } },
  { screen: 'client-inbox', role: 'client', stateModes: ['empty', 'with-food'], route: null, captureMethod: 'playwright-web', nativeOnly: false, nav: { overlay: 'inbox' } },
  { screen: 'client-chat', role: 'client', stateModes: ['empty', 'with-food'], route: null, captureMethod: 'playwright-web', nativeOnly: false, nav: { overlay: 'chat' } },
  { screen: 'client-nutrition', role: 'client', stateModes: ['empty', 'with-food', 'loading'], route: 'ClientNutrition', captureMethod: 'playwright-web', nativeOnly: false, nav: { tab: 'nutrition' } },
  { screen: 'client-food-search', role: 'client', stateModes: ['empty', 'with-food'], route: null, captureMethod: 'playwright-web', nativeOnly: false, nav: { from: 'nutrition', action: 'food-search' } },
  { screen: 'client-confirm-food', role: 'client', stateModes: ['with-food'], route: null, captureMethod: 'playwright-web', nativeOnly: false, nav: { from: 'nutrition', action: 'confirm-food' } },
  { screen: 'client-nutrition-facts', role: 'client', stateModes: ['empty', 'with-food'], route: null, captureMethod: 'playwright-web', nativeOnly: false, nav: { from: 'nutrition', action: 'daily-facts' } },
  { screen: 'client-nutrition-goals', role: 'client', stateModes: ['empty', 'with-food'], route: null, captureMethod: 'playwright-web', nativeOnly: false, nav: { from: 'nutrition', action: 'goals' } },
  { screen: 'client-nutrition-setup', role: 'client', stateModes: ['empty'], route: null, captureMethod: 'playwright-web', nativeOnly: false, nav: { from: 'nutrition', action: 'setup' } },
  { screen: 'client-quick-add', role: 'client', stateModes: ['empty'], route: null, captureMethod: 'playwright-web', nativeOnly: false, nav: { from: 'nutrition', action: 'quick-add' } },
  { screen: 'client-edit-serving', role: 'client', stateModes: ['with-food'], route: null, captureMethod: 'playwright-web', nativeOnly: false, nav: { from: 'nutrition', action: 'edit-serving' } },
  { screen: 'client-barcode-scanner', role: 'client', stateModes: ['empty'], route: null, captureMethod: 'maestro', nativeOnly: true, nav: { from: 'nutrition', action: 'barcode' } },
  { screen: 'client-workout', role: 'client', stateModes: ['empty', 'with-food', 'loading'], route: 'ClientWorkoutPlan', captureMethod: 'playwright-web', nativeOnly: false, nav: { tab: 'workout' } },
  { screen: 'client-exercise-library', role: 'client', stateModes: ['empty', 'with-food'], route: null, captureMethod: 'playwright-web', nativeOnly: false, nav: { from: 'workout', action: 'library' } },
  { screen: 'client-video-player', role: 'client', stateModes: ['with-food'], route: null, captureMethod: 'playwright-web', nativeOnly: false, nav: { from: 'workout', action: 'video' } },
  { screen: 'client-ai', role: 'client', stateModes: ['empty', 'with-food', 'loading'], route: 'ClientAI', captureMethod: 'playwright-web', nativeOnly: false, nav: { tab: 'ai' } },
  { screen: 'client-ai-chat', role: 'client', stateModes: ['empty', 'with-food', 'error'], route: 'ClientAIChat', captureMethod: 'playwright-web', nativeOnly: false, nav: { from: 'ai', action: 'chat' } },
  { screen: 'client-profile', role: 'client', stateModes: ['empty', 'with-food'], route: 'ClientProfile', captureMethod: 'playwright-web', nativeOnly: false, nav: { stack: 'ClientProfile' } },
  { screen: 'client-settings', role: 'client', stateModes: ['empty', 'with-food'], route: 'ClientSettings', captureMethod: 'playwright-web', nativeOnly: false, nav: { stack: 'ClientSettings' } },
  { screen: 'client-blocked-users', role: 'client', stateModes: ['empty', 'with-food'], route: null, captureMethod: 'playwright-web', nativeOnly: false, nav: { from: 'settings', action: 'blocked-users' } },
  { screen: 'client-help-faq', role: 'client', stateModes: ['empty'], route: 'ClientHelpFAQ', captureMethod: 'playwright-web', nativeOnly: false, nav: { stack: 'ClientHelpFAQ' } },
  { screen: 'client-terms', role: 'client', stateModes: ['empty'], route: 'ClientTerms', captureMethod: 'playwright-web', nativeOnly: false, nav: { stack: 'ClientTerms' } },
  { screen: 'client-privacy', role: 'client', stateModes: ['empty'], route: 'ClientPrivacy', captureMethod: 'playwright-web', nativeOnly: false, nav: { stack: 'ClientPrivacy' } },
  { screen: 'client-contact-support', role: 'client', stateModes: ['empty'], route: 'ClientContactSupport', captureMethod: 'playwright-web', nativeOnly: false, nav: { stack: 'ClientContactSupport' } },
  { screen: 'client-bug-report', role: 'client', stateModes: ['empty'], route: 'ClientBugReport', captureMethod: 'playwright-web', nativeOnly: false, nav: { stack: 'ClientBugReport' } },
  { screen: 'client-trainer-search', role: 'client', stateModes: ['empty', 'with-food', 'loading'], route: 'ClientTrainerSearch', captureMethod: 'playwright-web', nativeOnly: false, nav: { stack: 'ClientTrainerSearch' } },
  { screen: 'client-trainer-profile', role: 'client', stateModes: ['with-food'], route: 'ClientTrainerProfile', captureMethod: 'playwright-web', nativeOnly: false, nav: { stack: 'ClientTrainerProfile' } },
  { screen: 'client-weekly-report', role: 'client', stateModes: ['empty', 'with-food'], route: 'ClientWeeklyReport', captureMethod: 'playwright-web', nativeOnly: false, nav: { stack: 'ClientWeeklyReport' } },
  { screen: 'client-photo-gallery', role: 'client', stateModes: ['empty', 'with-food'], route: 'ClientPhotoGallery', captureMethod: 'playwright-web', nativeOnly: false, nav: { stack: 'ClientPhotoGallery' } },
  { screen: 'client-ai-workouts', role: 'client', stateModes: ['empty', 'with-food'], route: 'ClientAIWorkouts', captureMethod: 'playwright-web', nativeOnly: false, nav: { stack: 'ClientAIWorkouts' } },
  { screen: 'client-plan-viewer', role: 'client', stateModes: ['with-food'], route: 'ClientPlanViewer', captureMethod: 'playwright-web', nativeOnly: false, nav: { stack: 'ClientPlanViewer' } },
  { screen: 'client-pay-trainer', role: 'client', stateModes: ['with-food'], route: null, captureMethod: 'maestro', nativeOnly: true, nav: { action: 'pay-trainer' } },
  { screen: 'client-add-file', role: 'client', stateModes: ['empty'], route: null, captureMethod: 'maestro', nativeOnly: true, nav: { action: 'add-file' } },
  { screen: 'client-trainer-shared-files', role: 'client', stateModes: ['with-food'], route: null, captureMethod: 'playwright-web', nativeOnly: false, nav: { action: 'trainer-shared-files' } },
  { screen: 'client-ai-coach-tests', role: 'client', stateModes: ['empty'], route: 'ClientAICoachTests', captureMethod: 'playwright-web', nativeOnly: false, skip: true, skipReason: 'dev-only' },

  // Trainer shell
  { screen: 'trainer-home', role: 'trainer', stateModes: ['empty', 'with-food', 'loading'], route: 'TrainerMain', captureMethod: 'playwright-web', nativeOnly: false, nav: { hub: 'home' } },
  { screen: 'trainer-progress', role: 'trainer', stateModes: ['empty', 'with-food'], route: null, captureMethod: 'playwright-web', nativeOnly: false, nav: { tab: 'Progress' } },
  { screen: 'trainer-nutrition-tab', role: 'trainer', stateModes: ['empty', 'with-food'], route: null, captureMethod: 'playwright-web', nativeOnly: false, nav: { tab: 'Nutrition' } },
  { screen: 'trainer-sessions', role: 'trainer', stateModes: ['empty', 'with-food'], route: null, captureMethod: 'playwright-web', nativeOnly: false, nav: { tab: 'Sessions' } },
  { screen: 'trainer-schedule-session', role: 'trainer', stateModes: ['empty', 'with-food'], route: null, captureMethod: 'playwright-web', nativeOnly: false, nav: { from: 'sessions', action: 'schedule' } },
  { screen: 'trainer-notes-files', role: 'trainer', stateModes: ['empty', 'with-food'], route: null, captureMethod: 'playwright-web', nativeOnly: false, nav: { tab: 'Notes & Files' } },
  { screen: 'trainer-inbox', role: 'trainer', stateModes: ['empty', 'with-food'], route: null, captureMethod: 'playwright-web', nativeOnly: false, nav: { overlay: 'inbox' } },
  { screen: 'trainer-chat', role: 'trainer', stateModes: ['empty', 'with-food'], route: null, captureMethod: 'playwright-web', nativeOnly: false, nav: { overlay: 'chat' } },
  { screen: 'trainer-requests', role: 'trainer', stateModes: ['empty', 'with-food'], route: null, captureMethod: 'playwright-web', nativeOnly: false, nav: { overlay: 'requests' } },
  { screen: 'trainer-clients', role: 'trainer', stateModes: ['empty', 'with-food'], route: null, captureMethod: 'playwright-web', nativeOnly: false, nav: { overlay: 'clients' } },
  { screen: 'trainer-photo-gallery', role: 'trainer', stateModes: ['empty', 'with-food'], route: 'TrainerPhotoGallery', captureMethod: 'playwright-web', nativeOnly: false, nav: { overlay: 'photos' } },
  { screen: 'trainer-ai-workouts', role: 'trainer', stateModes: ['empty', 'with-food'], route: 'TrainerAIWorkouts', captureMethod: 'playwright-web', nativeOnly: false, nav: { overlay: 'ai-workouts' } },
  { screen: 'trainer-workout-generator', role: 'trainer', stateModes: ['empty', 'with-food'], route: 'TrainerWorkoutGenerator', captureMethod: 'playwright-web', nativeOnly: false, nav: { overlay: 'generator' } },
  { screen: 'trainer-plan-viewer', role: 'trainer', stateModes: ['with-food'], route: 'TrainerPlanViewer', captureMethod: 'playwright-web', nativeOnly: false, nav: { overlay: 'plan-viewer' } },
  { screen: 'trainer-document-editor', role: 'trainer', stateModes: ['with-food'], route: null, captureMethod: 'playwright-web', nativeOnly: false, nav: { action: 'document-editor' } },
  { screen: 'trainer-spreadsheet-editor', role: 'trainer', stateModes: ['with-food'], route: null, captureMethod: 'playwright-web', nativeOnly: false, nav: { action: 'spreadsheet-editor' } },
  { screen: 'trainer-profile', role: 'trainer', stateModes: ['empty', 'with-food'], route: 'TrainerProfile', captureMethod: 'playwright-web', nativeOnly: false, nav: { stack: 'TrainerProfile' } },
  { screen: 'trainer-settings', role: 'trainer', stateModes: ['empty', 'with-food'], route: 'TrainerSettings', captureMethod: 'playwright-web', nativeOnly: false, nav: { stack: 'TrainerSettings' } },
  { screen: 'trainer-help-faq', role: 'trainer', stateModes: ['empty'], route: 'TrainerHelpFAQ', captureMethod: 'playwright-web', nativeOnly: false, nav: { stack: 'TrainerHelpFAQ' } },
  { screen: 'trainer-terms', role: 'trainer', stateModes: ['empty'], route: 'TrainerTerms', captureMethod: 'playwright-web', nativeOnly: false, nav: { stack: 'TrainerTerms' } },
  { screen: 'trainer-privacy', role: 'trainer', stateModes: ['empty'], route: 'TrainerPrivacy', captureMethod: 'playwright-web', nativeOnly: false, nav: { stack: 'TrainerPrivacy' } },
  { screen: 'trainer-contact-support', role: 'trainer', stateModes: ['empty'], route: 'TrainerContactSupport', captureMethod: 'playwright-web', nativeOnly: false, nav: { stack: 'TrainerContactSupport' } },
  { screen: 'trainer-bug-report', role: 'trainer', stateModes: ['empty'], route: 'TrainerBugReport', captureMethod: 'playwright-web', nativeOnly: false, nav: { stack: 'TrainerBugReport' } },
  { screen: 'trainer-nutrition', role: 'trainer', stateModes: ['empty', 'with-food'], route: 'TrainerNutrition', captureMethod: 'playwright-web', nativeOnly: false, nav: { stack: 'TrainerNutrition' } },
  { screen: 'trainer-voice-ai', role: 'trainer', stateModes: ['empty', 'with-food'], route: 'TrainerVoiceAI', captureMethod: 'playwright-web', nativeOnly: false, nav: { stack: 'TrainerVoiceAI' } },
  { screen: 'trainer-ai-chat', role: 'trainer', stateModes: ['empty', 'with-food'], route: 'TrainerAIChat', captureMethod: 'playwright-web', nativeOnly: false, nav: { stack: 'TrainerAIChat' } },
  { screen: 'trainer-search', role: 'trainer', stateModes: ['empty', 'with-food'], route: 'TrainerSearch', captureMethod: 'playwright-web', nativeOnly: false, nav: { stack: 'TrainerSearch' } },
  { screen: 'trainer-weekly-report', role: 'trainer', stateModes: ['empty', 'with-food'], route: 'TrainerWeeklyReport', captureMethod: 'playwright-web', nativeOnly: false, nav: { stack: 'TrainerWeeklyReport' } },
  { screen: 'trainer-workout-plan', role: 'trainer', stateModes: ['empty', 'with-food'], route: 'TrainerWorkoutPlan', captureMethod: 'playwright-web', nativeOnly: false, nav: { stack: 'TrainerWorkoutPlan' } },
  { screen: 'trainer-manual-plan-builder', role: 'trainer', stateModes: ['empty', 'with-food'], route: 'TrainerManualPlanBuilder', captureMethod: 'playwright-web', nativeOnly: false, nav: { stack: 'TrainerManualPlanBuilder' } },
  { screen: 'trainer-payments', role: 'trainer', stateModes: ['empty', 'with-food', 'error'], route: 'TrainerPayments', captureMethod: 'playwright-web', nativeOnly: false, nav: { stack: 'TrainerPayments' } },
  { screen: 'trainer-payout-setup', role: 'trainer', stateModes: ['empty'], route: null, captureMethod: 'playwright-web', nativeOnly: false, nav: { action: 'payout-setup' } },
  { screen: 'trainer-payout-reminder', role: 'trainer', stateModes: ['empty'], route: null, captureMethod: 'playwright-web', nativeOnly: false, nav: { action: 'payout-reminder' } },
  { screen: 'trainer-pro-expired', role: 'trainer', stateModes: ['empty'], route: null, captureMethod: 'maestro', nativeOnly: true, nav: { action: 'pro-expired' } },
  { screen: 'trainer-free-trial-banner', role: 'trainer', stateModes: ['with-food'], route: null, captureMethod: 'maestro', nativeOnly: true, nav: { action: 'free-trial' } },
  { screen: 'trainer-add-file', role: 'trainer', stateModes: ['empty'], route: null, captureMethod: 'maestro', nativeOnly: true, nav: { action: 'add-file' } },
];

const SKIPPED_ORPHANS = [
  { screen: 'pro-upgrade-screen', role: 'trainer', reason: 'not-mounted' },
  { screen: 'book-session-screen', role: 'trainer', reason: 'not-mounted' },
  { screen: 'manage-trainee-screen', role: 'trainer', reason: 'not-mounted' },
  { screen: 'log-todays-meals-screen', role: 'client', reason: 'not-mounted' },
  { screen: 'files-screen-legacy', role: 'client', reason: 'not-mounted' },
  { screen: 'setup-preview-screen', role: 'both', reason: 'not-mounted' },
  { screen: 'generate-my-workout-plan-screen', role: 'both', reason: 'not-mounted' },
  { screen: 'food-list-screen', role: 'both', reason: 'not-mounted' },
  { screen: 'app-loading-screen', role: 'both', reason: 'not-mounted' },
  { screen: 'plan-pdf-viewer', role: 'both', reason: 'not-mounted' },
];

function expandCatalogEntries() {
  const entries = [];
  for (const item of SCREENS) {
    if (item.skip) {
      entries.push({
        screen: item.screen,
        role: item.role,
        state: 'empty',
        route: item.route || null,
        file: null,
        status: 'skipped',
        reason: item.skipReason || 'skipped',
        nativeOnly: !!item.nativeOnly,
        captureMethod: item.captureMethod,
        attempts: 0,
      });
      continue;
    }
    for (const state of item.stateModes) {
      const roleFolder = item.role === 'both' ? 'both' : item.role;
      entries.push({
        screen: item.screen,
        role: item.role,
        state,
        route: item.route || null,
        file: `src/screenshots/${state}/${roleFolder}/${item.screen}.png`,
        status: 'pending',
        reason: null,
        nativeOnly: !!item.nativeOnly,
        captureMethod: item.captureMethod,
        attempts: 0,
        nav: item.nav || null,
        group: item.group || null,
        step: item.step || null,
      });
    }
  }
  for (const orphan of SKIPPED_ORPHANS) {
    entries.push({
      screen: orphan.screen,
      role: orphan.role,
      state: 'empty',
      route: null,
      file: null,
      status: 'skipped',
      reason: orphan.reason,
      nativeOnly: false,
      captureMethod: null,
      attempts: 0,
    });
  }
  return entries;
}

module.exports = { SCREENS, SKIPPED_ORPHANS, expandCatalogEntries };
