import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

/**
 * Use blur as a backdrop only. Do not nest {@link Image}, vector icons, MaskedView, or TextInput
 * inside {@link BlurView} — on iOS/Android (including Expo Go) they often fail to composite (blank,
 * flicker, or vanish until layout changes). Children render in a normal layer above the blur.
 *
 * If `style` includes flex layout (e.g. `flexDirection: 'row'`), that applies to the **outer** shell;
 * the **inner** wrapper defaults to column. Pass the same flex direction via `contentWrapperStyle`
 * when children must stay in a row (see BottomNavBar).
 */
export default function BlurBackdropPlate({ intensity, tint, style, contentWrapperStyle, children }) {
  return (
    <View style={[style, { position: 'relative' }]}>
      <BlurView intensity={intensity} tint={tint} pointerEvents="none" style={StyleSheet.absoluteFillObject} />
      <View style={[{ position: 'relative', zIndex: 1 }, contentWrapperStyle]} collapsable={false}>
        {children}
      </View>
    </View>
  );
}
