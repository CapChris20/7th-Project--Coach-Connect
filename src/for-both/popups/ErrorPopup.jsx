// Design Law error / alert modal (loading-and-errors cannot-reach / form toasts).
// Flow: parent sets visible → Dismiss (onDismiss) or Retry (onRetry).
// Used by login and other screens that need a branded alert instead of a system Alert.

import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import HardShadow from '../../look-and-feel/HardShadow';
import { borderRadius, nb } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const DEFAULT_TITLE = 'Error';
const DEFAULT_MESSAGE = 'Something went wrong.';
const DEFAULT_ICON = 'alert-circle-outline';
const DEFAULT_RETRY_TEXT = 'Retry';
const MAX_CARD_WIDTH = 500;
const CARD_WIDTH_RATIO = 0.9;
const ICON_SIZE = 40;
const ICON_WRAP_SIZE = 64;
const ICON_WRAP_RADIUS = 16;

// ===== HELPER FUNCTIONS =====

/** Empty close handler so Modal always has an onRequestClose function. */
function doNothingOnDismiss() {}

/**
 * Pure modal chrome — no hooks. Parent supplies theme colors and callbacks.
 * Why split: the exported component owns theme/window hooks; layout stays testable without them.
 */
function ErrorPopupLayout({
  visible,
  title,
  message,
  icon,
  retryText,
  maxCardWidth,
  colors,
  onDismiss,
  onRetry,
}) {
  // Name the decision before JSX: Retry is optional; Dismiss is always there.
  const showRetryButton = Boolean(onRetry);
  const closeHandler = onDismiss || doNothingOnDismiss;

  let buttonRowStyle = styles.buttonRow;
  if (!showRetryButton) {
    buttonRowStyle = [styles.buttonRow, styles.buttonRowSingle];
  }

  const iconWrapStyle = [
    styles.iconWrap,
    { borderColor: colors.nbBorder, backgroundColor: colors.nbSoft },
  ];
  const titleStyle = [styles.title, { color: colors.nbInk }];
  const messageStyle = [styles.message, { color: colors.nbMuted }];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={closeHandler}
    >
      <View style={styles.overlay}>
        <HardShadow
          offset={nb.shadowOffsetCard}
          radius={borderRadius.nbCard}
          style={{ width: maxCardWidth }}
        >
          <NbCard noShadow style={styles.card}>
            <View style={styles.cardContent}>
              <View style={iconWrapStyle}>
                <Ionicons name={icon} size={ICON_SIZE} color={colors.nbInk} />
              </View>

              <Text style={titleStyle}>{title}</Text>
              <Text style={messageStyle}>{message}</Text>

              <View style={buttonRowStyle}>
                <View style={{ flex: 1 }}>
                  <NbButton variant="ghost" onPress={onDismiss}>
                    Dismiss
                  </NbButton>
                </View>
                {showRetryButton ? (
                  <View style={{ flex: 1 }}>
                    <NbButton variant="fill" onPress={onRetry}>
                      {retryText}
                    </NbButton>
                  </View>
                ) : null}
              </View>
            </View>
          </NbCard>
        </HardShadow>
      </View>
    </Modal>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Branded error / alert popup. Theme + card width come from hooks here; paint lives in ErrorPopupLayout.
 * @param {{ visible?: boolean, title?: string, message?: string, icon?: string, onDismiss?: Function, onRetry?: Function, retryText?: string }} props
 */
export function ErrorPopup({
  visible = false,
  title = DEFAULT_TITLE,
  message = DEFAULT_MESSAGE,
  icon = DEFAULT_ICON,
  onDismiss,
  onRetry,
  retryText = DEFAULT_RETRY_TEXT,
}) {
  // 1. Theme colors for the branded card.
  // vocab: useTheme = light/dark Design Law colors for this screen
  const { colors } = useTheme();

  // 2. Card width from the live window (~90% on phones, capped on tablets).
  // vocab: useWindowDimensions = live window size so the card stays ~90% wide on phones
  // Manipulate here: CARD_WIDTH_RATIO / MAX_CARD_WIDTH cap how wide the alert gets on tablets
  const { width: windowWidth } = useWindowDimensions();
  const cardWidthFromWindow = windowWidth * CARD_WIDTH_RATIO;
  const maxCardWidth = Math.min(MAX_CARD_WIDTH, cardWidthFromWindow);

  // 3. Hand theme + width to the pure layout (hooks stay here).
  return (
    <ErrorPopupLayout
      visible={visible}
      title={title}
      message={message}
      icon={icon}
      retryText={retryText}
      maxCardWidth={maxCardWidth}
      colors={colors}
      onDismiss={onDismiss}
      onRetry={onRetry}
    />
  );
}

export default ErrorPopup;

// PLUMBING — skip unless debugging Design Law spacing / overlay opacity

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    // Manipulate here: darker = stronger dim behind the alert
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    padding: 0,
  },
  cardContent: {
    alignItems: 'center',
    padding: 20,
    gap: 10,
  },
  iconWrap: {
    width: ICON_WRAP_SIZE,
    height: ICON_WRAP_SIZE,
    borderRadius: ICON_WRAP_RADIUS,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 8,
  },
  buttonRowSingle: {
    justifyContent: 'center',
  },
});
