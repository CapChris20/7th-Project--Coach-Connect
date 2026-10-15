// Denormalized unread message counts — one listener on users/{uid}/unreadCount/index.
// Flow: subscribe to the index doc → increment on send → reset when a thread opens → optional one-time rebuild.
// Used by chat badges and conversation lists. The Cloud Function is the authority; client writes are best-effort.

import { doc, onSnapshot, setDoc, updateDoc, increment, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const UNREAD_COUNT_COLLECTION = 'unreadCount';
const CONVERSATIONS_COLLECTION = 'conversations';
const MESSAGES_COLLECTION = 'messages';
const INDEX_DOC = 'index';
const EMPTY_UNREAD_TOTAL = 0;
const FIRST_UNREAD_COUNT = 1;

// ===== HELPER FUNCTIONS =====

function unreadIndexRef(userId) {
  return doc(db, USERS_COLLECTION, userId, UNREAD_COUNT_COLLECTION, INDEX_DOC);
}

function emptyUnreadState() {
  return { total: EMPTY_UNREAD_TOTAL, conversations: {} };
}

function unreadStateFromSnapshot(indexSnapshot) {
  const data = indexSnapshot.exists ? indexSnapshot.data() || {} : {};
  const conversations =
    data.conversations && typeof data.conversations === 'object' ? data.conversations : {};
  return {
    total: Number(data.total || EMPTY_UNREAD_TOTAL),
    conversations,
  };
}

function isoNow() {
  return new Date().toISOString();
}

function unreadCountForSender(messageData, userId) {
  if (messageData.senderId !== userId && messageData.read === false) return 1;
  return 0;
}

async function firstUnreadIndexWrite(indexDocRef, conversationId) {
  await setDoc(indexDocRef, {
    total: FIRST_UNREAD_COUNT,
    conversations: { [conversationId]: FIRST_UNREAD_COUNT },
    updatedAt: isoNow(),
  });
}

async function incrementExistingUnreadIndex(indexDocRef, conversationId) {
  // vocab: increment(1) = Firestore's atomic +1 so two arrivals cannot clobber each other.
  await updateDoc(indexDocRef, {
    total: increment(FIRST_UNREAD_COUNT),
    [`conversations.${conversationId}`]: increment(FIRST_UNREAD_COUNT),
    updatedAt: isoNow(),
  });
}

function remainingTotalAfterClear(currentTotal, conversationUnreadCount) {
  return Math.max(EMPTY_UNREAD_TOTAL, Number(currentTotal || EMPTY_UNREAD_TOTAL) - conversationUnreadCount);
}

async function countUnreadInConversation(conversationId, userId) {
  const messageSnapshot = await getDocs(
    query(collection(db, MESSAGES_COLLECTION), where('conversationId', '==', conversationId)),
  );
  let unreadCount = 0;
  messageSnapshot.forEach((messageDoc) => {
    unreadCount += unreadCountForSender(messageDoc.data(), userId);
  });
  return unreadCount;
}

async function loadConversationUnreadMap(userId) {
  const conversationSnapshot = await getDocs(
    query(collection(db, CONVERSATIONS_COLLECTION), where('participants', 'array-contains', userId)),
  );
  const conversations = {};
  let total = EMPTY_UNREAD_TOTAL;
  for (const conversationDoc of conversationSnapshot.docs) {
    const unreadCount = await countUnreadInConversation(conversationDoc.id, userId);
    if (unreadCount > 0) {
      conversations[conversationDoc.id] = unreadCount;
      total += unreadCount;
    }
  }
  return { total, conversations };
}

// ===== MAIN FUNCTION =====

/**
 * Subscribe to total + per-conversation unread counts (1 listener).
 * Falls back to zeros when the index doc is missing or the listener errors.
 * @param {string} userId
 * @param {Function} callback
 * @returns {Function} unsubscribe
 */
export function subscribeToUnreadIndex(userId, callback) {
  if (!userId || !callback) return () => {};

  return onSnapshot(
    unreadIndexRef(userId),
    (indexSnapshot) => {
      callback(unreadStateFromSnapshot(indexSnapshot));
    },
    () => callback(emptyUnreadState()),
  );
}

/**
 * Subscribe to the badge total only.
 * @param {string} userId
 * @param {Function} callback
 * @returns {Function} unsubscribe
 */
export function subscribeToUnreadCount(userId, callback) {
  return subscribeToUnreadIndex(userId, ({ total }) => callback(total));
}

/**
 * Subscribe to the per-conversation map (copied so callers can mutate safely).
 * @param {string} userId
 * @param {Function} callback
 * @returns {Function} unsubscribe
 */
export function subscribeToUnreadByConversation(userId, callback) {
  return subscribeToUnreadIndex(userId, ({ conversations }) => callback({ ...conversations }));
}

/**
 * Increment unread for the recipient after a message is sent (best-effort; Cloud Function is authoritative).
 * @param {string} recipientId
 * @param {string} conversationId
 * @returns {Promise<void>}
 */
export async function incrementUnreadForRecipient(recipientId, conversationId) {
  if (!recipientId || !conversationId) return;
  try {
    const indexDocRef = unreadIndexRef(recipientId);
    const indexSnapshot = await getDoc(indexDocRef);
    if (!indexSnapshot.exists) {
      await firstUnreadIndexWrite(indexDocRef, conversationId);
      return;
    }
    await incrementExistingUnreadIndex(indexDocRef, conversationId);
  } catch (_) {
    /* Cloud Function may own this write */
  }
}

/**
 * Reset unread for a conversation when the user opens the thread.
 * @param {string} userId
 * @param {string} conversationId
 * @param {number|null} [clearedCount=null]
 * @returns {Promise<void>}
 */
export async function clearUnreadForConversation(userId, conversationId, clearedCount = null) {
  if (!userId || !conversationId) return;
  try {
    const indexDocRef = unreadIndexRef(userId);
    const indexSnapshot = await getDoc(indexDocRef);
    if (!indexSnapshot.exists) return;
    const data = indexSnapshot.data() || {};
    const conversationUnreadCount =
      clearedCount != null
        ? Number(clearedCount)
        : Number(data.conversations?.[conversationId] || EMPTY_UNREAD_TOTAL);
    if (conversationUnreadCount <= 0) return;
    const remainingTotal = remainingTotalAfterClear(data.total, conversationUnreadCount);
    const conversations = { ...(data.conversations || {}) };
    conversations[conversationId] = EMPTY_UNREAD_TOTAL;
    await setDoc(
      indexDocRef,
      {
        total: remainingTotal,
        conversations,
        updatedAt: isoNow(),
      },
      { merge: true },
    );
  } catch (_) {
    /* non-critical */
  }
}

/**
 * One-time migration: scan messages and write the unread index doc.
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function rebuildUnreadIndexForUser(userId) {
  if (!userId) return;
  const { total, conversations } = await loadConversationUnreadMap(userId);
  await setDoc(
    unreadIndexRef(userId),
    { total, conversations, updatedAt: isoNow() },
    { merge: true },
  );
}
