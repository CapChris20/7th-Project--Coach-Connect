/**
 * Pdf Viewer Modal
 *
 * Purpose: UI screen or component: Pdf Viewer Modal. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: PdfViewerModal
 *
 * @file-header
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function PdfViewerModal({ visible, url, name, isDark = true, onClose }) {
  if (!url) return null;
  const bg = isDark ? '#020617' : '#F8FAFC';
  const textColor = isDark ? '#F8FAFC' : '#0F172A';
  const muted = isDark ? 'rgba(226,232,240,0.72)' : 'rgba(51,65,85,0.72)';
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible && url) setLoading(true);
  }, [visible, url]);

  const title = useMemo(() => {
    const raw = name || 'Document';
    const s = String(raw);
    return s.length > 40 ? `${s.slice(0, 37)}…` : s;
  }, [name]);

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
              PDF
            </Text>
          </View>
          <View style={styles.headerBtn} />
        </LinearGradient>
        <View style={[styles.webviewWrapper, { backgroundColor: bg }]}>
          <WebView
            source={{ uri: url }}
            style={styles.webview}
            onLoadEnd={() => setLoading(false)}
            onError={() => setLoading(false)}
            originWhitelist={['*']}
            mixedContentMode="always"
          />
          {loading && (
            <View style={styles.loadingOverlay}>
              <LinearGradient
                colors={isDark ? ['rgba(15,23,42,0.96)', 'rgba(2,6,23,0.88)'] : ['rgba(255,255,255,0.96)', 'rgba(241,245,249,0.92)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.loadingCard, { borderColor: isDark ? 'rgba(148,163,184,0.35)' : 'rgba(2,6,23,0.10)' }]}
              >
                <View style={[styles.loadingIconCircle, { borderColor: isDark ? 'rgba(148,163,184,0.45)' : 'rgba(2,6,23,0.12)' }]}>
                  <Text style={[styles.loadingIconText, { color: textColor }]}>PDF</Text>
                </View>
                <Text style={[styles.loadingTitle, { color: textColor }]}>Loading preview</Text>
                <Text style={[styles.loadingSubtitle, { color: muted }]}>If this takes too long, try again on Wi‑Fi.</Text>
                <ActivityIndicator style={{ marginTop: 12 }} size="small" color={isDark ? '#A855F7' : '#7C3AED'} />
              </LinearGradient>
            </View>
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
    paddingTop: Platform.OS === 'android' ? 24 : 8,
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
  webviewWrapper: {
    flex: 1,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.22)',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCard: {
    width: '72%',
    maxWidth: 320,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  loadingIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  loadingIconText: {
    fontSize: 14,
    fontWeight: '700',
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  loadingSubtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
});

