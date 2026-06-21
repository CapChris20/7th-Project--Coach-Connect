#!/usr/bin/env node
/**
 * Multi-turn thread follow-ups — clarify prior answer, don't re-search.
 * Run: node scripts/testAiCoachThreadFollowups.js
 */
const {
  BASE,
  USER_ID,
  createTally,
  getIdToken,
  postCoach,
  coachPayload,
  preview,
} = require('./lib/aiCoachTestHelpers');

const { isWebAnswerFollowUp, messagesRequestWebSearch } = require('../server/lib/coachWebSearch');

(async function main() {
  const t = createTally();
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(' AI COACH THREAD FOLLOW-UPS');
  console.log(` API: ${BASE}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const opener = 'Search the web: what does research say about protein intake for lifters?';
  const followUps = [
    {
      message: 'Can you be more specific about what you found?',
      label: 'clarify prior answer',
    },
    {
      message: 'What sources did you use for that?',
      label: 'source list follow-up',
    },
    {
      message: 'Pull a direct quote from one of those studies',
      label: 'source quote follow-up',
    },
  ];

  let token;
  try {
    token = await getIdToken();
    t.pass('Firebase auth token obtained');
  } catch (e) {
    t.fail('Firebase auth', e.message);
    process.exit(t.summary('Thread follow-ups'));
  }

  console.log('\n→ Turn 1: initial web search');
  const turn1 = await postCoach(
    token,
    coachPayload(opener, { web: 'on', includePersonalData: false }),
    { path: '/api/ai-coach/web-search', timeoutMs: 120_000 },
  );

  if (!turn1.ok) {
    t.fail('Turn 1 web search', `HTTP ${turn1.status}: ${preview(turn1.raw || turn1.json?.error, 120)}`);
    process.exit(t.summary('Thread follow-ups'));
  }

  t.assert('Turn 1: searchedWeb=true', turn1.json?.searchedWeb === true);
  t.assert('Turn 1: route=web-search', turn1.json?.route === 'web-search');
  const assistantReply = String(turn1.json?.reply || '').trim();
  t.assert('Turn 1: non-empty reply', assistantReply.length > 40, preview(assistantReply, 80));

  const history = [
    { role: 'user', content: opener },
    {
      role: 'assistant',
      content: assistantReply,
      searchedWeb: true,
      webSources: turn1.json?.webSources || [],
    },
  ];

  for (const fu of followUps) {
    console.log(`\n→ Follow-up: ${fu.label}`);
    const msgs = [...history, { role: 'user', content: fu.message }];
    t.assert(
      `${fu.label}: detected as answer follow-up`,
      isWebAnswerFollowUp(fu.message, msgs),
    );
    t.assert(
      `${fu.label}: does NOT request new web search`,
      !messagesRequestWebSearch(msgs, fu.message),
    );

    const res = await postCoach(
      token,
      coachPayload(fu.message, {
        web: 'auto',
        includePersonalData: false,
        messages: msgs,
      }),
      { timeoutMs: 90_000 },
    );

    if (!res.ok) {
      t.fail(fu.label, `HTTP ${res.status}: ${preview(res.raw || res.json?.error, 120)}`);
      continue;
    }

    const j = res.json;
    t.assert(`${fu.label}: got reply`, String(j?.reply || '').length > 10);
    t.assert(
      `${fu.label}: no fresh web search route`,
      j?.route !== 'web-search',
      `route=${j?.route} searchedWeb=${j?.searchedWeb}`,
    );
    t.pass(`${fu.label}: preview`, preview(j.reply, 90));
  }

  const failed = t.summary('Thread follow-ups');
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
