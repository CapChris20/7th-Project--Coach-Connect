const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
});

const BASE = String(process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');

const CLAUDE_KEY = String(
  process.env.EXPO_PUBLIC_CLAUDE_API_KEY ||
    process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ||
    ''
).trim();

const DEEPSEEK_KEY = String(
  process.env.DEEPSEEK_API_KEY ||
    process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY ||
    ''
).trim();

const CLAUDE_MODEL = String(
  process.env.EXPO_PUBLIC_CLAUDE_MODEL ||
    process.env.EXPO_PUBLIC_ANTHROPIC_MODEL ||
    process.env.CLAUDE_MODEL ||
    process.env.ANTHROPIC_MODEL ||
    'claude-sonnet-4-6'
).trim();

function now() {
  return new Date().toISOString();
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

    return {
      ok: res.ok,
      status: res.status,
      ms: Date.now() - started,
      json,
      raw: json ? null : text,
    };
  } catch (e) {
    return {
      ok: false,
      status: null,
      ms: Date.now() - started,
      error: e?.message || String(e),
    };
  }
}

async function getJson(url, timeoutMs = 30_000) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    });

    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (_) {}

    return {
      ok: res.ok,
      status: res.status,
      ms: Date.now() - started,
      json,
      raw: json ? null : text,
    };
  } catch (e) {
    return {
      ok: false,
      status: null,
      ms: Date.now() - started,
      error: e?.message || String(e),
    };
  }
}

async function callClaudeWorkoutDirect(prompt, timeoutMs = 60_000) {
  const started = Date.now();
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': CLAUDE_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 8000,
        temperature: 0.7,
        system:
          'You are an expert strength and conditioning coach. Return ONLY JSON, no markdown. ' +
          'The JSON must include: overview, weeklySchedule, days[]. Each day has: day, focus, warmup, estimatedDuration, exercises[].',
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (_) {}

    const replyText =
      json?.content?.find?.((c) => c?.type === 'text')?.text ||
      null;

    return {
      ok: res.ok,
      status: res.status,
      ms: Date.now() - started,
      model: CLAUDE_MODEL,
      reply: replyText,
      raw: replyText ? null : text,
      json,
    };
  } catch (e) {
    return {
      ok: false,
      status: null,
      ms: Date.now() - started,
      error: e?.message || String(e),
    };
  }
}

async function runTest(name, fn) {
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

(async () => {
  console.log(JSON.stringify({ timestamp: now(), base: BASE }, null, 2));

  await runTest('deepseek_ai_coach__POST_/api/ai-coach', async () => {
    if (!DEEPSEEK_KEY) return { ok: false, error: 'Missing EXPO_PUBLIC_DEEPSEEK_API_KEY (or DEEPSEEK_API_KEY) in .env' };
    const url = `${BASE}/api/ai-coach`;
    const payload = {
      messages: [
        { role: 'user', content: "Why am I not losing weight? I'm eating 2000 cal, hitting 160g protein, but sleep is 6h and I missed leg day." },
      ],
      options: { web: 'off' },
    };
    return await postJson(url, { 'x-deepseek-key': DEEPSEEK_KEY }, payload, 30_000);
  });

  await runTest('deepseek_basic_qa__POST_/api/ask', async () => {
    if (!DEEPSEEK_KEY) {
      return { ok: false, error: 'Missing DEEPSEEK_API_KEY in .env' };
    }
    const url = `${BASE}/api/ask`;
    const payload = {
      messages: [
        {
          role: 'user',
          content:
            "Body recomposition while cutting: I'm 180lb at ~20% BF. Should I prioritize cardio or resistance training, and what protein target should I aim for?",
        },
      ],
      userContext: null,
    };
    return await postJson(url, { 'x-deepseek-key': DEEPSEEK_KEY }, payload, 30_000);
  });

  await runTest('claude_workout_plan__DIRECT_anthropic', async () => {
    if (!CLAUDE_KEY) return { ok: false, error: 'Missing EXPO_PUBLIC_CLAUDE_API_KEY (or EXPO_PUBLIC_ANTHROPIC_API_KEY) in .env' };
    const prompt =
      "Generate a complete 7-day personalized workout plan (not coaching tips). " +
      "Male, 185lb, ~18% body fat, training age 3 years, currently PPL, goal: cut to ~12%. " +
      "Include split, exercise selection, sets/reps/RIR, warmups, and progression rules. Return ONLY JSON.";
    return await callClaudeWorkoutDirect(prompt, 60_000);
  });

  await runTest('dashboard_compare__GET_/api/test-deepseek-vs-claude', async () => {
    const url = `${BASE}/api/test-deepseek-vs-claude`;
    return await getJson(url, 120_000);
  });
})();

