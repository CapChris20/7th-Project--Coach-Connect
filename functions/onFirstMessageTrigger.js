const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

/**
 * Trigger: Firestore - onCreate for top-level messages (Path A)
 * Detects first message between trainer-client pair and triggers onboarding flow
 */
exports.onFirstMessageTrigger = functions.firestore
  .document('messages/{messageId}')
  .onCreate(async (snap, context) => {
    const messageData = snap.data();
    const { messageId } = context.params;

    // Only process if this is a pending message from client
    if (messageData.status !== 'pending' || messageData.systemMessage) {
      return null;
    }

    // Extract trainer and client UIDs from conversationId (conv_clientId_trainerId)
    const conversationId = messageData.conversationId || '';
    const match = conversationId.match(/^conv_(.+)_(.+)$/);
    if (!match) {
      console.log('Invalid conversationId format:', conversationId);
      return null;
    }
    const [_, clientUid, trainerUid] = match;

    if (!trainerUid || !clientUid) {
      console.log('Invalid conversationId format:', conversationId);
      return null;
    }

    try {
      // Pre-execution validation
      const trainerRef = admin.firestore().collection('users').doc(trainerUid);
      const clientRef = admin.firestore().collection('users').doc(clientUid);
      
      const [trainerDoc, clientDoc] = await Promise.all([
        trainerRef.get(),
        clientRef.get(),
      ]);

      // Validate roles
      if (!trainerDoc.exists || !clientDoc.exists) {
        console.log('Missing trainer or client document');
        return null;
      }

      const trainerData = trainerDoc.data();
      const clientData = clientDoc.data();

      if (trainerData.role !== 'trainer' || clientData.role !== 'client') {
        console.log('Invalid user roles:', { trainerRole: trainerData.role, clientRole: clientData.role });
        return null;
      }

      // Check for existing relationship
      const relationshipRef = admin.firestore()
        .collection(`trainer_clients/${trainerUid}/clients`)
        .doc(clientUid);
      
      const relationshipDoc = await relationshipRef.get();
      if (relationshipDoc.exists) {
        console.log('Client already linked to trainer');
        return null;
      }

      // Check if this is truly the first message (Path A)
      const existingMessages = await admin.firestore()
        .collection('messages')
        .where('conversationId', '==', conversationId)
        .where('senderId', '==', clientUid)
        .where('status', '==', 'pending')
        .get();

      if (existingMessages.size > 1) {
        console.log('Not the first message, skipping trigger');
        return null;
      }

      // Create notification for trainer
      await admin.firestore().collection('notifications').add({
        type: 'new_client_request',
        trainerUid,
        clientUid,
        clientName: messageData.clientName || clientData.displayName || 'New Client',
        messageId,
        messageText: messageData.text,
        clientGoals: messageData.clientGoals || clientData.goals,
        clientExperience: messageData.clientExperienceLevel || clientData.experienceLevel,
        clientEquipment: messageData.clientEquipment || clientData.equipment,
        clientLimitations: messageData.clientLimitations || clientData.limitations,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
      });

      // Update trainer's unread count
      await trainerRef.update({
        unreadClientRequests: admin.firestore.FieldValue.increment(1),
        lastActivity: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Log the trigger event
      await admin.firestore().collection('events').add({
        type: 'first_message_trigger',
        trainerUid,
        clientUid,
        messageId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        clientName: messageData.clientName || clientData.displayName,
        trainerName: trainerData.displayName || trainerData.firstName,
      });

      console.log('First message trigger processed successfully:', {
        trainerUid,
        clientUid,
        messageId,
        clientName: messageData.clientName || clientData.displayName,
      });

      return null;

    } catch (error) {
      console.error('Error in onFirstMessageTrigger:', error);
      
      // Log error for debugging
      await admin.firestore().collection('errors').add({
        type: 'first_message_trigger_error',
        error: error.message,
        conversationId: messageData.conversationId,
        messageId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return null;
    }
  });

/**
 * Trigger: Firestore - onUpdate for top-level messages (Path A)
 * Handles trainer responses to client requests
 */
exports.onMessageStatusUpdate = functions.firestore
  .document('messages/{messageId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const { messageId } = context.params;

    // Only process status changes from pending to accepted/rejected
    if (beforeData.status === 'pending' && 
        (afterData.status === 'accepted' || afterData.status === 'rejected')) {
      
      const conversationId = afterData.conversationId || '';
      const match = conversationId.match(/^conv_(.+)_(.+)$/);
      if (!match) return null;
      const [_, clientUid, trainerUid] = match;
      
      try {
        // Update client notifications
        await admin.firestore().collection('notifications').add({
          type: afterData.status === 'accepted' ? 'client_request_accepted' : 'client_request_rejected',
          trainerUid,
          clientUid,
          messageId,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          read: false,
        });

        // Update client's last activity
        await admin.firestore().collection('users').doc(clientUid).update({
          lastActivity: admin.firestore.FieldValue.serverTimestamp(),
        });

        // If accepted, decrement trainer's unread requests
        if (afterData.status === 'accepted') {
          await admin.firestore().collection('users').doc(trainerUid).update({
            unreadClientRequests: admin.firestore.FieldValue.increment(-1),
          });
        }

        console.log(`Message status updated to ${afterData.status}:`, {
          trainerUid,
          clientUid,
          messageId,
        });

      } catch (error) {
        console.error('Error handling message status update:', error);
      }
    }

    return null;
  });
