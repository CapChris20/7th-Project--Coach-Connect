#!/usr/bin/env node
/**
 * Coach vision gap-fix tests: grounding prompts + attachment sanitization.
 * Optional live Replicate smoke: node scripts/testCoachVisionGapFixes.js --live
 *
 * Run (static only): node scripts/testCoachVisionGapFixes.js
 */
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ROOT = path.join(__dirname, '..');
const LIVE = process.argv.includes('--live');

let passed = 0;
let failed = 0;

function assert(name, cond, detail = '') {
  if (cond) {
    passed += 1;
    console.log(`✅ PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.log(`❌ FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

(function testStaticVisionGrounding() {
  const src = read('server/lib/coachVision.js');
  assert('pollReplicatePrediction helper present', src.includes('function pollReplicatePrediction'));
  assert('extractReplicateOutput helper present', src.includes('function extractReplicateOutput'));
  assert('honest "What I can see" in system addendum', /What I can see/i.test(src));
  assert('no "Never say you cannot see" bluff', !/Never say you cannot see/i.test(src));
  assert('polish prompt forbids inventing gym scenes', /Never invent people, gym scenes/i.test(src));
})();

(function testSanitizeAttachments() {
  const { sanitizeCoachImageAttachments } = require(path.join(ROOT, 'server/lib/coachVision.js'));

  const tinyPng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  const kept = sanitizeCoachImageAttachments([{ type: 'image', name: 'a.png', dataUrl: tinyPng }]);
  assert('keeps valid PNG data URL', kept.length === 1);

  const dropped = sanitizeCoachImageAttachments([{ type: 'image', name: 'bad.txt', dataUrl: 'not-a-data-url' }]);
  assert('drops invalid attachment', dropped.length === 0);

  const capped = sanitizeCoachImageAttachments(
    Array.from({ length: 5 }, (_, i) => ({ type: 'image', name: `${i}.png`, dataUrl: tinyPng })),
  );
  assert('caps attachments at 2', capped.length === 2);
})();

async function testLiveVision() {
  if (!LIVE) {
    console.log('\n⏭️  SKIP  Live Replicate vision (--live not passed)');
    return;
  }

  if (!process.env.REPLICATE_API_TOKEN || !process.env.DEEPSEEK_API_KEY) {
    assert('live vision skipped — missing REPLICATE_API_TOKEN or DEEPSEEK_API_KEY', false);
    return;
  }

  const { runCoachVisionTurn, isCoachVisionConfigured } = require(path.join(ROOT, 'server/lib/coachVision.js'));
  assert('vision configured for live test', isCoachVisionConfigured());

  const tinyPng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  console.log('\nRunning live vision turn (may take up to ~2 min)…');
  const result = await runCoachVisionTurn({
    systemPrompt: 'You are CoachConnect, a supportive fitness coach.',
    messages: [{ role: 'user', content: 'What do you see in this photo?' }],
    attachments: [{ type: 'image', name: 'test.png', dataUrl: tinyPng }],
    logAPIUsage: null,
    targetUid: 'gap-fix-test-user',
  });

  const text = String(result?.text || '');
  assert('live vision returns text', text.length > 10, text.slice(0, 80));
  assert(
    'live reply uses grounded opener or honest limitation',
    /What I can see/i.test(text) || /cannot|couldn't|resend|JPEG|PNG/i.test(text),
    text.slice(0, 120),
  );
}

(async function main() {
  console.log('Coach vision gap-fix tests\n');
  await testLiveVision();

  console.log('\n────────────────────────────────────────');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log('Coach vision gap-fix tests passed.');
})().catch((e) => {
  console.error('\nUnexpected error:', e?.message || e);
  process.exit(1);
});
