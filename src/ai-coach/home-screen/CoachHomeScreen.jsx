// Design Law coach home — fill hero → one-tap / try asking → composer.
// Flow: load today's logs → hourly suggestions → tap row/hero/composer → open a chat (text or photo).
// Used as: AI Coach tab. Past chats open from the header.
// PNG law: screens/ai-coach/01–02. Variation 3: layout (no hooks) above; exported screen loads data below.

import React, { useState, useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
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
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import {
  pickCoachDocuments,
  pickCoachPhotoFromCamera,
  pickCoachPhotosFromLibrary,
} from '../conversation/choosePhoto';
import { doc, onSnapshot } from 'firebase/firestore';
import { deleteAiChatSession } from '../past-chats/saveAndLoadChats';
import PastChatsPanel from '../past-chats/PastChatsPanel';
import DeleteChatSheet from '../past-chats/DeleteChatSheet';
import { chatHistoryList } from '../past-chats/chatHistoryList';
import { db } from '../../app-start/cloudConnection';
import BottomMenuBar from '../../navigation/BottomMenuBar';
import { ShellBottomNavAnchor } from '../../navigation/bottomMenuSpacing';
import TopHeader from '../../for-both/loading-and-header/TopHeader';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbNoticeSheet from '../../look-and-feel/NbNoticeSheet';
import { lightColors, darkColors, spacing, borderRadius, nb, gradients } from '../../look-and-feel/colorPalette';
import { useCoachSpeech, COACH_VOICE_INPUT_AVAILABLE } from '../conversation/_voiceStub';
import { keyboardBehavior, COACH_COMPOSER_TEXT_INPUT_PROPS } from '../conversation/keyboardBehavior';
import CoachAttachSheet from '../conversation/CoachAttachSheet';
import PasteTextPopup from '../conversation/PasteTextPopup';
import CoachHomeBody from './CoachHomeBody';
import { AI_COACH_UI } from '../coachColors';
import {
  buildHourlyCanHelpWith,
  buildHourlyCoachActions,
  buildHourlySpotlightSuggestions,
  getCoachHourSlot,
} from '../conversation/suggestedQuestions';
import {
  HOME_STAT_SLEEP_GRADIENT,
  HOME_STAT_SORENESS_GRADIENT,
  HOME_STAT_WATER_GRADIENT,
  HOME_STAT_WORKOUT_GRADIENT,
} from '../../look-and-feel/homeStatColors';
import { getClientDateKey } from '../../helpers/dateStrings';
import { calculateMacroTotals, getFoodLogsForDate } from '../../nutrition/daily-log/saveLoggedFood';
import { parseDailyMetricsFromSnapshots } from '../../daily-stats/readDailyStats';
import { getAuroraHeroGreetingPhrase } from '../../for-both/home-cards/HomeTopBanner';

// ===== NAMED CONSTANTS =====

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const MS_PER_HOUR = SECONDS_PER_MINUTE * SECONDS_PER_MINUTE * MS_PER_SECOND;
const HOUR_TICK_MS = SECONDS_PER_MINUTE * MS_PER_SECOND;
const SCREEN_FADE_MS = 300;
const LOTTIE_DELAY_MS = 100;
const LOTTIE_FADE_MS = 500;
const PILL_BORDER_LOOP_MS = 7000;
const COMPOSER_DELAY_MS = 800;
const COMPOSER_FADE_MS = 300;
const CHAT_EXIT_MS = 200;
const SPOTLIGHT_ROTATE_MS = 4800;
const SUGGESTION_LIMIT = 6;
const TOPIC_SESSION_LOOKBACK = 18;
const TITLE_SESSION_LOOKBACK = 8;
const TOP_TOPIC_LIMIT = 3;

const USERS_COLLECTION = 'users';
const DAILY_TRACKING_COLLECTION = 'daily_tracking';
const DAILY_LOGS_COLLECTION = 'dailyLogs';
const COMPOSER_SEND_GRAD = AI_COACH_UI.gradient.composerSend;
const COMPOSER_SEND_GRAD_LIGHT = AI_COACH_UI.gradient.composerSendLight;

// Action shortcuts — generic openers (Log / Web / My Data / Photo).
const COACH_ACTIONS = [
  {
    id: 'log',
    label: 'Log',
    icon: 'add',
    starter: 'Can you log data for me?',
    rim: HOME_STAT_WORKOUT_GRADIENT,
    labelGrad: HOME_STAT_WORKOUT_GRADIENT,
  },
  {
    id: 'web',
    label: 'Research',
    sublabel: 'Fitness only',
    icon: 'globe-outline',
    starter: 'Search the web: what does research say about protein intake for lifters?',
    rim: HOME_STAT_WATER_GRADIENT,
    labelGrad: HOME_STAT_WATER_GRADIENT,
  },
  {
    id: 'data',
    label: 'My Data',
    icon: 'stats-chart-outline',
    starter: 'Can you show me my data and context?',
    rim: HOME_STAT_SLEEP_GRADIENT,
    labelGrad: HOME_STAT_SLEEP_GRADIENT,
  },
  {
    id: 'photo',
    label: 'Photo',
    icon: 'image-outline',
    starter: 'Can you analyze a photo for me?',
    rim: HOME_STAT_SORENESS_GRADIENT,
    labelGrad: HOME_STAT_SORENESS_GRADIENT,
  },
];

// ===== HELPER FUNCTIONS =====

function iconForPrompt(text) {
  const promptText = String(text || '').toLowerCase();
  const isNutritionHabit = promptText.includes('nutrition') || promptText.includes('habit');
  if (isNutritionHabit) return 'restaurant-outline';

  const isScheduleSplit =
    promptText.includes('full-body') ||
    promptText.includes('upper/lower') ||
    promptText.includes('schedule');
  if (isScheduleSplit) return 'body-outline';

  const isLiftWork =
    promptText.includes('workout') ||
    promptText.includes('hypertrophy') ||
    promptText.includes('split') ||
    promptText.includes('squat');
  if (isLiftWork) return 'barbell-outline';

  const isFoodMacros =
    promptText.includes('protein') ||
    promptText.includes('eat') ||
    promptText.includes('macro') ||
    promptText.includes('meal') ||
    promptText.includes('vegan') ||
    promptText.includes('keto');
  if (isFoodMacros) return 'nutrition-outline';

  const isSupplement = promptText.includes('supplement') || promptText.includes('creatine');
  if (isSupplement) return 'flask-outline';
  if (promptText.includes('recover')) return 'bed-outline';

  const isBodyResearch =
    promptText.includes('research') ||
    promptText.includes('skinny fat') ||
    promptText.includes('recomp') ||
    promptText.includes('body');
  if (isBodyResearch) return 'body-outline';

  const isProgression = promptText.includes('progressive') || promptText.includes('overload');
  if (isProgression) return 'trending-up-outline';

  const isComeback = promptText.includes('skipped') || promptText.includes('back');
  if (isComeback) return 'refresh-outline';

  const isCalorieCut =
    promptText.includes('calorie') ||
    promptText.includes('fat-loss') ||
    promptText.includes('deficit');
  if (isCalorieCut) return 'flame-outline';

  const isConditioning = promptText.includes('conditioning') || promptText.includes('athletic');
  if (isConditioning) return 'flash-outline';

  const isDrink = promptText.includes('drink') || promptText.includes('zero-sugar');
  if (isDrink) return 'water-outline';
  return 'sparkles-outline';
}

function rimForPrompt(text) {
  const promptText = String(text || '').toLowerCase();
  const isFuelTopic =
    promptText.includes('nutrition') ||
    promptText.includes('habit') ||
    promptText.includes('protein') ||
    promptText.includes('meal') ||
    promptText.includes('macro') ||
    promptText.includes('eat') ||
    promptText.includes('cal');
  if (isFuelTopic) return HOME_STAT_SORENESS_GRADIENT;

  const isTrainTopic =
    promptText.includes('workout') ||
    promptText.includes('split') ||
    promptText.includes('training') ||
    promptText.includes('full-body') ||
    promptText.includes('schedule');
  if (isTrainTopic) return HOME_STAT_WORKOUT_GRADIENT;

  const isRecoverTopic =
    promptText.includes('recover') ||
    promptText.includes('sleep') ||
    promptText.includes('rest');
  if (isRecoverTopic) return HOME_STAT_SLEEP_GRADIENT;

  const isWebTopic =
    promptText.includes('search') ||
    promptText.includes('web') ||
    promptText.includes('research');
  if (isWebTopic) return HOME_STAT_WATER_GRADIENT;

  return HOME_STAT_SORENESS_GRADIENT;
}

// ===== THEME TOKENS — nb surfaces for dark / light coach home =====
const darkCoachHomeTheme = {
  bg: darkColors.nbBackground,
  secondaryBg: darkColors.nbSurface,
  surfaceChip: darkColors.nbSurfaceChip,
  border: darkColors.nbBorder,
  textPrimary: darkColors.nbInk,
  textSecondary: darkColors.nbMuted,
  textMuted: darkColors.nbMuted,
  sidebarBg: darkColors.nbBackground,
  sidebarBorder: darkColors.nbBorder,
  divider: darkColors.nbBorder,
  headerBg: darkColors.nbBackground,
  inputBarBg: darkColors.nbBackground,
  accent: gradients.brand.colors[0],
  chipBg: darkColors.nbSurfaceChip,
  chipBorder: darkColors.nbBorder,
};

const lightCoachHomeTheme = {
  bg: lightColors.nbBackground,
  secondaryBg: lightColors.nbSurface,
  surfaceChip: lightColors.nbSurfaceChip,
  border: lightColors.nbBorder,
  textPrimary: lightColors.nbInk,
  textSecondary: lightColors.nbMuted,
  textMuted: lightColors.nbMuted,
  sidebarBg: lightColors.nbBackground,
  sidebarBorder: lightColors.nbBorder,
  divider: lightColors.nbBorder,
  headerBg: lightColors.nbBackground,
  inputBarBg: lightColors.nbBackground,
  accent: gradients.brand.colors[0],
  chipBg: lightColors.nbSurfaceChip,
  chipBorder: lightColors.nbBorder,
};

// Fallback phrases only used when we have zero contextual signals.
const FALLBACK_SUGGESTIONS = [
  'What is the single highest‑leverage change I can make this week?',
  'Given my goal, what should training and nutrition look like over the next 7 days?',
  'Spot the biggest mistake in how I’m currently training or eating.',
  'If I only have 3 sessions this week, how should I use them?',
  'Build me a simple plan for today that I can actually follow.',
  'Help me choose what to do right now: train, eat, recover, or plan.',
];

function uniquePromptList(prompts, limit) {
  const unique = [];
  for (const item of prompts) {
    if (!item) continue;
    if (unique.includes(item)) continue;
    unique.push(item);
    if (unique.length >= limit) break;
  }
  return unique;
}

function promptsForGoal(goal) {
  const wantsFatLoss = goal.includes('lose') || goal.includes('fat');
  if (wantsFatLoss) {
    return [
      'Based on my current stats, design a fat‑loss week that keeps my lifts moving up.',
      'How aggressive should my calorie deficit be so I lose fat without killing performance?',
    ];
  }
  const wantsMuscle = goal.includes('muscle') || goal.includes('build');
  if (wantsMuscle) {
    return [
      'Lay out a progression plan so I’m adding muscle over the next 4–6 weeks.',
      'Given my goal, what should my training split and progression look like this week?',
    ];
  }
  const wantsPerformance = goal.includes('athletic') || goal.includes('performance');
  if (wantsPerformance) {
    return [
      'Design a strength + conditioning week that actually improves performance, not just crushes me.',
      'How do I add conditioning without wrecking my main lifts?',
    ];
  }
  return [];
}

function promptsForDiet(dietPref) {
  const prompts = [];
  if (dietPref.includes('vegan')) {
    prompts.push('Build a high‑protein vegan day of eating that fits my training.');
  }
  if (dietPref.includes('keto')) {
    prompts.push('How do I run keto in a way that still supports hard training?');
  }
  return prompts;
}

function promptsForRecentTitles(titleText) {
  const prompts = [];
  if (titleText.includes('recomp') || titleText.includes('skinny fat')) {
    prompts.push('Map out a body‑recomposition plan for me (skinny‑fat problem).');
  }
  if (titleText.includes('macros') || titleText.includes('calories')) {
    prompts.push('Recalculate today’s macros based on my goal, training, and recent check‑ins.');
  }
  if (titleText.includes('creatine')) {
    prompts.push('Given my training, how should I actually use creatine and what should I expect?');
  }
  if (titleText.includes('zero sugar')) {
    prompts.push('Where do zero‑sugar drinks fit into my week, and what should I watch out for?');
  }
  return prompts;
}

function promptsForTopics(topTopics) {
  const prompts = [];
  if (topTopics.includes('training')) {
    prompts.push('Build me a 4‑day training split for the next 2 weeks (with progression).');
  }
  if (topTopics.includes('nutrition')) {
    prompts.push('Turn my calorie target into a simple macro + meal structure I can follow daily.');
  }
  if (topTopics.includes('recovery')) {
    prompts.push('Audit my recovery: sleep, stress, soreness — what’s the #1 fix this week?');
  }
  if (topTopics.includes('planning')) {
    prompts.push('Help me plan my week: when to train, meal prep, and recovery blocks.');
  }
  if (topTopics.includes('injury')) {
    prompts.push('Modify my training around my current aches so I can keep progressing safely.');
  }
  if (topTopics.includes('supplements')) {
    prompts.push('What supplements (if any) actually matter for my goal, and how should I take them?');
  }
  return prompts;
}

function promptAlreadyInPool(pool, fallback) {
  const fallbackLower = String(fallback).toLowerCase();
  for (let index = 0; index < pool.length; index += 1) {
    const promptLower = String(pool[index]).toLowerCase();
    if (promptLower === fallbackLower) return true;
  }
  return false;
}

function promptsWithFallbacks(contextual) {
  const pool = [];
  for (let index = 0; index < contextual.length; index += 1) {
    pool.push(contextual[index]);
  }
  for (let index = 0; index < FALLBACK_SUGGESTIONS.length; index += 1) {
    const fallback = FALLBACK_SUGGESTIONS[index];
    if (promptAlreadyInPool(pool, fallback)) continue;
    pool.push(fallback);
  }
  return uniquePromptList(pool, SUGGESTION_LIMIT);
}

function normalizeTextSignal(rawText) {
  const asString = String(rawText || '');
  const lower = asString.toLowerCase();
  const straightQuotes = lower.replace(/[\u2019']/g, "'");
  const lettersOnly = straightQuotes.replace(/[^a-z0-9\s-]/g, ' ');
  const singleSpaces = lettersOnly.replace(/\s+/g, ' ');
  return singleSpaces.trim();
}

function addTopicScore(topicScoreMap, topic, weight) {
  const previousScore = topicScoreMap.get(topic) || 0;
  topicScoreMap.set(topic, previousScore + weight);
}

function sessionChatHaystack(session) {
  if (!session) return '';
  const parts = [];
  if (session.title) parts.push(session.title);
  if (session.lastUserMessage) parts.push(session.lastUserMessage);
  if (session.lastAssistantMessage) parts.push(session.lastAssistantMessage);
  if (parts.length === 0) return '';
  return normalizeTextSignal(parts.join(' | '));
}

function scoreTopicsFromHaystack(topicScoreMap, chatHaystack) {
  if (/\bmacro|macros|calorie|deficit|bulk|cut|protein|carb|fat|meal|diet|nutrition\b/.test(chatHaystack)) {
    addTopicScore(topicScoreMap, 'nutrition', 3);
  }
  if (/\bworkout|split|hypertrophy|lift|squat|bench|deadlift|volume|program|deload|set|rep\b/.test(chatHaystack)) {
    addTopicScore(topicScoreMap, 'training', 3);
  }
  if (/\bsleep|recover|recovery|rest|soreness|stress|fatigue\b/.test(chatHaystack)) {
    addTopicScore(topicScoreMap, 'recovery', 2);
  }
  if (/\bplan|schedule|week|routine|habit|time\b/.test(chatHaystack)) {
    addTopicScore(topicScoreMap, 'planning', 2);
  }
  if (/\binjury|pain|knee|back|shoulder\b/.test(chatHaystack)) {
    addTopicScore(topicScoreMap, 'injury', 2);
  }
  if (/\bsupplement|creatine|caffeine\b/.test(chatHaystack)) {
    addTopicScore(topicScoreMap, 'supplements', 1);
  }
}

function topTopicsFromScoreMap(topicScoreMap) {
  const scoredEntries = [];
  for (const entry of topicScoreMap.entries()) {
    scoredEntries.push(entry);
  }
  scoredEntries.sort(function sortByScoreDescending(left, right) {
    return right[1] - left[1];
  });

  const topics = [];
  for (let index = 0; index < scoredEntries.length; index += 1) {
    if (topics.length >= TOP_TOPIC_LIMIT) break;
    topics.push(scoredEntries[index][0]);
  }
  return topics;
}

function inferTopTopicsFromSessions(sessions) {
  const topicScoreMap = new Map();
  const sessionList = sessions || [];
  const lookbackCount = Math.min(sessionList.length, TOPIC_SESSION_LOOKBACK);

  for (let index = 0; index < lookbackCount; index += 1) {
    const chatHaystack = sessionChatHaystack(sessionList[index]);
    if (!chatHaystack) continue;
    scoreTopicsFromHaystack(topicScoreMap, chatHaystack);
  }

  return topTopicsFromScoreMap(topicScoreMap);
}

function goalTextFromUserData(userData) {
  if (!userData) return '';
  const rawGoal = userData.primaryGoal || userData.goal || userData.fitnessGoal || '';
  return String(rawGoal).toLowerCase();
}

function dietTextFromUserData(userData) {
  if (!userData) return '';
  const rawDiet = userData.dietPreference || userData.diet || '';
  return String(rawDiet).toLowerCase();
}

function recentTitleTextFromSessions(sessions) {
  const sessionList = sessions || [];
  const lookbackCount = Math.min(sessionList.length, TITLE_SESSION_LOOKBACK);
  const titles = [];
  for (let index = 0; index < lookbackCount; index += 1) {
    const session = sessionList[index];
    if (!session || !session.title) continue;
    const trimmedTitle = String(session.title).trim();
    if (trimmedTitle) titles.push(trimmedTitle);
  }
  return normalizeTextSignal(titles.join(' | '));
}

function buildDynamicSuggestions({ userData, sessions }) {
  const goalText = goalTextFromUserData(userData);
  const dietPreferenceText = dietTextFromUserData(userData);
  const topTopics = inferTopTopicsFromSessions(sessions);
  const titleText = recentTitleTextFromSessions(sessions);

  const contextualPrompts = [];
  const goalPrompts = promptsForGoal(goalText);
  const dietPrompts = promptsForDiet(dietPreferenceText);
  const titlePrompts = promptsForRecentTitles(titleText);
  const topicPrompts = promptsForTopics(topTopics);

  for (let index = 0; index < goalPrompts.length; index += 1) contextualPrompts.push(goalPrompts[index]);
  for (let index = 0; index < dietPrompts.length; index += 1) contextualPrompts.push(dietPrompts[index]);
  for (let index = 0; index < titlePrompts.length; index += 1) contextualPrompts.push(titlePrompts[index]);
  for (let index = 0; index < topicPrompts.length; index += 1) contextualPrompts.push(topicPrompts[index]);

  if (contextualPrompts.length === 0) {
    return FALLBACK_SUGGESTIONS.slice(0, SUGGESTION_LIMIT);
  }
  return promptsWithFallbacks(contextualPrompts);
}

function pagerDotColor(isActive, isDark, activeColor) {
  if (isActive) return activeColor;
  if (isDark) return darkColors.nbBorder;
  return lightColors.nbBorder;
}

function pagerDotWidth(isActive) {
  if (isActive) return 16;
  return 5;
}

function listeningMicBackground(listening, isDark) {
  if (!listening) return 'transparent';
  if (isDark) return AI_COACH_UI.composer.micActiveBg;
  return AI_COACH_UI.composer.micActiveBgLight;
}

function keyboardDismissMode() {
  if (Platform.OS === 'ios') return 'interactive';
  return 'on-drag';
}

function scrollContentGrow(keyboardVisible) {
  if (keyboardVisible) return 0;
  return 1;
}

function composerPaddingTop(attachmentCount) {
  if (attachmentCount > 0) return 10;
  return 8;
}

function sendButtonOpacity(canSend) {
  if (canSend) return 1;
  return 0.45;
}

function micIconName(listening) {
  if (listening) return 'mic';
  return 'mic-outline';
}

function micAccessibilityLabel(listening) {
  if (listening) return 'Stop voice input';
  return 'Start voice input';
}

function composerSendColors(isDark) {
  if (isDark) return COMPOSER_SEND_GRAD;
  return COMPOSER_SEND_GRAD_LIGHT;
}

function attachIconColor(isDark) {
  if (isDark) return AI_COACH_UI.composer.iconAttach;
  return AI_COACH_UI.composer.iconAttachLight;
}

function micIconColor(isDark) {
  if (isDark) return AI_COACH_UI.composer.iconMic;
  return AI_COACH_UI.composer.iconMicLight;
}

function emptyDailyMetricsSnapshot() {
  return { exists: () => false, data: () => ({}) };
}

function iosDarkHeaderShadowStyle() {
  return {
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  };
}

function ChatHistoryHeaderButton({ isDark, onPress, compact = false }) {
  const hairlineColor = isDark ? darkColors.nbBorder : lightColors.nbBorder;
  const iconColor = isDark ? lightColors.primary : lightColors.primaryDark;
  const chipBackground = isDark ? darkColors.nbSurfaceChip : lightColors.nbSurfaceChip;
  const labelColor = isDark ? lightColors.white : lightColors.nbInk;
  // Manipulate here: dark full button fill — keep near Design Law purple-black chip, not solid purple border.
  const fullButtonBackground = isDark ? '#1a0a2e' : lightColors.white;
  const useIosDarkShadow = Platform.OS === 'ios' && isDark;
  let iosDarkShadow = null;
  if (useIosDarkShadow) {
    iosDarkShadow = iosDarkHeaderShadowStyle();
  }
  const elevationValue = isDark ? 3 : 2;

  if (compact) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.88}
        accessibilityLabel="Chat history"
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: hairlineColor,
          backgroundColor: chipBackground,
        }}
      >
        <Ionicons name="time-outline" size={18} color={iconColor} />
        <Text style={{ fontSize: 13, fontWeight: '700', color: labelColor }}>History</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityLabel="Chat history"
      accessibilityRole="button"
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingLeft: 10,
          paddingRight: 16,
          paddingVertical: 10,
          minHeight: 46,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: hairlineColor,
          backgroundColor: fullButtonBackground,
          ...iosDarkShadow,
          elevation: elevationValue,
        }}
      >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: chipBackground,
            }}
          >
            <Ionicons name="list-outline" size={20} color={iconColor} />
          </View>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '800',
              letterSpacing: 0.15,
              color: labelColor,
            }}
          >
            Chat History
          </Text>
      </View>
    </TouchableOpacity>
  );
}

function chatStartPayloadFromPrefill(prefillOrPayload) {
  if (typeof prefillOrPayload === 'string') return { prefill: prefillOrPayload };
  if (prefillOrPayload && typeof prefillOrPayload === 'object') return prefillOrPayload;
  return {};
}

function photoOnlyPrefillText(imageCount) {
  if (imageCount > 0) return 'What do you see in this image? Give me coaching feedback.';
  return '';
}

function sessionIdFromSession(session) {
  if (!session) return null;
  if (session.sessionId) return session.sessionId;
  if (session.id) return session.id;
  return null;
}

function displayNameFromUserData(userData) {
  if (!userData) return 'there';
  const rawName = userData.name || userData.displayName || userData.firstName || 'there';
  const trimmedName = String(rawName).trim();
  if (trimmedName) return trimmedName;
  return 'there';
}

function latestSessionFromList(sessions) {
  if (!Array.isArray(sessions)) return null;
  if (sessions.length === 0) return null;
  return sessions[0];
}

function imageAttachmentsFromList(attachments) {
  const images = [];
  for (let index = 0; index < attachments.length; index += 1) {
    const attachment = attachments[index];
    if (!attachment) continue;
    const isImageType = attachment.type === 'image';
    const hasPreview = Boolean(attachment.preview);
    if (isImageType || hasPreview) images.push(attachment);
  }
  return images;
}

function attachmentListHasFilesOnly(attachments, imageAttachments) {
  if (imageAttachments.length > 0) return false;
  for (let index = 0; index < attachments.length; index += 1) {
    const attachment = attachments[index];
    if (attachment && attachment.type === 'file') return true;
  }
  return false;
}

function attachmentsWithoutId(attachments, attachmentId) {
  const kept = [];
  for (let index = 0; index < attachments.length; index += 1) {
    const attachment = attachments[index];
    if (attachment.id === attachmentId) continue;
    kept.push(attachment);
  }
  return kept;
}

function callIfFunction(maybeFn, ...args) {
  if (typeof maybeFn !== 'function') return;
  maybeFn(...args);
}

function playCoachHomeEntranceAnimations(anims) {
  Animated.timing(anims.screenOpacity, { toValue: 1, duration: SCREEN_FADE_MS, useNativeDriver: true }).start();
  Animated.timing(anims.headerOpacity, { toValue: 1, duration: SCREEN_FADE_MS, useNativeDriver: true }).start();

  Animated.sequence([
    Animated.delay(LOTTIE_DELAY_MS),
    Animated.parallel([
      Animated.timing(anims.lottieOpacity, { toValue: 1, duration: LOTTIE_FADE_MS, useNativeDriver: true }),
      Animated.spring(anims.lottieScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 14 }),
    ]),
  ]).start();

  Animated.loop(
    Animated.timing(anims.pillBorderAnim, { toValue: 1, duration: PILL_BORDER_LOOP_MS, useNativeDriver: true })
  ).start();

  Animated.sequence([
    Animated.delay(COMPOSER_DELAY_MS),
    Animated.parallel([
      Animated.timing(anims.inputOpacity, { toValue: 1, duration: COMPOSER_FADE_MS, useNativeDriver: false }),
      Animated.timing(anims.inputTranslateY, { toValue: 0, duration: COMPOSER_FADE_MS, useNativeDriver: false }),
    ]),
  ]).start();
}

// What you see: header, greeting and cards, composer, past-chat drawer, and the bottom tabs.
// CoachHomeScreen below loads logs and passes them in. This function does not load data.
function CoachHomeScreenLayout({
  themeTokens,
  screenOpacity,
  headerOpacity,
  isDark,
  setSidebarOpen,
  onOpenTestSuite,
  insets,
  keyboardVisible,
  listBottomPad,
  idleGroupOpacity,
  idleGroupTranslateY,
  handleStartChat,
  suggestions,
  dailyMetrics,
  nutritionToday,
  userData,
  latestSession,
  onContinueSession,
  onPhotoPress,
  inputOpacity,
  inputTranslateY,
  attachments,
  composerKeyboardPad,
  removeAttachment,
  openAttachMenu,
  inputText,
  setInputText,
  handleSend,
  toggleListen,
  listening,
  canSend,
  sidebarOpen,
  sessions,
  onSessionPress,
  handleDeleteSession,
  deleteSheetSession,
  setDeleteSheetSession,
  confirmDeleteSession,
  onStartChat,
  hideBottomNav,
  onHomePress,
  onPlusPress,
  onVoicePress,
  onNutritionPress,
  onWorkoutPress,
  onMessagesPress,
  onProfilePress,
  onSettingsPress,
  attachSheetOpen,
  setAttachSheetOpen,
  pasteOpen,
  setPasteOpen,
  onPasteConfirm,
  onAttachCamera,
  onAttachLibrary,
  onAttachAnalyze,
  viewerRole = 'client',
  clientCount = 0,
}) {
  // Keep mic-background helper referenced so theme tokens stay wired for composer parity.
  void listeningMicBackground(listening, isDark);

  const headerColors = isDark ? darkColors : lightColors;
  const pageBackgroundColor = themeTokens.bg;
  const askCoachTitle = 'Ask your coach';
  const squareHeaderBtn = {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    borderColor: headerColors.nbBorder,
    backgroundColor: headerColors.nbSurface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: headerColors.nbShadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  };

  return (
    <Animated.View style={{ flex: 1, backgroundColor: pageBackgroundColor, opacity: screenOpacity }}>
      {/* Same shell chrome as Home tab — profile + settings chips above the page title. */}
      <TopHeader
        appearanceIsDark={isDark}
        onProfilePress={onProfilePress}
        onSettingsPress={onSettingsPress}
      />
      <Animated.View
        style={{
          opacity: headerOpacity,
          zIndex: 30,
          // TopHeader already owns the status-bar inset — only pad the title row.
          paddingTop: 8,
          paddingHorizontal: 16,
          paddingBottom: 8,
          backgroundColor: headerColors.nbBackground,
        }}
      >
        {/* Design Law PNG 01 header: “Ask your coach” + hamburger (past chats) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text
            style={{
              flex: 1,
              fontSize: 28,
              fontWeight: '900',
              letterSpacing: -0.6,
              color: headerColors.nbInk,
            }}
            numberOfLines={1}
          >
            {askCoachTitle}
          </Text>
          <TouchableOpacity
            onPress={() => setSidebarOpen(true)}
            style={squareHeaderBtn}
            accessibilityLabel="Past chats"
          >
            <Ionicons name="menu" size={22} color={headerColors.nbInk} />
          </TouchableOpacity>
        </View>
        <CoachTestSuiteButton onOpenTestSuite={onOpenTestSuite} insets={insets} isDark={isDark} />
      </Animated.View>

      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: scrollContentGrow(keyboardVisible),
            paddingBottom: listBottomPad,
            paddingHorizontal: 16,
          }}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={keyboardDismissMode()}
        >
          {/* Idle body (greeting / cards) — hidden while keyboard is up */}
          <IdleCoachHome
            keyboardVisible={keyboardVisible}
            idleGroupOpacity={idleGroupOpacity}
            idleGroupTranslateY={idleGroupTranslateY}
            isDark={isDark}
            handleStartChat={handleStartChat}
            suggestions={suggestions}
            dailyMetrics={dailyMetrics}
            nutritionToday={nutritionToday}
            userData={userData}
            latestSession={latestSession}
            onContinueSession={onContinueSession}
            onPhotoPress={onPhotoPress}
            viewerRole={viewerRole}
            clientCount={clientCount}
          />
        </ScrollView>

        <ComposerBar
          inputOpacity={inputOpacity}
          inputTranslateY={inputTranslateY}
          themeTokens={themeTokens}
          attachments={attachments}
          composerKeyboardPad={composerKeyboardPad}
          removeAttachment={removeAttachment}
          openAttachMenu={openAttachMenu}
          isDark={isDark}
          inputText={inputText}
          setInputText={setInputText}
          handleSend={handleSend}
          toggleListen={toggleListen}
          listening={listening}
          canSend={canSend}
        />
      </View>

      <PastChatsPanel
        mode="overlay"
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sessions={sessions}
        onSessionPress={onSessionPress}
        onDeleteSession={handleDeleteSession}
        onNewChat={() => {
          setSidebarOpen(false);
          callIfFunction(onStartChat, {});
        }}
        isDark={isDark}
        insets={insets}
      />

      <DeleteChatSheet
        visible={!!deleteSheetSession}
        session={deleteSheetSession}
        onClose={() => {
          if (typeof setDeleteSheetSession === 'function') {
            setDeleteSheetSession(null);
          }
        }}
        onConfirm={confirmDeleteSession}
      />

      <CoachAttachSheet
        visible={attachSheetOpen}
        onClose={() => setAttachSheetOpen(false)}
        onCamera={onAttachCamera}
        onLibrary={onAttachLibrary}
        onAnalyze={onAttachAnalyze}
        onPaste={() => setPasteOpen(true)}
      />

      <PasteTextPopup
        visible={pasteOpen}
        onClose={() => setPasteOpen(false)}
        onConfirm={(draft) => {
          setPasteOpen(false);
          callIfFunction(onPasteConfirm, draft);
        }}
      />

      <CoachHomeBottomNav
        hideBottomNav={hideBottomNav}
        keyboardVisible={keyboardVisible}
        onHomePress={onHomePress}
        onPlusPress={onPlusPress}
        onVoicePress={onVoicePress}
        onNutritionPress={onNutritionPress}
        onWorkoutPress={onWorkoutPress}
        onMessagesPress={onMessagesPress}
        onProfilePress={onProfilePress}
      />
    </Animated.View>
  );
}

function CoachTestSuiteButton({ onOpenTestSuite, insets, isDark }) {
  if (!onOpenTestSuite) return null;
  const buttonBackground = isDark ? darkColors.nbSurfaceChip : lightColors.nbSurfaceChip;
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right: 108,
        top: insets.top + 14,
      }}
    >
      <TouchableOpacity
        onPress={onOpenTestSuite}
        activeOpacity={0.7}
        accessibilityLabel="Open AI Coach test suite"
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: buttonBackground,
        }}
      >
        <Ionicons name="flask-outline" size={18} color={isDark ? '#F2F2F2' : '#0A0A0A'} />
      </TouchableOpacity>
    </View>
  );
}

function lottieShadow(isDark) {
  if (isDark) {
    return { shadowOpacity: 0.22, shadowRadius: 18, elevation: 10 };
  }
  return { shadowOpacity: 0, shadowRadius: 0, elevation: 0 };
}

function sectionLabelColor(isDark) {
  if (isDark) return darkColors.nbMuted;
  return lightColors.nbMuted;
}

function IdleCoachHome({
  keyboardVisible,
  idleGroupOpacity,
  idleGroupTranslateY,
  isDark,
  handleStartChat,
  suggestions,
  dailyMetrics,
  nutritionToday,
  userData,
  latestSession,
  onContinueSession,
  onPhotoPress,
  viewerRole = 'client',
  clientCount = 0,
}) {
  // Keyboard up → hide the idle body so the composer owns the screen.
  if (keyboardVisible) return null;

  // Design Law PNG 01 — full home body (sees today / one-tap / photo-web / pickup / try asking).
  return (
    <Animated.View
      style={{
        flexGrow: 1,
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
        opacity: idleGroupOpacity,
        transform: [{ translateY: idleGroupTranslateY }],
      }}
    >
      <CoachHomeBody
        isDark={isDark}
        suggestions={suggestions}
        dailyMetrics={dailyMetrics}
        nutritionToday={nutritionToday}
        userData={userData}
        latestSession={latestSession}
        onStartChat={handleStartChat}
        onContinueSession={onContinueSession}
        onPhotoPress={onPhotoPress}
        viewerRole={viewerRole}
        clientCount={clientCount}
      />
    </Animated.View>
  );
}

function AttachmentPreview({ attachment, themeTokens }) {
  // themeTokens kept for call-site parity; preview chrome reads light/dark from useTheme.
  void themeTokens;
  const { isDark } = useTheme();
  const colors = isDark ? darkColors : lightColors;
  
  // Image attachment → show the preview thumbnail; otherwise a document chip.
  if (attachment.preview) {
    return (
      <Image
        source={{ uri: attachment.preview }}
        style={{
          width: 72,
          height: 72,
          borderRadius: borderRadius.nbCard,
          borderWidth: nb.borderWidth,
          borderColor: colors.nbBorder,
        }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View
      style={{
        width: 72,
        height: 72,
        borderRadius: borderRadius.nbCard,
        backgroundColor: colors.nbSurfaceChip,
        borderWidth: nb.borderWidth,
        borderColor: colors.nbBorder,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name="document-outline" size={22} color={colors.nbMuted} />
    </View>
  );
}

function ComposerAttachments({ attachments, themeTokens, removeAttachment }) {
  const { isDark } = useTheme();
  const colors = isDark ? darkColors : lightColors;
  
  if (attachments.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={{ flexGrow: 0, marginBottom: spacing.sm + 2 }}
      contentContainerStyle={{ gap: spacing.sm + 2, alignItems: 'center' }}
    >
      {attachments.map((attachment) => (
        <View key={attachment.id} style={{ position: 'relative' }}>
          <AttachmentPreview attachment={attachment} themeTokens={themeTokens} />
          <TouchableOpacity
            onPress={() => removeAttachment(attachment.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: colors.error || '#DC2626',
              borderWidth: 2,
              borderColor: colors.nbBorder,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={13} color={lightColors.white} />
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

function composerInputBackground(colors) {
  return colors.nbSurface;
}

function ComposerBar({
  inputOpacity,
  inputTranslateY,
  themeTokens,
  attachments,
  composerKeyboardPad,
  removeAttachment,
  openAttachMenu,
  isDark,
  inputText,
  setInputText,
  handleSend,
  toggleListen,
  listening,
  canSend,
}) {
  const colors = isDark ? darkColors : lightColors;
  const composerPlaceholder = 'Ask your coach anything';
  const showVoiceMic = COACH_VOICE_INPUT_AVAILABLE;
  const micLabel = micAccessibilityLabel(listening);
  const micName = micIconName(listening);
  const sendOpacity = sendButtonOpacity(canSend);
  const topPad = composerPaddingTop(attachments.length);
  // Design Law PNG 01 composer: square + · bordered field · black → send (no gradient “Send”).
  const squareBtn = {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    borderColor: colors.nbBorder,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.nbShadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  };

  return (
    <Animated.View
      style={{
        opacity: inputOpacity,
        transform: [{ translateY: inputTranslateY }],
        borderTopWidth: nb.borderWidth,
        borderTopColor: colors.nbBorder,
        backgroundColor: colors.nbBackground,
        paddingHorizontal: spacing.md,
        paddingTop: topPad,
        paddingBottom: composerKeyboardPad,
      }}
    >
      <ComposerAttachments attachments={attachments} themeTokens={themeTokens} removeAttachment={removeAttachment} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 }}>
        <TouchableOpacity
          onPress={openAttachMenu}
          accessibilityLabel="Attach"
          style={[squareBtn, { backgroundColor: colors.nbSurface }]}
        >
          <Ionicons name="add" size={26} color={colors.nbInk} />
        </TouchableOpacity>
        <View
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 48,
            borderWidth: nb.borderWidth,
            borderColor: colors.nbBorder,
            borderRadius: borderRadius.nbInput || 12,
            backgroundColor: colors.nbSurface,
            justifyContent: 'center',
            shadowColor: colors.nbShadow,
            shadowOffset: { width: 3, height: 3 },
            shadowOpacity: 1,
            shadowRadius: 0,
            elevation: 3,
          }}
        >
          <TextInput
            {...COACH_COMPOSER_TEXT_INPUT_PROPS}
            style={{
              minHeight: 48,
              maxHeight: 100,
              fontSize: 15,
              fontFamily: 'Inter_400Regular',
              color: colors.nbInk,
              paddingVertical: 12,
              paddingHorizontal: 14,
            }}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
            placeholder={composerPlaceholder}
            placeholderTextColor={colors.nbMuted}
            returnKeyType="send"
            blurOnSubmit={false}
            accessibilityLabel="Message input"
          />
        </View>
        {showVoiceMic ? (
          <TouchableOpacity
            onPress={toggleListen}
            accessibilityLabel={micLabel}
            style={[squareBtn, { backgroundColor: colors.nbSurface }]}
          >
            <Ionicons name={micName} size={22} color={colors.nbInk} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={handleSend}
          disabled={!canSend}
          activeOpacity={0.85}
          style={[
            squareBtn,
            {
              backgroundColor: colors.nbFill,
              opacity: sendOpacity,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          <Ionicons name="arrow-forward" size={22} color={colors.nbOnFill} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

function CoachHomeBottomNav({
  hideBottomNav,
  keyboardVisible,
  onHomePress,
  onPlusPress,
  onVoicePress,
  onNutritionPress,
  onWorkoutPress,
  onMessagesPress,
  onProfilePress,
}) {
  if (hideBottomNav || keyboardVisible) return null;
  return (
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
  );
}


// ===== PLUMBING — legacy home rows (unused; kept for reference) =====
// CanHelpWithCarousel, HeroWelcomeCard, CoachActionOrb, TryAskingList.
// Idle layout uses CoachHomeBody instead — keep these for Design Law experiments.

function orbAccessibilityLabel(action) {
  if (action.sublabel) return `${action.label}, ${action.sublabel}`;
  return action.label;
}

function orbHardShadowStyle(colors) {
  if (Platform.OS !== 'ios') return {};
  return {
    shadowColor: colors.nbShadow,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 4, height: 4 },
  };
}

const CoachActionOrb = ({ action, isDark, onPress }) => {
  const { isDark: themeIsDark } = useTheme();
  const colors = themeIsDark ? darkColors : lightColors;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const accessibilityLabel = orbAccessibilityLabel(action);
  const hardShadowStyle = orbHardShadowStyle(colors);

  const pressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.92, useNativeDriver: true, speed: 48, bounciness: 0 }).start();
  };
  const pressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 48, bounciness: 6 }).start();
  };

  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress(action);
      }}
      onPressIn={pressIn}
      onPressOut={pressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{ alignItems: 'center', flex: 1 }}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }], alignItems: 'center' }}>
        {/* Neobrutalist orb: thick border, hard shadow, no gradient rim */}
        <View
          style={{
            width: 70,
            height: 70,
            borderRadius: 35,
            backgroundColor: colors.nbSurface,
            borderWidth: 2.5,
            borderColor: colors.nbBorder,
            alignItems: 'center',
            justifyContent: 'center',
            ...hardShadowStyle,
          }}
        >
          <Ionicons name={action.icon} size={24} color={colors.nbInk} />
        </View>
        <Text
          style={{
            marginTop: 8,
            fontSize: 12,
            fontFamily: 'SpaceGrotesk_700Bold',
            letterSpacing: 0.2,
            color: colors.nbInk,
          }}
        >
          {action.label}
        </Text>
        {action.sublabel ? (
          <Text
            style={{
              marginTop: 2,
              fontSize: 9,
              fontFamily: 'Inter_600Semi',
              fontWeight: '600',
              letterSpacing: 0.3,
              textTransform: 'uppercase',
              color: colors.nbMuted,
            }}
            numberOfLines={1}
          >
            {action.sublabel}
          </Text>
        ) : null}
      </Animated.View>
    </Pressable>
  );
};

const CAN_HELP_CARD_WIDTH = screenWidth - 32;

function nonEmptyCarouselItems(items) {
  const source = items || [];
  const list = [];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index]) list.push(source[index]);
  }
  return list;
}

function firstViewableItemIndex(viewableItems) {
  if (!viewableItems || viewableItems.length === 0) return null;
  const firstItem = viewableItems[0];
  if (!firstItem) return null;
  if (firstItem.index == null) return null;
  return firstItem.index;
}

const CanHelpWithCarousel = ({ items, isDark, themeTokens, onPress }) => {
  const list = nonEmptyCarouselItems(items);
  const [index, setIndex] = useState(0);

  if (!list.length) return null;

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    const nextIndex = firstViewableItemIndex(viewableItems);
    if (nextIndex != null) setIndex(nextIndex);
  }).current;

  return (
    <View style={{ width: '100%', marginTop: 4 }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: '800',
          letterSpacing: 1.1,
          textTransform: 'uppercase',
          color: isDark ? darkColors.nbMuted : lightColors.nbMuted,
          marginBottom: 10,
        }}
      >
        Can help with
      </Text>
      <FlatList
        data={list}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        snapToInterval={CAN_HELP_CARD_WIDTH}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              onPress(item.prompt || item.title);
            }}
            style={{ width: CAN_HELP_CARD_WIDTH }}
          >
            <NbCard>
              <View
                style={{
                  paddingVertical: 16,
                  paddingHorizontal: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  minHeight: 88,
                }}
              >
                {/* Icon circle with simple border, no gradient rim */}
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    borderWidth: 2,
                    borderColor: isDark ? darkColors.nbBorder : lightColors.nbBorder,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isDark ? darkColors.nbSurfaceChip : lightColors.nbSurfaceChip,
                  }}
                >
                  <Ionicons name={item.icon} size={22} color={isDark ? darkColors.nbInk : lightColors.nbInk} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontFamily: 'SpaceGrotesk_700Bold',
                      color: themeTokens.textPrimary,
                      marginBottom: 4,
                    }}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: 'Inter_400Regular',
                      color: themeTokens.textMuted,
                    }}
                    numberOfLines={2}
                  >
                    {item.subtitle}
                  </Text>
                </View>
              </View>
            </NbCard>
          </Pressable>
        )}
      />
      {list.length > 1 ? (
        <View style={{ flexDirection: 'row', gap: 5, marginTop: 12, paddingLeft: 2 }}>
          {list.map((_, dotIndex) => (
            <View
              key={`can-dot-${dotIndex}`}
              style={{
                width: pagerDotWidth(dotIndex === index),
                height: 5,
                borderRadius: 999,
                backgroundColor: pagerDotColor(dotIndex === index, isDark, AI_COACH_UI.pink),
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
};

// Design Law try-asking icon accents only (small chips). Cards stay surface + fill.
// Manipulate here: rotate accentGradients indices for variety without green.
const TRY_ASKING_CHROME = [
  {
    icon: ['#FF6B9D', '#FB923C'],
    subtitle: 'Built from your goals',
  },
  {
    icon: ['#60A5FA', '#818CF8'],
    subtitle: 'Calories and macros',
  },
  {
    icon: ['#A78BFA', '#E879F9'],
    subtitle: "This week's trends",
  },
];

// Short display title for a long prompt (mock opts use title + subtitle, not the full sentence).
function shortTitleFromPrompt(text) {
  const raw = String(text || '').trim();
  if (!raw) return 'Ask your coach';
  const firstChunk = raw.split(/[?.!]/)[0].trim() || raw;
  if (firstChunk.length <= 36) return firstChunk;
  return `${firstChunk.slice(0, 34)}…`;
}

/**
 * Design Law “Or try asking” — surface cards, 3px border, hard shadow, accent icon chip.
 */
function firstThreeSuggestionTexts(suggestions) {
  const source = suggestions || [];
  const items = [];
  for (let index = 0; index < source.length; index += 1) {
    if (!source[index]) continue;
    items.push(source[index]);
    if (items.length >= 3) break;
  }
  return items;
}

const TryAskingList = ({ suggestions, isDark, themeTokens, onPress }) => {
  const items = firstThreeSuggestionTexts(suggestions);
  if (!items.length) return null;
  const ink = isDark ? darkColors.nbInk : lightColors.nbInk;
  const surface = isDark ? darkColors.nbSurface : lightColors.nbSurface;
  const border = isDark ? darkColors.nbBorder : lightColors.nbBorder;
  const shadow = isDark ? darkColors.nbShadow : lightColors.nbShadow;

  return (
    <View style={{ width: '100%', marginTop: spacing.lg }}>
      <Text
        style={{
          fontSize: 12,
          fontFamily: 'SpaceGrotesk_700Bold',
          letterSpacing: 1.1,
          textTransform: 'uppercase',
          color: themeTokens.textMuted,
          marginBottom: spacing.sm + 2,
        }}
      >
        Or try asking
      </Text>
      <View style={{ gap: spacing.sm + 2 }}>
        {items.map((promptText, rowIndex) => {
          const chrome = TRY_ASKING_CHROME[rowIndex % TRY_ASKING_CHROME.length];
          const iconName = iconForPrompt(promptText);
          const rowTitle = shortTitleFromPrompt(promptText);
          const accessibilityLabel = `Start chat: ${promptText}`;
          return (
            <Pressable
              key={`ask-${rowIndex}`}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                onPress(promptText);
              }}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel}
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.92 : 1,
                  transform: [{ translateX: pressed ? 2 : 0 }, { translateY: pressed ? 2 : 0 }],
                  backgroundColor: surface,
                  borderWidth: nb.borderWidth,
                  borderColor: border,
                  borderRadius: borderRadius.nbCard,
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm + 4,
                  minHeight: 72,
                  shadowColor: shadow,
                  shadowOffset: { width: nb.shadowOffsetCard, height: nb.shadowOffsetCard },
                  shadowOpacity: 1,
                  shadowRadius: 0,
                  elevation: 4,
                },
              ]}
            >
              <LinearGradient
                colors={chrome.icon}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  borderWidth: nb.borderWidth,
                  borderColor: border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={iconName} size={20} color={lightColors.nbInk} />
              </LinearGradient>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontFamily: 'SpaceGrotesk_700Bold',
                    color: ink,
                    letterSpacing: -0.2,
                  }}
                  numberOfLines={2}
                >
                  {rowTitle}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: 'Inter_400Regular',
                    color: themeTokens.textMuted,
                    marginTop: 3,
                  }}
                  numberOfLines={1}
                >
                  {chrome.subtitle}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={themeTokens.textMuted} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

/**
 * Design Law hero — black/white fill block (not pink gradient). PNG: “What should we work on?”
 */
function heroFillColor(colors) {
  if (colors && colors.nbFill) return colors.nbFill;
  return lightColors.nbFill;
}

function heroOnFillColor(colors) {
  if (colors && colors.nbOnFill) return colors.nbOnFill;
  return lightColors.nbOnFill;
}

function heroBorderColor(colors) {
  if (colors && colors.nbBorder) return colors.nbBorder;
  return lightColors.nbBorder;
}

function heroShadowColor(colors) {
  if (colors && colors.nbShadow) return colors.nbShadow;
  return lightColors.nbShadow;
}

const HeroWelcomeCard = ({ userName, onStartChat, colors }) => {
  void userName;
  const fillColor = heroFillColor(colors);
  const onFillColor = heroOnFillColor(colors);
  const borderColor = heroBorderColor(colors);
  const shadowColor = heroShadowColor(colors);
  const mutedOnFill = onFillColor;

  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        callIfFunction(onStartChat, {});
      }}
      accessibilityRole="button"
      accessibilityLabel="Start chatting with your coach"
      style={({ pressed }) => [
        {
          width: '100%',
          opacity: pressed ? 0.94 : 1,
          transform: [{ translateX: pressed ? 2 : 0 }, { translateY: pressed ? 2 : 0 }],
        },
      ]}
    >
      <View
        style={{
          backgroundColor: fillColor,
          borderWidth: nb.borderWidth,
          borderColor: borderColor,
          borderRadius: borderRadius.nbHero,
          paddingHorizontal: spacing.md + 2,
          paddingTop: spacing.md + 4,
          paddingBottom: spacing.md + 4,
          minHeight: 148,
          flexDirection: 'row',
          alignItems: 'center',
          shadowColor: shadowColor,
          shadowOffset: { width: nb.shadowOffsetHero, height: nb.shadowOffsetHero },
          shadowOpacity: 1,
          shadowRadius: 0,
          elevation: 5,
        }}
      >
        <View style={{ flex: 1, paddingRight: spacing.sm }}>
          <Text
            style={{
              fontSize: 11,
              fontFamily: 'SpaceGrotesk_700Bold',
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              color: mutedOnFill,
              opacity: 0.7,
            }}
          >
            Fitness only
          </Text>
          <Text
            style={{
              marginTop: 6,
              fontSize: 26,
              fontFamily: 'SpaceGrotesk_700Bold',
              color: onFillColor,
              letterSpacing: -0.5,
            }}
          >
            What should we work on?
          </Text>
          <Text
            style={{
              marginTop: 6,
              fontSize: 13,
              fontFamily: 'Inter_500Medium',
              color: onFillColor,
              opacity: 0.82,
              lineHeight: 18,
            }}
          >
            I can see your logs, your plan and your goals.
          </Text>
        </View>
        <LinearGradient
          colors={['#FF6B9D', '#FB923C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            borderWidth: nb.borderWidth,
            borderColor: borderColor,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <LottieView
            source={require('../../assets/animations/handoff/zcoach.json')}
            autoPlay
            loop
            style={{ width: 64, height: 64 }}
          />
        </LinearGradient>
      </View>
    </Pressable>
  );
};

// ===== MAIN FUNCTION =====

export default function CoachHomeScreen({
  userId,
  onStartChat,
  onSessionPress,
  onHomePress,
  onPlusPress,
  onVoicePress,
  onNutritionPress,
  onWorkoutPress,
  onMessagesPress,
  onProfilePress,
  onSettingsPress,
  onOpenTestSuite,
  hideBottomNav = false,
  // vocab: viewerRole = 'trainer' shows Who-needs-you + Do-it-for-me (missing-screens 17/18)
  viewerRole = 'client',
  clientCount = 0,
}) {
  // 1. Shell state — sidebar, composer draft, attachments, hourly suggestion slot.
  // vocab: useSafeAreaInsets = notches / home-indicator padding from react-native-safe-area-context
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const sessions = chatHistoryList(userId);
  const [userData, setUserData] = useState(null);
  const [dailyMetrics, setDailyMetrics] = useState(null);
  const [nutritionToday, setNutritionToday] = useState(null);
  const [hourSlot, setHourSlot] = useState(getCoachHourSlot());

  const promptNow = hourSlot * MS_PER_HOUR;
  const canHelpItems = buildHourlyCanHelpWith({ userData, sessions, now: promptNow });
  const coachActions = buildHourlyCoachActions(COACH_ACTIONS, { userData, sessions, now: promptNow });
  const suggestions = buildHourlySpotlightSuggestions({
    userData,
    sessions,
    dailyMetrics,
    nutritionToday,
    now: promptNow,
  });

  const themeTokens = isDark ? darkCoachHomeTheme : lightCoachHomeTheme;
  const userName = displayNameFromUserData(userData);
  const { keyboardVisible, composerKeyboardPad, listBottomPad } =
    keyboardBehavior({ hideBottomNav });
  const screenOpacity = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const lottieOpacity = useRef(new Animated.Value(0)).current;
  const lottieScale = useRef(new Animated.Value(0.9)).current;
  const inputOpacity = useRef(new Animated.Value(0)).current;
  const inputTranslateY = useRef(new Animated.Value(10)).current;
  const idleGroupOpacity = useRef(new Animated.Value(1)).current;
  const idleGroupTranslateY = useRef(new Animated.Value(0)).current;
  const pillBorderAnim = useRef(new Animated.Value(0)).current;
  const inputBorderAnim = useRef(new Animated.Value(0)).current;

  const { listening, toggleListen } = useCoachSpeech({
    onPartialTranscript: (text) => setInputText(text),
    onFinalTranscript: (text) => setInputText(text),
  });

  useEffect(() => {
    playCoachHomeEntranceAnimations({
      screenOpacity,
      headerOpacity,
      lottieOpacity,
      lottieScale,
      pillBorderAnim,
      inputOpacity,
      inputTranslateY,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [deleteSheetSession, setDeleteSheetSession] = useState(null);
  const [attachSheetOpen, setAttachSheetOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  // vocab: notice = NbNoticeSheet payload — Design Law sheet instead of Alert.alert
  const [notice, setNotice] = useState(null);
  // Design Law: route attach/copy errors through NbNoticeSheet instead of Alert.alert
  const showNotice = (title, message) => setNotice({ title, message });

  const latestSession = latestSessionFromList(sessions);

  // Open the delete sheet when we have a real session id (does not delete yet).
  const handleDeleteSession = (session) => {
    const sessionId = sessionIdFromSession(session);
    if (!db || !userId || !sessionId) return;
    setDeleteSheetSession(session);
  };

  // Confirm path — Firestore delete via saveAndLoadChats helper.
  const confirmDeleteSession = async (session) => {
    const sessionId = sessionIdFromSession(session);
    if (!db || !userId || !sessionId) return;
    try {
      await deleteAiChatSession(userId, sessionId);
    } catch (deleteError) {
      console.error('Failed to delete ai chat:', deleteError);
    }
  };

  useEffect(() => {
    if (!db || !userId) {
      setUserData(null);
      return undefined;
    }
    // vocab: onSnapshot = live Firestore listener; cleanup unsub() when userId changes / unmount
    const unsub = onSnapshot(
      doc(db, USERS_COLLECTION, userId),
      (snap) => setUserData(snap.exists() ? snap.data() : null),
      () => setUserData(null)
    );
    return () => unsub();
  }, [userId]);

  useEffect(() => {
    if (!db || !userId) {
      setDailyMetrics(null);
      return undefined;
    }
    const todayKey = getClientDateKey();
    let trackingSnap = emptyDailyMetricsSnapshot();
    let logsSnap = emptyDailyMetricsSnapshot();

    const apply = () => {
      setDailyMetrics(parseDailyMetricsFromSnapshots(logsSnap, trackingSnap));
    };

    const unsubTrack = onSnapshot(
      doc(db, USERS_COLLECTION, userId, DAILY_TRACKING_COLLECTION, todayKey),
      (snap) => {
        trackingSnap = snap;
        apply();
      },
      () => {
        trackingSnap = emptyDailyMetricsSnapshot();
        apply();
      },
    );

    const unsubLogs = onSnapshot(
      doc(db, USERS_COLLECTION, userId, DAILY_LOGS_COLLECTION, todayKey),
      (snap) => {
        logsSnap = snap;
        apply();
      },
      () => {
        logsSnap = emptyDailyMetricsSnapshot();
        apply();
      },
    );

    return () => {
      unsubTrack();
      unsubLogs();
    };
  }, [userId, hourSlot]);

  useEffect(() => {
    if (!userId) {
      setNutritionToday(null);
      return undefined;
    }
    let cancelled = false;
    const todayKey = getClientDateKey();
    (async () => {
      try {
        const logs = await getFoodLogsForDate(userId, todayKey);
        const totals = calculateMacroTotals(logs);
        if (!cancelled) {
          setNutritionToday({
            calories: totals.calories,
            protein: totals.protein,
            carbs: totals.carbs,
            fat: totals.fat,
          });
        }
      } catch (_) {
        if (!cancelled) setNutritionToday(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, hourSlot]);

  useEffect(() => {
    const tick = setInterval(() => {
      const next = getCoachHourSlot();
      setHourSlot((previousSlot) => (previousSlot !== next ? next : previousSlot));
    }, HOUR_TICK_MS);
    return () => clearInterval(tick);
  }, []);

  // 2. Open conversation — fade idle home first so transition matches Design Law.
  const handleStartChat = (prefillOrPayload) => {
    const payload = chatStartPayloadFromPrefill(prefillOrPayload);
    Animated.parallel([
      Animated.timing(idleGroupOpacity, { toValue: 0, duration: CHAT_EXIT_MS, useNativeDriver: true }),
      Animated.timing(idleGroupTranslateY, { toValue: -6, duration: CHAT_EXIT_MS, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (!finished) return;
      callIfFunction(onStartChat, payload);
    });
  };

  // Append picked camera/library/file rows onto the composer attachment strip.
  const openChatWithAttachments = async (pickAttachmentsFn) => {
    const pickedAttachments = await pickAttachmentsFn();
    if (pickedAttachments.length > 0) {
      setAttachments((previousAttachments) => [...previousAttachments, ...pickedAttachments]);
    }
  };

  const handlePhotoLibrary = () =>
    openChatWithAttachments(() => pickCoachPhotosFromLibrary({ presentNotice: showNotice }));
  const handleCamera = () =>
    openChatWithAttachments(() => pickCoachPhotoFromCamera({ presentNotice: showNotice }));
  const handleFile = () => openChatWithAttachments(pickCoachDocuments);

  const handleActionPress = (action) => {
    if (action.id === 'photo') {
      handleCamera();
      return;
    }
    handleStartChat(action.starter);
  };

  // Design Law: home + opens NbSheet attach (same 4 rows as conversation), not system ActionSheet.
  const openAttachMenu = () => setAttachSheetOpen(true);

  const handleAnalyze = () => {
    handleStartChat({
      prefill: 'Can you analyze a progress photo for physique feedback?',
    });
  };

  const handlePasteConfirm = (draft) => {
    const pastedText = String(draft || '').trim();
    if (!pastedText) return;
    setInputText((draftBeforePaste) => {
      if (draftBeforePaste) return `${draftBeforePaste}\n${pastedText}`;
      return pastedText;
    });
  };

  const removeAttachment = (attachmentId) => {
    setAttachments((previousAttachments) => attachmentsWithoutId(previousAttachments, attachmentId));
  };

  const canSend = inputText.trim().length > 0 || attachments.length > 0;

  // 3. Send — block file-only attachments; photos ride with optional text.
  const handleSend = () => {
    const trimmedText = inputText.trim();
    const imageAttachments = imageAttachmentsFromList(attachments);
    const hasFilesOnly = attachmentListHasFilesOnly(attachments, imageAttachments);
    if (!trimmedText && attachments.length === 0) return;
    if (hasFilesOnly) {
      setNotice({
        title: 'Photos work best',
        message:
          'The coach can analyze progress photos right now. Attach a photo instead of a document.',
      });
      return;
    }
    const prefillText = trimmedText || photoOnlyPrefillText(imageAttachments.length);
    handleStartChat({
      prefill: prefillText,
      initialAttachments: attachments,
    });
    setInputText('');
    setAttachments([]);
  };

  void inputBorderAnim;

  return (
    <>
      <CoachHomeScreenLayout
        themeTokens={themeTokens}
        screenOpacity={screenOpacity}
        headerOpacity={headerOpacity}
        isDark={isDark}
        setSidebarOpen={setSidebarOpen}
        onOpenTestSuite={onOpenTestSuite}
        insets={insets}
        keyboardVisible={keyboardVisible}
        listBottomPad={listBottomPad}
        idleGroupOpacity={idleGroupOpacity}
        idleGroupTranslateY={idleGroupTranslateY}
        handleStartChat={handleStartChat}
        suggestions={suggestions}
        dailyMetrics={dailyMetrics}
        nutritionToday={nutritionToday}
        userData={userData}
        latestSession={latestSession}
        onContinueSession={(session) => {
          callIfFunction(onSessionPress, session);
        }}
        onPhotoPress={() => {
          setAttachSheetOpen(true);
        }}
        inputOpacity={inputOpacity}
        inputTranslateY={inputTranslateY}
        attachments={attachments}
        composerKeyboardPad={composerKeyboardPad}
        removeAttachment={removeAttachment}
        openAttachMenu={openAttachMenu}
        inputText={inputText}
        setInputText={setInputText}
        handleSend={handleSend}
        toggleListen={toggleListen}
        listening={listening}
        canSend={canSend}
        sidebarOpen={sidebarOpen}
        sessions={sessions}
        onSessionPress={onSessionPress}
        handleDeleteSession={handleDeleteSession}
        deleteSheetSession={deleteSheetSession}
        setDeleteSheetSession={setDeleteSheetSession}
        confirmDeleteSession={confirmDeleteSession}
        onStartChat={onStartChat}
        hideBottomNav={hideBottomNav}
        onHomePress={onHomePress}
        onPlusPress={onPlusPress}
        onVoicePress={onVoicePress}
        onNutritionPress={onNutritionPress}
        onWorkoutPress={onWorkoutPress}
        onMessagesPress={onMessagesPress}
        onProfilePress={onProfilePress}
        onSettingsPress={onSettingsPress}
        viewerRole={viewerRole}
        clientCount={clientCount}
        attachSheetOpen={attachSheetOpen}
        setAttachSheetOpen={setAttachSheetOpen}
        pasteOpen={pasteOpen}
        setPasteOpen={setPasteOpen}
        onPasteConfirm={handlePasteConfirm}
        onAttachCamera={handleCamera}
        onAttachLibrary={handlePhotoLibrary}
        onAttachAnalyze={handleAnalyze}
      />
      <NbNoticeSheet
        visible={!!notice}
        onClose={() => setNotice(null)}
        title={notice && notice.title ? notice.title : ''}
        message={notice ? notice.message : undefined}
        confirmLabel="OK"
      />
    </>
  );
}
