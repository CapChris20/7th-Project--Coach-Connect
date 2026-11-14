// Picks which weight numbers the trainer Progress tab shows (current + “was” baseline).
// Flow: sanitize each candidate → walk a priority list → return the first real number.
// Used by TrainerProgressTab and progress hero cards so Firestore shape disagreements stay in one file.
// Read order: constants → parse helpers → mains that pick current vs before weight.

// ===== NAMED CONSTANTS =====

// Empty string is treated like “no weight” even though Number('') is 0.
const EMPTY_WEIGHT_TEXT = '';

// ===== HELPER FUNCTIONS =====

/**
 * Turn dashboard / profile values into a finite pound number, or null when missing or junk.
 * vocab: == null is true for both null and undefined.
 * @param {unknown} rawWeight
 * @returns {number|null}
 */
function parseFiniteWeight(rawWeight) {
  const isMissing = rawWeight == null || rawWeight === EMPTY_WEIGHT_TEXT;
  if (isMissing) {
    return null;
  }

  const weightAsNumber = Number(rawWeight);
  const isRealNumber = Number.isFinite(weightAsNumber);
  if (!isRealNumber) {
    return null;
  }
  return weightAsNumber;
}

/**
 * Walk the list in order and stop at the first weight that parses.
 * @param {unknown[]} weightCandidates
 * @returns {number|null}
 */
function firstFiniteWeightAmong(weightCandidates) {
  const candidateList = weightCandidates || [];
  for (let index = 0; index < candidateList.length; index += 1) {
    const parsedWeight = parseFiniteWeight(candidateList[index]);
    if (parsedWeight != null) {
      return parsedWeight;
    }
  }
  return null;
}

/**
 * Priority list for “current” weight on the progress hero.
 * @param {object} sources
 * @returns {unknown[]}
 */
function currentWeightCandidates(sources) {
  return [
    sources.todayDashboardWeight,
    sources.latestLoggedWeight,
    sources.profileWeight,
  ];
}

/**
 * Priority list for “was X lbs” baseline. Order matches the old screen.
 * @param {object} sources
 * @returns {unknown[]}
 */
function beforeWeightCandidates(sources) {
  return [
    sources.startingWeight,
    sources.crmStartingWeight,
    sources.profileWeight,
    sources.crmWeight,
  ];
}

// ===== MAIN FUNCTION =====

/**
 * “Current” weight for the progress list — today’s log beats history beats profile.
 * @param {{ todayDashboardWeight?: unknown, latestLoggedWeight?: unknown, profileWeight?: unknown }} [sources]
 * @returns {number|null}
 */
export function resolveTrainerProgressCurrentWeight({
  todayDashboardWeight,
  latestLoggedWeight,
  profileWeight,
} = {}) {
  // 1. Prefer what the client logged today on the dashboard.
  // 2. Else the newest historical log entry we have.
  // 3. Else profile weight (often stale onboarding value).
  const candidatesInPriorityOrder = currentWeightCandidates({
    todayDashboardWeight,
    latestLoggedWeight,
    profileWeight,
  });
  return firstFiniteWeightAmong(candidatesInPriorityOrder);
}

/**
 * “Was X lbs” baseline — CRM + profile fields, with ?? so a real 0 is kept.
 * vocab/symbol: ?? = only substitutes when left is null/undefined (0 is kept).
 * @param {{ startingWeight?: unknown, profileWeight?: unknown, crmStartingWeight?: unknown, crmWeight?: unknown }} [sources]
 * @returns {number|null}
 */
export function resolveTrainerProgressBeforeWeight({
  startingWeight,
  profileWeight,
  crmStartingWeight,
  crmWeight,
} = {}) {
  // 1. Explicit starting weight fields.
  // 2. Profile / CRM fallbacks in the same order the old screen used.
  const candidatesInPriorityOrder = beforeWeightCandidates({
    startingWeight,
    profileWeight,
    crmStartingWeight,
    crmWeight,
  });
  return firstFiniteWeightAmong(candidatesInPriorityOrder);
}

// ===== PLUMBING — skip unless debugging weight parsing =====
// parseFiniteWeight + firstFiniteWeightAmong live under HELPER FUNCTIONS above.
