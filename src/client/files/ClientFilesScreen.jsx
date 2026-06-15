/**
 * Client Files Screen
 *
 * Purpose: UI screen or component: Client Files Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/client
 * Key exports: ClientFilesScreen
 *
 * @file-header
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Linking, Platform, SafeAreaView, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, ChevronRight, Download, FileSpreadsheet, FileText, MessageSquare } from 'lucide-react-native';
import { deleteNotesAndFilesItem, markNotesAndFilesItemRead, resolveTrainerSpreadsheetView, spreadsheetRowsHaveContent } from '../../shared/notes-files/manageNotesAndFiles';
import {
  getEmbedViewerUri,
  isImageFile as isNotesImageFile,
  isPdfFile as isNotesPdfFile,
  isVideoFile as isNotesVideoFile,
} from '../../shared/utils/getFileViewType';
import { formatDateShort, getFileTypeFromItem, getFriendlyFileTitle } from '../../shared/utils/formatFileSize';
import PdfViewerModal from '../../shared/components/notes-files/PdfViewerModal';
import SpreadsheetViewerModal from '../../shared/components/notes-files/SpreadsheetViewerModal';
import DocumentViewerModal from '../../shared/components/notes-files/DocumentViewerModal';
import MediaViewerModal from '../../shared/components/notes-files/MediaViewerModal';
import EmbedWebViewModal from '../../shared/components/notes-files/EmbedWebViewModal';

const ACCENT_PINK = '#FF6B9D';
const ACCENT_CYAN = '#06B6D4';
const ACCENT_PURPLE = '#C084FC';

const SECTION_META = {
  myFiles: { icon: 'camera', color: ACCENT_PINK, gradient: ['#FF6B9D', '#C084FC'] },
  trainer: { icon: 'folder', color: ACCENT_CYAN, gradient: ['#06B6D4', '#C084FC'] },
  notes:   { icon: 'message-circle', color: ACCENT_PURPLE, gradient: ['#C084FC', '#FF6B9D'] },
};

export default function ClientFilesScreen({ clientId, items, isDark = true, onBack, onUploadPress }) {
  const [pdfViewer, setPdfViewer] = useState({ visible: false, url: null, name: null });
  const [spreadsheetViewer, setSpreadsheetViewer] = useState({ visible: false, url: null, name: null, rows: null });
  const [documentViewer, setDocumentViewer] = useState({ visible: false, trainerId: null, documentId: null, title: null });
  const [mediaViewer, setMediaViewer] = useState({ visible: false, url: null, kind: 'image', name: null });
  const [embedWebViewer, setEmbedWebViewer] = useState({ visible: false, uri: null, title: null });

  const bg = isDark ? '#0A0A0F' : '#F7F7FA';
  const fg = isDark ? '#FFFFFF' : '#0B0B12';
  const muted = isDark ? 'rgba(255,255,255,0.60)' : 'rgba(15,23,42,0.55)';

  const t = useMemo(
    () =>
      isDark
        ? { bg: '#0A0A0F', card: '#141419', glass: 'rgba(255,255,255,0.04)', text: '#FFF', text70: 'rgba(255,255,255,0.7)', text50: 'rgba(255,255,255,0.5)', text30: 'rgba(255,255,255,0.3)', border: 'rgba(255,255,255,0.08)' }
        : { bg: '#F7F7FA', card: '#FFFFFF', glass: 'rgba(0,0,0,0.02)', text: '#1A1A2E', text70: 'rgba(0,0,0,0.65)', text50: 'rgba(0,0,0,0.45)', text30: 'rgba(0,0,0,0.25)', border: 'rgba(0,0,0,0.06)' },
    [isDark],
  );

  const FILTERS = useMemo(() => ['All Files', 'Photos', 'Documents', 'Notes'], []);
  const [filter, setFilter] = useState('All Files');

  const FILTER_LABELS = useMemo(
    () => ({ 'All Files': 'All', Photos: 'Photos', Documents: 'Docs', Notes: 'Notes' }),
    [],
  );

  const openItem = useCallback((file) => {
    if (!file) return;
    if (file?.type === 'spreadsheet') {
      if (file.url) {
        setSpreadsheetViewer({ visible: true, url: file.url, name: file?.name || file?.title || 'Spreadsheet' });
        return;
      }
      if (file.documentId && file.trainerId) {
        resolveTrainerSpreadsheetView(file.trainerId, file.documentId)
          .then((res) => {
            if (!res) {
              Alert.alert('Spreadsheet unavailable', 'Your coach may have removed this spreadsheet.');
              return;
            }
            const name = file?.title || file?.name || res.title || 'Spreadsheet';
            if (spreadsheetRowsHaveContent(res.rows)) {
              setSpreadsheetViewer({
                visible: true,
                url: res.storageUrl || null,
                rows: res.rows,
                name,
              });
              return;
            }
            if (res.storageUrl) {
              setSpreadsheetViewer({
                visible: true,
                url: res.storageUrl,
                rows: null,
                name,
              });
              return;
            }
            Alert.alert('Spreadsheet unavailable', 'Your coach may have removed this spreadsheet.');
          })
          .catch(() => Alert.alert('Spreadsheet unavailable', 'Could not open this spreadsheet.'));
        return;
      }
    }
    if (file?.type === 'document' || (file?.documentId && file?.trainerId)) {
      setDocumentViewer({ visible: true, trainerId: file.trainerId, documentId: file.documentId, title: file.title || file.name || 'Document' });
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
      setEmbedWebViewer({ visible: true, uri: getEmbedViewerUri(file, file.url), title: file.name || file.title || 'Document' });
    }
  }, []);

  const lists = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    const srt = (a, b) => new Date(b?.createdAt?.toDate?.() || b?.createdAt || 0) - new Date(a?.createdAt?.toDate?.() || a?.createdAt || 0);
    const myFiles = list.filter((x) => (x?.addedBy || 'client') === 'client' && x?.type !== 'note').sort(srt);
    const trainerShared = list.filter((x) => x?.addedBy === 'trainer' || (x?.type === 'document' && x?.trainerId)).sort(srt);
    const notes = list.filter((x) => x?.type === 'note' && x?.addedBy === 'trainer').sort(srt);
    return { myFiles, trainerShared, notes };
  }, [items]);

  const showPhotos = filter === 'All Files' || filter === 'Photos';
  const showDocs = filter === 'All Files' || filter === 'Documents';
  const showNotes = filter === 'All Files' || filter === 'Notes';

  const photos = useMemo(() => (lists.myFiles || []).filter((f) => isNotesImageFile(f)), [lists.myFiles]);
  const nonPhotoMyFiles = useMemo(() => (lists.myFiles || []).filter((f) => !isNotesImageFile(f)), [lists.myFiles]);

  const THUMB = 86;

  const markRead = useCallback(async (item) => {
    if (!clientId || !item?.id) return;
    await markNotesAndFilesItemRead(clientId, item.id);
  }, [clientId]);

  const confirmDelete = useCallback((item) => {
    if (!clientId || !item?.id) return;
    Alert.alert('Delete file?', 'This will remove it from your files.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteNotesAndFilesItem(clientId, item); } catch (e) { Alert.alert('Could not delete', e?.message || 'Please try again.'); }
      }},
    ]);
  }, [clientId]);

  const shareItem = useCallback(async (item) => {
    try {
      const name = item?.name || item?.title || 'File';
      const url = item?.url;
      if (url) await Share.share({ message: `${name}\n${url}` });
      else await Share.share({ message: name });
    } catch (_) { /* ignore */ }
  }, []);

  const downloadItem = useCallback(async (item) => {
    const url = item?.url;
    if (!url) return;
    try {
      const can = await Linking.canOpenURL(url);
      if (can) { await Linking.openURL(url); return; }
      Alert.alert('Download not available', 'Could not open this file URL on your device.');
    } catch (e) { Alert.alert('Download failed', e?.message || 'Could not open file.'); }
  }, []);

  const totalCount = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    return {
      files: list.filter((x) => (x?.addedBy || 'client') === 'client' && x?.type !== 'note').length,
      shared: list.filter((x) => x?.addedBy === 'trainer' || (x?.type === 'document' && x?.trainerId)).length,
      notes: list.filter((x) => x?.type === 'note' && x?.addedBy === 'trainer').length,
    };
  }, [items]);

  /* ─── inline components ─── */

  function SnapshotThumbs({ files }) {
    if (!files?.length) return null;
    return (
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
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
                <View style={[s.thumbWrap, { borderColor: isDark ? 'rgba(255,107,157,0.28)' : 'rgba(255,107,157,0.18)' }]}>
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={{ width: THUMB, height: THUMB, borderRadius: 14 }} resizeMode="cover" />
                  ) : (
                    <View style={[s.thumbPlaceholder, { width: THUMB, height: THUMB, backgroundColor: t.glass }]}>
                      <Feather name="image" size={22} color={t.text30} />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <Text style={[s.thumbHint, { color: t.text50 }]}>Tap to view &middot; hold for options</Text>
      </View>
    );
  }

  function FileRow({ file, accent = ACCENT_CYAN }) {
    const name = getFriendlyFileTitle(file) || file?.name || file?.title || 'File';
    const fType = getFileTypeFromItem(file);
    const Icon = fType === 'spreadsheet' ? FileSpreadsheet : FileText;
    const typeLabel = fType === 'spreadsheet' ? 'Sheet' : fType === 'pdf' ? 'PDF' : 'Doc';
    const when = file?.createdAt ? formatDateShort(file.createdAt?.toDate?.() || file.createdAt) : '';
    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={async () => { await markRead(file); openItem(file); }}
        onLongPress={() => {
          Alert.alert(name, '', [
            { text: 'Open', onPress: () => openItem(file) },
            { text: 'Download', onPress: () => downloadItem(file) },
            { text: 'Share', onPress: () => shareItem(file) },
            { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(file) },
            { text: 'Cancel', style: 'cancel' },
          ]);
        }}
        delayLongPress={380}
        style={[s.fileRow, { backgroundColor: t.card, borderColor: t.border }]}
      >
        <View style={[s.fileRowIcon, { backgroundColor: `${accent}12` }]}>
          <Icon size={20} color={accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.fileRowName, { color: t.text }]} numberOfLines={1}>{name}</Text>
          <Text style={[s.fileRowMeta, { color: t.text50 }]} numberOfLines={1}>
            {typeLabel}{when ? ` \u00B7 ${when}` : ''}
          </Text>
        </View>
        <TouchableOpacity onPress={() => downloadItem(file)} hitSlop={12} style={[s.fileRowDl, { borderColor: `${accent}30`, backgroundColor: `${accent}08` }]} activeOpacity={0.8}>
          <Download size={16} color={accent} />
        </TouchableOpacity>
        <ChevronRight size={16} color={t.text30} style={{ marginLeft: 2 }} />
      </TouchableOpacity>
    );
  }

  function NoteCard({ note }) {
    const coach = note?.coach || note?.fromName || 'Coach';
    const preview = String(note?.content || note?.preview || '').trim();
    const when = note?.createdAt ? formatDateShort(note.createdAt?.toDate?.() || note.createdAt) : null;
    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={async () => { await markRead(note); Alert.alert(`Note from ${coach}`, preview || '\u2014'); }}
        style={[s.noteCard, { backgroundColor: t.card, borderColor: isDark ? 'rgba(192,132,252,0.15)' : 'rgba(192,132,252,0.10)' }]}
      >
        <View style={s.noteHeader}>
          <View style={s.noteIconWrap}>
            <MessageSquare size={16} color={ACCENT_PURPLE} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.noteLabel, { color: t.text }]} numberOfLines={1}>{coach}</Text>
            <Text style={[s.noteMeta, { color: t.text50 }]}>Coaching note{when ? ` \u00B7 ${when}` : ''}</Text>
          </View>
        </View>
        <Text style={[s.notePreview, { color: t.text70 }]} numberOfLines={3}>{preview || '\u2014'}</Text>
        <View style={s.noteFooter}>
          <Text style={s.noteFooterText}>Read full note</Text>
          <ArrowRight size={13} color={ACCENT_PINK} />
        </View>
      </TouchableOpacity>
    );
  }

  function SectionBlock({ sectionKey, title, children, count }) {
    const meta = SECTION_META[sectionKey];
    return (
      <View style={s.section}>
        <View style={s.sectionHead}>
          <LinearGradient colors={meta.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.sectionAccent} />
          <View style={[s.sectionIconWrap, { backgroundColor: `${meta.color}14` }]}>
            <Feather name={meta.icon} size={14} color={meta.color} />
          </View>
          <Text style={[s.sectionTitle, { color: t.text50 }]}>{title}</Text>
          {count != null && <View style={[s.sectionBadge, { backgroundColor: `${meta.color}18` }]}><Text style={[s.sectionBadgeText, { color: meta.color }]}>{count}</Text></View>}
        </View>
        <View style={s.sectionBody}>{children}</View>
      </View>
    );
  }

  function EmptyCard({ icon, color, title, subtitle, showUpload }) {
    return (
      <View style={[s.emptyCard, { borderColor: `${color}${isDark ? '18' : '14'}`, backgroundColor: `${color}06` }]}>
        <View style={[s.emptyIconWrap, { backgroundColor: `${color}14` }]}>
          <Feather name={icon} size={24} color={color} />
        </View>
        <Text style={[s.emptyTitle, { color: t.text }]}>{title}</Text>
        <Text style={[s.emptySub, { color: t.text50 }]}>{subtitle}</Text>
        {showUpload && typeof onUploadPress === 'function' && (
          <TouchableOpacity activeOpacity={0.85} onPress={onUploadPress}>
            <LinearGradient colors={[ACCENT_PINK, '#F97316']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.emptyCta}>
              <Feather name="plus" size={14} color="#fff" />
              <Text style={s.emptyCtaText}>Upload file</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  /* ─── render ─── */

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      {/* ── HEADER ── */}
      <View style={[s.header, { borderBottomColor: t.border }]}>
        <TouchableOpacity onPress={onBack} style={[s.headerBtn, { backgroundColor: t.glass }]} hitSlop={12}>
          <Feather name="chevron-left" size={20} color={fg} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[s.headerTitle, { color: fg }]}>Files & Notes</Text>
          <Text style={[s.headerSub, { color: muted }]}>
            {totalCount.files} files &middot; {totalCount.shared} shared &middot; {totalCount.notes} notes
          </Text>
        </View>
        <TouchableOpacity
          onPress={typeof onUploadPress === 'function' ? onUploadPress : undefined}
          style={[s.headerBtn, { backgroundColor: isDark ? 'rgba(255,107,157,0.10)' : 'rgba(255,107,157,0.07)' }]}
          hitSlop={12}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={20} color={ACCENT_PINK} />
        </TouchableOpacity>
      </View>

      {/* ── FILTER PILLS ── */}
      <View style={[s.pillBar, { backgroundColor: bg, borderBottomColor: t.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillScroll}>
          {FILTERS.map((f) => {
            const active = filter === f;
            return (
              <TouchableOpacity key={f} onPress={() => setFilter(f)} activeOpacity={0.85}>
                {active ? (
                  <LinearGradient colors={[ACCENT_PURPLE, ACCENT_PINK, '#F97316']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.pillActive}>
                    <Text style={s.pillActiveText}>{FILTER_LABELS[f]}</Text>
                  </LinearGradient>
                ) : (
                  <LinearGradient colors={['rgba(192,132,252,0.30)', 'rgba(255,107,157,0.20)', 'rgba(249,115,22,0.15)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.pillIdleRing}>
                    <View style={[s.pillIdleInner, { backgroundColor: t.bg }]}>
                      <Text style={[s.pillIdleText, { color: t.text50 }]}>{FILTER_LABELS[f]}</Text>
                    </View>
                  </LinearGradient>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── BODY ── */}
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* HERO: FROM YOUR COACH (only shown if has content) */}
        {showDocs && (lists.trainerShared || []).length > 0 && (
          <SectionBlock sectionKey="trainer" title="FROM YOUR COACH" count={lists.trainerShared.length}>
            <View style={{ gap: 8 }}>
              {lists.trainerShared.map((file) => (
                <FileRow key={file.id || file.url || file.name} file={file} accent={ACCENT_CYAN} />
              ))}
            </View>
          </SectionBlock>
        )}

        {/* SECONDARY: MY FILES */}
        {showPhotos && (
          <SectionBlock sectionKey="myFiles" title="MY FILES" count={lists.myFiles?.length || 0}>
            {photos.length > 0 && <SnapshotThumbs files={photos} />}

            {nonPhotoMyFiles.length > 0 && (
              <View style={{ gap: 8, marginTop: photos.length > 0 ? 10 : 0 }}>
                {nonPhotoMyFiles.map((file) => (
                  <FileRow key={file.id || file.url || file.name} file={file} accent={ACCENT_PINK} />
                ))}
              </View>
            )}

            {(lists.myFiles || []).length === 0 && (
              <EmptyCard
                icon="upload-cloud"
                color={ACCENT_PINK}
                title="Share your progress"
                subtitle="Upload photos, documents, or spreadsheets using the + button above."
              />
            )}

          </SectionBlock>
        )}

        {/* TERTIARY: COACHING NOTES (only shown if has content) */}
        {showNotes && (lists.notes || []).length > 0 && (
          <SectionBlock sectionKey="notes" title="COACHING NOTES" count={lists.notes.length}>
            <View style={{ gap: 10 }}>
              {lists.notes.map((note) => (
                <NoteCard key={note.id || note.createdAt || Math.random()} note={note} />
              ))}
            </View>
          </SectionBlock>
        )}

        {/* Totally empty state */}
        {(lists.trainerShared || []).length === 0 && (lists.myFiles || []).length === 0 && (lists.notes || []).length === 0 && (
          <View style={s.totallyEmpty}>
            <Feather name="folder" size={44} color="rgba(255,255,255,0.2)" />
            <Text style={s.totallyEmptyTitle}>Files and documents will appear here</Text>
            <Text style={s.totallyEmptySubtext}>Uploads, coach documents, and notes all in one place</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── MODALS ── */}
      <PdfViewerModal visible={pdfViewer.visible} url={pdfViewer.url} name={pdfViewer.name} isDark={isDark} onClose={() => setPdfViewer({ visible: false, url: null, name: null })} />
      <SpreadsheetViewerModal visible={spreadsheetViewer.visible} url={spreadsheetViewer.url} rows={spreadsheetViewer.rows} name={spreadsheetViewer.name} isDark={isDark} onClose={() => setSpreadsheetViewer({ visible: false, url: null, name: null, rows: null })} />
      <DocumentViewerModal visible={documentViewer.visible} trainerId={documentViewer.trainerId} documentId={documentViewer.documentId} title={documentViewer.title} isDark={isDark} onClose={() => setDocumentViewer({ visible: false, trainerId: null, documentId: null, title: null })} />
      <MediaViewerModal visible={mediaViewer.visible} url={mediaViewer.url} kind={mediaViewer.kind} name={mediaViewer.name} isDark={isDark} onClose={() => setMediaViewer({ visible: false, url: null, kind: 'image', name: null })} />
      <EmbedWebViewModal visible={embedWebViewer.visible} uri={embedWebViewer.uri} title={embedWebViewer.title} isDark={isDark} onClose={() => setEmbedWebViewer({ visible: false, uri: null, title: null })} />
    </SafeAreaView>
  );
}

/* ───────── STYLES ───────── */

const s = StyleSheet.create({
  /* header */
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  headerBtn: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  headerSub: { fontSize: 11, fontWeight: '700', marginTop: 1 },

  /* pills */
  pillBar: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  pillScroll: { paddingHorizontal: 16, gap: 8 },
  pillActive: {
    paddingHorizontal: 20, paddingVertical: 9, borderRadius: 20,
    ...Platform.select({ ios: { shadowColor: ACCENT_PURPLE, shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 6 } }),
  },
  pillActiveText: { fontSize: 13, fontWeight: '800', color: '#FFF', letterSpacing: -0.2 },
  pillIdleRing: { borderRadius: 20, padding: 1.5 },
  pillIdleInner: { paddingHorizontal: 18, paddingVertical: 7.5, borderRadius: 19 },
  pillIdleText: { fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },

  /* scroll body */
  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  /* section wrapper */
  section: { marginBottom: 24 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  sectionAccent: { width: 3, height: 16, borderRadius: 2 },
  sectionIconWrap: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4, flex: 1 },
  sectionBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  sectionBadgeText: { fontSize: 11, fontWeight: '800' },
  sectionBody: { gap: 0 },

  /* snapshot thumbs */
  thumbWrap: { borderRadius: 16, borderWidth: 2, overflow: 'hidden' },
  thumbPlaceholder: { borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  thumbHint: { fontSize: 11, fontWeight: '600', marginTop: 8 },

  /* file row */
  fileRow: {
    flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, borderWidth: 1, gap: 12,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 1 } }),
  },
  fileRowIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  fileRowName: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  fileRowMeta: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  fileRowDl: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  /* note card */
  noteCard: {
    borderRadius: 16, borderWidth: 1, padding: 16,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 1 } }),
  },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  noteIconWrap: { width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(192,132,252,0.12)', alignItems: 'center', justifyContent: 'center' },
  noteLabel: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  noteMeta: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  notePreview: { fontSize: 13, fontWeight: '600', lineHeight: 20, marginBottom: 12 },
  noteFooter: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  noteFooterText: { fontSize: 12, fontWeight: '800', color: ACCENT_PINK },

  /* empty card */
  emptyCard: { borderWidth: 1, borderRadius: 18, borderStyle: 'dashed', paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center', gap: 10 },
  emptyIconWrap: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  emptyTitle: { fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  emptySub: { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 19, maxWidth: 260 },
  emptyCta: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginTop: 6 },
  emptyCtaText: { fontSize: 13, fontWeight: '800', color: '#fff' },

  /* totally empty state */
  totallyEmpty: { paddingVertical: 60, alignItems: 'center', justifyContent: 'center', gap: 10 },
  totallyEmptyTitle: { fontSize: 15, fontWeight: '800', color: 'rgba(255,255,255,0.5)', letterSpacing: -0.2 },
  totallyEmptySubtext: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.3)', textAlign: 'center', maxWidth: 260 },
});
