/**
 * Workout plan parsing helpers for plan viewer screens.
 */
function extractJSON(str) {
  if (!str || typeof str !== 'string') return '';
  let s = str.trim();

  // Claude often returns ```json ... ``` even when asked for raw JSON; strip any fenced block.
  const fenceRe = /```(?:json)?\s*\n?/i;
  const fenceHit = s.match(fenceRe);
  if (fenceHit && fenceHit.index != null) {
    s = s.slice(fenceHit.index + fenceHit[0].length);
    const close = s.indexOf('```');
    if (close !== -1) {
      s = s.slice(0, close).trim();
    }
  } else {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  }

  // Outermost { ... } (handles trailing prose after valid JSON)
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    s = s.slice(first, last + 1);
  }
  return s.trim();
}

function tryParseJsonObject(str) {
  try {
    const raw = extractJSON(String(str || ''));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

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

const WORKOUT_PLAN_BUILDER_SECTIONS = [
  { sectionLabel: 'Profile', keys: ['personalInfo', 'fitnessLevel', 'goal'] },
  {
    sectionLabel: 'Training Setup',
    keys: ['equipment', 'frequency', 'trainingEnvironment', 'preferredWorkoutTime', 'exercisesDislike'],
  },
  {
    sectionLabel: 'Recovery & Extras',
    keys: [
      'injuries',
      'supplementsCurrentlyTaking',
      'currentStressLevel',
      'sleepQuality',
      'energyLevels',
      'hydrationHabits',
      'situationDescription',
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// NEW UI (Lovable hero + pills) — UI ONLY, same editing/generation logic
// Uses the existing builder field keys so functionality stays identical.
// ─────────────────────────────────────────────────────────────────────────────

/** Profile pill card rims — dark pink → dark orange (design-system warm CTA) */
const LOVABLE_ACCENTS = [
  { key: 'warm-a', gradient: ['#BE185D', '#C2410C'], text: '#BE185D' },
  { key: 'warm-b', gradient: ['#C2410C', '#BE185D'], text: '#C2410C' },
  { key: 'warm-c', gradient: ['#BE185D', '#9A3412'], text: '#BE185D' },
  { key: 'warm-d', gradient: ['#9A3412', '#C2410C'], text: '#C2410C' },
];

const LOVABLE_PILLS = [
  { key: 'personalInfo', label: 'Personal', helper: 'age/height/weight', icon: 'person-outline' },
  { key: 'fitnessLevel', label: 'Level', helper: 'training status', icon: 'flame-outline' },
  { key: 'goal', label: 'Goal', helper: 'primary goal', icon: 'trophy-outline' },
  { key: 'equipment', label: 'Equipment', helper: 'available tools', icon: 'barbell-outline' },
  { key: 'frequency', label: 'Frequency', helper: 'weekly sessions', icon: 'calendar-outline' },
  { key: 'trainingEnvironment', label: 'Environment', helper: 'training place', icon: 'navigate-outline' },
  { key: 'preferredWorkoutTime', label: 'Workout time', helper: 'preferred time', icon: 'time-outline' },
  { key: 'exercisesDislike', label: 'Prefer', helper: 'exercise preferences', icon: 'heart-outline' },
  { key: 'injuries', label: 'Injuries', helper: 'limitations', icon: 'heart-outline' },
  { key: 'supplementsCurrentlyTaking', label: 'Supplements', helper: 'currently taking', icon: 'star-outline' },
  { key: 'currentStressLevel', label: 'Stress', helper: 'current level', icon: 'water-outline' },
  { key: 'sleepQuality', label: 'Sleep', helper: 'sleep quality', icon: 'moon-outline' },
  { key: 'energyLevels', label: 'Energy', helper: 'daily energy', icon: 'battery-charging-outline' },
  { key: 'hydrationHabits', label: 'Hydration', helper: 'water habits', icon: 'water-outline' },
  { key: 'situationDescription', label: 'My journey', helper: 'tap to expand', icon: 'document-text-outline', wide: true },
];

const WORKOUT_BUILDER_ROW_META = {
  personalInfo: {
    label: 'Personal Info',
    placeholder: 'Add your name, age, height, weight',
    multiline: false,
    icon: 'person-outline',
    iconLib: 'ion',
    color: PLAN_BUILDER_COLORS.pink,
  },
  fitnessLevel: {
    label: 'Fitness Level',
    placeholder: 'Select your fitness level',
    multiline: false,
    icon: 'dumbbell',
    iconLib: 'mci',
    color: PLAN_BUILDER_COLORS.purple,
  },
  goal: {
    label: 'Goal',
    placeholder: 'Set your primary goal',
    multiline: false,
    icon: 'trophy-outline',
    iconLib: 'ion',
    color: PLAN_BUILDER_COLORS.orange,
  },
  equipment: {
    label: 'Available Equipment',
    placeholder: 'List your equipment',
    multiline: false,
    icon: 'cube-outline',
    iconLib: 'ion',
    color: PLAN_BUILDER_COLORS.cyan,
  },
  frequency: {
    label: 'Frequency',
    placeholder: 'How many days per week',
    multiline: false,
    icon: 'calendar-outline',
    iconLib: 'ion',
    color: PLAN_BUILDER_COLORS.purple,
  },
  trainingEnvironment: {
    label: 'Environment',
    placeholder: 'Where do you train',
    multiline: false,
    icon: 'leaf-outline',
    iconLib: 'ion',
    color: PLAN_BUILDER_COLORS.green,
  },
  preferredWorkoutTime: {
    label: 'Workout Time',
    placeholder: 'Preferred session length',
    multiline: false,
    icon: 'time-outline',
    iconLib: 'ion',
    color: PLAN_BUILDER_COLORS.orange,
  },
  exercisesDislike: {
    label: 'Exercises Preferred',
    placeholder: 'Exercises you would prefer',
    multiline: false,
    icon: 'close-circle-outline',
    iconLib: 'ion',
    color: PLAN_BUILDER_COLORS.pink,
  },
  injuries: {
    label: 'Any Injuries',
    placeholder: 'Note past or current injuries',
    multiline: false,
    icon: 'bandage-outline',
    iconLib: 'ion',
    color: PLAN_BUILDER_COLORS.green,
  },
  supplementsCurrentlyTaking: {
    label: 'Supplements',
    placeholder: 'What you currently take',
    multiline: false,
    icon: 'medical-bag',
    iconLib: 'mci',
    color: PLAN_BUILDER_COLORS.green,
  },
  currentStressLevel: {
    label: 'Stress Level',
    placeholder: 'Rate your typical stress',
    multiline: false,
    icon: 'pulse-outline',
    iconLib: 'ion',
    color: PLAN_BUILDER_COLORS.purple,
  },
  sleepQuality: {
    label: 'Sleep',
    placeholder: 'Average hours per night',
    multiline: false,
    icon: 'moon-outline',
    iconLib: 'ion',
    color: PLAN_BUILDER_COLORS.cyan,
  },
  energyLevels: {
    label: 'Energy',
    placeholder: 'Describe your energy levels',
    multiline: false,
    icon: 'battery-charging',
    iconLib: 'mci',
    color: PLAN_BUILDER_COLORS.orange,
  },
  hydrationHabits: {
    label: 'Hydration',
    placeholder: 'Daily water intake',
    multiline: false,
    icon: 'water-outline',
    iconLib: 'ion',
    color: PLAN_BUILDER_COLORS.cyan,
  },
  situationDescription: {
    label: 'My Journey',
    placeholder: 'Share your story so your coach can tailor your plan',
    multiline: true,
    icon: 'book-outline',
    iconLib: 'ion',
    color: PLAN_BUILDER_COLORS.orange,
  },
};

function getWorkoutBuilderFieldRawDisplay(key, onboardingData) {
  if (!onboardingData) return '';
  switch (key) {
    case 'personalInfo':
      return `${onboardingData.gender || 'N/A'}, ${onboardingData.age || 'N/A'}yrs, ${onboardingData.weight || 'N/A'}lbs, ${onboardingData.height?.feet || 0}'${onboardingData.height?.inches || 0}"`;
    case 'fitnessLevel':
      return onboardingData.fitnessLevel
        ? onboardingData.fitnessLevel.charAt(0).toUpperCase() + onboardingData.fitnessLevel.slice(1)
        : 'Not set';
    case 'goal':
      return onboardingData.primaryGoal
        ? onboardingData.primaryGoal.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
        : 'Not set';
    case 'equipment':
      return onboardingData.equipmentAccess?.join(', ') || 'None selected';
    case 'frequency':
      return `${onboardingData.daysPerWeek || 0} days per week`;
    case 'injuries':
      return onboardingData.injuries || 'None reported';
    case 'trainingEnvironment':
      return onboardingData.trainingEnvironment
        ? onboardingData.trainingEnvironment.charAt(0).toUpperCase() + onboardingData.trainingEnvironment.slice(1)
        : 'Not set';
    case 'preferredWorkoutTime':
      return onboardingData.preferredWorkoutTime
        ? onboardingData.preferredWorkoutTime.charAt(0).toUpperCase() + onboardingData.preferredWorkoutTime.slice(1)
        : 'Not set';
    case 'exercisesDislike':
      return onboardingData.exercisesDislike || 'None';
    case 'supplementsCurrentlyTaking':
      return onboardingData.supplementsCurrentlyTaking || 'None';
    case 'currentStressLevel':
      return onboardingData.currentStressLevel
        ? onboardingData.currentStressLevel.charAt(0).toUpperCase() + onboardingData.currentStressLevel.slice(1)
        : 'Not set';
    case 'sleepQuality':
      return onboardingData.sleepQuality
        ? onboardingData.sleepQuality.charAt(0).toUpperCase() + onboardingData.sleepQuality.slice(1)
        : 'Not set';
    case 'energyLevels':
      return onboardingData.energyLevels
        ? onboardingData.energyLevels.charAt(0).toUpperCase() + onboardingData.energyLevels.slice(1)
        : 'Not set';
    case 'hydrationHabits':
      if (onboardingData.hydrationHabits === 'less_than_4') return 'Less than 4 cups/day';
      if (onboardingData.hydrationHabits === '4_8') return '4–8 cups/day';
      if (onboardingData.hydrationHabits === 'more_than_8') return 'More than 8 cups/day';
      return 'Not set';
    case 'situationDescription':
      return onboardingData.situationDescription || 'Not provided';
    default:
      return '';
  }
}

const planBuilderRefStyles = StyleSheet.create({
  borderCardContainer: {
    overflow: 'hidden',
  },
  borderGradient: {
    justifyContent: 'center',
  },
  cardInner: {
    overflow: 'hidden',
  },
  rowContainer: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  iconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingLeft: 4,
  },
  themeToggleContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    alignItems: 'flex-end',
  },
  themeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  themeToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  heroCardContainer: {
    paddingHorizontal: 16,
    marginBottom: 28,
  },
  heroInner: {
    minHeight: 276,
    height: 276,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    gap: 4,
  },
  herLottie: {
    width: 124,
    height: 124,
  },
  heroText: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  sectionContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  viewPlanContainer: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  viewPlanButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  viewPlanText: {
    fontSize: 13,
    fontWeight: '600',
  },
  /** Pinned over ScrollView bottom (absolute inside flex:1 wrapper). */
  bottomButtonContainer: {
    paddingTop: 12,
    paddingHorizontal: 16,
    flexShrink: 0,
  },
  bottomText: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 8,
  },
  generateButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  generateButtonInner: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

function PlanBuilderAnimatedBorderCard({
  children,
  radius = 18,
  duration = 4,
  cardBg,
  padding = 0,
  borderColors = ['#BE185D', '#C2410C', '#BE185D', '#C2410C', '#BE185D'],
}) {
  const rotateAnim = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: duration * 1000,
        useNativeDriver: false,
      }),
    ).start();
  }, [duration, rotateAnim]);

  return (
    <View style={[planBuilderRefStyles.borderCardContainer, { borderRadius: radius }]}>
      <LinearGradient
        colors={borderColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          planBuilderRefStyles.borderGradient,
          {
            borderRadius: radius,
            padding: 2,
          },
        ]}
      >
        <View
          style={[
            planBuilderRefStyles.cardInner,
            {
              borderRadius: radius - 2,
              backgroundColor: cardBg,
              padding: padding || 0,
            },
          ]}
        >
          {children}
        </View>
      </LinearGradient>
    </View>
  );
}

function PlanBuilderRow({
  icon,
  label,
  value,
  placeholder,
  textColor,
  mutedColor,
  dividerColor,
  isLast = false,
  multiline = false,
}) {
  const isEmpty = !value || String(value).trim() === '';

  return (
    <View
      style={[
        planBuilderRefStyles.rowContainer,
        {
          borderBottomWidth: isLast ? 0 : 1,
          borderBottomColor: dividerColor,
          alignItems: multiline ? 'flex-start' : 'center',
        },
      ]}
    >
      <View style={[planBuilderRefStyles.iconContainer, { opacity: isEmpty ? 0.55 : 1 }]}>{icon}</View>
      <View style={planBuilderRefStyles.rowContent}>
        <Text
          style={[
            planBuilderRefStyles.rowLabel,
            {
              color: mutedColor,
            },
          ]}
        >
          {label}
        </Text>
        <Text
          style={[
            planBuilderRefStyles.rowValue,
            {
              color: isEmpty ? mutedColor : textColor,
              fontStyle: isEmpty ? 'italic' : 'normal',
            },
          ]}
          numberOfLines={multiline ? 0 : 1}
        >
          {isEmpty ? placeholder : value}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={16} color={mutedColor} />
    </View>
  );
}

function PlanBuilderSectionLabel({ children, color }) {
  return (
    <Text
      style={[
        planBuilderRefStyles.sectionLabel,
        {
          color,
        },
      ]}
    >
      {children}
    </Text>
  );
}

/** Ensure markdown headings (## or #) start on a new line so they render as headings, not raw text. */
function normalizePlanMarkdown(text) {
  if (!text || typeof text !== 'string') return '';
  let out = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  out = out.replace(/([^\n])\s*(#{1,6}\s)/g, '$1\n\n$2');
  return out;
}

const WP = {
  sectionLabel: '#FF6B9D',
  exerciseName: '#FFFFFF',
  setsReps: '#64D2FF',
  startWeight: '#F97316',
  formCueLabel: 'rgba(255,255,255,0.4)',
  formCueText: 'rgba(255,255,255,0.75)',
  dayTitle: '#FFFFFF',
  dayMeta: 'rgba(255,255,255,0.5)',
  duration: 'rgba(255,255,255,0.4)',
  restDay: 'rgba(255,255,255,0.35)',
  cardBg: 'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(255,255,255,0.08)',
};

const TYPE_COLORS = { Push: WP.sectionLabel, Pull: '#06B6D4', Legs: WP.startWeight, 'Full Body': '#10B981', Rest: '#555' };

function inferType(label) {
  const lower = (label || '').toLowerCase();
  if (/push/.test(lower)) return 'Push';
  if (/pull/.test(lower)) return 'Pull';
  if (/legs?|lower/.test(lower)) return 'Legs';
  if (/full\s*body|upper\s*lower/.test(lower)) return 'Full Body';
  return 'Full Body';
}

/**
 * Claude often returns alternate keys (planOverview, workouts[], weeklySchedule object).
 * Viewer expects overview string, weeklySchedule: {day,focus}[], days: day cards.
 */
function normalizeStructuredPlanForViewer(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = { ...raw };

  if (!out.overview && out.planOverview != null) {
    const po = out.planOverview;
    if (typeof po === 'string') out.overview = po;
    else if (typeof po === 'object') {
      const parts = [po.title, po.description, po.note].filter((p) => p != null && String(p).trim() !== '');
      out.overview = parts.map((p) => String(p).trim()).join('\n\n');
    }
  }
  if (!out.overview && out.generalNotes) out.overview = String(out.generalNotes);
  if (!out.overview && out.summary) out.overview = String(out.summary);

  if (out.weeklySchedule != null && !Array.isArray(out.weeklySchedule)) {
    const ws = out.weeklySchedule;
    const rows = [];
    const train = ws.trainingDays || ws.training_days || [];
    const rest = ws.restDays || ws.rest_days || [];
    if (Array.isArray(train)) {
      train.forEach((d) => rows.push({ day: String(d).trim(), focus: 'Training' }));
    }
    if (Array.isArray(rest)) {
      rest.forEach((d) => rows.push({ day: String(d).trim(), focus: 'Rest' }));
    }
    if (rows.length) {
      out.weeklySchedule = rows;
    } else if (ws.activeRecovery != null && String(ws.activeRecovery).trim()) {
      out.weeklySchedule = [{ day: 'Recovery', focus: String(ws.activeRecovery).trim() }];
    } else {
      out.weeklySchedule = [];
    }
  }

  // Map Claude workout sessions into viewer "days".
  // Claude sometimes uses `workouts`, sometimes nests under `detailedWorkouts`,
  // and sometimes `detailedWorkouts` is an object map like { day1Monday: {...}, ... }.
  const workoutsArr = (() => {
    if (Array.isArray(out.workouts) && out.workouts.length) return out.workouts;

    if (out.detailedWorkouts) {
      // detailedWorkouts could itself be an array or an object containing workouts arrays
      if (Array.isArray(out.detailedWorkouts) && out.detailedWorkouts.length) return out.detailedWorkouts;

      // detailedWorkouts might be the object map we see in the screenshot.
      // If we can derive days from it, do that directly.
      if (out.days == null && typeof out.detailedWorkouts === 'object' && !Array.isArray(out.detailedWorkouts)) {
        const derivedDays = normalizeClaudeDetailedWorkoutsToDays(out.detailedWorkouts);
        if (derivedDays && derivedDays.length) {
          out.days = derivedDays;
          return null;
        }
      }

      const nested =
        out.detailedWorkouts?.workouts ||
        out.detailedWorkouts?.sessions ||
        out.detailedWorkouts?.days ||
        out.detailedWorkouts?.workoutDays;
      if (Array.isArray(nested) && nested.length) return nested;
    }

    // Last resort: if `workouts` is an object, scan for the first array of items
    if (out.workouts && typeof out.workouts === 'object' && !Array.isArray(out.workouts)) {
      const keys = Object.keys(out.workouts);
      for (const k of keys) {
        const v = out.workouts[k];
        if (Array.isArray(v) && v.length) return v;
      }
    }

    return null;
  })();

  if ((!out.days || !out.days.length) && Array.isArray(workoutsArr) && workoutsArr.length) {
    out.days = workoutsArr.map((w, i) => normalizeAiWorkoutToDay(w, i));
  }

  return out;
}

function normalizeAiWorkoutToDay(w, index) {
  const label = String(w.label || w.day || w.title || `Day ${index + 1}`).trim();
  const focus = String(w.focus || w.sessionFocus || w.session_type || '').trim();
  const hasExercises = Array.isArray(w.exercises) && w.exercises.length > 0;
  const restish = w.isRest === true || (/\brest\b/i.test(focus) && !hasExercises) || /\brest\s*day\b/i.test(label);

  if (restish) {
    return {
      label,
      type: 'Rest',
      isRest: true,
      restGuidance: w.restGuidance || w.notes || w.guidance || focus || '',
    };
  }

  const type = inferType(focus || label);
  const warmUp = normalizeAiWarmUpBlock(w.warmUp || w.warmup || w.warm_up);
  const exercises = normalizeAiExerciseList(w.exercises || w.mainExercises || w.main_exercises || w.movements || []);

  const rawMuscles = w.primaryMuscles || w.muscles || w.muscleGroups;
  let primaryMuscles = [];
  if (Array.isArray(rawMuscles)) primaryMuscles = rawMuscles.map((x) => String(x));
  else if (typeof rawMuscles === 'string') {
    primaryMuscles = rawMuscles.split(/[,·/]/).map((s) => s.trim()).filter(Boolean);
  }

  return {
    label: label || `Session ${index + 1}`,
    type,
    isRest: false,
    primaryMuscles,
    estimatedTime: w.estimatedTime || w.duration || w.sessionTime || w.timeEstimate,
    warmUp,
    exercises,
    coolDown: w.coolDown || w.cooldown,
  };
}

function normalizeAiWarmUpBlock(wu) {
  if (wu == null) return [];
  if (typeof wu === 'string') {
    const t = wu.trim();
    return t ? [{ name: t, duration: '', description: '' }] : [];
  }
  if (!Array.isArray(wu)) return [];
  return wu.map((item) => {
    if (typeof item === 'string') return { name: item, duration: '', description: '' };
    return {
      name: String(item.name || item.exercise || item.label || '').trim(),
      duration: String(item.duration || item.time || '').trim(),
      description: String(item.description || item.notes || '').trim(),
    };
  });
}

function normalizeAiExerciseList(list) {
  if (!Array.isArray(list)) return [];
  return list.map((ex) => {
    if (typeof ex === 'string') {
      return { name: ex.trim(), sets: '', reps: '', rest: '', formCues: [] };
    }
    const sets = ex.sets != null ? String(ex.sets) : ex.setCount != null ? String(ex.setCount) : '';
    const reps = ex.reps != null ? String(ex.reps) : ex.repRange != null ? String(ex.repRange) : '';
    const rest = ex.rest != null ? String(ex.rest) : ex.restPeriod != null ? String(ex.restPeriod) : '';
    let formCues = ex.formCues || ex.cues || ex.form_cues;
    if (typeof formCues === 'string') formCues = formCues ? [formCues] : [];
    if (!Array.isArray(formCues)) formCues = [];
    return {
      name: String(ex.name || ex.exercise || ex.exerciseName || '').trim(),
      sets,
      reps,
      rest,
      startingWeight: ex.startingWeight != null ? String(ex.startingWeight) : ex.weight != null ? String(ex.weight) : undefined,
      formCues: formCues.map((c) => String(c)),
    };
  });
}

function parseSetsReps(setsRepsRaw) {
  if (setsRepsRaw == null) return { sets: '', reps: '' };
  const s = String(setsRepsRaw).trim();
  // Examples: "4 x 8-10", "4 x 8–10", "3x5"
  const m = s.match(/(\d+)\s*[xX]\s*([\d]+(?:\s*[-–]\s*[\d]+)?)/);
  if (m) return { sets: m[1], reps: m[2].replace(/\s+/g, '') };
  return { sets: '', reps: s };
}

function normalizeClaudeWarmupExercises(exercisesRaw) {
  // Viewer expects: [{ name, duration, description }]
  if (!Array.isArray(exercisesRaw)) return [];
  return exercisesRaw
    .map((x) => {
      if (x == null) return null;
      if (typeof x === 'string') {
        const t = x.trim();
        if (!t) return null;
        const parts = t.split(':');
        if (parts.length >= 2) {
          return { name: parts[0].trim(), duration: '', description: parts.slice(1).join(':').trim() };
        }
        return { name: t, duration: '', description: '' };
      }
      const name = String(x?.exerciseName || x?.name || x?.label || '').trim();
      if (!name) return null;
      return {
        name,
        duration: String(x?.duration || x?.time || ''),
        description: String(x?.notes || x?.description || ''),
      };
    })
    .filter(Boolean);
}

function normalizeClaudeMainWorkouts(mainWorkoutsRaw) {
  // Viewer expects: [{ name, sets, reps, rest, formCues }]
  if (!Array.isArray(mainWorkoutsRaw)) return [];
  return mainWorkoutsRaw
    .map((ex) => {
      if (!ex || typeof ex !== 'object') return null;
      const name = String(ex.exerciseName || ex.name || ex.exercise || ex.title || '').trim();
      if (!name) return null;

      const { sets, reps } = parseSetsReps(ex.setsReps || ex.sets_reps || ex.setsRepsRange || ex.setsAndReps);
      const restSecondsRaw = ex.restSeconds ?? ex.restSecondsValue ?? ex.rest_seconds ?? ex.rest ?? '';
      const rest = String(restSecondsRaw).replace(/[^\d]/g, '') || String(restSecondsRaw).trim();

      const notes = String(ex.notes || ex.formCues || ex.cues || '').trim();
      let formCues = [];
      if (notes) {
        formCues = notes
          .split(/[,;]\s*|\.\s+/)
          .map((p) => p.trim())
          .filter((p) => p.length > 2)
          .slice(0, 6);
        if (formCues.length === 0) formCues = [notes];
      }

      return {
        name,
        sets: sets || '',
        reps: reps || '',
        rest: rest || '',
        startingWeight: ex.startingWeight != null ? String(ex.startingWeight) : undefined,
        formCues,
      };
    })
    .filter(Boolean);
}

function normalizeClaudeDetailedWorkoutsToDays(detailedWorkouts) {
  // Claude schema seen in screenshots:
  // detailedWorkouts: { "day1Monday": { focus, sessionDuration, warmUp{exercises[]}, mainWorkouts[] } }
  if (!detailedWorkouts || typeof detailedWorkouts !== 'object' || Array.isArray(detailedWorkouts)) return [];

  return Object.entries(detailedWorkouts)
    .map(([dayKey, dayObj], index) => {
      if (!dayObj || typeof dayObj !== 'object') return null;

      const labelFromKey = String(dayKey || '')
        .replace(/^day\d+/i, '')
        .replace(/^_+/, '')
        .trim();
      const label = labelFromKey || String(dayObj.day || dayObj.label || dayObj.title || `Day ${index + 1}`).trim();

      const focus = String(dayObj.focus || dayObj.sessionFocus || dayObj.session_type || '').trim();
      const isRest = dayObj.isRest === true || /rest/i.test(focus) || /rest/i.test(label);
      if (isRest) {
        return {
          label,
          type: 'Rest',
          isRest: true,
          restGuidance: String(dayObj.restGuidance || dayObj.notes || dayObj.guidance || focus || '').trim(),
        };
      }

      const warmUp = (() => {
        const warm = dayObj.warmUp || dayObj.warmup || dayObj.warmupBlock;
        if (!warm || typeof warm !== 'object') return [];
        return normalizeClaudeWarmupExercises(warm.exercises || warm.items || []);
      })();

      const exercises = normalizeClaudeMainWorkouts(
        dayObj.mainWorkouts || dayObj.mainWorkoutsList || dayObj.main_workouts || dayObj.workouts || [],
      );

      const coolDown = (() => {
        const cool = dayObj.coolDown || dayObj.cooldown || dayObj.cooldownBlock;
        if (!cool || typeof cool !== 'object') return [];
        return normalizeClaudeWarmupExercises(cool.exercises || cool.items || []);
      })();

      const type = inferType(focus || label);
      return {
        label,
        type,
        isRest: false,
        primaryMuscles: [],
        estimatedTime: dayObj.sessionDuration || dayObj.sessionTime || dayObj.duration || dayObj.timeEstimate,
        warmUp,
        exercises,
        coolDown,
      };
    })
    .filter(Boolean);
}

function derivePlanViewerDayShort(label, index, weeklySchedule) {
  const labelStr = String(label || '');
  const full = labelStr.match(
    /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i,
  );
  if (full) {
    const key = full[0].toLowerCase();
    const map = {
      monday: 'MON',
      tuesday: 'TUE',
      wednesday: 'WED',
      thursday: 'THU',
      friday: 'FRI',
      saturday: 'SAT',
      sunday: 'SUN',
    };
    return map[key] || full[0].substring(0, 3).toUpperCase();
  }
  const abbr = labelStr.match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i);
  if (abbr) return abbr[0].length === 3 ? abbr[0].toUpperCase() : abbr[0].substring(0, 3).toUpperCase();
  const ws = weeklySchedule && weeklySchedule[index];
  if (ws?.day) {
    const m = String(ws.day).match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i);
    if (m) return m[0].length === 3 ? m[0].toUpperCase() : m[0].substring(0, 3).toUpperCase();
  }
  return `D${index + 1}`;
}

function normalizeRouteWorkoutPlanItem(item, index) {
  if (!item || typeof item !== 'object') return null;
  const validShorts = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const rawShort = String(item.short || item.dayShort || '').trim();
  const day = String(item.day || item.label || item.name || `Day ${index + 1}`).trim();
  const inferredShort = derivePlanViewerDayShort(day, index, null);
  const short = validShorts.includes(rawShort) ? rawShort : inferredShort;
  const focus = String(item.focus || item.focusArea || item.sessionFocus || '').trim() || 'Training';
  const rest = !!(item.rest || item.isRest);
  const focusColor =
    item.focusColor ||
    (item.type && TYPE_COLORS[item.type]) ||
    PLAN_BUILDER_COLORS.pink;
  const rawEx = Array.isArray(item.exercises) ? item.exercises : [];
  const exercises = rawEx
    .map((ex) => {
      if (!ex || typeof ex !== 'object') return null;
      const name = String(ex.name || ex.exercise || ex.exerciseName || '').trim();
      if (!name) return null;
      const sets = ex.sets != null ? String(ex.sets) : ex.setCount != null ? String(ex.setCount) : '1';
      const reps = ex.reps != null ? String(ex.reps) : ex.repRange != null ? String(ex.repRange) : '—';
      const restEx = ex.rest != null ? String(ex.rest) : '';
      const muscle = String(ex.muscle || ex.muscleGroup || item.primaryMuscle || '').trim();
      let notes = ex.notes != null ? String(ex.notes) : '';
      if (!notes && Array.isArray(ex.formCues)) notes = ex.formCues.filter(Boolean).join('\n');
      return { name, sets, reps, rest: restEx, muscle, notes: notes || undefined };
    })
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
    recoveryActivities: Array.isArray(item.recoveryActivities) ? item.recoveryActivities : undefined,
    exercises,
    warmUp: Array.isArray(item.warmUp) ? item.warmUp : [],
    coolDown: Array.isArray(item.coolDown) ? item.coolDown : [],
  };
}

function mapStructuredDaysToPlanViewerRows(structured) {
  const days = structured?.days;
  if (!Array.isArray(days) || days.length === 0) return [];
  const ws = structured?.weeklySchedule || [];
  return days.map((day, di) => {
    const short = derivePlanViewerDayShort(day?.label, di, ws);
    const label = String(day?.label || `Day ${di + 1}`);
    const focus = day?.isRest
      ? 'Rest & Recovery'
      : [day?.type, ...(Array.isArray(day?.primaryMuscles) ? day.primaryMuscles.slice(0, 2) : [])]
          .filter(Boolean)
          .join(' · ') || String(day?.type || 'Training');
    const focusColor = day?.isRest ? undefined : TYPE_COLORS[day?.type] || PLAN_BUILDER_COLORS.pink;
    const exercises = !day?.isRest && Array.isArray(day?.exercises)
      ? day.exercises
          .map((ex) => {
            const name = String(ex?.name || '').trim();
            if (!name) return null;
            const muscle =
              (Array.isArray(day?.primaryMuscles) && day.primaryMuscles[0]) ||
              String(day?.type || '') ||
              '—';
            const notes = Array.isArray(ex?.formCues) && ex.formCues.length
              ? ex.formCues.map((c) => String(c)).join('\n')
              : undefined;
            return {
              name,
              sets: ex?.sets != null ? String(ex.sets) : '1',
              reps: ex?.reps != null ? String(ex.reps) : '—',
              rest: ex?.rest != null ? String(ex.rest) : '',
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
      recoveryActivities: Array.isArray(day?.recoveryActivities) ? day.recoveryActivities : undefined,
      exercises,
      warmUp: Array.isArray(day?.warmUp) ? day.warmUp : [],
      coolDown: Array.isArray(day?.coolDown) ? day.coolDown : [],
    };
  });
}

export {
  tryParseJsonObject,
  normalizeStructuredPlanForViewer,
  structuredPlanHasViewerContent,
  normalizeRouteWorkoutPlanItem,
  mapStructuredDaysToPlanViewerRows,
  PLAN_BUILDER_COLORS,
};
