import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Linking, SafeAreaView, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { MyFilesSection } from '../components/files/MyFilesSection';
import { TrainerSharedSection } from '../components/files/TrainerSharedSection';
import { NotesFromTrainerSection } from '../components/files/NotesFromTrainerSection';
import { deleteNotesAndFilesItem, markNotesAndFilesItemRead } from '../../shared/services/notesAndFilesService';
import {
  getEmbedViewerUri,
  isImageFile as isNotesImageFile,
  isPdfFile as isNotesPdfFile,
  isVideoFile as isNotesVideoFile,
} from '../../shared/utils/notesFileView';
import PdfViewerModal from '../../shared/components/PdfViewerModal';
import SpreadsheetViewerModal from '../../shared/components/SpreadsheetViewerModal';
import DocumentViewerModal from '../../shared/components/DocumentViewerModal';
import MediaViewerModal from '../../shared/components/MediaViewerModal';
import EmbedWebViewModal from '../../shared/components/EmbedWebViewModal';

export default function ClientFilesScreen({ clientId, items, isDark = true, onBack }) {
  const [pdfViewer, setPdfViewer] = useState({ visible: false, url: null, name: null });
  const [spreadsheetViewer, setSpreadsheetViewer] = useState({ visible: false, url: null, name: null });
  const [documentViewer, setDocumentViewer] = useState({ visible: false, trainerId: null, documentId: null, title: null });
  const [mediaViewer, setMediaViewer] = useState({ visible: false, url: null, kind: 'image', name: null });
  const [embedWebViewer, setEmbedWebViewer] = useState({ visible: false, uri: null, title: null });

  const bg = isDark ? '#0A0A0F' : '#F7F7FA';
  const fg = isDark ? '#FFFFFF' : '#0B0B12';
  const muted = isDark ? 'rgba(255,255,255,0.60)' : 'rgba(15,23,42,0.55)';

  const openItem = useCallback((file) => {
    if (!file) return;
    if (file?.type === 'spreadsheet' && file.url) {
      setSpreadsheetViewer({ visible: true, url: file.url, name: file?.name || 'Spreadsheet' });
      return;
    }
    if (file?.type === 'document' || (file?.documentId && file?.trainerId)) {
      setDocumentViewer({
        visible: true,
        trainerId: file.trainerId,
        documentId: file.documentId,
        title: file.title || file.name || 'Document',
      });
      return;
    }
    if (file?.url && isNotesImageFile(file)) {
      setMediaViewer({ visible: true, url: file.url, kind: 'image', name: file?.name || file?.title || 'Photo' });
      return;
    }
    if (file?.url && isNotesVideoFile(file)) {
      setMediaViewer({ visible: true, url: file.url, kind: 'video', name: file?.name || file?.title || 'Video' });
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

  const markRead = useCallback(async (item) => {
    if (!clientId || !item?.id) return;
    await markNotesAndFilesItemRead(clientId, item.id);
  }, [clientId]);

  const confirmDelete = useCallback((item) => {
    if (!clientId || !item?.id) return;
    Alert.alert('Delete file?', 'This will remove it from your files.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteNotesAndFilesItem(clientId, item);
          } catch (e) {
            Alert.alert('Could not delete', e?.message || 'Please try again.');
          }
        },
      },
    ]);
  }, [clientId]);

  const shareItem = useCallback(async (item) => {
    try {
      const name = item?.name || item?.title || 'File';
      const url = item?.url;
      if (url) {
        await Share.share({ message: `${name}\n${url}` });
      } else {
        await Share.share({ message: name });
      }
    } catch (_) {
      // ignore
    }
  }, []);

  const downloadItem = useCallback(async (item) => {
    const url = item?.url;
    if (!url) return;
    try {
      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
        return;
      }
      Alert.alert('Download not available', 'Could not open this file URL on your device.');
    } catch (e) {
      Alert.alert('Download failed', e?.message || 'Could not open file.');
    }
  }, []);

  const titleCounts = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    const myFilesCount = list.filter((x) => (x?.addedBy || 'client') === 'client' && x?.type !== 'note').length;
    const trainerCount = list.filter((x) => x?.addedBy === 'trainer' || (x?.type === 'document' && x?.trainerId)).length;
    const notesCount = list.filter((x) => x?.type === 'note' && x?.addedBy === 'trainer').length;
    return { myFilesCount, trainerCount, notesCount };
  }, [items]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <View
        style={{
          paddingHorizontal: 14,
          paddingTop: 8,
          paddingBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottomWidth: 1,
          borderBottomColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
        }}
      >
        <TouchableOpacity onPress={onBack} style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }} hitSlop={12}>
          <Feather name="chevron-left" size={20} color={fg} />
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 8 }}>
          <Text style={{ color: fg, fontWeight: '900', fontSize: 16, letterSpacing: -0.2 }}>Files & Notes</Text>
          <Text style={{ color: muted, fontWeight: '700', fontSize: 12 }}>
            {titleCounts.myFilesCount} files • {titleCounts.trainerCount} shared • {titleCounts.notesCount} notes
          </Text>
        </View>

        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <MyFilesSection
          clientId={clientId}
          items={items}
          isDark={isDark}
          onOpenItem={openItem}
          onDeleteItem={confirmDelete}
          onShareItem={shareItem}
          onDownloadItem={downloadItem}
        />
        <TrainerSharedSection
          items={items}
          isDark={isDark}
          onOpenItem={openItem}
          onDownloadItem={downloadItem}
          onMarkRead={markRead}
        />
        <NotesFromTrainerSection
          items={items}
          isDark={isDark}
          onMarkRead={markRead}
        />
      </ScrollView>

      <PdfViewerModal
        visible={pdfViewer.visible}
        url={pdfViewer.url}
        name={pdfViewer.name}
        isDark={isDark}
        onClose={() => setPdfViewer({ visible: false, url: null, name: null })}
      />
      <SpreadsheetViewerModal
        visible={spreadsheetViewer.visible}
        url={spreadsheetViewer.url}
        name={spreadsheetViewer.name}
        isDark={isDark}
        onClose={() => setSpreadsheetViewer({ visible: false, url: null, name: null })}
      />
      <DocumentViewerModal
        visible={documentViewer.visible}
        trainerId={documentViewer.trainerId}
        documentId={documentViewer.documentId}
        title={documentViewer.title}
        isDark={isDark}
        onClose={() => setDocumentViewer({ visible: false, trainerId: null, documentId: null, title: null })}
      />
      <MediaViewerModal
        visible={mediaViewer.visible}
        url={mediaViewer.url}
        kind={mediaViewer.kind}
        name={mediaViewer.name}
        isDark={isDark}
        onClose={() => setMediaViewer({ visible: false, url: null, kind: 'image', name: null })}
      />
      <EmbedWebViewModal
        visible={embedWebViewer.visible}
        uri={embedWebViewer.uri}
        title={embedWebViewer.title}
        isDark={isDark}
        onClose={() => setEmbedWebViewer({ visible: false, uri: null, title: null })}
      />
    </SafeAreaView>
  );
}

