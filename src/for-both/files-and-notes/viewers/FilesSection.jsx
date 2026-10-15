// Premium Notes & Files workspace: coach files, my files, notes, and an upload button.
// Flow: split items by who added them → section grids → long-press for open / download / delete.
// Used by the client home workspace and the trainer client workspace.

import React, { useMemo } from 'react';
import { Alert, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { formatDateShort, formatFileSize, getFileTypeFromItem } from '../../../helpers/fileSizeAndDateText';

// ===== NAMED CONSTANTS =====

/** Dark orange → dark purple accent gradient */
const ORANGE_PURPLE_GRAD = ['#C2410C', '#4C1D95'];
const PINK_GRAD = ['#BE185D', '#FF6B9D'];

const GRAD_COACH = ORANGE_PURPLE_GRAD;
const GRAD_MY = PINK_GRAD;

const UPLOAD_GRADIENT = ORANGE_PURPLE_GRAD;

const FILE_TYPE_META = {
  pdf:         { label: 'PDF',    icon: 'file-text',  gradient: GRAD_COACH },
  video:       { label: 'VIDEO',  icon: 'play-circle', gradient: GRAD_COACH },
  document:    { label: 'DOC',    icon: 'file-text',  gradient: GRAD_COACH },
  spreadsheet: { label: 'SHEET',  icon: 'grid',       gradient: GRAD_COACH },
  image:       { label: 'IMAGE',  icon: 'image',      gradient: GRAD_MY },
  file:        { label: 'FILE',   icon: 'file',       gradient: GRAD_COACH },
};

const CARD_GRADIENT_COACH = ['rgba(194,65,12,0.22)', 'rgba(76,29,149,0.14)', 'rgba(10,10,15,0.95)'];
const CARD_GRADIENT_MY    = ['rgba(190,24,93,0.20)', 'rgba(255,107,157,0.12)', 'rgba(10,10,15,0.95)'];
const CARD_GRADIENT_COACH_LIGHT = ['rgba(194,65,12,0.10)', 'rgba(76,29,149,0.08)', 'rgba(248,249,252,0.95)'];
const CARD_GRADIENT_MY_LIGHT    = ['rgba(255,107,157,0.12)', 'rgba(190,24,93,0.06)', 'rgba(248,249,252,0.95)'];

const AUDIENCE_TRAINER = 'trainer';
const ADDED_BY_TRAINER = 'trainer';
const ADDED_BY_CLIENT = 'client';
const TYPE_NOTE = 'note';
const TYPE_DOCUMENT = 'document';
const VARIANT_COACH = 'coach';
const VARIANT_MY = 'my';

// ===== HELPER FUNCTIONS =====

function GradientPill({ colors, style, children }) {
  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={style}>
      {children}
    </LinearGradient>
  );
}

function filesSectionTheme(isDark) {
  if (isDark) {
    return {
      background: '#0A0A0F',
      card: '#141419',
      text: '#FFF',
      text70: 'rgba(255,255,255,0.7)',
      text50: 'rgba(255,255,255,0.5)',
      text30: 'rgba(255,255,255,0.3)',
      border: 'rgba(255,255,255,0.08)',
    };
  }
  return {
    background: '#F7F7FA',
    card: '#FFFFFF',
    text: '#1A1A2E',
    text70: 'rgba(0,0,0,0.65)',
    text50: 'rgba(0,0,0,0.45)',
    text30: 'rgba(0,0,0,0.25)',
    border: 'rgba(0,0,0,0.06)',
  };
}

function cardsFromTrainerDocuments(trainerDocuments) {
  const list = Array.isArray(trainerDocuments) ? trainerDocuments : [];
  return list.map((documentRecord) => {
    const isShared = Array.isArray(documentRecord.sharedWith) && documentRecord.sharedWith.length > 0;
    const title = documentRecord.title || 'Untitled';
    return {
      id: documentRecord.id,
      type: TYPE_DOCUMENT,
      name: isShared ? `${title} · Shared` : title,
      title,
      createdAt: documentRecord.updatedAt || documentRecord.createdAt,
      addedBy: ADDED_BY_TRAINER,
      documentId: documentRecord.id,
    };
  });
}

function isClientFile(item) {
  return (item?.addedBy || ADDED_BY_CLIENT) === ADDED_BY_CLIENT && item?.type !== TYPE_NOTE;
}

function isTrainerFile(item) {
  return item?.addedBy === ADDED_BY_TRAINER && item?.type !== TYPE_NOTE;
}

function isCoachFileForClient(item) {
  const fromTrainer = item?.addedBy === ADDED_BY_TRAINER || (item?.type === TYPE_DOCUMENT && item?.trainerId);
  return fromTrainer && item?.type !== TYPE_NOTE;
}

function isTrainerNoteForClient(item) {
  return item?.type === TYPE_NOTE && item?.addedBy === ADDED_BY_TRAINER;
}

function groupNotesAndFiles(items, isTrainer, trainerDocuments) {
  const list = Array.isArray(items) ? items : [];
  if (isTrainer) {
    return {
      coachFiles: list.filter(isTrainerFile),
      myFiles: list.filter(isClientFile),
      notes: list.filter((item) => item?.type === TYPE_NOTE),
      yourDocuments: cardsFromTrainerDocuments(trainerDocuments),
    };
  }
  return {
    coachFiles: list.filter(isCoachFileForClient),
    myFiles: list.filter(isClientFile),
    notes: list.filter(isTrainerNoteForClient),
    yourDocuments: [],
  };
}

function heroCopyForAudience(isTrainer, clientName) {
  if (isTrainer) {
    return {
      title: clientName ? String(clientName).trim() : 'Client files',
      kicker: 'Notes & Files',
      brand: null,
      tagline: 'Shared uploads and documents for this client',
    };
  }
  return {
    title: 'Files & Notes',
    kicker: 'Shared with your coach',
    brand: null,
    tagline: 'Photos, videos, and documents in one place',
  };
}

function labelsForAudience(isTrainer) {
  if (isTrainer) {
    return {
      coachSection: 'From you',
      mySection: 'From client',
      notesSection: 'Notes',
      docsSection: 'Your documents',
      myEmpty: 'No client uploads yet',
      coachEmpty: 'Nothing from you yet — add a note or file below',
    };
  }
  return {
    coachSection: 'FROM YOUR COACH',
    mySection: 'MY FILES',
    notesSection: 'COACHING NOTES',
    docsSection: null,
    myEmpty: 'No files yet — tap + Add file below',
    coachEmpty: null,
  };
}

function getFileMeta(file) {
  const fileType = getFileTypeFromItem(file);
  const meta = FILE_TYPE_META[fileType] || FILE_TYPE_META.file;
  const name = file?.name || file?.title || 'File';
  const createdAt = file?.createdAt?.toDate?.() || file?.createdAt;
  const when = createdAt ? formatDateShort(createdAt) : '';
  const size = file?.size ? formatFileSize(file.size) : '';
  const datePart = when ? when.replace(/,?\s*\d{4}$/, '').toUpperCase() : '';
  return { ...meta, name, when: datePart, size, fileType };
}

function canDeleteFile(file, isTrainer, onDeleteItem) {
  if (!onDeleteItem || !file) return false;
  if (isTrainer) return file?.addedBy === ADDED_BY_TRAINER;
  return file?.addedBy !== ADDED_BY_TRAINER;
}

function longPressActionsForFile(file, name, isTrainer, callbacks) {
  const actions = [
    { text: 'Open', onPress: () => callbacks.onOpenItem?.(file) },
    { text: 'Download', onPress: () => callbacks.onDownloadItem?.(file) },
    { text: 'Share', onPress: () => callbacks.onShareItem?.(file) },
  ];
  if (canDeleteFile(file, isTrainer, callbacks.onDeleteItem)) {
    actions.push({ text: 'Delete', style: 'destructive', onPress: () => callbacks.onDeleteItem?.(file) });
  }
  actions.push({ text: 'Cancel', style: 'cancel' });
  Alert.alert(name, '', actions);
}

function cardGradientsForVariant(variant, isDark) {
  if (variant === VARIANT_COACH) {
    return isDark ? CARD_GRADIENT_COACH : CARD_GRADIENT_COACH_LIGHT;
  }
  return isDark ? CARD_GRADIENT_MY : CARD_GRADIENT_MY_LIGHT;
}

function cardBorderForVariant(variant, isDark) {
  if (variant === VARIANT_COACH) {
    return isDark ? 'rgba(194,65,12,0.28)' : 'rgba(194,65,12,0.16)';
  }
  return isDark ? 'rgba(255,107,157,0.28)' : 'rgba(255,107,157,0.16)';
}

function noteTitleForAudience(isTrainer, note) {
  if (isTrainer) {
    return note?.addedBy === ADDED_BY_TRAINER ? 'Your note' : 'From client';
  }
  return 'From your coach';
}

// ===== MAIN FUNCTION =====

/**
 * Premium files grid — client home Notes & Files workspace and trainer client workspace.
 * Hooks stay in this order: one useMemo that splits items, then the section cards.
 * @param {object} props
 * @param {'client'|'trainer'} [props.audience]
 */
export default function FilesSection({
  items = [],
  trainerDocuments = [],
  audience = 'client',
  clientName = '',
  isDark = true,
  onOpenItem,
  onDownloadItem,
  onShareItem,
  onDeleteItem,
  onMarkRead,
  onUploadPress,
  uploadLabel = 'Add note or file',
}) {
  const theme = filesSectionTheme(isDark);
  const isTrainer = audience === AUDIENCE_TRAINER;

  const {
    coachFiles,
    myFiles,
    notes,
    yourDocuments,
  } = useMemo(
    () => groupNotesAndFiles(items, isTrainer, trainerDocuments),
    [items, isTrainer, trainerDocuments],
  );

  const heroCopy = heroCopyForAudience(isTrainer, clientName);
  const labels = labelsForAudience(isTrainer);

  const FileCard = ({ file, variant = VARIANT_COACH }) => {
    const { label, icon, gradient, name, when, size, fileType } = getFileMeta(file);
    const accentGrad = variant === VARIANT_COACH ? GRAD_COACH : GRAD_MY;
    const badgeGrad = gradient || accentGrad;
    const accent = badgeGrad[0];
    const cardGrad = cardGradientsForVariant(variant, isDark);
    const borderCol = cardBorderForVariant(variant, isDark);
    const imageUri = file?.thumbnailUrl || file?.url;

    const openFile = async () => {
      try { await onMarkRead?.(file); } catch (_e) { /* mark-read is best-effort */ }
      onOpenItem?.(file);
    };

    return (
      <TouchableOpacity
        style={[styles.fileCard, { borderColor: borderCol }]}
        activeOpacity={0.88}
        onPress={openFile}
        onLongPress={() => longPressActionsForFile(file, name, isTrainer, { onOpenItem, onDownloadItem, onShareItem, onDeleteItem })}
        delayLongPress={380}
      >
        {fileType === 'image' && imageUri ? (
          <View style={styles.fileCardGradient}>
            <Image source={{ uri: imageUri }} style={styles.fileCardThumb} resizeMode="cover" />
            <GradientPill colors={badgeGrad} style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{label}</Text>
            </GradientPill>
            <TouchableOpacity
              style={[styles.dlBtn, { borderColor: 'rgba(255,255,255,0.4)' }]}
              onPress={() => onDownloadItem?.(file)}
              hitSlop={12}
              activeOpacity={0.7}
            >
              <Feather name="download" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <LinearGradient colors={cardGrad} start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.fileCardGradient}>
            <GradientPill colors={badgeGrad} style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{label}</Text>
            </GradientPill>
            <View style={styles.fileCardIconWrap}>
              <Feather name={icon} size={40} color={accent} />
            </View>
            <TouchableOpacity
              style={[styles.dlBtn, { borderColor: `${accent}55` }]}
              onPress={() => onDownloadItem?.(file)}
              hitSlop={12}
              activeOpacity={0.7}
            >
              <Feather name="download" size={18} color={accent} />
            </TouchableOpacity>
          </LinearGradient>
        )}
        <View style={styles.fileCardInfo}>
          <Text style={[styles.fileCardName, { color: theme.text }]} numberOfLines={1}>{name}</Text>
          <Text style={[styles.fileCardMeta, { color: theme.text50 }]} numberOfLines={1}>
            {when}{size ? ` \u00B7 ${size}` : ''}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const SectionHead = ({ title, count, gradient }) => (
    <View style={styles.sectionHead}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {count != null && count > 0 && (
        <GradientPill colors={gradient} style={styles.sectionBadge}>
          <Text style={styles.sectionBadgeText}>{count}</Text>
        </GradientPill>
      )}
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.sectionLine}
      />
    </View>
  );

  const NoteCard = ({ note }) => {
    const preview = String(note?.content || note?.preview || '').trim();
    const createdAt = note?.createdAt?.toDate?.() || note?.createdAt;
    const when = createdAt ? formatDateShort(createdAt) : null;
    const noteTitle = noteTitleForAudience(isTrainer, note);

    const openNote = async () => {
      try { await onMarkRead?.(note); } catch (_e) { /* mark-read is best-effort */ }
      Alert.alert(noteTitle, preview || '—');
    };

    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={openNote}
        style={[
          styles.noteCard,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
          },
        ]}
      >
        <View style={styles.noteContent}>
          <View style={styles.noteHeaderRow}>
            <Text style={[styles.noteTitle, { color: theme.text }]}>{noteTitle}</Text>
            {when ? <Text style={[styles.noteDate, { color: theme.text50 }]}>{when}</Text> : null}
          </View>
          <Text style={[styles.noteText, { color: theme.text70 }]} numberOfLines={3}>
            {preview || '—'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const EmptyCard = ({ message, gradient = GRAD_MY }) => (
    <View style={[styles.emptyCard, { borderColor: isDark ? 'rgba(219,39,119,0.15)' : 'rgba(219,39,119,0.10)' }]}>
      <Feather name="upload-cloud" size={28} color={gradient[0]} />
      <Text style={[styles.emptyText, { color: theme.text50 }]}>{message}</Text>
    </View>
  );

  const renderGrid = (files, variant) => (
    <View style={styles.grid}>
      {files.map((file) => (
        <FileCard key={file.id || file.url || file.name} file={file} variant={variant} />
      ))}
    </View>
  );

  const hasAnyContent =
    coachFiles.length > 0 ||
    myFiles.length > 0 ||
    notes.length > 0 ||
    yourDocuments.length > 0;

  const primaryFiles = isTrainer ? coachFiles : myFiles;
  const primaryVariant = isTrainer ? VARIANT_COACH : VARIANT_MY;
  const primaryGradient = isTrainer ? GRAD_COACH : GRAD_MY;
  const primaryTitle = isTrainer ? labels.coachSection : labels.mySection;
  const primaryEmpty = isTrainer ? labels.coachEmpty : labels.myEmpty;

  return (
    <View style={{ flex: 1 }}>
      {/* 1. Hero copy for trainer (this client) or client (my files). */}
      <View style={styles.heroOuter}>
        <View style={[styles.heroInner, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF', borderColor: theme.border }]}>
          <Text style={[styles.heroKicker, { color: theme.text50 }]}>{heroCopy.kicker}</Text>
          <Text style={[styles.heroTitle, { color: theme.text }]}>{heroCopy.title}</Text>
          <Text style={[styles.heroTagline, { color: theme.text50 }]}>{heroCopy.tagline}</Text>
        </View>
      </View>

      {/* 2. Trainer empty state when this client has nothing yet. */}
      {!hasAnyContent && isTrainer ? (
        <View style={styles.sectionWrap}>
          <EmptyCard message="No notes or files yet — add something for your client below" gradient={GRAD_COACH} />
        </View>
      ) : null}

      {/* 3. Trainer sees "from client" first. Client sees "from coach" only when that list has files. */}
      {isTrainer ? (
        <View style={styles.sectionWrap}>
          <SectionHead title={labels.mySection} count={myFiles.length} gradient={GRAD_MY} />
          {myFiles.length > 0 ? renderGrid(myFiles, VARIANT_MY) : (
            <EmptyCard message={labels.myEmpty} gradient={GRAD_MY} />
          )}
        </View>
      ) : coachFiles.length > 0 ? (
        <View style={styles.sectionWrap}>
          <SectionHead title={labels.coachSection} count={coachFiles.length} gradient={GRAD_COACH} />
          {renderGrid(coachFiles, VARIANT_COACH)}
        </View>
      ) : null}

      {/* 4. The other person's files (or "from you" for the trainer), then docs, notes, upload. */}
      <View style={styles.sectionWrap}>
        <SectionHead
          title={primaryTitle}
          count={primaryFiles.length}
          gradient={primaryGradient}
        />
        {primaryFiles.length > 0 ? (
          renderGrid(primaryFiles, primaryVariant)
        ) : (
          <EmptyCard message={primaryEmpty} gradient={primaryGradient} />
        )}
      </View>

      {yourDocuments.length > 0 ? (
        <View style={styles.sectionWrap}>
          <SectionHead title={labels.docsSection} count={yourDocuments.length} gradient={GRAD_COACH} />
          {renderGrid(yourDocuments, VARIANT_COACH)}
        </View>
      ) : null}

      {notes.length > 0 ? (
        <View style={styles.sectionWrap}>
          <SectionHead title={labels.notesSection} count={notes.length} gradient={GRAD_COACH} />
          <View style={{ gap: 12, paddingHorizontal: 16 }}>
            {notes.map((note) => (
              <NoteCard key={note.id || String(note.createdAt)} note={note} />
            ))}
          </View>
        </View>
      ) : null}

      {onUploadPress ? (
        <View style={styles.uploadWrap}>
          <TouchableOpacity onPress={onUploadPress} activeOpacity={0.88}>
            <LinearGradient colors={UPLOAD_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.uploadBtn}>
              <Feather name="upload" size={16} color="#fff" />
              <Text style={styles.uploadText}>{uploadLabel}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heroOuter: { paddingHorizontal: 16, marginTop: 4, marginBottom: 16 },
  heroInner: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderWidth: 1,
  },
  heroTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, marginTop: 2 },
  heroKicker: { fontSize: 12, fontWeight: '600' },
  heroTagline: { fontSize: 13, fontWeight: '500', marginTop: 6, lineHeight: 18 },

  sectionWrap: { marginBottom: 24 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 14, gap: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
  sectionBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sectionBadgeText: { fontSize: 11, fontWeight: '900', color: '#fff' },
  sectionLine: { flex: 1, height: 1.5, borderRadius: 1, marginLeft: 4 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12 },

  fileCard: {
    width: '47%', flexGrow: 1, borderRadius: 18, borderWidth: 1, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 4 },
    }),
  },
  fileCardGradient: { height: 160, padding: 12, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  fileCardThumb: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  typeBadge: {
    position: 'absolute', top: 10, left: 10,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  typeBadgeText: { fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 0.8 },
  fileCardIconWrap: { alignItems: 'center', justifyContent: 'center' },
  dlBtn: {
    position: 'absolute', bottom: 10, right: 10,
    width: 34, height: 34, borderRadius: 17, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)',
  },
  fileCardInfo: { padding: 12, paddingTop: 10 },
  fileCardName: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  fileCardMeta: { fontSize: 11, fontWeight: '600', marginTop: 3 },

  noteCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  noteContent: { padding: 14 },
  noteHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  noteTitle: { fontSize: 13, fontWeight: '700' },
  noteDate: { fontSize: 11, fontWeight: '600' },
  noteText: { fontSize: 14, fontWeight: '500', lineHeight: 20 },

  emptyCard: {
    marginHorizontal: 16, borderWidth: 1, borderStyle: 'dashed', borderRadius: 18,
    paddingVertical: 32, alignItems: 'center', gap: 10,
  },
  emptyText: { fontSize: 13, fontWeight: '600', textAlign: 'center', paddingHorizontal: 12 },

  uploadWrap: { paddingHorizontal: 16, paddingBottom: 24, marginTop: 4 },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
  },
  uploadText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
