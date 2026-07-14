/** Trainer CRM actions (server-only writes that bypass Firestore rules). */
const admin = require('firebase-admin');
const { verifyTrainerCertification } = require('../lib/verifyTrainerCertification');

async function isTrainerOfClient(db, trainerUid, clientUid) {
  if (!trainerUid || !clientUid) return false;
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

function registerTrainerRoutes(app, deps) {
  const { verifyFirebaseBearerToken, serverTs } = deps;

  app.post('/api/trainer/accept-client', verifyFirebaseBearerToken, async (req, res) => {
    try {
      if (!admin.apps.length) {
        return res.status(503).json({ error: 'Firebase Admin not initialized' });
      }

      const requesterUid = String(req.firebaseAuth?.uid || '').trim();
      const trainerId = String(req.body?.trainerId || '').trim();
      const clientId = String(req.body?.clientId || '').trim();
      const messageId = String(req.body?.messageId || '').trim();
      const clientData = req.body?.clientData && typeof req.body.clientData === 'object'
        ? req.body.clientData
        : {};

      if (!requesterUid) return res.status(401).json({ error: 'Unauthorized' });
      if (!trainerId || !clientId || !messageId) {
        return res.status(400).json({ error: 'trainerId, clientId, and messageId are required' });
      }
      if (requesterUid !== trainerId) {
        return res.status(403).json({ error: 'Forbidden — trainerId must match authenticated user' });
      }

      const db = admin.firestore();

      const trainerDoc = await db.collection('users').doc(trainerId).get();
      const clientDoc = await db.collection('users').doc(clientId).get();
      if (
        !trainerDoc.exists ||
        !clientDoc.exists ||
        trainerDoc.data()?.role !== 'trainer' ||
        clientDoc.data()?.role !== 'client'
      ) {
        return res.status(400).json({ error: 'Invalid trainer or client profile' });
      }

      const messageSnap = await db.collection('messages').doc(messageId).get();
      if (!messageSnap.exists) {
        return res.status(404).json({ error: 'Pending request message not found' });
      }

      const message = messageSnap.data() || {};
      const senderId = String(message.senderId || '').trim();
      const status = String(message.status || '').trim();
      const requestType = String(message.requestType || '').trim();
      const conversationId = String(message.conversationId || '').trim();

      if (senderId !== clientId) {
        return res.status(403).json({ error: 'Message sender does not match clientId' });
      }
      if (status !== 'pending') {
        return res.status(409).json({ error: 'Request is not pending' });
      }
      if (requestType !== 'connection') {
        return res.status(400).json({ error: 'Only connection requests can be accepted via this endpoint' });
      }

      let recipientId = String(message.recipientId || '').trim();
      if (!recipientId && conversationId) {
        const convSnap = await db.collection('conversations').doc(conversationId).get();
        if (convSnap.exists) {
          const conv = convSnap.data() || {};
          recipientId = String(conv.trainerId || '').trim();
          if (!recipientId && Array.isArray(conv.participants)) {
            recipientId = conv.participants.find((id) => id !== clientId) || '';
          }
        }
      }

      if (recipientId !== trainerId) {
        return res.status(403).json({ error: 'Trainer is not the recipient of this connection request' });
      }

      const alreadyLinked = await isTrainerOfClient(db, trainerId, clientId);
      if (!alreadyLinked) {
        const ts = serverTs();
        const linkId = `${trainerId}_${clientId}`;
        const crmPayload = {
          clientId,
          trainerId,
          id: clientId,
          name: clientData.clientName || clientData.name || message.clientName || 'Client',
          joinedAt: ts,
          linkedAt: ts,
          status: 'active',
          active: true,
          goals: clientData.clientGoals || message.clientGoals || 'Not specified',
          experience: clientData.clientExperienceLevel || message.clientExperienceLevel || 'Beginner',
          equipment: clientData.clientEquipment || message.clientEquipment || 'None',
          limitations: clientData.clientLimitations || message.clientLimitations || 'None',
        };

        const batch = db.batch();
        batch.set(
          db.collection('trainer_client_links').doc(linkId),
          {
            trainerId,
            clientId,
            name: crmPayload.name,
            joinedAt: ts,
            status: 'active',
            goals: crmPayload.goals,
            experience: crmPayload.experience,
            equipment: crmPayload.equipment,
            limitations: crmPayload.limitations,
          },
          { merge: true },
        );
        batch.set(
          db.collection('trainer_clients').doc(trainerId).collection('clients').doc(clientId),
          crmPayload,
          { merge: true },
        );
        batch.set(db.collection('users').doc(clientId), { trainerId }, { merge: true });
        await batch.commit();
      }

      await db.collection('messages').doc(messageId).update({
        status: 'accepted',
        responseTimestamp: serverTs(),
      });

      return res.json({ success: true, linked: !alreadyLinked });
    } catch (e) {
      console.error('POST /api/trainer/accept-client failed:', e?.message || e);
      return res.status(500).json({ error: 'Failed to accept client' });
    }
  });

  /**
   * Claude vision certification check.
   * Body: { trainerName, imageBase64?, imageUrl?, mediaType?, storagePath?, fileName? }
   */
  app.post('/api/trainer/verify-certification', verifyFirebaseBearerToken, async (req, res) => {
    try {
      if (!admin.apps.length) {
        return res.status(503).json({ error: 'Firebase Admin not initialized' });
      }

      const requesterUid = String(req.firebaseAuth?.uid || '').trim();
      if (!requesterUid) return res.status(401).json({ error: 'Unauthorized' });

      const trainerId = String(req.body?.trainerId || requesterUid).trim();
      if (trainerId !== requesterUid) {
        return res.status(403).json({ error: 'Forbidden — can only verify your own certification' });
      }

      const trainerName = String(req.body?.trainerName || '').trim();
      const imageBase64 = req.body?.imageBase64 || null;
      const imageUrl = req.body?.imageUrl ? String(req.body.imageUrl).trim() : null;
      const mediaType = req.body?.mediaType || null;
      const storagePath = req.body?.storagePath || null;
      const fileName = req.body?.fileName || null;

      if (!imageBase64 && !imageUrl) {
        return res.status(400).json({ error: 'imageBase64 or imageUrl is required' });
      }

      const result = await verifyTrainerCertification({
        trainerId,
        trainerName,
        imageBase64,
        imageUrl,
        mediaType,
        storagePath,
        fileName,
        serverTs,
      });

      return res.json({
        success: true,
        status: result.status,
        userMessage: result.userMessage,
        isVerified: result.outcome?.isVerified === true,
        analysis: result.analysis,
        aiVerification: result.aiVerification,
      });
    } catch (e) {
      console.error('POST /api/trainer/verify-certification failed:', e?.message || e);
      return res.status(500).json({
        error: e?.message || 'Failed to verify certification',
      });
    }
  });
}

module.exports = { registerTrainerRoutes, isTrainerOfClient };
