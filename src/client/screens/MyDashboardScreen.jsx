//
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Animated,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, collection, addDoc, getDoc, onSnapshot, query, where, serverTimestamp, updateDoc, limit } from 'firebase/firestore';
import { auth, db } from '../../app/config';
import { postRemotePushNotify } from '../../shared/services/pushNotifyApi';
import { getLocalDateKey, msUntilLocalMidnight } from '../../shared/utils/localDay';
import { useTheme } from '../../shared/ui/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SessionMeetingCard } from '../../shared/components/SessionMeetingCard';
import PremiumWelcomeCard from '../components/PremiumWelcomeCard';
import PremiumTrainerCard from '../components/PremiumTrainerCard';
import PremiumStatsSection, { GradientBorderShell } from '../components/PremiumStatsSection';
import {
  isAllowedClientWorkoutDayLabel,
  WORKOUT_DAY_EXAMPLES_SHORT,
} from '../../shared/utils/workoutDayLabels';

const msUntilMidnight = () => msUntilLocalMidnight();

const formatHMS = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

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

/** Hide trainer bios that look like keyboard mash / test strings (e.g. many fragments, very low letter ratio). */
const shouldDisplayTrainerBio = (bio) => {
  if (!bio || typeof bio !== 'string') return false;
  const t = bio.trim();
  if (t.length < 4) return false;
  const fragments = t.split(';').filter((x) => x.trim());
  if (fragments.length >= 4) return false;
  const letters = (t.match(/[a-zA-Z]/g) || []).length;
  if (t.length > 24 && letters / t.length < 0.42) return false;
  return true;
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
    let unsubLogs = null;
    let unsubTracking = null;
    const load = async () => {
      const uid = auth?.currentUser?.uid;
      const todayKey = getLocalDateKey();

      const applyLoadedValue = async (valueStr, atIso) => {
        if (valueStr === undefined || valueStr === null || valueStr === '') return false;
        const str = typeof valueStr === 'string' ? valueStr : String(valueStr);
        setSavedValue(str);
        setSavedAt(atIso || new Date().toISOString());
        try {
          await AsyncStorage.setItem(storageKey, str);
          await AsyncStorage.setItem(`${storageKey}_time`, atIso || new Date().toISOString());
        } catch (e) {
          console.warn('useCardState cache write error:', e);
        }
        return true;
      };

      try {
        // 1) Load from AsyncStorage — same calendar day as local midnight
        const stored = await AsyncStorage.getItem(storageKey);
        const storedTime = await AsyncStorage.getItem(`${storageKey}_time`);
        if (stored != null && stored !== '' && storedTime) {
          const parsed = new Date(storedTime);
          if (!Number.isNaN(parsed.getTime())) {
            const storedDateKey = getLocalDateKey(parsed);
            if (storedDateKey === todayKey) {
              setSavedValue(stored);
              setSavedAt(storedTime);
            }
          }
          // If cached value is from a previous day, clear it so we never show stale "today" values.
          if (getLocalDateKey(new Date(storedTime)) !== todayKey) {
            await AsyncStorage.removeItem(storageKey);
            await AsyncStorage.removeItem(`${storageKey}_time`);
          }
        }

        if (!uid || !db) return;

        // 2) dailyLogs (canonical for dashboard fields) — real-time listener
        const logsRef = doc(db, 'users', uid, 'dailyLogs', todayKey);
        unsubLogs = onSnapshot(
          logsRef,
          (snap) => {
            if (!snap.exists()) return;
            const data = snap.data() || {};
            applyLoadedValue(data[storageKey], data.updatedAt?.toDate?.()?.toISOString?.());
          },
          (e) => console.warn('dailyLogs listener error:', e?.code || e?.message || e),
        );

        // 3) daily_tracking — home screen often saves water & sleep here only (also real-time)
        const trackRef = doc(db, 'users', uid, 'daily_tracking', todayKey);
        unsubTracking = onSnapshot(
          trackRef,
          (snap) => {
            if (!snap.exists()) return;
            const td = snap.data() || {};
            if (storageKey === 'dashboard_water' && td.waterIntake != null && td.waterIntake !== '') {
              applyLoadedValue(td.waterIntake, td.updatedAt?.toDate?.()?.toISOString?.());
            }
            if (storageKey === 'dashboard_sleep' && td.sleepHours != null && td.sleepHours !== '') {
              applyLoadedValue(td.sleepHours, td.updatedAt?.toDate?.()?.toISOString?.());
            }
          },
          (e) => console.warn('daily_tracking listener error:', e?.code || e?.message || e),
        );
      } catch (e) {
        console.warn('useCardState load error:', e);
      }
    };
    load();
    return () => {
      try { unsubLogs?.(); } catch (_) {}
      try { unsubTracking?.(); } catch (_) {}
    };
  }, [storageKey, auth?.currentUser?.uid]);

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
    const dateKey = getLocalDateKey();
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
    const dateKey = getLocalDateKey();
    const logsRef = doc(db, 'users', uid, 'dailyLogs', dateKey);
    const trackingRef = doc(db, 'users', uid, 'daily_tracking', dateKey);

    let alive = true;
    let lastLogsSnap = null;
    let lastTrackingSnap = null;

    const hydrate = async () => {
      if (!alive || !lastLogsSnap || !lastTrackingSnap) return;

      let d = lastLogsSnap.exists() ? (lastLogsSnap.data() || {}) : {};
      const td = lastTrackingSnap.exists() ? (lastTrackingSnap.data() || {}) : {};

      let fromLogs =
        (Array.isArray(d.workoutLog) && d.workoutLog.length > 0) ||
        (Array.isArray(d.dashboard_workout_exercises) && d.dashboard_workout_exercises.length > 0) ||
        (d.dashboard_workout_name && String(d.dashboard_workout_name).trim());

      if (!fromLogs) {
        if (td.workoutName || (Array.isArray(td.workoutExercises) && td.workoutExercises.length)) {
          d = {
            ...d,
            dashboard_workout_name: td.workoutName || d.dashboard_workout_name || '',
            workoutLog: Array.isArray(td.workoutExercises) && td.workoutExercises.length
              ? td.workoutExercises.map((ex) => ({
                  exerciseName: ex.name || ex.exerciseName || ex.label || '',
                  sets: Array.isArray(ex.sets)
                    ? ex.sets.map((s) => ({
                        reps: s.reps != null ? s.reps : 0,
                        weight: s.weight != null ? s.weight : 0,
                      }))
                    : [],
                }))
              : d.workoutLog,
          };
          fromLogs = true;
        } else if (td.workoutSummary && String(td.workoutSummary).trim()) {
          d = {
            ...d,
            dashboard_workout_name: String(td.workoutSummary).split('\n')[0].trim() || d.dashboard_workout_name,
            dashboard_workouts: td.workoutSummary,
          };
          fromLogs = true;
        }
      }

      if (!fromLogs) {
        setWorkoutExercises([makeExercise()]);
        setLoaded(true);
        return;
      }

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
    };

    const unsubLogs = onSnapshot(
      logsRef,
      (snap) => {
        lastLogsSnap = snap;
        hydrate();
      },
      () => {
        setWorkoutExercises([makeExercise()]);
        setLoaded(true);
      },
    );
    const unsubTracking = onSnapshot(
      trackingRef,
      (snap) => {
        lastTrackingSnap = snap;
        hydrate();
      },
      () => {
        setWorkoutExercises([makeExercise()]);
        setLoaded(true);
      },
    );

    return () => {
      alive = false;
      try { unsubLogs?.(); } catch (_) {}
      try { unsubTracking?.(); } catch (_) {}
    };
  }, [auth?.currentUser?.uid]);

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

    const dateKey = getLocalDateKey();
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

    const hasDraftWorkoutContent =
      name !== '' ||
      structured.length > 0 ||
      workoutExercises.some((ex) => ex.name.trim() || ex.sets.some((s) => s.reps !== '' || s.weight !== ''));

    if (hasDraftWorkoutContent) {
      if (!name) {
        Alert.alert(
          'Workout day required',
          `Enter a real training day for today (e.g. ${WORKOUT_DAY_EXAMPLES_SHORT}).`,
        );
        return;
      }
      if (!isAllowedClientWorkoutDayLabel(name)) {
        Alert.alert(
          'Incorrect workout day',
          `That doesn't look like a valid training day. Try something like ${WORKOUT_DAY_EXAMPLES_SHORT}, then save again.`,
        );
        return;
      }
    }

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

const WorkoutLogCard = ({ icon, gradientFrom, gradientTo, isDark, onAfterSave, state }) => {
  const t = isDark ? DARK : LIGHT;
  const logState = state || useWorkoutLog(onAfterSave);
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
  } = logState;
  const [isEditing, setIsEditing] = useState(false);

  if (!loaded) return null;

  const showForm = !hasValue || isEditing;
  const statusBadge = hasValue ? workoutStatus(workoutName) : null;

  return (
    <CardShell
      icon={icon}
      title="Workouts Today"
      subtitle={showForm ? 'Log exercises, sets, and weight for today.' : undefined}
      gradientFrom={gradientFrom}
      gradientTo={gradientTo}
      topBorderColors={['#FF6B9D', '#C084FC', '#FF6B9D']}
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
            placeholder={`Workout day — ${WORKOUT_DAY_EXAMPLES_SHORT}`}
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
                  <Text style={{ width: 40, fontSize: 12, color: t.textDimmed }}>
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
                  <Text style={{ marginHorizontal: 16, fontSize: 12, color: t.textDimmed }}>×</Text>
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
                    <Ionicons name="trash-outline" size={16} color={t.textDimmed} />
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
                  backgroundColor: t.pillBg,
                  borderWidth: 1,
                  borderColor: t.pillBorder,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Ionicons name="add-circle-outline" size={18} color={t.pillText} />
                <Text style={{ fontSize: 13, color: t.pillText, textAlign: 'center' }}>Add Set</Text>
              </TouchableOpacity>
              <View
                style={{
                  height: 1,
                  marginTop: 10,
                  backgroundColor: t.cardBorder,
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
              borderColor: t.pillBorder,
              backgroundColor: t.pillBg,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="add-outline" size={16} color={t.pillText} />
            <Text style={{ fontSize: 14, color: t.pillText }}>Add Exercise</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={save} activeOpacity={0.85}>
            <LinearGradient
              colors={[gradientFrom, gradientTo]}
              style={[data.saveBtn, { minHeight: 56, paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }]}
            >
              <Text style={[data.saveBtnText, { fontSize: 16 }]}>Save workout</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <Text style={[logCompleted.loggedTag, { color: '#10B981' }]}>WORKOUT LOGGED ✓</Text>
          <Text style={[logCompleted.todayLine, { color: t.textMuted }]}>
            Today — <Text style={{ color: t.text, fontWeight: '800' }}>{workoutName || 'Workout'}</Text>
          </Text>
          <Text style={[logCompleted.sectionLabel, { color: t.textMuted }]}>EXERCISES COMPLETED</Text>
          <View style={[logCompleted.summaryBox, { borderColor: t.inputBorder, backgroundColor: t.inputBg }]}>
            {workoutExercises
              .filter((ex) => ex.name.trim())
              .map((ex) => (
                <View key={ex.id} style={{ marginBottom: 12 }}>
                  <Text style={[logCompleted.exerciseName, { color: t.text }]}>{ex.name.trim()}</Text>
                  {ex.sets.map((set, si) => {
                    const r = String(set.reps || '').trim() || '—';
                    const w = String(set.weight || '').trim() || '—';
                    return (
                      <Text key={set.id} style={[logCompleted.setLine, { color: t.textMuted }]}>
                        Set {si + 1}: {r} reps × {w} lbs
                      </Text>
                    );
                  })}
                </View>
              ))}
          </View>
          <View style={logCompleted.actionRow}>
            <TouchableOpacity onPress={() => setIsEditing(true)} activeOpacity={0.85} style={logCompleted.textBtn}>
              <Text style={[logCompleted.textBtnLabel, { color: '#FF6B9D' }]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsEditing(true)} activeOpacity={0.85} style={logCompleted.textBtn}>
              <Text style={[logCompleted.textBtnLabel, { color: '#64D2FF' }]}>Add more</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </CardShell>
  );
};

const QuickStatsRow = ({ isDark, todayCalories, sleepHoursValue, waterOz }) => {
  const t = isDark ? DARK : LIGHT;
  return (
    <View style={{ marginTop: 12 }}>
      <View style={[quickStatsStyles.row, { backgroundColor: t.cardBg, borderColor: t.border }]}>
        <View style={quickStatsStyles.item}>
          <Text style={[quickStatsStyles.valueSolid, { color: '#E879F9' }]}>{`${todayCalories || 0}`}</Text>
          <Text style={[quickStatsStyles.label, { color: t.textMuted }]}>Calories</Text>
        </View>
        <View style={[quickStatsStyles.divider, { backgroundColor: t.border }]} />
        <View style={quickStatsStyles.item}>
          <Text style={[quickStatsStyles.value, { color: t.text }]}>{typeof sleepHoursValue === 'number' ? sleepHoursValue : 0}</Text>
          <Text style={[quickStatsStyles.label, { color: t.textMuted }]}>Sleep (hrs)</Text>
        </View>
        <View style={[quickStatsStyles.divider, { backgroundColor: t.border }]} />
        <View style={quickStatsStyles.item}>
          <Text style={[quickStatsStyles.value, { color: t.text }]}>{waterOz || 0}oz</Text>
          <Text style={[quickStatsStyles.label, { color: t.textMuted }]}>Water</Text>
        </View>
      </View>
    </View>
  );
};

const quickStatsStyles = StyleSheet.create({
  row: { borderRadius: 16, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  divider: { width: 1, height: 34, opacity: 0.9 },
  value: { fontSize: 18, fontWeight: '900' },
  valueSolid: { fontSize: 20, fontWeight: '800' },
  label: { marginTop: 4, fontSize: 11, fontWeight: '700' },
});

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

const logCompleted = StyleSheet.create({
  loggedTag: { fontSize: 12, fontWeight: '900', letterSpacing: 0.6 },
  todayLine: { fontSize: 13, fontWeight: '600' },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginTop: 4 },
  summaryBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginTop: 6,
  },
  exerciseName: { fontSize: 15, fontWeight: '900', marginBottom: 6 },
  setLine: { fontSize: 13, fontWeight: '600', marginLeft: 2, marginBottom: 3 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 8 },
  textBtn: { paddingVertical: 4 },
  textBtnLabel: { fontSize: 14, fontWeight: '800' },
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

const shellIconRender = (icon) =>
  React.isValidElement(icon)
    ? React.cloneElement(icon, {
        color: 'rgba(255,255,255,0.95)',
        size: Math.max(Number(icon.props?.size) || 0, 24),
      })
    : icon;

const CardShell = ({
  icon,
  title,
  subtitle: headerSubtitle,
  gradientFrom,
  gradientTo,
  topBorderColors,
  statusBadge,
  showNotified,
  hasSavedValue,
  isDark,
  children,
  accentColor,
  rightAction,
}) => {
  const t = isDark ? DARK : LIGHT;
  const notifiedOpacity = useRef(new Animated.Value(0)).current;
  const accent = accentColor != null ? accentColor : gradientFrom;
  const topColors = topBorderColors || [gradientFrom, gradientTo, gradientFrom];

  useEffect(() => {
    if (showNotified) {
      Animated.sequence([
        Animated.timing(notifiedOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(2400),
        Animated.timing(notifiedOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [showNotified]);

  const cardBg = isDark ? '#13131A' : '#FFFFFF';
  const borderCol = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(10,10,15,0.1)';

  return (
    <View
      style={[
        shell.outer,
        Platform.OS === 'ios' && {
          shadowColor: '#000000',
          shadowRadius: 14,
          shadowOpacity: isDark ? 0.35 : 0.12,
          shadowOffset: { width: 0, height: 6 },
        },
      ]}
    >
      <View style={shell.clip}>
        <LinearGradient
          colors={topColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={shell.topBar}
        />
        <View style={[shell.body, { backgroundColor: cardBg, borderColor: borderCol }]}>
          <View
            style={[shell.innerWash, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.6)' }]}
            pointerEvents="none"
          />
          {rightAction ? <View style={shell.rightAction}>{rightAction}</View> : null}
          {statusBadge ? (
            <View style={[shell.badge, { backgroundColor: t.pillBg, borderColor: t.pillBorder }]}>
              <Ionicons name="checkmark-circle" size={14} color="#10B981" style={shell.badgeIcon} />
              <Text style={[shell.badgeText, { color: t.pillText }]}>{statusBadge}</Text>
            </View>
          ) : null}

          <View style={shell.headerRow}>
            <View
              style={[
                shell.iconCircle,
                {
                  backgroundColor: isDark ? `${accent}2E` : `${accent}22`,
                  borderColor: isDark ? `${accent}55` : `${accent}40`,
                },
              ]}
            >
              {shellIconRender(icon)}
            </View>
            <View style={shell.headerTextCol}>
              <Text style={[shell.title, { color: t.text }]}>{title}</Text>
              {headerSubtitle ? (
                <Text style={[shell.headerSubtitle, { color: t.textMuted }]}>{headerSubtitle}</Text>
              ) : null}
            </View>
          </View>

          <View style={shell.childrenWrap}>{children}</View>

          {showNotified ? (
            <Animated.View style={[shell.notified, { opacity: notifiedOpacity }]}>
              <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
              <Text style={shell.notifiedText}>Trainer notified</Text>
            </Animated.View>
          ) : !hasSavedValue ? (
            <Text style={[shell.subtleNote, { color: t.textSubtle }]}>✓ Trainer notified when entered</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const shell = StyleSheet.create({
  outer: {
    marginBottom: 16,
    elevation: 5,
  },
  clip: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  topBar: {
    height: 3,
    width: '100%',
  },
  body: {
    borderWidth: 1,
    borderTopWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    position: 'relative',
  },
  innerWash: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.85,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 12,
    gap: 6,
  },
  badgeIcon: { marginRight: 0 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, zIndex: 1 },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerTextCol: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 13, fontWeight: '500', marginTop: 4, lineHeight: 18 },
  childrenWrap: { marginTop: 16, zIndex: 1 },
  rightAction: { position: 'absolute', top: 14, right: 14, zIndex: 3 },
  notified: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, zIndex: 1 },
  notifiedText: { fontSize: 12, fontWeight: '700', color: '#22c55e' },
  subtleNote: { fontSize: 11, marginTop: 10, fontWeight: '600', zIndex: 1 },
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
  variant = 'default',
  bentoHeight = 100,
  bentoLabel,
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
  const subtitleText = (() => {
    if (statusBadge) return statusBadge;

    // For dashboard bento metrics, show the value's meaning under the number (e.g., "8 hours", "90 oz").
    if (variant === 'bentoMetric' && unit && String(unit).trim()) {
      const u = String(unit).trim();
      const hasSaved = savedValue !== null && savedValue !== undefined && String(savedValue).trim() !== '';
      if (!hasSaved) return u;

      const sv = String(savedValue);
      if (u === 'hrs/day') return `${sv} hours`;
      if (u === 'oz') return `${sv} oz`;
      if (u === 'lbs') return `${sv} lbs`;
      if (u === '%') return `${sv}%`;
      if (u === 'steps') return `${sv} steps`;
      if (u.endsWith('/day')) return `${sv} ${u.replace('/day', '').trim()}`;
      return `${sv} ${u}`;
    }

    if (unit && String(unit).trim()) return unit;
    return savedValue ? `Updated ${getTimeSince()}` : `Updated ${getTimeSince()}`;
  })();

  if (variant === 'bentoMetric') {
    const isTall = bentoHeight >= 120;
    const isStepsCard = String(storageKey || '').trim() === 'dashboard_steps';
    const numericLen = String(savedValue ?? '0').replace(/\D/g, '').length;
    const valueFontSize =
      isStepsCard && numericLen >= 5 ? (isTall ? 30 : 26) : isTall ? 36 : 32;
    const cardBg = t.cardBg;
    const cardBorder = t.cardBorder;

    return (
      <View
        style={[
          bentoMetric.card,
          {
            height: bentoHeight,
            backgroundColor: cardBg,
            borderColor: cardBorder,
          },
        ]}
      >
        <Text style={[bentoMetric.label, { color: t.textMuted }]}>{(bentoLabel || title || '').toUpperCase()}</Text>

        {showInput ? (
          <View style={bentoMetric.inputArea}>
            <TextInput
              style={[
                bentoMetric.input,
                {
                  backgroundColor: t.inputBg,
                  borderColor: error ? 'rgba(239,68,68,0.6)' : t.inputBorder,
                  color: t.text,
                },
              ]}
              value={value}
              onChangeText={(v) => {
                setValue(v);
                setError(false);
              }}
              placeholder={placeholder}
              placeholderTextColor={t.textMuted}
              keyboardType={textMode ? 'default' : 'numeric'}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
            <TouchableOpacity onPress={handleSave} activeOpacity={0.85} hitSlop={6}>
              <LinearGradient colors={[gradientFrom, gradientTo]} style={bentoMetric.saveBtn}>
                <Text style={data.saveBtnText}>Save</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => {
              setIsEditing(true);
              setValue(savedValue || '');
            }}
            activeOpacity={0.85}
            style={bentoMetric.contentTouchable}
          >
            <View style={bentoMetric.valueStack}>
              <Text
                style={[
                  bentoMetric.valueText,
                  {
                    fontSize: valueFontSize,
                    // Original behavior: tint values by the card's accent.
                    color: gradientFrom,
                  },
                ]}
              >
                {`${savedValue ?? 0}`}
              </Text>
              <Text style={[bentoMetric.subtitle, { color: t.textMuted }]}>{subtitleText}</Text>
            </View>
          </TouchableOpacity>
        )}

        {showNotified ? (
          <View style={bentoMetric.notified}>
            <Ionicons name="checkmark" size={14} color="#22c55e" />
          </View>
        ) : null}
      </View>
    );
  }

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

const bentoMetric = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    overflow: 'hidden',
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 10,
    lineHeight: 14,
    zIndex: 1,
  },
  inputArea: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    gap: 10,
    paddingTop: 2,
  },
  input: {
    width: '100%',
    height: 40,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    textAlign: 'center',
  },
  saveBtn: {
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 8,
    alignSelf: 'center',
  },
  contentTouchable: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 2,
  },
  valueStack: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    flexShrink: 1,
  },
  valueText: {
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  notified: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const sorenessInterpret = (n) => {
  if (n <= 2) return 'Low soreness — recovery looks on track.';
  if (n <= 4) return 'Light soreness — typical after hard training.';
  if (n <= 6) return 'Moderate soreness — give your body time to recover.';
  return 'High soreness — prioritize rest, sleep, and mobility.';
};
const energyInterpret = (n) => {
  if (n <= 2) return 'Low energy — focus on sleep, fuel, and lighter stimulus.';
  if (n <= 4) return 'Below average — consider active recovery or easier volume.';
  if (n <= 6) return 'Steady energy — you can train; stay aware of effort.';
  if (n <= 7) return 'Strong energy — a good day to progress.';
  return 'High energy — great day to push quality reps.';
};
const stressInterpret = (n) => {
  if (n <= 2) return 'Low stress — manageable day.';
  if (n <= 4) return 'Mild stress — keep routines that help you downshift.';
  if (n <= 6) return 'Moderate stress — protect recovery and sleep.';
  return 'High stress — simplify training and create breathing room.';
};
const workoutRatingInterpret = (n, max) => {
  const p = n / max;
  if (p <= 0.35) return 'Light session — it still counts toward consistency.';
  if (p <= 0.55) return 'Solid effort — room to keep building.';
  if (p <= 0.75) return 'Strong session — nice work staying engaged.';
  if (p <= 0.9) return 'Great session — you pushed with intent.';
  return 'Outstanding effort — be proud of this one.';
};

const RatingCard = ({
  icon,
  title,
  subtitle,
  storageKey,
  gradientFrom,
  gradientTo,
  isDark,
  onAfterSave,
  maxRating = 8,
  topBorderColors,
  interpretFn,
}) => {
  const t = isDark ? DARK : LIGHT;
  const { savedValue, showNotified, save } = useCardState(storageKey, onAfterSave);
  const [editing, setEditing] = useState(false);
  const nums = Array.from({ length: maxRating }, (_, i) => i + 1);
  const nSaved = savedValue ? parseInt(String(savedValue), 10) : NaN;
  const showPicker = !savedValue || editing;
  const line =
    interpretFn && Number.isFinite(nSaved) && nSaved >= 1 ? interpretFn(nSaved, maxRating) : '';

  const handlePick = (n) => {
    save(String(n));
    setEditing(false);
  };

  return (
    <CardShell
      icon={icon}
      title={title}
      subtitle={showPicker ? subtitle : undefined}
      gradientFrom={gradientFrom}
      gradientTo={gradientTo}
      topBorderColors={topBorderColors}
      showNotified={showNotified}
      hasSavedValue={!!savedValue}
      isDark={isDark}
      accentColor={CARD_ACCENT[storageKey]}
    >
      {!showPicker ? (
        <View style={{ gap: 10 }}>
          <Text style={[rating.loggedTag, { color: '#10B981' }]}>RATING LOGGED ✓</Text>
          <Text style={[rating.summaryBig, { color: t.text }]}>
            You rated:{' '}
            <Text style={{ color: '#FF6B9D' }}>{savedValue}</Text> out of {maxRating}
          </Text>
          <Text style={[rating.interpret, { color: t.textMuted }]}>{line}</Text>
          <TouchableOpacity onPress={() => setEditing(true)} hitSlop={8} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
            <Text style={{ color: '#64D2FF', fontWeight: '800', fontSize: 14 }}>Edit rating</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ marginTop: 2 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={rating.pillScroll}>
            {nums.map((n) => {
              const isActive = String(n) === String(savedValue || '');
              return (
                <TouchableOpacity key={n} onPress={() => handlePick(n)} activeOpacity={0.88}>
                  {isActive ? (
                    <LinearGradient colors={['#FF6B9D', '#C084FC']} style={rating.pillActive}>
                      <Text style={[rating.pillTextActive]}>{n}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[rating.pillIdle, { backgroundColor: t.inputBg, borderColor: t.inputBorder }]}>
                      <Text style={[rating.pillTextIdle, { color: t.textMuted }]}>{n}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </CardShell>
  );
};

const rating = StyleSheet.create({
  loggedTag: { fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  summaryBig: { fontSize: 18, fontWeight: '800' },
  interpret: { fontSize: 13, lineHeight: 20, fontWeight: '600' },
  subtitle: { fontSize: 12, marginTop: 2 },
  pillScroll: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 4 },
  pillActive: {
    minWidth: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  pillIdle: {
    minWidth: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingHorizontal: 6,
  },
  pillTextActive: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  pillTextIdle: { fontSize: 14, fontWeight: '800' },
  pillArea: { flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'center' },
  pill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { fontSize: 12, fontWeight: '800' },
  currentValueWrap: { width: 48, alignItems: 'flex-end', justifyContent: 'center' },
  currentValue: { fontSize: 26, fontWeight: '900' },
  row: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'flex-end' },
  clearWrap: { alignItems: 'center', justifyContent: 'center' },
  clearLabel: { fontSize: 9, fontWeight: '600', marginTop: 2 },
});

const MOOD_EMOJIS = ['😞', '😕', '😐', '🙂', '😄'];
const MOOD_LABELS = ['Very low', 'Low', 'Okay', 'Good', 'Great'];

const MoodCard = ({ icon, title, subtitle, storageKey, gradientFrom, gradientTo, isDark }) => {
  const t = isDark ? DARK : LIGHT;
  const { savedValue, showNotified, save } = useCardState(storageKey);
  const [editing, setEditing] = useState(false);
  const idx = savedValue != null && savedValue !== '' ? parseInt(String(savedValue), 10) : NaN;
  const showPicker = !Number.isFinite(idx) || editing;
  const emoji = Number.isFinite(idx) && MOOD_EMOJIS[idx] ? MOOD_EMOJIS[idx] : null;
  const label = Number.isFinite(idx) && MOOD_LABELS[idx] ? MOOD_LABELS[idx] : '';

  return (
    <CardShell
      icon={icon}
      title={title}
      subtitle={showPicker ? subtitle || 'How are you feeling today?' : undefined}
      gradientFrom={gradientFrom}
      gradientTo={gradientTo}
      topBorderColors={['#06B6D4', '#3B82F6', '#06B6D4']}
      showNotified={showNotified}
      hasSavedValue={!!savedValue}
      isDark={isDark}
      accentColor={CARD_ACCENT[storageKey]}
    >
      {!showPicker ? (
        <View style={{ gap: 10 }}>
          <Text style={[rating.loggedTag, { color: '#10B981' }]}>MOOD LOGGED ✓</Text>
          <Text style={{ fontSize: 40, textAlign: 'left' }}>{emoji}</Text>
          <Text style={[rating.summaryBig, { color: t.text }]}>
            You're feeling:{' '}
            <Text style={{ color: '#64D2FF' }}>{label}</Text>
          </Text>
          <Text style={[rating.interpret, { color: t.textMuted }]}>Nice! Keep checking in — it helps your coach support you.</Text>
          <TouchableOpacity onPress={() => setEditing(true)} hitSlop={8}>
            <Text style={{ color: '#FF6B9D', fontWeight: '800', fontSize: 14 }}>Edit mood</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[mood.emojiCard, { borderColor: t.inputBorder, backgroundColor: t.inputBg }]}>
          <View style={mood.emojiRow}>
            {MOOD_EMOJIS.map((em, i) => {
              const isActive = String(savedValue) === String(i);
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => {
                    save(String(i));
                    setEditing(false);
                  }}
                  activeOpacity={0.9}
                  style={[
                    mood.emojiBtn,
                    isActive && mood.emojiBtnActive,
                    {
                      borderColor: isActive ? '#FF6B9D' : 'transparent',
                      backgroundColor: isActive ? (isDark ? 'rgba(255,107,157,0.2)' : 'rgba(255,107,157,0.12)') : 'transparent',
                    },
                  ]}
                >
                  <Text style={[mood.emojiText, { opacity: isActive ? 1 : 0.45 }]}>{em}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </CardShell>
  );
};

const mood = StyleSheet.create({
  emojiCard: {
    marginTop: 4,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  emojiRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between', paddingHorizontal: 2 },
  emojiBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  emojiBtnActive: {
    transform: [{ scale: 1.06 }],
  },
  emojiText: { fontSize: 24 },
});

const ToggleCard = ({ icon, title, subtitle, storageKey, gradientFrom, gradientTo, questions, isDark }) => {
  const t = isDark ? DARK : LIGHT;
  const { savedValue, showNotified, save } = useCardState(storageKey);
  const values = savedValue ? (() => { try { return JSON.parse(savedValue); } catch { return {}; } })() : {};
  const hasAnyValue = Object.keys(values).length > 0;
  const handleToggle = (key, val) => { const updated = { ...values, [key]: val }; save(JSON.stringify(updated)); };
  return (
    <CardShell
      icon={icon}
      title={title}
      subtitle={subtitle}
      gradientFrom={gradientFrom}
      gradientTo={gradientTo}
      showNotified={showNotified}
      hasSavedValue={hasAnyValue}
      isDark={isDark}
      accentColor={CARD_ACCENT[storageKey]}
    >
      <View style={{ gap: 8, marginTop: 2 }}>
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

const ComplianceCard = ({ isDark }) => {
  const t = isDark ? DARK : LIGHT;

  const nutrition = useCardState('dashboard_nutrition');
  const mealplan = useCardState('dashboard_mealplan');
  const supplements = useCardState('dashboard_supplements');

  const parseValues = (saved) => (saved ? (() => { try { return JSON.parse(saved); } catch { return {}; } })() : {});

  const nutritionValues = parseValues(nutrition.savedValue);
  const mealplanValues = parseValues(mealplan.savedValue);
  const supplementsValues = parseValues(supplements.savedValue);

  const anyNotified = nutrition.showNotified || mealplan.showNotified || supplements.showNotified;

  const handleToggle = (storageGroup, key, val) => {
    const apply = (values, saveFn) => {
      const updated = { ...values, [key]: val };
      saveFn(JSON.stringify(updated));
    };
    if (storageGroup === 'nutrition') return apply(nutritionValues, nutrition.save);
    if (storageGroup === 'mealplan') return apply(mealplanValues, mealplan.save);
    return apply(supplementsValues, supplements.save);
  };

  const yesNoButtons = ({ storageGroup, keyName, gradientFrom, gradientTo }) => {
    const valuesByGroup =
      storageGroup === 'nutrition' ? nutritionValues : storageGroup === 'mealplan' ? mealplanValues : supplementsValues;
    const selected = valuesByGroup[keyName];
    const yesActive = selected === 'Yes';
    const noActive = selected === 'No';

    const baseBtnStyle = {
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: t.pillBorder,
    };

    return (
      <View style={compliance.toggleBtnRow}>
        {['Yes', 'No'].map((opt) => {
          const optActive = opt === 'Yes' ? yesActive : noActive;
          if (opt === 'Yes') {
            return (
              <TouchableOpacity
                key={opt}
                activeOpacity={0.9}
                onPress={() => handleToggle(storageGroup, keyName, opt)}
              >
                {optActive ? (
                  <LinearGradient colors={[gradientFrom, gradientTo]} style={{ ...baseBtnStyle, borderWidth: 0 }}>
                    <Text style={[compliance.toggleText, { color: 'white' }]}>{opt}</Text>
                  </LinearGradient>
                ) : (
                  <View style={{ ...baseBtnStyle, backgroundColor: t.pillBg }}>
                    <Text style={[compliance.toggleText, { color: t.pillText }]}>{opt}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={opt}
              activeOpacity={0.9}
              onPress={() => handleToggle(storageGroup, keyName, opt)}
            >
              {optActive ? (
                <View
                  style={{
                    ...baseBtnStyle,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)',
                    borderWidth: 1,
                  }}
                >
                  <Text style={[compliance.toggleText, { color: isDark ? 'rgba(255,255,255,0.92)' : 'rgba(30,16,64,0.9)' }]}>{opt}</Text>
                </View>
              ) : (
                <View style={{ ...baseBtnStyle, backgroundColor: t.pillBg }}>
                  <Text style={[compliance.toggleText, { color: t.pillText }]}>{opt}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const answered = (obj, key) =>
    obj && Object.prototype.hasOwnProperty.call(obj, key) && (obj[key] === 'Yes' || obj[key] === 'No');

  const allAnswered =
    answered(nutritionValues, 'calories') &&
    answered(nutritionValues, 'protein') &&
    answered(mealplanValues, 'followed') &&
    answered(supplementsValues, 'taken');

  const yesCount = [
    nutritionValues.calories === 'Yes',
    nutritionValues.protein === 'Yes',
    mealplanValues.followed === 'Yes',
    supplementsValues.taken === 'Yes',
  ].filter(Boolean).length;

  const complianceLines = [
    { label: 'Hit calorie goal today?', val: nutritionValues.calories },
    { label: 'Hit protein target?', val: nutritionValues.protein },
    { label: 'Followed meal plan?', val: mealplanValues.followed },
    { label: 'Took all supplements?', val: supplementsValues.taken },
  ];

  const cardBg = isDark ? '#13131A' : '#FFFFFF';
  const borderCol = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(10,10,15,0.1)';

  return (
    <View
      style={[
        compliance.outerWrap,
        Platform.OS === 'ios' && {
          shadowColor: '#000',
          shadowOpacity: isDark ? 0.35 : 0.12,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
        },
      ]}
    >
      <View style={shell.clip}>
        <LinearGradient
          colors={['#10B981', '#06B6D4', '#10B981']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={shell.topBar}
        />
        <View style={[compliance.cardBody, { backgroundColor: cardBg, borderColor: borderCol }]}>
          <View
            style={[compliance.innerWash, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.65)' }]}
            pointerEvents="none"
          />
          <View style={compliance.headerRow}>
            <View style={compliance.titleRow}>
              <View style={compliance.headerIcon}>
                <Ionicons name="shield-checkmark" size={24} color="rgba(255,255,255,0.95)" />
              </View>
              <View>
                <Text style={[compliance.headerTitle, { color: t.text }]}>Today&apos;s Compliance</Text>
                <Text style={[compliance.headerSub, { color: t.textMuted }]}>Quick yes/no — your coach sees this on the daily log.</Text>
              </View>
            </View>
            {anyNotified ? (
              <View style={compliance.headerNotified}>
                <Ionicons name="checkmark" size={14} color="#22c55e" />
              </View>
            ) : null}
          </View>

          {allAnswered ? (
            <View style={[compliance.summaryBox, { borderColor: t.inputBorder, backgroundColor: t.inputBg }]}>
              <Text style={[compliance.loggedTag, { color: '#10B981' }]}>COMPLIANCE LOGGED ✓</Text>
              {complianceLines.map((row) => (
                <Text key={row.label} style={[compliance.summaryLine, { color: t.text }]}>
                  {row.val === 'Yes' ? '✓ ' : '○ '}
                  {row.label}{' '}
                  <Text style={{ fontWeight: '900', color: row.val === 'Yes' ? '#10B981' : '#F97316' }}>{row.val}</Text>
                </Text>
              ))}
              <Text style={[compliance.scoreLine, { color: t.textMuted }]}>
                Score:{' '}
                <Text style={{ color: t.text, fontWeight: '900' }}>
                  {yesCount}/4
                </Text>
                {yesCount === 4 ? ' — Full marks today!' : yesCount >= 3 ? ' — Great day!' : ' — Keep stacking wins.'}
              </Text>
            </View>
          ) : null}

          <View style={compliance.rowsWrap}>
          {/* Nutrition */}
          <View style={compliance.row}>
            <Text style={[compliance.rowLabel, { color: t.textMuted }]}>Hit calorie goal today?</Text>
            {yesNoButtons({
              storageGroup: 'nutrition',
              keyName: 'calories',
              gradientFrom: '#C084FC',
              gradientTo: '#FF6B9D',
            })}
          </View>
          <View style={[compliance.divider, { backgroundColor: t.cardBorder }]} />

          <View style={compliance.row}>
            <Text style={[compliance.rowLabel, { color: t.textMuted }]}>Hit protein target?</Text>
            {yesNoButtons({
              storageGroup: 'nutrition',
              keyName: 'protein',
              gradientFrom: '#C084FC',
              gradientTo: '#FF6B9D',
            })}
          </View>
          <View style={[compliance.divider, { backgroundColor: t.cardBorder }]} />

          {/* Meal plan */}
          <View style={compliance.row}>
            <Text style={[compliance.rowLabel, { color: t.textMuted }]}>Followed meal plan?</Text>
            {yesNoButtons({
              storageGroup: 'mealplan',
              keyName: 'followed',
              gradientFrom: '#F97316',
              gradientTo: '#06B6D4',
            })}
          </View>
          <View style={[compliance.divider, { backgroundColor: t.cardBorder }]} />

          {/* Supplements */}
          <View style={compliance.row}>
            <Text style={[compliance.rowLabel, { color: t.textMuted }]}>Took all supplements?</Text>
            {yesNoButtons({
              storageGroup: 'supplements',
              keyName: 'taken',
              gradientFrom: '#06B6D4',
              gradientTo: '#C084FC',
            })}
          </View>
        </View>
        </View>
      </View>
    </View>
  );
};

const compliance = StyleSheet.create({
  outerWrap: {
    marginBottom: 16,
    elevation: 5,
  },
  cardBody: {
    borderWidth: 1,
    borderTopWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    position: 'relative',
  },
  innerWash: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.85,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
    zIndex: 1,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(16,185,129,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '900', letterSpacing: -0.2 },
  headerSub: { fontSize: 12, fontWeight: '600', marginTop: 4, lineHeight: 17 },
  summaryBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    zIndex: 1,
    gap: 6,
  },
  loggedTag: { fontSize: 11, fontWeight: '900', letterSpacing: 0.6, marginBottom: 6 },
  summaryLine: { fontSize: 13, fontWeight: '600', lineHeight: 20 },
  scoreLine: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  headerNotified: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(34,197,94,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
  },
  rowsWrap: {},
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  rowLabel: { fontSize: 12, flex: 1, paddingRight: 10, fontWeight: '600' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  toggleBtnRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  toggleText: { fontSize: 12, fontWeight: '800' },
});

const NotesCard = ({ icon, title, placeholder, storageKey, gradientFrom, gradientTo, isDark }) => {
  const t = isDark ? DARK : LIGHT;
  const { savedValue, showNotified, save, getTimeSince } = useCardState(storageKey);
  const [value, setValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const showInput = isEditing;
  const handleSave = () => {
    if (!value.trim()) return;
    save(value);
    setIsEditing(false);
  };

  const startEdit = () => {
    setIsEditing(true);
    setValue(savedValue || '');
  };
  return (
    <CardShell
      icon={icon}
      title={title}
      subtitle={showInput ? 'Only your coach reads this note.' : undefined}
      gradientFrom={gradientFrom}
      gradientTo={gradientTo}
      topBorderColors={['#FF6B9D', '#F97316', '#FF6B9D']}
      showNotified={showNotified}
      hasSavedValue={!!savedValue}
      isDark={isDark}
      accentColor={CARD_ACCENT[storageKey]}
      rightAction={
        <TouchableOpacity
          onPress={startEdit}
          activeOpacity={0.85}
          style={notes.pencilBtn}
          hitSlop={10}
        >
          <Ionicons name="pencil-outline" size={16} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      }
    >
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
        <TouchableOpacity onPress={startEdit} activeOpacity={0.85} style={{ marginTop: 4 }}>
          {savedValue ? (
            <>
              <Text style={{ color: '#10B981', fontWeight: '900', fontSize: 12, letterSpacing: 0.4, marginBottom: 8 }}>
                NOTE SAVED ✓
              </Text>
              <Text style={[notes.savedNoteText, { color: t.text }]}>{savedValue}</Text>
              <Text style={[data.timeSince, { color: t.textDimmed }]}>Updated {getTimeSince()}</Text>
              <Text style={{ color: '#64D2FF', fontWeight: '800', fontSize: 13, marginTop: 10 }}>Tap to edit</Text>
            </>
          ) : (
            <Text style={notes.noNoteText}>Tap to add a note for your trainer</Text>
          )}
        </TouchableOpacity>
      )}
    </CardShell>
  );
};

const notes = StyleSheet.create({
  textarea: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, minHeight: 80 },
  pencilBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedNoteText: { fontSize: 14, lineHeight: 22, fontWeight: '600' },
  noNoteText: { fontSize: 13, fontStyle: 'italic', marginTop: 2, color: 'rgba(255,255,255,0.45)', lineHeight: 18 },
});

export const MyDashboardScreen = ({
  trainer,
  embedInLayout = false,
  onMetricsChange,
  onPressMessage,
  onPressViewProfile,
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
  const insets = useSafeAreaInsets();
  const t = isDark ? DARK : LIGHT;
  const icon = (name) => <Ionicons name={name} size={18} color={t.iconColor} />;
  const handleViewProfile = typeof onPressViewProfile === 'function' ? onPressViewProfile : onPressMessage;
  const currentUser = auth?.currentUser;
  const scrollRef = useRef(null);
  const [untilResetMs, setUntilResetMs] = useState(msUntilMidnight());
  const [banner, setBanner] = useState(null); // { type: 'info'|'warn'|'error', text }
  const [pendingReset, setPendingReset] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setUntilResetMs(msUntilMidnight()), 1000);
    return () => clearInterval(id);
  }, []);

  // Real-time workouts history (dashboard updates without refresh)
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [dashboardPendingSessions, setDashboardPendingSessions] = useState([]);
  const [dashboardReminderSessions, setDashboardReminderSessions] = useState([]);

  useEffect(() => {
    if (!db || !currentUser?.uid) {
      setDashboardPendingSessions([]);
      setDashboardReminderSessions([]);
      return;
    }
    const trainerUid = trainer?.id || trainer?.uid || null;
    if (!trainerUid) {
      setDashboardPendingSessions([]);
      setDashboardReminderSessions([]);
      return;
    }
    const todayKey = getLocalDateKey();
    const sessionsRef = collection(db, `trainer_clients/${trainerUid}/sessions`);
    const q = query(sessionsRef, where('clientId', '==', currentUser.uid), limit(25));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const all = [];
        snap.forEach((d) => all.push({ id: d.id, ...d.data() }));
        const pending = all
          .filter((s) => (s.status || 'pending') === 'pending' && String(s.date || '') >= String(todayKey))
          .sort((a, b) => (String(a.date) + String(a.time)).localeCompare(String(b.date) + String(b.time)))
          .slice(0, 5);
        const reminders = all
          .filter((s) => String(s.status || '') === 'accepted' && String(s.date || '') >= String(todayKey))
          .sort((a, b) => (String(a.date) + String(a.time)).localeCompare(String(b.date) + String(b.time)))
          .slice(0, 3);
        setDashboardPendingSessions(pending);
        setDashboardReminderSessions(reminders);
      },
      (e) => {
        console.warn('Dashboard sessions listener:', e?.code || e?.message || e);
        setDashboardPendingSessions([]);
        setDashboardReminderSessions([]);
      },
    );
    return () => {
      try {
        unsub?.();
      } catch (_) {}
    };
  }, [currentUser?.uid, trainer?.id, trainer?.uid]);

  useEffect(() => {
    if (!db || !currentUser?.uid) return;
    const uid = currentUser.uid;
    const workoutsRef = collection(db, 'completedWorkouts');
    const q = query(workoutsRef, where('userId', '==', uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          const aTime = a.completedAt?.toDate?.() || new Date(a.completedAt || 0);
          const bTime = b.completedAt?.toDate?.() || new Date(b.completedAt || 0);
          return bTime.getTime() - aTime.getTime();
        });
        setRecentWorkouts(list.slice(0, 20));
      },
      (e) => {
        console.warn('completedWorkouts listener error:', e?.code || e?.message || e);
        setBanner({ type: 'warn', text: "You're offline or connection is unstable. Cached data shown where available." });
      },
    );
    return () => {
      try { unsub?.(); } catch (_) {}
    };
  }, [currentUser?.uid]);

  // Archive + reset at local midnight (best-effort; retries every 30s if it fails)
  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid || !db) return;

    const LAST_KEY = `dashboard_last_dateKey_${uid}`;
    const PENDING_KEY = `dashboard_pending_reset_${uid}`;

    const runArchive = async (prevKey) => {
      if (!prevKey) return;
      setPendingReset(true);
      setBanner({ type: 'info', text: 'New day started. Archiving yesterday…' });

      let dailyLogsData = null;
      let trackingData = null;
      try {
        const logsSnap = await getDoc(doc(db, 'users', uid, 'dailyLogs', prevKey));
        dailyLogsData = logsSnap.exists() ? (logsSnap.data() || {}) : null;
      } catch (_) {
        dailyLogsData = null;
      }
      try {
        const tSnap = await getDoc(doc(db, 'users', uid, 'daily_tracking', prevKey));
        trackingData = tSnap.exists() ? (tSnap.data() || {}) : null;
      } catch (_) {
        trackingData = null;
      }

      const archiveDocId = `${uid}_${prevKey}`;
      const archivePayload = {
        userId: uid,
        date: prevKey,
        workouts: {
          workoutLog: dailyLogsData?.workoutLog || null,
          workoutSummary: trackingData?.workoutSummary || dailyLogsData?.dashboard_workouts || null,
          workoutName: trackingData?.workoutName || dailyLogsData?.dashboard_workout_name || null,
          workoutExercises: trackingData?.workoutExercises || null,
        },
        nutrition: {
          caloriesConsumed: typeof trackingData?.caloriesConsumed === 'number' ? trackingData.caloriesConsumed : null,
          macros: trackingData?.macroTotals || null,
        },
        streak_count: typeof dailyLogsData?.streak_count === 'number' ? dailyLogsData.streak_count : null,
        timestamp: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, 'daily_logs', archiveDocId), archivePayload, { merge: true });
        await AsyncStorage.removeItem(PENDING_KEY);
        setPendingReset(false);
        setBanner({ type: 'info', text: 'Yesterday archived. Dashboard reset for the new day.' });
      } catch (e) {
        await AsyncStorage.setItem(PENDING_KEY, JSON.stringify({ prevKey, at: Date.now() }));
        setPendingReset(true);
        setBanner({ type: 'error', text: 'Pending reset… will retry automatically.' });
      }
    };

    const tick = async () => {
      const nowKey = getLocalDateKey();
      const lastKey = await AsyncStorage.getItem(LAST_KEY);
      if (!lastKey) {
        await AsyncStorage.setItem(LAST_KEY, nowKey);
      } else if (lastKey !== nowKey) {
        await AsyncStorage.setItem(LAST_KEY, nowKey);
        await runArchive(lastKey);
      }

      const pending = await AsyncStorage.getItem(PENDING_KEY);
      if (pending) {
        let parsed = null;
        try { parsed = JSON.parse(pending); } catch (_) {}
        if (parsed?.prevKey) {
          await runArchive(parsed.prevKey);
        }
      }
    };

    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [currentUser?.uid]);

  const handleWorkoutAfterSave = useCallback(
    (combined, workoutName, workoutExercises) => {
      if (onMetricsChange) {
        onMetricsChange({
          workoutSummary: combined || null,
          workoutName: workoutName || null,
          workoutExercises: workoutExercises || [],
        });
      }
    },
    [onMetricsChange],
  );

  const workoutLogState = useWorkoutLog(handleWorkoutAfterSave);

  const respondToDashboardSession = useCallback(
    async ({ sessionId, status }) => {
      const trainerUid = trainer?.id || trainer?.uid || null;
      if (!trainerUid || !sessionId || !db) return;
      try {
        await updateDoc(doc(db, `trainer_clients/${trainerUid}/sessions/${sessionId}`), {
          status,
          respondedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        const clientUid = auth?.currentUser?.uid;
        if (clientUid) {
          let clientName = auth.currentUser?.displayName || 'Client';
          try {
            const us = await getDoc(doc(db, 'users', clientUid));
            if (us.exists()) {
              const d = us.data();
              clientName = d?.firstName || d?.name || d?.displayName || clientName;
            }
          } catch (_) {}
          const verb =
            status === 'accepted' ? 'accepted' : status === 'declined' ? 'declined' : 'updated';
          void postRemotePushNotify({
            recipientId: trainerUid,
            senderName: clientName,
            messageText: `${clientName} ${verb} a session.`,
            senderId: clientUid,
            messageId: sessionId,
            notificationType: 'session_response',
          });
        }
      } catch (e) {
        console.error('Dashboard respond to session failed:', e);
        Alert.alert('Could not update', e?.message || 'Please try again.');
      }
    },
    [trainer?.id, trainer?.uid],
  );

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

  return (
    <LinearGradient colors={t.bg} style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          screen.scroll,
          embedInLayout && { paddingTop: 16 },
          // BottomNavBar in ClientApp/TrainerApp overlays the bottom; ensure last cards aren't clipped.
          embedInLayout && { paddingBottom: 80 + insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {banner?.text ? (
          <View
            style={{
              marginTop: 4,
              marginBottom: 10,
              borderRadius: 14,
              borderWidth: 1,
              borderColor:
                banner.type === 'error'
                  ? 'rgba(239,68,68,0.35)'
                  : banner.type === 'warn'
                    ? 'rgba(245,158,11,0.35)'
                    : isDark
                      ? 'rgba(255,255,255,0.10)'
                      : 'rgba(0,0,0,0.08)',
              backgroundColor:
                banner.type === 'error'
                  ? (isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.10)')
                  : banner.type === 'warn'
                    ? (isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.10)')
                    : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.65)'),
              paddingVertical: 10,
              paddingHorizontal: 12,
            }}
          >
            <Text style={{ color: t.text, fontSize: 13, fontWeight: '700' }}>{banner.text}</Text>
            {pendingReset ? (
              <Text style={{ color: t.textMuted, fontSize: 12, marginTop: 4 }}>
                Retrying every 30 seconds…
              </Text>
            ) : null}
          </View>
        ) : null}

        <View
          style={{
            marginTop: 4,
            marginBottom: 10,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.65)',
            paddingVertical: 10,
            paddingHorizontal: 12,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '800',
              letterSpacing: 1.6,
              color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(17,24,39,0.65)',
              textTransform: 'uppercase',
              textAlign: 'center',
            }}
          >
            Daily reset
          </Text>
          <Text style={{ marginTop: 4, fontSize: 22, fontWeight: '900', color: t.text, textAlign: 'center' }}>
            Resets in {formatHMS(untilResetMs)}
          </Text>
          <Text style={{ marginTop: 4, fontSize: 12, fontWeight: '600', color: t.textMuted, textAlign: 'center', lineHeight: 16 }}>
            After midnight, this dashboard starts fresh until you log new data.
          </Text>
        </View>

        <PremiumWelcomeCard
          isDark={isDark}
          accent="pink"
          userName={String(currentUser?.displayName || '').trim() || 'Athlete'}
          message="Today’s goal: log one metric + complete one focused session. Let’s build momentum."
          illustrationSource={require('../../assets/Lotties for Anatrox/Fitness.json')}
        />

        {(dashboardPendingSessions.length > 0 || dashboardReminderSessions.length > 0) && (
          <View style={{ marginTop: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="calendar" size={22} color="#C084FC" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '800',
                    letterSpacing: 1.4,
                    color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(17, 24, 39, 0.55)',
                    textTransform: 'uppercase',
                  }}
                >
                  From your coach
                </Text>
                <Text
                  style={{
                    marginTop: 2,
                    fontSize: 16,
                    fontWeight: '800',
                    color: isDark ? '#fff' : '#0F172A',
                    letterSpacing: -0.3,
                  }}
                >
                  {dashboardPendingSessions.length > 0 ? 'Session invites' : 'Your session'}
                </Text>
                <Text
                  style={{
                    marginTop: 2,
                    fontSize: 12,
                    fontWeight: '600',
                    color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.55)',
                  }}
                >
                  {dashboardPendingSessions.length > 0
                    ? 'Lock in a time or pass — your call.'
                    : 'Here’s when you’re meeting next.'}
                </Text>
              </View>
            </View>

            {dashboardPendingSessions.length > 0
              ? dashboardPendingSessions.map((s) => (
                  <SessionMeetingCard
                    key={s.id}
                    mode="invite"
                    isDark={isDark}
                    coachName={trainerName}
                    session={s}
                    onRespond={respondToDashboardSession}
                  />
                ))
              : dashboardReminderSessions.map((s) => (
                  <SessionMeetingCard
                    key={s.id}
                    mode="reminder"
                    isDark={isDark}
                    coachName={trainerName}
                    session={s}
                  />
                ))}
          </View>
        )}

        <PremiumStatsSection
          isDark={isDark}
          stats={{
            calories: { current: todayCalories || 0, goal: 2000 },
            sleep: { current: typeof sleepHoursValue === 'number' ? sleepHoursValue : Number(sleepHoursValue || 0), goal: 8 },
            water: { current: waterOz || 0, goal: 64 },
          }}
        />

        {/* Trainer card */}
        {trainer ? (
          <View style={screen.trainerCardWrapper}>
            <PremiumTrainerCard
              isDark={isDark}
              accent="purple"
              trainer={{
                name: trainerName,
                specialty: trainerTitle || trainerSpecialties.join(' · ') || 'Certified Trainer',
                location: trainerLocation || 'Remote',
                avatarUrl: trainer?.photoURL || trainer?.avatarUrl,
                rating: typeof trainer?.rating === 'number' ? trainer.rating : undefined,
                clients:
                  typeof trainer?.clientCount === 'number'
                    ? trainer.clientCount
                    : typeof trainer?.clients === 'number'
                      ? trainer.clients
                      : undefined,
                experienceYears: typeof trainer?.experienceYears === 'number' ? trainer.experienceYears : undefined,
              }}
              onPressCard={onPressMessage}
              onPressSecondaryCTA={handleViewProfile}
              onPressCTA={onPressMessage}
              ctaLabel="Message"
              secondaryCtaLabel="View Profile"
            />
          </View>
        ) : (
          <TouchableOpacity
            style={emptyTrainerStyles.touchWrap}
            onPress={onPressMessage}
            activeOpacity={0.92}
          >
            <GradientBorderShell isDark={isDark}>
              <View style={emptyTrainerStyles.row}>
                <View
                  style={[
                    emptyTrainerStyles.iconCircle,
                    {
                      backgroundColor: isDark ? 'rgba(255,107,157,0.18)' : 'rgba(255,107,157,0.12)',
                      borderColor: isDark ? 'rgba(255,107,157,0.38)' : 'rgba(255,107,157,0.28)',
                    },
                  ]}
                >
                  <Ionicons name="person-add-outline" size={24} color="#FF6B9D" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[emptyTrainerStyles.title, { color: t.text }]}>No trainer yet</Text>
                  <Text style={[emptyTrainerStyles.subtitle, { color: t.textMuted }]}>
                    Find a certified coach to guide your journey
                  </Text>
                </View>
                <LinearGradient
                  colors={['#FF6B9D', '#C084FC']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={emptyTrainerStyles.ctaGradient}
                >
                  <View style={emptyTrainerStyles.ctaInner}>
                    <Text style={emptyTrainerStyles.ctaText}>Browse</Text>
                    <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
                  </View>
                </LinearGradient>
              </View>
            </GradientBorderShell>
          </TouchableOpacity>
        )}

        <View style={{ marginTop: 18, marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 2,
              color: t.textMuted,
              textTransform: 'uppercase',
              marginBottom: 10,
              paddingHorizontal: 2,
            }}
          >
            Quick Actions
          </Text>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 2, paddingRight: 12 }}
          >
            {[
              {
                label: 'Messages',
                onPress: onPressMessage,
                icon: 'chatbubbles-outline',
                accent: '#FF6B9D',
                subtitle:
                  (Number(unreadMessageCount) || 0) > 0
                    ? `${Number(unreadMessageCount) > 99 ? '99+' : unreadMessageCount} unread`
                    : 'No unread',
                showUnreadPill: (Number(unreadMessageCount) || 0) > 0,
                unreadCount: Number(unreadMessageCount) || 0,
              },
              {
                label: 'Photo Gallery',
                onPress: () => onOpenPhotoGallery?.({ id: trainerClientId, name: trainerClientName }),
                icon: 'images-outline',
                accent: '#64D2FF',
                subtitle:
                  (Number(photoGalleryBadgeCount) || 0) > 0
                    ? `${Number(photoGalleryBadgeCount) > 99 ? '99+' : photoGalleryBadgeCount} new`
                    : 'Your photos',
              },
              {
                label: 'Workout Plans',
                onPress: () => onOpenAIWorkouts?.({ id: trainerClientId, name: trainerClientName }),
                icon: 'barbell-outline',
                accent: '#C084FC',
                subtitle:
                  (Number(aiWorkoutsBadgeCount) || 0) > 0
                    ? `${Number(aiWorkoutsBadgeCount) > 99 ? '99+' : aiWorkoutsBadgeCount} new`
                    : 'Plans & sessions',
              },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                activeOpacity={0.9}
                onPress={item.onPress || (() => {})}
                style={{ width: 220, marginRight: 12 }}
              >
                <View
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.7)',
                    borderRadius: 20,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    overflow: 'hidden',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                        borderWidth: 1,
                        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name={item.icon} size={22} color={item.accent} />
                    </View>
                    {item.showUnreadPill ? (
                      <View
                        style={{
                          minWidth: 28,
                          height: 22,
                          paddingHorizontal: 8,
                          borderRadius: 11,
                          backgroundColor: 'rgba(255,107,157,0.18)',
                          borderWidth: 1,
                          borderColor: 'rgba(255,107,157,0.35)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: '#FF6B9D', fontSize: 12, fontWeight: '800' }}>
                          {item.unreadCount > 99 ? '99+' : item.unreadCount}
                        </Text>
                      </View>
                    ) : (
                      <View />
                    )}
                  </View>
                  <View style={{ marginTop: 12 }}>
                    <Text style={{ color: t.text, fontSize: 15, fontWeight: '800' }}>{item.label}</Text>
                    <Text style={{ color: t.textMuted, fontSize: 12, marginTop: 4 }}>{item.subtitle}</Text>
                  </View>
                  <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 14,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                        borderWidth: 1,
                        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <Text style={{ color: item.accent, fontSize: 12, fontWeight: '800' }}>View all</Text>
                      <Ionicons name="chevron-forward" size={14} color={item.accent} />
                    </View>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.accent, opacity: 0.9 }} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Bento metrics grid */}
        <View style={screen.bentoGrid}>
          {/* Row 1 */}
          <View style={screen.bentoRow1}>
            <View style={{ flex: 1.2 }}>
              <DataCard
                variant="bentoMetric"
                bentoHeight={135}
                bentoLabel="Sleep"
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
            </View>
            <View style={{ flex: 0.8 }}>
              <DataCard
                variant="bentoMetric"
                bentoHeight={135}
                bentoLabel="Water"
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
            </View>
          </View>

          {/* Row 2 */}
          <View style={screen.bentoRow2}>
            <View style={{ flex: 1 }}>
              <DataCard
                variant="bentoMetric"
                bentoHeight={140}
                bentoLabel="Weight"
                icon={icon('scale-outline')}
                title="Current Weight"
                unit="lbs"
                placeholder="Enter lbs"
                storageKey="dashboard_weight"
                gradientFrom="#C084FC"
                gradientTo="#06B6D4"
                min={0}
                max={999}
                defaultExample="165 lbs"
                isDark={isDark}
              />
            </View>
            <View style={{ flex: 1 }}>
              <DataCard
                variant="bentoMetric"
                bentoHeight={140}
                bentoLabel="Body Fat"
                icon={icon('person-outline')}
                title="Body Fat %"
                unit="%"
                placeholder="Enter %"
                storageKey="dashboard_bodyfat"
                gradientFrom="#FF6B9D"
                gradientTo="#F97316"
                min={0}
                max={100}
                defaultExample="18%"
                isDark={isDark}
              />
            </View>
            <View style={{ flex: 1 }}>
              <DataCard
                variant="bentoMetric"
                bentoHeight={140}
                bentoLabel="Steps"
                icon={icon('footsteps-outline')}
                title="Daily Steps"
                unit="steps"
                placeholder="Enter steps"
                storageKey="dashboard_steps"
                gradientFrom="#06B6D4"
                gradientTo="#FF6B9D"
                min={0}
                max={99999}
                defaultExample="8,432 steps"
                isDark={isDark}
              />
            </View>
          </View>

          {/* Row 3 */}
          <View style={screen.bentoRow3}>
            <WorkoutLogCard
              icon={icon('barbell-outline')}
              gradientFrom="#F97316"
              gradientTo="#FF6B9D"
              isDark={isDark}
              onAfterSave={handleWorkoutAfterSave}
              state={workoutLogState}
            />
          </View>
        </View>

        <RatingCard
          icon={icon('flame-outline')}
          title="Muscle Soreness"
          subtitle="Rate how sore you are (1–8)."
          storageKey="dashboard_soreness"
          gradientFrom="#F97316"
          gradientTo="#C084FC"
          isDark={isDark}
          maxRating={8}
          topBorderColors={['#EF4444', '#F97316', '#FB7185']}
          interpretFn={(n) => sorenessInterpret(n)}
          onAfterSave={onMetricsChange ? (v) => onMetricsChange({ soreness: v }) : undefined}
        />

        <RatingCard
          icon={icon('flash-outline')}
          title="Energy Level"
          subtitle="Rate your energy today (1–8)."
          storageKey="dashboard_energy"
          gradientFrom="#C084FC"
          gradientTo="#F97316"
          isDark={isDark}
          maxRating={8}
          topBorderColors={['#FF9F0A', '#FBBF24', '#F97316']}
          interpretFn={(n) => energyInterpret(n)}
          onAfterSave={onMetricsChange ? (v) => onMetricsChange({ energyLevel: v }) : undefined}
        />

        <RatingCard
          icon={icon('pulse-outline')}
          title="Stress Level"
          subtitle="How stressed are you? (1–8)"
          storageKey="dashboard_stress"
          gradientFrom="#FF6B9D"
          gradientTo="#06B6D4"
          isDark={isDark}
          maxRating={8}
          topBorderColors={['#C084FC', '#FF6B9D', '#A855F7']}
          interpretFn={(n) => stressInterpret(n)}
          onAfterSave={onMetricsChange ? (v) => onMetricsChange({ stressLevel: v }) : undefined}
        />

        <MoodCard icon={icon('happy-outline')} title="Mood Check-in" subtitle="How are you feeling?"
          storageKey="dashboard_mood" gradientFrom="#06B6D4" gradientTo="#F97316" isDark={isDark} />

        <ComplianceCard isDark={isDark} />

        <RatingCard
          icon={icon('star-outline')}
          title="Post-Workout Rating"
          subtitle="How was today's session? (1–10)"
          storageKey="dashboard_workout_rating"
          gradientFrom="#FF6B9D"
          gradientTo="#C084FC"
          isDark={isDark}
          maxRating={10}
          topBorderColors={['#FF6B9D', '#F97316', '#FF6B9D']}
          interpretFn={(n, max) => workoutRatingInterpret(n, max)}
        />

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

  bentoGrid: { gap: 12 },
  bentoRow1: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  bentoRow2: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  bentoRow3: { marginTop: 12 },
});

const heroStyles = StyleSheet.create({
  hero: {
    marginHorizontal: 0,
    marginTop: 10,
    marginBottom: 10,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.2)',
  },
  heroContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  greetingLine: { fontSize: 22, fontWeight: '800' },
  greetingMuted: { fontSize: 20, fontWeight: '700' },
  greetingName: { fontSize: 22, fontWeight: '800' },
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
  statCaloriesValue: { fontSize: 32, fontWeight: '900' },
  statValueSmall: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 26 },
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
  trainerName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  certLine: { fontSize: 11, color: '#64D2FF', marginBottom: 2 },
  specialtyLine: { fontSize: 11 },
  experienceLine: { fontSize: 11 },
  bioLine: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  removeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  removeBtnText: { fontSize: 11, fontWeight: '700' },
});

const emptyTrainerStyles = StyleSheet.create({
  touchWrap: {
    marginTop: 12,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  ctaGradient: {
    borderRadius: 12,
    overflow: 'hidden',
    flexShrink: 0,
  },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  ctaText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});

export default MyDashboardScreen;

// ─────────────────────────────────────────────────────────────
// FULL FILE END
// ─────────────────────────────────────────────────────────────
