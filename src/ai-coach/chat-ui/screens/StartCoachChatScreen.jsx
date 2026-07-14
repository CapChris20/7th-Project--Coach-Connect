/**
 * StartCoachChatScreen.jsx — React Native
 * Converted from Lovable export (lovable-export-d5e2ed71)
 *
 * Place at: src/ai-coach/chat-ui/chat-home/StartCoachChatScreen.jsx
 * Replaces: VoiceCoachScreen.jsx
 */

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
import { showCoachAttachMenu } from '../chat-thread/openAttachmentMenu';
import {
  pickCoachDocuments,
  pickCoachPhotoFromCamera,
  pickCoachPhotosFromLibrary,
} from '../chat-thread/pickAttachmentType';
import { doc, onSnapshot } from 'firebase/firestore';
import { deleteAiChatSession } from '../persistence/saveCoachMessages';
import CoachChatHistorySidebar from '../components/CoachChatHistorySidebar';
import { useCoachChatSessions } from '../hooks/useCoachChatSessions';
import { db } from '../../../app-start/config';
import BottomNavBar from '../../../navigation/BottomNavBar';
import { ShellBottomNavAnchor } from '../../../navigation/bottomNavMetrics';
import CoachConnectHeader from '../../../shared/components/shell/CoachConnectHeader';
import { useTheme } from '../../../shared-ui/ThemeContext';
import { useCoachSpeech } from '../voice/useVoiceToCoach';
import { useCoachComposerKeyboard, COACH_COMPOSER_TEXT_INPUT_PROPS } from '../chat-thread/useCoachComposerKeyboard';
import { AI_COACH_UI } from '../aiCoachUiTokens';
import StableGradientText from '../../../shared-ui/StableGradientText';
import { HERO_TITLE_TEXT_GRADIENT } from '../../../shared-ui/brandGradients';
import {
  buildHourlyCanHelpWith,
  buildHourlyCoachActions,
  buildHourlySpotlightSuggestions,
  getCoachHourSlot,
} from '../chat-thread/coachQuickPrompts';
import {
  HOME_STAT_SLEEP_GRADIENT,
  HOME_STAT_SORENESS_GRADIENT,
  HOME_STAT_WATER_GRADIENT,
  HOME_STAT_WORKOUT_GRADIENT,
} from '../../../shared-ui/homeStatGradients';
import { getClientDateKey } from '../../../shared-utils/dateKeys';
import { calculateMacroTotals, getFoodLogsForDate } from '../../../nutrition/daily-log/logFoodToFirestore';
import { parseDailyMetricsFromSnapshots } from '../../../metrics/daily-metrics/parseUserDailyMetrics';
import { getAuroraHeroGreetingPhrase } from '../../../shared/components/home/AuroraHeroBanner';

const { width: SW, height: SH } = Dimensions.get('window');
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

function iconForPrompt(text) {
  const s = String(text || '').toLowerCase();
  if (s.includes('nutrition') || s.includes('habit')) return 'restaurant-outline';
  if (s.includes('full-body') || s.includes('upper/lower') || s.includes('schedule')) return 'body-outline';
  if (s.includes('workout') || s.includes('hypertrophy') || s.includes('split') || s.includes('squat')) return 'barbell-outline';
  if (s.includes('protein') || s.includes('eat') || s.includes('macro') || s.includes('meal') || s.includes('vegan') || s.includes('keto')) return 'nutrition-outline';
  if (s.includes('supplement') || s.includes('creatine')) return 'flask-outline';
  if (s.includes('recover')) return 'bed-outline';
  if (s.includes('research') || s.includes('skinny fat') || s.includes('recomp') || s.includes('body')) return 'body-outline';
  if (s.includes('progressive') || s.includes('overload')) return 'trending-up-outline';
  if (s.includes('skipped') || s.includes('back')) return 'refresh-outline';
  if (s.includes('calorie') || s.includes('fat-loss') || s.includes('deficit')) return 'flame-outline';
  if (s.includes('conditioning') || s.includes('athletic')) return 'flash-outline';
  if (s.includes('drink') || s.includes('zero-sugar')) return 'water-outline';
  return 'sparkles-outline';
}

function rimForPrompt(text) {
  const s = String(text || '').toLowerCase();
  if (s.includes('nutrition') || s.includes('habit') || s.includes('protein') || s.includes('meal') || s.includes('macro') || s.includes('eat') || s.includes('cal')) {
    return HOME_STAT_SORENESS_GRADIENT;
  }
  if (s.includes('workout') || s.includes('split') || s.includes('training') || s.includes('full-body') || s.includes('schedule')) {
    return HOME_STAT_WORKOUT_GRADIENT;
  }
  if (s.includes('recover') || s.includes('sleep') || s.includes('rest')) {
    return HOME_STAT_SLEEP_GRADIENT;
  }
  if (s.includes('search') || s.includes('web') || s.includes('research')) {
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

const uniqueTake = (arr, n) => {
  const out = [];
  for (const item of arr) {
    if (!item) continue;
    if (out.includes(item)) continue;
    out.push(item);
    if (out.length >= n) break;
  }
  return out;
};

function normalizeTextSignal(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\u2019']/g, "'")
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferTopTopicsFromSessions(sessions = []) {
  const score = new Map();
  const bump = (k, w = 1) => score.set(k, (score.get(k) || 0) + w);

  for (const s of (sessions || []).slice(0, 18)) {
    const hay = normalizeTextSignal(
      [s?.title, s?.lastUserMessage, s?.lastAssistantMessage].filter(Boolean).join(' | ')
    );
    if (!hay) continue;

    if (/\bmacro|macros|calorie|deficit|bulk|cut|protein|carb|fat|meal|diet|nutrition\b/.test(hay)) bump('nutrition', 3);
    if (/\bworkout|split|hypertrophy|lift|squat|bench|deadlift|volume|program|deload|set|rep\b/.test(hay)) bump('training', 3);
    if (/\bsleep|recover|recovery|rest|soreness|stress|fatigue\b/.test(hay)) bump('recovery', 2);
    if (/\bplan|schedule|week|routine|habit|time\b/.test(hay)) bump('planning', 2);
    if (/\binjury|pain|knee|back|shoulder\b/.test(hay)) bump('injury', 2);
    if (/\bsupplement|creatine|caffeine\b/.test(hay)) bump('supplements', 1);
  }

  return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 3);
}

function buildDynamicSuggestions({ userData, sessions }) {
  const contextual = [];

  const goal = String(userData?.primaryGoal || userData?.goal || userData?.fitnessGoal || '').toLowerCase();
  const dietPref = String(userData?.dietPreference || userData?.diet || '').toLowerCase();
  const topTopics = inferTopTopicsFromSessions(sessions);
  const recentTitles = (sessions || []).slice(0, 8).map((s) => String(s?.title || '').trim()).filter(Boolean);
  const titleText = normalizeTextSignal(recentTitles.join(' | '));

  if (goal.includes('lose') || goal.includes('fat')) {
    contextual.push('Based on my current stats, design a fat‑loss week that keeps my lifts moving up.');
    contextual.push('How aggressive should my calorie deficit be so I lose fat without killing performance?');
  } else if (goal.includes('muscle') || goal.includes('build')) {
    contextual.push('Lay out a progression plan so I’m adding muscle over the next 4–6 weeks.');
    contextual.push('Given my goal, what should my training split and progression look like this week?');
  } else if (goal.includes('athletic') || goal.includes('performance')) {
    contextual.push('Design a strength + conditioning week that actually improves performance, not just crushes me.');
    contextual.push('How do I add conditioning without wrecking my main lifts?');
  }

  if (dietPref.includes('vegan')) {
    contextual.push('Build a high‑protein vegan day of eating that fits my training.');
  }
  if (dietPref.includes('keto')) {
    contextual.push('How do I run keto in a way that still supports hard training?');
  }

  if (titleText.includes('recomp') || titleText.includes('skinny fat')) {
    contextual.push('Map out a body‑recomposition plan for me (skinny‑fat problem).');
  }
  if (titleText.includes('macros') || titleText.includes('calories')) {
    contextual.push('Recalculate today’s macros based on my goal, training, and recent check‑ins.');
  }
  if (titleText.includes('creatine')) {
    contextual.push('Given my training, how should I actually use creatine and what should I expect?');
  }
  if (titleText.includes('zero sugar')) {
    contextual.push('Where do zero‑sugar drinks fit into my week, and what should I watch out for?');
  }

  // Topic-driven suggestions (based on what they talk about most).
  if (topTopics.includes('training')) {
    contextual.push('Build me a 4‑day training split for the next 2 weeks (with progression).');
  }
  if (topTopics.includes('nutrition')) {
    contextual.push('Turn my calorie target into a simple macro + meal structure I can follow daily.');
  }
  if (topTopics.includes('recovery')) {
    contextual.push('Audit my recovery: sleep, stress, soreness — what’s the #1 fix this week?');
  }
  if (topTopics.includes('planning')) {
    contextual.push('Help me plan my week: when to train, meal prep, and recovery blocks.');
  }
  if (topTopics.includes('injury')) {
    contextual.push('Modify my training around my current aches so I can keep progressing safely.');
  }
  if (topTopics.includes('supplements')) {
    contextual.push('What supplements (if any) actually matter for my goal, and how should I take them?');
  }

  if (contextual.length === 0) {
    // No signals yet (brand‑new user) — fall back to a small set of broad, non‑repetitive prompts.
    return FALLBACK_SUGGESTIONS.slice(0, 6);
  }

  // Prefer contextual prompts, then top up with generic fallbacks that aren't near‑duplicates.
  const basePool = [...contextual];
  for (const fb of FALLBACK_SUGGESTIONS) {
    if (!basePool.some((s) => String(s).toLowerCase() === String(fb).toLowerCase())) {
      basePool.push(fb);
    }
  }
  return uniqueTake(basePool, 6);
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
              <LinearGradient
                colors={item.rim || ['#FF6B9D', '#C084FC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ height: 1.5, width: '100%', opacity: 0.85 }}
              />
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
          {list.map((_, i) => (
            <View
              key={`can-dot-${i}`}
              style={{
                width: i === index ? 16 : 5,
                height: 5,
                borderRadius: 999,
                backgroundColor:
                  i === index
                    ? AI_COACH_UI.pink
                    : isDark
                      ? 'rgba(255,255,255,0.18)'
                      : 'rgba(0,0,0,0.12)',
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
    }, 4800);
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
          <LinearGradient
            colors={iconRim}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height: 1.5, width: '100%', opacity: 0.85 }}
          />
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
          {items.map((_, i) => (
            <View
              key={`dot-${i}`}
              style={{
                width: i === index ? 16 : 5,
                height: 5,
                borderRadius: 999,
                backgroundColor:
                  i === index
                    ? SPOTLIGHT_PINK
                    : isDark
                      ? 'rgba(255,255,255,0.18)'
                      : 'rgba(0,0,0,0.12)',
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
            <StableGradientText
              colors={HERO_TITLE_TEXT_GRADIENT}
              style={{ fontSize: 26, fontWeight: '900' }}
            >
              {safeName}!
            </StableGradientText>
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

          <StableGradientText
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
          </StableGradientText>

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

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function StartCoachChatScreen({
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
  const sessions = useCoachChatSessions(userId);
  const [userData, setUserData] = useState(null);
  const [dailyMetrics, setDailyMetrics] = useState(null);
  const [nutritionToday, setNutritionToday] = useState(null);
  const [hourSlot, setHourSlot] = useState(getCoachHourSlot());

  const promptNow = hourSlot * 60 * 60 * 1000;
  const canHelpItems = buildHourlyCanHelpWith({ userData, sessions, now: promptNow });
  const coachActions = buildHourlyCoachActions(COACH_ACTIONS, { userData, sessions, now: promptNow });
  const suggestions = buildHourlySpotlightSuggestions({
    userData,
    sessions,
    dailyMetrics,
    nutritionToday,
    now: promptNow,
  });

  const t = isDark ? DARK : LIGHT;
  const userName = String(userData?.name || userData?.displayName || userData?.firstName || 'there').trim() || 'there';
  const { keyboardVisible, composerKeyboardPad, listBottomPad } =
    useCoachComposerKeyboard({ hideBottomNav });
  // ─── Load + transition animations (UI only) ─────────────────────────────────
  const screenOpacity = useRef(new Animated.Value(0)).current;          // 0ms -> 300ms
  const headerOpacity = useRef(new Animated.Value(0)).current;          // 0ms -> 300ms
  const lottieOpacity = useRef(new Animated.Value(0)).current;          // 100ms -> 500ms
  const lottieScale = useRef(new Animated.Value(0.9)).current;          // 100ms -> 500ms (bouncy)
  const inputOpacity = useRef(new Animated.Value(0)).current;           // 800ms -> 300ms
  const inputTranslateY = useRef(new Animated.Value(10)).current;
  const idleGroupOpacity = useRef(new Animated.Value(1)).current;       // fades out when starting chat
  const idleGroupTranslateY = useRef(new Animated.Value(0)).current;

  const pillBorderAnim = useRef(new Animated.Value(0)).current;

  const inputBorderAnim = useRef(new Animated.Value(0)).current; // hero / pill border loop

  const { listening, toggleListen } = useCoachSpeech({
    onPartialTranscript: (text) => setInputText(text),
    onFinalTranscript: (text) => setInputText(text),
  });

  useEffect(() => {
    // Background + header
    Animated.timing(screenOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    Animated.timing(headerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();

    // Lottie
    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(lottieOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(lottieScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 14 }),
      ]),
    ]).start();

    // Subtle animated gradient border loop
    Animated.loop(
      Animated.timing(pillBorderAnim, { toValue: 1, duration: 7000, useNativeDriver: true })
    ).start();

    // Input (800ms)
    Animated.sequence([
      Animated.delay(800),
      Animated.parallel([
        // Must stay JS-driven because we combine opacity with keyboard height transform on same view
        Animated.timing(inputOpacity, { toValue: 1, duration: 300, useNativeDriver: false }),
        // Must stay JS-driven because we combine it with keyboard height.
        Animated.timing(inputTranslateY, { toValue: 0, duration: 300, useNativeDriver: false }),
      ]),
    ]).start();
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
          } catch (e) {
            console.error('Failed to delete ai chat:', e);
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
      doc(db, 'users', userId),
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
    let trackingSnap = { exists: () => false, data: () => ({}) };
    let logsSnap = { exists: () => false, data: () => ({}) };

    const apply = () => {
      setDailyMetrics(parseDailyMetricsFromSnapshots(logsSnap, trackingSnap));
    };

    const unsubTrack = onSnapshot(
      doc(db, 'users', userId, 'daily_tracking', todayKey),
      (snap) => {
        trackingSnap = snap;
        apply();
      },
      () => {
        trackingSnap = { exists: () => false, data: () => ({}) };
        apply();
      },
    );

    const unsubLogs = onSnapshot(
      doc(db, 'users', userId, 'dailyLogs', todayKey),
      (snap) => {
        logsSnap = snap;
        apply();
      },
      () => {
        logsSnap = { exists: () => false, data: () => ({}) };
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
      setHourSlot((prev) => (prev !== next ? next : prev));
    }, 60000);
    return () => clearInterval(tick);
  }, []);

  const handleStartChat = (prefillOrPayload) => {
    const payload =
      typeof prefillOrPayload === 'string'
        ? { prefill: prefillOrPayload }
        : prefillOrPayload && typeof prefillOrPayload === 'object'
          ? prefillOrPayload
          : {};
    Animated.parallel([
      Animated.timing(idleGroupOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(idleGroupTranslateY, { toValue: -6, duration: 200, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onStartChat?.(payload);
    });
  };

  const openChatWithAttachments = async (pickFn) => {
    const picked = await pickFn();
    if (picked.length > 0) {
      setAttachments((prev) => [...prev, ...picked]);
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

  const removeAttachment = (id) => setAttachments((prev) => prev.filter((a) => a.id !== id));

  const canSend = inputText.trim().length > 0 || attachments.length > 0;

  const handleSend = () => {
    const text = inputText.trim();
    const imageAtts = attachments.filter((a) => a?.type === 'image' || a?.preview);
    const hasFilesOnly = attachments.some((a) => a?.type === 'file') && imageAtts.length === 0;
    if (!text && attachments.length === 0) return;
    if (hasFilesOnly) {
      Alert.alert(
        'Photos work best',
        'The coach can analyze progress photos right now. Attach a photo instead of a document.'
      );
      return;
    }
    const prefill =
      text ||
      (imageAtts.length > 0 ? 'What do you see in this image? Give me coaching feedback.' : '');
    handleStartChat({
      prefill,
      initialAttachments: attachments,
    });
    setInputText('');
    setAttachments([]);
  };

  return (
    <Animated.View style={{ flex: 1, backgroundColor: t.bg, opacity: screenOpacity }}>
      {/* Header (fixed) */}
      <Animated.View style={{ opacity: headerOpacity, zIndex: 30 }}>
        <CoachConnectHeader
          isDark={isDark}
          onProfilePress={onProfilePress}
          onSettingsPress={onSettingsPress}
          headerLeft={
            <ChatHistoryHeaderButton compact isDark={isDark} onPress={() => setSidebarOpen(true)} />
          }
        />
        {onOpenTestSuite ? (
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
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              }}
            >
              <Ionicons name="flask-outline" size={18} color="#FF6B9D" />
            </TouchableOpacity>
          </View>
        ) : null}
      </Animated.View>

      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: keyboardVisible ? 0 : 1,
            paddingBottom: listBottomPad,
            paddingHorizontal: 16,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          {!keyboardVisible ? (
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

            {/* Bigger Lottie OUTSIDE the card (so card isn't huge) */}
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
                shadowOpacity: isDark ? 0.22 : 0,
                shadowRadius: isDark ? 18 : 0,
                shadowOffset: { width: 0, height: 10 },
                elevation: isDark ? 10 : 0,
              }}
            >
              <LottieView
                source={require('../../../assets/animations/legacy/Cloud robotics abstract.json')}
                autoPlay
                loop
                style={{ width: '100%', height: '100%' }}
              />
            </Animated.View>

            {/* Coach starters — action orbs + rotating spotlight */}
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
                    color: isDark ? 'rgba(255,255,255,0.42)' : 'rgba(10,10,15,0.42)',
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
          ) : null}
        </ScrollView>

        <Animated.View
          style={{
            opacity: inputOpacity,
            transform: [{ translateY: inputTranslateY }],
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: t.border,
            backgroundColor: t.inputBarBg,
            paddingHorizontal: 16,
            paddingTop: attachments.length > 0 ? 10 : 8,
            paddingBottom: composerKeyboardPad,
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
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
            <TouchableOpacity
              onPress={openAttachMenu}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ padding: 4, marginBottom: 4 }}
            >
              <Ionicons name="add-circle-outline" size={26} color={isDark ? AI_COACH_UI.composer.iconAttach : AI_COACH_UI.composer.iconAttachLight} />
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
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
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
              onPress={handleSend}
              disabled={!canSend}
              activeOpacity={0.85}
              style={{ marginBottom: 2, opacity: canSend ? 1 : 0.45 }}
              accessibilityRole="button"
              accessibilityLabel="Send message"
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
        </Animated.View>
      </View>

      <CoachChatHistorySidebar
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

      {!hideBottomNav && !keyboardVisible ? (
        <ShellBottomNavAnchor>
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
        </ShellBottomNavAnchor>
      ) : null}
    </Animated.View>
  );
}

