'use strict';

const WORKOUT_GENERATION_LIMIT = 3;
const USAGE_DOC_ID = 'workout_generations';

function currentMonthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** First calendar day of next month — "YYYY-MM-01" */
function nextMonthResetsAt(d = new Date()) {
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function formatLimitMessage(resetsAt) {
  const d = new Date(`${resetsAt}T12:00:00`);
  const label = Number.isNaN(d.getTime())
    ? resetsAt
    : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return `You've used all ${WORKOUT_GENERATION_LIMIT} workout plan generations for this month. Your limit resets on ${label}.`;
}

function buildUsagePayload(used) {
  return {
    generations_used: used,
    generations_limit: WORKOUT_GENERATION_LIMIT,
    resets_at: nextMonthResetsAt(),
  };
}

function usageDocRef(db, userId) {
  return db.collection('users').doc(userId).collection('usage').doc(USAGE_DOC_ID);
}

async function getWorkoutGenerationUsage(db, userId) {
  const month = currentMonthKey();
  const snap = await usageDocRef(db, userId).get();
  let used = 0;
  if (snap.exists) {
    const data = snap.data() || {};
    if (data.month === month) {
      used = Number(data.count) || 0;
    }
  }
  return {
    used,
    limit: WORKOUT_GENERATION_LIMIT,
    allowed: used < WORKOUT_GENERATION_LIMIT,
    usage: buildUsagePayload(used),
    resets_at: nextMonthResetsAt(),
  };
}

/** Pre-flight check before Claude workout generation. */
async function assertWorkoutGenerationAllowed(db, userId) {
  return getWorkoutGenerationUsage(db, userId);
}

/** Increment after a successful Claude response (transactional read + write). */
async function recordSuccessfulWorkoutGeneration(db, userId, serverTs) {
  const ref = usageDocRef(db, userId);
  const month = currentMonthKey();

  const newCount = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    let count = 0;
    if (snap.exists) {
      const data = snap.data() || {};
      if (data.month === month) {
        count = Number(data.count) || 0;
      }
    }
    const nextCount = count + 1;
    tx.set(
      ref,
      {
        count: nextCount,
        month,
        last_generated: serverTs(),
      },
      { merge: true },
    );
    return nextCount;
  });

  return buildUsagePayload(newCount);
}

module.exports = {
  WORKOUT_GENERATION_LIMIT,
  currentMonthKey,
  nextMonthResetsAt,
  formatLimitMessage,
  buildUsagePayload,
  getWorkoutGenerationUsage,
  assertWorkoutGenerationAllowed,
  recordSuccessfulWorkoutGeneration,
};
