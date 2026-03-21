/**
 * In-app PDF viewer for generated workout plan.
 * Shows PDF (from local uri or remote url), bottom bar: Save to Files, Share, Send to Trainer.
 */

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
import { addFile } from '../../shared/services/notesAndFilesService';
import { auth } from '../../app/config';

export default function WorkoutPlanPdfViewerModal({
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
  const textColor = isDark ? '#fff' : '#1a0a2e';
  const muted = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(26,10,46,0.6)';

  const handleSaveToFiles = async () => {
    if (!pdfLocalUri) {
      if (pdfDownloadUrl) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          try {
            await Sharing.shareAsync(pdfDownloadUrl, {
              mimeType: 'application/pdf',
              dialogTitle: 'Save Workout Plan',
            });
          } catch (e) {
            Alert.alert('Share', 'Use Share to save or open the PDF.');
          }
        } else {
          Alert.alert('Share', 'Use Share below to save or open the PDF.');
        }
      }
      return;
    }
    try {
      setSaving(true);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(pdfLocalUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save Workout Plan',
        });
      } else {
        Alert.alert('Not available', 'Sharing is not available on this device.');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not save PDF.');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    const shareUri = pdfLocalUri || pdfDownloadUrl;
    if (!shareUri) return;
    try {
      await Share.share({
        url: shareUri,
        title: planTitle,
        message: `Workout plan: ${planTitle}`,
        type: 'application/pdf',
      });
    } catch (e) {
      if (e.code !== 'ERR_CANCELED') Alert.alert('Error', e.message || 'Could not share.');
    }
  };

  const handleSendToTrainer = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      Alert.alert('Error', 'You must be logged in to send to trainer.');
      return;
    }
    const fileUri = pdfDownloadUrl || pdfLocalUri;
    if (!fileUri) return;
    setSendingToTrainer(true);
    try {
      await addFile(uid, {
        localUri: fileUri,
        filename: `workout-plan-${Date.now()}.pdf`,
        mimeType: 'application/pdf',
        type: 'doc',
      }, 'client');
      Alert.alert('Sent', 'PDF has been added to your Notes & Files. Your trainer will see it.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not send to trainer.');
    } finally {
      setSendingToTrainer(false);
    }
  };

  if (!uri) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f5f5f7' }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={[styles.closeText, { color: textColor }]}>Close</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>{planTitle}</Text>
          <View style={{ width: 52 }} />
        </View>

        <View style={styles.webviewWrap}>
          <WebView
            source={{ uri }}
            style={styles.webview}
            onLoadEnd={() => setLoading(false)}
            onError={() => setLoading(false)}
            originWhitelist={['file://', 'https://', 'http://']}
          />
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#64D2FF" />
              <Text style={[styles.loadingText, { color: muted }]}>Loading PDF…</Text>
            </View>
          )}
        </View>

        <View style={[styles.actionBar, { borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
          <TouchableOpacity onPress={handleSaveToFiles} disabled={saving} style={styles.actionBtn}>
            <Ionicons name="document-outline" size={20} color={textColor} />
            <Text style={[styles.actionLabel, { color: textColor }]}>{saving ? 'Saving…' : 'Save to Files'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} style={styles.actionBtn}>
            <Ionicons name="share-outline" size={20} color={textColor} />
            <Text style={[styles.actionLabel, { color: textColor }]}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSendToTrainer} disabled={sendingToTrainer} style={styles.actionBtn}>
            <Ionicons name="person-outline" size={20} color={textColor} />
            <Text style={[styles.actionLabel, { color: textColor }]}>{sendingToTrainer ? 'Sending…' : 'Send to Trainer'}</Text>
          </TouchableOpacity>
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
