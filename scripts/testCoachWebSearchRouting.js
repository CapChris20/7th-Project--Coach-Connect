#!/usr/bin/env node
/**
 * Unit tests for AI Coach web-search routing heuristics.
 * Run: node scripts/testCoachWebSearchRouting.js
 */
const {
  shouldUseWebAuto,
  shouldUsePerplexity,
  shouldInvokeWebSearch,
  shouldForceDedicatedWebSearchRoute,
  messagesRequestWebSearch,
  buildWebSearchQuery,
  isWebAnswerFollowUp,
  isWebSourceQuoteFollowUp,
  findPriorSubstantiveUserQuestion,
  isGenericWebSearchRequest,
  resolveCoachWebSearchGate,
  filterFitnessWebSources,
  scopeWebSearchQueryForCoach,
} = require('../server/lib/coachWebSearch');

/** Mirrors handleAICoachRequest invokeWeb (without images). */
function simulateInvokeWeb({ webMode = 'auto', lastUserMsg, messages }) {
  if (isWebAnswerFollowUp(lastUserMsg, messages)) return false;
  return (
    webMode === 'on' ||
    (webMode !== 'off' &&
      (shouldInvokeWebSearch(webMode, lastUserMsg) || messagesRequestWebSearch(messages, lastUserMsg)))
  );
}

const cases = [
  { fn: 'auto', msg: 'How did I do this week?', expect: false, mode: 'auto' },
  { fn: 'auto', msg: 'Can you put that I slept 10 hours', expect: false, mode: 'auto' },
  { fn: 'auto', msg: 'search the web for creatine loading protocol', expect: true, mode: 'auto' },
  { fn: 'auto', msg: 'google TRT side effects for athletes', expect: true, mode: 'auto' },
  { fn: 'auto', msg: 'what does the research say about protein timing', expect: true, mode: 'auto' },
  { fn: 'auto', msg: 'latest study on zone 2 cardio for fat loss', expect: true, mode: 'auto' },
  { fn: 'auto', msg: 'calories in a chipotle chicken bowl', expect: true, mode: 'auto' },
  { fn: 'auto', msg: 'my shoulder hurts on overhead press', expect: false, mode: 'auto' },
  { fn: 'auto', msg: 'can u check the web to verify', expect: true, mode: 'auto' },
  { fn: 'auto', msg: 'No check the web just in case', expect: true, mode: 'auto' },
  { fn: 'auto', msg: 'check the damn web', expect: true, mode: 'auto' },
  {
    fn: 'auto',
    msg: 'So did the workouts I said those are optimal for body recomp right can u check the web to verify',
    expect: true,
    mode: 'auto',
  },
  { fn: 'auto', msg: 'U got any sources or u didnt even check did u', expect: true, mode: 'auto' },
  { fn: 'auto', msg: 'Cite sources on body recomposition rates', expect: true, mode: 'auto' },
  { fn: 'auto', msg: 'pull up sources for that study', expect: true, mode: 'auto' },
  { fn: 'perplexity', msg: 'is low testosterone affecting my recovery', expect: true },
  { fn: 'perplexity', msg: 'how much protein after leg day', expect: false },
  { fn: 'invoke', msg: 'this week nutrition', expect: false, mode: 'auto' },
  { fn: 'invoke', msg: 'search online for best creatine brand 2026', expect: true, mode: 'auto' },
  { fn: 'invoke', msg: 'check the web', expect: true, mode: 'auto' },
  { fn: 'invoke', msg: 'anything', expect: true, mode: 'on' },
  { fn: 'invoke', msg: 'anything', expect: false, mode: 'off' },
  { fn: 'force', msg: 'search the web for magnesium dosage', expect: true },
  { fn: 'force', msg: 'how was my sleep this week', expect: false },
  {
    fn: 'thread',
    msgs: [
      {
        role: 'user',
        content:
          'So did the workouts I said those are optimal for body recomp right can u check the web to verify',
      },
      { role: 'assistant', content: 'I can tell you straight up...' },
      { role: 'user', content: 'No check the web just in case' },
    ],
    expect: true,
  },
  {
    fn: 'query',
    msgs: [
      {
        role: 'user',
        content:
          'So did the workouts I said those are optimal for body recomp right can u check the web to verify',
      },
      { role: 'assistant', content: 'I can tell you straight up...' },
      { role: 'user', content: 'check the damn web' },
    ],
    last: 'check the damn web',
    expectIncludes: 'body recomp',
    expect: true,
  },
  {
    fn: 'followup',
    msg: 'Can you tell me specifically about what you found not vague information please?',
    msgs: [
      { role: 'user', content: 'What does the research say about protein timing after workouts' },
      { role: 'assistant', content: 'Post-workout protein within 30-60 min may help muscle protein synthesis.' },
      { role: 'user', content: 'Can you tell me specifically about what you found not vague information please?' },
    ],
    expect: true,
  },
  {
    fn: 'followup',
    msg: 'Search the web: what does research say about protein intake for lifters?',
    msgs: [{ role: 'user', content: 'Search the web: what does research say about protein intake for lifters?' }],
    expect: false,
  },
  {
    fn: 'thread',
    msg: 'Search the web: what does research say about protein intake for lifters?',
    msgs: [{ role: 'user', content: 'Search the web: what does research say about protein intake for lifters?' }],
    expect: true,
  },
  {
    fn: 'gate',
    msg: 'Can you search the web for me?',
    expect: 'ask_topic',
  },
  {
    fn: 'gate',
    msg: 'search the web for best iPhone deals',
    expect: 'off_topic',
  },
  {
    fn: 'gate',
    msg: 'search the web for creatine loading protocol',
    expect: 'search',
    expectQueryIncludes: 'creatine',
  },
  {
    fn: 'filter',
    sources: [
      { title: 'Search the web in Chrome', url: 'https://support.google.com/chrome', snippet: '' },
      { title: 'Creatine supplementation', url: 'https://examine.com/supplements/creatine/', snippet: 'dosing' },
    ],
    expectCount: 1,
  },
];

let passed = 0;
let failed = 0;

for (const c of cases) {
  let got;
  if (c.fn === 'auto') got = shouldUseWebAuto(c.msg);
  else if (c.fn === 'perplexity') got = shouldUsePerplexity(c.msg);
  else if (c.fn === 'invoke') got = shouldInvokeWebSearch(c.mode || 'auto', c.msg);
  else if (c.fn === 'force') got = shouldForceDedicatedWebSearchRoute(c.msg);
  else if (c.fn === 'thread') got = messagesRequestWebSearch(c.msgs);
  else if (c.fn === 'query') {
    const q = buildWebSearchQuery(c.msgs, c.last);
    got = q.includes(c.expectIncludes);
  } else if (c.fn === 'followup') got = isWebAnswerFollowUp(c.msg, c.msgs);
  else if (c.fn === 'simulate') {
    got = simulateInvokeWeb({ webMode: c.webMode, lastUserMsg: c.msg, messages: c.msgs });
  } else if (c.fn === 'gate') {
    const gate = resolveCoachWebSearchGate({ lastUserMsg: c.msg, messages: c.msgs || [], rawQuery: c.msg });
    got = gate.action;
    if (c.expectQueryIncludes && gate.query && !gate.query.toLowerCase().includes(c.expectQueryIncludes)) {
      got = `search-missing-${c.expectQueryIncludes}`;
    }
  } else if (c.fn === 'filter') {
    got = filterFitnessWebSources(c.sources).length;
    c.expect = c.expectCount;
  } else throw new Error(`unknown fn ${c.fn}`);

  const ok = got === c.expect;
  if (ok) {
    passed += 1;
    const label = c.msg ? c.msg.slice(0, 50) : c.fn;
    console.log(`✅ ${c.fn}: ${JSON.stringify(label)} → ${got}`);
  } else {
    failed += 1;
    const label = c.msg ? c.msg.slice(0, 50) : c.fn;
    console.log(`❌ ${c.fn}: ${JSON.stringify(label)} → ${got} (expected ${c.expect})`);
  }
}

const priorQ = findPriorSubstantiveUserQuestion(
  [
    { role: 'user', content: 'How much creatine should I take per day?' },
    { role: 'assistant', content: 'Most people do 3-5g daily.' },
    { role: 'user', content: 'quote from the sources on creatine dosing' },
  ],
  'quote from the sources on creatine dosing',
);
if (priorQ && priorQ.includes('creatine')) {
  passed += 1;
  console.log(`✅ priorQ: ${JSON.stringify(priorQ.slice(0, 50))}`);
} else {
  failed += 1;
  console.log(`❌ priorQ: ${priorQ} (expected creatine question)`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
