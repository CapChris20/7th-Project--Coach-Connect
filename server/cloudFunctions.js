const { stripNotificationEmoji } = require('./stripNotificationEmoji');

const admin = require('firebase-admin');
const functions = require('firebase-functions');

// Initialize Firebase Admin SDK
// Ensure you have your service account key file in your project
// and the GOOGLE_APPLICATION_CREDENTIALS environment variable is set.
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Sends a push notification when a new message is added to a conversation.
 */
exports.sendNewMessageNotification = functions.firestore
  .document('conversations/{conversationId}/messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    const message = snapshot.data();
    const { conversationId } = context.params;

    if (!message) {
      console.log('No message data found.');
      return;
    }

    const { senderId, text } = message;

    try {
      // Get conversation to find participants
      const conversationDoc = await db.collection('conversations').doc(conversationId).get();
      if (!conversationDoc.exists) {
        console.log(`Conversation ${conversationId} not found.`);
        return;
      }
      const conversation = conversationDoc.data();
      const { participants } = conversation;

      if (!participants || participants.length < 2) {
        console.log('Not enough participants in the conversation.');
        return;
      }

      // Determine the recipient
      const recipientId = participants.find(p => p !== senderId);
      if (!recipientId) {
        console.log('Recipient not found.');
        return;
      }

      // Get sender's and recipient's user data
      const senderDoc = await db.collection('users').doc(senderId).get();
      const recipientDoc = await db.collection('users').doc(recipientId).get();

      if (!senderDoc.exists || !recipientDoc.exists) {
        console.log('Sender or recipient not found.');
        return;
      }

      const senderName = senderDoc.data().name || 'Someone';
      const { fcmToken } = recipientDoc.data();

      if (!fcmToken) {
        console.log(`Recipient ${recipientId} does not have an FCM token.`);
        return;
      }

      const cleanSender = stripNotificationEmoji(senderName) || 'Someone';
      let cleanText = stripNotificationEmoji(String(text || ''));
      if (!cleanText.trim()) cleanText = 'You have a new message.';

      // Construct the notification payload (FCM device token only)
      const payload = {
        notification: {
          title: stripNotificationEmoji(`New message from ${cleanSender}`) || 'New message',
          body: cleanText,
          sound: 'default',
        },
        token: fcmToken,
      };

      // Send the notification
      console.log(`Sending FCM notification to ${recipientId}`);
      await admin.messaging().send(payload);
      console.log('Successfully sent notification.');

    } catch (error) {
      console.error('Error sending notification:', error);
    }
  });
