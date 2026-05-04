/**
 * AIChatScreen.jsx — React Native
 * Converted from Lovable export (lovable-export-d5e2ed71)
 *
 * Place at: src/aiChat/screens/AIChatScreen.jsx
 * Replaces: VoiceAIChatScreen.jsx
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Modal,
  ScrollView,
  Image,
  Dimensions,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../app/config';
import CoachConnectHeader from '../../shared/components/CoachConnectHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import { useTheme } from '../../shared/ui/ThemeContext';
import Markdown from 'react-native-markdown-display';
import { getApiBase } from '../../shared/services/baseUrl';

const GRAD = ['#7C3AED', '#EC4899'];
const { width: SW } = Dimensions.get('window');
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

// ─── Theme tokens (same as home screen) ──────────────────────────────────────
const DARK = {
  bg: '#0A0A0F',
  cardBg: 'rgba(255,255,255,0.05)',
  cardBorder: 'rgba(255,255,255,0.08)',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.5)',
  textMuted: 'rgba(255,255,255,0.3)',
  inputBg: 'rgba(255,255,255,0.05)',
  inputBorder: 'rgba(255,255,255,0.08)',
  divider: 'rgba(255,255,255,0.05)',
  chipBg: 'rgba(255,255,255,0.07)',
  chipBorder: 'rgba(255,255,255,0.12)',
  inputBarBg: '#0C0C14',
  inputBarBorder: 'rgba(255,255,255,0.08)',
  aiBubbleBg: 'rgba(255,255,255,0.1)',
  aiBubbleBorder: 'rgba(255,255,255,0.15)',
  msgReceivedBg: 'rgba(255,255,255,0.07)',
  msgReceivedBorder: 'rgba(255,255,255,0.1)',
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

function shouldUseWebAuto(userText) {
  const raw = String(userText || '');
  const t = raw.toLowerCase();
  if (!t.trim()) return false;

  const keywords = [
    'latest',
    'today',
    'this week',
    'this month',
    '2025',
    '2026',
    'news',
    'update',
    'price',
    'cost',
    'release',
    'version',
    'study',
    'research',
    'meta-analysis',
    'paper',
    'source',
    'cite',
    'link',
    'near me',
    'restaurant',
    'menu',
    'nutrition facts',
    'calories in',
  ];
  if (keywords.some((k) => t.includes(k))) return true;

  const hasNumbers = /\d/.test(t);
  const long = t.length >= 120;
  const hasQuoted = /"[^"]{6,}"/.test(raw);
  return (long && hasNumbers) || hasQuoted;
}

// ─── Feature explanation cards (inline in AI messages) ────────────────────────
const FEATURE_COLORS = {
  analysis: '#C084FC', // purple
  generation: '#FF6B9D', // pink
  optimization: '#06B6D4', // cyan
  goals: '#10B981', // green
  tracking: '#F97316', // orange
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

async function postAICoach(payload) {
  const base = String(getApiBase() || '').replace(/\/$/, '');
  const url = `${base}/api/ai-coach`;
  console.log('[AIChat] requesting URL:', url);

  // Send DeepSeek key via header so server can use DeepSeek without server .env
  const deepseekKey =
    process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY ||
    null;

  const headers = { 'Content-Type': 'application/json' };
  if (deepseekKey && typeof deepseekKey === 'string' && deepseekKey.trim().length > 0) {
    headers['x-deepseek-key'] = deepseekKey.trim();
  }

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  if (!response.ok) {
    console.error('[AIChat] /api/ai-coach non-200:', response.status, url);
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  return response.json();
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
function TypingIndicator({ t, searchingWeb }) {
  const anims = [
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
  ];

  useEffect(() => {
    // Keep these JS-driven to avoid native-driver node reuse issues during Fast Refresh.
    const animations = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: false }),
          Animated.timing(anim, { toValue: 0.3, duration: 400, useNativeDriver: false }),
        ])
      )
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [anims]);

  return (
    <View style={{ marginBottom: 12 }}>
      {searchingWeb ? (
        <View style={{ flexDirection: 'row', marginBottom: 8 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 14,
              paddingVertical: 10,
              backgroundColor: t.aiBubbleBg,
              borderWidth: 1,
              borderColor: t.aiBubbleBorder,
              borderRadius: 18,
              borderBottomLeftRadius: 4,
            }}
          >
            <Ionicons name="globe-outline" size={16} color={t.textSecondary} />
            <Text style={{ color: t.textSecondary, fontSize: 13, fontWeight: '600' }}>Searching the web…</Text>
          </View>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 14,
            paddingVertical: 12,
            backgroundColor: t.aiBubbleBg,
            borderWidth: 1,
            borderColor: t.aiBubbleBorder,
            borderRadius: 18,
            borderBottomLeftRadius: 4,
          }}
        >
          {anims.map((anim, i) => (
            <Animated.View
              key={i}
              style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.textMuted, opacity: anim }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Action Sheet ─────────────────────────────────────────────────────────────
function AttachActionSheet({ visible, onClose, onPhotoLibrary, onCamera, onFile, t }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
        activeOpacity={1}
        onPress={onClose}
      />
      <View
        style={{
          backgroundColor: t.cardBg === '#FFFFFF' ? '#FFFFFF' : 'rgba(20,20,30,0.98)',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderWidth: 1,
          borderColor: t.cardBorder,
          paddingBottom: insets.bottom + 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
        }}
      >
        {/* Handle bar */}
        <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: t.textMuted }} />
        </View>

        {[
          { label: 'Photo Library', icon: 'image-outline', action: onPhotoLibrary },
          { label: 'Camera', icon: 'camera-outline', action: onCamera },
          { label: 'File', icon: 'document-outline', action: onFile },
        ].map((item, i) => (
          <TouchableOpacity
            key={item.label}
            onPress={() => {
              item.action();
              onClose();
            }}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              paddingHorizontal: 24,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: t.divider,
            }}
          >
            <Ionicons name={item.icon} size={22} color={t.textSecondary} />
            <Text style={{ fontSize: 16, color: t.textPrimary, fontWeight: '500' }}>{item.label}</Text>
          </TouchableOpacity>
        ))}

        {/* Cancel */}
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.7}
          style={{ paddingHorizontal: 24, paddingVertical: 16, alignItems: 'center' }}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#EF4444' }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({ message, t }) {
  const sent = message.role === 'user';
  const atts = Array.isArray(message.attachments) ? message.attachments : [];
  const firstImage = atts.find((a) => a?.preview);
  const firstFile = !firstImage ? atts.find((a) => a && !a.preview) : null;
  const hasText = !!String(message.text || '').trim();

  const renderContent = () => {
    if (!hasText && firstImage?.preview) {
      return <Image source={{ uri: firstImage.preview }} style={{ width: 220, height: 160 }} resizeMode="cover" />;
    }
    if (!hasText && firstFile) {
      return (
        <View style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name="document-outline" size={28} color={sent ? '#ffffff' : t.textPrimary} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: sent ? '#ffffff' : t.textPrimary }} numberOfLines={1}>
              {firstFile.name || 'File'}
            </Text>
            <Text style={{ fontSize: 11, marginTop: 2, color: sent ? 'rgba(255,255,255,0.6)' : t.msgTimestamp }} numberOfLines={1}>
              Tap to view
            </Text>
          </View>
        </View>
      );
    }
    if (sent) {
      return <Text style={{ color: '#ffffff', fontSize: 14, lineHeight: 20 }}>{String(message.text || '')}</Text>;
    }
    return (
      <Markdown
        style={{
          body: { color: t.textPrimary, fontSize: 14, lineHeight: 20 },
          strong: { color: t.textPrimary, fontWeight: '800' },
          em: { color: t.textPrimary },
          paragraph: { marginTop: 0, marginBottom: 8 },
          list_item: { marginTop: 2, marginBottom: 2 },
          bullet_list: { marginBottom: 8 },
          ordered_list: { marginBottom: 8 },
          code_inline: {
            color: t.textPrimary,
            backgroundColor: t.chipBg,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 6,
          },
        }}
      >
        {String(message.text || '')}
      </Markdown>
    );
  };

  const wrapStyle = { maxWidth: '75%' };
  const bubbleBase = { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12 };
  const attachmentOnly = !hasText && (firstImage || firstFile);
  const mediaStyle = attachmentOnly ? { paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' } : null;

  if (sent) {
    return (
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 }}>
        <View style={wrapStyle}>
          <LinearGradient
            colors={GRAD}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[bubbleBase, { borderBottomRightRadius: 4 }, mediaStyle]}
          >
            {renderContent()}
          </LinearGradient>
          <Text style={{ fontSize: 11, marginTop: 4, color: t.msgTimestamp, textAlign: 'right' }}>{message.time}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 12 }}>
      <View style={wrapStyle}>
        <View
          style={[
            bubbleBase,
            {
              borderWidth: 1,
              borderColor: t.msgReceivedBorder,
              backgroundColor: t.msgReceivedBg,
              borderBottomLeftRadius: 4,
            },
            mediaStyle,
          ]}
        >
          {renderContent()}
        </View>
        <Text style={{ fontSize: 11, marginTop: 4, color: t.msgTimestamp, textAlign: 'left' }}>{message.time}</Text>
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
  onBack,
  openAttachmentsOnMount = false,
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
  const t = isDark ? DARK : LIGHT;
  const NAV_HEIGHT = 80 + (insets.bottom || 0); // matches BottomNavBar minHeight
  const INPUT_BAR_BASE_HEIGHT = 64; // approximate row height (padding + controls)
  const flatListRef = useRef(null);
  const prefillSent = useRef(false);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [searchingWeb, setSearchingWeb] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [sessionId] = useState(initialSessionId || `aiChat_${Date.now()}`);
  const [loadedSession, setLoadedSession] = useState(!initialSessionId);
  const [activeFeatureCards, setActiveFeatureCards] = useState([]);
  const featureTimers = useRef([]);

  const canSend = input.trim().length > 0 || attachments.length > 0;
  const [isInputFocused, setIsInputFocused] = useState(false);
  const inputBorderAnim = useRef(new Animated.Value(0)).current;
  const inputScale = useRef(new Animated.Value(1)).current;
  const sendPress = useRef(new Animated.Value(0)).current;
  const micPulse = useRef(new Animated.Value(0)).current;
  const [micActive, setMicActive] = useState(false);
  const kb = useRef(new Animated.Value(0)).current; // keyboard height

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

  const handleMicPress = () => {
    setMicActive(true);
    try {
      onVoicePress?.();
    } finally {
      setTimeout(() => setMicActive(false), 2200);
    }
  };

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

  const scrollToBottom = () => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!db || !userId || !initialSessionId) {
        setLoadedSession(true);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', userId, 'aiChats', initialSessionId));
        if (!snap.exists()) {
          if (!cancelled) setLoadedSession(true);
          return;
        }
        const data = snap.data() || {};
        const saved = Array.isArray(data.messages) ? data.messages : [];
        const restored = saved
          .filter((m) => m && typeof m === 'object')
          .map((m, idx) => ({
            id: `msg_restored_${idx}`,
            role: m.role === 'ai' ? 'ai' : 'user',
            text: typeof m.content === 'string' ? m.content : '',
            time: typeof m.time === 'string' ? m.time : now(),
            source: m.source || null,
          }))
          .filter((m) => m.text.trim().length > 0);

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

    const plannedWeb = shouldUseWebAuto(text);
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
    setInput('');
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
        const title = deriveChatTitle(text);
        await setDoc(
          doc(db, 'users', userId, 'aiChats', sessionId),
          {
            sessionId,
            title,
            ...(isFirstMessage ? { createdAt: serverTimestamp() } : {}),
            updatedAt: serverTimestamp(),
            messages: updatedMessages.map((m) => ({
              role: m.role,
              content: m.text,
              time: m.time,
              source: m.source || null,
            })),
          },
          { merge: true }
        );
      }

      const data = await postAICoach({
        userId,
        userProfile: userProfile || {},
        options: { web: 'auto' },
        messages: updatedMessages.map((m) => ({
          role: m.role === 'ai' ? 'assistant' : 'user',
          content: m.text,
        })),
      });
      const aiText = (data && data.reply) || 'Sorry, I could not get a response. Please try again.';

      const aiMsg = {
        id: `msg_${Date.now() + 1}`,
        role: 'ai',
        text: aiText,
        time: now(),
        source: data.source,
        webProvider: data.usedWeb ? (data.webProvider || (data.source === 'perplexity' ? 'perplexity' : null)) : null,
        featureCards: plannedCards,
      };

      const finalMessages = [...updatedMessages, aiMsg];
      setMessages(finalMessages);

      if (db && userId) {
        await setDoc(
          doc(db, 'users', userId, 'aiChats', sessionId),
          {
            sessionId,
            title: deriveChatTitle(finalMessages.find((m) => m.role === 'user')?.text || ''),
            updatedAt: serverTimestamp(),
            messages: finalMessages.map((m) => ({
              role: m.role,
              content: m.text,
              time: m.time,
              source: m.source || null,
            })),
          },
          { merge: true }
        );
      }
    } catch (err) {
      console.error('AI coach error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_err_${Date.now()}`,
          role: 'ai',
          text: 'Could not reach the server. Check your connection and try again.',
          time: now(),
          featureCards: plannedCards,
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
    if (loadedSession && prefill && !prefillSent.current) {
      prefillSent.current = true;
      setTimeout(() => sendMessage(prefill), 300);
    }
  }, [prefill, loadedSession]);

  useEffect(() => {
    if (loadedSession && openAttachmentsOnMount) {
      setShowActionSheet(true);
    }
  }, [loadedSession, openAttachmentsOnMount]);

  const handlePhotoLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      const assets = Array.isArray(result.assets) ? result.assets : [];
      const newAtts = assets.map((a) => ({
        id: `att_${Date.now()}_${Math.random()}`,
        preview: a.uri,
        name: a.fileName || 'image.jpg',
        type: 'image',
      }));
      if (newAtts.length > 0) setAttachments((prev) => [...prev, ...newAtts]);
    }
  };

  const handleCamera = async () => {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) {
      const a = result.assets[0];
      setAttachments((prev) => [...prev, { id: `att_${Date.now()}`, preview: a.uri, name: 'photo.jpg', type: 'image' }]);
    }
  };

  const handleFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true });
    if (result.type !== 'cancel') {
      const assets = Array.isArray(result.assets) ? result.assets : [];
      const newAtts = assets.map((a) => ({
        id: `att_${Date.now()}_${Math.random()}`,
        name: a.name,
        uri: a.uri,
        type: 'file',
      }));
      if (newAtts.length > 0) setAttachments((prev) => [...prev, ...newAtts]);
    }
  };

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
      <View style={{ paddingTop: insets.top }}>
        <CoachConnectHeader
          title="AI Coach"
          isDark={isDark}
          onBack={onBack}
          onProfilePress={onProfilePress}
          onSettingsPress={onSettingsPress}
        />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}
      >
        {messages.length === 0 && !typing ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <LottieView
              source={require('../../assets/Lotties for Anatrox/Cloud robotics abstract.json')}
              autoPlay
              loop
              style={{ width: 120, height: 120 }}
            />
            <Text style={{ color: t.textSecondary, fontSize: 14, marginTop: 16 }}>Ask me anything to get started.</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item, index }) => (
              <MessageBubble message={item} t={t} />
            )}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: 16 + NAV_HEIGHT + INPUT_BAR_BASE_HEIGHT + (attachments.length > 0 ? 76 : 0),
            }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToBottom}
            // Regular messaging UI: no feature cards / web typing banners.
          />
        )}

        {/* Fixed input/attachments bar ABOVE BottomNavBar - MUST BE ANIMATED.VIEW FOR TRANSFORM */}
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: NAV_HEIGHT,
            backgroundColor: 'transparent',
            paddingTop: attachments.length > 0 ? 8 : 8,
            paddingHorizontal: 12,
            paddingBottom: 6,
            transform: [{ translateY: Animated.multiply(kb, -1) }],
            zIndex: 5,
          }}
        >
          {attachments.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingBottom: 10 }}
            >
              {attachments.map((att) => (
                <View key={att.id} style={{ position: 'relative' }}>
                  {att.preview ? (
                    <Image source={{ uri: att.preview }} style={{ width: 56, height: 56, borderRadius: 10 }} resizeMode="cover" />
                  ) : (
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 10,
                        backgroundColor: t.chipBg,
                        borderWidth: 1,
                        borderColor: t.chipBorder,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="document-outline" size={20} color={t.textSecondary} />
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={() => removeAttachment(att.id)}
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: t.textSecondary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="close" size={12} color={t.bg} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 56 }}>
            <Pressable
              onPress={() => setShowActionSheet(true)}
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

            <Animated.View style={{ flex: 1, transform: [{ scale: inputScale }] }}>
              <View style={{ width: '100%', borderRadius: 28, overflow: 'hidden' }}>
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

                  <View
                    style={{
                      borderRadius: 26.5,
                      minHeight: 56,
                      maxHeight: 120,
                      paddingLeft: 18,
                      paddingRight: 44,
                      paddingVertical: 10,
                      justifyContent: 'center',
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
                      style={StyleSheet.absoluteFill}
                    />
                    <TextInput
                      value={input}
                      onChangeText={setInput}
                      placeholder="Ask your coach..."
                      placeholderTextColor={isDark ? '#808080' : '#999999'}
                      multiline
                      style={{
                        fontSize: 15,
                        color: isDark ? '#FFFFFF' : '#333333',
                        lineHeight: 20,
                        fontStyle: input ? 'normal' : 'italic',
                      }}
                      cursorColor="#FF6B9D"
                      onFocus={() => setIsInputFocused(true)}
                      onBlur={() => setIsInputFocused(false)}
                      returnKeyType="send"
                    />

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

            <Pressable
              onPress={() => sendMessage(input, attachments)}
              disabled={!canSend}
              onPressIn={() => Animated.spring(sendPress, { toValue: 1, useNativeDriver: false, speed: 30, bounciness: 0 }).start()}
              onPressOut={() => Animated.spring(sendPress, { toValue: 0, useNativeDriver: false, speed: 30, bounciness: 0 }).start()}
              style={{ opacity: canSend ? 1 : 0.4 }}
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
                <LinearGradient colors={['#FF6B9D', '#E91E63']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
                </LinearGradient>
              </Animated.View>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>

      <AttachActionSheet
        visible={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        onPhotoLibrary={handlePhotoLibrary}
        onCamera={handleCamera}
        onFile={handleFile}
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
    </View>
  );
}

