// Design Law full-screen preview for a document link (Office / Google embed).
// Flow: reset spinner when a new link opens → NbPageHeader → WebView → hide spinner on finish/fail.
// Used by file viewers that embed Office or Google's preview page.

import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import NbPageHeader from '../../../look-and-feel/NbPageHeader';
import HardShadow from '../../../look-and-feel/HardShadow';
import { useTheme } from '../../../look-and-feel/lightDarkMode';
import { borderRadius, nb, spacing } from '../../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const DEFAULT_TITLE = 'Document';
const LOADING_HINT = 'Loading preview…';

// ===== MAIN FUNCTION =====

/**
 * @param {{ visible: boolean, uri?: string, title?: string, isDark?: boolean, onClose: Function }} props
 */
export default function WebPageViewer({
  visible,
  uri,
  title,
  isDark: _isDarkIgnored = true,
  onClose,
}) {
  const { colors } = useTheme();
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);

  useEffect(() => {
    if (visible && uri) setIsLoadingPreview(true);
  }, [visible, uri]);

  if (!visible || !uri) return null;

  const pageTitle = title || DEFAULT_TITLE;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.nbBackground }]}>
        <NbPageHeader title={pageTitle} subtitle="Document" onBack={onClose} />
        <View style={styles.wrap}>
          <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard} style={styles.shadow}>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
              ]}
            >
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
                <View style={[styles.loader, { backgroundColor: colors.nbSurface }]}>
                  <ActivityIndicator size="large" color={colors.nbInk} />
                  <Text style={[styles.hint, { color: colors.nbMuted }]}>{LOADING_HINT}</Text>
                </View>
              ) : null}
            </View>
          </HardShadow>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  wrap: {
    flex: 1,
    paddingHorizontal: nb.screenGutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  shadow: { flex: 1 },
  card: {
    flex: 1,
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
  },
  webview: { flex: 1, opacity: 0.99 },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hint: { marginTop: 12, fontSize: 13, fontWeight: '600' },
});
