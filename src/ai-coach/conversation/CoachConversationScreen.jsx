// CoachConversationScreen.jsx
//
// Main AI coach chat: type a message, get a reply, confirm tools (log food, water, etc.).
// Flow: load session → send message → show reply / confirm chips → run tool → refresh context.
// Used by: client AI Coach tab. Export: CoachConversationScreen.

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Animated,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { showCoachAttachMenu } from './openPhotoMenu';
import {
  pickCoachDocuments,
  pickCoachPhotoFromCamera,
  pickCoachPhotosFromLibrary,
} from './choosePhoto';
import * as Haptics from 'expo-haptics';
import { serverTimestamp } from 'firebase/firestore';
import logger from '../../for-both/online-connection/sendCrashReport';
import { db } from '../../app-start/cloudConnection';
import {
  deleteAiChatSession,
  loadAiChatMessages,
  loadAiChatSessionMeta,
  persistAiChatSession,
  restoreChatMessagesFromSaved,
  upsertAiChatMessages,
} from '../past-chats/saveAndLoadChats';
import { makeChatTitle } from '../past-chats/makeChatTitle';
import {
  buildCreativeTitleLocal,
  deriveChatTitle,
  needsCreativeTitle,
} from '../past-chats/chatTitles';
import PastChatsPanel from '../past-chats/PastChatsPanel';
import { chatHistoryList } from '../past-chats/chatHistoryList';
import { typingBox } from './typingBox';
import PasteTextPopup from './PasteTextPopup';
import TopHeader from '../../for-both/loading-and-header/TopHeader';
import BottomMenuBar from '../../navigation/BottomMenuBar';
import { ShellBottomNavAnchor } from '../../navigation/bottomMenuSpacing';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { coachPlainText, copyCoachText } from '../reply-display/copyableReplyText';
import { loadCoachContextEnhanced } from '../coach-knowledge/loadYourWeekForCoach';
import { sendCoachMessageWithRetry } from './sendMessageToCoach';
import ConfirmActionPopup from './ConfirmActionPopup';
import { carryOutAction, normalizeToolCall, TOOL_DISPLAY_NAMES } from '../coach-actions/carryOutAction';
import { inferToolCallFromCoachMessage } from '../coach-actions/findActionsInReply';
import { useCoachSpeech } from './_voiceStub';
import { keyboardBehavior, COACH_COMPOSER_TEXT_INPUT_PROPS } from './keyboardBehavior';
import { shouldShowWebSearchUI } from '../internet-lookup/shouldLookUpOnInternet';
import { a11yButton, MIN_TOUCH_HIT_SLOP } from '../../for-both/screenReaderLabels';
import { AI_COACH_UI } from '../coachColors';
import CoachGlassCard from '../reply-display/CoachGlassCard';
import { stripCoachToolJsonFromReply, readActionsFromReply } from '../coach-actions/readActionsFromReply';
import { coerceMisroutedDeleteTool } from '../coach-actions/spotDeleteRequests';
import {
  guardCoachToolProposal,
  isValidCoachToolProposal,
  isInformationalUserMessage,
} from '../coach-actions/shouldAskFirst';
import {
  shouldAutoExecuteCoachTool,
  shouldAutoOpenCoachToolModal,
} from '../coach-actions/popupOrAutoRun';
import SourceLinkCards from './SourceLinkCards';
import CoachReplyText from '../reply-display/CoachReplyText';
import { prepareCoachReplyForDisplay } from '../reply-display/suggestedQuestionMaker';
import {
  logCoachUserMessage,
  logCoachAssistantMessage,
  logCoachTurnBundle,
  logCoachError,
} from '../reply-display/developerChatLog';

// ===== NAMED CONSTANTS =====

// Manipulate here: how long the "Copied" toast stays on a coach reply.
const COPY_FEEDBACK_MS = 2500;
// Manipulate here: coach waiting-phase labels while the reply streams in.
const WAIT_PHASE_CONTEXT_MS = 1400;
const WAIT_PHASE_DRAFTING_MS = 3200;
// Manipulate here: delay before showing feature explanation cards under a reply.
const FEATURE_CARDS_REVEAL_MS = 1850;
const WIDE_LAYOUT_MIN_WIDTH = 768;
const NOTIFY_TRAINER_PREVIEW_CHARS = 80;

const USER_BUBBLE_GRAD = AI_COACH_UI.gradient.userBubble;
const ACTION_GRAD = AI_COACH_UI.gradient.ctaWarm;
const COMPOSER_SEND_GRAD = AI_COACH_UI.gradient.composerSend;
const COMPOSER_SEND_GRAD_LIGHT = AI_COACH_UI.gradient.composerSendLight;

import { stripUndefinedForFirestore as stripUndefinedDeep } from '../../helpers/cleanDataBeforeSaving';

function serializeChatMessage(m) {
  if (!m) return null;
  const payload = {
    role: m.role === 'ai' ? 'ai' : 'user',
    content: m.text,
    time: m.time,
    source: m.source || null,
  };
  if (Array.isArray(m.attachments) && m.attachments.length > 0) {
    payload.attachments = m.attachments.map((a) =>
      stripUndefinedDeep({
        id: a.id,
        name: a.name,
        type: a.type,
        preview: a.preview,
      })
    );
  }
  if (m.toolCall) payload.toolCall = m.toolCall;
  if (m.toolConfirmed) payload.toolConfirmed = true;
  if (m.isToolResult) payload.isToolResult = true;
  return stripUndefinedDeep(payload);
}

function resolveIncomingCoachTool(coachResponse, userText = '') {
  const rawReply = coachResponse?.message || '';
  const user = String(userText || '').trim();
  const rawTool = coachResponse?.toolCall || readActionsFromReply(rawReply)[0] || null;
  const coerced = coerceMisroutedDeleteTool(rawTool, user, rawReply, normalizeToolCall);
  if (coerced && isValidCoachToolProposal(coerced, user)) return coerced;

  if (coachResponse?.searchedWeb || isInformationalUserMessage(user)) {
    return null;
  }

  const displayReply = stripCoachToolJsonFromReply(rawReply) || rawReply;
  const inferred = inferToolCallFromCoachMessage(displayReply, userText);
  return inferred && isValidCoachToolProposal(inferred, user) ? inferred : null;
}

function resolveMessageToolCall(message, userMessage = '') {
  if (!message || message.toolConfirmed || message.isToolResult) return null;
  if (message.toolCall) {
    const guarded = guardCoachToolProposal(normalizeToolCall(message.toolCall));
    return guarded && isValidCoachToolProposal(guarded, userMessage) ? guarded : null;
  }
  const inferred = inferToolCallFromCoachMessage(message.text, userMessage);
  return inferred && isValidCoachToolProposal(inferred, userMessage) ? inferred : null;
}

function coachActionPromptVisible(message, userMessage = '') {
  if (!message || message.role === 'user' || message.toolConfirmed) return false;
  return Boolean(resolveMessageToolCall(message, userMessage));
}

// ===== HELPER FUNCTIONS =====

/** Join non-empty detail bits with a middle dot. */
function joinSummaryParts(...parts) {
  return parts.filter(Boolean).join(' · ');
}

const DEFAULT_TOOL_SUMMARY = {
  icon: 'flash-outline',
  title: 'Confirm action',
  detail: 'Review what the coach will update',
};

function summarizeDeleteNutrition(params) {
  if (params.deleteAll || params.all) {
    return {
      icon: 'trash-outline',
      title: 'Delete all food logs',
      detail: `Clear food entries for ${params.date || 'today'}`,
    };
  }
  if (params.foodName || params.food) {
    return {
      icon: 'trash-outline',
      title: 'Delete food log',
      detail: `Remove ${params.foodName || params.food}`,
    };
  }
  return {
    icon: 'trash-outline',
    title: 'Delete last food entry',
    detail: 'Remove your most recent meal log',
  };
}

function summarizeDeleteLog(params) {
  const logType = String(params.logType || 'nutrition').toLowerCase();
  if (logType === 'nutrition') return summarizeDeleteNutrition(params);

  const metricLabels = {
    sleep: ['Delete sleep log', 'Clear your sleep entry from the dashboard'],
    water: ['Delete water log', 'Clear your water entry from the dashboard'],
    steps: ['Delete steps log', 'Clear your step count from the dashboard'],
    energy: ['Delete energy log', 'Clear your energy rating from the dashboard'],
    mood: ['Delete mood log', 'Clear your mood entry from the dashboard'],
    workout: ['Delete workout log', 'Clear your workout entry from the dashboard'],
    restDay: ['Clear rest day', 'Remove the rest day mark from the dashboard'],
  };
  const pair = metricLabels[logType] || [
    'Delete log',
    `Clear ${logType} entry from the dashboard`,
  ];
  return {
    icon: 'trash-outline',
    title: pair[0],
    detail: joinSummaryParts(
      pair[1],
      params.date && params.date !== 'Today' ? `for ${params.date}` : null,
    ),
  };
}

function summarizeLogNutrition(params) {
  return {
    icon: 'restaurant-outline',
    title: params.food || params.foodName || 'Log meal',
    detail:
      joinSummaryParts(
        params.calories || params.cals
          ? `${Math.round(Number(params.calories || params.cals))} cal`
          : null,
        params.protein ? `${Math.round(Number(params.protein))}g protein` : null,
        params.mealType ? String(params.mealType) : null,
      ) || 'Add this food to your nutrition log',
  };
}

function summarizeAdjustMacros(params) {
  return {
    icon: 'nutrition-outline',
    title: 'Update macro targets',
    detail: joinSummaryParts(
      params.calories ? `${Math.round(Number(params.calories))} cal/day` : null,
      params.protein ? `${Math.round(Number(params.protein))}g protein` : null,
      params.carbs ? `${Math.round(Number(params.carbs))}g carbs` : null,
      params.fat ? `${Math.round(Number(params.fat))}g fat` : null,
    ),
  };
}

function summarizeUpdateWorkout(params) {
  const replacementName =
    typeof params.newExercise === 'object'
      ? params.newExercise?.name
      : params.newExercise || params.exerciseName;
  return {
    icon: 'swap-horizontal-outline',
    title: 'Swap exercise',
    detail: replacementName
      ? `Replace with ${replacementName}`
      : 'Update an exercise in your plan',
  };
}

const TOOL_SUMMARY_BY_NAME = {
  logNutrition: summarizeLogNutrition,
  adjustMacroTargets: summarizeAdjustMacros,
  logSleep: (params) => ({
    icon: 'moon-outline',
    title: 'Log sleep',
    detail: joinSummaryParts(
      params.hours || params.sleepHours
        ? `${params.hours || params.sleepHours} hours`
        : null,
      params.date && params.date !== 'Today' ? `on ${params.date}` : 'on your dashboard',
    ),
  }),
  logWater: (params) => ({
    icon: 'water-outline',
    title: 'Log water',
    detail: `${params.amount_oz ?? params.amountOz ?? params.amount ?? '—'} oz on your dashboard`,
  }),
  logSteps: (params) => ({
    icon: 'footsteps-outline',
    title: 'Log steps',
    detail: `${Number(params.step_count ?? params.steps ?? 0).toLocaleString()} steps on your dashboard`,
  }),
  rateEnergy: (params) => ({
    icon: 'flash-outline',
    title: 'Log energy level',
    detail: joinSummaryParts(
      params.rating ? `${params.rating}/10 energy` : null,
      params.notes ? String(params.notes) : null,
    ),
  }),
  logMood: (params) => ({
    icon: 'happy-outline',
    title: 'Log mood',
    detail: joinSummaryParts(
      params.mood ? `Feeling ${params.mood}` : null,
      params.notes ? String(params.notes) : null,
    ),
  }),
  rateWorkout: (params) => ({
    icon: 'barbell-outline',
    title: 'Rate workout',
    detail: params.rating
      ? `${params.rating}/10 workout rating`
      : 'Save how that session felt',
  }),
  updateWorkout: summarizeUpdateWorkout,
  logRestDay: (params) => ({
    icon: 'bed-outline',
    title: 'Log rest day',
    detail: joinSummaryParts(
      params.date && params.date !== 'Today' ? `on ${params.date}` : 'on your dashboard today',
    ),
  }),
  bookSession: (params) => ({
    icon: 'calendar-outline',
    title: 'Book session',
    detail: joinSummaryParts(
      params.dateTime || params.sessionDate || params.date,
      params.sessionTime || params.time,
    ),
  }),
  openWorkoutPlan: (params) => ({
    icon: 'document-text-outline',
    title: 'Open workout plan',
    detail:
      params.planId === 'current'
        ? "Your active program + today's session"
        : `Plan ${params.planId}`,
  }),
  updateGoal: (params) => ({
    icon: 'flag-outline',
    title: 'Update goal',
    detail: params.newGoal ? `New goal: ${params.newGoal}` : 'Change your primary goal',
  }),
  notifyTrainer: (params) => ({
    icon: 'chatbubble-ellipses-outline',
    title: 'Notify trainer',
    detail: params.message
      ? String(params.message).slice(0, NOTIFY_TRAINER_PREVIEW_CHARS)
      : 'Send a message to your trainer',
  }),
  deleteLog: summarizeDeleteLog,
};

/**
 * Short title + detail for the "Confirm action" chip under a coach reply.
 * @param {object} toolCall
 * @returns {{icon: string, title: string, detail: string}}
 */
function formatToolActionSummary(toolCall) {
  const tool = normalizeToolCall(toolCall);
  if (!tool) return DEFAULT_TOOL_SUMMARY;

  const params = tool.params || {};
  const builder = TOOL_SUMMARY_BY_NAME[tool.name];
  if (builder) return builder(params);

  return {
    icon: 'checkmark-circle-outline',
    title: TOOL_DISPLAY_NAMES[tool.name] || 'Confirm action',
    detail: tool.reasoning || 'Review and confirm this coach action',
  };
}

function ToolActionChip({ message, onPress, palette, userMessage = '' }) {
  const toolCall = resolveMessageToolCall(message, userMessage);
  if (!toolCall) return null;
  const summary = formatToolActionSummary(toolCall);
  const handlePress = () => onPress?.(toolCall, message.id);

  return (
    <CoachGlassCard
      heroFill
      borderColors={AI_COACH_UI.gradient.borderWarm}
      borderRadius={14}
      padding={1.5}
      style={{ marginTop: 10 }}
      contentStyle={{ paddingBottom: 0 }}
    >
      <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12, flexDirection: 'row', gap: 12 }}>
        <LinearGradient
          colors={ACTION_GRAD}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={summary.icon} size={20} color="#FFFFFF" />
        </LinearGradient>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: palette.textPrimary }} numberOfLines={2}>
            {summary.title}
          </Text>
          <Text style={{ fontSize: 12, color: palette.textSecondary, marginTop: 4, lineHeight: 17 }} numberOfLines={3}>
            {summary.detail}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.88}
        hitSlop={MIN_TOUCH_HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={`${summary.title}. Confirm action.`}
      >
        <LinearGradient
          colors={ACTION_GRAD}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 16,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>Confirm Action</Text>
        </LinearGradient>
      </TouchableOpacity>
    </CoachGlassCard>
  );
}
// ─── Theme tokens (aligned with design-system.md) ────────────────────────────
const DARK = {
  bg: AI_COACH_UI.bg,
  cardBg: AI_COACH_UI.glass,
  cardBorder: AI_COACH_UI.borderHairline,
  textPrimary: AI_COACH_UI.textPrimary,
  textSecondary: AI_COACH_UI.textSecondary,
  textMuted: AI_COACH_UI.textMuted,
  inputBg: AI_COACH_UI.glass,
  inputBorder: AI_COACH_UI.borderHairline,
  divider: 'rgba(255,255,255,0.05)',
  chipBg: AI_COACH_UI.glassStrong,
  chipBorder: 'rgba(255,255,255,0.12)',
  inputBarBg: '#0C0C14',
  inputBarBorder: AI_COACH_UI.borderHairline,
  aiBubbleBg: AI_COACH_UI.glassStrong,
  aiBubbleBorder: 'rgba(255,255,255,0.15)',
  msgReceivedBg: AI_COACH_UI.glass,
  msgReceivedBorder: 'rgba(255,255,255,0.10)',
  msgTimestamp: 'rgba(255,255,255,0.35)',
};

const LIGHT = {
  bg: '#F5F5F7',
  cardBg: '#FFFFFF',
  cardBorder: '#E5E7EB',
  textPrimary: '#0A0A0F',
  textSecondary: 'rgba(0,0,0,0.5)',
  textMuted: 'rgba(0,0,0,0.35)',
  inputBg: '#FFFFFF',
  inputBorder: '#E5E7EB',
  divider: 'rgba(0,0,0,0.06)',
  chipBg: 'rgba(0,0,0,0.04)',
  chipBorder: 'rgba(0,0,0,0.1)',
  inputBarBg: '#FFFFFF',
  inputBarBorder: '#E5E7EB',
  aiBubbleBg: '#FFFFFF',
  aiBubbleBorder: '#E5E7EB',
  msgReceivedBg: 'rgba(0,0,0,0.04)',
  msgReceivedBorder: 'rgba(0,0,0,0.08)',
  msgTimestamp: 'rgba(0,0,0,0.45)',
};

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function toTitleCase(s) {
  return String(s || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── Feature explanation cards (inline in AI messages) ────────────────────────
const FEATURE_COLORS = {
  analysis: AI_COACH_UI.purple,
  generation: AI_COACH_UI.pink,
  optimization: AI_COACH_UI.cyan,
  goals: AI_COACH_UI.green,
  tracking: AI_COACH_UI.orange,
};

const inferFlowType = (userText) => {
  const lowered = String(userText || '').toLowerCase();
  if (!lowered.trim()) return 'general';
  if (lowered.includes('form') || lowered.includes('check') || lowered.includes('video') || lowered.includes('squat') || lowered.includes('bench')) return 'form';
  if (lowered.includes('macro') || lowered.includes('calorie') || lowered.includes('protein') || lowered.includes('nutrition') || lowered.includes('meal')) return 'nutrition';
  if (lowered.includes('progress') || lowered.includes('plateau') || lowered.includes('last 30') || lowered.includes('data')) return 'progress';
  if (lowered.includes('workout') || lowered.includes('plan') || lowered.includes('split') || lowered.includes('hypertrophy')) return 'workout';
  return 'general';
};

const buildFeatureCards = ({ userText, userProfile }) => {
  const flow = inferFlowType(userText);
  const goalRaw = userProfile?.primaryGoal || userProfile?.goal || userProfile?.fitnessGoal || '';
  const goal =
    String(goalRaw || '')
      .replace(/_/g, ' ')
      .trim() || 'Fitness';

  const days =
    userProfile?.availableDays ||
    userProfile?.daysPerWeek ||
    userProfile?.trainingDays ||
    userProfile?.workoutsPerWeek ||
    null;

  const level = userProfile?.experienceLevel || userProfile?.fitnessLevel || userProfile?.level || null;

  // Ensure items is always an array
  const ensureArray = (arr) => (Array.isArray(arr) ? arr : []);

  if (flow === 'form') {
    return [
      {
        key: 'video',
        icon: 'camera-outline',
        title: 'ANALYZING VIDEO',
        color: FEATURE_COLORS.tracking,
        items: [
          { label: 'Quality', value: 'Checking lighting & stability' },
          { label: 'Angle', value: 'Detecting camera view' },
          { label: 'Exercise', value: 'Identifying movement' },
        ],
      },
      {
        key: 'assessment',
        icon: 'settings-outline',
        title: 'FORM ASSESSMENT',
        color: FEATURE_COLORS.analysis,
        items: [
          { label: 'Range of motion', value: 'Evaluating depth & control' },
          { label: 'Stability', value: 'Tracking bar/path consistency' },
          { label: 'Risk', value: 'Flagging common breakdowns' },
        ],
      },
      {
        key: 'recs',
        icon: 'bulb-outline',
        title: 'RECOMMENDATIONS',
        color: FEATURE_COLORS.goals,
        items: [
          { label: 'Cues', value: 'Simple fixes you can apply' },
          { label: 'Drills', value: '1–2 accessory drills' },
          { label: 'Next set', value: 'What to focus on immediately' },
        ],
      },
    ];
  }

  if (flow === 'nutrition') {
    return [
      {
        key: 'data',
        icon: 'bar-chart-outline',
        title: 'ANALYZING YOUR DATA',
        color: FEATURE_COLORS.tracking,
        items: [
          { label: 'Goal', value: toTitleCase(goal) },
          { label: 'Activity', value: days ? `${days} days/week` : 'Estimating from training' },
          { label: 'Baseline', value: 'Checking intake consistency' },
        ],
      },
      {
        key: 'calc',
        icon: 'calculator-outline',
        title: 'CALCULATING INTAKE',
        color: FEATURE_COLORS.generation,
        items: [
          { label: 'Calories', value: 'Setting a sustainable target' },
          { label: 'Protein', value: 'Prioritizing muscle retention' },
          { label: 'Carbs/Fat', value: 'Balancing for performance' },
        ],
      },
      {
        key: 'plan',
        icon: 'flag-outline',
        title: 'MEAL PLAN',
        color: FEATURE_COLORS.goals,
        items: [
          { label: 'Structure', value: 'Simple daily template' },
          { label: 'Timing', value: 'Pre/post-workout emphasis' },
          { label: 'Adherence', value: 'Easy swaps & options' },
        ],
      },
    ];
  }

  if (flow === 'progress') {
    return [
      {
        key: 'scan',
        icon: 'analytics-outline',
        title: 'ANALYZING PROGRESS',
        color: FEATURE_COLORS.tracking,
        items: [
          { label: 'Period', value: 'Reviewing recent trend' },
          { label: 'Workouts', value: 'Looking for progression signals' },
          { label: 'Recovery', value: 'Checking fatigue patterns' },
        ],
      },
      {
        key: 'wins',
        icon: 'trending-up-outline',
        title: 'IMPROVEMENTS',
        color: FEATURE_COLORS.goals,
        items: [
          { label: 'Strength', value: 'Noting PRs & rep gains' },
          { label: 'Volume', value: 'Tracking weekly sets' },
          { label: 'Consistency', value: 'Sessions completed' },
        ],
      },
      {
        key: 'next',
        icon: 'trophy-outline',
        title: 'NEXT MILESTONE',
        color: FEATURE_COLORS.generation,
        items: [
          { label: 'Target', value: 'Setting a clear next goal' },
          { label: 'Plan', value: 'Adjusting the next week' },
          { label: 'Timeline', value: 'Keeping expectations realistic' },
        ],
      },
    ];
  }

  // workout / general
  return [
    {
      key: 'analysis',
      icon: 'settings-outline',
      title: 'ANALYZING YOUR PROFILE',
      color: FEATURE_COLORS.analysis,
      items: [
        { label: 'Fitness level', value: level ? toTitleCase(level) : 'Estimating from your inputs' },
        { label: 'Goal', value: toTitleCase(goal) },
        { label: 'Available days', value: days ? `${days}/week` : 'Optimizing around your schedule' },
      ],
    },
    {
      key: 'generate',
      icon: 'list-outline',
      title: 'GENERATING WORKOUT PLAN',
      color: FEATURE_COLORS.generation,
      items: [
        { label: 'Split type', value: 'Choosing best weekly structure' },
        { label: 'Rep range', value: 'Aligning with your goal' },
        { label: 'Volume', value: 'Setting weekly sets per muscle' },
      ],
    },
    {
      key: 'opt',
      icon: 'sync-outline',
      title: 'OPTIMIZATION',
      color: FEATURE_COLORS.optimization,
      items: [
        { label: 'Recovery timing', value: 'Spacing muscle groups properly' },
        { label: 'Progression', value: 'Built-in overload strategy' },
        { label: 'Week 1', value: 'Ready to execute' },
      ],
    },
  ];
};

function FeatureCard({ t, icon, title, color, items }) {
  return (
    <View
      style={{
        backgroundColor: palette.cardBg,
        borderWidth: 1,
        borderColor: palette.cardBorder,
        borderLeftWidth: 3,
        borderLeftColor: color,
        borderRadius: 12,
        padding: 14,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Ionicons name={icon} size={16} color={color} />
        <Text style={{ fontSize: 11, letterSpacing: 0.5, fontWeight: '800', color: palette.textSecondary }}>
          {title}
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        {(items || []).slice(0, 4).map((it, idx) => (
          <View key={`${title}_${idx}`}>
            <Text style={{ fontSize: 13, color: palette.textPrimary, fontWeight: '500' }}>{it.label}</Text>
            <Text style={{ fontSize: 14, color, fontWeight: '800', marginTop: 2 }}>{it.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const COACH_WAIT_LABELS = {
  thinking: { icon: 'sparkles-outline', text: 'Coach is thinking…' },
  context: { icon: 'analytics-outline', text: 'Reviewing your week…' },
  drafting: { icon: 'create-outline', text: 'Writing your reply…' },
  web: { icon: 'globe-outline', text: 'Searching the web…' },
  working: { icon: 'checkmark-circle-outline', text: 'Applying your request…' },
};

function coachLoadingBubbleStyle(t, isDark) {
  return {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomLeftRadius: 6,
    backgroundColor: isDark ? AI_COACH_UI.surfaceElevated : '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: isDark ? 'rgba(255,255,255,0.14)' : '#E5E7EB',
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: isDark ? 0.22 : 0.06,
          shadowRadius: 6,
        }
      : { elevation: 2 }),
  };
}

// ─── Loading bubble only (thinking / web search / drafting) ───────────────────
function TypingIndicator({ t, phase = 'thinking', isDark = true }) {
  const dot1 = useRef(new Animated.Value(0.35)).current;
  const dot2 = useRef(new Animated.Value(0.35)).current;
  const dot3 = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const dots = [dot1, dot2, dot3];
    const loops = dots.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(anim, { toValue: 1, duration: 380, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.35, duration: 380, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => {
      loops.forEach((l) => l.stop());
    };
  }, [dot1, dot2, dot3]);

  const meta = COACH_WAIT_LABELS[phase] || COACH_WAIT_LABELS.thinking;

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 16 }}>
      <View style={coachLoadingBubbleStyle(t, isDark)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <LinearGradient
            colors={AI_COACH_UI.gradient.borderWarm}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 22,
              height: 22,
              borderRadius: 7,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={meta.icon} size={12} color="#fff" />
          </LinearGradient>
          <Text style={{ color: palette.textPrimary, fontSize: 14, fontWeight: '600', flexShrink: 1 }}>
            {meta.text}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            {[dot1, dot2, dot3].map((anim, i) => (
              <Animated.View
                key={i}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 2.5,
                  backgroundColor: phase === 'web' ? AI_COACH_UI.cyan : AI_COACH_UI.pink,
                  opacity: anim,
                }}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function CoachReplyHeader({ t, copyText }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
        <LinearGradient
          colors={AI_COACH_UI.gradient.borderWarm}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="sparkles" size={14} color="#fff" />
        </LinearGradient>
        <Text style={{ fontSize: 12, fontWeight: '700', color: palette.textSecondary, letterSpacing: 0.2 }}>
          Coach
        </Text>
      </View>
      {copyText ? <CoachMessageCopyButton text={copyText} palette={palette} align="flex-end" compact /> : null}
    </View>
  );
}

function CoachMessageCopyButton({ text, t, align = 'flex-end', compact = false }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const handleCopy = async () => {
    const ok = await copyCoachText(text, { announce: false });
    if (!ok) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (_) {
      /* ignore */
    }
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  };

  return (
    <Pressable
      onPress={handleCopy}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel={copied ? 'Copied to clipboard' : 'Copy message'}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: align,
        gap: compact ? 0 : 5,
        paddingVertical: compact ? 4 : 6,
        paddingHorizontal: compact ? 2 : 10,
        borderRadius: compact ? 8 : 16,
        backgroundColor: compact
          ? 'transparent'
          : pressed
            ? (copied ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.08)')
            : copied
              ? 'rgba(34,197,94,0.1)'
              : 'rgba(255,255,255,0.04)',
        borderWidth: compact ? 0 : 1,
        borderColor: copied ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.1)',
        alignSelf: align,
      })}
    >
      <Ionicons
        name={copied ? 'checkmark-circle' : 'copy-outline'}
        size={compact ? 16 : 18}
        color={copied ? AI_COACH_UI.green : palette.textSecondary}
      />
      {!compact ? (
      <Text
        style={{
          fontSize: 13,
          fontWeight: '800',
          color: copied ? AI_COACH_UI.green : palette.textSecondary,
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </Text>
      ) : null}
    </Pressable>
  );
}

function CoachSelectableMessageText({ text, color, isDark }) {
  const plain = coachPlainText(text);
  return (
    <Text
      selectable
      selectionColor={isDark ? 'rgba(236,72,153,0.35)' : 'rgba(190,24,93,0.25)'}
      style={{ color, fontSize: 15, lineHeight: 24 }}
    >
      {plain}
    </Text>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({
  message,
  t,
  onToolPress,
  isDark = true,
  lastUserText = '',
  threadMessages = null,
  toolModalVisible = false,
  showFollowUps = false,
  onFollowUpPress = null,
  userProfile = null,
}) {
  const sent = message.role === 'user';
  const atts = Array.isArray(message.attachments) ? message.attachments : [];
  const firstImage = atts.find((a) => a?.preview);
  const firstFile = !firstImage ? atts.find((a) => a && !a.preview) : null;
  const rawText = String(message.text || '');
  const displayText = sent ? rawText : stripCoachToolJsonFromReply(rawText);
  const hasText = !!displayText.trim();

  const renderContent = () => {
    if (!hasText && firstImage?.preview) {
      return <Image source={{ uri: firstImage.preview }} style={{ width: 220, height: 160 }} resizeMode="cover" />;
    }
    if (!hasText && firstFile) {
      return (
        <View style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name="document-outline" size={28} color={palette.textPrimary} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: palette.textPrimary }} numberOfLines={1}>
              {firstFile.name || 'File'}
            </Text>
            <Text style={{ fontSize: 11, marginTop: 2, color: palette.msgTimestamp }} numberOfLines={1}>
              Tap to view
            </Text>
          </View>
        </View>
      );
    }
    if (sent) {
      return (
        <CoachSelectableMessageText text={displayText} color={palette.textPrimary} isDark={isDark} />
      );
    }
    return (
      <CoachReplyText
        text={displayText}
        isDark={isDark}
        isWebSearch={message.searchedWeb === true || message.route === 'web-search'}
      />
    );
  };

  const userWrapStyle = { maxWidth: '82%' };
  const bubbleBase = { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12 };
  const attachmentOnly = !hasText && (firstImage || firstFile);
  const mediaStyle = attachmentOnly ? { paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' } : null;
  const copyText = coachPlainText(displayText) || displayText;

  if (sent) {
    return (
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 16 }}>
        <View style={userWrapStyle}>
          <View
            style={[
              bubbleBase,
              {
                borderBottomRightRadius: 4,
                overflow: 'hidden',
                backgroundColor: palette.msgReceivedBg,
                borderWidth: 1,
                borderColor: palette.msgReceivedBorder,
              },
              mediaStyle,
            ]}
          >
            <View pointerEvents="box-none">{renderContent()}</View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            {hasText ? <CoachMessageCopyButton text={copyText} palette={palette} align="flex-end" compact /> : null}
            <Text style={{ fontSize: 11, color: palette.msgTimestamp }}>{message.time}</Text>
          </View>
        </View>
      </View>
    );
  }

  const askedForWeb = shouldShowWebSearchUI(lastUserText, threadMessages);
  const webStatusLabel = message.searchedWeb
    ? 'Searched the web'
    : askedForWeb && message.route !== 'web-search'
      ? 'Answered from coaching knowledge (live search unavailable)'
      : null;

  return (
    <View style={{ width: '100%', marginBottom: 24, alignSelf: 'stretch' }}>
      <CoachReplyHeader palette={palette} copyText={hasText ? copyText : null} />
      {webStatusLabel ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginBottom: 10,
          }}
        >
          <Ionicons
            name={message.searchedWeb ? 'globe-outline' : 'book-outline'}
            size={14}
            color={message.searchedWeb ? AI_COACH_UI.cyan : palette.textSecondary}
          />
          <Text style={{ fontSize: 12, fontWeight: '600', color: palette.textSecondary, flex: 1 }}>
            {webStatusLabel}
          </Text>
        </View>
      ) : null}
      {attachmentOnly && firstImage?.preview ? (
        <View
          style={{
            borderRadius: 14,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: isDark ? AI_COACH_UI.borderHairline : palette.chipBorder,
            marginBottom: 8,
          }}
        >
          {renderContent()}
        </View>
      ) : (
        renderContent()
      )}
      <SourceLinkCards message={message} isDark={isDark} />
      {coachActionPromptVisible(message, lastUserText) && !toolModalVisible ? (
        <ToolActionChip message={message} onPress={onToolPress} palette={palette} userMessage={lastUserText} />
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
        <Text style={{ fontSize: 11, color: palette.msgTimestamp, flex: 1 }}>{message.time}</Text>
      </View>
    </View>
  );
}


/**
 * After a tool succeeds: haptic, refresh coach context, maybe refresh nutrition UI.
 */
async function runAfterSuccessfulCoachTool({ toolName, refreshCoachContext, onNutritionDataChanged }) {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (_) {
    /* ignore haptic failures */
  }
  await refreshCoachContext(true);
  const touchesNutrition =
    toolName === 'logNutrition' ||
    toolName === 'adjustMacroTargets' ||
    toolName === 'deleteLog';
  if (touchesNutrition) {
    await onNutritionDataChanged?.();
  }
}

/**
 * Build the next message list after a tool runs (mark chip confirmed + optional result bubble).
 */
function messagesAfterToolRun(prevMessages, {
  runMessageId,
  pendingToolMessageId,
  merged,
  result,
  inline,
  resultMsg,
  nowFn,
}) {
  let targetId = runMessageId || pendingToolMessageId;
  if (!targetId) {
    const match = [...prevMessages].reverse().find(
      (message) =>
        message.role === 'ai' &&
        !message.toolConfirmed &&
        (message.toolCall || resolveMessageToolCall(message)),
    );
    targetId = match?.id || null;
  }

  const marked = prevMessages.map((message) => {
    if (!targetId || message.id !== targetId) return message;
    return {
      ...message,
      toolConfirmed: result.success,
      toolCall: message.toolCall || merged,
    };
  });

  let next = result.success ? marked : [...marked, resultMsg];
  if (result.success && inline && result.message) {
    next = [
      ...marked,
      {
        id: `msg_tool_ok_${Date.now()}`,
        role: 'ai',
        text: result.message,
        time: nowFn(),
        isToolResult: true,
        toolConfirmed: true,
      },
    ];
  }
  return { next, targetId, resultMsg };
}

/**
 * Persist only the messages that changed because of this tool run.
 */
function persistToolRunMessages({
  next,
  targetId,
  result,
  inline,
  resultMsg,
  userId,
  sessionId,
}) {
  if (!db || !userId) return;
  const toPersist = next.filter((message) => {
    if (targetId && message.id === targetId) return true;
    if (result.success && inline && result.message && message.id?.startsWith('msg_tool_ok_')) return true;
    if (!result.success && message.id === resultMsg.id) return true;
    return false;
  });
  const lastUser = [...next].reverse().find((message) => message.role === 'user');
  const lastAi = [...next].reverse().find((message) => message.role === 'ai');
  upsertAiChatMessages(userId, sessionId, toPersist, {
    sessionId,
    lastUserMessage: lastUser?.text || '',
    lastAssistantMessage: lastAi?.text || '',
  }).catch(() => {});
}


/**
 * Run carryOutAction, update messages, then refresh context / clear the modal.
 * Kept outside the screen so handleToolConfirm stays a shallow recipe.
 */
async function executeConfirmedCoachTool({
  userId,
  trainerId,
  planId,
  merged,
  onOpenWorkoutPlan,
  runMessageId,
  pendingToolMessageId,
  inline,
  setMessages,
  refreshCoachContext,
  onNutritionDataChanged,
  setToolModalVisible,
  setPendingToolCall,
  setPendingToolMessageId,
  scrollToBottom,
  sessionId,
}) {
  const result = await carryOutAction({
    userId,
    trainerId,
    planId,
    toolCall: merged,
    navigationHandlers: { onOpenWorkoutPlan },
  });

  const resultMsg = {
    id: `msg_tool_${Date.now()}`,
    role: 'ai',
    text: result.message || 'Could not complete that action.',
    time: now(),
    isError: true,
    toolConfirmed: true,
    isToolResult: true,
  };

  setMessages((prev) => {
    const { next, targetId } = messagesAfterToolRun(prev, {
      runMessageId,
      pendingToolMessageId,
      merged,
      result,
      inline,
      resultMsg,
      nowFn: now,
    });
    persistToolRunMessages({
      next,
      targetId,
      result,
      inline,
      resultMsg,
      userId,
      sessionId,
    });
    return next;
  });

  if (result.success) {
    await runAfterSuccessfulCoachTool({
      toolName: merged.name,
      refreshCoachContext,
      onNutritionDataChanged,
    });
  } else {
    Alert.alert('Action failed', result.message || 'Could not complete that action.');
  }

  setToolModalVisible(false);
  setPendingToolCall(null);
  setPendingToolMessageId(null);
  scrollToBottom();
}

/** Refuse file-only attachments; coach currently analyzes photos only. */
function coachAttachmentGateMessage(atts) {
  const imageAtts = atts.filter((attachment) => attachment?.type === 'image' || attachment?.preview);
  const hasFilesOnly = atts.some((attachment) => attachment?.type === 'file') && imageAtts.length === 0;
  if (hasFilesOnly) {
    return {
      ok: false,
      imageAtts,
      title: 'Photos work best',
      message:
        'The coach can analyze progress photos right now. PDF and document reading is not wired yet — attach a photo instead.',
    };
  }
  if (atts.length > 0 && imageAtts.length === 0) {
    return {
      ok: false,
      imageAtts,
      title: 'Could not read photo',
      message: 'Try picking the image again.',
    };
  }
  return { ok: true, imageAtts };
}

/** Turn a thrown error into a short coach bubble string. */
function friendlyCoachSendErrorMessage(err) {
  const raw = String(err?.message || '');
  if (raw.includes('invalid data') || raw.includes('Unsupported field value')) {
    return 'Could not save this message. Please try again.';
  }
  if (raw.includes('network') || raw.includes('Network')) {
    return 'Network error — check your connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}

/**
 * After the API returns: build the AI bubble, maybe auto-run a tool, persist.
 */
async function finishCoachSendSuccess({
  coachResponse,
  text,
  updatedMessages,
  plannedCards,
  userProfile,
  setMessages,
  setTyping,
  setSearchingWeb,
  clearFeatureTimers,
  setActiveFeatureCards,
  handleToolConfirm,
  openToolModal,
  db,
  userId,
  persistSession,
  sessionId,
}) {
  const resolvedTool = resolveIncomingCoachTool(coachResponse, text.trim());
  const prepared = prepareCoachReplyForDisplay(coachResponse.message || '', {
    userMessage: text.trim(),
    searchedWeb: coachResponse.searchedWeb === true,
    userProfile: userProfile || {},
  });

  const aiMsg = {
    id: `msg_${Date.now() + 1}`,
    role: 'ai',
    text: prepared.displayText,
    followUpPrompts: prepared.followUpPrompts,
    time: now(),
    source: coachResponse.source,
    toolCall: resolvedTool,
    searchedWeb: coachResponse.searchedWeb === true,
    webProvider: coachResponse.webProvider || null,
    route: coachResponse.route || null,
    webSources: Array.isArray(coachResponse.webSources) ? coachResponse.webSources : [],
    featureCards: plannedCards,
    isError: !coachResponse.success,
  };

  const debugMeta = {
    sessionId,
    route: aiMsg.route,
    searchedWeb: aiMsg.searchedWeb,
    webProvider: aiMsg.webProvider,
    source: aiMsg.source,
    success: coachResponse.success,
    toolCall: resolvedTool,
    webSources: aiMsg.webSources,
  };
  logCoachAssistantMessage(aiMsg.text, debugMeta);
  logCoachTurnBundle({ userText: text.trim(), coachText: aiMsg.text, meta: debugMeta });

  const finalMessages = [...updatedMessages, aiMsg];
  setMessages(finalMessages);
  setTyping(false);
  setSearchingWeb(false);
  clearFeatureTimers();
  setActiveFeatureCards([]);

  maybeAutoRunOrOpenCoachTool({
    resolvedTool,
    coachResponse,
    text,
    aiMsgId: aiMsg.id,
    handleToolConfirm,
    openToolModal,
  });

  if (db && userId) {
    await persistSession(finalMessages);
  }
}

/** Auto-execute, open confirm modal, or log a debug nudge — one branch only. */
function maybeAutoRunOrOpenCoachTool({
  resolvedTool,
  coachResponse,
  text,
  aiMsgId,
  handleToolConfirm,
  openToolModal,
}) {
  if (resolvedTool && shouldAutoExecuteCoachTool(resolvedTool, { userText: text.trim() })) {
    handleToolConfirm({}, resolvedTool, { inline: true, messageId: aiMsgId });
    return;
  }
  if (
    resolvedTool &&
    shouldAutoOpenCoachToolModal(resolvedTool, {
      fromServer: !!coachResponse?.toolCall,
      userText: text.trim(),
    })
  ) {
    openToolModal(resolvedTool, aiMsgId);
    return;
  }
  const looksLikeAction =
    coachResponse.success &&
    /\b(log|swap|bump|schedule|deload|notify|adjust)\b/i.test(text.trim());
  if (!resolvedTool && looksLikeAction) {
    logger.debug('AI Coach: action-like message but no toolCall returned');
  }
}

/**
 * Persist first message if needed, call the coach API, then finish the success path.
 */
async function runCoachSendPipeline({
  text,
  updatedMessages,
  imageAtts,
  plannedCards,
  messagesBeforeSend,
  userId,
  userProfile,
  coachContext,
  db,
  persistSession,
  setMessages,
  setTyping,
  setSearchingWeb,
  clearFeatureTimers,
  setActiveFeatureCards,
  handleToolConfirm,
  openToolModal,
  sessionId,
}) {
  if (db && userId) {
    const isFirstMessage = messagesBeforeSend.length === 0;
    await persistSession(updatedMessages, isFirstMessage ? { createdAt: serverTimestamp() } : {});
  }

  const coachResponse = await sendCoachMessageWithRetry({
    userId,
    userMessage: text.trim(),
    messages: updatedMessages,
    userProfile: userProfile || {},
    coachContext,
    attachments: imageAtts,
  });

  await finishCoachSendSuccess({
    coachResponse,
    text,
    updatedMessages,
    plannedCards,
    userProfile,
    setMessages,
    setTyping,
    setSearchingWeb,
    clearFeatureTimers,
    setActiveFeatureCards,
    handleToolConfirm,
    openToolModal,
    db,
    userId,
    persistSession,
    sessionId,
  });
}

// ===== MAIN FUNCTION =====

/**
 * Full-screen AI coach conversation (messages, composer, tool confirm modal).
 * @param {object} props
 */
export default function CoachConversationScreen({
  prefill,
  sessionId: initialSessionId,
  userId,
  userProfile,
  trainerId: trainerIdProp,
  onBack,
  initialAttachments = [],
  openAttachmentsOnMount = false,
  onHomePress,
  onPlusPress,
  onVoicePress,
  onNutritionPress,
  onWorkoutPress,
  onOpenWorkoutPlan,
  onMessagesPress,
  onProfilePress,
  onSettingsPress,
  onNutritionDataChanged,
  hideBottomNav = false,
  enableHistorySidebar = false,
  onSessionSwitch,
  onNewChat,
}) {
  const insets = useSafeAreaInsets();
  const isWideLayout = Dimensions.get('window').width >= WIDE_LAYOUT_MIN_WIDTH;
  const { keyboardVisible, composerKeyboardPad, listBottomPad } =
    keyboardBehavior({ hideBottomNav });
  const { isDark } = useTheme();
  const palette = isDark ? DARK : LIGHT;
  const flatListRef = useRef(null);
  const prefillSent = useRef(false);
  const sessionTitleRef = useRef(null);
  const mountAttachmentsRef = useRef(Array.isArray(initialAttachments) ? initialAttachments : []);

  const [messages, setMessages] = useState([]);
  const composer = typingBox('');
  const {
    value: input,
    onChangeText: setInput,
    clear: clearComposer,
    commitText,
    applySpeechTranscript,
    openPasteSheet,
    closePasteSheet,
    pasteSheetVisible,
    inputRef: composerInputRef,
  } = composer;
  const [typing, setTyping] = useState(false);
  const [searchingWeb, setSearchingWeb] = useState(false);
  const [coachWaitPhase, setCoachWaitPhase] = useState('thinking');
  const [attachments, setAttachments] = useState(() =>
    Array.isArray(initialAttachments) ? initialAttachments : []
  );
  const [sessionId] = useState(initialSessionId || `aiChat_${Date.now()}`);
  const [loadedSession, setLoadedSession] = useState(!initialSessionId);
  const [activeFeatureCards, setActiveFeatureCards] = useState([]);
  const [coachContext, setCoachContext] = useState(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [contextQuality, setContextQuality] = useState(0);
  const [recalibrationNote, setRecalibrationNote] = useState(null);
  const [toolModalVisible, setToolModalVisible] = useState(false);
  const [pendingToolCall, setPendingToolCall] = useState(null);
  const [pendingToolMessageId, setPendingToolMessageId] = useState(null);
  const [toolExecuting, setToolExecuting] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(!isWideLayout);
  const [historyOverlayOpen, setHistoryOverlayOpen] = useState(false);
  const coachSessions = chatHistoryList(userId);
  const featureTimers = useRef([]);

  const trainerId = trainerIdProp || userProfile?.trainerId || userProfile?.trainer?.id || null;
  const planId = 'current';

  const canSend = input.trim().length > 0 || attachments.length > 0;

  const coachSpeech = useCoachSpeech({
    onPartialTranscript: applySpeechTranscript,
    onFinalTranscript: applySpeechTranscript,
  });
  const { listening, toggleListen } = coachSpeech;

  useEffect(() => {
    if (!typing) {
      setCoachWaitPhase('thinking');
      return undefined;
    }
    if (searchingWeb) {
      setCoachWaitPhase('web');
      return undefined;
    }
    setCoachWaitPhase('thinking');
    const tContext = setTimeout(() => setCoachWaitPhase('context'), WAIT_PHASE_CONTEXT_MS);
    const tDraft = setTimeout(() => setCoachWaitPhase('drafting'), WAIT_PHASE_DRAFTING_MS);
    return () => {
      clearTimeout(tContext);
      clearTimeout(tDraft);
    };
  }, [typing, searchingWeb]);

  useEffect(() => {
    if (typing || toolExecuting) scrollToBottom();
  }, [typing, toolExecuting, coachWaitPhase, searchingWeb]);

  const persistSession = async (msgs, extraMeta = {}) => {
    if (!db || !userId) return;
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
    const lastAi = [...msgs].reverse().find((m) => m.role === 'ai');
    const hasAiReply = Boolean(lastAi);

    let title = extraMeta.title || sessionTitleRef.current;

    if (!hasAiReply) {
      title = title && !needsCreativeTitle(title, lastUser?.text) ? title : 'New Chat';
    } else if (!title || title === 'New Chat' || needsCreativeTitle(title, lastUser?.text)) {
      const convo = msgs
        .filter((m) => m.role === 'user' || m.role === 'ai')
        .map((m) => ({ role: m.role, content: m.text }));
      const fallback =
        buildCreativeTitleLocal(lastUser?.text, lastAi?.text) ||
        deriveChatTitle(lastUser?.text || '');
      title = await makeChatTitle(convo, fallback, userId);
      sessionTitleRef.current = title;
    }

    await persistAiChatSession(userId, sessionId, {
      messages: msgs,
      meta: {
        sessionId,
        title,
        lastUserMessage: lastUser?.text || '',
        lastAssistantMessage: lastAi?.text || '',
        ...extraMeta,
      },
    });
  };

  const scrollToBottom = () => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const refreshCoachContext = async (skipRecalibration = false) => {
    if (!userId) {
      setCoachContext(null);
      setContextLoading(false);
      return;
    }
    setContextLoading(true);
    const ctx = await loadCoachContextEnhanced(userId, userProfile || {}, { skipRecalibration });
    setCoachContext(ctx);
    setContextQuality(ctx?._dataQuality ?? 0);
    setRecalibrationNote(ctx?._recalibrationNote || null);
    setContextLoading(false);
  };

  const openToolModal = (toolCall, messageId = null) => {
    const normalized = guardCoachToolProposal(normalizeToolCall(toolCall));
    if (!normalized) {
      Alert.alert('Action unavailable', 'This coach action could not be loaded. Try asking again.');
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {
      /* ignore */
    }
    setPendingToolCall(normalized);
    setPendingToolMessageId(messageId);
    setToolModalVisible(true);
  };

  // 1. Merge confirmed params → run the tool → update chat → refresh context.
  const handleToolConfirm = async (confirmedParams = {}, toolOverride = null, runOptions = {}) => {
    const { inline = false, messageId: runMessageId = null } = runOptions;
    const baseTool = toolOverride || pendingToolCall;
    if (!userId) {
      Alert.alert('Sign in required', 'Please sign in again to run coach actions.');
      return;
    }
    if (!baseTool) {
      Alert.alert('Nothing to confirm', 'Tap Confirm Action on the coach message first.');
      return;
    }
    if (toolExecuting) return;

    const mergedRaw = {
      ...baseTool,
      params: { ...(baseTool.params || {}), ...(confirmedParams || {}) },
    };
    const merged = guardCoachToolProposal(mergedRaw);
    if (!merged) {
      Alert.alert('Action unavailable', 'This coach action could not be validated. Try asking again.');
      return;
    }

    setToolExecuting(true);
    if (__DEV__) console.log('[coach-tool] Confirm tapped:', merged.name, merged.params);

    try {
      await executeConfirmedCoachTool({
        userId,
        trainerId,
        planId,
        merged,
        onOpenWorkoutPlan,
        runMessageId,
        pendingToolMessageId,
        inline,
        setMessages,
        refreshCoachContext,
        onNutritionDataChanged,
        setToolModalVisible,
        setPendingToolCall,
        setPendingToolMessageId,
        scrollToBottom,
        sessionId,
      });
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_tool_err_${Date.now()}`,
          role: 'ai',
          text: error?.message || 'Something went wrong running that action.',
          time: now(),
          isError: true,
        },
      ]);
    } finally {
      setToolExecuting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId) {
        setCoachContext(null);
        setContextLoading(false);
        return;
      }
      setContextLoading(true);
      const ctx = await loadCoachContextEnhanced(userId, userProfile || {});
      if (!cancelled) {
        setCoachContext(ctx);
        setContextQuality(ctx?._dataQuality ?? 0);
        setRecalibrationNote(ctx?._recalibrationNote || null);
        setContextLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, userProfile]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!db || !userId || !initialSessionId) {
        setLoadedSession(true);
        return;
      }
      try {
        const [saved, meta] = await Promise.all([
          loadAiChatMessages(userId, initialSessionId),
          loadAiChatSessionMeta(userId, initialSessionId),
        ]);
        if (meta?.title && !needsCreativeTitle(meta.title, meta.lastUserMessage)) {
          sessionTitleRef.current = meta.title;
        }
        const restored = restoreChatMessagesFromSaved(saved)
          .map((m) => {
            if (m.role !== 'ai') return m;
            const parsedTool = m.toolCall || readActionsFromReply(m.text)[0] || null;
            return {
              ...m,
              text: stripCoachToolJsonFromReply(m.text) || m.text,
              toolCall: parsedTool ? guardCoachToolProposal(normalizeToolCall(parsedTool)) : null,
            };
          })
          .filter((m) => m.text.trim().length > 0 || (Array.isArray(m.attachments) && m.attachments.length > 0));

        if (!cancelled) {
          setMessages(restored);
          setLoadedSession(true);
          setTimeout(scrollToBottom, 50);
        }
      } catch (e) {
        if (!cancelled) setLoadedSession(true);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [initialSessionId, userId]);

  const clearFeatureTimers = () => {
    (featureTimers.current || []).forEach((id) => clearTimeout(id));
    featureTimers.current = [];
  };

  // 2. User hits send → optimistic bubble → API → AI bubble (maybe auto-confirm a tool).
  const sendMessage = async (text, atts = []) => {
    if (!text.trim() && atts.length === 0) return;

    const gate = coachAttachmentGateMessage(atts);
    if (!gate.ok) {
      Alert.alert(gate.title, gate.message);
      return;
    }
    const imageAtts = gate.imageAtts;

    const userMsg = {
      id: `msg_${Date.now()}`,
      role: 'user',
      text: text.trim(),
      time: now(),
      attachments: atts.length > 0 ? [...atts] : undefined,
    };

    const updatedMessages = [...messages, userMsg];
    const plannedWeb = shouldShowWebSearchUI(text, updatedMessages);
    const plannedCards = buildFeatureCards({ userText: text, userProfile: userProfile || {} });
    setMessages(updatedMessages);
    clearComposer();
    setAttachments([]);
    setTyping(true);
    setSearchingWeb(plannedWeb);
    setActiveFeatureCards([]);
    clearFeatureTimers();
    featureTimers.current = [
      setTimeout(() => setActiveFeatureCards(plannedCards?.slice?.(0, 1) || []), 120),
      setTimeout(() => setActiveFeatureCards(plannedCards?.slice?.(0, 2) || []), 950),
      setTimeout(() => setActiveFeatureCards(plannedCards?.slice?.(0, 3) || []), FEATURE_CARDS_REVEAL_MS),
    ];
    scrollToBottom();

    logCoachUserMessage(text.trim(), {
      sessionId,
      attachmentCount: imageAtts.length,
      plannedWeb,
    });

    try {
      await runCoachSendPipeline({
        text,
        updatedMessages,
        imageAtts,
        plannedCards,
        messagesBeforeSend: messages,
        userId,
        userProfile,
        coachContext,
        db,
        persistSession,
        setMessages,
        setTyping,
        setSearchingWeb,
        clearFeatureTimers,
        setActiveFeatureCards,
        handleToolConfirm,
        openToolModal,
        sessionId,
      });
    } catch (err) {
      logCoachError(err, text.trim(), { sessionId, plannedWeb });
      console.error('AI coach error:', err);
      const friendly = friendlyCoachSendErrorMessage(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_err_${Date.now()}`,
          role: 'ai',
          text: friendly,
          time: now(),
          featureCards: plannedCards,
          isError: true,
        },
      ]);
    } finally {
      setTyping(false);
      setSearchingWeb(false);
      clearFeatureTimers();
      setActiveFeatureCards([]);
      scrollToBottom();
    }
  };

  useEffect(() => {
    if (!loadedSession || prefillSent.current) return;
    const text = String(prefill || '').trim();
    const atts = mountAttachmentsRef.current || [];
    if (!text && atts.length === 0) return;
    prefillSent.current = true;
    setTimeout(() => sendMessage(text, atts), 350);
  }, [prefill, loadedSession]);

  const handlePhotoLibrary = async () => {
    const newAtts = await pickCoachPhotosFromLibrary();
    if (newAtts.length > 0) setAttachments((prev) => [...prev, ...newAtts]);
  };

  const handleCamera = async () => {
    const newAtts = await pickCoachPhotoFromCamera();
    if (newAtts.length > 0) setAttachments((prev) => [...prev, ...newAtts]);
  };

  const handleFile = async () => {
    const newAtts = await pickCoachDocuments();
    if (newAtts.length > 0) setAttachments((prev) => [...prev, ...newAtts]);
  };

  const openAttachMenu = () => {
    showCoachAttachMenu({
      onPhotoLibrary: handlePhotoLibrary,
      onCamera: handleCamera,
      onFile: handleFile,
    });
  };

  useEffect(() => {
    if (loadedSession && openAttachmentsOnMount) {
      openAttachMenu();
    }
  }, [loadedSession, openAttachmentsOnMount]);

  const removeAttachment = (id) => setAttachments((prev) => prev.filter((a) => a.id !== id));

  const handleDeleteSession = (session) => {
    const sid = session?.sessionId || session?.id;
    if (!db || !userId || !sid) return;
    Alert.alert('Delete chat?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAiChatSession(userId, sid);
            if (sid === sessionId && onNewChat) onNewChat();
          } catch (err) {
            logger?.error?.('deleteAiChatSession failed', err);
          }
        },
      },
    ]);
  };

  const handleSessionPress = (session) => {
    const sid = session?.sessionId || session?.id;
    if (!sid || sid === sessionId) return;
    setHistoryOverlayOpen(false);
    onSessionSwitch?.(session);
  };

  const handleSidebarNewChat = () => {
    setHistoryOverlayOpen(false);
    if (onNewChat) {
      onNewChat();
      return;
    }
    onBack?.();
  };

  const buildPills = () => {
    const historyText = messages.map((m) => (m.role === 'user' ? m.text : '')).join(' | ').toLowerCase();
    const goal = String(userProfile?.primaryGoal || userProfile?.goal || '').toLowerCase();
    const hasMessages = messages.length > 0;

    if (!hasMessages) {
      return [
        { text: 'Build me a plan', color: FEATURE_COLORS.generation },
        { text: 'Form check', color: FEATURE_COLORS.optimization },
        { text: 'Nutrition help', color: FEATURE_COLORS.tracking },
        { text: 'Track progress', color: FEATURE_COLORS.goals },
      ];
    }

    if (historyText.includes('hypertrophy') || historyText.includes('bulk') || goal.includes('muscle')) {
      return [
        { text: 'Optimize my split', color: FEATURE_COLORS.generation },
        { text: 'Chest exercises', color: FEATURE_COLORS.analysis },
        { text: 'Bulk nutrition', color: FEATURE_COLORS.tracking },
        { text: 'Am I eating enough?', color: FEATURE_COLORS.goals },
      ];
    }

    if (historyText.includes('skinny fat') || historyText.includes('recomp') || goal.includes('fat')) {
      return [
        { text: 'Body recomp tips?', color: FEATURE_COLORS.generation },
        { text: 'Cutting protocol', color: FEATURE_COLORS.tracking },
        { text: 'Recovery help', color: FEATURE_COLORS.analysis },
        { text: 'Why plateaued?', color: FEATURE_COLORS.goals },
      ];
    }

    return [
      { text: 'Adjust my routine', color: FEATURE_COLORS.generation },
      { text: 'Meal timing', color: FEATURE_COLORS.tracking },
      { text: 'Recovery tips', color: FEATURE_COLORS.analysis },
      { text: 'Progress check', color: FEATURE_COLORS.goals },
    ];
  };

  const messagesWithContext = useMemo(() => {
    let lastUserText = '';
    return messages.map((m, index) => {
      if (m.role === 'user') lastUserText = m.text || '';
      const threadMessages = messages.slice(0, index + 1).map((row) => ({
        role: row.role === 'ai' ? 'assistant' : 'user',
        text: row.text || '',
        content: row.text || '',
      }));
      return {
        ...m,
        lastUserText,
        threadMessages,
        isLastAssistant:
          m.role === 'ai' && index === messages.length - 1 && !typing && !toolExecuting,
      };
    });
  }, [messages, typing, toolExecuting]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, flexDirection: 'row' }}>
      {enableHistorySidebar ? (
        <PastChatsPanel
          mode="docked"
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          sessions={coachSessions}
          activeSessionId={sessionId}
          onSessionPress={handleSessionPress}
          onDeleteSession={handleDeleteSession}
          onNewChat={handleSidebarNewChat}
          isDark={isDark}
          insets={insets}
        />
      ) : null}

      <View style={{ flex: 1, minWidth: 0 }}>
      <TopHeader
        isDark={isDark}
        onBack={onBack}
        onProfilePress={onProfilePress}
        onSettingsPress={onSettingsPress}
        headerLeft={
          !enableHistorySidebar ? (
            <TouchableOpacity
              onPress={() => setHistoryOverlayOpen(true)}
              activeOpacity={0.88}
              accessibilityLabel="Chat history"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(10,10,15,0.10)',
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              }}
            >
              <Ionicons name="time-outline" size={18} color={isDark ? '#FF6B9D' : '#BE185D'} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0A0A0F' }}>History</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <View style={{ flex: 1 }}>
        {messages.length === 0 && !typing && !keyboardVisible ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <LottieView
              source={require('../../assets/animations/legacy/Cloud robotics abstract.json')}
              autoPlay
              loop
              style={{ width: 100, height: 100 }}
            />
            <Text style={{ color: palette.textSecondary, fontSize: 14, marginTop: 16 }}>Ask me anything to get started.</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messagesWithContext}
            accessibilityLabel="Coach conversation messages"
            keyExtractor={(m) => m.id}
            initialNumToRender={20}
            maxToRenderPerBatch={10}
            windowSize={10}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                palette={palette}
                isDark={isDark}
                onToolPress={openToolModal}
                lastUserText={item.lastUserText}
                threadMessages={item.threadMessages}
                toolModalVisible={toolModalVisible}
                showFollowUps={item.isLastAssistant}
                onFollowUpPress={sendMessage}
                userProfile={userProfile}
              />
            )}
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: listBottomPad,
            }}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="always"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            scrollEventThrottle={16}
            removeClippedSubviews={false}
            onContentSizeChange={scrollToBottom}
            ListFooterComponent={
              typing || toolExecuting ? (
                <TypingIndicator palette={palette} isDark={isDark} phase={toolExecuting ? 'working' : coachWaitPhase} />
              ) : null
            }
            ListFooterComponentStyle={{ paddingBottom: 4 }}
          />
        )}

        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: attachments.length > 0 ? 10 : 8,
            paddingBottom: composerKeyboardPad,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: palette.inputBarBorder,
            backgroundColor: palette.inputBarBg,
          }}
        >
          {attachments.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={{ flexGrow: 0, marginBottom: 10 }}
              contentContainerStyle={{ gap: 10, alignItems: 'center' }}
            >
              {attachments.map((att) => (
                <View key={att.id} style={{ position: 'relative' }}>
                  {att.preview ? (
                    <Image
                      source={{ uri: att.preview }}
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: palette.chipBorder,
                      }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 12,
                        backgroundColor: palette.chipBg,
                        borderWidth: 1,
                        borderColor: palette.chipBorder,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="document-outline" size={22} color={palette.textSecondary} />
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={() => removeAttachment(att.id)}
                    {...a11yButton('Remove attachment')}
                    hitSlop={MIN_TOUCH_HIT_SLOP}
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: palette.textSecondary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="close" size={13} color={palette.bg} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
            <TouchableOpacity
              onPress={openAttachMenu}
              {...a11yButton('Add attachment', 'Attach a photo or document')}
              hitSlop={MIN_TOUCH_HIT_SLOP}
              style={{ padding: 4, marginBottom: 4 }}
            >
              <Ionicons
                name="add-circle-outline"
                size={26}
                color={isDark ? AI_COACH_UI.composer.iconAttach : AI_COACH_UI.composer.iconAttachLight}
              />
            </TouchableOpacity>
            <TextInput
              ref={composerInputRef}
              {...COACH_COMPOSER_TEXT_INPUT_PROPS}
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 40,
                maxHeight: 120,
                fontSize: 15,
                color: palette.textPrimary,
                paddingVertical: 10,
                paddingHorizontal: 14,
                backgroundColor: palette.inputBg,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: palette.inputBorder,
              }}
              value={input}
              onChangeText={setInput}
              onLongPress={openPasteSheet}
              placeholder="Ask your coach..."
              placeholderTextColor={palette.textMuted}
              accessibilityLabel="Message input"
              accessibilityHint="Type a question for your AI coach"
              multiline
              blurOnSubmit={false}
            />
            <TouchableOpacity
              onPress={toggleListen}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 2,
                backgroundColor: listening
                  ? (isDark ? AI_COACH_UI.composer.micActiveBg : AI_COACH_UI.composer.micActiveBgLight)
                  : 'transparent',
              }}
              accessibilityLabel={listening ? 'Stop voice input' : 'Start voice input'}
            >
              <Ionicons
                name={listening ? 'mic' : 'mic-outline'}
                size={22}
                color={isDark ? AI_COACH_UI.composer.iconMic : AI_COACH_UI.composer.iconMicLight}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => sendMessage(input, attachments)}
              disabled={!canSend}
              activeOpacity={0.85}
              {...a11yButton('Send message', 'Sends your message to the AI coach')}
              accessibilityState={{ disabled: !canSend }}
              hitSlop={MIN_TOUCH_HIT_SLOP}
              style={{ marginBottom: 2, opacity: canSend ? 1 : 0.45 }}
            >
              <LinearGradient
                colors={isDark ? COMPOSER_SEND_GRAD : COMPOSER_SEND_GRAD_LIGHT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <PasteTextPopup
        visible={pasteSheetVisible}
        onClose={closePasteSheet}
        onConfirm={commitText}
        palette={palette}
        isDark={isDark}
      />

      <ConfirmActionPopup
        visible={toolModalVisible}
        toolCall={pendingToolCall}
        onConfirm={handleToolConfirm}
        onCancel={() => {
          if (toolExecuting) return;
          setToolModalVisible(false);
          setPendingToolCall(null);
          setPendingToolMessageId(null);
        }}
        loading={toolExecuting}
      />

      {!hideBottomNav && !keyboardVisible ? (
        <ShellBottomNavAnchor>
          <BottomMenuBar
            onHomePress={onHomePress || (() => {})}
            onPlusPress={onPlusPress || (() => {})}
            onVoicePress={onVoicePress || (() => {})}
            onNutritionPress={onNutritionPress || (() => {})}
            onWorkoutPress={onWorkoutPress || (() => {})}
            onMessagesPress={onMessagesPress || (() => {})}
            onProfilePress={onProfilePress || (() => {})}
            activeTabKey="ai"
          />
        </ShellBottomNavAnchor>
      ) : null}

      {!enableHistorySidebar ? (
        <PastChatsPanel
          mode="overlay"
          open={historyOverlayOpen}
          onClose={() => setHistoryOverlayOpen(false)}
          sessions={coachSessions}
          activeSessionId={sessionId}
          onSessionPress={(session) => {
            setHistoryOverlayOpen(false);
            handleSessionPress(session);
          }}
          onDeleteSession={handleDeleteSession}
          onNewChat={handleSidebarNewChat}
          isDark={isDark}
          insets={insets}
        />
      ) : null}
      </View>
    </View>
  );
}

