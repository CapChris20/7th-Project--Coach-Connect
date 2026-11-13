// Design Law offline strip (loading-and-errors PNG 09/17).
// Flow: parent passes offline + onRetry → black banner with Retry chip.
// Used by home / inbox when NetInfo (or shell) says the phone is offline.

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

// ===== MAIN FUNCTION =====

/**
 * @param {{ visible?: boolean, title?: string, subtitle?: string, onRetry?: Function, retrying?: boolean }} props
 */
export default function OfflineBanner({
  visible = true,
  title = DEFAULT_TITLE,
  subtitle = DEFAULT_SUB,
  onRetry,
  retrying = false,
}) {
  const { colors } = useTheme();
  if (!visible) return null;

  return (
    <HardShadow
      offset={nb.shadowOffsetCard}
      radius={borderRadius.nbCard}
      style={styles.wrap}
    >
      <View
        style={[
          styles.banner,
          {
            backgroundColor: colors.nbFill,
            borderColor: colors.nbBorder,
          },
        ]}
      >
        {retrying ? (
          <ActivityIndicator size="small" color={colors.nbOnFill} />
        ) : (
          <Ionicons name="cloud-offline-outline" size={18} color={colors.nbOnFill} />
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.title, { color: colors.nbOnFill }]}>{title}</Text>
          <Text style={[styles.sub, { color: colors.nbOnFill }]}>{subtitle}</Text>
        </View>
        {typeof onRetry === 'function' ? (
          <NbButton
            variant="ghost"
            sm
            onPress={onRetry}
            style={[styles.retry, { backgroundColor: colors.nbSurface }]}
          >
            Retry
          </NbButton>
        ) : null}
      </View>
    </HardShadow>
  );
}

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
  title: { fontSize: 14, fontWeight: '900' },
  sub: { fontSize: 12, fontWeight: '600', opacity: 0.8, marginTop: 2 },
  // Manipulate here: ghost retry chip on the dark banner (uses surface, not a one-off hex).
  retry: {},
});
