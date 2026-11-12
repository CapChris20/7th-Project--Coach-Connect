// Design Law client Files & Notes full screen — NbPageHeader + FilesSection grid + viewers.
// Flow: open matching viewer → mark trainer items read → download / share / delete mine.
// Used by the client app. Parent passes `items` and `clientId`; this screen does not fetch.
//
// vocab: FilesSection owns NbSegmented + HardShadow 2-col cards (PNG 01); shell SafeArea is left/right only

import React, { useCallback, useState } from 'react';
import { Alert, Linking, Platform, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  deleteNotesAndFilesItem,
  markNotesAndFilesItemRead,
  resolveTrainerSpreadsheetView,
  packSpreadsheetRowsHaveContent,
} from '../../for-both/files-and-notes/saveNotesAndFiles';
import {
  getEmbedViewerUri,
  isImageFile as isNotesImageFile,
  isPdfFile as isNotesPdfFile,
  isVideoFile as isNotesVideoFile,
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

// ===== NAMED CONSTANTS =====

const DOCUMENT_TYPE = 'document';
const SPREADSHEET_TYPE = 'spreadsheet';
const CLOSED_PDF = { visible: false, url: null, name: null };
const CLOSED_SHEET = { visible: false, url: null, name: null, rows: null };
const CLOSED_DOCUMENT = { visible: false, trainerId: null, documentId: null, title: null };
const CLOSED_MEDIA = { visible: false, url: null, kind: 'image', name: null };
const CLOSED_WEB = { visible: false, uri: null, title: null };

// ===== HELPER FUNCTIONS =====

async function tryOpenSpreadsheet(file, setSpreadsheetViewer) {
  if (!file) return false;
  if (file?.url && (file?.type === SPREADSHEET_TYPE || String(file?.name || '').match(/\.(xlsx|csv)$/i))) {
    setSpreadsheetViewer({
      visible: true,
      url: file.url,
      name: file?.name || file?.title || 'Spreadsheet',
      rows: null,
    });
    return true;
  }
  if (file?.type === SPREADSHEET_TYPE && file?.trainerId && file?.documentId) {
    try {
      const resolved = await resolveTrainerSpreadsheetView(file.trainerId, file.documentId);
      if (resolved?.url || packSpreadsheetRowsHaveContent(resolved?.rows)) {
        setSpreadsheetViewer({
          visible: true,
          url: resolved.url || null,
          rows: resolved.rows || null,
          name: file?.name || file?.title || 'Spreadsheet',
        });
        return true;
      }
    } catch (_e) {
      /* fall through */
    }
  }
  return false;
}

async function shareFileOrName(item) {
  const url = item?.url;
  const title = item?.name || item?.title || 'File';
  try {
    if (url) await Share.share({ url, message: Platform.OS === 'android' ? url : undefined, title });
    else await Share.share({ message: title, title });
  } catch (_e) {
    /* user dismissed share sheet */
  }
}

async function openFileUrlOrWarn(item) {
  const url = item?.url;
  if (!url) {
    Alert.alert('Download', 'No download link for this file.');
    return;
  }
  try {
    await Linking.openURL(url);
  } catch (_e) {
    Alert.alert('Download failed', 'Could not open this file.');
  }
}

async function deleteFileOrShowError(clientId, item) {
  try {
    await deleteNotesAndFilesItem(clientId, item.id);
  } catch (error) {
    Alert.alert('Delete failed', error?.message || 'Try again.');
  }
}

// ===== MAIN FUNCTION =====

/**
 * Client files screen: my files, trainer-shared files, and coaching notes.
 * @param {{ clientId: string, items: Array, isDark?: boolean, onBack: Function, onUploadPress?: Function }} props
 */
export default function FilesScreen({ clientId, items, isDark = true, onBack, onUploadPress }) {
  const { colors } = useTheme();
  const [pdfViewer, setPdfViewer] = useState(CLOSED_PDF);
  const [spreadsheetViewer, setSpreadsheetViewer] = useState(CLOSED_SHEET);
  const [documentViewer, setDocumentViewer] = useState(CLOSED_DOCUMENT);
  const [mediaViewer, setMediaViewer] = useState(CLOSED_MEDIA);
  const [embedWebViewer, setEmbedWebViewer] = useState(CLOSED_WEB);

  const openItem = useCallback(async (file) => {
    if (!file) return;
    if (await tryOpenSpreadsheet(file, setSpreadsheetViewer)) return;

    if (file?.type === DOCUMENT_TYPE || (file?.documentId && file?.trainerId)) {
      setDocumentViewer({
        visible: true,
        trainerId: file.trainerId,
        documentId: file.documentId,
        title: file.title || file.name || 'Document',
      });
      return;
    }

    if (file?.url && isNotesImageFile(file)) {
      setMediaViewer({
        visible: true,
        url: file.url,
        kind: 'image',
        name: file?.name || file?.title || 'Photo',
      });
      return;
    }
    if (file?.url && isNotesVideoFile(file)) {
      setMediaViewer({
        visible: true,
        url: file.url,
        kind: 'video',
        name: file?.name || file?.title || 'Video',
      });
      return;
    }

    if (file?.url && isNotesPdfFile(file, file.url)) {
      setPdfViewer({ visible: true, url: file.url, name: file?.name || 'Document' });
      return;
    }
    if (file?.url) {
      setEmbedWebViewer({
        visible: true,
        uri: getEmbedViewerUri(file, file.url),
        title: file.name || file.title || 'Document',
      });
    }
  }, []);

  const markRead = useCallback(
    async (item) => {
      if (!clientId || !item?.id) return;
      await markNotesAndFilesItemRead(clientId, item.id);
    },
    [clientId],
  );

  const deleteItem = useCallback(
    async (item) => {
      if (!clientId || !item?.id) return;
      await deleteFileOrShowError(clientId, item);
    },
    [clientId],
  );

  const shareItem = useCallback(async (item) => {
    await shareFileOrName(item);
  }, []);

  const downloadItem = useCallback(async (item) => {
    await openFileUrlOrWarn(item);
  }, []);

  return (
    <SafeAreaView
      style={[styles.shell, { backgroundColor: colors.nbBackground }]}
      edges={SHELL_SAFE_AREA_EDGES}
    >
      <NbPageHeader
        title="Your Notes & Files"
        subtitle="Everything shared between you and your coach, all in one place."
        onBack={onBack}
      />

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

      <PdfViewer
        visible={pdfViewer.visible}
        url={pdfViewer.url}
        name={pdfViewer.name}
        isDark={isDark}
        onClose={() => setPdfViewer(CLOSED_PDF)}
      />
      <SpreadsheetViewer
        visible={spreadsheetViewer.visible}
        url={spreadsheetViewer.url}
        rows={spreadsheetViewer.rows}
        name={spreadsheetViewer.name}
        isDark={isDark}
        onClose={() => setSpreadsheetViewer(CLOSED_SHEET)}
      />
      <DocumentViewer
        visible={documentViewer.visible}
        trainerId={documentViewer.trainerId}
        documentId={documentViewer.documentId}
        title={documentViewer.title}
        isDark={isDark}
        onClose={() => setDocumentViewer(CLOSED_DOCUMENT)}
      />
      <PhotoVideoViewer
        visible={mediaViewer.visible}
        url={mediaViewer.url}
        kind={mediaViewer.kind}
        name={mediaViewer.name}
        isDark={isDark}
        onClose={() => setMediaViewer(CLOSED_MEDIA)}
      />
      <WebPageViewer
        visible={embedWebViewer.visible}
        uri={embedWebViewer.uri}
        title={embedWebViewer.title}
        isDark={isDark}
        onClose={() => setEmbedWebViewer(CLOSED_WEB)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  body: { flex: 1, paddingHorizontal: spacing.md },
});
