// Saves and loads this user's coach chats on the device.
// Flow: key the storage by user id → read the JSON list → update one chat →
//       write the list back. Each user has their own key so chats do not leak across accounts.
// Used by the coach conversation and by login cleanup (the old shared keys).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../../app-start/cloudConnection';
import { makeChatTitle } from './makeChatTitle';

// ===== NAMED CONSTANTS =====

const NEW_CHAT_TITLE = 'New Chat';
// Manipulate here: how many characters of the first message become the fallback title.
const TITLE_PREVIEW_LENGTH = 50;
// Manipulate here: random tail on chat ids. Longer is safer against a collision, not more readable.
const CHAT_ID_RANDOM_LENGTH = 9;

const CHATS_KEY_PREFIX = 'COACHCONNECT_CHATS_';
const CURRENT_CHAT_KEY_PREFIX = 'COACHCONNECT_CURRENT_CHAT_ID_';
const CHATS_KEY_FALLBACK = 'COACHCONNECT_CHATS_FALLBACK';
const CURRENT_CHAT_KEY_FALLBACK = 'COACHCONNECT_CURRENT_CHAT_ID_FALLBACK';
// Written before chats were split per user. clearOldSharedChats removes these on login.
const LEGACY_SHARED_CHATS_KEY = 'COACHCONNECT_CHATS';
const LEGACY_SHARED_CURRENT_CHAT_KEY = 'COACHCONNECT_CURRENT_CHAT_ID';

// ===== HELPER FUNCTIONS =====

/**
 * AsyncStorage only has strings, so each user gets their own key.
 * No user id means the fallback key, which is shared and should stay empty.
 * @param {string} userId
 * @returns {string}
 */
function getChatsStorageKey(userId) {
  if (!userId) {
    console.warn('⚠️ No userId provided to getChatsStorageKey - using fallback');
    return CHATS_KEY_FALLBACK;
  }
  return `${CHATS_KEY_PREFIX}${userId}`;
}

/**
 * @param {string} userId
 * @returns {string}
 */
function getCurrentChatKey(userId) {
  if (!userId) {
    console.warn('⚠️ No userId provided to getCurrentChatKey - using fallback');
    return CURRENT_CHAT_KEY_FALLBACK;
  }
  return `${CURRENT_CHAT_KEY_PREFIX}${userId}`;
}

/**
 * vocab: auth.currentUser = whoever Firebase says is signed in right now. Null on the login screen.
 * @returns {string|null}
 */
function getCurrentUserId() {
  try {
    return auth?.currentUser?.uid || null;
  } catch (ignoredError) {
    return null;
  }
}

/**
 * The id passed in wins. Otherwise the signed-in user. Null when nobody is signed in.
 * @param {string|null} userId
 * @returns {string|null}
 */
function resolveUserId(userId) {
  return userId || getCurrentUserId();
}

/**
 * chat_ + time + a random tail. The time keeps them sortable. The tail avoids a clash
 * if two chats are created in the same millisecond.
 * vocab: toString(36) = base-36 so the random part is letters and digits, not a long decimal.
 * @returns {string}
 */
function generateChatId() {
  return `chat_${Date.now()}_${Math.random().toString(36).substr(2, CHAT_ID_RANDOM_LENGTH)}`;
}

/**
 * @param {object} message
 * @returns {string}
 */
function fallbackTitleFromMessage(message) {
  return message.content.slice(0, TITLE_PREVIEW_LENGTH).trim() || NEW_CHAT_TITLE;
}

/**
 * The title API only needs role and content. Image and timestamp stay out of that call.
 * @param {object[]} messages
 * @returns {object[]}
 */
function messagesForTitleApi(messages) {
  return messages.map((message) => ({ role: message.role, content: message.content }));
}

/**
 * Newest updatedAt first. A chat with no updatedAt sorts as 0.
 * @param {object[]} chats
 * @returns {object[]}
 */
function sortChatsNewestFirst(chats) {
  return chats.sort((first, second) => (second.updatedAt || 0) - (first.updatedAt || 0));
}

// ===== MAIN FUNCTION =====

/**
 * Every saved chat for this user, newest first.
 * @param {string|null} [userId] Uses the signed-in user when omitted
 * @returns {Promise<object[]>}
 */
export async function getAllChats(userId = null) {
  try {
    const currentUserId = resolveUserId(userId);
    if (!currentUserId) {
      if (__DEV__) console.warn('⚠️ No user ID available for getAllChats');
      return [];
    }

    const storageKey = getChatsStorageKey(currentUserId);
    const chatsJson = await AsyncStorage.getItem(storageKey);
    if (!chatsJson) return [];

    let chats;
    try {
      chats = JSON.parse(chatsJson);
    } catch (parseError) {
      if (__DEV__) console.error('Error parsing chats JSON:', parseError);
      return [];
    }
    return sortChatsNewestFirst(chats);
  } catch (error) {
    if (__DEV__) console.error('Error loading chats:', error);
    return [];
  }
}

/**
 * One chat by id. Older saves sometimes have no messages array; those become [].
 * @param {string} chatId
 * @param {string|null} [userId]
 * @returns {Promise<object|null>}
 */
export async function getChatById(chatId, userId = null) {
  try {
    const chats = await getAllChats(userId);
    const chat = chats.find((savedChat) => savedChat.id === chatId);
    if (chat && !Array.isArray(chat.messages)) {
      chat.messages = [];
    }
    return chat || null;
  } catch (error) {
    console.error('Error getting chat:', error);
    return null;
  }
}

/**
 * Insert or replace one chat, then write the whole list back.
 * A missing title is filled from the first user message before the write.
 * @param {object} chat
 * @param {string|null} [userId]
 * @returns {Promise<boolean>}
 */
export async function saveChat(chat, userId = null) {
  try {
    const currentUserId = resolveUserId(userId);
    if (!currentUserId) {
      console.warn('⚠️ No user ID available for saveChat');
      return false;
    }

    const chats = await getAllChats(currentUserId);
    const existingIndex = chats.findIndex((savedChat) => savedChat.id === chat.id);

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

    // Title is filled after the insert so we write it onto the copy that is about to be stored.
    if (!chat.title || chat.title === NEW_CHAT_TITLE) {
      const firstUserMessage = chat.messages.find((message) => message.role === 'user');
      if (firstUserMessage) {
        const fallback = fallbackTitleFromMessage(firstUserMessage);
        const title = await makeChatTitle(messagesForTitleApi(chat.messages), fallback);
        const chatIndex = chats.findIndex((savedChat) => savedChat.id === chat.id);
        if (chatIndex >= 0) {
          chats[chatIndex].title = title || fallback;
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
 * A blank chat, already stored, so the history list can show it immediately.
 * @param {string} [title]
 * @param {string|null} [userId]
 * @returns {Promise<object>}
 */
export async function createNewChat(title = NEW_CHAT_TITLE, userId = null) {
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
 * Remove one chat. Missing user id is a no-op, not a throw.
 * @param {string} chatId
 * @param {string|null} [userId]
 * @returns {Promise<boolean>}
 */
export async function deleteChat(chatId, userId = null) {
  try {
    const currentUserId = resolveUserId(userId);
    if (!currentUserId) {
      console.warn('⚠️ No user ID available for deleteChat');
      return false;
    }

    const chats = await getAllChats(currentUserId);
    const filtered = chats.filter((savedChat) => savedChat.id !== chatId);
    const storageKey = getChatsStorageKey(currentUserId);
    await AsyncStorage.setItem(storageKey, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error deleting chat:', error);
    return false;
  }
}

/**
 * Replace a chat's messages and refresh the title when it is still "New Chat."
 * Unlike saveChat, a failed title API result is stored as-is (it is not swapped for the fallback).
 * @param {string} chatId
 * @param {object[]} messages
 * @param {string|null} [userId]
 * @returns {Promise<boolean>}
 */
export async function updateChatMessages(chatId, messages, userId = null) {
  try {
    const chat = await getChatById(chatId, userId);
    if (!chat) return false;

    chat.messages = messages;
    chat.updatedAt = Date.now();

    if (!chat.title || chat.title === NEW_CHAT_TITLE) {
      const firstUserMessage = messages.find((message) => message.role === 'user');
      if (firstUserMessage) {
        const fallback = fallbackTitleFromMessage(firstUserMessage);
        chat.title = await makeChatTitle(messagesForTitleApi(messages), fallback);
      }
    }

    return await saveChat(chat, userId);
  } catch (error) {
    console.error('Error updating chat messages:', error);
    return false;
  }
}

/**
 * The chat the user had open last time.
 * @param {string|null} [userId]
 * @returns {Promise<string|null>}
 */
export async function getCurrentChatId(userId = null) {
  try {
    const currentUserId = resolveUserId(userId);
    if (!currentUserId) return null;

    const storageKey = getCurrentChatKey(currentUserId);
    return await AsyncStorage.getItem(storageKey);
  } catch (error) {
    console.error('Error getting current chat ID:', error);
    return null;
  }
}

/**
 * Remember which chat is open so the next launch can reopen it.
 * @param {string} chatId
 * @param {string|null} [userId]
 * @returns {Promise<boolean>}
 */
export async function setCurrentChatId(chatId, userId = null) {
  try {
    const currentUserId = resolveUserId(userId);
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
 * Wipe this user's chats and the "current chat" pointer. Use with caution.
 * @param {string|null} [userId]
 * @returns {Promise<boolean>}
 */
export async function clearAllChats(userId = null) {
  try {
    const currentUserId = resolveUserId(userId);
    if (!currentUserId) {
      console.warn('⚠️ No user ID available for clearAllChats');
      return false;
    }

    await AsyncStorage.removeItem(getChatsStorageKey(currentUserId));
    await AsyncStorage.removeItem(getCurrentChatKey(currentUserId));
    return true;
  } catch (error) {
    console.error('Error clearing all chats:', error);
    return false;
  }
}

/**
 * Remove the pre-per-user storage keys. Login calls this once so old shared chats do not linger.
 * @returns {Promise<boolean>}
 */
export async function clearOldSharedChats() {
  try {
    await AsyncStorage.removeItem(LEGACY_SHARED_CHATS_KEY);
    await AsyncStorage.removeItem(LEGACY_SHARED_CURRENT_CHAT_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing old shared chats:', error);
    return false;
  }
}
