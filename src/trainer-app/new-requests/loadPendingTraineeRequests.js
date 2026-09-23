// Fetches the "a client wants to work with you" requests waiting on a trainer.
// Flow: find every conversation the trainer is in → for each, look for pending messages from the
// OTHER participant → keep only the newest one per client → return a flat list for the UI.
// Used by the pending-requests hook that feeds the trainer's request inbox and its badge count.

/**
 * Service to fetch pending client requests for a trainer.
 * Client requests are stored in top-level messages with conversationId, senderId, status: 'pending'.
 */
import { db } from '../../app-start/cloudConnection';
// vocab: Firestore query building — collection() points at a set of docs, query()+where() filter
// it, getDocs() runs it once (a one-shot read, as opposed to onSnapshot's live listener).
import { collection, query, where, getDocs } from 'firebase/firestore';
import { clientRequestTypeLabel } from '../../ai-coach/coach-actions/alertTrainer';

/**
 * Fetch all pending client requests for a trainer.
 * Uses conversations to find trainer-client pairs, then queries top-level messages.
 * @param {string} trainerUid - The trainer's user ID
 * @returns {Promise<Array>} Array of client request objects
 */
export async function getTrainerPendingRequests(trainerUid) {
  // Guard both inputs: no signed-in trainer, or Firebase not initialized yet (cold start).
  // Returning [] rather than throwing lets callers render an empty inbox instead of an error.
  if (!trainerUid || !db) return [];

  // One outer try/catch so ANY unexpected failure degrades to "no requests" — this feeds a
  // dashboard badge, and a crash there would take down the whole trainer home screen.
  try {
    // Step 1: which clients is this trainer even talking to? Requests are stored as messages, and
    // messages are found via their conversation, so conversations are the entry point.
    const conversationsRef = collection(db, 'conversations');
    // vocab: 'array-contains' = Firestore operator meaning "this array field includes this value".
    // `participants` holds both user ids, so this reads as "conversations I'm part of".
    const convQuery = query(
      conversationsRef,
      where('participants', 'array-contains', trainerUid)
    );
    const convSnapshot = await getDocs(convQuery);

    const requests = [];

    // Step 2: walk each conversation and look for a pending request inside it.
    // Note this is sequential (await inside a for loop), so N conversations means N round trips.
    // That's acceptable because a trainer has few conversations; it would need batching at scale.
    for (const convDoc of convSnapshot.docs) {
      const conv = convDoc.data();
      // The client is "whichever participant isn't me". This is why the pattern only holds for
      // two-person conversations — a group chat would need explicit role fields.
      // vocab: ?. before .find guards conversations written without a participants array
      const clientUid = conv.participants?.find((id) => id !== trainerUid);
      if (!clientUid) continue;

      const conversationId = convDoc.id;
      const messagesRef = collection(db, 'messages');
      // Three filters together define "a request awaiting my answer": in this conversation, sent
      // BY the client (not my own replies), and still pending (not accepted/rejected).
      const msgQuery = query(
        messagesRef,
        where('conversationId', '==', conversationId),
        where('senderId', '==', clientUid),
        where('status', '==', 'pending')
      );

      // Inner try/catch, per conversation: a single unreadable conversation (permissions, or a
      // missing index) shouldn't wipe out the requests we already collected from the others.
      try {
        const msgSnapshot = await getDocs(msgQuery);
        const pendingMsgs = [];
        msgSnapshot.forEach((msgDoc) => {
          const data = msgDoc.data();
          pendingMsgs.push({ id: msgDoc.id, data, timestamp: data.timestamp });
        });
        // Sort by timestamp desc in memory (avoids composite index)
        // Why in memory: Firestore requires a composite index to combine three equality filters
        // with an orderBy. Sorting client-side keeps the query index-free at the cost of ordering
        // a handful of docs — a deliberate trade, not an oversight.
        pendingMsgs.sort((a, b) => {
          // vocab: toMillis() = Firestore Timestamp → milliseconds number. The ?.() calls handle
          // a message written without a timestamp, and ?? 0 sorts those to the very bottom.
          const tA = a.timestamp?.toMillis?.() ?? 0;
          const tB = b.timestamp?.toMillis?.() ?? 0;
          return tB - tA;
        });
        // Only the newest pending message per client becomes a request card. If a client sent
        // several, they'd otherwise appear as duplicate rows in the inbox.
        if (pendingMsgs.length > 0) {
          const { id, data } = pendingMsgs[0];
          // Flatten the message doc into the shape the request card wants. Every field has a
          // fallback because these were written by the client app across multiple app versions,
          // so older requests may be missing the newer fields.
          // Manipulate here: 'Client' is the placeholder name, and 'connection' is the assumed
          // request type when an old request predates typed requests.
          requests.push({
            id,
            messageId: id,
            clientUid,
            clientName: data.clientName || 'Client',
            clientGoals: data.clientGoals,
            clientExperienceLevel: data.clientExperienceLevel,
            clientEquipment: data.clientEquipment,
            clientLimitations: data.clientLimitations,
            requestType: data.requestType || 'connection',
            // If the sender didn't include a title, derive a readable one from the type so the
            // card never shows a blank heading.
            requestTitle: data.requestTitle || clientRequestTypeLabel(data.requestType),
            message: data.text || '',
            timestamp: data.timestamp,
          });
        }
      } catch (err) {
        // warn, not error: this is an expected partial failure, and we carry on with the loop.
        console.warn('Could not query messages for', clientUid, err.message);
      }
    }

    return requests;
  } catch (error) {
    console.error('Error fetching trainer pending requests:', error);
    return [];
  }
}
