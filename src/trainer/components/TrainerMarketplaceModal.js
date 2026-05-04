import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Animated, Pressable } from 'react-native';
import { doc, collection, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../../app/config';
import { syncClientDataFromUsers } from '../services/clientCRMService';
import { getOrCreateConversation, sendMessage, updateMessageStatus } from '../../ai/services/trainerMessaging';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../shared/ui/ThemeContext';

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
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const hasRequest = !!clientRequest;
  const req = clientRequest || {};

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
      accentBorder: ['#FF6B9D', '#C084FC', '#64D2FF'],
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

  // After hooks are declared, it's safe to bail out.
  if (!visible || !hasRequest) return null;

  const handleAddClient = async () => {
    setLoading(true);
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

      // Check for existing relationship - if already linked, just mark request as accepted (Path A)
      const relationshipDoc = await getDoc(doc(db, `trainer_clients/${trainerUid}/clients/${req.clientUid}`));
      if (relationshipDoc.exists()) {
        await updateMessageStatus(req.messageId, {
          status: 'accepted',
          responseTimestamp: serverTimestamp(),
        });
        onClientAdded(req);
        onClose();
        setLoading(false);
        return;
      }

      // Execute batch write
      const batch = writeBatch(db);

      // 1a. Add to trainer_client_links (flat collection - easy to see in Firebase Console)
      const linkId = `${trainerUid}_${req.clientUid}`;
      batch.set(doc(db, 'trainer_client_links', linkId), {
        trainerId: trainerUid,
        clientId: req.clientUid,
        name: req.clientName,
        joinedAt: serverTimestamp(),
        status: 'active',
        goals: req.clientGoals || 'Not specified',
        experience: req.clientExperienceLevel || 'Beginner',
        equipment: req.clientEquipment || 'None',
        limitations: req.clientLimitations || 'None',
      });

      // 1b. Add to trainer_clients subcollection (for compatibility)
      batch.set(doc(db, `trainer_clients/${trainerUid}/clients/${req.clientUid}`), {
        clientId: req.clientUid,
        trainerId: trainerUid,
        name: req.clientName,
        linkedAt: serverTimestamp(),
        status: 'active',
        active: true,
        goals: req.clientGoals || 'Not specified',
        experience: req.clientExperienceLevel || 'Beginner',
        equipment: req.clientEquipment || 'None',
        limitations: req.clientLimitations || 'None',
      }, { merge: true });

      // 1c. Write reverse relationship on the client user doc
      batch.set(doc(db, 'users', req.clientUid), {
        trainerId: trainerUid,
      }, { merge: true });

      // 2. Log onboarding event (welcome message sent after batch via Path A)
      batch.set(doc(collection(db, 'events')), {
        type: 'client_onboarded',
        trainerUid,
        clientUid: req.clientUid,
        timestamp: serverTimestamp(),
      });

      await batch.commit();

      // Update original message status (Path A - top-level messages)
      await updateMessageStatus(req.messageId, {
        status: 'accepted',
        responseTimestamp: serverTimestamp(),
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
      setLoading(false);
    }
  };

  const handleRejectClient = async () => {
    setLoading(true);
    try {
      // Update message status to rejected (Path A)
      await updateMessageStatus(req.messageId, {
        status: 'rejected',
        responseTimestamp: serverTimestamp(),
      });

      // Send rejection message (Path A)
      const conversationId = await getOrCreateConversation(req.clientUid, trainerUid);
      await sendMessage(conversationId, trainerUid, `Thank you for your interest! I'm currently not accepting new clients at this time.`);

      onClose();
    } catch (error) {
      console.error('Error rejecting client:', error);
      Alert.alert('Error', 'Failed to process rejection. Please try again.');
    } finally {
      setLoading(false);
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
          <LinearGradient colors={t.accentBorder} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradientBorder}>
            <View style={[styles.modalContainer, { backgroundColor: t.cardBg, borderColor: t.glassBorder }]}>
              <Text style={[styles.modalTitle, { color: t.text }]}>New Client Request</Text>
              <Text style={[styles.clientName, { color: t.clientName }]}>{req.clientName}</Text>

              <View style={styles.infoGrid}>
                <InfoCell label="GOALS" value={formatDisplayValue(req.clientGoals) || 'Not specified'} />
                <InfoCell label="EXPERIENCE" value={formatDisplayValue(req.clientExperienceLevel) || 'Beginner'} />
                <InfoCell label="EQUIPMENT" value={formatDisplayValue(req.clientEquipment) || 'None'} />
                <InfoCell label="LIMITATIONS" value={formatDisplayValue(req.clientLimitations) || 'None'} />
              </View>

              <View style={[styles.messagePreview, { backgroundColor: t.glassBg, borderColor: t.glassBorder }]}>
                <Text style={[styles.messageLabel, { color: t.label }]}>MESSAGE</Text>
                <Text style={[styles.messageText, { color: t.text }]} numberOfLines={6}>
                  {req.message || 'No message provided.'}
                </Text>
              </View>

              <View style={styles.buttonGroup}>
                <PressScale onPress={handleAddClient} disabled={loading}>
                  <LinearGradient colors={t.acceptGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.acceptButton}>
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.acceptText}>Accept</Text>
                    )}
                  </LinearGradient>
                </PressScale>

                <PressScale onPress={handleRejectClient} disabled={loading}>
                  <View style={[styles.rejectButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderColor: t.glassBorder }]}>
                    <Text style={[styles.rejectText, { color: t.text }]}>Reject</Text>
                  </View>
                </PressScale>
              </View>

              <TouchableOpacity style={styles.closeButton} onPress={onClose} disabled={loading} activeOpacity={0.8}>
                <Text style={[styles.closeButtonText, { color: t.muted }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
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
  gradientBorder: {
    borderRadius: 24,
    padding: 2,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  modalContainer: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    width: '100%',
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
