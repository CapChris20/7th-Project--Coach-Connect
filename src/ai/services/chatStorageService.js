// Chat Storage Service
// Handles saving and loading multiple chat conversations from AsyncStorage
// NOW USER-SPECIFIC - each user has their own isolated chats!
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../../app/config';

// Get user-specific storage keys
function getChatsStorageKey(userId) {
  if (!userId) {
    console.warn('⚠️ No userId provided to getChatsStorageKey - using fallback');
    return 'COACHCONNECT_CHATS_FALLBACK';
  }
  return `COACHCONNECT_CHATS_${userId}`;
}

function getCurrentChatKey(userId) {
  if (!userId) {
    console.warn('⚠️ No userId provided to getCurrentChatKey - using fallback');
    return 'COACHCONNECT_CURRENT_CHAT_ID_FALLBACK';
  }
  return `COACHCONNECT_CURRENT_CHAT_ID_${userId}`;
}

// Get current user ID from auth
function getCurrentUserId() {
  try {
    return auth?.currentUser?.uid || null;
  } catch (e) {
    return null;
  }
}

/**
 * Chat structure:
 * {
 *   id: string (unique ID),
 *   title: string (first message or "New Chat"),
 *   messages: Array<{ role: 'user'|'assistant', content: string, imageUri?: string, timestamp: number }>,
 *   createdAt: number (timestamp),
 *   updatedAt: number (timestamp),
 * }
 */

/**
 * Generate a unique chat ID
 */
function generateChatId() {
  return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get all chats from storage (user-specific)
 * @param {string} userId - Optional user ID, will use current user if not provided
 * @returns {Promise<Array>} Array of chat objects
 */
export async function getAllChats(userId = null) {
  try {
    const currentUserId = userId || getCurrentUserId();
    if (!currentUserId) {
      if (__DEV__) console.warn('⚠️ No user ID available for getAllChats');
      return [];
    }
    
    const storageKey = getChatsStorageKey(currentUserId);
    const chatsJson = await AsyncStorage.getItem(storageKey);
    if (!chatsJson) {
      return [];
    }
    let chats;
    try {
      chats = JSON.parse(chatsJson);
    } catch (parseError) {
      if (__DEV__) console.error('Error parsing chats JSON:', parseError);
      return [];
    }
    // Sort by updatedAt (most recent first)
    return chats.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch (error) {
    if (__DEV__) console.error('Error loading chats:', error);
    return [];
  }
}

/**
 * Get a specific chat by ID (user-specific)
 * @param {string} chatId - The chat ID
 * @param {string} userId - Optional user ID, will use current user if not provided
 * @returns {Promise<Object|null>} Chat object or null
 */
export async function getChatById(chatId, userId = null) {
  try {
    const chats = await getAllChats(userId);
    const chat = chats.find(chat => chat.id === chatId);
    if (chat) {
      // Ensure messages array exists (might be undefined in old chats)
      if (!Array.isArray(chat.messages)) {
        chat.messages = [];
      }
    }
    return chat || null;
  } catch (error) {
    console.error('Error getting chat:', error);
    return null;
  }
}

/**
 * Save a chat to storage (user-specific)
 * @param {Object} chat - Chat object to save
 * @param {string} userId - Optional user ID, will use current user if not provided
 * @returns {Promise<boolean>} Success status
 */
export async function saveChat(chat, userId = null) {
  try {
    const currentUserId = userId || getCurrentUserId();
    if (!currentUserId) {
      console.warn('⚠️ No user ID available for saveChat');
      return false;
    }
    
    const chats = await getAllChats(currentUserId);
    const existingIndex = chats.findIndex(c => c.id === chat.id);
    
    // Update existing or add new
    if (existingIndex >= 0) {
      chats[existingIndex] = {
        ...chat,
        updatedAt: Date.now(),
      };
    } else {
      chats.push({
        ...chat,
        createdAt: chat.createdAt || Date.now(),
        updatedAt: Date.now(),
      });
    }
    
    // Update title from first user message if not set
    if (!chat.title || chat.title === 'New Chat') {
      const firstUserMessage = chat.messages.find(m => m.role === 'user');
      if (firstUserMessage) {
        const title = firstUserMessage.content.slice(0, 50).trim();
        const chatIndex = chats.findIndex(c => c.id === chat.id);
        if (chatIndex >= 0) {
          chats[chatIndex].title = title || 'New Chat';
        }
      }
    }
    
    const storageKey = getChatsStorageKey(currentUserId);
    await AsyncStorage.setItem(storageKey, JSON.stringify(chats));
    return true;
  } catch (error) {
    console.error('Error saving chat:', error);
    return false;
  }
}

/**
 * Create a new chat (user-specific)
 * @param {string} title - Optional title for the chat
 * @param {string} userId - Optional user ID, will use current user if not provided
 * @returns {Promise<Object>} New chat object
 */
export async function createNewChat(title = 'New Chat', userId = null) {
  const newChat = {
    id: generateChatId(),
    title,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  await saveChat(newChat, userId);
  return newChat;
}

/**
 * Delete a chat (user-specific)
 * @param {string} chatId - The chat ID to delete
 * @param {string} userId - Optional user ID, will use current user if not provided
 * @returns {Promise<boolean>} Success status
 */
export async function deleteChat(chatId, userId = null) {
  try {
    const currentUserId = userId || getCurrentUserId();
    if (!currentUserId) {
      console.warn('⚠️ No user ID available for deleteChat');
      return false;
    }
    
    const chats = await getAllChats(currentUserId);
    const filtered = chats.filter(chat => chat.id !== chatId);
    const storageKey = getChatsStorageKey(currentUserId);
    await AsyncStorage.setItem(storageKey, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error deleting chat:', error);
    return false;
  }
}

/**
 * Update chat messages (user-specific)
 * @param {string} chatId - The chat ID
 * @param {Array} messages - Array of messages
 * @param {string} userId - Optional user ID, will use current user if not provided
 * @returns {Promise<boolean>} Success status
 */
export async function updateChatMessages(chatId, messages, userId = null) {
  try {
    const chat = await getChatById(chatId, userId);
    if (!chat) {
      return false;
    }
    
    chat.messages = messages;
    chat.updatedAt = Date.now();
    
    // Update title from first user message if needed
    if (!chat.title || chat.title === 'New Chat') {
      const firstUserMessage = messages.find(m => m.role === 'user');
      if (firstUserMessage) {
        chat.title = firstUserMessage.content.slice(0, 50).trim() || 'New Chat';
      }
    }
    
    return await saveChat(chat, userId);
  } catch (error) {
    console.error('Error updating chat messages:', error);
    return false;
  }
}

/**
 * Get the current/last active chat ID (user-specific)
 * @param {string} userId - Optional user ID, will use current user if not provided
 * @returns {Promise<string|null>} Current chat ID or null
 */
export async function getCurrentChatId(userId = null) {
  try {
    const currentUserId = userId || getCurrentUserId();
    if (!currentUserId) {
      return null;
    }
    
    const storageKey = getCurrentChatKey(currentUserId);
    return await AsyncStorage.getItem(storageKey);
  } catch (error) {
    console.error('Error getting current chat ID:', error);
    return null;
  }
}

/**
 * Set the current/last active chat ID (user-specific)
 * @param {string} chatId - The chat ID to set as current
 * @param {string} userId - Optional user ID, will use current user if not provided
 * @returns {Promise<boolean>} Success status
 */
export async function setCurrentChatId(chatId, userId = null) {
  try {
    const currentUserId = userId || getCurrentUserId();
    if (!currentUserId) {
      console.warn('⚠️ No user ID available for setCurrentChatId');
      return false;
    }
    
    const storageKey = getCurrentChatKey(currentUserId);
    await AsyncStorage.setItem(storageKey, chatId);
    return true;
  } catch (error) {
    console.error('Error setting current chat ID:', error);
    return false;
  }
}

/**
 * Clear all chats for a specific user (use with caution)
 * @param {string} userId - Optional user ID, will use current user if not provided
 * @returns {Promise<boolean>} Success status
 */
export async function clearAllChats(userId = null) {
  try {
    const currentUserId = userId || getCurrentUserId();
    if (!currentUserId) {
      console.warn('⚠️ No user ID available for clearAllChats');
      return false;
    }
    
    const chatsKey = getChatsStorageKey(currentUserId);
    const currentChatKey = getCurrentChatKey(currentUserId);
    await AsyncStorage.removeItem(chatsKey);
    await AsyncStorage.removeItem(currentChatKey);
    return true;
  } catch (error) {
    console.error('Error clearing all chats:', error);
    return false;
  }
}

/**
 * Clear chats for ALL users (migration helper - removes old shared storage)
 * @returns {Promise<boolean>} Success status
 */
export async function clearOldSharedChats() {
  try {
    // Remove old shared storage keys (for migration)
    await AsyncStorage.removeItem('COACHCONNECT_CHATS');
    await AsyncStorage.removeItem('COACHCONNECT_CURRENT_CHAT_ID');
    return true;
  } catch (error) {
    console.error('Error clearing old shared chats:', error);
    return false;
  }
}

