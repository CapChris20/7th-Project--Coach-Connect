// ─────────────────────────────────────────────────────────────
// FULL FILE START
// ─────────────────────────────────────────────────────────────

/**
 * ANATROX — My Dashboard Screen
 * Converted from Lovable web export to React Native / Expo
 * Single file — all components inlined, no navbar, no Anatrox header
 *
 * DEPENDENCIES — install if not already present:
 *   npx expo install expo-linear-gradient @expo/vector-icons @react-native-async-storage/async-storage
 *
 * USAGE:
 *   <Stack.Screen name="MyDashboard" component={MyDashboardScreen} />
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, collection, addDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../app/config';
import { getDateKey } from '../../app/dateKey';
import { useTheme } from '../../shared/ui/ThemeContext';

const DARK = {
  bg: ['#0a0a1a', '#1a0825', '#0d1117'],
  solidBg: '#0d0d1f',
  cardBg: 'rgba(255,255,255,0.05)',
  cardBorder: 'rgba(255,255,255,0.08)',
  text: '#ffffff',
  textMuted: 'rgba(255,255,255,0.5)',
  textDimmed: 'rgba(255,255,255,0.35)',
  textSubtle: 'rgba(255,255,255,0.3)',
  inputBg: 'rgba(255,255,255,0.06)',
  inputBorder: 'rgba(255,255,255,0.10)',
  iconColor: 'rgba(255,255,255,0.6)',
  pillBg: 'rgba(255,255,255,0.05)',
  pillBorder: 'rgba(255,255,255,0.12)',
  pillText: 'rgba(255,255,255,0.7)',
};

const LIGHT = {
  bg: ['#f5f3ff', '#ede9fe', '#e9e5ff'],
  solidBg: '#f8f6ff',
  cardBg: 'rgba(255,255,255,0.7)',
  cardBorder: 'rgba(0,0,0,0.06)',
  text: '#1a1040',
  textMuted: 'rgba(30,16,64,0.5)',
  textDimmed: 'rgba(30,16,64,0.35)',
  textSubtle: 'rgba(30,16,64,0.3)',
  inputBg: 'rgba(255,255,255,0.8)',
  inputBorder: 'rgba(0,0,0,0.08)',
  iconColor: 'rgba(30,16,64,0.6)',
  pillBg: 'rgba(255,255,255,0.5)',
  pillBorder: 'rgba(0,0,0,0.08)',
  pillText: 'rgba(30,16,64,0.7)',
};

const TAG_MAP = {
  weight_loss: 'Weight Loss',
  strength: 'Strength',
  build_muscle: 'Build Muscle',
  lose_fat: 'Lose Fat',
  lose_weight: 'Lose Weight',
  gain_weight: 'Gain Weight',
  increase_strength: 'Strength',
  improve_endurance: 'Endurance',
  improve_flexibility: 'Flexibility',
  athletic_performance: 'Athletic Performance',
  general_health: 'General Health',
  stress_relief: 'Stress Relief',
  bodybuilding: 'Bodybuilding',
  powerlifting: 'Powerlifting',
  crossfit: 'CrossFit',
  yoga: 'Yoga',
  senior: 'Senior Fitness',
  youth: 'Youth Training',
  rehabilitation: 'Rehabilitation',
  cardio: 'Cardio',
  hiit: 'HIIT',
};
const formatTag = (raw) => {
  if (raw == null || raw === '') return '';
  const key = String(raw).trim();
  if (TAG_MAP[key]) return TAG_MAP[key];
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};
const formatTagString = (raw) => {
  if (raw == null || raw === '') return '';
  const s = String(raw).trim();
  const keys = Object.keys(TAG_MAP).filter((k) => s.includes(k));
  if (keys.length === 0) return formatTag(s);
  const ordered = keys.sort((a, b) => s.indexOf(a) - s.indexOf(b));
  return ordered.map((k) => formatTag(k)).join(' · ');
};

const sleepStatus = (v) => {
  const n = parseFloat(v);
  if (n >= 7) return 'On track';
  if (n >= 5) return 'Needs improvement';
  return 'Low sleep';
};

const workoutStatus = (v) => (v && String(v).trim().length > 0 ? 'Logged' : 'Rest day');

const waterStatus = (v) => {
  const n = parseFloat(v);
  if (n >= 64) return 'Well hydrated';
  if (n >= 32) return 'Keep going';
  return 'Drink more';
};

const STORAGE_KEY_LABELS = {
  dashboard_sleep: 'Sleep Data',
  dashboard_workouts: 'Workouts Today',
  dashboard_water: 'Water Intake',
  dashboard_weight: 'Current Weight',
  dashboard_bodyfat: 'Body Fat %',
  dashboard_steps: 'Daily Steps',
  dashboard_soreness: 'Muscle Soreness',
  dashboard_energy: 'Energy Level',
  dashboard_stress: 'Stress Level',
  dashboard_mood: 'Mood Check-in',
  dashboard_nutrition: 'Nutrition Compliance',
  dashboard_mealplan: 'Meal Plan',
  dashboard_supplements: 'Supplements Taken',
  dashboard_workout_rating: 'Post-Workout Rating',
  dashboard_notes: 'Notes to Trainer',
};

const useCardState = (storageKey, onAfterSave) => {
  const [savedValue, setSavedValue] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [showNotified, setShowNotified] = useState(false);

  useEffect(() => {
    const load = async () => {
      const uid = auth?.currentUser?.uid;
      const todayKey = getDateKey();

      try {
        // 1) Load from AsyncStorage — use app's date (getDateKey) so we don't clear "today" by timezone
        const stored = await AsyncStorage.getItem(storageKey);
        const storedTime = await AsyncStorage.getItem(`${storageKey}_time`);
        if (stored != null && stored !== '' && storedTime) {
          const storedDateKey = new Date(storedTime).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
          if (storedDateKey === todayKey) {
            setSavedValue(stored);
            setSavedAt(storedTime);
            return;
          }
          await AsyncStorage.removeItem(storageKey);
          await AsyncStorage.removeItem(`${storageKey}_time`);
        }

        // 2) If nothing in AsyncStorage for today, load from Firebase so logged data is shown
        if (uid && db) {
          const logsRef = doc(db, 'users', uid, 'dailyLogs', todayKey);
          const snap = await getDoc(logsRef);
          if (snap.exists()) {
            const data = snap.data();
            const fromFirebase = data[storageKey];
            if (fromFirebase !== undefined && fromFirebase !== null && fromFirebase !== '') {
              const valueStr = typeof fromFirebase === 'string' ? fromFirebase : String(fromFirebase);
              setSavedValue(valueStr);
              setSavedAt(data.updatedAt?.toDate?.()?.toISOString?.() || new Date().toISOString());
              await AsyncStorage.setItem(storageKey, valueStr);
              await AsyncStorage.setItem(`${storageKey}_time`, new Date().toISOString());
            }
          }
        }
      } catch (e) {
        console.warn('useCardState load error:', e);
      }
    };
    load();
  }, [storageKey]);

  const save = async (value) => {
    const now = new Date().toISOString();
    try {
      await AsyncStorage.setItem(storageKey, value);
      await AsyncStorage.setItem(`${storageKey}_time`, now);
    } catch (e) {
      console.warn('useCardState save error:', e);
    }
    setSavedValue(value);
    setSavedAt(now);
    setShowNotified(true);
    const dateKey = getDateKey();
    const currentUser = auth?.currentUser;
    if (db && currentUser) {
      try {
        await setDoc(
          doc(db, 'users', currentUser.uid, 'dailyLogs', dateKey),
          { [storageKey]: value, updatedAt: serverTimestamp() },
          { merge: true }
        );

        // Mirror key metrics into daily_tracking so client home stats update
        const numeric = parseFloat(value);
        if (!Number.isNaN(numeric)) {
          const trackingRef = doc(db, 'users', currentUser.uid, 'daily_tracking', dateKey);
          const trackingUpdate = {};
          if (storageKey === 'dashboard_water') {
            trackingUpdate.waterIntake = numeric;
          } else if (storageKey === 'dashboard_sleep') {
            trackingUpdate.sleepHours = numeric;
          }
          if (Object.keys(trackingUpdate).length > 0) {
            trackingUpdate.updatedAt = serverTimestamp();
            await setDoc(trackingRef, trackingUpdate, { merge: true });
          }
        }

        // Debug: read back what is stored so we can see it in Metro logs
        try {
          const logsSnap = await getDoc(doc(db, 'users', currentUser.uid, 'dailyLogs', dateKey));
          const trackingSnap = await getDoc(doc(db, 'users', currentUser.uid, 'daily_tracking', dateKey));
          console.log('🔍 dailyLogs debug', {
            uid: currentUser.uid,
            dateKey,
            exists: logsSnap.exists(),
            data: logsSnap.exists() ? logsSnap.data() : null,
          });
          console.log('🔍 daily_tracking debug', {
            uid: currentUser.uid,
            dateKey,
            exists: trackingSnap.exists(),
            data: trackingSnap.exists() ? trackingSnap.data() : null,
          });
        } catch (debugErr) {
          console.warn('dailyLogs debug read error', debugErr?.message || debugErr);
        }

        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userSnap.exists() ? userSnap.data() : {};
        const trainerId = userData.trainerId || userData.trainer_id || null;
        if (trainerId) {
          await addDoc(collection(db, 'notifications'), {
            type: storageKey,
            label: STORAGE_KEY_LABELS[storageKey] || storageKey,
            clientUid: currentUser.uid,
            trainerUid: trainerId,
            value,
            timestamp: serverTimestamp(),
            read: false,
          });
        }
      } catch (e) {
        console.warn('Firebase save error:', e);
      }
    }
    if (onAfterSave) {
      onAfterSave(value);
    }
    setTimeout(() => setShowNotified(false), 3000);
  };

  const getTimeSince = () => {
    if (!savedAt) return '';
    const diff = Date.now() - new Date(savedAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return { savedValue, savedAt, showNotified, save, getTimeSince };
};

// Structured workout logger: exercises + sets stored as workoutLog in dailyLogs
const useWorkoutLog = (onAfterSave) => {
  const [workoutName, setWorkoutName] = useState('');
  const [workoutExercises, setWorkoutExercises] = useState([]);
  const [showNotified, setShowNotified] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const makeExercise = () => ({
    id: `${Date.now()}_${Math.random()}`,
    name: '',
    sets: [{ id: `${Date.now()}_${Math.random()}`, reps: '', weight: '' }],
  });

  useEffect(() => {
    if (!db || !auth?.currentUser) return;
    const uid = auth.currentUser.uid;
    const dateKey = getDateKey();
    const ref = doc(db, 'users', uid, 'dailyLogs', dateKey);
    getDoc(ref)
      .then((snap) => {
        if (!snap.exists()) {
          setWorkoutExercises([makeExercise()]);
          setLoaded(true);
          return;
        }
        const d = snap.data();
        setWorkoutName(d.dashboard_workout_name || '');
        if (Array.isArray(d.workoutLog) && d.workoutLog.length > 0) {
          const mapped = d.workoutLog.map((item) => ({
            id: `${Date.now()}_${Math.random()}`,
            name: item.exerciseName || '',
            sets: Array.isArray(item.sets) && item.sets.length
              ? item.sets.map((s) => ({
                  id: `${Date.now()}_${Math.random()}`,
                  reps: s.reps != null ? String(s.reps) : '',
                  weight: s.weight != null ? String(s.weight) : '',
                }))
              : [{ id: `${Date.now()}_${Math.random()}`, reps: '', weight: '' }],
          }));
          setWorkoutExercises(mapped);
        } else if (Array.isArray(d.dashboard_workout_exercises) && d.dashboard_workout_exercises.length > 0) {
          setWorkoutExercises(
            d.dashboard_workout_exercises.map((name) => ({
              id: `${Date.now()}_${Math.random()}`,
              name: String(name),
              sets: [{ id: `${Date.now()}_${Math.random()}`, reps: '', weight: '' }],
            })),
          );
        } else {
          setWorkoutExercises([makeExercise()]);
        }
        setLoaded(true);
      })
      .catch(() => {
        setWorkoutExercises([makeExercise()]);
        setLoaded(true);
      });
  }, []);

  const addExercise = () => setWorkoutExercises((prev) => [...prev, makeExercise()]);
  const removeExercise = (id) =>
    setWorkoutExercises((prev) => (prev.length > 1 ? prev.filter((e) => e.id !== id) : prev));
  const updateExerciseName = (id, name) =>
    setWorkoutExercises((prev) => prev.map((e) => (e.id === id ? { ...e, name } : e)));

  const addSet = (exerciseId) =>
    setWorkoutExercises((prev) =>
      prev.map((e) =>
        e.id === exerciseId
          ? {
              ...e,
              sets: [...e.sets, { id: `${Date.now()}_${Math.random()}`, reps: '', weight: '' }],
            }
          : e,
      ),
    );

  const removeSet = (exerciseId, setId) =>
    setWorkoutExercises((prev) =>
      prev.map((e) =>
        e.id === exerciseId
          ? {
              ...e,
              sets: e.sets.length > 1 ? e.sets.filter((s) => s.id !== setId) : e.sets,
            }
          : e,
      ),
    );

  const updateSetField = (exerciseId, setId, field, value) =>
    setWorkoutExercises((prev) =>
      prev.map((e) =>
        e.id === exerciseId
          ? {
              ...e,
              sets: e.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)),
            }
          : e,
      ),
    );

  const save = async () => {
    const name = workoutName.trim();
    const structured = workoutExercises
      .filter((ex) => ex.name && ex.name.trim() !== '')
      .map((ex) => ({
        exerciseName: ex.name.trim(),
        sets: ex.sets
          .filter((s) => s.reps !== '' || s.weight !== '')
          .map((s) => ({
            reps: parseInt(s.reps, 10) || 0,
            weight: parseFloat(s.weight) || 0,
          })),
      }))
      .filter((ex) => ex.sets.length > 0);

    const dateKey = getDateKey();
    const uid = auth?.currentUser?.uid;
    if (!db || !uid) return;

    // Build legacy combined string for notifications / backwards compatibility
    const summaryParts = structured.map((ex) => {
      const setsSummary = ex.sets
        .map((s) => `${s.reps || 0}×${s.weight || 0}`)
        .join(', ');
      return `${ex.exerciseName} (${ex.sets.length} sets: ${setsSummary})`;
    });
    const combined = [name, ...summaryParts].filter(Boolean).join('\n');

    try {
      const payload = {
        workoutLog: structured,
        dashboard_workout_name: name || null,
        dashboard_workouts: combined || null,
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'users', uid, 'dailyLogs', dateKey), payload, { merge: true });

      const userSnap = await getDoc(doc(db, 'users', uid));
      const userData = userSnap.exists() ? userSnap.data() : {};
      const trainerId = userData.trainerId || userData.trainer_id || null;
      if (trainerId) {
        await addDoc(collection(db, 'notifications'), {
          type: 'dashboard_workouts',
          label: 'Workouts Today',
          clientUid: uid,
          trainerUid: trainerId,
          value: combined,
          timestamp: serverTimestamp(),
          read: false,
        });
      }
      setShowNotified(true);
      if (onAfterSave) onAfterSave(combined || null, name || '', structured);
      setTimeout(() => setShowNotified(false), 3000);
    } catch (e) {
      console.warn('Workout log save error:', e);
    }
  };

  const hasValue =
    (workoutName && workoutName.trim()) ||
    workoutExercises.some((ex) => ex.name.trim() || ex.sets.some((s) => s.reps || s.weight));

  return {
    workoutName,
    setWorkoutName,
    workoutExercises,
    addExercise,
    removeExercise,
    updateExerciseName,
    addSet,
    removeSet,
    updateSetField,
    save,
    loaded,
    showNotified,
    hasValue,
  };
};

const WorkoutLogCard = ({ icon, gradientFrom, gradientTo, isDark, onAfterSave }) => {
  const t = isDark ? DARK : LIGHT;
  const {
    workoutName,
    setWorkoutName,
    workoutExercises,
    addExercise,
    removeExercise,
    updateExerciseName,
    addSet,
    removeSet,
    updateSetField,
    save,
    loaded,
    showNotified,
    hasValue,
  } = useWorkoutLog(onAfterSave);
  const [isEditing, setIsEditing] = useState(false);

  if (!loaded) return null;

  const showForm = !hasValue || isEditing;
  const statusBadge = hasValue ? workoutStatus(workoutName) : null;

  return (
    <CardShell
      icon={icon}
      title="Workouts Today"
      gradientFrom={gradientFrom}
      gradientTo={gradientTo}
      statusBadge={statusBadge}
      showNotified={showNotified}
      hasSavedValue={hasValue}
      isDark={isDark}
      accentColor={CARD_ACCENT.dashboard_workouts}
    >
      {showForm ? (
        <View style={{ marginTop: 6, gap: 10 }}>
          <TextInput
            style={[data.input, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.text }]}
            placeholder="Workout name (e.g. Chest Day, Pull Day, Full Body)"
            placeholderTextColor={t.textMuted}
            value={workoutName}
            onChangeText={setWorkoutName}
          />
          <Text style={[workoutLog.label, { color: t.textMuted }]}>Exercises</Text>
          {workoutExercises.map((ex) => (
            <View key={ex.id} style={{ marginBottom: 10 }}>
              <TextInput
                style={{
                  height: 44,
                  borderRadius: 12,
                  borderWidth: 1,
                  paddingHorizontal: 12,
                  fontSize: 14,
                  backgroundColor: t.inputBg,
                  borderColor: t.inputBorder,
                  color: t.text,
                }}
                placeholder="Exercise name (e.g. Bench Press)"
                placeholderTextColor={t.textMuted}
                value={ex.name}
                onChangeText={(v) => updateExerciseName(ex.id, v)}
              />
              {ex.sets.map((set) => (
                <View
                  key={set.id}
                  style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}
                >
                  <Text style={{ width: 40, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                    Set {ex.sets.indexOf(set) + 1}
                  </Text>
                  <TextInput
                    style={{
                      width: 70,
                      height: 40,
                      borderRadius: 12,
                      borderWidth: 1,
                      paddingHorizontal: 10,
                      fontSize: 13,
                      backgroundColor: t.inputBg,
                      borderColor: t.inputBorder,
                      color: t.text,
                    }}
                    placeholder="Reps"
                    placeholderTextColor={t.textMuted}
                    keyboardType="numeric"
                    value={set.reps}
                    onChangeText={(v) => updateSetField(ex.id, set.id, 'reps', v)}
                  />
                  <Text style={{ marginHorizontal: 16, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>×</Text>
                  <TextInput
                    style={{
                      width: 80,
                      height: 40,
                      borderRadius: 12,
                      borderWidth: 1,
                      paddingHorizontal: 10,
                      fontSize: 13,
                      backgroundColor: t.inputBg,
                      borderColor: t.inputBorder,
                      color: t.text,
                    }}
                    placeholder="lbs"
                    placeholderTextColor={t.textMuted}
                    keyboardType="numeric"
                    value={set.weight}
                    onChangeText={(v) => updateSetField(ex.id, set.id, 'weight', v)}
                  />
                  <TouchableOpacity
                    onPress={() => removeSet(ex.id, set.id)}
                    style={{ padding: 6, marginLeft: 4 }}
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.3)" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                onPress={() => addSet(ex.id)}
                style={{
                  alignSelf: 'stretch',
                  marginTop: 10,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Ionicons name="add-circle-outline" size={18} color="rgba(255,255,255,0.7)" />
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>Add Set</Text>
              </TouchableOpacity>
              <View
                style={{
                  height: 1,
                  marginTop: 10,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                }}
              />
            </View>
          ))}
          <TouchableOpacity
            onPress={addExercise}
            style={{
              marginTop: 4,
              height: 44,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
              backgroundColor: 'rgba(255,255,255,0.06)',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="add-outline" size={16} color="rgba(255,255,255,0.6)" />
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>Add Exercise</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={save} activeOpacity={0.85}>
            <LinearGradient colors={[gradientFrom, gradientTo]} style={data.saveBtn}>
              <Text style={data.saveBtnText}>Save</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={() => setIsEditing(true)} activeOpacity={0.8} style={{ marginTop: 4 }}>
          {workoutName ? <Text style={[workoutLog.savedName, { color: t.text }]}>{workoutName}</Text> : null}
          <View style={workoutLog.savedList}>
            {workoutExercises
              .filter((ex) => ex.name.trim())
              .map((ex) => (
                <Text
                  key={ex.id}
                  style={[workoutLog.savedExercise, { color: t.textMuted }]}
                >
                  {ex.name}
                </Text>
              ))}
          </View>
          <Text style={[workoutLog.tapEdit, { color: t.textDimmed }]}>Tap to edit</Text>
        </TouchableOpacity>
      )}
    </CardShell>
  );
};

const workoutLog = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exerciseInput: { flex: 1 },
  removeBtn: { padding: 4 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addText: { fontSize: 13, fontWeight: '600' },
  savedName: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  savedList: { gap: 4 },
  savedExercise: { fontSize: 13 },
  tapEdit: { fontSize: 11, marginTop: 6 },
});

const CARD_ACCENT = {
  dashboard_sleep: '#64D2FF',
  dashboard_workouts: '#AF52DE',
  dashboard_water: '#64D2FF',
  dashboard_weight: '#FF9F0A',
  dashboard_bodyfat: '#FF9F0A',
  dashboard_steps: '#10B981',
  dashboard_soreness: '#FF2D55',
  dashboard_energy: '#FF9F0A',
  dashboard_stress: '#AF52DE',
  dashboard_mood: '#64D2FF',
  dashboard_nutrition: '#10B981',
  dashboard_mealplan: '#10B981',
  dashboard_supplements: '#AF52DE',
  dashboard_workout_rating: '#FF9F0A',
  dashboard_notes: '#8A8A8A',
};

const CardShell = ({
  icon, title, gradientFrom, gradientTo,
  statusBadge, showNotified, hasSavedValue, isDark, children,
  accentColor,
}) => {
  const t = isDark ? DARK : LIGHT;
  const notifiedOpacity = useRef(new Animated.Value(0)).current;
  const leftBarColor = accentColor != null ? accentColor : gradientFrom;

  useEffect(() => {
    if (showNotified) {
      Animated.sequence([
        Animated.timing(notifiedOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(2400),
        Animated.timing(notifiedOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [showNotified]);

  return (
    <View style={[shell.card, { backgroundColor: t.cardBg, borderColor: isDark ? 'rgba(255,255,255,0.10)' : t.cardBorder }]}>
      <View style={[shell.leftBorder, { backgroundColor: leftBarColor }]} />
      {statusBadge && (
        <View style={[shell.badge, { backgroundColor: t.pillBg, borderColor: t.pillBorder }]}>
          <Ionicons name="checkmark-outline" size={13} color={t.pillText} style={shell.badgeIcon} />
          <Text style={[shell.badgeText, { color: t.pillText }]}>{statusBadge}</Text>
        </View>
      )}
      <View style={shell.row}>
        <View style={[shell.iconCircle, { backgroundColor: t.pillBg, borderColor: t.inputBorder }]}>
          {icon}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[shell.title, { color: t.text }]}>{title}</Text>
          {children}
        </View>
      </View>
      {showNotified ? (
        <Animated.View style={[shell.notified, { opacity: notifiedOpacity }]}>
          <Ionicons name="checkmark" size={12} color="#22c55e" />
          <Text style={shell.notifiedText}>Trainer notified</Text>
        </Animated.View>
      ) : !hasSavedValue ? (
        <Text style={[shell.subtleNote, { color: t.textSubtle }]}>
          ✓ Trainer notified when entered
        </Text>
      ) : null}
    </View>
  );
};

const shell = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    ...(Platform.OS === 'ios' && {
      shadowColor: '#C084FC',
      shadowRadius: 8,
      shadowOpacity: 0.15,
      shadowOffset: { width: 0, height: 2 },
    }),
  },
  leftBorder: { position: 'absolute', left: 0, top: 12, bottom: 12, width: 3, borderRadius: 99 },
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 99, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 8, marginLeft: 12, gap: 6 },
  badgeIcon: { marginRight: 0 },
  badgeText: { fontSize: 11 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginLeft: 12 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { fontSize: 14, fontWeight: '600' },
  notified: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, marginLeft: 12 },
  notifiedText: { fontSize: 11, color: '#22c55e' },
  subtleNote: { fontSize: 11, marginTop: 8, marginLeft: 12 },
});

const DataCard = ({
  icon,
  title,
  unit,
  placeholder,
  storageKey,
  gradientFrom,
  gradientTo,
  min = 0,
  max = 999,
  defaultExample,
  textMode = false,
  statusFn,
  isDark,
  onAfterSave,
}) => {
  const t = isDark ? DARK : LIGHT;
  const { savedValue, showNotified, save, getTimeSince } = useCardState(storageKey, onAfterSave);
  const [value, setValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState(false);

  const handleSave = () => {
    if (!textMode) {
      const num = parseFloat(value);
      if (isNaN(num) || num < min || num > max) { setError(true); setTimeout(() => setError(false), 1500); return; }
    } else if (!value.trim()) { setError(true); setTimeout(() => setError(false), 1500); return; }
    save(value);
    setIsEditing(false);
  };

  const showInput = !savedValue || isEditing;
  const statusBadge = statusFn && savedValue ? statusFn(savedValue) : null;

  return (
    <CardShell icon={icon} title={title} gradientFrom={gradientFrom} gradientTo={gradientTo}
      statusBadge={statusBadge} showNotified={showNotified} hasSavedValue={!!savedValue} isDark={isDark}
      accentColor={CARD_ACCENT[storageKey]}>
      {!savedValue && !isEditing && (
        <Text style={[data.example, { color: t.textMuted }]}>{defaultExample}</Text>
      )}
      {showInput ? (
        <View style={data.inputRow}>
          <TextInput
            style={[data.input, { backgroundColor: t.inputBg, borderColor: error ? 'rgba(239,68,68,0.6)' : t.inputBorder, color: t.text }]}
            value={value} onChangeText={(v) => { setValue(v); setError(false); }}
            placeholder={placeholder} placeholderTextColor={t.textMuted}
            keyboardType={textMode ? 'default' : 'numeric'} returnKeyType="done" onSubmitEditing={handleSave}
          />
          <TouchableOpacity onPress={handleSave} activeOpacity={0.85}>
            <LinearGradient colors={[gradientFrom, gradientTo]} style={data.saveBtn}>
              <Text style={data.saveBtnText}>Save</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={() => { setIsEditing(true); setValue(savedValue || ''); }} activeOpacity={0.8}>
          {textMode ? (
            <View>
              <View style={[data.savedText, { backgroundColor: t.inputBg, borderColor: t.inputBorder }]}>
                <Text style={{ fontSize: 13, lineHeight: 20, color: t.text }}>{savedValue}</Text>
              </View>
              <Text style={[data.tapEdit, { color: t.textDimmed }]}>tap to edit</Text>
            </View>
          ) : (
            <View>
              <Text style={[data.savedNumber, { color: gradientFrom }]}>
                {savedValue} <Text style={[data.unit, { color: t.textMuted }]}>{unit}</Text>
              </Text>
              <Text style={[data.timeSince, { color: t.textDimmed }]}>Updated {getTimeSince()}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    </CardShell>
  );
};

const data = StyleSheet.create({
  example: { fontSize: 12, fontStyle: 'italic', marginTop: 2 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  input: { flex: 1, fontSize: 13, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, borderWidth: 1 },
  saveBtn: { borderRadius: 99, paddingHorizontal: 16, paddingVertical: 7 },
  saveBtnText: { color: 'white', fontSize: 12, fontWeight: '700' },
  savedText: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, marginTop: 4 },
  tapEdit: { fontSize: 11, marginTop: 4 },
  savedNumber: { fontSize: 24, fontWeight: '800', marginTop: 4 },
  unit: { fontSize: 12 },
  timeSince: { fontSize: 11, marginTop: 2 },
});

const RatingCard = ({ icon, title, subtitle, storageKey, gradientFrom, gradientTo, isDark }) => {
  const t = isDark ? DARK : LIGHT;
  const { savedValue, showNotified, save } = useCardState(storageKey);
  return (
    <CardShell icon={icon} title={title} gradientFrom={gradientFrom} gradientTo={gradientTo}
      showNotified={showNotified} hasSavedValue={!!savedValue} isDark={isDark} accentColor={CARD_ACCENT[storageKey]}>
      <Text style={[rating.subtitle, { color: t.textMuted }]}>{subtitle}</Text>
      <View style={rating.row}>
        {[1, 2, 3, 4, 5].map((n) => {
          const isActive = savedValue === String(n);
          return (
            <TouchableOpacity key={n} onPress={() => save(String(n))} activeOpacity={0.85}>
              {isActive ? (
                <LinearGradient colors={[gradientFrom, gradientTo]} style={rating.btn}>
                  <Text style={[rating.btnText, { color: 'white' }]}>{n}</Text>
                </LinearGradient>
              ) : (
                <View style={[rating.btn, { backgroundColor: t.pillBg, borderWidth: 1, borderColor: t.pillBorder }]}>
                  <Text style={[rating.btnText, { color: t.pillText }]}>{n}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity onPress={() => save('')} activeOpacity={0.85} style={rating.clearWrap}>
          <View style={[rating.btn, { backgroundColor: t.pillBg, borderWidth: 1, borderColor: t.pillBorder }]}>
            <Ionicons name="close-circle" size={18} color={t.pillText} />
          </View>
          <Text style={[rating.clearLabel, { color: t.textMuted }]}>Clear</Text>
        </TouchableOpacity>
      </View>
    </CardShell>
  );
};

const rating = StyleSheet.create({
  subtitle: { fontSize: 12, marginTop: 2 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'flex-end' },
  btn: { width: 40, height: 32, borderRadius: 99, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 12, fontWeight: '600' },
  clearWrap: { alignItems: 'center', justifyContent: 'center' },
  clearLabel: { fontSize: 9, fontWeight: '600', marginTop: 2 },
});

const EMOJIS = ['😞', '😕', '😐', '🙂', '😄'];

const MoodCard = ({ icon, title, subtitle, storageKey, gradientFrom, gradientTo, isDark }) => {
  const t = isDark ? DARK : LIGHT;
  const { savedValue, showNotified, save } = useCardState(storageKey);
  return (
    <CardShell icon={icon} title={title} gradientFrom={gradientFrom} gradientTo={gradientTo}
      showNotified={showNotified} hasSavedValue={!!savedValue} isDark={isDark} accentColor={CARD_ACCENT[storageKey]}>
      <Text style={[rating.subtitle, { color: t.textMuted }]}>{subtitle}</Text>
      <View style={rating.row}>
        {EMOJIS.map((emoji, i) => {
          const isActive = savedValue === String(i);
          return (
            <TouchableOpacity key={i} onPress={() => save(String(i))} activeOpacity={0.85}
              style={[mood.btn, {
                backgroundColor: isActive ? (isDark ? 'rgba(255,255,255,0.15)' : 'white') : t.pillBg,
                borderWidth: isActive ? 2 : 1,
                borderColor: isActive ? gradientFrom : t.pillBorder,
              }]}>
              <Text style={{ fontSize: 20 }}>{emoji}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </CardShell>
  );
};

const mood = StyleSheet.create({
  btn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});

const ToggleCard = ({ icon, title, subtitle, storageKey, gradientFrom, gradientTo, questions, isDark }) => {
  const t = isDark ? DARK : LIGHT;
  const { savedValue, showNotified, save } = useCardState(storageKey);
  const values = savedValue ? (() => { try { return JSON.parse(savedValue); } catch { return {}; } })() : {};
  const hasAnyValue = Object.keys(values).length > 0;
  const handleToggle = (key, val) => { const updated = { ...values, [key]: val }; save(JSON.stringify(updated)); };
  return (
    <CardShell icon={icon} title={title} gradientFrom={gradientFrom} gradientTo={gradientTo}
      showNotified={showNotified} hasSavedValue={hasAnyValue} isDark={isDark} accentColor={CARD_ACCENT[storageKey]}>
      {subtitle && <Text style={[rating.subtitle, { color: t.textMuted }]}>{subtitle}</Text>}
      <View style={{ gap: 8, marginTop: 8 }}>
        {questions.map((q) => (
          <View key={q.key} style={toggle.row}>
            <Text style={[toggle.label, { color: t.textMuted }]}>{q.label}</Text>
            <View style={toggle.btnRow}>
              {['Yes', 'No'].map((opt) => {
                const isActive = values[q.key] === opt;
                return (
                  <TouchableOpacity key={opt} onPress={() => handleToggle(q.key, opt)} activeOpacity={0.85}>
                    {isActive ? (
                      <LinearGradient colors={[gradientFrom, gradientTo]} style={toggle.btn}>
                        <Text style={[toggle.btnText, { color: 'white' }]}>{opt}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={[toggle.btn, { backgroundColor: t.pillBg, borderWidth: 1, borderColor: t.pillBorder }]}>
                        <Text style={[toggle.btnText, { color: t.pillText }]}>{opt}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    </CardShell>
  );
};

const toggle = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 12, flex: 1 },
  btnRow: { flexDirection: 'row', gap: 6 },
  btn: { borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6 },
  btnText: { fontSize: 12, fontWeight: '600' },
});

const STAR_FILLED_COLOR = '#F59E0B';

const StarRatingCard = ({ icon, title, subtitle, storageKey, gradientFrom, gradientTo, isDark }) => {
  const t = isDark ? DARK : LIGHT;
  const { savedValue, showNotified, save } = useCardState(storageKey);
  const starRating = savedValue ? parseInt(savedValue) : 0;
  return (
    <CardShell icon={icon} title={title} gradientFrom={gradientFrom} gradientTo={gradientTo}
      showNotified={showNotified} hasSavedValue={!!savedValue} isDark={isDark} accentColor={CARD_ACCENT[storageKey]}>
      <Text style={[rating.subtitle, { color: t.textMuted }]}>{subtitle}</Text>
      <View style={[rating.row, { marginTop: 8 }]}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity key={n} onPress={() => save(String(n))} activeOpacity={0.7}>
            <Ionicons name={n <= starRating ? 'star' : 'star-outline'} size={26}
              color={n <= starRating ? STAR_FILLED_COLOR : t.textDimmed} />
          </TouchableOpacity>
        ))}
      </View>
    </CardShell>
  );
};

const NotesCard = ({ icon, title, placeholder, storageKey, gradientFrom, gradientTo, isDark }) => {
  const t = isDark ? DARK : LIGHT;
  const { savedValue, showNotified, save, getTimeSince } = useCardState(storageKey);
  const [value, setValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const showInput = !savedValue || isEditing;
  const handleSave = () => {
    if (!value.trim()) return;
    save(value);
    setIsEditing(false);
  };
  return (
    <CardShell icon={icon} title={title} gradientFrom={gradientFrom} gradientTo={gradientTo}
      showNotified={showNotified} hasSavedValue={!!savedValue} isDark={isDark} accentColor={CARD_ACCENT[storageKey]}>
      {showInput ? (
        <View style={{ marginTop: 6 }}>
          <TextInput
            style={[notes.textarea, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.text }]}
            value={value} onChangeText={setValue} placeholder={placeholder}
            placeholderTextColor={t.textMuted} multiline numberOfLines={4} textAlignVertical="top"
          />
          <TouchableOpacity onPress={handleSave} activeOpacity={0.85}>
            <LinearGradient colors={[gradientFrom, gradientTo]}
              style={[data.saveBtn, { marginTop: 6, alignSelf: 'flex-start' }]}>
              <Text style={data.saveBtnText}>Save</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={() => { setIsEditing(true); setValue(savedValue || ''); }} activeOpacity={0.8}>
          <Text style={{ fontSize: 13, marginTop: 4, color: t.textMuted }}>{savedValue}</Text>
          <Text style={[data.timeSince, { color: t.textDimmed }]}>Updated {getTimeSince()}</Text>
        </TouchableOpacity>
      )}
    </CardShell>
  );
};

const notes = StyleSheet.create({
  textarea: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, minHeight: 80 },
});

export const MyDashboardScreen = ({
  trainer,
  embedInLayout = false,
  onMetricsChange,
  onPressMessage,
  onOpenRemoveTrainer,
  onOpenPhotoGallery,
  onOpenAIWorkouts,
  trainerClientId,
  trainerClientName,
  photoGalleryBadgeCount = 0,
  aiWorkoutsBadgeCount = 0,
  unreadMessageCount = 0,
  streak = 0,
  todayCalories = 0,
  waterOz = 0,
  sleepHoursValue = null,
}) => {
  const { isDark } = useTheme();
  const t = isDark ? DARK : LIGHT;
  const icon = (name) => <Ionicons name={name} size={18} color={t.iconColor} />;
  const currentUser = auth?.currentUser;

  const trainerName = (() => {
    const first = trainer?.firstName || trainer?.givenName;
    const last = trainer?.lastName || trainer?.familyName;
    if (first || last) return `${first ?? ''} ${last ?? ''}`.trim();
    return trainer?.displayName || trainer?.name || 'Your trainer';
  })();

  const trainerTitle = (() => {
    const raw = trainer?.headline || trainer?.title || null;
    if (raw) return String(raw);
    if (Array.isArray(trainer?.certifications) && trainer.certifications.length) {
      return trainer.certifications.join(' · ');
    }
    if (typeof trainer?.certifications === 'string' && trainer.certifications.trim()) {
      return trainer.certifications.trim();
    }
    return null;
  })();
  const trainerGoal =
    trainer?.primaryGoal ||
    trainer?.specialty ||
    trainer?.specialties ||
    null;

  const trainerExperienceLabel =
    typeof trainer?.experienceYears === 'number' ? `${trainer.experienceYears}+ yrs experience` : null;

  const trainerLocation = trainer?.location ? String(trainer.location) : null;
  const trainerBio = trainer?.bio ? String(trainer.bio) : null;
  const trainerPricingLine = (() => {
    const p = trainer?.pricing;
    if (!p) return null;
    const parts = [];
    if (p.perSession != null && p.perSession !== '') parts.push(`$${p.perSession}/session`);
    if (p.perMonth != null && p.perMonth !== '') parts.push(`$${p.perMonth}/month`);
    return parts.length ? parts.join(' · ') : null;
  })();

  const trainerInitials = (() => {
    const baseName = trainerName || 'Your trainer';
    return baseName
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  })();

  const trainerCertifications = (() => {
    if (Array.isArray(trainer?.certifications)) return trainer.certifications;
    if (typeof trainer?.certifications === 'string') {
      return trainer.certifications
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  })();

  const trainerSpecialties = (() => {
    if (Array.isArray(trainer?.specialties)) return trainer.specialties;
    if (typeof trainer?.specialties === 'string') {
      return trainer.specialties
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (trainerGoal) {
      const asString = Array.isArray(trainerGoal) ? trainerGoal.join(',') : String(trainerGoal);
      return asString
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  })();

  // Debug: compare what we show vs what's stored on the trainer doc
  console.log('MyDashboardScreen trainer debug:', {
    rawTrainer: trainer || null,
    displayed: {
      trainerName,
      trainerTitle,
      trainerGoal,
      trainerCertifications,
      trainerSpecialties,
      trainerExperienceLabel,
    },
  });

  return (
    <LinearGradient colors={t.bg} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[screen.scroll, embedInLayout && { paddingTop: 16 }]} showsVerticalScrollIndicator={false}>

        {/* Hero section */}
        <LinearGradient
          colors={['#1a0a2e', '#0a1628']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={heroStyles.hero}
        >
          <View style={heroStyles.heroContent}>
            <View>
              <Text style={heroStyles.greeting}>Welcome back</Text>
              <Text style={heroStyles.heroName}>{currentUser?.displayName || 'Athlete'}</Text>
            </View>
            <View style={heroStyles.heroLottieWrap}>
              <LottieView
                source={require('../../assets/Lotties for Anatrox/fitness.json')}
                autoPlay
                loop
                style={heroStyles.heroLottie}
              />
            </View>
          </View>
          <View style={heroStyles.statsRow}>
            <View style={heroStyles.statItem}>
              <Text style={heroStyles.statValue}>{todayCalories || 0}</Text>
              <Text style={heroStyles.statLabel}>Calories</Text>
            </View>
            <View style={heroStyles.statDivider} />
            <View style={heroStyles.statItem}>
              <Text style={heroStyles.statValue}>
                {typeof sleepHoursValue === 'number' ? sleepHoursValue : 0}
              </Text>
              <Text style={heroStyles.statLabel}>Sleep (hrs)</Text>
            </View>
            <View style={heroStyles.statDivider} />
            <View style={heroStyles.statItem}>
              <Text style={heroStyles.statValue}>{waterOz || 0}oz</Text>
              <Text style={heroStyles.statLabel}>Water</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Trainer card */}
        {trainer ? (
          <View style={screen.trainerCardWrapper}>
            <LinearGradient
              colors={['rgba(192,132,252,0.15)', 'rgba(255,107,157,0.08)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={trainerCardStyles.cardGradientOuter}
            >
              <View style={[trainerCardStyles.card, { backgroundColor: t.solidBg }]}>
                <View style={trainerCardStyles.left}>
                  <View style={trainerCardStyles.avatar}>
                    {trainer?.photoURL ? (
                      <Image source={{ uri: trainer.photoURL }} style={{ width: 52, height: 52, borderRadius: 26 }} />
                    ) : (
                      <Text style={trainerCardStyles.avatarInitials}>
                        {trainerInitials || '?'}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={trainerCardStyles.trainerName} numberOfLines={1}>
                      {trainerName}
                    </Text>
                    {(trainerTitle || trainerCertifications.length > 0) && (
                      <Text style={trainerCardStyles.certLine} numberOfLines={1}>
                        {trainerTitle || trainerCertifications.join(' · ') || 'Certified Trainer'}
                      </Text>
                    )}
                    {trainerSpecialties.length > 0 && (
                      <Text style={trainerCardStyles.specialtyLine} numberOfLines={1}>
                        {trainerSpecialties
                          .map((s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
                          .join(' · ')}
                      </Text>
                    )}
                    {trainerExperienceLabel && (
                      <Text style={trainerCardStyles.experienceLine} numberOfLines={1}>
                        {trainerExperienceLabel}
                      </Text>
                    )}
                    {trainerLocation && (
                      <Text style={trainerCardStyles.experienceLine} numberOfLines={1}>
                        {trainerLocation}
                      </Text>
                    )}
                    {trainerPricingLine && (
                      <Text style={trainerCardStyles.experienceLine} numberOfLines={1}>
                        {trainerPricingLine}
                      </Text>
                    )}
                    {trainerBio && (
                      <Text style={trainerCardStyles.bioLine} numberOfLines={2}>
                        {trainerBio}
                      </Text>
                    )}
                  </View>
                </View>

                {onOpenRemoveTrainer && (
                  <TouchableOpacity
                    onPress={onOpenRemoveTrainer}
                    style={trainerCardStyles.removeBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={trainerCardStyles.removeBtnText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            </LinearGradient>
          </View>
        ) : (
          <TouchableOpacity
            style={emptyTrainerStyles.card}
            onPress={onPressMessage}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)']}
              style={emptyTrainerStyles.cardInner}
            >
              <View style={emptyTrainerStyles.iconCircle}>
                <Ionicons name="person-add-outline" size={26} color="rgba(255,255,255,0.3)" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={emptyTrainerStyles.title}>No trainer yet</Text>
                <Text style={emptyTrainerStyles.subtitle}>
                  Find a certified coach to guide your journey
                </Text>
              </View>
              <View style={emptyTrainerStyles.ctaChip}>
                <Text style={emptyTrainerStyles.ctaText}>Browse →</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={screen.actionsRow}>
        {[
            { type: 'icon', iconName: 'chatbubble-outline', label: 'Messages', onPress: onPressMessage, borderColors: ['#FF6B9D', '#C084FC'], badgeCount: unreadMessageCount },
            { type: 'image', source: require('../../assets/icons/picture.png'), label: 'Photo Gallery', onPress: () => onOpenPhotoGallery?.({ id: trainerClientId, name: trainerClientName }), borderColors: ['#06B6D4', '#C084FC'], badgeCount: photoGalleryBadgeCount },
            { type: 'image', source: require('../../assets/icons/New Icons/Google-Gemini-Logo-Transparent.png'), label: 'AI Workouts', onPress: () => onOpenAIWorkouts?.({ id: trainerClientId, name: trainerClientName }), borderColors: ['#FF6B9D', '#F97316'], badgeCount: aiWorkoutsBadgeCount },
          ].map((item) => {
            const getBorderColor = () => {
              switch (item.label) {
                case 'Messages': return 'rgba(255,107,157,0.35)';
                case 'Photo Gallery': return 'rgba(6,182,212,0.35)';
                case 'AI Workouts': return 'rgba(249,115,22,0.35)';
                default: return 'rgba(255,107,157,0.35)';
              }
            };
            const showBadge = (item.badgeCount || 0) > 0;
            return (
              <TouchableOpacity
                key={item.label}
                activeOpacity={0.85}
                style={screen.actionWrapper}
                onPress={item.onPress || (() => {})}
              >
                <View style={[screen.actionCard, { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: getBorderColor(), borderRadius: 16 }]}>
                  <View style={screen.actionIconBlock}>
                    {item.type === 'image' ? (
                      <Image source={item.source} style={{ width: 64, height: 64, resizeMode: 'contain' }} />
                    ) : (
                      <Ionicons name={item.iconName} size={28} color={t.iconColor} />
                    )}
                    {showBadge && (
                      <View style={screen.tabBadge}>
                        <Text style={screen.tabBadgeText}>{item.badgeCount > 99 ? '99+' : item.badgeCount}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[screen.actionLabel, { color: t.text }]}>{item.label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <DataCard
          icon={icon('moon-outline')}
          title="Sleep Data"
          unit="hrs/day"
          placeholder="Enter hours"
          storageKey="dashboard_sleep"
          gradientFrom="#C084FC"
          gradientTo="#FF6B9D"
          min={0}
          max={24}
          defaultExample="8hr/day"
          statusFn={sleepStatus}
          isDark={isDark}
          onAfterSave={(val) => {
            if (!onMetricsChange) return;
            const n = parseFloat(val);
            if (!Number.isNaN(n)) {
              onMetricsChange({ sleepHours: n });
            }
          }}
        />

        <WorkoutLogCard
          icon={icon('barbell-outline')}
          gradientFrom="#F97316"
          gradientTo="#FF6B9D"
          isDark={isDark}
          onAfterSave={(combined, workoutName, workoutExercises) => {
            if (onMetricsChange) onMetricsChange({
              workoutSummary: combined || null,
              workoutName: workoutName || null,
              workoutExercises: workoutExercises || [],
            });
          }}
        />

        <DataCard
          icon={icon('water-outline')}
          title="Water Intake"
          unit="oz"
          placeholder="Enter oz"
          storageKey="dashboard_water"
          gradientFrom="#06B6D4"
          gradientTo="#C084FC"
          min={0}
          max={300}
          defaultExample="80oz"
          statusFn={waterStatus}
          isDark={isDark}
          onAfterSave={(val) => {
            if (!onMetricsChange) return;
            const n = parseFloat(val);
            if (!Number.isNaN(n)) {
              onMetricsChange({ waterIntake: n });
            }
          }}
        />

        <DataCard icon={icon('scale-outline')} title="Current Weight" unit="lbs" placeholder="Enter lbs"
          storageKey="dashboard_weight" gradientFrom="#C084FC" gradientTo="#06B6D4"
          min={0} max={999} defaultExample="165 lbs" isDark={isDark} />

        <DataCard icon={icon('person-outline')} title="Body Fat %" unit="%" placeholder="Enter %"
          storageKey="dashboard_bodyfat" gradientFrom="#FF6B9D" gradientTo="#F97316"
          min={0} max={100} defaultExample="18%" isDark={isDark} />

        <DataCard icon={icon('footsteps-outline')} title="Daily Steps" unit="steps" placeholder="Enter steps"
          storageKey="dashboard_steps" gradientFrom="#06B6D4" gradientTo="#FF6B9D"
          min={0} max={99999} defaultExample="8,432 steps" isDark={isDark} />

        <RatingCard icon={icon('flame-outline')} title="Muscle Soreness" subtitle="Rate how sore you are"
          storageKey="dashboard_soreness" gradientFrom="#F97316" gradientTo="#C084FC" isDark={isDark} />

        <RatingCard icon={icon('flash-outline')} title="Energy Level" subtitle="Rate your energy today"
          storageKey="dashboard_energy" gradientFrom="#C084FC" gradientTo="#F97316" isDark={isDark} />

        <RatingCard icon={icon('pulse-outline')} title="Stress Level" subtitle="How stressed are you?"
          storageKey="dashboard_stress" gradientFrom="#FF6B9D" gradientTo="#06B6D4" isDark={isDark} />

        <MoodCard icon={icon('happy-outline')} title="Mood Check-in" subtitle="How are you feeling?"
          storageKey="dashboard_mood" gradientFrom="#06B6D4" gradientTo="#F97316" isDark={isDark} />

        <ToggleCard icon={icon('leaf-outline')} title="Nutrition Compliance" storageKey="dashboard_nutrition"
          gradientFrom="#C084FC" gradientTo="#FF6B9D"
          questions={[{ label: 'Hit calorie goal today?', key: 'calories' }, { label: 'Hit protein target?', key: 'protein' }]}
          isDark={isDark} />

        <ToggleCard icon={icon('restaurant-outline')} title="Meal Plan" subtitle="Did you follow your plan today?"
          storageKey="dashboard_mealplan" gradientFrom="#F97316" gradientTo="#06B6D4"
          questions={[{ label: 'Followed meal plan?', key: 'followed' }]} isDark={isDark} />

        <ToggleCard icon={icon('medical-outline')} title="Supplements Taken" storageKey="dashboard_supplements"
          gradientFrom="#06B6D4" gradientTo="#C084FC"
          questions={[{ label: 'Took all supplements?', key: 'taken' }]} isDark={isDark} />

        <StarRatingCard icon={icon('star-outline')} title="Post-Workout Rating" subtitle="How was today's session?"
          storageKey="dashboard_workout_rating" gradientFrom="#FF6B9D" gradientTo="#C084FC" isDark={isDark} />

        <NotesCard icon={icon('pencil-outline')} title="Notes to Trainer"
          placeholder="How did you feel today? Any pain or wins?"
          storageKey="dashboard_notes" gradientFrom="#FF6B9D" gradientTo="#F97316" isDark={isDark} />

      </ScrollView>
    </LinearGradient>
  );
};

const screen = StyleSheet.create({
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  backLabel: { fontSize: 16, fontWeight: '600' },
  scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 44 },
  trainerCardWrapper: { marginTop: 12, marginBottom: 20, borderRadius: 20 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 18, marginBottom: 20, alignItems: 'center' },
  actionWrapper: { flex: 1 },
  actionBorder: { borderRadius: 18, padding: 1 },
  actionCard: {
    borderRadius: 17,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionIconBlock: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  actionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.95)',
  },
  actionLabel: { fontSize: 13, fontWeight: '600' },
});

const heroStyles = StyleSheet.create({
  hero: {
    marginHorizontal: 0,
    marginTop: 12,
    marginBottom: 16,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.2)',
  },
  heroContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  greeting: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  heroName: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  heroLottieWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(15,23,42,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroLottie: {
    width: 72,
    height: 72,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 14,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.1)' },
});

const trainerCardStyles = StyleSheet.create({
  cardGradientOuter: {
    borderRadius: 20,
    padding: 1.5,
  },
  card: {
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  left: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(192,132,252,0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(192,132,252,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontSize: 18, fontWeight: '800', color: '#C084FC' },
  trainerName: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  certLine: { fontSize: 11, color: '#64D2FF', marginBottom: 2 },
  specialtyLine: { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  experienceLine: { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  bioLine: { fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 16, marginTop: 2 },
  removeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,107,157,0.4)',
    backgroundColor: 'rgba(255,107,157,0.1)',
  },
  removeBtnText: { fontSize: 11, fontWeight: '700', color: '#FF6B9D' },
});

const emptyTrainerStyles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderStyle: 'dashed',
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.7)', marginBottom: 3 },
  subtitle: { fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 16 },
  ctaChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(192,132,252,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.3)',
  },
  ctaText: { fontSize: 12, fontWeight: '700', color: '#C084FC' },
});

export default MyDashboardScreen;

// ─────────────────────────────────────────────────────────────
// FULL FILE END
// ─────────────────────────────────────────────────────────────
