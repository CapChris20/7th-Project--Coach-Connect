// "Notes from trainer" block on the client's files screen: 3 most recent notes + an unread badge.
// Flow: filter the mixed items list down to trainer notes → sort newest first → show 3 → tapping one
// opens a bottom sheet and marks it read; "See all" reuses the same sheet in list mode.
// Note: the parent owns fetching; this component only presents `items` and reports reads upward.
import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { cellFormattingDateShort } from '../../helpers/fileSizeAndDateText';
import { useTheme } from '../../look-and-feel/lightDarkMode';

export function NotesFromTrainerSection({ items, onMarkRead }) {
  const { colors, isDark } = useTheme();
  // `selected` drives the bottom sheet and doubles as its mode: null = closed, a note object = read
  // that note, and the sentinel { __mode: 'all' } = show the full list instead of one note.
  const [selected, setSelected] = useState(null);

  // Derive the note list from the parent's mixed items (files AND notes). useMemo so the filter,
  // date normalization, and sort only re-run when `items` actually changes — not on every keystroke
  // or theme flip elsewhere on the screen.
  const notes = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    const n = list
      // Two conditions: it's a note, and the TRAINER wrote it. The client's own notes live in the
      // same collection, so without the addedBy check they'd show up here too.
      .filter((x) => x?.type === 'note' && x?.addedBy === 'trainer')
      .map((x) => ({
        ...x,
        // createdAt arrives in three shapes depending on where it came from: an already-converted
        // Date, a Firestore Timestamp (which needs .toDate()), or a raw string from cache.
        // Normalizing here means the sort and the cellFormattingter below only deal with one type.
        // vocab: ?.toDate?.() = call toDate only if the value exists AND has that method
        createdAt: x?.createdAt instanceof Date ? x.createdAt : x?.createdAt?.toDate?.() || x?.createdAt,
      }));
    // Newest first. `|| 0` sends undated notes to the bottom (epoch) rather than making the
    // comparison NaN, which would leave the sort order undefined.
    n.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return n;
  }, [items]);

  // Manipulate here: 3 is how many notes appear inline before the "See all" button takes over.
  // Both lines use the same number, so change them together.
  const displayed = notes.slice(0, 3);
  const hasMore = notes.length > 3;
  // Strict === false, not a falsy check: a note with no isRead field at all is legacy data and is
  // treated as already read, so old notes don't suddenly light up the unread badge.
  const unreadCount = notes.filter((n) => n?.isRead === false).length;

  // Open the sheet and mark the note read. Order matters: the sheet opens FIRST so the UI responds
  // instantly, then the read receipt is written. The try/catch means a failed write still leaves the
  // note open and readable rather than surfacing an error the user can't act on.
  const openNote = async (note) => {
    setSelected(note);
    if (note?.isRead === false) {
      try { await onMarkRead?.(note); } catch (_) {}
    }
  };

  return (
    <View style={{ marginBottom: 26 }}>
      {/* SECTION HEADER — small-caps label on the left, unread pill pushed right by
          justifyContent: 'space-between'.
          Manipulate here: letterSpacing 2 with weight 900 is the app's section-label treatment. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontSize: 12, fontWeight: '900', letterSpacing: 2, color: colors.textSecondary }}>
          NOTES FROM TRAINER
        </Text>
        {/* Unread pill only when there's something unread — no "0 unread" state.
            Manipulate here: the pink rgba trio (fill / border / text) is the app's "needs attention"
            accent, and borderRadius 999 is the standard trick for a fully rounded capsule. */}
        {unreadCount > 0 && (
          <View style={{ backgroundColor: 'rgba(255, 107, 157, 0.18)', borderColor: 'rgba(255, 107, 157, 0.45)', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }}>
            <Text style={{ color: '#FF6B9D', fontWeight: '900', fontSize: 11 }}>
              {unreadCount} unread
            </Text>
          </View>
        )}
      </View>

      {/* EMPTY vs LIST. The empty state is a real bordered card rather than blank space, so the
          section still reads as "a place where notes appear" before the first one arrives.
          Manipulate here: the copy below is what a client sees before their coach writes anything. */}
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
          {/* NOTE ROWS. Unread rows get a pink tinted fill + border while read rows are plain
              white-on-transparent — that contrast is the only visual difference, and it's what makes
              new notes findable at a glance.
              Manipulate here: 'Note from your coach' is the fallback title when the trainer left it
              blank, and body is trimmed so a whitespace-only note falls back to '—' below. */}
          {displayed.map((note) => {
            const isUnread = note?.isRead === false;
            const title = note?.title || 'Note from your coach';
            const body = String(note?.content || '').trim();
            return (
              <TouchableOpacity
                key={note.id}
                onPress={() => openNote(note)}
                style={{
                  borderRadius: 16,
                  padding: 12,
                  backgroundColor: isUnread ? 'rgba(255, 107, 157, 0.10)' : 'rgba(255,255,255,0.04)',
                  borderWidth: 1,
                  borderColor: isUnread ? 'rgba(255, 107, 157, 0.35)' : 'rgba(255,255,255,0.10)',
                  flexDirection: 'row',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }} numberOfLines={1}>
                    {title}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.70)', fontWeight: '700', fontSize: 12, lineHeight: 18 }} numberOfLines={2}>
                    {body || '—'}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.45)', fontWeight: '800', fontSize: 11 }}>
                    {note?.createdAt ? cellFormattingDateShort(note.createdAt) : ''}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.28)" />
              </TouchableOpacity>
            );
          })}

          {/* "See all" — opens the SAME sheet in list mode by setting the __mode sentinel instead of
              a note. That's why there's no second modal in this file.
              Manipulate here: height 50 with a 2px pink outline is the app's secondary-button style. */}
          {hasMore && (
            <TouchableOpacity
              onPress={() => setSelected({ __mode: 'all' })}
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

      {/* DETAIL / ALL-NOTES SHEET. One Modal serves both jobs, switched by selected.__mode.
          vocab/symbol: !!selected coerces the object-or-null into the boolean `visible` wants.
          transparent + justifyContent 'flex-end' is what makes it a bottom sheet over a dimmed
          backdrop; onRequestClose wires up the Android back button.
          Manipulate here: rgba(0,0,0,0.78) is the backdrop dim, and maxHeight '82%' below caps how
          far the sheet can grow. */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#12121A', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', maxHeight: '82%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#fff' }}>
                {selected?.__mode === 'all' ? 'All notes' : (selected?.title || 'Note from your coach')}
              </Text>
              <TouchableOpacity onPress={() => setSelected(null)} hitSlop={12}>
                <Feather name="x" size={22} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>

            {/* LIST MODE — every note, tappable. Tapping one calls openNote, which REPLACES
                `selected` with that note, so the same sheet switches from list to detail in place.
                Note these rows repeat the unread styling inline rather than reusing the rows above:
                they're inside a ScrollView with slightly different spacing. */}
            {selected?.__mode === 'all' ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 10 }}>
                {notes.map((note) => (
                  <TouchableOpacity
                    key={note.id}
                    onPress={() => openNote(note)}
                    style={{
                      borderRadius: 16,
                      padding: 12,
                      backgroundColor: note?.isRead === false ? 'rgba(255, 107, 157, 0.10)' : 'rgba(255,255,255,0.04)',
                      borderWidth: 1,
                      borderColor: note?.isRead === false ? 'rgba(255, 107, 157, 0.35)' : 'rgba(255,255,255,0.10)',
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }} numberOfLines={1}>
                      {note?.title || 'Note from your coach'}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.70)', fontWeight: '700', fontSize: 12, lineHeight: 18, marginTop: 6 }} numberOfLines={2}>
                      {String(note?.content || '').trim() || '—'}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.45)', fontWeight: '800', fontSize: 11, marginTop: 6 }}>
                      {note?.createdAt ? cellFormattingDateShort(note.createdAt) : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              /* DETAIL MODE — date line, then the full note body (no numberOfLines cap, so it can
                 run as long as the trainer wrote it and the ScrollView handles overflow).
                 Manipulate here: lineHeight 22 against fontSize 14 is the comfortable reading
                 measure for long note text. */
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontWeight: '800', fontSize: 12 }}>
                  {selected?.createdAt ? cellFormattingDateShort(selected.createdAt) : ''}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.86)', fontWeight: '700', fontSize: 14, lineHeight: 22, marginTop: 10 }}>
                  {String(selected?.content || '').trim() || '—'}
                </Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

