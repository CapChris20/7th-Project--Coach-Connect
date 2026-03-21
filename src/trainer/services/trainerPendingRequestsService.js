/**
 * Service to fetch pending client requests for a trainer.
 * Client requests are stored in top-level messages with conversationId, senderId, status: 'pending'.
 */
import { db } from '../../app/config';
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * Fetch all pending client requests for a trainer.
 * Uses conversations to find trainer-client pairs, then queries top-level messages.
 * @param {string} trainerUid - The trainer's user ID
 * @returns {Promise<Array>} Array of client request objects
 */
export async function getTrainerPendingRequests(trainerUid) {
  if (!trainerUid || !db) return [];

  try {
    const conversationsRef = collection(db, 'conversations');
    const convQuery = query(
      conversationsRef,
      where('participants', 'array-contains', trainerUid)
    );
    const convSnapshot = await getDocs(convQuery);

    const requests = [];

    for (const convDoc of convSnapshot.docs) {
      const conv = convDoc.data();
      const clientUid = conv.participants?.find((id) => id !== trainerUid);
      if (!clientUid) continue;

      const conversationId = convDoc.id;
      const messagesRef = collection(db, 'messages');
      const msgQuery = query(
        messagesRef,
        where('conversationId', '==', conversationId),
        where('senderId', '==', clientUid),
        where('status', '==', 'pending')
      );

      try {
        const msgSnapshot = await getDocs(msgQuery);
        const pendingMsgs = [];
        msgSnapshot.forEach((msgDoc) => {
          const data = msgDoc.data();
          pendingMsgs.push({ id: msgDoc.id, data, timestamp: data.timestamp });
        });
        // Sort by timestamp desc in memory (avoids composite index)
        pendingMsgs.sort((a, b) => {
          const tA = a.timestamp?.toMillis?.() ?? 0;
          const tB = b.timestamp?.toMillis?.() ?? 0;
          return tB - tA;
        });
        if (pendingMsgs.length > 0) {
          const { id, data } = pendingMsgs[0];
          requests.push({
            id,
            messageId: id,
            clientUid,
            clientName: data.clientName || 'Client',
            clientGoals: data.clientGoals,
            clientExperienceLevel: data.clientExperienceLevel,
            clientEquipment: data.clientEquipment,
            clientLimitations: data.clientLimitations,
            message: data.text || '',
            timestamp: data.timestamp,
          });
        }
      } catch (err) {
        console.warn('Could not query messages for', clientUid, err.message);
      }
    }

    return requests;
  } catch (error) {
    console.error('Error fetching trainer pending requests:', error);
    return [];
  }
}
