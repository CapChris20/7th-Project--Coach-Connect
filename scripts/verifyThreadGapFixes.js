#!/usr/bin/env node
/**
 * Static regression checks for June thread gap fixes (spreadsheet, vision, workout gen, etc.).
 * Does NOT run web-search routing tests — use test:coach-web-search for that separately.
 *
 * Run: node scripts/verifyThreadGapFixes.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

let passed = 0;
let failed = 0;

function pass(name, detail = '') {
  passed += 1;
  console.log(`✅ PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  failed += 1;
  console.log(`❌ FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

function assert(name, cond, detail = '') {
  if (cond) pass(name, detail);
  else fail(name, detail);
}

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function fileExists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

console.log('Thread gap-fix static verification\n');

// ─── 1. workoutRoutes serverTs (not serverTs()) ─────────────────────────────
(function testWorkoutRoutesServerTs() {
  const src = read('server/routes/workoutRoutes.js');
  assert(
    'workoutRoutes passes serverTs function to recordSuccessfulWorkoutGeneration',
    /recordSuccessfulWorkoutGeneration\(\s*db,\s*targetUid,\s*serverTs\s*\)/.test(src),
    'must pass serverTs, not serverTs()',
  );
  assert(
    'workoutRoutes does not pass serverTs() to recordSuccessfulWorkoutGeneration',
    !/recordSuccessfulWorkoutGeneration\(\s*db,\s*targetUid,\s*serverTs\(\)\s*\)/.test(src),
  );
})();

// ─── 2. coachVision honest grounding + Replicate polling ────────────────────
(function testCoachVisionGrounding() {
  const src = read('server/lib/coachVision.js');
  assert('coachVision has pollReplicatePrediction', src.includes('async function pollReplicatePrediction'));
  assert('coachVision calls pollReplicatePrediction', src.includes('await pollReplicatePrediction'));
  assert('coachVision prompt uses "What I can see"', /What I can see/i.test(src));
  assert(
    'coachVision removed bluffing "Never say you cannot see"',
    !/Never say you cannot see/i.test(src),
  );
  assert(
    'coachVision JPEG/PNG resend guidance',
    /JPEG|PNG|resend/i.test(src),
  );

  const vision = require(path.join(ROOT, 'server/lib/coachVision.js'));
  assert('coachVision exports isCoachVisionConfigured', typeof vision.isCoachVisionConfigured === 'function');
  assert('coachVision exports sanitizeCoachImageAttachments', typeof vision.sanitizeCoachImageAttachments === 'function');
})();

// ─── 3. Firestore rules — trainer update/delete shared stubs ─────────────────
(function testFirestoreNotesAndFilesRules() {
  const rules = read('firestore.rules');
  const block = rules.slice(rules.indexOf('match /users/{userId}/notes_and_files/{itemId}'));
  assert('notes_and_files rules block exists', block.length > 200);
  assert(
    'notes_and_files allows trainer update/delete on trainer-added items',
    /allow update, delete:[\s\S]*resource\.data\.addedBy == 'trainer'/.test(block),
  );
})();

// ─── 4. Workout plan generation session + UI wiring ─────────────────────────
(function testWorkoutPlanGenerationSessionWiring() {
  assert(
    'workoutPlanGenerationSession module exists',
    fileExists('src/workouts/plan-generator/workoutPlanGenerationSession.js'),
  );
  const session = read('src/workouts/plan-generator/workoutPlanGenerationSession.js');
  assert('session exports markWorkoutGenerationStarted', session.includes('export async function markWorkoutGenerationStarted'));
  assert('session exports markWorkoutGenerationSucceeded', session.includes('export async function markWorkoutGenerationSucceeded'));
  assert('session exports subscribeWorkoutGenerationSession', session.includes('export function subscribeWorkoutGenerationSession'));
  assert('session supports userAwayFromWorkout', session.includes('userAwayFromWorkout'));

  const workout = read('src/workouts/active-workout/workout.js');
  assert('workout.js imports session helpers', workout.includes('workoutPlanGenerationSession'));
  assert('workout.js tracks planReadyPending', workout.includes('planReadyPending'));
  assert('workout.js has handleOpenReadyPlan', workout.includes('handleOpenReadyPlan'));

  const main = read('src/client/navigation/ClientMainScreen.jsx');
  assert('ClientMainScreen subscribes to session', main.includes('subscribeWorkoutGenerationSession'));
  assert('ClientMainScreen passes workoutTabBadge', main.includes('workoutTabBadge={workoutPlanReadyBadge}'));

  const nav = read('src/navigation/BottomNavBar.js');
  assert('BottomNavBar accepts workoutTabBadge prop', nav.includes('workoutTabBadge'));
  assert('BottomNavBar renders tab badge dot', nav.includes('tabBadgeDot'));
})();

// ─── 5. Vision client timeout 120s ──────────────────────────────────────────
(function testVisionClientTimeout() {
  const src = read('src/ai/chat-api/aiCoachServerService.js');
  assert('aiCoachServerService TIMEOUT_MS_VISION is 120000', /TIMEOUT_MS_VISION\s*=\s*120000/.test(src));
  assert(
    'vision timeout used when attachments present',
    /hasImages\s*\?\s*TIMEOUT_MS_VISION/.test(src),
  );
})();

// ─── 6. Quick Add redesign (no sparkles) ────────────────────────────────────
(function testQuickAddRedesign() {
  const src = read('src/nutrition/quick-add/QuickAddNutrition.jsx');
  assert('QuickAdd uses LinearGradient accent', src.includes('LinearGradient'));
  assert('QuickAdd removed sparkles icon', !/sparkle/i.test(src));
})();

// ─── 7. trainerLocationService lazy-load ─────────────────────────────────────
(function testTrainerLocationLazyLoad() {
  assert(
    'trainerLocationService exists',
    fileExists('src/shared/trainer-location/trainerLocationService.js'),
  );
  const src = read('src/shared/trainer-location/trainerLocationService.js');
  assert('lazy dynamic import of expo-location', /await import\(['"]expo-location['"]\)/.test(src));
  assert('exports ensureLocationPermission', src.includes('export async function ensureLocationPermission'));
  assert('exports resolveCurrentTrainerLocation', src.includes('export async function resolveCurrentTrainerLocation'));
  assert('no top-level expo-location import', !/^import\s+.*expo-location/m.test(src));
})();

// ─── Thread context: other shipped items (not gap fixes, still verified) ────
(function testRelatedThreadShipments() {
  const docker = read('Dockerfile');
  assert('Dockerfile copies food-search path', docker.includes('src/nutrition/food-search/'));
  assert('Dockerfile copies food-details path', docker.includes('src/nutrition/food-details/'));
  assert('Dockerfile does not copy stale services path', !docker.includes('src/nutrition/services/'));

  assert('PlanViewerScreen exists', fileExists('src/client/screens/PlanViewerScreen.jsx'));
  const planViewer = read('src/client/screens/PlanViewerScreen.jsx');
  assert('PlanViewer uses gradient UI', planViewer.includes('LinearGradient'));

  const notes = read('src/shared/notes-files/manageNotesAndFiles.js');
  assert('notes service syncs sharedWith stubs', notes.includes('sharedWith') && notes.includes('notes_and_files'));

  const web = read('server/lib/coachWebSearch.js');
  assert('web search honesty when no results', web.includes('You do NOT have live web search results'));
})();

console.log('\n────────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFix failing checks, then redeploy as needed:');
  console.log('  firebase deploy --only firestore:rules');
  console.log('  ./server/deploy.sh');
  process.exit(1);
}
console.log('All thread gap-fix static checks passed.');
