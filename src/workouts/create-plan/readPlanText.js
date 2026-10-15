// Turn AI workout-plan text into the day cards the plan viewer expects.
// Flow: peel JSON out of markdown → normalize Claude/alternate keys → map days to viewer rows.
// Used by: WorkoutPlanView.jsx (and any screen that shows a generated plan).
// Key exports: tryParseJsonObject, normalizeStructuredPlanForViewer,
//   structuredPlanHasViewerContent, normalizeRouteWorkoutPlanItem,
//   mapStructuredDaysToPlanViewerRows, PLAN_BUILDER_COLORS

// ===== NAMED CONSTANTS =====

/** Colors the plan viewer / builder share — letters stay so screens keep matching. */
const PLAN_BUILDER_COLORS = {
  bgDark: '#0A0A0F',
  bgLight: '#F5F5F5',
  cardDark: '#12131A',
  cardLight: '#FFFFFF',
  pink: '#FF6B9D',
  /** Secondary accent for row icons (replaces old purple). */
  purple: '#64D2FF',
  cyan: '#06B6D4',
  orange: '#F97316',
  green: '#10B981',
};

/** Day-type tint on viewer cards — key letters (Push/Pull/Legs/…) stay frozen. */
const DAY_TYPE_COLORS = {
  Push: '#FF6B9D',
  Pull: '#06B6D4',
  Legs: '#F97316',
  'Full Body': '#10B981',
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

/**
 * Peel a JSON object out of AI reply text (fenced ```json blocks, trailing prose).
 * @param {string} rawText
 * @returns {string}
 */
function peelJsonObjectFromText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';

  let text = rawText.trim();

  // Claude often wraps JSON in ```json ... ``` even when we asked for raw JSON.
  // vocab: fence = markdown code fence (```) around a language block
  const fencePattern = /```(?:json)?\s*\n?/i;
  const fenceMatch = text.match(fencePattern);

  if (fenceMatch && fenceMatch.index != null) {
    text = text.slice(fenceMatch.index + fenceMatch[0].length);
    const closingFenceIndex = text.indexOf('```');
    if (closingFenceIndex !== -1) {
      text = text.slice(0, closingFenceIndex).trim();
    }
  } else {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  }

  // Keep outermost { ... } so trailing prose after valid JSON does not break parse.
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  return text.trim();
}

/**
 * Guess Push / Pull / Legs / Full Body from a day label or focus string.
 * @param {string} label
 * @returns {string}
 */
function inferDayTypeFromLabel(label) {
  const lower = (label || '').toLowerCase();
  if (/push/.test(lower)) return 'Push';
  if (/pull/.test(lower)) return 'Pull';
  if (/legs?|lower/.test(lower)) return 'Legs';
  if (/full\s*body|upper\s*lower/.test(lower)) return 'Full Body';
  return 'Full Body';
}

/**
 * Warm-up block → [{ name, duration, description }] for the viewer.
 * @param {*} warmUpRaw
 * @returns {Array<{name: string, duration: string, description: string}>}
 */
function normalizeWarmUpBlock(warmUpRaw) {
  if (warmUpRaw == null) return [];

  if (typeof warmUpRaw === 'string') {
    const trimmed = warmUpRaw.trim();
    if (!trimmed) return [];
    return [{ name: trimmed, duration: '', description: '' }];
  }

  if (!Array.isArray(warmUpRaw)) return [];

  return warmUpRaw.map((item) => {
    if (typeof item === 'string') {
      return { name: item, duration: '', description: '' };
    }
    return {
      name: String(item.name || item.exercise || item.label || '').trim(),
      duration: String(item.duration || item.time || '').trim(),
      description: String(item.description || item.notes || '').trim(),
    };
  });
}

/**
 * Main exercise list → viewer shape with sets / reps / rest / formCues.
 * @param {*} exerciseList
 * @returns {Array}
 */
function normalizeExerciseList(exerciseList) {
  if (!Array.isArray(exerciseList)) return [];

  return exerciseList.map((exercise) => {
    if (typeof exercise === 'string') {
      return { name: exercise.trim(), sets: '', reps: '', rest: '', formCues: [] };
    }

    const sets =
      exercise.sets != null
        ? String(exercise.sets)
        : exercise.setCount != null
          ? String(exercise.setCount)
          : '';
    const reps =
      exercise.reps != null
        ? String(exercise.reps)
        : exercise.repRange != null
          ? String(exercise.repRange)
          : '';
    const rest =
      exercise.rest != null
        ? String(exercise.rest)
        : exercise.restPeriod != null
          ? String(exercise.restPeriod)
          : '';

    let formCues = exercise.formCues || exercise.cues || exercise.form_cues;
    if (typeof formCues === 'string') formCues = formCues ? [formCues] : [];
    if (!Array.isArray(formCues)) formCues = [];

    const startingWeight =
      exercise.startingWeight != null
        ? String(exercise.startingWeight)
        : exercise.weight != null
          ? String(exercise.weight)
          : undefined;

    return {
      name: String(exercise.name || exercise.exercise || exercise.exerciseName || '').trim(),
      sets,
      reps,
      rest,
      startingWeight,
      formCues: formCues.map((cue) => String(cue)),
    };
  });
}

/**
 * Primary muscles field may be an array or a comma-separated string.
 * @param {*} rawMuscles
 * @returns {string[]}
 */
function primaryMusclesFromRaw(rawMuscles) {
  if (Array.isArray(rawMuscles)) return rawMuscles.map((muscle) => String(muscle));
  if (typeof rawMuscles === 'string') {
    return rawMuscles
      .split(/[,·/]/)
      .map((piece) => piece.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * One AI workout session → one viewer "day" card.
 * @param {object} workout
 * @param {number} index
 * @returns {object}
 */
function normalizeAiWorkoutToDay(workout, index) {
  const label = String(
    workout.label || workout.day || workout.title || `Day ${index + 1}`,
  ).trim();
  const focus = String(
    workout.focus || workout.sessionFocus || workout.session_type || '',
  ).trim();
  const hasExercises = Array.isArray(workout.exercises) && workout.exercises.length > 0;
  const looksLikeRest =
    workout.isRest === true ||
    (/\brest\b/i.test(focus) && !hasExercises) ||
    /\brest\s*day\b/i.test(label);

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
      workout.exercises ||
        workout.mainExercises ||
        workout.main_exercises ||
        workout.movements ||
        [],
    ),
    coolDown: workout.coolDown || workout.cooldown,
  };
}

/**
 * Parse "4 x 8-10" style sets/reps strings Claude sometimes returns.
 * @param {*} setsRepsRaw
 * @returns {{sets: string, reps: string}}
 */
function parseSetsRepsString(setsRepsRaw) {
  if (setsRepsRaw == null) return { sets: '', reps: '' };
  const text = String(setsRepsRaw).trim();
  // Examples: "4 x 8-10", "4 x 8–10", "3x5"
  const match = text.match(/(\d+)\s*[xX]\s*([\d]+(?:\s*[-–]\s*[\d]+)?)/);
  if (match) return { sets: match[1], reps: match[2].replace(/\s+/g, '') };
  return { sets: '', reps: text };
}

/**
 * Claude warmup exercise rows → viewer warm-up shape.
 * @param {*} exercisesRaw
 * @returns {Array}
 */
function normalizeClaudeWarmupExercises(exercisesRaw) {
  if (!Array.isArray(exercisesRaw)) return [];

  return exercisesRaw
    .map((item) => {
      if (item == null) return null;

      if (typeof item === 'string') {
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

      const name = String(item?.exerciseName || item?.name || item?.label || '').trim();
      if (!name) return null;

      return {
        name,
        duration: String(item?.duration || item?.time || ''),
        description: String(item?.notes || item?.description || ''),
      };
    })
    .filter(Boolean);
}

/**
 * Split Claude notes into short form-cue lines for the viewer.
 * @param {string} notes
 * @returns {string[]}
 */
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

/**
 * Claude mainWorkouts[] → viewer exercise rows.
 * @param {*} mainWorkoutsRaw
 * @returns {Array}
 */
function normalizeClaudeMainWorkouts(mainWorkoutsRaw) {
  if (!Array.isArray(mainWorkoutsRaw)) return [];

  return mainWorkoutsRaw
    .map((exercise) => {
      if (!exercise || typeof exercise !== 'object') return null;

      const name = String(
        exercise.exerciseName || exercise.name || exercise.exercise || exercise.title || '',
      ).trim();
      if (!name) return null;

      const { sets, reps } = parseSetsRepsString(
        exercise.setsReps ||
          exercise.sets_reps ||
          exercise.setsRepsRange ||
          exercise.setsAndReps,
      );

      // vocab/symbol: ?? = if left is null/undefined, try the next; keeps 0 rest seconds
      const restSecondsRaw =
        exercise.restSeconds ??
        exercise.restSecondsValue ??
        exercise.rest_seconds ??
        exercise.rest ??
        '';
      const rest =
        String(restSecondsRaw).replace(/[^\d]/g, '') || String(restSecondsRaw).trim();

      const notes = String(exercise.notes || exercise.formCues || exercise.cues || '').trim();

      return {
        name,
        sets: sets || '',
        reps: reps || '',
        rest: rest || '',
        startingWeight:
          exercise.startingWeight != null ? String(exercise.startingWeight) : undefined,
        formCues: formCuesFromNotesText(notes),
      };
    })
    .filter(Boolean);
}

/**
 * One Claude detailedWorkouts map entry → one viewer day (or null).
 * @param {string} dayKey
 * @param {object} dayObj
 * @param {number} index
 * @returns {object|null}
 */
function claudeDetailedDayToViewerDay(dayKey, dayObj, index) {
  if (!dayObj || typeof dayObj !== 'object') return null;

  const labelFromKey = String(dayKey || '')
    .replace(/^day\d+/i, '')
    .replace(/^_+/, '')
    .trim();
  const label =
    labelFromKey ||
    String(dayObj.day || dayObj.label || dayObj.title || `Day ${index + 1}`).trim();

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

  const warmBlock = dayObj.warmUp || dayObj.warmup || dayObj.warmupBlock;
  const warmUp =
    warmBlock && typeof warmBlock === 'object'
      ? normalizeClaudeWarmupExercises(warmBlock.exercises || warmBlock.items || [])
      : [];

  const coolBlock = dayObj.coolDown || dayObj.cooldown || dayObj.cooldownBlock;
  const coolDown =
    coolBlock && typeof coolBlock === 'object'
      ? normalizeClaudeWarmupExercises(coolBlock.exercises || coolBlock.items || [])
      : [];

  return {
    label,
    type: inferDayTypeFromLabel(focus || label),
    isRest: false,
    primaryMuscles: [],
    estimatedTime:
      dayObj.sessionDuration ||
      dayObj.sessionTime ||
      dayObj.duration ||
      dayObj.timeEstimate,
    warmUp,
    exercises: normalizeClaudeMainWorkouts(
      dayObj.mainWorkouts ||
        dayObj.mainWorkoutsList ||
        dayObj.main_workouts ||
        dayObj.workouts ||
        [],
    ),
    coolDown,
  };
}

/**
 * Claude schema: detailedWorkouts: { day1Monday: { focus, warmUp, mainWorkouts } }.
 * @param {object} detailedWorkouts
 * @returns {Array}
 */
function normalizeClaudeDetailedWorkoutsToDays(detailedWorkouts) {
  if (
    !detailedWorkouts ||
    typeof detailedWorkouts !== 'object' ||
    Array.isArray(detailedWorkouts)
  ) {
    return [];
  }

  return Object.entries(detailedWorkouts)
    .map(([dayKey, dayObj], index) => claudeDetailedDayToViewerDay(dayKey, dayObj, index))
    .filter(Boolean);
}

/**
 * Fill overview from planOverview / generalNotes / summary when overview is missing.
 * @param {object} plan
 */
function fillOverviewFromAlternateKeys(plan) {
  if (plan.overview) return;

  if (plan.planOverview != null) {
    const planOverview = plan.planOverview;
    if (typeof planOverview === 'string') {
      plan.overview = planOverview;
      return;
    }
    if (typeof planOverview === 'object') {
      const parts = [planOverview.title, planOverview.description, planOverview.note].filter(
        (part) => part != null && String(part).trim() !== '',
      );
      plan.overview = parts.map((part) => String(part).trim()).join('\n\n');
      return;
    }
  }

  if (plan.generalNotes) {
    plan.overview = String(plan.generalNotes);
    return;
  }
  if (plan.summary) {
    plan.overview = String(plan.summary);
  }
}

/**
 * weeklySchedule may be an object { trainingDays, restDays } instead of an array.
 * @param {object} plan
 */
function normalizeWeeklyScheduleToArray(plan) {
  if (plan.weeklySchedule == null || Array.isArray(plan.weeklySchedule)) return;

  const scheduleObject = plan.weeklySchedule;
  const rows = [];
  const trainingDays = scheduleObject.trainingDays || scheduleObject.training_days || [];
  const restDays = scheduleObject.restDays || scheduleObject.rest_days || [];

  if (Array.isArray(trainingDays)) {
    trainingDays.forEach((dayName) => {
      rows.push({ day: String(dayName).trim(), focus: 'Training' });
    });
  }
  if (Array.isArray(restDays)) {
    restDays.forEach((dayName) => {
      rows.push({ day: String(dayName).trim(), focus: 'Rest' });
    });
  }

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

/**
 * First array found under an object map (Claude sometimes nests workouts oddly).
 * @param {object} workoutsObject
 * @returns {Array|null}
 */
function firstArrayInsideObject(workoutsObject) {
  const keys = Object.keys(workoutsObject);
  for (const key of keys) {
    const value = workoutsObject[key];
    if (Array.isArray(value) && value.length) return value;
  }
  return null;
}

/**
 * Resolve Claude/alternate workout session arrays into a list (or fill plan.days).
 * Mutates plan.days when detailedWorkouts is an object map of days.
 * @param {object} plan
 * @returns {Array|null}
 */
function resolveWorkoutsArrayForPlan(plan) {
  if (Array.isArray(plan.workouts) && plan.workouts.length) return plan.workouts;

  if (!plan.detailedWorkouts) {
    if (plan.workouts && typeof plan.workouts === 'object' && !Array.isArray(plan.workouts)) {
      return firstArrayInsideObject(plan.workouts);
    }
    return null;
  }

  if (Array.isArray(plan.detailedWorkouts) && plan.detailedWorkouts.length) {
    return plan.detailedWorkouts;
  }

  // detailedWorkouts as { day1Monday: {...} } — derive days directly when plan.days empty
  if (
    plan.days == null &&
    typeof plan.detailedWorkouts === 'object' &&
    !Array.isArray(plan.detailedWorkouts)
  ) {
    const derivedDays = normalizeClaudeDetailedWorkoutsToDays(plan.detailedWorkouts);
    if (derivedDays && derivedDays.length) {
      plan.days = derivedDays;
      return null;
    }
  }

  const nested =
    plan.detailedWorkouts?.workouts ||
    plan.detailedWorkouts?.sessions ||
    plan.detailedWorkouts?.days ||
    plan.detailedWorkouts?.workoutDays;
  if (Array.isArray(nested) && nested.length) return nested;

  if (plan.workouts && typeof plan.workouts === 'object' && !Array.isArray(plan.workouts)) {
    return firstArrayInsideObject(plan.workouts);
  }

  return null;
}

/**
 * MON / TUE / … from a day label, weekly schedule row, or D1 fallback.
 * @param {string} label
 * @param {number} index
 * @param {Array|null} weeklySchedule
 * @returns {string}
 */
function derivePlanViewerDayShort(label, index, weeklySchedule) {
  const labelStr = String(label || '');

  const fullWeekday = labelStr.match(
    /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i,
  );
  if (fullWeekday) {
    const key = fullWeekday[0].toLowerCase();
    return WEEKDAY_FULL_TO_SHORT[key] || fullWeekday[0].substring(0, 3).toUpperCase();
  }

  const abbrWeekday = labelStr.match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i);
  if (abbrWeekday) {
    return abbrWeekday[0].length === 3
      ? abbrWeekday[0].toUpperCase()
      : abbrWeekday[0].substring(0, 3).toUpperCase();
  }

  const scheduleRow = weeklySchedule && weeklySchedule[index];
  if (scheduleRow?.day) {
    const scheduleMatch = String(scheduleRow.day).match(
      /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i,
    );
    if (scheduleMatch) {
      return scheduleMatch[0].length === 3
        ? scheduleMatch[0].toUpperCase()
        : scheduleMatch[0].substring(0, 3).toUpperCase();
    }
  }

  return `D${index + 1}`;
}

/**
 * One structured day → one plan-viewer row (short, focus, exercises, …).
 * @param {object} day
 * @param {number} dayIndex
 * @param {Array} weeklySchedule
 * @returns {object}
 */
function structuredDayToPlanViewerRow(day, dayIndex, weeklySchedule) {
  const short = derivePlanViewerDayShort(day?.label, dayIndex, weeklySchedule);
  const label = String(day?.label || `Day ${dayIndex + 1}`);

  const focus = day?.isRest
    ? 'Rest & Recovery'
    : [day?.type, ...(Array.isArray(day?.primaryMuscles) ? day.primaryMuscles.slice(0, 2) : [])]
        .filter(Boolean)
        .join(' · ') || String(day?.type || 'Training');

  const focusColor = day?.isRest
    ? undefined
    : DAY_TYPE_COLORS[day?.type] || PLAN_BUILDER_COLORS.pink;

  const exercises =
    !day?.isRest && Array.isArray(day?.exercises)
      ? day.exercises
          .map((exercise) => {
            const name = String(exercise?.name || '').trim();
            if (!name) return null;
            const muscle =
              (Array.isArray(day?.primaryMuscles) && day.primaryMuscles[0]) ||
              String(day?.type || '') ||
              '—';
            const notes =
              Array.isArray(exercise?.formCues) && exercise.formCues.length
                ? exercise.formCues.map((cue) => String(cue)).join('\n')
                : undefined;
            return {
              name,
              sets: exercise?.sets != null ? String(exercise.sets) : '1',
              reps: exercise?.reps != null ? String(exercise.reps) : '—',
              rest: exercise?.rest != null ? String(exercise.rest) : '',
              muscle: String(muscle),
              notes,
            };
          })
          .filter(Boolean)
      : [];

  return {
    short,
    day: label,
    focus,
    focusColor,
    rest: !!day?.isRest,
    recoveryNote: day?.isRest ? String(day?.restGuidance || '') : undefined,
    recoveryActivities: Array.isArray(day?.recoveryActivities)
      ? day.recoveryActivities
      : undefined,
    exercises,
    warmUp: Array.isArray(day?.warmUp) ? day.warmUp : [],
    coolDown: Array.isArray(day?.coolDown) ? day.coolDown : [],
  };
}

/**
 * One route-param workout item → viewer exercise row (or null).
 * @param {object} exercise
 * @param {object} item
 * @returns {object|null}
 */
function routeItemExerciseToViewerExercise(exercise, item) {
  if (!exercise || typeof exercise !== 'object') return null;

  const name = String(exercise.name || exercise.exercise || exercise.exerciseName || '').trim();
  if (!name) return null;

  const sets =
    exercise.sets != null
      ? String(exercise.sets)
      : exercise.setCount != null
        ? String(exercise.setCount)
        : '1';
  const reps =
    exercise.reps != null
      ? String(exercise.reps)
      : exercise.repRange != null
        ? String(exercise.repRange)
        : '—';
  const restEx = exercise.rest != null ? String(exercise.rest) : '';
  const muscle = String(exercise.muscle || exercise.muscleGroup || item.primaryMuscle || '').trim();

  let notes = exercise.notes != null ? String(exercise.notes) : '';
  if (!notes && Array.isArray(exercise.formCues)) {
    notes = exercise.formCues.filter(Boolean).join('\n');
  }

  return { name, sets, reps, rest: restEx, muscle, notes: notes || undefined };
}

// ===== MAIN FUNCTION =====

/**
 * Parse AI plan text into a JSON object, or null if it is not valid JSON.
 * @param {string} str
 * @returns {object|null}
 */
function tryParseJsonObject(str) {
  try {
    const raw = peelJsonObjectFromText(String(str || ''));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Claude often returns alternate keys (planOverview, workouts[], weeklySchedule object).
 * Viewer expects overview string, weeklySchedule: {day,focus}[], days: day cards.
 * @param {object} raw
 * @returns {object|null}
 */
function normalizeStructuredPlanForViewer(raw) {
  if (!raw || typeof raw !== 'object') return null;

  // 1. Shallow copy so we never mutate the caller's object.
  const plan = { ...raw };

  // 2. overview from planOverview / notes / summary when missing.
  fillOverviewFromAlternateKeys(plan);

  // 3. weeklySchedule object → [{ day, focus }, …].
  normalizeWeeklyScheduleToArray(plan);

  // 4. workouts / detailedWorkouts → plan.days when days are empty.
  const workoutsArray = resolveWorkoutsArrayForPlan(plan);
  if ((!plan.days || !plan.days.length) && Array.isArray(workoutsArray) && workoutsArray.length) {
    plan.days = workoutsArray.map((workout, index) => normalizeAiWorkoutToDay(workout, index));
  }

  return plan;
}

/**
 * True when the parsed plan has at least one day the viewer can turn into a card.
 * @param {object} structuredPlan
 * @returns {boolean}
 */
function structuredPlanHasViewerContent(structuredPlan) {
  if (!structuredPlan || typeof structuredPlan !== 'object') return false;
  const dayCount = Array.isArray(structuredPlan.days) ? structuredPlan.days.length : 0;
  return dayCount > 0;
}

/**
 * Normalize one workout day from navigation route params into viewer row shape.
 * @param {object} item
 * @param {number} index
 * @returns {object|null}
 */
function normalizeRouteWorkoutPlanItem(item, index) {
  if (!item || typeof item !== 'object') return null;

  const rawShort = String(item.short || item.dayShort || '').trim();
  const day = String(item.day || item.label || item.name || `Day ${index + 1}`).trim();
  const inferredShort = derivePlanViewerDayShort(day, index, null);
  const short = VALID_DAY_SHORTS.includes(rawShort) ? rawShort : inferredShort;
  const focus =
    String(item.focus || item.focusArea || item.sessionFocus || '').trim() || 'Training';
  const rest = !!(item.rest || item.isRest);
  const focusColor =
    item.focusColor ||
    (item.type && DAY_TYPE_COLORS[item.type]) ||
    PLAN_BUILDER_COLORS.pink;

  const rawExercises = Array.isArray(item.exercises) ? item.exercises : [];
  const exercises = rawExercises
    .map((exercise) => routeItemExerciseToViewerExercise(exercise, item))
    .filter(Boolean);

  return {
    short,
    day,
    focus,
    focusColor,
    rest,
    recoveryNote:
      item.recoveryNote != null
        ? String(item.recoveryNote)
        : item.restGuidance != null
          ? String(item.restGuidance)
          : undefined,
    recoveryActivities: Array.isArray(item.recoveryActivities)
      ? item.recoveryActivities
      : undefined,
    exercises,
    warmUp: Array.isArray(item.warmUp) ? item.warmUp : [],
    coolDown: Array.isArray(item.coolDown) ? item.coolDown : [],
  };
}

/**
 * Map structured plan.days into the row list MyWorkoutPlanScreen renders.
 * @param {object} structured
 * @returns {Array}
 */
function mapStructuredDaysToPlanViewerRows(structured) {
  const days = structured?.days;
  if (!Array.isArray(days) || days.length === 0) return [];

  const weeklySchedule = structured?.weeklySchedule || [];
  return days.map((day, dayIndex) =>
    structuredDayToPlanViewerRow(day, dayIndex, weeklySchedule),
  );
}

export {
  tryParseJsonObject,
  normalizeStructuredPlanForViewer,
  structuredPlanHasViewerContent,
  normalizeRouteWorkoutPlanItem,
  mapStructuredDaysToPlanViewerRows,
  PLAN_BUILDER_COLORS,
};
