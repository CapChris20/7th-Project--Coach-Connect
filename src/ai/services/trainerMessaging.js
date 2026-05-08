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
  serverTimestamp,
  onSnapshot,
  updateDoc,
  runTransaction,
} from 'firebase/firestore';
import { postRemotePushNotify } from '../../shared/services/pushNotifyApi';
import { randomClientRequestTitle } from '../../shared/notifications/pushCopy';

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
    if (!conversationId || !senderId || !messageText) {
      throw new Error('Missing required parameters: conversationId, senderId, or messageText');
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const messageData = {
      id: messageId,
      conversationId,
      senderId,
      text: messageText,
      timestamp: serverTimestamp(),
      read: false,
      status: 'pending',
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
        lastMessage: messageText,
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
        void postRemotePushNotify({
          recipientId: trainerId,
          senderName: randomClientRequestTitle(cname),
          messageText: `${cname}: ${messageText.substring(0, 120)}`,
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
 * Get all messages for a conversation
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Array>} Array of messages
 */
export async function getMessages(conversationId) {
  try {
    const messagesRef = collection(db, 'messages');
    const q = query(
      messagesRef,
      where('conversationId', '==', conversationId)
      // Removed orderBy to avoid requiring composite index - we'll sort in JavaScript
    );

    const querySnapshot = await getDocs(q);
    const messages = [];

    querySnapshot.forEach((doc) => {
      messages.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Sort by timestamp in JavaScript
    messages.sort((a, b) => {
      const timeA = a.timestamp?.toMillis?.() || a.timestamp || 0;
      const timeB = b.timestamp?.toMillis?.() || b.timestamp || 0;
      return timeA - timeB;
    });

    return messages;
  } catch (error) {
    console.error('Error getting messages:', error);
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
  const messagesRef = collection(db, 'messages');
  const q = query(
    messagesRef,
    where('conversationId', '==', conversationId)
    // Removed orderBy to avoid requiring composite index - we'll sort in JavaScript
  );

  return onSnapshot(q, (querySnapshot) => {
    const messages = [];
    querySnapshot.forEach((doc) => {
      messages.push({
        id: doc.id,
        ...doc.data(),
      });
    });
    
    // Sort by timestamp in JavaScript
    messages.sort((a, b) => {
      const timeA = a.timestamp?.toMillis?.() || a.timestamp || 0;
      const timeB = b.timestamp?.toMillis?.() || b.timestamp || 0;
      return timeA - timeB;
    });
    
    callback(messages);
  });
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


