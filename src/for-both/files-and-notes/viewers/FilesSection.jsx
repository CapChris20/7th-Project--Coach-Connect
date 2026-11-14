// Notes & Files workspace (Design Law PNG 01 / 06) — filter chips + coach/my grids + notes.
// Flow: split items by who added them → filter by All/Photos/Videos/Documents → HardShadow cards.
// Used by the client home workspace and the trainer client workspace.
// Keep Firebase item keys (addedBy, type, url, documentId) unchanged.

import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../../look-and-feel/lightDarkMode';
import HardShadow from '../../../look-and-feel/HardShadow';
import NbButton from '../../../look-and-feel/NbButton';
import NbSegmented from '../../../look-and-feel/NbSegmented';
import NbPill from '../../../look-and-feel/NbPill';
import { borderRadius, nb, spacing } from '../../../look-and-feel/colorPalette';
import { formatDateShort, formatFileSize, getFileTypeFromItem } from '../../../helpers/fileSizeAndDateText';
import DeleteFileSheet from './DeleteFileSheet';
import NbSheet from '../../../look-and-feel/NbSheet';
import NbNoticeSheet from '../../../look-and-feel/NbNoticeSheet';
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

// Manipulate here: long-press before the actions sheet opens (ms)
const FILE_CARD_LONG_PRESS_MS = 380;

// ===== HELPER FUNCTIONS =====

function callIfFunction(maybeFunction, ...args) {
  if (typeof maybeFunction !== 'function') {
    return;
  }
  maybeFunction(...args);
}

async function callIfFunctionAsync(maybeFunction, ...args) {
  if (typeof maybeFunction !== 'function') {
    return;
  }
  await maybeFunction(...args);
}

function dateValueFromField(createdAtField) {
  if (!createdAtField) {
    return null;
  }
  if (typeof createdAtField.toDate === 'function') {
    return createdAtField.toDate();
  }
  return createdAtField;
}

function trainerDocumentCards(trainerDocuments) {
  const documentList = Array.isArray(trainerDocuments) ? trainerDocuments : [];
  const cards = [];
  for (let index = 0; index < documentList.length; index += 1) {
    const documentRecord = documentList[index];
    const sharedList = documentRecord.sharedWith;
    const sharedWithSomeone = Array.isArray(sharedList) && sharedList.length > 0;
    const documentTitle = documentRecord.title || 'Untitled';
    let displayName = documentTitle;
    if (sharedWithSomeone) {
      displayName = `${documentTitle} · Shared`;
    }
    cards.push({
      id: documentRecord.id,
      type: TYPE_DOCUMENT,
      name: displayName,
      title: documentTitle,
      createdAt: documentRecord.updatedAt || documentRecord.createdAt,
      addedBy: ADDED_BY_TRAINER,
      documentId: documentRecord.id,
    });
  }
  return cards;
}

function itemIsClientUpload(item) {
  if (!item) {
    return false;
  }
  const addedBy = item.addedBy || ADDED_BY_CLIENT;
  if (addedBy !== ADDED_BY_CLIENT) {
    return false;
  }
  if (item.type === TYPE_NOTE) {
    return false;
  }
  return true;
}

function itemIsTrainerUpload(item) {
  if (!item) {
    return false;
  }
  if (item.addedBy !== ADDED_BY_TRAINER) {
    return false;
  }
  if (item.type === TYPE_NOTE) {
    return false;
  }
  return true;
}

function itemIsCoachSideForClient(item) {
  if (!item) {
    return false;
  }
  const fromTrainer =
    item.addedBy === ADDED_BY_TRAINER ||
    (item.type === TYPE_DOCUMENT && item.trainerId);
  if (!fromTrainer) {
    return false;
  }
  if (item.type === TYPE_NOTE) {
    return false;
  }
  return true;
}

function collectMatchingItems(itemList, matchesItem) {
  const matched = [];
  for (let index = 0; index < itemList.length; index += 1) {
    const item = itemList[index];
    if (matchesItem(item)) {
      matched.push(item);
    }
  }
  return matched;
}

function splitItemsIntoSections(items, isTrainer, trainerDocuments) {
  const itemList = Array.isArray(items) ? items : [];
  const notes = collectMatchingItems(itemList, (item) => item && item.type === TYPE_NOTE);

  if (isTrainer) {
    return {
      coachFiles: collectMatchingItems(itemList, itemIsTrainerUpload),
      myFiles: collectMatchingItems(itemList, itemIsClientUpload),
      notes,
      yourDocuments: trainerDocumentCards(trainerDocuments),
    };
  }

  return {
    coachFiles: collectMatchingItems(itemList, itemIsCoachSideForClient),
    myFiles: collectMatchingItems(itemList, itemIsClientUpload),
    notes,
    yourDocuments: [],
  };
}

function sectionCopyForAudience(isTrainer) {
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

function filePassesSegmentFilter(file, activeFilter) {
  if (activeFilter === FILTER_ALL) {
    return true;
  }
  const detectedType = getFileTypeFromItem(file);
  const fileType = file && file.type;
  if (activeFilter === FILTER_PHOTOS) {
    return detectedType === 'image' || fileType === 'photo';
  }
  if (activeFilter === FILTER_VIDEOS) {
    return detectedType === 'video' || fileType === 'video';
  }
  if (activeFilter === FILTER_DOCUMENTS) {
    if (detectedType === 'pdf') return true;
    if (detectedType === 'document') return true;
    if (detectedType === 'spreadsheet') return true;
    if (detectedType === 'file') return true;
    if (fileType === 'doc') return true;
    if (fileType === 'pdf') return true;
    return false;
  }
  return true;
}

function filterFilesBySegment(files, activeFilter) {
  const filtered = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    if (filePassesSegmentFilter(file, activeFilter)) {
      filtered.push(file);
    }
  }
  return filtered;
}

function displayMetaForFile(file) {
  const detectedType = getFileTypeFromItem(file);
  let displayName = 'File';
  if (file && file.name) {
    displayName = file.name;
  } else if (file && file.title) {
    displayName = file.title;
  }
  const createdAtField = file ? file.createdAt : null;
  const createdAtValue = dateValueFromField(createdAtField);
  const dateText = createdAtValue ? formatDateShort(createdAtValue) : '';
  const sizeText = file && file.size ? formatFileSize(file.size) : '';
  const dateWithoutYear = dateText ? dateText.replace(/,?\s*\d{4}$/, '') : '';
  const typeLabel = TYPE_LABEL[detectedType] || TYPE_LABEL.file;
  const iconName = TYPE_ICON[detectedType] || TYPE_ICON.file;
  const metaParts = [];
  if (typeLabel) metaParts.push(typeLabel);
  if (dateWithoutYear || sizeText) metaParts.push(dateWithoutYear || sizeText);
  const metaLine = metaParts.join(' · ');
  return {
    displayName,
    dateWithoutYear,
    sizeText,
    detectedType,
    typeLabel,
    iconName,
    metaLine,
  };
}

function userMayDeleteFile(file, isTrainer, onDeleteItem) {
  if (!onDeleteItem || !file) {
    return false;
  }
  if (isTrainer) {
    return file.addedBy === ADDED_BY_TRAINER;
  }
  return file.addedBy !== ADDED_BY_TRAINER;
}

function noteHeadingForAudience(isTrainer, note) {
  const noteAddedBy = note ? note.addedBy : null;
  if (isTrainer) {
    if (noteAddedBy === ADDED_BY_TRAINER) {
      return 'Your note';
    }
    return 'From client';
  }
  if (noteAddedBy === ADDED_BY_CLIENT) {
    return 'Your note';
  }
  return 'From your coach';
}

function countUnreadItems(items) {
  let unreadCount = 0;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item && item.isRead === false) {
      unreadCount += 1;
    }
  }
  return unreadCount;
}

function unreadCoachItemsCount(coachFiles, notes) {
  return countUnreadItems(coachFiles) + countUnreadItems(notes);
}

function heroTitleText(isTrainer, clientName) {
  if (isTrainer) {
    const trimmedName = String(clientName || '').trim();
    if (trimmedName) {
      return trimmedName;
    }
    return 'Client files';
  }
  return 'Your Notes & Files';
}

function heroSubtitleText(isTrainer) {
  if (isTrainer) {
    return 'Shared uploads and documents for this client';
  }
  return 'Everything shared between you and your coach, all in one place.';
}

async function markItemReadThenRun(onMarkRead, item, nextStep) {
  try {
    await callIfFunctionAsync(onMarkRead, item);
  } catch (_ignored) {
    // Mark-read is best-effort — opening the item still happens.
  }
  callIfFunction(nextStep, item);
}

function thumbnailUriForFile(file, detectedType) {
  if (file && file.thumbnailUrl) {
    return file.thumbnailUrl;
  }
  const isPhoto = detectedType === 'image' || (file && file.type === 'photo');
  if (isPhoto) {
    if (file && file.url) return file.url;
    return null;
  }
  return null;
}

function pickCoachNotePreview(notes, isTrainer, activeFilter) {
  if (isTrainer) return [];
  if (activeFilter !== FILTER_ALL) return [];
  const coachNotes = [];
  for (let noteIndex = 0; noteIndex < notes.length; noteIndex += 1) {
    const note = notes[noteIndex];
    if (note && note.addedBy === ADDED_BY_TRAINER) {
      coachNotes.push(note);
      break;
    }
  }
  return coachNotes;
}

function notesWithoutPreviewId(notes, previewNoteId) {
  if (!previewNoteId) return notes;
  const filtered = [];
  for (let noteIndex = 0; noteIndex < notes.length; noteIndex += 1) {
    const note = notes[noteIndex];
    if (note && note.id === previewNoteId) continue;
    filtered.push(note);
  }
  return filtered;
}

function primarySectionForAudience(isTrainer, sectionLabels, filteredCoachFiles, filteredMyFiles) {
  if (isTrainer) {
    return {
      title: sectionLabels.coachSection,
      hint: null,
      files: filteredCoachFiles,
      badge: sectionLabels.coachBadge,
      emptyMessage: sectionLabels.coachEmpty,
    };
  }
  return {
    title: sectionLabels.mySection,
    hint: sectionLabels.mySectionHint,
    files: filteredMyFiles,
    badge: sectionLabels.myBadge,
    emptyMessage: sectionLabels.myEmpty,
  };
}

function noticeSheetTitle(noticePayload) {
  if (!noticePayload) return '';
  return noticePayload.title || '';
}

function noticeSheetMessage(noticePayload) {
  if (!noticePayload) return undefined;
  return noticePayload.message;
}

function noticeSheetConfirmLabel(noticePayload) {
  if (!noticePayload) return 'OK';
  return noticePayload.confirmLabel || 'OK';
}

function noticeSheetCancelLabel(noticePayload) {
  if (!noticePayload) return undefined;
  return noticePayload.cancelLabel;
}

function noticeSheetOnConfirm(noticePayload) {
  if (!noticePayload) return undefined;
  return noticePayload.onConfirm;
}

function fileActionsSheetTitle(fileActionsTarget) {
  if (!fileActionsTarget) return 'File';
  return fileActionsTarget.name || 'File';
}

function fileFromActionsTarget(fileActionsTarget) {
  if (!fileActionsTarget) return null;
  return fileActionsTarget.file || null;
}

// ===== IN-FILE UI PIECES (no hooks) =====

function FilesWorkspaceEmptyCard({ message, mutedColor, borderColor }) {
  return (
    <View style={[styles.emptyCard, { borderColor }]}>
      <Feather name="upload-cloud" size={28} color={mutedColor} />
      <Text style={[styles.emptyText, { color: mutedColor }]}>{message}</Text>
    </View>
  );
}

function FilesWorkspaceSectionHead({ title, hint, count, newLabel, mutedColor, fillColor, onFillColor }) {
  const showNewPill = Boolean(newLabel);
  const showCountOnRight = !showNewPill && count != null && count > 0;

  return (
    <View style={styles.sectionHead}>
      <Text style={[styles.sectionTitle, { color: mutedColor }]}>{title}</Text>
      {hint ? (
        <Text style={[styles.sectionHint, { color: mutedColor }]}>{hint}</Text>
      ) : null}
      {showNewPill ? (
        <View style={[styles.newPill, { backgroundColor: fillColor }]}>
          <Text style={[styles.newPillText, { color: onFillColor }]}>{newLabel}</Text>
        </View>
      ) : null}
      {showCountOnRight ? (
        <Text style={[styles.sectionCount, { color: mutedColor }]}>{count}</Text>
      ) : null}
    </View>
  );
}

function FilesWorkspaceNoteCard({
  note,
  isTrainer,
  inkColor,
  mutedColor,
  softBackground,
  borderColor,
  onMarkRead,
  onShowNotice,
}) {
  const rawContent = note && (note.content || note.preview);
  const previewText = String(rawContent || '').trim();
  const createdAtValue = dateValueFromField(note ? note.createdAt : null);
  const dateText = createdAtValue ? formatDateShort(createdAtValue) : null;
  const noteHeading = noteHeadingForAudience(isTrainer, note);
  const metaLine = dateText ? `${noteHeading} · ${dateText}` : noteHeading;

  const openNotePreview = () => {
    markItemReadThenRun(onMarkRead, note, () => {
      onShowNotice(noteHeading, previewText || '—');
    });
  };

  return (
    <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetSmall} style={{ marginBottom: 10 }}>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={openNotePreview}
        style={[styles.noteCard, { backgroundColor: softBackground, borderColor }]}
      >
        <Text style={[styles.noteText, { color: inkColor }]} numberOfLines={4}>
          {previewText || '—'}
        </Text>
        <Text style={[styles.noteMeta, { color: mutedColor }]}>{metaLine}</Text>
      </TouchableOpacity>
    </HardShadow>
  );
}

function FilesWorkspaceFileCard({
  file,
  badge,
  colors,
  onMarkRead,
  onOpenItem,
  onShowFileActionsMenu,
}) {
  const {
    displayName,
    dateWithoutYear,
    sizeText,
    detectedType,
    typeLabel,
    iconName,
    metaLine,
  } = displayMetaForFile(file);

  const thumbnailUri = thumbnailUriForFile(file, detectedType);
  const secondaryMeta = dateWithoutYear || sizeText || metaLine;

  const openFile = () => {
    markItemReadThenRun(onMarkRead, file, onOpenItem);
  };

  const openActionsMenu = () => {
    onShowFileActionsMenu({ file, name: displayName });
  };

  return (
    <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={styles.cardShadow}>
      <TouchableOpacity
        style={[styles.fileCard, { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder }]}
        activeOpacity={0.88}
        onPress={openFile}
        onLongPress={openActionsMenu}
        delayLongPress={FILE_CARD_LONG_PRESS_MS}
      >
        <View style={[styles.thumb, { backgroundColor: colors.nbSoft, borderColor: colors.nbBorder }]}>
          {thumbnailUri ? (
            <Image source={{ uri: thumbnailUri }} style={styles.thumbImage} resizeMode="cover" />
          ) : (
            <>
              <HatchedThumbFill />
              <View style={styles.thumbIconCenter}>
                <Feather name={iconName} size={28} color={colors.nbInk} />
              </View>
            </>
          )}
        </View>
        <View style={styles.fileInfo}>
          <Text style={[styles.fileName, { color: colors.nbInk }]} numberOfLines={2}>
            {displayName}
          </Text>
          <View style={styles.metaRow}>
            <NbPill variant="plain">{typeLabel}</NbPill>
            <Text style={[styles.fileMeta, { color: colors.nbMuted }]} numberOfLines={1}>
              {secondaryMeta}
            </Text>
          </View>
          <View style={[styles.badge, { borderColor: colors.nbBorder, backgroundColor: colors.nbSoft }]}>
            <Text style={[styles.badgeText, { color: colors.nbInk }]}>{badge}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </HardShadow>
  );
}

function buildFileCardElements(files, badge, colors, onMarkRead, onOpenItem, onShowFileActionsMenu) {
  const cards = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const cardKey = file.id || file.url || file.name;
    cards.push(
      <FilesWorkspaceFileCard
        key={cardKey}
        file={file}
        badge={badge}
        colors={colors}
        onMarkRead={onMarkRead}
        onOpenItem={onOpenItem}
        onShowFileActionsMenu={onShowFileActionsMenu}
      />,
    );
  }
  return cards;
}

function FilesWorkspaceFileGrid({
  files,
  badge,
  colors,
  onMarkRead,
  onOpenItem,
  onShowFileActionsMenu,
}) {
  const cards = buildFileCardElements(
    files,
    badge,
    colors,
    onMarkRead,
    onOpenItem,
    onShowFileActionsMenu,
  );
  return <View style={styles.grid}>{cards}</View>;
}

function FilesWorkspaceGridOrEmpty({
  files,
  badge,
  emptyMessage,
  colors,
  onMarkRead,
  onOpenItem,
  onShowFileActionsMenu,
}) {
  if (files.length > 0) {
    return (
      <FilesWorkspaceFileGrid
        files={files}
        badge={badge}
        colors={colors}
        onMarkRead={onMarkRead}
        onOpenItem={onOpenItem}
        onShowFileActionsMenu={onShowFileActionsMenu}
      />
    );
  }
  return (
    <FilesWorkspaceEmptyCard
      message={emptyMessage}
      mutedColor={colors.nbMuted}
      borderColor={colors.nbBorder}
    />
  );
}

function buildNoteCardElements(notes, isTrainer, colors, onMarkRead, onShowNotice, wrapInPad) {
  const cards = [];
  for (let index = 0; index < notes.length; index += 1) {
    const note = notes[index];
    const noteKey = note.id || String(note.createdAt);
    const card = (
      <FilesWorkspaceNoteCard
        note={note}
        isTrainer={isTrainer}
        inkColor={colors.nbInk}
        mutedColor={colors.nbMuted}
        softBackground={colors.nbSoft}
        borderColor={colors.nbBorder}
        onMarkRead={onMarkRead}
        onShowNotice={onShowNotice}
      />
    );
    if (wrapInPad) {
      cards.push(
        <View key={noteKey} style={{ paddingHorizontal: 16 }}>
          {card}
        </View>,
      );
    } else {
      cards.push(
        <React.Fragment key={noteKey}>{card}</React.Fragment>,
      );
    }
  }
  return cards;
}

// ===== MAIN FUNCTION =====

/**
 * Notes & Files workspace body (filter + sections + sheets).
 * Hook order frozen.
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
  const [activeFilter, setActiveFilter] = useState(FILTER_ALL);
  const [fileAwaitingDelete, setFileAwaitingDelete] = useState(null);
  const [fileActionsTarget, setFileActionsTarget] = useState(null);
  const [noticePayload, setNoticePayload] = useState(null);

  const showNoticeSheet = (title, message, extras = {}) => {
    setNoticePayload({ title, message, ...extras });
  };

  // 1. Bucket Firebase items into coach / client / notes / trainer docs.
  const { coachFiles, myFiles, notes, yourDocuments } = useMemo(
    () => splitItemsIntoSections(items, isTrainer, trainerDocuments),
    [items, isTrainer, trainerDocuments],
  );

  const sectionLabels = sectionCopyForAudience(isTrainer);
  const newFromCoachCount = unreadCoachItemsCount(coachFiles, notes);

  // 2. Apply the segment filter to each grid.
  const filteredCoachFiles = useMemo(
    () => filterFilesBySegment(coachFiles, activeFilter),
    [coachFiles, activeFilter],
  );
  const filteredMyFiles = useMemo(
    () => filterFilesBySegment(myFiles, activeFilter),
    [myFiles, activeFilter],
  );
  const filteredTrainerDocs = useMemo(
    () => filterFilesBySegment(yourDocuments, activeFilter),
    [yourDocuments, activeFilter],
  );

  // 3. Client “All” tab: one coach note preview above the coach file grid.
  const coachNotePreview = pickCoachNotePreview(notes, isTrainer, activeFilter);
  let previewNoteId = null;
  if (coachNotePreview.length > 0 && coachNotePreview[0].id) {
    previewNoteId = coachNotePreview[0].id;
  }
  const notesForCoachingList = notesWithoutPreviewId(notes, previewNoteId);
  const showCoachingNotesSection =
    activeFilter === FILTER_ALL && notesForCoachingList.length > 0;

  const heroTitle = heroTitleText(isTrainer, clientName);
  const heroSubtitle = heroSubtitleText(isTrainer);
  const workspaceHasAnyContent =
    coachFiles.length > 0 ||
    myFiles.length > 0 ||
    notes.length > 0 ||
    yourDocuments.length > 0;

  const showTrainerEmptyWorkspace = !workspaceHasAnyContent && isTrainer;
  const showClientCoachSection =
    !isTrainer && (filteredCoachFiles.length > 0 || coachNotePreview.length > 0);

  let newItemsLabel = null;
  if (newFromCoachCount > 0) {
    newItemsLabel = `${newFromCoachCount} NEW`;
  }

  const primarySection = primarySectionForAudience(
    isTrainer,
    sectionLabels,
    filteredCoachFiles,
    filteredMyFiles,
  );
  const primarySectionTitle = primarySection.title;
  const primarySectionHint = primarySection.hint;
  const primarySectionFiles = primarySection.files;
  const primarySectionBadge = primarySection.badge;
  const primarySectionEmpty = primarySection.emptyMessage;

  const closeFileActionsSheet = () => setFileActionsTarget(null);

  const runOpenFromActionsSheet = () => {
    const chosenFile = fileFromActionsTarget(fileActionsTarget);
    closeFileActionsSheet();
    callIfFunction(onOpenItem, chosenFile);
  };

  const runDownloadFromActionsSheet = () => {
    const chosenFile = fileFromActionsTarget(fileActionsTarget);
    closeFileActionsSheet();
    callIfFunction(onDownloadItem, chosenFile);
  };

  const runShareFromActionsSheet = () => {
    const chosenFile = fileFromActionsTarget(fileActionsTarget);
    closeFileActionsSheet();
    callIfFunction(onShareItem, chosenFile);
  };

  const runDeleteFromActionsSheet = () => {
    const chosenFile = fileFromActionsTarget(fileActionsTarget);
    closeFileActionsSheet();
    if (chosenFile) {
      setFileAwaitingDelete(chosenFile);
    }
  };

  const confirmDeleteAwaitingFile = () => {
    if (fileAwaitingDelete) {
      callIfFunction(onDeleteItem, fileAwaitingDelete);
    }
  };

  const actionsMenuFile = fileFromActionsTarget(fileActionsTarget);
  const showDeleteInActionsMenu = userMayDeleteFile(actionsMenuFile, isTrainer, onDeleteItem);

  const coachNotePreviewCards = buildNoteCardElements(
    coachNotePreview,
    isTrainer,
    colors,
    onMarkRead,
    showNoticeSheet,
    true,
  );
  const coachingNotesCards = buildNoteCardElements(
    notesForCoachingList,
    isTrainer,
    colors,
    onMarkRead,
    showNoticeSheet,
    false,
  );

  // 4. Paint hero, segments, section grids, upload, and sheets.
  return (
    <View style={{ flex: 1 }}>
      {showHero ? (
        <View style={styles.heroOuter}>
          <Text style={[styles.heroTitle, { color: colors.nbInk }]}>{heroTitle}</Text>
          <Text style={[styles.heroSub, { color: colors.nbMuted }]}>{heroSubtitle}</Text>
        </View>
      ) : null}

      <View style={styles.segmentWrap}>
        <NbSegmented
          segments={FILTER_SEGMENTS}
          selected={activeFilter}
          onSelect={setActiveFilter}
        />
      </View>

      {showTrainerEmptyWorkspace ? (
        <View style={styles.sectionWrap}>
          <FilesWorkspaceEmptyCard
            message="No notes or files yet — add something for your client below"
            mutedColor={colors.nbMuted}
            borderColor={colors.nbBorder}
          />
        </View>
      ) : null}

      {isTrainer ? (
        <View style={styles.sectionWrap}>
          <FilesWorkspaceSectionHead
            title={sectionLabels.mySection}
            count={filteredMyFiles.length}
            mutedColor={colors.nbMuted}
            fillColor={colors.nbFill}
            onFillColor={colors.nbOnFill}
          />
          <FilesWorkspaceGridOrEmpty
            files={filteredMyFiles}
            badge={sectionLabels.myBadge}
            emptyMessage={sectionLabels.myEmpty}
            colors={colors}
            onMarkRead={onMarkRead}
            onOpenItem={onOpenItem}
            onShowFileActionsMenu={setFileActionsTarget}
          />
        </View>
      ) : null}

      {showClientCoachSection ? (
        <View style={styles.sectionWrap}>
          <FilesWorkspaceSectionHead
            title={sectionLabels.coachSection}
            count={filteredCoachFiles.length}
            newLabel={newItemsLabel}
            mutedColor={colors.nbMuted}
            fillColor={colors.nbFill}
            onFillColor={colors.nbOnFill}
          />
          {coachNotePreviewCards}
          {filteredCoachFiles.length > 0 ? (
            <FilesWorkspaceFileGrid
              files={filteredCoachFiles}
              badge={sectionLabels.coachBadge}
              colors={colors}
              onMarkRead={onMarkRead}
              onOpenItem={onOpenItem}
              onShowFileActionsMenu={setFileActionsTarget}
            />
          ) : null}
        </View>
      ) : null}

      <View style={styles.sectionWrap}>
        <FilesWorkspaceSectionHead
          title={primarySectionTitle}
          hint={primarySectionHint}
          count={primarySectionFiles.length}
          mutedColor={colors.nbMuted}
          fillColor={colors.nbFill}
          onFillColor={colors.nbOnFill}
        />
        <FilesWorkspaceGridOrEmpty
          files={primarySectionFiles}
          badge={primarySectionBadge}
          emptyMessage={primarySectionEmpty}
          colors={colors}
          onMarkRead={onMarkRead}
          onOpenItem={onOpenItem}
          onShowFileActionsMenu={setFileActionsTarget}
        />
      </View>

      {filteredTrainerDocs.length > 0 ? (
        <View style={styles.sectionWrap}>
          <FilesWorkspaceSectionHead
            title={sectionLabels.docsSection}
            count={filteredTrainerDocs.length}
            mutedColor={colors.nbMuted}
            fillColor={colors.nbFill}
            onFillColor={colors.nbOnFill}
          />
          <FilesWorkspaceFileGrid
            files={filteredTrainerDocs}
            badge={sectionLabels.coachBadge}
            colors={colors}
            onMarkRead={onMarkRead}
            onOpenItem={onOpenItem}
            onShowFileActionsMenu={setFileActionsTarget}
          />
        </View>
      ) : null}

      {showCoachingNotesSection ? (
        <View style={styles.sectionWrap}>
          <FilesWorkspaceSectionHead
            title={sectionLabels.notesSection}
            count={notesForCoachingList.length}
            mutedColor={colors.nbMuted}
            fillColor={colors.nbFill}
            onFillColor={colors.nbOnFill}
          />
          <View style={{ paddingHorizontal: 16 }}>{coachingNotesCards}</View>
        </View>
      ) : null}

      {onUploadPress ? (
        <View style={styles.uploadWrap}>
          <NbButton variant="fill" onPress={onUploadPress}>
            {uploadLabel}
          </NbButton>
        </View>
      ) : null}

      <NbSheet
        visible={!!fileActionsTarget}
        onClose={closeFileActionsSheet}
        title={fileActionsSheetTitle(fileActionsTarget)}
      >
        <View style={{ gap: 10, paddingHorizontal: spacing.md, paddingBottom: spacing.lg }}>
          <NbButton variant="fill" onPress={runOpenFromActionsSheet}>
            Open
          </NbButton>
          <NbButton variant="plain" onPress={runDownloadFromActionsSheet}>
            Download
          </NbButton>
          <NbButton variant="plain" onPress={runShareFromActionsSheet}>
            Share
          </NbButton>
          {showDeleteInActionsMenu ? (
            <NbButton variant="plain" onPress={runDeleteFromActionsSheet}>
              Delete
            </NbButton>
          ) : null}
          <NbButton variant="ghost" onPress={closeFileActionsSheet}>
            Cancel
          </NbButton>
        </View>
      </NbSheet>

      <DeleteFileSheet
        visible={!!fileAwaitingDelete}
        onClose={() => setFileAwaitingDelete(null)}
        onConfirm={confirmDeleteAwaitingFile}
      />

      <NbNoticeSheet
        visible={!!noticePayload}
        onClose={() => setNoticePayload(null)}
        title={noticeSheetTitle(noticePayload)}
        message={noticeSheetMessage(noticePayload)}
        confirmLabel={noticeSheetConfirmLabel(noticePayload)}
        cancelLabel={noticeSheetCancelLabel(noticePayload)}
        onConfirm={noticeSheetOnConfirm(noticePayload)}
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
