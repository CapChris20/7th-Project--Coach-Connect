/**
 * Workout Plan Generator Screen
 * Review onboarding data, allow edits, and generate personalized workout plan using DeepSeek API
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useTheme } from '../../shared/ui/ThemeContext';
import { auth, db } from '../../app/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Liquid } from '../../shared/ui/liquid/liquidTokens';
import BottomNavBar from '../../navigation/BottomNavBar';
import { BOTTOM_NAV_BAR_HEIGHT } from '../../navigation/bottomNavMetrics';
import CoachConnectHeader from '../../shared/components/CoachConnectHeader';
import WorkoutPlanBuilderFieldEditBody from './workoutPlanBuilderFieldEditBody';
import ProfileCardIcon from '../../shared/components/ProfileCardIcon';
import {
  PROFILE_CARD_ICON_SIZE,
  PROFILE_FIELD_ICON_ID,
  profileCardIconWrapStyle,
} from '../../shared/workout/profileCardIcons';
import {
  filterProfileCardSections,
  getProfileCardSectionLabels,
} from '../../shared/workout/profileCardVisibility';
import { saveGeneratedPlanToCollection, getCurrentWorkoutPlan, setCurrentWorkoutPlan } from '../services/workoutService';
import Markdown from 'react-native-markdown-display';
import { useAI } from '../../contexts/AIContext';
import { getOrCreateConversation, sendClientRequest, getUserData, CLIENT_REQUEST_TYPES } from '../../ai/services/trainerMessaging';
import { getApiAuthHeaders } from '../../shared/services/apiAuthHeaders';
import { getWorkoutGenerationApiBases, PRODUCTION_API_BASE_URL } from '../../shared/services/baseUrl';
import { postJsonWithTimeout, logApiAttempt } from '../../shared/services/apiFetch';
import {
  stripMarkdown,
  stripEmojis,
} from '../services/workoutPlanPdfService';
import WorkoutPlanPdfViewerModal from '../components/WorkoutPlanPdfViewerModal';
import PlanViewerScreen from '../../screens/PlanViewerScreen';
import WorkoutExerciseLibraryTab from '../components/WorkoutExerciseLibraryTab';
import { EditModalForm } from '../components/EditModalForm_RN';

/** Survives screen unmount so ClientApp / logs can tell a request is still running */
let workoutPlanGenerationInFlight = false;

const PLAN_LIMIT_TOTAL = 3;
const planLimitMonthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const nextMonthResetDate = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
};
const nextMonthResetsAtIso = (d = new Date()) => {
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
};

function formatWorkoutLimitResetLabel(resetsAt) {
  const raw = String(resetsAt || nextMonthResetsAtIso()).trim();
  const d = new Date(`${raw.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function buildDefaultWorkoutUsage(used = 0) {
  return {
    generations_used: used,
    generations_limit: PLAN_LIMIT_TOTAL,
    resets_at: nextMonthResetsAtIso(),
  };
}

function planGeneratedThisMonth(generatedAt) {
  if (generatedAt == null) return false;
  const ts = Number(generatedAt);
  if (!Number.isFinite(ts) || ts <= 0) return false;
  return planLimitMonthKey(new Date(ts)) === planLimitMonthKey();
}

/** Prefer server/Firestore counts; infer 1 when a plan exists this month but usage was never recorded. */
function mergeWorkoutGenerationUsage({
  apiUsage = null,
  firestoreUsage = null,
  justGenerated = false,
  generatedPlan = null,
} = {}) {
  const base = firestoreUsage || buildDefaultWorkoutUsage(0);
  const limit = Number(apiUsage?.generations_limit) || Number(base.generations_limit) || PLAN_LIMIT_TOTAL;
  const resets_at = apiUsage?.resets_at || base.resets_at || nextMonthResetsAtIso();
  let used = Math.max(Number(apiUsage?.generations_used) || 0, Number(base.generations_used) || 0);
  if (used <= 0 && (justGenerated || planGeneratedThisMonth(generatedPlan?.generatedAt))) {
    used = 1;
  }
  return {
    generations_used: Math.min(Math.max(used, 0), limit),
    generations_limit: limit,
    resets_at,
  };
}

export async function resolveWorkoutGenerationUsage(uid, opts = {}) {
  const firestoreUsage = uid ? await loadWorkoutGenerationUsage(uid) : buildDefaultWorkoutUsage(0);
  return mergeWorkoutGenerationUsage({ firestoreUsage, ...opts });
}

export async function loadWorkoutGenerationUsage(uid) {
  if (!uid || !db) return buildDefaultWorkoutUsage(0);
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'usage', 'workout_generations'));
    const month = planLimitMonthKey();
    if (!snap.exists()) return buildDefaultWorkoutUsage(0);
    const data = snap.data() || {};
    const used = data.month === month ? Number(data.count) || 0 : 0;
    return buildDefaultWorkoutUsage(used);
  } catch (_) {
    return buildDefaultWorkoutUsage(0);
  }
}

const WORKOUT_PLAN_FETCH_TIMEOUT_MS = 180000;

export async function requestWorkoutPlanFromApi(onboardingData, subjectUserId) {
  const headers = await getApiAuthHeaders({ 'Content-Type': 'application/json' });
  if (!headers.Authorization) {
    throw new Error('Sign in to generate a workout plan.');
  }

  const bases = getWorkoutGenerationApiBases();
  const body = {
    onboardingData,
    subjectUserId: subjectUserId || auth.currentUser?.uid,
  };

  if (__DEV__) {
    console.log('[workout] generate plan — trying API bases:', bases.slice(0, 6).join(' → '));
  }

  let lastErr = null;
  for (const base of bases) {
    const url = `${String(base).replace(/\/$/, '')}/api/workout/generate`;
    try {
      const res = await postJsonWithTimeout(url, body, headers, WORKOUT_PLAN_FETCH_TIMEOUT_MS);
      const payload = await res.json().catch(() => ({}));
      if (res.status === 429 && payload?.error === 'monthly_limit_reached') {
        const err = new Error(
          payload.message ||
            `You've used all your workout generations for this month. Resets ${formatWorkoutLimitResetLabel(payload.resets_at)}.`,
        );
        err.code = 'monthly_limit_reached';
        err.limitPayload = payload;
        throw err;
      }
      if (!res.ok) {
        const err = new Error(payload?.message || payload?.error || `Request failed (${res.status})`);
        err.httpStatus = res.status;
        err.fromHttpResponse = true;
        throw err;
      }
      if (!payload?.text) {
        throw new Error('Empty response from workout generator');
      }
      if (__DEV__) {
        console.log('[workout] generate plan OK via', base);
      }
      return {
        text: String(payload.text),
        usage: payload.usage ?? null,
      };
    } catch (e) {
      logApiAttempt('workout/generate', url, e);
      if (e?.code === 'monthly_limit_reached') throw e;
      if (e?.code === 'timeout') throw e;
      // Server answered (e.g. missing API key) — don't mask with localhost "Network request failed"
      if (e?.fromHttpResponse) throw e;
      lastErr = e;
    }
  }

  const tried = bases.slice(0, 6).join(', ');
  const msg = String(lastErr?.message || '');
  const hint = msg.includes('timed out')
    ? 'The server took too long. Try again on Wi‑Fi.'
    : msg.includes('AI provider unavailable')
      ? 'Workout generation needs ANTHROPIC_API_KEY on Cloud Run. Add it to .env, then run: ./scripts/syncCloudRunEnv.sh'
      : `Could not reach the workout API. Check internet, then reload with: npm start (dev build).`;
  throw lastErr || new Error(`${hint}${tried ? ` Tried: ${tried}` : ''}`);
}

export async function loadOnboardingAndPlanArtifacts({ userId, propPlan } = {}) {
  const subjectUid = (userId && String(userId).trim()) || auth.currentUser?.uid;
  if (!subjectUid) {
    throw new Error('User not found');
  }
  let onboardingData = null;
  if (db) {
    const userSnap = await getDoc(doc(db, 'users', subjectUid));
    if (userSnap.exists()) onboardingData = userSnap.data();
  }
  if (!onboardingData) {
    const cached = await AsyncStorage.getItem(`onboarding_data_${subjectUid}`);
    if (cached) onboardingData = JSON.parse(cached);
  }
  let plan = propPlan || null;
  if (!plan) {
    plan = await getCurrentWorkoutPlan(subjectUid);
  }
  return { onboardingData, plan };
}

export async function generateWorkoutPlanWithClaude({ onboardingData, userId }) {
  const subjectUid = (userId && String(userId).trim()) || auth.currentUser?.uid;
  const { text, usage } = await requestWorkoutPlanFromApi(onboardingData, subjectUid);
  return {
    planText: text,
    generatedAt: Date.now(),
    userData: onboardingData,
    usage,
  };
}

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

/** Profile height: `{ feet, inches }` or legacy total inches (number). */
function formatProfileHeightDisplay(h) {
  if (h == null) return '—';
  if (typeof h === 'object') {
    const ftRaw = h.feet;
    const inRaw = h.inches;
    const hasFt = ftRaw != null && ftRaw !== '';
    const hasIn = inRaw != null && inRaw !== '';
    if (hasFt || hasIn) {
      const ft = hasFt ? Number(ftRaw) : 0;
      const inch = hasIn ? Number(inRaw) : 0;
      if (Number.isFinite(ft) && Number.isFinite(inch)) return `${ft}'${inch}"`;
    }
    return '—';
  }
  const n = typeof h === 'number' ? h : Number(String(h).replace(/[^0-9.]/g, ''));
  if (Number.isFinite(n) && n >= 36 && n <= 96) {
    const t = Math.round(n);
    return `${Math.floor(t / 12)}'${t % 12}"`;
  }
  return '—';
}

const MARKDOWN_STYLES = {
  body: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 22 },
  heading1: { color: '#ffffff', fontSize: 20, fontWeight: '800', marginBottom: 12, marginTop: 8 },
  heading2: { color: '#ffffff', fontSize: 16, fontWeight: '700', marginBottom: 8, marginTop: 16 },
  strong: { color: '#ffffff', fontWeight: '700' },
  hr: { backgroundColor: 'rgba(255,255,255,0.1)', height: 1, marginVertical: 16 },
  paragraph: { color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 22, marginBottom: 8 },
  bullet_list: { marginBottom: 8 },
  list_item: { color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 22 },
};

const MARKDOWN_STYLES_LIGHT = {
  body: { color: 'rgba(30,16,64,0.9)', fontSize: 14, lineHeight: 22 },
  heading1: { color: '#1a1040', fontSize: 20, fontWeight: '800', marginBottom: 12, marginTop: 8 },
  heading2: { color: '#1a1040', fontSize: 16, fontWeight: '700', marginBottom: 8, marginTop: 16 },
  strong: { color: '#1a1040', fontWeight: '700' },
  hr: { backgroundColor: 'rgba(0,0,0,0.12)', height: 1, marginVertical: 16 },
  paragraph: { color: 'rgba(30,16,64,0.85)', fontSize: 14, lineHeight: 22, marginBottom: 8 },
  bullet_list: { marginBottom: 8 },
  list_item: { color: 'rgba(30,16,64,0.85)', fontSize: 14, lineHeight: 22 },
};

/** Strip ALL markdown symbols before rendering. No raw markdown ever visible. */
function cleanText(str) {
  if (str == null || typeof str !== 'string') return '';
  return String(str)
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*]*)\*/g, '$1')
    .replace(/__([^_]*)__/g, '$1')
    .replace(/_([^_]*)_/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^[-*•]\s*/gm, '')
    .replace(/^\d+\.\s*/gm, '')
    .replace(/^---+\s*$/gm, '')
    .replace(/\|[-:\s|]+\|/g, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Robustly extract a JSON object from an API response that may contain
 * prose, markdown fences, or other noise around the JSON.
 */
function extractJSON(str) {
  if (!str || typeof str !== 'string') return '';
  let s = str.trim();

  // Claude often returns ```json ... ``` even when asked for raw JSON; strip any fenced block.
  const fenceRe = /```(?:json)?\s*\n?/i;
  const fenceHit = s.match(fenceRe);
  if (fenceHit && fenceHit.index != null) {
    s = s.slice(fenceHit.index + fenceHit[0].length);
    const close = s.indexOf('```');
    if (close !== -1) {
      s = s.slice(0, close).trim();
    }
  } else {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  }

  // Outermost { ... } (handles trailing prose after valid JSON)
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    s = s.slice(first, last + 1);
  }
  return s.trim();
}

function tryParseJsonObject(str) {
  try {
    const raw = extractJSON(String(str || ''));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const PLAN_BUILDER_COLORS = {
  bgDark: '#0A0A0F',
  bgLight: '#F5F5F5',
  cardDark: '#12131A',
  cardLight: '#FFFFFF',
  pink: '#FF6B9D',
  /** Secondary accent for row icons (replaces old purple). */
  purple: '#64D2FF',
  cyan: '#06B6D4',
  orange: '#F97316',
  green: '#10B981',
};

const WORKOUT_PLAN_BUILDER_SECTIONS = [
  { sectionLabel: 'Profile', keys: ['personalInfo', 'fitnessLevel', 'goal'] },
  {
    sectionLabel: 'Training Setup',
    keys: ['equipment', 'frequency', 'trainingEnvironment', 'preferredWorkoutTime', 'exercisesDislike'],
  },
  {
    sectionLabel: 'Recovery & Extras',
    keys: [
      'injuries',
      'supplementsCurrentlyTaking',
      'currentStressLevel',
      'sleepQuality',
      'energyLevels',
      'hydrationHabits',
      'situationDescription',
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// NEW UI (Lovable hero + pills) — UI ONLY, same editing/generation logic
// Uses the existing builder field keys so functionality stays identical.
// ─────────────────────────────────────────────────────────────────────────────

/** Profile pill card rims — dark pink → dark orange (design-system warm CTA) */
const LOVABLE_ACCENTS = [
  { key: 'warm-a', gradient: ['#BE185D', '#C2410C'], text: '#BE185D' },
  { key: 'warm-b', gradient: ['#C2410C', '#BE185D'], text: '#C2410C' },
  { key: 'warm-c', gradient: ['#BE185D', '#9A3412'], text: '#BE185D' },
  { key: 'warm-d', gradient: ['#9A3412', '#C2410C'], text: '#C2410C' },
];

const LOVABLE_PILLS = [
  { key: 'personalInfo', label: 'Personal', helper: 'age/height/weight', icon: 'person-outline' },
  { key: 'fitnessLevel', label: 'Level', helper: 'training status', icon: 'flame-outline' },
  { key: 'goal', label: 'Goal', helper: 'primary goal', icon: 'trophy-outline' },
  { key: 'equipment', label: 'Equipment', helper: 'available tools', icon: 'barbell-outline' },
  { key: 'frequency', label: 'Frequency', helper: 'weekly sessions', icon: 'calendar-outline' },
  { key: 'trainingEnvironment', label: 'Environment', helper: 'training place', icon: 'navigate-outline' },
  { key: 'preferredWorkoutTime', label: 'Workout time', helper: 'preferred time', icon: 'time-outline' },
  { key: 'exercisesDislike', label: 'Avoid', helper: 'exercise dislikes', icon: 'close-circle-outline' },
  { key: 'injuries', label: 'Injuries', helper: 'limitations', icon: 'heart-outline' },
  { key: 'supplementsCurrentlyTaking', label: 'Supplements', helper: 'currently taking', icon: 'star-outline' },
  { key: 'currentStressLevel', label: 'Stress', helper: 'current level', icon: 'water-outline' },
  { key: 'sleepQuality', label: 'Sleep', helper: 'sleep quality', icon: 'moon-outline' },
  { key: 'energyLevels', label: 'Energy', helper: 'daily energy', icon: 'battery-charging-outline' },
  { key: 'hydrationHabits', label: 'Hydration', helper: 'water habits', icon: 'water-outline' },
  { key: 'situationDescription', label: 'My journey', helper: 'tap to expand', icon: 'document-text-outline', wide: true },
];

const WORKOUT_BUILDER_ROW_META = {
  personalInfo: {
    label: 'Personal Info',
    placeholder: 'Add your name, age, height, weight',
    multiline: false,
    icon: 'person-outline',
    iconLib: 'ion',
    color: PLAN_BUILDER_COLORS.pink,
  },
  fitnessLevel: {
    label: 'Fitness Level',
    placeholder: 'Select your fitness level',
    multiline: false,
    icon: 'dumbbell',
    iconLib: 'mci',
    color: PLAN_BUILDER_COLORS.purple,
  },
  goal: {
    label: 'Goal',
    placeholder: 'Set your primary goal',
    multiline: false,
    icon: 'trophy-outline',
    iconLib: 'ion',
    color: PLAN_BUILDER_COLORS.orange,
  },
  equipment: {
    label: 'Available Equipment',
    placeholder: 'List your equipment',
    multiline: false,
    icon: 'cube-outline',
    iconLib: 'ion',
    color: PLAN_BUILDER_COLORS.cyan,
  },
  frequency: {
    label: 'Frequency',
    placeholder: 'How many days per week',
    multiline: false,
    icon: 'calendar-outline',
    iconLib: 'ion',
    color: PLAN_BUILDER_COLORS.purple,
  },
  trainingEnvironment: {
    label: 'Environment',
    placeholder: 'Where do you train',
    multiline: false,
    icon: 'leaf-outline',
    iconLib: 'ion',
    color: PLAN_BUILDER_COLORS.green,
  },
  preferredWorkoutTime: {
    label: 'Workout Time',
    placeholder: 'Preferred session length',
    multiline: false,
    icon: 'time-outline',
    iconLib: 'ion',
    color: PLAN_BUILDER_COLORS.orange,
  },
  exercisesDislike: {
    label: 'Workouts Disliked',
    placeholder: 'Anything you want to avoid',
    multiline: false,
    icon: 'close-circle-outline',
    iconLib: 'ion',
    color: PLAN_BUILDER_COLORS.pink,
  },
  injuries: {
    label: 'Any Injuries',
    placeholder: 'Note past or current injuries',
    multiline: false,
    icon: 'bandage-outline',
    iconLib: 'ion',
    color: PLAN_BUILDER_COLORS.green,
  },
  supplementsCurrentlyTaking: {
    label: 'Supplements',
    placeholder: 'What you currently take',
    multiline: false,
    icon: 'medical-bag',
    iconLib: 'mci',
    color: PLAN_BUILDER_COLORS.green,
  },
  currentStressLevel: {
    label: 'Stress Level',
    placeholder: 'Rate your typical stress',
    multiline: false,
    icon: 'pulse-outline',
    iconLib: 'ion',
    color: PLAN_BUILDER_COLORS.purple,
  },
  sleepQuality: {
    label: 'Sleep',
    placeholder: 'Average hours per night',
    multiline: false,
    icon: 'moon-outline',
    iconLib: 'ion',
    color: PLAN_BUILDER_COLORS.cyan,
  },
  energyLevels: {
    label: 'Energy',
    placeholder: 'Describe your energy levels',
    multiline: false,
    icon: 'battery-charging',
    iconLib: 'mci',
    color: PLAN_BUILDER_COLORS.orange,
  },
  hydrationHabits: {
    label: 'Hydration',
    placeholder: 'Daily water intake',
    multiline: false,
    icon: 'water-outline',
    iconLib: 'ion',
    color: PLAN_BUILDER_COLORS.cyan,
  },
  situationDescription: {
    label: 'My Journey',
    placeholder: 'Share your story so your coach can tailor your plan',
    multiline: true,
    icon: 'book-outline',
    iconLib: 'ion',
    color: PLAN_BUILDER_COLORS.orange,
  },
};

function getWorkoutBuilderFieldRawDisplay(key, onboardingData) {
  if (!onboardingData) return '';
  switch (key) {
    case 'personalInfo':
      return `${onboardingData.gender || 'N/A'}, ${onboardingData.age || 'N/A'}yrs, ${onboardingData.weight || 'N/A'}lbs, ${onboardingData.height?.feet || 0}'${onboardingData.height?.inches || 0}"`;
    case 'fitnessLevel':
      return onboardingData.fitnessLevel
        ? onboardingData.fitnessLevel.charAt(0).toUpperCase() + onboardingData.fitnessLevel.slice(1)
        : 'Not set';
    case 'goal':
      return onboardingData.primaryGoal
        ? onboardingData.primaryGoal.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
        : 'Not set';
    case 'equipment':
      return onboardingData.equipmentAccess?.join(', ') || 'None selected';
    case 'frequency':
      return `${onboardingData.daysPerWeek || 0} days per week`;
    case 'injuries':
      return onboardingData.injuries || 'None reported';
    case 'trainingEnvironment':
      return onboardingData.trainingEnvironment
        ? onboardingData.trainingEnvironment.charAt(0).toUpperCase() + onboardingData.trainingEnvironment.slice(1)
        : 'Not set';
    case 'preferredWorkoutTime':
      return onboardingData.preferredWorkoutTime
        ? onboardingData.preferredWorkoutTime.charAt(0).toUpperCase() + onboardingData.preferredWorkoutTime.slice(1)
        : 'Not set';
    case 'exercisesDislike':
      return onboardingData.exercisesDislike || 'None';
    case 'supplementsCurrentlyTaking':
      return onboardingData.supplementsCurrentlyTaking || 'None';
    case 'currentStressLevel':
      return onboardingData.currentStressLevel
        ? onboardingData.currentStressLevel.charAt(0).toUpperCase() + onboardingData.currentStressLevel.slice(1)
        : 'Not set';
    case 'sleepQuality':
      return onboardingData.sleepQuality
        ? onboardingData.sleepQuality.charAt(0).toUpperCase() + onboardingData.sleepQuality.slice(1)
        : 'Not set';
    case 'energyLevels':
      return onboardingData.energyLevels
        ? onboardingData.energyLevels.charAt(0).toUpperCase() + onboardingData.energyLevels.slice(1)
        : 'Not set';
    case 'hydrationHabits':
      if (onboardingData.hydrationHabits === 'less_than_4') return 'Less than 4 cups/day';
      if (onboardingData.hydrationHabits === '4_8') return '4–8 cups/day';
      if (onboardingData.hydrationHabits === 'more_than_8') return 'More than 8 cups/day';
      return 'Not set';
    case 'situationDescription':
      return onboardingData.situationDescription || 'Not provided';
    default:
      return '';
  }
}

const planBuilderRefStyles = StyleSheet.create({
  borderCardContainer: {
    overflow: 'hidden',
  },
  borderGradient: {
    justifyContent: 'center',
  },
  cardInner: {
    overflow: 'hidden',
  },
  rowContainer: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  iconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingLeft: 4,
  },
  themeToggleContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    alignItems: 'flex-end',
  },
  themeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  themeToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  heroCardContainer: {
    paddingHorizontal: 16,
    marginBottom: 28,
  },
  heroInner: {
    minHeight: 276,
    height: 276,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    gap: 4,
  },
  herLottie: {
    width: 124,
    height: 124,
  },
  heroText: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  sectionContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  viewPlanContainer: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  viewPlanButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  viewPlanText: {
    fontSize: 13,
    fontWeight: '600',
  },
  /** Pinned over ScrollView bottom (absolute inside flex:1 wrapper). */
  bottomButtonContainer: {
    paddingTop: 12,
    paddingHorizontal: 16,
    flexShrink: 0,
  },
  bottomText: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 8,
  },
  generateButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  generateButtonInner: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

function PlanBuilderAnimatedBorderCard({
  children,
  radius = 18,
  duration = 4,
  cardBg,
  padding = 0,
  borderColors = ['#BE185D', '#C2410C', '#BE185D', '#C2410C', '#BE185D'],
}) {
  const rotateAnim = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: duration * 1000,
        useNativeDriver: false,
      }),
    ).start();
  }, [duration, rotateAnim]);

  return (
    <View style={[planBuilderRefStyles.borderCardContainer, { borderRadius: radius }]}>
      <LinearGradient
        colors={borderColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          planBuilderRefStyles.borderGradient,
          {
            borderRadius: radius,
            padding: 2,
          },
        ]}
      >
        <View
          style={[
            planBuilderRefStyles.cardInner,
            {
              borderRadius: radius - 2,
              backgroundColor: cardBg,
              padding: padding || 0,
            },
          ]}
        >
          {children}
        </View>
      </LinearGradient>
    </View>
  );
}

function PlanBuilderRow({
  icon,
  label,
  value,
  placeholder,
  textColor,
  mutedColor,
  dividerColor,
  isLast = false,
  multiline = false,
}) {
  const isEmpty = !value || String(value).trim() === '';

  return (
    <View
      style={[
        planBuilderRefStyles.rowContainer,
        {
          borderBottomWidth: isLast ? 0 : 1,
          borderBottomColor: dividerColor,
          alignItems: multiline ? 'flex-start' : 'center',
        },
      ]}
    >
      <View style={[planBuilderRefStyles.iconContainer, { opacity: isEmpty ? 0.55 : 1 }]}>{icon}</View>
      <View style={planBuilderRefStyles.rowContent}>
        <Text
          style={[
            planBuilderRefStyles.rowLabel,
            {
              color: mutedColor,
            },
          ]}
        >
          {label}
        </Text>
        <Text
          style={[
            planBuilderRefStyles.rowValue,
            {
              color: isEmpty ? mutedColor : textColor,
              fontStyle: isEmpty ? 'italic' : 'normal',
            },
          ]}
          numberOfLines={multiline ? 0 : 1}
        >
          {isEmpty ? placeholder : value}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={16} color={mutedColor} />
    </View>
  );
}

function PlanBuilderSectionLabel({ children, color }) {
  return (
    <Text
      style={[
        planBuilderRefStyles.sectionLabel,
        {
          color,
        },
      ]}
    >
      {children}
    </Text>
  );
}

/** Ensure markdown headings (## or #) start on a new line so they render as headings, not raw text. */
function normalizePlanMarkdown(text) {
  if (!text || typeof text !== 'string') return '';
  let out = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  out = out.replace(/([^\n])\s*(#{1,6}\s)/g, '$1\n\n$2');
  return out;
}

const WP = {
  sectionLabel: '#FF6B9D',
  exerciseName: '#FFFFFF',
  setsReps: '#64D2FF',
  startWeight: '#F97316',
  formCueLabel: 'rgba(255,255,255,0.4)',
  formCueText: 'rgba(255,255,255,0.75)',
  dayTitle: '#FFFFFF',
  dayMeta: 'rgba(255,255,255,0.5)',
  duration: 'rgba(255,255,255,0.4)',
  restDay: 'rgba(255,255,255,0.35)',
  cardBg: 'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(255,255,255,0.08)',
};

const TYPE_COLORS = { Push: WP.sectionLabel, Pull: '#06B6D4', Legs: WP.startWeight, 'Full Body': '#10B981', Rest: '#555' };

function inferType(label) {
  const lower = (label || '').toLowerCase();
  if (/push/.test(lower)) return 'Push';
  if (/pull/.test(lower)) return 'Pull';
  if (/legs?|lower/.test(lower)) return 'Legs';
  if (/full\s*body|upper\s*lower/.test(lower)) return 'Full Body';
  return 'Full Body';
}

/**
 * Claude often returns alternate keys (planOverview, workouts[], weeklySchedule object).
 * Viewer expects overview string, weeklySchedule: {day,focus}[], days: day cards.
 */
function normalizeStructuredPlanForViewer(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = { ...raw };

  if (!out.overview && out.planOverview != null) {
    const po = out.planOverview;
    if (typeof po === 'string') out.overview = po;
    else if (typeof po === 'object') {
      const parts = [po.title, po.description, po.note].filter((p) => p != null && String(p).trim() !== '');
      out.overview = parts.map((p) => String(p).trim()).join('\n\n');
    }
  }
  if (!out.overview && out.generalNotes) out.overview = String(out.generalNotes);
  if (!out.overview && out.summary) out.overview = String(out.summary);

  if (out.weeklySchedule != null && !Array.isArray(out.weeklySchedule)) {
    const ws = out.weeklySchedule;
    const rows = [];
    const train = ws.trainingDays || ws.training_days || [];
    const rest = ws.restDays || ws.rest_days || [];
    if (Array.isArray(train)) {
      train.forEach((d) => rows.push({ day: String(d).trim(), focus: 'Training' }));
    }
    if (Array.isArray(rest)) {
      rest.forEach((d) => rows.push({ day: String(d).trim(), focus: 'Rest' }));
    }
    if (rows.length) {
      out.weeklySchedule = rows;
    } else if (ws.activeRecovery != null && String(ws.activeRecovery).trim()) {
      out.weeklySchedule = [{ day: 'Recovery', focus: String(ws.activeRecovery).trim() }];
    } else {
      out.weeklySchedule = [];
    }
  }

  // Map Claude workout sessions into viewer "days".
  // Claude sometimes uses `workouts`, sometimes nests under `detailedWorkouts`,
  // and sometimes `detailedWorkouts` is an object map like { day1Monday: {...}, ... }.
  const workoutsArr = (() => {
    if (Array.isArray(out.workouts) && out.workouts.length) return out.workouts;

    if (out.detailedWorkouts) {
      // detailedWorkouts could itself be an array or an object containing workouts arrays
      if (Array.isArray(out.detailedWorkouts) && out.detailedWorkouts.length) return out.detailedWorkouts;

      // detailedWorkouts might be the object map we see in the screenshot.
      // If we can derive days from it, do that directly.
      if (out.days == null && typeof out.detailedWorkouts === 'object' && !Array.isArray(out.detailedWorkouts)) {
        const derivedDays = normalizeClaudeDetailedWorkoutsToDays(out.detailedWorkouts);
        if (derivedDays && derivedDays.length) {
          out.days = derivedDays;
          return null;
        }
      }

      const nested =
        out.detailedWorkouts?.workouts ||
        out.detailedWorkouts?.sessions ||
        out.detailedWorkouts?.days ||
        out.detailedWorkouts?.workoutDays;
      if (Array.isArray(nested) && nested.length) return nested;
    }

    // Last resort: if `workouts` is an object, scan for the first array of items
    if (out.workouts && typeof out.workouts === 'object' && !Array.isArray(out.workouts)) {
      const keys = Object.keys(out.workouts);
      for (const k of keys) {
        const v = out.workouts[k];
        if (Array.isArray(v) && v.length) return v;
      }
    }

    return null;
  })();

  if ((!out.days || !out.days.length) && Array.isArray(workoutsArr) && workoutsArr.length) {
    out.days = workoutsArr.map((w, i) => normalizeAiWorkoutToDay(w, i));
  }

  return out;
}

function normalizeAiWorkoutToDay(w, index) {
  const label = String(w.label || w.day || w.title || `Day ${index + 1}`).trim();
  const focus = String(w.focus || w.sessionFocus || w.session_type || '').trim();
  const hasExercises = Array.isArray(w.exercises) && w.exercises.length > 0;
  const restish = w.isRest === true || (/\brest\b/i.test(focus) && !hasExercises) || /\brest\s*day\b/i.test(label);

  if (restish) {
    return {
      label,
      type: 'Rest',
      isRest: true,
      restGuidance: w.restGuidance || w.notes || w.guidance || focus || '',
    };
  }

  const type = inferType(focus || label);
  const warmUp = normalizeAiWarmUpBlock(w.warmUp || w.warmup || w.warm_up);
  const exercises = normalizeAiExerciseList(w.exercises || w.mainExercises || w.main_exercises || w.movements || []);

  const rawMuscles = w.primaryMuscles || w.muscles || w.muscleGroups;
  let primaryMuscles = [];
  if (Array.isArray(rawMuscles)) primaryMuscles = rawMuscles.map((x) => String(x));
  else if (typeof rawMuscles === 'string') {
    primaryMuscles = rawMuscles.split(/[,·/]/).map((s) => s.trim()).filter(Boolean);
  }

  return {
    label: label || `Session ${index + 1}`,
    type,
    isRest: false,
    primaryMuscles,
    estimatedTime: w.estimatedTime || w.duration || w.sessionTime || w.timeEstimate,
    warmUp,
    exercises,
    coolDown: w.coolDown || w.cooldown,
  };
}

function normalizeAiWarmUpBlock(wu) {
  if (wu == null) return [];
  if (typeof wu === 'string') {
    const t = wu.trim();
    return t ? [{ name: t, duration: '', description: '' }] : [];
  }
  if (!Array.isArray(wu)) return [];
  return wu.map((item) => {
    if (typeof item === 'string') return { name: item, duration: '', description: '' };
    return {
      name: String(item.name || item.exercise || item.label || '').trim(),
      duration: String(item.duration || item.time || '').trim(),
      description: String(item.description || item.notes || '').trim(),
    };
  });
}

function normalizeAiExerciseList(list) {
  if (!Array.isArray(list)) return [];
  return list.map((ex) => {
    if (typeof ex === 'string') {
      return { name: ex.trim(), sets: '', reps: '', rest: '', formCues: [] };
    }
    const sets = ex.sets != null ? String(ex.sets) : ex.setCount != null ? String(ex.setCount) : '';
    const reps = ex.reps != null ? String(ex.reps) : ex.repRange != null ? String(ex.repRange) : '';
    const rest = ex.rest != null ? String(ex.rest) : ex.restPeriod != null ? String(ex.restPeriod) : '';
    let formCues = ex.formCues || ex.cues || ex.form_cues;
    if (typeof formCues === 'string') formCues = formCues ? [formCues] : [];
    if (!Array.isArray(formCues)) formCues = [];
    return {
      name: String(ex.name || ex.exercise || ex.exerciseName || '').trim(),
      sets,
      reps,
      rest,
      startingWeight: ex.startingWeight != null ? String(ex.startingWeight) : ex.weight != null ? String(ex.weight) : undefined,
      formCues: formCues.map((c) => String(c)),
    };
  });
}

function parseSetsReps(setsRepsRaw) {
  if (setsRepsRaw == null) return { sets: '', reps: '' };
  const s = String(setsRepsRaw).trim();
  // Examples: "4 x 8-10", "4 x 8–10", "3x5"
  const m = s.match(/(\d+)\s*[xX]\s*([\d]+(?:\s*[-–]\s*[\d]+)?)/);
  if (m) return { sets: m[1], reps: m[2].replace(/\s+/g, '') };
  return { sets: '', reps: s };
}

function normalizeClaudeWarmupExercises(exercisesRaw) {
  // Viewer expects: [{ name, duration, description }]
  if (!Array.isArray(exercisesRaw)) return [];
  return exercisesRaw
    .map((x) => {
      if (x == null) return null;
      if (typeof x === 'string') {
        const t = x.trim();
        if (!t) return null;
        const parts = t.split(':');
        if (parts.length >= 2) {
          return { name: parts[0].trim(), duration: '', description: parts.slice(1).join(':').trim() };
        }
        return { name: t, duration: '', description: '' };
      }
      const name = String(x?.exerciseName || x?.name || x?.label || '').trim();
      if (!name) return null;
      return {
        name,
        duration: String(x?.duration || x?.time || ''),
        description: String(x?.notes || x?.description || ''),
      };
    })
    .filter(Boolean);
}

function normalizeClaudeMainWorkouts(mainWorkoutsRaw) {
  // Viewer expects: [{ name, sets, reps, rest, formCues }]
  if (!Array.isArray(mainWorkoutsRaw)) return [];
  return mainWorkoutsRaw
    .map((ex) => {
      if (!ex || typeof ex !== 'object') return null;
      const name = String(ex.exerciseName || ex.name || ex.exercise || ex.title || '').trim();
      if (!name) return null;

      const { sets, reps } = parseSetsReps(ex.setsReps || ex.sets_reps || ex.setsRepsRange || ex.setsAndReps);
      const restSecondsRaw = ex.restSeconds ?? ex.restSecondsValue ?? ex.rest_seconds ?? ex.rest ?? '';
      const rest = String(restSecondsRaw).replace(/[^\d]/g, '') || String(restSecondsRaw).trim();

      const notes = String(ex.notes || ex.formCues || ex.cues || '').trim();
      let formCues = [];
      if (notes) {
        formCues = notes
          .split(/[,;]\s*|\.\s+/)
          .map((p) => p.trim())
          .filter((p) => p.length > 2)
          .slice(0, 6);
        if (formCues.length === 0) formCues = [notes];
      }

      return {
        name,
        sets: sets || '',
        reps: reps || '',
        rest: rest || '',
        startingWeight: ex.startingWeight != null ? String(ex.startingWeight) : undefined,
        formCues,
      };
    })
    .filter(Boolean);
}

function normalizeClaudeDetailedWorkoutsToDays(detailedWorkouts) {
  // Claude schema seen in screenshots:
  // detailedWorkouts: { "day1Monday": { focus, sessionDuration, warmUp{exercises[]}, mainWorkouts[] } }
  if (!detailedWorkouts || typeof detailedWorkouts !== 'object' || Array.isArray(detailedWorkouts)) return [];

  return Object.entries(detailedWorkouts)
    .map(([dayKey, dayObj], index) => {
      if (!dayObj || typeof dayObj !== 'object') return null;

      const labelFromKey = String(dayKey || '')
        .replace(/^day\d+/i, '')
        .replace(/^_+/, '')
        .trim();
      const label = labelFromKey || String(dayObj.day || dayObj.label || dayObj.title || `Day ${index + 1}`).trim();

      const focus = String(dayObj.focus || dayObj.sessionFocus || dayObj.session_type || '').trim();
      const isRest = dayObj.isRest === true || /rest/i.test(focus) || /rest/i.test(label);
      if (isRest) {
        return {
          label,
          type: 'Rest',
          isRest: true,
          restGuidance: String(dayObj.restGuidance || dayObj.notes || dayObj.guidance || focus || '').trim(),
        };
      }

      const warmUp = (() => {
        const warm = dayObj.warmUp || dayObj.warmup || dayObj.warmupBlock;
        if (!warm || typeof warm !== 'object') return [];
        return normalizeClaudeWarmupExercises(warm.exercises || warm.items || []);
      })();

      const exercises = normalizeClaudeMainWorkouts(
        dayObj.mainWorkouts || dayObj.mainWorkoutsList || dayObj.main_workouts || dayObj.workouts || [],
      );

      const coolDown = (() => {
        const cool = dayObj.coolDown || dayObj.cooldown || dayObj.cooldownBlock;
        if (!cool || typeof cool !== 'object') return [];
        return normalizeClaudeWarmupExercises(cool.exercises || cool.items || []);
      })();

      const type = inferType(focus || label);
      return {
        label,
        type,
        isRest: false,
        primaryMuscles: [],
        estimatedTime: dayObj.sessionDuration || dayObj.sessionTime || dayObj.duration || dayObj.timeEstimate,
        warmUp,
        exercises,
        coolDown,
      };
    })
    .filter(Boolean);
}

function structuredPlanHasViewerContent(s) {
  if (!s || typeof s !== 'object') return false;
  // We consider the plan "renderable" only when the viewer can actually map
  // sessions/days into day cards (warm-up + exercises live under `days`).
  const days = Array.isArray(s.days) ? s.days.length : 0;
  return days > 0;
}

const planViewerRefStyles = StyleSheet.create({
  borderCardContainer: { width: '100%' },
  borderGradient: { width: '100%' },
  borderCardInner: { width: '100%' },
  logExerciseContainer: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  logExerciseName: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  setInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  setLabel: { fontSize: 12, width: 48 },
  setInput: {
    flex: 1,
    minWidth: 80,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  setButtonRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  setActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  setActionText: { fontSize: 13, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', flex: 1, textAlign: 'center' },
  menuContainer: { position: 'relative', width: 44, alignItems: 'flex-end' },
  dropdownMenu: {
    position: 'absolute',
    top: 46,
    right: 0,
    minWidth: 200,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 6,
    zIndex: 50,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  menuItem: { paddingVertical: 12, paddingHorizontal: 14 },
  menuItemText: { fontSize: 15, fontWeight: '600' },
  planContent: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 },
  dayCardContainer: { marginBottom: 14 },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dayHeaderContent: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  dayShort: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    opacity: 0.95,
    letterSpacing: 0.5,
  },
  dayInfo: { flex: 1 },
  dayName: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  dayFocus: { fontSize: 13, color: 'rgba(255,255,255,0.88)', marginTop: 2 },
  dayExpanded: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 12 },
  recoveryContainer: { alignItems: 'center', paddingVertical: 12 },
  recoveryTitle: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  recoveryNote: { fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  exerciseItem: { marginBottom: 14 },
  exerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  exerciseName: { fontSize: 15, fontWeight: '700', flex: 1 },
  exerciseSets: { fontSize: 14, fontWeight: '700' },
  exerciseDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  detailBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  detailText: { fontSize: 12 },
  exerciseNotes: { fontSize: 13, marginTop: 8, lineHeight: 19 },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  completeButtonText: { fontSize: 15, fontWeight: '700' },
  logLink: { alignItems: 'center', paddingVertical: 12 },
  logLinkText: { fontSize: 15, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  logBottomSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  logTitle: { fontSize: 18, fontWeight: '800' },
  logContent: { paddingHorizontal: 16, maxHeight: 420 },
  saveBtnGradient: { marginHorizontal: 16, marginTop: 8, borderRadius: 14, overflow: 'hidden' },
  saveButton: { paddingVertical: 16, alignItems: 'center' },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  subSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 4,
  },
  warmRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  warmName: { flex: 1, fontSize: 14, fontWeight: '600' },
  warmMeta: { fontSize: 12 },
  overviewCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
  },
  overviewLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, marginBottom: 8 },
  overviewBody: { fontSize: 14, lineHeight: 22 },
  metaLine: { fontSize: 13, marginBottom: 14 },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: { fontSize: 24, fontWeight: '700', marginTop: 16 },
  errorMessage: { fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  errorButton: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  errorButtonText: { color: '#FFFFFF', fontWeight: '700' },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loaderText: { marginTop: 16, fontSize: 14 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 32,
    borderRadius: 16,
    padding: 24,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginTop: 16 },
  emptyMessage: { fontSize: 14, marginTop: 8, textAlign: 'center' },
  emptyButton: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  emptyButtonText: { color: '#FFFFFF', fontWeight: '700' },
  noExerciseText: { fontSize: 14, textAlign: 'center', paddingVertical: 16 },
});

function derivePlanViewerDayShort(label, index, weeklySchedule) {
  const labelStr = String(label || '');
  const full = labelStr.match(
    /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i,
  );
  if (full) {
    const key = full[0].toLowerCase();
    const map = {
      monday: 'MON',
      tuesday: 'TUE',
      wednesday: 'WED',
      thursday: 'THU',
      friday: 'FRI',
      saturday: 'SAT',
      sunday: 'SUN',
    };
    return map[key] || full[0].substring(0, 3).toUpperCase();
  }
  const abbr = labelStr.match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i);
  if (abbr) return abbr[0].length === 3 ? abbr[0].toUpperCase() : abbr[0].substring(0, 3).toUpperCase();
  const ws = weeklySchedule && weeklySchedule[index];
  if (ws?.day) {
    const m = String(ws.day).match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i);
    if (m) return m[0].length === 3 ? m[0].toUpperCase() : m[0].substring(0, 3).toUpperCase();
  }
  return `D${index + 1}`;
}

function normalizeRouteWorkoutPlanItem(item, index) {
  if (!item || typeof item !== 'object') return null;
  const validShorts = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const rawShort = String(item.short || item.dayShort || '').trim();
  const day = String(item.day || item.label || item.name || `Day ${index + 1}`).trim();
  const inferredShort = derivePlanViewerDayShort(day, index, null);
  const short = validShorts.includes(rawShort) ? rawShort : inferredShort;
  const focus = String(item.focus || item.focusArea || item.sessionFocus || '').trim() || 'Training';
  const rest = !!(item.rest || item.isRest);
  const focusColor =
    item.focusColor ||
    (item.type && TYPE_COLORS[item.type]) ||
    PLAN_BUILDER_COLORS.pink;
  const rawEx = Array.isArray(item.exercises) ? item.exercises : [];
  const exercises = rawEx
    .map((ex) => {
      if (!ex || typeof ex !== 'object') return null;
      const name = String(ex.name || ex.exercise || ex.exerciseName || '').trim();
      if (!name) return null;
      const sets = ex.sets != null ? String(ex.sets) : ex.setCount != null ? String(ex.setCount) : '1';
      const reps = ex.reps != null ? String(ex.reps) : ex.repRange != null ? String(ex.repRange) : '—';
      const restEx = ex.rest != null ? String(ex.rest) : '';
      const muscle = String(ex.muscle || ex.muscleGroup || item.primaryMuscle || '').trim();
      let notes = ex.notes != null ? String(ex.notes) : '';
      if (!notes && Array.isArray(ex.formCues)) notes = ex.formCues.filter(Boolean).join('\n');
      return { name, sets, reps, rest: restEx, muscle, notes: notes || undefined };
    })
    .filter(Boolean);

  return {
    short,
    day,
    focus,
    focusColor,
    rest,
    recoveryNote:
      item.recoveryNote != null
        ? String(item.recoveryNote)
        : item.restGuidance != null
          ? String(item.restGuidance)
          : undefined,
    recoveryActivities: Array.isArray(item.recoveryActivities) ? item.recoveryActivities : undefined,
    exercises,
    warmUp: Array.isArray(item.warmUp) ? item.warmUp : [],
    coolDown: Array.isArray(item.coolDown) ? item.coolDown : [],
  };
}

function mapStructuredDaysToPlanViewerRows(structured) {
  const days = structured?.days;
  if (!Array.isArray(days) || days.length === 0) return [];
  const ws = structured?.weeklySchedule || [];
  return days.map((day, di) => {
    const short = derivePlanViewerDayShort(day?.label, di, ws);
    const label = String(day?.label || `Day ${di + 1}`);
    const focus = day?.isRest
      ? 'Rest & Recovery'
      : [day?.type, ...(Array.isArray(day?.primaryMuscles) ? day.primaryMuscles.slice(0, 2) : [])]
          .filter(Boolean)
          .join(' · ') || String(day?.type || 'Training');
    const focusColor = day?.isRest ? undefined : TYPE_COLORS[day?.type] || PLAN_BUILDER_COLORS.pink;
    const exercises = !day?.isRest && Array.isArray(day?.exercises)
      ? day.exercises
          .map((ex) => {
            const name = String(ex?.name || '').trim();
            if (!name) return null;
            const muscle =
              (Array.isArray(day?.primaryMuscles) && day.primaryMuscles[0]) ||
              String(day?.type || '') ||
              '—';
            const notes = Array.isArray(ex?.formCues) && ex.formCues.length
              ? ex.formCues.map((c) => String(c)).join('\n')
              : undefined;
            return {
              name,
              sets: ex?.sets != null ? String(ex.sets) : '1',
              reps: ex?.reps != null ? String(ex.reps) : '—',
              rest: ex?.rest != null ? String(ex.rest) : '',
              muscle: String(muscle),
              notes,
            };
          })
          .filter(Boolean)
      : [];
    return {
      short,
      day: label,
      focus,
      focusColor,
      rest: !!day?.isRest,
      recoveryNote: day?.isRest ? String(day?.restGuidance || '') : undefined,
      recoveryActivities: Array.isArray(day?.recoveryActivities) ? day.recoveryActivities : undefined,
      exercises,
      warmUp: Array.isArray(day?.warmUp) ? day.warmUp : [],
      coolDown: Array.isArray(day?.coolDown) ? day.coolDown : [],
    };
  });
}

function PlanViewerAnimatedBorderCard({ children, radius = 20, bg, restDay = false }) {
  const colors = restDay
    ? ['#374151', '#4B5563', '#6B7280', '#4B5563', '#374151']
    : ['#BE185D', '#C2410C', '#BE185D', '#C2410C', '#BE185D'];
  return (
    <View style={[planViewerRefStyles.borderCardContainer, { borderRadius: radius }]}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[planViewerRefStyles.borderGradient, { borderRadius: radius, padding: 2 }]}
      >
        <View
          style={[
            planViewerRefStyles.borderCardInner,
            {
              borderRadius: radius - 2,
              backgroundColor: bg,
              overflow: 'hidden',
            },
          ]}
        >
          {children}
        </View>
      </LinearGradient>
    </View>
  );
}

function PlanViewerLogExercise({ ex, text, muted, borderC, glass }) {
  const setCount = Math.max(1, Math.min(20, parseInt(String(ex.sets || '1'), 10) || 3));
  const [sets, setSets] = useState(() =>
    Array.from({ length: setCount }, () => ({ reps: '', weight: '' })),
  );

  const addSet = () => setSets([...sets, { reps: '', weight: '' }]);
  const removeSet = () => sets.length > 1 && setSets(sets.slice(0, -1));

  const updateSet = (index, field, value) => {
    const newSets = [...sets];
    newSets[index] = { ...newSets[index], [field]: value };
    setSets(newSets);
  };

  return (
    <View
      style={[
        planViewerRefStyles.logExerciseContainer,
        {
          backgroundColor: glass,
          borderColor: borderC,
        },
      ]}
    >
      <Text style={[planViewerRefStyles.logExerciseName, { color: text }]}>{ex.name}</Text>
      {sets.map((s, i) => (
        <View key={i} style={planViewerRefStyles.setInputRow}>
          <Text style={[planViewerRefStyles.setLabel, { color: muted }]}>Set {i + 1}</Text>
          <TextInput
            placeholder="Reps"
            placeholderTextColor={muted}
            value={s.reps}
            onChangeText={(v) => updateSet(i, 'reps', v)}
            style={[planViewerRefStyles.setInput, { borderColor: borderC, color: text }]}
          />
          <TextInput
            placeholder="Weight"
            placeholderTextColor={muted}
            value={s.weight}
            onChangeText={(v) => updateSet(i, 'weight', v)}
            style={[planViewerRefStyles.setInput, { borderColor: borderC, color: text }]}
          />
        </View>
      ))}
      <View style={planViewerRefStyles.setButtonRow}>
        <TouchableOpacity
          onPress={addSet}
          style={[planViewerRefStyles.setActionButton, { borderColor: borderC }]}
        >
          <MaterialCommunityIcons name="plus" size={16} color={text} />
          <Text style={[planViewerRefStyles.setActionText, { color: text }]}>Add Set</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={removeSet}
          style={[planViewerRefStyles.setActionButton, { borderColor: borderC }]}
        >
          <MaterialCommunityIcons name="minus" size={16} color={muted} />
          <Text style={[planViewerRefStyles.setActionText, { color: muted }]}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function buildWorkoutPlanPayloadFromStructured(structuredRaw) {
  if (!structuredRaw || typeof structuredRaw !== 'object') return null;

  // Already in the new shape
  if (Array.isArray(structuredRaw.workoutPlan) && structuredRaw.workoutPlan.length > 0) {
    const normalized = structuredRaw.workoutPlan
      .map((item, i) => normalizeRouteWorkoutPlanItem(item, i))
      .filter(Boolean);
    const onlyWeekdays = normalized.filter((d) => ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].includes(String(d.short)));
    const picked = onlyWeekdays.length ? onlyWeekdays : normalized;
    return {
      overview: structuredRaw.overview != null ? String(structuredRaw.overview) : '',
      workoutPlan: picked,
    };
  }

  const structured = normalizeStructuredPlanForViewer(structuredRaw);
  const overview = structured?.overview != null ? String(structured.overview) : '';
  const rows = mapStructuredDaysToPlanViewerRows(structured);
  if (!rows.length) return null;

  const workoutPlan = rows.map((d, i) => ({
    short: String(d.short || derivePlanViewerDayShort(d.day, i, null)).trim(),
    day: String(d.day || `Day ${i + 1}`),
    focus: String(d.focus || 'Training'),
    focusColor: d.focusColor || PLAN_BUILDER_COLORS.pink,
    rest: !!d.rest,
    recoveryNote: d.recoveryNote != null ? String(d.recoveryNote) : undefined,
    recoveryActivities: Array.isArray(d.recoveryActivities) ? d.recoveryActivities : undefined,
    exercises: Array.isArray(d.exercises) ? d.exercises : [],
  }));

  // Try to drop obvious section-cards from old plans (overview/schedule/nutrition/etc.).
  const sectionRe = /(plan\s*overview|weekly\s*schedule|detailed\s*workouts|nutrition|expected\s*timeline|important\s*notes|progress)/i;
  const filtered = workoutPlan.filter((d) => {
    const day = String(d.day || '');
    const looksLikeWeekday = /\b(mon|tue|wed|thu|fri|sat|sun)\b/i.test(day);
    const hasExercises = Array.isArray(d.exercises) && d.exercises.length > 0;
    if (looksLikeWeekday) return true;
    if (sectionRe.test(day)) return false;
    return hasExercises;
  });
  return { overview, workoutPlan: filtered.length ? filtered : workoutPlan };
}

/** Parse a table row like "| Leg swings | 30 sec | front to back |" into { name, duration, notes }. */
function parseTableRow(line) {
  const parts = line.split(/\|/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return { name: cleanText(parts[0]), duration: cleanText(parts[1]), notes: parts[2] ? cleanText(parts[2]) : '' };
  if (parts.length === 1) return { name: cleanText(parts[0]), duration: '', notes: '' };
  return null;
}

/**
 * Parse raw AI plan into { overview, days: [{ label, type, isRest, warmUp, exercises, coolDown }], notes }.
 * Exercises: "A1 — Bench Press - Sets x Reps: 4 x 8-10 - Rest: 90 seconds - Form Cues: - cue1 - cue2"
 * Warm-up/cool-down: table format "| Exercise | Duration | Notes |"
 */
function parsePlan(rawText) {
  const result = { overview: '', days: [], notes: '' };
  if (!rawText || typeof rawText !== 'string') return result;
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/([^\n])\s*(#{1,6}\s)/g, '$1\n\n$2');
  const sections = normalized.split(/\n\s*#{2,3}\s*/).map((s) => s.trim()).filter(Boolean);
  let firstOverview = '';
  for (let i = 0; i < sections.length; i++) {
    const block = sections[i];
    const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const firstLine = lines[0] || '';
    const lowerFirst = firstLine.toLowerCase();
    if (i === 0 && (lowerFirst.includes('overview') || lowerFirst.includes('personalized') || /^1\./.test(firstLine) || block.length > 200)) {
      firstOverview = block;
      continue;
    }
    if (/important\s*notes|notes\s*$/i.test(firstLine) || /^7\./.test(firstLine)) {
      result.notes = lines.slice(1).join('\n').trim() || firstLine;
      continue;
    }
    const label = cleanText(firstLine.replace(/^[\d.]+\s*/, '').trim()) || `Day ${result.days.length + 1}`;
    const isRest = /\b(rest|off)\b/i.test(label);
    const type = isRest ? 'Rest' : inferType(label);
    const warmUp = [];
    const exercises = [];
    const coolDown = [];
    let inWarmUp = false;
    let inCoolDown = false;
    let inExercises = false;
    for (let j = 1; j < lines.length; j++) {
      const line = lines[j];
      const lower = line.toLowerCase();
      if (/warm[- ]?up|warmup/.test(lower) && line.length < 30) {
        inWarmUp = true;
        inCoolDown = false;
        inExercises = false;
        continue;
      }
      if (/cool[- ]?down|cooldown/.test(lower) && line.length < 30) {
        inCoolDown = true;
        inWarmUp = false;
        inExercises = false;
        continue;
      }
      if (/exercise|main\s*work|workout\s*a|workout\s*b/i.test(lower) && line.length < 40 && !inWarmUp && !inCoolDown) {
        inExercises = true;
        continue;
      }
      if (/^\|/.test(line) || (/\|/.test(line) && line.length < 200)) {
        const row = parseTableRow(line);
        if (row && row.name && !/^[-—|]+$/.test(row.name)) {
          if (inCoolDown) coolDown.push({ name: row.name, duration: row.duration, notes: row.notes });
          else if (inWarmUp) warmUp.push({ name: row.name, duration: row.duration });
        }
        continue;
      }
      const bulletMatch = line.match(/^[\s•\d.*\-]+(.+)$/);
      if (bulletMatch) {
        const content = bulletMatch[1].trim();
        if (!content || content.length < 2) continue;
        const formCuesMatch = content.match(/Form\s*Cues?:\s*(.+)$/i);
        const parts = content.split(/\s+-\s+/);
        const firstPart = (parts[0] || '').trim();
        let name = firstPart.replace(/^[A-Z]\d+\s*[—\-]\s*/, '').trim();
        let sets = '';
        let reps = '';
        let rest = '';
        let startingWeight = '';
        const formCues = [];
        if (formCuesMatch) {
          formCuesMatch[1].split(/\s+-\s+/).forEach((c) => {
            const cue = cleanText(c.trim());
            if (cue) formCues.push(cue);
          });
        }
        for (let k = 1; k < parts.length; k++) {
          const p = parts[k];
          if (/Form\s*Cues?/i.test(p)) continue;
          const colonIdx = p.indexOf(':');
          if (colonIdx >= 0) {
            const key = p.slice(0, colonIdx).trim().toLowerCase();
            const val = cleanText(p.slice(colonIdx + 1).trim());
            if (/sets?\s*x\s*reps?|reps?/i.test(key)) {
              const xMatch = val.match(/(\d+)\s*x\s*([\d\-]+)/i) || val.match(/(\d+)\s*sets?\s*[x×]\s*([\d\-]+)/i);
              if (xMatch) {
                sets = xMatch[1];
                reps = xMatch[2];
              }
            } else if (/rest/i.test(key)) rest = val;
            else if (/starting\s*weight|weight/i.test(key)) startingWeight = val;
          }
        }
        if (!sets && !reps && content.includes(':')) {
          const colonMatch = content.match(/^(.+?):\s*(.+)$/);
          if (colonMatch) {
            name = colonMatch[1].replace(/^[A-Z]\d+\s*[—\-]\s*/, '').trim();
            const restPart = colonMatch[2];
            const setMatch = restPart.match(/(\d+)\s*sets?\s*[x×]\s*([\d\-]+)\s*reps?/i) || restPart.match(/(\d+)\s*x\s*([\d\-]+)/i);
            if (setMatch) {
              sets = setMatch[1];
              reps = setMatch[2];
            }
            const restMatch = restPart.match(/(\d+)\s*s\s*rest|(\d+)\s*sec|rest\s*(\d+)\s*s/i);
            if (restMatch) rest = (restMatch[1] || restMatch[2] || restMatch[3] || '') + 's';
          }
        }
        if (name && (sets || reps || formCues.length > 0 || name.length > 3)) {
          exercises.push({
            name: cleanText(name),
            sets: sets || '',
            reps: reps || '',
            rest: rest || '',
            startingWeight: startingWeight || '',
            formCues,
          });
        }
      }
    }
    result.days.push({ label, type, isRest, warmUp, exercises, coolDown });
  }
  result.overview = firstOverview || result.overview;
  return result;
}

/** Trainer-only banner when viewing a client's onboarding on Workout Plans. */
function CoachViewContextBanner({ isDark, clientName, textColor, mutedColor }) {
  const rim = ['#9333EA', '#DB2777'];
  const innerBg = isDark ? '#0A0812' : '#FFFFFF';
  const bgGrad = isDark ? ['#12081f', '#08050f'] : ['#F3F0FA', '#FFFFFF'];
  const iconInnerBg = isDark ? 'rgba(14,12,22,0.98)' : 'rgba(255,255,255,0.98)';
  const displayName = String(clientName || '').trim() || 'Your client';
  const steps = [
    'Scroll down to review profile cards',
    'Home → select client → AI Workouts to assign plans',
  ];

  return (
    <View style={{ marginHorizontal: 16, marginTop: 4, marginBottom: 10 }}>
      <LinearGradient
        colors={rim}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 20,
          padding: 1.5,
          ...(Platform.OS === 'ios'
            ? { shadowColor: '#9333EA', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12 }
            : { elevation: 4 }),
        }}
      >
        <View style={{ borderRadius: 18.5, overflow: 'hidden', backgroundColor: innerBg }}>
          <LinearGradient colors={bgGrad} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
            <LinearGradient colors={rim} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 3, width: '100%' }} />
            <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 14, alignItems: 'flex-start' }}>
              <LinearGradient
                colors={rim}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: 48, height: 48, borderRadius: 16, padding: 1.5 }}
              >
                <View
                  style={{
                    flex: 1,
                    borderRadius: 14.5,
                    backgroundColor: iconInnerBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="eye-outline" size={24} color={isDark ? '#E9D5FF' : '#7C3AED'} />
                </View>
              </LinearGradient>

              <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '900',
                      letterSpacing: 1.1,
                      textTransform: 'uppercase',
                      color: isDark ? '#DDD6FE' : '#7C3AED',
                    }}
                  >
                    Coach view
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 999,
                      backgroundColor: isDark ? 'rgba(147,51,234,0.22)' : 'rgba(124,58,237,0.1)',
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(167,139,250,0.35)' : 'rgba(139,92,246,0.22)',
                    }}
                  >
                    <Text style={{ fontSize: 9, fontWeight: '800', color: isDark ? '#C4B5FD' : '#6D28D9' }}>Read only</Text>
                  </View>
                </View>

                <Text
                  style={{ fontSize: 17, fontWeight: '900', color: textColor, marginTop: 6, letterSpacing: -0.3 }}
                  numberOfLines={1}
                >
                  {displayName}
                </Text>

                <Text style={{ fontSize: 12, fontWeight: '600', color: mutedColor, lineHeight: 17, marginTop: 6 }}>
                  Onboarding context for plan building — edits and AI generation here are disabled on this screen.
                </Text>

                <View style={{ marginTop: 10, gap: 7 }}>
                  {steps.map((line) => (
                    <View key={line} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                      <View
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          marginTop: 1,
                          backgroundColor: isDark ? 'rgba(147,51,234,0.2)' : 'rgba(124,58,237,0.1)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="checkmark" size={11} color={isDark ? '#DDD6FE' : '#7C3AED'} />
                      </View>
                      <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: mutedColor, lineHeight: 15 }}>{line}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>
      </LinearGradient>
    </View>
  );
}

export default function WorkoutPlanGeneratorScreen({
  userId,
  /** When true (trainer app, no roster), show CTA instead of loading trainer onboarding */
  trainerRosterEmpty = false,
  /** Optional label for coach context banner */
  viewingClientName = '',
  onBack,
  onPlanGenerated,
  onNavigate,
  onProfilePress,
  onSettingsPress,
  plan: propPlan,
  readOnly = false,
  hideBottomNav = false,
  route,
}) {
  const theme = useTheme();
  const { isDark, toggleTheme } = theme;
  const insets = useSafeAreaInsets();
  const { aiEnabled, loading: aiPrefLoading } = useAI();
  const aiOn = aiEnabled === true;
  const aiPrefReady = !aiPrefLoading && aiEnabled !== null;

  const profileSubjectUid = useMemo(() => {
    if (trainerRosterEmpty) return null;
    const id = userId && String(userId).trim();
    if (id) return id;
    return auth.currentUser?.uid || null;
  }, [userId, trainerRosterEmpty]);

  const isCoachViewingClientProfile = useMemo(
    () =>
      Boolean(
        auth.currentUser?.uid && profileSubjectUid && profileSubjectUid !== auth.currentUser.uid
      ),
    [profileSubjectUid]
  );

  // State
  const [onboardingData, setOnboardingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [expandedCard, setExpandedCard] = useState(null);
  const [editingPillKey, setEditingPillKey] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [generatedPlan, setGeneratedPlan] = useState(propPlan || null);
  const [addedToCollection, setAddedToCollection] = useState(false);
  const [savingToCollection, setSavingToCollection] = useState(false);
  const generatedPlanId = generatedPlan?.id;
  useEffect(() => { setAddedToCollection(false); }, [generatedPlanId]);
  const [showFullPlan, setShowFullPlan] = useState(!!readOnly);
  const [viewerErrorDelayElapsed, setViewerErrorDelayElapsed] = useState(false);
  const [generatingMessageIndex, setGeneratingMessageIndex] = useState(0);
  const [showEditPlanModal, setShowEditPlanModal] = useState(false);
  const [editPlanText, setEditPlanText] = useState('');
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [pdfLocalUri, setPdfLocalUri] = useState(null);
  const [pdfDownloadUrl, setPdfDownloadUrl] = useState(null);
  const [planTitleForPdf, setPlanTitleForPdf] = useState('');
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [showRawPlanFallback, setShowRawPlanFallback] = useState(false);
  const [pdfGenerationError, setPdfGenerationError] = useState(null);
  const [collectionViewingPlan, setCollectionViewingPlan] = useState(null);
  const [planOverviewExpanded, setPlanOverviewExpanded] = useState(false);
  const [expandedDayIndices, setExpandedDayIndices] = useState({});
  const [expandedExerciseIndices, setExpandedExerciseIndices] = useState({});
  const [planViewerCompleted, setPlanViewerCompleted] = useState({});
  const [planViewerMenuOpen, setPlanViewerMenuOpen] = useState(false);
  const [planViewerLogDay, setPlanViewerLogDay] = useState(null);
  const [planViewerExpandedDay, setPlanViewerExpandedDay] = useState(null);
  const [activeTab, setActiveTab] = useState('plans'); // 'plans' | 'library'

  // Plan generation limit (server-enforced; usage synced from Firestore + API responses)
  const [workoutGenUsage, setWorkoutGenUsage] = useState(null);
  const plansUsedThisMonth = Number(workoutGenUsage?.generations_used) || 0;
  const planGenerationLimit = Number(workoutGenUsage?.generations_limit) || PLAN_LIMIT_TOTAL;
  const plansRemaining = Math.max(0, planGenerationLimit - plansUsedThisMonth);
  const nextResetDate = useMemo(() => {
    const raw = workoutGenUsage?.resets_at || nextMonthResetsAtIso();
    const d = new Date(`${String(raw).slice(0, 10)}T12:00:00`);
    return Number.isNaN(d.getTime()) ? nextMonthResetDate() : d;
  }, [workoutGenUsage?.resets_at]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const uid = profileSubjectUid || auth.currentUser?.uid;
      if (!uid) return;
      const usage = await resolveWorkoutGenerationUsage(uid, { generatedPlan });
      if (mounted) setWorkoutGenUsage(usage);
    })();
    return () => {
      mounted = false;
    };
  }, [profileSubjectUid, generatedPlan?.generatedAt, generatedPlan?.id]);

  // Trainer-request UI state (AI disabled path)
  const [requestText, setRequestText] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);

  // If a pre-loaded plan was passed in (viewer mode), set minimal state and stop loading.
  useEffect(() => {
    if (!propPlan) return;
    const normalizedPlan = {
      ...propPlan,
      planText: propPlan?.planText || propPlan?.rawPlan || propPlan?.text || propPlan?.content || '',
    };
    setGeneratedPlan(normalizedPlan);
    setLoading(false);
    setIsGenerating(false);
    setGenerationError(null);
    if (propPlan.userData && !onboardingData) {
      setOnboardingData(propPlan.userData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propPlan]);

  // Prevent a brief \"No workout plan provided\" flash in read-only viewer mode.
  // We give the viewer a short window to hydrate planText / structuredPlan.
  useEffect(() => {
    if (!(readOnly && showFullPlan)) return;
    setViewerErrorDelayElapsed(false);
    const t = setTimeout(() => setViewerErrorDelayElapsed(true), 450);
    return () => clearTimeout(t);
  }, [readOnly, showFullPlan, generatedPlan?.id]);

  const togglePlanViewerDay = useCallback((dayShort) => {
    setPlanViewerExpandedDay((prev) => (prev === dayShort ? null : dayShort));
  }, []);

  const scrollViewRef = useRef(null);
  const shakeAnimations = useRef({});
  const auraAnim = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);
  /** False when app is backgrounded — generation should still finish and notify if user left the UI */
  const appInForegroundRef = useRef(AppState.currentState === 'active');

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      appInForegroundRef.current = next === 'active';
    });
    return () => sub.remove();
  }, []);

  const schedulePlanReadyNotification = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      let next = status;
      if (next !== 'granted') {
        const req = await Notifications.requestPermissionsAsync();
        next = req.status;
      }
      if (next !== 'granted') return;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Workout plan ready',
          body: 'Open Workout to view your new plan.',
        },
        trigger: null,
      });
    } catch (e) {
      console.warn('Plan ready notification:', e);
    }
  };

  const GENERATING_MESSAGES = [
    'Analyzing your goals & profile…',
    'Structuring your weekly split…',
    'Balancing volume & recovery…',
    'Selecting exercises for your equipment…',
    'Tuning intensity & progression…',
    'Finalizing your program…',
  ];

  useEffect(() => {
    if (!isGenerating) return;
    const t = setInterval(() => {
      setGeneratingMessageIndex((i) => (i + 1) % GENERATING_MESSAGES.length);
    }, 2200);
    return () => clearInterval(t);
  }, [isGenerating]);

  const fetchWorkoutPlanFromServer = async (data, subjectUserId) => {
    const uid = subjectUserId || auth.currentUser?.uid;
    const { text, usage } = await requestWorkoutPlanFromApi(data, uid);
    const merged = await resolveWorkoutGenerationUsage(uid, { apiUsage: usage, justGenerated: true });
    setWorkoutGenUsage(merged);
    return text;
  };

  // Load onboarding + cached plan for the profile subject (signed-in user, or `userId` when coach opens a client).
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (propPlan) {
        setLoading(false);
        return;
      }
      if (trainerRosterEmpty) {
        setOnboardingData(null);
        setGeneratedPlan(null);
        setLoading(false);
        return;
      }

      const subjectUid = (userId && String(userId).trim()) || auth.currentUser?.uid;
      if (!subjectUid) {
        Alert.alert('Error', 'User not found');
        if (onBack) onBack();
        setLoading(false);
        return;
      }

      const authUid = auth.currentUser?.uid;
      const isCoach = Boolean(authUid && subjectUid !== authUid);
      const isSelf = !isCoach;

      try {
        const key = `onboarding_data_${subjectUid}`;
        let loadedData = null;
        if (db) {
          const userSnap = await getDoc(doc(db, 'users', subjectUid));
          if (userSnap.exists()) {
            loadedData = userSnap.data();
            if (!cancelled) {
              await AsyncStorage.setItem(key, JSON.stringify(loadedData));
              setOnboardingData(loadedData);
            }
          }
        }
        if (!loadedData) {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            loadedData = JSON.parse(data);
            if (!cancelled) setOnboardingData(loadedData);
          } else if (isCoach) {
            if (!cancelled) setOnboardingData({});
          } else {
            Alert.alert('Error', 'Onboarding data not found');
            if (onBack) onBack();
          }
        }

        if (cancelled || !subjectUid) return;

        const firestorePlan = await getCurrentWorkoutPlan(subjectUid);
        if (firestorePlan?.rawPlan) {
          let structuredPlan = null;
          let planParseError = false;
          try {
            const raw = extractJSON(String(firestorePlan.rawPlan));
            structuredPlan = JSON.parse(raw);
          } catch (e) {
            try {
              const legacy = parsePlan(String(firestorePlan.rawPlan));
              if (legacy && (legacy.overview || (legacy.days && legacy.days.length))) {
                structuredPlan = {
                  overview: legacy.overview || '',
                  weeklySchedule: (legacy.days || []).map((d) => ({
                    day: d.label || '',
                    focus: d.type || '',
                  })),
                  days: legacy.days || [],
                  nutritionNotes: '',
                  generalNotes: legacy.notes || '',
                };
                planParseError = false;
              } else {
                planParseError = true;
              }
            } catch (fallbackErr) {
              console.warn('Stored plan parse failed on load (JSON + legacy):', e?.message || e, fallbackErr?.message || fallbackErr);
              planParseError = true;
            }
          }

          try {
            const payload = buildWorkoutPlanPayloadFromStructured(structuredPlan);
            if (payload && Array.isArray(payload.workoutPlan) && payload.workoutPlan.length > 0) {
              structuredPlan = payload;
              planParseError = false;
              const migratedRaw = JSON.stringify(payload);
              firestorePlan.rawPlan = migratedRaw;
              await AsyncStorage.setItem(`workout_plan_${subjectUid}`, JSON.stringify({
                id: `plan_${firestorePlan.generatedAt?.toMillis?.() ?? Date.now()}`,
                generatedAt: firestorePlan.generatedAt?.toMillis?.() ?? Date.now(),
                userData: loadedData,
                planText: migratedRaw,
                structuredPlan: payload,
                planParseError: false,
              }));
              if (isSelf) {
                await AsyncStorage.setItem('@workout_plan', JSON.stringify({
                  id: `plan_${firestorePlan.generatedAt?.toMillis?.() ?? Date.now()}`,
                  generatedAt: firestorePlan.generatedAt?.toMillis?.() ?? Date.now(),
                  userData: loadedData,
                  planText: migratedRaw,
                  structuredPlan: payload,
                  planParseError: false,
                }));
              }
              await setCurrentWorkoutPlan(subjectUid, { rawPlan: migratedRaw });
            }
          } catch (e) {
            console.warn('Workout plan migration (Firestore) failed:', e?.message || e);
          }

          const saved = {
            id: `plan_${firestorePlan.generatedAt?.toMillis?.() ?? Date.now()}`,
            generatedAt: firestorePlan.generatedAt?.toMillis?.() ?? Date.now(),
            userData: loadedData,
            planText: firestorePlan.rawPlan,
            structuredPlan,
            planParseError,
          };
          if (!cancelled) setGeneratedPlan(saved);
        } else {
          const planJson = isSelf
            ? (await AsyncStorage.getItem('@workout_plan')) || (await AsyncStorage.getItem(`workout_plan_${subjectUid}`))
            : await AsyncStorage.getItem(`workout_plan_${subjectUid}`);
          if (planJson) {
            const saved = JSON.parse(planJson);
            if (saved && (saved.planText || saved.structuredPlan)) {
              if (!saved.structuredPlan && saved.planText) {
                try {
                  const raw = extractJSON(String(saved.planText));
                  saved.structuredPlan = JSON.parse(raw);
                  saved.planParseError = false;
                } catch (e) {
                  try {
                    const legacy = parsePlan(String(saved.planText));
                    if (legacy && (legacy.overview || (legacy.days && legacy.days.length))) {
                      saved.structuredPlan = {
                        overview: legacy.overview || '',
                        weeklySchedule: (legacy.days || []).map((d) => ({
                          day: d.label || '',
                          focus: d.type || '',
                        })),
                        days: legacy.days || [],
                        nutritionNotes: '',
                        generalNotes: legacy.notes || '',
                      };
                      saved.planParseError = false;
                    } else {
                      saved.structuredPlan = null;
                      saved.planParseError = true;
                    }
                  } catch (fallbackErr) {
                    console.warn('Stored plan parse failed from AsyncStorage (JSON + legacy):', e?.message || e, fallbackErr?.message || fallbackErr);
                    saved.structuredPlan = null;
                    saved.planParseError = true;
                  }
                }
              }

              try {
                const payload = buildWorkoutPlanPayloadFromStructured(saved.structuredPlan || tryParseJsonObject(saved.planText));
                if (payload && Array.isArray(payload.workoutPlan) && payload.workoutPlan.length > 0) {
                  const migratedRaw = JSON.stringify(payload);
                  saved.structuredPlan = payload;
                  saved.planText = migratedRaw;
                  saved.planParseError = false;
                  await AsyncStorage.setItem(`workout_plan_${subjectUid}`, JSON.stringify(saved));
                  if (isSelf) {
                    await AsyncStorage.setItem('@workout_plan', JSON.stringify(saved));
                  }
                  await setCurrentWorkoutPlan(subjectUid, { rawPlan: migratedRaw });
                }
              } catch (e) {
                console.warn('Workout plan migration (AsyncStorage) failed:', e?.message || e);
              }

              if (!cancelled) setGeneratedPlan(saved);
            }
          }
        }
      } catch (error) {
        console.error('Error loading onboarding data:', error);
        if (!isCoach) {
          Alert.alert('Error', 'Failed to load onboarding data');
          if (onBack) onBack();
        } else if (!cancelled) {
          setOnboardingData({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: reload when subject client or roster flag changes
  }, [userId, trainerRosterEmpty, propPlan]);

  // Aura pulse (processing state)
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(auraAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(auraAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [auraAnim]);

  // Pre-fill trainer request when onboardingData loads (AI disabled path)
  useEffect(() => {
    if (isCoachViewingClientProfile) return;
    if (aiOn) return;
    if (!onboardingData) return;
    if (requestText) return;

    const exp = onboardingData?.fitnessLevel || onboardingData?.experience || 'your current';
    const goal = onboardingData?.goal || onboardingData?.primaryGoal || 'fitness';
    const freq = onboardingData?.frequency || onboardingData?.daysPerWeek || onboardingData?.workoutsPerWeek || '';
    const sessionLen = onboardingData?.preferredWorkoutTime || onboardingData?.sessionLength || '';
    const equipment = onboardingData?.equipment || onboardingData?.availableEquipment || '';
    const limitations = onboardingData?.injuries || onboardingData?.limitations || '';

    const parts = [
      `I'd like a ${exp} ${goal} plan.`,
      freq ? `I can train ${freq}.` : null,
      sessionLen ? `Sessions: ${sessionLen}.` : null,
      equipment ? `Equipment: ${equipment}.` : null,
      limitations ? `Limitations: ${limitations}.` : null,
    ].filter(Boolean);

    setRequestText(parts.join(' '));
  }, [aiOn, onboardingData, requestText]);

  const resolvedTrainerId =
    onboardingData?.trainerId ||
    onboardingData?.trainer?.id ||
    onboardingData?.trainer?.uid ||
    null;

  const handleSendTrainerRequest = async () => {
    if (isCoachViewingClientProfile) {
      Alert.alert('Client app only', 'Clients send plan requests from their account.');
      return;
    }
    const clientId = auth?.currentUser?.uid;
    const trainerId = resolvedTrainerId;
    if (!clientId) {
      Alert.alert('Not logged in', 'Please log in to send a request.');
      return;
    }
    if (!trainerId) {
      Alert.alert('No trainer', 'Connect with a trainer first to request a workout plan.');
      return;
    }
    const text = String(requestText || '').trim();
    if (!text) {
      Alert.alert('Message required', 'Tell your trainer what kind of plan you want.');
      return;
    }

    setSendingRequest(true);
    try {
      const conversationId = await getOrCreateConversation(clientId, trainerId);
      const me = await getUserData(clientId);
      await sendClientRequest(conversationId, clientId, text, {
        requestType: CLIENT_REQUEST_TYPES.WORKOUT_PLAN,
        allowDefaultIntro: false,
        clientName: me?.name || me?.firstName || auth?.currentUser?.displayName || 'Client',
        clientGoals: onboardingData?.goal || onboardingData?.primaryGoal || 'Not specified',
        clientExperienceLevel: onboardingData?.fitnessLevel || onboardingData?.experience || 'Beginner',
        clientEquipment: onboardingData?.equipment || onboardingData?.availableEquipment || 'Not specified',
        clientLimitations: onboardingData?.injuries || onboardingData?.limitations || 'None',
      });
      Alert.alert(
        'Request sent',
        'Your trainer will see this in Client Requests — not as a chat message. They can acknowledge it from their dashboard.',
      );
    } catch (e) {
      console.error('Send trainer request failed:', e);
      Alert.alert('Send failed', e?.message || 'Could not send your request.');
    } finally {
      setSendingRequest(false);
    }
  };

  const saveData = async (updatedData) => {
    if (isCoachViewingClientProfile) {
      Alert.alert(
        'View only',
        "You're seeing this client's onboarding context. They edit their own profile in the client app."
      );
      return;
    }
    try {
      const ownerUid = auth.currentUser?.uid;
      if (!ownerUid) return;
      const key = `onboarding_data_${ownerUid}`;
      await AsyncStorage.setItem(key, JSON.stringify(updatedData));
      setOnboardingData(updatedData);
      if (db) {
        await setDoc(doc(db, 'users', ownerUid), { ...updatedData, updatedAt: serverTimestamp() }, { merge: true });
      }
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  // Validate all required fields
  const validateData = () => {
    const errors = {};
    
    if (!onboardingData.weight || onboardingData.weight <= 0) {
      errors.weight = 'Weight is required';
    }
    const h = onboardingData.height;
    const heightOk =
      (typeof h === 'number' && Number.isFinite(h) && h >= 36 && h <= 96) ||
      (typeof h === 'object' &&
        h != null &&
        (Number(h.feet) > 0 || Number(h.inches) > 0));
    if (!heightOk) {
      errors.height = 'Height is required';
    }
    if (!onboardingData.age || onboardingData.age < 13 || onboardingData.age > 100) {
      errors.age = 'Age must be between 13 and 100';
    }
    if (!onboardingData.gender) {
      errors.gender = 'Gender is required';
    }
    if (!onboardingData.fitnessLevel) {
      errors.fitnessLevel = 'Fitness level is required';
    }
    if (!onboardingData.primaryGoal) {
      errors.goal = 'Primary goal is required';
    }
    if (!onboardingData.equipmentAccess || onboardingData.equipmentAccess.length === 0) {
      errors.equipment = 'At least one equipment option is required';
    }
    if (!onboardingData.daysPerWeek || onboardingData.daysPerWeek < 1 || onboardingData.daysPerWeek > 7) {
      errors.frequency = 'Training frequency is required (1-7 days)';
    }
    if (onboardingData.situationDescription && onboardingData.situationDescription.length > 1000) {
      errors.situationDescription = 'Situation description must be 1000 characters or less';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Trigger shake animation
  const triggerShake = (cardKey) => {
    if (!shakeAnimations.current[cardKey]) {
      shakeAnimations.current[cardKey] = new Animated.Value(0);
    }
    const anim = shakeAnimations.current[cardKey];
    
    Animated.sequence([
      Animated.timing(anim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  // Generate workout plan
  const generateWorkoutPlan = async () => {
    if (isCoachViewingClientProfile) {
      Alert.alert(
        'Open AI Workouts',
        'To generate a plan for this client, go to Home, select them on your roster, then use Quick actions → AI Workouts. Plans are saved to their library there.'
      );
      return;
    }
    if (plansRemaining <= 0) {
      Alert.alert(
        'Monthly limit reached',
        `You've used all your workout generations for this month. Resets ${formatWorkoutLimitResetLabel(workoutGenUsage?.resets_at)}.`,
      );
      return;
    }
    if (!validateData()) {
      // Scroll to first error and shake
      const firstErrorKey = Object.keys(validationErrors)[0];
      if (firstErrorKey) {
        setExpandedCard(firstErrorKey);
        triggerShake(firstErrorKey);
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        }, 100);
      }
      Alert.alert('Validation Error', 'Please complete all required information');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    workoutPlanGenerationInFlight = true;

    const ui = (fn) => {
      if (mountedRef.current) fn();
    };

    try {
      const subjectUid = (userId && String(userId).trim()) || auth.currentUser?.uid;
      const rawText = await fetchWorkoutPlanFromServer(onboardingData, subjectUid);

      if (rawText) {
        console.log(
          'RAW WORKOUT RESPONSE length:',
          rawText.length,
          '| preview:',
          JSON.stringify(String(rawText).slice(0, 600)),
        );
      }

      if (!rawText || typeof rawText !== 'string') throw new Error('Empty response from server. Please try again.');

      let planText = rawText;
      const stopReason = null;
      if (!planText || typeof planText !== 'string') {
        throw new Error('Empty response from Claude. Please try again.');
      }
      planText = extractJSON(planText);
      let structuredPlan = null;
      let planParseError = false;
      try {
        const parsed = parseWorkoutPlan(planText);
        // Back-compat: also expose `workoutPlan` for existing viewer paths.
        structuredPlan = {
          ...parsed,
          workoutPlan: Array.isArray(parsed?.plan) ? parsed.plan : [],
        }; // { success, plan: DayPlan[], workoutPlan: DayPlan[] }
        planParseError = false;
      } catch (parseErr) {
        console.warn('Workout plan parse failed:', parseErr);
        const truncated =
          stopReason === 'max_tokens' ||
          (typeof planText === 'string' && !planText.trimEnd().endsWith('}'));
        const parseMsg = truncated
          ? 'The response was cut off. Tap Generate again to retry.'
          : (parseErr?.message || 'Failed to parse — please regenerate.');
        ui(() => setGenerationError(parseMsg));
        ui(() =>
          setGeneratedPlan({
            id: `plan_${Date.now()}`,
            generatedAt: Date.now(),
            userData: onboardingData,
            planText: planText,
            structuredPlan: null,
            planParseError: true,
          })
        );
        return;
      }

      const authedUid = auth.currentUser?.uid;
      const targetUid = profileSubjectUid;
      const planData = {
        id: `plan_${Date.now()}`,
        generatedAt: Date.now(),
        userData: onboardingData,
        planText: planText,
        structuredPlan: structuredPlan,
        planParseError: false,
      };

      // Cache locally; mirror global @workout_plan only for the signed-in user's own profile.
      await AsyncStorage.setItem(`workout_plan_${targetUid || authedUid || 'unknown'}`, JSON.stringify(planData));
      if (targetUid && authedUid && targetUid === authedUid) {
        await AsyncStorage.setItem('@workout_plan', JSON.stringify(planData));
      }
      ui(() => setGeneratedPlan(planData));
      if (targetUid) {
        await setCurrentWorkoutPlan(targetUid, {
          rawPlan: planText,
          planText,
          structuredPlan: generatedPlan?.structuredPlan || null,
          title: generatedPlan?.structuredPlan?.goal
            ? `${String(generatedPlan.structuredPlan.goal).slice(0, 48)} plan`
            : undefined,
        });
      }

      ui(() => setPdfGenerationError(null));
      ui(() => setShowRawPlanFallback(false));
      ui(() => setPdfLocalUri(null));
      ui(() => setPdfDownloadUrl(null));
      ui(() => setPlanTitleForPdf(''));

      // IMPORTANT: Do not auto-generate a PDF during plan generation.
      // The user-facing experience should rely on the plan viewer layout.

      const userNotOnGeneratorUi = !mountedRef.current;
      const appNotActive = !appInForegroundRef.current;
      if (userNotOnGeneratorUi || appNotActive) {
        await schedulePlanReadyNotification();
      }
    } catch (error) {
      console.error('Error generating workout plan:', error);
      if (error?.code === 'monthly_limit_reached') {
        if (error.limitPayload) {
          setWorkoutGenUsage({
            generations_used: Number(error.limitPayload.used) || planGenerationLimit,
            generations_limit: Number(error.limitPayload.limit) || planGenerationLimit,
            resets_at: error.limitPayload.resets_at || nextMonthResetsAtIso(),
          });
        }
        ui(() => setGenerationError(error.message));
        if (mountedRef.current) {
          Alert.alert('Monthly limit reached', error.message);
        }
        return;
      }
      ui(() => setGenerationError(error.message || 'Failed to generate workout plan'));
      if (mountedRef.current) {
        Alert.alert(
          'Generation Failed',
          error.message || 'We couldn\'t generate your workout plan. Please try again.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Retry', onPress: () => generateWorkoutPlan() },
          ]
        );
      }
    } finally {
      ui(() => setIsGenerating(false));
    }
  };

  const handleAddToCollection = async () => {
    const targetUid = profileSubjectUid;
    if (!generatedPlan || !targetUid || addedToCollection || savingToCollection) return;
    setSavingToCollection(true);
    try {
      const result = await saveGeneratedPlanToCollection(targetUid, generatedPlan);
      if (result.success) {
        setAddedToCollection(true);
      } else {
        Alert.alert('Could not save', result.error || 'Failed to add plan to collection.');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to save plan.');
    } finally {
      setSavingToCollection(false);
    }
  };

  const handleRegeneratePlan = () => {
    if (isCoachViewingClientProfile) {
      Alert.alert(
        'Open AI Workouts',
        'Regenerate plans for clients from Home → select client → AI Workouts.'
      );
      return;
    }
    if (plansRemaining <= 0) {
      Alert.alert(
        'Monthly limit reached',
        `You've used all your workout generations for this month. Resets ${formatWorkoutLimitResetLabel(workoutGenUsage?.resets_at)}.`,
      );
      return;
    }
    Alert.alert(
      'Regenerate plan?',
      'This will replace your current plan with a new one based on your profile.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Regenerate', onPress: () => generateWorkoutPlan() },
      ]
    );
  };

  const handleOpenEditPlan = () => {
    const raw = generatedPlan?.planText || '';
    setEditPlanText(raw);
    setShowEditPlanModal(true);
  };

  const handleSaveEditedPlan = async () => {
    let text = (editPlanText || '').trim();
    if (!text) return;
    text = extractJSON(text);
    let structuredPlan = null;
    let planParseError = false;
    try {
      structuredPlan = JSON.parse(text);
    } catch (e) {
      console.warn('Edited plan JSON parse failed:', e);
      // Fallback: legacy text plan -> structured shape
      try {
        const legacy = parsePlan(text);
        if (legacy && (legacy.overview || (legacy.days && legacy.days.length))) {
          structuredPlan = {
            overview: legacy.overview || '',
            weeklySchedule: (legacy.days || []).map(d => ({
              day: d.label || '',
              focus: d.type || '',
            })),
            days: legacy.days || [],
            nutritionNotes: '',
            generalNotes: legacy.notes || '',
          };
          planParseError = false;
        } else {
          planParseError = true;
        }
      } catch (fallbackErr) {
        console.warn('Legacy text parse failed for edited plan:', fallbackErr);
        planParseError = true;
      }
    }
    const planData = {
      id: generatedPlan?.id || `plan_${Date.now()}`,
      generatedAt: generatedPlan?.generatedAt || Date.now(),
      userData: generatedPlan?.userData || onboardingData,
      planText: text,
      structuredPlan,
      planParseError,
    };
    setGeneratedPlan(planData);
    const uid = auth.currentUser?.uid;
    if (uid) {
      await AsyncStorage.setItem(`workout_plan_${uid}`, JSON.stringify(planData));
      await AsyncStorage.setItem('@workout_plan', JSON.stringify(planData));
      await setCurrentWorkoutPlan(uid, { rawPlan: text });
    }
    setShowEditPlanModal(false);
    setPdfGenerationError(null);
    setShowRawPlanFallback(false);
    setPdfLocalUri(null);
    setPdfDownloadUrl(null);
    setPlanTitleForPdf('');
  };

  // Build user prompt from onboarding data
  const buildUserPrompt = (data) => {
    return `Create a ${data.daysPerWeek || 5}-day per week personalized workout plan for a client:

CLIENT PROFILE:
- Age: ${data.age || "Not specified"}
- Experience: ${data.fitnessLevel || "Beginner"}
- Goal: ${data.primaryGoal || "General fitness"}
- Equipment: ${(data.equipmentAccess || []).join(", ") || "Bodyweight only"}
- Environment: ${data.trainingEnvironment || "Gym"}
- Session Duration: ${data.preferredWorkoutTime || "60 minutes"}
- Injuries/Limitations: ${data.injuries || "None"}
- Exercises to Avoid: ${(data.exercisesDislike || "").trim() || "None"}
- Sleep: ${data.sleepQuality || "7-8 hours"}
- Stress Level: ${data.currentStressLevel || "Moderate"}

Generate the complete 7-day JSON plan NOW. Return ONLY JSON.`;
  };

  const parseWorkoutPlan = (responseText) => {
    let parsed = null;

    try {
      parsed = JSON.parse(responseText);
    } catch (e1) {
      try {
        const jsonMatch = String(responseText || '').match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON object found in response');
        }
      } catch (e2) {
        throw new Error(`Failed to parse workout plan: ${e2.message}`);
      }
    }

    const plan = Array.isArray(parsed?.plan) ? parsed.plan : null;
    if (!plan) {
      throw new Error('Invalid structure: missing or invalid "plan" array');
    }
    if (plan.length !== 7) {
      throw new Error(`Expected 7 days, got ${plan.length}`);
    }

    const allowedColors = ["pink", "purple", "cyan", "orange", "green", "gray"];

    const validatedPlan = plan.map((day, idx) => {
      if (!day.day || !day.short || !day.focus) {
        throw new Error(`Day ${idx}: missing required fields (day, short, focus)`);
      }
      if (!allowedColors.includes(day.focusColor)) {
        throw new Error(`Day ${idx}: invalid focusColor "${day.focusColor}"`);
      }

      if (day.rest === true) {
        const rawActivities = Array.isArray(day.recoveryActivities) ? day.recoveryActivities : [];
        const recoveryActivities = rawActivities
          .filter((a) => a && typeof a === 'object' && typeof a.label === 'string' && a.label.trim())
          .map((a) => ({
            label: String(a.label).trim(),
            detail: typeof a.detail === 'string' ? a.detail.trim() : '',
          }));
        const recoveryNote =
          day.recoveryNote || (recoveryActivities.length > 0 ? recoveryActivities.map((a) => a.label).join(' → ') : 'Active recovery day. Focus on mobility and sleep.');
        return {
          day: day.day,
          short: day.short,
          focus: day.focus,
          focusColor: day.focusColor,
          rest: true,
          recoveryNote,
          recoveryActivities,
        };
      }

      if (!Array.isArray(day.exercises) || day.exercises.length === 0) {
        throw new Error(`Day ${idx} (${day.day}): missing exercises array`);
      }

      const exercises = day.exercises.map((ex, exIdx) => {
        if (!ex.name || !ex.sets || !ex.reps || !ex.rest || !ex.muscle) {
          throw new Error(`Day ${idx} Exercise ${exIdx}: missing required fields`);
        }
        const tips = Array.isArray(ex.tips) ? ex.tips : [];
        return {
          name: ex.name,
          sets: Number(ex.sets),
          reps: String(ex.reps),
          rest: String(ex.rest),
          muscle: String(ex.muscle),
          notes: ex.notes || undefined,
          tips,
          tempo: ex.tempo || undefined,
        };
      });

      return {
        day: day.day,
        short: day.short,
        focus: day.focus,
        focusColor: day.focusColor,
        rest: false,
        exercises,
        warmup: day.warmup || undefined,
        estimatedDuration: day.estimatedDuration || undefined,
      };
    });

    return { success: parsed?.success === true, plan: validatedPlan };
  };

  // Parse plan response into structured data
  const parsePlanResponse = (planText) => {
    const extractSection = (text, sectionName) => {
      const regex = new RegExp(`${sectionName}[\\s\\S]*?(?=\\d+\\.|$)`, 'i');
      const match = text.match(regex);
      return match ? match[0].replace(sectionName, '').trim() : '';
    };

    return {
      overview: extractSection(planText, 'PLAN OVERVIEW') || extractSection(planText, '1\\. PLAN OVERVIEW'),
      schedule: extractSection(planText, 'WEEKLY SCHEDULE') || extractSection(planText, '2\\. WEEKLY SCHEDULE'),
      workouts: extractWorkouts(planText),
      progression: extractSection(planText, 'PROGRESSIVE OVERLOAD') || extractSection(planText, '4\\. PROGRESSIVE OVERLOAD'),
      nutrition: extractSection(planText, 'NUTRITION GUIDANCE') || extractSection(planText, '5\\. NUTRITION GUIDANCE'),
      timeline: extractSection(planText, 'EXPECTED TIMELINE') || extractSection(planText, '6\\. EXPECTED TIMELINE'),
      notes: extractSection(planText, 'IMPORTANT NOTES') || extractSection(planText, '7\\. IMPORTANT NOTES'),
      rawText: planText,
    };
  };

  const cleanSessionName = (name = '') =>
    name.replace(/^\s*\|\s*/, '').replace(/\s*\|\s*$/, '').trim();

  // Extract workouts from text
  const extractWorkouts = (text) => {
    // Simple extraction - look for workout sections
    const workouts = [];
    const workoutRegex = /(?:Workout|Day)\s*\d+[:\-]?\s*([^\n]+)/gi;
    let match;
    
    while ((match = workoutRegex.exec(text)) !== null) {
      workouts.push({
        day: match[1] || 'Day',
        content: text.substring(match.index, match.index + 500), // First 500 chars
      });
    }

    return workouts.length > 0 ? workouts : [{ day: 'Full Body', content: text.substring(0, 1000) }];
  };

  // Format display value: show "Tap to complete" for empty/placeholder values
  const humanizeOnboardingToken = (token) => {
    const key = String(token || '').trim().toLowerCase();
    const labels = {
      full_gym: 'Full Gym',
      home_gym: 'Home Gym',
      dumbbells: 'Dumbbells',
      barbell: 'Barbell',
      machines: 'Machines',
      bands: 'Resistance Bands',
      bodyweight: 'Bodyweight',
      less_than_4: 'Less than 4 cups/day',
      '4_8': '4–8 cups/day',
      more_than_8: 'More than 8 cups/day',
    };
    if (labels[key]) return labels[key];
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatDisplayValue = (raw) => {
    if (raw == null || raw === undefined || raw === '') return null;
    let s = String(raw).trim();
    if (!s) return null;
    if (s === 'Not set' || s === 'None selected' || s === 'None reported' || s === 'Not provided') return null;
    if (s === 'undefined' || s.toLowerCase() === 'undefined') return null;
    if (/^N\/A,\s*N\/Ayrs,\s*N\/Albs,\s*0'0"$/i.test(s)) return null;
    if (/^0\s*days\s*per\s*week$/i.test(s)) return null;
    if (s.includes('_') && (s.includes(',') || /^[a-z0-9_]+$/i.test(s))) {
      s = s
        .split(',')
        .map((part) => humanizeOnboardingToken(part))
        .join(', ');
    } else if (/^[a-z0-9_]+$/i.test(s) && s.includes('_')) {
      s = humanizeOnboardingToken(s);
    }
    return s;
  };

  const renderWorkoutChromeHeader = (options = {}) => (
    <CoachConnectHeader
      title={options.title ?? (hideBottomNav ? '' : 'Workout')}
      skipTopSafeInset={true}
      onBack={options.onBack ?? (hideBottomNav ? onBack : undefined)}
      onProfilePress={onProfilePress}
      onSettingsPress={onSettingsPress}
      showHeaderActions={options.showHeaderActions ?? true}
    />
  );

  if (loading) {
    // Keep the bottom navbar visible so you can see tab highlight transitions.
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#0A0618' : '#F5F3FF' }}>
        {renderWorkoutChromeHeader()}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color="#FF6B9D" />
        </View>
        {!hideBottomNav && (
          <BottomNavBar
            onHomePress={() => (onNavigate ? onNavigate('home') : onBack?.())}
            onProfilePress={() => onNavigate && onNavigate('profile')}
            onPlusPress={() => onNavigate && onNavigate('create')}
            onVoicePress={() => onNavigate && onNavigate('voice')}
            onWorkoutPress={() => onNavigate && onNavigate('workout')}
            onNutritionPress={() => onNavigate && onNavigate('nutrition')}
            onMessagesPress={() => onNavigate && onNavigate('messages')}
            activeTabKey="workout"
          />
        )}
      </SafeAreaView>
    );
  }

  if (!onboardingData && !propPlan) {
    if (trainerRosterEmpty) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#0A0618' : '#F5F3FF' }}>
          {renderWorkoutChromeHeader()}
          <View style={{ flex: 1, paddingHorizontal: 22, justifyContent: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: isDark ? '#FFFFFF' : '#111827', marginBottom: 10 }}>
              Add clients first
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(17,24,39,0.75)', marginBottom: 20 }}>
              The Workout tab uses a client's onboarding and goals as context. Accept people from Client Requests, then select them on Home — their profile appears here.
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => (onNavigate ? onNavigate('home') : onBack?.())}
              style={{ alignSelf: 'flex-start', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 14, backgroundColor: 'rgba(255,107,157,0.2)', borderWidth: 1, borderColor: 'rgba(255,107,157,0.45)' }}
            >
              <Text style={{ color: '#FF6B9D', fontWeight: '800' }}>Go to Home</Text>
            </TouchableOpacity>
          </View>
          {!hideBottomNav && (
            <BottomNavBar
              onHomePress={() => (onNavigate ? onNavigate('home') : onBack?.())}
              onProfilePress={() => onNavigate && onNavigate('profile')}
              onPlusPress={() => onNavigate && onNavigate('create')}
              onVoicePress={() => onNavigate && onNavigate('voice')}
              onWorkoutPress={() => onNavigate && onNavigate('workout')}
              onNutritionPress={() => onNavigate && onNavigate('nutrition')}
              onMessagesPress={() => onNavigate && onNavigate('messages')}
              activeTabKey="workout"
            />
          )}
        </SafeAreaView>
      );
    }
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#0A0618' : '#F5F3FF' }]}>
        <Text style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>No data found</Text>
      </View>
    );
  }

  const rootBg = isDark ? ['#0a0a1a', '#1a0a2e', '#0d1117'] : ['#F5F3FF', '#EDE9FE', '#E9E5FF'];
  const textPrimary = isDark ? '#FFFFFF' : '#1a0a2e';
  const textSecondary = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,10,46,0.6)';
  const stickyCtaVisible =
    aiPrefReady && aiOn && activeTab === 'plans' && !(readOnly || showFullPlan) && !isCoachViewingClientProfile;
  const bottomNavPad = BOTTOM_NAV_BAR_HEIGHT + insets.bottom;
  const stickyCtaBottom = bottomNavPad + 12;
  const stickyCtaExtraScrollPad = stickyCtaVisible ? bottomNavPad + 86 : bottomNavPad + 20;

  // Full-screen viewer mode (no editor UI).
  if (generatedPlan && (readOnly || showFullPlan)) {
    const pdfUrl = generatedPlan?.url || pdfDownloadUrl || collectionViewingPlan?.url || null;
    const structuredRaw = generatedPlan?.structuredPlan || tryParseJsonObject(generatedPlan?.planText);
    const structured = normalizeStructuredPlanForViewer(structuredRaw);
    const overviewText =
      (structured?.overview && String(structured.overview).trim()) ||
      (structuredRaw?.overview && String(structuredRaw.overview).trim()) ||
      (generatedPlan?.planOverview && String(generatedPlan.planOverview).trim()) ||
      "";

    const planViewerWeeks = (() => {
      const n = Number(structuredRaw?.weeksRemaining ?? structuredRaw?.durationWeeks ?? structured?.weeksRemaining);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 4;
    })();
    const planViewerFocus =
      String(structuredRaw?.programFocus ?? structuredRaw?.focus ?? structured?.focus ?? '').trim() ||
      'Complete muscle building program';
    const planHeroTitle =
      String(structuredRaw?.planTitle ?? structured?.planTitle ?? generatedPlan?.planTitle ?? '').trim() ||
      'Your Workout Plan';

    const routeWorkoutPlan = route?.params?.workoutPlan;
    const hasRouteWorkoutPlanParam = !!(route?.params && Object.prototype.hasOwnProperty.call(route.params, 'workoutPlan'));
    const workoutPlanRows = (() => {
      if (Array.isArray(routeWorkoutPlan) && routeWorkoutPlan.length > 0) {
        const normalized = routeWorkoutPlan
          .map((item, i) => normalizeRouteWorkoutPlanItem(item, i))
          .filter(Boolean);
        if (normalized.length > 0) return normalized;
      }
      if (Array.isArray(structuredRaw?.workoutPlan) && structuredRaw.workoutPlan.length > 0) {
        const normalized = structuredRaw.workoutPlan
          .map((item, i) => normalizeRouteWorkoutPlanItem(item, i))
          .filter(Boolean);
        if (normalized.length > 0) return normalized;
      }
      // NEW Claude schema: { success: true, plan: [...] }
      if (Array.isArray(structuredRaw?.plan) && structuredRaw.plan.length > 0) {
        const normalized = structuredRaw.plan
          .map((item, i) => normalizeRouteWorkoutPlanItem(item, i))
          .filter(Boolean);
        if (normalized.length > 0) return normalized;
      }
      return mapStructuredDaysToPlanViewerRows(structured);
    })();

    const planTextRaw = generatedPlan?.planText;
    const hasPlanText = !!(planTextRaw && String(planTextRaw).trim());
    const looksLikeJson = /^\s*[\[{]/.test(String(planTextRaw || ''));
    const showMarkdownBody =
      workoutPlanRows.length === 0 && hasPlanText && !structuredPlanHasViewerContent(structured) && !looksLikeJson;
    const viewerStructureError =
      (hasRouteWorkoutPlanParam && (!Array.isArray(routeWorkoutPlan) || routeWorkoutPlan.length === 0)) ||
      (workoutPlanRows.length === 0 && (!hasPlanText || looksLikeJson));
    const viewerEmpty = workoutPlanRows.length === 0 && !showMarkdownBody && !viewerStructureError;

    const pvBg = isDark ? '#0A0A0F' : '#F5F5F5';
    const surface = isDark ? '#13131A' : '#FFFFFF';
    const borderC = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    const text = isDark ? '#FFFFFF' : '#0A0A0F';
    const muted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(10,10,15,0.6)';
    const glass = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

    if (isGenerating && readOnly) {
      return (
        <View style={[styles.container, { flex: 1, backgroundColor: pvBg }]}>
          <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} edges={['top']}>
            <ActivityIndicator size="large" color={PLAN_BUILDER_COLORS.pink} />
            <Text style={[planViewerRefStyles.loaderText, { color: text }]}>Generating your workout plan...</Text>
          </SafeAreaView>
        </View>
      );
    }

    if (viewerStructureError) {
      if (readOnly && !viewerErrorDelayElapsed) {
        return (
          <View style={[styles.container, { flex: 1, backgroundColor: pvBg }]}>
            <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} edges={['top']}>
              <ActivityIndicator size="large" color={PLAN_BUILDER_COLORS.pink} />
              <Text style={[planViewerRefStyles.loaderText, { color: text }]}>Loading your workout plan...</Text>
            </SafeAreaView>
          </View>
        );
      }
      return (
        <View style={[styles.container, { flex: 1, backgroundColor: pvBg }]}>
          <SafeAreaView style={{ flex: 1 }} edges={['top']}>
            <View style={planViewerRefStyles.errorContainer}>
              <MaterialCommunityIcons name="alert-circle" size={48} color={PLAN_BUILDER_COLORS.pink} />
              <Text style={[planViewerRefStyles.errorTitle, { color: text }]}>Error</Text>
              <Text style={[planViewerRefStyles.errorMessage, { color: muted }]}>
                {hasRouteWorkoutPlanParam ? 'Invalid workout plan structure received' : 'No workout plan provided'}
              </Text>
              <TouchableOpacity
                onPress={() => onBack?.()}
                style={[planViewerRefStyles.errorButton, { backgroundColor: PLAN_BUILDER_COLORS.pink }]}
              >
                <Text style={planViewerRefStyles.errorButtonText}>Go Back</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      );
    }

    if (viewerEmpty) {
      return (
        <View style={[styles.container, { flex: 1, backgroundColor: pvBg }]}>
          <SafeAreaView style={{ flex: 1 }} edges={['top']}>
            <View style={[planViewerRefStyles.emptyContainer, { backgroundColor: surface }]}>
              <Ionicons name="fitness" size={48} color={PLAN_BUILDER_COLORS.cyan} />
              <Text style={[planViewerRefStyles.emptyTitle, { color: text }]}>No Plan Yet</Text>
              <Text style={[planViewerRefStyles.emptyMessage, { color: muted }]}>
                Generate a workout plan from the home screen
              </Text>
              <TouchableOpacity
                onPress={() => onBack?.()}
                style={[planViewerRefStyles.emptyButton, { backgroundColor: PLAN_BUILDER_COLORS.cyan }]}
              >
                <Text style={planViewerRefStyles.emptyButtonText}>Go Back</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      );
    }

    return (
      <View style={{ flex: 1, backgroundColor: pvBg }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
          <CoachConnectHeader
            title="Weekly Plan"
            isDark={isDark}
            skipTopSafeInset
            onBack={() => { if (readOnly) { onBack?.(); } else { setShowFullPlan(false); } }}
          />
          <PlanViewerScreen
            route={{
              params: {
                workoutPlan: workoutPlanRows,
                overview: overviewText,
                isDarkOverride: isDark,
                weeksRemaining: planViewerWeeks,
                focusSummary: planViewerFocus,
                planHeroTitle: planHeroTitle,
              },
            }}
          />
          <WorkoutPlanPdfViewerModal
            visible={showPdfViewer}
            pdfLocalUri={pdfLocalUri}
            pdfDownloadUrl={collectionViewingPlan ? collectionViewingPlan.url : pdfDownloadUrl}
            planTitle={collectionViewingPlan ? collectionViewingPlan.planTitle : planTitleForPdf}
            isDark={isDark}
            onClose={() => {
              setShowPdfViewer(false);
              setCollectionViewingPlan(null);
            }}
          />
          {!readOnly && generatedPlan && (
            <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={handleAddToCollection}
                disabled={addedToCollection || savingToCollection}
                style={{ borderRadius: 16, overflow: 'hidden', opacity: addedToCollection ? 0.7 : 1 }}
              >
                <LinearGradient
                  colors={addedToCollection ? ['#10B981', '#059669'] : ['#BE185D', '#C2410C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, borderRadius: 16 }}
                >
                  {savingToCollection ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name={addedToCollection ? 'checkmark-circle' : 'bookmark-outline'} size={18} color="#FFFFFF" />
                  )}
                  <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>
                    {addedToCollection ? 'Saved to Library' : 'Save to Library'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
        <BottomNavBar
          onHomePress={() => (onNavigate ? onNavigate('home') : onBack?.())}
          onProfilePress={() => onNavigate && onNavigate('profile')}
          onPlusPress={() => onNavigate && onNavigate('create')}
          onVoicePress={() => onNavigate && onNavigate('voice')}
          onNutritionPress={() => onNavigate && onNavigate('nutrition')}
          onWorkoutPress={() => onNavigate && onNavigate('workout')}
          onMessagesPress={() => onNavigate && onNavigate('messages')}
          activeTabKey="workout"
        />
      </View>
    );
  }

  if (!onboardingData) {
    return (
      <View style={[styles.container, { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#0A0618' : '#F5F3FF' }]}>
        <ActivityIndicator size="large" color="#FF6B9D" />
      </View>
    );
  }

  const planBuilderBg = isDark ? PLAN_BUILDER_COLORS.bgDark : PLAN_BUILDER_COLORS.bgLight;
  const planBuilderCardBg = isDark ? PLAN_BUILDER_COLORS.cardDark : PLAN_BUILDER_COLORS.cardLight;
  const planBuilderText = isDark ? '#FFFFFF' : '#0A0A0F';
  const planBuilderMuted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(10,10,15,0.58)';
  const planBuilderDivider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,15,0.08)';
  const planBuilderSectionLabelColor = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(10,10,15,0.38)';
  const planBuilderSecondaryRing = isDark
    ? ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.06)']
    : ['rgba(190,24,93,0.38)', 'rgba(194,65,12,0.28)'];

  const lovableText = planBuilderText;
  const lovableMuted = planBuilderMuted;
  const lovableSubtle = isDark ? 'rgba(255,255,255,0.62)' : 'rgba(10,10,15,0.52)';

  // IMPORTANT: no hooks here (this code runs after an early return when onboardingData is null).
  // Using useCallback/useMemo here would change hook order between renders.
  const displayForFieldKey = (fieldKey) => {
    const raw = getWorkoutBuilderFieldRawDisplay(fieldKey, onboardingData);
    const formatted = formatDisplayValue(raw);
    const s = formatted != null ? String(formatted).trim() : '';
    return s && s !== 'null' && s !== 'undefined' ? s : '—';
  };

  const userNameForHero = String(
    onboardingData?.firstName ||
      onboardingData?.name ||
      onboardingData?.displayName ||
      auth.currentUser?.displayName ||
      '',
  )
    .split(' ')[0]
    .trim();

  const heroGoal = displayForFieldKey('goal');
  const heroLevel = displayForFieldKey('fitnessLevel');
  const heroPersonal = displayForFieldKey('personalInfo');
  const profileCardSectionLabels = getProfileCardSectionLabels(onboardingData);
  const profileCardPillText =
    profileCardSectionLabels.length > 0
      ? profileCardSectionLabels.join(' · ')
      : 'Onboarding answers';
  const heroGreeting = (() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'Good morning';
    if (h >= 12 && h < 17) return 'Good afternoon';
    if (h >= 17 && h < 22) return 'Good evening';
    return 'Welcome back';
  })();

  const renderPlanBuilderRow = (fieldKey, sectionKeys, idxInSection) => {
    const meta = WORKOUT_BUILDER_ROW_META[fieldKey];
    if (!meta) return null;
    const raw = getWorkoutBuilderFieldRawDisplay(fieldKey, onboardingData);
    const formatted = formatDisplayValue(raw);
    const displayValue = formatted != null && String(formatted).trim() !== '' ? String(formatted) : '';
    const expanded = expandedCard === fieldKey;
    const hasError = validationErrors[fieldKey];
    const shakeAnim = shakeAnimations.current[fieldKey] || new Animated.Value(0);
    const profileIconId = PROFILE_FIELD_ICON_ID[fieldKey];
    const iconEl = profileIconId ? (
      <ProfileCardIcon
        itemId={profileIconId}
        onboardingData={onboardingData}
        size={34}
        fallbackIcon={meta.iconLib === 'mci' ? meta.icon : meta.icon}
      />
    ) : meta.iconLib === 'mci' ? (
      <MaterialCommunityIcons name={meta.icon} size={22} color={meta.color} />
    ) : (
      <Ionicons name={meta.icon} size={22} color={meta.color} />
    );
    return (
      <Animated.View
        key={fieldKey}
        style={[
          { borderBottomWidth: idxInSection < sectionKeys.length - 1 ? 1 : 0, borderBottomColor: planBuilderDivider },
          hasError ? { backgroundColor: 'rgba(239,68,68,0.1)' } : null,
          { transform: [{ translateX: shakeAnim }] },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            if (isCoachViewingClientProfile) {
              Alert.alert(
                'View only',
                'Profile fields are edited by the client. You can review their data here for context.'
              );
              return;
            }
            setExpandedCard(expanded ? null : fieldKey);
          }}
        >
          <PlanBuilderRow
            icon={iconEl}
            label={meta.label}
            value={displayValue}
            placeholder={meta.placeholder}
            textColor={planBuilderText}
            mutedColor={planBuilderMuted}
            dividerColor="transparent"
            isLast
            multiline={meta.multiline}
          />
        </TouchableOpacity>
        {expanded ? (
          <View
            style={{
              paddingHorizontal: 16,
              paddingBottom: 16,
              paddingTop: 8,
              borderTopWidth: 1,
              borderTopColor: planBuilderDivider,
            }}
          >
            <WorkoutPlanBuilderFieldEditBody
              fieldKey={fieldKey}
              onboardingData={onboardingData}
              setOnboardingData={setOnboardingData}
              validationErrors={validationErrors}
              setValidationErrors={setValidationErrors}
              isDark={isDark}
              styles={styles}
            />
            <LinearGradient
              colors={['#FF6B9D', '#64D2FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.doneButton, { overflow: 'hidden' }]}
            >
              <TouchableOpacity
                onPress={() => {
                  setExpandedCard(null);
                  saveData(onboardingData);
                }}
                activeOpacity={0.85}
                style={{ alignItems: 'center', width: '100%' }}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        ) : null}
      </Animated.View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: planBuilderBg }]}>
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {renderWorkoutChromeHeader(
        hideBottomNav
          ? {
              onBack: () => {
                if (isGenerating) {
                  console.log(
                    'Workout plan: leaving screen — generation continues in background; you will get',
                    'a notification when finished if you are not on this screen or the app is in background.',
                  );
                }
                onBack?.();
              },
            }
          : {},
      )}

      {isGenerating && (
        <View
          style={[
            styles.generatingInlineBanner,
            {
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
              backgroundColor: isDark ? 'rgba(255,107,157,0.14)' : 'rgba(100,210,255,0.12)',
            },
          ]}
        >
          <ActivityIndicator size="small" color={isDark ? '#64D2FF' : '#FF6B9D'} />
          <View style={styles.generatingInlineBannerTextCol}>
            <Text style={[styles.generatingInlineBannerTitle, { color: textPrimary }]}>Building your plan</Text>
            <Text style={[styles.generatingInlineBannerSub, { color: textSecondary }]} numberOfLines={3}>
              {GENERATING_MESSAGES[generatingMessageIndex]}
              {'\n'}
              You can go back or use other tabs. We save your plan and notify you when it is ready.
            </Text>
          </View>
        </View>
      )}

      <View
        style={[
          styles.tabBar,
          { borderBottomColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' },
        ]}
      >
        <TouchableOpacity
          onPress={() => setActiveTab('plans')}
          activeOpacity={0.75}
          style={styles.tabButton}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === 'plans'
                    ? '#FF6B9D'
                    : isDark
                      ? 'rgba(255,255,255,0.5)'
                      : 'rgba(10,10,15,0.55)',
              },
              activeTab === 'plans' ? styles.tabTextActive : null,
            ]}
          >
            Workout Plans
          </Text>
          <View
            style={[
              styles.tabIndicator,
              { backgroundColor: activeTab === 'plans' ? '#FF6B9D' : 'transparent' },
            ]}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('library')}
          activeOpacity={0.75}
          style={styles.tabButton}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === 'library'
                    ? '#FF6B9D'
                    : isDark
                      ? 'rgba(255,255,255,0.5)'
                      : 'rgba(10,10,15,0.55)',
              },
              activeTab === 'library' ? styles.tabTextActive : null,
            ]}
          >
            Exercise Library
          </Text>
          <View
            style={[
              styles.tabIndicator,
              { backgroundColor: activeTab === 'library' ? '#FF6B9D' : 'transparent' },
            ]}
          />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, minHeight: 0, position: 'relative' }}>
      {activeTab === 'plans' ? (
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={{
            paddingTop: 14,
            paddingBottom: 32 + insets.bottom + stickyCtaExtraScrollPad,
            paddingHorizontal: 0,
          }}
          showsVerticalScrollIndicator={false}
        >
        {isCoachViewingClientProfile ? (
          <CoachViewContextBanner
            isDark={isDark}
            clientName={viewingClientName}
            textColor={textPrimary}
            mutedColor={planBuilderMuted}
          />
        ) : null}
        {!aiPrefReady ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 18 }}>
            <View
              style={{
                borderRadius: 18,
                borderWidth: 1,
                borderColor: planBuilderDivider,
                backgroundColor: planBuilderCardBg,
                padding: 18,
                alignItems: 'center',
              }}
            >
              <ActivityIndicator size="small" color={isDark ? '#FFFFFF' : '#111827'} />
              <Text style={{ marginTop: 10, fontSize: 13, color: planBuilderMuted, textAlign: 'center' }}>
                Loading AI settings…
              </Text>
            </View>
          </View>
        ) : !aiOn ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 18 }}>
            <View
              style={{
                borderRadius: 18,
                borderWidth: 1,
                borderColor: planBuilderDivider,
                backgroundColor: planBuilderCardBg,
                padding: 18,
              }}
            >
              {isCoachViewingClientProfile ? (
                <>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: planBuilderText, marginBottom: 8, textAlign: 'center' }}>
                    AI is off (your account)
                  </Text>
                  <Text style={{ fontSize: 14, lineHeight: 20, color: planBuilderMuted, textAlign: 'center' }}>
                    Scroll down to review this client's onboarding context. To assign AI plans they receive in-app, use Home → select them → Quick actions → AI Workouts. You can turn AI on for your trainer account in Settings if you want to experiment here.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: planBuilderText, marginBottom: 8, textAlign: 'center' }}>
                    Workout Plans (Trainer)
                  </Text>
                  <Text style={{ fontSize: 14, lineHeight: 20, color: planBuilderMuted, textAlign: 'center' }}>
                    AI is disabled. Send a workout plan request to your trainer — it shows up in their Client Requests inbox, not Messages.
                  </Text>

                  {!resolvedTrainerId ? (
                    <View style={{ marginTop: 18 }}>
                      <Text style={{ fontSize: 16, fontWeight: '900', color: planBuilderText, marginBottom: 6, textAlign: 'center' }}>
                        You need a trainer first
                      </Text>
                      <Text style={{ fontSize: 13, lineHeight: 18, color: planBuilderMuted, textAlign: 'center' }}>
                        Connect with a trainer to receive custom workout plans, or enable AI features in Settings.
                      </Text>

                      <View style={{ marginTop: 14, gap: 10 }}>
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => onNavigate?.('settings')}
                          style={{ height: 54, borderRadius: 16, overflow: 'hidden' }}
                        >
                          <LinearGradient
                            colors={['#FF6B9D', '#7C3AED']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>Enable AI Features</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => onNavigate?.('home')}
                          style={{
                            height: 54,
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: planBuilderDivider,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                          }}
                        >
                          <Text style={{ color: planBuilderText, fontWeight: '900' }}>Go Home</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={{ marginTop: 18 }}>
                      <Text style={{ fontSize: 16, fontWeight: '900', color: planBuilderText, marginBottom: 10 }}>
                        Request a custom workout plan
                      </Text>
                      <TextInput
                        value={requestText}
                        onChangeText={setRequestText}
                        placeholder="Tell your trainer what you want…"
                        placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(17,24,39,0.45)'}
                        multiline
                        style={{
                          minHeight: 120,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: planBuilderDivider,
                          padding: 14,
                          color: planBuilderText,
                          backgroundColor: isDark ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.75)',
                          textAlignVertical: 'top',
                        }}
                      />

                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={handleSendTrainerRequest}
                        disabled={sendingRequest}
                        style={{ marginTop: 12, height: 54, borderRadius: 16, overflow: 'hidden', opacity: sendingRequest ? 0.7 : 1 }}
                      >
                        <LinearGradient
                          colors={['#FF6B9D', '#7C3AED']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 }}
                        >
                          {sendingRequest ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="paper-plane-outline" size={18} color="#FFFFFF" />}
                          <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>Send to Client Requests</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        ) : null}

        {aiPrefReady && aiOn ? (
        <>
        {/* Hero + primary actions */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
          <LinearGradient
            colors={['#BE185D', '#C2410C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 24, padding: 2 }}
          >
            <View
              style={{
                borderRadius: 22,
                padding: 18,
                minHeight: 210,
                flexDirection: 'row',
                backgroundColor: isDark ? '#0A0A0F' : '#FFFFFF',
              }}
            >
              <View style={{ flex: 1.35, paddingRight: 12, justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: lovableText }}>
                  {`${heroGreeting}${userNameForHero ? `, ${userNameForHero}` : ''}!`}
                </Text>

                <View style={{ marginTop: 10 }}>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '900',
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                      color: lovableMuted,
                    }}
                  >
                    Welcome to
                  </Text>
                  <View style={{ width: 44, height: 2, borderRadius: 1, backgroundColor: '#FF6B9D', marginTop: 6 }} />
                </View>

                <Text style={{ fontSize: 34, fontWeight: '900', color: lovableText, marginTop: 10 }} numberOfLines={1}>
                  {heroGoal === '—' ? 'Build Muscle' : heroGoal}
                </Text>

                <Text style={{ fontSize: 13, fontWeight: '700', color: lovableMuted, marginTop: 8 }}>
                  {heroLevel === '—' ? 'Intermediate' : heroLevel}
                  {heroPersonal !== '—' ? ` • ${heroPersonal}` : ''}
                </Text>

                {/* Removed fake quote block */}
              </View>

              <View style={{ flex: 0.65, justifyContent: 'center', alignItems: 'center' }}>
                <View
                  style={{
                    width: 118,
                    height: 118,
                    borderRadius: 59,
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <MaterialCommunityIcons name="trophy" size={60} color="#FF6B9D" />
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
          <View
            style={{
              borderRadius: 18,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
              padding: 14,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={handleRegeneratePlan}
                disabled={isGenerating}
                style={{
                  width: '48.8%',
                  height: 50,
                  borderRadius: 16,
                  overflow: 'hidden',
                  opacity: isGenerating ? 0.7 : 1,
                }}
              >
                <LinearGradient
                  colors={['#BE185D', '#C2410C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ flex: 1, padding: 1.5, borderRadius: 16 }}
                >
                  <View
                    style={{
                      flex: 1,
                      borderRadius: 14.5,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'row',
                      backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
                    }}
                  >
                    {isGenerating ? (
                      <ActivityIndicator size="small" color={isDark ? '#FFFFFF' : '#0A0A0F'} />
                    ) : (
                      <Ionicons name="refresh-outline" size={16} color={isDark ? '#FFFFFF' : '#0A0A0F'} />
                    )}
                    <View style={{ width: 8 }} />
                    <Text style={{ color: isDark ? '#FFFFFF' : '#0A0A0F', fontWeight: '900' }}>Regenerate</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.92}
                onPress={handleAddToCollection}
                disabled={addedToCollection || savingToCollection}
                style={{
                  width: '48.8%',
                  height: 50,
                  borderRadius: 16,
                  overflow: 'hidden',
                  opacity: addedToCollection ? 0.7 : 1,
                }}
              >
                <LinearGradient
                  colors={
                    addedToCollection
                      ? isDark
                        ? ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.10)']
                        : ['rgba(16,185,129,0.55)', 'rgba(5,150,105,0.4)']
                      : planBuilderSecondaryRing
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ flex: 1, padding: 1.5, borderRadius: 16 }}
                >
                  <View
                    style={{
                      flex: 1,
                      borderRadius: 14.5,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'row',
                      backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
                    }}
                  >
                    {savingToCollection ? (
                      <ActivityIndicator size="small" color={planBuilderText} />
                    ) : (
                      <Ionicons
                        name={addedToCollection ? 'checkmark-circle-outline' : 'bookmark-outline'}
                        size={16}
                        color={planBuilderText}
                      />
                    )}
                    <View style={{ width: 8 }} />
                    <Text style={{ color: planBuilderText, fontWeight: '900' }}>
                      {addedToCollection ? 'Saved' : 'Save'}
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {generationError ? (
          <View style={[styles.generationErrorBanner, { marginHorizontal: 16, marginBottom: 16 }]}>
            <Ionicons name="warning" size={20} color="#F59E0B" />
            <Text style={[styles.generationErrorText, { color: planBuilderText }]}>{generationError}</Text>
            <TouchableOpacity
              onPress={() => {
                setGenerationError(null);
                generateWorkoutPlan();
              }}
              style={styles.generationErrorRetry}
            >
              <Text style={[styles.generationErrorRetryText, { color: isDark ? '#FFF' : '#1a0a2e' }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        </>
        ) : null}

        {/* Profile pills — always visible (coach review + client edits), not gated on AI */}
        <View style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 12, alignItems: 'center' }}>
          <Text
            style={{
              fontSize: 10,
              fontWeight: '900',
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              color: isDark ? 'rgba(233,213,255,0.72)' : 'rgba(109,40,217,0.75)',
              textAlign: 'center',
            }}
          >
            Onboarding snapshot
          </Text>
          <Text
            style={{
              fontSize: 22,
              fontWeight: '900',
              color: lovableText,
              marginTop: 6,
              textAlign: 'center',
              letterSpacing: -0.3,
            }}
          >
            Profile Cards
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: lovableMuted,
              lineHeight: 19,
              textAlign: 'center',
              marginTop: 8,
              maxWidth: 320,
            }}
          >
            {isCoachViewingClientProfile
              ? 'Only fields they answered during onboarding appear below.'
              : 'Only your onboarding answers appear here — tap a card to edit.'}
          </Text>

          {profileCardSectionLabels.length > 0 ? (
            <LinearGradient
              colors={['#9333EA', '#DB2777']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ borderRadius: 999, padding: 1, marginTop: 14 }}
            >
              <View
                style={{
                  borderRadius: 999,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  backgroundColor: isDark ? 'rgba(10,8,18,0.96)' : 'rgba(255,255,255,0.98)',
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '800',
                    color: isDark ? 'rgba(255,255,255,0.78)' : 'rgba(15,23,42,0.72)',
                    letterSpacing: 0.3,
                    textAlign: 'center',
                  }}
                >
                  {profileCardPillText}
                </Text>
              </View>
            </LinearGradient>
          ) : null}

          <View
            style={{
              marginTop: 18,
              width: '100%',
              height: StyleSheet.hairlineWidth,
              backgroundColor: planBuilderDivider,
            }}
          />
        </View>

          {(() => {
            // Deterministic 2-col grid: avoids `gap` / % width layout quirks that can stack-left.
            const SIDE_PAD = 20; // matches outer container paddingHorizontal
            const GRID_GAP = 14;
            const screenW = Dimensions.get('window')?.width || 390;
            const usableW = Math.max(280, screenW - SIDE_PAD * 2);
            const gridCardW = Math.floor((usableW - GRID_GAP) / 2);

            const heightText = formatProfileHeightDisplay(onboardingData?.height);

            const weightText =
              onboardingData?.weight != null && onboardingData?.weight !== '' ? `${onboardingData.weight} lbs` : '—';

            const ageText =
              onboardingData?.age != null && onboardingData?.age !== '' ? String(onboardingData.age) : '—';

            const genderText = onboardingData?.gender ? String(onboardingData.gender) : '—';

            const journeyPreviewRaw = String(onboardingData?.situationDescription || '')
              .replace(/\s+/g, ' ')
              .trim();
            const journeyPreview = journeyPreviewRaw.length ? journeyPreviewRaw : 'Tap to add your journey text…';

            const sections = [
              {
                title: 'Personal Info',
                items: [
                  { id: 'age', label: 'Age', helper: 'personal info', icon: 'person-outline', value: ageText, editKey: 'personalInfo' },
                  { id: 'gender', label: 'Gender', helper: 'profile', icon: 'person-outline', value: genderText, editKey: 'personalInfo' },
                  { id: 'height', label: 'Height', helper: 'personal info', icon: 'stats-chart-outline', value: heightText, editKey: 'personalInfo' },
                  { id: 'weight', label: 'Weight', helper: 'current weight', icon: 'stats-chart-outline', value: weightText, editKey: 'personalInfo' },
                ],
              },
              {
                title: 'Training Setup',
                items: [
                  { id: 'fitnessLevel', label: 'Level', helper: 'training status', icon: 'flame-outline', value: displayForFieldKey('fitnessLevel'), editKey: 'fitnessLevel' },
                  { id: 'goal', label: 'Goal', helper: 'primary goal', icon: 'trophy-outline', value: displayForFieldKey('goal'), editKey: 'goal' },
                  { id: 'equipment', label: 'Equipment', helper: 'available tools', icon: 'barbell-outline', value: displayForFieldKey('equipment'), editKey: 'equipment' },
                  { id: 'frequency', label: 'Frequency', helper: 'weekly sessions', icon: 'calendar-outline', value: displayForFieldKey('frequency'), editKey: 'frequency' },
                  { id: 'trainingEnvironment', label: 'Environment', helper: 'training place', icon: 'navigate-outline', value: displayForFieldKey('trainingEnvironment'), editKey: 'trainingEnvironment' },
                  { id: 'preferredWorkoutTime', label: 'Workout time', helper: 'preferred time', icon: 'time-outline', value: displayForFieldKey('preferredWorkoutTime'), editKey: 'preferredWorkoutTime' },
                ],
              },
              {
                title: 'Recovery & Extras',
                items: [
                  { id: 'exercisesDislike', label: 'Avoid', helper: 'exercise dislikes', icon: 'close-circle-outline', value: displayForFieldKey('exercisesDislike'), editKey: 'exercisesDislike' },
                  { id: 'injuries', label: 'Injuries', helper: 'limitations', icon: 'heart-outline', value: displayForFieldKey('injuries'), editKey: 'injuries' },
                  { id: 'supplements', label: 'Supplements', helper: 'currently taking', icon: 'star-outline', value: displayForFieldKey('supplementsCurrentlyTaking'), editKey: 'supplementsCurrentlyTaking' },
                  { id: 'stress', label: 'Stress', helper: 'current level', icon: 'water-outline', value: displayForFieldKey('currentStressLevel'), editKey: 'currentStressLevel' },
                  { id: 'sleep', label: 'Sleep', helper: 'sleep quality', icon: 'moon-outline', value: displayForFieldKey('sleepQuality'), editKey: 'sleepQuality' },
                  { id: 'energy', label: 'Energy', helper: 'daily energy', icon: 'battery-charging-outline', value: displayForFieldKey('energyLevels'), editKey: 'energyLevels' },
                  { id: 'hydration', label: 'Hydration', helper: 'water habits', icon: 'water-outline', value: displayForFieldKey('hydrationHabits'), editKey: 'hydrationHabits', fullWidth: true },
                  { id: 'journey', label: 'My Journey', helper: 'tap to expand', icon: 'document-text-outline', value: journeyPreview, editKey: 'situationDescription', wide: true },
                ],
              },
            ];

            const visibleSections = filterProfileCardSections(sections, onboardingData);

            const SectionHeader = ({ text }) => (
              <View style={{ marginTop: 20, marginBottom: 12 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '900',
                    letterSpacing: 1.1,
                    textTransform: 'uppercase',
                    color: lovableMuted,
                  }}
                >
                  {text}
                </Text>
                <View style={{ marginTop: 10, height: 1, backgroundColor: planBuilderDivider }} />
              </View>
            );

            const PillCard = ({ item, accent }) => {
              const isJourney = item.wide === true;
              const isFullWidth = item.fullWidth === true || isJourney;
              const cellStyle = isFullWidth ? { width: usableW, alignSelf: 'center' } : { width: gridCardW };
              const cardBg = isDark ? '#13131A' : '#FFFFFF';
              const isEditable = !isCoachViewingClientProfile;
              const pillColors = ['#6D28D9', '#C2410C'];
              const pillText = isEditable ? 'Tap to edit' : 'Read only';
              const pillTextColor = '#FFFFFF';

              // Special "My Journey" layout (full width, taller, horizontal, preview)
              if (isJourney) {
                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.9}
                    onPress={() => setEditingPillKey(item.editKey)}
                    disabled={!isEditable}
                    style={[cellStyle, { marginTop: 10, marginBottom: 6 }]}
                  >
                    <View
                      style={{
                        borderRadius: 22,
                        borderWidth: 1,
                        borderColor: planBuilderDivider,
                        backgroundColor: cardBg,
                      }}
                    >
                      <View
                        style={{
                          padding: 16,
                          minHeight: 172,
                          flexDirection: 'row',
                          alignItems: 'flex-start',
                        }}
                      >
                        <View style={{ flex: 1, flexDirection: 'row' }}>
                          <View style={profileCardIconWrapStyle(isDark)}>
                            <ProfileCardIcon itemId={item.id} onboardingData={onboardingData} fallbackIcon={item.icon} />
                          </View>

                          <View style={{ flex: 1, marginLeft: 14 }}>
                            <Text style={{ fontSize: 10, fontWeight: '900', letterSpacing: 0.8, color: lovableMuted, textTransform: 'uppercase' }}>
                              {item.label}
                            </Text>
                            <Text style={{ fontSize: 14, fontWeight: '800', color: lovableText, marginTop: 8 }} numberOfLines={2}>
                              {item.value}
                            </Text>
                            <LinearGradient
                              colors={isEditable ? pillColors : ['rgba(148,163,184,0.45)', 'rgba(148,163,184,0.35)']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={{
                                alignSelf: 'flex-start',
                                marginTop: 12,
                                paddingHorizontal: 12,
                                paddingVertical: 7,
                                borderRadius: 999,
                              }}
                            >
                              <Text style={{ color: pillTextColor, fontSize: 11, fontWeight: '900', letterSpacing: 0.2 }}>
                                {pillText}
                              </Text>
                            </LinearGradient>
                          </View>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }

              // Default pill layout (bigger, vertical, centered)
              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.9}
                  onPress={() => setEditingPillKey(item.editKey)}
                  disabled={!isEditable}
                  style={[cellStyle, { marginBottom: 14 }]}
                >
                  <View
                    style={{
                      borderRadius: 22,
                      borderWidth: 1,
                      borderColor: planBuilderDivider,
                      backgroundColor: cardBg,
                      paddingHorizontal: 16,
                      paddingVertical: 16,
                      minHeight: 138,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                      <View style={{ width: '100%', alignItems: 'center' }}>
                        <View style={profileCardIconWrapStyle(isDark)}>
                          <ProfileCardIcon itemId={item.id} onboardingData={onboardingData} fallbackIcon={item.icon} />
                        </View>

                        <Text style={{ marginTop: 12, fontSize: 9, fontWeight: '800', letterSpacing: 0.9, color: lovableMuted, textTransform: 'uppercase', textAlign: 'center' }}>
                          {item.label}
                        </Text>
                        <Text style={{ marginTop: 8, fontSize: 17, fontWeight: '900', color: lovableText, textAlign: 'center' }} numberOfLines={2}>
                          {item.value}
                        </Text>
                        <Text style={{ marginTop: 8, fontSize: 11, fontWeight: '600', color: lovableSubtle, textAlign: 'center' }} numberOfLines={1}>
                          {item.helper}
                        </Text>

                        <LinearGradient
                          colors={isEditable ? pillColors : ['rgba(148,163,184,0.45)', 'rgba(148,163,184,0.35)']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={{
                            marginTop: 12,
                            paddingHorizontal: 12,
                            paddingVertical: 7,
                            borderRadius: 999,
                          }}
                        >
                          <Text style={{ color: pillTextColor, fontSize: 11, fontWeight: '900', letterSpacing: 0.2 }}>
                            {pillText}
                          </Text>
                        </LinearGradient>
                      </View>
                    </View>
                </TouchableOpacity>
              );
            };

            let globalIdx = 0;

            if (visibleSections.length === 0) {
              return (
                <View
                  style={{
                    marginTop: 8,
                    marginBottom: 16,
                    paddingVertical: 28,
                    paddingHorizontal: 20,
                    alignItems: 'center',
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)',
                  }}
                >
                  <Ionicons name="document-text-outline" size={28} color={lovableMuted} />
                  <Text style={{ color: lovableText, fontSize: 16, fontWeight: '800', marginTop: 12, textAlign: 'center' }}>
                    No onboarding answers yet
                  </Text>
                  <Text style={{ color: lovableMuted, fontSize: 13, lineHeight: 18, marginTop: 6, textAlign: 'center', maxWidth: 280 }}>
                    Cards appear here only for fields this client completed during onboarding.
                  </Text>
                </View>
              );
            }

            return (
              <View style={{ paddingBottom: 10 }}>
                {visibleSections.map((sec) => (
                  <View key={sec.title}>
                    <SectionHeader text={sec.title} />
                    {(() => {
                      const normal = [];
                      const fullWidth = [];
                      const wide = [];
                      for (const it of sec.items) {
                        if (it.wide) wide.push(it);
                        else if (it.fullWidth) fullWidth.push(it);
                        else normal.push(it);
                      }
                      const rows = [];
                      for (let i = 0; i < normal.length; i += 2) rows.push(normal.slice(i, i + 2));

                      return (
                        <View style={{ width: usableW, alignSelf: 'center' }}>
                          {rows.map((pair, rowIdx) => (
                            <View
                              key={`${sec.title}-row-${rowIdx}`}
                              style={{
                                flexDirection: 'row',
                                width: usableW,
                                alignSelf: 'center',
                                justifyContent: pair.length === 2 ? 'space-between' : 'center',
                                marginBottom: GRID_GAP,
                              }}
                            >
                              {pair.map((it) => {
                                const accent = LOVABLE_ACCENTS[globalIdx % LOVABLE_ACCENTS.length];
                                globalIdx += 1;
                                return <PillCard key={it.id} item={it} accent={accent} />;
                              })}
                            </View>
                          ))}

                          {fullWidth.map((it) => {
                            const accent = LOVABLE_ACCENTS[globalIdx % LOVABLE_ACCENTS.length];
                            globalIdx += 1;
                            return <PillCard key={it.id} item={it} accent={accent} />;
                          })}

                          {wide.map((it) => {
                            const accent = LOVABLE_ACCENTS[globalIdx % LOVABLE_ACCENTS.length];
                            globalIdx += 1;
                            return <PillCard key={it.id} item={it} accent={accent} />;
                          })}
                        </View>
                      );
                    })()}
                  </View>
                ))}
              </View>
            );
          })()}
      </ScrollView>
      ) : (
        <WorkoutExerciseLibraryTab
          isDark={isDark}
          onThemeToggle={() => toggleTheme(isDark ? 'light' : 'dark')}
          onboardingData={onboardingData}
        />
      )}
      </View>

      {stickyCtaVisible ? (
        <View pointerEvents="box-none" style={[styles.stickyCtaWrap, { bottom: stickyCtaBottom }]}>
          <View
            style={[
              styles.stickyCtaCard,
              {
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
                backgroundColor: isDark ? 'rgba(10,10,18,0.65)' : 'rgba(255,255,255,0.88)',
              },
            ]}
          >
            {!isCoachViewingClientProfile ? (
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)',
                  textAlign: 'center',
                  marginBottom: 10,
                }}
              >
                {plansUsedThisMonth} of {planGenerationLimit} plans used this month
                {plansRemaining <= 0
                  ? ` · Resets ${formatWorkoutLimitResetLabel(workoutGenUsage?.resets_at)}`
                  : ''}
              </Text>
            ) : null}
            {generatedPlan ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  activeOpacity={0.92}
                  onPress={() => setShowFullPlan(true)}
                  style={{ flex: 1, height: 56, borderRadius: 16, overflow: 'hidden' }}
                >
                  <LinearGradient
                    colors={['#BE185D', '#C2410C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 }}
                  >
                    <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900' }}>Open Plan</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.92}
                  onPress={handleRegeneratePlan}
                  disabled={isGenerating}
                  style={{
                    flex: 1,
                    height: 56,
                    borderRadius: 16,
                    overflow: 'hidden',
                    opacity: isGenerating ? 0.7 : 1,
                  }}
                >
                  <LinearGradient
                    colors={['#BE185D', '#C2410C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ flex: 1, padding: 1.5, borderRadius: 16 }}
                  >
                    <View
                      style={{
                        flex: 1,
                        borderRadius: 14.5,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 10,
                        backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
                        borderWidth: 1,
                        borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
                      }}
                    >
                      <Ionicons name="sparkles" size={18} color={isDark ? '#FFFFFF' : '#0A0A0F'} />
                      <Text style={{ color: isDark ? '#FFFFFF' : '#0A0A0F', fontSize: 16, fontWeight: '900' }}>
                        {isGenerating ? 'Generating…' : 'Generate New'}
                      </Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                <TouchableOpacity
                  activeOpacity={0.92}
                  onPress={() => {
                    if (plansRemaining <= 0) {
                      Alert.alert(
                        'Monthly limit reached',
                        `You've used all your workout generations for this month. Resets ${formatWorkoutLimitResetLabel(workoutGenUsage?.resets_at)}.`,
                      );
                      return;
                    }
                    generateWorkoutPlan();
                  }}
                  disabled={isGenerating}
                  style={{ height: 56, borderRadius: 16, overflow: 'hidden', opacity: isGenerating ? 0.7 : 1 }}
                >
                  <LinearGradient
                    colors={['#BE185D', '#C2410C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 }}
                  >
                    <Ionicons name="sparkles" size={18} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900' }}>
                      {isGenerating ? 'Generating…' : 'Generate Plan'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      ) : null}

      <WorkoutPlanPdfViewerModal
        visible={showPdfViewer}
        pdfLocalUri={collectionViewingPlan ? null : pdfLocalUri}
        pdfDownloadUrl={collectionViewingPlan ? collectionViewingPlan.url : pdfDownloadUrl}
        planTitle={collectionViewingPlan ? collectionViewingPlan.planTitle : (planTitleForPdf || 'Workout Plan')}
        clientName={onboardingData?.name || onboardingData?.firstName || auth.currentUser?.displayName}
        isDark={isDark}
        onClose={() => {
          setShowPdfViewer(false);
          setCollectionViewingPlan(null);
        }}
      />

      <EditModalForm
        visible={!!editingPillKey}
        fieldKey={editingPillKey}
        title={WORKOUT_BUILDER_ROW_META?.[editingPillKey]?.label}
        // Respect theme toggle
        cardBg={isDark ? '#0D1117' : '#FFFFFF'}
        textColor={isDark ? '#FFFFFF' : '#0A0A0F'}
        mutedColor={isDark ? 'rgba(255,255,255,0.55)' : 'rgba(10,10,15,0.55)'}
        borderColor={isDark ? 'rgba(255,255,255,0.12)' : 'rgba(10,10,15,0.12)'}
        doneGradient={['#BE185D', '#C2410C']}
        isDark={isDark}
        onClose={() => setEditingPillKey(null)}
        onDone={() => {
          setEditingPillKey(null);
          saveData(onboardingData);
        }}
      >
        {editingPillKey ? (
          <WorkoutPlanBuilderFieldEditBody
            fieldKey={editingPillKey}
            onboardingData={onboardingData}
            setOnboardingData={setOnboardingData}
            validationErrors={validationErrors}
            setValidationErrors={setValidationErrors}
            isDark={isDark}
            styles={styles}
          />
        ) : null}
      </EditModalForm>

      {/* Edit Plan Modal */}
      <Modal visible={showEditPlanModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.editPlanModalOverlay}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.editPlanModalBackdrop}
            onPress={() => setShowEditPlanModal(false)}
          />
          <View style={styles.editPlanModalContent}>
            <View style={styles.editPlanModalHeader}>
              <Text style={styles.editPlanModalTitle}>Edit plan</Text>
              <TouchableOpacity
                onPress={() => setShowEditPlanModal(false)}
                style={styles.editPlanModalClose}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Markdown preview */}
            <View style={styles.markdownPreviewCard}>
              <Text style={styles.markdownPreviewLabel}>Preview</Text>
              <ScrollView
                style={styles.markdownPreviewScroll}
                contentContainerStyle={styles.markdownPreviewContent}
                showsVerticalScrollIndicator={false}
              >
                <Markdown style={MARKDOWN_STYLES}>
                  {normalizePlanMarkdown(stripEmojis(editPlanText || generatedPlan?.planText || ''))}
                </Markdown>
              </ScrollView>
            </View>

            {/* Raw markdown editor */}
            <Text style={styles.rawEditorLabel}>Raw markdown</Text>
            <TextInput
              style={styles.editPlanModalInput}
              value={editPlanText}
              onChangeText={setEditPlanText}
              placeholder="Paste or edit your workout plan text..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              multiline
              textAlignVertical="top"
            />

            <View style={styles.editPlanModalActions}>
              <TouchableOpacity
                onPress={() => setShowEditPlanModal(false)}
                style={styles.editPlanModalCancelBtn}
              >
                <Text style={styles.editPlanModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveEditedPlan}
                style={styles.editPlanModalSaveBtn}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#FF6B9D', '#64D2FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.editPlanModalSaveGrad}
                >
                  <Text style={styles.editPlanModalSaveText}>Save</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {!hideBottomNav && (
        <BottomNavBar
          onHomePress={() => (onNavigate ? onNavigate('home') : onBack?.())}
          onProfilePress={() => onNavigate && onNavigate('profile')}
          onPlusPress={() => onNavigate && onNavigate('create')}
          onVoicePress={() => onNavigate && onNavigate('voice')}
          onWorkoutPress={() => onNavigate && onNavigate('workout')}
          onNutritionPress={() => onNavigate && onNavigate('nutrition')}
          onMessagesPress={() => onNavigate && onNavigate('messages')}
            activeTabKey="workout"
        />
      )}
    </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  stickyCtaWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 20,
  },
  stickyCtaCard: {
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: 'rgba(10,10,18,0.65)',
    padding: 10,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 8,
    minHeight: 58,
    borderBottomWidth: 1,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  tabTextActive: {
    fontWeight: '800',
  },
  tabIndicator: {
    marginTop: 10,
    width: '72%',
    maxWidth: 200,
    height: 3,
    borderRadius: 2,
  },
  headerWrap: {
    paddingHorizontal: Liquid.spacing.gutter,
    paddingTop: 6,
    paddingBottom: 10,
  },
  pageTitle: {
    marginTop: 12,
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'System',
  },
  pageSeparator: {
    marginTop: 10,
    height: 1,
    width: '100%',
  },
  headerCard: {},
  headerCardInner: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: Liquid.colors.textPrimary,
    fontFamily: 'System',
  },
  headerRight: {
    width: 40,
  },
  chevronText: {
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 10,
  },
  backArrow: {
    fontSize: 22,
    color: Liquid.colors.textPrimary,
    fontWeight: '800',
  },
  forwardArrow: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  openChevron: {
    fontSize: 18,
    color: Liquid.colors.cyan,
    fontWeight: '800',
    marginLeft: 6,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Liquid.spacing.gutter,
    paddingBottom: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: Liquid.spacing.gutter,
    paddingTop: 10,
  },
  sectionHeader: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
    fontFamily: 'System',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'System',
  },
  profileReviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginBottom: 12,
  },
  profileReviewCard: {
    width: '47%',
    minHeight: 110,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  profileReviewCardTouch: {
    flex: 1,
    justifyContent: 'flex-start',
    minHeight: 82,
  },
  profileReviewCardIcon: {
    width: 28,
    height: 28,
    marginBottom: 8,
  },
  profileReviewCategoryLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  profileReviewValueText: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
  },
  profileGridCardExpanded: {
    width: '100%',
    marginBottom: 16,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    padding: 20,
    paddingVertical: 22,
    minHeight: 76,
    marginBottom: 16,
    ...(Platform.OS === 'ios' ? {
      shadowColor: '#FF6B9D',
      shadowRadius: 12,
      shadowOpacity: 0.25,
      shadowOffset: { width: 0, height: 4 },
    } : {
      backgroundColor: 'rgba(255,255,255,0.05)',
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 52,
  },
  cardTextWrap: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  cardIconImage: {
    width: 44,
    height: 44,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'left',
    marginBottom: 2,
    fontFamily: 'System',
  },
  cardValue: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'left',
    fontFamily: 'System',
  },
  cardValuePlaceholder: {
    color: 'rgba(255,255,255,0.45)',
    fontStyle: 'italic',
  },
  cardEditContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  editFields: {
    gap: 16,
  },
  editField: {
    marginBottom: 16,
  },
  editFieldRow: {
    flexDirection: 'row',
    gap: 8,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    fontFamily: 'System',
  },
  editInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    fontFamily: 'System',
  },
  editTextArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    minHeight: 200,
    fontFamily: 'System',
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'right',
    fontFamily: 'System',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'System',
  },
  optionCard: {
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 22,
    marginBottom: 12,
    borderWidth: 1,
  },
  optionCardText: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'System',
  },
  frequencySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  frequencyButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frequencyButtonText: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'System',
  },
  doneButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
  generationSection: {
    marginTop: 32,
    alignItems: 'stretch',
  },
  generationErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  generationErrorText: {
    flex: 1,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    lineHeight: 20,
  },
  generationErrorRetry: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(245,158,11,0.35)',
    borderRadius: 10,
  },
  generationErrorRetryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  generationCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    ...(Platform.OS === 'ios' ? {
      shadowColor: '#64D2FF',
      shadowRadius: 12,
      shadowOpacity: 0.25,
      shadowOffset: { width: 0, height: 4 },
    } : {}),
  },
  generationTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    fontFamily: 'System',
  },
  generationSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'System',
  },
  generateBtnTouch: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    ...(Platform.OS === 'ios' ? {
      shadowColor: '#FF6B9D',
      shadowRadius: 20,
      shadowOpacity: 0.45,
      shadowOffset: { width: 0, height: 8 },
    } : {}),
  },
  generateBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  generateBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: 'System',
  },
  planResultWrap: {
    marginTop: 0,
    marginBottom: 24,
    position: 'relative',
    borderRadius: 24,
    overflow: 'hidden',
  },
  planResultGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
  },
  rawPlanFallbackWrap: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    padding: 16,
  },
  rawPlanFallbackTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  rawPlanFallbackScroll: {
    maxHeight: 320,
    borderRadius: 8,
  },
  rawPlanFallbackContent: {
    paddingRight: 8,
    paddingVertical: 12,
  },
  rawPlanMarkdownWrap: {
    backgroundColor: 'transparent',
  },
  rawPlanFallbackText: {
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.9,
  },
  rawPlanEditBtn: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  rawPlanEditBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  parsedOverviewCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  parsedOverviewTitle: {
    fontSize: 13,
    color: '#8A8A8A',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  parsedOverviewBody: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20.8,
  },
  parsedReadMore: {
    fontSize: 13,
    color: '#64D2FF',
    marginTop: 8,
  },
  parsedRestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  parsedRestLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  parsedRestPill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  parsedRestPillText: {
    fontSize: 11,
    color: '#555',
  },
  parsedWorkoutCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  parsedWorkoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  parsedWorkoutDayLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  parsedWorkoutTypeLabel: {
    fontSize: 12,
    color: '#8A8A8A',
    marginTop: 2,
  },
  parsedTypePill: {
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  parsedTypePillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  parsedExerciseList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  parsedExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  parsedExerciseRowBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  parsedExerciseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  parsedExerciseName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  parsedExerciseMeta: {
    fontSize: 12,
    color: '#8A8A8A',
    marginTop: 2,
  },
  parsedNotesPill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  parsedNotesPillText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
  planResultBadgePlain: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 8,
  },
  planResultBadgeTextPlain: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  planResultCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 20,
    ...(Platform.OS === 'ios' ? {
      shadowColor: '#FF6B9D',
      shadowRadius: 20,
      shadowOpacity: 0.35,
      shadowOffset: { width: 0, height: 8 },
    } : {}),
  },
  planResultHeader: {
    marginBottom: 14,
  },
  planResultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 8,
  },
  planResultBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  planResultTitle: {
    color: Liquid.colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  planOverviewBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderTopWidth: 3,
    borderTopColor: '#FF6B9D',
  },
  planOverviewLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  planOverviewText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    lineHeight: 22,
  },
  planExpandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  planExpandText: {
    color: '#64D2FF',
    fontSize: 13,
    fontWeight: '600',
  },
  planResultSubtitle: {
    color: Liquid.colors.textSecondary,
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  planSessionsWrap: {
    marginBottom: 16,
  },
  planSessionsLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
  },
  planSessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  planSessionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planSessionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  planSessionMore: {
    color: 'rgba(156,163,175,0.9)',
    fontSize: 12,
    marginTop: 4,
  },
  planResultRowActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  planResultRowBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  planResultRowBtnDisabled: {
    opacity: 0.9,
  },
  planResultRowBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  editPlanModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  editPlanModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  editPlanModalContent: {
    backgroundColor: '#1a1520',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  editPlanModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editPlanModalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  editPlanModalClose: {
    padding: 8,
  },
  editPlanModalInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 14,
    color: '#fff',
    fontSize: 15,
    minHeight: 280,
    maxHeight: 400,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  editPlanModalActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  editPlanModalCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  editPlanModalCancelText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '600',
  },
  editPlanModalSaveBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  editPlanModalSaveGrad: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  editPlanModalSaveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  markdownPreviewCard: {
    backgroundColor: 'rgba(15,23,42,0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.6)',
    marginBottom: 14,
    maxHeight: 220,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
  },
  markdownPreviewLabel: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  markdownPreviewScroll: {
    flex: 1,
  },
  markdownPreviewContent: {
    paddingRight: 6,
  },
  rawEditorLabel: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 4,
  },
  resultCard: {
    marginTop: 6,
  },
  resultInner: {
    padding: 14,
  },
  resultTitle: {
    color: Liquid.colors.textPrimary,
    fontWeight: '800',
    fontSize: 16,
  },
  resultSubtitle: {
    color: Liquid.colors.textSecondary,
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
  resultRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultMeta: {
    color: Liquid.colors.textSecondary,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  resultLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 10,
  },
  resultLinkText: {
    color: Liquid.colors.cyan,
    fontWeight: '800',
  },
  generateButton: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 12,
  },
  generateButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  generateButtonIcon: {
    fontSize: 20,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'System',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    width: '100%',
  },
  infoIcon: {
    fontSize: 20,
  },
  infoText: {
    fontSize: 14,
    flex: 1,
    fontFamily: 'System',
  },
  generatingInlineBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: Liquid.spacing.gutter,
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  generatingInlineBannerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  generatingInlineBannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
    fontFamily: 'System',
  },
  generatingInlineBannerSub: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'System',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    paddingHorizontal: Liquid.spacing.gutter,
  },
  aura: {
    ...StyleSheet.absoluteFillObject,
  },
  processingCard: {
    width: '100%',
    maxWidth: 420,
  },
  processingInner: {
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  processingTitle: {
    color: Liquid.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginTop: 2,
  },
  processingSubtitle: {
    color: Liquid.colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  loadingContent: {
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    minWidth: 280,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
    fontFamily: 'System',
  },
  loadingSubtitle: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'System',
  },
});