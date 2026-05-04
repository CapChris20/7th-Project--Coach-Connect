/**
 * Conversations List Screen — new glass UI, existing Firebase and navigation.
 * Real-time via subscribeToConversations; account isolation via participants + trainer clients filter.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../shared/ui/ThemeContext';
import { auth, db } from '../../app/config';
import { subscribeToConversations, subscribeToUnreadByConversation } from '../../ai/services/conversationService';
import { getTrainerClients, createOrUpdateClient } from '../services/clientCRMService';
import { getOrCreateConversation, markMessagesAsRead } from '../../ai/services/trainerMessaging';
import { doc, getDoc } from 'firebase/firestore';
import CoachConnectHeader from '../../shared/components/CoachConnectHeader';
import GradientChatBubblesIcon from '../../shared/components/GradientChatBubblesIcon';

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

const GlassCard = ({ children, style, isDark }) => {
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
      <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={[cardStyle, style]}>
        {children}
      </BlurView>
    );
  }
  return <View style={[cardStyle, style]}>{children}</View>;
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
});

export default function ConversationsListScreen({ onSelectConversation, onClose, onProfilePress, onSettingsPress, embedInLayout, selectedClientId }) {
  const { colors, isDark } = useTheme();
  const t = isDark ? DARK : LIGHT;
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [participantNames, setParticipantNames] = useState({});
  const [participantData, setParticipantData] = useState({});
  const [unreadByConversationId, setUnreadByConversationId] = useState({});
  const [isTrainer, setIsTrainer] = useState(false);
  const [trainerClients, setTrainerClients] = useState([]);
  const [addingClient, setAddingClient] = useState({});
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
    const unsubscribe = subscribeToConversations(currentUser.uid, ({ conversations: list, participantNames: names, participantData: data }) => {
      setConversations(list);
      setParticipantNames(names || {});
      setParticipantData(data || {});
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser]);

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
        <GlassCard isDark={isDark} style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
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

  const headerBlock = (
    <>
      <View style={screenStyles.header}>
        <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={22} color={t.textPrimary} />
        </TouchableOpacity>
        <Text style={[screenStyles.headerTitle, { color: t.textPrimary }]}>Messages</Text>
      </View>
      <LinearGradient colors={GRADIENT.separator} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={screenStyles.separator} />
    </>
  );

  const listContent = (
    <>
      {headerBlock}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 48 }}>
          <ActivityIndicator size="large" color={colors?.primary ?? '#6C5CE7'} />
        </View>
      ) : filteredConversations.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
          <View
            style={{
              width: 76,
              height: 76,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
              overflow: 'hidden',
            }}
          >
            <GradientChatBubblesIcon size={34} />
          </View>
          <Text style={{ fontSize: 16, color: t.textMuted, textAlign: 'center' }}>No conversations yet</Text>
          <Text style={{ fontSize: 14, color: t.textTimestamp, textAlign: 'center', marginTop: 8 }}>Start a conversation with a trainer or client</Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
        />
      )}
    </>
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
    <SafeAreaView style={{ flex: 1 }}>
      <CoachConnectHeader title="Messages" isDark={isDark} onProfilePress={onProfilePress} onSettingsPress={onSettingsPress} />
      {inner}
    </SafeAreaView>
  );
}
