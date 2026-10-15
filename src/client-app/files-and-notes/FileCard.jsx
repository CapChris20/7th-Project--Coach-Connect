// One card in the client Notes & Files list: thumbnail, title, type, date, size, and optional actions.
// Flow: pick type meta → theme colors → thumbnail or icon → title row → download / share / delete if allowed.
// Used by: the client files list. Trainers' shared files hide share/delete so the client cannot remove them.

import React from 'react';
import { Image, Platform, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { formatDateShort, formatFileSize, getFileTypeFromItem, getFriendlyFileTitle } from '../../helpers/fileSizeAndDateText';

// ===== NAMED CONSTANTS =====

const ADDED_BY_CLIENT = 'client';
const FILE_TYPE_IMAGE = 'image';
const DEFAULT_FILE_NAME = 'File';

const NEW_BADGE_COLORS = ['#FF6B9D', '#F97316'];
const NEW_BADGE_TEXT = '#fff';
const DOWNLOAD_ICON_COLOR = '#06B6D4';
const SHARE_ICON_COLOR = '#FF6B9D';
const DELETE_ICON_COLOR = '#EF4444';

const TYPE_META = {
  image: { icon: 'image', color: '#06B6D4', rgb: '6,182,212', label: 'Photo' },
  pdf: { icon: 'file-text', color: '#EF4444', rgb: '239,68,68', label: 'PDF' },
  document: { icon: 'file-text', color: '#3B82F6', rgb: '59,130,246', label: 'Document' },
  spreadsheet: { icon: 'grid', color: '#10B981', rgb: '16,185,129', label: 'Spreadsheet' },
  video: { icon: 'video', color: '#A855F7', rgb: '168,85,247', label: 'Video' },
  file: { icon: 'file', color: '#9CA3AF', rgb: '156,163,175', label: 'File' },
  note: { icon: 'edit-3', color: '#C084FC', rgb: '192,132,252', label: 'Note' },
};

// ===== HELPER FUNCTIONS =====

function createdAtFromItem(item) {
  if (item?.createdAt instanceof Date) return item.createdAt;
  return item?.createdAt?.toDate?.() || item?.createdAt;
}

function thumbnailFromItem(item, fileType) {
  if (item?.thumbnailUrl) return item.thumbnailUrl;
  if (fileType === FILE_TYPE_IMAGE) return item?.url;
  return null;
}

function isClientOwned(item) {
  return (item?.addedBy || ADDED_BY_CLIENT) === ADDED_BY_CLIENT;
}

function fileCardBorder(isNew, isDark) {
  if (isNew) return 'rgba(255,107,157,0.6)';
  if (isDark) return 'rgba(255,255,255,0.08)';
  return 'rgba(0,0,0,0.06)';
}

function fileCardPalette(isDark, isNew, meta) {
  return {
    cardBg: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
    border: fileCardBorder(isNew, isDark),
    textColor: isDark ? '#FFFFFF' : '#1A1A2E',
    mutedColor: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)',
    placeholderBg: isDark ? 'rgba(255,255,255,0.05)' : `rgba(${meta.rgb},0.06)`,
    imageFallbackBg: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)',
    placeholderBorder: isDark ? 'rgba(255,255,255,0.06)' : `rgba(${meta.rgb},0.12)`,
  };
}

function cardShadow(isDark, meta) {
  return Platform.select({
    ios: {
      shadowColor: isDark ? '#000' : meta.color,
      shadowRadius: isDark ? 6 : 10,
      shadowOpacity: isDark ? 0.2 : 0.06,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: isDark ? 2 : 3 },
  });
}

function stopAndRun(event, action) {
  event?.stopPropagation?.();
  action();
}

function NewBadge() {
  return (
    <LinearGradient
      colors={NEW_BADGE_COLORS}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        zIndex: 5,
      }}
    >
      <Text style={{ fontSize: 9, fontWeight: '800', color: NEW_BADGE_TEXT, letterSpacing: 0.6 }}>NEW</Text>
    </LinearGradient>
  );
}

function FileThumbnail({ fileType, thumb, palette, meta, isDark }) {
  if (fileType === FILE_TYPE_IMAGE && thumb) {
    return (
      <Image
        source={{ uri: thumb }}
        style={{
          width: '100%',
          height: 120,
          borderRadius: 12,
          marginBottom: 10,
          backgroundColor: palette.imageFallbackBg,
        }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View
      style={{
        width: '100%',
        height: 80,
        borderRadius: 12,
        marginBottom: 10,
        backgroundColor: palette.placeholderBg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: palette.placeholderBorder,
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          backgroundColor: `rgba(${meta.rgb},0.12)`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name={meta.icon} size={22} color={meta.color} />
      </View>
    </View>
  );
}

function ActionIconButton({ onPress, backgroundColor, borderColor, icon, iconColor }) {
  return (
    <TouchableOpacity
      onPress={(event) => stopAndRun(event, onPress)}
      style={{
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor,
        borderWidth: 1,
        borderColor,
      }}
    >
      <Feather name={icon} size={16} color={iconColor} />
    </TouchableOpacity>
  );
}

function FileCardActions({ isDark, onDownload, onShare, onDelete, canShare, canDelete }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
      {onDownload && (
        <ActionIconButton
          onPress={onDownload}
          backgroundColor={isDark ? 'rgba(6,182,212,0.10)' : 'rgba(6,182,212,0.08)'}
          borderColor={isDark ? 'rgba(6,182,212,0.22)' : 'rgba(6,182,212,0.18)'}
          icon="download"
          iconColor={DOWNLOAD_ICON_COLOR}
        />
      )}
      {canShare && onShare && (
        <ActionIconButton
          onPress={onShare}
          backgroundColor={isDark ? 'rgba(255,107,157,0.10)' : 'rgba(255,107,157,0.08)'}
          borderColor={isDark ? 'rgba(255,107,157,0.22)' : 'rgba(255,107,157,0.18)'}
          icon="share-2"
          iconColor={SHARE_ICON_COLOR}
        />
      )}
      {canDelete && onDelete && (
        <ActionIconButton
          onPress={onDelete}
          backgroundColor={isDark ? 'rgba(239,68,68,0.10)' : 'rgba(239,68,68,0.06)'}
          borderColor={isDark ? 'rgba(239,68,68,0.20)' : 'rgba(239,68,68,0.14)'}
          icon="trash-2"
          iconColor={DELETE_ICON_COLOR}
        />
      )}
    </View>
  );
}

function typeAndDateLabel(meta, createdAt) {
  if (!createdAt) return meta.label;
  return `${meta.label} \u00B7 ${formatDateShort(createdAt)}`;
}

// ===== MAIN FUNCTION =====

/**
 * File / note card for the client library.
 * @param {object} props
 */
export function FileCard({
  item,
  isDark = true,
  showActions = true,
  isNew = false,
  isTrainerShared = false,
  onOpen,
  onDownload,
  onDelete,
  onShare,
}) {
  const fileType = getFileTypeFromItem(item);
  const meta = TYPE_META[fileType] || TYPE_META.file;
  const name = getFriendlyFileTitle(item) || DEFAULT_FILE_NAME;
  const createdAt = createdAtFromItem(item);
  const size = item?.size;
  const thumb = thumbnailFromItem(item, fileType);
  const canDelete = !isTrainerShared && isClientOwned(item);
  const canShare = !isTrainerShared && isClientOwned(item);
  const palette = fileCardPalette(isDark, isNew, meta);

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onOpen}
      style={{
        backgroundColor: palette.cardBg,
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: palette.border,
        overflow: 'hidden',
        ...cardShadow(isDark, meta),
      }}
    >
      {isNew && <NewBadge />}

      <FileThumbnail fileType={fileType} thumb={thumb} palette={palette} meta={meta} isDark={isDark} />

      <View style={{ gap: 4 }}>
        <Text
          style={{ fontSize: 14, fontWeight: '700', color: palette.textColor, letterSpacing: -0.2 }}
          numberOfLines={2}
        >
          {name}
        </Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
          <Text style={{ fontSize: 11, color: palette.mutedColor, fontWeight: '500' }} numberOfLines={1}>
            {typeAndDateLabel(meta, createdAt)}
          </Text>
          <Text style={{ fontSize: 11, color: palette.mutedColor, fontWeight: '500' }} numberOfLines={1}>
            {formatFileSize(size)}
          </Text>
        </View>
      </View>

      {showActions && (
        <FileCardActions
          isDark={isDark}
          onDownload={onDownload}
          onShare={onShare}
          onDelete={onDelete}
          canShare={canShare}
          canDelete={canDelete}
        />
      )}
    </TouchableOpacity>
  );
}
