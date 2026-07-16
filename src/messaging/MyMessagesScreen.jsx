/**
 * Conversations List Screen
 *
 * Purpose: UI screen or component: Conversations List Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: MyMessagesScreen
 *
 * @file-header
 */
/**
 * Conversations List Screen — new glass UI, existing Firebase and navigation.
 * Real-time via subscribeToConversations; account isolation via participants + trainer clients filter.
 */

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
import BlurBackdropPlate from '../shared-ui/BlurBackdropPlate';
import { useTheme } from '../shared-ui/ThemeContext';
import { auth, db } from '../app-start/config';
import {
  subscribeToConversations,
  subscribeToUnreadByConversation,
  fetchMoreConversations,
} from '../ai-coach/server-logic/chat-api/loadMoreCoachConversations';
import { getTrainerClients, createOrUpdateClient } from '../trainer-app/clients-list/loadMyTraineeRoster';
import { getOrCreateConversation, markMessagesAsRead } from '../ai-coach/server-logic/trainer-messaging/sendTrainerNotification';
import { doc, getDoc } from 'firebase/firestore';
import CoachConnectHeader from '../shared/components/shell/CoachConnectHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FORM_SCROLL_PROPS, useShellBottomNavInset } from '../navigation/bottomNavMetrics';

// ── DESIGN TOKENS ─────────────────────────────────────────────
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

function formatTimestamp(timestamp) {
  if (!timestamp) return null;
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return null;
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    if (minutes < 43200) return `${Math.floor(minutes / 1440)}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (e) {
    return null;
  }
}

const GlassCard = ({ children, style, contentWrapperStyle, isDark }) => {
  const t = isDark ? DARK : LIGHT;
  const cardStyle = {
    backgroundColor: t.glass,
    borderWidth: 1,
    borderColor: t.glassBorder,
    borderRadius: 20,
    ...(Platform.OS === 'ios' && {
      shadowColor: '#FF6B9D',
      shadowRadius: 12,
      shadowOpacity: 0.2,
      shadowOffset: { width: 0, height: 4 },
    }),
  };
  if (Platform.OS === 'ios') {
    return (
      <BlurBackdropPlate
        intensity={20}
        tint={isDark ? 'dark' : 'light'}
        style={[cardStyle, style]}
        contentWrapperStyle={contentWrapperStyle}
      >
        {children}
      </BlurBackdropPlate>
    );
  }
  return <View style={[cardStyle, style, contentWrapperStyle]}>{children}</View>;
};

const GradientAvatar = ({ name, photoURL, size = 48 }) => {
  const initials = (name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <LinearGradient
      colors={['#FF6B9D', '#C084FC']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
    >
      {photoURL ? (
        <Image source={{ uri: photoURL }} style={{ width: size, height: size }} />
      ) : (
        <Text style={{ color: 'white', fontWeight: '700', fontSize: size * 0.28 }}>{initials}</Text>
      )}
    </LinearGradient>
  );
};

const rowStyles = StyleSheet.create({
  unreadBadge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  unreadText: { color: 'white', fontSize: 10, fontWeight: '700' },
  name: { fontSize: 15, fontWeight: '700', flex: 1 },
  timestamp: { fontSize: 11, marginLeft: 8, flexShrink: 0 },
  preview: { fontSize: 13, marginTop: 2 },
});

const screenStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  headerTitle: { fontSize: 26, fontWeight: '800' },
  separator: { height: 1, marginHorizontal: 16, marginBottom: 4 },
  addBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginLeft: 8 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  clientBadge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginLeft: 8, borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' },
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

export default function MyMessagesScreen({ onSelectConversation, onClose, onProfilePress, onSettingsPress, embedInLayout, selectedClientId }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const embedTopPad = embedInLayout ? Math.max(insets.top, 8) : 0;
  // Shell BottomNavBar stays visible on the conversations list — reserve it.
  const shellBottomPad = useShellBottomNavInset(24);
  const embedBottomPad = embedInLayout ? shellBottomPad : 0;
  const t = isDark ? DARK : LIGHT;
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

  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = subscribeToUnreadByConversation(currentUser.uid, (byConv) => {
      console.log('🔔 Unread counts updated:', byConv);
      setUnreadByConversationId(byConv || {});
    });
    return () => unsub();
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser || !db) return;
    const checkTrainerRole = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const isUserTrainer = userData.role === 'trainer';
          setIsTrainer(isUserTrainer);
          if (isUserTrainer) {
            const clients = await getTrainerClients(currentUser.uid);
            setTrainerClients(clients);
          }
        }
      } catch (error) {
        console.error('Error checking trainer role:', error);
      }
    };
    checkTrainerRole();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    setListError(null);
    const unsubscribe = subscribeToConversations(
      currentUser.uid,
      ({ conversations: list, participantNames: names, participantData: data, lastDoc, hasMore, error }) => {
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

  const filteredConversations = useMemo(() => {
    if (!conversations.length) return [];
    const clientIds = new Set((trainerClients || []).map((c) => c.id));
    const byOther = new Map();
    for (const conv of conversations) {
      const otherId = conv.participants?.find((id) => id && id !== currentUser?.uid);
      if (!otherId) continue;
      
      // If a specific client is selected, only show conversations with that client
      if (selectedClientId && otherId !== selectedClientId) continue;
      
      if (isTrainer && clientIds.size > 0 && !clientIds.has(otherId)) continue;
      const time = conv.updatedAt?.toMillis?.() ?? conv.updatedAt ?? 0;
      const prev = byOther.get(otherId);
      if (!prev || time > prev.time) byOther.set(otherId, { conv, time });
    }
    return Array.from(byOther.values())
      .map(({ conv }) => conv)
      .sort((a, b) => {
        const timeA = a.updatedAt?.toMillis?.() ?? a.updatedAt ?? 0;
        const timeB = b.updatedAt?.toMillis?.() ?? b.updatedAt ?? 0;
        return timeB - timeA;
      });
  }, [conversations, isTrainer, trainerClients, currentUser?.uid, selectedClientId]);

  useEffect(() => {
    if (!currentUser || isTrainer) return;
    const ensureClientConversation = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const assignedTrainerId = userData.trainerId;
          if (assignedTrainerId) {
            await getOrCreateConversation(currentUser.uid, assignedTrainerId);
          }
        }
      } catch (error) {
        console.error('Error ensuring client conversation:', error);
      }
    };
    const timer = setTimeout(ensureClientConversation, 1000);
    return () => clearTimeout(timer);
  }, [currentUser, isTrainer]);

  const handleAddAsClient = async (clientId, clientData, event) => {
    event?.stopPropagation?.();
    if (!currentUser || !isTrainer) return;
    setAddingClient((prev) => ({ ...prev, [clientId]: true }));
    try {
      const existingClients = await getTrainerClients(currentUser.uid);
      if (existingClients.some((c) => c.id === clientId)) {
        Alert.alert('Info', 'This person is already your client');
        setAddingClient((prev) => ({ ...prev, [clientId]: false }));
        return;
      }
      const userDoc = await getDoc(doc(db, 'users', clientId));
      const fullUserData = userDoc.exists() ? userDoc.data() : null;
      if (!fullUserData) {
        Alert.alert('Error', 'Could not load user data');
        setAddingClient((prev) => ({ ...prev, [clientId]: false }));
        return;
      }
      const clientName = fullUserData.name || `${fullUserData.firstName || ''} ${fullUserData.lastName || ''}`.trim() || fullUserData.displayName || 'Client';
      const clientPayload = {
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
      await createOrUpdateClient(clientId, currentUser.uid, clientPayload);
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
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const trainerId = userDoc.exists() ? userDoc.data()?.trainerId : null;
      if (!trainerId) {
        Alert.alert('No coach yet', 'Find a trainer in the app to start messaging.');
        return;
      }
      const conversationId = await getOrCreateConversation(currentUser.uid, trainerId);
      const convSnap = await getDoc(doc(db, 'conversations', conversationId));
      const trainerSnap = await getDoc(doc(db, 'users', trainerId));
      const trainerData = trainerSnap.exists() ? trainerSnap.data() : {};
      const conversation = convSnap.exists()
        ? { id: conversationId, ...convSnap.data() }
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
          <View style={[screenStyles.emptyIconBox, { borderColor: 'rgba(239,68,68,0.35)', backgroundColor: 'rgba(239,68,68,0.08)' }]}>
            <Ionicons name="cloud-offline-outline" size={34} color="#f87171" />
          </View>
          <Text style={[screenStyles.emptyTitle, { color: t.textPrimary }]}>Couldn't load messages</Text>
          <Text style={[screenStyles.emptySubtitle, { color: t.textMuted }]}>
            Check your connection, then try again.
          </Text>
          <TouchableOpacity
            onPress={() => setListRefreshKey((k) => k + 1)}
            activeOpacity={0.85}
            style={{ marginTop: 20 }}
          >
            <LinearGradient colors={GRADIENT.badge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={screenStyles.emptyCta}>
              <Text style={screenStyles.emptyCtaText}>Retry</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      );
    }

    if (filteredOut) {
      return (
        <View style={screenStyles.emptyWrap}>
          <Text style={[screenStyles.emptyTitle, { color: t.textPrimary }]}>No client chats yet</Text>
          <Text style={[screenStyles.emptySubtitle, { color: t.textMuted }]}>
            Conversations with people who aren't in your client list are hidden here.
          </Text>
        </View>
      );
    }

    return (
        <View style={screenStyles.emptyWrap}>
          <Text style={[screenStyles.emptyTitle, { color: t.textPrimary }]}>No conversations yet</Text>
        <Text style={[screenStyles.emptySubtitle, { color: t.textMuted }]}>
          {isTrainer
            ? 'Message a client from your roster, or add someone new from a chat.'
            : 'Say hi to your coach — your thread will show up here.'}
        </Text>
        {!isTrainer ? (
          <TouchableOpacity onPress={handleMessageCoach} disabled={startingChat} activeOpacity={0.85} style={{ marginTop: 20 }}>
            <LinearGradient colors={GRADIENT.badge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={screenStyles.emptyCta}>
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
    let lastMessage = 'No messages yet';
    if (conversation.lastMessage) {
      if (typeof conversation.lastMessage === 'string') lastMessage = conversation.lastMessage;
      else if (typeof conversation.lastMessage === 'object' && conversation.lastMessage?.text) lastMessage = String(conversation.lastMessage.text);
      else lastMessage = String(conversation.lastMessage);
    }
    const timestamp = formatTimestamp(conversation.lastMessageTime) || formatTimestamp(conversation.updatedAt) || null;
    const isAlreadyClient = isTrainer && trainerClients.some((c) => c.id === otherId);
    const isAdding = addingClient[otherId];
    const unreadCount = unreadByConversationId[conversation.id] ?? 0;
    const showBell = unreadCount > 0;

    return (
      <TouchableOpacity
        onPress={async () => {
          // Mark messages as read when conversation is selected
          try {
            console.log('🔕 Marking messages as read for conversation:', conversation.id);
            await markMessagesAsRead(conversation.id, auth.currentUser.uid);
            console.log('✅ Messages marked as read, forcing unread count refresh');
            
            // Immediately update the unread count to 0
            const currentUnread = { ...unreadByConversationId };
            currentUnread[conversation.id] = 0;
            console.log('🔄 Immediately setting unread count to 0 for:', conversation.id);
            setUnreadByConversationId(currentUnread);
            
            // Also force refresh after a delay in case Firebase listener updates
            setTimeout(() => {
              const refreshUnread = { ...unreadByConversationId };
              refreshUnread[conversation.id] = 0;
              console.log('🔄 Double-checking unread count is 0 for:', conversation.id);
              setUnreadByConversationId(refreshUnread);
            }, 500);
          } catch (error) {
            console.error('❌ Error marking messages as read:', error);
          }
          onSelectConversation?.(conversation, { id: otherId, ...otherData });
        }}
        activeOpacity={0.85}
        style={{ marginHorizontal: 16, marginBottom: 10 }}
      >
        <GlassCard isDark={isDark} contentWrapperStyle={{ flexDirection: 'row', alignItems: 'center', padding: 16, minWidth: 0 }}>
          <View style={{ position: 'relative', flexShrink: 0 }}>
            <GradientAvatar name={name} photoURL={otherData.photoURL} size={48} />
            {showBell && (
              <LinearGradient colors={GRADIENT.badge} style={rowStyles.unreadBadge}>
                <Text style={rowStyles.unreadText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </LinearGradient>
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[rowStyles.name, { color: t.textPrimary }]} numberOfLines={1}>{name}</Text>
              {timestamp ? <Text style={[rowStyles.timestamp, { color: t.textTimestamp }]}>{timestamp}</Text> : null}
            </View>
            <Text style={[rowStyles.preview, { color: t.textMuted }]} numberOfLines={1}>{lastMessage}</Text>
          </View>
          {isTrainer && !isAlreadyClient && (
            <TouchableOpacity
              onPress={(e) => handleAddAsClient(otherId, otherData, e)}
              disabled={!!isAdding}
              style={[screenStyles.addBtn, { backgroundColor: colors?.primary ?? '#6C5CE7' }]}
            >
              {isAdding ? <ActivityIndicator size="small" color="#fff" /> : <Text style={screenStyles.addBtnText}>+ Add</Text>}
            </TouchableOpacity>
          )}
        </GlassCard>
      </TouchableOpacity>
    );
  };

  const headerBlock = embedInLayout ? (
    <CoachConnectHeader
      title="Messages"
      isDark={isDark}
      skipTopSafeInset
      onBack={onClose}
      onProfilePress={onProfilePress}
      onSettingsPress={onSettingsPress}
    />
  ) : (
    <>
      <View style={[screenStyles.header, embedTopPad ? { paddingTop: embedTopPad + 12 } : null]}>
        <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={22} color={t.textPrimary} />
        </TouchableOpacity>
        <Text style={[screenStyles.headerTitle, { color: t.textPrimary }]}>Messages</Text>
      </View>
      <LinearGradient colors={GRADIENT.separator} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={screenStyles.separator} />
    </>
  );

  const listContent = (
    <View style={{ flex: 1 }}>
      {embedInLayout ? headerBlock : null}
      {loading ? (
        <View style={screenStyles.emptyWrap}>
          <ActivityIndicator size="large" color={colors?.primary ?? '#6C5CE7'} />
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
                onPress={async () => {
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
                        const byId = new Map((prev || []).map((c) => [c.id, c]));
                        for (const c of page.conversations) byId.set(c.id, c);
                        return [...byId.values()];
                      });
                    }
                  } catch (e) {
                    console.error('fetchMoreConversations failed:', e);
                  } finally {
                    setLoadingMoreConversations(false);
                  }
                }}
                disabled={loadingMoreConversations}
                accessibilityRole="button"
                accessibilityLabel="Load more conversations"
                style={{ alignSelf: 'center', marginTop: 12, paddingVertical: 10, paddingHorizontal: 16 }}
              >
                {loadingMoreConversations ? (
                  <ActivityIndicator size="small" color={colors?.primary ?? '#6C5CE7'} />
                ) : (
                  <Text style={{ color: t.textMuted, fontSize: 13, fontWeight: '700' }}>Load more</Text>
                )}
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </View>
  );

  const inner = (
    <LinearGradient colors={t.bg} style={{ flex: 1 }}>
      {listContent}
    </LinearGradient>
  );

  if (embedInLayout) {
    return <View style={{ flex: 1 }}>{inner}</View>;
  }
  return (
    <View style={{ flex: 1 }}>
      <CoachConnectHeader
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
