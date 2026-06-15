/**
 * AIChat Home Screen
 *
 * Purpose: UI screen or component: AIChat Home Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/aiChat
 * Key exports: AIChatHomeScreen
 *
 * @file-header
 */
/**
 * AIChatHomeScreen.jsx — React Native
 * Converted from Lovable export (lovable-export-d5e2ed71)
 *
 * Place at: src/aiChat/screens/AIChatHomeScreen.jsx
 * Replaces: VoiceAIHomeScreen.jsx
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
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
import MaskedView from '@react-native-masked-view/masked-view';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showCoachAttachMenu } from '../chat-thread/openAttachmentMenu';
import {
  pickCoachDocuments,
  pickCoachPhotoFromCamera,
  pickCoachPhotosFromLibrary,
} from '../chat-thread/pickAttachmentType';
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../app/config';
import BottomNavBar from '../../navigation/BottomNavBar';
import { BOTTOM_NAV_BAR_HEIGHT } from '../../navigation/bottomNavMetrics';
import CoachConnectHeader from '../../shared/components/CoachConnectHeader';
import { useTheme } from '../../shared/ui/ThemeContext';
import { useCoachSpeech } from '../voice/useVoiceToCoach';
import { useCoachComposerInput } from '../hooks/useCoachComposerInput';
import CoachPasteSheet from '../components/CoachPasteSheet';
import { AI_COACH_UI } from '../aiCoachUiTokens';
import { deleteAiChatSession } from '../persistence/saveCoachMessagesToFirestore';
import {
  buildHourlyCanHelpWith,
  buildHourlySpotlightSuggestions,
  getCoachHourSlot,
} from '../chat-thread/coachQuickPrompts';

const { width: SW, height: SH } = Dimensions.get('window');
const CARD_BORDER = AI_COACH_UI.gradient.borderWarm;
const BORDER_SUBTLE = ['rgba(157,23,77,0.42)', 'rgba(154,52,18,0.36)'];
const CTA_GRADIENT = AI_COACH_UI.gradient.ctaWarm;
const COMPOSER_SEND_GRAD = AI_COACH_UI.gradient.composerSend;
const COMPOSER_SEND_GRAD_LIGHT = AI_COACH_UI.gradient.composerSendLight;
const HERO_INNER = AI_COACH_UI.heroInner;
const SIDEBAR_WIDTH = Math.min(320, SW * 0.86);

// Action shortcuts — generic openers (Log / Web / My Data / Photo).
const COACH_ACTIONS = [
  {
    id: 'log',
    label: 'Log',
    icon: 'add-circle-outline',
    starter: 'Can you log data for me?',
    rim: ['#FF6B9D', '#C084FC'],
    labelGrad: ['#FF6B9D', '#C084FC'],
  },
  {
    id: 'web',
    label: 'Web',
    icon: 'globe-outline',
    starter: 'Can you search the web for me?',
    rim: ['#06B6D4', '#3B82F6'],
    labelGrad: ['#22D3EE', '#3B82F6'],
  },
  {
    id: 'data',
    label: 'My Data',
    icon: 'stats-chart-outline',
    starter: 'Can you show me my data and context?',
    rim: ['#A78BFA', '#C084FC'],
    labelGrad: ['#C084FC', '#E9D5FF'],
  },
  {
    id: 'photo',
    label: 'Photo',
    icon: 'image-outline',
    starter: 'Can you analyze a photo for me?',
    rim: ['#F97316', '#FBBF24'],
    labelGrad: ['#F97316', '#FBBF24'],
  },
];

function iconForPrompt(text) {
  const s = String(text || '').toLowerCase();
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

function GradientActionLabel({ colors, children, style, fallbackColor }) {
  if (!colors?.length || colors.length < 2) {
    return <Text style={[style, { color: fallbackColor }]}>{children}</Text>;
  }
  return (
    <MaskedView
      maskElement={
        <Text style={[style, { backgroundColor: 'transparent' }]}>{children}</Text>
      }
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <Text style={[style, { opacity: 0 }]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
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
      accessibilityLabel={action.label}
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
            borderRadius: 24,
            padding: 1.5,
            ...(Platform.OS === 'ios' && isDark
              ? { shadowColor: rim[0], shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }
              : null),
            elevation: isDark ? 7 : 2,
          }}
        >
          <View
            style={{
              flex: 1,
              borderRadius: 22.5,
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
        <GradientActionLabel
          colors={isDark ? action.labelGrad : null}
          fallbackColor={isDark ? 'rgba(255,255,255,0.78)' : 'rgba(10,10,15,0.72)'}
          style={{
            marginTop: 8,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.2,
          }}
        >
          {action.label}
        </GradientActionLabel>
      </Animated.View>
    </Pressable>
  );
};

const CAN_HELP_CARD_WIDTH = SW - 32;

const CanHelpWithCarousel = ({ items, isDark, t, onPress }) => {
  const list = (items || []).filter(Boolean);
  const [index, setIndex] = useState(0);
  const listRef = useRef(null);

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
        ref={listRef}
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
            <LinearGradient
              colors={item.rim || BORDER_SUBTLE}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ borderRadius: 18, padding: 1.5 }}
            >
              <View
                style={{
                  borderRadius: 16.5,
                  paddingVertical: 16,
                  paddingHorizontal: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  backgroundColor: isDark ? AI_COACH_UI.surface : '#FFFFFF',
                  borderWidth: 1,
                  borderColor: isDark ? AI_COACH_UI.borderHairline : 'rgba(15,23,42,0.08)',
                  minHeight: 88,
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
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(10,10,15,0.06)',
                  }}
                >
                  <Ionicons name={item.icon} size={22} color={item.accent || AI_COACH_UI.pink} />
                </View>
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
            </LinearGradient>
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
        <LinearGradient
          colors={BORDER_SUBTLE}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ borderRadius: 18, padding: 1.5 }}
        >
          <View
            style={{
              borderRadius: 16.5,
              paddingVertical: 16,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              backgroundColor: isDark ? AI_COACH_UI.surface : '#FFFFFF',
              borderWidth: 1,
              borderColor: isDark ? AI_COACH_UI.borderHairline : 'rgba(15,23,42,0.08)',
              minHeight: 88,
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
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(10,10,15,0.06)',
              }}
            >
              <Ionicons name={iconName} size={22} color={isDark ? '#FF6B9D' : '#BE185D'} />
            </View>
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
        </LinearGradient>
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
          <Text style={{ fontSize: 26, fontWeight: '900', color: t.textPrimary, textAlign: 'center' }}>
            Good Morning, <Text style={{ color: AI_COACH_UI.pink }}>{safeName}!</Text>
          </Text>

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

          <Text
            style={{
              marginTop: 14,
              fontSize: 44,
              fontWeight: '900',
              color: AI_COACH_UI.pink,
              textAlign: 'center',
              letterSpacing: 0.4,
              lineHeight: 48,
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            AI Coach
          </Text>

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

const toSessionDateLabel = (d) => {
  try {
    const date = d?.toDate?.() instanceof Date ? d.toDate() : d instanceof Date ? d : null;
    if (!date) return '';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

function formatSessionDisplayTitle(title) {
  let s = String(title || 'Chat')
    .replace(/\{[\s\S]*?\}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) s = 'Chat';
  if (s.length <= 30) return s.replace(/[-–—]\s*$/, '').replace(/\s+\d+$/, '').trim() || 'Chat';
  const slice = s.slice(0, 30);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = (lastSpace > 10 ? slice.slice(0, lastSpace) : slice)
    .replace(/[-–—]\s*$/, '')
    .replace(/\s+\d+$/, '')
    .trim();
  return cut || 'Chat';
}

function groupSessionsForSidebar(sessions) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = startOfToday - 6 * 86400000;
  const groups = [
    { key: 'today', label: 'Today', items: [] },
    { key: 'week', label: 'This Week', items: [] },
    { key: 'earlier', label: 'Earlier', items: [] },
  ];
  (sessions || []).forEach((s) => {
    const ms = s.updatedAtMs || 0;
    if (ms >= startOfToday) groups[0].items.push(s);
    else if (ms >= startOfWeek) groups[1].items.push(s);
    else groups[2].items.push(s);
  });
  return groups.filter((g) => g.items.length > 0);
}

// ─── Sidebar (slides from left) ───────────────────────────────────────────────
function Sidebar({ open, onClose, sessions, onSessionPress, onDeleteSession, isDark, insets }) {
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: open ? 0 : -SIDEBAR_WIDTH,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [open, slideAnim]);

  const labelColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(10,10,15,0.5)';
  const titleColor = isDark ? '#FFFFFF' : '#0A0A0F';
  const metaColor = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(10,10,15,0.45)';

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <Animated.View
          style={{
            width: SIDEBAR_WIDTH,
            height: SH,
            transform: [{ translateX: slideAnim }],
            zIndex: 2,
          }}
        >
          <LinearGradient
            colors={BORDER_SUBTLE}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height: 2 }}
          />
          <LinearGradient
            colors={isDark ? HERO_INNER : ['#F8FAFF', '#FFFFFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ flex: 1, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.08)' }}
          >
            <View
              style={{
                paddingTop: (insets?.top || 0) + 12,
                paddingHorizontal: 18,
                paddingBottom: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View>
                <Text style={{ color: labelColor, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
                  AI Coach
                </Text>
                <Text style={{ color: titleColor, fontSize: 20, fontWeight: '800', marginTop: 2 }}>Chat History</Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={8}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                }}
              >
                <Ionicons name="close" size={20} color={isDark ? '#FFFFFF' : '#0A0A0F'} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 24 + (insets?.bottom || 0) }}
              showsVerticalScrollIndicator={false}
            >
              {sessions.length === 0 ? (
                <View
                  style={{
                    marginTop: 40,
                    padding: 20,
                    borderRadius: 16,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  }}
                >
                  <Ionicons name="time-outline" size={26} color="rgba(255,255,255,0.55)" style={{ marginBottom: 10 }} />
                  <Text style={{ color: titleColor, fontSize: 15, fontWeight: '700' }}>No history yet</Text>
                  <Text style={{ color: metaColor, fontSize: 13, marginTop: 6, lineHeight: 18 }}>
                    Start a conversation below — your history will show up here.
                  </Text>
                </View>
              ) : (
                groupSessionsForSidebar(sessions).map((group) => (
                  <View key={group.key} style={{ marginBottom: 18 }}>
                    <Text
                      style={{
                        color: labelColor,
                        fontSize: 11,
                        fontWeight: '800',
                        letterSpacing: 0.9,
                        textTransform: 'uppercase',
                        marginBottom: 8,
                        paddingHorizontal: 4,
                      }}
                    >
                      {group.label}
                    </Text>
                    {group.items.map((s, i) => (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => {
                          onSessionPress(s);
                          onClose();
                        }}
                        activeOpacity={0.82}
                      >
                        <View
                          style={{
                            paddingVertical: 12,
                            paddingHorizontal: 4,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                          }}
                        >
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={{ color: titleColor, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                              {formatSessionDisplayTitle(s.title)}
                            </Text>
                            <Text style={{ color: metaColor, fontSize: 11, marginTop: 3 }}>{s.date}</Text>
                          </View>
                          <TouchableOpacity
                            onPress={(e) => {
                              if (e?.stopPropagation) e.stopPropagation();
                              onDeleteSession?.(s);
                            }}
                            activeOpacity={0.7}
                            hitSlop={8}
                            style={{ padding: 4 }}
                          >
                            <Ionicons name="trash-outline" size={16} color={metaColor} style={{ opacity: 0.45 }} />
                          </TouchableOpacity>
                        </View>
                        {i < group.items.length - 1 ? (
                          <View
                            style={{
                              height: StyleSheet.hairlineWidth,
                              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                            }}
                          />
                        ) : null}
                      </TouchableOpacity>
                    ))}
                  </View>
                ))
              )}
            </ScrollView>
          </LinearGradient>
        </Animated.View>

        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}
          activeOpacity={1}
          onPress={onClose}
        />
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AIChatHomeScreen({
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
  const [attachments, setAttachments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [userData, setUserData] = useState(null);
  const [hourSlot, setHourSlot] = useState(getCoachHourSlot());

  const composer = useCoachComposerInput('');
  const {
    value: inputText,
    onChangeText: setInputText,
    clear: clearComposer,
    commitText,
    applySpeechTranscript,
    openPasteSheet,
    closePasteSheet,
    pasteSheetVisible,
    inputRef: composerInputRef,
  } = composer;

  const canHelpItems = buildHourlyCanHelpWith({ now: hourSlot * 60 * 60 * 1000 });
  const suggestions = buildHourlySpotlightSuggestions({
    userData,
    sessions,
    now: hourSlot * 60 * 60 * 1000,
  });

  const t = isDark ? DARK : LIGHT;
  const userName = String(userData?.name || userData?.displayName || userData?.firstName || 'there').trim() || 'there';
  const shellNavPad = hideBottomNav ? BOTTOM_NAV_BAR_HEIGHT + insets.bottom : 0;
  // ─── Load + transition animations (UI only) ─────────────────────────────────
  const screenOpacity = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const inputOpacity = useRef(new Animated.Value(0)).current;
  const inputTranslateY = useRef(new Animated.Value(10)).current;
  const idleGroupOpacity = useRef(new Animated.Value(1)).current;
  const idleGroupTranslateY = useRef(new Animated.Value(0)).current;

  const { listening, toggleListen } = useCoachSpeech({
    onPartialTranscript: applySpeechTranscript,
    onFinalTranscript: applySpeechTranscript,
  });

  useEffect(() => {
    Animated.timing(screenOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    Animated.timing(headerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();

    Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.timing(inputOpacity, { toValue: 1, duration: 300, useNativeDriver: false }),
        Animated.timing(inputTranslateY, { toValue: 0, duration: 300, useNativeDriver: false }),
      ]),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const tick = setInterval(() => {
      const next = getCoachHourSlot();
      setHourSlot((prev) => (prev !== next ? next : prev));
    }, 60000);
    return () => clearInterval(tick);
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
      setSessions([]);
      return undefined;
    }

    const q = query(
      collection(db, 'users', userId, 'aiChats'),
      orderBy('updatedAt', 'desc'),
      limit(25)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((d) => {
          const data = d.data() || {};
          return {
            id: d.id,
            sessionId: data.sessionId || d.id,
            title: data.title || 'Chat',
            lastUserMessage: typeof data.lastUserMessage === 'string' ? data.lastUserMessage : '',
            lastAssistantMessage: typeof data.lastAssistantMessage === 'string' ? data.lastAssistantMessage : '',
            date: toSessionDateLabel(data.updatedAt) || toSessionDateLabel(data.createdAt) || '',
            updatedAtMs:
              data.updatedAt?.toDate?.()?.getTime?.() ||
              data.createdAt?.toDate?.()?.getTime?.() ||
              0,
          };
        });
        setSessions(next);
      },
      () => {
        setSessions([]);
      }
    );

    return () => unsub();
  }, [userId]);

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

  const openAttachMenu = () => {
    showCoachAttachMenu({
      onPhotoLibrary: handlePhotoLibrary,
      onCamera: handleCamera,
      onFile: handleFile,
    });
  };

  const handleActionPress = (action) => {
    if (action.id === 'photo') {
      handleCamera();
      return;
    }
    handleStartChat(action.starter);
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
    clearComposer();
    setAttachments([]);
  };

  return (
    <Animated.View style={{ flex: 1, backgroundColor: t.bg, opacity: screenOpacity }}>
      {/* Header (fixed) */}
      <Animated.View style={{ opacity: headerOpacity, zIndex: 30 }}>
        <CoachConnectHeader
          title="AI Coach"
          isDark={isDark}
          headerLeft={
            <ChatHistoryHeaderButton compact isDark={isDark} onPress={() => setSidebarOpen(true)} />
          }
          onProfilePress={onProfilePress}
          onSettingsPress={onSettingsPress}
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 + shellNavPad, paddingHorizontal: 16 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Centered hero content */}
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
            <View style={{ width: '100%', alignItems: 'flex-start', marginBottom: 4 }}>
              <Text style={{ fontSize: 24, fontWeight: '900', color: t.textPrimary, letterSpacing: -0.4 }}>
                {(() => {
                  const h = new Date().getHours();
                  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
                  return `${greet}, `;
                })()}
                <Text style={{ color: AI_COACH_UI.pink }}>{userName}!</Text>
              </Text>
            </View>

            <CanHelpWithCarousel
              items={canHelpItems}
              isDark={isDark}
              t={t}
              onPress={handleStartChat}
            />

            <View style={{ width: '100%', marginTop: 24 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '800',
                  letterSpacing: 1.1,
                  textTransform: 'uppercase',
                  color: isDark ? 'rgba(255,255,255,0.42)' : 'rgba(10,10,15,0.42)',
                  marginBottom: 14,
                }}
              >
                What do you need?
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
                {COACH_ACTIONS.map((action) => (
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
          </Animated.View>
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
            paddingBottom: 8 + shellNavPad,
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
              ref={composerInputRef}
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
              onLongPress={openPasteSheet}
              placeholder="Ask your coach..."
              placeholderTextColor={t.textMuted}
              returnKeyType="send"
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
              onPress={handleSend}
              disabled={!canSend}
              activeOpacity={0.85}
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
        </Animated.View>
      </KeyboardAvoidingView>

      <CoachPasteSheet
        visible={pasteSheetVisible}
        onClose={closePasteSheet}
        onConfirm={commitText}
        t={t}
        isDark={isDark}
      />

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sessions={sessions}
        onSessionPress={onSessionPress}
        onDeleteSession={handleDeleteSession}
        isDark={isDark}
        insets={insets}
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
    </Animated.View>
  );
}

