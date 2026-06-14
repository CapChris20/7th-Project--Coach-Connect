#!/usr/bin/env node
/**
 * Smoke-test Replicate DeepSeek-VL2 + DeepSeek chat polish.
 * Usage: node scripts/testCoachVisionReplicate.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { runCoachVisionTurn, isCoachVisionConfigured } = require('../server/lib/coachVision');

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function main() {
  if (!process.env.REPLICATE_API_TOKEN) {
    console.error('❌ REPLICATE_API_TOKEN missing in .env');
    console.error('   Get one: https://replicate.com/account/api-tokens');
    process.exit(1);
  }
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('❌ DEEPSEEK_API_KEY missing in .env');
    process.exit(1);
  }
  if (!isCoachVisionConfigured()) {
    console.error('❌ Coach vision not configured');
    process.exit(1);
  }

  console.log('Testing DeepSeek-VL2 (Replicate) + DeepSeek coach polish…');

  const result = await runCoachVisionTurn({
    systemPrompt: 'You are CoachConnect, a supportive fitness coach.',
    messages: [{ role: 'user', content: 'What color is in this progress photo?' }],
    attachments: [{ type: 'image', name: 'test.png', dataUrl: TINY_PNG }],
    logAPIUsage: null,
    targetUid: 'test-user',
  });

  console.log('\n✅ Vision pipeline OK');
  console.log('Source:', result.source);
  console.log('Reply preview:', String(result.text).slice(0, 400));
}

main().catch((e) => {
  console.error('\n❌ Vision test failed:', e?.message || e);
  process.exit(1);
});
