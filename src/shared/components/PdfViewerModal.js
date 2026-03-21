import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

export default function PdfViewerModal({ visible, url, name, isDark = true, onClose }) {
  if (!url) return null;
  const bg = isDark ? '#020617' : '#F9FAFB';
  const textColor = isDark ? '#F9FAFB' : '#020617';
  const muted = isDark ? 'rgba(148,163,184,1)' : 'rgba(71,85,105,1)';
  const [loading, setLoading] = useState(true);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[styles.closeText, { color: textColor }]}>Close</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
            {name || 'Document'}
          </Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={[styles.webviewWrapper, { backgroundColor: bg }]}>
          <WebView
            source={{ uri: url }}
            style={styles.webview}
            onLoadEnd={() => setLoading(false)}
            onError={() => setLoading(false)}
          />
          {loading && (
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingCard}>
                <View style={styles.loadingIconCircle}>
                  <Text style={[styles.loadingIconText, { color: textColor }]}>PDF</Text>
                </View>
                <Text style={[styles.loadingTitle, { color: textColor }]}>Preparing preview…</Text>
                <Text style={[styles.loadingSubtitle, { color: muted }]}>This may take a moment.</Text>
                <ActivityIndicator style={{ marginTop: 12 }} size="small" color="#A855F7" />
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 24 : 8,
    paddingBottom: 8,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    marginHorizontal: 12,
  },
  webviewWrapper: {
    flex: 1,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.4)',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCard: {
    width: '72%',
    maxWidth: 320,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(15,23,42,0.9)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148,163,184,0.6)',
    alignItems: 'center',
  },
  loadingIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  loadingIconText: {
    fontSize: 14,
    fontWeight: '700',
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  loadingSubtitle: {
    flex: 1,
    fontSize: 13,
    textAlign: 'center',
  },
});

