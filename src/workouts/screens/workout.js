/**
 * Workout Plan Generator Screen
 * Review onboarding data, allow edits, and generate personalized workout plan using DeepSeek API
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Animated,
  StatusBar,
  Platform,
  Modal,
  KeyboardAvoidingView,
  AppState,
  FlatList,
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
import CoachConnectHeader from '../../shared/components/AnatroxHeader';
import WorkoutPlanBuilderFieldEditBody from './workoutPlanBuilderFieldEditBody';
import { saveGeneratedPlanToCollection, getCurrentWorkoutPlan, setCurrentWorkoutPlan } from '../services/workoutService';
import Markdown from 'react-native-markdown-display';
import { useAI } from '../../contexts/AIContext';
import { getOrCreateConversation, sendClientRequest, getUserData } from '../../ai/services/trainerMessaging';
import {
  parsePlanForPdf,
  generateAndSavePlanPdf,
  stripMarkdown,
  stripEmojis,
} from '../services/workoutPlanPdfService';
import WorkoutPlanPdfViewerModal from '../components/WorkoutPlanPdfViewerModal';
import PlanViewerScreen from '../../screens/PlanViewerScreen';
import PlanLimitBanner from '../components/PlanLimitBanner';

/** Survives screen unmount so ClientApp / logs can tell a request is still running */
let workoutPlanGenerationInFlight = false;

const PLAN_LIMIT_TOTAL = 2;
const planLimitMonthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const nextMonthResetDate = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
};

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
  cyan: '#64D2FF',
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
  borderColors = [
    '#E91E63',
    '#FF6B9D',
    '#C084FC',
    '#FF6B9D',
    '#E91E63',
  ],
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

const TYPE_COLORS = { Push: WP.sectionLabel, Pull: '#64D2FF', Legs: WP.startWeight, 'Full Body': '#10B981', Rest: '#555' };

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
  pdfRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  pdfBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  pdfBtnText: { fontWeight: '700', fontSize: 14 },
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
      exercises,
      warmUp: Array.isArray(day?.warmUp) ? day.warmUp : [],
      coolDown: Array.isArray(day?.coolDown) ? day.coolDown : [],
    };
  });
}

function PlanViewerAnimatedBorderCard({ children, radius = 20, bg, restDay = false }) {
  const colors = restDay
    ? ['#374151', '#4B5563', '#6B7280', '#4B5563', '#374151']
    : [
        PLAN_BUILDER_COLORS.pink,
        '#C084FC',
        PLAN_BUILDER_COLORS.cyan,
        PLAN_BUILDER_COLORS.orange,
        PLAN_BUILDER_COLORS.pink,
      ];
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

export default function WorkoutPlanGeneratorScreen({
  userId,
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
  const { aiEnabled, loading: aiPrefLoading, toggleAI } = useAI();
  const aiOn = aiEnabled === true;
  const aiPrefReady = !aiPrefLoading && aiEnabled !== null;

  // State
  const [onboardingData, setOnboardingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [expandedCard, setExpandedCard] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [generatedPlan, setGeneratedPlan] = useState(propPlan || null);
  const [addedToCollection, setAddedToCollection] = useState(false);
  const [savingToCollection, setSavingToCollection] = useState(false);
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

  // Plan generation limit (simple monthly counter, UI only)
  const [plansUsedThisMonth, setPlansUsedThisMonth] = useState(0);
  const plansRemaining = Math.max(0, PLAN_LIMIT_TOTAL - (Number(plansUsedThisMonth) || 0));
  const nextResetDate = useMemo(() => nextMonthResetDate(), []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const key = `planGenUsed_${planLimitMonthKey()}`;
        const raw = await AsyncStorage.getItem(key);
        const n = raw != null ? parseInt(raw, 10) : 0;
        if (mounted) setPlansUsedThisMonth(Number.isFinite(n) ? n : 0);
      } catch (_) {
        if (mounted) setPlansUsedThisMonth(0);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const markPlanGeneratedForLimit = useCallback(async () => {
    const monthKey = planLimitMonthKey();
    const key = `planGenUsed_${monthKey}`;
    setPlansUsedThisMonth((prev) => {
      const next = clamp((Number(prev) || 0) + 1, 0, PLAN_LIMIT_TOTAL);
      AsyncStorage.setItem(key, String(next)).catch(() => {});
      return next;
    });
  }, []);

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

  const resolveClaudeConfig = () => {
    const isRealSecret = (v) => {
      if (typeof v !== 'string') return false;
      const s = v.trim();
      if (!s) return false;
      if (s.startsWith('process.env')) return false;
      if (s.includes('your_key_here') || s.includes('YOUR_') || s.includes('your_claude_key')) return false;
      if (s.length < 20) return false;
      return true;
    };

    const apiKeyCandidate =
      Constants.expoConfig?.extra?.claudeApiKey ||
      process.env.EXPO_PUBLIC_CLAUDE_API_KEY ||
      process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

    const apiKey = isRealSecret(apiKeyCandidate) ? apiKeyCandidate.trim() : null;
    const apiUrl = 'https://api.anthropic.com/v1/messages';

    return {
      apiUrl,
      apiKey,
      hasAnyConfig: !!apiKey,
    };
  };

  // Load onboarding data
  useEffect(() => {
    loadOnboardingData();
  }, []);

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

  const loadOnboardingData = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert('Error', 'User not found');
        if (onBack) onBack();
        return;
      }

      const key = `onboarding_data_${userId}`;
      let loadedData = null;
      if (db) {
        const userSnap = await getDoc(doc(db, 'users', userId));
        if (userSnap.exists()) {
          loadedData = userSnap.data();
          await AsyncStorage.setItem(key, JSON.stringify(loadedData));
          setOnboardingData(loadedData);
        }
      }
      if (!loadedData) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          loadedData = JSON.parse(data);
          setOnboardingData(loadedData);
        } else {
          Alert.alert('Error', 'Onboarding data not found');
          if (onBack) onBack();
        }
      }
      if (userId) {
        const firestorePlan = await getCurrentWorkoutPlan(userId);
        if (firestorePlan?.rawPlan) {
          let structuredPlan = null;
          let planParseError = false;
          try {
            const raw = extractJSON(String(firestorePlan.rawPlan));
            structuredPlan = JSON.parse(raw);
          } catch (e) {
            // Fallback: legacy markdown/text plan -> structured shape (expected when rawPlan is not JSON)
            try {
              const legacy = parsePlan(String(firestorePlan.rawPlan));
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
              console.warn('Stored plan parse failed on load (JSON + legacy):', e?.message || e, fallbackErr?.message || fallbackErr);
              planParseError = true;
            }
          }

          // Auto-migrate old plan -> { overview, workoutPlan: [...] } and persist it.
          try {
            const payload = buildWorkoutPlanPayloadFromStructured(structuredPlan);
            if (payload && Array.isArray(payload.workoutPlan) && payload.workoutPlan.length > 0) {
              structuredPlan = payload;
              planParseError = false;
              const migratedRaw = JSON.stringify(payload);
              firestorePlan.rawPlan = migratedRaw;
              await AsyncStorage.setItem(`workout_plan_${userId}`, JSON.stringify({
                id: `plan_${firestorePlan.generatedAt?.toMillis?.() ?? Date.now()}`,
                generatedAt: firestorePlan.generatedAt?.toMillis?.() ?? Date.now(),
                userData: loadedData,
                planText: migratedRaw,
                structuredPlan: payload,
                planParseError: false,
              }));
              await AsyncStorage.setItem('@workout_plan', JSON.stringify({
                id: `plan_${firestorePlan.generatedAt?.toMillis?.() ?? Date.now()}`,
                generatedAt: firestorePlan.generatedAt?.toMillis?.() ?? Date.now(),
                userData: loadedData,
                planText: migratedRaw,
                structuredPlan: payload,
                planParseError: false,
              }));
              await setCurrentWorkoutPlan(userId, { rawPlan: migratedRaw });
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
          setGeneratedPlan(saved);
        } else {
          const planJson = await AsyncStorage.getItem('@workout_plan') || await AsyncStorage.getItem(`workout_plan_${userId}`);
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
                          weeklySchedule: (legacy.days || []).map(d => ({
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

              // Auto-migrate old plan -> { overview, workoutPlan: [...] } and persist it.
              try {
                const payload = buildWorkoutPlanPayloadFromStructured(saved.structuredPlan || tryParseJsonObject(saved.planText));
                if (payload && Array.isArray(payload.workoutPlan) && payload.workoutPlan.length > 0) {
                  const migratedRaw = JSON.stringify(payload);
                  saved.structuredPlan = payload;
                  saved.planText = migratedRaw;
                  saved.planParseError = false;
                  await AsyncStorage.setItem(`workout_plan_${userId}`, JSON.stringify(saved));
                  await AsyncStorage.setItem('@workout_plan', JSON.stringify(saved));
                  await setCurrentWorkoutPlan(userId, { rawPlan: migratedRaw });
                }
              } catch (e) {
                console.warn('Workout plan migration (AsyncStorage) failed:', e?.message || e);
              }

              setGeneratedPlan(saved);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading onboarding data:', error);
      Alert.alert('Error', 'Failed to load onboarding data');
      if (onBack) onBack();
    } finally {
      setLoading(false);
    }
  };

  // Pre-fill trainer request when onboardingData loads (AI disabled path)
  useEffect(() => {
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
        clientName: me?.name || me?.firstName || auth?.currentUser?.displayName || 'Client',
        clientGoals: onboardingData?.goal || onboardingData?.primaryGoal || 'Not specified',
        clientExperienceLevel: onboardingData?.fitnessLevel || onboardingData?.experience || 'Beginner',
        clientEquipment: onboardingData?.equipment || onboardingData?.availableEquipment || 'Not specified',
        clientLimitations: onboardingData?.injuries || onboardingData?.limitations || 'None',
      });
      Alert.alert('Sent', 'Your request was sent to your trainer.');
      onNavigate?.('messages');
    } catch (e) {
      console.error('Send trainer request failed:', e);
      Alert.alert('Send failed', e?.message || 'Could not send your request.');
    } finally {
      setSendingRequest(false);
    }
  };

  const saveData = async (updatedData) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      const key = `onboarding_data_${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(updatedData));
      setOnboardingData(updatedData);
      if (db) {
        await setDoc(doc(db, 'users', userId), { ...updatedData, updatedAt: serverTimestamp() }, { merge: true });
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
    if (!onboardingData.height || (!onboardingData.height.feet && !onboardingData.height.inches)) {
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

    const { apiUrl, apiKey, hasAnyConfig } = resolveClaudeConfig();

    if (!hasAnyConfig) {
      Alert.alert(
        'Configuration Error',
        "Claude API is not configured.\n\nSet this in .env and restart Expo:\n- EXPO_PUBLIC_CLAUDE_API_KEY=sk-ant-...\n\nThen run: npx expo start --clear",
        [{ text: 'OK' }]
      );
      return;
    }
    if (!apiKey) {
      Alert.alert(
        'Configuration Error',
        'API key is required for Claude. Set EXPO_PUBLIC_CLAUDE_API_KEY in .env and restart with: npx expo start --clear',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    workoutPlanGenerationInFlight = true;

    const ui = (fn) => {
      if (mountedRef.current) fn();
    };

    try {
      console.log('🧠 Workout plan generation config:', {
        hasApiKey: !!apiKey,
        apiUrl: apiUrl ? apiUrl.replace(/\/\/([^/]+).*/, '//***') : null,
      });

      const buildWorkoutSystemPrompt = (data) => {
        return `You are an expert strength and conditioning coach. Generate a complete 7-day personalized workout plan.

RESPONSE FORMAT:
Return ONLY a JSON object with this structure (NO markdown, NO prose, just JSON):

{
  "success": true,
  "overview": "2-4 sentences summarizing the program focus, weekly split, progression intent, and 1 key form/safety theme. No fluff.",
  "plan": [
    {
      "day": "Monday",
      "short": "MON",
      "focus": "Push — Chest/Shoulders/Triceps",
      "focusColor": "pink",
      "rest": false,
      "warmup": "Specific warmup protocol for push day",
      "estimatedDuration": "55-65 min",
      "exercises": [
        {
          "name": "Exercise Name",
          "sets": 4,
          "reps": "6-8 reps",
          "rest": "120s rest",
          "muscle": "Muscle Group",
          "tempo": "3-1-1",
          "notes": "Short execution cue",
          "tips": [
            "Detailed coaching tip 1",
            "Detailed coaching tip 2",
            "Detailed coaching tip 3"
          ]
        }
      ]
    }
  ]
}

CRITICAL RULES:
1. Generate exactly 7 days (Monday-Sunday)
2. Include 3-5 exercises per training day
3. Each exercise MUST have: name, sets, reps, rest, muscle, tempo, notes, tips[]
4. Rest days MUST have recoveryNote and NO exercises
5. focusColor MUST be one of: "pink", "purple", "cyan", "orange", "green", or "gray"
6. tips MUST be an array of exactly 3 strings (detailed coaching points)
7. Output ONLY JSON - no markdown, no prose, no code blocks
8. Include warmup and estimatedDuration for every training day
9. Rest days: set "rest": true, NO exercises array
10. Training days: set "rest": false, INCLUDE exercises array
11. NO repetition: do NOT reuse the same exact sentence/phrase across different exercises (especially in notes/tips). Avoid generic filler.
12. You MUST include a top-level "overview" string (2–4 sentences). Make it specific to the user's goal and the week's split.

COACHING CONTENT REQUIREMENTS (VERY IMPORTANT):

EXERCISE notes (single string per exercise):
- Must be SPECIFIC and actionable for that exact exercise (setup + execution + one safety/form point).
- Include tempo cues when relevant (e.g., "3-second eccentric, pause, explode") and tie it to the movement.
- Include at least one concrete setup detail when relevant (e.g., stance, grip width, bar path, torso angle).
- Make every note distinct. Do NOT repeat generic phrases like "control the descent" or "squeeze at the top" across the plan.

EXERCISE tips (tips[] must be EXACTLY 3 strings, each 1–2 sentences max):
- Tip 1 (TECHNIQUE): a crisp form/tech cue for THIS exercise.
- Tip 2 (SAFETY / COMMON MISTAKE): call out one common mistake + how to fix/avoid it.
- Tip 3 (PERFORMANCE / PROGRESSION): a progression or performance lever (load, reps in reserve, rest, tempo, range, grip).
- No generic tips. No duplicates across exercises. Each tip should sound like a real coach speaking.

WARMUP (warmup string):
- Must be more specific than a generic list.
- Include the WHY for each warmup step using a simple arrow format.
- Example format: "5 min easy row (blood flow) → 15 band pull-aparts (rear delt activation) → 10 arm circles (shoulder mobility)".

Rest Day Recovery Notes Should Include:
- Type of activity (walking, yoga, stretching, etc)
- Estimated duration
- Recovery focus (sleep, hydration, mobility, etc)`;
      };

      const systemPrompt = buildWorkoutSystemPrompt(onboardingData);

      const userPrompt = buildUserPrompt(onboardingData);

      const model =
        process.env.EXPO_PUBLIC_CLAUDE_MODEL ||
        process.env.EXPO_PUBLIC_ANTHROPIC_MODEL ||
        'claude-sonnet-4-6';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 8000,
          temperature: 0.7,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData?.error?.message ||
          errorData?.message ||
          `Request failed: ${response.status} ${response.statusText}`;
        console.warn('Claude API error:', response.status, errorData);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const rawText =
        data?.content?.find?.((c) => c?.type === 'text')?.text ||
        '';
      if (rawText) {
        console.log(
          'RAW CLAUDE RESPONSE length:',
          rawText.length,
          '| preview:',
          JSON.stringify(String(rawText).slice(0, 600)),
        );
      }

      if (!rawText || typeof rawText !== 'string') throw new Error('Empty response from Claude. Please try again.');

      let planText = rawText;
      const stopReason = data?.stop_reason || null;
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
      const targetUid = userId;
      const planData = {
        id: `plan_${Date.now()}`,
        generatedAt: Date.now(),
        userData: onboardingData,
        planText: planText,
        structuredPlan: structuredPlan,
        planParseError: false,
      };

      // Cache locally for the currently signed-in user (device UX),
      // but write plan artifacts (PDF/Firestore) to the target userId.
      await AsyncStorage.setItem(`workout_plan_${authedUid || 'unknown'}`, JSON.stringify(planData));
      await AsyncStorage.setItem('@workout_plan', JSON.stringify(planData));
      ui(() => setGeneratedPlan(planData));
      // Update monthly plan limit counter (UI gating only)
      await markPlanGeneratedForLimit();
      if (targetUid) {
        await setCurrentWorkoutPlan(targetUid, { rawPlan: planText });
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
    const targetUid = userId;
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

  const handleViewPdf = async () => {
    const uid = userId;
    const clientName = onboardingData?.name || onboardingData?.firstName || auth.currentUser?.displayName || 'Client';
    if (pdfDownloadUrl || pdfLocalUri) {
      setShowPdfViewer(true);
      return;
    }
    if (!generatedPlan?.planText || !uid) return;
    const parsed = parsePlanForPdf(generatedPlan.planText);
    if (parsed) {
      try {
        const { pdfLocalUri: localUri, pdfDownloadUrl: downloadUrl } = await generateAndSavePlanPdf(uid, parsed, clientName);
        setPdfLocalUri(localUri);
        setPdfDownloadUrl(downloadUrl);
        setPlanTitleForPdf(parsed.title || 'Workout Plan');
        setShowPdfViewer(true);
      } catch (e) {
        Alert.alert('PDF unavailable', e.message || 'Could not generate PDF.');
      }
    } else {
      setShowPdfViewer(false);
      Alert.alert('PDF unavailable', 'Plan could not be parsed for PDF. Use Edit to view or modify the plan.');
    }
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
        const recoveryNote =
          day.recoveryNote || 'Active recovery day. Focus on mobility and sleep.';
        return {
          day: day.day,
          short: day.short,
          focus: day.focus,
          focusColor: day.focusColor,
          rest: true,
          recoveryNote,
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
  const formatDisplayValue = (raw) => {
    if (raw == null || raw === undefined || raw === '') return null;
    const s = String(raw).trim();
    if (!s) return null;
    if (s === 'Not set' || s === 'None selected' || s === 'None reported' || s === 'Not provided') return null;
    if (s === 'undefined' || s.toLowerCase() === 'undefined') return null;
    if (/^N\/A,\s*N\/Ayrs,\s*N\/Albs,\s*0'0"$/i.test(s)) return null;
    if (/^0\s*days\s*per\s*week$/i.test(s)) return null;
    return s;
  };

  if (loading) {
    // Keep the bottom navbar visible so you can see tab highlight transitions.
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#0A0618' : '#F5F3FF' }}>
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
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#0A0618' : '#F5F3FF' }]}>
        <Text style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>No data found</Text>
      </View>
    );
  }

  const rootBg = isDark ? ['#0a0a1a', '#1a0a2e', '#0d1117'] : ['#F5F3FF', '#EDE9FE', '#E9E5FF'];
  const textPrimary = isDark ? '#FFFFFF' : '#1a0a2e';
  const textSecondary = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,10,46,0.6)';
  const stickyCtaVisible = aiPrefReady && aiOn && activeTab === 'plans' && !(readOnly || showFullPlan);
  const stickyCtaBottom = (hideBottomNav ? 0 : 80) + insets.bottom + 12;
  const stickyCtaExtraScrollPad = stickyCtaVisible ? ((hideBottomNav ? 0 : 80) + 86) : 0;

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
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderC }}>
            <TouchableOpacity
              onPress={() => { if (readOnly) { onBack?.(); } else { setShowFullPlan(false); } }}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="chevron-back" size={24} color={text} />
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '800', flex: 1, textAlign: 'center', color: text }}>Your Weekly Plan</Text>
            <TouchableOpacity
              onPress={handleAddToCollection}
              disabled={addedToCollection || savingToCollection}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: addedToCollection ? 0.7 : 1 }}
            >
              {savingToCollection ? (
                <ActivityIndicator size="small" color={text} />
              ) : (
                <Ionicons
                  name={addedToCollection ? 'checkmark-circle-outline' : 'bookmark-outline'}
                  size={22}
                  color={text}
                />
              )}
            </TouchableOpacity>
          </View>
          <PlanViewerScreen
            route={{ params: { workoutPlan: workoutPlanRows, overview: overviewText, isDarkOverride: isDark } }}
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
        </SafeAreaView>
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

  const renderPlanBuilderRow = (fieldKey, sectionKeys, idxInSection) => {
    const meta = WORKOUT_BUILDER_ROW_META[fieldKey];
    if (!meta) return null;
    const raw = getWorkoutBuilderFieldRawDisplay(fieldKey, onboardingData);
    const formatted = formatDisplayValue(raw);
    const displayValue = formatted != null && String(formatted).trim() !== '' ? String(formatted) : '';
    const expanded = expandedCard === fieldKey;
    const hasError = validationErrors[fieldKey];
    const shakeAnim = shakeAnimations.current[fieldKey] || new Animated.Value(0);
    const iconEl =
      meta.iconLib === 'mci' ? (
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
        <TouchableOpacity activeOpacity={0.85} onPress={() => setExpandedCard(expanded ? null : fieldKey)}>
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
      <CoachConnectHeader
        title=""
        isDark={isDark}
        onBack={() => {
          if (isGenerating) {
            console.log(
              'Workout plan: leaving screen — generation continues in background; you will get',
              'a notification when finished if you are not on this screen or the app is in background.',
            );
          }
          onBack?.();
        }}
        onProfilePress={onProfilePress}
        onSettingsPress={onSettingsPress}
      />

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
          {activeTab === 'plans' ? <View style={styles.tabIndicator} /> : null}
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
          {activeTab === 'library' ? <View style={styles.tabIndicator} /> : null}
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
              <Text style={{ fontSize: 20, fontWeight: '900', color: planBuilderText, marginBottom: 8, textAlign: 'center' }}>
                Workout Plans (Trainer)
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: planBuilderMuted, textAlign: 'center' }}>
                AI is disabled. If you have a trainer, send a request for a custom plan.
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
                      {sendingRequest ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="send" size={18} color="#FFFFFF" />}
                      <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>Send Request</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        ) : null}

        {aiPrefReady && aiOn ? (
        <>
        <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 }}>
          <Text style={{ fontSize: 22, fontWeight: '900', color: planBuilderText, marginBottom: 6 }}>
            Workout Plan Generator
          </Text>
          <Text style={{ fontSize: 13, color: planBuilderMuted, lineHeight: 18 }}>
            {generatedPlan ? 'Your latest plan is saved. Use the buttons below.' : 'Generate a new plan from your profile.'}
          </Text>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <View
            style={{
              borderRadius: 18,
              borderWidth: 1,
              borderColor: planBuilderDivider,
              backgroundColor: planBuilderCardBg,
              padding: 14,
              gap: 10,
            }}
          >
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleRegeneratePlan}
                disabled={isGenerating}
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: planBuilderDivider,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  flexDirection: 'row',
                  gap: 8,
                }}
              >
                <Ionicons name="refresh-outline" size={16} color={planBuilderText} />
                <Text style={{ color: planBuilderText, fontWeight: '800' }}>Regenerate</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleAddToCollection}
                disabled={addedToCollection || savingToCollection}
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: planBuilderDivider,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  flexDirection: 'row',
                  gap: 8,
                  opacity: addedToCollection ? 0.7 : 1,
                }}
              >
                {savingToCollection ? (
                  <ActivityIndicator size="small" color={planBuilderText} />
                ) : (
                  <>
                    <Ionicons name={addedToCollection ? 'checkmark-circle-outline' : 'bookmark-outline'} size={16} color={planBuilderText} />
                    <Text style={{ color: planBuilderText, fontWeight: '800' }}>
                      {addedToCollection ? 'Saved' : 'Save'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleViewPdf}
              style={{
                height: 46,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: planBuilderDivider,
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                flexDirection: 'row',
                gap: 8,
              }}
            >
              <Ionicons name="download-outline" size={16} color={planBuilderMuted} />
              <Text style={{ color: planBuilderMuted, fontWeight: '800' }}>Export / View PDF</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Restored onboarding/profile editor sections */}
        <View style={planBuilderRefStyles.dividerContainer}>
          <View style={[planBuilderRefStyles.dividerLine, { backgroundColor: planBuilderDivider }]} />
          <Text style={[planBuilderRefStyles.dividerText, { color: planBuilderMuted }]}>Your Profile</Text>
          <View style={[planBuilderRefStyles.dividerLine, { backgroundColor: planBuilderDivider }]} />
        </View>

        {WORKOUT_PLAN_BUILDER_SECTIONS.map((section) => (
          <View key={section.sectionLabel} style={planBuilderRefStyles.sectionContainer}>
            <PlanBuilderSectionLabel color={planBuilderSectionLabelColor}>{section.sectionLabel}</PlanBuilderSectionLabel>
            <PlanBuilderAnimatedBorderCard radius={16} cardBg={planBuilderCardBg}>
              {section.keys.map((fieldKey, idx) => renderPlanBuilderRow(fieldKey, section.keys, idx))}
            </PlanBuilderAnimatedBorderCard>
          </View>
        ))}

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
      </ScrollView>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 18 }}>
          <View
            style={[
              styles.exerciseLibraryPlaceholder,
              {
                borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
              },
            ]}
          >
            <Text
              style={[
                styles.exerciseLibrarySoon,
                { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(10,10,15,0.6)' },
              ]}
            >
              Coming Soon
            </Text>
            <Text style={[styles.exerciseLibraryTitle, { color: isDark ? '#FFFFFF' : '#0A0A0F' }]}>
              Exercise Library
            </Text>
          </View>
        </View>
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
            {generatedPlan ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  activeOpacity={0.92}
                  onPress={() => setShowFullPlan(true)}
                  style={{ flex: 1, height: 56, borderRadius: 16, overflow: 'hidden' }}
                >
                  <LinearGradient
                    colors={['#FF6B9D', '#C084FC']}
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
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 10,
                  }}
                >
                  <Ionicons name="sparkles" size={18} color={isDark ? '#FFFFFF' : '#0A0A0F'} />
                  <Text style={{ color: isDark ? '#FFFFFF' : '#0A0A0F', fontSize: 16, fontWeight: '900' }}>
                    {isGenerating ? 'Generating…' : 'Generate New'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                <PlanLimitBanner
                  remaining={plansRemaining}
                  total={PLAN_LIMIT_TOTAL}
                  nextReset={nextResetDate}
                  onTapUpgrade={onNavigate ? () => onNavigate('upgrade') : undefined}
                />

                <TouchableOpacity
                  activeOpacity={0.92}
                  onPress={() => {
                    if (plansRemaining <= 0) {
                      Alert.alert(
                        'Plan limit reached',
                        'You’ve used your 2 AI plan generations for this month. You can still use AI Coach for unlimited modifications.',
                      );
                      return;
                    }
                    generateWorkoutPlan();
                  }}
                  disabled={isGenerating}
                  style={{ height: 56, borderRadius: 16, overflow: 'hidden', opacity: isGenerating ? 0.7 : 1 }}
                >
                  <LinearGradient
                    colors={['#FF6B9D', '#C084FC']}
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
    alignItems: 'flex-end',
    gap: 28,
    paddingHorizontal: 16,
    height: 52,
    borderBottomWidth: 1,
  },
  tabButton: {
    paddingVertical: 12,
    paddingHorizontal: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    fontWeight: '700',
  },
  tabIndicator: {
    marginTop: 10,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#FF6B9D',
  },
  exerciseLibraryPlaceholder: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
    gap: 10,
  },
  exerciseLibrarySoon: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  exerciseLibraryTitle: {
    fontSize: 18,
    fontWeight: '800',
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
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'System',
  },
  optionCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  optionCardText: {
    fontSize: 16,
    fontWeight: '500',
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
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B9D',
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