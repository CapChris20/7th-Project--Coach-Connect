/**
 * Trainer Marketplace Modal
 *
 * Purpose: UI screen or component: Trainer Marketplace Modal. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: (see file)
 *
 * @file-header
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Animated, Pressable } from 'react-native';
import { doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../app-start/config';
import { postAcceptTrainerClient } from '../../shared/api/trainerClientApi';
import { syncClientDataFromUsers } from '../clients-list/loadMyTraineeRoster';
import { getOrCreateConversation, sendMessage, updateMessageStatus, CLIENT_REQUEST_TYPES, clientRequestTypeLabel } from '../../ai-coach/server-logic/trainer-messaging/sendTrainerNotification';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../shared-ui/ThemeContext';
import { postRemotePushNotify } from '../../shared/api/sendPushNotification';
import {
  randomClientRequestAcceptedTitle,
  randomClientRequestAcceptedBody,
} from '../../notifications/buildPushNotificationText';

/**
 * Notify the client that their request was accepted. Best-effort — never blocks the accept flow.
 */
async function notifyClientRequestAccepted({ clientUid, trainerUid, conversationId, messageId }) {
  try {
    if (!clientUid || !trainerUid) return;
    let trainerName = 'Your coach';
    try {
      const tSnap = await getDoc(doc(db, 'users', trainerUid));
      if (tSnap.exists()) {
        const d = tSnap.data() || {};
        trainerName = d.displayName || d.name || d.firstName || trainerName;
      }
    } catch (_) {
      /* keep default trainerName */
    }
    void postRemotePushNotify({
      recipientId: clientUid,
      senderName: randomClientRequestAcceptedTitle(trainerName),
      messageText: randomClientRequestAcceptedBody(trainerName),
      senderId: trainerUid,
      conversationId: conversationId || '',
      messageId: messageId || '',
      notificationType: 'client_request_accepted',
    });
  } catch (e) {
    console.warn('Client accept push skipped:', e?.message || e);
  }
}

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
  onClientAdded,
  /** Called after a successful reject (e.g. refresh pending list). Accept still uses onClientAdded. */
  onRequestRejected,
}) => {
  const { isDark } = useTheme();
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [rejectBusy, setRejectBusy] = useState(false);
  const hasRequest = !!clientRequest;
  const req = clientRequest || {};
  const requestType = req.requestType || CLIENT_REQUEST_TYPES.CONNECTION;
  const isConnectionRequest = requestType === CLIENT_REQUEST_TYPES.CONNECTION;
  const modalTitle = req.requestTitle || clientRequestTypeLabel(requestType);
  const acceptLabel = isConnectionRequest ? 'Accept client' : 'Acknowledge';
  const messageSectionLabel = isConnectionRequest ? 'MESSAGE' : 'REQUEST DETAILS';
  const anyBusy = acceptBusy || rejectBusy;

  const t = useMemo(() => {
    const glassBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    return {
      bg: isDark ? '#0A0A0F' : '#FFFFFF',
      overlay: isDark ? 'rgba(0,0,0,0.62)' : 'rgba(0,0,0,0.28)',
      text: isDark ? '#FFFFFF' : '#000000',
      label: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
      muted: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)',
      glassBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
      glassBorder,
      acceptGrad: ['#FF6B9D', '#C084FC'],
      clientName: '#C084FC',
      shadow: isDark ? '#000' : 'rgba(0,0,0,0.3)',
      cardBg: isDark ? 'rgba(10,10,15,0.92)' : 'rgba(255,255,255,0.92)',
    };
  }, [isDark]);

  // Modal entrance animation: fade + scale (0.95 -> 1)
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, enter]);

  useEffect(() => {
    if (!visible || !clientRequest?.messageId) return;
    setAcceptBusy(false);
    setRejectBusy(false);
  }, [visible, clientRequest?.messageId]);

  // After hooks are declared, it's safe to bail out.
  if (!visible || !hasRequest) return null;

  const handleAddClient = async () => {
    setAcceptBusy(true);
    try {
      // Pre-execution validation
      const trainerDoc = await getDoc(doc(db, 'users', trainerUid));
      const clientDoc = await getDoc(doc(db, 'users', req.clientUid));
      
      // Validate roles
      if (
        !trainerDoc.exists() ||
        !clientDoc.exists() ||
        trainerDoc.data().role !== 'trainer' ||
        clientDoc.data().role !== 'client'
      ) {
        throw new Error('Invalid user roles or missing users');
      }

      const relationshipDoc = await getDoc(doc(db, `trainer_clients/${trainerUid}/clients/${req.clientUid}`));
      const alreadyLinked = relationshipDoc.exists();

      if (alreadyLinked || !isConnectionRequest) {
        await updateMessageStatus(req.messageId, {
          status: 'accepted',
          responseTimestamp: serverTimestamp(),
        });
        let ackConversationId = req.conversationId || null;
        if (!isConnectionRequest) {
          try {
            ackConversationId = await getOrCreateConversation(req.clientUid, trainerUid);
            await sendMessage(
              ackConversationId,
              trainerUid,
              requestType === CLIENT_REQUEST_TYPES.WORKOUT_PLAN
                ? "Got your workout plan request — I'll build your program and follow up soon."
                : "Got your request — I'll follow up soon.",
            );
          } catch (msgErr) {
            console.warn('Acknowledgment message skipped:', msgErr?.message || msgErr);
          }
        }
        await notifyClientRequestAccepted({
          clientUid: req.clientUid,
          trainerUid,
          conversationId: ackConversationId,
          messageId: req.messageId,
        });
        onClientAdded(req);
        onClose();
        setAcceptBusy(false);
        return;
      }

      // New connection — link trainer ↔ client (server Admin SDK writes)
      await postAcceptTrainerClient({
        trainerId: trainerUid,
        clientId: req.clientUid,
        messageId: req.messageId,
        clientData: {
          clientName: req.clientName,
          clientGoals: req.clientGoals,
          clientExperienceLevel: req.clientExperienceLevel,
          clientEquipment: req.clientEquipment,
          clientLimitations: req.clientLimitations,
        },
      });

      // Create conversation and send welcome message (Path A)
      const conversationId = await getOrCreateConversation(req.clientUid, trainerUid);
      await sendMessage(conversationId, trainerUid, `Welcome! I've added you as a client. Your personalized dashboard is ready!`);

      // P1#5: Sync full client profile from users collection
      try {
        await syncClientDataFromUsers(req.clientUid, trainerUid);
      } catch (syncErr) {
        console.warn('Could not sync full client data:', syncErr?.message);
      }

      await notifyClientRequestAccepted({
        clientUid: req.clientUid,
        trainerUid,
        conversationId,
        messageId: req.messageId,
      });

      onClientAdded(req);
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
      setAcceptBusy(false);
    }
  };

  const handleRejectClient = async () => {
    if (!req.messageId) {
      Alert.alert('Unavailable', 'This request is missing a message id. Try closing and opening again.');
      return;
    }
    setRejectBusy(true);
    try {
      await updateMessageStatus(req.messageId, {
        status: 'rejected',
        responseTimestamp: serverTimestamp(),
      });

      try {
        const conversationId = await getOrCreateConversation(req.clientUid, trainerUid);
        const declineText = isConnectionRequest
          ? `Thank you for your interest! I'm currently not accepting new clients at this time.`
          : `Thanks for your request — I can't take this on right now, but feel free to message me if you want to discuss.`;
        await sendMessage(conversationId, trainerUid, declineText);
      } catch (msgErr) {
        console.warn('Reject notification message skipped:', msgErr?.message || msgErr);
      }

      await onRequestRejected?.();
      onClose();
    } catch (error) {
      console.error('Error rejecting client:', error);
      Alert.alert('Error', 'Failed to process rejection. Please try again.');
    } finally {
      setRejectBusy(false);
    }
  };

  const InfoCell = ({ label, value }) => (
    <View style={styles.infoCell}>
      <Text style={[styles.detailLabel, { color: t.label }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: t.text }]} numberOfLines={3}>
        {value || '—'}
      </Text>
    </View>
  );

  const PressScale = ({ onPress, disabled, children }) => {
    const p = useRef(new Animated.Value(0)).current;
    return (
      <Pressable
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => Animated.timing(p, { toValue: 1, duration: 70, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(p, { toValue: 0, speed: 26, bounciness: 10, useNativeDriver: true }).start()}
        style={{ flex: 1 }}
      >
        <Animated.View
          style={{
            transform: [
              {
                scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 0.95] }),
              },
            ],
          }}
        >
          {children}
        </Animated.View>
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.32)' }]}>
        <Animated.View
          style={{
            width: '100%',
            paddingHorizontal: 18,
            opacity: enter,
            transform: [
              {
                scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }),
              },
            ],
          }}
        >
          <View
            style={[
              styles.modalContainer,
              {
                backgroundColor: t.cardBg,
                borderWidth: 2,
                borderColor: isDark ? 'rgba(167,139,250,0.52)' : 'rgba(124,58,237,0.38)',
              },
            ]}
          >
              <Text style={[styles.modalTitle, { color: t.text }]}>{modalTitle}</Text>
              <Text style={[styles.clientName, { color: t.clientName }]}>{req.clientName}</Text>

              {isConnectionRequest ? (
                <View style={styles.infoGrid}>
                  <InfoCell label="GOALS" value={formatDisplayValue(req.clientGoals) || 'Not specified'} />
                  <InfoCell label="EXPERIENCE" value={formatDisplayValue(req.clientExperienceLevel) || 'Beginner'} />
                  <InfoCell label="EQUIPMENT" value={formatDisplayValue(req.clientEquipment) || 'None'} />
                  <InfoCell label="LIMITATIONS" value={formatDisplayValue(req.clientLimitations) || 'None'} />
                </View>
              ) : (
                <View style={styles.infoGrid}>
                  <InfoCell label="TYPE" value={modalTitle} />
                  <InfoCell label="GOALS" value={formatDisplayValue(req.clientGoals) || 'Not specified'} />
                  <InfoCell label="EXPERIENCE" value={formatDisplayValue(req.clientExperienceLevel) || 'Beginner'} />
                  <InfoCell label="EQUIPMENT" value={formatDisplayValue(req.clientEquipment) || 'None'} />
                </View>
              )}

              <View style={[styles.messagePreview, { backgroundColor: t.glassBg, borderColor: t.glassBorder }]}>
                <Text style={[styles.messageLabel, { color: t.label }]}>{messageSectionLabel}</Text>
                <Text style={[styles.messageText, { color: t.text }]} numberOfLines={6}>
                  {req.message || 'No message provided.'}
                </Text>
              </View>

              <View style={styles.buttonGroup}>
                <PressScale onPress={handleAddClient} disabled={anyBusy}>
                  <LinearGradient colors={t.acceptGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.acceptButton}>
                    {acceptBusy ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.acceptText}>{acceptLabel}</Text>
                    )}
                  </LinearGradient>
                </PressScale>

                <PressScale onPress={handleRejectClient} disabled={anyBusy}>
                  <View style={[styles.rejectButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderColor: t.glassBorder }]}>
                    {rejectBusy ? (
                      <ActivityIndicator color={isDark ? '#fff' : '#1e293b'} size="small" />
                    ) : (
                      <Text style={[styles.rejectText, { color: t.text }]}>Reject</Text>
                    )}
                  </View>
                </PressScale>
              </View>

              <TouchableOpacity style={styles.closeButton} onPress={onClose} disabled={anyBusy} activeOpacity={0.8}>
                <Text style={[styles.closeButtonText, { color: t.muted }]}>Close</Text>
              </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  clientName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 18,
    textAlign: 'center',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  infoCell: {
    width: '48%',
    minWidth: 140,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 15,
  },
  messagePreview: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 16,
  },
  acceptButton: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  rejectButton: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectText: {
    fontSize: 15,
    fontWeight: '700',
  },
  closeButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  closeButtonText: {
    fontSize: 14,
  },
});

export default TrainerMarketplaceModal;
