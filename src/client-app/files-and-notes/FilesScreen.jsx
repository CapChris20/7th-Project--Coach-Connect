// Client "Your Notes & Files" full screen — header, shared FilesSection grid, and file viewers.
// Flow: tap a card → open the matching viewer → mark trainer items read → share / download / delete mine.
// Used by the client app start shell. Parent passes `items` + `clientId`; this screen does not fetch.

import React, { useCallback, useState } from 'react';
import { Linking, Platform, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  deleteNotesAndFilesItem,
  markNotesAndFilesItemRead,
  resolveTrainerSpreadsheetView,
  packSpreadsheetRowsHaveContent,
} from '../../for-both/files-and-notes/saveNotesAndFiles';
import {
  getEmbedViewerUri,
  isImageFile as fileLooksLikeImage,
  isPdfFile as fileLooksLikePdf,
  isVideoFile as fileLooksLikeVideo,
} from '../../helpers/whichViewerForFile';
import FilesSection from '../../for-both/files-and-notes/viewers/FilesSection';
import PdfViewer from '../../for-both/files-and-notes/viewers/PdfViewer';
import SpreadsheetViewer from '../../for-both/files-and-notes/viewers/SpreadsheetViewer';
import DocumentViewer from '../../for-both/files-and-notes/viewers/DocumentViewer';
import PhotoVideoViewer from '../../for-both/files-and-notes/viewers/PhotoVideoViewer';
import WebPageViewer from '../../for-both/files-and-notes/viewers/WebPageViewer';
import NbPageHeader from '../../look-and-feel/NbPageHeader';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { SHELL_SAFE_AREA_EDGES } from '../../navigation/bottomMenuSpacing';
import { spacing } from '../../look-and-feel/colorPalette';
import NbNoticeSheet from '../../look-and-feel/NbNoticeSheet';

// ===== NAMED CONSTANTS =====

const DOCUMENT_TYPE = 'document';
const SPREADSHEET_TYPE = 'spreadsheet';

// Manipulate here: closed shapes for every viewer modal (visible false + null payload fields).
const CLOSED_PDF_VIEWER = { visible: false, url: null, name: null };
const CLOSED_SPREADSHEET_VIEWER = { visible: false, url: null, name: null, rows: null };
const CLOSED_DOCUMENT_VIEWER = { visible: false, trainerId: null, documentId: null, title: null };
const CLOSED_MEDIA_VIEWER = { visible: false, url: null, kind: 'image', name: null };
const CLOSED_WEB_VIEWER = { visible: false, uri: null, title: null };

const PAGE_TITLE = 'Your Notes & Files';
const PAGE_SUBTITLE = 'Everything shared between you and your coach, all in one place.';
const NOTICE_OK_LABEL = 'OK';
const FALLBACK_SPREADSHEET_NAME = 'Spreadsheet';
const FALLBACK_DOCUMENT_NAME = 'Document';
const FALLBACK_PHOTO_NAME = 'Photo';
const FALLBACK_VIDEO_NAME = 'Video';
const FALLBACK_FILE_NAME = 'File';
const DOWNLOAD_MISSING_TITLE = 'Download';
const DOWNLOAD_MISSING_MESSAGE = 'No download link for this file.';
const DOWNLOAD_FAILED_TITLE = 'Download failed';
const DOWNLOAD_FAILED_MESSAGE = 'Could not open this file.';
const DELETE_FAILED_TITLE = 'Delete failed';
const DELETE_FAILED_FALLBACK = 'Try again.';

// ===== HELPER FUNCTIONS =====

function spreadsheetDisplayName(file) {
  if (!file) return FALLBACK_SPREADSHEET_NAME;
  if (file.name) return file.name;
  if (file.title) return file.title;
  return FALLBACK_SPREADSHEET_NAME;
}

function fileNameLooksLikeSpreadsheet(fileName) {
  const nameText = String(fileName || '');
  return !!nameText.match(/\.(xlsx|csv)$/i);
}

function fileHasDirectSpreadsheetUrl(file) {
  if (!file) return false;
  if (!file.url) return false;
  if (file.type === SPREADSHEET_TYPE) return true;
  return fileNameLooksLikeSpreadsheet(file.name);
}

function fileIsTrainerSpreadsheetPack(file) {
  if (!file) return false;
  if (file.type !== SPREADSHEET_TYPE) return false;
  if (!file.trainerId) return false;
  if (!file.documentId) return false;
  return true;
}

async function tryOpenSpreadsheetViewer(file, setSpreadsheetViewer) {
  if (!file) return false;

  if (fileHasDirectSpreadsheetUrl(file)) {
    setSpreadsheetViewer({
      visible: true,
      url: file.url,
      name: spreadsheetDisplayName(file),
      rows: null,
    });
    return true;
  }

  if (!fileIsTrainerSpreadsheetPack(file)) return false;

  try {
    const resolved = await resolveTrainerSpreadsheetView(file.trainerId, file.documentId);
    if (!resolved) return false;

    const resolvedUrl = resolved.url || null;
    const resolvedRows = resolved.rows || null;
    const hasUrl = !!resolvedUrl;
    const hasRows = packSpreadsheetRowsHaveContent(resolvedRows);
    if (!hasUrl && !hasRows) return false;

    setSpreadsheetViewer({
      visible: true,
      url: resolvedUrl,
      rows: resolvedRows,
      name: spreadsheetDisplayName(file),
    });
    return true;
  } catch (_ignored) {
    return false;
  }
}

function fileIsTrainerAuthoredDocument(file) {
  if (!file) return false;
  if (file.type === DOCUMENT_TYPE) return true;
  if (file.documentId && file.trainerId) return true;
  return false;
}

function documentViewerTitle(file) {
  if (!file) return FALLBACK_DOCUMENT_NAME;
  if (file.title) return file.title;
  if (file.name) return file.name;
  return FALLBACK_DOCUMENT_NAME;
}

function mediaDisplayName(file, fallbackName) {
  if (!file) return fallbackName;
  if (file.name) return file.name;
  if (file.title) return file.title;
  return fallbackName;
}

function webViewerTitle(file) {
  if (!file) return FALLBACK_DOCUMENT_NAME;
  if (file.name) return file.name;
  if (file.title) return file.title;
  return FALLBACK_DOCUMENT_NAME;
}

function pdfViewerName(file) {
  if (!file) return FALLBACK_DOCUMENT_NAME;
  if (file.name) return file.name;
  return FALLBACK_DOCUMENT_NAME;
}

async function openFileInMatchingViewer(file, viewerSetters) {
  const {
    setSpreadsheetViewer,
    setDocumentViewer,
    setMediaViewer,
    setPdfViewer,
    setEmbedWebViewer,
  } = viewerSetters;

  // 1. Spreadsheet (direct URL or trainer pack rows).
  const spreadsheetOpened = await tryOpenSpreadsheetViewer(file, setSpreadsheetViewer);
  if (spreadsheetOpened) return;

  // 2. Trainer-authored document stub.
  if (fileIsTrainerAuthoredDocument(file)) {
    setDocumentViewer({
      visible: true,
      trainerId: file.trainerId,
      documentId: file.documentId,
      title: documentViewerTitle(file),
    });
    return;
  }

  const fileUrl = file && file.url ? file.url : null;
  if (!fileUrl) return;

  // 3. Photo.
  if (fileLooksLikeImage(file)) {
    setMediaViewer({
      visible: true,
      url: fileUrl,
      kind: 'image',
      name: mediaDisplayName(file, FALLBACK_PHOTO_NAME),
    });
    return;
  }

  // 4. Video.
  if (fileLooksLikeVideo(file)) {
    setMediaViewer({
      visible: true,
      url: fileUrl,
      kind: 'video',
      name: mediaDisplayName(file, FALLBACK_VIDEO_NAME),
    });
    return;
  }

  // 5. PDF.
  if (fileLooksLikePdf(file, fileUrl)) {
    setPdfViewer({
      visible: true,
      url: fileUrl,
      name: pdfViewerName(file),
    });
    return;
  }

  // 6. Everything else → embed / web viewer.
  setEmbedWebViewer({
    visible: true,
    uri: getEmbedViewerUri(file, fileUrl),
    title: webViewerTitle(file),
  });
}

function shareTitleFromItem(item) {
  if (!item) return FALLBACK_FILE_NAME;
  if (item.name) return item.name;
  if (item.title) return item.title;
  return FALLBACK_FILE_NAME;
}

async function shareNotesFile(item) {
  const fileUrl = item && item.url ? item.url : null;
  const shareTitle = shareTitleFromItem(item);

  try {
    if (fileUrl) {
      const isAndroid = Platform.OS === 'android';
      const androidMessage = isAndroid ? fileUrl : undefined;
      await Share.share({
        url: fileUrl,
        message: androidMessage,
        title: shareTitle,
      });
      return;
    }
    await Share.share({ message: shareTitle, title: shareTitle });
  } catch (_ignored) {
    // User dismissed the share sheet — not an error we surface.
  }
}

async function downloadNotesFileOrWarn(item, showNotice) {
  const fileUrl = item && item.url ? item.url : null;
  if (!fileUrl) {
    showNotice(DOWNLOAD_MISSING_TITLE, DOWNLOAD_MISSING_MESSAGE);
    return;
  }

  try {
    await Linking.openURL(fileUrl);
  } catch (_ignored) {
    showNotice(DOWNLOAD_FAILED_TITLE, DOWNLOAD_FAILED_MESSAGE);
  }
}

function deleteErrorMessage(error) {
  if (error && error.message) return error.message;
  return DELETE_FAILED_FALLBACK;
}

async function deleteNotesFileOrWarn(clientId, item, showNotice) {
  try {
    await deleteNotesAndFilesItem(clientId, item.id);
  } catch (error) {
    showNotice(DELETE_FAILED_TITLE, deleteErrorMessage(error));
  }
}

function noticeTitleText(notice) {
  if (!notice) return '';
  if (notice.title) return notice.title;
  return '';
}

function noticeMessageText(notice) {
  if (!notice) return undefined;
  return notice.message;
}

function noticeConfirmLabelText(notice) {
  if (!notice) return NOTICE_OK_LABEL;
  if (notice.confirmLabel) return notice.confirmLabel;
  return NOTICE_OK_LABEL;
}

function noticeCancelLabelText(notice) {
  if (!notice) return undefined;
  return notice.cancelLabel;
}

function noticeConfirmAction(notice) {
  if (!notice) return undefined;
  return notice.onConfirm;
}

function AllFileViewers({
  isDark,
  pdfViewer,
  spreadsheetViewer,
  documentViewer,
  mediaViewer,
  webViewer,
  closePdf,
  closeSpreadsheet,
  closeDocument,
  closeMedia,
  closeWeb,
}) {
  return (
    <>
      <PdfViewer
        visible={pdfViewer.visible}
        url={pdfViewer.url}
        name={pdfViewer.name}
        isDark={isDark}
        onClose={closePdf}
      />
      <SpreadsheetViewer
        visible={spreadsheetViewer.visible}
        url={spreadsheetViewer.url}
        rows={spreadsheetViewer.rows}
        name={spreadsheetViewer.name}
        isDark={isDark}
        onClose={closeSpreadsheet}
      />
      <DocumentViewer
        visible={documentViewer.visible}
        trainerId={documentViewer.trainerId}
        documentId={documentViewer.documentId}
        title={documentViewer.title}
        isDark={isDark}
        onClose={closeDocument}
      />
      <PhotoVideoViewer
        visible={mediaViewer.visible}
        url={mediaViewer.url}
        kind={mediaViewer.kind}
        name={mediaViewer.name}
        isDark={isDark}
        onClose={closeMedia}
      />
      <WebPageViewer
        visible={webViewer.visible}
        uri={webViewer.uri}
        title={webViewer.title}
        isDark={isDark}
        onClose={closeWeb}
      />
    </>
  );
}

function FilesScreenLayout({
  colors,
  isDark,
  items,
  onBack,
  onUploadPress,
  openItem,
  downloadItem,
  shareItem,
  deleteItem,
  markRead,
  pdfViewer,
  spreadsheetViewer,
  documentViewer,
  mediaViewer,
  webViewer,
  closePdf,
  closeSpreadsheet,
  closeDocument,
  closeMedia,
  closeWeb,
  notice,
  clearNotice,
}) {
  const noticeIsVisible = !!notice;
  const noticeTitle = noticeTitleText(notice);
  const noticeMessage = noticeMessageText(notice);
  const noticeConfirmLabel = noticeConfirmLabelText(notice);
  const noticeCancelLabel = noticeCancelLabelText(notice);
  const noticeConfirmHandler = noticeConfirmAction(notice);

  return (
    <SafeAreaView
      style={[styles.shell, { backgroundColor: colors.nbBackground }]}
      edges={SHELL_SAFE_AREA_EDGES}
    >
      <NbPageHeader title={PAGE_TITLE} subtitle={PAGE_SUBTITLE} onBack={onBack} />

      <View style={styles.body}>
        <FilesSection
          items={items}
          audience="client"
          isDark={isDark}
          showHero={false}
          onOpenItem={openItem}
          onDownloadItem={downloadItem}
          onShareItem={shareItem}
          onDeleteItem={deleteItem}
          onMarkRead={markRead}
          onUploadPress={onUploadPress}
        />
      </View>

      <AllFileViewers
        isDark={isDark}
        pdfViewer={pdfViewer}
        spreadsheetViewer={spreadsheetViewer}
        documentViewer={documentViewer}
        mediaViewer={mediaViewer}
        webViewer={webViewer}
        closePdf={closePdf}
        closeSpreadsheet={closeSpreadsheet}
        closeDocument={closeDocument}
        closeMedia={closeMedia}
        closeWeb={closeWeb}
      />

      <NbNoticeSheet
        visible={noticeIsVisible}
        onClose={clearNotice}
        title={noticeTitle}
        message={noticeMessage}
        confirmLabel={noticeConfirmLabel}
        cancelLabel={noticeCancelLabel}
        onConfirm={noticeConfirmHandler}
      />
    </SafeAreaView>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Client files screen: my files, trainer-shared files, and coaching notes.
 * @param {{ clientId: string, items: Array, isDark?: boolean, onBack: Function, onUploadPress?: Function }} props
 */
export default function FilesScreen({ clientId, items, isDark = true, onBack, onUploadPress }) {
  const { colors } = useTheme();

  const [pdfViewer, setPdfViewer] = useState(CLOSED_PDF_VIEWER);
  const [spreadsheetViewer, setSpreadsheetViewer] = useState(CLOSED_SPREADSHEET_VIEWER);
  const [documentViewer, setDocumentViewer] = useState(CLOSED_DOCUMENT_VIEWER);
  const [mediaViewer, setMediaViewer] = useState(CLOSED_MEDIA_VIEWER);
  const [embedWebViewer, setEmbedWebViewer] = useState(CLOSED_WEB_VIEWER);
  const [notice, setNotice] = useState(null);

  const showNotice = useCallback((title, message, extras = {}) => {
    setNotice({ title, message, ...extras });
  }, []);

  const openItem = useCallback(async (file) => {
    if (!file) return;

    // 1. Hand the file to the viewer router (spreadsheet → document → media → pdf → web).
    await openFileInMatchingViewer(file, {
      setSpreadsheetViewer,
      setDocumentViewer,
      setMediaViewer,
      setPdfViewer,
      setEmbedWebViewer,
    });
  }, []);

  const markRead = useCallback(
    async (item) => {
      // 1. Need both the signed-in client and a saved row id.
      if (!clientId) return;
      if (!item) return;
      if (!item.id) return;
      // 2. Write isRead on that notes-and-files row (Firestore letters stay put).
      await markNotesAndFilesItemRead(clientId, item.id);
    },
    [clientId],
  );

  const deleteItem = useCallback(
    async (item) => {
      // 1. Refuse when we cannot target a row.
      if (!clientId) return;
      if (!item) return;
      if (!item.id) return;
      // 2. Delete or show a notice sheet on failure.
      await deleteNotesFileOrWarn(clientId, item, showNotice);
    },
    [clientId, showNotice],
  );

  const shareItem = useCallback(async (item) => {
    // 1. Open the OS share sheet with the file URL (or title-only fallback).
    await shareNotesFile(item);
  }, []);

  const downloadItem = useCallback(
    async (item) => {
      // 1. Open the download URL in the system browser, or warn if missing.
      await downloadNotesFileOrWarn(item, showNotice);
    },
    [showNotice],
  );

  const clearNotice = () => setNotice(null);
  const closePdf = () => setPdfViewer(CLOSED_PDF_VIEWER);
  const closeSpreadsheet = () => setSpreadsheetViewer(CLOSED_SPREADSHEET_VIEWER);
  const closeDocument = () => setDocumentViewer(CLOSED_DOCUMENT_VIEWER);
  const closeMedia = () => setMediaViewer(CLOSED_MEDIA_VIEWER);
  const closeWeb = () => setEmbedWebViewer(CLOSED_WEB_VIEWER);

  return (
    <FilesScreenLayout
      colors={colors}
      isDark={isDark}
      items={items}
      onBack={onBack}
      onUploadPress={onUploadPress}
      openItem={openItem}
      downloadItem={downloadItem}
      shareItem={shareItem}
      deleteItem={deleteItem}
      markRead={markRead}
      pdfViewer={pdfViewer}
      spreadsheetViewer={spreadsheetViewer}
      documentViewer={documentViewer}
      mediaViewer={mediaViewer}
      webViewer={embedWebViewer}
      closePdf={closePdf}
      closeSpreadsheet={closeSpreadsheet}
      closeDocument={closeDocument}
      closeMedia={closeMedia}
      closeWeb={closeWeb}
      notice={notice}
      clearNotice={clearNotice}
    />
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  body: { flex: 1, paddingHorizontal: spacing.md },
});
