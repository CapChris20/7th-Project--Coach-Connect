/**
 * Paginated mark-as-read helpers — batch updates in pages of 50.
 */
import { db } from '../../../app-start/config';
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
import { clearUnreadForConversation } from '../../../messaging/unreadCountIndex';

const READ_PAGE_SIZE = 50;

export async function markConversationMessagesReadPaginated(conversationId, userId) {
  if (!conversationId || !userId) return 0;

  let lastVisible = null;
  let totalMarked = 0;
  let hasMore = true;

  while (hasMore) {
    let q = query(
      collection(db, 'messages'),
      where('conversationId', '==', conversationId),
      limit(READ_PAGE_SIZE),
    );
    if (lastVisible) {
      q = query(
        collection(db, 'messages'),
        where('conversationId', '==', conversationId),
        startAfter(lastVisible),
        limit(READ_PAGE_SIZE),
      );
    }

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      hasMore = false;
      break;
    }

    const batch = writeBatch(db);
    let pageMarked = 0;
    snapshot.forEach((docSnap) => {
      const messageData = docSnap.data();
      if (messageData.senderId !== userId && messageData.read === false) {
        batch.update(doc(db, 'messages', docSnap.id), { read: true });
        pageMarked += 1;
      }
    });

    if (pageMarked > 0) {
      await batch.commit();
      totalMarked += pageMarked;
    }

    lastVisible = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < READ_PAGE_SIZE) {
      hasMore = false;
    }
  }

  if (totalMarked > 0) {
    await clearUnreadForConversation(userId, conversationId, totalMarked);
  }

  return totalMarked;
}

export async function markAllMessagesReadForUser(userId) {
  if (!userId) return 0;

  const conversationsRef = collection(db, 'conversations');
  const conversationsQuery = query(
    conversationsRef,
    where('participants', 'array-contains', userId),
  );

  const conversationsSnapshot = await getDocs(conversationsQuery);
  let totalMarked = 0;

  for (const convDoc of conversationsSnapshot.docs) {
    const marked = await markConversationMessagesReadPaginated(convDoc.id, userId);
    totalMarked += marked;
  }

  return totalMarked;
}

export { READ_PAGE_SIZE };
