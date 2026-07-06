/**
 * Authorization for POST /api/notifications/send
 */

async function isTrainerOfClient(db, trainerUid, clientUid) {
  if (!db || !trainerUid || !clientUid) return false;
  try {
    const snap = await db
      .collection('trainer_clients')
      .doc(String(trainerUid))
      .collection('clients')
      .doc(String(clientUid))
      .get();
    return snap.exists;
  } catch (_) {
    return false;
  }
}

async function assertCanSendPushNotification(db, requesterUid, { recipientId, senderId, conversationId }) {
  const requester = String(requesterUid || '').trim();
  const recipient = String(recipientId || '').trim();
  const sender = String(senderId || requester).trim();

  if (!requester || !recipient || !sender) return false;
  if (sender !== requester) return false;

  if (recipient === requester) return false;

  if (await isTrainerOfClient(db, requester, recipient)) return true;

  if (conversationId) {
    const convSnap = await db.collection('conversations').doc(String(conversationId)).get();
    if (convSnap.exists) {
      const participants = convSnap.data()?.participants;
      if (Array.isArray(participants) && participants.includes(requester) && participants.includes(recipient)) {
        return true;
      }
    }
  }

  return false;
}

module.exports = {
  assertCanSendPushNotification,
  isTrainerOfClient,
};
