// Design Law full-screen photo / video viewer opened from Notes & Files.
// Flow: if hidden or missing a url, render nothing → NbPageHeader → video player or zoomable image → actions.
// Used by: FilesScreen, ClientAppStart, TrainerAppStart, trainer home pieces.
// vocab: NbPageHeader owns status-bar inset (shell SafeArea is left/right only)

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
const IMAGE_MAX_ZOOM = 3;
const IMAGE_MIN_ZOOM = 1;

// ===== HELPER FUNCTIONS =====

function clippedTitle(rawTitle) {
  const titleText = String(rawTitle);
  if (titleText.length > TITLE_MAX_LENGTH) {
    return `${titleText.slice(0, TITLE_TRIMMED_LENGTH)}${ELLIPSIS}`;
  }
  return titleText;
}

// ===== MAIN FUNCTION =====

/**
 * Full-screen modal: native video controls, or a pinch-zoom photo.
 * @param {{
 *   visible: boolean,
 *   url?: string,
 *   kind?: string,
 *   name?: string,
 *   isDark?: boolean,
 *   onClose: Function,
 *   onDownload?: Function,
 *   onShare?: Function,
 *   onDelete?: Function,
 * }} props
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
  if (!visible || !url) return null;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isVideo = kind === KIND_VIDEO;

  const title = useMemo(() => {
    const rawTitle = name || (kind === KIND_VIDEO ? DEFAULT_VIDEO_TITLE : DEFAULT_PHOTO_TITLE);
    return clippedTitle(rawTitle);
  }, [name, kind]);

  const subtitle = isVideo ? 'VIDEO' : 'IMAGE';

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.nbBackground }]}>
        <NbPageHeader title={title} subtitle={subtitle} onBack={onClose} />

        <View style={styles.body}>
          <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard} style={styles.mediaShadow}>
            <View
              style={[
                styles.mediaCard,
                { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
              ]}
            >
              {isVideo ? (
                <Video
                  source={{ uri: url }}
                  style={styles.video}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay
                  isLooping={false}
                />
              ) : (
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
                  <Image source={{ uri: url }} style={styles.image} resizeMode="contain" />
                </ScrollView>
              )}
            </View>
          </HardShadow>
        </View>

        {(onDownload || onShare || onDelete) ? (
          <View
            style={[
              styles.actions,
              {
                borderTopColor: colors.nbBorder,
                paddingBottom: Math.max(insets.bottom, spacing.md),
              },
            ]}
          >
            <View style={styles.actionRow}>
              {typeof onDownload === 'function' ? (
                <NbButton variant="plain" onPress={onDownload} style={styles.half}>
                  Download
                </NbButton>
              ) : null}
              {typeof onShare === 'function' ? (
                <NbButton variant="plain" onPress={onShare} style={styles.half}>
                  Share
                </NbButton>
              ) : null}
            </View>
            {typeof onDelete === 'function' ? (
              <NbButton variant="plain" onPress={onDelete}>
                Delete from my files
              </NbButton>
            ) : null}
          </View>
        ) : null}
      </View>
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
    backgroundColor: '#000',
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
