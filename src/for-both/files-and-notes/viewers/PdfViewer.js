// Design Law full-screen PDF viewer (PNG 09–12).
// Flow: parent sets visible + url → NbPageHeader (back + next) → WebView card → page label → actions.
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
  TouchableOpacity,
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
// Manipulate here: fallback page total when the PDF itself does not report one
const DEFAULT_PAGE_TOTAL = 1;

// ===== HELPER FUNCTIONS =====

function shortenDocumentTitle(name) {
  const rawTitle = String(name || DEFAULT_DOCUMENT_NAME);
  if (rawTitle.length > TITLE_MAX_LENGTH) return `${rawTitle.slice(0, TITLE_TRIM_LENGTH)}…`;
  return rawTitle;
}

/**
 * Strip an existing #page= fragment, then pin the requested page for many PDF hosts.
 * @param {string} url
 * @param {number} page
 * @returns {string}
 */
function pdfUrlForPage(url, page) {
  const raw = String(url || '').trim();
  if (!raw) return raw;
  const withoutHash = raw.replace(/#.*$/, '');
  const safePage = Math.max(1, Number(page) || 1);
  return `${withoutHash}#page=${safePage}`;
}

/**
 * @param {string} subtitle
 * @param {number|null|undefined} fileSizeLabel
 * @param {string|null|undefined} fromLabel
 * @returns {string}
 */
function buildPdfSubtitle(subtitle, fileSizeLabel, fromLabel) {
  const parts = [subtitle || 'PDF'];
  if (fileSizeLabel) parts.push(String(fileSizeLabel));
  if (fromLabel) parts.push(String(fromLabel));
  return parts.join(' · ');
}

// ===== MAIN FUNCTION =====

/**
 * Full-screen PDF preview with Design Law header + page chrome + action row.
 * @param {{
 *   visible: boolean,
 *   url?: string,
 *   name?: string,
 *   subtitle?: string,
 *   fileSizeLabel?: string,
 *   fromLabel?: string,
 *   pageCount?: number,
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
  fileSizeLabel,
  fromLabel,
  pageCount,
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
  // vocab: pageIndex = 1-based page the header forward chip advances
  const [pageIndex, setPageIndex] = useState(1);

  const totalPages = Math.max(DEFAULT_PAGE_TOTAL, Number(pageCount) || DEFAULT_PAGE_TOTAL);

  useEffect(() => {
    if (visible && url) {
      setIsLoading(true);
      setPageIndex(1);
    }
  }, [visible, url]);

  const title = useMemo(() => shortenDocumentTitle(name), [name]);
  const headerSubtitle = useMemo(
    () => buildPdfSubtitle(subtitle, fileSizeLabel, fromLabel),
    [subtitle, fileSizeLabel, fromLabel],
  );
  const webSource = useMemo(
    () => ({ uri: pdfUrlForPage(url, pageIndex) }),
    [url, pageIndex],
  );

  const goPrevPage = () => {
    setPageIndex((prev) => Math.max(1, prev - 1));
    setIsLoading(true);
  };

  const goNextPage = () => {
    setPageIndex((prev) => Math.min(totalPages, prev + 1));
    setIsLoading(true);
  };

  // When we do not know the real page count, still allow advancing a few pages via #page=
  const canGoNext = pageCount ? pageIndex < totalPages : pageIndex < 20;
  const canGoPrev = pageIndex > 1;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.nbBackground }]}>
        <NbPageHeader
          title={title}
          subtitle={headerSubtitle}
          onBack={onClose}
          onForward={goNextPage}
          forwardDisabled={!canGoNext}
        />

        <View style={styles.previewWrap}>
          <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard} style={styles.previewShadow}>
            <View
              style={[
                styles.previewCard,
                { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
              ]}
            >
              <WebView
                key={`pdf-page-${pageIndex}`}
                source={webSource}
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

          {/* Design Law PNG 09 — page label under the preview card */}
          <View style={styles.pageRow}>
            {canGoPrev ? (
              <TouchableOpacity
                onPress={goPrevPage}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Previous page"
              >
                <Text style={[styles.pageNav, { color: colors.nbInk }]}>Prev</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.pageNavSpacer} />
            )}
            <Text style={[styles.pageLabel, { color: colors.nbMuted }]}>
              {pageCount
                ? `Page ${pageIndex} of ${totalPages}`
                : `Page ${pageIndex}`}
            </Text>
            {canGoNext ? (
              <TouchableOpacity
                onPress={goNextPage}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Next page"
              >
                <Text style={[styles.pageNav, { color: colors.nbInk }]}>Next</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.pageNavSpacer} />
            )}
          </View>
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
  pageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    minHeight: 44,
  },
  pageLabel: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  pageNav: {
    fontSize: 13,
    fontWeight: '800',
    minWidth: 44,
    textAlign: 'center',
  },
  pageNavSpacer: { minWidth: 44 },
  actions: {
    paddingHorizontal: nb.screenGutter,
    paddingTop: spacing.md,
    gap: 10,
    borderTopWidth: Platform.OS === 'ios' ? StyleSheet.hairlineWidth : 1,
  },
  actionRow: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
});
