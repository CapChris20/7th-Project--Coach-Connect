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
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Modal,
  ScrollView,
  Image,
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

async function postAICoach(payload) {
  const base = String(getApiBase() || '').replace(/\/$/, '');
  const url = `${base}/api/ai-coach`;
  console.log('[AIChat] requesting URL:', url);

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const animations = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
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
function MessageBubble({ message, t, showAiCoachLabel }) {
  const isUser = message.role === 'user';
  return (
    <View style={{ flexDirection: 'row', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
      <View style={{ maxWidth: '80%' }}>
        {!isUser && showAiCoachLabel ? (
          <Text
            style={{
              fontSize: 11,
              fontWeight: '600',
              color: '#C084FC',
              marginBottom: 4,
              marginLeft: 4,
              letterSpacing: 0.3,
            }}
          >
            CoachConnect AI
          </Text>
        ) : null}

        {message.attachments && message.attachments.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
            {message.attachments.map((att) =>
              att.preview ? (
                <Image
                  key={att.id}
                  source={{ uri: att.preview }}
                  style={{ width: 120, height: 90, borderRadius: 10 }}
                  resizeMode="cover"
                />
              ) : (
                <View
                  key={att.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                    borderRadius: 8,
                    backgroundColor: isUser ? 'rgba(255,255,255,0.15)' : t.chipBg,
                  }}
                >
                  <Ionicons name="document-outline" size={14} color={isUser ? '#fff' : t.textSecondary} />
                  <Text style={{ fontSize: 12, color: isUser ? '#fff' : t.textPrimary }} numberOfLines={1}>
                    {att.name}
                  </Text>
                </View>
              )
            )}
          </View>
        )}

        {message.text ? (
          isUser ? (
            <LinearGradient
              colors={GRAD}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ paddingHorizontal: 16, paddingVertical: 14, borderRadius: 18, borderBottomRightRadius: 4 }}
            >
              <Text style={{ fontSize: 14, lineHeight: 21, color: '#FFFFFF' }}>{message.text}</Text>
            </LinearGradient>
          ) : (
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 14,
                backgroundColor: t.aiBubbleBg,
                borderWidth: 1,
                borderColor: t.aiBubbleBorder,
                borderRadius: 18,
                borderBottomLeftRadius: 4,
              }}
            >
              <Markdown
                style={{
                  body: { color: t.textPrimary, fontSize: 14, lineHeight: 21 },
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
                {String(message.text)}
              </Markdown>
            </View>
          )
        ) : null}

        {!isUser && message.webProvider ? (
          <Text style={{ fontSize: 10, color: t.textMuted, marginTop: 6 }}>
            Web: {message.webProvider === 'serper' ? 'Search' : 'Perplexity'}
          </Text>
        ) : null}

        <Text style={{ fontSize: 11, color: t.textMuted, marginTop: 4, textAlign: isUser ? 'right' : 'left' }}>
          {message.time}
        </Text>
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

  const canSend = input.trim().length > 0 || attachments.length > 0;

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

  const sendMessage = async (text, atts = []) => {
    if (!text.trim() && atts.length === 0) return;

    const plannedWeb = shouldUseWebAuto(text);
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
        userProfile,
        options: { web: 'auto' },
        messages: updatedMessages.map((m) => ({
          role: m.role === 'ai' ? 'assistant' : 'user',
          content: m.text,
        })),
      });
      const aiText = data.reply || 'Sorry, I could not get a response. Please try again.';

      const aiMsg = {
        id: `msg_${Date.now() + 1}`,
        role: 'ai',
        text: aiText,
        time: now(),
        source: data.source,
        webProvider: data.usedWeb ? (data.webProvider || (data.source === 'perplexity' ? 'perplexity' : null)) : null,
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
        },
      ]);
    } finally {
      setTyping(false);
      setSearchingWeb(false);
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
      const newAtts = result.assets.map((a) => ({
        id: `att_${Date.now()}_${Math.random()}`,
        preview: a.uri,
        name: a.fileName || 'image.jpg',
        type: 'image',
      }));
      setAttachments((prev) => [...prev, ...newAtts]);
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
    if (result.type !== 'cancel' && result.assets) {
      const newAtts = result.assets.map((a) => ({
        id: `att_${Date.now()}_${Math.random()}`,
        name: a.name,
        uri: a.uri,
        type: 'file',
      }));
      setAttachments((prev) => [...prev, ...newAtts]);
    }
  };

  const removeAttachment = (id) => setAttachments((prev) => prev.filter((a) => a.id !== id));

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingTop: insets.top }}>
        <CoachConnectHeader
          title="COACHCONNECT AI"
          isDark={isDark}
          onBack={onBack}
          onProfilePress={onProfilePress}
          onSettingsPress={onSettingsPress}
        />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
              <MessageBubble
                message={item}
                t={t}
                showAiCoachLabel={item.role === 'ai' && (index === 0 || messages[index - 1]?.role !== 'ai')}
              />
            )}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToBottom}
            ListFooterComponent={typing ? <TypingIndicator t={t} searchingWeb={searchingWeb} /> : null}
          />
        )}

        {attachments.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ backgroundColor: t.inputBarBg, paddingHorizontal: 16, paddingTop: 10 }}
            contentContainerStyle={{ gap: 8 }}
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

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 10,
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: insets.bottom + 12,
            backgroundColor: t.inputBarBg,
            borderTopWidth: 1,
            borderTopColor: t.inputBarBorder,
          }}
        >
          <TouchableOpacity onPress={() => setShowActionSheet(true)} activeOpacity={0.7} style={{ marginBottom: 8 }}>
            <Ionicons name="add-circle-outline" size={24} color={t.textSecondary} />
          </TouchableOpacity>

          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Message CoachConnect AI..."
            placeholderTextColor={t.textMuted}
            multiline
            style={{
              flex: 1,
              minHeight: 40,
              maxHeight: 120,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 20,
              backgroundColor: t.inputBg,
              borderWidth: 1,
              borderColor: t.inputBorder,
              fontSize: 14,
              color: t.textPrimary,
              lineHeight: 20,
            }}
          />

          <TouchableOpacity
            onPress={() => sendMessage(input, attachments)}
            disabled={!canSend}
            activeOpacity={0.85}
            style={{ width: 36, height: 36, borderRadius: 18, overflow: 'hidden', marginBottom: 2 }}
          >
            {canSend ? (
              <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
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
                  borderRadius: 18,
                }}
              >
                <Ionicons name="arrow-up" size={18} color={t.textMuted} />
              </View>
            )}
          </TouchableOpacity>
        </View>
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
      />
    </View>
  );
}

