import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { FileCard } from './FileCard';
import { getFileTypeFromItem } from '../../../shared/utils/fileFormatting';

const CATEGORIES = [
  { id: 'documents', label: 'Documents', color: '#3B82F6', match: (t) => t === 'document' },
  { id: 'spreadsheets', label: 'Spreadsheets', color: '#10B981', match: (t) => t === 'spreadsheet' },
  { id: 'pdfs', label: 'PDFs', color: '#EF4444', match: (t) => t === 'pdf' },
  { id: 'images', label: 'Images', color: '#06B6D4', match: (t) => t === 'image' },
  { id: 'videos', label: 'Videos', color: '#A855F7', match: (t) => t === 'video' },
  { id: 'other', label: 'Other', color: '#9CA3AF', match: (t) => t === 'file' },
];

export function TrainerSharedSection({ items, isDark = true, onOpenItem, onDownloadItem, onMarkRead }) {
  const [expanded, setExpanded] = useState('documents');
  const [detail, setDetail] = useState(null);
  const theme = isDark
    ? {
        card: '#141419',
        text: '#FFFFFF',
        text60: 'rgba(255,255,255,0.6)',
        text50: 'rgba(255,255,255,0.5)',
        border: 'rgba(255,255,255,0.10)',
        inputBg: 'rgba(255,255,255,0.08)',
      }
    : {
        card: '#F8F8FB',
        text: '#0A0A0F',
        text60: 'rgba(10,10,15,0.6)',
        text50: 'rgba(10,10,15,0.5)',
        border: 'rgba(10,10,15,0.10)',
        inputBg: 'rgba(10,10,15,0.05)',
      };

  const trainerItems = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    return list.filter((x) => x?.addedBy === 'trainer' || (x?.type === 'document' && x?.trainerId));
  }, [items]);

  const grouped = useMemo(() => {
    const by = {};
    for (const cat of CATEGORIES) by[cat.id] = [];
    for (const x of trainerItems) {
      const t = getFileTypeFromItem(x);
      const cat = CATEGORIES.find((c) => c.match(t)) || CATEGORIES[CATEGORIES.length - 1];
      by[cat.id].push(x);
    }
    // newest first
    for (const k of Object.keys(by)) {
      by[k].sort((a, b) => {
        const da = a?.createdAt instanceof Date ? a.createdAt : a?.createdAt?.toDate?.() || new Date(a?.createdAt || 0);
        const db = b?.createdAt instanceof Date ? b.createdAt : b?.createdAt?.toDate?.() || new Date(b?.createdAt || 0);
        return db - da;
      });
    }
    return by;
  }, [trainerItems]);

  const unreadCount = useMemo(
    () => trainerItems.filter((x) => x?.isRead === false).length,
    [trainerItems],
  );

  return (
    <View style={{ marginBottom: 26 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontSize: 12, fontWeight: '900', letterSpacing: 2, color: theme.text50 }}>
          TRAINER SHARED
        </Text>
        {unreadCount > 0 && (
          <View
            style={{
              backgroundColor: 'rgba(255, 107, 157, 0.18)',
              borderColor: 'rgba(255, 107, 157, 0.45)',
              borderWidth: 1,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: '#FF6B9D', fontWeight: '900', fontSize: 11 }}>
              {unreadCount} new
            </Text>
          </View>
        )}
      </View>

      <View
        style={{
          backgroundColor: theme.card,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.border,
          padding: 12,
          gap: 12,
        }}
      >
        {CATEGORIES.map((cat) => {
          const files = grouped[cat.id] || [];
          if (!files.length) return null;
          const isExpanded = expanded === cat.id;
          const newCount = files.filter((x) => x?.isRead === false).length;

          return (
            <View key={cat.id} style={{ gap: 10 }}>
              <TouchableOpacity
                onPress={() => setExpanded(isExpanded ? null : cat.id)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  borderRadius: 14,
                  backgroundColor: theme.inputBg,
                  borderWidth: 1,
                  borderColor: theme.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 4, height: 22, borderRadius: 2, backgroundColor: cat.color }} />
                  <View>
                    <Text style={{ color: theme.text, fontWeight: '900', fontSize: 14 }}>
                      {cat.label}
                    </Text>
                    <Text style={{ color: theme.text60, fontWeight: '700', fontSize: 12 }}>
                      {files.length} {files.length === 1 ? 'file' : 'files'}
                      {newCount > 0 ? ` • ${newCount} new` : ''}
                    </Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={20} color={theme.text60} style={{ transform: isExpanded ? [{ rotate: '90deg' }] : [] }} />
              </TouchableOpacity>

              {isExpanded && (
                <View style={{ gap: 12 }}>
                  {files.map((item) => (
                    <FileCard
                      key={item.id}
                      item={item}
                      isTrainerShared
                      isNew={item?.isRead === false}
                      isDark={isDark}
                      onOpen={async () => {
                        if (item?.isRead === false) {
                          try { await onMarkRead?.(item); } catch (_) {}
                        }
                        onOpenItem?.(item);
                      }}
                      onDownload={onDownloadItem ? () => onDownloadItem(item) : undefined}
                    />
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {trainerItems.length === 0 && (
          <View
            style={{
              paddingVertical: 18,
              paddingHorizontal: 14,
              borderRadius: 14,
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <Text style={{ color: 'rgba(255,255,255,0.62)', fontWeight: '700', fontSize: 13, textAlign: 'center', lineHeight: 18 }}>
              Nothing shared yet. When your coach shares documents or files, they’ll show up here.
            </Text>
          </View>
        )}
      </View>

      {/* Optional: lightweight detail modal for metadata/notes (keeps UX parity with your spec) */}
      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#12121A',
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              padding: 18,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.10)',
              maxHeight: '80%',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#fff' }} numberOfLines={1}>
                {detail?.name || detail?.title || 'Shared item'}
              </Text>
              <TouchableOpacity onPress={() => setDetail(null)} hitSlop={12}>
                <Feather name="x" size={22} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
              <View style={{ gap: 10 }}>
                {(detail?.sharedBy || detail?.trainerName) && (
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '800', fontSize: 12 }}>From</Text>
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14, marginTop: 4 }}>
                      {detail?.sharedBy || detail?.trainerName}
                    </Text>
                  </View>
                )}
                {detail?.previewSnippet && (
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '800', fontSize: 12 }}>Notes</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '700', fontSize: 14, marginTop: 6, lineHeight: 20 }}>
                      {detail.previewSnippet}
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
            <TouchableOpacity
              onPress={() => {
                const x = detail;
                setDetail(null);
                onOpenItem?.(x);
              }}
              style={{
                height: 52,
                borderRadius: 14,
                backgroundColor: '#FF6B9D',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 10,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '900' }}>Open</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

