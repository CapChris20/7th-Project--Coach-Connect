/**
 * My Dashboard Screen
 *
 * Purpose: UI screen or component: My Dashboard Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/client
 * Key exports: MyDashboardScreen
 *
 * @file-header
 */
//
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  doc,
  setDoc,
  collection,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  updateDoc,
  limit,
} from 'firebase/firestore';
import { auth, db } from '../../app/config';
import { postRemotePushNotify } from '../../shared/api/sendPushNotification';
import { postDashboardNotification } from '../../shared/api/dashboardNotificationApi';
import { getLocalDateKey, msUntilLocalMidnight } from '../../shared/utils/getLocalDay';
import { useLocalTodayDateKey } from '../../shared/daily-metrics/useLocalTodayDateKey';
import {
  retryPendingDailyDashboardArchive,
  tickDailyDashboardDayRollover,
} from '../../shared/daily-metrics/rolloverDayAtMidnight';
import {
  saveDashboardMetricField,
  saveDashboardWorkoutLog,
  buildWorkoutLogHydration,
  fetchLegacyDailyTrackingSnap,
} from '../../shared/daily-metrics/saveDailyMetricsToFirestore';
import { useTheme } from '../../shared/ui/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SessionMeetingCard } from '../../shared/components/home/SessionMeetingCard';
import PremiumTrainerCard from './PremiumTrainerCard';
import PremiumStatsSection, { GradientBorderShell } from './PremiumStatsSection';
import QuickActionCard from '../../shared/components/home/QuickActionCard';
import {
  HOME_STAT_WORKOUT_GRADIENT,
  HOME_STAT_WATER_GRADIENT,
  HOME_STAT_SORENESS_GRADIENT,
  HOME_STAT_SLEEP_GRADIENT,
  GradientOutlineText,
} from '../../shared/ui/homeStatGradients';

const BENTO_VALUE_GRADIENT = {
  dashboard_sleep: HOME_STAT_WORKOUT_GRADIENT,
  dashboard_water: HOME_STAT_WATER_GRADIENT,
  dashboard_steps: HOME_STAT_SORENESS_GRADIENT,
  dashboard_weight: HOME_STAT_SLEEP_GRADIENT,
};

/** Same purple → orange stripe as hero / training agenda cards. */
const BENTO_TOP_STRIPE = ['#6D28D9', '#C2410C'];

const bentoGradientValueStyle = (fontSize) => ({
  fontSize,
  fontWeight: '800',
  lineHeight: Math.round(fontSize * 1.18),
  textAlign: 'center',
});

const bentoValueFillColor = (isDark) => (isDark ? '#FFFFFF' : '#1A1040');
import {
  isAllowedClientWorkoutDayLabel,
  WORKOUT_DAY_EXAMPLES_SHORT,
} from '../../shared/utils/workoutDayLabels';

const MOOD_EMPTY_LOTTIE = require('../../shared/assets/Happy SUN.json');

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

function formatClientWeeklyRange(weekStart, weekEnd) {
  const ws = String(weekStart || '').trim();
  const we = String(weekEnd || ws).trim();
  if (!ws) return '';
  const s = new Date(`${ws}T12:00:00`);
  const e = new Date(`${we}T12:00:00`);
  const a = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const b = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${a} – ${b}`;
}

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
  dashboard_workout_rating: 'Post-Workout Rating',
  dashboard_notes: 'Notes to Trainer',
};

const useCardState = (storageKey, onAfterSave) => {
  const [savedValue, setSavedValue] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [showNotified, setShowNotified] = useState(false);
  const todayDateKey = useLocalTodayDateKey();

  useEffect(() => {
    let unsubLogs = null;
    const load = async () => {
      const uid = auth?.currentUser?.uid;
      const todayKey = todayDateKey;

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
            if (!snap.exists()) {
              setSavedValue(null);
              setSavedAt(null);
              return;
            }
            const data = snap.data() || {};
            let raw = data[storageKey];
            if ((raw == null || raw === '') && storageKey === 'dashboard_water') {
              raw = data.dashboard_water;
            }
            if ((raw == null || raw === '') && storageKey === 'dashboard_sleep') {
              raw = data.dashboard_sleep;
            }
            applyLoadedValue(raw, data.updatedAt?.toDate?.()?.toISOString?.());
          },
          (e) => console.warn('dailyLogs listener error:', e?.code || e?.message || e),
        );
      } catch (e) {
        console.warn('useCardState load error:', e);
      }
    };
    load();
    return () => {
      try { unsubLogs?.(); } catch (_) {}
    };
  }, [storageKey, auth?.currentUser?.uid, todayDateKey]);

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
    const dateKey = todayDateKey;
    const currentUser = auth?.currentUser;
    if (db && currentUser) {
      try {
        await saveDashboardMetricField(currentUser.uid, storageKey, value, dateKey);

        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userSnap.exists() ? userSnap.data() : {};
        const trainerId = userData.trainerId || userData.trainer_id || null;
        if (trainerId) {
          const notifyResult = await postDashboardNotification({
            recipientId: trainerId,
            clientId: currentUser.uid,
            type: 'dashboard_update',
            payload: {
              type: storageKey,
              label: STORAGE_KEY_LABELS[storageKey] || storageKey,
              value,
            },
          });
          if (!notifyResult.ok) {
            throw new Error(notifyResult.reason || 'notification_failed');
          }
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
  const [hasSavedValue, setHasSavedValue] = useState(false);
  const todayDateKey = useLocalTodayDateKey();

  const makeExercise = () => ({
    id: `${Date.now()}_${Math.random()}`,
    name: '',
    sets: [{ id: `${Date.now()}_${Math.random()}`, reps: '', weight: '' }],
  });

  useEffect(() => {
    if (!db || !auth?.currentUser) return;
    const uid = auth.currentUser.uid;
    const dateKey = todayDateKey;
    const logsRef = doc(db, 'users', uid, 'dailyLogs', dateKey);

    let alive = true;
    let lastLogsSnap = null;
    let lastTrackingSnap = null;

    const hydrate = () => {
      if (!alive || !lastLogsSnap) return;

      const { d, fromLogs } = buildWorkoutLogHydration(lastLogsSnap, lastTrackingSnap);

      if (!fromLogs) {
        // Firestore often delivers logs + tracking snapshots back-to-back. Re-running hydrate with
        // fresh random ids remounts TextInputs and drops keyboard after the first keystroke.
        setWorkoutExercises((prev) => (prev.length > 0 ? prev : [makeExercise()]));
        setHasSavedValue(false);
        setLoaded(true);
        return;
      }

      setWorkoutName(d.dashboard_workout_name || '');
      if (Array.isArray(d.workoutLog) && d.workoutLog.length > 0) {
        const mapped = d.workoutLog.map((item, exIdx) => ({
          id: `srv_wl_${exIdx}`,
          name: item.exerciseName || '',
          sets: Array.isArray(item.sets) && item.sets.length
            ? item.sets.map((s, sIdx) => ({
                id: `srv_wl_${exIdx}_s_${sIdx}`,
                reps: s.reps != null ? String(s.reps) : '',
                weight: s.weight != null ? String(s.weight) : '',
              }))
            : [{ id: `srv_wl_${exIdx}_s_0`, reps: '', weight: '' }],
        }));
        setWorkoutExercises(mapped);
      } else if (Array.isArray(d.dashboard_workout_exercises) && d.dashboard_workout_exercises.length > 0) {
        setWorkoutExercises(
          d.dashboard_workout_exercises.map((name, exIdx) => ({
            id: `srv_dwe_${exIdx}`,
            name: String(name),
            sets: [{ id: `srv_dwe_${exIdx}_s_0`, reps: '', weight: '' }],
          })),
        );
      } else {
        setWorkoutExercises((prev) => (prev.length > 0 ? prev : [makeExercise()]));
      }
      setHasSavedValue(true);
      setLoaded(true);
    };

    fetchLegacyDailyTrackingSnap(uid, dateKey)
      .then((snap) => {
        if (!alive) return;
        lastTrackingSnap = snap;
        hydrate();
      })
      .catch(() => {});

    const unsubLogs = onSnapshot(
      logsRef,
      (snap) => {
        lastLogsSnap = snap;
        hydrate();
      },
      () => {
        setWorkoutExercises([makeExercise()]);
        setHasSavedValue(false);
        setLoaded(true);
      },
    );

    return () => {
      alive = false;
      try { unsubLogs?.(); } catch (_) {}
    };
  }, [auth?.currentUser?.uid, todayDateKey]);

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
      await saveDashboardWorkoutLog(
        uid,
        {
          workoutName: name || null,
          workoutLog: structured,
          dashboard_workouts: combined || null,
        },
        dateKey,
      );

      const userSnap = await getDoc(doc(db, 'users', uid));
      const userData = userSnap.exists() ? userSnap.data() : {};
      const trainerId = userData.trainerId || userData.trainer_id || null;
      if (trainerId) {
        const notifyResult = await postDashboardNotification({
          recipientId: trainerId,
          clientId: uid,
          type: 'dashboard_update',
          payload: {
            type: 'dashboard_workouts',
            label: 'Workouts Today',
            value: combined,
          },
        });
        if (!notifyResult.ok) {
          throw new Error(notifyResult.reason || 'notification_failed');
        }
      }
      setShowNotified(true);
      setHasSavedValue(true);
      if (onAfterSave) onAfterSave(combined || null, name || '', structured);
      setTimeout(() => setShowNotified(false), 3000);
    } catch (e) {
      console.warn('Workout log save error:', e);
    }
  };

  const hasDraftValue =
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
    hasDraftValue,
    hasSavedValue,
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
    hasDraftValue,
    hasSavedValue,
  } = logState;
  const [isEditing, setIsEditing] = useState(false);

  if (!loaded) return null;

  const showForm = !hasSavedValue || isEditing;
  const statusBadge = hasSavedValue ? workoutStatus(workoutName) : null;

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
      hasSavedValue={hasSavedValue}
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
  dashboard_workout_rating: '#FF9F0A',
  dashboard_notes: '#8A8A8A',
};

const shellIconRender = (icon, isDark, accent) =>
  React.isValidElement(icon)
    ? React.cloneElement(icon, {
        color: isDark ? 'rgba(255,255,255,0.95)' : (accent || 'rgba(30,16,64,0.85)'),
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
                  backgroundColor: isDark ? `${accent}2E` : `${accent}18`,
                  borderColor: isDark ? `${accent}55` : `${accent}30`,
                },
              ]}
            >
              {shellIconRender(icon, isDark, accent)}
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
    const valueGradient = BENTO_VALUE_GRADIENT[storageKey];
    const valueFill = bentoValueFillColor(isDark);
    const valueStyle = bentoGradientValueStyle(valueFontSize);
    const outlineStroke = Math.max(1, Math.round(valueFontSize * 0.04));
    const saveGradient = valueGradient ?? BENTO_TOP_STRIPE;
    const cardBg = isDark ? '#13131A' : '#FFFFFF';
    const cardBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(10,10,15,0.1)';

    return (
      <View style={[bentoMetric.outer, { height: bentoHeight }]}>
        <View style={bentoMetric.clip}>
          <LinearGradient
            colors={BENTO_TOP_STRIPE}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={bentoMetric.topBar}
          />
          <View
            style={[
              bentoMetric.card,
              {
                flex: 1,
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
                  <LinearGradient colors={saveGradient} style={bentoMetric.saveBtn}>
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
                  {valueGradient ? (
                    <GradientOutlineText
                      style={valueStyle}
                      colors={valueGradient}
                      fillColor={valueFill}
                      stroke={outlineStroke}
                    >
                      {`${savedValue ?? 0}`}
                    </GradientOutlineText>
                  ) : (
                    <Text style={[bentoMetric.valueText, valueStyle, { color: valueFill }]}>
                      {`${savedValue ?? 0}`}
                    </Text>
                  )}
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
        </View>
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
  outer: {
    marginBottom: 0,
  },
  clip: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  topBar: {
    height: 3,
    width: '100%',
  },
  card: {
    flex: 1,
    borderWidth: 1,
    borderTopWidth: 0,
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
          <View style={mood.moodLottieWrap}>
            <LottieView source={MOOD_EMPTY_LOTTIE} autoPlay loop style={mood.moodLottie} />
          </View>
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
  moodLottieWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  moodLottie: {
    width: 100,
    height: 100,
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
  userData,
  onOpenCoachingPayment,
  embedInLayout = false,
  onMetricsChange,
  onPressMessage,
  /** When user has no trainer: empty-state card should open marketplace, not messaging. */
  onPressFindTrainer,
  onPressViewProfile,
  onOpenRemoveTrainer,
  onOpenPhotoGallery,
  onOpenAIWorkouts,
  /** Opens full-screen weekly report for the signed-in client (`users/{uid}/weeklySummaries`). */
  onOpenWeeklyReport,
  /** Opens Nutrition from the calories card (optional). */
  onPressCalories,
  trainerClientId,
  trainerClientName,
  photoGalleryBadgeCount = 0,
  aiWorkoutsBadgeCount = 0,
  unreadMessageCount = 0,
  todayCalories = 0,
  calorieGoal = 2000,
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
  const [untilResetMs, setUntilResetMs] = useState(msUntilLocalMidnight());
  const [localClock, setLocalClock] = useState(() => new Date());
  const [banner, setBanner] = useState(null); // { type: 'info'|'warn'|'error', text }
  const [pendingReset, setPendingReset] = useState(false);

  const coachingMonthlyRate = userData?.monthlyRate ?? null;
  const coachingPaymentStatus = userData?.paymentStatus || 'inactive';

  useEffect(() => {
    const id = setInterval(() => setUntilResetMs(msUntilLocalMidnight()), 1000);
    return () => clearInterval(id);
  }, []);

  /** Live local clock for the dashboard time card (updates every second). */
  useEffect(() => {
    const id = setInterval(() => setLocalClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Real-time workouts history (dashboard updates without refresh)
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [dashboardPendingSessions, setDashboardPendingSessions] = useState([]);
  const [dashboardReminderSessions, setDashboardReminderSessions] = useState([]);
  const [weeklyReportCardLoading, setWeeklyReportCardLoading] = useState(false);
  const [weeklyReportCard, setWeeklyReportCard] = useState({ hasReport: false, weekRangeLabel: '' });

  useEffect(() => {
    if (typeof onOpenWeeklyReport !== 'function') return undefined;
    let cancelled = false;
    const uid = currentUser?.uid;
    if (!uid || !db) {
      setWeeklyReportCard({ hasReport: false, weekRangeLabel: '' });
      return undefined;
    }
    (async () => {
      setWeeklyReportCardLoading(true);
      try {
        const snap = await getDocs(collection(db, 'users', uid, 'weeklySummaries'));
        const rows = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((r) => r.weekStart || r.weekId)
          .sort((a, b) =>
            String(b.weekStart || b.weekId || '').localeCompare(String(a.weekStart || a.weekId || '')),
          );
        if (cancelled) return;
        const latest = rows[0];
        const ws = latest?.weekStart || latest?.weekId;
        const we = latest?.weekEnd || ws;
        setWeeklyReportCard({
          hasReport: rows.length > 0,
          weekRangeLabel: rows.length > 0 ? formatClientWeeklyRange(ws, we) : '',
        });
      } catch (e) {
        if (!cancelled) {
          console.warn('[MyDashboardScreen] weeklySummaries load failed', e?.message || e);
          setWeeklyReportCard({ hasReport: false, weekRangeLabel: '' });
        }
      } finally {
        if (!cancelled) setWeeklyReportCardLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid, onOpenWeeklyReport]);

  const [sessionFilterTick, setSessionFilterTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSessionFilterTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const allSessionsRef = useRef([]);

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
    const sessionsRef = collection(db, `trainer_clients/${trainerUid}/sessions`);
    const q = query(sessionsRef, where('clientId', '==', currentUser.uid), limit(25));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const all = [];
        snap.forEach((d) => all.push({ id: d.id, ...d.data() }));
        allSessionsRef.current = all;
        setSessionFilterTick((n) => n + 1);
      },
      (e) => {
        console.warn('Dashboard sessions listener:', e?.code || e?.message || e);
        allSessionsRef.current = [];
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
    const all = allSessionsRef.current;
    const todayKey = getLocalDateKey();
    const now = Date.now();
    const EXPIRY_MS = 60 * 60 * 1000;
    const isStillRelevant = (s) => {
      const dateStr = String(s.date || '');
      if (dateStr > todayKey) return true;
      if (dateStr < todayKey) return false;
      const timeStr = String(s.time || '');
      const [hStr, mStr] = timeStr.split(':');
      const h = parseInt(hStr, 10);
      const m = parseInt(mStr || '0', 10);
      if (Number.isNaN(h)) return true;
      const sessionStart = new Date();
      sessionStart.setHours(h, Number.isNaN(m) ? 0 : m, 0, 0);
      return now < sessionStart.getTime() + EXPIRY_MS;
    };

    const pending = all
      .filter((s) => (s.status || 'pending') === 'pending' && String(s.date || '') >= todayKey && isStillRelevant(s))
      .sort((a, b) => (String(a.date) + String(a.time)).localeCompare(String(b.date) + String(b.time)))
      .slice(0, 5);
    const reminders = all
      .filter((s) => String(s.status || '') === 'accepted' && String(s.date || '') >= todayKey && isStillRelevant(s))
      .sort((a, b) => (String(a.date) + String(a.time)).localeCompare(String(b.date) + String(b.time)))
      .slice(0, 3);
    setDashboardPendingSessions(pending);
    setDashboardReminderSessions(reminders);
  }, [sessionFilterTick]);

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

  // Archive yesterday + reset at local midnight (also runs on home when app stays open)
  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid || !db) return;

    const tick = async () => {
      try {
        const rolled = await tickDailyDashboardDayRollover(uid);
        if (rolled) {
          setPendingReset(false);
          setBanner({ type: 'info', text: 'Yesterday archived. Dashboard reset for the new day.' });
        }
        await retryPendingDailyDashboardArchive(uid);
      } catch (_) {
        setPendingReset(true);
        setBanner({ type: 'error', text: 'Pending reset… will retry automatically.' });
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

  const coachingRateLabel = useMemo(() => {
    if (coachingMonthlyRate != null && coachingMonthlyRate !== '') {
      const n = Number(coachingMonthlyRate);
      if (Number.isFinite(n) && n > 0) {
        const dollars = n >= 100 ? n / 100 : n;
        return `$${dollars % 1 === 0 ? dollars.toFixed(0) : dollars.toFixed(2)}`;
      }
    }
    if (trainerPricingLine) {
      const monthlyPart = trainerPricingLine.split(' · ').find((part) => part.includes('/month'));
      if (monthlyPart) return monthlyPart.replace('/month', '').trim();
    }
    return null;
  }, [coachingMonthlyRate, trainerPricingLine]);

  const paymentBanner = useMemo(() => {
    if (coachingPaymentStatus === 'past_due') {
      return { type: 'error', text: 'Coaching payment past due — update billing' };
    }
    if (coachingPaymentStatus === 'payment_required' && coachingRateLabel) {
      return {
        type: 'warn',
        text: `${trainerName} set your rate to ${coachingRateLabel}/mo — add a payment method to get started`,
      };
    }
    return null;
  }, [coachingPaymentStatus, coachingRateLabel, trainerName]);

  const displayBanner = paymentBanner || banner;

  const showCoachingPaymentOnCard =
    trainer &&
    coachingPaymentStatus !== 'inactive' &&
    !!(coachingRateLabel || (coachingMonthlyRate != null && Number(coachingMonthlyRate) > 0));

  const coachingPaymentButtonLabel =
    coachingPaymentStatus === 'past_due'
      ? 'Update Payment'
      : coachingPaymentStatus === 'active'
        ? 'Manage Coaching Payment'
        : 'Set Up Payment';

  const coachingPaymentStatusLabel =
    coachingPaymentStatus === 'active'
      ? 'Active'
      : coachingPaymentStatus === 'past_due'
        ? 'Past due'
        : coachingPaymentStatus === 'payment_required'
          ? 'Payment required'
          : null;

  const coachingPaymentStatusTone =
    coachingPaymentStatus === 'active'
      ? 'success'
      : coachingPaymentStatus === 'past_due'
        ? 'error'
        : coachingPaymentStatus === 'payment_required'
          ? 'warning'
          : 'neutral';

  const handleOpenPayment = useCallback(() => {
    if (typeof onOpenCoachingPayment === 'function') {
      onOpenCoachingPayment();
    }
  }, [onOpenCoachingPayment]);

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
        {displayBanner?.text ? (
          <View
            style={{
              marginTop: 4,
              marginBottom: 10,
              borderRadius: 14,
              borderWidth: 1,
              borderColor:
                displayBanner.type === 'error'
                  ? 'rgba(239,68,68,0.35)'
                  : displayBanner.type === 'warn'
                    ? 'rgba(245,158,11,0.35)'
                    : isDark
                      ? 'rgba(255,255,255,0.10)'
                      : 'rgba(0,0,0,0.08)',
              backgroundColor:
                displayBanner.type === 'error'
                  ? (isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.10)')
                  : displayBanner.type === 'warn'
                    ? (isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.10)')
                    : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.65)'),
              paddingVertical: 10,
              paddingHorizontal: 12,
            }}
          >
            <Text style={{ color: t.text, fontSize: 13, fontWeight: '700' }}>{displayBanner.text}</Text>
            {pendingReset ? (
              <Text style={{ color: t.textMuted, fontSize: 12, marginTop: 4 }}>
                Retrying every 30 seconds…
              </Text>
            ) : null}
          </View>
        ) : null}


        <View style={{ marginTop: 4, marginBottom: 20 }}>
          <LinearGradient
            colors={['#BE185D', '#C2410C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 24, padding: 2 }}
          >
            <View style={{ borderRadius: 22, padding: 18, backgroundColor: isDark ? '#0A0A0F' : '#FFFFFF', overflow: 'hidden' }}>
              {/* Ambient glow */}
              <View style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: '#FF6B9D', opacity: 0.06 }} />

              {/* Two-column: text left, icon right */}
              <View style={{ flexDirection: 'row', minHeight: 150 }}>
                <View style={{ flex: 1.3, paddingRight: 12, justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ fontSize: 10, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(10,10,15,0.45)' }}>
                      YOUR DASHBOARD
                    </Text>
                    <View style={{ width: 36, height: 2, borderRadius: 1, backgroundColor: '#FF6B9D', marginTop: 6 }} />
                  </View>

                  <Text style={{ fontSize: 26, fontWeight: '900', color: isDark ? '#FFFFFF' : '#0A0A0F', marginTop: 10 }}>
                    {'Welcome back, '}
                    <Text style={{ color: '#FF6B9D' }}>{String(currentUser?.displayName || '').trim().split(' ')[0] || 'Athlete'}</Text>
                  </Text>

                  <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(10,10,15,0.5)', marginTop: 6, lineHeight: 17 }}>
                    Log a metric, complete a session — build momentum today.
                  </Text>
                </View>

                {/* Right icon circle */}
                <View style={{ flex: 0.7, justifyContent: 'center', alignItems: 'center' }}>
                  <View style={{ width: 100, height: 100, borderRadius: 50, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="pulse" size={48} color="#FF6B9D" />
                  </View>
                </View>
              </View>

              {/* Bottom row: Week in Review + Timer */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                {typeof onOpenWeeklyReport === 'function' && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => onOpenWeeklyReport()}
                    style={{
                      flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
                      paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14,
                      backgroundColor: isDark ? 'rgba(255,107,157,0.10)' : 'rgba(255,107,157,0.08)',
                      borderWidth: 1, borderColor: isDark ? 'rgba(255,107,157,0.20)' : 'rgba(255,107,157,0.15)',
                    }}
                  >
                    <LinearGradient
                      colors={['#FF6B9D', '#C084FC']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' }}
                    >
                      <Ionicons name="stats-chart" size={14} color="#FFFFFF" />
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0A0A0F' }}>
                        Week in Review
                      </Text>
                      {weeklyReportCard.weekRangeLabel ? (
                        <Text style={{ fontSize: 10, fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(10,10,15,0.4)', marginTop: 1 }} numberOfLines={1}>
                          {weeklyReportCard.weekRangeLabel}
                        </Text>
                      ) : null}
                    </View>
                    {weeklyReportCardLoading ? (
                      <ActivityIndicator size="small" color="#FF6B9D" />
                    ) : (
                      <Ionicons name="chevron-forward" size={14} color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(10,10,15,0.3)'} />
                    )}
                  </TouchableOpacity>
                )}

                <View
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  }}
                >
                  <Ionicons name="time-outline" size={14} color={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(10,10,15,0.45)'} />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(10,10,15,0.65)' }}>
                    {formatHMS(untilResetMs)}
                  </Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

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

        {/* Nutrition / calories card removed from Dashboard per request */}

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
              onPressPayment={showCoachingPaymentOnCard ? handleOpenPayment : undefined}
              paymentButtonLabel={coachingPaymentButtonLabel}
              paymentRateLabel={coachingRateLabel ? `${coachingRateLabel}/mo` : trainerPricingLine || null}
              paymentStatusLabel={coachingPaymentStatusLabel}
              paymentStatusTone={coachingPaymentStatusTone}
            />
          </View>
        ) : (
          <TouchableOpacity
            style={emptyTrainerStyles.touchWrap}
            onPress={typeof onPressFindTrainer === 'function' ? onPressFindTrainer : onPressMessage}
            activeOpacity={0.92}
          >
            <GradientBorderShell isDark={isDark}>
              <View style={emptyTrainerStyles.content}>
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
                  <View style={emptyTrainerStyles.textCol}>
                    <Text style={[emptyTrainerStyles.title, { color: t.text }]}>No trainer yet</Text>
                    <Text style={[emptyTrainerStyles.subtitle, { color: t.textMuted }]}>
                      Find a certified coach to guide your journey
                    </Text>
                  </View>
                </View>
                <LinearGradient
                  colors={['#BE185D', '#C2410C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={emptyTrainerStyles.ctaGradient}
                >
                  <View style={emptyTrainerStyles.ctaInner}>
                    <Ionicons name="search" size={18} color="#FFFFFF" />
                    <Text style={emptyTrainerStyles.ctaText}>Browse Trainers</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
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
                subtitle:
                  (Number(unreadMessageCount) || 0) > 0
                    ? `${Number(unreadMessageCount) > 99 ? '99+' : unreadMessageCount} unread`
                    : 'No unread',
                badgeCount: Number(unreadMessageCount) || 0,
              },
              {
                label: 'Photo Gallery',
                onPress: () => onOpenPhotoGallery?.({ id: trainerClientId, name: trainerClientName }),
                icon: 'images-outline',
                subtitle:
                  (Number(photoGalleryBadgeCount) || 0) > 0
                    ? `${Number(photoGalleryBadgeCount) > 99 ? '99+' : photoGalleryBadgeCount} new`
                    : 'Your photos',
              },
              {
                label: 'Workout Plans',
                onPress: () => onOpenAIWorkouts?.({ id: trainerClientId, name: trainerClientName }),
                icon: 'barbell-outline',
                subtitle:
                  (Number(aiWorkoutsBadgeCount) || 0) > 0
                    ? `${Number(aiWorkoutsBadgeCount) > 99 ? '99+' : aiWorkoutsBadgeCount} new`
                    : 'Plans & sessions',
              },
            ].map((item) => (
              <QuickActionCard
                key={item.label}
                isDark={isDark}
                width={220}
                label={item.label}
                subtitle={item.subtitle}
                icon={item.icon}
                ctaLabel="View all"
                badgeCount={item.label === 'Messages' ? item.badgeCount : undefined}
                onPress={item.onPress || (() => {})}
              />
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
                gradientFrom="#FBBF24"
                gradientTo="#FB7185"
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
                gradientFrom="#22D3EE"
                gradientTo="#1D4ED8"
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
                gradientFrom="#6D28D9"
                gradientTo="#C2410C"
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
                bentoLabel="Steps"
                icon={icon('footsteps-outline')}
                title="Daily Steps"
                unit="steps"
                placeholder="Enter steps"
                storageKey="dashboard_steps"
                gradientFrom="#C2410C"
                gradientTo="#DB2777"
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
  content: {
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
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
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#BE185D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 6,
  },
  ctaInner: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});

export default MyDashboardScreen;

// ─────────────────────────────────────────────────────────────
// FULL FILE END
// ─────────────────────────────────────────────────────────────
