// Neobrutalist avatar with brand gradient background or image
// Flow: renders circular avatar with border, gradient fallback if no image
// Where used: profiles, user lists, comments, headers
//
// vocab: avatar = circular user image or initials

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { nb, gradients } from './colorPalette';

/**
 * Circular avatar with image or initials on gradient.
 * 
 * @param {object} props
 * @param {string} [props.source] - image URI
 * @param {string} [props.initials] - fallback initials (1-2 chars)
 * @param {number} [props.size] - diameter in pixels (default 40)
 * @param {object} [props.style] - additional container styles
 */
export default function NbAvatar({ source, initials, size = 40, style }) {
  const radius = size / 2;
  
  if (source) {
    return (
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius: radius,
            borderColor: '#0A0A0F',
          },
          style,
        ]}
      >
        <Image
          source={{ uri: source }}
          style={[
            styles.image,
            { width: size, height: size, borderRadius: radius },
          ]}
        />
      </View>
    );
  }
  
  return (
    <LinearGradient
      colors={gradients.brand.colors}
      start={gradients.brand.start}
      end={gradients.brand.end}
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: radius,
          borderColor: '#0A0A0F',
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.initials,
          { fontSize: size * 0.4 },
        ]}
      >
        {initials || '?'}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: nb.borderWidth,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    // Image fills the container
  },
  initials: {
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#0A0A0F',
    textTransform: 'uppercase',
  },
});
