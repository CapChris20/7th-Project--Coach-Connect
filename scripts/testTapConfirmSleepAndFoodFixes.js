// Regression for Nov 2026 Tap-Confirm sleep gap + food-search junk/reliability helpers.
// Flow: screenshot sleep prose → merge/recover tool → food junk titles stay filtered.
// Run: node scripts/testTapConfirmSleepAndFoodFixes.js

const {
  parseSleepHoursFromMessage,
  inferToolCallFromAssistantProse,
  mergeCoachToolCalls,
} = require('../server/lib/inferCoachToolCall');
const {
  guardCoachToolProposal,
  isValidCoachToolProposal,
} = require('../src/ai-coach/coach-actions/shouldAskFirst');
const { isJunkWebSearchTitle } = require('../src/nutrition/food-search/tidyFoodTitles');
const {
  isPersonalDataLookup,
  shouldInvokeWebSearch,
  shouldForceDedicatedWebSearchRoute,
} = require('../server/lib/coachWebSearch');

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed += 1;
  else failed += 1;
  console.log(
    `${ok ? '✅' : '❌'} ${label}${
      ok ? '' : `\n   expected: ${JSON.stringify(expected)}\n   actual:   ${JSON.stringify(actual)}`
    }`,
  );
}

const user = 'Help me log my sleep for last night.';
const reply =
  'Logging 10 hours for last night — that tracks with what you have been getting. Tap Confirm in the app and it is saved.';

// ── Sleep Tap-Confirm gap (screenshot) ──────────────────────────────────────
check('parse hours from Logging 10 hours prose', parseSleepHoursFromMessage(reply), 10);
check('no hours invented from user-only sentence', parseSleepHoursFromMessage(user), null);

const recovered = inferToolCallFromAssistantProse(reply, user, {});
check('assistant-prose recovery → logSleep', recovered?.name, 'logSleep');
check('assistant-prose recovery hours = 10', recovered?.params?.hours, 10);

const merged = mergeCoachToolCalls(reply, user, {}, []);
check('merge recovers one tool', merged.length, 1);
check('merge tool is logSleep', merged[0]?.name, 'logSleep');
check('merge hours = 10', merged[0]?.params?.hours, 10);

check(
  'logSleep+10 valid for screenshot user text',
  isValidCoachToolProposal({ name: 'logSleep', params: { hours: 10 } }, user),
  true,
);

check(
  'incomplete logSleep still guards (chip can open)',
  guardCoachToolProposal({ name: 'logSleep', params: {} })?.name,
  'logSleep',
);

const incompleteRecover = inferToolCallFromAssistantProse(
  'Sure — tap Confirm in the app once you pick the hours.',
  user,
  {},
);
check('Confirm prose without hours still offers logSleep', incompleteRecover?.name, 'logSleep');

// Client regex parity (mirrors findActionsInReply sleep patterns)
const combined = `${user}\n${reply}`.toLowerCase();
const sleepMatch =
  combined.match(/log(?:ging|ged)?\s+(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i) ||
  combined.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\s*(?:of\s*)?sleep/i) ||
  combined.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\s*(?:for\s+)?(?:last\s+night|tonight|today|yesterday)/i);
check('client sleep regex catches Logging 10 hours', sleepMatch && sleepMatch[1], '10');
check('client regex matches log my sleep', /\blog\s+(?:my\s+)?sleep\b/i.test(combined), true);

// ── Web routing (server coachWebSearch — same rules as client) ──────────────
check('sleep log request stays personal/local', isPersonalDataLookup(user), true);
check('sleep log does not invoke web (auto)', shouldInvokeWebSearch('auto', user), false);
check(
  'explicit web phrase forces dedicated route',
  shouldForceDedicatedWebSearchRoute('search the web for creatine'),
  true,
);
check(
  'explicit research still routes to web',
  shouldInvokeWebSearch('auto', 'search the web for creatine dosage'),
  true,
);
check(
  'personal sleep lookup stays off web',
  shouldInvokeWebSearch('auto', 'look up my sleep last night'),
  false,
);

// ── Food junk titles ────────────────────────────────────────────────────────
check('real food title kept', isJunkWebSearchTitle('Chicken Breast'), false);
check('restaurant item kept', isJunkWebSearchTitle('Chipotle Chicken Bowl'), false);
check('how-many-calories junk', isJunkWebSearchTitle('How many calories in chicken'), true);
check('click-here junk', isJunkWebSearchTitle('Click here for nutrition facts'), true);
check('buy-online junk', isJunkWebSearchTitle('Buy online Greek Yogurt'), true);
check('search-results junk', isJunkWebSearchTitle('Search Results'), true);

// Mood regression must still pass through merge for happy
const moodMerged = mergeCoachToolCalls(
  'Got it — logging you as happy. Tap Confirm in the app to save it.',
  "Log that I'm Happy",
  {},
  [],
);
check('mood tap-confirm merge still recovers logMood', moodMerged[0]?.name, 'logMood');
check('mood tap-confirm merge mood=happy', moodMerged[0]?.params?.mood, 'happy');

// ── Water amount-only follow-up (90oz screenshot) ───────────────────────────
const waterUser = '90oz';
const waterReply = 'Logging 90oz for today. Tap Confirm in the app to save it.';
const waterMerged = mergeCoachToolCalls(waterReply, waterUser, {}, []);
check('water follow-up merge recovers logWater', waterMerged[0]?.name, 'logWater');
check('water follow-up amount_oz=90', waterMerged[0]?.params?.amount_oz, 90);
check(
  'water follow-up proposal valid for 90oz',
  isValidCoachToolProposal({ name: 'logWater', params: { amount_oz: 90 } }, waterUser),
  true,
);

console.log(`\nTap-Confirm + food fixes: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
