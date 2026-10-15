// In-app PDF viewer for a generated workout plan.
// Flow: show the PDF in a WebView → Save to Files / Share / Send to Trainer from the bottom bar.
// Used by: the workout-plan flow after a PDF is generated (local uri or remote download url).

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  Share,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { addFile } from '../../for-both/files-and-notes/saveNotesAndFiles';
import { auth } from '../../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

const PDF_MIME_TYPE = 'application/pdf';
const FILE_TYPE_DOC = 'doc';
const ADDED_BY_CLIENT = 'client';
const SHARE_DIALOG_TITLE = 'Save Workout Plan';

const DARK_TEXT = '#fff';
const LIGHT_TEXT = '#1a0a2e';
const DARK_MUTED = 'rgba(255,255,255,0.6)';
const LIGHT_MUTED = 'rgba(26,10,46,0.6)';
const DARK_SCREEN = '#0a0a0a';
const LIGHT_SCREEN = '#f5f5f7';
const LOADER_COLOR = '#64D2FF';
const ACTION_BAR_BORDER_DARK = 'rgba(255,255,255,0.1)';
const ACTION_BAR_BORDER_LIGHT = 'rgba(0,0,0,0.08)';

const WEBVIEW_ORIGINS = ['file://', 'https://', 'http://'];

// ===== HELPER FUNCTIONS =====

function viewerPalette(isDark) {
  return {
    textColor: isDark ? DARK_TEXT : LIGHT_TEXT,
    muted: isDark ? DARK_MUTED : LIGHT_MUTED,
    screenBackground: isDark ? DARK_SCREEN : LIGHT_SCREEN,
    actionBarBorder: isDark ? ACTION_BAR_BORDER_DARK : ACTION_BAR_BORDER_LIGHT,
  };
}

function pdfShareOptions() {
  return { mimeType: PDF_MIME_TYPE, dialogTitle: SHARE_DIALOG_TITLE };
}

async function saveRemotePdfToFiles(pdfDownloadUrl) {
  if (!pdfDownloadUrl) return;
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    Alert.alert('Share', 'Use Share below to save or open the PDF.');
    return;
  }
  try {
    await Sharing.shareAsync(pdfDownloadUrl, pdfShareOptions());
  } catch (_error) {
    Alert.alert('Share', 'Use Share to save or open the PDF.');
  }
}

async function saveLocalPdfToFiles(pdfLocalUri, setSaving) {
  try {
    setSaving(true);
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert('Not available', 'Sharing is not available on this device.');
      return;
    }
    await Sharing.shareAsync(pdfLocalUri, pdfShareOptions());
  } catch (error) {
    Alert.alert('Error', error.message || 'Could not save PDF.');
  } finally {
    setSaving(false);
  }
}

async function shareWorkoutPlan(shareUri, planTitle) {
  if (!shareUri) return;
  try {
    await Share.share({
      url: shareUri,
      title: planTitle,
      message: `Workout plan: ${planTitle}`,
      type: PDF_MIME_TYPE,
    });
  } catch (error) {
    if (error.code !== 'ERR_CANCELED') Alert.alert('Error', error.message || 'Could not share.');
  }
}

function workoutPlanFileName() {
  return `workout-plan-${Date.now()}.pdf`;
}

async function sendPdfToTrainerFiles(fileUri, setSendingToTrainer) {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    Alert.alert('Error', 'You must be logged in to send to trainer.');
    return;
  }
  if (!fileUri) return;
  setSendingToTrainer(true);
  try {
    await addFile(uid, {
      localUri: fileUri,
      filename: workoutPlanFileName(),
      mimeType: PDF_MIME_TYPE,
      type: FILE_TYPE_DOC,
    }, ADDED_BY_CLIENT);
    Alert.alert('Sent', 'PDF has been added to your Notes & Files. Your trainer will see it.');
  } catch (error) {
    Alert.alert('Error', error.message || 'Could not send to trainer.');
  } finally {
    setSendingToTrainer(false);
  }
}

function ActionButton({ onPress, disabled, icon, label, textColor }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={styles.actionBtn}>
      <Ionicons name={icon} size={20} color={textColor} />
      <Text style={[styles.actionLabel, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Modal PDF viewer with Save / Share / Send to Trainer.
 * @param {object} props
 */
export default function PlanPdfViewer({
  visible,
  pdfLocalUri,
  pdfDownloadUrl,
  planTitle = 'Workout Plan',
  clientName,
  isDark = true,
  onClose,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingToTrainer, setSendingToTrainer] = useState(false);

  const uri = pdfDownloadUrl || pdfLocalUri;
  const palette = viewerPalette(isDark);

  const handleSaveToFiles = async () => {
    if (!pdfLocalUri) {
      await saveRemotePdfToFiles(pdfDownloadUrl);
      return;
    }
    await saveLocalPdfToFiles(pdfLocalUri, setSaving);
  };

  const handleShare = async () => {
    await shareWorkoutPlan(pdfLocalUri || pdfDownloadUrl, planTitle);
  };

  const handleSendToTrainer = async () => {
    await sendPdfToTrainerFiles(pdfDownloadUrl || pdfLocalUri, setSendingToTrainer);
  };

  if (!uri) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: palette.screenBackground }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={[styles.closeText, { color: palette.textColor }]}>Close</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: palette.textColor }]} numberOfLines={1}>{planTitle}</Text>
          <View style={{ width: 52 }} />
        </View>

        <View style={styles.webviewWrap}>
          <WebView
            source={{ uri }}
            style={styles.webview}
            onLoadEnd={() => setLoading(false)}
            onError={() => setLoading(false)}
            originWhitelist={WEBVIEW_ORIGINS}
          />
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={LOADER_COLOR} />
              <Text style={[styles.loadingText, { color: palette.muted }]}>Loading PDF…</Text>
            </View>
          )}
        </View>

        <View style={[styles.actionBar, { borderTopColor: palette.actionBarBorder }]}>
          <ActionButton
            onPress={handleSaveToFiles}
            disabled={saving}
            icon="document-outline"
            label={saving ? 'Saving…' : 'Save to Files'}
            textColor={palette.textColor}
          />
          <ActionButton
            onPress={handleShare}
            icon="share-outline"
            label="Share"
            textColor={palette.textColor}
          />
          <ActionButton
            onPress={handleSendToTrainer}
            disabled={sendingToTrainer}
            icon="person-outline"
            label={sendingToTrainer ? 'Sending…' : 'Send to Trainer'}
            textColor={palette.textColor}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeText: { fontSize: 16, fontWeight: '600' },
  title: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700' },
  webviewWrap: { flex: 1 },
  webview: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,10,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: { fontSize: 14 },
  actionBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionLabel: { fontSize: 12, fontWeight: '600' },
});
