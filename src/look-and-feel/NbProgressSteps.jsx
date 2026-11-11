// Neobrutalist segmented progress indicator for onboarding
// Flow: renders horizontal progress bar with completed segments using brand gradient
// Where used: onboarding flows, multi-step forms
//
// vocab: progress steps = segmented progress bar showing current step in a flow

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useColorScheme } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { lightColors, darkColors, nb, gradients, spacing } from './colorPalette';

/**
 * Segmented progress bar for multi-step flows.
 * 
 * @param {object} props
 * @param {number} props.total - total number of steps
 * @param {number} props.current - current step (1-indexed)
 * @param {object} [props.style] - additional container styles
 */
export default function NbProgressSteps({ total, current, style }) {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;
  
  return (
    <View style={[styles.container, style]}>
      {Array.from({ length: total }).map((_, index) => {
        const stepNumber = index + 1;
        const isComplete = stepNumber <= current;
        
        if (isComplete) {
          return (
            <LinearGradient
              key={stepNumber}
              colors={gradients.brand.colors}
              start={gradients.brand.start}
              end={gradients.brand.end}
              style={[
                styles.segment,
                {
                  borderColor: colors.nbBorder,
                },
                index > 0 && styles.gap,
              ]}
            />
          );
        }
        
        return (
          <View
            key={stepNumber}
            style={[
              styles.segment,
              {
                backgroundColor: colors.nbSurfaceChip,
                borderColor: colors.nbBorder,
              },
              index > 0 && styles.gap,
            ]}
          />
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
    height: 6,
    borderRadius: 3,
    borderWidth: nb.borderWidth,
  },
  gap: {
    marginLeft: spacing.xs,
  },
});
