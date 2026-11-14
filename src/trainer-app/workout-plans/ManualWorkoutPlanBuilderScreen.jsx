// Design Law manual plan builder (PNG 19–24): schedule → days → exercises → review/assign.
// Flow: edit steps → build setDetails → saveManualPlanDraft → hand plan id back to parent.
// Used by trainer Tools → Workout plans → Build custom. Persistence: manualPlanToWorkoutPlan.js.
//
// vocab: HardShadow = Design Law hard offset shadow under the plan cards
// vocab: NbNoticeSheet = Design Law notice sheet (replaces Alert.alert)
// vocab: setDetails = per-set reps/weight/rest rows saved on each exercise

import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { nb, borderRadius } from '../../look-and-feel/colorPalette';
import NbButton from '../../look-and-feel/NbButton';
import NbNoticeSheet from '../../look-and-feel/NbNoticeSheet';
import HardShadow from '../../look-and-feel/HardShadow';
import TopHeader from '../../for-both/loading-and-header/TopHeader';
import { SHELL_SAFE_AREA_EDGES, FORM_SCROLL_PROPS, useEmbeddedScrollBottomPad } from '../../navigation/bottomMenuSpacing';
import { newLocalId, saveManualPlanDraft, getManualWorkoutPlan, draftFromTrainerPlanDoc, searchExercisesForBuilder, inferExerciseEquipment } from './manualPlanToWorkoutPlan';

// ===== NAMED CONSTANTS =====

// Design Law PNG 21 — muscle segment + equipment pills on the Exercise library sheet
const LIBRARY_MUSCLE_CHIPS = ['Chest', 'Back', 'Shoulders', 'Biceps'];
const LIBRARY_EQUIPMENT_CHIPS = ['Barbell', 'Dumbbell', 'Bodyweight', 'Cable', 'Machine'];
const LIBRARY_SEARCH_LIMIT = 20;
const DEFAULT_SET_COUNT = 3;
const DEFAULT_REPS = 10;
const DEFAULT_REST_SECONDS = 120;
const SECONDS_PER_MINUTE = 60;
const REST_PRESET_ONE_MIN = 60;
const REST_PRESET_VALUES = [REST_PRESET_ONE_MIN, 90, 120, 150, 180];
const EMBEDDED_SCROLL_PAD = 32;

// ===== HELPER FUNCTIONS =====

function defaultRepsForExercise(exerciseRow) {
  if ((exerciseRow == null ? void 0 : exerciseRow.repMode) === 'fixed') {
    return exerciseRow == null ? void 0 : exerciseRow.repsSingle;
  }
  return exerciseRow == null ? void 0 : exerciseRow.repsMax;
}
function repsTextForSetRow(setRow, exerciseRow) {
  const fallbackReps = defaultRepsForExercise(exerciseRow) ?? DEFAULT_REPS;
  return String(setRow.reps ?? fallbackReps);
}

/**
 * Build one setDetails row per set count for an exercise card.
 * Reuse existing rows when the length still matches sets; otherwise start blank.
 * @param {object} exerciseRow
 * @returns {object[]}
 */
function buildSetDetailRowsForExercise(exerciseRow) {
  const setCount = Math.max(1, parseInt(String(exerciseRow == null ? void 0 : exerciseRow.sets), 10) || DEFAULT_SET_COUNT);
  const existingSetRows = exerciseRow == null ? void 0 : exerciseRow.setDetails;
  const rowCountMatchesSets = Array.isArray(existingSetRows) && existingSetRows.length === setCount;
  if (rowCountMatchesSets) {
    const reusedRows = [];
    for (let rowIndex = 0; rowIndex < existingSetRows.length; rowIndex += 1) {
      const setRow = existingSetRows[rowIndex];
      reusedRows.push({
        setNumber: rowIndex + 1,
        reps: repsTextForSetRow(setRow, exerciseRow),
        weight: String(setRow.weight ?? exerciseRow.weight ?? ''),
        restSeconds: Number(setRow.restSeconds ?? exerciseRow.restSeconds ?? DEFAULT_REST_SECONDS) || DEFAULT_REST_SECONDS
      });
    }
    return reusedRows;
  }
  const defaultReps = defaultRepsForExercise(exerciseRow);
  const blankRows = [];
  for (let setIndex = 0; setIndex < setCount; setIndex += 1) {
    blankRows.push({
      setNumber: setIndex + 1,
      reps: String(defaultReps ?? DEFAULT_REPS),
      weight: String((exerciseRow == null ? void 0 : exerciseRow.weight) ?? ''),
      restSeconds: Number((exerciseRow == null ? void 0 : exerciseRow.restSeconds) ?? DEFAULT_REST_SECONDS) || DEFAULT_REST_SECONDS
    });
  }
  return blankRows;
}

/**
 * Patch one set row on the matching exercise inside a workout day.
 * Mirrors first-row weight/rest onto the exercise card fields (same as the set editor save).
 * @param {object} dayRow
 * @param {{ targetExerciseId: string, setIndex: number, repsText: string, weightText: string, restSecondsText: string }} editFields
 * @returns {object}
 */
function patchExerciseSetOnDay(dayRow, editFields) {
  const targetExerciseId = editFields.targetExerciseId;
  const setIndex = editFields.setIndex;
  const repsText = editFields.repsText;
  const weightText = editFields.weightText;
  const restSecondsText = editFields.restSecondsText;
  const nextExercises = [];
  for (const exerciseRow of dayRow.exercises || []) {
    var _optObj, _optObj2;
    // Skip every exercise that is not the one being edited.
    if (exerciseRow.id !== targetExerciseId) {
      nextExercises.push(exerciseRow);
      continue;
    }

    // Materialize set rows, overwrite the edited index, then lift first-row fields.
    const setRows = buildSetDetailRowsForExercise(exerciseRow);
    setRows[setIndex] = {
      setNumber: setIndex + 1,
      reps: repsText,
      weight: weightText,
      restSeconds: Math.max(0, parseInt(String(restSecondsText), 10) || 0)
    };
    nextExercises.push({
      ...exerciseRow,
      setDetails: setRows,
      sets: setRows.length,
      weight: ((_optObj = setRows[0]) == null ? void 0 : _optObj.weight) || exerciseRow.weight,
      restSeconds: ((_optObj2 = setRows[0]) == null ? void 0 : _optObj2.restSeconds) ?? exerciseRow.restSeconds
    });
  }
  return {
    ...dayRow,
    exercises: nextExercises
  };
}

/**
 * Swap one day in the schedule list; leave every other day untouched.
 * @param {object[]} dayRows
 * @param {number} dayIndex
 * @param {object} nextDayRow
 * @returns {object[]}
 */
function replaceDayAtIndex(dayRows, dayIndex, nextDayRow) {
  const nextDayRows = [];
  for (let rowIndex = 0; rowIndex < dayRows.length; rowIndex += 1) {
    if (rowIndex !== dayIndex) {
      nextDayRows.push(dayRows[rowIndex]);
      continue;
    }
    nextDayRows.push(nextDayRow);
  }
  return nextDayRows;
}

// Manipulate here: plan type / duration chip lists (labels only — Firestore keys unchanged)
const PLAN_TYPES = ['Upper Body', 'Lower Body', 'Full Body', 'Push/Pull/Legs', 'Custom'];
const DURATIONS = ['1 week', '2 weeks', '4 weeks', '8 weeks', '12 weeks', 'Ongoing'];
const REST_PRESETS = REST_PRESET_VALUES;

/**
 * Design Law palette for the builder — nb tokens only (no pink/glass dual theme).
 * vocab: colors from useTheme() → remapped to the old `c.*` names so step JSX keeps compiling.
 */
function getBuilderPalette(colors) {
  return {
    // Legacy accent aliases → ink (call sites still say pink/cyan; never paint purple borders)
    pink: colors.nbInk,
    orange: colors.nbInk,
    cyan: colors.nbMuted,
    purple: colors.nbInk,
    green: colors.nbInk,
    bg: colors.nbBackground,
    surface: colors.nbSurface,
    cardBg: colors.nbSurface,
    textPrimary: colors.nbInk,
    textSecondary: colors.nbMuted,
    textTertiary: colors.nbMuted,
    border: colors.nbBorder,
    borderSubtle: colors.nbBorder,
    borderStrong: colors.nbBorder,
    stripBg: colors.nbSurface,
    stripBorder: colors.nbBorder,
    stepDotBg: colors.nbSoft,
    stepDotBorder: colors.nbBorder,
    stepConnector: colors.nbSoft,
    stepLabelDone: colors.nbMuted,
    setupFieldBg: colors.nbSurface,
    pillBg: colors.nbSurface,
    pillBorder: colors.nbBorder,
    exIconBg: colors.nbSoft,
    clientChipOffBg: colors.nbSurface,
    clientChipOffBorder: colors.nbBorder,
    modalHandle: colors.nbBorder,
    modalCloseBg: colors.nbSoft,
    divider: colors.nbBorder,
    stepActionsBorder: colors.nbBorder,
    topBarBorder: colors.nbBorder,
    secondaryBtnBg: colors.nbSurface,
    secondaryBtnBorder: colors.nbBorder,
    shadowPink: colors.nbShadow,
    suggestRowBorder: colors.nbBorder,
    stepperBg: colors.nbSoft,
    fill: colors.nbFill,
    onFill: colors.nbOnFill,
    soft: colors.nbSoft,
    shadow: colors.nbShadow
  };
}
const BuilderlightDarkMode = React.createContext(null);
function useBuilderTheme() {
  const ctx = useContext(BuilderlightDarkMode);
  if (!ctx) throw new Error('useBuilderTheme must be used within BuilderlightDarkMode.Provider');
  return ctx;
}
function SectionHeader({
  title,
  subtitle
}) {
  const {
    styles
  } = useBuilderTheme();
  return <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      {/* Design Law: solid ink underline — not a pink→cyan gradient bar */}
      <View style={styles.sectionUnderline} />
    </View>;
}

/** Progress capsules (PNG 19) — fill = done/active, soft = upcoming. */
function PlanStepStrip({
  step
}) {
  var _optObj3;
  const {
    c,
    styles
  } = useBuilderTheme();
  if (step >= 5) {
    return null;
  }
  const stepItems = [{
    stepNumber: 1,
    label: 'Setup'
  }, {
    stepNumber: 2,
    label: 'Days'
  }, {
    stepNumber: 3,
    label: 'Moves'
  }, {
    stepNumber: 4,
    label: 'Review'
  }];
  const totalSteps = stepItems.length;
  const currentStepNumber = Math.min(step, totalSteps);
  const currentStepLabel = ((_optObj3 = stepItems[currentStepNumber - 1]) == null ? void 0 : _optObj3.label) || '';
  const metaLabel = `STEP ${currentStepNumber} OF ${totalSteps} · ${currentStepLabel}`.toUpperCase();
  return <View style={styles.stepStripShell}>
      <View style={styles.stepCapsulesRow}>
        {stepItems.map(stepItem => {
        const capsuleIsFilled = step >= stepItem.stepNumber;
        const capsuleBackground = capsuleIsFilled ? c.fill : c.soft;
        return <View key={stepItem.stepNumber} style={[styles.stepCapsule, {
          flex: 1,
          backgroundColor: capsuleBackground,
          borderColor: c.border
        }]} />;
      })}
      </View>
      <Text style={[styles.stepStripMeta, {
      color: c.textTertiary
    }]}>{metaLabel}</Text>
    </View>;
}

/** Hard-shadow surface card — replaces old GradientCard pink rim. */
function DesignCard({
  children,
  style,
  innerStyle
}) {
  const {
    c,
    styles
  } = useBuilderTheme();
  return <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={style}>
      <View style={[styles.gradInner, {
      backgroundColor: c.cardBg,
      borderColor: c.border,
      borderWidth: nb.borderWidth
    }, innerStyle]}>
        {children}
      </View>
    </HardShadow>;
}

// Keep the old name so step JSX still compiles after the chrome swap.
function GradientCard({
  children,
  style,
  innerStyle
}) {
  return <DesignCard style={style} innerStyle={innerStyle}>
      {children}
    </DesignCard>;
}
function FieldLabel({
  children,
  tight
}) {
  const {
    styles
  } = useBuilderTheme();
  return <Text style={[styles.label, tight && styles.labelTight]}>{children}</Text>;
}
function FormField({
  children,
  style,
  compact
}) {
  const {
    c,
    styles
  } = useBuilderTheme();
  return <View style={[styles.formFieldShell, {
    borderColor: c.border,
    backgroundColor: c.surface,
    marginTop: 0
  }, style]}>
      <View style={[styles.fieldInner, compact && styles.fieldInnerCompact]}>{children}</View>
    </View>;
}
function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  compact
}) {
  const buttonFlex = compact ? 0 : 1;
  const buttonMinWidth = compact ? undefined : 0;
  const buttonLabel = loading ? 'Saving…' : label;
  return <View style={{
    flex: buttonFlex,
    minWidth: buttonMinWidth
  }}>
      <NbButton variant="fill" onPress={onPress} disabled={disabled || loading}>
        {buttonLabel}
      </NbButton>
    </View>;
}
function SecondaryButton({
  label,
  onPress,
  compact
}) {
  const buttonFlex = compact ? 0 : 1;
  const buttonMinWidth = compact ? 120 : 0;
  return <View style={{
    flex: buttonFlex,
    minWidth: buttonMinWidth
  }}>
      <NbButton variant="ghost" onPress={onPress}>
        {label}
      </NbButton>
    </View>;
}

/** Selected = fill+onFill; idle = surface+border (PNG day/type chips). */
function Pill({
  label,
  active,
  onPress
}) {
  const {
    c,
    styles
  } = useBuilderTheme();
  const pillBackgroundColor = active ? c.fill : c.surface;
  const pillTextColor = active ? c.onFill : c.textPrimary;
  const activeTextStyle = active ? styles.pillTextActive : null;
  return <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={[styles.pill, {
    backgroundColor: pillBackgroundColor,
    borderColor: c.border,
    borderWidth: nb.borderWidth
  }]}>
      <Text style={[styles.pillText, {
      color: pillTextColor
    }, activeTextStyle]}>{label}</Text>
    </TouchableOpacity>;
}
function EmptyExerciseState({
  onAdd
}) {
  const {
    c,
    styles
  } = useBuilderTheme();
  return <DesignCard style={{
    marginTop: 8
  }}>
      <View style={styles.emptyExWrap}>
        <View style={[styles.emptyExIcon, {
        backgroundColor: c.soft,
        borderColor: c.border
      }]}>
          <Ionicons name="barbell-outline" size={28} color={c.textPrimary} />
        </View>
        <Text style={styles.emptyExTitle}>No exercises yet</Text>
        <Text style={styles.emptyExSub}>Search the library or type a custom movement.</Text>
        <View style={{
        marginTop: 14,
        width: '100%'
      }}>
          <NbButton variant="fill" onPress={onAdd}>
            Add first exercise
          </NbButton>
        </View>
      </View>
    </DesignCard>;
}
const defaultWorkoutDays = () => [{
  id: newLocalId('day'),
  dayName: 'Monday',
  dayNumber: 1,
  exercises: []
}, {
  id: newLocalId('day'),
  dayName: 'Wednesday',
  dayNumber: 2,
  exercises: []
}, {
  id: newLocalId('day'),
  dayName: 'Friday',
  dayNumber: 3,
  exercises: []
}];
function repsRangeForFirestore(exerciseRow) {
  if (exerciseRow.repMode === 'fixed') {
    const fixedReps = Number(exerciseRow.repsSingle) || 8;
    return {
      min: fixedReps,
      max: fixedReps
    };
  }
  return {
    min: Number(exerciseRow.repsMin) || 8,
    max: Number(exerciseRow.repsMax) || 8
  };
}
function setDetailsForFirestore(exerciseRow) {
  if (!Array.isArray(exerciseRow.setDetails)) {
    return [];
  }
  const sanitizedSetRows = [];
  for (let setIndex = 0; setIndex < exerciseRow.setDetails.length; setIndex += 1) {
    const setRow = exerciseRow.setDetails[setIndex];
    sanitizedSetRows.push({
      setNumber: setIndex + 1,
      reps: String(setRow.reps ?? ''),
      weight: String(setRow.weight ?? ''),
      restSeconds: Math.max(0, parseInt(String(setRow.restSeconds), 10) || 0)
    });
  }
  return sanitizedSetRows;
}
function exercisesForFirestoreDay(dayRow) {
  const exerciseRows = dayRow.exercises || [];
  const sanitizedExercises = [];
  for (const exerciseRow of exerciseRows) {
    sanitizedExercises.push({
      exerciseId: exerciseRow.id,
      libraryExerciseId: exerciseRow.libraryExerciseId || null,
      exerciseName: String(exerciseRow.exerciseName || '').trim(),
      sets: Math.max(1, parseInt(String(exerciseRow.sets), 10) || 3),
      reps: repsRangeForFirestore(exerciseRow),
      restSeconds: Math.max(0, parseInt(String(exerciseRow.restSeconds), 10) || 90),
      notes: String(exerciseRow.notes || '').trim(),
      tempo: String(exerciseRow.tempo || '').trim(),
      weight: exerciseRow.weight != null ? String(exerciseRow.weight).trim() : '',
      progression: String(exerciseRow.progression || '').trim(),
      muscleGroups: Array.isArray(exerciseRow.muscleGroups) ? exerciseRow.muscleGroups : [],
      setDetails: setDetailsForFirestore(exerciseRow)
    });
  }
  return sanitizedExercises;
}
function sanitizeManualDraftForFirestore(state) {
  const dayRows = state.workoutDays || [];
  const workoutDays = [];
  for (let dayIndex = 0; dayIndex < dayRows.length; dayIndex += 1) {
    const dayRow = dayRows[dayIndex];
    workoutDays.push({
      dayId: dayRow.id,
      dayName: String(dayRow.dayName || `Day ${dayIndex + 1}`).trim(),
      dayNumber: dayRow.dayNumber ?? dayIndex + 1,
      exercises: exercisesForFirestoreDay(dayRow)
    });
  }
  const assignedClientIds = (state.assignedClients || []).filter(Boolean);
  const uniqueAssignedClients = [...new Set(assignedClientIds)];
  return {
    planName: String(state.planName || '').trim(),
    planType: state.planType,
    duration: state.duration,
    description: String(state.description || '').trim(),
    workoutDays,
    assignedClients: uniqueAssignedClients
  };
}
function countExercisesAcrossDays(days) {
  let total = 0;
  const dayRows = days || [];
  for (let dayIndex = 0; dayIndex < dayRows.length; dayIndex += 1) {
    var _optObj4;
    total += ((_optObj4 = dayRows[dayIndex].exercises) == null ? void 0 : _optObj4.length) || 0;
  }
  return total;
}
function headingTitleForStep(step, workoutDays, dayIndex) {
  if (step === 1) return 'Plan setup';
  if (step === 2) return 'Workout days';
  if (step === 3) {
    var _optObj5;
    const dayName = ((_optObj5 = workoutDays[dayIndex]) == null ? void 0 : _optObj5.dayName) || 'Day';
    return `${dayName} · exercises`;
  }
  if (step === 4) return 'Review & assign';
  return 'Done';
}
function headingSubtitleForStep(step, workoutDays, dayIndex) {
  if (step === 1) return 'Name your plan and set the schedule shell';
  if (step === 2) {
    const dayCount = workoutDays.length;
    const dayLabel = dayCount !== 1 ? 's' : '';
    return `${dayCount} training day${dayLabel}`;
  }
  if (step === 3) return `Day ${dayIndex + 1} of ${workoutDays.length}`;
  if (step === 4) return `${countExercisesAcrossDays(workoutDays)} exercises total`;
  return null;
}
function repSummaryForExercise(exerciseRow) {
  if (exerciseRow.repMode === 'fixed') {
    return `${exerciseRow.repsSingle} reps`;
  }
  return `${exerciseRow.repsMin}-${exerciseRow.repsMax} reps`;
}
function restSummaryForSeconds(restSeconds) {
  const seconds = Number(restSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '—';
  }
  const dividesEvenlyIntoMinutes = seconds >= SECONDS_PER_MINUTE && seconds % SECONDS_PER_MINUTE === 0;
  if (dividesEvenlyIntoMinutes) {
    return `${seconds / SECONDS_PER_MINUTE} min`;
  }
  return `${seconds}s`;
}

// ===== MAIN FUNCTION =====

/**
 * Multi-step manual workout plan builder.
 * @param {object} props
 */
export default function ManualWorkoutPlanBuilderScreen({
  trainerId,
  clients = [],
  editPlanId = null,
  defaultAssignedClientIds = [],
  onClose,
  onProfilePress,
  onSettingsPress,
  embedInLayout = false
}) {
  var _optObj7, _optObj8, _optObj9, _optObj0, _optObj1;
  const {
    colors,
    isDark
  } = useTheme();
  const insets = useSafeAreaInsets();
  // vocab: palette = remapped nb tokens under old `c.*` keys for this screen's StyleSheet
  const palette = useMemo(() => getBuilderPalette(colors), [colors]);
  const styles = useMemo(() => createBuilderStyles(palette), [palette]);
  const themeValue = useMemo(() => ({
    c: palette,
    styles
  }), [palette, styles]);
  const scrollBottomPad = useEmbeddedScrollBottomPad(EMBEDDED_SCROLL_PAD);

  // Hook order frozen: step → plan fields → days → assignment → save/load → notice → exercise modal → set editor.
  const [step, setStep] = useState(1);
  const [planName, setPlanName] = useState('');
  const [planType, setPlanType] = useState('Upper Body');
  const [duration, setDuration] = useState('4 weeks');
  const [description, setDescription] = useState('');
  const [workoutDays, setWorkoutDays] = useState(defaultWorkoutDays);
  const [dayIndex, setDayIndex] = useState(0);
  const [assignedClients, setAssignedClients] = useState(() => [...(defaultAssignedClientIds || [])]);
  const [savedPlanId, setSavedPlanId] = useState(editPlanId || null);
  const [loadingPlan, setLoadingPlan] = useState(!!editPlanId);
  const [saving, setSaving] = useState(false);
  // vocab: notice = NbNoticeSheet payload — Design Law instead of Alert.alert
  const [notice, setNotice] = useState(null);
  const showNotice = (title, message, extras = {}) => setNotice({
    title,
    message,
    ...extras
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editExerciseId, setEditExerciseId] = useState(null);
  const [searchQ, setSearchQ] = useState('');
  // vocab: libraryMuscle = single PNG 21 segment (null = all); libraryEquipments = multi-select pills
  const [libraryMuscle, setLibraryMuscle] = useState(null);
  const [libraryEquipments, setLibraryEquipments] = useState([]);
  const [pickedLibrary, setPickedLibrary] = useState(null);
  const [customName, setCustomName] = useState('');
  const [sets, setSets] = useState(3);
  const [repMode, setRepMode] = useState('range');
  const [repsMin, setRepsMin] = useState(6);
  const [repsMax, setRepsMax] = useState(8);
  const [repsSingle, setRepsSingle] = useState(10);
  const [restSeconds, setRestSeconds] = useState(120);
  const [notes, setNotes] = useState('');
  const [tempo, setTempo] = useState('');
  const [weight, setWeight] = useState('');
  const [progression, setProgression] = useState('');
  const [setEditOpen, setSetEditOpen] = useState(false);
  const [setEditExId, setSetEditExId] = useState(null);
  const [setEditIndex, setSetEditIndex] = useState(0);
  const [setEditReps, setSetEditReps] = useState('10');
  const [setEditWeight, setSetEditWeight] = useState('');
  const [setEditRest, setSetEditRest] = useState('120');
  const openSetEdit = (exerciseRow, setIndex) => {
    // 1. Materialize set rows for this exercise, then seed the edit sheet.
    const setRows = buildSetDetailRowsForExercise(exerciseRow);
    const selectedRow = setRows[setIndex] || setRows[0];
    setSetEditExId(exerciseRow.id);
    setSetEditIndex(setIndex);
    setSetEditReps(String(selectedRow.reps ?? '10'));
    setSetEditWeight(String(selectedRow.weight ?? ''));
    setSetEditRest(String(selectedRow.restSeconds ?? 120));
    setSetEditOpen(true);
  };
  const saveSetEdit = () => {
    // 1. Need a target exercise on the current day.
    if (!setEditExId) {
      return;
    }

    // 2. Patch that set row on the active day, then close the sheet.
    setWorkoutDays(dayRows => {
      const currentDay = dayRows[dayIndex];
      if (!currentDay) {
        return dayRows;
      }
      const patchedDay = patchExerciseSetOnDay(currentDay, {
        targetExerciseId: setEditExId,
        setIndex: setEditIndex,
        repsText: setEditReps,
        weightText: setEditWeight,
        restSecondsText: setEditRest
      });
      return replaceDayAtIndex(dayRows, dayIndex, patchedDay);
    });
    setSetEditOpen(false);
  };
  const searchResults = useMemo(() => searchExercisesForBuilder(searchQ, LIBRARY_SEARCH_LIMIT, {
    muscle: libraryMuscle,
    equipments: libraryEquipments
  }), [searchQ, libraryMuscle, libraryEquipments]);
  const toggleLibraryEquipment = useCallback(equipmentLabel => {
    setLibraryEquipments(selectedLabels => {
      if (selectedLabels.includes(equipmentLabel)) {
        return selectedLabels.filter(label => label !== equipmentLabel);
      }
      return [...selectedLabels, equipmentLabel];
    });
  }, []);
  useEffect(() => {
    if (!editPlanId || !trainerId) return;
    let cancelled = false;
    (async () => {
      setLoadingPlan(true);
      try {
        var _optObj6;
        const doc = await getManualWorkoutPlan(trainerId, editPlanId);
        if (cancelled || !doc) return;
        const draft = draftFromTrainerPlanDoc(doc);
        if (!draft) return;
        setPlanName(draft.planName);
        setPlanType(draft.planType || 'Custom');
        setDuration(draft.duration || '4 weeks');
        setDescription(draft.description || '');
        setWorkoutDays((draft.workoutDays && draft.workoutDays.length ? draft.workoutDays : defaultWorkoutDays()).map((x, i) => ({
          ...x,
          id: x.id || newLocalId('day'),
          dayNumber: x.dayNumber ?? i + 1,
          exercises: (x.exercises || []).map(ex => ({
            ...ex,
            id: ex.id || newLocalId('ex')
          }))
        })));
        setAssignedClients(((_optObj6 = draft.assignedClients) == null ? void 0 : _optObj6.length) ? draft.assignedClients : [...(defaultAssignedClientIds || [])]);
        setSavedPlanId(editPlanId);
      } catch (e) {
        showNotice('Could not load plan', (e == null ? void 0 : e.message) || 'Unknown error');
      } finally {
        if (!cancelled) setLoadingPlan(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editPlanId, trainerId]);
  const resetModal = () => {
    setEditExerciseId(null);
    setSearchQ('');
    setLibraryMuscle(null);
    setLibraryEquipments([]);
    setPickedLibrary(null);
    setCustomName('');
    setSets(3);
    setRepMode('range');
    setRepsMin(6);
    setRepsMax(8);
    setRepsSingle(10);
    setRestSeconds(120);
    setNotes('');
    setTempo('');
    setWeight('');
    setProgression('');
  };
  const openAddModal = () => {
    resetModal();
    setModalOpen(true);
  };
  const openEditModal = ex => {
    setEditExerciseId(ex.id);
    setSearchQ('');
    setPickedLibrary(null);
    setCustomName('');
    setSets(ex.sets);
    setRepMode(ex.repMode || 'range');
    setRepsMin(ex.repsMin ?? 6);
    setRepsMax(ex.repsMax ?? 8);
    setRepsSingle(ex.repsSingle ?? 10);
    setRestSeconds(ex.restSeconds ?? 120);
    setNotes(ex.notes || '');
    setTempo(ex.tempo || '');
    setWeight(ex.weight || '');
    setProgression(ex.progression || '');
    setModalOpen(true);
  };
  const applyExerciseToDay = exerciseObject => {
    setWorkoutDays(dayRows => {
      const nextDayRows = [];
      for (let rowIndex = 0; rowIndex < dayRows.length; rowIndex += 1) {
        const dayRow = dayRows[rowIndex];
        if (rowIndex !== dayIndex) {
          nextDayRows.push(dayRow);
          continue;
        }
        const nextExercises = [...(dayRow.exercises || [])];
        let editIndex = -1;
        if (editExerciseId) {
          editIndex = nextExercises.findIndex(exerciseRow => exerciseRow.id === editExerciseId);
        }
        if (editIndex >= 0) {
          nextExercises[editIndex] = exerciseObject;
        } else {
          nextExercises.push(exerciseObject);
        }
        nextDayRows.push({
          ...dayRow,
          exercises: nextExercises
        });
      }
      return nextDayRows;
    });
  };
  const confirmModal = () => {
    // 1. Need a library pick or a custom name.
    const exerciseName = ((pickedLibrary == null ? void 0 : pickedLibrary.name) || customName || '').trim();
    if (!exerciseName) {
      showNotice('Exercise name required', 'Pick from the library or enter a custom name.');
      return;
    }

    // 2. Build the exercise object (new id when adding).
    const exerciseId = editExerciseId || newLocalId('ex');
    const exerciseObject = {
      id: exerciseId,
      libraryExerciseId: (pickedLibrary == null ? void 0 : pickedLibrary.id) || null,
      exerciseName,
      muscleGroups: (pickedLibrary == null ? void 0 : pickedLibrary.muscleGroups) || [],
      sets,
      repMode,
      repsMin,
      repsMax,
      repsSingle,
      restSeconds,
      notes,
      tempo,
      weight,
      progression
    };
    exerciseObject.setDetails = buildSetDetailRowsForExercise(exerciseObject);

    // 3. Write onto the current day and close the sheet.
    applyExerciseToDay(exerciseObject);
    setModalOpen(false);
    resetModal();
  };
  const removeExercise = exerciseId => {
    setWorkoutDays(dayRows => {
      const nextDayRows = [];
      for (let rowIndex = 0; rowIndex < dayRows.length; rowIndex += 1) {
        const dayRow = dayRows[rowIndex];
        if (rowIndex !== dayIndex) {
          nextDayRows.push(dayRow);
          continue;
        }
        const remainingExercises = (dayRow.exercises || []).filter(exerciseRow => exerciseRow.id !== exerciseId);
        nextDayRows.push({
          ...dayRow,
          exercises: remainingExercises
        });
      }
      return nextDayRows;
    });
  };
  const moveExercise = (exerciseId, direction) => {
    setWorkoutDays(dayRows => {
      const nextDayRows = [];
      for (let rowIndex = 0; rowIndex < dayRows.length; rowIndex += 1) {
        const dayRow = dayRows[rowIndex];
        if (rowIndex !== dayIndex) {
          nextDayRows.push(dayRow);
          continue;
        }
        const exerciseList = [...(dayRow.exercises || [])];
        const fromIndex = exerciseList.findIndex(exerciseRow => exerciseRow.id === exerciseId);
        const toIndex = fromIndex + direction;
        const moveIsInvalid = fromIndex < 0 || toIndex < 0 || toIndex >= exerciseList.length;
        if (moveIsInvalid) {
          nextDayRows.push(dayRow);
          continue;
        }
        const movingExercise = exerciseList[fromIndex];
        exerciseList[fromIndex] = exerciseList[toIndex];
        exerciseList[toIndex] = movingExercise;
        nextDayRows.push({
          ...dayRow,
          exercises: exerciseList
        });
      }
      return nextDayRows;
    });
  };
  const addDay = () => {
    setWorkoutDays(dayRows => [...dayRows, {
      id: newLocalId('day'),
      dayName: `Day ${dayRows.length + 1}`,
      dayNumber: dayRows.length + 1,
      exercises: []
    }]);
  };
  const removeDay = dayId => {
    setWorkoutDays(dayRows => {
      const remainingDays = dayRows.filter(dayRow => dayRow.id !== dayId);
      let nextRows = remainingDays;
      if (!remainingDays.length) {
        nextRows = defaultWorkoutDays();
      } else {
        nextRows = remainingDays.map((dayRow, dayIndex) => ({
          ...dayRow,
          dayNumber: dayIndex + 1
        }));
      }
      setDayIndex(currentDayIndex => Math.min(currentDayIndex, Math.max(0, nextRows.length - 1)));
      return nextRows;
    });
  };
  const copyFromFirstDay = () => {
    // 1. Need a first day to clone from.
    if (!workoutDays[0]) {
      return;
    }

    // 2. Fresh exercise ids onto the current day, then haptic success.
    const clonedExercises = (workoutDays[0].exercises || []).map(exerciseRow => ({
      ...exerciseRow,
      id: newLocalId('ex')
    }));
    setWorkoutDays(dayRows => {
      const nextDayRows = [];
      for (let rowIndex = 0; rowIndex < dayRows.length; rowIndex += 1) {
        const dayRow = dayRows[rowIndex];
        if (rowIndex === dayIndex) {
          nextDayRows.push({
            ...dayRow,
            exercises: clonedExercises
          });
          continue;
        }
        nextDayRows.push(dayRow);
      }
      return nextDayRows;
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };
  const toggleClient = clientId => {
    setAssignedClients(selectedClientIds => {
      if (selectedClientIds.includes(clientId)) {
        return selectedClientIds.filter(selectedId => selectedId !== clientId);
      }
      return [...selectedClientIds, clientId];
    });
  };
  const validateStep1 = () => {
    if (!planName.trim()) {
      showNotice('Plan name', 'Please enter a plan name.');
      return false;
    }
    return true;
  };
  const goNext = () => {
    // 1. Step 1 needs a plan name.
    if (step === 1 && !validateStep1()) {
      return;
    }

    // 2. Step 2 needs at least one day.
    if (step === 2 && !workoutDays.length) {
      showNotice('Add days', 'Add at least one workout day.');
      return;
    }

    // 3. Step 3 walks day-by-day, then jumps to review.
    if (step === 3) {
      if (dayIndex < workoutDays.length - 1) {
        setDayIndex(dayIndex + 1);
        return;
      }
      setStep(4);
      return;
    }

    // 4. Otherwise advance one step.
    setStep(currentStep => currentStep + 1);
  };
  const goBack = () => {
    // 1. On exercises, back through prior days first.
    if (step === 3 && dayIndex > 0) {
      setDayIndex(dayIndex - 1);
      return;
    }

    // 2. Leaving step 1 closes the builder.
    if (step <= 1) {
      onClose == null ? void 0 : onClose();
      return;
    }

    // 3. Review returns to the last exercise day.
    if (step === 4) {
      setStep(3);
      setDayIndex(Math.max(0, workoutDays.length - 1));
      return;
    }

    // 4. Otherwise step back one.
    setStep(currentStep => Math.max(1, currentStep - 1));
  };
  const persist = useCallback(async doAssign => {
    // 1. Shape draft for Firestore; assignment list only when the trainer tapped Save & assign.
    const draft = sanitizeManualDraftForFirestore({
      planName,
      planType,
      duration,
      description,
      workoutDays,
      assignedClients: doAssign ? assignedClients : []
    });
    const exerciseCount = countExercisesAcrossDays(draft.workoutDays);
    if (exerciseCount < 1) {
      showNotice('Add exercises', 'Add at least one exercise before saving.');
      return;
    }
    if (!trainerId) {
      showNotice('Not signed in', 'Trainer ID missing.');
      return;
    }

    // 2. Write trainer_workout_plans and mirror client copies when assigned.
    setSaving(true);
    try {
      const saveResult = await saveManualPlanDraft(trainerId, draft, savedPlanId);
      if (!saveResult.success) {
        showNotice('Save failed', saveResult.error || 'Unknown error');
        return;
      }
      setSavedPlanId(saveResult.planId);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const assignedSomeone = doAssign && assignedClients.length > 0;
      const savedMessage = assignedSomeone ? 'Plan saved and assigned to selected clients.' : 'Plan saved.';
      showNotice('Saved', savedMessage);
      setStep(5);
    } catch (saveError) {
      showNotice('Save failed', (saveError == null ? void 0 : saveError.message) || 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [planName, planType, duration, description, workoutDays, assignedClients, trainerId, savedPlanId]);
  const renderCoachHeader = () => embedInLayout ? null : <TopHeader title="" isDark={isDark} skipTopSafeInset onBack={goBack} onProfilePress={onProfilePress} onSettingsPress={onSettingsPress} />;
  if (loadingPlan) {
    return <BuilderlightDarkMode.Provider value={themeValue}>
        <SafeAreaView style={[styles.safe, {
        backgroundColor: palette.bg
      }]}>
          {renderCoachHeader()}
          <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center'
        }}>
            <ActivityIndicator size="large" color={palette.pink} />
            <Text style={{
            color: palette.textSecondary,
            marginTop: 12
          }}>Loading plan…</Text>
          </View>
        </SafeAreaView>
      </BuilderlightDarkMode.Provider>;
  }
  const stepTitle = headingTitleForStep(step, workoutDays, dayIndex);
  const stepSubtitle = headingSubtitleForStep(step, workoutDays, dayIndex);
  const renderStepActions = () => {
    if (step === 5) {
      return <View style={[styles.stepActionsWrap, {
        marginBottom: scrollBottomPad
      }]}>
          <PrimaryButton label="Done" onPress={() => onClose == null ? void 0 : onClose()} />
        </View>;
    }
    if (step === 1) {
      return <View style={[styles.stepActionsWrap, styles.stepActionsTight, {
        marginBottom: scrollBottomPad
      }]}>
          <PrimaryButton label="Add exercises" onPress={goNext} />
        </View>;
    }
    if (step === 2) {
      return <View style={[styles.stepActionsWrap, {
        marginBottom: scrollBottomPad
      }]}>
          <View style={styles.footerRow}>
            <SecondaryButton label="Back" onPress={goBack} compact />
            <PrimaryButton label="Add exercises" onPress={goNext} />
          </View>
        </View>;
    }
    if (step === 3) {
      const moreDaysRemain = dayIndex < workoutDays.length - 1;
      const stepThreePrimaryLabel = moreDaysRemain ? 'Next day' : 'Review';
      return <View style={[styles.stepActionsWrap, {
        marginBottom: scrollBottomPad
      }]}>
          <View style={styles.footerRow}>
            <SecondaryButton label="Back" onPress={goBack} compact />
            <PrimaryButton label={stepThreePrimaryLabel} onPress={goNext} />
          </View>
        </View>;
    }
    if (step === 4) {
      return <View style={[styles.stepActionsWrap, {
        marginBottom: scrollBottomPad
      }]}>
          <View style={styles.footerCol}>
            <PrimaryButton label="Save & assign" loading={saving} onPress={() => persist(true)} />
            <SecondaryButton label="Save for later" onPress={() => persist(false)} />
          </View>
        </View>;
    }
    return null;
  };
  return <BuilderlightDarkMode.Provider value={themeValue}>
    <SafeAreaView style={[styles.safe, {
      backgroundColor: palette.bg
    }]} edges={SHELL_SAFE_AREA_EDGES}>
      <KeyboardAvoidingView style={{
        flex: 1
      }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={80}>
        {renderCoachHeader()}
        <View style={[styles.stepHeading, {
          borderBottomColor: palette.topBarBorder
        }]}>
          <Text style={styles.topTitle} numberOfLines={1}>
            {step === 1 ? 'Build a plan' : stepTitle}
          </Text>
          {stepSubtitle && step < 5 ? <Text style={styles.topSubtitle} numberOfLines={1}>
              {stepSubtitle}
            </Text> : null}
        </View>
        {step < 5 ? <PlanStepStrip step={step} /> : null}

        <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollPad, {
          paddingBottom: scrollBottomPad
        }]} {...FORM_SCROLL_PROPS}>
          {step === 1 && <>
              <SectionHeader title="Plan details" subtitle="Name your plan and set the schedule shell" />
              <GradientCard style={styles.setupHeroCard} innerStyle={styles.setupHeroInner}>
                <FieldLabel tight>Plan name *</FieldLabel>
                <View style={styles.setupField}>
                  <TextInput style={styles.setupInput} placeholder="e.g. Upper Body Strength · Week 1" placeholderTextColor={palette.textTertiary} value={planName} onChangeText={setPlanName} />
                </View>
                <FieldLabel tight>Plan type *</FieldLabel>
                <View style={styles.pillGrid}>
                  {PLAN_TYPES.map(planTypeLabel => <Pill key={planTypeLabel} label={planTypeLabel} active={planType === planTypeLabel} onPress={() => setPlanType(planTypeLabel)} />)}
                </View>
                <FieldLabel tight>Duration *</FieldLabel>
                <View style={styles.pillGrid}>
                  {DURATIONS.map(durationLabel => <Pill key={durationLabel} label={durationLabel} active={duration === durationLabel} onPress={() => setDuration(durationLabel)} />)}
                </View>
                <FieldLabel tight>Description (optional)</FieldLabel>
                <View style={[styles.setupField, styles.setupFieldMulti]}>
                  <TextInput style={[styles.setupInput, styles.setupInputMulti]} placeholder="Focus, equipment, coaching intent…" placeholderTextColor={palette.textTertiary} value={description} onChangeText={setDescription} multiline />
                </View>
              </GradientCard>
            </>}

          {step === 2 && <>
              <SectionHeader title="Your workout schedule" subtitle="Rename days or add more before adding exercises" />
              {workoutDays.map(dayRow => {
              const exerciseCount = (dayRow.exercises || []).length;
              const exerciseWord = exerciseCount !== 1 ? 's' : '';
              return <GradientCard key={dayRow.id} style={{
                marginBottom: 12
              }}>
                    <View style={styles.dayCardRow}>
                      <View style={[styles.dayNumBadge, {
                    backgroundColor: palette.fill,
                    borderColor: palette.border,
                    borderWidth: nb.borderWidth
                  }]}>
                        <Text style={[styles.dayNumText, {
                      color: palette.onFill
                    }]}>
                          {dayRow.dayNumber}
                        </Text>
                      </View>
                      <View style={{
                    flex: 1,
                    minWidth: 0
                  }}>
                        <TextInput style={styles.dayNameInput} value={dayRow.dayName} onChangeText={typedDayName => setWorkoutDays(rows => rows.map(row => row.id === dayRow.id ? {
                      ...row,
                      dayName: typedDayName
                    } : row))} placeholder="Day name" placeholderTextColor={palette.textTertiary} />
                      </View>
                      <TouchableOpacity onPress={() => removeDay(dayRow.id)} hitSlop={10} style={[styles.dayRemove, {
                    backgroundColor: palette.soft,
                    borderColor: palette.border
                  }]}>
                        <Ionicons name="trash-outline" size={20} color={palette.textPrimary} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.dayMetaRow}>
                      <Ionicons name="barbell-outline" size={14} color={palette.textSecondary} />
                      <Text style={styles.dayMetaText}>
                        {exerciseCount} exercise{exerciseWord} · added in next step
                      </Text>
                    </View>
                  </GradientCard>;
            })}
              <View style={{
              marginTop: 8
            }}>
                <NbButton variant="ghost" onPress={addDay}>
                  Add workout day
                </NbButton>
              </View>
            </>}

          {step === 3 && <>
              <SectionHeader title="Add exercises" subtitle={workoutDays.length > 1 ? `${((_optObj7 = workoutDays[dayIndex]) == null ? void 0 : _optObj7.dayName) || 'Day'} · ${(((_optObj8 = workoutDays[dayIndex]) == null ? void 0 : _optObj8.exercises) || []).length} logged` : `${(((_optObj9 = workoutDays[dayIndex]) == null ? void 0 : _optObj9.exercises) || []).length} logged`} />
              {(((_optObj0 = workoutDays[dayIndex]) == null ? void 0 : _optObj0.exercises) || []).length === 0 ? <EmptyExerciseState onAdd={openAddModal} /> : (((_optObj1 = workoutDays[dayIndex]) == null ? void 0 : _optObj1.exercises) || []).map((exerciseRow, exerciseIndex) => {
              const setRows = buildSetDetailRowsForExercise(exerciseRow);
              let notesNode = null;
              if (exerciseRow.notes) {
                notesNode = <Text style={styles.exNotes}>{exerciseRow.notes}</Text>;
              }
              return <GradientCard key={exerciseRow.id} style={{
                marginBottom: 10
              }}>
                      <View style={styles.exHeader}>
                        <View style={[styles.numBadge, {
                    backgroundColor: palette.fill,
                    borderColor: palette.border,
                    borderWidth: nb.borderWidth
                  }]}>
                          <Text style={[styles.numBadgeText, {
                      color: palette.onFill
                    }]}>
                            {exerciseIndex + 1}
                          </Text>
                        </View>
                        <View style={{
                    flex: 1,
                    minWidth: 0
                  }}>
                          <Text style={styles.exName} numberOfLines={2}>
                            {exerciseRow.exerciseName}
                          </Text>
                          <Text style={styles.exMeta}>
                            {exerciseRow.sets} sets × {repSummaryForExercise(exerciseRow)} · Rest{' '}
                            {restSummaryForSeconds(exerciseRow.restSeconds)}
                          </Text>
                        </View>
                        <View style={styles.exActions}>
                          <TouchableOpacity onPress={() => moveExercise(exerciseRow.id, -1)} style={styles.exIconBtn}>
                            <Ionicons name="chevron-up" size={18} color={palette.textSecondary} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => moveExercise(exerciseRow.id, 1)} style={styles.exIconBtn}>
                            <Ionicons name="chevron-down" size={18} color={palette.textSecondary} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => openEditModal(exerciseRow)} style={styles.exIconBtn}>
                            <Ionicons name="create-outline" size={18} color={palette.textPrimary} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => removeExercise(exerciseRow.id)} style={styles.exIconBtn}>
                            <Ionicons name="trash-outline" size={18} color={palette.textPrimary} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      {setRows.map((setRow, setRowIndex) => {
                  const weightSuffix = setRow.weight ? ` @ ${setRow.weight}` : '';
                  return <TouchableOpacity key={`${exerciseRow.id}-set-${setRowIndex}`} onPress={() => openSetEdit(exerciseRow, setRowIndex)} style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 8,
                    paddingHorizontal: 4,
                    borderTopWidth: nb.borderWidthDivider,
                    borderTopColor: palette.border
                  }} activeOpacity={0.75}>
                            <Text style={{
                      color: palette.textSecondary,
                      fontSize: 13,
                      flex: 1
                    }}>
                              Set {setRow.setNumber}: {setRow.reps} reps{weightSuffix} · Rest{' '}
                              {restSummaryForSeconds(setRow.restSeconds)}
                            </Text>
                            <Ionicons name="pencil" size={16} color={palette.textPrimary} />
                          </TouchableOpacity>;
                })}
                      {notesNode}
                    </GradientCard>;
            })}
              <View style={styles.exActionRow}>
                <NbButton variant="fill" onPress={openAddModal}>
                  Add exercise
                </NbButton>
                {dayIndex > 0 ? <NbButton variant="ghost" onPress={copyFromFirstDay}>
                    Copy day 1
                  </NbButton> : null}
              </View>
            </>}

          {step === 4 && <>
              <SectionHeader title="Plan summary" subtitle="Double-check before saving" />
              <GradientCard style={{
              marginBottom: 16
            }}>
                <Text style={styles.summaryName}>{planName || 'Untitled plan'}</Text>
                <Text style={styles.summaryMeta}>
                  {duration} · {planType}
                </Text>
                {!!description.trim() ? <Text style={styles.summaryDesc}>{description}</Text> : null}
                <TouchableOpacity onPress={() => {
                setStep(1);
                setDayIndex(0);
              }} style={[styles.summaryEdit, {
                backgroundColor: palette.soft,
                borderColor: palette.border
              }]} activeOpacity={0.85}>
                  <Ionicons name="pencil" size={14} color={palette.textPrimary} />
                  <Text style={[styles.summaryEditText, {
                  color: palette.textPrimary
                }]}>Edit plan</Text>
                </TouchableOpacity>
              </GradientCard>
              {workoutDays.map(dayRow => <View key={dayRow.id} style={{
              marginBottom: 14
            }}>
                  <Text style={[styles.subHead, {
                color: palette.textTertiary
              }]}>
                    {String(dayRow.dayName).toUpperCase()} · {(dayRow.exercises || []).length}{' '}
                    exercises
                  </Text>
                  {(dayRow.exercises || []).map((exerciseRow, exerciseIndex) => <GradientCard key={exerciseRow.id} style={{
                marginBottom: 8
              }}>
                      <Text style={styles.exTitle}>
                        {exerciseIndex + 1}. {exerciseRow.exerciseName}
                      </Text>
                      <Text style={styles.exMeta}>
                        {exerciseRow.sets} sets × {repSummaryForExercise(exerciseRow)} · Rest{' '}
                        {restSummaryForSeconds(exerciseRow.restSeconds)}
                      </Text>
                    </GradientCard>)}
                </View>)}
              <SectionHeader title="Assign to clients" subtitle="Optional — save without assigning anytime" />
              {(clients || []).length === 0 ? <Text style={styles.caption}>No linked clients yet. You can still save for later.</Text> : <View style={styles.clientGrid}>
                  {clients.map(clientRow => {
                const clientIsAssigned = assignedClients.includes(clientRow.id);
                const chipShellStyle = clientIsAssigned ? styles.clientChipInnerOn : styles.clientChipOff;
                const chipBackgroundColor = clientIsAssigned ? palette.fill : palette.surface;
                const chipIconName = clientIsAssigned ? 'checkmark-circle' : 'ellipse-outline';
                const chipIconColor = clientIsAssigned ? palette.onFill : palette.textTertiary;
                const chipTextStyle = clientIsAssigned ? styles.clientChipTextOn : styles.clientChipTextOff;
                const chipTextColor = clientIsAssigned ? palette.onFill : palette.textSecondary;
                const clientDisplayLabel = clientRow.name || clientRow.displayName || clientRow.id;
                return <TouchableOpacity key={clientRow.id} onPress={() => toggleClient(clientRow.id)} activeOpacity={0.88}>
                        <View style={[chipShellStyle, {
                    backgroundColor: chipBackgroundColor,
                    borderColor: palette.border,
                    borderWidth: nb.borderWidth
                  }]}>
                          <Ionicons name={chipIconName} size={18} color={chipIconColor} />
                          <Text style={[chipTextStyle, {
                      color: chipTextColor
                    }]}>
                            {clientDisplayLabel}
                          </Text>
                        </View>
                      </TouchableOpacity>;
              })}
                </View>}
            </>}

          {step === 5 && <View style={styles.doneWrap}>
              <View style={[styles.doneIconRing, {
              backgroundColor: palette.fill,
              borderColor: palette.border,
              borderWidth: nb.borderWidth
            }]}>
                <Ionicons name="checkmark" size={40} color={palette.onFill} />
              </View>
              <Text style={styles.h2}>Plan saved</Text>
              <Text style={[styles.caption, styles.doneCaption]}>
                Assigned clients will see it in their workout library. Edit anytime from Custom plans.
              </Text>
            </View>}

          {renderStepActions()}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          {/* Design Law sheet — grabber + 3px top border (PNG 21/23), no pink rim */}
          <View style={[styles.modalSheetBorder, {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderTopWidth: nb.borderWidth,
            borderLeftWidth: nb.borderWidth,
            borderRightWidth: nb.borderWidth
          }]}>
            <View style={styles.modalCard}>
            <View style={[styles.modalHandle, {
                backgroundColor: palette.modalHandle
              }]} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editExerciseId ? 'Edit exercise' : 'Exercise library'}</Text>
              <TouchableOpacity onPress={() => {
                  setModalOpen(false);
                  resetModal();
                }} style={[styles.modalClose, {
                  borderColor: palette.border,
                  borderWidth: nb.borderWidth
                }]}>
                <Ionicons name="close" size={22} color={palette.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{
                paddingBottom: scrollBottomPad
              }} scrollEventThrottle={16} keyboardDismissMode="on-drag">
            {/* Design Law PNG 21 — search + muscle segment + equipment pills */}
            <FormField style={{
                  marginBottom: 10
                }}>
              <View style={styles.searchRow}>
                <Ionicons name="search" size={18} color={palette.textTertiary} />
                <TextInput style={styles.searchInput} placeholder="Search exercises" placeholderTextColor={palette.textTertiary} value={searchQ} onChangeText={setSearchQ} />
              </View>
            </FormField>
            <View style={[styles.muscleSegment, {
                  borderColor: palette.border,
                  backgroundColor: palette.surface
                }]}>
              {LIBRARY_MUSCLE_CHIPS.map((muscleLabel, muscleIndex) => {
                    const muscleIsActive = libraryMuscle === muscleLabel;
                    const leftDividerStyle = muscleIndex > 0 ? {
                      borderLeftWidth: nb.borderWidth,
                      borderLeftColor: palette.border
                    } : null;
                    const activeBackgroundStyle = muscleIsActive ? {
                      backgroundColor: palette.textPrimary
                    } : null;
                    const muscleTextColor = muscleIsActive ? palette.surface : palette.textPrimary;
                    return <TouchableOpacity key={muscleLabel} onPress={() => setLibraryMuscle(previousMuscle => previousMuscle === muscleLabel ? null : muscleLabel)} style={[styles.muscleSegmentCell, leftDividerStyle, activeBackgroundStyle]} accessibilityRole="button" accessibilityState={{
                      selected: muscleIsActive
                    }}>
                    <Text style={[styles.muscleSegmentText, {
                        color: muscleTextColor
                      }]} numberOfLines={1}>
                      {muscleLabel}
                    </Text>
                  </TouchableOpacity>;
                  })}
            </View>
            <View style={styles.equipWrap}>
              {LIBRARY_EQUIPMENT_CHIPS.map(label => <Pill key={label} label={label} active={libraryEquipments.includes(label)} onPress={() => toggleLibraryEquipment(label)} />)}
            </View>
            {searchResults.length > 0 ? <View style={styles.suggestList}>
                {searchResults.map(libraryItem => {
                    const equipmentLabel = inferExerciseEquipment(libraryItem);
                    const muscleLine = (libraryItem.muscleGroups || []).slice(0, 1).join('');
                    const subtitleParts = [muscleLine, equipmentLabel].filter(Boolean);
                    const subtitleText = subtitleParts.join(' · ');
                    const libraryItemIsSelected = (pickedLibrary == null ? void 0 : pickedLibrary.id) === libraryItem.id;
                    const addButtonBackground = libraryItemIsSelected ? palette.textPrimary : palette.surface;
                    const addButtonIconColor = libraryItemIsSelected ? palette.surface : palette.textPrimary;
                    const selectedRowStyle = libraryItemIsSelected ? styles.suggestRowActive : null;
                    let subtitleNode = null;
                    if (subtitleText) {
                      subtitleNode = <Text style={styles.suggestMuscles}>{subtitleText}</Text>;
                    }
                    const pickThisLibraryItem = () => {
                      setPickedLibrary(libraryItem);
                      setCustomName('');
                    };
                    return <View key={libraryItem.id} style={[styles.suggestRow, selectedRowStyle, {
                      borderBottomColor: palette.border
                    }]}>
                      <TouchableOpacity style={{
                        flex: 1,
                        minWidth: 0,
                        paddingVertical: 4
                      }} onPress={pickThisLibraryItem}>
                        <Text style={styles.exTitle}>{libraryItem.name}</Text>
                        {subtitleNode}
                      </TouchableOpacity>
                      <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbIconChip}>
                        <TouchableOpacity onPress={pickThisLibraryItem} style={[styles.libraryAddSq, {
                          borderColor: palette.border,
                          backgroundColor: addButtonBackground
                        }]} accessibilityLabel={`Add ${libraryItem.name}`}>
                          <Ionicons name="add" size={20} color={addButtonIconColor} />
                        </TouchableOpacity>
                      </HardShadow>
                    </View>;
                  })}
              </View> : <Text style={[styles.suggestMuscles, {
                  marginBottom: 12
                }]}>
                No exercises match these filters.
              </Text>}
            <FieldLabel>Or custom name</FieldLabel>
            <FormField>
              <TextInput style={styles.inputBare} placeholder="Use a custom name" placeholderTextColor={palette.textTertiary} value={customName} onChangeText={typedCustomName => {
                    setCustomName(typedCustomName);
                    if (typedCustomName.trim()) setPickedLibrary(null);
                  }} />
            </FormField>
            {(pickedLibrary || customName.trim()) && <>
                <Text style={styles.label}>Sets</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => setSets(s => Math.max(1, s - 1))}>
                    <Text style={styles.stepBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepVal}>{sets}</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => setSets(s => Math.min(20, s + 1))}>
                    <Text style={styles.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.label}>Reps</Text>
                <View style={styles.row}>
                  <Pill label="Fixed" active={repMode === 'fixed'} onPress={() => setRepMode('fixed')} />
                  <Pill label="Range" active={repMode === 'range'} onPress={() => setRepMode('range')} />
                </View>
                {repMode === 'fixed' ? <View style={styles.stepper}>
                    <TouchableOpacity style={styles.stepBtn} onPress={() => setRepsSingle(n => Math.max(1, n - 1))}>
                      <Text style={styles.stepBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.stepVal}>{repsSingle}</Text>
                    <TouchableOpacity style={styles.stepBtn} onPress={() => setRepsSingle(n => Math.min(100, n + 1))}>
                      <Text style={styles.stepBtnText}>+</Text>
                    </TouchableOpacity>
                  </View> : <View style={styles.rowBetween}>
                    <View style={{
                      flex: 1,
                      marginRight: 8
                    }}>
                      <Text style={styles.caption}>Min</Text>
                      <View style={styles.stepper}>
                        <TouchableOpacity style={styles.stepBtn} onPress={() => setRepsMin(n => Math.max(1, n - 1))}>
                          <Text style={styles.stepBtnText}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.stepVal}>{repsMin}</Text>
                        <TouchableOpacity style={styles.stepBtn} onPress={() => setRepsMin(n => Math.min(100, n + 1))}>
                          <Text style={styles.stepBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={{
                      flex: 1,
                      marginLeft: 8
                    }}>
                      <Text style={styles.caption}>Max</Text>
                      <View style={styles.stepper}>
                        <TouchableOpacity style={styles.stepBtn} onPress={() => setRepsMax(n => Math.max(1, n - 1))}>
                          <Text style={styles.stepBtnText}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.stepVal}>{repsMax}</Text>
                        <TouchableOpacity style={styles.stepBtn} onPress={() => setRepsMax(n => Math.min(100, n + 1))}>
                          <Text style={styles.stepBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>}
                <Text style={styles.label}>Rest between sets</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                  {REST_PRESETS.map(restPresetSeconds => <Pill key={restPresetSeconds} label={restSummaryForSeconds(restPresetSeconds)} active={restSeconds === restPresetSeconds} onPress={() => setRestSeconds(restPresetSeconds)} />)}
                </ScrollView>
                <Text style={styles.label}>Tempo (optional)</Text>
                <TextInput style={styles.input} placeholder="e.g., 3-1-1-1" placeholderTextColor={palette.textTertiary} value={tempo} onChangeText={setTempo} />
                <Text style={styles.label}>Target load (optional)</Text>
                <TextInput style={styles.input} placeholder="e.g., 185 lb" placeholderTextColor={palette.textTertiary} value={weight} onChangeText={setWeight} />
                <Text style={styles.label}>Progression (optional)</Text>
                <TextInput style={styles.input} placeholder="e.g., +5 lb when all sets hit top of range" placeholderTextColor={palette.textTertiary} value={progression} onChangeText={setProgression} />
                <Text style={styles.label}>Notes (optional)</Text>
                <TextInput style={[styles.input, styles.inputMulti]} placeholder="Coaching cues…" placeholderTextColor={palette.textTertiary} value={notes} onChangeText={setNotes} multiline />
              </>}
            </ScrollView>
            <View style={styles.modalFooter}>
              <SecondaryButton label="Cancel" onPress={() => {
                  setModalOpen(false);
                  resetModal();
                }} compact />
              <PrimaryButton label={editExerciseId ? 'Save exercise' : 'Add'} onPress={confirmModal} />
            </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={setEditOpen} animationType="fade" transparent onRequestClose={() => setSetEditOpen(false)}>
        <KeyboardAvoidingView style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0,0,0,0.55)'
        }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={80}>
          <Pressable style={{
            flex: 1
          }} onPress={() => setSetEditOpen(false)} />
          <View style={[styles.modalCard, {
            marginHorizontal: 16,
            marginBottom: 24,
            borderRadius: 16,
            padding: 16
          }]}>
            <Text style={styles.modalTitle}>Edit set {setEditIndex + 1}</Text>
            <FieldLabel>Reps</FieldLabel>
            <FormField>
              <TextInput style={styles.inputBare} keyboardType="number-pad" value={setEditReps} onChangeText={setSetEditReps} placeholder="10" placeholderTextColor={palette.textTertiary} />
            </FormField>
            <FieldLabel>Weight</FieldLabel>
            <FormField>
              <TextInput style={styles.inputBare} value={setEditWeight} onChangeText={setSetEditWeight} placeholder="e.g. 185 lbs" placeholderTextColor={palette.textTertiary} />
            </FormField>
            <FieldLabel>Rest (seconds)</FieldLabel>
            <FormField>
              <TextInput style={styles.inputBare} keyboardType="number-pad" value={setEditRest} onChangeText={setSetEditRest} placeholder="120" placeholderTextColor={palette.textTertiary} />
            </FormField>
            <View style={{
              flexDirection: 'row',
              gap: 10,
              marginTop: 12
            }}>
              <SecondaryButton label="Cancel" onPress={() => setSetEditOpen(false)} />
              <PrimaryButton label="Save set" onPress={saveSetEdit} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <NbNoticeSheet visible={!!notice} onClose={() => setNotice(null)} title={(notice == null ? void 0 : notice.title) || ''} message={notice == null ? void 0 : notice.message} confirmLabel={(notice == null ? void 0 : notice.confirmLabel) || 'OK'} cancelLabel={notice == null ? void 0 : notice.cancelLabel} onConfirm={notice == null ? void 0 : notice.onConfirm} destructive={!!(notice == null ? void 0 : notice.destructive)} />
    </SafeAreaView>
    </BuilderlightDarkMode.Provider>;
}

// ===== PLUMBING — skip unless debugging =====

function createBuilderStyles(palette) {
  const colors = palette;
  return StyleSheet.create({
    safe: {
      flex: 1
    },
    scroll: {
      flex: 1
    },
    scrollPad: {
      paddingHorizontal: 18,
      paddingTop: 8,
      flexGrow: 0
    },
    stepHeading: {
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 10,
      zIndex: 1,
      borderBottomWidth: nb.borderWidthDivider,
      borderBottomColor: colors.topBarBorder
    },
    topTitle: {
      color: colors.textPrimary,
      fontSize: 25,
      fontWeight: '900',
      letterSpacing: -0.6
    },
    topSubtitle: {
      color: colors.textTertiary,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 2
    },
    // Manipulate here: capsule height / gap for step progress (PNG 19)
    stepStripShell: {
      marginHorizontal: 16,
      marginBottom: 14,
      paddingVertical: 10,
      zIndex: 1
    },
    stepCapsulesRow: {
      flexDirection: 'row',
      gap: 8
    },
    stepCapsule: {
      height: 10,
      borderRadius: 999,
      borderWidth: nb.borderWidth
    },
    stepStripMeta: {
      marginTop: 10,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1.3
    },
    sectionHeader: {
      marginTop: 8,
      marginBottom: 14
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '900',
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 1.3,
      marginBottom: 4
    },
    sectionSubtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      fontWeight: '500',
      marginBottom: 8
    },
    sectionUnderline: {
      height: 3,
      borderRadius: 2,
      width: 72,
      backgroundColor: colors.fill
    },
    label: {
      fontSize: 12,
      fontWeight: '900',
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 1.3,
      marginBottom: 8,
      marginTop: 14
    },
    labelTight: {
      marginTop: 10,
      marginBottom: 6
    },
    formFieldShell: {
      borderRadius: borderRadius.nbInput || 8,
      borderWidth: nb.borderWidth,
      overflow: 'hidden'
    },
    fieldInner: {
      padding: 12
    },
    fieldInnerCompact: {
      padding: 10
    },
    setupHeroCard: {
      marginBottom: 4
    },
    setupHeroInner: {
      padding: 18,
      overflow: 'hidden'
    },
    setupField: {
      borderRadius: 8,
      borderWidth: nb.borderWidth,
      borderColor: colors.border,
      backgroundColor: colors.setupFieldBg,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 4
    },
    setupFieldMulti: {
      minHeight: 100,
      paddingVertical: 10
    },
    setupInput: {
      fontSize: 16,
      color: colors.textPrimary,
      fontWeight: '600',
      padding: 0
    },
    setupInputMulti: {
      minHeight: 80,
      textAlignVertical: 'top'
    },
    stepActionsWrap: {
      marginTop: 28,
      paddingTop: 20,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.stepActionsBorder
    },
    stepActionsTight: {
      marginTop: 22,
      paddingTop: 0,
      borderTopWidth: 0
    },
    inputBare: {
      fontSize: 16,
      color: colors.textPrimary,
      fontWeight: '600',
      paddingVertical: 4,
      paddingHorizontal: 0
    },
    inputMulti: {
      minHeight: 96,
      textAlignVertical: 'top'
    },
    input: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.textPrimary,
      fontWeight: '500'
    },
    pillGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 4
    },
    pillRow: {
      flexDirection: 'row',
      gap: 8,
      paddingVertical: 4,
      flexWrap: 'wrap'
    },
    pill: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 999,
      minHeight: nb.minTouchTarget,
      justifyContent: 'center'
    },
    pillText: {
      fontSize: 13,
      fontWeight: '700'
    },
    pillTextActive: {
      fontWeight: '900'
    },
    gradInner: {
      borderRadius: borderRadius.nbCard,
      backgroundColor: colors.cardBg,
      padding: 14,
      overflow: 'hidden'
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 10
    },
    footerCol: {
      gap: 10
    },
    caption: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 4
    },
    h2: {
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: '900',
      marginTop: 16,
      letterSpacing: -0.5
    },
    subHead: {
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1.3,
      marginBottom: 8,
      textTransform: 'uppercase'
    },
    dayCardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12
    },
    dayNumBadge: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center'
    },
    dayNumText: {
      fontWeight: '900',
      fontSize: 15
    },
    dayNameInput: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
      paddingVertical: 4
    },
    dayRemove: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: nb.borderWidth
    },
    dayMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 12
    },
    dayMetaText: {
      color: colors.textTertiary,
      fontSize: 12,
      fontWeight: '600'
    },
    exHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10
    },
    numBadge: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center'
    },
    numBadgeText: {
      fontWeight: '900',
      fontSize: 13
    },
    exName: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: -0.2
    },
    exTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '800'
    },
    exMeta: {
      color: colors.textSecondary,
      fontSize: 13,
      marginTop: 4,
      fontWeight: '500'
    },
    exNotes: {
      color: colors.textTertiary,
      fontSize: 12,
      fontStyle: 'italic',
      marginTop: 10,
      lineHeight: 17
    },
    exActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2
    },
    exIconBtn: {
      width: 44,
      height: 44,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.exIconBg
    },
    exActionRow: {
      marginTop: 14,
      gap: 10
    },
    emptyExWrap: {
      alignItems: 'center',
      paddingVertical: 8
    },
    emptyExIcon: {
      width: 56,
      height: 56,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
      borderWidth: nb.borderWidth
    },
    emptyExTitle: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: '800'
    },
    emptyExSub: {
      color: colors.textSecondary,
      fontSize: 13,
      textAlign: 'center',
      marginTop: 6,
      lineHeight: 18
    },
    summaryName: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: -0.4
    },
    summaryMeta: {
      color: colors.textSecondary,
      fontSize: 14,
      marginTop: 6,
      fontWeight: '600'
    },
    summaryDesc: {
      color: colors.textTertiary,
      fontSize: 13,
      marginTop: 10,
      lineHeight: 19
    },
    summaryEdit: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 14,
      alignSelf: 'flex-start',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: nb.borderWidth
    },
    summaryEditText: {
      fontSize: 13,
      fontWeight: '800'
    },
    clientGrid: {
      gap: 10,
      marginBottom: 8
    },
    clientChipInnerOn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: borderRadius.nbCard
    },
    clientChipTextOn: {
      fontSize: 15,
      fontWeight: '700',
      flex: 1
    },
    clientChipOff: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: borderRadius.nbCard
    },
    clientChipTextOff: {
      fontSize: 15,
      fontWeight: '600',
      flex: 1
    },
    doneWrap: {
      alignItems: 'center',
      paddingTop: 48,
      paddingBottom: 24
    },
    doneIconRing: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8
    },
    doneCaption: {
      textAlign: 'center',
      paddingHorizontal: 24,
      marginTop: 10
    },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 10
    },
    row: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
      flexWrap: 'wrap'
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end'
    },
    modalSheetBorder: {
      borderTopLeftRadius: borderRadius.nbSheet || 24,
      borderTopRightRadius: borderRadius.nbSheet || 24,
      maxHeight: '92%',
      overflow: 'hidden'
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: borderRadius.nbSheet || 24,
      borderTopRightRadius: borderRadius.nbSheet || 24,
      paddingHorizontal: 18,
      paddingBottom: 18,
      maxHeight: '100%'
    },
    modalHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 8
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: -0.3
    },
    modalClose: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.modalCloseBg
    },
    modalFooter: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 10,
      paddingTop: 12,
      borderTopWidth: nb.borderWidthDivider,
      borderTopColor: colors.divider,
      marginTop: 8
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: colors.textPrimary,
      fontWeight: '600',
      paddingVertical: 2
    },
    // Manipulate here: PNG 21 muscle segment height / cell padding
    muscleSegment: {
      flexDirection: 'row',
      borderWidth: nb.borderWidth,
      borderRadius: borderRadius.nbCard,
      overflow: 'hidden',
      marginBottom: 10,
      minHeight: 44
    },
    muscleSegmentCell: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 4
    },
    muscleSegmentText: {
      fontSize: 12,
      fontWeight: '800'
    },
    equipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12
    },
    suggestList: {
      borderRadius: borderRadius.nbCard,
      overflow: 'hidden',
      marginBottom: 8,
      borderWidth: nb.borderWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface
    },
    suggestRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderBottomWidth: nb.borderWidthDivider,
      borderBottomColor: colors.suggestRowBorder
    },
    suggestRowActive: {
      backgroundColor: colors.soft
    },
    suggestMuscles: {
      color: colors.textTertiary,
      fontSize: 12,
      marginTop: 3,
      fontWeight: '500'
    },
    libraryAddSq: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.nbIconChip,
      borderWidth: nb.borderWidth,
      alignItems: 'center',
      justifyContent: 'center'
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      marginVertical: 10,
      paddingVertical: 8,
      borderRadius: borderRadius.nbCard,
      borderWidth: nb.borderWidth,
      borderColor: colors.border,
      backgroundColor: colors.stepperBg
    },
    stepBtn: {
      width: 44,
      height: 44,
      borderRadius: 12,
      borderWidth: nb.borderWidth,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface
    },
    stepBtnText: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: '700'
    },
    stepVal: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: '900',
      minWidth: 40,
      textAlign: 'center'
    }
  });
}
