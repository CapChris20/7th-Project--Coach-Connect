// Plays an exercise demo in a YouTube iframe, plus an optional full-screen modal.
// Flow: size the player → show a spinner until YouTube is ready → close from the modal header.
// Used by: ExerciseVideosTab. The iframe replaces a raw WebView embed so YouTube Error 153 is less likely.

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ===== NAMED CONSTANTS =====

// vocab: 16:9 is the widescreen ratio YouTube expects. Height = width * 9 / 16.
const WIDESCREEN_HEIGHT_PART = 9;
const WIDESCREEN_WIDTH_PART = 16;
// Manipulate here: players shorter than this clip the YouTube controls.
const MIN_INLINE_PLAYER_HEIGHT = 230;
const SCREEN_EDGE_INSET = 36;
const MODAL_PLAYER_MAX_SCREEN_FRACTION = 0.32;
const MODAL_PLAYER_MIN_HEIGHT = 260;
const MODAL_SIDE_INSET = 32;

// ===== HELPER FUNCTIONS =====

/**
 * Default inline size when the caller does not pass width and height.
 * @param {number|undefined} width
 * @param {number|undefined} height
 * @returns {{ playerWidth: number, playerHeight: number }}
 */
function inlinePlayerSize(width, height) {
  const playerWidth = width ?? Math.floor(SCREEN_WIDTH - SCREEN_EDGE_INSET);
  const playerHeight = height ?? Math.max(
    MIN_INLINE_PLAYER_HEIGHT,
    Math.round((playerWidth * WIDESCREEN_HEIGHT_PART) / WIDESCREEN_WIDTH_PART),
  );
  return { playerWidth, playerHeight };
}

// ===== MAIN FUNCTION =====

/**
 * YouTube IFrame player. Keep the box large enough that the controls fit.
 * @param {{ videoId: string, height?: number, width?: number, play?: boolean }} props
 */
export function YouTubeIframeExercisePlayer({ videoId, height, width, play = true }) {
  const { playerWidth, playerHeight } = inlinePlayerSize(width, height);
  const [playerReady, setPlayerReady] = useState(false);

  useEffect(() => {
    setPlayerReady(false);
  }, [videoId]);

  if (!videoId) {
    return (
      <View style={[styles.emptyPlayer, { width: playerWidth, height: playerHeight }]}>
        <Text style={styles.emptyPlayerText}>Video unavailable</Text>
      </View>
    );
  }

  return (
    <View style={[styles.playerShell, { width: playerWidth, height: playerHeight }]}>
      {!playerReady ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#FF6B9D" />
        </View>
      ) : null}
      <YoutubePlayer
        key={videoId}
        height={playerHeight}
        width={playerWidth}
        play={play}
        videoId={videoId}
        onReady={() => setPlayerReady(true)}
        onError={(e) => {
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.warn('[YouTube iframe]', e);
          }
        }}
        initialPlayerParams={{
          controls: true,
          rel: false,
          iv_load_policy: 3,
        }}
        webViewProps={{
          allowsInlineMediaPlayback: true,
          mediaPlaybackRequiresUserAction: false,
          androidLayerType: 'hardware',
        }}
        webViewStyle={{ backgroundColor: '#000', opacity: 0.99 }}
        viewContainerStyle={styles.viewContainer}
      />
    </View>
  );
}

/**
 * Full-screen modal. The exercise library usually uses the iframe player above instead.
 * @param {{ visible: boolean, videoId: string, title?: string, onClose: () => void }} props
 */
export function VideoPlayer({ visible, videoId, title, onClose }) {
  const modalPlayerHeight = Math.min(
    SCREEN_HEIGHT * MODAL_PLAYER_MAX_SCREEN_FRACTION,
    Math.max(
      MODAL_PLAYER_MIN_HEIGHT,
      Math.round((SCREEN_WIDTH * WIDESCREEN_HEIGHT_PART) / WIDESCREEN_WIDTH_PART),
    ),
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.modalTitle} numberOfLines={1}>
            {title || 'Video'}
          </Text>
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.modalPlayer}>
          {visible && videoId ? (
            <YouTubeIframeExercisePlayer videoId={videoId} height={modalPlayerHeight} width={SCREEN_WIDTH - MODAL_SIDE_INSET} play />
          ) : (
            <Text style={styles.emptyPlayerText}>Video not available</Text>
          )}
        </View>

        <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose} activeOpacity={0.9}>
          <Text style={styles.modalCloseBtnText}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  playerShell: {
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  viewContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 2,
  },
  emptyPlayer: {
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  emptyPlayerText: { color: '#FF6B9D', fontSize: 14, fontWeight: '600' },
  modalRoot: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    paddingTop: 48,
    paddingHorizontal: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,107,157,0.25)',
  },
  modalTitle: {
    flex: 1,
    marginHorizontal: 12,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  modalPlayer: {
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtn: {
    marginTop: 24,
    paddingVertical: 14,
    backgroundColor: '#FF6B9D',
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCloseBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
