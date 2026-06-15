/**
 * trainer Messaging
 *
 * Purpose: Data/service layer: trainer Messaging. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/ai
 * Key exports: clientRequestTypeLabel, isPendingClientRequestMessage, filterChatMessages, getOrCreateConversation, sendMessage, sendAttachmentMessage, sendClientRequest, updateMessageStatus
 *
 * @file-header
 */
// Trainer Messaging Service
// Handles real-time messaging between clients and trainers
import { db } from '../../app/config';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  onSnapshot,
  updateDoc,
  runTransaction,
  deleteField,
} from 'firebase/firestore';
import { getDocsWithIndexFallback } from '../../shared/firestore/firestorePagedQuery';
import { postRemotePushNotify } from '../../shared/api/sendPushNotification';
import { randomClientRequestTitle } from '../../shared/notifications/pushNotificationText';

export const MESSAGES_PAGE_SIZE = 80;

function messageMillis(m) {
  const t = m?.timestamp;
  if (t?.toMillis) return t.toMillis();
  if (typeof t === 'number') return t;
  return 0;
}

function sortMessagesAsc(messages) {
  return [...messages].sort((a, b) => messageMillis(a) - messageMillis(b));
}

function mapMessageDoc(docSnap) {
  return { id: docSnap.id, ...docSnap.data() };
}

/** Client → trainer requests (not normal chat). */
export const CLIENT_REQUEST_TYPES = {
  CONNECTION: 'connection',
  WORKOUT_PLAN: 'workout_plan',
  GENERAL: 'general',
};

export function clientRequestTypeLabel(type) {
  if (type === CLIENT_REQUEST_TYPES.WORKOUT_PLAN) return 'Workout plan request';
  if (type === CLIENT_REQUEST_TYPES.GENERAL) return 'Client request';
  return 'Connection request';
}

export function isPendingClientRequestMessage(message) {
  return String(message?.status || '') === 'pending';
}

/** Hide pending client requests from message threads — they live in Client Requests. */
export function filterChatMessages(messages) {
  return (messages || []).filter((m) => !isPendingClientRequestMessage(m));
}

async function notifyRecipientMessagePush({
  recipientId,
  senderId,
  senderName,
  conversationId,
  messageId,
  messageText,
}) {
  const r = await postRemotePushNotify({
    recipientId,
    senderName,
    senderId,
    conversationId,
    messageId,
    messageText: (messageText || '').substring(0, 100),
    notificationType: 'message',
  });
  if (!r.ok && r.reason) {
    console.warn('⚠️ Push notification:', r.reason);
  }
}

/**
 * Get or create a conversation between a client and trainer
 * @param {string} clientId - The client's user ID
 * @param {string} trainerId - The trainer's user ID
 * @returns {Promise<string>} Conversation ID
 */
export async function getOrCreateConversation(clientId, trainerId) {
  try {
    console.log('🔍 getOrCreateConversation:', { clientId, trainerId });
    
    // Generate a consistent conversation ID (same for same client-trainer pair)
    const conversationId = `conv_${clientId}_${trainerId}`;
    
    // Use transaction to prevent race conditions
    const conversationRef = doc(db, 'conversations', conversationId);
    
    const result = await runTransaction(db, async (transaction) => {
      const conversationDoc = await transaction.get(conversationRef);
      
      if (conversationDoc.exists()) {
        console.log('✅ Found existing conversation:', conversationId);
        return conversationId;
      }

      // Create new conversation within transaction
      const conversationData = {
        id: conversationId,
        participants: [clientId, trainerId],
        clientId,
        trainerId,
        type: 'client-trainer',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: null,
        lastMessageTime: null,
      };

      transaction.set(conversationRef, conversationData);
      console.log('✅ Conversation created successfully:', conversationId);
      return conversationId;
    });

    return result;
  } catch (error) {
    console.error('❌ Error getting/creating conversation:', error);
    throw error;
  }
}

/**
 * Send a message in a conversation
 * @param {string} conversationId - The conversation ID
 * @param {string} senderId - The sender's user ID
 * @param {string} messageText - The message content
 * @returns {Promise<string>} Message ID
 */
export async function sendMessage(conversationId, senderId, messageText) {
  try {
    console.log('📤 sendMessage called:', { conversationId, senderId, messageLength: messageText.length });
    
    if (!conversationId || !senderId || !messageText) {
      throw new Error('Missing required parameters: conversationId, senderId, or messageText');
    }

    // Read conversation data BEFORE transaction (Firestore requires all reads before writes)
    const conversationRef = doc(db, 'conversations', conversationId);
    const convSnap = await getDoc(conversationRef);
    const conversationData = convSnap.exists() ? convSnap.data() : null;

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const messageData = {
      id: messageId,
      conversationId,
      senderId,
      text: messageText,
      timestamp: serverTimestamp(),
      read: false,
    };

    // Use transaction to ensure atomic message creation and conversation update
    await runTransaction(db, async (transaction) => {
      // Create message
      const messageRef = doc(db, 'messages', messageId);
      transaction.set(messageRef, messageData);
      
      // Update conversation with last message atomically
      transaction.update(conversationRef, {
        lastMessage: messageText,
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    console.log('✅ Message and conversation updated atomically');

    // Trigger push notification to recipient
    try {
      const recipientId = conversationData?.participants?.find((id) => id !== senderId);

      if (recipientId) {
        const senderData = await getUserData(senderId);
        const senderName = senderData?.name || senderData?.firstName || 'Someone';

        await notifyRecipientMessagePush({
          recipientId,
          senderName,
          senderId,
          conversationId,
          messageId,
          messageText,
        });
      }
    } catch (notifError) {
      console.warn('⚠️ Failed to send push notification:', notifError);
    }

    return messageId;
  } catch (error) {
    console.error('❌ Error sending message:', error);
    throw error;
  }
}

/**
 * Send an attachment message (image or file). Additive only — does not change existing text flow.
 * Writes to the same top-level messages collection with type, fileUrl, fileName, etc.
 * @param {string} conversationId
 * @param {string} senderId
 * @param {{ type: 'image'|'file', fileUrl: string, fileName: string, fileSize?: number }} payload
 * @returns {Promise<string>} Message ID
 */
export async function sendAttachmentMessage(conversationId, senderId, payload) {
  try {
    if (!conversationId || !senderId || !payload?.fileUrl) {
      throw new Error('Missing required parameters for attachment message');
    }

    const conversationRef = doc(db, 'conversations', conversationId);
    const convSnap = await getDoc(conversationRef);
    const conversationData = convSnap.exists() ? convSnap.data() : null;

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const lastMessagePreview = payload.type === 'image' ? '[Photo]' : (payload.fileName || '[File]');
    const messageData = {
      id: messageId,
      conversationId,
      senderId,
      type: payload.type || 'file',
      fileUrl: payload.fileUrl,
      fileName: payload.fileName || null,
      fileSize: payload.fileSize ?? null,
      timestamp: serverTimestamp(),
      read: false,
      sent: true,
    };

    const result = await runTransaction(db, async (transaction) => {
      const messageRef = doc(db, 'messages', messageId);
      transaction.set(messageRef, messageData);
      transaction.update(conversationRef, {
        lastMessage: lastMessagePreview,
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return messageId;
    });

    try {
      const recipientId = conversationData?.participants?.find((id) => id !== senderId);
      if (recipientId) {
        const senderData = await getUserData(senderId);
        const senderName = senderData?.name || senderData?.firstName || 'Someone';
        await notifyRecipientMessagePush({
          recipientId,
          senderName,
          senderId,
          conversationId,
          messageId,
          messageText: lastMessagePreview,
        });
      }
    } catch (notifError) {
      console.warn('⚠️ Failed to send push notification (attachment):', notifError);
    }

    return result;
  } catch (error) {
    console.error('❌ Error sending attachment message:', error);
    throw error;
  }
}

/**
 * Send a client request message (with status: pending and client metadata)
 * @param {string} conversationId - The conversation ID
 * @param {string} senderId - The client's user ID
 * @param {string} messageText - The message content
 * @param {Object} metadata - Optional: clientName, clientGoals, clientExperienceLevel, clientEquipment, clientLimitations
 * @returns {Promise<string>} Message ID
 */
export async function sendClientRequest(conversationId, senderId, messageText, metadata = {}) {
  try {
    if (!conversationId || !senderId) {
      throw new Error('Missing required parameters: conversationId or senderId');
    }

    const requestType = metadata.requestType || CLIENT_REQUEST_TYPES.CONNECTION;
    const requestTitle = metadata.requestTitle || clientRequestTypeLabel(requestType);
    const trimmed = messageText != null ? String(messageText).trim() : '';
    const allowDefaultIntro = metadata.allowDefaultIntro !== false;
    const text =
      trimmed ||
      (allowDefaultIntro && requestType === CLIENT_REQUEST_TYPES.CONNECTION
        ? "Hi! I'd like to work with you as my trainer."
        : '');
    const lastMessagePreview =
      requestType === CLIENT_REQUEST_TYPES.CONNECTION
        ? text || 'Connection request'
        : requestTitle;

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const messageData = {
      id: messageId,
      conversationId,
      senderId,
      text,
      timestamp: serverTimestamp(),
      read: false,
      status: 'pending',
      requestType,
      requestTitle,
      clientName: metadata.clientName || 'Client',
      clientGoals: metadata.clientGoals || 'Not specified',
      clientExperienceLevel: metadata.clientExperienceLevel || 'Beginner',
      clientEquipment: metadata.clientEquipment || 'None',
      clientLimitations: metadata.clientLimitations || 'None',
    };

    const result = await runTransaction(db, async (transaction) => {
      const messageRef = doc(db, 'messages', messageId);
      transaction.set(messageRef, messageData);

      const conversationRef = doc(db, 'conversations', conversationId);
      transaction.update(conversationRef, {
        lastMessage: lastMessagePreview,
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return messageId;
    });

    try {
      const convSnap = await getDoc(doc(db, 'conversations', conversationId));
      const trainerId = convSnap.exists() ? convSnap.data()?.trainerId : null;
      if (trainerId && trainerId !== senderId) {
        const cname = metadata.clientName || metadata.name || 'Client';
        const pushTitle =
          requestType === CLIENT_REQUEST_TYPES.WORKOUT_PLAN
            ? `Workout plan request from ${cname}`
            : requestType === CLIENT_REQUEST_TYPES.GENERAL
              ? `New request from ${cname}`
              : randomClientRequestTitle(cname);
        const pushBody =
          requestType === CLIENT_REQUEST_TYPES.CONNECTION
            ? text
              ? `${cname}: ${text.substring(0, 120)}`
              : `${cname} sent a connection request`
            : text
              ? `${requestTitle}: ${text.substring(0, 120)}`
              : requestTitle;
        void postRemotePushNotify({
          recipientId: trainerId,
          senderName: pushTitle,
          messageText: pushBody,
          senderId,
          conversationId,
          messageId: result,
          notificationType: 'client_request',
        });
      }
    } catch (e) {
      console.warn('Client request push skipped:', e?.message || e);
    }

    return result;
  } catch (error) {
    console.error('Error sending client request:', error);
    throw error;
  }
}

/**
 * Update a message's status (for accept/reject flow)
 * @param {string} messageId - The message document ID
 * @param {Object} updates - { status, responseTimestamp }
 */
export async function updateMessageStatus(messageId, updates) {
  try {
    const messageRef = doc(db, 'messages', messageId);
    await updateDoc(messageRef, updates);
  } catch (error) {
    console.error('Error updating message status:', error);
    throw error;
  }
}

/**
 * Fetch one page of messages (newest first in query, returned ascending).
 */
export async function getMessages(conversationId) {
  if (!conversationId) return [];
  try {
    const messagesRef = collection(db, 'messages');
    const primary = query(
      messagesRef,
      where('conversationId', '==', conversationId),
      orderBy('timestamp', 'desc'),
      limit(MESSAGES_PAGE_SIZE),
    );
    const fallback = () =>
      query(messagesRef, where('conversationId', '==', conversationId), limit(MESSAGES_PAGE_SIZE));

    const snap = await getDocsWithIndexFallback(primary, fallback, 'getMessages');
    return filterChatMessages(sortMessagesAsc(snap.docs.map(mapMessageDoc)));
  } catch (error) {
    console.error('Error getting messages:', error);
    throw error;
  }
}

/**
 * Load older messages before `beforeTimestamp` (for Load earlier UI).
 */
export async function loadEarlierMessages(conversationId, beforeTimestamp) {
  if (!conversationId || !beforeTimestamp) {
    return { messages: [], hasMore: false };
  }
  try {
    const messagesRef = collection(db, 'messages');
    const primary = query(
      messagesRef,
      where('conversationId', '==', conversationId),
      orderBy('timestamp', 'desc'),
      startAfter(beforeTimestamp),
      limit(MESSAGES_PAGE_SIZE),
    );
    const fallback = () =>
      query(messagesRef, where('conversationId', '==', conversationId), limit(MESSAGES_PAGE_SIZE));

    const snap = await getDocsWithIndexFallback(primary, fallback, 'loadEarlierMessages');
    const messages = filterChatMessages(sortMessagesAsc(snap.docs.map(mapMessageDoc)));
    const hasMore = snap.docs.length >= MESSAGES_PAGE_SIZE;
    return { messages, hasMore };
  } catch (error) {
    console.error('Error loading earlier messages:', error);
    throw error;
  }
}

/**
 * Subscribe to real-time messages for a conversation
 * @param {string} conversationId - The conversation ID
 * @param {Function} callback - Callback function to receive messages
 * @returns {Function} Unsubscribe function
 */
export function subscribeToMessages(conversationId, callback) {
  if (!conversationId || !callback) return () => {};

  const messagesRef = collection(db, 'messages');
  const pageSize = MESSAGES_PAGE_SIZE;
  const primary = query(
    messagesRef,
    where('conversationId', '==', conversationId),
    orderBy('timestamp', 'desc'),
    limit(pageSize),
  );
  const fallback = () =>
    query(messagesRef, where('conversationId', '==', conversationId), limit(pageSize));

  let unsubscribe = () => {};
  let activeQuery = primary;

  const attach = () => {
    unsubscribe = onSnapshot(
      activeQuery,
      (querySnapshot) => {
        const messages = filterChatMessages(sortMessagesAsc(querySnapshot.docs.map(mapMessageDoc)));
        const hasMore = querySnapshot.docs.length >= pageSize;
        const oldestTimestamp = messages.length ? messages[0].timestamp : null;
        callback(messages, { hasMore, oldestTimestamp });
      },
      (err) => {
        console.error('subscribeToMessages error:', err);
        callback([], { hasMore: false, oldestTimestamp: null });
      },
    );
  };

  void getDocsWithIndexFallback(primary, fallback, 'subscribeToMessages')
    .then(() => {
      activeQuery = primary;
      attach();
    })
    .catch(() => {
      activeQuery = fallback();
      attach();
    });

  return () => {
    try {
      unsubscribe();
    } catch (_) {
      /* ignore */
    }
  };
}

/**
 * Get all conversations for a user
 * @param {string} userId - The user's ID
 * @returns {Promise<Array>} Array of conversations
 */
export async function getUserConversations(userId) {
  try {
    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', userId)
      // Removed orderBy to avoid requiring composite index - we'll sort in JavaScript
    );

    const querySnapshot = await getDocs(q);
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

    return conversations;
  } catch (error) {
    console.error('Error getting user conversations:', error);
    throw error;
  }
}

/**
 * Mark messages as read
 * @param {string} conversationId - The conversation ID
 * @param {string} userId - The user ID marking messages as read
 */
export async function markMessagesAsRead(conversationId, userId) {
  try {
    // Get all messages for the conversation (no complex query to avoid index requirement)
    const messagesRef = collection(db, 'messages');
    const q = query(
      messagesRef,
      where('conversationId', '==', conversationId)
      // Removed other where clauses to avoid composite index requirement
    );

    const querySnapshot = await getDocs(q);
    const updatePromises = [];

    // Filter in JavaScript instead of Firestore query
    querySnapshot.forEach((docSnap) => {
      const messageData = docSnap.data();
      // Only mark as read if: not sent by current user, and not already read
      if (messageData.senderId !== userId && !messageData.read) {
        updatePromises.push(
          updateDoc(doc(db, 'messages', docSnap.id), {
            read: true,
          })
        );
      }
    });

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }
  } catch (error) {
    console.error('Error marking messages as read:', error);
    // Don't throw - this is not critical
  }
}

/**
 * Get user data by ID. Tries `users` first; on missing doc or permission-denied (e.g. client
 * reading a trainer's private user doc), falls back to `trainers/{id}` — readable by any
 * signed-in user for marketplace profiles.
 * @param {string} userId - The user's ID
 * @returns {Promise<Object|null>} User data or null
 */
export async function getUserData(userId) {
  const id = typeof userId === 'string' ? userId.trim() : '';
  if (!id) return null;

  try {
    const userDoc = await getDoc(doc(db, 'users', id));
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() };
    }
  } catch (error) {
    const code = error?.code || '';
    const msg = String(error?.message || '').toLowerCase();
    const isDenied = code === 'permission-denied' || msg.includes('insufficient permissions');
    if (!isDenied) {
      console.error('Error getting user data:', error);
      return null;
    }
  }

  try {
    const trainerSnap = await getDoc(doc(db, 'trainers', id));
    if (trainerSnap.exists()) {
      const d = trainerSnap.data();
      return {
        id: trainerSnap.id,
        ...d,
        displayName: d.displayName || d.name,
        name: d.name || d.displayName,
      };
    }
  } catch (e2) {
    console.warn('getUserData: trainers fallback failed', id, e2?.message || e2);
  }

  return null;
}
/**
 * Get total unread message count for a user across all conversations
 * @param {string} userId - The user's ID
 * @returns {Promise<number>} Total unread message count
 */
export async function getUnreadMessageCount(userId) {
  try {
    // Get all conversations for the user
    const conversations = await getUserConversations(userId);
    
    // Count unread messages in all conversations
    let totalUnread = 0;
    
    for (const conv of conversations) {
      const messagesRef = collection(db, 'messages');
      // Only query by conversationId to avoid index requirement
      const q = query(
        messagesRef,
        where('conversationId', '==', conv.id)
      );
      
      const querySnapshot = await getDocs(q);
      // Filter in JavaScript
      querySnapshot.forEach((doc) => {
        const messageData = doc.data();
        if (messageData.senderId !== userId && messageData.read === false) {
          totalUnread++;
        }
      });
    }
    
    return totalUnread;
  } catch (error) {
    console.error('Error getting unread message count:', error);
    return 0;
  }
}

/**
 * Subscribe to unread message count changes for a user
 * @param {string} userId - The user's ID
 * @param {Function} callback - Callback function to receive unread count
 * @returns {Function} Unsubscribe function
 */
export function subscribeToUnreadCount(userId, callback) {
  // Subscribe to all conversations for the user
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
    let completedQueries = 0;
    const totalConversations = conversationsSnapshot.size;

    if (totalConversations === 0) {
      callback(0);
      return;
    }

    // For each conversation, count unread messages
    conversationsSnapshot.forEach((convDoc) => {
      const conversationId = convDoc.id;
      const messagesRef = collection(db, 'messages');
      // Only query by conversationId to avoid index requirement
      const messagesQuery = query(
        messagesRef,
        where('conversationId', '==', conversationId)
      );

      const unsubscribe = onSnapshot(messagesQuery, async () => {
        // Recalculate total by querying all conversations
        let newTotal = 0;
        completedQueries = 0;
        
        conversationsSnapshot.forEach(async (conv) => {
          const convId = conv.id;
          const msgsRef = collection(db, 'messages');
          const msgsQuery = query(
            msgsRef,
            where('conversationId', '==', convId)
          );
          
          try {
            const msgsSnapshot = await getDocs(msgsQuery);
            // Filter in JavaScript
            msgsSnapshot.forEach((doc) => {
              const messageData = doc.data();
              if (messageData.senderId !== userId && messageData.read === false) {
                newTotal++;
              }
            });
            
            completedQueries++;
            if (completedQueries === totalConversations) {
              callback(newTotal);
            }
          } catch (error) {
            console.error('Error counting unread:', error);
            completedQueries++;
            if (completedQueries === totalConversations) {
              callback(newTotal);
            }
          }
        });
      });

      unsubscribeFunctions.push(unsubscribe);
    });
  });

  // Return cleanup function
  return () => {
    conversationsUnsubscribe();
    unsubscribeFunctions.forEach(unsub => unsub());
  };
}

/** How long after `typingAt` we hide the “typing…” UI without a new pulse. */
export const TYPING_UI_STALE_MS = 4500;

/**
 * Live typing hints on `conversations/{conversationId}` (participants may update per rules).
 * @param {(meta: { typingUserId: string|null, typingAt: object|null }) => void} listener
 */
export function subscribeConversationTyping(conversationId, listener) {
  if (!db || !conversationId || typeof listener !== 'function') return () => {};
  const ref = doc(db, 'conversations', conversationId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        listener({ typingUserId: null, typingAt: null });
        return;
      }
      const d = snap.data() || {};
      listener({
        typingUserId: d.typingUserId ?? null,
        typingAt: d.typingAt ?? null,
      });
    },
    () => listener({ typingUserId: null, typingAt: null }),
  );
}

export async function pulseConversationTyping(conversationId, userId) {
  if (!db || !conversationId || !userId) return;
  try {
    await updateDoc(doc(db, 'conversations', conversationId), {
      typingUserId: userId,
      typingAt: serverTimestamp(),
    });
  } catch (e) {
    if (__DEV__) console.warn('pulseConversationTyping:', e?.message || e);
  }
}

export async function clearMyConversationTyping(conversationId, userId) {
  if (!db || !conversationId || !userId) return;
  try {
    const ref = doc(db, 'conversations', conversationId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const cur = snap.data()?.typingUserId;
    if (cur === userId) {
      await updateDoc(ref, {
        typingUserId: deleteField(),
        typingAt: deleteField(),
      });
    }
  } catch (e) {
    if (__DEV__) console.warn('clearMyConversationTyping:', e?.message || e);
  }
}

