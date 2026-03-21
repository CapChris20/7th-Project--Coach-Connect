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
  ScrollView,
  Animated,
  Platform,
  Dimensions,
  Modal,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import { collection, doc, deleteDoc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../app/config';
import CoachConnectHeader from '../../shared/components/CoachConnectHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import { useTheme } from '../../shared/ui/ThemeContext';

const { height: SH } = Dimensions.get('window');
const GRAD = ['#7C3AED', '#EC4899'];

// ─── Theme tokens ─────────────────────────────────────────────────────────────
const DARK = {
  bg: '#0A0A0F',
  cardBg: 'rgba(255,255,255,0.05)',
  cardBorder: 'rgba(255,255,255,0.08)',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.5)',
  textMuted: 'rgba(255,255,255,0.3)',
  inputBg: 'rgba(255,255,255,0.05)',
  inputBorder: 'rgba(255,255,255,0.08)',
  sidebarBg: '#0C0C14',
  sidebarBorder: 'rgba(255,255,255,0.08)',
  divider: 'rgba(255,255,255,0.05)',
  glowColor: 'rgba(192,132,252,0.18)',
  chipBg: 'rgba(255,255,255,0.07)',
  chipBorder: 'rgba(255,255,255,0.12)',
  inputBarBg: '#0C0C14',
  inputBarBorder: 'rgba(255,255,255,0.08)',
  toggleBg: 'rgba(255,255,255,0.08)',
  toggleBorder: 'rgba(255,255,255,0.12)',
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
  sidebarBg: '#FFFFFF',
  sidebarBorder: '#E5E7EB',
  divider: 'rgba(0,0,0,0.06)',
  glowColor: 'rgba(124,58,237,0.08)',
  chipBg: 'rgba(0,0,0,0.04)',
  chipBorder: 'rgba(0,0,0,0.1)',
  inputBarBg: '#FFFFFF',
  inputBarBorder: '#E5E7EB',
  toggleBg: 'rgba(0,0,0,0.06)',
  toggleBorder: 'rgba(0,0,0,0.1)',
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
    onStartChat?.({ prefill });
  };

  const handleSend = () => {
    if (inputText.trim()) {
      handleStartChat(inputText.trim());
      setInputText('');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingTop: insets.top }}>
        <CoachConnectHeader
          title="COACHCONNECT AI"
          isDark={isDark}
          onProfilePress={onProfilePress}
          onSettingsPress={onSettingsPress}
        />
      </View>

      {/* Local actions row (menu + new chat) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 }}>
        <TouchableOpacity onPress={() => setSidebarOpen(true)} activeOpacity={0.7}>
          <Ionicons name="menu-outline" size={22} color={t.textSecondary} />
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity onPress={() => handleStartChat(undefined)} activeOpacity={0.7}>
            <Ionicons name="create-outline" size={22} color={t.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 32, paddingHorizontal: 24 }}>
          <View
            style={{
              position: 'absolute',
              width: 240,
              height: 240,
              borderRadius: 120,
              backgroundColor: isDark ? 'rgba(26,5,51,0.6)' : 'rgba(124,58,237,0.04)',
              top: 16,
            }}
          />

          <View style={{ alignItems: 'center', justifyContent: 'center', width: 180, height: 180, marginBottom: 20 }}>
            <View
              style={{
                position: 'absolute',
                width: 180,
                height: 180,
                borderRadius: 90,
                backgroundColor: t.glowColor,
              }}
            />
            <LottieView
              source={require('../../assets/Lotties for Anatrox/Cloud robotics abstract.json')}
              autoPlay
              loop
              style={{ width: 180, height: 180 }}
            />
          </View>

          <Text style={{ fontSize: 24, fontWeight: '800', color: t.textPrimary, textAlign: 'center', marginBottom: 10 }}>
            Your AI fitness coach
          </Text>
          <Text style={{ fontSize: 14, color: t.textSecondary, textAlign: 'center', maxWidth: 280, lineHeight: 21 }}>
            Get personalized workout plans, nutrition advice, and form corrections instantly.
          </Text>
        </View>

        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: t.textMuted, marginBottom: 10 }}>
            SUGGESTED
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 0, gap: 8, paddingBottom: 4 }}
          >
            {suggestions.map((chip) => (
              <TouchableOpacity
                key={chip}
                onPress={() => handleStartChat(chip)}
                activeOpacity={0.8}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 50,
                  backgroundColor: t.chipBg,
                  borderWidth: 1,
                  borderColor: t.chipBorder,
                  flexShrink: 0,
                }}
              >
                <Text style={{ fontSize: 13, color: t.textPrimary }} numberOfLines={1} ellipsizeMode="tail">
                  {chip}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      <View
        style={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 16,
          paddingTop: 12,
          backgroundColor: t.inputBarBg,
          borderTopWidth: 1,
          borderTopColor: t.inputBarBorder,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <TouchableOpacity
            onPress={() => onAttachPress?.()}
            activeOpacity={0.7}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: t.chipBg,
              borderWidth: 1,
              borderColor: t.chipBorder,
            }}
          >
            <Ionicons name="add" size={22} color={t.textSecondary} />
          </TouchableOpacity>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
            placeholder="Ask your AI coach..."
            placeholderTextColor={t.textMuted}
            style={{
              flex: 1,
              height: 44,
              paddingHorizontal: 16,
              borderRadius: 22,
              backgroundColor: t.inputBg,
              borderWidth: 1,
              borderColor: t.inputBorder,
              fontSize: 14,
              color: t.textPrimary,
            }}
            returnKeyType="send"
          />
          <TouchableOpacity onPress={handleSend} activeOpacity={0.85} style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }}>
            {inputText.trim() ? (
              <LinearGradient
                colors={GRAD}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
              </LinearGradient>
            ) : (
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: t.chipBg,
                  borderWidth: 1,
                  borderColor: t.chipBorder,
                  borderRadius: 22,
                }}
              >
                <Ionicons name="arrow-up" size={20} color={t.textMuted} />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

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
      />
    </View>
  );
}

