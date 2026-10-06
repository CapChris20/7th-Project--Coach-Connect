// Decides which weight the trainer Progress tab shows for a client.
// Flow: today's log wins, then the newest log, then the profile. A second helper picks the "was" number.
// Used by: the trainer progress hero card. The sources disagree, so the order lives in one place.

// ===== NAMED CONSTANTS =====

// ===== HELPER FUNCTIONS =====

/**
 * Firestore sends numbers, numeric strings, blanks, and null. Only a real number gets through.
 * @param {unknown} value
 * @returns {number|null}
 */
function parseFiniteWeight(value) {
  // vocab: == null is true for both null and undefined.
  if (value == null || value === '') return null;
  const numericWeight = Number(value);
  if (!Number.isFinite(numericWeight)) return null;
  return numericWeight;
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
  const todayWeight = parseFiniteWeight(todayDashboardWeight);
  if (todayWeight != null) return todayWeight;
  const loggedWeight = parseFiniteWeight(latestLoggedWeight);
  if (loggedWeight != null) return loggedWeight;
  return parseFiniteWeight(profileWeight);
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
  return (
    parseFiniteWeight(startingWeight)
    ?? parseFiniteWeight(crmStartingWeight)
    ?? parseFiniteWeight(profileWeight)
    ?? parseFiniteWeight(crmWeight)
  );
}
