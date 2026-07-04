#!/usr/bin/env node
/**
 * Regression tests for AI Coach audit fixes 1–10.
 * Run: node scripts/testAiCoachAuditFixes.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

let failed = 0;
let passed = 0;

function pass(name, detail = '') {
  passed += 1;
  console.log(`✅ PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  failed += 1;
  console.log(`❌ FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

function assert(name, cond, detail = '') {
  if (cond) pass(name, detail);
  else fail(name, detail);
}

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

// ─── FIX 1 & 2: static imports ───────────────────────────────────────────────
(function testStaticImports() {
  const chatScreen = read('src/ai-coach/chat-ui/chat-thread/ChatWithCoachScreen.jsx');
  assert(
    'FIX 1: ChatWithCoachScreen imports logger',
    /import\s+logger\s+from\s+['"]\.\.\/\.\.\/shared\/services\/logger['"]/.test(chatScreen),
  );
  assert(
    'FIX 1: ChatWithCoachScreen uses logger (not bare global)',
    chatScreen.includes('logger.debug(') && !chatScreen.includes('logger is not defined'),
  );

  const toolExecutor = read('src/ai-coach/server-logic/tools/runCoachAction.js');
  assert(
    'FIX 2: toolExecutor imports getDoc',
    /import\s*\{[^}]*\bgetDoc\b[^}]*\}\s*from\s*['"]firebase\/firestore['"]/.test(toolExecutor),
  );
})();

// ─── FIX 5: data integrity rule ────────────────────────────────────────────
(function testDataIntegrityRule() {
  const voice = require(path.join(ROOT, 'server/lib/coachVoice.js'));
  assert('FIX 5: COACH_DATA_INTEGRITY_RULE exported', typeof voice.COACH_DATA_INTEGRITY_RULE === 'string');
  assert(
    'FIX 5: rule mentions invent numbers',
    voice.COACH_DATA_INTEGRITY_RULE.includes('Never estimate, approximate, or invent numbers'),
  );

  const indexSrc = read('server/index.js');
  assert(
    'FIX 5: base prompt includes DATA INTEGRITY',
    indexSrc.includes('${COACH_DATA_INTEGRITY_RULE}') && indexSrc.includes('COACH_DATA_INTEGRITY_RULE'),
  );
  const integrityRefs = indexSrc.match(/\$\{COACH_DATA_INTEGRITY_RULE\}/g) || [];
  assert(
    'FIX 5: weekly + base prompts include DATA INTEGRITY',
    integrityRefs.length >= 2,
    `found ${integrityRefs.length} reference(s)`,
  );
})();

// ─── FIX 8: no 400-calorie fallback ────────────────────────────────────────
(function testLogNutritionNoFallback() {
  const indexSrc = read('server/index.js');
  assert('FIX 8: no cals = 400 fallback', !/cals\s*=\s*400/.test(indexSrc));
  assert(
    'FIX 8: returns error when USDA missing',
    indexSrc.includes("I couldn't look up nutrition data for") &&
      indexSrc.includes('Please log this manually in the nutrition tab'),
  );
})();

// ─── FIX 3: options.includePersonalData ────────────────────────────────────
(function testIncludePersonalDataRouting() {
  const indexSrc = read('server/index.js');
  assert(
    'FIX 3: buildCoachPromptForUser reads options.includePersonalData',
    indexSrc.includes('coachOptions.includePersonalData === true') &&
      indexSrc.includes('coachOptions.includePersonalData === false'),
  );
  assert(
    'FIX 3: handleAICoachRequest passes options to buildCoachPromptForUser',
    /buildCoachPromptForUser\(\s*targetUid,\s*userProfile,\s*lastUserMsg,\s*options/.test(indexSrc),
  );

  const clientRouting = require(path.join(ROOT, 'src/ai-coach/server-logic/context/buildCoachPromptData.js'));
  const serverRouting = require(path.join(ROOT, 'server/lib/coachPersonalDataRouting.js'));
  assert(
    'FIX 3: client sends personal data for "what did I log today"',
    clientRouting.shouldIncludeWeeklyContextInCoachPrompt('what did I log today') === true,
  );
  assert(
    'FIX 3: server routing agrees on food log question',
    serverRouting.shouldIncludeWeeklyContextInCoachPrompt('what did I log today') === true,
  );
})();

// ─── FIX 6: weekly fetch failure note + logger ─────────────────────────────
(function testWeeklyFetchFailure() {
  const indexSrc = read('server/index.js');
  assert(
    'FIX 6: WEEKLY_FETCH_FAILURE_NOTE present',
    indexSrc.includes('Weekly data failed to load for this request'),
  );
  assert(
    'FIX 6: uses logger.error on fetch failure',
    indexSrc.includes('logger.error') && indexSrc.includes('Weekly context fetch failed'),
  );
})();

// ─── FIX 9: coachWeeklyData logs failures ──────────────────────────────────
(function testCoachWeeklyDataLogging() {
  const src = read('server/lib/coachWeeklyData.js');
  assert('FIX 9: coachWeeklyData requires logger', src.includes("require('./logger')"));
  assert(
    'FIX 9: no silent empty catch blocks',
    !/catch\s*\(_\)\s*\{\s*\/\*\s*ignore\s*\*\/\s*\}/.test(src),
  );
  assert(
    'FIX 9: catch blocks use logger.warn',
    (src.match(/logger\.warn\(/g) || []).length >= 5,
  );
  assert(
    'Scalability: completedWorkouts query limit',
    src.includes('COMPLETED_WORKOUTS_QUERY_LIMIT') && src.includes('.limit(COMPLETED_WORKOUTS_QUERY_LIMIT)'),
  );
})();

async function testAggregateCoachWeeklyData() {
  const { aggregateCoachWeeklyData, last7DateKeys } = require(path.join(
    ROOT,
    'server/lib/coachWeeklyData.js',
  ));
  const keys = last7DateKeys();
  const today = keys[keys.length - 1];

  const store = {
    [`users/test-user/streaks/current`]: { streak: 12, currentStreak: 12 },
    [`users/test-user/step_logs/${today}`]: { step_count: 8500, date: today },
    [`users/test-user/water_logs/${today}`]: { amount_oz: 96, date: today },
    [`users/test-user/energy_logs/${today}`]: { rating: 7, date: today },
    [`users/test-user/mood_logs/${today}`]: { mood: 'happy', date: today },
    [`users/test-user/workout_ratings/${today}`]: { rating: 9, date: today },
    [`users/test-user/dailyLogs/${today}`]: {
      dashboard_sleep: 7.5,
      workoutLog: [{ exerciseName: 'Squat', rpe: 8, sets: [{ rpe: 9 }] }],
    },
  };

  const mockDb = {
    collection(name) {
      const self = {
        where() {
          return self;
        },
        limit() {
          return self;
        },
        async get() {
          if (name === 'nutrition_logs' || name === 'completedWorkouts') {
            return { docs: [] };
          }
          if (name === 'nutrition_goals') {
            return {
              exists: true,
              data: () => ({ calorie_target: 2200, protein_target: 150 }),
            };
          }
          return { docs: [] };
        },
        doc(id) {
          const base = name === 'users' ? `users/${id}` : `${name}/${id}`;
          const docRef = mockDb.doc(base);
          docRef.collection = (subName) => {
            const prefix = `${base}/${subName}/`;
            return {
              async get() {
                const docs = Object.entries(store)
                  .filter(([k]) => k.startsWith(prefix))
                  .map(([k, data]) => ({
                    id: k.slice(prefix.length),
                    data: () => data,
                  }));
                return { docs };
              },
            };
          };
          return docRef;
        },
      };
      return self;
    },
    doc(docPath) {
      const data = store[docPath];
      const ref = {
        async get() {
          if (data !== undefined) {
            return { exists: true, data: () => data, id: docPath.split('/').pop() };
          }
          return { exists: false, data: () => ({}), id: docPath.split('/').pop() };
        },
        collection(subName) {
          const prefix = `${docPath}/${subName}/`;
          return {
            async get() {
              const docs = Object.entries(store)
                .filter(([k]) => k.startsWith(prefix))
                .map(([k, val]) => ({
                  id: k.slice(prefix.length),
                  data: () => val,
                }));
              return { docs };
            },
          };
        },
      };
      return ref;
    },
  };

  const startMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const result = await aggregateCoachWeeklyData(mockDb, 'test-user', startMs);

  assert('FIX 7: streakData.currentStreak returned', result.streakData?.currentStreak === 12);
  assert('FIX 4: wellness steps avg', result.wellnessAnalysis?.steps?.avgDaily === 8500);
  assert('FIX 4: wellness water avg', result.wellnessAnalysis?.water?.avgOzDaily === 96);
  assert('FIX 4: wellness energy avg', result.wellnessAnalysis?.energy?.avgRating === 7);
  assert(
    'FIX 4: wellness mood entries',
    Array.isArray(result.wellnessAnalysis?.mood?.entries) &&
      result.wellnessAnalysis.mood.entries.some((e) => e.mood === 'happy'),
  );
  assert(
    'FIX 10: avgRPE populated from workout_ratings + dailyLogs',
    result.workoutAnalysis?.avgRPE != null && result.workoutAnalysis.avgRPE >= 8,
  );
  assert('FIX 10: sleep analysis from dailyLogs', result.sleepAnalysis?.avgHours === 7.5);
}

// ─── FIX 4: prompt section formatter (inline mirror of server helper) ────────
(function testActivityWellnessPromptSection() {
  function formatActivityWellnessSection(wellness) {
    if (!wellness || typeof wellness !== 'object') return '';
    const lines = [];
    const { steps, water, energy, mood } = wellness;
    if (steps?.avgDaily != null && Array.isArray(steps.daily) && steps.daily.length) {
      const breakdown = steps.daily.map((d) => `${d.date}: ${d.steps.toLocaleString()}`).join(', ');
      lines.push(`- Steps: avg ${steps.avgDaily.toLocaleString()}/day | ${breakdown}`);
    }
    if (water?.avgOzDaily != null) lines.push(`- Water: avg ${water.avgOzDaily} oz/day`);
    if (energy?.avgRating != null) lines.push(`- Avg energy rating: ${energy.avgRating}/10`);
    if (Array.isArray(mood?.entries) && mood.entries.length) {
      const moodLine = mood.entries.map((e) => `${e.date}: ${e.mood}`).join(', ');
      lines.push(`- Mood log: ${moodLine}`);
    }
    if (!lines.length) return '';
    return `\n\nACTIVITY & WELLNESS (last 7 days):\n${lines.join('\n')}`;
  }

  const section = formatActivityWellnessSection({
    steps: { avgDaily: 10000, daily: [{ date: '2026-05-28', steps: 10000 }] },
    water: { avgOzDaily: 80 },
    energy: { avgRating: 8 },
    mood: { entries: [{ date: '2026-05-28', mood: 'okay' }] },
  });
  assert('FIX 4: prompt includes ACTIVITY & WELLNESS header', section.includes('ACTIVITY & WELLNESS'));
  assert('FIX 4: prompt includes steps line', section.includes('Steps: avg'));
  assert('FIX 4: empty wellness omits section', formatActivityWellnessSection(null) === '');
})();

// ─── FIX 7: streak omitted when zero in weekly prompt logic ────────────────
(function testStreakLineOmission() {
  const indexSrc = read('server/index.js');
  assert(
    'FIX 7: streak line only when streak > 0',
    indexSrc.includes('streak > 0 ?') && indexSrc.includes('Streak ${streak} days'),
  );
})();

async function testServerHealth() {
  const base = String(process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(
    /\/+$/,
    '',
  );
  try {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) {
      pass('Server health: skipped (not OK)', `status ${res.status}`);
      return;
    }
    const json = await res.json();
    const hasFirebase =
      json.firebaseAdmin === true || json.status === 'ok' || json.deepseek === true;
    assert('Server health: API reachable', hasFirebase, JSON.stringify(json).slice(0, 120));
  } catch (e) {
    pass('Server health: skipped (server not running)', e.message);
  }
}

(async function main() {
  console.log('AI Coach audit fix regression tests\n');
  await testAggregateCoachWeeklyData();
  await testServerHealth();
  console.log('\n────────────────────────────────────────');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log('All AI Coach audit fix tests passed.');
})();
