// Two-column file gallery: photos, videos, PDFs, and trainer document stubs.
// Flow: pick a palette → image card or file card → hold-to-delete overlay when asked.
// Used by Notes & Files screens and compact file modals.

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
import { getFriendlyFileTitle } from '../../../helpers/fileSizeAndDateText';

// ===== NAMED CONSTANTS =====

const PALETTES = ['cyan', 'pink', 'purple', 'orange'];
const HOLD_DURATION_MS = 850;
const HOLD_MIN_DURATION_MS = 250;
const HOLD_RESET_DELAY_MS = 250;
const DEFAULT_ICON_SIZE = 26;

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

const PALETTE_GRADIENTS = {
  cyan: [GRADIENTS.cyan, GRADIENTS.pink],
  pink: [GRADIENTS.pink, GRADIENTS.purple],
  purple: [GRADIENTS.purple, GRADIENTS.orange],
  orange: [GRADIENTS.orange, GRADIENTS.cyan],
};

// ===== HELPER FUNCTIONS =====

const paletteClass = (index) => PALETTES[index % PALETTES.length];

const getPaletteGradient = (palette) => {
  return PALETTE_GRADIENTS[palette] || PALETTE_GRADIENTS.cyan;
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

function normalizePreviewText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  return rawText.replace(/[#*_`[\]]/g, '').replace(/\s+/g, ' ').trim();
}

function isPdfFile(file, fileName, mimeType) {
  return file.type === 'pdf' || fileName.endsWith('.pdf') || mimeType.includes('pdf');
}

function isOfficeFile(file, fileName, mimeType) {
  if (/\.(doc|docx|ppt|pptx|xls|xlsx|csv)$/i.test(fileName)) return true;
  if (file.type === 'spreadsheet') return true;
  if (mimeType.includes('spreadsheet')) return true;
  if (mimeType.includes('word')) return true;
  if (mimeType.includes('officedocument')) return true;
  if (mimeType.includes('msword')) return true;
  return false;
}

function uniqueStrategies(strategies) {
  const seen = new Set();
  return strategies.filter((strategy) => {
    if (!strategy.uri || seen.has(strategy.uri)) return false;
    seen.add(strategy.uri);
    return true;
  });
}

function buildEmbedStrategies(file, url) {
  if (!url) return [];
  const fileName = (file.name || file.title || '').toLowerCase();
  const mimeType = (file.mimeType && String(file.mimeType).toLowerCase()) || '';
  const strategies = [];

  if (isPdfFile(file, fileName, mimeType)) {
    strategies.push({ uri: url, key: 'pdf-direct' });
  }
  if (isOfficeFile(file, fileName, mimeType)) {
    strategies.push({ uri: officeEmbedUrl(url), key: 'office' });
  }
  strategies.push({ uri: googleEmbedUrl(url), key: 'google' });
  return uniqueStrategies(strategies);
}

/** Try PDF → Office → Google until one loads (snapshots for uploaded files with url). */
function MultiStrategyDocPreview({ file, url, height, previewBackground, fallback }) {
  const strategies = React.useMemo(() => buildEmbedStrategies(file, url), [file, url]);
  const [strategyIndex, setStrategyIndex] = React.useState(0);

  React.useEffect(() => {
    setStrategyIndex(0);
  }, [url, strategies.length]);

  if (strategies.length === 0 || strategyIndex >= strategies.length) {
    return fallback;
  }

  const strategy = strategies[strategyIndex];
  return (
    <View style={[styles.previewSlot, { height, backgroundColor: previewBackground, overflow: 'hidden' }]}>
      <WebView
        key={strategy.key}
        source={{ uri: strategy.uri }}
        style={styles.webInner}
        scrollEnabled={false}
        pointerEvents="none"
        originWhitelist={['*']}
        androidLayerType="hardware"
        mixedContentMode="always"
        allowsInlineMediaPlayback
        onError={() => setStrategyIndex((index) => index + 1)}
        onHttpError={() => setStrategyIndex((index) => index + 1)}
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
          {[0.92, 0.85, 0.72, 0.88].map((widthFraction, index) => (
            <View
              key={index}
              style={[styles.fakeLine, { width: `${widthFraction * 100}%`, backgroundColor: colors.border }]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function iconForDisplayType(type, size = DEFAULT_ICON_SIZE, iconColor = '#FFFFFF') {
  const iconTint = iconColor;
  if (type === 'PDF') return <FileText size={size} color={iconTint} />;
  if (type === 'Document') return <FileType2 size={size} color={iconTint} />;
  if (type === 'Spreadsheet') return <FileSpreadsheet size={size} color={iconTint} />;
  if (type === 'Image') return <ImageIcon size={size} color={iconTint} />;
  return <FileIcon size={size} color={iconTint} />;
}

function displayTypeForFile(file) {
  if (!file) return 'Other';
  if (file.type === 'spreadsheet') return 'Spreadsheet';
  if (file.type === 'document') return 'Document';
  if (file.type === 'pdf') return 'PDF';
  if (file.type === 'photo') return 'Image';
  if (file.type === 'video') return 'Video';
  const fileName = (file.name || file.title || '').toLowerCase();
  if (fileName.endsWith('.pdf')) return 'PDF';
  if (fileName.endsWith('.csv') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) return 'Spreadsheet';
  if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) return 'Document';
  return 'File';
}

function shortDate(dateValue) {
  if (!dateValue) return '';
  try {
    const parsedDate = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) return '';
    return parsedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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

function mimeLooksLikeImage(file) {
  return file.mimeType && String(file.mimeType).startsWith('image/');
}

function nameLooksLikeDocument(fileName) {
  return /\.(pdf|doc|docx|xlsx|xls|csv|ppt|pptx)(\?|$)/i.test(fileName);
}

function mimeLooksLikeDocument(mimeType) {
  if (mimeType.includes('pdf')) return true;
  if (mimeType.includes('word') || mimeType.includes('officedocument') || mimeType.includes('msword')) return true;
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv')) return true;
  return false;
}

/** PDF, Word, spreadsheet, etc. — embed snapshot via Google viewer (public HTTPS URLs). */
function shouldEmbedDocumentPreview(file) {
  if (!file?.url) return false;
  const mimeType = (file.mimeType && String(file.mimeType).toLowerCase()) || '';
  if (mimeType.startsWith('image/') || mimeType.startsWith('video/')) return false;
  const fileType = file.type;
  if (fileType === 'photo' || fileType === 'video') return false;
  if (fileType === 'pdf' || fileType === 'spreadsheet' || fileType === 'document' || fileType === 'doc') return true;
  const fileName = (file.name || file.title || '').toLowerCase();
  if (nameLooksLikeDocument(fileName)) return true;
  return mimeLooksLikeDocument(mimeType);
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
  durationMs = HOLD_DURATION_MS,
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
      duration: Math.max(HOLD_MIN_DURATION_MS, Number(durationMs) || HOLD_DURATION_MS),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) return;
      if (didCompleteRef.current) return;
      didCompleteRef.current = true;
      onHoldComplete?.();
      setTimeout(() => reset(), HOLD_RESET_DELAY_MS);
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

function GalleryImageCard({ file, palette, colors, onPress, thumbH, holdToAction }) {
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

function shouldShowPaperPreview(isTrainerDocStub, url, snippet) {
  if (!(isTrainerDocStub || (!url && snippet))) return false;
  return !!(snippet || isTrainerDocStub);
}

function previewForGalleryFile({
  file,
  title,
  snippet,
  isTrainerDocStub,
  stored,
  url,
  thumbH,
  tintBase,
  label,
  colors,
  iconFallback,
}) {
  if (stored) {
    return <Image source={{ uri: stored }} style={[styles.previewImg, { height: thumbH }]} />;
  }
  if (isVideoFile(file) && url) {
    return <VideoThumb url={url} posterUri={null} height={thumbH} />;
  }
  if (shouldShowPaperPreview(isTrainerDocStub, url, snippet)) {
    return (
      <PaperDocPreview
        title={title}
        excerpt={snippet}
        height={thumbH}
        colors={colors}
        showSkeleton={isTrainerDocStub && !snippet}
      />
    );
  }
  if (url && shouldEmbedDocumentPreview(file)) {
    return (
      <MultiStrategyDocPreview
        file={file}
        url={url}
        height={thumbH}
        previewBackground={tintBase}
        fallback={iconFallback}
      />
    );
  }
  if (url && (label === 'Image' || mimeLooksLikeImage(file))) {
    return <Image source={{ uri: url }} style={[styles.previewImg, { height: thumbH }]} />;
  }
  return iconFallback;
}

function GalleryFileCard({
  file,
  palette,
  colors,
  onPress,
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

  const inner = previewForGalleryFile({
    file,
    title,
    snippet,
    isTrainerDocStub,
    stored,
    url,
    thumbH,
    tintBase,
    label,
    colors,
    iconFallback,
  });

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

function holdActionForFile(holdToDelete, onLongPressItem, holdDurationMs) {
  if (!holdToDelete || !onLongPressItem) return null;
  return { durationMs: holdDurationMs, onComplete: (file) => onLongPressItem?.(file) };
}

function FileGridCard({ file, index, colors, thumbH, onPressItem, onLongPressItem, holdToDelete, holdDurationMs }) {
  const palette = paletteClass(index);
  const handler = () => onPressItem?.(file);
  const holdToAction = holdActionForFile(holdToDelete, onLongPressItem, holdDurationMs);
  const cardKey = file.id || `${file.name || file.title || 'file'}_${index}`;

  if (isImageFile(file) && file.url) {
    return (
      <GalleryImageCard
        key={cardKey}
        file={file}
        palette={palette}
        colors={colors}
        onPress={handler}
        thumbH={thumbH}
        holdToAction={holdToAction}
      />
    );
  }
  return (
    <GalleryFileCard
      key={cardKey}
      file={file}
      palette={palette}
      colors={colors}
      onPress={handler}
      displayType={displayTypeForFile(file)}
      thumbH={thumbH}
      holdToAction={holdToAction}
    />
  );
}

// ===== MAIN FUNCTION =====

/**
 * Shared file gallery — gradient-bordered cards in a 2-column grid.
 * @param {object} props
 * @param {boolean} [props.dense] tighter thumbnail height (modal / compact)
 */
export default function FileGrid({
  isDark,
  files = [],
  maxItems,
  onPressItem,
  onLongPressItem,
  footerLink,
  hideWhenEmpty,
  dense = false,
  holdToDelete = false,
  holdDurationMs = HOLD_DURATION_MS,
}) {
  const colors = isDark ? COLORS.dark : COLORS.light;
  const list = typeof maxItems === 'number' ? files.slice(0, maxItems) : [...files];
  const thumbH = thumbHeight(dense);

  // 1. Hide the whole block when asked and there is nothing to show.
  if (hideWhenEmpty && list.length === 0) return null;

  // 2. One image card or file card per item. Optional footer link under the grid.
  return (
    <View>
      <View style={styles.gallery}>
        {list.map((file, index) => (
          <FileGridCard
            key={file.id || `${file.name || file.title || 'file'}_${index}`}
            file={file}
            index={index}
            colors={colors}
            thumbH={thumbH}
            onPressItem={onPressItem}
            onLongPressItem={onLongPressItem}
            holdToDelete={holdToDelete}
            holdDurationMs={holdDurationMs}
          />
        ))}
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
