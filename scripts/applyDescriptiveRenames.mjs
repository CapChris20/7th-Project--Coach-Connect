#!/usr/bin/env node
/**
 * Bulk-update import paths after descriptive folder renames.
 * Run from repo root: node scripts/applyDescriptiveRenames.mjs
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');

const REPLACEMENTS = [
  // settings — flatten screens/
  ['settings/screens/', 'settings/'],

  // shared — canonical feature paths (drop screens/ shims)
  ['shared/screens/BrowseSavedWorkoutsScreen', 'shared/workout-plans/BrowseSavedWorkoutsScreen'],
  ['shared/screens/MyProgressPhotosScreen', 'shared/photo-gallery/MyProgressPhotosScreen'],
  ['shared/screens/ViewWeekProgressReportScreen', 'shared/weekly-report/ViewWeekProgressReportScreen'],

  // shared/services → user-profile
  ['shared/services/fetchUserProfile', 'shared/user-profile/fetchUserProfile'],

  // shared/components → shared-ui descriptive subfolders
  ['shared/components/shell/', 'shared-ui/app-shell/'],
  ['shared/components/home/', 'shared-ui/home-cards/'],
  ['shared/components/icons/', 'shared-ui/brand-icons/'],
  ['shared/components/modals/', 'shared-ui/modals/'],
  ['shared/components/notes-files/', 'shared-ui/notes-files-viewers/'],
  ['shared/components/onboarding/', 'shared-ui/onboarding-steps/'],
  ['shared/components/FilesNotesHeroCard', 'shared-ui/FilesNotesHeroCard'],
  ['shared/components/MarketplaceHeroCard', 'shared-ui/MarketplaceHeroCard'],

  // session date helpers
  ['lib/sessions', 'shared-utils/session-dates'],

  // trainer-app sessions colocation
  ['trainer-app/components/WheelPicker', 'trainer-app/sessions/WheelPicker'],
  ['trainer-app/components/sessions/', 'trainer-app/sessions/'],
  ['trainer-app/hooks/useMyTrainingSessions', 'trainer-app/sessions/useMyTrainingSessions'],

  // ai-coach chat-ui
  ['ai-coach/chat-ui/screens/StartCoachChatScreen', 'ai-coach/chat-ui/chat-home/StartCoachChatScreen'],
  ['ai-coach/chat-ui/components/', 'ai-coach/chat-ui/reply-ui/'],
  ['ai-coach/chat-ui/lib/', 'ai-coach/chat-ui/chat-formatting/'],
  ['ai-coach/server-logic/services/markAllMessagesRead', 'ai-coach/server-logic/trainer-messaging/markAllMessagesRead'],

  // nutrition
  ['nutrition/components/premiumFoodCard/', 'nutrition/food-card/'],
  ['nutrition/components/GradientFieldFrame', 'nutrition/food-card/GradientFieldFrame'],
  ['nutrition/utils/casualMenuSearch', 'nutrition/food-search/casualMenuSearch'],

  // workouts
  ['workouts/components/ExerciseSection', 'workouts/exercise-library/ExerciseSection'],

  // auth
  ['auth/services/requestPasswordReset', 'auth/password-reset/requestPasswordReset'],
  ['auth/services/sendPasswordResetEmail', 'auth/password-reset/sendPasswordResetEmail'],
];

const SCAN_DIRS = ['src', 'scripts', 'server'];
const EXT = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx']);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.git') continue;
      walk(p, out);
    } else if (EXT.has(path.extname(name))) {
      out.push(p);
    }
  }
  return out;
}

let changed = 0;
for (const dir of SCAN_DIRS) {
  for (const file of walk(path.join(ROOT, dir))) {
    let text = fs.readFileSync(file, 'utf8');
    let next = text;
    for (const [from, to] of REPLACEMENTS) {
      next = next.split(from).join(to);
    }
    if (next !== text) {
      fs.writeFileSync(file, next);
      changed++;
      console.log('updated:', path.relative(ROOT, file));
    }
  }
}
console.log(`\nDone — ${changed} files updated.`);
