// Live list of message threads for the signed-in user, plus "load more."
// Flow: query conversations that include this user, newest first → if the index
//       is not ready, fall back to an unordered read and sort here → fill in the
//       other person's name → hand the page to the screen.
// Used by the inbox screen and the client app start (unread counts are re-exported below).

import { db } from '../../app-start/cloudConnection';
// vocab: onSnapshot = Firestore live listener. It keeps calling back until the cleanup runs.
// vocab: startAfter = "the next page begins after this document."
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

// ===== MAIN FUNCTION =====

/**
 * Next page of conversations. Call this from Load more.
 * @param {string} userId
 * @param {object} startAfterDoc The last document from the previous page
 * @returns {Promise<{ conversations: object[], lastDoc: object|null, hasMore: boolean }>}
 */
export async function fetchMoreConversations(userId, startAfterDoc) {
  const uid = typeof userId === 'string' ? userId.trim() : '';
  if (!uid || !startAfterDoc) {
    return { conversations: [], lastDoc: null, hasMore: false };
  }

  const snapshot = await getDocsWithIndexFallback(
    buildConversationsQuery(uid, CONVERSATIONS_PAGE_SIZE, startAfterDoc),
    () => conversationsFallbackQuery(uid),
    LOAD_MORE_LABEL,
  );

  const documents = sortDocumentsWhenUnordered(snapshot.docs);
  const conversations = documents.map(mapConversationDoc);
  const { lastDoc, hasMore } = pageMetaFromDocuments(documents);

  return { conversations, lastDoc, hasMore };
}

/**
 * Live first page of conversations. The function it returns is the unsubscribe.
 * Call that when the screen goes away so the listener does not keep running.
 * @param {string} userId
 * @param {Function} callback
 * @returns {Function}
 */
export function subscribeToConversations(userId, callback) {
  const uid = typeof userId === 'string' ? userId.trim() : '';
  if (!uid || !callback) {
    console.error('❌ subscribeToConversations: Missing userId or callback');
    return () => {};
  }

  const participantNamesCache = {};
  const participantDataCache = {};
  const primaryQuery = buildConversationsQuery(uid, CONVERSATIONS_PAGE_SIZE);

  let unsubscribe = () => {};
  let isCancelled = false;

  const handleSnapshot = async (querySnapshot) => {
    try {
      const documents = sortDocumentsWhenUnordered(querySnapshot.docs, CONVERSATIONS_PAGE_SIZE);
      const { lastDoc, hasMore } = pageMetaFromDocuments(documents);
      const conversations = sortConversations(documents.map(mapConversationDoc));

      await hydrateParticipants(uid, conversations, participantNamesCache, participantDataCache);

      callback({
        conversations,
        participantNames: { ...participantNamesCache },
        participantData: { ...participantDataCache },
        lastDoc,
        hasMore,
        error: null,
      });
    } catch (error) {
      console.error('❌ Error in conversations listener:', error);
      callback(emptyConversationPage(error?.message || COULD_NOT_LOAD_MESSAGE));
    }
  };

  const attachListener = (mode) => {
    const conversationsQuery = mode === LISTENER_MODE_FALLBACK
      ? conversationsFallbackQuery(uid)
      : primaryQuery;
    safeUnsubscribe(unsubscribe);
    unsubscribe = onSnapshot(
      conversationsQuery,
      (snapshot) => {
        void handleSnapshot(snapshot);
      },
      (error) => handleListenerError(error, mode),
    );
  };

  const attachIfStillActive = (mode) => {
    if (isCancelled) return;
    attachListener(mode);
  };

  // A missing index on the first try switches to the unordered query. Any other error
  // is reported to the screen. Index errors look like Firestore's failed-precondition.
  const handleListenerError = (error, mode) => {
    if (isCancelled) return;
    if (isFirestoreIndexError(error) && mode === LISTENER_MODE_PRIMARY) {
      attachListener(LISTENER_MODE_FALLBACK);
      return;
    }
    console.error('❌ Firestore listener error:', error);
    callback(emptyConversationPage(error?.message || COULD_NOT_LOAD_MESSAGE));
  };

  // Probe with getDocs first. If the index is missing, that throws here, before we
  // attach a listener that would immediately error the same way.
  const boot = async () => {
    try {
      await getDocs(primaryQuery);
      attachIfStillActive(LISTENER_MODE_PRIMARY);
    } catch (error) {
      handleProbeError(error);
    }
  };

  const handleProbeError = (error) => {
    if (isFirestoreIndexError(error)) {
      attachIfStillActive(LISTENER_MODE_FALLBACK);
      return;
    }
    console.error('❌ conversations probe failed:', error);
    callback(emptyConversationPage(error?.message || COULD_NOT_LOAD_MESSAGE));
  };

  void boot();

  return () => {
    isCancelled = true;
    safeUnsubscribe(unsubscribe);
  };
}

export {
  subscribeToUnreadCount,
  subscribeToUnreadByConversation,
  rebuildUnreadIndexForUser,
} from '../../messaging/unreadMessageCounts';

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

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
  return { id: conversationDocument.id, ...conversationDocument.data() };
}

function sortConversations(conversations) {
  return [...conversations].sort((first, second) => {
    const firstTime = first.updatedAt?.toMillis?.() || first.updatedAt || 0;
    const secondTime = second.updatedAt?.toMillis?.() || second.updatedAt || 0;
    return secondTime - firstTime;
  });
}

function displayNameFromUserData(userData) {
  const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
  return userData.name || fullName || userData.displayName || DEFAULT_PARTICIPANT_NAME;
}

function otherParticipantId(conversation, uid) {
  return conversation.participants?.find(
    (participantId) => typeof participantId === 'string' && participantId.trim() && participantId !== uid,
  );
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

async function hydrateParticipants(uid, conversations, namesCache, dataCache) {
  const loadPromises = [];
  for (const conversation of conversations) {
    const participantId = otherParticipantId(conversation, uid);
    if (!participantId || namesCache[participantId]) continue;
    loadPromises.push(loadOneParticipant(participantId, namesCache, dataCache));
  }
  await Promise.all(loadPromises);
}

function buildConversationsQuery(uid, pageSize, startAfterDoc = null) {
  const conversationsRef = collection(db, CONVERSATIONS_COLLECTION);
  const sharedFilters = [
    where(PARTICIPANTS_FIELD, 'array-contains', uid),
    orderBy(UPDATED_AT_FIELD, 'desc'),
    limit(pageSize),
  ];
  if (!startAfterDoc) {
    return query(conversationsRef, ...sharedFilters);
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

function sortDocumentsWhenUnordered(documents, maxCount) {
  const firstHasTimestamp = documents.length > 0 && documents[0].data()?.updatedAt;
  if (firstHasTimestamp) return documents;
  if (documents.length === 0) return documents;
  const sorted = sortDocsByMillis(documents, UPDATED_AT_FIELD, 'desc');
  return maxCount ? sorted.slice(0, maxCount) : sorted;
}

function pageMetaFromDocuments(documents) {
  const lastDoc = documents.length ? documents[documents.length - 1] : null;
  const hasMore = documents.length >= CONVERSATIONS_PAGE_SIZE;
  return { lastDoc, hasMore };
}

function safeUnsubscribe(unsubscribe) {
  try {
    unsubscribe();
  } catch (ignoredError) {
    /* ignore */
  }
}
