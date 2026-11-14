// In-app Stripe Connect WebView so a trainer can finish bank setup without leaving the app.
// Flow: open Account Link URL → watch navigation → return/refresh URLs call onComplete and stop loading.
// Used by: payout reminder, settings, earnings, trainer payout onboarding step.

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
import { lightColors } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: deep-link prefixes Stripe redirects to when Connect finishes or needs reauth.
const STRIPE_RETURN_PREFIXES = [
  'coachconnect://stripe/complete',
  'coachconnect://stripe/reauth',
];

// Manipulate here: server path Stripe hits for return/refresh (also treated as "done").
const STRIPE_CONNECT_RETURN_PATH =
  /\/api\/stripe\/connect\/(return|refresh)(?:\?|#|$)/i;

const DEFAULT_TITLE = 'Connect with Stripe';
const CLOSE_LABEL = 'Close';
const OPENING_STRIPE_HINT = 'Opening Stripe form…';

const DARK_BACKGROUND = lightColors.nbInk;
const LIGHT_BACKGROUND = '#F9FAFB';
const DARK_TEXT_COLOR = lightColors.white;
const LIGHT_TEXT_COLOR = '#020617';
const SPINNER_COLOR = lightColors.primary;
const DARK_HINT_COLOR = 'rgba(148,163,184,1)';
const LIGHT_HINT_COLOR = '#64748B';

const CLOSE_SIDE_SPACER_WIDTH = 60;
const CLOSE_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };
const ANDROID_HEADER_TOP_PAD = 24;
const IOS_HEADER_TOP_PAD = 8;

// ===== HELPER FUNCTIONS =====

function pickStripeConnectModalColors(isDark) {
  if (isDark) {
    return {
      backgroundColor: DARK_BACKGROUND,
      textColor: DARK_TEXT_COLOR,
      hintColor: DARK_HINT_COLOR,
    };
  }

  return {
    backgroundColor: LIGHT_BACKGROUND,
    textColor: LIGHT_TEXT_COLOR,
    hintColor: LIGHT_HINT_COLOR,
  };
}

function urlMatchesStripeReturnPrefix(urlText) {
  for (let index = 0; index < STRIPE_RETURN_PREFIXES.length; index += 1) {
    const prefix = STRIPE_RETURN_PREFIXES[index];
    if (urlText.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

function isStripeConnectFinishUrl(urlText) {
  if (!urlText) {
    return false;
  }
  if (typeof urlText !== 'string') {
    return false;
  }
  if (urlMatchesStripeReturnPrefix(urlText)) {
    return true;
  }
  return STRIPE_CONNECT_RETURN_PATH.test(urlText);
}

function tellParentSetupFinished(onComplete, finishedUrl) {
  if (!onComplete) {
    return;
  }
  onComplete({ url: finishedUrl });
}

// iOS asks before each navigation. Return false to stop loading after we finish.
function allowStripeNavigationOrFinish(request, onComplete) {
  let requestUrl = null;
  if (request) {
    requestUrl = request.url;
  }
  if (!isStripeConnectFinishUrl(requestUrl)) {
    return true;
  }

  tellParentSetupFinished(onComplete, requestUrl);
  return false;
}

// Android also fires navigation-state changes for the same return/refresh URLs.
function noteStripeReturnNavigation(navigationState, onComplete) {
  let navigationUrl = null;
  if (navigationState) {
    navigationUrl = navigationState.url;
  }
  if (!isStripeConnectFinishUrl(navigationUrl)) {
    return;
  }

  tellParentSetupFinished(onComplete, navigationUrl);
}

function StripeConnectModalHeader({ title, textColor, onClose }) {
  const headerTitle = title || DEFAULT_TITLE;

  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onClose} hitSlop={CLOSE_HIT_SLOP}>
        <Text style={[styles.closeText, { color: textColor }]}>{CLOSE_LABEL}</Text>
      </TouchableOpacity>
      <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
        {headerTitle}
      </Text>
      <View style={{ width: CLOSE_SIDE_SPACER_WIDTH }} />
    </View>
  );
}

function StripeWebViewLoadingOverlay({ show, hintColor }) {
  if (!show) {
    return null;
  }

  return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color={SPINNER_COLOR} />
      <Text style={[styles.hint, { color: hintColor }]}>{OPENING_STRIPE_HINT}</Text>
    </View>
  );
}

function headerTopPaddingForPlatform() {
  if (Platform.OS === 'android') {
    return ANDROID_HEADER_TOP_PAD;
  }
  return IOS_HEADER_TOP_PAD;
}

// ===== MAIN FUNCTION =====

/**
 * Full-screen modal with Stripe Connect inside a WebView.
 * @param {{ visible: boolean, url: string, title?: string, isDark?: boolean, onClose: Function, onComplete?: Function }} props
 */
export function TrainerPayoutSetupPopup({
  visible,
  url,
  title,
  isDark = true,
  onClose,
  onComplete,
}) {
  // vocab: useState = React hook that holds a value across paints
  const [isPageLoading, setIsPageLoading] = useState(true);

  // vocab: useEffect = runs after paint; here we reset the spinner when the modal reopens
  useEffect(() => {
    const modalJustOpenedWithUrl = visible && url;
    if (modalJustOpenedWithUrl) {
      setIsPageLoading(true);
    }
  }, [visible, url]);

  // 1. Hidden until the parent has a Stripe Account Link URL.
  if (!visible || !url) {
    return null;
  }

  // 2. Theme colors for header + spinner hint (dark vs light).
  const themeColors = pickStripeConnectModalColors(isDark);

  // 3. Load that URL; return/refresh deep links call onComplete and block further loads.
  function handleShouldStartLoad(request) {
    return allowStripeNavigationOrFinish(request, onComplete);
  }

  function handleNavigationStateChange(navigationState) {
    noteStripeReturnNavigation(navigationState, onComplete);
  }

  function handleLoadEnded() {
    setIsPageLoading(false);
  }

  function handleLoadFailed() {
    setIsPageLoading(false);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.backgroundColor }]}>
        <StripeConnectModalHeader
          title={title}
          textColor={themeColors.textColor}
          onClose={onClose}
        />
        <View style={[styles.wrap, { backgroundColor: themeColors.backgroundColor }]}>
          {/* vocab: WebView = in-app browser. Stripe Account Link must not open Safari. */}
          <WebView
            source={{ uri: url }}
            style={styles.webview}
            onLoadEnd={handleLoadEnded}
            onError={handleLoadFailed}
            originWhitelist={['*']}
            mixedContentMode="always"
            allowsInlineMediaPlayback
            androidLayerType="hardware"
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            onNavigationStateChange={handleNavigationStateChange}
          />
          <StripeWebViewLoadingOverlay show={isPageLoading} hintColor={themeColors.hintColor} />
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
    paddingTop: headerTopPaddingForPlatform(),
    paddingBottom: 8,
  },
  closeText: { fontSize: 16, fontWeight: '600' },
  title: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700', marginHorizontal: 12 },
  wrap: { flex: 1, position: 'relative' },
  // opacity 0.99 avoids an Android WebView blank-screen bug
  webview: { flex: 1, opacity: 0.99 },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(2,6,23,0.35)',
  },
  hint: { marginTop: 12, fontSize: 13 },
});
