#!/usr/bin/env node
/**
 * Live Serper smoke test for AI Coach web search (optional — needs SERPER_API_KEY).
 * Run: SERPER_API_KEY=xxx node scripts/testCoachWebSearchLive.js
 * Or with root .env loaded by dotenv if present.
 */
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const key = process.env.SERPER_API_KEY;
if (!key) {
  console.log('⏭️  SERPER_API_KEY not set locally — skip live Serper test.');
  console.log('   Production health already checks serper: true via /api/health');
  process.exit(0);
}

const query = 'creatine monohydrate loading protocol 2025';

(async () => {
  console.log(`🔍 Serper live query: "${query}"`);
  const res = await axios.post(
    'https://google.serper.dev/search',
    { q: query, num: 5 },
    {
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      timeout: 15000,
      validateStatus: () => true,
    }
  );
  if (res.status < 200 || res.status >= 300) {
    console.error('❌ Serper HTTP', res.status, res.data?.message || res.data);
    process.exit(1);
  }
  const organic = res.data?.organic || [];
  if (!organic.length) {
    console.error('❌ Serper returned no organic results');
    process.exit(1);
  }
  console.log(`✅ Serper OK — ${organic.length} results`);
  organic.slice(0, 3).forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.title}\n      ${r.link}`);
  });
})().catch((e) => {
  console.error('❌ Serper request failed:', e.message);
  process.exit(1);
});
