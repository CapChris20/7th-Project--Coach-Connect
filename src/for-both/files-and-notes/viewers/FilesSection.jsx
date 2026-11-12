// Design Law Notes & Files workspace (PNG 01 / 06) — segmented filter + coach/my grids + notes.
// Flow: split items by who added them → filter by All/Photos/Videos/Documents → HardShadow cards.
// Used by the client home workspace and the trainer client workspace.
//
// vocab: NbSegmented = mutually exclusive All/Photos/Videos/Documents track
 // Keep Firebase item keys (addedBy, type, url, documentId) unchanged.

import React, { useMemo, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../../look-and-feel/lightDarkMode';
import HardShadow from '../../../look-and-feel/HardShadow';
import NbButton from '../../../look-and-feel/NbButton';
import NbSegmented from '../../../look-and-feel/NbSegmented';
import NbPill from '../../../look-and-feel/NbPill';
import { borderRadius, nb, spacing } from '../../../look-and-feel/colorPalette';
import { formatDateShort, formatFileSize, getFileTypeFromItem } from '../../../helpers/fileSizeAndDateText';
import DeleteFileSheet from './DeleteFileSheet';
import HatchedThumbFill from '../../../workouts/exercise-videos/HatchedThumbFill';

// ===== NAMED CONSTANTS =====

const AUDIENCE_TRAINER = 'trainer';
const ADDED_BY_TRAINER = 'trainer';
const ADDED_BY_CLIENT = 'client';
const TYPE_NOTE = 'note';
const TYPE_DOCUMENT = 'document';
const FILTER_ALL = 'all';
const FILTER_PHOTOS = 'photos';
const FILTER_VIDEOS = 'videos';
const FILTER_DOCUMENTS = 'documents';

const FILTER_SEGMENTS = [
  { id: FILTER_ALL, label: 'All Files' },
  { id: FILTER_PHOTOS, label: 'Photos' },
  { id: FILTER_VIDEOS, label: 'Videos' },
  { id: FILTER_DOCUMENTS, label: 'Documents' },
];

const TYPE_LABEL = {
  pdf: 'PDF',
  video: 'VIDEO',
  document: 'DOC',
  spreadsheet: 'SHEET',
  image: 'IMAGE',
  photo: 'IMAGE',
  file: 'FILE',
};

const TYPE_ICON = {
  pdf: 'file-text',
  video: 'play-circle',
  document: 'file-text',
  spreadsheet: 'grid',
  image: 'image',
  photo: 'image',
  file: 'file',
};

// ===== HELPER FUNCTIONS =====

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
    // PNG 01 Coaching Notes: both directions (your note + from coach)
    notes: list.filter((item) => item?.type === TYPE_NOTE),
    yourDocuments: [],
  };
}

function labelsForAudience(isTrainer) {
  if (isTrainer) {
    return {
      coachSection: 'FROM YOU',
      mySection: 'FROM CLIENT',
      notesSection: 'NOTES',
      docsSection: 'YOUR DOCUMENTS',
      myEmpty: 'No client uploads yet',
      coachEmpty: 'Nothing from you yet — add a note or file below',
      coachBadge: 'From you',
      myBadge: 'From client',
    };
  }
  return {
    coachSection: 'FROM YOUR COACH',
    mySection: 'MY FILES',
    mySectionHint: 'SHARED WITH YOUR COACH',
    notesSection: 'COACHING NOTES',
    docsSection: null,
    myEmpty: 'No files yet — tap Add note or file below',
    coachEmpty: null,
    coachBadge: 'From your coach',
    myBadge: 'From you',
  };
}

function fileMatchesFilter(file, filter) {
  if (filter === FILTER_ALL) return true;
  const fileType = getFileTypeFromItem(file);
  if (filter === FILTER_PHOTOS) return fileType === 'image' || file?.type === 'photo';
  if (filter === FILTER_VIDEOS) return fileType === 'video' || file?.type === 'video';
  if (filter === FILTER_DOCUMENTS) {
    return (
      fileType === 'pdf' ||
      fileType === 'document' ||
      fileType === 'spreadsheet' ||
      fileType === 'file' ||
      file?.type === 'doc' ||
      file?.type === 'pdf'
    );
  }
  return true;
}

function getFileMeta(file) {
  const fileType = getFileTypeFromItem(file);
  const name = file?.name || file?.title || 'File';
  const createdAt = file?.createdAt?.toDate?.() || file?.createdAt;
  const when = createdAt ? formatDateShort(createdAt) : '';
  const size = file?.size ? formatFileSize(file.size) : '';
  const datePart = when ? when.replace(/,?\s*\d{4}$/, '') : '';
  return {
    name,
    when: datePart,
    size,
    fileType,
    typeLabel: TYPE_LABEL[fileType] || TYPE_LABEL.file,
    icon: TYPE_ICON[fileType] || TYPE_ICON.file,
  };
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
  // PNG 11–12: Delete opens DeleteFileSheet (not a native Alert confirm).
  if (canDeleteFile(file, isTrainer, callbacks.onDeleteItem)) {
    actions.push({
      text: 'Delete',
      style: 'destructive',
      onPress: () => callbacks.onRequestDelete?.(file),
    });
  }
  actions.push({ text: 'Cancel', style: 'cancel' });
  Alert.alert(name, '', actions);
}

function noteTitleForAudience(isTrainer, note) {
  if (isTrainer) {
    return note?.addedBy === ADDED_BY_TRAINER ? 'Your note' : 'From client';
  }
  return note?.addedBy === ADDED_BY_CLIENT ? 'Your note' : 'From your coach';
}

function unreadCoachCount(coachFiles, notes) {
  const unreadFiles = coachFiles.filter((file) => file?.isRead === false).length;
  const unreadNotes = notes.filter((note) => note?.isRead === false).length;
  return unreadFiles + unreadNotes;
}

// ===== MAIN FUNCTION =====

/**
 * Design Law files grid — client Notes & Files workspace and trainer client workspace.
 * @param {object} props
 * @param {'client'|'trainer'} [props.audience]
 */
export default function FilesSection({
  items = [],
  trainerDocuments = [],
  audience = 'client',
  clientName = '',
  isDark: _isDarkIgnored,
  onOpenItem,
  onDownloadItem,
  onShareItem,
  onDeleteItem,
  onMarkRead,
  onUploadPress,
  uploadLabel = 'Add note or file',
  showHero = true,
}) {
  const { colors } = useTheme();
  const isTrainer = audience === AUDIENCE_TRAINER;
  const [filter, setFilter] = useState(FILTER_ALL);
  const [pendingDelete, setPendingDelete] = useState(null);

  const { coachFiles, myFiles, notes, yourDocuments } = useMemo(
    () => groupNotesAndFiles(items, isTrainer, trainerDocuments),
    [items, isTrainer, trainerDocuments],
  );

  const labels = labelsForAudience(isTrainer);
  const newCount = unreadCoachCount(coachFiles, notes);

  const filteredCoach = useMemo(
    () => coachFiles.filter((file) => fileMatchesFilter(file, filter)),
    [coachFiles, filter],
  );
  const filteredMine = useMemo(
    () => myFiles.filter((file) => fileMatchesFilter(file, filter)),
    [myFiles, filter],
  );
  const filteredDocs = useMemo(
    () => yourDocuments.filter((file) => fileMatchesFilter(file, filter)),
    [yourDocuments, filter],
  );
  // Coach note preview sits in FROM YOUR COACH; Coaching Notes lists the rest (avoid duplicates)
  const coachNotePreview =
    !isTrainer && filter === FILTER_ALL
      ? notes.filter((note) => note?.addedBy === ADDED_BY_TRAINER).slice(0, 1)
      : [];
  const previewNoteId = coachNotePreview[0]?.id;
  const notesForList = notes.filter((note) => !previewNoteId || note?.id !== previewNoteId);
  // Notes only show on All (not media/document tabs)
  const showNotes = filter === FILTER_ALL && notesForList.length > 0;

  const FileCard = ({ file, badge }) => {
    const { name, when, size, fileType, typeLabel, icon } = getFileMeta(file);
    const imageUri = file?.thumbnailUrl || ((fileType === 'image' || file?.type === 'photo') ? file?.url : null);
    const metaLine = [typeLabel, when || size].filter(Boolean).join(' · ');

    const openFile = async () => {
      try {
        await onMarkRead?.(file);
      } catch (_e) {
        /* mark-read is best-effort */
      }
      onOpenItem?.(file);
    };

    return (
      <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={styles.cardShadow}>
        <TouchableOpacity
          style={[styles.fileCard, { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder }]}
          activeOpacity={0.88}
          onPress={openFile}
          onLongPress={() =>
            longPressActionsForFile(file, name, isTrainer, {
              onOpenItem,
              onDownloadItem,
              onShareItem,
              onDeleteItem,
              onRequestDelete: setPendingDelete,
            })
          }
          delayLongPress={380}
        >
          <View style={[styles.thumb, { backgroundColor: colors.nbSoft, borderColor: colors.nbBorder }]}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.thumbImage} resizeMode="cover" />
            ) : (
              <>
                <HatchedThumbFill />
                <View style={styles.thumbIconCenter}>
                  <Feather name={icon} size={28} color={colors.nbInk} />
                </View>
              </>
            )}
          </View>
          <View style={styles.fileInfo}>
            <Text style={[styles.fileName, { color: colors.nbInk }]} numberOfLines={2}>
              {name}
            </Text>
            <View style={styles.metaRow}>
              <NbPill variant="plain">{typeLabel}</NbPill>
              <Text style={[styles.fileMeta, { color: colors.nbMuted }]} numberOfLines={1}>
                {when || size || metaLine}
              </Text>
            </View>
            <View style={[styles.badge, { borderColor: colors.nbBorder, backgroundColor: colors.nbSoft }]}>
              <Text style={[styles.badgeText, { color: colors.nbInk }]}>{badge}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </HardShadow>
    );
  };

  const SectionHead = ({ title, hint, count, newLabel }) => (
    <View style={styles.sectionHead}>
      <Text style={[styles.sectionTitle, { color: colors.nbMuted }]}>{title}</Text>
      {hint ? (
        <Text style={[styles.sectionHint, { color: colors.nbMuted }]}>{hint}</Text>
      ) : null}
      {newLabel ? (
        <View style={[styles.newPill, { backgroundColor: colors.nbFill }]}>
          <Text style={[styles.newPillText, { color: colors.nbOnFill }]}>{newLabel}</Text>
        </View>
      ) : count != null && count > 0 ? (
        <Text style={[styles.sectionCount, { color: colors.nbMuted }]}>{count}</Text>
      ) : null}
    </View>
  );

  const NoteCard = ({ note }) => {
    const preview = String(note?.content || note?.preview || '').trim();
    const createdAt = note?.createdAt?.toDate?.() || note?.createdAt;
    const when = createdAt ? formatDateShort(createdAt) : null;
    const noteTitle = noteTitleForAudience(isTrainer, note);

    const openNote = async () => {
      try {
        await onMarkRead?.(note);
      } catch (_e) {
        /* mark-read is best-effort */
      }
      Alert.alert(noteTitle, preview || '—');
    };

    return (
      <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetSmall} style={{ marginBottom: 10 }}>
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={openNote}
          style={[
            styles.noteCard,
            { backgroundColor: colors.nbSoft, borderColor: colors.nbBorder },
          ]}
        >
          <Text style={[styles.noteText, { color: colors.nbInk }]} numberOfLines={4}>
            {preview || '—'}
          </Text>
          <Text style={[styles.noteMeta, { color: colors.nbMuted }]}>
            {noteTitle}
            {when ? ` · ${when}` : ''}
          </Text>
        </TouchableOpacity>
      </HardShadow>
    );
  };

  const EmptyCard = ({ message }) => (
    <View style={[styles.emptyCard, { borderColor: colors.nbBorder }]}>
      <Feather name="upload-cloud" size={28} color={colors.nbMuted} />
      <Text style={[styles.emptyText, { color: colors.nbMuted }]}>{message}</Text>
    </View>
  );

  const renderGrid = (files, badge) => (
    <View style={styles.grid}>
      {files.map((file) => (
        <FileCard key={file.id || file.url || file.name} file={file} badge={badge} />
      ))}
    </View>
  );

  const hasAnyContent =
    coachFiles.length > 0 || myFiles.length > 0 || notes.length > 0 || yourDocuments.length > 0;

  const heroTitle = isTrainer
    ? clientName
      ? String(clientName).trim()
      : 'Client files'
    : 'Your Notes & Files';
  const heroSub = isTrainer
    ? 'Shared uploads and documents for this client'
    : 'Everything shared between you and your coach, all in one place.';

  return (
    <View style={{ flex: 1 }}>
      {showHero ? (
        <View style={styles.heroOuter}>
          <Text style={[styles.heroTitle, { color: colors.nbInk }]}>{heroTitle}</Text>
          <Text style={[styles.heroSub, { color: colors.nbMuted }]}>{heroSub}</Text>
        </View>
      ) : null}

      <View style={styles.segmentWrap}>
        <NbSegmented
          segments={FILTER_SEGMENTS}
          selected={filter}
          onSelect={setFilter}
        />
      </View>

      {!hasAnyContent && isTrainer ? (
        <View style={styles.sectionWrap}>
          <EmptyCard message="No notes or files yet — add something for your client below" />
        </View>
      ) : null}

      {/* Trainer: client uploads first. Client: coach section when it has files/notes. */}
      {isTrainer ? (
        <View style={styles.sectionWrap}>
          <SectionHead title={labels.mySection} count={filteredMine.length} />
          {filteredMine.length > 0 ? (
            renderGrid(filteredMine, labels.myBadge)
          ) : (
            <EmptyCard message={labels.myEmpty} />
          )}
        </View>
      ) : filteredCoach.length > 0 || coachNotePreview.length > 0 ? (
        <View style={styles.sectionWrap}>
          <SectionHead
            title={labels.coachSection}
            count={filteredCoach.length}
            newLabel={newCount > 0 ? `${newCount} NEW` : null}
          />
          {coachNotePreview.map((note) => (
            <View key={note.id || String(note.createdAt)} style={{ paddingHorizontal: 16 }}>
              <NoteCard note={note} />
            </View>
          ))}
          {filteredCoach.length > 0 ? renderGrid(filteredCoach, labels.coachBadge) : null}
        </View>
      ) : null}

      <View style={styles.sectionWrap}>
        <SectionHead
          title={isTrainer ? labels.coachSection : labels.mySection}
          hint={!isTrainer ? labels.mySectionHint : null}
          count={isTrainer ? filteredCoach.length : filteredMine.length}
        />
        {isTrainer ? (
          filteredCoach.length > 0 ? (
            renderGrid(filteredCoach, labels.coachBadge)
          ) : (
            <EmptyCard message={labels.coachEmpty} />
          )
        ) : filteredMine.length > 0 ? (
          renderGrid(filteredMine, labels.myBadge)
        ) : (
          <EmptyCard message={labels.myEmpty} />
        )}
      </View>

      {filteredDocs.length > 0 ? (
        <View style={styles.sectionWrap}>
          <SectionHead title={labels.docsSection} count={filteredDocs.length} />
          {renderGrid(filteredDocs, labels.coachBadge)}
        </View>
      ) : null}

      {showNotes ? (
        <View style={styles.sectionWrap}>
          <SectionHead title={labels.notesSection} count={notesForList.length} />
          <View style={{ paddingHorizontal: 16 }}>
            {notesForList.map((note) => (
              <NoteCard key={note.id || String(note.createdAt)} note={note} />
            ))}
          </View>
        </View>
      ) : null}

      {onUploadPress ? (
        <View style={styles.uploadWrap}>
          <NbButton variant="fill" onPress={onUploadPress}>
            {uploadLabel}
          </NbButton>
        </View>
      ) : null}

      <DeleteFileSheet
        visible={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) onDeleteItem?.(pendingDelete);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  heroOuter: {
    paddingHorizontal: spacing.md,
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  heroTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 26,
    letterSpacing: -0.4,
  },
  heroSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },
  segmentWrap: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  sectionWrap: { marginBottom: 22 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: 12,
    gap: 8,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    letterSpacing: 1.2,
  },
  sectionHint: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  sectionCount: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    marginLeft: 'auto',
  },
  newPill: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  newPillText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 0.6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: 12,
  },
  cardShadow: {
    width: '47%',
    flexGrow: 1,
    maxWidth: '48%',
  },
  fileCard: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
  },
  thumb: {
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: nb.borderWidthDivider,
    overflow: 'hidden',
  },
  thumbIconCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  thumbImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  fileInfo: {
    padding: 12,
    gap: 8,
  },
  fileName: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fileMeta: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    flex: 1,
  },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: nb.borderWidthPill,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  noteCard: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    padding: 14,
  },
  noteText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
  },
  noteMeta: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    marginTop: 10,
  },
  emptyCard: {
    marginHorizontal: spacing.md,
    borderWidth: nb.borderWidth,
    borderStyle: 'dashed',
    borderRadius: borderRadius.nbCard,
    paddingVertical: 32,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  uploadWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: 24,
    marginTop: 4,
  },
});
