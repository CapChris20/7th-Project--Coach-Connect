/**
 * Creative display names for saved AI workout plans (library cards).
 * Avoids bland "AI Plan – Jul 6, 2026" defaults.
 */

function pickFrom(pool, seed) {
  const list = Array.isArray(pool) && pool.length ? pool : ['Training Blueprint'];
  const s = String(seed || 'plan');
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return list[hash % list.length];
}

/**
 * @param {object} [planData] - generated plan payload ({ structuredPlan, goal, ... })
 * @param {string} [fallbackSeed]
 * @returns {string}
 */
export function buildCreativeWorkoutPlanName(planData = {}, fallbackSeed = '') {
  const structured = planData?.structuredPlan && typeof planData.structuredPlan === 'object'
    ? planData.structuredPlan
    : planData && typeof planData === 'object'
      ? planData
      : {};

  const goalRaw = String(
    structured.goal ||
      structured.focus ||
      structured.primaryGoal ||
      planData?.goal ||
      planData?.focus ||
      '',
  )
    .trim()
    .toLowerCase();

  const weeks =
    Number(structured.weeks || structured.totalWeeks || structured.durationWeeks || planData?.totalWeeks) ||
    0;
  const days =
    Number(
      structured.daysPerWeek ||
        structured.trainingDays?.length ||
        planData?.daysPerWeek ||
        0,
    ) || 0;

  const catalogs = [
    {
      test: /muscle|hypertrophy|size|mass|build muscle|gain muscle/,
      picks: ['Muscle Forge', 'Hypertrophy Blueprint', 'Size Engine', 'Mass Builder Protocol', 'Growth Phase Arc'],
    },
    {
      test: /fat|cut|loss|lean|shred|slim|deficit/,
      picks: ['Shred Protocol', 'Lean Machine Plan', 'Cut Season Blueprint', 'Fat-Loss Engine', 'Definition Phase'],
    },
    {
      test: /strength|power|strong|1rm|pr/,
      picks: ['Strength Surge', 'Power Phase', 'Iron Foundation', 'Force Builder', 'Heavy Day Blueprint'],
    },
    {
      test: /recomp|recomposition/,
      picks: ['Recomp Blueprint', 'Body Recomp Arc', 'Rebuild Protocol', 'Sculpt & Strengthen'],
    },
    {
      test: /endurance|cardio|condition|stamina/,
      picks: ['Conditioning Circuit', 'Engine Builder', 'Endurance Arc', 'Work Capacity Plan'],
    },
    {
      test: /athletic|sport|performance|athlete/,
      picks: ['Athlete Protocol', 'Performance Arc', 'Game-Day Prep', 'Sport Strength Plan'],
    },
    {
      test: /beginner|starter|intro|new to/,
      picks: ['Foundation Phase', 'Starter Strength Arc', 'First Iron Plan', 'Base Builder'],
    },
    {
      test: /home|bodyweight|minimal equipment|no gym/,
      picks: ['Home Iron Plan', 'Bodyweight Blueprint', 'Minimal Gear Arc', 'Apartment Athlete Plan'],
    },
  ];

  let pool = [
    'Training Blueprint',
    'Progress Arc',
    'Performance Protocol',
    'Lift Lab Plan',
    'Weekly Grind Blueprint',
  ];
  for (const entry of catalogs) {
    if (entry.test.test(goalRaw)) {
      pool = entry.picks;
      break;
    }
  }

  const seed = `${goalRaw}|${weeks}|${days}|${fallbackSeed || planData?.generatedAt || Date.now()}`;
  let name = pickFrom(pool, seed);

  if (weeks >= 2 && weeks <= 52 && !/^\d+-week/i.test(name)) {
    name = `${weeks}-Week ${name}`;
  }

  return String(name).replace(/\s+/g, ' ').trim().slice(0, 56);
}

export function looksLikeDefaultAiPlanName(name) {
  const t = String(name || '').trim();
  if (!t) return true;
  if (/^ai\s*plan\b/i.test(t)) return true;
  if (/^workout\s*plan\s*[·\-–—]/i.test(t)) return true;
  if (/^your workout plan$/i.test(t)) return true;
  return false;
}
