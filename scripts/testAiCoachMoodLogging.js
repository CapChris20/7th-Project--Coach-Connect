// Regression test for the Oct 21 mood bug (Chris's screenshots):
//   1. "Log that I'm Happy" → coach said "Tap Confirm" but NO chip existed.
//   2. "Can u pls log my mood as happy" → chip showed "Log mood" with no mood,
//      tapping Confirm failed with "Mood must be one of: happy, okay, …".
// Flow tested offline (no network): user sentence → server inferrer →
// tap-confirm merge → guard (the gate that decides if a chip may exist).
// Run: node scripts/testAiCoachMoodLogging.js

const {
  inferCoachToolCall,
  mergeCoachToolCalls,
} = require('../server/lib/inferCoachToolCall');
const {
  guardCoachToolProposal,
  normalizeMoodValue,
  findMoodInText,
} = require('../src/ai-coach/coach-actions/shouldAskFirst');

let passed = 0;
let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed += 1;
  else failed += 1;
  console.log(`${ok ? '✅' : '❌'} ${label}${ok ? '' : `\n   expected: ${JSON.stringify(expected)}\n   actual:   ${JSON.stringify(actual)}`}`);
}
const moodOf = (call) => call?.params?.mood || null;

// ── 1. Server inferrer: screenshot phrasings + natural variants ─────────────
check('screenshot 1: "Log that I\'m Happy"', moodOf(inferCoachToolCall("Log that I'm Happy", {})), 'happy');
check('screenshot 2: "Can u pls log my mood as happy"', moodOf(inferCoachToolCall('Can u pls log my mood as happy', {})), 'happy');
check('"log my mood happy"', moodOf(inferCoachToolCall('log my mood happy', {})), 'happy');
check('"Log my mood: happy" (colon)', moodOf(inferCoachToolCall('Log my mood: happy', {})), 'happy');
check('"I\'m happy, log it"', moodOf(inferCoachToolCall("I'm happy, log it", {})), 'happy');
check('"log it — I am feeling anxious"', moodOf(inferCoachToolCall('log it — I am feeling anxious', {})), 'anxious');
check('"Feeling stressed today, log that"', moodOf(inferCoachToolCall('Feeling stressed today, log that', {})), 'stressed');
check('"track my mood as tired"', moodOf(inferCoachToolCall('track my mood as tired', {})), 'tired');
check('"log my mood as exhausted" → tired', moodOf(inferCoachToolCall('log my mood as exhausted', {})), 'tired');
check('"log my mood 😊" → happy', moodOf(inferCoachToolCall('log my mood 😊', {})), 'happy');

// ── 2. Negatives: no log intent / generic adjectives must not invent a mood ─
check('"I feel happy today" (no log verb) → null', inferCoachToolCall('I feel happy today', {}), null);
check('"What is a good mood?" (question) → null', inferCoachToolCall('What is a good mood?', {}), null);
check('"log a good workout" → not mood', inferCoachToolCall('log a good workout', {})?.name === 'logMood', false);
check('"log a good meal" → not mood', inferCoachToolCall('log a good meal', {})?.name === 'logMood', false);

// ── 3. Tap-confirm merge: model says "Tap Confirm" but forgets the JSON ────
const tapConfirmReply = 'Got it — logging you as happy. Tap Confirm in the app to save it.';
check(
  'tap-confirm merge recovers "Log that I\'m happy"',
  moodOf(mergeCoachToolCalls(tapConfirmReply, "Log that I'm happy", {})[0]),
  'happy',
);
check(
  'tap-confirm merge recovers "Can u pls log my mood as happy"',
  moodOf(mergeCoachToolCalls(tapConfirmReply, 'Can u pls log my mood as happy', {})[0]),
  'happy',
);

// ── 4. Guard: model-shaped payloads can no longer create an empty chip ─────
const guardMood = (params) => moodOf(guardCoachToolProposal({ name: 'logMood', params }));
check('guard {mood:"happy"}', guardMood({ mood: 'happy' }), 'happy');
check('guard {mood:"Happy"} → happy', guardMood({ mood: 'Happy' }), 'happy');
check('guard {mood:"happy 😊"} → happy', guardMood({ mood: 'happy 😊' }), 'happy');
check('guard {mood:"😊"} → happy', guardMood({ mood: '😊' }), 'happy');
check('guard {mood:"great"} → happy', guardMood({ mood: 'great' }), 'happy');
check('guard {feeling:"happy"} (alias key) → happy', guardMood({ feeling: 'happy' }), 'happy');
check('guard {mood:""} → proposal dropped', guardCoachToolProposal({ name: 'logMood', params: { mood: '' } }), null);
check('guard {} → proposal dropped (was the blank chip)', guardCoachToolProposal({ name: 'logMood', params: {} }), null);
check('guard {mood:"banana"} → proposal dropped', guardCoachToolProposal({ name: 'logMood', params: { mood: 'banana' } }), null);

// ── 5. Same empty-popup class, other tools ──────────────────────────────────
check('guard updateGoal {} → dropped', guardCoachToolProposal({ name: 'updateGoal', params: {} }), null);
check('guard notifyTrainer {} → dropped', guardCoachToolProposal({ name: 'notifyTrainer', params: {} }), null);
check('guard logNutrition {} → dropped', guardCoachToolProposal({ name: 'logNutrition', params: {} }), null);
check('guard updateWorkout {} → dropped', guardCoachToolProposal({ name: 'updateWorkout', params: {} }), null);
check(
  'guard bookSession {dateTime} keeps the booking (was Date "—")',
  guardCoachToolProposal({ name: 'bookSession', params: { dateTime: 'next Tuesday at 10am' } })?.params?.dateTime,
  'next Tuesday at 10am',
);
check('guard bookSession {} → dropped', guardCoachToolProposal({ name: 'bookSession', params: {} }), null);
check(
  'guard logSleep {} still dropped (pre-existing rule)',
  guardCoachToolProposal({ name: 'logSleep', params: {} }),
  null,
);

// ── 6. Helpers directly ─────────────────────────────────────────────────────
check('normalizeMoodValue("Happy!")', normalizeMoodValue('Happy!'), 'happy');
check('normalizeMoodValue("banana")', normalizeMoodValue('banana') || null, null);
check('findMoodInText("log a good workout") → none', findMoodInText('log a good workout') || null, null);
check('findMoodInText("feeling good, log it") → happy', findMoodInText('feeling good, log it'), 'happy');

console.log(`\nMood logging regression: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
