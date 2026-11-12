// Design Law coach conversation — black user bubbles, flat coach replies, Nb attach/delete sheets.
// Flow: load session + week context → sendMessage → bubbles / confirm tools → carryOutAction → persist.
// Used by: client AI Coach tab. PNG: screens/ai-coach/03–12.

import React, { useState, useEffect, useRef, useMemo } from 'react';
// vocab: useState / useEffect / useRef / useMemo = React hooks for state, side effects, mutable boxes, cached derived lists
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
// vocab: FlatList = virtualized message list (only mounts nearby rows — needed for long chats)
// vocab: Animated = RN opacity/position drivers (typing-dot bounce uses this)
// vocab: Pressable = touchable that exposes pressed state for copy-button styling
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// vocab: useSafeAreaInsets = notches / home-indicator padding from the OS
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
// vocab: LottieView = plays a JSON animation (empty-state cloud robot)
import { lightColors, darkColors, spacing, borderRadius, nb, gradients, accentGradients } from '../../look-and-feel/colorPalette';
import GradientFrame from '../../look-and-feel/GradientFrame';
import NbButton from '../../look-and-feel/NbButton';
import CoachAttachSheet from './CoachAttachSheet';
import DeleteChatSheet from '../past-chats/DeleteChatSheet';
import {
  pickCoachDocuments,
  pickCoachPhotoFromCamera,
  pickCoachPhotosFromLibrary,
} from './choosePhoto';
import * as Haptics from 'expo-haptics';
// vocab: Haptics = phone vibration feedback on copy / confirm / success
import { serverTimestamp } from 'firebase/firestore';
// vocab: serverTimestamp = Firestore sentinel so createdAt is set by the server clock (not the phone)
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
// vocab: typingBox = composer state helper (text, paste sheet, speech transcript merge)
import PasteTextPopup from './PasteTextPopup';
import TopHeader from '../../for-both/loading-and-header/TopHeader';
import BottomMenuBar from '../../navigation/BottomMenuBar';
import { ShellBottomNavAnchor } from '../../navigation/bottomMenuSpacing';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { coachPlainText, copyCoachText } from '../reply-display/copyableReplyText';
import { loadCoachContextEnhanced } from '../coach-knowledge/loadYourWeekForCoach';
// vocab: coachContext = week / logs / plan snapshot the model reads each turn
import { sendCoachMessageWithRetry } from './sendMessageToCoach';
import ConfirmActionPopup from './ConfirmActionPopup';
import { carryOutAction, normalizeToolCall, TOOL_DISPLAY_NAMES } from '../coach-actions/carryOutAction';
// vocab: toolCall = { name, params, reasoning } — coach wants to mutate a log / plan / booking
// vocab: normalizeToolCall = coerce weird AI shapes into one canonical object
// vocab: carryOutAction = actually write the log / open plan / notify trainer
import { inferToolCallFromCoachMessage } from '../coach-actions/findActionsInReply';
import { useCoachSpeech, COACH_VOICE_INPUT_AVAILABLE } from './_voiceStub';
import { keyboardBehavior, COACH_COMPOSER_TEXT_INPUT_PROPS } from './keyboardBehavior';
import { shouldShowWebSearchUI } from '../internet-lookup/shouldLookUpOnInternet';
import { a11yButton, MIN_TOUCH_HIT_SLOP } from '../../for-both/screenReaderLabels';
// vocab: a11yProps helper for accessibility standards
const a11yProps = a11yButton;
import { AI_COACH_UI } from '../coachColors';
import CoachGlassCard from '../reply-display/CoachGlassCard';
import { stripCoachToolJsonFromReply, readActionsFromReply } from '../coach-actions/readActionsFromReply';
// vocab: readActionsFromReply = peel hidden tool JSON out of the AI text
// vocab: stripCoachToolJsonFromReply = user-visible bubble text without that JSON
import { coerceMisroutedDeleteTool } from '../coach-actions/spotDeleteRequests';
import {
  guardCoachToolProposal,
  isValidCoachToolProposal,
  isInformationalUserMessage,
} from '../coach-actions/shouldAskFirst';
// vocab: guardCoachToolProposal = final safety gate before showing/running a tool
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
//   WAIT_PHASE_CONTEXT_MS = when "Reviewing your week…" replaces "thinking"
//   WAIT_PHASE_DRAFTING_MS = when "Writing your reply…" replaces context
const WAIT_PHASE_CONTEXT_MS = 1400;
const WAIT_PHASE_DRAFTING_MS = 3200;
// Manipulate here: delay before showing feature explanation cards under a reply.
const FEATURE_CARDS_REVEAL_MS = 1850;
// Manipulate here: px width that unlocks the docked past-chats sidebar (tablets / landscape).
const WIDE_LAYOUT_MIN_WIDTH = 768;
// Manipulate here: how many chars of a notifyTrainer message show on the confirm chip.
const NOTIFY_TRAINER_PREVIEW_CHARS = 80;

// Gradient token aliases — keep chip / send button colors in one place.
const USER_BUBBLE_GRAD = AI_COACH_UI.gradient.userBubble;
const ACTION_GRAD = AI_COACH_UI.gradient.ctaWarm;
const COMPOSER_SEND_GRAD = AI_COACH_UI.gradient.composerSend;
const COMPOSER_SEND_GRAD_LIGHT = AI_COACH_UI.gradient.composerSendLight;

import { stripUndefinedForFirestore as stripUndefinedDeep } from '../../helpers/cleanDataBeforeSaving';
// vocab: stripUndefinedDeep = Firestore rejects `undefined` fields — strip before save

// Shape one in-memory chat bubble into the flat object we store in Firestore.
// Why: UI uses `text` / `role: 'ai'`; storage prefers `content` + stripped attachments.
function serializeChatMessage(m) {
  if (!m) return null;
  const payload = {
    // vocab/symbol: ternary — only allow 'ai' or 'user' (never leave a weird role string)
    role: m.role === 'ai' ? 'ai' : 'user',
    content: m.text,
    time: m.time,
    source: m.source || null,
  };
  // Attachments are optional — only persist the fields the picker actually set.
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
  // Tool flags: chip still pending (toolCall), already ran (toolConfirmed), or system result bubble.
  if (m.toolCall) payload.toolCall = m.toolCall;
  // Multi-action replies: the full queue + which of them already ran.
  if (Array.isArray(m.toolCalls) && m.toolCalls.length) payload.toolCalls = m.toolCalls;
  if (Array.isArray(m.completedToolCalls) && m.completedToolCalls.length) {
    payload.completedToolCalls = m.completedToolCalls;
  }
  if (m.toolConfirmed) payload.toolConfirmed = true;
  if (m.isToolResult) payload.isToolResult = true;
  return stripUndefinedDeep(payload);
}

// Decide which tool (if any) this brand-new coach reply should offer.
// Order matters: explicit toolCall → fix mis-routed deletes → skip web/info Qs → infer from prose.
function resolveIncomingCoachTool(coachResponse, userText = '') {
  const rawReply = coachResponse?.message || '';
  // vocab/symbol: ?. = optional chaining — if coachResponse is null, don't crash
  const user = String(userText || '').trim();
  // Prefer the structured toolCall from the API; fall back to JSON hidden in the reply text.
  const rawTool = coachResponse?.toolCall || readActionsFromReply(rawReply)[0] || null;
  // Delete requests sometimes arrive as the wrong tool name — coerce then re-validate.
  const coerced = coerceMisroutedDeleteTool(rawTool, user, rawReply, normalizeToolCall);
  if (coerced && isValidCoachToolProposal(coerced, user)) return coerced;

  // Web answers and pure "what is X?" questions should NOT open a Confirm Action chip.
  if (coachResponse?.searchedWeb || isInformationalUserMessage(user)) {
    return null;
  }

  // Last resort: guess a tool from the cleaned English reply (when the model forgot JSON).
  const displayReply = stripCoachToolJsonFromReply(rawReply) || rawReply;
  const inferred = inferToolCallFromCoachMessage(displayReply, userText);
  return inferred && isValidCoachToolProposal(inferred, user) ? inferred : null;
}

// Identity for one tool call in a multi-action reply ("logSleep:{...}").
// Used to track which of a message's several actions have already run.
function coachToolCallKey(toolCall) {
  const normalized = normalizeToolCall(toolCall);
  if (!normalized) return '';
  return `${normalized.name}:${JSON.stringify(normalized.params || {})}`;
}

// Every valid tool this brand-new reply should offer, in order.
// A reply can carry several actions ("log 8h sleep and 20oz water") — before
// this, only the first survived and the rest were silently dropped.
function resolveIncomingCoachTools(coachResponse, userText = '') {
  const user = String(userText || '').trim();
  const rawReply = coachResponse?.message || '';
  const rawTools = Array.isArray(coachResponse?.toolCalls) && coachResponse.toolCalls.length
    ? coachResponse.toolCalls
    : [coachResponse?.toolCall || readActionsFromReply(rawReply)[0] || null];
  const resolved = [];
  const seen = new Set();
  for (const rawTool of rawTools) {
    const coerced = coerceMisroutedDeleteTool(rawTool, user, rawReply, normalizeToolCall);
    if (!coerced || !isValidCoachToolProposal(coerced, user)) continue;
    const key = coachToolCallKey(coerced);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    resolved.push(guardCoachToolProposal(normalizeToolCall(coerced)));
  }
  if (resolved.length) return resolved.filter(Boolean);
  const single = resolveIncomingCoachTool(coachResponse, userText);
  return single ? [single] : [];
}

// For an already-rendered AI bubble: return a safe toolCall to show the chip, or null.
// Skips confirmed / result bubbles so we never re-offer an action that already ran.
function resolveMessageToolCall(message, userMessage = '') {
  if (!message || message.toolConfirmed || message.isToolResult) return null;
  // Multi-action reply: offer the first action that has not run yet, so the
  // chips appear one at a time until every action is confirmed.
  if (Array.isArray(message.toolCalls) && message.toolCalls.length) {
    const completed = new Set(Array.isArray(message.completedToolCalls) ? message.completedToolCalls : []);
    for (const candidate of message.toolCalls) {
      if (completed.has(coachToolCallKey(candidate))) continue;
      const guarded = guardCoachToolProposal(normalizeToolCall(candidate));
      if (guarded && isValidCoachToolProposal(guarded, userMessage)) return guarded;
    }
    return null;
  }
  if (message.toolCall) {
    // Re-guard on render in case stored JSON drifted or was hand-edited.
    const guarded = guardCoachToolProposal(normalizeToolCall(message.toolCall));
    return guarded && isValidCoachToolProposal(guarded, userMessage) ? guarded : null;
  }
  // Older sessions may only have prose — try to infer so the chip still appears.
  const inferred = inferToolCallFromCoachMessage(message.text, userMessage);
  return inferred && isValidCoachToolProposal(inferred, userMessage) ? inferred : null;
}

// Should this AI message show the Confirm Action chip right now?
function coachActionPromptVisible(message, userMessage = '') {
  if (!message || message.role === 'user' || message.toolConfirmed) return false;
  return Boolean(resolveMessageToolCall(message, userMessage));
}

// ===== HELPER FUNCTIONS =====

/** Join non-empty detail bits with a middle dot (chip subtitle: "320 cal · breakfast"). */
function joinSummaryParts(...parts) {
  // vocab/symbol: ...parts = rest args — callers pass any number of strings / nulls
  return parts.filter(Boolean).join(' · ');
}

// Fallback chip copy when we don't recognize the tool name.
// Manipulate here: default icon / title / detail for unknown tools.
const DEFAULT_TOOL_SUMMARY = {
  icon: 'flash-outline',
  title: 'Confirm action',
  detail: 'Review what the coach will update',
};

// Chip copy for deleteLog when logType is nutrition (or missing → treat as nutrition).
// Decision tree: wipe-all → named food → else "last entry" (undo-style).
function summarizeDeleteNutrition(params) {
  // Wipe every meal for a date (destructive — copy must say "all").
  if (params.deleteAll || params.all) {
    return {
      icon: 'trash-outline',
      title: 'Delete all food logs',
      detail: `Clear food entries for ${params.date || 'today'}`,
    };
  }
  // Specific food name present → show what will be removed.
  if (params.foodName || params.food) {
    return {
      icon: 'trash-outline',
      title: 'Delete food log',
      detail: `Remove ${params.foodName || params.food}`,
    };
  }
  // No name / no wipe-all → coach means "undo the most recent meal".
  return {
    icon: 'trash-outline',
    title: 'Delete last food entry',
    detail: 'Remove your most recent meal log',
  };
}

// Chip copy for deleteLog across sleep / water / steps / energy / mood / workout / restDay.
function summarizeDeleteLog(params) {
  // vocab: logType = which dashboard metric to clear (defaults to nutrition)
  const logType = String(params.logType || 'nutrition').toLowerCase();
  if (logType === 'nutrition') return summarizeDeleteNutrition(params);

  // Manipulate here: title + detail pairs per metric (pair[0]=title, pair[1]=detail).
  const metricLabels = {
    sleep: ['Delete sleep log', 'Clear your sleep entry from the dashboard'],
    water: ['Delete water log', 'Clear your water entry from the dashboard'],
    steps: ['Delete steps log', 'Clear your step count from the dashboard'],
    energy: ['Delete energy log', 'Clear your energy rating from the dashboard'],
    mood: ['Delete mood log', 'Clear your mood entry from the dashboard'],
    workout: ['Delete workout log', 'Clear your workout entry from the dashboard'],
    restDay: ['Clear rest day', 'Remove the rest day mark from the dashboard'],
  };
  // Unknown logType → generic copy that still mentions the type string.
  const pair = metricLabels[logType] || [
    'Delete log',
    `Clear ${logType} entry from the dashboard`,
  ];
  return {
    icon: 'trash-outline',
    title: pair[0],
    detail: joinSummaryParts(
      pair[1],
      // Only append a date when it's not the vague "Today" label.
      params.date && params.date !== 'Today' ? `for ${params.date}` : null,
    ),
  };
}

// Chip copy for logNutrition — show food name + cal / protein / mealType when present.
function summarizeLogNutrition(params) {
  return {
    icon: 'restaurant-outline',
    // Manipulate here: fallback title when the model forgot food / foodName.
    title: params.food || params.foodName || 'Log meal',
    detail:
      joinSummaryParts(
        // AI sometimes sends `cals` instead of `calories` — accept both.
        params.calories || params.cals
          ? `${Math.round(Number(params.calories || params.cals))} cal`
          : null,
        params.protein ? `${Math.round(Number(params.protein))}g protein` : null,
        params.mealType ? String(params.mealType) : null,
      ) || 'Add this food to your nutrition log',
  };
}

// Chip copy for adjustMacroTargets — daily cal + macros the coach wants to set.
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

// Chip copy for updateWorkout — prefer nested newExercise.name when the model sent an object.
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

// Lookup table: tool name → summary builder. Keeps formatToolActionSummary thin.
// Manipulate here: add a new tool by exporting a builder + registering it below.
const TOOL_SUMMARY_BY_NAME = {
  logNutrition: summarizeLogNutrition,
  adjustMacroTargets: summarizeAdjustMacros,
  logSleep: (params) => ({
    icon: 'moon-outline',
    title: 'Log sleep',
    detail: joinSummaryParts(
      // hours vs sleepHours — model aliases
      params.hours || params.sleepHours
        ? `${params.hours || params.sleepHours} hours`
        : null,
      params.date && params.date !== 'Today' ? `on ${params.date}` : 'on your dashboard',
    ),
  }),
  logWater: (params) => ({
    icon: 'water-outline',
    title: 'Log water',
    // vocab/symbol: ?? = nullish coalesce — use next alias only if left is null/undefined
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
    // Emoji matches LogMoodPopup so the chip and the popup read as one action.
    // Manipulate here: mood → emoji shown on the Confirm chip.
    detail: joinSummaryParts(
      params.mood
        ? `Feeling ${{ happy: '😊', okay: '😐', stressed: '😖', tired: '😴', anxious: '😰' }[String(params.mood).toLowerCase()] || ''} ${params.mood}`.trim()
        : null,
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
    // Date/time field names vary by model version — join whatever is present.
    detail: joinSummaryParts(
      params.dateTime || params.sessionDate || params.date,
      params.sessionTime || params.time,
    ),
  }),
  openWorkoutPlan: (params) => ({
    icon: 'document-text-outline',
    title: 'Open workout plan',
    // 'current' is the special id meaning "whatever plan is active today".
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
    // Truncate so a long message doesn't blow up the chip height.
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
  // Known tools get a rich summary; unknown names fall back to display-name + reasoning.
  const builder = TOOL_SUMMARY_BY_NAME[tool.name];
  if (builder) return builder(params);

  return {
    icon: 'checkmark-circle-outline',
    title: TOOL_DISPLAY_NAMES[tool.name] || 'Confirm action',
    detail: tool.reasoning || 'Review and confirm this coach action',
  };
}

// Design Law “Needs your OK” card under an AI reply — Skip / Review (opens ConfirmActionPopup).
function ToolActionChip({ message, onPress, onSkip, palette, userMessage = '' }) {
  const toolCall = resolveMessageToolCall(message, userMessage);
  if (!toolCall) return null;
  const summary = formatToolActionSummary(toolCall);
  const handlePress = () => onPress?.(toolCall, message.id);

  return (
    <View
      style={{
        marginTop: 12,
        borderWidth: nb.borderWidth,
        borderColor: palette.cardBorder,
        borderRadius: borderRadius.nbCard,
        backgroundColor: palette.cardBg,
        padding: 14,
        shadowColor: palette.shadow || lightColors.nbShadow,
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 0,
        elevation: 4,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <LinearGradient
          colors={accentGradients[0]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderWidth: 2,
            borderColor: palette.cardBorder,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '900', color: lightColors.nbInk }}>Ready to log</Text>
        </LinearGradient>
        <Text style={{ fontSize: 13, fontWeight: '600', color: palette.textSecondary }}>Needs your OK</Text>
      </View>
      {/* Design Law PNG 03: one bold line — title: detail (colon, not em dash) */}
      <Text style={{ fontSize: 15, fontWeight: '800', color: palette.textPrimary, marginBottom: 12 }} numberOfLines={3}>
        {summary.detail ? `${summary.title}: ${summary.detail}` : summary.title}
      </Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <NbButton variant="ghost" sm onPress={() => onSkip?.(message.id)}>
            Skip
          </NbButton>
        </View>
        <View style={{ flex: 1 }}>
          <NbButton variant="fill" sm onPress={handlePress}>
            Review
          </NbButton>
        </View>
      </View>
    </View>
  );
}
// ─── Theme tokens (aligned with design-system.md) ────────────────────────────
// Two palettes swapped by useTheme().isDark. Bubble / composer / chip colors live here.
// Manipulate here: any rgba / hex below to retune dark or light coach chrome.
// Neobrutalist color palettes using design system tokens
const DARK = {
  bg: darkColors.nbBackground,
  cardBg: darkColors.nbSurface,
  cardBorder: darkColors.nbBorder,
  textPrimary: darkColors.nbInk,
  textSecondary: darkColors.nbMuted,
  textMuted: darkColors.nbMuted,
  inputBg: darkColors.nbSurface,
  inputBorder: darkColors.nbBorder,
  divider: darkColors.nbBorder,
  chipBg: darkColors.nbSurfaceChip,
  chipBorder: darkColors.nbBorder,
  inputBarBg: darkColors.nbBackground,
  inputBarBorder: darkColors.nbBorder,
  aiBubbleBg: darkColors.nbSurface,
  aiBubbleBorder: darkColors.nbBorder,
  msgReceivedBg: darkColors.nbSurface,
  msgReceivedBorder: darkColors.nbBorder,
  msgTimestamp: darkColors.nbMuted,
  fill: darkColors.nbFill,
  onFill: darkColors.nbOnFill,
  shadow: darkColors.nbShadow,
};

const LIGHT = {
  bg: lightColors.nbBackground,
  cardBg: lightColors.nbSurface,
  cardBorder: lightColors.nbBorder,
  textPrimary: lightColors.nbInk,
  textSecondary: lightColors.nbMuted,
  textMuted: lightColors.nbMuted,
  inputBg: lightColors.nbSurface,
  inputBorder: lightColors.nbBorder,
  divider: lightColors.nbBorder,
  chipBg: lightColors.nbSurfaceChip,
  chipBorder: lightColors.nbBorder,
  inputBarBg: lightColors.nbBackground,
  inputBarBorder: lightColors.nbBorder,
  aiBubbleBg: lightColors.nbSurface,
  aiBubbleBorder: lightColors.nbBorder,
  msgReceivedBg: lightColors.nbSurface,
  msgReceivedBorder: lightColors.nbBorder,
  msgTimestamp: lightColors.nbMuted,
  fill: lightColors.nbFill,
  onFill: lightColors.nbOnFill,
  shadow: lightColors.nbShadow,
};

// Short clock string stamped on every bubble (e.g. "3:42 PM").
const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// "fat_loss" / "hypertrophy" → "Fat Loss" / "Hypertrophy" for feature-card labels.
function toTitleCase(s) {
  return String(s || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── Feature explanation cards (inline in AI messages) ────────────────────────
// Shown while waiting / as decorative "what I'm doing" panels tied to the user's topic.
// Manipulate here: accent color per card category (analysis / generation / etc.).
const FEATURE_COLORS = {
  analysis: AI_COACH_UI.purple,
  generation: AI_COACH_UI.pink,
  optimization: AI_COACH_UI.cyan,
  goals: AI_COACH_UI.green,
  tracking: AI_COACH_UI.orange,
};

// Keyword sniff on the user message → which card pack to build.
// Order matters: form checks before nutrition (a "form check" shouldn't become nutrition cards).
// Manipulate here: add keywords to steer more messages into a given flow.
const inferFlowType = (userText) => {
  const lowered = String(userText || '').toLowerCase();
  if (!lowered.trim()) return 'general';
  if (lowered.includes('form') || lowered.includes('check') || lowered.includes('video') || lowered.includes('squat') || lowered.includes('bench')) return 'form';
  if (lowered.includes('macro') || lowered.includes('calorie') || lowered.includes('protein') || lowered.includes('nutrition') || lowered.includes('meal')) return 'nutrition';
  if (lowered.includes('progress') || lowered.includes('plateau') || lowered.includes('last 30') || lowered.includes('data')) return 'progress';
  if (lowered.includes('workout') || lowered.includes('plan') || lowered.includes('split') || lowered.includes('hypertrophy')) return 'workout';
  return 'general';
};

// Build 3 explanation cards for the current flow, personalized with goal / days / level.
// Used by sendMessage to stage progressive reveals while the API is in flight.
const buildFeatureCards = ({ userText, userProfile }) => {
  const flow = inferFlowType(userText);
  // Profile field names vary across older accounts — try several aliases.
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

  // Defensive: some callers may pass a non-array; keep FeatureCard happy.
  const ensureArray = (arr) => (Array.isArray(arr) ? arr : []);

  // Form-check flow: video → assessment → cues/drills.
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

  // Nutrition flow: data → intake calc → meal plan template.
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

  // Progress / plateau flow: trend scan → improvements → next milestone.
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

  // Default: workout / general — profile → plan generation → optimization.
  // Manipulate here: card titles / row labels when you want different empty-wait copy.
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

// One "what I'm doing" panel: colored left edge + icon title + up to 4 label/value rows.
// Callers pass palette={palette} — the prop must be named palette or the body below crashes.
function FeatureCard({ palette, icon, title, color, items }) {
  // vocab: palette = DARK or LIGHT token bag for card chrome
  return (
    <View
      style={{
        backgroundColor: palette.cardBg,
        borderWidth: nb.borderWidth,
        borderColor: palette.cardBorder,
        // Left accent stripe = category color (analysis purple, tracking orange, etc.)
        // Manipulate here: borderLeftWidth / borderRadius / padding for card density.
        borderLeftWidth: nb.borderWidth,
        borderLeftColor: color,
        borderRadius: borderRadius.nbCard,
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
        {/* Cap at 4 rows so tall cards don't dominate the thread */}
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

// Phase → icon + copy for the typing/loading bubble under the thread.
// Manipulate here: waiting copy users see while the coach reply is in flight.
const COACH_WAIT_LABELS = {
  thinking: { icon: 'sparkles-outline', text: 'Coach is thinking…' },
  context: { icon: 'analytics-outline', text: 'Reviewing your week…' },
  drafting: { icon: 'create-outline', text: 'Writing your reply…' },
  web: { icon: 'globe-outline', text: 'Searching the web…' },
  working: { icon: 'checkmark-circle-outline', text: 'Applying your request…' },
};

// Shared bubble chrome for TypingIndicator (speech-bubble corner + iOS shadow / Android elevation).
function coachLoadingBubbleStyle(palette) {
  // Design Law waiting chrome — 3px border + hard offset shadow (not soft iOS blur).
  return {
    borderRadius: borderRadius.nbCard,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: palette.cardBg,
    borderWidth: nb.borderWidth,
    borderColor: palette.cardBorder,
    shadowColor: palette.shadow || lightColors.nbShadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  };
}

// ─── Loading bubble only (thinking / web search / drafting) ───────────────────
// Footer under FlatList while typing=true or a tool is executing.
// phase drives COACH_WAIT_LABELS + whether dots are cyan (web) or pink (normal).
function TypingIndicator({ palette, phase = 'thinking', isDark = true }) {
  // vocab: useRef = mutable box that survives re-renders without triggering them
  // vocab: Animated.Value = opacity driver for each bouncing dot (0.35 rest → 1 peak)
  const dot1 = useRef(new Animated.Value(0.35)).current;
  const dot2 = useRef(new Animated.Value(0.35)).current;
  const dot3 = useRef(new Animated.Value(0.35)).current;

  // Start three staggered opacity loops on mount; stop them on unmount so they don't leak.
  useEffect(() => {
    const dots = [dot1, dot2, dot3];
    const loops = dots.map((anim, i) =>
      // vocab: Animated.loop / sequence = repeat fade-up then fade-down forever
      Animated.loop(
        Animated.sequence([
          // Stagger each dot so they bounce in a wave, not in sync.
          // Manipulate here: i * 160 = stagger ms; 380 = fade duration each way.
          Animated.delay(i * 160),
          Animated.timing(anim, { toValue: 1, duration: 380, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.35, duration: 380, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    // Cleanup: stop loops when the loading bubble unmounts (reply arrived / cancelled).
    return () => {
      loops.forEach((l) => l.stop());
    };
  }, [dot1, dot2, dot3]);

  // Unknown phase → fall back to "thinking" so we never show blank copy.
  const meta = COACH_WAIT_LABELS[phase] || COACH_WAIT_LABELS.thinking;

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 16 }}>
      <View style={coachLoadingBubbleStyle(palette)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* Mini sparkles tile — same warm gradient as CoachReplyHeader */}
          <LinearGradient
            colors={AI_COACH_UI.gradient.borderWarm}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 22,
              height: 22,
              borderRadius: 7,
              borderWidth: nb.borderWidth,
              borderColor: palette.cardBorder,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={meta.icon} size={12} color={lightColors.nbInk} />
          </LinearGradient>
          <Text style={{ color: palette.textPrimary, fontSize: 14, fontWeight: '600', flexShrink: 1 }}>
            {meta.text}
          </Text>
          {/* Three animated dots — cyan only during web-search phase */}
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

// Design Law coach nameplate: gradient avatar chip + COACH label (Copy reply sits under the body).
function CoachReplyHeader({ palette }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
      }}
    >
      <LinearGradient
        colors={accentGradients[2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          borderWidth: nb.borderWidth,
          borderColor: palette.cardBorder,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="person" size={14} color={lightColors.nbInk} />
      </LinearGradient>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '900',
          color: palette.textSecondary,
          letterSpacing: 1.1,
          textTransform: 'uppercase',
        }}
      >
        Coach
      </Text>
    </View>
  );
}

// Clipboard control for a bubble. compact=true = icon-only (used in headers / under user bubbles).
function CoachMessageCopyButton({ text, palette, isDark = false, align = 'flex-end', compact = false }) {
  // Flash "Copied" check for COPY_FEEDBACK_MS, then revert.
  // Manipulate here: COPY_FEEDBACK_MS controls how long the success chrome sticks.
  const [copied, setCopied] = useState(false);
  // Hold the timeout id so we can clear it on remount / rapid re-taps.
  const timerRef = useRef(null);
  // Design Law: never green chrome — brand pink for success, nb tokens for idle.
  const successColor = AI_COACH_UI.pink;
  const borderIdle = isDark ? darkColors.nbBorder : lightColors.nbBorder;
  const chipIdle = isDark ? darkColors.nbSurfaceChip : lightColors.nbSurfaceChip;

  // On unmount: clear any pending "Copied" reset so we don't setState on a dead component.
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // Copy → haptic → show success chrome → schedule revert.
  const handleCopy = async () => {
    // announce:false — we handle a11y label swap ourselves instead of a system toast.
    const ok = await copyCoachText(text, { announce: false });
    if (!ok) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (_) {
      /* ignore — some simulators / web builds have no haptic hardware */
    }
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  };

  return (
    <Pressable
      onPress={handleCopy}
      // Larger hit area than the tiny icon — easy to tap next to the timestamp.
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel={copied ? 'Copied to clipboard' : 'Copy message'}
      // vocab: style={({ pressed }) => ...} = Pressable callback style for press feedback
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: align,
        gap: compact ? 0 : 5,
        paddingVertical: compact ? 4 : 6,
        paddingHorizontal: compact ? 2 : 10,
        borderRadius: compact ? 8 : 16,
        // Compact mode stays transparent; full mode tints brand when copied / on press.
        backgroundColor: compact
          ? 'transparent'
          : pressed
            ? (copied ? 'rgba(236,72,153,0.14)' : chipIdle)
            : copied
              ? 'rgba(236,72,153,0.1)'
              : chipIdle,
        borderWidth: compact ? 0 : nb.borderWidth,
        borderColor: copied ? successColor : borderIdle,
        alignSelf: align,
      })}
    >
      <Ionicons
        name={copied ? 'checkmark-circle' : 'copy-outline'}
        size={compact ? 16 : 18}
        color={copied ? successColor : palette.textSecondary}
      />
      {/* Compact = icon only; full = "Copy" / "Copied" label beside the icon */}
      {!compact ? (
      <Text
        style={{
          fontSize: 13,
          fontWeight: '800',
          color: copied ? successColor : palette.textSecondary,
        }}
      >
        {copied ? 'Copied' : 'Copy reply'}
      </Text>
      ) : null}
    </Pressable>
  );
}

// User-bubble body: strip markdown-ish noise then allow native text selection.
function CoachSelectableMessageText({ text, color, isDark }) {
  // vocab: coachPlainText = flatten rich reply markup into clipboard/selection-friendly string
  const plain = coachPlainText(text);
  return (
    <Text
      selectable
      // Manipulate here: selection highlight tint for dark vs light.
      selectionColor={isDark ? 'rgba(236,72,153,0.35)' : 'rgba(190,24,93,0.25)'}
      style={{ color, fontSize: 15, lineHeight: 24 }}
    >
      {plain}
    </Text>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
// One row in the FlatList: user (right) or coach (full-width) with optional chip / sources.
// lastUserText + threadMessages exist so web-status + tool-chip gating can see the prior turn.
function MessageBubble({
  message,
  palette,
  onToolPress,
  onSkipTool,
  isDark = true,
  lastUserText = '',
  threadMessages = null,
  toolModalVisible = false,
  showFollowUps = false,
  onFollowUpPress = null,
  userProfile = null,
}) {
  // sent=true → right-aligned user bubble; false → full-width coach reply.
  const sent = message.role === 'user';
  const atts = Array.isArray(message.attachments) ? message.attachments : [];
  // Prefer an image preview; otherwise show a file chip (PDF / doc picker result).
  const firstImage = atts.find((a) => a?.preview);
  const firstFile = !firstImage ? atts.find((a) => a && !a.preview) : null;
  const rawText = String(message.text || '');
  // AI replies may still contain hidden tool JSON — strip before painting the bubble.
  const displayText = sent ? rawText : stripCoachToolJsonFromReply(rawText);
  const hasText = !!displayText.trim();

  // Pick body: image-only → file chip → selectable user text → rich CoachReplyText.
  const renderContent = () => {
    // Attachment-only message with a preview URI → show the photo.
    if (!hasText && firstImage?.preview) {
      // Manipulate here: inline image thumbnail size in the bubble.
      return <Image source={{ uri: firstImage.preview }} style={{ width: 220, height: 160 }} resizeMode="cover" />;
    }
    // Attachment-only non-image → document chip (coach may not analyze it yet).
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
    // User text → plain selectable (no markdown renderer on the user side).
    if (sent) {
      return (
        <CoachSelectableMessageText text={displayText} color={palette.textPrimary} isDark={isDark} />
      );
    }
    // Coach text → CoachReplyText (markdown / web-search styling).
    return (
      <CoachReplyText
        text={displayText}
        isDark={isDark}
        isWebSearch={message.searchedWeb === true || message.route === 'web-search'}
      />
    );
  };

  // Manipulate here: maxWidth of user bubbles (leave room so they don't look full-bleed).
  const userWrapStyle = { maxWidth: '82%' };
  // Neobrutalist bubble: thick border, rounded corners
  const bubbleBase = {
    borderRadius: borderRadius.nbCard,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  };
  // Media-only bubbles drop padding so the image goes edge-to-edge inside the rounded rect.
  const attachmentOnly = !hasText && (firstImage || firstFile);
  const mediaStyle = attachmentOnly ? { paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' } : null;
  const copyText = coachPlainText(displayText) || displayText;

  // Design Law user bubble — solid fill, white/black onFill, hard shadow, sharp bottom-right.
  if (sent) {
    const userTextColor = palette.onFill || lightColors.nbOnFill;
    return (
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.md + 4 }}>
        <View style={userWrapStyle}>
          <View
            style={[
              bubbleBase,
              mediaStyle,
              {
                backgroundColor: palette.fill || lightColors.nbFill,
                borderWidth: nb.borderWidth,
                borderColor: palette.cardBorder,
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                borderBottomLeftRadius: 16,
                borderBottomRightRadius: 4,
                shadowColor: palette.shadow || lightColors.nbShadow,
                shadowOffset: { width: 4, height: 4 },
                shadowOpacity: 1,
                shadowRadius: 0,
                elevation: 4,
              },
            ]}
          >
            <View pointerEvents="box-none">
              {hasText ? (
                <CoachSelectableMessageText text={displayText} color={userTextColor} isDark={isDark} />
              ) : (
                renderContent()
              )}
            </View>
          </View>
          {/* Design Law PNG 03: user bubble only — no copy/time row under the fill bubble */}
        </View>
      </View>
    );
  }

  // Did the user ask something that would normally trigger web search?
  const askedForWeb = shouldShowWebSearchUI(lastUserText, threadMessages);
  // Design Law PNG 05: only show the web chip when we actually searched.
  // Never show “answered from knowledge / didn’t search” — that copy is banned.
  const showWebResearchChip = Boolean(message.searchedWeb);
  void askedForWeb;

  // ── Coach bubble (full width) ──
  // PNG 03 order: body → Copy reply → Ready to log → ASK NEXT
  return (
    <View style={{ width: '100%', marginBottom: 24, alignSelf: 'stretch' }}>
      <CoachReplyHeader palette={palette} />
      {showWebResearchChip ? (
        <View style={{ alignSelf: 'flex-start', marginBottom: 10 }}>
          <LinearGradient
            colors={accentGradients[0]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderWidth: nb.borderWidth,
              borderColor: palette.cardBorder,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '900', color: lightColors.nbInk }}>
              Fitness web research
            </Text>
          </LinearGradient>
        </View>
      ) : null}
      {/* Design Law coach body — flat text on canvas (not a pink gradient bubble) */}
      {attachmentOnly && firstImage?.preview ? (
        <View
          style={{
            marginBottom: spacing.sm,
            borderWidth: nb.borderWidth,
            borderColor: palette.cardBorder,
            borderRadius: borderRadius.nbCard,
            overflow: 'hidden',
            backgroundColor: palette.cardBg,
          }}
        >
          <View style={{ overflow: 'hidden' }}>{renderContent()}</View>
        </View>
      ) : (
        <View style={{ marginBottom: spacing.sm }}>{renderContent()}</View>
      )}
      <SourceLinkCards message={message} isDark={isDark} />
      {hasText ? (
        <View style={{ marginTop: 10, alignSelf: 'flex-start' }}>
          <CoachMessageCopyButton
            text={copyText}
            palette={palette}
            isDark={isDark}
            align="flex-start"
            compact={false}
          />
        </View>
      ) : null}
      {coachActionPromptVisible(message, lastUserText) && !toolModalVisible ? (
        <ToolActionChip
          message={message}
          onPress={onToolPress}
          onSkip={onSkipTool}
          palette={palette}
          userMessage={lastUserText}
        />
      ) : null}
      {showFollowUps && Array.isArray(message.followUpPrompts) && message.followUpPrompts.length ? (
        <View style={{ marginTop: 16 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '900',
              letterSpacing: 1.1,
              color: palette.textSecondary,
              marginBottom: 8,
            }}
          >
            ASK NEXT
          </Text>
          <View
            style={{
              borderWidth: nb.borderWidth,
              borderColor: palette.cardBorder,
              borderRadius: borderRadius.nbCard,
              backgroundColor: palette.cardBg,
              overflow: 'hidden',
              shadowColor: palette.shadow || lightColors.nbShadow,
              shadowOffset: { width: 4, height: 4 },
              shadowOpacity: 1,
              shadowRadius: 0,
              elevation: 4,
            }}
          >
            {/* Design Law PNG 03 shows two Ask Next rows */}
            {message.followUpPrompts.slice(0, 2).map((prompt, index, arr) => (
              <Pressable
                key={`fu-${index}`}
                onPress={() => onFollowUpPress?.(prompt)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  borderBottomWidth: index < arr.length - 1 ? 2 : 0,
                  borderBottomColor: palette.cardBorder,
                }}
              >
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '800', color: palette.textPrimary }}>
                  {prompt}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}


/**
 * After a tool succeeds: haptic, refresh coach context, maybe refresh nutrition UI.
 * skipRecalibration=true on refresh so we don't re-run heavy goal math mid-turn.
 */
async function runAfterSuccessfulCoachTool({ toolName, refreshCoachContext, onNutritionDataChanged }) {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (_) {
    /* ignore haptic failures — success path must still continue */
  }
  // Reload week/logs so the next send sees the write we just made.
  await refreshCoachContext(true);
  // Nutrition-touching tools also notify the parent so macros UI can re-fetch.
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
 * Decision: success → flip toolConfirmed on the source AI message;
 *           failure → append resultMsg (error bubble);
 *           success+inline → also append a short "done" bubble under the thread.
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
  // Prefer the id the confirm handler knew about; else hunt the latest unconfirmed tool bubble.
  let targetId = runMessageId || pendingToolMessageId;
  if (!targetId) {
    // Scan newest-first so auto-run tools still find the right AI message.
    const match = [...prevMessages].reverse().find(
      (message) =>
        message.role === 'ai' &&
        !message.toolConfirmed &&
        (message.toolCall || resolveMessageToolCall(message)),
    );
    targetId = match?.id || null;
  }

  // Mark the source bubble confirmed (and stash the merged toolCall if it was inferred-only).
  const marked = prevMessages.map((message) => {
    if (!targetId || message.id !== targetId) return message;
    // Multi-action reply: record THIS action as done and only flip
    // toolConfirmed when the whole queue has run — otherwise the chip
    // re-renders for the next pending action instead of disappearing.
    const queue = Array.isArray(message.toolCalls) && message.toolCalls.length
      ? message.toolCalls
      : [message.toolCall || merged];
    const completedToolCalls = result.success
      ? [...new Set([...(message.completedToolCalls || []), coachToolCallKey(merged)])]
      : message.completedToolCalls || [];
    const allDone = queue.every((queued) => completedToolCalls.includes(coachToolCallKey(queued)));
    return {
      ...message,
      // vocab/symbol: ...spread = copy message then override tool fields
      toolConfirmed: result.success ? allDone : false,
      toolCall: message.toolCall || merged,
      toolCalls: queue,
      completedToolCalls,
    };
  });

  // Failure → keep marked list + append the error resultMsg for the user to read.
  let next = result.success ? marked : [...marked, resultMsg];
  // Inline success (auto-run, no modal) → add a short confirmation bubble with the tool's message.
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
 * Why not rewrite the whole session: cheaper writes + avoids racing with an in-flight send.
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
  // Offline / signed-out → skip (UI already updated locally).
  if (!db || !userId) return;
  // Keep: the confirmed source bubble, optional inline ok bubble, or the failure resultMsg.
  const toPersist = next.filter((message) => {
    if (targetId && message.id === targetId) return true;
    if (result.success && inline && result.message && message.id?.startsWith('msg_tool_ok_')) return true;
    if (!result.success && message.id === resultMsg.id) return true;
    return false;
  });
  // Session meta wants the latest user/AI snippets for the past-chats list preview.
  const lastUser = [...next].reverse().find((message) => message.role === 'user');
  const lastAi = [...next].reverse().find((message) => message.role === 'ai');
  // Fire-and-forget — a persist failure shouldn't undo the local UI update.
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
  // Step 1: actually mutate logs / open plan / notify trainer.
  const result = await carryOutAction({
    userId,
    trainerId,
    planId,
    toolCall: merged,
    // openWorkoutPlan tools need a nav callback from the parent tab shell.
    navigationHandlers: { onOpenWorkoutPlan },
  });

  // Pre-build an error bubble; only appended when result.success is false.
  const resultMsg = {
    id: `msg_tool_${Date.now()}`,
    role: 'ai',
    text: result.message || 'Could not complete that action.',
    time: now(),
    isError: true,
    toolConfirmed: true,
    isToolResult: true,
  };

  // Step 2: update local messages + persist the delta inside the same setState updater.
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

  // Step 3: success → haptic + context refresh; failure → blocking alert.
  if (result.success) {
    await runAfterSuccessfulCoachTool({
      toolName: merged.name,
      refreshCoachContext,
      onNutritionDataChanged,
    });
  } else {
    Alert.alert('Action failed', result.message || 'Could not complete that action.');
  }

  // Step 4: always close the modal + clear pending tool so the chip can reappear if needed.
  setToolModalVisible(false);
  setPendingToolCall(null);
  setPendingToolMessageId(null);
  scrollToBottom();
}

/**
 * Refuse file-only attachments; coach currently analyzes photos only.
 * Returns { ok, imageAtts, title?, message? } — caller Alerts when ok=false.
 */
function coachAttachmentGateMessage(atts) {
  // Treat type==='image' OR anything with a preview URI as a photo we can send.
  const imageAtts = atts.filter((attachment) => attachment?.type === 'image' || attachment?.preview);
  // PDF/doc picked with zero images → block send with a clear "photos only" alert.
  const hasFilesOnly = atts.some((attachment) => attachment?.type === 'file') && imageAtts.length === 0;
  if (hasFilesOnly) {
    return {
      ok: false,
      imageAtts,
      // Manipulate here: alert title/body when the user attaches a PDF/doc only.
      title: 'Photos work best',
      message:
        'The coach can analyze progress photos right now. PDF and document reading is not wired yet — attach a photo instead.',
    };
  }
  // Attachments exist but none looked like images (corrupt pick / missing preview).
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

/**
 * Turn a thrown error into a short coach bubble string (never dump raw Firebase noise).
 * Manipulate here: matchers / user-facing copy for common failure modes.
 */
function friendlyCoachSendErrorMessage(err) {
  const raw = String(err?.message || '');
  // Firestore rejected undefined / bad field types during persist.
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
 * Order: resolve tool → prepare display text → paint bubble → clear wait UI → auto tool → save.
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
  // Decide which Confirm Actions (if any) this reply should carry — plural:
  // one reply can hold several queued actions, confirmed one chip at a time.
  const resolvedTools = resolveIncomingCoachTools(coachResponse, text.trim());
  const resolvedTool = resolvedTools[0] || null;
  // Strip tool JSON + build follow-up prompt chips for the UI.
  const prepared = prepareCoachReplyForDisplay(coachResponse.message || '', {
    userMessage: text.trim(),
    searchedWeb: coachResponse.searchedWeb === true,
    userProfile: userProfile || {},
  });

  // +1 on Date.now so the AI id never collides with the optimistic user msg_ id.
  const aiMsg = {
    id: `msg_${Date.now() + 1}`,
    role: 'ai',
    text: prepared.displayText,
    followUpPrompts: prepared.followUpPrompts,
    time: now(),
    source: coachResponse.source,
    toolCall: resolvedTool,
    toolCalls: resolvedTools,
    completedToolCalls: [],
    searchedWeb: coachResponse.searchedWeb === true,
    webProvider: coachResponse.webProvider || null,
    route: coachResponse.route || null,
    webSources: Array.isArray(coachResponse.webSources) ? coachResponse.webSources : [],
    featureCards: plannedCards,
    // API can return success:false with a soft failure message — still show as a bubble.
    isError: !coachResponse.success,
  };

  // Dev-only turn logs — helps debug routing / web / tool issues without UI noise.
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

  // Paint the AI bubble and tear down the waiting chrome (typing dots + feature cards).
  const finalMessages = [...updatedMessages, aiMsg];
  setMessages(finalMessages);
  setTyping(false);
  setSearchingWeb(false);
  clearFeatureTimers();
  setActiveFeatureCards([]);

  // Maybe auto-run, auto-open modal, or just leave the chip for a tap.
  maybeAutoRunOrOpenCoachTool({
    resolvedTool,
    coachResponse,
    text,
    aiMsgId: aiMsg.id,
    handleToolConfirm,
    openToolModal,
  });

  // Persist the full thread once the AI reply is in (title generation may run here).
  if (db && userId) {
    await persistSession(finalMessages);
  }
}

/**
 * Auto-execute, open confirm modal, or log a debug nudge — one branch only.
 * Priority: auto-execute safe tools → auto-open modal for riskier ones → else chip stays tappable.
 */
function maybeAutoRunOrOpenCoachTool({
  resolvedTool,
  coachResponse,
  text,
  aiMsgId,
  handleToolConfirm,
  openToolModal,
}) {
  // Branch A: low-risk tools (e.g. some logs) run immediately without a modal.
  if (resolvedTool && shouldAutoExecuteCoachTool(resolvedTool, { userText: text.trim() })) {
    // inline:true → messagesAfterToolRun adds a short "done" bubble instead of using the modal.
    handleToolConfirm({}, resolvedTool, { inline: true, messageId: aiMsgId });
    return;
  }
  // Branch B: open ConfirmActionPopup immediately (user still has to tap Confirm inside).
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
  // Branch C: user sounded action-y but model returned no tool — log for debugging.
  const looksLikeAction =
    coachResponse.success &&
    /\b(log|swap|bump|schedule|deload|notify|adjust)\b/i.test(text.trim());
  if (!resolvedTool && looksLikeAction) {
    logger.debug('AI Coach: action-like message but no toolCall returned');
  }
}

/**
 * Persist first message if needed, call the coach API, then finish the success path.
 * Errors bubble up to sendMessage's catch (which paints a friendly error bubble).
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
  // Step 1: save the optimistic user turn early so a crash mid-API doesn't lose it.
  // First message in a brand-new session also stamps createdAt via serverTimestamp.
  if (db && userId) {
    const isFirstMessage = messagesBeforeSend.length === 0;
    await persistSession(updatedMessages, isFirstMessage ? { createdAt: serverTimestamp() } : {});
  }

  // Step 2: hit the coach backend (retries live inside sendCoachMessageWithRetry).
  const coachResponse = await sendCoachMessageWithRetry({
    userId,
    userMessage: text.trim(),
    messages: updatedMessages,
    userProfile: userProfile || {},
    coachContext,
    attachments: imageAtts,
  });

  // Step 3: paint AI bubble / maybe run tool / persist full session.
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
 * Props come from the AI Coach tab shell: identity, nav callbacks, optional prefill/session.
 * @param {object} props
 */
export default function CoachConversationScreen({
  // vocab: prefill = optional text to auto-send once the session finishes loading
  prefill,
  // Rename so we can keep a stable `sessionId` state even when the prop is undefined (new chat).
  sessionId: initialSessionId,
  userId,
  userProfile,
  trainerId: trainerIdProp,
  onBack,
  initialAttachments = [],
  // When true, pop the attach menu as soon as a restored/new session is ready.
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
  // Parent nutrition screen refresh after logNutrition / adjustMacros / deleteLog.
  onNutritionDataChanged,
  hideBottomNav = false,
  // Wide tablets can dock PastChatsPanel; phones use the History overlay instead.
  enableHistorySidebar = false,
  onSessionSwitch,
  onNewChat,
}) {
  // ── Layout / theme / refs ──
  const insets = useSafeAreaInsets();
  // vocab: isWideLayout = window wider than WIDE_LAYOUT_MIN_WIDTH → docked sidebar mode
  const isWideLayout = Dimensions.get('window').width >= WIDE_LAYOUT_MIN_WIDTH;
  // Keyboard pad values keep the composer above the keyboard + bottom nav.
  const { keyboardVisible, composerKeyboardPad, listBottomPad } =
    keyboardBehavior({ hideBottomNav });
  const { isDark } = useTheme();
  const palette = isDark ? DARK : LIGHT;
  // FlatList handle for scrollToEnd after new messages / typing.
  const flatListRef = useRef(null);
  // Guard so a prefill only auto-sends once (not on every re-render).
  const prefillSent = useRef(false);
  // Cached creative title so we don't regenerate on every persist.
  const sessionTitleRef = useRef(null);
  // Snapshot mount attachments so the prefill effect can send them even if state changes.
  const mountAttachmentsRef = useRef(Array.isArray(initialAttachments) ? initialAttachments : []);

  // ── Thread + composer state ──
  const [messages, setMessages] = useState([]);
  // vocab: typingBox = composer helper (text value, paste sheet, speech merge, TextInput ref)
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
  // typing=true shows TypingIndicator; searchingWeb swaps its phase to "web".
  const [typing, setTyping] = useState(false);
  const [searchingWeb, setSearchingWeb] = useState(false);
  // Phase label for the loading bubble (thinking → context → drafting, or web/working).
  const [coachWaitPhase, setCoachWaitPhase] = useState('thinking');
  // Pending attach strip above the TextInput (photos / files not yet sent).
  const [attachments, setAttachments] = useState(() =>
    Array.isArray(initialAttachments) ? initialAttachments : []
  );
  // Stable id for this conversation — generated once if parent didn't pass one.
  const [sessionId] = useState(initialSessionId || `aiChat_${Date.now()}`);
  // false until Firestore restore finishes (or immediately true for brand-new chats).
  const [loadedSession, setLoadedSession] = useState(!initialSessionId);
  // Progressive "feature explanation" cards while waiting (cleared when reply arrives).
  const [activeFeatureCards, setActiveFeatureCards] = useState([]);
  // Week/logs snapshot fed into sendCoachMessageWithRetry.
  const [coachContext, setCoachContext] = useState(null);
  const [contextLoading, setContextLoading] = useState(true);
  // _dataQuality / _recalibrationNote come back on the context object for debugging / UI notes.
  const [contextQuality, setContextQuality] = useState(0);
  const [recalibrationNote, setRecalibrationNote] = useState(null);
  // ConfirmActionPopup visibility + which tool / which AI message it belongs to.
  const [toolModalVisible, setToolModalVisible] = useState(false);
  const [pendingToolCall, setPendingToolCall] = useState(null);
  const [pendingToolMessageId, setPendingToolMessageId] = useState(null);
  // Prevents double-tapping Confirm while carryOutAction is in flight.
  const [toolExecuting, setToolExecuting] = useState(false);
  // Sidebar starts collapsed on narrow screens; expanded on wide when docked.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(!isWideLayout);
  const [historyOverlayOpen, setHistoryOverlayOpen] = useState(false);
  // Design Law sheets — replace native ActionSheet / Alert for attach + delete
  const [attachSheetOpen, setAttachSheetOpen] = useState(false);
  const [deleteSheetSession, setDeleteSheetSession] = useState(null);
  // Live list of past sessions for PastChatsPanel (docked or overlay).
  const coachSessions = chatHistoryList(userId);
  // Timeout ids for staggered feature-card reveals — cleared on send finish / error.
  const featureTimers = useRef([]);

  // Trainer id for notifyTrainer / bookSession tools (prop wins, else profile fields).
  const trainerId = trainerIdProp || userProfile?.trainerId || userProfile?.trainer?.id || null;
  // openWorkoutPlan always targets the user's active program.
  const planId = 'current';

  // Send enabled when there's typed text OR at least one pending attachment.
  const canSend = input.trim().length > 0 || attachments.length > 0;

  // Mic button: streams partial/final transcripts into the composer via typingBox.
  const coachSpeech = useCoachSpeech({
    onPartialTranscript: applySpeechTranscript,
    onFinalTranscript: applySpeechTranscript,
  });
  const { listening, toggleListen } = coachSpeech;

  // Advance the loading-bubble phase while typing (unless we're in web-search mode).
  // vocab: useEffect = run after paint; return cleanup clears timeouts when deps change / unmount
  useEffect(() => {
    // Not waiting → reset label so the next send starts at "thinking".
    if (!typing) {
      setCoachWaitPhase('thinking');
      return undefined;
    }
    // Web search takes over the phase entirely (no context/drafting timers).
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

  // Keep the latest typing / tool-working bubble in view as phases change.
  useEffect(() => {
    if (typing || toolExecuting) scrollToBottom();
  }, [typing, toolExecuting, coachWaitPhase, searchingWeb]);

  // Save the whole session (messages + meta title / last snippets) to Firestore.
  // Title rules: no AI yet → "New Chat"; after first AI reply → creative title once.
  const persistSession = async (msgs, extraMeta = {}) => {
    if (!db || !userId) return;
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
    const lastAi = [...msgs].reverse().find((m) => m.role === 'ai');
    const hasAiReply = Boolean(lastAi);

    let title = extraMeta.title || sessionTitleRef.current;

    // Before any AI reply, keep a placeholder (or keep a good title if we already have one).
    if (!hasAiReply) {
      title = title && !needsCreativeTitle(title, lastUser?.text) ? title : 'New Chat';
    } else if (!title || title === 'New Chat' || needsCreativeTitle(title, lastUser?.text)) {
      // Build a short title from the conversation (local heuristic, then optional model title).
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

  // Slight delay so FlatList finishes laying out new rows before scrollToEnd.
  // Manipulate here: 80ms scroll delay — raise if the list jumps mid-layout.
  const scrollToBottom = () => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
  };

  // Reload week/logs context (after tool writes, or manually). skipRecalibration=true is lighter.
  const refreshCoachContext = async (skipRecalibration = false) => {
    if (!userId) {
      setCoachContext(null);
      setContextLoading(false);
      return;
    }
    setContextLoading(true);
    const ctx = await loadCoachContextEnhanced(userId, userProfile || {}, { skipRecalibration });
    setCoachContext(ctx);
    // vocab/symbol: ?? = use 0 only when _dataQuality is null/undefined
    setContextQuality(ctx?._dataQuality ?? 0);
    setRecalibrationNote(ctx?._recalibrationNote || null);
    setContextLoading(false);
  };

  // Chip / auto-open path: validate tool, light haptic, show ConfirmActionPopup.
  const openToolModal = (toolCall, messageId = null) => {
    const normalized = guardCoachToolProposal(normalizeToolCall(toolCall));
    if (!normalized) {
      Alert.alert('Action unavailable', 'This coach action could not be loaded. Try asking again.');
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {
      /* ignore — simulators may lack haptics */
    }
    setPendingToolCall(normalized);
    // messageId ties the modal back to the AI bubble so we mark the right chip confirmed.
    setPendingToolMessageId(messageId);
    setToolModalVisible(true);
  };

  // Design Law PNG 03 Skip — dismiss the Ready-to-log chip without running the tool.
  const skipToolPrompt = (messageId) => {
    if (!messageId) return;
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId
          ? { ...message, toolConfirmed: true, toolCall: null, toolCalls: [] }
          : message,
      ),
    );
  };

  // 1. Merge confirmed params → run the tool → update chat → refresh context.
  // toolOverride lets auto-run skip the modal's pendingToolCall; runOptions.inline skips modal UX.
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
    // Re-entry guard: ignore a second Confirm while the first is still writing.
    if (toolExecuting) return;

    // Modal edits (amount, date, …) overlay the coach's original params.
    const mergedRaw = {
      ...baseTool,
      params: { ...(baseTool.params || {}), ...(confirmedParams || {}) },
    };
    // Final safety gate before any Firestore write.
    const merged = guardCoachToolProposal(mergedRaw);
    if (!merged) {
      Alert.alert('Action unavailable', 'This coach action could not be validated. Try asking again.');
      return;
    }

    setToolExecuting(true);
    // vocab: __DEV__ = Metro/dev-only flag — strip these logs from production builds
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
      // Unexpected throw (network mid-write, etc.) → paint an error bubble in-thread.
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
      // Always clear the lock so the user can retry.
      setToolExecuting(false);
    }
  };

  // Load week/logs context whenever identity or profile changes.
  // cancelled flag ignores stale responses if the user switches accounts mid-fetch.
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

  // Restore a past session from Firestore (messages + title). New chats skip to loadedSession=true.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // No db / user / session id → nothing to restore; unlock the UI immediately.
      if (!db || !userId || !initialSessionId) {
        setLoadedSession(true);
        return;
      }
      try {
        // Fetch messages + meta in parallel so title + bubbles appear together.
        const [saved, meta] = await Promise.all([
          loadAiChatMessages(userId, initialSessionId),
          loadAiChatSessionMeta(userId, initialSessionId),
        ]);
        // Keep a good stored title so persistSession won't regenerate it.
        if (meta?.title && !needsCreativeTitle(meta.title, meta.lastUserMessage)) {
          sessionTitleRef.current = meta.title;
        }
        // Rehydrate AI bubbles: strip hidden tool JSON, re-guard any stored toolCall.
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
          // Drop empty rows (no text and no attachments) — leftover junk from old saves.
          .filter((m) => m.text.trim().length > 0 || (Array.isArray(m.attachments) && m.attachments.length > 0));

        if (!cancelled) {
          setMessages(restored);
          setLoadedSession(true);
          // Manipulate here: 50ms delay before scrolling restored history into view.
          setTimeout(scrollToBottom, 50);
        }
      } catch (e) {
        // Even on failure, unlock the composer so the user isn't stuck behind a spinner.
        if (!cancelled) setLoadedSession(true);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [initialSessionId, userId]);

  // Cancel staggered feature-card timeouts (call before starting a new send or on finish).
  const clearFeatureTimers = () => {
    (featureTimers.current || []).forEach((id) => clearTimeout(id));
    featureTimers.current = [];
  };

  // 2. User hits send → optimistic bubble → API → AI bubble (maybe auto-confirm a tool).
  const sendMessage = async (text, atts = []) => {
    // Empty send (no text, no attachments) is a no-op — don't clear the composer.
    if (!text.trim() && atts.length === 0) return;

    // Block PDF-only / unreadable attachments before we paint an optimistic bubble.
    const gate = coachAttachmentGateMessage(atts);
    if (!gate.ok) {
      Alert.alert(gate.title, gate.message);
      return;
    }
    const imageAtts = gate.imageAtts;

    // Optimistic user bubble — appears immediately while the API is in flight.
    const userMsg = {
      id: `msg_${Date.now()}`,
      role: 'user',
      text: text.trim(),
      time: now(),
      attachments: atts.length > 0 ? [...atts] : undefined,
    };

    const updatedMessages = [...messages, userMsg];
    // Decide wait-phase UI: web globe vs normal thinking → context → drafting.
    const plannedWeb = shouldShowWebSearchUI(text, updatedMessages);
    // Pre-build feature cards for the staggered reveal while waiting.
    const plannedCards = buildFeatureCards({ userText: text, userProfile: userProfile || {} });
    setMessages(updatedMessages);
    clearComposer();
    setAttachments([]);
    setTyping(true);
    setSearchingWeb(plannedWeb);
    setActiveFeatureCards([]);
    clearFeatureTimers();
    // Stagger card reveals: 1st quick, 2nd mid-wait, 3rd at FEATURE_CARDS_REVEAL_MS.
    // Manipulate here: 120 / 950 / FEATURE_CARDS_REVEAL_MS timing of the progressive cards.
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
        // Pre-send length used to detect "first message in session" for createdAt.
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
      // Pipeline threw — log + paint a friendly error bubble (keep the optimistic user msg).
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
      // Always tear down wait chrome even if finishCoachSendSuccess already did.
      setTyping(false);
      setSearchingWeb(false);
      clearFeatureTimers();
      setActiveFeatureCards([]);
      scrollToBottom();
    }
  };

  // Auto-send a deep-link / home-tile prefill once (after session restore finishes).
  useEffect(() => {
    if (!loadedSession || prefillSent.current) return;
    const text = String(prefill || '').trim();
    const atts = mountAttachmentsRef.current || [];
    if (!text && atts.length === 0) return;
    prefillSent.current = true;
    // Manipulate here: 350ms delay before auto-send — gives FlatList a beat to mount.
    setTimeout(() => sendMessage(text, atts), 350);
  }, [prefill, loadedSession]);

  // Attach menu actions — append to the pending strip (user still has to hit Send).
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

  // Design Law attach sheet (camera / library / analyze / paste).
  const openAttachMenu = () => setAttachSheetOpen(true);

  const handleAnalyzeProgressPhoto = async () => {
    await handlePhotoLibrary();
    if (!String(input || '').trim()) {
      setInput('Can you analyze this progress photo and give physique feedback?');
    }
  };

  // Deep-link path: open the attach menu as soon as the session is ready.
  useEffect(() => {
    if (loadedSession && openAttachmentsOnMount) {
      openAttachMenu();
    }
  }, [loadedSession, openAttachmentsOnMount]);

  // X on a pending thumbnail — drop that attachment before send.
  const removeAttachment = (id) => setAttachments((prev) => prev.filter((a) => a.id !== id));

  // Past-chats delete: open Design Law sheet → wipe Firestore → blank session if it was open.
  const handleDeleteSession = (session) => {
    const sid = session?.sessionId || session?.id;
    if (!db || !userId || !sid) return;
    setDeleteSheetSession(session);
  };

  const confirmDeleteSession = async (session) => {
    const sid = session?.sessionId || session?.id;
    if (!db || !userId || !sid) return;
    try {
      await deleteAiChatSession(userId, sid);
      if (sid === sessionId && onNewChat) onNewChat();
    } catch (err) {
      logger?.error?.('deleteAiChatSession failed', err);
    }
  };

  // Switch to another past session (parent owns navigation / remount with new sessionId).
  const handleSessionPress = (session) => {
    const sid = session?.sessionId || session?.id;
    // Ignore taps on the already-active session.
    if (!sid || sid === sessionId) return;
    setHistoryOverlayOpen(false);
    onSessionSwitch?.(session);
  };

  // "New chat" from sidebar/overlay — prefer onNewChat; fall back to onBack.
  const handleSidebarNewChat = () => {
    setHistoryOverlayOpen(false);
    if (onNewChat) {
      onNewChat();
      return;
    }
    onBack?.();
  };

  // Suggestion chips keyed off empty thread / hypertrophy / fat-loss / default.
  // Manipulate here: pill copy lists — these are the quick-start prompts users tap.
  const buildPills = () => {
    const historyText = messages.map((m) => (m.role === 'user' ? m.text : '')).join(' | ').toLowerCase();
    const goal = String(userProfile?.primaryGoal || userProfile?.goal || '').toLowerCase();
    const hasMessages = messages.length > 0;

    // Empty thread → generic starter topics.
    if (!hasMessages) {
      return [
        { text: 'Build me a plan', color: FEATURE_COLORS.generation },
        { text: 'Form check', color: FEATURE_COLORS.optimization },
        { text: 'Nutrition help', color: FEATURE_COLORS.tracking },
        { text: 'Track progress', color: FEATURE_COLORS.goals },
      ];
    }

    // Muscle / bulk conversation → hypertrophy-flavored follow-ups.
    if (historyText.includes('hypertrophy') || historyText.includes('bulk') || goal.includes('muscle')) {
      return [
        { text: 'Optimize my split', color: FEATURE_COLORS.generation },
        { text: 'Chest exercises', color: FEATURE_COLORS.analysis },
        { text: 'Bulk nutrition', color: FEATURE_COLORS.tracking },
        { text: 'Am I eating enough?', color: FEATURE_COLORS.goals },
      ];
    }

    // Fat-loss / recomp conversation → cut / plateau follow-ups.
    if (historyText.includes('skinny fat') || historyText.includes('recomp') || goal.includes('fat')) {
      return [
        { text: 'Body recomp tips?', color: FEATURE_COLORS.generation },
        { text: 'Cutting protocol', color: FEATURE_COLORS.tracking },
        { text: 'Recovery help', color: FEATURE_COLORS.analysis },
        { text: 'Why plateaued?', color: FEATURE_COLORS.goals },
      ];
    }

    // Default mid-conversation chips.
    return [
      { text: 'Adjust my routine', color: FEATURE_COLORS.generation },
      { text: 'Meal timing', color: FEATURE_COLORS.tracking },
      { text: 'Recovery tips', color: FEATURE_COLORS.analysis },
      { text: 'Progress check', color: FEATURE_COLORS.goals },
    ];
  };

  // Enrich each row with lastUserText + thread slice for web-status / tool-chip gating.
  // vocab: useMemo = recompute only when messages / typing / toolExecuting change
  const messagesWithContext = useMemo(() => {
    let lastUserText = '';
    return messages.map((m, index) => {
      // Running "last user text" so each AI bubble knows what question it answered.
      if (m.role === 'user') lastUserText = m.text || '';
      // Prefix of the thread up to this row — shaped for shouldShowWebSearchUI.
      const threadMessages = messages.slice(0, index + 1).map((row) => ({
        role: row.role === 'ai' ? 'assistant' : 'user',
        text: row.text || '',
        content: row.text || '',
      }));
      return {
        ...m,
        lastUserText,
        threadMessages,
        // Only the newest AI message (while idle) may show follow-up chips.
        isLastAssistant:
          m.role === 'ai' && index === messages.length - 1 && !typing && !toolExecuting,
      };
    });
  }, [messages, typing, toolExecuting]);

  // ── Screen layout ──
  // Row: optional docked PastChatsPanel | main column (header + thread + composer + modals).
  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, flexDirection: 'row' }}>
      {/* Wide / tablet: docked history rail on the left */}
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

      {/* Main chat column — minWidth:0 lets the flex child shrink beside the sidebar */}
      <View style={{ flex: 1, minWidth: 0 }}>
      {/* Design Law chat header — back + “Your coach” + menu (not shell profile/settings) */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: palette.bg,
        }}
      >
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.85}
          accessibilityLabel="Go back"
          hitSlop={MIN_TOUCH_HIT_SLOP}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            borderWidth: nb.borderWidth,
            borderColor: palette.cardBorder,
            backgroundColor: palette.cardBg,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: palette.shadow,
            shadowOffset: { width: 3, height: 3 },
            shadowOpacity: 1,
            shadowRadius: 0,
            elevation: 3,
          }}
        >
          <Ionicons name="chevron-back" size={22} color={palette.textPrimary} />
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            fontSize: 22,
            fontWeight: '900',
            letterSpacing: -0.4,
            color: palette.textPrimary,
          }}
          numberOfLines={1}
        >
          Your coach
        </Text>
        <TouchableOpacity
          onPress={() => {
            if (!enableHistorySidebar) setHistoryOverlayOpen(true);
            else refreshCoachContext();
          }}
          activeOpacity={0.85}
          accessibilityLabel={enableHistorySidebar ? 'Refresh coach context' : 'Past chats'}
          hitSlop={MIN_TOUCH_HIT_SLOP}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            borderWidth: nb.borderWidth,
            borderColor: palette.cardBorder,
            backgroundColor: palette.cardBg,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: palette.shadow,
            shadowOffset: { width: 3, height: 3 },
            shadowOpacity: 1,
            shadowRadius: 0,
            elevation: 3,
          }}
        >
          <Ionicons
            name={enableHistorySidebar ? 'refresh-outline' : 'menu'}
            size={22}
            color={palette.textPrimary}
          />
        </TouchableOpacity>
      </View>

      {/* Thread + composer stack */}
      <View style={{ flex: 1 }}>
        {/* Empty state: Lottie + hint (hidden once there's history, typing, or keyboard) */}
        {messages.length === 0 && !typing && !keyboardVisible ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <LottieView
              source={require('../../assets/animations/legacy/Cloud robotics abstract.json')}
              autoPlay
              loop
              // Manipulate here: empty-state animation size.
              style={{ width: 100, height: 100 }}
            />
            <Text style={{ color: palette.textSecondary, fontSize: 14, marginTop: 16 }}>Ask me anything to get started.</Text>
          </View>
        ) : (
          // Message list — virtualized; footer shows TypingIndicator while waiting / tool-running.
          <FlatList
            ref={flatListRef}
            data={messagesWithContext}
            accessibilityLabel="Coach conversation messages"
            keyExtractor={(m) => m.id}
            // Manipulate here: initialNumToRender / windowSize if long chats feel janky.
            initialNumToRender={20}
            maxToRenderPerBatch={10}
            windowSize={10}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                palette={palette}
                isDark={isDark}
                onToolPress={openToolModal}
                onSkipTool={skipToolPrompt}
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
              // listBottomPad leaves room above the composer + bottom nav.
              paddingBottom: listBottomPad,
            }}
            showsVerticalScrollIndicator
            // Keep taps on chips/buttons working while the keyboard is up.
            keyboardShouldPersistTaps="always"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            scrollEventThrottle={16}
            // false: clipped subviews broke some bubble presses on Android.
            removeClippedSubviews={false}
            // Auto-scroll when a new bubble grows the content height.
            onContentSizeChange={scrollToBottom}
            ListFooterComponent={
              typing || toolExecuting ? (
                // Design Law wait chrome is the typing row only (no feature-card stack).
                <TypingIndicator
                  palette={palette}
                  isDark={isDark}
                  phase={toolExecuting ? 'working' : coachWaitPhase}
                />
              ) : null
            }
            ListFooterComponentStyle={{ paddingBottom: 4 }}
          />
        )}

        {/* Design Law composer: 3px top border, square +, field, black send */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: attachments.length > 0 ? 10 : 8,
            paddingBottom: composerKeyboardPad,
            borderTopWidth: nb.borderWidth,
            borderTopColor: palette.inputBarBorder,
            backgroundColor: palette.inputBarBg,
          }}
        >
          {attachments.length > 0 ? (
            <View style={{ marginBottom: 12 }}>
              {/* Design Law PNG 09: READY TO SEND + count pill + large thumbs */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '900',
                    letterSpacing: 1.1,
                    color: palette.textSecondary,
                  }}
                >
                  READY TO SEND
                </Text>
                <View
                  style={{
                    borderWidth: nb.borderWidth,
                    borderColor: palette.cardBorder,
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    backgroundColor: palette.cardBg,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '900', color: palette.textPrimary }}>
                    {attachments.length} PHOTO{attachments.length === 1 ? '' : 'S'}
                  </Text>
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={{ flexGrow: 0 }}
                contentContainerStyle={{ gap: 12, alignItems: 'center' }}
              >
                {attachments.map((att, index) => {
                  const label =
                    index === 0 ? 'Side' : index === 1 ? 'Front' : `Photo ${index + 1}`;
                  return (
                    <View key={att.id} style={{ position: 'relative' }}>
                      {att.preview ? (
                        <Image
                          source={{ uri: att.preview }}
                          style={{
                            width: 112,
                            height: 140,
                            borderRadius: 12,
                            borderWidth: nb.borderWidth,
                            borderColor: palette.cardBorder,
                          }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={{
                            width: 112,
                            height: 140,
                            borderRadius: 12,
                            backgroundColor: palette.chipBg,
                            borderWidth: nb.borderWidth,
                            borderColor: palette.cardBorder,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="document-outline" size={22} color={palette.textSecondary} />
                        </View>
                      )}
                      <View
                        style={{
                          position: 'absolute',
                          left: 8,
                          bottom: 8,
                          backgroundColor: palette.fill,
                          borderRadius: 8,
                          borderWidth: 2,
                          borderColor: palette.cardBorder,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '900', color: palette.onFill }}>
                          {label}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => removeAttachment(att.id)}
                        {...a11yButton('Remove attachment')}
                        hitSlop={MIN_TOUCH_HIT_SLOP}
                        style={{
                          position: 'absolute',
                          top: -6,
                          right: -6,
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          backgroundColor: palette.fill,
                          borderWidth: nb.borderWidth,
                          borderColor: palette.cardBorder,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="close" size={14} color={palette.onFill} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
              <Text
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  fontWeight: '600',
                  color: palette.textSecondary,
                  lineHeight: 17,
                }}
              >
                Photos are sent with your message. Remove any you do not want to share.
              </Text>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
            <TouchableOpacity
              onPress={openAttachMenu}
              {...a11yButton('Add attachment', 'Attach a photo or paste text')}
              hitSlop={MIN_TOUCH_HIT_SLOP}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                borderWidth: nb.borderWidth,
                borderColor: palette.cardBorder,
                backgroundColor: palette.cardBg,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 2,
                shadowColor: palette.shadow,
                shadowOffset: { width: 3, height: 3 },
                shadowOpacity: 1,
                shadowRadius: 0,
                elevation: 3,
              }}
            >
              <Ionicons name="add" size={24} color={palette.textPrimary} />
            </TouchableOpacity>
            <View style={{ flex: 1, minWidth: 0 }}>
              <TextInput
                ref={composerInputRef}
                {...COACH_COMPOSER_TEXT_INPUT_PROPS}
                style={{
                  minHeight: 44,
                  maxHeight: 120,
                  fontSize: 15,
                  fontFamily: 'Inter_400Regular',
                  color: palette.textPrimary,
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderWidth: nb.borderWidth,
                  borderColor: palette.inputBorder,
                  borderRadius: borderRadius.nbInput,
                  backgroundColor: palette.inputBg,
                }}
                value={input}
                onChangeText={setInput}
                onLongPress={openPasteSheet}
                placeholder={
                  attachments.length > 0 ? 'Add a note, or just send' : 'Ask your coach anything'
                }
                placeholderTextColor={palette.textMuted}
                accessibilityLabel="Message input"
                accessibilityHint="Type a question for your AI coach"
                multiline
                blurOnSubmit={false}
              />
            </View>
            {COACH_VOICE_INPUT_AVAILABLE ? (
            <TouchableOpacity
              onPress={toggleListen}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 2,
                borderWidth: nb.borderWidth,
                borderColor: palette.cardBorder,
                backgroundColor: listening ? palette.fill : palette.cardBg,
              }}
              accessibilityLabel={listening ? 'Stop voice input' : 'Start voice input'}
            >
              <Ionicons
                name={listening ? 'mic' : 'mic-outline'}
                size={22}
                color={listening ? palette.onFill : palette.textPrimary}
              />
            </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() => sendMessage(input, attachments)}
              disabled={!canSend}
              activeOpacity={0.85}
              {...a11yButton('Send message', 'Sends your message to the AI coach')}
              accessibilityState={{ disabled: !canSend }}
              hitSlop={MIN_TOUCH_HIT_SLOP}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                marginBottom: 2,
                opacity: canSend ? 1 : 0.45,
                backgroundColor: palette.fill,
                borderWidth: nb.borderWidth,
                borderColor: palette.cardBorder,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: palette.shadow,
                shadowOffset: { width: 3, height: 3 },
                shadowOpacity: 1,
                shadowRadius: 0,
                elevation: 3,
              }}
            >
              <Ionicons name="arrow-forward" size={20} color={palette.onFill} />
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

      <CoachAttachSheet
        visible={attachSheetOpen}
        onClose={() => setAttachSheetOpen(false)}
        onCamera={handleCamera}
        onLibrary={handlePhotoLibrary}
        onAnalyze={handleAnalyzeProgressPhoto}
        onPaste={openPasteSheet}
      />

      <DeleteChatSheet
        visible={!!deleteSheetSession}
        session={deleteSheetSession}
        onClose={() => setDeleteSheetSession(null)}
        onConfirm={confirmDeleteSession}
      />

      {/* Tool confirm modal — edit params then Confirm, or cancel (blocked while executing) */}
      <ConfirmActionPopup
        visible={toolModalVisible}
        toolCall={pendingToolCall}
        onConfirm={handleToolConfirm}
        onCancel={() => {
          // Don't dismiss mid-write — user must wait for carryOutAction to finish.
          if (toolExecuting) return;
          setToolModalVisible(false);
          setPendingToolCall(null);
          setPendingToolMessageId(null);
        }}
        loading={toolExecuting}
      />

      {/* Bottom tab bar — hidden when hideBottomNav or keyboard is up */}
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

      {/* Phone history: full-screen overlay PastChatsPanel (sidebar mode uses docked above) */}
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

