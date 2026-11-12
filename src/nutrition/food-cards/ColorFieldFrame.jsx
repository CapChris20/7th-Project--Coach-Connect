// Design Law field frame — HardShadow + 3px ink border around a form control.
// Flow: wrap children in outlined surface. Used by food-card editors.
//
// vocab: HardShadow = solid offset shadow (no blur)

import React from 'react';
import { View } from 'react-native';
import HardShadow from '../../look-and-feel/HardShadow';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { borderRadius, nb } from '../../look-and-feel/colorPalette';

/**
 * @param {{ children: React.ReactNode, radius?: number, style?: object, contentStyle?: object }} props
 */
export default function ColorFieldFrame({ children, radius = borderRadius.nbInput, style, contentStyle }) {
  const { colors } = useTheme();
  return (
    <HardShadow radius={radius} offset={nb.shadowOffsetSmall} style={style}>
      <View
        style={[
          {
            borderWidth: nb.borderWidth,
            borderColor: colors.nbBorder,
            backgroundColor: colors.nbSurface,
            borderRadius: radius,
            overflow: 'hidden',
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </HardShadow>
  );
}
