function parseNum(v) {
  if (v == null || v === '' || v === 'N/A') return null;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function textForReport(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'object' && v.text) return String(v.text).trim();
  return String(v).trim();
}

export function resolvePlannedTrainingDays(report, clientMeta = {}) {
  const fromReport =
    parseNum(report?.plannedTrainingDays) ??
    parseNum(report?.daysPerWeek) ??
    parseNum(report?.trainingDaysPerWeek);
  if (fromReport != null && fromReport >= 1 && fromReport <= 7) return Math.round(fromReport);

  const fromProfile = parseNum(clientMeta?.daysPerWeek);
  if (fromProfile != null && fromProfile >= 1 && fromProfile <= 7) return Math.round(fromProfile);

  return null;
}

export function buildWorkoutAdherence(stats, report, clientMeta = {}) {
  const completed = stats?.workoutDaysLogged ?? 0;
  const planned = resolvePlannedTrainingDays(report, clientMeta);

  if (planned == null) {
    return {
      completed,
      planned: null,
      label: `${completed} training day${completed === 1 ? '' : 's'} logged`,
      sublabel: completed > 0 ? 'Add days/week in profile for adherence tracking' : 'Log workouts to see training volume',
      pct: null,
    };
  }

  const pct = planned > 0 ? Math.min(100, Math.round((completed / planned) * 100)) : 0;
  return {
    completed,
    planned,
    label: `${completed} of ${planned} sessions`,
    sublabel: pct >= 100 ? 'Plan completed — nice work' : pct >= 75 ? 'Close to target' : 'Below planned volume',
    pct,
  };
}

export function buildRedFlags(stats, days = [], report = {}, clientMeta = {}) {
  const flags = [];
  const checkIns = stats?.checkInDays ?? 0;
  const avgSleep = parseNum(report?.avgSleep) ?? stats?.avgSleep;
  const workoutCompleted = stats?.workoutDaysLogged ?? 0;

  if (checkIns === 0) {
    flags.push({
      id: 'no-checkins',
      tone: 'alert',
      title: 'No check-ins',
      detail: 'Nothing logged this week yet',
    });
  } else if (checkIns < 4) {
    flags.push({
      id: 'low-checkins',
      tone: 'warn',
      title: 'Sparse logging',
      detail: `Only ${checkIns}/7 days have data`,
    });
  }

  if (avgSleep != null && avgSleep < 6.5) {
    flags.push({
      id: 'low-sleep',
      tone: 'warn',
      title: 'Sleep under target',
      detail: `Averaging ${avgSleep}h — aim for 7+`,
    });
  }

  const soreDays = days.filter((d) => d.soreness != null && d.soreness >= 7);
  if (soreDays.length > 0) {
    flags.push({
      id: 'soreness',
      tone: 'alert',
      title: 'High soreness flagged',
      detail: `${soreDays.length} day${soreDays.length === 1 ? '' : 's'} at 7+/8`,
    });
  }

  const painNotes = days.filter((d) =>
    /\bpain\b|injury|hurt|strain|twist/i.test(String(d.notes || '')),
  );
  if (painNotes.length > 0) {
    flags.push({
      id: 'pain-note',
      tone: 'alert',
      title: 'Pain mentioned',
      detail: 'Review notes before next session',
    });
  }

  const planned = resolvePlannedTrainingDays(report, clientMeta);
  if (planned != null && workoutCompleted < Math.max(1, planned - 1) && checkIns >= 3) {
    flags.push({
      id: 'training-gap',
      tone: 'warn',
      title: 'Training below plan',
      detail: `${workoutCompleted}/${planned} sessions logged`,
    });
  }

  const waterGoalDays = days.filter((d) => d.waterOz >= 64).length;
  if (checkIns >= 4 && waterGoalDays <= 1) {
    flags.push({
      id: 'hydration',
      tone: 'warn',
      title: 'Hydration off',
      detail: `${waterGoalDays} day${waterGoalDays === 1 ? '' : 's'} hit 64+ oz`,
    });
  }

  return flags.slice(0, 4);
}

export function buildTrainerNote(report, clientMeta = {}) {
  const manual =
    textForReport(report?.trainerNote) ||
    textForReport(report?.coachNote) ||
    textForReport(clientMeta?.trainerNote);
  const auto = textForReport(report?.signOff);

  if (manual) {
    return { text: manual, source: 'coach' };
  }
  if (auto) {
    return { text: auto, source: 'auto' };
  }
  return null;
}

export function buildTrainerWeekInsights(stats, days, report, clientMeta = {}) {
  return {
    workoutAdherence: buildWorkoutAdherence(stats, report, clientMeta),
    redFlags: buildRedFlags(stats, days, report),
    trainerNote: buildTrainerNote(report, clientMeta),
  };
}
