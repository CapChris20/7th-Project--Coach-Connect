import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * Fullscreen embedded viewer (Office Online / Google gview) — keeps user in the app.
 */
export default function EmbedWebViewModal({ visible, uri, title, isDark = true, onClose }) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (visible && uri) setLoading(true);
  }, [visible, uri]);
  if (!visible || !uri) return null;
  const bg = isDark ? '#020617' : '#F9FAFB';
  const textColor = isDark ? '#F9FAFB' : '#020617';

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[styles.closeText, { color: textColor }]}>Close</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
            {title || 'Document'}
          </Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={[styles.wrap, { backgroundColor: bg }]}>
          <WebView
            source={{ uri }}
            style={styles.webview}
            onLoadEnd={() => setLoading(false)}
            onError={() => setLoading(false)}
            originWhitelist={['*']}
            mixedContentMode="always"
            allowsInlineMediaPlayback
            androidLayerType="hardware"
          />
          {loading && (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color="#A855F7" />
              <Text style={[styles.hint, { color: isDark ? 'rgba(148,163,184,1)' : '#64748B' }]}>Loading preview…</Text>
            </View>
          )}
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
    paddingTop: Platform.OS === 'android' ? 24 : 8,
    paddingBottom: 8,
  },
  closeText: { fontSize: 16, fontWeight: '600' },
  title: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700', marginHorizontal: 12 },
  wrap: { flex: 1, position: 'relative' },
  webview: { flex: 1, opacity: 0.99 },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(2,6,23,0.35)',
  },
  hint: { marginTop: 12, fontSize: 13 },
});
