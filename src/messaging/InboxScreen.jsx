// InboxScreen — glass list of chat threads for clients and trainers.
// Flow: load unread + conversations → filter by role/blocked/selected client → open a thread or start coach chat.
// Used by: messaging tab / trainer client inbox. Firebase paths stay under conversations + users.

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import BlurredBackground from '../look-and-feel/BlurredBackground';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { auth, db } from '../app-start/cloudConnection';
import {
  subscribeToConversations,
  subscribeToUnreadByConversation,
  fetchMoreConversations,
} from '../ai-coach/past-chats/loadOlderChats';
import { getTrainerClients, createOrUpdateClient } from '../trainer-app/my-trainees/traineeList';
import { getOrCreateConversation, markMessagesAsRead } from '../ai-coach/coach-actions/alertTrainer';
import { doc, getDoc } from 'firebase/firestore';
import TopHeader from '../for-both/loading-and-header/TopHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FORM_SCROLL_PROPS, useShellBottomNavInset } from '../navigation/bottomMenuSpacing';
import { blockedList } from '../block-and-report/blockedList';

// ===== NAMED CONSTANTS =====

// Manipulate here: dark vs light glass palette for the inbox list.
const DARK = {
  bg: ['#0a0a1a', '#1a0825', '#0d1117'],
  glass: 'rgba(255,255,255,0.05)',
  glassBorder: 'rgba(255,255,255,0.08)',
  textPrimary: '#ffffff',
  textMuted: 'rgba(255,255,255,0.5)',
  textTimestamp: 'rgba(255,255,255,0.4)',
};
const LIGHT = {
  bg: ['#fdf2f8', '#f5f0ff', '#ecfeff'],
  glass: 'rgba(0,0,0,0.04)',
  glassBorder: 'rgba(0,0,0,0.08)',
  textPrimary: '#1e1040',
  textMuted: 'rgba(30,16,64,0.55)',
  textTimestamp: 'rgba(30,16,64,0.45)',
};
const GRADIENT = {
  separator: ['#FF6B9D', '#F97316', 'transparent'],
  badge: ['#FF6B9D', '#F97316'],
};

// Manipulate here: relative-time buckets for the thread timestamp column.
const MS_PER_MINUTE = 60000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;
const MINUTES_PER_MONTH_APPROX = 43200;

// Manipulate here: bottom shell clearance, delayed coach-thread ensure, unread UI re-check.
const SHELL_BOTTOM_NAV_INSET = 24;
const ENSURE_CLIENT_CONVERSATION_DELAY_MS = 1000;
const UNREAD_COUNT_RECHECK_MS = 500;

const DEFAULT_AVATAR_SIZE = 48;
const UNREAD_BADGE_CAP = 99;
const BLUR_INTENSITY_IOS = 20;
const PRIMARY_FALLBACK = '#6C5CE7';
const PLATFORM_IOS = 'ios';

// ===== HELPER FUNCTIONS =====

/**
 * Turn a Firestore timestamp (or Date-ish value) into a short relative label.
 * vocab: toDate = Firestore Timestamp helper that returns a JS Date
 * @param {*} timestamp
 * @returns {string|null}
 */
function formatTimestamp(timestamp) {
  if (!timestamp) return null;
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return null;
    const now = new Date();
    const diffMs = now - date;
    const minutesAgo = Math.floor(diffMs / MS_PER_MINUTE);
    if (minutesAgo < 1) return 'Just now';
    if (minutesAgo < MINUTES_PER_HOUR) return `${minutesAgo}m ago`;
    if (minutesAgo < MINUTES_PER_DAY) {
      return `${Math.floor(minutesAgo / MINUTES_PER_HOUR)}h ago`;
    }
    if (minutesAgo < MINUTES_PER_MONTH_APPROX) {
      return `${Math.floor(minutesAgo / MINUTES_PER_DAY)}d ago`;
    }
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (error) {
    return null;
  }
}

/**
 * Preview line under the name — string, { text }, or String(fallback).
 * Flattened so the row renderer stays shallow (no else-if nest under if).
 * @param {object} conversation
 * @returns {string}
 */
function previewTextFromConversation(conversation) {
  const lastMessage = conversation?.lastMessage;
  if (!lastMessage) return 'No messages yet';
  if (typeof lastMessage === 'string') return lastMessage;
  if (typeof lastMessage === 'object' && lastMessage?.text) return String(lastMessage.text);
  return String(lastMessage);
}

/**
 * Sort key for a thread — prefer updatedAt millis when present.
 * vocab/symbol: ?? = use right side only when left is null/undefined
 * @param {object} conversation
 * @returns {number}
 */
function conversationSortTime(conversation) {
  return conversation?.updatedAt?.toMillis?.() ?? conversation?.updatedAt ?? 0;
}

/**
 * Load role + roster for the signed-in user (early returns keep nesting flat).
 * @param {string} userId
 * @returns {Promise<{isUserTrainer: boolean, clients: Array}>}
 */
async function loadTrainerRoleAndClients(userId) {
  const userSnap = await getDoc(doc(db, 'users', userId));
  if (!userSnap.exists()) return { isUserTrainer: false, clients: [] };

  const userData = userSnap.data();
  const isUserTrainer = userData.role === 'trainer';
  if (!isUserTrainer) return { isUserTrainer: false, clients: [] };

  const clients = await getTrainerClients(userId);
  return { isUserTrainer: true, clients };
}

/**
 * Clients: make sure a thread with their assigned trainer exists.
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function ensureAssignedTrainerConversation(userId) {
  const userSnap = await getDoc(doc(db, 'users', userId));
  if (!userSnap.exists()) return;

  const assignedTrainerId = userSnap.data()?.trainerId;
  if (!assignedTrainerId) return;

  await getOrCreateConversation(userId, assignedTrainerId);
}

/**
 * Build the payload we store when a trainer taps “+ Add” on a stranger thread.
 * @param {object} fullUserData
 * @returns {object}
 */
function buildClientPayloadFromUserData(fullUserData) {
  const clientName =
    fullUserData.name ||
    `${fullUserData.firstName || ''} ${fullUserData.lastName || ''}`.trim() ||
    fullUserData.displayName ||
    'Client';
  return {
    name: clientName,
    email: fullUserData.email || '',
    photoURL: fullUserData.photoURL || null,
    height: fullUserData.height || null,
    weight: fullUserData.weight || null,
    age: fullUserData.age || null,
    gender: fullUserData.gender || null,
    goals: fullUserData.primaryGoal || fullUserData.goals || '',
    fitnessLevel: fullUserData.fitnessLevel || null,
    equipmentAccess: fullUserData.equipmentAccess || [],
    daysPerWeek: fullUserData.daysPerWeek || null,
    injuries: fullUserData.injuries || null,
    phone: fullUserData.phone || null,
    bio: fullUserData.bio || null,
    role: fullUserData.role || 'client',
    createdAt: fullUserData.createdAt || null,
  };
}

/**
 * Mark a thread read, zero the badge locally, then re-zero after a short delay
 * in case the Firebase unread listener races.
 * @param {string} conversationId
 * @param {string} userId
 * @param {object} unreadByConversationId
 * @param {Function} setUnreadByConversationId
 * @returns {Promise<void>}
 */
async function markConversationReadAndClearBadge(
  conversationId,
  userId,
  unreadByConversationId,
  setUnreadByConversationId,
) {
  console.log('🔕 Marking messages as read for conversation:', conversationId);
  await markMessagesAsRead(conversationId, userId);
  console.log('✅ Messages marked as read, forcing unread count refresh');

  const clearedOnce = { ...unreadByConversationId };
  clearedOnce[conversationId] = 0;
  console.log('🔄 Immediately setting unread count to 0 for:', conversationId);
  setUnreadByConversationId(clearedOnce);

  // Manipulate here: UNREAD_COUNT_RECHECK_MS — second local clear after listener settle.
  setTimeout(() => {
    const clearedAgain = { ...unreadByConversationId };
    clearedAgain[conversationId] = 0;
    console.log('🔄 Double-checking unread count is 0 for:', conversationId);
    setUnreadByConversationId(clearedAgain);
  }, UNREAD_COUNT_RECHECK_MS);
}

/**
 * Frosted row chrome — BlurredBackground on iOS, plain View elsewhere.
 * @param {{ children: *, style?: object, contentWrapperStyle?: object, isDark: boolean }} props
 */
function GlassCard({ children, style, contentWrapperStyle, isDark }) {
  const themePalette = isDark ? DARK : LIGHT;
  const cardStyle = {
    backgroundColor: themePalette.glass,
    borderWidth: 1,
    borderColor: themePalette.glassBorder,
    borderRadius: 20,
    ...(Platform.OS === PLATFORM_IOS && {
      shadowColor: '#FF6B9D',
      shadowRadius: 12,
      shadowOpacity: 0.2,
      shadowOffset: { width: 0, height: 4 },
    }),
  };
  if (Platform.OS === PLATFORM_IOS) {
    return (
      <BlurredBackground
        intensity={BLUR_INTENSITY_IOS}
        tint={isDark ? 'dark' : 'light'}
        style={[cardStyle, style]}
        contentWrapperStyle={contentWrapperStyle}
      >
        {children}
      </BlurredBackground>
    );
  }
  return <View style={[cardStyle, style, contentWrapperStyle]}>{children}</View>;
}

/**
 * Initials-in-gradient avatar, or photo when photoURL is set.
 * @param {{ name?: string, photoURL?: string, size?: number }} props
 */
function GradientAvatar({ name, photoURL, size = DEFAULT_AVATAR_SIZE }) {
  const initials = (name || '?')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <LinearGradient
      colors={['#FF6B9D', '#C084FC']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {photoURL ? (
        <Image source={{ uri: photoURL }} style={{ width: size, height: size }} />
      ) : (
        <Text style={{ color: 'white', fontWeight: '700', fontSize: size * 0.28 }}>
          {initials}
        </Text>
      )}
    </LinearGradient>
  );
}

const rowStyles = StyleSheet.create({
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadText: { color: 'white', fontSize: 10, fontWeight: '700' },
  name: { fontSize: 15, fontWeight: '700', flex: 1 },
  timestamp: { fontSize: 11, marginLeft: 8, flexShrink: 0 },
  preview: { fontSize: 13, marginTop: 2 },
});

const screenStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 26, fontWeight: '800' },
  separator: { height: 1, marginHorizontal: 16, marginBottom: 4 },
  addBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginLeft: 8 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  clientBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  clientBadgeText: { color: '#22C55E', fontSize: 12, fontWeight: '700' },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 32,
  },
  emptyIconBox: {
    width: 76,
    height: 76,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 300 },
  emptyCta: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    minWidth: 200,
    alignItems: 'center',
  },
  emptyCtaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

// ===== MAIN FUNCTION =====

/**
 * Conversations list — live Firebase threads with trainer/client filtering and unread badges.
 * @param {{ onSelectConversation?: Function, onClose?: Function, onProfilePress?: Function, onSettingsPress?: Function, embedInLayout?: boolean, selectedClientId?: string }} props
 */
export default function InboxScreen({
  onSelectConversation,
  onClose,
  onProfilePress,
  onSettingsPress,
  embedInLayout,
  selectedClientId,
}) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const embedTopPad = embedInLayout ? Math.max(insets.top, 8) : 0;
  // Shell BottomMenuBar stays visible on the conversations list — reserve it.
  const shellBottomPad = useShellBottomNavInset(SHELL_BOTTOM_NAV_INSET);
  const embedBottomPad = embedInLayout ? shellBottomPad : 0;
  const themePalette = isDark ? DARK : LIGHT;
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [participantNames, setParticipantNames] = useState({});
  const [participantData, setParticipantData] = useState({});
  const [unreadByConversationId, setUnreadByConversationId] = useState({});
  const [isTrainer, setIsTrainer] = useState(false);
  const [trainerClients, setTrainerClients] = useState([]);
  const [addingClient, setAddingClient] = useState({});
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [loadingMoreConversations, setLoadingMoreConversations] = useState(false);
  const [listError, setListError] = useState(null);
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const [startingChat, setStartingChat] = useState(false);
  const lastConversationDocRef = useRef(null);
  const currentUser = auth.currentUser;
  const { blockedIds } = blockedList(currentUser?.uid);

  // Live unread badge map keyed by conversation id.
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = subscribeToUnreadByConversation(currentUser.uid, (byConv) => {
      console.log('🔔 Unread counts updated:', byConv);
      setUnreadByConversationId(byConv || {});
    });
    return () => unsub();
  }, [currentUser?.uid]);

  // Detect trainer role and load roster (flat helper — no nested if/try depth).
  useEffect(() => {
    if (!currentUser || !db) return;
    const runRoleCheck = async () => {
      try {
        const result = await loadTrainerRoleAndClients(currentUser.uid);
        setIsTrainer(result.isUserTrainer);
        if (result.isUserTrainer) setTrainerClients(result.clients);
      } catch (error) {
        console.error('Error checking trainer role:', error);
      }
    };
    runRoleCheck();
  }, [currentUser]);

  // Real-time conversation list (+ retry bump via listRefreshKey).
  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    setListError(null);
    const unsubscribe = subscribeToConversations(
      currentUser.uid,
      ({
        conversations: list,
        participantNames: names,
        participantData: data,
        lastDoc,
        hasMore,
        error,
      }) => {
        setConversations(list || []);
        setParticipantNames(names || {});
        setParticipantData(data || {});
        lastConversationDocRef.current = lastDoc ?? null;
        setHasMoreConversations(Boolean(hasMore));
        setListError(error || null);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [currentUser, listRefreshKey]);

  // One thread per other person; hide blocked / non-clients / wrong selected client.
  const filteredConversations = useMemo(() => {
    if (!conversations.length) return [];
    const clientIds = new Set((trainerClients || []).map((client) => client.id));
    const newestByOtherUser = new Map();

    for (const thread of conversations) {
      const otherId = thread.participants?.find((id) => id && id !== currentUser?.uid);
      if (!otherId) continue;
      // Hide threads with people the user blocked (Settings → Blocked users to undo)
      if (blockedIds?.has(otherId)) continue;
      // If a specific client is selected, only show conversations with that client
      if (selectedClientId && otherId !== selectedClientId) continue;
      if (isTrainer && clientIds.size > 0 && !clientIds.has(otherId)) continue;

      const time = conversationSortTime(thread);
      const previous = newestByOtherUser.get(otherId);
      if (!previous || time > previous.time) {
        newestByOtherUser.set(otherId, { thread, time });
      }
    }

    return Array.from(newestByOtherUser.values())
      .map(({ thread }) => thread)
      .sort((left, right) => conversationSortTime(right) - conversationSortTime(left));
  }, [
    conversations,
    isTrainer,
    trainerClients,
    currentUser?.uid,
    selectedClientId,
    blockedIds,
  ]);

  // Clients only: after a short delay, open/create the assigned-trainer thread.
  useEffect(() => {
    if (!currentUser || isTrainer) return;
    const timer = setTimeout(() => {
      ensureAssignedTrainerConversation(currentUser.uid).catch((error) => {
        console.error('Error ensuring client conversation:', error);
      });
    }, ENSURE_CLIENT_CONVERSATION_DELAY_MS);
    return () => clearTimeout(timer);
  }, [currentUser, isTrainer]);

  const handleAddAsClient = async (clientId, clientData, event) => {
    event?.stopPropagation?.();
    if (!currentUser || !isTrainer) return;
    setAddingClient((prev) => ({ ...prev, [clientId]: true }));
    try {
      const existingClients = await getTrainerClients(currentUser.uid);
      if (existingClients.some((client) => client.id === clientId)) {
        Alert.alert('Info', 'This person is already your client');
        setAddingClient((prev) => ({ ...prev, [clientId]: false }));
        return;
      }
      const userSnap = await getDoc(doc(db, 'users', clientId));
      const fullUserData = userSnap.exists() ? userSnap.data() : null;
      if (!fullUserData) {
        Alert.alert('Error', 'Could not load user data');
        setAddingClient((prev) => ({ ...prev, [clientId]: false }));
        return;
      }
      await createOrUpdateClient(
        clientId,
        currentUser.uid,
        buildClientPayloadFromUserData(fullUserData),
      );
      const updatedClients = await getTrainerClients(currentUser.uid);
      setTrainerClients(updatedClients);
      Alert.alert('Success', 'Client added successfully!');
    } catch (error) {
      console.error('Error adding client:', error);
      Alert.alert('Error', error?.message || 'Failed to add client.');
    } finally {
      setAddingClient((prev) => ({ ...prev, [clientId]: false }));
    }
  };

  const handleMessageCoach = async () => {
    if (!currentUser?.uid || startingChat) return;
    setStartingChat(true);
    try {
      const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
      const trainerId = userSnap.exists() ? userSnap.data()?.trainerId : null;
      if (!trainerId) {
        Alert.alert('No coach yet', 'Find a trainer in the app to start messaging.');
        return;
      }
      const conversationId = await getOrCreateConversation(currentUser.uid, trainerId);
      const conversationSnap = await getDoc(doc(db, 'conversations', conversationId));
      const trainerSnap = await getDoc(doc(db, 'users', trainerId));
      const trainerData = trainerSnap.exists() ? trainerSnap.data() : {};
      const conversation = conversationSnap.exists()
        ? { id: conversationId, ...conversationSnap.data() }
        : { id: conversationId, participants: [currentUser.uid, trainerId] };
      onSelectConversation?.(conversation, { id: trainerId, ...trainerData });
    } catch (error) {
      console.error('handleMessageCoach failed:', error);
      Alert.alert('Could not open chat', error?.message || 'Please try again.');
    } finally {
      setStartingChat(false);
    }
  };

  const renderEmptyState = () => {
    const filteredOut =
      !listError &&
      conversations.length > 0 &&
      filteredConversations.length === 0 &&
      isTrainer;

    if (listError) {
      return (
        <View style={screenStyles.emptyWrap}>
          <View
            style={[
              screenStyles.emptyIconBox,
              {
                borderColor: 'rgba(239,68,68,0.35)',
                backgroundColor: 'rgba(239,68,68,0.08)',
              },
            ]}
          >
            <Ionicons name="cloud-offline-outline" size={34} color="#f87171" />
          </View>
          <Text style={[screenStyles.emptyTitle, { color: themePalette.textPrimary }]}>
            Couldn't load messages
          </Text>
          <Text style={[screenStyles.emptySubtitle, { color: themePalette.textMuted }]}>
            Check your connection, then try again.
          </Text>
          <TouchableOpacity
            onPress={() => setListRefreshKey((key) => key + 1)}
            activeOpacity={0.85}
            style={{ marginTop: 20 }}
          >
            <LinearGradient
              colors={GRADIENT.badge}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={screenStyles.emptyCta}
            >
              <Text style={screenStyles.emptyCtaText}>Retry</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      );
    }

    if (filteredOut) {
      return (
        <View style={screenStyles.emptyWrap}>
          <Text style={[screenStyles.emptyTitle, { color: themePalette.textPrimary }]}>
            No client chats yet
          </Text>
          <Text style={[screenStyles.emptySubtitle, { color: themePalette.textMuted }]}>
            Conversations with people who aren't in your client list are hidden here.
          </Text>
        </View>
      );
    }

    return (
      <View style={screenStyles.emptyWrap}>
        <Text style={[screenStyles.emptyTitle, { color: themePalette.textPrimary }]}>
          No conversations yet
        </Text>
        <Text style={[screenStyles.emptySubtitle, { color: themePalette.textMuted }]}>
          {isTrainer
            ? 'Message a client from your roster, or add someone new from a chat.'
            : 'Say hi to your coach — your thread will show up here.'}
        </Text>
        {!isTrainer ? (
          <TouchableOpacity
            onPress={handleMessageCoach}
            disabled={startingChat}
            activeOpacity={0.85}
            style={{ marginTop: 20 }}
          >
            <LinearGradient
              colors={GRADIENT.badge}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={screenStyles.emptyCta}
            >
              {startingChat ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={screenStyles.emptyCtaText}>Message your coach</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const renderRow = ({ item: conversation }) => {
    if (!conversation?.participants) return null;
    const otherId = conversation.participants.find((id) => id !== currentUser?.uid);
    if (!otherId) return null;

    const name = participantNames[otherId] || 'User';
    const otherData = participantData[otherId] || {};
    const lastMessage = previewTextFromConversation(conversation);
    const timestamp =
      formatTimestamp(conversation.lastMessageTime) ||
      formatTimestamp(conversation.updatedAt) ||
      null;
    const isAlreadyClient = isTrainer && trainerClients.some((client) => client.id === otherId);
    const isAdding = addingClient[otherId];
    const unreadCount = unreadByConversationId[conversation.id] ?? 0;
    const showBell = unreadCount > 0;
    const unreadLabel = unreadCount > UNREAD_BADGE_CAP ? '99+' : unreadCount;

    return (
      <TouchableOpacity
        onPress={async () => {
          try {
            await markConversationReadAndClearBadge(
              conversation.id,
              auth.currentUser.uid,
              unreadByConversationId,
              setUnreadByConversationId,
            );
          } catch (error) {
            console.error('❌ Error marking messages as read:', error);
          }
          onSelectConversation?.(conversation, { id: otherId, ...otherData });
        }}
        activeOpacity={0.85}
        style={{ marginHorizontal: 16, marginBottom: 10 }}
      >
        <GlassCard
          isDark={isDark}
          contentWrapperStyle={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            minWidth: 0,
          }}
        >
          <View style={{ position: 'relative', flexShrink: 0 }}>
            <GradientAvatar name={name} photoURL={otherData.photoURL} size={DEFAULT_AVATAR_SIZE} />
            {showBell && (
              <LinearGradient colors={GRADIENT.badge} style={rowStyles.unreadBadge}>
                <Text style={rowStyles.unreadText}>{unreadLabel}</Text>
              </LinearGradient>
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text
                style={[rowStyles.name, { color: themePalette.textPrimary }]}
                numberOfLines={1}
              >
                {name}
              </Text>
              {timestamp ? (
                <Text style={[rowStyles.timestamp, { color: themePalette.textTimestamp }]}>
                  {timestamp}
                </Text>
              ) : null}
            </View>
            <Text style={[rowStyles.preview, { color: themePalette.textMuted }]} numberOfLines={1}>
              {lastMessage}
            </Text>
          </View>
          {isTrainer && !isAlreadyClient && (
            <TouchableOpacity
              onPress={(pressEvent) => handleAddAsClient(otherId, otherData, pressEvent)}
              disabled={!!isAdding}
              style={[
                screenStyles.addBtn,
                { backgroundColor: colors?.primary ?? PRIMARY_FALLBACK },
              ]}
            >
              {isAdding ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={screenStyles.addBtnText}>+ Add</Text>
              )}
            </TouchableOpacity>
          )}
        </GlassCard>
      </TouchableOpacity>
    );
  };

  const loadMoreConversations = async () => {
    if (!currentUser?.uid || loadingMoreConversations || !lastConversationDocRef.current) return;
    setLoadingMoreConversations(true);
    try {
      const page = await fetchMoreConversations(
        currentUser.uid,
        lastConversationDocRef.current,
      );
      if (page.lastDoc) lastConversationDocRef.current = page.lastDoc;
      setHasMoreConversations(page.hasMore);
      if (page.conversations?.length) {
        setConversations((prev) => {
          const byId = new Map((prev || []).map((existing) => [existing.id, existing]));
          for (const pageConversation of page.conversations) {
            byId.set(pageConversation.id, pageConversation);
          }
          return [...byId.values()];
        });
      }
    } catch (error) {
      console.error('fetchMoreConversations failed:', error);
    } finally {
      setLoadingMoreConversations(false);
    }
  };

  const headerBlock = embedInLayout ? (
    <TopHeader
      title="Messages"
      isDark={isDark}
      skipTopSafeInset
      onBack={onClose}
      onProfilePress={onProfilePress}
      onSettingsPress={onSettingsPress}
    />
  ) : (
    <>
      <View
        style={[
          screenStyles.header,
          embedTopPad ? { paddingTop: embedTopPad + 12 } : null,
        ]}
      >
        <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={22} color={themePalette.textPrimary} />
        </TouchableOpacity>
        <Text style={[screenStyles.headerTitle, { color: themePalette.textPrimary }]}>
          Messages
        </Text>
      </View>
      <LinearGradient
        colors={GRADIENT.separator}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={screenStyles.separator}
      />
    </>
  );

  const listContent = (
    <View style={{ flex: 1 }}>
      {embedInLayout ? headerBlock : null}
      {loading ? (
        <View style={screenStyles.emptyWrap}>
          <ActivityIndicator size="large" color={colors?.primary ?? PRIMARY_FALLBACK} />
        </View>
      ) : filteredConversations.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          contentContainerStyle={{
            paddingTop: 16,
            paddingBottom: embedInLayout ? embedBottomPad : 48,
            flexGrow: 1,
          }}
          {...FORM_SCROLL_PROPS}
          ListFooterComponent={
            hasMoreConversations ? (
              <TouchableOpacity
                onPress={loadMoreConversations}
                disabled={loadingMoreConversations}
                accessibilityRole="button"
                accessibilityLabel="Load more conversations"
                style={{
                  alignSelf: 'center',
                  marginTop: 12,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                }}
              >
                {loadingMoreConversations ? (
                  <ActivityIndicator size="small" color={colors?.primary ?? PRIMARY_FALLBACK} />
                ) : (
                  <Text
                    style={{
                      color: themePalette.textMuted,
                      fontSize: 13,
                      fontWeight: '700',
                    }}
                  >
                    Load more
                  </Text>
                )}
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </View>
  );

  const inner = (
    <LinearGradient colors={themePalette.bg} style={{ flex: 1 }}>
      {listContent}
    </LinearGradient>
  );

  if (embedInLayout) {
    return <View style={{ flex: 1 }}>{inner}</View>;
  }
  return (
    <View style={{ flex: 1 }}>
      <TopHeader
        title="Messages"
        isDark={isDark}
        skipTopSafeInset
        onBack={onClose}
        onProfilePress={onProfilePress}
        onSettingsPress={onSettingsPress}
      />
      {inner}
    </View>
  );
}
