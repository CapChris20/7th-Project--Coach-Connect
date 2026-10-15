// Turns a week's stats into coach-facing tips: adherence, red flags, and a sign-off note.
// Flow: planned days from report or profile → adherence label → scan days for flags → pick a note.
// Used by: prepareReportForScreen, which feeds the weekly report for trainers and clients.

// ===== NAMED CONSTANTS =====

const NOT_AVAILABLE_LABEL = 'N/A';
const MIN_PLANNED_DAYS = 1;
const MAX_PLANNED_DAYS = 7;
const WEEK_DAY_COUNT = 7;
const PERCENT_COMPLETE = 100;
const ADHERENCE_CLOSE_PERCENT = 75;
const LOW_CHECKIN_DAYS = 4;
const LOW_SLEEP_HOURS = 6.5;
const HIGH_SORENESS = 7;
const SORENESS_SCALE_MAX = 8;
const MIN_SESSIONS_FLOOR = 1;
const TRAINING_GAP_MIN_CHECKINS = 3;
const WATER_GOAL_OZ = 64;
const HYDRATION_MIN_CHECKINS = 4;
const HYDRATION_MAX_GOAL_DAYS = 1;
const MAX_RED_FLAGS = 4;
const NOTE_SOURCE_COACH = 'coach';
const NOTE_SOURCE_AUTO = 'auto';
const PAIN_NOTE_PATTERN = /\bpain\b|injury|hurt|strain|twist/i;

// ===== HELPER FUNCTIONS =====

/**
 * Parse a report number. Empty, missing, or "N/A" is not a number.
 * @param {*} rawValue
 * @returns {number|null}
 */
function parseReportNumber(rawValue) {
  if (rawValue == null || rawValue === '' || rawValue === NOT_AVAILABLE_LABEL) return null;
  const numericValue = parseFloat(String(rawValue).replace(/,/g, ''));
  return Number.isFinite(numericValue) ? numericValue : null;
}

/**
 * Pull display text out of a string or a { text } object.
 * @param {*} rawValue
 * @returns {string}
 */
function reportText(rawValue) {
  if (rawValue == null) return '';
  if (typeof rawValue === 'string') return rawValue.trim();
  if (typeof rawValue === 'object' && rawValue.text) return String(rawValue.text).trim();
  return String(rawValue).trim();
}

/**
 * @param {number} plannedDays
 * @returns {boolean}
 */
function isValidPlannedDays(plannedDays) {
  return plannedDays != null && plannedDays >= MIN_PLANNED_DAYS && plannedDays <= MAX_PLANNED_DAYS;
}

/**
 * @param {number} percent
 * @returns {string}
 */
function adherenceSublabel(percent) {
  if (percent >= PERCENT_COMPLETE) return 'Plan completed — nice work';
  if (percent >= ADHERENCE_CLOSE_PERCENT) return 'Close to target';
  return 'Below planned volume';
}

/**
 * @param {number} checkInDays
 * @returns {object|null}
 */
function checkInFlag(checkInDays) {
  if (checkInDays === 0) {
    return {
      id: 'no-checkins',
      tone: 'alert',
      title: 'No check-ins',
      detail: 'Nothing logged this week yet',
    };
  }
  if (checkInDays < LOW_CHECKIN_DAYS) {
    return {
      id: 'low-checkins',
      tone: 'warn',
      title: 'Sparse logging',
      detail: `Only ${checkInDays}/${WEEK_DAY_COUNT} days have data`,
    };
  }
  return null;
}

/**
 * @param {number|null} averageSleep
 * @returns {object|null}
 */
function sleepFlag(averageSleep) {
  if (!(averageSleep != null && averageSleep < LOW_SLEEP_HOURS)) return null;
  return {
    id: 'low-sleep',
    tone: 'warn',
    title: 'Sleep under target',
    detail: `Averaging ${averageSleep}h — aim for 7+`,
  };
}

/**
 * @param {object[]} days
 * @returns {object|null}
 */
function sorenessFlag(days) {
  const soreDays = days.filter((dayEntry) => dayEntry.soreness != null && dayEntry.soreness >= HIGH_SORENESS);
  if (soreDays.length === 0) return null;
  const dayWord = soreDays.length === 1 ? '' : 's';
  return {
    id: 'soreness',
    tone: 'alert',
    title: 'High soreness flagged',
    detail: `${soreDays.length} day${dayWord} at ${HIGH_SORENESS}+/${SORENESS_SCALE_MAX}`,
  };
}

/**
 * @param {object[]} days
 * @returns {object|null}
 */
function painNoteFlag(days) {
  const painNotes = days.filter((dayEntry) => PAIN_NOTE_PATTERN.test(String(dayEntry.notes || '')));
  if (painNotes.length === 0) return null;
  return {
    id: 'pain-note',
    tone: 'alert',
    title: 'Pain mentioned',
    detail: 'Review notes before next session',
  };
}

/**
 * @param {number|null} plannedDays
 * @param {number} workoutDaysLogged
 * @param {number} checkInDays
 * @returns {object|null}
 */
function trainingGapFlag(plannedDays, workoutDaysLogged, checkInDays) {
  const hasEnoughCheckIns = checkInDays >= TRAINING_GAP_MIN_CHECKINS;
  const isBelowPlan = plannedDays != null && workoutDaysLogged < Math.max(MIN_SESSIONS_FLOOR, plannedDays - 1);
  if (!isBelowPlan || !hasEnoughCheckIns) return null;
  return {
    id: 'training-gap',
    tone: 'warn',
    title: 'Training below plan',
    detail: `${workoutDaysLogged}/${plannedDays} sessions logged`,
  };
}

/**
 * @param {object[]} days
 * @param {number} checkInDays
 * @returns {object|null}
 */
function hydrationFlag(days, checkInDays) {
  const waterGoalDays = days.filter((dayEntry) => dayEntry.waterOz >= WATER_GOAL_OZ).length;
  const hasEnoughCheckIns = checkInDays >= HYDRATION_MIN_CHECKINS;
  const isHydrationOff = waterGoalDays <= HYDRATION_MAX_GOAL_DAYS;
  if (!hasEnoughCheckIns || !isHydrationOff) return null;
  const dayWord = waterGoalDays === 1 ? '' : 's';
  return {
    id: 'hydration',
    tone: 'warn',
    title: 'Hydration off',
    detail: `${waterGoalDays} day${dayWord} hit ${WATER_GOAL_OZ}+ oz`,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Planned training days this week from the report, or the client's profile as a fallback.
 * @param {object} report
 * @param {object} [clientMeta]
 * @returns {number|null}
 */
export function resolvePlannedTrainingDays(report, clientMeta = {}) {
  const fromReport =
    parseReportNumber(report?.plannedTrainingDays) ??
    parseReportNumber(report?.daysPerWeek) ??
    parseReportNumber(report?.trainingDaysPerWeek);
  if (isValidPlannedDays(fromReport)) return Math.round(fromReport);

  const fromProfile = parseReportNumber(clientMeta?.daysPerWeek);
  if (isValidPlannedDays(fromProfile)) return Math.round(fromProfile);

  return null;
}

/**
 * How many planned sessions the client actually logged.
 * @param {object} stats
 * @param {object} report
 * @param {object} [clientMeta]
 * @returns {object}
 */
export function buildWorkoutAdherence(stats, report, clientMeta = {}) {
  const completed = stats?.workoutDaysLogged ?? 0;
  const planned = resolvePlannedTrainingDays(report, clientMeta);
  const dayWord = completed === 1 ? '' : 's';

  if (planned == null) {
    return {
      completed,
      planned: null,
      label: `${completed} training day${dayWord} logged`,
      sublabel: completed > 0 ? 'Add days/week in profile for adherence tracking' : 'Log workouts to see training volume',
      pct: null,
    };
  }

  const percent = planned > 0 ? Math.min(PERCENT_COMPLETE, Math.round((completed / planned) * PERCENT_COMPLETE)) : 0;
  return {
    completed,
    planned,
    label: `${completed} of ${planned} sessions`,
    sublabel: adherenceSublabel(percent),
    pct: percent,
  };
}

/**
 * Ordered list of problems the trainer should see first. Capped so the card stays scannable.
 * @param {object} stats
 * @param {object[]} [days]
 * @param {object} [report]
 * @param {object} [clientMeta]
 * @returns {object[]}
 */
export function buildRedFlags(stats, days = [], report = {}, clientMeta = {}) {
  const flags = [];
  const checkInDays = stats?.checkInDays ?? 0;
  const averageSleep = parseReportNumber(report?.avgSleep) ?? stats?.avgSleep;
  const workoutDaysLogged = stats?.workoutDaysLogged ?? 0;
  const plannedDays = resolvePlannedTrainingDays(report, clientMeta);

  const maybeCheckIn = checkInFlag(checkInDays);
  if (maybeCheckIn) flags.push(maybeCheckIn);

  const maybeSleep = sleepFlag(averageSleep);
  if (maybeSleep) flags.push(maybeSleep);

  const maybeSoreness = sorenessFlag(days);
  if (maybeSoreness) flags.push(maybeSoreness);

  const maybePain = painNoteFlag(days);
  if (maybePain) flags.push(maybePain);

  const maybeTrainingGap = trainingGapFlag(plannedDays, workoutDaysLogged, checkInDays);
  if (maybeTrainingGap) flags.push(maybeTrainingGap);

  const maybeHydration = hydrationFlag(days, checkInDays);
  if (maybeHydration) flags.push(maybeHydration);

  return flags.slice(0, MAX_RED_FLAGS);
}

/**
 * Prefer a typed coach note; fall back to the auto sign-off.
 * @param {object} report
 * @param {object} [clientMeta]
 * @returns {{ text: string, source: string }|null}
 */
export function buildTrainerNote(report, clientMeta = {}) {
  const manualNote =
    reportText(report?.trainerNote) ||
    reportText(report?.coachNote) ||
    reportText(clientMeta?.trainerNote);
  const autoNote = reportText(report?.signOff);

  if (manualNote) {
    return { text: manualNote, source: NOTE_SOURCE_COACH };
  }
  if (autoNote) {
    return { text: autoNote, source: NOTE_SOURCE_AUTO };
  }
  return null;
}

/**
 * Bundle adherence, red flags, and the trainer note for one weekly report.
 * Flow: 1. adherence  2. flags from this week's days  3. coach or auto note
 * @param {object} stats
 * @param {object[]} days
 * @param {object} report
 * @param {object} [clientMeta]
 * @returns {{ workoutAdherence: object, redFlags: Array, trainerNote: object|null }}
 */
export function writeTrainerTips(stats, days, report, clientMeta = {}) {
  return {
    workoutAdherence: buildWorkoutAdherence(stats, report, clientMeta),
    redFlags: buildRedFlags(stats, days, report),
    trainerNote: buildTrainerNote(report, clientMeta),
  };
}
