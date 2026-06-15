/**
 * Manual Workout Plan Builder Screen
 *
 * Purpose: UI screen or component: Manual Workout Plan Builder Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: ManualWorkoutPlanBuilderScreen
 *
 * @file-header
 */
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../shared/ui/ThemeContext';
import CoachConnectHeader from '../../shared/components/shell/CoachConnectHeader';
import {
  newLocalId,
  saveManualPlanDraft,
  getManualWorkoutPlan,
  draftFromTrainerPlanDoc,
  searchExercisesForBuilder,
} from './manualWorkoutPlanService';

const GRAD_BORDER = ['#FF6B9D', '#C084FC', '#06B6D4'];
const GRAD_CTA = ['#FF6B9D', '#C084FC'];
const GRAD_CTA_ALT = ['#06B6D4', '#C084FC'];

const PLAN_TYPES = ['Upper Body', 'Lower Body', 'Full Body', 'Push/Pull/Legs', 'Custom'];
const DURATIONS = ['1 week', '2 weeks', '4 weeks', '8 weeks', '12 weeks', 'Ongoing'];
const REST_PRESETS = [60, 90, 120, 150, 180];

function getBuilderPalette(isDark) {
  const accents = {
    pink: '#FF6B9D',
    orange: '#F97316',
    cyan: '#06B6D4',
    purple: '#C084FC',
    green: '#10B981',
  };
  if (isDark) {
    return {
      ...accents,
      bg: '#0A0A0F',
      surface: '#13131A',
      cardBg: '#0E0C16',
      textPrimary: '#FFFFFF',
      textSecondary: 'rgba(255,255,255,0.68)',
      textTertiary: 'rgba(255,255,255,0.42)',
      border: 'rgba(255,255,255,0.1)',
      borderSubtle: 'rgba(255,255,255,0.08)',
      borderStrong: 'rgba(255,255,255,0.14)',
      stripBg: 'rgba(255,255,255,0.035)',
      stripBorder: 'rgba(255,255,255,0.07)',
      stepDotBg: 'rgba(255,255,255,0.08)',
      stepDotBorder: 'rgba(255,255,255,0.12)',
      stepConnector: 'rgba(255,255,255,0.1)',
      stepLabelDone: 'rgba(255,255,255,0.72)',
      topGlow: ['rgba(255,107,157,0.14)', 'rgba(192,132,252,0.06)', 'transparent'],
      cardGlow: ['rgba(255,107,157,0.06)', 'transparent'],
      setupFieldBg: 'rgba(0,0,0,0.25)',
      pillBg: 'rgba(255,255,255,0.04)',
      pillBorder: 'rgba(255,255,255,0.14)',
      exIconBg: 'rgba(255,255,255,0.05)',
      clientChipOffBg: 'rgba(255,255,255,0.03)',
      clientChipOffBorder: 'rgba(255,255,255,0.1)',
      modalHandle: 'rgba(255,255,255,0.2)',
      modalCloseBg: 'rgba(255,255,255,0.06)',
      divider: 'rgba(255,255,255,0.1)',
      stepActionsBorder: 'rgba(255,255,255,0.08)',
      topBarBorder: 'rgba(255,255,255,0.08)',
      secondaryBtnBg: 'rgba(255,107,157,0.08)',
      secondaryBtnBorder: 'rgba(255,107,157,0.55)',
      shadowPink: '#FF6B9D',
      suggestRowBorder: 'rgba(255,255,255,0.06)',
      stepperBg: 'rgba(255,255,255,0.04)',
    };
  }
  return {
    ...accents,
    bg: '#F2F2F7',
    surface: '#FFFFFF',
    cardBg: '#FFFFFF',
    textPrimary: '#1C1C1E',
    textSecondary: '#48484A',
    textTertiary: '#8E8E93',
    border: 'rgba(0,0,0,0.1)',
    borderSubtle: 'rgba(0,0,0,0.06)',
    borderStrong: 'rgba(0,0,0,0.12)',
    stripBg: '#FFFFFF',
    stripBorder: 'rgba(0,0,0,0.08)',
    stepDotBg: '#F2F2F7',
    stepDotBorder: 'rgba(0,0,0,0.1)',
    stepConnector: 'rgba(0,0,0,0.08)',
    stepLabelDone: '#48484A',
    topGlow: ['rgba(255,107,157,0.1)', 'rgba(192,132,252,0.05)', 'transparent'],
    cardGlow: ['rgba(255,107,157,0.05)', 'transparent'],
    setupFieldBg: '#F9F9FB',
    pillBg: '#F2F2F7',
    pillBorder: 'rgba(0,0,0,0.1)',
    exIconBg: 'rgba(0,0,0,0.04)',
    clientChipOffBg: '#FFFFFF',
    clientChipOffBorder: 'rgba(0,0,0,0.1)',
    modalHandle: 'rgba(0,0,0,0.15)',
    modalCloseBg: 'rgba(0,0,0,0.05)',
    divider: 'rgba(0,0,0,0.08)',
    stepActionsBorder: 'rgba(0,0,0,0.08)',
    topBarBorder: 'rgba(0,0,0,0.08)',
    secondaryBtnBg: 'rgba(255,107,157,0.1)',
    secondaryBtnBorder: 'rgba(255,107,157,0.45)',
    shadowPink: 'rgba(255,107,157,0.4)',
    suggestRowBorder: 'rgba(0,0,0,0.06)',
    stepperBg: '#F2F2F7',
  };
}

const BuilderThemeContext = React.createContext(null);

function useBuilderTheme() {
  const ctx = useContext(BuilderThemeContext);
  if (!ctx) throw new Error('useBuilderTheme must be used within BuilderThemeContext.Provider');
  return ctx;
}

function SectionHeader({ title, subtitle }) {
  const { styles } = useBuilderTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      <LinearGradient colors={GRAD_BORDER} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.sectionUnderline} />
    </View>
  );
}

function PlanStepStrip({ step }) {
  const { styles } = useBuilderTheme();
  if (step >= 5) return null;
  const items = [
    { id: 1, label: 'Setup' },
    { id: 2, label: 'Days' },
    { id: 3, label: 'Moves' },
    { id: 4, label: 'Review' },
  ];
  return (
    <View style={styles.stepStripShell}>
    <View style={styles.stepStripWrap}>
      <View style={styles.stepStripTrack}>
        {items.map(({ id }, idx) => {
          const active = step === id;
          const done = step > id;
          const isLast = idx === items.length - 1;
          return (
            <React.Fragment key={id}>
              {active ? (
                <LinearGradient colors={GRAD_CTA} style={styles.stepDotGrad}>
                  <Text style={styles.stepDotText}>{id}</Text>
                </LinearGradient>
              ) : (
                <View style={[styles.stepDot, done && styles.stepDotDone]}>
                  {done ? (
                    <Ionicons name="checkmark" size={14} color="#FFF" />
                  ) : (
                    <Text style={styles.stepDotTextMuted}>{id}</Text>
                  )}
                </View>
              )}
              {!isLast ? (
                <View style={[styles.stepConnector, step > id && styles.stepConnectorDone]} />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>
      <View style={styles.stepStripLabels}>
        {items.map(({ id, label }) => {
          const active = step === id;
          const done = step > id;
          return (
            <Text
              key={id}
              style={[styles.stepStripLabel, active && styles.stepStripLabelActive, done && styles.stepStripLabelDone]}
              numberOfLines={1}
            >
              {label}
            </Text>
          );
        })}
      </View>
    </View>
    </View>
  );
}

function GradientCard({ children, borderColors = GRAD_BORDER, style, innerStyle }) {
  const { c, styles } = useBuilderTheme();
  return (
    <LinearGradient colors={borderColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.gradBorder, style]}>
      <View style={[styles.gradInner, innerStyle]}>
        <LinearGradient colors={c.cardGlow} style={styles.gradInnerGlow} pointerEvents="none" />
        {children}
      </View>
    </LinearGradient>
  );
}

function FieldLabel({ children, tight }) {
  const { styles } = useBuilderTheme();
  return <Text style={[styles.label, tight && styles.labelTight]}>{children}</Text>;
}

function FormField({ children, style, compact }) {
  const { styles } = useBuilderTheme();
  return (
    <GradientCard
      borderColors={['rgba(255,107,157,0.55)', 'rgba(192,132,252,0.35)']}
      style={[{ marginTop: 0 }, style]}
      innerStyle={[styles.fieldInner, compact && styles.fieldInnerCompact]}
    >
      {children}
    </GradientCard>
  );
}

function PrimaryButton({ label, onPress, disabled, loading, compact, icon }) {
  const { styles } = useBuilderTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [{ flex: compact ? 0 : 1, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      <LinearGradient colors={GRAD_CTA} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.primaryGrad, compact && styles.primaryGradCompact]}>
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <View style={styles.primaryInner}>
            {icon ? <Ionicons name={icon} size={18} color="#FFF" /> : null}
            <Text style={styles.primaryLabel}>{label}</Text>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress, compact, icon }) {
  const { c, styles } = useBuilderTheme();
  return (
    <TouchableOpacity onPress={onPress} style={[styles.secondaryBtn, compact && styles.secondaryBtnCompact]} activeOpacity={0.85}>
      {icon ? <Ionicons name={icon} size={16} color={c.pink} /> : null}
      <Text style={styles.secondaryLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function Pill({ label, active, onPress }) {
  const { styles } = useBuilderTheme();
  if (active) {
    return (
      <Pressable onPress={onPress}>
        <LinearGradient colors={['rgba(255,107,157,0.9)', 'rgba(192,132,252,0.85)']} style={styles.pillGradBorder}>
          <View style={styles.pillGradInner}>
            <Text style={styles.pillTextActive}>{label}</Text>
          </View>
        </LinearGradient>
      </Pressable>
    );
  }
  return (
    <TouchableOpacity onPress={onPress} style={styles.pill} activeOpacity={0.85}>
      <Text style={styles.pillText}>{label}</Text>
    </TouchableOpacity>
  );
}

function EmptyExerciseState({ onAdd }) {
  const { c, styles } = useBuilderTheme();
  return (
    <GradientCard borderColors={GRAD_CTA_ALT} style={{ marginTop: 8 }}>
      <View style={styles.emptyExWrap}>
        <View style={styles.emptyExIcon}>
          <Ionicons name="barbell-outline" size={28} color={c.cyan} />
        </View>
        <Text style={styles.emptyExTitle}>No exercises yet</Text>
        <Text style={styles.emptyExSub}>Search the library or type a custom movement.</Text>
        <TouchableOpacity onPress={onAdd} activeOpacity={0.88} style={{ marginTop: 14, width: '100%' }}>
          <LinearGradient colors={GRAD_CTA_ALT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.emptyExBtn}>
            <Ionicons name="add" size={18} color="#FFF" />
            <Text style={styles.emptyExBtnText}>Add first exercise</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </GradientCard>
  );
}

const defaultWorkoutDays = () => [
  { id: newLocalId('day'), dayName: 'Monday', dayNumber: 1, exercises: [] },
  { id: newLocalId('day'), dayName: 'Wednesday', dayNumber: 2, exercises: [] },
  { id: newLocalId('day'), dayName: 'Friday', dayNumber: 3, exercises: [] },
];

function sanitizeDraftForSave(state) {
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

function exerciseCounts(days) {
  return (days || []).reduce((acc, d) => acc + (d.exercises?.length || 0), 0);
}

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
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const c = useMemo(() => getBuilderPalette(isDark), [isDark]);
  const styles = useMemo(() => createBuilderStyles(c), [c]);
  const themeValue = useMemo(() => ({ c, styles }), [c, styles]);
  const scrollBottomPad = Math.max(insets.bottom, 16) + 20;

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

  const searchResults = useMemo(() => searchExercisesForBuilder(searchQ, 20), [searchQ]);

  useEffect(() => {
    if (!editPlanId || !trainerId) return;
    let cancelled = false;
    (async () => {
      setLoadingPlan(true);
      try {
        const doc = await getManualWorkoutPlan(trainerId, editPlanId);
        if (cancelled || !doc) return;
        const d = draftFromTrainerPlanDoc(doc);
        if (!d) return;
        setPlanName(d.planName);
        setPlanType(d.planType || 'Custom');
        setDuration(d.duration || '4 weeks');
        setDescription(d.description || '');
        setWorkoutDays(
          (d.workoutDays && d.workoutDays.length
            ? d.workoutDays
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
        setAssignedClients(d.assignedClients?.length ? d.assignedClients : [...(defaultAssignedClientIds || [])]);
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
        const t = list[idx];
        list[idx] = list[j];
        list[j] = t;
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
      const draft = sanitizeDraftForSave({
        planName,
        planType,
        duration,
        description,
        workoutDays,
        assignedClients: doAssign ? assignedClients : [],
      });
      const totalEx = exerciseCounts(draft.workoutDays);
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
    const s = Number(sec);
    if (!Number.isFinite(s) || s <= 0) return '—';
    if (s >= 60 && s % 60 === 0) return `${s / 60} min`;
    return `${s}s`;
  };

  const renderCoachHeader = () =>
    embedInLayout ? null : (
      <CoachConnectHeader
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
      <BuilderThemeContext.Provider value={themeValue}>
        <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
          {renderCoachHeader()}
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={c.pink} />
            <Text style={{ color: c.textSecondary, marginTop: 12 }}>Loading plan…</Text>
          </View>
        </SafeAreaView>
      </BuilderThemeContext.Provider>
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
            ? `${exerciseCounts(workoutDays)} exercises total`
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
          <PrimaryButton label="Continue" onPress={goNext} />
        </View>
      );
    }
    if (step === 2) {
      return (
        <View style={[styles.stepActionsWrap, { marginBottom: scrollBottomPad }]}>
          <View style={styles.footerRow}>
            <SecondaryButton label="Back" onPress={goBack} compact />
            <PrimaryButton label="Continue" onPress={goNext} />
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
    <BuilderThemeContext.Provider value={themeValue}>
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <LinearGradient colors={c.topGlow} style={styles.topGlow} pointerEvents="none" />
        {renderCoachHeader()}
        <View style={styles.stepHeading}>
          <Text style={styles.topTitle} numberOfLines={1}>
            {stepTitle}
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
          contentContainerStyle={styles.scrollPad}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 && (
            <>
              <SectionHeader title="Plan details" subtitle="Basics only — exercises come in the next steps" />
              <GradientCard borderColors={GRAD_CTA_ALT} style={styles.setupHeroCard} innerStyle={styles.setupHeroInner}>
                <View style={styles.tipRow}>
                  <View style={styles.tipIcon}>
                    <Ionicons name="sparkles-outline" size={18} color={c.cyan} />
                  </View>
                  <Text style={styles.tipText}>
                    You’ll add training days next, then stack exercises with sets, reps, and rest — like building a real session.
                  </Text>
                </View>
                <View style={styles.setupDivider} />
                <FieldLabel tight>Plan name *</FieldLabel>
                <View style={styles.setupField}>
                  <TextInput
                    style={styles.setupInput}
                    placeholder="e.g. Upper Body Strength · Week 1"
                    placeholderTextColor={c.textTertiary}
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
                    placeholderTextColor={c.textTertiary}
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
                    <LinearGradient colors={GRAD_CTA} style={styles.dayNumBadge}>
                      <Text style={styles.dayNumText}>{d.dayNumber}</Text>
                    </LinearGradient>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <TextInput
                        style={styles.dayNameInput}
                        value={d.dayName}
                        onChangeText={(t) =>
                          setWorkoutDays((rows) => rows.map((r) => (r.id === d.id ? { ...r, dayName: t } : r)))
                        }
                        placeholder="Day name"
                        placeholderTextColor={c.textTertiary}
                      />
                    </View>
                    <TouchableOpacity onPress={() => removeDay(d.id)} hitSlop={10} style={styles.dayRemove}>
                      <Ionicons name="trash-outline" size={20} color={c.pink} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.dayMetaRow}>
                    <Ionicons name="barbell-outline" size={14} color={c.cyan} />
                    <Text style={styles.dayMetaText}>
                      {(d.exercises || []).length} exercise{(d.exercises || []).length !== 1 ? 's' : ''} · added in next step
                    </Text>
                  </View>
                </GradientCard>
              ))}
              <TouchableOpacity onPress={addDay} activeOpacity={0.88} style={{ marginTop: 4 }}>
                <LinearGradient colors={['rgba(255,107,157,0.35)', 'rgba(6,182,212,0.25)']} style={styles.addDayBorder}>
                  <View style={styles.addDayInner}>
                    <Ionicons name="add-circle-outline" size={20} color={c.pink} />
                    <Text style={styles.addDayText}>Add workout day</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
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
                (workoutDays[dayIndex]?.exercises || []).map((ex, idx) => (
                  <GradientCard key={ex.id} borderColors={GRAD_BORDER} style={{ marginBottom: 10 }}>
                    <View style={styles.exHeader}>
                      <LinearGradient colors={GRAD_CTA} style={styles.numBadge}>
                        <Text style={styles.numBadgeText}>{idx + 1}</Text>
                      </LinearGradient>
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
                          <Ionicons name="chevron-up" size={18} color={c.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => moveExercise(ex.id, 1)} style={styles.exIconBtn}>
                          <Ionicons name="chevron-down" size={18} color={c.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => openEditModal(ex)} style={styles.exIconBtn}>
                          <Ionicons name="create-outline" size={18} color={c.pink} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => removeExercise(ex.id)} style={styles.exIconBtn}>
                          <Ionicons name="trash-outline" size={18} color={c.pink} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {!!ex.notes ? <Text style={styles.exNotes}>{ex.notes}</Text> : null}
                  </GradientCard>
                ))
              )}
              <View style={styles.exActionRow}>
                <TouchableOpacity onPress={openAddModal} activeOpacity={0.88} style={{ flex: 1 }}>
                  <LinearGradient colors={GRAD_CTA} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.inlineCta}>
                    <Ionicons name="add" size={18} color="#FFF" />
                    <Text style={styles.inlineCtaText}>Add exercise</Text>
                  </LinearGradient>
                </TouchableOpacity>
                {dayIndex > 0 ? (
                  <TouchableOpacity onPress={copyFromFirstDay} style={styles.copyDayBtn} activeOpacity={0.85}>
                    <Ionicons name="copy-outline" size={16} color={c.cyan} />
                    <Text style={styles.copyDayText}>Copy day 1</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </>
          )}

          {step === 4 && (
            <>
              <SectionHeader title="Plan summary" subtitle="Double-check before saving" />
              <GradientCard borderColors={['#FF6B9D', '#F97316']} style={{ marginBottom: 16 }}>
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
                  style={styles.summaryEdit}
                  activeOpacity={0.85}
                >
                  <Ionicons name="pencil" size={14} color={c.pink} />
                  <Text style={styles.summaryEditText}>Edit plan</Text>
                </TouchableOpacity>
              </GradientCard>
              {workoutDays.map((d) => (
                <View key={d.id} style={{ marginBottom: 14 }}>
                  <Text style={styles.subHead}>
                    {String(d.dayName).toUpperCase()} · {(d.exercises || []).length} exercises
                  </Text>
                  {(d.exercises || []).map((ex, i) => (
                    <GradientCard key={ex.id} style={{ marginBottom: 8 }} borderColors={GRAD_BORDER}>
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
                  {clients.map((c) => {
                    const on = assignedClients.includes(c.id);
                    return (
                      <TouchableOpacity key={c.id} onPress={() => toggleClient(c.id)} activeOpacity={0.88}>
                        {on ? (
                          <LinearGradient colors={GRAD_CTA} style={styles.clientChipBorder}>
                            <View style={styles.clientChipInnerOn}>
                              <Ionicons name="checkmark-circle" size={18} color={c.pink} />
                              <Text style={styles.clientChipTextOn}>{c.name || c.displayName || c.id}</Text>
                            </View>
                          </LinearGradient>
                        ) : (
                          <View style={styles.clientChipOff}>
                            <Ionicons name="ellipse-outline" size={18} color={c.textTertiary} />
                            <Text style={styles.clientChipTextOff}>{c.name || c.displayName || c.id}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          )}

          {step === 5 && (
            <View style={styles.doneWrap}>
              <LinearGradient colors={GRAD_CTA} style={styles.doneIconRing}>
                <Ionicons name="checkmark" size={40} color="#FFF" />
              </LinearGradient>
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
          <LinearGradient colors={GRAD_BORDER} style={styles.modalSheetBorder}>
            <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editExerciseId ? 'Edit exercise' : 'Add exercise'}</Text>
              <TouchableOpacity onPress={() => { setModalOpen(false); resetModal(); }} style={styles.modalClose}>
                <Ionicons name="close" size={22} color={c.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <FieldLabel>Search library</FieldLabel>
            <FormField style={{ marginBottom: 8 }}>
              <View style={styles.searchRow}>
                <Ionicons name="search" size={18} color={c.textTertiary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Bench press, RDL, curls…"
                  placeholderTextColor={c.textTertiary}
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
                placeholderTextColor={c.textTertiary}
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
                  placeholderTextColor={c.textTertiary}
                  value={tempo}
                  onChangeText={setTempo}
                />
                <Text style={styles.label}>Target load (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 185 lb"
                  placeholderTextColor={c.textTertiary}
                  value={weight}
                  onChangeText={setWeight}
                />
                <Text style={styles.label}>Progression (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., +5 lb when all sets hit top of range"
                  placeholderTextColor={c.textTertiary}
                  value={progression}
                  onChangeText={setProgression}
                />
                <Text style={styles.label}>Notes (optional)</Text>
                <TextInput
                  style={[styles.input, styles.inputMulti]}
                  placeholder="Coaching cues…"
                  placeholderTextColor={c.textTertiary}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                />
              </>
            )}
            </ScrollView>
            <View style={styles.modalFooter}>
              <SecondaryButton label="Cancel" onPress={() => { setModalOpen(false); resetModal(); }} compact />
              <PrimaryButton label={editExerciseId ? 'Save' : 'Add'} onPress={confirmModal} icon="checkmark" />
            </View>
            </View>
          </LinearGradient>
        </View>
      </Modal>
    </SafeAreaView>
    </BuilderThemeContext.Provider>
  );
}

function createBuilderStyles(c) {
  return StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  scrollPad: { paddingHorizontal: 18, paddingTop: 8, flexGrow: 0 },
  topGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 140, zIndex: 0 },
  stepHeading: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 10,
    zIndex: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.topBarBorder,
  },
  topTitle: { color: c.textPrimary, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  topSubtitle: { color: c.textTertiary, fontSize: 12, fontWeight: '600', marginTop: 2 },
  stepStripShell: {
    marginHorizontal: 18,
    marginBottom: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: c.stripBg,
    borderWidth: 1,
    borderColor: c.stripBorder,
    zIndex: 1,
  },
  stepStripWrap: {
    paddingHorizontal: 4,
    paddingBottom: 0,
  },
  stepStripTrack: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  stepStripLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 10,
  },
  stepDotGrad: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.stepDotBg,
    borderWidth: 1,
    borderColor: c.stepDotBorder,
  },
  stepDotDone: { backgroundColor: 'rgba(16,185,129,0.25)', borderColor: 'rgba(16,185,129,0.5)' },
  stepDotText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  stepDotTextMuted: { color: c.textTertiary, fontSize: 12, fontWeight: '700' },
  stepConnector: {
    flex: 1,
    height: 2,
    marginHorizontal: 6,
    backgroundColor: c.stepConnector,
    borderRadius: 1,
    minWidth: 12,
  },
  stepConnectorDone: { backgroundColor: 'rgba(192,132,252,0.55)' },
  stepStripLabel: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '700', color: c.textTertiary },
  stepStripLabelActive: { color: c.textPrimary },
  stepStripLabelDone: { color: c.stepLabelDone },
  sectionHeader: { marginTop: 8, marginBottom: 14 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: c.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    marginBottom: 4,
  },
  sectionSubtitle: { fontSize: 13, color: c.textSecondary, fontWeight: '500', marginBottom: 8 },
  sectionUnderline: { height: 3, borderRadius: 2, width: 72 },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: c.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 14,
  },
  labelTight: { marginTop: 10, marginBottom: 6 },
  fieldInner: { padding: 12 },
  fieldInnerCompact: { padding: 10 },
  setupHeroCard: { marginBottom: 4 },
  setupHeroInner: { padding: 18, overflow: 'hidden' },
  setupDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.divider,
    marginVertical: 16,
  },
  setupField: {
    borderRadius: 12,
    borderWidth: 1,
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
    borderWidth: 1,
    borderColor: c.pillBorder,
    backgroundColor: c.pillBg,
  },
  pillGradBorder: { borderRadius: 999, padding: 1.5 },
  pillGradInner: {
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 13,
    backgroundColor: c.cardBg,
  },
  pillText: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: c.textPrimary, fontSize: 13, fontWeight: '800' },
  gradBorder: { borderRadius: 18, padding: 1.5, marginTop: 0 },
  gradInner: {
    borderRadius: 16,
    backgroundColor: c.cardBg,
    padding: 16,
    overflow: 'hidden',
  },
  gradInnerGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 72,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(6,182,212,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: { flex: 1, color: c.textSecondary, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  primaryGrad: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    shadowColor: c.shadowPink,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  primaryGradCompact: { minHeight: 48, paddingVertical: 12 },
  primaryInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryLabel: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: c.secondaryBtnBorder,
    backgroundColor: c.secondaryBtnBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    minHeight: 52,
    alignSelf: 'stretch',
  },
  secondaryBtnCompact: { minHeight: 48, paddingVertical: 12, flex: 0.36 },
  secondaryLabel: { color: c.pink, fontSize: 14, fontWeight: '800' },
  footerRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  footerCol: { gap: 10 },
  caption: { color: c.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 4 },
  h2: { color: c.textPrimary, fontSize: 24, fontWeight: '900', marginTop: 16, letterSpacing: -0.5 },
  subHead: {
    color: c.pink,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
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
  dayNumText: { color: '#FFF', fontWeight: '900', fontSize: 15 },
  dayNameInput: {
    fontSize: 17,
    fontWeight: '700',
    color: c.textPrimary,
    paddingVertical: 4,
  },
  dayRemove: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,107,157,0.1)',
  },
  dayMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  dayMetaText: { color: c.textTertiary, fontSize: 12, fontWeight: '600' },
  addDayBorder: { borderRadius: 14, padding: 1.5, marginTop: 8 },
  addDayInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12.5,
    backgroundColor: c.cardBg,
  },
  addDayText: { color: c.pink, fontSize: 14, fontWeight: '800' },
  exHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  numBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numBadgeText: { color: '#FFF', fontWeight: '900', fontSize: 13 },
  exName: { color: c.textPrimary, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  exTitle: { color: c.textPrimary, fontSize: 15, fontWeight: '800' },
  exMeta: { color: c.textSecondary, fontSize: 13, marginTop: 4, fontWeight: '500' },
  exNotes: { color: c.textTertiary, fontSize: 12, fontStyle: 'italic', marginTop: 10, lineHeight: 17 },
  exActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  exIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.exIconBg,
  },
  exActionRow: { marginTop: 14, gap: 10 },
  inlineCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  inlineCtaText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  copyDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.35)',
    backgroundColor: 'rgba(6,182,212,0.08)',
  },
  copyDayText: { color: c.cyan, fontSize: 13, fontWeight: '700' },
  emptyExWrap: { alignItems: 'center', paddingVertical: 8 },
  emptyExIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(6,182,212,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyExTitle: { color: c.textPrimary, fontSize: 17, fontWeight: '800' },
  emptyExSub: { color: c.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  emptyExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  emptyExBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
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
    backgroundColor: 'rgba(255,107,157,0.12)',
  },
  summaryEditText: { color: c.pink, fontSize: 13, fontWeight: '800' },
  clientGrid: { gap: 10, marginBottom: 8 },
  clientChipBorder: { borderRadius: 14, padding: 1.5 },
  clientChipInnerOn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12.5,
    backgroundColor: c.cardBg,
  },
  clientChipTextOn: { color: c.textPrimary, fontSize: 15, fontWeight: '700', flex: 1 },
  clientChipOff: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.clientChipOffBorder,
    backgroundColor: c.clientChipOffBg,
  },
  clientChipTextOff: { color: c.textSecondary, fontSize: 15, fontWeight: '600', flex: 1 },
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
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalSheetBorder: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 1.5,
    maxHeight: '92%',
  },
  modalCard: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingBottom: 18,
    maxHeight: '100%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.modalHandle,
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
    width: 40,
    height: 40,
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.divider,
    marginTop: 8,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, fontSize: 16, color: c.textPrimary, fontWeight: '600', paddingVertical: 2 },
  suggestList: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: c.borderSubtle,
    backgroundColor: c.surface,
  },
  suggestRow: { paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.suggestRowBorder },
  suggestRowActive: { backgroundColor: 'rgba(255,107,157,0.12)' },
  suggestMuscles: { color: c.textTertiary, fontSize: 12, marginTop: 3, fontWeight: '500' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginVertical: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: c.stepperBg,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.stepDotBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
  },
  stepBtnText: { color: c.textPrimary, fontSize: 22, fontWeight: '700' },
  stepVal: { color: c.textPrimary, fontSize: 20, fontWeight: '900', minWidth: 40, textAlign: 'center' },
  });
}
