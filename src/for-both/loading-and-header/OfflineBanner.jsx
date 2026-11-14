// Design Law offline strip (loading-and-errors PNG 09/17).
// Flow: parent passes visible + onRetry → black banner, optional Retry chip.
// Used by home / inbox when NetInfo (or the shell) says the phone is offline.

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NbButton from '../../look-and-feel/NbButton';
import HardShadow from '../../look-and-feel/HardShadow';
import { borderRadius, nb } from '../../look-and-feel/colorPalette';
import { useTheme } from '../../look-and-feel/lightDarkMode';

// ===== NAMED CONSTANTS =====

const DEFAULT_TITLE = 'You are offline';
const DEFAULT_SUB = 'Showing what was saved on this phone';
const OFFLINE_ICON_NAME = 'cloud-offline-outline';
const OFFLINE_ICON_SIZE = 18;
const RETRY_LABEL = 'Retry';

// ===== HELPER FUNCTIONS =====

function parentPassedRetryHandler(onRetry) {
  return typeof onRetry === 'function';
}

function bannerThemeColors(themeColors) {
  return {
    fillColor: themeColors.nbFill,
    borderColor: themeColors.nbBorder,
    inkColor: themeColors.nbOnFill,
    surfaceColor: themeColors.nbSurface,
  };
}

// ===== SMALL LAYOUT PIECES =====

function OfflineBannerLeadingIcon({ isRetrying, inkColor }) {
  if (isRetrying) {
    return <ActivityIndicator size="small" color={inkColor} />;
  }
  return (
    <Ionicons name={OFFLINE_ICON_NAME} size={OFFLINE_ICON_SIZE} color={inkColor} />
  );
}

function OfflineBannerTextBlock({ title, subtitle, inkColor }) {
  return (
    <View style={styles.textColumn}>
      <Text style={[styles.title, { color: inkColor }]}>{title}</Text>
      <Text style={[styles.sub, { color: inkColor }]}>{subtitle}</Text>
    </View>
  );
}

function OfflineBannerRetryChip({ onRetry, surfaceColor }) {
  return (
    <NbButton
      variant="ghost"
      sm
      onPress={onRetry}
      style={[styles.retry, { backgroundColor: surfaceColor }]}
    >
      {RETRY_LABEL}
    </NbButton>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Black Design Law strip: cloud/spinner, offline copy, optional Retry.
 * @param {{ visible?: boolean, title?: string, subtitle?: string, onRetry?: Function, retrying?: boolean }} props
 * @returns {import('react').ReactElement|null}
 */
export default function OfflineBanner({
  visible = true,
  title = DEFAULT_TITLE,
  subtitle = DEFAULT_SUB,
  onRetry,
  retrying = false,
}) {
  // vocab: useTheme = Design Law color tokens for the active light/dark shell.
  const { colors } = useTheme();

  // 1. Bail when the parent hides us (still online / banner dismissed).
  if (!visible) {
    return null;
  }

  // 2. Name theme tokens before JSX so the return stays flat.
  const themeColors = bannerThemeColors(colors);
  const fillColor = themeColors.fillColor;
  const borderColor = themeColors.borderColor;
  const inkColor = themeColors.inkColor;
  const surfaceColor = themeColors.surfaceColor;
  const showRetryChip = parentPassedRetryHandler(onRetry);

  // 3. HardShadow wrap → row: leading icon, copy, optional Retry chip.
  // vocab: HardShadow = Design Law hard offset shadow (not soft blur).
  // vocab: NbButton ghost/sm = small text chip on the banner surface.
  const bannerSurfaceStyle = {
    backgroundColor: fillColor,
    borderColor,
  };

  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard} style={styles.wrap}>
      <View style={[styles.banner, bannerSurfaceStyle]}>
        <OfflineBannerLeadingIcon isRetrying={retrying} inkColor={inkColor} />
        <OfflineBannerTextBlock title={title} subtitle={subtitle} inkColor={inkColor} />
        {showRetryChip ? (
          <OfflineBannerRetryChip onRetry={onRetry} surfaceColor={surfaceColor} />
        ) : null}
      </View>
    </HardShadow>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: nb.screenGutter,
    marginBottom: 10,
  },
  banner: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textColumn: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: '900' },
  sub: { fontSize: 12, fontWeight: '600', opacity: 0.8, marginTop: 2 },
  // Manipulate here: ghost retry chip on the dark banner (surface token, not a one-off hex).
  retry: {},
});
