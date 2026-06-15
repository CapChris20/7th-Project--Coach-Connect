/**
 * Notes From Trainer Section
 *
 * Purpose: UI screen or component: Notes From Trainer Section. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/client
 * Key exports: NotesFromTrainerSection
 *
 * @file-header
 */
import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { formatDateShort } from '../../shared/utils/formatFileSize';
import { useTheme } from '../../shared/ui/ThemeContext';

export function NotesFromTrainerSection({ items, onMarkRead }) {
  const { colors, isDark } = useTheme();
  const [selected, setSelected] = useState(null);

  const notes = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    const n = list
      .filter((x) => x?.type === 'note' && x?.addedBy === 'trainer')
      .map((x) => ({
        ...x,
        createdAt: x?.createdAt instanceof Date ? x.createdAt : x?.createdAt?.toDate?.() || x?.createdAt,
      }));
    n.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return n;
  }, [items]);

  const displayed = notes.slice(0, 3);
  const hasMore = notes.length > 3;
  const unreadCount = notes.filter((n) => n?.isRead === false).length;

  const openNote = async (note) => {
    setSelected(note);
    if (note?.isRead === false) {
      try { await onMarkRead?.(note); } catch (_) {}
    }
  };

  return (
    <View style={{ marginBottom: 26 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontSize: 12, fontWeight: '900', letterSpacing: 2, color: colors.textSecondary }}>
          NOTES FROM TRAINER
        </Text>
        {unreadCount > 0 && (
          <View style={{ backgroundColor: 'rgba(255, 107, 157, 0.18)', borderColor: 'rgba(255, 107, 157, 0.45)', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }}>
            <Text style={{ color: '#FF6B9D', fontWeight: '900', fontSize: 11 }}>
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
                    {note?.createdAt ? formatDateShort(note.createdAt) : ''}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.28)" />
              </TouchableOpacity>
            );
          })}

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
                      {note?.createdAt ? formatDateShort(note.createdAt) : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontWeight: '800', fontSize: 12 }}>
                  {selected?.createdAt ? formatDateShort(selected.createdAt) : ''}
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

