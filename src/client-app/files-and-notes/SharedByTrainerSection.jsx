// "Shared by trainer" accordion on the client's files screen: files grouped by type + unread badge.
// Flow: keep trainer-authored items → bucket by file type → newest first → tap a category to expand.
// Used by the client files screen. Opening a new file marks it read, then calls onOpenItem.

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
const EPOCH_MS = 0;
const SECTION_BOTTOM_GAP = 24;
const COLOR_SCHEME_DARK = 'dark';
const SECTION_TITLE = 'SHARED BY TRAINER';
const EMPTY_SHARED_COPY = 'No files shared yet';
const CHEVRON_EXPANDED = 'chevron-up';
const CHEVRON_COLLAPSED = 'chevron-down';

const CATEGORY_DOCUMENTS = {
  id: 'documents',
  label: 'Documents',
  matchesFileType: (fileType) => fileType === 'document',
};
const CATEGORY_SPREADSHEETS = {
  id: 'spreadsheets',
  label: 'Spreadsheets',
  matchesFileType: (fileType) => fileType === 'spreadsheet',
};
const CATEGORY_PDFS = {
  id: 'pdfs',
  label: 'PDFs',
  matchesFileType: (fileType) => fileType === 'pdf',
};
const CATEGORY_IMAGES = {
  id: 'images',
  label: 'Images',
  matchesFileType: (fileType) => fileType === 'image',
};
const CATEGORY_VIDEOS = {
  id: 'videos',
  label: 'Videos',
  matchesFileType: (fileType) => fileType === 'video',
};
const CATEGORY_OTHER = {
  id: 'other',
  label: 'Other',
  matchesFileType: (fileType) => fileType === 'file',
};

const CATEGORIES = [
  CATEGORY_DOCUMENTS,
  CATEGORY_SPREADSHEETS,
  CATEGORY_PDFS,
  CATEGORY_IMAGES,
  CATEGORY_VIDEOS,
  CATEGORY_OTHER,
];

const FALLBACK_CATEGORY = CATEGORY_OTHER;

// ===== HELPER FUNCTIONS =====

function isTrainerSharedItem(item) {
  if (!item) return false;
  if (item.addedBy === ADDED_BY_TRAINER) return true;
  // Trainer-authored document stubs may omit addedBy but still carry trainerId.
  if (item.type === DOCUMENT_TYPE && item.trainerId) return true;
  return false;
}

function firestoreTimestampToDate(createdAt) {
  if (!createdAt) return null;
  if (typeof createdAt.toDate === 'function') {
    return createdAt.toDate();
  }
  return null;
}

function itemCreatedAtDate(item) {
  if (!item) return new Date(EPOCH_MS);
  if (item.createdAt instanceof Date) return item.createdAt;

  const fromTimestamp = firestoreTimestampToDate(item.createdAt);
  if (fromTimestamp) return fromTimestamp;

  return new Date(item.createdAt || EPOCH_MS);
}

function sortNewestFirst(files) {
  files.sort((leftFile, rightFile) => {
    return itemCreatedAtDate(rightFile) - itemCreatedAtDate(leftFile);
  });
}

function trainerSharedItemsFromList(items) {
  const list = Array.isArray(items) ? items : [];
  const trainerItems = [];
  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];
    if (isTrainerSharedItem(item)) {
      trainerItems.push(item);
    }
  }
  return trainerItems;
}

function categoryForFileType(fileType) {
  for (let index = 0; index < CATEGORIES.length; index += 1) {
    const category = CATEGORIES[index];
    if (category.matchesFileType(fileType)) return category;
  }
  return FALLBACK_CATEGORY;
}

function emptyBucketsByCategoryId() {
  const grouped = {};
  for (let index = 0; index < CATEGORIES.length; index += 1) {
    const category = CATEGORIES[index];
    grouped[category.id] = [];
  }
  return grouped;
}

function groupTrainerItemsByCategory(trainerItems) {
  const grouped = emptyBucketsByCategoryId();

  for (let index = 0; index < trainerItems.length; index += 1) {
    const item = trainerItems[index];
    const fileType = getFileTypeFromItem(item);
    const category = categoryForFileType(fileType);
    grouped[category.id].push(item);
  }

  const categoryIds = Object.keys(grouped);
  for (let index = 0; index < categoryIds.length; index += 1) {
    const categoryId = categoryIds[index];
    sortNewestFirst(grouped[categoryId]);
  }
  return grouped;
}

function countUnreadSharedItems(trainerItems) {
  let unreadCount = 0;
  for (let index = 0; index < trainerItems.length; index += 1) {
    const item = trainerItems[index];
    if (item && item.isRead === false) {
      unreadCount += 1;
    }
  }
  return unreadCount;
}

function itemIsUnread(item) {
  if (!item) return false;
  return item.isRead === false;
}

async function markSharedItemReadIfNeeded(item, onMarkRead) {
  if (!itemIsUnread(item)) return;
  if (!onMarkRead) return;
  try {
    await onMarkRead(item);
  } catch {
    // Ignore mark-read failures.
  }
}

async function openSharedItemThenViewer(item, onMarkRead, onOpenItem) {
  // Mark-read is best-effort; always still open the viewer.
  await markSharedItemReadIfNeeded(item, onMarkRead);
  if (onOpenItem) {
    onOpenItem(item);
  }
}

function colorsForScheme(colorScheme) {
  if (colorScheme === COLOR_SCHEME_DARK) return darkColors;
  return lightColors;
}

function nextExpandedCategoryId(currentExpandedId, tappedCategoryId) {
  const wasAlreadyOpen = currentExpandedId === tappedCategoryId;
  if (wasAlreadyOpen) return null;
  return tappedCategoryId;
}

function SharedSectionTitleRow({ colors, unreadCount }) {
  const showUnreadBadge = unreadCount > 0;

  return (
    <View style={styles.headerRow}>
      <Text style={[styles.sectionTitle, { color: colors.nbMuted }]}>{SECTION_TITLE}</Text>
      {showUnreadBadge ? (
        <View
          style={[
            styles.unreadBadge,
            { backgroundColor: colors.nbFill, borderColor: colors.nbBorder },
          ]}
        >
          <Text style={[styles.unreadText, { color: colors.nbOnFill }]}>{unreadCount}</Text>
        </View>
      ) : null}
    </View>
  );
}

function SharedEmptyState({ colors }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.nbMuted }]}>{SECTION_TITLE}</Text>
      <NbCard style={styles.emptyCard}>
        <Text style={[styles.emptyText, { color: colors.nbMuted }]}>{EMPTY_SHARED_COPY}</Text>
      </NbCard>
    </View>
  );
}

function CategoryHeader({ category, count, isExpanded, onToggle, colors }) {
  const showCountBadge = count > 0;
  const chevronName = isExpanded ? CHEVRON_EXPANDED : CHEVRON_COLLAPSED;

  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.8}>
      <NbCard style={styles.categoryHeader} noShadow>
        <View style={styles.categoryRow}>
          <View style={styles.categoryLeft}>
            <Text style={[styles.categoryLabel, { color: colors.nbInk }]}>{category.label}</Text>
            {showCountBadge ? (
              <View
                style={[
                  styles.countBadge,
                  { backgroundColor: colors.nbSurfaceChip, borderColor: colors.nbBorder },
                ]}
              >
                <Text style={[styles.countText, { color: colors.nbInk }]}>{count}</Text>
              </View>
            ) : null}
          </View>
          <Feather name={chevronName} size={20} color={colors.nbMuted} />
        </View>
      </NbCard>
    </TouchableOpacity>
  );
}

function buildSharedFileCards(categoryItems, onMarkRead, onOpenItem, onDownloadItem) {
  const cards = [];
  for (let index = 0; index < categoryItems.length; index += 1) {
    const item = categoryItems[index];
    const itemIsNew = itemIsUnread(item);

    const openThisItem = () => {
      openSharedItemThenViewer(item, onMarkRead, onOpenItem);
    };

    const downloadThisItem = () => {
      if (!onDownloadItem) return;
      onDownloadItem(item);
    };

    cards.push(
      <FileCard
        key={item.id}
        item={item}
        showActions
        isTrainerShared
        isNew={itemIsNew}
        onOpen={openThisItem}
        onDownload={downloadThisItem}
      />,
    );
  }
  return cards;
}

function SharedCategoryFileList({ categoryItems, onMarkRead, onOpenItem, onDownloadItem }) {
  const fileCards = buildSharedFileCards(categoryItems, onMarkRead, onOpenItem, onDownloadItem);
  return <View style={styles.categoryContent}>{fileCards}</View>;
}

function SharedCategoryBlock({
  category,
  categoryItems,
  isExpanded,
  onToggleCategory,
  colors,
  onMarkRead,
  onOpenItem,
  onDownloadItem,
}) {
  if (categoryItems.length === 0) return null;

  return (
    <View style={styles.categoryBlock}>
      <CategoryHeader
        category={category}
        count={categoryItems.length}
        isExpanded={isExpanded}
        onToggle={onToggleCategory}
        colors={colors}
      />

      {isExpanded ? (
        <SharedCategoryFileList
          categoryItems={categoryItems}
          onMarkRead={onMarkRead}
          onOpenItem={onOpenItem}
          onDownloadItem={onDownloadItem}
        />
      ) : null}
    </View>
  );
}

function buildSharedCategoryBlocks(
  groupedByCategory,
  expandedCategoryId,
  onToggleCategory,
  colors,
  onMarkRead,
  onOpenItem,
  onDownloadItem,
) {
  const blocks = [];
  for (let index = 0; index < CATEGORIES.length; index += 1) {
    const category = CATEGORIES[index];
    const categoryItems = groupedByCategory[category.id] || [];
    const isExpanded = expandedCategoryId === category.id;

    const toggleThisCategory = () => {
      onToggleCategory(category.id);
    };

    blocks.push(
      <SharedCategoryBlock
        key={category.id}
        category={category}
        categoryItems={categoryItems}
        isExpanded={isExpanded}
        onToggleCategory={toggleThisCategory}
        colors={colors}
        onMarkRead={onMarkRead}
        onOpenItem={onOpenItem}
        onDownloadItem={onDownloadItem}
      />,
    );
  }
  return blocks;
}

function SharedCategoryBlocks({
  groupedByCategory,
  expandedCategoryId,
  onToggleCategory,
  colors,
  onMarkRead,
  onOpenItem,
  onDownloadItem,
}) {
  return buildSharedCategoryBlocks(
    groupedByCategory,
    expandedCategoryId,
    onToggleCategory,
    colors,
    onMarkRead,
    onOpenItem,
    onDownloadItem,
  );
}

// ===== MAIN FUNCTION =====

/**
 * Accordion of files the trainer shared with this client.
 * @param {{ items: Array, onOpenItem?: Function, onDownloadItem?: Function, onMarkRead?: Function }} props
 */
export function SharedByTrainerSection({ items, onOpenItem, onDownloadItem, onMarkRead }) {
  // vocab: useColorScheme = OS light/dark; this section picks palette tokens from that (not useTheme)
  const colorScheme = useColorScheme();
  const colors = colorsForScheme(colorScheme);
  const [expandedCategoryId, setExpandedCategoryId] = useState(DEFAULT_EXPANDED_CATEGORY);

  const trainerItems = useMemo(() => trainerSharedItemsFromList(items), [items]);
  const groupedByCategory = useMemo(
    () => groupTrainerItemsByCategory(trainerItems),
    [trainerItems],
  );
  const unreadCount = useMemo(() => countUnreadSharedItems(trainerItems), [trainerItems]);

  function toggleCategoryExpansion(categoryId) {
    // 1. Tap an open section → collapse. Tap a closed one → show only that bucket.
    const nextExpandedId = nextExpandedCategoryId(expandedCategoryId, categoryId);
    setExpandedCategoryId(nextExpandedId);
  }

  const nothingSharedYet = trainerItems.length === 0;
  if (nothingSharedYet) {
    return <SharedEmptyState colors={colors} />;
  }

  return (
    <View style={styles.section}>
      <SharedSectionTitleRow colors={colors} unreadCount={unreadCount} />

      <SharedCategoryBlocks
        groupedByCategory={groupedByCategory}
        expandedCategoryId={expandedCategoryId}
        onToggleCategory={toggleCategoryExpansion}
        colors={colors}
        onMarkRead={onMarkRead}
        onOpenItem={onOpenItem}
        onDownloadItem={onDownloadItem}
      />
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
    borderWidth: 2.5,
    minWidth: 28,
    alignItems: 'center',
  },
  unreadText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
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
    borderWidth: 3,
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
