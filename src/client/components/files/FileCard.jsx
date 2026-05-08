import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { formatDateShort, formatFileSize, getFileTypeFromItem, getFriendlyFileTitle } from '../../../shared/utils/fileFormatting';

const TYPE_META = {
  image: { icon: 'image', color: '#06B6D4', label: 'Image' },
  pdf: { icon: 'file-text', color: '#EF4444', label: 'PDF' },
  document: { icon: 'file-text', color: '#3B82F6', label: 'Document' },
  spreadsheet: { icon: 'grid', color: '#10B981', label: 'Spreadsheet' },
  video: { icon: 'video', color: '#A855F7', label: 'Video' },
  file: { icon: 'file', color: '#9CA3AF', label: 'File' },
  note: { icon: 'file-text', color: '#EC4899', label: 'Note' },
};

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
  const fileType = getFileTypeFromItem(item);
  const meta = TYPE_META[fileType] || TYPE_META.file;

  const name = getFriendlyFileTitle(item) || 'File';
  const createdAt = item?.createdAt instanceof Date ? item.createdAt : item?.createdAt?.toDate?.() || item?.createdAt;
  const size = item?.size;
  // Thumbnails: for images we can safely fall back to the full download URL.
  const thumb = item?.thumbnailUrl || (fileType === 'image' ? item?.url : null);

  const canDelete = !isTrainerShared && (item?.addedBy || 'client') === 'client';
  const canShare = !isTrainerShared && (item?.addedBy || 'client') === 'client';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onOpen}
      style={{
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: isNew ? 'rgba(255, 107, 157, 0.7)' : 'rgba(255,255,255,0.10)',
        overflow: 'hidden',
      }}
    >
      {isNew && (
        <View
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            backgroundColor: '#FF6B9D',
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingVertical: 4,
            zIndex: 5,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.4 }}>NEW</Text>
        </View>
      )}

      {fileType === 'image' && thumb ? (
        <Image
          source={{ uri: thumb }}
          style={{
            width: '100%',
            height: 120,
            borderRadius: 12,
            marginBottom: 10,
            backgroundColor: 'rgba(0,0,0,0.25)',
          }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            width: '100%',
            height: 86,
            borderRadius: 12,
            marginBottom: 10,
            backgroundColor: 'rgba(255,255,255,0.06)',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
          }}
        >
          <Feather name={meta.icon} size={34} color={meta.color} />
        </View>
      )}

      <View style={{ gap: 6 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '800',
            color: '#fff',
            letterSpacing: -0.2,
          }}
          numberOfLines={2}
        >
          {name}
        </Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.62)' }} numberOfLines={1}>
            {meta.label}
            {createdAt ? ` • ${formatDateShort(createdAt)}` : ''}
          </Text>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.62)' }} numberOfLines={1}>
            {formatFileSize(size)}
          </Text>
        </View>
      </View>

      {showActions && (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
          {onDownload && (
            <TouchableOpacity
              onPress={(e) => {
                e?.stopPropagation?.();
                onDownload();
              }}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(6, 182, 212, 0.10)',
                borderWidth: 1,
                borderColor: 'rgba(6, 182, 212, 0.25)',
              }}
              accessibilityRole="button"
            >
              <Feather name="download" size={18} color="#06B6D4" />
            </TouchableOpacity>
          )}

          {canShare && onShare && (
            <TouchableOpacity
              onPress={(e) => {
                e?.stopPropagation?.();
                onShare();
              }}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255, 107, 157, 0.10)',
                borderWidth: 1,
                borderColor: 'rgba(255, 107, 157, 0.25)',
              }}
              accessibilityRole="button"
            >
              <Feather name="share-2" size={18} color="#FF6B9D" />
            </TouchableOpacity>
          )}

          {canDelete && onDelete && (
            <TouchableOpacity
              onPress={(e) => {
                e?.stopPropagation?.();
                onDelete();
              }}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(239, 68, 68, 0.10)',
                borderWidth: 1,
                borderColor: 'rgba(239, 68, 68, 0.22)',
              }}
              accessibilityRole="button"
            >
              <Feather name="trash-2" size={18} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

