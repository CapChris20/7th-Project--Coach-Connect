/**
 * conversation Service
 *
 * Purpose: Data/service layer: conversation Service. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/ai
 * Key exports: fetchMoreConversations, subscribeToConversations, subscribeToUnreadCount, subscribeToUnreadByConversation, CONVERSATIONS_PAGE_SIZE
 *
 * @file-header
 */
// Real-time conversation subscription service
// Provides live updates for conversation lists across trainer and client apps

import { db } from '../../../app-start/config';
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
import { getUserData } from '../trainer-messaging/sendTrainerNotification';
import { getDocsWithIndexFallback, sortDocsByMillis } from '../../../shared/firestore/firestorePagedQuery';
import { logSnapshotError } from '../../../shared/services/firestoreListenerUtils';

export const CONVERSATIONS_PAGE_SIZE = 40;

function mapConversationDoc(docSnap) {
  return { id: docSnap.id, ...docSnap.data() };
}

function sortConversations(conversations) {
  return [...conversations].sort((a, b) => {
    const timeA = a.updatedAt?.toMillis?.() || a.updatedAt || 0;
    const timeB = b.updatedAt?.toMillis?.() || b.updatedAt || 0;
    return timeB - timeA;
  });
}

async function hydrateParticipants(uid, conversations, namesCache, dataCache) {
  const loadPromises = [];
  for (const conv of conversations) {
    const otherParticipantId = conv.participants?.find(
      (id) => typeof id === 'string' && id.trim() && id !== uid,
    );
    if (otherParticipantId && !namesCache[otherParticipantId]) {
      loadPromises.push(
        getUserData(otherParticipantId)
          .then((userData) => {
            if (userData) {
              const userName =
                userData.name ||
                `${userData.firstName || ''} ${userData.lastName || ''}`.trim() ||
                userData.displayName ||
                'User';
              namesCache[otherParticipantId] = userName;
              dataCache[otherParticipantId] = userData;
            }
          })
          .catch((err) => {
            console.warn('⚠️ Failed to load user data for', otherParticipantId, err);
          }),
      );
    }
  }
  await Promise.all(loadPromises);
}

function buildConversationsQuery(uid, pageSize, startAfterDoc = null) {
  const conversationsRef = collection(db, 'conversations');
  if (startAfterDoc) {
    return query(
      conversationsRef,
      where('participants', 'array-contains', uid),
      orderBy('updatedAt', 'desc'),
      startAfter(startAfterDoc),
      limit(pageSize),
    );
  }
  return query(
    conversationsRef,
    where('participants', 'array-contains', uid),
    orderBy('updatedAt', 'desc'),
    limit(pageSize),
  );
}

function conversationsFallbackQuery(uid) {
  return query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', uid),
    limit(CONVERSATIONS_PAGE_SIZE),
  );
}

/**
 * Fetch next page of conversations (call from Load more).
 */
export async function fetchMoreConversations(userId, startAfterDoc) {
  const uid = typeof userId === 'string' ? userId.trim() : '';
  if (!uid || !startAfterDoc) {
    return { conversations: [], lastDoc: null, hasMore: false };
  }

  const snap = await getDocsWithIndexFallback(
    buildConversationsQuery(uid, CONVERSATIONS_PAGE_SIZE, startAfterDoc),
    () => conversationsFallbackQuery(uid),
    'conversations loadMore',
  );

  let docs = snap.docs;
  if (docs.length > 0 && !docs[0].data()?.updatedAt) {
    docs = sortDocsByMillis(docs, 'updatedAt', 'desc');
  }

  const conversations = docs.map(mapConversationDoc);
  const lastDoc = docs.length ? docs[docs.length - 1] : null;
  const hasMore = docs.length >= CONVERSATIONS_PAGE_SIZE;

  return { conversations, lastDoc, hasMore };
}

/**
 * Subscribe to the most recent conversation page (real-time, bounded).
 */
export function subscribeToConversations(userId, callback) {
  const uid = typeof userId === 'string' ? userId.trim() : '';
  if (!uid || !callback) {
    console.error('❌ subscribeToConversations: Missing userId or callback');
    return () => {};
  }

  const participantNamesCache = {};
  const participantDataCache = {};

  const primary = buildConversationsQuery(uid, CONVERSATIONS_PAGE_SIZE);
  const buildFallback = () => conversationsFallbackQuery(uid);

  let unsubscribe = () => {};
  let cancelled = false;

  const handleSnapshot = async (querySnapshot) => {
    try {
      let docs = querySnapshot.docs;
      if (docs.length > 0 && !docs[0].data()?.updatedAt) {
        docs = sortDocsByMillis(docs, 'updatedAt', 'desc').slice(0, CONVERSATIONS_PAGE_SIZE);
      }

      const lastDoc = docs.length ? docs[docs.length - 1] : null;
      const hasMore = docs.length >= CONVERSATIONS_PAGE_SIZE;
      const conversations = sortConversations(docs.map(mapConversationDoc));

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
      callback({
        conversations: [],
        participantNames: {},
        participantData: {},
        lastDoc: null,
        hasMore: false,
        error: error?.message || 'Could not load conversations',
      });
    }
  };

  const handleListenerError = (error, mode) => {
    if (cancelled) return;
    if (isFirestoreIndexError(error) && mode === 'primary') {
      attachListener('fallback');
      return;
    }
    console.error('❌ Firestore listener error:', error);
    callback({
      conversations: [],
      participantNames: {},
      participantData: {},
      lastDoc: null,
      hasMore: false,
      error: error?.message || 'Could not load conversations',
    });
  };

  const attachListener = (mode) => {
    const q = mode === 'fallback' ? buildFallback() : primary;
    try {
      unsubscribe();
    } catch (_) {
      /* ignore */
    }
    unsubscribe = onSnapshot(
      q,
      (snap) => {
        void handleSnapshot(snap);
      },
      (err) => handleListenerError(err, mode),
    );
  };

  const boot = async () => {
    try {
      await getDocs(primary);
      if (!cancelled) attachListener('primary');
    } catch (err) {
      if (isFirestoreIndexError(err)) {
        if (!cancelled) attachListener('fallback');
        return;
      }
      console.error('❌ conversations probe failed:', err);
      callback({
        conversations: [],
        participantNames: {},
        participantData: {},
        lastDoc: null,
        hasMore: false,
        error: err?.message || 'Could not load conversations',
      });
    }
  };

  void boot();

  return () => {
    cancelled = true;
    try {
      unsubscribe();
    } catch (_) {
      /* ignore */
    }
  };
}

export function subscribeToUnreadCount(userId, callback) {
  if (!userId || !callback) {
    console.error('❌ subscribeToUnreadCount: Missing userId or callback');
    return () => {};
  }

  const conversationsQuery = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', userId),
    limit(50),
  );

  let unsubscribeFunctions = [];

  const conversationsUnsubscribe = onSnapshot(
    conversationsQuery,
    async (conversationsSnapshot) => {
    unsubscribeFunctions.forEach((unsub) => unsub());
    unsubscribeFunctions = [];

    const conversationIds = [];
    conversationsSnapshot.forEach((convDoc) => {
      conversationIds.push(convDoc.id);
    });

    if (conversationIds.length === 0) {
      callback(0);
      return;
    }

    const countPromises = conversationIds.map(
      (conversationId) =>
        new Promise((resolve) => {
          const messagesQuery = query(
            collection(db, 'messages'),
            where('conversationId', '==', conversationId),
            limit(100),
          );
          const unsub = onSnapshot(
            messagesQuery,
            (messagesSnapshot) => {
              let unreadCount = 0;
              messagesSnapshot.forEach((docSnap) => {
                const messageData = docSnap.data();
                if (messageData.senderId !== userId && messageData.read === false) {
                  unreadCount++;
                }
              });
              resolve(unreadCount);
            },
            (err) => {
              logSnapshotError(err, 'subscribeToUnreadCount messages:');
              resolve(0);
            },
          );
          unsubscribeFunctions.push(unsub);
        }),
    );

    try {
      const counts = await Promise.all(countPromises);
      callback(counts.reduce((sum, count) => sum + count, 0));
    } catch (error) {
      console.error('❌ Error counting unread messages:', error);
      callback(0);
    }
  },
    (err) => {
      logSnapshotError(err, 'subscribeToUnreadCount conversations:');
      callback(0);
    },
  );

  return () => {
    conversationsUnsubscribe();
    unsubscribeFunctions.forEach((unsub) => unsub());
  };
}

export function subscribeToUnreadByConversation(userId, callback) {
  if (!userId || !callback) return () => {};

  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', userId),
    limit(50),
  );
  let unreadByConv = {};
  let messageUnsubscribes = [];

  const conversationsUnsubscribe = onSnapshot(
    q,
    (conversationsSnapshot) => {
    messageUnsubscribes.forEach((unsub) => unsub());
    messageUnsubscribes = [];
    const convIds = [];
    conversationsSnapshot.forEach((docSnap) => convIds.push(docSnap.id));

    if (convIds.length === 0) {
      callback({});
      return;
    }

    convIds.forEach((conversationId) => {
      const messagesQuery = query(
        collection(db, 'messages'),
        where('conversationId', '==', conversationId),
        limit(100),
      );
      const unsub = onSnapshot(
        messagesQuery,
        (messagesSnapshot) => {
          let count = 0;
          messagesSnapshot.forEach((docSnap) => {
            const d = docSnap.data();
            if (d.senderId !== userId && d.read === false) count++;
          });
          unreadByConv[conversationId] = count;
          callback({ ...unreadByConv });
        },
        (err) => logSnapshotError(err, 'subscribeToUnreadByConversation messages:'),
      );
      messageUnsubscribes.push(unsub);
    });
  },
    (err) => {
      logSnapshotError(err, 'subscribeToUnreadByConversation conversations:');
      callback({});
    },
  );

  return () => {
    conversationsUnsubscribe();
    messageUnsubscribes.forEach((unsub) => unsub());
  };
}
