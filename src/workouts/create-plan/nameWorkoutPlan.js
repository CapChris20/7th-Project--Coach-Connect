// Builds a display name for a saved AI workout plan card.
// Flow: unwrap plan → read goal / weeks → pick a name pool → hash a stable seed → prefix weeks → cap length.
// Used by CreateWorkoutPlanScreen and saveAndLoadWorkoutPlan.
// Export names stay frozen: nameWorkoutPlan, looksLikeDefaultAiPlanName.

// ===== NAMED CONSTANTS =====

// Manipulate here: how the seed string becomes a stable list index (31 is a classic string-hash multiplier).
const HASH_MULTIPLIER = 31;

// Manipulate here: only prefix "N-Week …" when week count is in this believable plan range.
const MIN_WEEKS_TO_PREFIX = 2;
const MAX_WEEKS_TO_PREFIX = 52;

// Manipulate here: Firestore card title max length.
const MAX_PLAN_NAME_LENGTH = 56;

const FALLBACK_PLAN_NAME = 'Training Blueprint';

const DEFAULT_NAME_POOL = [
  'Training Blueprint',
  'Progress Arc',
  'Performance Protocol',
  'Lift Lab Plan',
  'Weekly Grind Blueprint',
];

// Each row: goal regex + human titles we rotate through when that goal text matches.
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

// ===== MAIN RECIPES (exports) =====

/**
 * Pick a stable human title for one generated plan.
 * Same goal + weeks + seed → same name across reloads.
 * @param {object} [planData]
 * @param {string} [fallbackSeed]
 * @returns {string}
 */
export function nameWorkoutPlan(planData = {}, fallbackSeed = '') {
  // 1. Unwrap structuredPlan when the generator nested the real object.
  const structuredPlan = readStructuredPlan(planData);

  // 2. Goal text picks the pool; week/day counts salt the hash seed.
  const goalText = readGoalText(structuredPlan, planData);
  const weekCount = readWeekCount(structuredPlan, planData);
  const daysPerWeek = readDaysPerWeek(structuredPlan, planData);

  // 3. Pick a title pool from the goal, then one stable title from that pool.
  const namePool = pickNamePoolForGoal(goalText);
  const generatedAt = readGeneratedAtOrNow(planData);
  const seedParts = [goalText, weekCount, daysPerWeek, fallbackSeed || generatedAt];
  const seed = seedParts.join('|');
  const pickedName = pickNameFromPool(namePool, seed);

  // 4. Prefix "8-Week …" when the week count is a believable plan length.
  const namedPlan = prefixWeeksWhenUseful(pickedName, weekCount);

  // 5. Collapse whitespace and cap length for Firestore card titles.
  return collapseAndCapPlanName(namedPlan);
}

/**
 * True when the stored title is still a generic AI placeholder (safe to rename).
 * @param {string} name
 * @returns {boolean}
 */
export function looksLikeDefaultAiPlanName(name) {
  // 1. Blank / missing → treat as default so callers can overwrite.
  const title = String(name || '').trim();
  if (!title) return true;

  // 2. Match the known placeholder patterns the generator used to ship.
  if (titleLooksLikeAiPlanPrefix(title)) return true;
  if (titleLooksLikeWorkoutPlanDashPrefix(title)) return true;
  if (titleLooksLikeYourWorkoutPlan(title)) return true;

  // 3. Anything else is a real custom name — leave it alone.
  return false;
}

// ===== PLUMBING — skip unless debugging =====

/**
 * vocab: >>> 0 = force unsigned 32-bit int so modulo index stays non-negative
 * @param {string} seed
 * @returns {number}
 */
function hashSeed(seed) {
  const seedText = String(seed || 'plan');
  let hash = 0;
  for (let charIndex = 0; charIndex < seedText.length; charIndex += 1) {
    const charCode = seedText.charCodeAt(charIndex);
    hash = (hash * HASH_MULTIPLIER + charCode) >>> 0;
  }
  return hash;
}

/**
 * @param {string[]} namePool
 * @param {string} seed
 * @returns {string}
 */
function pickNameFromPool(namePool, seed) {
  const poolHasNames = Array.isArray(namePool) && namePool.length > 0;
  const list = poolHasNames ? namePool : [FALLBACK_PLAN_NAME];
  const listIndex = hashSeed(seed) % list.length;
  return list[listIndex];
}

/**
 * The generated payload sometimes nests the real plan under structuredPlan.
 * @param {object} planData
 * @returns {object}
 */
function readStructuredPlan(planData) {
  const nestedPlan = planData && planData.structuredPlan;
  const nestedIsObject = nestedPlan && typeof nestedPlan === 'object';
  if (nestedIsObject) return nestedPlan;

  const rootIsObject = planData && typeof planData === 'object';
  if (rootIsObject) return planData;

  return {};
}

/**
 * @param {object} structuredPlan
 * @param {object} planData
 * @returns {string}
 */
function readGoalText(structuredPlan, planData) {
  const goalFromStructure =
    structuredPlan.goal
    || structuredPlan.focus
    || structuredPlan.primaryGoal;
  const goalFromRoot = (planData && planData.goal) || (planData && planData.focus);
  const goalRaw = goalFromStructure || goalFromRoot || '';
  return String(goalRaw).trim().toLowerCase();
}

/**
 * @param {object} structuredPlan
 * @param {object} planData
 * @returns {number}
 */
function readWeekCount(structuredPlan, planData) {
  const weekField =
    structuredPlan.weeks
    || structuredPlan.totalWeeks
    || structuredPlan.durationWeeks
    || (planData && planData.totalWeeks);
  return Number(weekField) || 0;
}

/**
 * @param {object} structuredPlan
 * @param {object} planData
 * @returns {number}
 */
function readDaysPerWeek(structuredPlan, planData) {
  const trainingDays = structuredPlan.trainingDays;
  let trainingDayCount = 0;
  if (Array.isArray(trainingDays)) {
    trainingDayCount = trainingDays.length;
  }
  const daysField =
    structuredPlan.daysPerWeek
    || trainingDayCount
    || (planData && planData.daysPerWeek)
    || 0;
  return Number(daysField) || 0;
}

/**
 * Prefer the plan’s generatedAt; fall back to “now” so two blank plans still differ.
 * @param {object} planData
 * @returns {number|string}
 */
function readGeneratedAtOrNow(planData) {
  if (planData && planData.generatedAt) return planData.generatedAt;
  return Date.now();
}

/**
 * First matching goal catalog wins; otherwise the default pool.
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
 * @param {string} planName
 * @param {number} weekCount
 * @returns {string}
 */
function prefixWeeksWhenUseful(planName, weekCount) {
  const weekCountIsReal =
    weekCount >= MIN_WEEKS_TO_PREFIX && weekCount <= MAX_WEEKS_TO_PREFIX;
  const nameAlreadyHasWeeks = /^\d+-week/i.test(planName);
  if (!weekCountIsReal) return planName;
  if (nameAlreadyHasWeeks) return planName;
  return `${weekCount}-Week ${planName}`;
}

/**
 * @param {string} namedPlan
 * @returns {string}
 */
function collapseAndCapPlanName(namedPlan) {
  const collapsed = String(namedPlan).replace(/\s+/g, ' ').trim();
  return collapsed.slice(0, MAX_PLAN_NAME_LENGTH);
}

function titleLooksLikeAiPlanPrefix(title) {
  return /^ai\s*plan\b/i.test(title);
}

function titleLooksLikeWorkoutPlanDashPrefix(title) {
  return /^workout\s*plan\s*[·\-–—]/i.test(title);
}

function titleLooksLikeYourWorkoutPlan(title) {
  return /^your workout plan$/i.test(title);
}
