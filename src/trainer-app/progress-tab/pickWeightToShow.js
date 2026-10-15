// Decides which weight the trainer Progress tab shows for a client.
// Flow: try today's log → try newest log → fall back to profile. A second helper picks the "was" number.
// Used by: the trainer progress hero card. Sources disagree, so the order lives in one place.

// ===== NAMED CONSTANTS =====

// Empty string is treated like "no value" even though Number('') is 0.
const EMPTY_WEIGHT_TEXT = '';

// ===== HELPER FUNCTIONS =====

/**
 * Firestore sends numbers, numeric strings, blanks, and null. Only a real number gets through.
 * @param {unknown} value
 * @returns {number|null}
 */
function parseFiniteWeight(value) {
  // vocab: == null is true for both null and undefined.
  const isMissing = value == null || value === EMPTY_WEIGHT_TEXT;
  if (isMissing) return null;

  const numericWeight = Number(value);
  const isRealNumber = Number.isFinite(numericWeight);
  if (!isRealNumber) return null;
  return numericWeight;
}

/**
 * Walk a priority list and return the first weight that parses.
 * @param {unknown[]} weightCandidates
 * @returns {number|null}
 */
function firstFiniteWeightAmong(weightCandidates) {
  for (let i = 0; i < weightCandidates.length; i += 1) {
    const parsedWeight = parseFiniteWeight(weightCandidates[i]);
    if (parsedWeight != null) return parsedWeight;
  }
  return null;
}

// ===== MAIN FUNCTION =====

/**
 * Today's log first. The profile value is last because it is often the old onboarding number.
 * @param {{ todayDashboardWeight?: unknown, latestLoggedWeight?: unknown, profileWeight?: unknown }} [sources]
 * @returns {number|null}
 */
export function resolveTrainerProgressCurrentWeight({
  todayDashboardWeight,
  latestLoggedWeight,
  profileWeight,
} = {}) {
  // 1. Prefer the number the client logged today on the dashboard.
  // 2. Else the newest historical log.
  // 3. Else whatever is on the profile (often stale).
  return firstFiniteWeightAmong([
    todayDashboardWeight,
    latestLoggedWeight,
    profileWeight,
  ]);
}

/**
 * Baseline for "Was X lbs". A real 0 stays, because ?? does not treat 0 as empty.
 * @param {{ startingWeight?: unknown, profileWeight?: unknown, crmStartingWeight?: unknown, crmWeight?: unknown }} [sources]
 * @returns {number|null}
 */
export function resolveTrainerProgressBeforeWeight({
  startingWeight,
  profileWeight,
  crmStartingWeight,
  crmWeight,
} = {}) {
  // vocab/symbol: ?? = use the right side only when the left is null or undefined (0 is kept).
  return firstFiniteWeightAmong([
    startingWeight,
    crmStartingWeight,
    profileWeight,
    crmWeight,
  ]);
}
