// Real-time conversation subscription service
// Provides live updates for conversation lists across trainer and client apps

import { db } from '../../app/config';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getUserData } from './trainerMessaging';

/**
 * Subscribe to real-time conversation updates for a user
 * @param {string} userId - The user's ID
 * @param {Function} callback - Callback function to receive conversations
 * @returns {Function} Unsubscribe function
 */
export function subscribeToConversations(userId, callback) {
  const uid = typeof userId === 'string' ? userId.trim() : '';
  if (!uid || !callback) {
    console.error('❌ subscribeToConversations: Missing userId or callback');
    return () => {};
  }

  if (__DEV__) console.log('🔍 Setting up real-time conversations listener for:', uid);
  
  const conversationsRef = collection(db, 'conversations');
  const q = query(
    conversationsRef,
    where('participants', 'array-contains', uid)
  );

  let participantNamesCache = {};
  let participantDataCache = {};

  const unsubscribe = onSnapshot(q, async (querySnapshot) => {
    try {
      const conversations = [];
      querySnapshot.forEach((doc) => {
        conversations.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      // Sort by updatedAt in JavaScript
      conversations.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis?.() || a.updatedAt || 0;
        const timeB = b.updatedAt?.toMillis?.() || b.updatedAt || 0;
        return timeB - timeA; // Descending order (newest first)
      });

      if (__DEV__) console.log('📨 Real-time conversations update:', conversations.length);

      // Load participant data for new conversations only
      const loadPromises = [];
      for (const conv of conversations) {
        const otherParticipantId = conv.participants?.find(id => typeof id === 'string' && id.trim() && id !== uid);
        if (otherParticipantId && typeof otherParticipantId === 'string' && !participantNamesCache[otherParticipantId]) {
          loadPromises.push(
            getUserData(otherParticipantId).then(userData => {
              if (userData) {
                const userName = userData.name || 
                  `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 
                  userData.displayName || 
                  'User';
                participantNamesCache[otherParticipantId] = userName;
                participantDataCache[otherParticipantId] = userData;
              }
            }).catch(err => {
              console.warn('⚠️ Failed to load user data for', otherParticipantId, err);
            })
          );
        }
      }

      await Promise.all(loadPromises);

      // Return conversations with participant data
      callback({
        conversations,
        participantNames: participantNamesCache,
        participantData: participantDataCache,
      });
    } catch (error) {
      console.error('❌ Error in conversations listener:', error);
      callback({ conversations: [], participantNames: {}, participantData: {} });
    }
  }, (error) => {
    console.error('❌ Firestore listener error:', error);
    callback({ conversations: [], participantNames: {}, participantData: {} });
  });

  return () => {
    console.log('🔇 Cleaning up conversations listener for:', uid);
    unsubscribe();
  };
}

/**
 * Subscribe to unread message count for a user
 * @param {string} userId - The user's ID
 * @param {Function} callback - Callback function to receive unread count
 * @returns {Function} Unsubscribe function
 */
export function subscribeToUnreadCount(userId, callback) {
  if (!userId || !callback) {
    console.error('❌ subscribeToUnreadCount: Missing userId or callback');
    return () => {};
  }

  const conversationsRef = collection(db, 'conversations');
  const conversationsQuery = query(
    conversationsRef,
    where('participants', 'array-contains', userId)
  );

  let unsubscribeFunctions = [];

  const conversationsUnsubscribe = onSnapshot(conversationsQuery, async (conversationsSnapshot) => {
    // Clean up previous message listeners
    unsubscribeFunctions.forEach(unsub => unsub());
    unsubscribeFunctions = [];

    let totalUnread = 0;
    const conversationIds = [];

    conversationsSnapshot.forEach((convDoc) => {
      conversationIds.push(convDoc.id);
    });

    if (conversationIds.length === 0) {
      callback(0);
      return;
    }

    // Count unread messages for each conversation
    const countPromises = conversationIds.map(async (conversationId) => {
      const messagesRef = collection(db, 'messages');
      const messagesQuery = query(
        messagesRef,
        where('conversationId', '==', conversationId)
      );

      return new Promise((resolve) => {
        const unsubscribe = onSnapshot(messagesQuery, (messagesSnapshot) => {
          let unreadCount = 0;
          messagesSnapshot.forEach((doc) => {
            const messageData = doc.data();
            if (messageData.senderId !== userId && messageData.read === false) {
              unreadCount++;
            }
          });
          resolve(unreadCount);
        });
        unsubscribeFunctions.push(unsubscribe);
      });
    });

    try {
      const counts = await Promise.all(countPromises);
      totalUnread = counts.reduce((sum, count) => sum + count, 0);
      callback(totalUnread);
    } catch (error) {
      console.error('❌ Error counting unread messages:', error);
      callback(0);
    }
  });

  // Return cleanup function
  return () => {
    conversationsUnsubscribe();
    unsubscribeFunctions.forEach(unsub => unsub());
  };
}

/**
 * Subscribe to per-conversation unread counts (messages sent by others, not read by current user).
 * Use this to show a bell/badge only on rows where that person sent unread messages.
 * @param {string} userId - Current user's ID
 * @param {Function} callback - Called with { [conversationId]: unreadCount }
 * @returns {Function} Unsubscribe function
 */
export function subscribeToUnreadByConversation(userId, callback) {
  if (!userId || !callback) return () => {};

  console.log('🔔 Setting up unread tracking for user:', userId);
  const conversationsRef = collection(db, 'conversations');
  const q = query(conversationsRef, where('participants', 'array-contains', userId));
  let unreadByConv = {};
  let messageUnsubscribes = [];

  const conversationsUnsubscribe = onSnapshot(q, (conversationsSnapshot) => {
    console.log('📨 Conversations updated:', conversationsSnapshot.size, 'conversations');
    messageUnsubscribes.forEach((unsub) => unsub());
    messageUnsubscribes = [];
    const convIds = [];
    conversationsSnapshot.forEach((doc) => convIds.push(doc.id));

    if (convIds.length === 0) {
      console.log('📭 No conversations found');
      callback({});
      return;
    }

    console.log('🔍 Tracking unread for conversations:', convIds);

    convIds.forEach((conversationId) => {
      const messagesRef = collection(db, 'messages');
      const messagesQuery = query(messagesRef, where('conversationId', '==', conversationId));
      const unsub = onSnapshot(messagesQuery, (messagesSnapshot) => {
        let count = 0;
        messagesSnapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.senderId !== userId && d.read === false) {
            count++;
            console.log('📩 Found unread message in', conversationId, 'from', d.senderId);
          }
        });
        unreadByConv[conversationId] = count;
        console.log('🔢 Unread count for', conversationId, ':', count);
        callback({ ...unreadByConv });
      });
      messageUnsubscribes.push(unsub);
    });
  });

  return () => {
    conversationsUnsubscribe();
    messageUnsubscribes.forEach((unsub) => unsub());
  };
}


