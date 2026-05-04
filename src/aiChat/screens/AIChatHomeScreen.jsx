/**
 * AIChatHomeScreen.jsx — React Native
 * Converted from Lovable export (lovable-export-d5e2ed71)
 *
 * Place at: src/aiChat/screens/AIChatHomeScreen.jsx
 * Replaces: VoiceAIHomeScreen.jsx
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Animated,
  Platform,
  Dimensions,
  Keyboard,
  Modal,
  Alert,
  KeyboardAvoidingView,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import { collection, doc, deleteDoc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../app/config';
import BottomNavBar from '../../navigation/BottomNavBar';
import CoachConnectHeader from '../../shared/components/CoachConnectHeader';
import { useTheme } from '../../shared/ui/ThemeContext';

const { width: SW, height: SH } = Dimensions.get('window');
const ACCENT = '#3B82F6';

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
  sidebarBorder: 'rgba(255,255,255,0.1)',
  divider: 'rgba(255,255,255,0.05)',
  headerBg: '#000000',
  inputBarBg: 'rgba(0,0,0,0.92)',
  accent: ACCENT,
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
  accent: ACCENT,
};

const BASE_SUGGESTIONS = [
  'Build me a workout for this week',
  'How much protein do I need?',
  'What does research say about skinny fat?',
  'Fix my squat form',
  'Best supplements for muscle gain',
  'How do I recover faster?',
  'Build me a 4-day hypertrophy plan',
  'What should I eat today?',
  'Explain progressive overload',
  'I skipped the gym — help me get back',
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

function buildDynamicSuggestions({ userData, sessions }) {
  const suggestions = [];

  const goal = String(userData?.primaryGoal || userData?.goal || userData?.fitnessGoal || '').toLowerCase();
  const dietPref = String(userData?.dietPreference || userData?.diet || '').toLowerCase();

  if (goal.includes('lose') || goal.includes('fat')) {
    suggestions.push('Give me a fat-loss plan (workout + macros) for this week');
    suggestions.push('What calorie deficit should I use without losing muscle?');
  } else if (goal.includes('muscle') || goal.includes('build')) {
    suggestions.push('Build me a hypertrophy split + weekly progression');
    suggestions.push('How much protein do I need to gain muscle?');
  } else if (goal.includes('athletic') || goal.includes('performance')) {
    suggestions.push('Give me an athletic performance plan (strength + conditioning)');
    suggestions.push('How should I program conditioning without killing my lifts?');
  }

  if (dietPref.includes('vegan')) suggestions.push('Give me a vegan high-protein meal plan idea');
  if (dietPref.includes('keto')) suggestions.push('How do I do keto without tanking my training?');

  const recentTitles = (sessions || []).slice(0, 6).map((s) => String(s?.title || '').trim()).filter(Boolean);
  const titleText = recentTitles.join(' | ').toLowerCase();
  if (titleText.includes('recomp') || titleText.includes('skinny fat')) {
    suggestions.push('What’s the best plan for body recomposition (skinny fat)?');
  }
  if (titleText.includes('macros') || titleText.includes('calories')) {
    suggestions.push('Recalculate my macros for today based on my goal');
  }
  if (titleText.includes('creatine')) {
    suggestions.push('Creatine: dose, timing, and what to expect');
  }
  if (titleText.includes('zero sugar')) {
    suggestions.push('Are zero-sugar drinks okay daily? Pros/cons');
  }

  const final = uniqueTake([...suggestions, ...BASE_SUGGESTIONS], 4);
  return final.length === 4 ? final : uniqueTake([...final, ...BASE_SUGGESTIONS], 4);
}

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

const HeroWelcomeCard = ({
  t,
  isDark,
  userName,
  borderAnim,
}) => {
  const safeName = String(userName || 'there').trim() || 'there';
  // Keep interior opaque so border gradient doesn't tint the fill.
  const cardInnerBg = isDark ? '#0A0A0F' : '#FFFFFF';
  const borderColors = isDark
    ? ['#E91E63', '#FF6B9D', '#C084FC', '#FF6B9D']
    : ['#3B82F6', '#6366F1', '#EC4899', '#3B82F6'];

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
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
          }}
        >
          <Text style={{ fontSize: 26, fontWeight: '900', color: t.textPrimary, textAlign: 'center' }}>
            Good Morning, <Text style={{ color: '#FF6B9D' }}>{safeName}!</Text>
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
            <View style={{ width: 86, height: 4, borderRadius: 999, backgroundColor: '#C084FC', marginTop: 10 }} />
          </View>

          <Text
            style={{
              marginTop: 14,
              fontSize: 44,
              fontWeight: '900',
              color: '#FF6B9D',
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

const SuggestionPill = ({ text, t, onPress, borderAnim, index }) => {
  const borderColors = ['#3B82F6', '#6366F1', '#EC4899', '#3B82F6'];
  const pillWidth = Math.max(140, Math.floor((SW - 16 * 2 - 10) / 2));
  const translateX = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-pillWidth, 0],
  });

  const innerBg = t?.bg === '#000000' ? '#0A0A0F' : '#FFFFFF';

  return (
    <View style={{ width: '48%', borderRadius: 999, overflow: 'hidden' }}>
      <TouchableOpacity onPress={() => onPress(text)} activeOpacity={0.85} style={{ borderRadius: 999, overflow: 'hidden' }}>
        {/* Border line only */}
        <View style={{ padding: 2, borderRadius: 999, overflow: 'hidden' }}>
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <AnimatedLinearGradient
              colors={borderColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: pillWidth * 2,
                height: '100%',
                transform: [{ translateX }],
              }}
            />
          </View>
          <View
            style={{
              minHeight: 56,
              borderRadius: 999,
              paddingHorizontal: 16,
              paddingVertical: 14,
              backgroundColor: innerBg,
              borderWidth: 1,
              borderColor: t?.bg === '#000000' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '500', color: t.textPrimary }} numberOfLines={2}>
              {text}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
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

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ open, onClose, sessions, onSessionPress, onDeleteSession, t }) {
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: open ? 0 : 300,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [open, slideAnim]);

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
        activeOpacity={1}
        onPress={onClose}
      />
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 300,
          height: SH,
          backgroundColor: t.sidebarBg,
          borderLeftWidth: 1,
          borderLeftColor: t.sidebarBorder,
          transform: [{ translateX: slideAnim }],
          paddingTop: 56,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingBottom: 16,
          }}
        >
          <Text style={{ color: t.textPrimary, fontSize: 16, fontWeight: '700' }}>Recent Chats</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={20} color={t.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1, paddingHorizontal: 20 }}>
          {sessions.length === 0 ? (
            <Text style={{ color: t.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 48 }}>
              No chats yet. Start a conversation below.
            </Text>
          ) : (
            sessions.map((s, i) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => {
                  onSessionPress(s);
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <View style={{ paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.textPrimary, fontSize: 14 }} numberOfLines={1}>
                      {s.title}
                    </Text>
                    <Text style={{ color: t.textMuted, fontSize: 11, marginTop: 2 }}>{s.date}</Text>
                  </View>

                  <TouchableOpacity
                    onPress={(e) => {
                      // Prevent opening the chat when deleting
                      if (e?.stopPropagation) e.stopPropagation();
                      onDeleteSession?.(s);
                    }}
                    activeOpacity={0.7}
                    hitSlop={8}
                    style={{
                      padding: 6,
                      borderRadius: 10,
                      backgroundColor: t.chipBg,
                      borderWidth: 1,
                      borderColor: t.chipBorder,
                    }}
                  >
                    <Ionicons name="trash-outline" size={16} color={t.textSecondary} />
                  </TouchableOpacity>
                </View>
                {i < sessions.length - 1 && <View style={{ height: 1, backgroundColor: t.divider }} />}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AIChatHomeScreen({
  userId,
  onStartChat,
  onAttachPress,
  onSessionPress,
  onHomePress,
  onPlusPress,
  onVoicePress,
  onNutritionPress,
  onWorkoutPress,
  onMessagesPress,
  onProfilePress,
  onSettingsPress,
}) {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sessions, setSessions] = useState([]);
  const [userData, setUserData] = useState(null);
  const [suggestions, setSuggestions] = useState(BASE_SUGGESTIONS.slice(0, 4));

  const t = isDark ? DARK : LIGHT;
  const userName = String(userData?.name || userData?.displayName || userData?.firstName || 'there').trim() || 'there';
  // Keep the floating input bar *above* the bottom tab bar (BottomNavBar uses minHeight 80 + safe-area).
  const NAV_HEIGHT = 80 + (insets.bottom || 0);
  const NAV_GAP = 12; // extra breathing room so it never blocks tab taps

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

  const inputFocused = useRef(new Animated.Value(0)).current; // 0 -> 1
  const sendPulse = useRef(new Animated.Value(0)).current;    // 0 -> 1
  const inputBorderAnim = useRef(new Animated.Value(0)).current; // 0 -> 1 (loop)
  const inputScale = useRef(new Animated.Value(1)).current; // 1 -> 1.02
  const sendPress = useRef(new Animated.Value(0)).current; // 0 -> 1
  const micPulse = useRef(new Animated.Value(0)).current; // 0 -> 1
  const kb = useRef(new Animated.Value(0)).current; // keyboard height
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [micActive, setMicActive] = useState(false);

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

  useEffect(() => {
    Animated.timing(inputFocused, { toValue: isInputFocused ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }, [isInputFocused, inputFocused]);

  useEffect(() => {
    let loop;
    if (isInputFocused) {
      loop = Animated.loop(Animated.timing(inputBorderAnim, { toValue: 1, duration: 2000, useNativeDriver: false }));
      loop.start();
      Animated.spring(inputScale, { toValue: 1.02, useNativeDriver: false, speed: 18, bounciness: 10 }).start();
    } else {
      inputBorderAnim.stopAnimation();
      inputBorderAnim.setValue(0);
      Animated.spring(inputScale, { toValue: 1, useNativeDriver: false, speed: 18, bounciness: 10 }).start();
    }
    return () => loop?.stop?.();
  }, [isInputFocused, inputBorderAnim, inputScale]);

  useEffect(() => {
    if (!micActive) {
      micPulse.stopAnimation();
      micPulse.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(micPulse, { toValue: 1, duration: 500, useNativeDriver: false }),
        Animated.timing(micPulse, { toValue: 0, duration: 500, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [micActive, micPulse]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e) => {
      const h = e?.endCoordinates?.height ?? 0;
      Animated.timing(kb, { toValue: h, duration: Platform.OS === 'ios' ? 250 : 180, useNativeDriver: false }).start();
    };
    const onHide = () => {
      Animated.timing(kb, { toValue: 0, duration: Platform.OS === 'ios' ? 250 : 180, useNativeDriver: false }).start();
    };

    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [kb]);

  useEffect(() => {
    const hasText = !!inputText.trim();
    if (!hasText) {
      sendPulse.stopAnimation();
      sendPulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sendPulse, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(sendPulse, { toValue: 0, duration: 400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [inputText, sendPulse]);

  const handleMicPress = () => {
    setMicActive(true);
    try {
      onVoicePress?.();
    } finally {
      // Visual pulse only; if you wire real recording state later, replace this timer.
      setTimeout(() => setMicActive(false), 2200);
    }
  };

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
            await deleteDoc(doc(db, 'users', userId, 'aiChats', sessionId));
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
            date: toSessionDateLabel(data.updatedAt) || toSessionDateLabel(data.createdAt) || '',
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

  useEffect(() => {
    setSuggestions(buildDynamicSuggestions({ userData, sessions }));
  }, [userData, sessions]);

  const handleStartChat = (prefill) => {
    // UI-only smooth transition: fade out hero/cards quickly, then navigate using existing handler.
    Animated.parallel([
      Animated.timing(idleGroupOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(idleGroupTranslateY, { toValue: -6, duration: 200, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onStartChat?.({ prefill });
    });
  };

  const handleSend = () => {
    if (inputText.trim()) {
      handleStartChat(inputText.trim());
      setInputText('');
    }
  };

  const glowOpacity = inputFocused.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const glowBorderWidth = inputFocused.interpolate({ inputRange: [0, 1], outputRange: [1, 2] });
  const glowBorderColor = inputFocused.interpolate({ inputRange: [0, 1], outputRange: [t.border, t.accent] });
  const glowBg = inputFocused.interpolate({
    inputRange: [0, 1],
    outputRange: [t.glassBg, isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'],
  });

  return (
    <Animated.View style={{ flex: 1, backgroundColor: t.bg, opacity: screenOpacity }}>
      {/* Header (fixed) */}
      <Animated.View style={{ paddingTop: insets.top, opacity: headerOpacity, zIndex: 30 }}>
        <CoachConnectHeader
          title="AI Coach"
          isDark={isDark}
          onProfilePress={onProfilePress}
          onSettingsPress={onSettingsPress}
        />
        {/* Overlay hamburger (theme is changed via Settings) */}
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            top: insets.top + 8,
            height: 56,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <TouchableOpacity
            onPress={() => setSidebarOpen(true)}
            activeOpacity={0.7}
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="menu-outline" size={22} color={t.textPrimary} />
          </TouchableOpacity>
          <View style={{ width: 40, height: 40 }} />
        </View>
      </Animated.View>

      {/* Main content container (flex) */}
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          // leave room for bottom input + nav so content doesn't sit behind it
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 160, paddingHorizontal: 16 }}
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
                source={require('../../assets/Lotties for Anatrox/Cloud robotics abstract.json')}
                autoPlay
                loop
                style={{ width: '100%', height: '100%' }}
              />
            </Animated.View>

            {/* Suggestions */}
            <View style={{ width: '100%', marginTop: 16 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 }}>
                {(suggestions || []).slice(0, 4).map((s, i) => (
                  <SuggestionPill
                    key={s}
                    text={s}
                    index={i}
                    t={t}
                    onPress={handleStartChat}
                    borderAnim={pillBorderAnim}
                  />
                ))}
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </View>

      {/* Fixed input bar (OUTSIDE any KeyboardAvoidingView or ScrollView) */}
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: NAV_HEIGHT + NAV_GAP, // push above BottomNavBar so it never overlays the nav icons
          paddingHorizontal: 12,
          paddingTop: 6,
          paddingBottom: 6,
          backgroundColor: 'transparent',
          opacity: inputOpacity,
          transform: [{ translateY: Animated.multiply(kb, -1) }], // Only keyboard height, not combined
          zIndex: 5,
        }}
      >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 56 }}>
            {/* Attach (keep existing functionality) */}
            <Pressable
              onPress={() => onAttachPress?.()}
              style={({ pressed }) => [
                {
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: pressed ? 'rgba(255,107,157,0.10)' : 'transparent',
                  borderWidth: 1,
                  borderColor: '#FF6B9D',
                },
              ]}
            >
              <Ionicons name="add" size={24} color="#FF6B9D" />
            </Pressable>

            {/* Input */}
            <Animated.View style={{ flex: 1, transform: [{ scale: inputScale }] }}>
              <View style={{ width: '100%', borderRadius: 28, overflow: 'hidden' }}>
                {/* Gradient border (line only) */}
                <View style={{ padding: 1.5, borderRadius: 28, overflow: 'hidden' }}>
                  <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                    <AnimatedLinearGradient
                      colors={['#FF6B9D', '#C084FC', '#FF6B9D']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        width: SW * 2,
                        height: '100%',
                        transform: [
                          {
                            translateX: inputBorderAnim.interpolate({ inputRange: [0, 1], outputRange: [-SW, 0] }),
                          },
                        ],
                        opacity: isInputFocused ? 1 : 0.7,
                      }}
                    />
                  </View>

                  {/* Solid fill + subtle tint (prevents border gradient bleeding into fill) */}
                  <View
                    style={{
                      borderRadius: 26.5,
                      height: 56,
                      justifyContent: 'center',
                      paddingLeft: 18,
                      paddingRight: 44, // room for mic
                      overflow: 'hidden',
                      backgroundColor: isDark ? '#0A0A0F' : '#FFFFFF',
                    }}
                  >
                    <LinearGradient
                      colors={
                        isDark
                          ? ['rgba(255,107,157,0.08)', 'rgba(192,132,252,0.08)']
                          : ['rgba(255,107,157,0.06)', 'rgba(192,132,252,0.06)']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[StyleSheet.absoluteFill, { opacity: 1 }]}
                    />
                    <TextInput
                      value={inputText}
                      onChangeText={setInputText}
                      onSubmitEditing={handleSend}
                      placeholder="Ask your coach..."
                      placeholderTextColor={isDark ? '#808080' : '#999999'}
                      style={{
                        fontSize: 15,
                        color: isDark ? '#FFFFFF' : '#333333',
                        fontStyle: inputText ? 'normal' : 'italic',
                      }}
                      cursorColor="#FF6B9D"
                      multiline={false}
                      onFocus={() => setIsInputFocused(true)}
                      onBlur={() => setIsInputFocused(false)}
                      returnKeyType="send"
                    />

                    {/* Mic inside input */}
                    <Pressable
                      onPress={handleMicPress}
                      style={({ pressed }) => [
                        {
                          position: 'absolute',
                          right: 10,
                          top: 12,
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          alignItems: 'center',
                          justifyContent: 'center',
                          transform: [{ scale: pressed ? 0.9 : 1 }],
                        },
                      ]}
                      hitSlop={10}
                    >
                      <Animated.View style={{ opacity: micActive ? micPulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) : 1 }}>
                        <Ionicons name="mic" size={18} color="#FF6B9D" />
                      </Animated.View>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Send */}
            <Pressable
              onPress={handleSend}
              disabled={!inputText.trim()}
              onPressIn={() => Animated.spring(sendPress, { toValue: 1, useNativeDriver: false, speed: 30, bounciness: 0 }).start()}
              onPressOut={() => Animated.spring(sendPress, { toValue: 0, useNativeDriver: false, speed: 30, bounciness: 0 }).start()}
              style={{ opacity: inputText.trim() ? 1 : 0.4 }}
            >
              <Animated.View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  overflow: 'hidden',
                  transform: [{ scale: sendPress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] }) }],
                  shadowColor: '#FF6B9D',
                  shadowOpacity: sendPress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.65] }),
                  shadowRadius: sendPress.interpolate({ inputRange: [0, 1], outputRange: [12, 18] }),
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 10,
                }}
              >
                <LinearGradient
                  colors={['#FF6B9D', '#E91E63']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Animated.View
                    style={{
                      transform: [
                        {
                          scale: inputText.trim()
                            ? sendPulse.interpolate({ inputRange: [0, 1], outputRange: [1.03, 1.07] })
                            : 1,
                        },
                      ],
                    }}
                  >
                    <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
                  </Animated.View>
                </LinearGradient>
              </Animated.View>
            </Pressable>
          </View>
        </Animated.View>

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sessions={sessions}
        onSessionPress={onSessionPress}
        onDeleteSession={handleDeleteSession}
        t={t}
      />

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
    </Animated.View>
  );
}

