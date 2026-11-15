// Turn AI workout-plan text into the day cards the plan viewer expects.
// Flow: peel JSON from markdown → normalize Claude keys → map days to viewer rows.
// Used by WorkoutPlanView and plan screens.
// Export names + PLAN_BUILDER_COLORS / day-type key letters stay frozen.

import { lightColors } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====
// Design Law: chrome = ink/muted; never green; brand pink only as tiny accents elsewhere.

export const PLAN_BUILDER_COLORS = {
  bgDark: lightColors.nbInk,
  bgLight: '#F5F5F5',
  cardDark: '#12131A',
  cardLight: lightColors.white,
  // Manipulate here: was brand pink (#E25588) — chrome spinners/CTAs use ink now
  pink: lightColors.nbInk,
  // Manipulate here: row icon accent (was purple — Design Law cyan)
  purple: '#64D2FF',
  cyan: '#06B6D4',
  orange: '#F97316',
  green: lightColors.nbMuted,
};

// Day-type tint on viewer cards — key letters (Push/Pull/Legs/…) stay frozen.
const DAY_TYPE_COLORS = {
  Push: '#F97316',
  Pull: '#06B6D4',
  Legs: '#F97316',
  'Full Body': '#64D2FF',
  Rest: '#555',
};

const VALID_DAY_SHORTS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const WEEKDAY_FULL_TO_SHORT = {
  monday: 'MON',
  tuesday: 'TUE',
  wednesday: 'WED',
  thursday: 'THU',
  friday: 'FRI',
  saturday: 'SAT',
  sunday: 'SUN',
};

// Manipulate here: how many form-cue snippets we keep from one Claude notes string
const MAX_FORM_CUES_FROM_NOTES = 6;

// Manipulate here: minimum character length for a split form-cue piece to keep
const MIN_FORM_CUE_PIECE_LENGTH = 2;

// ===== HELPER FUNCTIONS =====

function fillDaysFromWorkoutsWhenEmpty(plan) {
  const workoutsArray = resolveWorkoutsArrayForPlan(plan);
  const daysMissing = !plan.days || !plan.days.length;
  const hasWorkouts = Array.isArray(workoutsArray) && workoutsArray.length > 0;
  if (!daysMissing || !hasWorkouts) return;

  const mappedDays = [];
  for (let index = 0; index < workoutsArray.length; index += 1) {
    mappedDays.push(normalizeAiWorkoutToDay(workoutsArray[index], index));
  }
  plan.days = mappedDays;
}

function mapRouteItemExercises(item) {
  const rawExercises = Array.isArray(item.exercises) ? item.exercises : [];
  const exercises = [];
  for (const exercise of rawExercises) {
    const row = routeItemExerciseToViewerExercise(exercise, item);
    if (row) exercises.push(row);
  }
  return exercises;
}

function readRecoveryNoteFromItem(item) {
  if (item.recoveryNote != null) return String(item.recoveryNote);
  if (item.restGuidance != null) return String(item.restGuidance);
  return undefined;
}

/** Shared: pass through estimatedTime or sessionDuration for plan hero copy. */
function pickEstimatedTimeFields(dayOrItem) {
  if (dayOrItem && dayOrItem.estimatedTime != null) {
    return { estimatedTime: dayOrItem.estimatedTime };
  }
  if (dayOrItem && dayOrItem.sessionDuration != null) {
    return { estimatedTime: dayOrItem.sessionDuration };
  }
  return {};
}

function readSetsStringFromExercise(exercise) {
  if (exercise.sets != null) return String(exercise.sets);
  if (exercise.setCount != null) return String(exercise.setCount);
  return '';
}

function readRepsStringFromExercise(exercise) {
  if (exercise.reps != null) return String(exercise.reps);
  if (exercise.repRange != null) return String(exercise.repRange);
  return '';
}

function readRestStringFromExercise(exercise) {
  if (exercise.rest != null) return String(exercise.rest);
  if (exercise.restPeriod != null) return String(exercise.restPeriod);
  return '';
}

function readStartingWeightFromExercise(exercise) {
  if (exercise.startingWeight != null) return String(exercise.startingWeight);
  if (exercise.weight != null) return String(exercise.weight);
  return undefined;
}

function readEquipmentStringFromExercise(exercise) {
  if (exercise.equipment != null) return String(exercise.equipment);
  if (exercise.equip != null) return String(exercise.equip);
  return undefined;
}

function normalizeFormCuesList(rawCues) {
  let formCues = rawCues;
  if (typeof formCues === 'string') {
    formCues = formCues ? [formCues] : [];
  }
  if (!Array.isArray(formCues)) formCues = [];

  const cuesAsStrings = [];
  for (const cue of formCues) {
    cuesAsStrings.push(String(cue));
  }
  return cuesAsStrings;
}

/**
 * Claude often wraps JSON in ```json ... ``` even when we asked for raw JSON.
 * vocab: fence = markdown code fence (```) around a language block
 * @param {string} rawText
 * @returns {string}
 */
function peelJsonObjectFromText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';

  let text = rawText.trim();
  text = stripMarkdownJsonFence(text);
  text = keepOutermostJsonObject(text);
  return text.trim();
}

function stripMarkdownJsonFence(text) {
  const fencePattern = /```(?:json)?\s*\n?/i;
  const fenceMatch = text.match(fencePattern);

  if (fenceMatch && fenceMatch.index != null) {
    let afterOpen = text.slice(fenceMatch.index + fenceMatch[0].length);
    const closingFenceIndex = afterOpen.indexOf('```');
    if (closingFenceIndex !== -1) {
      afterOpen = afterOpen.slice(0, closingFenceIndex).trim();
    }
    return afterOpen;
  }

  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}

function keepOutermostJsonObject(text) {
  // Keep outermost { ... } so trailing prose after valid JSON does not break parse.
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  const bracesLookValid =
    firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace;
  if (!bracesLookValid) return text;
  return text.slice(firstBrace, lastBrace + 1);
}

function inferDayTypeFromLabel(label) {
  const lower = (label || '').toLowerCase();
  if (/push/.test(lower)) return 'Push';
  if (/pull/.test(lower)) return 'Pull';
  if (/legs?|lower/.test(lower)) return 'Legs';
  if (/full\s*body|upper\s*lower/.test(lower)) return 'Full Body';
  return 'Full Body';
}

function normalizeWarmUpBlock(warmUpRaw) {
  if (warmUpRaw == null) return [];

  if (typeof warmUpRaw === 'string') {
    const trimmed = warmUpRaw.trim();
    if (!trimmed) return [];
    return [{ name: trimmed, duration: '', description: '' }];
  }

  if (!Array.isArray(warmUpRaw)) return [];

  const blocks = [];
  for (const item of warmUpRaw) {
    blocks.push(oneWarmUpItemToBlock(item));
  }
  return blocks;
}

function oneWarmUpItemToBlock(item) {
  if (typeof item === 'string') {
    return { name: item, duration: '', description: '' };
  }
  return {
    name: String(item.name || item.exercise || item.label || '').trim(),
    duration: String(item.duration || item.time || '').trim(),
    description: String(item.description || item.notes || '').trim(),
  };
}

function normalizeExerciseList(exerciseList) {
  if (!Array.isArray(exerciseList)) return [];

  const normalized = [];
  for (const exercise of exerciseList) {
    normalized.push(oneExerciseToNormalizedRow(exercise));
  }
  return normalized;
}

function oneExerciseToNormalizedRow(exercise) {
  if (typeof exercise === 'string') {
    return { name: exercise.trim(), sets: '', reps: '', rest: '', formCues: [] };
  }

  const rawCues = exercise.formCues || exercise.cues || exercise.form_cues;
  const exerciseName = String(
    exercise.name || exercise.exercise || exercise.exerciseName || '',
  ).trim();

  return {
    name: exerciseName,
    sets: readSetsStringFromExercise(exercise),
    reps: readRepsStringFromExercise(exercise),
    rest: readRestStringFromExercise(exercise),
    startingWeight: readStartingWeightFromExercise(exercise),
    formCues: normalizeFormCuesList(rawCues),
  };
}

function primaryMusclesFromRaw(rawMuscles) {
  if (Array.isArray(rawMuscles)) {
    return stringListFromAnyArray(rawMuscles);
  }
  if (typeof rawMuscles === 'string') {
    return musclesFromCommaSeparatedText(rawMuscles);
  }
  return [];
}

function stringListFromAnyArray(rawList) {
  const strings = [];
  for (const item of rawList) {
    strings.push(String(item));
  }
  return strings;
}

function musclesFromCommaSeparatedText(rawMuscles) {
  // Claude sometimes sends "chest, shoulders / triceps" as one string.
  const pieces = rawMuscles.split(/[,·/]/);
  const muscles = [];
  for (const piece of pieces) {
    const trimmed = piece.trim();
    if (!trimmed) continue;
    muscles.push(trimmed);
  }
  return muscles;
}

function normalizeAiWorkoutToDay(workout, index) {
  const label = String(
    workout.label || workout.day || workout.title || `Day ${index + 1}`,
  ).trim();
  const focus = String(
    workout.focus || workout.sessionFocus || workout.session_type || '',
  ).trim();
  const hasExercises = Array.isArray(workout.exercises) && workout.exercises.length > 0;
  const looksLikeRest =
    workout.isRest === true
    || (/\brest\b/i.test(focus) && !hasExercises)
    || /\brest\s*day\b/i.test(label);

  if (looksLikeRest) {
    return {
      label,
      type: 'Rest',
      isRest: true,
      restGuidance: workout.restGuidance || workout.notes || workout.guidance || focus || '',
    };
  }

  return {
    label: label || `Session ${index + 1}`,
    type: inferDayTypeFromLabel(focus || label),
    isRest: false,
    primaryMuscles: primaryMusclesFromRaw(
      workout.primaryMuscles || workout.muscles || workout.muscleGroups,
    ),
    estimatedTime:
      workout.estimatedTime || workout.duration || workout.sessionTime || workout.timeEstimate,
    warmUp: normalizeWarmUpBlock(workout.warmUp || workout.warmup || workout.warm_up),
    exercises: normalizeExerciseList(
      workout.exercises
        || workout.mainExercises
        || workout.main_exercises
        || workout.movements
        || [],
    ),
    coolDown: workout.coolDown || workout.cooldown,
  };
}

function parseSetsRepsString(setsRepsRaw) {
  if (setsRepsRaw == null) return { sets: '', reps: '' };
  const text = String(setsRepsRaw).trim();
  // Examples: "4 x 8-10", "4 x 8–10", "3x5"
  const match = text.match(/(\d+)\s*[xX]\s*([\d]+(?:\s*[-–]\s*[\d]+)?)/);
  if (match) {
    return { sets: match[1], reps: match[2].replace(/\s+/g, '') };
  }
  return { sets: '', reps: text };
}

function normalizeClaudeWarmupExercises(exercisesRaw) {
  if (!Array.isArray(exercisesRaw)) return [];

  const blocks = [];
  for (const item of exercisesRaw) {
    const block = oneClaudeWarmupItemToBlock(item);
    if (block) blocks.push(block);
  }
  return blocks;
}

function oneClaudeWarmupItemToBlock(item) {
  if (item == null) return null;

  if (typeof item === 'string') {
    return claudeWarmupStringToBlock(item);
  }

  const name = String(item.exerciseName || item.name || item.label || '').trim();
  if (!name) return null;

  return {
    name,
    duration: String(item.duration || item.time || ''),
    description: String(item.notes || item.description || ''),
  };
}

function claudeWarmupStringToBlock(item) {
  const trimmed = item.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(':');
  if (parts.length >= 2) {
    return {
      name: parts[0].trim(),
      duration: '',
      description: parts.slice(1).join(':').trim(),
    };
  }
  return { name: trimmed, duration: '', description: '' };
}

function formCuesFromNotesText(notes) {
  if (!notes) return [];

  const pieces = notes
    .split(/[,;]\s*|\.\s+/)
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > MIN_FORM_CUE_PIECE_LENGTH)
    .slice(0, MAX_FORM_CUES_FROM_NOTES);

  if (pieces.length === 0) return [notes];
  return pieces;
}

function normalizeClaudeMainWorkouts(mainWorkoutsRaw) {
  if (!Array.isArray(mainWorkoutsRaw)) return [];

  const rows = [];
  for (const exercise of mainWorkoutsRaw) {
    const row = oneClaudeMainWorkoutToRow(exercise);
    if (row) rows.push(row);
  }
  return rows;
}

function oneClaudeMainWorkoutToRow(exercise) {
  if (!exercise || typeof exercise !== 'object') return null;

  const name = String(
    exercise.exerciseName || exercise.name || exercise.exercise || exercise.title || '',
  ).trim();
  if (!name) return null;

  const setsReps = parseSetsRepsString(
    exercise.setsReps
      || exercise.sets_reps
      || exercise.setsRepsRange
      || exercise.setsAndReps,
  );

  // vocab/symbol: ?? = if left is null/undefined, try the next; keeps 0 rest seconds
  const restSecondsRaw =
    exercise.restSeconds
    ?? exercise.restSecondsValue
    ?? exercise.rest_seconds
    ?? exercise.rest
    ?? '';
  const rest =
    String(restSecondsRaw).replace(/[^\d]/g, '') || String(restSecondsRaw).trim();

  const notes = String(exercise.notes || exercise.formCues || exercise.cues || '').trim();

  return {
    name,
    sets: setsReps.sets || '',
    reps: setsReps.reps || '',
    rest: rest || '',
    startingWeight:
      exercise.startingWeight != null ? String(exercise.startingWeight) : undefined,
    formCues: formCuesFromNotesText(notes),
  };
}

function claudeDetailedDayToViewerDay(dayKey, dayObj, index) {
  if (!dayObj || typeof dayObj !== 'object') return null;

  const label = readClaudeDayLabel(dayKey, dayObj, index);
  const focus = String(
    dayObj.focus || dayObj.sessionFocus || dayObj.session_type || '',
  ).trim();
  const isRest =
    dayObj.isRest === true || /rest/i.test(focus) || /rest/i.test(label);

  if (isRest) {
    return {
      label,
      type: 'Rest',
      isRest: true,
      restGuidance: String(
        dayObj.restGuidance || dayObj.notes || dayObj.guidance || focus || '',
      ).trim(),
    };
  }

  const warmUp = readClaudeWarmOrCoolBlock(
    dayObj.warmUp || dayObj.warmup || dayObj.warmupBlock,
  );
  const coolDown = readClaudeWarmOrCoolBlock(
    dayObj.coolDown || dayObj.cooldown || dayObj.cooldownBlock,
  );

  return {
    label,
    type: inferDayTypeFromLabel(focus || label),
    isRest: false,
    primaryMuscles: [],
    estimatedTime:
      dayObj.sessionDuration
      || dayObj.sessionTime
      || dayObj.duration
      || dayObj.timeEstimate,
    warmUp,
    exercises: normalizeClaudeMainWorkouts(
      dayObj.mainWorkouts
        || dayObj.mainWorkoutsList
        || dayObj.main_workouts
        || dayObj.workouts
        || [],
    ),
    coolDown,
  };
}

function readClaudeDayLabel(dayKey, dayObj, index) {
  const labelFromKey = String(dayKey || '')
    .replace(/^day\d+/i, '')
    .replace(/^_+/, '')
    .trim();
  if (labelFromKey) return labelFromKey;
  return String(dayObj.day || dayObj.label || dayObj.title || `Day ${index + 1}`).trim();
}

function readClaudeWarmOrCoolBlock(warmOrCoolBlock) {
  if (!warmOrCoolBlock || typeof warmOrCoolBlock !== 'object') return [];
  return normalizeClaudeWarmupExercises(
    warmOrCoolBlock.exercises || warmOrCoolBlock.items || [],
  );
}

function normalizeClaudeDetailedWorkoutsToDays(detailedWorkouts) {
  if (!detailedWorkouts || typeof detailedWorkouts !== 'object') return [];
  if (Array.isArray(detailedWorkouts)) return [];

  const days = [];
  const entries = Object.entries(detailedWorkouts);
  for (let index = 0; index < entries.length; index += 1) {
    const dayKey = entries[index][0];
    const dayObj = entries[index][1];
    const day = claudeDetailedDayToViewerDay(dayKey, dayObj, index);
    if (day) days.push(day);
  }
  return days;
}

function fillOverviewFromAlternateKeys(plan) {
  if (plan.overview) return;

  if (plan.planOverview != null) {
    fillOverviewFromPlanOverview(plan);
    return;
  }

  if (plan.generalNotes) {
    plan.overview = String(plan.generalNotes);
    return;
  }
  if (plan.summary) {
    plan.overview = String(plan.summary);
  }
}

function fillOverviewFromPlanOverview(plan) {
  const planOverview = plan.planOverview;
  if (typeof planOverview === 'string') {
    plan.overview = planOverview;
    return;
  }
  if (typeof planOverview !== 'object') return;

  const parts = [planOverview.title, planOverview.description, planOverview.note];
  const kept = [];
  for (const part of parts) {
    if (part == null) continue;
    if (String(part).trim() === '') continue;
    kept.push(String(part).trim());
  }
  plan.overview = kept.join('\n\n');
}

function normalizeWeeklyScheduleToArray(plan) {
  if (plan.weeklySchedule == null || Array.isArray(plan.weeklySchedule)) return;

  const scheduleObject = plan.weeklySchedule;
  const rows = rowsFromTrainingAndRestDays(scheduleObject);
  if (rows.length) {
    plan.weeklySchedule = rows;
    return;
  }

  if (scheduleObject.activeRecovery != null && String(scheduleObject.activeRecovery).trim()) {
    plan.weeklySchedule = [
      { day: 'Recovery', focus: String(scheduleObject.activeRecovery).trim() },
    ];
    return;
  }

  plan.weeklySchedule = [];
}

function rowsFromTrainingAndRestDays(scheduleObject) {
  const rows = [];
  const trainingDays = scheduleObject.trainingDays || scheduleObject.training_days || [];
  const restDays = scheduleObject.restDays || scheduleObject.rest_days || [];

  if (Array.isArray(trainingDays)) {
    for (const dayName of trainingDays) {
      rows.push({ day: String(dayName).trim(), focus: 'Training' });
    }
  }
  if (Array.isArray(restDays)) {
    for (const dayName of restDays) {
      rows.push({ day: String(dayName).trim(), focus: 'Rest' });
    }
  }
  return rows;
}

function firstArrayInsideObject(workoutsObject) {
  const keys = Object.keys(workoutsObject);
  for (const key of keys) {
    const value = workoutsObject[key];
    if (Array.isArray(value) && value.length) return value;
  }
  return null;
}

function resolveWorkoutsArrayForPlan(plan) {
  if (Array.isArray(plan.workouts) && plan.workouts.length) return plan.workouts;

  if (!plan.detailedWorkouts) {
    return workoutsObjectFirstArrayOrNull(plan.workouts);
  }

  if (Array.isArray(plan.detailedWorkouts) && plan.detailedWorkouts.length) {
    return plan.detailedWorkouts;
  }

  // detailedWorkouts as { day1Monday: {...} } — derive days directly when plan.days empty
  if (tryDeriveDaysFromDetailedWorkoutsObject(plan)) {
    return null;
  }

  const nested =
    plan.detailedWorkouts.workouts
    || plan.detailedWorkouts.sessions
    || plan.detailedWorkouts.days
    || plan.detailedWorkouts.workoutDays;
  if (Array.isArray(nested) && nested.length) return nested;

  return workoutsObjectFirstArrayOrNull(plan.workouts);
}

function workoutsObjectFirstArrayOrNull(workouts) {
  if (!workouts || typeof workouts !== 'object' || Array.isArray(workouts)) return null;
  return firstArrayInsideObject(workouts);
}

function tryDeriveDaysFromDetailedWorkoutsObject(plan) {
  const detailed = plan.detailedWorkouts;
  const isObjectMap =
    plan.days == null
    && detailed
    && typeof detailed === 'object'
    && !Array.isArray(detailed);
  if (!isObjectMap) return false;

  const derivedDays = normalizeClaudeDetailedWorkoutsToDays(detailed);
  if (!derivedDays || !derivedDays.length) return false;
  plan.days = derivedDays;
  return true;
}

function derivePlanViewerDayShort(label, index, weeklySchedule) {
  const labelStr = String(label || '');

  const fromFullWeekday = shortFromFullWeekdayInLabel(labelStr);
  if (fromFullWeekday) return fromFullWeekday;

  const fromAbbrWeekday = shortFromAbbrWeekdayInLabel(labelStr);
  if (fromAbbrWeekday) return fromAbbrWeekday;

  const fromSchedule = shortFromWeeklyScheduleRow(weeklySchedule, index);
  if (fromSchedule) return fromSchedule;

  return `D${index + 1}`;
}

function shortFromFullWeekdayInLabel(labelStr) {
  const fullWeekday = labelStr.match(
    /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i,
  );
  if (!fullWeekday) return null;
  const key = fullWeekday[0].toLowerCase();
  return WEEKDAY_FULL_TO_SHORT[key] || fullWeekday[0].substring(0, 3).toUpperCase();
}

function shortFromAbbrWeekdayInLabel(labelStr) {
  const abbrWeekday = labelStr.match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i);
  if (!abbrWeekday) return null;
  if (abbrWeekday[0].length === 3) return abbrWeekday[0].toUpperCase();
  return abbrWeekday[0].substring(0, 3).toUpperCase();
}

function shortFromWeeklyScheduleRow(weeklySchedule, index) {
  const scheduleRow = weeklySchedule && weeklySchedule[index];
  if (!scheduleRow || !scheduleRow.day) return null;

  const scheduleMatch = String(scheduleRow.day).match(
    /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i,
  );
  if (!scheduleMatch) return null;
  if (scheduleMatch[0].length === 3) return scheduleMatch[0].toUpperCase();
  return scheduleMatch[0].substring(0, 3).toUpperCase();
}

function structuredDayToPlanViewerRow(day, dayIndex, weeklySchedule) {
  const short = derivePlanViewerDayShort(day && day.label, dayIndex, weeklySchedule);
  const label = String((day && day.label) || `Day ${dayIndex + 1}`);
  const isRestDay = !!(day && day.isRest);

  const focusText = focusTextForStructuredDay(day, isRestDay);
  const focusColor = isRestDay
    ? undefined
    : DAY_TYPE_COLORS[day && day.type] || PLAN_BUILDER_COLORS.pink;
  const exercises = isRestDay ? [] : mapStructuredExercises(day);
  const timeExtra = pickEstimatedTimeFields(day);

  return {
    short,
    day: label,
    focus: focusText,
    focusColor,
    rest: isRestDay,
    recoveryNote: isRestDay ? String((day && day.restGuidance) || '') : undefined,
    recoveryActivities: Array.isArray(day && day.recoveryActivities)
      ? day.recoveryActivities
      : undefined,
    exercises,
    warmUp: Array.isArray(day && day.warmUp) ? day.warmUp : [],
    coolDown: Array.isArray(day && day.coolDown) ? day.coolDown : [],
    ...timeExtra,
  };
}

function focusTextForStructuredDay(day, isRestDay) {
  if (isRestDay) return 'Rest & Recovery';

  const muscleSlice = Array.isArray(day && day.primaryMuscles)
    ? day.primaryMuscles.slice(0, 2)
    : [];
  const focusParts = [day && day.type, ...muscleSlice].filter(Boolean);
  const joined = focusParts.join(' · ');
  return joined || String((day && day.type) || 'Training');
}

function mapStructuredExercises(day) {
  if (!day || !Array.isArray(day.exercises)) return [];
  const exercises = [];
  for (const exercise of day.exercises) {
    const row = structuredExerciseToViewerExercise(exercise, day);
    if (row) exercises.push(row);
  }
  return exercises;
}

function structuredExerciseToViewerExercise(exercise, day) {
  const name = String((exercise && exercise.name) || '').trim();
  if (!name) return null;

  const primaryMuscle = Array.isArray(day && day.primaryMuscles)
    ? day.primaryMuscles[0]
    : '';
  const muscle = primaryMuscle || String((day && day.type) || '') || '—';

  let notes;
  if (Array.isArray(exercise && exercise.formCues) && exercise.formCues.length) {
    const cueLines = [];
    for (const cue of exercise.formCues) {
      cueLines.push(String(cue));
    }
    notes = cueLines.join('\n');
  }

  const weight = readStartingWeightFromExercise(exercise);
  const equipment = readEquipmentStringFromExercise(exercise);

  const setsText = exercise && exercise.sets != null ? String(exercise.sets) : '1';
  const repsText = exercise && exercise.reps != null ? String(exercise.reps) : '—';
  const restText = exercise && exercise.rest != null ? String(exercise.rest) : '';

  const row = {
    name,
    sets: setsText,
    reps: repsText,
    rest: restText,
    muscle: String(muscle),
    notes,
  };
  if (weight) row.weight = weight;
  if (equipment) row.equipment = equipment;
  return row;
}

function routeItemExerciseToViewerExercise(exercise, item) {
  if (!exercise || typeof exercise !== 'object') return null;

  const name = String(exercise.name || exercise.exercise || exercise.exerciseName || '').trim();
  if (!name) return null;

  let sets = readSetsStringFromExercise(exercise);
  if (!sets) sets = '1';

  let reps = readRepsStringFromExercise(exercise);
  if (!reps) reps = '—';

  const restSeconds = exercise.rest != null ? String(exercise.rest) : '';
  const muscle = String(
    exercise.muscle || exercise.muscleGroup || item.primaryMuscle || '',
  ).trim();

  const notes = notesFromExerciseOrFormCues(exercise);
  const weight = readStartingWeightFromExercise(exercise);
  const equipment = readEquipmentStringFromExercise(exercise);

  const row = {
    name,
    sets,
    reps,
    rest: restSeconds,
    muscle,
    notes: notes || undefined,
  };
  if (weight) row.weight = weight;
  if (equipment) row.equipment = equipment;
  return row;
}

function notesFromExerciseOrFormCues(exercise) {
  if (exercise.notes != null) return String(exercise.notes);
  if (!Array.isArray(exercise.formCues)) return '';
  return joinTruthyFormCues(exercise.formCues);
}

function joinTruthyFormCues(formCues) {
  const cueLines = [];
  for (const cue of formCues) {
    if (!cue) continue;
    cueLines.push(cue);
  }
  return cueLines.join('\n');
}

// ===== MAIN FUNCTION =====

/**
 * Peel markdown fences / trailing prose, then JSON.parse. Null on any syntax error.
 * @param {string} str
 * @returns {object|null}
 */
export function tryParseJsonObject(str) {
  // 1. Strip fences and keep outermost { … }.
  const peeled = peelJsonObjectFromText(String(str || ''));
  if (!peeled) return null;

  // 2. Parse — caller keeps planText as markdown when this returns null.
  try {
    return JSON.parse(peeled);
  } catch (_parseError) {
    return null;
  }
}

/**
 * Normalize Claude / alternate plan keys into the shape the viewer reads.
 * @param {object} raw
 * @returns {object|null}
 */
export function normalizeStructuredPlanForViewer(raw) {
  // 1. Refuse non-objects.
  if (!raw || typeof raw !== 'object') return null;

  // 2. Shallow copy so we never mutate the caller’s object.
  const plan = { ...raw };

  // 3. overview from planOverview / notes / summary when missing.
  fillOverviewFromAlternateKeys(plan);

  // 4. weeklySchedule object → [{ day, focus }, …].
  normalizeWeeklyScheduleToArray(plan);

  // 5. workouts / detailedWorkouts → plan.days when days are empty.
  fillDaysFromWorkoutsWhenEmpty(plan);

  return plan;
}

/**
 * True when the structured plan has at least one day card to show.
 * @param {object} structuredPlan
 * @returns {boolean}
 */
export function structuredPlanHasViewerContent(structuredPlan) {
  if (!structuredPlan || typeof structuredPlan !== 'object') return false;
  const days = structuredPlan.days;
  if (!Array.isArray(days)) return false;
  return days.length > 0;
}

/**
 * Normalize one route/nav workout item into a viewer day row.
 * @param {object} item
 * @param {number} index
 * @returns {object|null}
 */
export function normalizeRouteWorkoutPlanItem(item, index) {
  // 1. Refuse non-objects.
  if (!item || typeof item !== 'object') return null;

  // 2. Day label + short weekday code.
  const rawShort = String(item.short || item.dayShort || '').trim();
  const day = String(item.day || item.label || item.name || `Day ${index + 1}`).trim();
  const inferredShort = derivePlanViewerDayShort(day, index, null);
  let short = inferredShort;
  if (VALID_DAY_SHORTS.includes(rawShort)) {
    short = rawShort;
  }

  // 3. Focus / rest / color / exercises.
  const focusText =
    String(item.focus || item.focusArea || item.sessionFocus || '').trim() || 'Training';
  const rest = !!(item.rest || item.isRest);
  const typeColor = item.type ? DAY_TYPE_COLORS[item.type] : undefined;
  const focusColor = item.focusColor || typeColor || PLAN_BUILDER_COLORS.pink;
  const exercises = mapRouteItemExercises(item);

  // 4. Optional recovery note + time fields.
  const recoveryNote = readRecoveryNoteFromItem(item);
  const timeExtra = pickEstimatedTimeFields(item);

  return {
    short,
    day,
    focus: focusText,
    focusColor,
    rest,
    recoveryNote,
    recoveryActivities: Array.isArray(item.recoveryActivities)
      ? item.recoveryActivities
      : undefined,
    exercises,
    warmUp: Array.isArray(item.warmUp) ? item.warmUp : [],
    coolDown: Array.isArray(item.coolDown) ? item.coolDown : [],
    ...timeExtra,
  };
}

/**
 * Map structured plan.days into the row list MyWorkoutPlanScreen renders.
 * @param {object} structured
 * @returns {Array}
 */
export function mapStructuredDaysToPlanViewerRows(structured) {
  // 1. Need a non-empty days array.
  const days = structured && structured.days;
  if (!Array.isArray(days) || days.length === 0) return [];

  // 2. Build one viewer row per day (weeklySchedule helps weekday shorts).
  const weeklySchedule = (structured && structured.weeklySchedule) || [];
  const rows = [];
  for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
    rows.push(structuredDayToPlanViewerRow(days[dayIndex], dayIndex, weeklySchedule));
  }
  return rows;
}

