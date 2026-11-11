// Shared saving logic for the client dashboard metric cards (sleep, water, steps, ratings, mood, notes).
// Flow: show today's cached value → listen to today's Firestore daily log → save writes cache, Firestore and notifies the trainer.
// Used by the client home screen cards. Moved out of TrainingHomeScreen.jsx with no change in behavior.

import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../app-start/cloudConnection';
import { postDashboardNotification } from '../../for-both/online-connection/loadHomeAlerts';
import { getLocalDateKey } from '../../helpers/getLocalDay';
import { todaysDate } from '../../daily-stats/todaysDate';
import { saveDashboardMetricField } from '../../daily-stats/saveDailyStats';

// ===== NAMED CONSTANTS =====

const MS_PER_MINUTE = 60000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const NOTIFIED_TOAST_MS = 3000;

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

// ===== HELPER FUNCTIONS =====

async function showCachedMetricIfStillToday(storageKey, todayKey, setSavedValue, setSavedAt) {
  const stored = await AsyncStorage.getItem(storageKey);
  const storedTime = await AsyncStorage.getItem(`${storageKey}_time`);
  if (stored == null || stored === '' || !storedTime) return;

  const parsedTime = new Date(storedTime);
  const cacheIsToday = !Number.isNaN(parsedTime.getTime()) && getLocalDateKey(parsedTime) === todayKey;
  if (cacheIsToday) {
    setSavedValue(stored);
    setSavedAt(storedTime);
  }

  const storedDayKey = getLocalDateKey(new Date(storedTime));
  if (storedDayKey !== todayKey) {
    await AsyncStorage.removeItem(storageKey);
    await AsyncStorage.removeItem(`${storageKey}_time`);
  }
}

async function saveMetricAndNotifyTrainer(currentUser, storageKey, value, dateKey) {
  await saveDashboardMetricField(currentUser.uid, storageKey, value, dateKey);

  const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
  const userData = userSnap.exists() ? userSnap.data() : {};
  const trainerId = userData.trainerId || userData.trainer_id || null;
  if (!trainerId) return;

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
  if (notifyResult.ok) return;
  throw new Error(notifyResult.reason || 'notification_failed');
}

export const useCardState = (storageKey, onAfterSave) => {
  const [savedValue, setSavedValue] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [showNotified, setShowNotified] = useState(false);
  const todayDateKey = todaysDate();

  useEffect(() => {
    let unsubLogs = null;
    const load = async () => {
      const uid = auth?.currentUser?.uid;
      const todayKey = todayDateKey;

      const applyLoadedValue = async (valueStr, atIso) => {
        if (valueStr === undefined || valueStr === null || valueStr === '') return false;
        const savedText = typeof valueStr === 'string' ? valueStr : String(valueStr);
        setSavedValue(savedText);
        setSavedAt(atIso || new Date().toISOString());
        try {
          await AsyncStorage.setItem(storageKey, savedText);
          await AsyncStorage.setItem(`${storageKey}_time`, atIso || new Date().toISOString());
        } catch (cacheError) {
          console.warn('useCardState cache write error:', cacheError);
        }
        return true;
      };

      try {
        await showCachedMetricIfStillToday(storageKey, todayKey, setSavedValue, setSavedAt);
        if (!uid || !db) return;

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
          (listenerError) => console.warn('dailyLogs listener error:', listenerError?.code || listenerError?.message || listenerError),
        );
      } catch (loadError) {
        console.warn('useCardState load error:', loadError);
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
    } catch (saveError) {
      console.warn('useCardState save error:', saveError);
    }
    setSavedValue(value);
    setSavedAt(now);
    setShowNotified(true);
    const dateKey = todayDateKey;
    const currentUser = auth?.currentUser;
    if (db && currentUser) {
      try {
        await saveMetricAndNotifyTrainer(currentUser, storageKey, value, dateKey);
      } catch (saveError) {
        console.warn('Firebase save error:', saveError);
      }
    }
    if (onAfterSave) {
      onAfterSave(value);
    }
    setTimeout(() => setShowNotified(false), NOTIFIED_TOAST_MS);
  };

  const getTimeSince = () => {
    if (!savedAt) return '';
    const diff = Date.now() - new Date(savedAt).getTime();
    const mins = Math.floor(diff / MS_PER_MINUTE);
    if (mins < 1) return 'just now';
    if (mins < MINUTES_PER_HOUR) return `${mins}m ago`;
    const hrs = Math.floor(mins / MINUTES_PER_HOUR);
    if (hrs < HOURS_PER_DAY) return `${hrs}h ago`;
    return `${Math.floor(hrs / HOURS_PER_DAY)}d ago`;
  };

  return { savedValue, savedAt, showNotified, save, getTimeSince };
};
