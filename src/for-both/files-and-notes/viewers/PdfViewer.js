// Full-screen PDF viewer (Design Law PNG 09–12).
// Flow: parent sets visible + url → header (back + next) → WebView card → page label → actions.
// Used by FilesScreen and Notes & Files openers. Missing url returns null so an empty modal never mounts.
// Read order: constants → helpers → layout pieces → PdfViewer → styles.
// vocab: HardShadow = solid offset shadow (no blur); shell SafeArea is L/R only so NbPageHeader owns top inset.

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
// Manipulate here: when pageCount is unknown, still allow this many “next” taps via #page=
const MAX_GUESS_PAGES_WITHOUT_COUNT = 20;

// ===== HELPER FUNCTIONS =====

function shortenDocumentTitle(documentName) {
  const fullTitle = String(documentName || DEFAULT_DOCUMENT_NAME);
  if (fullTitle.length > TITLE_MAX_LENGTH) {
    return `${fullTitle.slice(0, TITLE_TRIM_LENGTH)}…`;
  }
  return fullTitle;
}

/**
 * Strip an existing #page= fragment, then pin the requested page for many PDF hosts.
 * Why: some CDNs ignore hash changes unless the WebView remounts (we key by pageIndex).
 */
function pdfUrlForPage(url, pageNumber) {
  const trimmedUrl = String(url || '').trim();
  if (!trimmedUrl) {
    return trimmedUrl;
  }
  const urlWithoutHash = trimmedUrl.replace(/#.*$/, '');
  const safePageNumber = Math.max(1, Number(pageNumber) || 1);
  return `${urlWithoutHash}#page=${safePageNumber}`;
}

function buildPdfHeaderSubtitle(subtitle, fileSizeLabel, fromLabel) {
  const subtitleParts = [subtitle || 'PDF'];
  if (fileSizeLabel) {
    subtitleParts.push(String(fileSizeLabel));
  }
  if (fromLabel) {
    subtitleParts.push(String(fromLabel));
  }
  return subtitleParts.join(' · ');
}

function pageLabelText(pageIndex, totalPages, pageCountKnown) {
  if (pageCountKnown) {
    return `Page ${pageIndex} of ${totalPages}`;
  }
  return `Page ${pageIndex}`;
}

function canAdvanceToNextPage(pageIndex, totalPages, pageCountKnown) {
  if (pageCountKnown) {
    return pageIndex < totalPages;
  }
  return pageIndex < MAX_GUESS_PAGES_WITHOUT_COUNT;
}

// ===== IN-FILE UI PIECES (no hooks) =====

function PdfWebPreviewCard({
  pageIndex,
  webSource,
  isLoading,
  colors,
  onPreviewFinishedLoading,
  onPreviewFailed,
}) {
  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard} style={styles.previewShadow}>
      <View
        style={[
          styles.previewCard,
          { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
        ]}
      >
        {/* vocab: key remounts WebView when pageIndex changes so #page= is re-read */}
        <WebView
          key={`pdf-page-${pageIndex}`}
          source={webSource}
          style={styles.webview}
          onLoadEnd={onPreviewFinishedLoading}
          onError={onPreviewFailed}
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
  );
}

function PdfPrevPageControl({ canGoToPreviousPage, inkColor, onGoPrevious }) {
  if (!canGoToPreviousPage) {
    return <View style={styles.pageNavSpacer} />;
  }
  return (
    <TouchableOpacity
      onPress={onGoPrevious}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Previous page"
    >
      <Text style={[styles.pageNav, { color: inkColor }]}>Prev</Text>
    </TouchableOpacity>
  );
}

function PdfNextPageControl({ canGoToNextPage, inkColor, onGoNext }) {
  if (!canGoToNextPage) {
    return <View style={styles.pageNavSpacer} />;
  }
  return (
    <TouchableOpacity
      onPress={onGoNext}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Next page"
    >
      <Text style={[styles.pageNav, { color: inkColor }]}>Next</Text>
    </TouchableOpacity>
  );
}

function PdfPageNavigationRow({
  pageIndex,
  totalPages,
  pageCountKnown,
  canGoToPreviousPage,
  canGoToNextPage,
  inkColor,
  mutedColor,
  onGoPrevious,
  onGoNext,
}) {
  const pageLabel = pageLabelText(pageIndex, totalPages, pageCountKnown);

  return (
    <View style={styles.pageRow}>
      <PdfPrevPageControl
        canGoToPreviousPage={canGoToPreviousPage}
        inkColor={inkColor}
        onGoPrevious={onGoPrevious}
      />
      <Text style={[styles.pageLabel, { color: mutedColor }]}>{pageLabel}</Text>
      <PdfNextPageControl
        canGoToNextPage={canGoToNextPage}
        inkColor={inkColor}
        onGoNext={onGoNext}
      />
    </View>
  );
}

function downloadButtonIfPresent(onDownload) {
  if (typeof onDownload !== 'function') return null;
  return (
    <NbButton variant="plain" onPress={onDownload} style={styles.half}>
      Download
    </NbButton>
  );
}

function shareButtonIfPresent(onShare) {
  if (typeof onShare !== 'function') return null;
  return (
    <NbButton variant="plain" onPress={onShare} style={styles.half}>
      Share
    </NbButton>
  );
}

function deleteButtonIfPresent(onDelete) {
  if (typeof onDelete !== 'function') return null;
  return (
    <NbButton variant="plain" onPress={onDelete}>
      Delete from my files
    </NbButton>
  );
}

function PdfViewerActionBar({
  bottomInset,
  borderColor,
  onDownload,
  onShare,
  onDelete,
}) {
  const downloadButton = downloadButtonIfPresent(onDownload);
  const shareButton = shareButtonIfPresent(onShare);
  const deleteButton = deleteButtonIfPresent(onDelete);
  const actionBarPaddingBottom = Math.max(bottomInset, spacing.md);

  return (
    <View
      style={[
        styles.actions,
        {
          borderTopColor: borderColor,
          paddingBottom: actionBarPaddingBottom,
        },
      ]}
    >
      <View style={styles.actionRow}>
        {downloadButton}
        {shareButton}
      </View>
      {deleteButton}
    </View>
  );
}

/**
 * Pure layout: header + preview + page row + actions.
 * Why extract: keeps hooks/state out of the paint tree.
 */
function PdfViewerLayout({
  headerTitle,
  headerSubtitle,
  pageIndex,
  webSource,
  isLoadingPreview,
  totalPages,
  pageCountKnown,
  canGoToPreviousPage,
  canGoToNextPage,
  colors,
  bottomInset,
  onClose,
  onGoPrevious,
  onGoNext,
  onPreviewFinishedLoading,
  onPreviewFailed,
  onDownload,
  onShare,
  onDelete,
}) {
  return (
    <View style={[styles.container, { backgroundColor: colors.nbBackground }]}>
      <NbPageHeader
        title={headerTitle}
        subtitle={headerSubtitle}
        onBack={onClose}
        onForward={onGoNext}
        forwardDisabled={!canGoToNextPage}
      />

      <View style={styles.previewWrap}>
        <PdfWebPreviewCard
          pageIndex={pageIndex}
          webSource={webSource}
          isLoading={isLoadingPreview}
          colors={colors}
          onPreviewFinishedLoading={onPreviewFinishedLoading}
          onPreviewFailed={onPreviewFailed}
        />

        {/* Design Law PNG 09 — page label under the preview card */}
        <PdfPageNavigationRow
          pageIndex={pageIndex}
          totalPages={totalPages}
          pageCountKnown={pageCountKnown}
          canGoToPreviousPage={canGoToPreviousPage}
          canGoToNextPage={canGoToNextPage}
          inkColor={colors.nbInk}
          mutedColor={colors.nbMuted}
          onGoPrevious={onGoPrevious}
          onGoNext={onGoNext}
        />
      </View>

      <PdfViewerActionBar
        bottomInset={bottomInset}
        borderColor={colors.nbBorder}
        onDownload={onDownload}
        onShare={onShare}
        onDelete={onDelete}
      />
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Design Law full-screen PDF viewer.
 * Hook order frozen: early null return stays above hooks (same as before).
 * @param {object} props
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
  // Fail fast — never mount a blank PDF modal.
  if (!url) {
    return null;
  }

  const { colors } = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);
  // vocab: pageIndex = 1-based page the header forward chip advances
  const [pageIndex, setPageIndex] = useState(1);

  const totalPages = Math.max(DEFAULT_PAGE_TOTAL, Number(pageCount) || DEFAULT_PAGE_TOTAL);
  const pageCountKnown = Boolean(pageCount);

  // Reset page + spinner whenever the parent opens a different file.
  useEffect(() => {
    if (visible && url) {
      setIsLoadingPreview(true);
      setPageIndex(1);
    }
  }, [visible, url]);

  const headerTitle = useMemo(() => shortenDocumentTitle(name), [name]);
  const headerSubtitle = useMemo(
    () => buildPdfHeaderSubtitle(subtitle, fileSizeLabel, fromLabel),
    [subtitle, fileSizeLabel, fromLabel],
  );
  const webSource = useMemo(
    () => ({ uri: pdfUrlForPage(url, pageIndex) }),
    [url, pageIndex],
  );

  // 1. Step one page back (never below page 1).
  const goToPreviousPage = () => {
    setPageIndex((previousPage) => Math.max(1, previousPage - 1));
    setIsLoadingPreview(true);
  };

  // 2. Step one page forward (cap at known total, or guess cap).
  const goToNextPage = () => {
    setPageIndex((previousPage) => Math.min(totalPages, previousPage + 1));
    setIsLoadingPreview(true);
  };

  const canGoToPreviousPage = pageIndex > 1;
  const canGoToNextPage = canAdvanceToNextPage(pageIndex, totalPages, pageCountKnown);

  // 3. Hide the overlay once the WebView finishes (success or error).
  const clearLoadingOverlay = () => setIsLoadingPreview(false);

  // 4. Paint modal → layout.
  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <PdfViewerLayout
        headerTitle={headerTitle}
        headerSubtitle={headerSubtitle}
        pageIndex={pageIndex}
        webSource={webSource}
        isLoadingPreview={isLoadingPreview}
        totalPages={totalPages}
        pageCountKnown={pageCountKnown}
        canGoToPreviousPage={canGoToPreviousPage}
        canGoToNextPage={canGoToNextPage}
        colors={colors}
        bottomInset={safeAreaInsets.bottom}
        onClose={onClose}
        onGoPrevious={goToPreviousPage}
        onGoNext={goToNextPage}
        onPreviewFinishedLoading={clearLoadingOverlay}
        onPreviewFailed={clearLoadingOverlay}
        onDownload={onDownload}
        onShare={onShare}
        onDelete={onDelete}
      />
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
