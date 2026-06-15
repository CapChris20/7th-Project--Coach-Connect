/**
 * File Card
 *
 * Purpose: UI screen or component: File Card. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/client
 * Key exports: FileCard
 *
 * @file-header
 */
import React from 'react';
import { Image, Platform, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { formatDateShort, formatFileSize, getFileTypeFromItem, getFriendlyFileTitle } from '../../shared/utils/formatFileSize';

const TYPE_META = {
  image: { icon: 'image', color: '#06B6D4', rgb: '6,182,212', label: 'Photo' },
  pdf: { icon: 'file-text', color: '#EF4444', rgb: '239,68,68', label: 'PDF' },
  document: { icon: 'file-text', color: '#3B82F6', rgb: '59,130,246', label: 'Document' },
  spreadsheet: { icon: 'grid', color: '#10B981', rgb: '16,185,129', label: 'Spreadsheet' },
  video: { icon: 'video', color: '#A855F7', rgb: '168,85,247', label: 'Video' },
  file: { icon: 'file', color: '#9CA3AF', rgb: '156,163,175', label: 'File' },
  note: { icon: 'edit-3', color: '#C084FC', rgb: '192,132,252', label: 'Note' },
};

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
  const name = getFriendlyFileTitle(item) || 'File';
  const createdAt = item?.createdAt instanceof Date ? item.createdAt : item?.createdAt?.toDate?.() || item?.createdAt;
  const size = item?.size;
  const thumb = item?.thumbnailUrl || (fileType === 'image' ? item?.url : null);
  const canDelete = !isTrainerShared && (item?.addedBy || 'client') === 'client';
  const canShare = !isTrainerShared && (item?.addedBy || 'client') === 'client';

  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF';
  const border = isNew
    ? `rgba(255,107,157,0.6)`
    : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#FFFFFF' : '#1A1A2E';
  const mutedColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const placeholderBg = isDark ? 'rgba(255,255,255,0.05)' : `rgba(${meta.rgb},0.06)`;

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onOpen}
      style={{
        backgroundColor: cardBg,
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: border,
        overflow: 'hidden',
        ...Platform.select({
          ios: {
            shadowColor: isDark ? '#000' : meta.color,
            shadowRadius: isDark ? 6 : 10,
            shadowOpacity: isDark ? 0.2 : 0.06,
            shadowOffset: { width: 0, height: 4 },
          },
          android: { elevation: isDark ? 2 : 3 },
        }),
      }}
    >
      {isNew && (
        <LinearGradient
          colors={['#FF6B9D', '#F97316']}
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
          <Text style={{ fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.6 }}>NEW</Text>
        </LinearGradient>
      )}

      {fileType === 'image' && thumb ? (
        <Image
          source={{ uri: thumb }}
          style={{
            width: '100%',
            height: 120,
            borderRadius: 12,
            marginBottom: 10,
            backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)',
          }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            width: '100%',
            height: 80,
            borderRadius: 12,
            marginBottom: 10,
            backgroundColor: placeholderBg,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : `rgba(${meta.rgb},0.12)`,
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
      )}

      <View style={{ gap: 4 }}>
        <Text
          style={{ fontSize: 14, fontWeight: '700', color: textColor, letterSpacing: -0.2 }}
          numberOfLines={2}
        >
          {name}
        </Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
          <Text style={{ fontSize: 11, color: mutedColor, fontWeight: '500' }} numberOfLines={1}>
            {meta.label}
            {createdAt ? ` \u00B7 ${formatDateShort(createdAt)}` : ''}
          </Text>
          <Text style={{ fontSize: 11, color: mutedColor, fontWeight: '500' }} numberOfLines={1}>
            {formatFileSize(size)}
          </Text>
        </View>
      </View>

      {showActions && (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          {onDownload && (
            <TouchableOpacity
              onPress={(e) => { e?.stopPropagation?.(); onDownload(); }}
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDark ? 'rgba(6,182,212,0.10)' : 'rgba(6,182,212,0.08)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(6,182,212,0.22)' : 'rgba(6,182,212,0.18)',
              }}
            >
              <Feather name="download" size={16} color="#06B6D4" />
            </TouchableOpacity>
          )}
          {canShare && onShare && (
            <TouchableOpacity
              onPress={(e) => { e?.stopPropagation?.(); onShare(); }}
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDark ? 'rgba(255,107,157,0.10)' : 'rgba(255,107,157,0.08)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,107,157,0.22)' : 'rgba(255,107,157,0.18)',
              }}
            >
              <Feather name="share-2" size={16} color="#FF6B9D" />
            </TouchableOpacity>
          )}
          {canDelete && onDelete && (
            <TouchableOpacity
              onPress={(e) => { e?.stopPropagation?.(); onDelete(); }}
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDark ? 'rgba(239,68,68,0.10)' : 'rgba(239,68,68,0.06)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(239,68,68,0.20)' : 'rgba(239,68,68,0.14)',
              }}
            >
              <Feather name="trash-2" size={16} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}
