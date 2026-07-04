#!/usr/bin/env node
/**
 * Web search gates, off-topic blocks, and tool parsing.
 * Run: node scripts/testAiCoachGatesAndTools.js
 */
const path = require('path');
const {
  BASE,
  USER_ID,
  ROOT,
  createTally,
  getIdToken,
  postCoach,
  coachPayload,
  preview,
} = require('./lib/aiCoachTestHelpers');

const { resolveCoachWebSearchGate } = require('../server/lib/coachWebSearch');

const GATE_CASES = [
  {
    message: 'Can you search the web for me?',
    expectAction: 'ask_topic',
  },
  {
    message: 'search the web for best iPhone deals',
    expectAction: 'off_topic',
  },
  {
    message: 'search the web for creatine loading protocol',
    expectAction: 'search',
  },
];

(async function main() {
  const t = createTally();
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(' AI COACH GATES & TOOLS');
  console.log(` API: ${BASE}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('── Static gate routing (no network) ──\n');
  for (const c of GATE_CASES) {
    const gate = resolveCoachWebSearchGate({
      lastUserMsg: c.message,
      messages: [{ role: 'user', content: c.message }],
      rawQuery: c.message,
    });
    t.assert(
      `Gate "${c.message.slice(0, 40)}…" → ${c.expectAction}`,
      gate.action === c.expectAction,
      `got ${gate.action}`,
    );
  }

  console.log('\n── Tool JSON parsing (dev endpoint) ──\n');
  const fakeReply =
    'Here is the plan.\n' +
    '{"toolCalls":[{"name":"adjustMacroTargets","params":{"calories":2200,"protein":180,"carbs":200,"fat":60},"reasoning":"Test macro bump."}]}';

  const { parseCoachToolCalls, stripCoachToolJsonFromReply } = require(path.join(
    ROOT,
    'src/ai-coach/tools/parseCoachToolCalls.js',
  ));
  const localCalls = parseCoachToolCalls(fakeReply);
  const localReply = stripCoachToolJsonFromReply(fakeReply);
  t.assert('Local tool parse finds adjustMacroTargets', localCalls?.[0]?.name === 'adjustMacroTargets');
  t.assert('Local tool JSON stripped from reply', !String(localReply).includes('"toolCalls"'));

  const localBase = 'http://localhost:4000';
  try {
    const parseRes = await fetch(`${localBase}/api/ai-coach/debug/parse-toolcalls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: fakeReply }),
      signal: AbortSignal.timeout(5_000),
    });
    if (parseRes.ok) {
      const parseJson = await parseRes.json().catch(() => ({}));
      t.assert(
        'Local server tool parse finds adjustMacroTargets',
        parseJson?.toolCalls?.[0]?.name === 'adjustMacroTargets',
      );
    } else if (parseRes.status === 404) {
      t.skip('Local dev parse endpoint', 'start npm run server for HTTP parse check');
    }
  } catch (_) {
    t.skip('Local dev parse endpoint', 'localhost:4000 not running');
  }

  console.log('\n── Live gate responses (authenticated) ──\n');
  let token;
  try {
    token = await getIdToken();
    t.pass('Firebase auth token obtained');
  } catch (e) {
    t.skip('Live gate tests', e.message);
    const failed = t.summary('Gates & tools');
    process.exit(failed > 0 ? 1 : 0);
  }

  for (const c of GATE_CASES) {
    console.log(`\n→ ${c.message.slice(0, 60)}…`);
    const res = await postCoach(
      token,
      coachPayload(c.message, { web: 'auto', includePersonalData: false }),
      { timeoutMs: 60_000 },
    );

    if (!res.ok) {
      t.fail(c.expectAction, `HTTP ${res.status}: ${preview(res.raw || res.json?.error, 100)}`);
      continue;
    }

    const j = res.json;
    if (c.expectAction === 'search') {
      t.assert(`${c.expectAction}: searchedWeb or web route`, j?.searchedWeb === true || j?.route === 'web-search');
    } else {
      t.assert(
        `${c.expectAction}: blocked web search`,
        j?.route === `web-search-${c.expectAction.replace('_', '-')}` ||
          j?.route === `web-search-${c.expectAction}`,
        `route=${j?.route} searchedWeb=${j?.searchedWeb}`,
      );
      t.assert(`${c.expectAction}: searchedWeb=false`, j?.searchedWeb !== true);
      t.pass(`${c.expectAction}: reply`, preview(j.reply, 90));
    }
  }

  console.log('\n── Tool proposal from coach (log sleep) ──\n');
  const toolRes = await postCoach(
    token,
    coachPayload('log my sleep 8 hours last night', { web: 'off', includePersonalData: true }),
    { timeoutMs: 90_000 },
  );

  if (!toolRes.ok) {
    t.fail('logSleep tool proposal', `HTTP ${toolRes.status}`);
  } else {
    const tools = toolRes.json?.toolCalls || [];
    const names = tools.map((x) => x.name).join(', ') || 'none';
    t.assert('logSleep tool proposed', tools.some((x) => x.name === 'logSleep'), names);
    t.assert('logSleep turn did not web search', toolRes.json?.searchedWeb !== true);
  }

  const { COACH_DATA_INTEGRITY_RULE } = require(path.join(ROOT, 'server/lib/coachVoice.js'));
  t.assert('DATA INTEGRITY rule present', COACH_DATA_INTEGRITY_RULE.includes('Never estimate'));

  const failed = t.summary('Gates & tools');
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
