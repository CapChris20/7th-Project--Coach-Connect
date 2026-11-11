// Neobrutalist hero section with gradient title text
// Flow: renders large title with gradient mask and optional subtitle
// Where used: screen headers, splash, empty states, welcome screens
//
// vocab: hero = prominent header section with large title

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { gradients, spacing } from './colorPalette';
import { useTheme } from './lightDarkMode';

/**
 * Hero section with gradient-masked title and subtitle.
 * 
 * @param {object} props
 * @param {string} props.title - main hero title
 * @param {string} [props.subtitle] - optional subtitle
 * @param {React.ReactNode} [props.children] - additional content below
 * @param {object} [props.style] - additional container styles
 */
export default function NbHero({ title, subtitle, children, style }) {
  const { colors } = useTheme();
  
  const titleGradient = colorScheme === 'dark' ? gradients.title.dark : gradients.title.light;
  
  return (
    <View style={[styles.container, style]}>
      <MaskedView
        maskElement={
          <Text style={styles.titleMask}>
            {title}
          </Text>
        }
      >
        <LinearGradient
          colors={titleGradient.colors}
          start={titleGradient.start}
          end={titleGradient.end}
        >
          <Text style={[styles.titleMask, { opacity: 0 }]}>
            {title}
          </Text>
        </LinearGradient>
      </MaskedView>
      
      {subtitle && (
        <Text
          style={[
            styles.subtitle,
            { color: colors.nbMuted },
          ]}
        >
          {subtitle}
        </Text>
      )}
      
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  titleMask: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    lineHeight: 36,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
