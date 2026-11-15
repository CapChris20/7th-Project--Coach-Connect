// "Notes from trainer" block on the client's files screen — Design Law cards + detail sheet.
// Flow: filter mixed items → newest first → show 3 inline → tap opens NbSheet and marks read.
// Used by the client files screen. Parent owns fetching; this file only presents `items`.

import React, { useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { formatDateShort } from '../../helpers/fileSizeAndDateText';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { nb } from '../../look-and-feel/colorPalette';
import NbCard from '../../look-and-feel/NbCard';
import NbSheet from '../../look-and-feel/NbSheet';
import NbButton from '../../look-and-feel/NbButton';

// ===== NAMED CONSTANTS =====

const NOTE_TYPE = 'note';
const ADDED_BY_TRAINER = 'trainer';
// vocab: ALL_NOTES_MODE = sentinel stuck on `selected` so the same NbSheet shows the full list
const ALL_NOTES_MODE = 'all';
const FALLBACK_NOTE_TITLE = 'Note from your coach';
const EMPTY_BODY_PLACEHOLDER = '—';
const DEFAULT_SHEET_TITLE = 'Note';
const ALL_NOTES_SHEET_TITLE = 'All notes';
const SECTION_TITLE = 'NOTES FROM TRAINER';
const EMPTY_NOTES_COPY = 'No notes yet. Check back for updates from your coach.';

// Manipulate here: how many notes appear inline before "See all" takes over.
const INLINE_NOTE_COUNT = 3;
const SECTION_BOTTOM_GAP = 26;

// ===== HELPER FUNCTIONS =====

function isTrainerNote(item) {
  if (!item) return false;
  if (item.type !== NOTE_TYPE) return false;
  if (item.addedBy !== ADDED_BY_TRAINER) return false;
  return true;
}

function createdAtAsDate(createdAt) {
  if (createdAt instanceof Date) return createdAt;
  if (createdAt && typeof createdAt.toDate === 'function') {
    return createdAt.toDate();
  }
  return createdAt;
}

function sortNotesNewestFirst(notes) {
  notes.sort((leftNote, rightNote) => {
    const rightTime = new Date(rightNote.createdAt || 0);
    const leftTime = new Date(leftNote.createdAt || 0);
    return rightTime - leftTime;
  });
}

function trainerNotesNewestFirst(items) {
  const list = Array.isArray(items) ? items : [];
  const notes = [];
  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];
    if (!isTrainerNote(item)) continue;
    notes.push({
      ...item,
      createdAt: createdAtAsDate(item.createdAt),
    });
  }
  sortNotesNewestFirst(notes);
  return notes;
}

function countUnreadNotes(notes) {
  let unreadCount = 0;
  for (let index = 0; index < notes.length; index += 1) {
    const note = notes[index];
    if (note && note.isRead === false) {
      unreadCount += 1;
    }
  }
  return unreadCount;
}

function displayNoteTitle(note) {
  if (!note) return FALLBACK_NOTE_TITLE;
  if (note.title) return note.title;
  return FALLBACK_NOTE_TITLE;
}

function displayNoteBody(note) {
  if (!note) return EMPTY_BODY_PLACEHOLDER;
  const trimmed = String(note.content || '').trim();
  if (trimmed) return trimmed;
  return EMPTY_BODY_PLACEHOLDER;
}

function noteIsMarkedUnread(note) {
  // Strict false — missing isRead does not count as unread.
  if (!note) return false;
  return note.isRead === false;
}

function noteDateText(note) {
  if (!note) return '';
  if (!note.createdAt) return '';
  return formatDateShort(note.createdAt);
}

function sheetTitleForSelection(selected, isAllNotesMode) {
  if (isAllNotesMode) return ALL_NOTES_SHEET_TITLE;
  if (selected) return displayNoteTitle(selected);
  return DEFAULT_SHEET_TITLE;
}

function selectionIsAllNotesMode(selected) {
  if (!selected) return false;
  return selected.__mode === ALL_NOTES_MODE;
}

function NotesSectionHeader({ colors, unreadCount }) {
  const showUnreadPill = unreadCount > 0;
  const unreadLabel = `${unreadCount} unread`;

  return (
    <View style={styles.headerRow}>
      <Text style={[styles.sectionTitle, { color: colors.nbMuted }]}>{SECTION_TITLE}</Text>
      {showUnreadPill ? (
        <View
          style={[
            styles.unreadPill,
            { backgroundColor: colors.nbSoft, borderColor: colors.nbBorder },
          ]}
        >
          <Text style={[styles.unreadPillText, { color: colors.nbInk }]}>{unreadLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

function EmptyNotesCard({ colors }) {
  return (
    <NbCard style={styles.emptyCard} noShadow>
      <Text style={[styles.emptyText, { color: colors.nbMuted }]}>{EMPTY_NOTES_COPY}</Text>
    </NbCard>
  );
}

function TrainerNoteRow({ note, onPress, colors }) {
  const noteIsUnread = noteIsMarkedUnread(note);
  const titleText = displayNoteTitle(note);
  const bodyText = displayNoteBody(note);
  const dateText = noteDateText(note);
  const softUnreadFill = noteIsUnread ? { backgroundColor: colors.nbSoft } : null;
  // Unread keeps the hard shadow; read notes sit flatter.
  const dropShadow = !noteIsUnread;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <NbCard style={[styles.noteCard, softUnreadFill]} noShadow={dropShadow}>
        <View style={styles.noteRow}>
          <View style={styles.noteTextCol}>
            <Text style={[styles.noteTitle, { color: colors.nbInk }]} numberOfLines={1}>
              {titleText}
            </Text>
            <Text style={[styles.noteBody, { color: colors.nbMuted }]} numberOfLines={2}>
              {bodyText}
            </Text>
            <Text style={[styles.noteDate, { color: colors.nbMuted }]}>{dateText}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.nbMuted} />
        </View>
      </NbCard>
    </TouchableOpacity>
  );
}

function NoteDetailScroll({ note, colors }) {
  const dateText = noteDateText(note);
  const bodyText = displayNoteBody(note);

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={[styles.sheetDate, { color: colors.nbMuted }]}>{dateText}</Text>
      <Text style={[styles.sheetBody, { color: colors.nbInk }]}>{bodyText}</Text>
    </ScrollView>
  );
}

function buildNoteRows(notes, onNotePress, colors) {
  const rows = [];
  for (let index = 0; index < notes.length; index += 1) {
    const note = notes[index];
    const openThisNote = () => onNotePress(note);
    rows.push(
      <TrainerNoteRow
        key={note.id}
        note={note}
        onPress={openThisNote}
        colors={colors}
      />,
    );
  }
  return rows;
}

function AllNotesListScroll({ notes, onNotePress, colors }) {
  const noteRows = buildNoteRows(notes, onNotePress, colors);
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetList}>
      {noteRows}
    </ScrollView>
  );
}

function InlineNotesList({
  inlineNotes,
  hasMoreNotes,
  totalNoteCount,
  onOpenNote,
  onSeeAll,
  colors,
}) {
  const seeAllLabel = `See all ${totalNoteCount} notes`;
  const noteRows = buildNoteRows(inlineNotes, onOpenNote, colors);

  return (
    <View style={styles.list}>
      {noteRows}

      {hasMoreNotes ? (
        <NbButton variant="plain" onPress={onSeeAll}>
          {seeAllLabel}
        </NbButton>
      ) : null}
    </View>
  );
}

function NotesSectionBody({
  noNotesYet,
  colors,
  inlineNotes,
  hasMoreNotes,
  totalNoteCount,
  onOpenNote,
  onSeeAll,
}) {
  if (noNotesYet) {
    return <EmptyNotesCard colors={colors} />;
  }
  return (
    <InlineNotesList
      inlineNotes={inlineNotes}
      hasMoreNotes={hasMoreNotes}
      totalNoteCount={totalNoteCount}
      onOpenNote={onOpenNote}
      onSeeAll={onSeeAll}
      colors={colors}
    />
  );
}

function NotesSheetBody({ isAllNotesMode, notes, selected, onNotePress, colors }) {
  if (isAllNotesMode) {
    return <AllNotesListScroll notes={notes} onNotePress={onNotePress} colors={colors} />;
  }
  return <NoteDetailScroll note={selected} colors={colors} />;
}

async function markNoteReadIfNeeded(note, onMarkRead) {
  if (!noteIsMarkedUnread(note)) return;
  if (!onMarkRead) return;
  try {
    await onMarkRead(note);
  } catch {
    // Sheet stays open even if the write fails.
  }
}

// ===== MAIN FUNCTION =====

/**
 * Notes-from-trainer section: three newest notes, unread pill, and a shared detail/list sheet.
 * @param {{ items: Array, onMarkRead?: Function }} props
 */
export function NotesFromTrainerSection({ items, onMarkRead }) {
  const { colors } = useTheme();
  // vocab: selected = either one note object, or { __mode: 'all' } for the full-list sheet
  const [selected, setSelected] = useState(null);

  const notes = useMemo(() => trainerNotesNewestFirst(items), [items]);

  const inlineNotes = notes.slice(0, INLINE_NOTE_COUNT);
  const hasMoreNotes = notes.length > INLINE_NOTE_COUNT;
  const unreadCount = countUnreadNotes(notes);
  const isAllNotesMode = selectionIsAllNotesMode(selected);
  const sheetIsOpen = !!selected;
  const noNotesYet = notes.length === 0;
  const sheetTitle = sheetTitleForSelection(selected, isAllNotesMode) || DEFAULT_SHEET_TITLE;

  async function openTrainerNote(note) {
    // 1. Show this note in the sheet (or keep "all notes" list if that mode is already up).
    setSelected(note);

    // 2. Mark unread notes read in the background — best effort only.
    await markNoteReadIfNeeded(note, onMarkRead);
  }

  function openSeeAllNotes() {
    setSelected({ __mode: ALL_NOTES_MODE });
  }

  function closeNoteSheet() {
    setSelected(null);
  }

  return (
    <View style={styles.section}>
      <NotesSectionHeader colors={colors} unreadCount={unreadCount} />
      <NotesSectionBody
        noNotesYet={noNotesYet}
        colors={colors}
        inlineNotes={inlineNotes}
        hasMoreNotes={hasMoreNotes}
        totalNoteCount={notes.length}
        onOpenNote={openTrainerNote}
        onSeeAll={openSeeAllNotes}
      />
      <NbSheet visible={sheetIsOpen} onClose={closeNoteSheet} title={sheetTitle}>
        <NotesSheetBody
          isAllNotesMode={isAllNotesMode}
          notes={notes}
          selected={selected}
          onNotePress={openTrainerNote}
          colors={colors}
        />
      </NbSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: SECTION_BOTTOM_GAP,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  unreadPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: nb.borderWidthPill,
  },
  unreadPillText: {
    fontWeight: '900',
    fontSize: 11,
  },
  emptyCard: {
    paddingVertical: 18,
    paddingHorizontal: 14,
  },
  emptyText: {
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  list: {
    gap: 10,
  },
  noteCard: {
    padding: 12,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  noteTextCol: {
    flex: 1,
    gap: 6,
  },
  noteTitle: {
    fontWeight: '900',
    fontSize: 14,
  },
  noteBody: {
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 18,
  },
  noteDate: {
    fontWeight: '700',
    fontSize: 11,
  },
  sheetList: {
    gap: 10,
    paddingBottom: 10,
  },
  sheetDate: {
    fontWeight: '800',
    fontSize: 12,
    marginBottom: 10,
  },
  sheetBody: {
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 22,
  },
});
