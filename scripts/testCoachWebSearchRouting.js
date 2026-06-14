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
} = require('../server/lib/coachWebSearch');

const cases = [
  { fn: 'auto', msg: 'How did I do this week?', expect: false, mode: 'auto' },
  { fn: 'auto', msg: 'Can you put that I slept 10 hours', expect: false, mode: 'auto' },
  { fn: 'auto', msg: 'search the web for creatine loading protocol', expect: true, mode: 'auto' },
  { fn: 'auto', msg: 'google TRT side effects for athletes', expect: true, mode: 'auto' },
  { fn: 'auto', msg: 'what does the research say about protein timing', expect: true, mode: 'auto' },
  { fn: 'auto', msg: 'latest study on zone 2 cardio for fat loss', expect: true, mode: 'auto' },
  { fn: 'auto', msg: 'calories in a chipotle chicken bowl', expect: true, mode: 'auto' },
  { fn: 'auto', msg: 'my shoulder hurts on overhead press', expect: false, mode: 'auto' },
  { fn: 'perplexity', msg: 'is low testosterone affecting my recovery', expect: true },
  { fn: 'perplexity', msg: 'how much protein after leg day', expect: false },
  { fn: 'invoke', msg: 'this week nutrition', expect: false, mode: 'auto' },
  { fn: 'invoke', msg: 'search online for best creatine brand 2026', expect: true, mode: 'auto' },
  { fn: 'invoke', msg: 'anything', expect: true, mode: 'on' },
  { fn: 'invoke', msg: 'anything', expect: false, mode: 'off' },
  { fn: 'force', msg: 'search the web for magnesium dosage', expect: true },
  { fn: 'force', msg: 'how was my sleep this week', expect: false },
];

let passed = 0;
let failed = 0;

for (const c of cases) {
  let got;
  if (c.fn === 'auto') got = shouldUseWebAuto(c.msg);
  else if (c.fn === 'perplexity') got = shouldUsePerplexity(c.msg);
  else if (c.fn === 'invoke') got = shouldInvokeWebSearch(c.mode || 'auto', c.msg);
  else if (c.fn === 'force') got = shouldForceDedicatedWebSearchRoute(c.msg);
  else throw new Error(`unknown fn ${c.fn}`);

  const ok = got === c.expect;
  if (ok) {
    passed += 1;
    console.log(`✅ ${c.fn}: ${JSON.stringify(c.msg.slice(0, 50))} → ${got}`);
  } else {
    failed += 1;
    console.log(`❌ ${c.fn}: ${JSON.stringify(c.msg.slice(0, 50))} → ${got} (expected ${c.expect})`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
