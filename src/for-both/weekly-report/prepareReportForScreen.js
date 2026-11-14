// Maps raw weeklySummaries Firestore rows into the week object WeeklyReportBody expects.
// Flow: seven day lines → nutrition + daily log merge → stats and trend percents → coaching + trainer tips.
// Used by WeeklyReportScreen right after it loads summaries and fetchNutritionByDayForRange totals.
// Read order: constants → main recipes → day/stats helpers → PLUMBING (parsers + number math).

import { pickBestTips } from './pickBestTips';
import { writeTrainerTips } from './writeTrainerTips';
import { accentGradients, navAccentGradient } from '../../look-and-feel/colorPalette';

// Manipulate here: highlight accents — brand / accentGradients only (never purple #BE185D / #4C1D95)
const HIGHLIGHT_GRAD = {
  checkIns: navAccentGradient,
  workouts: accentGradients[1] || navAccentGradient,
  sleep: accentGradients[4] || navAccentGradient,
  water: accentGradients[6] || navAccentGradient,
  energy: accentGradients[0] || navAccentGradient,
  weight: accentGradients[8] || navAccentGradient
};

// ===== NAMED CONSTANTS =====

const EMPTY_DISPLAY = '—';
const STEPS_THOUSAND = 1000;
const WATER_GOAL_OZ = 64;
const DAYS_IN_WEEK = 7;
const ENERGY_SCALE_MAX = 8;
const WATER_OZ_PER_CUP = 8;
const NOON_ISO_SUFFIX = 'T12:00:00';
const DATE_KEY_LENGTH = 10;
const TIP_LIMIT = 5;
const TREND_FULL_DROP = -100;
const TREND_FULL_RISE = 100;
const ONE_DECIMAL_FACTOR = 10;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHORT_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
function emptyCheckInLineForDayName(dayName) {
  return `${dayName} (): No check-in for this day.`;
}

// ===== MAIN FUNCTION =====

/**
 * Build one screen-ready week from a raw report + optional previous week for trends.
 * Flow: 1. label + days  2. stats/coaching  3. previous week  4. pack the body object
 * @param {object} report
 * @param {object|null} prevReport
 * @param {{ parseDayNote: Function, parseStructuredDayNote: Function, formatDateRange: Function }} parsers
 * @param {object} [nutritionByDay]
 * @param {object} [dailyLogsByDay]
 * @param {Function|null} [workoutsFromDailyLog]
 * @param {object} [clientMeta]
 * @returns {object|null}
 */
export function prepareReportForScreenToWeekReport(report, prevReport, parsers, nutritionByDay = {}, dailyLogsByDay = {}, workoutsFromDailyLog = null, clientMeta = {}) {
  if (!report || !parsers) return null;
  const {
    parseDayNote,
    parseStructuredDayNote,
    formatDateRange
  } = parsers;

  // 1. Week label and seven parsed days (check-in text + nutrition_by_day merge)
  const weekStart = report.weekStart || report.weekId || '';
  const dates = formatDateRange(report);
  const days = parseWeekDays(report, parseDayNote, parseStructuredDayNote, nutritionByDay, dailyLogsByDay, workoutsFromDailyLog);

  // 2. Averages, overview chips, and filtered pros/cons/focus
  const stats = computeStats(days, report);
  const coaching = buildCoachingSections(report);
  const weekWorkoutDays = buildWeekWorkoutDays(days);
  const overviewHighlights = buildOverviewHighlights(stats, days, report);

  // 3. Trend percents need the next-older week in the same shape
  const previousWeekStats = statsForPreviousReport(prevReport, parseDayNote, parseStructuredDayNote, nutritionByDay, dailyLogsByDay, workoutsFromDailyLog);

  // 4. Single object the body reads — trainerInsights from writeTrainerTips stays separate key
  const loggedDays = [];
  const skippedDays = [];
  for (const day of days) {
    if (dayHasData(day)) loggedDays.push(day);else skippedDays.push(day);
  }
  return {
    id: report.id || weekStart,
    label: dates.compact,
    startDate: weekStart,
    endDate: report.weekEnd || weekStart,
    stats: addTrends(stats, previousWeekStats),
    days,
    weekWorkoutDays,
    overviewHighlights,
    loggedDays,
    skippedDays,
    trainerInsights: writeTrainerTips(stats, days, report, clientMeta),
    ...coaching,
    signOff: textForReport(report.signOff),
    clientName: textForReport(report.clientDisplayName || report.clientName || report.athleteName || '')
  };
}

/**
 * Map a newest-first report list into screen weeks (each entry trends against the next older one).
 * @param {Array<object>} reports
 * @param {{ parseDayNote: Function, parseStructuredDayNote: Function, formatDateRange: Function }} parsers
 * @param {object} [nutritionByDay]
 * @param {object} [dailyLogsByDay]
 * @param {Function|null} [workoutsFromDailyLog]
 * @param {object} [clientMeta]
 * @returns {Array<object>}
 */
export function prepareReportForScreensToWeeks(reports, parsers, nutritionByDay = {}, dailyLogsByDay = {}, workoutsFromDailyLog = null, clientMeta = {}) {
  const weeks = [];

  // 1. Newest-first list — each week trends against the next older raw doc in the array
  for (let reportIndex = 0; reportIndex < reports.length; reportIndex += 1) {
    const week = prepareReportForScreenToWeekReport(reports[reportIndex], reports[reportIndex + 1] || null, parsers, nutritionByDay, dailyLogsByDay, workoutsFromDailyLog, clientMeta);
    if (week) weeks.push(week);
  }
  return weeks;
}

/**
 * Plain-text day line for share / export.
 * @param {object} day
 * @returns {string}
 */
export function formatDayForShare(day) {
  const parts = [`${day.fullDayName} (${day.date})`];

  // 1. Empty day — one short line for PDF / share HTML
  if (!day.hasCheckIn && !dayHasData(day)) {
    parts.push('No check-in');
    return parts.join(': ');
  }

  // 2. Metric fragments joined with periods; workout block and notes after
  const metrics = collectShareMetricFragments(day);
  if (metrics.length) parts.push(metrics.join('. '));
  appendWorkoutOrRecoveryShareLine(parts, day);
  if (day.notes) parts.push(`Note: ${day.notes}`);
  if (day.summaryFallback) parts.push(day.summaryFallback);
  return parts.join('. ');
}

// ===== HELPER FUNCTIONS =====

function statsForPreviousReport(prevReport, parseDayNote, parseStructuredDayNote, nutritionByDay, dailyLogsByDay, workoutsFromDailyLog) {
  if (!prevReport) return null;
  const previousDays = parseWeekDays(prevReport, parseDayNote, parseStructuredDayNote, nutritionByDay, dailyLogsByDay, workoutsFromDailyLog);
  return computeStats(previousDays, prevReport);
}
function collectShareMetricFragments(day) {
  const metrics = [];
  if (day.sleepHours > 0) metrics.push(`Sleep ${day.sleepHours}h`);
  if (day.waterOz > 0) metrics.push(`Water ${day.waterOz}oz`);
  if (day.steps > 0) metrics.push(`${day.steps} steps`);
  if (day.energy != null) metrics.push(`Energy ${day.energy}/${ENERGY_SCALE_MAX}`);
  if (day.mood != null) metrics.push(`Mood ${day.mood}/4`);
  if (day.stress != null) metrics.push(`Stress ${day.stress}/8`);
  if (day.soreness != null) metrics.push(`Soreness ${day.soreness}/8`);
  if (day.weight != null) metrics.push(`Weight ${day.weight} lbs`);
  if (day.bodyFat != null) metrics.push(`Body fat ${day.bodyFat}%`);
  if (day.workoutRating != null) metrics.push(`Workout rating ${day.workoutRating}/10`);
  if (day.calories > 0) metrics.push(`${day.calories} cal`);
  if (day.protein > 0) metrics.push(`${day.protein}g protein`);
  return metrics;
}
function formatOneWorkoutForShare(workout) {
  if (workout.setsDetail) {
    return `${workout.name} (${workout.setsCount || '?'} sets: ${workout.setsDetail})`;
  }
  return workout.name;
}
function workoutShareLines(workouts) {
  const workoutLines = [];
  for (const workout of workouts) {
    workoutLines.push(formatOneWorkoutForShare(workout));
  }
  return workoutLines;
}
function appendWorkoutOrRecoveryShareLine(parts, day) {
  const workouts = day.workouts || [];
  if (workouts.length > 0) {
    parts.push(`Workout: ${workoutShareLines(workouts).join('; ')}`);
    return;
  }
  if (day.isRecovery) {
    parts.push('Rest / recovery day');
  }
}
function buildCoachingSections(report) {
  const rawPros = dedupeStringList([...mapReportTexts(report == null ? void 0 : report.pros), ...mapReportTexts(report == null ? void 0 : report.wins)]);
  const rawCons = dedupeStringList(mapReportTexts(report == null ? void 0 : report.cons));
  const focus = dedupeStringList(mapReportTexts(report == null ? void 0 : report.focus));
  const trends = dedupeStringList(mapReportTexts(report == null ? void 0 : report.trends));
  const summary = textForReport(report == null ? void 0 : report.summary);
  return {
    pros: pickBestTips(rawPros, TIP_LIMIT),
    cons: pickBestTips(rawCons, TIP_LIMIT),
    focus,
    trends,
    summary,
    insights: []
  };
}
function mapReportTexts(maybeList) {
  const texts = [];
  if (!Array.isArray(maybeList)) return texts;
  for (const entry of maybeList) {
    texts.push(textForReport(entry));
  }
  return texts;
}
function emptyCheckInDay(isoDate, fullDayName, shortDayName, shortLabel, nutrition) {
  return {
    date: isoDate,
    dayName: shortDayName,
    fullDayName,
    shortLabel,
    sleepHours: 0,
    waterOz: 0,
    steps: 0,
    calories: roundToWholeNumber(nutrition.calories),
    protein: roundToOneDecimal(nutrition.protein),
    carbs: roundToOneDecimal(nutrition.carbs),
    fat: roundToOneDecimal(nutrition.fat),
    energy: null,
    mood: null,
    stress: null,
    soreness: null,
    weight: null,
    bodyFat: null,
    workoutRating: null,
    pills: [],
    workouts: [],
    workoutName: null,
    isRecovery: false,
    hasCheckIn: false,
    notes: undefined,
    summaryFallback: undefined
  };
}
function workoutsForDay(structured, note) {
  const workouts = [];
  for (const exerciseLine of structured.workoutExercises || []) {
    const workout = parseExerciseLine(exerciseLine);
    if (workout.name) workouts.push(workout);
  }
  if (workouts.length > 0) return workouts;
  return extractWorkoutsFromNote(note);
}
function parseDayLine(line, index, weekStart, parseDayNote, parseStructuredDayNote, nutritionByDay) {
  const copy = textForReport(line);
  const {
    day,
    date,
    note
  } = parseDayNote(copy);
  const structured = parseStructuredDayNote(note);
  const isoDate = date || (weekStart ? addDays(weekStart, index) : '');
  const nutrition = nutritionByDay[isoDate] || {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0
  };
  const fullDayName = (day || DAY_NAMES[index] || 'Day').trim();
  const shortDayName = fullDayName.slice(0, 3);
  const shortLabel = SHORT_LABELS[index] || 'D';
  if (isEmptyCheckIn(note)) {
    return emptyCheckInDay(isoDate, fullDayName, shortDayName, shortLabel, nutrition);
  }
  return filledCheckInDay(isoDate, fullDayName, shortDayName, shortLabel, nutrition, structured, note);
}
function filledCheckInDay(isoDate, fullDayName, shortDayName, shortLabel, nutrition, structured, note) {
  var _optFn, _optObj, _optFn2, _optObj2;
  const sleepPill = findPillByKey(structured.pills, 'sleep');
  const waterPill = findPillByKey(structured.pills, 'water');
  const stepsPill = findPillByKey(structured.pills, 'steps');
  const sleepMatch = (_optFn = (_optObj = sleepPill == null ? void 0 : sleepPill.value) == null ? void 0 : _optObj.match) == null ? void 0 : _optFn(/([\d.]+)/);
  const waterMatch = (_optFn2 = (_optObj2 = waterPill == null ? void 0 : waterPill.value) == null ? void 0 : _optObj2.match) == null ? void 0 : _optFn2(/([\d.]+)/);
  const steps = parseStepsFromPill(stepsPill);
  const workouts = workoutsForDay(structured, note);
  return {
    date: isoDate,
    dayName: shortDayName,
    fullDayName,
    shortLabel,
    sleepHours: sleepMatch ? parseFloat(sleepMatch[1]) : 0,
    waterOz: waterMatch ? parseFloat(waterMatch[1]) : 0,
    steps,
    calories: roundToWholeNumber(nutrition.calories),
    protein: roundToOneDecimal(nutrition.protein),
    carbs: roundToOneDecimal(nutrition.carbs),
    fat: roundToOneDecimal(nutrition.fat),
    energy: numberFromPillByKey(structured.pills, 'energy'),
    mood: numberFromPillByKey(structured.pills, 'mood'),
    stress: numberFromPillByKey(structured.pills, 'stress'),
    soreness: numberFromPillByKey(structured.pills, 'soreness'),
    weight: numberFromPillByKey(structured.pills, 'weight'),
    bodyFat: numberFromPillByKey(structured.pills, 'bodyfat'),
    workoutRating: numberFromPillByKey(structured.pills, 'lift'),
    pills: structured.pills,
    workouts,
    workoutName: null,
    isRecovery: isRecoveryDay(note) && workouts.length === 0,
    hasCheckIn: true,
    notes: structured.personalNote || undefined,
    summaryFallback: structured.fallback || undefined
  };
}
function findPillByKey(pills, key) {
  for (const pill of pills) {
    if (pill.key === key) return pill;
  }
  return null;
}
function enrichDaysWithDailyLogs(days, dailyLogsByDay, workoutsFromDailyLog) {
  if (!workoutsFromDailyLog || !dailyLogsByDay) return days;
  const enrichedDays = [];
  for (const day of days) {
    enrichedDays.push(mergeOneDayWithDailyLog(day, dailyLogsByDay, workoutsFromDailyLog));
  }
  return enrichedDays;
}
function mergeOneDayWithDailyLog(day, dailyLogsByDay, workoutsFromDailyLog) {
  const log = dailyLogsByDay[day.date];
  if (!log) return day;
  const fromLog = workoutsFromDailyLog(log);
  const workouts = fromLog.workouts.length > 0 ? fromLog.workouts : day.workouts;
  return {
    ...day,
    workouts,
    workoutName: fromLog.workoutName || day.workoutName,
    isRecovery: fromLog.isRest || day.isRecovery && workouts.length === 0,
    // Keep the historic `|| true` so any day with a daily log still counts as checked in
    hasCheckIn: day.hasCheckIn || true
  };
}
function buildWeekWorkoutDays(days) {
  const weekWorkoutDays = [];
  for (const day of days) {
    const workouts = day.workouts || [];
    if (workouts.length === 0) continue;
    const exerciseNames = [];
    for (const workout of workouts) {
      exerciseNames.push(workout.name);
    }
    weekWorkoutDays.push({
      date: day.date,
      dayName: day.fullDayName,
      workoutName: day.workoutName,
      workouts: day.workouts,
      exerciseSummary: exerciseNames.join(', ')
    });
  }
  return weekWorkoutDays;
}
function buildOverviewHighlights(stats, days, report) {
  const highlights = [{
    icon: 'checkmark-circle',
    label: 'Check-ins',
    value: `${stats.checkInDays}/${DAYS_IN_WEEK}`,
    gradient: HIGHLIGHT_GRAD.checkIns
  }];
  if (stats.workoutDaysLogged > 0) {
    highlights.push({
      icon: 'barbell',
      label: 'Workout days',
      value: String(stats.workoutDaysLogged),
      gradient: HIGHLIGHT_GRAD.workouts
    });
  }
  pushSleepHighlightIfPresent(highlights, days);
  pushWaterGoalHighlightIfPresent(highlights, days);
  pushEnergyHighlightIfPresent(highlights, report);
  pushWeightHighlightIfPresent(highlights, report);
  return highlights;
}
function pushSleepHighlightIfPresent(highlights, days) {
  const sleepDays = [];
  for (const day of days) {
    if (day.sleepHours > 0) sleepDays.push(day);
  }
  if (sleepDays.length < 1) return;
  const sleepValues = [];
  for (const day of sleepDays) {
    sleepValues.push(day.sleepHours);
  }
  let sleepLabel = 'Sleep logged';
  let sleepValue = `${sleepValues[0]}h`;
  if (sleepDays.length >= 2) {
    sleepLabel = 'Sleep range';
    sleepValue = `${Math.min(...sleepValues)}–${Math.max(...sleepValues)}h`;
  }
  highlights.push({
    icon: 'moon',
    label: sleepLabel,
    value: sleepValue,
    gradient: HIGHLIGHT_GRAD.sleep
  });
}
function pushWaterGoalHighlightIfPresent(highlights, days) {
  let waterGoalDays = 0;
  for (const day of days) {
    if (day.waterOz >= WATER_GOAL_OZ) waterGoalDays += 1;
  }
  if (waterGoalDays === 0) return;
  highlights.push({
    icon: 'water',
    label: '64+ oz days',
    value: String(waterGoalDays),
    gradient: HIGHLIGHT_GRAD.water
  });
}
function pushEnergyHighlightIfPresent(highlights, report) {
  const avgEnergy = parseReportNumber(report == null ? void 0 : report.avgEnergy);
  if (avgEnergy == null) return;
  highlights.push({
    icon: 'flash',
    label: 'Avg energy',
    value: `${roundToOneDecimal(avgEnergy)}/${ENERGY_SCALE_MAX}`,
    gradient: HIGHLIGHT_GRAD.energy
  });
}
function pushWeightHighlightIfPresent(highlights, report) {
  const avgWeight = parseReportNumber(report == null ? void 0 : report.avgWeight);
  if (avgWeight == null) return;
  highlights.push({
    icon: 'scale',
    label: 'Avg weight',
    value: `${roundToOneDecimal(avgWeight)} lbs`,
    gradient: HIGHLIGHT_GRAD.weight
  });
}
function parseWeekDays(report, parseDayNote, parseStructuredDayNote, nutritionByDay, dailyLogsByDay, workoutsFromDailyLog) {
  const weekStart = report.weekStart || report.weekId || '';
  const rawDays = Array.isArray(report.dayBreakdown) ? report.dayBreakdown : [];
  const days = [];
  for (let dayIndex = 0; dayIndex < DAYS_IN_WEEK; dayIndex += 1) {
    const line = rawDays[dayIndex] || emptyCheckInLineForDayName(DAY_NAMES[dayIndex]);
    days.push(parseDayLine(line, dayIndex, weekStart, parseDayNote, parseStructuredDayNote, nutritionByDay));
  }
  return enrichDaysWithDailyLogs(days, dailyLogsByDay, workoutsFromDailyLog);
}

// Adherence % from planned days when present — same keys writeTrainerTips already reads
function workoutAdherencePercent(workoutDaysLogged, report) {
  const plannedDayCount = parseReportNumber(report == null ? void 0 : report.plannedWorkouts) ?? parseReportNumber(report == null ? void 0 : report.daysPerWeek) ?? parseReportNumber(report == null ? void 0 : report.plannedDays);
  if (plannedDayCount && plannedDayCount > 0) {
    return Math.min(100, Math.round(workoutDaysLogged / plannedDayCount * 100));
  }
  if (workoutDaysLogged > 0) {
    return Math.min(100, Math.round(workoutDaysLogged / DAYS_IN_WEEK * 100));
  }
  return null;
}
function collectPositiveMetricValues(days, metricKey) {
  const values = [];
  for (const day of days) {
    const value = day[metricKey];
    if (value > 0) values.push(value);
  }
  return values;
}
function collectNullableMetricValues(days, metricKey) {
  const values = [];
  for (const day of days) {
    const value = day[metricKey];
    if (value != null) values.push(value);
  }
  return values;
}
function countWorkoutDaysLogged(days) {
  let workoutDays = 0;
  for (const day of days) {
    const workouts = day.workouts || [];
    if (workouts.length > 0 && !day.isRecovery) workoutDays += 1;
  }
  return workoutDays;
}
function countCheckInDays(days) {
  let checkInDays = 0;
  for (const day of days) {
    if (day.hasCheckIn) checkInDays += 1;
  }
  return checkInDays;
}
function computeStats(days, report) {
  const sleepVals = collectPositiveMetricValues(days, 'sleepHours');
  const waterVals = collectPositiveMetricValues(days, 'waterOz');
  const stepVals = collectPositiveMetricValues(days, 'steps');
  const calVals = collectPositiveMetricValues(days, 'calories');
  const proteinVals = collectPositiveMetricValues(days, 'protein');
  // Design Law client grid also shows energy / soreness / stress / weight / adherence
  const energyVals = collectNullableMetricValues(days, 'energy');
  const sorenessVals = collectNullableMetricValues(days, 'soreness');
  const stressVals = collectNullableMetricValues(days, 'stress');
  const weightVals = collectNullableMetricValues(days, 'weight');
  const workoutDays = countWorkoutDaysLogged(days);
  const adherencePct = workoutAdherencePercent(workoutDays, report);
  const avgSleep = parseReportNumber(report == null ? void 0 : report.avgSleep) ?? averageOfPositiveNumbers(sleepVals);
  const avgWater = parseReportNumber(report == null ? void 0 : report.avgWater) ?? averageOfPositiveNumbers(waterVals);
  const avgSteps = parseReportNumber(report == null ? void 0 : report.avgSteps) ?? averageOfPositiveNumbers(stepVals);
  const avgCalories = averageOfPositiveNumbers(calVals);
  const avgProtein = averageOfPositiveNumbers(proteinVals);
  const avgEnergy = parseReportNumber(report == null ? void 0 : report.avgEnergy) ?? averageOfFiniteNumbers(energyVals);
  const avgSoreness = parseReportNumber(report == null ? void 0 : report.avgSoreness) ?? averageOfFiniteNumbers(sorenessVals);
  const avgStress = parseReportNumber(report == null ? void 0 : report.avgStress) ?? averageOfFiniteNumbers(stressVals);
  const avgWeight = parseReportNumber(report == null ? void 0 : report.avgWeight) ?? averageOfFiniteNumbers(weightVals);

  // Water cups for trainer PNG (≈ 8 oz per cup) — keep oz display key unchanged
  let waterCups = EMPTY_DISPLAY;
  if (avgWater != null) {
    waterCups = String(roundToOneDecimal(avgWater / WATER_OZ_PER_CUP));
  }
  return {
    avgSleep: avgSleep != null ? roundToOneDecimal(avgSleep) : null,
    avgWater: avgWater != null ? roundToOneDecimal(avgWater) : null,
    avgSteps: avgSteps != null ? roundToWholeNumber(avgSteps) : null,
    avgCalories: avgCalories != null ? roundToWholeNumber(avgCalories) : null,
    avgProtein: avgProtein != null ? roundToOneDecimal(avgProtein) : null,
    avgEnergy: avgEnergy != null ? roundToOneDecimal(avgEnergy) : null,
    avgSoreness: avgSoreness != null ? roundToOneDecimal(avgSoreness) : null,
    avgStress: avgStress != null ? roundToOneDecimal(avgStress) : null,
    avgWeight: avgWeight != null ? roundToOneDecimal(avgWeight) : null,
    adherencePct,
    nutritionDaysLogged: calVals.length,
    checkInDays: countCheckInDays(days),
    workoutDaysLogged: workoutDays,
    display: {
      sleep: avgSleep != null ? String(roundToOneDecimal(avgSleep)) : EMPTY_DISPLAY,
      water: avgWater != null ? String(roundToOneDecimal(avgWater)) : EMPTY_DISPLAY,
      waterCups,
      steps: avgSteps != null ? formatSteps(avgSteps) : EMPTY_DISPLAY,
      calories: avgCalories != null ? String(roundToWholeNumber(avgCalories)) : EMPTY_DISPLAY,
      protein: avgProtein != null ? String(roundToOneDecimal(avgProtein)) : EMPTY_DISPLAY,
      energy: avgEnergy != null ? String(roundToOneDecimal(avgEnergy)) : EMPTY_DISPLAY,
      soreness: avgSoreness != null ? String(roundToOneDecimal(avgSoreness)) : EMPTY_DISPLAY,
      stress: avgStress != null ? String(roundToOneDecimal(avgStress)) : EMPTY_DISPLAY,
      weight: avgWeight != null ? String(roundToWholeNumber(avgWeight)) : EMPTY_DISPLAY,
      adherence: adherencePct != null ? String(adherencePct) : EMPTY_DISPLAY
    }
  };
}
function addTrends(stats, prevStats) {
  if (!prevStats) {
    return {
      ...stats,
      sleepTrend: 0,
      waterTrend: 0,
      stepsTrend: 0,
      caloriesTrend: 0
    };
  }
  return {
    ...stats,
    sleepTrend: percentChangeFromPrevious(stats.avgSleep, prevStats.avgSleep),
    waterTrend: percentChangeFromPrevious(stats.avgWater, prevStats.avgWater),
    stepsTrend: percentChangeFromPrevious(stats.avgSteps, prevStats.avgSteps),
    caloriesTrend: percentChangeFromPrevious(stats.avgCalories, prevStats.avgCalories)
  };
}

// ===== PLUMBING — skip unless debugging =====

function textForReport(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.text) return String(value.text);
  return String(value);
}
function parseReportNumber(value) {
  if (value == null || value === '' || value === 'N/A') return null;
  const parsed = parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}
function averageOfPositiveNumbers(values) {
  const numbers = [];
  for (const number of values || []) {
    if (Number.isFinite(number) && number > 0) numbers.push(number);
  }
  if (!numbers.length) return null;
  let sum = 0;
  for (const number of numbers) {
    sum += number;
  }
  return sum / numbers.length;
}
function averageOfFiniteNumbers(values) {
  const numbers = [];
  for (const number of values || []) {
    if (Number.isFinite(number)) numbers.push(number);
  }
  if (!numbers.length) return null;
  let sum = 0;
  for (const number of numbers) {
    sum += number;
  }
  return sum / numbers.length;
}
function roundToOneDecimal(number) {
  return Math.round(number * ONE_DECIMAL_FACTOR) / ONE_DECIMAL_FACTOR;
}
function roundToWholeNumber(number) {
  return Math.round(number);
}
function percentChangeFromPrevious(current, previous) {
  if (current == null || current === 0) {
    if (previous > 0) return TREND_FULL_DROP;
    return 0;
  }
  if (previous == null || previous === 0) return TREND_FULL_RISE;
  return Math.round((current - previous) / Math.abs(previous) * 100);
}
function formatSteps(stepCount) {
  if (stepCount == null) return null;
  if (stepCount >= STEPS_THOUSAND) {
    return `${(stepCount / STEPS_THOUSAND).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(roundToWholeNumber(stepCount));
}
function isEmptyCheckIn(note) {
  const noteText = String(note || '').toLowerCase().trim();
  return !noteText || noteText.includes('no check-in');
}
function isRecoveryDay(note) {
  const noteText = String(note || '').toLowerCase();
  return /\brest\b|recovery|no workout|skipped|rest day|take a rest/i.test(noteText);
}
function addDays(isoDate, daysToAdd) {
  const noonDate = new Date(`${isoDate}${NOON_ISO_SUFFIX}`);
  noonDate.setDate(noonDate.getDate() + daysToAdd);
  return noonDate.toISOString().slice(0, DATE_KEY_LENGTH);
}
function dedupeStringList(values) {
  const seen = new Set();
  const unique = [];
  for (const raw of values) {
    const text = String(raw || '').trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(text);
  }
  return unique;
}
function parseExerciseLine(line) {
  const match = String(line || '').match(/^(.+?)\s*\((\d+)\s*sets?:\s*(.+)\)\s*$/i);
  if (match) {
    return {
      name: match[1].trim(),
      setsCount: match[2],
      setsDetail: match[3].trim()
    };
  }
  return {
    name: String(line || '').trim(),
    setsCount: null,
    setsDetail: null
  };
}

/** Fallback when structured parser misses inline Workout: chunks. */
function extractWorkoutsFromNote(note) {
  const noteText = String(note || '');
  const match = noteText.match(/\bWorkout:\s*(.+?)(?:\.\s*Note:|\.\s*$|$)/i);
  if (!match) return [];
  const cleanedChunk = match[1].replace(/\.\s*$/, '');
  const chunks = cleanedChunk.split(';');
  const workouts = [];
  for (const chunk of chunks) {
    const workout = parseExerciseLine(chunk.trim());
    if (workout.name) workouts.push(workout);
  }
  return workouts;
}
function numberFromPillByKey(pills, key) {
  const pill = findPillByKey(pills, key);
  if (!(pill == null ? void 0 : pill.value)) return null;
  const match = String(pill.value).match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : null;
}
function dayHasData(day) {
  const workouts = day.workouts || [];
  const pills = day.pills || [];
  return day.hasCheckIn || day.calories > 0 || day.sleepHours > 0 || day.waterOz > 0 || day.steps > 0 || workouts.length > 0 || pills.length > 0;
}
function parseStepsFromPill(stepsPill) {
  var _optFn3, _optObj3, _optFn4, _optFn5, _optObj4, _optFn6, _optObj5;
  const stepsRaw = (_optFn3 = (_optObj3 = stepsPill == null ? void 0 : stepsPill.value) == null ? void 0 : _optObj3.replace) == null ? void 0 : _optFn3(/k$/i, '');
  const stepsMatch = (_optFn4 = stepsRaw == null ? void 0 : stepsRaw.match) == null ? void 0 : _optFn4(/([\d.]+)/);
  if (!stepsMatch) return 0;
  const parsed = parseFloat(stepsMatch[1]);
  if ((_optFn5 = (_optObj4 = (_optFn6 = (_optObj5 = stepsPill == null ? void 0 : stepsPill.value) == null ? void 0 : _optObj5.toLowerCase) == null ? void 0 : _optFn6()) == null ? void 0 : _optObj4.includes) == null ? void 0 : _optFn5('k')) return Math.round(parsed * STEPS_THOUSAND);
  return Math.round(parsed);
}
