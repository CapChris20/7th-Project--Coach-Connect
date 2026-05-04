const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
});

const BASE = String(process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const USER_ID = String(process.env.TEST_USER_ID || '').trim();

const DEEPSEEK_KEY = String(process.env.DEEPSEEK_API_KEY || process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY || '').trim();
const PERPLEXITY_KEY = String(process.env.PERPLEXITY_API_KEY || process.env.PPLX_API_KEY || '').trim();

function now() {
  return new Date().toISOString();
}

function fail(msg) {
  return { ok: false, error: msg };
}

async function getJson(url, timeoutMs = 30_000) {
  const started = Date.now();
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(timeoutMs) });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (_) {}
    return { ok: res.ok, status: res.status, ms: Date.now() - started, json, raw: json ? null : text };
  } catch (e) {
    return { ok: false, status: null, ms: Date.now() - started, error: e?.message || String(e) };
  }
}

async function postJson(url, headers, body, timeoutMs = 30_000) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(headers || {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (_) {}
    return { ok: res.ok, status: res.status, ms: Date.now() - started, json, raw: json ? null : text };
  } catch (e) {
    return { ok: false, status: null, ms: Date.now() - started, error: e?.message || String(e) };
  }
}

async function run(name, fn) {
  const startedAt = now();
  console.log(`[${startedAt}] TEST_START ${name}`);
  let out;
  try {
    out = await fn();
  } catch (e) {
    out = { ok: false, error: e?.message || String(e) };
  }
  console.log(`[${now()}] TEST_RESULT ${name}`);
  console.log(JSON.stringify(out, null, 2));
  return out;
}

function assertIncludes(haystack, needle, label) {
  const h = String(haystack || '');
  if (!h.includes(needle)) {
    throw new Error(`ASSERT_FAILED ${label}: missing substring "${needle}"`);
  }
}

(async () => {
  console.log(JSON.stringify({ timestamp: now(), base: BASE, testUserId: USER_ID || null }, null, 2));

  await run('health__GET_/health', async () => {
    return await getJson(`${BASE}/health`, 15_000);
  });

  await run('system_prompts__GET_/api/ai-coach/debug/prompts', async () => {
    const sampleProfile = { name: 'Test User', goal: 'cut', trainingLevel: 'intermediate' };
    const url =
      `${BASE}/api/ai-coach/debug/prompts?userId=${encodeURIComponent(USER_ID)}&userProfile=${encodeURIComponent(JSON.stringify(sampleProfile))}`;
    const res = await getJson(url, 30_000);
    if (!res.ok) return res;

    const basePrompt = res.json?.basePrompt || '';
    assertIncludes(basePrompt, 'You are CoachConnect AI, a premium fitness and nutrition coach.', 'basePrompt header');
    assertIncludes(basePrompt, 'HARD RULES (DO NOT BREAK):', 'basePrompt rules');
    assertIncludes(basePrompt, '"I\'m your fitness coach — I can only help with fitness and nutrition. What would you like to work on today?"', 'basePrompt refusal');
    assertIncludes(basePrompt, '\n\nUSER PROFILE:\n', 'basePrompt profile append');

    if (USER_ID) {
      const weeklyPrompt = res.json?.weeklyPrompt || '';
      if (!weeklyPrompt) return fail('weeklyPrompt missing (set TEST_USER_ID to validate weekly prompt)');
      assertIncludes(weeklyPrompt, 'CLIENT SNAPSHOT:', 'weeklyPrompt snapshot');
      assertIncludes(weeklyPrompt, "THIS WEEK'S ACTUAL DATA (not assumptions):", 'weeklyPrompt data section');
    }

    return { ok: true };
  });

  await run('tool_parsing__POST_/api/ai-coach/debug/parse-toolcalls', async () => {
    const fakeAiText =
      `Here’s the plan.\n` +
      `This would require your confirmation\n` +
      `{"toolCalls":[{"name":"adjustMacroTargets","params":{"calories":2200,"protein":180,"carbs":200,"fat":60},"reasoning":"Increase protein slightly and keep calories controlled."}]}`;
    const res = await postJson(`${BASE}/api/ai-coach/debug/parse-toolcalls`, null, { text: fakeAiText }, 10_000);
    if (!res.ok) return res;
    if (!Array.isArray(res.json?.toolCalls) || res.json.toolCalls.length !== 1) {
      return fail('Expected exactly 1 parsed toolCall');
    }
    if (String(res.json?.reply || '').includes('"toolCalls"')) {
      return fail('Expected reply to be stripped of toolCalls JSON');
    }
    return { ok: true, parsed: res.json.toolCalls[0] };
  });

  await run('weekly_context__GET_/api/weekly-context/:userId', async () => {
    if (!USER_ID) return { ok: true, skipped: true, reason: 'Set TEST_USER_ID to validate weekly context' };
    return await getJson(`${BASE}/api/weekly-context/${encodeURIComponent(USER_ID)}`, 30_000);
  });

  await run('fatigue_detection__GET_/api/fatigue/:userId', async () => {
    if (!USER_ID) return { ok: true, skipped: true, reason: 'Set TEST_USER_ID to validate fatigue endpoint' };
    return await getJson(`${BASE}/api/fatigue/${encodeURIComponent(USER_ID)}`, 30_000);
  });

  await run('ai_coach_deepseek__POST_/api/ai-coach', async () => {
    if (!DEEPSEEK_KEY) return { ok: true, skipped: true, reason: 'Missing DEEPSEEK_API_KEY' };
    const payload = {
      userId: USER_ID || undefined,
      messages: [{ role: 'user', content: "I'm cutting. Based on my week, what should I focus on next?" }],
      options: { web: 'off' },
    };
    const res = await postJson(`${BASE}/api/ai-coach`, { 'x-deepseek-key': DEEPSEEK_KEY }, payload, 45_000);
    if (!res.ok) return res;
    if (!res.json?.reply || res.json.reply.length < 10) return fail('Expected non-empty reply');
    if (res.json?.source !== 'deepseek') return fail(`Expected source=deepseek, got ${res.json?.source}`);
    return { ok: true, source: res.json.source, usedWeeklyContext: res.json.usedWeeklyContext, toolCalls: res.json.toolCalls || [] };
  });

  await run('perplexity_routing__POST_/api/ai-coach', async () => {
    if (!PERPLEXITY_KEY) return { ok: true, skipped: true, reason: 'Missing PERPLEXITY_API_KEY' };
    const payload = {
      userId: USER_ID || undefined,
      messages: [{ role: 'user', content: 'Quick question: TRT dosing protocols and hCG—can you search the web for clinical evidence?' }],
      options: { web: 'auto' },
    };
    const res = await postJson(`${BASE}/api/ai-coach`, { 'x-perplexity-key': PERPLEXITY_KEY }, payload, 45_000);
    if (!res.ok) return res;
    if (res.json?.source !== 'perplexity') return fail(`Expected source=perplexity, got ${res.json?.source}`);
    if (res.json?.searchedWeb !== true) return fail('Expected searchedWeb=true');
    return { ok: true, source: res.json.source, searchedWeb: res.json.searchedWeb };
  });

  await run('execute_tool_adjustMacroTargets__POST_/api/ai-coach/execute-tool', async () => {
    if (!USER_ID) return { ok: true, skipped: true, reason: 'Set TEST_USER_ID to test tool execution writes' };
    const payload = {
      userId: USER_ID,
      confirmed: true,
      toolCall: {
        name: 'adjustMacroTargets',
        params: { calories: 2200, protein: 180, carbs: 200, fat: 60 },
        reasoning: 'Test write from script',
      },
    };
    return await postJson(`${BASE}/api/ai-coach/execute-tool`, null, payload, 30_000);
  });
})();

