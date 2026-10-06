// Full-screen preview for a document link, so the reader stays inside the app.
// Flow: reset the spinner when a new link opens → show the page → hide the spinner when it finishes or fails.
// Used by file viewers that embed Office or Google's preview page.

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

// ===== NAMED CONSTANTS =====

const DARK_PAGE_COLOR = '#020617';
const LIGHT_PAGE_COLOR = '#F9FAFB';
const DARK_TEXT_COLOR = '#F9FAFB';
const LIGHT_TEXT_COLOR = '#020617';
const DARK_HINT_COLOR = 'rgba(148,163,184,1)';
const LIGHT_HINT_COLOR = '#64748B';
const SPINNER_COLOR = '#A855F7';
const DEFAULT_TITLE = 'Document';
const CLOSE_LABEL = 'Close';
const LOADING_HINT = 'Loading preview…';

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

/**
 * Hooks stay in this order: loading state, then the effect that resets it. The empty check comes after both.
 * @param {{ visible: boolean, uri?: string, title?: string, isDark?: boolean, onClose: Function }} props
 * @returns {import('react').ReactElement|null}
 */
export default function WebPageViewer({ visible, uri, title, isDark = true, onClose }) {
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);

  useEffect(() => {
    if (visible && uri) setIsLoadingPreview(true);
  }, [visible, uri]);

  if (!visible || !uri) return null;

  const pageColor = isDark ? DARK_PAGE_COLOR : LIGHT_PAGE_COLOR;
  const textColor = isDark ? DARK_TEXT_COLOR : LIGHT_TEXT_COLOR;
  const hintColor = isDark ? DARK_HINT_COLOR : LIGHT_HINT_COLOR;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: pageColor }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[styles.closeText, { color: textColor }]}>{CLOSE_LABEL}</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
            {title || DEFAULT_TITLE}
          </Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={[styles.wrap, { backgroundColor: pageColor }]}>
          <WebView
            source={{ uri }}
            style={styles.webview}
            onLoadEnd={() => setIsLoadingPreview(false)}
            onError={() => setIsLoadingPreview(false)}
            originWhitelist={['*']}
            mixedContentMode="always"
            allowsInlineMediaPlayback
            androidLayerType="hardware"
          />
          {isLoadingPreview ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={SPINNER_COLOR} />
              <Text style={[styles.hint, { color: hintColor }]}>{LOADING_HINT}</Text>
            </View>
          ) : null}
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
