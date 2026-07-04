/** Push notification send */
const admin = require('firebase-admin');
const { assertCanSendPushNotification } = require('../lib/pushNotificationAuth');
const {
  COPY: PUSH_COPY,
  pickRandom: pushPickRandom,
  sub: pushSub,
  stripNotificationEmoji: pushStripNotificationEmoji,
} = require('../pushHelpers');

function registerNotificationRoutes(app, deps) {
  const { verifyFirebaseBearerToken, serverTs, isTrainerOfClient } = deps;

  app.post('/api/notifications/create', verifyFirebaseBearerToken, async (req, res) => {
    try {
      const requesterUid = String(req.firebaseAuth?.uid || '').trim();
      if (!requesterUid) return res.status(401).json({ error: 'Unauthorized' });

      if (!admin.apps.length) {
        return res.status(503).json({ error: 'Service unavailable' });
      }

      const recipientId = String(req.body?.recipientId || '').trim();
      const clientId = String(req.body?.clientId || requesterUid).trim();
      const type = String(req.body?.type || 'dashboard_update').trim() || 'dashboard_update';
      const payload =
        req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : {};

      if (!recipientId) {
        return res.status(400).json({ error: 'recipientId is required' });
      }
      if (clientId !== requesterUid) {
        return res.status(403).json({ error: 'Forbidden — clientId must match authenticated user' });
      }

      const db = admin.firestore();
      const linked = await isTrainerOfClient(recipientId, clientId);
      if (!linked) {
        return res.status(403).json({ error: 'Forbidden — no active trainer link' });
      }

      const notificationDoc = {
        type: payload.type || type,
        label: payload.label || null,
        clientUid: clientId,
        trainerUid: recipientId,
        value: payload.value != null ? payload.value : null,
        read: false,
        timestamp: serverTs(),
        source: 'dashboard_update',
      };

      const ref = await db.collection('notifications').add(notificationDoc);
      return res.json({ success: true, id: ref.id });
    } catch (e) {
      console.error('POST /api/notifications/create failed:', e?.message || e);
      return res.status(500).json({ error: 'Failed to create notification' });
    }
  });

app.post('/api/notifications/send', verifyFirebaseBearerToken, async (req, res) => {
  try {
    const {
      recipientId,
      senderName,
      messageText,
      senderId: senderIdBody,
      conversationId,
      messageId,
      notificationType: notificationTypeRaw,
    } = req.body;

    const notificationType =
      String(notificationTypeRaw || 'message').trim() || 'message';
    const isChatLike = notificationType === 'message';

    if (!recipientId || !senderName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const requesterUid = String(req.firebaseAuth?.uid || '').trim();
    if (!requesterUid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!admin.apps.length) {
      return res.status(503).json({ error: 'Service unavailable' });
    }

    const db = admin.firestore();
    const maySend = await assertCanSendPushNotification(db, requesterUid, {
      recipientId: String(recipientId),
      senderId: senderIdBody != null ? String(senderIdBody) : requesterUid,
      conversationId: conversationId || '',
    });
    if (!maySend) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`📲 Push: ${requesterUid} → ${recipientId} [${notificationType}]`);
    }

    const recipientDoc = await db.collection('users').doc(recipientId).get();

    if (!recipientDoc.exists) {
      console.warn(`⚠️ Recipient ${recipientId} not found in Firestore`);
      return res.json({ success: false, message: 'Recipient not found' });
    }

    const recipientData = recipientDoc.data();
    if (recipientData?.notificationsEnabled === false) {
      return res.json({ success: false, message: 'Notifications disabled for user' });
    }

    const expoPushToken = recipientData?.expoPushToken || recipientData?.pushToken;

    if (!expoPushToken) {
      console.warn(`⚠️ No Expo push token found for ${recipientId}`);
      return res.json({ success: false, message: 'No push token' });
    }

    if (!expoPushToken.startsWith('ExponentPushToken[') && !expoPushToken.startsWith('ExpoPushToken[')) {
      console.warn(`⚠️ Invalid Expo push token format for ${recipientId}`);
      return res.json({ success: false, message: 'Invalid push token format' });
    }

    const nowMs = Date.now();
    let notificationTitle = senderName;
    let notificationBody = messageText || (isChatLike ? 'You have a new message' : '');

    let notificationData = {
      type: notificationType,
      recipientId,
      senderId: senderIdBody != null ? String(senderIdBody) : '',
      senderName,
      conversationId: conversationId || '',
      messageId: messageId || '',
    };

    if (isChatLike) {
      const senderKeyRaw = senderIdBody || senderName || 'unknown';
      const senderKey = String(senderKeyRaw).replace(/[/\\]/g, '_').slice(0, 200);
      const recentNotifRef = db
        .collection('users')
        .doc(recipientId)
        .collection('recentNotifications')
        .doc(senderKey);
      const recentSnap = await recentNotifRef.get();
      const prev = recentSnap.exists ? recentSnap.data() : null;

      const prevTs = prev?.timestamp?.toMillis
        ? prev.timestamp.toMillis()
        : typeof prev?.timestamp === 'number'
          ? prev.timestamp
          : 0;
      const timeSincePrev = prevTs ? nowMs - prevTs : Infinity;

      const BURST_MS = 10 * 1000;
      const RESET_MS = 5 * 60 * 1000;

      let burstCount = 1;
      notificationBody = messageText || 'You have a new message';

      if (prev && timeSincePrev < BURST_MS) {
        burstCount = (Number(prev.count) || 1) + 1;
        notificationBody = `${burstCount} new messages`;
        console.log(`🔄 Burst messages from ${senderKey}: ${burstCount}`);
      } else if (prev && timeSincePrev >= RESET_MS) {
        burstCount = 1;
      }

      const titleTpl = pushPickRandom(PUSH_COPY.trainerMessageTitles || []);
      if (titleTpl) {
        notificationTitle = pushSub(titleTpl, { trainerName: senderName });
      }

      notificationData = {
        type: 'message',
        recipientId,
        senderId: senderIdBody || null,
        senderName,
        conversationId: conversationId || '',
        messageId: messageId || '',
      };

      await recentNotifRef.set({
        timestamp: admin.firestore.Timestamp.fromMillis(nowMs),
        count: burstCount,
        senderName,
        senderId: senderIdBody || null,
      });
    }

    const safePushTitle = pushStripNotificationEmoji(notificationTitle) || 'CoachConnect';
    let safePushBody = pushStripNotificationEmoji(notificationBody || '');
    if (!safePushBody) {
      safePushBody = isChatLike ? 'You have a new message' : 'Open CoachConnect';
    }

    const notificationPayload = {
      to: expoPushToken,
      title: safePushTitle,
      body: safePushBody,
      sound: 'default',
      priority: 'high',
      channelId: 'default',
      data: Object.fromEntries(
        Object.entries(notificationData).map(([k, v]) => [k, v == null ? '' : String(v)])
      ),
      interruptionLevel: 'active',
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notificationPayload),
    });

    const result = await response.json();
    // Expo returns either { data: [{ status: 'ok', id }] } (batch) or { data: { status: 'ok', id } } (single).
    const ticket = Array.isArray(result?.data) ? result.data[0] : result?.data;
    const expoOk = ticket?.status === 'ok';

    if (expoOk) {
      console.log(`✅ Push notification sent successfully to ${recipientId}`);
      res.json({ success: true, message: 'Notification sent' });
    } else {
      console.error('❌ Expo push notification failed:', result);
      res.json({ success: false, message: 'Expo push failed', details: result });
    }
  } catch (error) {
    console.error('❌ Error sending push notification:', error?.message || error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

}

module.exports = { registerNotificationRoutes };
