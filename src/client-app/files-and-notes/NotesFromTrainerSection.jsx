// "Notes from trainer" block on the client's files screen — Design Law cards + sheet.
// Flow: filter mixed items → newest first → show 3 → tap opens NbSheet and marks read; "See all" same sheet.
// Used by: the client files screen. The parent owns fetching; this file only presents `items`.
// vocab: NbCard / NbSheet / HardShadow = Design Law chrome; unread uses soft fill + nbBorder (never pink)

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
const ALL_NOTES_MODE = 'all';
const FALLBACK_NOTE_TITLE = 'Note from your coach';
const EMPTY_BODY_PLACEHOLDER = '—';
// Manipulate here: how many notes appear inline before "See all" takes over.
const INLINE_NOTE_COUNT = 3;

// ===== HELPER FUNCTIONS =====

function isTrainerNote(item) {
  return item?.type === NOTE_TYPE && item?.addedBy === ADDED_BY_TRAINER;
}

function createdAtAsDate(createdAt) {
  if (createdAt instanceof Date) return createdAt;
  return createdAt?.toDate?.() || createdAt;
}

function sortNotesNewestFirst(notes) {
  notes.sort((leftNote, rightNote) => {
    return new Date(rightNote.createdAt || 0) - new Date(leftNote.createdAt || 0);
  });
}

function trainerNotesFromItems(items) {
  const list = Array.isArray(items) ? items : [];
  const notes = list.filter(isTrainerNote).map((item) => ({
    ...item,
    createdAt: createdAtAsDate(item?.createdAt),
  }));
  sortNotesNewestFirst(notes);
  return notes;
}

function countUnreadNotes(notes) {
  return notes.filter((note) => note?.isRead === false).length;
}

function displayNoteTitle(note) {
  return note?.title || FALLBACK_NOTE_TITLE;
}

function displayNoteBody(note) {
  return String(note?.content || '').trim() || EMPTY_BODY_PLACEHOLDER;
}

function isNoteUnread(note) {
  return note?.isRead === false;
}

async function openNoteAndMarkRead(note, setSelected, onMarkRead) {
  setSelected(note);
  if (!isNoteUnread(note)) return;
  try {
    await onMarkRead?.(note);
  } catch {
    // mark-read is best-effort; the sheet stays open
  }
}

function TrainerNoteRow({ note, onPress, colors }) {
  const unread = isNoteUnread(note);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <NbCard
        style={[
          styles.noteCard,
          unread && { backgroundColor: colors.nbSoft },
        ]}
        noShadow={!unread}
      >
        <View style={styles.noteRow}>
          <View style={styles.noteTextCol}>
            <Text style={[styles.noteTitle, { color: colors.nbInk }]} numberOfLines={1}>
              {displayNoteTitle(note)}
            </Text>
            <Text style={[styles.noteBody, { color: colors.nbMuted }]} numberOfLines={2}>
              {displayNoteBody(note)}
            </Text>
            <Text style={[styles.noteDate, { color: colors.nbMuted }]}>
              {note?.createdAt ? formatDateShort(note.createdAt) : ''}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.nbMuted} />
        </View>
      </NbCard>
    </TouchableOpacity>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Notes-from-trainer section: three newest notes, unread pill, and a shared detail/list sheet.
 */
export function NotesFromTrainerSection({ items, onMarkRead }) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState(null);

  const notes = useMemo(() => trainerNotesFromItems(items), [items]);

  const displayed = notes.slice(0, INLINE_NOTE_COUNT);
  const hasMore = notes.length > INLINE_NOTE_COUNT;
  const unreadCount = countUnreadNotes(notes);
  const isAllNotesMode = selected?.__mode === ALL_NOTES_MODE;
  const sheetTitle = isAllNotesMode ? 'All notes' : displayNoteTitle(selected);

  const openNote = async (note) => {
    await openNoteAndMarkRead(note, setSelected, onMarkRead);
  };

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: colors.nbMuted }]}>NOTES FROM TRAINER</Text>
        {unreadCount > 0 ? (
          <View
            style={[
              styles.unreadPill,
              { backgroundColor: colors.nbSoft, borderColor: colors.nbBorder },
            ]}
          >
            <Text style={[styles.unreadPillText, { color: colors.nbInk }]}>
              {unreadCount} unread
            </Text>
          </View>
        ) : null}
      </View>

      {notes.length === 0 ? (
        <NbCard style={styles.emptyCard} noShadow>
          <Text style={[styles.emptyText, { color: colors.nbMuted }]}>
            No notes yet. Check back for updates from your coach.
          </Text>
        </NbCard>
      ) : (
        <View style={styles.list}>
          {displayed.map((note) => (
            <TrainerNoteRow
              key={note.id}
              note={note}
              onPress={() => openNote(note)}
              colors={colors}
            />
          ))}

          {hasMore ? (
            <NbButton variant="plain" onPress={() => setSelected({ __mode: ALL_NOTES_MODE })}>
              {`See all ${notes.length} notes`}
            </NbButton>
          ) : null}
        </View>
      )}

      <NbSheet
        visible={!!selected}
        onClose={() => setSelected(null)}
        title={sheetTitle || 'Note'}
      >
        {isAllNotesMode ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetList}>
            {notes.map((note) => (
              <TrainerNoteRow
                key={note.id}
                note={note}
                onPress={() => openNote(note)}
                colors={colors}
              />
            ))}
          </ScrollView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.sheetDate, { color: colors.nbMuted }]}>
              {selected?.createdAt ? formatDateShort(selected.createdAt) : ''}
            </Text>
            <Text style={[styles.sheetBody, { color: colors.nbInk }]}>
              {displayNoteBody(selected)}
            </Text>
          </ScrollView>
        )}
      </NbSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 26,
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
