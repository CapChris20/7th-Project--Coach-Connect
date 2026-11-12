// Design Law chapter progress — 3px outlined segments with solid / partial fill.
// Flow: prior chapters fill solid → current chapter fills by `fraction` (0–1) → rest empty.
// Used by client/trainer onboarding headers (Design Law chapters, not pink gradients).
//
// vocab: chapter bar = short thick segments under the screen title (not a thin % bar)
// Manipulate here: height 10 + spacing.xs gap match Design Law onboarding PNGs

import React from 'react';
import { View, StyleSheet } from 'react-native';

import { nb, spacing } from './colorPalette';
import { useTheme } from './lightDarkMode';

/**
 * Segmented progress bar for multi-step flows.
 *
 * @param {object} props
 * @param {number} props.total - total chapters (Design Law client = 3)
 * @param {number} props.current - current chapter (1-indexed). Pass total+1 or current=total with fraction=1 when done.
 * @param {number} [props.fraction=1] - 0–1 fill of the current chapter segment
 * @param {object} [props.style]
 */
export default function NbProgressSteps({ total, current, fraction = 1, style }) {
  const { colors } = useTheme();
  // Clamp so a bad caller cannot blow up the map.
  const safeTotal = Math.max(1, Number(total) || 1);
  const safeCurrent = Math.max(0, Number(current) || 0);
  const safeFraction = Math.min(1, Math.max(0, Number(fraction) || 0));

  return (
    <View style={[styles.container, style]}>
      {Array.from({ length: safeTotal }).map((_, index) => {
        const stepNumber = index + 1;
        // Fully done chapters sit behind the active one.
        const fullyFilled = stepNumber < safeCurrent || (stepNumber === safeCurrent && safeFraction >= 1);
        // Active chapter gets a clipped fill so “40% through chapter 1” reads on the bar.
        const isActivePartial = stepNumber === safeCurrent && safeFraction > 0 && safeFraction < 1;

        return (
          <View
            key={stepNumber}
            style={[
              styles.segment,
              {
                backgroundColor: fullyFilled ? colors.nbFill : colors.nbSurface,
                borderColor: colors.nbBorder,
              },
              index > 0 && styles.gap,
            ]}
          >
            {isActivePartial ? (
              <View
                style={[
                  styles.partialFill,
                  {
                    width: `${Math.round(safeFraction * 100)}%`,
                    backgroundColor: colors.nbFill,
                  },
                ]}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
  segment: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
  },
  partialFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  gap: {
    marginLeft: spacing.xs,
  },
});
