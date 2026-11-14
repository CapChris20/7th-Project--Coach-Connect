// Turns a week's stats into coach-facing tips: adherence, red flags, and a sign-off note.
// Flow: resolve planned days → adherence label → scan days for flags → prefer coach note over auto.
// Used by: prepareReportForScreen, which feeds the weekly report for trainers and clients.
// Read order: constants → main recipes → PLUMBING (parsers + each red-flag builder).

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

// ===== MAIN FUNCTION =====

/**
 * Bundle adherence, red flags, and the trainer note for one weekly report.
 * Flow: 1. adherence  2. red flags  3. coach or auto note
 * @param {object} stats
 * @param {Array<object>} days
 * @param {object} report
 * @param {object} [clientMeta]
 * @returns {{ workoutAdherence: object, redFlags: Array, trainerNote: object|null }}
 */
export function writeTrainerTips(stats, days, report, clientMeta = {}) {
  // 1. How many planned sessions did they hit?
  const workoutAdherence = buildWorkoutAdherence(stats, report, clientMeta);

  // 2. What problems should the coach see first?
  const redFlags = buildRedFlags(stats, days, report, clientMeta);

  // 3. Coach-typed note or auto sign-off
  const trainerNote = buildTrainerNote(report, clientMeta);

  return { workoutAdherence, redFlags, trainerNote };
}

/**
 * Planned training days from the report or client profile fallback.
 * @param {object} report
 * @param {object} [clientMeta]
 * @returns {number|null}
 */
export function resolvePlannedTrainingDays(report, clientMeta = {}) {
  // 1. Prefer explicit fields on the weekly summary doc
  const fromReport =
    parseReportNumber(report?.plannedTrainingDays) ??
    parseReportNumber(report?.daysPerWeek) ??
    parseReportNumber(report?.trainingDaysPerWeek);
  if (plannedDaysCountIsValid(fromReport)) {
    return Math.round(fromReport);
  }

  // 2. Fall back to profile days/week when the report omitted it
  const fromProfile = parseReportNumber(clientMeta?.daysPerWeek);
  if (plannedDaysCountIsValid(fromProfile)) {
    return Math.round(fromProfile);
  }

  return null;
}

/**
 * How many planned sessions the client actually logged.
 * @param {object} stats
 * @param {object} report
 * @param {object} [clientMeta]
 * @returns {{ completed: number, planned: number|null, label: string, sublabel: string, pct: number|null }}
 */
export function buildWorkoutAdherence(stats, report, clientMeta = {}) {
  const completedSessions = stats?.workoutDaysLogged ?? 0;
  const plannedSessions = resolvePlannedTrainingDays(report, clientMeta);
  const dayWord = completedSessions === 1 ? '' : 's';

  // No plan on file — show volume only and nudge the coach to set days/week
  if (plannedSessions == null) {
    return adherenceWithoutPlan(completedSessions, dayWord);
  }

  const percentComplete = percentOfPlan(completedSessions, plannedSessions);

  return {
    completed: completedSessions,
    planned: plannedSessions,
    label: `${completedSessions} of ${plannedSessions} sessions`,
    sublabel: adherenceSublabelForPercent(percentComplete),
    pct: percentComplete,
  };
}

/**
 * Ordered red-flag list for the trainer card (capped for scanability).
 * @param {object} stats
 * @param {Array<object>} [days]
 * @param {object} [report]
 * @param {object} [clientMeta]
 * @returns {Array<object>}
 */
export function buildRedFlags(stats, days = [], report = {}, clientMeta = {}) {
  const flags = [];
  const checkInDays = stats?.checkInDays ?? 0;
  const averageSleep = parseReportNumber(report?.avgSleep) ?? stats?.avgSleep;
  const workoutDaysLogged = stats?.workoutDaysLogged ?? 0;
  const plannedDays = resolvePlannedTrainingDays(report, clientMeta);

  // Order matters: logging gaps first, then recovery signals, then plan/hydration
  pushFlagIfPresent(flags, redFlagForCheckIns(checkInDays));
  pushFlagIfPresent(flags, redFlagForSleep(averageSleep));
  pushFlagIfPresent(flags, redFlagForSoreness(days));
  pushFlagIfPresent(flags, redFlagForPainNotes(days));
  pushFlagIfPresent(flags, redFlagForTrainingGap(plannedDays, workoutDaysLogged, checkInDays));
  pushFlagIfPresent(flags, redFlagForHydration(days, checkInDays));

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
    reportTextValue(report?.trainerNote) ||
    reportTextValue(report?.coachNote) ||
    reportTextValue(clientMeta?.trainerNote);
  const autoNote = reportTextValue(report?.signOff);

  if (manualNote) {
    return { text: manualNote, source: NOTE_SOURCE_COACH };
  }
  if (autoNote) {
    return { text: autoNote, source: NOTE_SOURCE_AUTO };
  }
  return null;
}

// ===== HELPER FUNCTIONS =====

function pushFlagIfPresent(flags, flagOrNull) {
  if (!flagOrNull) return;
  flags.push(flagOrNull);
}

function adherenceWithoutPlan(completedSessions, dayWord) {
  let sublabel = 'Log workouts to see training volume';
  if (completedSessions > 0) {
    sublabel = 'Add days/week in profile for adherence tracking';
  }

  return {
    completed: completedSessions,
    planned: null,
    label: `${completedSessions} training day${dayWord} logged`,
    sublabel,
    pct: null,
  };
}

function percentOfPlan(completedSessions, plannedSessions) {
  if (plannedSessions <= 0) return 0;
  return Math.min(
    PERCENT_COMPLETE,
    Math.round((completedSessions / plannedSessions) * PERCENT_COMPLETE),
  );
}

// ===== PLUMBING — skip unless debugging =====

function parseReportNumber(rawValue) {
  if (rawValue == null || rawValue === '' || rawValue === NOT_AVAILABLE_LABEL) return null;
  const numericValue = parseFloat(String(rawValue).replace(/,/g, ''));
  return Number.isFinite(numericValue) ? numericValue : null;
}

function reportTextValue(rawValue) {
  if (rawValue == null) return '';
  if (typeof rawValue === 'string') return rawValue.trim();
  if (typeof rawValue === 'object' && rawValue.text) return String(rawValue.text).trim();
  return String(rawValue).trim();
}

function plannedDaysCountIsValid(plannedDays) {
  return plannedDays != null && plannedDays >= MIN_PLANNED_DAYS && plannedDays <= MAX_PLANNED_DAYS;
}

function adherenceSublabelForPercent(percent) {
  if (percent >= PERCENT_COMPLETE) return 'Plan completed — nice work';
  if (percent >= ADHERENCE_CLOSE_PERCENT) return 'Close to target';
  return 'Below planned volume';
}

function redFlagForCheckIns(checkInDays) {
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

function redFlagForSleep(averageSleep) {
  if (averageSleep == null) return null;
  if (!(averageSleep < LOW_SLEEP_HOURS)) return null;
  return {
    id: 'low-sleep',
    tone: 'warn',
    title: 'Sleep under target',
    detail: `Averaging ${averageSleep}h — aim for 7+`,
  };
}

function countHighSorenessDays(days) {
  let soreDayCount = 0;
  for (const dayEntry of days) {
    if (dayEntry.soreness == null) continue;
    if (dayEntry.soreness >= HIGH_SORENESS) soreDayCount += 1;
  }
  return soreDayCount;
}

function redFlagForSoreness(days) {
  const soreDayCount = countHighSorenessDays(days);
  if (soreDayCount === 0) return null;
  const dayWord = soreDayCount === 1 ? '' : 's';
  return {
    id: 'soreness',
    tone: 'alert',
    title: 'High soreness flagged',
    detail: `${soreDayCount} day${dayWord} at ${HIGH_SORENESS}+/${SORENESS_SCALE_MAX}`,
  };
}

function dayMentionsPain(dayEntry) {
  return PAIN_NOTE_PATTERN.test(String(dayEntry.notes || ''));
}

function redFlagForPainNotes(days) {
  let painNoteCount = 0;
  for (const dayEntry of days) {
    if (dayMentionsPain(dayEntry)) painNoteCount += 1;
  }
  if (painNoteCount === 0) return null;
  return {
    id: 'pain-note',
    tone: 'alert',
    title: 'Pain mentioned',
    detail: 'Review notes before next session',
  };
}

function redFlagForTrainingGap(plannedDays, workoutDaysLogged, checkInDays) {
  const hasEnoughCheckIns = checkInDays >= TRAINING_GAP_MIN_CHECKINS;
  const sessionsFloor = Math.max(MIN_SESSIONS_FLOOR, plannedDays - 1);
  const isBelowPlan = plannedDays != null && workoutDaysLogged < sessionsFloor;
  if (!isBelowPlan || !hasEnoughCheckIns) return null;
  return {
    id: 'training-gap',
    tone: 'warn',
    title: 'Training below plan',
    detail: `${workoutDaysLogged}/${plannedDays} sessions logged`,
  };
}

function countWaterGoalDays(days) {
  let waterGoalDays = 0;
  for (const dayEntry of days) {
    if (dayEntry.waterOz >= WATER_GOAL_OZ) waterGoalDays += 1;
  }
  return waterGoalDays;
}

function redFlagForHydration(days, checkInDays) {
  const waterGoalDays = countWaterGoalDays(days);
  const hasEnoughCheckIns = checkInDays >= HYDRATION_MIN_CHECKINS;
  const hydrationOff = waterGoalDays <= HYDRATION_MAX_GOAL_DAYS;
  if (!hasEnoughCheckIns || !hydrationOff) return null;
  const dayWord = waterGoalDays === 1 ? '' : 's';
  return {
    id: 'hydration',
    tone: 'warn',
    title: 'Hydration off',
    detail: `${waterGoalDays} day${dayWord} hit ${WATER_GOAL_OZ}+ oz`,
  };
}
