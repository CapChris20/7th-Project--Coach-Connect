// "Notes from trainer" block on the client's files screen: 3 most recent notes + an unread badge.
// Flow: filter mixed items → newest first → show 3 → tap opens a sheet and marks read; "See all" is the same sheet.
// Used by: the client files screen. The parent owns fetching; this file only presents `items`.

import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { formatDateShort } from '../../helpers/fileSizeAndDateText';
import { useTheme } from '../../look-and-feel/lightDarkMode';

// ===== NAMED CONSTANTS =====

const NOTE_TYPE = 'note';
const ADDED_BY_TRAINER = 'trainer';
const ALL_NOTES_MODE = 'all';
const FALLBACK_NOTE_TITLE = 'Note from your coach';
const EMPTY_BODY_PLACEHOLDER = '—';
// Manipulate here: how many notes appear inline before "See all" takes over.
const INLINE_NOTE_COUNT = 3;
const UNREAD_PILL_FILL = 'rgba(255, 107, 157, 0.18)';
const UNREAD_PILL_BORDER = 'rgba(255, 107, 157, 0.45)';
const UNREAD_PILL_TEXT = '#FF6B9D';
const UNREAD_ROW_FILL = 'rgba(255, 107, 157, 0.10)';
const UNREAD_ROW_BORDER = 'rgba(255, 107, 157, 0.35)';
const READ_ROW_FILL = 'rgba(255,255,255,0.04)';
const READ_ROW_BORDER = 'rgba(255,255,255,0.10)';

// ===== HELPER FUNCTIONS =====

/**
 * The client's own notes live in the same list, so we require both type=note AND addedBy=trainer.
 * @param {object} item
 * @returns {boolean}
 */
function isTrainerNote(item) {
  return item?.type === NOTE_TYPE && item?.addedBy === ADDED_BY_TRAINER;
}

/**
 * createdAt arrives as a Date, a Firestore Timestamp, or a cached string. Normalize so sort and
 * formatDateShort only deal with one type.
 * vocab: ?.toDate?.() = call toDate only if the value exists AND has that method.
 * @param {*} createdAt
 */
function createdAtAsDate(createdAt) {
  if (createdAt instanceof Date) return createdAt;
  return createdAt?.toDate?.() || createdAt;
}

/**
 * Newest first. Missing dates go to epoch (0) so the comparison never becomes NaN.
 * @param {object[]} notes
 */
function sortNotesNewestFirst(notes) {
  notes.sort((leftNote, rightNote) => {
    return new Date(rightNote.createdAt || 0) - new Date(leftNote.createdAt || 0);
  });
}

/**
 * @param {Array} items
 * @returns {object[]}
 */
function trainerNotesFromItems(items) {
  const list = Array.isArray(items) ? items : [];
  const notes = list.filter(isTrainerNote).map((item) => ({
    ...item,
    createdAt: createdAtAsDate(item?.createdAt),
  }));
  sortNotesNewestFirst(notes);
  return notes;
}

/**
 * Strict === false: a note with no isRead field is legacy data and counts as already read,
 * so old notes do not suddenly light up the unread badge.
 * @param {object[]} notes
 * @returns {number}
 */
function countUnreadNotes(notes) {
  return notes.filter((note) => note?.isRead === false).length;
}

/**
 * @param {object} note
 * @returns {string}
 */
function displayNoteTitle(note) {
  return note?.title || FALLBACK_NOTE_TITLE;
}

/**
 * @param {object} note
 * @returns {string}
 */
function displayNoteBody(note) {
  return String(note?.content || '').trim() || EMPTY_BODY_PLACEHOLDER;
}

/**
 * @param {object} note
 * @returns {boolean}
 */
function isNoteUnread(note) {
  return note?.isRead === false;
}

/**
 * Open the sheet first so the UI responds instantly, then write the read receipt.
 * A failed write still leaves the note open — the user can read it either way.
 * @param {object} note
 * @param {Function} setSelected
 * @param {Function} [onMarkRead]
 */
async function openNoteAndMarkRead(note, setSelected, onMarkRead) {
  setSelected(note);
  if (!isNoteUnread(note)) return;
  try {
    await onMarkRead?.(note);
  } catch {
    // mark-read is best-effort; the sheet stays open
  }
}

/**
 * Compact row on the files screen (and again inside the all-notes sheet).
 */
function TrainerNoteRow({ note, onPress, extraBodyStyle }) {
  const unread = isNoteUnread(note);
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        borderRadius: 16,
        padding: 12,
        backgroundColor: unread ? UNREAD_ROW_FILL : READ_ROW_FILL,
        borderWidth: 1,
        borderColor: unread ? UNREAD_ROW_BORDER : READ_ROW_BORDER,
        flexDirection: extraBodyStyle ? undefined : 'row',
        gap: extraBodyStyle ? undefined : 10,
        alignItems: extraBodyStyle ? undefined : 'flex-start',
      }}
    >
      <View style={extraBodyStyle ? undefined : { flex: 1, gap: 6 }}>
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }} numberOfLines={1}>
          {displayNoteTitle(note)}
        </Text>
        <Text
          style={{
            color: 'rgba(255,255,255,0.70)',
            fontWeight: '700',
            fontSize: 12,
            lineHeight: 18,
            ...(extraBodyStyle || {}),
          }}
          numberOfLines={2}
        >
          {displayNoteBody(note)}
        </Text>
        <Text
          style={{
            color: 'rgba(255,255,255,0.45)',
            fontWeight: '800',
            fontSize: 11,
            ...(extraBodyStyle ? { marginTop: 6 } : {}),
          }}
        >
          {note?.createdAt ? formatDateShort(note.createdAt) : ''}
        </Text>
      </View>
      {extraBodyStyle ? null : (
        <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.28)" />
      )}
    </TouchableOpacity>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Notes-from-trainer section: three newest notes, unread pill, and a shared detail/list sheet.
 * vocab: useTheme = light/dark tokens for this screen.
 * vocab: useMemo = rebuild the filtered list only when `items` changes.
 * @param {{ items: Array, onMarkRead?: Function }} props
 */
export function NotesFromTrainerSection({ items, onMarkRead }) {
  const { colors, isDark } = useTheme();
  // `selected` drives the sheet: null = closed, a note = detail, { __mode: 'all' } = full list.
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
    <View style={{ marginBottom: 26 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontSize: 12, fontWeight: '900', letterSpacing: 2, color: colors.textSecondary }}>
          NOTES FROM TRAINER
        </Text>
        {unreadCount > 0 && (
          <View
            style={{
              backgroundColor: UNREAD_PILL_FILL,
              borderColor: UNREAD_PILL_BORDER,
              borderWidth: 1,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: UNREAD_PILL_TEXT, fontWeight: '900', fontSize: 11 }}>
              {unreadCount} unread
            </Text>
          </View>
        )}
      </View>

      {notes.length === 0 ? (
        <View
          style={{
            paddingVertical: 18,
            paddingHorizontal: 14,
            borderRadius: 14,
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(10,10,15,0.04)',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,15,0.08)',
          }}
        >
          <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 13, textAlign: 'center', lineHeight: 18 }}>
            No notes yet. Check back for updates from your coach.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {displayed.map((note) => (
            <TrainerNoteRow key={note.id} note={note} onPress={() => openNote(note)} />
          ))}

          {hasMore && (
            <TouchableOpacity
              onPress={() => setSelected({ __mode: ALL_NOTES_MODE })}
              style={{
                height: 50,
                borderRadius: 14,
                borderWidth: 2,
                borderColor: 'rgba(255, 107, 157, 0.30)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#FF6B9D', fontWeight: '900' }}>
                See all {notes.length} notes
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* vocab/symbol: !!selected coerces the object-or-null into the boolean `visible` wants. */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#12121A',
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              padding: 18,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.10)',
              maxHeight: '82%',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#fff' }}>{sheetTitle}</Text>
              <TouchableOpacity onPress={() => setSelected(null)} hitSlop={12}>
                <Feather name="x" size={22} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>

            {isAllNotesMode ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 10 }}>
                {notes.map((note) => (
                  <TrainerNoteRow
                    key={note.id}
                    note={note}
                    onPress={() => openNote(note)}
                    extraBodyStyle={{ marginTop: 6 }}
                  />
                ))}
              </ScrollView>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontWeight: '800', fontSize: 12 }}>
                  {selected?.createdAt ? formatDateShort(selected.createdAt) : ''}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.86)', fontWeight: '700', fontSize: 14, lineHeight: 22, marginTop: 10 }}>
                  {displayNoteBody(selected)}
                </Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
