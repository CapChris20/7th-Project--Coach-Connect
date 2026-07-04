/**
 * File Gallery Grid
 *
 * Purpose: File Gallery Grid — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: FileGalleryGrid
 *
 * @file-header
 */
/**
 * Shared file gallery UI — gradient-bordered cards in a 2-column grid.
 * Previews: stored thumbnailUrl (upload), Google embedded viewer for PDFs/docs/sheets, expo-av Video for video without thumb.
 */

import React from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet, Image, Platform, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import { Video, ResizeMode } from 'expo-av';
import {
  FileText,
  FileSpreadsheet,
  FileType2,
  File as FileIcon,
  Image as ImageIcon,
} from 'lucide-react-native';
import { getFriendlyFileTitle } from '../../../shared-utils/formatFileSize';

const PALETTES = ['cyan', 'pink', 'purple', 'orange'];

const COLORS = {
  light: {
    background: '#FFFFFF',
    foreground: '#0B0B12',
    surface: '#FFFFFF',
    surfaceTint: '#F0F2F8',
    textMuted: '#5C6370',
    border: '#E4E7EE',
  },
  dark: {
    background: '#0A0A0F',
    foreground: '#FFFFFF',
    surface: '#131319',
    surfaceTint: '#222230',
    textMuted: '#9CA3AF',
    border: '#2D2D38',
  },
};

const GRADIENTS = {
  cyan: '#64D2FF',
  pink: '#FF6B9D',
  purple: '#C084FC',
  orange: '#F97316',
};

const paletteClass = (i) => PALETTES[i % PALETTES.length];

const getPaletteGradient = (palette) => {
  const map = {
    cyan: [GRADIENTS.cyan, GRADIENTS.pink],
    pink: [GRADIENTS.pink, GRADIENTS.purple],
    purple: [GRADIENTS.purple, GRADIENTS.orange],
    orange: [GRADIENTS.orange, GRADIENTS.cyan],
  };
  return map[palette] || map.cyan;
};

function thumbHeight(dense) {
  return dense ? 56 : 64;
}

function googleEmbedUrl(url) {
  if (!url || typeof url !== 'string') return '';
  return `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;
}

function officeEmbedUrl(url) {
  if (!url || typeof url !== 'string') return '';
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
}

/** Decode storage-safe titles like Quiz-2%28CIS%29.docx */
function decodeFileTitle(file) {
  const raw = getFriendlyFileTitle(file) || file?.name || file?.title || 'File';
  try {
    return decodeURIComponent(String(raw));
  } catch {
    return String(raw);
  }
}

function normalizePreviewText(s) {
  if (!s || typeof s !== 'string') return '';
  return s.replace(/[#*_`[\]]/g, '').replace(/\s+/g, ' ').trim();
}

function buildEmbedStrategies(file, url) {
  if (!url) return [];
  const name = (file.name || file.title || '').toLowerCase();
  const mime = (file.mimeType && String(file.mimeType).toLowerCase()) || '';
  const strategies = [];
  const isPdf = file.type === 'pdf' || name.endsWith('.pdf') || mime.includes('pdf');
  const isOffice =
    /\.(doc|docx|ppt|pptx|xls|xlsx|csv)$/i.test(name) ||
    file.type === 'spreadsheet' ||
    mime.includes('spreadsheet') ||
    mime.includes('word') ||
    mime.includes('officedocument') ||
    mime.includes('msword');

  // 1) Native PDF in WebView (works with Firebase download URLs on-device)
  if (isPdf) {
    strategies.push({ uri: url, key: 'pdf-direct' });
  }
  // 2) Microsoft viewer for Office files (often works when Google cannot fetch private URLs)
  if (isOffice) {
    strategies.push({ uri: officeEmbedUrl(url), key: 'office' });
  }
  // 3) Google viewer fallback
  strategies.push({ uri: googleEmbedUrl(url), key: 'google' });

  const seen = new Set();
  return strategies.filter((s) => {
    if (!s.uri || seen.has(s.uri)) return false;
    seen.add(s.uri);
    return true;
  });
}

/** Try PDF → Office → Google until one loads (snapshots for uploaded files with url). */
function MultiStrategyDocPreview({ file, url, height, bg, fallback }) {
  const strategies = React.useMemo(() => buildEmbedStrategies(file, url), [file, url]);
  const [idx, setIdx] = React.useState(0);

  React.useEffect(() => {
    setIdx(0);
  }, [url, strategies.length]);

  if (strategies.length === 0 || idx >= strategies.length) {
    return fallback;
  }

  const s = strategies[idx];
  return (
    <View style={[styles.previewSlot, { height, backgroundColor: bg, overflow: 'hidden' }]}>
      <WebView
        key={s.key}
        source={{ uri: s.uri }}
        style={styles.webInner}
        scrollEnabled={false}
        pointerEvents="none"
        originWhitelist={['*']}
        androidLayerType="hardware"
        mixedContentMode="always"
        allowsInlineMediaPlayback
        onError={() => setIdx((i) => i + 1)}
        onHttpError={() => setIdx((i) => i + 1)}
      />
    </View>
  );
}

/** Trainer-shared doc stubs have no Storage URL — show body text like a document snapshot. */
function PaperDocPreview({ title, excerpt, height, colors, showSkeleton }) {
  const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
  const bodyText = normalizePreviewText(excerpt);

  return (
    <View style={[styles.paperPreview, { height, backgroundColor: colors.surfaceTint }]}>
      <View style={[styles.paperAccent, { backgroundColor: colors.foreground }]} />
      <Text style={[styles.paperTitle, { color: colors.foreground }]} numberOfLines={2}>
        {title}
      </Text>
      {bodyText.length > 0 ? (
        <Text style={[styles.paperBody, { color: colors.textMuted, fontFamily: mono }]} numberOfLines={7}>
          {bodyText}
        </Text>
      ) : showSkeleton ? (
        <View style={styles.fakeLines}>
          {[0.92, 0.85, 0.72, 0.88].map((w, i) => (
            <View
              key={i}
              style={[styles.fakeLine, { width: `${w * 100}%`, backgroundColor: colors.border }]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function iconForDisplayType(type, size = 26, iconColor = '#FFFFFF') {
  const c = iconColor;
  switch (type) {
    case 'PDF':
      return <FileText size={size} color={c} />;
    case 'Document':
      return <FileType2 size={size} color={c} />;
    case 'Spreadsheet':
      return <FileSpreadsheet size={size} color={c} />;
    case 'Image':
      return <ImageIcon size={size} color={c} />;
    default:
      return <FileIcon size={size} color={c} />;
  }
}

function displayTypeForFile(file) {
  if (!file) return 'Other';
  if (file.type === 'spreadsheet') return 'Spreadsheet';
  if (file.type === 'document') return 'Document';
  if (file.type === 'pdf') return 'PDF';
  if (file.type === 'photo') return 'Image';
  if (file.type === 'video') return 'Video';
  const n = (file.name || file.title || '').toLowerCase();
  if (n.endsWith('.pdf')) return 'PDF';
  if (n.endsWith('.csv') || n.endsWith('.xlsx') || n.endsWith('.xls')) return 'Spreadsheet';
  if (n.endsWith('.doc') || n.endsWith('.docx')) return 'Document';
  return 'File';
}

function shortDate(d) {
  if (!d) return '';
  try {
    const t = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(t.getTime())) return '';
    return t.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function storedThumbnailUri(file) {
  return file?.thumbnailUrl || file?.thumbUrl || file?.previewUrl || file?.thumb || null;
}

function isImageFile(file) {
  if (!file) return false;
  if (file.type === 'photo') return true;
  if (file.mimeType && String(file.mimeType).startsWith('image/')) return true;
  return false;
}

function isVideoFile(file) {
  if (!file) return false;
  if (file.type === 'video') return true;
  if (file.mimeType && String(file.mimeType).startsWith('video/')) return true;
  return false;
}

/** PDF, Word, spreadsheet, etc. — embed snapshot via Google viewer (public HTTPS URLs). */
function shouldEmbedDocumentPreview(file) {
  if (!file?.url) return false;
  const mime = (file.mimeType && String(file.mimeType).toLowerCase()) || '';
  if (mime.startsWith('image/') || mime.startsWith('video/')) return false;
  const t = file.type;
  if (t === 'photo' || t === 'video') return false;
  if (t === 'pdf' || t === 'spreadsheet' || t === 'document' || t === 'doc') return true;
  const n = (file.name || file.title || '').toLowerCase();
  if (/\.(pdf|doc|docx|xlsx|xls|csv|ppt|pptx)(\?|$)/i.test(n)) return true;
  if (mime.includes('pdf')) return true;
  if (mime.includes('word') || mime.includes('officedocument') || mime.includes('msword')) return true;
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return true;
  return false;
}

function VideoThumb({ url, posterUri, height }) {
  if (posterUri) {
    return <Image source={{ uri: posterUri }} style={[styles.previewImg, { height }]} />;
  }
  if (!url) {
    return <View style={[styles.previewSlot, { height }]} />;
  }
  return (
    <Video
      source={{ uri: url }}
      style={[styles.previewImg, { height }]}
      resizeMode={ResizeMode.COVER}
      shouldPlay={false}
      isLooping={false}
      isMuted
      useNativeControls={false}
    />
  );
}

function HoldPressable({
  enabled,
  durationMs = 850,
  onPress,
  onHoldComplete,
  children,
  style,
}) {
  const progress = React.useRef(new Animated.Value(0)).current;
  const didCompleteRef = React.useRef(false);

  const reset = React.useCallback(() => {
    didCompleteRef.current = false;
    progress.stopAnimation();
    progress.setValue(0);
  }, [progress]);

  const start = React.useCallback(() => {
    if (!enabled) return;
    didCompleteRef.current = false;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: Math.max(250, Number(durationMs) || 850),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) return;
      if (didCompleteRef.current) return;
      didCompleteRef.current = true;
      onHoldComplete?.();
      // Keep a subtle completion flash, then reset.
      setTimeout(() => reset(), 250);
    });
  }, [enabled, durationMs, onHoldComplete, progress, reset]);

  return (
    <Pressable
      onPress={enabled ? undefined : onPress}
      onPressIn={start}
      onPressOut={reset}
      style={style}
    >
      {children}
      {enabled ? (
        <View pointerEvents="none" style={styles.holdOverlayWrap}>
          <Animated.View
            style={[
              styles.holdOverlayFill,
              {
                opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] }),
                transform: [
                  { scaleX: progress },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.holdBar,
              {
                width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              },
            ]}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

function GalleryImageCard({ file, palette, colors, onPress, onLongPress, thumbH, holdToAction }) {
  const uri = storedThumbnailUri(file) || file.url || file.src;
  const label = displayTypeForFile(file);
  const metaDate = shortDate(file.createdAt);
  const title = decodeFileTitle(file);

  return (
    <HoldPressable
      style={styles.card}
      enabled={!!holdToAction}
      durationMs={holdToAction?.durationMs}
      onPress={onPress}
      onHoldComplete={holdToAction ? () => holdToAction.onComplete?.(file) : undefined}
    >
      <LinearGradient
        colors={getPaletteGradient(palette)}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.gradBorder}
      >
        <View style={[styles.gradInner, { backgroundColor: colors.surface }]}>
          {uri ? (
            <Image source={{ uri }} style={[styles.previewImg, { height: thumbH }]} />
          ) : (
            <View style={[styles.previewSlot, styles.iconPlaceholder, { height: thumbH, backgroundColor: colors.surfaceTint }]}>
              {iconForDisplayType('Image', 28, colors.textMuted)}
            </View>
          )}
          <View style={styles.cardInfo}>
            <Text style={[styles.cardName, { color: colors.foreground }]} numberOfLines={2}>
              {title}
            </Text>
            <Text style={[styles.cardMeta, { color: colors.textMuted }]} numberOfLines={1}>
              {label}
              {metaDate ? ` · ${metaDate}` : ''}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </HoldPressable>
  );
}

function GalleryFileCard({
  file,
  palette,
  colors,
  onPress,
  onLongPress,
  displayType,
  thumbH,
  holdToAction,
}) {
  const label = displayType || displayTypeForFile(file);
  const metaDate = shortDate(file.createdAt || file.updatedAt);
  const title = decodeFileTitle(file);
  const stored = storedThumbnailUri(file);
  const url = file.url;
  const mutedIcon = colors.textMuted;
  const snippet = String(file.previewSnippet || file.previewText || '').trim();
  const isTrainerDocStub =
    file.type === 'document' && file.documentId && file.trainerId && !url;

  const tintBase = colors.surfaceTint;
  const filePreviewBg = { backgroundColor: tintBase };

  const iconFallback = (
    <View style={[styles.previewSlot, styles.iconPlaceholder, { height: thumbH }]}>
      {iconForDisplayType(label, 28, mutedIcon)}
    </View>
  );

  let inner = null;
  if (stored) {
    inner = <Image source={{ uri: stored }} style={[styles.previewImg, { height: thumbH }]} />;
  } else if (isVideoFile(file) && url) {
    inner = <VideoThumb url={url} posterUri={null} height={thumbH} />;
  } else if ((isTrainerDocStub || (!url && snippet)) && (snippet || isTrainerDocStub)) {
    inner = (
      <PaperDocPreview
        title={title}
        excerpt={snippet}
        height={thumbH}
        colors={colors}
        showSkeleton={isTrainerDocStub && !snippet}
      />
    );
  } else if (url && shouldEmbedDocumentPreview(file)) {
    inner = (
      <MultiStrategyDocPreview
        file={file}
        url={url}
        height={thumbH}
        bg={tintBase}
        fallback={iconFallback}
      />
    );
  } else if (url && (label === 'Image' || (file.mimeType && String(file.mimeType).startsWith('image/')))) {
    inner = <Image source={{ uri: url }} style={[styles.previewImg, { height: thumbH }]} />;
  } else {
    inner = iconFallback;
  }

  return (
    <HoldPressable
      style={styles.card}
      enabled={!!holdToAction}
      durationMs={holdToAction?.durationMs}
      onPress={onPress}
      onHoldComplete={holdToAction ? () => holdToAction.onComplete?.(file) : undefined}
    >
      <LinearGradient
        colors={getPaletteGradient(palette)}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.gradBorder}
      >
        <View style={[styles.gradInner, { backgroundColor: colors.surface }]}>
          <View style={[styles.filePreview, filePreviewBg]}>
            {inner}
            <View style={styles.tintOverlay} pointerEvents="none" />
            <LinearGradient
              colors={getPaletteGradient(palette)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconBadge}
            >
              <View style={styles.iconContainer}>{iconForDisplayType(label, 16)}</View>
            </LinearGradient>
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardName, { color: colors.foreground }]} numberOfLines={2}>
              {title}
            </Text>
            <Text style={[styles.cardMeta, { color: colors.textMuted }]} numberOfLines={1}>
              {label}
              {metaDate ? ` · ${metaDate}` : ''}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </HoldPressable>
  );
}

/**
 * @param {boolean} [props.dense] — tighter thumbnail height (modal / compact)
 */
export default function FileGalleryGrid({
  isDark,
  files = [],
  maxItems,
  onPressItem,
  onLongPressItem,
  footerLink,
  hideWhenEmpty,
  dense = false,
  holdToDelete = false,
  holdDurationMs = 850,
}) {
  const colors = isDark ? COLORS.dark : COLORS.light;
  const list = typeof maxItems === 'number' ? files.slice(0, maxItems) : [...files];
  const thumbH = thumbHeight(dense);

  if (hideWhenEmpty && list.length === 0) return null;

  return (
    <View>
      <View style={styles.gallery}>
        {list.map((file, i) => {
          const palette = paletteClass(i);
          const imageKind = isImageFile(file);
          const handler = () => onPressItem?.(file);
          const longHandler = onLongPressItem ? () => onLongPressItem(file) : undefined;
          const holdToAction =
            holdToDelete && onLongPressItem
              ? { durationMs: holdDurationMs, onComplete: (f) => onLongPressItem?.(f) }
              : null;
          if (imageKind && file.url) {
            return (
              <GalleryImageCard
                key={file.id || `${file.name || file.title || 'img'}_${i}`}
                file={file}
                palette={palette}
                colors={colors}
                onPress={handler}
                onLongPress={longHandler}
                thumbH={thumbH}
                holdToAction={holdToAction}
              />
            );
          }
          return (
            <GalleryFileCard
              key={file.id || `${file.name || file.title || 'f'}_${i}`}
              file={file}
              palette={palette}
              colors={colors}
              onPress={handler}
              onLongPress={longHandler}
              displayType={displayTypeForFile(file)}
              thumbH={thumbH}
              holdToAction={holdToAction}
            />
          );
        })}
      </View>
      {footerLink ? (
        <TouchableOpacity activeOpacity={0.85} onPress={footerLink.onPress} style={styles.footerBtn}>
          <Text style={styles.footerText}>{footerLink.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export { COLORS as FILE_GALLERY_THEME_COLORS, getPaletteGradient, paletteClass };

const styles = StyleSheet.create({
  gallery: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    maxWidth: '48%',
  },
  holdOverlayWrap: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  holdOverlayFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  holdBar: {
    height: 3,
    backgroundColor: '#FF6B9D',
    alignSelf: 'flex-start',
  },
  gradBorder: {
    borderRadius: 16,
    padding: 1.5,
    overflow: 'hidden',
  },
  gradInner: {
    borderRadius: 14.5,
    overflow: 'hidden',
  },
  previewImg: {
    width: '100%',
    resizeMode: 'cover',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  previewSlot: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  webInner: {
    flex: 1,
    backgroundColor: 'transparent',
    opacity: 0.98,
  },
  paperPreview: {
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'flex-start',
  },
  paperAccent: {
    width: 32,
    height: 3,
    borderRadius: 2,
    marginBottom: 6,
    opacity: 0.9,
  },
  paperTitle: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  paperBody: {
    fontSize: 9,
    lineHeight: 12,
  },
  fakeLines: {
    gap: 6,
    marginTop: 2,
    width: '100%',
  },
  fakeLine: {
    height: 4,
    borderRadius: 2,
    alignSelf: 'flex-start',
    opacity: 0.35,
  },
  filePreview: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  tintOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 12, 22, 0.075)',
  },
  iconPlaceholder: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  cardName: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 15,
  },
  cardMeta: {
    fontSize: 10,
    marginTop: 2,
    lineHeight: 13,
  },
  footerBtn: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B9D',
    textDecorationLine: 'underline',
  },
});
