// Full-screen photo or video viewer opened from files, notes, and trainer home.
// Flow: if hidden or missing a url, render nothing → header with title → video player or zoomable image.
// Used by: FilesScreen, ClientAppStart, TrainerAppStart, trainer home pieces.

import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  Dimensions,
  Platform,
  ScrollView,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// ===== NAMED CONSTANTS =====

const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const KIND_VIDEO = 'video';
const DEFAULT_VIDEO_TITLE = 'Video';
const DEFAULT_PHOTO_TITLE = 'Photo';
const TITLE_MAX_LENGTH = 40;
const TITLE_TRIMMED_LENGTH = 37;
const ELLIPSIS = '…';
const KIND_LABEL_VIDEO = 'Video';
const KIND_LABEL_PHOTO = 'Photo';
const PLATFORM_ANDROID = 'android';
const DARK_BACKGROUND = '#020617';
const LIGHT_BACKGROUND = '#F8FAFC';
const DARK_TEXT = '#F8FAFC';
const LIGHT_TEXT = '#0F172A';
const DARK_MUTED = 'rgba(226,232,240,0.72)';
const LIGHT_MUTED = 'rgba(51,65,85,0.72)';
const HEADER_GRADIENT_DARK = ['rgba(2,6,23,0.96)', 'rgba(2,6,23,0.70)'];
const HEADER_GRADIENT_LIGHT = ['rgba(248,250,252,0.98)', 'rgba(248,250,252,0.75)'];
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 0, y: 1 };
const IMAGE_MAX_ZOOM = 3;
const IMAGE_MIN_ZOOM = 1;

// ===== HELPER FUNCTIONS =====

/**
 * Truncate a long file name so the header stays one line.
 * @param {string} rawTitle
 * @returns {string}
 */
function clippedTitle(rawTitle) {
  const titleText = String(rawTitle);
  if (titleText.length > TITLE_MAX_LENGTH) {
    return `${titleText.slice(0, TITLE_TRIMMED_LENGTH)}${ELLIPSIS}`;
  }
  return titleText;
}

/**
 * @param {boolean} isDark
 * @returns {{ background: string, textColor: string, muted: string, headerGradient: string[] }}
 */
function viewerColors(isDark) {
  return {
    background: isDark ? DARK_BACKGROUND : LIGHT_BACKGROUND,
    textColor: isDark ? DARK_TEXT : LIGHT_TEXT,
    muted: isDark ? DARK_MUTED : LIGHT_MUTED,
    headerGradient: isDark ? HEADER_GRADIENT_DARK : HEADER_GRADIENT_LIGHT,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Full-screen modal: native video controls, or a pinch-zoom photo.
 * @param {{ visible: boolean, url?: string, kind?: string, name?: string, isDark?: boolean, onClose: Function }} props
 */
export default function PhotoVideoViewer({ visible, url, kind, name, isDark = true, onClose }) {
  if (!visible || !url) return null;
  const colors = viewerColors(isDark);
  const isVideo = kind === KIND_VIDEO;

  const title = useMemo(() => {
    const rawTitle = name || (kind === KIND_VIDEO ? DEFAULT_VIDEO_TITLE : DEFAULT_PHOTO_TITLE);
    return clippedTitle(rawTitle);
  }, [name, kind]);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={colors.headerGradient}
          start={GRADIENT_START}
          end={GRADIENT_END}
          style={styles.header}
        >
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }} style={styles.headerBtn}>
            <Ionicons name="close" size={22} color={colors.textColor} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.title, { color: colors.textColor }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[styles.subtitle, { color: colors.muted }]} numberOfLines={1}>
              {isVideo ? KIND_LABEL_VIDEO : KIND_LABEL_PHOTO}
            </Text>
          </View>
          <View style={styles.headerBtn} />
        </LinearGradient>
        <View style={styles.body}>
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
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === PLATFORM_ANDROID ? 10 : 6,
    paddingBottom: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148,163,184,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148,163,184,0.24)',
  },
  headerCenter: {
    flex: 1,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    minHeight: WINDOW_HEIGHT * 0.65,
  },
  imageScroll: {
    flex: 1,
  },
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
});
