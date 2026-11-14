// Full-screen photo or video opened from Notes & Files.
// Flow: missing url/hidden → render nothing → header → video or pinch-zoom photo → download/share/delete.
// Used by: FilesScreen, ClientAppStart, TrainerAppStart, trainer home pieces.
// Read order: constants → tiny helpers → layout pieces → PhotoVideoViewer → styles.
// vocab: NbPageHeader owns the status-bar inset (shell SafeArea is left/right only).

import React, { useMemo } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Image,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NbPageHeader from '../../../look-and-feel/NbPageHeader';
import NbButton from '../../../look-and-feel/NbButton';
import HardShadow from '../../../look-and-feel/HardShadow';
import { useTheme } from '../../../look-and-feel/lightDarkMode';
import { borderRadius, nb, spacing } from '../../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const KIND_VIDEO = 'video';
const DEFAULT_VIDEO_TITLE = 'Video';
const DEFAULT_PHOTO_TITLE = 'Photo';
const TITLE_MAX_LENGTH = 40;
const TITLE_TRIMMED_LENGTH = 37;
const ELLIPSIS = '…';
// Manipulate here: pinch-zoom limits for still images
const IMAGE_MAX_ZOOM = 3;
const IMAGE_MIN_ZOOM = 1;
// Video letterbox stays pure black so letterboxing does not pick up theme surface tint.
const VIDEO_LETTERBOX_BACKGROUND = '#000';

// ===== HELPER FUNCTIONS =====

function shortenMediaTitle(rawTitle) {
  const titleText = String(rawTitle);
  if (titleText.length > TITLE_MAX_LENGTH) {
    return `${titleText.slice(0, TITLE_TRIMMED_LENGTH)}${ELLIPSIS}`;
  }
  return titleText;
}

function defaultTitleForKind(kind) {
  if (kind === KIND_VIDEO) {
    return DEFAULT_VIDEO_TITLE;
  }
  return DEFAULT_PHOTO_TITLE;
}

function headerSubtitleForKind(isVideo) {
  if (isVideo) {
    return 'VIDEO';
  }
  return 'IMAGE';
}

function buildHeaderTitle(name, kind) {
  const rawTitle = name || defaultTitleForKind(kind);
  return shortenMediaTitle(rawTitle);
}

// ===== IN-FILE UI PIECES (no hooks) =====

/**
 * Either a native video player or a pinch-zoom still image.
 * Why split: keeps the card shell free of kind branching.
 */
function PhotoVideoMediaBody({ isVideo, mediaUrl }) {
  if (isVideo) {
    // vocab: ResizeMode.CONTAIN = fit inside the box without cropping
    // vocab: shouldPlay = start as soon as the modal opens
    return (
      <Video
        source={{ uri: mediaUrl }}
        style={styles.video}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        isLooping={false}
      />
    );
  }

  // Pinch-zoom uses ScrollView zoom scales (iOS-friendly); Android still shows the image.
  return (
    <ScrollView
      style={styles.imageScroll}
      contentContainerStyle={styles.imageScrollContent}
      maximumZoomScale={IMAGE_MAX_ZOOM}
      minimumZoomScale={IMAGE_MIN_ZOOM}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      bouncesZoom
      centerContent
    >
      <Image source={{ uri: mediaUrl }} style={styles.image} resizeMode="contain" />
    </ScrollView>
  );
}

function downloadButtonIfPresent(onDownload) {
  if (typeof onDownload !== 'function') return null;
  return (
    <NbButton variant="plain" onPress={onDownload} style={styles.half}>
      Download
    </NbButton>
  );
}

function shareButtonIfPresent(onShare) {
  if (typeof onShare !== 'function') return null;
  return (
    <NbButton variant="plain" onPress={onShare} style={styles.half}>
      Share
    </NbButton>
  );
}

function deleteButtonIfPresent(onDelete) {
  if (typeof onDelete !== 'function') return null;
  return (
    <NbButton variant="plain" onPress={onDelete}>
      Delete from my files
    </NbButton>
  );
}

/**
 * Bottom Download / Share / Delete row. Hidden when the parent passed no handlers.
 */
function PhotoVideoActionBar({
  bottomInset,
  borderColor,
  onDownload,
  onShare,
  onDelete,
}) {
  const downloadButton = downloadButtonIfPresent(onDownload);
  const shareButton = shareButtonIfPresent(onShare);
  const deleteButton = deleteButtonIfPresent(onDelete);
  const showAnyAction = Boolean(downloadButton || shareButton || deleteButton);

  if (!showAnyAction) {
    return null;
  }

  const actionBarPaddingBottom = Math.max(bottomInset, spacing.md);

  return (
    <View
      style={[
        styles.actions,
        {
          borderTopColor: borderColor,
          paddingBottom: actionBarPaddingBottom,
        },
      ]}
    >
      <View style={styles.actionRow}>
        {downloadButton}
        {shareButton}
      </View>
      {deleteButton}
    </View>
  );
}

/**
 * Full-screen shell: header + HardShadow media card + optional actions.
 * Pure layout so the exported component only decides titles and theme.
 */
function PhotoVideoViewerLayout({
  headerTitle,
  headerSubtitle,
  isVideo,
  mediaUrl,
  colors,
  bottomInset,
  onClose,
  onDownload,
  onShare,
  onDelete,
}) {
  return (
    <View style={[styles.container, { backgroundColor: colors.nbBackground }]}>
      <NbPageHeader title={headerTitle} subtitle={headerSubtitle} onBack={onClose} />

      <View style={styles.body}>
        <HardShadow
          offset={nb.shadowOffsetCard}
          radius={borderRadius.nbCard}
          style={styles.mediaShadow}
        >
          <View
            style={[
              styles.mediaCard,
              { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
            ]}
          >
            <PhotoVideoMediaBody isVideo={isVideo} mediaUrl={mediaUrl} />
          </View>
        </HardShadow>
      </View>

      <PhotoVideoActionBar
        bottomInset={bottomInset}
        borderColor={colors.nbBorder}
        onDownload={onDownload}
        onShare={onShare}
        onDelete={onDelete}
      />
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Design Law photo / video viewer.
 * Hook order frozen: early null return stays above hooks (same as before).
 * @param {object} props
 */
export default function PhotoVideoViewer({
  visible,
  url,
  kind,
  name,
  isDark: _isDarkIgnored = true,
  onClose,
  onDownload,
  onShare,
  onDelete,
}) {
  // Fail fast — never mount a blank modal when there is nothing to show.
  if (!visible || !url) {
    return null;
  }

  // vocab: useTheme = Design Law light/dark color bag
  const { colors } = useTheme();
  // vocab: useSafeAreaInsets = home-indicator / notch padding from the OS
  const safeAreaInsets = useSafeAreaInsets();
  const isVideo = kind === KIND_VIDEO;

  // 1. Title from the file name (or Video / Photo), trimmed for the header.
  const headerTitle = useMemo(() => buildHeaderTitle(name, kind), [name, kind]);

  // 2. Subtitle is a fixed IMAGE / VIDEO chip label.
  const headerSubtitle = headerSubtitleForKind(isVideo);

  // 3. Paint modal → layout (media + actions).
  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <PhotoVideoViewerLayout
        headerTitle={headerTitle}
        headerSubtitle={headerSubtitle}
        isVideo={isVideo}
        mediaUrl={url}
        colors={colors}
        bottomInset={safeAreaInsets.bottom}
        onClose={onClose}
        onDownload={onDownload}
        onShare={onShare}
        onDelete={onDelete}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: {
    flex: 1,
    minHeight: WINDOW_HEIGHT * 0.55,
    paddingHorizontal: nb.screenGutter,
    paddingTop: spacing.sm,
  },
  mediaShadow: { flex: 1 },
  mediaCard: {
    flex: 1,
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
  },
  imageScroll: { flex: 1 },
  imageScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  image: {
    width: '100%',
    flex: 1,
    backgroundColor: 'transparent',
  },
  video: {
    width: '100%',
    flex: 1,
    backgroundColor: VIDEO_LETTERBOX_BACKGROUND,
  },
  actions: {
    paddingHorizontal: nb.screenGutter,
    paddingTop: spacing.md,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionRow: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
});
