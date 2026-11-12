// Design Law full-screen PDF viewer (PNG 09–12).
// Flow: parent sets visible + url → NbPageHeader chrome → WebView → Download / Share / Delete actions.
// Used by FilesScreen and Notes & Files openers. Missing url returns null so an empty modal never mounts.
// vocab: HardShadow = solid offset; shell SafeArea is L/R only so NbPageHeader owns top inset

import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NbPageHeader from '../../../look-and-feel/NbPageHeader';
import NbButton from '../../../look-and-feel/NbButton';
import HardShadow from '../../../look-and-feel/HardShadow';
import { useTheme } from '../../../look-and-feel/lightDarkMode';
import { borderRadius, nb, spacing } from '../../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const DEFAULT_DOCUMENT_NAME = 'Document';
const TITLE_MAX_LENGTH = 40;
const TITLE_TRIM_LENGTH = 37;
const WEBVIEW_ORIGIN_WHITELIST = ['*'];

// ===== HELPER FUNCTIONS =====

function shortenDocumentTitle(name) {
  const rawTitle = String(name || DEFAULT_DOCUMENT_NAME);
  if (rawTitle.length > TITLE_MAX_LENGTH) return `${rawTitle.slice(0, TITLE_TRIM_LENGTH)}…`;
  return rawTitle;
}

// ===== MAIN FUNCTION =====

/**
 * Full-screen PDF preview with Design Law header + action row.
 * @param {{
 *   visible: boolean,
 *   url?: string,
 *   name?: string,
 *   subtitle?: string,
 *   isDark?: boolean,
 *   onClose: Function,
 *   onDownload?: Function,
 *   onShare?: Function,
 *   onDelete?: Function,
 * }} props
 */
export default function PdfViewer({
  visible,
  url,
  name,
  subtitle = 'PDF',
  isDark: _isDarkIgnored = true,
  onClose,
  onDownload,
  onShare,
  onDelete,
}) {
  if (!url) return null;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (visible && url) setIsLoading(true);
  }, [visible, url]);

  const title = useMemo(() => shortenDocumentTitle(name), [name]);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.nbBackground }]}>
        <NbPageHeader title={title} subtitle={subtitle} onBack={onClose} />

        <View style={styles.previewWrap}>
          <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard} style={styles.previewShadow}>
            <View
              style={[
                styles.previewCard,
                { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
              ]}
            >
              <WebView
                source={{ uri: url }}
                style={styles.webview}
                onLoadEnd={() => setIsLoading(false)}
                onError={() => setIsLoading(false)}
                originWhitelist={WEBVIEW_ORIGIN_WHITELIST}
                mixedContentMode="always"
              />
              {isLoading ? (
                <View style={[styles.loadingOverlay, { backgroundColor: colors.nbSurface }]}>
                  <ActivityIndicator size="large" color={colors.nbInk} />
                  <Text style={[styles.loadingTitle, { color: colors.nbInk }]}>Loading preview</Text>
                  <Text style={[styles.loadingSubtitle, { color: colors.nbMuted }]}>
                    If this takes too long, try again on Wi‑Fi.
                  </Text>
                </View>
              ) : null}
            </View>
          </HardShadow>
        </View>

        <View
          style={[
            styles.actions,
            {
              borderTopColor: colors.nbBorder,
              paddingBottom: Math.max(insets.bottom, spacing.md),
            },
          ]}
        >
          <View style={styles.actionRow}>
            {typeof onDownload === 'function' ? (
              <NbButton variant="plain" onPress={onDownload} style={styles.half}>
                Download
              </NbButton>
            ) : null}
            {typeof onShare === 'function' ? (
              <NbButton variant="plain" onPress={onShare} style={styles.half}>
                Share
              </NbButton>
            ) : null}
          </View>
          {typeof onDelete === 'function' ? (
            <NbButton variant="plain" onPress={onDelete}>
              Delete from my files
            </NbButton>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  previewWrap: {
    flex: 1,
    paddingHorizontal: nb.screenGutter,
    paddingTop: spacing.sm,
  },
  previewShadow: { flex: 1 },
  previewCard: {
    flex: 1,
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
  },
  webview: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  loadingTitle: { fontSize: 16, fontWeight: '800', marginTop: 8 },
  loadingSubtitle: { fontSize: 13, textAlign: 'center', fontWeight: '500' },
  actions: {
    paddingHorizontal: nb.screenGutter,
    paddingTop: spacing.md,
    gap: 10,
    borderTopWidth: Platform.OS === 'ios' ? StyleSheet.hairlineWidth : 1,
  },
  actionRow: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
});
