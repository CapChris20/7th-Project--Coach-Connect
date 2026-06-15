/**
 * AIChat Screen
 *
 * Purpose: UI screen or component: AIChat Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/aiChat
 * Key exports: AIChatScreen
 *
 * @file-header
 */
/**
 * AIChatScreen.jsx — React Native
 * Converted from Lovable export (lovable-export-d5e2ed71)
 *
 * Place at: src/aiChat/screens/AIChatScreen.jsx
 * Replaces: VoiceAIChatScreen.jsx
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Animated,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import { showCoachAttachMenu } from '../chat-thread/openAttachmentMenu';
import {
  pickCoachDocuments,
  pickCoachPhotoFromCamera,
  pickCoachPhotosFromLibrary,
} from '../chat-thread/pickAttachmentType';
import * as Haptics from 'expo-haptics';
import { serverTimestamp } from 'firebase/firestore';
import logger from '../../shared/api/logErrorToServer';
import { db } from '../../app/config';
import {
  loadAiChatMessages,
  persistAiChatSession,
  restoreChatMessagesFromSaved,
} from '../persistence/saveCoachMessagesToFirestore';
import { useCoachComposerInput } from '../hooks/useCoachComposerInput';
import CoachPasteSheet from '../components/CoachPasteSheet';
import CoachConnectHeader from '../../shared/components/CoachConnectHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import { BOTTOM_NAV_BAR_HEIGHT } from '../../navigation/bottomNavMetrics';
import { useTheme } from '../../shared/ui/ThemeContext';
import { coachPlainText, copyCoachText } from '../lib/coachClipboard';
import { loadCoachContextEnhanced } from '../../ai/context/CoachContextProvider';
import { sendCoachMessageWithRetry } from '../../ai/chat-api/aiCoachServerService';
import ToolConfirmationModal from '../components/ToolConfirmationModal';
import { executeCoachTool, normalizeToolCall, TOOL_DISPLAY_NAMES } from '../../ai/tools/executeCoachTool';
import { inferToolCallFromCoachMessage } from '../../ai/tools/parseUserMessageForTools';
import { useCoachSpeech } from '../voice/useVoiceToCoach';
import { shouldShowWebSearchUI } from '../../ai/chat-api/detectWebSearchRequest';
import { a11yButton, MIN_TOUCH_HIT_SLOP } from '../../shared/accessibility/a11yProps';
import { AI_COACH_UI } from '../aiCoachUiTokens';
import AICoachGlassCard from '../components/AICoachGlassCard';
import { stripCoachToolJsonFromReply, parseCoachToolCalls } from '../../shared/parseCoachToolCalls';
import { coerceMisroutedDeleteTool } from '../../ai/tools/parseDeleteLogRequest';
import { guardCoachToolProposal } from '../../ai/tools/validateCoachToolProposal';
import CoachWebSourceCards from '../chat-thread/CoachWebSourceCards';

const USER_BUBBLE_GRAD = AI_COACH_UI.gradient.userBubble;
const ACTION_GRAD = AI_COACH_UI.gradient.ctaWarm;
const COMPOSER_SEND_GRAD = AI_COACH_UI.gradient.composerSend;
const COMPOSER_SEND_GRAD_LIGHT = AI_COACH_UI.gradient.composerSendLight;

import { stripUndefinedForFirestore as stripUndefinedDeep } from '../../shared/utils/firestoreSanitize';

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
  const rawTool = coachResponse?.toolCall || parseCoachToolCalls(rawReply)[0] || null;
  const coerced = coerceMisroutedDeleteTool(rawTool, user, rawReply, normalizeToolCall);
  if (coerced) return guardCoachToolProposal(coerced);
  const displayReply = stripCoachToolJsonFromReply(rawReply) || rawReply;
  return guardCoachToolProposal(inferToolCallFromCoachMessage(displayReply, userText));
}

function resolveMessageToolCall(message, userMessage = '') {
  if (!message || message.toolConfirmed || message.isToolResult) return null;
  if (message.toolCall) return guardCoachToolProposal(normalizeToolCall(message.toolCall));
  return guardCoachToolProposal(inferToolCallFromCoachMessage(message.text, userMessage));
}

function coachActionPromptVisible(message, userMessage = '') {
  if (!message || message.role === 'user' || message.toolConfirmed) return false;
  return Boolean(resolveMessageToolCall(message, userMessage));
}

function formatToolActionSummary(toolCall) {
  const t = normalizeToolCall(toolCall);
  if (!t) {
    return { icon: 'flash-outline', title: 'Confirm action', detail: 'Review what the coach will update' };
  }
  const p = t.params || {};
  const joinParts = (...parts) => parts.filter(Boolean).join(' · ');

  switch (t.name) {
    case 'logNutrition':
      return {
        icon: 'restaurant-outline',
        title: p.food || p.foodName || 'Log meal',
        detail: joinParts(
          p.calories || p.cals ? `${Math.round(Number(p.calories || p.cals))} cal` : null,
          p.protein ? `${Math.round(Number(p.protein))}g protein` : null,
          p.mealType ? String(p.mealType) : null
        ) || 'Add this food to your nutrition log',
      };
    case 'adjustMacroTargets':
      return {
        icon: 'nutrition-outline',
        title: 'Update macro targets',
        detail: joinParts(
          p.calories ? `${Math.round(Number(p.calories))} cal/day` : null,
          p.protein ? `${Math.round(Number(p.protein))}g protein` : null,
          p.carbs ? `${Math.round(Number(p.carbs))}g carbs` : null,
          p.fat ? `${Math.round(Number(p.fat))}g fat` : null
        ),
      };
    case 'logSleep':
      return {
        icon: 'moon-outline',
        title: 'Log sleep',
        detail: joinParts(
          p.hours || p.sleepHours ? `${p.hours || p.sleepHours} hours` : null,
          p.date && p.date !== 'Today' ? `on ${p.date}` : 'on your dashboard'
        ),
      };
    case 'logWater':
      return {
        icon: 'water-outline',
        title: 'Log water',
        detail: `${p.amount_oz ?? p.amountOz ?? p.amount ?? '—'} oz on your dashboard`,
      };
    case 'logSteps':
      return {
        icon: 'footsteps-outline',
        title: 'Log steps',
        detail: `${Number(p.step_count ?? p.steps ?? 0).toLocaleString()} steps on your dashboard`,
      };
    case 'rateEnergy':
      return {
        icon: 'flash-outline',
        title: 'Log energy level',
        detail: joinParts(p.rating ? `${p.rating}/10 energy` : null, p.notes ? String(p.notes) : null),
      };
    case 'logMood':
      return {
        icon: 'happy-outline',
        title: 'Log mood',
        detail: joinParts(p.mood ? `Feeling ${p.mood}` : null, p.notes ? String(p.notes) : null),
      };
    case 'rateWorkout':
      return {
        icon: 'barbell-outline',
        title: 'Rate workout',
        detail: p.rating ? `${p.rating}/10 workout rating` : 'Save how that session felt',
      };
    case 'updateWorkout': {
      const add =
        typeof p.newExercise === 'object'
          ? p.newExercise?.name
          : p.newExercise || p.exerciseName;
      return {
        icon: 'swap-horizontal-outline',
        title: 'Swap exercise',
        detail: add ? `Replace with ${add}` : 'Update an exercise in your plan',
      };
    }
    case 'logRestDay':
      return {
        icon: 'bed-outline',
        title: 'Log rest day',
        detail: joinParts(p.date && p.date !== 'Today' ? `on ${p.date}` : 'on your dashboard today'),
      };
    case 'bookSession':
      return {
        icon: 'calendar-outline',
        title: 'Book session',
        detail: joinParts(p.dateTime || p.sessionDate || p.date, p.sessionTime || p.time),
      };
    case 'openWorkoutPlan':
      return {
        icon: 'document-text-outline',
        title: 'Open workout plan',
        detail: p.planId === 'current' ? 'Your active program + today\'s session' : `Plan ${p.planId}`,
      };
    case 'updateGoal':
      return { icon: 'flag-outline', title: 'Update goal', detail: p.newGoal ? `New goal: ${p.newGoal}` : 'Change your primary goal' };
    case 'notifyTrainer':
      return {
        icon: 'chatbubble-ellipses-outline',
        title: 'Notify trainer',
        detail: p.message ? String(p.message).slice(0, 80) : 'Send a message to your trainer',
      };
    case 'deleteLog': {
      const logType = String(p.logType || 'nutrition').toLowerCase();
      if (logType === 'nutrition') {
        if (p.deleteAll || p.all) {
          return { icon: 'trash-outline', title: 'Delete all food logs', detail: `Clear food entries for ${p.date || 'today'}` };
        }
        if (p.foodName || p.food) {
          return { icon: 'trash-outline', title: 'Delete food log', detail: `Remove ${p.foodName || p.food}` };
        }
        return { icon: 'trash-outline', title: 'Delete last food entry', detail: 'Remove your most recent meal log' };
      }
      return {
        icon: 'trash-outline',
        title: 'Delete log',
        detail: joinParts(`Clear ${logType} entry`, p.date && p.date !== 'Today' ? `for ${p.date}` : 'for today'),
      };
    }
    default:
      return {
        icon: 'checkmark-circle-outline',
        title: TOOL_DISPLAY_NAMES[t.name] || 'Confirm action',
        detail: t.reasoning || 'Review and confirm this coach action',
      };
  }
}

function ToolActionChip({ message, onPress, t, userMessage = '' }) {
  const toolCall = resolveMessageToolCall(message, userMessage);
  if (!toolCall) return null;
  const summary = formatToolActionSummary(toolCall);
  const handlePress = () => onPress?.(toolCall, message.id);

  return (
    <AICoachGlassCard
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
          <Text style={{ fontSize: 14, fontWeight: '800', color: t.textPrimary }} numberOfLines={2}>
            {summary.title}
          </Text>
          <Text style={{ fontSize: 12, color: t.textSecondary, marginTop: 4, lineHeight: 17 }} numberOfLines={3}>
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
    </AICoachGlassCard>
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

function deriveChatTitle(firstUserText) {
  const raw = String(firstUserText || '').trim();
  if (!raw) return 'Chat';

  const t = raw.toLowerCase();

  // Common patterns: "what is X", "explain X", "how do I X"
  const patterns = [
    /^(what is|what's|whats)\s+(.+)\??$/i,
    /^explain\s+(.+)\??$/i,
    /^define\s+(.+)\??$/i,
    /^how do i\s+(.+)\??$/i,
    /^how to\s+(.+)\??$/i,
    /^can i\s+(.+)\??$/i,
    /^should i\s+(.+)\??$/i,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m && (m[2] || m[1])) {
      const candidate = (m[2] || m[1] || '').trim();
      const cleaned = candidate
        .replace(/^go on the web and\s+/i, '')
        .replace(/^google\s+/i, '')
        .replace(/^(about|for)\s+/i, '')
        .replace(/\s+/g, ' ')
        .replace(/["'.!?]+$/g, '')
        .slice(0, 48);
      if (cleaned) return toTitleCase(cleaned);
    }
  }

  // Fitness/nutrition topic keywords → nicer titles
  const topicMap = [
    { key: 'skinny fat', title: 'Skinny Fat' },
    { key: 'recomp', title: 'Body Recomposition' },
    { key: 'recomposition', title: 'Body Recomposition' },
    { key: 'body recomp', title: 'Body Recomposition' },
    { key: 'zero sugar', title: 'Zero Sugar Drinks' },
    { key: 'diet soda', title: 'Diet Soda' },
    { key: 'energy drink', title: 'Energy Drinks' },
    { key: 'preworkout', title: 'Pre-Workout' },
    { key: 'pre-workout', title: 'Pre-Workout' },
    { key: 'creatine', title: 'Creatine' },
    { key: 'protein', title: 'Protein Intake' },
    { key: 'macros', title: 'Macros' },
    { key: 'calories', title: 'Calories' },
    { key: 'cut', title: 'Cutting' },
    { key: 'bulk', title: 'Bulking' },
  ];
  for (const { key, title } of topicMap) {
    if (t.includes(key)) return title;
  }

  // Fallback: strip filler words and shorten
  const cleaned = raw
    .replace(/[^\w\s%-]/g, ' ')
    .replace(/\b(please|pls|hey|hi|hello|ok|okay|so|like|just|really|actually|basically|google|web|search)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48);
  return cleaned ? toTitleCase(cleaned) : 'Chat';
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
  const t = String(userText || '').toLowerCase();
  if (!t.trim()) return 'general';
  if (t.includes('form') || t.includes('check') || t.includes('video') || t.includes('squat') || t.includes('bench')) return 'form';
  if (t.includes('macro') || t.includes('calorie') || t.includes('protein') || t.includes('nutrition') || t.includes('meal')) return 'nutrition';
  if (t.includes('progress') || t.includes('plateau') || t.includes('last 30') || t.includes('data')) return 'progress';
  if (t.includes('workout') || t.includes('plan') || t.includes('split') || t.includes('hypertrophy')) return 'workout';
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
        backgroundColor: t.cardBg,
        borderWidth: 1,
        borderColor: t.cardBorder,
        borderLeftWidth: 3,
        borderLeftColor: color,
        borderRadius: 12,
        padding: 14,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Ionicons name={icon} size={16} color={color} />
        <Text style={{ fontSize: 11, letterSpacing: 0.5, fontWeight: '800', color: t.textSecondary }}>
          {title}
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        {(items || []).slice(0, 4).map((it, idx) => (
          <View key={`${title}_${idx}`}>
            <Text style={{ fontSize: 13, color: t.textPrimary, fontWeight: '500' }}>{it.label}</Text>
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

// ─── Typing / status while AI responds (flat — no bubble) ────────────────────
function TypingIndicator({ t, phase = 'thinking' }) {
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
    <View style={{ width: '100%', marginBottom: 24 }}>
      <CoachReplyHeader t={t} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Ionicons
          name={meta.icon}
          size={16}
          color={phase === 'web' ? AI_COACH_UI.cyan : AI_COACH_UI.pink}
        />
        <Text style={{ color: t.textSecondary, fontSize: 14, fontWeight: '600', flexShrink: 1 }}>
          {meta.text}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 4 }}>
          {[dot1, dot2, dot3].map((anim, i) => (
            <Animated.View
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: AI_COACH_UI.pink,
                opacity: anim,
              }}
            />
          ))}
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
        <Text style={{ fontSize: 12, fontWeight: '700', color: t.textSecondary, letterSpacing: 0.2 }}>
          Coach
        </Text>
      </View>
      {copyText ? <CoachMessageCopyButton text={copyText} t={t} align="flex-end" compact /> : null}
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
    timerRef.current = setTimeout(() => setCopied(false), 2500);
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
        color={copied ? AI_COACH_UI.green : t.textSecondary}
      />
      {!compact ? (
      <Text
        style={{
          fontSize: 13,
          fontWeight: '800',
          color: copied ? AI_COACH_UI.green : t.textSecondary,
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
function MessageBubble({ message, t, onToolPress, isDark = true, lastUserText = '', toolModalVisible = false }) {
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
          <Ionicons name="document-outline" size={28} color={t.textPrimary} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: t.textPrimary }} numberOfLines={1}>
              {firstFile.name || 'File'}
            </Text>
            <Text style={{ fontSize: 11, marginTop: 2, color: t.msgTimestamp }} numberOfLines={1}>
              Tap to view
            </Text>
          </View>
        </View>
      );
    }
    if (sent) {
      return (
        <CoachSelectableMessageText text={displayText} color={t.textPrimary} isDark={isDark} />
      );
    }
    return (
      <CoachSelectableMessageText text={displayText} color={t.textPrimary} isDark={isDark} />
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
                backgroundColor: t.msgReceivedBg,
                borderWidth: 1,
                borderColor: t.msgReceivedBorder,
              },
              mediaStyle,
            ]}
          >
            <View pointerEvents="box-none">{renderContent()}</View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            {hasText ? <CoachMessageCopyButton text={copyText} t={t} align="flex-end" compact /> : null}
            <Text style={{ fontSize: 11, color: t.msgTimestamp }}>{message.time}</Text>
          </View>
        </View>
      </View>
    );
  }

  const askedForWeb = shouldShowWebSearchUI(lastUserText);
  const webStatusLabel = message.searchedWeb
    ? 'Searched the web'
    : askedForWeb && message.route !== 'web-search'
      ? 'Answered from coaching knowledge (live search unavailable)'
      : null;

  return (
    <View style={{ width: '100%', marginBottom: 24, alignSelf: 'stretch' }}>
      <CoachReplyHeader t={t} copyText={hasText ? copyText : null} />
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
            color={message.searchedWeb ? AI_COACH_UI.cyan : t.textSecondary}
          />
          <Text style={{ fontSize: 12, fontWeight: '600', color: t.textSecondary, flex: 1 }}>
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
            borderColor: isDark ? AI_COACH_UI.borderHairline : t.chipBorder,
            marginBottom: 8,
          }}
        >
          {renderContent()}
        </View>
      ) : (
        renderContent()
      )}
      <CoachWebSourceCards message={message} isDark={isDark} />
      {coachActionPromptVisible(message, lastUserText) && !toolModalVisible ? (
        <ToolActionChip message={message} onPress={onToolPress} t={t} userMessage={lastUserText} />
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
        <Text style={{ fontSize: 11, color: t.msgTimestamp, flex: 1 }}>{message.time}</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AIChatScreen({
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
}) {
  const insets = useSafeAreaInsets();
  const shellNavPad = hideBottomNav ? BOTTOM_NAV_BAR_HEIGHT + insets.bottom : 0;
  const { isDark } = useTheme();
  const t = isDark ? DARK : LIGHT;
  const flatListRef = useRef(null);
  const prefillSent = useRef(false);
  const mountAttachmentsRef = useRef(Array.isArray(initialAttachments) ? initialAttachments : []);

  const [messages, setMessages] = useState([]);
  const composer = useCoachComposerInput('');
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
    const tContext = setTimeout(() => setCoachWaitPhase('context'), 1400);
    const tDraft = setTimeout(() => setCoachWaitPhase('drafting'), 3200);
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
    await persistAiChatSession(userId, sessionId, {
      messages: msgs,
      meta: {
        sessionId,
        title: extraMeta.title || deriveChatTitle(lastUser?.text || ''),
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

  const handleToolConfirm = async (confirmedParams = {}, toolOverride = null) => {
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

    console.log('[DEBUG] Tool confirm:', { toolName: merged.name, params: merged.params });

    setToolExecuting(true);
    try {
      const result = await executeCoachTool({
        userId,
        trainerId,
        planId,
        toolCall: merged,
        navigationHandlers: { onOpenWorkoutPlan },
      });

      console.log('[DEBUG] Tool result:', { success: result.success, message: result.message });

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
        let targetId = pendingToolMessageId;
        if (!targetId) {
          const match = [...prev].reverse().find(
            (m) =>
              m.role === 'ai' &&
              !m.toolConfirmed &&
              (m.toolCall || resolveMessageToolCall(m))
          );
          targetId = match?.id || null;
        }
        const marked = prev.map((m) => {
          if (!targetId || m.id !== targetId) return m;
          return {
            ...m,
            toolConfirmed: result.success,
            toolCall: m.toolCall || merged,
          };
        });
        const next = result.success ? marked : [...marked, resultMsg];
        if (db && userId) {
          persistSession(next).catch(() => {});
        }
        return next;
      });

      if (result.success) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (_) {
          /* ignore */
        }
        await refreshCoachContext(true);
        if (merged.name === 'logNutrition' || merged.name === 'adjustMacroTargets' || merged.name === 'deleteLog') {
          await onNutritionDataChanged?.();
        }
      } else {
        Alert.alert('Action failed', result.message || 'Could not complete that action.');
      }

      setToolModalVisible(false);
      setPendingToolCall(null);
      setPendingToolMessageId(null);
      scrollToBottom();
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_tool_err_${Date.now()}`,
          role: 'ai',
          text: e?.message || 'Something went wrong running that action.',
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
        const saved = await loadAiChatMessages(userId, initialSessionId);
        const restored = restoreChatMessagesFromSaved(saved)
          .map((m) => {
            if (m.role !== 'ai') return m;
            const parsedTool = m.toolCall || parseCoachToolCalls(m.text)[0] || null;
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

  const sendMessage = async (text, atts = []) => {
    if (!text.trim() && atts.length === 0) return;

    const imageAtts = atts.filter((a) => a?.type === 'image' || a?.preview);
    const hasFilesOnly = atts.some((a) => a?.type === 'file') && imageAtts.length === 0;
    if (hasFilesOnly) {
      Alert.alert(
        'Photos work best',
        'The coach can analyze progress photos right now. PDF and document reading is not wired yet — attach a photo instead.'
      );
      return;
    }
    if (atts.length > 0 && imageAtts.length === 0) {
      Alert.alert('Could not read photo', 'Try picking the image again.');
      return;
    }

    const plannedWeb = shouldShowWebSearchUI(text);
    const plannedCards = buildFeatureCards({ userText: text, userProfile: userProfile || {} });
    const userMsg = {
      id: `msg_${Date.now()}`,
      role: 'user',
      text: text.trim(),
      time: now(),
      attachments: atts.length > 0 ? [...atts] : undefined,
    };

    const updatedMessages = [...messages, userMsg];
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
      setTimeout(() => setActiveFeatureCards(plannedCards?.slice?.(0, 3) || []), 1850),
    ];
    scrollToBottom();

    try {
      // Save immediately so the conversation shows in history even if AI/network fails.
      if (db && userId) {
        const isFirstMessage = messages.length === 0;
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

      const resolvedTool = resolveIncomingCoachTool(coachResponse, text.trim());

      const aiMsg = {
        id: `msg_${Date.now() + 1}`,
        role: 'ai',
        text: stripCoachToolJsonFromReply(coachResponse.message) || coachResponse.message,
        time: now(),
        source: coachResponse.source,
        toolCall: resolvedTool,
        searchedWeb: coachResponse.searchedWeb === true,
        webProvider: coachResponse.webProvider || null,
        route: coachResponse.route || null,
        featureCards: plannedCards,
        isError: !coachResponse.success,
      };

      const finalMessages = [...updatedMessages, aiMsg];
      setMessages(finalMessages);

      if (resolvedTool) {
        openToolModal(resolvedTool, aiMsg.id);
      } else if (
        coachResponse.success &&
        /\b(log|swap|bump|schedule|deload|notify|adjust)\b/i.test(text.trim())
      ) {
        // Model gave advice only — nudge user that actions need a tool proposal
        logger.debug('AI Coach: action-like message but no toolCall returned');
      }

      if (db && userId) {
        await persistSession(finalMessages);
      }
    } catch (err) {
      console.error('AI coach error:', err);
      const raw = String(err?.message || '');
      const friendly =
        raw.includes('invalid data') || raw.includes('Unsupported field value')
          ? 'Could not save this message. Please try again.'
          : raw.includes('network') || raw.includes('Network')
            ? 'Network error — check your connection and try again.'
            : 'Something went wrong. Please try again.';
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

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <CoachConnectHeader
        title="AI Coach"
        isDark={isDark}
        onBack={onBack}
        onProfilePress={onProfilePress}
        onSettingsPress={onSettingsPress}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {messages.length === 0 && !typing ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <LottieView
              source={require('../../assets/Lotties for Anatrox/Cloud robotics abstract.json')}
              autoPlay
              loop
              style={{ width: 100, height: 100 }}
            />
            <Text style={{ color: t.textSecondary, fontSize: 14, marginTop: 16 }}>Ask me anything to get started.</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            accessibilityLabel="Coach conversation messages"
            keyExtractor={(m) => m.id}
            renderItem={({ item, index }) => {
              let lastUserText = '';
              for (let i = index - 1; i >= 0; i -= 1) {
                if (messages[i]?.role === 'user') {
                  lastUserText = messages[i].text || '';
                  break;
                }
              }
              return (
                <MessageBubble
                  message={item}
                  t={t}
                  isDark={isDark}
                  onToolPress={openToolModal}
                  lastUserText={lastUserText}
                  toolModalVisible={toolModalVisible}
                />
              );
            }}
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: 16 + shellNavPad,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            removeClippedSubviews={false}
            onContentSizeChange={scrollToBottom}
            ListFooterComponent={
              typing || toolExecuting ? (
                <TypingIndicator t={t} phase={toolExecuting ? 'working' : coachWaitPhase} />
              ) : null
            }
            ListFooterComponentStyle={{ paddingBottom: 4 }}
          />
        )}

        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: attachments.length > 0 ? 10 : 8,
            paddingBottom: 8 + shellNavPad,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: t.inputBarBorder,
            backgroundColor: t.inputBarBg,
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
                        borderColor: t.chipBorder,
                      }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 12,
                        backgroundColor: t.chipBg,
                        borderWidth: 1,
                        borderColor: t.chipBorder,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="document-outline" size={22} color={t.textSecondary} />
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
                      backgroundColor: t.textSecondary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="close" size={13} color={t.bg} />
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
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 40,
                maxHeight: 120,
                fontSize: 15,
                color: t.textPrimary,
                paddingVertical: 10,
                paddingHorizontal: 14,
                backgroundColor: t.inputBg,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: t.inputBorder,
              }}
              value={input}
              onChangeText={setInput}
              onLongPress={openPasteSheet}
              placeholder="Ask your coach..."
              placeholderTextColor={t.textMuted}
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
      </KeyboardAvoidingView>

      <CoachPasteSheet
        visible={pasteSheetVisible}
        onClose={closePasteSheet}
        onConfirm={commitText}
        t={t}
        isDark={isDark}
      />

      <ToolConfirmationModal
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

      {!hideBottomNav ? (
        <BottomNavBar
          onHomePress={onHomePress || (() => {})}
          onPlusPress={onPlusPress || (() => {})}
          onVoicePress={onVoicePress || (() => {})}
          onNutritionPress={onNutritionPress || (() => {})}
          onWorkoutPress={onWorkoutPress || (() => {})}
          onMessagesPress={onMessagesPress || (() => {})}
          onProfilePress={onProfilePress || (() => {})}
          activeTabKey="ai"
        />
      ) : null}
    </View>
  );
}

