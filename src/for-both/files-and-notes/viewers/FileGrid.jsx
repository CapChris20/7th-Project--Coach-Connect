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

// Manipulate here: hold-to-delete timing (ms)
const HOLD_DURATION_MS = 850;
const HOLD_MIN_DURATION_MS = 250;
const HOLD_RESET_DELAY_MS = 250;

const ICON_PICTURE = require('../../../assets/icons/handoff/picture.png');
const ICON_WEEK = require('../../../assets/icons/handoff/week.png');
const ICON_MUSCLE = require('../../../assets/icons/handoff/muscle.png');
const ICON_CHECKIN = require('../../../assets/icons/handoff/checkin.png');

const TYPE_PILL_BY_DISPLAY = {
  PDF: { label: 'PDF', chip: 3 },
  Document: { label: 'DOC', chip: 6 },
  Spreadsheet: { label: 'SHEET', chip: 4 },
  Image: { label: 'IMAGE', chip: 1 },
  Video: { label: 'VIDEO', chip: 0 },
  File: { label: 'FILE', chip: 2 },
  Other: { label: 'FILE', chip: 2 },
};

const SKELETON_LINE_WIDTH_FRACTIONS = [0.92, 0.85, 0.72, 0.88];
const HOLD_OVERLAY_MAX_OPACITY = 0.22;
const HOLD_BAR_FILL_COLOR = '#000';
const LEGACY_PALETTE_FALLBACK = ['#000', '#000'];
const WHO_BADGE_FROM_COACH = 'From your coach';
const WHO_BADGE_FROM_YOU = 'From you';
const FALLBACK_FILE_TITLE = 'File';
const SHORT_DATE_OPTIONS = { month: 'short', day: 'numeric' };

// ===== HELPER FUNCTIONS =====

function pickFilesForGrid(files, maxItems) {
  if (typeof maxItems === 'number') {
    return files.slice(0, maxItems);
  }
  return files.slice();
}

function thumbnailHeightForDensity(dense) {
  // Manipulate here: dense = modal / compact tiles
  if (dense) return 72;
  return 96;
}

function cardKeyForFile(file, fileIndex) {
  if (file.id) return file.id;
  const namePart = file.name || file.title || 'file';
  return `${namePart}_${fileIndex}`;
}

function googleEmbedUrl(fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string') return '';
  return `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(fileUrl)}`;
}

function officeEmbedUrl(fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string') return '';
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
}

/** Decode storage-safe titles like Quiz-2%28CIS%29.docx */
function decodeFileTitle(file) {
  const rawTitle = getFriendlyFileTitle(file) || file.name || file.title || FALLBACK_FILE_TITLE;
  try {
    return decodeURIComponent(String(rawTitle));
  } catch (_decodeError) {
    return String(rawTitle);
  }
}

function normalizePreviewText(excerptText) {
  if (!excerptText || typeof excerptText !== 'string') return '';
  return excerptText.replace(/[#*_`[\]]/g, '').replace(/\s+/g, ' ').trim();
}

function isPdfFile(file, fileName, mimeType) {
  if (file.type === 'pdf') return true;
  if (fileName.endsWith('.pdf')) return true;
  if (mimeType.includes('pdf')) return true;
  return false;
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
  const seenUris = new Set();
  const uniqueList = [];
  for (let strategyIndex = 0; strategyIndex < strategies.length; strategyIndex += 1) {
    const strategy = strategies[strategyIndex];
    if (!strategy.uri) continue;
    if (seenUris.has(strategy.uri)) continue;
    seenUris.add(strategy.uri);
    uniqueList.push(strategy);
  }
  return uniqueList;
}

function buildEmbedStrategies(file, fileUrl) {
  if (!fileUrl) return [];

  const fileName = (file.name || file.title || '').toLowerCase();
  const mimeType = (file.mimeType && String(file.mimeType).toLowerCase()) || '';
  const strategies = [];

  if (isPdfFile(file, fileName, mimeType)) {
    strategies.push({ uri: fileUrl, key: 'pdf-direct' });
  }
  if (isOfficeFile(file, fileName, mimeType)) {
    strategies.push({ uri: officeEmbedUrl(fileUrl), key: 'office' });
  }
  strategies.push({ uri: googleEmbedUrl(fileUrl), key: 'google' });

  return uniqueStrategies(strategies);
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
  if (fileName.endsWith('.csv') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return 'Spreadsheet';
  }
  if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) return 'Document';
  return 'File';
}

function shortDateLabel(dateValue) {
  if (!dateValue) return '';
  try {
    const parsedDate = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) return '';
    return parsedDate.toLocaleDateString(undefined, SHORT_DATE_OPTIONS);
  } catch (_dateError) {
    return '';
  }
}

function storedThumbnailUri(file) {
  if (!file) return null;
  return file.thumbnailUrl || file.thumbUrl || file.previewUrl || file.thumb || null;
}

function isVideoFile(file) {
  if (!file) return false;
  if (file.type === 'video') return true;
  if (file.mimeType && String(file.mimeType).startsWith('video/')) return true;
  return false;
}

function mimeLooksLikeImage(file) {
  if (!file || !file.mimeType) return false;
  return String(file.mimeType).startsWith('image/');
}

function nameLooksLikeDocument(fileName) {
  return /\.(pdf|doc|docx|xlsx|xls|csv|ppt|pptx)(\?|$)/i.test(fileName);
}

function mimeLooksLikeDocument(mimeType) {
  if (mimeType.includes('pdf')) return true;
  if (mimeType.includes('word') || mimeType.includes('officedocument') || mimeType.includes('msword')) {
    return true;
  }
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
    return true;
  }
  return false;
}

/** PDF, Word, spreadsheet, etc. — embed snapshot via Google viewer (public HTTPS URLs). */
function shouldEmbedDocumentPreview(file) {
  if (!file || !file.url) return false;

  const mimeType = (file.mimeType && String(file.mimeType).toLowerCase()) || '';
  if (mimeType.startsWith('image/') || mimeType.startsWith('video/')) return false;

  const fileType = file.type;
  if (fileType === 'photo' || fileType === 'video') return false;
  if (fileType === 'pdf' || fileType === 'spreadsheet' || fileType === 'document' || fileType === 'doc') {
    return true;
  }

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
  const addedByTrainer = file && file.addedBy === 'trainer';
  const trainerOwnedDocument = file && file.type === 'document' && file.trainerId;
  if (addedByTrainer || trainerOwnedDocument) {
    return WHO_BADGE_FROM_COACH;
  }
  return WHO_BADGE_FROM_YOU;
}

function isTrainerDocumentStub(file, fileUrl) {
  return file.type === 'document' && file.documentId && file.trainerId && !fileUrl;
}

function shouldShowPaperPreview(isTrainerDocStub, fileUrl, snippet) {
  const hasStubOrSnippetWithoutUrl = isTrainerDocStub || (!fileUrl && snippet);
  if (!hasStubOrSnippetWithoutUrl) return false;
  return Boolean(snippet || isTrainerDocStub);
}

function holdActionForFile(holdToDelete, onLongPressItem, holdDurationMs) {
  if (!holdToDelete || !onLongPressItem) return null;
  return {
    durationMs: holdDurationMs,
    onComplete: (file) => {
      onLongPressItem(file);
    },
  };
}

function fileShowsRealPreview({
  file,
  storedThumbUri,
  fileUrl,
  previewSnippet,
  isTrainerDocStub,
  displayLabel,
}) {
  if (storedThumbUri) return true;
  if (isVideoFile(file) && fileUrl) return true;
  if (shouldShowPaperPreview(isTrainerDocStub, fileUrl, previewSnippet)) return true;
  if (fileUrl && shouldEmbedDocumentPreview(file)) return true;
  if (fileUrl && (displayLabel === 'Image' || mimeLooksLikeImage(file))) return true;
  return false;
}

/**
 * Pick the richest thumb we can: stored thumb → video → paper stub → embed → image → hatch.
 */
function previewForGalleryFile({
  file,
  title,
  snippet,
  isTrainerDocStub,
  storedThumbUri,
  fileUrl,
  thumbnailHeight,
  tintBase,
  displayLabel,
  colors,
  iconFallback,
}) {
  if (storedThumbUri) {
    return (
      <Image
        source={{ uri: storedThumbUri }}
        style={[styles.previewImg, { height: thumbnailHeight }]}
      />
    );
  }

  if (isVideoFile(file) && fileUrl) {
    return <VideoThumb url={fileUrl} posterUri={null} height={thumbnailHeight} />;
  }

  if (shouldShowPaperPreview(isTrainerDocStub, fileUrl, snippet)) {
    return (
      <PaperDocPreview
        title={title}
        excerpt={snippet}
        height={thumbnailHeight}
        colors={colors}
        showSkeleton={isTrainerDocStub && !snippet}
      />
    );
  }

  if (fileUrl && shouldEmbedDocumentPreview(file)) {
    return (
      <MultiStrategyDocPreview
        file={file}
        url={fileUrl}
        height={thumbnailHeight}
        previewBackground={tintBase}
        fallback={iconFallback}
      />
    );
  }

  const looksLikeImage = displayLabel === 'Image' || mimeLooksLikeImage(file);
  if (fileUrl && looksLikeImage) {
    return (
      <Image source={{ uri: fileUrl }} style={[styles.previewImg, { height: thumbnailHeight }]} />
    );
  }

  return iconFallback;
}

// ===== CARD SHELL =====

/**
 * One grid cell: resolve display type + hold-to-delete, then hand off to GalleryCard.
 */
function FileGridCard({
  file,
  colors,
  thumbnailHeight,
  onPressItem,
  onLongPressItem,
  holdToDelete,
  holdDurationMs,
}) {
  const handleCardPress = () => {
    if (onPressItem) onPressItem(file);
  };
  const holdToAction = holdActionForFile(holdToDelete, onLongPressItem, holdDurationMs);
  const displayType = displayTypeForFile(file);

  return (
    <GalleryCard
      file={file}
      colors={colors}
      onPress={handleCardPress}
      displayType={displayType}
      thumbnailHeight={thumbnailHeight}
      holdToAction={holdToAction}
    />
  );
}

/**
 * HardShadow card: thumb, title, type pill, date, who-badge.
 */
function GalleryCard({
  file,
  colors,
  onPress,
  displayType,
  thumbnailHeight,
  holdToAction,
}) {
  const displayLabel = displayType || displayTypeForFile(file);
  const typePillInfo = TYPE_PILL_BY_DISPLAY[displayLabel] || TYPE_PILL_BY_DISPLAY.Other;
  const metaDateLabel = shortDateLabel(file.createdAt || file.updatedAt);
  const cardTitle = decodeFileTitle(file);
  const storedThumbUri = storedThumbnailUri(file);
  const fileUrl = file.url;
  const previewSnippet = String(file.previewSnippet || file.previewText || '').trim();
  const isTrainerDocStub = isTrainerDocumentStub(file, fileUrl);

  const iconFallback = (
    <IconPlaceholderThumb
      thumbnailHeight={thumbnailHeight}
      displayLabel={displayLabel}
      chipIndex={typePillInfo.chip}
    />
  );

  const shouldShowRealPreview = fileShowsRealPreview({
    file,
    storedThumbUri,
    fileUrl,
    previewSnippet,
    isTrainerDocStub,
    displayLabel,
  });

  let previewInner = iconFallback;
  if (shouldShowRealPreview) {
    previewInner = previewForGalleryFile({
      file,
      title: cardTitle,
      snippet: previewSnippet,
      isTrainerDocStub,
      storedThumbUri,
      fileUrl,
      thumbnailHeight,
      tintBase: colors.nbSoft,
      displayLabel,
      colors,
      iconFallback,
    });
  }

  const cardInnerStyle = [
    styles.cardInner,
    { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
  ];
  const thumbBoxStyle = [
    styles.thumbBox,
    {
      height: thumbnailHeight,
      borderColor: colors.nbBorder,
      backgroundColor: colors.nbSoft,
    },
  ];
  const whoBadgeLabel = whoBadgeForFile(file);
  const holdIsEnabled = Boolean(holdToAction);
  let holdDuration = HOLD_DURATION_MS;
  if (holdToAction && holdToAction.durationMs) {
    holdDuration = holdToAction.durationMs;
  }
  let handleHoldComplete;
  if (holdToAction) {
    handleHoldComplete = () => {
      if (holdToAction.onComplete) holdToAction.onComplete(file);
    };
  }

  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard} style={styles.cardWrap}>
      <HoldPressable
        style={styles.cardPress}
        enabled={holdIsEnabled}
        durationMs={holdDuration}
        onPress={onPress}
        onHoldComplete={handleHoldComplete}
      >
        <View style={cardInnerStyle}>
          <View style={thumbBoxStyle}>{previewInner}</View>
          <Text style={[styles.cardName, { color: colors.nbInk }]} numberOfLines={2}>
            {cardTitle}
          </Text>
          <View style={styles.metaRow}>
            <View style={[styles.typePill, { backgroundColor: colors.nbFill }]}>
              <Text style={[styles.typePillText, { color: colors.nbOnFill }]}>
                {typePillInfo.label}
              </Text>
            </View>
            {metaDateLabel ? (
              <Text style={[styles.cardMeta, { color: colors.nbMuted }]} numberOfLines={1}>
                {metaDateLabel}
              </Text>
            ) : null}
          </View>
          <View
            style={[
              styles.whoPill,
              { backgroundColor: colors.nbSoft, borderColor: colors.nbBorder },
            ]}
          >
            <Text style={[styles.whoPillText, { color: colors.nbInk }]} numberOfLines={1}>
              {whoBadgeLabel}
            </Text>
          </View>
        </View>
      </HoldPressable>
    </HardShadow>
  );
}

function IconPlaceholderThumb({ thumbnailHeight, displayLabel, chipIndex }) {
  const slotStyle = [styles.previewSlot, styles.iconPlaceholder, { height: thumbnailHeight }];
  const chipSource = thumbIconForDisplayType(displayLabel);

  return (
    <View style={slotStyle}>
      <HatchedThumbFill />
      <View style={styles.thumbChipCenter}>
        <NbIconChip source={chipSource} size={40} index={chipIndex} />
      </View>
    </View>
  );
}

// ===== PREVIEW COMPONENTS =====

/**
 * Try PDF → Office → Google until one loads (snapshots for uploaded files with url).
 */
function MultiStrategyDocPreview({ file, url, height, previewBackground, fallback }) {
  // vocab: useMemo = rebuild embed strategy list only when file/url change
  const strategies = React.useMemo(() => buildEmbedStrategies(file, url), [file, url]);
  const [strategyIndex, setStrategyIndex] = React.useState(0);

  React.useEffect(() => {
    setStrategyIndex(0);
  }, [url, strategies.length]);

  const strategiesAreExhausted =
    strategies.length === 0 || strategyIndex >= strategies.length;
  if (strategiesAreExhausted) {
    return fallback;
  }

  const activeStrategy = strategies[strategyIndex];
  const slotStyle = [
    styles.previewSlot,
    { height, backgroundColor: previewBackground, overflow: 'hidden' },
  ];

  const advanceToNextStrategy = () => {
    setStrategyIndex((currentIndex) => currentIndex + 1);
  };

  return (
    <View style={slotStyle}>
      <WebView
        key={activeStrategy.key}
        source={{ uri: activeStrategy.uri }}
        style={styles.webInner}
        scrollEnabled={false}
        pointerEvents="none"
        originWhitelist={['*']}
        androidLayerType="hardware"
        mixedContentMode="always"
        allowsInlineMediaPlayback
        onError={advanceToNextStrategy}
        onHttpError={advanceToNextStrategy}
      />
    </View>
  );
}

/**
 * Trainer-shared doc stubs have no Storage URL — show body text like a document snapshot.
 */
function PaperDocPreview({ title, excerpt, height, colors, showSkeleton }) {
  const monoFontFamily = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
  const bodyText = normalizePreviewText(excerpt);
  const hasBodyText = bodyText.length > 0;
  const shouldShowSkeletonLines = !hasBodyText && showSkeleton;

  return (
    <View style={[styles.paperPreview, { height, backgroundColor: colors.nbSoft }]}>
      <View style={[styles.paperAccent, { backgroundColor: colors.nbInk }]} />
      <Text style={[styles.paperTitle, { color: colors.nbInk }]} numberOfLines={2}>
        {title}
      </Text>
      {hasBodyText ? (
        <Text
          style={[styles.paperBody, { color: colors.nbMuted, fontFamily: monoFontFamily }]}
          numberOfLines={7}
        >
          {bodyText}
        </Text>
      ) : null}
      {shouldShowSkeletonLines ? (
        <SkeletonPreviewLines borderColor={colors.nbBorder} />
      ) : null}
    </View>
  );
}

function SkeletonPreviewLines({ borderColor }) {
  return (
    <View style={styles.fakeLines}>
      {SKELETON_LINE_WIDTH_FRACTIONS.map((widthFraction, lineIndex) => (
        <View
          key={lineIndex}
          style={[
            styles.fakeLine,
            { width: `${widthFraction * 100}%`, backgroundColor: borderColor },
          ]}
        />
      ))}
    </View>
  );
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

/**
 * Pressable that optionally fills a delete bar while the finger is held down.
 * When hold is off, a normal tap still calls onPress.
 */
function HoldPressable({
  enabled,
  durationMs = HOLD_DURATION_MS,
  onPress,
  onHoldComplete,
  children,
  style,
}) {
  // vocab: Animated.Value = RN (non-Reanimated) progress 0→1 for the hold fill
  const holdProgress = React.useRef(new Animated.Value(0)).current;
  const holdAlreadyFiredRef = React.useRef(false);

  const resetHoldProgress = React.useCallback(() => {
    holdAlreadyFiredRef.current = false;
    holdProgress.stopAnimation();
    holdProgress.setValue(0);
  }, [holdProgress]);

  const startHoldProgress = React.useCallback(() => {
    if (!enabled) return;

    holdAlreadyFiredRef.current = false;
    holdProgress.setValue(0);

    const holdMs = Math.max(HOLD_MIN_DURATION_MS, Number(durationMs) || HOLD_DURATION_MS);
    Animated.timing(holdProgress, {
      toValue: 1,
      duration: holdMs,
      useNativeDriver: false,
    }).start(({ finished }) => {
      // 1. Finger lifted early → animation cancelled; do nothing.
      if (!finished) return;
      // 2. Already fired for this press → ignore duplicate completion.
      if (holdAlreadyFiredRef.current) return;
      // 3. Hold completed → tell the parent, then clear the bar.
      holdAlreadyFiredRef.current = true;
      if (onHoldComplete) onHoldComplete();
      setTimeout(() => resetHoldProgress(), HOLD_RESET_DELAY_MS);
    });
  }, [enabled, durationMs, onHoldComplete, holdProgress, resetHoldProgress]);

  let tapHandlerWhenHoldOff;
  if (!enabled) {
    tapHandlerWhenHoldOff = onPress;
  }

  const overlayFillOpacity = holdProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, HOLD_OVERLAY_MAX_OPACITY],
  });
  const overlayFillScaleX = holdProgress;
  const holdBarWidth = holdProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  let holdOverlay = null;
  if (enabled) {
    holdOverlay = (
      <View pointerEvents="none" style={styles.holdOverlayWrap}>
        <Animated.View
          style={[
            styles.holdOverlayFill,
            {
              opacity: overlayFillOpacity,
              transform: [{ scaleX: overlayFillScaleX }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.holdBar,
            {
              width: holdBarWidth,
              backgroundColor: HOLD_BAR_FILL_COLOR,
            },
          ]}
        />
      </View>
    );
  }

  return (
    <Pressable
      onPress={tapHandlerWhenHoldOff}
      onPressIn={startHoldProgress}
      onPressOut={resetHoldProgress}
      style={style}
    >
      {children}
      {holdOverlay}
    </Pressable>
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

  // 1. Cap the list when the parent asks for a max (home preview, etc.).
  const filesToShow = pickFilesForGrid(files, maxItems);
  const thumbnailHeight = thumbnailHeightForDensity(dense);

  // 2. Optional early exit when the parent hides empty grids.
  const shouldHideEmptyGrid = hideWhenEmpty && filesToShow.length === 0;
  if (shouldHideEmptyGrid) return null;

  // 3. Paint the gallery + optional footer link under it.
  const shouldShowFooterLink = Boolean(footerLink);
  const footerLabelStyle = [styles.footerText, { color: colors.nbInk }];

  return (
    <View>
      <View style={styles.gallery}>
        {filesToShow.map((file, fileIndex) => (
          <FileGridCard
            key={cardKeyForFile(file, fileIndex)}
            file={file}
            colors={colors}
            thumbnailHeight={thumbnailHeight}
            onPressItem={onPressItem}
            onLongPressItem={onLongPressItem}
            holdToDelete={holdToDelete}
            holdDurationMs={holdDurationMs}
          />
        ))}
      </View>
      {shouldShowFooterLink ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={footerLink.onPress}
          style={styles.footerBtn}
        >
          <Text style={footerLabelStyle}>{footerLink.label}</Text>
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

/**
 * Legacy stub — old gallery callers still import this; paint no longer uses gradients.
 * @returns {string[]}
 */
export function getPaletteGradient() {
  return LEGACY_PALETTE_FALLBACK;
}

/**
 * Legacy stub — always returns the ink class name for old theme helpers.
 * @returns {string}
 */
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
