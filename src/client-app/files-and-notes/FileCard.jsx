// One card in the client Notes & Files list: thumbnail, title, type, date, size, and optional actions.
// Flow: pick type meta → theme colors → thumbnail or icon → title row → download / share / delete if allowed.
// Used by: the client files list. Trainers' shared files hide share/delete so the client cannot remove them.

import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import NbCard from '../../look-and-feel/NbCard';
import { lightColors, darkColors, gradients } from '../../look-and-feel/colorPalette';
import {
  formatDateShort,
  formatFileSize,
  getFileTypeFromItem,
  getFriendlyFileTitle,
} from '../../helpers/fileSizeAndDateText';

// ===== NAMED CONSTANTS =====

const ADDED_BY_CLIENT = 'client';
const FILE_TYPE_IMAGE = 'image';
const DEFAULT_FILE_NAME = 'File';
const DARK_SCHEME = 'dark';
// vocab: neobrutalist = thick borders, hard shadows, no gradients except for NEW badge

const TYPE_META = {
  image: { icon: 'image', label: 'Photo' },
  pdf: { icon: 'file-text', label: 'PDF' },
  document: { icon: 'file-text', label: 'Document' },
  spreadsheet: { icon: 'grid', label: 'Spreadsheet' },
  video: { icon: 'video', label: 'Video' },
  file: { icon: 'file', label: 'File' },
  note: { icon: 'edit-3', label: 'Note' },
};

// ===== HELPER FUNCTIONS =====

// Firestore Timestamp → Date, or pass through a real Date / raw value.
function createdAtDateFromItem(item) {
  if (item?.createdAt instanceof Date) {
    return item.createdAt;
  }
  // vocab: toDate = Firestore Timestamp → JS Date
  if (item?.createdAt?.toDate) {
    return item.createdAt.toDate();
  }
  return item?.createdAt;
}

// Prefer an explicit thumbnailUrl; for photos fall back to the file url itself.
function thumbnailUrlFromItem(item, fileType) {
  if (item?.thumbnailUrl) {
    return item.thumbnailUrl;
  }
  if (fileType === FILE_TYPE_IMAGE) {
    return item?.url;
  }
  return null;
}

function itemWasAddedByClient(item) {
  const addedBy = item?.addedBy || ADDED_BY_CLIENT;
  return addedBy === ADDED_BY_CLIENT;
}

// Stop the card's onOpen from firing when the user taps an action icon.
function runActionWithoutBubbling(event, action) {
  if (event && event.stopPropagation) {
    event.stopPropagation();
  }
  action();
}

function typeLabelWithDate(meta, createdAt) {
  if (!createdAt) {
    return meta.label;
  }
  const shortDate = formatDateShort(createdAt);
  return `${meta.label} \u00B7 ${shortDate}`;
}

// Trainer-shared rows never get share/delete — client cannot remove coach files.
function resolveFileCardPermissions(item, isTrainerShared) {
  const clientOwnsFile = itemWasAddedByClient(item);

  let canDelete = false;
  let canShare = false;
  if (!isTrainerShared && clientOwnsFile) {
    canDelete = true;
    canShare = true;
  }

  return { canDelete, canShare };
}

function colorsForScheme(colorScheme) {
  if (colorScheme === DARK_SCHEME) {
    return darkColors;
  }
  return lightColors;
}

function typeMetaForFileType(fileType) {
  const knownMeta = TYPE_META[fileType];
  if (knownMeta) {
    return knownMeta;
  }
  return TYPE_META.file;
}

// ===== SMALL UI PIECES =====

// Design Law: brand gradient accent OK on NEW pill — always pair with nbBorder outline.
function NewBadge({ borderColor }) {
  let badgeBorderColor = lightColors.nbBorder;
  if (borderColor) {
    badgeBorderColor = borderColor;
  }
  const badgeStyle = [styles.newBadge, { borderColor: badgeBorderColor }];

  return (
    <LinearGradient
      colors={gradients.brand.colors}
      start={gradients.brand.start}
      end={gradients.brand.end}
      style={badgeStyle}
    >
      <Text style={styles.newBadgeText}>NEW</Text>
    </LinearGradient>
  );
}

function FileThumbnailArea({ fileType, thumbnailUrl, colors, meta }) {
  const isImageWithUrl = fileType === FILE_TYPE_IMAGE && thumbnailUrl;

  if (isImageWithUrl) {
    return (
      <Image
        source={{ uri: thumbnailUrl }}
        style={[styles.photoThumb, { backgroundColor: colors.nbSurfaceChip }]}
        resizeMode="cover"
      />
    );
  }

  const shellStyle = [
    styles.iconThumbShell,
    { backgroundColor: colors.nbSurfaceChip, borderColor: colors.nbBorder },
  ];

  return (
    <View style={shellStyle}>
      <View style={[styles.iconThumbInner, { backgroundColor: colors.nbSurfaceChip }]}>
        <Feather name={meta.icon} size={24} color={colors.nbMuted} />
      </View>
    </View>
  );
}

function FileActionIconButton({ onPress, icon, colors }) {
  const buttonStyle = [
    styles.actionButton,
    { backgroundColor: colors.nbSurfaceChip, borderColor: colors.nbBorder },
  ];

  function handlePress(event) {
    runActionWithoutBubbling(event, onPress);
  }

  return (
    <TouchableOpacity onPress={handlePress} style={buttonStyle}>
      <Feather name={icon} size={18} color={colors.nbInk} />
    </TouchableOpacity>
  );
}

function FileCardActionRow({
  colors,
  onDownload,
  onShare,
  onDelete,
  canShare,
  canDelete,
}) {
  const showDownload = Boolean(onDownload);
  const showShare = canShare && Boolean(onShare);
  const showDelete = canDelete && Boolean(onDelete);

  const actionButtons = [];

  if (showDownload) {
    actionButtons.push(
      <FileActionIconButton
        key="download"
        onPress={onDownload}
        icon="download"
        colors={colors}
      />,
    );
  }
  if (showShare) {
    actionButtons.push(
      <FileActionIconButton
        key="share"
        onPress={onShare}
        icon="share-2"
        colors={colors}
      />,
    );
  }
  if (showDelete) {
    actionButtons.push(
      <FileActionIconButton
        key="delete"
        onPress={onDelete}
        icon="trash-2"
        colors={colors}
      />,
    );
  }

  return <View style={styles.actionRow}>{actionButtons}</View>;
}

function FileTitleBlock({ colors, name, meta, createdAt, size }) {
  const typeAndDateLine = typeLabelWithDate(meta, createdAt);
  const sizeLine = formatFileSize(size);

  return (
    <View style={styles.titleBlock}>
      <Text style={[styles.fileTitle, { color: colors.nbInk }]} numberOfLines={2}>
        {name}
      </Text>
      <View style={styles.metaRow}>
        <Text style={[styles.metaText, { color: colors.nbMuted }]} numberOfLines={1}>
          {typeAndDateLine}
        </Text>
        <Text style={[styles.metaText, { color: colors.nbMuted }]} numberOfLines={1}>
          {sizeLine}
        </Text>
      </View>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * File / note card for the client library.
 * Neobrutalist redesign: NbCard base, thick borders, no color gradients except NEW badge.
 * @param {object} props
 */
export function FileCard({
  item,
  showActions = true,
  isNew = false,
  isTrainerShared = false,
  onOpen,
  onDownload,
  onDelete,
  onShare,
}) {
  // 1. Light / dark palette for this card (does not use the shared ThemeProvider).
  // vocab: useColorScheme = OS light/dark; we map it onto lightColors / darkColors
  const colorScheme = useColorScheme();
  const colors = colorsForScheme(colorScheme);

  // 2. Classify the row and pick icon + label copy.
  const fileType = getFileTypeFromItem(item);
  const typeMeta = typeMetaForFileType(fileType);

  // 3. Friendly title, created date, bytes, and preview URL.
  const displayName = getFriendlyFileTitle(item) || DEFAULT_FILE_NAME;
  const createdAt = createdAtDateFromItem(item);
  const fileSizeBytes = item?.size;
  const thumbnailUrl = thumbnailUrlFromItem(item, fileType);

  // 4. Trainer-shared rows never get share/delete — client cannot remove coach files.
  const permissions = resolveFileCardPermissions(item, isTrainerShared);
  const canDelete = permissions.canDelete;
  const canShare = permissions.canShare;

  // 5. Paint NEW badge → thumb → title/meta → optional action icons.
  let newBadge = null;
  if (isNew) {
    newBadge = <NewBadge borderColor={colors.nbBorder} />;
  }

  let actionRow = null;
  if (showActions) {
    actionRow = (
      <FileCardActionRow
        colors={colors}
        onDownload={onDownload}
        onShare={onShare}
        onDelete={onDelete}
        canShare={canShare}
        canDelete={canDelete}
      />
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onOpen}>
      <NbCard style={styles.cardRoot}>
        {newBadge}

        <FileThumbnailArea
          fileType={fileType}
          thumbnailUrl={thumbnailUrl}
          colors={colors}
          meta={typeMeta}
        />

        <FileTitleBlock
          colors={colors}
          name={displayName}
          meta={typeMeta}
          createdAt={createdAt}
          size={fileSizeBytes}
        />

        {actionRow}
      </NbCard>
    </TouchableOpacity>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  cardRoot: { padding: 12, position: 'relative' },
  newBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 5,
    borderWidth: 2.5,
  },
  newBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: lightColors.nbInk,
    letterSpacing: 0.1,
    textTransform: 'uppercase',
  },
  photoThumb: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    marginBottom: 12,
  },
  iconThumbShell: {
    width: '100%',
    height: 80,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  iconThumbInner: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  titleBlock: { gap: 6 },
  fileTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  metaText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
