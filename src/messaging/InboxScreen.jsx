// InboxScreen — Design Law thread list (NbCard rows, search, unread fill badges).
// Flow: load unread + conversations → filter/search → open thread or start coach chat (no new APIs).
// Used by trainer/client shells; Firebase paths stay under conversations + users.

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../look-and-feel/lightDarkMode';
import NbCard from '../look-and-feel/NbCard';
import NbAvatar from '../look-and-feel/NbAvatar';
import NbButton from '../look-and-feel/NbButton';
import HardShadow from '../look-and-feel/HardShadow';
import { nb, borderRadius } from '../look-and-feel/colorPalette';
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
    if (minutesAgo < MINUTES_PER_HOUR) return `${minutesAgo} min`;
    if (minutesAgo < MINUTES_PER_DAY) {
      return `${Math.floor(minutesAgo / MINUTES_PER_HOUR)} h`;
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

function threadInitials(name) {
  return (name || '?')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const rowStyles = StyleSheet.create({
  unreadBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  unreadText: { fontSize: 13, fontWeight: '900' },
  name: { fontSize: 16, fontWeight: '800', flex: 1 },
  timestamp: { fontSize: 12, fontWeight: '800', marginLeft: 8, flexShrink: 0 },
  preview: { fontSize: 14, marginTop: 2, lineHeight: 18 },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    minHeight: nb.minTouchTarget + 12,
  },
});

const screenStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', flex: 1 },
  searchField: {
    marginHorizontal: 16,
    marginBottom: 12,
    minHeight: 48,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbInput || 10,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '700',
  },
  sqBtn: {
    width: nb.minTouchTarget,
    height: nb.minTouchTarget,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCard: { marginHorizontal: 16, paddingVertical: 4, paddingHorizontal: 14 },
  loadMoreWrap: { marginHorizontal: 16, marginTop: 12, marginBottom: 8 },
  addBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
    marginLeft: 8,
  },
  addBtnText: { fontSize: 12, fontWeight: '700' },
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
  const ink = colors.nbInk;
  const muted = colors.nbMuted;
  const [searchQuery, setSearchQuery] = useState('');
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

    const sorted = Array.from(newestByOtherUser.values())
      .map(({ thread }) => thread)
      .sort((left, right) => conversationSortTime(right) - conversationSortTime(left));

    const q = String(searchQuery || '')
      .trim()
      .toLowerCase();
    if (!q) return sorted;

    return sorted.filter((thread) => {
      const otherId = thread.participants?.find((id) => id && id !== currentUser?.uid);
      const name = (participantNames[otherId] || '').toLowerCase();
      const preview = previewTextFromConversation(thread).toLowerCase();
      return name.includes(q) || preview.includes(q);
    });
  }, [
    conversations,
    isTrainer,
    trainerClients,
    currentUser?.uid,
    selectedClientId,
    blockedIds,
    searchQuery,
    participantNames,
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
          <Text style={[screenStyles.emptyTitle, { color: ink }]}>Couldn't load messages</Text>
          <Text style={[screenStyles.emptySubtitle, { color: muted }]}>
            Check your connection, then try again.
          </Text>
          <NbButton variant="fill" onPress={() => setListRefreshKey((key) => key + 1)} style={{ marginTop: 20 }}>
            Retry
          </NbButton>
        </View>
      );
    }

    if (filteredOut) {
      return (
        <View style={screenStyles.emptyWrap}>
          <Text style={[screenStyles.emptyTitle, { color: ink }]}>No client chats yet</Text>
          <Text style={[screenStyles.emptySubtitle, { color: muted }]}>
            Conversations with people who aren't in your client list are hidden here.
          </Text>
        </View>
      );
    }

    return (
      <View style={screenStyles.emptyWrap}>
        <Text style={[screenStyles.emptyTitle, { color: ink }]}>No conversations yet</Text>
        <Text style={[screenStyles.emptySubtitle, { color: muted }]}>
          {isTrainer
            ? 'Message a client from your roster, or add someone new from a chat.'
            : 'Say hi to your coach — your thread will show up here.'}
        </Text>
        {!isTrainer ? (
          <NbButton variant="fill" onPress={handleMessageCoach} disabled={startingChat} style={{ marginTop: 20 }}>
            {startingChat ? 'Opening…' : 'Message your coach'}
          </NbButton>
        ) : null}
      </View>
    );
  };

  const openThread = async (conversation, otherId, otherData) => {
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
  };

  const renderThreadRow = (conversation, index, total) => {
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
    const unreadLabel = unreadCount > UNREAD_BADGE_CAP ? '99+' : unreadCount;

    return (
      <TouchableOpacity
        key={conversation.id}
        onPress={() => openThread(conversation, otherId, otherData)}
        activeOpacity={0.88}
        style={[
          rowStyles.threadRow,
          index < total - 1
            ? { borderBottomWidth: nb.borderWidth, borderBottomColor: colors.nbBorder }
            : null,
        ]}
      >
        <NbAvatar
          size={DEFAULT_AVATAR_SIZE}
          initials={threadInitials(name)}
          source={otherData.photoURL || undefined}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text
              style={[
                rowStyles.name,
                { color: ink },
                unreadCount > 0 ? { fontWeight: '900' } : null,
              ]}
              numberOfLines={1}
            >
              {name}
            </Text>
            {timestamp ? (
              <Text style={[rowStyles.timestamp, { color: muted }]}>{timestamp}</Text>
            ) : null}
          </View>
          <Text
            style={[
              rowStyles.preview,
              { color: unreadCount > 0 ? ink : muted, fontWeight: unreadCount > 0 ? '700' : '500' },
            ]}
            numberOfLines={1}
          >
            {lastMessage}
          </Text>
        </View>
        {unreadCount > 0 ? (
          <View
            style={[
              rowStyles.unreadBadge,
              { backgroundColor: colors.nbFill, borderColor: colors.nbBorder },
            ]}
          >
            <Text style={[rowStyles.unreadText, { color: colors.nbOnFill }]}>{unreadLabel}</Text>
          </View>
        ) : null}
        {isTrainer && !isAlreadyClient ? (
          <TouchableOpacity
            onPress={(pressEvent) => handleAddAsClient(otherId, otherData, pressEvent)}
            disabled={!!isAdding}
            style={[
              screenStyles.addBtn,
              { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
            ]}
          >
            {isAdding ? (
              <ActivityIndicator size="small" color={ink} />
            ) : (
              <Text style={[screenStyles.addBtnText, { color: ink }]}>+ Add</Text>
            )}
          </TouchableOpacity>
        ) : null}
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

  const messagesTitle = isTrainer ? 'Messages' : 'Message your coach';

  const pageHeader = (
    <View style={screenStyles.header}>
      <Text style={[screenStyles.headerTitle, { color: ink }]}>{messagesTitle}</Text>
      {isTrainer ? (
        <HardShadow offset={nb.shadowOffset} radius={borderRadius.nbButton}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="New message"
            onPress={() => {}}
            style={[screenStyles.sqBtn, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface }]}
          >
            <Ionicons name="add" size={24} color={ink} />
          </TouchableOpacity>
        </HardShadow>
      ) : (
        <View style={{ width: nb.minTouchTarget }} />
      )}
    </View>
  );

  const searchBlock = isTrainer ? (
      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search clients"
        placeholderTextColor={muted}
        accessibilityLabel="Search clients"
        style={[
          screenStyles.searchField,
          {
            borderColor: colors.nbBorder,
            backgroundColor: colors.nbSurface,
            color: ink,
          },
        ]}
      />
    ) : null;

  const loadEarlierControl = hasMoreConversations ? (
    <View style={screenStyles.loadMoreWrap}>
      <NbButton
        variant="ghost"
        onPress={loadMoreConversations}
        disabled={loadingMoreConversations}
      >
        {loadingMoreConversations ? 'Loading…' : 'Load earlier messages'}
      </NbButton>
    </View>
  ) : null;

  const listBody =
    loading ? (
      <View style={screenStyles.emptyWrap}>
        <ActivityIndicator size="large" color={ink} />
      </View>
    ) : filteredConversations.length === 0 ? (
      renderEmptyState()
    ) : (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: embedInLayout ? embedBottomPad : 48,
          flexGrow: 1,
        }}
        {...FORM_SCROLL_PROPS}
      >
        <HardShadow>
          <NbCard style={screenStyles.listCard}>
            {filteredConversations.map((conversation, index) =>
              renderThreadRow(conversation, index, filteredConversations.length),
            )}
          </NbCard>
        </HardShadow>
        {loadEarlierControl}
      </ScrollView>
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.nbBackground }}>
      {embedInLayout ? (
        <TopHeader
          skipTopSafeInset
          onProfilePress={onProfilePress}
          onSettingsPress={onSettingsPress}
        />
      ) : null}
      {!embedInLayout && onClose ? (
        <View style={{ paddingHorizontal: 16, paddingTop: embedTopPad + 8 }}>
          <HardShadow offset={nb.shadowOffset} radius={borderRadius.nbButton}>
            <TouchableOpacity
              onPress={onClose}
              style={[screenStyles.sqBtn, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface }]}
            >
              <Ionicons name="chevron-back" size={22} color={ink} />
            </TouchableOpacity>
          </HardShadow>
        </View>
      ) : null}
      {pageHeader}
      {searchBlock}
      {listBody}
    </View>
  );
}
