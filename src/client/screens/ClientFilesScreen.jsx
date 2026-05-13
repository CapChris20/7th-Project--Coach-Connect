import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Linking, SafeAreaView, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, ChevronDown, ChevronRight, Download, FileSpreadsheet, FileText, Folder, MessageSquare, Share2, Upload } from 'lucide-react-native';
import { deleteNotesAndFilesItem, markNotesAndFilesItemRead } from '../../shared/services/notesAndFilesService';
import {
  getEmbedViewerUri,
  isImageFile as isNotesImageFile,
  isPdfFile as isNotesPdfFile,
  isVideoFile as isNotesVideoFile,
} from '../../shared/utils/notesFileView';
import { formatDateShort, getFileTypeFromItem, getFriendlyFileTitle } from '../../shared/utils/fileFormatting';
import PdfViewerModal from '../../shared/components/PdfViewerModal';
import SpreadsheetViewerModal from '../../shared/components/SpreadsheetViewerModal';
import DocumentViewerModal from '../../shared/components/DocumentViewerModal';
import MediaViewerModal from '../../shared/components/MediaViewerModal';
import EmbedWebViewModal from '../../shared/components/EmbedWebViewModal';

export default function ClientFilesScreen({ clientId, items, isDark = true, onBack, onUploadPress }) {
  const [pdfViewer, setPdfViewer] = useState({ visible: false, url: null, name: null });
  const [spreadsheetViewer, setSpreadsheetViewer] = useState({ visible: false, url: null, name: null });
  const [documentViewer, setDocumentViewer] = useState({ visible: false, trainerId: null, documentId: null, title: null });
  const [mediaViewer, setMediaViewer] = useState({ visible: false, url: null, kind: 'image', name: null });
  const [embedWebViewer, setEmbedWebViewer] = useState({ visible: false, uri: null, title: null });

  const bg = isDark ? '#0A0A0F' : '#F7F7FA';
  const fg = isDark ? '#FFFFFF' : '#0B0B12';
  const muted = isDark ? 'rgba(255,255,255,0.60)' : 'rgba(15,23,42,0.55)';

  const theme = useMemo(
    () => ({
      bg: '#0A0A0F',
      card: '#141419',
      text: '#FFFFFF',
      text60: 'rgba(255,255,255,0.6)',
      text40: 'rgba(255,255,255,0.4)',
      border: 'rgba(255,255,255,0.1)',
    }),
    [],
  );

  const GRADIENTS = useMemo(
    () => ({
      myFiles: ['#FF6B9D', '#C084FC'],
      trainer: ['#06B6D4', '#C084FC'],
      notes: ['#C084FC', '#FF6B9D'],
    }),
    [],
  );

  const FILTERS = useMemo(() => ['All Files', 'Photos', 'Documents', 'Notes'], []);
  const [filter, setFilter] = useState('All Files');
  const [docsOpen, setDocsOpen] = useState(true);

  const FILTER_LABELS = useMemo(
    () => ({
      'All Files': 'All Files',
      Photos: 'Snapshots',
      Documents: 'Documents',
      Notes: 'Notes',
    }),
    [],
  );

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

  const lists = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    const myFiles = list
      .filter((x) => (x?.addedBy || 'client') === 'client' && x?.type !== 'note')
      .sort((a, b) => new Date(b?.createdAt?.toDate?.() || b?.createdAt || 0) - new Date(a?.createdAt?.toDate?.() || a?.createdAt || 0));
    const trainerShared = list
      .filter((x) => x?.addedBy === 'trainer' || (x?.type === 'document' && x?.trainerId))
      .sort((a, b) => new Date(b?.createdAt?.toDate?.() || b?.createdAt || 0) - new Date(a?.createdAt?.toDate?.() || a?.createdAt || 0));
    const notes = list
      .filter((x) => x?.type === 'note' && x?.addedBy === 'trainer')
      .sort((a, b) => new Date(b?.createdAt?.toDate?.() || b?.createdAt || 0) - new Date(a?.createdAt?.toDate?.() || a?.createdAt || 0));
    return { myFiles, trainerShared, notes };
  }, [items]);

  const showPhotos = filter === 'All Files' || filter === 'Photos';
  const showDocs = filter === 'All Files' || filter === 'Documents';
  const showNotes = filter === 'All Files' || filter === 'Notes';

  function GradientBorder({ gradient, children, borderRadius = 18, thickness = 3 }) {
    return (
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradientWrapper, { borderRadius, padding: thickness }]}
      >
        <View style={[styles.gradientInner, { borderRadius: borderRadius - thickness, backgroundColor: theme.bg }]}>{children}</View>
      </LinearGradient>
    );
  }

  function SectionHeader({ title }) {
    return (
      <View style={styles.sectionHeaderWrap}>
        <Text style={[styles.sectionHeader, { color: theme.text60 }]}>{title}</Text>
      </View>
    );
  }

  const THUMB = 78;

  function SnapshotThumbs({ files }) {
    if (!files?.length) return null;
    return (
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 2 }}>
          {files.map((file) => {
            const thumb = file?.thumbnailUrl || (isNotesImageFile(file) ? file?.url : null);
            return (
              <TouchableOpacity
                key={file.id || file.url || file.name}
                activeOpacity={0.88}
                onPress={() => openItem(file)}
                onLongPress={() => {
                  Alert.alert('Your photo', 'Open, download, share, or delete.', [
                    { text: 'Open', onPress: () => openItem(file) },
                    { text: 'Download', onPress: () => downloadItem(file) },
                    { text: 'Share', onPress: () => shareItem(file) },
                    { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(file) },
                    { text: 'Cancel', style: 'cancel' },
                  ]);
                }}
                delayLongPress={380}
              >
                <GradientBorder gradient={GRADIENTS.myFiles} borderRadius={14} thickness={2}>
                  <View style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(20,20,25,0.92)' }}>
                    {thumb ? (
                      <Image source={{ uri: thumb }} style={{ width: THUMB, height: THUMB }} resizeMode="cover" />
                    ) : (
                      <View style={[styles.thumbPlaceholder, { width: THUMB, height: THUMB }]}>
                        <Text style={{ color: theme.text40, fontSize: 11, fontWeight: '800' }}>Photo</Text>
                      </View>
                    )}
                  </View>
                </GradientBorder>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <Text style={[styles.thumbHint, { color: theme.text60 }]}>Tap to open · hold for download, share, or delete</Text>
      </View>
    );
  }

  function TrainerDocRow({ file }) {
    const name = getFriendlyFileTitle(file) || file?.name || file?.title || 'File';
    const t = getFileTypeFromItem(file);
    const Icon = t === 'spreadsheet' ? FileSpreadsheet : FileText;
    const typeLabel = t === 'spreadsheet' ? 'Sheet' : t === 'pdf' ? 'PDF' : 'Doc';
    const when = file?.createdAt ? formatDateShort(file.createdAt?.toDate?.() || file.createdAt) : '';
    return (
      <View style={{ marginBottom: 8 }}>
        <View style={[styles.docStrip, { backgroundColor: 'rgba(20,20,25,0.92)', borderColor: 'rgba(6,182,212,0.24)', borderWidth: StyleSheet.hairlineWidth }]}>
          <LinearGradient colors={GRADIENTS.trainer} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.docStripAccent} />
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={async () => {
              await markRead(file);
              openItem(file);
            }}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingLeft: 12, paddingRight: 6, gap: 10 }}
          >
            <View style={styles.docStripIcon}>
              <Icon size={20} color="#06B6D4" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.fileName, { color: theme.text }]} numberOfLines={1}>
                {name}
              </Text>
              <Text style={[styles.docStripMeta, { color: theme.text60 }]} numberOfLines={1}>
                {typeLabel}
                {when ? ` · ${when}` : ''}
              </Text>
            </View>
            <ChevronRight size={18} color={theme.text40} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => downloadItem(file)} hitSlop={12} style={[styles.docStripDl, { marginRight: 8 }]} activeOpacity={0.85}>
            <Download size={17} color="#06B6D4" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function CategoryHeader({ title, count, open, onToggle }) {
    return (
      <View style={styles.categoryHeaderContainer}>
        <GradientBorder gradient={GRADIENTS.trainer} borderRadius={16} thickness={3}>
          <TouchableOpacity onPress={onToggle} style={[styles.categoryHeaderButton, { backgroundColor: 'rgba(20,20,25,0.92)' }]} activeOpacity={0.9}>
            <View style={styles.categoryLeft}>
              <Folder size={20} color="#06B6D4" />
              <View>
                <Text style={[styles.categoryTitle, { color: theme.text }]}>{title}</Text>
                <Text style={[styles.categoryCount, { color: theme.text60 }]}>{count} files</Text>
              </View>
            </View>

            <ChevronDown size={18} color={theme.text60} style={{ transform: [{ rotate: open ? '0deg' : '-90deg' }] }} />
          </TouchableOpacity>
        </GradientBorder>
      </View>
    );
  }

  function NoteCard({ note }) {
    const coach = note?.coach || note?.fromName || 'Coach';
    const preview = String(note?.content || note?.preview || '').trim();
    const when = note?.createdAt ? formatDateShort(note.createdAt?.toDate?.() || note.createdAt) : null;
    return (
      <View style={styles.noteCardContainer}>
        <GradientBorder gradient={GRADIENTS.notes} borderRadius={16} thickness={3}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={async () => {
              await markRead(note);
              Alert.alert('Note from coach', preview || '—');
            }}
            style={[styles.noteCard, { backgroundColor: 'rgba(20,20,25,0.92)' }]}
          >
            <View style={styles.noteHeader}>
              <View style={styles.noteIconWrap}>
                <MessageSquare size={18} color="#C084FC" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.noteLabel, { color: theme.text }]} numberOfLines={1}>
                  {coach}
                </Text>
                <Text style={[styles.noteMeta, { color: theme.text40 }]} numberOfLines={1}>
                  Coaching note{when ? ` • ${when}` : ''}
                </Text>
              </View>
            </View>

            <Text style={[styles.noteText, { color: theme.text60 }]} numberOfLines={3}>
              {preview || '—'}
            </Text>

            <View style={styles.viewFullButton}>
              <Text style={styles.viewFullText}>View full note</Text>
              <ArrowRight size={14} color="#FF6B9D" />
            </View>
          </TouchableOpacity>
        </GradientBorder>
      </View>
    );
  }

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

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
      >
        <View style={[styles.stickyTabsWrap, { backgroundColor: bg }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContent}
          >
            {FILTERS.map((f, idx) => {
              const isActive = filter === f;
              return (
                <TouchableOpacity
                  key={f}
                  onPress={() => setFilter(f)}
                  style={styles.tabBtn}
                  activeOpacity={0.85}
                  hitSlop={12}
                >
                  {isActive ? (
                    <LinearGradient
                      colors={['#FF6B9D', '#F97316']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.tabGradient, { paddingVertical: 10, shadowColor: '#FF6B9D', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 }]}
                    >
                      <Text style={styles.tabTextActive}>{FILTER_LABELS[f] || f}</Text>
                    </LinearGradient>
                  ) : (
                    <Text style={[styles.tabText, { color: theme.text40 }]}>{FILTER_LABELS[f] || f}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.body}>
          {showPhotos && (
            <View style={styles.sectionWrap}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionKicker, { color: theme.text60 }]}>MY SNAPSHOTS</Text>
                <LinearGradient colors={GRADIENTS.myFiles} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sectionUnderline} />
              </View>
              <View style={{ gap: 8 }}>
                {(lists.myFiles || []).filter((f) => isNotesImageFile(f)).length > 0 ? (
                  <SnapshotThumbs files={(lists.myFiles || []).filter((f) => isNotesImageFile(f))} />
                ) : null}
                {(lists.myFiles || []).filter((f) => isNotesImageFile(f)).length === 0 ? (
                  <View style={[styles.emptyCard, { borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,107,157,0.05)' }]}>
                    <View style={styles.emptyIconCircle}>
                      <Share2 size={26} color="rgba(255,255,255,0.75)" />
                    </View>
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>No snapshots yet</Text>
                    <Text style={[styles.emptySubtitle, { color: theme.text60 }]}>
                      Upload progress photos to keep a visual timeline of your wins.
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          )}

          {showDocs && (
            <View style={styles.sectionWrap}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionKicker, { color: theme.text60 }]}>TRAINER SHARED</Text>
                <LinearGradient colors={GRADIENTS.trainer} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sectionUnderline} />
              </View>

              <CategoryHeader
                title="Documents"
                count={(lists.trainerShared || []).length}
                open={docsOpen}
                onToggle={() => setDocsOpen((v) => !v)}
              />
              {docsOpen ? (
                <View style={{ gap: 8 }}>
                  {(lists.trainerShared || []).map((file) => (
                    <TrainerDocRow key={file.id || file.url || file.name} file={file} />
                  ))}
                  {(lists.trainerShared || []).length === 0 ? (
                    <View style={[styles.emptyCard, { borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(6,182,212,0.05)' }]}>
                      <View style={styles.emptyIconCircle}>
                        <FileText size={26} color="rgba(255,255,255,0.75)" />
                      </View>
                      <Text style={[styles.emptyTitle, { color: theme.text }]}>No shared docs yet</Text>
                      <Text style={[styles.emptySubtitle, { color: theme.text60 }]}>
                        When your trainer shares documents, they’ll show up here.
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          )}

          {showNotes && (
            <View style={styles.sectionWrap}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionKicker, { color: theme.text60 }]}>NOTES FROM TRAINER</Text>
                <LinearGradient colors={GRADIENTS.notes} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sectionUnderline} />
              </View>

              {(lists.notes || []).length > 0 ? (
                <View style={{ gap: 10 }}>
                  {(lists.notes || []).map((note) => (
                    <NoteCard key={note.id || note.createdAt || Math.random()} note={note} />
                  ))}
                </View>
              ) : (
                <GradientBorder gradient={GRADIENTS.notes} borderRadius={16} thickness={2}>
                  <View style={[styles.notesEmpty, { backgroundColor: 'rgba(192,132,252,0.05)' }]}>
                    <MessageSquare size={32} color="#C084FC" />
                    <Text style={[styles.notesEmptyTitle, { color: theme.text }]}>No notes yet</Text>
                    <Text style={[styles.notesEmptySub, { color: theme.text60 }]}>
                      Your trainer will share coaching notes here.
                    </Text>
                  </View>
                </GradientBorder>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <TouchableOpacity
        activeOpacity={0.92}
        onPress={typeof onUploadPress === 'function' ? onUploadPress : undefined}
        style={[styles.fab, typeof onUploadPress === 'function' ? null : { opacity: 0.45 }]}
        hitSlop={10}
      >
        <LinearGradient colors={['#FF6B9D', '#F97316']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabGrad}>
          <Upload size={22} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>

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

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 112 },
  stickyTabsWrap: { paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  tabsShell: {
    marginHorizontal: 16,
  },
  tabsContent: { paddingHorizontal: 0, paddingVertical: 0, gap: 18 },
  tabsUnderline: { display: 'none' },
  tabBtn: { borderRadius: 12, overflow: 'hidden', paddingVertical: 6, paddingHorizontal: 16 },
  tabBtnActive: {},
  tabBtnInactive: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  tabGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: { fontSize: 13, fontWeight: '800', letterSpacing: -0.2 },
  tabTextActive: { fontSize: 13, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.2 },

  body: { paddingHorizontal: 16, paddingTop: 18, gap: 24 },
  sectionWrap: { gap: 12 },
  sectionHeaderWrap: { marginTop: 0 },
  sectionHeaderRow: { gap: 8 },
  sectionKicker: { fontSize: 11, fontWeight: '900', letterSpacing: 1.6 },
  sectionUnderline: { height: 2, width: 120, borderRadius: 2, opacity: 0.95 },
  sectionHeader: { fontSize: 11, fontWeight: '900', letterSpacing: 1.6 },

  gradientWrapper: {},
  gradientInner: { overflow: 'hidden' },

  thumbHint: { fontSize: 11, fontWeight: '600', marginTop: 6, marginBottom: 2 },
  thumbPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  docStrip: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, overflow: 'hidden' },
  docStripAccent: { width: 4, alignSelf: 'stretch' },
  docStripIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(6,182,212,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  docStripMeta: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  docStripDl: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.28)',
    backgroundColor: 'rgba(6,182,212,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  fileName: { fontSize: 14, fontWeight: '900', letterSpacing: -0.2 },

  categoryHeaderContainer: { marginHorizontal: 0, marginBottom: 0 },
  categoryHeaderButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 50,
    paddingHorizontal: 16,
  },
  categoryLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  categoryTitle: { fontSize: 14, fontWeight: '900', letterSpacing: -0.2 },
  categoryCount: { fontSize: 12, marginTop: 2, fontWeight: '700' },

  noteCardContainer: { marginHorizontal: 0, marginBottom: 0 },
  noteCard: { padding: 14 },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  noteIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: 'rgba(192,132,252,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteLabel: { fontSize: 14, fontWeight: '900', letterSpacing: -0.2 },
  noteMeta: { marginTop: 2, fontSize: 11, fontWeight: '700' },
  noteText: { fontSize: 13, fontWeight: '600', lineHeight: 20, marginBottom: 10 },
  viewFullButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  viewFullText: { fontSize: 12, fontWeight: '800', color: '#FF6B9D' },

  emptyCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 10,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '900', letterSpacing: -0.2 },
  emptySubtitle: { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 18 },

  notesEmpty: { paddingVertical: 18, paddingHorizontal: 18, alignItems: 'center', gap: 8 },
  notesEmptyTitle: { fontSize: 15, fontWeight: '900', letterSpacing: -0.2, marginTop: 2 },
  notesEmptySub: { fontSize: 12, fontWeight: '600', textAlign: 'center', lineHeight: 17, marginTop: 2 },

  fab: { position: 'absolute', right: 18, bottom: 18, width: 56, height: 56, borderRadius: 28, elevation: 6 },
  fabGrad: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
});

