/**
 * Flat glow wash behind hero cards — tinted plate + colored shadow only (no blobs).
 */
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

/** Same idea as FilesNotesHeroCard cardShadow — orange luminous spill behind the card. */
export default function HeroCardBackGlow({ isDark = true, borderRadius = 24 }) {
  return (
    <View
      style={[
        styles.plate,
        {
          borderRadius: borderRadius + 8,
          backgroundColor: isDark ? 'rgba(194, 65, 12, 0.16)' : 'rgba(255, 107, 157, 0.10)',
          ...Platform.select({
            ios: {
              shadowColor: '#C2410C',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: isDark ? 0.55 : 0.32,
              shadowRadius: 22,
            },
            android: { elevation: 10 },
          }),
        },
      ]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  plate: {
    position: 'absolute',
    top: 10,
    left: 6,
    right: 6,
    bottom: 2,
    zIndex: 0,
  },
});
