// Decides which weight number the trainer's Progress tab shows for a client.
// Flow: several possible weight sources arrive → each resolver picks the first trustworthy one.
// Why it exists: weight lives in a few places (today's log, past logs, profile, CRM record) and
// they disagree. Centralizing the priority order keeps the hero card from flip-flopping.

/**
 * Resolve trainer Progress tab weight display per client.
 * Priority: today's log → most recent log → live profile weight from users/{id}.
 */

// Gatekeeper for every source below: only real, usable numbers get through.
// Firestore fields come back as numbers, numeric strings, empty strings, null, or missing —
// so we normalize once here instead of guarding at each call site.
function parseFiniteWeight(value) {
  // vocab/symbol: == null is true for BOTH null and undefined (the one place loose equality helps)
  if (value == null || value === '') return null;
  const n = Number(value);
  // vocab: Number.isFinite = a real number, excluding NaN and Infinity. Number('abc') is NaN,
  // which would otherwise render as "NaN lbs" on the card.
  return Number.isFinite(n) ? n : null;
}

/** Current weight shown on the hero card. */
export function resolveTrainerProgressCurrentWeight({
  todayDashboardWeight,
  latestLoggedWeight,
  profileWeight,
} = {}) {
  // Manipulate here: this is the freshness ranking — reorder these three blocks to change which
  // source wins. Today's log first because it's what the client just entered; the profile value
  // is last because it's often stale onboarding data.
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
  // Same idea as above, written as a ?? chain because every branch is just "next fallback".
  // vocab/symbol: ?? = use the right side only when the left is null/undefined — safe here
  // because parseFiniteWeight already turned bad data into null, and a legitimate 0 lbs
  // would still pass through (unlike ||, which would treat 0 as "empty" and skip it).
  // Manipulate here: reorder to change which baseline "Was X lbs" compares against.
  return (
    parseFiniteWeight(startingWeight) ??
    parseFiniteWeight(crmStartingWeight) ??
    parseFiniteWeight(profileWeight) ??
    parseFiniteWeight(crmWeight)
  );
}
