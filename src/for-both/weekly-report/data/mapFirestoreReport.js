import { curateCoachingPoints } from './curateCoachingPoints';
import { buildTrainerWeekInsights } from './buildTrainerWeekInsights';

function textForReport(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v.text) return String(v.text);
  return String(v);
}

function parseNum(v) {
  if (v == null || v === '' || v === 'N/A') return null;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function mean(values) {
  const nums = (values || []).filter((n) => Number.isFinite(n) && n > 0);
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function round0(n) {
  return Math.round(n);
}

function pctTrend(current, previous) {
  if (current == null || current === 0) return previous > 0 ? -100 : 0;
  if (previous == null || previous === 0) return 100;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

function formatSteps(n) {
  if (n == null) return null;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(round0(n));
}

function isEmptyCheckIn(note) {
  const n = String(note || '').toLowerCase().trim();
  return !n || n.includes('no check-in');
}

function isRecoveryDay(note) {
  const n = String(note || '').toLowerCase();
  return /\brest\b|recovery|no workout|skipped|rest day|take a rest/i.test(n);
}

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function uniqueStrings(arr) {
  const seen = new Set();
  const out = [];
  for (const raw of arr) {
    const s = String(raw || '').trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function parseExerciseLine(line) {
  const m = String(line || '').match(/^(.+?)\s*\((\d+)\s*sets?:\s*(.+)\)\s*$/i);
  if (m) {
    return {
      name: m[1].trim(),
      setsCount: m[2],
      setsDetail: m[3].trim(),
    };
  }
  return { name: String(line || '').trim(), setsCount: null, setsDetail: null };
}

/** Fallback when structured parser misses inline Workout: chunks. */
function extractWorkoutsFromNote(note) {
  const n = String(note || '');
  const match = n.match(/\bWorkout:\s*(.+?)(?:\.\s*Note:|\.\s*$|$)/i);
  if (!match) return [];
  return match[1]
    .replace(/\.\s*$/, '')
    .split(';')
    .map((s) => parseExerciseLine(s.trim()))
    .filter((w) => w.name);
}

function pillNum(pills, key) {
  const pill = pills.find((p) => p.key === key);
  if (!pill?.value) return null;
  const m = String(pill.value).match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
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

  const pros = curateCoachingPoints(rawPros, 5);
  const cons = curateCoachingPoints(rawCons, 5);

  return {
    pros,
    cons,
    focus,
    trends,
    summary,
    insights: [],
  };
}

function parseDayLine(line, index, weekStart, parseDayNote, parseStructuredDayNote, nutritionByDay) {
  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const SHORT_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const copy = textForReport(line);
  const { day, date, note } = parseDayNote(copy);
  const structured = parseStructuredDayNote(note);
  const isoDate = date || (weekStart ? addDays(weekStart, index) : '');
  const nutrition = nutritionByDay[isoDate] || { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const fullDayName = (day || DAY_NAMES[index] || 'Day').trim();
  const shortDayName = fullDayName.slice(0, 3);

  if (isEmptyCheckIn(note)) {
    return {
      date: isoDate,
      dayName: shortDayName,
      fullDayName,
      shortLabel: SHORT_LABELS[index] || 'D',
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

  const sleepPill = structured.pills.find((p) => p.key === 'sleep');
  const waterPill = structured.pills.find((p) => p.key === 'water');
  const stepsPill = structured.pills.find((p) => p.key === 'steps');

  const sleepMatch = sleepPill?.value?.match(/([\d.]+)/);
  const waterMatch = waterPill?.value?.match(/([\d.]+)/);
  const stepsRaw = stepsPill?.value?.replace(/k$/i, '');
  const stepsMatch = stepsRaw?.match(/([\d.]+)/);

  let steps = 0;
  if (stepsMatch) {
    const n = parseFloat(stepsMatch[1]);
    steps = stepsPill?.value?.toLowerCase().includes('k') ? Math.round(n * 1000) : Math.round(n);
  }

  let workouts = (structured.workoutExercises || []).map(parseExerciseLine).filter((w) => w.name);
  if (!workouts.length) {
    workouts = extractWorkoutsFromNote(note);
  }

  return {
    date: isoDate,
    dayName: shortDayName,
    fullDayName,
    shortLabel: SHORT_LABELS[index] || 'D',
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
    .filter((d) => d.workouts?.length > 0)
    .map((d) => ({
      date: d.date,
      dayName: d.fullDayName,
      workoutName: d.workoutName,
      workouts: d.workouts,
      exerciseSummary: d.workouts.map((w) => w.name).join(', '),
    }));
}

function buildOverviewHighlights(stats, days, report) {
  const highlights = [
    {
      icon: 'checkmark-circle',
      label: 'Check-ins',
      value: `${stats.checkInDays}/7`,
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

  const sleepDays = days.filter((d) => d.sleepHours > 0);
  if (sleepDays.length >= 1) {
    const vals = sleepDays.map((d) => d.sleepHours);
    highlights.push({
      icon: 'moon',
      label: sleepDays.length >= 2 ? 'Sleep range' : 'Sleep logged',
      value: sleepDays.length >= 2 ? `${Math.min(...vals)}–${Math.max(...vals)}h` : `${vals[0]}h`,
      gradient: ['#6D28D9', '#4C1D95'],
    });
  }

  const waterGoalDays = days.filter((d) => d.waterOz >= 64).length;
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
      value: `${round1(avgEnergy)}/8`,
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
  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const weekStart = report.weekStart || report.weekId || '';
  const rawDays = Array.isArray(report.dayBreakdown) ? report.dayBreakdown : [];

  const days = Array.from({ length: 7 }, (_, i) => {
    if (rawDays[i]) {
      return parseDayLine(rawDays[i], i, weekStart, parseDayNote, parseStructuredDayNote, nutritionByDay);
    }
    return parseDayLine(
      `${DAY_NAMES[i]} (): No check-in for this day.`,
      i,
      weekStart,
      parseDayNote,
      parseStructuredDayNote,
      nutritionByDay,
    );
  });

  return enrichDaysWithDailyLogs(days, dailyLogsByDay, workoutsFromDailyLog);
}

function computeStats(days, report) {
  const sleepVals = days.map((d) => d.sleepHours).filter((v) => v > 0);
  const waterVals = days.map((d) => d.waterOz).filter((v) => v > 0);
  const stepVals = days.map((d) => d.steps).filter((v) => v > 0);
  const calVals = days.map((d) => d.calories).filter((v) => v > 0);
  const proteinVals = days.map((d) => d.protein).filter((v) => v > 0);
  const workoutDays = days.filter((d) => d.workouts?.length > 0).length;

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
    checkInDays: days.filter((d) => d.hasCheckIn).length,
    workoutDaysLogged: workoutDays,
    display: {
      sleep: avgSleep != null ? String(round1(avgSleep)) : '—',
      water: avgWater != null ? String(round1(avgWater)) : '—',
      steps: avgSteps != null ? formatSteps(avgSteps) : '—',
      calories: avgCalories != null ? String(round0(avgCalories)) : '—',
      protein: avgProtein != null ? String(round1(avgProtein)) : '—',
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

export function mapFirestoreReportToWeekReport(
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
    skippedDays: days.filter((d) => !dayHasData(d)),
    trainerInsights: buildTrainerWeekInsights(stats, days, report, clientMeta),
    ...coaching,
    signOff: textForReport(report.signOff),
    clientName: textForReport(
      report.clientDisplayName || report.clientName || report.athleteName || '',
    ),
  };
}

export function mapFirestoreReportsToWeeks(
  reports,
  parsers,
  nutritionByDay = {},
  dailyLogsByDay = {},
  workoutsFromDailyLog = null,
  clientMeta = {},
) {
  return reports
    .map((r, i) =>
      mapFirestoreReportToWeekReport(
        r,
        reports[i + 1] || null,
        parsers,
        nutritionByDay,
        dailyLogsByDay,
        workoutsFromDailyLog,
        clientMeta,
      ),
    )
    .filter(Boolean);
}

/** Plain-text day line for share / export. */
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
  if (day.energy != null) metrics.push(`Energy ${day.energy}/8`);
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
    const workoutLines = day.workouts.map((w) => {
      if (w.setsDetail) {
        return `${w.name} (${w.setsCount || '?'} sets: ${w.setsDetail})`;
      }
      return w.name;
    });
    parts.push(`Workout: ${workoutLines.join('; ')}`);
  } else if (day.isRecovery) {
    parts.push('Rest / recovery day');
  }

  if (day.notes) parts.push(`Note: ${day.notes}`);
  if (day.summaryFallback) parts.push(day.summaryFallback);

  return parts.join('. ');
}
