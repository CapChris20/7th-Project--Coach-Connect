import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../app/config';
import { postDashboardNotification } from '../../shared/api/dashboardNotificationApi';
import { getLocalDateKey } from '../../shared/utils/getLocalDay';
import { useLocalTodayDateKey } from '../../shared/daily-metrics/useLocalTodayDateKey';
import {
  saveDashboardWorkoutLog,
  buildWorkoutLogHydration,
  fetchLegacyDailyTrackingSnap,
} from '../../shared/daily-metrics/saveDailyMetricsToFirestore';
import {
  isAllowedClientWorkoutDayLabel,
  WORKOUT_DAY_EXAMPLES_SHORT,
} from '../../shared/utils/workoutDayLabels';

/** Structured workout logger: exercises + sets stored as workoutLog in dailyLogs */
export function useWorkoutLog(onAfterSave) {
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
}
