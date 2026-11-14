// Marks other people's unread chat messages as read, one Firestore page at a time.
// Flow: load page → batch-update unread rows from someone else → clear badge when done.
// Used by alertTrainer (open thread) and inbox mark-read paths.
// Read order: constants → mains → PLUMBING helpers.

import { db } from '../app-start/cloudConnection';
import {
  collection,
  query,
  where,
  getDocs,
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
// (page query / batch helpers live under PLUMBING)

// ===== MAIN FUNCTION =====

/**
 * Page through one conversation's messages and set read:true on unread rows from others.
 * @param {string} conversationId
 * @param {string} userId
 * @returns {Promise<number>} how many messages we flipped to read
 */
export async function markConversationMessagesReadPaginated(conversationId, userId) {
  if (!conversationId || !userId) {
    return 0;
  }

  let lastDocumentOnPage = null;
  let totalMarked = 0;
  let hasMorePages = true;

  while (hasMorePages) {
    // 1. Load the next slice of messages for this conversation.
    const pageQuery = buildMessagesPageQuery(conversationId, lastDocumentOnPage);
    const pageSnapshot = await getDocs(pageQuery);
    if (pageSnapshot.empty) {
      break;
    }

    // 2. Queue read:true for every unread message on this page from someone else.
    const pageUpdate = queueUnreadUpdatesOnPage(pageSnapshot, userId);
    if (pageUpdate.markedOnThisPage > 0) {
      await pageUpdate.batch.commit();
      totalMarked += pageUpdate.markedOnThisPage;
    }

    // 3. Advance the cursor; stop when this page was shorter than READ_PAGE_SIZE.
    lastDocumentOnPage = lastDocumentFromPage(pageSnapshot);
    const thisPageWasShort = pageSnapshot.size < READ_PAGE_SIZE;
    if (thisPageWasShort) {
      hasMorePages = false;
    }
  }

  // 4. Drop the user's unread badge when we actually flipped any messages.
  if (totalMarked > 0) {
    await clearUnreadForConversation(userId, conversationId, totalMarked);
  }

  return totalMarked;
}

/**
 * Walk every conversation the user is in and mark unread messages read.
 * @param {string} userId
 * @returns {Promise<number>} total messages flipped across all threads
 */
export async function markMessagesReadForUser(userId) {
  if (!userId) {
    return 0;
  }

  // 1. Find every conversation where this user is a participant.
  const conversationsRef = collection(db, CONVERSATIONS_COLLECTION);
  // vocab: array-contains = Firestore filter where participants array includes userId
  const conversationsQuery = query(
    conversationsRef,
    where('participants', 'array-contains', userId),
  );
  const conversationsSnapshot = await getDocs(conversationsQuery);

  // 2. Mark each thread paginated; sum the flips.
  let totalMarked = 0;
  for (const conversationDoc of conversationsSnapshot.docs) {
    const markedInThread = await markConversationMessagesReadPaginated(
      conversationDoc.id,
      userId,
    );
    totalMarked += markedInThread;
  }

  return totalMarked;
}

// ===== PLUMBING — skip unless debugging =====

// Only explicit read === false from someone else — missing read field stays alone.
function messageNeedsMarkAsRead(messageData, userId) {
  const fromSomeoneElse = messageData.senderId !== userId;
  const explicitlyUnread = messageData.read === false;
  return fromSomeoneElse && explicitlyUnread;
}

function buildMessagesPageQuery(conversationId, lastDocumentOnPage) {
  const messagesRef = collection(db, MESSAGES_COLLECTION);

  if (lastDocumentOnPage) {
    // vocab: startAfter = skip every doc up to and including this cursor so pages do not overlap
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

function queueUnreadUpdatesOnPage(pageSnapshot, userId) {
  // vocab: writeBatch = group many writes into one commit (not one network hit per message)
  const batch = writeBatch(db);
  let markedOnThisPage = 0;

  pageSnapshot.forEach((messageDoc) => {
    const messageData = messageDoc.data();
    if (!messageNeedsMarkAsRead(messageData, userId)) {
      return;
    }
    batch.update(doc(db, MESSAGES_COLLECTION, messageDoc.id), { read: true });
    markedOnThisPage += 1;
  });

  return { batch, markedOnThisPage };
}

function lastDocumentFromPage(pageSnapshot) {
  const docsOnPage = pageSnapshot.docs;
  if (!docsOnPage.length) {
    return null;
  }
  return docsOnPage[docsOnPage.length - 1];
}
