// Design Law 1:1 chat thread (inbox-and-money PNG 09–13): bubbles, attach sheet, session cards, blocked.
// Flow: open thread → load/create conversation → live messages → send text/photos/files / session cards.
// Used by: trainer Messaging tab and client Messages. Export: ChatWithTraineeScreen.

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useTheme } from '../look-and-feel/lightDarkMode';
import {
  getOrCreateConversation,
  sendMessage,
  sendAttachmentMessage,
  updateMessageStatus,
  subscribeToMessages,
  loadEarlierMessages,
  markMessagesAsRead,
  getUserData,
  subscribeConversationTyping,
  pulseConversationTyping,
  clearMyConversationTyping,
  TYPING_UI_STALE_MS,
} from '../ai-coach/coach-actions/alertTrainer';
import { auth, db, storage } from '../app-start/cloudConnection';
import { getTrainerClients, createOrUpdateClient } from '../trainer-app/my-trainees/traineeList';
import { doc, getDoc } from 'firebase/firestore';
import TopHeader from '../for-both/loading-and-header/TopHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  blockUser,
  unblockUser,
  subscribeMyBlocks,
  submitContentReport,
  showSafetyPeerMenu,
  confirmBlockUser,
  ReportOrBlockSheet,
  REPORT_TYPES,
} from '../block-and-report';
import NbAvatar from '../look-and-feel/NbAvatar';
import NbButton from '../look-and-feel/NbButton';
import NbSheet from '../look-and-feel/NbSheet';
import NbNoticeSheet from '../look-and-feel/NbNoticeSheet';
import NbIconChip from '../look-and-feel/NbIconChip';
import HardShadow from '../look-and-feel/HardShadow';
import { accentGradients, borderRadius, nb } from '../look-and-feel/colorPalette';

const HANDOFF_SCHEDULE = require('../assets/icons/handoff/schedule.png');
const HANDOFF_WORKOUT = require('../assets/icons/handoff/workout.png');
// Empty-thread mark — people mark reads “start talking,” not a chat-bubble emoji (Design Law: no emoji icons).
const HANDOFF_PEOPLE = require('../assets/icons/handoff/people.png');

// ===== NAMED CONSTANTS =====

// Manipulate here: relative-time thresholds for bubble timestamps.
const MS_PER_MINUTE = 60000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;
// Manipulate here: file-size display units (1024 bytes = 1 KB).
const BYTES_PER_KB = 1024;
// Manipulate here: typing-indicator poll + debounce before pulse / clear.
const TYPING_STALE_TICK_MS = 400;
const TYPING_PULSE_DELAY_MS = 450;
const TYPING_STOP_DELAY_MS = 2800;
// Manipulate here: delay before scrolling to newest message after a live update.
const SCROLL_AFTER_MESSAGE_MS = 100;
const USERS_COLLECTION = 'users';
const ROLE_TRAINER = 'trainer';

// ===== HELPER FUNCTIONS =====

/** Resolve the other person's uid from the trainer prop (object or string id). */
function otherParticipantIdFromProp(trainerProp) {
  if ((trainerProp == null ? undefined : trainerProp.id)) return trainerProp.id;
  if (typeof trainerProp === 'string') return trainerProp;
  return null;
}

// Decide client vs trainer ids for getOrCreateConversation — conversation row first, else signed-in role.
async function resolveClientAndTrainerIds({ conversation, currentUserUid, otherParticipantId }) {
  if ((conversation == null ? undefined : conversation.clientId) != null && (conversation == null ? undefined : conversation.trainerId) != null) {
    return { clientId: conversation.clientId, trainerId: conversation.trainerId };
  }
  const userDoc = await getDoc(doc(db, USERS_COLLECTION, currentUserUid));
  const signedInIsTrainer = userDoc.exists() && userDoc.data().role === ROLE_TRAINER;
  if (signedInIsTrainer) {
    return { clientId: otherParticipantId, trainerId: currentUserUid };
  }
  return { clientId: currentUserUid, trainerId: otherParticipantId };
}

/**
 * Read users/{uid}.role and whether peerId is already on this trainer's client list.
 */
async function loadTrainerRoleAndClientFlag(currentUserUid, peerId) {
  const userDoc = await getDoc(doc(db, USERS_COLLECTION, currentUserUid));
  if (!userDoc.exists()) {
    return { isTrainer: false, isAlreadyClient: false };
  }
  const userData = userDoc.data();
  const isTrainer = userData.role === ROLE_TRAINER;
  if (!isTrainer || !peerId) {
    return { isTrainer, isAlreadyClient: false };
  }
  const clients = await getTrainerClients(currentUserUid);
  const isAlreadyClient = clients.some((client) => client.id === peerId);
  return { isTrainer, isAlreadyClient };
}

// Firestore / Date → JS Date, or null when missing.
function messageDateFromTimestamp(timestamp) {
  if (!timestamp) return null;
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch (_) {
    return null;
  }
}

function startOfCalendarDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Uppercase TODAY / YESTERDAY (Design Law inbox-and-money 09/10). */
function dateDividerLabel(date) {
  const today = startOfCalendarDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const day = startOfCalendarDay(date);
  if (day.getTime() === today.getTime()) return 'TODAY';
  if (day.getTime() === yesterday.getTime()) return 'YESTERDAY';
  return date
    .toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
    .toUpperCase();
}

/** Timestamp under bubbles — "Just now" or clock time (PNG 09). */
function formatBubbleClock(timestamp) {
  const date = messageDateFromTimestamp(timestamp);
  if (!date) return '';
  const diffMs = Date.now() - date.getTime();
  const minutesAgo = Math.floor(diffMs / MS_PER_MINUTE);
  if (minutesAgo < 1) return 'Just now';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function initialsFromName(name) {
  return (name || '?')
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/**
 * If this message is on a new calendar day, push a TODAY / YESTERDAY / date divider.
 * Returns the day key to remember for the next row (or the previous key when no date).
 */
function pushDayDividerIfNeeded(items, messageDate, lastDayKey) {
  if (!messageDate) return lastDayKey;
  const dayKey = startOfCalendarDay(messageDate).getTime();
  if (dayKey === lastDayKey) return lastDayKey;
  items.push({
    kind: 'divider',
    id: `divider-${dayKey}`,
    label: dateDividerLabel(messageDate),
  });
  return dayKey;
}

/** Caption under an image bubble — stored caption, else text when type is image. */
function imageCaptionFromMessageRow(messageRow) {
  if (messageRow.caption) return messageRow.caption;
  if (messageRow.type === 'image') return messageRow.text || null;
  return null;
}

/** Preview tap handler only when this row is an image with a URL. */
function previewHandlerForMessageRow(messageRow, onPreview) {
  if (messageRow.type !== 'image') return undefined;
  if (!messageRow.fileUrl) return undefined;
  return (onPreview == null ? undefined : onPreview(messageRow.fileUrl));
}

/** Long-press → report peer — only for messages the signed-in user did not send. */
function longPressHandlerForMessageRow(messageRow, sentByMe, onReportPeer) {
  if (sentByMe) return undefined;
  return () =>
    (onReportPeer == null ? undefined : onReportPeer({
      messageId: messageRow.id,
      targetUid: messageRow.senderId,
    }));
}

/** One FlatList/ScrollView row object for a Firestore message (plus optional preview / report). */
function messageRowToThreadItem(messageRow, currentUserUid, extras) {
  const { onPreview, onReportPeer } = extras;
  const sentByMe = messageRow.senderId === currentUserUid;
  return {
    kind: 'message',
    id: messageRow.id,
    text: messageRow.text || '',
    type: messageRow.type,
    fileUrl: messageRow.fileUrl,
    fileName: messageRow.fileName,
    fileSize: messageRow.fileSize,
    caption: imageCaptionFromMessageRow(messageRow),
    sessionTitle: messageRow.sessionTitle || messageRow.title || null,
    sessionWhen: messageRow.sessionWhen || messageRow.whenLabel || null,
    sessionMeta: messageRow.sessionMeta || messageRow.metaLine || null,
    sessionStatus: messageRow.sessionStatus || messageRow.status || null,
    sessionCoachName: messageRow.sessionCoachName || null,
    sent: sentByMe,
    senderId: messageRow.senderId,
    rawTimestamp: messageRow.timestamp,
    clockLabel: formatBubbleClock(messageRow.timestamp),
    onPreview: previewHandlerForMessageRow(messageRow, onPreview),
    onLongPress: longPressHandlerForMessageRow(messageRow, sentByMe, onReportPeer),
  };
}

// Insert day dividers without changing message order (oldest → newest).
function buildThreadRenderList(messages, currentUserUid, extras = {}) {
  const items = [];
  let lastDayKey = null;
  for (const messageRow of messages) {
    const messageDate = messageDateFromTimestamp(messageRow.timestamp);
    lastDayKey = pushDayDividerIfNeeded(items, messageDate, lastDayKey);
    items.push(messageRowToThreadItem(messageRow, currentUserUid, extras));
  }
  return items;
}

function sessionStatusBadgeLabel(sessionStatus) {
  const normalized = String(sessionStatus || 'scheduled').toLowerCase();
  if (normalized === 'confirmed') return 'Session confirmed';
  if (normalized === 'declined') return 'Session declined';
  return 'Session scheduled';
}

function buildChatHeaderSubtitle(peerBlocked, trainerData) {
  if (peerBlocked) return 'Blocked';
  const hasPresence = typeof (trainerData == null ? undefined : trainerData.isOnline) === 'boolean';
  if (hasPresence) {
    if (trainerData.isOnline) return 'Online now';
    return 'Offline';
  }
  if ((trainerData == null ? undefined : trainerData.role) === 'trainer') return 'Your coach';
  if ((trainerData == null ? undefined : trainerData.role) === 'client') return 'Client';
  return 'Direct message';
}

// Merge a "load earlier" page ahead of in-memory rows without duplicate ids.
async function fetchAndMergeEarlierMessages({
  conversationId,
  oldestTimestamp,
  existingMessages,
  setMessages,
  setHasMoreMessages,
  oldestTimestampRef,
}) {
  const { messages: olderPage, hasMore } = await loadEarlierMessages(conversationId, oldestTimestamp);
  const seenIds = new Set(existingMessages.map((row) => row.id));
  const uniqueOlder = olderPage.filter((row) => !seenIds.has(row.id));
  if (uniqueOlder.length) {
    oldestTimestampRef.current = uniqueOlder[0].timestamp ?? oldestTimestampRef.current;
    setMessages((previous) => [...uniqueOlder, ...previous]);
  }
  setHasMoreMessages(hasMore);
}

/** 44×44 HardShadow icon chip (back, menu, attach, send). */
function ChatIconSquare({ onPress, accessibilityLabel, children, fill = false, colors, disabled }) {
  // Fill chips use ink fill + onFill icon; ghost chips use surface + ink icon.
  const chipBackgroundColor = fill ? colors.nbFill : colors.nbSurface;
  const iconColor = fill ? colors.nbOnFill : colors.nbInk;
  const chipOpacity = disabled ? 0.45 : 1;
  const renderChild =
    typeof children === 'function' ? children(iconColor) : children;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{ opacity: chipOpacity }}
    >
      <HardShadow radius={borderRadius.nbChip} offset={nb.shadowOffsetSmall}>
        <View
          style={{
            width: nb.minTouchTarget,
            height: nb.minTouchTarget,
            borderRadius: borderRadius.nbChip,
            borderWidth: nb.borderWidth,
            borderColor: colors.nbBorder,
            backgroundColor: chipBackgroundColor,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {renderChild}
        </View>
      </HardShadow>
    </TouchableOpacity>
  );
}

function ChatDateDivider({ label, colors }) {
  return (
    <View style={chatStyles.dateDividerRow}>
      <View style={[chatStyles.dateDividerLine, { backgroundColor: colors.nbBorder }]} />
      <Text style={[chatStyles.dateDividerText, { color: colors.nbMuted }]}>{label}</Text>
      <View style={[chatStyles.dateDividerLine, { backgroundColor: colors.nbBorder }]} />
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  wrapper: { flexDirection: 'row', marginBottom: 12 },
  bubbleInner: { borderRadius: borderRadius.nbCard, paddingHorizontal: 14, paddingVertical: 12, maxWidth: '100%' },
  text: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  timestamp: { fontSize: 11, marginTop: 4, fontWeight: '700' },
  attachmentImage: { width: 232, height: 168, borderRadius: borderRadius.nbCard },
  attachmentImageWrap: { width: 232, overflow: 'hidden', borderRadius: borderRadius.nbCard },
  attachmentCaption: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    maxWidth: 200,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 2,
  },
  attachmentCaptionText: { fontSize: 12, fontWeight: '800' },
  fileCard: { width: 248, padding: 12, gap: 10 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  attachmentFileName: { fontSize: 14, fontWeight: '800', flex: 1 },
  attachmentFileSize: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  fileDownloadWrap: { marginTop: 6 },
});

function formatFileSize(bytes) {
  if (bytes == null || bytes === 0) return '';
  if (bytes < BYTES_PER_KB) return `${bytes} B`;
  if (bytes < BYTES_PER_KB * BYTES_PER_KB) {
    return `${(bytes / BYTES_PER_KB).toFixed(1)} KB`;
  }
  return `${(bytes / (BYTES_PER_KB * BYTES_PER_KB)).toFixed(1)} MB`;
}

function ChatSessionCard({ message, colors, peerFirstName, onConfirmSession, onChangeSessionTime }) {
  const title = message.sessionTitle || message.text || 'Training session';
  const when = message.sessionWhen || '';
  const meta = message.sessionMeta || '';
  const status = String(message.sessionStatus || 'scheduled').toLowerCase();
  const badge = sessionStatusBadgeLabel(status);

  // Name the headline before JSX — avoid nested ternary in the title row.
  let sessionHeadline = title;
  if (when) {
    sessionHeadline = `${title} · ${when}`;
  }

  let metaNode = null;
  if (meta) {
    metaNode = (
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.nbMuted }}>{meta}</Text>
    );
  }

  const showConfirmRow = status === 'scheduled' && !message.sent;
  let confirmRow = null;
  if (showConfirmRow) {
    confirmRow = (
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <NbButton variant="ghost" sm onPress={() => (onChangeSessionTime == null ? undefined : onChangeSessionTime(message))}>
            Change time
          </NbButton>
        </View>
        <View style={{ flex: 1 }}>
          <NbButton variant="fill" sm onPress={() => (onConfirmSession == null ? undefined : onConfirmSession(message))}>
            Confirm
          </NbButton>
        </View>
      </View>
    );
  }

  return (
    <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard}>
      <View
        style={{
          width: 280,
          borderWidth: nb.borderWidth,
          borderColor: colors.nbBorder,
          backgroundColor: colors.nbSurface,
          borderRadius: borderRadius.nbCard,
          padding: 12,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <LinearGradient
            colors={accentGradients[0]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 999,
              borderWidth: nb.borderWidthPill,
              borderColor: colors.nbBorder,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '900', color: '#0A0A0A' }}>{badge}</Text>
          </LinearGradient>
          {peerFirstName ? (
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.nbMuted }} numberOfLines={1}>
              {peerFirstName}
            </Text>
          ) : null}
        </View>
        <Text style={{ fontSize: 16, fontWeight: '900', color: colors.nbInk }}>
          {sessionHeadline}
        </Text>
        {metaNode}
        {confirmRow}
      </View>
    </HardShadow>
  );
}

function ChatBubble({
  message,
  colors,
  onLongPress,
  peerFirstName,
  onConfirmSession,
  onChangeSessionTime,
}) {
  const isImage = message.type === 'image';
  const isFile = message.type === 'file';
  const isSession = message.type === 'session' || message.sessionTitle || message.sessionWhen;
  const sent = message.sent;
  const bubbleBg = sent ? colors.nbFill : colors.nbSurface;
  const bubbleText = sent ? colors.nbOnFill : colors.nbInk;
  const padless = isImage || isFile || isSession;
  const imageCaption = String(message.caption || '').trim();

  const openFile = () => {
    if (message.fileUrl) Linking.openURL(message.fileUrl);
  };

  const renderBubbleBody = () => {
    if (isSession) {
      return (
        <ChatSessionCard
          message={message}
          colors={colors}
          peerFirstName={peerFirstName}
          onConfirmSession={onConfirmSession}
          onChangeSessionTime={onChangeSessionTime}
        />
      );
    }
    if (isImage && message.fileUrl) {
      return (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => (message.onPreview == null ? undefined : message.onPreview())}
          onLongPress={onLongPress}
          style={bubbleStyles.attachmentImageWrap}
        >
          <Image source={{ uri: message.fileUrl }} style={bubbleStyles.attachmentImage} resizeMode="cover" />
          {imageCaption ? (
            <View
              style={[
                bubbleStyles.attachmentCaption,
                { backgroundColor: colors.nbFill, borderColor: colors.nbBorder },
              ]}
            >
              <Text
                style={[bubbleStyles.attachmentCaptionText, { color: colors.nbOnFill }]}
                numberOfLines={2}
              >
                {imageCaption}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      );
    }
    if (isFile && message.fileUrl) {
      return (
        <View style={[bubbleStyles.fileCard, { backgroundColor: colors.nbSurface }]}>
          <View style={bubbleStyles.fileRow}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                borderWidth: nb.borderWidth,
                borderColor: colors.nbBorder,
                backgroundColor: colors.nbSurfaceChip,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="document-outline" size={22} color={colors.nbInk} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[bubbleStyles.attachmentFileName, { color: colors.nbInk }]} numberOfLines={1}>
                {message.fileName || 'File'}
              </Text>
              {message.fileSize != null ? (
                <Text style={[bubbleStyles.attachmentFileSize, { color: colors.nbMuted }]}>
                  {formatFileSize(message.fileSize)}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={bubbleStyles.fileDownloadWrap}>
            <NbButton variant="ghost" sm onPress={openFile}>
              Download
            </NbButton>
          </View>
        </View>
      );
    }
    return (
      <Text style={[bubbleStyles.text, { color: bubbleText }]}>{message.text || ''}</Text>
    );
  };

  // Name layout decisions before JSX — sent bubbles hug the right edge.
  const rowJustifyContent = sent ? 'flex-end' : 'flex-start';
  const timestampTextAlign = sent ? 'right' : 'left';
  const bubbleBackgroundColor = isFile ? colors.nbSurface : bubbleBg;
  const bubblePaddingHorizontal = padless ? 0 : 14;
  const bubblePaddingVertical = padless ? 0 : 12;

  if (isSession) {
    return (
      <View style={[bubbleStyles.wrapper, { justifyContent: rowJustifyContent }]}>
        <View style={{ maxWidth: '90%' }}>
          {renderBubbleBody()}
          <Text
            style={[
              bubbleStyles.timestamp,
              { color: colors.nbMuted, textAlign: timestampTextAlign },
            ]}
          >
            {message.clockLabel}
          </Text>
        </View>
      </View>
    );
  }

  const bubbleChrome = (
    <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard}>
      <View
        style={[
          bubbleStyles.bubbleInner,
          {
            borderWidth: nb.borderWidth,
            borderColor: colors.nbBorder,
            backgroundColor: bubbleBackgroundColor,
            paddingHorizontal: bubblePaddingHorizontal,
            paddingVertical: bubblePaddingVertical,
            overflow: 'hidden',
          },
        ]}
      >
        {renderBubbleBody()}
      </View>
    </HardShadow>
  );

  const timestampStyle = [
    bubbleStyles.timestamp,
    { color: colors.nbMuted, textAlign: timestampTextAlign },
  ];

  let bubbleBodyNode;
  if (sent) {
    bubbleBodyNode = (
      <View style={{ maxWidth: '82%' }}>
        {bubbleChrome}
        <Text style={timestampStyle}>{message.clockLabel}</Text>
      </View>
    );
  } else {
    bubbleBodyNode = (
      <TouchableOpacity
        activeOpacity={0.92}
        onLongPress={onLongPress}
        delayLongPress={350}
        style={{ maxWidth: '82%' }}
        accessibilityHint="Long press to report this message"
      >
        {bubbleChrome}
        <Text style={timestampStyle}>{message.clockLabel}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[bubbleStyles.wrapper, { justifyContent: rowJustifyContent }]}>
      {bubbleBodyNode}
    </View>
  );
}

const chatStyles = StyleSheet.create({
  headerName: { fontSize: 18, fontWeight: '800', letterSpacing: -0.35 },
  headerSubtitle: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: nb.borderWidth,
  },
  avatarWrap: { position: 'relative' },
  presenceDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  dateDividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14 },
  dateDividerLine: { flex: 1, height: nb.borderWidth },
  dateDividerText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  loadEarlierWrap: { alignItems: 'center', marginBottom: 12 },
  typingStrip: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 6, minHeight: 0 },
  typingBubble: {
    alignSelf: 'flex-start',
    maxWidth: '88%',
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
  },
  typingText: { fontSize: 13, fontWeight: '700' },
  typingDots: { fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  inputBarOuter: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    borderTopWidth: nb.borderWidth,
  },
  inputBarInner: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, minWidth: 0 },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: nb.minTouchTarget,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbChip,
  },
  clientBadgeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
    flexShrink: 0,
  },
  clientBadgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  emptyThread: {
    paddingVertical: 48,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyThreadTitle: {
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  emptyThreadSub: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
  },
});

// ===== MAIN FUNCTION =====

// Live chat thread for one trainer↔client conversation (export default used as client + trainer Messaging).
export default function ChatWithTraineeScreen({ trainer, conversation, onClose, onProfilePress, onSettingsPress, embedInLayout }) {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const embedTopPad = embedInLayout ? Math.max(insets.top, 8) : 0;
  // Parent shell hides BottomMenuBar on threads — only reserve safe area on the composer.
  const embedBottomPad = embedInLayout ? Math.max(insets.bottom, 12) : 0;
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [trainerData, setTrainerData] = useState(null);
  const [isTrainer, setIsTrainer] = useState(false);
  const [isAlreadyClient, setIsAlreadyClient] = useState(false);
  const [addingClient, setAddingClient] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState(null);
  const [previewImageUri, setPreviewImageUri] = useState(null);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [reportSheet, setReportSheet] = useState(null); // { type, messageId?, targetUid? }
  const [reportBusy, setReportBusy] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [peerBlocked, setPeerBlocked] = useState(false);
  const [unblocking, setUnblocking] = useState(false);
  const [notice, setNotice] = useState(null);
  const showNotice = (title, message, onOk) => setNotice({ title, message, onOk });
  const scrollRef = useRef(null);
  const oldestTimestampRef = useRef(null);
  const currentUser = auth.currentUser;
  const unsubscribeRef = useRef(null);
  const cancelledRef = useRef(false);
  const remoteTypingPulseMsRef = useRef(0);
  const typingPulseTimerRef = useRef(null);
  const typingStopTimerRef = useRef(null);

  // 1. Open or create the Firestore conversation, subscribe to messages, load peer profile + trainer flags.
  useEffect(() => {
    if (!trainer || !currentUser) return;
    cancelledRef.current = false;
    unsubscribeRef.current = null;
    initializeConversation()
      .then((cleanup) => {
        if (cancelledRef.current && typeof cleanup === 'function') cleanup();
        else if (typeof cleanup === 'function') unsubscribeRef.current = cleanup;
      })
      .catch((error) => {
        if (!cancelledRef.current) {
          if (__DEV__) console.error('Failed to initialize conversation:', error);
        }
      });
    loadTrainerData();
    checkTrainerRole();
    return () => {
      cancelledRef.current = true;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [trainer, currentUser, conversation]);

  useEffect(() => {
    clearTimeout(typingPulseTimerRef.current);
    clearTimeout(typingStopTimerRef.current);
  }, [conversationId]);

  // 2. Remote typing indicator — local receipt time so device clock skew does not stick the UI.
  useEffect(() => {
    if (!conversationId || !(currentUser == null ? undefined : currentUser.uid)) {
      remoteTypingPulseMsRef.current = 0;
      setRemoteTyping(false);
      return undefined;
    }
    const unsub = subscribeConversationTyping(conversationId, (meta) => {
      const typingUserId = (meta == null ? undefined : meta.typingUserId);
      const typingAtTimestamp = (meta == null ? undefined : meta.typingAt);
      if (!typingUserId || typingUserId === currentUser.uid) {
        remoteTypingPulseMsRef.current = 0;
        setRemoteTyping(false);
        return;
      }
      if (typingAtTimestamp) {
        // Use local receipt time so typing UI does not get stuck if device clock ≠ server.
        remoteTypingPulseMsRef.current = Date.now();
        setRemoteTyping(true);
      }
    });
    const tick = setInterval(() => {
      const lastPulseMs = remoteTypingPulseMsRef.current;
      if (lastPulseMs && Date.now() - lastPulseMs > TYPING_UI_STALE_MS) {
        remoteTypingPulseMsRef.current = 0;
        setRemoteTyping(false);
      }
    }, TYPING_STALE_TICK_MS);
    return () => {
      unsub();
      clearInterval(tick);
    };
  }, [conversationId, (currentUser == null ? undefined : currentUser.uid)]);

  const checkTrainerRole = async () => {
    if (!currentUser || !db) return;
    try {
      const flags = await loadTrainerRoleAndClientFlag(currentUser.uid, (trainer == null ? undefined : trainer.id));
      setIsTrainer(flags.isTrainer);
      setIsAlreadyClient(flags.isAlreadyClient);
    } catch (error) {
      console.error('Error checking trainer role:', error);
    }
  };

  const loadTrainerData = async () => {
    const otherId = otherParticipantIdFromProp(trainer);
    if (!otherId) return;
    const data = await getUserData(otherId);
    setTrainerData(data);
  };

  const initializeConversation = async () => {
    try {
      setLoading(true);
      const otherId = otherParticipantIdFromProp(trainer);
      if (!otherId) throw new Error('Other participant information missing');

      // 1. Resolve clientId + trainerId, then get or create the conversation document.
      const { clientId, trainerId } = await resolveClientAndTrainerIds({
        conversation,
        currentUserUid: currentUser.uid,
        otherParticipantId: otherId,
      });

      const convId = (conversation == null ? undefined : conversation.id) || await getOrCreateConversation(clientId, trainerId);
      if (!convId) throw new Error('Failed to create conversation');
      setConversationId(convId);

      // 2. Live listener — mark read + scroll to newest after each batch.
      const unsubscribe = subscribeToMessages(convId, (newMessages, meta) => {
        setMessages(newMessages);
        setHasMoreMessages(Boolean((meta == null ? undefined : meta.hasMore)));
        oldestTimestampRef.current =
          (meta == null ? undefined : meta.oldestTimestamp) ?? (newMessages.length ? newMessages[0].timestamp : null);
        markMessagesAsRead(convId, currentUser.uid);
        setTimeout(() => (scrollRef.current == null ? undefined : scrollRef.current.scrollToEnd({ animated: true })), SCROLL_AFTER_MESSAGE_MS);
      });
      return () => unsubscribe();
    } catch (error) {
      console.error('Error initializing conversation:', error);
      showNotice('Could not load', error.message || 'Failed to load conversation.');
    } finally {
      setLoading(false);
    }
  };

  const scheduleTypingPulse = (text) => {
    if (!conversationId || !(currentUser == null ? undefined : currentUser.uid)) return;
    clearTimeout(typingPulseTimerRef.current);
    clearTimeout(typingStopTimerRef.current);
    if (!String(text).trim()) {
      clearMyConversationTyping(conversationId, currentUser.uid);
      return;
    }
    typingPulseTimerRef.current = setTimeout(() => {
      pulseConversationTyping(conversationId, currentUser.uid);
    }, TYPING_PULSE_DELAY_MS);
    typingStopTimerRef.current = setTimeout(() => {
      clearMyConversationTyping(conversationId, currentUser.uid);
    }, TYPING_STOP_DELAY_MS);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !conversationId || sending) return;
    const text = messageText.trim();
    clearTimeout(typingPulseTimerRef.current);
    clearTimeout(typingStopTimerRef.current);
    await clearMyConversationTyping(conversationId, currentUser.uid);
    setMessageText('');
    setSending(true);
    try {
      await sendMessage(conversationId, currentUser.uid, text);
      (scrollRef.current == null ? undefined : scrollRef.current.scrollToEnd({ animated: true }));
    } catch (error) {
      console.error('Error sending message:', error);
      setMessageText(text);
      showNotice('Could not send', error.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleAddAsClient = async () => {
    if (!currentUser || !isTrainer || !(trainer == null ? undefined : trainer.id) || !trainerData) return;
    setAddingClient(true);
    try {
      const existingClients = await getTrainerClients(currentUser.uid);
      if (existingClients.some((c) => c.id === trainer.id)) {
        setIsAlreadyClient(true);
        setAddingClient(false);
        return;
      }
      await createOrUpdateClient(trainer.id, currentUser.uid, {
        name: trainerData.name || trainer.name || 'Unknown',
        email: trainerData.email || '',
        photoURL: trainerData.photoURL || trainer.photoURL || null,
        height: trainerData.height || null,
        weight: trainerData.weight || null,
        goals: trainerData.goals || '',
      });
      setIsAlreadyClient(true);
      showNotice('Client added', 'Client added successfully!');
    } catch (error) {
      console.error('Error adding client:', error);
      showNotice('Could not add client', 'Failed to add client.');
    } finally {
      setAddingClient(false);
    }
  };

  const showAttachmentOptions = () => setAttachOpen(true);

  const pickPhotoFromSheet = () => {
    setAttachOpen(false);
    setTimeout(() => {
      void handlePickPhoto();
    }, 180);
  };

  const pickFileFromSheet = () => {
    setAttachOpen(false);
    setTimeout(() => {
      void handlePickFile();
    }, 180);
  };

  // PLUMBING — skip unless debugging uploads: XHR blob read for expo file URIs before Firebase Storage.
  const uriToBlob = (uri) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => resolve(xhr.response);
      xhr.onerror = () => reject(new Error('Failed to read file'));
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send(null);
    });

  const uploadToStorage = async (localUri, filename, contentType = 'application/octet-stream') => {
    if (!storage || !conversationId) throw new Error('Storage or conversation not ready');
    const safeName = (filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `conversations/${conversationId}/attachments/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, path);
    const blob = await uriToBlob(localUri);
    try {
      await uploadBytes(storageRef, blob, { contentType });
      return getDownloadURL(storageRef);
    } catch (err) {
      if ((err == null ? undefined : err.code) === 'storage/unknown') {
        console.warn('Storage upload SDK unknown error (serverResponse):', (err == null ? undefined : err.serverResponse));
      }
      throw err;
    }
  };

  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showNotice('Permission needed', 'Please allow access to your photo library to send photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: false,
        quality: 0.8,
      });
      if (result.canceled || !((result.assets == null ? undefined : result.assets[0]) == null ? undefined : (result.assets == null ? undefined : result.assets[0]).uri)) return;
      const { uri } = result.assets[0];
      const filename = uri.split('/').pop() || `photo_${Date.now()}.jpg`;
      // Composer text becomes the Design Law caption overlay on the image bubble.
      const caption = String(messageText || '').trim() || null;
      setUploadingFileName(filename);
      const downloadUrl = await uploadToStorage(uri, filename, 'image/jpeg');
      await sendAttachmentMessage(conversationId, currentUser.uid, {
        type: 'image',
        fileUrl: downloadUrl,
        fileName: filename,
        caption,
      });
      if (caption) setMessageText('');
      (scrollRef.current == null ? undefined : scrollRef.current.scrollToEnd({ animated: true }));
    } catch (err) {
      console.error('Photo send error:', (err == null ? undefined : err.code), (err == null ? undefined : err.message), (err == null ? undefined : err.serverResponse));
      showNotice('Upload failed', (err == null ? undefined : err.message) || 'Failed to send photo.');
    } finally {
      setUploadingFileName(null);
    }
  };

  // Session card Confirm — write sessionStatus so the badge flips to confirmed.
  const handleConfirmSession = async (message) => {
    if (!(message == null ? undefined : message.id)) return;
    try {
      await updateMessageStatus(message.id, { sessionStatus: 'confirmed', status: 'confirmed' });
      setMessages((prev) =>
        prev.map((row) =>
          row.id === message.id ? { ...row, sessionStatus: 'confirmed', status: 'confirmed' } : row,
        ),
      );
    } catch (err) {
      showNotice('Could not confirm', (err == null ? undefined : err.message) || 'Please try again.');
    }
  };

  // Change time — recipient asks for a new slot; we prefill composer (no silent calendar rewrite).
  const handleChangeSessionTime = (message) => {
    const when = (message == null ? undefined : message.sessionWhen) ? ` (${message.sessionWhen})` : '';
    const draft = `Can we change the time for ${(message == null ? undefined : message.sessionTitle) || 'this session'}${when}?`;
    setMessageText(draft);
    showNotice('Suggest a new time', 'We put a note in the composer — send it, or edit the wording first.');
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled || !(result.assets == null ? undefined : result.assets[0])) return;
      const asset = result.assets[0];
      const { uri, name, size } = asset;
      const filename = name || `file_${Date.now()}`;
      setUploadingFileName(filename);
      const downloadUrl = await uploadToStorage(uri, filename, asset.mimeType || 'application/octet-stream');
      await sendAttachmentMessage(conversationId, currentUser.uid, {
        type: 'file',
        fileUrl: downloadUrl,
        fileName: filename,
        fileSize: size ?? null,
      });
      (scrollRef.current == null ? undefined : scrollRef.current.scrollToEnd({ animated: true }));
    } catch (err) {
      console.error('File send error:', (err == null ? undefined : err.code), (err == null ? undefined : err.message), (err == null ? undefined : err.serverResponse));
      showNotice('Upload failed', (err == null ? undefined : err.message) || 'Failed to send file.');
    } finally {
      setUploadingFileName(null);
    }
  };

  const displayName = (trainerData == null ? undefined : trainerData.name) || (trainer == null ? undefined : trainer.name) || 'User';
  const peerUid = otherParticipantIdFromProp(trainer);
  const peerFirstName = String(displayName).split(/\s+/)[0] || displayName;

  // 3. Block list subscription — toggles composer between message bar and Unblock CTA.
  useEffect(() => {
    if (!(currentUser == null ? undefined : currentUser.uid) || !peerUid) {
      setPeerBlocked(false);
      return undefined;
    }
    return subscribeMyBlocks(currentUser.uid, (blockedIds) => {
      setPeerBlocked(blockedIds.has(peerUid));
    });
  }, [(currentUser == null ? undefined : currentUser.uid), peerUid]);

  const handleUnblockPeer = async () => {
    if (!(currentUser == null ? undefined : currentUser.uid) || !peerUid || unblocking) return;
    setUnblocking(true);
    try {
      await unblockUser(currentUser.uid, peerUid);
      setPeerBlocked(false);
    } catch (e) {
      showNotice('Unblock failed', (e == null ? undefined : e.message) || 'Try again.');
    } finally {
      setUnblocking(false);
    }
  };

  const runReport = (type, extra = {}) => {
    if (!(currentUser == null ? undefined : currentUser.uid) || !peerUid) return;
    setReportSheet({
      type,
      messageId: extra.messageId || null,
      targetUid: extra.targetUid || peerUid,
    });
  };

  const submitReportSheet = async ({ reasonId, alsoBlock }) => {
    if (!(currentUser == null ? undefined : currentUser.uid) || !reportSheet) return;
    setReportBusy(true);
    try {
      await submitContentReport({
        reporterId: currentUser.uid,
        type: reportSheet.type,
        targetUid: reportSheet.targetUid || peerUid,
        reason: reasonId,
        conversationId,
        messageId: reportSheet.messageId || null,
        targetDisplayName: displayName,
      });
      if (alsoBlock && peerUid) {
        await blockUser(currentUser.uid, peerUid, { displayName });
      }
      setReportSheet(null);
      showNotice(
        alsoBlock ? 'Reported and blocked' : 'Report sent',
        alsoBlock
          ? `${displayName} is blocked. You can unblock in Settings → Blocked users.`
          : 'Thanks — we’ll review this as soon as we can.',
        alsoBlock ? () => (onClose == null ? undefined : onClose()) : undefined,
      );
    } catch (e) {
      showNotice('Report failed', (e == null ? undefined : e.message) || 'Try again.');
    } finally {
      setReportBusy(false);
    }
  };

  const runBlockPeer = () => {
    if (!(currentUser == null ? undefined : currentUser.uid) || !peerUid) return;
    confirmBlockUser({
      peerName: displayName,
      presentNotice: (title, message, extras = {}) => setNotice({ title, message, ...extras }),
      onConfirm: async () => {
        try {
          await blockUser(currentUser.uid, peerUid, { displayName });
          showNotice(
            'Blocked',
            `${displayName} is blocked. You can unblock in Settings → Blocked users.`,
            () => (onClose == null ? undefined : onClose()),
          );
        } catch (e) {
          showNotice('Block failed', (e == null ? undefined : e.message) || 'Try again.');
        }
      },
    });
  };

  const openPeerSafetyMenu = () => {
    showSafetyPeerMenu({
      peerName: displayName,
      onReport: () => runReport(REPORT_TYPES.USER),
      onBlock: runBlockPeer,
    });
  };

  const threadItems = buildThreadRenderList(messages, (currentUser == null ? undefined : currentUser.uid), {
    onPreview: (url) => setPreviewImageUri(url),
    onReportPeer: (extra) =>
      runReport(REPORT_TYPES.MESSAGE, {
        messageId: extra.messageId,
        targetUid: extra.targetUid || peerUid,
      }),
  });

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.nbBackground }}>
        <ActivityIndicator size="large" color={colors.nbFill} />
      </View>
    );
  }

  const hasPresence = typeof (trainerData == null ? undefined : trainerData.isOnline) === 'boolean';
  const isPeerOnline = hasPresence && trainerData.isOnline;
  const headerSubtitle = buildChatHeaderSubtitle(peerBlocked, trainerData);

  const identityBlock = (
    <>
      <View style={chatStyles.avatarWrap}>
        <NbAvatar
          source={(trainerData == null ? undefined : trainerData.photoURL) || (trainer == null ? undefined : trainer.photoURL)}
          initials={initialsFromName(displayName)}
          size={44}
        />
        {hasPresence && isPeerOnline ? (
          <View
            style={[
              chatStyles.presenceDot,
              { backgroundColor: colors.nbFill, borderColor: colors.nbBackground },
            ]}
          />
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }} pointerEvents="box-none">
        <Text style={[chatStyles.headerName, { color: colors.nbInk }]} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={[chatStyles.headerSubtitle, { color: colors.nbMuted }]} numberOfLines={1}>
          {headerSubtitle}
        </Text>
      </View>
    </>
  );

  const headerBar = (
    <View
      style={[
        chatStyles.headerRow,
        {
          borderBottomColor: colors.nbBorder,
          backgroundColor: colors.nbBackground,
          ...(embedTopPad ? { paddingTop: embedTopPad + 10 } : null),
        },
      ]}
    >
      <ChatIconSquare onPress={onClose} accessibilityLabel="Back to inbox" colors={colors}>
        {(iconColor) => <Ionicons name="chevron-back" size={22} color={iconColor} />}
      </ChatIconSquare>
      {typeof onProfilePress === 'function' ? (
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={onProfilePress}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 }}
          accessibilityRole="button"
          accessibilityLabel={`${displayName} profile`}
        >
          {identityBlock}
        </TouchableOpacity>
      ) : (
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 }}>{identityBlock}</View>
      )}
      {isTrainer && !isAlreadyClient ? (
        <View style={{ flexShrink: 0, maxWidth: 108 }}>
          <NbButton variant="fill" sm onPress={handleAddAsClient} disabled={addingClient}>
            {addingClient ? '…' : '+ Client'}
          </NbButton>
        </View>
      ) : null}
      {isTrainer && isAlreadyClient ? (
        <View style={[chatStyles.clientBadgeInner, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface }]}>
          <Ionicons name="checkmark-circle" size={15} color={colors.nbMuted} />
          <Text style={[chatStyles.clientBadgeText, { color: colors.nbMuted }]}>Client</Text>
        </View>
      ) : null}
      {peerUid ? (
        <ChatIconSquare onPress={openPeerSafetyMenu} accessibilityLabel="Report or block" colors={colors}>
          {(iconColor) => <Ionicons name="ellipsis-horizontal" size={18} color={iconColor} />}
        </ChatIconSquare>
      ) : (
        <View style={{ width: nb.minTouchTarget }} />
      )}
    </View>
  );

  const chatBody = (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      {headerBar}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
        onContentSizeChange={() => (scrollRef.current == null ? undefined : scrollRef.current.scrollToEnd({ animated: true }))}
        scrollEventThrottle={16}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {threadItems.length === 0 ? (
          <View style={chatStyles.emptyThread}>
            {/* Hard sticker + gradient chip instead of 💬 — matches inbox-and-money empty chrome */}
            <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbIconChip} style={{ marginBottom: 16 }}>
              <NbIconChip source={HANDOFF_PEOPLE} index={0} size={56} />
            </HardShadow>
            <Text style={[chatStyles.emptyThreadTitle, { color: colors.nbInk }]}>
              Start a conversation
            </Text>
            <Text style={[chatStyles.emptyThreadSub, { color: colors.nbMuted }]}>
              Say hi to {displayName} — your messages will show up here.
            </Text>
          </View>
        ) : (
          <>
            {hasMoreMessages ? (
              <View style={chatStyles.loadEarlierWrap}>
                {loadingEarlier ? (
                  <ActivityIndicator size="small" color={colors.nbFill} />
                ) : (
                  <NbButton
                    variant="ghost"
                    sm
                    onPress={async () => {
                      if (!conversationId || loadingEarlier || !oldestTimestampRef.current) return;
                      setLoadingEarlier(true);
                      try {
                        await fetchAndMergeEarlierMessages({
                          conversationId,
                          oldestTimestamp: oldestTimestampRef.current,
                          existingMessages: messages,
                          setMessages,
                          setHasMoreMessages,
                          oldestTimestampRef,
                        });
                      } catch (loadError) {
                        console.error('loadEarlierMessages failed:', loadError);
                      } finally {
                        setLoadingEarlier(false);
                      }
                    }}
                  >
                    Load earlier messages
                  </NbButton>
                )}
              </View>
            ) : null}
            {threadItems.map((item) =>
              item.kind === 'divider' ? (
                <ChatDateDivider key={item.id} label={item.label} colors={colors} />
              ) : (
                <ChatBubble
                  key={item.id}
                  message={item}
                  colors={colors}
                  onLongPress={item.onLongPress}
                  peerFirstName={peerFirstName}
                  onConfirmSession={handleConfirmSession}
                  onChangeSessionTime={handleChangeSessionTime}
                />
              ),
            )}
            {peerBlocked ? (
              <View
                style={{
                  marginTop: 8,
                  marginBottom: 12,
                  borderRadius: borderRadius.nbCard,
                  borderWidth: nb.borderWidth,
                  borderColor: colors.nbBorder,
                  backgroundColor: colors.nbFill,
                  padding: 16,
                  gap: 6,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '900', color: colors.nbOnFill }}>
                  You blocked this person
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.nbOnFill, opacity: 0.85 }}>
                  They cannot message you. Unblock to chat again.
                </Text>
              </View>
            ) : null}
            {uploadingFileName != null && (
              <View style={{ marginBottom: 12, alignItems: 'flex-end' }}>
                <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard}>
                  <View
                    style={[
                      chatStyles.uploadRow,
                      { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface, alignSelf: 'flex-end' },
                    ]}
                  >
                    <ActivityIndicator size="small" color={colors.nbFill} />
                    <Text style={{ color: colors.nbInk, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                      {uploadingFileName}
                    </Text>
                  </View>
                </HardShadow>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {remoteTyping ? (
        <View style={chatStyles.typingStrip}>
          <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetSmall}>
            <View
              style={[
                chatStyles.typingBubble,
                { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
              ]}
            >
              <Text style={[chatStyles.typingText, { color: colors.nbMuted }]} numberOfLines={1}>
                {displayName} is typing
              </Text>
              <Text style={[chatStyles.typingDots, { color: colors.nbMuted }]}> •••</Text>
            </View>
          </HardShadow>
        </View>
      ) : null}

      <Modal visible={!!previewImageUri} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setPreviewImageUri(null)}
        >
          {previewImageUri ? (
            <Image source={{ uri: previewImageUri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          ) : null}
        </TouchableOpacity>
      </Modal>
      {peerBlocked ? (
        <View
          style={[
            chatStyles.inputBarOuter,
            {
              paddingBottom: 16 + embedBottomPad,
              borderTopColor: colors.nbBorder,
              backgroundColor: colors.nbBackground,
            },
          ]}
        >
          <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
            <NbButton variant="fill" onPress={handleUnblockPeer} disabled={unblocking}>
              {unblocking ? 'Unblocking…' : 'Unblock'}
            </NbButton>
          </HardShadow>
        </View>
      ) : (
        <View
          style={[
            chatStyles.inputBarOuter,
            {
              paddingBottom: 16 + embedBottomPad,
              borderTopColor: colors.nbBorder,
              backgroundColor: colors.nbBackground,
            },
          ]}
        >
          <View style={chatStyles.inputBarInner}>
            <ChatIconSquare onPress={showAttachmentOptions} accessibilityLabel="Attach file or photo" colors={colors}>
              {(iconColor) => <Ionicons name="add" size={24} color={iconColor} />}
            </ChatIconSquare>
            <TextInput
              style={[
                chatStyles.input,
                {
                  color: colors.nbInk,
                  borderColor: colors.nbBorder,
                  backgroundColor: colors.nbSurface,
                },
              ]}
              value={messageText}
              onChangeText={(txt) => {
                setMessageText(txt);
                scheduleTypingPulse(txt);
              }}
              onBlur={() => {
                clearTimeout(typingPulseTimerRef.current);
                clearTimeout(typingStopTimerRef.current);
                if (conversationId && (currentUser == null ? undefined : currentUser.uid)) {
                  clearMyConversationTyping(conversationId, currentUser.uid);
                }
              }}
              placeholder={`Message ${displayName.split(' ')[0] || displayName}`}
              placeholderTextColor={colors.nbMuted}
              returnKeyType="send"
              onSubmitEditing={handleSendMessage}
              multiline={false}
            />
            <ChatIconSquare
              onPress={handleSendMessage}
              accessibilityLabel="Send message"
              colors={colors}
              fill
              disabled={!messageText.trim() || sending}
            >
              {(iconColor) => <Ionicons name="arrow-forward" size={22} color={iconColor} />}
            </ChatIconSquare>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );

  const reportSheetEl = (
    <ReportOrBlockSheet
      visible={!!reportSheet}
      onClose={() => !reportBusy && setReportSheet(null)}
      onSubmit={submitReportSheet}
      peerName={displayName}
      busy={reportBusy}
    />
  );

  const attachSheetEl = (
    <NbSheet visible={attachOpen} onClose={() => setAttachOpen(false)} title="Attach">
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={pickPhotoFromSheet}
        style={{
          minHeight: 64,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.nbBorder,
          paddingVertical: 12,
        }}
      >
        <NbIconChip source={HANDOFF_SCHEDULE} index={0} size={44} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 16, fontWeight: '900', color: colors.nbInk }}>Photo / Video</Text>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.nbMuted, marginTop: 2 }}>
            From your library or camera
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.nbInk} />
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={pickFileFromSheet}
        style={{
          minHeight: 64,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
        }}
      >
        <NbIconChip source={HANDOFF_WORKOUT} index={3} size={44} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 16, fontWeight: '900', color: colors.nbInk }}>File</Text>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.nbMuted, marginTop: 2 }}>
            PDF, spreadsheet or document
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.nbInk} />
      </TouchableOpacity>
      <View style={{ marginTop: 16 }}>
        <NbButton variant="ghost" onPress={() => setAttachOpen(false)}>
          Cancel
        </NbButton>
      </View>
    </NbSheet>
  );

  const noticeSheetEl = (
    <NbNoticeSheet
      visible={!!notice}
      onClose={() => {
        const next = (notice == null ? undefined : notice.onOk);
        setNotice(null);
        if (typeof next === 'function') next();
      }}
      title={(notice == null ? undefined : notice.title) || ''}
      message={(notice == null ? undefined : notice.message)}
      confirmLabel={(notice == null ? undefined : notice.confirmLabel) || 'OK'}
      cancelLabel={(notice == null ? undefined : notice.cancelLabel)}
      onConfirm={(notice == null ? undefined : notice.onConfirm)}
      destructive={!!(notice == null ? undefined : notice.destructive)}
    />
  );

  const inner = (
    <View style={{ flex: 1, backgroundColor: colors.nbBackground }}>
      {chatBody}
      {reportSheetEl}
      {attachSheetEl}
      {noticeSheetEl}
    </View>
  );

  if (embedInLayout) {
    return <View style={{ flex: 1 }}>{inner}</View>;
  }
  return (
    <View style={{ flex: 1 }}>
      <TopHeader title="Messages" isDark={isDark} skipTopSafeInset onProfilePress={onProfilePress} onSettingsPress={onSettingsPress} />
      {inner}
    </View>
  );
}
