#!/usr/bin/env node
/**
 * Live AI Coach audit verification — prompt building + optional authenticated API calls.
 * Run: node scripts/testAiCoachLiveSequence.js
 * Optional env: TEST_USER_ID, TEST_FIREBASE_ID_TOKEN, EXPO_PUBLIC_API_BASE_URL
 */
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ROOT = path.join(__dirname, '..');
const BASE = String(process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const USER_ID = String(process.env.TEST_USER_ID || '4hJJ7QLAMyU72T4BHSiQe33Z0ym1').trim();
const ID_TOKEN = String(process.env.TEST_FIREBASE_ID_TOKEN || '').trim();
const FIREBASE_API_KEY = String(
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_WEB_API_KEY || '',
).trim();
const DEEPSEEK_KEY = String(process.env.DEEPSEEK_API_KEY || process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY || '').trim();

let failed = 0;
let passed = 0;

function pass(name, detail = '') {
  passed += 1;
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  failed += 1;
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ''}`);
}

function assert(name, cond, detail = '') {
  if (cond) pass(name, detail);
  else fail(name, detail);
}

async function postCoach(token, message, options = {}) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  if (DEEPSEEK_KEY) headers['x-deepseek-key'] = DEEPSEEK_KEY;

  const res = await fetch(`${BASE}/api/ai-coach`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      userId: USER_ID,
      messages: [{ role: 'user', content: message }],
      options: { web: 'off', includePersonalData: true, ...options },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (_) {}
  return { ok: res.ok, status: res.status, json, raw: json ? null : text };
}

function looksLikeHallucinatedSteps(text) {
  const t = String(text || '');
  // Invented step counts often use round numbers with confident phrasing
  if (/\b(you(?:'ve| have)? (?:walked|got|logged|averaged))\s+(?:about\s+)?[\d,]+\s*steps/i.test(t)) return true;
  if (/\b[\d,]+\s*steps\s*(?:this week|per day|daily|on average)/i.test(t) && !/don'?t have|not logged|no step|no data/i.test(t)) {
    return true;
  }
  return false;
}

async function testPromptBuilding() {
  console.log('\n── Prompt building (Firebase Admin + weekly context) ──\n');

  const { tryInitializeFirebaseAdmin } = require(path.join(ROOT, 'server/lib/initFirebaseAdmin'));
  const init = tryInitializeFirebaseAdmin();
  if (!init.ok) {
    fail('Firebase Admin init', 'Check service account credentials');
    return;
  }
  const admin = require('firebase-admin');

  const { getWeeklyContext } = require(path.join(ROOT, 'server/getWeeklyContext'));
  let weekly;
  try {
    weekly = await getWeeklyContext(USER_ID);
  } catch (e) {
    fail('getWeeklyContext', e?.message || String(e));
    return;
  }
  pass('getWeeklyContext', `userId=${USER_ID.slice(0, 8)}…`);

  const wc = weekly || {};
  const wellness = wc.wellnessAnalysis;
  const hasFood = (wc.nutritionAnalysis?.dailyBreakdown || []).length > 0;
  const hasSteps = wellness?.steps?.avgDaily != null;
  const hasSleep = wc.sleepAnalysis?.avgHours != null && wc.sleepAnalysis.avgHours > 0;

  console.log('  Context snapshot:', {
    daysLogged: wc.nutritionAnalysis?.daysLogged ?? 0,
    hasFood,
    hasSteps,
    hasSleep,
    avgRPE: wc.workoutAnalysis?.avgRPE,
    streak: wc.streakData?.currentStreak,
    wellnessKeys: wellness ? Object.keys(wellness) : [],
  });

  assert('Weekly context: nutritionAnalysis present', Boolean(wc.nutritionAnalysis));
  assert('Weekly context: wellnessAnalysis present', Boolean(wellness));
  assert('DATA INTEGRITY rule available', (() => {
    const { COACH_DATA_INTEGRITY_RULE } = require(path.join(ROOT, 'server/lib/coachVoice.js'));
    return COACH_DATA_INTEGRITY_RULE.includes('Never estimate, approximate, or invent numbers');
  })());

  // Mirror buildCoachPromptForUser mapping (minimal)
  const weeklyContext = {
    age: wc?.user?.age ?? '?',
    weight: wc?.user?.weight ?? '?',
    height: wc?.user?.height ?? '?',
    goal: wc?.user?.goal ?? 'unknown',
    trainingLevel: wc?.user?.trainingLevel ?? 'unknown',
    targetCal: wc?.macroTargets?.calories ?? 0,
    targetP: wc?.macroTargets?.protein ?? 0,
    targetC: wc?.macroTargets?.carbs ?? 0,
    targetF: wc?.macroTargets?.fat ?? 0,
    avgCal: Math.round(Number(wc?.nutritionAnalysis?.avgDailyCalories) || 0),
    avgP: Math.round(Number(wc?.nutritionAnalysis?.avgProtein) || 0),
    avgC: Math.round(Number(wc?.nutritionAnalysis?.avgCarbs) || 0),
    avgF: Math.round(Number(wc?.nutritionAnalysis?.avgFat) || 0),
    consistency: Number(wc?.nutritionAnalysis?.consistencyScore) || 0,
    daysLogged: Number(wc?.nutritionAnalysis?.daysLogged) || 0,
    dailyBreakdown: wc?.nutritionAnalysis?.dailyBreakdown || [],
    sessions: Number(wc?.workoutAnalysis?.sessionsLogged) || 0,
    sessionDates: wc?.workoutAnalysis?.sessionDates || [],
    totalVol: Math.round(Number(wc?.workoutAnalysis?.totalVolume) || 0),
    avgRPE: wc?.workoutAnalysis?.avgRPE ?? null,
    avgHours: Math.round((Number(wc?.sleepAnalysis?.avgHours) || 0) * 10) / 10,
    sleepQuality: wc?.sleepAnalysis?.quality || 'unknown',
    isDepleted: wc?.sleepAnalysis?.isDepleted === true,
    weightLog: wc?.weightLog || [],
    streak: Number(wc?.streakData?.currentStreak) || 0,
    weightTrend: wc?.weightTrend || 'unknown',
    volumeTrend: wc?.workoutAnalysis?.volumeTrend || 'stable',
    wellness: wc?.wellnessAnalysis || null,
  };

  // Load buildWeeklyContextSystemPrompt from server — eval via require won't work (not exported).
  // Use index.js helper by reading the function indirectly through a tiny inline copy check:
  const indexSrc = require('fs').readFileSync(path.join(ROOT, 'server/index.js'), 'utf8');
  assert('Weekly prompt includes ACTIVITY & WELLNESS formatter', indexSrc.includes('ACTIVITY & WELLNESS (last 7 days)'));

  if (hasSteps) {
    assert('Wellness: step avg populated', wellness.steps.avgDaily > 0);
  } else {
    pass('Wellness: no step data (coach should say not logged)', 'expected when user has no step_logs');
  }
}

async function testLiveApi() {
  console.log('\n── Live API coach requests ──\n');

  try {
    const health = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(5000) });
    if (!health.ok) {
      fail('Server health', `status ${health.status}`);
      return;
    }
    pass('Server health', BASE);
  } catch (e) {
    fail('Server health', e.message);
    return;
  }

  if (!DEEPSEEK_KEY) {
    pass('Live API: skipped', 'Missing DEEPSEEK_API_KEY');
    return;
  }

  let token = ID_TOKEN;
  if (!token) {
    if (!FIREBASE_API_KEY) {
      pass('Live API: skipped', 'Set TEST_FIREBASE_ID_TOKEN or EXPO_PUBLIC_FIREBASE_API_KEY');
      return;
    }
    const { tryInitializeFirebaseAdmin } = require(path.join(ROOT, 'server/lib/initFirebaseAdmin'));
    tryInitializeFirebaseAdmin();
    const admin = require('firebase-admin');
    try {
      const custom = await admin.auth().createCustomToken(USER_ID);
      const tokRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: custom, returnSecureToken: true }),
        },
      );
      const tokJson = await tokRes.json();
      if (!tokRes.ok) throw new Error(tokJson.error?.message || 'Token exchange failed');
      token = tokJson.idToken;
      pass('Firebase ID token obtained via custom token');
    } catch (e) {
      fail('Firebase auth', e.message);
      return;
    }
  }

  const scenarios = [
    {
      name: '1. "what did I log today"',
      message: 'what did I log today',
      check: (r) => {
        assert('Q1: got reply', Boolean(r.json?.reply?.length > 5));
        assert('Q1: used weekly context', r.json?.usedWeeklyContext === true);
        const reply = r.json?.reply || '';
        const hallucination = /\b(you didn'?t log anything but|you ate about \d+ cal)\b/i.test(reply) &&
          r.json?.dailyFoodLogDays === 0;
        if (hallucination) fail('Q1: no invented food when log empty');
        else pass('Q1: reply OK', reply.slice(0, 120).replace(/\n/g, ' '));
      },
    },
    {
      name: '2. "how many steps did I get this week"',
      message: 'how many steps did I get this week',
      check: (r) => {
        assert('Q2: got reply', Boolean(r.json?.reply?.length > 5));
        const reply = r.json?.reply || '';
        if (looksLikeHallucinatedSteps(reply)) {
          fail('Q2: reply may hallucinate steps', reply.slice(0, 150));
        } else {
          pass('Q2: no obvious step hallucination', reply.slice(0, 120).replace(/\n/g, ' '));
        }
      },
    },
    {
      name: '3. "how did I sleep this week"',
      message: 'how did I sleep this week',
      check: (r) => {
        assert('Q3: got reply', Boolean(r.json?.reply?.length > 5));
        pass('Q3: reply preview', (r.json?.reply || '').slice(0, 120).replace(/\n/g, ' '));
      },
    },
    {
      name: '4. "log my sleep 8 hours" (tool, no logger crash)',
      message: 'log my sleep 8 hours last night',
      check: (r) => {
        assert('Q4: API did not 500', r.status !== 500, `status ${r.status}`);
        const tools = r.json?.toolCalls || [];
        const hasLogSleep = tools.some((t) => t.name === 'logSleep');
        assert('Q4: logSleep tool proposed', hasLogSleep, tools.map((t) => t.name).join(', ') || 'none');
      },
    },
  ];

  for (const s of scenarios) {
    console.log(`\n  → ${s.name}`);
    const r = await postCoach(token, s.message);
    if (!r.ok) {
      fail(s.name, `HTTP ${r.status}: ${(r.raw || r.json?.error || '').slice(0, 200)}`);
      continue;
    }
    s.check(r);
  }
}

(async function main() {
  console.log('AI Coach live verification sequence\n');
  console.log({ base: BASE, testUserId: USER_ID ? `${USER_ID.slice(0, 8)}…` : null, hasToken: Boolean(ID_TOKEN) });

  await testPromptBuilding();
  await testLiveApi();

  console.log('\n────────────────────────────────────────');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log('Live sequence complete.');
})();
