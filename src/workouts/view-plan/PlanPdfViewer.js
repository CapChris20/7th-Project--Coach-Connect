// In-app PDF viewer for a generated workout plan.
// Flow: WebView preview → bottom bar Save / Share / Send to Trainer (Notes & Files).
// Used by: workout-plan flow when a local file uri or remote download url exists.
// Read order: constants → layout (no hooks) → main component → PLUMBING.

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Share,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { addFile } from '../../for-both/files-and-notes/saveNotesAndFiles';
import { auth } from '../../app-start/cloudConnection';
import NbNoticeSheet from '../../look-and-feel/NbNoticeSheet';
import { useTheme } from '../../look-and-feel/lightDarkMode';

// ===== NAMED CONSTANTS =====

const PDF_MIME_TYPE = 'application/pdf';
const FILE_TYPE_DOC = 'doc';
const ADDED_BY_CLIENT = 'client';
const SHARE_DIALOG_TITLE = 'Save Workout Plan';
// Manipulate here: header spacer mirrors Close width so the title stays centered.
const HEADER_CLOSE_SPACER_WIDTH = 52;
const ACTION_ICON_SIZE = 20;
// vocab: originWhitelist = which URL schemes the WebView may load
const WEBVIEW_ORIGINS = ['file://', 'https://', 'http://'];

// ===== HELPER FUNCTIONS =====

/**
 * One bottom-bar action: icon + label.
 */
function PdfActionButton({ onPress, disabled, iconName, label, inkColor }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={styles.actionBtn}>
      <Ionicons name={iconName} size={ACTION_ICON_SIZE} color={inkColor} />
      <Text style={[styles.actionLabel, { color: inkColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function saveButtonLabel(isSaving) {
  if (isSaving) return 'Saving…';
  return 'Save to Files';
}

function sendToTrainerLabel(isSending) {
  if (isSending) return 'Sending…';
  return 'Send to Trainer';
}

function overlayBackgroundColor(colors) {
  if (colors.nbOverlay) {
    return colors.nbOverlay;
  }
  return 'rgba(10,10,10,0.9)';
}

/**
 * Pure layout — no hooks. Parent owns loading / notice / share handlers.
 */
function PlanPdfViewerLayout({
  modalVisible,
  planTitle,
  pdfUri,
  colors,
  isWebViewLoading,
  isSavingToFiles,
  isSendingToTrainer,
  notice,
  onClose,
  onDismissNotice,
  onSaveToFiles,
  onSharePlan,
  onSendToTrainer,
  onWebViewLoadEnd,
  onWebViewError,
}) {
  const loadingOverlayColor = overlayBackgroundColor(colors);
  const noticeTitle = notice?.title || '';
  const noticeConfirmLabel = notice?.confirmLabel || 'OK';

  return (
    <Modal visible={modalVisible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.nbBackground }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={[styles.closeText, { color: colors.nbInk }]}>Close</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.nbInk }]} numberOfLines={1}>
            {planTitle}
          </Text>
          <View style={{ width: HEADER_CLOSE_SPACER_WIDTH }} />
        </View>

        <View style={styles.webviewWrap}>
          <WebView
            source={{ uri: pdfUri }}
            style={styles.webview}
            onLoadEnd={onWebViewLoadEnd}
            onError={onWebViewError}
            originWhitelist={WEBVIEW_ORIGINS}
          />
          {isWebViewLoading ? (
            <View style={[styles.loadingOverlay, { backgroundColor: loadingOverlayColor }]}>
              <ActivityIndicator size="large" color={colors.nbFill} />
              <Text style={[styles.loadingText, { color: colors.nbMuted }]}>Loading PDF…</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.actionBar, { borderTopColor: colors.nbBorder }]}>
          <PdfActionButton
            onPress={onSaveToFiles}
            disabled={isSavingToFiles}
            iconName="document-outline"
            label={saveButtonLabel(isSavingToFiles)}
            inkColor={colors.nbInk}
          />
          <PdfActionButton
            onPress={onSharePlan}
            iconName="share-outline"
            label="Share"
            inkColor={colors.nbInk}
          />
          <PdfActionButton
            onPress={onSendToTrainer}
            disabled={isSendingToTrainer}
            iconName="person-outline"
            label={sendToTrainerLabel(isSendingToTrainer)}
            inkColor={colors.nbInk}
          />
        </View>

        <NbNoticeSheet
          visible={!!notice}
          onClose={onDismissNotice}
          title={noticeTitle}
          message={notice?.message}
          confirmLabel={noticeConfirmLabel}
          cancelLabel={notice?.cancelLabel}
          onConfirm={notice?.onConfirm}
        />
      </SafeAreaView>
    </Modal>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Modal PDF viewer.
 * Props: visible, pdfLocalUri, pdfDownloadUrl, planTitle, clientName, isDark (legacy), onClose.
 * Hook order: useTheme → four useState flags. Do not reorder.
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
  const theme = useTheme();
  const colors = theme.colors;

  const [webViewLoading, setWebViewLoading] = useState(true);
  const [savingToFiles, setSavingToFiles] = useState(false);
  const [sendingToTrainer, setSendingToTrainer] = useState(false);
  const [notice, setNotice] = useState(null);

  const showNotice = (title, message, extras = {}) => {
    setNotice({ title, message, ...extras });
  };

  // Prefer remote download url; fall back to a local file uri.
  const pdfUri = pdfDownloadUrl || pdfLocalUri;
  if (!pdfUri) return null;

  // 1. Save — local file uses share sheet; remote url shares the download link.
  const handleSaveToFiles = async () => {
    if (!pdfLocalUri) {
      await shareRemotePdfDownloadLink(pdfDownloadUrl, showNotice);
      return;
    }
    await shareLocalPdfFile(pdfLocalUri, setSavingToFiles, showNotice);
  };

  // 2. OS share sheet with the plan title.
  const handleSharePlan = async () => {
    const shareUri = pdfLocalUri || pdfDownloadUrl;
    await sharePdfWithSystemSheet(shareUri, planTitle, showNotice);
  };

  // 3. Upload a copy into the user's Notes & Files for the trainer.
  const handleSendToTrainer = async () => {
    const fileUri = pdfDownloadUrl || pdfLocalUri;
    await uploadPdfToTrainerFiles(fileUri, setSendingToTrainer, showNotice);
  };

  const dismissNotice = () => setNotice(null);
  const markWebViewReady = () => setWebViewLoading(false);

  return (
    <PlanPdfViewerLayout
      modalVisible={visible}
      planTitle={planTitle}
      pdfUri={pdfUri}
      colors={colors}
      isWebViewLoading={webViewLoading}
      isSavingToFiles={savingToFiles}
      isSendingToTrainer={sendingToTrainer}
      notice={notice}
      onClose={onClose}
      onDismissNotice={dismissNotice}
      onSaveToFiles={handleSaveToFiles}
      onSharePlan={handleSharePlan}
      onSendToTrainer={handleSendToTrainer}
      onWebViewLoadEnd={markWebViewReady}
      onWebViewError={markWebViewReady}
    />
  );
}

// ===== PLUMBING — skip unless debugging share / Notes & Files upload =====

function pdfShareSheetOptions() {
  return { mimeType: PDF_MIME_TYPE, dialogTitle: SHARE_DIALOG_TITLE };
}

async function shareRemotePdfDownloadLink(pdfDownloadUrl, showNotice) {
  if (!pdfDownloadUrl) return;

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    showNotice('Share', 'Use Share below to save or open the PDF.');
    return;
  }

  try {
    await Sharing.shareAsync(pdfDownloadUrl, pdfShareSheetOptions());
  } catch (_error) {
    showNotice('Share', 'Use Share to save or open the PDF.');
  }
}

async function shareLocalPdfFile(pdfLocalUri, setSaving, showNotice) {
  try {
    setSaving(true);
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      showNotice('Not available', 'Sharing is not available on this device.');
      return;
    }
    await Sharing.shareAsync(pdfLocalUri, pdfShareSheetOptions());
  } catch (error) {
    showNotice('Error', error.message || 'Could not save PDF.');
  } finally {
    setSaving(false);
  }
}

async function sharePdfWithSystemSheet(shareUri, planTitle, showNotice) {
  if (!shareUri) return;

  try {
    await Share.share({
      url: shareUri,
      title: planTitle,
      message: `Workout plan: ${planTitle}`,
      type: PDF_MIME_TYPE,
    });
  } catch (error) {
    if (error.code !== 'ERR_CANCELED') {
      showNotice('Error', error.message || 'Could not share.');
    }
  }
}

function generatedWorkoutPlanFileName() {
  return `workout-plan-${Date.now()}.pdf`;
}

async function uploadPdfToTrainerFiles(fileUri, setSendingToTrainer, showNotice) {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    showNotice('Error', 'You must be logged in to send to trainer.');
    return;
  }
  if (!fileUri) return;

  setSendingToTrainer(true);
  try {
    await addFile(
      uid,
      {
        localUri: fileUri,
        filename: generatedWorkoutPlanFileName(),
        mimeType: PDF_MIME_TYPE,
        type: FILE_TYPE_DOC,
      },
      ADDED_BY_CLIENT,
    );
    showNotice('Sent', 'PDF has been added to your Notes & Files. Your trainer will see it.');
  } catch (error) {
    showNotice('Error', error.message || 'Could not send to trainer.');
  } finally {
    setSendingToTrainer(false);
  }
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
