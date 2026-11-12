// Client dashboard — structure locked to docs/design/mockups/client-home.html.
// Flow: layout paints welcome → up next → trainer row → week → numbers → nutrition → workouts → check-in;
//       the export loads Firestore sessions/metrics and passes handlers into that layout.
// Used by the client shell. Metric cards still write users/{uid}/dailyLogs for today.
//
// vocab: nb = neo-brutalist tokens (3px ink border, hard offset shadow, fill hero) — not GradientFrame chrome

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
import { auth, db } from '../../app-start/cloudConnection';
import { postRemotePushNotify } from '../../for-both/online-connection/sendPhoneAlert';
import { postDashboardNotification } from '../../for-both/online-connection/loadHomeAlerts';
import { getLocalDateKey, msUntilLocalMidnight } from '../../helpers/getLocalDay';
import { todaysDate } from '../../daily-stats/todaysDate';
import {
  retryPendingDailyDashboardArchive,
  tickDailyDashboardDayRollover,
} from '../../daily-stats/saveYesterdaysStats';
import {
  saveDashboardMetricField,
} from '../../daily-stats/saveDailyStats';
import { workoutDiary } from './workoutDiary';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FORM_SCROLL_PROPS, useShellBottomNavInset } from '../../navigation/bottomMenuSpacing';
import { UpcomingSessionCard } from '../../for-both/home-cards/UpcomingSessionCard';
import { WORKOUT_DAY_EXAMPLES_SHORT } from '../../helpers/workoutDayNames';
import { formatTime12 } from '../../helpers/sessionTimeText';
import NbCard from '../../look-and-feel/NbCard';
import HardShadow from '../../look-and-feel/HardShadow';
import NbRing from '../../look-and-feel/NbRing';
import { lightColors, darkColors, accentGradients, navAccentGradient, nb } from '../../look-and-feel/colorPalette';
import { LinearGradient } from 'expo-linear-gradient';
import { useDailyQuote } from '../../for-both/home-cards/DailyQuoteCard';
import {
  DesignLawCheckInCard,
  DesignLawGoToGrid,
  DesignLawLogSheet,
  DesignLawNumberTiles,
  DesignLawNutritionCard,
  DesignLawReviewSheet,
  DesignLawTrainerSheet,
  DesignLawWorkoutCard,
  HANDOFF_PROGRESS,
  HANDOFF_SCHEDULE,
  HANDOFF_WORKOUT,
} from './DesignLawHomeBlocks';
import WriteTrainerReviewPopup from './WriteTrainerReviewPopup';
import FindTrainerBanner from '../../for-both/home-cards/FindTrainerBanner';

// Recolored handoff lifter — yellow circles swapped to coral/pink (owner: no yellow).
const HANDOFF_LIFTER_LOTTIE = require('../../assets/animations/handoff/zlifter-noyellow.json');

// ===== NAMED CONSTANTS =====

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MS_PER_MINUTE = 60000;
const SESSION_STILL_RELEVANT_MS = 3600000;
const SESSION_LIST_REFRESH_MS = 60000;
const DAY_ROLLOVER_TICK_MS = 30000;
const NOTIFIED_TOAST_MS = 3000;
const NOTIFIED_HOLD_MS = 2400;
const ERROR_FLASH_MS = 1500;
const ON_TRACK_SLEEP_HOURS = 7;
const STRONG_ENERGY_SCORE = 7;
const BIO_MIN_CHARS_FOR_LETTER_RATIO = 24;
const MIN_SHELL_ICON_PX = 24;
const DEFAULT_CALORIE_GOAL = 2000;
const SHELL_NAV_PAD_EMBEDDED = 40;
const SHELL_NAV_PAD_STANDALONE = 24;
const BADGE_COUNT_CAP = 99;

// Manipulate here: weekday labels for the mockup .wkd strip (Mon→Sun).
const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const METRIC_TILE_WIDTH = 148;

const MOOD_EMPTY_LOTTIE = require('../../for-both/assets/Happy SUN.json');

// ===== HELPER FUNCTIONS =====

const formatHMS = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / MS_PER_SECOND));
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  const padTwoDigits = (part) => String(part).padStart(2, '0');
  return `${padTwoDigits(hours)}:${padTwoDigits(minutes)}:${padTwoDigits(seconds)}`;
};

// Design Law motivation is a short punch line — clamp long dailyQuotes to a first clause.
// Manipulate here: MAX_MOTIVATION_CHARS = how long the hero line can run before we cut.
const MAX_MOTIVATION_CHARS = 42;
function shortMotivationLine(raw) {
  const text = String(raw || '').trim() || 'Keep showing up.';
  if (text.length <= MAX_MOTIVATION_CHARS) return text;
  const clause = text.split(/(?<=[.!?])\s+|;\s+| — | - /)[0]?.trim() || text;
  if (clause.length <= MAX_MOTIVATION_CHARS) return clause.endsWith('.') ? clause : `${clause}.`;
  return `${text.slice(0, MAX_MOTIVATION_CHARS - 1).trim()}…`;
}

// Handoff B/W/gray surfaces (docs/design/DESIGN.md).
const DARK = {
  bg: [darkColors.nbBackground, darkColors.nbBackground],
  solidBg: darkColors.nbBackground,
  cardBg: darkColors.nbSurface,
  cardBorder: darkColors.nbBorder,
  text: darkColors.nbInk,
  textMuted: darkColors.nbMuted,
  textDimmed: darkColors.nbMuted,
  textSubtle: darkColors.nbMuted,
  inputBg: darkColors.nbSurfaceChip,
  inputBorder: darkColors.nbBorder,
  iconColor: darkColors.nbMuted,
  pillBg: darkColors.nbSurfaceChip,
  pillBorder: darkColors.nbBorder,
  pillText: darkColors.nbInk,
  fill: darkColors.nbFill,
  onFill: darkColors.nbOnFill,
};

const LIGHT = {
  bg: [lightColors.nbBackground, lightColors.nbBackground],
  solidBg: lightColors.nbBackground,
  cardBg: lightColors.nbSurface,
  cardBorder: lightColors.nbBorder,
  text: lightColors.nbInk,
  textMuted: lightColors.nbMuted,
  textDimmed: lightColors.nbMuted,
  textSubtle: lightColors.nbMuted,
  inputBg: lightColors.nbSurfaceChip,
  inputBorder: lightColors.nbBorder,
  iconColor: lightColors.nbMuted,
  pillBg: lightColors.nbSurfaceChip,
  pillBorder: lightColors.nbBorder,
  pillText: lightColors.nbInk,
  fill: lightColors.nbFill,
  onFill: lightColors.nbOnFill,
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
  const tagText = String(raw).trim();
  const keys = Object.keys(TAG_MAP).filter((key) => tagText.includes(key));
  if (keys.length === 0) return formatTag(tagText);
  const ordered = keys.sort((left, right) => tagText.indexOf(left) - tagText.indexOf(right));
  return ordered.map((key) => formatTag(key)).join(' · ');
};

function formatClientWeeklyRange(weekStart, weekEnd) {
  const weekStartText = String(weekStart || '').trim();
  const weekEndText = String(weekEnd || weekStartText).trim();
  if (!weekStartText) return '';
  const startDate = new Date(`${weekStartText}T12:00:00`);
  const endDate = new Date(`${weekEndText}T12:00:00`);
  const startLabel = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endLabel = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}

const sleepStatus = (hoursText) => {
  const hours = parseFloat(hoursText);
  if (hours >= ON_TRACK_SLEEP_HOURS) return 'On track';
  if (hours >= 5) return 'Needs improvement';
  return 'Low sleep';
};

const workoutStatus = (v) => (v && String(v).trim().length > 0 ? 'Logged' : 'Rest day');

const waterStatus = (ouncesText) => {
  const ounces = parseFloat(ouncesText);
  if (ounces >= 64) return 'Well hydrated';
  if (ounces >= 32) return 'Keep going';
  return 'Drink more';
};

const shouldDisplayTrainerBio = (bio) => {
  if (!bio || typeof bio !== 'string') return false;
  const trimmedBio = bio.trim();
  if (trimmedBio.length < 4) return false;
  const fragments = trimmedBio.split(';').filter((fragment) => fragment.trim());
  if (fragments.length >= 4) return false;
  const letters = (trimmedBio.match(/[a-zA-Z]/g) || []).length;
  if (trimmedBio.length > BIO_MIN_CHARS_FOR_LETTER_RATIO && letters / trimmedBio.length < 0.42) return false;
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


function sessionResponseVerb(status) {
  if (status === 'accepted') return 'accepted';
  if (status === 'declined') return 'declined';
  return 'updated';
}

async function clientDisplayName(clientUid) {
  let clientName = auth.currentUser?.displayName || 'Client';
  try {
    const userSnap = await getDoc(doc(db, 'users', clientUid));
    if (!userSnap.exists()) return clientName;
    const userFields = userSnap.data();
    return userFields?.firstName || userFields?.name || userFields?.displayName || clientName;
  } catch (_) {
    return clientName;
  }
}

function coachingPaymentButtonLabelFor(status) {
  if (status === 'past_due') return 'Update Payment';
  if (status === 'active') return 'Manage Coaching Payment';
  if (status === 'payment_required') return 'Set Up Payment';
  return 'Pay';
}

function coachingPaymentShortLabelFor(status) {
  if (status === 'past_due') return 'Update';
  if (status === 'active') return 'Payment';
  return 'Pay';
}

function coachingPaymentStatusLabelFor(status) {
  if (status === 'active') return 'Active';
  if (status === 'past_due') return 'Past due';
  if (status === 'payment_required') return 'Payment required';
  return null;
}

function coachingPaymentStatusToneFor(status) {
  if (status === 'active') return 'success';
  if (status === 'past_due') return 'error';
  if (status === 'payment_required') return 'warning';
  return 'neutral';
}

function trainerClientCount(trainerRecord) {
  if (typeof trainerRecord?.clientCount === 'number') return trainerRecord.clientCount;
  if (typeof trainerRecord?.clients === 'number') return trainerRecord.clients;
  return undefined;
}

function cappedBadgeLabel(count, suffix, emptyLabel) {
  const amount = Number(count) || 0;
  if (amount <= 0) return emptyLabel;
  if (amount > BADGE_COUNT_CAP) return `99+ ${suffix}`;
  return `${count} ${suffix}`;
}

function bentoValueFontSize(isStepsCard, numericLength, isTall) {
  if (isStepsCard && numericLength >= 5) {
    if (isTall) return 30;
    return 26;
  }
  if (isTall) return 36;
  return 32;
}

function moodEmojiBackground(isActive, isDark) {
  if (!isActive) return 'transparent';
  if (isDark) return darkColors.nbSurfaceChip;
  return lightColors.nbSurfaceChip;
}

function dashboardBannerColors(bannerType, isDark) {
  if (bannerType === 'error') {
    return {
      borderColor: 'rgba(239,68,68,0.35)',
      backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.10)',
    };
  }
  if (bannerType === 'warn') {
    return {
      borderColor: 'rgba(245,158,11,0.35)',
      backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.10)',
    };
  }
  if (isDark) {
    return {
      borderColor: darkColors.nbBorder,
      backgroundColor: darkColors.nbSurfaceChip,
    };
  }
  return {
    borderColor: lightColors.nbBorder,
    backgroundColor: lightColors.nbSurface,
  };
}

function DashboardStatusBanner({ displayBanner, pendingReset, isDark, textColor, mutedColor }) {
  if (!displayBanner?.text) return null;
  const bannerColors = dashboardBannerColors(displayBanner.type, isDark);
  return (
    <View
      style={{
        marginTop: 4,
        marginBottom: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: bannerColors.borderColor,
        backgroundColor: bannerColors.backgroundColor,
        paddingVertical: 10,
        paddingHorizontal: 12,
      }}
    >
      <Text style={{ color: textColor, fontSize: 13, fontWeight: '700' }}>{displayBanner.text}</Text>
      {pendingReset ? (
        <Text style={{ color: mutedColor, fontSize: 12, marginTop: 4 }}>
          Retrying every 30 seconds…
        </Text>
      ) : null}
    </View>
  );
}

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

const useCardState = (storageKey, onAfterSave) => {
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

const WorkoutLogCard = ({ icon, gradientFrom, gradientTo, isDark, onAfterSave, state }) => {
  const themeColors = isDark ? DARK : LIGHT;
  const logState = state || workoutDiary(onAfterSave);
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
      statusBadge={statusBadge}
      showNotified={showNotified}
      hasSavedValue={hasSavedValue}
      isDark={isDark}
      accentColor={CARD_ACCENT.dashboard_workouts}
    >
      {showForm ? (
        <View style={{ marginTop: 6, gap: 10 }}>
          <TextInput
            style={[data.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.inputBorder, color: themeColors.text }]}
            placeholder={`Workout day — ${WORKOUT_DAY_EXAMPLES_SHORT}`}
            placeholderTextColor={themeColors.textMuted}
            value={workoutName}
            onChangeText={setWorkoutName}
          />
          <Text style={[workoutLog.label, { color: themeColors.textMuted }]}>Exercises</Text>
          {workoutExercises.map((ex) => (
            <View key={ex.id} style={{ marginBottom: 10 }}>
              <TextInput
                style={{
                  height: 44,
                  borderRadius: 12,
                  borderWidth: 1,
                  paddingHorizontal: 12,
                  fontSize: 14,
                  backgroundColor: themeColors.inputBg,
                  borderColor: themeColors.inputBorder,
                  color: themeColors.text,
                }}
                placeholder="Exercise name (e.g. Bench Press)"
                placeholderTextColor={themeColors.textMuted}
                value={ex.name}
                onChangeText={(v) => updateExerciseName(ex.id, v)}
              />
              {ex.sets.map((set) => (
                <View
                  key={set.id}
                  style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}
                >
                  <Text style={{ width: 40, fontSize: 12, color: themeColors.textDimmed }}>
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
                      backgroundColor: themeColors.inputBg,
                      borderColor: themeColors.inputBorder,
                      color: themeColors.text,
                    }}
                    placeholder="Reps"
                    placeholderTextColor={themeColors.textMuted}
                    keyboardType="numeric"
                    value={set.reps}
                    onChangeText={(v) => updateSetField(ex.id, set.id, 'reps', v)}
                  />
                  <Text style={{ marginHorizontal: 16, fontSize: 12, color: themeColors.textDimmed }}>×</Text>
                  <TextInput
                    style={{
                      width: 80,
                      height: 40,
                      borderRadius: 12,
                      borderWidth: 1,
                      paddingHorizontal: 10,
                      fontSize: 13,
                      backgroundColor: themeColors.inputBg,
                      borderColor: themeColors.inputBorder,
                      color: themeColors.text,
                    }}
                    placeholder="lbs"
                    placeholderTextColor={themeColors.textMuted}
                    keyboardType="numeric"
                    value={set.weight}
                    onChangeText={(v) => updateSetField(ex.id, set.id, 'weight', v)}
                  />
                  <TouchableOpacity
                    onPress={() => removeSet(ex.id, set.id)}
                    style={{ padding: 6, marginLeft: 4 }}
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={16} color={themeColors.textDimmed} />
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
                  backgroundColor: themeColors.pillBg,
                  borderWidth: 1,
                  borderColor: themeColors.pillBorder,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Ionicons name="add-circle-outline" size={18} color={themeColors.pillText} />
                <Text style={{ fontSize: 13, color: themeColors.pillText, textAlign: 'center' }}>Add Set</Text>
              </TouchableOpacity>
              <View
                style={{
                  height: 1,
                  marginTop: 10,
                  backgroundColor: themeColors.cardBorder,
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
              borderColor: themeColors.pillBorder,
              backgroundColor: themeColors.pillBg,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="add-outline" size={16} color={themeColors.pillText} />
            <Text style={{ fontSize: 14, color: themeColors.pillText }}>Add Exercise</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={save} activeOpacity={0.85}>
            <View
              style={[
                data.saveBtn,
                {
                  minHeight: 50,
                  paddingVertical: 14,
                  borderRadius: 10,
                  borderWidth: nb.borderWidth,
                  borderColor: themeColors.cardBorder,
                  backgroundColor: themeColors.fill,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
              ]}
            >
              <Text style={[data.saveBtnText, { fontSize: 16, color: themeColors.onFill }]}>Save workout</Text>
            </View>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <Text style={[logCompleted.loggedTag, { color: '#10B981' }]}>WORKOUT LOGGED ✓</Text>
          <Text style={[logCompleted.todayLine, { color: themeColors.textMuted }]}>
            Today — <Text style={{ color: themeColors.text, fontWeight: '800' }}>{workoutName || 'Workout'}</Text>
          </Text>
          <Text style={[logCompleted.sectionLabel, { color: themeColors.textMuted }]}>EXERCISES COMPLETED</Text>
          <View style={[logCompleted.summaryBox, { borderColor: themeColors.inputBorder, backgroundColor: themeColors.inputBg }]}>
            {workoutExercises
              .filter((ex) => ex.name.trim())
              .map((ex) => (
                <View key={ex.id} style={{ marginBottom: 12 }}>
                  <Text style={[logCompleted.exerciseName, { color: themeColors.text }]}>{ex.name.trim()}</Text>
                  {ex.sets.map((set, setIndex) => {
                    const repsLabel = String(set.reps || '').trim() || '—';
                    const weightLabel = String(set.weight || '').trim() || '—';
                    return (
                      <Text key={set.id} style={[logCompleted.setLine, { color: themeColors.textMuted }]}>
                        Set {setIndex + 1}: {repsLabel} reps × {weightLabel} lbs
                      </Text>
                    );
                  })}
                </View>
              ))}
          </View>
          <View style={logCompleted.actionRow}>
            <TouchableOpacity onPress={() => setIsEditing(true)} activeOpacity={0.85} style={logCompleted.textBtn}>
              <Text style={[logCompleted.textBtnLabel, { color: lightColors.primary }]}>Edit</Text>
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
  const themeColors = isDark ? DARK : LIGHT;
  return (
    <View style={{ marginTop: 12 }}>
      <View style={[quickStatsStyles.row, { backgroundColor: themeColors.cardBg, borderColor: themeColors.border }]}>
        <View style={quickStatsStyles.item}>
          <Text style={[quickStatsStyles.valueSolid, { color: '#E879F9' }]}>{`${todayCalories || 0}`}</Text>
          <Text style={[quickStatsStyles.label, { color: themeColors.textMuted }]}>Calories</Text>
        </View>
        <View style={[quickStatsStyles.divider, { backgroundColor: themeColors.border }]} />
        <View style={quickStatsStyles.item}>
          <Text style={[quickStatsStyles.value, { color: themeColors.text }]}>{typeof sleepHoursValue === 'number' ? sleepHoursValue : 0}</Text>
          <Text style={[quickStatsStyles.label, { color: themeColors.textMuted }]}>Sleep (hrs)</Text>
        </View>
        <View style={[quickStatsStyles.divider, { backgroundColor: themeColors.border }]} />
        <View style={quickStatsStyles.item}>
          <Text style={[quickStatsStyles.value, { color: themeColors.text }]}>{waterOz || 0}oz</Text>
          <Text style={[quickStatsStyles.label, { color: themeColors.textMuted }]}>Water</Text>
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

// Icon accents stay ink — colorful chrome was the old dashboard look.
const CARD_ACCENT = {
  dashboard_sleep: lightColors.nbInk,
  dashboard_workouts: lightColors.nbInk,
  dashboard_water: lightColors.nbInk,
  dashboard_weight: lightColors.nbInk,
  dashboard_bodyfat: lightColors.nbInk,
  dashboard_steps: lightColors.nbInk,
  dashboard_soreness: lightColors.nbInk,
  dashboard_energy: lightColors.nbInk,
  dashboard_stress: lightColors.nbInk,
  dashboard_mood: lightColors.nbInk,
  dashboard_workout_rating: lightColors.nbInk,
  dashboard_notes: lightColors.nbInk,
};

const shellIconRender = (icon, isDark, accent) => {
  if (!React.isValidElement(icon)) return icon;
  // Handoff NbIconChip already owns its look — do not force Ionicons color/size onto it.
  if (icon.props?.source != null || icon.type === NbIconChip) return icon;
  return React.cloneElement(icon, {
    color: isDark ? themeInkOnDark() : (accent || lightColors.nbInk),
    size: Math.max(Number(icon.props?.size) || 0, MIN_SHELL_ICON_PX),
  });
};

function themeInkOnDark() {
  return darkColors.nbInk;
}

const CardShell = ({
  icon,
  title,
  subtitle: headerSubtitle,
  // Kept so callers do not break — chrome is solid ink now, not gradient rims.
  gradientFrom: _gradientFrom,
  gradientTo: _gradientTo,
  topBorderColors: _topBorderColors,
  statusBadge,
  showNotified,
  hasSavedValue,
  isDark,
  children,
  accentColor,
  rightAction,
}) => {
  const themeColors = isDark ? DARK : LIGHT;
  const notifiedOpacity = useRef(new Animated.Value(0)).current;
  const accent = accentColor || themeColors.text;

  useEffect(() => {
    if (showNotified) {
      Animated.sequence([
        Animated.timing(notifiedOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(NOTIFIED_HOLD_MS),
        Animated.timing(notifiedOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [showNotified]);

  // Mockup .card — 3px ink border + hard shadow via NbCard (not GradientFrame).
  return (
    <NbCard style={shell.outer}>
      <View style={shell.body}>
        {rightAction ? <View style={shell.rightAction}>{rightAction}</View> : null}
        {statusBadge ? (
          <View style={[shell.badge, { backgroundColor: themeColors.pillBg, borderColor: themeColors.pillBorder }]}>
            <Ionicons name="checkmark-circle" size={14} color={themeColors.text} style={shell.badgeIcon} />
            <Text style={[shell.badgeText, { color: themeColors.pillText }]}>{statusBadge}</Text>
          </View>
        ) : null}

        <View style={shell.headerRow}>
          <View
            style={[
              shell.iconSquare,
              {
                backgroundColor: themeColors.cardBg,
                borderColor: themeColors.cardBorder,
              },
            ]}
          >
            {shellIconRender(icon, isDark, accent)}
          </View>
          <View style={shell.headerTextCol}>
            <Text style={[shell.title, { color: themeColors.text }]}>{title}</Text>
            {headerSubtitle ? (
              <Text style={[shell.headerSubtitle, { color: themeColors.textMuted }]}>{headerSubtitle}</Text>
            ) : null}
          </View>
        </View>

        <View style={shell.childrenWrap}>{children}</View>

        {showNotified ? (
          <Animated.View style={[shell.notified, { opacity: notifiedOpacity }]}>
            <Ionicons name="checkmark-circle" size={14} color={themeColors.text} />
            <Text style={[shell.notifiedText, { color: themeColors.text }]}>Trainer notified</Text>
          </Animated.View>
        ) : !hasSavedValue ? (
          <Text style={[shell.subtleNote, { color: themeColors.textSubtle }]}>✓ Trainer notified when entered</Text>
        ) : null}
      </View>
    </NbCard>
  );
};

const shell = StyleSheet.create({
  outer: {
    marginBottom: 16,
    padding: 0,
  },
  body: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    position: 'relative',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 6,
    borderWidth: nb.borderWidthPill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 12,
    gap: 6,
  },
  badgeIcon: { marginRight: 0 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, zIndex: 1 },
  // vocab: .ib in the mockup = square icon chip with 3px border (not a soft circle)
  iconSquare: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerTextCol: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 13, fontWeight: '500', marginTop: 4, lineHeight: 18 },
  childrenWrap: { marginTop: 12, zIndex: 1 },
  rightAction: { position: 'absolute', top: 14, right: 14, zIndex: 3 },
  notified: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, zIndex: 1 },
  notifiedText: { fontSize: 12, fontWeight: '700' },
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
  const themeColors = isDark ? DARK : LIGHT;
  const { savedValue, showNotified, save, getTimeSince } = useCardState(storageKey, onAfterSave);
  const [value, setValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState(false);

  const handleSave = () => {
    if (!textMode) {
      const num = parseFloat(value);
      if (isNaN(num) || num < min || num > max) { setError(true); setTimeout(() => setError(false), ERROR_FLASH_MS); return; }
    } else if (!value.trim()) { setError(true); setTimeout(() => setError(false), ERROR_FLASH_MS); return; }
    save(value);
    setIsEditing(false);
  };

  const showInput = !savedValue || isEditing;
  const statusBadge = statusFn && savedValue ? statusFn(savedValue) : null;
  const subtitleText = (() => {
    if (statusBadge) return statusBadge;

    // For dashboard bento metrics, show the value's meaning under the number (e.g., "8 hours", "90 oz").
    if (variant === 'bentoMetric' && unit && String(unit).trim()) {
      const unitLabel = String(unit).trim();
      const hasSaved = savedValue !== null && savedValue !== undefined && String(savedValue).trim() !== '';
      if (!hasSaved) return unitLabel;

      const savedText = String(savedValue);
      if (unitLabel === 'hrs/day') return `${savedText} hours`;
      if (unitLabel === 'oz') return `${savedText} oz`;
      if (unitLabel === 'lbs') return `${savedText} lbs`;
      if (unitLabel === '%') return `${savedText}%`;
      if (unitLabel === 'steps') return `${savedText} steps`;
      if (unitLabel.endsWith('/day')) return `${savedText} ${unitLabel.replace('/day', '').trim()}`;
      return `${savedText} ${unitLabel}`;
    }

    if (unit && String(unit).trim()) return unit;
    return savedValue ? `Updated ${getTimeSince()}` : `Updated ${getTimeSince()}`;
  })();

  // Mockup .vt tile — fixed-width horizontal card, left-aligned label + big number.
  if (variant === 'bentoMetric') {
    const chipIndex = String(storageKey || '').includes('water')
      ? 3
      : String(storageKey || '').includes('weight')
        ? 1
        : String(storageKey || '').includes('steps')
          ? 4
          : 0;
    return (
      <HardShadow offset={nb.shadowOffsetSmall} radius={10} style={[bentoMetric.outer, { width: METRIC_TILE_WIDTH, minHeight: bentoHeight }]}>
        <View
          style={[
            bentoMetric.card,
            {
              backgroundColor: themeColors.cardBg,
              borderColor: themeColors.cardBorder,
              minHeight: bentoHeight,
            },
          ]}
        >
          {React.isValidElement(icon) ? (
            <View style={{ marginBottom: 8 }}>{shellIconRender(icon, isDark, themeColors.text)}</View>
          ) : (
            <View
              style={[
                bentoMetric.chipFallback,
                { borderColor: themeColors.cardBorder, backgroundColor: accentGradients[chipIndex % accentGradients.length][0] },
              ]}
            />
          )}
          <Text style={[bentoMetric.label, { color: themeColors.textMuted }]}>{(bentoLabel || title || '').toUpperCase()}</Text>

          {showInput ? (
            <View style={bentoMetric.inputArea}>
              <TextInput
                style={[
                  bentoMetric.input,
                  {
                    backgroundColor: themeColors.inputBg,
                    borderColor: error ? themeColors.text : themeColors.inputBorder,
                    color: themeColors.text,
                  },
                ]}
                value={value}
                onChangeText={(v) => {
                  setValue(v);
                  setError(false);
                }}
                placeholder={placeholder}
                placeholderTextColor={themeColors.textMuted}
                keyboardType={textMode ? 'default' : 'numeric'}
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
              <TouchableOpacity onPress={handleSave} activeOpacity={0.85} hitSlop={6}>
                <View style={[bentoMetric.saveBtn, { backgroundColor: themeColors.fill, borderColor: themeColors.cardBorder }]}>
                  <Text style={[data.saveBtnText, { color: themeColors.onFill }]}>Save</Text>
                </View>
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
              <Text style={[bentoMetric.valueText, { color: themeColors.text }]}>
                {`${savedValue ?? '—'}`}
                {unit ? (
                  <Text style={[bentoMetric.unitInline, { color: themeColors.textMuted }]}>{` ${String(unit).replace('/day', '')}`}</Text>
                ) : null}
              </Text>
              <Text style={[bentoMetric.subtitle, { color: themeColors.textMuted }]}>
                {savedValue ? 'Tap to edit' : subtitleText}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </HardShadow>
    );
  }

  return (
    <CardShell icon={icon} title={title} gradientFrom={gradientFrom} gradientTo={gradientTo}
      statusBadge={statusBadge} showNotified={showNotified} hasSavedValue={!!savedValue} isDark={isDark}
      accentColor={CARD_ACCENT[storageKey]}>
      {!savedValue && !isEditing && (
        <Text style={[data.example, { color: themeColors.textMuted }]}>{defaultExample}</Text>
      )}
      {showInput ? (
        <View style={data.inputRow}>
          <TextInput
            style={[data.input, { backgroundColor: themeColors.inputBg, borderColor: error ? 'rgba(239,68,68,0.6)' : themeColors.inputBorder, color: themeColors.text }]}
            value={value} onChangeText={(v) => { setValue(v); setError(false); }}
            placeholder={placeholder} placeholderTextColor={themeColors.textMuted}
            keyboardType={textMode ? 'default' : 'numeric'} returnKeyType="done" onSubmitEditing={handleSave}
          />
          <TouchableOpacity onPress={handleSave} activeOpacity={0.85}>
            <View style={[data.saveBtn, { backgroundColor: themeColors.fill, borderWidth: nb.borderWidth, borderColor: themeColors.cardBorder, borderRadius: 10 }]}>
              <Text style={[data.saveBtnText, { color: themeColors.onFill }]}>Save</Text>
            </View>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={() => { setIsEditing(true); setValue(savedValue || ''); }} activeOpacity={0.8}>
          {textMode ? (
            <View>
              <View style={[data.savedText, { backgroundColor: themeColors.inputBg, borderColor: themeColors.inputBorder }]}>
                <Text style={{ fontSize: 13, lineHeight: 20, color: themeColors.text }}>{savedValue}</Text>
              </View>
              <Text style={[data.tapEdit, { color: themeColors.textDimmed }]}>tap to edit</Text>
            </View>
          ) : (
            <View>
              <Text style={[data.savedNumber, { color: gradientFrom }]}>
                {savedValue} <Text style={[data.unit, { color: themeColors.textMuted }]}>{unit}</Text>
              </Text>
              <Text style={[data.timeSince, { color: themeColors.textDimmed }]}>Updated {getTimeSince()}</Text>
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
    marginRight: 12,
  },
  card: {
    width: '100%',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'flex-start',
  },
  chipFallback: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
  },
  label: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 8,
    lineHeight: 14,
  },
  inputArea: {
    width: '100%',
    gap: 8,
  },
  input: {
    width: '100%',
    height: 40,
    borderRadius: 8,
    borderWidth: nb.borderWidth,
    paddingHorizontal: 10,
    fontSize: 14,
    textAlign: 'left',
  },
  saveBtn: {
    borderRadius: 10,
    borderWidth: nb.borderWidth,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  contentTouchable: {
    width: '100%',
    alignItems: 'flex-start',
  },
  valueText: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 34,
  },
  unitInline: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
    textDecorationLine: 'underline',
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
  if (n <= STRONG_ENERGY_SCORE) return 'Strong energy — a good day to progress.';
  return 'High energy — great day to push quality reps.';
};
const stressInterpret = (n) => {
  if (n <= 2) return 'Low stress — manageable day.';
  if (n <= 4) return 'Mild stress — keep routines that help you downshift.';
  if (n <= 6) return 'Moderate stress — protect recovery and sleep.';
  return 'High stress — simplify training and create breathing room.';
};
const workoutRatingInterpret = (score, maxScore) => {
  const ratingRatio = score / maxScore;
  if (ratingRatio <= 0.35) return 'Light session — it still counts toward consistency.';
  if (ratingRatio <= 0.55) return 'Solid effort — room to keep building.';
  if (ratingRatio <= 0.75) return 'Strong session — nice work staying engaged.';
  if (ratingRatio <= 0.9) return 'Great session — you pushed with intent.';
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
  const themeColors = isDark ? DARK : LIGHT;
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
          <Text style={[rating.summaryBig, { color: themeColors.text }]}>
            You rated:{' '}
            <Text style={{ color: themeColors.text }}>{savedValue}</Text> out of {maxRating}
          </Text>
          <Text style={[rating.interpret, { color: themeColors.textMuted }]}>{line}</Text>
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
                    <View style={[rating.pillActive, { backgroundColor: themeColors.fill, borderColor: themeColors.cardBorder }]}>
                      <Text style={[rating.pillTextActive, { color: themeColors.onFill }]}>{n}</Text>
                    </View>
                  ) : (
                    <View style={[rating.pillIdle, { backgroundColor: themeColors.inputBg, borderColor: themeColors.inputBorder }]}>
                      <Text style={[rating.pillTextIdle, { color: themeColors.textMuted }]}>{n}</Text>
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
    minWidth: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  pillIdle: {
    minWidth: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: nb.borderWidth,
    paddingHorizontal: 6,
  },
  pillTextActive: { fontSize: 18, fontWeight: '900' },
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
  const themeColors = isDark ? DARK : LIGHT;
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
          <Text style={[rating.summaryBig, { color: themeColors.text }]}>
            You're feeling:{' '}
            <Text style={{ color: '#64D2FF' }}>{label}</Text>
          </Text>
          <Text style={[rating.interpret, { color: themeColors.textMuted }]}>Nice! Keep checking in — it helps your coach support you.</Text>
          <TouchableOpacity onPress={() => setEditing(true)} hitSlop={8}>
            <Text style={{ color: lightColors.primary, fontWeight: '800', fontSize: 14 }}>Edit mood</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[mood.emojiCard, { borderColor: themeColors.inputBorder, backgroundColor: themeColors.inputBg }]}>
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
                      borderColor: isActive ? lightColors.primary : 'transparent',
                      backgroundColor: moodEmojiBackground(isActive, isDark),
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
  const themeColors = isDark ? DARK : LIGHT;
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
            <Text style={[toggle.label, { color: themeColors.textMuted }]}>{q.label}</Text>
            <View style={toggle.btnRow}>
              {['Yes', 'No'].map((opt) => {
                const isActive = values[q.key] === opt;
                return (
                  <TouchableOpacity key={opt} onPress={() => handleToggle(q.key, opt)} activeOpacity={0.85}>
                    {isActive ? (
                      <View style={[toggle.btn, { backgroundColor: themeColors.fill, borderWidth: nb.borderWidth, borderColor: themeColors.cardBorder }]}>
                        <Text style={[toggle.btnText, { color: themeColors.onFill }]}>{opt}</Text>
                      </View>
                    ) : (
                      <View style={[toggle.btn, { backgroundColor: themeColors.pillBg, borderWidth: 1, borderColor: themeColors.pillBorder }]}>
                        <Text style={[toggle.btnText, { color: themeColors.pillText }]}>{opt}</Text>
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
  const themeColors = isDark ? DARK : LIGHT;
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
      showNotified={showNotified}
      hasSavedValue={!!savedValue}
      isDark={isDark}
      accentColor={CARD_ACCENT[storageKey]}
      rightAction={
        <TouchableOpacity
          onPress={startEdit}
          activeOpacity={0.85}
          style={[notes.pencilBtn, { borderColor: themeColors.cardBorder, backgroundColor: themeColors.cardBg }]}
          hitSlop={10}
        >
          <Ionicons name="pencil-outline" size={16} color={themeColors.text} />
        </TouchableOpacity>
      }
    >
      {showInput ? (
        <View style={{ marginTop: 6 }}>
          <TextInput
            style={[notes.textarea, { backgroundColor: themeColors.inputBg, borderColor: themeColors.inputBorder, color: themeColors.text }]}
            value={value} onChangeText={setValue} placeholder={placeholder}
            placeholderTextColor={themeColors.textMuted} multiline numberOfLines={4} textAlignVertical="top"
          />
          <TouchableOpacity onPress={handleSave} activeOpacity={0.85}>
            <View
              style={[
                data.saveBtn,
                {
                  marginTop: 6,
                  alignSelf: 'flex-start',
                  backgroundColor: themeColors.fill,
                  borderWidth: nb.borderWidth,
                  borderColor: themeColors.cardBorder,
                  borderRadius: 10,
                },
              ]}
            >
              <Text style={[data.saveBtnText, { color: themeColors.onFill }]}>Save</Text>
            </View>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={startEdit} activeOpacity={0.85} style={{ marginTop: 4 }}>
          {savedValue ? (
            <>
              <Text style={{ color: themeColors.text, fontWeight: '900', fontSize: 12, letterSpacing: 0.4, marginBottom: 8 }}>
                NOTE SAVED ✓
              </Text>
              <Text style={[notes.savedNoteText, { color: themeColors.text }]}>{savedValue}</Text>
              <Text style={[data.timeSince, { color: themeColors.textDimmed }]}>Updated {getTimeSince()}</Text>
              <Text style={{ color: themeColors.text, fontWeight: '800', fontSize: 13, marginTop: 10, textDecorationLine: 'underline' }}>Tap to edit</Text>
            </>
          ) : (
            <Text style={[notes.noNoteText, { color: themeColors.textMuted }]}>Tap to add a note for your trainer</Text>
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
    borderColor: darkColors.nbBorder,
    backgroundColor: darkColors.nbSurfaceChip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedNoteText: { fontSize: 14, lineHeight: 22, fontWeight: '600' },
  noNoteText: { fontSize: 13, fontStyle: 'italic', marginTop: 2, color: darkColors.nbMuted, lineHeight: 18 },
});

function TrainingHomeScreenLayout({
  scrollRef,
  embedInLayout,
  shellBottomPad,
  isDark,
  displayBanner,
  pendingReset,
  currentUser,
  onOpenWeeklyReport,
  weeklyReportCard,
  weeklyReportCardLoading,
  untilResetMs,
  dashboardPendingSessions,
  dashboardReminderSessions,
  trainerName,
  respondToDashboardSession,
  trainer,
  trainerTitle,
  trainerSpecialties,
  trainerLocation,
  onPressMessage,
  handleViewProfile,
  // Opens RemoveTrainerPopup so the client can end the link from this card.
  onOpenRemoveTrainer,
  showCoachingPaymentOnCard,
  handleOpenPayment,
  coachingPaymentButtonLabel,
  coachingPaymentShortLabel,
  coachingRateLabel,
  trainerPricingLine,
  coachingPaymentStatusLabel,
  coachingPaymentStatusTone,
  onPressFindTrainer,
  unreadMessageCount,
  onOpenPhotoGallery,
  trainerClientId,
  trainerClientName,
  photoGalleryBadgeCount,
  onOpenAIWorkouts,
  aiWorkoutsBadgeCount,
  onMetricsChange,
  handleWorkoutAfterSave,
  workoutLogState,
  todayCalories,
  calorieGoal,
  proteinG,
  carbsG,
  fatsG,
  proteinGoal,
  carbsGoal,
  fatsGoal,
  waterOz,
  sleepHoursValue,
  onPressCalories,
  onOpenNotesFiles,
  notesFilesCount,
  notesFilesNewCount,
  recentWorkouts,
  localClock,
}) {
  const themeColors = isDark ? DARK : LIGHT;
  const firstName = String(currentUser?.displayName || '').trim().split(' ')[0] || 'Client';
  const userInitials = String(firstName).slice(0, 2).toUpperCase() || 'YO';
  const hour = (localClock instanceof Date ? localClock : new Date()).getHours();
  const dayPart = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dailyQuote = useDailyQuote(currentUser?.uid);

  // Design Law sheets — log metric / trainer actions / review (screens 5–7)
  const [logMetricKey, setLogMetricKey] = useState(null);
  const [trainerSheetOpen, setTrainerSheetOpen] = useState(false);
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false);
  const [legacyReviewOpen, setLegacyReviewOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const noteHydrated = useRef(false);

  // Check-in + secondary metrics still use the same dailyLogs keys as the old cards
  const sorenessState = useCardState('dashboard_soreness', onMetricsChange ? (v) => onMetricsChange({ soreness: v }) : undefined);
  const energyState = useCardState('dashboard_energy', onMetricsChange ? (v) => onMetricsChange({ energyLevel: v }) : undefined);
  const stressState = useCardState('dashboard_stress', onMetricsChange ? (v) => onMetricsChange({ stressLevel: v }) : undefined);
  const moodState = useCardState('dashboard_mood');
  const workoutRatingState = useCardState('dashboard_workout_rating');
  const notesState = useCardState('dashboard_notes');
  const weightState = useCardState('dashboard_weight');
  const stepsState = useCardState('dashboard_steps');
  const sleepState = useCardState(
    'dashboard_sleep',
    onMetricsChange
      ? (val) => {
          const hours = parseFloat(val);
          if (!Number.isNaN(hours)) onMetricsChange({ sleepHours: hours });
        }
      : undefined,
  );
  const waterState = useCardState(
    'dashboard_water',
    onMetricsChange
      ? (val) => {
          const ounces = parseFloat(val);
          if (!Number.isNaN(ounces)) onMetricsChange({ waterIntake: ounces });
        }
      : undefined,
  );

  const saveCheckInField = (storageKey, value) => {
    if (storageKey === 'dashboard_soreness') sorenessState.save(value);
    else if (storageKey === 'dashboard_energy') energyState.save(value);
    else if (storageKey === 'dashboard_stress') stressState.save(value);
    else if (storageKey === 'dashboard_mood') moodState.save(value);
    else if (storageKey === 'dashboard_workout_rating') workoutRatingState.save(value);
  };

  // Hydrate note draft once from storage/Firestore so typing does not re-save every keystroke
  useEffect(() => {
    if (noteHydrated.current) return;
    if (notesState.savedValue == null) return;
    setNoteDraft(String(notesState.savedValue));
    noteHydrated.current = true;
  }, [notesState.savedValue]);

  // Up-next: invite first, else next accepted reminder (mockup "Up next" card).
  const upNextInvite = dashboardPendingSessions[0] || null;
  const upNextReminder = dashboardReminderSessions[0] || null;
  const upNextSession = upNextInvite || upNextReminder;
  const upNextIsInvite = !!upNextInvite;

  // Your week — count completedWorkouts whose local date falls in this calendar week (Mon–Sun).
  const weekInfo = (() => {
    const now = localClock instanceof Date ? localClock : new Date();
    const dow = (now.getDay() + 6) % 7; // Mon=0
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - dow);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const startKey = getLocalDateKey(start);
    const endKey = getLocalDateKey(end);
    const doneDays = new Set();
    (recentWorkouts || []).forEach((w) => {
      const raw = w.dateKey || w.localDate || w.completedAt?.toDate?.() || w.completedAt;
      let key = null;
      if (typeof raw === 'string' && raw.length >= 10) key = raw.slice(0, 10);
      else if (raw instanceof Date) key = getLocalDateKey(raw);
      else if (raw) {
        try { key = getLocalDateKey(new Date(raw)); } catch (_) {}
      }
      if (key && key >= startKey && key <= endKey) {
        const d = new Date(`${key}T12:00:00`);
        doneDays.add((d.getDay() + 6) % 7);
      }
    });
    const sessionsDone = doneDays.size;
    const sessionsGoal = 4;
    const monthShort = start.toLocaleString(undefined, { month: 'short' });
    const rangeLabel = `${monthShort} ${start.getDate()} to ${end.getDate()}`;
    return { sessionsDone, sessionsGoal, doneDays, rangeLabel, pct: Math.min(1, sessionsDone / sessionsGoal) };
  })();

  const trainerInitials = String(trainerName || 'TR')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const sessionWhenParts = (session) => {
    const label = formatTime12(session?.time) || '—';
    const parts = String(label).split(' ');
    const clock = parts[0] || '—';
    const meridiem = parts[1] || '';
    const mins = session?.durationMin || session?.duration || 60;
    return { clock, sub: `${meridiem}${meridiem ? ' · ' : ''}${mins} min` };
  };

  // Layout law: docs/design/Design-Law/screens/client-home
  return (
    <View style={{ flex: 1, backgroundColor: themeColors.solidBg }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          screen.scroll,
          // TopHeader owns status-bar inset — keep .hi tight under the profile/settings strip
          embedInLayout ? { paddingTop: 8 } : { paddingTop: 20 },
          { paddingBottom: Math.max(shellBottomPad, nb.bottomNavClearance), paddingHorizontal: nb.screenGutter },
        ]}
        {...FORM_SCROLL_PROPS}
      >
        <DashboardStatusBanner
          displayBanner={displayBanner}
          pendingReset={pendingReset}
          isDark={isDark}
          textColor={themeColors.text}
          mutedColor={themeColors.textMuted}
        />

        {/* .hi — avatar + greeting + weekly-report square */}
        <View style={dash.hi}>
          <LinearGradient
            colors={navAccentGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[dash.av, { borderColor: themeColors.cardBorder }]}
          >
            <Text style={[dash.avText, { color: lightColors.nbInk }]}>{userInitials}</Text>
          </LinearGradient>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 13, color: themeColors.textMuted }}>
              {`${(localClock instanceof Date ? localClock : new Date()).toLocaleDateString(undefined, { weekday: 'long' })} ${dayPart}`}
            </Text>
            <Text style={{ fontSize: 19, fontWeight: '900', letterSpacing: -0.3, color: themeColors.text }}>
              {`${greeting}, ${firstName}`}
            </Text>
          </View>
          {typeof onOpenWeeklyReport === 'function' ? (
            <TouchableOpacity
              onPress={() => onOpenWeeklyReport()}
              accessibilityLabel="Notifications and week in review"
              style={[dash.sq, { borderColor: themeColors.cardBorder, backgroundColor: themeColors.cardBg }]}
            >
              {weeklyReportCardLoading ? (
                <ActivityIndicator size="small" color={themeColors.text} />
              ) : (
                <Ionicons name="notifications-outline" size={22} color={themeColors.text} />
              )}
            </TouchableOpacity>
          ) : null}
        </View>

        {/* .welcome — Design Law poster: short punch line + quiet reset + lifter */}
        <HardShadow offset={nb.shadowOffsetHero} radius={10} style={{ marginBottom: nb.blockGap }}>
          <View style={[dash.welcome, { backgroundColor: themeColors.fill, borderColor: themeColors.cardBorder }]}>
            <View style={{ flex: 1, paddingRight: 6, justifyContent: 'center' }}>
              <Text style={[dash.eybOnFill, { color: themeColors.onFill }]}>Daily motivation</Text>
              <Text style={[dash.welcomeQuote, { color: themeColors.onFill }]} numberOfLines={2}>
                {shortMotivationLine(dailyQuote.q)}
              </Text>
              {dailyQuote.a ? (
                <Text style={[dash.welcomeAuthor, { color: themeColors.onFill }]} numberOfLines={1}>
                  {`— ${dailyQuote.a}`}
                </Text>
              ) : null}
              <Text style={[dash.welcomeSub, { color: themeColors.onFill }]}>
                {weekInfo.sessionsDone > 0
                  ? `Session ${weekInfo.sessionsDone} of ${weekInfo.sessionsGoal} this week`
                  : `Resets in ${formatHMS(untilResetMs)}`}
              </Text>
            </View>
            <LottieView source={HANDOFF_LIFTER_LOTTIE} autoPlay loop style={{ width: 118, height: 118 }} />
          </View>
        </HardShadow>

        {/* Up next */}
        <View style={dash.eybRow}>
          <Text style={[dash.eyb, { color: themeColors.textMuted }]}>Up next</Text>
          {upNextSession ? (
            <View style={[dash.pill, { backgroundColor: accentGradients[7][0], borderColor: themeColors.cardBorder }]}>
              <Text style={[dash.pillText, { color: lightColors.nbInk }]}>
                {String(upNextSession.date || '') === getLocalDateKey() ? 'Today' : 'Soon'}
              </Text>
            </View>
          ) : null}
        </View>

        {upNextSession ? (
          <HardShadow offset={nb.shadowOffsetCard} radius={10} style={{ marginBottom: nb.blockGap }}>
            <View style={[dash.upNextCard, { backgroundColor: themeColors.cardBg, borderColor: themeColors.cardBorder }]}>
              <View style={[dash.when, { borderRightColor: themeColors.cardBorder }]}>
                <Text style={[dash.whenNum, { color: themeColors.text }]}>{sessionWhenParts(upNextSession).clock}</Text>
                <Text style={[dash.whenSub, { color: themeColors.textMuted }]}>{sessionWhenParts(upNextSession).sub}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
                <View>
                  <Text style={{ fontSize: 17, fontWeight: '900', color: themeColors.text }} numberOfLines={2}>
                    {upNextSession.title || upNextSession.workoutName || (upNextIsInvite ? 'Session invite' : 'Training session')}
                  </Text>
                  <Text style={{ fontSize: 13, color: themeColors.textMuted, marginTop: 2 }} numberOfLines={2}>
                    {upNextSession.notes || `With ${trainerName}`}
                  </Text>
                </View>
                {upNextIsInvite ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={[dash.btnGhost, { flex: 1, borderColor: themeColors.cardBorder, backgroundColor: themeColors.cardBg }]}
                      onPress={() => respondToDashboardSession?.({ sessionId: upNextSession.id, status: 'declined' })}
                    >
                      <Text style={[dash.btnGhostText, { color: themeColors.text }]}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[dash.btnFill, { flex: 1, borderColor: themeColors.cardBorder, backgroundColor: themeColors.fill }]}
                      onPress={() => respondToDashboardSession?.({ sessionId: upNextSession.id, status: 'accepted' })}
                    >
                      <Text style={[dash.btnFillText, { color: themeColors.onFill }]}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={[dash.btnGhost, { flex: 1, borderColor: themeColors.cardBorder, backgroundColor: themeColors.cardBg }]}
                      onPress={onPressMessage}
                    >
                      <Text style={[dash.btnGhostText, { color: themeColors.text }]}>Message</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[dash.btnFill, { flex: 1, borderColor: themeColors.cardBorder, backgroundColor: themeColors.fill }]}
                      onPress={handleViewProfile}
                    >
                      <Text style={[dash.btnFillText, { color: themeColors.onFill }]}>Reschedule</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </HardShadow>
        ) : (
          <NbCard style={{ marginBottom: nb.blockGap }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: themeColors.text }}>Nothing scheduled</Text>
            <Text style={{ fontSize: 13, color: themeColors.textMuted, marginTop: 4 }}>
              When your coach books a session, it shows up here.
            </Text>
          </NbCard>
        )}

        {/* Extra invites beyond the first stay as list cards */}
        {dashboardPendingSessions.slice(1).map((s) => (
          <UpcomingSessionCard
            key={s.id}
            mode="invite"
            isDark={isDark}
            coachName={trainerName}
            session={s}
            onRespond={respondToDashboardSession}
          />
        ))}

        {/* Trainer — single Design Law row → sheet (no Profile/Pay/Remove pills) */}
        {trainer ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setTrainerSheetOpen(true)}
            style={[dash.trainerRow, { backgroundColor: themeColors.cardBg, borderColor: themeColors.cardBorder, marginBottom: nb.blockGap }]}
          >
            <LinearGradient
              colors={navAccentGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[dash.av, { borderColor: themeColors.cardBorder }]}
            >
              <Text style={[dash.avText, { color: lightColors.nbInk }]}>{trainerInitials}</Text>
            </LinearGradient>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: themeColors.text }} numberOfLines={1}>
                {`Your trainer · ${trainerName}`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={themeColors.text} />
          </TouchableOpacity>
        ) : (
          // PNG 01 marketplace entry — Design Law fill banner (replaces the thin “No trainer yet” row)
          <FindTrainerBanner
            onPress={typeof onPressFindTrainer === 'function' ? onPressFindTrainer : onPressMessage}
            outerStyle={{ marginBottom: nb.blockGap, paddingHorizontal: 0 }}
            hideInvite
          />
        )}

        {/* Your week — ring + M–S strip (Design Law proportions) */}
        <View style={dash.eybRow}>
          <Text style={[dash.eyb, { color: themeColors.textMuted }]}>Your week</Text>
          <Text style={{ fontSize: 13, color: themeColors.textMuted }}>{weekInfo.rangeLabel}</Text>
        </View>
        <HardShadow offset={nb.shadowOffsetCard} radius={10} style={{ marginBottom: nb.blockGap }}>
          <View style={[dash.weekCard, { backgroundColor: themeColors.cardBg, borderColor: themeColors.cardBorder }]}>
            <View style={dash.ringWrap}>
              <NbRing
                progress={weekInfo.pct}
                size={112}
                strokeWidth={16}
                value={`${weekInfo.sessionsDone}`}
                label={`of ${weekInfo.sessionsGoal}`}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 12, paddingVertical: 2 }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: themeColors.text }}>Sessions done</Text>
              <View style={dash.wkd}>
                {WEEKDAY_LABELS.map((label, idx) => {
                  const done = weekInfo.doneDays.has(idx);
                  const isToday = ((localClock instanceof Date ? localClock : new Date()).getDay() + 6) % 7 === idx;
                  return (
                    <View
                      key={`${label}-${idx}`}
                      style={[
                        dash.wkdCell,
                        {
                          borderColor: themeColors.cardBorder,
                          backgroundColor: done ? themeColors.fill : themeColors.pillBg,
                          borderStyle: isToday && !done ? 'dashed' : 'solid',
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '900', color: done ? themeColors.onFill : themeColors.text }}>{label}</Text>
                    </View>
                  );
                })}
              </View>
              <View style={{ gap: 3 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textMuted }}>
                  {typeof sleepHoursValue === 'number'
                    ? `Sleep averaging ${sleepHoursValue} h`
                    : 'Sleep updates from Today\'s numbers'}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textMuted }}>
                  {`Water ${Math.round((waterOz || 0) / 8)} of 8 cups today`}
                </Text>
              </View>
            </View>
          </View>
        </HardShadow>

        {/* Today's numbers — Design Law tiles → log sheet */}
        <View style={dash.eybRow}>
          <Text style={[dash.eyb, { color: themeColors.textMuted }]}>Today&apos;s numbers</Text>
          <Text style={{ fontSize: 13, color: themeColors.textMuted }}>Tap to log</Text>
        </View>
        <DesignLawNumberTiles
          themeColors={themeColors}
          sleepHours={
            typeof sleepHoursValue === 'number'
              ? sleepHoursValue
              : sleepState.savedValue
                ? parseFloat(sleepState.savedValue)
                : null
          }
          waterOz={waterOz || (waterState.savedValue ? parseFloat(waterState.savedValue) : 0)}
          weightLb={weightState.savedValue ? parseFloat(weightState.savedValue) : null}
          steps={stepsState.savedValue ? parseInt(stepsState.savedValue, 10) : null}
          onOpenLog={(key) => setLogMetricKey(key)}
        />

        {/* Nutrition today — ring + macro bars */}
        <View style={dash.eybRow}>
          <Text style={[dash.eyb, { color: themeColors.textMuted }]}>Nutrition today</Text>
          <TouchableOpacity onPress={typeof onPressCalories === 'function' ? onPressCalories : undefined}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: themeColors.text, textDecorationLine: 'underline' }}>Log a meal</Text>
          </TouchableOpacity>
        </View>
        <DesignLawNutritionCard
          themeColors={themeColors}
          todayCalories={todayCalories}
          calorieGoal={calorieGoal || DEFAULT_CALORIE_GOAL}
          proteinG={proteinG}
          carbsG={carbsG}
          fatsG={fatsG}
          proteinGoal={proteinGoal || 154}
          carbsGoal={carbsGoal || 205}
          fatsGoal={fatsGoal || 68}
          onOpenNutrition={typeof onPressCalories === 'function' ? onPressCalories : undefined}
        />

        {/* Workouts today — set chips */}
        <View style={dash.eybRow}>
          <Text style={[dash.eyb, { color: themeColors.textMuted }]}>Workouts today</Text>
        </View>
        <DesignLawWorkoutCard themeColors={themeColors} state={workoutLogState} />

        {/* Daily check-in — sliders + mood chips (not 1–8 boxes) */}
        <View style={[dash.eybRow, { marginTop: 8 }]}>
          <Text style={[dash.eyb, { color: themeColors.textMuted }]}>Daily check-in</Text>
        </View>
        <DesignLawCheckInCard
          themeColors={themeColors}
          trainerFirstName={String(trainerName || '').split(' ')[0] || ''}
          values={{
            soreness: sorenessState.savedValue,
            energy: energyState.savedValue,
            stress: stressState.savedValue,
            mood: moodState.savedValue,
            workout: workoutRatingState.savedValue,
          }}
          onSave={saveCheckInField}
          noteValue={noteDraft}
          onNoteChange={setNoteDraft}
          onNoteBlur={() => {
            if (String(noteDraft) !== String(notesState.savedValue || '')) {
              notesState.save(String(noteDraft || ''));
            }
          }}
        />

        {/* Go to — 2×2 tiles + notes/files row */}
        <View style={[dash.eybRow, { marginTop: 8 }]}>
          <Text style={[dash.eyb, { color: themeColors.textMuted }]}>Go to</Text>
        </View>
        <DesignLawGoToGrid
          themeColors={themeColors}
          items={[
            {
              label: 'Workouts',
              sub: cappedBadgeLabel(aiWorkoutsBadgeCount, 'new', 'Plans'),
              icon: HANDOFF_WORKOUT,
              onPress: () => onOpenAIWorkouts?.({ id: trainerClientId, name: trainerClientName }),
            },
            {
              label: 'Progress',
              sub: cappedBadgeLabel(photoGalleryBadgeCount, 'new', 'Photos'),
              icon: HANDOFF_PROGRESS,
              onPress: () => onOpenPhotoGallery?.({ id: trainerClientId, name: trainerClientName }),
            },
            {
              label: 'History',
              sub: weeklyReportCard?.weekRangeLabel || 'Week in review',
              icon: HANDOFF_SCHEDULE,
              onPress: typeof onOpenWeeklyReport === 'function' ? () => onOpenWeeklyReport() : undefined,
            },
            {
              label: 'Analytics',
              sub: 'Open report',
              icon: HANDOFF_PROGRESS,
              onPress: typeof onOpenWeeklyReport === 'function' ? () => onOpenWeeklyReport() : undefined,
            },
          ]}
          notesFilesItem={
            typeof onOpenNotesFiles === 'function'
              ? {
                  label: 'Your notes and files',
                  sub:
                    notesFilesNewCount > 0
                      ? cappedBadgeLabel(notesFilesNewCount, 'new', `${notesFilesCount || 0} files`)
                      : `${notesFilesCount || 0} files`,
                  onPress: () => onOpenNotesFiles(),
                }
              : null
          }
        />
      </ScrollView>

      <DesignLawLogSheet
        visible={!!logMetricKey}
        metricKey={logMetricKey}
        themeColors={themeColors}
        waterOz={waterOz || (waterState.savedValue ? parseFloat(waterState.savedValue) : 0)}
        sleepHours={
          typeof sleepHoursValue === 'number'
            ? sleepHoursValue
            : sleepState.savedValue
              ? parseFloat(sleepState.savedValue)
              : null
        }
        weightLb={weightState.savedValue ? parseFloat(weightState.savedValue) : null}
        steps={stepsState.savedValue ? parseInt(stepsState.savedValue, 10) : null}
        onClose={() => setLogMetricKey(null)}
        onSaveWaterOz={(oz) => waterState.save(String(oz))}
        onSaveSleep={(hrs) => sleepState.save(String(hrs))}
        onSaveWeight={(lb) => weightState.save(String(lb))}
        onSaveSteps={(n) => stepsState.save(String(n))}
      />

      <DesignLawTrainerSheet
        visible={trainerSheetOpen}
        onClose={() => setTrainerSheetOpen(false)}
        trainerName={trainerName}
        trainerInitials={trainerInitials}
        themeColors={themeColors}
        showPayment={!!showCoachingPaymentOnCard}
        onMessage={onPressMessage}
        onProfile={handleViewProfile}
        onNotesFiles={typeof onOpenNotesFiles === 'function' ? () => onOpenNotesFiles() : undefined}
        onPayment={handleOpenPayment}
        onReview={() => setReviewSheetOpen(true)}
      />

      <DesignLawReviewSheet
        visible={reviewSheetOpen}
        onClose={() => setReviewSheetOpen(false)}
        themeColors={themeColors}
        trainerName={trainerName}
        onSubmit={() => {
          // Design Law sheet for look; Firestore write uses the existing review popup
          setReviewSheetOpen(false);
          setLegacyReviewOpen(true);
        }}
      />

      {legacyReviewOpen && trainer ? (
        <WriteTrainerReviewPopup
          visible={legacyReviewOpen}
          onClose={() => setLegacyReviewOpen(false)}
          trainerName={trainerName}
          trainerId={trainer?.id || trainer?.uid || trainer?.userId}
          clientId={currentUser?.uid}
          clientFirstName={firstName}
          existingReview={null}
        />
      ) : null}
    </View>
  );
}

// ===== MAIN FUNCTION =====

// Client dashboard. Loads sessions and today's metrics, then paints TrainingHomeScreenLayout.
export const TrainingHomeScreen = ({
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
  /** Opens Notes & Files overlay from Home Go-to row. */
  onOpenNotesFiles,
  notesFilesCount = 0,
  notesFilesNewCount = 0,
  trainerClientId,
  trainerClientName,
  photoGalleryBadgeCount = 0,
  aiWorkoutsBadgeCount = 0,
  unreadMessageCount = 0,
  todayCalories = 0,
  calorieGoal = DEFAULT_CALORIE_GOAL,
  proteinG,
  carbsG,
  fatsG,
  proteinGoal,
  carbsGoal,
  fatsGoal,
  waterOz = 0,
  sleepHoursValue = null,
}) => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  // Floating shell BottomMenuBar overlays this screen — always reserve it.
  const shellBottomPad = useShellBottomNavInset(embedInLayout ? SHELL_NAV_PAD_EMBEDDED : SHELL_NAV_PAD_STANDALONE);
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
    const id = setInterval(() => setUntilResetMs(msUntilLocalMidnight()), MS_PER_SECOND);
    return () => clearInterval(id);
  }, []);

  /** Live local clock for the dashboard time card (updates every second). */
  useEffect(() => {
    const id = setInterval(() => setLocalClock(new Date()), MS_PER_SECOND);
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
          console.warn('[TrainingHomeScreen] weeklySummaries load failed', e?.message || e);
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
    const id = setInterval(() => setSessionFilterTick((tick) => tick + 1), SESSION_LIST_REFRESH_MS);
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
    const sessionsQuery = query(sessionsRef, where('clientId', '==', currentUser.uid), limit(25));
    const unsub = onSnapshot(
      sessionsQuery,
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
    const isStillRelevant = (session) => {
      const dateStr = String(session.date || '');
      if (dateStr > todayKey) return true;
      if (dateStr < todayKey) return false;
      const timeStr = String(session.time || '');
      const [hourText, minuteText] = timeStr.split(':');
      const hour = parseInt(hourText, 10);
      const minute = parseInt(minuteText || '0', 10);
      if (Number.isNaN(hour)) return true;
      const sessionStart = new Date();
      sessionStart.setHours(hour, Number.isNaN(minute) ? 0 : minute, 0, 0);
      return now < sessionStart.getTime() + SESSION_STILL_RELEVANT_MS;
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
    const workoutsQuery = query(workoutsRef, where('userId', '==', uid));
    const unsub = onSnapshot(
      workoutsQuery,
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
    const id = setInterval(tick, DAY_ROLLOVER_TICK_MS);
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

  const workoutLogState = workoutDiary(handleWorkoutAfterSave);

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
          const clientName = await clientDisplayName(clientUid);
          const verb = sessionResponseVerb(status);
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
    const pricing = trainer?.pricing;
    if (!pricing) return null;
    const parts = [];
    if (pricing.perSession != null && pricing.perSession !== '') parts.push(`$${pricing.perSession}/session`);
    if (pricing.perMonth != null && pricing.perMonth !== '') parts.push(`$${pricing.perMonth}/month`);
    return parts.length ? parts.join(' · ') : null;
  })();

  const coachingRateLabel = useMemo(() => {
    if (coachingMonthlyRate != null && coachingMonthlyRate !== '') {
      const monthlyRate = Number(coachingMonthlyRate);
      if (Number.isFinite(monthlyRate) && monthlyRate > 0) {
        const dollars = monthlyRate >= 100 ? monthlyRate / 100 : monthlyRate;
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

  const showCoachingPaymentOnCard = !!trainer;

  const coachingPaymentButtonLabel = coachingPaymentButtonLabelFor(coachingPaymentStatus);
  const coachingPaymentShortLabel = coachingPaymentShortLabelFor(coachingPaymentStatus);
  const coachingPaymentStatusLabel = coachingPaymentStatusLabelFor(coachingPaymentStatus);
  const coachingPaymentStatusTone = coachingPaymentStatusToneFor(coachingPaymentStatus);

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

  const screenLayout = {
    scrollRef,
    embedInLayout,
    shellBottomPad,
    isDark,
    displayBanner,
    pendingReset,
    currentUser,
    onOpenWeeklyReport,
    weeklyReportCard,
    weeklyReportCardLoading,
    untilResetMs,
    dashboardPendingSessions,
    dashboardReminderSessions,
    trainerName,
    respondToDashboardSession,
    trainer,
    trainerTitle,
    trainerSpecialties,
    trainerLocation,
    onPressMessage,
    handleViewProfile,
    onOpenRemoveTrainer,
    showCoachingPaymentOnCard,
    handleOpenPayment,
    coachingPaymentButtonLabel,
    coachingPaymentShortLabel,
    coachingRateLabel,
    trainerPricingLine,
    coachingPaymentStatusLabel,
    coachingPaymentStatusTone,
    onPressFindTrainer,
    unreadMessageCount,
    onOpenPhotoGallery,
    trainerClientId,
    trainerClientName,
    photoGalleryBadgeCount,
    onOpenAIWorkouts,
    aiWorkoutsBadgeCount,
    onMetricsChange,
    handleWorkoutAfterSave,
    workoutLogState,
    todayCalories,
    calorieGoal,
    proteinG,
    carbsG,
    fatsG,
    proteinGoal,
    carbsGoal,
    fatsGoal,
    waterOz,
    sleepHoursValue,
    onPressCalories,
    onOpenNotesFiles,
    notesFilesCount,
    notesFilesNewCount,
    recentWorkouts,
    localClock,
  };
  return <TrainingHomeScreenLayout {...screenLayout} />;
};

const screen = StyleSheet.create({
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  backLabel: { fontSize: 16, fontWeight: '600' },
  scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 44 },
});

// Mockup layout primitives for the dashboard (.hi / .welcome / .eyb / .vt / .wkd).
const dash = StyleSheet.create({
  hi: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, marginBottom: 12 },
  av: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avText: { fontSize: 15, fontWeight: '900' },
  sq: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcome: {
    borderWidth: nb.borderWidth,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 26,
    borderBottomRightRadius: 6,
    borderBottomLeftRadius: 6,
    padding: nb.cardPadding,
    minHeight: 150,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  eybOnFill: { fontSize: 12, fontWeight: '900', letterSpacing: 1.3, textTransform: 'uppercase', opacity: 0.72 },
  welcomeQuote: { fontSize: 30, fontWeight: '900', letterSpacing: -1, marginTop: 8, marginBottom: 4, lineHeight: 34 },
  welcomeAuthor: { fontSize: 11, fontWeight: '700', opacity: 0.55, marginBottom: 10 },
  welcomeSub: { fontSize: 13, fontWeight: '600', opacity: 0.75, lineHeight: 18 },
  eybRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  eyb: { fontSize: 12, fontWeight: '900', letterSpacing: 1.3, textTransform: 'uppercase' },
  pill: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: nb.borderWidthPill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { fontSize: 12, fontWeight: '900' },
  upNextCard: {
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  when: {
    minWidth: 92,
    paddingRight: 12,
    borderRightWidth: nb.borderWidth,
    justifyContent: 'center',
  },
  whenNum: { fontSize: 30, fontWeight: '900', letterSpacing: -1, lineHeight: 32 },
  whenSub: { fontSize: 13, marginTop: 4, fontWeight: '600' },
  btnGhost: {
    minHeight: 44,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  btnGhostText: { fontSize: 13, fontWeight: '900' },
  btnFill: {
    minHeight: 44,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  btnFillText: { fontSize: 13, fontWeight: '900' },
  trainerRow: {
    minHeight: 60,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  miniChip: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekCard: {
    borderWidth: nb.borderWidth,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 26,
    borderBottomLeftRadius: 10,
    paddingVertical: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    minHeight: 148,
  },
  ringWrap: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center' },
  ringTrack: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringNum: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  wkd: { flexDirection: 'row', gap: 6 },
  wkdCell: {
    flex: 1,
    height: 36,
    borderWidth: nb.borderWidth,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barTrack: {
    height: 16,
    borderWidth: nb.borderWidth,
    borderRadius: 8,
    overflow: 'hidden',
  },
});

const heroStyles = StyleSheet.create({
  hero: {
    marginHorizontal: 0,
    marginTop: 10,
    marginBottom: 10,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(226,85,136,0.25)',
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
    backgroundColor: darkColors.nbSurfaceChip,
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
    backgroundColor: 'rgba(226,85,136,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(226,85,136,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontSize: 18, fontWeight: '800', color: lightColors.nbInk },
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
    borderColor: darkColors.nbBorder,
    backgroundColor: darkColors.nbSurfaceChip,
  },
  removeBtnText: { fontSize: 11, fontWeight: '700' },
});

const trainerSectionStyles = StyleSheet.create({
  section: {
    marginTop: 12,
    marginBottom: 20,
  },
  inner: {
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  headerTitle: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  cardSlot: {
    marginTop: 2,
    marginBottom: 4,
  },
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
    shadowColor: lightColors.primaryDark,
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
    color: lightColors.white,
    letterSpacing: 0.3,
  },
});

export default TrainingHomeScreen;

// ─────────────────────────────────────────────────────────────
// FULL FILE END
// ─────────────────────────────────────────────────────────────
