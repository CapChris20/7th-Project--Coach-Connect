// Design Law manual plan builder (PNG 19–24): schedule → days → exercises → review/assign.
// Flow: edit steps → build setDetails → saveManualPlanDraft → hand plan id back to parent.
// Used by trainer Tools → Workout plans → Build custom. Persistence: manualPlanToWorkoutPlan.js.

import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { nb, borderRadius } from '../../look-and-feel/colorPalette';
import NbButton from '../../look-and-feel/NbButton';
import HardShadow from '../../look-and-feel/HardShadow';
import TopHeader from '../../for-both/loading-and-header/TopHeader';
import { SHELL_SAFE_AREA_EDGES, FORM_SCROLL_PROPS, useEmbeddedScrollBottomPad } from '../../navigation/bottomMenuSpacing';
import {
  newLocalId,
  saveManualPlanDraft,
  getManualWorkoutPlan,
  draftFromTrainerPlanDoc,
  searchExercisesForBuilder,
} from './manualPlanToWorkoutPlan';

// ===== NAMED CONSTANTS =====

const DEFAULT_SET_COUNT = 3;
const DEFAULT_REPS = 10;
const DEFAULT_REST_SECONDS = 120;
const SECONDS_PER_MINUTE = 60;
const REST_PRESET_ONE_MIN = 60;
const REST_PRESET_VALUES = [REST_PRESET_ONE_MIN, 90, 120, 150, 180];
const EMBEDDED_SCROLL_PAD = 32;

// ===== HELPER FUNCTIONS =====


function buildSetDetailRowsForExercise(ex) {
  const setCount = Math.max(1, parseInt(String(ex?.sets), 10) || DEFAULT_SET_COUNT);
  if (Array.isArray(ex?.setDetails) && ex.setDetails.length === setCount) {
    return ex.setDetails.map((setRow, i) => ({
      setNumber: i + 1,
      reps: String(setRow.reps ?? (ex.repMode === 'fixed' ? ex.repsSingle : ex.repsMax) ?? DEFAULT_REPS),
      weight: String(setRow.weight ?? ex.weight ?? ''),
      restSeconds: Number(setRow.restSeconds ?? ex.restSeconds ?? DEFAULT_REST_SECONDS) || DEFAULT_REST_SECONDS,
    }));
  }
  const defaultReps = ex?.repMode === 'fixed' ? ex?.repsSingle : ex?.repsMax;
  return Array.from({ length: setCount }, (_, i) => ({
    setNumber: i + 1,
    reps: String(defaultReps ?? DEFAULT_REPS),
    weight: String(ex?.weight ?? ''),
    restSeconds: Number(ex?.restSeconds ?? DEFAULT_REST_SECONDS) || DEFAULT_REST_SECONDS,
  }));
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
    shadow: colors.nbShadow,
  };
}

const BuilderlightDarkMode = React.createContext(null);

function useBuilderTheme() {
  const ctx = useContext(BuilderlightDarkMode);
  if (!ctx) throw new Error('useBuilderTheme must be used within BuilderlightDarkMode.Provider');
  return ctx;
}

function SectionHeader({ title, subtitle }) {
  const { styles } = useBuilderTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      {/* Design Law: solid ink underline — not a pink→cyan gradient bar */}
      <View style={styles.sectionUnderline} />
    </View>
  );
}

/** Progress capsules (PNG 19) — fill = done/active, soft = upcoming. */
function PlanStepStrip({ step }) {
  const { c, styles } = useBuilderTheme();
  if (step >= 5) return null;
  const items = [
    { id: 1, label: 'Setup' },
    { id: 2, label: 'Days' },
    { id: 3, label: 'Moves' },
    { id: 4, label: 'Review' },
  ];
  const total = items.length;
  return (
    <View style={styles.stepStripShell}>
      <View style={styles.stepCapsulesRow}>
        {items.map(({ id }) => {
          const filled = step >= id;
          return (
            <View
              key={id}
              style={[
                styles.stepCapsule,
                {
                  flex: 1,
                  backgroundColor: filled ? c.fill : c.soft,
                  borderColor: c.border,
                },
              ]}
            />
          );
        })}
      </View>
      <Text style={[styles.stepStripMeta, { color: c.textTertiary }]}>
        {`STEP ${Math.min(step, total)} OF ${total} · ${items[Math.min(step, total) - 1]?.label || ''}`.toUpperCase()}
      </Text>
    </View>
  );
}

/** Hard-shadow surface card — replaces old GradientCard pink rim. */
function DesignCard({ children, style, innerStyle }) {
  const { c, styles } = useBuilderTheme();
  return (
    <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={style}>
      <View
        style={[
          styles.gradInner,
          { backgroundColor: c.cardBg, borderColor: c.border, borderWidth: nb.borderWidth },
          innerStyle,
        ]}
      >
        {children}
      </View>
    </HardShadow>
  );
}

// Keep the old name so step JSX still compiles after the chrome swap.
function GradientCard({ children, style, innerStyle }) {
  return (
    <DesignCard style={style} innerStyle={innerStyle}>
      {children}
    </DesignCard>
  );
}

function FieldLabel({ children, tight }) {
  const { styles } = useBuilderTheme();
  return <Text style={[styles.label, tight && styles.labelTight]}>{children}</Text>;
}

function FormField({ children, style, compact }) {
  const { c, styles } = useBuilderTheme();
  return (
    <View
      style={[
        styles.formFieldShell,
        {
          borderColor: c.border,
          backgroundColor: c.surface,
          marginTop: 0,
        },
        style,
      ]}
    >
      <View style={[styles.fieldInner, compact && styles.fieldInnerCompact]}>{children}</View>
    </View>
  );
}

function PrimaryButton({ label, onPress, disabled, loading, compact }) {
  return (
    <View style={{ flex: compact ? 0 : 1, minWidth: compact ? undefined : 0 }}>
      <NbButton variant="fill" onPress={onPress} disabled={disabled || loading}>
        {loading ? 'Saving…' : label}
      </NbButton>
    </View>
  );
}

function SecondaryButton({ label, onPress, compact }) {
  return (
    <View style={{ flex: compact ? 0 : 1, minWidth: compact ? 120 : 0 }}>
      <NbButton variant="ghost" onPress={onPress}>
        {label}
      </NbButton>
    </View>
  );
}

/** Selected = fill+onFill; idle = surface+border (PNG day/type chips). */
function Pill({ label, active, onPress }) {
  const { c, styles } = useBuilderTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={[
        styles.pill,
        {
          backgroundColor: active ? c.fill : c.surface,
          borderColor: c.border,
          borderWidth: nb.borderWidth,
        },
      ]}
    >
      <Text style={[styles.pillText, { color: active ? c.onFill : c.textPrimary }, active && styles.pillTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function EmptyExerciseState({ onAdd }) {
  const { c, styles } = useBuilderTheme();
  return (
    <DesignCard style={{ marginTop: 8 }}>
      <View style={styles.emptyExWrap}>
        <View style={[styles.emptyExIcon, { backgroundColor: c.soft, borderColor: c.border }]}>
          <Ionicons name="barbell-outline" size={28} color={c.textPrimary} />
        </View>
        <Text style={styles.emptyExTitle}>No exercises yet</Text>
        <Text style={styles.emptyExSub}>Search the library or type a custom movement.</Text>
        <View style={{ marginTop: 14, width: '100%' }}>
          <NbButton variant="fill" onPress={onAdd}>
            Add first exercise
          </NbButton>
        </View>
      </View>
    </DesignCard>
  );
}

const defaultWorkoutDays = () => [
  { id: newLocalId('day'), dayName: 'Monday', dayNumber: 1, exercises: [] },
  { id: newLocalId('day'), dayName: 'Wednesday', dayNumber: 2, exercises: [] },
  { id: newLocalId('day'), dayName: 'Friday', dayNumber: 3, exercises: [] },
];

function sanitizeManualDraftForFirestore(state) {
  const workoutDays = (state.workoutDays || []).map((d, idx) => ({
    dayId: d.id,
    dayName: String(d.dayName || `Day ${idx + 1}`).trim(),
    dayNumber: d.dayNumber ?? idx + 1,
    exercises: (d.exercises || []).map((ex) => {
      const reps =
        ex.repMode === 'fixed'
          ? { min: Number(ex.repsSingle) || 8, max: Number(ex.repsSingle) || 8 }
          : { min: Number(ex.repsMin) || 8, max: Number(ex.repsMax) || 8 };
      return {
        exerciseId: ex.id,
        libraryExerciseId: ex.libraryExerciseId || null,
        exerciseName: String(ex.exerciseName || '').trim(),
        sets: Math.max(1, parseInt(String(ex.sets), 10) || 3),
        reps,
        restSeconds: Math.max(0, parseInt(String(ex.restSeconds), 10) || 90),
        notes: String(ex.notes || '').trim(),
        tempo: String(ex.tempo || '').trim(),
        weight: ex.weight != null ? String(ex.weight).trim() : '',
        progression: String(ex.progression || '').trim(),
        muscleGroups: Array.isArray(ex.muscleGroups) ? ex.muscleGroups : [],
        setDetails: Array.isArray(ex.setDetails)
          ? ex.setDetails.map((s, i) => ({
              setNumber: i + 1,
              reps: String(s.reps ?? ''),
              weight: String(s.weight ?? ''),
              restSeconds: Math.max(0, parseInt(String(s.restSeconds), 10) || 0),
            }))
          : [],
      };
    }),
  }));
  return {
    planName: String(state.planName || '').trim(),
    planType: state.planType,
    duration: state.duration,
    description: String(state.description || '').trim(),
    workoutDays,
    assignedClients: [...new Set((state.assignedClients || []).filter(Boolean))],
  };
}

function countExercisesAcrossDays(days) {
  return (days || []).reduce((acc, d) => acc + (d.exercises?.length || 0), 0);
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
  embedInLayout = false,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // vocab: palette = remapped nb tokens under old `c.*` keys for this screen's StyleSheet
  const palette = useMemo(() => getBuilderPalette(colors), [colors]);
  const styles = useMemo(() => createBuilderStyles(palette), [palette]);
  const themeValue = useMemo(() => ({ c: palette, styles }), [palette, styles]);
  const scrollBottomPad = useEmbeddedScrollBottomPad(EMBEDDED_SCROLL_PAD);

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

  const [modalOpen, setModalOpen] = useState(false);
  const [editExerciseId, setEditExerciseId] = useState(null);
  const [searchQ, setSearchQ] = useState('');
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

  const openSetEdit = (ex, setIndex) => {
    const rows = buildSetDetailRowsForExercise(ex);
    const row = rows[setIndex] || rows[0];
    setSetEditExId(ex.id);
    setSetEditIndex(setIndex);
    setSetEditReps(String(row.reps ?? '10'));
    setSetEditWeight(String(row.weight ?? ''));
    setSetEditRest(String(row.restSeconds ?? 120));
    setSetEditOpen(true);
  };

  const saveSetEdit = () => {
    if (!setEditExId) return;
    setWorkoutDays((days) =>
      days.map((d, i) => {
        if (i !== dayIndex) return d;
        return {
          ...d,
          exercises: (d.exercises || []).map((ex) => {
            if (ex.id !== setEditExId) return ex;
            const rows = buildSetDetailRowsForExercise(ex);
            rows[setEditIndex] = {
              setNumber: setEditIndex + 1,
              reps: setEditReps,
              weight: setEditWeight,
              restSeconds: Math.max(0, parseInt(String(setEditRest), 10) || 0),
            };
            return {
              ...ex,
              setDetails: rows,
              sets: rows.length,
              weight: rows[0]?.weight || ex.weight,
              restSeconds: rows[0]?.restSeconds ?? ex.restSeconds,
            };
          }),
        };
      }),
    );
    setSetEditOpen(false);
  };

  const searchResults = useMemo(() => searchExercisesForBuilder(searchQ, 20), [searchQ]);

  useEffect(() => {
    if (!editPlanId || !trainerId) return;
    let cancelled = false;
    (async () => {
      setLoadingPlan(true);
      try {
        const doc = await getManualWorkoutPlan(trainerId, editPlanId);
        if (cancelled || !doc) return;
        const draft = draftFromTrainerPlanDoc(doc);
        if (!draft) return;
        setPlanName(draft.planName);
        setPlanType(draft.planType || 'Custom');
        setDuration(draft.duration || '4 weeks');
        setDescription(draft.description || '');
        setWorkoutDays(
          (draft.workoutDays && draft.workoutDays.length
            ? draft.workoutDays
            : defaultWorkoutDays()
          ).map((x, i) => ({
            ...x,
            id: x.id || newLocalId('day'),
            dayNumber: x.dayNumber ?? i + 1,
            exercises: (x.exercises || []).map((ex) => ({
              ...ex,
              id: ex.id || newLocalId('ex'),
            })),
          })),
        );
        setAssignedClients(draft.assignedClients?.length ? draft.assignedClients : [...(defaultAssignedClientIds || [])]);
        setSavedPlanId(editPlanId);
      } catch (e) {
        Alert.alert('Could not load plan', e?.message || 'Unknown error');
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

  const openEditModal = (ex) => {
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

  const applyExerciseToDay = (exerciseObj) => {
    setWorkoutDays((days) =>
      days.map((d, i) => {
        if (i !== dayIndex) return d;
        const nextEx = [...(d.exercises || [])];
        const idx = editExerciseId ? nextEx.findIndex((e) => e.id === editExerciseId) : -1;
        if (idx >= 0) nextEx[idx] = exerciseObj;
        else nextEx.push(exerciseObj);
        return { ...d, exercises: nextEx };
      }),
    );
  };

  const confirmModal = () => {
    const name = (pickedLibrary?.name || customName || '').trim();
    if (!name) {
      Alert.alert('Exercise name required', 'Pick from the library or enter a custom name.');
      return;
    }
    const id = editExerciseId || newLocalId('ex');
    const ex = {
      id,
      libraryExerciseId: pickedLibrary?.id || null,
      exerciseName: name,
      muscleGroups: pickedLibrary?.muscleGroups || [],
      sets,
      repMode,
      repsMin,
      repsMax,
      repsSingle,
      restSeconds,
      notes,
      tempo,
      weight,
      progression,
    };
    ex.setDetails = buildSetDetailRowsForExercise(ex);
    applyExerciseToDay(ex);
    setModalOpen(false);
    resetModal();
  };

  const removeExercise = (exId) => {
    setWorkoutDays((days) =>
      days.map((d, i) => {
        if (i !== dayIndex) return d;
        return { ...d, exercises: (d.exercises || []).filter((e) => e.id !== exId) };
      }),
    );
  };

  const moveExercise = (exId, dir) => {
    setWorkoutDays((days) =>
      days.map((d, i) => {
        if (i !== dayIndex) return d;
        const list = [...(d.exercises || [])];
        const idx = list.findIndex((e) => e.id === exId);
        const j = idx + dir;
        if (idx < 0 || j < 0 || j >= list.length) return d;
        const swapped = list[idx];
        list[idx] = list[j];
        list[j] = swapped;
        return { ...d, exercises: list };
      }),
    );
  };

  const addDay = () => {
    setWorkoutDays((d) => [
      ...d,
      {
        id: newLocalId('day'),
        dayName: `Day ${d.length + 1}`,
        dayNumber: d.length + 1,
        exercises: [],
      },
    ]);
  };

  const removeDay = (id) => {
    setWorkoutDays((d) => {
      const next = d.filter((x) => x.id !== id);
      const rows = !next.length ? defaultWorkoutDays() : next.map((x, i) => ({ ...x, dayNumber: i + 1 }));
      setDayIndex((i) => Math.min(i, Math.max(0, rows.length - 1)));
      return rows;
    });
  };

  const copyFromFirstDay = () => {
    if (!workoutDays[0]) return;
    const clone = (workoutDays[0].exercises || []).map((ex) => ({
      ...ex,
      id: newLocalId('ex'),
    }));
    setWorkoutDays((days) =>
      days.map((d, i) => (i === dayIndex ? { ...d, exercises: clone } : d)),
    );
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const toggleClient = (cid) => {
    setAssignedClients((prev) => (prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid]));
  };

  const validateStep1 = () => {
    if (!planName.trim()) {
      Alert.alert('Plan name', 'Please enter a plan name.');
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !workoutDays.length) {
      Alert.alert('Add days', 'Add at least one workout day.');
      return;
    }
    if (step === 3) {
      if (dayIndex < workoutDays.length - 1) {
        setDayIndex(dayIndex + 1);
        return;
      }
      setStep(4);
      return;
    }
    setStep((s) => s + 1);
  };

  const goBack = () => {
    if (step === 3 && dayIndex > 0) {
      setDayIndex(dayIndex - 1);
      return;
    }
    if (step <= 1) {
      onClose?.();
      return;
    }
    if (step === 4) {
      setStep(3);
      setDayIndex(Math.max(0, workoutDays.length - 1));
      return;
    }
    setStep((s) => Math.max(1, s - 1));
  };

  const persist = useCallback(
    async (doAssign) => {
      const draft = sanitizeManualDraftForFirestore({
        planName,
        planType,
        duration,
        description,
        workoutDays,
        assignedClients: doAssign ? assignedClients : [],
      });
      const totalEx = countExercisesAcrossDays(draft.workoutDays);
      if (totalEx < 1) {
        Alert.alert('Add exercises', 'Add at least one exercise before saving.');
        return;
      }
      if (!trainerId) {
        Alert.alert('Not signed in', 'Trainer ID missing.');
        return;
      }
      setSaving(true);
      try {
        const res = await saveManualPlanDraft(trainerId, draft, savedPlanId);
        if (!res.success) {
          Alert.alert('Save failed', res.error || 'Unknown error');
          return;
        }
        setSavedPlanId(res.planId);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Saved', doAssign && assignedClients.length ? 'Plan saved and assigned to selected clients.' : 'Plan saved.');
        setStep(5);
      } catch (e) {
        Alert.alert('Save failed', e?.message || 'Unknown error');
      } finally {
        setSaving(false);
      }
    },
    [planName, planType, duration, description, workoutDays, assignedClients, trainerId, savedPlanId],
  );

  const formatReps = (ex) => {
    if (ex.repMode === 'fixed') return `${ex.repsSingle} reps`;
    return `${ex.repsMin}-${ex.repsMax} reps`;
  };

  const formatRest = (sec) => {
    const seconds = Number(sec);
    if (!Number.isFinite(seconds) || seconds <= 0) return '—';
    if (seconds >= SECONDS_PER_MINUTE && seconds % SECONDS_PER_MINUTE === 0) return `${seconds / SECONDS_PER_MINUTE} min`;
    return `${seconds}s`;
  };

  const renderCoachHeader = () =>
    embedInLayout ? null : (
      <TopHeader
        title=""
        isDark={isDark}
        skipTopSafeInset
        onBack={goBack}
        onProfilePress={onProfilePress}
        onSettingsPress={onSettingsPress}
      />
    );

  if (loadingPlan) {
    return (
      <BuilderlightDarkMode.Provider value={themeValue}>
        <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]}>
          {renderCoachHeader()}
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={palette.pink} />
            <Text style={{ color: palette.textSecondary, marginTop: 12 }}>Loading plan…</Text>
          </View>
        </SafeAreaView>
      </BuilderlightDarkMode.Provider>
    );
  }

  const stepTitle =
    step === 1
      ? 'Plan setup'
      : step === 2
        ? 'Workout days'
        : step === 3
          ? `${workoutDays[dayIndex]?.dayName || 'Day'} · exercises`
          : step === 4
            ? 'Review & assign'
            : 'Done';

  const stepSubtitle =
    step === 1
      ? 'Name your plan and set the schedule shell'
      : step === 2
        ? `${workoutDays.length} training day${workoutDays.length !== 1 ? 's' : ''}`
        : step === 3
          ? `Day ${dayIndex + 1} of ${workoutDays.length}`
          : step === 4
            ? `${countExercisesAcrossDays(workoutDays)} exercises total`
            : null;

  const renderStepActions = () => {
    if (step === 5) {
      return (
        <View style={[styles.stepActionsWrap, { marginBottom: scrollBottomPad }]}>
          <PrimaryButton label="Done" onPress={() => onClose?.()} />
        </View>
      );
    }
    if (step === 1) {
      return (
        <View style={[styles.stepActionsWrap, styles.stepActionsTight, { marginBottom: scrollBottomPad }]}>
          <PrimaryButton label="Add exercises" onPress={goNext} />
        </View>
      );
    }
    if (step === 2) {
      return (
        <View style={[styles.stepActionsWrap, { marginBottom: scrollBottomPad }]}>
          <View style={styles.footerRow}>
            <SecondaryButton label="Back" onPress={goBack} compact />
            <PrimaryButton label="Add exercises" onPress={goNext} />
          </View>
        </View>
      );
    }
    if (step === 3) {
      return (
        <View style={[styles.stepActionsWrap, { marginBottom: scrollBottomPad }]}>
          <View style={styles.footerRow}>
            <SecondaryButton label="Back" onPress={goBack} compact />
            <PrimaryButton
              label={dayIndex < workoutDays.length - 1 ? 'Next day' : 'Review'}
              onPress={goNext}
            />
          </View>
        </View>
      );
    }
    if (step === 4) {
      return (
        <View style={[styles.stepActionsWrap, { marginBottom: scrollBottomPad }]}>
          <View style={styles.footerCol}>
            <PrimaryButton label="Save & assign" loading={saving} onPress={() => persist(true)} />
            <SecondaryButton label="Save for later" onPress={() => persist(false)} />
          </View>
        </View>
      );
    }
    return null;
  };

  return (
    <BuilderlightDarkMode.Provider value={themeValue}>
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={SHELL_SAFE_AREA_EDGES}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={80}
      >
        {renderCoachHeader()}
        <View style={[styles.stepHeading, { borderBottomColor: palette.topBarBorder }]}>
          <Text style={styles.topTitle} numberOfLines={1}>
            {step === 1 ? 'Build a plan' : stepTitle}
          </Text>
          {stepSubtitle && step < 5 ? (
            <Text style={styles.topSubtitle} numberOfLines={1}>
              {stepSubtitle}
            </Text>
          ) : null}
        </View>
        {step < 5 ? <PlanStepStrip step={step} /> : null}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollPad, { paddingBottom: scrollBottomPad }]}
          {...FORM_SCROLL_PROPS}
        >
          {step === 1 && (
            <>
              <SectionHeader title="Plan details" subtitle="Name your plan and set the schedule shell" />
              <GradientCard style={styles.setupHeroCard} innerStyle={styles.setupHeroInner}>
                <FieldLabel tight>Plan name *</FieldLabel>
                <View style={styles.setupField}>
                  <TextInput
                    style={styles.setupInput}
                    placeholder="e.g. Upper Body Strength · Week 1"
                    placeholderTextColor={palette.textTertiary}
                    value={planName}
                    onChangeText={setPlanName}
                  />
                </View>
                <FieldLabel tight>Plan type *</FieldLabel>
                <View style={styles.pillGrid}>
                  {PLAN_TYPES.map((p) => (
                    <Pill key={p} label={p} active={planType === p} onPress={() => setPlanType(p)} />
                  ))}
                </View>
                <FieldLabel tight>Duration *</FieldLabel>
                <View style={styles.pillGrid}>
                  {DURATIONS.map((p) => (
                    <Pill key={p} label={p} active={duration === p} onPress={() => setDuration(p)} />
                  ))}
                </View>
                <FieldLabel tight>Description (optional)</FieldLabel>
                <View style={[styles.setupField, styles.setupFieldMulti]}>
                  <TextInput
                    style={[styles.setupInput, styles.setupInputMulti]}
                    placeholder="Focus, equipment, coaching intent…"
                    placeholderTextColor={palette.textTertiary}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                  />
                </View>
              </GradientCard>
            </>
          )}

          {step === 2 && (
            <>
              <SectionHeader title="Your workout schedule" subtitle="Rename days or add more before adding exercises" />
              {workoutDays.map((d) => (
                <GradientCard key={d.id} style={{ marginBottom: 12 }}>
                  <View style={styles.dayCardRow}>
                    <View
                      style={[
                        styles.dayNumBadge,
                        { backgroundColor: palette.fill, borderColor: palette.border, borderWidth: nb.borderWidth },
                      ]}
                    >
                      <Text style={[styles.dayNumText, { color: palette.onFill }]}>{d.dayNumber}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <TextInput
                        style={styles.dayNameInput}
                        value={d.dayName}
                        onChangeText={(t) =>
                          setWorkoutDays((rows) => rows.map((r) => (r.id === d.id ? { ...r, dayName: t } : r)))
                        }
                        placeholder="Day name"
                        placeholderTextColor={palette.textTertiary}
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => removeDay(d.id)}
                      hitSlop={10}
                      style={[styles.dayRemove, { backgroundColor: palette.soft, borderColor: palette.border }]}
                    >
                      <Ionicons name="trash-outline" size={20} color={palette.textPrimary} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.dayMetaRow}>
                    <Ionicons name="barbell-outline" size={14} color={palette.textSecondary} />
                    <Text style={styles.dayMetaText}>
                      {(d.exercises || []).length} exercise{(d.exercises || []).length !== 1 ? 's' : ''} · added in next step
                    </Text>
                  </View>
                </GradientCard>
              ))}
              <View style={{ marginTop: 8 }}>
                <NbButton variant="ghost" onPress={addDay}>
                  Add workout day
                </NbButton>
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <SectionHeader
                title="Add exercises"
                subtitle={
                  workoutDays.length > 1
                    ? `${workoutDays[dayIndex]?.dayName || 'Day'} · ${(workoutDays[dayIndex]?.exercises || []).length} logged`
                    : `${(workoutDays[dayIndex]?.exercises || []).length} logged`
                }
              />
              {(workoutDays[dayIndex]?.exercises || []).length === 0 ? (
                <EmptyExerciseState onAdd={openAddModal} />
              ) : (
                (workoutDays[dayIndex]?.exercises || []).map((ex, idx) => {
                  const setRows = buildSetDetailRowsForExercise(ex);
                  return (
                  <GradientCard key={ex.id} style={{ marginBottom: 10 }}>
                    <View style={styles.exHeader}>
                      <View
                        style={[
                          styles.numBadge,
                          { backgroundColor: palette.fill, borderColor: palette.border, borderWidth: nb.borderWidth },
                        ]}
                      >
                        <Text style={[styles.numBadgeText, { color: palette.onFill }]}>{idx + 1}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.exName} numberOfLines={2}>
                          {ex.exerciseName}
                        </Text>
                        <Text style={styles.exMeta}>
                          {ex.sets} sets × {formatReps(ex)} · Rest {formatRest(ex.restSeconds)}
                        </Text>
                      </View>
                      <View style={styles.exActions}>
                        <TouchableOpacity onPress={() => moveExercise(ex.id, -1)} style={styles.exIconBtn}>
                          <Ionicons name="chevron-up" size={18} color={palette.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => moveExercise(ex.id, 1)} style={styles.exIconBtn}>
                          <Ionicons name="chevron-down" size={18} color={palette.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => openEditModal(ex)} style={styles.exIconBtn}>
                          <Ionicons name="create-outline" size={18} color={palette.textPrimary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => removeExercise(ex.id)} style={styles.exIconBtn}>
                          <Ionicons name="trash-outline" size={18} color={palette.textPrimary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {setRows.map((row, si) => (
                      <TouchableOpacity
                        key={`${ex.id}-set-${si}`}
                        onPress={() => openSetEdit(ex, si)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: 8,
                          paddingHorizontal: 4,
                          borderTopWidth: nb.borderWidthDivider,
                          borderTopColor: palette.border,
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={{ color: palette.textSecondary, fontSize: 13, flex: 1 }}>
                          Set {row.setNumber}: {row.reps} reps
                          {row.weight ? ` @ ${row.weight}` : ''} · Rest {formatRest(row.restSeconds)}
                        </Text>
                        <Ionicons name="pencil" size={16} color={palette.textPrimary} />
                      </TouchableOpacity>
                    ))}
                    {!!ex.notes ? <Text style={styles.exNotes}>{ex.notes}</Text> : null}
                  </GradientCard>
                  );
                })
              )}
              <View style={styles.exActionRow}>
                <NbButton variant="fill" onPress={openAddModal}>
                  Add exercise
                </NbButton>
                {dayIndex > 0 ? (
                  <NbButton variant="ghost" onPress={copyFromFirstDay}>
                    Copy day 1
                  </NbButton>
                ) : null}
              </View>
            </>
          )}

          {step === 4 && (
            <>
              <SectionHeader title="Plan summary" subtitle="Double-check before saving" />
              <GradientCard style={{ marginBottom: 16 }}>
                <Text style={styles.summaryName}>{planName || 'Untitled plan'}</Text>
                <Text style={styles.summaryMeta}>
                  {duration} · {planType}
                </Text>
                {!!description.trim() ? <Text style={styles.summaryDesc}>{description}</Text> : null}
                <TouchableOpacity
                  onPress={() => {
                    setStep(1);
                    setDayIndex(0);
                  }}
                  style={[styles.summaryEdit, { backgroundColor: palette.soft, borderColor: palette.border }]}
                  activeOpacity={0.85}
                >
                  <Ionicons name="pencil" size={14} color={palette.textPrimary} />
                  <Text style={[styles.summaryEditText, { color: palette.textPrimary }]}>Edit plan</Text>
                </TouchableOpacity>
              </GradientCard>
              {workoutDays.map((d) => (
                <View key={d.id} style={{ marginBottom: 14 }}>
                  <Text style={[styles.subHead, { color: palette.textTertiary }]}>
                    {String(d.dayName).toUpperCase()} · {(d.exercises || []).length} exercises
                  </Text>
                  {(d.exercises || []).map((ex, i) => (
                    <GradientCard key={ex.id} style={{ marginBottom: 8 }}>
                      <Text style={styles.exTitle}>
                        {i + 1}. {ex.exerciseName}
                      </Text>
                      <Text style={styles.exMeta}>
                        {ex.sets} sets × {formatReps(ex)} · Rest {formatRest(ex.restSeconds)}
                      </Text>
                    </GradientCard>
                  ))}
                </View>
              ))}
              <SectionHeader title="Assign to clients" subtitle="Optional — save without assigning anytime" />
              {(clients || []).length === 0 ? (
                <Text style={styles.caption}>No linked clients yet. You can still save for later.</Text>
              ) : (
                <View style={styles.clientGrid}>
                  {clients.map((clientRow) => {
                    const on = assignedClients.includes(clientRow.id);
                    return (
                      <TouchableOpacity key={clientRow.id} onPress={() => toggleClient(clientRow.id)} activeOpacity={0.88}>
                        <View
                          style={[
                            on ? styles.clientChipInnerOn : styles.clientChipOff,
                            {
                              backgroundColor: on ? palette.fill : palette.surface,
                              borderColor: palette.border,
                              borderWidth: nb.borderWidth,
                            },
                          ]}
                        >
                          <Ionicons
                            name={on ? 'checkmark-circle' : 'ellipse-outline'}
                            size={18}
                            color={on ? palette.onFill : palette.textTertiary}
                          />
                          <Text style={[on ? styles.clientChipTextOn : styles.clientChipTextOff, { color: on ? palette.onFill : palette.textSecondary }]}>
                            {clientRow.name || clientRow.displayName || clientRow.id}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          )}

          {step === 5 && (
            <View style={styles.doneWrap}>
              <View
                style={[
                  styles.doneIconRing,
                  { backgroundColor: palette.fill, borderColor: palette.border, borderWidth: nb.borderWidth },
                ]}
              >
                <Ionicons name="checkmark" size={40} color={palette.onFill} />
              </View>
              <Text style={styles.h2}>Plan saved</Text>
              <Text style={[styles.caption, styles.doneCaption]}>
                Assigned clients will see it in their workout library. Edit anytime from Custom plans.
              </Text>
            </View>
          )}

          {renderStepActions()}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          {/* Design Law sheet — grabber + 3px top border (PNG 21/23), no pink rim */}
          <View
            style={[
              styles.modalSheetBorder,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderTopWidth: nb.borderWidth,
                borderLeftWidth: nb.borderWidth,
                borderRightWidth: nb.borderWidth,
              },
            ]}
          >
            <View style={styles.modalCard}>
            <View style={[styles.modalHandle, { backgroundColor: palette.modalHandle }]} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editExerciseId ? 'Edit exercise' : 'Exercise library'}</Text>
              <TouchableOpacity
                onPress={() => { setModalOpen(false); resetModal(); }}
                style={[styles.modalClose, { borderColor: palette.border, borderWidth: nb.borderWidth }]}
              >
                <Ionicons name="close" size={22} color={palette.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: scrollBottomPad }}
              scrollEventThrottle={16}
              keyboardDismissMode="on-drag"
            >
            <FieldLabel>Search library</FieldLabel>
            <FormField style={{ marginBottom: 8 }}>
              <View style={styles.searchRow}>
                <Ionicons name="search" size={18} color={palette.textTertiary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Bench press, RDL, curls…"
                  placeholderTextColor={palette.textTertiary}
                  value={searchQ}
                  onChangeText={setSearchQ}
                />
              </View>
            </FormField>
            {searchResults.length > 0 ? (
              <View style={styles.suggestList}>
                {searchResults.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.suggestRow, pickedLibrary?.id === item.id && styles.suggestRowActive]}
                    onPress={() => {
                      setPickedLibrary(item);
                      setCustomName('');
                    }}
                  >
                    <Text style={styles.exTitle}>{item.name}</Text>
                    <Text style={styles.suggestMuscles}>{(item.muscleGroups || []).join(' · ')}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            <FieldLabel>Or custom name</FieldLabel>
            <FormField>
              <TextInput
                style={styles.inputBare}
                placeholder="Type any exercise name"
                placeholderTextColor={palette.textTertiary}
                value={customName}
                onChangeText={(t) => {
                  setCustomName(t);
                  if (t.trim()) setPickedLibrary(null);
                }}
              />
            </FormField>
            {(pickedLibrary || customName.trim()) && (
              <>
                <Text style={styles.label}>Sets</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => setSets((s) => Math.max(1, s - 1))}>
                    <Text style={styles.stepBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepVal}>{sets}</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => setSets((s) => Math.min(20, s + 1))}>
                    <Text style={styles.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.label}>Reps</Text>
                <View style={styles.row}>
                  <Pill label="Fixed" active={repMode === 'fixed'} onPress={() => setRepMode('fixed')} />
                  <Pill label="Range" active={repMode === 'range'} onPress={() => setRepMode('range')} />
                </View>
                {repMode === 'fixed' ? (
                  <View style={styles.stepper}>
                    <TouchableOpacity style={styles.stepBtn} onPress={() => setRepsSingle((n) => Math.max(1, n - 1))}>
                      <Text style={styles.stepBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.stepVal}>{repsSingle}</Text>
                    <TouchableOpacity style={styles.stepBtn} onPress={() => setRepsSingle((n) => Math.min(100, n + 1))}>
                      <Text style={styles.stepBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.caption}>Min</Text>
                      <View style={styles.stepper}>
                        <TouchableOpacity style={styles.stepBtn} onPress={() => setRepsMin((n) => Math.max(1, n - 1))}>
                          <Text style={styles.stepBtnText}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.stepVal}>{repsMin}</Text>
                        <TouchableOpacity style={styles.stepBtn} onPress={() => setRepsMin((n) => Math.min(100, n + 1))}>
                          <Text style={styles.stepBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.caption}>Max</Text>
                      <View style={styles.stepper}>
                        <TouchableOpacity style={styles.stepBtn} onPress={() => setRepsMax((n) => Math.max(1, n - 1))}>
                          <Text style={styles.stepBtnText}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.stepVal}>{repsMax}</Text>
                        <TouchableOpacity style={styles.stepBtn} onPress={() => setRepsMax((n) => Math.min(100, n + 1))}>
                          <Text style={styles.stepBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}
                <Text style={styles.label}>Rest between sets</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                  {REST_PRESETS.map((sec) => (
                    <Pill key={sec} label={formatRest(sec)} active={restSeconds === sec} onPress={() => setRestSeconds(sec)} />
                  ))}
                </ScrollView>
                <Text style={styles.label}>Tempo (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 3-1-1-1"
                  placeholderTextColor={palette.textTertiary}
                  value={tempo}
                  onChangeText={setTempo}
                />
                <Text style={styles.label}>Target load (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 185 lb"
                  placeholderTextColor={palette.textTertiary}
                  value={weight}
                  onChangeText={setWeight}
                />
                <Text style={styles.label}>Progression (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., +5 lb when all sets hit top of range"
                  placeholderTextColor={palette.textTertiary}
                  value={progression}
                  onChangeText={setProgression}
                />
                <Text style={styles.label}>Notes (optional)</Text>
                <TextInput
                  style={[styles.input, styles.inputMulti]}
                  placeholder="Coaching cues…"
                  placeholderTextColor={palette.textTertiary}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                />
              </>
            )}
            </ScrollView>
            <View style={styles.modalFooter}>
              <SecondaryButton label="Cancel" onPress={() => { setModalOpen(false); resetModal(); }} compact />
              <PrimaryButton
                label={editExerciseId ? 'Save exercise' : 'Add'}
                onPress={confirmModal}
              />
            </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={setEditOpen} animationType="fade" transparent onRequestClose={() => setSetEditOpen(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={80}
        >
          <Pressable style={{ flex: 1 }} onPress={() => setSetEditOpen(false)} />
          <View style={[styles.modalCard, { marginHorizontal: 16, marginBottom: 24, borderRadius: 16, padding: 16 }]}>
            <Text style={styles.modalTitle}>Edit set {setEditIndex + 1}</Text>
            <FieldLabel>Reps</FieldLabel>
            <FormField>
              <TextInput
                style={styles.inputBare}
                keyboardType="number-pad"
                value={setEditReps}
                onChangeText={setSetEditReps}
                placeholder="10"
                placeholderTextColor={palette.textTertiary}
              />
            </FormField>
            <FieldLabel>Weight</FieldLabel>
            <FormField>
              <TextInput
                style={styles.inputBare}
                value={setEditWeight}
                onChangeText={setSetEditWeight}
                placeholder="e.g. 185 lbs"
                placeholderTextColor={palette.textTertiary}
              />
            </FormField>
            <FieldLabel>Rest (seconds)</FieldLabel>
            <FormField>
              <TextInput
                style={styles.inputBare}
                keyboardType="number-pad"
                value={setEditRest}
                onChangeText={setSetEditRest}
                placeholder="120"
                placeholderTextColor={palette.textTertiary}
              />
            </FormField>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <SecondaryButton label="Cancel" onPress={() => setSetEditOpen(false)} />
              <PrimaryButton label="Save set" onPress={saveSetEdit} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
    </BuilderlightDarkMode.Provider>
  );
}

function createBuilderStyles(c) {
  return StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  scrollPad: { paddingHorizontal: 18, paddingTop: 8, flexGrow: 0 },
  stepHeading: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
    zIndex: 1,
    borderBottomWidth: nb.borderWidthDivider,
    borderBottomColor: c.topBarBorder,
  },
  topTitle: { color: c.textPrimary, fontSize: 25, fontWeight: '900', letterSpacing: -0.6 },
  topSubtitle: { color: c.textTertiary, fontSize: 13, fontWeight: '600', marginTop: 2 },
  // Manipulate here: capsule height / gap for step progress (PNG 19)
  stepStripShell: {
    marginHorizontal: 16,
    marginBottom: 14,
    paddingVertical: 10,
    zIndex: 1,
  },
  stepCapsulesRow: { flexDirection: 'row', gap: 8 },
  stepCapsule: {
    height: 10,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
  },
  stepStripMeta: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  sectionHeader: { marginTop: 8, marginBottom: 14 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: c.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
    marginBottom: 4,
  },
  sectionSubtitle: { fontSize: 15, color: c.textSecondary, fontWeight: '500', marginBottom: 8 },
  sectionUnderline: { height: 3, borderRadius: 2, width: 72, backgroundColor: c.fill },
  label: {
    fontSize: 12,
    fontWeight: '900',
    color: c.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
    marginBottom: 8,
    marginTop: 14,
  },
  labelTight: { marginTop: 10, marginBottom: 6 },
  formFieldShell: {
    borderRadius: borderRadius.nbInput || 8,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
  },
  fieldInner: { padding: 12 },
  fieldInnerCompact: { padding: 10 },
  setupHeroCard: { marginBottom: 4 },
  setupHeroInner: { padding: 18, overflow: 'hidden' },
  setupField: {
    borderRadius: 8,
    borderWidth: nb.borderWidth,
    borderColor: c.border,
    backgroundColor: c.setupFieldBg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 4,
  },
  setupFieldMulti: { minHeight: 100, paddingVertical: 10 },
  setupInput: {
    fontSize: 16,
    color: c.textPrimary,
    fontWeight: '600',
    padding: 0,
  },
  setupInputMulti: { minHeight: 80, textAlignVertical: 'top' },
  stepActionsWrap: {
    marginTop: 28,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.stepActionsBorder,
  },
  stepActionsTight: {
    marginTop: 22,
    paddingTop: 0,
    borderTopWidth: 0,
  },
  inputBare: {
    fontSize: 16,
    color: c.textPrimary,
    fontWeight: '600',
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  inputMulti: { minHeight: 96, textAlignVertical: 'top' },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: c.textPrimary,
    fontWeight: '500',
  },
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  pillRow: { flexDirection: 'row', gap: 8, paddingVertical: 4, flexWrap: 'wrap' },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    minHeight: nb.minTouchTarget,
    justifyContent: 'center',
  },
  pillText: { fontSize: 13, fontWeight: '700' },
  pillTextActive: { fontWeight: '900' },
  gradInner: {
    borderRadius: borderRadius.nbCard,
    backgroundColor: c.cardBg,
    padding: 14,
    overflow: 'hidden',
  },
  footerRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  footerCol: { gap: 10 },
  caption: { color: c.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 4 },
  h2: { color: c.textPrimary, fontSize: 24, fontWeight: '900', marginTop: 16, letterSpacing: -0.5 },
  subHead: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.3,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  dayCardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayNumBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumText: { fontWeight: '900', fontSize: 15 },
  dayNameInput: {
    fontSize: 17,
    fontWeight: '700',
    color: c.textPrimary,
    paddingVertical: 4,
  },
  dayRemove: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: nb.borderWidth,
  },
  dayMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  dayMetaText: { color: c.textTertiary, fontSize: 12, fontWeight: '600' },
  exHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  numBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numBadgeText: { fontWeight: '900', fontSize: 13 },
  exName: { color: c.textPrimary, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  exTitle: { color: c.textPrimary, fontSize: 15, fontWeight: '800' },
  exMeta: { color: c.textSecondary, fontSize: 13, marginTop: 4, fontWeight: '500' },
  exNotes: { color: c.textTertiary, fontSize: 12, fontStyle: 'italic', marginTop: 10, lineHeight: 17 },
  exActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  exIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.exIconBg,
  },
  exActionRow: { marginTop: 14, gap: 10 },
  emptyExWrap: { alignItems: 'center', paddingVertical: 8 },
  emptyExIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: nb.borderWidth,
  },
  emptyExTitle: { color: c.textPrimary, fontSize: 17, fontWeight: '800' },
  emptyExSub: { color: c.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  summaryName: { color: c.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  summaryMeta: { color: c.textSecondary, fontSize: 14, marginTop: 6, fontWeight: '600' },
  summaryDesc: { color: c.textTertiary, fontSize: 13, marginTop: 10, lineHeight: 19 },
  summaryEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: nb.borderWidth,
  },
  summaryEditText: { fontSize: 13, fontWeight: '800' },
  clientGrid: { gap: 10, marginBottom: 8 },
  clientChipInnerOn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: borderRadius.nbCard,
  },
  clientChipTextOn: { fontSize: 15, fontWeight: '700', flex: 1 },
  clientChipOff: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: borderRadius.nbCard,
  },
  clientChipTextOff: { fontSize: 15, fontWeight: '600', flex: 1 },
  doneWrap: { alignItems: 'center', paddingTop: 48, paddingBottom: 24 },
  doneIconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  doneCaption: { textAlign: 'center', paddingHorizontal: 24, marginTop: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheetBorder: {
    borderTopLeftRadius: borderRadius.nbSheet || 24,
    borderTopRightRadius: borderRadius.nbSheet || 24,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  modalCard: {
    backgroundColor: c.surface,
    borderTopLeftRadius: borderRadius.nbSheet || 24,
    borderTopRightRadius: borderRadius.nbSheet || 24,
    paddingHorizontal: 18,
    paddingBottom: 18,
    maxHeight: '100%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: { color: c.textPrimary, fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  modalClose: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.modalCloseBg,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: nb.borderWidthDivider,
    borderTopColor: c.divider,
    marginTop: 8,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, fontSize: 16, color: c.textPrimary, fontWeight: '600', paddingVertical: 2 },
  suggestList: {
    borderRadius: borderRadius.nbCard,
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: nb.borderWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  suggestRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: nb.borderWidthDivider,
    borderBottomColor: c.suggestRowBorder,
  },
  suggestRowActive: { backgroundColor: c.soft },
  suggestMuscles: { color: c.textTertiary, fontSize: 12, marginTop: 3, fontWeight: '500' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginVertical: 10,
    paddingVertical: 8,
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    borderColor: c.border,
    backgroundColor: c.stepperBg,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
  },
  stepBtnText: { color: c.textPrimary, fontSize: 22, fontWeight: '700' },
  stepVal: { color: c.textPrimary, fontSize: 20, fontWeight: '900', minWidth: 40, textAlign: 'center' },
  });
}
