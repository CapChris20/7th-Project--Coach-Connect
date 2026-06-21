#!/usr/bin/env node
/**
 * Personal data coach turns — must NOT trigger web search.
 * Run: node scripts/testAiCoachPersonalData.js
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

const SCENARIOS = [
  {
    name: 'Today food log',
    message: 'What did I eat today?',
    forbidWeb: true,
    wantWeekly: true,
  },
  {
    name: 'Sleep this week',
    message: 'How did I sleep this week?',
    forbidWeb: true,
    wantWeekly: true,
  },
  {
    name: 'Steps this week',
    message: 'How many steps did I get this week?',
    forbidWeb: true,
    wantWeekly: true,
  },
  {
    name: 'Macro targets',
    message: 'What are my current macro targets?',
    forbidWeb: true,
    wantWeekly: false,
  },
  {
    name: 'Workout plan question',
    message: 'What does my workout plan look like this week?',
    forbidWeb: true,
    wantWeekly: true,
  },
];

function looksLikeHallucinatedSteps(text) {
  const t = String(text || '');
  if (/\b(you(?:'ve| have)? (?:walked|got|logged|averaged))\s+(?:about\s+)?[\d,]+\s*steps/i.test(t)) {
    return true;
  }
  if (
    /\b[\d,]+\s*steps\s*(?:this week|per day|daily|on average)/i.test(t) &&
    !/don'?t have|not logged|no step|no data|haven't logged/i.test(t)
  ) {
    return true;
  }
  return false;
}

(async function main() {
  const t = createTally();
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(' AI COACH PERSONAL DATA');
  console.log(` API: ${BASE}`);
  console.log(` User: ${USER_ID.slice(0, 8)}…`);
  console.log('═══════════════════════════════════════════════════════════\n');

  let token;
  try {
    token = await getIdToken();
    t.pass('Firebase auth token obtained');
  } catch (e) {
    t.fail('Firebase auth', e.message);
    process.exit(t.summary('Personal data'));
  }

  for (const s of SCENARIOS) {
    console.log(`\n→ ${s.name}: "${s.message}"`);
    const res = await postCoach(
      token,
      coachPayload(s.message, { web: 'auto', includePersonalData: true }),
      { timeoutMs: 90_000 },
    );

    if (!res.ok) {
      t.fail(s.name, `HTTP ${res.status}: ${preview(res.raw || res.json?.error, 120)}`);
      continue;
    }

    const j = res.json;
    t.assert(`${s.name}: got reply`, String(j?.reply || '').length > 10);
    t.assert(`${s.name}: route is chat (not web-search)`, j?.route !== 'web-search', `route=${j?.route}`);

    if (s.forbidWeb) {
      t.assert(`${s.name}: searchedWeb=false`, j?.searchedWeb !== true, `searchedWeb=${j?.searchedWeb}`);
    }

    if (s.wantWeekly) {
      t.assert(
        `${s.name}: used weekly context`,
        j?.usedWeeklyContext === true,
        `usedWeeklyContext=${j?.usedWeeklyContext}`,
      );
    }

    if (s.message.includes('steps') && looksLikeHallucinatedSteps(j?.reply)) {
      t.fail(`${s.name}: may hallucinate step counts`, preview(j.reply, 140));
    }

    t.pass(`${s.name}: preview`, preview(j.reply, 90));
  }

  const failed = t.summary('Personal data');
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
