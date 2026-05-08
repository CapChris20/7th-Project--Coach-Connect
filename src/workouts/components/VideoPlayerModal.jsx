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

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/**
 * YouTube IFrame API player (replaces raw WebView embed URLs — helps avoid Error 153).
 * Keep width ≥ ~320 and height ≥ ~220 so controls fit per YouTube embed guidelines.
 */
export function YouTubeIframeExercisePlayer({ videoId, height, width, play = true }) {
  const w = width ?? Math.floor(SCREEN_W - 36);
  const h = height ?? Math.max(230, Math.round((w * 9) / 16));
  const [playerReady, setPlayerReady] = useState(false);

  useEffect(() => {
    setPlayerReady(false);
  }, [videoId]);

  if (!videoId) {
    return (
      <View style={[styles.emptyPlayer, { width: w, height: h }]}>
        <Text style={styles.emptyPlayerText}>Video unavailable</Text>
      </View>
    );
  }

  return (
    <View style={[styles.playerShell, { width: w, height: h }]}>
      {!playerReady ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#FF6B9D" />
        </View>
      ) : null}
      <YoutubePlayer
        key={videoId}
        height={h}
        width={w}
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

/** Standalone full-screen style modal (optional; Exercise Library uses sheet + YouTubeIframeExercisePlayer). */
export function VideoPlayerModal({ visible, videoId, title, onClose }) {
  const h = Math.min(SCREEN_H * 0.32, Math.max(260, Math.round((SCREEN_W * 9) / 16)));

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
            <YouTubeIframeExercisePlayer videoId={videoId} height={h} width={SCREEN_W - 32} play />
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
