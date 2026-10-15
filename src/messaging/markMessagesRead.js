// Marks other people's unread chat messages as read, one Firestore page at a time.
// Flow: load a page of messages → mark the unread ones from someone else → repeat until the last page → clear the unread badge.
// Used by: opening a conversation, and the "mark all read" path across every chat the user is in.

import { db } from '../app-start/cloudConnection';
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  writeBatch,
  limit,
  startAfter,
} from 'firebase/firestore';
import { clearUnreadForConversation } from './unreadMessageCounts';

// ===== NAMED CONSTANTS =====

const MESSAGES_COLLECTION = 'messages';
const CONVERSATIONS_COLLECTION = 'conversations';
// Manipulate here: Firestore batch limit is 500; 50 keeps each commit small on a slow phone.
export const READ_PAGE_SIZE = 50;

// ===== HELPER FUNCTIONS =====

/**
 * True only when this message is from someone else and is explicitly unread.
 * `read === false` is required — a missing `read` field is left alone.
 * @param {object} messageData
 * @param {string} userId
 * @returns {boolean}
 */
function shouldMarkMessageRead(messageData, userId) {
  return messageData.senderId !== userId && messageData.read === false;
}

/**
 * One page of this conversation's messages. `startAfter` continues from the last doc of the previous page.
 * @param {string} conversationId
 * @param {object|null} lastDocumentOnPage
 * @returns {object}
 */
function messagesPageQuery(conversationId, lastDocumentOnPage) {
  const messagesRef = collection(db, MESSAGES_COLLECTION);
  if (lastDocumentOnPage) {
    // vocab: startAfter = skip every doc up to and including this one, so pages do not overlap.
    return query(
      messagesRef,
      where('conversationId', '==', conversationId),
      startAfter(lastDocumentOnPage),
      limit(READ_PAGE_SIZE),
    );
  }
  return query(
    messagesRef,
    where('conversationId', '==', conversationId),
    limit(READ_PAGE_SIZE),
  );
}

/**
 * Queue an update for each unread message on this page that someone else sent.
 * @param {object} pageSnapshot
 * @param {string} userId
 * @returns {{ batch: object, markedOnThisPage: number }}
 */
function queueUnreadUpdatesOnPage(pageSnapshot, userId) {
  // vocab: writeBatch groups many writes into one commit so we do not hit Firestore once per message.
  const batch = writeBatch(db);
  let markedOnThisPage = 0;

  pageSnapshot.forEach((messageDoc) => {
    const messageData = messageDoc.data();
    if (!shouldMarkMessageRead(messageData, userId)) return;
    batch.update(doc(db, MESSAGES_COLLECTION, messageDoc.id), { read: true });
    markedOnThisPage += 1;
  });

  return { batch, markedOnThisPage };
}

/**
 * @param {object} pageSnapshot
 * @returns {boolean}
 */
function isLastMessagesPage(pageSnapshot) {
  return pageSnapshot.size < READ_PAGE_SIZE;
}

// ===== MAIN FUNCTION =====

/**
 * Mark unread messages in one conversation as read, in pages of READ_PAGE_SIZE.
 * @param {string} conversationId
 * @param {string} userId
 * @returns {Promise<number>} how many messages were marked
 */
export async function markConversationMessagesReadPaginated(conversationId, userId) {
  if (!conversationId || !userId) return 0;

  let lastDocumentOnPage = null;
  let totalMarked = 0;
  let hasMore = true;

  while (hasMore) {
    const pageQuery = messagesPageQuery(conversationId, lastDocumentOnPage);
    const pageSnapshot = await getDocs(pageQuery);
    if (pageSnapshot.empty) {
      hasMore = false;
      break;
    }

    const { batch, markedOnThisPage } = queueUnreadUpdatesOnPage(pageSnapshot, userId);
    if (markedOnThisPage > 0) {
      await batch.commit();
      totalMarked += markedOnThisPage;
    }

    lastDocumentOnPage = pageSnapshot.docs[pageSnapshot.docs.length - 1];
    if (isLastMessagesPage(pageSnapshot)) {
      hasMore = false;
    }
  }

  if (totalMarked > 0) {
    await clearUnreadForConversation(userId, conversationId, totalMarked);
  }

  return totalMarked;
}

/**
 * Mark unread messages as read in every conversation this user is in.
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function markMessagesReadForUser(userId) {
  if (!userId) return 0;

  const conversationsRef = collection(db, CONVERSATIONS_COLLECTION);
  // vocab: 'array-contains' means this array field includes this value.
  const conversationsQuery = query(
    conversationsRef,
    where('participants', 'array-contains', userId),
  );

  const conversationsSnapshot = await getDocs(conversationsQuery);
  let totalMarked = 0;

  for (const conversationDoc of conversationsSnapshot.docs) {
    const marked = await markConversationMessagesReadPaginated(conversationDoc.id, userId);
    totalMarked += marked;
  }

  return totalMarked;
}
