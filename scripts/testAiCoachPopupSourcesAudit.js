// Popup + sources audit (Oct 2026 debug pass):
//  A. Every coach tool's confirm popup must SHOW the fields that tool will
//     actually save (a popup confirming unseen numbers is how the mood bug
//     shipped: "Log mood" with no mood on it).
//  B. The guard must reject proposals whose essential field is missing, so
//     no popup can open with nothing real to confirm.
//  C. Web sources must survive save → restore (they used to vanish when a
//     past chat was reopened), dedupe, and never render a broken favicon.
// Offline/static + guard logic. Run: node scripts/testAiCoachPopupSourcesAudit.js

const fs = require('fs');
const path = require('path');
const { guardCoachToolProposal } = require('../src/ai-coach/coach-actions/shouldAskFirst');

let passed = 0;
let failed = 0;
function check(label, ok) {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`${ok ? '✅' : '❌'} ${label}`);
}
const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const popup = (name) => read(`src/ai-coach/confirm-popups/${name}`);

// ── A. Popups show what will be saved ───────────────────────────────────────
check('LogMood shows emoji mood', popup('LogMoodPopup.jsx').includes('MOOD_DISPLAY') && popup('LogMoodPopup.jsx').includes('😊'));
check('LogMeal shows carbs + fat + kcal unit', ['CARBS_ROW_LABEL', 'FAT_ROW_LABEL', 'kcal'].every((s) => popup('LogMealPopup.jsx').includes(s)));
check('LogWater shows a Date row', popup('LogWaterPopup.jsx').includes('logDateLabel'));
check('LogSteps shows a Date row', popup('LogStepsPopup.jsx').includes('logDateLabel'));
check('LogSleep shows hours + date', popup('LogSleepPopup.jsx').includes('SLEEP_ROW_LABEL') && popup('LogSleepPopup.jsx').includes('DATE_ROW_LABEL'));
check('BookSession shows combined dateTime ("When") when split fields missing',
  popup('BookSessionPopup.jsx').includes('combinedWhen') && popup('BookSessionPopup.jsx').includes('label="When"'));
check('EditWorkout shows swap position (Day · Exercise)',
  popup('EditWorkoutPopup.jsx').includes('readSwapPosition') && popup('EditWorkoutPopup.jsx').includes('label="Position"'));
check('ConfirmDelete shows type + date', popup('ConfirmDeletePopup.jsx').includes('label="Type"') && popup('ConfirmDeletePopup.jsx').includes('label="Date"'));
check('ChangeFoodTargets shows all four targets',
  ['Daily calories', 'Protein', 'Carbs', 'Fat'].every((s) => popup('ChangeFoodTargetsPopup.jsx').includes(s)));
check('MessageTrainer shows message', popup('MessageTrainerPopup.jsx').includes('MESSAGE_ROW_LABEL'));
check('UpdateGoal shows new goal', popup('UpdateGoalPopup.jsx').includes('GOAL_ROW_LABEL'));
check('RateEnergy shows rating', popup('RateEnergyPopup.jsx').includes('ENERGY_ROW_LABEL'));
check('RateWorkout shows rating', popup('RateWorkoutPopup.jsx').includes('RATING_ROW_LABEL'));
check('shared date helper exists (Today default)', read('src/ai-coach/confirm-popups/sharedPopupParts.js').includes('logDateLabel'));

// ── B. Guard rejects proposals with nothing to confirm ──────────────────────
const emptyProposals = [
  ['logMood', {}], ['logSleep', {}], ['logWater', {}], ['logSteps', {}],
  ['rateEnergy', {}], ['rateWorkout', {}], ['logNutrition', {}],
  ['updateGoal', {}], ['notifyTrainer', {}], ['bookSession', {}],
  ['updateWorkout', {}], ['adjustMacroTargets', {}],
];
for (const [name, params] of emptyProposals) {
  check(`guard drops empty ${name}`, guardCoachToolProposal({ name, params }) === null);
}
check('guard keeps valid logMood', guardCoachToolProposal({ name: 'logMood', params: { mood: 'happy' } })?.params?.mood === 'happy');
check('guard keeps bookSession dateTime phrase', guardCoachToolProposal({ name: 'bookSession', params: { dateTime: 'next Tuesday at 10am' } }) !== null);

// ── C. Sources survive and render cleanly ───────────────────────────────────
const persistence = read('src/ai-coach/past-chats/saveAndLoadChats.js');
check('source snippet is serialized', persistence.includes('snippet: source?.snippet'));
check('restore returns searchedWeb', persistence.includes('searchedWeb: savedMessage.searchedWeb === true'));
check('restore returns webSources', persistence.includes('webSources: Array.isArray(savedMessage.webSources)'));
check('restore returns route (web formatting survives)', persistence.includes('route: savedMessage.route || null'));

const sources = read('src/ai-coach/conversation/SourceLinkCards.jsx');
check('sources dedupe by normalized URL', sources.includes('normalizedSourceKey'));
check('favicon falls back on load error', sources.includes('onError') && sources.includes('loadFailed'));
check('host and snippet are separate lines (no "host · snippet" mashup)', !sources.includes('HOST_SNIPPET_SEPARATOR}${snippet}'));
check('pill is a flat chip (no gradient border stack)', !sources.includes('styles.pillBorder'));

console.log(`\nPopup + sources audit: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
