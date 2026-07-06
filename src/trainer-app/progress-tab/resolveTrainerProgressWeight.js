/**
 * Resolve trainer Progress tab weight display per client.
 * Priority: today's log → most recent log → live profile weight from users/{id}.
 */

function parseFiniteWeight(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Current weight shown on the hero card. */
export function resolveTrainerProgressCurrentWeight({
  todayDashboardWeight,
  latestLoggedWeight,
  profileWeight,
} = {}) {
  const today = parseFiniteWeight(todayDashboardWeight);
  if (today != null) return today;
  const logged = parseFiniteWeight(latestLoggedWeight);
  if (logged != null) return logged;
  return parseFiniteWeight(profileWeight);
}

/** Baseline for "Was X lbs" — starting weight when set, else profile weight at load. */
export function resolveTrainerProgressBeforeWeight({
  startingWeight,
  profileWeight,
  crmStartingWeight,
  crmWeight,
} = {}) {
  return (
    parseFiniteWeight(startingWeight) ??
    parseFiniteWeight(crmStartingWeight) ??
    parseFiniteWeight(profileWeight) ??
    parseFiniteWeight(crmWeight)
  );
}
