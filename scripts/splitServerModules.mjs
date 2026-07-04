#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = path.join(import.meta.dirname, '..');

fs.writeFileSync(
  path.join(root, 'server/lib/serverCommon.js'),
  `const admin = require('firebase-admin');

function isoDateKey(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString().slice(0, 10);
}

function serverTs() {
  return admin.apps.length
    ? admin.firestore.FieldValue.serverTimestamp()
    : new Date();
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch (_) {
    return null;
  }
}

function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

module.exports = { isoDateKey, serverTs, safeJsonParse, fetchWithTimeout };
`,
);

const executeBody = fs.readFileSync(path.join(root, 'server/lib/coachTools/executeTool.js'), 'utf8');
if (!executeBody.includes('module.exports')) {
  fs.writeFileSync(
    path.join(root, 'server/lib/coachTools/executeTool.js'),
    `const admin = require('firebase-admin');
const { randomUUID } = require('crypto');
const { isoDateKey, serverTs } = require('../serverCommon');
const { mergeUserDailyMetrics } = require('../dailyMetricsServer');
const { executeDeleteLogServer } = require('../coachDeleteLog');
const { parseBookSessionFields, formatSessionLabel } = require('../bookSessionParse');
const { fetchOpenWorkoutPlanPayload } = require('../coachExtendedContext');
const logger = require('../logger');

${executeBody}

module.exports = { executeTool };
`,
  );
}

const promptBody = fs.readFileSync(path.join(root, 'server/lib/coachPrompt/coachPromptBuilders.js'), 'utf8');
if (!promptBody.includes('module.exports')) {
  fs.writeFileSync(
    path.join(root, 'server/lib/coachPrompt/coachPromptBuilders.js'),
    `const { COACH_DATA_INTEGRITY_RULE } = require('../coachVoice');

${promptBody}

module.exports = {
  buildCoachSystemPrompt,
  formatMonthlyNutritionLines,
  formatWorkoutMonthlyLines,
  formatProgressCycleBlock,
  formatDailyNutritionLines,
  formatWeightLogLines,
  formatActivityWellnessSection,
  formatWorkoutPlanSection,
  formatNotesAndFilesSection,
  buildWeeklyContextSystemPrompt,
};
`,
  );
}

const llmBody = fs.readFileSync(path.join(root, 'server/lib/llm/coachLlmProviders.js'), 'utf8');
const llmCore = llmBody.includes('module.exports')
  ? llmBody
  : `const admin = require('firebase-admin');
const axios = require('axios');
const { randomUUID } = require('crypto');
const { isoDateKey, serverTs } = require('../serverCommon');
const { estimateCost, isWithinMonthlyLimit } = require('../../config/apiCosts');
const { isAiCoachLimitsEnforced } = require('../aiCoachRateLimit');
const { resolveAiCoachDailyLimit } = require('../aiCoachRateLimit');
const { serperOrganicSearch } = require('../serperWebSearch');
const { stripNotificationEmoji: pushStripNotificationEmoji } = require('../../pushHelpers');
const logger = require('../logger');

function resolveDeepSeekKey() {
  return process.env.DEEPSEEK_API_KEY || null;
}
function resolveAnthropicKey() {
  return process.env.ANTHROPIC_API_KEY || null;
}
function resolvePerplexityKey() {
  return process.env.PERPLEXITY_API_KEY || process.env.PPLX_API_KEY || null;
}

${llmBody}

const WEEKLY_FETCH_FAILURE_NOTE =
  '\\n\\nNOTE: Weekly data failed to load for this request. Answer from profile only. Do not imply you have access to logs, food data, sleep, steps, or workout history for this conversation.';

module.exports = {
  resolveDeepSeekKey,
  resolveAnthropicKey,
  resolvePerplexityKey,
  callPerplexity,
  callDeepSeek,
  callClaude,
  logAPIUsage,
  checkMonthlyApiBudget,
  enforceDailyMessageLimit,
  detectFatigue,
  sendExpoPushSingle,
  createAlert,
  coachMessagesForLlm,
  normalizeCoachMessages,
  normalizeWebSources,
  extractPerplexityWebSources,
  fetchSerperCoachSearch,
  augmentCoachPromptWithWebSearch,
  callDeepSeekCoach,
  callDeepSeekChat,
  callClaudeCoach,
  buildPerplexityWebMessages,
  callPerplexityCoach,
  WEEKLY_FETCH_FAILURE_NOTE,
};
`;
fs.writeFileSync(path.join(root, 'server/lib/llm/coachLlmProviders.js'), llmCore);

const coachBody = fs.readFileSync(path.join(root, 'server/lib/aiCoach/coachRequestHandler.js'), 'utf8');
const coachCore = coachBody.includes('module.exports')
  ? coachBody
  : `const admin = require('firebase-admin');
const { getWeeklyContext } = require('../../getWeeklyContext');
const { shouldIncludeWeeklyContextInCoachPrompt } = require('../coachPersonalDataRouting');
const { fetchWorkoutPlanContext } = require('../coachExtendedContext');
const {
  shouldInvokeWebSearch,
  WEB_SEARCH_SYSTEM_APPEND,
  WEB_SOURCE_QUOTE_SYSTEM_APPEND,
  THREAD_CLARIFY_SYSTEM_APPEND,
  NO_WEB_SEARCH_HONESTY_APPEND,
  WEB_SEARCH_FAILED_APPEND,
  messagesRequestWebSearch,
  buildWebSearchQuery,
  stripWebSearchPrefix,
  stripFakeWebSearchClaims,
  userRequestedWebSearchTurn,
  isWebSourceQuoteFollowUp,
  isWebAnswerFollowUp,
  findPriorSubstantiveUserQuestion,
  resolveCoachWebSearchGate,
  filterFitnessWebSources,
} = require('../coachWebSearch');
const { mergeCoachToolCalls } = require('../inferCoachToolCall');
const { filterValidCoachToolProposals } = require('../../../src/ai-coach/server-logic/tools/shouldShowCoachAction');
const { sanitizeCoachImageAttachments, runCoachVisionTurn } = require('../coachVision');
const { parseCoachToolCalls, stripCoachToolJsonFromReply: stripToolJsonFromReply } = require('../../../src/ai-coach/tools/parseCoachToolCalls');
const {
  buildCoachSystemPrompt,
  buildWeeklyContextSystemPrompt,
  formatWorkoutPlanSection,
} = require('../coachPrompt/coachPromptBuilders');
const {
  resolveDeepSeekKey,
  resolvePerplexityKey,
  callDeepSeek,
  callPerplexityCoach,
  callPerplexity,
  coachMessagesForLlm,
  detectFatigue,
  enforceDailyMessageLimit,
  logAPIUsage,
  augmentCoachPromptWithWebSearch,
  WEEKLY_FETCH_FAILURE_NOTE,
  normalizeCoachMessages,
} = require('../llm/coachLlmProviders');
const { resolveAiCoachDailyLimit, isAiCoachLimitsEnforced } = require('../aiCoachRateLimit');
const logger = require('../logger');

function isAiCoachTestRequest(req) {
  if (process.env.NODE_ENV === 'production') return false;
  const header =
    req?.headers?.['x-ai-coach-test-suite'] ||
    req?.headers?.['X-AI-Coach-Test-Suite'] ||
    '';
  return String(header) === '1' || req?.body?.options?.testSuite === true;
}

function isAiCoachTestOrDev(req) {
  return (
    isAiCoachTestRequest(req) ||
    process.env.AI_COACH_UNLIMITED === '1' ||
    process.env.NODE_ENV !== 'production' ||
    !isAiCoachLimitsEnforced()
  );
}

function parseToolCalls(aiResponse) {
  return parseCoachToolCalls(aiResponse);
}

function resolveCoachToolCalls(aiText, userMessage, weeklyContext) {
  return filterValidCoachToolProposals(
    mergeCoachToolCalls(aiText, userMessage, weeklyContext || {}),
    userMessage,
  );
}

${coachBody}

module.exports = {
  buildCoachPromptForUser,
  runCoachWebSearch,
  handleAICoachRequest,
  parseToolCalls,
  stripToolJsonFromReply,
  isAiCoachTestRequest,
  isAiCoachTestOrDev,
  isAiCoachLimitsEnforced,
};
`;
fs.writeFileSync(path.join(root, 'server/lib/aiCoach/coachRequestHandler.js'), coachCore);

const reminderBody = fs.readFileSync(path.join(root, 'server/jobs/reminderJobs.js'), 'utf8');
if (!reminderBody.includes('module.exports')) {
  fs.writeFileSync(
    path.join(root, 'server/jobs/reminderJobs.js'),
    `const admin = require('firebase-admin');
const { COPY: PUSH_COPY, pickRandom: pushPickRandom, sub: pushSub, localDateTimeInIANA, hasDashboardWorkoutLog, minutesDiffClock } = require('../pushHelpers');
const { sendExpoPushSingle } = require('../lib/llm/coachLlmProviders');
const logger = require('../lib/logger');

function utcDayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

let _nutritionReminderUtcDaySent = null;

${reminderBody}

module.exports = {
  runSessionSoonReminderJob,
  runNutritionReminderPushJob,
  runWorkoutReminderJob,
  utcDayKey,
};
`,
  );
}

const indexPath = path.join(root, 'server/index.js');
const lines = fs.readFileSync(indexPath, 'utf8').split('\n');

const findLine = (pred, start = 0) => lines.findIndex((l, i) => i >= start && pred(l));

const ranges = [];
const isoStart = findLine((l) => l.startsWith('function isoDateKey'));
const fetchEnd = findLine((l) => l.includes('clearTimeout(timer)'));
if (isoStart >= 0 && fetchEnd >= isoStart) ranges.push([isoStart, fetchEnd]);

const aiTestStart = findLine((l) => l.startsWith('function isAiCoachTestRequest('));
const aiTestEnd = findLine((l) => l.startsWith('function isAiCoachTestOrDev'));
if (aiTestStart >= 0 && aiTestEnd > aiTestStart) ranges.push([aiTestStart, aiTestEnd]);

const resolveStart = findLine((l) => l.startsWith('function resolveDeepSeekKey'));
const resolveEnd = findLine((l) => l.startsWith('function resolvePerplexityKey'));
if (resolveStart >= 0 && resolveEnd >= resolveStart) ranges.push([resolveStart, resolveEnd + 2]);

const promptStart = findLine((l) => l.startsWith('function buildCoachSystemPrompt'));
const handlerEnd = findLine((l) => l.includes('missingKeys: missing,'));
if (promptStart >= 0 && handlerEnd >= promptStart) ranges.push([promptStart, handlerEnd + 1]);

const utcStart = findLine((l) => l.startsWith('function utcDayKey'));
const reminderEnd = findLine((l) => l.startsWith('registerApiHealthRoute'));
if (utcStart >= 0 && reminderEnd > utcStart) ranges.push([utcStart, reminderEnd - 1]);

const removeSet = new Set();
for (const [a, b] of ranges) {
  for (let i = a; i <= b; i++) removeSet.add(i);
}

const moduleImports = `
const { isoDateKey, serverTs, safeJsonParse, fetchWithTimeout } = require('./lib/serverCommon');
const { executeTool } = require('./lib/coachTools/executeTool');
const {
  resolveDeepSeekKey,
  resolveAnthropicKey,
  resolvePerplexityKey,
  callDeepSeekChat,
  callClaudeCoach,
  callDeepSeekCoach,
  checkMonthlyApiBudget,
  detectFatigue,
  sendExpoPushSingle,
  createAlert,
} = require('./lib/llm/coachLlmProviders');
const {
  handleAICoachRequest,
  parseToolCalls,
  stripToolJsonFromReply,
  isAiCoachTestRequest,
  isAiCoachTestOrDev,
  isAiCoachLimitsEnforced,
} = require('./lib/aiCoach/coachRequestHandler');
const {
  runSessionSoonReminderJob,
  runNutritionReminderPushJob,
  runWorkoutReminderJob,
} = require('./jobs/reminderJobs');
`;

const newLines = [];
let inserted = false;
for (let i = 0; i < lines.length; i++) {
  if (removeSet.has(i)) continue;
  if (lines[i].includes('parseCoachToolCalls') && lines[i].includes('stripCoachToolJsonFromReply')) continue;
  newLines.push(lines[i]);
  if (!inserted && lines[i].includes("require('./lib/coachVision')")) {
    newLines.push(moduleImports);
    inserted = true;
  }
}

fs.writeFileSync(indexPath, newLines.join('\n'));
console.log('index.js:', lines.length, '->', newLines.length, 'lines (removed', removeSet.size, ')');
