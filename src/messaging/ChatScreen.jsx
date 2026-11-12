// Design Law 1:1 chat thread (inbox-and-money PNG 09/10).
// Flow: open thread → load/create conversation → live messages → send text/photos/files.
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
  ActionSheetIOS,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useTheme } from '../look-and-feel/lightDarkMode';
import {
  getOrCreateConversation,
  sendMessage,
  sendAttachmentMessage,
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
  submitContentReport,
  showSafetyPeerMenu,
  showReportReasonPicker,
  confirmBlockUser,
  REPORT_TYPES,
} from '../block-and-report';
import NbAvatar from '../look-and-feel/NbAvatar';
import NbButton from '../look-and-feel/NbButton';
import HardShadow from '../look-and-feel/HardShadow';
import { borderRadius, nb } from '../look-and-feel/colorPalette';

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
  if (trainerProp?.id) return trainerProp.id;
  if (typeof trainerProp === 'string') return trainerProp;
  return null;
}

/**
 * Decide who is client vs trainer for getOrCreateConversation.
 * Prefer ids already on the conversation row; otherwise use the signed-in user's role.
 */
async function resolveClientAndTrainerIds({ conversation, currentUserUid, otherParticipantId }) {
  if (conversation?.clientId != null && conversation?.trainerId != null) {
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

/**
 * Turn a Firestore timestamp into a short "Just now" / "5m ago" label.
 * @param {object|number|Date|null} timestamp
 * @returns {string}
 */
/** Firestore / Date → JS Date, or null when missing. */
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

/** Insert day dividers without changing message order (oldest → newest). */
function buildThreadRenderList(messages, currentUserUid, extras = {}) {
  const { onPreview, onReportPeer } = extras;
  const items = [];
  let lastDayKey = null;
  for (const m of messages) {
    const date = messageDateFromTimestamp(m.timestamp);
    if (date) {
      const dayKey = startOfCalendarDay(date).getTime();
      if (dayKey !== lastDayKey) {
        items.push({ kind: 'divider', id: `divider-${dayKey}`, label: dateDividerLabel(date) });
        lastDayKey = dayKey;
      }
    }
    items.push({
      kind: 'message',
      id: m.id,
      text: m.text || '',
      type: m.type,
      fileUrl: m.fileUrl,
      fileName: m.fileName,
      fileSize: m.fileSize,
      sent: m.senderId === currentUserUid,
      senderId: m.senderId,
      rawTimestamp: m.timestamp,
      clockLabel: formatBubbleClock(m.timestamp),
      onPreview: m.type === 'image' && m.fileUrl ? onPreview?.(m.fileUrl) : undefined,
      onLongPress:
        m.senderId !== currentUserUid
          ? () =>
              onReportPeer?.({
                messageId: m.id,
                targetUid: m.senderId,
              })
          : undefined,
    });
  }
  return items;
}

/** 44×44 HardShadow icon chip (back, menu, attach, send). */
function ChatIconSquare({ onPress, accessibilityLabel, children, fill = false, colors, disabled }) {
  const bg = fill ? colors.nbFill : colors.nbSurface;
  const iconColor = fill ? colors.nbOnFill : colors.nbInk;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{ opacity: disabled ? 0.45 : 1 }}
    >
      <HardShadow radius={borderRadius.nbChip} offset={nb.shadowOffsetSmall}>
        <View
          style={{
            width: nb.minTouchTarget,
            height: nb.minTouchTarget,
            borderRadius: borderRadius.nbChip,
            borderWidth: nb.borderWidth,
            borderColor: colors.nbBorder,
            backgroundColor: bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {typeof children === 'function' ? children(iconColor) : children}
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
  attachmentImage: { width: 232, height: 168 },
  fileCard: { width: 248, padding: 12, gap: 10 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  attachmentFileName: { fontSize: 14, fontWeight: '800', flex: 1 },
  attachmentFileSize: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  fileDownloadWrap: { marginTop: 6 },
});

/**
 * Human-readable file size for attachment bubbles.
 * @param {number|null|undefined} bytes
 * @returns {string}
 */
function formatFileSize(bytes) {
  if (bytes == null || bytes === 0) return '';
  if (bytes < BYTES_PER_KB) return `${bytes} B`;
  if (bytes < BYTES_PER_KB * BYTES_PER_KB) {
    return `${(bytes / BYTES_PER_KB).toFixed(1)} KB`;
  }
  return `${(bytes / (BYTES_PER_KB * BYTES_PER_KB)).toFixed(1)} MB`;
}

function ChatBubble({ message, colors, onLongPress }) {
  const isImage = message.type === 'image';
  const isFile = message.type === 'file';
  const sent = message.sent;
  const bubbleBg = sent ? colors.nbFill : colors.nbSurface;
  const bubbleText = sent ? colors.nbOnFill : colors.nbInk;
  const padless = isImage || isFile;

  const openFile = () => {
    if (message.fileUrl) Linking.openURL(message.fileUrl);
  };

  const renderBubbleBody = () => {
    if (isImage && message.fileUrl) {
      return (
        <TouchableOpacity activeOpacity={0.9} onPress={() => message.onPreview?.()} onLongPress={onLongPress}>
          <Image source={{ uri: message.fileUrl }} style={bubbleStyles.attachmentImage} resizeMode="cover" />
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

  const bubbleChrome = (
    <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard}>
      <View
        style={[
          bubbleStyles.bubbleInner,
          {
            borderWidth: nb.borderWidth,
            borderColor: colors.nbBorder,
            backgroundColor: isFile ? colors.nbSurface : bubbleBg,
            paddingHorizontal: padless ? 0 : 14,
            paddingVertical: padless ? 0 : 12,
            overflow: 'hidden',
          },
        ]}
      >
        {renderBubbleBody()}
      </View>
    </HardShadow>
  );

  return (
    <View style={[bubbleStyles.wrapper, { justifyContent: sent ? 'flex-end' : 'flex-start' }]}>
      {sent ? (
        <View style={{ maxWidth: '82%' }}>
          {bubbleChrome}
          <Text style={[bubbleStyles.timestamp, { color: colors.nbMuted, textAlign: 'right' }]}>{message.clockLabel}</Text>
        </View>
      ) : (
        <TouchableOpacity
          activeOpacity={0.92}
          onLongPress={onLongPress}
          delayLongPress={350}
          style={{ maxWidth: '82%' }}
          accessibilityHint="Long press to report this message"
        >
          {bubbleChrome}
          <Text style={[bubbleStyles.timestamp, { color: colors.nbMuted, textAlign: 'left' }]}>{message.clockLabel}</Text>
        </TouchableOpacity>
      )}
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

/**
 * Live chat thread UI for one trainer↔client conversation.
 * @param {object} props
 */
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
  const scrollRef = useRef(null);
  const oldestTimestampRef = useRef(null);
  const currentUser = auth.currentUser;
  const unsubscribeRef = useRef(null);
  const cancelledRef = useRef(false);
  const remoteTypingPulseMsRef = useRef(0);
  const typingPulseTimerRef = useRef(null);
  const typingStopTimerRef = useRef(null);

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

  useEffect(() => {
    if (!conversationId || !currentUser?.uid) {
      remoteTypingPulseMsRef.current = 0;
      setRemoteTyping(false);
      return undefined;
    }
    const unsub = subscribeConversationTyping(conversationId, (meta) => {
      const tid = meta?.typingUserId;
      const ta = meta?.typingAt;
      if (!tid || tid === currentUser.uid) {
        remoteTypingPulseMsRef.current = 0;
        setRemoteTyping(false);
        return;
      }
      if (ta) {
        // Use local receipt time so typing UI does not get stuck if device clock ≠ server.
        remoteTypingPulseMsRef.current = Date.now();
        setRemoteTyping(true);
      }
    });
    const tick = setInterval(() => {
      const ms = remoteTypingPulseMsRef.current;
      if (ms && Date.now() - ms > TYPING_UI_STALE_MS) {
        remoteTypingPulseMsRef.current = 0;
        setRemoteTyping(false);
      }
    }, TYPING_STALE_TICK_MS);
    return () => {
      unsub();
      clearInterval(tick);
    };
  }, [conversationId, currentUser?.uid]);

  // 1. Are we the trainer, and is this peer already on our client list?
  const checkTrainerRole = async () => {
    if (!currentUser || !db) return;
    try {
      const flags = await loadTrainerRoleAndClientFlag(currentUser.uid, trainer?.id);
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

  // 2. Create or reuse the conversation, then subscribe to live messages.
  const initializeConversation = async () => {
    try {
      setLoading(true);
      const otherId = otherParticipantIdFromProp(trainer);
      if (!otherId) throw new Error('Other participant information missing');

      const { clientId, trainerId } = await resolveClientAndTrainerIds({
        conversation,
        currentUserUid: currentUser.uid,
        otherParticipantId: otherId,
      });

      const convId = conversation?.id || await getOrCreateConversation(clientId, trainerId);
      if (!convId) throw new Error('Failed to create conversation');
      setConversationId(convId);

      const unsubscribe = subscribeToMessages(convId, (newMessages, meta) => {
        setMessages(newMessages);
        setHasMoreMessages(Boolean(meta?.hasMore));
        oldestTimestampRef.current =
          meta?.oldestTimestamp ?? (newMessages.length ? newMessages[0].timestamp : null);
        markMessagesAsRead(convId, currentUser.uid);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), SCROLL_AFTER_MESSAGE_MS);
      });
      return () => unsubscribe();
    } catch (error) {
      console.error('Error initializing conversation:', error);
      Alert.alert('Error', error.message || 'Failed to load conversation.');
    } finally {
      setLoading(false);
    }
  };

  const scheduleTypingPulse = (text) => {
    if (!conversationId || !currentUser?.uid) return;
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
      scrollRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      console.error('Error sending message:', error);
      setMessageText(text);
      Alert.alert('Error', error.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleAddAsClient = async () => {
    if (!currentUser || !isTrainer || !trainer?.id || !trainerData) return;
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
      Alert.alert('Success', 'Client added successfully!');
    } catch (error) {
      console.error('Error adding client:', error);
      Alert.alert('Error', 'Failed to add client.');
    } finally {
      setAddingClient(false);
    }
  };

  const showAttachmentOptions = () => {
    if (Platform.OS === 'ios' && ActionSheetIOS) {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Photo / Video', 'File'], cancelButtonIndex: 0 },
        (buttonIndex) => {
          if (buttonIndex === 1) handlePickPhoto();
          if (buttonIndex === 2) handlePickFile();
        }
      );
    } else {
      Alert.alert('Attach', 'Choose an option', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Photo / Video', onPress: handlePickPhoto },
        { text: 'File', onPress: handlePickFile },
      ]);
    }
  };

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
      if (err?.code === 'storage/unknown') {
        console.warn('Storage upload SDK unknown error (serverResponse):', err?.serverResponse);
      }
      throw err;
    }
  };

  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photo library to send photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: false,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const { uri } = result.assets[0];
      const filename = uri.split('/').pop() || `photo_${Date.now()}.jpg`;
      setUploadingFileName(filename);
      const downloadUrl = await uploadToStorage(uri, filename, 'image/jpeg');
      await sendAttachmentMessage(conversationId, currentUser.uid, { type: 'image', fileUrl: downloadUrl, fileName: filename });
      scrollRef.current?.scrollToEnd({ animated: true });
    } catch (err) {
      console.error('Photo send error:', err?.code, err?.message, err?.serverResponse);
      Alert.alert('Upload failed', err?.message || 'Failed to send photo.');
    } finally {
      setUploadingFileName(null);
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
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
      scrollRef.current?.scrollToEnd({ animated: true });
    } catch (err) {
      console.error('File send error:', err?.code, err?.message, err?.serverResponse);
      Alert.alert('Upload failed', err?.message || 'Failed to send file.');
    } finally {
      setUploadingFileName(null);
    }
  };

  const displayName = trainerData?.name || trainer?.name || 'User';
  const peerUid = otherParticipantIdFromProp(trainer);

  const runReport = (type, extra = {}) => {
    if (!currentUser?.uid || !peerUid) return;
    showReportReasonPicker({
      onPick: async (reasonId) => {
        try {
          await submitContentReport({
            reporterId: currentUser.uid,
            type,
            targetUid: extra.targetUid || peerUid,
            reason: reasonId,
            conversationId,
            messageId: extra.messageId || null,
            targetDisplayName: displayName,
          });
          Alert.alert('Report sent', 'Thanks — we’ll review this as soon as we can.');
        } catch (e) {
          Alert.alert('Report failed', e?.message || 'Try again.');
        }
      },
    });
  };

  const runBlockPeer = () => {
    if (!currentUser?.uid || !peerUid) return;
    confirmBlockUser({
      peerName: displayName,
      onConfirm: async () => {
        try {
          await blockUser(currentUser.uid, peerUid, { displayName });
          Alert.alert('Blocked', `${displayName} is blocked. You can unblock in Settings → Blocked users.`, [
            { text: 'OK', onPress: () => onClose?.() },
          ]);
        } catch (e) {
          Alert.alert('Block failed', e?.message || 'Try again.');
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

  const threadItems = buildThreadRenderList(messages, currentUser?.uid, {
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

  const hasPresence = typeof trainerData?.isOnline === 'boolean';
  const isPeerOnline = hasPresence && trainerData.isOnline;
  const headerSubtitle = hasPresence
    ? isPeerOnline
      ? 'Online now'
      : 'Offline'
    : trainerData?.role === 'trainer'
      ? 'Your coach'
      : trainerData?.role === 'client'
        ? 'Client'
        : 'Direct message';

  const identityBlock = (
    <>
      <View style={chatStyles.avatarWrap}>
        <NbAvatar
          source={trainerData?.photoURL || trainer?.photoURL}
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
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        scrollEventThrottle={16}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {threadItems.length === 0 ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>💬</Text>
            <Text style={{ color: colors.nbMuted, fontSize: 16, textAlign: 'center', fontWeight: '600' }}>
              Start a conversation with {displayName}
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
                        const { messages: older, hasMore } = await loadEarlierMessages(
                          conversationId,
                          oldestTimestampRef.current,
                        );
                        const seen = new Set(messages.map((m) => m.id));
                        const uniqueOlder = older.filter((m) => !seen.has(m.id));
                        if (uniqueOlder.length) {
                          oldestTimestampRef.current = uniqueOlder[0].timestamp ?? oldestTimestampRef.current;
                          setMessages((prev) => [...uniqueOlder, ...prev]);
                        }
                        setHasMoreMessages(hasMore);
                      } catch (e) {
                        console.error('loadEarlierMessages failed:', e);
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
                />
              ),
            )}
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
      <View
        style={[
          chatStyles.inputBarOuter,
          { paddingBottom: 16 + embedBottomPad, borderTopColor: colors.nbBorder, backgroundColor: colors.nbBackground },
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
              if (conversationId && currentUser?.uid) {
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
    </KeyboardAvoidingView>
  );

  const inner = <View style={{ flex: 1, backgroundColor: colors.nbBackground }}>{chatBody}</View>;

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
