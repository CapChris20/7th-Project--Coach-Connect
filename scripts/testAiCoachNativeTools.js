// Native tool-calling regression (Oct 2026, after the mood-confirm bug):
// DeepSeek used to hide {"toolCalls": [...]} JSON inside its prose and the app
// scraped it back out with regex. Now the coach sends COACH_FUNCTION_TOOLS and
// reads message.tool_calls. Tested offline: schema coverage, payload shape,
// argument parsing, and the merge (native calls still pass the guard, so an
// invalid mood from ANY path can no longer become a Confirm chip).
// Run: node scripts/testAiCoachNativeTools.js

const {
  COACH_FUNCTION_TOOLS,
  parseNativeToolCalls,
} = require('../server/lib/coachTools/coachToolSchemas');
const {
  getDeepSeekModel,
  buildDeepSeekChatPayload,
} = require('../server/lib/llm/coachLlmProviders');
const { mergeCoachToolCalls } = require('../server/lib/inferCoachToolCall');
const { COACH_TOOL_NAMES } = require('../src/ai-coach/coach-actions/readActionsFromReply');

let passed = 0;
let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed += 1;
  else failed += 1;
  console.log(`${ok ? '✅' : '❌'} ${label}${ok ? '' : `\n   expected: ${JSON.stringify(expected)}\n   actual:   ${JSON.stringify(actual)}`}`);
}

// ── 1. Model: the retired name is gone ──────────────────────────────────────
delete process.env.DEEPSEEK_MODEL;
check('default model is deepseek-flash (deepseek-chat retired)', getDeepSeekModel(), 'deepseek-flash');

// ── 2. Payload: native tools + cooled temperature ───────────────────────────
const payload = buildDeepSeekChatPayload({
  systemPrompt: 'You are a coach.',
  messages: [{ role: 'user', content: 'log my mood as happy' }],
  tools: COACH_FUNCTION_TOOLS,
});
check('payload model', payload.model, 'deepseek-flash');
check('payload temperature (was 0.7)', payload.temperature, 0.3);
check('payload tool_choice', payload.tool_choice, 'auto');
check('payload carries all tools', payload.tools.length, COACH_TOOL_NAMES.length);

// ── 3. Schema covers exactly the tools the rest of the app knows ────────────
check(
  'schema names == COACH_TOOL_NAMES',
  COACH_FUNCTION_TOOLS.map((t) => t.function.name).sort(),
  [...COACH_TOOL_NAMES].sort(),
);
const moodTool = COACH_FUNCTION_TOOLS.find((t) => t.function.name === 'logMood');
check('logMood mood enum', moodTool.function.parameters.properties.mood.enum, [
  'happy', 'okay', 'stressed', 'tired', 'anxious',
]);
check('logMood requires mood', moodTool.function.parameters.required, ['mood']);

// ── 4. Parsing provider tool_calls ──────────────────────────────────────────
check(
  'parses a DeepSeek tool_call',
  parseNativeToolCalls({
    tool_calls: [{ id: '1', function: { name: 'logMood', arguments: '{"mood":"happy"}' } }],
  }),
  [{ name: 'logMood', params: { mood: 'happy' }, reasoning: '' }],
);
check(
  'bad argument JSON drops the call (no guessing at mutations)',
  parseNativeToolCalls({ tool_calls: [{ function: { name: 'logMood', arguments: '{mood:' } }] }),
  [],
);
check('no tool_calls → []', parseNativeToolCalls({ content: 'hi' }), []);

// ── 5. Merge: native calls win, guard still applies ─────────────────────────
check(
  'native logMood reaches the chip list',
  mergeCoachToolCalls('Logging you as happy. Tap Confirm in the app.', 'log my mood as happy', {}, [
    { name: 'logMood', params: { mood: 'happy' }, reasoning: '' },
  ]).map((c) => `${c.name}:${c.params.mood}`),
  ['logMood:happy'],
);
check(
  'native invalid mood is dropped by the guard',
  mergeCoachToolCalls('Tap Confirm in the app.', 'log my mood', {}, [
    { name: 'logMood', params: { mood: 'banana' }, reasoning: '' },
  ]),
  [],
);
check(
  'native + prose JSON dedupe to one call',
  mergeCoachToolCalls(
    'Logging it. {"toolCalls": [{"name": "logMood", "params": {"mood": "happy"}}]}',
    'log my mood as happy',
    {},
    [{ name: 'logMood', params: { mood: 'happy' }, reasoning: '' }],
  ).length,
  1,
);

console.log(`\nNative tool-calling regression: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
