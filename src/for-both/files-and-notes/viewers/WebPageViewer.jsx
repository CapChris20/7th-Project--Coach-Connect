// Design Law full-screen preview for a document link (Office / Google embed).
// Flow: reset spinner when a new link opens → NbPageHeader → WebView card → hide spinner on finish/fail.
// Used by file viewers that embed Office or Google’s preview page.

import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import NbPageHeader from '../../../look-and-feel/NbPageHeader';
import HardShadow from '../../../look-and-feel/HardShadow';
import { useTheme } from '../../../look-and-feel/lightDarkMode';
import { borderRadius, nb, spacing } from '../../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const DEFAULT_HEADER_TITLE = 'Document';
const LOADING_HINT_COPY = 'Loading preview…';
const WEBVIEW_ORIGIN_WHITELIST = ['*'];
// vocab: androidLayerType hardware = GPU compositing for smoother scroll inside WebView on Android
const ANDROID_WEBVIEW_LAYER = 'hardware';
const HEADER_SUBTITLE = 'Document';

// ===== HELPER FUNCTIONS =====

function PreviewLoadingOverlay({ surfaceColor, inkColor, mutedColor }) {
  const overlayStyle = [styles.loader, { backgroundColor: surfaceColor }];
  const hintStyle = [styles.hint, { color: mutedColor }];

  return (
    <View style={overlayStyle}>
      <ActivityIndicator size="large" color={inkColor} />
      <Text style={hintStyle}>{LOADING_HINT_COPY}</Text>
    </View>
  );
}

function EmbeddedWebPreviewCard({
  pageUri,
  surfaceColor,
  borderColor,
  inkColor,
  mutedColor,
  isLoadingPreview,
  onPreviewFinished,
  onPreviewFailed,
}) {
  const cardStyle = [styles.card, { backgroundColor: surfaceColor, borderColor }];
  const shouldShowLoadingOverlay = isLoadingPreview === true;

  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard} style={styles.shadow}>
      <View style={cardStyle}>
        <WebView
          source={{ uri: pageUri }}
          style={styles.webview}
          onLoadEnd={onPreviewFinished}
          onError={onPreviewFailed}
          originWhitelist={WEBVIEW_ORIGIN_WHITELIST}
          mixedContentMode="always"
          allowsInlineMediaPlayback
          androidLayerType={ANDROID_WEBVIEW_LAYER}
        />
        {shouldShowLoadingOverlay ? (
          <PreviewLoadingOverlay
            surfaceColor={surfaceColor}
            inkColor={inkColor}
            mutedColor={mutedColor}
          />
        ) : null}
      </View>
    </HardShadow>
  );
}

function shouldResetLoadingSpinner(visible, uri) {
  if (!visible) {
    return false;
  }
  if (!uri) {
    return false;
  }
  return true;
}

function canPaintViewer(visible, uri) {
  if (!visible) {
    return false;
  }
  if (!uri) {
    return false;
  }
  return true;
}

// ===== MAIN FUNCTION =====

/**
 * Full-screen modal that embeds one remote document preview URL.
 * Hook order frozen: useTheme → useState(isLoadingPreview) → useEffect(reset spinner).
 * @param {{
 *   visible: boolean,
 *   uri: string,
 *   title?: string,
 *   isDark?: boolean,
 *   onClose: Function,
 * }} props
 */
export default function WebPageViewer({
  visible,
  uri,
  title,
  isDark: _isDarkIgnored = true,
  onClose,
}) {
  // vocab: useTheme = Design Law light/dark token bag
  const { colors } = useTheme();
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);

  // When the sheet opens (or the link changes), show the spinner again until WebView settles.
  useEffect(() => {
    // 1. Only reset when we actually have something to show.
    if (!shouldResetLoadingSpinner(visible, uri)) {
      return;
    }

    // 2. Force the overlay back on for the new page.
    setIsLoadingPreview(true);
  }, [visible, uri]);

  // Failures first: nothing to paint without a visible modal + uri.
  if (!canPaintViewer(visible, uri)) {
    return null;
  }

  const headerTitle = title || DEFAULT_HEADER_TITLE;
  const screenBackgroundStyle = [styles.container, { backgroundColor: colors.nbBackground }];

  // 3. Hide the spinner when the WebView finishes or fails.
  const hideLoadingSpinner = () => {
    setIsLoadingPreview(false);
  };

  // 4. Paint header + embedded preview card.
  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={screenBackgroundStyle}>
        <NbPageHeader title={headerTitle} subtitle={HEADER_SUBTITLE} onBack={onClose} />
        <View style={styles.wrap}>
          <EmbeddedWebPreviewCard
            pageUri={uri}
            surfaceColor={colors.nbSurface}
            borderColor={colors.nbBorder}
            inkColor={colors.nbInk}
            mutedColor={colors.nbMuted}
            isLoadingPreview={isLoadingPreview}
            onPreviewFinished={hideLoadingSpinner}
            onPreviewFailed={hideLoadingSpinner}
          />
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
