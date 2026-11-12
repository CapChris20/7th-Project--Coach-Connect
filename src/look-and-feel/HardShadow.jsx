// Hard offset shadow wrapper so Android matches iOS (no blur).
// Flow: paint a solid sibling behind the child, offset by size → child on top.
// Used by: NbCard, NbButton, pilot dashboard cards.

import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { nb } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== MAIN FUNCTION =====

/**
 * @param {{ children: import('react').ReactNode, offset?: number, radius?: number, style?: object }} props
 */
export default function HardShadow({ children, offset = nb.shadowOffsetCard, radius = 10, style }) {
  const { colors } = useTheme();

  if (Platform.OS === 'ios') {
    return (
      <View
        style={[
          {
            shadowColor: colors.nbShadow,
            shadowOffset: { width: offset, height: offset },
            shadowOpacity: 1,
            shadowRadius: 0,
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <View style={[{ position: 'relative' }, style]}>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            top: offset,
            left: offset,
            borderRadius: radius,
            backgroundColor: colors.nbShadow,
          },
        ]}
      />
      {children}
    </View>
  );
}
