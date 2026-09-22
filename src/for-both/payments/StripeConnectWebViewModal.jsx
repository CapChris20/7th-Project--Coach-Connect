/**
 * Stripe Connect onboarding WebView (in-app, does not leave the app).
 *
 * Purpose: Load Stripe Account Link URL and detect return/refresh deep links.
 * Why it matters: Trainers complete bank setup without leaving Coach Connect.
 * Area: src/shared
 * Key exports: StripeConnectWebViewModal
 *
 * @file-header
 */
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';

const RETURN_PREFIXES = [
  'coachconnect://stripe/complete',
  'coachconnect://stripe/reauth',
];

function isStripeReturnUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (RETURN_PREFIXES.some((prefix) => url.startsWith(prefix))) return true;
  return /\/api\/stripe\/connect\/(return|refresh)(?:\?|#|$)/i.test(url);
}

export function StripeConnectWebViewModal({ visible, url, title, isDark = true, onClose, onComplete }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible && url) setLoading(true);
  }, [visible, url]);

  if (!visible || !url) return null;

  const bg = isDark ? '#0A0A0F' : '#F9FAFB';
  const textColor = isDark ? '#FFFFFF' : '#020617';

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[styles.closeText, { color: textColor }]}>Close</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
            {title || 'Connect with Stripe'}
          </Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={[styles.wrap, { backgroundColor: bg }]}>
          <WebView
            source={{ uri: url }}
            style={styles.webview}
            onLoadEnd={() => setLoading(false)}
            onError={() => setLoading(false)}
            originWhitelist={['*']}
            mixedContentMode="always"
            allowsInlineMediaPlayback
            androidLayerType="hardware"
            onShouldStartLoadWithRequest={(request) => {
              if (isStripeReturnUrl(request?.url)) {
                onComplete?.({ url: request.url });
                return false;
              }
              return true;
            }}
            onNavigationStateChange={(navState) => {
              if (isStripeReturnUrl(navState?.url)) {
                onComplete?.({ url: navState.url });
              }
            }}
          />
          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color="#FF6B9D" />
              <Text style={[styles.hint, { color: isDark ? 'rgba(148,163,184,1)' : '#64748B' }]}>
                Opening Stripe form…
              </Text>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 24 : 8,
    paddingBottom: 8,
  },
  closeText: { fontSize: 16, fontWeight: '600' },
  title: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700', marginHorizontal: 12 },
  wrap: { flex: 1, position: 'relative' },
  webview: { flex: 1, opacity: 0.99 },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(2,6,23,0.35)',
  },
  hint: { marginTop: 12, fontSize: 13 },
});
