/**
 * Trainer Messaging Screen
 *
 * Purpose: UI screen or component: Trainer Messaging Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: ChatWithTraineeScreen
 *
 * @file-header
 */
/**
 * Trainer Messaging (Chat) Screen — new glass UI, existing Firebase and send flow.
 * Real-time via subscribeToMessages; send via trainerMessaging.sendMessage.
 */

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
import { LinearGradient } from 'expo-linear-gradient';
import BlurBackdropPlate from '../shared-ui/BlurBackdropPlate';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useTheme } from '../shared-ui/ThemeContext';
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
} from '../ai-coach/server-logic/trainer-messaging/sendTrainerNotification';
import { auth, db, storage } from '../app-start/config';
import { getTrainerClients, createOrUpdateClient } from '../trainer-app/clients-list/loadMyTraineeRoster';
import { doc, getDoc } from 'firebase/firestore';
import CoachConnectHeader from '../shared/components/shell/CoachConnectHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOTTOM_NAV_BAR_HEIGHT } from '../navigation/bottomNavMetrics';

// ── DESIGN TOKENS ─────────────────────────────────────────────
const DARK = {
  bg: ['#0a0a1a', '#1a0825', '#0d1117'],
  glass: 'rgba(255,255,255,0.05)',
  glassBorder: 'rgba(255,255,255,0.08)',
  glassSubtle: 'rgba(255,255,255,0.03)',
  textPrimary: '#ffffff',
  textMuted: 'rgba(255,255,255,0.5)',
  msgReceivedBg: 'rgba(255,255,255,0.07)',
  msgReceivedBorder: 'rgba(255,255,255,0.1)',
  msgTimestamp: 'rgba(255,255,255,0.35)',
  inputPlaceholder: 'rgba(255,255,255,0.4)',
};
const LIGHT = {
  bg: ['#fdf2f8', '#f5f0ff', '#ecfeff'],
  glass: 'rgba(0,0,0,0.04)',
  glassBorder: 'rgba(0,0,0,0.08)',
  glassSubtle: 'rgba(0,0,0,0.02)',
  textPrimary: '#1e1040',
  textMuted: 'rgba(30,16,64,0.55)',
  msgReceivedBg: 'rgba(0,0,0,0.04)',
  msgReceivedBorder: 'rgba(0,0,0,0.08)',
  msgTimestamp: 'rgba(30,16,64,0.45)',
  inputPlaceholder: 'rgba(0,0,0,0.4)',
};
const GRADIENT = {
  primary: ['#FF6B9D', '#C084FC', '#06B6D4'],
  sentBubble: ['#C084FC', '#FF6B9D', '#F97316'],
  send: ['#FF6B9D', '#C084FC'],
};
/** Thread header accent rim (aligned with session / marketplace heroes). */

function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch (e) {
    return '';
  }
}

/**
 * BlurBackdropPlate applies flex layout on the outer shell; children sit in an inner View that
 * defaults to column. Pass row/padding via `contentWrapperStyle` (see BottomNavBar.js).
 */
const GlassCard = ({ children, style, contentWrapperStyle, isDark }) => {
  const t = isDark ? DARK : LIGHT;
  const cardStyle = {
    backgroundColor: t.glass,
    borderWidth: 1,
    borderColor: t.glassBorder,
    borderRadius: 20,
    ...(Platform.OS === 'ios' && {
      shadowColor: '#FF6B9D',
      shadowRadius: 12,
      shadowOpacity: 0.2,
      shadowOffset: { width: 0, height: 4 },
    }),
  };
  if (Platform.OS === 'ios') {
    return (
      <BlurBackdropPlate
        intensity={20}
        tint={isDark ? 'dark' : 'light'}
        style={[cardStyle, style]}
        contentWrapperStyle={contentWrapperStyle}
      >
        {children}
      </BlurBackdropPlate>
    );
  }
  return <View style={[cardStyle, style, contentWrapperStyle]}>{children}</View>;
};

const PlainAvatar = ({ name, photoURL, size = 44, isDark }) => {
  const initials = (name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const borderColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(10,10,15,0.10)';
  const fallbackBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,15,0.06)';
  const fallbackText = isDark ? '#FFFFFF' : '#1A1040';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor,
        backgroundColor: fallbackBg,
      }}
    >
      {photoURL ? (
        <Image source={{ uri: photoURL }} style={{ width: size, height: size }} />
      ) : (
        <Text style={{ color: fallbackText, fontWeight: '700', fontSize: size * 0.28 }}>{initials}</Text>
      )}
    </View>
  );
};

const bubbleStyles = StyleSheet.create({
  wrapper: { flexDirection: 'row', marginBottom: 12 },
  sent: { borderRadius: 18, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 12 },
  received: { borderWidth: 1, borderRadius: 18, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 12 },
  text: { color: 'white', fontSize: 14, lineHeight: 20 },
  timestamp: { fontSize: 11, marginTop: 4 },
  attachmentImage: { width: 220, height: 160, borderRadius: 12 },
  attachmentFileCard: { padding: 12, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  attachmentFileName: { fontSize: 13, fontWeight: '600', flex: 1 },
  attachmentFileSize: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  attachmentDownload: { fontSize: 12, fontWeight: '600', color: '#C084FC', marginTop: 4 },
});

function formatFileSize(bytes) {
  if (bytes == null || bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ChatBubble({ message, isDark }) {
  const t = isDark ? DARK : LIGHT;
  const isImage = message.type === 'image';
  const isFile = message.type === 'file';
  const isText = !isImage && !isFile;

  const renderContent = () => {
    if (isImage && message.fileUrl) {
      return (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => message.onPreview?.()}
          style={{ borderRadius: 12, overflow: 'hidden' }}
        >
          <Image source={{ uri: message.fileUrl }} style={bubbleStyles.attachmentImage} resizeMode="cover" />
        </TouchableOpacity>
      );
    }
    if (isFile && message.fileUrl) {
      const fileCardBg = message.sent ? 'rgba(0,0,0,0.2)' : t.msgReceivedBg;
      const fileCardBorder = message.sent ? 'rgba(255,255,255,0.2)' : t.msgReceivedBorder;
      const fileTextColor = message.sent ? '#ffffff' : t.textPrimary;
      const fileMutedColor = message.sent ? 'rgba(255,255,255,0.6)' : t.msgTimestamp;
      return (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => message.fileUrl && Linking.openURL(message.fileUrl)}
          style={[bubbleStyles.attachmentFileCard, { backgroundColor: fileCardBg, borderColor: fileCardBorder }]}
        >
          <Ionicons name="document-outline" size={28} color={fileTextColor} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[bubbleStyles.attachmentFileName, { color: fileTextColor }]} numberOfLines={1}>{message.fileName || 'File'}</Text>
            {message.fileSize != null && (
              <Text style={[bubbleStyles.attachmentFileSize, { color: fileMutedColor }]}>{formatFileSize(message.fileSize)}</Text>
            )}
            <Text style={bubbleStyles.attachmentDownload}>Download</Text>
          </View>
        </TouchableOpacity>
      );
    }
    return <Text style={[bubbleStyles.text, !message.sent && { color: t.textPrimary }]}>{message.text || ''}</Text>;
  };

  if (message.sent) {
    return (
      <View style={[bubbleStyles.wrapper, { justifyContent: 'flex-end' }]}>
        <View style={{ maxWidth: '75%' }}>
          <LinearGradient colors={GRADIENT.sentBubble} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[bubbleStyles.sent, (isImage || isFile) ? { padding: 0, overflow: 'hidden' } : null]}>
            {renderContent()}
          </LinearGradient>
          <Text style={[bubbleStyles.timestamp, { color: t.msgTimestamp, textAlign: 'right' }]}>{message.timestamp}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={[bubbleStyles.wrapper, { justifyContent: 'flex-start' }]}>
      <View style={{ maxWidth: '75%' }}>
        <View style={[bubbleStyles.received, { backgroundColor: t.msgReceivedBg, borderColor: t.msgReceivedBorder }, (isImage || isFile) ? { padding: 0, overflow: 'hidden' } : null]}>
          {renderContent()}
        </View>
        <Text style={[bubbleStyles.timestamp, { color: t.msgTimestamp, textAlign: 'left' }]}>{message.timestamp}</Text>
      </View>
    </View>
  );
}

const chatStyles = StyleSheet.create({
  headerName: { fontSize: 18, fontWeight: '800', letterSpacing: -0.35 },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
  onlineLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  headerRingOuter: {
    marginHorizontal: 10,
    marginBottom: 6,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },
  headerInner: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  avatarRing: {
    borderRadius: 28,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 6,
    borderWidth: 1,
  },
  closeBtnOuter: {
    borderRadius: 12,
    borderWidth: 1,
    flexShrink: 0,
    zIndex: 20,
    elevation: 10,
  },
  closeBtnInner: {
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typingStrip: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 6, minHeight: 0 },
  typingBubble: {
    alignSelf: 'flex-start',
    maxWidth: '88%',
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  typingText: { fontSize: 13, fontWeight: '700' },
  typingDots: { fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  inputBarOuter: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8 },
  inputBarInner: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, minWidth: 0 },
  input: { flex: 1, minWidth: 0, minHeight: 40, fontSize: 14, paddingVertical: 8, paddingHorizontal: 4 },
  sendBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 },
  sendText: { color: 'white', fontSize: 14, fontWeight: '700' },
  addClientBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginRight: 8 },
  addClientBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  clientBadgeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
    marginRight: 4,
  },
  clientBadgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
});

export default function ChatWithTraineeScreen({ trainer, conversation, onClose, onProfilePress, onSettingsPress, embedInLayout }) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const embedTopPad = embedInLayout ? Math.max(insets.top, 8) : 0;
  const embedBottomPad = embedInLayout ? Math.max(insets.bottom, 12) + BOTTOM_NAV_BAR_HEIGHT : 0;
  const t = isDark ? DARK : LIGHT;
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
    }, 400);
    return () => {
      unsub();
      clearInterval(tick);
    };
  }, [conversationId, currentUser?.uid]);

  const checkTrainerRole = async () => {
    if (!currentUser || !db) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setIsTrainer(userData.role === 'trainer');
        if (userData.role === 'trainer' && trainer?.id) {
          const clients = await getTrainerClients(currentUser.uid);
          setIsAlreadyClient(clients.some((c) => c.id === trainer.id));
        }
      }
    } catch (error) {
      console.error('Error checking trainer role:', error);
    }
  };

  const loadTrainerData = async () => {
    const otherId = trainer?.id ?? (typeof trainer === 'string' ? trainer : null);
    if (!otherId) return;
    const data = await getUserData(otherId);
    setTrainerData(data);
  };

  const initializeConversation = async () => {
    try {
      setLoading(true);
      const otherId = trainer?.id ?? (typeof trainer === 'string' ? trainer : null);
      if (!otherId) throw new Error('Other participant information missing');

      let clientId, trainerId;
      if (conversation?.clientId != null && conversation?.trainerId != null) {
        clientId = conversation.clientId;
        trainerId = conversation.trainerId;
      } else {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const isUserTrainer = userDoc.exists() && userDoc.data().role === 'trainer';
        if (isUserTrainer) {
          clientId = otherId;
          trainerId = currentUser.uid;
        } else {
          clientId = currentUser.uid;
          trainerId = otherId;
        }
      }

      const convId = conversation?.id || await getOrCreateConversation(clientId, trainerId);
      if (!convId) throw new Error('Failed to create conversation');
      setConversationId(convId);

      const unsubscribe = subscribeToMessages(convId, (newMessages, meta) => {
        setMessages(newMessages);
        setHasMoreMessages(Boolean(meta?.hasMore));
        oldestTimestampRef.current =
          meta?.oldestTimestamp ?? (newMessages.length ? newMessages[0].timestamp : null);
        markMessagesAsRead(convId, currentUser.uid);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
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
    }, 450);
    typingStopTimerRef.current = setTimeout(() => {
      clearMyConversationTyping(conversationId, currentUser.uid);
    }, 2800);
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
  const messagesForBubbles = messages.map((m) => ({
    id: m.id,
    text: m.text || '',
    type: m.type,
    fileUrl: m.fileUrl,
    fileName: m.fileName,
    fileSize: m.fileSize,
    sent: m.senderId === currentUser?.uid,
    timestamp: formatTimestamp(m.timestamp),
    onPreview: m.type === 'image' && m.fileUrl ? () => setPreviewImageUri(m.fileUrl) : undefined,
  }));

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <LinearGradient colors={t.bg} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color="#C084FC" />
      </View>
    );
  }

  const headerInnerBg = isDark ? 'rgba(12,12,18,0.96)' : 'rgba(255,255,255,0.98)';
  const hairline = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(10,10,15,0.10)';
  const statusOnline = !!trainerData?.isOnline;
  const statusDot = statusOnline ? '#22C55E' : '#94A3B8';
  const statusBorder = hairline;
  const statusBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(10,10,15,0.04)';

  const identityBlock = (
    <>
      <View style={chatStyles.avatarRing}>
        <PlainAvatar name={displayName} photoURL={trainerData?.photoURL} size={48} isDark={isDark} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }} pointerEvents="box-none">
        <Text style={[chatStyles.headerName, { color: t.textPrimary }]} numberOfLines={1}>
          {displayName}
        </Text>
        <View
          style={[
            chatStyles.statusPill,
            { backgroundColor: statusBg, borderColor: statusBorder },
          ]}
        >
          <View style={[chatStyles.onlineDot, { backgroundColor: statusDot }]} />
          <Text style={[chatStyles.onlineLabel, { color: t.textMuted }]}>{statusOnline ? 'Online now' : 'Offline'}</Text>
        </View>
      </View>
    </>
  );

  const headerBar = (
    <View
      style={[
        chatStyles.headerRingOuter,
        { borderColor: hairline, ...(embedTopPad ? { marginTop: embedTopPad } : null) },
      ]}
    >
      <View style={[chatStyles.headerInner, { backgroundColor: headerInnerBg }]}>
        <View style={chatStyles.headerRow}>
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
          {isTrainer && !isAlreadyClient && (
            <TouchableOpacity
              onPress={handleAddAsClient}
              disabled={addingClient}
              style={[chatStyles.addClientBtn, { backgroundColor: '#C084FC', flexShrink: 0 }]}
            >
              {addingClient ? <ActivityIndicator size="small" color="#fff" /> : <Text style={chatStyles.addClientBtnText}>+ Add Client</Text>}
            </TouchableOpacity>
          )}
          {isTrainer && isAlreadyClient && (
            <View
              style={[
                chatStyles.clientBadgeInner,
                {
                  backgroundColor: headerInnerBg,
                  borderColor: hairline,
                },
              ]}
            >
              <Ionicons name="checkmark-circle" size={15} color={isDark ? 'rgba(255,255,255,0.55)' : 'rgba(10,10,15,0.45)'} />
              <Text style={[chatStyles.clientBadgeText, { color: t.textMuted }]}>Client</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.82}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Close messages"
            style={[
              chatStyles.closeBtnOuter,
              { borderColor: hairline, backgroundColor: headerInnerBg },
            ]}
          >
            <View style={chatStyles.closeBtnInner}>
              <Text style={{ color: t.textPrimary, fontSize: 13, fontWeight: '800' }}>Close</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const chatBody = (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      {headerBar}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 + embedBottomPad }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        scrollEventThrottle={16}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {messagesForBubbles.length === 0 ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>💬</Text>
            <Text style={{ color: t.textMuted, fontSize: 16, textAlign: 'center' }}>Start a conversation with {displayName}</Text>
          </View>
        ) : (
          <>
            {hasMoreMessages ? (
              <TouchableOpacity
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
                disabled={loadingEarlier}
                style={{ alignSelf: 'center', marginBottom: 12, paddingVertical: 8, paddingHorizontal: 14 }}
                accessibilityRole="button"
                accessibilityLabel="Load earlier messages"
              >
                {loadingEarlier ? (
                  <ActivityIndicator size="small" color="#C084FC" />
                ) : (
                  <Text style={{ color: t.textMuted, fontSize: 13, fontWeight: '700' }}>Load earlier messages</Text>
                )}
              </TouchableOpacity>
            ) : null}
            {messagesForBubbles.map((msg) => <ChatBubble key={msg.id} message={msg} isDark={isDark} />)}
            {uploadingFileName != null && (
              <View style={{ marginBottom: 12, alignItems: 'flex-end' }}>
                <GlassCard
                  isDark={isDark}
                  style={{ alignSelf: 'flex-end' }}
                  contentWrapperStyle={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }}
                >
                  <ActivityIndicator size="small" color="#C084FC" />
                  <Text style={{ color: t.textPrimary, fontSize: 13 }} numberOfLines={1}>{uploadingFileName}</Text>
                </GlassCard>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {remoteTyping ? (
        <View style={chatStyles.typingStrip}>
          <View style={[chatStyles.typingBubble, { backgroundColor: t.msgReceivedBg, borderColor: t.msgReceivedBorder }]}>
            <Text style={[chatStyles.typingText, { color: t.textMuted }]} numberOfLines={1}>
              {displayName} is typing
            </Text>
            <Text style={[chatStyles.typingDots, { color: t.textMuted }]}> •••</Text>
          </View>
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
      <View style={[chatStyles.inputBarOuter, { paddingBottom: 16 + embedBottomPad }]}>
        <GlassCard isDark={isDark} contentWrapperStyle={chatStyles.inputBarInner}>
          <TouchableOpacity onPress={showAttachmentOptions} style={{ padding: 4 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="attach-outline" size={22} color={t.inputPlaceholder} />
          </TouchableOpacity>
          <TextInput
            style={[chatStyles.input, { color: t.textPrimary }]}
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
            placeholder="Type a message..."
            placeholderTextColor={t.inputPlaceholder}
            returnKeyType="send"
            onSubmitEditing={handleSendMessage}
            multiline={false}
          />
          <TouchableOpacity onPress={handleSendMessage} activeOpacity={0.85} disabled={!messageText.trim() || sending}>
            <LinearGradient colors={GRADIENT.send} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={chatStyles.sendBtn}>
              <Ionicons name="send" size={15} color="white" style={{ marginRight: 5 }} />
              <Text style={chatStyles.sendText}>Send</Text>
            </LinearGradient>
          </TouchableOpacity>
        </GlassCard>
      </View>
    </KeyboardAvoidingView>
  );

  const inner = (
    <LinearGradient colors={t.bg} style={{ flex: 1 }}>
      {chatBody}
    </LinearGradient>
  );

  if (embedInLayout) {
    return <View style={{ flex: 1 }}>{inner}</View>;
  }
  return (
    <View style={{ flex: 1 }}>
      <CoachConnectHeader title="Messages" isDark={isDark} skipTopSafeInset onProfilePress={onProfilePress} onSettingsPress={onSettingsPress} />
      {inner}
    </View>
  );
}
