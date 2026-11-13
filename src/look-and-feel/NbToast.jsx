// Design Law toast — surface or black card, 3px border, shadow 4, optional action chip.
// Flow: parent mounts when a short notice is needed → optional action → auto-dismiss is caller-owned.
// Used by roster / save feedback; prefer this over Alert.alert for non-blocking success copy.
//
// vocab: variant fill = black toast (onFill text); surface = default card on soft bg
// Manipulate here: shadowOffset 4 matches DESIGN-SYSTEM toast; keep action min 44 tall

import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import HardShadow from './HardShadow';
import NbButton from './NbButton';
import { borderRadius, nb, spacing } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====

const TOAST_SHADOW = 4;

// ===== MAIN FUNCTION =====

/**
 * @param {{
 *   title: string,
 *   subtitle?: string,
 *   actionLabel?: string,
 *   onAction?: () => void,
 *   variant?: 'surface' | 'fill',
 *   style?: object,
 * }} props
 */
export default function NbToast({
  title,
  subtitle,
  actionLabel,
  onAction,
  variant = 'surface',
  style,
}) {
  const { colors } = useTheme();
  const isFill = variant === 'fill';
  const bg = isFill ? colors.nbFill : colors.nbSurface;
  const titleColor = isFill ? colors.nbOnFill : colors.nbInk;
  const subColor = isFill ? colors.nbOnFill : colors.nbMuted;

  return (
    <HardShadow offset={TOAST_SHADOW} radius={borderRadius.nbChip} style={style}>
      <View
        style={[
          styles.toast,
          {
            backgroundColor: bg,
            borderColor: colors.nbBorder,
          },
        ]}
      >
        <View style={styles.copy}>
          <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.sub, { color: subColor, opacity: isFill ? 0.85 : 1 }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {actionLabel && typeof onAction === 'function' ? (
          <NbButton
            variant={isFill ? 'ghost' : 'fill'}
            sm
            onPress={onAction}
            style={isFill ? { backgroundColor: colors.nbSurface } : undefined}
          >
            {actionLabel}
          </NbButton>
        ) : null}
      </View>
    </HardShadow>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbChip,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
  },
  sub: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
});
