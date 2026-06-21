#!/usr/bin/env node
/**
 * Validates client-side AI Coach API routing fixes (no network required).
 * Run: node scripts/testAiCoachClientApiRouting.js
 */
const fs = require('fs');
const path = require('path');
const { ROOT, PRODUCTION_API_BASE_URL, createTally } = require('./lib/aiCoachTestHelpers');

const {
  shouldForceDedicatedWebSearchRoute,
  shouldInvokeWebSearch,
  messagesRequestWebSearch,
  shouldUseWebAuto,
  isWebAnswerFollowUp,
} = require('../server/lib/coachWebSearch');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function extractFunctionBody(src, fnName) {
  const re = new RegExp(`export function ${fnName}\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const m = src.match(re);
  return m ? m[1] : '';
}

(async function main() {
  const t = createTally();
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(' AI COACH CLIENT API ROUTING');
  console.log('═══════════════════════════════════════════════════════════\n');

  const baseUrlSrc = read('src/shared/api/baseUrl.js');
  const serviceSrc = read('src/ai-coach/server-logic/chat-api/sendCoachMessageToServer.js');

  t.assert('getAICoachApiBases pushes PRODUCTION first', /push\(PRODUCTION_API_BASE_URL\)/.test(baseUrlSrc));
  t.assert(
    'getAICoachApiBases documents Cloud Run priority',
    baseUrlSrc.includes('Cloud Run first') || baseUrlSrc.includes('needs Serper/Perplexity'),
  );
  t.assert('postAICoach retries failed web search on next base', serviceSrc.includes('shouldRetryWebSearchOnNextBase'));
  t.assert('postAICoach uses dedicated web-search path', serviceSrc.includes('/api/ai-coach/web-search'));
  t.assert('postAICoach imports isCloudHostedApiBase', serviceSrc.includes('isCloudHostedApiBase'));

  const proteinMsg = 'Search the web: what does research say about protein intake for lifters?';
  t.assert('shouldUseWebAuto(protein query)', shouldUseWebAuto(proteinMsg));
  t.assert('shouldInvokeWebSearch(protein query, on)', shouldInvokeWebSearch('on', proteinMsg));
  t.assert(
    'shouldForceDedicatedWebSearchRoute(protein query)',
    shouldForceDedicatedWebSearchRoute(proteinMsg),
  );
  t.assert(
    'messagesRequestWebSearch(protein query)',
    messagesRequestWebSearch([{ role: 'user', content: proteinMsg }], proteinMsg),
  );

  const personalMsg = 'How much protein did I eat today?';
  t.assert('personal data does NOT use web auto', !shouldUseWebAuto(personalMsg));
  t.assert('personal data does NOT invoke web', !shouldInvokeWebSearch('auto', personalMsg));

  const followUp = 'What sources did you use for that?';
  const thread = [
    { role: 'user', content: proteinMsg },
    { role: 'assistant', content: 'Research suggests about 1.6–2.2 g/kg for lifters looking to maximize muscle protein synthesis.' },
    { role: 'user', content: followUp },
  ];
  t.assert('thread source follow-up is answer follow-up', isWebAnswerFollowUp(followUp, thread));
  t.assert('thread source follow-up does NOT re-search', !messagesRequestWebSearch(thread, followUp));

  // Simulate client base order on a physical device (Metro LAN host present)
  const getAICoachBody = extractFunctionBody(baseUrlSrc, 'getAICoachApiBases');
  t.assert('getAICoachApiBases is custom (not one-liner to getResilientApiBases)', getAICoachBody.length > 80);

  console.log('\n  Expected production URL:', PRODUCTION_API_BASE_URL);

  const failed = t.summary('Client API routing');
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
