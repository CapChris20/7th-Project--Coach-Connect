#!/usr/bin/env node
/**
 * Live E2E web search — hits production Cloud Run with auth.
 * Run: node scripts/testAiCoachWebSearchE2E.js
 */
const {
  BASE,
  USER_ID,
  createTally,
  getIdToken,
  fetchHealth,
  postCoach,
  coachPayload,
  preview,
} = require('./lib/aiCoachTestHelpers');

const SCENARIOS = [
  {
    name: 'Protein for lifters (user-reported failure)',
    message: 'Search the web: what does research say about protein intake for lifters?',
    path: '/api/ai-coach/web-search',
    expect: (j) =>
      j.searchedWeb === true &&
      j.route === 'web-search' &&
      String(j.reply || '').length > 40 &&
      (Array.isArray(j.webSources) ? j.webSources.length : 0) >= 1,
    detail: (j) =>
      `route=${j.route} searchedWeb=${j.searchedWeb} sources=${j.webSources?.length || 0} provider=${j.webProvider}`,
  },
  {
    name: 'Creatine loading via auto route',
    message: 'Search online for creatine monohydrate loading protocol 2025',
    path: '/api/ai-coach',
    expect: (j) => j.searchedWeb === true && j.route === 'web-search' && String(j.reply || '').length > 30,
    detail: (j) => `source=${j.source} provider=${j.webProvider}`,
  },
  {
    name: 'Research phrase triggers web',
    message: 'What does the research say about sleep and muscle recovery for athletes?',
    path: '/api/ai-coach',
    expect: (j) => j.searchedWeb === true && j.route !== 'web-search-failed',
    detail: (j) => `route=${j.route} searchedWeb=${j.searchedWeb}`,
  },
  {
    name: 'Dedicated endpoint forces search',
    message: 'best magnesium dosage for sleep quality',
    path: '/api/ai-coach/web-search',
    expect: (j) => j.searchedWeb === true && j.route === 'web-search',
    detail: (j) => `sources=${j.webSources?.length || 0}`,
  },
];

(async function main() {
  const t = createTally();
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(' AI COACH WEB SEARCH E2E');
  console.log(` API: ${BASE}`);
  console.log(` User: ${USER_ID.slice(0, 8)}…`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const health = await fetchHealth();
  t.assert('API health OK', health.ok, `status ${health.status}`);
  t.assert('webSearchReady', health.json?.webSearchReady === true);
  t.assert('serper configured', health.json?.serper === true);
  t.assert('perplexity configured', health.json?.perplexity === true);

  let token;
  try {
    token = await getIdToken();
    t.pass('Firebase auth token obtained');
  } catch (e) {
    t.fail('Firebase auth', e.message);
    process.exit(t.summary('Web search E2E'));
  }

  for (const s of SCENARIOS) {
    console.log(`\n→ ${s.name}`);
    const started = Date.now();
    const res = await postCoach(token, coachPayload(s.message, { web: 'on', includePersonalData: false }), {
      path: s.path,
      started,
    });

    if (!res.ok) {
      t.fail(s.name, `HTTP ${res.status}: ${preview(res.raw || res.json?.error, 120)}`);
      continue;
    }

    const ok = s.expect(res.json);
    t.assert(
      s.name,
      ok,
      `${s.detail(res.json)} | ${Math.round((Date.now() - started) / 1000)}s | "${preview(res.json?.reply, 80)}"`,
    );

    if (res.json?.route === 'web-search-failed') {
      t.fail(`${s.name} — must not fall back to coaching-only`, preview(res.json?.reply, 120));
    }
  }

  const failed = t.summary('Web search E2E');
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
