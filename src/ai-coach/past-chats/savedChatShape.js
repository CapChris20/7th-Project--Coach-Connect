// Saves and loads this user's coach chats on the device.
// Flow: key storage by user id → read JSON list → patch one chat → write list back.
// Used by coach conversation UI and login cleanup (removes old shared keys).
// Read order: constants → exported storage recipes → PLUMBING.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../../app-start/cloudConnection';
import { makeChatTitle } from './makeChatTitle';

// ===== NAMED CONSTANTS =====

const NEW_CHAT_TITLE = 'New Chat';
// Manipulate here: characters of first user message used when title API fails.
const TITLE_PREVIEW_LENGTH = 50;
// Manipulate here: random suffix length on chat ids — longer reduces collision risk.
const CHAT_ID_RANDOM_LENGTH = 9;
const CHAT_ID_RANDOM_RADIX = 36;
const CHAT_ID_RANDOM_START = 2;

// Storage key letters stay frozen — other screens and login cleanup depend on them.
const CHATS_KEY_PREFIX = 'COACHCONNECT_CHATS_';
const CURRENT_CHAT_KEY_PREFIX = 'COACHCONNECT_CURRENT_CHAT_ID_';
const CHATS_KEY_FALLBACK = 'COACHCONNECT_CHATS_FALLBACK';
const CURRENT_CHAT_KEY_FALLBACK = 'COACHCONNECT_CURRENT_CHAT_ID_FALLBACK';
// Pre-per-user keys; clearOldSharedChats removes them on login.
const LEGACY_SHARED_CHATS_KEY = 'COACHCONNECT_CHATS';
const LEGACY_SHARED_CURRENT_CHAT_KEY = 'COACHCONNECT_CURRENT_CHAT_ID';

const USER_ROLE = 'user';

// ===== MAIN FUNCTION =====

/**
 * Every saved chat for this user, newest first.
 * @param {string|null} [userId] Uses the signed-in user when omitted
 * @returns {Promise<object[]>}
 */
export async function getAllChats(userId = null) {
  try {
    // 1. Resolve which account owns this list.
    const ownerUserId = userIdForReadOperation(userId);
    if (!ownerUserId) return [];

    // 2. Read JSON from device storage and return sorted rows.
    const chatsStorageKey = buildChatsStorageKey(ownerUserId);
    const savedListJson = await AsyncStorage.getItem(chatsStorageKey);
    if (!savedListJson) return [];

    const chatRows = safeParseChatListJson(savedListJson);
    return sortChatsByNewestUpdate(chatRows);
  } catch (loadError) {
    logStorageErrorInDevOnly('Error loading chats:', loadError);
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
    // 1. Load the full list, then find the matching id.
    const allChats = await getAllChats(userId);
    const matchingChat = findChatByIdInList(allChats, chatId);
    if (!matchingChat) return null;

    // 2. Normalize legacy rows that never stored messages.
    ensureChatHasMessagesArray(matchingChat);
    return matchingChat;
  } catch (lookupError) {
    console.error('Error getting chat:', lookupError);
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
    // 1. Writes require a real user id — missing id is a silent failure.
    const ownerUserId = userIdRequiredForWrite(userId, 'saveChat');
    if (!ownerUserId) return false;

    // 2. Merge into the in-memory list, refresh title if still "New Chat", persist.
    const chatList = await getAllChats(ownerUserId);
    replaceOrAppendChatInList(chatList, chat);
    await maybeAssignTitleFromFirstMessage(chatList, chat);
    await persistChatList(ownerUserId, chatList);
    return true;
  } catch (saveError) {
    console.error('Error saving chat:', saveError);
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
  // 1. Build a blank row with a fresh id and timestamps.
  const blankChat = {
    id: buildNewChatId(),
    title,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // 2. Persist so history can show it immediately, then hand the row back.
  await saveChat(blankChat, userId);
  return blankChat;
}

/**
 * Remove one chat. Missing user id is a no-op, not a throw.
 * @param {string} chatId
 * @param {string|null} [userId]
 * @returns {Promise<boolean>}
 */
export async function deleteChat(chatId, userId = null) {
  try {
    // 1. Writes need a real user id.
    const ownerUserId = userIdRequiredForWrite(userId, 'deleteChat');
    if (!ownerUserId) return false;

    // 2. Drop the matching row and write the list back.
    const chatList = await getAllChats(ownerUserId);
    const listWithoutDeleted = removeChatIdFromList(chatList, chatId);
    await persistChatList(ownerUserId, listWithoutDeleted);
    return true;
  } catch (deleteError) {
    console.error('Error deleting chat:', deleteError);
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
    // 1. Load the chat; missing id is a soft failure.
    const chatToUpdate = await getChatById(chatId, userId);
    if (!chatToUpdate) return false;

    // 2. Swap messages, bump updatedAt, maybe retitle, then save.
    chatToUpdate.messages = messages;
    chatToUpdate.updatedAt = Date.now();
    await refreshTitleAfterNewMessages(chatToUpdate, messages);
    return await saveChat(chatToUpdate, userId);
  } catch (updateError) {
    console.error('Error updating chat messages:', updateError);
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
    // 1. Resolve owner — no signed-in user means no pointer.
    const ownerUserId = signedInUserIdOrArgument(userId);
    if (!ownerUserId) return null;

    // 2. Read the per-user "current chat" pointer from device storage.
    const currentChatKey = buildCurrentChatPointerKey(ownerUserId);
    return await AsyncStorage.getItem(currentChatKey);
  } catch (pointerReadError) {
    console.error('Error getting current chat ID:', pointerReadError);
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
    // 1. Writes need a real user id.
    const ownerUserId = userIdRequiredForWrite(userId, 'setCurrentChatId');
    if (!ownerUserId) return false;

    // 2. Store the pointer under the per-user key.
    const currentChatKey = buildCurrentChatPointerKey(ownerUserId);
    await AsyncStorage.setItem(currentChatKey, chatId);
    return true;
  } catch (pointerWriteError) {
    console.error('Error setting current chat ID:', pointerWriteError);
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
    // 1. Writes need a real user id.
    const ownerUserId = userIdRequiredForWrite(userId, 'clearAllChats');
    if (!ownerUserId) return false;

    // 2. Remove both the chat list and the current-chat pointer.
    await AsyncStorage.removeItem(buildChatsStorageKey(ownerUserId));
    await AsyncStorage.removeItem(buildCurrentChatPointerKey(ownerUserId));
    return true;
  } catch (clearError) {
    console.error('Error clearing all chats:', clearError);
    return false;
  }
}

/**
 * Remove the pre-per-user storage keys. Login calls this once so old shared chats do not linger.
 * @returns {Promise<boolean>}
 */
export async function clearOldSharedChats() {
  try {
    // 1. Drop the legacy shared keys that existed before per-user storage.
    await AsyncStorage.removeItem(LEGACY_SHARED_CHATS_KEY);
    await AsyncStorage.removeItem(LEGACY_SHARED_CURRENT_CHAT_KEY);
    return true;
  } catch (legacyClearError) {
    console.error('Error clearing old shared chats:', legacyClearError);
    return false;
  }
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

function buildChatsStorageKey(userId) {
  if (!userId) {
    console.warn('⚠️ No userId provided to getChatsStorageKey - using fallback');
    return CHATS_KEY_FALLBACK;
  }
  return `${CHATS_KEY_PREFIX}${userId}`;
}

function buildCurrentChatPointerKey(userId) {
  if (!userId) {
    console.warn('⚠️ No userId provided to getCurrentChatKey - using fallback');
    return CURRENT_CHAT_KEY_FALLBACK;
  }
  return `${CURRENT_CHAT_KEY_PREFIX}${userId}`;
}

function readSignedInFirebaseUid() {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    if (!currentUser.uid) return null;
    return currentUser.uid;
  } catch (ignoredAuthError) {
    return null;
  }
}

function signedInUserIdOrArgument(explicitUserId) {
  if (explicitUserId) return explicitUserId;
  return readSignedInFirebaseUid();
}

function buildNewChatId() {
  const randomTail = Math.random()
    .toString(CHAT_ID_RANDOM_RADIX)
    .substr(CHAT_ID_RANDOM_START, CHAT_ID_RANDOM_LENGTH);
  return `chat_${Date.now()}_${randomTail}`;
}

function shortTitleFromFirstMessage(message) {
  const preview = message.content.slice(0, TITLE_PREVIEW_LENGTH).trim();
  if (preview) return preview;
  return NEW_CHAT_TITLE;
}

function roleAndContentForTitleApi(messages) {
  const titleTurns = [];
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    titleTurns.push({ role: message.role, content: message.content });
  }
  return titleTurns;
}

function sortChatsByNewestUpdate(chatRows) {
  return chatRows.sort((olderRow, newerRow) => {
    const newerTime = newerRow.updatedAt || 0;
    const olderTime = olderRow.updatedAt || 0;
    return newerTime - olderTime;
  });
}

function safeParseChatListJson(chatsJson) {
  try {
    return JSON.parse(chatsJson);
  } catch (jsonParseError) {
    if (__DEV__) {
      console.error('Error parsing chats JSON:', jsonParseError);
    }
    return [];
  }
}

function findChatByIdInList(chatList, chatId) {
  for (let index = 0; index < chatList.length; index += 1) {
    const savedChat = chatList[index];
    if (savedChat.id === chatId) return savedChat;
  }
  return null;
}

function ensureChatHasMessagesArray(chat) {
  if (Array.isArray(chat.messages)) return;
  chat.messages = [];
}

function removeChatIdFromList(chatList, chatId) {
  const listWithoutDeleted = [];
  for (let index = 0; index < chatList.length; index += 1) {
    const savedChat = chatList[index];
    if (savedChat.id === chatId) continue;
    listWithoutDeleted.push(savedChat);
  }
  return listWithoutDeleted;
}

function replaceOrAppendChatInList(chatList, chat) {
  const existingIndex = indexOfChatIdInList(chatList, chat.id);
  const now = Date.now();

  if (existingIndex >= 0) {
    chatList[existingIndex] = { ...chat, updatedAt: now };
    return;
  }

  let createdAtValue = chat.createdAt;
  if (!createdAtValue) {
    createdAtValue = now;
  }

  chatList.push({
    ...chat,
    createdAt: createdAtValue,
    updatedAt: now,
  });
}

function indexOfChatIdInList(chatList, chatId) {
  for (let index = 0; index < chatList.length; index += 1) {
    if (chatList[index].id === chatId) return index;
  }
  return -1;
}

function findFirstUserMessage(messages) {
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role === USER_ROLE) return message;
  }
  return null;
}

function chatTitleIsStillDefault(chat) {
  if (!chat.title) return true;
  if (chat.title === NEW_CHAT_TITLE) return true;
  return false;
}

async function maybeAssignTitleFromFirstMessage(chatList, chat) {
  if (!chatTitleIsStillDefault(chat)) return;

  const messageList = chat.messages || [];
  const firstUserMessage = findFirstUserMessage(messageList);
  if (!firstUserMessage) return;

  const fallbackTitle = shortTitleFromFirstMessage(firstUserMessage);
  const generatedTitle = await makeChatTitle(
    roleAndContentForTitleApi(chat.messages),
    fallbackTitle,
  );

  const listIndex = indexOfChatIdInList(chatList, chat.id);
  if (listIndex < 0) return;

  let titleToStore = generatedTitle;
  if (!titleToStore) {
    titleToStore = fallbackTitle;
  }
  chatList[listIndex].title = titleToStore;
}

async function refreshTitleAfterNewMessages(chat, messages) {
  if (!chatTitleIsStillDefault(chat)) return;

  const firstUserMessage = findFirstUserMessage(messages);
  if (!firstUserMessage) return;

  const fallbackTitle = shortTitleFromFirstMessage(firstUserMessage);
  chat.title = await makeChatTitle(roleAndContentForTitleApi(messages), fallbackTitle);
}

async function persistChatList(ownerUserId, chatList) {
  const storageKey = buildChatsStorageKey(ownerUserId);
  await AsyncStorage.setItem(storageKey, JSON.stringify(chatList));
}

function warnInDevOnly(message) {
  if (!__DEV__) return;
  console.warn(message);
}

function logStorageErrorInDevOnly(message, error) {
  if (!__DEV__) return;
  console.error(message, error);
}

function userIdForReadOperation(userId) {
  const ownerUserId = signedInUserIdOrArgument(userId);
  if (ownerUserId) return ownerUserId;
  warnInDevOnly('⚠️ No user ID available for getAllChats');
  return null;
}

function userIdRequiredForWrite(userId, operationLabel) {
  const ownerUserId = signedInUserIdOrArgument(userId);
  if (ownerUserId) return ownerUserId;
  console.warn(`⚠️ No user ID available for ${operationLabel}`);
  return null;
}
