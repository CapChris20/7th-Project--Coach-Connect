// Chat Storage Service
// Handles saving and loading multiple chat conversations from AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';

const CHATS_STORAGE_KEY = 'ANATROX_CHATS';
const CURRENT_CHAT_KEY = 'ANATROX_CURRENT_CHAT_ID';

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
 * Get all chats from storage
 * @returns {Promise<Array>} Array of chat objects
 */
export async function getAllChats() {
  try {
    const chatsJson = await AsyncStorage.getItem(CHATS_STORAGE_KEY);
    if (!chatsJson) {
      return [];
    }
    const chats = JSON.parse(chatsJson);
    // Sort by updatedAt (most recent first)
    return chats.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch (error) {
    console.error('Error loading chats:', error);
    return [];
  }
}

/**
 * Get a specific chat by ID
 * @param {string} chatId - The chat ID
 * @returns {Promise<Object|null>} Chat object or null
 */
export async function getChatById(chatId) {
  try {
    const chats = await getAllChats();
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
 * Save a chat to storage
 * @param {Object} chat - Chat object to save
 * @returns {Promise<boolean>} Success status
 */
export async function saveChat(chat) {
  try {
    const chats = await getAllChats();
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
    
    await AsyncStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(chats));
    return true;
  } catch (error) {
    console.error('Error saving chat:', error);
    return false;
  }
}

/**
 * Create a new chat
 * @param {string} title - Optional title for the chat
 * @returns {Promise<Object>} New chat object
 */
export async function createNewChat(title = 'New Chat') {
  const newChat = {
    id: generateChatId(),
    title,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  await saveChat(newChat);
  return newChat;
}

/**
 * Delete a chat
 * @param {string} chatId - The chat ID to delete
 * @returns {Promise<boolean>} Success status
 */
export async function deleteChat(chatId) {
  try {
    const chats = await getAllChats();
    const filtered = chats.filter(chat => chat.id !== chatId);
    await AsyncStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error deleting chat:', error);
    return false;
  }
}

/**
 * Update chat messages
 * @param {string} chatId - The chat ID
 * @param {Array} messages - Array of messages
 * @returns {Promise<boolean>} Success status
 */
export async function updateChatMessages(chatId, messages) {
  try {
    const chat = await getChatById(chatId);
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
    
    return await saveChat(chat);
  } catch (error) {
    console.error('Error updating chat messages:', error);
    return false;
  }
}

/**
 * Get the current/last active chat ID
 * @returns {Promise<string|null>} Current chat ID or null
 */
export async function getCurrentChatId() {
  try {
    return await AsyncStorage.getItem(CURRENT_CHAT_KEY);
  } catch (error) {
    console.error('Error getting current chat ID:', error);
    return null;
  }
}

/**
 * Set the current/last active chat ID
 * @param {string} chatId - The chat ID to set as current
 * @returns {Promise<boolean>} Success status
 */
export async function setCurrentChatId(chatId) {
  try {
    await AsyncStorage.setItem(CURRENT_CHAT_KEY, chatId);
    return true;
  } catch (error) {
    console.error('Error setting current chat ID:', error);
    return false;
  }
}

/**
 * Clear all chats (use with caution)
 * @returns {Promise<boolean>} Success status
 */
export async function clearAllChats() {
  try {
    await AsyncStorage.removeItem(CHATS_STORAGE_KEY);
    await AsyncStorage.removeItem(CURRENT_CHAT_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing all chats:', error);
    return false;
  }
}

