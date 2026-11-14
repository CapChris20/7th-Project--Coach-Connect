// Denormalized unread message counts — one listener on users/{uid}/unreadCount/index.
// Flow: subscribe to the index doc → increment on send → reset when a thread opens → optional rebuild.
// Used by: chat badges and conversation lists. Cloud Function is the authority; client writes are best-effort.
//
// vocab: onSnapshot = live Firestore listener; returns an unsubscribe function
// vocab: increment(n) = atomic +n so two arrivals cannot clobber each other
// Firestore letters frozen: users / unreadCount / index / conversations / messages / participants / read

import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  increment,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
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

function firestoreRefForUnreadIndex(userId) {
  return doc(db, USERS_COLLECTION, userId, UNREAD_COUNT_COLLECTION, INDEX_DOC);
}

function emptyUnreadBadgeState() {
  return { total: EMPTY_UNREAD_TOTAL, conversations: {} };
}

function unreadStateFromFirestoreSnapshot(indexSnapshot) {
  const rawData = indexSnapshot.exists ? indexSnapshot.data() || {} : {};
  const conversationsField = rawData.conversations;
  const conversationsLookLikeAMap =
    conversationsField && typeof conversationsField === 'object';
  let conversationsMap = {};
  if (conversationsLookLikeAMap) {
    conversationsMap = conversationsField;
  }
  return {
    total: Number(rawData.total || EMPTY_UNREAD_TOTAL),
    conversations: conversationsMap,
  };
}

function isoTimestampNow() {
  return new Date().toISOString();
}

function totalUnreadAfterSubtractingThread(currentTotal, threadUnreadCount) {
  const safeTotal = Number(currentTotal || EMPTY_UNREAD_TOTAL);
  const afterSubtract = safeTotal - threadUnreadCount;
  return Math.max(EMPTY_UNREAD_TOTAL, afterSubtract);
}

// ===== MAIN FUNCTION =====

/**
 * Subscribe to total + per-conversation unread counts (one listener).
 * Falls back to zeros when the index doc is missing or the listener errors.
 *
 * @param {string} userId
 * @param {Function} onUnreadStateChange
 * @returns {Function} unsubscribe
 */
export function subscribeToUnreadIndex(userId, onUnreadStateChange) {
  // 1. Without both pieces we cannot listen — return a no-op teardown.
  if (!userId || !onUnreadStateChange) {
    return () => {};
  }

  // 2. Firestore pushes a snapshot whenever the index doc changes; errors → empty state.
  const indexDocRef = firestoreRefForUnreadIndex(userId);
  return onSnapshot(
    indexDocRef,
    (indexSnapshot) => {
      onUnreadStateChange(unreadStateFromFirestoreSnapshot(indexSnapshot));
    },
    () => onUnreadStateChange(emptyUnreadBadgeState()),
  );
}

/**
 * Subscribe to the badge total only.
 *
 * @param {string} userId
 * @param {Function} onTotalUnreadChange
 * @returns {Function} unsubscribe
 */
export function subscribeToUnreadCount(userId, onTotalUnreadChange) {
  return subscribeToUnreadIndex(userId, (unreadState) => {
    onTotalUnreadChange(unreadState.total);
  });
}

/**
 * Subscribe to the per-conversation map (copied so callers can mutate safely).
 *
 * @param {string} userId
 * @param {Function} onPerThreadMapChange
 * @returns {Function} unsubscribe
 */
export function subscribeToUnreadByConversation(userId, onPerThreadMapChange) {
  return subscribeToUnreadIndex(userId, (unreadState) => {
    // Spread so callers can mutate their copy without touching listener state.
    onPerThreadMapChange({ ...unreadState.conversations });
  });
}

/**
 * Increment unread for the recipient after a message is sent (best-effort).
 *
 * @param {string} recipientUserId
 * @param {string} conversationId
 * @returns {Promise<void>}
 */
export async function incrementUnreadForRecipient(recipientUserId, conversationId) {
  // 1. Bail when we do not know who or which thread.
  if (!recipientUserId || !conversationId) {
    return;
  }

  try {
    // 2. Missing doc → full seed write; existing doc → atomic +1 fields.
    const indexDocRef = firestoreRefForUnreadIndex(recipientUserId);
    const indexSnapshot = await getDoc(indexDocRef);
    if (!indexSnapshot.exists) {
      await writeFirstUnreadIndexDoc(indexDocRef, conversationId);
      return;
    }
    await bumpUnreadIndexCounters(indexDocRef, conversationId);
  } catch (unusedError) {
    // Cloud Function may own this write — client path is best-effort only.
  }
}

/**
 * Reset unread for a conversation when the user opens the thread.
 *
 * @param {string} userId
 * @param {string} conversationId
 * @param {number|null} [clearedCount=null]
 * @returns {Promise<void>}
 */
export async function clearUnreadForConversation(userId, conversationId, clearedCount = null) {
  // 1. Need both ids to touch the index.
  if (!userId || !conversationId) {
    return;
  }

  try {
    // 2. Read the index; skip when the doc or this thread has nothing to clear.
    const indexDocRef = firestoreRefForUnreadIndex(userId);
    const indexSnapshot = await getDoc(indexDocRef);
    if (!indexSnapshot.exists) {
      return;
    }

    const indexData = indexSnapshot.data() || {};
    const conversationUnreadCount = pickConversationUnreadToClear(
      indexData,
      conversationId,
      clearedCount,
    );
    if (conversationUnreadCount <= 0) {
      return;
    }

    // 3. Write total − thread count and zero that conversation key (merge).
    const newTotalAfterClear = totalUnreadAfterSubtractingThread(
      indexData.total,
      conversationUnreadCount,
    );
    const conversationsMap = { ...(indexData.conversations || {}) };
    conversationsMap[conversationId] = EMPTY_UNREAD_TOTAL;

    await setDoc(
      indexDocRef,
      {
        total: newTotalAfterClear,
        conversations: conversationsMap,
        updatedAt: isoTimestampNow(),
      },
      { merge: true },
    );
  } catch (unusedError) {
    // Badge clear is nice-to-have — never block the chat UI.
  }
}

/**
 * One-time migration: scan messages and write the unread index doc.
 *
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function rebuildUnreadIndexForUser(userId) {
  if (!userId) {
    return;
  }
  const rebuiltState = await scanAllThreadsForUnreadCounts(userId);
  await setDoc(
    firestoreRefForUnreadIndex(userId),
    {
      total: rebuiltState.total,
      conversations: rebuiltState.conversations,
      updatedAt: isoTimestampNow(),
    },
    { merge: true },
  );
}

// ===== PLUMBING — skip unless debugging =====

function pickConversationUnreadToClear(indexData, conversationId, clearedCount) {
  const wasClearedCountProvided = clearedCount != null;
  if (wasClearedCountProvided) {
    return Number(clearedCount);
  }
  return Number(indexData.conversations?.[conversationId] || EMPTY_UNREAD_TOTAL);
}

async function writeFirstUnreadIndexDoc(indexDocRef, conversationId) {
  await setDoc(indexDocRef, {
    total: FIRST_UNREAD_COUNT,
    conversations: { [conversationId]: FIRST_UNREAD_COUNT },
    updatedAt: isoTimestampNow(),
  });
}

async function bumpUnreadIndexCounters(indexDocRef, conversationId) {
  await updateDoc(indexDocRef, {
    total: increment(FIRST_UNREAD_COUNT),
    [`conversations.${conversationId}`]: increment(FIRST_UNREAD_COUNT),
    updatedAt: isoTimestampNow(),
  });
}

function unreadFromMessageIfNotFromMe(messageData, userId) {
  const senderIsNotMe = messageData.senderId !== userId;
  const messageStillUnread = messageData.read === false;
  if (senderIsNotMe && messageStillUnread) {
    return 1;
  }
  return 0;
}

async function countUnreadMessagesInThread(conversationId, userId) {
  const messagesQuery = query(
    collection(db, MESSAGES_COLLECTION),
    where('conversationId', '==', conversationId),
  );
  const messageSnapshot = await getDocs(messagesQuery);
  let unreadCount = 0;
  messageSnapshot.forEach((messageDoc) => {
    unreadCount += unreadFromMessageIfNotFromMe(messageDoc.data(), userId);
  });
  return unreadCount;
}

async function scanAllThreadsForUnreadCounts(userId) {
  const myConversationsQuery = query(
    collection(db, CONVERSATIONS_COLLECTION),
    where('participants', 'array-contains', userId),
  );
  const conversationSnapshot = await getDocs(myConversationsQuery);
  const conversationsMap = {};
  let totalUnread = EMPTY_UNREAD_TOTAL;

  for (const conversationDoc of conversationSnapshot.docs) {
    const threadUnread = await countUnreadMessagesInThread(conversationDoc.id, userId);
    if (threadUnread > 0) {
      conversationsMap[conversationDoc.id] = threadUnread;
      totalUnread += threadUnread;
    }
  }

  return { total: totalUnread, conversations: conversationsMap };
}
