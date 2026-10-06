// Builds a display name for a saved AI workout plan card.
// Flow: read the goal → pick a name pool → hash a seed → prefix the week count.
// Used by: CreateWorkoutPlanScreen and saveAndLoadWorkoutPlan.

// ===== NAMED CONSTANTS =====

// Manipulate here: how the seed is turned into a stable list index.
const HASH_MULTIPLIER = 31;
const MIN_WEEKS_TO_PREFIX = 2;
const MAX_WEEKS_TO_PREFIX = 52;
const MAX_PLAN_NAME_LENGTH = 56;
const FALLBACK_PLAN_NAME = 'Training Blueprint';

const DEFAULT_NAME_POOL = [
  'Training Blueprint',
  'Progress Arc',
  'Performance Protocol',
  'Lift Lab Plan',
  'Weekly Grind Blueprint',
];

const GOAL_NAME_CATALOGS = [
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

// ===== HELPER FUNCTIONS =====

/**
 * Same plan data should keep the same name across reloads.
 * @param {string} seed
 * @returns {number}
 */
function hashSeed(seed) {
  const seedText = String(seed || 'plan');
  let hash = 0;
  for (let index = 0; index < seedText.length; index += 1) {
    hash = (hash * HASH_MULTIPLIER + seedText.charCodeAt(index)) >>> 0;
  }
  return hash;
}

/**
 * Pick one name from a list. An empty list falls back to the generic title.
 * @param {string[]} namePool
 * @param {string} seed
 * @returns {string}
 */
function pickNameFromPool(namePool, seed) {
  const list = Array.isArray(namePool) && namePool.length ? namePool : [FALLBACK_PLAN_NAME];
  return list[hashSeed(seed) % list.length];
}

/**
 * The generated payload sometimes nests the real plan under structuredPlan.
 * @param {object} planData
 * @returns {object}
 */
function readStructuredPlan(planData) {
  if (planData?.structuredPlan && typeof planData.structuredPlan === 'object') {
    return planData.structuredPlan;
  }
  if (planData && typeof planData === 'object') {
    return planData;
  }
  return {};
}

/**
 * @param {object} structuredPlan
 * @param {object} planData
 * @returns {string}
 */
function readGoalText(structuredPlan, planData) {
  const goalRaw = structuredPlan.goal
    || structuredPlan.focus
    || structuredPlan.primaryGoal
    || planData?.goal
    || planData?.focus
    || '';
  return String(goalRaw).trim().toLowerCase();
}

/**
 * @param {object} structuredPlan
 * @param {object} planData
 * @returns {number}
 */
function readWeekCount(structuredPlan, planData) {
  const rawWeeks = structuredPlan.weeks || structuredPlan.totalWeeks || structuredPlan.durationWeeks || planData?.totalWeeks;
  return Number(rawWeeks) || 0;
}

/**
 * @param {object} structuredPlan
 * @param {object} planData
 * @returns {number}
 */
function readDaysPerWeek(structuredPlan, planData) {
  const rawDays = structuredPlan.daysPerWeek
    || structuredPlan.trainingDays?.length
    || planData?.daysPerWeek
    || 0;
  return Number(rawDays) || 0;
}

/**
 * First matching goal pattern wins. No match keeps the generic pool.
 * @param {string} goalText
 * @returns {string[]}
 */
function pickNamePoolForGoal(goalText) {
  for (const catalog of GOAL_NAME_CATALOGS) {
    if (catalog.test.test(goalText)) return catalog.picks;
  }
  return DEFAULT_NAME_POOL;
}

/**
 * "8-Week Muscle Forge" only when the week count is a real plan length
 * and the picked name does not already start with a week count.
 * @param {string} planName
 * @param {number} weekCount
 * @returns {string}
 */
function prefixWeeksWhenUseful(planName, weekCount) {
  const weekCountIsARealPlan = weekCount >= MIN_WEEKS_TO_PREFIX && weekCount <= MAX_WEEKS_TO_PREFIX;
  const nameAlreadyHasWeeks = /^\d+-week/i.test(planName);
  if (weekCountIsARealPlan && !nameAlreadyHasWeeks) {
    return `${weekCount}-Week ${planName}`;
  }
  return planName;
}

// ===== MAIN FUNCTION =====

/**
 * Creative display name for a saved AI workout plan.
 * Flow: 1. read goal and length  2. pick a name pool  3. hash a seed  4. prefix weeks
 * @param {object} [planData]
 * @param {string} [fallbackSeed]
 * @returns {string}
 */
export function nameWorkoutPlan(planData = {}, fallbackSeed = '') {
  const structuredPlan = readStructuredPlan(planData);
  const goalText = readGoalText(structuredPlan, planData);
  const weekCount = readWeekCount(structuredPlan, planData);
  const daysPerWeek = readDaysPerWeek(structuredPlan, planData);
  const namePool = pickNamePoolForGoal(goalText);
  const seed = `${goalText}|${weekCount}|${daysPerWeek}|${fallbackSeed || planData?.generatedAt || Date.now()}`;
  const pickedName = pickNameFromPool(namePool, seed);
  const namedPlan = prefixWeeksWhenUseful(pickedName, weekCount);
  return String(namedPlan).replace(/\s+/g, ' ').trim().slice(0, MAX_PLAN_NAME_LENGTH);
}

/**
 * True when the saved title is still the bland auto name we want to replace.
 * @param {string} name
 * @returns {boolean}
 */
export function looksLikeDefaultAiPlanName(name) {
  const title = String(name || '').trim();
  if (!title) return true;
  if (/^ai\s*plan\b/i.test(title)) return true;
  if (/^workout\s*plan\s*[·\-–—]/i.test(title)) return true;
  if (/^your workout plan$/i.test(title)) return true;
  return false;
}
