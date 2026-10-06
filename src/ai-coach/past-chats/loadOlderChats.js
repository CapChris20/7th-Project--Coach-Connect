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
import { getDocsWithIndexFallback, sortDocsByMillis } from '../../for-both/cloud-database/loadInPages';

// ===== NAMED CONSTANTS =====

// Manipulate here: how many threads one page of the inbox loads.
export const CONVERSATIONS_PAGE_SIZE = 40;

const CONVERSATIONS_COLLECTION = 'conversations';
const PARTICIPANTS_FIELD = 'participants';
const UPDATED_AT_FIELD = 'updatedAt';
const DEFAULT_PARTICIPANT_NAME = 'User';
const LOAD_MORE_LABEL = 'conversations loadMore';
const COULD_NOT_LOAD_MESSAGE = 'Could not load conversations';

// ===== HELPER FUNCTIONS =====

/**
 * The empty page every failure path hands the screen, so the inbox can render instead of crashing.
 * @param {string} errorMessage
 * @returns {object}
 */
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

/**
 * @param {object} conversationDocument
 * @returns {object}
 */
function mapConversationDoc(conversationDocument) {
  return { id: conversationDocument.id, ...conversationDocument.data() };
}

/**
 * Newest updatedAt first. A missing timestamp sorts as 0 so it sinks to the bottom.
 * vocab: toMillis() = Firestore Timestamp → milliseconds. ?.() skips a plain number or a missing field.
 * @param {object[]} conversations
 * @returns {object[]}
 */
function sortConversations(conversations) {
  return [...conversations].sort((first, second) => {
    const firstTime = first.updatedAt?.toMillis?.() || first.updatedAt || 0;
    const secondTime = second.updatedAt?.toMillis?.() || second.updatedAt || 0;
    return secondTime - firstTime;
  });
}

/**
 * @param {object} userData
 * @returns {string}
 */
function displayNameFromUserData(userData) {
  const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
  return userData.name || fullName || userData.displayName || DEFAULT_PARTICIPANT_NAME;
}

/**
 * The other person in a two-person thread. Group chats are not what this inbox is built for.
 * @param {object} conversation
 * @param {string} uid
 * @returns {string|undefined}
 */
function otherParticipantId(conversation, uid) {
  return conversation.participants?.find(
    (participantId) => typeof participantId === 'string' && participantId.trim() && participantId !== uid,
  );
}

/**
 * Fill name and profile caches for anyone we have not looked up yet.
 * The caches live for the whole subscription so a new snapshot does not re-download every person.
 * @param {string} uid
 * @param {object[]} conversations
 * @param {object} namesCache
 * @param {object} dataCache
 */
async function hydrateParticipants(uid, conversations, namesCache, dataCache) {
  const loadPromises = [];
  for (const conversation of conversations) {
    const participantId = otherParticipantId(conversation, uid);
    if (participantId && !namesCache[participantId]) {
      loadPromises.push(
        getUserData(participantId)
          .then((userData) => {
            if (userData) {
              namesCache[participantId] = displayNameFromUserData(userData);
              dataCache[participantId] = userData;
            }
          })
          .catch((error) => {
            console.warn('⚠️ Failed to load user data for', participantId, error);
          }),
      );
    }
  }
  await Promise.all(loadPromises);
}

/**
 * Indexed page: participants array-contains this user, newest updatedAt first.
 * Passing the last document of the previous page is what "load more" means.
 * @param {string} uid
 * @param {number} pageSize
 * @param {object|null} [startAfterDoc]
 * @returns {object}
 */
function buildConversationsQuery(uid, pageSize, startAfterDoc = null) {
  const conversationsRef = collection(db, CONVERSATIONS_COLLECTION);
  if (startAfterDoc) {
    return query(
      conversationsRef,
      where(PARTICIPANTS_FIELD, 'array-contains', uid),
      orderBy(UPDATED_AT_FIELD, 'desc'),
      startAfter(startAfterDoc),
      limit(pageSize),
    );
  }
  return query(
    conversationsRef,
    where(PARTICIPANTS_FIELD, 'array-contains', uid),
    orderBy(UPDATED_AT_FIELD, 'desc'),
    limit(pageSize),
  );
}

/**
 * Used when the composite index is still building. No orderBy, so it does not need that index.
 * The caller sorts the docs itself.
 * @param {string} uid
 * @returns {object}
 */
function conversationsFallbackQuery(uid) {
  return query(
    collection(db, CONVERSATIONS_COLLECTION),
    where(PARTICIPANTS_FIELD, 'array-contains', uid),
    limit(CONVERSATIONS_PAGE_SIZE),
  );
}

/**
 * Fallback reads have no orderBy, so the first doc has no updatedAt. Sort those here.
 * @param {object[]} documents
 * @param {number} [maxCount]
 * @returns {object[]}
 */
function sortDocumentsWhenUnordered(documents, maxCount) {
  if (documents.length > 0 && !documents[0].data()?.updatedAt) {
    const sorted = sortDocsByMillis(documents, UPDATED_AT_FIELD, 'desc');
    return maxCount ? sorted.slice(0, maxCount) : sorted;
  }
  return documents;
}

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
  const lastDoc = documents.length ? documents[documents.length - 1] : null;
  const hasMore = documents.length >= CONVERSATIONS_PAGE_SIZE;

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
      const lastDoc = documents.length ? documents[documents.length - 1] : null;
      const hasMore = documents.length >= CONVERSATIONS_PAGE_SIZE;
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

  // A missing index on the first try switches to the unordered query. Any other error
  // is reported to the screen. Index errors look like Firestore's failed-precondition.
  const handleListenerError = (error, mode) => {
    if (isCancelled) return;
    if (isFirestoreIndexError(error) && mode === 'primary') {
      attachListener('fallback');
      return;
    }
    console.error('❌ Firestore listener error:', error);
    callback(emptyConversationPage(error?.message || COULD_NOT_LOAD_MESSAGE));
  };

  const attachListener = (mode) => {
    const conversationsQuery = mode === 'fallback' ? conversationsFallbackQuery(uid) : primaryQuery;
    try {
      unsubscribe();
    } catch (ignoredError) {
      /* ignore */
    }
    unsubscribe = onSnapshot(
      conversationsQuery,
      (snapshot) => {
        void handleSnapshot(snapshot);
      },
      (error) => handleListenerError(error, mode),
    );
  };

  // Probe with getDocs first. If the index is missing, that throws here, before we
  // attach a listener that would immediately error the same way.
  const boot = async () => {
    try {
      await getDocs(primaryQuery);
      if (!isCancelled) attachListener('primary');
    } catch (error) {
      if (isFirestoreIndexError(error)) {
        if (!isCancelled) attachListener('fallback');
        return;
      }
      console.error('❌ conversations probe failed:', error);
      callback(emptyConversationPage(error?.message || COULD_NOT_LOAD_MESSAGE));
    }
  };

  void boot();

  return () => {
    isCancelled = true;
    try {
      unsubscribe();
    } catch (ignoredError) {
      /* ignore */
    }
  };
}

export {
  subscribeToUnreadCount,
  subscribeToUnreadByConversation,
  rebuildUnreadIndexForUser,
} from '../../messaging/unreadMessageCounts';
