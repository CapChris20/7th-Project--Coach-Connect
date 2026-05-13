import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../shared/ui/ThemeContext';
import {
  newLocalId,
  saveManualPlanDraft,
  getManualWorkoutPlan,
  draftFromTrainerPlanDoc,
  searchExercisesForBuilder,
} from '../services/manualWorkoutPlanService';

const COLORS = {
  bg: '#0A0A0F',
  cardBg: '#141419',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.65)',
  textTertiary: 'rgba(255,255,255,0.4)',
  pink: '#DB7093',
  orange: '#D9773A',
  cyan: '#06B6D4',
  purple: '#A78BFA',
  green: '#10B981',
};

const PLAN_TYPES = ['Upper Body', 'Lower Body', 'Full Body', 'Push/Pull/Legs', 'Custom'];
const DURATIONS = ['1 week', '2 weeks', '4 weeks', '8 weeks', '12 weeks', 'Ongoing'];
const REST_PRESETS = [60, 90, 120, 150, 180];

function SectionHeader({ title }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <LinearGradient
        colors={[COLORS.purple, COLORS.pink]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.sectionUnderline}
      />
    </View>
  );
}

function PlanStepStrip({ step }) {
  if (step >= 5) return null;
  const items = [
    { id: 1, label: 'Setup' },
    { id: 2, label: 'Days' },
    { id: 3, label: 'Moves' },
    { id: 4, label: 'Review' },
  ];
  return (
    <View style={styles.stepStripWrap}>
      {items.map(({ id, label }) => {
        const active = step === id;
        const done = step > id;
        return (
          <View key={id} style={styles.stepStripItem}>
            <Text
              style={[
                styles.stepStripLabel,
                { color: active ? '#F5F3FF' : done ? 'rgba(221,214,254,0.85)' : 'rgba(255,255,255,0.32)' },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
            <View
              style={[
                styles.stepStripBar,
                { backgroundColor: active || done ? 'rgba(167,139,250,0.85)' : 'rgba(255,255,255,0.08)' },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

function GradientCard({ children, borderColors = [COLORS.cyan, COLORS.purple], style }) {
  return (
    <LinearGradient colors={borderColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.gradBorder, style]}>
      <View style={styles.gradInner}>{children}</View>
    </LinearGradient>
  );
}

function PrimaryButton({ label, onPress, disabled, loading }) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
      <LinearGradient colors={[COLORS.purple, COLORS.pink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryGrad}>
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.primaryLabel}>{label}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.secondaryBtn} activeOpacity={0.85}>
      <Text style={styles.secondaryLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function Pill({ label, active, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.pill, active && styles.pillActive]}
      activeOpacity={0.85}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
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
}) {
  const { isDark } = useTheme();
  const bg = isDark ? COLORS.bg : '#F3F4F6';

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

  if (loadingPlan) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: bg, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.pink} />
        <Text style={{ color: COLORS.textSecondary, marginTop: 12 }}>Loading plan…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={goBack} hitSlop={12} style={styles.backHit}>
            <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>
            {step === 1 && 'Plan setup'}
            {step === 2 && 'Workout days'}
            {step === 3 && `${workoutDays[dayIndex]?.dayName || 'Day'} — exercises`}
            {step === 4 && 'Review & assign'}
            {step === 5 && 'Done'}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        {step < 5 ? <PlanStepStrip step={step} /> : null}

        <ScrollView contentContainerStyle={styles.scrollPad} keyboardShouldPersistTaps="handled">
          {step === 1 && (
            <>
              <SectionHeader title="Plan details" />
              <View style={styles.planExplainer}>
                <Ionicons name="information-circle-outline" size={18} color={COLORS.purple} style={{ marginRight: 8, marginTop: 2 }} />
                <Text style={styles.planExplainerText}>
                  Step 1 is only the plan shell. Next you’ll set training days, then add multiple exercises per day (sets, reps, rest) — same structure as logging several movements in one session.
                </Text>
              </View>
              <Text style={styles.label}>Plan name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Upper Body Strength - Week 1"
                placeholderTextColor={COLORS.textTertiary}
                value={planName}
                onChangeText={setPlanName}
              />
              <Text style={styles.label}>Plan type *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                {PLAN_TYPES.map((p) => (
                  <Pill key={p} label={p} active={planType === p} onPress={() => setPlanType(p)} />
                ))}
              </ScrollView>
              <Text style={styles.label}>Duration *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                {DURATIONS.map((p) => (
                  <Pill key={p} label={p} active={duration === p} onPress={() => setDuration(p)} />
                ))}
              </ScrollView>
              <Text style={styles.label}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="Focus, equipment, intent…"
                placeholderTextColor={COLORS.textTertiary}
                value={description}
                onChangeText={setDescription}
                multiline
              />
              <PrimaryButton label="Next →" onPress={goNext} />
            </>
          )}

          {step === 2 && (
            <>
              <SectionHeader title="Your workout schedule" />
              <Text style={styles.caption}>You have {workoutDays.length} workout day{workoutDays.length !== 1 ? 's' : ''}.</Text>
              {workoutDays.map((d, i) => (
                <GradientCard key={d.id} style={{ marginBottom: 12 }}>
                  <View style={styles.dayCardRow}>
                    <Text style={styles.dayBadge}>Day {d.dayNumber}</Text>
                    <TouchableOpacity onPress={() => removeDay(d.id)} hitSlop={10}>
                      <Ionicons name="close" size={22} color={COLORS.pink} />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={[styles.input, { marginTop: 8 }]}
                    value={d.dayName}
                    onChangeText={(t) =>
                      setWorkoutDays((rows) => rows.map((r) => (r.id === d.id ? { ...r, dayName: t } : r)))
                    }
                    placeholder="Day name"
                    placeholderTextColor={COLORS.textTertiary}
                  />
                  <Text style={styles.caption}>{(d.exercises || []).length} exercise{(d.exercises || []).length !== 1 ? 's' : ''}</Text>
                </GradientCard>
              ))}
              <SecondaryButton label="+ Add workout day" onPress={addDay} />
              <View style={styles.rowBetween}>
                <SecondaryButton label="← Back" onPress={goBack} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <PrimaryButton label="Next →" onPress={goNext} />
                </View>
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <SectionHeader title="Add exercises" />
              <Text style={styles.caption}>
                Day {dayIndex + 1} of {workoutDays.length}
                {workoutDays.length > 1 ? ` · ${workoutDays[dayIndex]?.dayName}` : ''}
              </Text>
              {(workoutDays[dayIndex]?.exercises || []).map((ex, idx) => (
                <GradientCard key={ex.id} borderColors={[COLORS.cyan, COLORS.purple]}>
                  <View style={styles.exHeader}>
                    <View style={styles.numBadge}>
                      <Text style={styles.numBadgeText}>{idx + 1}</Text>
                    </View>
                    <Text style={styles.exName} numberOfLines={2}>
                      {ex.exerciseName}
                    </Text>
                    <View style={styles.exActions}>
                      <TouchableOpacity onPress={() => moveExercise(ex.id, -1)} hitSlop={8}>
                        <Ionicons name="chevron-up" size={20} color={COLORS.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => moveExercise(ex.id, 1)} hitSlop={8}>
                        <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => openEditModal(ex)} hitSlop={8}>
                        <Ionicons name="create-outline" size={20} color={COLORS.pink} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => removeExercise(ex.id)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={20} color={COLORS.pink} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.exMeta}>
                    {ex.sets} sets × {formatReps(ex)} · Rest {formatRest(ex.restSeconds)}
                  </Text>
                  {!!ex.notes && <Text style={styles.exNotes}>{ex.notes}</Text>}
                </GradientCard>
              ))}
              <SecondaryButton label="+ Add exercise" onPress={openAddModal} />
              {dayIndex > 0 ? <SecondaryButton label="Copy from day 1" onPress={copyFromFirstDay} /> : null}
              <View style={styles.rowBetween}>
                <SecondaryButton label="← Back" onPress={goBack} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <PrimaryButton
                    label={dayIndex < workoutDays.length - 1 ? 'Next day →' : 'Review →'}
                    onPress={goNext}
                  />
                </View>
              </View>
            </>
          )}

          {step === 4 && (
            <>
              <SectionHeader title="Plan summary" />
              <Text style={styles.h2}>{planName}</Text>
              <Text style={styles.caption}>
                {duration} · {planType}
              </Text>
              {workoutDays.map((d) => (
                <View key={d.id} style={{ marginTop: 16 }}>
                  <Text style={styles.subHead}>
                    {String(d.dayName).toUpperCase()} ({(d.exercises || []).length})
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
              <SecondaryButton
                label="✏ Edit plan"
                onPress={() => {
                  setStep(1);
                  setDayIndex(0);
                }}
              />
              <SectionHeader title="Assign to clients" />
              {(clients || []).length === 0 ? (
                <Text style={styles.caption}>No linked clients yet. You can still save for later.</Text>
              ) : (
                clients.map((c) => (
                  <TouchableOpacity key={c.id} style={styles.checkRow} onPress={() => toggleClient(c.id)} activeOpacity={0.8}>
                    <Ionicons
                      name={assignedClients.includes(c.id) ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={assignedClients.includes(c.id) ? COLORS.pink : COLORS.textTertiary}
                    />
                    <Text style={styles.checkLabel}>{c.name || c.displayName || c.id}</Text>
                  </TouchableOpacity>
                ))
              )}
              <PrimaryButton
                label="Save & assign"
                loading={saving}
                onPress={() => persist(true)}
              />
              <SecondaryButton label="Save for later (no assignment)" onPress={() => persist(false)} />
            </>
          )}

          {step === 5 && (
            <View style={{ alignItems: 'center', paddingTop: 40 }}>
              <Ionicons name="checkmark-circle" size={64} color={COLORS.green} />
              <Text style={styles.h2}>Plan saved</Text>
              <Text style={[styles.caption, { textAlign: 'center', marginTop: 8 }]}>
                Clients you assigned can open it from their workout library. You can edit this plan anytime from Custom plans.
              </Text>
              <View style={{ width: '100%', marginTop: 24 }}>
                <PrimaryButton label="Close" onPress={() => onClose?.()} />
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editExerciseId ? 'Edit exercise' : 'Add exercise'}</Text>
              <TouchableOpacity onPress={() => { setModalOpen(false); resetModal(); }}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>Search library</Text>
            <TextInput
              style={styles.input}
              placeholder="Search exercises…"
              placeholderTextColor={COLORS.textTertiary}
              value={searchQ}
              onChangeText={setSearchQ}
            />
            <FlatList
              style={{ maxHeight: 160 }}
              data={searchResults}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.suggestRow}
                  onPress={() => {
                    setPickedLibrary(item);
                    setCustomName('');
                  }}
                >
                  <Text style={styles.exTitle}>{item.name}</Text>
                  <Text style={styles.caption}>{(item.muscleGroups || []).join(' · ')}</Text>
                </TouchableOpacity>
              )}
            />
            <Text style={styles.label}>Or custom name</Text>
            <TextInput
              style={styles.input}
              placeholder="Type any exercise name"
              placeholderTextColor={COLORS.textTertiary}
              value={customName}
              onChangeText={(t) => {
                setCustomName(t);
                if (t.trim()) setPickedLibrary(null);
              }}
            />
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
                  placeholderTextColor={COLORS.textTertiary}
                  value={tempo}
                  onChangeText={setTempo}
                />
                <Text style={styles.label}>Target load (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 185 lb"
                  placeholderTextColor={COLORS.textTertiary}
                  value={weight}
                  onChangeText={setWeight}
                />
                <Text style={styles.label}>Progression (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., +5 lb when all sets hit top of range"
                  placeholderTextColor={COLORS.textTertiary}
                  value={progression}
                  onChangeText={setProgression}
                />
                <Text style={styles.label}>Notes (optional)</Text>
                <TextInput
                  style={[styles.input, styles.inputMulti]}
                  placeholder="Coaching cues…"
                  placeholderTextColor={COLORS.textTertiary}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                />
              </>
            )}
            <View style={styles.rowBetween}>
              <SecondaryButton label="Cancel" onPress={() => { setModalOpen(false); resetModal(); }} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <PrimaryButton label={editExerciseId ? 'Save' : 'Add'} onPress={confirmModal} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollPad: { paddingHorizontal: 16, paddingBottom: 48 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  stepStripWrap: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingTop: 4,
    paddingBottom: 10,
    gap: 6,
  },
  stepStripItem: { flex: 1, alignItems: 'center' },
  stepStripLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
  stepStripBar: { height: 3, width: '100%', borderRadius: 2, marginTop: 6 },
  planExplainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(139,92,246,0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
  },
  planExplainerText: { flex: 1, color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  backHit: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  topTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800' },
  sectionHeader: { marginTop: 20, marginBottom: 12 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  sectionUnderline: { height: 2, borderRadius: 1, opacity: 0.9 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#0A0A0F',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  inputMulti: { minHeight: 88, textAlignVertical: 'top' },
  pillRow: { flexDirection: 'row', gap: 8, paddingVertical: 4, flexWrap: 'wrap' },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'transparent',
  },
  pillActive: { borderColor: 'rgba(196,181,253,0.65)', backgroundColor: 'rgba(139,92,246,0.14)' },
  pillText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  pillTextActive: { color: COLORS.textPrimary },
  primaryGrad: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: COLORS.pink,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryLabel: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  secondaryBtn: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: COLORS.pink,
    alignItems: 'center',
  },
  secondaryLabel: { color: COLORS.pink, fontSize: 14, fontWeight: '700' },
  gradBorder: { borderRadius: 14, padding: 2.5, marginTop: 8 },
  gradInner: {
    borderRadius: 12,
    backgroundColor: COLORS.cardBg,
    padding: 14,
    shadowColor: COLORS.pink,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  caption: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4 },
  h2: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800', marginTop: 4 },
  subHead: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  dayCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayBadge: { color: COLORS.pink, fontWeight: '800', fontSize: 13 },
  exHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  numBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numBadgeText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  exName: { flex: 1, color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  exTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  exMeta: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  exNotes: { color: COLORS.textSecondary, fontSize: 12, fontStyle: 'italic', marginTop: 4 },
  exActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowBetween: { flexDirection: 'row', alignItems: 'stretch', marginTop: 16, gap: 8 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  checkLabel: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '92%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800' },
  suggestRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginVertical: 8 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '700' },
  stepVal: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800', minWidth: 36, textAlign: 'center' },
});
