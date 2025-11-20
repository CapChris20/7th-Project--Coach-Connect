// Trainer Messaging Service
// Handles real-time messaging between clients and trainers
import { db } from './config';
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
} from 'firebase/firestore';

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
    // This way we can check if it exists without querying
    const conversationId = `conv_${clientId}_${trainerId}`;
    
    // Try to get the conversation first
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationDoc = await getDoc(conversationRef);
    
    if (conversationDoc.exists()) {
      console.log('✅ Found existing conversation:', conversationId);
      return conversationId;
    }

    // Create new conversation
    console.log('🆕 Creating new conversation:', conversationId);
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

    await setDoc(conversationRef, conversationData);
    console.log('✅ Conversation created successfully:', conversationId);
    return conversationId;
  } catch (error) {
    console.error('❌ Error getting/creating conversation:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
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

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const messageData = {
      id: messageId,
      conversationId,
      senderId,
      text: messageText,
      timestamp: serverTimestamp(),
      read: false,
    };

    console.log('💾 Creating message document:', messageId);
    // Save message
    await setDoc(doc(db, 'messages', messageId), messageData);
    console.log('✅ Message document created successfully');

    console.log('🔄 Updating conversation:', conversationId);
    // Update conversation with last message
    const conversationRef = doc(db, 'conversations', conversationId);
    await updateDoc(conversationRef, {
      lastMessage: messageText,
      lastMessageTime: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log('✅ Conversation updated successfully');

    return messageId;
  } catch (error) {
    console.error('❌ Error sending message:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Full error:', JSON.stringify(error, null, 2));
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
 * Get user data by ID
 * @param {string} userId - The user's ID
 * @returns {Promise<Object|null>} User data or null
 */
export async function getUserData(userId) {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
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
        if (messageData.senderId !== userId && !messageData.read) {
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
              if (messageData.senderId !== userId && !messageData.read) {
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

