//
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, collection, addDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../app/config';
import { getDateKey } from '../../app/dateKey';
import { useTheme } from '../../shared/ui/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GradientChatBubblesIcon from '../../shared/components/GradientChatBubblesIcon';
import PremiumWelcomeCard from '../components/PremiumWelcomeCard';
import PremiumTrainerCard from '../components/PremiumTrainerCard';
import PremiumStatsSection from '../components/PremiumStatsSection';
import {
  isAllowedClientWorkoutDayLabel,
  WORKOUT_DAY_EXAMPLES_SHORT,
} from '../../shared/utils/workoutDayLabels';

const msUntilMidnight = () => {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(0, next.getTime() - now.getTime());
};

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

const GradientText = ({ text, colors, style }) => {
  // Uses MaskedView so the LinearGradient shows through text glyphs.
  return (
    <MaskedView style={{ alignSelf: 'center' }} maskElement={<Text style={[style, { color: '#000000' }]}>{text}</Text>}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <Text style={[style, { color: 'transparent' }]}>{text}</Text>
      </LinearGradient>
    </MaskedView>
  );
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
        // 1) Load from AsyncStorage — same calendar day as getDateKey() (America/New_York)
        const stored = await AsyncStorage.getItem(storageKey);
        const storedTime = await AsyncStorage.getItem(`${storageKey}_time`);
        if (stored != null && stored !== '' && storedTime) {
          const parsed = new Date(storedTime);
          if (!Number.isNaN(parsed.getTime())) {
            const storedDateKey = parsed.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
            if (storedDateKey === todayKey) {
              setSavedValue(stored);
              setSavedAt(storedTime);
              return;
            }
          }
          await AsyncStorage.removeItem(storageKey);
          await AsyncStorage.removeItem(`${storageKey}_time`);
        }

        if (!uid || !db) return;

        // 2) dailyLogs (canonical for dashboard fields)
        const logsRef = doc(db, 'users', uid, 'dailyLogs', todayKey);
        const snap = await getDoc(logsRef);
        if (snap.exists()) {
          const data = snap.data();
          const fromFirebase = data[storageKey];
          if (await applyLoadedValue(fromFirebase, data.updatedAt?.toDate?.()?.toISOString?.())) {
            return;
          }
        }

        // 3) daily_tracking — home screen / ClientApp often saves water & sleep here only
        const trackRef = doc(db, 'users', uid, 'daily_tracking', todayKey);
        const trackSnap = await getDoc(trackRef);
        if (trackSnap.exists()) {
          const td = trackSnap.data();
          if (storageKey === 'dashboard_water' && td.waterIntake != null && td.waterIntake !== '') {
            if (await applyLoadedValue(td.waterIntake, td.updatedAt?.toDate?.()?.toISOString?.())) {
              return;
            }
          }
          if (storageKey === 'dashboard_sleep' && td.sleepHours != null && td.sleepHours !== '') {
            if (await applyLoadedValue(td.sleepHours, td.updatedAt?.toDate?.()?.toISOString?.())) {
              return;
            }
          }
        }
      } catch (e) {
        console.warn('useCardState load error:', e);
      }
    };
    load();
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
      .then(async (snap) => {
        let d = snap.exists() ? snap.data() : {};
        let fromLogs =
          (Array.isArray(d.workoutLog) && d.workoutLog.length > 0) ||
          (Array.isArray(d.dashboard_workout_exercises) && d.dashboard_workout_exercises.length > 0) ||
          (d.dashboard_workout_name && String(d.dashboard_workout_name).trim());

        // Client home saves workout name/exercises to daily_tracking only — hydrate from there
        if (!fromLogs) {
          try {
            const tSnap = await getDoc(doc(db, 'users', uid, 'daily_tracking', dateKey));
            if (tSnap.exists()) {
              const td = tSnap.data();
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
          } catch (_) {
            /* ignore */
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
      })
      .catch(() => {
        setWorkoutExercises([makeExercise()]);
        setLoaded(true);
      });
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

const TodaysWorkoutCard = ({ isDark, workoutName, hasWorkout, onPressCTA }) => {
  const t = isDark ? DARK : LIGHT;
  const isRest =
    !hasWorkout ||
    /rest\s*day/i.test(String(workoutName || '')) ||
    String(workoutName || '').trim().toLowerCase() === 'rest';

  const borderColors = isRest ? ['#6B7280', '#111827'] : ['#FF6B9D', '#C084FC'];
  const pillBg = isRest ? 'rgba(107,114,128,0.18)' : 'rgba(255,107,157,0.18)';
  const pillText = isRest ? 'rgba(229,231,235,0.9)' : '#FF6B9D';

  return (
    <View style={{ marginTop: 14 }}>
      <LinearGradient colors={borderColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={todayWorkoutStyles.border}>
        <View style={[todayWorkoutStyles.card, { backgroundColor: t.solidBg }]}>
          <View style={todayWorkoutStyles.headerRow}>
            <Text style={[todayWorkoutStyles.kicker, { color: t.textMuted }]}>TODAY'S WORKOUT</Text>
            <View style={[todayWorkoutStyles.pill, { backgroundColor: pillBg }]}>
              <Text style={[todayWorkoutStyles.pillText, { color: pillText }]}>
                {isRest ? 'REST DAY' : 'TRAINING'}
              </Text>
            </View>
          </View>

          <Text style={[todayWorkoutStyles.title, { color: t.text }]} numberOfLines={2}>
            {isRest ? 'Rest Day' : (workoutName?.trim() || 'Workout Day')}
          </Text>

          <Text style={[todayWorkoutStyles.subtitle, { color: t.textDimmed }]} numberOfLines={2}>
            {isRest ? 'Focus on recovery & mobility.' : 'Tap below to view or log today’s session.'}
          </Text>

          <TouchableOpacity activeOpacity={0.85} onPress={onPressCTA} style={{ marginTop: 12 }}>
            <LinearGradient
              colors={isRest ? ['rgba(107,114,128,0.65)', 'rgba(17,24,39,0.65)'] : ['#FF6B9D', '#C084FC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={todayWorkoutStyles.ctaBtn}
            >
              <Text style={todayWorkoutStyles.ctaText}>{isRest ? 'Recovery Tips' : 'View / Log Workout'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
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

const todayWorkoutStyles = StyleSheet.create({
  border: { borderRadius: 18, padding: 2 },
  card: { borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  pill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  pillText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { marginTop: 10, fontSize: 18, fontWeight: '900' },
  subtitle: { marginTop: 6, fontSize: 13, lineHeight: 18 },
  ctaBtn: { height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});

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
  rightAction,
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
      {rightAction ? <View style={shell.rightAction}>{rightAction}</View> : null}
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
    position: 'relative',
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
  rightAction: { position: 'absolute', top: 12, right: 12, zIndex: 3 },
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

const RatingCard = ({ icon, title, subtitle, storageKey, gradientFrom, gradientTo, isDark, onAfterSave }) => {
  const t = isDark ? DARK : LIGHT;
  const { savedValue, showNotified, save } = useCardState(storageKey, onAfterSave);
  const currentValue = savedValue ? String(savedValue) : '0';
  return (
    <CardShell icon={icon} title={title} gradientFrom={gradientFrom} gradientTo={gradientTo}
      showNotified={showNotified} hasSavedValue={!!savedValue} isDark={isDark} accentColor={CARD_ACCENT[storageKey]}>
      <Text style={[rating.subtitle, { color: t.textMuted }]}>{subtitle}</Text>
      <View style={rating.pillArea}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={rating.pillScroll}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
            const isActive = savedValue === String(n);
            return (
              <TouchableOpacity
                key={n}
                onPress={() => save(String(n))}
                activeOpacity={0.9}
              >
                {isActive ? (
                  <LinearGradient colors={['#7C3AED', '#EC4899']} style={rating.pill}>
                    <Text style={[rating.pillText, { color: '#FFFFFF' }]}>{n}</Text>
                  </LinearGradient>
                ) : (
                  <View style={[rating.pill, { backgroundColor: t.pillBg, borderWidth: 1, borderColor: t.pillBorder }]}>
                    <Text style={[rating.pillText, { color: t.pillText }]}>{n}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={rating.currentValueWrap}>
          <GradientText
            text={currentValue}
            colors={['#7C3AED', '#EC4899']}
            style={rating.currentValue}
          />
        </View>
      </View>
    </CardShell>
  );
};

const rating = StyleSheet.create({
  subtitle: { fontSize: 12, marginTop: 2 },
  btn: { width: 40, height: 32, borderRadius: 99, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 12, fontWeight: '600' },
  pillArea: { flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'center' },
  pillScroll: { flexDirection: 'row', gap: 4, alignItems: 'center' },
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

const EMOJIS = ['😞', '😕', '😐', '🙂', '😄'];

const MoodCard = ({ icon, title, subtitle, storageKey, gradientFrom, gradientTo, isDark }) => {
  const t = isDark ? DARK : LIGHT;
  const { savedValue, showNotified, save } = useCardState(storageKey);
  return (
    <CardShell icon={icon} title={title} gradientFrom={gradientFrom} gradientTo={gradientTo}
      showNotified={showNotified} hasSavedValue={!!savedValue} isDark={isDark} accentColor={CARD_ACCENT[storageKey]}>
      <Text style={[mood.label, { color: t.textMuted }]}>How are you feeling today?</Text>
      <LinearGradient
        colors={['rgba(124,58,237,0.18)', 'rgba(236,72,153,0.12)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={mood.emojiCard}
      >
        <View style={mood.emojiRow}>
          {EMOJIS.map((emoji, i) => {
            const isActive = savedValue === String(i);
            return (
              <TouchableOpacity
                key={i}
                onPress={() => save(String(i))}
                activeOpacity={0.9}
                style={[
                  mood.emojiBtn,
                  {
                    opacity: isActive ? 1 : 0.4,
                    transform: [{ scale: isActive ? 1.3 : 1 }],
                    backgroundColor: isActive ? 'rgba(255,255,255,0.95)' : 'transparent',
                    shadowColor: isActive ? '#EC4899' : 'transparent',
                  },
                ]}
              >
                <Text style={mood.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>
    </CardShell>
  );
};

const mood = StyleSheet.create({
  label: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  emojiCard: {
    marginTop: 10,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emojiRow: { flexDirection: 'row', gap: 10, justifyContent: 'space-between', paddingHorizontal: 2 },
  emojiBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  emojiText: { fontSize: 20 },
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

  return (
    <LinearGradient
      colors={['rgba(124,58,237,0.18)', 'rgba(236,72,153,0.12)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={compliance.cardGradientOuter}
    >
      <View
        style={[
          compliance.cardInner,
          {
            backgroundColor: t.cardBg,
            borderColor: t.cardBorder,
          },
        ]}
      >
        <View style={compliance.headerRow}>
          <Text style={[compliance.header, { color: t.textMuted }]}>Today's Compliance</Text>
          {anyNotified ? (
            <View style={compliance.headerNotified}>
              <Ionicons name="checkmark" size={14} color="#22c55e" />
            </View>
          ) : null}
        </View>

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
    </LinearGradient>
  );
};

const compliance = StyleSheet.create({
  cardGradientOuter: { borderRadius: 20, padding: 1, marginBottom: 16 },
  cardInner: { borderRadius: 19, borderWidth: 1, padding: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  header: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
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
  rowLabel: { fontSize: 12, flex: 1, paddingRight: 10 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  toggleBtnRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  toggleText: { fontSize: 12, fontWeight: '800' },
});

const STAR_FILLED_COLOR = '#F59E0B';

const StarRatingCard = ({ icon, title, subtitle, storageKey, gradientFrom, gradientTo, isDark }) => {
  const t = isDark ? DARK : LIGHT;
  const { savedValue, showNotified, save } = useCardState(storageKey);
  const starRating = savedValue ? parseInt(savedValue) : 0;
  return (
    <CardShell icon={icon} title={title} gradientFrom={gradientFrom} gradientTo={gradientTo}
      showNotified={showNotified} hasSavedValue={!!savedValue} isDark={isDark} accentColor="#F59E0B">
      <Text style={star.sessionLabel}>Session Rating</Text>
      <Text style={[rating.subtitle, { color: t.textMuted }]}>{subtitle}</Text>
      <View style={star.starRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity key={n} onPress={() => save(String(n))} activeOpacity={0.7}>
            <Ionicons name={n <= starRating ? 'star' : 'star-outline'} size={32}
              color={n <= starRating ? STAR_FILLED_COLOR : t.textDimmed} />
          </TouchableOpacity>
        ))}
      </View>
    </CardShell>
  );
};

const star = StyleSheet.create({
  sessionLabel: { fontSize: 12, fontWeight: '800', color: 'rgba(245,158,11,0.95)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  starRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
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
    <CardShell icon={icon} title={title} gradientFrom={gradientFrom} gradientTo={gradientTo}
      showNotified={showNotified} hasSavedValue={!!savedValue} isDark={isDark} accentColor={CARD_ACCENT[storageKey]}
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
              <Text style={notes.savedNoteText}>{savedValue}</Text>
              <Text style={[data.timeSince, { color: t.textDimmed }]}>Updated {getTimeSince()}</Text>
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
  savedNoteText: { fontSize: 13, fontStyle: 'italic', marginTop: 2, color: 'rgba(255,255,255,0.55)', lineHeight: 18 },
  noNoteText: { fontSize: 13, fontStyle: 'italic', marginTop: 2, color: 'rgba(255,255,255,0.45)', lineHeight: 18 },
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
  const insets = useSafeAreaInsets();
  const t = isDark ? DARK : LIGHT;
  const icon = (name) => <Ionicons name={name} size={18} color={t.iconColor} />;
  const currentUser = auth?.currentUser;
  const scrollRef = useRef(null);
  const [workoutLogY, setWorkoutLogY] = useState(0);
  const [untilResetMs, setUntilResetMs] = useState(msUntilMidnight());

  useEffect(() => {
    const id = setInterval(() => setUntilResetMs(msUntilMidnight()), 1000);
    return () => clearInterval(id);
  }, []);

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
          primaryActionLabel="View / Log Workout"
          onPressPrimaryAction={() => {
            if (!scrollRef?.current) return;
            scrollRef.current.scrollTo({ y: Math.max(0, workoutLogY - 16), animated: true });
          }}
          illustrationSource={require('../../assets/Lotties for Anatrox/Fitness.json')}
        />

        {/* Today's workout hero (new hierarchy section) */}
        <TodaysWorkoutCard
          isDark={isDark}
          workoutName={workoutLogState?.workoutName}
          hasWorkout={!!workoutLogState?.hasValue}
          onPressCTA={() => {
            if (!scrollRef?.current) return;
            scrollRef.current.scrollTo({ y: Math.max(0, workoutLogY - 16), animated: true });
          }}
        />

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
                rating: typeof trainer?.rating === 'number' ? trainer.rating : 4.9,
                clients: typeof trainer?.clients === 'number' ? trainer.clients : 120,
                experienceYears: typeof trainer?.experienceYears === 'number' ? trainer.experienceYears : undefined,
              }}
              onPressCard={onPressMessage}
              onPressSecondaryCTA={onPressMessage}
              onPressCTA={onPressMessage}
              ctaLabel="Message"
              secondaryCtaLabel="View Profile"
            />
          </View>
        ) : (
          <TouchableOpacity
            style={emptyTrainerStyles.card}
            onPress={onPressMessage}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={isDark ? ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)']}
              style={emptyTrainerStyles.cardInner}
            >
              <View style={emptyTrainerStyles.iconCircle}>
                <Ionicons name="person-add-outline" size={26} color={t.textDimmed} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[emptyTrainerStyles.title, { color: t.text }]}>No trainer yet</Text>
                <Text style={[emptyTrainerStyles.subtitle, { color: t.textMuted }]}>
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
            { type: 'gradientChat', label: 'Messages', onPress: onPressMessage, borderColors: ['#FF6B9D', '#C084FC'], badgeCount: unreadMessageCount },
            { type: 'image', source: require('../../assets/icons/picture.png'), label: 'Photo Gallery', onPress: () => onOpenPhotoGallery?.({ id: trainerClientId, name: trainerClientName }), borderColors: ['#06B6D4', '#C084FC'], badgeCount: photoGalleryBadgeCount },
            { type: 'image', source: require('../../assets/icons/google_gemini.png'), label: 'AI Workouts', onPress: () => onOpenAIWorkouts?.({ id: trainerClientId, name: trainerClientName }), borderColors: ['#FF6B9D', '#F97316'], badgeCount: aiWorkoutsBadgeCount },
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
                    ) : item.type === 'gradientChat' ? (
                      <GradientChatBubblesIcon size={40} />
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
            <View
              onLayout={(e) => {
                setWorkoutLogY(e.nativeEvent.layout.y);
              }}
            >
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
        </View>

        <RatingCard
          icon={icon('flame-outline')}
          title="Muscle Soreness"
          subtitle="Rate how sore you are"
          storageKey="dashboard_soreness"
          gradientFrom="#F97316"
          gradientTo="#C084FC"
          isDark={isDark}
          onAfterSave={onMetricsChange ? (v) => onMetricsChange({ soreness: v }) : undefined}
        />

        <RatingCard
          icon={icon('flash-outline')}
          title="Energy Level"
          subtitle="Rate your energy today"
          storageKey="dashboard_energy"
          gradientFrom="#C084FC"
          gradientTo="#F97316"
          isDark={isDark}
          onAfterSave={onMetricsChange ? (v) => onMetricsChange({ energyLevel: v }) : undefined}
        />

        <RatingCard
          icon={icon('pulse-outline')}
          title="Stress Level"
          subtitle="How stressed are you?"
          storageKey="dashboard_stress"
          gradientFrom="#FF6B9D"
          gradientTo="#06B6D4"
          isDark={isDark}
          onAfterSave={onMetricsChange ? (v) => onMetricsChange({ stressLevel: v }) : undefined}
        />

        <MoodCard icon={icon('happy-outline')} title="Mood Check-in" subtitle="How are you feeling?"
          storageKey="dashboard_mood" gradientFrom="#06B6D4" gradientTo="#F97316" isDark={isDark} />

        <ComplianceCard isDark={isDark} />

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
