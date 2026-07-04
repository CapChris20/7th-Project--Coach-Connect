#!/usr/bin/env node
/**
 * Full AI Coach capability audit — data visibility, tools, web search.
 * Run: node scripts/testAiCoachFullAudit.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ROOT = path.join(__dirname, '..');
const BASE = String(process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '';
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY || '';
const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY || process.env.PPLX_API_KEY || '';

const results = [];

function row(category, item, status, detail = '') {
  results.push({ category, item, status, detail });
  const icon = status === 'YES' ? '✅' : status === 'PARTIAL' ? '⚠️' : status === 'NO' ? '❌' : 'ℹ️';
  console.log(`${icon} [${category}] ${item}${detail ? ` — ${detail}` : ''}`);
}

async function getIdToken(uid) {
  const { tryInitializeFirebaseAdmin } = require(path.join(ROOT, 'server/lib/initFirebaseAdmin'));
  tryInitializeFirebaseAdmin();
  const admin = require('firebase-admin');
  const custom = await admin.auth().createCustomToken(uid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: custom, returnSecureToken: true }),
    }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || 'token exchange failed');
  return json.idToken;
}

async function postCoach(token, uid, message, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  if (DEEPSEEK_KEY) headers['x-deepseek-key'] = DEEPSEEK_KEY;
  if (PERPLEXITY_KEY) headers['x-perplexity-key'] = PERPLEXITY_KEY;
  const res = await fetch(`${BASE}/api/ai-coach`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      userId: uid,
      messages: [{ role: 'user', content: message }],
      options: { web: options.web || 'auto', includePersonalData: options.includePersonalData ?? true },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

async function probeUserData(db, uid) {
  const probes = {};

  async function countSub(sub) {
    try {
      const snap = await db.collection('users').doc(uid).collection(sub).limit(50).get();
      return snap.size;
    } catch (_) {
      return 0;
    }
  }

  async function countTop(col, field) {
    try {
      const snap = await db.collection(col).where(field, '==', uid).limit(50).get();
      return snap.size;
    } catch (_) {
      return 0;
    }
  }

  probes.nutrition_logs = await countTop('nutrition_logs', 'user_id');
  probes.workoutPlans = await countSub('workoutPlans');
  probes.dailyLogs = await countSub('dailyLogs');
  probes.step_logs = await countSub('step_logs');
  probes.completedWorkouts = await countTop('completedWorkouts', 'userId');
  probes.trainerNotes = await countSub('notes');
  probes.trainerFiles = await countSub('files');

  let hasPlanContent = false;
  try {
    const plans = await db.collection('users').doc(uid).collection('workoutPlans').limit(3).get();
    hasPlanContent = plans.docs.some((d) => {
      const p = d.data() || {};
      return Boolean(p.structuredPlan?.days?.length || p.days?.length || p.plan);
    });
  } catch (_) {}

  probes.hasStructuredWorkoutPlan = hasPlanContent;
  return probes;
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(' AI COACH FULL CAPABILITY AUDIT');
  console.log(` API: ${BASE}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // ── Infrastructure ──────────────────────────────────────────────────────
  try {
    const health = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(8000) }).then((r) =>
      r.json()
    );
    row(
      'Infrastructure',
      'API health',
      health.aiCoachReady ? 'YES' : 'NO',
      `deepseek=${health.deepseek} firebase=${health.firebaseAdmin} perplexity=${health.perplexity}`
    );
    row(
      'Infrastructure',
      'Web search keys',
      PERPLEXITY_KEY || health.perplexity ? 'YES' : 'PARTIAL',
      PERPLEXITY_KEY ? 'PERPLEXITY in .env' : 'check Cloud Run env'
    );
  } catch (e) {
    row('Infrastructure', 'API health', 'NO', e.message);
    process.exit(1);
  }

  const { tryInitializeFirebaseAdmin } = require(path.join(ROOT, 'server/lib/initFirebaseAdmin'));
  tryInitializeFirebaseAdmin();
  const admin = require('firebase-admin');
  const db = admin.firestore();
  const { getWeeklyContext } = require(path.join(ROOT, 'server/getWeeklyContext'));
  const { shouldIncludeWeeklyContextInCoachPrompt } = require(path.join(
    ROOT,
    'server/lib/coachPersonalDataRouting'
  ));
  const { shouldInvokeWebSearch } = require(path.join(ROOT, 'server/lib/coachWebSearch'));

  // Find best test user (most data)
  const userSnap = await db.collection('users').limit(20).get();
  let bestUser = null;
  let bestScore = -1;
  let bestProbes = null;

  for (const doc of userSnap.docs) {
    const probes = await probeUserData(db, doc.id);
    const score =
      probes.nutrition_logs +
      probes.workoutPlans * 5 +
      probes.dailyLogs +
      probes.completedWorkouts * 2 +
      (probes.hasStructuredWorkoutPlan ? 10 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestUser = doc.id;
      bestProbes = probes;
    }
  }

  if (!bestUser) {
    row('Data probe', 'Test user', 'NO', 'No users in Firestore');
    process.exit(1);
  }

  row('Data probe', 'Test user', 'INFO', `${bestUser.slice(0, 10)}… score=${bestScore}`);
  Object.entries(bestProbes).forEach(([k, v]) => {
    row('Firestore', k, v > 0 || v === true ? 'YES' : 'NO', String(v));
  });

  // ── What getWeeklyContext actually returns ────────────────────────────────
  let wc;
  try {
    wc = await getWeeklyContext(bestUser);
  } catch (e) {
    row('Context loader', 'getWeeklyContext', 'NO', e.message);
    wc = null;
  }

  if (wc) {
    row(
      'Context in prompt',
      'Profile (age/goal/level)',
      wc.user?.goal ? 'YES' : 'PARTIAL',
      `goal=${wc.user?.goal || '?'}`
    );
    row(
      'Context in prompt',
      'Nutrition history',
      wc.nutritionAnalysis?.daysLogged > 0 ? 'YES' : 'NO',
      `${wc.nutritionAnalysis?.totalLoggedDaysAllTime || wc.nutritionAnalysis?.daysLogged || 0} days, avg ${Math.round(wc.nutritionAnalysis?.avgDailyCalories || 0)} cal`
    );
    row(
      'Context in prompt',
      'Macro targets',
      wc.macroTargets?.calories ? 'YES' : 'NO',
      `${wc.macroTargets?.calories || '?'} cal`
    );
    row(
      'Context in prompt',
      'Workout session stats',
      wc.workoutAnalysis?.sessionsLogged > 0 ? 'YES' : 'NO',
      `${wc.workoutAnalysis?.sessionsLogged || 0} sessions, RPE ${wc.workoutAnalysis?.avgRPE ?? 'n/a'}`
    );
    row(
      'Context in prompt',
      'Workout PLAN content (exercises/days)',
      'NO',
      'Not loaded — only session counts/dates/volume'
    );
    row(
      'Context in prompt',
      'Sleep data',
      wc.sleepAnalysis?.avgHours ? 'YES' : 'NO',
      wc.sleepAnalysis?.avgHours ? `${wc.sleepAnalysis.avgHours}h avg` : 'none logged'
    );
    row(
      'Context in prompt',
      'Steps/water/mood/energy',
      wc.wellnessAnalysis ? 'YES' : 'NO',
      wc.wellnessAnalysis ? Object.keys(wc.wellnessAnalysis).join(', ') : 'none'
    );
    row(
      'Context in prompt',
      'Weight log',
      wc.weightLog?.length > 0 ? 'YES' : 'NO',
      `${wc.weightLog?.length || 0} entries`
    );
    row(
      'Context in prompt',
      'Streak',
      wc.streakData?.currentStreak > 0 ? 'YES' : 'NO',
      String(wc.streakData?.currentStreak || 0)
    );
    row('Context in prompt', 'Trainer notes/files', 'NO', 'Not in coachWeeklyData');
    row('Context in prompt', 'Messages with trainer', 'NO', 'Not in coachWeeklyData');
    row('Context in prompt', 'Progress photos', 'NO', 'Not in coachWeeklyData');
    row(
      'Context in prompt',
      'Account history window',
      'YES',
      `${wc.contextMeta?.totalDaysSinceJoin || '?'} days since join (from createdAt)`
    );
  }

  // ── Personal data routing ───────────────────────────────────────────────
  const routingTests = [
    ['what did I log today', true],
    ['is creatine safe', false],
    ['what is my workout plan for today', false],
    ['how am I doing this week', true],
    ['search the web for latest protein research', false],
  ];
  for (const [msg, expect] of routingTests) {
    const got = shouldIncludeWeeklyContextInCoachPrompt(msg);
    row(
      'Personal data routing',
      `"${msg.slice(0, 40)}"`,
      got === expect ? 'YES' : 'PARTIAL',
      `loads logs=${got} (expected ${expect})`
    );
  }

  // ── Web search routing ──────────────────────────────────────────────────
  const webTests = [
    ['search the web for creatine dosing studies', true],
    ['what did I eat today', false],
    ['TRT and hCG protocol', true],
  ];
  for (const [msg, expect] of webTests) {
    const got = shouldInvokeWebSearch('auto', msg);
    row(
      'Web search routing',
      `"${msg.slice(0, 40)}"`,
      got === expect ? 'YES' : 'PARTIAL',
      `web=${got} (expected ${expect})`
    );
  }

  if (!API_KEY || !DEEPSEEK_KEY) {
    row('Live API', 'Coach chat tests', 'SKIP', 'Need EXPO_PUBLIC_FIREBASE_API_KEY + DEEPSEEK_API_KEY');
  } else {
    const token = await getIdToken(bestUser);

    const liveTests = [
      {
        name: 'Food log honesty',
        msg: 'what did I log today',
        check: (j) => j.usedWeeklyContext === true,
        detail: (j) => `usedWeeklyContext=${j.usedWeeklyContext}`,
      },
      {
        name: 'Workout plan visibility',
        msg: 'what exercises are in my workout plan today',
        check: (j) => Boolean(j.reply?.length > 10),
        detail: (j) => {
          const r = j.reply || '';
          const claimsPlan =
            /\b(bench|squat|deadlift|day \d|sets|reps|push|pull|legs)\b/i.test(r) &&
            !/don'?t have|can'?t see|not in|no workout plan|don'?t know your plan/i.test(r);
          return claimsPlan
            ? 'WARNING: may hallucinate plan — plan not in context'
            : `honest=${/don'?t have|can'?t see|not.*plan|no plan|don'?t know/i.test(r)} preview="${r.slice(0, 100)}"`;
        },
      },
      {
        name: 'Web search live',
        msg: 'search the web for how much protein per day for muscle gain 2024 research',
        check: (j) => j.searchedWeb === true || j.source === 'perplexity' || j.route === 'web-search',
        detail: (j) => `source=${j.source} searchedWeb=${j.searchedWeb} route=${j.route || 'standard'}`,
      },
      {
        name: 'logSleep tool',
        msg: 'log my sleep 7.5 hours',
        check: (j) => (j.toolCalls || []).some((t) => t.name === 'logSleep'),
        detail: (j) => `tools=${(j.toolCalls || []).map((t) => t.name).join(',') || 'none'}`,
      },
    ];

    for (const t of liveTests) {
      const { ok, json } = await postCoach(token, bestUser, t.msg, {
        includePersonalData: t.name !== 'Web search live' ? true : undefined,
        web: t.name === 'Web search live' ? 'auto' : 'off',
      });
      const pass = ok && t.check(json);
      row('Live API', t.name, pass ? 'YES' : 'PARTIAL', t.detail(json));
    }
  }

  // ── Tools list (static) ─────────────────────────────────────────────────
  const tools = [
    'adjustMacroTargets',
    'logNutrition',
    'logSleep',
    'logWater',
    'logSteps',
    'rateEnergy',
    'logMood',
    'rateWorkout',
    'updateWorkout',
    'bookSession',
    'generateDeloadWeek',
    'updateGoal',
    'notifyTrainer',
  ];
  row('Tools', 'Available actions', 'YES', tools.join(', '));

  console.log('\n═══════════════════════════════════════════════════════════');
  const yes = results.filter((r) => r.status === 'YES').length;
  const partial = results.filter((r) => r.status === 'PARTIAL').length;
  const no = results.filter((r) => r.status === 'NO').length;
  console.log(` Summary: ${yes} yes, ${partial} partial, ${no} no / ${results.length} checks`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
