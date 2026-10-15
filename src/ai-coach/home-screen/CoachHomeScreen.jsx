// Coach home: greeting, hourly prompts, and the box that starts a chat.
// Flow: load today's logs → build this hour's prompts → show cards → open a chat with text or a photo.
// Used as the AI Coach tab. Past chats open from the header.

import React, { useState, useEffect, useRef } from 'react';
import {
  Alert,
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
import { showCoachAttachMenu } from '../conversation/openPhotoMenu';
import {
  pickCoachDocuments,
  pickCoachPhotoFromCamera,
  pickCoachPhotosFromLibrary,
} from '../conversation/choosePhoto';
import { doc, onSnapshot } from 'firebase/firestore';
import { deleteAiChatSession } from '../past-chats/saveAndLoadChats';
import PastChatsPanel from '../past-chats/PastChatsPanel';
import { chatHistoryList } from '../past-chats/chatHistoryList';
import { db } from '../../app-start/cloudConnection';
import BottomMenuBar from '../../navigation/BottomMenuBar';
import { ShellBottomNavAnchor } from '../../navigation/bottomMenuSpacing';
import TopHeader from '../../for-both/loading-and-header/TopHeader';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { useCoachSpeech } from '../conversation/_voiceStub';
import { keyboardBehavior, COACH_COMPOSER_TEXT_INPUT_PROPS } from '../conversation/keyboardBehavior';
import { AI_COACH_UI } from '../coachColors';
import ColorText from '../../look-and-feel/ColorText';
import { HERO_TITLE_TEXT_GRADIENT } from '../../look-and-feel/brandColors';
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

const { width: SW, height: SH } = Dimensions.get('window');

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
const CARD_BORDER = AI_COACH_UI.gradient.borderWarm;
const BORDER_SUBTLE = ['rgba(157,23,77,0.42)', 'rgba(154,52,18,0.36)'];
const CTA_GRADIENT = AI_COACH_UI.gradient.ctaWarm;
const COMPOSER_SEND_GRAD = AI_COACH_UI.gradient.composerSend;
const COMPOSER_SEND_GRAD_LIGHT = AI_COACH_UI.gradient.composerSendLight;
const HERO_INNER = AI_COACH_UI.heroInner;

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
  if (promptText.includes('nutrition') || promptText.includes('habit')) return 'restaurant-outline';
  if (promptText.includes('full-body') || promptText.includes('upper/lower') || promptText.includes('schedule')) return 'body-outline';
  if (promptText.includes('workout') || promptText.includes('hypertrophy') || promptText.includes('split') || promptText.includes('squat')) return 'barbell-outline';
  if (promptText.includes('protein') || promptText.includes('eat') || promptText.includes('macro') || promptText.includes('meal') || promptText.includes('vegan') || promptText.includes('keto')) return 'nutrition-outline';
  if (promptText.includes('supplement') || promptText.includes('creatine')) return 'flask-outline';
  if (promptText.includes('recover')) return 'bed-outline';
  if (promptText.includes('research') || promptText.includes('skinny fat') || promptText.includes('recomp') || promptText.includes('body')) return 'body-outline';
  if (promptText.includes('progressive') || promptText.includes('overload')) return 'trending-up-outline';
  if (promptText.includes('skipped') || promptText.includes('back')) return 'refresh-outline';
  if (promptText.includes('calorie') || promptText.includes('fat-loss') || promptText.includes('deficit')) return 'flame-outline';
  if (promptText.includes('conditioning') || promptText.includes('athletic')) return 'flash-outline';
  if (promptText.includes('drink') || promptText.includes('zero-sugar')) return 'water-outline';
  return 'sparkles-outline';
}

function rimForPrompt(text) {
  const promptText = String(text || '').toLowerCase();
  if (promptText.includes('nutrition') || promptText.includes('habit') || promptText.includes('protein') || promptText.includes('meal') || promptText.includes('macro') || promptText.includes('eat') || promptText.includes('cal')) {
    return HOME_STAT_SORENESS_GRADIENT;
  }
  if (promptText.includes('workout') || promptText.includes('split') || promptText.includes('training') || promptText.includes('full-body') || promptText.includes('schedule')) {
    return HOME_STAT_WORKOUT_GRADIENT;
  }
  if (promptText.includes('recover') || promptText.includes('sleep') || promptText.includes('rest')) {
    return HOME_STAT_SLEEP_GRADIENT;
  }
  if (promptText.includes('search') || promptText.includes('web') || promptText.includes('research')) {
    return HOME_STAT_WATER_GRADIENT;
  }
  return HOME_STAT_SORENESS_GRADIENT;
}

// ─── Theme tokens ─────────────────────────────────────────────────────────────
const DARK = {
  bg: '#000000',
  secondaryBg: '#0A0A0F',
  glassBg: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.1)',
  textPrimary: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textMuted: 'rgba(255,255,255,0.45)',
  sidebarBg: '#0C0C14',
  sidebarBorder: AI_COACH_UI.borderHairline,
  divider: 'rgba(255,255,255,0.05)',
  headerBg: '#000000',
  inputBarBg: 'rgba(0,0,0,0.92)',
  accent: AI_COACH_UI.cyan,
  chipBg: AI_COACH_UI.glass,
  chipBorder: AI_COACH_UI.borderHairline,
};

const LIGHT = {
  bg: '#FFFFFF',
  secondaryBg: '#F9F9FB',
  glassBg: 'rgba(0,0,0,0.04)',
  border: 'rgba(0,0,0,0.1)',
  textPrimary: '#0A0A0F',
  textSecondary: '#666666',
  textMuted: 'rgba(0,0,0,0.4)',
  sidebarBg: '#FFFFFF',
  sidebarBorder: 'rgba(0,0,0,0.1)',
  divider: 'rgba(0,0,0,0.06)',
  headerBg: '#FFFFFF',
  inputBarBg: 'rgba(255,255,255,0.94)',
  accent: AI_COACH_UI.cyan,
  chipBg: 'rgba(0,0,0,0.04)',
  chipBorder: 'rgba(0,0,0,0.08)',
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

function uniquePrompts(prompts, limit) {
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
  if (goal.includes('lose') || goal.includes('fat')) {
    return [
      'Based on my current stats, design a fat‑loss week that keeps my lifts moving up.',
      'How aggressive should my calorie deficit be so I lose fat without killing performance?',
    ];
  }
  if (goal.includes('muscle') || goal.includes('build')) {
    return [
      'Lay out a progression plan so I’m adding muscle over the next 4–6 weeks.',
      'Given my goal, what should my training split and progression look like this week?',
    ];
  }
  if (goal.includes('athletic') || goal.includes('performance')) {
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

function promptsWithFallbacks(contextual) {
  const pool = [...contextual];
  for (const fallback of FALLBACK_SUGGESTIONS) {
    const alreadyListed = pool.some(
      (prompt) => String(prompt).toLowerCase() === String(fallback).toLowerCase(),
    );
    if (alreadyListed) continue;
    pool.push(fallback);
  }
  return uniquePrompts(pool, SUGGESTION_LIMIT);
}

function normalizeTextSignal(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\u2019']/g, "'")
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addTopicScore(score, topic, weight) {
  score.set(topic, (score.get(topic) || 0) + weight);
}

function inferTopTopicsFromSessions(sessions = []) {
  const score = new Map();

  for (const session of (sessions || []).slice(0, TOPIC_SESSION_LOOKBACK)) {
    const hay = normalizeTextSignal(
      [session?.title, session?.lastUserMessage, session?.lastAssistantMessage].filter(Boolean).join(' | ')
    );
    if (!hay) continue;

    if (/\bmacro|macros|calorie|deficit|bulk|cut|protein|carb|fat|meal|diet|nutrition\b/.test(hay)) addTopicScore(score, 'nutrition', 3);
    if (/\bworkout|split|hypertrophy|lift|squat|bench|deadlift|volume|program|deload|set|rep\b/.test(hay)) addTopicScore(score, 'training', 3);
    if (/\bsleep|recover|recovery|rest|soreness|stress|fatigue\b/.test(hay)) addTopicScore(score, 'recovery', 2);
    if (/\bplan|schedule|week|routine|habit|time\b/.test(hay)) addTopicScore(score, 'planning', 2);
    if (/\binjury|pain|knee|back|shoulder\b/.test(hay)) addTopicScore(score, 'injury', 2);
    if (/\bsupplement|creatine|caffeine\b/.test(hay)) addTopicScore(score, 'supplements', 1);
  }

  return [...score.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([topic]) => topic)
    .slice(0, TOP_TOPIC_LIMIT);
}

function buildDynamicSuggestions({ userData, sessions }) {
  const goal = String(userData?.primaryGoal || userData?.goal || userData?.fitnessGoal || '').toLowerCase();
  const dietPref = String(userData?.dietPreference || userData?.diet || '').toLowerCase();
  const topTopics = inferTopTopicsFromSessions(sessions);
  const recentTitles = (sessions || [])
    .slice(0, TITLE_SESSION_LOOKBACK)
    .map((session) => String(session?.title || '').trim())
    .filter(Boolean);
  const titleText = normalizeTextSignal(recentTitles.join(' | '));
  const contextual = [
    ...promptsForGoal(goal),
    ...promptsForDiet(dietPref),
    ...promptsForRecentTitles(titleText),
    ...promptsForTopics(topTopics),
  ];

  if (contextual.length === 0) {
    return FALLBACK_SUGGESTIONS.slice(0, SUGGESTION_LIMIT);
  }
  return promptsWithFallbacks(contextual);
}

function pagerDotColor(isActive, isDark, activeColor) {
  if (isActive) return activeColor;
  if (isDark) return 'rgba(255,255,255,0.18)';
  return 'rgba(0,0,0,0.12)';
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

function emptyMetricsSnap() {
  return { exists: () => false, data: () => ({}) };
}

function ChatHistoryHeaderButton({ isDark, onPress, compact = false }) {
  const hairline = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(10,10,15,0.10)';
  const iconColor = isDark ? '#FF6B9D' : '#BE185D';

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
          borderColor: hairline,
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        }}
      >
        <Ionicons name="time-outline" size={18} color={iconColor} />
        <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0A0A0F' }}>History</Text>
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
          borderColor: hairline,
          backgroundColor: isDark ? '#1a0a2e' : '#FFFFFF',
          ...(Platform.OS === 'ios' && isDark
            ? { shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }
            : null),
          elevation: isDark ? 3 : 2,
        }}
      >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDark ? 'rgba(255,107,157,0.20)' : 'rgba(190,24,93,0.12)',
            }}
          >
            <Ionicons name="list-outline" size={20} color={isDark ? '#FF6B9D' : '#BE185D'} />
          </View>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '800',
              letterSpacing: 0.15,
              color: isDark ? '#FFFFFF' : '#0A0A0F',
            }}
          >
            Chat History
          </Text>
      </View>
    </TouchableOpacity>
  );
}

const CoachActionOrb = ({ action, isDark, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rim = action.rim || BORDER_SUBTLE;

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
      accessibilityLabel={action.sublabel ? `${action.label}, ${action.sublabel}` : action.label}
      style={{ alignItems: 'center', flex: 1 }}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }], alignItems: 'center' }}>
        <LinearGradient
          colors={rim}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 70,
            height: 70,
            borderRadius: 35,
            padding: 2,
            ...(Platform.OS === 'ios' && isDark
              ? { shadowColor: rim[0], shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }
              : null),
            elevation: isDark ? 7 : 2,
          }}
        >
          <View
            style={{
              flex: 1,
              borderRadius: 33,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDark ? AI_COACH_UI.surface : '#FFFFFF',
              borderWidth: 1,
              borderColor: isDark ? AI_COACH_UI.borderHairline : 'rgba(15,23,42,0.08)',
              overflow: 'hidden',
            }}
          >
            {isDark ? (
              <LinearGradient
                colors={HERO_INNER}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
            ) : null}
            <Ionicons name={action.icon} size={24} color={isDark ? '#FFFFFF' : '#0A0A0F'} />
          </View>
        </LinearGradient>
        <Text
          style={{
            marginTop: 8,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.2,
            color: isDark ? '#FFFFFF' : 'rgba(10,10,15,0.72)',
          }}
        >
          {action.label}
        </Text>
        {action.sublabel ? (
          <Text
            style={{
              marginTop: 2,
              fontSize: 9,
              fontWeight: '600',
              letterSpacing: 0.3,
              textTransform: 'uppercase',
              color: isDark ? 'rgba(255,255,255,0.38)' : 'rgba(10,10,15,0.38)',
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

const CAN_HELP_CARD_WIDTH = SW - 32;

const CanHelpWithCarousel = ({ items, isDark, t, onPress }) => {
  const list = (items || []).filter(Boolean);
  const [index, setIndex] = useState(0);

  if (!list.length) return null;

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems?.[0]?.index != null) setIndex(viewableItems[0].index);
  }).current;

  return (
    <View style={{ width: '100%', marginTop: 4 }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: '800',
          letterSpacing: 1.1,
          textTransform: 'uppercase',
          color: isDark ? 'rgba(255,255,255,0.42)' : 'rgba(10,10,15,0.42)',
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
            <View
              style={{
                borderRadius: 16,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: isDark ? AI_COACH_UI.borderHairline : 'rgba(15,23,42,0.08)',
                backgroundColor: isDark ? AI_COACH_UI.surface : '#FFFFFF',
              }}
            >
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
              <LinearGradient
                colors={item.rim || ['#FF6B9D', '#C084FC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: 14, padding: 1.5 }}
              >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12.5,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,15,0.04)',
                }}
              >
                <Ionicons name={item.icon} size={22} color={isDark ? '#FFFFFF' : '#0A0A0F'} />
              </View>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 15, fontWeight: '800', color: t.textPrimary, marginBottom: 4 }}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
                <Text style={{ fontSize: 13, color: t.textMuted }} numberOfLines={2}>
                  {item.subtitle}
                </Text>
              </View>
            </View>
            </View>
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

const SPOTLIGHT_PINK = AI_COACH_UI.pink;

/** Single card that auto-rotates through suggestions with fade/slide. */
const SpotlightSuggestion = ({ suggestions, isDark, t, onPress }) => {
  const items = (suggestions || []).filter(Boolean).slice(0, 8);
  const [index, setIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setIndex(0);
    fadeAnim.setValue(1);
    slideAnim.setValue(0);
  }, [items.join('|')]);

  useEffect(() => {
    if (items.length <= 1) return undefined;
    const interval = setInterval(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: -10, duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (!finished) return;
        setIndex((i) => (i + 1) % items.length);
        slideAnim.setValue(10);
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
          Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 4 }),
        ]).start();
      });
    }, SPOTLIGHT_ROTATE_MS);
    return () => clearInterval(interval);
  }, [items.length, fadeAnim, slideAnim]);

  if (!items.length) return null;

  const text = items[index];
  const iconName = iconForPrompt(text);
  const iconRim = rimForPrompt(text);

  return (
    <View style={{ width: '100%', marginTop: 20 }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: '800',
          letterSpacing: 1.1,
          textTransform: 'uppercase',
          color: isDark ? 'rgba(255,255,255,0.42)' : 'rgba(10,10,15,0.42)',
          marginBottom: 10,
        }}
      >
        Try asking
      </Text>

      <Pressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onPress(text);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Start chat: ${text}`}
        style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
      >
        <View
          style={{
            borderRadius: 16,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: isDark ? AI_COACH_UI.borderHairline : 'rgba(15,23,42,0.08)',
            backgroundColor: isDark ? AI_COACH_UI.surface : '#FFFFFF',
          }}
        >
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
            <LinearGradient
              colors={iconRim}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 14, padding: 1.5 }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12.5,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,15,0.04)',
                }}
              >
                <Ionicons name={iconName} size={22} color={isDark ? '#FFFFFF' : '#0A0A0F'} />
              </View>
            </LinearGradient>
            <Animated.View
              style={{
                flex: 1,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '700',
                  lineHeight: 21,
                  color: t.textPrimary,
                  letterSpacing: -0.2,
                }}
                numberOfLines={3}
              >
                {text}
              </Text>
            </Animated.View>
            <LinearGradient
              colors={['#FF6B9D', '#DB2777']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </LinearGradient>
          </View>
        </View>
      </Pressable>

      {items.length > 1 ? (
        <View style={{ flexDirection: 'row', gap: 5, marginTop: 12, paddingLeft: 2 }}>
          {items.map((_, dotIndex) => (
            <View
              key={`dot-${dotIndex}`}
              style={{
                width: pagerDotWidth(dotIndex === index),
                height: 5,
                borderRadius: 999,
                backgroundColor: pagerDotColor(dotIndex === index, isDark, SPOTLIGHT_PINK),
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
};

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

const HeroWelcomeCard = ({
  t,
  isDark,
  userName,
  borderAnim,
}) => {
  const safeName = String(userName || 'there').trim() || 'there';
  const cardInnerBg = isDark ? AI_COACH_UI.surface : '#FFFFFF';
  const borderColors = isDark ? CARD_BORDER : ['#BE185D', '#C2410C'];

  const borderTranslateX = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SW, 0],
  });

  return (
    <View style={{ width: '100%', borderRadius: 28, overflow: 'hidden' }}>
      {/* Animated border line only (no rotating card / no gradient background fill) */}
      <View style={{ padding: 2, borderRadius: 28, overflow: 'hidden' }}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <AnimatedLinearGradient
            colors={borderColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: SW * 2,
              height: '100%',
              transform: [{ translateX: borderTranslateX }],
            }}
          />
        </View>

        <View
          style={{
            borderRadius: 24,
            backgroundColor: cardInnerBg,
            paddingHorizontal: 18,
            paddingTop: 22,
            paddingBottom: 18,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: isDark ? AI_COACH_UI.borderHairline : 'rgba(0,0,0,0.06)',
            overflow: 'hidden',
          }}
        >
          {isDark ? (
            <LinearGradient
              colors={HERO_INNER}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 26, fontWeight: '900', color: t.textPrimary, textAlign: 'center' }}>
              {getAuroraHeroGreetingPhrase()},{' '}
            </Text>
            <ColorText
              colors={HERO_TITLE_TEXT_GRADIENT}
              style={{ fontSize: 26, fontWeight: '900' }}
            >
              {safeName}!
            </ColorText>
          </View>

          <View style={{ alignItems: 'center', marginTop: 12 }}>
            <Text
              style={{
                fontSize: 16,
                letterSpacing: 3,
                fontWeight: '800',
                color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)',
              }}
            >
              WELCOME TO
            </Text>
            <LinearGradient
              colors={CTA_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ width: 86, height: 4, borderRadius: 999, marginTop: 10 }}
            />
          </View>

          <ColorText
            colors={HERO_TITLE_TEXT_GRADIENT}
            style={{
              marginTop: 14,
              fontSize: 44,
              fontWeight: '900',
              textAlign: 'center',
              letterSpacing: 0.4,
              lineHeight: 48,
            }}
            numberOfLines={1}
          >
            AI Coach
          </ColorText>

          <Text
            style={{
              marginTop: 10,
              fontSize: 13,
              fontWeight: '700',
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: isDark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.45)',
              textAlign: 'center',
            }}
          >
            YOUR TRAINING & NUTRITION GETS BETTER WITH CC
          </Text>
        </View>
      </View>
    </View>
  );
};

function chatStartPayload(prefillOrPayload) {
  if (typeof prefillOrPayload === 'string') return { prefill: prefillOrPayload };
  if (prefillOrPayload && typeof prefillOrPayload === 'object') return prefillOrPayload;
  return {};
}

function photoOnlyPrefill(imageCount) {
  if (imageCount > 0) return 'What do you see in this image? Give me coaching feedback.';
  return '';
}

function playCoachHomeEntrance(anims) {
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
  t,
  screenOpacity,
  headerOpacity,
  isDark,
  onProfilePress,
  onSettingsPress,
  setSidebarOpen,
  onOpenTestSuite,
  insets,
  keyboardVisible,
  listBottomPad,
  idleGroupOpacity,
  idleGroupTranslateY,
  userName,
  pillBorderAnim,
  lottieOpacity,
  lottieScale,
  canHelpItems,
  handleStartChat,
  coachActions,
  handleActionPress,
  suggestions,
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
  onStartChat,
  hideBottomNav,
  onHomePress,
  onPlusPress,
  onVoicePress,
  onNutritionPress,
  onWorkoutPress,
  onMessagesPress,
}) {
  const micBackground = listeningMicBackground(listening, isDark);

  return (
    <Animated.View style={{ flex: 1, backgroundColor: t.bg, opacity: screenOpacity }}>
      <Animated.View style={{ opacity: headerOpacity, zIndex: 30 }}>
        <TopHeader
          isDark={isDark}
          onProfilePress={onProfilePress}
          onSettingsPress={onSettingsPress}
          headerLeft={
            <ChatHistoryHeaderButton compact isDark={isDark} onPress={() => setSidebarOpen(true)} />
          }
        />
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
          <IdleCoachHome
            keyboardVisible={keyboardVisible}
            idleGroupOpacity={idleGroupOpacity}
            idleGroupTranslateY={idleGroupTranslateY}
            t={t}
            isDark={isDark}
            userName={userName}
            pillBorderAnim={pillBorderAnim}
            lottieOpacity={lottieOpacity}
            lottieScale={lottieScale}
            canHelpItems={canHelpItems}
            handleStartChat={handleStartChat}
            coachActions={coachActions}
            handleActionPress={handleActionPress}
            suggestions={suggestions}
          />
        </ScrollView>

        <ComposerBar
          inputOpacity={inputOpacity}
          inputTranslateY={inputTranslateY}
          t={t}
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
          micBackground={micBackground}
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
          onStartChat?.({});
        }}
        isDark={isDark}
        insets={insets}
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
  const buttonBackground = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
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
        <Ionicons name="flask-outline" size={18} color="#FF6B9D" />
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
  if (isDark) return 'rgba(255,255,255,0.42)';
  return 'rgba(10,10,15,0.42)';
}

function IdleCoachHome({
  keyboardVisible,
  idleGroupOpacity,
  idleGroupTranslateY,
  t,
  isDark,
  userName,
  pillBorderAnim,
  lottieOpacity,
  lottieScale,
  canHelpItems,
  handleStartChat,
  coachActions,
  handleActionPress,
  suggestions,
}) {
  if (keyboardVisible) return null;
  const shadow = lottieShadow(isDark);
  return (
    <Animated.View
      style={{
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 20,
        paddingBottom: 10,
        opacity: idleGroupOpacity,
        transform: [{ translateY: idleGroupTranslateY }],
      }}
    >
      <HeroWelcomeCard
        t={t}
        isDark={isDark}
        userName={userName}
        borderAnim={pillBorderAnim}
      />

      <Animated.View
        style={{
          width: '100%',
          height: Math.min(420, Math.floor(SH * 0.62)),
          marginTop: 10,
          opacity: lottieOpacity,
          transform: [{ scale: lottieScale }],
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: shadow.shadowOpacity,
          shadowRadius: shadow.shadowRadius,
          shadowOffset: { width: 0, height: 10 },
          elevation: shadow.elevation,
        }}
      >
        <LottieView
          source={require('../../assets/animations/legacy/Cloud robotics abstract.json')}
          autoPlay
          loop
          style={{ width: '100%', height: '100%' }}
        />
      </Animated.View>

      <View style={{ width: '100%', marginTop: 8 }}>
        <CanHelpWithCarousel
          items={canHelpItems}
          isDark={isDark}
          t={t}
          onPress={handleStartChat}
        />

        <View
          style={{
            width: '100%',
            marginTop: 24,
            borderRadius: 18,
            paddingVertical: 16,
            paddingHorizontal: 8,
            backgroundColor: t.glassBg,
            borderWidth: 1,
            borderColor: t.border,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '800',
              letterSpacing: 1.1,
              textTransform: 'uppercase',
              color: sectionLabelColor(isDark),
              marginBottom: 14,
              textAlign: 'center',
            }}
          >
            What do you need?
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
            {coachActions.map((action) => (
              <CoachActionOrb
                key={action.id}
                action={action}
                isDark={isDark}
                onPress={handleActionPress}
              />
            ))}
          </View>
          <SpotlightSuggestion
            suggestions={suggestions}
            isDark={isDark}
            t={t}
            onPress={handleStartChat}
          />
        </View>
      </View>
    </Animated.View>
  );
}

function AttachmentPreview({ attachment, t }) {
  if (attachment.preview) {
    return (
      <Image
        source={{ uri: attachment.preview }}
        style={{
          width: 72,
          height: 72,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: t.chipBorder,
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
  );
}

function ComposerAttachments({ attachments, t, removeAttachment }) {
  if (attachments.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={{ flexGrow: 0, marginBottom: 10 }}
      contentContainerStyle={{ gap: 10, alignItems: 'center' }}
    >
      {attachments.map((attachment) => (
        <View key={attachment.id} style={{ position: 'relative' }}>
          <AttachmentPreview attachment={attachment} t={t} />
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
  );
}

function inputBackground(isDark) {
  if (isDark) return 'rgba(255,255,255,0.05)';
  return 'rgba(0,0,0,0.04)';
}

function ComposerBar({
  inputOpacity,
  inputTranslateY,
  t,
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
  micBackground,
  canSend,
}) {
  return (
    <Animated.View
      style={{
        opacity: inputOpacity,
        transform: [{ translateY: inputTranslateY }],
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: t.border,
        backgroundColor: t.inputBarBg,
        paddingHorizontal: 16,
        paddingTop: composerPaddingTop(attachments.length),
        paddingBottom: composerKeyboardPad,
      }}
    >
      <ComposerAttachments attachments={attachments} t={t} removeAttachment={removeAttachment} />

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
        <TouchableOpacity
          onPress={openAttachMenu}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ padding: 4, marginBottom: 4 }}
        >
          <Ionicons name="add-circle-outline" size={26} color={attachIconColor(isDark)} />
        </TouchableOpacity>
        <TextInput
          {...COACH_COMPOSER_TEXT_INPUT_PROPS}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 40,
            maxHeight: 100,
            fontSize: 15,
            color: t.textPrimary,
            paddingVertical: 10,
            paddingHorizontal: 14,
            backgroundColor: inputBackground(isDark),
            borderRadius: 20,
            borderWidth: 1,
            borderColor: t.border,
          }}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
          placeholder="Ask your coach..."
          placeholderTextColor={t.textMuted}
          returnKeyType="send"
          blurOnSubmit={false}
          accessibilityLabel="Message input"
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
            backgroundColor: micBackground,
          }}
          accessibilityLabel={micAccessibilityLabel(listening)}
        >
          <Ionicons
            name={micIconName(listening)}
            size={22}
            color={micIconColor(isDark)}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSend}
          disabled={!canSend}
          activeOpacity={0.85}
          style={{ marginBottom: 2, opacity: sendButtonOpacity(canSend) }}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          <LinearGradient
            colors={composerSendColors(isDark)}
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
}) {
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

  const theme = isDark ? DARK : LIGHT;
  const userName = String(userData?.name || userData?.displayName || userData?.firstName || 'there').trim() || 'there';
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
    playCoachHomeEntrance({
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

  const handleDeleteSession = async (session) => {
    const sessionId = session?.sessionId || session?.id;
    if (!db || !userId || !sessionId) return;

    Alert.alert('Delete chat?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAiChatSession(userId, sessionId);
          } catch (deleteError) {
            console.error('Failed to delete ai chat:', deleteError);
          }
        },
      },
    ]);
  };

  useEffect(() => {
    if (!db || !userId) {
      setUserData(null);
      return undefined;
    }
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
    let trackingSnap = emptyMetricsSnap();
    let logsSnap = emptyMetricsSnap();

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
        trackingSnap = emptyMetricsSnap();
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
        logsSnap = emptyMetricsSnap();
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

  const handleStartChat = (prefillOrPayload) => {
    const payload = chatStartPayload(prefillOrPayload);
    Animated.parallel([
      Animated.timing(idleGroupOpacity, { toValue: 0, duration: CHAT_EXIT_MS, useNativeDriver: true }),
      Animated.timing(idleGroupTranslateY, { toValue: -6, duration: CHAT_EXIT_MS, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onStartChat?.(payload);
    });
  };

  const openChatWithAttachments = async (pickFn) => {
    const picked = await pickFn();
    if (picked.length > 0) {
      setAttachments((previous) => [...previous, ...picked]);
    }
  };

  const handlePhotoLibrary = () => openChatWithAttachments(pickCoachPhotosFromLibrary);
  const handleCamera = () => openChatWithAttachments(pickCoachPhotoFromCamera);
  const handleFile = () => openChatWithAttachments(pickCoachDocuments);

  const handleActionPress = (action) => {
    if (action.id === 'photo') {
      handleCamera();
      return;
    }
    handleStartChat(action.starter);
  };

  const openAttachMenu = () => {
    showCoachAttachMenu({
      onPhotoLibrary: handlePhotoLibrary,
      onCamera: handleCamera,
      onFile: handleFile,
    });
  };

  const removeAttachment = (id) => setAttachments((previous) => previous.filter((attachment) => attachment.id !== id));

  const canSend = inputText.trim().length > 0 || attachments.length > 0;

  const handleSend = () => {
    const text = inputText.trim();
    const imageAtts = attachments.filter((attachment) => attachment?.type === 'image' || attachment?.preview);
    const hasFilesOnly = attachments.some((attachment) => attachment?.type === 'file') && imageAtts.length === 0;
    if (!text && attachments.length === 0) return;
    if (hasFilesOnly) {
      Alert.alert(
        'Photos work best',
        'The coach can analyze progress photos right now. Attach a photo instead of a document.'
      );
      return;
    }
    const prefill = text || photoOnlyPrefill(imageAtts.length);
    handleStartChat({
      prefill,
      initialAttachments: attachments,
    });
    setInputText('');
    setAttachments([]);
  };

  void inputBorderAnim;

  return (
    <CoachHomeScreenLayout
      t={theme}
      screenOpacity={screenOpacity}
      headerOpacity={headerOpacity}
      isDark={isDark}
      onProfilePress={onProfilePress}
      onSettingsPress={onSettingsPress}
      setSidebarOpen={setSidebarOpen}
      onOpenTestSuite={onOpenTestSuite}
      insets={insets}
      keyboardVisible={keyboardVisible}
      listBottomPad={listBottomPad}
      idleGroupOpacity={idleGroupOpacity}
      idleGroupTranslateY={idleGroupTranslateY}
      userName={userName}
      pillBorderAnim={pillBorderAnim}
      lottieOpacity={lottieOpacity}
      lottieScale={lottieScale}
      canHelpItems={canHelpItems}
      handleStartChat={handleStartChat}
      coachActions={coachActions}
      handleActionPress={handleActionPress}
      suggestions={suggestions}
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
      onStartChat={onStartChat}
      hideBottomNav={hideBottomNav}
      onHomePress={onHomePress}
      onPlusPress={onPlusPress}
      onVoicePress={onVoicePress}
      onNutritionPress={onNutritionPress}
      onWorkoutPress={onWorkoutPress}
      onMessagesPress={onMessagesPress}
    />
  );
}
