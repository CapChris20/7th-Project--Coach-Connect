// One card in the client Notes & Files list: thumbnail, title, type, date, size, and optional actions.
// Flow: pick type meta → theme colors → thumbnail or icon → title row → download / share / delete if allowed.
// Used by: the client files list. Trainers' shared files hide share/delete so the client cannot remove them.
//
// vocab: neobrutalist = thick borders, hard shadows, no gradients except for NEW badge

import React from 'react';
import { Image, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import NbCard from '../../look-and-feel/NbCard';
import { lightColors, darkColors, gradients } from '../../look-and-feel/colorPalette';
import { formatDateShort, formatFileSize, getFileTypeFromItem, getFriendlyFileTitle } from '../../helpers/fileSizeAndDateText';

// ===== NAMED CONSTANTS =====

const ADDED_BY_CLIENT = 'client';
const FILE_TYPE_IMAGE = 'image';
const DEFAULT_FILE_NAME = 'File';

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

function stopAndRun(event, action) {
  event?.stopPropagation?.();
  action();
}

function NewBadge() {
  return (
    <LinearGradient
      colors={gradients.brand.colors}
      start={gradients.brand.start}
      end={gradients.brand.end}
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
      <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: '#0A0A0F', letterSpacing: 0.1, textTransform: 'uppercase' }}>NEW</Text>
    </LinearGradient>
  );
}

function FileThumbnail({ fileType, thumb, colors, meta }) {
  if (fileType === FILE_TYPE_IMAGE && thumb) {
    return (
      <Image
        source={{ uri: thumb }}
        style={{
          width: '100%',
          height: 120,
          borderRadius: 12,
          marginBottom: 12,
          backgroundColor: colors.nbSurfaceChip,
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
        marginBottom: 12,
        backgroundColor: colors.nbSurfaceChip,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2.5,
        borderColor: colors.nbBorder,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          backgroundColor: colors.nbSurfaceChip,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name={meta.icon} size={24} color={colors.nbMuted} />
      </View>
    </View>
  );
}

function ActionIconButton({ onPress, icon, colors }) {
  return (
    <TouchableOpacity
      onPress={(event) => stopAndRun(event, onPress)}
      style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.nbSurfaceChip,
        borderWidth: 2.5,
        borderColor: colors.nbBorder,
      }}
    >
      <Feather name={icon} size={18} color={colors.nbInk} />
    </TouchableOpacity>
  );
}

function FileCardActions({ colors, onDownload, onShare, onDelete, canShare, canDelete }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
      {onDownload && (
        <ActionIconButton
          onPress={onDownload}
          icon="download"
          colors={colors}
        />
      )}
      {canShare && onShare && (
        <ActionIconButton
          onPress={onShare}
          icon="share-2"
          colors={colors}
        />
      )}
      {canDelete && onDelete && (
        <ActionIconButton
          onPress={onDelete}
          icon="trash-2"
          colors={colors}
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
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;
  
  const fileType = getFileTypeFromItem(item);
  const meta = TYPE_META[fileType] || TYPE_META.file;
  const name = getFriendlyFileTitle(item) || DEFAULT_FILE_NAME;
  const createdAt = createdAtFromItem(item);
  const size = item?.size;
  const thumb = thumbnailFromItem(item, fileType);
  const canDelete = !isTrainerShared && isClientOwned(item);
  const canShare = !isTrainerShared && isClientOwned(item);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onOpen}
    >
      <NbCard style={{ padding: 12, position: 'relative' }}>
        {isNew && <NewBadge />}

        <FileThumbnail fileType={fileType} thumb={thumb} colors={colors} meta={meta} />

        <View style={{ gap: 6 }}>
          <Text
            style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.nbInk }}
            numberOfLines={2}
          >
            {name}
          </Text>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
            <Text style={{ fontSize: 13, color: colors.nbMuted, fontFamily: 'Inter_400Regular' }} numberOfLines={1}>
              {typeAndDateLabel(meta, createdAt)}
            </Text>
            <Text style={{ fontSize: 13, color: colors.nbMuted, fontFamily: 'Inter_400Regular' }} numberOfLines={1}>
              {formatFileSize(size)}
            </Text>
          </View>
        </View>

        {showActions && (
          <FileCardActions
            colors={colors}
            onDownload={onDownload}
            onShare={onShare}
            onDelete={onDelete}
            canShare={canShare}
            canDelete={canDelete}
          />
        )}
      </NbCard>
    </TouchableOpacity>
  );
}
