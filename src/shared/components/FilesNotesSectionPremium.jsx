import React, { useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Folder,
  MessageSquare,
} from 'lucide-react-native';
import { formatDateShort, getFileTypeFromItem, getFriendlyFileTitle } from '../utils/fileFormatting';

const COLORS = {
  dark: {
    bg: '#0A0A0F',
    card: '#141419',
    text: '#FFFFFF',
    text60: 'rgba(255,255,255,0.6)',
    text40: 'rgba(255,255,255,0.4)',
    border: 'rgba(255,255,255,0.1)',
  },
  light: {
    bg: '#FFFFFF',
    card: '#F7F7FB',
    text: '#0A0A0F',
    text60: 'rgba(10,10,15,0.6)',
    text40: 'rgba(10,10,15,0.4)',
    border: 'rgba(10,10,15,0.10)',
  },
};

const GRADIENTS = {
  myFiles: ['#FF6B9D', '#C084FC'],
  trainer: ['#06B6D4', '#C084FC'],
  notes: ['#C084FC', '#FF6B9D'],
};

const FILTERS = ['All Files', 'Photos', 'Documents', 'Notes'];

function normalizeGenericTitle(rawTitle, kind) {
  const t = String(rawTitle || '').trim();
  const lower = t.toLowerCase();

  const isGenericPhoto =
    kind === 'image' &&
    (lower === 'progress photo' ||
      lower.startsWith('progress photo') ||
      lower === 'photo' ||
      lower.startsWith('photo'));

  const isGenericDoc =
    (kind === 'document' || kind === 'pdf' || kind === 'spreadsheet') &&
    (lower === 'document' ||
      lower.startsWith('document') ||
      lower === 'pdf' ||
      lower.startsWith('pdf') ||
      lower === 'spreadsheet' ||
      lower.startsWith('spreadsheet') ||
      lower === 'file' ||
      lower.startsWith('file'));

  const stripTrailingDate = (s) =>
    s
      .replace(/\s*[•\-]\s*[A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}\s*$/i, '')
      .replace(/\s*[•\-]\s*\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/i, '')
      .trim();

  if (isGenericPhoto) {
    return stripTrailingDate('Snapshot');
  }
  if (isGenericDoc) {
    if (kind === 'pdf') return stripTrailingDate('Coach PDF');
    if (kind === 'spreadsheet') return stripTrailingDate('Tracker');
    return stripTrailingDate('Coach Doc');
  }
  return stripTrailingDate(t);
}

function GradientBorder({ gradient, children, borderRadius = 18 }) {
  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.gradientWrapper, { borderRadius }]}
    >
      <View style={[styles.gradientInner, { borderRadius: borderRadius - 2 }]}>{children}</View>
    </LinearGradient>
  );
}

function SectionHeader({ title, isDark }) {
  const theme = isDark ? COLORS.dark : COLORS.light;
  return <Text style={[styles.sectionHeader, { color: theme.text60 }]}>{title}</Text>;
}

function CategoryHeader({ title, count, open, onToggle, isDark }) {
  const theme = isDark ? COLORS.dark : COLORS.light;
  return (
    <View style={styles.categoryHeaderContainer}>
      <GradientBorder gradient={GRADIENTS.trainer} borderRadius={14}>
        <TouchableOpacity onPress={onToggle} style={[styles.categoryHeaderButton, { backgroundColor: theme.card }]} activeOpacity={0.9}>
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

const PHOTO_THUMB = 76;

function MyPhotoThumbnailsRow({ files, isDark, onOpenItem, onDownloadItem, onShareItem, onDeleteItem }) {
  const theme = isDark ? COLORS.dark : COLORS.light;
  if (!files?.length) return null;

  const confirmDelete = (file) => {
    if (!onDeleteItem) return;
    Alert.alert('Delete file?', 'This will remove it from your files.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDeleteItem(file) },
    ]);
  };

  const photoMenu = (file) => {
    Alert.alert('Your photo', 'Open, share, download, or delete.', [
      { text: 'Open', onPress: () => onOpenItem?.(file) },
      { text: 'Download', onPress: () => onDownloadItem?.(file) },
      { text: 'Share', onPress: () => onShareItem?.(file) },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(file) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.thumbRowWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRowContent}>
        {files.map((file) => {
          const thumb = file?.thumbnailUrl || file?.url || null;
          return (
            <TouchableOpacity
              key={file.id || file.url || file.name}
              activeOpacity={0.88}
              onPress={() => onOpenItem?.(file)}
              onLongPress={() => photoMenu(file)}
              delayLongPress={380}
            >
              <GradientBorder gradient={GRADIENTS.myFiles} borderRadius={14}>
                <View style={[styles.thumbInner, { backgroundColor: theme.card }]}>
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={styles.thumbImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.thumbImage, styles.thumbPlaceholder]}>
                      <Text style={[styles.thumbPlaceholderText, { color: theme.text40 }]}>Photo</Text>
                    </View>
                  )}
                </View>
              </GradientBorder>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <Text style={[styles.thumbHint, { color: theme.text60 }]}>Tap to open · hold for share, download, or delete</Text>
    </View>
  );
}

function TrainerDocStrip({ file, onDownload, onOpen, isDark }) {
  const theme = isDark ? COLORS.dark : COLORS.light;
  const t = getFileTypeFromItem(file);
  const rawName = getFriendlyFileTitle(file) || file?.name || file?.title || 'File';
  const kind = t === 'pdf' ? 'pdf' : t === 'spreadsheet' ? 'spreadsheet' : 'document';
  const name = normalizeGenericTitle(rawName, kind);
  const Icon = t === 'spreadsheet' ? FileSpreadsheet : FileText;
  const typeLabel = t === 'spreadsheet' ? 'Sheet' : t === 'pdf' ? 'PDF' : 'Doc';
  const createdAt = file?.createdAt?.toDate?.() || file?.createdAt;
  const dateLabel = createdAt ? formatDateShort(createdAt) : '';

  return (
    <View style={styles.trainerStripOuter}>
      <View
        style={[
          styles.trainerStripTouchable,
          { backgroundColor: theme.card, borderColor: isDark ? 'rgba(6,182,212,0.22)' : 'rgba(6,182,212,0.35)' },
        ]}
      >
        <LinearGradient colors={GRADIENTS.trainer} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.trainerStripAccent} />
        <TouchableOpacity onPress={onOpen} activeOpacity={0.9} style={styles.trainerStripMain}>
          <View style={[styles.trainerStripIcon, { borderColor: isDark ? 'rgba(6,182,212,0.35)' : 'rgba(6,182,212,0.25)' }]}>
            <Icon size={20} color="#06B6D4" />
          </View>
          <View style={styles.trainerStripText}>
            <Text style={[styles.trainerStripTitle, { color: theme.text }]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.trainerStripMeta, { color: theme.text60 }]} numberOfLines={1}>
              {typeLabel}
              {dateLabel ? ` · ${dateLabel}` : ''}
            </Text>
          </View>
          <ChevronRight size={18} color={theme.text40} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDownload} hitSlop={12} style={[styles.trainerStripDl, { marginRight: 8 }]} activeOpacity={0.85}>
          <Download size={17} color="#06B6D4" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function NoteCard({ note, onOpen, isDark }) {
  const theme = isDark ? COLORS.dark : COLORS.light;
  const coach = note?.coach || note?.fromName || 'Coach';
  const preview = String(note?.content || note?.preview || '').trim();

  return (
    <View style={styles.noteCardContainer}>
      <GradientBorder gradient={GRADIENTS.notes} borderRadius={14}>
        <TouchableOpacity style={[styles.noteCard, { backgroundColor: theme.card }]} onPress={onOpen} activeOpacity={0.9}>
          <View style={styles.noteHeader}>
            <MessageSquare size={16} color="#C084FC" />
            <Text style={[styles.noteLabel, { color: theme.text60 }]}>From Coach: {coach}</Text>
          </View>

          <Text style={[styles.noteText, { color: theme.text60 }]} numberOfLines={2}>
            &quot;{preview}&quot;
          </Text>

          <View style={styles.viewFullButton}>
            <Text style={styles.viewFullText}>View Full Note</Text>
            <ArrowRight size={14} color="#FF6B9D" />
          </View>
        </TouchableOpacity>
      </GradientBorder>
    </View>
  );
}

export default function FilesNotesSectionPremium({
  items = [],
  isDark = true,
  onOpenItem,
  onDownloadItem,
  onShareItem,
  onDeleteItem,
  onMarkRead,
  onUploadPress,
}) {
  const theme = isDark ? COLORS.dark : COLORS.light;
  const [filter, setFilter] = useState('All Files');
  const [docsOpen, setDocsOpen] = useState(true);

  const { myPhotos, trainerDocs, notes } = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    const myFiles = list.filter((x) => (x?.addedBy || 'client') === 'client' && x?.type !== 'note');
    const myPhotosOnly = myFiles.filter((x) => getFileTypeFromItem(x) === 'image');
    const shared = list.filter((x) => x?.addedBy === 'trainer' || (x?.type === 'document' && x?.trainerId));
    const trainerDocsOnly = shared.filter((x) => {
      const t = getFileTypeFromItem(x);
      return t === 'document' || t === 'pdf' || t === 'spreadsheet';
    });
    const trainerNotes = list.filter((x) => x?.type === 'note' && x?.addedBy === 'trainer');
    return { myPhotos: myPhotosOnly, trainerDocs: trainerDocsOnly, notes: trainerNotes };
  }, [items]);

  const showPhotos = filter === 'All Files' || filter === 'Photos';
  const showDocs = filter === 'All Files' || filter === 'Documents';
  const showNotes = filter === 'All Files' || filter === 'Notes';

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {FILTERS.map((f) => {
          const isActive = filter === f;
          return (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.filterButton, { borderColor: theme.border }, isActive && styles.filterButtonActive]}
              activeOpacity={0.85}
            >
              {isActive ? (
                <LinearGradient colors={GRADIENTS.myFiles} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.filterGradient}>
                  <Text style={styles.filterTextActive}>{f}</Text>
                </LinearGradient>
              ) : (
                <Text style={[styles.filterText, { color: theme.text60 }]}>{f}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {showPhotos && (
        <View>
          <SectionHeader title="MY FILES" isDark={isDark} />

          {typeof onUploadPress === 'function' ? (
            <LinearGradient colors={GRADIENTS.myFiles} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.uploadGradient}>
              <TouchableOpacity style={styles.uploadButton} onPress={onUploadPress} activeOpacity={0.9}>
                <Text style={styles.uploadText}>Upload File</Text>
              </TouchableOpacity>
            </LinearGradient>
          ) : null}

          {myPhotos.length > 0 ? (
            <MyPhotoThumbnailsRow
              files={myPhotos}
              isDark={isDark}
              onOpenItem={onOpenItem}
              onDownloadItem={onDownloadItem}
              onShareItem={onShareItem}
              onDeleteItem={onDeleteItem}
            />
          ) : (
            <View style={[styles.photosEmptyInline, { borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,107,157,0.06)' : 'rgba(255,107,157,0.08)' }]}>
              <Text style={[styles.photosEmptyText, { color: theme.text60 }]}>No photos yet — tap Upload to add progress shots.</Text>
            </View>
          )}
        </View>
      )}

      {showDocs && (
        <View>
          <SectionHeader title="TRAINER SHARED" isDark={isDark} />
          <CategoryHeader title="Documents" count={trainerDocs.length} open={docsOpen} onToggle={() => setDocsOpen((v) => !v)} isDark={isDark} />
          {docsOpen
            ? trainerDocs.map((file) => (
                <TrainerDocStrip
                  key={file.id || file.url || file.name}
                  file={file}
                  isDark={isDark}
                  onOpen={async () => {
                    try {
                      await onMarkRead?.(file);
                    } catch (_) {}
                    onOpenItem?.(file);
                  }}
                  onDownload={() => onDownloadItem?.(file)}
                />
              ))
            : null}
        </View>
      )}

      {showNotes && (
        <View>
          <SectionHeader title="NOTES FROM TRAINER" isDark={isDark} />
          {notes.length > 0 ? (
            notes.map((note) => (
              <NoteCard
                key={note.id || String(note.createdAt) || Math.random()}
                note={note}
                isDark={isDark}
                onOpen={async () => {
                  try {
                    await onMarkRead?.(note);
                  } catch (_) {}
                  Alert.alert('Note from coach', String(note?.content || '').trim() || '—');
                }}
              />
            ))
          ) : (
            <View style={[styles.emptyState, { borderColor: theme.border }]}>
              <MessageSquare size={28} color={theme.text40} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No notes yet</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterScroll: { marginVertical: 8 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  filterButton: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  filterButtonActive: { borderWidth: 0, paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' },
  filterGradient: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 6, justifyContent: 'center' },
  filterText: { fontSize: 13, fontWeight: '500' },
  filterTextActive: { fontSize: 13, fontWeight: '700', color: '#fff' },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginTop: 20,
    marginBottom: 10,
    marginHorizontal: 16,
  },
  gradientWrapper: { padding: 2 },
  gradientInner: { overflow: 'hidden' },
  uploadGradient: { marginHorizontal: 16, marginBottom: 12, borderRadius: 14, overflow: 'hidden' },
  uploadButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 46 },
  uploadText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  thumbRowWrap: { marginBottom: 4 },
  thumbRowContent: { paddingHorizontal: 16, gap: 10, alignItems: 'center', paddingBottom: 2 },
  thumbInner: { borderRadius: 12, overflow: 'hidden' },
  thumbImage: { width: PHOTO_THUMB, height: PHOTO_THUMB, backgroundColor: 'rgba(255,255,255,0.05)' },
  thumbPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  thumbPlaceholderText: { fontSize: 11, fontWeight: '700' },
  thumbHint: { fontSize: 11, fontWeight: '600', marginTop: 8, marginHorizontal: 16, marginBottom: 4 },
  photosEmptyInline: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  photosEmptyText: { fontSize: 13, fontWeight: '600', lineHeight: 18, textAlign: 'center' },
  trainerStripOuter: { marginHorizontal: 16, marginBottom: 8 },
  trainerStripTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  trainerStripAccent: { width: 4, alignSelf: 'stretch' },
  trainerStripMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 6,
    gap: 10,
    minWidth: 0,
  },
  trainerStripIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(6,182,212,0.10)',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trainerStripText: { flex: 1, minWidth: 0 },
  trainerStripTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  trainerStripMeta: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  trainerStripDl: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.28)',
    backgroundColor: 'rgba(6,182,212,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryHeaderContainer: { marginHorizontal: 16, marginBottom: 8 },
  categoryHeaderButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 48, paddingHorizontal: 14 },
  categoryLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  categoryTitle: { fontSize: 14, fontWeight: '700' },
  categoryCount: { fontSize: 12, marginTop: 2 },
  noteCardContainer: { marginHorizontal: 16, marginBottom: 10 },
  noteCard: { padding: 12 },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  noteLabel: { fontSize: 12, fontWeight: '700' },
  noteText: { fontSize: 13, lineHeight: 20, marginBottom: 8 },
  viewFullButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewFullText: { fontSize: 12, fontWeight: '600', color: '#FF6B9D' },
  emptyState: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 13, fontWeight: '700', marginTop: 8 },
});

