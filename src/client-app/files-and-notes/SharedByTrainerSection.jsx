// "Trainer shared" accordion on the client's files screen: files grouped by type, unread badge, optional detail sheet.
// Flow: keep trainer-authored items → bucket by file type → newest first → tap a category to expand FileCards.
// Used by: the client files screen. Opening a new file marks it read, then calls onOpenItem.
//
// vocab: neobrutalist = thick borders, hard shadows, no gradients except for unread badge

import React, { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View, useColorScheme, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import NbCard from '../../look-and-feel/NbCard';
import { lightColors, darkColors } from '../../look-and-feel/colorPalette';
import { FileCard } from './FileCard';
import { getFileTypeFromItem } from '../../helpers/fileSizeAndDateText';

// ===== NAMED CONSTANTS =====

const ADDED_BY_TRAINER = 'trainer';
const DOCUMENT_TYPE = 'document';
const DEFAULT_EXPANDED_CATEGORY = 'documents';
const EPOCH = 0;

const CATEGORIES = [
  { id: 'documents', label: 'Documents', match: (fileType) => fileType === 'document' },
  { id: 'spreadsheets', label: 'Spreadsheets', match: (fileType) => fileType === 'spreadsheet' },
  { id: 'pdfs', label: 'PDFs', match: (fileType) => fileType === 'pdf' },
  { id: 'images', label: 'Images', match: (fileType) => fileType === 'image' },
  { id: 'videos', label: 'Videos', match: (fileType) => fileType === 'video' },
  { id: 'other', label: 'Other', match: (fileType) => fileType === 'file' },
];

const FALLBACK_CATEGORY = CATEGORIES[CATEGORIES.length - 1];

// ===== HELPER FUNCTIONS =====

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

function CategoryHeader({ category, count, isExpanded, onToggle, colors }) {
  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.8}>
      <NbCard style={styles.categoryHeader} noShadow>
        <View style={styles.categoryRow}>
          <View style={styles.categoryLeft}>
            <Text style={[styles.categoryLabel, { color: colors.nbInk }]}>{category.label}</Text>
            {count > 0 && (
              <View style={[styles.countBadge, { backgroundColor: colors.nbSurfaceChip, borderColor: colors.nbBorder }]}>
                <Text style={[styles.countText, { color: colors.nbInk }]}>{count}</Text>
              </View>
            )}
          </View>
          <Feather 
            name={isExpanded ? 'chevron-up' : 'chevron-down'} 
            size={20} 
            color={colors.nbMuted} 
          />
        </View>
      </NbCard>
    </TouchableOpacity>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Accordion of files the trainer shared with this client.
 * Neobrutalist redesign: NbCard, thick borders, clean layout.
 * vocab: useState remembers which category is expanded (starts on Documents).
 * @param {object} props
 */
export function SharedByTrainerSection({ items, onOpenItem, onDownloadItem, onMarkRead }) {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;
  const [expanded, setExpanded] = useState(DEFAULT_EXPANDED_CATEGORY);

  const trainerItems = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    return list.filter(isTrainerSharedItem);
  }, [items]);

  const grouped = useMemo(() => groupTrainerItemsByCategory(trainerItems), [trainerItems]);
  const unreadCount = useMemo(() => countUnreadSharedItems(trainerItems), [trainerItems]);

  if (trainerItems.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.nbMuted }]}>SHARED BY TRAINER</Text>
        <NbCard style={styles.emptyCard}>
          <Text style={[styles.emptyText, { color: colors.nbMuted }]}>
            No files shared yet
          </Text>
        </NbCard>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: colors.nbMuted }]}>SHARED BY TRAINER</Text>
        {unreadCount > 0 && (
          <View style={[styles.unreadBadge, { backgroundColor: colors.error }]}>
            <Text style={styles.unreadText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      {CATEGORIES.map((category) => {
        const categoryItems = grouped[category.id] || [];
        if (categoryItems.length === 0) return null;
        
        const isExpanded = expanded === category.id;
        
        return (
          <View key={category.id} style={styles.categoryBlock}>
            <CategoryHeader
              category={category}
              count={categoryItems.length}
              isExpanded={isExpanded}
              onToggle={() => setExpanded(isExpanded ? null : category.id)}
              colors={colors}
            />
            
            {isExpanded && (
              <View style={styles.categoryContent}>
                {categoryItems.map((item) => (
                  <FileCard
                    key={item.id}
                    item={item}
                    showActions
                    isTrainerShared
                    isNew={item?.isRead === false}
                    onOpen={() => openSharedItem(item, onMarkRead, onOpenItem)}
                    onDownload={() => onDownloadItem?.(item)}
                  />
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.1,
  },
  unreadBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  unreadText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  categoryBlock: {
    marginBottom: 12,
  },
  categoryHeader: {
    padding: 14,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryLabel: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 2.5,
  },
  countText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  categoryContent: {
    marginTop: 8,
    gap: 12,
  },
});
