// In-app Stripe Connect WebView so a trainer can finish bank setup without leaving the app.
// Flow: open the Account Link URL → watch navigation → if it hits our return/refresh URL, call onComplete.
// Used by: payout reminder, settings, earnings, and the trainer payout onboarding step.

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

// ===== NAMED CONSTANTS =====

const STRIPE_RETURN_PREFIXES = [
  'coachconnect://stripe/complete',
  'coachconnect://stripe/reauth',
];
const STRIPE_CONNECT_RETURN_PATH =
  /\/api\/stripe\/connect\/(return|refresh)(?:\?|#|$)/i;
const DEFAULT_TITLE = 'Connect with Stripe';
const CLOSE_LABEL = 'Close';
const OPENING_STRIPE_HINT = 'Opening Stripe form…';
const DARK_BACKGROUND = '#0A0A0F';
const LIGHT_BACKGROUND = '#F9FAFB';
const DARK_TEXT_COLOR = '#FFFFFF';
const LIGHT_TEXT_COLOR = '#020617';
const SPINNER_COLOR = '#FF6B9D';
const DARK_HINT_COLOR = 'rgba(148,163,184,1)';
const LIGHT_HINT_COLOR = '#64748B';
const CLOSE_SIDE_SPACER_WIDTH = 60;
const CLOSE_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

// ===== HELPER FUNCTIONS =====

/**
 * True for our deep links and for the server return/refresh paths Stripe redirects through.
 * @param {string} url
 * @returns {boolean}
 */
function isStripeReturnUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (urlStartsWithStripeReturnPrefix(url)) return true;
  return STRIPE_CONNECT_RETURN_PATH.test(url);
}

function urlStartsWithStripeReturnPrefix(url) {
  for (const prefix of STRIPE_RETURN_PREFIXES) {
    if (url.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Return/refresh URLs finish setup and must not keep loading inside the WebView.
 * @param {{ url?: string }} request
 * @param {Function} [onComplete]
 * @returns {boolean}
 */
function shouldAllowStripeNavigation(request, onComplete) {
  if (isStripeReturnUrl(request?.url)) {
    onComplete?.({ url: request.url });
    return false;
  }
  return true;
}

/**
 * Same return/refresh check for Android navigation-state changes.
 * @param {{ url?: string }} navigationState
 * @param {Function} [onComplete]
 */
function noteStripeNavigationChange(navigationState, onComplete) {
  if (isStripeReturnUrl(navigationState?.url)) {
    onComplete?.({ url: navigationState.url });
  }
}

/**
 * @param {boolean} isDark
 * @returns {{ backgroundColor: string, textColor: string, hintColor: string }}
 */
function payoutPopupColors(isDark) {
  return {
    backgroundColor: isDark ? DARK_BACKGROUND : LIGHT_BACKGROUND,
    textColor: isDark ? DARK_TEXT_COLOR : LIGHT_TEXT_COLOR,
    hintColor: isDark ? DARK_HINT_COLOR : LIGHT_HINT_COLOR,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Load Stripe Account Link URL and detect return/refresh deep links.
 * @param {{ visible: boolean, url: string, title?: string, isDark?: boolean, onClose: Function, onComplete?: Function }} props
 */
export function TrainerPayoutSetupPopup({ visible, url, title, isDark = true, onClose, onComplete }) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (visible && url) setIsLoading(true);
  }, [visible, url]);

  // 1. Hidden until the parent has a Stripe Account Link URL.
  if (!visible || !url) return null;

  // 2. Load that URL. Return/refresh deep links call onComplete and stop the WebView.
  const popupColors = payoutPopupColors(isDark);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: popupColors.backgroundColor }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={CLOSE_HIT_SLOP}>
            <Text style={[styles.closeText, { color: popupColors.textColor }]}>{CLOSE_LABEL}</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: popupColors.textColor }]} numberOfLines={1}>
            {title || DEFAULT_TITLE}
          </Text>
          <View style={{ width: CLOSE_SIDE_SPACER_WIDTH }} />
        </View>
        <View style={[styles.wrap, { backgroundColor: popupColors.backgroundColor }]}>
          {/* vocab: WebView = in-app browser. Stripe Account Link must not open Safari. */}
          <WebView
            source={{ uri: url }}
            style={styles.webview}
            onLoadEnd={() => setIsLoading(false)}
            onError={() => setIsLoading(false)}
            originWhitelist={['*']}
            mixedContentMode="always"
            allowsInlineMediaPlayback
            androidLayerType="hardware"
            onShouldStartLoadWithRequest={(request) => shouldAllowStripeNavigation(request, onComplete)}
            onNavigationStateChange={(navigationState) => noteStripeNavigationChange(navigationState, onComplete)}
          />
          {isLoading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={SPINNER_COLOR} />
              <Text style={[styles.hint, { color: popupColors.hintColor }]}>
                {OPENING_STRIPE_HINT}
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
