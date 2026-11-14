// Design Law toast — bordered notice card with hard shadow and an optional action chip.
// Flow: parent mounts the notice → paint surface or fill → title/subtitle → optional NbButton.
// Used by: roster / save feedback. Prefer this over Alert.alert for non-blocking success copy.
// Auto-dismiss timing is owned by the caller (this file only paints).
//
// vocab: HardShadow = offset slab behind the face (Design Law — no soft blur)
// vocab: variant fill = black toast (onFill text); surface = default card on soft bg
// Manipulate here: TOAST_SHADOW_OFFSET 4 matches DESIGN-SYSTEM toast; keep action min 44 tall

import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import HardShadow from './HardShadow';
import NbButton from './NbButton';
import { borderRadius, nb } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====

// Manipulate here: Design Law toast shadow offset (px). Must match HardShadow callers elsewhere.
const TOAST_SHADOW_OFFSET = 4;

const TOAST_VARIANT_FILL = 'fill';
const TOAST_VARIANT_SURFACE = 'surface';

// Fill subtitle stays slightly softer than the title so hierarchy reads on black.
const FILL_SUBTITLE_OPACITY = 0.85;
const SURFACE_SUBTITLE_OPACITY = 1;

// ===== HELPER FUNCTIONS =====

/**
 * Map variant → background + ink colors.
 * Fill inverts to on-dark copy; surface uses normal ink/muted.
 *
 * @param {'surface' | 'fill'} variant
 * @param {object} themeColors - colors bag from useTheme()
 */
function pickToastPaintFromVariant(variant, themeColors) {
  const isFillVariant = variant === TOAST_VARIANT_FILL;

  if (isFillVariant) {
    return {
      isFillVariant: true,
      backgroundColor: themeColors.nbFill,
      titleColor: themeColors.nbOnFill,
      subtitleColor: themeColors.nbOnFill,
      subtitleOpacity: FILL_SUBTITLE_OPACITY,
    };
  }

  return {
    isFillVariant: false,
    backgroundColor: themeColors.nbSurface,
    titleColor: themeColors.nbInk,
    subtitleColor: themeColors.nbMuted,
    subtitleOpacity: SURFACE_SUBTITLE_OPACITY,
  };
}

/**
 * Action chip only when both a label string and a press handler exist.
 */
function toastHasActionChip(actionLabel, onAction) {
  const hasLabel = Boolean(actionLabel);
  const hasHandler = typeof onAction === 'function';
  return hasLabel && hasHandler;
}

/**
 * Title always; subtitle only when the parent passed one.
 */
function ToastCopyBlock({ title, subtitle, titleColor, subtitleColor, subtitleOpacity }) {
  const titleStyle = [styles.title, { color: titleColor }];
  const subtitleStyle = [styles.sub, { color: subtitleColor, opacity: subtitleOpacity }];

  return (
    <View style={styles.copy}>
      <Text style={titleStyle}>{title}</Text>
      {subtitle ? <Text style={subtitleStyle}>{subtitle}</Text> : null}
    </View>
  );
}

/**
 * Optional chip on the right. Fill toasts use a ghost button on surface so it pops on black.
 */
function ToastActionChip({ actionLabel, onAction, isFillVariant, themeColors }) {
  const buttonVariant = isFillVariant ? 'ghost' : 'fill';
  let chipExtraStyle;
  if (isFillVariant) {
    chipExtraStyle = { backgroundColor: themeColors.nbSurface };
  }

  return (
    <NbButton variant={buttonVariant} sm onPress={onAction} style={chipExtraStyle}>
      {actionLabel}
    </NbButton>
  );
}

/**
 * Bordered face inside HardShadow — copy on the left, optional chip on the right.
 */
function ToastFaceCard({ paint, borderColor, title, subtitle, showAction, actionLabel, onAction, themeColors }) {
  const faceStyle = [
    styles.toast,
    {
      backgroundColor: paint.backgroundColor,
      borderColor,
    },
  ];

  return (
    <View style={faceStyle}>
      <ToastCopyBlock
        title={title}
        subtitle={subtitle}
        titleColor={paint.titleColor}
        subtitleColor={paint.subtitleColor}
        subtitleOpacity={paint.subtitleOpacity}
      />
      {showAction ? (
        <ToastActionChip
          actionLabel={actionLabel}
          onAction={onAction}
          isFillVariant={paint.isFillVariant}
          themeColors={themeColors}
        />
      ) : null}
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Short in-app notice with optional action.
 *
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
  variant = TOAST_VARIANT_SURFACE,
  style,
}) {
  // vocab: useTheme = Design Law light/dark color bag for the active mode
  const { colors: themeColors } = useTheme();

  // 1. Map variant → background + ink (fill inverts for on-dark copy).
  const paint = pickToastPaintFromVariant(variant, themeColors);

  // 2. Action row only when both label and handler exist.
  const showAction = toastHasActionChip(actionLabel, onAction);

  // 3. Hard shadow wrap → bordered card → copy + optional chip.
  return (
    <HardShadow offset={TOAST_SHADOW_OFFSET} radius={borderRadius.nbChip} style={style}>
      <ToastFaceCard
        paint={paint}
        borderColor={themeColors.nbBorder}
        title={title}
        subtitle={subtitle}
        showAction={showAction}
        actionLabel={actionLabel}
        onAction={onAction}
        themeColors={themeColors}
      />
    </HardShadow>
  );
}

// ===== PLUMBING — skip unless debugging =====

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
