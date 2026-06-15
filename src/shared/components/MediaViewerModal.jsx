/**
 * Media Viewer Modal
 *
 * Purpose: UI screen or component: Media Viewer Modal. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: MediaViewerModal
 *
 * @file-header
 */
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

const { height: WIN_H } = Dimensions.get('window');

export default function MediaViewerModal({ visible, url, kind, name, isDark = true, onClose }) {
  if (!visible || !url) return null;
  const bg = isDark ? '#020617' : '#F8FAFC';
  const textColor = isDark ? '#F8FAFC' : '#0F172A';
  const muted = isDark ? 'rgba(226,232,240,0.72)' : 'rgba(51,65,85,0.72)';

  const title = useMemo(() => {
    const raw = name || (kind === 'video' ? 'Video' : 'Photo');
    const s = String(raw);
    return s.length > 40 ? `${s.slice(0, 37)}…` : s;
  }, [name, kind]);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
        <LinearGradient
          colors={isDark ? ['rgba(2,6,23,0.96)', 'rgba(2,6,23,0.70)'] : ['rgba(248,250,252,0.98)', 'rgba(248,250,252,0.75)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }} style={styles.headerBtn}>
            <Ionicons name="close" size={22} color={textColor} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[styles.subtitle, { color: muted }]} numberOfLines={1}>
              {kind === 'video' ? 'Video' : 'Photo'}
            </Text>
          </View>
          <View style={styles.headerBtn} />
        </LinearGradient>
        <View style={styles.body}>
          {kind === 'video' ? (
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
              maximumZoomScale={3}
              minimumZoomScale={1}
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
    paddingTop: Platform.OS === 'android' ? 10 : 6,
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
    minHeight: WIN_H * 0.65,
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
