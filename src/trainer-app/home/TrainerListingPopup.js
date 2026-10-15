// Popup that reviews one pending trainee request — accept, acknowledge, or reject.
// Flow: open with a request → show profile chips → Accept links them (or acks) → Reject marks the message.
// Used by: NewTraineeRequestsScreen and the trainer home pending-request card.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Animated,
  Pressable,
} from 'react-native';
import { doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';
import { postAcceptTrainerClient } from '../../for-both/online-connection/linkTrainerAndTrainee';
import { syncClientDataFromUsers } from '../my-trainees/traineeList';
import {
  getOrCreateConversation,
  sendMessage,
  updateMessageStatus,
  CLIENT_REQUEST_TYPES,
  clientRequestTypeLabel,
} from '../../ai-coach/coach-actions/alertTrainer';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { postRemotePushNotify } from '../../for-both/online-connection/sendPhoneAlert';
import {
  randomClientRequestAcceptedTitle,
  randomClientRequestAcceptedBody,
} from '../../notifications/writeAlertText';

// ===== NAMED CONSTANTS =====

const DEFAULT_TRAINER_DISPLAY_NAME = 'Your coach';
const ROLE_TRAINER = 'trainer';
const ROLE_CLIENT = 'client';
const MESSAGE_STATUS_ACCEPTED = 'accepted';
const MESSAGE_STATUS_REJECTED = 'rejected';
const PUSH_TYPE_REQUEST_ACCEPTED = 'client_request_accepted';
const ENTER_ANIMATION_MS = 200;
const PRESS_IN_MS = 70;
const PRESS_SPRING_SPEED = 26;
const PRESS_SPRING_BOUNCE = 10;
const PRESS_SCALE_DOWN = 0.95;
const ENTER_SCALE_START = 0.95;
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };

const WORKOUT_PLAN_ACK_TEXT =
  "Got your workout plan request — I'll build your program and follow up soon.";
const GENERIC_ACK_TEXT = "Got your request — I'll follow up soon.";
const WELCOME_NEW_CLIENT_TEXT =
  "Welcome! I've added you as a client. Your personalized dashboard is ready!";
const DECLINE_CONNECTION_TEXT =
  "Thank you for your interest! I'm currently not accepting new clients at this time.";
const DECLINE_OTHER_TEXT =
  "Thanks for your request — I can't take this on right now, but feel free to message me if you want to discuss.";

const MISSING_MESSAGE_ID_TITLE = 'Unavailable';
const MISSING_MESSAGE_ID_BODY =
  'This request is missing a message id. Try closing and opening again.';
const ACCEPT_ERROR_TITLE = 'Error';
const ACCEPT_ERROR_BODY = 'Failed to add client. Please try again.';
const REJECT_ERROR_TITLE = 'Error';
const REJECT_ERROR_BODY = 'Failed to process rejection. Please try again.';

// ===== HELPER FUNCTIONS =====

/**
 * Turn a stored snake_case key into Title Case for the info chips.
 * @param {*} value
 * @returns {*}
 */
function formatDisplayValue(value) {
  if (!value || typeof value !== 'string') return value;
  const words = value.split('_');
  const titledWords = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return titledWords.join(' ');
}

/**
 * Best-effort name for the push title. Falls back to "Your coach" if Firestore is slow.
 * @param {string} trainerUid
 * @returns {Promise<string>}
 */
async function loadTrainerDisplayName(trainerUid) {
  try {
    const trainerSnap = await getDoc(doc(db, 'users', trainerUid));
    if (!trainerSnap.exists()) return DEFAULT_TRAINER_DISPLAY_NAME;
    const trainerData = trainerSnap.data() || {};
    return (
      trainerData.displayName ||
      trainerData.name ||
      trainerData.firstName ||
      DEFAULT_TRAINER_DISPLAY_NAME
    );
  } catch (_loadError) {
    return DEFAULT_TRAINER_DISPLAY_NAME;
  }
}

/**
 * Notify the client that their request was accepted. Best-effort — never blocks the accept flow.
 * @param {{ clientUid: string, trainerUid: string, conversationId?: string, messageId?: string }} args
 * @returns {Promise<void>}
 */
async function notifyClientRequestAccepted({ clientUid, trainerUid, conversationId, messageId }) {
  try {
    if (!clientUid || !trainerUid) return;
    const trainerName = await loadTrainerDisplayName(trainerUid);
    void postRemotePushNotify({
      recipientId: clientUid,
      senderName: randomClientRequestAcceptedTitle(trainerName),
      messageText: randomClientRequestAcceptedBody(trainerName),
      senderId: trainerUid,
      conversationId: conversationId || '',
      messageId: messageId || '',
      notificationType: PUSH_TYPE_REQUEST_ACCEPTED,
    });
  } catch (pushError) {
    console.warn('Client accept push skipped:', pushError?.message || pushError);
  }
}

/**
 * Both users must exist and hold the expected roles before we write the link.
 * @param {string} trainerUid
 * @param {string} clientUid
 * @returns {Promise<void>}
 */
async function assertTrainerAndClientRoles(trainerUid, clientUid) {
  const trainerDoc = await getDoc(doc(db, 'users', trainerUid));
  const clientDoc = await getDoc(doc(db, 'users', clientUid));
  const trainerOk = trainerDoc.exists() && trainerDoc.data().role === ROLE_TRAINER;
  const clientOk = clientDoc.exists() && clientDoc.data().role === ROLE_CLIENT;
  if (!trainerOk || !clientOk) {
    throw new Error('Invalid user roles or missing users');
  }
}

/**
 * Acknowledgment reply for non-connection requests (workout plan, etc.).
 * @param {string} requestType
 * @returns {string}
 */
function acknowledgmentMessageForType(requestType) {
  if (requestType === CLIENT_REQUEST_TYPES.WORKOUT_PLAN) return WORKOUT_PLAN_ACK_TEXT;
  return GENERIC_ACK_TEXT;
}

/**
 * Already linked, or a non-connection request: mark accepted, maybe send an ack, push, then close.
 * @param {object} args
 * @returns {Promise<void>}
 */
async function finishAlreadyLinkedOrNonConnectionAccept({
  request,
  trainerUid,
  isConnectionRequest,
  requestType,
  onClientAdded,
  onClose,
}) {
  await updateMessageStatus(request.messageId, {
    status: MESSAGE_STATUS_ACCEPTED,
    responseTimestamp: serverTimestamp(),
  });

  let ackConversationId = request.conversationId || null;
  if (!isConnectionRequest) {
    try {
      ackConversationId = await getOrCreateConversation(request.clientUid, trainerUid);
      await sendMessage(
        ackConversationId,
        trainerUid,
        acknowledgmentMessageForType(requestType),
      );
    } catch (messageError) {
      console.warn('Acknowledgment message skipped:', messageError?.message || messageError);
    }
  }

  await notifyClientRequestAccepted({
    clientUid: request.clientUid,
    trainerUid,
    conversationId: ackConversationId,
    messageId: request.messageId,
  });
  onClientAdded(request);
  onClose();
}

/**
 * Brand-new connection: server link → welcome chat → sync profile → push.
 * @param {object} args
 * @returns {Promise<void>}
 */
async function finishNewConnectionAccept({ request, trainerUid, onClientAdded, onClose }) {
  await postAcceptTrainerClient({
    trainerId: trainerUid,
    clientId: request.clientUid,
    messageId: request.messageId,
    clientData: {
      clientName: request.clientName,
      clientGoals: request.clientGoals,
      clientExperienceLevel: request.clientExperienceLevel,
      clientEquipment: request.clientEquipment,
      clientLimitations: request.clientLimitations,
    },
  });

  const conversationId = await getOrCreateConversation(request.clientUid, trainerUid);
  await sendMessage(conversationId, trainerUid, WELCOME_NEW_CLIENT_TEXT);

  try {
    await syncClientDataFromUsers(request.clientUid, trainerUid);
  } catch (syncError) {
    console.warn('Could not sync full client data:', syncError?.message);
  }

  await notifyClientRequestAccepted({
    clientUid: request.clientUid,
    trainerUid,
    conversationId,
    messageId: request.messageId,
  });

  onClientAdded(request);
  onClose();
}

/**
 * Build the dark/light color bag used by the modal surface.
 * @param {boolean} isDark
 * @returns {object}
 */
function buildListingThemeColors(isDark) {
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
}

/**
 * One labeled chip in the request info grid.
 * @param {{ label: string, value: *, labelColor: string, textColor: string }} props
 */
function InfoCell({ label, value, labelColor, textColor }) {
  return (
    <View style={styles.infoCell}>
      <Text style={[styles.detailLabel, { color: labelColor }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: textColor }]} numberOfLines={3}>
        {value || '—'}
      </Text>
    </View>
  );
}

/**
 * Pressable that scales down slightly while the finger is down.
 * @param {{ onPress: Function, disabled: boolean, children: * }} props
 */
function PressScale({ onPress, disabled, children }) {
  // vocab: Animated.Value = a number the native driver can tween without re-rendering React.
  const pressProgress = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.timing(pressProgress, {
      toValue: 1,
      duration: PRESS_IN_MS,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressProgress, {
      toValue: 0,
      speed: PRESS_SPRING_SPEED,
      bounciness: PRESS_SPRING_BOUNCE,
      useNativeDriver: true,
    }).start();
  };

  const scale = pressProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, PRESS_SCALE_DOWN],
  });

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={{ flex: 1 }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}

/**
 * Connection requests show four chips; other request types drop Limitations and add Type.
 * @param {object} props
 */
function RequestInfoGrid({ isConnectionRequest, request, modalTitle, themeColors }) {
  const goalsValue = formatDisplayValue(request.clientGoals) || 'Not specified';
  const experienceValue = formatDisplayValue(request.clientExperienceLevel) || 'Beginner';
  const equipmentValue = formatDisplayValue(request.clientEquipment) || 'None';
  const limitationsValue = formatDisplayValue(request.clientLimitations) || 'None';

  if (isConnectionRequest) {
    return (
      <View style={styles.infoGrid}>
        <InfoCell label="GOALS" value={goalsValue} labelColor={themeColors.label} textColor={themeColors.text} />
        <InfoCell label="EXPERIENCE" value={experienceValue} labelColor={themeColors.label} textColor={themeColors.text} />
        <InfoCell label="EQUIPMENT" value={equipmentValue} labelColor={themeColors.label} textColor={themeColors.text} />
        <InfoCell label="LIMITATIONS" value={limitationsValue} labelColor={themeColors.label} textColor={themeColors.text} />
      </View>
    );
  }

  return (
    <View style={styles.infoGrid}>
      <InfoCell label="TYPE" value={modalTitle} labelColor={themeColors.label} textColor={themeColors.text} />
      <InfoCell label="GOALS" value={goalsValue} labelColor={themeColors.label} textColor={themeColors.text} />
      <InfoCell label="EXPERIENCE" value={experienceValue} labelColor={themeColors.label} textColor={themeColors.text} />
      <InfoCell label="EQUIPMENT" value={equipmentValue} labelColor={themeColors.label} textColor={themeColors.text} />
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Modal that lets a trainer accept or reject one pending client request.
 * @param {{ visible: boolean, clientRequest: object|null, trainerUid: string, onClose: Function, onClientAdded: Function, onRequestRejected?: Function }} props
 */
const TrainerListingPopup = ({
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
  const request = clientRequest || {};
  const requestType = request.requestType || CLIENT_REQUEST_TYPES.CONNECTION;
  const isConnectionRequest = requestType === CLIENT_REQUEST_TYPES.CONNECTION;
  const modalTitle = request.requestTitle || clientRequestTypeLabel(requestType);
  const acceptLabel = isConnectionRequest ? 'Accept client' : 'Acknowledge';
  const messageSectionLabel = isConnectionRequest ? 'MESSAGE' : 'REQUEST DETAILS';
  const anyBusy = acceptBusy || rejectBusy;

  const themeColors = useMemo(() => buildListingThemeColors(isDark), [isDark]);

  // Modal entrance animation: fade + scale (0.95 -> 1)
  const enterProgress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    enterProgress.setValue(0);
    Animated.timing(enterProgress, {
      toValue: 1,
      duration: ENTER_ANIMATION_MS,
      useNativeDriver: true,
    }).start();
  }, [visible, enterProgress]);

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
      // 1. Confirm both accounts exist with the right roles.
      await assertTrainerAndClientRoles(trainerUid, request.clientUid);

      // 2. Check whether this trainer↔client link already exists.
      const relationshipDoc = await getDoc(
        doc(db, `trainer_clients/${trainerUid}/clients/${request.clientUid}`),
      );
      const alreadyLinked = relationshipDoc.exists();

      // 3a. Already linked (or not a connection request) → mark accepted / ack only.
      if (alreadyLinked || !isConnectionRequest) {
        await finishAlreadyLinkedOrNonConnectionAccept({
          request,
          trainerUid,
          isConnectionRequest,
          requestType,
          onClientAdded,
          onClose,
        });
        setAcceptBusy(false);
        return;
      }

      // 3b. Brand-new connection → server write + welcome chat + sync.
      await finishNewConnectionAccept({
        request,
        trainerUid,
        onClientAdded,
        onClose,
      });
    } catch (acceptError) {
      console.error('Error adding client:', acceptError);
      Alert.alert(ACCEPT_ERROR_TITLE, ACCEPT_ERROR_BODY, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Retry', onPress: handleAddClient },
      ]);
    } finally {
      setAcceptBusy(false);
    }
  };

  const handleRejectClient = async () => {
    if (!request.messageId) {
      Alert.alert(MISSING_MESSAGE_ID_TITLE, MISSING_MESSAGE_ID_BODY);
      return;
    }

    setRejectBusy(true);
    try {
      // 1. Mark the request message rejected in Firestore.
      await updateMessageStatus(request.messageId, {
        status: MESSAGE_STATUS_REJECTED,
        responseTimestamp: serverTimestamp(),
      });

      // 2. Best-effort decline chat so the client hears something human.
      try {
        const conversationId = await getOrCreateConversation(request.clientUid, trainerUid);
        const declineText = isConnectionRequest ? DECLINE_CONNECTION_TEXT : DECLINE_OTHER_TEXT;
        await sendMessage(conversationId, trainerUid, declineText);
      } catch (messageError) {
        console.warn('Reject notification message skipped:', messageError?.message || messageError);
      }

      // 3. Let the parent refresh its pending list, then close.
      await onRequestRejected?.();
      onClose();
    } catch (rejectError) {
      console.error('Error rejecting client:', rejectError);
      Alert.alert(REJECT_ERROR_TITLE, REJECT_ERROR_BODY);
    } finally {
      setRejectBusy(false);
    }
  };

  const overlayBackground = isDark ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.32)';
  const cardBorderColor = isDark ? 'rgba(167,139,250,0.52)' : 'rgba(124,58,237,0.38)';
  const enterScale = enterProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [ENTER_SCALE_START, 1],
  });
  const messageBody = request.message || 'No message provided.';
  const rejectButtonBackground = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const rejectSpinnerColor = isDark ? '#fff' : '#1e293b';

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: overlayBackground }]}>
        <Animated.View
          style={{
            width: '100%',
            paddingHorizontal: 18,
            opacity: enterProgress,
            transform: [{ scale: enterScale }],
          }}
        >
          <View
            style={[
              styles.modalContainer,
              {
                backgroundColor: themeColors.cardBg,
                borderWidth: 2,
                borderColor: cardBorderColor,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>{modalTitle}</Text>
            <Text style={[styles.clientName, { color: themeColors.clientName }]}>{request.clientName}</Text>

            <RequestInfoGrid
              isConnectionRequest={isConnectionRequest}
              request={request}
              modalTitle={modalTitle}
              themeColors={themeColors}
            />

            <View
              style={[
                styles.messagePreview,
                { backgroundColor: themeColors.glassBg, borderColor: themeColors.glassBorder },
              ]}
            >
              <Text style={[styles.messageLabel, { color: themeColors.label }]}>{messageSectionLabel}</Text>
              <Text style={[styles.messageText, { color: themeColors.text }]} numberOfLines={6}>
                {messageBody}
              </Text>
            </View>

            <View style={styles.buttonGroup}>
              <PressScale onPress={handleAddClient} disabled={anyBusy}>
                <LinearGradient
                  colors={themeColors.acceptGrad}
                  start={GRADIENT_START}
                  end={GRADIENT_END}
                  style={styles.acceptButton}
                >
                  {acceptBusy ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.acceptText}>{acceptLabel}</Text>
                  )}
                </LinearGradient>
              </PressScale>

              <PressScale onPress={handleRejectClient} disabled={anyBusy}>
                <View
                  style={[
                    styles.rejectButton,
                    {
                      backgroundColor: rejectButtonBackground,
                      borderColor: themeColors.glassBorder,
                    },
                  ]}
                >
                  {rejectBusy ? (
                    <ActivityIndicator color={rejectSpinnerColor} size="small" />
                  ) : (
                    <Text style={[styles.rejectText, { color: themeColors.text }]}>Reject</Text>
                  )}
                </View>
              </PressScale>
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={onClose} disabled={anyBusy} activeOpacity={0.8}>
              <Text style={[styles.closeButtonText, { color: themeColors.muted }]}>Close</Text>
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

export default TrainerListingPopup;
