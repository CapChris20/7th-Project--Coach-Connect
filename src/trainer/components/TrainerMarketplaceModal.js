import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { doc, collection, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../../app/config';
import { syncClientDataFromUsers } from '../services/clientCRMService';
import { getOrCreateConversation, sendMessage, updateMessageStatus } from '../../ai/services/trainerMessaging';

// Helper function to format database keys
function formatDisplayValue(value) {
  if (!value || typeof value !== 'string') return value;
  return value
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const TrainerMarketplaceModal = ({ 
  visible, 
  clientRequest, 
  trainerUid, 
  onClose, 
  onClientAdded 
}) => {
  const [loading, setLoading] = useState(false);

  if (!clientRequest) return null;

  const handleAddClient = async () => {
    setLoading(true);
    try {
      // Pre-execution validation
      const trainerDoc = await getDoc(doc(db, 'users', trainerUid));
      const clientDoc = await getDoc(doc(db, 'users', clientRequest.clientUid));
      
      // Validate roles
      if (
        !trainerDoc.exists() ||
        !clientDoc.exists() ||
        trainerDoc.data().role !== 'trainer' ||
        clientDoc.data().role !== 'client'
      ) {
        throw new Error('Invalid user roles or missing users');
      }

      // Check for existing relationship - if already linked, just mark request as accepted (Path A)
      const relationshipDoc = await getDoc(doc(db, `trainer_clients/${trainerUid}/clients/${clientRequest.clientUid}`));
      if (relationshipDoc.exists()) {
        await updateMessageStatus(clientRequest.messageId, {
          status: 'accepted',
          responseTimestamp: serverTimestamp(),
        });
        onClientAdded(clientRequest);
        onClose();
        setLoading(false);
        return;
      }

      // Execute batch write
      const batch = writeBatch(db);

      // 1a. Add to trainer_client_links (flat collection - easy to see in Firebase Console)
      const linkId = `${trainerUid}_${clientRequest.clientUid}`;
      batch.set(doc(db, 'trainer_client_links', linkId), {
        trainerId: trainerUid,
        clientId: clientRequest.clientUid,
        name: clientRequest.clientName,
        joinedAt: serverTimestamp(),
        status: 'active',
        goals: clientRequest.clientGoals || 'Not specified',
        experience: clientRequest.clientExperienceLevel || 'Beginner',
        equipment: clientRequest.clientEquipment || 'None',
        limitations: clientRequest.clientLimitations || 'None',
      });

      // 1b. Add to trainer_clients subcollection (for compatibility)
      batch.set(doc(db, `trainer_clients/${trainerUid}/clients/${clientRequest.clientUid}`), {
        clientId: clientRequest.clientUid,
        trainerId: trainerUid,
        name: clientRequest.clientName,
        linkedAt: serverTimestamp(),
        status: 'active',
        active: true,
        goals: clientRequest.clientGoals || 'Not specified',
        experience: clientRequest.clientExperienceLevel || 'Beginner',
        equipment: clientRequest.clientEquipment || 'None',
        limitations: clientRequest.clientLimitations || 'None',
      }, { merge: true });

      // 1c. Write reverse relationship on the client user doc
      batch.set(doc(db, 'users', clientRequest.clientUid), {
        trainerId: trainerUid,
      }, { merge: true });

      // 2. Log onboarding event (welcome message sent after batch via Path A)
      batch.set(doc(collection(db, 'events')), {
        type: 'client_onboarded',
        trainerUid,
        clientUid: clientRequest.clientUid,
        timestamp: serverTimestamp(),
      });

      await batch.commit();

      // Update original message status (Path A - top-level messages)
      await updateMessageStatus(clientRequest.messageId, {
        status: 'accepted',
        responseTimestamp: serverTimestamp(),
      });

      // Create conversation and send welcome message (Path A)
      const conversationId = await getOrCreateConversation(clientRequest.clientUid, trainerUid);
      await sendMessage(conversationId, trainerUid, `Welcome! I've added you as a client. Your personalized dashboard is ready!`);

      // P1#5: Sync full client profile from users collection
      try {
        await syncClientDataFromUsers(clientRequest.clientUid, trainerUid);
      } catch (syncErr) {
        console.warn('Could not sync full client data:', syncErr?.message);
      }

      onClientAdded(clientRequest);
      onClose();
      
    } catch (error) {
      console.error('Error adding client:', error);
      Alert.alert(
        'Error',
        'Failed to add client. Please try again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: handleAddClient }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRejectClient = async () => {
    setLoading(true);
    try {
      // Update message status to rejected (Path A)
      await updateMessageStatus(clientRequest.messageId, {
        status: 'rejected',
        responseTimestamp: serverTimestamp(),
      });

      // Send rejection message (Path A)
      const conversationId = await getOrCreateConversation(clientRequest.clientUid, trainerUid);
      await sendMessage(conversationId, trainerUid, `Thank you for your interest! I'm currently not accepting new clients at this time.`);

      onClose();
    } catch (error) {
      console.error('Error rejecting client:', error);
      Alert.alert('Error', 'Failed to process rejection. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>New Client Request</Text>
          <Text style={styles.clientName}>{clientRequest.clientName}</Text>
          
          <View style={styles.clientDetails}>
            <Text style={styles.detailLabel}>Goals:</Text>
            <Text style={styles.detailValue}>{formatDisplayValue(clientRequest.clientGoals) || 'Not specified'}</Text>
            
            <Text style={styles.detailLabel}>Experience:</Text>
            <Text style={styles.detailValue}>{formatDisplayValue(clientRequest.clientExperienceLevel) || 'Beginner'}</Text>
            
            <Text style={styles.detailLabel}>Equipment:</Text>
            <Text style={styles.detailValue}>{formatDisplayValue(clientRequest.clientEquipment) || 'None'}</Text>
            
            <Text style={styles.detailLabel}>Limitations:</Text>
            <Text style={styles.detailValue}>{formatDisplayValue(clientRequest.clientLimitations) || 'None'}</Text>
          </View>

          <View style={styles.messagePreview}>
            <Text style={styles.messageLabel}>Message:</Text>
            <Text style={styles.messageText}>{clientRequest.message}</Text>
          </View>
          
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.button, styles.acceptButton]}
              onPress={handleAddClient}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.buttonText}>Accept</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.rejectButton]}
              onPress={handleRejectClient}
              disabled={loading}
            >
              <Text style={styles.rejectButtonText}>Reject</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#1A1A2E',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 24,
    margin: 20,
    maxWidth: 400,
    width: '100%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  clientName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#C084FC',
    marginBottom: 20,
    textAlign: 'center',
  },
  clientDetails: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.50)',
    marginBottom: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.90)',
    marginBottom: 12,
  },
  messagePreview: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.50)',
    marginBottom: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  messageText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.90)',
    lineHeight: 22,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 16,
  },
  button: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButton: {
    backgroundColor: '#10B981',
  },
  rejectButton: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  rejectButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
  },
  closeButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  closeButtonText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.40)',
  },
});

export default TrainerMarketplaceModal;
