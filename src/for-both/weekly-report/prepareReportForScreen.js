// Turns raw weekly-report Firestore docs into the shape WeeklyReportBody/Screen expect.
// Flow: parse each day line → merge nutrition + daily logs → compute stats/trends → attach trainer tips.
// Used by WeeklyReportScreen after it loads reports and food totals.

import { pickBestTips } from './pickBestTips';
import { writeTrainerTips } from './writeTrainerTips';

// ===== NAMED CONSTANTS =====

const EMPTY_DISPLAY = '—';
const STEPS_THOUSAND = 1000;
const WATER_GOAL_OZ = 64;
const DAYS_IN_WEEK = 7;
const ENERGY_SCALE_MAX = 8;
const NOON_ISO_SUFFIX = 'T12:00:00';
const DATE_KEY_LENGTH = 10;
const TIP_LIMIT = 5;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHORT_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const EMPTY_CHECK_IN_LINE = (dayName) => `${dayName} (): No check-in for this day.`;

// ===== HELPER FUNCTIONS =====

function textForReport(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.text) return String(value.text);
  return String(value);
}

function parseNum(value) {
  if (value == null || value === '' || value === 'N/A') return null;
  const parsed = parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function mean(values) {
  const numbers = (values || []).filter((number) => Number.isFinite(number) && number > 0);
  if (!numbers.length) return null;
  return numbers.reduce((sum, number) => sum + number, 0) / numbers.length;
}

function round1(number) {
  return Math.round(number * 10) / 10;
}

function round0(number) {
  return Math.round(number);
}

function pctTrend(current, previous) {
  if (current == null || current === 0) return previous > 0 ? -100 : 0;
  if (previous == null || previous === 0) return 100;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

function formatSteps(stepCount) {
  if (stepCount == null) return null;
  if (stepCount >= STEPS_THOUSAND) {
    return `${(stepCount / STEPS_THOUSAND).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(round0(stepCount));
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

function uniqueStrings(values) {
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
      setsDetail: match[3].trim(),
    };
  }
  return { name: String(line || '').trim(), setsCount: null, setsDetail: null };
}

/** Fallback when structured parser misses inline Workout: chunks. */
function extractWorkoutsFromNote(note) {
  const noteText = String(note || '');
  const match = noteText.match(/\bWorkout:\s*(.+?)(?:\.\s*Note:|\.\s*$|$)/i);
  if (!match) return [];
  return match[1]
    .replace(/\.\s*$/, '')
    .split(';')
    .map((chunk) => parseExerciseLine(chunk.trim()))
    .filter((workout) => workout.name);
}

function pillNum(pills, key) {
  const pill = pills.find((entry) => entry.key === key);
  if (!pill?.value) return null;
  const match = String(pill.value).match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : null;
}

function dayHasData(day) {
  return (
    day.hasCheckIn ||
    day.calories > 0 ||
    day.sleepHours > 0 ||
    day.waterOz > 0 ||
    day.steps > 0 ||
    (day.workouts && day.workouts.length > 0) ||
    (day.pills && day.pills.length > 0)
  );
}

function buildCoachingSections(report) {
  const rawPros = uniqueStrings([
    ...(Array.isArray(report?.pros) ? report.pros : []).map(textForReport),
    ...(Array.isArray(report?.wins) ? report.wins : []).map(textForReport),
  ]);
  const rawCons = uniqueStrings(
    (Array.isArray(report?.cons) ? report.cons : []).map(textForReport),
  );
  const focus = uniqueStrings(
    (Array.isArray(report?.focus) ? report.focus : []).map(textForReport),
  );
  const trends = uniqueStrings(
    (Array.isArray(report?.trends) ? report.trends : []).map(textForReport),
  );
  const summary = textForReport(report?.summary);

  return {
    pros: pickBestTips(rawPros, TIP_LIMIT),
    cons: pickBestTips(rawCons, TIP_LIMIT),
    focus,
    trends,
    summary,
    insights: [],
  };
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
    calories: round0(nutrition.calories),
    protein: round1(nutrition.protein),
    carbs: round1(nutrition.carbs),
    fat: round1(nutrition.fat),
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
    summaryFallback: undefined,
  };
}

function parseStepsFromPill(stepsPill) {
  const stepsRaw = stepsPill?.value?.replace(/k$/i, '');
  const stepsMatch = stepsRaw?.match(/([\d.]+)/);
  if (!stepsMatch) return 0;
  const parsed = parseFloat(stepsMatch[1]);
  if (stepsPill?.value?.toLowerCase().includes('k')) return Math.round(parsed * STEPS_THOUSAND);
  return Math.round(parsed);
}

function workoutsForDay(structured, note) {
  let workouts = (structured.workoutExercises || []).map(parseExerciseLine).filter((workout) => workout.name);
  if (!workouts.length) workouts = extractWorkoutsFromNote(note);
  return workouts;
}

function parseDayLine(line, index, weekStart, parseDayNote, parseStructuredDayNote, nutritionByDay) {
  const copy = textForReport(line);
  const { day, date, note } = parseDayNote(copy);
  const structured = parseStructuredDayNote(note);
  const isoDate = date || (weekStart ? addDays(weekStart, index) : '');
  const nutrition = nutritionByDay[isoDate] || { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const fullDayName = (day || DAY_NAMES[index] || 'Day').trim();
  const shortDayName = fullDayName.slice(0, 3);
  const shortLabel = SHORT_LABELS[index] || 'D';

  if (isEmptyCheckIn(note)) {
    return emptyCheckInDay(isoDate, fullDayName, shortDayName, shortLabel, nutrition);
  }

  const sleepPill = structured.pills.find((pill) => pill.key === 'sleep');
  const waterPill = structured.pills.find((pill) => pill.key === 'water');
  const stepsPill = structured.pills.find((pill) => pill.key === 'steps');

  const sleepMatch = sleepPill?.value?.match(/([\d.]+)/);
  const waterMatch = waterPill?.value?.match(/([\d.]+)/);
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
    calories: round0(nutrition.calories),
    protein: round1(nutrition.protein),
    carbs: round1(nutrition.carbs),
    fat: round1(nutrition.fat),
    energy: pillNum(structured.pills, 'energy'),
    mood: pillNum(structured.pills, 'mood'),
    stress: pillNum(structured.pills, 'stress'),
    soreness: pillNum(structured.pills, 'soreness'),
    weight: pillNum(structured.pills, 'weight'),
    bodyFat: pillNum(structured.pills, 'bodyfat'),
    workoutRating: pillNum(structured.pills, 'lift'),
    pills: structured.pills,
    workouts,
    workoutName: null,
    isRecovery: isRecoveryDay(note) && workouts.length === 0,
    hasCheckIn: true,
    notes: structured.personalNote || undefined,
    summaryFallback: structured.fallback || undefined,
  };
}

function enrichDaysWithDailyLogs(days, dailyLogsByDay, workoutsFromDailyLog) {
  if (!workoutsFromDailyLog || !dailyLogsByDay) return days;
  return days.map((day) => {
    const log = dailyLogsByDay[day.date];
    if (!log) return day;

    const fromLog = workoutsFromDailyLog(log);
    const workouts = fromLog.workouts.length > 0 ? fromLog.workouts : day.workouts;

    return {
      ...day,
      workouts,
      workoutName: fromLog.workoutName || day.workoutName,
      isRecovery: fromLog.isRest || (day.isRecovery && workouts.length === 0),
      hasCheckIn: day.hasCheckIn || true,
    };
  });
}

function buildWeekWorkoutDays(days) {
  return days
    .filter((day) => day.workouts?.length > 0)
    .map((day) => ({
      date: day.date,
      dayName: day.fullDayName,
      workoutName: day.workoutName,
      workouts: day.workouts,
      exerciseSummary: day.workouts.map((workout) => workout.name).join(', '),
    }));
}

function buildOverviewHighlights(stats, days, report) {
  const highlights = [
    {
      icon: 'checkmark-circle',
      label: 'Check-ins',
      value: `${stats.checkInDays}/${DAYS_IN_WEEK}`,
      gradient: ['#BE185D', '#C2410C'],
    },
  ];

  if (stats.workoutDaysLogged > 0) {
    highlights.push({
      icon: 'barbell',
      label: 'Workout days',
      value: String(stats.workoutDaysLogged),
      gradient: ['#C2410C', '#9A3412'],
    });
  }

  const sleepDays = days.filter((day) => day.sleepHours > 0);
  if (sleepDays.length >= 1) {
    const sleepValues = sleepDays.map((day) => day.sleepHours);
    const sleepLabel = sleepDays.length >= 2 ? 'Sleep range' : 'Sleep logged';
    const sleepValue =
      sleepDays.length >= 2
        ? `${Math.min(...sleepValues)}–${Math.max(...sleepValues)}h`
        : `${sleepValues[0]}h`;
    highlights.push({
      icon: 'moon',
      label: sleepLabel,
      value: sleepValue,
      gradient: ['#6D28D9', '#4C1D95'],
    });
  }

  const waterGoalDays = days.filter((day) => day.waterOz >= WATER_GOAL_OZ).length;
  if (waterGoalDays > 0) {
    highlights.push({
      icon: 'water',
      label: '64+ oz days',
      value: String(waterGoalDays),
      gradient: ['#0891B2', '#06B6D4'],
    });
  }

  const avgEnergy = parseNum(report?.avgEnergy);
  if (avgEnergy != null) {
    highlights.push({
      icon: 'flash',
      label: 'Avg energy',
      value: `${round1(avgEnergy)}/${ENERGY_SCALE_MAX}`,
      gradient: ['#DB2777', '#BE185D'],
    });
  }

  const avgWeight = parseNum(report?.avgWeight);
  if (avgWeight != null) {
    highlights.push({
      icon: 'scale',
      label: 'Avg weight',
      value: `${round1(avgWeight)} lbs`,
      gradient: ['#B45309', '#C2410C'],
    });
  }

  return highlights;
}

function parseWeekDays(report, parseDayNote, parseStructuredDayNote, nutritionByDay, dailyLogsByDay, workoutsFromDailyLog) {
  const weekStart = report.weekStart || report.weekId || '';
  const rawDays = Array.isArray(report.dayBreakdown) ? report.dayBreakdown : [];

  const days = Array.from({ length: DAYS_IN_WEEK }, (_, dayIndex) => {
    if (rawDays[dayIndex]) {
      return parseDayLine(rawDays[dayIndex], dayIndex, weekStart, parseDayNote, parseStructuredDayNote, nutritionByDay);
    }
    return parseDayLine(
      EMPTY_CHECK_IN_LINE(DAY_NAMES[dayIndex]),
      dayIndex,
      weekStart,
      parseDayNote,
      parseStructuredDayNote,
      nutritionByDay,
    );
  });

  return enrichDaysWithDailyLogs(days, dailyLogsByDay, workoutsFromDailyLog);
}

function computeStats(days, report) {
  const sleepVals = days.map((day) => day.sleepHours).filter((value) => value > 0);
  const waterVals = days.map((day) => day.waterOz).filter((value) => value > 0);
  const stepVals = days.map((day) => day.steps).filter((value) => value > 0);
  const calVals = days.map((day) => day.calories).filter((value) => value > 0);
  const proteinVals = days.map((day) => day.protein).filter((value) => value > 0);
  const workoutDays = days.filter((day) => day.workouts?.length > 0).length;

  const avgSleep = parseNum(report?.avgSleep) ?? mean(sleepVals);
  const avgWater = parseNum(report?.avgWater) ?? mean(waterVals);
  const avgSteps = parseNum(report?.avgSteps) ?? mean(stepVals);
  const avgCalories = mean(calVals);
  const avgProtein = mean(proteinVals);

  return {
    avgSleep: avgSleep != null ? round1(avgSleep) : null,
    avgWater: avgWater != null ? round1(avgWater) : null,
    avgSteps: avgSteps != null ? round0(avgSteps) : null,
    avgCalories: avgCalories != null ? round0(avgCalories) : null,
    avgProtein: avgProtein != null ? round1(avgProtein) : null,
    nutritionDaysLogged: calVals.length,
    checkInDays: days.filter((day) => day.hasCheckIn).length,
    workoutDaysLogged: workoutDays,
    display: {
      sleep: avgSleep != null ? String(round1(avgSleep)) : EMPTY_DISPLAY,
      water: avgWater != null ? String(round1(avgWater)) : EMPTY_DISPLAY,
      steps: avgSteps != null ? formatSteps(avgSteps) : EMPTY_DISPLAY,
      calories: avgCalories != null ? String(round0(avgCalories)) : EMPTY_DISPLAY,
      protein: avgProtein != null ? String(round1(avgProtein)) : EMPTY_DISPLAY,
    },
  };
}

function addTrends(stats, prevStats) {
  if (!prevStats) {
    return {
      ...stats,
      sleepTrend: 0,
      waterTrend: 0,
      stepsTrend: 0,
      caloriesTrend: 0,
    };
  }
  return {
    ...stats,
    sleepTrend: pctTrend(stats.avgSleep, prevStats.avgSleep),
    waterTrend: pctTrend(stats.avgWater, prevStats.avgWater),
    stepsTrend: pctTrend(stats.avgSteps, prevStats.avgSteps),
    caloriesTrend: pctTrend(stats.avgCalories, prevStats.avgCalories),
  };
}

// ===== MAIN FUNCTION =====

/**
 * Build one screen-ready week from a raw report + optional previous week for trends.
 * @param {object} report
 * @param {object|null} prevReport
 * @param {{ parseDayNote: Function, parseStructuredDayNote: Function, formatDateRange: Function }} parsers
 * @param {object} [nutritionByDay]
 * @param {object} [dailyLogsByDay]
 * @param {Function|null} [workoutsFromDailyLog]
 * @param {object} [clientMeta]
 * @returns {object|null}
 */
export function prepareReportForScreenToWeekReport(
  report,
  prevReport,
  parsers,
  nutritionByDay = {},
  dailyLogsByDay = {},
  workoutsFromDailyLog = null,
  clientMeta = {},
) {
  if (!report || !parsers) return null;

  const { parseDayNote, parseStructuredDayNote, formatDateRange } = parsers;
  const weekStart = report.weekStart || report.weekId || '';
  const dates = formatDateRange(report);
  const days = parseWeekDays(
    report,
    parseDayNote,
    parseStructuredDayNote,
    nutritionByDay,
    dailyLogsByDay,
    workoutsFromDailyLog,
  );
  const stats = computeStats(days, report);
  const coaching = buildCoachingSections(report);
  const weekWorkoutDays = buildWeekWorkoutDays(days);
  const overviewHighlights = buildOverviewHighlights(stats, days, report);

  const prevDays = prevReport
    ? parseWeekDays(
        prevReport,
        parseDayNote,
        parseStructuredDayNote,
        nutritionByDay,
        dailyLogsByDay,
        workoutsFromDailyLog,
      )
    : null;
  const prevStats = prevDays ? computeStats(prevDays, prevReport) : null;

  return {
    id: report.id || weekStart,
    label: dates.compact,
    startDate: weekStart,
    endDate: report.weekEnd || weekStart,
    stats: addTrends(stats, prevStats),
    days,
    weekWorkoutDays,
    overviewHighlights,
    loggedDays: days.filter(dayHasData),
    skippedDays: days.filter((day) => !dayHasData(day)),
    trainerInsights: writeTrainerTips(stats, days, report, clientMeta),
    ...coaching,
    signOff: textForReport(report.signOff),
    clientName: textForReport(
      report.clientDisplayName || report.clientName || report.athleteName || '',
    ),
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
export function prepareReportForScreensToWeeks(
  reports,
  parsers,
  nutritionByDay = {},
  dailyLogsByDay = {},
  workoutsFromDailyLog = null,
  clientMeta = {},
) {
  const weeks = [];
  for (let reportIndex = 0; reportIndex < reports.length; reportIndex += 1) {
    const week = prepareReportForScreenToWeekReport(
      reports[reportIndex],
      reports[reportIndex + 1] || null,
      parsers,
      nutritionByDay,
      dailyLogsByDay,
      workoutsFromDailyLog,
      clientMeta,
    );
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
  if (!day.hasCheckIn && !dayHasData(day)) {
    parts.push('No check-in');
    return parts.join(': ');
  }

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

  if (metrics.length) parts.push(metrics.join('. '));

  if (day.workouts?.length) {
    const workoutLines = day.workouts.map((workout) => {
      if (workout.setsDetail) {
        return `${workout.name} (${workout.setsCount || '?'} sets: ${workout.setsDetail})`;
      }
      return workout.name;
    });
    parts.push(`Workout: ${workoutLines.join('; ')}`);
  } else if (day.isRecovery) {
    parts.push('Rest / recovery day');
  }

  if (day.notes) parts.push(`Note: ${day.notes}`);
  if (day.summaryFallback) parts.push(day.summaryFallback);

  return parts.join('. ');
}
