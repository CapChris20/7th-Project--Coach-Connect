// Inbox conversation pages for the signed-in user (live first page + "load more").
// Flow: query conversations that include this user, newest first → index-missing fallback →
//       sort here when unordered → fill other participant names → callback to the screen.
// Used by InboxScreen and ClientAppStart (unread counts re-exported at the bottom).

import { db } from '../../app-start/cloudConnection';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  getDocs,
} from 'firebase/firestore';
import { getUserData } from '../coach-actions/alertTrainer';
import {
  getDocsWithIndexFallback,
  sortDocsByMillis,
  isFirestoreIndexError,
} from '../../for-both/cloud-database/loadInPages';

// ===== NAMED CONSTANTS =====

// Manipulate here: how many threads one page of the inbox loads.
export const CONVERSATIONS_PAGE_SIZE = 40;

const CONVERSATIONS_COLLECTION = 'conversations';
const PARTICIPANTS_FIELD = 'participants';
const UPDATED_AT_FIELD = 'updatedAt';
const DEFAULT_PARTICIPANT_NAME = 'User';
const LOAD_MORE_LABEL = 'conversations loadMore';
const COULD_NOT_LOAD_MESSAGE = 'Could not load conversations';
const LISTENER_MODE_PRIMARY = 'primary';
const LISTENER_MODE_FALLBACK = 'fallback';

// ===== HELPER FUNCTIONS =====

function emptyConversationPage(errorMessage) {
  return {
    conversations: [],
    participantNames: {},
    participantData: {},
    lastDoc: null,
    hasMore: false,
    error: errorMessage,
  };
}

function mapConversationDoc(conversationDocument) {
  const data = conversationDocument.data();
  return { id: conversationDocument.id, ...data };
}

function conversationListFromDocuments(documents) {
  const conversations = [];
  for (let index = 0; index < documents.length; index += 1) {
    conversations.push(mapConversationDoc(documents[index]));
  }
  return conversations;
}

function pageMetaFromDocuments(documents) {
  let lastDoc = null;
  if (documents.length) {
    lastDoc = documents[documents.length - 1];
  }
  const hasMore = documents.length >= CONVERSATIONS_PAGE_SIZE;
  return { lastDoc, hasMore };
}

function trimmedUserId(userId) {
  if (typeof userId !== 'string') return '';
  return userId.trim();
}

function messageFromLoadError(error) {
  if (error && error.message) return error.message;
  return COULD_NOT_LOAD_MESSAGE;
}

// ===== MAIN FUNCTION =====

/**
 * Next page of conversations. Call from Load more.
 * @param {string} userId
 * @param {object} startAfterDoc
 * @returns {Promise<{ conversations: object[], lastDoc: object|null, hasMore: boolean }>}
 */
export async function fetchMoreConversations(userId, startAfterDoc) {
  // 1. Need a real uid and a cursor doc; otherwise return an empty page.
  const uid = trimmedUserId(userId);
  if (!uid || !startAfterDoc) {
    return { conversations: [], lastDoc: null, hasMore: false };
  }

  // 2. Ordered page query; if the composite index is missing, fall back unordered.
  const pagedQuery = buildConversationsQuery(uid, CONVERSATIONS_PAGE_SIZE, startAfterDoc);
  const snapshot = await getDocsWithIndexFallback(
    pagedQuery,
    () => conversationsFallbackQuery(uid),
    LOAD_MORE_LABEL,
  );

  // 3. Sort when the fallback had no updatedAt order, then map docs → conversation rows.
  const documents = sortDocumentsWhenUnordered(snapshot.docs);
  const conversations = conversationListFromDocuments(documents);
  const pageMeta = pageMetaFromDocuments(documents);

  return {
    conversations,
    lastDoc: pageMeta.lastDoc,
    hasMore: pageMeta.hasMore,
  };
}

/**
 * Live first page of conversations. The returned function unsubscribes the listener.
 * @param {string} userId
 * @param {Function} callback
 * @returns {Function}
 */
export function subscribeToConversations(userId, callback) {
  // 1. Need uid + callback; otherwise no-op unsubscribe.
  const uid = trimmedUserId(userId);
  if (!uid || !callback) {
    console.error('❌ subscribeToConversations: Missing userId or callback');
    return () => {};
  }

  // 2. Caches survive across snapshot fires so we do not re-fetch every name.
  const participantNamesCache = {};
  const participantDataCache = {};
  const primaryQuery = buildConversationsQuery(uid, CONVERSATIONS_PAGE_SIZE);

  let unsubscribeListener = () => {};
  let listenerWasCancelled = false;

  // 3. One snapshot → sort → map → hydrate names → publish to the screen.
  const publishConversationPage = async (querySnapshot) => {
    try {
      const documents = sortDocumentsWhenUnordered(querySnapshot.docs, CONVERSATIONS_PAGE_SIZE);
      const pageMeta = pageMetaFromDocuments(documents);
      const rawConversations = conversationListFromDocuments(documents);
      const conversations = sortConversationsNewestFirst(rawConversations);

      await hydrateParticipantProfiles(uid, conversations, participantNamesCache, participantDataCache);

      callback({
        conversations,
        participantNames: { ...participantNamesCache },
        participantData: { ...participantDataCache },
        lastDoc: pageMeta.lastDoc,
        hasMore: pageMeta.hasMore,
        error: null,
      });
    } catch (error) {
      console.error('❌ Error in conversations listener:', error);
      callback(emptyConversationPage(messageFromLoadError(error)));
    }
  };

  // 4. Attach (or re-attach) onSnapshot for primary or fallback mode.
  const attachFirestoreListener = (mode) => {
    let conversationsQuery = primaryQuery;
    if (mode === LISTENER_MODE_FALLBACK) {
      conversationsQuery = conversationsFallbackQuery(uid);
    }

    safeUnsubscribe(unsubscribeListener);
    unsubscribeListener = onSnapshot(
      conversationsQuery,
      (snapshot) => {
        void publishConversationPage(snapshot);
      },
      (error) => handleListenerError(error, mode),
    );
  };

  const attachListenerIfStillActive = (mode) => {
    if (listenerWasCancelled) return;
    attachFirestoreListener(mode);
  };

  // Missing composite index → switch to unordered query. Other errors surface to the screen.
  const handleListenerError = (error, mode) => {
    if (listenerWasCancelled) return;

    const isIndexError = isFirestoreIndexError(error);
    const onPrimaryMode = mode === LISTENER_MODE_PRIMARY;
    if (isIndexError && onPrimaryMode) {
      attachFirestoreListener(LISTENER_MODE_FALLBACK);
      return;
    }

    console.error('❌ Firestore listener error:', error);
    callback(emptyConversationPage(messageFromLoadError(error)));
  };

  // Probe with getDocs before onSnapshot so a missing index fails once, not in a tight error loop.
  const handleProbeError = (error) => {
    if (isFirestoreIndexError(error)) {
      attachListenerIfStillActive(LISTENER_MODE_FALLBACK);
      return;
    }
    console.error('❌ conversations probe failed:', error);
    callback(emptyConversationPage(messageFromLoadError(error)));
  };

  // 5. Probe primary query once, then attach the matching listener.
  const bootListener = async () => {
    try {
      await getDocs(primaryQuery);
      attachListenerIfStillActive(LISTENER_MODE_PRIMARY);
    } catch (error) {
      handleProbeError(error);
    }
  };

  void bootListener();

  // 6. Cleanup: mark cancelled + unsubscribe so late snapshots do not call back.
  return () => {
    listenerWasCancelled = true;
    safeUnsubscribe(unsubscribeListener);
  };
}

export {
  subscribeToUnreadCount,
  subscribeToUnreadByConversation,
  rebuildUnreadIndexForUser,
} from '../../messaging/unreadMessageCounts';

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

function millisFromUpdatedAt(updatedAt) {
  if (!updatedAt) return 0;
  if (typeof updatedAt.toMillis === 'function') {
    const asMillis = updatedAt.toMillis();
    if (asMillis) return asMillis;
  }
  return updatedAt || 0;
}

function sortConversationsNewestFirst(conversations) {
  const sorted = [...conversations];
  sorted.sort((first, second) => {
    const firstTime = millisFromUpdatedAt(first.updatedAt);
    const secondTime = millisFromUpdatedAt(second.updatedAt);
    return secondTime - firstTime;
  });
  return sorted;
}

function displayNameFromUserData(userData) {
  const firstName = userData.firstName || '';
  const lastName = userData.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim();
  if (userData.name) return userData.name;
  if (fullName) return fullName;
  if (userData.displayName) return userData.displayName;
  return DEFAULT_PARTICIPANT_NAME;
}

function otherParticipantId(conversation, uid) {
  const participants = conversation.participants;
  if (!Array.isArray(participants)) return undefined;

  for (let index = 0; index < participants.length; index += 1) {
    const participantId = participants[index];
    if (typeof participantId !== 'string') continue;
    if (!participantId.trim()) continue;
    if (participantId === uid) continue;
    return participantId;
  }
  return undefined;
}

function loadOneParticipant(participantId, namesCache, dataCache) {
  return getUserData(participantId)
    .then((userData) => {
      if (!userData) return;
      namesCache[participantId] = displayNameFromUserData(userData);
      dataCache[participantId] = userData;
    })
    .catch((error) => {
      console.warn('⚠️ Failed to load user data for', participantId, error);
    });
}

async function hydrateParticipantProfiles(uid, conversations, namesCache, dataCache) {
  const loadPromises = [];

  for (let index = 0; index < conversations.length; index += 1) {
    const conversation = conversations[index];
    const participantId = otherParticipantId(conversation, uid);
    if (!participantId) continue;
    if (namesCache[participantId]) continue;
    loadPromises.push(loadOneParticipant(participantId, namesCache, dataCache));
  }

  await Promise.all(loadPromises);
}

function buildConversationsQuery(uid, pageSize, startAfterDoc = null) {
  const conversationsRef = collection(db, CONVERSATIONS_COLLECTION);

  if (!startAfterDoc) {
    return query(
      conversationsRef,
      where(PARTICIPANTS_FIELD, 'array-contains', uid),
      orderBy(UPDATED_AT_FIELD, 'desc'),
      limit(pageSize),
    );
  }

  return query(
    conversationsRef,
    where(PARTICIPANTS_FIELD, 'array-contains', uid),
    orderBy(UPDATED_AT_FIELD, 'desc'),
    startAfter(startAfterDoc),
    limit(pageSize),
  );
}

function conversationsFallbackQuery(uid) {
  return query(
    collection(db, CONVERSATIONS_COLLECTION),
    where(PARTICIPANTS_FIELD, 'array-contains', uid),
    limit(CONVERSATIONS_PAGE_SIZE),
  );
}

function documentHasUpdatedAt(document) {
  const data = document.data();
  if (!data) return false;
  if (!data.updatedAt) return false;
  return true;
}

function sortDocumentsWhenUnordered(documents, maxCount) {
  if (documents.length === 0) return documents;

  const firstDocument = documents[0];
  if (documentHasUpdatedAt(firstDocument)) return documents;

  const sorted = sortDocsByMillis(documents, UPDATED_AT_FIELD, 'desc');
  if (!maxCount) return sorted;
  return sorted.slice(0, maxCount);
}

function safeUnsubscribe(unsubscribe) {
  try {
    unsubscribe();
  } catch (ignoredError) {
    /* ignore */
  }
}
