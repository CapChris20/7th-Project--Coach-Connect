#!/usr/bin/env node
/**
 * End-to-end AI Coach web-search pipeline test (local server code, no auth).
 * Run: node scripts/testCoachWebSearchPipeline.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const axios = require('axios');
const {
  shouldInvokeWebSearch,
  buildWebSearchQuery,
  scopeWebSearchQueryForCoach,
} = require('../server/lib/coachWebSearch');
const { serperOrganicSearch } = require('../server/lib/serperWebSearch');

const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY || process.env.PPLX_API_KEY;
const SERPER_KEY = process.env.SERPER_API_KEY;
const MODEL = process.env.PERPLEXITY_MODEL || 'sonar';

async function testPerplexity(query) {
  if (!PERPLEXITY_KEY) return { ok: false, reason: 'no PERPLEXITY_API_KEY' };
  const resp = await axios.post(
    'https://api.perplexity.ai/chat/completions',
    {
      model: MODEL,
      messages: [{ role: 'user', content: query }],
      max_tokens: 200,
      return_citations: true,
    },
    {
      headers: { Authorization: `Bearer ${PERPLEXITY_KEY}`, 'Content-Type': 'application/json' },
      timeout: 45000,
      validateStatus: () => true,
    },
  );
  if (resp.status < 200 || resp.status >= 300) {
    return {
      ok: false,
      reason: `HTTP ${resp.status}: ${JSON.stringify(resp.data?.error || resp.data).slice(0, 200)}`,
    };
  }
  const text = resp.data?.choices?.[0]?.message?.content || '';
  const citations = Array.isArray(resp.data?.citations) ? resp.data.citations.length : 0;
  return { ok: !!text.trim(), citations, preview: text.slice(0, 120) };
}

async function main() {
  const userMsg = 'Search the web: Mark Haub Twinkie Diet Kansas State study';
  const messages = [{ role: 'user', content: userMsg }];
  const invoke = shouldInvokeWebSearch('on', userMsg);
  const query = buildWebSearchQuery(messages, userMsg);
  const cleanQuery = scopeWebSearchQueryForCoach(query) || query;

  console.log('invokeWeb (mode=on):', invoke);
  console.log('buildWebSearchQuery:', query);
  console.log('scopedQuery:', cleanQuery);

  let serperOk = false;
  if (SERPER_KEY) {
    const serper = await serperOrganicSearch(cleanQuery, 5);
    serperOk = serper.length > 0;
    console.log(serperOk ? `✅ Serper: ${serper.length} results` : '❌ Serper: 0 results');
    if (serper[0]) console.log('   1.', serper[0].title, serper[0].link);
  } else {
    console.log('⏭️  Serper skipped — no SERPER_API_KEY');
  }

  const ppx = await testPerplexity(cleanQuery);
  if (ppx.ok) {
    console.log(`✅ Perplexity (${MODEL}): citations=${ppx.citations}`);
    console.log('   ', ppx.preview);
  } else {
    console.log('❌ Perplexity:', ppx.reason);
  }

  const ok = ppx.ok || serperOk;
  console.log(ok ? '\n✅ Pipeline OK' : '\n❌ Pipeline failed (need Perplexity or Serper)');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('❌ Pipeline test failed:', e.message);
  process.exit(1);
});
