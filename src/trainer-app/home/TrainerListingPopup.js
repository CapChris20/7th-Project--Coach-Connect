// Popup that reviews one pending trainee request — accept, acknowledge, or reject.
// Flow: open with a request → show profile chips → Accept links them (or acks) → Reject marks the message.
// Used by: NewTraineeRequestsScreen and the trainer home pending-request card.
//
// vocab: NbCard / NbButton = neobrutalist shells for the modal surface and actions
// vocab: NbNoticeSheet = Design Law sheet instead of Alert.alert

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
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
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { postRemotePushNotify } from '../../for-both/online-connection/sendPhoneAlert';
import {
  randomClientRequestAcceptedTitle,
  randomClientRequestAcceptedBody,
} from '../../notifications/writeAlertText';
import { lightColors, darkColors, nb, borderRadius, spacing } from '../../look-and-feel/colorPalette';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import NbNoticeSheet from '../../look-and-feel/NbNoticeSheet';

// ===== NAMED CONSTANTS =====

const DEFAULT_TRAINER_DISPLAY_NAME = 'Your coach';
const ROLE_TRAINER = 'trainer';
const ROLE_CLIENT = 'client';
const MESSAGE_STATUS_ACCEPTED = 'accepted';
const MESSAGE_STATUS_REJECTED = 'rejected';
const PUSH_TYPE_REQUEST_ACCEPTED = 'client_request_accepted';

// Manipulate here: modal entrance fade/scale timing
const ENTER_ANIMATION_MS = 200;
const ENTER_SCALE_START = 0.95;

// Manipulate here: chat copy the trainer auto-sends on accept / reject
const WORKOUT_PLAN_ACK_TEXT =
  "Got your workout plan request — I'll build your workout plan and follow up soon.";
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
const CLOSE_BUTTON_LABEL = 'Close';
const REJECT_BUTTON_LABEL = 'Reject';
const FALLBACK_MESSAGE_BODY = 'No message provided.';

// ===== HELPER FUNCTIONS =====

/**
 * One labeled value cell in the request info grid.
 */
function InfoCell({ label, value, labelColor, textColor }) {
  const displayValue = value || '—';
  return (
    <View style={styles.infoCell}>
      <Text style={[styles.detailLabel, { color: labelColor }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: textColor }]} numberOfLines={3}>
        {displayValue}
      </Text>
    </View>
  );
}

/**
 * Goals / experience / equipment / limitations chips for the request card.
 * Connection requests show Limitations; other types show TYPE instead.
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

/**
 * Accept / Reject row — shows a spinner slot while that action is in flight.
 */
function AcceptRejectButtonRow({
  acceptBusy,
  rejectBusy,
  anyBusy,
  acceptLabel,
  themeColors,
  onAcceptPress,
  onRejectPress,
}) {
  let acceptSlot;
  if (acceptBusy) {
    acceptSlot = (
      <View style={styles.busySlot}>
        <ActivityIndicator color={themeColors.text} size="small" />
      </View>
    );
  } else {
    acceptSlot = (
      <NbButton variant="brand" onPress={onAcceptPress} disabled={anyBusy} style={styles.flexBtn}>
        {acceptLabel}
      </NbButton>
    );
  }

  let rejectSlot;
  if (rejectBusy) {
    rejectSlot = (
      <View style={styles.busySlot}>
        <ActivityIndicator color={themeColors.text} size="small" />
      </View>
    );
  } else {
    rejectSlot = (
      <NbButton variant="plain" onPress={onRejectPress} disabled={anyBusy} style={styles.flexBtn}>
        {REJECT_BUTTON_LABEL}
      </NbButton>
    );
  }

  return (
    <View style={styles.buttonGroup}>
      {acceptSlot}
      {rejectSlot}
    </View>
  );
}

function extractNoticeProps(notice) {
  if (!notice) {
    return {
      noticeTitle: '',
      noticeConfirmLabel: 'OK',
      noticeMessage: undefined,
      noticeCancelLabel: undefined,
      noticeOnConfirm: undefined,
    };
  }
  const noticeTitle = notice.title || '';
  const noticeConfirmLabel = notice.confirmLabel || 'OK';
  const noticeMessage = notice.message;
  const noticeCancelLabel = notice.cancelLabel;
  const noticeOnConfirm = notice.onConfirm;
  return {
    noticeTitle,
    noticeConfirmLabel,
    noticeMessage,
    noticeCancelLabel,
    noticeOnConfirm,
  };
}

function TrainerListingPopupLayout({
  visible,
  onClose,
  overlayBackground,
  enterProgress,
  enterScale,
  themeColors,
  modalTitle,
  clientName,
  isConnectionRequest,
  request,
  messageSectionLabel,
  messageBody,
  acceptBusy,
  rejectBusy,
  anyBusy,
  acceptLabel,
  handleAddClient,
  handleRejectClient,
  noticeIsVisible,
  noticeTitle,
  noticeMessage,
  noticeConfirmLabel,
  noticeCancelLabel,
  noticeOnConfirm,
  onNoticeClose,
}) {
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
          <NbCard style={styles.modalContainer}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>{modalTitle}</Text>
            <Text style={[styles.clientName, { color: themeColors.clientName }]}>{clientName}</Text>

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

            <AcceptRejectButtonRow
              acceptBusy={acceptBusy}
              rejectBusy={rejectBusy}
              anyBusy={anyBusy}
              acceptLabel={acceptLabel}
              themeColors={themeColors}
              onAcceptPress={handleAddClient}
              onRejectPress={handleRejectClient}
            />

            <TouchableOpacity style={styles.closeButton} onPress={onClose} disabled={anyBusy} activeOpacity={0.8}>
              <Text style={[styles.closeButtonText, { color: themeColors.muted }]}>{CLOSE_BUTTON_LABEL}</Text>
            </TouchableOpacity>
          </NbCard>
        </Animated.View>
      </View>
      <NbNoticeSheet
        visible={noticeIsVisible}
        onClose={onNoticeClose}
        title={noticeTitle}
        message={noticeMessage}
        confirmLabel={noticeConfirmLabel}
        cancelLabel={noticeCancelLabel}
        onConfirm={noticeOnConfirm}
      />
    </Modal>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Modal to accept, acknowledge, or reject one pending client request.
 * Hook order frozen: theme → busy flags → notice → enter animation → reset busy.
 *
 * @param {{
 *   visible: boolean,
 *   clientRequest: object,
 *   trainerUid: string,
 *   onClose: Function,
 *   onClientAdded: Function,
 *   onRequestRejected?: Function,
 * }} props
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
  // vocab: useTheme = light/dark flag for Design Law surfaces
  const { isDark } = useTheme();
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [rejectBusy, setRejectBusy] = useState(false);
  // vocab: notice = NbNoticeSheet payload — title / message / optional Retry
  const [notice, setNotice] = useState(null);

  const hasRequest = !!clientRequest;
  const request = clientRequest || {};
  const requestType = request.requestType || CLIENT_REQUEST_TYPES.CONNECTION;
  const isConnectionRequest = requestType === CLIENT_REQUEST_TYPES.CONNECTION;
  const modalTitle = request.requestTitle || clientRequestTypeLabel(requestType);

  // Name button / section labels before JSX.
  let acceptLabel = 'Acknowledge';
  if (isConnectionRequest) {
    acceptLabel = 'Accept client';
  }
  let messageSectionLabel = 'REQUEST DETAILS';
  if (isConnectionRequest) {
    messageSectionLabel = 'MESSAGE';
  }
  const anyBusy = acceptBusy || rejectBusy;

  // vocab: useMemo = rebuild theme colors only when isDark flips
  const themeColors = useMemo(() => buildListingThemeColors(isDark), [isDark]);

  // Modal entrance animation: fade + scale (0.95 → 1)
  // vocab: Animated.Value = RN driver for opacity/scale; interpolate maps 0..1 → scale
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

  // Fresh open of a request → clear busy flags so Retry isn’t stuck disabled.
  let openRequestMessageId = null;
  if (clientRequest) {
    openRequestMessageId = clientRequest.messageId;
  }
  useEffect(() => {
    if (!visible || !openRequestMessageId) return;
    setAcceptBusy(false);
    setRejectBusy(false);
  }, [visible, openRequestMessageId]);

  // After hooks are declared, it's safe to bail out.
  if (!visible || !hasRequest) return null;

  /**
   * Accept / acknowledge the open request.
   * Flow: 1. busy on  2. run accept pipeline  3. notice on fail  4. busy off
   */
  const handleAddClient = async () => {
    // 1. Lock the Accept button while Firestore / link / chat run.
    setAcceptBusy(true);
    try {
      // 2. Roles → already-linked ack OR new connection link.
      await runTrainerAcceptClientRequest({
        request,
        trainerUid,
        isConnectionRequest,
        requestType,
        onClientAdded,
        onClose,
      });
    } catch (acceptError) {
      // 3. Show Design Law notice with Retry that re-calls this handler.
      console.error('Error adding client:', acceptError);
      setNotice({
        title: ACCEPT_ERROR_TITLE,
        message: ACCEPT_ERROR_BODY,
        cancelLabel: 'Cancel',
        confirmLabel: 'Retry',
        onConfirm: () => {
          setNotice(null);
          handleAddClient();
        },
      });
    } finally {
      // 4. Always clear busy so the trainer can try again.
      setAcceptBusy(false);
    }
  };

  /**
   * Reject the open request.
   * Flow: 1. need messageId  2. busy on  3. mark rejected + decline chat  4. notice on fail
   */
  const handleRejectClient = async () => {
    // 1. Without a message id we cannot update Firestore status — stop early.
    if (!request.messageId) {
      setNotice({ title: MISSING_MESSAGE_ID_TITLE, message: MISSING_MESSAGE_ID_BODY });
      return;
    }

    // 2. Lock Reject while status + decline message write.
    setRejectBusy(true);
    try {
      // 3. Mark rejected, send decline chat, refresh parent list.
      await runTrainerRejectClientRequest({
        request,
        trainerUid,
        isConnectionRequest,
        onRequestRejected,
        onClose,
      });
    } catch (rejectError) {
      console.error('Error rejecting client:', rejectError);
      setNotice({ title: REJECT_ERROR_TITLE, message: REJECT_ERROR_BODY });
    } finally {
      setRejectBusy(false);
    }
  };

  // Named locals for the modal tree.
  const overlayBackground = isDark ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.32)';
  const enterScale = enterProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [ENTER_SCALE_START, 1],
  });
  const messageBody = request.message || FALLBACK_MESSAGE_BODY;
  const noticeIsVisible = !!notice;
  const {
    noticeTitle,
    noticeConfirmLabel,
    noticeMessage,
    noticeCancelLabel,
    noticeOnConfirm,
  } = extractNoticeProps(notice);

  return (
    <TrainerListingPopupLayout
      visible={visible}
      onClose={onClose}
      overlayBackground={overlayBackground}
      enterProgress={enterProgress}
      enterScale={enterScale}
      themeColors={themeColors}
      modalTitle={modalTitle}
      clientName={request.clientName}
      isConnectionRequest={isConnectionRequest}
      request={request}
      messageSectionLabel={messageSectionLabel}
      messageBody={messageBody}
      acceptBusy={acceptBusy}
      rejectBusy={rejectBusy}
      anyBusy={anyBusy}
      acceptLabel={acceptLabel}
      handleAddClient={handleAddClient}
      handleRejectClient={handleRejectClient}
      noticeIsVisible={noticeIsVisible}
      noticeTitle={noticeTitle}
      noticeMessage={noticeMessage}
      noticeConfirmLabel={noticeConfirmLabel}
      noticeCancelLabel={noticeCancelLabel}
      noticeOnConfirm={noticeOnConfirm}
      onNoticeClose={() => setNotice(null)}
    />
  );
};

export default TrainerListingPopup;

// ===== PLUMBING — skip unless debugging =====

/**
 * Turn snake_case profile strings into Title Case for the info cells.
 * Letters of the stored value stay the same; only display changes.
 */
function formatDisplayValue(value) {
  if (!value || typeof value !== 'string') return value;
  const words = value.split('_');
  const titledWords = [];
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    titledWords.push(word.charAt(0).toUpperCase() + word.slice(1));
  }
  return titledWords.join(' ');
}

/**
 * Read the trainer’s public name for the accept push notification.
 * Firestore path letters frozen: users/{trainerUid}
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
  } catch (_trainerNameError) {
    return DEFAULT_TRAINER_DISPLAY_NAME;
  }
}

/**
 * Best-effort push to the client that their request was accepted.
 * Failures are logged and swallowed so accept still completes.
 */
async function notifyClientRequestAccepted({ clientUid, trainerUid, conversationId, messageId }) {
  try {
    if (!clientUid || !trainerUid) return;
    const trainerName = await loadTrainerDisplayName(trainerUid);
    await postRemotePushNotify({
      recipientId: clientUid,
      senderName: randomClientRequestAcceptedTitle(trainerName),
      messageText: randomClientRequestAcceptedBody(trainerName),
      senderId: trainerUid,
      conversationId: conversationId || '',
      messageId: messageId || '',
      notificationType: PUSH_TYPE_REQUEST_ACCEPTED,
    });
  } catch (pushError) {
    let pushErrorText = pushError;
    if (pushError && pushError.message) {
      pushErrorText = pushError.message;
    }
    console.warn('Client accept push skipped:', pushErrorText);
  }
}

/**
 * Both users must exist with the expected roles before we link or ack.
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
 * Chat text for non-connection accepts (workout plan, etc.).
 */
function acknowledgmentMessageForType(requestType) {
  if (requestType === CLIENT_REQUEST_TYPES.WORKOUT_PLAN) return WORKOUT_PLAN_ACK_TEXT;
  return GENERIC_ACK_TEXT;
}

async function sendNonConnectionAckSafely(clientUid, trainerUid, requestType, fallbackConversationId) {
  try {
    const ackConversationId = await getOrCreateConversation(clientUid, trainerUid);
    await sendMessage(
      ackConversationId,
      trainerUid,
      acknowledgmentMessageForType(requestType),
    );
    return ackConversationId;
  } catch (messageError) {
    let messageErrorText = messageError;
    if (messageError && messageError.message) {
      messageErrorText = messageError.message;
    }
    console.warn('Acknowledgment message skipped:', messageErrorText);
    return fallbackConversationId;
  }
}

/**
 * Already-linked client OR non-connection request:
 * mark message accepted, optional ack chat, push, then close.
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
    ackConversationId = await sendNonConnectionAckSafely(
      request.clientUid,
      trainerUid,
      requestType,
      ackConversationId,
    );
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
 * Brand-new connection request: POST link → welcome chat → sync roster → push → close.
 * Firestore relationship path letters frozen under trainer_clients.
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
    let syncErrorText = syncError;
    if (syncError && syncError.message) {
      syncErrorText = syncError.message;
    }
    console.warn('Could not sync full client data:', syncErrorText);
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
 * Theme map for this modal. Keys stay frozen for InfoCell / message preview.
 */
function buildListingThemeColors(isDark) {
  const palette = isDark ? darkColors : lightColors;
  return {
    bg: palette.nbBackground,
    overlay: isDark ? 'rgba(0,0,0,0.62)' : 'rgba(0,0,0,0.28)',
    text: palette.nbInk,
    label: palette.nbMuted,
    muted: palette.nbMuted,
    glassBg: palette.nbSurfaceChip,
    glassBorder: palette.nbBorder,
    clientName: palette.nbInk,
    cardBg: palette.nbSurface,
  };
}

/**
 * Accept pipeline entry: roles → already linked? → ack path OR new connection path.
 */
async function runTrainerAcceptClientRequest({
  request,
  trainerUid,
  isConnectionRequest,
  requestType,
  onClientAdded,
  onClose,
}) {
  await assertTrainerAndClientRoles(trainerUid, request.clientUid);

  // vocab: trainer_clients/{trainer}/clients/{client} = link doc; exists ⇒ already rostered
  const relationshipDoc = await getDoc(
    doc(db, `trainer_clients/${trainerUid}/clients/${request.clientUid}`),
  );
  const clientAlreadyLinked = relationshipDoc.exists();

  if (clientAlreadyLinked || !isConnectionRequest) {
    await finishAlreadyLinkedOrNonConnectionAccept({
      request,
      trainerUid,
      isConnectionRequest,
      requestType,
      onClientAdded,
      onClose,
    });
    return;
  }

  await finishNewConnectionAccept({ request, trainerUid, onClientAdded, onClose });
}

/**
 * Reject pipeline: mark message rejected → decline chat → parent refresh → close.
 */
async function runTrainerRejectClientRequest({
  request,
  trainerUid,
  isConnectionRequest,
  onRequestRejected,
  onClose,
}) {
  await updateMessageStatus(request.messageId, {
    status: MESSAGE_STATUS_REJECTED,
    responseTimestamp: serverTimestamp(),
  });

  try {
    const conversationId = await getOrCreateConversation(request.clientUid, trainerUid);
    let declineText = DECLINE_OTHER_TEXT;
    if (isConnectionRequest) {
      declineText = DECLINE_CONNECTION_TEXT;
    }
    await sendMessage(conversationId, trainerUid, declineText);
  } catch (declineMessageError) {
    let declineErrorText = declineMessageError;
    if (declineMessageError && declineMessageError.message) {
      declineErrorText = declineMessageError.message;
    }
    console.warn('Reject notification message skipped:', declineErrorText);
  }

  if (onRequestRejected) {
    await onRequestRejected();
  }
  onClose();
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    padding: spacing.lg,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  modalTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  clientName: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
    marginBottom: 18,
    textAlign: 'center',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: spacing.md,
  },
  infoCell: {
    width: '48%',
    minWidth: 140,
  },
  detailLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    marginBottom: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
  },
  messagePreview: {
    borderWidth: nb.borderWidth,
    padding: 12,
    borderRadius: borderRadius.nbChip,
    marginBottom: 20,
  },
  messageLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    marginBottom: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  messageText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  flexBtn: {
    flex: 1,
  },
  busySlot: {
    flex: 1,
    height: nb.minTouchTarget,
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    alignItems: 'center',
    paddingVertical: 8,
    minHeight: nb.minTouchTarget,
    justifyContent: 'center',
  },
  closeButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
});
