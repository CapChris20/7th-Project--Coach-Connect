// Client Files & Notes: my uploads, trainer-shared files, and coaching notes.
// Flow: filter pills → open the matching viewer → mark trainer items read → download / share / delete mine.
// Used by the client app. The parent passes `items` and `clientId`; this screen does not fetch.

import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Linking, Platform, SafeAreaView, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, ChevronRight, Download, FileSpreadsheet, FileText, MessageSquare } from 'lucide-react-native';
import { deleteNotesAndFilesItem, markNotesAndFilesItemRead, resolveTrainerSpreadsheetView, packSpreadsheetRowsHaveContent } from '../../for-both/files-and-notes/saveNotesAndFiles';
import {
  getEmbedViewerUri,
  isImageFile as isNotesImageFile,
  isPdfFile as isNotesPdfFile,
  isVideoFile as isNotesVideoFile,
} from '../../helpers/whichViewerForFile';
import { formatDateShort, getFileTypeFromItem, getFriendlyFileTitle } from '../../helpers/fileSizeAndDateText';
import PdfViewer from '../../for-both/files-and-notes/viewers/PdfViewer';
import SpreadsheetViewer from '../../for-both/files-and-notes/viewers/SpreadsheetViewer';
import DocumentViewer from '../../for-both/files-and-notes/viewers/DocumentViewer';
import PhotoVideoViewer from '../../for-both/files-and-notes/viewers/PhotoVideoViewer';
import WebPageViewer from '../../for-both/files-and-notes/viewers/WebPageViewer';

// ===== NAMED CONSTANTS =====

const ACCENT_PINK = '#FF6B9D';
const ACCENT_CYAN = '#06B6D4';
const ACCENT_PURPLE = '#C084FC';
const ADDED_BY_CLIENT = 'client';
const ADDED_BY_TRAINER = 'trainer';
const NOTE_TYPE = 'note';
const SPREADSHEET_TYPE = 'spreadsheet';
const DOCUMENT_TYPE = 'document';
const FILTER_ALL = 'All Files';
const FILTER_PHOTOS = 'Photos';
const FILTER_DOCUMENTS = 'Documents';
const FILTER_NOTES = 'Notes';
const THUMB_SIZE = 86;
const LONG_PRESS_MS = 380;
const CLOSED_PDF = { visible: false, url: null, name: null };
const CLOSED_SHEET = { visible: false, url: null, name: null, rows: null };
const CLOSED_DOCUMENT = { visible: false, trainerId: null, documentId: null, title: null };
const CLOSED_MEDIA = { visible: false, url: null, kind: 'image', name: null };
const CLOSED_WEB = { visible: false, uri: null, title: null };

const SECTION_META = {
  myFiles: { icon: 'camera', color: ACCENT_PINK, gradient: ['#FF6B9D', '#C084FC'] },
  trainer: { icon: 'folder', color: ACCENT_CYAN, gradient: ['#06B6D4', '#C084FC'] },
  notes: { icon: 'message-circle', color: ACCENT_PURPLE, gradient: ['#C084FC', '#FF6B9D'] },
};

// ===== HELPER FUNCTIONS =====

function screenChrome(isDark) {
  return {
    screenBackground: isDark ? '#0A0A0F' : '#F7F7FA',
    foreground: isDark ? '#FFFFFF' : '#0B0B12',
    muted: isDark ? 'rgba(255,255,255,0.60)' : 'rgba(15,23,42,0.55)',
  };
}

function filesScreenTheme(isDark) {
  if (isDark) {
    return {
      bg: '#0A0A0F',
      card: '#141419',
      glass: 'rgba(255,255,255,0.04)',
      text: '#FFF',
      text70: 'rgba(255,255,255,0.7)',
      text50: 'rgba(255,255,255,0.5)',
      text30: 'rgba(255,255,255,0.3)',
      border: 'rgba(255,255,255,0.08)',
    };
  }
  return {
    bg: '#F7F7FA',
    card: '#FFFFFF',
    glass: 'rgba(0,0,0,0.02)',
    text: '#1A1A2E',
    text70: 'rgba(0,0,0,0.65)',
    text50: 'rgba(0,0,0,0.45)',
    text30: 'rgba(0,0,0,0.25)',
    border: 'rgba(0,0,0,0.06)',
  };
}

function createdAtMillis(item) {
  return new Date(item?.createdAt?.toDate?.() || item?.createdAt || 0);
}

function sortNewestFirst(leftItem, rightItem) {
  return createdAtMillis(rightItem) - createdAtMillis(leftItem);
}

function isClientOwnedFile(item) {
  return (item?.addedBy || ADDED_BY_CLIENT) === ADDED_BY_CLIENT && item?.type !== NOTE_TYPE;
}

function isTrainerSharedFile(item) {
  return item?.addedBy === ADDED_BY_TRAINER || (item?.type === DOCUMENT_TYPE && item?.trainerId);
}

function isTrainerNote(item) {
  return item?.type === NOTE_TYPE && item?.addedBy === ADDED_BY_TRAINER;
}

function splitFilesIntoLists(items) {
  const list = Array.isArray(items) ? items : [];
  return {
    myFiles: list.filter(isClientOwnedFile).sort(sortNewestFirst),
    trainerShared: list.filter(isTrainerSharedFile).sort(sortNewestFirst),
    notes: list.filter(isTrainerNote).sort(sortNewestFirst),
  };
}

function countFilesByKind(items) {
  const list = Array.isArray(items) ? items : [];
  return {
    files: list.filter(isClientOwnedFile).length,
    shared: list.filter(isTrainerSharedFile).length,
    notes: list.filter(isTrainerNote).length,
  };
}

/**
 * A resolved trainer sheet becomes rows-in-app when the pack has cells, else a stored file URL.
 * @param {object} file
 * @param {object|null} resolved
 * @returns {object|null}
 */
function spreadsheetStateFromResolved(file, resolved) {
  if (!resolved) return null;
  const name = file?.title || file?.name || resolved.title || 'Spreadsheet';
  if (packSpreadsheetRowsHaveContent(resolved.rows)) {
    return { visible: true, url: resolved.storageUrl || null, rows: resolved.rows, name };
  }
  if (resolved.storageUrl) {
    return { visible: true, url: resolved.storageUrl, rows: null, name };
  }
  return null;
}

async function openTrainerSpreadsheet(file, setSpreadsheetViewer) {
  try {
    const resolved = await resolveTrainerSpreadsheetView(file.trainerId, file.documentId);
    const nextState = spreadsheetStateFromResolved(file, resolved);
    if (!nextState) {
      Alert.alert('Spreadsheet unavailable', 'Your coach may have removed this spreadsheet.');
      return;
    }
    setSpreadsheetViewer(nextState);
  } catch {
    Alert.alert('Spreadsheet unavailable', 'Could not open this spreadsheet.');
  }
}

/**
 * Returns true when this file is a spreadsheet we handled (URL or trainer resolve).
 * A spreadsheet with neither still falls through to the other viewers.
 */
function tryOpenSpreadsheet(file, setSpreadsheetViewer) {
  if (file?.type !== SPREADSHEET_TYPE) return false;
  if (file.url) {
    setSpreadsheetViewer({
      visible: true,
      url: file.url,
      name: file?.name || file?.title || 'Spreadsheet',
    });
    return true;
  }
  if (file.documentId && file.trainerId) {
    openTrainerSpreadsheet(file, setSpreadsheetViewer);
    return true;
  }
  return false;
}

async function deleteFileOrShowError(clientId, item) {
  try {
    await deleteNotesAndFilesItem(clientId, item);
  } catch (error) {
    Alert.alert('Could not delete', error?.message || 'Please try again.');
  }
}

async function shareFileOrName(item) {
  try {
    const name = item?.name || item?.title || 'File';
    const url = item?.url;
    if (url) await Share.share({ message: `${name}\n${url}` });
    else await Share.share({ message: name });
  } catch {
    // share sheet dismissed
  }
}

async function openFileUrlOrWarn(item) {
  const url = item?.url;
  if (!url) return;
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return;
    }
    Alert.alert('Download not available', 'Could not open this file URL on your device.');
  } catch (error) {
    Alert.alert('Download failed', error?.message || 'Could not open file.');
  }
}

function fileRowTypeLabel(fileType) {
  if (fileType === SPREADSHEET_TYPE) return 'Sheet';
  if (fileType === 'pdf') return 'PDF';
  return 'Doc';
}

function SnapshotThumbs({ files, isDark, theme, onOpen, onDownload, onShare, onDelete }) {
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
              onPress={() => onOpen(file)}
              onLongPress={() => {
                Alert.alert('Your photo', 'Open, download, share, or delete.', [
                  { text: 'Open', onPress: () => onOpen(file) },
                  { text: 'Download', onPress: () => onDownload(file) },
                  { text: 'Share', onPress: () => onShare(file) },
                  { text: 'Delete', style: 'destructive', onPress: () => onDelete(file) },
                  { text: 'Cancel', style: 'cancel' },
                ]);
              }}
              delayLongPress={LONG_PRESS_MS}
            >
              <View style={[styles.thumbWrap, { borderColor: isDark ? 'rgba(255,107,157,0.28)' : 'rgba(255,107,157,0.18)' }]}>
                {thumb ? (
                  <Image source={{ uri: thumb }} style={{ width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 14 }} resizeMode="cover" />
                ) : (
                  <View style={[styles.thumbPlaceholder, { width: THUMB_SIZE, height: THUMB_SIZE, backgroundColor: theme.glass }]}>
                    <Feather name="image" size={22} color={theme.text30} />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <Text style={[styles.thumbHint, { color: theme.text50 }]}>Tap to view &middot; hold for options</Text>
    </View>
  );
}

function FileRow({ file, accent = ACCENT_CYAN, theme, onOpen, onDownload, onShare, onDelete, onMarkRead }) {
  const name = getFriendlyFileTitle(file) || file?.name || file?.title || 'File';
  const fileType = getFileTypeFromItem(file);
  const Icon = fileType === SPREADSHEET_TYPE ? FileSpreadsheet : FileText;
  const typeLabel = fileRowTypeLabel(fileType);
  const when = file?.createdAt ? formatDateShort(file.createdAt?.toDate?.() || file.createdAt) : '';
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={async () => {
        await onMarkRead(file);
        onOpen(file);
      }}
      onLongPress={() => {
        Alert.alert(name, '', [
          { text: 'Open', onPress: () => onOpen(file) },
          { text: 'Download', onPress: () => onDownload(file) },
          { text: 'Share', onPress: () => onShare(file) },
          { text: 'Delete', style: 'destructive', onPress: () => onDelete(file) },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }}
      delayLongPress={LONG_PRESS_MS}
      style={[styles.fileRow, { backgroundColor: theme.card, borderColor: theme.border }]}
    >
      <View style={[styles.fileRowIcon, { backgroundColor: `${accent}12` }]}>
        <Icon size={20} color={accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.fileRowName, { color: theme.text }]} numberOfLines={1}>{name}</Text>
        <Text style={[styles.fileRowMeta, { color: theme.text50 }]} numberOfLines={1}>
          {typeLabel}{when ? ` \u00B7 ${when}` : ''}
        </Text>
      </View>
      <TouchableOpacity onPress={() => onDownload(file)} hitSlop={12} style={[styles.fileRowDl, { borderColor: `${accent}30`, backgroundColor: `${accent}08` }]} activeOpacity={0.8}>
        <Download size={16} color={accent} />
      </TouchableOpacity>
      <ChevronRight size={16} color={theme.text30} style={{ marginLeft: 2 }} />
    </TouchableOpacity>
  );
}

function NoteCard({ note, theme, isDark, onMarkRead }) {
  const coach = note?.coach || note?.fromName || 'Coach';
  const preview = String(note?.content || note?.preview || '').trim();
  const when = note?.createdAt ? formatDateShort(note.createdAt?.toDate?.() || note.createdAt) : null;
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={async () => {
        await onMarkRead(note);
        Alert.alert(`Note from ${coach}`, preview || '\u2014');
      }}
      style={[styles.noteCard, { backgroundColor: theme.card, borderColor: isDark ? 'rgba(192,132,252,0.15)' : 'rgba(192,132,252,0.10)' }]}
    >
      <View style={styles.noteHeader}>
        <View style={styles.noteIconWrap}>
          <MessageSquare size={16} color={ACCENT_PURPLE} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.noteLabel, { color: theme.text }]} numberOfLines={1}>{coach}</Text>
          <Text style={[styles.noteMeta, { color: theme.text50 }]}>Coaching note{when ? ` \u00B7 ${when}` : ''}</Text>
        </View>
      </View>
      <Text style={[styles.notePreview, { color: theme.text70 }]} numberOfLines={3}>{preview || '\u2014'}</Text>
      <View style={styles.noteFooter}>
        <Text style={styles.noteFooterText}>Read full note</Text>
        <ArrowRight size={13} color={ACCENT_PINK} />
      </View>
    </TouchableOpacity>
  );
}

function SectionBlock({ sectionKey, title, children, count, theme }) {
  const meta = SECTION_META[sectionKey];
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <LinearGradient colors={meta.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sectionAccent} />
        <View style={[styles.sectionIconWrap, { backgroundColor: `${meta.color}14` }]}>
          <Feather name={meta.icon} size={14} color={meta.color} />
        </View>
        <Text style={[styles.sectionTitle, { color: theme.text50 }]}>{title}</Text>
        {count != null && (
          <View style={[styles.sectionBadge, { backgroundColor: `${meta.color}18` }]}>
            <Text style={[styles.sectionBadgeText, { color: meta.color }]}>{count}</Text>
          </View>
        )}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function EmptyCard({ icon, color, title, subtitle, showUpload, isDark, theme, onUploadPress }) {
  return (
    <View style={[styles.emptyCard, { borderColor: `${color}${isDark ? '18' : '14'}`, backgroundColor: `${color}06` }]}>
      <View style={[styles.emptyIconWrap, { backgroundColor: `${color}14` }]}>
        <Feather name={icon} size={24} color={color} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.emptySub, { color: theme.text50 }]}>{subtitle}</Text>
      {showUpload && typeof onUploadPress === 'function' && (
        <TouchableOpacity activeOpacity={0.85} onPress={onUploadPress}>
          <LinearGradient colors={[ACCENT_PINK, '#F97316']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.emptyCta}>
            <Feather name="plus" size={14} color="#fff" />
            <Text style={styles.emptyCtaText}>Upload file</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

function FilesScreenLayout({
  FILTERS,
  FILTER_LABELS,
  chrome,
  confirmDelete,
  documentViewer,
  downloadItem,
  embedWebViewer,
  filter,
  isDark,
  lists,
  markRead,
  mediaViewer,
  nonPhotoMyFiles,
  onBack,
  onUploadPress,
  openItem,
  pdfViewer,
  photos,
  setDocumentViewer,
  setEmbedWebViewer,
  setFilter,
  setMediaViewer,
  setPdfViewer,
  setSpreadsheetViewer,
  shareItem,
  showDocs,
  showNotes,
  showPhotos,
  spreadsheetViewer,
  theme,
  totalCount,
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: chrome.screenBackground }}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onBack} style={[styles.headerBtn, { backgroundColor: theme.glass }]} hitSlop={12}>
          <Feather name="chevron-left" size={20} color={chrome.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: chrome.foreground }]}>Files & Notes</Text>
          <Text style={[styles.headerSub, { color: chrome.muted }]}>
            {totalCount.files} files &middot; {totalCount.shared} shared &middot; {totalCount.notes} notes
          </Text>
        </View>
        <TouchableOpacity
          onPress={typeof onUploadPress === 'function' ? onUploadPress : undefined}
          style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,107,157,0.10)' : 'rgba(255,107,157,0.07)' }]}
          hitSlop={12}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={20} color={ACCENT_PINK} />
        </TouchableOpacity>
      </View>

      <View style={[styles.pillBar, { backgroundColor: chrome.screenBackground, borderBottomColor: theme.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillScroll}>
          {FILTERS.map((filterName) => {
            const isActive = filter === filterName;
            return (
              <TouchableOpacity key={filterName} onPress={() => setFilter(filterName)} activeOpacity={0.85}>
                {isActive ? (
                  <LinearGradient colors={[ACCENT_PURPLE, ACCENT_PINK, '#F97316']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pillActive}>
                    <Text style={styles.pillActiveText}>{FILTER_LABELS[filterName]}</Text>
                  </LinearGradient>
                ) : (
                  <LinearGradient colors={['rgba(192,132,252,0.30)', 'rgba(255,107,157,0.20)', 'rgba(249,115,22,0.15)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pillIdleRing}>
                    <View style={[styles.pillIdleInner, { backgroundColor: theme.bg }]}>
                      <Text style={[styles.pillIdleText, { color: theme.text50 }]}>{FILTER_LABELS[filterName]}</Text>
                    </View>
                  </LinearGradient>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {showDocs && (lists.trainerShared || []).length > 0 && (
          <SectionBlock sectionKey="trainer" title="FROM YOUR COACH" count={lists.trainerShared.length} theme={theme}>
            <View style={{ gap: 8 }}>
              {lists.trainerShared.map((file) => (
                <FileRow
                  key={file.id || file.url || file.name}
                  file={file}
                  accent={ACCENT_CYAN}
                  theme={theme}
                  onOpen={openItem}
                  onDownload={downloadItem}
                  onShare={shareItem}
                  onDelete={confirmDelete}
                  onMarkRead={markRead}
                />
              ))}
            </View>
          </SectionBlock>
        )}

        {showPhotos && (
          <SectionBlock sectionKey="myFiles" title="MY FILES" count={lists.myFiles?.length || 0} theme={theme}>
            {photos.length > 0 && (
              <SnapshotThumbs
                files={photos}
                isDark={isDark}
                theme={theme}
                onOpen={openItem}
                onDownload={downloadItem}
                onShare={shareItem}
                onDelete={confirmDelete}
              />
            )}

            {nonPhotoMyFiles.length > 0 && (
              <View style={{ gap: 8, marginTop: photos.length > 0 ? 10 : 0 }}>
                {nonPhotoMyFiles.map((file) => (
                  <FileRow
                    key={file.id || file.url || file.name}
                    file={file}
                    accent={ACCENT_PINK}
                    theme={theme}
                    onOpen={openItem}
                    onDownload={downloadItem}
                    onShare={shareItem}
                    onDelete={confirmDelete}
                    onMarkRead={markRead}
                  />
                ))}
              </View>
            )}

            {(lists.myFiles || []).length === 0 && (
              <EmptyCard
                icon="upload-cloud"
                color={ACCENT_PINK}
                title="Share your progress"
                subtitle="Upload photos, documents, or spreadsheets using the + button above."
                isDark={isDark}
                theme={theme}
                onUploadPress={onUploadPress}
              />
            )}
          </SectionBlock>
        )}

        {showNotes && (lists.notes || []).length > 0 && (
          <SectionBlock sectionKey="notes" title="COACHING NOTES" count={lists.notes.length} theme={theme}>
            <View style={{ gap: 10 }}>
              {lists.notes.map((note) => (
                <NoteCard
                  key={note.id || note.createdAt || Math.random()}
                  note={note}
                  theme={theme}
                  isDark={isDark}
                  onMarkRead={markRead}
                />
              ))}
            </View>
          </SectionBlock>
        )}

        {(lists.trainerShared || []).length === 0 && (lists.myFiles || []).length === 0 && (lists.notes || []).length === 0 && (
          <View style={styles.totallyEmpty}>
            <Feather name="folder" size={44} color="rgba(255,255,255,0.2)" />
            <Text style={styles.totallyEmptyTitle}>Files and documents will appear here</Text>
            <Text style={styles.totallyEmptySubtext}>Uploads, coach documents, and notes all in one place</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <PdfViewer visible={pdfViewer.visible} url={pdfViewer.url} name={pdfViewer.name} isDark={isDark} onClose={() => setPdfViewer(CLOSED_PDF)} />
      <SpreadsheetViewer visible={spreadsheetViewer.visible} url={spreadsheetViewer.url} rows={spreadsheetViewer.rows} name={spreadsheetViewer.name} isDark={isDark} onClose={() => setSpreadsheetViewer(CLOSED_SHEET)} />
      <DocumentViewer visible={documentViewer.visible} trainerId={documentViewer.trainerId} documentId={documentViewer.documentId} title={documentViewer.title} isDark={isDark} onClose={() => setDocumentViewer(CLOSED_DOCUMENT)} />
      <PhotoVideoViewer visible={mediaViewer.visible} url={mediaViewer.url} kind={mediaViewer.kind} name={mediaViewer.name} isDark={isDark} onClose={() => setMediaViewer(CLOSED_MEDIA)} />
      <WebPageViewer visible={embedWebViewer.visible} uri={embedWebViewer.uri} title={embedWebViewer.title} isDark={isDark} onClose={() => setEmbedWebViewer(CLOSED_WEB)} />
    </SafeAreaView>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Client files screen: my files, trainer-shared files, and coaching notes.
 * @param {{ clientId: string, items: Array, isDark?: boolean, onBack: Function, onUploadPress?: Function }} props
 */
export default function FilesScreen({ clientId, items, isDark = true, onBack, onUploadPress }) {
  const [pdfViewer, setPdfViewer] = useState(CLOSED_PDF);
  const [spreadsheetViewer, setSpreadsheetViewer] = useState(CLOSED_SHEET);
  const [documentViewer, setDocumentViewer] = useState(CLOSED_DOCUMENT);
  const [mediaViewer, setMediaViewer] = useState(CLOSED_MEDIA);
  const [embedWebViewer, setEmbedWebViewer] = useState(CLOSED_WEB);

  const chrome = screenChrome(isDark);

  const theme = useMemo(() => filesScreenTheme(isDark), [isDark]);

  const FILTERS = useMemo(() => [FILTER_ALL, FILTER_PHOTOS, FILTER_DOCUMENTS, FILTER_NOTES], []);
  const [filter, setFilter] = useState(FILTER_ALL);

  const FILTER_LABELS = useMemo(
    () => ({ [FILTER_ALL]: 'All', [FILTER_PHOTOS]: 'Photos', [FILTER_DOCUMENTS]: 'Docs', [FILTER_NOTES]: 'Notes' }),
    [],
  );

  const openItem = useCallback((file) => {
    if (!file) return;

    // 1. Spreadsheets: a direct URL, or a trainer-owned sheet we resolve first.
    if (tryOpenSpreadsheet(file, setSpreadsheetViewer)) return;

    // 2. Trainer-authored documents open in the in-app document viewer.
    if (file?.type === DOCUMENT_TYPE || (file?.documentId && file?.trainerId)) {
      setDocumentViewer({
        visible: true,
        trainerId: file.trainerId,
        documentId: file.documentId,
        title: file.title || file.name || 'Document',
      });
      return;
    }

    // 3. Photos and videos use the media viewer.
    if (file?.url && isNotesImageFile(file)) {
      setMediaViewer({ visible: true, url: file.url, kind: 'image', name: file?.name || file?.title || 'Photo' });
      return;
    }
    if (file?.url && isNotesVideoFile(file)) {
      setMediaViewer({ visible: true, url: file.url, kind: 'video', name: file?.name || file?.title || 'Video' });
      return;
    }

    // 4. PDFs get the PDF viewer; anything else with a URL opens in the web embed.
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

  const lists = useMemo(() => splitFilesIntoLists(items), [items]);

  const showPhotos = filter === FILTER_ALL || filter === FILTER_PHOTOS;
  const showDocs = filter === FILTER_ALL || filter === FILTER_DOCUMENTS;
  const showNotes = filter === FILTER_ALL || filter === FILTER_NOTES;

  const photos = useMemo(() => (lists.myFiles || []).filter((file) => isNotesImageFile(file)), [lists.myFiles]);
  const nonPhotoMyFiles = useMemo(() => (lists.myFiles || []).filter((file) => !isNotesImageFile(file)), [lists.myFiles]);

  const markRead = useCallback(async (item) => {
    if (!clientId || !item?.id) return;
    await markNotesAndFilesItemRead(clientId, item.id);
  }, [clientId]);

  const confirmDelete = useCallback((item) => {
    if (!clientId || !item?.id) return;
    Alert.alert('Delete file?', 'This will remove it from your files.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteFileOrShowError(clientId, item) },
    ]);
  }, [clientId]);

  const shareItem = useCallback(async (item) => {
    await shareFileOrName(item);
  }, []);

  const downloadItem = useCallback(async (item) => {
    await openFileUrlOrWarn(item);
  }, []);

  const totalCount = useMemo(() => countFilesByKind(items), [items]);

  const screenLayout = {
    FILTERS,
    FILTER_LABELS,
    chrome,
    confirmDelete,
    documentViewer,
    downloadItem,
    embedWebViewer,
    filter,
    isDark,
    lists,
    markRead,
    mediaViewer,
    nonPhotoMyFiles,
    onBack,
    onUploadPress,
    openItem,
    pdfViewer,
    photos,
    setDocumentViewer,
    setEmbedWebViewer,
    setFilter,
    setMediaViewer,
    setPdfViewer,
    setSpreadsheetViewer,
    shareItem,
    showDocs,
    showNotes,
    showPhotos,
    spreadsheetViewer,
    theme,
    totalCount,
  };
  return <FilesScreenLayout {...screenLayout} />;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  headerBtn: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  headerSub: { fontSize: 11, fontWeight: '700', marginTop: 1 },

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

  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  section: { marginBottom: 24 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  sectionAccent: { width: 3, height: 16, borderRadius: 2 },
  sectionIconWrap: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4, flex: 1 },
  sectionBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  sectionBadgeText: { fontSize: 11, fontWeight: '800' },
  sectionBody: { gap: 0 },

  thumbWrap: { borderRadius: 16, borderWidth: 2, overflow: 'hidden' },
  thumbPlaceholder: { borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  thumbHint: { fontSize: 11, fontWeight: '600', marginTop: 8 },

  fileRow: {
    flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, borderWidth: 1, gap: 12,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 1 } }),
  },
  fileRowIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  fileRowName: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  fileRowMeta: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  fileRowDl: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

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

  emptyCard: { borderWidth: 1, borderRadius: 18, borderStyle: 'dashed', paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center', gap: 10 },
  emptyIconWrap: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  emptyTitle: { fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  emptySub: { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 19, maxWidth: 260 },
  emptyCta: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginTop: 6 },
  emptyCtaText: { fontSize: 13, fontWeight: '800', color: '#fff' },

  totallyEmpty: { paddingVertical: 60, alignItems: 'center', justifyContent: 'center', gap: 10 },
  totallyEmptyTitle: { fontSize: 15, fontWeight: '800', color: 'rgba(255,255,255,0.5)', letterSpacing: -0.2 },
  totallyEmptySubtext: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.3)', textAlign: 'center', maxWidth: 260 },
});
