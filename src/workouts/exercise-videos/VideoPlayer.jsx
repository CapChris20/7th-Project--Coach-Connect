// Plays an exercise demo in a YouTube iframe, plus an optional full-screen modal.
// Flow: size the player box → spinner until YouTube onReady → optional modal with close header.
// Used by: ExerciseVideosTab detail sheet. Iframe avoids raw WebView embed (fewer YouTube Error 153 cases).

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { Ionicons } from '@expo/vector-icons';
import NbButton from '../../look-and-feel/NbButton';
import { lightColors, darkColors } from '../../look-and-feel/colorPalette';
import { useTheme } from '../../look-and-feel/lightDarkMode';

// ===== NAMED CONSTANTS =====

const screenSize = Dimensions.get('window');
const SCREEN_WIDTH = screenSize.width;
const SCREEN_HEIGHT = screenSize.height;

// vocab: 16:9 is the widescreen ratio YouTube expects. Height = width * 9 / 16.
const WIDESCREEN_HEIGHT_PART = 9;
const WIDESCREEN_WIDTH_PART = 16;

// Manipulate here: players shorter than this clip the YouTube controls.
const MIN_INLINE_PLAYER_HEIGHT = 230;
const SCREEN_EDGE_INSET = 36;
const MODAL_PLAYER_MAX_SCREEN_FRACTION = 0.32;
const MODAL_PLAYER_MIN_HEIGHT = 260;
const MODAL_SIDE_INSET = 32;
const PLAYER_CORNER_RADIUS = 12;
const LOADING_SCRIM_OPACITY = 0.35;
const FALLBACK_MODAL_TITLE = 'Video';
const EMPTY_INLINE_MESSAGE = 'Video unavailable';
const EMPTY_MODAL_MESSAGE = 'Video not available';
const CLOSE_ICON_SIZE = 28;
const CLOSE_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };
const HEADER_SPACER_WIDTH = 28;
const PLAYER_SHELL_BLACK = '#000';
const EMPTY_PLAYER_NEAR_BLACK = '#111';
const DARK_SCHEME_NAME = 'dark';

// YouTube iframe knobs — letters must stay (API contract).
const YOUTUBE_SHOW_CONTROLS = true;
const YOUTUBE_HIDE_RELATED = false;
const YOUTUBE_HIDE_ANNOTATIONS_POLICY = 3;
const WEBVIEW_OPACITY_HACK = 0.99;

// ===== HELPER FUNCTIONS =====

/**
 * Default inline size when the caller does not pass width and/or height.
 * Height never goes below MIN_INLINE_PLAYER_HEIGHT so controls stay tappable.
 * @param {number|undefined} width
 * @param {number|undefined} height
 * @returns {{ playerWidth: number, playerHeight: number }}
 */
function pickInlinePlayerDimensions(width, height) {
  // vocab/symbol: ?? = use the right side only when left is null/undefined
  const playerWidth = width ?? Math.floor(SCREEN_WIDTH - SCREEN_EDGE_INSET);
  const widescreenHeight = Math.round(
    (playerWidth * WIDESCREEN_HEIGHT_PART) / WIDESCREEN_WIDTH_PART,
  );
  const playerHeight = height ?? Math.max(MIN_INLINE_PLAYER_HEIGHT, widescreenHeight);
  return { playerWidth, playerHeight };
}

/**
 * Modal player height: at least the min, at most a fraction of the screen.
 * @returns {number}
 */
function computeModalPlayerHeight() {
  const widescreenFromScreenWidth = Math.round(
    (SCREEN_WIDTH * WIDESCREEN_HEIGHT_PART) / WIDESCREEN_WIDTH_PART,
  );
  const heightAtLeastMinimum = Math.max(MODAL_PLAYER_MIN_HEIGHT, widescreenFromScreenWidth);
  return Math.min(SCREEN_HEIGHT * MODAL_PLAYER_MAX_SCREEN_FRACTION, heightAtLeastMinimum);
}

/**
 * Pick Design Law palette from the OS color scheme (modal path does not use useTheme).
 * @param {string|null|undefined} colorScheme
 */
function colorsForColorScheme(colorScheme) {
  if (colorScheme === DARK_SCHEME_NAME) return darkColors;
  return lightColors;
}

/**
 * Semi-transparent scrim + spinner while the iframe boots.
 */
function PlayerLoadingOverlay({ spinnerColor }) {
  return (
    <View style={styles.loadingOverlay} pointerEvents="none">
      <ActivityIndicator size="large" color={spinnerColor} />
    </View>
  );
}

/**
 * Empty box when there is no video id to play.
 */
function EmptyInlinePlayerBox({ playerWidth, playerHeight, messageColor }) {
  const emptyBoxStyle = [styles.emptyPlayer, { width: playerWidth, height: playerHeight }];
  const emptyTextStyle = [styles.emptyPlayerText, { color: messageColor }];

  return (
    <View style={emptyBoxStyle}>
      <Text style={emptyTextStyle}>{EMPTY_INLINE_MESSAGE}</Text>
    </View>
  );
}

/**
 * Log YouTube iframe errors in development only (never in production builds).
 * @param {unknown} errorEvent
 */
function warnYouTubeErrorInDev(errorEvent) {
  const isDevBuild = typeof __DEV__ !== 'undefined' && __DEV__;
  if (!isDevBuild) return;
  console.warn('[YouTube iframe]', errorEvent);
}

// ===== MAIN FUNCTION =====

/**
 * YouTube IFrame player. Keep the box large enough that the controls fit.
 * Flow: 1. size box  2. reset ready on new id  3. empty or iframe + loading overlay
 * @param {{ videoId: string, height?: number, width?: number, play?: boolean }} props
 */
export function YouTubeIframeExercisePlayer({ videoId, height, width, play = true }) {
  // 1. Theme + sized player box (hook order: theme → state → effect).
  // vocab: useTheme = Design Law light/dark colors
  const { colors: themeColors } = useTheme();
  const { playerWidth, playerHeight } = pickInlinePlayerDimensions(width, height);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  // 2. New video id → show the loading overlay again until onReady fires.
  // vocab: useEffect = run after paint; deps [videoId] re-run when the clip changes
  useEffect(() => {
    setIsPlayerReady(false);
  }, [videoId]);

  // 3. No id → empty placeholder; otherwise shell + iframe.
  if (!videoId) {
    return (
      <EmptyInlinePlayerBox
        playerWidth={playerWidth}
        playerHeight={playerHeight}
        messageColor={themeColors.nbOnFill}
      />
    );
  }

  const showLoadingOverlay = !isPlayerReady;
  const playerShellStyle = [styles.playerShell, { width: playerWidth, height: playerHeight }];
  const initialPlayerParams = {
    controls: YOUTUBE_SHOW_CONTROLS,
    rel: YOUTUBE_HIDE_RELATED,
    iv_load_policy: YOUTUBE_HIDE_ANNOTATIONS_POLICY,
  };
  const webViewProps = {
    allowsInlineMediaPlayback: true,
    mediaPlaybackRequiresUserAction: false,
    androidLayerType: 'hardware',
  };
  // Opacity hack forces some Android WebViews to paint the iframe correctly.
  const webViewStyle = { backgroundColor: PLAYER_SHELL_BLACK, opacity: WEBVIEW_OPACITY_HACK };

  return (
    <View style={playerShellStyle}>
      {showLoadingOverlay ? (
        <PlayerLoadingOverlay spinnerColor={themeColors.nbOnFill} />
      ) : null}
      <YoutubePlayer
        key={videoId}
        height={playerHeight}
        width={playerWidth}
        play={play}
        videoId={videoId}
        onReady={() => setIsPlayerReady(true)}
        onError={warnYouTubeErrorInDev}
        initialPlayerParams={initialPlayerParams}
        webViewProps={webViewProps}
        webViewStyle={webViewStyle}
        viewContainerStyle={styles.viewContainer}
      />
    </View>
  );
}

/**
 * Full-screen modal. The exercise library usually uses the iframe player above instead.
 * Flow: 1. palette from OS scheme  2. size modal player  3. header + player + Close
 * @param {{ visible: boolean, videoId: string, title?: string, onClose: () => void }} props
 */
export function VideoPlayer({ visible, videoId, title, onClose }) {
  // 1. OS scheme → light/dark Design Law palette (no useTheme here — same as before).
  // vocab: useColorScheme = 'light' | 'dark' | null from the OS
  const colorScheme = useColorScheme();
  const colors = colorsForColorScheme(colorScheme);

  // 2. Name layout decisions before JSX.
  const modalPlayerHeight = computeModalPlayerHeight();
  const modalPlayerWidth = SCREEN_WIDTH - MODAL_SIDE_INSET;
  const headerTitle = title || FALLBACK_MODAL_TITLE;
  const canShowPlayer = visible && Boolean(videoId);
  const modalRootStyle = [styles.modalRoot, { backgroundColor: colors.nbBackground }];
  const modalHeaderStyle = [styles.modalHeader, { borderBottomColor: colors.nbBorder }];
  const modalTitleStyle = [styles.modalTitle, { color: colors.nbInk }];
  const emptyModalTextStyle = [styles.emptyPlayerText, { color: colors.nbMuted }];
  const headerSpacerStyle = { width: HEADER_SPACER_WIDTH };

  // 3. Pick player body before JSX — video when we have an id, else empty copy.
  let playerBody;
  if (canShowPlayer) {
    playerBody = (
      <YouTubeIframeExercisePlayer
        videoId={videoId}
        height={modalPlayerHeight}
        width={modalPlayerWidth}
        play
      />
    );
  } else {
    playerBody = <Text style={emptyModalTextStyle}>{EMPTY_MODAL_MESSAGE}</Text>;
  }

  // 4. Slide-up modal: close icon, title, player body, brand Close button.
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalRootStyle}>
        <View style={modalHeaderStyle}>
          <TouchableOpacity onPress={onClose} hitSlop={CLOSE_HIT_SLOP}>
            <Ionicons name="close" size={CLOSE_ICON_SIZE} color={colors.nbInk} />
          </TouchableOpacity>
          <Text style={modalTitleStyle} numberOfLines={1}>
            {headerTitle}
          </Text>
          <View style={headerSpacerStyle} />
        </View>

        <View style={styles.modalPlayer}>
          {playerBody}
        </View>

        <NbButton variant="brand" onPress={onClose}>
          Close
        </NbButton>
      </View>
    </Modal>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  playerShell: {
    backgroundColor: PLAYER_SHELL_BLACK,
    borderRadius: PLAYER_CORNER_RADIUS,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  viewContainer: {
    borderRadius: PLAYER_CORNER_RADIUS,
    overflow: 'hidden',
    backgroundColor: PLAYER_SHELL_BLACK,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: `rgba(0,0,0,${LOADING_SCRIM_OPACITY})`,
    zIndex: 2,
  },
  emptyPlayer: {
    backgroundColor: EMPTY_PLAYER_NEAR_BLACK,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: PLAYER_CORNER_RADIUS,
  },
  emptyPlayerText: { fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' },
  modalRoot: {
    flex: 1,
    paddingTop: 48,
    paddingHorizontal: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 2.5,
  },
  modalTitle: {
    flex: 1,
    marginHorizontal: 12,
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  modalPlayer: {
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
});
