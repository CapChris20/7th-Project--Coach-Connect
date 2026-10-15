// "Trainer shared" accordion on the client's files screen: files grouped by type, unread badge, optional detail sheet.
// Flow: keep trainer-authored items → bucket by file type → newest first → tap a category to expand FileCards.
// Used by: the client files screen. Opening a new file marks it read, then calls onOpenItem.

import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { FileCard } from './FileCard';
import { getFileTypeFromItem } from '../../helpers/fileSizeAndDateText';

// ===== NAMED CONSTANTS =====

const ADDED_BY_TRAINER = 'trainer';
const DOCUMENT_TYPE = 'document';
const DEFAULT_EXPANDED_CATEGORY = 'documents';
const EPOCH = 0;

const CATEGORIES = [
  { id: 'documents', label: 'Documents', color: '#3B82F6', match: (fileType) => fileType === 'document' },
  { id: 'spreadsheets', label: 'Spreadsheets', color: '#10B981', match: (fileType) => fileType === 'spreadsheet' },
  { id: 'pdfs', label: 'PDFs', color: '#EF4444', match: (fileType) => fileType === 'pdf' },
  { id: 'images', label: 'Images', color: '#06B6D4', match: (fileType) => fileType === 'image' },
  { id: 'videos', label: 'Videos', color: '#A855F7', match: (fileType) => fileType === 'video' },
  { id: 'other', label: 'Other', color: '#9CA3AF', match: (fileType) => fileType === 'file' },
];

const FALLBACK_CATEGORY = CATEGORIES[CATEGORIES.length - 1];

// ===== HELPER FUNCTIONS =====

/**
 * @param {boolean} isDark
 */
function sharedSectionTheme(isDark) {
  if (isDark) {
    return {
      card: '#141419',
      text: '#FFFFFF',
      text60: 'rgba(255,255,255,0.6)',
      text50: 'rgba(255,255,255,0.5)',
      border: 'rgba(255,255,255,0.10)',
      inputBg: 'rgba(255,255,255,0.08)',
    };
  }
  return {
    card: '#F8F8FB',
    text: '#0A0A0F',
    text60: 'rgba(10,10,15,0.6)',
    text50: 'rgba(10,10,15,0.5)',
    border: 'rgba(10,10,15,0.10)',
    inputBg: 'rgba(10,10,15,0.05)',
  };
}

/**
 * Trainer-authored files, plus documents that carry a trainerId (older docs may omit addedBy).
 * @param {object} item
 * @returns {boolean}
 */
function isTrainerSharedItem(item) {
  if (item?.addedBy === ADDED_BY_TRAINER) return true;
  return item?.type === DOCUMENT_TYPE && item?.trainerId;
}

/**
 * createdAt arrives as a Date, a Firestore Timestamp, or a cached string.
 * @param {object} item
 * @returns {Date}
 */
function itemCreatedAtDate(item) {
  if (item?.createdAt instanceof Date) return item.createdAt;
  return item?.createdAt?.toDate?.() || new Date(item?.createdAt || EPOCH);
}

/**
 * @param {object[]} files
 */
function sortNewestFirst(files) {
  files.sort((leftFile, rightFile) => itemCreatedAtDate(rightFile) - itemCreatedAtDate(leftFile));
}

/**
 * One bucket per category id. Unknown types fall into "Other".
 * @param {object[]} trainerItems
 * @returns {object}
 */
function groupTrainerItemsByCategory(trainerItems) {
  const grouped = {};
  for (const category of CATEGORIES) grouped[category.id] = [];

  for (const item of trainerItems) {
    const fileType = getFileTypeFromItem(item);
    const category = CATEGORIES.find((entry) => entry.match(fileType)) || FALLBACK_CATEGORY;
    grouped[category.id].push(item);
  }

  for (const categoryId of Object.keys(grouped)) {
    sortNewestFirst(grouped[categoryId]);
  }
  return grouped;
}

/**
 * Strict === false so items with no isRead field (legacy) do not light up as "new".
 * @param {object[]} trainerItems
 * @returns {number}
 */
function countUnreadSharedItems(trainerItems) {
  return trainerItems.filter((item) => item?.isRead === false).length;
}

/**
 * Mark read first (best-effort), then open. A failed write still opens the file.
 * @param {object} item
 * @param {Function} [onMarkRead]
 * @param {Function} [onOpenItem]
 */
async function openSharedItem(item, onMarkRead, onOpenItem) {
  if (item?.isRead === false) {
    try {
      await onMarkRead?.(item);
    } catch {
      // mark-read is best-effort
    }
  }
  onOpenItem?.(item);
}

// ===== MAIN FUNCTION =====

/**
 * Accordion of files the trainer shared with this client.
 * vocab: useState remembers which category is expanded (starts on Documents).
 * @param {{ items: Array, isDark?: boolean, onOpenItem?: Function, onDownloadItem?: Function, onMarkRead?: Function }} props
 */
export function SharedByTrainerSection({ items, isDark = true, onOpenItem, onDownloadItem, onMarkRead }) {
  const [expanded, setExpanded] = useState(DEFAULT_EXPANDED_CATEGORY);
  const [detail, setDetail] = useState(null);
  const theme = sharedSectionTheme(isDark);

  const trainerItems = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    return list.filter(isTrainerSharedItem);
  }, [items]);

  const grouped = useMemo(() => groupTrainerItemsByCategory(trainerItems), [trainerItems]);
  const unreadCount = useMemo(() => countUnreadSharedItems(trainerItems), [trainerItems]);

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
        {CATEGORIES.map((category) => {
          const files = grouped[category.id] || [];
          if (!files.length) return null;
          const isExpanded = expanded === category.id;
          const newCount = files.filter((item) => item?.isRead === false).length;

          return (
            <View key={category.id} style={{ gap: 10 }}>
              <TouchableOpacity
                onPress={() => setExpanded(isExpanded ? null : category.id)}
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
                  <View style={{ width: 4, height: 22, borderRadius: 2, backgroundColor: category.color }} />
                  <View>
                    <Text style={{ color: theme.text, fontWeight: '900', fontSize: 14 }}>
                      {category.label}
                    </Text>
                    <Text style={{ color: theme.text60, fontWeight: '700', fontSize: 12 }}>
                      {files.length} {files.length === 1 ? 'file' : 'files'}
                      {newCount > 0 ? ` • ${newCount} new` : ''}
                    </Text>
                  </View>
                </View>
                <Feather
                  name="chevron-right"
                  size={20}
                  color={theme.text60}
                  style={{ transform: isExpanded ? [{ rotate: '90deg' }] : [] }}
                />
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
                      onOpen={() => openSharedItem(item, onMarkRead, onOpenItem)}
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
                const selectedItem = detail;
                setDetail(null);
                onOpenItem?.(selectedItem);
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
