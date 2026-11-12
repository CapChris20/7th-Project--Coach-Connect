// Design Law two-column file gallery — HardShadow cards, hatch thumbs, type pills.
// Flow: image / video / doc card → tap opens → optional hold-to-delete overlay.
// Used by Notes & Files screens and TrainerSharedFilesPopup. PNG: screens/files-and-notes/01–04, 13–16.
// vocab: HardShadow = solid offset (no blur); HatchedThumbFill = diagonal stripe placeholder

import React from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet, Image, Platform, Animated } from 'react-native';
import { WebView } from 'react-native-webview';
import { Video, ResizeMode } from 'expo-av';
import HardShadow from '../../../look-and-feel/HardShadow';
import NbIconChip from '../../../look-and-feel/NbIconChip';
import { useTheme } from '../../../look-and-feel/lightDarkMode';
import { borderRadius, nb } from '../../../look-and-feel/colorPalette';
import HatchedThumbFill from '../../../workouts/exercise-videos/HatchedThumbFill';
import { getFriendlyFileTitle } from '../../../helpers/fileSizeAndDateText';

// ===== NAMED CONSTANTS =====

const HOLD_DURATION_MS = 850;
const HOLD_MIN_DURATION_MS = 250;
const HOLD_RESET_DELAY_MS = 250;

const ICON_PICTURE = require('../../../assets/icons/handoff/picture.png');
const ICON_WEEK = require('../../../assets/icons/handoff/week.png');
const ICON_MUSCLE = require('../../../assets/icons/handoff/muscle.png');
const ICON_CHECKIN = require('../../../assets/icons/handoff/checkin.png');

const TYPE_PILL = {
  PDF: { label: 'PDF', chip: 3 },
  Document: { label: 'DOC', chip: 6 },
  Spreadsheet: { label: 'SHEET', chip: 4 },
  Image: { label: 'IMAGE', chip: 1 },
  Video: { label: 'VIDEO', chip: 0 },
  File: { label: 'FILE', chip: 2 },
  Other: { label: 'FILE', chip: 2 },
};

// ===== HELPER FUNCTIONS =====

function thumbHeight(dense) {
  // Manipulate here: dense = modal / compact tiles
  return dense ? 72 : 96;
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
    <View style={[styles.paperPreview, { height, backgroundColor: colors.nbSoft }]}>
      <View style={[styles.paperAccent, { backgroundColor: colors.nbInk }]} />
      <Text style={[styles.paperTitle, { color: colors.nbInk }]} numberOfLines={2}>
        {title}
      </Text>
      {bodyText.length > 0 ? (
        <Text style={[styles.paperBody, { color: colors.nbMuted, fontFamily: mono }]} numberOfLines={7}>
          {bodyText}
        </Text>
      ) : showSkeleton ? (
        <View style={styles.fakeLines}>
          {[0.92, 0.85, 0.72, 0.88].map((widthFraction, index) => (
            <View
              key={index}
              style={[styles.fakeLine, { width: `${widthFraction * 100}%`, backgroundColor: colors.nbBorder }]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
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

function thumbIconForDisplayType(displayType) {
  if (displayType === 'Image' || displayType === 'Video') return ICON_PICTURE;
  if (displayType === 'Spreadsheet') return ICON_WEEK;
  if (displayType === 'PDF' || displayType === 'Document') return ICON_CHECKIN;
  return ICON_MUSCLE;
}

function whoBadgeForFile(file) {
  if (file?.addedBy === 'trainer' || (file?.type === 'document' && file?.trainerId)) {
    return 'From your coach';
  }
  return 'From you';
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
                transform: [{ scaleX: progress }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.holdBar,
              {
                width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                backgroundColor: '#000',
              },
            ]}
          />
        </View>
      ) : null}
    </Pressable>
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

function GalleryCard({
  file,
  colors,
  onPress,
  displayType,
  thumbH,
  holdToAction,
}) {
  const label = displayType || displayTypeForFile(file);
  const pill = TYPE_PILL[label] || TYPE_PILL.Other;
  const metaDate = shortDate(file.createdAt || file.updatedAt);
  const title = decodeFileTitle(file);
  const stored = storedThumbnailUri(file);
  const url = file.url;
  const snippet = String(file.previewSnippet || file.previewText || '').trim();
  const isTrainerDocStub =
    file.type === 'document' && file.documentId && file.trainerId && !url;

  const iconFallback = (
    <View style={[styles.previewSlot, styles.iconPlaceholder, { height: thumbH }]}>
      <HatchedThumbFill />
      <View style={styles.thumbChipCenter}>
        <NbIconChip source={thumbIconForDisplayType(label)} size={40} index={pill.chip} />
      </View>
    </View>
  );

  const showRealPreview =
    stored ||
    (isVideoFile(file) && url) ||
    shouldShowPaperPreview(isTrainerDocStub, url, snippet) ||
    (url && shouldEmbedDocumentPreview(file)) ||
    (url && (label === 'Image' || mimeLooksLikeImage(file)));

  const inner = showRealPreview
    ? previewForGalleryFile({
        file,
        title,
        snippet,
        isTrainerDocStub,
        stored,
        url,
        thumbH,
        tintBase: colors.nbSoft,
        label,
        colors,
        iconFallback,
      })
    : iconFallback;

  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard} style={styles.cardWrap}>
      <HoldPressable
        style={styles.cardPress}
        enabled={!!holdToAction}
        durationMs={holdToAction?.durationMs}
        onPress={onPress}
        onHoldComplete={holdToAction ? () => holdToAction.onComplete?.(file) : undefined}
      >
        <View style={[styles.cardInner, { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder }]}>
          <View style={[styles.thumbBox, { height: thumbH, borderColor: colors.nbBorder, backgroundColor: colors.nbSoft }]}>
            {inner}
          </View>
          <Text style={[styles.cardName, { color: colors.nbInk }]} numberOfLines={2}>
            {title}
          </Text>
          <View style={styles.metaRow}>
            <View style={[styles.typePill, { backgroundColor: colors.nbFill }]}>
              <Text style={[styles.typePillText, { color: colors.nbOnFill }]}>{pill.label}</Text>
            </View>
            {metaDate ? (
              <Text style={[styles.cardMeta, { color: colors.nbMuted }]} numberOfLines={1}>
                {metaDate}
              </Text>
            ) : null}
          </View>
          <View style={[styles.whoPill, { backgroundColor: colors.nbSoft, borderColor: colors.nbBorder }]}>
            <Text style={[styles.whoPillText, { color: colors.nbInk }]} numberOfLines={1}>
              {whoBadgeForFile(file)}
            </Text>
          </View>
        </View>
      </HoldPressable>
    </HardShadow>
  );
}

function holdActionForFile(holdToDelete, onLongPressItem, holdDurationMs) {
  if (!holdToDelete || !onLongPressItem) return null;
  return { durationMs: holdDurationMs, onComplete: (file) => onLongPressItem?.(file) };
}

function FileGridCard({ file, colors, thumbH, onPressItem, onLongPressItem, holdToDelete, holdDurationMs }) {
  const handler = () => onPressItem?.(file);
  const holdToAction = holdActionForFile(holdToDelete, onLongPressItem, holdDurationMs);

  return (
    <GalleryCard
      file={file}
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
 * Shared file gallery — Design Law HardShadow cards in a 2-column grid.
 * @param {object} props
 * @param {boolean} [props.dense] tighter thumbnail height (modal / compact)
 */
export default function FileGrid({
  isDark: _isDarkIgnored,
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
  const { colors } = useTheme();
  const list = typeof maxItems === 'number' ? files.slice(0, maxItems) : [...files];
  const thumbH = thumbHeight(dense);

  if (hideWhenEmpty && list.length === 0) return null;

  return (
    <View>
      <View style={styles.gallery}>
        {list.map((file, index) => (
          <FileGridCard
            key={file.id || `${file.name || file.title || 'file'}_${index}`}
            file={file}
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
          <Text style={[styles.footerText, { color: colors.nbInk }]}>{footerLink.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// Kept for call sites that imported the old gallery theme map (no longer used for paint).
export const FILE_GALLERY_THEME_COLORS = {
  light: {},
  dark: {},
};
export function getPaletteGradient() {
  return ['#000', '#000'];
}
export function paletteClass() {
  return 'ink';
}

const styles = StyleSheet.create({
  gallery: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  cardWrap: {
    width: '48%',
    maxWidth: '48%',
  },
  cardPress: {
    width: '100%',
  },
  cardInner: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    padding: 10,
    gap: 8,
  },
  thumbBox: {
    width: '100%',
    borderRadius: 8,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbChipCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  holdOverlayWrap: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius.nbCard,
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
    alignSelf: 'flex-start',
  },
  previewImg: {
    width: '100%',
    resizeMode: 'cover',
  },
  previewSlot: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webInner: {
    flex: 1,
    backgroundColor: 'transparent',
    opacity: 0.98,
  },
  paperPreview: {
    width: '100%',
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
  iconPlaceholder: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
    minHeight: 36,
  },
  cardMeta: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  whoPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: nb.borderWidthPill,
  },
  whoPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  footerBtn: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});
